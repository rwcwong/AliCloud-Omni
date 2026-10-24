import { applyDeviceSignal } from '../lib/deviceSignals';
import { api } from '../lib/api';
import { statusName } from '../lib/apiData';
import { useApiQuery } from './useApiQuery';
import { useTransport } from '../transport/TransportContext';
import type { Device } from '../types';
/** A snapshot enriches telemetry only; missing metadata remains blank. */
export function useDeviceSnapshot(original: Device): Device {
  const query = useApiQuery<Partial<Device> | null>('snapshot:' + original.code, async () => {
    const row = await api.getDeviceSnapshots({ device_id: original.code });
    return { status: statusName(row.status), api_status: row.status, current_value: row.current_value,
      device_types: original.device_types ? { ...original.device_types, unit: row.unit } : original.device_types,
      battery_value: row.battery_value, signal_power: row.signal_power, alarm_min: row.alarm_min,
      alarm_max: row.alarm_max, reason: row.reason, alarm_dynamic: row.alarm_dynamic,
      last_seen_at: row.last_seen ?? '', position_x: row.position_x, position_y: row.position_y };
  }, null as Partial<Device> | null);
  const { lastSignal } = useTransport();
  const device = { ...original, ...query.data };
  return applyDeviceSignal(device, lastSignal ?? undefined);
}
