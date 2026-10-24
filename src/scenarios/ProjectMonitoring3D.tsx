import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, Bell, Building2, CheckCircle2, CircleDot, Clock3, Compass, Gauge, Layers3, Loader, MapPin, MousePointer2, Rotate3d as Rotate3D, Send, Shield, Target, Wifi, Wrench, ZoomIn, ZoomOut } from 'lucide-react';
import { useDevices } from '../hooks/useDevices';
import { useAlarms } from '../hooks/useAlarms';
import { usePredictions } from '../hooks/usePredictions';
import { SiteWithBuildings } from '../hooks/useSiteSelector';
import { AlarmEvent, Device, MaintenancePrediction, Project, Theme } from '../types';
import { useLang, useT } from '../lib/i18n';
import hkMapImage from '../assets/images/HK_map_1.jpg';
import { hasMapCoordinates } from '../lib/mapCoordinates';
import { countAlarmFault } from '../lib/deviceStatus';

type SiteStatus = 'normal' | 'warning' | 'critical' | 'offline';

const HK_BOUNDS = { minLat: 22.20, maxLat: 22.55, minLng: 113.82, maxLng: 114.42 };
function projectToMap(site: SiteWithBuildings): { left: number; top: number } | null {
  if (!hasMapCoordinates(site)) return null;
  const { latitude, longitude } = site;
  if (latitude < HK_BOUNDS.minLat || latitude > HK_BOUNDS.maxLat || longitude < HK_BOUNDS.minLng || longitude > HK_BOUNDS.maxLng) return null;
  return {
    left: Math.max(7, Math.min(93, ((longitude - HK_BOUNDS.minLng) / (HK_BOUNDS.maxLng - HK_BOUNDS.minLng)) * 100)),
    top: Math.max(8, Math.min(92, 100 - ((latitude - HK_BOUNDS.minLat) / (HK_BOUNDS.maxLat - HK_BOUNDS.minLat)) * 100)),
  };
}

interface SiteInfo {
  site: SiteWithBuildings;
  deviceCount: number;
  onlineCount: number;
  alarmCount: number;
  faultCount: number;
  offlineCount: number;
  status: SiteStatus;
}

function localName(name: string, nameZh: string, lang: string): string {
  return lang === 'en' ? name : (nameZh || name);
}

function statusColor(status: SiteStatus): string {
  if (status === 'critical') return '#ff4668';
  if (status === 'warning') return '#f6c945';
  if (status === 'offline') return '#8492a6';
  return '#39e6c4';
}

function GlassPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#071d3dcc] shadow-[0_0_30px_rgba(0,110,255,0.12)] backdrop-blur-md ${className}`}>{children}</section>;
}

