import { useState, useEffect, lazy, Suspense } from 'react';
import { LangProvider } from './lib/i18n';
import { TransportProvider } from './transport/TransportContext';
import { AuthProvider, useAuth, isGlobalAdmin } from './lib/auth';
import { ScenarioSwitcher } from './scenarios/ScenarioSwitcher';
import { LoginPage } from './scenarios/LoginPage';
import { Scenario, Theme } from './types';
import { useSiteSelector } from './hooks/useSiteSelector';
import { apiClient } from './lib/apiCompat';
import { ScreenshotToast } from './components/ScreenshotToast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ApiNotice } from './components/ApiNotice';

const WallScreen = lazy(() => import('./scenarios/WallScreen').then(m => ({ default: m.WallScreen })));
const MobileView = lazy(() => import('./scenarios/MobileView').then(m => ({ default: m.MobileView })));
const AdminConsole = lazy(() => import('./scenarios/AdminConsole').then(m => ({ default: m.AdminConsole })));
const OmniOSHome = lazy(() => import('./scenarios/OmniOSHome').then(m => ({ default: m.OmniOSHome })));
const OmniHomeipad = lazy(() => import('./scenarios/OmniHomeipad').then(m => ({ default: m.OmniHomeipad })));
const OverviewDashboard3D = lazy(() => import('./scenarios/OverviewDashboard3D').then(m => ({ default: m.OverviewDashboard3D })));
const BuildingDashboard = lazy(() => import('./scenarios/BuildingDashboard').then(m => ({ default: m.BuildingDashboard })));
const BlockDashboard = lazy(() => import('./scenarios/BlockDashboard').then(m => ({ default: m.BlockDashboard })));
const SystemManagementPlatform = lazy(() => import('./scenarios/SystemManagementPlatform').then(m => ({ default: m.SystemManagementPlatform })));

const LoadingSpinner = () => (
  <div className="h-screen w-screen bg-gray-950 flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-red-500/40 border-t-red-500 rounded-full animate-spin" />
  </div>
);

