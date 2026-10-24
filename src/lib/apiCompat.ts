import { api, type ClientError, unsupportedApiError } from './api';
import { apiData, apiAdminData, spatialFromIds, categoryToApi } from './apiData';
import { adminRows, mutateLegacy, type QueryCondition } from './apiMutations';
export { apiData, apiAdminData, refreshApiData, notifyApiDataChanged } from './apiData';

// Existing views retain a query-shaped local view-model adapter over the documented REST API.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiRow = any;
type ApiResult<T = unknown> = { data: T | null; error: ClientError | null; count?: number | null };
const apiRoles = [
  { id: 'admin', key: 'admin', label: 'Administrator', label_zh: '管理員', sort_order: 1 },
  { id: 'executive', key: 'executive', label: 'Project Executive', label_zh: '項目主管', sort_order: 2 },
  { id: 'officer', key: 'guard', label: 'Site Officer', label_zh: '站點值班員', sort_order: 3 },
].map(role => ({ ...role, description: '', color_class: null, is_active: true, is_system: true, created_at: '', updated_at: '' }));
async function loadTable(table: string): Promise<unknown[]> {
  if (table.startsWith('admin_')) return adminRows(table);
  switch (table) {
    case 'projects': return apiData.projects(); case 'sites': return apiData.sites();
    case 'buildings': return apiData.buildings(); case 'floors': return apiData.floors();
    case 'devices': return apiData.devices(); case 'device_types': return apiData.deviceTypes();
    case 'alarm_events': return apiData.alarms(); case 'maintenance_predictions': return apiData.predictions();
    case 'floor_plan_images': return apiData.floorPlanImages(); case 'roles': return apiRoles;
    case 'maintenance_rules': return apiAdminData.maintenanceRules(); case 'fsd_codes': return apiAdminData.fsdCodes();
    // Explicitly confirmed by the user: absent contracts remain empty, with no invented endpoints.
    case 'audit_log': case 'compliance_reports': case 'control_rooms': case 'device_readings':
    case 'inspection_logs': case 'inspection_schedules': case 'pending_registrations':
    case 'simulator_state': case 'user_site_roles': return [];
    default: throw new Error(`No API v3.0 read contract for ${table}.`);
  }
}

function fieldValue(row: unknown, path: string): unknown {
  if (!row || typeof row !== 'object') return undefined;
  if (path in row) return (row as Record<string, unknown>)[path];
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, row);
}

type Filter = (row: unknown) => boolean;

class ApiQueryBuilder<TResult = ApiRow[]> implements PromiseLike<ApiResult<TResult>> {
  private filters: Filter[] = [];
  private conditions: QueryCondition[] = [];
  private orders: { column: string; ascending: boolean }[] = [];
  private maxRows: number | null = null;
  private rangeValue: [number, number] | null = null;
  private singleMode: 'none' | 'single' | 'maybeSingle' = 'none';
  private head = false;
  private wantsCount = false;
  private operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private mutationPayload: unknown = null;

  constructor(private readonly table: string) {}

  select(_columns = '*', options?: { count?: string; head?: boolean }) {
    this.head = options?.head ?? this.head;
    this.wantsCount = Boolean(options?.count) || this.wantsCount;
    return this;
  }

  insert(values: unknown) {
    this.operation = 'insert';
    this.mutationPayload = values;
    return this;
  }

