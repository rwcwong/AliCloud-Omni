import { API_WEBSOCKET_URLS, api } from '../lib/api';
import { DeviceSignal, DeviceStatus } from '../types';
import { ITransport, TransportConnectionState } from './ITransport';
import type { ApiDeviceStatus, IotStreamPayload } from '../api/types';

const HEARTBEAT_INTERVAL_MS = 25_000;
const DEDUPLICATION_WINDOW_MS = 10_000;
const RECONNECT_DELAY_MS = 5_000;

function deviceStatus(value: ApiDeviceStatus): DeviceStatus {
  if (value === 0) return 'Normal';
  if (value === 1) return 'Fault';
  if (value === 2) return 'Alarm';
  return 'Offline';
}

function socketUrl(baseUrl: string, token: string): string {
  const url = new URL(baseUrl);
  // v3 requires the bearer token in the browser WebSocket handshake query.
  url.searchParams.set('token', token);
  return url.toString();
}

export class WebSocketTransport implements ITransport {
  connectionState: TransportConnectionState = 'connecting';

  private callbacks = new Map<string, (signal: DeviceSignal) => void>();
  private stateCallbacks = new Map<string, (state: TransportConnectionState) => void>();
  private sockets = new Map<string, WebSocket>();
  private nodeStates = new Map<string, TransportConnectionState>();
  private retryCounts = new Map<string, number>();
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private fingerprints = new Map<string, number>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  subscribe(
    channel: string,
    callback: (signal: DeviceSignal) => void,
    onStateChange?: (state: TransportConnectionState) => void,
  ): void {
    this.callbacks.set(channel, callback);
    if (onStateChange) this.stateCallbacks.set(channel, onStateChange);
    if (this.sockets.size === 0) this.connectAll();
    else onStateChange?.(this.connectionState);
  }

  unsubscribe(channel: string): void {
    this.callbacks.delete(channel);
    this.stateCallbacks.delete(channel);
  }

  destroy(): void {
    this.destroyed = true;
    this.reconnectTimers.forEach(timer => clearTimeout(timer));
    this.reconnectTimers.clear();
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.sockets.forEach(socket => {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      socket.close(1000, 'client shutdown');
    });
    this.sockets.clear();
    this.nodeStates.clear();
    this.retryCounts.clear();
    this.callbacks.clear();
    this.stateCallbacks.clear();
    this.fingerprints.clear();
    this.updateState('disconnected');
  }

  private connectAll() {
    const token = api.getAccessToken();
    if (!token || API_WEBSOCKET_URLS.length === 0) {
      this.updateState('error');
      return;
    }
    this.destroyed = false;
    API_WEBSOCKET_URLS.forEach(url => this.connectNode(url, token));
    if (!this.heartbeatTimer) {
      this.heartbeatTimer = setInterval(() => {
        this.sockets.forEach(socket => {
          if (socket.readyState === WebSocket.OPEN) socket.send('ping');
        });
        this.pruneFingerprints();
      }, HEARTBEAT_INTERVAL_MS);
    }
  }

  private connectNode(baseUrl: string, token: string) {
    if (this.destroyed) return;
    const existing = this.sockets.get(baseUrl);
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) return;

    this.nodeStates.set(baseUrl, 'connecting');
    this.recalculateState();

    let socket: WebSocket;
    try {
      socket = new WebSocket(socketUrl(baseUrl, token));
    } catch {
      this.nodeStates.set(baseUrl, 'error');
      this.recalculateState();
      this.scheduleReconnect(baseUrl);
      return;
    }

    this.sockets.set(baseUrl, socket);
    socket.onopen = () => {
      if (this.destroyed || this.sockets.get(baseUrl) !== socket) return;
      this.retryCounts.set(baseUrl, 0);
      this.nodeStates.set(baseUrl, 'connected');
      this.recalculateState();
      socket.send('ping');
    };
    socket.onmessage = event => { if (!this.destroyed && this.sockets.get(baseUrl) === socket) this.handleMessage(event.data); };
    socket.onerror = () => {
      if (this.destroyed || this.sockets.get(baseUrl) !== socket) return;
      this.nodeStates.set(baseUrl, 'error');
      this.recalculateState();
      socket.close();
      this.scheduleReconnect(baseUrl);
    };
    socket.onclose = () => {
      if (this.destroyed || this.sockets.get(baseUrl) !== socket) return;
      this.sockets.delete(baseUrl);
      this.nodeStates.set(baseUrl, 'disconnected');
      this.recalculateState();
      this.scheduleReconnect(baseUrl);
    };
  }

  private scheduleReconnect(baseUrl: string) {
    if (this.destroyed || this.reconnectTimers.has(baseUrl)) return;
    const attempt = (this.retryCounts.get(baseUrl) ?? 0) + 1;
    this.retryCounts.set(baseUrl, attempt);
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(baseUrl);
      const token = api.getAccessToken();
      if (token) this.connectNode(baseUrl, token);
    }, RECONNECT_DELAY_MS);
    this.reconnectTimers.set(baseUrl, timer);
  }

  private handleMessage(raw: unknown) {
    if (raw === 'pong') return;
    try {
      const parsed = JSON.parse(String(raw)) as IotStreamPayload;
      if (parsed.type !== 'device_status_change') return;
      const data = parsed.data;
      if (!data || typeof data.device_id !== 'string' || ![0, 1, 2, 3].includes(data.status) || typeof data.timestamp !== 'string' || !data.timestamp) return;
      if (data.current_value != null && (typeof data.current_value !== 'number' || !Number.isFinite(data.current_value))) return;
      const fingerprint = JSON.stringify(data);
      const now = Date.now();
      const seenAt = this.fingerprints.get(fingerprint);
      if (seenAt !== undefined && now - seenAt < DEDUPLICATION_WINDOW_MS) return;
      this.fingerprints.set(fingerprint, now);

      const signal: DeviceSignal = {
        deviceId: data.device_id,
        deviceCode: data.device_id,
        status: deviceStatus(data.status),
        value: data.current_value,
        timestamp: data.timestamp,
        reason: data.reason,
        batteryValue: data.battery_value,
        unit: data.unit,
      };
      this.callbacks.forEach(callback => callback(signal));
    } catch {
      // Ignore heartbeat strings and malformed third-party frames.
    }
  }

  private pruneFingerprints() {
    const cutoff = Date.now() - DEDUPLICATION_WINDOW_MS;
    this.fingerprints.forEach((timestamp, key) => {
      if (timestamp < cutoff) this.fingerprints.delete(key);
    });
  }

  private recalculateState() {
    const states = [...this.nodeStates.values()];
    if (states.some(state => state === 'connected')) this.updateState('connected');
    else if (states.some(state => state === 'connecting')) this.updateState('connecting');
    else if (states.some(state => state === 'error')) this.updateState('error');
    else this.updateState('disconnected');
  }

  private updateState(state: TransportConnectionState) {
    if (this.connectionState === state) return;
    this.connectionState = state;
    this.stateCallbacks.forEach(callback => callback(state));
  }
}
