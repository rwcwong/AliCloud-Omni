import { useState, useMemo, useEffect } from 'react';
import { Bell, CheckCircle, Send, ArrowUpDown, ArrowUp, ArrowDown, Filter, Check, Loader2, XCircle, Clock, Phone, User, Image as ImageIcon } from 'lucide-react';
import { useAlarms } from '../hooks/useAlarms';
import { FloorPlanPanel } from './FloorPlanPanel';
import { useAuth } from '../lib/auth';
import { StatusBadge } from '../components/StatusBadge';
import { AlarmEvent, AlarmSeverity, Project, Site, Building, Floor, Language } from '../types';
import { timeAgo } from '../lib/timeAgo';
import { useT, useLang } from '../lib/i18n';
import { translateAlarmType, translateDescription } from '../lib/alarmI18n';
import { apiClient } from '../lib/apiCompat';
import { dispatchAlarm } from '../lib/dispatch';
import { reportApiError } from '../lib/analytics';

type SortField = 'severity' | 'time' | 'site';
type SortDir = 'asc' | 'desc';

const SEVERITY_ORDER: Record<AlarmSeverity, number> = {
  critical: 0,
  alarm: 1,
  fault: 2,
  high: 1,
  medium: 2,
  low: 3,
};

function localName(name: string, nameZh: string | undefined, lang: string): string {
  return lang === 'en' ? name : (nameZh || name);
}

function getSiteName(alarm: AlarmEvent, lang: string): string {
  const site = alarm.devices?.floors?.buildings?.sites;
  if (!site) return '';
  return localName(site.name, site.name_zh, lang);
}

function getBuildingName(alarm: AlarmEvent, lang: string): string {
  const b = alarm.devices?.floors?.buildings;
  if (!b) return '';
  return localName(b.name, b.name_zh, lang);
}

function getSiteId(alarm: AlarmEvent): string {
  return alarm.devices?.floors?.buildings?.site_id ?? '';
}

function getBuildingId(alarm: AlarmEvent): string {
  return alarm.devices?.floors?.buildings?.id ?? '';
}

function getFloorId(alarm: AlarmEvent): string {
  return alarm.devices?.floors?.id ?? '';
}

function getProjectId(alarm: AlarmEvent, sites: Site[]): string {
  const siteId = getSiteId(alarm);
  const site = sites.find(s => s.id === siteId);
  return site?.project_id ?? '';
}

