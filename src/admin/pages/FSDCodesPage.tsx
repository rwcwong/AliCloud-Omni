import { reportApiError } from '../../lib/analytics';
import { useState, useMemo } from 'react';
import { Shield, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Search } from 'lucide-react';
import { useFsdCodes, FsdCode } from '../hooks/useFsdCodes';
import { AdminTable } from '../components/AdminTable';
import { Modal, ConfirmModal } from '../components/Modal';
import { FormField, AdminInput, AdminSelect } from '../components/FormField';
import { logAudit } from '../../lib/audit';
import { useAuth } from '../../lib/auth';
import { useT, useLang } from '../../lib/i18n';

const FREQ_LABELS: Record<string, (lang: string) => string> = {
  monthly:    l => l === 'en' ? 'Monthly' : l === 'zh-CN' ? '每月' : '每月',
  quarterly:  l => l === 'en' ? 'Quarterly' : l === 'zh-CN' ? '每季' : '每季',
  '6-monthly': l => l === 'en' ? 'Semi-Annual' : l === 'zh-CN' ? '半年' : '半年',
  annual:     l => l === 'en' ? 'Annual' : l === 'zh-CN' ? '每年' : '每年',
};

const CATEGORY_LABELS: Record<string, (lang: string) => string> = {
  pump:          l => l === 'en' ? 'Pump' : l === 'zh-CN' ? '水泵' : '水泵',
  water:         l => l === 'en' ? 'Water' : l === 'zh-CN' ? '水系統' : '水系統',
  detection:     l => l === 'en' ? 'Detection' : l === 'zh-CN' ? '探測' : '探測',
  ventilation:   l => l === 'en' ? 'Ventilation' : l === 'zh-CN' ? '通風' : '通風',
  power_interlocking: l => l === 'en' ? 'Power and Interlocking' : l === 'zh-CN' ? '电力及联动系统' : '電力及聯動系統',
  general:       l => l === 'en' ? 'General' : l === 'zh-CN' ? '通用' : '通用',
};

interface FormData {
  code: string;
  description_en: string;
  description_zh: string;
  frequency: FsdCode['frequency'];
  device_category: string;
  is_active: boolean;
}

function emptyForm(): FormData {
  return { code: '', description_en: '', description_zh: '', frequency: 'quarterly', device_category: 'general', is_active: true };
}

