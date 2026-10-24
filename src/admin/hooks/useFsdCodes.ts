import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiCompat';

export interface FsdCode {
  id: string;
  code: string;
  description_en: string;
  description_zh: string;
  frequency: 'monthly' | 'quarterly' | '6-monthly' | 'annual';
  device_category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useFsdCodes() {
  const [codes, setCodes] = useState<FsdCode[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await apiClient
      .from('admin_fsd_codes')
      .select('*')
      .order('code', { ascending: true });
    setCodes((data as FsdCode[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createCode(input: Omit<FsdCode, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await apiClient
      .from('admin_fsd_codes')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    await load();
    return data as FsdCode;
  }

  async function updateCode(id: string, input: Partial<Omit<FsdCode, 'id' | 'created_at' | 'updated_at'>>) {
    const { data, error } = await apiClient
      .from('admin_fsd_codes')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await load();
    return data as FsdCode;
  }

  async function deleteCode(id: string) {
    const { error } = await apiClient
      .from('admin_fsd_codes')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await load();
  }

  return { codes, loading, load, createCode, updateCode, deleteCode };
}
