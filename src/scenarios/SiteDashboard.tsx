import { useState, useMemo, useEffect, useCallback } from 'react';
import { Building2, Cpu, Wifi, Bell, AlertTriangle, Wrench, Activity,
  CheckCircle2, XCircle, Server, Layers } from 'lucide-react';
import { useDevices } from '../hooks/useDevices';
import { useAlarms } from '../hooks/useAlarms';
import { usePredictions } from '../hooks/usePredictions';
import { SiteWithBuildings } from '../hooks/useSiteSelector';
import { ControlRoom, ControlRoomType, Device, AlarmEvent, MaintenancePrediction, Theme, Project } from '../types';
import { apiClient } from '../lib/apiCompat';
import { useT, useLang } from '../lib/i18n';
import { translateAlarmType, translateDescription } from '../lib/alarmI18n';
import { timeAgo } from '../lib/timeAgo';
import { PerformanceScore } from '../components/PerformanceScore';

const CRITICAL_DEVICE_STATUSES = ['Alarm', 'Activated', 'Panel Fire', 'MCCB Off'];
const FAULT_DEVICE_STATUSES = ['Fault', 'Panel Fault', 'Low Level', 'High Level', 'Low Pressure'];

type ItemStatus = 'normal' | 'warning' | 'critical' | 'offline';

interface BuildingInfo {
  id: string;
  name: string;
  name_zh: string;
  total_floors: number;
  deviceCount: number;
  onlineCount: number;
  alarmCount: number;
  faultCount: number;
  controlRoomCount: number;
  status: ItemStatus;
}

interface ControlRoomInfo {
  id: string;
  name: string;
  name_zh: string;
  room_type: ControlRoomType;
  status: ControlRoom['status'];
  buildingName: string;
  deviceCount: number;
  alarmCount: number;
}

function localizedName(name: string, nameZh: string | null | undefined, lang: string): string {
  return lang === 'en' ? name : (nameZh || name);
}

function statusDotClass(status: ItemStatus): string {
  switch (status) {
    case 'critical': return 'bg-red-500 animate-pulse';
    case 'warning': return 'bg-yellow-400';
    case 'offline': return 'bg-gray-500';
    default: return 'bg-green-500';
  }
}

function statusBgClass(status: ItemStatus): string {
  switch (status) {
    case 'critical': return 'border-red-500/50 bg-red-500/[0.08]';
    case 'warning': return 'border-yellow-500/40 bg-yellow-500/[0.05]';
    case 'offline': return 'border-gray-600/40 bg-gray-700/20';
    default: return 'border-gray-800/60 bg-gray-900/30';
  }
}

function classifyBuildingStatus(devices: Device[], alarms: AlarmEvent[]): ItemStatus {
  const alarmCount = devices.filter(d => CRITICAL_DEVICE_STATUSES.includes(d.status)).length
    + alarms.filter(a => a.severity === 'critical' || a.severity === 'alarm' || a.severity === 'high').length;
  const faultCount = devices.filter(d => FAULT_DEVICE_STATUSES.includes(d.status)).length;
  const offlineCount = devices.filter(d => d.status === 'Offline').length;
  if (alarmCount > 0) return 'critical';
  if (faultCount > 0) return 'warning';
  if (offlineCount === devices.length && devices.length > 0) return 'offline';
  return 'normal';
}

const ROOM_TYPE_KEY: Record<ControlRoomType, string> = {
  pump: 'pump_room',
  ventilation: 'ventilation',
  elevator: 'elevator',
  electrical: 'electrical',
};

function roomTypeLabel(type: ControlRoomType, t: (key: string) => string): string {
  const key = ROOM_TYPE_KEY[type];
  return key ? t(key) : type;
}

