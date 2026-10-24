import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiCompat';
import { Building } from '../../types';

export interface BuildingWithRelations extends Building {
  floor_count?: number;
}

export function useBuildings(siteId?: string) {
  const [buildings, setBuildings] = useState<BuildingWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = apiClient
      .from('admin_buildings')
      .select('*, sites(id, name, name_zh, project_id, projects(id, name, name_zh)), floors(count)')
      .order('name', { ascending: true });
    if (siteId) q = q.eq('site_id', siteId);
    const [{ data }, { data: floors }] = await Promise.all([q, apiClient.from('admin_floors').select('*')]);
    const rows = ((data as Building[]) ?? []).map(b => ({
      ...b,
      floor_count: floors?.filter(floor => floor.building_id === b.id).length,
    }));
    setBuildings(rows);
    setLoading(false);
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  async function createBuilding(payload: Partial<Building>) {
    const { data, error } = await apiClient.from('admin_buildings').insert(payload).select().maybeSingle();
    if (error || !data) {
      if (!error) await load();
      return { data: data as Building | null, error };
    }
    await load();
    return { data: data as Building | null, error: null };
  }

  async function updateBuilding(id: string, payload: Partial<Omit<Building, 'id'>>) {
    const { error } = await apiClient.from('admin_buildings').update(payload).eq('id', id);
    if (error) return { error };
    await load();
    return { error: null };
  }

  async function deleteBuilding(id: string) {
    const { error } = await apiClient.from('admin_buildings').delete().eq('id', id);
    if (!error) await load();
    return { error };
  }

  return { buildings, loading, reload: load, createBuilding, updateBuilding, deleteBuilding };
}