function AlarmRow({ alarm, onAck, onDispatch, onResolve, compact, lang, dispatched, capturing, resolving, selected, onSelect }: {
  alarm: AlarmEvent;
  onAck: () => void;
  onDispatch: () => void;
  onResolve: () => void;
  compact?: boolean;
  lang: Language;
  dispatched?: boolean;
  capturing?: boolean;
  resolving?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const t = useT();
  const device = alarm.devices;
  const siteName = getSiteName(alarm, lang);
  const buildingName = getBuildingName(alarm, lang);
  const floorLabel = device?.floors?.floor_label ?? '';
  const locationParts = [siteName, buildingName, floorLabel].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(' · ') : '-';

  const isOutstanding = alarm.status === 'active' || alarm.status === 'acknowledged' || alarm.status === 'dispatched';
  const canAck = alarm.status === 'active';

  return (
    <div
      onClick={onSelect}
      className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${selected ? 'ring-2 ring-cyan-400/60 bg-cyan-500/5 border-cyan-400/40' : alarm.status === 'active' ? 'bg-red-500/5 border-red-500/20 hover:border-red-400/40' : 'bg-gray-800/40 border-gray-700/30 hover:border-gray-600/50'}`}
    >
      <div className={`w-1.5 self-stretch rounded-full flex-shrink-0 ${alarm.severity === 'critical' ? 'bg-red-500' : alarm.severity === 'high' ? 'bg-orange-500' : alarm.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {(() => {
            const isFault = alarm.severity === 'fault';
            return (
              <span className={`text-xs px-1.5 py-0.5 rounded border ${isFault ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' : 'bg-red-500/20 text-red-300 border-red-500/40'}`}>
                {isFault ? t('Fault') : t('Alarm')}
              </span>
            );
          })()}
          <span className="text-white text-sm font-medium truncate">{translateAlarmType(alarm.alarm_type, device, lang, t)}</span>
        </div>
        <p className="text-gray-400 text-xs mt-1 truncate">{translateDescription(alarm.description, device, lang, t)}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-gray-500 text-xs">{device?.code || '-'}</span>
          <span className="text-gray-600 text-xs">·</span>
          <span className="text-cyan-400/70 text-xs font-medium">{location}</span>
          <span className="text-gray-600 text-xs">·</span>
          <span className="text-gray-500 text-xs">{timeAgo(alarm.triggered_at)}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1 flex-shrink-0">
        <StatusBadge status={alarm.status} size="sm" />
        {isOutstanding && (
          <div className="flex gap-1 mt-1">
            {canAck && !compact && (
              <button onClick={onAck} title={t('acknowledge')} className="p-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors">
                <CheckCircle size={12} />
              </button>
            )}
            <button onClick={onResolve} disabled title="未接入数据" className="p-1 rounded bg-cyan-500/20 text-cyan-400 transition-colors disabled:opacity-50">
              {resolving ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
            </button>
            {alarm.status === 'active' && (
              <button onClick={onDispatch} disabled={capturing} title={capturing ? t('capturing') : t('dispatch_whatsapp')} className="p-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50">
                {capturing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              </button>
            )}
            {dispatched && (
              <span className="flex items-center gap-0.5 text-green-400 text-[10px] font-medium">
                <Check size={10} />
                {t('dispatched_short')}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface FilterDropdownProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

function FilterDropdown({ label, value, options, onChange }: FilterDropdownProps) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] uppercase tracking-wider text-gray-500 truncate">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-gray-800/60 border border-gray-700/40 rounded-md px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-cyan-400/40 transition-colors w-full truncate"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

export function AlarmPanel({
  compact = false,
  maxItems = 20,
  buildingId,
  hideHeader = false,
  initialSiteId,
  initialBuildingId,
  initialFloorId,
  initialStatus,
  initialCategory,
  externalAlarms,
  priorityMode,
}: {
  compact?: boolean;
  maxItems?: number;
  buildingId?: string;
  hideHeader?: boolean;
  initialSiteId?: string;
  initialBuildingId?: string;
  initialFloorId?: string;
  initialStatus?: string;
  initialCategory?: string;
  externalAlarms?: AlarmEvent[];
  priorityMode?: boolean;
}) {
  const t = useT();
  const { lang } = useLang();
  const { user } = useAuth();
  const { alarms: internalAlarms, loading, acknowledge, resolve } = useAlarms();
  const alarms = externalAlarms ?? internalAlarms;
  const [dispatchedIds, setDispatchedIds] = useState<Set<string>>(new Set());
  const [capturingId, setCapturingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [selectedAlarmId, setSelectedAlarmId] = useState<string | null>(null);

  const userName = (user?.user_metadata?.name as string) || user?.email || '';
  const userTelephone = (user?.user_metadata?.telephone as string) || '';
  const userId = user?.id;

  const filterValues = ['all', 'active', 'acknowledged', 'resolved', 'dispatched', 'false_alarm'] as const;
  type AlarmFilter = typeof filterValues[number];
  const initialFilter = filterValues.includes(initialStatus as AlarmFilter) ? initialStatus as AlarmFilter : 'active';
  const [filter, setFilter] = useState<AlarmFilter>(initialFilter);
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const priorityStatus = useMemo(() => {
    if (!priorityMode) return undefined;
    const hasActive = alarms.some(a => a.status === 'active');
    if (hasActive) return 'active' as const;
    const hasDispatched = alarms.some(a => a.status === 'dispatched');
    if (hasDispatched) return 'dispatched' as const;
    const hasAcknowledged = alarms.some(a => a.status === 'acknowledged');
    if (hasAcknowledged) return 'acknowledged' as const;
    return undefined;
  }, [priorityMode, alarms]);
  const effectiveFilter = priorityMode ? (filter === 'all' ? (priorityStatus ?? 'none') : filter) : filter;

  // Cascading filter state
  const [projects, setProjects] = useState<Project[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterSite, setFilterSite] = useState<string>(initialSiteId || 'all');
  const [filterBuilding, setFilterBuilding] = useState<string>(initialBuildingId || buildingId || 'all');
  const [filterBlock, setFilterBlock] = useState<string>(initialFloorId || 'all');
  const [filterCategory, setFilterCategory] = useState<string>(initialCategory || 'all');

  useEffect(() => {
    apiClient.from('projects').select('*').order('name').then(({ data }) => {
      if (data) setProjects(data as Project[]);
    });
  }, []);

  useEffect(() => {
    apiClient.from('sites').select('*').order('name').then(({ data }) => {
      if (data) setSites(data as Site[]);
    });
  }, []);

  useEffect(() => {
    apiClient.from('buildings').select('*').order('name').then(({ data }) => {
      if (data) setBuildings(data as Building[]);
    });
  }, []);

  useEffect(() => {
    apiClient.from('floors').select('*, buildings(*)').order('floor_number').then(({ data }) => {
      if (data) setFloors(data as Floor[]);
    });
  }, []);

  // Cascading filter options
  const projectOptions = useMemo(() => [
    { value: 'all', label: t('all_projects') },
    ...projects.map(p => ({ value: p.id, label: localName(p.name, p.name_zh, lang) })),
  ], [projects, lang, t]);

  const siteOptions = useMemo(() => {
    const filtered = filterProject === 'all' ? sites : sites.filter(s => s.project_id === filterProject);
    return [
      { value: 'all', label: t('all_sites') },
      ...filtered.map(s => ({ value: s.id, label: localName(s.name, s.name_zh, lang) })),
    ];
  }, [sites, filterProject, lang, t]);

  const buildingOptions = useMemo(() => {
    const filtered = filterSite === 'all' ? (filterProject === 'all' ? buildings : buildings.filter(b => {
      const site = sites.find(s => s.id === b.site_id);
      return site?.project_id === filterProject;
    })) : buildings.filter(b => b.site_id === filterSite);
    return [
      { value: 'all', label: t('all_buildings') },
      ...filtered.map(b => ({ value: b.id, label: localName(b.name, b.name_zh, lang) })),
    ];
  }, [buildings, sites, filterSite, filterProject, lang, t]);

  // Block = floors within the selected building
  const blockOptions = useMemo(() => {
    let filteredFloors: Floor[];
    if (filterBuilding !== 'all') {
      filteredFloors = floors.filter(f => f.building_id === filterBuilding);
    } else if (filterSite !== 'all') {
      const siteBuildingIds = new Set(buildings.filter(b => b.site_id === filterSite).map(b => b.id));
      filteredFloors = floors.filter(f => siteBuildingIds.has(f.building_id));
    } else if (filterProject !== 'all') {
      const siteIds = new Set(sites.filter(s => s.project_id === filterProject).map(s => s.id));
      const siteBuildingIds = new Set(buildings.filter(b => siteIds.has(b.site_id)).map(b => b.id));
      filteredFloors = floors.filter(f => siteBuildingIds.has(f.building_id));
    } else {
      filteredFloors = floors;
    }
    return [
      { value: 'all', label: t('all_blocks') },
      ...filteredFloors.map(f => ({ value: f.id, label: f.floor_label || `F${f.floor_number}` })),
    ];
  }, [floors, filterBuilding, filterSite, filterProject, buildings, sites, t]);

  const categoryOptions = useMemo(() => [
    { value: 'all', label: t('equip_all_categories') },
    { value: 'detection', label: t('detection') },
    { value: 'pump', label: t('pump') },
    { value: 'water', label: t('water') },
    { value: 'ventilation', label: t('ventilation') },
    { value: 'power_interlocking', label: t('power_interlocking') },
    { value: 'other', label: lang === 'en' ? 'Other' : lang === 'zh-CN' ? '其他' : '其他' },
  ], [t, lang]);

  // When project changes, reset downstream filters if they don't match
  useEffect(() => {
    if (filterProject !== 'all') {
      const validSites = sites.filter(s => s.project_id === filterProject);
      if (filterSite !== 'all' && !validSites.some(s => s.id === filterSite)) {
        setFilterSite('all');
        setFilterBuilding('all');
        setFilterBlock('all');
      }
    }
  }, [filterProject, filterSite, sites]);

  useEffect(() => {
    if (filterSite !== 'all') {
      const validBuildings = buildings.filter(b => b.site_id === filterSite);
      if (filterBuilding !== 'all' && !validBuildings.some(b => b.id === filterBuilding)) {
        setFilterBuilding('all');
        setFilterBlock('all');
      }
    }
  }, [filterSite, filterBuilding, buildings]);

  useEffect(() => {
    if (filterBuilding !== 'all') {
      const validFloors = floors.filter(f => f.building_id === filterBuilding);
      if (filterBlock !== 'all' && !validFloors.some(f => f.id === filterBlock)) {
        setFilterBlock('all');
      }
    }
  }, [filterBuilding, filterBlock, floors]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'time' ? 'desc' : 'asc');
    }
  }

  function handleProjectChange(value: string) {
    setFilterProject(value);
    if (value === 'all') {
      setFilterSite('all');
      setFilterBuilding('all');
      setFilterBlock('all');
    }
  }

  function handleSiteChange(value: string) {
    setFilterSite(value);
    if (value === 'all') {
      setFilterBuilding('all');
      setFilterBlock('all');
    }
  }

  function handleBuildingChange(value: string) {
    setFilterBuilding(value);
    setFilterBlock('all');
  }

  const filteredAlarms = useMemo(() => {
    let result = alarms;

    // Building-scoped filter (when buildingId prop is provided)
    if (buildingId) {
      result = result.filter(a => getBuildingId(a) === buildingId);
    }

    // Status filter (use effectiveFilter which accounts for priorityMode)
    if (effectiveFilter !== 'all' && effectiveFilter !== 'none') {
      result = result.filter(a => a.status === effectiveFilter);
    }

    // Project filter
    if (filterProject !== 'all') {
      result = result.filter(a => {
        const pid = getProjectId(a, sites);
        return pid === filterProject;
      });
    }

    // Site filter
    if (filterSite !== 'all') {
      result = result.filter(a => getSiteId(a) === filterSite);
    }

    // Building filter
    if (filterBuilding !== 'all') {
      result = result.filter(a => getBuildingId(a) === filterBuilding);
    }

    // Block filter (floors within the selected building)
    if (filterBlock !== 'all') {
      result = result.filter(a => getFloorId(a) === filterBlock);
    }

    // Category filter (equipment category from device_types)
    if (filterCategory !== 'all') {
      result = result.filter(a => (a.devices?.device_types?.category ?? 'other') === filterCategory);
    }

    // Sort
    const sorted = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'severity') {
        cmp = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      } else if (sortField === 'time') {
        cmp = new Date(a.triggered_at).getTime() - new Date(b.triggered_at).getTime();
      } else if (sortField === 'site') {
        const siteA = getSiteName(a, lang).toLowerCase();
        const siteB = getSiteName(b, lang).toLowerCase();
        cmp = siteA.localeCompare(siteB);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [alarms, buildingId, effectiveFilter, filterProject, filterSite, filterBuilding, filterBlock, filterCategory, sortField, sortDir, sites, lang, floors]);

  const resultCount = filteredAlarms.length;
  const displayAlarms = filteredAlarms.slice(0, maxItems);

  // Auto-select the first alarm when the list changes and no valid selection remains
  useEffect(() => {
    if (displayAlarms.length === 0) {
      setSelectedAlarmId(null);
      return;
    }
    const stillExists = displayAlarms.some(a => a.id === selectedAlarmId);
    if (!stillExists) {
      setSelectedAlarmId(displayAlarms[0].id);
    }
  }, [displayAlarms]); // eslint-disable-line

  const selectedAlarm = useMemo(
    () => displayAlarms.find(a => a.id === selectedAlarmId) ?? null,
    [displayAlarms, selectedAlarmId],
  );
  const handleWhatsAppDispatch = async (alarm: AlarmEvent) => {
    setCapturingId(alarm.id);
    try {
      await dispatchAlarm(alarm, lang, userName, userTelephone);
      setDispatchedIds(prev => new Set(prev).add(alarm.id));
    } catch (failure) {
      reportApiError(failure);
    } finally {
      setCapturingId(null);
    }
  };

  const handleResolve = async (alarm: AlarmEvent) => {
    setResolvingId(alarm.id);
    try {
      await resolve(alarm.id, userId, userName);
    } finally {
      setResolvingId(null);
    }
  };

  const sortButtons: { field: SortField; label: string }[] = [
    { field: 'severity', label: t('sort_severity') },
    { field: 'time', label: t('sort_time') },
    { field: 'site', label: t('sort_site') },
  ];

  return (
    <div className="flex h-full gap-3">
      <div className="flex flex-col h-full" style={{ width: '50%', minWidth: '340px' }}>
      {!hideHeader && (
        <>
          <div className="flex items-center gap-1 mb-3 flex-shrink-0 flex-wrap">
            {([
              { key: 'all', label: t('all_status'), activeCls: 'bg-gray-600 text-white border-gray-500', inactiveCls: 'text-gray-400 border-transparent hover:text-gray-300' },
              { key: 'active', label: t('active'), activeCls: 'bg-red-500/80 text-white border-red-400', inactiveCls: 'text-red-400/60 border-transparent hover:text-red-400/80' },
              { key: 'acknowledged', label: t('acknowledged'), activeCls: 'bg-blue-500/80 text-white border-blue-400', inactiveCls: 'text-blue-400/60 border-transparent hover:text-blue-400/80' },
              { key: 'dispatched', label: t('dispatched'), activeCls: 'bg-green-500/80 text-white border-green-400', inactiveCls: 'text-green-400/60 border-transparent hover:text-green-400/80' },
              { key: 'resolved', label: t('resolved'), activeCls: 'bg-cyan-500/80 text-white border-cyan-400', inactiveCls: 'text-cyan-400/60 border-transparent hover:text-cyan-400/80' },
              { key: 'false_alarm', label: t('false_alarm'), activeCls: 'bg-yellow-500/80 text-white border-yellow-400', inactiveCls: 'text-yellow-400/60 border-transparent hover:text-yellow-400/80' },
            ] as const).map(s => (
              <button
                key={s.key}
                onClick={() => setFilter(s.key)}
                className={`text-xs px-2.5 py-1 rounded border transition-colors ${filter === s.key ? s.activeCls : s.inactiveCls}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Sort buttons */}
          {!compact && (
            <div className="flex items-center gap-1.5 mb-2 flex-shrink-0">
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500">
                <ArrowUpDown size={11} /> {t('sort_by')}
              </span>
              {sortButtons.map(({ field, label }) => (
                <button
                  key={field}
                  onClick={() => toggleSort(field)}
                  className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors ${sortField === field ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30' : 'text-gray-400 hover:text-gray-300 border border-transparent'}`}
                >
                  {label}
                  {sortField === field && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                </button>
              ))}
            </div>
          )}

          {/* Cascading filter dropdowns */}
          {!compact && (
            <div className="mb-3 flex-shrink-0">
              <div className="flex items-end gap-1.5 flex-nowrap">
                <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500 pb-1.5 flex-shrink-0">
                  <Filter size={11} />
                </span>
                <div className="flex-1 min-w-0">
                  <FilterDropdown
                    label={t('filter_project')}
                    value={filterProject}
                    options={projectOptions}
                    onChange={handleProjectChange}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <FilterDropdown
                    label={t('filter_site')}
                    value={filterSite}
                    options={siteOptions}
                    onChange={handleSiteChange}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <FilterDropdown
                    label={t('filter_building')}
                    value={filterBuilding}
                    options={buildingOptions}
                    onChange={handleBuildingChange}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <FilterDropdown
                    label={t('filter_block')}
                    value={filterBlock}
                    options={blockOptions}
                    onChange={setFilterBlock}
                  />
                </div>
              </div>
              <div className="flex items-end gap-1.5 mt-1.5">
                <div className="flex-1 min-w-0 max-w-[200px]">
                  <FilterDropdown
                    label={t('equip_category')}
                    value={filterCategory}
                    options={categoryOptions}
                    onChange={setFilterCategory}
                  />
                </div>
                <div className="relative flex items-center justify-center flex-shrink-0 ml-1" style={{ width: '36px', height: '36px' }}>
                  <Bell size={36} className="text-red-500 absolute inset-0 m-auto" fill="currentColor" />
                  <span className="relative z-10 text-white text-xs font-bold leading-none" style={{ fontSize: '11px', transform: 'translateY(-3px)' }}>
                    {resultCount}
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {loading ? (
          <div className="text-gray-500 text-sm text-center py-8">{lang === 'en' ? 'Loading...' : lang === 'zh-CN' ? '加载中...' : '載入中...'}</div>
        ) : effectiveFilter === 'none' ? (
          <div className="flex-1" />
        ) : displayAlarms.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-8">{t('no_alarms')}</div>
        ) : (
          <>
{displayAlarms.map(a => (
              <AlarmRow
                key={a.id}
                alarm={a}
                compact={compact}
                lang={lang}
                dispatched={dispatchedIds.has(a.id)}
                capturing={capturingId === a.id}
                resolving={resolvingId === a.id}
                selected={a.id === selectedAlarmId}
                onSelect={() => setSelectedAlarmId(a.id)}
                onAck={() => { void acknowledge(a.id, userId, userName).catch(reportApiError); }}
                onDispatch={() => handleWhatsAppDispatch(a)}
                onResolve={() => handleResolve(a)}
              />
            ))}
          </>
        )}
      </div>
      </div>
      <AlarmDetailPanel alarm={selectedAlarm} lang={lang} t={t} />
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span className="text-gray-500 flex-shrink-0">{icon}</span>
      <span className="text-gray-400 text-xs flex-shrink-0 min-w-[80px]">{label}</span>
      <span className="text-gray-100 text-xs font-medium truncate">{value || '-'}</span>
    </div>
  );
}

function AlarmInfoBox({ alarm, t }: { alarm: AlarmEvent | null; t: (k: string) => string }) {
  if (!alarm) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-gray-700/30 bg-gray-800/40 min-h-0">
        <div className="text-center">
          <Bell size={20} className="text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">{t('no_alarm_selected')}</p>
        </div>
      </div>
    );
  }

  const device = alarm.devices;
  const site = device?.floors?.buildings?.sites;
  const isDispatched = alarm.status === 'dispatched';
  const isAcknowledged = alarm.status === 'acknowledged';
  const isResolved = alarm.status === 'resolved' || alarm.status === 'false_alarm';

  return (
    <div className="rounded-lg border border-gray-700/30 bg-gray-800/40 overflow-y-auto min-h-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700/30 sticky top-0 bg-gray-800/95 backdrop-blur-sm z-10">
        <Phone size={13} className="text-cyan-400" />
        <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">{t('contact_info')}</span>
      </div>
      <div className="px-3 py-2">
        <InfoRow icon={<Phone size={12} />} label={t('site_contact')} value={site?.contact_phone || '-'} />
        {isAcknowledged && (
          <>
            <InfoRow icon={<User size={12} />} label={t('acknowledged_by')} value={alarm.acknowledged_by_name || '-'} />
            <InfoRow icon={<Clock size={12} />} label={t('acknowledged_at')} value={alarm.acknowledged_at ? new Date(alarm.acknowledged_at).toLocaleString() : '-'} />
          </>
        )}
        {isDispatched && (
          <>
            <InfoRow icon={<User size={12} />} label={t('dispatched_by')} value={alarm.dispatcher_name || '-'} />
            <InfoRow icon={<Phone size={12} />} label={t('dispatcher_contact')} value={alarm.dispatcher_contact || '-'} />
            <InfoRow icon={<Clock size={12} />} label={t('dispatched_at')} value={alarm.dispatched_at ? new Date(alarm.dispatched_at).toLocaleString() : '-'} />
          </>
        )}
        {isResolved && (
          <>
            <InfoRow icon={<User size={12} />} label={t('resolved_by')} value={alarm.resolver_name || '-'} />
            <InfoRow icon={<Phone size={12} />} label={t('resolved_contact')} value={alarm.dispatcher_contact || '-'} />
            <InfoRow icon={<Clock size={12} />} label={t('resolved_at')} value={alarm.resolved_at ? new Date(alarm.resolved_at).toLocaleString() : '-'} />
          </>
        )}
      </div>
    </div>
  );
}

function AlarmFloorPlanBox({ alarm, lang, t }: { alarm: AlarmEvent | null; lang: Language; t: (k: string) => string }) {
  if (!alarm || !alarm.devices) {
    return (
      <div className="flex-1 flex items-center justify-center rounded-lg border border-gray-700/30 bg-gray-800/40 min-h-0">
        <div className="text-center">
          <ImageIcon size={20} className="text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">{t('no_alarm_selected')}</p>
        </div>
      </div>
    );
  }

  const device = alarm.devices;
  const floor = device.floors;
  const buildingId = floor?.buildings?.id;
  const floorId = floor?.id;

  const site = floor?.buildings?.sites;
  const siteName = site ? localName(site.name, site.name_zh, lang) : '';
  const buildingName = floor?.buildings ? localName(floor.buildings.name, floor.buildings.name_zh, lang) : '';
  const floorLabel = floor?.floor_label || '';
  const locationChain = [siteName, buildingName, floorLabel].filter(Boolean).join(' · ');

  return (
    <div className="flex-1 rounded-lg border border-gray-700/30 bg-gray-800/40 flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700/30 flex-shrink-0">
        <ImageIcon size={13} className="text-cyan-400 flex-shrink-0" />
        <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider flex-shrink-0">{t('floor_layout')}</span>
        {locationChain && <span className="text-white text-xs ml-auto truncate">{locationChain}</span>}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {buildingId && floorId ? (
          <FloorPlanPanel
            embedded
            compact
            hideInfoBanner
            buildingId={buildingId}
            initialFloorId={floorId}
            key={`${buildingId}-${floorId}-${alarm.id}`}
            externalDevices={[device]}
            uniformBlueIcons
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <ImageIcon size={20} className="text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 text-xs">
                {lang === 'en' ? 'No floor plan available' : lang === 'zh-CN' ? '无平面图' : '無平面圖'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AlarmDetailPanel({ alarm, lang, t }: { alarm: AlarmEvent | null; lang: Language; t: (k: string) => string }) {
  return (
    <div className="flex flex-col gap-3 min-h-0 overflow-hidden" style={{ width: '50%' }}>
      <div style={{ flex: '0 0 30%' }} className="min-h-0 overflow-hidden flex flex-col">
        <AlarmInfoBox alarm={alarm} t={t} />
      </div>
      <div style={{ flex: '1 1 70%' }} className="min-h-0 overflow-hidden flex flex-col">
        <AlarmFloorPlanBox alarm={alarm} lang={lang} t={t} />
      </div>
    </div>
  );
}
