import { Wind } from 'lucide-react';
import { useDevices } from '../hooks/useDevices';
import { useDeviceFilters, deviceLocation } from '../hooks/useDeviceFilters';
import { Device, DeviceStatus } from '../types';
import { statusColor } from '../lib/colors';
import { useT } from '../lib/i18n';

function SpinningFan({ running, fault, size = 20 }: { running: boolean; fault: boolean; size?: number }) {
  const color = fault ? '#ef4444' : running ? '#22c55e' : '#6b7280';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={running ? 'animate-spin' : ''} style={{ animationDuration: '2s' }}>
      <circle cx="12" cy="12" r="2" fill={color} />
      {[0, 90, 180, 270].map(angle => (
        <path key={angle} d="M12 10 C10 6, 6 4, 8 2 C10 0, 14 4, 12 10 Z" fill={color} opacity="0.85" transform={`rotate(${angle} 12 12)`} />
      ))}
    </svg>
  );
}

function DamperIcon({ status }: { status: DeviceStatus }) {
  const isOpen = status === 'Open';
  const isFault = status === 'Fault';
  const color = isFault ? '#ef4444' : isOpen ? '#22c55e' : '#f59e0b';
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke={color} strokeWidth="1.5"/>
      {isOpen ? (
        <>
          <line x1="7" y1="12" x2="17" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round"/>
          <line x1="4" y1="8" x2="4" y2="16" stroke={color} strokeWidth="1.5"/>
          <line x1="20" y1="8" x2="20" y2="16" stroke={color} strokeWidth="1.5"/>
        </>
      ) : (
        <>
          <line x1="4" y1="8" x2="20" y2="8" stroke={color} strokeWidth="2" strokeLinecap="round"/>
          <line x1="4" y1="12" x2="20" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round"/>
          <line x1="4" y1="16" x2="20" y2="16" stroke={color} strokeWidth="2" strokeLinecap="round"/>
        </>
      )}
    </svg>
  );
}

function VacIcon({ status }: { status: DeviceStatus }) {
  const isActivated = status === 'Activated';
  const color = isActivated ? '#22c55e' : '#6b7280';
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke={color} strokeWidth="1.5"/>
      <path d={isActivated ? 'M8 12 L11 15 L16 9' : 'M8 12 H16'} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      {isActivated && <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth="0.5" opacity="0.4"/>}
    </svg>
  );
}

function DirectLinkIcon({ status }: { status: DeviceStatus }) {
  const isNormal = status === 'Normal';
  const isFault = status === 'Fault';
  const color = isFault ? '#ef4444' : isNormal ? '#22c55e' : '#3b82f6';
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 11.9" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M16.72 2.03A10 10 0 0 1 21 9.4" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 6a6 6 0 0 1 5.17 9" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      {isFault && <line x1="1" y1="1" x2="23" y2="23" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>}
    </svg>
  );
}

