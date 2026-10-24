import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiCompat';
import { Site } from '../../types';

export interface SiteWithProject extends Omit<Site, 'projects'> {
  projects?: { id: string; name: string; name_zh: string };
  building_count?: number;
}

export function useSites() {
  const [sites, setSites] = useState<SiteWithProject[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await apiClient
      .from('admin_sites')
      .select('*, projects(id, name, name_zh), buildings(count)')
      .order('created_at', { ascending: true });
    const rows = ((data as (Site & { projects?: { id: string; name: string; name_zh: string }; buildings?: { count?: number }[] })[]) ?? []).map(s => ({
      ...s,
      building_count: s.building_count ?? s.buildings?.[0]?.count ?? 0,
    }));
    setSites(rows);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createSite(payload: Partial<Site>) {
    const { data, error } = await apiClient.from('admin_sites').insert(payload).select().maybeSingle();
    if (!error) await load();
    return { data: data as Site | null, error };
  }

  async function updateSite(id: string, payload: Partial<Omit<Site, 'id' | 'created_at'>>) {
    const { error } = await apiClient.from('admin_sites').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id);
    if (!error) await load();
    return { error };
  }

  async function deleteSite(id: string) {
    const { error } = await apiClient.from('admin_sites').delete().eq('id', id);
    if (!error) await load();
    return { error };
  }

  return { sites, loading, reload: load, createSite, updateSite, deleteSite };
}
