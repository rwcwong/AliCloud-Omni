import { reportApiError } from '../../lib/analytics';
import { api } from '../../lib/api';
import { notifyApiDataChanged } from '../../lib/apiData';
import { useState, useMemo } from 'react';
import { Brain, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Search, Zap } from 'lucide-react';
import { useMaintenanceRules } from '../hooks/useMaintenanceRules';
import { MaintenanceRule, MaintenanceRuleType } from '../../types';
import { AdminTable } from '../components/AdminTable';
import { Modal, ConfirmModal } from '../components/Modal';
import { FormField, AdminInput, AdminSelect, AdminTextarea } from '../components/FormField';
import { logAudit } from '../../lib/audit';
import { useAuth } from '../../lib/auth';
import { useT, useLang } from '../../lib/i18n';

const RULE_TYPES: MaintenanceRuleType[] = ['Trend_Analysis', 'Threshold_Exceed', 'Degradation_Model'];

function ruleTypeLabel(type: MaintenanceRuleType, lang: string): string {
  const key = `mr_type_${type}`;
  const labels: Record<string, Record<string, string>> = {
    'mr_type_fault_count': { en: 'Recurring Fault', 'zh-TW': '重複故障', 'zh-CN': '重复故障' },
    'mr_type_value_drift': { en: 'Value Drift', 'zh-TW': '數值漂移', 'zh-CN': '数值漂移' },
    'mr_type_alarm_rate': { en: 'High Alarm Rate', 'zh-TW': '高警報頻率', 'zh-CN': '高警报频率' },
    'mr_type_offline': { en: 'Communication Loss', 'zh-TW': '通訊中斷', 'zh-CN': '通讯中断' },
    'mr_type_inspection_overdue': { en: 'Overdue Inspection', 'zh-TW': '逾期檢查', 'zh-CN': '逾期检查' },
  };
  return labels[key]?.[lang] ?? labels[key]?.['en'] ?? type;
}

const CATEGORY_OPTIONS = [
  { value: 'all', labelEn: 'All Categories', labelTw: '全部分類', labelCn: '全部分类' },
  { value: 'pump', labelEn: 'Pump', labelTw: '水泵', labelCn: '水泵' },
  { value: 'water', labelEn: 'Water', labelTw: '水系統', labelCn: '水系统' },
  { value: 'detection', labelEn: 'Detection', labelTw: '探測', labelCn: '探测' },
  { value: 'ventilation', labelEn: 'Ventilation', labelTw: '通風', labelCn: '通风' },
  { value: 'power_interlocking', labelEn: 'Power and Interlocking', labelTw: '電力及聯動系統', labelCn: '电力及联动系统' },
];

interface FormData {
  name: string;
  name_zh: string;
  rule_type: MaintenanceRuleType;
  device_category: string;
  threshold: number;
  time_window_hours: number;
  min_probability: number;
  recommendation: string;
  recommendation_zh: string;
  is_active: boolean;
}

function emptyForm(): FormData {
  return {
    name: '', name_zh: '', rule_type: 'Trend_Analysis', device_category: 'all',
    threshold: 3, time_window_hours: 168, min_probability: 0.7,
    recommendation: '', recommendation_zh: '', is_active: true,
  };
}

