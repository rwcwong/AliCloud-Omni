import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiCompat';
import { MaintenanceRule } from '../../types';

export function useMaintenanceRules() {
  const [rules, setRules] = useState<MaintenanceRule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await apiClient
      .from('admin_maintenance_rules')
      .select('*')
      .order('created_at', { ascending: true });
    setRules((data as MaintenanceRule[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createRule(input: Omit<MaintenanceRule, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await apiClient
      .from('admin_maintenance_rules')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    await load();
    return data as MaintenanceRule;
  }

  async function updateRule(id: string, input: Partial<Omit<MaintenanceRule, 'id' | 'created_at' | 'updated_at'>>) {
    const { data, error } = await apiClient
      .from('admin_maintenance_rules')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await load();
    return data as MaintenanceRule;
  }

  async function deleteRule(id: string) {
    const { error } = await apiClient
      .from('admin_maintenance_rules')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await load();
  }

  async function toggleActive(id: string, is_active: boolean) {
    await updateRule(id, { is_active });
  }

  return { rules, loading, load, createRule, updateRule, deleteRule, toggleActive };
}
