import { api, ApiRequestError } from './api';
import { apiAdminData, categoryToApi, notifyApiDataChanged } from './apiData';
import type { AdminResource } from '../api/types';

// These are view-model rows, not database tables. Writes always use documented REST endpoints.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
export interface QueryCondition { column: string; op: 'eq' | 'in'; value: unknown }
const resources: Record<string, AdminResource> = {
  projects: 'projects', sites: 'sites', buildings: 'buildings', floors: 'floors', devices: 'devices',
  device_types: 'device-types', fsd_codes: 'fsd-codes', maintenance_rules: 'maintenance-rules',
};
export function plainTable(table: string) { return table.replace(/^admin_/, ''); }
export async function adminRows(table: string): Promise<Row[]> {
  switch (plainTable(table)) {
    case 'projects': return apiAdminData.projects(); case 'sites': return apiAdminData.sites();
    case 'buildings': return apiAdminData.buildings(); case 'floors': return apiAdminData.floors();
    case 'devices': return apiAdminData.devices(); case 'device_types': return apiAdminData.deviceTypes();
    case 'fsd_codes': return apiAdminData.fsdCodes(); case 'maintenance_rules': return apiAdminData.maintenanceRules();
    default: throw new ApiRequestError(`No API v3.0 mutation is documented for ${table}.`, 501);
  }
}
function required(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new ApiRequestError(`${name} is required; no value will be generated automatically.`, 422);
  return value.trim();
}
function numeric(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ApiRequestError(`${name} must be a finite number.`, 422);
  return value;
}
async function find(table: string, id: unknown): Promise<Row> {
  const row = (await adminRows(table)).find(item => item.id === id);
  if (!row) throw new ApiRequestError(`The selected ${table} record could not be resolved. Reload and try again.`, 422);
  return row;
}
function backendId(table: string, row: Row): number | string {
  if (table === 'devices') return required(row.code, 'device_code');
  const fields: Record<string, string> = { projects: 'project_id', sites: 'site_id', buildings: 'building_id',
    floors: 'floor_id', device_types: 'type_id', fsd_codes: 'code_id', maintenance_rules: 'rule_id' };
  const value = row.api_id ?? row[fields[table]];
  if (!Number.isInteger(value) || value < 1) throw new ApiRequestError('The server primary key is missing. The UI navigation key cannot be used as a database ID.', 422);
  return value;
}
function rejectFields(row: Row, fields: string[]) {
  for (const field of fields) {
    if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
      throw new ApiRequestError(`API v3.0 does not define a writable ${field} field.`, 501);
    }
  }
}
async function payloadFor(table: string, value: Row): Promise<Row> {
  switch (table) {
    case 'projects': return { project_code: required(value.project_code ?? value.id, 'project_code'),
      project_name: required(value.name, 'project_name'), project_name_zh: value.name_zh ?? '', description: value.description ?? '' };
    case 'sites': return { project_code: required(value.project_id, 'project_code'), site_code: required(value.site_code, 'site_code'),
      site_name: required(value.name, 'site_name'), site_name_zh: value.name_zh ?? '', city: value.city ?? '', address: value.address ?? '',
      latitude: value.latitude ?? null, longitude: value.longitude ?? null,
      contact_email: value.contact_email ?? '', contact_phone: value.contact_phone ?? '' };
    case 'buildings': {
      const site = await find('sites', value.site_id);
      return { project_code: site.project_id, site_code: site.site_code,
        building_name: required(value.name, 'building_name'), building_name_zh: value.name_zh ?? '',
        basement_floors: numeric(value.basement_floors, 'basement_floors'), total_floors: numeric(value.total_floors, 'total_floors') };
    }
    case 'floors': {
      const building = await find('buildings', value.building_id);
      return { project_code: building.project_code, site_code: building.site_code, building_name: building.name,
        floor_number: numeric(value.floor_number, 'floor_number'), floor_label: required(value.floor_label, 'floor_label') };
    }
    case 'devices': {
      const floor = await find('floors', value.floor_id);
      const types = await apiAdminData.deviceTypes();
      const type = types.find(item => item.id === value.device_type_id);
      const result: Row = { project_code: floor.project_code, site_code: floor.site_code, building_name: floor.building_name,
        floor_label: floor.floor_label, code: required(value.code, 'code'), label: required(value.label, 'label'),
        serial_number: value.serial_number ?? '', notes: value.notes ?? '' };
      if (value.device_type_id && !type) throw new ApiRequestError('The selected device type was not returned by the type dictionary.', 422);
      if (type) result.device_type_code = type.code;
      for (const axis of ['position_x', 'position_y']) {
        if (value[axis] == null) continue;
        const coordinate = numeric(value[axis], axis);
        if (coordinate < 0 || coordinate > 100) throw new ApiRequestError('Coordinates must be between 0 and 100 percent.', 422);
        result[axis] = coordinate;
      }
      return result;
    }
    case 'device_types': return { code: required(value.code, 'code'), category: categoryToApi(required(value.category, 'category')),
      name_en: required(value.name_en, 'name_en'), name_zh: required(value.name_zh, 'name_zh'), name_zh_tw: value.name_zh_tw ?? '',
      priority: value.priority, unit: value.unit, has_numeric_value: value.has_numeric_value, possible_states: value.possible_states };
    case 'fsd_codes': {
      const frequency: Record<string, string> = { monthly: 'Monthly', quarterly: 'Quarterly', '6-monthly': 'Semi-Annual', annual: 'Annual' };
      if (!frequency[value.frequency]) throw new ApiRequestError('Select a documented FSD inspection frequency.', 422);
      return { code: required(value.code, 'code'), description_en: required(value.description_en, 'description_en'),
        description_zh: required(value.description_zh, 'description_zh'), frequency: frequency[value.frequency],
        device_category: categoryToApi(value.device_category), is_active: value.is_active };
    }
    case 'maintenance_rules': return { name: required(value.name, 'name'), name_zh: required(value.name_zh, 'name_zh'),
      rule_type: required(value.rule_type, 'rule_type'), device_category: value.device_category === 'all' ? 'All Categories' : categoryToApi(value.device_category),
      threshold: value.threshold, time_window_hours: value.time_window_hours, min_probability: value.min_probability,
      recommendation: required(value.recommendation, 'recommendation'), recommendation_zh: required(value.recommendation_zh, 'recommendation_zh'),
      is_active: value.is_active };
    default: throw new ApiRequestError(`No API v3.0 write contract for ${table}.`, 501);
  }
}