function DeviceRow({ device, icon, label, statusLabel, lang }: {
  device: Device;
  icon: React.ReactNode;
  label: string;
  statusLabel: string;
  lang: string;
}) {
  const color = statusColor(device.status);
  const isCritical = device.status === 'Fault' || device.status === 'Panel Fault';
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${isCritical ? 'border-red-500/30 bg-red-500/5' : 'border-gray-700/30 bg-gray-800/40'}`}>
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium truncate">{device.code}</div>
        <div className="text-gray-500 text-xs truncate">{label}</div>
        <div className="text-xs text-cyan-300 font-medium truncate">{deviceLocation(device, lang)}</div>
        {(device.brand || device.serial_number) && (
          <div className="text-[10px] text-gray-400 truncate">{[device.brand, device.serial_number].filter(Boolean).join(' · ')}</div>
        )}
      </div>
      <div className="flex-shrink-0 text-right">
        <div className="text-xs font-semibold" style={{ color }}>{statusLabel}</div>
      </div>
    </div>
  );
}

export function VentilationPanel({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const { devices } = useDevices();

  const allVentDevices = devices.filter(d => {
    const cat = d.device_types?.category;
    const code = d.device_types?.code;
    return cat === 'ventilation' || code === 'DIRECT_LINK';
  });

  const { filteredDevices, filterBar, lang } = useDeviceFilters(allVentDevices);

  const dampers = filteredDevices.filter(d => d.device_types?.code === 'FD');
  const smokeF  = filteredDevices.filter(d => d.device_types?.code === 'SEF');
  const stairF  = filteredDevices.filter(d => d.device_types?.code === 'SPF');
  const vacs    = filteredDevices.filter(d => d.device_types?.code === 'VAC');
  const links   = filteredDevices.filter(d => d.device_types?.code === 'DIRECT_LINK');

  const hasFault = [...dampers, ...smokeF, ...stairF, ...vacs, ...links].some(d => d.status === 'Fault');
  const hasAny = filteredDevices.length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Wind size={14} className="text-cyan-400" />
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{t('ventilation')}</span>
          <span className="text-xs text-gray-500 ml-1">({filteredDevices.length})</span>
        </div>
        {hasFault && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
            {lang === 'en' ? 'Fault Detected' : lang === 'zh-CN' ? '检测到故障' : '檢測到故障'}
          </span>
        )}
      </div>

      {!compact && filterBar}

      <div className="flex-1 overflow-y-auto min-h-0 space-y-3">
        {!hasAny && (
          <div className="text-gray-500 text-sm text-center py-8">{t('no_devices')}</div>
        )}

        {/* Fire Dampers */}
        {dampers.length > 0 && (
          <section>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-2">
              <span className="w-1 h-3 bg-orange-400 rounded-full" />
              {t('fire_damper')}
              <span className="text-gray-600 font-normal normal-case">— {lang === 'en' ? 'Open (normal) / Closed (fire)' : lang === 'zh-CN' ? '平时开启 / 火警关闭' : '平時開啟 / 火警關閉'}</span>
            </div>
            <div className="space-y-1">
              {dampers.map(d => (
                <DeviceRow key={d.id} device={d} icon={<DamperIcon status={d.status} />} label={t('fire_damper')} statusLabel={t(d.status)} lang={lang} />
              ))}
            </div>
          </section>
        )}

        {/* Smoke Extraction Fans */}
        {smokeF.length > 0 && (
          <section>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-2">
              <span className="w-1 h-3 bg-blue-400 rounded-full" />
              {t('smoke_fan')}
            </div>
            <div className="space-y-1">
              {smokeF.map(d => (
                <DeviceRow key={d.id} device={d} icon={<SpinningFan running={d.status === 'Running'} fault={d.status === 'Fault'} />} label={t('smoke_fan')} statusLabel={t(d.status)} lang={lang} />
              ))}
            </div>
          </section>
        )}

        {/* Staircase Pressurization Fans */}
        {stairF.length > 0 && (
          <section>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-2">
              <span className="w-1 h-3 bg-green-400 rounded-full" />
              {t('stair_fan')}
            </div>
            <div className="space-y-1">
              {stairF.map(d => (
                <DeviceRow key={d.id} device={d} icon={<SpinningFan running={d.status === 'Running'} fault={d.status === 'Fault'} size={18} />} label={t('stair_fan')} statusLabel={t(d.status)} lang={lang} />
              ))}
            </div>
          </section>
        )}

        {/* VAC Cut Off */}
        {vacs.length > 0 && (
          <section>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-2">
              <span className="w-1 h-3 bg-yellow-400 rounded-full" />
              {t('vac_cutoff')}
              {!compact && <span className="text-gray-600 font-normal normal-case">— {lang === 'en' ? 'Should activate on fire' : lang === 'zh-CN' ? '火警时应激活' : '火警時應激活'}</span>}
            </div>
            <div className="space-y-1">
              {vacs.map(d => {
                const isActivated = d.status === 'Activated';
                return (
                  <div key={d.id} className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${isActivated ? 'border-green-500/30 bg-green-500/5' : 'border-gray-700/30 bg-gray-800/40'}`}>
                    <VacIcon status={d.status} />
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium">{d.code}</div>
                      <div className="text-xs text-cyan-300 font-medium truncate">{deviceLocation(d, lang)}</div>
                      {(d.brand || d.serial_number) && (
                        <div className="text-[10px] text-gray-400 truncate">{[d.brand, d.serial_number].filter(Boolean).join(' · ')}</div>
                      )}
                    </div>
                    <div className="text-xs font-semibold flex-shrink-0" style={{ color: statusColor(d.status) }}>{t(d.status)}</div>
                    {isActivated && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30 flex-shrink-0">{t('linkage_status')} {lang === 'en' ? 'OK' : '正常'}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Direct Link Phone */}
        {links.length > 0 && (
          <section>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-2">
              <span className="w-1 h-3 bg-red-400 rounded-full" />
              {t('direct_link')}
            </div>
            <div className="space-y-1">
              {links.map(d => {
                const isFault = d.status === 'Fault';
                return (
                  <div key={d.id} className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${isFault ? 'border-red-500/40 bg-red-500/10 animate-pulse' : 'border-gray-700/30 bg-gray-800/40'}`}>
                    <DirectLinkIcon status={d.status} />
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium">{d.code}</div>
                      <div className="text-xs text-cyan-300 font-medium truncate">{deviceLocation(d, lang)}</div>
                      {(d.brand || d.serial_number) && (
                        <div className="text-[10px] text-gray-400 truncate">{[d.brand, d.serial_number].filter(Boolean).join(' · ')}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor(d.status) }} />
                      <span className="text-xs font-semibold" style={{ color: statusColor(d.status) }}>{t(d.status)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
