import { Zap } from 'lucide-react';
import { useDevices } from '../hooks/useDevices';
import { useDeviceFilters, deviceLocation } from '../hooks/useDeviceFilters';
import { Device, DeviceStatus } from '../types';
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

function GensetCard({ device, lang }: { device: Device; lang: string }) {
  const t = useT();
  const isManual = device.status === 'Manual Mode';
  const isRunning = device.status === 'Running';
  const isFault = device.status === 'Fault';
  const isMCCB = device.status === 'MCCB Off';
  const color = isFault || isMCCB ? '#ef4444' : isManual ? '#eab308' : isRunning ? '#22c55e' : '#3b82f6';

  return (
    <div className={`bg-gray-800/60 border rounded-xl p-4 transition-all ${isFault ? 'border-red-500/40' : isManual ? 'border-yellow-500/30' : 'border-gray-700/30'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}20`, border: `1px solid ${color}40` }}>
            <Zap size={14} style={{ color }} />
          </div>
          <span className="text-white text-sm font-semibold">{device.code}</span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full border font-semibold" style={{ color, borderColor: `${color}50`, backgroundColor: `${color}15` }}>
          {t(device.status)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        {(['Auto Mode', 'Manual Mode', 'Running'] as DeviceStatus[]).map(state => {
          const active = device.status === state;
          const lampColor = state === 'Running' ? '#22c55e' : state === 'Manual Mode' ? '#eab308' : '#3b82f6';
          return (
            <div key={state} className="flex flex-col items-center gap-1">
              <div
                className={`w-3 h-3 rounded-full transition-all ${active ? '' : 'opacity-20'}`}
                style={{ backgroundColor: active ? lampColor : '#374151', boxShadow: active ? `0 0 8px ${lampColor}` : 'none' }}
              />
              <span className="text-xs text-gray-500 text-center leading-tight" style={{ fontSize: '9px' }}>
                {state === 'Auto Mode' ? 'AUTO' : state === 'Manual Mode' ? 'MANUAL' : 'RUN'}
              </span>
            </div>
          );
        })}
      </div>

      <LocationTag device={device} lang={lang} />

      {isManual && (
        <div className="mt-2 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded px-2 py-1 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          {lang === 'en' ? 'Manual — not ready for standby' : lang === 'zh-CN' ? '手动 — 未准备好待命' : '手動 — 未準備好待命'}
        </div>
      )}
      {isMCCB && (
        <div className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          {t('genset_mccb')} {lang === 'en' ? 'Off' : lang === 'zh-CN' ? '关闭' : '關閉'} — {t('Fault')}
        </div>
      )}
    </div>
  );
}

