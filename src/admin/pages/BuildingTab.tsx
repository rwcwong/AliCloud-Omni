import { useState, useMemo } from 'react';
import { Building2, Plus, Pencil, Trash2, Search, AlertCircle, FileSpreadsheet, Upload } from 'lucide-react';
import { useBuildings, BuildingWithRelations } from '../hooks/useBuildings';
import { useProjects } from '../hooks/useProjects';
import { useSites } from '../hooks/useSites';
import { Modal, ConfirmModal } from '../components/Modal';
import { FormField, AdminInput, AdminSelect } from '../components/FormField';
import { logAudit } from '../../lib/audit';
import { useAuth } from '../../lib/auth';
import { checkBuildingLinkage } from '../hooks/useLinkageCheck';
import { parseExcelFile, processImport, downloadTemplate, ImportRow, ImportResult } from '../services/excelImport';
import { backfillMissingFloors } from '../services/floorGenerator';
import { useLang, useT } from '../../lib/i18n';
import { RefreshCw } from 'lucide-react';

function localizedName(name: string, nameZh: string, lang: string): string {
  if (lang === 'en') return name;
  return nameZh || name;
}

function formatDbError(error: { message: string; code?: string } | null): string {
  if (!error) return '';
  return error.message;
}

interface BuildingFormData {
  site_id: string;
  name: string;
  name_zh: string;
  total_floors: number;
  basement_floors: number;
}

