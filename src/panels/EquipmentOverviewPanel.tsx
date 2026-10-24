import { useState } from 'react';
import { Droplets, Wind, Zap, Filter, Package } from 'lucide-react';
import { FireAlarmIcon } from '../components/FireAlarmIcon';
import { useDevices } from '../hooks/useDevices';
import { useDeviceFilters, deviceLocation } from '../hooks/useDeviceFilters';
import { Device, DeviceStatus } from '../types';
import { statusColor } from '../lib/colors';
import { useT, useLang } from '../lib/i18n';

type Category = 'all' | 'detection' | 'pump' | 'ventilation' | 'water' | 'power_interlocking';

// ─── Shared helpers ─────────────────────────────────────────────────────────

function LocationTag({ device, lang }: { device: Device; lang: string }) {
  return (
    <div>
      <div className="text-xs text-cyan-300 font-medium truncate">{deviceLocation(device, lang)}</div>
      {(device.brand || device.serial_number) && (
        <div className="text-[10px] text-gray-400 truncate">{[device.brand, device.serial_number].filter(Boolean).join(' · ')}</div>
      )}
    </div>
  );
}

function SectionHeader({ color, label, count, hasAlarm, hasFault, lang }: {
  color: string; label: string; count: number; hasAlarm?: boolean; hasFault?: boolean; lang: string;
}) {
  void lang;
  return (
    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
      <span className="w-1 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      {label}
      <span className="text-gray-600 font-normal">({count})</span>
      {hasAlarm && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">Alarm</span>}
      {hasFault && !hasAlarm && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Fault</span>}
    </div>
  );
}

// ─── Detection icons ─────────────────────────────────────────────────────────

function SmokeDetectorIcon({ status, size = 20 }: { status: DeviceStatus; size?: number }) {
  const isAlarm = status === 'Alarm'; const isFault = status === 'Fault';
  const color = isFault ? '#ef4444' : isAlarm ? '#ef4444' : '#22c55e';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" fill={isAlarm ? `${color}20` : '#1f2937'} stroke={color} strokeWidth="1.5" />
      <circle cx="12" cy="12" r="5" fill="none" stroke={color} strokeWidth="1" opacity="0.5" />
      <circle cx="12" cy="12" r="2" fill={color} className={isAlarm ? 'animate-pulse' : ''} />
      {isAlarm && (<><line x1="12" y1="3" x2="12" y2="6" stroke={color} strokeWidth="1.5" strokeLinecap="round" /><line x1="12" y1="18" x2="12" y2="21" stroke={color} strokeWidth="1.5" strokeLinecap="round" /><line x1="3" y1="12" x2="6" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" /><line x1="18" y1="12" x2="21" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" /></>)}
    </svg>
  );
}

function HeatDetectorIcon({ status, value, size = 20 }: { status: DeviceStatus; value: number | null; size?: number }) {
  const isAlarm = status === 'Alarm'; const isFault = status === 'Fault';
  const color = isFault ? '#ef4444' : isAlarm ? '#ef4444' : '#22c55e';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3" width="16" height="18" rx="8" fill={isAlarm ? `${color}20` : '#1f2937'} stroke={color} strokeWidth="1.5" />
      <rect x="8" y="7" width="8" height="10" rx="4" fill={color} opacity={isAlarm ? 0.9 : 0.25} className={isAlarm ? 'animate-pulse' : ''} />
      <text x="12" y="21" fill={color} fontSize="5" textAnchor="middle" fontWeight="bold">{value != null ? `${Math.round(value)}` : ''}</text>
    </svg>
  );
}

function GasDetectorIcon({ status, value, size = 20 }: { status: DeviceStatus; value: number | null; size?: number }) {
  const isAlarm = status === 'Alarm'; const isFault = status === 'Fault';
  const color = isFault ? '#ef4444' : isAlarm ? '#ef4444' : '#22c55e';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="10" r="6" fill={isAlarm ? `${color}20` : '#1f2937'} stroke={color} strokeWidth="1.5" className={isAlarm ? 'animate-pulse' : ''} />
      <path d="M12 4 C10 6, 14 8, 12 10 C10 12, 14 14, 12 16" stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <rect x="8" y="16" width="8" height="4" rx="1" fill={color} opacity="0.3" />
      <text x="12" y="23" fill={color} fontSize="4" textAnchor="middle">{value != null ? Math.round(value) : ''}</text>
    </svg>
  );
}

function ManualCallPointIcon({ status, size = 20 }: { status: DeviceStatus; size?: number }) {
  const isActivated = status === 'Activated';
  const color = isActivated ? '#ef4444' : '#22c55e';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2" fill={isActivated ? `${color}20` : '#1f2937'} stroke={color} strokeWidth="1.5" />
      <rect x="6" y="8" width="12" height="8" rx="1" fill={color} opacity={isActivated ? 0.8 : 0.15} className={isActivated ? 'animate-pulse' : ''} />
      <circle cx="12" cy="12" r="2.5" fill={isActivated ? '#fff' : color} opacity={isActivated ? 1 : 0.4} />
    </svg>
  );
}

