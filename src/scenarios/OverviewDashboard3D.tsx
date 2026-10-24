import { useDistribution } from '../hooks/useDashboardData';
import { useProjects } from '../hooks/useProjects';
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Activity, Bell, MapPin,
  Wifi, Wrench,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useDevices } from '../hooks/useDevices';
import { useAlarms } from '../hooks/useAlarms';
import { usePredictions } from '../hooks/usePredictions';
import { useSiteSelector, SiteWithBuildings } from '../hooks/useSiteSelector';
import { AlarmEvent, Device, MaintenancePrediction, Project, Theme } from '../types';
import { useLang, useT } from '../lib/i18n';
import LightBar from '../components/LightBar';
import L from 'leaflet';
import { hasMapCoordinates } from '../lib/mapCoordinates';
import { useLeafletMap } from '../hooks/useLeafletMap';
import { MapTileNotice } from '../components/MapStatus';
import { ArtisticBanner, ContactFooter } from './OmniOSHome';

type SiteStatus = 'normal' | 'warning' | 'critical' | 'offline';
type ProjectStatus = 'normal' | 'warning' | 'critical' | 'offline';

interface SiteInfo {
  site: SiteWithBuildings;
  projectId: string | null;
  projectName: string | null;
  projectNameZh: string | null;
  deviceCount: number;
  onlineCount: number;
  alarmCount: number;
  faultCount: number;
  offlineCount: number;
  status: SiteStatus;
}

interface ProjectInfo {
  projectId: string | null;
  project: Project | null;
  sites: SiteWithBuildings[];
  siteInfos: SiteInfo[];
  siteCount: number;
  buildingCount: number;
  deviceCount: number;
  onlineCount: number;
  alarmCount: number;
  warningCount: number;
  faultCount: number;
  offlineCount: number;
  status: ProjectStatus;
}

function localName(name: string, nameZh: string, lang: string): string {
  return lang === 'en' ? name : (nameZh || name);
}

function statusColor(status: SiteStatus | ProjectStatus): string {
  if (status === 'critical') return '#ff4668';
  if (status === 'warning') return '#f6c945';
  if (status === 'offline') return '#8492a6';
  return '#39e6c4';
}

function GlassPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`relative overflow-hidden ${className}`}>{children}</section>;
}

