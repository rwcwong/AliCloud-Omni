import { useState, useMemo } from 'react';
import { Layers, Plus, Pencil, Trash2, Search, AlertCircle, FileSpreadsheet, MapPin, Image as ImageIcon } from 'lucide-react';
import { useFloorsAdmin } from '../hooks/useFloorsAdmin';
import { useBuildings, BuildingWithRelations } from '../hooks/useBuildings';
import { useProjects } from '../hooks/useProjects';
import { useSites } from '../hooks/useSites';
import { Modal, ConfirmModal } from '../components/Modal';
import { FormField, AdminInput, AdminSelect } from '../components/FormField';
import { FloorPlanEditor } from '../components/FloorPlanEditor';
import { logAudit } from '../../lib/audit';
import { useAuth } from '../../lib/auth';
import { useLang, useT } from '../../lib/i18n';
import { Floor, Device } from '../../types';
import { useDevicesAdmin } from '../hooks/useDevicesAdmin';

function localizedName(name: string, nameZh: string, lang: string): string {
  if (lang === 'en') return name;
  return nameZh || name;
}

function formatDbError(error: { message: string; code?: string } | null): string {
  if (!error) return '';
  return error.message;
}

interface FloorFormData {
  building_id: string;
  floor_number: number;
  floor_label: string;
}