function AppInner() {
  const { session, loading, role, siteRoles, user, signOut } = useAuth();
  const accessibleSiteIds = Object.keys(siteRoles).filter(sid => siteRoles[sid] && siteRoles[sid] !== 'no_access');
  const { sites } = useSiteSelector(user?.id, isGlobalAdmin(role) ? undefined : accessibleSiteIds);
  const [scenario, setScenario] = useState<Scenario>('overview_3d');
  const [theme, setTheme] = useState<Theme>('dark');
  const canToggleTheme = role === 'system_admin';
  const [adminInitialTab, setAdminInitialTab] = useState<'users' | 'sites' | 'equipment' | 'audit' | 'fsd_codes'>('sites');
  const [smpInitialTab, setSmpInitialTab] = useState<'monitoring' | 'alarms' | 'maintenance' | 'analytics' | 'compliance' | 'equipment'>('monitoring');
  const [alarmFilterSiteId, setAlarmFilterSiteId] = useState<string | undefined>(undefined);
  const [alarmFilterBuildingId, setAlarmFilterBuildingId] = useState<string | undefined>(undefined);
  const [alarmFilterFloorId, setAlarmFilterFloorId] = useState<string | undefined>(undefined);
  const [alarmFilterStatus, setAlarmFilterStatus] = useState<string | undefined>(undefined);
  const [alarmFilterCategory, setAlarmFilterCategory] = useState<string | undefined>(undefined);
  const [maintenanceFilterStatus, setMaintenanceFilterStatus] = useState<string | undefined>(undefined);
  const [previousScenario, setPreviousScenario] = useState<Scenario | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [landingApplied, setLandingApplied] = useState(false);
  const [loginPlatform, setLoginPlatform] = useState<'pc' | 'ipad'>('pc');

  function navigateToAdminConsole() {
    if (!isGlobalAdmin(role)) return;
    setAdminInitialTab('sites');
    setScenario('admin');
  }

  function navigateToAlarms(status?: string, siteId?: string, buildingId?: string, floorId?: string, category?: string) {
    setPreviousScenario(scenario);
    setAlarmFilterStatus(status);
    setAlarmFilterSiteId(siteId);
    setAlarmFilterBuildingId(buildingId);
    setAlarmFilterFloorId(floorId);
    setAlarmFilterCategory(category);
    setSmpInitialTab('alarms');
    setScenario('system_management');
  }

  function navigateToMaintenance(status?: string) {
    setPreviousScenario(scenario);
    setMaintenanceFilterStatus(status);
    setSmpInitialTab('maintenance');
    setScenario('system_management');
  }

  useEffect(() => {
    if (scenario === 'admin' && !isGlobalAdmin(role)) setScenario('overview_3d');
  }, [role, scenario]);

  function navigateToProjectBuilding() {
    if (isGlobalAdmin(role)) {
      setScenario('overview_3d');
      return;
    }
    let projectSite: typeof sites[number] | undefined;
    if (accessibleSiteIds.length > 0) {
      projectSite = sites.find(s => accessibleSiteIds.includes(s.id));
    } else {
      projectSite = selectedProjectId
        ? sites.find(s => s.project_id === selectedProjectId)
        : sites[0];
    }
    if (projectSite) {
      setSelectedProjectId(projectSite.project_id ?? null);
      setScenario('omni');
    } else {
      setScenario('overview_3d');
    }
  }

  // Reset landing state when user signs out so the next login re-evaluates
  useEffect(() => {
    if (!session) {
      setLandingApplied(false);
      setLoginPlatform('pc');
      setSelectedSiteId('');
      setSelectedBuildingId('');
      setSelectedProjectId(null);
      setAlarmFilterSiteId(undefined);
      setAlarmFilterBuildingId(undefined);
      setAlarmFilterFloorId(undefined);
      setAlarmFilterStatus(undefined);
      setAlarmFilterCategory(undefined);
      setMaintenanceFilterStatus(undefined);
      setPreviousScenario(null);
      setScenario('overview_3d');
    }
  }, [session]);

  // Role-based landing page: set initial scenario when user session and role are first available
  useEffect(() => {
    if (!session || !role || landingApplied) return;

    if (isGlobalAdmin(role)) {
      setScenario(loginPlatform === 'ipad' ? 'omni_ipad' : 'overview_3d');
      setLandingApplied(true);
    } else if (role === 'executive') {
      if (accessibleSiteIds.length === 0) return;
      const firstSite = sites.find(s => accessibleSiteIds.includes(s.id));
      const projectId = firstSite?.project_id ?? null;
      setSelectedProjectId(projectId);
      setScenario(loginPlatform === 'ipad' ? 'omni_ipad' : 'omni');
      setLandingApplied(true);
    } else if (role === 'guard') {
      if (accessibleSiteIds.length === 0) return;
      const firstSite = sites.find(s => accessibleSiteIds.includes(s.id));
      if (!firstSite) return;
      apiClient
        .from('buildings')
        .select('id')
        .eq('site_id', firstSite.id)
        .order('name', { ascending: true })
        .limit(1)
        .single()
        .then(({ data: firstBuilding }) => {
          setSelectedSiteId(firstSite.id);
          if (firstBuilding) setSelectedBuildingId(firstBuilding.id);
          setScenario(loginPlatform === 'ipad' ? 'omni_ipad' : 'block_dashboard');
          setLandingApplied(true);
        });
    } else {
      if (accessibleSiteIds.length === 0) return;
      const firstSite = sites.find(s => accessibleSiteIds.includes(s.id));
      if (firstSite) {
        setSelectedSiteId(firstSite.id);
        setScenario(loginPlatform === 'ipad' ? 'omni_ipad' : 'building_dashboard');
      } else {
        setScenario('overview_3d');
      }
      setLandingApplied(true);
    }
  }, [session, role, siteRoles, sites, landingApplied, accessibleSiteIds.length, loginPlatform]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-red-500/40 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <LoginPage onLoginPlatform={(p) => setLoginPlatform(p)} />;
  }

  return (
    <TransportProvider>
      <div className={`h-screen w-screen overflow-hidden ${theme === 'light' ? 'light' : ''}`}>
        <Suspense fallback={<LoadingSpinner />}>
        {scenario === 'omni' && (
          <OmniOSHome
            projectId={selectedProjectId}
            onSystemManagement={() => { navigateToAlarms('active'); }}
            onAdminConsole={navigateToAdminConsole}
            theme={theme}
            onThemeToggle={canToggleTheme ? () => setTheme(t => t === 'dark' ? 'light' : 'dark') : undefined}
            onNavigateDashboard={navigateToProjectBuilding}
            onNavigateDevices={() => { navigateToAlarms('active'); }}
            onNavigateAlarms={(status, _siteId, _buildingId, _floorId, category) => navigateToAlarms(status, undefined, undefined, undefined, category)}
            onOpenSite={(sid) => { setSelectedSiteId(sid); setScenario('building_dashboard'); }}
            onSignOut={() => { void signOut(); }}
          />
        )}
        {scenario === 'omni_ipad' && (
          <OmniHomeipad
            onSystemManagement={() => { navigateToAlarms('active'); }}
            onAdminConsole={navigateToAdminConsole}
            theme={theme}
            onNavigateDashboard={navigateToProjectBuilding}
            onOpenSite={(sid) => { setSelectedSiteId(sid); setScenario('building_dashboard'); }}
            onSignOut={() => { void signOut(); }}
          />
        )}
        {scenario === 'block_dashboard' && selectedSiteId && selectedBuildingId && (
          <BlockDashboard
            siteId={selectedSiteId}
            buildingId={selectedBuildingId}
            initialFloorId={selectedFloorId}
            onBack={() => setScenario('building_dashboard')}
            onSystemManagement={() => { navigateToAlarms('active'); }}
            onAdminConsole={navigateToAdminConsole}
            onNavigateDashboard={navigateToProjectBuilding}
            onNavigateAlarms={(status, siteId, buildingId, floorId) => navigateToAlarms(status, siteId, buildingId, floorId)}
            onNavigateMaintenance={() => { navigateToMaintenance(); }}
            onNavigateDevices={() => { navigateToAlarms('active'); }}
            onChangeBuilding={(bid) => setSelectedBuildingId(bid)}
            theme={theme}
            onThemeToggle={canToggleTheme ? () => setTheme(t => t === 'dark' ? 'light' : 'dark') : undefined}
            onSignOut={() => { void signOut(); }}
          />
        )}
        {scenario === 'system_management' && (
          <SystemManagementPlatform
            buildingId={selectedBuildingId || undefined}
            onBack={() => setScenario(previousScenario ?? 'overview_3d')}
            initialTab={smpInitialTab}
            onSystemManagement={() => { navigateToAlarms('active'); }}
            onAdminConsole={navigateToAdminConsole}
            onNavigateDashboard={navigateToProjectBuilding}
            onNavigateIpad={() => setScenario('omni_ipad')}
            onNavigateAlarms={(status) => navigateToAlarms(status)}
            onNavigateMaintenance={() => { navigateToMaintenance(); }}
            onNavigateDevices={() => { navigateToAlarms('active'); }}
            theme={theme}
            onThemeToggle={canToggleTheme ? () => setTheme(t => t === 'dark' ? 'light' : 'dark') : undefined}
            onSignOut={() => { void signOut(); }}
            alarmFilterSiteId={alarmFilterSiteId}
            alarmFilterBuildingId={alarmFilterBuildingId}
            alarmFilterFloorId={alarmFilterFloorId}
            alarmFilterStatus={alarmFilterStatus}
            alarmFilterCategory={alarmFilterCategory}
            maintenanceFilterStatus={maintenanceFilterStatus}
          />
        )}
        {scenario === 'overview_3d' && (
          <OverviewDashboard3D
            onNavigate={() => {}}
            onSystemManagement={() => { navigateToAlarms('active'); }}
            onAdminConsole={navigateToAdminConsole}
            onNavigateAlarms={(status) => navigateToAlarms(status)}
            onNavigateMaintenance={(status) => navigateToMaintenance(status)}
            onNavigateAdminEquipment={() => { setPreviousScenario(scenario); setSmpInitialTab('equipment'); setScenario('system_management'); }}
            onNavigateIpad={() => setScenario('omni_ipad')}
            onOpenProject={(pid) => {
              setSelectedProjectId(pid);
              setScenario('omni');
            }}
            theme={theme}
            onThemeToggle={canToggleTheme ? () => setTheme(t => t === 'dark' ? 'light' : 'dark') : undefined}
            onSignOut={() => { void signOut(); }}
          />
        )}
        {scenario === 'building_dashboard' && selectedSiteId && (
          <BuildingDashboard
            siteId={selectedSiteId}
            onBack={() => {
              if (isGlobalAdmin(role)) {
                const currentSite = sites.find(s => s.id === selectedSiteId);
                setSelectedProjectId(currentSite?.project_id ?? null);
                setScenario('omni');
              } else {
                navigateToProjectBuilding();
              }
            }}
            onSystemManagement={() => { navigateToAlarms('active'); }}
            onAdminConsole={navigateToAdminConsole}
            onNavigateDashboard={navigateToProjectBuilding}
            onNavigateIpad={() => setScenario('omni_ipad')}
            onNavigateAlarms={(status, siteId, buildingId) => navigateToAlarms(status, siteId, buildingId)}
            onNavigateMaintenance={() => { navigateToMaintenance(); }}
            onNavigateDevices={() => { navigateToAlarms('active'); }}
            onOpenBuilding={(bid, floorId) => { setSelectedBuildingId(bid); setSelectedFloorId(floorId ?? null); setScenario('block_dashboard'); }}
            theme={theme}
            onThemeToggle={canToggleTheme ? () => setTheme(t => t === 'dark' ? 'light' : 'dark') : undefined}
            onSignOut={() => { void signOut(); }}
          />
        )}
        {scenario === 'wallscreen' && <WallScreen onExit={() => setScenario('overview_3d')} />}
        {scenario === 'mobile' && (
          <div className="h-full flex items-center justify-center bg-gray-950 p-4">
            <div
              className="w-full max-w-sm h-full max-h-[812px] bg-gray-950 rounded-3xl overflow-hidden shadow-2xl border border-gray-700/50 flex flex-col"
              style={{ boxShadow: '0 0 80px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.05)' }}
            >
              <MobileView />
            </div>
          </div>
        )}
        {scenario === 'admin' && isGlobalAdmin(role) && (
          <AdminConsole
            onBackToDashboard={navigateToProjectBuilding}
            initialTab={adminInitialTab}
            theme={theme}
            onThemeToggle={canToggleTheme ? () => setTheme(t => t === 'dark' ? 'light' : 'dark') : undefined}
            onSystemManagement={() => { navigateToAlarms('active'); }}
            onAdminConsole={navigateToAdminConsole}
            onNavigateDashboard={navigateToProjectBuilding}
            onNavigateIpad={() => setScenario('omni_ipad')}
            onSignOut={() => { void signOut(); }}
          />
        )}
        </Suspense>
        <ScenarioSwitcher
          current={scenario as unknown}
          onChange={(s: unknown) => setScenario(s as Scenario)}
          theme={theme}
          onThemeToggle={canToggleTheme && scenario !== 'omni' && scenario !== 'omni_ipad' && scenario !== 'overview_3d' && scenario !== 'building_dashboard' && scenario !== 'block_dashboard' && scenario !== 'system_management' ? () => setTheme(t => t === 'dark' ? 'light' : 'dark') : undefined}
        />
        <ScreenshotToast />
      </div>
    </TransportProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LangProvider>
        <AuthProvider>
          <ApiNotice />
          <AppInner />
        </AuthProvider>
      </LangProvider>
    </ErrorBoundary>
  );
}
