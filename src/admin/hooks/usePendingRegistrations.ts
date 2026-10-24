import { useCallback, useEffect, useState } from 'react';
import { PendingRegistration, UserRole } from '../../types';

/** API v3.0 has no self-registration or pending-registration workflow. */
export function usePendingRegistrations(_actorId?: string, _actorEmail?: string) {
  const [pendingList, setPendingList] = useState<PendingRegistration[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setPendingList([]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function approveRegistration(_id: string, _siteId: string, _role: UserRole) {
    return { error: 'API v3.0 does not provide a registration-approval endpoint.' };
  }

  async function rejectRegistration(_id: string, _notes?: string) {
    return { error: 'API v3.0 does not provide a registration-rejection endpoint.' };
  }

  return {
    pendingList,
    pendingCount: pendingList.length,
    loading,
    approveRegistration,
    rejectRegistration,
    reload: load,
  };
}
