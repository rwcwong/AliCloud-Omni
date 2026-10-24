import { Droplets } from 'lucide-react';
import { useDevices } from '../hooks/useDevices';
import { useDeviceFilters, deviceLocation } from '../hooks/useDeviceFilters';
import { Device, DeviceStatus } from '../types';
import { statusColor } from '../lib/colors';
import { useT } from '../lib/i18n';

function ThreeColorLamp({ status }: { status: DeviceStatus }) {
  const isPowerOn = status === 'Power On' || status === 'Running';
  const isRunning = status === 'Running';
  const isFault = status === 'Fault';
  const lamps = [
    { on: isPowerOn, color: '#22c55e', label: 'PWR' },
    { on: isRunning, color: '#3b82f6', label: 'RUN' },
    { on: isFault,   color: '#ef4444', label: 'FLT' },
  ];
  return (
    <div className="flex gap-1.5 items-center">
      {lamps.map(({ on, color, label }) => (
        <div key={label} className="flex flex-col items-center gap-0.5">
          <div
            className={`w-2.5 h-2.5 rounded-full transition-all ${on && isRunning && label === 'RUN' ? 'animate-pulse' : ''}`}
            style={{ backgroundColor: on ? color : '#374151', boxShadow: on ? `0 0 6px ${color}` : 'none' }}
          />
          <span style={{ fontSize: '7px', color: on ? color : '#4b5563' }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

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

function PumpCard({ device, label, lang }: { device: Device; label: string; lang: string }) {
  const t = useT();
  const isRunning = device.status === 'Running';
  const isFault = device.status === 'Fault';
  const color = statusColor(device.status);
  return (
    <div className={`bg-gray-800/60 border rounded-lg p-3 flex flex-col gap-2 transition-all ${isFault ? 'border-red-500/40' : 'border-gray-700/40'}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-300 font-semibold">{label}</span>
        <ThreeColorLamp status={device.status} />
      </div>
      <div className="flex items-center gap-2">
        <div className="relative w-8 h-8 flex-shrink-0">
          <div
            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${isRunning ? 'animate-spin' : ''}`}
            style={{ borderColor: color, backgroundColor: `${color}10`, animationDuration: '3s' }}
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold" style={{ color }}>{t(device.status)}</div>
          <LocationTag device={device} lang={lang} />
        </div>
      </div>
    </div>
  );
}

function TankGauge({ device, label, lang }: { device: Device; label: string; lang: string }) {
  const level = device.current_value ?? 0;
  const isLow = device.status === 'Low Level';
  const isHigh = device.status === 'High Level';
  const fillColor = isLow ? '#ef4444' : isHigh ? '#eab308' : '#22c55e';
  return (
    <div className="bg-gray-800/60 border border-gray-700/40 rounded-lg p-3">
      <div className="text-xs text-gray-400 font-medium mb-2">{label}</div>
      <div className="flex items-end gap-3">
        <div className="relative w-10 h-20 flex-shrink-0">
          <svg viewBox="0 0 40 80" className="w-full h-full">
            <rect x="2" y="2" width="36" height="76" rx="4" fill="#111827" stroke="#374151" strokeWidth="1.5"/>
            <rect x="2" y={2 + 76 * (1 - level / 100)} width="36" height={76 * (level / 100)} rx="2" fill={fillColor} opacity="0.85"/>
            <rect x="2" y="2" width="36" height="76" rx="4" fill="none" stroke="#4b5563" strokeWidth="1.5"/>
            {[25, 50, 75].map(l => (
              <g key={l}>
                <line x1="30" y1={2 + 76 * (1 - l / 100)} x2="38" y2={2 + 76 * (1 - l / 100)} stroke="#6b7280" strokeWidth="0.5"/>
                <text x="28" y={2 + 76 * (1 - l / 100) + 3} fill="#4b5563" fontSize="5" textAnchor="end">{l}</text>
              </g>
            ))}
          </svg>
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold leading-none" style={{ color: fillColor }}>
            {Math.round(level)}<span className="text-sm ml-0.5">%</span>
          </div>
          <LocationTag device={device} lang={lang} />
          {isLow && <div className="text-xs text-red-400 font-bold mt-0.5 animate-pulse">{lang === 'en' ? 'LOW' : lang === 'zh-CN' ? '低' : '低'}</div>}
          {isHigh && <div className="text-xs text-yellow-400 font-bold mt-0.5">{lang === 'en' ? 'HIGH' : lang === 'zh-CN' ? '高' : '高'}</div>}
        </div>
      </div>
    </div>
  );
}

function PressureGauge({ device, lang }: { device: Device; lang: string }) {
  const t = useT();
  const val = device.current_value ?? 0;
  const max = 15;
  const pct = Math.min(val / max, 1);
  const isLow = device.status === 'Low Pressure';
  const color = isLow ? '#ef4444' : val > 10 ? '#eab308' : '#22c55e';
  const angle = -135 + pct * 270;
  return (
    <div className="bg-gray-800/60 border border-gray-700/40 rounded-lg p-3">
      <div className="text-xs text-gray-400 font-medium mb-2">{t('system_pressure')}</div>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 80 55" className="w-24 h-16">
          <path d="M8,48 A32,32 0 0,1 72,48" fill="none" stroke="#1f2937" strokeWidth="6" strokeLinecap="round"/>
          <path d="M8,48 A32,32 0 0,1 72,48" fill="none" stroke="#22c55e" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${Math.min(pct, 0.67) * 100.5} 100.5`} opacity="0.6"/>
          {pct > 0.67 && (
            <path d="M8,48 A32,32 0 0,1 72,48" fill="none" stroke="#eab308" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(pct - 0.67) * 100.5} 100.5`} strokeDashoffset={-67.3} opacity="0.6"/>
          )}
          <path d="M8,48 A32,32 0 0,1 72,48" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${pct * 100.5} 100.5`}/>
          <g transform={`translate(40,48) rotate(${angle})`}>
            <line x1="0" y1="0" x2="0" y2="-26" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="0" cy="0" r="3" fill="white"/>
          </g>
          <text x="40" y="50" fill="#9ca3af" fontSize="8" textAnchor="middle">0</text>
          <text x="8" y="30" fill="#9ca3af" fontSize="7" textAnchor="middle">0</text>
          <text x="72" y="30" fill="#9ca3af" fontSize="7" textAnchor="middle">{max}</text>
        </svg>
        <div className="min-w-0">
          <div className="text-2xl font-bold" style={{ color }}>{val}</div>
          <div className="text-xs text-gray-400">Bar</div>
          <LocationTag device={device} lang={lang} />
          {isLow && <div className="text-xs text-red-400 font-bold animate-pulse mt-0.5">{lang === 'en' ? 'LOW PRESSURE' : lang === 'zh-CN' ? '低压' : '低壓'}</div>}
        </div>
      </div>
    </div>
  );
}

function FlowSwitchCard({ device, lang }: { device: Device; lang: string }) {
  const t = useT();
  const isActivated = device.status === 'Activated';
  return (
    <div className={`bg-gray-800/60 border rounded-lg p-3 flex items-center gap-3 transition-all ${isActivated ? 'border-blue-500/40 bg-blue-500/5' : 'border-gray-700/40'}`}>
      <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
        <rect x="0" y="7" width="28" height="6" rx="3" fill={isActivated ? '#3b82f620' : '#1f2937'} stroke={isActivated ? '#3b82f6' : '#374151'} strokeWidth="1.2"/>
        {isActivated && [4, 8, 12, 16, 20].map(x => (
          <path key={x} d={`M${x} 10 L${x + 2} 8 L${x + 3} 10 L${x + 2} 12 Z`} fill="#3b82f6" opacity="0.7"/>
        ))}
        <line x1="14" y1="0" x2="14" y2="7" stroke={isActivated ? '#3b82f6' : '#374151'} strokeWidth="1.5"/>
        <line x1="14" y1="13" x2="14" y2="20" stroke={isActivated ? '#3b82f6' : '#374151'} strokeWidth="1.5"/>
      </svg>
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium">{device.code}</div>
        <LocationTag device={device} lang={lang} />
      </div>
      <span className="text-xs font-bold flex-shrink-0" style={{ color: isActivated ? '#3b82f6' : '#22c55e' }}>
        {t(device.status)}
      </span>
      {isActivated && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse flex-shrink-0">{lang === 'en' ? 'FLOW' : lang === 'zh-CN' ? '水流' : '水流'}</span>
      )}
    </div>
  );
}

function ValveCard({ device, lang }: { device: Device; lang: string }) {
  const t = useT();
  const isClosed = device.status === 'Closed';
  const isFault = device.status === 'Fault';
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
      {isClosed && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse flex-shrink-0">{lang === 'en' ? 'SUPPLY CUT' : lang === 'zh-CN' ? '供水中断' : '供水中斷'}</span>
      )}
    </div>
  );
}

function PumpControlPanel({ device, lang }: { device: Device; lang: string }) {
  const t = useT();
  const isFault = device.status === 'Fault';
  return (
    <div className={`border rounded-lg p-3 flex items-center gap-3 transition-all ${isFault ? 'border-red-500/60 bg-red-500/10 animate-pulse' : 'border-green-500/30 bg-green-500/5'}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="4" width="20" height="16" rx="2" stroke={isFault ? '#ef4444' : '#22c55e'} strokeWidth="1.5"/>
        {[5, 9, 13, 17].map(x => (
          <circle key={x} cx={x} cy="12" r="1.5" fill={isFault ? '#ef4444' : '#22c55e'} opacity={isFault ? 1 : 0.7}/>
        ))}
        <rect x="2" y="4" width="20" height="4" rx="2" fill={isFault ? '#ef444420' : '#22c55e20'}/>
      </svg>
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium">{device.code}</div>
        <LocationTag device={device} lang={lang} />
      </div>
      <span className={`text-xs font-bold flex-shrink-0 ${isFault ? 'text-red-400' : 'text-green-400'}`}>{t(device.status)}</span>
      {isFault && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 flex-shrink-0">{lang === 'en' ? 'CRITICAL' : lang === 'zh-CN' ? '紧急' : '緊急'}</span>
      )}
    </div>
  );
}

export function PumpRoomPanel({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const { devices } = useDevices();

  const pumpDevices = devices.filter(
    d => d.device_types?.category === 'pump'
  );
  const { filteredDevices, filterBar, lang } = useDeviceFilters(pumpDevices);

  const valves  = filteredDevices.filter(d => d.code.startsWith('SCV-'));

  const fspAll = filteredDevices.filter(d => d.code.startsWith('FSP-'));
  const spAll  = filteredDevices.filter(d => d.code.startsWith('SP-') && !d.code.startsWith('SPR') && !d.code.startsWith('SP-PANEL'));
  const fjpAll = filteredDevices.filter(d => d.code.startsWith('FJP-'));
  const sjpAll = filteredDevices.filter(d => d.code.startsWith('SJP-'));
  const tanks  = filteredDevices.filter(d => d.device_types?.code === 'FS_TANK' || d.device_types?.code === 'SPR_TANK');
  const panels = filteredDevices.filter(d => d.device_types?.code === 'SP_PANEL');
  const pressures = filteredDevices.filter(d => d.device_types?.code === 'SPR_SYS');
  const flows  = filteredDevices.filter(d => d.device_types?.code === 'FS_FLOW');

  const hasAny = filteredDevices.length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        <Droplets size={14} className="text-blue-400" />
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{t('pump_category')}</span>
        <span className="text-xs text-gray-500 ml-1">({filteredDevices.length})</span>
      </div>

      {!compact && filterBar}

      <div className="flex-1 overflow-y-auto min-h-0 space-y-3">
        {!hasAny && (
          <div className="text-gray-500 text-sm text-center py-8">{t('no_devices')}</div>
        )}

        {/* Pump Control Panels — highest priority */}
        {panels.length > 0 && (
          <section>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="w-1 h-3 bg-green-400 rounded-full" />{t('pump_control_panel')}
            </div>
            <div className="space-y-2">
              {panels.map(d => <PumpControlPanel key={d.id} device={d} lang={lang} />)}
            </div>
          </section>
        )}

        {/* Fire Service Pumps */}
        {fspAll.length > 0 && (
          <section>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="w-1 h-3 bg-red-400 rounded-full" />{t('fs_pump')}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {fspAll.map(d => <PumpCard key={d.id} device={d} label={d.code} lang={lang} />)}
            </div>
          </section>
        )}

        {/* Sprinkler Pumps */}
        {spAll.length > 0 && (
          <section>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="w-1 h-3 bg-blue-400 rounded-full" />{t('spr_pump')}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {spAll.map(d => <PumpCard key={d.id} device={d} label={d.code} lang={lang} />)}
            </div>
          </section>
        )}

        {/* Jockey Pumps */}
        {(fjpAll.length > 0 || sjpAll.length > 0) && (
          <section>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="w-1 h-3 bg-yellow-400 rounded-full" />{t('jockey_pump')}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {fjpAll.map(d => <PumpCard key={d.id} device={d} label={d.code} lang={lang} />)}
              {sjpAll.map(d => <PumpCard key={d.id} device={d} label={d.code} lang={lang} />)}
            </div>
          </section>
        )}

        {/* Water Tanks */}
        {tanks.length > 0 && (
          <section>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="w-1 h-3 bg-cyan-400 rounded-full" />{lang === 'en' ? 'Water Tanks' : lang === 'zh-CN' ? '水箱' : '水箱'}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {tanks.map(d => <TankGauge key={d.id} device={d} label={d.label} lang={lang} />)}
            </div>
          </section>
        )}

        {/* Pressure + Flow Switch */}
        {!compact && (pressures.length > 0 || flows.length > 0 || valves.length > 0) && (
          <section>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="w-1 h-3 bg-green-400 rounded-full" />{lang === 'en' ? 'System Status' : lang === 'zh-CN' ? '系统状态' : '系統狀態'}
            </div>
            {pressures.map(d => <PressureGauge key={d.id} device={d} lang={lang} />)}
            <div className="mt-2 space-y-1.5">
              {flows.map(d => <FlowSwitchCard key={d.id} device={d} lang={lang} />)}
              {valves.map(d => <ValveCard key={d.id} device={d} lang={lang} />)}
            </div>
          </section>
        )}

        {/* Compact mode: just flow switch */}
        {compact && flows.length > 0 && (
          flows.map(d => <FlowSwitchCard key={d.id} device={d} lang={lang} />)
        )}
      </div>
    </div>
  );
}
