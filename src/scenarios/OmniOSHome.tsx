import { useDistribution } from '../hooks/useDashboardData';
import { useProjects } from '../hooks/useProjects';
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Activity, Bell, Building2, MapPin, Shield, Wrench,
  Cpu, Sparkles, Sun, Moon, Globe, Phone, Mail, Home, ChevronLeft,
  TrendingDown, Navigation, Tablet,
} from 'lucide-react';
import { FireAlarmIcon } from '../components/FireAlarmIcon';
import { useAuth, isGlobalAdmin } from '../lib/auth';
import { useDevices } from '../hooks/useDevices';
import { useAlarms } from '../hooks/useAlarms';
import { usePredictions } from '../hooks/usePredictions';
import { useSiteSelector, SiteWithBuildings } from '../hooks/useSiteSelector';
import { AlarmEvent, Device, MaintenancePrediction, Theme } from '../types';
import { useLang, useT, Language } from '../lib/i18n';
import LightBar from '../components/LightBar';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { UserMenu } from '../components/UserMenu';
import { PerformanceScore } from '../components/PerformanceScore';
import { Clock } from '../components/Clock';
import L from 'leaflet';
import { hasMapCoordinates } from '../lib/mapCoordinates';
import { useLeafletMap } from '../hooks/useLeafletMap';
import { MapTileNotice } from '../components/MapStatus';
import ReactECharts from 'echarts-for-react';
import { FAULT_DEVICE_STATUSES } from '../lib/deviceStatus';


type SiteStatus = 'normal' | 'warning' | 'critical' | 'fire' | 'offline';

interface SiteInfo {
  site: SiteWithBuildings;
  deviceCount: number;
  onlineCount: number;
  alarmCount: number;
  faultCount: number;
  offlineCount: number;
  fireAlarmCount: number;
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

export function GlassPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`relative overflow-hidden ${className}`}>{children}</section>;
}

export function PanelHeading({ icon: Icon, children, action, badge }: { icon: typeof Activity; children: React.ReactNode; action?: React.ReactNode; badge?: number }) {
  return <div className="flex items-center justify-between px-1 py-3"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white"><Icon size={16} className="text-cyan-300" />{badge !== undefined && <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] text-white">{badge}</span>}{children}</div>{action}</div>;
}

export function StatTile({ label, value, detail, color = '#39e6c4', icon: Icon = Activity }: { label: string; value: string | number; detail: string; color?: string; icon?: typeof Activity }) {
  return <div className="py-3 pr-3"><div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-[0.14em] text-cyan-100/55"><span>{label}</span><Icon size={12} style={{ color }} /></div><div className="text-xl font-bold tracking-tight text-white">{value}</div><div className="mt-1 text-[9px] text-cyan-100/45">{detail}</div></div>;
}

function siteStatusClass(status: SiteStatus): string {
  if (status === 'fire') return 'bg-rose-500/[0.06]';
  if (status === 'critical') return 'bg-orange-500/[0.08]';
  if (status === 'warning') return 'bg-amber-400/[0.05]';
  if (status === 'offline') return 'bg-slate-500/[0.05]';
  return 'bg-cyan-300/[0.03]';
}

