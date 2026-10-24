import { useState, useEffect, useMemo, useRef } from 'react';
import {
  TrendingUp, BarChart3, Download, Filter, ChevronDown, X, Image as ImageIcon,
} from 'lucide-react';
import { fetchNumericDevices, fetchReadings, reportApiError, severityOptions } from '../lib/analytics';
import { apiClient } from '../lib/apiCompat';
import { useT, useLang } from '../lib/i18n';

// ─── Shared types ──────────────────────────────────────────────────────────────

type AnalyticsMode = 'trends' | 'statistics';

// Trends types
interface NumericDevice {
  tag_display: string;
  id: string;
  code: string;
  label: string;
  floor_id: string;
  floor_label: string;
  building_id: string;
  building_name: string;
  building_name_zh: string;
  site_id: string;
  site_name: string;
  site_name_zh: string;
  project_id: string | null;
  project_name: string;
  project_name_zh: string;
  category: string;
  name_en: string;
  unit: string | null;
}

interface Reading {
  recorded_at: string;
  value: number;
  device_id: string;
}

// Statistics types
interface AlarmStatsResult {
  buckets: { bucket_index: number; severity: string; count: number }[];
  labels: string[];
  total_events: number;
  critical_count: number;
  alarm_count: number;
  fault_count: number;
  num_buckets: number;
}

interface ProjectOption { id: string; name: string; name_zh: string }
interface SiteOption { id: string; name: string; name_zh: string; project_id: string | null }
interface BuildingOption { id: string; name: string; name_zh: string; site_id: string }

// ─── Trends constants ──────────────────────────────────────────────────────────

const TRENDS_RANGES = ['1h', '24h', '7d', '1m'] as const;
type TrendsRange = typeof TRENDS_RANGES[number];

const RANGE_MS: Record<TrendsRange, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '1m': 30 * 24 * 60 * 60 * 1000,
};

const CHART_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a78bfa',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
  '#8b5cf6', '#eab308',
];

// ─── Statistics constants ──────────────────────────────────────────────────────

const STATS_RANGES = ['1D', '7D', '30D'] as const;
type StatsRange = typeof STATS_RANGES[number];

const RANGE_BUCKETS: Record<StatsRange, number> = { '1D': 24, '7D': 7, '30D': 30 };

const RANGE_LABEL: Record<StatsRange, string> = {
  '1D': 'Today', '7D': 'Last 7 days', '30D': 'Last 30 days',
};
const RANGE_LABEL_ZH: Record<StatsRange, string> = {
  '1D': '今天', '7D': '最近7天', '30D': '最近30天',
};

const SEVERITY_COLORS: Record<string, string> = {
  alarm: '#ef4444', fault: '#f59e0b',
};
// Critical has a summary total only; v3 has no per-time Critical buckets.
const SEVERITY_ORDER = ['alarm', 'fault'];

// ─── Shared data fetching ──────────────────────────────────────────────────────

async function fetchProjects(): Promise<ProjectOption[]> {
  const { data, error } = await apiClient.from('projects').select('id, name, name_zh').order('name');
  if (error || !data) return [];
  return data as ProjectOption[];
}

async function fetchSites(projectId: string | null): Promise<SiteOption[]> {
  let query = apiClient.from('sites').select('id, name, name_zh, project_id').order('name');
  if (projectId) query = query.eq('project_id', projectId);
  const { data, error } = await query;
  if (error || !data) return [];
  return data as SiteOption[];
}

async function fetchBuildings(siteId: string | null): Promise<BuildingOption[]> {
  let query = apiClient.from('buildings').select('id, name, name_zh, site_id').order('name');
  if (siteId) query = query.eq('site_id', siteId);
  const { data, error } = await query;
  if (error || !data) return [];
  return data as BuildingOption[];
}

async function fetchDeviceCategories(): Promise<string[]> {
  const { data, error } = await apiClient
    .from('device_types').select('category').not('category', 'is', null).order('category');
  if (error || !data) return [];
  return [...new Set(
    (data as { category?: string }[])
      .map(row => row.category)
      .filter((category): category is string => Boolean(category)),
  )];
}

// ─── Trends data fetching ──────────────────────────────────────────────────────

// ─── Statistics data fetching ──────────────────────────────────────────────────

async function fetchAlarmStats(
  range: StatsRange,
  filters: { project: string; site: string; building: string; category: string; deviceCategory: string }
): Promise<AlarmStatsResult | null> {
  const { data, error } = await apiClient.rpc('get_alarm_stats', {
    range_label: range,
    p_project_id: filters.project !== 'all' ? filters.project : null,
    p_site_id: filters.site !== 'all' ? filters.site : null,
    p_building_id: filters.building !== 'all' ? filters.building : null,
    p_category: filters.category !== 'all' ? filters.category : null,
    p_device_category: filters.deviceCategory !== 'all' ? filters.deviceCategory : null,
  });
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as AlarmStatsResult;
}

// ─── Shared UI components ──────────────────────────────────────────────────────

