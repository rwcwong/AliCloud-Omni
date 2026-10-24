import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiCompat';
import { Floor } from '../../types';

export function useFloorsAdmin(buildingId?: string) {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = apiClient.from('admin_floors').select('*').order('floor_number', { ascending: true });
    if (buildingId) q = q.eq('building_id', buildingId);
    const { data } = await q;
    setFloors((data as Floor[]) ?? []);
    setLoading(false);
  }, [buildingId]);

  useEffect(() => {
    void load();
    const refresh = () => { void load(); };
    window.addEventListener('omnios:data-changed', refresh);
    return () => window.removeEventListener('omnios:data-changed', refresh);
  }, [load]);

  async function createFloor(payload: Omit<Floor, 'id'>) {
    const { data, error } = await apiClient.from('admin_floors').insert(payload).select().maybeSingle();
    if (!error) await load();
    return { data: data as Floor | null, error };
  }

  async function updateFloor(id: string, payload: Partial<Omit<Floor, 'id'>>) {
    const { error } = await apiClient.from('admin_floors').update(payload).eq('id', id);
    if (!error) await load();
    return { error };
  }

  async function deleteFloor(id: string) {
    const { error } = await apiClient.from('admin_floors').delete().eq('id', id);
    if (!error) await load();
    return { error };
  }

  return { floors, loading, reload: load, createFloor, updateFloor, deleteFloor };
}
