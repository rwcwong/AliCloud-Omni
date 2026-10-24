import { AlarmEvent, Device } from '../types';

export function isAlarmSeverity(severity: string): boolean {
  return severity === 'critical' || severity === 'alarm' || severity === 'high';
}

export const CRITICAL_DEVICE_STATUSES = ['Alarm', 'Activated', 'Panel Fire', 'MCCB Off'];
export const FAULT_DEVICE_STATUSES = ['Fault', 'Panel Fault', 'Low Level', 'High Level', 'Low Pressure'];
const NORMAL_DEVICE_STATUSES = ['Normal', 'On', 'Power On', 'Closed', 'Running'];

/** Device snapshots are the ground truth for physical status. */
export function getNormalDeviceIds(devices: Device[]): Set<string> {
  const ids = new Set<string>();
  for (const d of devices) {
    if (NORMAL_DEVICE_STATUSES.includes(d.status)) ids.add(d.id);
  }
  return ids;
}

/** Open work orders are tracked separately from physical device status. */
export function getDevicesWithOpenAlarms(alarms: AlarmEvent[], normalDeviceIds: Set<string>): Set<string> {
  const ids = new Set<string>();
  for (const a of alarms) {
    if (a.status === 'resolved') continue;
    if (!a.device_id) continue;
    if (normalDeviceIds.has(a.device_id)) continue;
    ids.add(a.device_id);
  }
  return ids;
}

/** Preserve the API physical status even when no open work order is available. */
export function normalizedStatus(d: Device, _devicesWithOpenAlarms: Set<string>): string {
  // Physical status 0/1/2/3 is authoritative. A delayed, paginated or unavailable
  // alarm list must never turn a backend Alarm/Fault into Normal.
  return d.status;
}

/** Count physical Alarm/Fault devices, not work orders or inferred cleared states. */
export function countAlarmFault(
  devices: Device[],
  alarms: AlarmEvent[],
): { alarmCount: number; faultCount: number } {
  const normalIds = getNormalDeviceIds(devices);
  const openAlarmIds = getDevicesWithOpenAlarms(alarms, normalIds);
  const alarmCount = devices.filter(d => CRITICAL_DEVICE_STATUSES.includes(normalizedStatus(d, openAlarmIds))).length;
  const faultCount = devices.filter(d => FAULT_DEVICE_STATUSES.includes(normalizedStatus(d, openAlarmIds))).length;
  return { alarmCount, faultCount };
}
