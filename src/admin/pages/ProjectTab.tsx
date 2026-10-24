import { useState } from 'react';
import { FolderKanban, Plus, Pencil, Trash2, Search, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { useProjects, ProjectWithCount } from '../hooks/useProjects';
import { Modal, ConfirmModal } from '../components/Modal';
import { FormField, AdminInput, AdminTextarea } from '../components/FormField';
import { logAudit } from '../../lib/audit';
import { useAuth } from '../../lib/auth';
import { checkProjectLinkage } from '../hooks/useLinkageCheck';
import { Project } from '../../types';
import { useLang, useT } from '../../lib/i18n';

function localizedName(name: string, nameZh: string, lang: string): string {
  if (lang === 'en') return name;
  return nameZh || name;
}

function formatDbError(error: { message: string; code?: string; hint?: string; details?: string } | null): string {
  if (!error) return '';
  const parts: string[] = [error.message];
  if (error.code) parts.push(`[code: ${error.code}]`);
  return parts.join(' — ');
}

interface ProjectFormData {
  project_code: string;
  name: string;
  name_zh: string;
  description: string;
}

const emptyForm = (): ProjectFormData => ({ project_code: '', name: '', name_zh: '', description: '' });

function ProjectModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Project;
  onSave: (d: ProjectFormData) => Promise<string | null>;
  onClose: () => void;
}) {
  const t = useT();
  const [form, setForm] = useState<ProjectFormData>(
    initial ? { project_code: initial.project_code ?? initial.id, name: initial.name, name_zh: initial.name_zh, description: initial.description } : emptyForm()
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<ProjectFormData>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function submit() {
    if (!form.project_code.trim()) { setErrors({ project_code: t('admin_required') }); return; }
    if (!form.name.trim()) {
      setErrors({ name: t('admin_required') });
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

  const f = (k: keyof ProjectFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(p => ({ ...p, [k]: e.target.value }));
    setErrors(p => ({ ...p, [k]: undefined }));
  };

  return (
    <Modal title={initial ? t('proj_edit') : t('proj_new')} onClose={onClose}>
      <div className="space-y-4">
        {serverError && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{serverError}</span>
          </div>
        )}
        <FormField label="Project Code / 項目編碼" required error={errors.project_code}>
          <AdminInput value={form.project_code} onChange={f('project_code')} disabled={!!initial} error={!!errors.project_code} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('proj_name')} required error={errors.name}>
            <AdminInput placeholder="New Town Phase 1" value={form.name} onChange={f('name')} error={!!errors.name} />
          </FormField>
          <FormField label={t('proj_name_zh')} error={errors.name_zh}>
            <AdminInput placeholder="新市鎮一期" value={form.name_zh} onChange={f('name_zh')} />
          </FormField>
        </div>
        <FormField label={t('proj_description')}>
          <AdminTextarea rows={3} placeholder="Project description…" value={form.description} onChange={f('description')} />
        </FormField>
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

export function ProjectTab() {
  const { user } = useAuth();
  const { lang } = useLang();
  const t = useT();
  const { projects, loading, createProject, updateProject, deleteProject } = useProjects();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectWithCount | null>(null);
  const [linkageWarning, setLinkageWarning] = useState<string | null>(null);
  const [checkingDelete, setCheckingDelete] = useState(false);

  const filtered = projects
    .filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.name_zh.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => localizedName(a.name, a.name_zh, lang).localeCompare(localizedName(b.name, b.name_zh, lang)));

  async function handleCreate(d: ProjectFormData): Promise<string | null> {
    const { data, error } = await createProject(d);
    if (error) return formatDbError(error);
    if (data) {
      await logAudit({
        actorId: user?.id,
        actorEmail: user?.email ?? '',
        action: 'CREATE',
        tableName: 'projects',
        recordId: data.id,
        recordLabel: d.name,
        newData: d as unknown as Record<string, unknown>,
      });
    }
    return null;
  }

  async function handleUpdate(d: ProjectFormData): Promise<string | null> {
    if (!editTarget) return null;
    const { error } = await updateProject(editTarget.id, d);
    if (error) return formatDbError(error);
    await logAudit({
      actorId: user?.id,
      actorEmail: user?.email ?? '',
      action: 'UPDATE',
      tableName: 'projects',
      recordId: editTarget.id,
      recordLabel: d.name,
      newData: d as unknown as Record<string, unknown>,
    });
    return null;
  }

  async function handleDeleteCheck(p: ProjectWithCount) {
    setCheckingDelete(true);
    const { linked, childNames } = await checkProjectLinkage(p.id);
    setCheckingDelete(false);
    if (linked) {
      setLinkageWarning(
        `Cannot delete project "${p.name}" because it has ${childNames.length} linked site${childNames.length !== 1 ? 's' : ''}: ${childNames.slice(0, 5).join(', ')}${childNames.length > 5 ? `… and ${childNames.length - 5} more` : ''}. Please delete or reassign those sites first.`
      );
      return;
    }
    setDeleteTarget(p);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const { error } = await deleteProject(deleteTarget.id);
    if (error) {
      setLinkageWarning(formatDbError(error));
      return;
    }
    await logAudit({
      actorId: user?.id,
      actorEmail: user?.email ?? '',
      action: 'DELETE',
      tableName: 'projects',
      recordId: deleteTarget.id,
      recordLabel: deleteTarget.name,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-400/20">
            <FolderKanban size={18} className="text-cyan-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold">{t('proj_title')}</h2>
            <p className="text-gray-500 text-xs">{projects.length} project{projects.length !== 1 ? 's' : ''} registered</p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium px-3 py-2 rounded-xl transition-all"
        >
          <Plus size={13} /> {t('proj_new')}
        </button>
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

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('proj_search')}
          className="w-full bg-gray-800/60 border border-gray-700/60 text-white text-sm rounded-xl pl-9 pr-3 py-2.5 placeholder-gray-600 focus:outline-none focus:border-cyan-400/60 transition-all"
        />
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm text-center py-10">{t('admin_loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileSpreadsheet size={32} className="text-gray-700 mb-3" />
          <p className="text-gray-500 text-sm">{t('proj_no_found')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900/80 border-b border-gray-800/50">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">{t('proj_name')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">{t('proj_sites')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">{t('proj_description')}</th>
                <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">{t('bldg_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {filtered.map(p => (
                <tr key={p.id} className="bg-gray-900/40 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-200 font-medium">{localizedName(p.name, p.name_zh, lang)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-gray-300">
                      <span className="bg-gray-800/80 text-gray-400 text-xs px-2 py-0.5 rounded-full">{p.site_count ?? 0}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{p.description || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => setEditTarget(p)}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteCheck(p)}
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

      {showAdd && <ProjectModal onSave={handleCreate} onClose={() => setShowAdd(false)} />}
      {editTarget && <ProjectModal initial={editTarget} onSave={handleUpdate} onClose={() => setEditTarget(null)} />}
      {deleteTarget && (
        <ConfirmModal
          title={t('proj_delete_title')}
          message={t('proj_delete_confirm').replace('{name}', deleteTarget.name)}
          confirmLabel={t('admin_delete')}
          destructive
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
