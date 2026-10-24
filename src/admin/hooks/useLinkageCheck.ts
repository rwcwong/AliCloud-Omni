import { apiClient } from '../../lib/apiCompat';

export async function checkProjectLinkage(projectId: string): Promise<{ linked: boolean; childNames: string[] }> {
  const { data } = await apiClient
    .from('admin_sites')
    .select('name')
    .eq('project_id', projectId)
    .order('name');
  const names = (data ?? []).map(r => r.name);
  return { linked: names.length > 0, childNames: names };
}

export async function checkSiteLinkage(siteId: string): Promise<{ linked: boolean; childNames: string[] }> {
  const { data } = await apiClient
    .from('admin_buildings')
    .select('name')
    .eq('site_id', siteId)
    .order('name');
  const names = (data ?? []).map(r => r.name);
  return { linked: names.length > 0, childNames: names };
}

export async function checkBuildingLinkage(buildingId: string): Promise<{ linked: boolean; childNames: string[] }> {
  const { data } = await apiClient
    .from('admin_floors')
    .select('floor_label')
    .eq('building_id', buildingId)
    .order('floor_number');
  const names = (data ?? []).map(r => r.floor_label);
  return { linked: names.length > 0, childNames: names };
}
