import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Building2, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { toPng } from 'html-to-image';
import { useAuth } from '../lib/auth';
import { useDevices } from '../hooks/useDevices';
import { useAlarms } from '../hooks/useAlarms';
import { useFloors } from '../hooks/useFloors';
import { useSiteSelector } from '../hooks/useSiteSelector';
import { Building, Device, Theme } from '../types';
import { useLang, useT } from '../lib/i18n';
import { apiClient } from '../lib/apiCompat';
import LightBar from '../components/LightBar';
import { FloorPlanPanel, DeviceDetailCard } from '../panels/FloorPlanPanel';
import {
  GlassPanel, ArtisticBanner, ContactFooter,
} from './OmniOSHome';

const CRITICAL_DEVICE_STATUSES = ['Alarm', 'Activated', 'Panel Fire', 'MCCB Off'];
const FAULT_DEVICE_STATUSES = ['Fault', 'Panel Fault', 'Low Level', 'High Level', 'Low Pressure'];
const NORMAL_DEVICE_STATUSES = ['Normal', 'On', 'Power On', 'Closed', 'Running'];

function localName(name: string, nameZh: string, lang: string): string {
  return lang === 'en' ? name : (nameZh || name);
}

interface BlockDashboardProps {
  siteId: string;
  buildingId: string;
  initialFloorId?: string | null;
  onBack: () => void;
  onSystemManagement: () => void;
  onAdminConsole: () => void;
  onNavigateDashboard?: () => void;
  onNavigateAlarms?: (status?: string, siteId?: string, buildingId?: string, floorId?: string) => void;
  onNavigateMaintenance?: () => void;
  onNavigateDevices?: () => void;
  onChangeBuilding?: (buildingId: string) => void;
  theme: Theme;
  onThemeToggle?: () => void;
  onSignOut?: () => void;
}

