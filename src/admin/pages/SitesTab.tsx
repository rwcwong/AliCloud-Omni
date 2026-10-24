import { useState, useMemo } from 'react';
import { MapPin, Plus, Pencil, Trash2, Search, AlertCircle, FileSpreadsheet, Upload, Download } from 'lucide-react';
import { useSites, SiteWithProject } from '../hooks/useSites';
import { useProjects } from '../hooks/useProjects';
import { Modal, ConfirmModal } from '../components/Modal';
import { FormField, AdminInput, AdminSelect } from '../components/FormField';
import { logAudit } from '../../lib/audit';
import { useAuth } from '../../lib/auth';
import { checkSiteLinkage } from '../hooks/useLinkageCheck';
import { parseExcelFile, processImport, downloadTemplate, ImportRow, ImportResult } from '../services/excelImport';
import { useLang, useT } from '../../lib/i18n';

function localizedName(name: string, nameZh: string, lang: string): string {
  if (lang === 'en') return name;
  return nameZh || name;
}

function formatDbError(error: { message: string; code?: string } | null): string {
  if (!error) return '';
  return error.message;
}

interface SiteFormData {
  site_code: string;
  project_id: string;
  name: string;
  name_zh: string;
  address: string;
  city: string;
  latitude: string;
  longitude: string;
  contact_email: string;
  contact_phone: string;
}

