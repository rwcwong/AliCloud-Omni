import { useState, useMemo, useEffect, useRef } from 'react';
import L from 'leaflet';
import { hasMapCoordinates } from '../lib/mapCoordinates';
import { useLeafletMap } from '../hooks/useLeafletMap';
import { MapTileNotice } from '../components/MapStatus';
import hkMapImage from '../assets/images/HK_map_1.jpg';
import ReactECharts from 'echarts-for-react';
import { ArrowLeft, Bell, Wrench, Shield, Wifi, Building2, AlertTriangle, Phone, Mail, Globe, Layers, Image as ImageIcon, CheckCircle2, Loader, Clock, Ban, ThumbsUp, Send, TrendingDown, MapPin } from 'lucide-react';
import { useDevices } from '../hooks/useDevices';
import { useAlarms } from '../hooks/useAlarms';
import { usePredictions } from '../hooks/usePredictions';
import { SiteWithBuildings } from '../hooks/useSiteSelector';
import { AlarmEvent, MaintenancePrediction, Project, Theme } from '../types';
import { PerformanceScore } from '../components/PerformanceScore';

import { useT, useLang } from '../lib/i18n';

const CRITICAL_DEVICE_STATUSES = ['Alarm', 'Activated', 'Panel Fire', 'MCCB Off'];
const FAULT_DEVICE_STATUSES = ['Fault', 'Panel Fault', 'Low Level', 'High Level', 'Low Pressure'];

type SiteStatus = 'normal' | 'warning' | 'critical' | 'offline';

interface SiteInfo {
  site: SiteWithBuildings;
  deviceCount: number;
  onlineCount: number;
  alarmCount: number;
  faultCount: number;
  offlineCount: number;
  status: SiteStatus;
}

function siteStatusClass(status: SiteStatus): string {
  switch (status) {
    case 'critical': return 'border-red-500/50 bg-red-500/[0.08]';
    case 'warning': return 'border-yellow-500/40 bg-yellow-500/[0.05]';
    case 'offline': return 'border-gray-600/40 bg-gray-700/20';
    default: return 'border-gray-800/60 bg-gray-900/30';
  }
}

function siteDotClass(status: SiteStatus): string {
  switch (status) {
    case 'critical': return 'bg-red-500 animate-pulse';
    case 'warning': return 'bg-yellow-400';
    case 'offline': return 'bg-gray-500';
    default: return 'bg-green-500';
  }
}

function pinColor(status: SiteStatus): string {
  switch (status) {
    case 'critical': return '#ef4444';
    case 'warning': return '#eab308';
    case 'offline': return '#6b7280';
    default: return '#22c55e';
  }
}

function localizedName(name: string, nameZh: string, lang: string): string {
  return lang === 'en' ? name : (nameZh || name);
}

// ── HK Map ──────────────────────────────────────────────────────────────────

// Reference-project projection for the static image map.
const HK_BOUNDS = { minLat: 22.20, maxLat: 22.55, minLng: 113.82, maxLng: 114.42 };
function projectToSvg(lat: number, lng: number, width: number, height: number) {
  return {
    x: ((lng - HK_BOUNDS.minLng) / (HK_BOUNDS.maxLng - HK_BOUNDS.minLng)) * width,
    y: height - ((lat - HK_BOUNDS.minLat) / (HK_BOUNDS.maxLat - HK_BOUNDS.minLat)) * height,
  };
}

// ── Interactive Leaflet Map ──────────────────────────────────────────────────

