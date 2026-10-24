import { useMemo, useEffect, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Activity, Bell, ChevronRight, CircleDot, Shield, Wifi, Wrench,
} from 'lucide-react';
import { useDevices } from '../hooks/useDevices';
import { useAlarms } from '../hooks/useAlarms';
import { usePredictions } from '../hooks/usePredictions';
import { SiteWithBuildings } from '../hooks/useSiteSelector';
import { AlarmEvent, Device, MaintenancePrediction, Project } from '../types';
import { severityBgClass } from '../lib/colors';
import { timeAgo } from '../lib/timeAgo';
import { useT, useLang } from '../lib/i18n';
import { translateAlarmType, translateDescription } from '../lib/alarmI18n';
import { apiClient } from '../lib/apiCompat';

type CustomerStatus = 'normal' | 'warning' | 'critical';

interface ProjectSummary {
  projectId: string | null;
  project: Project | null;
  sites: SiteWithBuildings[];
  siteCount: number;
  buildingCount: number;
  deviceCount: number;
  onlineCount: number;
  alarmCount: number;
  warningCount: number;
  faultCount: number;
  status: CustomerStatus;
}

const CRITICAL_DEVICE_STATUSES = ['Alarm', 'Activated', 'Panel Fire', 'MCCB Off'];
const FAULT_DEVICE_STATUSES = ['Fault', 'Panel Fault', 'Low Level', 'High Level', 'Low Pressure'];

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-gray-900/70 border border-gray-700/50 rounded-xl ${className}`}>
      {children}
    </div>
  );
}

function SummaryCard({
  label, value, detail, icon: Icon, iconClass, onClick,
}: {
  label: string; value: string | number; detail: string;
  icon: typeof Shield; iconClass: string; onClick?: () => void;
}) {
  const content = (
    <>
      <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">{label}</div>
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl flex-shrink-0 border ${iconClass}`}><Icon size={21} /></div>
        <div>
          <div className="text-2xl font-bold text-white">{value}</div>
          <div className="text-xs text-gray-500 mt-1">{detail}</div>
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="text-left w-full bg-gray-900/70 border border-gray-700/50 rounded-xl p-4 hover:border-blue-500/40 transition-all">
        {content}
      </button>
    );
  }
  return <Card className="p-4">{content}</Card>;
}

