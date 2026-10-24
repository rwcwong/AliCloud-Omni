import { useDistribution } from '../hooks/useDashboardData';
import type { DeviceStatusDistribution } from '../api/types';
import { api } from '../lib/api';
import { useApiQuery } from '../hooks/useApiQuery';
import type { AlarmStatisticsResponse } from '../api/types';
import { useProjects } from '../hooks/useProjects';
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Activity, Bell, Building2, MapPin, Shield,
  Cpu, Sparkles, Globe,
  LayoutDashboard, BarChart3,
  Settings, Phone, Mail,
  Headphones,
} from 'lucide-react';
import L from 'leaflet';
import ReactECharts from 'echarts-for-react';
import { useAuth, isGlobalAdmin } from '../lib/auth';
import { useDevices } from '../hooks/useDevices';
import { useAlarms } from '../hooks/useAlarms';
import { useSiteSelector, SiteWithBuildings } from '../hooks/useSiteSelector';
import { AlarmEvent, Device, Theme } from '../types';
import { useLang, useT, Language } from '../lib/i18n';
import { hasMapCoordinates } from '../lib/mapCoordinates';
import { useLeafletMap } from '../hooks/useLeafletMap';
import { MapTileNotice } from '../components/MapStatus';
import { normalizedStatus, getNormalDeviceIds, getDevicesWithOpenAlarms, CRITICAL_DEVICE_STATUSES, FAULT_DEVICE_STATUSES } from '../lib/deviceStatus';
import { formatDateTime } from '../lib/timeAgo';
import { FireAlarmIcon } from '../components/FireAlarmIcon';
import { Clock } from '../components/Clock';
import { UserMenu } from '../components/UserMenu';
import { ChangePasswordModal } from '../components/ChangePasswordModal';


type SiteStatus = 'normal' | 'warning' | 'critical' | 'fire' | 'offline';

interface SiteInfo {
  site: SiteWithBuildings;
  deviceCount: number;
  onlineCount: number;
  alarmCount: number;
  faultCount: number;
  offlineCount: number;
  fireAlarmCount: number;
  unacknowledgedAlertCount: number;
  acknowledgedOrDispatchedCount: number;
  status: SiteStatus;
}

function localName(name: string, nameZh: string, lang: string): string {
  return lang === 'en' ? name : (nameZh || name);
}

function statusColor(status: SiteStatus): string {
  if (status === 'fire') return '#ff4668';
  if (status === 'critical') return '#ff6a00';
  if (status === 'warning') return '#f6c945';
  if (status === 'offline') return '#8492a6';
  return '#39e6c4';
}

// ── Panel primitives matching OmniOSHome's style ──────────────────────────

function IpadPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`relative overflow-hidden rounded-xl border border-cyan-300/15 bg-[#061c3d]/60 backdrop-blur-sm ${className}`}
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(57,230,196,0.06)' }}
    >
      {children}
    </section>
  );
}

function IpadHeading({ icon: Icon, children, action, badge }: { icon: React.ElementType; children: React.ReactNode; action?: React.ReactNode; badge?: number }) {
  return (
    <div className="flex items-center justify-between border-b border-cyan-300/10 px-3 py-2.5">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
        <Icon size={15} className="text-cyan-300" />
        {badge !== undefined && badge > 0 && (
          <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{badge}</span>
        )}
        {children}
      </div>
      {action}
    </div>
  );
}

// ── Language selector for the iPad banner ─────────────────────────────────

function IpadLanguageMenu({ lang, setLang, t }: { lang: string; setLang: (l: Language) => void; t: (k: string) => string }) {
  const isEn = lang === 'en';
  return (
    <button
      type="button"
      onClick={() => setLang(isEn ? 'zh-TW' : 'en')}
      title={t('language')}
      className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 text-[10px] font-bold text-cyan-200 transition-all hover:bg-cyan-400/25 hover:text-cyan-100 active:scale-95"
    >
      {isEn ? 'EN' : '中'}
    </button>
  );
}

// ── Left nav rail ─────────────────────────────────────────────────────────

