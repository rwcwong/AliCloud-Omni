import { apiClient } from '../../lib/apiCompat';
import { Project, Site, Building } from '../../types';

export interface ImportRow {
  projectCode: string;
  siteCode: string;
  projectName: string;
  projectNameZh: string;
  siteName: string;
  siteNameZh: string;
  siteAddress: string;
  siteCity: string;
  buildingName: string;
  buildingNameZh: string;
  totalFloors: number;
  basementFloors: number;
}

export interface ImportResult {
  created: { projects: number; sites: number; buildings: number };
  updated: { projects: number; sites: number; buildings: number };
  warnings: string[];
  errors: string[];
}

export const IMPORT_COLUMNS = [
  'Project Code',
  'Site Code',
  'Project Name',
  'Project Name (ZH)',
  'Site Name',
  'Site Name (ZH)',
  'Site Address',
  'Site City',
  'Building Name',
  'Building Name (ZH)',
  'Total Floors',
  'Basement Floors',
] as const;

export function parseExcelFile(file: File): Promise<ImportRow[]> {
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
        const rows: ImportRow[] = json.map((r) => ({
          projectCode: String(r['Project Code'] ?? '').trim(),
          siteCode: String(r['Site Code'] ?? '').trim(),
          projectName: String(r['Project Name'] ?? '').trim(),
          projectNameZh: String(r['Project Name (ZH)'] ?? '').trim(),
          siteName: String(r['Site Name'] ?? '').trim(),
          siteNameZh: String(r['Site Name (ZH)'] ?? '').trim(),
          siteAddress: String(r['Site Address'] ?? '').trim(),
          siteCity: String(r['Site City'] ?? '').trim(),
          buildingName: String(r['Building Name'] ?? '').trim(),
          buildingNameZh: String(r['Building Name (ZH)'] ?? '').trim(),
          totalFloors: Number(r['Total Floors']),
          basementFloors: Number(r['Basement Floors']),
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

export async function downloadTemplate() {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([IMPORT_COLUMNS as unknown as string[]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Import Template');
  XLSX.writeFile(wb, 'sites_buildings_import_template.xlsx');
}

export async function processImport(rows: ImportRow[]): Promise<ImportResult> {
  const result: ImportResult = {
    created: { projects: 0, sites: 0, buildings: 0 },
    updated: { projects: 0, sites: 0, buildings: 0 },
    warnings: [],
    errors: [],
  };

  const projectCache = new Map<string, Project>();
  const siteCache = new Map<string, Site>();

  for (const [idx, row] of rows.entries()) {
    const lineNo = idx + 2;
    if (!row.projectName) {
      result.errors.push(`Row ${lineNo}: Project Name is required`);
      continue;
    }

    if (row.buildingName && (!Number.isInteger(row.totalFloors) || row.totalFloors < 1 || !Number.isInteger(row.basementFloors) || row.basementFloors < 0)) {
      result.errors.push('Row ' + lineNo + ': total floors must be a positive integer and basement floors a non-negative integer.');
      continue;
    }
    if (!row.projectCode || !row.siteCode) {
      result.errors.push('Row ' + lineNo + ': Project Code and Site Code are required by API v3.0.');
      continue;
    }
    let project = projectCache.get(row.projectCode);
    if (!project) {
      const { data: existing } = await apiClient
        .from('admin_projects')
        .select('*')
        .eq('project_code', row.projectCode)
        .maybeSingle();
      if (existing) {
        project = existing as Project;
        const updates: Partial<Project> = {};
        if (row.projectName !== project.name) updates.name = row.projectName;
        if (row.projectNameZh && row.projectNameZh !== project.name_zh) updates.name_zh = row.projectNameZh;
        if (Object.keys(updates).length > 0) {
          const { data: updated, error: updateError } = await apiClient.from('admin_projects').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', project.id).select().maybeSingle();
          if (updateError) { result.errors.push('Row ' + lineNo + ': ' + updateError.message); continue; }
          if (updated) project = updated as Project;
          result.updated.projects++;
          result.warnings.push(`Row ${lineNo}: Project "${row.projectName}" already exists — updated`);
        }
        projectCache.set(row.projectCode, project);
      } else {
        const { data: created, error } = await apiClient
          .from('admin_projects')
          .insert({ project_code: row.projectCode, name: row.projectName, name_zh: row.projectNameZh, description: '' })
          .select()
          .maybeSingle();
        if (error || !created) {
          result.errors.push(`Row ${lineNo}: Failed to create project "${row.projectName}" — ${error?.message ?? 'unknown error'}`);
          continue;
        }
        project = created as Project;
        result.created.projects++;
        projectCache.set(row.projectCode, project);
      }
    }

    if (!row.siteName) {
      result.errors.push(`Row ${lineNo}: Site Name is required`);
      continue;
    }

    const siteKey = `${row.projectCode}::${row.siteCode}`;
    let site = siteCache.get(siteKey);
    if (!site) {
      const { data: existingSite } = await apiClient
        .from('admin_sites')
        .select('*')
        .eq('project_id', project.id)
        .eq('site_code', row.siteCode)
        .maybeSingle();
      if (existingSite) {
        site = existingSite as Site;
        const updates: Partial<Site> = {};
        if (row.siteName !== site.name) updates.name = row.siteName;
        if (row.siteNameZh && row.siteNameZh !== site.name_zh) updates.name_zh = row.siteNameZh;
        if (row.siteAddress && row.siteAddress !== site.address) updates.address = row.siteAddress;
        if (row.siteCity && row.siteCity !== site.city) updates.city = row.siteCity;
        if (Object.keys(updates).length > 0) {
          const { data: updated, error: updateError } = await apiClient.from('admin_sites').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', site.id).select().maybeSingle();
          if (updateError) { result.errors.push('Row ' + lineNo + ': ' + updateError.message); continue; }
          if (updated) site = updated as Site;
          result.updated.sites++;
          result.warnings.push(`Row ${lineNo}: Site "${row.siteName}" already exists under project "${row.projectName}" — updated`);
        }
        siteCache.set(siteKey, site);
      } else {
        const { data: createdSite, error: siteErr } = await apiClient
          .from('admin_sites')
          .insert({
            project_id: project.id,
            site_code: row.siteCode,
            name: row.siteName,
            name_zh: row.siteNameZh,
            address: row.siteAddress,
            city: row.siteCity,
            contact_email: '',
            contact_phone: '',
          })
          .select()
          .maybeSingle();
        if (siteErr || !createdSite) {
          result.errors.push(`Row ${lineNo}: Failed to create site "${row.siteName}" — ${siteErr?.message ?? 'unknown error'}`);
          continue;
        }
        site = createdSite as Site;
        result.created.sites++;
        siteCache.set(siteKey, site);
      }
    }

    if (!row.buildingName) continue;

    const { data: existingBuilding } = await apiClient
      .from('admin_buildings')
      .select('*')
      .eq('site_id', site.id)
      .eq('name', row.buildingName)
      .maybeSingle();

    if (existingBuilding) {
      const updates: Partial<Building> = {};
      if (row.buildingNameZh && row.buildingNameZh !== existingBuilding.name_zh) updates.name_zh = row.buildingNameZh;
      const newBasement = Number(row.basementFloors ?? 0) || 0;
      if (row.totalFloors && row.totalFloors !== existingBuilding.total_floors) updates.total_floors = row.totalFloors;
      if (newBasement !== (existingBuilding.basement_floors ?? 0)) updates.basement_floors = newBasement;
      if (Object.keys(updates).length > 0) {
        const { error: saveError } = await apiClient.from('admin_buildings').update(updates).eq('id', existingBuilding.id);
        if (saveError) { result.errors.push('Row ' + lineNo + ': ' + saveError.message); continue; }
        result.updated.buildings++;
        result.warnings.push(`Row ${lineNo}: Building "${row.buildingName}" already exists under site "${row.siteName}" — updated`);
      }
    } else {
      const basementFloors = Number(row.basementFloors ?? 0) || 0;
      const { data: newBuilding, error: bldErr } = await apiClient
        .from('admin_buildings')
        .insert({
          site_id: site.id,
          name: row.buildingName,
          name_zh: row.buildingNameZh,
          total_floors: row.totalFloors,
          basement_floors: basementFloors,
        })
        .select()
        .maybeSingle();
      if (bldErr || !newBuilding) {
        result.errors.push(`Row ${lineNo}: Failed to create building "${row.buildingName}" — ${bldErr?.message ?? 'unknown error'}`);
      } else {
        result.warnings.push('Row ' + lineNo + ': building saved; floor generation is a separate explicit operation.');
        result.created.buildings++;
      }
    }
  }

  return result;
}
