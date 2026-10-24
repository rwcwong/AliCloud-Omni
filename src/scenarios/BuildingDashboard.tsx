import { apiData } from '../lib/apiData';
import { useApiQuery } from '../hooks/useApiQuery';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Building2, Bell, AlertTriangle, BarChart3 } from 'lucide-react';
import { FireAlarmIcon } from '../components/FireAlarmIcon';
import ReactECharts from 'echarts-for-react';
import { useAuth } from '../lib/auth';
import { useDevices } from '../hooks/useDevices';
import { useAlarms } from '../hooks/useAlarms';
import { useSiteSelector } from '../hooks/useSiteSelector';
import { Building, Floor, Theme, DeviceType, Device } from '../types';
import { useLang, useT } from '../lib/i18n';
import LightBar from '../components/LightBar';
import {
  GlassPanel, PanelHeading, ArtisticBanner, ContactFooter,
} from './OmniOSHome';

const CRITICAL_DEVICE_STATUSES = ['Alarm', 'Activated', 'Panel Fire', 'MCCB Off'];
const FAULT_DEVICE_STATUSES = ['Fault', 'Panel Fault', 'Low Level', 'High Level', 'Low Pressure'];
const NORMAL_DEVICE_STATUSES = ['Normal', 'On', 'Power On', 'Closed', 'Running'];

type BuildingStatus = 'normal' | 'warning' | 'critical' | 'offline';

interface BuildingInfo {
  building: Building;
  deviceCount: number;
  onlineCount: number;
  alarmCount: number;
  faultCount: number;
  offlineCount: number;
  normalCount: number;
  status: BuildingStatus;
}

function localName(name: string, nameZh: string, lang: string): string {
  return lang === 'en' ? name : (nameZh || name);
}

/* ---------- Floor health + trouble building visualization ---------- */

const DEVICE_CATEGORIES: DeviceType['category'][] = ['detection', 'pump', 'water', 'ventilation', 'power_interlocking'];

interface CategoryTrouble {
  category: DeviceType['category'];
  label: string;
  alarmCount: number;
  faultCount: number;
  offlineCount: number;
  total: number;
  devices: Device[];
}

function categoryLabel(cat: DeviceType['category'], lang: string): string {
  const labels: Record<string, Record<string, string>> = {
    detection: { en: 'Detection', 'zh-CN': '探测报警', 'zh-TW': '探測報警' },
    pump: { en: 'Pumps', 'zh-CN': '水泵', 'zh-TW': '水泵' },
    water: { en: 'Water System', 'zh-CN': '水系统', 'zh-TW': '水系統' },
    ventilation: { en: 'Ventilation', 'zh-CN': '通风排烟', 'zh-TW': '通風排煙' },
    power_interlocking: { en: 'Power and Interlocking', 'zh-CN': '电力及联动系统', 'zh-TW': '電力及聯動系統' },
  };
  return labels[cat]?.[lang] ?? labels[cat]?.en ?? cat;
}