function RuleModal({ initial, availableTypes = [], onSave, onClose }: {
  initial?: MaintenanceRule;
  availableTypes?: string[];
  onSave: (d: FormData) => Promise<void>;
  onClose: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const [form, setForm] = useState<FormData>(initial ? {
    name: initial.name, name_zh: initial.name_zh, rule_type: initial.rule_type,
    device_category: initial.device_category, threshold: initial.threshold,
    time_window_hours: initial.time_window_hours, min_probability: initial.min_probability,
    recommendation: initial.recommendation, recommendation_zh: initial.recommendation_zh,
    is_active: initial.is_active,
  } : emptyForm());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  function validate() {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.name.trim()) e.name = t('admin_required');
    if (!form.name_zh.trim()) e.name_zh = t('admin_required');
    if (!form.recommendation.trim()) e.recommendation = t('admin_required');
    if (!form.recommendation_zh.trim()) e.recommendation_zh = t('admin_required');
    if (!Number.isFinite(form.threshold)) e.threshold = t('admin_required');
    if (form.time_window_hours < 1) e.time_window_hours = t('admin_required');
    if (form.min_probability < 0 || form.min_probability > 1) e.min_probability = t('admin_required');
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
    <Modal title={initial ? t('mr_edit') : t('mr_new')} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('mr_name')} required error={errors.name}>
            <AdminInput placeholder="Recurring Fault" value={form.name}
              onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setErrors(p => ({ ...p, name: undefined })); }}
              error={!!errors.name} />
          </FormField>
          <FormField label={t('mr_name_zh')} required error={errors.name_zh}>
            <AdminInput placeholder="重複故障" value={form.name_zh}
              onChange={e => { setForm(p => ({ ...p, name_zh: e.target.value })); setErrors(p => ({ ...p, name_zh: undefined })); }}
              error={!!errors.name_zh} />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('mr_rule_type')} required>
            <AdminSelect value={form.rule_type} onChange={e => setForm(p => ({ ...p, rule_type: e.target.value as MaintenanceRuleType }))}>
              {[...new Set([...RULE_TYPES, ...availableTypes, ...(initial ? [initial.rule_type] : [])])].map(rt => <option key={rt} value={rt}>{ruleTypeLabel(rt, lang)}</option>)}
            </AdminSelect>
          </FormField>
          <FormField label={t('mr_device_category')}>
            <AdminSelect value={form.device_category} onChange={e => setForm(p => ({ ...p, device_category: e.target.value }))}>
              {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{lang === 'en' ? c.labelEn : lang === 'zh-CN' ? c.labelCn : c.labelTw}</option>)}
            </AdminSelect>
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField label={t('mr_threshold')} required error={errors.threshold}>
            <AdminInput type="number" value={form.threshold}
              onChange={e => setForm(p => ({ ...p, threshold: parseFloat(e.target.value) || 0 }))}
              error={!!errors.threshold} />
          </FormField>
          <FormField label={t('mr_time_window')} required error={errors.time_window_hours}>
            <AdminInput type="number" value={form.time_window_hours}
              onChange={e => setForm(p => ({ ...p, time_window_hours: parseInt(e.target.value) || 0 }))}
              error={!!errors.time_window_hours} />
          </FormField>
          <FormField label={t('mr_min_probability')} required error={errors.min_probability}>
            <AdminInput type="number" step="0.05" min="0" max="1" value={form.min_probability}
              onChange={e => setForm(p => ({ ...p, min_probability: parseFloat(e.target.value) || 0 }))}
              error={!!errors.min_probability} />
          </FormField>
        </div>

        <FormField label={t('mr_recommendation')} required error={errors.recommendation}>
          <AdminTextarea placeholder="Inspect pump seals and electrical connections..." value={form.recommendation}
            onChange={e => { setForm(p => ({ ...p, recommendation: e.target.value })); setErrors(p => ({ ...p, recommendation: undefined })); }}
            error={!!errors.recommendation} rows={2} />
        </FormField>
        <FormField label={t('mr_recommendation_zh')} required error={errors.recommendation_zh}>
          <AdminTextarea placeholder="檢查泵密封及電氣連接…" value={form.recommendation_zh}
            onChange={e => { setForm(p => ({ ...p, recommendation_zh: e.target.value })); setErrors(p => ({ ...p, recommendation_zh: undefined })); }}
            error={!!errors.recommendation_zh} rows={2} />
        </FormField>

        <FormField label={t('mr_active')}>
          <AdminSelect value={form.is_active ? 'true' : 'false'} onChange={e => setForm(p => ({ ...p, is_active: e.target.value === 'true' }))}>
            <option value="true">{t('admin_yes')}</option>
            <option value="false">{t('admin_no')}</option>
          </AdminSelect>
        </FormField>

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