  update(values: unknown) {
    this.operation = 'update';
    this.mutationPayload = values;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  upsert(values: unknown, _options?: unknown) {
    this.operation = 'upsert';
    this.mutationPayload = values;
    return this;
  }

  eq(column: string, value: unknown) {
    this.conditions.push({ column, op: 'eq', value });
    this.filters.push(row => fieldValue(row, column) === value);
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push(row => fieldValue(row, column) !== value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.conditions.push({ column, op: 'in', value: values });
    const set = new Set(values);
    this.filters.push(row => set.has(fieldValue(row, column)));
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push(row => String(fieldValue(row, column) ?? '') >= String(value ?? ''));
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    if (operator === 'is' && value === null) {
      this.filters.push(row => fieldValue(row, column) != null);
    } else {
      this.filters.push(row => fieldValue(row, column) !== value);
    }
    return this;
  }

  ilike(column: string, value: string) {
    const needle = value.replace(/%/g, '').toLowerCase();
    this.filters.push(row => String(fieldValue(row, column) ?? '').toLowerCase().includes(needle));
    return this;
  }

  or(expression: string) {
    const alternatives = expression.split(',').map(part => {
      const [column, operator, ...rest] = part.split('.');
      const value = rest.join('.');
      return (row: unknown) => operator === 'eq' && String(fieldValue(row, column)) === value;
    });
    this.filters.push(row => alternatives.some(filter => filter(row)));
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(value: number) {
    this.maxRows = value;
    return this;
  }

  range(from: number, to: number) {
    this.rangeValue = [from, to];
    return this;
  }

  single(): ApiQueryBuilder<ApiRow> {
    this.singleMode = 'single';
    return this as unknown as ApiQueryBuilder<ApiRow>;
  }

  maybeSingle(): ApiQueryBuilder<ApiRow | null> {
    this.singleMode = 'maybeSingle';
    return this as unknown as ApiQueryBuilder<ApiRow | null>;
  }

  private async execute(): Promise<ApiResult<TResult>> {
    try {
      let rows = this.operation === 'select'
        ? [...await loadTable(this.table)]
        : await mutateLegacy(this.table, this.operation, this.mutationPayload, this.conditions);
      if (this.operation === 'select') this.filters.forEach(filter => { rows = rows.filter(filter); });
      for (const order of [...this.orders].reverse()) {
        rows.sort((left, right) => {
          const a = fieldValue(left, order.column);
          const b = fieldValue(right, order.column);
          const result = String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true });
          return order.ascending ? result : -result;
        });
      }
      const count = rows.length;
      if (this.rangeValue) rows = rows.slice(this.rangeValue[0], this.rangeValue[1] + 1);
      if (this.maxRows != null) rows = rows.slice(0, this.maxRows);

      if (this.head) return { data: null, error: null, count };
      if (this.singleMode === 'single') {
        return rows.length === 1
          ? { data: rows[0] as TResult, error: null, count: this.wantsCount ? count : undefined }
          : { data: null, error: { message: 'Expected exactly one matching API record', code: 'NO_ROWS' }, count: 0 };
      }
      if (this.singleMode === 'maybeSingle') {
        if (rows.length > 1) throw new Error('Ambiguous API record selection. Specify its business code or server ID.');
        return { data: (rows[0] ?? null) as TResult, error: null, count: this.wantsCount ? count : undefined };
      }
      return { data: rows as TResult, error: null, count: this.wantsCount ? count : undefined };
    } catch (error) {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('omnios:api-error', { detail: { message: error instanceof Error ? error.message : 'API request failed' } }));
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'API request failed',
          status: typeof error === 'object' && error && 'status' in error ? Number(error.status) : undefined,
        },
      };
    }
  }

  then<TFulfilled = ApiResult<TResult>, TRejected = never>(
    onfulfilled?: ((value: ApiResult<TResult>) => TFulfilled | PromiseLike<TFulfilled>) | null,
    onrejected?: ((reason: unknown) => TRejected | PromiseLike<TRejected>) | null,
  ): PromiseLike<TFulfilled | TRejected> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

type RealtimeStatus = 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR';

class CompatibilityChannel {
  private handlers: (() => void)[] = [];
  private listener = () => this.handlers.forEach(handler => handler());
  on(...args: unknown[]) {
    const callback = args[args.length - 1];
    if (typeof callback === 'function') this.handlers.push(callback as () => void);
    return this;
  }
  subscribe(callback?: (status: RealtimeStatus) => void) {
    // This is a local invalidation listener, not a second remote realtime service.
    window.addEventListener('omnios:data-changed', this.listener);
    window.addEventListener('omnios:telemetry-changed', this.listener);
    queueMicrotask(() => callback?.('SUBSCRIBED'));
    return this;
  }
  unsubscribe() {
    window.removeEventListener('omnios:data-changed', this.listener);
    window.removeEventListener('omnios:telemetry-changed', this.listener);
    this.handlers = [];
    return Promise.resolve('ok');
  }
}

const unsupportedStorage = {
  upload: async (..._args: unknown[]) => ({ data: null, error: unsupportedApiError('floor-plan upload') }),
  remove: async (..._args: unknown[]) => ({ data: null, error: unsupportedApiError('floor-plan removal') }),
  getPublicUrl: (..._args: unknown[]) => ({ data: { publicUrl: '' } }),
};

export const apiClient = {
  auth: api.auth,
  from(table: string) {
    return new ApiQueryBuilder(table);
  },
  async rpc(name: string, args: Record<string, unknown> = {}): Promise<ApiResult<unknown>> {
    if (name !== 'get_alarm_stats') return { data: null, error: unsupportedApiError(name) };
    try {
      const range = String(args.range_label ?? '7D').toLowerCase() as '1d' | '7d' | '30d';
      const response = await api.getAlarmStatistics({
        ...spatialFromIds(args.p_project_id as string, args.p_site_id as string, args.p_building_id as string),
        time_range: range,
        category: args.p_device_category ? categoryToApi(String(args.p_device_category)) : undefined,
        severity: args.p_category ? ({ critical: 'Critical', alarm: 'Alarm', fault: 'Fault' } as const)[args.p_category as 'critical' | 'alarm' | 'fault'] : undefined,
      });
      return { error: null, data: {
        labels: response.trend.map(row => row.date), num_buckets: response.trend.length,
        total_events: response.summary.total_events, critical_count: response.summary.critical_events,
        alarm_count: response.summary.alarm_events, fault_count: response.summary.fault_events,
        // Critical is only supplied as a period total. Never distribute it into fabricated time buckets.
        buckets: response.trend.flatMap((row, index) => [
          { bucket_index: index, severity: 'alarm', count: row.alarms },
          { bucket_index: index, severity: 'fault', count: row.faults },
        ]),
      }};
    } catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : 'Statistics request failed' } }; }
  },
  channel(..._args: unknown[]) {
    return new CompatibilityChannel();
  },
  removeChannel(channel: CompatibilityChannel) {
    return channel.unsubscribe();
  },
  storage: {
    from(..._args: unknown[]) { return unsupportedStorage; },
  },
};
