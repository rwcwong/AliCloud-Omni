import { useState, useMemo, useEffect } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Filter } from 'lucide-react';
import { Project, Site, Building, Floor, Device, Site as SiteType } from '../types';
import { useT, useLang } from '../lib/i18n';
import { apiClient } from '../lib/apiCompat';

export type DeviceSortField = 'site' | 'project';

type BuildingWithSite = Building & { sites?: SiteType };

function localName(name: string, nameZh: string | undefined, lang: string): string {
  return lang === 'en' ? name : (nameZh || name);
}

export function getDeviceProjectName(d: Device, lang: string): string {
  const site = (d.floors?.buildings as BuildingWithSite | undefined)?.sites;
  if (!site?.projects) return '';
  return localName(site.projects.name, site.projects.name_zh, lang);
}

export function getDeviceSiteName(d: Device, lang: string): string {
  const site = (d.floors?.buildings as BuildingWithSite | undefined)?.sites;
  if (!site) return '';
  return localName(site.name, site.name_zh, lang);
}

export function getDeviceBuildingName(d: Device, lang: string): string {
  const b = d.floors?.buildings;
  if (!b) return '';
  return localName(b.name, b.name_zh, lang);
}

export function getDeviceSiteId(d: Device): string {
  return d.floors?.buildings?.site_id ?? '';
}

export function getDeviceBuildingId(d: Device): string {
  return d.floors?.buildings?.id ?? '';
}

export function getDeviceFloorId(d: Device): string {
  return d.floors?.id ?? '';
}

export function getDeviceProjectId(d: Device, sites: Site[]): string {
  const siteId = getDeviceSiteId(d);
  const site = sites.find(s => s.id === siteId);
  return site?.project_id ?? '';
}

interface FilterDropdownProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

