import { useDeviceSnapshot } from '../hooks/useDeviceSnapshot';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Layers, ZoomIn, ZoomOut, Maximize2, Image as ImageIcon, Send, CheckCircle, Loader2, Camera, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { toPng } from 'html-to-image';
import { useDevices } from '../hooks/useDevices';
import { useAlarms } from '../hooks/useAlarms';
import { useDeviceAlarms } from '../hooks/useDeviceAlarms';
import { useFloors } from '../hooks/useFloors';
import { useFloorPlanImages } from '../hooks/useFloorPlanImages';
import { useFloorPlanFit } from '../hooks/useFloorPlanFit';
import { hasFloorPlanCoordinates } from '../lib/mapCoordinates';
import { FloorPlanCoordinateNotice } from '../components/MapStatus';
import { useAuth } from '../lib/auth';
import { StatusDot } from '../components/StatusDot';
import { StatusBadge } from '../components/StatusBadge';
import { Device, AlarmEvent, Site, Project } from '../types';
import { statusColor, isPulsingStatus } from '../lib/colors';
import { useT, useLang } from '../lib/i18n';
import { isAlarmWorthy, dispatchDevice } from '../lib/dispatch';
import { showScreenshotToast } from '../components/ScreenshotToast';
import { buildScreenshotFilename } from '../lib/screenCapture';
import { apiClient } from '../lib/apiCompat';
import fireAlarmIconUrl from '../components/Fire_Alarm_Color.png';

function localName(name: string, nameZh: string | undefined, lang: string): string {
  return lang === 'en' ? name : (nameZh || name);
}

interface BuildingContext {
  buildingName: string;
  siteName: string;
  projectName: string;
  floorLabel: string;
}

function formatTimestamp(date: Date, lang: string): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  if (lang === 'en') return `${y}-${m}-${d} ${h}:${min}`;
  return `${y}年${m}月${d}日 ${h}:${min}`;
}

const ALL = 'all';



type LayerFilter = 'all' | 'detection' | 'ventilation' | 'pump' | 'water' | 'power_interlocking';

const LAYERS: { id: LayerFilter; label: string; color: string }[] = [
  { id: 'all',           label: 'All',        color: '#60a5fa' },
  { id: 'detection',     label: 'Fire Safety',color: '#ef4444' },
  { id: 'ventilation',   label: 'HVAC',       color: '#38bdf8' },
  { id: 'pump',          label: 'Pump',       color: '#22d3ee' },
  { id: 'water',         label: 'Water',      color: '#0ea5e9' },
  { id: 'power_interlocking', label: 'Power & Interlocking', color: '#eab308' },
];