function NavRail({ activeNav, onNavClick, t, onAdminConsole, canManage }: { activeNav: string; onNavClick: (nav: string) => void; t: (k: string) => string; onAdminConsole: () => void; canManage: boolean }) {
  const items = [
    { key: 'dashboard', icon: LayoutDashboard, label: t('ipad_nav_dashboard') },
    { key: 'site', icon: MapPin, label: t('ipad_sites') },
    { key: 'building', icon: Building2, label: t('building') },
  ];
  return (
    <nav className="flex h-full w-16 flex-col items-center gap-1 py-3 lg:w-20">
      <div className="mb-4 flex flex-col items-center gap-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/20 to-emerald-400/15 ring-1 ring-cyan-400/30">
          <Shield size={20} className="text-cyan-300" />
        </div>
        <span className="text-[8px] font-bold uppercase tracking-wider text-cyan-300/70">Omni</span>
      </div>
      {items.map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onNavClick(key)}
          className={`group flex w-14 flex-col items-center gap-0.5 rounded-lg py-2 transition-all lg:w-16 ${
            activeNav === key
              ? 'bg-cyan-400/15 ring-1 ring-cyan-400/30'
              : 'hover:bg-white/5'
          }`}
        >
          <Icon
            size={18}
            className={activeNav === key ? 'text-cyan-300' : 'text-cyan-100/50 group-hover:text-cyan-200/80'}
          />
          <span
            className={`text-[8px] font-medium leading-tight lg:text-[9px] ${
              activeNav === key ? 'text-cyan-200' : 'text-cyan-100/40 group-hover:text-cyan-100/70'
            }`}
          >
            {label}
          </span>
        </button>
      ))}
      {canManage && <div className="mt-auto">
        <button
          type="button"
          onClick={onAdminConsole}
          className="group flex w-14 flex-col items-center gap-0.5 rounded-lg py-2 transition-all hover:bg-white/5 lg:w-16"
        >
          <Settings size={18} className="text-cyan-100/50 group-hover:text-cyan-200/80" />
          <span className="text-[8px] font-medium text-cyan-100/40 group-hover:text-cyan-100/70 lg:text-[9px]">
            {t('ipad_nav_admin')}
          </span>
        </button>
      </div>}
    </nav>
  );
}

// ── Device overview card ──────────────────────────────────────────────────

