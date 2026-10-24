import { useState, useEffect } from 'react';
import { apiData } from '../lib/apiData';
import { api } from '../lib/api';
import { useApiQuery } from './useApiQuery';
import type { Site, Building } from '../types';
export interface SiteWithBuildings extends Site { buildings: Building[] }

/** Server role scope is authoritative; the client additionally limits officer site navigation. */
export function useSiteSelector(userId?: string, accessibleSiteIds?: string[]) {
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const scope = accessibleSiteIds?.join('|') ?? '*';
  const query = useApiQuery('hierarchy:' + userId + ':' + scope, async () => {
    if (!api.getSession()) return [];
    const [rows, buildings] = await Promise.all([apiData.sites(), apiData.buildings()]);
    return rows.filter(site => accessibleSiteIds === undefined || accessibleSiteIds.includes(site.id))
      .map(site => ({ ...site, buildings: buildings.filter(building => building.site_id === site.id) }));
  }, [] as SiteWithBuildings[]);
  const sites = query.data;
  useEffect(() => {
    const next = sites.find(site => site.id === selectedSiteId) ?? sites[0];
    if (!next) { setSelectedSiteId(''); setSelectedBuildingId(''); return; }
    if (next.id !== selectedSiteId) setSelectedSiteId(next.id);
    if (!next.buildings.some(building => building.id === selectedBuildingId)) setSelectedBuildingId(next.buildings[0]?.id ?? '');
  }, [sites, selectedSiteId, selectedBuildingId]);
  function selectSite(id: string) {
    setSelectedSiteId(id);
    setSelectedBuildingId(sites.find(site => site.id === id)?.buildings[0]?.id ?? '');
  }
  return {
    sites, loading: query.loading, error: query.error,
    selectedSite: sites.find(site => site.id === selectedSiteId) ?? null,
    selectedBuilding: sites.find(site => site.id === selectedSiteId)?.buildings.find(building => building.id === selectedBuildingId) ?? null,
    selectedBuildingId, selectSite, selectBuilding: setSelectedBuildingId,
  };
}