const ICON_S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function MiniDeviceIcon({ code, color, size = 11 }: { code: string; color: string; size?: number }) {
  const p = { ...ICON_S, stroke: color };
  const svg = (children: React.ReactNode) => <svg width={size} height={size} viewBox="0 0 24 24" {...p}>{children}</svg>;
  switch (code) {
    case 'SD':
      return svg(<><circle cx="12" cy="12" r="8" /><text x="12" y="15.5" fill={color} stroke="none" fontSize="8" textAnchor="middle" fontWeight="bold">S</text></>);
    case 'HD':
      return svg(<><circle cx="12" cy="12" r="8" /><text x="12" y="15.5" fill={color} stroke="none" fontSize="8" textAnchor="middle" fontWeight="bold">H</text></>);
    case 'GD':
      return svg(<><circle cx="12" cy="12" r="8" /><text x="12" y="15.5" fill={color} stroke="none" fontSize="8" textAnchor="middle" fontWeight="bold">G</text></>);
    case 'MCP':
      return svg(<><rect x="5" y="5" width="14" height="14" rx="1" fill={color} fillOpacity="0.25" /><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>);
    case 'AB':
      return svg(<><path d="M12 4 C8 4, 6 7, 6 11 V14 L4 16 H20 L18 14 V11 C18 7, 16 4, 12 4 Z" /><path d="M10 18 C10 19.5, 14 19.5, 14 18" /><circle cx="12" cy="11" r="1.5" fill={color} stroke="none" /></>);
    case 'FL':
      return svg(<><circle cx="12" cy="12" r="4" fill={color} fillOpacity="0.3" /><line x1="12" y1="3" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="21" /><line x1="3" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="21" y2="12" /><line x1="5.5" y1="5.5" x2="7.5" y2="7.5" /><line x1="16.5" y1="16.5" x2="18.5" y2="18.5" /><line x1="18.5" y1="5.5" x2="16.5" y2="7.5" /><line x1="7.5" y1="16.5" x2="5.5" y2="18.5" /></>);
    case 'FSP':
    case 'SP':
    case 'FJP':
    case 'SJP':
      return svg(<><circle cx="12" cy="12" r="8" /><path d="M12 7 C14 9, 16 11, 12 12 C8 13, 10 15, 12 17" fill={color} fillOpacity="0.2" /><circle cx="12" cy="12" r="1.5" fill={color} stroke="none" /></>);
    case 'FS_TANK':
    case 'SPR_TANK':
      return svg(<><path d="M5 9 Q5 5 12 5 Q19 5 19 9 V19 H5 Z" /><line x1="5" y1="13" x2="19" y2="13" strokeOpacity="0.5" strokeDasharray="1.5 1" /><line x1="12" y1="5" x2="12" y2="19" strokeOpacity="0.3" /></>);
    case 'FS_FLOW':
      return svg(<><circle cx="12" cy="12" r="7" /><path d="M7 12 L17 12" /><path d="M14 9 L17 12 L14 15" /></>);
    case 'SCV':
      return svg(<><path d="M4 6 L12 12 L4 18 Z" fill={color} fillOpacity="0.2" /><path d="M20 6 L12 12 L20 18 Z" fill={color} fillOpacity="0.2" /><circle cx="12" cy="12" r="1.5" fill={color} stroke="none" /></>);
    case 'SPR_SYS':
      return svg(<><circle cx="12" cy="12" r="8" /><text x="12" y="11" fill={color} stroke="none" fontSize="5" textAnchor="middle" fontWeight="bold">P</text><line x1="12" y1="12" x2="16" y2="8" /><circle cx="12" cy="12" r="1" fill={color} stroke="none" /></>);
    case 'SP_PANEL':
      return svg(<><rect x="4" y="6" width="16" height="12" rx="1" /><circle cx="8" cy="10" r="1" fill={color} stroke="none" /><circle cx="12" cy="10" r="1" fill={color} stroke="none" /><circle cx="16" cy="10" r="1" fill={color} stroke="none" /><line x1="7" y1="14" x2="17" y2="14" /></>);
    case 'FD':
      return svg(<><rect x="3" y="8" width="18" height="8" rx="0.5" /><line x1="3" y1="16" x2="21" y2="8" /><line x1="3" y1="8" x2="21" y2="16" strokeOpacity="0.3" /></>);
    case 'SEF':
    case 'SPF':
      return svg(<><circle cx="12" cy="12" r="8" /><path d="M12 12 L12 6 C14 7, 16 9, 12 12" fill={color} fillOpacity="0.3" /><path d="M12 12 L18 12 C17 14, 15 16, 12 12" fill={color} fillOpacity="0.3" /><path d="M12 12 L12 18 C10 17, 8 15, 12 12" fill={color} fillOpacity="0.3" /><path d="M12 12 L6 12 C7 10, 9 8, 12 12" fill={color} fillOpacity="0.3" /><circle cx="12" cy="12" r="1" fill={color} stroke="none" /></>);
    case 'VAC':
      return svg(<><circle cx="12" cy="12" r="8" /><text x="12" y="15" fill={color} stroke="none" fontSize="7" textAnchor="middle" fontWeight="bold">V</text></>);
    case 'DIRECT_LINK':
      return svg(<><circle cx="12" cy="12" r="9" /><path d="M7 10 Q7 7 10 7 L10 10 L8 10 L8 14 Q8 17 12 17 L12 14 L10 14 L14 14 L16 14 L16 17 Q16 17 17 14 L17 10 L15 10 L15 7 Q18 7 18 10" fill={color} fillOpacity="0.2" /></>);
    case 'GENSET':
      return svg(<><circle cx="12" cy="12" r="8" /><path d="M13 6 L9 13 L12 13 L11 18 L15 11 L12 11 Z" fill={color} fillOpacity="0.4" /></>);
    case 'FUEL_TANK':
      return svg(<><path d="M5 9 Q5 5 12 5 Q19 5 19 9 V19 H5 Z" /><line x1="5" y1="11" x2="19" y2="11" strokeOpacity="0.5" strokeDasharray="1.5 1" /><path d="M16 8 L19 5" strokeOpacity="0.5" /></>);
    case 'F_LIFT':
      return svg(<><rect x="5" y="3" width="14" height="18" rx="0.5" /><line x1="12" y1="3" x2="12" y2="21" strokeOpacity="0.4" /><path d="M8 8 L10 6 L12 8" /><path d="M12 16 L14 18 L16 16" /></>);
    case 'FIRE_DOOR':
      return svg(<><rect x="4" y="3" width="9" height="18" rx="0.5" /><line x1="13" y1="3" x2="13" y2="21" /><path d="M13 12 A6 6 0 0 1 19 6" strokeDasharray="2 1.5" /><circle cx="10" cy="12" r="0.8" fill={color} stroke="none" /></>);
    default:
      return <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />;
  }
}

const NORMAL_STATUSES_SET = new Set(['Normal', 'Power On', 'Open', 'On', 'Running', 'Auto Mode', 'Closed']);

const ALARM_STATUSES_SET = new Set(['Alarm', 'Activated', 'Panel Fire', 'MCCB Off']);
const FAULT_STATUSES_SET = new Set(['Fault', 'Low Level', 'High Level', 'Low Pressure', 'Panel Fault']);
const OFFLINE_STATUSES_SET = new Set(['Offline']);
const BRIGHT_BLUE = '#3b82f6';

function uniformRingColor(status: string): string | null {
  if (ALARM_STATUSES_SET.has(status)) return '#ef4444';
  if (FAULT_STATUSES_SET.has(status)) return '#f6c945';
  if (OFFLINE_STATUSES_SET.has(status)) return '#6b7280';
  return null;
}

export function DeviceIcon({ device, onClick, dimmed, uniformBlue = false, flashMode, isFireAlarm = false }: { device: Device; onClick: () => void; dimmed: boolean; uniformBlue?: boolean; flashMode?: 'flash' | 'solid'; isFireAlarm?: boolean }) {
  if (!hasFloorPlanCoordinates(device)) return null;
  const statusClr = statusColor(device.status);
  const isPulsing = isPulsingStatus(device.status) && flashMode !== 'solid';
  const deviceName = device.label || device.code;
  const dtCode = device.device_types?.code ?? '';
  const isNormal = NORMAL_STATUSES_SET.has(device.status);

  const iconColor = uniformBlue ? BRIGHT_BLUE : statusClr;
  const ringColor = uniformBlue ? uniformRingColor(device.status) : null;
  const showRing = uniformBlue ? ringColor !== null : !isNormal;
  const ringStyle = uniformBlue
    ? (ringColor ? { borderColor: ringColor } : undefined)
    : { backgroundColor: `${statusClr}30`, borderColor: statusClr };
  const showLabel = !(uniformBlue && isNormal);

  const showCustomFireIcon = isFireAlarm && flashMode === 'flash';

  return (
    <button
      onClick={onClick}
      className={`absolute transform -translate-x-1/2 -translate-y-1/2 group transition-opacity ${dimmed ? 'opacity-25' : 'opacity-100'}`}
      style={{ left: `${device.position_x}%`, top: `${device.position_y}%` }}
    >
      {isPulsing && (
        <span className="absolute inset-0 rounded-full animate-ping opacity-60" style={{ backgroundColor: uniformBlue ? '#ef4444' : statusClr }} />
      )}
      <span
        className={`relative flex items-center justify-center transition-transform group-hover:scale-125 ${showRing ? 'w-6 h-6 rounded-full border-4 shadow-lg' : ''} ${uniformBlue && isPulsing ? 'animate-pulse' : ''}`}
        style={showRing ? ringStyle : undefined}
        title={device.code}
      >
        {showCustomFireIcon ? (
          <img
            src={fireAlarmIconUrl}
            width={28}
            height={28}
            className="object-contain"
            style={{ filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.8))' }}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
        ) : (
          <MiniDeviceIcon code={dtCode} color={iconColor} size={20} />
        )}
      </span>
      {showLabel && (
        <span
          className="absolute top-full left-1/2 -translate-x-1/2 mt-0.5 whitespace-nowrap rounded px-1 text-[9px] font-medium leading-tight"
          style={{
            color: '#e2e8f0',
            backgroundColor: 'rgba(2,13,37,0.8)',
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          }}
        >
          {deviceName}
        </span>
      )}
    </button>
  );
}

