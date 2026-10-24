import { severityOptions, reportApiError } from '../lib/analytics';
import { useState, useEffect, useMemo, useRef } from 'react';
import { BarChart3, Filter, ChevronDown, Image as ImageIcon } from 'lucide-react';
import { apiClient } from '../lib/apiCompat';
import { useT, useLang } from '../lib/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ─────────────────────────────────────────────────────────────────

const TIME_RANGES = ['1D', '7D', '30D'] as const;
type TimeRange = typeof TIME_RANGES[number];

const RANGE_BUCKETS: Record<TimeRange, number> = {
  '1D': 24,
  '7D': 7,
  '30D': 30,
};

const RANGE_LABEL: Record<TimeRange, string> = {
  '1D': 'Today',
  '7D': 'Last 7 days',
  '30D': 'Last 30 days',
};

const RANGE_LABEL_ZH: Record<TimeRange, string> = {
  '1D': '今天',
  '7D': '最近7天',
  '30D': '最近30天',
};

function rangeLabelLocalized(range: TimeRange, lang: string): string {
  return lang === 'en' ? RANGE_LABEL[range] : RANGE_LABEL_ZH[range];
}

function rangeLabel(range: TimeRange): string {
  return RANGE_LABEL[range];
}

const SEVERITY_COLORS: Record<string, string> = {
  alarm: '#ef4444',
  fault: '#f59e0b',
};

// Critical has a summary total only; v3 has no per-time Critical buckets.
const SEVERITY_ORDER = ['alarm', 'fault'];

// ─── Data fetching ──────────────────────────────────────────────────────────────

