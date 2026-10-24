import { apiData } from '../lib/apiData';
import { useApiQuery } from './useApiQuery';
import type { Floor } from '../types';
export function useFloors(buildingId?: string) {
  const query = useApiQuery('floors:' + (buildingId ?? '*'), async () => (await apiData.floors())
    .filter(floor => !buildingId || floor.building_id === buildingId)
    .sort((a, b) => Number.isFinite(a.floor_number) && Number.isFinite(b.floor_number) ? a.floor_number - b.floor_number : 0), [] as Floor[]);
  return { floors: query.data, loading: query.loading, error: query.error, reload: query.refetch };
}
