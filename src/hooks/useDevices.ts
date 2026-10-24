import { useEffect, useId, useRef } from 'react';
import { apiData } from '../lib/apiData';
import { applyDeviceSignal } from '../lib/deviceSignals';
import { useApiQuery } from './useApiQuery';
import type { Device, DeviceSignal } from '../types';
import { useTransport } from '../transport/TransportContext';
export function useDevices(floorId?: string, floorIds?: string[]) {
  const ids = floorId ? [floorId] : floorIds;
  const latest = useRef(new Map<string, DeviceSignal>());
  const channel = useId();
  const { transport } = useTransport();
  const query = useApiQuery('devices:' + (ids ? [...ids].sort().join('|') : '*'), async () =>
    (await apiData.devices(ids)).map(device => applyDeviceSignal(device, latest.current.get(device.id))), [] as Device[]);
  const { setData } = query;
  useEffect(() => {
    transport.subscribe(channel, signal => {
      const previous = latest.current.get(signal.deviceId);
      if (previous && previous.timestamp > signal.timestamp) return;
      latest.current.set(signal.deviceId, signal);
      setData(rows => rows.map(device => applyDeviceSignal(device, signal)));
    });
    return () => transport.unsubscribe(channel);
  }, [channel, transport, setData]);
  return { devices: query.data, loading: query.loading, error: query.error, refetch: query.refetch };
}
