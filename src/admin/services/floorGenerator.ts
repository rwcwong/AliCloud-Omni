import { api } from '../../lib/api';
import { notifyApiDataChanged } from '../../lib/apiData';

/** Explicit GLOBAL operation; never called while saving one building, and never deletes floors. */
export async function backfillMissingFloors(): Promise<{ backfilled: number; errors: string[] }> {
  try {
    const result = await api.admin.generateMissingFloors();
    notifyApiDataChanged();
    return { backfilled: result.created_floors, errors: [] };
  } catch (failure) {
    return { backfilled: 0, errors: [failure instanceof Error ? failure.message : String(failure)] };
  }
}
