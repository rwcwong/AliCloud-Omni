import { api } from '../../lib/api';
import { apiAdminData, notifyApiDataChanged } from '../../lib/apiData';

export interface DeviceImportRow {
  code: string;
  label: string;
  device_type_code: string;
  project_code: string;
  project_name: string;
  project_name_cn: string;
  site_code: string;
  site_name: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  building_name: string;
  floor_label: string;
  serial_number: string;
  control_room_name: string;
  status: string;
  position_x: number | null;
  position_y: number | null;
  notes: string;
}

export interface DeviceImportResult {
  created: number;
  updated: number;
  warnings: string[];
  errors: string[];
}

export const DEVICE_COLUMNS = ['project_code', 'site_code', 'building_name', 'floor_label', 'code', 'label', 'device_type_code', 'serial_number', 'position_x', 'position_y', 'notes'] as const;

function text(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function numeric(row: Record<string, unknown>, ...keys: string[]): number | null {
  const raw = text(row, ...keys);
  if (!raw) return null;
  const value = Number(raw);
  return value; // Invalid values are rejected during preflight, never silently replaced with null.
}

export function parseDeviceExcel(file: File): Promise<DeviceImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!worksheet) throw new Error('No worksheet found in the file');
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
        resolve(rows.map(row => ({
          code: text(row, 'code', 'device_id', 'Device ID', 'Code'),
          label: text(row, 'label', 'device_name', 'Label'),
          device_type_code: text(row, 'device_type_code', 'terminal_type', 'Device Type Code'),
          project_code: text(row, 'project_code'),
          project_name: text(row, 'project_name'),
          project_name_cn: text(row, 'project_name_cn'),
          site_code: text(row, 'site_code'),
          site_name: text(row, 'site_name', 'Site Name'),
          city: text(row, 'city'),
          address: text(row, 'address'),
          latitude: numeric(row, 'latitude'),
          longitude: numeric(row, 'longitude'),
          building_name: text(row, 'building_name', 'Building Name'),
          floor_label: text(row, 'floor_label', 'floor_name', 'Floor Label'),
          serial_number: text(row, 'serial_number', 'Serial Number'),
          control_room_name: text(row, 'Control Room Name'),
          status: text(row, 'Status'),
          position_x: numeric(row, 'position_x', 'Position X'),
          position_y: numeric(row, 'position_y', 'Position Y'),
          notes: text(row, 'notes', 'Notes'),
        })));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

export async function downloadDeviceTemplate() {
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.aoa_to_sheet([[...DEVICE_COLUMNS]]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Devices v3');
  XLSX.writeFile(workbook, 'devices_api_v3.xlsx');
}

export async function processDeviceImport(rows: DeviceImportRow[]): Promise<DeviceImportResult> {
  const result: DeviceImportResult = { created: 0, updated: 0, warnings: [], errors: [] };
  const [floors, devices, types] = await Promise.all([apiAdminData.floors(), apiAdminData.devices(), apiAdminData.deviceTypes()]);
  const knownCodes = new Set(devices.map(device => device.code));
  const seen = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const line = index + 2;
    try {
      if (!row.code || !row.building_name || !row.floor_label) throw new Error('code, building_name and floor_label are required.');
      if (seen.has(row.code)) throw new Error('Duplicate device code in the import file.');
      seen.add(row.code);
      if (row.control_room_name || row.status) throw new Error('control_room_name/status are not writable in API v3.0. Remove these values before importing.');
      const matches = floors.filter(floor =>
        (!row.project_code || floor.project_code === row.project_code)
        && (!row.site_code || floor.site_code === row.site_code)
        && (!row.site_name || floor.buildings?.sites?.name === row.site_name)
        && floor.building_name === row.building_name && floor.floor_label === row.floor_label);
      if (matches.length !== 1) throw new Error('Location is missing or ambiguous. Supply project_code and site_code and create the floor first.');
      const floor = matches[0];
      const existing = devices.find(device => device.code === row.code);
      const label = row.label || existing?.label;
      if (!label) throw new Error('label is required for a new device; it will not be invented from its code.');
      const typeCode = row.device_type_code || existing?.device_types?.code;
      if (typeCode && !types.some(type => type.code === typeCode)) throw new Error('device_type_code does not exist in the server dictionary.');
      for (const coordinate of [row.position_x, row.position_y]) {
        if (coordinate != null && (!Number.isFinite(coordinate) || coordinate < 0 || coordinate > 100)) throw new Error('Coordinates must be numeric percentages between 0 and 100.');
      }
      const payload = {
        project_code: floor.project_code, site_code: floor.site_code, building_name: floor.building_name,
        floor_label: floor.floor_label, code: row.code, label,
        ...(typeCode ? { device_type_code: typeCode } : {}),
        serial_number: row.serial_number || existing?.serial_number || '', notes: row.notes || existing?.notes || '',
        ...(row.position_x != null ? { position_x: row.position_x } : existing?.position_x != null ? { position_x: existing.position_x } : {}),
        ...(row.position_y != null ? { position_y: row.position_y } : existing?.position_y != null ? { position_y: existing.position_y } : {}),
      };
      if (knownCodes.has(row.code)) { await api.admin.update('devices', row.code, payload); result.updated++; }
      else { await api.admin.create('devices', payload); result.created++; knownCodes.add(row.code); }
      notifyApiDataChanged();
      if (row.project_name || row.city || row.address || row.latitude != null || row.longitude != null) result.warnings.push('Row ' + line + ': device import does not edit project/site metadata. Use their respective admin forms.');
    } catch (failure) { result.errors.push('Row ' + line + ': ' + (failure instanceof Error ? failure.message : String(failure))); }
  }
  return result;
}