function OverallStatusCard({ devices }: { devices: Device[] }) {
  const t = useT();
  const online = devices.filter(d => d.status !== 'Offline').length;
  const percentage = devices.length ? Math.round((online / devices.length) * 100) : 100;
  const critical = devices.filter(d => CRITICAL_DEVICE_STATUSES.includes(d.status)).length;
  const warning = devices.filter(d => FAULT_DEVICE_STATUSES.includes(d.status)).length;
  const status = critical > 0 ? t('dash_critical') : warning > 0 ? t('dash_warning') : t('dash_good');
  const color = critical > 0 ? 'text-red-400' : warning > 0 ? 'text-yellow-400' : 'text-green-400';
  const border = critical > 0 ? 'bg-red-500/15 border-red-500/30' : warning > 0 ? 'bg-yellow-500/15 border-yellow-500/30' : 'bg-green-500/15 border-green-500/30';

  return (
    <Card className="p-4">
      <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">{t('dash_overall_status')}</div>
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl flex-shrink-0 border ${border}`}><Shield size={21} className={color} /></div>
        <div>
          <div className={`text-lg font-bold ${color}`}>{status}</div>
          <div className="text-xs text-gray-500 mt-0.5">{percentage}% {t('dash_devices_online')}</div>
        </div>
      </div>
    </Card>
  );
}

function ProjectOverview({ summaries, onSelectSite, onSelectProject }: {
  summaries: ProjectSummary[]; onSelectSite: (site: SiteWithBuildings) => void; onSelectProject?: (project: Project) => void;
}) {
  const t = useT();
  return (
    <Card className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-cyan-400" />
          <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">{t('dash_project_overview')}</span>
        </div>
        <span className="text-xs text-gray-500">{summaries.length} {t('dash_project')}</span>
      </div>

      <div className="overflow-auto px-3 pb-3 flex-1">
        <table className="w-full min-w-[720px] border-separate border-spacing-y-1.5">
          <thead>
            <tr className="text-left">
              <th className="px-3 py-2 text-[11px] text-gray-500 font-semibold uppercase tracking-wider">{t('dash_project')}</th>
              <th className="px-3 py-2 text-[11px] text-gray-500 font-semibold uppercase tracking-wider text-center">{t('dash_sites')}</th>
              <th className="px-3 py-2 text-[11px] text-gray-500 font-semibold uppercase tracking-wider text-center">{t('dash_buildings')}</th>
              <th className="px-3 py-2 text-[11px] text-gray-500 font-semibold uppercase tracking-wider text-center">{t('dash_devices')}</th>
              <th className="px-3 py-2 text-[11px] text-gray-500 font-semibold uppercase tracking-wider text-center">{t('dash_alarms_col')}</th>
              <th className="px-3 py-2 text-[11px] text-gray-500 font-semibold uppercase tracking-wider text-center">{t('dash_warnings_col')}</th>
              <th className="px-3 py-2 text-[11px] text-gray-500 font-semibold uppercase tracking-wider text-center">{t('dash_faults_col')}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {summaries.map(s => {
              const styles = s.status === 'critical'
                ? 'border-red-500/40 bg-red-500/[0.06] hover:bg-red-500/[0.11]'
                : s.status === 'warning'
                  ? 'border-yellow-500/35 bg-yellow-500/[0.05] hover:bg-yellow-500/[0.1]'
                  : 'border-gray-800/70 bg-gray-950/30 hover:bg-gray-800/40';
              const dot = s.status === 'critical' ? 'bg-red-500' : s.status === 'warning' ? 'bg-yellow-400' : 'bg-green-500';
              const borderClass = styles.split(' ').find(c => c.startsWith('border-')) ?? '';
              const primaryName = s.project?.name_zh || s.project?.name || s.sites[0]?.name_zh || s.sites[0]?.name || '—';
              const secondaryName = s.project?.name_zh ? s.project.name : s.sites[0]?.name_zh ? s.sites[0]?.name : '';
              const firstSite = s.sites[0];
              return (
                <tr key={s.projectId ?? 'unassigned'} onClick={() => onSelectProject && s.project ? onSelectProject(s.project) : (firstSite && onSelectSite(firstSite))} className={`group cursor-pointer transition-colors ${styles}`}>
                  <td className={`rounded-l-xl border-y border-l px-3 py-3 ${borderClass}`}>
                    <div className="flex items-center gap-2.5 min-w-44">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot} ${s.status === 'critical' ? 'animate-pulse' : ''}`} />
                      <div className="min-w-0">
                        <div className="text-sm text-white font-semibold truncate">{primaryName}</div>
                        <div className="text-xs text-gray-500 truncate">{secondaryName}</div>
                      </div>
                    </div>
                  </td>
                  <td className={`border-y px-3 py-3 text-center text-sm text-white font-semibold ${borderClass}`}>{s.siteCount}</td>
                  <td className={`border-y px-3 py-3 text-center text-sm text-white font-semibold ${borderClass}`}>{s.buildingCount}</td>
                  <td className={`border-y px-3 py-3 text-center text-sm text-cyan-300 font-semibold ${borderClass}`}>{s.deviceCount}</td>
                  <td className={`border-y px-3 py-3 text-center text-sm font-semibold ${borderClass}`}><Metric value={s.alarmCount} color="text-red-400" /></td>
                  <td className={`border-y px-3 py-3 text-center text-sm font-semibold ${borderClass}`}><Metric value={s.warningCount} color="text-orange-400" /></td>
                  <td className={`border-y px-3 py-3 text-center text-sm font-semibold ${borderClass}`}><Metric value={s.faultCount} color="text-yellow-400" /></td>
                  <td className={`rounded-r-xl border-y border-r px-2 py-3 text-gray-600 group-hover:text-blue-400 ${borderClass}`}><ChevronRight size={15} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {summaries.length === 0 && <div className="py-12 text-center text-sm text-gray-500">{t('dash_no_projects')}</div>}
      </div>

      <div className="mt-auto border-t border-gray-800/50 px-5 py-3 flex items-center gap-2 text-xs text-gray-600 flex-shrink-0">
        <CircleDot size={12} /> {t('dash_select_project')}
      </div>
    </Card>
  );
}