export function BlockDashboard({
  siteId, buildingId, initialFloorId, onBack, onSystemManagement, onAdminConsole,
  onNavigateDashboard,
  onChangeBuilding,
  theme, onThemeToggle,
  onSignOut,
}: BlockDashboardProps) {
  const { lang, setLang } = useLang();
  const t = useT();
  const { user } = useAuth();
  const userName = (user?.user_metadata?.name as string) || user?.email || '';
  const userId = user?.id;
  const { sites } = useSiteSelector(user?.id);
  const { devices, loading: devicesLoading } = useDevices();
  const { alarms, falseAlarm } = useAlarms();
  const { floors, reload: _reloadFloors } = useFloors(buildingId);
  const [building, setBuilding] = useState<Building | null>(null);
  const [allBuildings, setAllBuildings] = useState<Building[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [showAllFloors, setShowAllFloors] = useState(false);
  const [troubleFloorIndex, setTroubleFloorIndex] = useState(0);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const captureFloorPlanRef = useRef<((deviceCode?: string) => Promise<string | null>) | null>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const captureDashboard = useCallback(async (): Promise<string | null> => {
    if (!dashboardRef.current) return null;
    try {
      const dataUrl = await toPng(dashboardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#020d25',
      });
      return dataUrl;
    } catch {
      return null;
    }
  }, []);
  const initialFloorRef = useRef<string | null>(null);

  useEffect(() => {
    apiClient
      .from('buildings')
      .select('*')
      .eq('site_id', siteId)
      .order('name', { ascending: true })
      .then(({ data }) => {
        if (data) setAllBuildings(data as Building[]);
      });
  }, [siteId]);

  // Set of device IDs whose actual DB status is a normal state — used as a
  // ground-truth guard so stale alarm data can't make a Normal device appear
  // as alarmed on the floor plan.
  const normalDeviceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const d of devices) {
      if (NORMAL_DEVICE_STATUSES.includes(d.status)) ids.add(d.id);
    }
    return ids;
  }, [devices]);

  // Map device_id -> highest active alarm severity, so trouble detection
  // reflects active alarms even when device.status is out of sync.
  // Guarded by normalDeviceIds: a device whose DB status is Normal is excluded
  // because its alarms have already been resolved/false-alarmed.
  const deviceAlarmSeverity = useMemo(() => {
    const map = new Map<string, 'critical' | 'alarm' | 'fault' | 'high' | 'medium' | 'low'>();
    const order: Record<string, number> = { critical: 4, alarm: 3, fault: 2, high: 3, medium: 2, low: 1 };
    for (const a of alarms) {
      if (a.status === 'resolved') continue;
      if (!a.device_id) continue;
      if (normalDeviceIds.has(a.device_id)) continue;
      const existing = map.get(a.device_id);
      if (!existing || order[a.severity] > order[existing]) {
        map.set(a.device_id, a.severity);
      }
    }
    return map;
  }, [alarms, normalDeviceIds]);

  // Determine which buildings are in trouble (have alarms, faults, or all-offline)
  const troubleBuildingIds = useMemo(() => {
    const ids = new Set<string>();
    for (const b of allBuildings) {
      const bDevices = devices.filter(d => d.floors?.buildings?.id === b.id);
      if (bDevices.length === 0) continue;
      const hasAlarm = bDevices.some(d =>
        CRITICAL_DEVICE_STATUSES.includes(d.status) ||
        deviceAlarmSeverity.get(d.id) === 'critical' || deviceAlarmSeverity.get(d.id) === 'high');
      const hasFault = bDevices.some(d =>
        FAULT_DEVICE_STATUSES.includes(d.status) ||
        deviceAlarmSeverity.get(d.id) === 'medium' || deviceAlarmSeverity.get(d.id) === 'low');
      const allOffline = bDevices.every(d => d.status === 'Offline');
      if (hasAlarm || hasFault || allOffline) ids.add(b.id);
    }
    return ids;
  }, [allBuildings, devices, deviceAlarmSeverity]);

  // Only navigate through buildings that are in trouble
  const troubleBuildings = useMemo(
    () => allBuildings.filter(b => troubleBuildingIds.has(b.id)),
    [allBuildings, troubleBuildingIds],
  );

  const currentBuildingIndex = troubleBuildings.findIndex(b => b.id === buildingId);
  const canNavigate = troubleBuildings.length > 1 && currentBuildingIndex >= 0;

  function navigateBlock(direction: 'prev' | 'next') {
    if (!canNavigate || !onChangeBuilding) return;
    const len = troubleBuildings.length;
    const newIndex = direction === 'prev'
      ? (currentBuildingIndex - 1 + len) % len
      : (currentBuildingIndex + 1) % len;
    onChangeBuilding(troubleBuildings[newIndex].id);
  }

  const site = useMemo(() => sites.find(s => s.id === siteId) ?? null, [sites, siteId]);

  useEffect(() => {
    apiClient
      .from('buildings')
      .select('*')
      .eq('id', buildingId)
      .single()
      .then(({ data }) => {
        if (data) setBuilding(data as Building);
      });
  }, [buildingId]);


  const buildingDevices = useMemo(
    () => devices.filter(d => d.floors?.buildings?.id === buildingId),
    [devices, buildingId],
  );

  // Physical status is authoritative; work-order state only controls its separate indicators.
  const mergedBuildingDevices = buildingDevices;

  // Fire alarm devices on the currently selected floor (active or false_alarm
  // critical/high alarms — both show in the left column list)
  const floorFireAlarmDevices = useMemo(() => {
    if (!selectedFloorId) return [];
    return mergedBuildingDevices
      .filter(d => d.floor_id === selectedFloorId)
      .filter(d => d.device_types?.category === 'detection')
      .filter(d => {
        const severity = deviceAlarmSeverity.get(d.id);
        return severity === 'critical' || severity === 'alarm' || severity === 'high';
      });
  }, [mergedBuildingDevices, selectedFloorId, deviceAlarmSeverity]);

  // Only ACTIVE fire alarm devices get the custom fire alarm icon on the floor plan.
  // False alarm fire devices show their regular icon with a solid red ring instead.
  // Guarded by normalDeviceIds so stale active alarms on Normal devices are excluded.
  const fireAlarmDeviceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of alarms) {
      if (a.status !== 'active') continue;
      if (a.severity !== 'critical' && a.severity !== 'alarm' && a.severity !== 'high') continue;
      const dev = a.devices;
      if (!dev) continue;
      if (normalDeviceIds.has(dev.id)) continue;
      if (dev.device_types?.category === 'detection') {
        ids.add(dev.id);
      }
    }
    return ids;
  }, [alarms, normalDeviceIds]);

  // Device IDs with open alarms (any severity, non-resolved — includes
  // false_alarm so the floor plan shows a solid red ring). The active subset
  // (active status only) is passed so flash mode updates instantly when alarms
  // are dispatched or marked false alarm.
  // Both guarded by normalDeviceIds so stale alarms on Normal devices are excluded.
  const openAlarmDeviceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of alarms) {
      if (a.status === 'resolved') continue;
      if (!a.device_id) continue;
      if (normalDeviceIds.has(a.device_id)) continue;
      ids.add(a.device_id);
    }
    return ids;
  }, [alarms, normalDeviceIds]);

  const activeAlarmDeviceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of alarms) {
      if (a.status !== 'active') continue;
      if (!a.device_id) continue;
      if (normalDeviceIds.has(a.device_id)) continue;
      ids.add(a.device_id);
    }
    return ids;
  }, [alarms, normalDeviceIds]);

  // Map device_id -> open alarm (active or false_alarm) for quick lookup,
  // so the False Alarm button is disabled once an alarm is already false.
  // Guarded by normalDeviceIds so stale alarms on Normal devices are excluded.
  const deviceActiveAlarmMap = useMemo(() => {
    const map = new Map<string, typeof alarms[number]>();
    for (const a of alarms) {
      if (a.status === 'resolved') continue;
      if (!a.device_id) continue;
      if (normalDeviceIds.has(a.device_id)) continue;
      const severity = a.severity;
      if (severity !== 'critical' && severity !== 'alarm' && severity !== 'high') continue;
      if (!map.has(a.device_id)) map.set(a.device_id, a);
    }
    return map;
  }, [alarms, normalDeviceIds]);

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

  const onlinePercent = buildingDevices.length
    ? Math.round((buildingDevices.filter(d => d.status !== 'Offline').length / buildingDevices.length) * 100)
    : 0;

  const floorHealthMap = useMemo(() => {
    const map = new Map<string, { hasAlarm: boolean; hasFault: boolean; hasOffline: boolean; alarmCount: number; faultCount: number; offlineCount: number }>();
    for (const floor of floors) {
      const floorDevices = mergedBuildingDevices.filter(d => d.floor_id === floor.id);
      const alarmCount = floorDevices.filter(d => CRITICAL_DEVICE_STATUSES.includes(d.status)).length;
      const faultCount = floorDevices.filter(d => FAULT_DEVICE_STATUSES.includes(d.status)).length;
      const offlineCount = floorDevices.filter(d => d.status === 'Offline').length;
      map.set(floor.id, {
        hasAlarm: alarmCount > 0,
        hasFault: faultCount > 0,
        hasOffline: offlineCount > 0,
        alarmCount,
        faultCount,
        offlineCount,
      });
    }
    return map;
  }, [floors, mergedBuildingDevices]);

  // Reset floor selection when building changes so auto-select runs fresh
  useEffect(() => {
    setSelectedFloorId(null);
    setTroubleFloorIndex(0);
    setSelectedDevice(null);
    initialFloorRef.current = initialFloorId ?? null;
  }, [buildingId, initialFloorId]);

  // Check if floors belong to the current building (they may be stale from a previous building)
  const floorsMatchBuilding = floors.length > 0 && floors[0].building_id === buildingId;

  useEffect(() => {
    if (floors.length === 0 || !floorsMatchBuilding) return;
    if (devicesLoading) return;
    // Re-select if no floor selected, or if the selected floor doesn't belong to this building
    const selectedStillValid = selectedFloorId && floors.some(f => f.id === selectedFloorId);
    if (selectedStillValid) return;

    // If an initial floor was passed from BuildingDashboard, use it
    if (initialFloorRef.current && floors.some(f => f.id === initialFloorRef.current)) {
      const fid = initialFloorRef.current;
      initialFloorRef.current = null;
      setSelectedFloorId(fid);
      return;
    }

    const firstTrouble = floors.find(f => {
      const h = floorHealthMap.get(f.id);
      return h?.hasAlarm;
    }) ?? floors.find(f => {
      const h = floorHealthMap.get(f.id);
      return h?.hasFault;
    }) ?? floors.find(f => {
      const h = floorHealthMap.get(f.id);
      return h?.hasOffline;
    });
    const groundFloor = floors.find(f =>
      f.floor_label?.toUpperCase().includes('G/F') ||
      f.floor_label?.toUpperCase().includes('GF') ||
      f.floor_number === 1 ||
      f.floor_number === 0
    );
    setSelectedFloorId((firstTrouble ?? groundFloor ?? floors[0]).id);
  }, [floors, floorsMatchBuilding, selectedFloorId, floorHealthMap, devicesLoading]);

  const floorTroubleCount = Array.from(floorHealthMap.values()).filter(v => v.hasAlarm || v.hasFault || v.hasOffline).length;

  const troubleFloors = useMemo(
    () => floors.filter(f => {
      const h = floorHealthMap.get(f.id);
      return h && (h.hasAlarm || h.hasFault || h.hasOffline);
    }),
    [floors, floorHealthMap],
  );

  function navigateTroubleFloor(direction: 'prev' | 'next') {
    if (troubleFloors.length === 0) return;
    const len = troubleFloors.length;
    const newIndex = direction === 'prev'
      ? (troubleFloorIndex - 1 + len) % len
      : (troubleFloorIndex + 1) % len;
    setTroubleFloorIndex(newIndex);
    setSelectedFloorId(troubleFloors[newIndex].id);
    setSelectedDevice(null);
  }

  // Keep troubleFloorIndex in sync when selectedFloorId changes from other sources
  useEffect(() => {
    if (!selectedFloorId || troubleFloors.length === 0) return;
    const idx = troubleFloors.findIndex(f => f.id === selectedFloorId);
    if (idx >= 0 && idx !== troubleFloorIndex) setTroubleFloorIndex(idx);
  }, [selectedFloorId, troubleFloors, troubleFloorIndex]);

  const blockDisplayName = building
    ? localName(building.name, building.name_zh, lang)
    : t('loading_dots');

  const siteDisplayName = site
    ? localName(site.name, site.name_zh, lang)
    : '';

  return (
    <div
      ref={dashboardRef}
      className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-[#020d25] text-white"
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
            userName={user?.email ?? t('guest_user')}
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

          {/* Left column — block name + floor health + floor buttons (1/4 width) */}
          <div className="relative flex min-h-0 flex-col gap-2 overflow-auto lg:flex-1 lg:min-w-0">
            {/* Block name trapezoid */}
            <div className="flex flex-col gap-0">
              <div className="flex items-center justify-between px-1 py-3">
                <div className="flex items-center gap-2">
                  {canNavigate && (
                    <button
                      type="button"
                      onClick={() => navigateBlock('prev')}
                      className="flex-shrink-0 rounded-lg bg-cyan-400/10 border border-cyan-400/20 p-1.5 text-cyan-300 transition-all hover:bg-cyan-400/20 hover:text-cyan-200"
                      title={t('previous_block')}
                    >
                      <ChevronLeft size={16} />
                    </button>
                  )}
                  <div className="group relative inline-flex items-center text-left">
                  <svg
                    className="absolute inset-0 h-full w-full"
                    viewBox="0 0 200 56"
                    preserveAspectRatio="none"
                    style={{ filter: 'drop-shadow(0 0 4px rgba(0,210,255,0.8)) drop-shadow(0 0 10px rgba(0,210,255,0.5)) drop-shadow(0 0 18px rgba(0,210,255,0.3))' }}
                  >
                    <defs>
                      <linearGradient id="blockTrapFill" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgba(2,13,37,0.95)" />
                        <stop offset="100%" stopColor="rgba(6,28,61,0.85)" />
                      </linearGradient>
                      <linearGradient id="blockTrapStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(0,210,255,0.9)" />
                        <stop offset="50%" stopColor="rgba(0,229,196,1)" />
                        <stop offset="100%" stopColor="rgba(0,210,255,0.7)" />
                      </linearGradient>
                    </defs>
                    <polygon
                      points="2,2 198,2 150,54 2,54"
                      fill="url(#blockTrapFill)"
                      stroke="url(#blockTrapStroke)"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="relative rounded-md bg-cyan-400/10 p-1.5 text-cyan-300">
                    <Building2 size={15} />
                  </span>
                  <span className="relative whitespace-nowrap py-2 pl-3 pr-16">
                    <span className="block text-sm font-bold uppercase tracking-[0.2em] text-white">
                      {blockDisplayName}
                    </span>
                    <span className="block text-[13px] text-cyan-100/45">
                      {siteDisplayName}
                    </span>
                  </span>
                  </div>
                  {canNavigate && (
                    <button
                      type="button"
                      onClick={() => navigateBlock('next')}
                      className="flex-shrink-0 rounded-lg bg-cyan-400/10 border border-cyan-400/20 p-1.5 text-cyan-300 transition-all hover:bg-cyan-400/20 hover:text-cyan-200"
                      title={t('next_block')}
                    >
                      <ChevronRight size={16} />
                    </button>
                  )}
                </div>
              </div>
              {/* All toggle + Trouble Floors count on same row */}
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="flex items-center gap-2 rounded-md bg-rose-500/10 px-2.5 py-1 text-[11px] text-rose-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" style={{ boxShadow: '0 0 10px #ef4444, 0 0 18px #ef4444' }} />
                  <span className="font-bold text-white">{floorTroubleCount}</span> {t('trouble_floors')}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAllFloors(prev => !prev)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    showAllFloors
                      ? 'bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-400/40'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {t('all_floors')}
                  <span
                    className={`flex h-3 w-6 items-center rounded-full transition-colors ${showAllFloors ? 'bg-cyan-400/60' : 'bg-white/15'}`}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full bg-white transition-transform ${showAllFloors ? 'translate-x-3' : 'translate-x-0.5'}`}
                    />
                  </span>
                </button>
              </div>

              {/* Trouble floor scroller — compact box with left/right arrows */}
              {troubleFloors.length > 0 && (
                <div className="mt-1 px-1">
                  <div className="flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/5 p-1.5">
                    <button
                      type="button"
                      onClick={() => navigateTroubleFloor('prev')}
                      disabled={troubleFloors.length <= 1}
                      className="flex-shrink-0 rounded-md bg-cyan-400/10 p-1 text-cyan-300 transition-all hover:bg-cyan-400/20 hover:text-cyan-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      title={lang === 'en' ? 'Previous trouble floor' : lang === 'zh-CN' ? '上一个异常楼层' : '上一個異常樓層'}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (troubleFloors[troubleFloorIndex]) { setSelectedFloorId(troubleFloors[troubleFloorIndex].id); setSelectedDevice(null); } }}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-md px-1 py-0.5 transition-all hover:bg-rose-500/10 ${activeAlarmFloorIds.has(troubleFloors[troubleFloorIndex]?.id ?? '') ? 'alarm-flash' : ''}`}
                    >
                      {(() => {
                        const tf = troubleFloors[troubleFloorIndex];
                        if (!tf) return null;
                        const h = floorHealthMap.get(tf.id);
                        const isSel = selectedFloorId === tf.id;
                        return (
                          <>
                            <span className={`text-sm font-extrabold leading-tight ${isSel ? 'text-cyan-300' : 'text-white'}`}>
                              {tf.floor_label}
                            </span>
                            {(() => {
                              const total = (h?.alarmCount ?? 0) + (h?.faultCount ?? 0) + (h?.offlineCount ?? 0);
                              if (total === 0) return null;
                              return (
                                <span className="flex items-center gap-2 text-[11px] font-semibold">
                                  {h && h.alarmCount > 0 && (
                                    <span className="flex items-center gap-0.5 text-rose-300">
                                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#ff4668', boxShadow: '0 0 4px #ff4668' }} />
                                      {h.alarmCount}
                                    </span>
                                  )}
                                  {h && h.faultCount > 0 && (
                                    <span className="flex items-center gap-0.5 text-amber-300">
                                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#f6c945', boxShadow: '0 0 4px #f6c945' }} />
                                      {h.faultCount}
                                    </span>
                                  )}
                                  {h && h.offlineCount > 0 && (
                                    <span className="flex items-center gap-0.5 text-slate-300">
                                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#8492a6', boxShadow: '0 0 3px #8492a6' }} />
                                      {h.offlineCount}
                                    </span>
                                  )}
                                </span>
                              );
                            })()}
                          </>
                        );
                      })()}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateTroubleFloor('next')}
                      disabled={troubleFloors.length <= 1}
                      className="flex-shrink-0 rounded-md bg-cyan-400/10 p-1 text-cyan-300 transition-all hover:bg-cyan-400/20 hover:text-cyan-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      title={lang === 'en' ? 'Next trouble floor' : lang === 'zh-CN' ? '下一个异常楼层' : '下一個異常樓層'}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Fire alarm devices on selected floor with Confirm / False Alarm buttons */}
              {floorFireAlarmDevices.length > 0 && (
                <div className="mt-1 px-1">
                  <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.04] p-1.5">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-300">
                      <span className="h-2 w-2 rounded-full bg-rose-500" style={{ boxShadow: '0 0 6px #ef4444' }} />
                      {t('fire_alarm')} — {floorFireAlarmDevices.length}
                    </div>
                    <div className="space-y-1">
                      {floorFireAlarmDevices.map(dev => {
                        const alarm = deviceActiveAlarmMap.get(dev.id);
                        return (
                          <div key={dev.id} className="flex items-center gap-1.5 rounded-md bg-[#0b1a36]/60 px-2 py-1">
                            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose-500" style={{ boxShadow: '0 0 4px #ef4444' }} />
                            <span className="flex-1 truncate text-[11px] font-medium text-white">{dev.code}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedDevice(dev)}
                              className="flex-shrink-0 rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/30"
                            >
                              {t('confirm')}
                            </button>
                            <button
                              type="button"
                              disabled title="未接入数据"
                              onClick={() => { if (alarm && alarm.status !== 'false_alarm') falseAlarm(alarm.id, userId, userName); }}
                              className="flex-shrink-0 rounded bg-slate-500/20 px-2 py-0.5 text-[10px] font-semibold text-slate-300 transition-colors hover:bg-slate-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {t('false_alarm')}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* All floors grid — visible when All is on */}
              {showAllFloors && (
                <div className="mt-1 px-1">
                  <div className="grid grid-cols-2 gap-1">
                    {floors.map(floor => {
                      const health = floorHealthMap.get(floor.id);
                      const hasAlarm = health?.hasAlarm ?? false;
                      const hasFault = health?.hasFault ?? false;
                      const hasOffline = health?.hasOffline ?? false;
                      const isOk = !hasAlarm && !hasFault && !hasOffline;
                      const isSelected = selectedFloorId === floor.id;
                      const isFlashing = activeAlarmFloorIds.has(floor.id);
                      const bgClass = hasAlarm
                        ? 'bg-red-500/25 text-white'
                        : hasFault
                          ? 'bg-amber-500/20 text-white'
                          : hasOffline
                            ? 'bg-slate-500/20 text-white/70'
                            : 'bg-emerald-500/10 text-emerald-200/80 hover:bg-emerald-500/20';
                      const ringClass = isSelected ? 'ring-1 ring-cyan-400/40' : '';
                      const troubleTotal = (health?.alarmCount ?? 0) + (health?.faultCount ?? 0) + (health?.offlineCount ?? 0);
                      return (
                        <button
                          key={floor.id}
                          type="button"
                          onClick={() => { setSelectedFloorId(floor.id); setSelectedDevice(null); }}
                          className={`flex items-center gap-1 rounded px-1.5 py-1.5 text-xs font-medium transition-all ${bgClass} ${ringClass} ${isFlashing ? 'alarm-flash border border-rose-400/60' : 'border border-transparent'}`}
                        >
                          <span className="flex-1 text-left truncate">{floor.floor_label}</span>
                          {!isOk && troubleTotal > 0 && (
                            <span className="flex items-center gap-1 text-[10px] font-bold">
                              {health && health.alarmCount > 0 && (
                                <span className="flex items-center gap-0.5 text-rose-300">
                                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#ff4668', boxShadow: '0 0 4px #ff4668' }} />
                                  {health.alarmCount}
                                </span>
                              )}
                              {health && health.faultCount > 0 && (
                                <span className="flex items-center gap-0.5 text-amber-300">
                                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#f6c945', boxShadow: '0 0 4px #f6c945' }} />
                                  {health.faultCount}
                                </span>
                              )}
                              {health && health.offlineCount > 0 && (
                                <span className="flex items-center gap-0.5 text-slate-300">
                                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#8492a6', boxShadow: '0 0 3px #8492a6' }} />
                                  {health.offlineCount}
                                </span>
                              )}
                            </span>
                          )}
                          {isOk && isSelected && (
                            <Check size={14} className="flex-shrink-0 text-emerald-400" style={{ filter: 'drop-shadow(0 0 4px #34d399)' }} />
                          )}
                          {isOk && !isSelected && (
                            <span className="h-2 w-2 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #34d399' }} title={t('Normal')} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Device detail card — shown at bottom of left column when a device is selected */}
              {selectedDevice && (
                <div className="mt-1 px-1">
                  <DeviceDetailCard device={selectedDevice} onClose={() => setSelectedDevice(null)} onCaptureDashboard={captureDashboard} />
                </div>
              )}
            </div>
          </div>

          {/* Center column — floor plan (expanded to fill center + right) */}
          <div className="relative flex flex-1 flex-col gap-2 lg:flex-[3_1_0%] lg:min-w-0">
            <GlassPanel className="flex min-h-0 flex-1 flex-col">
              {/* Floor plan area — embedded mode, no header or floor list */}
              <div className="min-h-0 flex-1 overflow-hidden px-1 py-2">
                {selectedFloorId ? (
                  <FloorPlanPanel compact embedded buildingId={buildingId} initialFloorId={selectedFloorId} key={`${buildingId}-${selectedFloorId}`} externalDevices={mergedBuildingDevices} uniformBlueIcons fireAlarmDeviceIds={fireAlarmDeviceIds} externalOpenAlarmDeviceIds={openAlarmDeviceIds} externalActiveAlarmDeviceIds={activeAlarmDeviceIds} onDeviceSelect={setSelectedDevice} onCaptureReady={(fn) => { captureFloorPlanRef.current = fn; }} />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-cyan-100/50">
                    {t('select_floor')}
                  </div>
                )}
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
