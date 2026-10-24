import { apiData } from '../lib/apiData';
import { useApiQuery } from './useApiQuery';
import type { FloorPlanImage } from '../types';
export function useFloorPlanImages(buildingId?: string, floorId?: string) {
  const query = useApiQuery('floor-plans:' + buildingId + ':' + floorId,
    () => apiData.floorPlanImages(buildingId, floorId), [] as FloorPlanImage[]);
  return { images: query.data, loading: query.loading, error: query.error };
}