function LeafletMap({ sites, selectedSiteId, onSelectSite, onOpenSite, theme }: { sites: SiteInfo[]; selectedSiteId: string | null; onSelectSite: (id: string) => void; onOpenSite?: (id: string) => void; theme: Theme }) {
  const isLight = theme === 'light';
  const t = useT();
  const { containerRef, mapRef, tileError, retryTiles, missingKey } = useLeafletMap(isLight);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const [hovered, setHovered] = useState<SiteInfo | null>(null);

  const geoSites = useMemo(
    () => sites.filter(s => hasMapCoordinates(s.site)),
    [sites],
  );

  const selectedSiteInfo = sites.find(s => s.site.id === selectedSiteId) ?? null;





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
      const size = isSelected ? 40 : 20;
      const flashClass = isSelected ? 'leaflet-pin-flash' : '';
      const ring = isSelected ? `<div class="leaflet-pin-ring" style="border-color:${color};width:56px;height:56px;margin:-28px 0 0 -28px;"></div>` : '';
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



  return (
    <div className={`relative flex-1 overflow-hidden rounded-2xl ${isLight ? 'bg-slate-100' : 'omni-dark-map bg-[#020d25]'}`} style={{ minHeight: '100%' }}>
      <div ref={containerRef} className="absolute inset-0 z-0" />
      <MapTileNotice failed={tileError} onRetry={retryTiles} missingKey={missingKey} />
      {!isLight && <div className="omni-blue-tint" />}
      {!isLight && <div className="omni-edge-fade" />}
      <div className="absolute bottom-6 right-6 z-[500] flex flex-wrap gap-3 rounded-lg border border-cyan-300/20 bg-[#061c3dcc] px-3 py-2 text-[10px] text-cyan-100/75" style={isLight ? { backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#334155' } : {}}>
        <Legend color="#39e6c4" label={t('map_legend_normal')} />
        <Legend color="#f6c945" label={t('map_legend_fault')} />
        <Legend color="#ff4668" label={t('map_legend_fire')} />
        <Legend color="#ff6a00" label={t('map_legend_alarm')} />
        <Legend color="#8492a6" label={t('map_legend_offline')} />
      </div>
      {(hovered || selectedSiteInfo) && (() => {
        const info = hovered || selectedSiteInfo!;
        const isNormal = info.status === 'normal';
        const isFire = info.status === 'fire';
        const statusLabel = isFire ? t('map_status_fire') : isNormal ? t('map_status_normal') : t('map_status_trouble');
        const statusCol = statusColor(info.status);
        const labelStyle = isLight ? { color: '#64748b' } : { color: 'rgba(57,230,196,0.7)' };
        const valueStyle = isLight ? { color: '#0f172a' } : { color: '#fff' };
        return (
          <div className={`absolute z-[1000] pointer-events-none rounded-xl border px-5 py-4 shadow-2xl ${isFire ? 'fire-flash' : ''}`} style={{ right: 16, top: 16, minWidth: 260, ...(isLight ? { backgroundColor: '#ffffff', border: '1px solid #cbd5e1' } : { backgroundColor: '#062956e8', borderColor: 'rgba(57,230,196,0.2)' }) }}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-bold" style={isLight ? { color: '#0f172a' } : { color: '#fff' }}>{info.site.name_zh || info.site.name}</div>
              <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: statusCol, boxShadow: `0 0 10px ${statusCol}66` }}>{statusLabel}</span>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2" style={labelStyle}><Activity size={14} /> {t('map_total_devices')}</span>
                <span className="text-base font-bold" style={valueStyle}>{info.deviceCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2" style={labelStyle}><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#39e6c4', boxShadow: '0 0 6px #39e6c4' }} /> {t('map_online')}</span>
                <span className="text-base font-bold" style={valueStyle}>{info.onlineCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2" style={labelStyle}><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#ff4668', boxShadow: '0 0 6px #ff4668' }} /> {t('map_alarms')}</span>
                <span className="text-base font-bold" style={valueStyle}>{info.alarmCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2" style={labelStyle}><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#f6c945', boxShadow: '0 0 6px #f6c945' }} /> {t('map_faults')}</span>
                <span className="text-base font-bold" style={valueStyle}>{info.faultCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2" style={labelStyle}><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#8492a6' }} /> {t('map_offline')}</span>
                <span className="text-base font-bold" style={valueStyle}>{info.offlineCount}</span>
              </div>
            </div>
          </div>
        );
      })()}
      {geoSites.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center">
          <div className="text-center">
            <MapPin size={32} className="mx-auto mb-2 text-cyan-100/30" />
            <p className="text-sm text-cyan-100/40">{t('map_no_coords')}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) { return <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />{label}</span>; }

function SiteRail({ sites, selectedSiteId, onSelectSite, onOpenSite, lang, showAll, toggleShowAll, normalSiteCount, troubleSiteCount }: { sites: SiteInfo[]; selectedSiteId: string | null; onSelectSite: (id: string) => void; onOpenSite?: (id: string) => void; lang: string; showAll: boolean; toggleShowAll: () => void; normalSiteCount: number; troubleSiteCount: number }) {
  const t = useT();
  const troubleSites = sites.filter(s => s.status !== 'normal');
  const normalSites = sites.filter(s => s.status === 'normal');
  return (
    <GlassPanel className="flex min-h-0 flex-col">
      <PanelHeading icon={MapPin}>{t('siterail_sites')} <span className="ml-2 text-white/60">{t('siterail_total')}{sites.length}</span></PanelHeading>

      {/* All toggle */}
      <div className="flex justify-end px-1 pb-1">
        <button
          type="button"
          onClick={toggleShowAll}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
            showAll
              ? 'bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-400/40'
              : 'bg-white/5 text-white/60 hover:bg-white/10'
          }`}
        >
          {t('siterail_all')}
          <span
            className={`flex h-3 w-6 items-center rounded-full transition-colors ${showAll ? 'bg-cyan-400/60' : 'bg-white/15'}`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full bg-white transition-transform ${showAll ? 'translate-x-3' : 'translate-x-0.5'}`}
            />
          </span>
        </button>
      </div>

      {/* Trouble / Normal count boxes — Trouble first, Normal hidden unless All is on */}
      <div className={`flex items-stretch gap-2 px-1 py-1 text-xs ${showAll ? '' : 'flex'}`}>
        <span className="flex flex-1 items-center justify-center gap-2 rounded-md bg-rose-500/10 py-1.5 text-rose-400">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" style={{ boxShadow: '0 0 10px #ef4444, 0 0 18px #ef4444' }} />
          <span className="font-bold text-white">{troubleSiteCount}</span> {t('siterail_trouble_sites')}
        </span>
        {showAll && (
          <span className="flex flex-1 items-center justify-center gap-2 rounded-md bg-emerald-500/10 py-1.5 text-emerald-300">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 8px #34d399' }} />
            <span className="font-bold text-white">{normalSiteCount}</span> {t('siterail_sites_ok')}
          </span>
        )}
      </div>

      {/* Site records — Trouble (full width) + OK (only when All is on) */}
      <div className={`mt-1 grid gap-2 px-1 ${showAll ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {/* Trouble column */}
        <div className="min-h-0 space-y-1 overflow-auto py-2 pr-2">
          {troubleSites.length === 0 && !showAll && (
            <div className="py-10 text-center text-sm text-cyan-100/50">{t('siterail_no_trouble')}</div>
          )}
          {troubleSites.map(info => (
            <SiteRecord
              key={info.site.id}
              info={info}
              lang={lang}
              isSelected={selectedSiteId === info.site.id}
              onSelectSite={onSelectSite}
              onOpenSite={onOpenSite}
            />
          ))}
        </div>

        {/* OK column — only visible when All is on */}
        {showAll && (
          <div className="min-h-0 space-y-1 overflow-auto py-2 pr-2">
            {normalSites.map(info => (
              <SiteRecord
                key={info.site.id}
                info={info}
                lang={lang}
                isSelected={selectedSiteId === info.site.id}
                onSelectSite={onSelectSite}
                onOpenSite={onOpenSite}
              />
            ))}
          </div>
        )}
      </div>
    </GlassPanel>
  );
}

function SiteRecord({ info, lang, isSelected, onSelectSite, onOpenSite }: { info: SiteInfo; lang: string; isSelected: boolean; onSelectSite: (id: string) => void; onOpenSite?: (id: string) => void }) {
  const t = useT();
  const isNormal = info.status === 'normal';
  const isFire = info.status === 'fire';
  const badgeClass = isFire ? 'bg-rose-500/90' : isNormal ? 'bg-emerald-500/80' : 'bg-orange-500/90';
  const badgeGlow = isFire ? '0 0 6px rgba(244,63,94,0.5)' : isNormal ? '0 0 6px rgba(52,211,153,0.4)' : '0 0 6px rgba(255,106,0,0.4)';
  return (
    <button
      type="button"
      onClick={() => onOpenSite?.(info.site.id)}
      className={`group w-full px-2 py-2.5 text-left transition-all hover:bg-cyan-300/[0.05] ${isSelected ? 'bg-cyan-300/[0.08]' : ''} ${siteStatusClass(info.status)}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 truncate text-sm font-bold text-white">
          {isFire && <FireAlarmIcon size={16} className="fire-icon-pulse flex-shrink-0 text-red-400" style={{ filter: 'drop-shadow(0 0 4px rgba(255,70,104,0.6))' }} />}
          <Navigation
            size={14}
            className="flex-shrink-0 text-cyan-300/60 transition-colors group-hover:text-cyan-300"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onSelectSite(info.site.id);
            }}
          />
          {localName(info.site.name, info.site.name_zh, lang)}
        </span>
        <span
          className={`flex-shrink-0 rounded px-2 py-0.5 text-[10px] font-bold text-white ${badgeClass}`}
          style={{ boxShadow: badgeGlow }}
        >
          {isFire ? t('map_status_fire') : isNormal ? t('map_status_normal') : t('map_status_trouble')}
        </span>
      </div>
    </button>
  );
}

export function StatusPanel({ devices, alarms, projectCode }: { devices: Device[]; alarms: AlarmEvent[]; projectCode?: string }) {
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

function RangeToggle({ range, onChange }: { range: 7 | 30; onChange: (r: 7 | 30) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-cyan-300/5 p-0.5">
      {([7, 30] as const).map(d => (
        <button
          key={d}
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(d); }}
          className={`rounded px-2 py-0.5 text-[10px] font-bold transition-all ${range === d ? 'bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-400/30' : 'text-cyan-100/40 hover:text-cyan-100/70'}`}
        >
          {d}D
        </button>
      ))}
    </div>
  );
}

const TROUBLE_SITES_DATA: Record<7 | 30, { name: string; faults: number; alarms: number }[]> = {
  7: [
    { name: 'JCT', faults: 18, alarms: 21 },
    { name: 'KTIC', faults: 12, alarms: 10 },
  ],
  30: [
    { name: 'JCT', faults: 32, alarms: 31 },
    { name: 'KTIC', faults: 28, alarms: 22 },
  ],
};

export function TopTroubleSites() {
  const t = useT();
  const [range, setRange] = useState<7 | 30>(7);
  const troubleSites = TROUBLE_SITES_DATA[range];

  const option = useMemo(() => ({
    grid: { left: 60, right: 16, top: 36, bottom: 28 },
    xAxis: {
      type: 'category',
      data: troubleSites.map(s => s.name),
      axisLine: { lineStyle: { color: 'rgba(57,230,196,0.3)' } },
      axisLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 700 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9 },
      splitLine: { lineStyle: { color: 'rgba(57,230,196,0.1)' } },
    },
    series: [
      {
        name: t('Fault'),
        type: 'bar',
        stack: 'trouble',
        data: troubleSites.map(s => s.faults),
        itemStyle: { color: '#f6c945', borderRadius: [0, 0, 0, 0] },
        barWidth: '40%',
        label: { show: true, position: 'inside', color: '#1a1a2e', fontWeight: 700, fontSize: 11 },
      },
      {
        name: t('map_alarms'),
        type: 'bar',
        stack: 'trouble',
        data: troubleSites.map(s => s.alarms),
        itemStyle: { color: '#ff4668', borderRadius: [4, 4, 0, 0] },
        barWidth: '40%',
        label: { show: true, position: 'inside', color: '#fff', fontWeight: 700, fontSize: 11 },
      },
    ],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(6,28,61,0.95)',
      borderColor: 'rgba(57,230,196,0.3)',
      textStyle: { color: '#fff', fontSize: 11 },
    },
    legend: {
      data: [t('Fault'), t('map_alarms')],
      top: 0,
      textStyle: { color: 'rgba(255,255,255,0.6)', fontSize: 9 },
      itemWidth: 10,
      itemHeight: 10,
    },
  }), [t, troubleSites]);
  return (
    <GlassPanel>
      <PanelHeading icon={TrendingDown} action={<RangeToggle range={range} onChange={setRange} />}>{t('top_trouble_sites')}</PanelHeading>
      <div className="px-1 py-2">
        <ReactECharts option={option} style={{ height: '170px', width: '100%' }} opts={{ renderer: 'svg' }} />
      </div>
    </GlassPanel>
  );
}