function Metric({ value, color }: { value: number; color: string }) {
  return <span className={value > 0 ? color : 'text-green-400'}>{value}</span>;
}

function SystemHealth({ devices }: { devices: Device[] }) {
  const t = useT();
  const alarm = devices.filter(d => CRITICAL_DEVICE_STATUSES.includes(d.status)).length;
  const fault = devices.filter(d => FAULT_DEVICE_STATUSES.includes(d.status)).length;
  const normal = Math.max(0, devices.length - alarm - fault);
  const total = devices.length || 1;
  const normalPct = Math.round((normal / total) * 100);
  const faultPct = Math.round((fault / total) * 100);
  const alarmPct = Math.max(0, 100 - normalPct - faultPct);
  const option = useMemo(() => ({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [{
      type: 'pie', radius: ['52%', '78%'],
      data: [
        { value: normal, name: t('dash_normal'), itemStyle: { color: '#22c55e' } },
        { value: fault, name: t('dash_fault'), itemStyle: { color: '#eab308' } },
        { value: alarm, name: t('dash_alarm'), itemStyle: { color: '#ef4444' } },
      ],
      label: { show: false }, emphasis: { scale: false },
    }],
  }), [normal, fault, alarm, t]);

  return (
    <Card className="p-4 flex-shrink-0">
      <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">{t('dash_devices_status')}</div>
      <div className="flex items-center gap-3">
        <ReactECharts option={option} style={{ height: 88, width: 88 }} opts={{ renderer: 'canvas' }} />
        <div className="flex-1 space-y-2 text-xs">
          <HealthLine color="bg-green-500" label={t('dash_normal')} value={normalPct} />
          <HealthLine color="bg-yellow-500" label={t('dash_fault')} value={faultPct} />
          <HealthLine color="bg-red-500" label={t('dash_alarm')} value={alarmPct} />
        </div>
      </div>
    </Card>
  );
}

