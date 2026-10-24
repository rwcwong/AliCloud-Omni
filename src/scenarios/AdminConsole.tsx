import { useState } from 'react';
import {
  Users, MapPin, Cpu, ClipboardList, BookMarked, Brain, Activity,
  Menu, X, ArrowLeft
} from 'lucide-react';
import { useAuth, isGlobalAdmin } from '../lib/auth';
import { useT, useLang } from '../lib/i18n';
import { UsersPage } from '../admin/pages/UsersPage';
import { SitesPage } from '../admin/pages/SitesPage';
import { EquipmentPage } from '../admin/pages/EquipmentPage';
import { AuditLogPage } from '../admin/pages/AuditLogPage';
import { FSDCodesPage } from '../admin/pages/FSDCodesPage';
import { MaintenanceRulesPage } from '../admin/pages/MaintenanceRulesPage';
import { SimulatorPage } from '../admin/pages/SimulatorPage';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import LightBar from '../components/LightBar';
import { ArtisticBanner, ContactFooter } from './OmniOSHome';
import type { Theme } from '../types';

type AdminTab = 'users' | 'sites' | 'equipment' | 'audit' | 'fsd_codes' | 'maintenance_rules' | 'simulator';

const NAV_ITEMS: { id: AdminTab; icon: React.ElementType; labelKey: string; descKey: string }[] = [
  { id: 'users',     icon: Users,         labelKey: 'users_title',     descKey: 'users_by_user' },
  { id: 'sites',     icon: MapPin,        labelKey: 'tab_sites',       descKey: 'site_subtitle' },
  { id: 'equipment', icon: Cpu,           labelKey: 'tab_equipment',   descKey: 'equip_subtitle' },
  { id: 'fsd_codes', icon: BookMarked,    labelKey: 'tab_fsd_codes',   descKey: 'fsd_subtitle' },
  { id: 'maintenance_rules', icon: Brain, labelKey: 'tab_maintenance_rules', descKey: 'mr_subtitle' },
  { id: 'simulator',  icon: Activity,     labelKey: 'tab_simulator',    descKey: 'sim_subtitle' },
  { id: 'audit',     icon: ClipboardList, labelKey: 'tab_audit',       descKey: 'audit_log' },
];

interface Props {
  onBackToDashboard: () => void;
  initialTab?: AdminTab;
  theme: Theme;
  onThemeToggle?: () => void;
  onSystemManagement: () => void;
  onAdminConsole: () => void;
  onNavigateDashboard?: () => void;
  onNavigateIpad?: () => void;
  onSignOut?: () => void;
}

export function AdminConsole({ onBackToDashboard, initialTab, theme, onThemeToggle, onSystemManagement, onAdminConsole, onNavigateDashboard, onNavigateIpad, onSignOut }: Props) {
  const { user, role, signOut } = useAuth();
  const t = useT();
  const { lang, setLang } = useLang();
  const [tab, setTab] = useState<AdminTab>(initialTab ?? 'sites');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  if (!isGlobalAdmin(role)) return null;

  async function handleSignOut() {
    await signOut();
  }

  return (
    <div
      className="relative flex h-full min-h-[720px] flex-col overflow-hidden rounded-2xl text-white"
      style={{
        background: '#020d25',
        backgroundImage:
          'radial-gradient(ellipse at 20% 0%, rgba(0,163,255,0.18), transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(0,229,196,0.12), transparent 50%), radial-gradient(circle at 50% 50%, rgba(0,199,255,0.08), transparent 60%), linear-gradient(160deg, #020d25 0%, #052b5c 30%, #031535 65%, #020a20 100%)',
      }}
    >
      {/* Grid overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(57,230,196,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(57,230,196,0.08)_1px,transparent_1px)] [background-size:46px_46px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-cyan-400/[0.06] to-transparent" />

      <LightBar />

      <div className="relative flex min-h-0 flex-1 flex-col gap-2 p-3">
        {/* Shared ArtisticBanner — same as all other dashboards */}
        <div className="flex-shrink-0">
          <ArtisticBanner
            onBack={onBackToDashboard}
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
            onSignOut={onSignOut ?? handleSignOut}
            onChangePassword={() => setPasswordModalOpen(true)}
          />
        </div>

        {/* Body */}
        <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-xl border border-cyan-300/10 bg-cyan-300/[0.02]">
          {/* Sidebar */}
          <aside className={`flex-shrink-0 flex flex-col border-r border-gray-700/30 bg-gray-800/40 backdrop-blur-sm transition-all duration-300 ${sidebarOpen ? 'w-56' : 'w-14'}`}>
            {/* Sidebar header */}
            <div className="flex items-center gap-2.5 border-b border-gray-700/30 px-3 py-4">
              <button
                type="button"
                onClick={onBackToDashboard}
                title={t('back_to_dashboard')}
                className="rounded-lg border border-gray-600/50 bg-gray-700/40 p-2 text-gray-300 transition-all hover:bg-gray-700/60 flex-shrink-0"
              >
                <ArrowLeft size={15} />
              </button>
              {sidebarOpen && (
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-200 truncate">{t('scenario_admin')}</div>
                  <div className="text-xs text-gray-400 truncate">{lang === 'en' ? 'Management' : '管理'}</div>
                </div>
              )}
            </div>

            {/* Nav */}
            <nav className="flex-1 py-3 space-y-1 px-3 overflow-y-auto">
              {NAV_ITEMS.map(({ id, icon: Icon, labelKey, descKey }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition-all ${tab === id ? 'border-cyan-400/50 bg-cyan-500/10' : 'border-gray-700/30 text-gray-400 hover:border-gray-600/50 hover:bg-gray-700/20'}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="relative flex-shrink-0">
                      <Icon size={14} className={tab === id ? 'text-cyan-400' : 'text-gray-500'} />
                    </div>
                    {sidebarOpen && (
                      <span className={`text-xs font-semibold flex-1 truncate ${tab === id ? 'text-white' : ''}`}>{t(labelKey)}</span>
                    )}
                  </div>
                  {sidebarOpen && (
                    <div className="ml-[22px] mt-0.5 text-[10px] text-gray-500 truncate">{t(descKey)}</div>
                  )}
                </button>
              ))}
            </nav>

            {/* Bottom controls */}
            <div className="px-3 pb-3 border-t border-gray-700/30 pt-2 flex-shrink-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-gray-600 hover:text-white hover:bg-gray-700/20 transition-all"
              >
                {sidebarOpen ? <X size={14} /> : <Menu size={14} />}
                {sidebarOpen && <span className="text-xs">{lang === 'en' ? 'Collapse' : '收起'}</span>}
              </button>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-auto p-5 min-h-0">
            {tab === 'users' && (
              <UsersPage />
            )}
            {tab === 'sites'     && <SitesPage />}
            {tab === 'equipment' && <EquipmentPage />}
            {tab === 'audit'     && <AuditLogPage />}
            {tab === 'fsd_codes' && <FSDCodesPage />}
            {tab === 'maintenance_rules' && <MaintenanceRulesPage />}
            {tab === 'simulator' && <SimulatorPage />}
          </main>
        </div>

        <div className="flex-shrink-0">
          <ContactFooter />
        </div>
      </div>

      {passwordModalOpen && (
        <ChangePasswordModal onClose={() => setPasswordModalOpen(false)} />
      )}
    </div>
  );
}
