import { useState, useEffect } from 'react';
import { Shield, Wifi, WifiOff, ChevronDown, MapPin, ArrowLeft } from 'lucide-react';
import { useTransport } from '../transport/TransportContext';
import { useDevices } from '../hooks/useDevices';
import { useAlarms } from '../hooks/useAlarms';
import { useFloors } from '../hooks/useFloors';
import { useSiteSelector } from '../hooks/useSiteSelector';
import { AlarmPanel } from '../panels/AlarmPanel';
import { PumpRoomPanel } from '../panels/PumpRoomPanel';
import { TrendsPanel } from '../panels/TrendsPanel';
import { MaintenancePanel } from '../panels/MaintenancePanel';
import { ConnectionIndicator } from '../components/ConnectionIndicator';
import { StatusDot } from '../components/StatusDot';
import { useT, useLang } from '../lib/i18n';
import { translateAlarmType } from '../lib/alarmI18n';
import { Device } from '../types';

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(id); }, []);
  return (
    <div className="text-right leading-none">
      <div className="text-white font-mono text-lg">{time.toLocaleTimeString('en-HK', { hour12: false })}</div>
      <div className="text-gray-400 text-xs mt-0.5">{time.toLocaleDateString('zh-TW')}</div>
    </div>
  );
}

function KPIBlock({ value, label, color, badge }: { value: number | string; label: string; color: string; badge?: string }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center bg-gray-800/60 border border-gray-700/40 rounded-xl px-5 py-3 min-w-28 text-center relative">
      {badge && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap"
          style={{ backgroundColor: color + '30', color, border: `1px solid ${color}50` }}>
          {t(badge)}
        </span>
      )}
      <div className="text-3xl font-bold leading-none mt-1" style={{ color }}>{value}</div>
      <div className="text-gray-400 text-xs mt-1">{label}</div>
    </div>
  );
}

function HealthScore({ devices }: { devices: Device[] }) {
  const t = useT();
  const total = devices.length || 1;
  const healthy = devices.filter(d => d.status === 'Normal' || d.status === 'Power On' || d.status === 'Running' || d.status === 'Auto Mode' || d.status === 'Closed' || d.status === 'Open').length;
  const score = Math.round((healthy / total) * 100 * 10) / 10;
  const color = score >= 95 ? '#22c55e' : score >= 80 ? '#eab308' : '#ef4444';
  const circumference = 2 * Math.PI * 22;
  const dash = (score / 100) * circumference;
  return (
    <div className="flex flex-col items-center justify-center bg-gray-800/60 border border-gray-700/40 rounded-xl px-5 py-3 min-w-36 text-center relative">
      <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap bg-green-500/20 text-green-400 border border-green-500/40">
        {t('kpi_label')}
      </span>
      <div className="relative w-14 h-14 mt-1">
        <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
          <circle cx="28" cy="28" r="22" fill="none" stroke="#1f2937" strokeWidth="5"/>
          <circle cx="28" cy="28" r="22" fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round"/>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{ color }}>{score}%</span>
        </div>
      </div>
      <div className="text-gray-400 text-xs mt-1">{t('health_score')}</div>
    </div>
  );
}

function FloorStatusRow({ floorId, label }: {
  floorId: string;
  label: string;
}) {
  const t = useT();
  const { devices } = useDevices(floorId);
  const alarmCount = devices.filter(d => d.status === 'Alarm' || d.status === 'Activated').length;
  const faultCount = devices.filter(d => d.status === 'Fault').length;
  const offlineCount = devices.filter(d => d.status === 'Offline').length;
  const allNormal = alarmCount === 0 && faultCount === 0 && offlineCount === 0;

  return (
    <div className={`flex items-center gap-3 py-1.5 px-2 rounded-lg transition-colors ${alarmCount > 0 ? 'bg-red-500/10' : faultCount > 0 ? 'bg-yellow-500/5' : ''}`}>
      <span className="text-gray-500 text-xs w-8 flex-shrink-0 font-mono">{label}</span>
      <div className="flex gap-1 flex-1 flex-wrap">
        {devices.slice(0, 8).map(d => <StatusDot key={d.id} status={d.status} size={7} />)}
        {devices.length > 8 && <span className="text-gray-600" style={{ fontSize: 9 }}>+{devices.length - 8}</span>}
      </div>
      <div className="flex-shrink-0 text-right">
        {allNormal
          ? <span className="text-green-500 text-xs">{t('all_normal')}</span>
          : alarmCount > 0
            ? <span className="text-red-400 text-xs font-semibold animate-pulse">⚠ {alarmCount} {t('Alarm')}</span>
            : faultCount > 0
              ? <span className="text-yellow-400 text-xs">⚠ {faultCount} {t('Fault')}</span>
              : <span className="text-gray-500 text-xs">{offlineCount} {t('Offline')}</span>
        }
      </div>
    </div>
  );
}