function PanelHeading({ icon: Icon, children, action, badge }: { icon: typeof Activity; children: React.ReactNode; action?: React.ReactNode; badge?: number }) {
  return (
    <div className="flex items-center justify-between px-1 py-3">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white">
        <Icon size={16} className="text-cyan-300" />
        {badge !== undefined && badge > 0 && <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] text-white">{badge}</span>}
        {children}
      </div>
      {action}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />{label}</span>;
}

function LeafletMap({ sites, selectedSiteId, selectedProjectId, onSelectSite, theme, lang, t }: {
  sites: SiteInfo[];
  selectedSiteId: string | null;
  selectedProjectId: string | null;
  onSelectSite: (id: string) => void;
  theme: Theme;
  lang: string;
  t: (k: string) => string;
}) {
  const isLight = theme === 'dark' ? false : true;
  const { containerRef, mapRef, tileError, retryTiles, missingKey } = useLeafletMap(isLight);
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
      const isPulsing = s.status === 'critical';
      const isSelected = s.site.id === selectedSiteId;
      const isDimmed = selectedProjectId !== null && s.projectId !== selectedProjectId;
      const size = 20;
      const ring = isSelected ? `<div class="leaflet-pin-ring" style="border-color:${color}"></div>` : '';
      const pulse = isPulsing ? `<div class="leaflet-pin-pulse" style="background:${color}"></div>` : '';
      const dimStyle = isDimmed ? 'opacity:0.35;' : '';
      const icon = L.divIcon({
        className: 'leaflet-pin-wrapper',
        html: `${pulse}${ring}<div class="leaflet-pin-dot" style="background:${color};width:${size}px;height:${size}px;${dimStyle}"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const marker = L.marker([s.site.latitude!, s.site.longitude!], { icon, title: s.site.name })
        .addTo(map)
        .on('click', () => onSelectSite(s.site.id))
        .on('mouseover', () => setHovered(s))
        .on('mouseout', () => setHovered(null));
      marker.getElement()?.setAttribute('aria-label', s.site.name);
      markersRef.current.set(s.site.id, marker);
    });
  }, [geoSites, selectedSiteId, selectedProjectId, onSelectSite, mapRef]);



  return (
    <div className={`relative flex-1 overflow-hidden ${isLight ? 'bg-slate-100' : 'omni-dark-map bg-[#020d25]'}`} style={{ minHeight: '100%' }}>
      <div ref={containerRef} className="absolute inset-0 z-0" />
      <MapTileNotice failed={tileError} onRetry={retryTiles} missingKey={missingKey} />
      {!isLight && <div className="omni-blue-tint" />}
      {!isLight && <div className="omni-edge-fade" />}
      <div className="absolute bottom-4 right-4 z-[500] flex flex-wrap gap-3 rounded-lg border border-cyan-300/20 bg-[#061c3dcc] px-3 py-2 text-[10px] text-cyan-100/75" style={isLight ? { backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#334155' } : {}}>
        <Legend color="#39e6c4" label={t('map_legend_normal')} />
        <Legend color="#f6c945" label={t('map_legend_fault')} />
        <Legend color="#ff4668" label={t('map_legend_alarm')} />
        <Legend color="#8492a6" label={t('map_legend_offline')} />
      </div>
      {hovered && (
        <div className="absolute z-[1000] pointer-events-none whitespace-nowrap rounded-md border border-cyan-200/20 bg-[#062956e8] px-3 py-2 text-xs shadow-lg" style={{ right: 16, top: 16, ...(isLight ? { backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#334155' } : {}) }}>
          <div className="font-bold text-white" style={isLight ? { color: '#0f172a' } : {}}>{hovered.site.name_zh || hovered.site.name}</div>
          {hovered.projectName && (
            <div className="mt-0.5 text-[10px] text-cyan-200/70" style={isLight ? { color: '#0284c7' } : {}}>
              {lang === 'en' ? hovered.projectName : (hovered.projectNameZh || hovered.projectName)}
            </div>
          )}
          <div className="mt-0.5 text-cyan-100/45" style={isLight ? { color: '#64748b' } : {}}>
            {hovered.alarmCount > 0 && <span className="mr-2 text-rose-400">{hovered.alarmCount} {t('dash_alarms_col')}</span>}
            {hovered.faultCount > 0 && <span className="mr-2 text-amber-400">{hovered.faultCount} {t('dash_faults_col')}</span>}
            <span className="text-cyan-300">{hovered.deviceCount} {t('dash_devices')}</span>
          </div>
        </div>
      )}
      {geoSites.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center">
          <div className="text-center">
            <MapPin size={32} className="mx-auto mb-2 text-cyan-100/30" />
            <p className="text-sm text-cyan-100/40">{lang === 'en' ? 'No property coordinates available' : lang === 'zh-CN' ? '暂无楼盘坐标' : '暫無樓盤座標'}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectRail({ projects, selectedProjectId, onSelectProject, onOpenProject, lang, t }: {
  projects: ProjectInfo[];
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onOpenProject?: (projectId: string) => void;
  lang: string;
  t: (k: string) => string;
}) {
  const normalCount = projects.filter(p => p.status === 'normal').length;
  const troubleCount = projects.length - normalCount;
  const totalSites = projects.reduce((sum, project) => sum + project.siteCount, 0);
  const healthPct = projects.find(project => project.projectId === selectedProjectId)?.project?.health_score ?? null;

  return (
    <GlassPanel className="flex min-h-0 flex-col">
      <div className="px-1 py-2">
        <button
          type="button"
          onClick={() => onSelectProject(null)}
          className="group relative inline-flex items-center text-left transition-all"
        >
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 200 56"
            preserveAspectRatio="none"
            style={{ filter: 'drop-shadow(0 0 4px rgba(0,210,255,0.8)) drop-shadow(0 0 10px rgba(0,210,255,0.5)) drop-shadow(0 0 18px rgba(0,210,255,0.3))' }}
          >
            <defs>
              <linearGradient id="trapFill" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(2,13,37,0.95)" />
                <stop offset="100%" stopColor="rgba(6,28,61,0.85)" />
              </linearGradient>
              <linearGradient id="trapStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(0,210,255,0.9)" />
                <stop offset="50%" stopColor="rgba(0,229,196,1)" />
                <stop offset="100%" stopColor="rgba(0,210,255,0.7)" />
              </linearGradient>
            </defs>
            <polygon
              points="2,2 198,2 150,54 2,54"
              fill="url(#trapFill)"
              stroke="url(#trapStroke)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          <span className="relative whitespace-nowrap py-2 pl-4 pr-16">
            <span className="block text-sm font-bold text-white transition-colors group-hover:text-cyan-200">{t('dash_project_overview')}</span>
            <span className="block text-[11px] text-cyan-100/45">{selectedProjectId === null ? (lang === 'en' ? 'All projects shown' : lang === 'zh-CN' ? '显示所有项目' : '顯示所有項目') : (lang === 'en' ? 'Click to show all' : lang === 'zh-CN' ? '点击显示全部' : '點擊顯示全部')}</span>
          </span>
          {selectedProjectId !== null && (
            <span className="relative pr-4 text-[11px] font-semibold text-cyan-300/70 opacity-0 transition-opacity group-hover:opacity-100">{lang === 'en' ? 'All' : '全部'}</span>
          )}
        </button>
      </div>
      <div className="flex items-stretch gap-2 px-1 py-2 text-xs">
        <span className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-cyan-500/10 py-1.5 text-cyan-200">
          <span className="font-bold text-white">{totalSites}</span> {t('dash_sites')}
        </span>
        <span className="flex flex-1 items-center justify-center gap-2 rounded-md bg-emerald-500/10 py-1.5 text-emerald-300">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 8px #34d399' }} />
          <span className="font-bold text-white">{normalCount}</span> {t('dash_normal')}
        </span>
        <span className="flex flex-1 items-center justify-center gap-2 rounded-md bg-rose-500/10 py-1.5 text-rose-400">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" style={{ boxShadow: '0 0 10px #ef4444, 0 0 18px #ef4444' }} />
          <span className="font-bold text-white">{troubleCount}</span> {t('dash_trouble')}
        </span>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-auto py-2 pr-2">
        {projects.length === 0 ? (
          <div className="py-10 text-center text-sm text-cyan-100/50">{t('dash_no_projects')}</div>
        ) : projects.map(info => {
          const name = info.project ? localName(info.project.name, info.project.name_zh, lang) : (info.sites[0] ? localName(info.sites[0].name, info.sites[0].name_zh, lang) : '—');
          const selected = selectedProjectId === info.projectId;
          return (
            <button
              key={info.projectId ?? 'unassigned'}
              type="button"
              onClick={() => { if (info.projectId) onOpenProject?.(info.projectId); }}
              className={`w-full px-1 py-3 text-left transition-all hover:bg-cyan-300/[0.05] ${selected ? 'bg-cyan-300/[0.08]' : ''}`}
            >
              <div className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: statusColor(info.status), boxShadow: `0 0 9px ${statusColor(info.status)}` }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-white">{name}</span>
                  <span className="mt-1 block truncate text-[11px] text-cyan-100/45">{info.siteCount} {t('dash_sites')} · {info.buildingCount} {t('dash_buildings')}</span>
                </span>
                {info.alarmCount + info.faultCount > 0 && <span className="rounded-full bg-rose-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">{info.alarmCount + info.faultCount}</span>}
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-cyan-100/50">
                <span className="flex items-center gap-1 text-cyan-200/80"><Wifi size={11} />{info.onlineCount}/{info.deviceCount}</span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="px-1 py-2">
        <div className="mb-1 flex justify-between text-[11px] text-cyan-100/50">
          <span className="text-white">{lang === 'en' ? 'Portfolio health' : lang === 'zh-CN' ? '项目组合健康度' : '項目組合健康度'}</span>
          <span className="text-cyan-200">{healthPct == null ? '—' : `${healthPct}%`}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#0d3962]">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300 transition-all" style={{ width: `${healthPct ?? 0}%` }} />
        </div>
      </div>
    </GlassPanel>
  );
}

function StatusPanel({ devices, alarms, projectCode }: { devices: Device[]; alarms: AlarmEvent[]; projectCode?: string }) {
  const t = useT();
  const distribution = useDistribution(projectCode);
  const alarm = distribution?.alarm ?? 0;
  const fault = distribution?.fault ?? 0;
  const offline = distribution?.offline ?? 0;
  const normal = distribution?.normal ?? 0;
  const deviceTotal = distribution?.total ?? 0;
  const total = Math.max(1, deviceTotal);
  void devices; void alarms;
  const segments = [
    { label: t('Normal'), count: normal, color: '#39e6c4' },
    { label: t('Fault'), count: fault, color: '#f6c945' },
    { label: t('Alarm'), count: alarm, color: '#ff4668' },
    { label: t('Offline'), count: offline, color: '#8492a6' },
  ];
  const dashArray = 2 * Math.PI * 36;
  let offset = 0;
  return (
    <GlassPanel>
      <PanelHeading icon={Activity}>{t('dash_devices')} <span className="ml-3 text-white">{deviceTotal}</span></PanelHeading>
      <div className="flex items-center gap-4 px-2 py-4">
        <div className="relative flex-shrink-0">
          <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
            <circle cx="48" cy="48" r="36" fill="none" stroke="#0d3962" strokeWidth="10" opacity="0.5" />
            {segments.map((seg) => {
              if (seg.count === 0) return null;
              const len = (seg.count / total) * dashArray;
              const el = (
                <circle
                  key={seg.label}
                  cx="48" cy="48" r="36" fill="none"
                  stroke={seg.color} strokeWidth="10"
                  strokeDasharray={`${len} ${dashArray - len}`}
                  strokeDashoffset={-offset}
                  style={{ filter: `drop-shadow(0 0 4px ${seg.color}80)` }}
                />
              );
              offset += len;
              return el;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white">{deviceTotal}</span>
            <span className="text-[9px] uppercase tracking-wider text-cyan-100/50">{t('dash_total_count').toUpperCase()}</span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {segments.map(seg => (
            <div key={seg.label} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-cyan-100/70">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: seg.color, boxShadow: `0 0 6px ${seg.color}` }} />
                {seg.label}
              </span>
              <span className="text-base font-bold text-white">
                {seg.count}
                {deviceTotal > 0 && (
                  <span className="ml-1 text-[10px] font-normal text-cyan-100/50">
                    {Math.round((seg.count / deviceTotal) * 100)}%
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </GlassPanel>
  );
}

function AlertPanel({ alarms, t, lang, onHeadingClick, onNumberClick }: { alarms: AlarmEvent[]; t: (k: string) => string; lang: string; onHeadingClick?: () => void; onNumberClick?: (status: string) => void }) {
  const active = alarms.filter(a => a.status === 'active').length;
  const items = [
    { label: t('dash_active'), count: active, color: 'text-rose-300', status: 'active' },
    { label: t('false_alarm'), count: null, color: 'text-emerald-300', status: 'false_alarm' },
    { label: t('dash_acknowledged'), count: alarms.filter(a => a.status === 'acknowledged').length, color: 'text-blue-300', status: 'acknowledged' },
    { label: t('dash_dispatched'), count: alarms.filter(a => a.status === 'dispatched').length, color: 'text-amber-300', status: 'dispatched' },
  ];
  return (
    <GlassPanel>
      <PanelHeading icon={Bell} action={onHeadingClick ? <button type="button" onClick={onHeadingClick} className="text-[10px] text-cyan-300/60 hover:text-cyan-200 transition-colors">{lang === 'en' ? 'View all →' : lang === 'zh-CN' ? '查看全部 →' : '查看全部 →'}</button> : undefined}>{active > 0 && <span className="text-base font-bold text-rose-300">{active}</span>}{t('dash_live_alarms')}</PanelHeading>
      <div className="grid grid-cols-4 gap-1 px-1 py-3 text-center">
        {items.map(item => (
          <button key={item.label} type="button" onClick={() => onNumberClick?.(item.status)} disabled={!onNumberClick || item.count == null} className="px-1 py-2 rounded-lg transition-all hover:bg-cyan-300/[0.06] disabled:cursor-default disabled:hover:bg-transparent">
            <div className="mb-1"><span className={`text-2xl font-bold ${item.color}`} style={{ textShadow: `0 1px 0 rgba(255,255,255,0.15), 0 2px 3px rgba(0,0,0,0.5), 0 0 12px ${item.color}66` }}>{item.count ?? '—'}</span></div>
            <div className="text-xs text-cyan-100/50">{item.label}</div>
          </button>
        ))}
      </div>
    </GlassPanel>
  );
}

function MaintenancePanel({ predictions, t, lang, onHeadingClick, onNumberClick }: { predictions: MaintenancePrediction[]; t: (k: string) => string; lang: string; onHeadingClick?: () => void; onNumberClick?: (status: string) => void }) {
  const total = predictions.length;
  const items = [
    { label: t('dash_resolved'), count: predictions.filter(p => p.status === 'resolved').length, color: 'text-emerald-300', status: 'resolved' },
    { label: t('dash_in_progress'), count: predictions.filter(p => p.status === 'in_progress').length, color: 'text-blue-300', status: 'in_progress' },
    { label: t('pending'), count: predictions.filter(p => p.status === 'pending').length, color: 'text-amber-300', status: 'pending' },
    { label: t('dash_no_action'), count: predictions.filter(p => p.status === 'ignored').length, color: 'text-slate-300', status: 'ignored' },
  ];
  return (
    <GlassPanel>
      <PanelHeading icon={Wrench} action={onHeadingClick ? <button type="button" onClick={onHeadingClick} className="text-[10px] text-cyan-300/60 hover:text-cyan-200 transition-colors">{lang === 'en' ? 'View all →' : lang === 'zh-CN' ? '查看全部 →' : '查看全部 →'}</button> : undefined}>{total > 0 && <span className="text-base font-bold text-amber-300">{total}</span>}{t('dash_predictive_maintenance')}</PanelHeading>
      <div className="grid grid-cols-4 gap-1 px-1 py-3 text-center">
        {items.map(item => (
          <button key={item.label} type="button" onClick={() => onNumberClick?.(item.status)} disabled={!onNumberClick} className="px-1 py-2 rounded-lg transition-all hover:bg-cyan-300/[0.06] disabled:cursor-default disabled:hover:bg-transparent">
            <div className="mb-1"><span className={`text-2xl font-bold ${item.color}`} style={{ textShadow: `0 1px 0 rgba(255,255,255,0.15), 0 2px 3px rgba(0,0,0,0.5), 0 0 12px ${item.color}66` }}>{item.count ?? '—'}</span></div>
            <div className="text-xs text-cyan-100/50">{item.label}</div>
          </button>
        ))}
      </div>
      <div className="px-1 pb-2 text-[11px] text-cyan-100/45">{total} {t('dash_predictive_maintenance').toLowerCase()}</div>
    </GlassPanel>
  );
}



export function OverviewDashboard3D({ onSystemManagement, onAdminConsole, onNavigateAlarms, onNavigateMaintenance, onNavigateAdminEquipment, onOpenProject, onNavigateIpad, theme = 'dark', onThemeToggle, onSignOut }: {
  onNavigate: (tab: string) => void;
  onSystemManagement: () => void;
  onAdminConsole: () => void;
  onNavigateAlarms?: (status?: string) => void;
  onNavigateMaintenance?: (status?: string) => void;
  onNavigateAdminEquipment?: () => void;
  onOpenProject?: (projectId: string) => void;
  onNavigateIpad?: () => void;
  theme?: Theme;
  onThemeToggle?: () => void;
  onSignOut?: () => void;
}) {
  const { lang, setLang } = useLang();
  const t = useT();
  const { user } = useAuth();
  const { sites } = useSiteSelector(user?.id);
  const { devices } = useDevices();
  const { alarms } = useAlarms();
  const { predictions } = usePredictions();
  const { projects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);


  const projectMap = useMemo(() => {
    const m = new Map<string, Project>();
    for (const p of projects) m.set(p.id, p);
    return m;
  }, [projects]);

  const siteInfos = useMemo<SiteInfo[]>(() => {
    return sites.map(site => {
      const siteDevices = devices.filter(d => d.floors?.buildings?.site_id === site.id);
      const alarmCount = site.alarm_count ?? 0;
      const faultCount = site.fault_count ?? 0;
      const offlineCount = Math.max(0, (site.total_devices ?? 0) - (site.online_count ?? 0));
      const status: SiteStatus = alarmCount > 0 ? 'critical' : faultCount > 0 ? 'warning' : offlineCount === siteDevices.length && siteDevices.length > 0 ? 'offline' : 'normal';
      const project = site.project_id ? projectMap.get(site.project_id) ?? null : null;
      return { site, projectId: site.project_id ?? null, projectName: project?.name ?? null, projectNameZh: project?.name_zh ?? null, deviceCount: site.total_devices ?? 0, onlineCount: site.online_count ?? 0, alarmCount, faultCount, offlineCount, status };
    });
  }, [sites, devices, alarms, projectMap]);

  const projectInfos = useMemo<ProjectInfo[]>(() => {
    const grouped = new Map<string | null, SiteInfo[]>();
    for (const si of siteInfos) {
      const arr = grouped.get(si.projectId) ?? [];
      arr.push(si);
      grouped.set(si.projectId, arr);
    }
    const result: ProjectInfo[] = [];
    for (const [pid, infos] of grouped) {
      const projectSites = infos.map(i => i.site);
      const deviceCount = infos.reduce((s, i) => s + i.deviceCount, 0);
      const onlineCount = infos.reduce((s, i) => s + i.onlineCount, 0);
      const alarmCount = infos.reduce((s, i) => s + i.alarmCount, 0);
      const faultCount = infos.reduce((s, i) => s + i.faultCount, 0);
      const offlineCount = infos.reduce((s, i) => s + i.offlineCount, 0);
      const siteIds = new Set(projectSites.map(s => s.id));
      const projectActiveAlarms = alarms.filter(a => a.status === 'active' && a.devices?.floors?.buildings?.site_id && siteIds.has(a.devices.floors.buildings.site_id));
      const warningCount = projectActiveAlarms.filter(a => a.severity === 'fault' || a.severity === 'medium' || a.severity === 'low').length;
      const status: ProjectStatus = alarmCount > 0
        ? 'critical'
        : warningCount > 0 || faultCount > 0
          ? 'warning'
          : offlineCount === deviceCount && deviceCount > 0
            ? 'offline'
            : 'normal';
      result.push({
        projectId: pid,
        project: pid ? projectMap.get(pid) ?? null : null,
        sites: projectSites,
        siteInfos: infos,
        siteCount: projectSites.length,
        buildingCount: projectSites.reduce((s, site) => s + site.buildings.length, 0),
        deviceCount,
        onlineCount,
        alarmCount,
        warningCount,
        faultCount,
        offlineCount,
        status,
      });
    }
    result.sort((a, b) => {
      const an = a.project?.name_zh || a.project?.name || a.sites[0]?.name || '';
      const bn = b.project?.name_zh || b.project?.name || b.sites[0]?.name || '';
      return an.localeCompare(bn);
    });
    return result;
  }, [siteInfos, alarms, projectMap]);

  useEffect(() => {
    if (selectedProjectId !== null) {
      const proj = projectInfos.find(p => p.projectId === selectedProjectId);
      if (proj && proj.siteInfos.length > 0) {
        setSelectedSiteId(proj.siteInfos[0].site.id);
        return;
      }
    }
    if (!selectedSiteId && siteInfos.length > 0) {
      setSelectedSiteId(siteInfos[0].site.id);
    }
  }, [selectedProjectId, projectInfos, siteInfos, selectedSiteId]);

  const mapSites = selectedProjectId !== null
    ? siteInfos.filter(si => si.projectId === selectedProjectId)
    : siteInfos;

  const onlinePercent = devices.length ? Math.round((devices.filter(d => d.status !== 'Offline').length / devices.length) * 100) : 0;
  function selectSite(id: string) {
    setSelectedSiteId(id);
  }

  function selectProject(id: string | null) {
    setSelectedProjectId(id);
  }

  return (
    <div className="relative flex h-full min-h-[720px] flex-col overflow-hidden rounded-2xl bg-[#020d25] text-white" style={{ backgroundImage: 'radial-gradient(ellipse at 20% 0%, rgba(0,163,255,0.18), transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(0,229,196,0.12), transparent 50%), radial-gradient(circle at 50% 50%, rgba(0,199,255,0.08), transparent 60%), linear-gradient(160deg, #020d25 0%, #052b5c 30%, #031535 65%, #020a20 100%)' }}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(57,230,196,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(57,230,196,0.08)_1px,transparent_1px)] [background-size:46px_46px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-cyan-400/[0.06] to-transparent" />

      <LightBar />

      <div className="relative flex min-h-0 flex-1 flex-col gap-2 p-3">
        <div className="flex-shrink-0">
          <ArtisticBanner
            onSystemManagement={onSystemManagement}
            onAdminConsole={onAdminConsole}
            onNavigateIpad={onNavigateIpad}
            onThemeToggle={onThemeToggle}
            userName={user?.email ?? (lang === 'en' ? 'Guest' : lang === 'zh-CN' ? '访客' : '訪客')}
            isOnline={onlinePercent > 0}
            theme={theme}
            lang={lang}
            setLang={setLang}
            t={t}
            onSignOut={onSignOut}
          />
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-auto lg:flex-row lg:gap-3">
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(ellipse_at_50%_40%,rgba(0,199,255,0.1),transparent_70%)]" />

          <div className="relative flex min-h-0 flex-col gap-2 lg:flex-1">
            <ProjectRail
              projects={projectInfos}
              selectedProjectId={selectedProjectId}
              onSelectProject={selectProject}
              onOpenProject={onOpenProject}
              lang={lang}
              t={t}
            />
          </div>

          <div className="relative flex flex-1 flex-col lg:flex-[2_2_0%]">
            <LeafletMap
              sites={mapSites}
              selectedSiteId={selectedSiteId}
              selectedProjectId={selectedProjectId}
              onSelectSite={selectSite}
              theme={theme}
              lang={lang}
              t={t}
            />
          </div>

          <div className="relative flex min-h-0 flex-col gap-2 lg:flex-1">
            <div className="flex flex-col gap-2">
              <button type="button" onClick={onNavigateAdminEquipment} disabled={!onNavigateAdminEquipment} className="text-left transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-default">
                <StatusPanel devices={devices} alarms={alarms} />
              </button>
              <AlertPanel alarms={alarms} t={t} lang={lang} onHeadingClick={() => onNavigateAlarms?.()} onNumberClick={(status) => onNavigateAlarms?.(status)} />
              <MaintenancePanel predictions={predictions} t={t} lang={lang} onHeadingClick={() => onNavigateMaintenance?.()} onNumberClick={(status) => onNavigateMaintenance?.(status)} />
            </div>
          </div>
        </div>

        <div className="flex-shrink-0">
          <ContactFooter />
        </div>
      </div>
    </div>
  );
}
