import { FireAlarmIcon } from '../components/FireAlarmIcon';
import { useDevices } from '../hooks/useDevices';
import { useDeviceFilters, deviceLocation } from '../hooks/useDeviceFilters';
import { Device, DeviceStatus } from '../types';
import { statusColor } from '../lib/colors';
import { useT } from '../lib/i18n';

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

function SmokeDetectorIcon({ status, size = 20 }: { status: DeviceStatus; size?: number }) {
  const isAlarm = status === 'Alarm';
  const isFault = status === 'Fault';
  const color = isFault ? '#ef4444' : isAlarm ? '#ef4444' : '#22c55e';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" fill={isAlarm ? `${color}20` : '#1f2937'} stroke={color} strokeWidth="1.5" />
      <circle cx="12" cy="12" r="5" fill="none" stroke={color} strokeWidth="1" opacity="0.5" />
      <circle cx="12" cy="12" r="2" fill={color} className={isAlarm ? 'animate-pulse' : ''} />
      {isAlarm && (
        <>
          <line x1="12" y1="3" x2="12" y2="6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="12" y1="18" x2="12" y2="21" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="3" y1="12" x2="6" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="18" y1="12" x2="21" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function HeatDetectorIcon({ status, value, size = 20 }: { status: DeviceStatus; value: number | null; size?: number }) {
  const isAlarm = status === 'Alarm';
  const isFault = status === 'Fault';
  const color = isFault ? '#ef4444' : isAlarm ? '#ef4444' : '#22c55e';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3" width="16" height="18" rx="8" fill={isAlarm ? `${color}20` : '#1f2937'} stroke={color} strokeWidth="1.5" />
      <rect x="8" y="7" width="8" height="10" rx="4" fill={color} opacity={isAlarm ? 0.9 : 0.25} className={isAlarm ? 'animate-pulse' : ''} />
      <text x="12" y="21" fill={color} fontSize="5" textAnchor="middle" fontWeight="bold">
        {value != null ? `${Math.round(value)}` : ''}
      </text>
    </svg>
  );
}

function GasDetectorIcon({ status, value, size = 20 }: { status: DeviceStatus; value: number | null; size?: number }) {
  const isAlarm = status === 'Alarm';
  const isFault = status === 'Fault';
  const color = isFault ? '#ef4444' : isAlarm ? '#ef4444' : '#22c55e';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="10" r="6" fill={isAlarm ? `${color}20` : '#1f2937'} stroke={color} strokeWidth="1.5" className={isAlarm ? 'animate-pulse' : ''} />
      <path d="M12 4 C10 6, 14 8, 12 10 C10 12, 14 14, 12 16" stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <rect x="8" y="16" width="8" height="4" rx="1" fill={color} opacity="0.3" />
      <text x="12" y="22" fill={color} fontSize="4.5" textAnchor="middle" fontWeight="bold">
        {value != null ? `${Math.round(value)}` : ''}
      </text>
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
  const isOn = status === 'On';
  const isFault = status === 'Fault';
  const color = isFault ? '#ef4444' : isOn ? '#ef4444' : '#6b7280';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={isOn ? 'animate-pulse' : ''}>
      <path d="M12 3 C8 3, 6 6, 6 10 V14 L4 16 H20 L18 14 V10 C18 6, 16 3, 12 3 Z" fill={isOn ? `${color}30` : '#1f2937'} stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 19 C10 20.5, 14 20.5, 14 19" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {isOn && (
        <>
          <path d="M12 0 V2" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
          <path d="M5 2 L6.5 3.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
          <path d="M19 2 L17.5 3.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
        </>
      )}
    </svg>
  );
}

function FlashlightIcon({ status, size = 20 }: { status: DeviceStatus; size?: number }) {
  const isOn = status === 'On';
  const isFault = status === 'Fault';
  const color = isFault ? '#ef4444' : isOn ? '#facc15' : '#6b7280';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" fill={isOn ? `${color}30` : '#1f2937'} stroke={color} strokeWidth="1.5" className={isOn ? 'animate-pulse' : ''} />
      <circle cx="12" cy="12" r="5" fill="none" stroke={color} strokeWidth="1" opacity="0.5" />
      <circle cx="12" cy="12" r="2.5" fill={color} opacity={isOn ? 1 : 0.4} />
      {isOn && (
        <>
          <path d="M12 1 L12 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <path d="M12 20 L12 23" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <path d="M1 12 L4 12" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <path d="M20 12 L23 12" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        </>
      )}
    </svg>
  );
}