function AlarmBellIcon({ status, size = 20 }: { status: DeviceStatus; size?: number }) {
  const isOn = status === 'On'; const isFault = status === 'Fault';
  const color = isFault ? '#ef4444' : isOn ? '#ef4444' : '#6b7280';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={isOn ? 'animate-pulse' : ''}>
      <path d="M12 3 C8 3, 6 6, 6 10 V14 L4 16 H20 L18 14 V10 C18 6, 16 3, 12 3 Z" fill={isOn ? `${color}30` : '#1f2937'} stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 19 C10 20.5, 14 20.5, 14 19" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function FlashlightIcon({ status, size = 20 }: { status: DeviceStatus; size?: number }) {
  const isOn = status === 'On'; const isFault = status === 'Fault';
  const color = isFault ? '#ef4444' : isOn ? '#facc15' : '#6b7280';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" fill={isOn ? `${color}30` : '#1f2937'} stroke={color} strokeWidth="1.5" className={isOn ? 'animate-pulse' : ''} />
      <circle cx="12" cy="12" r="5" fill="none" stroke={color} strokeWidth="1" opacity="0.5" />
      <circle cx="12" cy="12" r="2.5" fill={color} opacity={isOn ? 1 : 0.4} />
    </svg>
  );
}

function DetectorCard({ device, icon, lang }: { device: Device; icon: React.ReactNode; lang: string }) {
  const t = useT();
  const color = statusColor(device.status);
  const isAlarm = device.status === 'Alarm' || device.status === 'Activated';
  const isFault = device.status === 'Fault';
  const dt = device.device_types;
  return (
    <div className={`bg-gray-800/60 border rounded-lg p-3 flex items-center gap-3 transition-all ${isAlarm ? 'border-red-500/40 bg-red-500/5' : isFault ? 'border-red-500/30' : 'border-gray-700/40'}`}>
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium truncate">{device.code}</div>
        <LocationTag device={device} lang={lang} />
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {device.current_value != null && dt?.unit && <span className="text-xs text-gray-400 font-mono">{device.current_value} {dt.unit}</span>}
        <span className="text-xs font-bold" style={{ color }}>{t(device.status)}</span>
        {isAlarm && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse flex-shrink-0">{device.status === 'Activated' ? (lang === 'en' ? 'PRESS' : '按下') : (lang === 'en' ? 'FIRE' : '火警')}</span>}
      </div>
    </div>
  );
}

// ─── Pump icons ──────────────────────────────────────────────────────────────

function ThreeColorLamp({ status }: { status: DeviceStatus }) {
  const isPowerOn = status === 'Power On' || status === 'Running';
  const isRunning = status === 'Running';
  const isFault = status === 'Fault';
  const lamps = [{ on: isPowerOn, color: '#22c55e', label: 'PWR' }, { on: isRunning, color: '#3b82f6', label: 'RUN' }, { on: isFault, color: '#ef4444', label: 'FLT' }];
  return (
    <div className="flex gap-1.5 items-center">
      {lamps.map(({ on, color, label }) => (
        <div key={label} className="flex flex-col items-center gap-0.5">
          <div className={`w-2.5 h-2.5 rounded-full transition-all ${on && isRunning && label === 'RUN' ? 'animate-pulse' : ''}`} style={{ backgroundColor: on ? color : '#374151', boxShadow: on ? `0 0 6px ${color}` : 'none' }} />
          <span style={{ fontSize: '7px', color: on ? color : '#4b5563' }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function PumpCard({ device, lang }: { device: Device; lang: string }) {
  const t = useT();
  const isRunning = device.status === 'Running';
  const isFault = device.status === 'Fault';
  const color = statusColor(device.status);
  return (
    <div className={`bg-gray-800/60 border rounded-lg p-3 flex flex-col gap-2 transition-all ${isFault ? 'border-red-500/40' : 'border-gray-700/40'}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-300 font-semibold">{device.code}</span>
        <ThreeColorLamp status={device.status} />
      </div>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: color, backgroundColor: `${color}10` }}>
          <div className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'animate-spin' : ''}`} style={{ backgroundColor: color }} />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold" style={{ color }}>{t(device.status)}</div>
          <LocationTag device={device} lang={lang} />
        </div>
      </div>
    </div>
  );
}

function PumpControlCard({ device, lang }: { device: Device; lang: string }) {
  const t = useT();
  const isFault = device.status === 'Fault';
  return (
    <div className={`border rounded-lg p-3 flex items-center gap-3 transition-all ${isFault ? 'border-red-500/60 bg-red-500/10 animate-pulse' : 'border-green-500/30 bg-green-500/5'}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="4" width="20" height="16" rx="2" stroke={isFault ? '#ef4444' : '#22c55e'} strokeWidth="1.5"/>
        {[5, 9, 13, 17].map(x => <circle key={x} cx={x} cy="12" r="1.5" fill={isFault ? '#ef4444' : '#22c55e'} opacity={isFault ? 1 : 0.7}/>)}
        <rect x="2" y="4" width="20" height="4" rx="2" fill={isFault ? '#ef444420' : '#22c55e20'}/>
      </svg>
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium">{device.code}</div>
        <LocationTag device={device} lang={lang} />
      </div>
      <span className={`text-xs font-bold flex-shrink-0 ${isFault ? 'text-red-400' : 'text-green-400'}`}>{t(device.status)}</span>
    </div>
  );
}

function PumpTankGauge({ device, lang }: { device: Device; lang: string }) {
  const level = device.current_value ?? 0;
  const isLow = device.status === 'Low Level'; const isHigh = device.status === 'High Level';
  const fillColor = isLow ? '#ef4444' : isHigh ? '#eab308' : '#22c55e';
  return (
    <div className="bg-gray-800/60 border border-gray-700/40 rounded-lg p-3 flex items-center gap-3">
      <svg viewBox="0 0 40 80" className="w-6 h-12 flex-shrink-0">
        <rect x="2" y="2" width="36" height="76" rx="4" fill="#111827" stroke="#374151" strokeWidth="1.5"/>
        <rect x="2" y={2 + 76 * (1 - level / 100)} width="36" height={76 * (level / 100)} rx="2" fill={fillColor} opacity="0.85"/>
        <rect x="2" y="2" width="36" height="76" rx="4" fill="none" stroke="#4b5563" strokeWidth="1.5"/>
      </svg>
      <div className="min-w-0">
        <div className="text-sm font-bold" style={{ color: fillColor }}>{Math.round(level)}%</div>
        <div className="text-white text-xs font-medium">{device.code}</div>
        <LocationTag device={device} lang={lang} />
      </div>
    </div>
  );
}

// ─── Ventilation icons ───────────────────────────────────────────────────────

function SpinningFan({ running, fault, size = 20 }: { running: boolean; fault: boolean; size?: number }) {
  const color = fault ? '#ef4444' : running ? '#22c55e' : '#6b7280';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={running ? 'animate-spin' : ''} style={{ animationDuration: '2s' }}>
      <circle cx="12" cy="12" r="2" fill={color} />
      {[0, 90, 180, 270].map(angle => <path key={angle} d="M12 10 C10 6, 6 4, 8 2 C10 0, 14 4, 12 10 Z" fill={color} opacity="0.85" transform={`rotate(${angle} 12 12)`} />)}
    </svg>
  );
}

function DamperIcon({ status }: { status: DeviceStatus }) {
  const isOpen = status === 'Open'; const isFault = status === 'Fault';
  const color = isFault ? '#ef4444' : isOpen ? '#22c55e' : '#f59e0b';
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke={color} strokeWidth="1.5"/>
      {isOpen ? (<><line x1="7" y1="12" x2="17" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round"/><line x1="4" y1="8" x2="4" y2="16" stroke={color} strokeWidth="1.5"/><line x1="20" y1="8" x2="20" y2="16" stroke={color} strokeWidth="1.5"/></>) : (<><line x1="4" y1="8" x2="20" y2="8" stroke={color} strokeWidth="2" strokeLinecap="round"/><line x1="4" y1="12" x2="20" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round"/><line x1="4" y1="16" x2="20" y2="16" stroke={color} strokeWidth="2" strokeLinecap="round"/></>)}
    </svg>
  );
}

function VentRow({ device, icon, label, lang }: { device: Device; icon: React.ReactNode; label: string; lang: string }) {
  const t = useT();
  const color = statusColor(device.status);
  const isCritical = device.status === 'Fault';
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${isCritical ? 'border-red-500/30 bg-red-500/5' : 'border-gray-700/30 bg-gray-800/40'}`}>
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium truncate">{device.code}</div>
        <div className="text-gray-500 text-xs truncate">{label}</div>
        <LocationTag device={device} lang={lang} />
      </div>
      <span className="text-xs font-semibold flex-shrink-0" style={{ color }}>{t(device.status)}</span>
    </div>
  );
}

// ─── Water icons ─────────────────────────────────────────────────────────────

function WaterFlowCard({ device, lang }: { device: Device; lang: string }) {
  const t = useT();
  const isActivated = device.status === 'Activated';
  return (
    <div className={`bg-gray-800/60 border rounded-lg p-3 flex items-center gap-3 transition-all ${isActivated ? 'border-blue-500/40 bg-blue-500/5' : 'border-gray-700/40'}`}>
      <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
        <rect x="0" y="7" width="28" height="6" rx="3" fill={isActivated ? '#3b82f620' : '#1f2937'} stroke={isActivated ? '#3b82f6' : '#374151'} strokeWidth="1.2"/>
        <line x1="14" y1="0" x2="14" y2="7" stroke={isActivated ? '#3b82f6' : '#374151'} strokeWidth="1.5"/>
        <line x1="14" y1="13" x2="14" y2="20" stroke={isActivated ? '#3b82f6' : '#374151'} strokeWidth="1.5"/>
      </svg>
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium">{device.code}</div>
        <LocationTag device={device} lang={lang} />
      </div>
      <span className="text-xs font-bold flex-shrink-0" style={{ color: isActivated ? '#3b82f6' : '#22c55e' }}>{t(device.status)}</span>
    </div>
  );
}

function WaterValveCard({ device, lang }: { device: Device; lang: string }) {
  const t = useT();
  const isClosed = device.status === 'Closed'; const isFault = device.status === 'Fault';
  const color = isFault ? '#ef4444' : isClosed ? '#ef4444' : '#22c55e';
  return (
    <div className={`bg-gray-800/60 border rounded-lg p-3 flex items-center gap-3 transition-all ${(isClosed || isFault) ? 'border-red-500/40 bg-red-500/5' : 'border-gray-700/40'}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5"/>
        <line x1="12" y1="3" x2="12" y2="21" stroke={color} strokeWidth="1.5" transform={isClosed ? 'rotate(90 12 12)' : ''}/>
        <line x1="3" y1="12" x2="21" y2="12" stroke={color} strokeWidth="1" transform={isClosed ? 'rotate(90 12 12)' : ''}/>
      </svg>
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium">{device.code}</div>
        <LocationTag device={device} lang={lang} />
      </div>
      <span className="text-xs font-bold flex-shrink-0" style={{ color }}>{t(device.status)}</span>
    </div>
  );
}

function WaterGenericCard({ device, lang }: { device: Device; lang: string }) {
  const t = useT();
  const color = statusColor(device.status);
  const isFault = device.status === 'Fault' || device.status === 'Offline';
  const dt = device.device_types;
  return (
    <div className={`bg-gray-800/60 border rounded-lg p-3 flex items-center gap-3 transition-all ${isFault ? 'border-red-500/40 bg-red-500/5' : 'border-gray-700/40'}`}>
      <Droplets size={18} style={{ color }} className="flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium truncate">{device.code}</div>
        <LocationTag device={device} lang={lang} />
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {device.current_value != null && dt?.unit && <span className="text-xs text-gray-400 font-mono">{device.current_value} {dt.unit}</span>}
        <span className="text-xs font-bold" style={{ color }}>{t(device.status)}</span>
      </div>
    </div>
  );
}

// ─── Power icons ─────────────────────────────────────────────────────────────

function GensetCard({ device, lang }: { device: Device; lang: string }) {
  const t = useT();
  const isManual = device.status === 'Manual Mode'; const isRunning = device.status === 'Running';
  const isFault = device.status === 'Fault'; const isMCCB = device.status === 'MCCB Off';
  const color = isFault || isMCCB ? '#ef4444' : isManual ? '#eab308' : isRunning ? '#22c55e' : '#3b82f6';
  return (
    <div className={`bg-gray-800/60 border rounded-xl p-3 transition-all ${isFault ? 'border-red-500/40' : isManual ? 'border-yellow-500/30' : 'border-gray-700/30'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg" style={{ backgroundColor: `${color}20`, border: `1px solid ${color}40` }}><Zap size={12} style={{ color }} /></div>
          <span className="text-white text-sm font-semibold">{device.code}</span>
        </div>
        <span className="text-xs px-1.5 py-0.5 rounded-full border font-semibold" style={{ color, borderColor: `${color}50`, backgroundColor: `${color}15` }}>{t(device.status)}</span>
      </div>
      <LocationTag device={device} lang={lang} />
    </div>
  );
}

function PowerLinkCard({ device, lang }: { device: Device; lang: string }) {
  const t = useT();
  const color = statusColor(device.status);
  const isFault = device.status === 'Fault';
  return (
    <div className={`bg-gray-800/60 border rounded-lg p-3 flex items-center gap-3 transition-all ${isFault ? 'border-red-500/30 bg-red-500/5' : 'border-gray-700/30'}`}>
      <Zap size={16} style={{ color }} className="flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium">{device.code}</div>
        <LocationTag device={device} lang={lang} />
      </div>
      <span className="text-xs font-bold flex-shrink-0" style={{ color }}>{t(device.status)}</span>
    </div>
  );
}

// ─── Category filter dropdown ────────────────────────────────────────────────

const CATEGORIES: { value: Category; labelEn: string; labelZhTW: string; labelZhCN: string; icon: React.ElementType; color: string }[] = [
  { value: 'detection',         labelEn: 'Detection',           labelZhTW: '探測報警',       labelZhCN: '探测报警',       icon: FireAlarmIcon,    color: '#ef4444' },
  { value: 'pump',              labelEn: 'Pump',                labelZhTW: '泵',             labelZhCN: '泵',             icon: Droplets, color: '#3b82f6' },
  { value: 'ventilation',       labelEn: 'Ventilation',         labelZhTW: '通風排煙',       labelZhCN: '通风排烟',       icon: Wind,     color: '#22d3ee' },
  { value: 'water',             labelEn: 'Water',               labelZhTW: '水系統',         labelZhCN: '水系统',         icon: Droplets, color: '#06b6d4' },
  { value: 'power_interlocking',labelEn: 'Power & Interlocking',labelZhTW: '電力及聯動系統', labelZhCN: '电力及联动系统', icon: Zap,      color: '#eab308' },
];

function catLabel(cat: typeof CATEGORIES[0], lang: string) {
  return lang === 'en' ? cat.labelEn : lang === 'zh-CN' ? cat.labelZhCN : cat.labelZhTW;
}

// ─── Main panel ──────────────────────────────────────────────────────────────

export function EquipmentOverviewPanel() {
  const t = useT();
  const { lang } = useLang();
  const { devices } = useDevices();
  const [filterCategory, setFilterCategory] = useState<Category>('all');

  const { filteredDevices, filterBar } = useDeviceFilters(devices);

  const byCategory = (cat: string) => filteredDevices.filter(d => d.device_types?.category === cat);

  const detectionDevices = byCategory('detection');
  const pumpDevices      = byCategory('pump');
  const ventDevices      = filteredDevices.filter(d => d.device_types?.category === 'ventilation' || d.device_types?.code === 'DIRECT_LINK');
  const waterDevices     = byCategory('water');
  const powerDevices     = filteredDevices.filter(d =>
    d.device_types?.category === 'power_interlocking' &&
    ['GENSET', 'FUEL_TANK', 'F_LIFT', 'FIRE_DOOR'].includes(d.device_types?.code ?? '')
  );

  const show = (cat: Category) => filterCategory === 'all' || filterCategory === cat;

  const totalShown = [
    show('detection') ? detectionDevices.length : 0,
    show('pump') ? pumpDevices.length : 0,
    show('ventilation') ? ventDevices.length : 0,
    show('water') ? waterDevices.length : 0,
    show('power_interlocking') ? powerDevices.length : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Package size={14} className="text-cyan-400" />
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            {lang === 'en' ? 'All Equipment' : lang === 'zh-CN' ? '全部设备' : '全部設備'}
          </span>
          <span className="text-xs text-gray-500">({totalShown})</span>
        </div>
      </div>

      {/* Location filters */}
      {filterBar}

      {/* Category filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap flex-shrink-0">
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500">
          <Filter size={11} />{lang === 'en' ? 'Category' : lang === 'zh-CN' ? '类别' : '類別'}
        </span>
        <button
          onClick={() => setFilterCategory('all')}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filterCategory === 'all' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40' : 'text-gray-400 border-gray-700/40 hover:border-gray-600/60'}`}
        >
          {lang === 'en' ? 'All' : lang === 'zh-CN' ? '全部' : '全部'}
        </button>
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const active = filterCategory === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => setFilterCategory(cat.value)}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${active ? 'border-opacity-50 text-white' : 'text-gray-400 border-gray-700/40 hover:border-gray-600/60'}`}
              style={active ? { backgroundColor: `${cat.color}20`, borderColor: `${cat.color}60`, color: cat.color } : {}}
            >
              <Icon size={10} />
              {catLabel(cat, lang)}
            </button>
          );
        })}
      </div>

      {/* Equipment list */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-6">
        {totalShown === 0 && (
          <div className="text-gray-500 text-sm text-center py-12">{t('no_devices')}</div>
        )}

        {/* ── Detection ─────────────────────────────────────── */}
        {show('detection') && detectionDevices.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3 pb-1.5 border-b border-red-500/20">
              <FireAlarmIcon size={13} className="text-red-400" />
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{lang === 'en' ? 'Detection & Alarm' : lang === 'zh-CN' ? '探测报警' : '探測報警'}</span>
              <span className="text-xs text-gray-500">({detectionDevices.length})</span>
              {detectionDevices.some(d => d.status === 'Alarm' || d.status === 'Activated') && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">{t('Alarm')}</span>}
              {detectionDevices.some(d => d.status === 'Fault') && !detectionDevices.some(d => d.status === 'Alarm') && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">{t('Fault')}</span>}
            </div>
            <div className="space-y-4">
              {(() => {
                const sd = detectionDevices.filter(d => d.device_types?.code === 'SD');
                const hd = detectionDevices.filter(d => d.device_types?.code === 'HD');
                const gd = detectionDevices.filter(d => d.device_types?.code === 'GD');
                const mcp = detectionDevices.filter(d => d.device_types?.code === 'MCP');
                const ab = detectionDevices.filter(d => d.device_types?.code === 'AB');
                const fl = detectionDevices.filter(d => d.device_types?.code === 'FL');
                return (<>
                  {sd.length > 0 && <div><SectionHeader color="#ef4444" label={t('smoke_detector')} count={sd.length} hasAlarm={sd.some(d=>d.status==='Alarm')} lang={lang} /><div className="space-y-1.5">{sd.map(d=><DetectorCard key={d.id} device={d} icon={<SmokeDetectorIcon status={d.status}/>} lang={lang}/>)}</div></div>}
                  {hd.length > 0 && <div><SectionHeader color="#f97316" label={t('heat_detector')} count={hd.length} hasAlarm={hd.some(d=>d.status==='Alarm')} lang={lang} /><div className="space-y-1.5">{hd.map(d=><DetectorCard key={d.id} device={d} icon={<HeatDetectorIcon status={d.status} value={d.current_value}/>} lang={lang}/>)}</div></div>}
                  {gd.length > 0 && <div><SectionHeader color="#a855f7" label={t('gas_detector')} count={gd.length} hasAlarm={gd.some(d=>d.status==='Alarm')} lang={lang} /><div className="space-y-1.5">{gd.map(d=><DetectorCard key={d.id} device={d} icon={<GasDetectorIcon status={d.status} value={d.current_value}/>} lang={lang}/>)}</div></div>}
                  {mcp.length > 0 && <div><SectionHeader color="#eab308" label={t('manual_call_point')} count={mcp.length} hasAlarm={mcp.some(d=>d.status==='Activated')} lang={lang} /><div className="space-y-1.5">{mcp.map(d=><DetectorCard key={d.id} device={d} icon={<ManualCallPointIcon status={d.status}/>} lang={lang}/>)}</div></div>}
                  {ab.length > 0 && <div><SectionHeader color="#f59e0b" label={t('alarm_bell')} count={ab.length} lang={lang} /><div className="space-y-1.5">{ab.map(d=><DetectorCard key={d.id} device={d} icon={<AlarmBellIcon status={d.status}/>} lang={lang}/>)}</div></div>}
                  {fl.length > 0 && <div><SectionHeader color="#84cc16" label={t('flashlight')} count={fl.length} lang={lang} /><div className="space-y-1.5">{fl.map(d=><DetectorCard key={d.id} device={d} icon={<FlashlightIcon status={d.status}/>} lang={lang}/>)}</div></div>}
                </>);
              })()}
            </div>
          </section>
        )}

        {/* ── Pump Room ─────────────────────────────────────── */}
        {show('pump') && pumpDevices.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3 pb-1.5 border-b border-blue-500/20">
              <Droplets size={13} className="text-blue-400" />
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{t('pump_category')}</span>
              <span className="text-xs text-gray-500">({pumpDevices.length})</span>
              {pumpDevices.some(d => d.status === 'Fault') && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">{t('Fault')}</span>}
            </div>
            <div className="space-y-4">
              {(() => {
                const panels = pumpDevices.filter(d => d.device_types?.code === 'SP_PANEL');
                const fsps   = pumpDevices.filter(d => d.code.startsWith('FSP-'));
                const sps    = pumpDevices.filter(d => d.code.startsWith('SP-') && !d.code.startsWith('SPR') && !d.code.startsWith('SP-PANEL'));
                const jockeys= pumpDevices.filter(d => d.code.startsWith('FJP-') || d.code.startsWith('SJP-'));
                const tanks  = pumpDevices.filter(d => d.device_types?.code === 'FS_TANK' || d.device_types?.code === 'SPR_TANK');
                const others = pumpDevices.filter(d => !panels.includes(d) && !fsps.includes(d) && !sps.includes(d) && !jockeys.includes(d) && !tanks.includes(d));
                return (<>
                  {panels.length > 0 && <div><SectionHeader color="#22c55e" label={t('pump_control_panel')} count={panels.length} hasFault={panels.some(d=>d.status==='Fault')} lang={lang} /><div className="space-y-2">{panels.map(d=><PumpControlCard key={d.id} device={d} lang={lang}/>)}</div></div>}
                  {fsps.length > 0 && <div><SectionHeader color="#ef4444" label={t('fs_pump')} count={fsps.length} lang={lang} /><div className="grid grid-cols-2 gap-2">{fsps.map(d=><PumpCard key={d.id} device={d} lang={lang}/>)}</div></div>}
                  {sps.length > 0 && <div><SectionHeader color="#3b82f6" label={t('spr_pump')} count={sps.length} lang={lang} /><div className="grid grid-cols-2 gap-2">{sps.map(d=><PumpCard key={d.id} device={d} lang={lang}/>)}</div></div>}
                  {jockeys.length > 0 && <div><SectionHeader color="#eab308" label={t('jockey_pump')} count={jockeys.length} lang={lang} /><div className="grid grid-cols-2 gap-2">{jockeys.map(d=><PumpCard key={d.id} device={d} lang={lang}/>)}</div></div>}
                  {tanks.length > 0 && <div><SectionHeader color="#22d3ee" label={lang === 'en' ? 'Water Tanks' : lang === 'zh-CN' ? '水箱' : '水箱'} count={tanks.length} lang={lang} /><div className="grid grid-cols-2 gap-2">{tanks.map(d=><PumpTankGauge key={d.id} device={d} lang={lang}/>)}</div></div>}
                  {others.length > 0 && <div><SectionHeader color="#6b7280" label={lang === 'en' ? 'Other Pump Devices' : lang === 'zh-CN' ? '其他泵房设备' : '其他泵房設備'} count={others.length} lang={lang} /><div className="space-y-1.5">{others.map(d=><WaterGenericCard key={d.id} device={d} lang={lang}/>)}</div></div>}
                </>);
              })()}
            </div>
          </section>
        )}

        {/* ── Ventilation ───────────────────────────────────── */}
        {show('ventilation') && ventDevices.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3 pb-1.5 border-b border-cyan-500/20">
              <Wind size={13} className="text-cyan-400" />
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{t('ventilation')}</span>
              <span className="text-xs text-gray-500">({ventDevices.length})</span>
              {ventDevices.some(d => d.status === 'Fault') && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">{t('Fault')}</span>}
            </div>
            <div className="space-y-4">
              {(() => {
                const dampers = ventDevices.filter(d => d.device_types?.code === 'FD');
                const smokeF  = ventDevices.filter(d => d.device_types?.code === 'SEF');
                const stairF  = ventDevices.filter(d => d.device_types?.code === 'SPF');
                const vacs    = ventDevices.filter(d => d.device_types?.code === 'VAC');
                const links   = ventDevices.filter(d => d.device_types?.code === 'DIRECT_LINK');
                return (<>
                  {dampers.length > 0 && <div><SectionHeader color="#f97316" label={t('fire_damper')} count={dampers.length} lang={lang} /><div className="space-y-1">{dampers.map(d=><VentRow key={d.id} device={d} icon={<DamperIcon status={d.status}/>} label={t('fire_damper')} lang={lang}/>)}</div></div>}
                  {smokeF.length > 0 && <div><SectionHeader color="#3b82f6" label={t('smoke_fan')} count={smokeF.length} lang={lang} /><div className="space-y-1">{smokeF.map(d=><VentRow key={d.id} device={d} icon={<SpinningFan running={d.status==='Running'} fault={d.status==='Fault'}/>} label={t('smoke_fan')} lang={lang}/>)}</div></div>}
                  {stairF.length > 0 && <div><SectionHeader color="#22c55e" label={t('stair_fan')} count={stairF.length} lang={lang} /><div className="space-y-1">{stairF.map(d=><VentRow key={d.id} device={d} icon={<SpinningFan running={d.status==='Running'} fault={d.status==='Fault'} size={18}/>} label={t('stair_fan')} lang={lang}/>)}</div></div>}
                  {vacs.length > 0 && <div><SectionHeader color="#eab308" label={t('vac_cutoff')} count={vacs.length} lang={lang} /><div className="space-y-1">{vacs.map(d=><VentRow key={d.id} device={d} icon={<DamperIcon status={d.status}/>} label={t('vac_cutoff')} lang={lang}/>)}</div></div>}
                  {links.length > 0 && <div><SectionHeader color="#ef4444" label={t('direct_link')} count={links.length} hasFault={links.some(d=>d.status==='Fault')} lang={lang} /><div className="space-y-1">{links.map(d=><VentRow key={d.id} device={d} icon={<Wind size={18} style={{color: statusColor(d.status)}}/>} label={t('direct_link')} lang={lang}/>)}</div></div>}
                </>);
              })()}
            </div>
          </section>
        )}

        {/* ── Water ────────────────────────────────────────── */}
        {show('water') && waterDevices.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3 pb-1.5 border-b border-sky-500/20">
              <Droplets size={13} className="text-sky-400" />
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{t('water_panel')}</span>
              <span className="text-xs text-gray-500">({waterDevices.length})</span>
              {waterDevices.some(d => d.status === 'Alarm' || d.status === 'Activated') && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">{t('Alarm')}</span>}
              {waterDevices.some(d => d.status === 'Fault' || d.status === 'Offline') && !waterDevices.some(d => d.status === 'Alarm') && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">{t('Fault')}</span>}
            </div>
            <div className="space-y-4">
              {(() => {
                const panels   = waterDevices.filter(d => d.device_types?.code === 'SP_PANEL');
                const tanks    = waterDevices.filter(d => d.device_types?.code === 'FS_TANK' || d.device_types?.code === 'SPR_TANK');
                const flows    = waterDevices.filter(d => d.device_types?.code === 'FS_FLOW');
                const valves   = waterDevices.filter(d => d.device_types?.code === 'SCV');
                const others   = waterDevices.filter(d => !['FS_TANK', 'SPR_TANK', 'FS_FLOW', 'SCV', 'SP_PANEL', 'SPR_SYS'].includes(d.device_types?.code ?? ''));
                return (<>
                  {panels.length > 0 && <div><SectionHeader color="#22c55e" label={t('pump_control_panel')} count={panels.length} lang={lang} /><div className="space-y-2">{panels.map(d=><PumpControlCard key={d.id} device={d} lang={lang}/>)}</div></div>}
                  {tanks.length > 0 && <div><SectionHeader color="#22d3ee" label={lang === 'en' ? 'Water Tanks' : lang === 'zh-CN' ? '水箱' : '水箱'} count={tanks.length} lang={lang} /><div className="grid grid-cols-2 gap-2">{tanks.map(d=><PumpTankGauge key={d.id} device={d} lang={lang}/>)}</div></div>}
                  {flows.length > 0 && <div><SectionHeader color="#0ea5e9" label={lang === 'en' ? 'Flow Switches' : lang === 'zh-CN' ? '流水掣' : '流水掣'} count={flows.length} lang={lang} /><div className="space-y-1.5">{flows.map(d=><WaterFlowCard key={d.id} device={d} lang={lang}/>)}</div></div>}
                  {valves.length > 0 && <div><SectionHeader color="#14b8a6" label={lang === 'en' ? 'Control Valves' : lang === 'zh-CN' ? '阀门' : '閥門'} count={valves.length} lang={lang} /><div className="space-y-1.5">{valves.map(d=><WaterValveCard key={d.id} device={d} lang={lang}/>)}</div></div>}
                  {others.length > 0 && <div><SectionHeader color="#6b7280" label={lang === 'en' ? 'Sensors' : lang === 'zh-CN' ? '传感器' : '感測器'} count={others.length} lang={lang} /><div className="space-y-1.5">{others.map(d=><WaterGenericCard key={d.id} device={d} lang={lang}/>)}</div></div>}
                </>);
              })()}
            </div>
          </section>
        )}

        {/* ── Power & Interlocking ──────────────────────────── */}
        {show('power_interlocking') && powerDevices.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3 pb-1.5 border-b border-yellow-500/20">
              <Zap size={13} className="text-yellow-400" />
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{t('power_linkage')}</span>
              <span className="text-xs text-gray-500">({powerDevices.length})</span>
              {powerDevices.some(d => d.status === 'Fault' || d.status === 'Panel Fault') && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">{t('Fault')}</span>}
            </div>
            <div className="space-y-4">
              {(() => {
                const gensets   = powerDevices.filter(d => d.device_types?.code === 'GENSET');
                const fuelTanks = powerDevices.filter(d => d.device_types?.code === 'FUEL_TANK');
                const lifts     = powerDevices.filter(d => d.device_types?.code === 'F_LIFT');
                const fireDoors = powerDevices.filter(d => d.device_types?.code === 'FIRE_DOOR');
                return (<>
                  {gensets.length > 0 && <div><SectionHeader color="#eab308" label={t('genset')} count={gensets.length} lang={lang} /><div className="space-y-2">{gensets.map(d=><GensetCard key={d.id} device={d} lang={lang}/>)}</div></div>}
                  {fuelTanks.length > 0 && <div><SectionHeader color="#ef4444" label={t('fuel_tank')} count={fuelTanks.length} lang={lang} /><div className="space-y-2">{fuelTanks.map(d=><PowerLinkCard key={d.id} device={d} lang={lang}/>)}</div></div>}
                  {lifts.length > 0 && <div><SectionHeader color="#3b82f6" label={t('lift_homing')} count={lifts.length} lang={lang} /><div className="space-y-1.5">{lifts.map(d=><PowerLinkCard key={d.id} device={d} lang={lang}/>)}</div></div>}
                  {fireDoors.length > 0 && <div><SectionHeader color="#22c55e" label={t('fire_door')} count={fireDoors.length} lang={lang} /><div className="space-y-1.5">{fireDoors.map(d=><PowerLinkCard key={d.id} device={d} lang={lang}/>)}</div></div>}
                </>);
              })()}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
