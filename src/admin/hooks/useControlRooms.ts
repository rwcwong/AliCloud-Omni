import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiCompat';
import { ControlRoom, Building, Site, Project, Floor } from '../../types';

export interface ControlRoomWithRelations extends Omit<ControlRoom, 'buildings'> {
  buildings?: Pick<Building, 'id' | 'name' | 'name_zh' | 'site_id'> & {
    sites?: Pick<Site, 'id' | 'name' | 'name_zh' | 'project_id'> & {
      projects?: Pick<Project, 'id' | 'name' | 'name_zh'>;
    };
  };
  floors?: Pick<Floor, 'id' | 'floor_label' | 'floor_number'>;
}

export function useControlRooms(buildingId?: string) {
  const [controlRooms, setControlRooms] = useState<ControlRoomWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = apiClient
      .from('control_rooms')
      .select('*, buildings(id, name, name_zh, site_id, sites(id, name, name_zh, project_id, projects(id, name, name_zh))), floors(id, floor_label, floor_number)')
      .order('name', { ascending: true });
    if (buildingId) q = q.eq('building_id', buildingId);
    const { data } = await q;
    setControlRooms((data as ControlRoomWithRelations[]) ?? []);
    setLoading(false);
  }, [buildingId]);

  useEffect(() => { load(); }, [load]);

  async function createControlRoom(payload: Partial<ControlRoom>) {
    const { data, error } = await apiClient.from('control_rooms').insert(payload).select().maybeSingle();
    if (!error) await load();
    return { data: data as ControlRoom | null, error };
  }

  async function updateControlRoom(id: string, payload: Partial<Omit<ControlRoom, 'id'>>) {
    const { error } = await apiClient.from('control_rooms').update(payload).eq('id', id);
    if (!error) await load();
    return { error };
  }

  async function deleteControlRoom(id: string) {
    const { error } = await apiClient.from('control_rooms').delete().eq('id', id);
    if (!error) await load();
    return { error };
  }

  return { controlRooms, loading, reload: load, createControlRoom, updateControlRoom, deleteControlRoom };
}
