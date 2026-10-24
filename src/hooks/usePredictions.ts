import { apiData, notifyApiDataChanged, spatialFromIds } from '../lib/apiData';
import { api } from '../lib/api';
import { useApiQuery } from './useApiQuery';
import type { MaintenancePrediction, MaintenanceStatus } from '../types';
export function usePredictions(buildingId?: string) {
  const query = useApiQuery('predictions:' + (buildingId ?? '*'), async () => {
    const rows = await apiData.predictions();
    if (!buildingId) return rows;
    const building = (await apiData.buildings()).find(row => row.id === buildingId);
    if (!building) return [];
    const scope = spatialFromIds(null, null, buildingId);
    return rows.filter(row => row.project_code === scope.project_code && row.building_name === scope.building_name
      && row.site_name === building.sites?.name);
  }, [] as MaintenancePrediction[]);
  async function updateStatus(id: string, status: MaintenanceStatus) {
    await api.updatePredictionStatus(id, status);
    notifyApiDataChanged();
  }
  async function generate() {
    const result = await api.generatePredictions();
    notifyApiDataChanged();
    return result;
  }
  return { predictions: query.data, loading: query.loading, error: query.error, refetch: query.refetch,
    updateStatus, startWork: (id: string) => updateStatus(id, 'in_progress'), generate };
}
