import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { DeviceSignal } from '../types';
import { ITransport, TransportConnectionState } from './ITransport';
import { WebSocketTransport } from './WebSocketTransport';
import { notifyTelemetryChanged } from '../lib/apiData';
import { useT } from '../lib/i18n';

interface TransportContextValue {
  transport: ITransport;
  connectionState: TransportConnectionState;
  lastSignal: DeviceSignal | null;
}

const TransportContext = createContext<TransportContextValue | null>(null);

export function TransportProvider({ children }: { children: React.ReactNode }) {
  const t = useT();
  const transportRef = useRef<ITransport>(new WebSocketTransport());
  const [connectionState, setConnectionState] = useState<TransportConnectionState>('connecting');
  const [lastSignal, setLastSignal] = useState<DeviceSignal | null>(null);
  const [alarmSignal, setAlarmSignal] = useState<DeviceSignal | null>(null);

  useEffect(() => {
    const t = transportRef.current;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    t.subscribe('global-devices', (signal) => {
      setLastSignal(signal);
      if (signal.status === 'Alarm' || signal.status === 'Fault') setAlarmSignal(signal);
      if (refreshTimer === null) refreshTimer = setTimeout(() => { refreshTimer = null; notifyTelemetryChanged(); }, 2000);
    }, setConnectionState);
    return () => { if (refreshTimer !== null) clearTimeout(refreshTimer); t.destroy(); };
  }, []);
  useEffect(() => {
    if (!alarmSignal) return;
    const timer = setTimeout(() => setAlarmSignal(null), 6000);
    return () => clearTimeout(timer);
  }, [alarmSignal]);

  return (
    <TransportContext.Provider value={{ transport: transportRef.current, connectionState, lastSignal }}>
      {children}
      {alarmSignal && <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-[2000] max-w-sm rounded-lg border border-amber-400/40 bg-slate-950 px-4 py-3 text-sm text-amber-100 shadow-lg">
        {alarmSignal.deviceCode} · {t(alarmSignal.status)}{alarmSignal.reason ? ` · ${alarmSignal.reason}` : ''}
      </div>}
    </TransportContext.Provider>
  );
}

export function useTransport() {
  const ctx = useContext(TransportContext);
  if (!ctx) throw new Error('useTransport must be used within TransportProvider');
  return ctx;
}
