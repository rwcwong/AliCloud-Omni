import { useState } from 'react';
import {
  Shield, LayoutDashboard, Bell, Droplets, Brain,
  ChevronRight, Wifi, WifiOff, Wind
} from 'lucide-react';
import { useTransport } from '../transport/TransportContext';
import { useDevices } from '../hooks/useDevices';
import { useAlarms } from '../hooks/useAlarms';
import { usePredictions } from '../hooks/usePredictions';
import { useFloors } from '../hooks/useFloors';
import { StatusDot } from '../components/StatusDot';
import { StatusBadge } from '../components/StatusBadge';
import { AlarmEvent, Device } from '../types';
import { severityBgClass, statusColor } from '../lib/colors';
import { timeAgo } from '../lib/timeAgo';
import { useT, useLang } from '../lib/i18n';
import { translateAlarmType, translateDescription } from '../lib/alarmI18n';
import { VentilationPanel } from '../panels/VentilationPanel';
import { PowerLinkagePanel } from '../panels/PowerLinkagePanel';

type MobileTab = 'home' | 'alarms' | 'devices' | 'systems' | 'ai';

function HealthScore({ devices }: { devices: Device[] }) {
  const total = devices.length || 1;
  const healthy = devices.filter(d =>
    ['Normal','Power On','Running','Auto Mode','Closed','Open'].includes(d.status)
  ).length;
  const score = Math.round((healthy / total) * 1000) / 10;
  const color = score >= 95 ? '#22c55e' : score >= 80 ? '#eab308' : '#ef4444';
  const circumference = 2 * Math.PI * 26;
  const dash = (score / 100) * circumference;
  const { lang } = useLang();
  return (
    <div className="bg-gray-800/60 border border-gray-700/30 rounded-xl p-4 flex items-center gap-4">
      <div className="relative w-16 h-16 flex-shrink-0">
        <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
          <circle cx="28" cy="28" r="26" fill="none" stroke="#1f2937" strokeWidth="5"/>
          <circle cx="28" cy="28" r="26" fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round"/>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{ color }}>{score}%</span>
        </div>
      </div>
      <div>
        <div className="text-white font-semibold">{lang === 'en' ? 'System Health Score' : lang === 'zh-CN' ? '系统健康评分' : '系統健康評分'}</div>
        <div className="text-xs mt-1" style={{ color }}>
          {score >= 95 ? (lang === 'en' ? 'Excellent' : lang === 'zh-CN' ? '优秀' : '優秀') : score >= 80 ? (lang === 'en' ? 'Good' : lang === 'zh-CN' ? '良好' : '良好') : (lang === 'en' ? 'Attention Required' : lang === 'zh-CN' ? '需要关注' : '需要關注')}
        </div>
      </div>
    </div>
  );
}

function MobileAlarmItem({ alarm, onAck }: { alarm: AlarmEvent; onAck: () => void }) {
  const t = useT();
  const { lang } = useLang();
  const device = alarm.devices;
  const floor = device?.floors;
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${alarm.status === 'active' ? 'bg-red-500/5 border-red-500/20' : 'bg-gray-800/60 border-gray-700/30'}`}>
      <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${(alarm.severity === 'critical' || alarm.severity === 'alarm') ? 'bg-red-500' : alarm.severity === 'high' ? 'bg-orange-500' : 'bg-yellow-500'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-1.5 py-0.5 rounded border ${severityBgClass(alarm.severity)}`}>{t(alarm.severity)}</span>
          <span className="text-white text-sm font-medium truncate">{translateAlarmType(alarm.alarm_type, device, lang, t)}</span>
        </div>
        <p className="text-gray-400 text-xs mt-0.5 truncate">{translateDescription(alarm.description, device, lang, t)}</p>
        <div className="flex items-center gap-1.5 mt-1 text-gray-500 text-xs">
          {floor && <span>{floor.floor_label}</span>}
          {device?.code && <><span>·</span><span>{device.code}</span></>}
          <span>·</span>
          <span>{timeAgo(alarm.triggered_at)}</span>
        </div>
      </div>
      {alarm.status === 'active' && (
        <button onClick={onAck}
          className="text-xs px-2 py-1 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 flex-shrink-0 hover:bg-blue-500/30 transition-colors">
          {t('acknowledge')}
        </button>
      )}
    </div>
  );
}