function FsdCodeModal({ initial, onSave, onClose }: {
  initial?: FsdCode;
  onSave: (d: FormData) => Promise<void>;
  onClose: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const [form, setForm] = useState<FormData>(initial ? {
    code: initial.code,
    description_en: initial.description_en,
    description_zh: initial.description_zh,
    frequency: initial.frequency,
    device_category: initial.device_category,
    is_active: initial.is_active,
  } : emptyForm());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  function validate() {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.code.trim()) e.code = t('admin_required');
    if (!form.description_en.trim()) e.description_en = t('admin_required');
    if (!form.description_zh.trim()) e.description_zh = t('admin_required');
    return e;
  }

  async function submit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try { await onSave(form); onClose(); }
    catch (failure) { reportApiError(failure); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={initial ? t('fsd_edit') : t('fsd_new')} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('fsd_code')} required error={errors.code}>
            <AdminInput placeholder="FSI-M01" value={form.code}
              onChange={e => { setForm(p => ({ ...p, code: e.target.value.toUpperCase() })); setErrors(p => ({ ...p, code: undefined })); }}
              error={!!errors.code} disabled={!!initial} />
          </FormField>
          <FormField label={t('fsd_frequency')} required>
            <AdminSelect value={form.frequency} onChange={e => setForm(p => ({ ...p, frequency: e.target.value as FsdCode['frequency'] }))}>
              <option value="monthly">{lang === 'en' ? 'Monthly' : lang === 'zh-CN' ? '每月' : '每月'}</option>
              <option value="quarterly">{lang === 'en' ? 'Quarterly' : lang === 'zh-CN' ? '每季' : '每季'}</option>
              <option value="6-monthly">{lang === 'en' ? 'Semi-Annual' : lang === 'zh-CN' ? '半年' : '半年'}</option>
              <option value="annual">{lang === 'en' ? 'Annual' : lang === 'zh-CN' ? '每年' : '每年'}</option>
            </AdminSelect>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('fsd_desc_en')} required error={errors.description_en}>
            <AdminInput placeholder="Monthly fire pump inspection" value={form.description_en}
              onChange={e => { setForm(p => ({ ...p, description_en: e.target.value })); setErrors(p => ({ ...p, description_en: undefined })); }}
              error={!!errors.description_en} />
          </FormField>
          <FormField label={t('fsd_desc_zh')} required error={errors.description_zh}>
            <AdminInput placeholder="每月消防泵檢查" value={form.description_zh}
              onChange={e => { setForm(p => ({ ...p, description_zh: e.target.value })); setErrors(p => ({ ...p, description_zh: undefined })); }}
              error={!!errors.description_zh} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('fsd_category')}>
            <AdminSelect value={form.device_category} onChange={e => setForm(p => ({ ...p, device_category: e.target.value }))}>
              {Object.keys(CATEGORY_LABELS).map(cat => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat](lang)}</option>
              ))}
            </AdminSelect>
          </FormField>
          <FormField label={t('fsd_active')}>
            <AdminSelect value={form.is_active ? 'true' : 'false'} onChange={e => setForm(p => ({ ...p, is_active: e.target.value === 'true' }))}>
              <option value="true">{t('admin_yes')}</option>
              <option value="false">{t('admin_no')}</option>
            </AdminSelect>
          </FormField>
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition-all">{t('admin_cancel')}</button>
          <button onClick={submit} disabled={saving} className="text-sm bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded-xl font-medium transition-all">
            {saving ? t('admin_saving') : t('admin_save')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function FSDCodesPage() {
  const t = useT();
  const { lang } = useLang();
  const { user } = useAuth();
  const { codes, loading, createCode, updateCode, deleteCode } = useFsdCodes();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FsdCode | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<FsdCode | undefined>(undefined);

  const filtered = useMemo(() => {
    if (!search.trim()) return codes;
    const q = search.toLowerCase();
    return codes.filter(c =>
      c.code.toLowerCase().includes(q) ||
      c.description_en.toLowerCase().includes(q) ||
      c.description_zh.includes(search)
    );
  }, [codes, search]);

  async function handleSave(data: FormData) {
    if (editing) {
      await updateCode(editing.id, data);
      await logAudit({ action: 'UPDATE', tableName: 'fsd_codes', recordId: editing.id, recordLabel: data.code, actorEmail: user?.email ?? '' });
    } else {
      const created = await createCode(data);
      await logAudit({ action: 'CREATE', tableName: 'fsd_codes', recordId: created.id, recordLabel: data.code, actorEmail: user?.email ?? '' });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteCode(deleteTarget.id);
    await logAudit({ action: 'DELETE', tableName: 'fsd_codes', recordId: deleteTarget.id, recordLabel: deleteTarget.code, actorEmail: user?.email ?? '' });
    setDeleteTarget(undefined);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-500 text-sm">{t('admin_loading')}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Shield size={18} className="text-cyan-400" />
            {t('fsd_title')}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{codes.length} {t('fsd_count')} · {t('fsd_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('fsd_search')}
              className="w-56 bg-gray-800/60 border border-gray-700/60 text-white text-sm rounded-xl pl-9 pr-3 py-2 placeholder-gray-600 focus:outline-none focus:border-cyan-400/60"
            />
          </div>
          <button
            onClick={() => { setEditing(undefined); setModalOpen(true); }}
            className="flex items-center gap-1.5 text-sm bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-2 rounded-xl font-medium transition-all"
          >
            <Plus size={15} /> {t('fsd_new')}
          </button>
        </div>
      </div>

      <AdminTable<FsdCode>
        columns={[
          { key: 'code', label: t('fsd_code'), width: '120px',
            render: r => <span className="font-mono text-cyan-400">{r.code}</span> },
          { key: 'description_en', label: t('fsd_desc_en'),
            render: r => <span className="text-gray-300">{r.description_en}</span> },
          { key: 'description_zh', label: t('fsd_desc_zh'),
            render: r => <span className="text-gray-300">{r.description_zh}</span> },
          { key: 'frequency', label: t('fsd_frequency'), width: '110px',
            render: r => <span className="text-gray-400 capitalize">{FREQ_LABELS[r.frequency]?.(lang) ?? r.frequency}</span> },
          { key: 'device_category', label: t('fsd_category'), width: '110px',
            render: r => <span className="text-gray-400">{CATEGORY_LABELS[r.device_category]?.(lang) ?? r.device_category}</span> },
          { key: 'is_active', label: t('fsd_active'), width: '80px',
            render: r => r.is_active
              ? <ToggleRight size={18} className="text-green-400" />
              : <ToggleLeft size={18} className="text-gray-600" /> },
          { key: 'actions', label: '', width: '80px',
            render: r => (
              <div className="flex items-center gap-1">
                <button onClick={() => { setEditing(r); setModalOpen(true); }}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all">
                  <Edit2 size={13} />
                </button>
                <button onClick={() => setDeleteTarget(r)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                  <Trash2 size={13} />
                </button>
              </div>
            ) },
        ]}
        rows={filtered}
        keyFn={r => r.id}
        emptyLabel={t('fsd_no_codes')}
      />

      {modalOpen && (
        <FsdCodeModal
          initial={editing}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditing(undefined); }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title={t('fsd_delete')}
          message={t('fsd_delete_confirm').replace('{code}', deleteTarget.code)}
          confirmLabel={t('admin_delete')}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(undefined)}
          destructive
        />
      )}
    </div>
  );
}