function TroubleCategoryChart({
  categoryData, lang,
}: {
  categoryData: CategoryTrouble[];
  lang: string;
}) {
  const chartOption = useMemo(() => {
    const cats = [...categoryData].reverse();
    const yAxisData = cats.map(c => c.label);
    const alarmData = cats.map(c => c.alarmCount);
    const faultData = cats.map(c => c.faultCount);
    const offlineData = cats.map(c => c.offlineCount);

    // Map reversed index back to original category for device lookup
    const reversedCats = cats;

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        position: (point: [number, number], _params: unknown, _dom: HTMLElement, _rect: unknown, size: { contentSize: [number, number]; viewSize: [number, number] }) => {
          const [x, y] = point;
          const [tw, th] = size.contentSize;
          const [vw] = size.viewSize;
          const px = x + tw + 16 > vw ? x - tw - 16 : x + 16;
          const py = y - th - 12 < 0 ? y + 16 : y - th - 12;
          return [px, py];
        },
        confine: true,
        backgroundColor: 'rgba(2,13,37,0.97)',
        borderColor: 'rgba(0,210,255,0.3)',
        textStyle: { color: '#e0f7ff', fontSize: 12 },
        extraCssText: 'max-width:320px;max-height:280px;overflow-y:auto;padding:8px 10px;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.5);',
        formatter: (params: Array<{ name: string; value: number; seriesName: string; marker: string; dataIndex: number }>) => {
          const cat = params[0]?.name ?? '';
          const catInfo = reversedCats[params[0]?.dataIndex ?? 0];
          if (!catInfo) return cat;

          const alarmLabel = lang === 'en' ? 'Alarm' : lang === 'zh-CN' ? '警报' : '警報';
          const faultLabel = lang === 'en' ? 'Fault' : lang === 'zh-CN' ? '故障' : '故障';
          const offlineLabel = lang === 'en' ? 'Offline' : lang === 'zh-CN' ? '离线' : '離線';
          const alarmDevices = catInfo.devices.filter(d => CRITICAL_DEVICE_STATUSES.includes(d.status));
          const faultDevices = catInfo.devices.filter(d => FAULT_DEVICE_STATUSES.includes(d.status));
          const offlineDevices = catInfo.devices.filter(d => d.status === 'Offline');

          const deviceLabel = (d: Device) => {
            const dt = d.device_types;
            if (!dt) return d.label || d.code;
            return lang === 'en' ? dt.name_en : lang === 'zh-CN' ? dt.name_zh : dt.name_zh_tw;
          };
          const deviceLoc = (d: Device) => {
            const fl = d.floors;
            const bldg = fl?.buildings;
            const flLabel = fl?.floor_label ?? '';
            const bldgLabel = bldg ? localName(bldg.name, bldg.name_zh, lang) : '';
            return [bldgLabel, flLabel].filter(Boolean).join(' · ');
          };

          const deviceListHtml = (devs: Device[], label: string, color: string) => {
            if (devs.length === 0) return '';
            let html = `<div style="margin-top:6px;font-size:11px;font-weight:bold;color:${color}">${label} (${devs.length})</div>`;
            for (const d of devs.slice(0, 12)) {
              html += `<div style="font-size:11px;color:rgba(224,247,255,0.85);padding-left:10px;border-left:2px solid ${color};margin:2px 0 2px 2px">${deviceLabel(d)}<span style="color:rgba(224,247,255,0.45);margin-left:4px">${deviceLoc(d)}</span></div>`;
            }
            if (devs.length > 12) {
              html += `<div style="font-size:10px;color:rgba(224,247,255,0.4);padding-left:12px">+${devs.length - 12} more...</div>`;
            }
            return html;
          };

          let html = `<div style="font-weight:bold;margin-bottom:4px;font-size:13px">${cat}</div>`;
          html += deviceListHtml(alarmDevices, alarmLabel, '#ff4668');
          html += deviceListHtml(faultDevices, faultLabel, '#f6c945');
          html += deviceListHtml(offlineDevices, offlineLabel, '#8492a6');
          return html;
        },
      },
      legend: {
        data: [
          lang === 'en' ? 'Alarm' : lang === 'zh-CN' ? '警报' : '警報',
          lang === 'en' ? 'Fault' : lang === 'zh-CN' ? '故障' : '故障',
          lang === 'en' ? 'Offline' : lang === 'zh-CN' ? '离线' : '離線',
        ],
        textStyle: { color: 'rgba(224,247,255,0.7)', fontSize: 11 },
        itemWidth: 10,
        itemHeight: 10,
        top: 0,
        right: 8,
      },
      grid: { left: 8, right: 24, top: 32, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: 'rgba(224,247,255,0.4)', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(0,210,255,0.08)' } },
        minInterval: 1,
      },
      yAxis: {
        type: 'category',
        data: yAxisData,
        axisLine: { lineStyle: { color: 'rgba(0,210,255,0.15)' } },
        axisTick: { show: false },
        axisLabel: {
          color: 'rgba(224,247,255,0.85)',
          fontSize: 12,
          fontWeight: 'bold',
        },
      },
      series: [
        {
          name: lang === 'en' ? 'Alarm' : lang === 'zh-CN' ? '警报' : '警報',
          type: 'bar',
          stack: 'trouble',
          data: alarmData,
          itemStyle: { color: '#ff4668', borderRadius: [3, 0, 0, 3] },
          barWidth: '55%',
          label: {
            show: true,
            position: 'inside',
            color: '#fff',
            fontSize: 11,
            fontWeight: 'bold',
            formatter: (p: { value: number }) => p.value > 0 ? String(p.value) : '',
          },
        },
        {
          name: lang === 'en' ? 'Fault' : lang === 'zh-CN' ? '故障' : '故障',
          type: 'bar',
          stack: 'trouble',
          data: faultData,
          itemStyle: { color: '#f6c945' },
          barWidth: '55%',
          label: {
            show: true,
            position: 'inside',
            color: '#1a1a2e',
            fontSize: 11,
            fontWeight: 'bold',
            formatter: (p: { value: number }) => p.value > 0 ? String(p.value) : '',
          },
        },
        {
          name: lang === 'en' ? 'Offline' : lang === 'zh-CN' ? '离线' : '離線',
          type: 'bar',
          stack: 'trouble',
          data: offlineData,
          itemStyle: { color: '#8492a6', borderRadius: [0, 3, 3, 0] },
          barWidth: '55%',
          label: {
            show: true,
            position: 'inside',
            color: '#fff',
            fontSize: 11,
            fontWeight: 'bold',
            formatter: (p: { value: number }) => p.value > 0 ? String(p.value) : '',
          },
        },
      ],
    };
  }, [categoryData, lang]);

  const totalTrouble = categoryData.reduce((s, c) => s + c.alarmCount + c.faultCount + c.offlineCount, 0);

  if (totalTrouble === 0) {
    return (
      <GlassPanel className="flex min-h-0 flex-1 flex-col rounded-xl border border-cyan-300/10 bg-cyan-300/[0.03]">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-cyan-100/40">
          <BarChart3 size={40} className="opacity-30" />
          <span className="text-sm">{lang === 'en' ? 'All devices normal' : lang === 'zh-CN' ? '所有设备正常' : '所有設備正常'}</span>
        </div>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="flex min-h-0 flex-1 flex-col rounded-xl border border-cyan-300/10 bg-cyan-300/[0.03]">
      <ReactECharts
        option={chartOption}
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    </GlassPanel>
  );
}

