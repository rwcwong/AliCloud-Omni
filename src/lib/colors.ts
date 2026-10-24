import { DeviceStatus, AlarmSeverity } from '../types';

export function statusColor(status: DeviceStatus): string {
  switch (status) {
    case 'Normal': case 'Power On': case 'Open': case 'On': case 'Auto Mode': return '#22c55e';
    case 'Alarm': case 'Activated': case 'Panel Fire': return '#ef4444';
    case 'Fault': case 'Low Level': case 'High Level': case 'Low Pressure': case 'Panel Fault': return '#f6c945';
    case 'Offline': return '#6b7280';
    case 'Testing': return '#3b82f6';
    case 'Acknowledged': return '#60a5fa';
    case 'Running': return '#10b981';
    case 'Closed': return '#6b7280';
    case 'Off': return '#374151';
    case 'Manual Mode': return '#f59e0b';
    case 'MCCB Off': return '#ef4444';
    case 'Homed': return '#3b82f6';
    default: return '#6b7280';
  }
}

export function statusBgClass(status: DeviceStatus): string {
  switch (status) {
    case 'Normal': case 'Power On': case 'Open': case 'On': case 'Running': case 'Auto Mode':
      return 'bg-green-500/20 text-green-400 border-green-500/40';
    case 'Alarm': case 'Activated': case 'Panel Fire': case 'MCCB Off':
      return 'bg-red-500/20 text-red-400 border-red-500/40';
    case 'Fault': case 'Low Level': case 'High Level': case 'Low Pressure': case 'Panel Fault':
      return 'bg-yellow-300/20 text-yellow-300 border-yellow-300/40';
    case 'Offline': case 'Closed':
      return 'bg-gray-500/20 text-gray-400 border-gray-500/40';
    case 'Testing': case 'Homed':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    case 'Acknowledged':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    case 'Manual Mode':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/40';
  }
}

export function severityColor(severity: AlarmSeverity): string {
  switch (severity) {
    case 'critical': return '#ef4444';
    case 'alarm': case 'high': return '#ef4444';
    case 'fault': case 'medium': return '#eab308';
    case 'low': return '#3b82f6';
  }
}

export function severityBgClass(severity: AlarmSeverity): string {
  switch (severity) {
    case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/40';
    case 'alarm': case 'high': return 'bg-red-500/20 text-red-400 border-red-500/40';
    case 'fault': case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
    case 'low': return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
  }
}

export function isPulsingStatus(status: DeviceStatus): boolean {
  return status === 'Alarm' || status === 'Activated' || status === 'Fault'
    || status === 'Low Level' || status === 'High Level' || status === 'Low Pressure'
    || status === 'Panel Fault';
}