function SiteModal({
  projects,
  initial,
  onSave,
  onClose,
}: {
  projects: { id: string; name: string }[];
  initial?: SiteWithProject;
  onSave: (d: SiteFormData) => Promise<string | null>;
  onClose: () => void;
}) {
  const { lang } = useLang();
  const t = useT();
  const [form, setForm] = useState<SiteFormData>(
    initial
      ? {
          site_code: initial.site_code ?? '',
          project_id: initial.project_id ?? '',
          name: initial.name,
          name_zh: initial.name_zh,
          address: initial.address,
          city: initial.city,
          latitude: initial.latitude != null ? String(initial.latitude) : '',
          longitude: initial.longitude != null ? String(initial.longitude) : '',
          contact_email: initial.contact_email,
          contact_phone: initial.contact_phone,
        }
      : { site_code: '', project_id: '', name: '', name_zh: '', address: '', city: 'Hong Kong', latitude: '', longitude: '', contact_email: '', contact_phone: '' }
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof SiteFormData, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function submit() {
    const e: Partial<Record<keyof SiteFormData, string>> = {};
    if (!form.site_code.trim()) e.site_code = t('admin_required');
    if (!form.project_id) e.project_id = t('admin_required');
    if (!form.name.trim()) e.name = t('admin_required');
    if (!form.address.trim()) e.address = t('admin_required');
    const latVal = form.latitude.trim();
    const lngVal = form.longitude.trim();
    if (latVal && isNaN(Number(latVal))) e.latitude = 'Must be a number';
    if (lngVal && isNaN(Number(lngVal))) e.longitude = 'Must be a number';
    if ((latVal && !lngVal) || (!latVal && lngVal)) {
      if (!e.latitude) e.latitude = 'Both coordinates required together';
      if (!e.longitude) e.longitude = 'Both coordinates required together';
    }
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setSaving(true);
    setServerError(null);
    const err = await onSave(form);
    setSaving(false);
    if (err) {
      setServerError(err);
      return;
    }
    onClose();
  }

  const f = (k: keyof SiteFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(p => ({ ...p, [k]: e.target.value }));
    setErrors(p => ({ ...p, [k]: undefined }));
  };

  return (
    <Modal title={initial ? t('site_edit') : t('site_new')} onClose={onClose}>
      <div className="space-y-4">
        {serverError && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{serverError}</span>
          </div>
        )}
        <FormField label={t('site_project')} required error={errors.project_id}>
          <AdminSelect value={form.project_id} onChange={f('project_id')} error={!!errors.project_id}>
            <option value="">{t('site_select_project')}</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </AdminSelect>
        </FormField>
        <FormField label="Site Code / 站點編碼" required error={errors.site_code}>
          <AdminInput value={form.site_code} onChange={f('site_code')} error={!!errors.site_code} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('site_name')} required error={errors.name}>
            <AdminInput placeholder="Tower A" value={form.name} onChange={f('name')} error={!!errors.name} />
          </FormField>
          <FormField label={t('site_name_zh')} error={errors.name_zh}>
            <AdminInput placeholder="A座" value={form.name_zh} onChange={f('name_zh')} />
          </FormField>
        </div>
        <FormField label={t('site_address')} required error={errors.address}>
          <AdminInput placeholder="1 Example Street, Kowloon" value={form.address} onChange={f('address')} error={!!errors.address} />
        </FormField>
        <FormField label={t('site_city')}>
          <AdminInput placeholder="Hong Kong" value={form.city} onChange={f('city')} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('site_lat')} error={errors.latitude}>
            <AdminInput placeholder="22.3186" value={form.latitude} onChange={f('latitude')} error={!!errors.latitude} />
          </FormField>
          <FormField label={t('site_lng')} error={errors.longitude}>
            <AdminInput placeholder="114.2245" value={form.longitude} onChange={f('longitude')} error={!!errors.longitude} />
          </FormField>
        </div>
        <p className="text-xs text-gray-600 -mt-2">{lang === 'en' ? 'GPS coordinates are needed for the site to appear on the project map.' : lang === 'zh-CN' ? '需要GPS坐标才能在楼盘地图上显示。' : '需要GPS座標才能在樓盤地圖上顯示。'}</p>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Contact Email">
            <AdminInput type="email" placeholder="fsm@example.com" value={form.contact_email} onChange={f('contact_email')} />
          </FormField>
          <FormField label="Contact Phone">
            <AdminInput placeholder="+852 xxxx xxxx" value={form.contact_phone} onChange={f('contact_phone')} />
          </FormField>
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition-all">
            {t('admin_cancel')}
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="text-sm bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded-xl font-medium transition-all"
          >
            {saving ? t('admin_saving') : t('admin_save')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { lang } = useLang();
  const t = useT();
  const [parsedRows, setParsedRows] = useState<ImportRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    try {
      const rows = await parseExcelFile(file);
      if (rows.length === 0) {
        setParseError(t('import_no_data'));
        return;
      }
      setParsedRows(rows);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : t('import_failed'));
    }
  }

  async function handleImport() {
    if (!parsedRows) return;
    setImporting(true);
    try {
      const res = await processImport(parsedRows);
      setResult(res);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : t('import_failed_generic'));
    }
    setImporting(false);
  }

  return (
    <Modal title={t('bldg_import_excel')} onClose={onClose} width="max-w-2xl">
      <div className="space-y-4">
        {parseError && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{parseError}</span>
          </div>
        )}

        {result ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-cyan-400">{result.created.projects + result.updated.projects}</div>
                <div className="text-xs text-gray-500">{t('proj_title')}</div>
                <div className="text-xs text-gray-600 mt-1">{result.created.projects} new · {result.updated.projects} updated</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-green-400">{result.created.sites + result.updated.sites}</div>
                <div className="text-xs text-gray-500">{t('site_title')}</div>
                <div className="text-xs text-gray-600 mt-1">{result.created.sites} new · {result.updated.sites} updated</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-amber-400">{result.created.buildings + result.updated.buildings}</div>
                <div className="text-xs text-gray-500">{t('bldg_title')}</div>
                <div className="text-xs text-gray-600 mt-1">{result.created.buildings} new · {result.updated.buildings} updated</div>
              </div>
            </div>

            {result.warnings.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 max-h-40 overflow-y-auto">
                <div className="text-xs font-medium text-amber-400 mb-1.5">{t('import_warnings')} ({result.warnings.length})</div>
                {result.warnings.slice(0, 20).map((w, i) => (
                  <div key={i} className="text-xs text-amber-400/80 mb-0.5">{w}</div>
                ))}
                {result.warnings.length > 20 && (
                  <div className="text-xs text-amber-400/60 mt-1">{t('import_more_rows').replace('{n}', String(result.warnings.length - 20))}</div>
                )}
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 max-h-40 overflow-y-auto">
                <div className="text-xs font-medium text-red-400 mb-1.5">{t('import_errors')} ({result.errors.length})</div>
                {result.errors.slice(0, 20).map((w, i) => (
                  <div key={i} className="text-xs text-red-400/80 mb-0.5">{w}</div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => { onDone(); onClose(); }}
                className="text-sm bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl font-medium transition-all"
              >
                {t('import_done')}
              </button>
            </div>
          </div>
        ) : !parsedRows ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-700/50 rounded-xl p-8 text-center">
              <Upload size={28} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm mb-1">{t('import_select_excel')}</p>
              <p className="text-gray-600 text-xs mb-4">{t('import_supported')}</p>
              <label className="inline-flex items-center gap-2 bg-gray-800/60 hover:bg-gray-800 text-white text-xs font-medium px-4 py-2 rounded-xl cursor-pointer transition-all">
                <Upload size={13} /> {t('import_choose_file')}
                <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
              </label>
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <Download size={12} /> {t('import_download_tpl')}
              </button>
              <div className="text-xs text-gray-600">
                {lang === 'en' ? 'Columns: Project Name, Site Name, Building Name, Total Floors, etc.' : lang === 'zh-CN' ? '列：项目名称、楼盘名称、大厦名称、总楼层数等' : '列：項目名稱、樓盤名稱、大廈名稱、總樓層數等'}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-gray-400">
              {parsedRows.length} {t('import_rows_ready')}
            </div>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-800/50">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-900/95">
                  <tr className="border-b border-gray-800/50">
                    <th className="text-left text-gray-400 font-medium px-3 py-2">{t('bldg_project')}</th>
                    <th className="text-left text-gray-400 font-medium px-3 py-2">{t('site')}</th>
                    <th className="text-left text-gray-400 font-medium px-3 py-2">{t('bldg_building')}</th>
                    <th className="text-right text-gray-400 font-medium px-3 py-2">{t('bldg_floors')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/30">
                  {parsedRows.slice(0, 100).map((r, i) => (
                    <tr key={i} className="bg-gray-900/40">
                      <td className="px-3 py-2 text-gray-300">{r.projectName || '—'}</td>
                      <td className="px-3 py-2 text-gray-300">{r.siteName || '—'}</td>
                      <td className="px-3 py-2 text-gray-300">{r.buildingName || '—'}</td>
                      <td className="px-3 py-2 text-gray-500 text-right">{r.totalFloors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 100 && (
                <div className="text-center text-xs text-gray-600 py-2">{t('import_more_rows').replace('{n}', String(parsedRows.length - 100))}</div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setParsedRows(null)} className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition-all">
                {t('import_back')}
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="text-sm bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white px-4 py-2 rounded-xl font-medium transition-all"
              >
                {importing ? t('import_importing') : t('import_import_n').replace('{n}', String(parsedRows.length))}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function SitesTab() {
  const { user } = useAuth();
  const { lang } = useLang();
  const t = useT();
  const { sites, loading, createSite, updateSite, deleteSite } = useSites();
  const { projects } = useProjects();
  const [projectFilter, setProjectFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<SiteWithProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SiteWithProject | null>(null);
  const [linkageWarning, setLinkageWarning] = useState<string | null>(null);
  const [checkingDelete, setCheckingDelete] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const filtered = useMemo(() => {
    return sites
      .filter(s => {
        if (projectFilter && s.project_id !== projectFilter) return false;
        if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.name_zh.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        const projA = a.projects ? localizedName(a.projects.name, a.projects.name_zh ?? '', lang) : '';
        const projB = b.projects ? localizedName(b.projects.name, b.projects.name_zh ?? '', lang) : '';
        if (projA !== projB) return projA.localeCompare(projB);
        return localizedName(a.name, a.name_zh, lang).localeCompare(localizedName(b.name, b.name_zh, lang));
      });
  }, [sites, projectFilter, search, lang]);

  function toDbPayload(d: SiteFormData) {
    const lat = d.latitude.trim();
    const lng = d.longitude.trim();
    return {
      ...d,
      latitude: lat ? Number(lat) : null,
      longitude: lng ? Number(lng) : null,
    };
  }

  async function handleCreate(d: SiteFormData): Promise<string | null> {
    const payload = toDbPayload(d);
    const { data, error } = await createSite(payload);
    if (error) return formatDbError(error);
    if (data) {
      await logAudit({
        actorId: user?.id,
        actorEmail: user?.email ?? '',
        action: 'CREATE',
        tableName: 'sites',
        recordId: data.id,
        recordLabel: d.name,
        newData: payload as unknown as Record<string, unknown>,
      });
    }
    return null;
  }

  async function handleUpdate(d: SiteFormData): Promise<string | null> {
    if (!editTarget) return null;
    const payload = toDbPayload(d);
    const { error } = await updateSite(editTarget.id, payload);
    if (error) return formatDbError(error);
    await logAudit({
      actorId: user?.id,
      actorEmail: user?.email ?? '',
      action: 'UPDATE',
      tableName: 'sites',
      recordId: editTarget.id,
      recordLabel: d.name,
      newData: payload as unknown as Record<string, unknown>,
    });
    return null;
  }

  async function handleDeleteCheck(s: SiteWithProject) {
    setCheckingDelete(true);
    const { linked, childNames } = await checkSiteLinkage(s.id);
    setCheckingDelete(false);
    if (linked) {
      setLinkageWarning(
        `Cannot delete site "${s.name}" because it has ${childNames.length} linked building${childNames.length !== 1 ? 's' : ''}: ${childNames.slice(0, 5).join(', ')}${childNames.length > 5 ? `… and ${childNames.length - 5} more` : ''}. Please delete those buildings first.`
      );
      return;
    }
    setDeleteTarget(s);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const { error } = await deleteSite(deleteTarget.id);
    if (error) {
      setLinkageWarning(formatDbError(error));
      return;
    }
    await logAudit({
      actorId: user?.id,
      actorEmail: user?.email ?? '',
      action: 'DELETE',
      tableName: 'sites',
      recordId: deleteTarget.id,
      recordLabel: deleteTarget.name,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-green-500/15 border border-green-500/20">
            <MapPin size={18} className="text-green-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold">{t('site_title')}</h2>
            <p className="text-gray-500 text-xs">{t('site_subtitle')}</p>
            <p className="text-gray-600 text-xs">{sites.length} propert{sites.length !== 1 ? 'ies' : 'y'} registered</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 bg-gray-800/60 hover:bg-gray-800 text-gray-300 text-xs font-medium px-3 py-2 rounded-xl border border-gray-700/50 transition-all"
          >
            <Upload size={13} /> {t('bldg_import_excel')}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white text-xs font-medium px-3 py-2 rounded-xl transition-all"
          >
            <Plus size={13} /> {t('site_new')}
          </button>
        </div>
      </div>

      {linkageWarning && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          <span className="flex-1">{linkageWarning}</span>
          <button onClick={() => setLinkageWarning(null)} className="text-amber-400 hover:text-amber-300 leading-none">
            ✕
          </button>
        </div>
      )}

      <div className="flex gap-3">
        <select
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
          className="bg-gray-800/60 border border-gray-700/60 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-400/60 transition-all min-w-[180px]"
        >
          <option value="">{t('all_projects')}</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('site_search')}
            className="w-full bg-gray-800/60 border border-gray-700/60 text-white text-sm rounded-xl pl-9 pr-3 py-2.5 placeholder-gray-600 focus:outline-none focus:border-cyan-400/60 transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm text-center py-10">{t('admin_loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileSpreadsheet size={32} className="text-gray-700 mb-3" />
          <p className="text-gray-500 text-sm">{t('site_no_found')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900/80 border-b border-gray-800/50">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">{t('site_project')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">{t('site')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">{t('site_city')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">{t('site_address')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">{t('bldg_buildings')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">{lang === 'en' ? 'Contact Phone' : lang === 'zh-CN' ? '联系电话' : '聯絡電話'}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">GPS</th>
                <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">{t('bldg_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {filtered.map(s => (
                <tr key={s.id} className="bg-gray-900/40 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-400">{s.projects ? localizedName(s.projects.name, s.projects.name_zh ?? '', lang) : '—'}</td>
                  <td className="px-4 py-3 text-gray-200 font-medium">{localizedName(s.name, s.name_zh, lang)}</td>
                  <td className="px-4 py-3 text-gray-500">{s.city}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{s.address}</td>
                  <td className="px-4 py-3">
                    <span className="bg-gray-800/80 text-gray-400 text-xs px-2 py-0.5 rounded-full">{s.building_count ?? 0}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{s.contact_phone || '—'}</td>
                  <td className="px-4 py-3">
                    {s.latitude != null && s.longitude != null ? (
                      <span className="inline-flex items-center gap-1 text-green-400" title={`${s.latitude}, ${s.longitude}`}>
                        <MapPin size={12} /> {lang === 'en' ? 'Set' : '已設定'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-gray-600" title="No coordinates — site will not appear on the map">
                        <MapPin size={12} /> {lang === 'en' ? 'Missing' : '未設定'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => setEditTarget(s)}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteCheck(s)}
                        disabled={checkingDelete}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <SiteModal projects={projects} onSave={handleCreate} onClose={() => setShowAdd(false)} />}
      {editTarget && <SiteModal projects={projects} initial={editTarget} onSave={handleUpdate} onClose={() => setEditTarget(null)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onDone={() => {}} />}
      {deleteTarget && (
        <ConfirmModal
          title={t('site_delete_title')}
          message={t('site_delete_confirm').replace('{name}', deleteTarget.name)}
          confirmLabel={t('admin_delete')}
          destructive
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
