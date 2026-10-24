import { useState } from 'react';
import { Bell, Droplets, Wind, Zap, FileText, Brain, Monitor, ArrowLeft, BarChart3, Package, ChevronDown, ChevronRight } from 'lucide-react';
import { FireAlarmIcon } from '../components/FireAlarmIcon';
import { FloorPlanPanel } from '../panels/FloorPlanPanel';
import { AlarmPanel } from '../panels/AlarmPanel';
import { PumpRoomPanel } from '../panels/PumpRoomPanel';
import { MaintenancePanel } from '../panels/MaintenancePanel';
import { AnalyticsPanel } from '../panels/AnalyticsPanel';
import { CompliancePanel } from '../panels/CompliancePanel';
import { VentilationPanel } from '../panels/VentilationPanel';
import { PowerLinkagePanel } from '../panels/PowerLinkagePanel';
import { DetectionPanel } from '../panels/DetectionPanel';
import { WaterPanel } from '../panels/WaterPanel';
import { EquipmentOverviewPanel } from '../panels/EquipmentOverviewPanel';
import { useAuth, isGlobalAdmin } from '../lib/auth';
import { useLang, useT } from '../lib/i18n';
import { Theme } from '../types';
import LightBar from '../components/LightBar';
import { ArtisticBanner, ContactFooter } from './OmniOSHome';

type ManagementTab = 'monitoring' | 'alarms' | 'maintenance' | 'analytics' | 'compliance' | 'equipment' | 'pumproom' | 'ventilation' | 'power' | 'detection' | 'water';

const EQUIPMENT_SUB_ITEMS: { id: ManagementTab; labelKey: string; icon: React.ElementType; descKey: string; color: string }[] = [
  { id: 'detection',  labelKey: 'nav_detection',  icon: FireAlarmIcon,    descKey: 'desc_detection', color: 'text-red-400' },
  { id: 'pumproom',   labelKey: 'nav_pumproom',   icon: Droplets, descKey: 'desc_pumproom',  color: 'text-blue-400' },
  { id: 'ventilation',labelKey: 'nav_ventilation',icon: Wind,     descKey: 'desc_ventilation',color: 'text-cyan-400' },
  { id: 'water',      labelKey: 'nav_water',      icon: Droplets, descKey: 'desc_water',     color: 'text-sky-400' },
  { id: 'power',      labelKey: 'nav_power',      icon: Zap,      descKey: 'desc_power',     color: 'text-yellow-400' },
];

const TOP_NAV: { id: ManagementTab; labelKey: string; icon: React.ElementType; descKey: string }[] = [
  { id: 'monitoring',  labelKey: 'nav_monitoring',  icon: Monitor,     descKey: 'desc_monitoring' },
  { id: 'alarms',      labelKey: 'nav_alarms',      icon: Bell,        descKey: 'desc_alarms' },
  { id: 'maintenance', labelKey: 'nav_maintenance', icon: Brain,       descKey: 'desc_maintenance' },
  { id: 'analytics',   labelKey: 'nav_analytics',   icon: BarChart3,   descKey: 'desc_analytics' },
  { id: 'compliance',  labelKey: 'nav_compliance',  icon: FileText,    descKey: 'desc_compliance_full' },
];

const BOTTOM_NAV: { id: ManagementTab; labelKey: string; icon: React.ElementType; descKey: string }[] = [];

const PANEL = 'rounded-xl border border-cyan-300/10 bg-cyan-300/[0.03] p-5 h-full overflow-hidden flex flex-col';

interface Props {
  buildingId?: string;
  onBack: () => void;
  initialTab?: ManagementTab;
  onSystemManagement: () => void;
  onAdminConsole: () => void;
  onNavigateDashboard?: () => void;
  onNavigateIpad?: () => void;
  onNavigateAlarms?: (status?: string) => void;
  onNavigateMaintenance?: () => void;
  onNavigateDevices?: () => void;
  theme: Theme;
  onThemeToggle?: () => void;
  onSignOut?: () => void;
  alarmFilterSiteId?: string;
  alarmFilterBuildingId?: string;
  alarmFilterFloorId?: string;
  alarmFilterStatus?: string;
  alarmFilterCategory?: string;
  maintenanceFilterStatus?: string;
}