export function WallScreen({ onExit }: { onExit?: () => void }) {
  const t = useT();
  const { lang } = useLang();
  const { connectionState } = useTransport();
  const { devices: allDevices } = useDevices();
  const { alarms } = useAlarms();
  const { sites, selectedSite, selectedBuilding, selectedBuildingId, selectSite, selectBuilding } = useSiteSelector();
  const { floors } = useFloors(selectedBuildingId);
  const [sitePickerOpen, setSitePickerOpen] = useState(false);


  const activeAlarms = alarms.filter(a => a.status === 'active').length;
  const faults = allDevices.filter(d => d.status === 'Fault').length;
  const online = allDevices.filter(d => d.status !== 'Offline').length;
  const hasAlarms = activeAlarms > 0;

  const orderedFloors = [...floors].sort((a, b) => b.floor_number - a.floor_number);

  const buildingLabel = selectedBuilding
    ? `${selectedBuilding.name}${selectedBuilding.name_zh ? ' · ' + selectedBuilding.name_zh : ''}`
    : '—';

  return (
    <div className="h-screen w-screen bg-gray-950 text-white overflow-hidden flex flex-col select-none" onClick={() => setSitePickerOpen(false)}>

      {/* Top Navigation Bar */}
      <header className={`flex-shrink-0 flex items-center justify-between pl-5 pr-44 py-3 border-b transition-colors duration-500 ${hasAlarms ? 'border-red-500/40 bg-red-950/30' : 'border-gray-800/50 bg-gray-900/80'}`}>
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-red-500/20 border border-red-500/30">
            <Shield size={18} className="text-red-400" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-none">{t('platform_name')}</div>
            <div className="text-gray-400 text-xs mt-0.5">NB-IoT / 4G</div>
          </div>

          {/* Site/Building Picker */}
          {sites.length > 0 && (
            <div className="relative" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setSitePickerOpen(!sitePickerOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800/50 border border-gray-700/40 hover:bg-gray-700/50 transition-colors"
              >
                <MapPin size={11} className="text-green-400" />
                <span className="text-gray-200 text-xs font-medium">
                  {selectedSite?.name ?? (lang === 'en' ? 'Select Property' : lang === 'zh-CN' ? '选择楼盘' : '選擇樓盤')}
                  {selectedBuilding ? ` · ${selectedBuilding.name}` : ''}
                </span>
                <ChevronDown size={10} className={`text-gray-500 transition-transform ${sitePickerOpen ? 'rotate-180' : ''}`} />
              </button>
              {sitePickerOpen && (
                <div className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-700/60 rounded-xl shadow-2xl z-50 min-w-56 overflow-hidden">
                  <div className="p-1 max-h-64 overflow-y-auto">
                    {sites.map(site => (
                      <div key={site.id}>
                        <div className="px-3 py-1.5 text-xs text-gray-500 uppercase tracking-wider font-semibold">{site.name}</div>
                        {site.buildings.map(b => (
                          <button
                            key={b.id}
                            onClick={() => { selectSite(site.id); selectBuilding(b.id); setSitePickerOpen(false); }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center gap-2 ${selectedBuildingId === b.id ? 'bg-blue-500/20 text-blue-300' : 'text-gray-300 hover:bg-gray-700/50'}`}
                          >
                            <span className="truncate">{b.name}{b.name_zh ? ` · ${b.name_zh}` : ''}</span>
                          </button>
                        ))}
                        {site.buildings.length === 0 && (
                          <div className="px-3 py-1 text-xs text-gray-600">{t('site_no_buildings')}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {hasAlarms && (
            <div className="flex items-center gap-1.5 bg-red-500/20 border border-red-500/40 rounded-full px-3 py-1 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-red-300 text-xs font-bold tracking-wide">{lang === 'en' ? 'FIRE ALARM ACTIVE' : lang === 'zh-CN' ? '火警警报激活' : '火警警報啟動'}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* KPI Row */}
          <div className="flex gap-2">
            <KPIBlock value={activeAlarms} label={t('alarms')} color="#ef4444" badge="high_priority" />
            <KPIBlock value={faults}       label={t('faults')} color="#f59e0b" badge="medium_priority" />
            <HealthScore devices={allDevices} />
            <KPIBlock value={online}       label={t('device_online_pct')} color="#22c55e" badge="kpi_label" />
          </div>

          <div className="h-8 w-px bg-gray-700/60" />

          <ConnectionIndicator state={connectionState} />
          {onExit && (
            <button
              onClick={onExit}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800/50 text-gray-300 border border-gray-700/50 hover:bg-gray-700/50 hover:text-white transition-colors"
            >
              <ArrowLeft size={12} />
              <span>{t('back_to_dashboard')}</span>
            </button>
          )}

          <Clock />
        </div>
      </header>

      {/* Main 3-column layout */}
      <div className="flex-1 grid grid-cols-12 gap-2 p-2 min-h-0">

        {/* LEFT — Building Floor Status List (3 cols) */}
        <div className="col-span-3 flex flex-col gap-2">
          <div className="bg-gray-900/60 border border-gray-800/40 rounded-xl p-3 flex-1 flex flex-col min-h-0">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex-shrink-0">
              {t('building_status')} — {buildingLabel}
            </div>
            <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
              {orderedFloors.map(f => (
                <FloorStatusRow
                  key={f.id}
                  floorId={f.id}
                  label={f.floor_label}
                />
              ))}
            </div>
          </div>

          {/* Latest 3 Alarms */}
          <div className="bg-gray-900/60 border border-gray-800/40 rounded-xl p-3 flex-shrink-0">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{t('latest_alarms')}</div>
            <div className="space-y-1.5">
              {alarms.slice(0, 4).map(a => {
                const device = a.devices;
                const floor = device?.floors;
                return (
                  <div key={a.id} className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${a.status === 'active' ? 'border-red-500/30 bg-red-500/5' : 'border-gray-700/30'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${(a.severity === 'critical' || a.severity === 'alarm') ? 'bg-red-500 animate-pulse' : a.severity === 'high' ? 'bg-orange-500' : 'bg-yellow-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate">
                        {floor?.floor_label} {device?.code} — {translateAlarmType(a.alarm_type, a.devices, lang, t)}
                      </div>
                      <div className="text-gray-500 mt-0.5">
                        {new Date(a.triggered_at).toLocaleTimeString('en-HK', { hour12: false })}
                      </div>
                    </div>
                  </div>
                );
              })}
              {alarms.length === 0 && (
                <div className="text-gray-600 text-xs text-center py-2">{t('no_alarms')}</div>
              )}
            </div>
          </div>
        </div>

        {/* CENTER — Alarm List (4 cols) */}
        <div className="col-span-4 flex flex-col gap-2 min-h-0">
          <div className="bg-gray-900/60 border border-gray-800/40 rounded-xl p-3 flex-1 overflow-hidden flex flex-col min-h-0">
            <AlarmPanel maxItems={12} compact />
          </div>
          <div className="bg-gray-900/60 border border-gray-800/40 rounded-xl p-3 flex-shrink-0" style={{ height: '38%' }}>
            <TrendsPanel compact />
          </div>
        </div>

        {/* RIGHT — Pump Room + Maintenance (5 cols) */}
        <div className="col-span-5 flex flex-col gap-2 min-h-0">
          <div className="bg-gray-900/60 border border-gray-800/40 rounded-xl p-3 flex-1 overflow-hidden flex flex-col min-h-0">
            <PumpRoomPanel compact />
          </div>
          <div className="bg-gray-900/60 border border-gray-800/40 rounded-xl p-3 flex-shrink-0" style={{ height: '30%' }}>
            <MaintenancePanel compact />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="flex-shrink-0 h-6 bg-gray-900/80 border-t border-gray-800/40 flex items-center justify-between px-5">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span>雋凱科技有限公司 Century Harvest Technologies Limited</span>
          <span>·</span>
          <span>AIoT Platform v2.0</span>
          <span>·</span>
          <span>{lang === 'en' ? 'Cap.572 Compliant' : lang === 'zh-CN' ? '符合第572章' : '符合第572章'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          {connectionState === 'connected'
            ? <Wifi size={10} className="text-green-400" />
            : <WifiOff size={10} className="text-red-400" />}
          <span>API WebSocket · NB-IoT / 4G / 5G</span>
        </div>
      </footer>
    </div>
  );
}