export function MaintenanceRulesPage() {
  const t = useT();
  const { lang } = useLang();
  const { user } = useAuth();
  const { rules, loading, createRule, updateRule, deleteRule, toggleActive } = useMaintenanceRules();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceRule | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceRule | undefined>(undefined);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return rules;
    const q = search.toLowerCase();
    return rules.filter(r =>
      r.name.toLowerCase().includes(q) || r.name_zh.includes(search)
    );
  }, [rules, search]);

  async function handleSave(data: FormData) {
    if (editing) {
      await updateRule(editing.id, data);
      await logAudit({ action: 'UPDATE', tableName: 'maintenance_rules', recordId: editing.id, recordLabel: data.name, actorEmail: user?.email ?? '' });
    } else {
      const created = await createRule(data);
      await logAudit({ action: 'CREATE', tableName: 'maintenance_rules', recordId: created.id, recordLabel: data.name, actorEmail: user?.email ?? '' });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteRule(deleteTarget.id);
    await logAudit({ action: 'DELETE', tableName: 'maintenance_rules', recordId: deleteTarget.id, recordLabel: deleteTarget.name, actorEmail: user?.email ?? '' });
    setDeleteTarget(undefined);
  }

  async function handleGenerateNow() {
    setGenerating(true);
    try {
      const result = await api.generatePredictions();
      notifyApiDataChanged();
      setToast({ type: 'success', msg: t('mr_generate_success').replace('{n}', String(result.generated_count)) });
    } catch (failure) { setToast({ type: 'error', msg: failure instanceof Error ? failure.message : 'Generation failed' }); }
    finally { setGenerating(false); }
    setTimeout(() => setToast(null), 4000);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-500 text-sm">{t('admin_loading')}</div>;
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium border transition-all ${
          toast.type === 'success' ? 'bg-green-500/20 text-green-300 border-green-500/40' :
          toast.type === 'error' ? 'bg-red-500/20 text-red-300 border-red-500/40' :
          'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Brain size={18} className="text-cyan-400" />
            {t('mr_title')}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{rules.length} {t('mr_count')} · {t('mr_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateNow}
            disabled={generating}
            className="flex items-center gap-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-3 py-2 rounded-xl font-medium transition-all"
          >
            <Zap size={15} className={generating ? 'animate-pulse' : ''} />
            {generating ? t('mr_generating') : t('mr_generate_now')}
          </button>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('mr_search')}
              className="w-52 bg-gray-800/60 border border-gray-700/60 text-white text-sm rounded-xl pl-9 pr-3 py-2 placeholder-gray-600 focus:outline-none focus:border-cyan-400/60"
            />
          </div>
          <button
            onClick={() => { setEditing(undefined); setModalOpen(true); }}
            className="flex items-center gap-1.5 text-sm bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-2 rounded-xl font-medium transition-all"
          >
            <Plus size={15} /> {t('mr_new')}
          </button>
        </div>
      </div>

      <AdminTable<MaintenanceRule>
        columns={[
          { key: 'name', label: lang === 'en' ? 'Rule Name' : t('mr_name'),
            render: r => (
              <span className="text-gray-200 font-medium">{lang === 'en' ? r.name : r.name_zh}</span>
            ) },
          { key: 'rule_type', label: t('mr_rule_type'), width: '140px',
            render: r => (
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {ruleTypeLabel(r.rule_type, lang)}
              </span>
            ) },
          { key: 'device_category', label: t('mr_device_category'), width: '120px',
            render: r => {
              const cat = CATEGORY_OPTIONS.find(c => c.value === r.device_category);
              return <span className="text-gray-400">{cat ? (lang === 'en' ? cat.labelEn : lang === 'zh-CN' ? cat.labelCn : cat.labelTw) : r.device_category}</span>;
            } },
          { key: 'threshold', label: t('mr_threshold'), width: '90px',
            render: r => <span className="text-gray-300 font-mono">{r.threshold}</span> },
          { key: 'time_window_hours', label: t('mr_time_window'), width: '120px',
            render: r => <span className="text-gray-300 font-mono">{r.time_window_hours}h</span> },
          { key: 'min_probability', label: t('mr_min_probability'), width: '110px',
            render: r => <span className="text-gray-300 font-mono">{Math.round(r.min_probability * 100)}%</span> },
          { key: 'is_active', label: t('mr_active'), width: '70px',
            render: r => (
              <button onClick={() => toggleActive(r.id, !r.is_active)} className="transition-all">
                {r.is_active
                  ? <ToggleRight size={20} className="text-green-400 hover:text-green-300" />
                  : <ToggleLeft size={20} className="text-gray-600 hover:text-gray-500" />}
              </button>
            ) },
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
        emptyLabel={t('mr_no_rules')}
      />

      {modalOpen && (
        <RuleModal
          initial={editing}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditing(undefined); }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title={t('mr_delete')}
          message={t('mr_delete_confirm').replace('{name}', deleteTarget.name)}
          confirmLabel={t('admin_delete')}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(undefined)}
          destructive
        />
      )}
    </div>
  );
}
