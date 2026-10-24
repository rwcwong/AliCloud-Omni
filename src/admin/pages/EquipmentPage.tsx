import { reportApiError } from '../../lib/analytics';
import { useState, useMemo } from 'react';
import { Cpu, Plus, CreditCard as Edit2, Trash2, ToggleLeft, ToggleRight, Search, ChevronDown, Upload, Download, AlertCircle, MapPin } from 'lucide-react';
import { useDevicesAdmin, DeviceWithRelations } from '../hooks/useDevicesAdmin';
import { useSites } from '../hooks/useSites';
import { useBuildings } from '../hooks/useBuildings';
import { useFloorsAdmin } from '../hooks/useFloorsAdmin';
import { useControlRooms } from '../hooks/useControlRooms';
import { useProjects } from '../hooks/useProjects';
import { AdminTable } from '../components/AdminTable';
import { Modal, ConfirmModal } from '../components/Modal';
import { FormField, AdminInput, AdminSelect, AdminTextarea } from '../components/FormField';
import { logAudit } from '../../lib/audit';
import { useAuth } from '../../lib/auth';
import { DeviceType, Device, Floor } from '../../types';
import { FloorPlanEditor } from '../components/FloorPlanEditor';
import { parseDeviceTypeExcel, processDeviceTypeImport, downloadDeviceTypeTemplate, DeviceTypeImportRow, DeviceTypeImportResult } from '../services/deviceTypesImport';
import { parseDeviceExcel, processDeviceImport, downloadDeviceTemplate, DeviceImportRow, DeviceImportResult } from '../services/devicesImport';
import { exportToExcel } from '../services/excelExport';
import { useT, useLang } from '../../lib/i18n';

const STATUS_COLORS: Record<string, string> = {
  Normal: 'text-green-400',
  Alarm: 'text-red-400',
  Fault: 'text-yellow-400',
  Offline: 'text-gray-500',
  Running: 'text-cyan-400',
};

function localizedName(name: string, nameZh: string, lang: string): string {
  if (lang === 'en') return name;
  return nameZh || name;
}

function localizedDeviceTypeName(dt: { name_en: string; name_zh: string; name_zh_tw: string }, lang: string): string {
  if (lang === 'en') return dt.name_en;
  if (lang === 'zh-CN') return dt.name_zh || dt.name_en;
  return dt.name_zh_tw || dt.name_zh || dt.name_en;
}

function translateStatus(status: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    'Normal': t('equip_normal'),
    'Alarm': t('equip_alarm'),
    'Fault': t('equip_fault'),
    'Offline': t('equip_offline'),
    'Running': t('equip_running'),
    'Power On': t('equip_power_on'),
  };
  return map[status] ?? status;
}

function translateCategory(category: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    'detection': t('equip_detection'),
    'pump': t('equip_pump'),
    'water': t('equip_water'),
    'ventilation': t('equip_ventilation'),
    'power_interlocking': t('equip_power_interlocking'),
  };
  return map[category] ?? category;
}

type EquipmentSubTab = 'devices' | 'deviceTypes';