function HealthLine({ color, label, value }: { color: string; label: string; value: number }) {
  return <div className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${color}`} /><span className="text-gray-400 flex-1">{label}</span><span className="text-white font-semibold">{value}%</span></div>;
}

function RecentAlerts({ alarms, onNavigate }: { alarms: AlarmEvent[]; onNavigate: () => void }) {
  const t = useT();
  const { lang } = useLang();
  const recent = alarms.slice(0, 5);
  return (
    <Card className="flex flex-col flex-1 overflow-hidden min-h-0">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-red-400" />
          <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">{t('dash_recent_alerts')}</span>
          {alarms.filter(a => a.status === 'active').length > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold animate-pulse">
              {alarms.filter(a => a.status === 'active').length}
            </span>
          )}
        </div>
        <button onClick={onNavigate} className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1">{t('dash_view_all')} <ChevronRight size={11} /></button>
      </div>

      <div className="overflow-auto px-4 pb-4 space-y-2 flex-1 min-h-0">
        {recent.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-10">{t('dash_no_alerts')}</div>
        ) : recent.map(a => {
          const device = a.devices;
          const location = device?.floors
            ? `${device.floors.buildings?.name_zh || device.floors.buildings?.name || ''} · ${device.floors.floor_label}`
            : '-';
          const bar = (a.severity === 'critical' || a.severity === 'alarm') ? 'bg-red-500' : a.severity === 'high' ? 'bg-orange-500' : (a.severity === 'medium' || a.severity === 'fault') ? 'bg-yellow-500' : 'bg-blue-500';
          return (
            <div key={a.id} className={`flex items-start gap-3 p-2.5 rounded-lg border ${a.status === 'active' ? 'bg-red-500/5 border-red-500/20' : 'bg-gray-800/40 border-gray-700/30'}`}>
              <div className={`w-1.5 self-stretch rounded-full flex-shrink-0 ${bar}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${severityBgClass(a.severity)}`}>{a.severity}</span>
                  <span className="text-white text-sm font-medium truncate">{translateAlarmType(a.alarm_type, a.devices, lang, t)}</span>
                </div>
                <p className="text-gray-400 text-xs mt-1 truncate">{translateDescription(a.description, a.devices, lang, t)}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-gray-500 text-xs">{device?.code || '-'}</span>
                  <span className="text-gray-600 text-xs">·</span>
                  <span className="text-gray-500 text-xs truncate">{location}</span>
                  <span className="text-gray-600 text-xs">·</span>
                  <span className="text-gray-500 text-xs">{timeAgo(a.triggered_at)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

type StatusKey = 'normal' | 'fault' | 'alarm' | 'offline';

const STATUS_META: { key: StatusKey; color: string; barClass: string }[] = [
  { key: 'normal', color: '#22c55e', barClass: 'bg-green-500' },
  { key: 'fault', color: '#eab308', barClass: 'bg-yellow-500' },
  { key: 'alarm', color: '#ef4444', barClass: 'bg-red-500' },
  { key: 'offline', color: '#6b7280', barClass: 'bg-gray-500' },
];

const CATEGORY_KEY_MAP: Record<string, string> = {
  detection: 'equip_detection',
  pump: 'equip_pump',
  water: 'equip_water',
  ventilation: 'equip_ventilation',
  power_interlocking: 'equip_power_interlocking',
};

function classifyStatus(status: string): StatusKey {
  if (status === 'Offline') return 'offline';
  if (CRITICAL_DEVICE_STATUSES.includes(status)) return 'alarm';
  if (FAULT_DEVICE_STATUSES.includes(status)) return 'fault';
  return 'normal';
}

function SensorStatusOverview({ devices }: { devices: Device[] }) {
  const t = useT();

  const categoryRows = useMemo(() => {
    const categoryMap = new Map<string, { total: number; normal: number; fault: number; alarm: number; offline: number }>();
    const CATEGORY_ORDER = ['detection', 'pump', 'water', 'ventilation', 'power_interlocking'];

    for (const d of devices) {
      const category = d.device_types?.category || 'power_interlocking';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { total: 0, normal: 0, fault: 0, alarm: 0, offline: 0 });
      }
      const row = categoryMap.get(category)!;
      row.total += 1;
      row[classifyStatus(d.status)] += 1;
    }

    return CATEGORY_ORDER
      .filter(c => categoryMap.has(c))
      .map(c => ({ category: c, ...categoryMap.get(c)! }));
  }, [devices]);

  return (
    <Card className="p-4 flex flex-col flex-none">
      <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">{t('dash_sensor_status')}</div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-3 text-[10px] text-gray-400">
        {STATUS_META.map(m => (
          <span key={m.key} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${m.barClass}`} />
            {t(`dash_${m.key}`)}
          </span>
        ))}
      </div>

      {/* Category rows */}
      <div className="space-y-2">
        {categoryRows.map(row => (
          <SensorCategoryRow key={row.category} row={row} t={t} />
        ))}
      </div>

      {categoryRows.length === 0 && (
        <div className="py-6 text-center text-sm text-gray-500">—</div>
      )}
    </Card>
  );
}

function SensorCategoryRow({ row, t }: {
  row: { category: string; total: number; normal: number; fault: number; alarm: number; offline: number };
  t: (key: string) => string;
}) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: number; pct: number } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const segments = STATUS_META.map(m => ({
    ...m,
    count: row[m.key],
    pct: row.total > 0 ? (row[m.key] / row.total) * 100 : 0,
  }));

  const handleMouseMove = (e: React.MouseEvent, seg: { key: StatusKey; count: number; pct: number }) => {
    const barRect = barRef.current?.getBoundingClientRect();
    if (!barRect) return;
    setTooltip({
      x: e.clientX - barRect.left,
      y: e.clientY - barRect.top,
      label: t(`dash_${seg.key}`),
      value: seg.count,
      pct: Math.round(seg.pct),
    });
  };

  return (
    <div className="flex items-center gap-2.5">
      {/* Category name */}
      <div className="w-16 flex-shrink-0 text-xs text-gray-300 font-medium truncate text-right">
        {CATEGORY_KEY_MAP[row.category] ? t(CATEGORY_KEY_MAP[row.category]) : row.category}
      </div>

      {/* Stacked color bar with tooltip wrapper */}
      <div
        className="relative flex-1"
        onMouseLeave={() => setTooltip(null)}
      >
        <div
          ref={barRef}
          className="flex h-5 rounded-full overflow-hidden bg-gray-800/60 cursor-default"
        >
          {segments.map(seg => (
            <div
              key={seg.key}
              className={`h-full transition-opacity ${seg.barClass} ${seg.count === 0 ? 'opacity-0' : 'hover:opacity-80'}`}
              style={{ width: `${seg.pct}%` }}
              onMouseMove={(e) => handleMouseMove(e, seg)}
              onMouseEnter={(e) => handleMouseMove(e, seg)}
            />
          ))}
        </div>

        {/* Tooltip — rendered outside overflow-hidden bar */}
        {tooltip && (
          <div
            className="absolute z-30 pointer-events-none px-2.5 py-1.5 rounded-lg bg-gray-950 border border-gray-600 text-xs whitespace-nowrap shadow-xl"
            style={{
              left: Math.min(Math.max(tooltip.x - 45, 0), (barRef.current?.clientWidth ?? 0) - 110),
              top: -36,
            }}
          >
            <span className="text-white font-semibold">{tooltip.label}: </span>
            <span className="text-cyan-300 font-semibold">{tooltip.value}</span>
            <span className="text-gray-400"> ({tooltip.pct}%)</span>
          </div>
        )}
      </div>

      {/* Total count */}
      <div className="w-8 flex-shrink-0 text-xs text-gray-400 font-semibold text-right">{row.total}</div>
    </div>
  );
}

