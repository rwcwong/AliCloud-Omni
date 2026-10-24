import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiCompat';
import { Project } from '../../types';

export interface ProjectWithCount extends Project {
  site_count?: number;
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await apiClient
      .from('admin_projects')
      .select('*, sites(count)')
      .order('name', { ascending: true });
    const rows = ((data as (Project & { sites?: { count?: number }[] })[]) ?? []).map(p => ({
      ...p,
      id: p.id,
      name: p.name,
      name_zh: p.name_zh,
      description: p.description,
      created_at: p.created_at,
      updated_at: p.updated_at,
      site_count: p.site_count ?? p.sites?.[0]?.count ?? 0,
    }));
    setProjects(rows);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createProject(payload: Omit<Project, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await apiClient.from('admin_projects').insert(payload).select().maybeSingle();
    if (!error) await load();
    return { data: data as Project | null, error };
  }

  async function updateProject(id: string, payload: Partial<Omit<Project, 'id' | 'created_at'>>) {
    const { error } = await apiClient.from('admin_projects').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id);
    if (!error) await load();
    return { error };
  }

  async function deleteProject(id: string) {
    const { error } = await apiClient.from('admin_projects').delete().eq('id', id);
    if (!error) await load();
    return { error };
  }

  return { projects, loading, reload: load, createProject, updateProject, deleteProject };
}
