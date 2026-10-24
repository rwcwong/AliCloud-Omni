import { apiData, spatialFromIds } from '../lib/apiData';
import { useApiQuery } from './useApiQuery';
import type { DeviceStatusDistribution } from '../api/types';
export function useDistribution(projectCode?: string | string[], siteKey?: string) {
  const projectKey = Array.isArray(projectCode)
    ? [...projectCode].sort().join('|')
    : projectCode ?? 'all';
  const query = useApiQuery('dashboard:' + projectKey + ':' + siteKey, async () => {
    if (Array.isArray(projectCode)) {
      const projectCodes = [...new Set(projectCode)];
      if (projectCodes.length === 0) return null;
      const distributions = await Promise.all(projectCodes.map(async code =>
        (await apiData.projectSites(code)).device_status_distribution
      ));
      const totals = distributions.reduce((sum, current) => ({
        total: sum.total + current.total,
        online: sum.online + current.online,
        alarm: sum.alarm + current.alarm,
        fault: sum.fault + current.fault,
        offline: sum.offline + current.offline,
      }), { total: 0, online: 0, alarm: 0, fault: 0, offline: 0 });
      if (distributions.every(current => typeof current.normal === 'number')) {
        return { ...totals, normal: distributions.reduce((sum, current) => sum + (current.normal ?? 0), 0) };
      }
      return totals;
    }
    const scope = spatialFromIds(projectCode, siteKey);
    const result = scope.project_code && scope.site_code
      ? await apiData.siteBuildings(scope.project_code, scope.site_code)
      : scope.project_code ? await apiData.projectSites(scope.project_code) : await apiData.summary();
    return result.device_status_distribution;
  }, null as DeviceStatusDistribution | null);
  return query.data;
}
