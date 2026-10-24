import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiCompat';
import { Role } from '../../types';

export function useRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await apiClient
      .from('roles')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    setRoles((data as Role[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { roles, loading, reload: load };
}