export function AlertPanel({ alarms, onAlarmClick, onHeadingClick, activeFilter }: { alarms: AlarmEvent[]; onAlarmClick?: (status: string) => void; onHeadingClick?: () => void; activeFilter?: string | null }) {
  const t = useT();
  const active = alarms.filter(alarm => alarm.status === 'active').length;
  const items = [
    { label: t('alertpanel_active'), count: active, color: 'text-red-500', status: 'active' },
    { label: t('false_alarm'), count: null, color: 'text-emerald-300', status: 'false_alarm' },
    { label: t('alertpanel_ack'), count: alarms.filter(alarm => alarm.status === 'acknowledged').length, color: 'text-blue-300', status: 'acknowledged' },
    { label: t('alertpanel_dispatched'), count: alarms.filter(alarm => alarm.status === 'dispatched').length, color: 'text-amber-300', status: 'dispatched' },
  ];
  return (
    <GlassPanel>
      <div className={`flex items-center justify-between px-1 py-3 ${onHeadingClick ? 'cursor-pointer hover:bg-white/[0.03] rounded-lg transition-colors' : ''}`} onClick={onHeadingClick}>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white">
          <Bell size={16} className="text-cyan-300" />
          <span className="text-base font-bold text-rose-300" style={{ textShadow: '0 1px 0 rgba(255,255,255,0.15), 0 2px 3px rgba(0,0,0,0.5), 0 0 12px rgba(244,63,94,0.4)' }}>{active}</span>
          <span className={onHeadingClick ? 'hover:text-rose-200 transition-colors' : ''}>{t('alertpanel_live_alarms')}</span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1 px-1 py-3 text-center">
        {items.map(item => (
          <div
            key={item.label}
            className={`px-1 py-2 rounded-lg transition-all ${onAlarmClick ? 'cursor-pointer hover:bg-white/5 hover:ring-1 hover:ring-rose-400/20' : ''} ${activeFilter === item.status ? 'bg-white/10 ring-1 ring-rose-400/40' : ''}`}
            onClick={onAlarmClick ? (e: React.MouseEvent) => { e.stopPropagation(); onAlarmClick(item.status); } : undefined}
          >
            <div className="mb-1">
              <span className={`text-2xl font-bold ${item.color}`} style={{ textShadow: `0 1px 0 rgba(255,255,255,0.15), 0 2px 3px rgba(0,0,0,0.5), 0 0 12px ${item.color}66` }}>{item.count ?? '—'}</span>
            </div>
            <div className="text-xs text-cyan-100/50">{item.label}</div>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

export function MaintenancePanel({ predictions, onHeadingClick, onNumberClick }: { predictions: MaintenancePrediction[]; onHeadingClick?: () => void; onNumberClick?: (status: string) => void }) {
  const t = useT();
  const total = predictions.length;
  const items = [
    { label: t('maintpanel_resolved'), count: predictions.filter(item => item.status === 'resolved').length, color: 'text-emerald-300', status: 'resolved' },
    { label: t('maintpanel_in_progress'), count: predictions.filter(item => item.status === 'in_progress').length, color: 'text-blue-300', status: 'in_progress' },
    { label: t('maintpanel_pending'), count: predictions.filter(item => item.status === 'pending').length, color: 'text-amber-300', status: 'pending' },
    { label: t('maintpanel_no_action'), count: predictions.filter(item => item.status === 'ignored').length, color: 'text-slate-300', status: 'ignored' },
  ];
  return (
    <GlassPanel>
      <div className={`flex items-center justify-between px-1 py-3 ${onHeadingClick ? 'cursor-pointer hover:bg-white/[0.03] rounded-lg transition-colors' : ''}`} onClick={onHeadingClick}>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white">
          <Wrench size={16} className="text-cyan-300" />
          <span className="text-base font-bold text-amber-300" style={{ textShadow: '0 1px 0 rgba(255,255,255,0.15), 0 2px 3px rgba(0,0,0,0.5), 0 0 12px rgba(245,158,11,0.4)' }}>{total}</span>
          <span className={onHeadingClick ? 'hover:text-amber-200 transition-colors' : ''}>{t('maintpanel_title')}</span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1 px-1 py-3 text-center">
        {items.map(item => (
          <div
            key={item.label}
            className={`px-1 py-2 rounded-lg transition-all ${onNumberClick ? 'cursor-pointer hover:bg-white/5 hover:ring-1 hover:ring-amber-400/20' : ''}`}
            onClick={onNumberClick ? (e: React.MouseEvent) => { e.stopPropagation(); onNumberClick(item.status); } : undefined}
          >
            <div className="mb-1">
              <span className={`text-2xl font-bold ${item.color}`} style={{ textShadow: `0 1px 0 rgba(255,255,255,0.15), 0 2px 3px rgba(0,0,0,0.5), 0 0 12px ${item.color}66` }}>{item.count ?? '—'}</span>
            </div>
            <div className="text-xs text-cyan-100/50">{item.label}</div>
          </div>
        ))}
      </div>
      <div className="px-1 pb-2 text-[11px] text-cyan-100/45">{total} {t('maintpanel_signals_tracked')}</div>
    </GlassPanel>
  );
}

const EQUIPMENT_CATEGORIES: { key: string; labelKey: string }[] = [
  { key: 'detection', labelKey: 'equip_detection' },
  { key: 'pump', labelKey: 'equip_pump' },
  { key: 'water', labelKey: 'equip_water' },
  { key: 'ventilation', labelKey: 'equip_ventilation' },
  { key: 'power_interlocking', labelKey: 'equip_power_interlocking' },
];

export function EquipmentFaultReport({ devices, alarms, onFaultClick }: { devices: Device[]; alarms: AlarmEvent[]; onFaultClick?: (category: string) => void }) {
  const t = useT();
  const [range, setRange] = useState<7 | 30>(7);
  const cutoff = useMemo(() => Date.now() - range * 24 * 60 * 60 * 1000, [range]);
  const faultDevices = useMemo(
    () => devices.filter(d => FAULT_DEVICE_STATUSES.includes(d.status) && new Date(d.last_seen_at).getTime() >= cutoff),
    [devices, cutoff],
  );
  const faultAlarms = useMemo(
    () => alarms.filter(a => a.status === 'active' && new Date(a.triggered_at).getTime() >= cutoff),
    [alarms, cutoff],
  );
  const counts = useMemo(() => {
    const map = new Map<string, { faults: number; alarms: number }>();
    for (const d of faultDevices) {
      const cat = d.device_types?.category ?? 'other';
      const entry = map.get(cat) ?? { faults: 0, alarms: 0 };
      entry.faults += 1;
      map.set(cat, entry);
    }
    for (const a of faultAlarms) {
      const cat = a.devices?.device_types?.category ?? 'other';
      const entry = map.get(cat) ?? { faults: 0, alarms: 0 };
      entry.alarms += 1;
      map.set(cat, entry);
    }
    return map;
  }, [faultDevices, faultAlarms]);
  const total = useMemo(() => {
    let sum = 0;
    for (const v of counts.values()) sum += v.faults + v.alarms;
    return sum;
  }, [counts]);
  const allCategories = useMemo(() => {
    const list = [...EQUIPMENT_CATEGORIES];
    if (counts.has('other')) list.push({ key: 'other', labelKey: 'equip_other' });
    return list;
  }, [counts]);
  return (
    <GlassPanel>
      <PanelHeading icon={Wrench} action={<RangeToggle range={range} onChange={setRange} />}>
        <span className="text-base font-bold text-amber-300" style={{ textShadow: '0 1px 0 rgba(255,255,255,0.15), 0 2px 3px rgba(0,0,0,0.5), 0 0 12px rgba(245,158,11,0.4)' }}>{total}</span>
        {t('equip_report_title')}
      </PanelHeading>
      <div className="grid grid-cols-3 gap-1 px-1 py-3 text-center">
        {allCategories.map(({ key, labelKey }) => {
          const entry = counts.get(key);
          const count = (entry?.faults ?? 0) + (entry?.alarms ?? 0);
          return (
            <div
              key={key}
              className={`px-1 py-2 rounded-lg transition-all ${onFaultClick ? 'cursor-pointer hover:bg-white/5 hover:ring-1 hover:ring-amber-400/20' : ''}`}
              onClick={onFaultClick ? (e: React.MouseEvent) => { e.stopPropagation(); onFaultClick(key); } : undefined}
            >
              <div className="mb-1">
                <span className={`text-2xl font-bold ${count > 0 ? 'text-amber-300' : 'text-white/40'}`} style={{ textShadow: count > 0 ? '0 1px 0 rgba(255,255,255,0.15), 0 2px 3px rgba(0,0,0,0.5), 0 0 12px rgba(245,158,11,0.4)' : 'none' }}>{count}</span>
              </div>
              <div className="text-xs text-cyan-100/50">{t(labelKey)}</div>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}

export function LanguageMenu({ lang, setLang, t }: { lang: string; setLang: (l: Language) => void; t: (k: string) => string }) {
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

export function ArtisticBanner({ onBack, onSystemManagement, onAdminConsole, onNavigateDashboard, onNavigateIpad, userName, isOnline, theme, onThemeToggle, lang, setLang, t, onSignOut, onChangePassword }: { onBack?: () => void; onSystemManagement: () => void; onAdminConsole: () => void; onNavigateDashboard?: () => void; onNavigateIpad?: () => void; userName: string; isOnline: boolean; theme: Theme; onThemeToggle?: () => void; lang: string; setLang: (l: Language) => void; t: (k: string) => string; onSignOut?: () => void; onChangePassword?: () => void }) {
  const { role, user } = useAuth();
  const canUseIpad = role === 'system_admin' || user?.email === 'rwcwong@qq.com';
  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Layered background glows */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_18%,120%,rgba(0,163,255,0.18),transparent_55%),radial-gradient(ellipse_at_82%,120%,rgba(0,229,196,0.14),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(57,230,196,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(57,230,196,0.06)_1px,transparent_1px)] [background-size:38px_38px]" />
      {/* Decorative angled layers */}
      <div className="pointer-events-none absolute -left-10 top-0 h-full w-40 -skew-x-12 bg-gradient-to-r from-cyan-400/[0.06] to-transparent" />
      <div className="pointer-events-none absolute -right-10 top-0 h-full w-40 skew-x-12 bg-gradient-to-l from-emerald-400/[0.06] to-transparent" />

      {/* Center system identity */}
      <div className="relative flex flex-col items-center px-4 pt-2 pb-3 text-center md:pb-4">
        <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.3em] text-cyan-300/80">
          <Sparkles size={11} className="text-cyan-300" />
          {t('banner_intelligent_ops')}
          <Sparkles size={11} className="text-cyan-300" />
        </div>
        <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-[0_0_20px_rgba(0,210,255,0.4)] md:text-5xl">
          Omni <span className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">OS</span>
        </h1>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-cyan-100/50">
          <span className="h-1 w-1 rounded-full bg-emerald-300 shadow-[0_0_6px_#39e6c4]" /> {t('banner_live_telemetry_hk')} <span className="h-1 w-1 rounded-full bg-emerald-300 shadow-[0_0_6px_#39e6c4]" />
        </div>
      </div>

      {/* Corner controls — left: theme + language, right: user status */}
      <div className="pointer-events-auto absolute left-3 top-3 flex items-center gap-2">
        {onBack && <button type="button" onClick={onBack} title={t('banner_back')} className="rounded-md p-1.5 text-cyan-200/70 transition-colors hover:bg-cyan-300/10 hover:text-cyan-200"><ChevronLeft size={20} /></button>}
        {onThemeToggle && <button type="button" onClick={onThemeToggle} title={theme === 'dark' ? t('banner_light_mode') : t('banner_dark_mode')} className="rounded-md p-1.5 text-cyan-200/70 transition-colors hover:bg-cyan-300/10 hover:text-cyan-200">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>}
        <LanguageMenu lang={lang} setLang={setLang} t={t} />
        {onNavigateDashboard && <button type="button" onClick={onNavigateDashboard} title={t('banner_overview_dashboard')} className="flex items-center gap-1 rounded-md p-1.5 text-cyan-200/70 transition-colors hover:bg-cyan-300/10 hover:text-cyan-200"><Home size={18} /><span className="text-[11px] font-semibold text-cyan-100/80">Home</span></button>}
        {canUseIpad && onNavigateIpad && <button type="button" onClick={onNavigateIpad} title="iPad" className="flex items-center gap-1 rounded-md p-1.5 text-cyan-200/70 transition-colors hover:bg-cyan-300/10 hover:text-cyan-200"><Tablet size={18} /><span className="text-[11px] font-semibold text-cyan-100/80">iPad</span></button>}
      </div>
      <div className="pointer-events-auto absolute right-3 top-3 flex items-center gap-1.5" title={userName}>
        <UserMenu onSignOut={onSignOut} onChangePassword={onChangePassword} />
        <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-300 shadow-[0_0_6px_#39e6c4]' : 'bg-slate-400'}`} />
      </div>

      {/* Floating buttons — positioned 1/3 up from the bottom of the banner */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between px-4 pb-2 md:px-8 md:pb-3">
        <div className="pointer-events-auto">
          <Button3D icon={Cpu} label={t('banner_system_mgmt')} sublabel={t('banner_platform')} onClick={onSystemManagement} side="left" />
        </div>
        <div className="pointer-events-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-md bg-cyan-400/10 border border-cyan-400/20 px-2.5 py-1.5 text-[11px] text-white tabular-nums">
            <Clock />
          </div>
          {isGlobalAdmin(role) && <Button3D icon={Shield} label={t('banner_admin')} sublabel={t('banner_console')} onClick={onAdminConsole} side="right" />}
        </div>
      </div>
    </div>
  );
}

export function Button3D({ icon: Icon, label, sublabel, onClick, side }: { icon: typeof Cpu; label: string; sublabel: string; onClick: () => void; side: 'left' | 'right' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex items-center gap-2 rounded-lg bg-transparent px-3 py-1.5 transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(0,210,255,0.15)] active:translate-y-0 ${side === 'left' ? 'flex-row' : 'flex-row-reverse text-right'}`}
    >
      <span className="absolute inset-0 rounded-lg bg-[radial-gradient(circle_at_50%_0%,rgba(0,210,255,0.12),transparent_70%)] opacity-0 transition-opacity group-hover:opacity-100" />
      <span className="relative rounded-md p-1.5"><Icon size={14} className="text-cyan-200" /></span>
      <span className="relative">
        <span className="block text-sm font-bold leading-tight text-white">{label}</span>
        <span className="block text-[10px] uppercase tracking-[0.14em] text-cyan-300/60">{sublabel}</span>
      </span>
    </button>
  );
}

interface OmniOSHomeProps {
  onSystemManagement: () => void;
  onAdminConsole: () => void;
  onNavigateDashboard?: () => void;
  onNavigateIpad?: () => void;
  theme: Theme;
  onThemeToggle?: () => void;
  onNavigateDevices?: () => void;
  onNavigateAlarms?: (status?: string, siteId?: string, buildingId?: string, floorId?: string, category?: string) => void;
  projectId?: string | null;
  onOpenSite?: (siteId: string) => void;
  onSignOut?: () => void;
  onChangePassword?: () => void;
}

export function OmniOSHome({ onSystemManagement, onAdminConsole, onNavigateDashboard, onNavigateIpad, theme, onThemeToggle, projectId, onOpenSite, onSignOut, onChangePassword }: OmniOSHomeProps) {
  const { lang, setLang } = useLang();
  const t = useT();
  const { user, siteRoles, role } = useAuth();
  const accessibleSiteIds = Object.keys(siteRoles).filter(sid => siteRoles[sid] && siteRoles[sid] !== 'no_access');
  const { sites } = useSiteSelector(user?.id, isGlobalAdmin(role) ? undefined : accessibleSiteIds);
  const { devices } = useDevices();
  const { alarms } = useAlarms();
  const { predictions } = usePredictions();
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [showAllSites, setShowAllSites] = useState(false);
  const { projects } = useProjects();
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);


  const primaryProject = useMemo(() => {
    if (projects.length === 0) return null;
    if (projectId) {
      const found = projects.find(p => p.id === projectId);
      if (found) return found;
    }
    // Derive project from the user's accessible sites instead of falling
    // back to the first project alphabetically (which may be wrong).
    const firstAccessibleSite = sites.find(s => accessibleSiteIds.includes(s.id));
    if (firstAccessibleSite?.project_id) {
      const found = projects.find(p => p.id === firstAccessibleSite.project_id);
      if (found) return found;
    }
    // Admin fallback: show first project
    if (isGlobalAdmin(role)) return projects[0];
    return null;
  }, [projects, projectId, sites, accessibleSiteIds, role]);
  const distribution = useDistribution(primaryProject?.id);

  const projectSites = useMemo(() => {
    if (!primaryProject) return sites;
    return sites.filter(s => s.project_id === primaryProject.id);
  }, [sites, primaryProject]);

  const siteInfos = useMemo<SiteInfo[]>(() => projectSites.map(site => {
    const siteDevices = devices.filter(d => d.floors?.buildings?.site_id === site.id);
    const alarmCount = site.alarm_count ?? 0;
      const faultCount = site.fault_count ?? 0;
    const offlineCount = Math.max(0, (site.total_devices ?? 0) - (site.online_count ?? 0));
    const fireAlarmCount = alarms.filter(a =>
      a.status === 'active' &&
      (a.severity === 'critical' || a.severity === 'alarm' || a.severity === 'high') &&
      a.devices?.device_types?.category === 'detection' &&
        a.devices?.floors?.buildings?.site_id === site.id
    ).length;
    return {
      site, deviceCount: site.total_devices ?? 0, onlineCount: site.online_count ?? 0,
      alarmCount, faultCount, offlineCount, fireAlarmCount,
      status: fireAlarmCount > 0 ? 'fire' : alarmCount > 0 ? 'critical' : faultCount > 0 ? 'warning' : offlineCount === siteDevices.length && siteDevices.length > 0 ? 'offline' : 'normal',
    };
  }), [projectSites, devices, alarms]);

  const normalSiteCount = useMemo(() => siteInfos.filter(s => s.status === 'normal').length, [siteInfos]);
  const troubleSiteCount = useMemo(() => siteInfos.filter(s => s.status !== 'normal').length, [siteInfos]);

  const projectSiteIds = useMemo(() => new Set(projectSites.map(s => s.id)), [projectSites]);

  const projectDevices = useMemo(() => {
    if (projectSiteIds.size === 0) return primaryProject ? [] : devices;
    return devices.filter(d => projectSiteIds.has(d.floors?.buildings?.site_id ?? ''));
  }, [devices, projectSiteIds, primaryProject]);

  const projectAlarms = useMemo(() => {
    if (projectSiteIds.size === 0) return primaryProject ? [] : alarms;
    return alarms.filter(a => projectSiteIds.has(a.devices?.floors?.buildings?.site_id ?? ''));
  }, [alarms, projectSiteIds, primaryProject]);

  const projectPredictions = useMemo(() => {
    if (projectSiteIds.size === 0) return primaryProject ? [] : predictions;
    return predictions.filter(p => projectSiteIds.has(p.devices?.floors?.buildings?.site_id ?? ''));
  }, [predictions, projectSiteIds, primaryProject]);

  const allDevices = projectDevices;
  const onlinePercent = distribution?.total ? Math.round(distribution.online / distribution.total * 100) : 0;

  function selectSite(id: string) {
    setSelectedSiteId(id);
  }

  function clearSiteSelection() {
    setSelectedSiteId(null);
    setShowAllSites(false);
  }

  function toggleShowAllSites() {
    setShowAllSites(prev => !prev);
  }

  return (
    <div className="relative flex h-full min-h-[720px] flex-col overflow-hidden rounded-2xl bg-[#020d25] text-white" style={{ backgroundImage: 'radial-gradient(ellipse at 20% 0%, rgba(0,163,255,0.18), transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(0,229,196,0.12), transparent 50%), radial-gradient(circle at 50% 50%, rgba(0,199,255,0.08), transparent 60%), linear-gradient(160deg, #020d25 0%, #052b5c 30%, #031535 65%, #020a20 100%)' }}>
      {/* Shared grid overlay across the entire canvas */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(57,230,196,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(57,230,196,0.08)_1px,transparent_1px)] [background-size:46px_46px]" />
      {/* Top-edge highlight glow for depth */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-cyan-400/[0.06] to-transparent" />

      <LightBar />

      <div className="relative flex min-h-0 flex-1 flex-col gap-2 p-3">
        <div className="flex-shrink-0">
          <ArtisticBanner onSystemManagement={onSystemManagement} onAdminConsole={onAdminConsole} onNavigateDashboard={onNavigateDashboard} onNavigateIpad={onNavigateIpad} userName={user?.email ?? 'Guest'} isOnline={onlinePercent > 0} theme={theme} onThemeToggle={onThemeToggle} lang={lang} setLang={setLang} t={t} onSignOut={onSignOut} onChangePassword={() => { if (onChangePassword) onChangePassword(); else setPasswordModalOpen(true); }} />
        </div>

        {/* Unified three-column command center — blended with center glow */}
        <div className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-auto lg:flex-row lg:gap-3">
          {/* Central glow radiating outward to blend the three columns */}
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(ellipse_at_50%_40%,rgba(0,199,255,0.1),transparent_70%)]" />

          {/* Left column — project info + site list */}
          <div className="relative flex min-h-0 flex-col gap-2 lg:flex-1">
            <div className="flex flex-col gap-0">
              <div className="flex items-center justify-between px-1 py-3">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={clearSiteSelection} className="group relative inline-flex items-center text-left transition-all">
                  <svg
                    className="absolute inset-0 h-full w-full"
                    viewBox="0 0 200 56"
                    preserveAspectRatio="none"
                    style={{ filter: 'drop-shadow(0 0 4px rgba(0,210,255,0.8)) drop-shadow(0 0 10px rgba(0,210,255,0.5)) drop-shadow(0 0 18px rgba(0,210,255,0.3))' }}
                  >
                    <defs>
                      <linearGradient id="omniTrapFill" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgba(2,13,37,0.95)" />
                        <stop offset="100%" stopColor="rgba(6,28,61,0.85)" />
                      </linearGradient>
                      <linearGradient id="omniTrapStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(0,210,255,0.9)" />
                        <stop offset="50%" stopColor="rgba(0,229,196,1)" />
                        <stop offset="100%" stopColor="rgba(0,210,255,0.7)" />
                      </linearGradient>
                    </defs>
                    <polygon
                      points="2,2 198,2 150,54 2,54"
                      fill="url(#omniTrapFill)"
                      stroke="url(#omniTrapStroke)"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="relative rounded-md bg-cyan-400/10 p-1.5 text-cyan-300 transition-colors group-hover:bg-cyan-400/20"><Building2 size={15} /></span>
                  <span className="relative whitespace-nowrap py-2 pl-3 pr-16">
                    <span className="block text-sm font-bold uppercase tracking-[0.2em] text-white group-hover:text-white">{primaryProject ? localName(primaryProject.name, primaryProject.name_zh, lang) : t('omni_all_projects')}</span>
                    <span className="block text-[11px] text-cyan-100/45">{primaryProject ? (lang === 'en' ? (primaryProject.name_zh || primaryProject.name) : (primaryProject.name || primaryProject.name_zh)) : ''}</span>
                  </span>
                  {selectedSiteId !== null && <span className="relative pr-4 text-[11px] font-semibold text-cyan-300/70 opacity-0 transition-opacity group-hover:opacity-100">{t('omni_all_btn')}</span>}
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-1 flex min-h-0 flex-1 flex-col">
              <SiteRail sites={siteInfos} selectedSiteId={selectedSiteId} onSelectSite={selectSite} onOpenSite={onOpenSite} lang={lang} showAll={showAllSites} toggleShowAll={toggleShowAllSites} normalSiteCount={normalSiteCount} troubleSiteCount={troubleSiteCount} />
            </div>
          </div>

          {/* Center column — interactive HK map as the central stage */}
          <div className="relative flex flex-1 flex-col lg:flex-[2_2_0%]">
            <LeafletMap sites={siteInfos} selectedSiteId={selectedSiteId} onSelectSite={selectSite} onOpenSite={onOpenSite} theme={theme} />
          </div>

          {/* Right column — performance score + alarms */}
          <div className="relative flex min-h-0 flex-col gap-2 lg:flex-1">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between py-1 pl-1">
                <DevicesUtilizationGauge rate={distribution?.total ? onlinePercent : null} size={96} style={{ marginLeft: 10, marginTop: 20 }} />
                <PerformanceScore reportedScore={primaryProject?.health_score}
                  devices={allDevices}
                  alarms={projectAlarms}
                  predictions={projectPredictions}
                  sizeClass="h-[96px] w-[96px]"
                  label={t('omni_performance_score')}
                />
                <div className="w-[80px] flex-shrink-0" />
              </div>
              <AlertPanel alarms={projectAlarms} />
            </div>
          </div>
        </div>

        {/* Contact footer */}
        <div className="flex-shrink-0">
          <ContactFooter />
        </div>
      </div>

      {passwordModalOpen && (
        <ChangePasswordModal onClose={() => setPasswordModalOpen(false)} />
      )}
    </div>
  );
}

// ── Devices Utilization Gauge ─────────────────────────────────────────────────

export function DevicesUtilizationGauge({ rate, style, size = 80 }: { rate: number | null; style?: React.CSSProperties; size?: number }) {
  const t = useT();
  const clamped = Math.max(0, Math.min(100, rate ?? 0));
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.375;
  const needleLen = size * 0.275;
  const sw = size * 0.0625;

  const angleAt = (pct: number) => (180 + (pct / 100) * 180) * (Math.PI / 180);
  const pointAt = (pct: number, radius: number) => ({
    x: cx + radius * Math.cos(angleAt(pct)),
    y: cy + radius * Math.sin(angleAt(pct)),
  });

  const zones = [
    { from: 0, to: 80, color: '#ff4668' },
    { from: 80, to: 95, color: '#f6c945' },
    { from: 95, to: 100, color: '#39e6c4' },
  ];

  const needleColor = rate == null ? '#8492a6' : clamped >= 95 ? '#39e6c4' : clamped >= 80 ? '#f6c945' : '#ff4668';
  const needleAngle = angleAt(clamped);
  const needleEnd = {
    x: cx + needleLen * Math.cos(needleAngle),
    y: cy + needleLen * Math.sin(needleAngle),
  };

  return (
    <div className="flex flex-col items-center flex-shrink-0" style={{ width: size, ...style }}>
      <div className="relative overflow-visible" style={{ width: size, height: size * 0.5625 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 overflow-visible">
          <path
            d={`M ${pointAt(0, r).x} ${pointAt(0, r).y} A ${r} ${r} 0 0 1 ${pointAt(100, r).x} ${pointAt(100, r).y}`}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={sw}
            strokeLinecap="round"
          />
          {zones.map(zone => {
            const s = pointAt(zone.from, r);
            const e = pointAt(zone.to, r);
            return (
              <path
                key={zone.color}
                d={`M ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${e.x} ${e.y}`}
                fill="none"
                stroke={zone.color}
                strokeWidth={sw}
                strokeLinecap="round"
                opacity={1}
              />
            );
          })}
          <line
            x1={cx}
            y1={cy}
            x2={needleEnd.x}
            y2={needleEnd.y}
            stroke={needleColor}
            strokeWidth={size * 0.03125}
            strokeLinecap="round"
            style={{ transition: 'all 0.6s ease', filter: `drop-shadow(0 0 3px ${needleColor})` }}
          />
          <circle cx={cx} cy={cy} r={size * 0.04375} fill={needleColor} />
          <circle cx={cx} cy={cy} r={size * 0.075} fill="none" stroke={needleColor} strokeWidth={1} opacity={0.4} />
        </svg>
      </div>
      <div
        className="font-bold tabular-nums"
        style={{ fontSize: size * 0.2125, color: needleColor, textShadow: `0 0 6px ${needleColor}80`, lineHeight: 1, marginTop: 3 }}
      >
        {rate == null ? '—' : `${clamped}%`}
      </div>
      <span className="text-[10px] font-medium uppercase tracking-wider text-white leading-[1.1] text-center" style={{ marginTop: '7px', maxWidth: size }}>
        {t('omni_devices_utilization')}
      </span>
    </div>
  );
}

// ── Contact Footer ────────────────────────────────────────────────────────────

export function ContactFooter() {
  const t = useT();
  return (
    <div className="flex-shrink-0 rounded-xl px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10 flex-shrink-0">
            <Shield size={16} className="text-red-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">{t('platform_name')}</div>
            <div className="text-xs text-gray-500">{t('company')}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
          <span className="flex items-center gap-1.5 text-gray-400">
            <Phone size={12} className="text-gray-500" /> +852 3500-1234
          </span>
          <span className="flex items-center gap-1.5 text-gray-400">
            <Mail size={12} className="text-gray-500" /> support@junkaycloud.com
          </span>
          <span className="flex items-center gap-1.5 text-gray-400">
            <Globe size={12} className="text-gray-500" /> www.junkaycloud.com
          </span>
          <span className="text-gray-600">{t('footer_24_7_hotline')}</span>
        </div>
      </div>
    </div>
  );
}