function DetectorCard({ device, icon, lang }: {
  device: Device;
  icon: React.ReactNode;
  lang: string;
}) {
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
        {device.current_value != null && dt?.unit && (
          <span className="text-xs text-gray-400 font-mono">{device.current_value} {dt.unit}</span>
        )}
        <span className="text-xs font-bold" style={{ color }}>{t(device.status)}</span>
        {isAlarm && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse flex-shrink-0">
            {device.status === 'Activated' ? (lang === 'en' ? 'PRESS' : lang === 'zh-CN' ? '按下' : '按下') : (lang === 'en' ? 'FIRE' : lang === 'zh-CN' ? '火警' : '火警')}
          </span>
        )}
      </div>
    </div>
  );
}

export function DetectionPanel({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const { devices } = useDevices();

  const detectionDevices = devices.filter(d => d.device_types?.category === 'detection');
  const { filteredDevices, filterBar, lang: filterLang } = useDeviceFilters(detectionDevices);

  const smokeDetectors = filteredDevices.filter(d => d.device_types?.code === 'SD');
  const heatDetectors  = filteredDevices.filter(d => d.device_types?.code === 'HD');
  const gasDetectors   = filteredDevices.filter(d => d.device_types?.code === 'GD');
  const manualCallPts  = filteredDevices.filter(d => d.device_types?.code === 'MCP');
  const alarmBells     = filteredDevices.filter(d => d.device_types?.code === 'AB');
  const flashlights    = filteredDevices.filter(d => d.device_types?.code === 'FL');

  const hasAny = filteredDevices.length > 0;
  const hasAlarm = filteredDevices.some(d => d.status === 'Alarm' || d.status === 'Activated');
  const hasFault = filteredDevices.some(d => d.status === 'Fault');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FireAlarmIcon size={14} className="text-red-400" />
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{t('detection_panel')}</span>
          <span className="text-xs text-gray-500 ml-1">({filteredDevices.length})</span>
        </div>
        <div className="flex items-center gap-1.5">
          {hasAlarm && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
              {t('Alarm')}
            </span>
          )}
          {hasFault && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
              {t('Fault')}
            </span>
          )}
        </div>
      </div>

      {!compact && filterBar}

      <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
        {!hasAny && (
          <div className="text-gray-500 text-sm text-center py-8">{t('no_devices')}</div>
        )}

        {/* Smoke Detectors */}
        {smokeDetectors.length > 0 && (
          <section>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="w-1 h-3 bg-red-400 rounded-full" />{t('smoke_detector')}
            </div>
            <div className="space-y-1.5">
              {smokeDetectors.map(d => (
                <DetectorCard key={d.id} device={d} icon={<SmokeDetectorIcon status={d.status} />} lang={filterLang} />
              ))}
            </div>
          </section>
        )}

        {/* Heat Detectors */}
        {heatDetectors.length > 0 && (
          <section>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="w-1 h-3 bg-orange-400 rounded-full" />{t('heat_detector')}
            </div>
            <div className="space-y-1.5">
              {heatDetectors.map(d => (
                <DetectorCard key={d.id} device={d} icon={<HeatDetectorIcon status={d.status} value={d.current_value} />} lang={filterLang} />
              ))}
            </div>
          </section>
        )}

        {/* Gas Detectors */}
        {gasDetectors.length > 0 && (
          <section>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="w-1 h-3 bg-purple-400 rounded-full" />{t('gas_detector')}
            </div>
            <div className="space-y-1.5">
              {gasDetectors.map(d => (
                <DetectorCard key={d.id} device={d} icon={<GasDetectorIcon status={d.status} value={d.current_value} />} lang={filterLang} />
              ))}
            </div>
          </section>
        )}

        {/* Manual Call Points */}
        {manualCallPts.length > 0 && (
          <section>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="w-1 h-3 bg-yellow-400 rounded-full" />{t('manual_call_point')}
            </div>
            <div className="space-y-1.5">
              {manualCallPts.map(d => (
                <DetectorCard key={d.id} device={d} icon={<ManualCallPointIcon status={d.status} />} lang={filterLang} />
              ))}
            </div>
          </section>
        )}

        {/* Alarm Bells */}
        {alarmBells.length > 0 && (
          <section>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="w-1 h-3 bg-amber-400 rounded-full" />{t('alarm_bell')}
            </div>
            <div className="space-y-1.5">
              {alarmBells.map(d => (
                <DetectorCard key={d.id} device={d} icon={<AlarmBellIcon status={d.status} />} lang={filterLang} />
              ))}
            </div>
          </section>
        )}

        {/* Flashlights / Strobes */}
        {flashlights.length > 0 && (
          <section>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="w-1 h-3 bg-lime-400 rounded-full" />{t('flashlight')}
            </div>
            <div className="space-y-1.5">
              {flashlights.map(d => (
                <DetectorCard key={d.id} device={d} icon={<FlashlightIcon status={d.status} />} lang={filterLang} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