function createPinIcon(color: string, isPulsing: boolean, isSelected: boolean): L.DivIcon {
  const size = isSelected ? 26 : 20;
  const ring = isSelected ? `<div class="leaflet-pin-ring" style="border-color:${color}"></div>` : '';
  const pulse = isPulsing ? `<div class="leaflet-pin-pulse" style="background:${color}"></div>` : '';
  return L.divIcon({
    className: 'leaflet-pin-wrapper',
    html: `${pulse}${ring}<div class="leaflet-pin-dot" style="background:${color};width:${size}px;height:${size}px"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function InteractiveMap({ sites, selectedSiteId, onSelectSite, theme, lang, t }: {
  sites: SiteInfo[];
  selectedSiteId: string | null;
  onSelectSite: (siteId: string) => void;
  theme: Theme;
  lang: string;
  t: (k: string) => string;
}) {
  const isLight = theme === 'light';
  const { containerRef, mapRef, tileError, retryTiles, missingKey } = useLeafletMap(isLight);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const [hovered, setHovered] = useState<SiteInfo | null>(null);

  const geoSites = useMemo(
    () => sites.filter(s => hasMapCoordinates(s.site)),
    [sites],
  );

  // Initialize map once


  // Swap tile layer when theme changes


  // Update markers when sites change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current.clear();

    geoSites.forEach(s => {
      const color = pinColor(s.status);
      const isPulsing = s.status === 'critical';
      const isSelected = s.site.id === selectedSiteId;
      const icon = createPinIcon(color, isPulsing, isSelected);

      const marker = L.marker([s.site.latitude!, s.site.longitude!], { icon, title: s.site.name })
        .addTo(map)
        .on('click', () => onSelectSite(s.site.id))
        .on('mouseover', () => setHovered(s))
        .on('mouseout', () => setHovered(null));

      marker.getElement()?.setAttribute('aria-label', s.site.name);
      markersRef.current.set(s.site.id, marker);
    });

  }, [geoSites, selectedSiteId, onSelectSite, mapRef]);

  // Invalidate size when container becomes visible / resizes


  return (
    <div className={`relative w-full h-full min-h-[300px] ${isLight ? 'bg-slate-100' : 'omni-dark-map bg-[#020d25]'}`}>
      <div ref={containerRef} className="absolute inset-0 z-0" />
      <MapTileNotice failed={tileError} onRetry={retryTiles} missingKey={missingKey} />
      {!isLight && <div className="omni-blue-tint" />}
      {!isLight && <div className="omni-edge-fade" />}

      {/* Legend */}
      <div
        className="absolute bottom-3 left-3 z-[500] flex flex-wrap gap-3 rounded-lg px-3 py-2"
        style={isLight
          ? { backgroundColor: '#ffffff', border: '1px solid #cbd5e1', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.15)' }
          : { backgroundColor: 'rgba(3, 7, 18, 0.82)', border: '1px solid rgba(55, 65, 81, 0.6)', backdropFilter: 'blur(4px)' }
        }
      >
        <LegendDot color="#22c55e" label={t('dash_normal')} light={isLight} />
        <LegendDot color="#eab308" label={t('dash_warning')} light={isLight} />
        <LegendDot color="#ef4444" label={t('dash_alarm')} light={isLight} />
        <LegendDot color="#6b7280" label={t('dash_offline')} light={isLight} />
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div
          className={`absolute z-[1000] pointer-events-none px-3 py-2 rounded-lg border text-xs whitespace-nowrap shadow-xl ${isLight ? 'border-gray-300 text-slate-900' : 'bg-gray-950 border-gray-600 text-white'}`}
          style={{ right: 16, top: 16, ...(isLight ? { backgroundColor: '#ffffff' } : {}) }}
        >
          <div className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{hovered.site.name_zh || hovered.site.name}</div>
          <div className={`mt-0.5 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
            {hovered.alarmCount > 0 && <span className="text-red-500 mr-2">{hovered.alarmCount} {t('dash_alarms_col')}</span>}
            {hovered.faultCount > 0 && <span className="text-yellow-600 mr-2">{hovered.faultCount} {t('dash_faults_col')}</span>}
            <span className={isLight ? 'text-cyan-600' : 'text-cyan-300'}>{hovered.deviceCount} {t('dash_devices')}</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {geoSites.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-[1000]">
          <div className="text-center">
            <MapPin size={32} className="text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">{lang === 'en' ? 'No property coordinates available' : lang === 'zh-CN' ? '暂无楼盘坐标' : '暫無樓盤座標'}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Static Map (original image-based view) ───────────────────────────────────

function StaticMap({ sites, selectedSiteId, onSelectSite, theme, lang, t }: {
  sites: SiteInfo[];
  selectedSiteId: string | null;
  onSelectSite: (siteId: string) => void;
  theme: Theme;
  lang: string;
  t: (k: string) => string;
}) {
  const isLight = theme === 'light';
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });
  const [hovered, setHovered] = useState<SiteInfo | null>(null);

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setSize({ w: Math.max(rect.width, 320), h: Math.max(rect.height, 300) });
    };
    update();
    const observer = new ResizeObserver(update);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { w, h } = size;
  const pinsWithPos = sites
    .filter(s => hasMapCoordinates(s.site))
    .map(s => ({
      info: s,
      pos: projectToSvg(s.site.latitude!, s.site.longitude!, w, h),
    }));

  return (
    <div ref={containerRef} className={`relative w-full h-full min-h-[300px] overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-slate-900'}`}>
      <img
        src={hkMapImage}
        alt={t('dash_sites')}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className={`absolute inset-0 ${isLight ? '' : 'bg-slate-950/20'}`} />
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} className="absolute inset-0">
        {pinsWithPos.map(({ info, pos }) => {
          const isSelected = info.site.id === selectedSiteId;
          const r = isSelected ? 9 : 6;
          const color = pinColor(info.status);
          return (
            <g
              key={info.site.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              className="cursor-pointer"
              onClick={() => onSelectSite(info.site.id)}
              onMouseEnter={() => setHovered(info)}
              onMouseLeave={() => setHovered(null)}
            >
              {info.status === 'critical' && (
                <circle r={r + 6} fill={color} opacity="0.15">
                  <animate attributeName="r" values={`${r + 3};${r + 10};${r + 3}`} dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.25;0;0.25" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle r={r} fill={color} stroke="#0f172a" strokeWidth="2" />
              <circle r={r - 2.5} fill="white" opacity="0.3" />
              {isSelected && (
                <circle r={r + 4} fill="none" stroke={color} strokeWidth="2" opacity="0.6" />
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div
        className="absolute bottom-3 left-3 flex flex-wrap gap-3 rounded-lg px-3 py-2"
        style={isLight
          ? { backgroundColor: '#ffffff', border: '1px solid #cbd5e1', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.15)' }
          : { backgroundColor: 'rgba(3, 7, 18, 0.82)', border: '1px solid rgba(55, 65, 81, 0.6)', backdropFilter: 'blur(4px)' }
        }
      >
        <LegendDot color="#22c55e" label={t('dash_normal')} light={isLight} />
        <LegendDot color="#eab308" label={t('dash_warning')} light={isLight} />
        <LegendDot color="#ef4444" label={t('dash_alarm')} light={isLight} />
        <LegendDot color="#6b7280" label={t('dash_offline')} light={isLight} />
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div
          className={`absolute z-30 pointer-events-none px-3 py-2 rounded-lg border text-xs whitespace-nowrap shadow-xl ${isLight ? 'border-gray-300 text-slate-900' : 'bg-gray-950 border-gray-600 text-white'}`}
          style={{ right: 16, top: 16, ...(isLight ? { backgroundColor: '#ffffff' } : {}) }}
        >
          <div className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{hovered.site.name_zh || hovered.site.name}</div>
          <div className={`mt-0.5 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
            {hovered.alarmCount > 0 && <span className="text-red-500 mr-2">{hovered.alarmCount} {t('dash_alarms_col')}</span>}
            {hovered.faultCount > 0 && <span className="text-yellow-600 mr-2">{hovered.faultCount} {t('dash_faults_col')}</span>}
            <span className={isLight ? 'text-cyan-600' : 'text-cyan-300'}>{hovered.deviceCount} {t('dash_devices')}</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {pinsWithPos.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <MapPin size={32} className="text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">{lang === 'en' ? 'No property coordinates available' : lang === 'zh-CN' ? '暂无楼盘坐标' : '暫無樓盤座標'}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Map wrapper with toggle ──────────────────────────────────────────────────

type MapMode = 'interactive' | 'static';

function HKMap({ sites, selectedSiteId, onSelectSite, theme, lang, t }: {
  sites: SiteInfo[];
  selectedSiteId: string | null;
  onSelectSite: (siteId: string) => void;
  theme: Theme;
  lang: string;
  t: (k: string) => string;
}) {
  const isLight = theme === 'light';
  const [mode, setMode] = useState<MapMode>('interactive');

  return (
    <div className={`relative w-full h-full min-h-[300px] overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-slate-900'}`}>
      {/* Map view toggle */}
      <div
        className="absolute bottom-8 right-3 z-[1000] flex items-center rounded-lg p-0.5 gap-0.5"
        style={isLight
          ? { backgroundColor: '#ffffff', border: '1px solid #94a3b8', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.2)' }
          : { backgroundColor: 'rgba(3, 7, 18, 0.82)', border: '1px solid rgba(55, 65, 81, 0.6)', backdropFilter: 'blur(4px)' }
        }
      >
        <button
          onClick={() => setMode('interactive')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all border"
          style={mode === 'interactive'
            ? isLight
              ? { backgroundColor: 'rgba(37, 99, 235, 0.15)', color: '#0f172a', borderColor: 'rgba(37, 99, 235, 0.3)' }
              : { backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', borderColor: 'rgba(59, 130, 246, 0.3)' }
            : isLight
              ? { backgroundColor: 'transparent', color: '#475569', borderColor: 'transparent' }
              : { backgroundColor: 'transparent', color: '#9ca3af', borderColor: 'transparent' }
          }
        >
          <Layers size={13} />
          {t('map_interactive')}
        </button>
        <button
          onClick={() => setMode('static')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all border"
          style={mode === 'static'
            ? isLight
              ? { backgroundColor: 'rgba(37, 99, 235, 0.15)', color: '#0f172a', borderColor: 'rgba(37, 99, 235, 0.3)' }
              : { backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', borderColor: 'rgba(59, 130, 246, 0.3)' }
            : isLight
              ? { backgroundColor: 'transparent', color: '#475569', borderColor: 'transparent' }
              : { backgroundColor: 'transparent', color: '#9ca3af', borderColor: 'transparent' }
          }
        >
          <ImageIcon size={13} />
          {t('map_static')}
        </button>
      </div>

      {mode === 'interactive' ? (
        <InteractiveMap
          sites={sites}
          selectedSiteId={selectedSiteId}
          onSelectSite={onSelectSite}
          theme={theme}
          lang={lang}
          t={t}
        />
      ) : (
        <StaticMap
          sites={sites}
          selectedSiteId={selectedSiteId}
          onSelectSite={onSelectSite}
          theme={theme}
          lang={lang}
          t={t}
        />
      )}
    </div>
  );
}

function LegendDot({ color, label, light }: { color: string; label: string; light?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span
        className="text-xs font-semibold"
        style={{ color: light ? '#0f172a' : '#9ca3af' }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Site List Item ────────────────────────────────────────────────────────────

function SiteListItem({ info, isSelected, onClick }: {
  info: SiteInfo;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { lang } = useLang();
  const t = useT();
  const name = localizedName(info.site.name, info.site.name_zh, lang);
  const isCritical = info.status === 'critical';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-3 transition-all ${
        isSelected
          ? 'border-blue-500/50 bg-blue-500/[0.08]'
          : siteStatusClass(info.status) + ' hover:border-gray-600/50'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${siteDotClass(info.status)}`} />
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold truncate ${isCritical ? 'text-red-300' : 'text-white'}`}>{name}</div>
          <div className="text-xs text-gray-500 truncate">{info.site.address || info.site.city || '—'}</div>
        </div>
        {isCritical && (
          <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold flex-shrink-0">
            {info.alarmCount}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs">
        <span className="flex items-center gap-1 text-gray-400">
          <Building2 size={11} /> {info.site.buildings.length}
        </span>
        <span className="flex items-center gap-1 text-cyan-300">
          <Wifi size={11} /> {info.onlineCount}/{info.deviceCount}
        </span>
        {info.alarmCount > 0 && <span className="text-red-400 font-medium">{info.alarmCount} {t('dash_alarms_col')}</span>}
        {info.faultCount > 0 && <span className="text-yellow-400">{info.faultCount} {t('dash_faults_col')}</span>}
      </div>
    </button>
  );
}

// ── Status Summary ──────────────────────────────────────────────────────────

function StatusSummary({ sites }: { sites: SiteInfo[] }) {
  const t = useT();
  const total = sites.length;
  const normal = sites.filter(s => s.status === 'normal' || s.status === 'offline').length;
  const trouble = sites.filter(s => s.status === 'critical' || s.status === 'warning').length;
  const normalPct = total > 0 ? Math.round((normal / total) * 100) : 0;
  const troublePct = total > 0 ? Math.round((trouble / total) * 100) : 0;

  return (
    <div className="border-t border-gray-800/50 p-3 flex-shrink-0">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        {t('dash_sites')} - {t('dash_sites_total_label')} : {total}
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-800">
        <div className="h-full bg-green-500 transition-all" style={{ width: `${normalPct}%` }} />
        <div className="h-full bg-red-500 transition-all" style={{ width: `${troublePct}%` }} />
      </div>
      <div className="flex items-center justify-between mt-2 text-xs">
        <span className="flex items-center gap-1.5 text-gray-400">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          {t('dash_normal')} <span className="text-green-400 font-bold">({normal})</span>
          <span className="text-white font-semibold ml-1">{normalPct}%</span>
        </span>
        <span className="flex items-center gap-1.5 text-gray-400">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          {t('dash_trouble')} <span className="text-red-400 font-bold">({trouble})</span>
          <span className="text-white font-semibold ml-1">{troublePct}%</span>
        </span>
      </div>
    </div>
  );
}

// ── Right Panel: System Data ────────────────────────────────────────────────

function TopTroubleSites({ theme }: { theme: Theme }) {
  const t = useT();
  const isLight = theme === 'light';

  const sites = [
    { name: 'JCT', faults: 20, alarms: 8 },
    { name: 'KTIC', faults: 25, alarms: 12 },
  ];

  const maxTotal = Math.max(...sites.map(s => s.faults + s.alarms));

  const option = {
    grid: { top: 16, right: 16, bottom: 28, left: 36 },
    xAxis: {
      type: 'category' as const,
      data: sites.map(s => s.name),
      axisLine: { lineStyle: { color: isLight ? '#94a3b8' : '#475569' } },
      axisLabel: { color: isLight ? '#475569' : '#94a3b8', fontSize: 11, fontWeight: 700 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      max: Math.ceil(maxTotal * 1.15 / 5) * 5,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: isLight ? '#e2e8f0' : '#334155', type: 'dashed' as const } },
      axisLabel: { color: isLight ? '#94a3b8' : '#64748b', fontSize: 10 },
    },
    series: [
      {
        name: 'Fault',
        type: 'bar' as const,
        stack: 'trouble' as const,
        data: sites.map(s => s.faults),
        itemStyle: { color: '#eab308', borderRadius: [0, 0, 0, 0] },
        barWidth: '46%',
        label: { show: true, position: 'inside' as const, color: '#ffffff', fontSize: 11, fontWeight: 700 },
      },
      {
        name: 'Alarm',
        type: 'bar' as const,
        stack: 'trouble' as const,
        data: sites.map(s => s.alarms),
        itemStyle: { color: '#ef4444', borderRadius: [4, 4, 0, 0] },
        barWidth: '46%',
        label: { show: true, position: 'inside' as const, color: '#ffffff', fontSize: 11, fontWeight: 700 },
      },
    ],
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: isLight ? '#ffffff' : '#0f172a',
      borderColor: isLight ? '#cbd5e1' : '#334155',
      textStyle: { color: isLight ? '#1e293b' : '#e2e8f0', fontSize: 11 },
    },
    legend: {
      show: true,
      bottom: 0,
      textStyle: { color: isLight ? '#475569' : '#94a3b8', fontSize: 10 },
      itemWidth: 10,
      itemHeight: 10,
      data: [t('Fault'), t('Alarm')],
    },
  };

  return (
    <div className="bg-gray-900/60 border border-gray-800/50 rounded-xl p-4 flex-shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <TrendingDown size={14} className="text-orange-400" />
        <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">{t('dash_trouble_sites') || 'Top 2 Trouble Sites (7 Days)'}</span>
      </div>
      <ReactECharts option={option} style={{ height: 160, width: '100%' }} opts={{ renderer: 'canvas' }} />
    </div>
  );
}

// ── Right Panel: Project Alarms ─────────────────────────────────────────────

function ProjectAlarms({ alarms, onViewDetails }: { alarms: AlarmEvent[]; onViewDetails?: () => void }) {
  const t = useT();
  const active = alarms.filter(a => a.status === 'active').length;
  const resolved = alarms.filter(a => a.status === 'resolved' || a.status === 'false_alarm').length;
  const acknowledged = alarms.filter(a => a.status === 'acknowledged').length;
  const dispatched = alarms.filter(a => a.status === 'dispatched').length;
  const total = active + resolved + acknowledged + dispatched;

  const statuses = [
    { label: t('active'), count: active, icon: AlertTriangle, color: 'text-red-400' },
    { label: t('resolved'), count: resolved, icon: CheckCircle2, color: 'text-green-400' },
    { label: t('Acknowledged'), count: acknowledged, icon: ThumbsUp, color: 'text-blue-400' },
    { label: t('dispatched'), count: dispatched, icon: Send, color: 'text-orange-400' },
  ];

  return (
    <div className="bg-gray-900/60 border border-gray-800/50 rounded-xl flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-red-400" />
          <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">{t('dash_alert_info')}</span>
          {active > 0 && (
            <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold animate-pulse">
              {active}
            </span>
          )}
        </div>
        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {t('dash_view_details')}
            <ArrowLeft size={11} className="rotate-180" />
          </button>
        )}
      </div>
      <div className="px-4 pb-4 flex-1 min-h-0 flex flex-col justify-center">
        {total === 0 ? (
          <div className="text-gray-500 text-sm text-center py-6">{t('dash_no_alerts')}</div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-1 mb-1">
              {statuses.map(({ count, icon: Icon, color }) => (
                <div key={color} className="flex items-center justify-center gap-1.5">
                  <Icon size={18} className={color} />
                  <span className={`font-bold text-base ${color}`}>{count}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1">
              {statuses.map(({ label, color }) => (
                <div key={label} className={`text-center text-[10px] ${color} leading-tight`}>
                  {label}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Right Panel: Project Maintenance ────────────────────────────────────────

function ProjectMaintenance({ predictions, onViewDetails }: { predictions: MaintenancePrediction[]; onViewDetails?: () => void }) {
  const t = useT();
  const resolved = predictions.filter(p => p.status === 'resolved').length;
  const inProgress = predictions.filter(p => p.status === 'in_progress').length;
  const pending = predictions.filter(p => p.status === 'pending').length;
  const ignored = predictions.filter(p => p.status === 'ignored').length;
  const total = resolved + inProgress + pending + ignored;

  const statuses = [
    { label: t('resolved'), count: resolved, icon: CheckCircle2, color: 'text-green-400' },
    { label: t('dash_in_progress'), count: inProgress, icon: Loader, color: 'text-blue-400' },
    { label: t('pending'), count: pending, icon: Clock, color: 'text-yellow-400' },
    { label: t('dash_no_action'), count: ignored, icon: Ban, color: 'text-gray-400' },
  ];

  return (
    <div className="bg-gray-900/60 border border-gray-800/50 rounded-xl flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Wrench size={14} className="text-orange-400" />
          <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">{t('dash_predictive_maintenance')}</span>
        </div>
        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {t('dash_view_details')}
            <ArrowLeft size={11} className="rotate-180" />
          </button>
        )}
      </div>
      <div className="px-4 pb-4 flex-1 min-h-0 flex flex-col justify-center">
        {total === 0 ? (
          <div className="text-gray-500 text-sm text-center py-6">{t('dash_no_maintenance')}</div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-1 mb-1">
              {statuses.map(({ count, icon: Icon, color }) => (
                <div key={color} className="flex items-center justify-center gap-1.5">
                  <Icon size={18} className={color} />
                  <span className={`font-bold text-base ${color}`}>{count}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1">
              {statuses.map(({ label, color }) => (
                <div key={label} className={`text-center text-[10px] ${color} leading-tight`}>
                  {label}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function ProjectMonitoring({
  project,
  sites,
  onSelectSite,
  onViewMaintenance,
  onViewAlarms,
  theme,
}: {
  project: Project | null;
  sites: SiteWithBuildings[];
  onBack: () => void;
  onSelectSite: (site: SiteWithBuildings) => void;
  onViewMaintenance?: () => void;
  onViewAlarms?: () => void;
  theme: Theme;
}) {
  const { lang } = useLang();
  const t = useT();
  const isLight = theme === 'light';
  const { devices } = useDevices();
  const { alarms } = useAlarms();
  const { predictions } = usePredictions();
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  // Filter to sites belonging to this project
  const projectSites = useMemo(
    () => sites.filter(s => s.project_id === project?.id),
    [sites, project?.id]
  );

  // Build site info with device/alarm stats
  const siteInfos: SiteInfo[] = useMemo(() => {
    return projectSites.map(site => {
      const siteIds = new Set([site.id]);
      const siteDevices = devices.filter(d => d.floors?.buildings?.site_id && siteIds.has(d.floors.buildings.site_id));
      const siteAlarms = alarms.filter(a => a.status === 'active' && a.devices?.floors?.buildings?.site_id && siteIds.has(a.devices.floors.buildings.site_id));
      const alarmCount = siteDevices.filter(d => CRITICAL_DEVICE_STATUSES.includes(d.status)).length + siteAlarms.filter(a => a.severity === 'critical' || a.severity === 'alarm' || a.severity === 'high').length;
      const faultCount = siteDevices.filter(d => FAULT_DEVICE_STATUSES.includes(d.status)).length;
      const offlineCount = siteDevices.filter(d => d.status === 'Offline').length;
      const onlineCount = siteDevices.filter(d => d.status !== 'Offline').length;
      const status: SiteStatus = alarmCount > 0 ? 'critical' : faultCount > 0 ? 'warning' : offlineCount === siteDevices.length && siteDevices.length > 0 ? 'offline' : 'normal';
      return { site, deviceCount: siteDevices.length, onlineCount, alarmCount, faultCount, offlineCount, status };
    });
  }, [projectSites, devices, alarms]);

  // Filter alarms to this project's sites
  const projectSiteIds = useMemo(() => new Set(projectSites.map(s => s.id)), [projectSites]);
  const projectAlarms = useMemo(
    () => alarms.filter(a => a.devices?.floors?.buildings?.site_id && projectSiteIds.has(a.devices.floors.buildings.site_id)),
    [alarms, projectSiteIds]
  );

  // Filter predictions to this project's sites
  const projectPredictions = useMemo(() => {
    const siteBuildingIds = new Set(projectSites.flatMap(s => s.buildings.map(b => b.id)));
    return predictions.filter(p => {
      const buildingId = p.devices?.floors?.buildings?.id;
      return buildingId && siteBuildingIds.has(buildingId);
    });
  }, [predictions, projectSites]);

  // Aggregate devices for this project
  const projectDevices = useMemo(
    () => devices.filter(d => d.floors?.buildings?.site_id && projectSiteIds.has(d.floors.buildings.site_id)),
    [devices, projectSiteIds]
  );

  // Auto-select first site
  useEffect(() => {
    if (!selectedSiteId && projectSites.length > 0) {
      setSelectedSiteId(projectSites[0].id);
    }
    if (selectedSiteId && !projectSites.some(s => s.id === selectedSiteId)) {
      setSelectedSiteId(projectSites[0]?.id ?? null);
    }
  }, [projectSites, selectedSiteId]);

  const projectName = project ? localizedName(project.name, project.name_zh, lang) : '—';

  function handleSiteClick(site: SiteWithBuildings) {
    setSelectedSiteId(site.id);
    onSelectSite(site);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden gap-3">
      {/* Three-column layout */}
      <div className="flex-1 flex gap-3 min-h-0">
      {/* Left: site list + status summary */}
      <div className="w-72 flex-shrink-0 flex flex-col min-h-0 bg-gray-900/60 border border-gray-800/50 rounded-xl overflow-hidden">
          <div className={`px-3 py-2.5 border-b flex-shrink-0 ${isLight ? 'border-gray-200' : 'border-gray-800/50'}`}>
            <div className={`flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-gray-200'}`}>
              <Building2 size={16} className="text-blue-500 flex-shrink-0" />
              <div className="min-w-0 flex-1 mr-1">
                <div className="text-sm font-bold truncate leading-tight">{projectName}</div>
                <div className={`text-xs flex items-center gap-2 mt-0.5 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                  <span className="flex items-center gap-1"><Building2 size={10} /> {projectSites.length} {t('dash_sites')}</span>
                  <span className="text-gray-600">·</span>
                  <span className="flex items-center gap-1"><Wifi size={10} /> {projectDevices.length} {t('dash_devices')}</span>
                </div>
              </div>
              <PerformanceScore devices={projectDevices} alarms={projectAlarms} predictions={projectPredictions} sizeClass="h-[44px] w-[44px]" />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-2.5 space-y-2 min-h-0">
            {siteInfos.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-10">{t('dash_no_projects')}</div>
            ) : siteInfos.map(info => (
              <SiteListItem
                key={info.site.id}
                info={info}
                isSelected={info.site.id === selectedSiteId}
                onClick={() => handleSiteClick(info.site)}
              />
            ))}
          </div>
          <StatusSummary sites={siteInfos} />
        </div>

        {/* Center: HK map with overlay header */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0 relative">
          <HKMap
            sites={siteInfos}
            selectedSiteId={selectedSiteId}
            onSelectSite={(id) => {
              setSelectedSiteId(id);
              const s = projectSites.find(ps => ps.id === id);
              if (s) onSelectSite(s);
            }}
            theme={theme}
            lang={lang}
            t={t}
          />
        </div>

        {/* Right: system data, alarms, maintenance */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-3 min-h-0 pl-3">
          <TopTroubleSites theme={theme} />
          <ProjectAlarms alarms={projectAlarms} onViewDetails={onViewAlarms} />
          <ProjectMaintenance predictions={projectPredictions} onViewDetails={onViewMaintenance} />
        </div>
      </div>

      {/* Bottom: contact footer */}
      <ContactFooter />
    </div>
  );
}

// ── Contact Footer ───────────────────────────────────────────────────────────

function ContactFooter() {
  const t = useT();
  return (
    <div className="flex-shrink-0 bg-gradient-to-r from-gray-900/80 via-gray-900/60 to-gray-900/80 border border-gray-800/50 rounded-xl px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/15 border border-red-500/20 flex-shrink-0">
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