function BuildingModal({
  sites,
  initial,
  onSave,
  onClose,
}: {
  sites: { id: string; name: string; project_id: string | null }[];
  initial?: BuildingWithRelations;
  onSave: (d: BuildingFormData) => Promise<string | null>;
  onClose: () => void;
}) {
  const t = useT();
  const [form, setForm] = useState<BuildingFormData>(
    initial
      ? { site_id: initial.site_id, name: initial.name, name_zh: initial.name_zh, total_floors: initial.total_floors, basement_floors: initial.basement_floors ?? 0 }
      : { site_id: '', name: '', name_zh: '', total_floors: 1, basement_floors: 0 }
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof BuildingFormData, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function submit() {
    const e: Partial<Record<keyof BuildingFormData, string>> = {};
    if (!form.site_id) e.site_id = t('admin_required');
    if (!form.name.trim()) e.name = t('admin_required');
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      const err = await onSave(form);
      setSaving(false);
      if (err) {
        setServerError(err);
        return;
      }
      onClose();
    } catch (err) {
      setSaving(false);
      setServerError(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  }

  const f = (k: keyof BuildingFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(p => ({ ...p, [k]: k === 'total_floors' || k === 'basement_floors' ? Number(e.target.value) : e.target.value }));
    setErrors(p => ({ ...p, [k]: undefined }));
  };

  return (
    <Modal title={initial ? t('bldg_edit') : t('bldg_new')} onClose={onClose}>
      <div className="space-y-4">
        {serverError && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{serverError}</span>
          </div>
        )}
        <FormField label={t('bldg_site')} required error={errors.site_id}>
          <AdminSelect value={form.site_id} onChange={f('site_id')} error={!!errors.site_id}>
            <option value="">{t('bldg_select_site')}</option>
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </AdminSelect>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('bldg_name_en')} required error={errors.name}>
            <AdminInput placeholder="Tower A" value={form.name} onChange={f('name')} error={!!errors.name} />
          </FormField>
          <FormField label={t('bldg_name_zh')} error={errors.name_zh}>
            <AdminInput placeholder="A座" value={form.name_zh} onChange={f('name_zh')} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('bldg_basement_floors')}>
            <AdminInput type="number" min={0} max={20} value={form.basement_floors} onChange={f('basement_floors')} />
          </FormField>
          <FormField label={t('bldg_total_floors')}>
            <AdminInput type="number" min={1} max={200} value={form.total_floors} onChange={f('total_floors')} />
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
  const t = useT();
  const { lang } = useLang();
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
                <div className="text-xs text-gray-500">Projects</div>
                <div className="text-xs text-gray-600 mt-1">{result.created.projects} new · {result.updated.projects} updated</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-green-400">{result.created.sites + result.updated.sites}</div>
                <div className="text-xs text-gray-500">{t('tab_sites')}</div>
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
                {t('import_download_tpl')}
              </button>
              <div className="text-xs text-gray-600">
                {lang === 'en' ? 'Columns: Project Name, Property Name, Building Name, Total Floors, etc.' : lang === 'zh-CN' ? '列：项目名称、楼盘名称、大厦名称、总楼层数等' : '列：項目名稱、樓盤名稱、大廈名稱、總樓層數等'}
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
                    <th className="text-left text-gray-400 font-medium px-3 py-2">{t('bldg_site')}</th>
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

export function BuildingTab() {
  const { user } = useAuth();
  const { lang } = useLang();
  const t = useT();
  const { buildings, loading, createBuilding, updateBuilding, deleteBuilding } = useBuildings();
  const { projects } = useProjects();
  const { sites } = useSites();
  const [projectFilter, setProjectFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<BuildingWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BuildingWithRelations | null>(null);
  const [linkageWarning, setLinkageWarning] = useState<string | null>(null);
  const [checkingDelete, setCheckingDelete] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);

  const filteredSites = useMemo(() => {
    return sites.filter(s => !projectFilter || s.project_id === projectFilter);
  }, [sites, projectFilter]);

  const filtered = useMemo(() => {
    return buildings
      .filter(b => {
        if (projectFilter && b.sites?.project_id !== projectFilter) return false;
        if (siteFilter && b.site_id !== siteFilter) return false;
        if (search && !b.name.toLowerCase().includes(search.toLowerCase()) && !b.name_zh.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        const projA = a.sites?.projects ? localizedName(a.sites.projects.name, a.sites.projects.name_zh ?? '', lang) : '';
        const projB = b.sites?.projects ? localizedName(b.sites.projects.name, b.sites.projects.name_zh ?? '', lang) : '';
        if (projA !== projB) return projA.localeCompare(projB);
        const siteA = a.sites ? localizedName(a.sites.name, a.sites.name_zh ?? '', lang) : '';
        const siteB = b.sites ? localizedName(b.sites.name, b.sites.name_zh ?? '', lang) : '';
        if (siteA !== siteB) return siteA.localeCompare(siteB);
        const bldgA = localizedName(a.name, a.name_zh, lang);
        const bldgB = localizedName(b.name, b.name_zh, lang);
        return bldgA.localeCompare(bldgB);
      });
  }, [buildings, projectFilter, siteFilter, search, lang]);

  async function handleCreate(d: BuildingFormData): Promise<string | null> {
    const { data, error } = await createBuilding(d);
    if (error) return formatDbError(error);
    if (data) {
      await logAudit({
        actorId: user?.id,
        actorEmail: user?.email ?? '',
        action: 'CREATE',
        tableName: 'buildings',
        recordId: data.id,
        recordLabel: d.name,
        newData: d as unknown as Record<string, unknown>,
      });
    }
    return null;
  }

  async function handleUpdate(d: BuildingFormData): Promise<string | null> {
    if (!editTarget) return null;
    const { error } = await updateBuilding(editTarget.id, d);
    if (error) return formatDbError(error);
    await logAudit({
      actorId: user?.id,
      actorEmail: user?.email ?? '',
      action: 'UPDATE',
      tableName: 'buildings',
      recordId: editTarget.id,
      recordLabel: d.name,
    });
    return null;
  }

  async function handleDeleteCheck(b: BuildingWithRelations) {
    setCheckingDelete(true);
    const { linked, childNames } = await checkBuildingLinkage(b.id);
    setCheckingDelete(false);
    if (linked) {
      setLinkageWarning(
        t('bldg_cannot_delete').replace('{name}', b.name).replace('{count}', String(childNames.length)).replace('{names}', childNames.slice(0, 5).join(', ') + (childNames.length > 5 ? `… and ${childNames.length - 5} more` : ''))
      );
      return;
    }
    setDeleteTarget(b);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const { error } = await deleteBuilding(deleteTarget.id);
    if (error) {
      setLinkageWarning(formatDbError(error));
      return;
    }
    await logAudit({
      actorId: user?.id,
      actorEmail: user?.email ?? '',
      action: 'DELETE',
      tableName: 'buildings',
      recordId: deleteTarget.id,
      recordLabel: deleteTarget.name,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/20">
            <Building2 size={18} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold">{t('bldg_title')}</h2>
            <p className="text-gray-500 text-xs">{buildings.length} {t('bldg_registered')}</p>
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
            onClick={async () => {
              if (!window.confirm(lang === 'en' ? 'Generate missing floors for ALL buildings? This is not limited to the current filter.' : '将为所有楼宇补齐缺失楼层，不限于当前筛选范围。是否继续？')) return;
              setBackfilling(true);
              setBackfillMsg(null);
              const res = await backfillMissingFloors();
              setBackfilling(false);
              if (res.errors.length > 0) {
                setBackfillMsg(t('bldg_backfill_errors').replace('{n}', String(res.backfilled)).replace('{errors}', res.errors.join('; ')));
              } else if (res.backfilled === 0) {
                setBackfillMsg(t('bldg_backfill_all_done'));
              } else {
                setBackfillMsg(t('bldg_backfill_done').replace('{n}', String(res.backfilled)));
              }
            }}
            disabled={backfilling}
            className="flex items-center gap-2 bg-gray-800/60 hover:bg-gray-800 text-gray-300 text-xs font-medium px-3 py-2 rounded-xl border border-gray-700/50 transition-all disabled:opacity-50"
          >
            <RefreshCw size={13} className={backfilling ? 'animate-spin' : ''} /> {t('bldg_gen_missing_floors')}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium px-3 py-2 rounded-xl transition-all"
          >
            <Plus size={13} /> {t('bldg_new')}
          </button>
        </div>
      </div>

      {backfillMsg && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-400 text-sm">
          <RefreshCw size={15} className="flex-shrink-0 mt-0.5" />
          <span className="flex-1">{backfillMsg}</span>
          <button onClick={() => setBackfillMsg(null)} className="text-cyan-400 hover:text-cyan-300 leading-none">✕
          </button>
        </div>
      )}

      {linkageWarning && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          <span className="flex-1">{linkageWarning}</span>
          <button onClick={() => setLinkageWarning(null)} className="text-amber-400 hover:text-amber-300 leading-none">
            ✕
          </button>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <select
          value={projectFilter}
          onChange={e => { setProjectFilter(e.target.value); setSiteFilter(''); }}
          className="bg-gray-800/60 border border-gray-700/60 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-400/60 transition-all min-w-[160px]"
        >
          <option value="">{t('all_projects')}</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={siteFilter}
          onChange={e => setSiteFilter(e.target.value)}
          className="bg-gray-800/60 border border-gray-700/60 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-400/60 transition-all min-w-[160px]"
        >
          <option value="">{t('all_sites')}</option>
          {filteredSites.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('bldg_search')}
            className="w-full bg-gray-800/60 border border-gray-700/60 text-white text-sm rounded-xl pl-9 pr-3 py-2.5 placeholder-gray-600 focus:outline-none focus:border-cyan-400/60 transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm text-center py-10">{t('admin_loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileSpreadsheet size={32} className="text-gray-700 mb-3" />
          <p className="text-gray-500 text-sm">{t('bldg_no_found')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900/80 border-b border-gray-800/50">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">{t('bldg_project')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">{t('bldg_site')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">{t('bldg_building')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">{t('bldg_basement')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">{t('bldg_floors')}</th>
                <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">{t('bldg_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {filtered.map(b => (
                <tr key={b.id} className="bg-gray-900/40 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-400">{b.sites?.projects ? localizedName(b.sites.projects.name, b.sites.projects.name_zh ?? '', lang) : '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{b.sites ? localizedName(b.sites.name, b.sites.name_zh ?? '', lang) : '—'}</td>
                  <td className="px-4 py-3 text-gray-200 font-medium">{localizedName(b.name, b.name_zh, lang)}</td>
                  <td className="px-4 py-3">
                    <span className="bg-gray-800/80 text-gray-400 text-xs px-2 py-0.5 rounded-full">{b.basement_floors ?? 0}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-gray-800/80 text-gray-400 text-xs px-2 py-0.5 rounded-full">{b.total_floors}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => setEditTarget(b)}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteCheck(b)}
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

      {showAdd && <BuildingModal sites={filteredSites} onSave={handleCreate} onClose={() => setShowAdd(false)} />}
      {editTarget && <BuildingModal sites={filteredSites} initial={editTarget} onSave={handleUpdate} onClose={() => setEditTarget(null)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onDone={() => {}} />}
      {deleteTarget && (
        <ConfirmModal
          title={t('bldg_delete_title')}
          message={t('bldg_delete_confirm').replace('{name}', deleteTarget.name)}
          confirmLabel={t('admin_delete')}
          destructive
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
