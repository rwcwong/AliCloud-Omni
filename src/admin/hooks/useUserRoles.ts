import { useCallback, useEffect, useState } from 'react';
import { unsupportedApiError } from '../../lib/api';
import { Site, UserSiteRole, UserRole } from '../../types';

export interface UserSiteRoleWithSite extends UserSiteRole {
  sites: Site;
  email?: string;
}

/** The API exposes account roles but has no per-site role-assignment CRUD endpoints. */
export function useUserRoles() {
  const [roles, setRoles] = useState<UserSiteRoleWithSite[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setRoles([]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function addRole(_userId: string, _siteId: string, _role: UserRole) {
    return { error: unsupportedApiError('role assignment') };
  }

  async function updateRole(_id: string, _role: UserRole) {
    return { error: unsupportedApiError('role update') };
  }

  async function removeRole(_id: string) {
    return { error: unsupportedApiError('role removal') };
  }

  return { roles, loading, reload: load, addRole, updateRole, removeRole };
}
