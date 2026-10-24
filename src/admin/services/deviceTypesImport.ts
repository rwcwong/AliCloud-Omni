import { apiClient } from '../../lib/apiCompat';
import { DeviceType } from '../../types';

export interface DeviceTypeImportRow {
  code: string;
  category: string;
  name_en: string;
  name_zh: string;
  name_zh_tw: string;
  priority: string;
  unit: string;
  possible_states: string;
  has_numeric_value: boolean;
}

export interface DeviceTypeImportResult {
  created: number;
  updated: number;
  warnings: string[];
  errors: string[];
}

export const DEVICE_TYPE_COLUMNS = [
  'Code',
  'Category',
  'Name (EN)',
  'Name (ZH)',
  'Name (ZH-TW)',
  'Priority',
  'Unit',
  'Possible States',
  'Has Numeric Value',
] as const;

const VALID_CATEGORIES = ['detection', 'pump', 'water', 'ventilation', 'power_interlocking'];
const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'];

export function parseDeviceTypeExcel(file: File): Promise<DeviceTypeImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) {
          reject(new Error('No worksheet found in the file'));
          return;
        }
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
        const rows: DeviceTypeImportRow[] = json.map((r) => ({
          code: String(r['Code'] ?? '').trim(),
          category: String(r['Category'] ?? '').trim().toLowerCase(),
          name_en: String(r['Name (EN)'] ?? '').trim(),
          name_zh: String(r['Name (ZH)'] ?? '').trim(),
          name_zh_tw: String(r['Name (ZH-TW)'] ?? '').trim(),
          priority: String(r['Priority'] ?? 'medium').trim().toLowerCase(),
          unit: String(r['Unit'] ?? '').trim(),
          possible_states: String(r['Possible States'] ?? '').trim(),
          has_numeric_value: String(r['Has Numeric Value'] ?? '').trim().toLowerCase() === 'true' || String(r['Has Numeric Value'] ?? '').trim() === '1' || String(r['Has Numeric Value'] ?? '').trim().toLowerCase() === 'yes',
        }));
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

export async function downloadDeviceTypeTemplate() {
  const XLSX = await import('xlsx');
  const sampleRow = ['SD', 'detection', 'Smoke Detector', '烟感探测器', '煙霧探測器', 'high', '', 'Normal,Alarm,Fault,Offline', 'false'];
  const ws = XLSX.utils.aoa_to_sheet([DEVICE_TYPE_COLUMNS as unknown as string[], sampleRow]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Device Types');
  XLSX.writeFile(wb, 'device_types_import_template.xlsx');
}

export async function processDeviceTypeImport(rows: DeviceTypeImportRow[]): Promise<DeviceTypeImportResult> {
  const result: DeviceTypeImportResult = { created: 0, updated: 0, warnings: [], errors: [] };

  const existing = new Map<string, DeviceType>();
  const { data: allTypes } = await apiClient.from('admin_device_types').select('*');
  if (allTypes) {
    for (const dt of allTypes as DeviceType[]) {
      existing.set(dt.code.toLowerCase(), dt);
    }
  }

  for (const [idx, row] of rows.entries()) {
    const lineNo = idx + 2;
    if (!row.code) {
      result.errors.push(`Row ${lineNo}: Code is required`);
      continue;
    }
    if (!row.name_en) {
      result.errors.push(`Row ${lineNo}: Name (EN) is required`);
      continue;
    }
    if (row.category && !VALID_CATEGORIES.includes(row.category)) {
      result.errors.push(`Row ${lineNo}: Invalid category "${row.category}". Valid: ${VALID_CATEGORIES.join(', ')}`);
      continue;
    }
    if (row.priority && !VALID_PRIORITIES.includes(row.priority)) {
      result.errors.push(`Row ${lineNo}: Invalid priority "${row.priority}". Valid: ${VALID_PRIORITIES.join(', ')}`);
      continue;
    }

    const possibleStates = row.possible_states
      ? row.possible_states.split(',').map(s => s.trim()).filter(Boolean)
      : ['Normal', 'Fault', 'Offline'];

    const payload = {
      code: row.code,
      category: row.category || 'detection',
      name_en: row.name_en,
      name_zh: row.name_zh || row.name_en,
      name_zh_tw: row.name_zh_tw || row.name_zh || row.name_en,
      priority: (row.priority || 'medium') as DeviceType['priority'],
      possible_states: possibleStates,
      has_numeric_value: row.has_numeric_value,
      unit: row.unit || null,
    };

    const existingType = existing.get(row.code.toLowerCase());
    if (existingType) {
      const { error } = await apiClient.from('admin_device_types').update(payload).eq('id', existingType.id);
      if (error) {
        result.errors.push(`Row ${lineNo}: Failed to update "${row.code}" — ${error.message}`);
      } else {
        result.updated++;
      }
    } else {
      const { error } = await apiClient.from('admin_device_types').insert(payload);
      if (error) {
        result.errors.push(`Row ${lineNo}: Failed to create "${row.code}" — ${error.message}`);
      } else {
        result.created++;
      }
    }
  }

  return result;
}
