import { api, ApiRequestError, resolveAssetUrl } from './api';
import type { ApiDevicePoint, ApiDeviceStatus, ApiAlarm, ApiPrediction, AdminDeviceType, ApiFloorDetail } from '../api/types';
import type { Project, Site, Building, Floor, Device, DeviceType, AlarmEvent, MaintenancePrediction, FloorPlanImage, MaintenanceRule } from '../types';

const cache = new Map<string, { until: number; promise: Promise<unknown> }>();
export function refreshApiData() { cache.clear(); }
export function notifyTelemetryChanged() {
  // Pushes refresh aggregates/work orders, not every floor's geometry and metadata.
  for (const key of cache.keys()) {
    if (/^(summary|projects|sites|buildings|alarms|project-sites:|site-buildings:)/.test(key)) cache.delete(key);
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('omnios:telemetry-changed'));
}
export function notifyApiDataChanged() {
  refreshApiData();
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('omnios:data-changed'));
}
if (typeof window !== 'undefined') window.addEventListener('omnios:auth-changed', refreshApiData);
function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const entry = cache.get(key);
  if (entry && entry.until > Date.now()) return entry.promise as Promise<T>;
  const promise = load().catch(error => {
    if (cache.get(key)?.promise === promise) cache.delete(key);
    throw error;
  });
  cache.set(key, { until: Date.now() + 15_000, promise });
  return promise;
}
async function mapLimited<T, U>(rows: T[], run: (row: T) => Promise<U>): Promise<U[]> {
  const result: U[] = new Array(rows.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, rows.length) }, async () => {
    while (next < rows.length) { const index = next++; result[index] = await run(rows[index]); }
  }));
  return result;
}
export const siteId = (project: string, site: string) => `${project}::${site}`;
export const buildingId = (project: string, site: string, building: string) => `${siteId(project, site)}::${encodeURIComponent(building)}`;
export const floorId = (building: string, floor: string) => `${building}::${encodeURIComponent(floor)}`;
export function statusName(status: ApiDeviceStatus): Device['status'] {
  switch (status) {
    case 0: return 'Normal'; case 1: return 'Fault'; case 2: return 'Alarm'; case 3: return 'Offline';
    default: throw new ApiRequestError(`Unknown device status: ${String(status)}`, 422);
  }
}
const categories: Record<string, DeviceType['category']> = {
  Detection: 'detection', Pumps: 'pump', 'Water System': 'water', Ventilation: 'ventilation',
  'Power and Interlocking': 'power_interlocking',
};
export function categoryFromApi(value?: string | null): DeviceType['category'] {
  if (!value) return '';
  return categories[value] ?? (Object.values(categories).includes(value as DeviceType['category']) ? value as DeviceType['category'] : '');
}
export function categoryToApi(value: string): string {
  return Object.entries(categories).find(([, ui]) => ui === value)?.[0] ?? value;
}
export function spatialFromIds(project?: string | null, site?: string | null, building?: string | null) {
  const parts = building && building !== 'all' ? building.split('::') : site && site !== 'all' ? site.split('::') : [];
  return {
    project_code: project && project !== 'all' ? project : parts[0] || undefined,
    site_code: parts[1] || undefined,
    building_name: parts[2] ? decodeURIComponent(parts[2]) : undefined,
  };
}
function namedFloorNumber(name: string): number {
  if (/^(G\/F|GF|G)$/i.test(name)) return 0;
  const basement = /^B(\d+)$/i.exec(name);
  if (basement) return -Number(basement[1]);
  const numbered = /^(-?\d+)(?:\/F)?$/i.exec(name);
  // The backend's list order is retained when there is no supplied floor number.
  return numbered ? Number(numbered[1]) : Number.NaN;
}
let floorImageRevision = 0;
function floorPlanAssetUrl(value?: string | null): string | null {
  const url = resolveAssetUrl(value);
  if (!url) return null;
  const hashAt = url.indexOf('#');
  const base = hashAt < 0 ? url : url.slice(0, hashAt);
  const hash = hashAt < 0 ? '' : url.slice(hashAt);
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}_v=${Date.now()}-${++floorImageRevision}${hash}`;
}
function floorModel(building: Building, label: string, detail?: ApiFloorDetail): Floor {
  return {
    id: floorId(building.id, label), building_id: building.id, floor_label: label,
    floor_number: detail?.floor_number ?? namedFloorNumber(label), image_url: null, buildings: building,
    project_code: building.project_code, site_code: building.site_code, building_name: building.name,
    alarm_count: detail?.alarm_count, fault_count: detail?.fault_count, offline_count: detail?.offline_count,
  };
}
const summary = () => cached('summary', () => api.getProjectsSummary());
const projectSites = (project: string) => cached(`project-sites:${project}`, () => api.getProjectSites(project));
const siteBuildings = (project: string, site: string) => cached(`site-buildings:${siteId(project, site)}`, () => api.getSiteBuildings(project, site));
async function projects(): Promise<Project[]> {
  return cached('projects', async () => (await summary()).projects.map(row => ({
    ...row, id: row.project_code, name: row.project_name, name_zh: row.project_name_zh ?? '', description: row.description ?? '',
  })));
}
async function sites(): Promise<Site[]> {
  return cached('sites', async () => {
    const groups = await mapLimited(await projects(), async project => {
      const result = await projectSites(project.id);
      return result.sites.map(row => ({
        ...row, id: siteId(project.id, row.site_code), api_id: row.id, project_id: project.id,
        name: row.site_name, name_zh: row.site_name_zh ?? '', address: row.address ?? '', city: row.city ?? '',
        contact_email: '', contact_phone: '', latitude: row.latitude ?? null, longitude: row.longitude ?? null,
        projects: project,
      }));
    });
    return groups.flat();
  });
}
type MonitorBuilding = Building & { floors: string[] };
async function buildings(): Promise<MonitorBuilding[]> {
  return cached('buildings', async () => {
    const groups = await mapLimited(await sites(), async site => {
      const project = site.project_id!;
      const response = await siteBuildings(project, site.site_code!);
      return response.buildings.map(row => ({
        ...row, id: buildingId(project, site.site_code!, row.building_name), site_id: site.id,
        name: row.building_name, name_zh: row.building_name_zh ?? '',
        // These are counts of the returned floor labels, never invented building metadata.
        total_floors: row.floors.filter(label => !/^B\d+$/i.test(label)).length,
        basement_floors: row.floors.filter(label => /^B\d+$/i.test(label)).length,
        sites: site, project_code: project, site_code: site.site_code, image_url: null,
      }));
    });
    return groups.flat();
  });
}
async function floors(): Promise<Floor[]> {
  return cached('floors', async () => (await buildings()).flatMap(building => building.floors.map(label =>
    floorModel(building, label, building.floor_details?.find(row => row.floor_name === label)),
  )));
}
function floorDetail(floor: Floor) {
  return cached(`floor-detail:${floor.id}`, async () => {
    const result = await api.getBuilding(floor.project_code!, floor.site_code!, floor.building_name!, floor.floor_label);
    if (result.current_floor && result.current_floor !== floor.floor_label) {
      throw new ApiRequestError('The API returned a different floor from the requested floor.', 422);
    }
    return result;
  });
}
function typeModel(row: AdminDeviceType): DeviceType {
  return { ...row, id: String(row.type_id), api_id: row.type_id, category: categoryFromApi(row.category), name_zh_tw: row.name_zh_tw ?? '' };
}
function deviceModel(point: ApiDevicePoint, floor: Floor, type?: DeviceType): Device {
  const category = categoryFromApi(point.category);
  const deviceType: DeviceType | undefined = type ?? (point.device_type_code || point.terminal_type || category ? {
    id: point.device_type_code ?? '', code: point.device_type_code ?? '', category,
    name_en: point.terminal_type ?? '', name_zh: '', name_zh_tw: '', priority: '',
    possible_states: ['Normal', 'Fault', 'Alarm', 'Offline'], has_numeric_value: null, unit: point.unit ?? null,
  } : undefined);
  return {
    id: point.device_id, code: point.device_id, label: point.label ?? '', floor_id: floor.id,
    device_type_id: deviceType?.id ?? '', device_types: deviceType, floors: floor,
    position_x: point.position_x ?? null, position_y: point.position_y ?? null,
    status: statusName(point.status), api_status: point.status, current_value: point.current_value ?? null,
    last_seen_at: point.last_seen ?? '', control_room_id: null, serial_number: '', brand: '', notes: '',
    terminal_type: point.terminal_type ?? '', battery_value: point.battery_value ?? null,
    signal_power: point.signal_power ?? null, alarm_min: point.alarm_min ?? null, alarm_max: point.alarm_max ?? null,
    project_code: floor.project_code, site_code: floor.site_code, building_name: floor.building_name, floor_name: floor.floor_label,
  };
}
async function devices(ids?: string[]): Promise<Device[]> {
  if (ids && ids.length === 0) return [];
  const scope = ids ? [...ids].sort().join('|') : '*';
  return cached(`devices:${scope}`, async () => {
    const selected = (await floors()).filter(floor => !ids || ids.includes(floor.id));
    const groups = await mapLimited(selected, async floor => {
      const detail = await floorDetail(floor);
      const linked = { ...floor, image_url: floorPlanAssetUrl(detail.floor_plan_url) };
      return detail.devices.map(point => deviceModel(point, linked));
    });
    return groups.flat();
  });
}
async function deviceTypes(): Promise<DeviceType[]> {
  if (api.getSession()?.user_info.role === 'admin') return adminDeviceTypes();
  const points = await devices();
  return [...new Map(points.filter(row => row.device_types?.code).map(row => [row.device_types!.code, row.device_types!])).values()];
}
function alarmDevice(row: ApiAlarm, locationSites: Site[], locationBuildings: Building[]): Device {
  const site = locationSites.find(item => item.id === siteId(row.project_code, row.site_code));
  const building = locationBuildings.find(item => item.id === buildingId(row.project_code, row.site_code, row.building_name));
  const relationSite: Site = site ?? { id: siteId(row.project_code, row.site_code), project_id: row.project_code,
    site_code: row.site_code, name: row.site_name, name_zh: '', address: '', city: '', contact_email: '',
    contact_phone: row.contact_phone ?? '', latitude: null, longitude: null };
  const relationBuilding = building ?? { id: buildingId(row.project_code, row.site_code, row.building_name), site_id: relationSite.id,
    name: row.building_name, name_zh: '', total_floors: 0, basement_floors: 0,
    project_code: row.project_code, site_code: row.site_code, sites: relationSite };
  const floor = { ...floorModel(relationBuilding, row.floor_name), image_url: floorPlanAssetUrl(row.floor_plan_url) };
  // Alarm severity is NOT used as a current physical device status. Snapshot data is separate.
  const device = deviceModel({ device_id: row.device_id, label: row.device_label, category: row.category,
    position_x: row.position_x, position_y: row.position_y, status: 0, current_value: null, unit: null,
    battery_value: null, signal_power: null, alarm_min: null, alarm_max: null, last_seen: null }, floor);
  return { ...device, status: '' as Device['status'], api_status: undefined };
}
export function mapAlarm(row: ApiAlarm, locationSites: Site[] = [], locationBuildings: Building[] = []): AlarmEvent {
  return {
    id: String(row.id), device_id: row.device_id, alarm_type: row.alarm_type,
    severity: row.severity.toLowerCase() as AlarmEvent['severity'], source_severity: row.severity,
    status: row.status, description: row.description, triggered_at: row.triggered_at,
    acknowledged_by: row.acknowledged_by, acknowledged_by_name: row.acknowledged_by,
    acknowledged_at: row.acknowledged_at, dispatched_to: row.dispatched_to, dispatched_at: row.dispatched_at,
    dispatcher_name: null, dispatcher_contact: null, resolved_by: null, resolver_name: null, resolved_at: row.resolved_at,
    project_code: row.project_code, site_code: row.site_code, building_name: row.building_name,
    floor_name: row.floor_name, floor_plan_url: floorPlanAssetUrl(row.floor_plan_url),
    devices: alarmDevice(row, locationSites, locationBuildings),
  };
}
async function alarms(): Promise<AlarmEvent[]> {
  return cached('alarms', async () => {
    const rows = await api.getAllAlarms({ status: 'all' });
    return rows.map(row => mapAlarm(row));
  });
}
async function predictions(): Promise<MaintenancePrediction[]> {
  return cached('predictions', async () => {
    const [result, points] = await Promise.all([api.getPredictions(), devices().catch(() => [] as Device[])]);
    const byCode = new Map(points.map(point => [point.code, point]));
    return result.items.map((row: ApiPrediction) => ({
      ...row, id: String(row.id), triggered_by_rule_id: row.triggered_by_rule_id == null ? null : String(row.triggered_by_rule_id),
      confidence_score: null, created_at: '', devices: byCode.get(row.device_id),
    }));
  });
}
async function floorPlanImages(building?: string, selectedFloor?: string): Promise<FloorPlanImage[]> {
  const rows = (await floors()).filter(floor => selectedFloor ? floor.id === selectedFloor : !building || floor.building_id === building);
  const images = await mapLimited(rows, async floor => {
    const detail = await floorDetail(floor);
    const url = floorPlanAssetUrl(detail.floor_plan_url);
    return !url ? null : {
      id: `floor-plan:${floor.id}`, floor_id: floor.id, building_id: floor.building_id, image_url: url,
      image_type: 'floor_plan' as const,
      file_format: (url.split('?')[0].split('.').pop()?.toLowerCase() ?? '') as FloorPlanImage['file_format'],
      version: null, is_active: true, label: floor.floor_label, sort_order: floor.floor_number,
      created_at: '', updated_at: '',
    };
  });
  return images.filter(row => row !== null);
}

function requireAdmin() {
  if (api.getSession()?.user_info.role !== 'admin') throw new ApiRequestError('Administrator access is required.', 403);
}
async function adminProjects(): Promise<Project[]> {
  requireAdmin();
  return cached('admin:projects', async () => (await api.admin.list('projects')).map(row => ({
    ...row, id: row.project_code, api_id: row.project_id, name: row.project_name, name_zh: row.project_name_zh,
  })));
}
async function adminSites(): Promise<Site[]> {
  requireAdmin();
  return cached('admin:sites', async () => {
    const [rows, parents] = await Promise.all([api.admin.list('sites'), adminProjects()]);
    return rows.map(row => ({ ...row, id: siteId(row.project_code, row.site_code), api_id: row.site_id,
      project_id: row.project_code, name: row.site_name, name_zh: row.site_name_zh,
      projects: parents.find(parent => parent.id === row.project_code) }));
  });
}
async function adminBuildings(): Promise<Building[]> {
  requireAdmin();
  return cached('admin:buildings', async () => {
    const [rows, parents] = await Promise.all([api.admin.list('buildings'), adminSites()]);
    return rows.map(row => ({ ...row, id: buildingId(row.project_code, row.site_code, row.building_name),
      api_id: row.building_id, site_id: siteId(row.project_code, row.site_code), name: row.building_name,
      name_zh: row.building_name_zh, sites: parents.find(parent => parent.id === siteId(row.project_code, row.site_code)) }));
  });
}
async function adminFloors(): Promise<Floor[]> {
  requireAdmin();
  return cached('admin:floors', async () => {
    const [rows, parents] = await Promise.all([api.admin.list('floors'), adminBuildings()]);
    return rows.map(row => { const parent = buildingId(row.project_code, row.site_code, row.building_name); return {
      ...row, id: floorId(parent, row.floor_label), api_id: row.floor_id, building_id: parent,
      image_url: floorPlanAssetUrl(row.floor_plan_url), buildings: parents.find(item => item.id === parent),
    }; });
  });
}
async function adminDeviceTypes(): Promise<DeviceType[]> {
  requireAdmin();
  return cached('admin:device-types', async () => (await api.admin.list('device-types')).map(typeModel));
}
async function adminDevices(): Promise<Device[]> {
  requireAdmin();
  return cached('admin:devices', async () => {
    const [rows, locationFloors, types] = await Promise.all([api.admin.list('devices'), adminFloors(), adminDeviceTypes()]);
    return rows.map(row => {
      const key = floorId(buildingId(row.project_code, row.site_code, row.building_name), row.floor_label);
      const floor = locationFloors.find(item => item.id === key);
      if (!floor) throw new ApiRequestError(`Device ${row.device_code} references a floor not returned by the API.`, 422);
      return { ...deviceModel({ device_id: row.device_code, label: row.label, category: row.category,
        device_type_code: row.device_type_code ?? undefined, terminal_type: row.type_name_en,
        position_x: row.position_x, position_y: row.position_y, status: row.status, current_value: null,
        unit: null, battery_value: null, signal_power: null, alarm_min: null, alarm_max: null, last_seen: null },
      floor, types.find(type => type.code === row.device_type_code)), serial_number: row.serial_number ?? '', notes: row.notes ?? '' };
    });
  });
}
async function maintenanceRules(): Promise<MaintenanceRule[]> {
  requireAdmin();
  return cached('admin:maintenance-rules', async () => (await api.admin.list('maintenance-rules')).map(row => ({
    ...row, id: String(row.rule_id), rule_type: row.rule_type as MaintenanceRule['rule_type'],
    device_category: row.device_category === 'All Categories' ? 'all' : categoryFromApi(row.device_category) || row.device_category,
  })));
}
async function fsdCodes() {
  requireAdmin();
  const frequency = { Monthly: 'monthly', Quarterly: 'quarterly', 'Semi-Annual': '6-monthly', Annual: 'annual' } as const;
  return cached('admin:fsd-codes', async () => (await api.admin.list('fsd-codes')).map(row => ({
    ...row, id: String(row.code_id), frequency: frequency[row.frequency],
    device_category: categoryFromApi(row.device_category) || row.device_category,
  })));
}
export const apiData = {
  summary, projectSites, siteBuildings, projects, sites, buildings, floors, devices, deviceTypes, alarms,
  predictions, floorPlanImages, floorDetail, refresh: refreshApiData, changed: notifyApiDataChanged,
};
export const apiAdminData = {
  projects: adminProjects, sites: adminSites, buildings: adminBuildings, floors: adminFloors,
  devices: adminDevices, deviceTypes: adminDeviceTypes, maintenanceRules, fsdCodes,
};