/* ---------- Floor health + trouble building visualization ---------- */

interface FloorHealth {
  hasAlarm: boolean;
  hasFault: boolean;
  hasOffline: boolean;
  alarmCount: number;
  faultCount: number;
  offlineCount: number;
}

type FloorDisplayState = {
  bg: string;
  flashClass: string;
  glowClass: string;
};

function floorDisplayState(
  floorId: string,
  h: FloorHealth | undefined,
  activeAlarmFloorIds: Set<string>,
  nonActiveAlarmFloorIds: Set<string>,
  activeFaultFloorIds: Set<string>,
  faultOnlyFloorIds: Set<string>,
): FloorDisplayState {
  if (activeAlarmFloorIds.has(floorId))
    return { bg: '#ff4668', flashClass: 'alarm-flash', glowClass: '' };
  if (nonActiveAlarmFloorIds.has(floorId) && activeFaultFloorIds.has(floorId))
    return { bg: '#f6c945', flashClass: 'fault-flash', glowClass: '' };
  if (nonActiveAlarmFloorIds.has(floorId))
    return { bg: '#ff4668', flashClass: '', glowClass: 'shadow-[0_0_6px_rgba(255,70,104,0.7)]' };
  if (faultOnlyFloorIds.has(floorId))
    return { bg: '#f6c945', flashClass: '', glowClass: 'shadow-[0_0_5px_rgba(246,201,69,0.6)]' };
  if (h?.hasOffline)
    return { bg: '#8492a6', flashClass: '', glowClass: 'shadow-[0_0_3px_rgba(132,146,166,0.4)]' };
  return { bg: 'rgba(57,230,196,0.2)', flashClass: '', glowClass: '' };
}

const BUILDING_FIXED_WIDTH = 180;