function PanelHeading({ icon: Icon, children, action }: { icon: typeof Activity; children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="flex items-center justify-between border-b border-cyan-300/15 px-4 py-3"><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100"><Icon size={14} className="text-cyan-300" />{children}</div>{action}</div>;
}

function StatTile({ label, value, detail, color = '#39e6c4', icon: Icon = Activity }: { label: string; value: string | number; detail: string; color?: string; icon?: typeof Activity }) {
  return <div className="rounded-xl border border-cyan-300/15 bg-[#0b2b52aa] p-3"><div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-cyan-100/70"><span>{label}</span><Icon size={13} style={{ color }} /></div><div className="text-2xl font-bold tracking-tight text-white">{value}</div><div className="mt-1 text-[10px] text-cyan-100/60">{detail}</div></div>;
}

function siteStatusClass(status: SiteStatus): string {
  if (status === 'critical') return 'border-rose-400/50 bg-rose-500/10';
  if (status === 'warning') return 'border-amber-300/40 bg-amber-400/10';
  if (status === 'offline') return 'border-slate-400/30 bg-slate-500/10';
  return 'border-cyan-300/20 bg-cyan-400/[0.04]';
}

function InteractiveTerrain({ sites, selectedSiteId, onSelectSite }: { sites: SiteInfo[]; selectedSiteId: string | null; onSelectSite: (id: string) => void }) {
  const t = useT();
  const [rotation, setRotation] = useState({ x: 57, z: -7 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const startRotation = useRef(rotation);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    setDragging(true);
    dragStart.current = { x: event.clientX, y: event.clientY };
    startRotation.current = rotation;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setRotation({
      x: Math.max(35, Math.min(75, startRotation.current.x - (event.clientY - dragStart.current.y) * 0.12)),
      z: startRotation.current.z + (event.clientX - dragStart.current.x) * 0.12,
    });
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    setDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    setZoom(current => Math.max(0.72, Math.min(1.55, current - event.deltaY * 0.001)));
  }

  return <div className="relative min-h-[520px] flex-1 overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#03122d] [perspective:1200px]" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onWheel={handleWheel} style={{ cursor: dragging ? 'grabbing' : 'grab' }}>
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(0,199,255,0.28),transparent_48%),linear-gradient(135deg,rgba(8,56,115,0.4),transparent_50%)]" />
    <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(57,230,196,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(57,230,196,0.1)_1px,transparent_1px)] [background-size:42px_42px]" />
    <div className="absolute inset-0 flex items-center justify-center [transform-style:preserve-3d]" style={{ transform: `rotateX(${rotation.x}deg) rotateZ(${rotation.z}deg) scale(${zoom})`, transition: dragging ? 'none' : 'transform 180ms ease-out' }}>
      <div className="relative aspect-[1.35] w-[88%] overflow-visible rounded-[28%] border-2 border-cyan-300/70 bg-[#0762a955] shadow-[0_0_50px_rgba(0,210,255,0.5),inset_0_0_70px_rgba(0,145,255,0.35)] [transform:rotateX(2deg)]" style={{ backgroundImage: `linear-gradient(rgba(2,30,76,0.15),rgba(4,111,163,0.18)),url(${hkMapImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="pointer-events-none absolute inset-0 rounded-[28%] bg-[radial-gradient(circle_at_50%_50%,transparent_40%,rgba(2,24,64,0.5))]" />
        {sites.map(info => {
          const pos = projectToMap(info.site);
          if (!pos) return null;
          const selected = selectedSiteId === info.site.id;
          const color = statusColor(info.status);
          return <button key={info.site.id} type="button" onClick={event => { event.stopPropagation(); onSelectSite(info.site.id); }} className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 text-left" style={{ left: `${pos.left}%`, top: `${pos.top}%` }}>
            <span className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-md transition-all group-hover:scale-150" style={{ backgroundColor: color }} />
            <span className={`relative block h-4 w-4 rounded-full border-2 border-white shadow-[0_0_18px_currentColor] transition-all group-hover:scale-150 ${info.status === 'critical' ? 'animate-pulse' : ''}`} style={{ backgroundColor: color, color }}>
              {selected && <span className="absolute -inset-3 rounded-full border border-current opacity-80 animate-ping" />}
            </span>
            <span className={`absolute left-1/2 top-6 -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[9px] font-bold tracking-wide text-white shadow-lg transition-all ${selected ? 'border-cyan-200/70 bg-[#062956e8] opacity-100' : 'border-cyan-200/20 bg-[#062956aa] opacity-0 group-hover:opacity-100'}`}>{info.site.name_zh || info.site.name}</span>
          </button>;
        })}
      </div>
    </div>
    <div className="absolute left-4 top-4 flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-[#061c3dcc] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100"><Rotate3D size={14} className="text-cyan-300" /> {t('pm_drag_rotate')}</div>
    <div className="absolute right-4 top-4 flex flex-col gap-1 rounded-lg border border-cyan-300/20 bg-[#061c3dcc] p-1"><button type="button" aria-label="Zoom in" onClick={() => setZoom(current => Math.min(1.55, current + 0.12))} className="rounded-md p-2 text-cyan-100 hover:bg-cyan-300/15"><ZoomIn size={14} /></button><button type="button" aria-label="Zoom out" onClick={() => setZoom(current => Math.max(0.72, current - 0.12))} className="rounded-md p-2 text-cyan-100 hover:bg-cyan-300/15"><ZoomOut size={14} /></button></div>
    <div className="absolute bottom-4 left-4 rounded-lg border border-cyan-300/20 bg-[#061c3dcc] px-3 py-2 text-[10px] text-cyan-100/75"><div className="flex items-center gap-2"><MousePointer2 size={12} className="text-cyan-300" /> {t('pm_scroll_zoom')}</div></div>
    <div className="absolute bottom-4 right-4 flex flex-wrap gap-3 rounded-lg border border-cyan-300/20 bg-[#061c3dcc] px-3 py-2 text-[10px] text-cyan-100/75"><Legend color="#39e6c4" label={t('Normal')} /><Legend color="#f6c945" label={t('dash_warning')} /><Legend color="#ff4668" label={t('Alarm')} /><Legend color="#8492a6" label={t('Offline')} /></div>
  </div>;
}

function Legend({ color, label }: { color: string; label: string }) { return <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />{label}</span>; }

function SiteRail({ sites, selectedSiteId, onSelectSite, lang }: { sites: SiteInfo[]; selectedSiteId: string | null; onSelectSite: (id: string) => void; lang: string }) {
  const t = useT();
  return <GlassPanel className="flex min-h-0 flex-col xl:w-64"><PanelHeading icon={Target}>{t('pm_site_network')}</PanelHeading><div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">{sites.length === 0 ? <div className="py-10 text-center text-xs text-cyan-100/50">{t('pm_no_sites')}</div> : sites.map(info => <button key={info.site.id} type="button" onClick={() => onSelectSite(info.site.id)} className={`w-full rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:border-cyan-200/50 ${siteStatusClass(info.status)} ${selectedSiteId === info.site.id ? 'ring-1 ring-cyan-200/70 shadow-[0_0_20px_rgba(0,210,255,0.15)]' : ''}`}><div className="flex items-start gap-2"><span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: statusColor(info.status), boxShadow: `0 0 9px ${statusColor(info.status)}` }} /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-white">{localName(info.site.name, info.site.name_zh, lang)}</span><span className="mt-1 block truncate text-[10px] text-cyan-100/55">{info.site.city || info.site.address || (lang === 'en' ? 'Hong Kong' : lang === 'zh-CN' ? '香港' : '香港')}</span></span>{info.alarmCount > 0 && <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{info.alarmCount}</span>}</div><div className="mt-3 flex items-center justify-between text-[10px] text-cyan-100/60"><span className="flex items-center gap-1"><Building2 size={11} />{info.site.buildings.length}</span><span className="flex items-center gap-1 text-cyan-200"><Wifi size={11} />{info.onlineCount}/{info.deviceCount}</span></div></button>)}</div><div className="border-t border-cyan-300/15 p-3"><div className="mb-2 flex justify-between text-[10px] uppercase tracking-[0.14em] text-cyan-100/60"><span>{t('pm_network_health')}</span><span className="text-cyan-200">{sites.length ? Math.round((sites.filter(site => site.status === 'normal').length / sites.length) * 100) : 0}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#0d3962]"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300" style={{ width: `${sites.length ? Math.round((sites.filter(site => site.status === 'normal').length / sites.length) * 100) : 0}%` }} /></div></div></GlassPanel>;
}

function StatusPanel({ devices, alarms }: { devices: Device[]; alarms: AlarmEvent[] }) {
  const t = useT();
  const { alarmCount, faultCount } = countAlarmFault(devices, alarms);
  const offline = devices.filter(d => d.status === 'Offline').length;
  const normal = Math.max(0, devices.length - alarmCount - faultCount - offline);
  const statuses = [{ label: t('Normal'), count: normal, color: '#39e6c4' }, { label: t('Fault'), count: faultCount, color: '#f6c945' }, { label: t('Alarm'), count: alarmCount, color: '#ff4668' }, { label: t('Offline'), count: offline, color: '#8492a6' }];
  const total = Math.max(1, devices.length);
  return <GlassPanel><PanelHeading icon={Activity}>{t('pm_device_matrix')}</PanelHeading><div className="space-y-3 p-4">{statuses.map(status => <div key={status.label}><div className="mb-1 flex justify-between text-[10px] text-cyan-100/70"><span>{status.label}</span><span className="font-bold text-white">{status.count}</span></div><div className="h-1.5 rounded-full bg-[#0d3962]"><div className="h-full rounded-full transition-all" style={{ width: `${(status.count / total) * 100}%`, backgroundColor: status.color, boxShadow: `0 0 10px ${status.color}` }} /></div></div>)}</div></GlassPanel>;
}

function AlertPanel({ alarms, onViewDetails }: { alarms: AlarmEvent[]; onViewDetails?: () => void }) {
  const t = useT();
  const active = alarms.filter(alarm => alarm.status === 'active').length;
  return <GlassPanel className="min-h-[180px]"><PanelHeading icon={Bell} action={<button type="button" onClick={onViewDetails} className="text-[10px] font-semibold text-cyan-300 hover:text-white">{t('pm_view_details')}</button>}>{t('pm_live_alarms')} {active > 0 && <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] text-white">{active}</span>}</PanelHeading><div className="grid grid-cols-2 gap-2 p-4 text-center">{[{ label: t('dash_active'), count: active, icon: AlertTriangle, color: 'text-rose-300' }, { label: t('dash_resolved'), count: alarms.filter(alarm => alarm.status === 'resolved' || alarm.status === 'false_alarm').length, icon: CheckCircle2, color: 'text-emerald-300' }, { label: t('dash_acknowledged'), count: alarms.filter(alarm => alarm.status === 'acknowledged').length, icon: CircleDot, color: 'text-blue-300' }, { label: t('dash_dispatched'), count: alarms.filter(alarm => alarm.status === 'dispatched').length, icon: Send, color: 'text-amber-300' }].map(item => <div key={item.label} className="rounded-lg bg-[#0b2b52aa] px-2 py-3"><item.icon size={16} className={`mx-auto mb-1 ${item.color}`} /><div className={`text-xl font-bold ${item.color}`}>{item.count}</div><div className="text-[9px] text-cyan-100/55">{item.label}</div></div>)}</div></GlassPanel>;
}

function MaintenancePanel({ predictions, onViewDetails }: { predictions: MaintenancePrediction[]; onViewDetails?: () => void }) {
  const t = useT();
  const total = predictions.length;
  return <GlassPanel className="min-h-[180px]"><PanelHeading icon={Wrench} action={<button type="button" onClick={onViewDetails} className="text-[10px] font-semibold text-cyan-300 hover:text-white">{t('pm_view_details')}</button>}>{t('pm_pred_maintenance')}</PanelHeading><div className="grid grid-cols-2 gap-2 p-4 text-center">{[{ label: t('dash_resolved'), count: predictions.filter(item => item.status === 'resolved').length, icon: CheckCircle2, color: 'text-emerald-300' }, { label: t('dash_in_progress'), count: predictions.filter(item => item.status === 'in_progress').length, icon: Loader, color: 'text-blue-300' }, { label: t('pending'), count: predictions.filter(item => item.status === 'pending').length, icon: Clock3, color: 'text-amber-300' }, { label: t('dash_no_action'), count: predictions.filter(item => item.status === 'ignored').length, icon: Shield, color: 'text-slate-300' }].map(item => <div key={item.label} className="rounded-lg bg-[#0b2b52aa] px-2 py-3"><item.icon size={16} className={`mx-auto mb-1 ${item.color}`} /><div className={`text-xl font-bold ${item.color}`}>{item.count}</div><div className="text-[9px] text-cyan-100/55">{item.label}</div></div>)}</div><div className="px-4 pb-3 text-[10px] text-cyan-100/50">{total} {t('maintpanel_signals_tracked')}</div></GlassPanel>;
}

export function ProjectMonitoring3D({ project, sites, onSelectSite, onViewMaintenance, onViewAlarms }: { project: Project | null; sites: SiteWithBuildings[]; onSelectSite: (site: SiteWithBuildings) => void; onViewMaintenance?: () => void; onViewAlarms?: () => void; theme?: Theme }) {
  const { lang } = useLang();
  const t = useT();
  const { devices } = useDevices();
  const { alarms } = useAlarms();
  const { predictions } = usePredictions();
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const projectSites = useMemo(() => sites.filter(site => site.project_id === project?.id), [sites, project?.id]);
  const projectSiteIds = useMemo(() => new Set(projectSites.map(site => site.id)), [projectSites]);
  const projectDevices = useMemo(() => devices.filter(device => device.floors?.buildings?.site_id && projectSiteIds.has(device.floors.buildings.site_id)), [devices, projectSiteIds]);
  const projectAlarms = useMemo(() => alarms.filter(alarm => alarm.devices?.floors?.buildings?.site_id && projectSiteIds.has(alarm.devices.floors.buildings.site_id)), [alarms, projectSiteIds]);
  const projectPredictions = useMemo(() => predictions.filter(prediction => prediction.devices?.floors?.buildings?.site_id && projectSiteIds.has(prediction.devices.floors.buildings.site_id)), [predictions, projectSiteIds]);
  const siteInfos = useMemo<SiteInfo[]>(() => projectSites.map(site => { const siteDevices = devices.filter(device => device.floors?.buildings?.site_id === site.id); const { alarmCount, faultCount } = countAlarmFault(siteDevices, alarms); const offlineCount = siteDevices.filter(device => device.status === 'Offline').length; return { site, deviceCount: siteDevices.length, onlineCount: siteDevices.length - offlineCount, alarmCount, faultCount, offlineCount, status: alarmCount > 0 ? 'critical' : faultCount > 0 ? 'warning' : offlineCount === siteDevices.length && siteDevices.length > 0 ? 'offline' : 'normal' }; }), [projectSites, devices, alarms]);
  const projectName = project ? localName(project.name, project.name_zh, lang) : `${t('project_dashboard')} 3D`;
  const activeAlarms = projectAlarms.filter(alarm => alarm.status === 'active').length;
  const onlinePercent = projectDevices.length ? Math.round((projectDevices.filter(device => device.status !== 'Offline').length / projectDevices.length) * 100) : 100;

  useEffect(() => { if (!selectedSiteId && projectSites.length) setSelectedSiteId(projectSites[0].id); if (selectedSiteId && !projectSites.some(site => site.id === selectedSiteId)) setSelectedSiteId(projectSites[0]?.id ?? null); }, [projectSites, selectedSiteId]);

  function selectSite(id: string) { setSelectedSiteId(id); const site = projectSites.find(item => item.id === id); if (site) onSelectSite(site); }

  return <div className="flex h-full min-h-[720px] flex-col gap-3 overflow-auto rounded-2xl bg-[#020d25] p-3 text-white" style={{ backgroundImage: 'radial-gradient(circle at 50% 10%, rgba(0, 129, 255, 0.18), transparent 42%), linear-gradient(135deg, #020d25 0%, #041b3d 55%, #020a20 100%)' }}>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-300/20 bg-[#061b3bd9] px-5 py-3 shadow-[0_0_28px_rgba(0,133,255,0.15)]"><div className="flex items-center gap-3"><div className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 p-2.5 shadow-[0_0_18px_rgba(0,213,255,0.25)]"><Layers3 size={19} className="text-cyan-200" /></div><div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">{t('project_dashboard')} 3D <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2 py-0.5 text-[9px] tracking-[0.12em] text-emerald-200">LIVE</span></div><h1 className="mt-1 text-xl font-bold tracking-tight text-white">{projectName}</h1></div></div><div className="flex flex-wrap items-center gap-2 text-[10px] text-cyan-100/65"><span className="flex items-center gap-1.5 rounded-lg border border-cyan-300/15 bg-[#0b2b52aa] px-3 py-2"><Compass size={13} className="text-cyan-300" /> {t('pm_hk_network')}</span><span className="flex items-center gap-1.5 rounded-lg border border-cyan-300/15 bg-[#0b2b52aa] px-3 py-2"><Gauge size={13} className="text-emerald-300" /> {onlinePercent}% {t('pm_online')}</span></div></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatTile label={t('pm_sites_monitored')} value={projectSites.length} detail={t('pm_project_locations')} icon={MapPin} /><StatTile label={t('pm_connected_devices')} value={projectDevices.length} detail={`${onlinePercent}% ${t('pm_currently_online')}`} color="#4fb4ff" icon={Wifi} /><StatTile label={t('pm_active_alarms')} value={activeAlarms} detail={t('pm_requires_attention')} color={activeAlarms ? '#ff4668' : '#39e6c4'} icon={AlertTriangle} /><StatTile label={t('pm_maintenance_signals')} value={projectPredictions.length} detail={t('pm_ai_forecast')} color="#f6c945" icon={Wrench} /></div>
    <div className="flex min-h-0 flex-1 flex-col gap-3 xl:flex-row"><SiteRail sites={siteInfos} selectedSiteId={selectedSiteId} onSelectSite={selectSite} lang={lang} /><InteractiveTerrain sites={siteInfos} selectedSiteId={selectedSiteId} onSelectSite={selectSite} /><div className="flex min-h-0 flex-col gap-3 xl:w-72"><StatusPanel devices={projectDevices} alarms={projectAlarms} /><AlertPanel alarms={projectAlarms} onViewDetails={onViewAlarms} /><MaintenancePanel predictions={projectPredictions} onViewDetails={onViewMaintenance} /></div></div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-300/15 bg-[#061b3bd9] px-4 py-2.5 text-[10px] text-cyan-100/55"><div className="flex items-center gap-2"><Activity size={12} className="text-cyan-300" />{t('pm_3d_operational')}</div><div className="flex items-center gap-4"><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_7px_#39e6c4]" />{t('pm_system_online')}</span><span className="flex items-center gap-1.5"><CircleDot size={11} className="text-cyan-300" />{t('last_update')}</span></div></div>
  </div>;
}