function FilterDropdown({ label, value, options, onChange }: {
  label: string; value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-gray-500">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="appearance-none bg-gray-800/60 border border-gray-700/40 rounded-md pl-2 pr-6 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-400/40 transition-colors w-full"
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      </div>
    </div>
  );
}

function exportChartPng(svgEl: SVGSVGElement | null, filename: string, height = 500) {
  if (!svgEl) return;
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '1120');
  clone.setAttribute('height', String(height));
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%'); bg.setAttribute('fill', '#0f172a');
  clone.insertBefore(bg, clone.firstChild);
  const svgString = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1120; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { URL.revokeObjectURL(url); return; }
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob(pngBlob => {
      if (!pngBlob) return;
      const pngUrl = URL.createObjectURL(pngBlob);
      const a = document.createElement('a');
      a.href = pngUrl; a.download = filename; a.click();
      URL.revokeObjectURL(pngUrl);
    }, 'image/png');
  };
  img.src = url;
}

// ─── Trends chart helpers ──────────────────────────────────────────────────────

function trendsRangeLabel(range: TrendsRange): string {
  switch (range) {
    case '1h': return '1 hr';
    case '24h': return '24 hrs';
    case '7d': return '7 days';
    case '1m': return '1 month';
  }
}

function formatXLabel(t: number, range: TrendsRange): string {
  const d = new Date(t);
  if (range === '1m') return d.toLocaleDateString('en-HK', { month: 'short', day: 'numeric' });
  if (range === '7d') {
    const weekday = d.toLocaleDateString('en-HK', { weekday: 'short' });
    const time = d.toLocaleTimeString('en-HK', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${weekday} ${time}`;
  }
  return d.toLocaleTimeString('en-HK', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : pts.length - 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

function buildAreaPath(linePath: string, pts: { x: number; y: number }[], areaBottom: number): string {
  if (pts.length < 2) return '';
  const last = pts[pts.length - 1];
  const first = pts[0];
  return `${linePath} L${last.x},${areaBottom} L${first.x},${areaBottom} Z`;
}

// ─── SVG line chart ────────────────────────────────────────────────────────────

function SvgLineChart({ readings, devices, visibleIds, range, svgRef }: {
  readings: Reading[];
  devices: NumericDevice[];
  visibleIds: Set<string>;
  range: TrendsRange;
  svgRef?: React.RefObject<SVGSVGElement>;
}) {
  const W = 560; const H = 210;
  const PAD = { top: 16, right: 16, bottom: 50, left: 52 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const filtered = readings.filter(r => visibleIds.has(r.device_id));
  if (filtered.length === 0) return null;

  const now = Date.now();
  const minT = now - RANGE_MS[range];
  const maxT = now;
  const rangeT = maxT - minT;

  const vals = filtered.map(r => r.value);
  let minV = Math.min(...vals);
  let maxV = Math.max(...vals);
  const vPad = (maxV - minV) * 0.1 || 1;
  minV -= vPad; maxV += vPad;
  const rangeV = maxV - minV || 1;

  const px = (t: number) => PAD.left + ((t - minT) / rangeT) * innerW;
  const py = (v: number) => PAD.top + (1 - (v - minV) / rangeV) * innerH;

  const seriesMap: Record<string, Reading[]> = {};
  for (const r of filtered) {
    if (!seriesMap[r.device_id]) seriesMap[r.device_id] = [];
    seriesMap[r.device_id].push(r);
  }

  const deviceIndex = new Map(devices.map((d, i) => [d.id, i]));
  const visibleDevices = devices.filter(d => visibleIds.has(d.id));
  const uniqueUnits = new Set(visibleDevices.map(d => d.unit).filter(Boolean));
  const yLabel = uniqueUnits.size === 1 ? [...uniqueUnits][0]! : 'Value';

  const legendEntries = visibleDevices.map(d => ({
    label: d.tag_display,
    color: CHART_COLORS[(deviceIndex.get(d.id) ?? 0) % CHART_COLORS.length],
  }));
  const legendMaxLen = Math.max(...legendEntries.map(e => e.label.length), 0);
  const legendW = Math.min(14 + legendMaxLen * 4.2 + 8, 130);
  const legendH = legendEntries.length * 11 + 6;
  const legendX = W - PAD.right - legendW - 2;
  const legendY = PAD.top + 2;

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        {CHART_COLORS.map((color, i) => (
          <linearGradient key={i} id={`area-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        ))}
        <filter id="line-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.25" />
        </filter>
      </defs>
      {Array.from({ length: 5 }, (_, i) => {
        const v = minV + (rangeV * i) / 4;
        const y = py(v);
        return (
          <g key={`y-${i}`}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#1f2937" strokeWidth="0.5" strokeDasharray="2 3" opacity="0.6" />
            <text x={PAD.left - 6} y={y + 3} fill="#6b7280" fontSize="8.5" textAnchor="end" fontFamily="monospace">{Math.round(v * 10) / 10}</text>
          </g>
        );
      })}
      {Array.from({ length: 5 }, (_, i) => {
        const t = minT + (rangeT * i) / 4;
        const x = px(t);
        return (
          <g key={`x-${i}`}>
            <line x1={x} y1={PAD.top} x2={x} y2={H - PAD.bottom} stroke="#1f2937" strokeWidth="0.5" strokeDasharray="2 3" opacity="0.6" />
            <text x={x} y={H - PAD.bottom + 14} fill="#6b7280" fontSize="8.5" textAnchor="middle" fontFamily="monospace">{formatXLabel(t, range)}</text>
          </g>
        );
      })}
      <text x={PAD.left + innerW / 2} y={H - 6} fill="#9ca3af" fontSize="9" textAnchor="middle" fontWeight="500">{`Time (${trendsRangeLabel(range)})`}</text>
      <text x={-PAD.top - innerH / 2} y={12} fill="#9ca3af" fontSize="9" textAnchor="middle" fontWeight="500" transform="rotate(-90)">{yLabel}</text>
      {legendEntries.length > 0 && (
        <g transform={`translate(${legendX}, ${legendY})`}>
          <rect width={legendW} height={legendH} fill="rgba(15,23,42,0.75)" rx="3" stroke="#374151" strokeWidth="0.5" />
          {legendEntries.map((e, i) => (
            <g key={i} transform={`translate(5, ${i * 11 + 9})`}>
              <line x1="0" y1="0" x2="8" y2="0" stroke={e.color} strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="4" cy="0" r="1.5" fill={e.color} />
              <text x="12" y="3" fill="#9ca3af" fontSize="8" fontFamily="monospace">{e.label}</text>
            </g>
          ))}
        </g>
      )}
      {Object.entries(seriesMap).map(([deviceId, pts]) => {
        if (pts.length < 2) return null;
        const ci = (deviceIndex.get(deviceId) ?? 0) % CHART_COLORS.length;
        const color = CHART_COLORS[ci];
        const coords = pts.map(r => ({ x: px(new Date(r.recorded_at).getTime()), y: py(r.value) }));
        const linePath = smoothPath(coords);
        const areaPath = buildAreaPath(linePath, coords, H - PAD.bottom);
        return (
          <g key={deviceId}>
            <path d={areaPath} fill={`url(#area-grad-${ci})`} opacity="0.8" />
            <path d={linePath} fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" filter="url(#line-shadow)" />
            {coords.map((c, i) => i === coords.length - 1 ? (
              <circle key={`dot-${i}`} cx={c.x} cy={c.y} r="2" fill={color} stroke="#0f172a" strokeWidth="0.5" />
            ) : null)}
          </g>
        );
      })}
    </svg>
  );
}