function TroubleBuildingsView({
  buildings, floorsByBuilding, floorHealthMap, activeAlarmFloorIds, nonActiveAlarmFloorIds, activeFaultFloorIds, faultOnlyFloorIds, fireAlarmFloorIds, selectedBuildingId, onSelectBuilding, onOpenFloor, lang,
  totalBuildingCount, containerWidth,
}: {
  buildings: BuildingInfo[];
  floorsByBuilding: Map<string, Floor[]>;
  floorHealthMap: Map<string, FloorHealth>;
  activeAlarmFloorIds: Set<string>;
  nonActiveAlarmFloorIds: Set<string>;
  activeFaultFloorIds: Set<string>;
  faultOnlyFloorIds: Set<string>;
  fireAlarmFloorIds: Set<string>;
  selectedBuildingId: string | null;
  onSelectBuilding: (id: string) => void;
  onOpenFloor: (buildingId: string, floorId: string) => void;
  lang: string;
  totalBuildingCount: number;
  containerWidth: number;
}) {
  if (buildings.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-cyan-100/40">
          <Building2 size={48} className="opacity-30" />
          <span className="text-sm">{lang === 'en' ? 'All buildings normal' : lang === 'zh-CN' ? '所有大厦正常' : '所有大廈正常'}</span>
        </div>
      </div>
    );
  }

  const displayCount = buildings.length;
  const slots = Math.max(totalBuildingCount, displayCount);
  const availableWidth = Math.max(containerWidth - 8, displayCount * BUILDING_FIXED_WIDTH);
  const gap = slots > 1
    ? Math.max(8, (availableWidth - slots * BUILDING_FIXED_WIDTH) / (slots - 1))
    : 0;

  return (
    <div
      className="flex h-full items-stretch justify-center p-1"
      style={{ gap: `${gap}px` }}
    >
      {buildings.map(info => {
        const floors = (floorsByBuilding.get(info.building.id) ?? []).slice().reverse();
        const isSelected = selectedBuildingId === info.building.id;
        const isTroubleBldg = info.status !== 'normal';
        const headerColor =
          info.status === 'critical' ? 'bg-red-500/15'
          : info.status === 'warning' ? 'bg-amber-500/15'
          : info.status === 'offline' ? 'bg-slate-500/15'
          : 'bg-emerald-500/10';
        return (
          <div
            key={info.building.id}
            className={`flex min-h-0 flex-col rounded-lg border transition-all ${isSelected ? 'border-cyan-400/40 ring-1 ring-cyan-400/30' : 'border-cyan-300/10 hover:border-cyan-300/25'} bg-cyan-300/[0.02] hover:bg-cyan-300/[0.04]`}
            style={{ width: `${BUILDING_FIXED_WIDTH}px`, flexShrink: 0 }}
          >
            <button
              type="button"
              onClick={() => onSelectBuilding(info.building.id)}
              className={`rounded-t-lg px-3 py-2 text-center ${headerColor} transition-all`}
            >
              <span className={`text-sm text-white ${isTroubleBldg ? 'font-extrabold' : 'font-bold'}`}>{localName(info.building.name, info.building.name_zh, lang)}</span>
            </button>
            <div className="flex min-h-0 flex-1 flex-col gap-px p-1.5">
              {floors.length === 0 ? (
                <div className="flex flex-1 items-center justify-center py-4 text-[10px] text-cyan-100/30">
                  {lang === 'en' ? 'Loading...' : lang === 'zh-CN' ? '加载中...' : '載入中...'}
                </div>
              ) : floors.map(floor => {
                const h = floorHealthMap.get(floor.id);
                const isTrouble = h && (h.hasAlarm || h.hasFault || h.hasOffline);
                const ds = floorDisplayState(floor.id, h, activeAlarmFloorIds, nonActiveAlarmFloorIds, activeFaultFloorIds, faultOnlyFloorIds);
                return (
                  <button
                    key={floor.id}
                    type="button"
                    onClick={() => onOpenFloor(info.building.id, floor.id)}
                    className={`flex flex-1 items-center justify-center rounded-sm px-1.5 text-[11px] font-medium transition-all hover:ring-1 hover:ring-cyan-300/40 ${ds.flashClass} ${ds.glowClass} text-white`}
                    style={{ minHeight: '14px', backgroundColor: ds.bg }}
                  >
                    {isTrouble ? (
                      <span className="flex items-center gap-1.5 font-extrabold text-[#0a1a3a]">
                        {fireAlarmFloorIds.has(floor.id) && (
                          <FireAlarmIcon
                            size={12}
                            className="flex-shrink-0"
                            style={{
                              filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.95)) drop-shadow(0 0 4px rgba(255,255,255,0.7))',
                            }}
                          />
                        )}
                        <span className="truncate">{floor.floor_label}</span>
                        <span>{h!.alarmCount + h!.faultCount + h!.offlineCount}</span>
                      </span>
                    ) : (
                      <span className="truncate opacity-60">{floor.floor_label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Main component ---------- */

interface BuildingDashboardProps {
  siteId: string;
  onBack: () => void;
  onSystemManagement: () => void;
  onAdminConsole: () => void;
  onNavigateDashboard?: () => void;
  onNavigateIpad?: () => void;
  onNavigateAlarms?: (status?: string, siteId?: string, buildingId?: string) => void;
  onNavigateMaintenance?: () => void;
  onNavigateDevices?: () => void;
  onOpenBuilding?: (buildingId: string, floorId?: string) => void;
  theme: Theme;
  onThemeToggle?: () => void;
  onSignOut?: () => void;
}

export function BuildingDashboard({
  siteId, onBack, onSystemManagement, onAdminConsole, onNavigateDashboard, onNavigateIpad, onOpenBuilding, theme, onThemeToggle, onSignOut,
}: BuildingDashboardProps) {
  const { lang, setLang } = useLang();
  const t = useT();
  const { user } = useAuth();
  const { sites } = useSiteSelector(user?.id);
  const { devices } = useDevices();
  const { alarms } = useAlarms();
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const { data: buildings } = useApiQuery('dashboard:buildings:' + siteId, async () =>
    (await apiData.buildings()).filter(building => building.site_id === siteId), [] as Building[]);
  const { data: allFloors } = useApiQuery('dashboard:floors:' + siteId, async () =>
    (await apiData.floors()).filter(floor => floor.buildings?.site_id === siteId), [] as Floor[]);
  useEffect(() => {
    setSelectedBuildingId(current => buildings.some(building => building.id === current) ? current : buildings[0]?.id ?? null);
  }, [buildings]);
  const rightColumnRef = useRef<HTMLDivElement>(null);
  const [rightColumnWidth, setRightColumnWidth] = useState(0);

  useEffect(() => {
    const el = rightColumnRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setRightColumnWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const site = useMemo(() => sites.find(s => s.id === siteId) ?? null, [sites, siteId]);

  // Set of device IDs whose actual DB status is a normal state — used as a
  // ground-truth guard so stale alarm data can't make a Normal device appear
  // as alarmed on the building dashboard.
  const normalDeviceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const d of devices) {
      if (NORMAL_DEVICE_STATUSES.includes(d.status)) ids.add(d.id);
    }
    return ids;
  }, [devices]);

  // Map device_id -> highest active alarm severity, so floor/building health
  // reflects active alarms even when the device.status column is out of sync.
  // Guarded by normalDeviceIds: a device whose DB status is Normal is excluded.
  const deviceAlarmSeverityMap = useMemo(() => {
    const map = new Map<string, 'critical' | 'alarm' | 'fault' | 'high' | 'medium' | 'low'>();
    const order: Record<string, number> = { critical: 4, alarm: 3, fault: 2, high: 3, medium: 2, low: 1 };
    for (const a of alarms) {
      if (a.status !== 'active') continue;
      if (!a.device_id) continue;
      if (normalDeviceIds.has(a.device_id)) continue;
      const existing = map.get(a.device_id);
      if (!existing || order[a.severity] > order[existing]) {
        map.set(a.device_id, a.severity);
      }
    }
    return map;
  }, [alarms, normalDeviceIds]);

  function normalizedStatus(device: Device): string { return device.status; }

  const siteDisplayName = site ? localName(site.name, site.name_zh, lang) : (lang === 'en' ? 'Loading...' : lang === 'zh-CN' ? '加载中...' : '載入中...');

  const fireAlerts = useMemo(() => {
    const entries: { buildingId: string; siteName: string; buildingName: string; floorId: string; floorLabel: string; deviceCode: string }[] = [];
    const seen = new Set<string>();
    for (const a of alarms) {
      if (a.status !== 'active') continue;
      if (a.severity !== 'critical' && a.severity !== 'alarm' && a.severity !== 'high') continue;
      const dev = a.devices;
      if (!dev?.device_types) continue;
      if (normalDeviceIds.has(dev.id)) continue;
      if (dev.device_types.category !== 'detection') continue;
      const floor = dev.floors;
      const building = floor?.buildings;
      if (!floor || !building) continue;
      const key = `${building.id}:${floor.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({
        buildingId: building.id,
        siteName: building.sites ? localName(building.sites.name, building.sites.name_zh, lang) : (lang === 'en' ? 'Unknown' : lang === 'zh-CN' ? '未知' : '未知'),
        buildingName: localName(building.name, building.name_zh, lang),
        floorId: floor.id,
        floorLabel: floor.floor_label,
        deviceCode: dev.code,
      });
    }
    return entries;
  }, [alarms, lang, normalDeviceIds]);

  const buildingInfos = useMemo<BuildingInfo[]>(() => buildings.map(building => {
    const bldgDevices = devices.filter(d => d.floors?.buildings?.id === building.id);
    const alarmCount = bldgDevices.filter(d => CRITICAL_DEVICE_STATUSES.includes(normalizedStatus(d))).length;
    const faultCount = bldgDevices.filter(d => FAULT_DEVICE_STATUSES.includes(normalizedStatus(d))).length;
    const offlineCount = bldgDevices.filter(d => d.status === 'Offline').length;

    const normalCount = Math.max(0, bldgDevices.length - alarmCount - faultCount - offlineCount);
    const status: BuildingStatus = alarmCount > 0 ? 'critical' : faultCount > 0 ? 'warning' : offlineCount === bldgDevices.length && bldgDevices.length > 0 ? 'offline' : 'normal';
    return { building, deviceCount: bldgDevices.length, onlineCount: bldgDevices.length - offlineCount, alarmCount, faultCount, offlineCount, normalCount, status };
  }), [buildings, devices, deviceAlarmSeverityMap]);

  const floorsByBuilding = useMemo(() => {
    const map = new Map<string, Floor[]>();
    for (const floor of allFloors) {
      const arr = map.get(floor.building_id) ?? [];
      arr.push(floor);
      map.set(floor.building_id, arr);
    }
    return map;
  }, [allFloors]);

  const floorHealthMap = useMemo(() => {
    const map = new Map<string, FloorHealth>();
    for (const floor of allFloors) {
      const floorDevices = devices.filter(d => d.floor_id === floor.id);
      const alarmCount = floorDevices.filter(d => CRITICAL_DEVICE_STATUSES.includes(normalizedStatus(d))).length;
      const faultCount = floorDevices.filter(d => FAULT_DEVICE_STATUSES.includes(normalizedStatus(d))).length;
      const offlineCount = floorDevices.filter(d => d.status === 'Offline').length;

      map.set(floor.id, {
        hasAlarm: alarmCount > 0,
        hasFault: faultCount > 0,
        hasOffline: offlineCount > 0,
        alarmCount, faultCount, offlineCount,
      });
    }
    return map;
  }, [allFloors, devices, deviceAlarmSeverityMap]);

  const activeAlarmFloorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of alarms) {
      if (a.status !== 'active') continue;
      if (a.severity !== 'critical' && a.severity !== 'alarm' && a.severity !== 'high') continue;
      const dev = a.devices;
      if (!dev) continue;
      if (normalDeviceIds.has(dev.id)) continue;
      if (dev.floor_id) ids.add(dev.floor_id);
    }
    return ids;
  }, [alarms, normalDeviceIds]);

  // Floors with active fault alarms (medium/low severity) but no active
  // critical/high alarm — these should flash yellow instead of red.
  const activeFaultFloorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of alarms) {
      if (a.status !== 'active') continue;
      if (a.severity === 'critical' || a.severity === 'alarm' || a.severity === 'high') continue;
      const dev = a.devices;
      if (!dev) continue;
      if (normalDeviceIds.has(dev.id)) continue;
      if (dev.floor_id && !activeAlarmFloorIds.has(dev.floor_id)) ids.add(dev.floor_id);
    }
    return ids;
  }, [alarms, activeAlarmFloorIds, normalDeviceIds]);

  // Floors with non-active alarms (acknowledged/dispatched, critical/high severity)
  // but no active alarm on that floor — rules 2 & 3.
  const nonActiveAlarmFloorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of alarms) {
      if (a.status !== 'acknowledged' && a.status !== 'dispatched' && a.status !== 'false_alarm') continue;
      if (a.severity !== 'critical' && a.severity !== 'alarm' && a.severity !== 'high') continue;
      const dev = a.devices;
      if (!dev) continue;
      if (normalDeviceIds.has(dev.id)) continue;
      if (dev.floor_id && !activeAlarmFloorIds.has(dev.floor_id)) ids.add(dev.floor_id);
    }
    return ids;
  }, [alarms, activeAlarmFloorIds, normalDeviceIds]);

  // Floors with fault (device fault status or medium/low alarm events) but no
  // critical/high alarm events at all — rule 4.
  const faultOnlyFloorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const floor of allFloors) {
      if (activeAlarmFloorIds.has(floor.id) || nonActiveAlarmFloorIds.has(floor.id)) continue;
      const floorDevices = devices.filter(d => d.floor_id === floor.id);
      const hasFaultDevice = floorDevices.some(d => FAULT_DEVICE_STATUSES.includes(normalizedStatus(d)));
      const hasFaultEvent = alarms.some(a => {
        if (a.status === 'resolved' || a.status === 'false_alarm') return false;
        if (a.severity !== 'fault' && a.severity !== 'medium' && a.severity !== 'low') return false;
        const dev = a.devices;
        if (!dev || normalDeviceIds.has(dev.id)) return false;
        return dev.floor_id === floor.id;
      });
      if (hasFaultDevice || hasFaultEvent) ids.add(floor.id);
    }
    return ids;
  }, [allFloors, devices, alarms, activeAlarmFloorIds, nonActiveAlarmFloorIds, normalDeviceIds]);

  // Floors that have active fire alarms (from SD/HD/GD detectors with critical/high severity)
  const fireAlarmFloorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of alarms) {
      if (a.status !== 'active') continue;
      if (a.severity !== 'critical' && a.severity !== 'alarm' && a.severity !== 'high') continue;
      const dev = a.devices;
      if (!dev?.device_types) continue;
      if (normalDeviceIds.has(dev.id)) continue;
      if (dev.device_types.category !== 'detection') continue;
      if (dev.floor_id) ids.add(dev.floor_id);
    }
    return ids;
  }, [alarms, normalDeviceIds]);

  const siteBuildingIds = useMemo(
    () => new Set(buildings.map(b => b.id)),
    [buildings],
  );

  const siteDevices = useMemo(
    () => devices.filter(d => siteBuildingIds.has(d.floors?.buildings?.id ?? '')),
    [devices, siteBuildingIds],
  );

  const onlinePercent = siteDevices.length
    ? Math.round((siteDevices.filter(d => d.status !== 'Offline').length / siteDevices.length) * 100)
    : 0;

  const troubleCategoryData = useMemo<CategoryTrouble[]>(() => {
    return DEVICE_CATEGORIES.map(cat => {
      const catDevices = siteDevices.filter(d => d.device_types?.category === cat);
      const alarmCount = catDevices.filter(d => CRITICAL_DEVICE_STATUSES.includes(normalizedStatus(d))).length;
      const faultCount = catDevices.filter(d => FAULT_DEVICE_STATUSES.includes(normalizedStatus(d))).length;
      const offlineCount = catDevices.filter(d => d.status === 'Offline').length;

      const isTrouble = (d: Device) => {
        const ns = normalizedStatus(d);
        return CRITICAL_DEVICE_STATUSES.includes(ns) ||
          FAULT_DEVICE_STATUSES.includes(ns) ||
          d.status === 'Offline';
      };
      return {
        category: cat,
        label: categoryLabel(cat, lang),
        alarmCount,
        faultCount,
        offlineCount,
        total: alarmCount + faultCount + offlineCount,
        devices: catDevices.filter(isTrouble),
      };
    });
  }, [siteDevices, lang, deviceAlarmSeverityMap]);

  function selectBuilding(id: string) {
    setSelectedBuildingId(id);
    onOpenBuilding?.(id);
  }

  function openFloor(buildingId: string, floorId: string) {
    setSelectedBuildingId(buildingId);
    onOpenBuilding?.(buildingId, floorId);
  }

  return (
    <div
      className="relative flex h-full min-h-[720px] flex-col overflow-hidden rounded-2xl bg-[#020d25] text-white"
      style={{
        backgroundImage:
          'radial-gradient(ellipse at 20% 0%, rgba(0,163,255,0.18), transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(0,229,196,0.12), transparent 50%), radial-gradient(circle at 50% 50%, rgba(0,199,255,0.08), transparent 60%), linear-gradient(160deg, #020d25 0%, #052b5c 30%, #031535 65%, #020a20 100%)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(57,230,196,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(57,230,196,0.08)_1px,transparent_1px)] [background-size:46px_46px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-cyan-400/[0.06] to-transparent" />

      <LightBar />

      <div className="relative flex min-h-0 flex-1 flex-col gap-2 p-3">
        <div className="flex-shrink-0">
          <ArtisticBanner
            onBack={onBack}
            onSystemManagement={onSystemManagement}
            onAdminConsole={onAdminConsole}
            onNavigateDashboard={onNavigateDashboard}
            onNavigateIpad={onNavigateIpad}
            userName={user?.email ?? 'Guest'}
            isOnline={onlinePercent > 0}
            theme={theme}
            onThemeToggle={onThemeToggle}
            lang={lang}
            setLang={setLang}
            t={t}
            onSignOut={onSignOut}
          />
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-auto lg:flex-row lg:gap-3">
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(ellipse_at_50%_40%,rgba(0,199,255,0.1),transparent_70%)]" />

          {/* Left column (30%) — site name + trouble devices per category chart */}
          <div className="relative flex min-h-0 flex-col gap-2 lg:flex-[3_10_0%] lg:min-w-0">
            <div className="flex flex-col gap-0">
              <div className="flex items-center justify-between px-1 py-3">
                <div className="flex items-center gap-3">
                  <div className="group relative inline-flex items-center text-left">
                    <svg
                      className="absolute inset-0 h-full w-full"
                      viewBox="0 0 200 56"
                      preserveAspectRatio="none"
                      style={{ filter: 'drop-shadow(0 0 4px rgba(0,210,255,0.8)) drop-shadow(0 0 10px rgba(0,210,255,0.5)) drop-shadow(0 0 18px rgba(0,210,255,0.3))' }}
                    >
                      <defs>
                        <linearGradient id="bldgTrapFill" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="rgba(2,13,37,0.95)" />
                          <stop offset="100%" stopColor="rgba(6,28,61,0.85)" />
                        </linearGradient>
                        <linearGradient id="bldgTrapStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="rgba(0,210,255,0.9)" />
                          <stop offset="50%" stopColor="rgba(0,229,196,1)" />
                          <stop offset="100%" stopColor="rgba(0,210,255,0.7)" />
                        </linearGradient>
                      </defs>
                      <polygon
                        points="2,2 198,2 150,54 2,54"
                        fill="url(#bldgTrapFill)"
                        stroke="url(#bldgTrapStroke)"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="relative rounded-md bg-cyan-400/10 p-1.5 text-cyan-300">
                      <Building2 size={15} />
                    </span>
                    <span className="relative whitespace-nowrap py-2 pl-3 pr-16">
                      <span className="block text-xs font-bold uppercase tracking-[0.2em] text-cyan-100/80">
                        {siteDisplayName}
                      </span>
                      <span className="block text-[11px] text-cyan-100/45">
                        {site ? `${buildings.length} ${lang === 'en' ? 'buildings' : lang === 'zh-CN' ? '栋大厦' : '棟大廈'}` : (lang === 'en' ? 'Loading...' : lang === 'zh-CN' ? '加载中...' : '載入中...')}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
              {/* Chart header with alarm/fault totals */}
              <div className="flex items-center gap-2 px-1 py-1.5">
                <PanelHeading icon={BarChart3}>
                  {lang === 'en' ? 'Trouble by Category' : lang === 'zh-CN' ? '异常设备分类' : '異常設備分類'}
                  <span className="ml-3 flex items-center gap-3 text-[11px] font-normal text-cyan-100/50">
                    <span className="flex items-center gap-1">
                      <AlertTriangle size={11} className="text-rose-400" />
                      <span className="font-bold text-rose-300">{troubleCategoryData.reduce((s, c) => s + c.alarmCount, 0)}</span> {lang === 'en' ? 'alarms' : lang === 'zh-CN' ? '警报' : '警報'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Bell size={11} className="text-amber-400" />
                      <span className="font-bold text-amber-300">{troubleCategoryData.reduce((s, c) => s + c.faultCount, 0)}</span> {lang === 'en' ? 'faults' : lang === 'zh-CN' ? '故障' : '故障'}
                    </span>
                  </span>
                </PanelHeading>
              </div>
            </div>
            <div className="mt-1 flex min-h-0 flex-1 flex-col">
              <TroubleCategoryChart
                categoryData={troubleCategoryData}
                lang={lang}
              />
            </div>
          </div>

          {/* Right column (70%) — trouble buildings floor-by-floor visualization */}
          <div ref={rightColumnRef} className="relative flex min-h-0 flex-col lg:flex-[7_10_0%] lg:min-w-0">
            <GlassPanel className="flex min-h-0 flex-1 flex-col rounded-xl border border-cyan-300/10 bg-cyan-300/[0.03]">
              {fireAlerts.length > 0 && (
                <div className="flex items-center gap-3 border-b border-red-500/30 bg-red-950/40 px-3 py-2">
                  <FireAlarmIcon size={36} className="fire-icon-pulse flex-shrink-0 text-red-500" />
                  <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
                    {fireAlerts.map((fa, i) => (
                      <button
                        key={`${fa.buildingId}:${fa.floorId}:${i}`}
                        type="button"
                        onClick={() => openFloor(fa.buildingId, fa.floorId)}
                        className="fire-flash flex flex-shrink-0 items-center gap-1.5 rounded-md border-2 border-red-500 bg-red-900/60 px-3 py-1.5 text-sm font-bold text-white transition-transform hover:scale-105"
                      >
                        <FireAlarmIcon size={14} className="flex-shrink-0 text-red-400" />
                        <div className="flex flex-col items-start text-left leading-tight">
                          <span className="text-[11px] text-red-200/70">{fa.siteName} · {fa.buildingName} · {fa.floorLabel}</span>
                          <span className="text-xs font-mono font-bold text-red-100">{fa.deviceCode}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 border-b border-cyan-300/10 px-3 py-2">
                <PanelHeading icon={AlertTriangle}>
                  {lang === 'en' ? 'Trouble Buildings' : lang === 'zh-CN' ? '异常大厦' : '異常大廈'}
                  <span className="ml-2 text-white/60">{buildingInfos.filter(b => b.status !== 'normal').length}</span>
                </PanelHeading>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden p-1">
                <TroubleBuildingsView
                  buildings={buildingInfos.filter(b => b.status !== 'normal')}
                  floorsByBuilding={floorsByBuilding}
                  floorHealthMap={floorHealthMap}
                  activeAlarmFloorIds={activeAlarmFloorIds}
                  nonActiveAlarmFloorIds={nonActiveAlarmFloorIds}
                  activeFaultFloorIds={activeFaultFloorIds}
                  faultOnlyFloorIds={faultOnlyFloorIds}
                  fireAlarmFloorIds={fireAlarmFloorIds}
                  selectedBuildingId={selectedBuildingId}
                  onSelectBuilding={selectBuilding}
                  onOpenFloor={openFloor}
                  lang={lang}
                  totalBuildingCount={buildingInfos.length}
                  containerWidth={rightColumnWidth}
                />
              </div>
            </GlassPanel>
          </div>
        </div>

        <div className="flex-shrink-0">
          <ContactFooter />
        </div>
      </div>
    </div>
  );
}
