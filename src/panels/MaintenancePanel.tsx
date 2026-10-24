import { api } from '../lib/api';
import { notifyApiDataChanged } from '../lib/apiData';
import { useState, useMemo } from 'react';
import { CheckCircle, XCircle, Brain, Zap, Wrench, Tag, ChevronDown } from 'lucide-react';
import { usePredictions } from '../hooks/usePredictions';
import { MaintenancePrediction } from '../types';
import { useT, useLang } from '../lib/i18n';
import { useAuth } from '../lib/auth';

function PredictionCard({ p, onResolve, onIgnore, onStartWork, compact }: {
  p: MaintenancePrediction;
  onResolve: () => void;
  onIgnore: () => void;
  onStartWork: () => void;
  compact?: boolean;
}) {
  const t = useT();
  const { lang } = useLang();
  const pct = Math.round(p.fault_probability * 100);
  const barColor = pct > 70 ? '#ef4444' : pct > 40 ? '#eab308' : '#22c55e';
  const rec = lang === 'en' ? p.recommendation : p.recommendation_zh;
  const device = p.devices;

  const statusStyle: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
    ignored: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  return (
    <div className={`bg-gray-800/50 border rounded-lg p-3 transition-all ${p.status === 'pending' ? 'border-gray-700/50' : p.status === 'in_progress' ? 'border-blue-500/30' : 'border-gray-700/20 opacity-60'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-white truncate">{p.prediction_type}</div>
          <div className="text-xs text-gray-400 truncate">{device?.code ?? p.device_id} · {device?.floors?.floor_label ?? p.floor_name} · {device?.floors?.buildings?.name ?? p.building_name}</div>
        </div>
        <span className={`text-xs px-1.5 py-0.5 rounded border flex-shrink-0 ${statusStyle[p.status] ?? statusStyle.pending}`}>
          {t(p.status === 'in_progress' ? 'mp_in_progress' : p.status)}
        </span>
      </div>

      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-400">{t('fault_probability')}</span>
          <span className="font-bold" style={{ color: barColor }}>{pct}%</span>
        </div>
        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor }} />
        </div>
      </div>

      {!compact && (
        <p className="text-xs text-gray-400 mb-2 leading-relaxed">{rec}</p>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {p.predicted_failure_date && (
            <span className="text-xs text-gray-500 flex-shrink-0">{t('predicted_failure')}: {p.predicted_failure_date}</span>
          )}
        </div>
        {p.status === 'pending' && (
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={onStartWork} className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors">
              <Wrench size={10} />{t('mp_start_work')}
            </button>
            <button onClick={onResolve} className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors">
              <CheckCircle size={10} />{t('mark_resolved')}
            </button>
            <button onClick={onIgnore} className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-600/50 text-gray-400 hover:bg-gray-600 transition-colors">
              <XCircle size={10} />{t('mark_ignored')}
            </button>
          </div>
        )}
        {p.status === 'in_progress' && (
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={onResolve} className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors">
              <CheckCircle size={10} />{t('mark_resolved')}
            </button>
            <button onClick={onIgnore} className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-600/50 text-gray-400 hover:bg-gray-600 transition-colors">
              <XCircle size={10} />{t('mark_ignored')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_FILTERS: { key: string; labelKey: string; color: string }[] = [
  { key: 'all', labelKey: 'mp_all', color: 'text-gray-300' },
  { key: 'pending', labelKey: 'mp_pending', color: 'text-yellow-400' },
  { key: 'in_progress', labelKey: 'mp_in_progress', color: 'text-blue-400' },
  { key: 'resolved', labelKey: 'mp_resolved', color: 'text-green-400' },
  { key: 'ignored', labelKey: 'mp_ignored', color: 'text-gray-400' },
];

export function MaintenancePanel({ compact = false, buildingId, hideHeader = false, initialStatus }: { compact?: boolean; buildingId?: string; hideHeader?: boolean; initialStatus?: string }) {
  const t = useT();
  const { lang } = useLang();
  const { role } = useAuth();
  const { predictions, loading, updateStatus } = usePredictions(buildingId);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus ?? 'all');
  const [ruleFilter, setRuleFilter] = useState<string>('all');
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);

  const ruleNames = useMemo(() => {
    const names = Array.from(new Set(predictions.map(p => p.prediction_type))).sort();
    return names;
  }, [predictions]);

  const canGenerate = role === 'admin' || role === 'system_admin';

  async function handleGenerateNow() {
    setGenerating(true);
    try {
      const result = await api.generatePredictions();
      notifyApiDataChanged();
      setToast({ type: 'success', msg: t('mp_generate_success').replace('{n}', String(result.generated_count)) });
    } catch (failure) { setToast({ type: 'error', msg: failure instanceof Error ? failure.message : 'Generation failed' }); }
    finally { setGenerating(false); }
    setTimeout(() => setToast(null), 4000);
  }

  async function handleStatus(id: string, status: 'pending' | 'in_progress' | 'resolved' | 'ignored') {
    try { await updateStatus(id, status); }
    catch (failure) { setToast({ type: 'error', msg: failure instanceof Error ? failure.message : 'Update failed' }); }
  }
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: predictions.length, pending: 0, in_progress: 0, resolved: 0, ignored: 0 };
    for (const p of predictions) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [predictions]);

  const filtered = useMemo(() => {
    return predictions.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (ruleFilter !== 'all' && p.prediction_type !== ruleFilter) return false;
      return true;
    });
  }, [predictions, statusFilter, ruleFilter]);

  const grouped = useMemo(() => {
    const groups: { labelKey: string; color: string; borderColor: string; items: MaintenancePrediction[] }[] = [
      { labelKey: 'mp_critical', color: 'text-red-400', borderColor: 'border-red-500/30', items: [] },
      { labelKey: 'mp_warning', color: 'text-yellow-400', borderColor: 'border-yellow-500/30', items: [] },
      { labelKey: 'mp_low', color: 'text-green-400', borderColor: 'border-green-500/30', items: [] },
    ];
    for (const p of filtered) {
      const pct = Math.round(p.fault_probability * 100);
      if (pct > 70) groups[0].items.push(p);
      else if (pct >= 40) groups[1].items.push(p);
      else groups[2].items.push(p);
    }
    return groups;
  }, [filtered]);

  return (
    <div className="flex flex-col h-full">
      {toast && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium border transition-all ${
          toast.type === 'success' ? 'bg-green-500/20 text-green-300 border-green-500/40' :
          toast.type === 'error' ? 'bg-red-500/20 text-red-300 border-red-500/40' :
          'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
        }`}>
          {toast.msg}
        </div>
      )}

      {!hideHeader && (
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Brain size={14} className="text-emerald-400" />
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{t('ai_maintenance')}</span>
            {counts.pending > 0 && (
              <span className="bg-yellow-500/20 text-yellow-400 text-xs rounded-full px-1.5 py-0.5 border border-yellow-500/30">
                {counts.pending}
              </span>
            )}
          </div>
          {canGenerate && (
            <button
              onClick={handleGenerateNow}
              disabled={generating}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white transition-all"
            >
              <Zap size={11} className={generating ? 'animate-pulse' : ''} />
              {generating ? t('mp_generating') : t('mp_generate_now')}
            </button>
          )}
        </div>
      )}

      {!compact && (
        <div className="space-y-2 mb-3 flex-shrink-0">
          <div className="flex items-center gap-1 flex-wrap">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all ${
                  statusFilter === f.key
                    ? 'border-cyan-400/50 bg-cyan-500/10 text-white'
                    : 'border-gray-700/30 text-gray-400 hover:text-white hover:bg-gray-700/20'
                }`}
              >
                <span className={f.color}>{t(f.labelKey)}</span>
                <span className="text-gray-500">({counts[f.key] ?? 0})</span>
              </button>
            ))}
          </div>
          {ruleNames.length > 0 && (
            <div className="flex items-center gap-2">
              <Tag size={11} className="text-gray-500 flex-shrink-0" />
              <span className="text-xs text-gray-500 flex-shrink-0">{t('mp_rule_filter')}:</span>
              <div className="relative">
                <select
                  value={ruleFilter}
                  onChange={e => setRuleFilter(e.target.value)}
                  className="appearance-none text-xs bg-gray-800/70 border border-gray-700/60 text-gray-300 rounded-lg pl-2.5 pr-6 py-1 focus:outline-none focus:border-cyan-400/60 cursor-pointer"
                >
                  <option value="all">{t('mp_all_rules')}</option>
                  {ruleNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <ChevronDown size={11} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500" />
              </div>
              {ruleFilter !== 'all' && (
                <button
                  onClick={() => setRuleFilter('all')}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors underline"
                >
                  {t('mp_all_rules')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
        {loading ? (
          <div className="text-gray-500 text-sm text-center py-8">{lang === 'en' ? 'Loading...' : lang === 'zh-CN' ? '加载中...' : '載入中...'}</div>
        ) : filtered.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-8">{t('no_predictions')}</div>
        ) : compact ? (
          filtered.map(p => (
            <PredictionCard
              key={p.id}
              p={p}
              compact
              onStartWork={() => handleStatus(p.id, 'in_progress')}
              onResolve={() => handleStatus(p.id, 'resolved')}
              onIgnore={() => handleStatus(p.id, 'ignored')}
            />
          ))
        ) : (
          grouped.map(group => group.items.length > 0 && (
            <div key={group.labelKey}>
              <div className={`flex items-center gap-2 mb-2 border-b ${group.borderColor} pb-1`}>
                <span className={`text-xs font-semibold uppercase tracking-wider ${group.color}`}>{t(group.labelKey)}</span>
                <span className="text-xs text-gray-500">({group.items.length})</span>
              </div>
              <div className="space-y-2">
                {group.items.map(p => (
                  <PredictionCard
                    key={p.id}
                    p={p}
                    onStartWork={() => handleStatus(p.id, 'in_progress')}
                    onResolve={() => handleStatus(p.id, 'resolved')}
                    onIgnore={() => handleStatus(p.id, 'ignored')}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