export async function mutateLegacy(tableName: string, operation: 'insert' | 'update' | 'delete' | 'upsert', input: unknown, conditions: QueryCondition[]): Promise<Row[]> {
  const table = plainTable(tableName);
  const payload = (input ?? {}) as Row;
  if (table === 'alarm_events' && operation === 'update') {
    const ids = conditions.find(item => item.column === 'id');
    if (!ids) throw new ApiRequestError('An alarm ID is required.', 422);
    const values = ids.op === 'in' ? ids.value as string[] : [ids.value as string];
    const action = payload.status === 'acknowledged' ? { action: 'acknowledge' as const }
      : payload.status === 'dispatched' ? { action: 'dispatch' as const, dispatched_to: required(payload.dispatched_to, 'dispatched_to') } : null;
    if (!action) throw new ApiRequestError('API v3.0 only documents acknowledging and dispatching alarms.', 501);
    for (const id of values) await api.actOnAlarm(String(id), action);
    notifyApiDataChanged();
    return [];
  }
  const resource = resources[table];
  if (!resource || operation === 'upsert') throw new ApiRequestError(`${operation} ${table} is not defined in API v3.0.`, 501);
  const changed: { id?: unknown; apiId?: unknown; code?: unknown }[] = [];
  if (operation === 'insert') {
    const entries = Array.isArray(input) ? input : [input];
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') throw new ApiRequestError('A record payload is required.', 422);
      if (table === 'devices') rejectFields(entry, ['control_room_id', 'brand', 'is_active']);
      const body = await payloadFor(table, entry);
      const result = await api.admin.create(resource, body);
      const keys = ['project_id', 'site_id', 'building_id', 'floor_id', 'type_id', 'code_id', 'rule_id'] as const;
      changed.push({ apiId: keys.map(key => result[key]).find(value => value != null), code: result.device_code ?? result.project_code ?? body.code });
      // Subsequent rows may refer to a parent created by an earlier row.
      notifyApiDataChanged();
    }
  } else {
    if (!conditions.some(item => item.column === 'id' || item.column === 'code')) throw new ApiRequestError('Unscoped updates/deletes are not allowed.', 422);
    const targets = (await adminRows(table)).filter(row => conditions.every(condition => condition.op === 'eq'
      ? row[condition.column] === condition.value : (condition.value as unknown[]).includes(row[condition.column])));
    if (targets.length === 0) throw new ApiRequestError('The target record no longer exists. Reload before retrying.', 404);
    for (const row of targets) {
      const id = backendId(table, row);
      if (operation === 'delete') await api.admin.remove(resource, id);
      else if (table === 'devices' && Object.keys(payload).every(key => key === 'position_x' || key === 'position_y')) {
        await api.admin.updatePosition(row.code, { position_x: numeric(payload.position_x, 'position_x'), position_y: numeric(payload.position_y, 'position_y') });
      } else {
        if (table === 'devices') rejectFields(payload, ['status', 'is_active', 'control_room_id', 'brand', 'current_value']);
        const body = await payloadFor(table, { ...row, ...payload });
        if (table === 'projects') delete body.project_code; // v3 does not allow changing project identity.
        await api.admin.update(resource, id, body);
      }
      changed.push({ id: row.id, apiId: typeof id === 'number' ? id : undefined, code: payload.code ?? row.code });
      notifyApiDataChanged();
    }
  }
  if (operation === 'delete') return [];
  const rows = await adminRows(table);
  return rows.filter(row => changed.some(item => item.apiId != null
    ? (row.api_id ?? row.rule_id ?? row.code_id) === item.apiId
    : row.code === item.code || row.id === item.code || row.id === item.id));
}