function DeviceListItem({ device }: { device: Device }) {
  const dt = device.device_types;
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-800/60 rounded-xl border border-gray-700/30">
      <StatusDot status={device.status} size={10} />
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium">{device.code}</div>
        <div className="text-gray-400 text-xs">{dt?.name_zh_tw || dt?.name_en || ''}</div>
      </div>
      <div className="text-right">
        <StatusBadge status={device.status} size="sm" />
        {device.current_value != null && (
          <div className="text-xs text-gray-400 mt-1">{device.current_value} {dt?.unit}</div>
        )}
      </div>
    </div>
  );
}

function FloorStatusRowMobile({ floorId, label, onPress }: { floorId: string; label: string; onPress: () => void }) {
  const { devices } = useDevices(floorId);
  const t = useT();
  const alarmC  = devices.filter(d => d.status === 'Alarm' || d.status === 'Activated').length;
  const faultC  = devices.filter(d => d.status === 'Fault').length;
  const allGood = alarmC === 0 && faultC === 0;
  return (
    <button onClick={onPress}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${alarmC > 0 ? 'border-red-500/30 bg-red-500/5' : faultC > 0 ? 'border-yellow-500/20 bg-yellow-500/5' : 'border-gray-700/30 bg-gray-800/40'}`}>
      <span className="text-gray-400 text-sm font-mono w-10 flex-shrink-0">{label}</span>
      <div className="flex gap-1 flex-1 flex-wrap">
        {devices.slice(0, 8).map(d => <StatusDot key={d.id} status={d.status} size={8} />)}
      </div>
      <div>
        {allGood
          ? <span className="text-green-500 text-xs">{t('dash_normal')}</span>
          : alarmC > 0
            ? <span className="text-red-400 text-xs font-bold animate-pulse">⚠{alarmC}</span>
            : <span className="text-yellow-400 text-xs">⚠{faultC}</span>
        }
      </div>
      <ChevronRight size={14} className="text-gray-600 flex-shrink-0" />
    </button>
  );
}

function MiniTank({ level, label, isLow }: { level: number; label: string; isLow: boolean }) {
  const { lang } = useLang();
  const color = isLow ? '#ef4444' : '#22c55e';
  return (
    <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700/30">
      <div className="text-xs text-gray-400 mb-2">{label}</div>
      <div className="flex items-end gap-2">
        <div className="relative w-8 h-14">
          <svg viewBox="0 0 32 56" className="w-full h-full">
            <rect x="1" y="1" width="30" height="54" rx="4" fill="#111827" stroke="#374151" strokeWidth="1"/>
            <rect x="1" y={1 + 54 * (1 - level / 100)} width="30" height={54 * (level / 100)} rx="3"
              fill={color} opacity="0.85"/>
            <rect x="1" y="1" width="30" height="54" rx="4" fill="none" stroke="#4b5563" strokeWidth="1"/>
          </svg>
        </div>
        <div>
          <div className="text-xl font-bold leading-none" style={{ color }}>{Math.round(level)}%</div>
          {isLow && <div className="text-xs text-red-400 font-bold mt-0.5 animate-pulse">{lang === 'en' ? 'LOW' : '低'}</div>}
        </div>
      </div>
    </div>
  );
}

export function MobileView() {
  const t = useT();
  const { lang } = useLang();
  const { connectionState } = useTransport();
  const { devices: allDevices }  = useDevices();
  const { alarms, acknowledge }  = useAlarms();
  const { predictions }          = usePredictions();
  const firstBuildingId = allDevices.find(device => device.floors?.building_id)?.floors?.building_id;
  const { floors }               = useFloors(firstBuildingId);
  const [tab, setTab]            = useState<MobileTab>('home');

  const activeAlarms = alarms.filter(a => a.status === 'active');
  const orderedFloors = [...floors].sort((a, b) => b.floor_number - a.floor_number);
  const pumpDevices = allDevices.filter(device => device.device_types?.category === 'pump');
  const fsTank  = pumpDevices.find(d => d.code === 'FS-TANK-1');
  const sprTank = pumpDevices.find(d => d.code === 'SPR-TANK-1');
  const pumps   = pumpDevices.filter(d => ['FSP-1', 'FSP-2', 'SP-1', 'SP-2', 'FJP-1'].includes(d.code));
  const isConnected = connectionState === 'connected';

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white overflow-hidden" style={{ maxWidth: 430, margin: '0 auto' }}>

      {/* Status bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-1.5">
          {isConnected ? <Wifi size={12} className="text-green-400" /> : <WifiOff size={12} className="text-red-400" />}
          <span className="text-xs text-gray-500">{isConnected ? (lang === 'en' ? 'Live' : lang === 'zh-CN' ? '实时' : '實時') : (lang === 'en' ? 'Offline' : lang === 'zh-CN' ? '离线' : '離線')}</span>
        </div>
      </div>

      {/* Header */}
      <header className="flex-shrink-0 px-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-red-500/20 border border-red-500/30">
            <Shield size={16} className="text-red-400" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-none">{t('platform_short')} AIoT</div>
            <div className="text-gray-500 text-xs mt-0.5">Tower A · {isConnected ? (lang === 'en' ? 'Live Sync' : lang === 'zh-CN' ? '实时同步' : '實時同步') : (lang === 'en' ? 'Offline Mode' : lang === 'zh-CN' ? '离线模式' : '離線模式')}</div>
          </div>
          {activeAlarms.length > 0 && (
            <div className="ml-auto flex items-center gap-1 bg-red-500/20 border border-red-500/30 rounded-full px-2 py-0.5 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span className="text-red-400 text-xs font-bold">{activeAlarms.length}</span>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-20">

        {tab === 'home' && (
          <div className="space-y-4">
            {/* Health Score */}
            <HealthScore devices={allDevices} />

            {/* KPI Grid */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: t('alarms'), val: activeAlarms.length, color: '#ef4444' },
                { label: t('faults'), val: allDevices.filter(d => d.status === 'Fault').length, color: '#f59e0b' },
                { label: t('online'), val: allDevices.filter(d => d.status !== 'Offline').length, color: '#22c55e' },
              ].map(({ label, val, color }) => (
                <div key={label} className="bg-gray-800/60 border border-gray-700/30 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold" style={{ color }}>{val}</div>
                  <div className="text-xs text-gray-400 mt-0.5 leading-tight">{label}</div>
                </div>
              ))}
            </div>

            {/* Floor Status */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-white">{t('building_status')}</span>
                <button onClick={() => setTab('devices')} className="text-xs text-blue-400 flex items-center gap-1">
                  {t('view_all')} <ChevronRight size={12} />
                </button>
              </div>
              <div className="space-y-1.5">
                {orderedFloors.slice(0, 6).map(f => (
                  <FloorStatusRowMobile
                    key={f.id}
                    floorId={f.id}
                    label={f.floor_label}
                    onPress={() => setTab('devices')}
                  />
                ))}
              </div>
            </div>

            {/* Recent Alarms */}
            {activeAlarms.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-white">{t('latest_alarms')}</span>
                  <button onClick={() => setTab('alarms')} className="text-xs text-blue-400 flex items-center gap-1">
                    {t('view_all')} <ChevronRight size={12} />
                  </button>
                </div>
                <div className="space-y-2">
                  {activeAlarms.slice(0, 3).map(a => (
                    <MobileAlarmItem key={a.id} alarm={a} onAck={() => acknowledge(a.id)} />
                  ))}
                </div>
              </div>
            )}

            {/* Pump Room Quick */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-white">{t('pump_room')}</span>
                <button onClick={() => setTab('systems')} className="text-xs text-blue-400 flex items-center gap-1">
                  <ChevronRight size={12} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                {fsTank  && <MiniTank level={fsTank.current_value ?? 0}  label={t('fs_tank')}  isLow={fsTank.status === 'Low Level'} />}
                {sprTank && <MiniTank level={sprTank.current_value ?? 0} label={t('spr_tank')} isLow={sprTank.status === 'Low Level'} />}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {pumps.map(p => (
                  <div key={p.id} className="bg-gray-800/60 rounded-xl p-2 border border-gray-700/30 text-center">
                    <StatusDot status={p.status} size={8} />
                    <div className="text-xs text-white font-medium mt-1">{p.code}</div>
                    <div className="text-xs mt-0.5" style={{ color: statusColor(p.status), fontSize: '10px' }}>{p.status}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Predictions */}
            {predictions.filter(p => p.status === 'pending').length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-white">{t('ai_maintenance')}</span>
                  <button onClick={() => setTab('ai')} className="text-xs text-blue-400 flex items-center gap-1">
                    {t('view_all')} <ChevronRight size={12} />
                  </button>
                </div>
                {predictions.filter(p => p.status === 'pending').slice(0, 2).map(p => (
                  <div key={p.id} className="bg-gray-800/60 rounded-xl p-3 border border-yellow-500/20 mb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white">{p.prediction_type}</span>
                      <span className="text-xs font-bold text-orange-400">{Math.round(p.fault_probability * 100)}%</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{p.recommendation_zh}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'alarms' && (
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-white mb-3">{t('realtime_alarms')}</h2>
            {alarms.length === 0
              ? <div className="text-center text-gray-500 py-12 text-sm">{t('no_alarms')}</div>
              : alarms.map(a => <MobileAlarmItem key={a.id} alarm={a} onAck={() => acknowledge(a.id)} />)
            }
          </div>
        )}

        {tab === 'devices' && (
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-white mb-3">{t('total_devices')} ({allDevices.length})</h2>
            {allDevices.map(d => <DeviceListItem key={d.id} device={d} />)}
          </div>
        )}

        {tab === 'systems' && (
          <div className="space-y-4">
            <div className="bg-gray-900/60 border border-gray-800/40 rounded-xl p-4" style={{ minHeight: 400 }}>
              <VentilationPanel compact />
            </div>
            <div className="bg-gray-900/60 border border-gray-800/40 rounded-xl p-4" style={{ minHeight: 400 }}>
              <PowerLinkagePanel compact />
            </div>
          </div>
        )}

        {tab === 'ai' && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-white mb-3">{t('ai_maintenance')}</h2>
            {predictions.length === 0
              ? <div className="text-center text-gray-500 py-12 text-sm">{t('no_predictions')}</div>
              : predictions.map(p => (
                <div key={p.id} className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/30">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-white font-medium">{p.prediction_type}</div>
                      <div className="text-gray-400 text-xs mt-0.5">{p.devices?.code}</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded border ${p.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-green-500/20 text-green-400 border-green-500/30'}`}>
                      {t(p.status)}
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">{t('fault_probability')}</span>
                      <span className="font-bold text-orange-400">{Math.round(p.fault_probability * 100)}%</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-orange-500 transition-all"
                        style={{ width: `${p.fault_probability * 100}%` }}/>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 leading-relaxed">{p.recommendation_zh}</p>
                </div>
              ))
            }
          </div>
        )}
      </div>

      {/* Bottom Tab Bar */}
      <nav className="flex-shrink-0 flex items-center justify-around border-t border-gray-800/50 bg-gray-900/90 py-1.5 px-1">
        {([
          { id: 'home',    icon: LayoutDashboard, label: lang === 'en' ? 'Home' : '主页', badge: 0 },
          { id: 'alarms',  icon: Bell,            label: t('alarms'),  badge: activeAlarms.length },
          { id: 'devices', icon: Droplets,        label: t('floor_plan'), badge: 0 },
          { id: 'systems', icon: Wind,            label: t('nav_systems'),    badge: 0 },
          { id: 'ai',      icon: Brain,           label: 'AI',         badge: predictions.filter(p=>p.status==='pending').length },
        ] as const).map(({ id, icon: Icon, label, badge }) => (
          <button
            key={id}
            onClick={() => setTab(id as MobileTab)}
            className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all relative ${tab === id ? 'text-blue-400' : 'text-gray-500'}`}
          >
            <div className="relative">
              <Icon size={19} />
              {badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center font-bold" style={{ fontSize: '9px' }}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </div>
            <span className="text-xs font-medium leading-none">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
