import { apiData, notifyApiDataChanged } from '../lib/apiData';
import { api, ApiRequestError } from '../lib/api';
import { useApiQuery } from './useApiQuery';
import type { AlarmEvent, AlarmStatus } from '../types';
export function useAlarms(statusFilter?: AlarmStatus[]) {
  const query = useApiQuery('alarms:' + (statusFilter?.join(',') ?? 'all'), async () => {
    const rows = await apiData.alarms();
    return rows.filter(row => !statusFilter?.length || statusFilter.includes(row.status))
      .sort((a, b) => Date.parse(b.triggered_at) - Date.parse(a.triggered_at));
  }, [] as AlarmEvent[]);
  async function acknowledge(id: string, _userId?: string, _userName?: string) {
    await api.actOnAlarm(id, { action: 'acknowledge' });
    notifyApiDataChanged();
  }
  async function dispatch(id: string, assignee: string, _dispatcherName?: string, _dispatcherContact?: string) {
    if (!assignee.trim()) throw new ApiRequestError('A dispatch assignee is required.', 422);
    await api.actOnAlarm(id, { action: 'dispatch', dispatched_to: assignee });
    notifyApiDataChanged();
  }
  async function resolve(_id: string, _userId?: string, _userName?: string) {
    throw new ApiRequestError('API v3.0 does not provide an alarm-resolution action.', 501);
  }
  async function falseAlarm(_id: string, _userId?: string, _userName?: string): Promise<string | undefined> {
    throw new ApiRequestError('API v3.0 does not provide a false-alarm action.', 501);
  }
  return { alarms: query.data, loading: query.loading, error: query.error, refetch: query.refetch, acknowledge, dispatch, resolve, falseAlarm };
}
