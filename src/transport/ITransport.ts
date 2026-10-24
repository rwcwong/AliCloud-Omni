import { DeviceSignal } from '../types';

export type TransportConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface ITransport {
  connectionState: TransportConnectionState;
  subscribe(channel: string, callback: (signal: DeviceSignal) => void, onStateChange?: (state: TransportConnectionState) => void): void;
  unsubscribe(channel: string): void;
  destroy(): void;
}