// ─── SVG stacked bar chart ─────────────────────────────────────────────────────

function SvgBarChart({ buckets, bucketLabels, series, range, chartTitle, svgRef }: {
  buckets: number;
  bucketLabels: string[];
  series: { label: string; color: string; counts: number[] }[];
  range: StatsRange;
  chartTitle: string;
  svgRef?: React.RefObject<SVGSVGElement>;
}) {
  const W = 560; const H = 270;
  const PAD = { top: 38, right: 16, bottom: 50, left: 52 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const bucketW = innerW / buckets;
  const barW = Math.min(bucketW * 0.7, 20);
  const maxCount = Math.max(1, ...Array.from({ length: buckets }, (_, i) => series.reduce((sum, s) => sum + (s.counts[i] ?? 0), 0)));
  const niceMax = Math.ceil(maxCount / 5) * 5 || 5;
  const py = (v: number) => PAD.top + (1 - v / niceMax) * innerH;
  const px = (i: number) => PAD.left + i * bucketW + bucketW / 2;

  const legendEntries = series.map(s => ({
    label: s.label, color: s.color, total: s.counts.reduce((a, b) => a + b, 0),
  }));
  const legendMaxLen = Math.max(...legendEntries.map(e => (e.label + ' (' + e.total.toLocaleString() + ')').length), 0);
  const legendW = Math.min(14 + legendMaxLen * 4.5 + 8, 180);
  const legendH = legendEntries.length * 12 + 6;
  const legendX = W - PAD.right - legendW - 2;
  const legendY = PAD.top + 2;
  const todayDateStr = new Date().toLocaleDateString('en-HK', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <text x={W / 2} y={12} fill="#ffffff" fontSize="8" fontWeight="600" textAnchor="middle" fontFamily="monospace">{chartTitle}</text>
      {Array.from({ length: 6 }, (_, i) => {
        const v = (niceMax * i) / 5;
        const y = py(v);
        return (
          <g key={`y-${i}`}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#1f2937" strokeWidth="0.5" strokeDasharray="2 3" opacity="0.6" />
            <text x={PAD.left - 6} y={y + 3} fill="#ffffff" fontSize="8.5" textAnchor="end" fontFamily="monospace">{Math.round(v)}</text>
          </g>
        );
      })}
      {Array.from({ length: buckets }, (_, i) => {
        const showLabel = buckets <= 8 || i % Math.ceil(buckets / 8) === 0 || i === buckets - 1;
        if (!showLabel) return null;
        const x = px(i);
        return (
          <text key={`x-${i}`} x={x} y={H - PAD.bottom + 14} fill="#ffffff" fontSize="8" textAnchor="middle" fontFamily="monospace" transform={`rotate(-25 ${x} ${H - PAD.bottom + 14})`}>
            {bucketLabels[i]}
          </text>
        );
      })}
      {Array.from({ length: buckets }, (_, i) => {
        let cumulative = 0;
        const cx = px(i);
        return (
          <g key={`bar-${i}`}>
            {series.map((s, si) => {
              const count = s.counts[i] ?? 0;
              if (count === 0) return null;
              const yTop = py(cumulative + count);
              const yBot = py(cumulative);
              cumulative += count;
              return (
                <rect key={`seg-${si}`} x={cx - barW / 2} y={yTop} width={barW} height={Math.max(0, yBot - yTop)} fill={s.color} rx={si === series.length - 1 ? 1.5 : 0} opacity="0.9" />
              );
            })}
          </g>
        );
      })}
      <text x={PAD.left + innerW / 2} y={H - 6} fill="#ffffff" fontSize="9" textAnchor="middle" fontWeight="500">
        {range === '1D' ? `Today (${todayDateStr}) - Hourly` : `Time (${RANGE_LABEL[range]})`}
      </text>
      <text x={-PAD.top - innerH / 2} y={12} fill="#ffffff" fontSize="9" textAnchor="middle" fontWeight="500" transform="rotate(-90)">Count</text>
      {legendEntries.length > 0 && (
        <g transform={`translate(${legendX}, ${legendY})`}>
          <rect width={legendW} height={legendH} fill="rgba(15,23,42,0.75)" rx="3" stroke="#374151" strokeWidth="0.5" />
          {legendEntries.map((e, i) => (
            <g key={i} transform={`translate(5, ${i * 12 + 10})`}>
              <rect x="0" y="-4" width="8" height="6" fill={e.color} rx="1" />
              <text x="12" y="2" fill="#ffffff" fontSize="8" fontFamily="monospace">{e.label} ({e.total.toLocaleString()})</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

// ─── CSV export (trends only) ──────────────────────────────────────────────────

function exportCsv(readings: Reading[], devices: NumericDevice[]) {
  const deviceMap = new Map(devices.map(d => [d.id, d]));
  const rows = ['Time,Device Code,Device Name,Unit,Value'];
  for (const r of readings) {
    const d = deviceMap.get(r.device_id);
    rows.push([r.recorded_at, d?.code ?? r.device_id, d?.name_en ?? '', d?.unit ?? '', r.value].join(','));
  }
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `trends_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ─── Mode toggle ───────────────────────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: AnalyticsMode; onChange: (m: AnalyticsMode) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-gray-800/60 p-0.5 border border-gray-700/40">
      <button
        onClick={() => onChange('trends')}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
          mode === 'trends'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-gray-400 hover:text-gray-300'
        }`}
      >
        <TrendingUp size={12} />
        Device Trends
      </button>
      <button
        onClick={() => onChange('statistics')}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
          mode === 'statistics'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-gray-400 hover:text-gray-300'
        }`}
      >
        <BarChart3 size={12} />
        Alarm Statistics
      </button>
    </div>
  );
}

// ─── Trends sub-panel ──────────────────────────────────────────────────────────

function TrendsView() {
  const t = useT();
  const { lang } = useLang();

  const [range, setRange] = useState<TrendsRange>('24h');
  const [allDevices, setAllDevices] = useState<NumericDevice[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [loadingReadings, setLoadingReadings] = useState(false);

  const [filterProject, setFilterProject] = useState('all');
  const [filterSite, setFilterSite] = useState('all');
  const [filterBuilding, setFilterBuilding] = useState('all');
  const [filterFloor, setFilterFloor] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string> | null>(null);
  const [initialSelectionDone, setInitialSelectionDone] = useState(false);
  const chartSvgRef = useRef<SVGSVGElement>(null);

  const localName = (nameEn: string, nameZh?: string | null) => lang === 'en' ? nameEn : (nameZh || nameEn);

  useEffect(() => {
    let cancelled = false;
    setLoadingDevices(true);
    fetchNumericDevices().then(rows => {
      if (cancelled) return;
      setAllDevices(rows);
      if (rows.length) { setSelectedDeviceIds(new Set([rows[0].id])); setInitialSelectionDone(true); }
    }).catch(reportApiError).finally(() => { if (!cancelled) setLoadingDevices(false); });
    return () => { cancelled = true; };
  }, []);

  function handleProjectChange(v: string) { setFilterProject(v); setFilterSite('all'); setFilterBuilding('all'); setFilterFloor('all'); setSelectedDeviceIds(null); setInitialSelectionDone(false); }
  function handleSiteChange(v: string) { setFilterSite(v); setFilterBuilding('all'); setFilterFloor('all'); setSelectedDeviceIds(null); setInitialSelectionDone(false); }
  function handleBuildingChange(v: string) { setFilterBuilding(v); setFilterFloor('all'); setSelectedDeviceIds(null); setInitialSelectionDone(false); }
  function handleFloorChange(v: string) { setFilterFloor(v); setSelectedDeviceIds(null); setInitialSelectionDone(false); }
  function handleCategoryChange(v: string) { setFilterCategory(v); setFilterBuilding('all'); setFilterFloor('all'); setSelectedDeviceIds(null); setInitialSelectionDone(false); }

  const devicesForBuildingFilter = useMemo(() => {
    let r = allDevices;
    if (filterProject !== 'all') r = r.filter(d => d.project_id === filterProject);
    if (filterSite !== 'all') r = r.filter(d => d.site_id === filterSite);
    if (filterCategory !== 'all') r = r.filter(d => d.category === filterCategory);
    return r;
  }, [allDevices, filterProject, filterSite, filterCategory]);

  const projectOptions = useMemo(() => {
    const seen = new Map<string, { name: string; name_zh: string }>();
    for (const d of allDevices) { if (d.project_id && !seen.has(d.project_id)) seen.set(d.project_id, { name: d.project_name, name_zh: d.project_name_zh }); }
    return [{ value: 'all', label: t('all_projects') }, ...[...seen.entries()].map(([id, n]) => ({ value: id, label: localName(n.name, n.name_zh) }))];
  }, [allDevices, lang]);

  const siteOptions = useMemo(() => {
    let devs = allDevices;
    if (filterProject !== 'all') devs = devs.filter(d => d.project_id === filterProject);
    const seen = new Map<string, { name: string; name_zh: string }>();
    for (const d of devs) { if (!seen.has(d.site_id)) seen.set(d.site_id, { name: d.site_name, name_zh: d.site_name_zh }); }
    return [{ value: 'all', label: t('all_sites') }, ...[...seen.entries()].map(([id, n]) => ({ value: id, label: localName(n.name, n.name_zh) }))];
  }, [allDevices, filterProject, lang]);

  const buildingOptions = useMemo(() => {
    const seen = new Map<string, { name: string; name_zh: string }>();
    for (const d of devicesForBuildingFilter) { if (!seen.has(d.building_id)) seen.set(d.building_id, { name: d.building_name, name_zh: d.building_name_zh }); }
    return [{ value: 'all', label: t('all_buildings') }, ...[...seen.entries()].map(([id, n]) => ({ value: id, label: localName(n.name, n.name_zh) }))];
  }, [devicesForBuildingFilter, lang]);

  const floorOptions = useMemo(() => {
    let devs = devicesForBuildingFilter;
    if (filterBuilding !== 'all') devs = devs.filter(d => d.building_id === filterBuilding);
    const seen = new Map<string, string>();
    for (const d of devs) { if (!seen.has(d.floor_id)) seen.set(d.floor_id, d.floor_label || d.floor_id); }
    return [{ value: 'all', label: t('all_blocks') }, ...[...seen.entries()].map(([id, label]) => ({ value: id, label }))];
  }, [devicesForBuildingFilter, filterBuilding, lang]);

  const scopedDevices = useMemo(() => {
    let r = allDevices;
    if (filterProject !== 'all') r = r.filter(d => d.project_id === filterProject);
    if (filterSite !== 'all') r = r.filter(d => d.site_id === filterSite);
    if (filterBuilding !== 'all') r = r.filter(d => d.building_id === filterBuilding);
    if (filterFloor !== 'all') r = r.filter(d => d.floor_id === filterFloor);
    if (filterCategory !== 'all') r = r.filter(d => d.category === filterCategory);
    return [...r].sort((a, b) => {
      const uA = a.unit ?? 'zzz'; const uB = b.unit ?? 'zzz';
      return uA !== uB ? uA.localeCompare(uB) : a.code.localeCompare(b.code);
    });
  }, [allDevices, filterProject, filterSite, filterBuilding, filterFloor, filterCategory]);

  const categoryOptions = useMemo(() => {
    let devs = allDevices;
    if (filterProject !== 'all') devs = devs.filter(d => d.project_id === filterProject);
    if (filterSite !== 'all') devs = devs.filter(d => d.site_id === filterSite);
    const cats = Array.from(new Set(devs.map(d => d.category))).sort();
    return [{ value: 'all', label: t('all_categories') }, ...cats.map(c => ({ value: c, label: t(c) || c }))];
  }, [allDevices, filterProject, filterSite, lang]);

  useEffect(() => {
    if (!initialSelectionDone && scopedDevices.length > 0 && !loadingDevices) {
      setSelectedDeviceIds(new Set([scopedDevices[0].id]));
      setInitialSelectionDone(true);
    }
  }, [scopedDevices, initialSelectionDone, loadingDevices]);

  const activeDeviceIds = useMemo(() => {
    const scopedIds = new Set(scopedDevices.map(d => d.id));
    if (selectedDeviceIds === null) return scopedIds;
    return new Set([...selectedDeviceIds].filter(id => scopedIds.has(id)));
  }, [scopedDevices, selectedDeviceIds]);

  function toggleDevice(id: string) {
    if (selectedDeviceIds === null) {
      const next = new Set(scopedDevices.map(d => d.id)); next.delete(id); setSelectedDeviceIds(next);
    } else {
      const next = new Set(selectedDeviceIds);
      if (next.has(id)) next.delete(id); else next.add(id);
      setSelectedDeviceIds(next.size === scopedDevices.length ? null : next);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setReadings([]);
    if (activeDeviceIds.size === 0) { setLoadingReadings(false); return; }
    setLoadingReadings(true);
    fetchReadings([...activeDeviceIds], range).then(rows => {
      if (!cancelled) setReadings(rows);
    }).catch(reportApiError).finally(() => { if (!cancelled) setLoadingReadings(false); });
    return () => { cancelled = true; };
  }, [activeDeviceIds, range]);

  const readingsForActiveDevices = useMemo(() => readings.filter(r => activeDeviceIds.has(r.device_id)), [readings, activeDeviceIds]);
  const hasData = readingsForActiveDevices.length > 0;
  const loading = loadingDevices || loadingReadings;

  const deviceColorMap = useMemo(() => {
    const map = new Map<string, string>();
    allDevices.forEach((d, i) => map.set(d.id, CHART_COLORS[i % CHART_COLORS.length]));
    return map;
  }, [allDevices]);

  return (
    <div className="flex flex-col h-full gap-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0 flex-wrap gap-2">
        <div className="flex gap-1">
          {TRENDS_RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)} className={`text-xs px-2 py-0.5 rounded transition-colors ${range === r ? 'bg-blue-500 text-white' : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50'}`}>{r}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportCsv(readingsForActiveDevices, scopedDevices)} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-gray-700/50 text-gray-400 hover:bg-gray-600/50 transition-colors">
            <Download size={10} />{t('export_csv')}
          </button>
          <button onClick={() => exportChartPng(chartSvgRef.current, `trends_chart_${new Date().toISOString().slice(0, 10)}.png`, 420)} disabled={!hasData} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-gray-700/50 text-gray-400 hover:bg-gray-600/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <ImageIcon size={10} />PNG
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-end gap-2 mb-2 flex-shrink-0 flex-wrap">
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500 pb-1.5"><Filter size={11} /></span>
        <FilterDropdown label={t('filter_project')} value={filterProject} options={projectOptions} onChange={handleProjectChange} />
        <FilterDropdown label={t('filter_site')} value={filterSite} options={siteOptions} onChange={handleSiteChange} />
        <FilterDropdown label={t('filter_category')} value={filterCategory} options={categoryOptions} onChange={handleCategoryChange} />
        <FilterDropdown label={t('filter_building')} value={filterBuilding} options={buildingOptions} onChange={handleBuildingChange} />
        <FilterDropdown label={t('filter_block')} value={filterFloor} options={floorOptions} onChange={handleFloorChange} />
      </div>

      {/* Device pills */}
      {scopedDevices.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2 flex-shrink-0">
          <button onClick={() => setSelectedDeviceIds(null)} className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${selectedDeviceIds === null ? 'border-blue-400/50 bg-blue-500/10 text-blue-300' : 'border-gray-700/40 text-gray-500 hover:text-gray-400'}`}>
            {t('all_devices')}
          </button>
          <button onClick={() => setSelectedDeviceIds(new Set())} className={`flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full border transition-colors ${selectedDeviceIds !== null && selectedDeviceIds.size === 0 ? 'border-red-400/50 bg-red-500/10 text-red-300' : 'border-gray-700/40 text-gray-500 hover:text-gray-400'}`}>
            <X size={9} />{lang === 'en' ? 'Clear' : '清除'}
          </button>
          {scopedDevices.map(d => {
            const color = deviceColorMap.get(d.id) ?? '#6b7280';
            const active = activeDeviceIds.has(d.id);
            return (
              <button key={d.id} onClick={() => toggleDevice(d.id)} className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-colors ${active ? 'border-gray-600/60 text-gray-300 bg-gray-800/60' : 'border-gray-800/40 text-gray-600 bg-transparent'}`}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: active ? color : '#374151' }} />
                {d.tag_display}
              </button>
            );
          })}
        </div>
      )}

      {/* Chart */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">{lang === 'en' ? 'Loading...' : lang === 'zh-CN' ? '加载中...' : '載入中...'}</div>
        ) : scopedDevices.length === 0 ? (
          <div className="flex items-center justify-center h-full flex-col gap-2">
            <TrendingUp size={24} className="text-gray-600" />
            <p className="text-gray-500 text-sm text-center">{lang === 'en' ? 'No sensor devices with readings match the selected filters' : lang === 'zh-CN' ? '没有符合筛选条件且有读数的传感器设备' : '沒有符合篩選條件且有讀數的感測器設備'}</p>
          </div>
        ) : !hasData ? (
          <div className="flex items-center justify-center h-full flex-col gap-2">
            <TrendingUp size={24} className="text-gray-600" />
            <p className="text-gray-500 text-sm text-center">{lang === 'en' ? 'No historical readings returned for this selection' : lang === 'zh-CN' ? '后端未返回当前选择的历史读数' : '後端未返回目前選擇的歷史讀數'}</p>
          </div>
        ) : (
          <SvgLineChart readings={readingsForActiveDevices} devices={scopedDevices} visibleIds={activeDeviceIds} range={range} svgRef={chartSvgRef} />
        )}
      </div>
    </div>
  );
}