function FuelTankCard({ device, lang }: { device: Device; lang: string }) {
  const t = useT();
  const isFire = device.status === 'Panel Fire';
  const isFault = device.status === 'Panel Fault';
  const color = isFire ? '#ef4444' : isFault ? '#f59e0b' : '#22c55e';
  return (
    <div className={`bg-gray-800/60 border rounded-xl p-4 transition-all ${isFire ? 'border-red-500/60 animate-pulse' : isFault ? 'border-yellow-500/40' : 'border-gray-700/30'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="8" width="14" height="12" rx="2" stroke={color} strokeWidth="1.5"/>
            <path d="M7 8V5a2 2 0 0 1 4 0v3" stroke={color} strokeWidth="1.5"/>
            <path d="M17 10h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" stroke={color} strokeWidth="1.5"/>
            <line x1="6" y1="14" x2="12" y2="14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span className="text-white text-sm font-medium">{device.code}</span>
        </div>
        <span className="text-xs font-semibold" style={{ color }}>{t(device.status)}</span>
      </div>
      <LocationTag device={device} lang={lang} />
      {isFire && (
        <div className="mt-2 text-xs text-red-300 bg-red-500/20 border border-red-500/30 rounded px-2 py-1 font-semibold">
          {lang === 'en' ? 'PANEL FIRE — Highest Priority Alarm' : lang === 'zh-CN' ? '面板火警 — 最高优先级警报' : '面板火警 — 最高優先級警報'}
        </div>
      )}
    </div>
  );
}

function LiftCard({ device, lang }: { device: Device; lang: string }) {
  const t = useT();
  const isHomed = device.status === 'Homed';
  const color = isHomed ? '#3b82f6' : '#22c55e';
  return (
    <div className="bg-gray-800/60 border border-gray-700/30 rounded-xl p-3 flex items-center gap-3">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="2" width="18" height="20" rx="2" stroke={color} strokeWidth="1.5"/>
        <rect x="7" y="6" width="4" height="6" rx="1" stroke={color} strokeWidth="1" fill={isHomed ? `${color}30` : 'none'}/>
        <rect x="13" y="6" width="4" height="6" rx="1" stroke={color} strokeWidth="1" fill={isHomed ? `${color}30` : 'none'}/>
        <line x1="9" y1="16" x2="15" y2="16" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        {isHomed && <path d="M10 19 L12 21 L14 19" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round"/>}
      </svg>
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium">{device.code}</div>
        <LocationTag device={device} lang={lang} />
      </div>
      <span className="text-xs font-semibold flex-shrink-0" style={{ color }}>{t(device.status)}</span>
    </div>
  );
}

function FireDoorCard({ device, lang }: { device: Device; lang: string }) {
  const t = useT();
  const isOpen = device.status === 'Open';
  const isFault = device.status === 'Fault';
  const color = isFault ? '#ef4444' : isOpen ? '#f59e0b' : '#22c55e';
  return (
    <div className={`bg-gray-800/60 border rounded-lg p-3 flex items-center gap-3 transition-all ${isOpen ? 'border-yellow-500/30 bg-yellow-500/5' : isFault ? 'border-red-500/30' : 'border-gray-700/30'}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="2" width="14" height="20" rx="1" stroke={color} strokeWidth="1.5" transform={isOpen ? 'skewY(-10) translate(2 0)' : ''}/>
        <circle cx="14" cy="12" r="1.5" fill={color}/>
        <line x1="17" y1="2" x2="17" y2="22" stroke="#4b5563" strokeWidth="1.5"/>
      </svg>
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium">{device.code}</div>
        <LocationTag device={device} lang={lang} />
      </div>
      <span className="text-xs font-semibold flex-shrink-0" style={{ color }}>{t(device.status)}</span>
      {isOpen && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex-shrink-0">{lang === 'en' ? 'Abnormal' : lang === 'zh-CN' ? '异常' : '異常'}</span>
      )}
    </div>
  );
}

export function PowerLinkagePanel({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const { devices } = useDevices();

  const powerDevices = devices.filter(d => {
    const cat = d.device_types?.category;
    const code = d.device_types?.code;
    return cat === 'power_interlocking' && (code === 'GENSET' || code === 'FUEL_TANK' || code === 'F_LIFT' || code === 'FIRE_DOOR');
  });
  const { filteredDevices, filterBar, lang } = useDeviceFilters(powerDevices);

  const gensets   = filteredDevices.filter(d => d.device_types?.code === 'GENSET');
  const fuelTanks = filteredDevices.filter(d => d.device_types?.code === 'FUEL_TANK');
  const lifts     = filteredDevices.filter(d => d.device_types?.code === 'F_LIFT');
  const fireDoors = filteredDevices.filter(d => d.device_types?.code === 'FIRE_DOOR');

  const hasAny = filteredDevices.length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        <Zap size={14} className="text-yellow-400" />
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{t('power_linkage')}</span>
        <span className="text-xs text-gray-500 ml-1">({filteredDevices.length})</span>
      </div>

      {!compact && filterBar}

      <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
        {!hasAny && (
          <div className="text-gray-500 text-sm text-center py-8">{t('no_devices')}</div>
        )}

        {/* Emergency Generators */}
        {gensets.length > 0 && (
          <section>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="w-1 h-3 bg-yellow-400 rounded-full" />{t('genset')}
            </div>
            <div className="space-y-2">
              {gensets.map(d => <GensetCard key={d.id} device={d} lang={lang} />)}
            </div>
          </section>
        )}

        {/* Fuel Tanks */}
        {fuelTanks.length > 0 && (
          <section>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="w-1 h-3 bg-red-400 rounded-full" />{t('fuel_tank')}
            </div>
            <div className="space-y-2">
              {fuelTanks.map(d => <FuelTankCard key={d.id} device={d} lang={lang} />)}
            </div>
          </section>
        )}

        {/* Lifts */}
        {lifts.length > 0 && (
          <section>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="w-1 h-3 bg-blue-400 rounded-full" />{t('lift_homing')}
            </div>
            <div className="space-y-1.5">
              {lifts.map(d => <LiftCard key={d.id} device={d} lang={lang} />)}
            </div>
          </section>
        )}

        {/* Fire Doors */}
        {fireDoors.length > 0 && (
          <section>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="w-1 h-3 bg-green-400 rounded-full" />{t('fire_door')}
            </div>
            <div className="space-y-1.5">
              {fireDoors.map(d => <FireDoorCard key={d.id} device={d} lang={lang} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