function BuildingListItem({ info, isSelected, onClick }: {
  info: BuildingInfo;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-3 transition-all ${
        isSelected ? 'border-blue-500/50 bg-blue-500/[0.08]' : statusBgClass(info.status) + ' hover:border-gray-600/50'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDotClass(info.status)}`} />
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold truncate ${info.status === 'critical' ? 'text-red-300' : 'text-white'}`}>
            {info.name_zh || info.name}
          </div>
          <div className="text-xs text-gray-500 truncate">{info.name}</div>
        </div>
        {info.alarmCount > 0 && (
          <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold flex-shrink-0">
            {info.alarmCount}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs">
        <span className="flex items-center gap-1 text-gray-400">
          <Layers size={11} /> {info.total_floors}F
        </span>
        <span className="flex items-center gap-1 text-cyan-300">
          <Wifi size={11} /> {info.onlineCount}/{info.deviceCount}
        </span>
        {info.controlRoomCount > 0 && (
          <span className="flex items-center gap-1 text-blue-400">
            <Cpu size={11} /> {info.controlRoomCount}
          </span>
        )}
      </div>
    </button>
  );
}

function ControlRoomListItem({ info, isSelected, onClick }: {
  info: ControlRoomInfo;
  isSelected: boolean;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-3 transition-all ${
        isSelected ? 'border-blue-500/50 bg-blue-500/[0.08]' : 'border-gray-800/60 bg-gray-900/30 hover:border-gray-600/50'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${info.status === 'active' ? 'bg-green-500' : info.status === 'maintenance' ? 'bg-yellow-400' : 'bg-gray-500'}`} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{info.name_zh || info.name}</div>
          <div className="text-xs text-gray-500 truncate">{roomTypeLabel(info.room_type, t)} · {info.buildingName}</div>
        </div>
        {info.alarmCount > 0 && (
          <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold flex-shrink-0">
            {info.alarmCount}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs">
        <span className="flex items-center gap-1 text-cyan-300">
          <Wifi size={11} /> {info.deviceCount}
        </span>
        {info.alarmCount > 0 && (
          <span className="text-red-400 font-medium">{info.alarmCount} {t('dash_alarms_col')}</span>
        )}
      </div>
    </button>
  );
}

function SiteSystemData({ devices, buildingCount, controlRoomCount }: {
  devices: Device[];
  buildingCount: number;
  controlRoomCount: number;
}) {
  const t = useT();
  const total = devices.length;
  const online = devices.filter(d => d.status !== 'Offline').length;
  const alarms = devices.filter(d => CRITICAL_DEVICE_STATUSES.includes(d.status)).length;
  const faults = devices.filter(d => FAULT_DEVICE_STATUSES.includes(d.status)).length;
  const onlinePct = total > 0 ? Math.round((online / total) * 100) : 0;

  const stats = [
    { label: t('dash_connected_devices'), value: `${online}/${total}`, icon: Wifi, color: 'text-cyan-400', bg: 'bg-cyan-500/15 border-cyan-500/20' },
    { label: t('dash_active_alarms'), value: alarms, icon: Bell, color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/20' },
    { label: t('dash_faults_col'), value: faults, icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/20' },
    { label: t('site_buildings'), value: buildingCount, icon: Building2, color: 'text-blue-400', bg: 'bg-blue-500/15 border-blue-500/20' },
  ];

  return (
    <div className="bg-gray-900/60 border border-gray-800/50 rounded-xl p-4 flex-shrink-0">
      <div className="flex items-center gap-2 mb-3">
        <Activity size={14} className="text-cyan-400" />
        <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">{t('site_overview')}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`rounded-lg border p-2.5 ${bg}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Icon size={12} className={color} />
              <span className="text-[10px] text-gray-500 uppercase tracking-wider truncate">{label}</span>
            </div>
            <div className={`text-lg font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">{t('dash_devices_online')}</span>
          <span className="text-white font-semibold">{onlinePct}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-green-500 transition-all" style={{ width: `${onlinePct}%` }} />
        </div>
      </div>
      {controlRoomCount > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
          <Cpu size={11} /> {controlRoomCount} {t('site_control_rooms')}
        </div>
      )}
    </div>
  );
}

function SiteAlarms({ alarms }: { alarms: AlarmEvent[] }) {
  const t = useT();
  const { lang } = useLang();
  const recent = alarms.slice(0, 8);
  return (
    <div className="bg-gray-900/60 border border-gray-800/50 rounded-xl flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-red-400" />
          <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">{t('dash_recent_alerts')}</span>
          {alarms.filter(a => a.status === 'active').length > 0 && (
            <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold animate-pulse">
              {alarms.filter(a => a.status === 'active').length}
            </span>
          )}
        </div>
      </div>
      <div className="overflow-auto px-3 pb-3 space-y-2 flex-1 min-h-0">
        {recent.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-8">{t('dash_no_alerts')}</div>
        ) : recent.map(a => {
          const device = a.devices;
          const location = device?.floors
            ? `${device.floors.buildings?.name_zh || device.floors.buildings?.name || ''} · ${device.floors.floor_label}`
            : '—';
          const bar = (a.severity === 'critical' || a.severity === 'alarm') ? 'bg-red-500' : a.severity === 'high' ? 'bg-orange-500' : (a.severity === 'medium' || a.severity === 'fault') ? 'bg-yellow-500' : 'bg-blue-500';
          return (
            <div key={a.id} className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${a.status === 'active' ? 'bg-red-500/5 border-red-500/20' : 'bg-gray-800/40 border-gray-700/30'}`}>
              <div className={`w-1.5 self-stretch rounded-full flex-shrink-0 ${bar}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(() => {
                    const isFault = (a.alarm_type ?? '').toLowerCase().includes('fault');
                    return (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border ${isFault ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' : 'bg-red-500/20 text-red-300 border-red-500/40'}`}>
                        {isFault ? t('Fault') : t('Alarm')}
                      </span>
                    );
                  })()}
                  <span className="text-white text-sm font-medium truncate">{translateAlarmType(a.alarm_type, a.devices, lang, t)}</span>
                </div>
                <p className="text-gray-400 text-xs mt-0.5 truncate">{translateDescription(a.description, a.devices, lang, t)}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-gray-500 text-xs">{device?.code || '—'}</span>
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
    </div>
  );
}