export function SystemManagementPlatform({
  buildingId,
  onBack,
  initialTab = 'monitoring',
  onSystemManagement,
  onAdminConsole,
  onNavigateDashboard,
  onNavigateIpad,
  theme,
  onThemeToggle,
  onSignOut,
  alarmFilterSiteId,
  alarmFilterBuildingId,
  alarmFilterFloorId,
  alarmFilterStatus,
  alarmFilterCategory,
  maintenanceFilterStatus,
}: Props) {
  const [tab, setTab] = useState<ManagementTab>(initialTab);
  const [equipmentOpen, setEquipmentOpen] = useState<boolean>(
    ['equipment', 'detection', 'pumproom', 'ventilation', 'water', 'power'].includes(initialTab as string)
  );
  const { lang, setLang } = useLang();
  const t = useT();
  const { role, user } = useAuth();

  const canSeeMonitoring = isGlobalAdmin(role);

  const isEquipmentTab = (t: ManagementTab) =>
    t === 'equipment' || EQUIPMENT_SUB_ITEMS.some(s => s.id === t);

  function handleEquipmentClick() {
    if (tab === 'equipment' && equipmentOpen) {
      setEquipmentOpen(false);
    } else {
      setTab('equipment');
      setEquipmentOpen(true);
    }
  }

  function handleSubItemClick(id: ManagementTab) {
    setTab(id);
    setEquipmentOpen(true);
  }

  const effectiveTab = tab === 'monitoring' && !canSeeMonitoring ? 'alarms' : tab;

  const navBtn = (id: ManagementTab, labelKey: string, Icon: React.ElementType, descKey: string) => (
    <button
      key={id}
      onClick={() => { if (!canSeeMonitoring && id === 'monitoring') return; setTab(id); }}
      className={`w-full rounded-xl border px-3 py-2.5 text-left transition-all ${tab === id ? 'border-cyan-400/50 bg-cyan-500/10' : 'border-gray-700/30 text-gray-400 hover:border-gray-600/50 hover:bg-gray-700/20'}`}
    >
      <div className="flex items-center gap-2.5">
        <Icon size={14} className={tab === id ? 'text-cyan-400' : 'text-gray-500'} />
        <span className={`text-xs font-semibold ${tab === id ? 'text-white' : ''}`}>{t(labelKey)}</span>
      </div>
      <div className="ml-[22px] mt-0.5 text-[10px] text-gray-500">{t(descKey)}</div>
    </button>
  );

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
            isOnline={true}
            theme={theme}
            onThemeToggle={onThemeToggle}
            lang={lang}
            setLang={setLang}
            t={t}
            onSignOut={onSignOut}
          />
        </div>

        <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-xl border border-cyan-300/10 bg-cyan-300/[0.02]">
          {/* ── Sidebar ── */}
          <aside className="flex w-56 flex-shrink-0 flex-col border-r border-gray-700/30 bg-gray-800/40 backdrop-blur-sm">
            <div className="flex items-center gap-2.5 border-b border-gray-700/30 px-4 py-4">
              <button type="button" onClick={onBack} title={t('admin_back')} className="rounded-lg border border-gray-600/50 bg-gray-700/40 p-2 text-gray-300 transition-all hover:bg-gray-700/60">
                <ArrowLeft size={15} />
              </button>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-200">{t('banner_system_mgmt')}</div>
                <div className="text-xs text-gray-400">{t('operational_modules')}</div>
              </div>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {/* Top items */}
              {TOP_NAV.filter(({ id }) => id !== 'monitoring' || canSeeMonitoring).map(({ id, labelKey, icon: Icon, descKey }) =>
                navBtn(id, labelKey, Icon, descKey)
              )}

              {/* Equipment group */}
              <div>
                {/* Equipment parent button */}
                <button
                  onClick={handleEquipmentClick}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition-all ${isEquipmentTab(tab) ? 'border-cyan-400/50 bg-cyan-500/10' : 'border-gray-700/30 text-gray-400 hover:border-gray-600/50 hover:bg-gray-700/20'}`}
                >
                  <div className="flex items-center gap-2.5">
                    <Package size={14} className={isEquipmentTab(tab) ? 'text-cyan-400' : 'text-gray-500'} />
                    <span className={`text-xs font-semibold flex-1 ${isEquipmentTab(tab) ? 'text-white' : ''}`}>{t('nav_equipment')}</span>
                    {equipmentOpen
                      ? <ChevronDown size={12} className="text-gray-500 flex-shrink-0" />
                      : <ChevronRight size={12} className="text-gray-500 flex-shrink-0" />}
                  </div>
                  <div className="ml-[22px] mt-0.5 text-[10px] text-gray-500">{t('desc_equipment')}</div>
                </button>

                {/* Sub-items */}
                {equipmentOpen && (
                  <div className="mt-1 ml-3 space-y-0.5 border-l border-gray-700/40 pl-2">
                    {EQUIPMENT_SUB_ITEMS.map(({ id, labelKey, icon: Icon, descKey, color }) => (
                      <button
                        key={id}
                        onClick={() => handleSubItemClick(id)}
                        className={`w-full rounded-lg border px-2.5 py-2 text-left transition-all ${tab === id ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-transparent text-gray-500 hover:border-gray-700/30 hover:bg-gray-700/20'}`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon size={12} className={tab === id ? color : 'text-gray-600'} />
                          <span className={`text-[11px] font-semibold ${tab === id ? 'text-white' : 'text-gray-400'}`}>{t(labelKey)}</span>
                        </div>
                        <div className="ml-[20px] text-[9px] text-gray-600 truncate">{t(descKey)}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom items */}
              {BOTTOM_NAV.map(({ id, labelKey, icon: Icon, descKey }) =>
                navBtn(id, labelKey, Icon, descKey)
              )}
            </nav>
          </aside>

          {/* ── Main content ── */}
          <main className="flex-1 overflow-auto p-5 min-h-0">
            {effectiveTab === 'monitoring'  && <div className={PANEL}><FloorPlanPanel buildingId={buildingId} /></div>}
            {effectiveTab === 'alarms'      && <div className={PANEL}><AlarmPanel maxItems={50} initialSiteId={alarmFilterSiteId} initialBuildingId={alarmFilterBuildingId} initialFloorId={alarmFilterFloorId} initialStatus={alarmFilterStatus} initialCategory={alarmFilterCategory} /></div>}
            {effectiveTab === 'maintenance' && <div className={PANEL}><MaintenancePanel buildingId={buildingId} initialStatus={maintenanceFilterStatus} /></div>}
            {effectiveTab === 'analytics'   && <div className="rounded-xl border border-cyan-300/10 bg-cyan-300/[0.03] p-5" style={{ height: 'calc(100vh - 220px)' }}><AnalyticsPanel /></div>}
            {effectiveTab === 'compliance'  && <div className={PANEL}><CompliancePanel /></div>}
            {effectiveTab === 'equipment'   && <div className={PANEL}><EquipmentOverviewPanel /></div>}
            {effectiveTab === 'pumproom'    && <div className="rounded-xl border border-cyan-300/10 bg-cyan-300/[0.03] p-5" style={{ minHeight: 'calc(100vh - 220px)' }}><PumpRoomPanel /></div>}
            {effectiveTab === 'ventilation' && <div className={PANEL}><VentilationPanel /></div>}
            {effectiveTab === 'detection'   && <div className={PANEL}><DetectionPanel /></div>}
            {effectiveTab === 'water'       && <div className={PANEL}><WaterPanel /></div>}
            {effectiveTab === 'power'       && <div className={PANEL}><PowerLinkagePanel /></div>}

          </main>
        </div>

        <div className="flex-shrink-0">
          <ContactFooter />
        </div>
      </div>
    </div>
  );
}