function FloorModal({
  buildings,
  initial,
  onSave,
  onClose,
}: {
  buildings: BuildingWithRelations[];
  initial?: Floor;
  onSave: (d: FloorFormData) => Promise<string | null>;
  onClose: () => void;
}) {
  const { lang } = useLang();
  const t = useT();
  const [form, setForm] = useState<FloorFormData>(
    initial
      ? { building_id: initial.building_id, floor_number: initial.floor_number, floor_label: initial.floor_label }
      : { building_id: '', floor_number: 0, floor_label: '' }
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FloorFormData, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function submit() {
    const e: Partial<Record<keyof FloorFormData, string>> = {};
    if (!form.building_id) e.building_id = t('admin_required');
    if (!form.floor_label.trim()) e.floor_label = t('admin_required');
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

  const f = (k: keyof FloorFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(p => ({ ...p, [k]: k === 'floor_number' ? Number(e.target.value) : e.target.value }));
    setErrors(p => ({ ...p, [k]: undefined }));
  };

  return (
    <Modal title={initial ? t('floor_edit') : t('floor_new')} onClose={onClose}>
      <div className="space-y-4">
        {serverError && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{serverError}</span>
          </div>
        )}
        <FormField label={t('floor_building')} required error={errors.building_id}>
          <AdminSelect value={form.building_id} onChange={f('building_id')} error={!!errors.building_id}>
            <option value="">{t('floor_select_building')}</option>
            {buildings.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </AdminSelect>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label={lang === 'en' ? 'Floor Number' : lang === 'zh-CN' ? '楼层编号' : '樓層編號'} required error={errors.floor_number}>
            <AdminInput type="number" value={form.floor_number} onChange={f('floor_number')} error={!!errors.floor_number} />
          </FormField>
          <FormField label={t('floor_label')} required error={errors.floor_label}>
            <AdminInput placeholder="G/F, 1/F, B1, R/F…" value={form.floor_label} onChange={f('floor_label')} error={!!errors.floor_label} />
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

export function FloorTab() {
  const { user } = useAuth();
  const { lang } = useLang();
  const t = useT();
  const { buildings, loading: buildingsLoading } = useBuildings();
  const { projects } = useProjects();
  const { sites } = useSites();
  const [projectFilter, setProjectFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Floor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Floor | null>(null);
  const [editorFloor, setEditorFloor] = useState<Floor | null>(null);
  const { devices: allDevices } = useDevicesAdmin();

  const filteredSites = useMemo(() => {
    return sites.filter(s => !projectFilter || s.project_id === projectFilter);
  }, [sites, projectFilter]);

  const filteredBuildings = useMemo(() => {
    return buildings.filter(b => {
      if (projectFilter && b.sites?.project_id !== projectFilter) return false;
      if (siteFilter && b.site_id !== siteFilter) return false;
      return true;
    });
  }, [buildings, projectFilter, siteFilter]);

  const selectedBuildingId = buildingFilter || filteredBuildings[0]?.id;
  const { floors, loading, createFloor, updateFloor, deleteFloor } = useFloorsAdmin(
    filteredBuildings.length <= 1 ? selectedBuildingId : buildingFilter || undefined,
  );

  const floorsWithBuilding = useMemo(() => {
    return floors.map(fl => {
      const b = buildings.find(b => b.id === fl.building_id);
      return { ...fl, buildings: b };
    });
  }, [floors, buildings]);

  const filtered = useMemo(() => {
    return floorsWithBuilding.filter(fl => {
      if (buildingFilter && fl.building_id !== buildingFilter) return false;
      if (search && !fl.floor_label.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).sort((a, b) => {
      const siteA = a.buildings?.sites?.name ?? '';
      const siteB = b.buildings?.sites?.name ?? '';
      if (siteA !== siteB) return siteA.localeCompare(siteB);
      const bldgA = a.buildings?.name ?? '';
      const bldgB = b.buildings?.name ?? '';
      if (bldgA !== bldgB) return bldgA.localeCompare(bldgB);
      return a.floor_number - b.floor_number;
    });
  }, [floorsWithBuilding, buildingFilter, search]);

  async function handleCreate(d: FloorFormData): Promise<string | null> {
    const { data, error } = await createFloor({
      building_id: d.building_id,
      floor_number: d.floor_number,
      floor_label: d.floor_label,
    } as Omit<Floor, 'id'>);
    if (error) return formatDbError(error);
    if (data) {
      await logAudit({
        actorId: user?.id,
        actorEmail: user?.email ?? '',
        action: 'CREATE',
        tableName: 'floors',
        recordId: data.id,
        recordLabel: d.floor_label,
        newData: d as unknown as Record<string, unknown>,
      });
    }
    return null;
  }

  async function handleUpdate(d: FloorFormData): Promise<string | null> {
    if (!editTarget) return null;
    const { error } = await updateFloor(editTarget.id, {
      building_id: d.building_id,
      floor_number: d.floor_number,
      floor_label: d.floor_label,
    });
    if (error) return formatDbError(error);
    await logAudit({
      actorId: user?.id,
      actorEmail: user?.email ?? '',
      action: 'UPDATE',
      tableName: 'floors',
      recordId: editTarget.id,
      recordLabel: d.floor_label,
      newData: d as unknown as Record<string, unknown>,
    });
    return null;
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const { error } = await deleteFloor(deleteTarget.id);
    if (error) return;
    await logAudit({
      actorId: user?.id,
      actorEmail: user?.email ?? '',
      action: 'DELETE',
      tableName: 'floors',
      recordId: deleteTarget.id,
      recordLabel: deleteTarget.floor_label,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-400/20">
            <Layers size={18} className="text-cyan-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold">{t('floor_title')}</h2>
            <p className="text-gray-500 text-xs">{lang === 'en' ? `${floors.length} floor${floors.length !== 1 ? 's' : ''}` : `${floors.length}${lang === 'zh-CN' ? '层' : '層'}`}{buildingFilter ? (lang === 'en' ? ' in selected building' : '') : ''}</p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium px-3 py-2 rounded-xl transition-all"
        >
          <Plus size={13} /> {t('floor_new')}
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <select
          value={projectFilter}
          onChange={e => { setProjectFilter(e.target.value); setSiteFilter(''); setBuildingFilter(''); }}
          className="bg-gray-800/60 border border-gray-700/60 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-400/60 transition-all min-w-[160px]"
        >
          <option value="">{t('all_projects')}</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={siteFilter}
          onChange={e => { setSiteFilter(e.target.value); setBuildingFilter(''); }}
          className="bg-gray-800/60 border border-gray-700/60 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-400/60 transition-all min-w-[160px]"
        >
          <option value="">{t('all_sites')}</option>
          {filteredSites.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={buildingFilter}
          onChange={e => setBuildingFilter(e.target.value)}
          className="bg-gray-800/60 border border-gray-700/60 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-400/60 transition-all min-w-[180px]"
        >
          <option value="">{t('all_buildings')}</option>
          {filteredBuildings.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('floor_search')}
            className="w-full bg-gray-800/60 border border-gray-700/60 text-white text-sm rounded-xl pl-9 pr-3 py-2.5 placeholder-gray-600 focus:outline-none focus:border-cyan-400/60 transition-all"
          />
        </div>
      </div>

      {buildingsLoading || loading ? (
        <div className="text-gray-500 text-sm text-center py-10">{t('admin_loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileSpreadsheet size={32} className="text-gray-700 mb-3" />
          <p className="text-gray-500 text-sm">{t('floor_no_found')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900/80 border-b border-gray-800/50">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">{t('site')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">{t('floor_building')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">{t('floor_floor_label')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">{lang === 'en' ? 'Floor Number' : lang === 'zh-CN' ? '楼层编号' : '樓層編號'}</th>
                <th className="text-center text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">{lang === 'en' ? 'Layout' : lang === 'zh-CN' ? '平面图' : '平面圖'}</th>
                <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">{t('bldg_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {filtered.map(fl => (
                <tr key={fl.id} className="bg-gray-900/40 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-500">{fl.buildings?.sites ? localizedName(fl.buildings.sites.name, fl.buildings.sites.name_zh ?? '', lang) : '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{fl.buildings ? localizedName(fl.buildings.name, fl.buildings.name_zh, lang) : '—'}</td>
                  <td className="px-4 py-3 text-gray-200 font-medium">{fl.floor_label}</td>
                  <td className="px-4 py-3 text-gray-400">{fl.floor_number}</td>
                  <td className="px-4 py-3 text-center">
                    {fl.image_url ? (
                      <img src={fl.image_url} alt={fl.floor_label} className="h-8 w-12 object-cover rounded border border-gray-700/50 mx-auto" />
                    ) : (
                      <ImageIcon size={14} className="text-gray-700 mx-auto" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => setEditorFloor(fl as Floor)}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                        title={lang === 'en' ? 'Open Floor Plan Editor' : lang === 'zh-CN' ? '打开平面图编辑器' : '打開平面圖編輯器'}
                      >
                        <MapPin size={13} />
                      </button>
                      <button
                        onClick={() => setEditTarget(fl)}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(fl)}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
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

      {showAdd && <FloorModal buildings={filteredBuildings} onSave={handleCreate} onClose={() => setShowAdd(false)} />}
      {editTarget && <FloorModal buildings={filteredBuildings} initial={editTarget} onSave={handleUpdate} onClose={() => setEditTarget(null)} />}
      {editorFloor && (
        <FloorPlanEditor
          floor={editorFloor}
          devices={allDevices.filter((d) => d.floor_id === editorFloor.id) as Device[]}
          onClose={() => setEditorFloor(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmModal
          title={t('floor_delete_title')}
          message={t('floor_delete_confirm').replace('{label}', deleteTarget.floor_label)}
          confirmLabel={t('admin_delete')}
          destructive
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
