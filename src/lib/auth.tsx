import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, type ApiSession, type ApiUser } from './api';
import { UserRole } from '../types';
import { SiteWithBuildings as SWB } from '../hooks/useSiteSelector';

function appRole(role: 'admin' | 'executive' | 'officer'): UserRole {
  if (role === 'admin') return 'admin';
  if (role === 'executive') return 'executive';
  return 'guard';
}

export function isGlobalAdmin(role: UserRole | null): boolean {
  return role === 'admin' || role === 'system_admin';
}

export type AccessLevel = 'overall' | 'project' | 'site';

export interface UserAccessInfo {
  level: AccessLevel;
  projectId: string | null;
  projectName: string;
  siteId: string | null;
  siteName: string;
  accessibleSiteIds: string[];
  accessibleProjects: { id: string; name: string; name_zh: string }[];
}

interface AuthContextValue {
  session: ApiSession | null;
  user: ApiUser | null;
  role: UserRole | null;
  siteRoles: Record<string, UserRole>;
  loading: boolean;
  getRoleForSite: (siteId: string) => UserRole;
  canAccessSite: (siteId: string) => boolean;
  canAccessProject: (projectId: string, sites: SWB[]) => boolean;
  canSeeOverall: () => boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  registerRequest: (name: string, email: string, password: string, telephone: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  role: null,
  siteRoles: {},
  loading: true,
  getRoleForSite: () => 'no_access',
  canAccessSite: () => false,
  canAccessProject: () => false,
  canSeeOverall: () => false,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  registerRequest: async () => ({ error: null }),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ApiSession | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [siteRoles, setSiteRoles] = useState<Record<string, UserRole>>({});
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  async function applyAccess(nextSession: ApiSession | null) {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    if (!nextSession) {
      setSiteRoles({});
      setRole(null);
      setLoading(false);
      return;
    }

    const info = nextSession.user_info;
    const mappedRole = appRole(info.role);
    const map: Record<string, UserRole> = {};
    if (info.role === 'officer' && info.project_code && info.site_code) {
      map[`${info.project_code}::${info.site_code}`] = mappedRole;
    } else if (info.role === 'executive' && info.project_code) {
      try {
        const response = await api.getProjectSites(info.project_code);
        response.sites.forEach(site => { map[`${info.project_code}::${site.site_code}`] = mappedRole; });
      } catch {
        // RBAC is enforced by the API. If the scope lookup fails, expose no sites.
      }
    }
    if (api.getSession()?.access_token !== nextSession.access_token) return;
    setSiteRoles(map);
    setRole(mappedRole);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = api.auth.onAuthStateChange((_event, nextSession) => {
      if (active) void applyAccess(nextSession);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const isAdmin = role === 'admin' || role === 'system_admin';

  function getRoleForSite(siteId: string): UserRole {
    if (isAdmin) return 'admin';
    return siteRoles[siteId] ?? 'no_access';
  }

  function canAccessSite(siteId: string): boolean {
    if (isAdmin) return true;
    const r = siteRoles[siteId];
    return r !== undefined && r !== 'no_access';
  }

  function canAccessProject(projectId: string, sites: SWB[]): boolean {
    if (isAdmin) return true;
    return sites.some(s => s.project_id === projectId && canAccessSite(s.id));
  }

  function canSeeOverall(): boolean {
    return isAdmin;
  }

  async function signIn(username: string, password: string) {
    const { error } = await api.auth.signInWithPassword({ username, password });
    if (error) return { error: error.message };
    return { error: null };
  }

  async function signOut() {
    await api.auth.signOut();
  }

  async function registerRequest(_name: string, _email: string, _password: string, _telephone: string) {
    return { error: 'API v3.0 does not provide a self-registration endpoint. Please contact an administrator.' };
  }

  return (
    <AuthContext.Provider value={{ session, user, role, siteRoles, loading, getRoleForSite, canAccessSite, canAccessProject, canSeeOverall, signIn, signOut, registerRequest }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
