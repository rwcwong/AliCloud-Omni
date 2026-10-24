import { useMemo } from 'react';
import { useAlarms } from './useAlarms';

export function useDeviceAlarms(deviceId: string | undefined) {
  const { alarms } = useAlarms();
  return useMemo(() => !deviceId ? [] : alarms
    .filter(alarm => alarm.device_id === deviceId)
    .sort((a, b) => new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime())
    .slice(0, 20), [alarms, deviceId]);
}