function FilterDropdown({ label, value, options, onChange }: FilterDropdownProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-gray-500">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-gray-800/60 border border-gray-700/40 rounded-md px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-cyan-400/40 transition-colors"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

export function useDeviceFilters(devices: Device[]) {
  const t = useT();
  const { lang } = useLang();

  const [sortField, setSortField] = useState<DeviceSortField>('project');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [projects, setProjects] = useState<Project[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [filterProject, setFilterProject] = useState('all');
  const [filterSite, setFilterSite] = useState('all');
  const [filterBuilding, setFilterBuilding] = useState('all');
  const [filterBlock, setFilterBlock] = useState('all');

  useEffect(() => {
    apiClient.from('projects').select('*').order('name').then(({ data }) => {
      if (data) setProjects(data as Project[]);
    });
  }, []);
  useEffect(() => {
    apiClient.from('sites').select('*').order('name').then(({ data }) => {
      if (data) setSites(data as Site[]);
    });
  }, []);
  useEffect(() => {
    apiClient.from('buildings').select('*').order('name').then(({ data }) => {
      if (data) setBuildings(data as Building[]);
    });
  }, []);
  useEffect(() => {
    apiClient.from('floors').select('*, buildings(*)').order('floor_number').then(({ data }) => {
      if (data) setFloors(data as Floor[]);
    });
  }, []);

  const projectOptions = useMemo(() => [
    { value: 'all', label: t('all_projects') },
    ...projects.map(p => ({ value: p.id, label: localName(p.name, p.name_zh, lang) })),
  ], [projects, lang, t]);

  const siteOptions = useMemo(() => {
    const filtered = filterProject === 'all' ? sites : sites.filter(s => s.project_id === filterProject);
    return [
      { value: 'all', label: t('all_sites') },
      ...filtered.map(s => ({ value: s.id, label: localName(s.name, s.name_zh, lang) })),
    ];
  }, [sites, filterProject, lang, t]);

  const buildingOptions = useMemo(() => {
    const filtered = filterSite === 'all'
      ? (filterProject === 'all'
        ? buildings
        : buildings.filter(b => {
          const site = sites.find(s => s.id === b.site_id);
          return site?.project_id === filterProject;
        }))
      : buildings.filter(b => b.site_id === filterSite);
    return [
      { value: 'all', label: t('all_buildings') },
      ...filtered.map(b => ({ value: b.id, label: localName(b.name, b.name_zh, lang) })),
    ];
  }, [buildings, sites, filterSite, filterProject, lang, t]);

  const blockOptions = useMemo(() => {
    let filteredFloors: Floor[];
    if (filterBuilding !== 'all') {
      filteredFloors = floors.filter(f => f.building_id === filterBuilding);
    } else if (filterSite !== 'all') {
      const siteBuildingIds = new Set(buildings.filter(b => b.site_id === filterSite).map(b => b.id));
      filteredFloors = floors.filter(f => siteBuildingIds.has(f.building_id));
    } else if (filterProject !== 'all') {
      const siteIds = new Set(sites.filter(s => s.project_id === filterProject).map(s => s.id));
      const siteBuildingIds = new Set(buildings.filter(b => siteIds.has(b.site_id)).map(b => b.id));
      filteredFloors = floors.filter(f => siteBuildingIds.has(f.building_id));
    } else {
      filteredFloors = floors;
    }
    return [
      { value: 'all', label: t('all_blocks') },
      ...filteredFloors.map(f => ({ value: f.id, label: f.floor_label || `F${f.floor_number}` })),
    ];
  }, [floors, filterBuilding, filterSite, filterProject, buildings, sites, t]);

  // Cascading reset
  useEffect(() => {
    if (filterProject !== 'all') {
      const valid = sites.filter(s => s.project_id === filterProject);
      if (filterSite !== 'all' && !valid.some(s => s.id === filterSite)) {
        setFilterSite('all'); setFilterBuilding('all'); setFilterBlock('all');
      }
    }
  }, [filterProject, filterSite, sites]);

  useEffect(() => {
    if (filterSite !== 'all') {
      const valid = buildings.filter(b => b.site_id === filterSite);
      if (filterBuilding !== 'all' && !valid.some(b => b.id === filterBuilding)) {
        setFilterBuilding('all'); setFilterBlock('all');
      }
    }
  }, [filterSite, filterBuilding, buildings]);

  useEffect(() => {
    if (filterBuilding !== 'all') {
      const valid = floors.filter(f => f.building_id === filterBuilding);
      if (filterBlock !== 'all' && !valid.some(f => f.id === filterBlock)) {
        setFilterBlock('all');
      }
    }
  }, [filterBuilding, filterBlock, floors]);

  function toggleSort(field: DeviceSortField) {
    if (sortField === field) {
      setSortDir(p => p === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function handleProjectChange(v: string) {
    setFilterProject(v);
    if (v === 'all') { setFilterSite('all'); setFilterBuilding('all'); setFilterBlock('all'); }
  }
  function handleSiteChange(v: string) {
    setFilterSite(v);
    if (v === 'all') { setFilterBuilding('all'); setFilterBlock('all'); }
  }
  function handleBuildingChange(v: string) {
    setFilterBuilding(v);
    setFilterBlock('all');
  }

  const filteredDevices = useMemo(() => {
    let result = devices;
    if (filterProject !== 'all') {
      result = result.filter(d => getDeviceProjectId(d, sites) === filterProject);
    }
    if (filterSite !== 'all') {
      result = result.filter(d => getDeviceSiteId(d) === filterSite);
    }
    if (filterBuilding !== 'all') {
      result = result.filter(d => getDeviceBuildingId(d) === filterBuilding);
    }
    if (filterBlock !== 'all') {
      result = result.filter(d => getDeviceFloorId(d) === filterBlock);
    }
    const sorted = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'project') {
        cmp = getDeviceProjectName(a, lang).toLowerCase().localeCompare(getDeviceProjectName(b, lang).toLowerCase());
        if (cmp === 0) cmp = getDeviceSiteName(a, lang).toLowerCase().localeCompare(getDeviceSiteName(b, lang).toLowerCase());
      } else {
        cmp = getDeviceSiteName(a, lang).toLowerCase().localeCompare(getDeviceSiteName(b, lang).toLowerCase());
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [devices, filterProject, filterSite, filterBuilding, filterBlock, sortField, sortDir, sites, lang]);

  const sortButtons: { field: DeviceSortField; label: string }[] = [
    { field: 'project', label: t('sort_project') },
    { field: 'site', label: t('sort_site') },
  ];

  const filterBar = (
    <>
      <div className="flex items-center gap-1.5 mb-2 flex-shrink-0">
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500">
          <ArrowUpDown size={11} /> {t('sort_by')}
        </span>
        {sortButtons.map(({ field, label }) => (
          <button
            key={field}
            onClick={() => toggleSort(field)}
            className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors ${sortField === field ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30' : 'text-gray-400 hover:text-gray-300 border border-transparent'}`}
          >
            {label}
            {sortField === field && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-2 mb-3 flex-shrink-0 flex-wrap">
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500 pb-1.5">
          <Filter size={11} />
        </span>
        <FilterDropdown label={t('filter_project')} value={filterProject} options={projectOptions} onChange={handleProjectChange} />
        <FilterDropdown label={t('filter_site')} value={filterSite} options={siteOptions} onChange={handleSiteChange} />
        <FilterDropdown label={t('filter_building')} value={filterBuilding} options={buildingOptions} onChange={handleBuildingChange} />
        <FilterDropdown label={t('filter_block')} value={filterBlock} options={blockOptions} onChange={setFilterBlock} />
      </div>
    </>
  );

  return { filteredDevices, filterBar, lang };
}

export function deviceLocation(d: Device, lang: string): string {
  const parts = [getDeviceProjectName(d, lang), getDeviceSiteName(d, lang), getDeviceBuildingName(d, lang), d.floors?.floor_label].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '-';
}