export function DeviceDetailCard({ device: originalDevice, onClose, onCaptureDashboard }: { device: Device; onClose: () => void; onCaptureDashboard?: () => Promise<string | null> }) {
  const device = useDeviceSnapshot(originalDevice);
  const t = useT();
  const { lang } = useLang();
  const alarms = useDeviceAlarms(device.id);
  const { user } = useAuth();
  const dt = device.device_types;
  const floor = device.floors;
  const building = floor?.buildings;
  const site = building?.sites;
  const [dispatched, setDispatched] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [capturingDash, setCapturingDash] = useState(false);
  const [sending, setSending] = useState(false);
  const showDispatch = isAlarmWorthy(device);

  const userName = (user?.user_metadata?.name as string) || user?.email || '';
  const userTelephone = (user?.user_metadata?.telephone as string) || '';

  const deviceAlarms = alarms
    .filter(a => a.device_id === device.id)
    .sort((a, b) => new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime());
  const openAlarm = deviceAlarms.find(a => a.status !== 'resolved' && a.status !== 'false_alarm');
  const falseAlarm = !openAlarm ? deviceAlarms.find(a => a.status === 'false_alarm') : undefined;
  const deviceAlarm = openAlarm ?? falseAlarm ?? deviceAlarms[0];
  const actionStatus = openAlarm ? t(openAlarm.status) : falseAlarm ? t('false_alarm') : t('Normal');

  const buildingName = building?.name_zh || building?.name || '-';
  const floorLabel = floor?.floor_label || '-';

  const handleDispatch = async () => {
    if (onCaptureDashboard) {
      setCapturingDash(true);
      try {
        const img = await onCaptureDashboard();
        if (img) {
          setPreviewImg(img);
          return;
        }
      } finally {
        setCapturingDash(false);
      }
    }
    setDispatching(true);
    try {
      await dispatchDevice(device, lang, userName, userTelephone);
      setDispatched(true);
    } finally {
      setDispatching(false);
    }
  };

  const handleConfirmSend = async () => {
    setSending(true);
    try {
      if (previewImg) {
        const filename = buildScreenshotFilename(device.code || 'UNKNOWN');
        const a = document.createElement('a');
        a.href = previewImg;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      await dispatchDevice(device, lang, userName, userTelephone);
      setDispatched(true);
      setPreviewImg(null);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-lg border border-cyan-400/30 bg-[#051533]/90 p-3 shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-bold text-white truncate">{device.code}</h3>
          <StatusBadge status={device.status} size="sm" />
        </div>
        <button onClick={onClose} className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"><X size={14} /></button>
      </div>
      <div className="space-y-1.5 text-xs">
        <Row label={t('device_type')} value={dt?.name_zh_tw || dt?.name_en || '-'} />
        <Row label={t('action_status')} value={actionStatus} />
        {device.current_value != null && (
          <Row label={t('value')} value={`${device.current_value} ${dt?.unit || ''}`} />
        )}
        <Row label={t('site')} value={site?.name_zh || site?.name || '-'} />
        <Row label={t('building_floor')} value={`${buildingName} / ${floorLabel}`} />
        <Row label={t('location')} value={device.label} />
        <Row label={apiFieldLabel(lang, 'coordinates')} value={device.position_x == null || device.position_y == null ? '-' : `${device.position_x}, ${device.position_y}`} />
        <Row label={apiFieldLabel(lang, 'battery')} value={device.battery_value ?? '-'} />
        <Row label={apiFieldLabel(lang, 'signal')} value={device.signal_power ?? '-'} />
        <Row
          label={apiFieldLabel(lang, 'alarmRange')}
          value={device.alarm_min != null || device.alarm_max != null
            ? `${device.alarm_min ?? ''} – ${device.alarm_max ?? ''} ${dt?.unit || ''}`.trim()
            : '-'}
        />
        <Row label={apiFieldLabel(lang, 'lastSeen')} value={device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : '-'} />
        <Row label={apiFieldLabel(lang, 'reason')} value={device.reason || '-'} />
        <Row label={t('trigger_time')} value={deviceAlarm ? new Date(deviceAlarm.triggered_at).toLocaleString() : '-'} />
        {deviceAlarm?.dispatcher_name && (
          <Row label={t('dispatcher')} value={deviceAlarm.dispatcher_name} />
        )}
        {deviceAlarm?.dispatcher_contact && (
          <Row label={t('dispatcher_contact')} value={deviceAlarm.dispatcher_contact} />
        )}
      </div>
      <div className="mt-3 pt-2 border-t border-gray-700/50 space-y-1.5">
        {showDispatch && (
          <>
            {dispatched ? (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-1.5 text-green-400 text-xs font-medium">
                  <CheckCircle size={14} />
                  {t('dispatched_short')}
                </div>
              </div>
            ) : (
              <button
                onClick={handleDispatch}
                disabled={dispatching || capturingDash}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-green-600/20 border border-green-500/40 text-green-400 hover:bg-green-600/30 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {dispatching || capturingDash ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                {capturingDash ? t('capturing') : dispatching ? t('capturing') : t('dispatch_whatsapp')}
              </button>
            )}
          </>
        )}
      </div>
      {previewImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => !sending && setPreviewImg(null)}>
          <div className="max-w-2xl max-h-[90vh] overflow-auto rounded-xl border border-cyan-500/30 bg-[#051533] p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">{t('dispatch_preview_title')}</h3>
              <button onClick={() => !sending && setPreviewImg(null)} className="text-gray-400 hover:text-white transition-colors" disabled={sending}><X size={16} /></button>
            </div>
            <img src={previewImg} alt="Dashboard preview" className="w-full rounded-lg border border-gray-600/50" />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setPreviewImg(null)}
                disabled={sending}
                className="px-4 py-2 rounded-lg bg-gray-600/30 border border-gray-500/40 text-gray-300 hover:bg-gray-600/50 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {t('dispatch_cancel')}
              </button>
              <button
                onClick={handleConfirmSend}
                disabled={sending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600/30 border border-green-500/50 text-green-300 hover:bg-green-600/50 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {t('dispatch_confirm_send')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DeviceDetailModal({ device: originalDevice, alarms: propAlarms, onClose }: { device: Device; alarms: AlarmEvent[]; onClose: () => void }) {
  const device = useDeviceSnapshot(originalDevice);
  const t = useT();
  const { lang } = useLang();
  const deviceAlarmsFromHook = useDeviceAlarms(device.id);
  const alarms = deviceAlarmsFromHook.length > 0 ? deviceAlarmsFromHook : propAlarms;
  const { user } = useAuth();
  const dt = device.device_types;
  const floor = device.floors;
  const building = floor?.buildings;
  const site = building?.sites;
  const [dispatched, setDispatched] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const showDispatch = isAlarmWorthy(device);

  const userName = (user?.user_metadata?.name as string) || user?.email || '';
  const userTelephone = (user?.user_metadata?.telephone as string) || '';

  const deviceAlarms = alarms
    .filter(a => a.device_id === device.id)
    .sort((a, b) => new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime());
  const openAlarm = deviceAlarms.find(a => a.status !== 'resolved' && a.status !== 'false_alarm');
  const falseAlarm = !openAlarm ? deviceAlarms.find(a => a.status === 'false_alarm') : undefined;
  const deviceAlarm = openAlarm ?? falseAlarm ?? deviceAlarms[0];
  const actionStatus = openAlarm ? t(openAlarm.status) : falseAlarm ? t('false_alarm') : t('Normal');

  const buildingName = building?.name_zh || building?.name || '-';
  const floorLabel = floor?.floor_label || '-';

  const handleDispatch = async () => {
    setDispatching(true);
    try {
      await dispatchDevice(device, lang, userName, userTelephone);
      setDispatched(true);
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 rounded-xl" onClick={onClose}>
      <div className="bg-gray-800 border border-gray-600 rounded-xl p-5 min-w-64 max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-white font-semibold truncate">{device.code}</h3>
            <StatusBadge status={device.status} size="sm" />
          </div>
          <button onClick={onClose} className="flex-shrink-0 text-gray-400 hover:text-white"><X size={16} /></button>
        </div>
        <div className="space-y-2 text-sm">
          <Row label={t('device_type')} value={dt?.name_zh_tw || dt?.name_en || '-'} />
          <Row label={t('action_status')} value={actionStatus} />
          {device.current_value != null && (
            <Row label={t('value')} value={`${device.current_value} ${dt?.unit || ''}`} />
          )}
          <Row label={t('site')} value={site?.name_zh || site?.name || '-'} />
          <Row label={t('building_floor')} value={`${buildingName} / ${floorLabel}`} />
          <Row label={t('location')} value={device.label} />
          <Row label={apiFieldLabel(lang, 'coordinates')} value={device.position_x == null || device.position_y == null ? '-' : `${device.position_x}, ${device.position_y}`} />
          <Row label={apiFieldLabel(lang, 'battery')} value={device.battery_value ?? '-'} />
          <Row label={apiFieldLabel(lang, 'signal')} value={device.signal_power ?? '-'} />
          <Row
            label={apiFieldLabel(lang, 'alarmRange')}
            value={device.alarm_min != null || device.alarm_max != null
              ? `${device.alarm_min ?? ''} – ${device.alarm_max ?? ''} ${dt?.unit || ''}`.trim()
              : '-'}
          />
          <Row label={apiFieldLabel(lang, 'lastSeen')} value={device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : '-'} />
          <Row label={apiFieldLabel(lang, 'reason')} value={device.reason || '-'} />
          <Row label={t('trigger_time')} value={deviceAlarm ? new Date(deviceAlarm.triggered_at).toLocaleString() : '-'} />
          {deviceAlarm?.dispatcher_name && (
            <Row label={t('dispatcher')} value={deviceAlarm.dispatcher_name} />
          )}
          {deviceAlarm?.dispatcher_contact && (
            <Row label={t('dispatcher_contact')} value={deviceAlarm.dispatcher_contact} />
          )}
        </div>
        <div className="mt-4 pt-3 border-t border-gray-700/50 space-y-2">
          {showDispatch && (
            <>
              {dispatched ? (
                <div className="flex flex-col items-center gap-1.5">
                  <div className="flex items-center gap-1.5 text-green-400 text-sm font-medium">
                    <CheckCircle size={16} />
                    {t('dispatched_short')}
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleDispatch}
                  disabled={dispatching}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-600/20 border border-green-500/40 text-green-400 hover:bg-green-600/30 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {dispatching ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {dispatching ? t('capturing') : t('dispatch_whatsapp')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-200 font-medium">{value}</span>
    </div>
  );
}

function apiFieldLabel(lang: string, field: 'coordinates' | 'battery' | 'signal' | 'alarmRange' | 'lastSeen' | 'reason') {
  const labels = {
    en: {
      coordinates: 'Plan coordinates', battery: 'Battery', signal: 'Signal power',
      alarmRange: 'Alarm range', lastSeen: 'Last seen', reason: 'Reason',
    },
    'zh-CN': {
      coordinates: '平面图坐标', battery: '电池值', signal: '信号强度',
      alarmRange: '告警范围', lastSeen: '最后上报', reason: '原因',
    },
    'zh-TW': {
      coordinates: '平面圖座標', battery: '電池值', signal: '訊號強度',
      alarmRange: '告警範圍', lastSeen: '最後上報', reason: '原因',
    },
  } as const;
  const language = lang === 'en' || lang === 'zh-CN' ? lang : 'zh-TW';
  return labels[language][field];
}

function LayerChip({ layer, active, onClick }: { layer: { id: LayerFilter; label: string; color: string }; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-full border transition-all ${
        active ? 'text-white' : 'bg-gray-700/40 text-gray-400 border-gray-700/40 hover:bg-gray-600/40'
      }`}
      style={active ? { backgroundColor: `${layer.color}20`, borderColor: `${layer.color}50` } : undefined}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: layer.color }} />
      {layer.label}
    </button>
  );
}

const SYMBOL_LEGEND: { code: string; labelKey: string }[] = [
  { code: 'SD', labelKey: 'smoke_detector' },
  { code: 'HD', labelKey: 'heat_detector' },
  { code: 'GD', labelKey: 'gas_detector' },
  { code: 'MCP', labelKey: 'manual_call_point' },
  { code: 'AB', labelKey: 'alarm_bell' },
  { code: 'FL', labelKey: 'flashlight' },
  { code: 'FSP', labelKey: 'fs_pump' },
  { code: 'SP', labelKey: 'spr_pump' },
  { code: 'FJP', labelKey: 'jockey_pump' },
  { code: 'FS_TANK', labelKey: 'fs_tank' },
  { code: 'SPR_TANK', labelKey: 'spr_tank' },
  { code: 'FS_FLOW', labelKey: 'flow_switch' },
  { code: 'SCV', labelKey: 'sub_valve' },
  { code: 'SPR_SYS', labelKey: 'system_pressure' },
  { code: 'SP_PANEL', labelKey: 'pump_panel' },
  { code: 'FD', labelKey: 'fire_damper' },
  { code: 'SEF', labelKey: 'smoke_fan' },
  { code: 'SPF', labelKey: 'stair_fan' },
  { code: 'VAC', labelKey: 'vac_cutoff' },
  { code: 'DIRECT_LINK', labelKey: 'direct_link' },
  { code: 'GENSET', labelKey: 'genset' },
  { code: 'FUEL_TANK', labelKey: 'fuel_tank' },
  { code: 'F_LIFT', labelKey: 'lift_homing' },
  { code: 'FIRE_DOOR', labelKey: 'fire_door' },
];

function SymbolLegend({ t }: { t: (k: string) => string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-gray-900/85 rounded-lg border border-gray-700/50 max-w-[180px]">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-gray-300 hover:text-white transition-colors"
      >
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold">{t('symbol_legend')}</span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div className="px-2 pb-2 grid grid-cols-2 gap-x-2 gap-y-1 max-h-48 overflow-y-auto">
          {SYMBOL_LEGEND.map(({ code, labelKey }) => (
            <div key={code} className="flex items-center gap-1">
              <div className="flex items-center justify-center w-4 h-4 flex-shrink-0">
                <MiniDeviceIcon code={code} color="#9ca3af" />
              </div>
              <span className="text-gray-400 truncate" style={{ fontSize: '8px' }}>{t(labelKey)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function FloorPlanPanel({ compact = false, buildingId, embedded = false, hideInfoBanner = false, initialFloorId, externalDevices, uniformBlueIcons = false, fireAlarmDeviceIds, externalOpenAlarmDeviceIds, externalActiveAlarmDeviceIds, onDeviceSelect, onCaptureReady }: { compact?: boolean; buildingId?: string; embedded?: boolean; hideInfoBanner?: boolean; initialFloorId?: string; externalDevices?: Device[]; uniformBlueIcons?: boolean; fireAlarmDeviceIds?: Set<string>; externalOpenAlarmDeviceIds?: Set<string>; externalActiveAlarmDeviceIds?: Set<string>; onDeviceSelect?: (device: Device) => void; onCaptureReady?: (fn: (deviceCode?: string) => Promise<string | null>) => void }) {
  const t = useT();
  const { lang } = useLang();
  const [fallbackBuildingId, setFallbackBuildingId] = useState<string | undefined>();
  const effectiveBuildingId = buildingId || fallbackBuildingId;
  const { floors } = useFloors(effectiveBuildingId || '__unresolved_building__');
  const [selectedFloorId, setSelectedFloorId] = useState<string>(initialFloorId ?? ALL);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [layer, setLayer] = useState<LayerFilter>('all');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [buildingCtx, setBuildingCtx] = useState<BuildingContext | null>(null);
  const [timestamp, setTimestamp] = useState(() => new Date());
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (buildingId) {
      setFallbackBuildingId(undefined);
      return;
    }
    let cancelled = false;
    apiClient.from('buildings').select('id').order('name').limit(1).maybeSingle().then(({ data }) => {
      if (!cancelled) setFallbackBuildingId(data?.id || undefined);
    });
    return () => { cancelled = true; };
  }, [buildingId]);

  useEffect(() => {
    setSelectedFloorId(ALL);
    setSelectedDevice(null);
    setLayer('all');
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [effectiveBuildingId]);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [selectedFloorId]);

  const isAll = selectedFloorId === ALL;
  const floorIds = floors.map(f => f.id);
  const { devices: fetchedDevices } = useDevices(
    isAll ? undefined : selectedFloorId,
    isAll ? floorIds : undefined,
  );
  const { alarms } = useAlarms();

  // When the parent supplies external devices, it also supplies alarm info
  // (open + active device-ID sets) that updates instantly via the parent's
  // optimistic state. In that case we skip our own alarm override and use the
  // parent's data for flash mode, so the floor plan reacts immediately to
  // dispatch / false-alarm / acknowledge actions.
  const useExternalAlarms = Boolean(externalDevices && externalOpenAlarmDeviceIds);

  // Use externally-provided devices (already loaded + realtime-updated by parent)
  // when available, so the floor plan shows the same statuses as the parent's
  // floor button indicators. Fall back to our own fetch when no external data.
  const devices = useMemo(() => {
    if (externalDevices) {
      return isAll
        ? externalDevices
        : externalDevices.filter(d => d.floor_id === selectedFloorId);
    }
    return fetchedDevices;
  }, [externalDevices, fetchedDevices, isAll, selectedFloorId]);

  // Floor-plan images for the selected floor (or building-level when "All")
  const activeFloor = floors.find(f => f.id === selectedFloorId) ?? null;
  const { images } = useFloorPlanImages(effectiveBuildingId, isAll ? undefined : selectedFloorId);

  const activeImage = images.find(i => i.is_active) ?? images[0] ?? null;
  const floorImageUrl = activeFloor?.image_url ?? activeImage?.image_url ?? null;
  const hasImage = Boolean(floorImageUrl);

  const { fitRect, imageError } = useFloorPlanFit(floorImageUrl, contentRef);

  // Work-order lifecycle controls flashing only, never the physical status or count.
  const alarmDeviceMap = useMemo(() => {
    const map = new Map<string, { isActive: boolean }>();
    for (const alarm of alarms) {
      if (alarm.status === 'resolved' || alarm.status === 'false_alarm') continue;
      const existing = map.get(alarm.device_id);
      map.set(alarm.device_id, { isActive: existing?.isActive === true || alarm.status === 'active' });
    }
    return map;
  }, [alarms]);
  const mergedDevices = devices;

  const flashModeFor = useCallback((deviceId: string): 'flash' | 'solid' | undefined => {
    if (useExternalAlarms) {
      if (!externalOpenAlarmDeviceIds!.has(deviceId)) return undefined;
      return externalActiveAlarmDeviceIds!.has(deviceId) ? 'flash' : 'solid';
    }
    const info = alarmDeviceMap.get(deviceId);
    if (!info) return undefined;
    return info.isActive ? 'flash' : 'solid';
  }, [alarmDeviceMap, useExternalAlarms, externalOpenAlarmDeviceIds, externalActiveAlarmDeviceIds]);

  const alarmCount = mergedDevices.filter(d => d.status === 'Alarm' || d.status === 'Activated').length;
  const faultCount = mergedDevices.filter(d => d.status === 'Fault').length;

  const visibleDevices = layer === 'all'
    ? mergedDevices
    : mergedDevices.filter(d => d.device_types?.category === layer);

  const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (zoom <= 1) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isPanning) return;
    setPan({
      x: panStart.current.panX + (e.clientX - panStart.current.x) / zoom,
      y: panStart.current.panY + (e.clientY - panStart.current.y) / zoom,
    });
  };
  const onPointerUp = () => setIsPanning(false);

  useEffect(() => {
    if (initialFloorId) setSelectedFloorId(initialFloorId);
  }, [initialFloorId]);

  // Fetch building → site → project chain for the info overlay
  useEffect(() => {
    if (!effectiveBuildingId) {
      setBuildingCtx(null);
      return;
    }
    const bid = effectiveBuildingId;
    let cancelled = false;
    (async () => {
      const { data: b } = await apiClient.from('buildings').select('*, sites(*)').eq('id', bid).single();
      if (cancelled || !b) return;
      const site = b.sites as Site | null;
      let projectName = '-';
      if (site?.project_id) {
        const { data: p } = await apiClient.from('projects').select('*').eq('id', site.project_id).single();
        if (p) projectName = localName((p as Project).name, (p as Project).name_zh, lang);
      }
      setBuildingCtx({
        buildingName: localName(b.name, b.name_zh, lang),
        siteName: site ? localName(site.name, site.name_zh, lang) : '-',
        projectName,
        floorLabel: activeFloor?.floor_label ?? (isAll ? (lang === 'en' ? 'All Floors' : '全部樓層') : '-'),
      });
    })();
    return () => { cancelled = true; };
  }, [effectiveBuildingId, lang, activeFloor?.floor_label, isAll]);

  // Update timestamp every second for the overlay
  useEffect(() => {
    const interval = setInterval(() => setTimestamp(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleExport = useCallback(async () => {
    if (!viewportRef.current || exporting) return;
    setExporting(true);
    try {
      const node = viewportRef.current;
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#020d25',
      });
      const link = document.createElement('a');
      const fallbackCode = `${buildingCtx?.buildingName ?? 'Building'}-${activeFloor?.floor_label ?? 'All'}`;
      link.download = buildScreenshotFilename(fallbackCode);
      link.href = dataUrl;
      link.click();
      showScreenshotToast({ success: true, method: 'dom', });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showScreenshotToast({ success: false, method: 'none', error: msg });
    } finally {
      setExporting(false);
    }
  }, [exporting, buildingCtx, activeFloor]);

  const captureFloorPlan = useCallback(async (deviceCode?: string): Promise<string | null> => {
    if (!viewportRef.current) return null;
    try {
      const node = viewportRef.current;
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#020d25',
      });
      const link = document.createElement('a');
      const code = deviceCode ?? `${buildingCtx?.buildingName ?? 'Building'}-${activeFloor?.floor_label ?? 'All'}`;
      const filename = buildScreenshotFilename(code);
      link.download = filename;
      link.href = dataUrl;
      link.click();
      showScreenshotToast({ success: true, method: 'dom' });
      return filename;
    } catch {
      return null;
    }
  }, [buildingCtx, activeFloor]);

  useEffect(() => {
    if (onCaptureReady) onCaptureReady(captureFloorPlan);
  }, [onCaptureReady, captureFloorPlan]);

  return (
    <div className="flex flex-col h-full">
      {!embedded && (
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-blue-400" />
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{t('floor_plan')}</span>
          </div>
          <div className="flex items-center gap-2">
            {alarmCount > 0 && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">{alarmCount} {t('alarms')}</span>}
            {faultCount > 0 && <span className="text-xs bg-yellow-300/20 text-yellow-300 px-2 py-0.5 rounded-full border border-yellow-300/30">{faultCount} {t('faults')}</span>}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
              {exporting ? t('export_capturing') : t('export_floor_plan')}
            </button>
          </div>
        </div>
      )}

      {!embedded && (
        <div className="flex gap-1 mb-3 flex-shrink-0 flex-wrap items-center">
          <button
            onClick={() => { setSelectedFloorId(ALL); setSelectedDevice(null); }}
            className={`px-2 py-1 text-xs rounded transition-colors ${isAll ? 'bg-blue-500 text-white' : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50'}`}
          >
            {lang === 'en' ? 'All' : lang === 'zh-CN' ? '全部' : '全部'}
          </button>
          {floors.map(f => (
            <button
              key={f.id}
              onClick={() => { setSelectedFloorId(f.id); setSelectedDevice(null); }}
              className={`px-2 py-1 text-xs rounded transition-colors ${selectedFloorId === f.id ? 'bg-blue-500 text-white' : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50'}`}
            >
              {f.floor_label}
            </button>
          ))}
        </div>
      )}

      {/* Layer filters */}
      {!compact && (
        <div className="flex gap-1.5 mb-3 flex-shrink-0 flex-wrap">
          {LAYERS.map(l => (
            <LayerChip key={l.id} layer={{ ...l, label: l.id === 'all' ? (lang === 'en' ? 'All' : lang === 'zh-CN' ? '全部' : '全部') : l.id === 'detection' ? (lang === 'en' ? 'Fire Safety' : lang === 'zh-CN' ? '探测报警' : '探測報警') : l.id === 'ventilation' ? (lang === 'en' ? 'HVAC' : lang === 'zh-CN' ? '通风排烟' : '通風排煙') : l.id === 'pump' ? (lang === 'en' ? 'Pump' : lang === 'zh-CN' ? '泵' : '泵') : l.id === 'water' ? (lang === 'en' ? 'Water' : lang === 'zh-CN' ? '水系统' : '水系統') : (lang === 'en' ? 'Comms' : lang === 'zh-CN' ? '通讯' : '通訊') }} active={layer === l.id} onClick={() => setLayer(l.id)} />
          ))}
        </div>
      )}

      <div
        ref={viewportRef}
        data-screenshot-target
        className="relative flex-1 flex flex-col overflow-hidden min-h-0"
      >
        {/* Info banner — top bar, not overlaying the floor plan */}
        {!hideInfoBanner && (
          <div className="flex items-center gap-2 px-3 py-1.5 pointer-events-none flex-shrink-0">
            <MapPin size={11} className="text-cyan-400 flex-shrink-0" />
            <span className="text-[13px] text-gray-200 font-medium truncate">
              {buildingCtx ? [
                buildingCtx.projectName,
                buildingCtx.siteName,
                buildingCtx.buildingName,
                buildingCtx.floorLabel,
              ].filter(Boolean).join(' · ') : t('floor_plan')}
            </span>
            <span className="text-gray-600 flex-shrink-0">|</span>
            <span className="text-[12px] text-gray-400 font-mono flex-shrink-0">
              {formatTimestamp(timestamp, lang)}
            </span>
          </div>
        )}

        {/* Floor plan content area — fills all space below the banner */}
        <div
          ref={contentRef}
          className="relative flex-1 min-h-0 overflow-hidden"
          style={{ cursor: isPanning ? 'grabbing' : zoom > 1 ? 'grab' : 'default' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {/* Floor-plan image layer */}
          {hasImage && !imageError && fitRect ? (
            <>
              {/* Image fills the fitted rect exactly — no cropping.
                  Subtle border and glow make it look like a framed plan. */}
              <div
                className="absolute overflow-hidden rounded-sm"
                style={{
                  left: fitRect.left,
                  top: fitRect.top,
                  width: fitRect.width,
                  height: fitRect.height,
                  transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                  transformOrigin: 'center',
                  transition: isPanning ? 'none' : 'transform 80ms ease-out',
                  boxShadow: '0 0 0 1px rgba(34,211,238,0.15), 0 0 20px rgba(34,211,238,0.05)',
                }}
              >
                <img
                  src={floorImageUrl!}
                  alt={activeFloor?.floor_label || (lang === 'en' ? 'Floor plan' : lang === 'zh-CN' ? '楼层平面图' : '樓層平面圖')}
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                  style={{ opacity: 0.85 }}
                  draggable={false}
                />
                {/* Equipment markers inside the fitted rect so % coords map to the image */}
                {visibleDevices.map(d => (
                  <DeviceIcon key={d.id} device={d} onClick={() => onDeviceSelect ? onDeviceSelect(d) : setSelectedDevice(d)} dimmed={false} uniformBlue={uniformBlueIcons} flashMode={flashModeFor(d.id)} isFireAlarm={fireAlarmDeviceIds?.has(d.id)} />
                ))}
              </div>
            </>
          ) : hasImage && !imageError ? (
            /* Fallback while image ratio is still loading — use object-contain on full content area */
            <img
              src={floorImageUrl!}
              alt={activeFloor?.floor_label || (lang === 'en' ? 'Floor plan' : lang === 'zh-CN' ? '楼层平面图' : '樓層平面圖')}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
              style={{ opacity: 0.85 }}
              draggable={false}
            />
          ) : (
            <>
              {/* SVG schematic fallback when no image is uploaded */}
              <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
                <rect x="5" y="5" width="90" height="90" fill="none" stroke="#60a5fa" strokeWidth="0.5" rx="1"/>
                <rect x="5" y="5" width="40" height="40" fill="none" stroke="#60a5fa" strokeWidth="0.3"/>
                <rect x="45" y="5" width="50" height="40" fill="none" stroke="#60a5fa" strokeWidth="0.3"/>
                <rect x="5" y="45" width="40" height="50" fill="none" stroke="#60a5fa" strokeWidth="0.3"/>
                <rect x="45" y="45" width="50" height="50" fill="none" stroke="#60a5fa" strokeWidth="0.3"/>
                <line x1="5" y1="45" x2="95" y2="45" stroke="#60a5fa" strokeWidth="0.5" strokeDasharray="2,2"/>
                <line x1="45" y1="5" x2="45" y2="95" stroke="#60a5fa" strokeWidth="0.5" strokeDasharray="2,2"/>
                <text x="23" y="24" fill="#60a5fa" fontSize="4" textAnchor="middle">Zone A</text>
                <text x="68" y="24" fill="#60a5fa" fontSize="4" textAnchor="middle">Zone B</text>
                <text x="23" y="68" fill="#60a5fa" fontSize="4" textAnchor="middle">Zone C</text>
                <text x="68" y="68" fill="#60a5fa" fontSize="4" textAnchor="middle">Zone D</text>
              </svg>
              <div className="absolute top-3 left-3 flex items-center gap-1.5 text-gray-600 text-xs">
                <ImageIcon size={12} />
                <span>{imageError ? (lang === 'en' ? 'Floor-plan image failed to load' : lang === 'zh-CN' ? '平面图图片加载失败，请检查图片地址或网络' : '平面圖圖片載入失敗，請檢查圖片地址或網絡') : (lang === 'en' ? 'No plan image — showing schematic' : lang === 'zh-CN' ? '无平面图 — 显示示意图' : '無平面圖 — 顯示示意圖')}</span>
              </div>
            </>
          )}

          {/* Equipment markers — only rendered here when there's no fitted image wrapper.
              When an image is fitted, markers are rendered inside the fitted rect above. */}
          {!hasImage && visibleDevices.map(d => (
            <DeviceIcon key={d.id} device={d} onClick={() => onDeviceSelect ? onDeviceSelect(d) : setSelectedDevice(d)} dimmed={false} uniformBlue={uniformBlueIcons} flashMode={flashModeFor(d.id)} isFireAlarm={fireAlarmDeviceIds?.has(d.id)} />
          ))}
          <FloorPlanCoordinateNotice devices={visibleDevices} />

          {/* Zoom controls + Export (shown in full mode or when embedded) */}
          {(!compact || embedded) && (
            <div className="absolute top-2 right-2 flex flex-col gap-1 bg-gray-900/80 rounded-lg p-1 border border-gray-700/50">
              <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-1 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded transition-colors" title={lang === 'en' ? 'Zoom in' : lang === 'zh-CN' ? '放大' : '放大'}>
                <ZoomIn size={14} />
              </button>
              <button onClick={() => setZoom(z => Math.max(1, z - 0.25))} className="p-1 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded transition-colors" title={lang === 'en' ? 'Zoom out' : lang === 'zh-CN' ? '缩小' : '縮小'}>
                <ZoomOut size={14} />
              </button>
              <button onClick={resetView} className="p-1 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded transition-colors" title={lang === 'en' ? 'Reset view' : lang === 'zh-CN' ? '重置视图' : '重置視圖'}>
                <Maximize2 size={14} />
              </button>
              <div className="border-t border-gray-700/50 my-0.5" />
              <button
                onClick={handleExport}
                disabled={exporting}
                className="p-1 text-cyan-300 hover:text-white hover:bg-cyan-600/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={t('export_floor_plan')}
              >
                {exporting ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              </button>
            </div>
          )}

          {/* Status legend + Symbol legend */}
          {!compact && (
            <div className="absolute bottom-2 left-2 flex items-end gap-2">
              <div className="flex flex-col gap-1 bg-gray-900/80 rounded p-2">
                <div className="flex items-center gap-1.5">
                  <StatusDot status="Normal" size={8} />
                  <span className="text-gray-400" style={{ fontSize: '9px' }}>{t('Normal')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusDot status="Alarm" size={8} />
                  <span className="text-gray-400" style={{ fontSize: '9px' }}>{t('legend_active_alarm')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusDot status="Alarm" size={8} solid />
                  <span className="text-gray-400" style={{ fontSize: '9px' }}>{t('legend_ack_alarm')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusDot status="Fault" size={8} />
                  <span className="text-gray-400" style={{ fontSize: '9px' }}>{t('legend_active_fault')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusDot status="Fault" size={8} solid />
                  <span className="text-gray-400" style={{ fontSize: '9px' }}>{t('legend_ack_fault')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusDot status="Offline" size={8} />
                  <span className="text-gray-400" style={{ fontSize: '9px' }}>{t('Offline')}</span>
                </div>
              </div>
              <SymbolLegend t={t} />
            </div>
          )}

          {/* Zoom indicator */}
          {!compact && zoom > 1 && (
            <div className="absolute bottom-2 right-2 text-gray-500 text-xs bg-gray-900/80 px-2 py-0.5 rounded">
              {Math.round(zoom * 100)}%
            </div>
          )}

          {/* Export button for compact (non-embedded) mode */}
          {compact && !embedded && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed z-10"
              title={t('export_floor_plan')}
            >
              {exporting ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
            </button>
          )}

          {selectedDevice && !onDeviceSelect && (
            <DeviceDetailModal device={selectedDevice} alarms={alarms} onClose={() => setSelectedDevice(null)} />
          )}
        </div>
      </div>
    </div>
  );
}