async function fetchAlarmStats(
  range: TimeRange,
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

async function fetchProjects(): Promise<ProjectOption[]> {
  const { data, error } = await apiClient
    .from('projects')
    .select('id, name, name_zh')
    .order('name');
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
    .from('device_types')
    .select('category')
    .not('category', 'is', null)
    .order('category');
  if (error || !data) return [];
  return [...new Set(
    (data as { category?: string }[])
      .map(row => row.category)
      .filter((category): category is string => Boolean(category)),
  )];
}

// ─── Filter dropdown ────────────────────────────────────────────────────────────

function FilterDropdown({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
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

// ─── SVG stacked bar chart ──────────────────────────────────────────────────────

function SvgBarChart({
  buckets,
  bucketLabels,
  series,
  range,
  chartTitle,
  svgRef,
}: {
  buckets: number;
  bucketLabels: string[];
  series: { label: string; color: string; counts: number[] }[];
  range: TimeRange;
  chartTitle: string;
  svgRef?: React.RefObject<SVGSVGElement>;
}) {
  const W = 560; const H = 270;
  const PAD = { top: 38, right: 16, bottom: 50, left: 52 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const bucketW = innerW / buckets;
  const barW = Math.min(bucketW * 0.7, 20);

  const maxCount = Math.max(
    1,
    ...Array.from({ length: buckets }, (_, i) =>
      series.reduce((sum, s) => sum + (s.counts[i] ?? 0), 0)
    )
  );

  const niceMax = Math.ceil(maxCount / 5) * 5 || 5;

  const py = (v: number) => PAD.top + (1 - v / niceMax) * innerH;
  const px = (i: number) => PAD.left + i * bucketW + bucketW / 2;

  // Legend with counts
  const legendEntries = series.map(s => ({
    label: s.label,
    color: s.color,
    total: s.counts.reduce((a, b) => a + b, 0),
  }));
  const legendMaxLen = Math.max(...legendEntries.map(e => (e.label + ' (' + e.total.toLocaleString() + ')').length), 0);
  const legendW = Math.min(14 + legendMaxLen * 4.5 + 8, 180);
  const legendH = legendEntries.length * 12 + 6;
  const legendX = W - PAD.right - legendW - 2;
  const legendY = PAD.top + 2;

  const todayDateStr = new Date().toLocaleDateString('en-HK', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {/* Chart title */}
      <text x={W / 2} y={12} fill="#ffffff" fontSize="8" fontWeight="600" textAnchor="middle" fontFamily="monospace">
        {chartTitle}
      </text>
      {Array.from({ length: 6 }, (_, i) => {
        const v = (niceMax * i) / 5;
        const y = py(v);
        return (
          <g key={`y-${i}`}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke="#1f2937" strokeWidth="0.5" strokeDasharray="2 3" opacity="0.6" />
            <text x={PAD.left - 6} y={y + 3} fill="#ffffff" fontSize="8.5" textAnchor="end" fontFamily="monospace">
              {Math.round(v)}
            </text>
          </g>
        );
      })}

      {Array.from({ length: buckets }, (_, i) => {
        const showLabel = buckets <= 8 || i % Math.ceil(buckets / 8) === 0 || i === buckets - 1;
        if (!showLabel) return null;
        const x = px(i);
        return (
          <text key={`x-${i}`} x={x} y={H - PAD.bottom + 14}
            fill="#ffffff" fontSize="8" textAnchor="middle" fontFamily="monospace"
            transform={`rotate(-25 ${x} ${H - PAD.bottom + 14})`}>
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
                <rect
                  key={`seg-${si}`}
                  x={cx - barW / 2}
                  y={yTop}
                  width={barW}
                  height={Math.max(0, yBot - yTop)}
                  fill={s.color}
                  rx={si === series.length - 1 ? 1.5 : 0}
                  opacity="0.9"
                />
              );
            })}
          </g>
        );
      })}

      <text x={PAD.left + innerW / 2} y={H - 6}
        fill="#ffffff" fontSize="9" textAnchor="middle" fontWeight="500">
        {range === '1D' ? `Today (${todayDateStr}) - Hourly` : `Time (${rangeLabel(range)})`}
      </text>

      <text x={-PAD.top - innerH / 2} y={12}
        fill="#ffffff" fontSize="9" textAnchor="middle" fontWeight="500"
        transform="rotate(-90)">
        Count
      </text>

      {legendEntries.length > 0 && (
        <g transform={`translate(${legendX}, ${legendY})`}>
          <rect width={legendW} height={legendH} fill="rgba(15,23,42,0.75)" rx="3" stroke="#374151" strokeWidth="0.5" />
          {legendEntries.map((e, i) => (
            <g key={i} transform={`translate(5, ${i * 12 + 10})`}>
              <rect x="0" y="-4" width="8" height="6" fill={e.color} rx="1" />
              <text x="12" y="2" fill="#ffffff" fontSize="8" fontFamily="monospace">
                {e.label} ({e.total.toLocaleString()})
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

// ─── Chart PNG export ───────────────────────────────────────────────────────────

function exportChartPng(svgEl: SVGSVGElement | null) {
  if (!svgEl) return;
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '1120');
  clone.setAttribute('height', '500');
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', '#0f172a');
  clone.insertBefore(bg, clone.firstChild);
  const svgString = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1120;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (!ctx) { URL.revokeObjectURL(url); return; }
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob(pngBlob => {
      if (!pngBlob) return;
      const pngUrl = URL.createObjectURL(pngBlob);
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `statistics_chart_${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      URL.revokeObjectURL(pngUrl);
    }, 'image/png');
  };
  img.src = url;
}

// ─── Main panel ─────────────────────────────────────────────────────────────────

export function StatisticsPanel({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const { lang } = useLang();

  const [range, setRange] = useState<TimeRange>('7D');
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

  const localName = (nameEn: string, nameZh?: string | null) =>
    lang === 'en' ? nameEn : (nameZh || nameEn);


  useEffect(() => {
    let cancelled = false;
    setLoading(true); setStats(null);
    fetchAlarmStats(range, { project: filterProject, site: filterSite, building: filterBuilding, category: filterCategory, deviceCategory: filterDeviceCategory })
      .then(rows => { if (!cancelled) setStats(rows); })
      .catch(reportApiError).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range, filterProject, filterSite, filterBuilding, filterCategory, filterDeviceCategory]);

  useEffect(() => {
    fetchProjects().then(setProjects);
  }, []);

  useEffect(() => {
    fetchSites(filterProject !== 'all' ? filterProject : null).then(setSites);
  }, [filterProject]);

  useEffect(() => {
    fetchBuildings(filterSite !== 'all' ? filterSite : null).then(setBuildings);
  }, [filterSite]);

  useEffect(() => {
    fetchDeviceCategories().then(setDeviceCategories);
  }, []);

  function handleProjectChange(v: string) {
    setFilterProject(v);
    setFilterSite('all'); setFilterBuilding('all');
  }
  function handleSiteChange(v: string) {
    setFilterSite(v);
    setFilterBuilding('all');
  }

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

  // Combined severity + trouble type filter
  const categoryOptions = useMemo(() => severityOptions(lang), [lang]); // Build chart series from RPC bucket data
  const { bucketCounts, bucketLabels, totalBuckets } = useMemo(() => {
    if (!stats) {
      return {
        bucketCounts: [[], [], [], []] as number[][],
        bucketLabels: [] as string[],
        totalBuckets: RANGE_BUCKETS[range],
      };
    }
    const nBuckets = stats.num_buckets;
    const counts = SEVERITY_ORDER.map(() => Array(nBuckets).fill(0));
    for (const b of stats.buckets) {
      const si = SEVERITY_ORDER.indexOf(b.severity);
      if (si >= 0 && b.bucket_index >= 0 && b.bucket_index < nBuckets) {
        counts[si][b.bucket_index] = b.count;
      }
    }
    return {
      bucketCounts: counts,
      bucketLabels: stats.labels,
      totalBuckets: nBuckets,
    };
  }, [stats, range]);

  const chartSeries = useMemo(() => {
    return SEVERITY_ORDER
      .map((s, i) => ({
        label: s.charAt(0).toUpperCase() + s.slice(1),
        color: SEVERITY_COLORS[s],
        counts: bucketCounts[i],
      }))
      .filter(s => s.counts.some(c => c > 0));
  }, [bucketCounts]);

  const hasData = (stats?.total_events ?? 0) > 0;
  const totalAlarms = stats?.total_events ?? '—';
  const criticalCount = stats?.critical_count ?? '—';
  const alarmCount = stats?.alarm_count ?? '—';
  const faultCount = stats?.fault_count ?? '—';

  // Build dynamic title: "Alarm Statistics on {Project} {Sites} {Building} {Category}"
  const dynamicTitle = useMemo(() => {
    const parts: string[] = [];
    if (filterProject !== 'all') {
      parts.push(projectOptions.find(p => p.value === filterProject)?.label ?? '');
    }
    if (filterSite !== 'all') {
      parts.push(siteOptions.find(s => s.value === filterSite)?.label ?? '');
    }
    if (filterBuilding !== 'all') {
      parts.push(buildingOptions.find(b => b.value === filterBuilding)?.label ?? '');
    }
    if (filterDeviceCategory !== 'all') {
      parts.push(deviceCategoryOptions.find(c => c.value === filterDeviceCategory)?.label ?? '');
    }
    if (filterCategory !== 'all') {
      parts.push(categoryOptions.find(c => c.value === filterCategory)?.label ?? '');
    }

    const prefix = lang === 'en' ? 'Alarm Statistics' : lang === 'zh-CN' ? '报警统计' : '報警統計';
    if (parts.length === 0) return prefix;
    const sep = lang === 'en' ? ' on ' : ' - ';
    return `${prefix}${sep}${parts.join(' / ')}`;
  }, [filterProject, filterSite, filterBuilding, filterCategory, filterDeviceCategory, projectOptions, siteOptions, buildingOptions, categoryOptions, deviceCategoryOptions, lang]);

  return (
    <div className="flex flex-col h-full gap-0">
      {/* ── Header row ── */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 size={14} className="text-blue-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider truncate">
            {lang === 'en' ? 'Alarm Statistics' : lang === 'zh-CN' ? '报警统计' : '報警統計'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex gap-1">
            {TIME_RANGES.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`text-xs px-2 py-0.5 rounded transition-colors ${range === r ? 'bg-blue-500 text-white' : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50'}`}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            onClick={() => exportChartPng(chartSvgRef.current)}
            disabled={!hasData}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-gray-700/50 text-gray-400 hover:bg-gray-600/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ImageIcon size={10} />PNG
          </button>
        </div>
      </div>

      {/* ── Summary cards ── */}
      {!compact && (
        <div className="flex gap-2 mb-2 flex-shrink-0">
          <div className="flex-1 rounded-lg border border-gray-800/40 bg-gray-900/60 px-3 py-1.5">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">
              {lang === 'en' ? 'Total Events' : lang === 'zh-CN' ? '总事件' : '總事件'}
              <span className="text-gray-600 normal-case font-normal ml-1">({rangeLabelLocalized(range, lang)})</span>
            </div>
            <div className="text-lg font-bold text-gray-200">{totalAlarms.toLocaleString()}</div>
          </div>
          <div className="flex-1 rounded-lg border border-red-800/40 bg-red-900/10 px-3 py-1.5">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">
              {lang === 'en' ? 'Critical' : lang === 'zh-CN' ? '严重' : '嚴重'}
              <span className="text-gray-600 normal-case font-normal ml-1">({rangeLabelLocalized(range, lang)})</span>
            </div>
            <div className="text-lg font-bold text-red-400">{criticalCount.toLocaleString()}</div>
          </div>
          <div className="flex-1 rounded-lg border border-orange-800/40 bg-orange-900/10 px-3 py-1.5">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">
              {lang === 'en' ? 'Alarms' : lang === 'zh-CN' ? '报警' : '報警'}
              <span className="text-gray-600 normal-case font-normal ml-1">({rangeLabelLocalized(range, lang)})</span>
            </div>
            <div className="text-lg font-bold text-orange-400">{alarmCount.toLocaleString()}</div>
          </div>
          <div className="flex-1 rounded-lg border border-yellow-800/40 bg-yellow-900/10 px-3 py-1.5">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">
              {lang === 'en' ? 'Faults' : lang === 'zh-CN' ? '故障' : '故障'}
              <span className="text-gray-600 normal-case font-normal ml-1">({rangeLabelLocalized(range, lang)})</span>
            </div>
            <div className="text-lg font-bold text-yellow-400">{faultCount.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* ── Filter bar ── */}
      {!compact && (
        <div className="flex items-end gap-2 mb-2 flex-shrink-0 flex-wrap">
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500 pb-1.5">
            <Filter size={11} />
          </span>
          <FilterDropdown label={t('filter_project')} value={filterProject} options={projectOptions} onChange={handleProjectChange} />
          <FilterDropdown label={t('filter_site')} value={filterSite} options={siteOptions} onChange={handleSiteChange} />
          <FilterDropdown label={t('filter_building')} value={filterBuilding} options={buildingOptions} onChange={setFilterBuilding} />
          <FilterDropdown
            label={lang === 'en' ? 'Device Category' : lang === 'zh-CN' ? '设备类别' : '設備類別'}
            value={filterDeviceCategory}
            options={deviceCategoryOptions}
            onChange={setFilterDeviceCategory}
          />
          <FilterDropdown
            label={lang === 'en' ? 'Severity / Type' : lang === 'zh-CN' ? '严重程度 / 类型' : '嚴重程度 / 類型'}
            value={filterCategory}
            options={categoryOptions}
            onChange={setFilterCategory}
          />
        </div>
      )}

      {/* ── Chart area ── */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            {lang === 'en' ? 'Loading...' : lang === 'zh-CN' ? '加载中...' : '載入中...'}
          </div>
        ) : !hasData ? (
          <div className="flex items-center justify-center h-full flex-col gap-2">
            <BarChart3 size={24} className="text-gray-600" />
            <p className="text-gray-500 text-sm text-center">
              {lang === 'en' ? 'No alarm events match the selected filters' : lang === 'zh-CN' ? '没有符合筛选条件的报警事件' : '沒有符合篩選條件的報警事件'}
            </p>
          </div>
        ) : (
          <SvgBarChart
            buckets={totalBuckets}
            bucketLabels={bucketLabels}
            series={chartSeries}
            range={range}
            chartTitle={dynamicTitle}
            svgRef={chartSvgRef}
          />
        )}
      </div>
    </div>
  );
}
