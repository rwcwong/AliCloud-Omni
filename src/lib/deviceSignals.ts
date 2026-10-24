import type { Device, DeviceSignal } from '../types';
export function applyDeviceSignal(device: Device, signal?: DeviceSignal): Device {
  if (!signal || signal.deviceId !== device.id || (device.last_seen_at && signal.timestamp < device.last_seen_at)) return device;
  return {
    ...device, status: signal.status, last_seen_at: signal.timestamp,
    api_status: signal.status === 'Normal' ? 0 : signal.status === 'Fault' ? 1 : signal.status === 'Alarm' ? 2 : 3,
    current_value: signal.value === undefined ? device.current_value : signal.value,
    battery_value: signal.batteryValue === undefined ? device.battery_value : signal.batteryValue,
    reason: signal.reason === undefined ? device.reason : signal.reason,
    device_types: device.device_types && signal.unit !== undefined ? { ...device.device_types, unit: signal.unit } : device.device_types,
  };
}