function DeviceOverview({ distribution, siteInfos, lang, t }: { distribution: DeviceStatusDistribution | null; siteInfos: SiteInfo[]; lang: string; t: (k: string) => string }) {
  const online = distribution?.online;
  const attention = distribution ? distribution.alarm + distribution.fault : undefined;
  return (
    <IpadPanel className="flex h-full flex-col">
      <IpadHeading icon={Cpu}>{t('ipad_device_overview')}</IpadHeading>
      <div className="space-y-3 px-3 py-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-cyan-300/5 px-2 py-2.5 text-center">
            <div className="text-xl font-bold text-white">{distribution?.total ?? '—'}</div>
            <div className="mt-0.5 text-[8px] uppercase tracking-wider text-cyan-100/80">{t('ipad_total_devices')}</div>
          </div>
          <div className="rounded-lg bg-emerald-400/5 px-2 py-2.5 text-center">
            <div className="text-xl font-bold text-emerald-300">{online ?? '—'}</div>
            <div className="mt-0.5 text-[8px] uppercase tracking-wider text-emerald-200/80">{t('ipad_online_devices')}</div>
          </div>
          <div className="rounded-lg bg-orange-500/5 px-2 py-2.5 text-center">
            <div className="text-xl font-bold text-orange-300">{attention ?? '—'}</div>
            <div className="mt-0.5 text-[8px] uppercase tracking-wider text-orange-200/80">{t('ipad_attention')}</div>
          </div>
        </div>
      </div>
      <div className="border-t border-cyan-300/10 px-3 py-2.5">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
          <MapPin size={15} className="text-cyan-300" />
          {t('ipad_sites')}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {siteInfos.length === 0 ? (
          <div className="py-4 text-center text-[10px] text-cyan-100/40">—</div>
        ) : (
          <div className="space-y-1.5">
            {siteInfos.map(si => {
              const siteName = localName(si.site.name, si.site.name_zh, lang);
              return (
                <div
                  key={si.site.id}
                  className="rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2 transition-colors hover:bg-white/[0.05]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-semibold text-white">{siteName}</span>
                    {si.fireAlarmCount > 0 && (
                      <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                        <FireAlarmIcon
                          size={18}
                          className="fire-flash fire-flash--ipad-glow"
                          style={{ filter: 'drop-shadow(0 0 4px #ff4668)' }}
                        />
                        <span className="text-[9px] font-bold tabular-nums text-white leading-none">
                          {si.unacknowledgedAlertCount} / {si.acknowledgedOrDispatchedCount}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1 text-rose-300">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#ff4668', boxShadow: '0 0 4px #ff4668' }} />
                      {t('Alarm')} {si.alarmCount}
                    </span>
                    <span className="flex items-center gap-1 text-amber-200">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#f6c945', boxShadow: '0 0 4px #f6c945' }} />
                      {t('Fault')} {si.faultCount}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </IpadPanel>
  );
}

// ── Project header card ───────────────────────────────────────────────────

function ProjectHeader({ projects, selectedProjectId, onSelectProject, projectLabel, t }: {
  projects: { id: string; label: string }[];
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  projectLabel: string;
  t: (k: string) => string;
}) {
  return (
    <IpadPanel className="flex-shrink-0">
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.18em] text-white">
          <Building2 size={16} className="text-cyan-300" />
          {t('ipad_project')}
          <span className="text-cyan-100/60">·</span>
          <span className="truncate normal-case tracking-normal text-cyan-100/70">{projectLabel}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onSelectProject(null)}
            aria-pressed={selectedProjectId === null}
            className={`rounded-lg px-2.5 py-1.5 text-[13px] font-bold transition-all ${
              selectedProjectId === null
                ? 'bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-400/40'
                : 'bg-white/[0.03] text-cyan-100/60 hover:bg-white/[0.07] hover:text-cyan-100'
            }`}
          >
            ALL
          </button>
          {projects.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectProject(p.id)}
              aria-pressed={p.id === selectedProjectId}
              className={`rounded-lg px-2.5 py-1.5 text-[13px] font-bold transition-all ${
                p.id === selectedProjectId
                  ? 'bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-400/40'
                  : 'bg-white/[0.03] text-cyan-100/60 hover:bg-white/[0.07] hover:text-cyan-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </IpadPanel>
  );
}

// ── Map (simplified from OmniOSHome) ──────────────────────────────────────

function IpadMap({ sites, selectedSiteId, onSelectSite, onOpenSite }: { sites: SiteInfo[]; selectedSiteId: string | null; onSelectSite: (id: string) => void; onOpenSite?: (id: string) => void }) {
  const { containerRef, mapRef, tileError, retryTiles, missingKey } = useLeafletMap(false);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const [hovered, setHovered] = useState<SiteInfo | null>(null);

  const geoSites = useMemo(
    () => sites.filter(s => hasMapCoordinates(s.site)),
    [sites],
  );





  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current.clear();
    geoSites.forEach(s => {
      const color = statusColor(s.status);
      const isPulsing = s.status === 'critical' || s.status === 'fire';
      const isSelected = s.site.id === selectedSiteId;
      const isDimmed = selectedSiteId !== null && !isSelected;
      const size = isSelected ? 36 : 18;
      const flashClass = isSelected ? 'leaflet-pin-flash' : '';
      const ring = isSelected ? `<div class="leaflet-pin-ring" style="border-color:${color};width:52px;height:52px;margin:-26px 0 0 -26px;"></div>` : '';
      const pulse = isPulsing ? `<div class="leaflet-pin-pulse" style="background:${color}"></div>` : '';
      const dimStyle = isDimmed ? 'opacity:0.35;' : '';
      const icon = L.divIcon({
        className: 'leaflet-pin-wrapper',
        html: `${pulse}${ring}<div class="leaflet-pin-dot ${flashClass}" style="background:${color};width:${size}px;height:${size}px;${dimStyle}"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const marker = L.marker([s.site.latitude!, s.site.longitude!], { icon, title: s.site.name })
        .addTo(map)
        .on('click', () => onSelectSite(s.site.id))
        .on('dblclick', () => { onSelectSite(s.site.id); onOpenSite?.(s.site.id); })
        .on('mouseover', () => setHovered(s))
        .on('mouseout', () => setHovered(null));
      marker.getElement()?.setAttribute('aria-label', s.site.name);
      markersRef.current.set(s.site.id, marker);
    });
  }, [geoSites, selectedSiteId, onSelectSite, onOpenSite, mapRef]);



  const selectedSiteInfo = sites.find(s => s.site.id === selectedSiteId) ?? null;

  return (
    <div className="relative flex-1 overflow-hidden rounded-xl omni-dark-map bg-[#020d25]" style={{ minHeight: '100%' }}>
      <div ref={containerRef} className="absolute inset-0 z-0" />
      <MapTileNotice failed={tileError} onRetry={retryTiles} missingKey={missingKey} />
      <div className="omni-blue-tint" />
      <div className="omni-edge-fade" />
      <div className="absolute bottom-4 right-4 z-[500] flex flex-wrap gap-2 rounded-lg border border-cyan-300/20 bg-[#061c3dcc] px-2.5 py-1.5 text-[9px] text-cyan-100/75">
        {[
          { c: '#39e6c4', l: 'Normal' },
          { c: '#f6c945', l: 'Fault' },
          { c: '#ff6a00', l: 'Alarm' },
          { c: '#8492a6', l: 'Offline' },
        ].map(({ c, l }) => (
          <span key={l} className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c, boxShadow: `0 0 6px ${c}` }} />
            {l}
          </span>
        ))}
      </div>
      {(hovered || selectedSiteInfo) && (() => {
        const info = hovered || selectedSiteInfo!;
        const statusCol = statusColor(info.status);
        return (
          <div className="absolute z-[1000] pointer-events-none rounded-lg border px-3 py-2.5 shadow-2xl" style={{ right: 12, top: 12, minWidth: 200, backgroundColor: '#062956e8', borderColor: 'rgba(57,230,196,0.2)' }}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-bold text-white">{info.site.name_zh || info.site.name}</div>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: statusCol }}>{info.status}</span>
            </div>
            <div className="mt-2 space-y-1 text-[11px]">
              <div className="flex justify-between"><span className="text-cyan-100/60">Devices</span><span className="font-bold text-white">{info.deviceCount}</span></div>
              <div className="flex justify-between"><span className="text-cyan-100/60">Online</span><span className="font-bold text-emerald-300">{info.onlineCount}</span></div>
              <div className="flex justify-between"><span className="text-cyan-100/60">Alarms</span><span className="font-bold text-rose-400">{info.alarmCount}</span></div>
              <div className="flex justify-between"><span className="text-cyan-100/60">Faults</span><span className="font-bold text-amber-300">{info.faultCount}</span></div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Alarm list panel ──────────────────────────────────────────────────────

function IpadAlarmPanel({ devices, alarms, t, lang }: { devices: Device[]; alarms: AlarmEvent[]; t: (k: string) => string; lang: string }) {
  const activeAlarms = useMemo(() =>
    alarms
      .filter(a => a.status === 'active')
      .sort((a, b) => b.triggered_at.localeCompare(a.triggered_at))
      .slice(0, 8),
    [alarms]);
  const deviceMap = useMemo(() => new Map(devices.map(d => [d.id, d])), [devices]);
  return (
    <IpadPanel className="flex min-h-0 flex-1 flex-col">
      <IpadHeading icon={Bell}>{t('ipad_alarm_info')}</IpadHeading>
      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        {activeAlarms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Activity size={24} className="mb-2 text-cyan-100/20" />
            <p className="text-[11px] text-cyan-100/40">{t('ipad_no_alarms')}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {activeAlarms.map(alarm => {
              const dev = deviceMap.get(alarm.device_id);
              const deviceName = dev?.device_types?.name_en ?? dev?.code ?? alarm.devices?.device_types?.name_en ?? 'Unknown';
              const deviceCode = dev?.code ?? alarm.devices?.code ?? '';
              const siteName = localName(
                dev?.floors?.buildings?.sites?.name ?? alarm.devices?.floors?.buildings?.sites?.name ?? '',
                dev?.floors?.buildings?.sites?.name_zh ?? alarm.devices?.floors?.buildings?.sites?.name_zh ?? '',
                lang,
              );
              const buildingName = localName(
                dev?.floors?.buildings?.name ?? alarm.devices?.floors?.buildings?.name ?? '',
                dev?.floors?.buildings?.name_zh ?? alarm.devices?.floors?.buildings?.name_zh ?? '',
                lang,
              );
              const floorLabel = dev?.floors?.floor_label ?? alarm.devices?.floors?.floor_label ?? '';
              const addressParts = [deviceCode, siteName, buildingName, floorLabel].filter(Boolean);
              return (
                <div key={alarm.id} className="rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2 transition-colors hover:bg-white/[0.05]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {(() => {
                          const type = (alarm.alarm_type ?? '').toLowerCase();
                          const isFault = type.includes('fault');
                          return (
                            <span className={`flex-shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold ${isFault ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' : 'bg-red-500/20 text-red-300 border-red-500/40'}`}>
                              {isFault ? t('Fault') : t('Alarm')}
                            </span>
                          );
                        })()}
                        <span className="truncate text-[11px] font-semibold text-white">{deviceName}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-cyan-100/75">{addressParts.join(' / ')}</div>
                    </div>
                    <span className="flex-shrink-0 text-[9px] tabular-nums text-white">{formatDateTime(alarm.triggered_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </IpadPanel>
  );
}

// ── Bottom stat panels ────────────────────────────────────────────────────

function DeviceStatusChart({ distribution, t }: { distribution: DeviceStatusDistribution | null; t: (k: string) => string }) {
  const alarmCount = distribution?.alarm ?? 0;
  const faultCount = distribution?.fault ?? 0;
  const offline = distribution?.offline ?? 0;
  const normal = distribution?.normal ?? 0;
  const deviceTotal = distribution?.total ?? 0;
  const total = Math.max(1, deviceTotal);
  const segments = [
    { label: t('Normal'), count: normal, color: '#39e6c4' },
    { label: t('Fault'), count: faultCount, color: '#f6c945' },
    { label: t('Alarm'), count: alarmCount, color: '#ff4668' },
    { label: t('Offline'), count: offline, color: '#8492a6' },
  ];
  const dashArray = 2 * Math.PI * 32;
  let offset = 0;
  return (
    <IpadPanel className="flex h-[180px] flex-col">
      <IpadHeading icon={Activity}>{t('ipad_device_status')}</IpadHeading>
      <div className="flex flex-1 items-center gap-3 px-3 py-3">
        <div className="relative flex-shrink-0">
          <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
            <circle cx="40" cy="40" r="32" fill="none" stroke="#0d3962" strokeWidth="8" opacity="0.5" />
            {segments.map((seg) => {
              if (seg.count === 0) return null;
              const len = (seg.count / total) * dashArray;
              const el = (
                <circle
                  key={seg.label}
                  cx="40" cy="40" r="32" fill="none"
                  stroke={seg.color} strokeWidth="8"
                  strokeDasharray={`${len} ${dashArray - len}`}
                  strokeDashoffset={-offset}
                  style={{ filter: `drop-shadow(0 0 3px ${seg.color}80)` }}
                />
              );
              offset += len;
              return el;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-white">{deviceTotal}</span>
            <span className="text-[8px] uppercase tracking-wider text-cyan-100/50">{t('dash_total_count')}</span>
          </div>
        </div>
        <div className="flex-1 space-y-1.5">
          {segments.map(seg => (
            <div key={seg.label} className="grid grid-cols-[minmax(0,1fr)_2ch_3.5ch] gap-1 items-center text-[10px]">
              <span className="flex items-center gap-1.5 text-cyan-100/70">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: seg.color, boxShadow: `0 0 5px ${seg.color}` }} />
                {seg.label}
              </span>
              <span className="text-center font-bold text-white tabular-nums">{seg.count}</span>
              {deviceTotal > 0
                ? <span className="text-right text-[9px] font-normal text-cyan-100/50 tabular-nums">{Math.round((seg.count / deviceTotal) * 100)}%</span>
                : <span />
              }
            </div>
          ))}
        </div>
      </div>
    </IpadPanel>
  );
}

function AlarmFault7DayChart({ projectCode, t }: { projectCode?: string; t: (k: string) => string }) {
  const { data, loading, error } = useApiQuery('ipad-statistics:' + projectCode, () =>
    api.getAlarmStatistics({ time_range: '7d', project_code: projectCode }), null as AlarmStatisticsResponse | null);
  const alarmDaily = useMemo(() => data?.trend.map(row => row.alarms) ?? [], [data]);
  const faultDaily = useMemo(() => data?.trend.map(row => row.faults) ?? [], [data]);
  const dayLabels = useMemo(() => data?.trend.map(row => row.date) ?? [], [data]);

  const maxCount = Math.max(1, ...alarmDaily, ...faultDaily);

  const option = useMemo(() => ({
    grid: { left: 28, right: 12, top: 20, bottom: 8 },
    xAxis: {
      type: 'category',
      data: dayLabels,
      axisLine: { lineStyle: { color: 'rgba(57,230,196,0.15)' } },
      axisTick: { show: false },
      axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 8 },
    },
    yAxis: {
      type: 'value',
      max: Math.ceil(maxCount * 1.3),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 8 },
      splitLine: { lineStyle: { color: 'rgba(57,230,196,0.08)' } },
    },
    legend: {
      data: [t('Alarm'), t('Fault')],
      top: 0,
      right: 0,
      textStyle: { color: 'rgba(255,255,255,0.7)', fontSize: 9 },
      itemWidth: 10,
      itemHeight: 8,
    },
    series: [
      {
        name: t('Alarm'),
        type: 'bar',
        data: alarmDaily,
        itemStyle: { color: '#ff4668', borderRadius: [2, 2, 0, 0] },
        barGap: '20%',
        label: { show: true, position: 'top', color: 'rgba(255,255,255,0.85)', fontSize: 8, fontWeight: 700 },
      },
      {
        name: t('Fault'),
        type: 'bar',
        data: faultDaily,
        itemStyle: { color: '#f6c945', borderRadius: [2, 2, 0, 0] },
        label: { show: true, position: 'top', color: 'rgba(255,255,255,0.85)', fontSize: 8, fontWeight: 700 },
      },
    ],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(6,28,61,0.95)',
      borderColor: 'rgba(57,230,196,0.3)',
      textStyle: { color: '#fff', fontSize: 10 },
    },
  }), [alarmDaily, faultDaily, dayLabels, maxCount, t]);

  return (
    <IpadPanel className="flex h-[180px] flex-col">
      <IpadHeading icon={Activity}>{t('ipad_alarm_fault_7day')}</IpadHeading>
      <div className="px-2 py-1.5">
        {loading ? (
          <div className="flex h-[130px] items-center justify-center text-[10px] text-cyan-100/40">···</div>
        ) : error ? <p role="alert" className="text-xs text-rose-300">{error}</p> : (
          <ReactECharts option={option} style={{ height: '130px', width: '100%' }} opts={{ renderer: 'svg' }} />
        )}
      </div>
    </IpadPanel>
  );
}

function AlarmDistributionChart({ devices, alarms, t }: { devices: Device[]; alarms: AlarmEvent[]; t: (k: string) => string }) {
  const normalIds = getNormalDeviceIds(devices);
  const openAlarmIds = getDevicesWithOpenAlarms(alarms, normalIds);
  const categories = [
    { key: 'detection', label: t('detection'), color: '#ff4668' },
    { key: 'pump', label: t('pump'), color: '#3b82f6' },
    { key: 'water', label: t('water'), color: '#39e6c4' },
    { key: 'ventilation', label: t('ventilation'), color: '#f6c945' },
    { key: 'power_interlocking', label: t('power_interlocking'), color: '#ff6a00' },
  ];
  const counts = categories.map(({ key }) =>
    devices.filter(d => {
      const st = normalizedStatus(d, openAlarmIds);
      return (CRITICAL_DEVICE_STATUSES.includes(st) || FAULT_DEVICE_STATUSES.includes(st)) && d.device_types?.category === key;
    }).length
  );

  const maxCount = Math.max(1, ...counts);
  const option = useMemo(() => ({
    grid: { left: 70, right: 24, top: 8, bottom: 8 },
    xAxis: {
      type: 'value',
      max: Math.ceil(maxCount * 1.3),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 8 },
      splitLine: { lineStyle: { color: 'rgba(57,230,196,0.08)' } },
    },
    yAxis: {
      type: 'category',
      data: categories.map(c => c.label),
      axisLine: { lineStyle: { color: 'rgba(57,230,196,0.15)' } },
      axisTick: { show: false },
      axisLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: 600 },
    },
    series: [{
      type: 'bar',
      data: counts.map((v, i) => ({ value: v, itemStyle: { color: categories[i].color, borderRadius: [0, 3, 3, 0] } })),
      barWidth: '55%',
      label: { show: true, position: 'right', color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: 700 },
    }],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(6,28,61,0.95)',
      borderColor: 'rgba(57,230,196,0.3)',
      textStyle: { color: '#fff', fontSize: 10 },
    },
  }), [counts, categories, maxCount]);

  return (
    <IpadPanel className="flex h-[180px] flex-col">
      <IpadHeading icon={BarChart3}>{t('ipad_alarm_distribution')}</IpadHeading>
      <div className="px-2 py-1.5">
        <ReactECharts option={option} style={{ height: '130px', width: '100%' }} opts={{ renderer: 'svg' }} />
      </div>
    </IpadPanel>
  );
}

// ── Main component ────────────────────────────────────────────────────────

// ── Contact info panel ─────────────────────────────────────────────────────

function ContactInfoPanel({ t }: { t: (k: string) => string }) {
  return (
    <IpadPanel className="flex flex-shrink-0 flex-col">
      <IpadHeading icon={Headphones}>{t('ipad_contact')}</IpadHeading>
      <div className="flex flex-col gap-2 px-3 py-2.5">
        <div className="flex items-center gap-2 text-[11px] text-cyan-100/70">
          <Phone size={13} className="flex-shrink-0 text-cyan-300" />
          <span>+852 3500-1234</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-cyan-100/70">
          <Mail size={13} className="flex-shrink-0 text-cyan-300" />
          <span>support@junkaycloud.com</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-cyan-100/70">
          <Globe size={13} className="flex-shrink-0 text-cyan-300" />
          <span>www.junkaycloud.com</span>
        </div>
        <div className="mt-1 flex items-center gap-2 border-t border-cyan-300/10 pt-2 text-[10px] text-cyan-100/50">
          <Headphones size={12} className="flex-shrink-0 text-emerald-300" />
          <span>{t('footer_24_7_hotline')}</span>
        </div>
      </div>
    </IpadPanel>
  );
}

function FireStatusPanel({ alarms, t }: { alarms: AlarmEvent[]; t: (k: string) => string }) {
  // Work-order state is independent of physical fire confirmation.
  const fireAlarms = alarms;
  const unacknowledged = fireAlarms.filter(a => a.status === 'active').length;
  const acknowledgedOrDispatched = fireAlarms.filter(a => a.status === 'acknowledged' || a.status === 'dispatched').length;

  return (
    <IpadPanel className="flex flex-shrink-0 flex-col">
      <IpadHeading icon={FireAlarmIcon}>{t('ipad_fire_alarm')}</IpadHeading>
      <div className="flex items-center justify-around px-3 py-4">
        <FireAlarmIcon
          size={48}
          className="fire-flash fire-flash--ipad-glow flex-shrink-0"
        />
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-2xl font-bold tabular-nums text-white" style={{ textShadow: '0 0 8px rgba(255,70,104,0.5)' }}>
            {unacknowledged}
          </span>
          <span className="text-center text-[10px] font-medium uppercase tracking-wider text-white/80 leading-[1.3]" style={{ maxWidth: '90px' }}>
            {t('ipad_confirmed_fire')}
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-2xl font-bold tabular-nums text-white" style={{ textShadow: '0 0 8px rgba(246,201,69,0.5)' }}>
            {acknowledgedOrDispatched}
          </span>
          <span className="text-center text-[10px] font-medium uppercase tracking-wider text-white/80 leading-[1.3]" style={{ maxWidth: '90px' }}>
            {t('ipad_under_investigation')}
          </span>
        </div>
      </div>
    </IpadPanel>
  );
}

interface OmniHomeipadProps {
  onSystemManagement: () => void;
  onAdminConsole: () => void;
  onNavigateDashboard?: () => void;
  theme: Theme;
  onThemeToggle?: () => void;
  onOpenSite?: (siteId: string) => void;
  onSignOut?: () => void;
  onChangePassword?: () => void;
}

export function OmniHomeipad({ onAdminConsole, onOpenSite, onSignOut }: OmniHomeipadProps) {
  const { lang, setLang } = useLang();
  const t = useT();
  const { user, siteRoles, role } = useAuth();
  const accessibleSiteIds = Object.keys(siteRoles).filter(sid => siteRoles[sid] && siteRoles[sid] !== 'no_access');
  const { sites } = useSiteSelector(user?.id, isGlobalAdmin(role) ? undefined : accessibleSiteIds);
  const { devices } = useDevices();
  const { alarms } = useAlarms();
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState('dashboard');
  const { projects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);


  const accessibleProjects = useMemo(() => {
    if (projects.length === 0) return [];
    if (isGlobalAdmin(role)) return projects;
    const accessibleProjectIds = new Set(
      sites.filter(s => accessibleSiteIds.includes(s.id) && s.project_id).map(s => s.project_id!)
    );
    return projects.filter(p => accessibleProjectIds.has(p.id));
  }, [projects, sites, accessibleSiteIds, role]);

  const primaryProject = useMemo(() => {
    return selectedProjectId
      ? accessibleProjects.find(p => p.id === selectedProjectId) ?? null
      : null;
  }, [accessibleProjects, selectedProjectId]);

  const distributionProjectIds = useMemo(() => accessibleProjects.map(project => project.id), [accessibleProjects]);
  const distribution = useDistribution(primaryProject?.id ?? distributionProjectIds);

  const projectSites = useMemo(() => {
    if (!primaryProject) return sites;
    return sites.filter(s => s.project_id === primaryProject.id);
  }, [sites, primaryProject]);

  const projectSiteIds = useMemo(() => new Set(projectSites.map(s => s.id)), [projectSites]);

  const projectDevices = useMemo(() => {
    return devices.filter(d => projectSiteIds.has(d.floors?.buildings?.site_id ?? ''));
  }, [devices, projectSiteIds]);

  const projectAlarms = useMemo(() => {
    return alarms.filter(a => projectSiteIds.has(a.devices?.floors?.buildings?.site_id ?? ''));
  }, [alarms, projectSiteIds]);

  const siteInfos = useMemo<SiteInfo[]>(() => projectSites.map(site => {
    const siteDevices = devices.filter(d => d.floors?.buildings?.site_id === site.id);
    const alarmCount = site.alarm_count ?? 0;
      const faultCount = site.fault_count ?? 0;
    const offlineCount = Math.max(0, (site.total_devices ?? 0) - (site.online_count ?? 0));
    const siteFireAlarms = alarms.filter(a =>
      (a.severity === 'critical' || a.severity === 'alarm' || a.severity === 'high') &&
      a.devices?.device_types?.category === 'detection' &&
        a.devices?.floors?.buildings?.site_id === site.id
    );
    const unacknowledgedAlertCount = siteFireAlarms.filter(a => a.status === 'active').length;
    const acknowledgedOrDispatchedCount = siteFireAlarms.filter(a => a.status === 'acknowledged' || a.status === 'dispatched').length;
    const fireAlarmCount = unacknowledgedAlertCount + acknowledgedOrDispatchedCount;
    return {
      site, deviceCount: site.total_devices ?? 0, onlineCount: site.online_count ?? 0,
      alarmCount, faultCount, offlineCount, fireAlarmCount, unacknowledgedAlertCount, acknowledgedOrDispatchedCount,
      status: fireAlarmCount > 0 ? 'fire' : alarmCount > 0 ? 'critical' : faultCount > 0 ? 'warning' : offlineCount === siteDevices.length && siteDevices.length > 0 ? 'offline' : 'normal',
    };
  }), [projectSites, devices, alarms]);

  const onlinePercent = distribution?.total ? Math.round(distribution.online / distribution.total * 100) : 0;

  const projectLabel = primaryProject ? localName(primaryProject.name, primaryProject.name_zh, lang) : t('omni_all_projects');

  const accessibleProjectOptions = useMemo(() =>
    accessibleProjects.map(p => ({ id: p.id, label: localName(p.name, p.name_zh, lang) })),
    [accessibleProjects, lang]);

  function handleNavClick(nav: string) {
    setActiveNav(nav);
  }

  return (
    <div
      className="relative flex h-full min-h-[700px] flex-col overflow-hidden rounded-2xl bg-[#020d25] text-white"
      style={{
        backgroundImage:
          'radial-gradient(ellipse at 20% 0%, rgba(0,163,255,0.18), transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(0,229,196,0.12), transparent 50%), radial-gradient(circle at 50% 50%, rgba(0,199,255,0.08), transparent 60%), linear-gradient(160deg, #020d25 0%, #052b5c 30%, #031535 65%, #020a20 100%)',
      }}
    >
      {/* Grid overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.1] [background-image:linear-gradient(rgba(57,230,196,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(57,230,196,0.08)_1px,transparent_1px)] [background-size:42px_42px]" />
      {/* Top-edge glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-400/[0.06] to-transparent" />

      {/* Top banner — Omni OS brand + user controls */}
      <div className="relative flex-shrink-0">
        <div
          className="relative mx-3 mt-3 flex items-center justify-between overflow-hidden rounded-2xl border border-cyan-300/15 bg-[#061c3d]/60 px-4 py-2.5 backdrop-blur-md"
          style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(57,230,196,0.08), 0 0 24px rgba(0,210,255,0.06)' }}
        >
          {/* Soft radial glow inside banner */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(0,163,255,0.12),transparent_60%),radial-gradient(ellipse_at_80%_50%,rgba(0,229,196,0.08),transparent_60%)]" />
          {/* Faint grid texture */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(57,230,196,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(57,230,196,0.08)_1px,transparent_1px)] [background-size:38px_38px]" />

          {/* Left: Omni OS brand */}
          <div className="relative flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Sparkles size={12} className="text-cyan-300" />
              <h1 className="text-lg font-black tracking-tight text-white drop-shadow-[0_0_12px_rgba(0,210,255,0.4)]">
                Omni <span className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">OS</span>
              </h1>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-300/80">
              <span className="h-1 w-1 rounded-full bg-emerald-300 shadow-[0_0_6px_#39e6c4]" /> {t('banner_live_telemetry_hk')}
            </span>
          </div>

          {/* Right: language, clock, user, status */}
          <div className="relative flex items-center gap-2.5">
            <IpadLanguageMenu lang={lang} setLang={setLang} t={t} />
            <div className="flex items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] text-white tabular-nums">
              <Clock />
            </div>
            <UserMenu onSignOut={onSignOut} onChangePassword={() => setPasswordModalOpen(true)} />
            <span className={`h-1.5 w-1.5 rounded-full ${onlinePercent > 0 ? 'bg-emerald-300 shadow-[0_0_6px_#39e6c4]' : 'bg-slate-400'}`} />
          </div>
        </div>
      </div>

      {/* Main content area: nav rail (full height) + center area + right column (full height) */}
      <div className="relative flex min-h-0 flex-1 gap-2 px-3 pb-3">
        {/* Left nav rail — spans full height to bottom of page */}
        <div className="flex flex-shrink-0 rounded-xl border border-cyan-300/10 bg-[#061c3d]/40 backdrop-blur-sm">
          <NavRail activeNav={activeNav} onNavClick={handleNavClick} t={t} onAdminConsole={onAdminConsole} canManage={isGlobalAdmin(role)} />
        </div>

        {/* Center area: top row (left column + map) + bottom row (3 chart boxes) */}
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {/* Top row: Device Overview (left) + Map (center) — equal height */}
          <div className="flex min-h-0 flex-1 gap-2">
            {/* Left top: project header + device overview */}
            <div className="flex min-h-0 flex-[3_3_0%] flex-col">
              <ProjectHeader
                projects={accessibleProjectOptions}
                selectedProjectId={primaryProject?.id ?? null}
                onSelectProject={setSelectedProjectId}
                projectLabel={projectLabel}
                t={t}
              />
              <div className="flex min-h-0 flex-1">
                <DeviceOverview
                  distribution={distribution}
                  siteInfos={siteInfos}
                  lang={lang}
                  t={t}
                />
              </div>
            </div>

            {/* Center top: map — same height as left top */}
            <div className="flex min-h-0 flex-[7_7_0%]">
              <IpadMap
                sites={siteInfos}
                selectedSiteId={selectedSiteId}
                onSelectSite={setSelectedSiteId}
                onOpenSite={onOpenSite}
              />
            </div>
          </div>

          {/* Bottom row: 3 equally-sized chart boxes */}
          <div className="flex flex-shrink-0 gap-2">
            <div className="flex-1">
              <DeviceStatusChart distribution={distribution} t={t} />
            </div>
            <div className="flex-1">
              <AlarmFault7DayChart projectCode={primaryProject?.id} t={t} />
            </div>
            <div className="flex-1">
              <AlarmDistributionChart devices={projectDevices} alarms={projectAlarms} t={t} />
            </div>
          </div>
        </div>

        {/* Right column: spans full height — Performance Score + Device Utilization + Alarm Info + Maintenance Orders + Contact Info */}
        <div className="flex min-h-0 flex-col gap-2 lg:flex-1 lg:max-w-[300px]">
          <FireStatusPanel alarms={projectAlarms} t={t} />

          <IpadAlarmPanel devices={projectDevices} alarms={projectAlarms} t={t} lang={lang} />

          <ContactInfoPanel t={t} />
        </div>
      </div>

      {passwordModalOpen && (
        <ChangePasswordModal onClose={() => setPasswordModalOpen(false)} />
      )}
    </div>
  );
}