function SiteMaintenance({ predictions }: { predictions: MaintenancePrediction[] }) {
  const t = useT();
  const pending = predictions.filter(p => p.status === 'pending').slice(0, 6);
  return (
    <div className="bg-gray-900/60 border border-gray-800/50 rounded-xl flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Wrench size={14} className="text-orange-400" />
          <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">{t('dash_maintenance_actions')}</span>
          {predictions.filter(p => p.status === 'pending').length > 0 && (
            <span className="bg-orange-500/20 text-orange-400 text-[10px] rounded-full px-1.5 py-0.5 border border-orange-500/30">
              {predictions.filter(p => p.status === 'pending').length}
            </span>
          )}
        </div>
      </div>
      <div className="overflow-auto px-3 pb-3 space-y-2 flex-1 min-h-0">
        {pending.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-8">{t('dash_no_maintenance')}</div>
        ) : pending.map(p => {
          const pct = Math.round(p.fault_probability * 100);
          const barColor = pct > 70 ? '#ef4444' : pct > 40 ? '#eab308' : '#22c55e';
          const device = p.devices;
          return (
            <div key={p.id} className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-2.5">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">{p.prediction_type}</div>
                  <div className="text-xs text-gray-500">{device?.code} · {device?.floors?.floor_label || '—'}</div>
                </div>
                <span className="text-xs font-bold flex-shrink-0" style={{ color: barColor }}>{pct}%</span>
              </div>
              <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BuildingDetailPanel({ building, devices, controlRooms }: {
  building: BuildingInfo | null;
  devices: Device[];
  controlRooms: ControlRoomInfo[];
}) {
  const t = useT();
  const { lang } = useLang();

  if (!building) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-0">
        <div className="text-center">
          <Building2 size={40} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">{t('site_select_building')}</p>
        </div>
      </div>
    );
  }

  const buildingDevices = devices.filter(d =>
    d.floors?.buildings?.id === building.id
  );
  const buildingControlRooms = controlRooms.filter(cr => cr.buildingName === (building.name_zh || building.name));
  const total = buildingDevices.length;
  const online = buildingDevices.filter(d => d.status !== 'Offline').length;
  const alarms = buildingDevices.filter(d => CRITICAL_DEVICE_STATUSES.includes(d.status)).length;
  const faults = buildingDevices.filter(d => FAULT_DEVICE_STATUSES.includes(d.status)).length;

  return (
    <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-gray-900/60 border border-gray-800/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800/50 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <span className={`w-3 h-3 rounded-full flex-shrink-0 ${statusDotClass(building.status)}`} />
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{building.name_zh || building.name}</div>
            <div className="text-xs text-gray-500 truncate">{building.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-2.5 text-xs">
          <span className="flex items-center gap-1 text-gray-400">
            <Layers size={11} /> {building.total_floors} {t('site_buildings_count')}
          </span>
          <span className="flex items-center gap-1 text-cyan-300">
            <Wifi size={11} /> {online}/{total}
          </span>
          {alarms > 0 && <span className="text-red-400 font-medium">{alarms} {t('dash_alarms_col')}</span>}
          {faults > 0 && <span className="text-yellow-400">{faults} {t('dash_faults_col')}</span>}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 min-h-0">
        {/* Device status grid */}
        <div className="grid grid-cols-4 gap-2.5 mb-4">
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2.5 text-center">
            <CheckCircle2 size={16} className="text-green-400 mx-auto mb-1" />
            <div className="text-lg font-bold text-green-400">{total - alarms - faults}</div>
            <div className="text-[10px] text-gray-500 uppercase">{t('dash_normal')}</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 text-center">
            <AlertTriangle size={16} className="text-red-400 mx-auto mb-1" />
            <div className="text-lg font-bold text-red-400">{alarms}</div>
            <div className="text-[10px] text-gray-500 uppercase">{t('dash_alarm')}</div>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2.5 text-center">
            <AlertTriangle size={16} className="text-yellow-400 mx-auto mb-1" />
            <div className="text-lg font-bold text-yellow-400">{faults}</div>
            <div className="text-[10px] text-gray-500 uppercase">{t('dash_fault')}</div>
          </div>
          <div className="bg-gray-600/10 border border-gray-600/20 rounded-lg p-2.5 text-center">
            <XCircle size={16} className="text-gray-400 mx-auto mb-1" />
            <div className="text-lg font-bold text-gray-400">{total - online}</div>
            <div className="text-[10px] text-gray-500 uppercase">{t('dash_offline')}</div>
          </div>
        </div>

        {/* Control rooms in this building */}
        {buildingControlRooms.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Cpu size={12} className="text-blue-400" /> {t('site_control_rooms')}
            </div>
            <div className="space-y-2">
              {buildingControlRooms.map(cr => (
                <div key={cr.id} className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-2.5 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/15 border border-blue-500/20 flex-shrink-0">
                    <Server size={14} className="text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{cr.name_zh || cr.name}</div>
                    <div className="text-xs text-gray-500">{roomTypeLabel(cr.room_type, t)}</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs flex-shrink-0">
                    <span className="text-cyan-300">{cr.deviceCount} {t('dash_devices')}</span>
                    {cr.alarmCount > 0 && <span className="text-red-400 font-medium">{cr.alarmCount}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Device list */}
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Activity size={12} className="text-cyan-400" /> {t('dash_connected_devices')}
          </div>
          <div className="space-y-1.5">
            {buildingDevices.slice(0, 20).map(d => (
              <div key={d.id} className="flex items-center gap-2.5 bg-gray-800/30 border border-gray-700/20 rounded-lg px-3 py-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  CRITICAL_DEVICE_STATUSES.includes(d.status) ? 'bg-red-500' :
                  FAULT_DEVICE_STATUSES.includes(d.status) ? 'bg-yellow-400' :
                  d.status === 'Offline' ? 'bg-gray-500' : 'bg-green-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-white font-medium truncate">{d.code}</span>
                  <span className="text-xs text-gray-500 ml-2 truncate">{d.label}</span>
                </div>
                <span className={`text-xs flex-shrink-0 ${
                  CRITICAL_DEVICE_STATUSES.includes(d.status) ? 'text-red-400' :
                  FAULT_DEVICE_STATUSES.includes(d.status) ? 'text-yellow-400' :
                  d.status === 'Offline' ? 'text-gray-500' : 'text-green-400'
                }`}>{t(d.status)}</span>
              </div>
            ))}
            {buildingDevices.length > 20 && (
              <div className="text-center text-xs text-gray-500 py-2">
                + {buildingDevices.length - 20} {lang === 'en' ? 'more devices' : lang === 'zh-CN' ? '更多设备' : '更多設備'}
              </div>
            )}
            {buildingDevices.length === 0 && (
              <div className="text-center text-sm text-gray-500 py-6">{t('dash_no_alerts')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SiteDashboard({
  site,
  theme,
}: {
  site: SiteWithBuildings;
  project: Project | null;
  onBack: () => void;
  onSelectBuilding: (buildingId: string) => void;
  theme: Theme;
}) {
  const t = useT();
  const { lang } = useLang();
  const isLight = theme === 'light';
  const { devices } = useDevices();
  const { alarms } = useAlarms();
  const { predictions } = usePredictions();
  const [controlRooms, setControlRooms] = useState<ControlRoom[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [selectedControlRoomId, setSelectedControlRoomId] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState<'buildings' | 'controlrooms'>('buildings');

  // Fetch control rooms for this site
  const loadControlRooms = useCallback(async () => {
    if (!site.buildings.length) return;
    const buildingIds = site.buildings.map(b => b.id);
    const { data } = await apiClient
      .from('control_rooms')
      .select('*, buildings(id, name, name_zh, site_id)')
      .in('building_id', buildingIds)
      .order('name');
    if (data) setControlRooms(data as ControlRoom[]);
  }, [site.buildings]);

  useEffect(() => { loadControlRooms(); }, [loadControlRooms]);

  // Auto-select first building
  useEffect(() => {
    if (!selectedBuildingId && site.buildings.length > 0) {
      setSelectedBuildingId(site.buildings[0].id);
    }
    if (selectedBuildingId && !site.buildings.some(b => b.id === selectedBuildingId)) {
      setSelectedBuildingId(site.buildings[0]?.id ?? null);
    }
  }, [site.buildings, selectedBuildingId]);

  // Build building info
  const buildingInfos: BuildingInfo[] = useMemo(() => {
    return site.buildings.map(building => {
      const buildingDevices = devices.filter(d => d.floors?.buildings?.id === building.id);
      const buildingAlarms = alarms.filter(a => a.status === 'active' && a.devices?.floors?.buildings?.id === building.id);
      const crCount = controlRooms.filter(cr => cr.building_id === building.id).length;
      const status = classifyBuildingStatus(buildingDevices, buildingAlarms);
      return {
        id: building.id,
        name: building.name,
        name_zh: building.name_zh,
        total_floors: building.total_floors,
        deviceCount: buildingDevices.length,
        onlineCount: buildingDevices.filter(d => d.status !== 'Offline').length,
        alarmCount: buildingDevices.filter(d => CRITICAL_DEVICE_STATUSES.includes(d.status)).length + buildingAlarms.filter(a => a.severity === 'critical' || a.severity === 'alarm' || a.severity === 'high').length,
        faultCount: buildingDevices.filter(d => FAULT_DEVICE_STATUSES.includes(d.status)).length,
        controlRoomCount: crCount,
        status,
      };
    });
  }, [site.buildings, devices, alarms, controlRooms]);

  // Build control room info
  const controlRoomInfos: ControlRoomInfo[] = useMemo(() => {
    return controlRooms.map(cr => {
      const building = site.buildings.find(b => b.id === cr.building_id);
      const crDevices = devices.filter(d => d.control_room_id === cr.id);
      const crAlarms = alarms.filter(a => a.status === 'active' && a.devices?.control_room_id === cr.id);
      return {
        id: cr.id,
        name: cr.name,
        name_zh: cr.name_zh,
        room_type: cr.room_type,
        status: cr.status,
        buildingName: building?.name_zh || building?.name || '—',
        deviceCount: crDevices.length,
        alarmCount: crAlarms.filter(a => a.severity === 'critical' || a.severity === 'alarm' || a.severity === 'high').length,
      };
    });
  }, [controlRooms, site.buildings, devices, alarms]);

  // Filter alarms & predictions for this site
  const siteAlarms = useMemo(() => {
    const siteId = site.id;
    return alarms.filter(a => a.devices?.floors?.buildings?.site_id === siteId);
  }, [alarms, site.id]);

  const sitePredictions = useMemo(() => {
    const buildingIds = new Set(site.buildings.map(b => b.id));
    return predictions.filter(p => {
      const buildingId = p.devices?.floors?.buildings?.id;
      return buildingId && buildingIds.has(buildingId);
    });
  }, [predictions, site.buildings]);

  const siteDevices = useMemo(() => {
    const siteId = site.id;
    return devices.filter(d => d.floors?.buildings?.site_id === siteId);
  }, [devices, site.id]);

  const selectedBuilding = buildingInfos.find(b => b.id === selectedBuildingId) ?? null;
  const siteName = localizedName(site.name, site.name_zh, lang);

  const statusCounts = useMemo(() => {
    const normal = buildingInfos.filter(b => b.status === 'normal').length;
    const alarm = buildingInfos.filter(b => b.status === 'critical').length;
    const warning = buildingInfos.filter(b => b.status === 'warning').length;
    const offline = buildingInfos.filter(b => b.status === 'offline').length;
    return { normal, alarm, warning, offline, total: buildingInfos.length };
  }, [buildingInfos]);

  function handleBuildingClick(buildingId: string) {
    setSelectedBuildingId(buildingId);
    setSelectedControlRoomId(null);
  }

  function handleControlRoomClick(crId: string) {
    setSelectedControlRoomId(crId);
    const cr = controlRooms.find(c => c.id === crId);
    if (cr) {
      setSelectedBuildingId(cr.building_id);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden gap-3">
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Left: building/control room list + status summary */}
        <div className={`w-72 flex-shrink-0 flex flex-col min-h-0 rounded-xl overflow-hidden border ${isLight ? 'bg-white/60 border-gray-200' : 'bg-gray-900/60 border-gray-800/50'}`}>
          {/* Site header */}
          <div className={`px-3 py-2.5 border-b flex-shrink-0 ${isLight ? 'border-gray-200' : 'border-gray-800/50'}`}>
            <div className={`flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-gray-200'}`}>
              <Building2 size={16} className="text-blue-500 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold truncate leading-tight">{siteName}</div>
                <div className={`text-xs flex items-center gap-2 mt-0.5 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                  <span className="flex items-center gap-1"><Building2 size={10} /> {site.buildings.length} {t('site_buildings')}</span>
                  <span className="text-gray-600">·</span>
                  <span className="flex items-center gap-1"><Cpu size={10} /> {controlRooms.length} {t('site_control_rooms')}</span>
                </div>
              </div>
              <PerformanceScore devices={siteDevices} alarms={siteAlarms} predictions={sitePredictions} sizeClass="h-[44px] w-[44px]" />
            </div>
          </div>

          {/* Status summary */}
          <div className={`border-b p-3 flex-shrink-0 ${isLight ? 'border-gray-200' : 'border-gray-800/50'}`}>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {t('dash_sites')} — {statusCounts.total} {t('dash_total')}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-lg border px-2.5 py-2 bg-green-500/15 border-green-500/20">
                <CheckCircle2 size={14} className="text-green-400" />
                <div><div className="text-sm font-bold text-green-400">{statusCounts.normal}</div><div className="text-[10px] text-gray-500">{t('dash_normal')}</div></div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border px-2.5 py-2 bg-red-500/15 border-red-500/20">
                <AlertTriangle size={14} className="text-red-400" />
                <div><div className="text-sm font-bold text-red-400">{statusCounts.alarm}</div><div className="text-[10px] text-gray-500">{t('dash_alarm')}</div></div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border px-2.5 py-2 bg-yellow-500/15 border-yellow-500/20">
                <AlertTriangle size={14} className="text-yellow-400" />
                <div><div className="text-sm font-bold text-yellow-400">{statusCounts.warning}</div><div className="text-[10px] text-gray-500">{t('dash_fault')}</div></div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border px-2.5 py-2 bg-gray-600/15 border-gray-600/20">
                <XCircle size={14} className="text-gray-400" />
                <div><div className="text-sm font-bold text-gray-400">{statusCounts.offline}</div><div className="text-[10px] text-gray-500">{t('dash_offline')}</div></div>
              </div>
            </div>
          </div>

          {/* Tab switcher */}
          <div className={`flex border-b flex-shrink-0 ${isLight ? 'border-gray-200' : 'border-gray-800/50'}`}>
            <button
              onClick={() => setLeftTab('buildings')}
              className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                leftTab === 'buildings'
                  ? isLight ? 'text-blue-600 border-b-2 border-blue-500' : 'text-blue-400 border-b-2 border-blue-500'
                  : isLight ? 'text-gray-500 hover:text-gray-700' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Building2 size={12} /> {t('site_buildings')}
            </button>
            <button
              onClick={() => setLeftTab('controlrooms')}
              className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                leftTab === 'controlrooms'
                  ? isLight ? 'text-blue-600 border-b-2 border-blue-500' : 'text-blue-400 border-b-2 border-blue-500'
                  : isLight ? 'text-gray-500 hover:text-gray-700' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Cpu size={12} /> {t('site_control_rooms')}
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-auto p-2.5 space-y-2 min-h-0">
            {leftTab === 'buildings' ? (
              buildingInfos.length === 0 ? (
                <div className="text-gray-500 text-sm text-center py-10">{t('site_no_buildings')}</div>
              ) : buildingInfos.map(info => (
                <BuildingListItem
                  key={info.id}
                  info={info}
                  isSelected={info.id === selectedBuildingId}
                  onClick={() => handleBuildingClick(info.id)}
                />
              ))
            ) : (
              controlRoomInfos.length === 0 ? (
                <div className="text-gray-500 text-sm text-center py-10">{t('site_no_control_rooms')}</div>
              ) : controlRoomInfos.map(info => (
                <ControlRoomListItem
                  key={info.id}
                  info={info}
                  isSelected={info.id === selectedControlRoomId}
                  onClick={() => handleControlRoomClick(info.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Center: building detail / overview */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <BuildingDetailPanel
            building={selectedBuilding}
            devices={siteDevices}
            controlRooms={controlRoomInfos}
          />
        </div>

        {/* Right: system data, alarms, maintenance */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-3 min-h-0">
          <SiteSystemData
            devices={siteDevices}
            buildingCount={site.buildings.length}
            controlRoomCount={controlRooms.length}
          />
          <SiteAlarms alarms={siteAlarms} />
          <SiteMaintenance predictions={sitePredictions} />
        </div>
      </div>
    </div>
  );
}