// ─── Shared Import Modal ─────────────────────────────────
function GenericImportModal<TRow, TResult>({
  title,
  onClose,
  onDone,
  parseFile,
  processRows,
  downloadTpl,
  previewColumns,
  renderPreviewRow,
  renderResult,
}: {
  title: string;
  onClose: () => void;
  onDone: () => void;
  parseFile: (file: File) => Promise<TRow[]>;
  processRows: (rows: TRow[]) => Promise<TResult>;
  downloadTpl: () => Promise<void>;
  previewColumns: string[];
  renderPreviewRow: (row: TRow) => React.ReactNode;
  renderResult: (result: TResult) => React.ReactNode;
}) {
  const t = useT();
  const [parsedRows, setParsedRows] = useState<TRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<TResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    try {
      const rows = await parseFile(file);
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
      const res = await processRows(parsedRows);
      setResult(res);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : t('import_failed_generic'));
    }
    setImporting(false);
  }

  return (
    <Modal title={title} onClose={onClose} width="max-w-2xl">
      <div className="space-y-4">
        {parseError && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{parseError}</span>
          </div>
        )}

        {result ? (
          <div className="space-y-4">
            {renderResult(result)}
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
              <p className="text-gray-400 text-sm mb-1">{t('equip_select_excel')}</p>
              <p className="text-gray-600 text-xs mb-4">{t('equip_supported_format')}</p>
              <label className="inline-flex items-center gap-2 bg-gray-800/60 hover:bg-gray-800 text-white text-xs font-medium px-4 py-2 rounded-xl cursor-pointer transition-all">
                <Upload size={13} /> {t('equip_choose_file')}
                <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
              </label>
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={downloadTpl}
                className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <Download size={12} /> {t('equip_download_template')}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-gray-400">
              {parsedRows.length} {t('equip_rows_ready')}
            </div>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-800/50">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-900/95">
                  <tr className="border-b border-gray-800/50">
                    {previewColumns.map((col) => (
                      <th key={col} className="text-left text-gray-400 font-medium px-3 py-2">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/30">
                  {parsedRows.slice(0, 100).map((r, i) => (
                    <tr key={i} className="bg-gray-900/40">
                      {renderPreviewRow(r)}
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
                {importing ? t('equip_importing') : t('equip_import_n_rows').replace('{n}', String(parsedRows.length))}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Device Type Form Modal ──────────────────────────────
interface DeviceTypeFormData {
  code: string;
  category: DeviceType['category'];
  name_en: string;
  name_zh: string;
  name_zh_tw: string;
  priority: DeviceType['priority'];
  unit: string;
  possible_states: string;
  has_numeric_value: boolean;
}

function emptyDeviceTypeForm(): DeviceTypeFormData {
  return { code: '', category: 'detection', name_en: '', name_zh: '', name_zh_tw: '', priority: 'medium', unit: '', possible_states: 'Normal, Fault, Offline', has_numeric_value: false };
}

function DeviceTypeModal({ initial, onSave, onClose }: { initial?: DeviceType; onSave: (d: DeviceTypeFormData) => Promise<void>; onClose: () => void }) {
  const t = useT();
  const { lang } = useLang();
  const [form, setForm] = useState<DeviceTypeFormData>(initial ? {
    code: initial.code,
    category: initial.category,
    name_en: initial.name_en,
    name_zh: initial.name_zh,
    name_zh_tw: initial.name_zh_tw,
    priority: initial.priority,
    unit: initial.unit ?? '',
    possible_states: initial.possible_states.join(', '),
    has_numeric_value: initial.has_numeric_value ?? false,
  } : emptyDeviceTypeForm());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof DeviceTypeFormData, string>>>({});

  function validate() {
    const e: Partial<Record<keyof DeviceTypeFormData, string>> = {};
    if (!form.code.trim()) e.code = t('admin_required');
    if (!form.name_en.trim()) e.name_en = t('admin_required');
    if (!form.name_zh.trim()) e.name_zh = t('admin_required');
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
    <Modal title={initial ? t('equip_edit_device_type') : t('equip_add_device_type')} onClose={onClose} width="max-w-2xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('equip_code')} required error={errors.code}>
            <AdminInput placeholder="SD" value={form.code}
              onChange={e => { setForm(p => ({ ...p, code: e.target.value })); setErrors(p => ({ ...p, code: undefined })); }}
              error={!!errors.code} disabled={!!initial} />
          </FormField>
          <FormField label={t('equip_category')} required>
            <AdminSelect value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as DeviceType['category'] }))}>
              <option value="detection">Detection</option>
              <option value="pump">Pump</option>
              <option value="water">Water</option>
              <option value="ventilation">Ventilation</option>
              <option value="power_interlocking">Power and Interlocking</option>
            </AdminSelect>
          </FormField>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <FormField label={t('equip_en_name')} required error={errors.name_en}>
            <AdminInput placeholder="Smoke Detector" value={form.name_en}
              onChange={e => { setForm(p => ({ ...p, name_en: e.target.value })); setErrors(p => ({ ...p, name_en: undefined })); }}
              error={!!errors.name_en} />
          </FormField>
          <FormField label={t('equip_cn_name')} required error={errors.name_zh}>
            <AdminInput placeholder="烟感探测器" value={form.name_zh}
              onChange={e => { setForm(p => ({ ...p, name_zh: e.target.value })); setErrors(p => ({ ...p, name_zh: undefined })); }}
              error={!!errors.name_zh} />
          </FormField>
          <FormField label={t('equip_tw_name')}>
            <AdminInput placeholder="煙霧探測器" value={form.name_zh_tw}
              onChange={e => setForm(p => ({ ...p, name_zh_tw: e.target.value }))} />
          </FormField>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <FormField label={t('equip_priority')}>
            <AdminSelect value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as DeviceType['priority'] }))}>
              <option value="critical">Critical</option>
              <option value="high">{lang === 'en' ? 'High' : lang === 'zh-CN' ? '高' : '高'}</option>
              <option value="medium">{lang === 'en' ? 'Medium' : lang === 'zh-CN' ? '中' : '中'}</option>
              <option value="low">{lang === 'en' ? 'Low' : lang === 'zh-CN' ? '低' : '低'}</option>
            </AdminSelect>
          </FormField>
          <FormField label={t('equip_unit')}>
            <AdminInput placeholder="°C, ppm, Bar…" value={form.unit}
              onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} />
          </FormField>
          <FormField label={t('equip_has_numeric')}>
            <AdminSelect value={form.has_numeric_value ? 'true' : 'false'} onChange={e => setForm(p => ({ ...p, has_numeric_value: e.target.value === 'true' }))}>
              <option value="false">{t('admin_no')}</option>
              <option value="true">{t('admin_yes')}</option>
            </AdminSelect>
          </FormField>
        </div>
        <FormField label={t('equip_possible_states')}>
          <AdminInput placeholder="Normal, Alarm, Fault, Offline" value={form.possible_states}
            onChange={e => setForm(p => ({ ...p, possible_states: e.target.value }))} />
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

// ─── Device Form Modal ───────────────────────────────────
interface DeviceFormData {
  floor_id: string;
  device_type_id: string;
  code: string;
  label: string;
  serial_number: string;
  notes: string;
  position_x: number | null;
  position_y: number | null;
  control_room_id: string | null;
}

function emptyDeviceForm(): DeviceFormData {
  return { floor_id: '', device_type_id: '', code: '', label: '', serial_number: '', notes: '', position_x: null, position_y: null, control_room_id: null };
}

function DeviceModal({ initial, deviceTypes, onSave, onClose }: { initial?: DeviceWithRelations; deviceTypes: DeviceType[]; onSave: (d: DeviceFormData) => Promise<void>; onClose: () => void }) {
  const t = useT();
  const { sites } = useSites();
  const [siteId, setSiteId] = useState(initial?.floors?.buildings?.site_id ?? '');
  const [buildingId, setBuildingId] = useState(initial?.floors?.building_id ?? '');
  const { buildings } = useBuildings(siteId || undefined);
  const { floors } = useFloorsAdmin(buildingId || undefined);
  const { controlRooms } = useControlRooms(buildingId || undefined);

  const [form, setForm] = useState<DeviceFormData>(initial ? {
    floor_id: initial.floor_id,
    device_type_id: initial.device_type_id,
    code: initial.code,
    label: initial.label,
    serial_number: initial.serial_number ?? '',
    notes: initial.notes ?? '',
    position_x: initial.position_x,
    position_y: initial.position_y,
    control_room_id: initial.control_room_id ?? null,
  } : emptyDeviceForm());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof DeviceFormData, string>>>({});

  const selectedDeviceType = deviceTypes.find(dt => dt.id === form.device_type_id);
  const showControlRoom = selectedDeviceType && ['pump', 'water', 'power_interlocking'].includes(selectedDeviceType.category.toLowerCase());

  const categories = [...new Set(deviceTypes.map(dt => dt.category))];

  function validate() {
    const e: Partial<Record<keyof DeviceFormData, string>> = {};
    if (!form.code.trim()) e.code = t('admin_required');
    if (!form.label.trim()) e.label = t('admin_required');
    if (!form.floor_id) e.floor_id = t('admin_required');
    if (!form.device_type_id) e.device_type_id = t('admin_required');
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
    <Modal title={initial ? t('equip_edit_device') : t('equip_add_device')} onClose={onClose} width="max-w-2xl">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <FormField label={t('equip_type')} required error={errors.device_type_id}>
            <AdminSelect value={form.device_type_id} onChange={e => {
              const newTypeId = e.target.value;
              const newType = deviceTypes.find(dt => dt.id === newTypeId);
              const shouldKeep = newType && ['pump', 'water', 'power_interlocking'].includes(newType.category.toLowerCase());
              setForm(p => ({ ...p, device_type_id: newTypeId, control_room_id: shouldKeep ? p.control_room_id : null, floor_id: shouldKeep ? p.floor_id : '' }));
              setErrors(p => ({ ...p, device_type_id: undefined }));
            }} error={!!errors.device_type_id}>
              <option value="">{t('equip_select_type')}</option>
              {categories.map(cat => (
                <optgroup key={cat} label={translateCategory(cat, t)}>
                  {deviceTypes.filter(dt => dt.category === cat).map(dt => (
                    <option key={dt.id} value={dt.id}>{dt.name_en} ({dt.code})</option>
                  ))}
                </optgroup>
              ))}
            </AdminSelect>
          </FormField>
          <FormField label={t('users_site')} required>
            <AdminSelect value={siteId} onChange={e => { setSiteId(e.target.value); setBuildingId(''); setForm(p => ({ ...p, floor_id: '', control_room_id: null })); }}>
              <option value="">{t('equip_select_site')}</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </AdminSelect>
          </FormField>
          <FormField label={t('bldg_building')} required>
            <AdminSelect value={buildingId} onChange={e => { setBuildingId(e.target.value); setForm(p => ({ ...p, floor_id: '', control_room_id: null })); }} disabled={!siteId}>
              <option value="">{t('equip_select_building')}</option>
              {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </AdminSelect>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {showControlRoom ? (
            <FormField label={t('equip_control_room_opt')}>
              <AdminSelect
                value={form.control_room_id ?? ''}
                onChange={e => {
                  const crId = e.target.value || null;
                  const cr = controlRooms.find(r => r.id === crId);
                  setForm(p => ({ ...p, control_room_id: crId, floor_id: cr?.floors?.id ?? p.floor_id }));
                  setErrors(p => ({ ...p, floor_id: undefined }));
                }}
                disabled title="未接入数据"
              >
                <option value="">{t('admin_none')}</option>
                {controlRooms.map(cr => (
                  <option key={cr.id} value={cr.id}>{cr.name}</option>
                ))}
              </AdminSelect>
            </FormField>
          ) : (
            <div />
          )}
          <FormField label={t('floor_label')} required error={errors.floor_id}>
            <AdminSelect value={form.floor_id} onChange={e => { setForm(p => ({ ...p, floor_id: e.target.value })); setErrors(p => ({ ...p, floor_id: undefined })); }} disabled={!buildingId || !!form.control_room_id} error={!!errors.floor_id}>
              <option value="">{t('equip_select_floor')}</option>
              {floors.map(f => <option key={f.id} value={f.id}>{f.floor_label}</option>)}
            </AdminSelect>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('equip_code')} required error={errors.code}>
            <AdminInput placeholder="SD-1F-01" value={form.code}
              onChange={e => { setForm(p => ({ ...p, code: e.target.value })); setErrors(p => ({ ...p, code: undefined })); }}
              error={!!errors.code}
            />
          </FormField>
          <FormField label={t('equip_label')} required error={errors.label}>
            <AdminInput placeholder="Smoke Detector — Lobby" value={form.label}
              onChange={e => { setForm(p => ({ ...p, label: e.target.value })); setErrors(p => ({ ...p, label: undefined })); }}
              error={!!errors.label}
            />
          </FormField>
        </div>

        <FormField label={t('equip_serial_number')}>
          <AdminInput placeholder="SN-XXXXXXXX" value={form.serial_number}
            onChange={e => setForm(p => ({ ...p, serial_number: e.target.value }))} />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('equip_position_x')}>
            <AdminInput type="number" min={0} max={100} value={form.position_x ?? ''}
              onChange={e => setForm(p => ({ ...p, position_x: e.target.value === '' ? null : Number(e.target.value) }))} />
          </FormField>
          <FormField label={t('equip_position_y')}>
            <AdminInput type="number" min={0} max={100} value={form.position_y ?? ''}
              onChange={e => setForm(p => ({ ...p, position_y: e.target.value === '' ? null : Number(e.target.value) }))} />
          </FormField>
        </div>

        <FormField label={t('equip_notes')}>
          <AdminTextarea placeholder="Maintenance notes, location remarks…" rows={2} value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
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

// ─── Device Types Tab ────────────────────────────────────
function DeviceTypesTab({ deviceTypes, onCreate, onUpdate, onDelete }: {
  deviceTypes: DeviceType[];
  onCreate: (d: Omit<DeviceType, 'id'>) => Promise<void>;
  onUpdate: (id: string, d: Partial<DeviceType>) => Promise<void>;
  onDelete: (dt: DeviceType) => Promise<void>;
}) {
  const t = useT();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<DeviceType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeviceType | null>(null);
  const [showImport, setShowImport] = useState(false);

  const categories = [...new Set(deviceTypes.map(dt => dt.category))];

  const filtered = useMemo(() => {
    return deviceTypes.filter(dt => {
      if (search && !dt.code.toLowerCase().includes(search.toLowerCase()) && !dt.name_en.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategory && dt.category !== filterCategory) return false;
      return true;
    });
  }, [deviceTypes, search, filterCategory]);

  const columns = [
    { key: 'code', label: t('equip_code'), render: (dt: DeviceType) => <span className="font-mono text-xs text-gray-300">{dt.code}</span> },
    { key: 'category', label: t('equip_category'), render: (dt: DeviceType) => <span className="text-gray-400 text-xs">{translateCategory(dt.category, t)}</span> },
    { key: 'name_en', label: t('equip_en_name'), render: (dt: DeviceType) => <span className="text-gray-200 text-sm">{dt.name_en}</span> },
    { key: 'name_zh_tw', label: t('equip_tw_name'), render: (dt: DeviceType) => <span className="text-gray-500 text-xs">{dt.name_zh_tw}</span> },
    {
      key: 'priority', label: t('equip_priority'),
      render: (dt: DeviceType) => (
        <span className={`text-xs px-2 py-0.5 rounded-lg border ${dt.priority === 'high' ? 'bg-red-500/15 text-red-400 border-red-500/20' : dt.priority === 'medium' ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' : 'bg-gray-700/50 text-gray-400 border-gray-600/20'}`}>
          {dt.priority}
        </span>
      ),
    },
    { key: 'unit', label: t('equip_unit'), render: (dt: DeviceType) => <span className="text-gray-600 text-xs">{dt.unit ?? '—'}</span> },
    {
      key: 'actions', label: '', width: '80px',
      render: (dt: DeviceType) => (
        <div className="flex gap-1">
          <button onClick={() => setEditTarget(dt)} className="p-1.5 rounded-lg text-gray-600 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all">
            <Edit2 size={13} />
          </button>
          <button onClick={() => setDeleteTarget(dt)} className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  async function handleSave(d: DeviceTypeFormData) {
    const payload = {
      code: d.code,
      category: d.category,
      name_en: d.name_en,
      name_zh: d.name_zh,
      name_zh_tw: d.name_zh_tw || d.name_zh,
      priority: d.priority,
      possible_states: d.possible_states.split(',').map(s => s.trim()).filter(Boolean),
      has_numeric_value: d.has_numeric_value,
      unit: d.unit || null,
    };
    if (editTarget) {
      await onUpdate(editTarget.id, payload);
    } else {
      await onCreate(payload);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-gray-500 text-xs">{deviceTypes.length} {t('equip_device_types_count')} • {filtered.length} {t('audit_shown')}</p>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium px-3 py-2 rounded-xl border border-gray-700/50 transition-all">
            <Upload size={13} /> {t('equip_import_excel')}
          </button>
          <button onClick={() => exportToExcel('device_types.xlsx', 'Device Types', ['Code', 'Category', 'English Name', 'Chinese (CN)', 'Chinese (TW)', 'Priority', 'Unit', 'Possible States', 'Has Numeric Value'], filtered.map(dt => [dt.code, dt.category, dt.name_en, dt.name_zh, dt.name_zh_tw, dt.priority, dt.unit ?? '', dt.possible_states.join(', '), dt.has_numeric_value]))} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium px-3 py-2 rounded-xl border border-gray-700/50 transition-all">
            <Download size={13} /> {t('equip_export_excel')}
          </button>
          <button onClick={() => { setEditTarget(null); setShowAdd(true); }} className="flex items-center gap-2 bg-orange-700 hover:bg-orange-600 text-white text-xs font-medium px-3 py-2 rounded-xl transition-all">
            <Plus size={13} /> {t('equip_add_device_type')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('equip_search_code_name')}
            className="w-full bg-gray-800/60 border border-gray-700/60 text-white text-xs rounded-xl pl-8 pr-3 py-2.5 placeholder-gray-600 focus:outline-none focus:border-cyan-400/60 transition-all"
          />
        </div>
        <div className="relative">
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            className="appearance-none bg-gray-800/60 border border-gray-700/60 text-gray-300 text-xs rounded-xl px-3 py-2.5 pr-7 focus:outline-none focus:border-cyan-400/60 transition-all">
            <option value="">{t('equip_all_categories')}</option>
            {categories.map(c => <option key={c} value={c}>{translateCategory(c, t)}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
      </div>

      <AdminTable columns={columns} rows={filtered} keyFn={dt => dt.id} emptyLabel={t('equip_no_device_types')} />

      {(showAdd || editTarget) && (
        <DeviceTypeModal initial={editTarget ?? undefined} onSave={handleSave} onClose={() => { setShowAdd(false); setEditTarget(null); }} />
      )}
      {deleteTarget && (
        <ConfirmModal title={t('equip_delete_device_type')} message={t('equip_delete_dt_confirm').replace('{code}', deleteTarget.code).replace('{name}', deleteTarget.name_en)}
          confirmLabel={t('admin_delete')} destructive onConfirm={() => onDelete(deleteTarget)} onClose={() => setDeleteTarget(null)} />
      )}
      {showImport && (
        <GenericImportModal
          title={t('equip_import_excel')}
          onClose={() => setShowImport(false)}
          onDone={() => {}}
          parseFile={parseDeviceTypeExcel}
          processRows={processDeviceTypeImport}
          downloadTpl={downloadDeviceTypeTemplate}
          previewColumns={['Code', 'Category', 'Name (EN)', 'Priority']}
          renderPreviewRow={(r: DeviceTypeImportRow) => (
            <>
              <td className="px-3 py-2 text-gray-300">{r.code || '—'}</td>
              <td className="px-3 py-2 text-gray-300">{r.category || '—'}</td>
              <td className="px-3 py-2 text-gray-300">{r.name_en || '—'}</td>
              <td className="px-3 py-2 text-gray-500">{r.priority || '—'}</td>
            </>
          )}
          renderResult={(res: DeviceTypeImportResult) => (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-green-400">{res.created}</div>
                  <div className="text-xs text-gray-500">{t('equip_created')}</div>
                </div>
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-cyan-400">{res.updated}</div>
                  <div className="text-xs text-gray-500">{t('equip_updated')}</div>
                </div>
              </div>
              {res.warnings.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 max-h-40 overflow-y-auto">
                  <div className="text-xs font-medium text-amber-400 mb-1.5">{t('equip_warnings')} ({res.warnings.length})</div>
                  {res.warnings.slice(0, 20).map((w, i) => <div key={i} className="text-xs text-amber-400/80 mb-0.5">{w}</div>)}
                </div>
              )}
              {res.errors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 max-h-40 overflow-y-auto">
                  <div className="text-xs font-medium text-red-400 mb-1.5">{t('equip_errors')} ({res.errors.length})</div>
                  {res.errors.slice(0, 20).map((w, i) => <div key={i} className="text-xs text-red-400/80 mb-0.5">{w}</div>)}
                </div>
              )}
            </div>
          )}
        />
      )}
    </div>
  );
}

// ─── Devices Tab ─────────────────────────────────────────
function DevicesTab({ devices, deviceTypes, loading, onCreate, onUpdate, onToggle, onDelete }: {
  devices: DeviceWithRelations[];
  deviceTypes: DeviceType[];
  loading: boolean;
  onCreate: (d: Parameters<ReturnType<typeof useDevicesAdmin>['createDevice']>[0]) => Promise<void>;
  onUpdate: (d: Parameters<ReturnType<typeof useDevicesAdmin>['createDevice']>[0]) => Promise<void>;
  onToggle: (dev: DeviceWithRelations) => Promise<void>;
  onDelete: (dev: DeviceWithRelations) => Promise<void>;
}) {
  const t = useT();
  const { lang } = useLang();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterProject, setFilterProject] = useState('');
  const [filterSite, setFilterSite] = useState('');
  const [filterBuilding, setFilterBuilding] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<DeviceWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeviceWithRelations | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [editorFloor, setEditorFloor] = useState<(Floor & { buildings?: { id: string; name: string; sites?: { id: string; name: string } } }) | null>(null);
  const [editorHighlight, setEditorHighlight] = useState<string | undefined>(undefined);

  const categories = [...new Set(deviceTypes.map(dt => dt.category))];
  const statuses = ['Normal', 'Alarm', 'Fault', 'Offline', 'Running', 'Power On'];

  const { projects } = useProjects();
  const { sites: allSites } = useSites();
  const sitesForProject = useMemo(() =>
    filterProject ? allSites.filter(s => s.project_id === filterProject) : allSites,
  [allSites, filterProject]);
  const { buildings } = useBuildings(filterSite || undefined);

  function resetSiteAndBelow() { setFilterSite(''); setFilterBuilding(''); }
  function resetBuilding() { setFilterBuilding(''); }

  const filtered = useMemo(() => {
    return devices.filter(d => {
      if (search && !d.code.toLowerCase().includes(search.toLowerCase()) && !d.label.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategory && d.device_types?.category !== filterCategory) return false;
      if (filterStatus && d.status !== filterStatus) return false;
      if (filterActive === 'active' && d.is_active !== true) return false;
      if (filterActive === 'inactive' && d.is_active !== false) return false;
      if (filterProject && d.floors?.buildings?.sites?.project_id !== filterProject) return false;
      if (filterSite && d.floors?.buildings?.site_id !== filterSite) return false;
      if (filterBuilding && d.floors?.building_id !== filterBuilding) return false;
      return true;
    });
  }, [devices, search, filterCategory, filterStatus, filterActive, filterProject, filterSite, filterBuilding]);

  const columns = [
    {
      key: 'code', label: t('equip_code'),
      render: (d: DeviceWithRelations) => (
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${d.is_active ? 'bg-green-500' : 'bg-gray-600'}`} />
          <span className="font-mono text-xs text-gray-300">{d.code}</span>
        </div>
      ),
    },
    { key: 'label', label: t('equip_label'), render: (d: DeviceWithRelations) => <span className="text-gray-200 text-sm">{d.label}</span> },
    {
      key: 'type', label: t('equip_type'),
      render: (d: DeviceWithRelations) => (
        <div>
          <div className="text-gray-300 text-xs">{d.device_types ? localizedDeviceTypeName(d.device_types, lang) : '—'}</div>
          <div className="text-gray-600 text-xs font-mono">{d.device_types ? translateCategory(d.device_types.category, t) : ''}</div>
        </div>
      ),
    },
    {
      key: 'location', label: t('equip_location'),
      render: (d: DeviceWithRelations) => {
        const siteName = d.floors?.buildings?.sites ? localizedName(d.floors.buildings.sites.name, d.floors.buildings.sites.name_zh ?? '', lang) : undefined;
        const buildingName = d.floors?.buildings ? localizedName(d.floors.buildings.name, d.floors.buildings.name_zh ?? '', lang) : undefined;
        const firstLine = [siteName, buildingName].filter(Boolean).join(' / ') || '—';
        const floorLabel = d.floors?.floor_label ?? '—';
        const crName = d.control_rooms?.name;
        return (
          <div className="text-xs">
            <div className="text-gray-400">{firstLine}</div>
            <div className="text-gray-600">{crName ? `${floorLabel} — ${crName}` : floorLabel}</div>
          </div>
        );
      },
    },
    {
      key: 'status', label: t('equip_status'),
      render: (d: DeviceWithRelations) => (
        <span className={`text-xs font-medium ${STATUS_COLORS[d.status] ?? 'text-gray-400'}`}>{translateStatus(d.status, t)}</span>
      ),
    },
    {
      key: 'actions', label: '', width: '140px',
      render: (d: DeviceWithRelations) => (
        <div className="flex gap-1">
          <button onClick={() => {
            if (d.floors) {
              setEditorFloor(d.floors as unknown as (Floor & { buildings?: { id: string; name: string; sites?: { id: string; name: string } } }));
              setEditorHighlight(d.id);
            }
          }} className="p-1.5 rounded-lg text-gray-600 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all" title={t('equip_position_map')}>
            <MapPin size={13} />
          </button>
          <button disabled title="未接入数据" onClick={() => onToggle(d)}
            className={`p-1.5 rounded-lg transition-all ${d.is_active ? 'text-green-400 hover:bg-green-500/10' : 'text-gray-600 hover:bg-gray-700'}`}>
            {d.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          </button>
          <button onClick={() => setEditTarget(d)} className="p-1.5 rounded-lg text-gray-600 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all">
            <Edit2 size={13} />
          </button>
          <button onClick={() => setDeleteTarget(d)} className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-gray-500 text-xs">{devices.length} {t('equip_devices_count')} • {filtered.length} {t('audit_shown')}</p>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium px-3 py-2 rounded-xl border border-gray-700/50 transition-all">
            <Upload size={13} /> {t('equip_import_excel')}
          </button>
          <button onClick={() => exportToExcel('devices.xlsx', 'Devices', ['Code', 'Label', 'Device Type', 'Category', 'Site', 'Building', 'Floor', 'Control Room', 'Status', 'Active', 'Serial Number', 'Position X', 'Position Y', 'Notes'], filtered.map(d => [d.code, d.label, d.device_types?.name_en ?? '', d.device_types?.category ?? '', d.floors?.buildings?.sites?.name ?? '', d.floors?.buildings?.name ?? '', d.floors?.floor_label ?? '', d.control_rooms?.name ?? '', d.status, d.is_active === undefined ? '' : d.is_active ? 'Yes' : 'No', d.serial_number ?? '', d.position_x, d.position_y, d.notes ?? '']))} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium px-3 py-2 rounded-xl border border-gray-700/50 transition-all">
            <Download size={13} /> {t('equip_export_excel')}
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-orange-700 hover:bg-orange-600 text-white text-xs font-medium px-3 py-2 rounded-xl transition-all">
            <Plus size={13} /> {t('equip_add_device')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('equip_search_code_label')}
            className="w-full bg-gray-800/60 border border-gray-700/60 text-white text-xs rounded-xl pl-8 pr-3 py-2.5 placeholder-gray-600 focus:outline-none focus:border-cyan-400/60 transition-all"
          />
        </div>
        <div className="relative">
          <select value={filterProject} onChange={e => { setFilterProject(e.target.value); resetSiteAndBelow(); }}
            className="appearance-none bg-gray-800/60 border border-gray-700/60 text-gray-300 text-xs rounded-xl px-3 py-2.5 pr-7 focus:outline-none focus:border-cyan-400/60 transition-all">
            <option value="">{t('equip_all_projects')}</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={filterSite} onChange={e => { setFilterSite(e.target.value); resetBuilding(); }} disabled={!filterProject}
            className="appearance-none bg-gray-800/60 border border-gray-700/60 text-gray-300 text-xs rounded-xl px-3 py-2.5 pr-7 focus:outline-none focus:border-cyan-400/60 transition-all disabled:opacity-40">
            <option value="">{t('equip_all_sites')}</option>
            {sitesForProject.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={filterBuilding} onChange={e => setFilterBuilding(e.target.value)} disabled={!filterSite}
            className="appearance-none bg-gray-800/60 border border-gray-700/60 text-gray-300 text-xs rounded-xl px-3 py-2.5 pr-7 focus:outline-none focus:border-cyan-400/60 transition-all disabled:opacity-40">
            <option value="">{t('equip_all_buildings')}</option>
            {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            className="appearance-none bg-gray-800/60 border border-gray-700/60 text-gray-300 text-xs rounded-xl px-3 py-2.5 pr-7 focus:outline-none focus:border-cyan-400/60 transition-all">
            <option value="">{t('equip_all_categories')}</option>
            {categories.map(c => <option key={c} value={c}>{translateCategory(c, t)}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="appearance-none bg-gray-800/60 border border-gray-700/60 text-gray-300 text-xs rounded-xl px-3 py-2.5 pr-7 focus:outline-none focus:border-cyan-400/60 transition-all">
            <option value="">{t('equip_all_statuses')}</option>
            {statuses.map(s => <option key={s} value={s}>{translateStatus(s, t)}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
        <div className="relative">
          <select disabled title="未接入数据" value={filterActive} onChange={e => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
            className="appearance-none bg-gray-800/60 border border-gray-700/60 text-gray-300 text-xs rounded-xl px-3 py-2.5 pr-7 focus:outline-none focus:border-cyan-400/60 transition-all">
            <option value="all">{t('equip_active_inactive')}</option>
            <option value="active">{t('equip_active_only')}</option>
            <option value="inactive">{t('equip_inactive_only')}</option>
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm text-center py-10">{t('admin_loading')}</div>
      ) : (
        <AdminTable columns={columns} rows={filtered} keyFn={d => d.id} emptyLabel={t('equip_no_devices')} />
      )}

      {showAdd && (
        <DeviceModal deviceTypes={deviceTypes} onSave={onCreate} onClose={() => setShowAdd(false)} />
      )}
      {editTarget && (
        <DeviceModal initial={editTarget} deviceTypes={deviceTypes} onSave={onUpdate} onClose={() => setEditTarget(null)} />
      )}
      {deleteTarget && (
        <ConfirmModal title={t('equip_delete_device')} message={t('equip_delete_device_confirm').replace('{code}', deleteTarget.code).replace('{label}', deleteTarget.label)}
          confirmLabel={t('admin_delete')} destructive onConfirm={() => onDelete(deleteTarget)} onClose={() => setDeleteTarget(null)} />
      )}
      {editorFloor && (
        <FloorPlanEditor
          floor={editorFloor}
          devices={devices.filter(dd => dd.floor_id === editorFloor.id) as unknown as Device[]}
          highlightDeviceId={editorHighlight}
          onClose={() => { setEditorFloor(null); setEditorHighlight(undefined); }}
        />
      )}
      {showImport && (
        <GenericImportModal
          title={t('equip_import_excel')}
          onClose={() => setShowImport(false)}
          onDone={() => {}}
          parseFile={parseDeviceExcel}
          processRows={processDeviceImport}
          downloadTpl={downloadDeviceTemplate}
          previewColumns={['Code', 'Label', 'Type Code', 'Site', 'Building', 'Floor']}
          renderPreviewRow={(r: DeviceImportRow) => (
            <>
              <td className="px-3 py-2 text-gray-300">{r.code || '—'}</td>
              <td className="px-3 py-2 text-gray-300">{r.label || '—'}</td>
              <td className="px-3 py-2 text-gray-500">{r.device_type_code || '—'}</td>
              <td className="px-3 py-2 text-gray-500">{r.site_name || '—'}</td>
              <td className="px-3 py-2 text-gray-500">{r.building_name || '—'}</td>
              <td className="px-3 py-2 text-gray-500">{r.floor_label || '—'}</td>
            </>
          )}
          renderResult={(res: DeviceImportResult) => (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-green-400">{res.created}</div>
                  <div className="text-xs text-gray-500">{t('equip_created')}</div>
                </div>
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-cyan-400">{res.updated}</div>
                  <div className="text-xs text-gray-500">{t('equip_updated')}</div>
                </div>
              </div>
              {res.warnings.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 max-h-40 overflow-y-auto">
                  <div className="text-xs font-medium text-amber-400 mb-1.5">{t('equip_warnings')} ({res.warnings.length})</div>
                  {res.warnings.slice(0, 20).map((w, i) => <div key={i} className="text-xs text-amber-400/80 mb-0.5">{w}</div>)}
                </div>
              )}
              {res.errors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 max-h-40 overflow-y-auto">
                  <div className="text-xs font-medium text-red-400 mb-1.5">{t('equip_errors')} ({res.errors.length})</div>
                  {res.errors.slice(0, 20).map((w, i) => <div key={i} className="text-xs text-red-400/80 mb-0.5">{w}</div>)}
                </div>
              )}
            </div>
          )}
        />
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────
export function EquipmentPage() {
  const t = useT();
  const { user } = useAuth();
  const { devices, deviceTypes, loading, createDevice, updateDevice, toggleActive, deleteDevice, createDeviceType, updateDeviceType, deleteDeviceType } = useDevicesAdmin();
  const [subTab, setSubTab] = useState<EquipmentSubTab>('devices');

  async function handleCreateDevice(d: Parameters<typeof createDevice>[0]) {
    const { data, error } = await createDevice(d);
    if (error) throw new Error(error.message);
    if (data) await logAudit({ actorId: user?.id, actorEmail: user?.email ?? '', action: 'CREATE', tableName: 'devices', recordId: (data as { id: string }).id, recordLabel: d.code, newData: d as unknown as Record<string, unknown> });
  }

  async function handleUpdateDevice(d: Parameters<typeof createDevice>[0]) {
    const target = devices.find(dev => dev.code === d.code);
    if (!target) throw new Error('The selected device is no longer available. Reload before saving.');
    const { error } = await updateDevice(target.id, d);
    if (error) throw new Error(error.message);
    await logAudit({ actorId: user?.id, actorEmail: user?.email ?? '', action: 'UPDATE', tableName: 'devices', recordId: target.id, recordLabel: d.code });
  }

  async function handleToggleDevice(dev: DeviceWithRelations) {
    const { error } = await toggleActive(dev.id, !dev.is_active);
    if (error) throw new Error(error.message);
    await logAudit({ actorId: user?.id, actorEmail: user?.email ?? '', action: 'TOGGLE', tableName: 'devices', recordId: dev.id, recordLabel: dev.code, newData: { is_active: !dev.is_active } });
  }

  async function handleDeleteDevice(dev: DeviceWithRelations) {
    const { error } = await deleteDevice(dev.id);
    if (error) throw new Error(error.message);
    await logAudit({ actorId: user?.id, actorEmail: user?.email ?? '', action: 'DELETE', tableName: 'devices', recordId: dev.id, recordLabel: dev.code });
  }

  async function handleCreateDeviceType(d: Omit<DeviceType, 'id'>) {
    const { data, error } = await createDeviceType(d);
    if (error) throw new Error(error.message);
    if (data) await logAudit({ actorId: user?.id, actorEmail: user?.email ?? '', action: 'CREATE', tableName: 'device_types', recordId: (data as { id: string }).id, recordLabel: d.code, newData: d as unknown as Record<string, unknown> });
  }

  async function handleUpdateDeviceType(id: string, d: Partial<DeviceType>) {
    const { error } = await updateDeviceType(id, d);
    if (error) throw new Error(error.message);
    await logAudit({ actorId: user?.id, actorEmail: user?.email ?? '', action: 'UPDATE', tableName: 'device_types', recordId: id, newData: d as unknown as Record<string, unknown> });
  }

  async function handleDeleteDeviceType(dt: DeviceType) {
    const { error } = await deleteDeviceType(dt.id);
    if (error) throw new Error(error.message);
    await logAudit({ actorId: user?.id, actorEmail: user?.email ?? '', action: 'DELETE', tableName: 'device_types', recordId: dt.id, recordLabel: dt.code });
  }

  const subTabs: { id: EquipmentSubTab; label: string }[] = [
    { id: 'devices', label: t('equip_devices') },
    { id: 'deviceTypes', label: t('equip_device_types') },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-orange-500/15 border border-orange-500/20">
          <Cpu size={18} className="text-orange-400" />
        </div>
        <div>
          <h2 className="text-white font-semibold">{t('equip_title')}</h2>
          <p className="text-gray-500 text-xs">{t('equip_subtitle')}</p>
        </div>
      </div>

      {/* Sub-tab switcher */}
      <div className="flex gap-1 border-b border-gray-800/50">
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
              subTab === tab.id
                ? 'text-orange-400 border-orange-500'
                : 'text-gray-500 border-transparent hover:text-gray-300 hover:border-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'devices' ? (
        <DevicesTab
          devices={devices}
          deviceTypes={deviceTypes}
          loading={loading}
          onCreate={handleCreateDevice}
          onUpdate={handleUpdateDevice}
          onToggle={handleToggleDevice}
          onDelete={handleDeleteDevice}
        />
      ) : (
        <DeviceTypesTab
          deviceTypes={deviceTypes}
          onCreate={handleCreateDeviceType}
          onUpdate={handleUpdateDeviceType}
          onDelete={handleDeleteDeviceType}
        />
      )}
    </div>
  );
}