function MaintenanceActions({ predictions, onNavigate }: { predictions: MaintenancePrediction[]; onNavigate: () => void }) {
  const t = useT();
  const pending = predictions.filter(p => p.status === 'pending').slice(0, 5);
  return (
    <Card className="flex flex-col flex-1 overflow-hidden min-h-0">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Wrench size={14} className="text-orange-400" />
          <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">{t('dash_maintenance_actions')}</span>
          {predictions.filter(p => p.status === 'pending').length > 0 && (
            <span className="bg-orange-500/20 text-orange-400 text-xs rounded-full px-1.5 py-0.5 border border-orange-500/30">
              {predictions.filter(p => p.status === 'pending').length}
            </span>
          )}
        </div>
        <button onClick={onNavigate} className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1">{t('dash_view_all')} <ChevronRight size={11} /></button>
      </div>

      <div className="overflow-auto px-4 pb-4 space-y-2 flex-1 min-h-0">
        {pending.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-10">{t('dash_no_maintenance')}</div>
        ) : pending.map(p => {
          const pct = Math.round(p.fault_probability * 100);
          const barColor = pct > 70 ? '#ef4444' : pct > 40 ? '#eab308' : '#22c55e';
          const device = p.devices;
          return (
            <div key={p.id} className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">{p.prediction_type}</div>
                  <div className="text-xs text-gray-500">{device?.code} · {device?.floors?.floor_label || '—'}</div>
                </div>
                <span className="text-xs font-bold flex-shrink-0" style={{ color: barColor }}>{pct}%</span>
              </div>
              <p className="text-xs text-gray-400 mb-2 line-clamp-2 leading-relaxed">{p.recommendation}</p>
              <div className="h-1 bg-gray-700 rounded-full overflow-hidden mb-2">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
              </div>
              {p.predicted_failure_date && (
                <div className="text-xs text-gray-500">{t('dash_predicted_failure')} {p.predicted_failure_date}</div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function OverviewDashboard({ sites, onNavigate, onSelectSite, onSelectProject, onNavigateAdminEquipment }: {
  sites: SiteWithBuildings[];
  onNavigate: (tab: string) => void;
  onSelectSite: (site: SiteWithBuildings) => void;
  onSelectProject?: (project: Project) => void;
  onNavigateAdminEquipment?: () => void;
}) {
  const t = useT();
  const { devices } = useDevices();
  const { alarms } = useAlarms();
  const { predictions } = usePredictions();

  const [projects, setProjects] = useState<Project[]>([]);
  useEffect(() => {
    apiClient.from('projects').select('*').order('name').then(({ data }) => {
      if (data) setProjects(data as Project[]);
    });
  }, []);

  const activeAlarms = alarms.filter(a => a.status === 'active');
  const onlineDevices = devices.filter(d => d.status !== 'Offline').length;
  const activeWarnings = activeAlarms.filter(a => a.severity === 'fault' || a.severity === 'medium' || a.severity === 'low').length;
  const activeCriticalAlarms = activeAlarms.filter(a => a.severity === 'critical' || a.severity === 'alarm' || a.severity === 'high').length;

  const recentAlarms = alarms.slice(0, 8);

  const summaries = useMemo(() => {
    const projectMap = new Map<string, Project>();
    for (const p of projects) projectMap.set(p.id, p);

    const grouped = new Map<string | null, SiteWithBuildings[]>();
    for (const s of sites) {
      const pid = s.project_id ?? null;
      const arr = grouped.get(pid) ?? [];
      arr.push(s);
      grouped.set(pid, arr);
    }

    const result: ProjectSummary[] = [];
    for (const [pid, projectSites] of grouped) {
      const siteIds = new Set(projectSites.map(s => s.id));
      const projectDevices = devices.filter(d => d.floors?.buildings?.site_id && siteIds.has(d.floors.buildings.site_id));
      const projectAlarms = activeAlarms.filter(a => a.devices?.floors?.buildings?.site_id && siteIds.has(a.devices.floors.buildings.site_id));
      const alarmCount = projectAlarms.filter(a => a.severity === 'critical' || a.severity === 'alarm' || a.severity === 'high').length;
      const warningCount = projectAlarms.length - alarmCount;
      const faultCount = projectDevices.filter(d => FAULT_DEVICE_STATUSES.includes(d.status)).length;
      const hasCritical = alarmCount > 0 || projectDevices.some(d => CRITICAL_DEVICE_STATUSES.includes(d.status));
      const hasWarning = warningCount > 0 || faultCount > 0 || projectDevices.some(d => d.status === 'Offline');
      result.push({
        projectId: pid,
        project: pid ? projectMap.get(pid) ?? null : null,
        sites: projectSites,
        siteCount: projectSites.length,
        buildingCount: projectSites.reduce((sum, s) => sum + s.buildings.length, 0),
        deviceCount: projectDevices.length,
        onlineCount: projectDevices.filter(d => d.status !== 'Offline').length,
        alarmCount, warningCount, faultCount,
        status: hasCritical ? 'critical' : hasWarning ? 'warning' : 'normal',
      });
    }
    result.sort((a, b) => {
      const an = a.project?.name_zh || a.project?.name || a.sites[0]?.name || '';
      const bn = b.project?.name_zh || b.project?.name || b.sites[0]?.name || '';
      return an.localeCompare(bn);
    });
    return result;
  }, [sites, devices, activeAlarms, projects]);

  return (
    <div className="flex flex-col gap-4 min-h-full">
      <div className="grid grid-cols-4 gap-4 flex-shrink-0">
        <OverallStatusCard devices={devices} />
        <SummaryCard label={t('dash_active_alarms')} value={activeCriticalAlarms} detail={`${activeWarnings} ${t('dash_warnings_across')}`} icon={Bell} iconClass="bg-red-500/15 border-red-500/30 text-red-400" onClick={() => onNavigate('alarms')} />
        <SummaryCard label={t('dash_connected_devices')} value={onlineDevices.toLocaleString()} detail={`${t('dash_online_total')} ${devices.length.toLocaleString()} ${t('dash_total')}`} icon={Wifi} iconClass="bg-blue-500/15 border-blue-500/30 text-blue-400" onClick={() => onNavigateAdminEquipment?.()} />
        <SummaryCard label={t('dash_projects_monitored')} value={summaries.length} detail={`${sites.reduce((t2, s) => t2 + s.buildings.length, 0)} ${t('dash_buildings_portfolio')}`} icon={Activity} iconClass="bg-cyan-500/15 border-cyan-500/30 text-cyan-400" />
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-shrink-0">
        <div className="flex-1 min-w-0 flex" style={{ minHeight: 320 }}><ProjectOverview summaries={summaries} onSelectSite={onSelectSite} onSelectProject={onSelectProject} /></div>
        <div className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-4">
          <SystemHealth devices={devices} />
          <SensorStatusOverview devices={devices} />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-shrink-0">
        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-w-0">
          <RecentAlerts alarms={recentAlarms} onNavigate={() => onNavigate('alarms')} />
          <MaintenanceActions predictions={predictions} onNavigate={() => onNavigate('maintenance')} />
        </div>
        <div className="hidden lg:block w-72 flex-shrink-0" />
      </div>
    </div>
  );
}
