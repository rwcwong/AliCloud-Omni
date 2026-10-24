import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiCompat';
import { AuditLog } from '../../types';

export function useAuditLog(limit = 100) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await apiClient
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    setLogs((data as AuditLog[]) ?? []);
    setLoading(false);
  }, [limit]);

  useEffect(() => { load(); }, [load]);

  return { logs, loading, reload: load };
}