// ─── Statistics sub-panel ──────────────────────────────────────────────────────

function StatisticsView() {
  const t = useT();
  const { lang } = useLang();

  const [range, setRange] = useState<StatsRange>('7D');
  const [stats, setStats] = useState<AlarmStatsResult | null>(null);
  const [loading, setLoading] = useState(true);

  const [filterProject, setFilterProject] = useState('all');
  const [filterSite, setFilterSite] = useState('all');
  const [filterBuilding, setFilterBuilding] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterDeviceCategory, setFilterDeviceCategory] = useState('all');
  const chartSvgRef = useRef<SVGSVGElement>(null);

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [deviceCategories, setDeviceCategories] = useState<string[]>([]);

  const localName = (nameEn: string, nameZh?: string | null) => lang === 'en' ? nameEn : (nameZh || nameEn);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setStats(null);
    fetchAlarmStats(range, { project: filterProject, site: filterSite, building: filterBuilding, category: filterCategory, deviceCategory: filterDeviceCategory })
      .then(rows => { if (!cancelled) setStats(rows); })
      .catch(reportApiError).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range, filterProject, filterSite, filterBuilding, filterCategory, filterDeviceCategory]);

  useEffect(() => { fetchProjects().then(setProjects); }, []);
  useEffect(() => { fetchSites(filterProject !== 'all' ? filterProject : null).then(setSites); }, [filterProject]);
  useEffect(() => { fetchBuildings(filterSite !== 'all' ? filterSite : null).then(setBuildings); }, [filterSite]);
  useEffect(() => { fetchDeviceCategories().then(setDeviceCategories); }, []);

  function handleProjectChange(v: string) { setFilterProject(v); setFilterSite('all'); setFilterBuilding('all'); }
  function handleSiteChange(v: string) { setFilterSite(v); setFilterBuilding('all'); }

  const projectOptions = useMemo(() => [
    { value: 'all', label: lang === 'en' ? 'All Projects' : lang === 'zh-CN' ? '所有项目' : '所有項目' },
    ...projects.map(p => ({ value: p.id, label: localName(p.name, p.name_zh) })),
  ], [projects, lang]);

  const siteOptions = useMemo(() => [
    { value: 'all', label: t('all_sites') },
    ...sites.map(s => ({ value: s.id, label: localName(s.name, s.name_zh) })),
  ], [sites, lang, t]);

  const buildingOptions = useMemo(() => [
    { value: 'all', label: t('all_buildings') },
    ...buildings.map(b => ({ value: b.id, label: localName(b.name, b.name_zh) })),
  ], [buildings, lang, t]);

  const deviceCategoryOptions = useMemo(() => [
    { value: 'all', label: lang === 'en' ? 'All Categories' : lang === 'zh-CN' ? '所有设备类别' : '所有設備類別' },
    ...deviceCategories.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
  ], [deviceCategories, lang]);

  const categoryOptions = useMemo(() => severityOptions(lang), [lang]);

  const { bucketCounts, bucketLabels, totalBuckets } = useMemo(() => {
    if (!stats) return { bucketCounts: [[], [], [], []] as number[][], bucketLabels: [] as string[], totalBuckets: RANGE_BUCKETS[range] };
    const nBuckets = stats.num_buckets;
    const counts = SEVERITY_ORDER.map(() => Array(nBuckets).fill(0));
    for (const b of stats.buckets) {
      const si = SEVERITY_ORDER.indexOf(b.severity);
      if (si >= 0 && b.bucket_index >= 0 && b.bucket_index < nBuckets) counts[si][b.bucket_index] = b.count;
    }
    return { bucketCounts: counts, bucketLabels: stats.labels, totalBuckets: nBuckets };
  }, [stats, range]);

  const chartSeries = useMemo(() => SEVERITY_ORDER.map((s, i) => ({
    label: s.charAt(0).toUpperCase() + s.slice(1), color: SEVERITY_COLORS[s], counts: bucketCounts[i],
  })).filter(s => s.counts.some(c => c > 0)), [bucketCounts]);

  const hasData = (stats?.total_events ?? 0) > 0;
  const totalAlarms = stats?.total_events ?? '—';
  const criticalCount = stats?.critical_count ?? '—';
  const alarmCount = stats?.alarm_count ?? '—';
  const faultCount = stats?.fault_count ?? '—';

  const dynamicTitle = useMemo(() => {
    const parts: string[] = [];
    if (filterProject !== 'all') parts.push(projectOptions.find(p => p.value === filterProject)?.label ?? '');
    if (filterSite !== 'all') parts.push(siteOptions.find(s => s.value === filterSite)?.label ?? '');
    if (filterBuilding !== 'all') parts.push(buildingOptions.find(b => b.value === filterBuilding)?.label ?? '');
    if (filterDeviceCategory !== 'all') parts.push(deviceCategoryOptions.find(c => c.value === filterDeviceCategory)?.label ?? '');
    if (filterCategory !== 'all') parts.push(categoryOptions.find(c => c.value === filterCategory)?.label ?? '');
    const prefix = lang === 'en' ? 'Alarm Statistics' : lang === 'zh-CN' ? '报警统计' : '報警統計';
    if (parts.length === 0) return prefix;
    return `${prefix}${lang === 'en' ? ' on ' : ' - '}${parts.join(' / ')}`;
  }, [filterProject, filterSite, filterBuilding, filterCategory, filterDeviceCategory, projectOptions, siteOptions, buildingOptions, categoryOptions, deviceCategoryOptions, lang]);

  const rangeLabelLocalized = (r: StatsRange) => lang === 'en' ? RANGE_LABEL[r] : RANGE_LABEL_ZH[r];

  return (
    <div className="flex flex-col h-full gap-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0 flex-wrap gap-2">
        <div className="flex gap-1">
          {STATS_RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)} className={`text-xs px-2 py-0.5 rounded transition-colors ${range === r ? 'bg-blue-500 text-white' : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50'}`}>{r}</button>
          ))}
        </div>
        <button onClick={() => exportChartPng(chartSvgRef.current, `statistics_chart_${new Date().toISOString().slice(0, 10)}.png`, 500)} disabled={!hasData} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-gray-700/50 text-gray-400 hover:bg-gray-600/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
          <ImageIcon size={10} />PNG
        </button>
      </div>

      {/* KPI cards */}
      <div className="flex gap-2 mb-2 flex-shrink-0">
        {[
          { label: lang === 'en' ? 'Total Events' : lang === 'zh-CN' ? '总事件' : '總事件', value: totalAlarms, color: 'text-gray-200', border: 'border-gray-800/40', bg: 'bg-gray-900/60' },
          { label: lang === 'en' ? 'Critical' : lang === 'zh-CN' ? '严重' : '嚴重', value: criticalCount, color: 'text-red-400', border: 'border-red-800/40', bg: 'bg-red-900/10' },
          { label: lang === 'en' ? 'Alarms' : lang === 'zh-CN' ? '报警' : '報警', value: alarmCount, color: 'text-orange-400', border: 'border-orange-800/40', bg: 'bg-orange-900/10' },
          { label: lang === 'en' ? 'Faults' : lang === 'zh-CN' ? '故障' : '故障', value: faultCount, color: 'text-yellow-400', border: 'border-yellow-800/40', bg: 'bg-yellow-900/10' },
        ].map(card => (
          <div key={card.label} className={`flex-1 rounded-lg border ${card.border} ${card.bg} px-3 py-1.5`}>
            <div className="text-[10px] uppercase tracking-wider text-gray-500">
              {card.label}<span className="text-gray-600 normal-case font-normal ml-1">({rangeLabelLocalized(range)})</span>
            </div>
            <div className={`text-lg font-bold ${card.color}`}>{card.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-end gap-2 mb-2 flex-shrink-0 flex-wrap">
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500 pb-1.5"><Filter size={11} /></span>
        <FilterDropdown label={t('filter_project')} value={filterProject} options={projectOptions} onChange={handleProjectChange} />
        <FilterDropdown label={t('filter_site')} value={filterSite} options={siteOptions} onChange={handleSiteChange} />
        <FilterDropdown label={t('filter_building')} value={filterBuilding} options={buildingOptions} onChange={setFilterBuilding} />
        <FilterDropdown label={lang === 'en' ? 'Device Category' : lang === 'zh-CN' ? '设备类别' : '設備類別'} value={filterDeviceCategory} options={deviceCategoryOptions} onChange={setFilterDeviceCategory} />
        <FilterDropdown label={lang === 'en' ? 'Severity / Type' : lang === 'zh-CN' ? '严重程度 / 类型' : '嚴重程度 / 類型'} value={filterCategory} options={categoryOptions} onChange={setFilterCategory} />
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">{lang === 'en' ? 'Loading...' : lang === 'zh-CN' ? '加载中...' : '載入中...'}</div>
        ) : !hasData ? (
          <div className="flex items-center justify-center h-full flex-col gap-2">
            <BarChart3 size={24} className="text-gray-600" />
            <p className="text-gray-500 text-sm text-center">{lang === 'en' ? 'No alarm events match the selected filters' : lang === 'zh-CN' ? '没有符合筛选条件的报警事件' : '沒有符合篩選條件的報警事件'}</p>
          </div>
        ) : (
          <SvgBarChart buckets={totalBuckets} bucketLabels={bucketLabels} series={chartSeries} range={range} chartTitle={dynamicTitle} svgRef={chartSvgRef} />
        )}
      </div>
    </div>
  );
}

// ─── Main exported panel ───────────────────────────────────────────────────────

export function AnalyticsPanel({ initialMode = 'statistics' }: { initialMode?: AnalyticsMode }) {
  const [mode, setMode] = useState<AnalyticsMode>(initialMode);

  return (
    <div className="flex flex-col h-full gap-0">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <ModeToggle mode={mode} onChange={setMode} />
      </div>
      <div className="flex-1 min-h-0">
        {mode === 'trends' ? <TrendsView /> : <StatisticsView />}
      </div>
    </div>
  );
}
