import type {
  BuildingDetailResponse,
  CreateUserRequest,
  CreateUserResponse,
  DeviceSnapshot,
  LoginRequest,
  LoginResponse,
  ProjectSitesResponse,
  ProjectsSummaryResponse,
  SiteBuildingsResponse,
  SnapshotFilters,
  ApiUserInfo,
  AlarmFilters, ApiAlarm, AlarmAction, Paginated, PredictionFilters, PredictionsResponse,
  ApiPredictionStatus, SpatialFilters, TrendDevice, DeviceTrendsResponse, TrendRange,
  StatisticsFilters, AlarmStatisticsResponse, AdminResource, AdminResourceRows,
  AdminFilters, MutationResponse,
  ApiManagedUser, DeleteUserResponse, ManagedUsersFilters,
} from '../api/types';

// Use same-origin paths by default. The deployed API currently emits duplicate
// CORS allow-origin headers, and its HTTP endpoints are also blocked from an
// HTTPS page as mixed content. Vite proxies these paths during local work; a
// production web server should proxy the same paths (documented in README).
const DEFAULT_API_BASE_URL = '';
const SESSION_STORAGE_KEY = 'omnios-api-session-v2';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');

function sameOriginWebSocketUrl(path: string): string {
  if (typeof window === 'undefined') return `ws://localhost${path}`;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}

export const API_WEBSOCKET_URLS = [
  import.meta.env.VITE_API_WS_NODE_1 || sameOriginWebSocketUrl('/omnios-ws-node-1/api/v1/ws/iot-stream'),
  import.meta.env.VITE_API_WS_NODE_2 || sameOriginWebSocketUrl('/omnios-ws-node-2/api/v1/ws/iot-stream'),
].filter((value, index, values) => value && values.indexOf(value) === index);

export interface ApiUser {
  id: string;
  email: string;
  role: string;
  user_metadata: {
    name: string;
    telephone: string;
  };
}

export interface ApiSession {
  access_token: string;
  token_type: string;
  expires_at?: number;
  user: ApiUser;
  user_info: ApiUserInfo;
}

export interface ClientError {
  message: string;
  code?: string;
  status?: number;
}

export class ApiRequestError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.detail = detail;
  }
}

type AuthChangeEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'INITIAL_SESSION';
type AuthChangeListener = (event: AuthChangeEvent, session: ApiSession | null) => void;

function decodeJwtExpiry(token: string): number | undefined {
  try {
    const encoded = token.split('.')[1];
    if (!encoded) return undefined;
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp : undefined;
  } catch {
    return undefined;
  }
}

function sessionFromLogin(response: LoginResponse): ApiSession {
  return {
    access_token: response.access_token,
    token_type: response.token_type,
    expires_at: decodeJwtExpiry(response.access_token),
    user_info: response.user_info,
    user: {
      id: String(response.user_info.user_id ?? response.user_info.username),
      // v3 provides a username, not an email address.
      // Keep this compatibility field populated so existing identity labels show the username.
      email: response.user_info.username,
      role: 'authenticated',
      user_metadata: {
        name: response.user_info.real_name || response.user_info.username,
        telephone: '',
      },
    },
  };
}

function loadStoredSession(): ApiSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ApiSession;
    if (!parsed.access_token || !parsed.user_info?.username) return null;
    if (parsed.expires_at && parsed.expires_at * 1000 <= Date.now()) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

let currentSession: ApiSession | null = loadStoredSession();
const authListeners = new Set<AuthChangeListener>();

function saveSession(session: ApiSession | null, event: AuthChangeEvent) {
  currentSession = session;
  if (typeof window !== 'undefined') {
    if (session) window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('omnios:auth-changed'));
  }
  authListeners.forEach(listener => listener(event, session));
}

function toClientError(error: unknown): ClientError {
  if (error instanceof ApiRequestError) {
    return { message: error.message, status: error.status, code: String(error.status) };
  }
  if (error instanceof Error) return { message: error.message };
  return { message: 'Unknown API error' };
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json();
  const text = await response.text();
  return text || null;
}

function httpErrorMessage(response: Response, body: unknown): string {
  const contentType = response.headers.get('content-type') || '';
  const isHtml = contentType.includes('text/html')
    || (typeof body === 'string' && /^\s*(?:<!doctype\s+html|<html\b)/i.test(body));

  // Do not expose a web server's entire HTML error page in the login form.
  if (isHtml && response.status === 404) {
    return 'The API route returned 404 from the website server. Configure the production Nginx server to proxy /api/ to the API service on port 8888.';
  }
  if (isHtml) {
    return `The API gateway returned an HTML error page (HTTP ${response.status}). Check the production reverse-proxy configuration.`;
  }

  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail;
    return typeof detail === 'string' ? detail : JSON.stringify(detail);
  }
  return typeof body === 'string' ? body : `Request failed (${response.status})`;
}

async function request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  try { return await requestInternal<T>(path, init, authenticated); }
  catch (error) {
    if (authenticated && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('omnios:api-error', {
      detail: { message: error instanceof Error ? error.message : 'API request failed' },
    }));
    throw error;
  }
}

async function requestInternal<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  const requestToken = currentSession?.access_token;
  if (authenticated && currentSession?.expires_at && currentSession.expires_at * 1000 <= Date.now()) {
    saveSession(null, 'SIGNED_OUT');
    throw new ApiRequestError('Your session has expired. Please sign in again.', 401);
  }
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (authenticated && currentSession?.access_token) {
    headers.set('Authorization', `Bearer ${currentSession.access_token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch (error) {
    throw new ApiRequestError(error instanceof Error ? error.message : 'Network request failed', 0, error);
  }

  const body = await parseResponseBody(response);
  if (authenticated && requestToken !== currentSession?.access_token) {
    throw new ApiRequestError('The signed-in user changed while this request was in progress.', 409);
  }
  if (response.status === 401 && authenticated) saveSession(null, 'SIGNED_OUT');
  if (!response.ok) {
    throw new ApiRequestError(httpErrorMessage(response, body), response.status, body);
  }
  if (body && typeof body === 'object' && 'success' in body && body.success === false) {
    throw new ApiRequestError('The server did not complete this operation.', response.status, body);
  }
  if (body !== null && typeof body === 'string') {
    throw new ApiRequestError('Expected an API response but received non-JSON content. Check the API gateway address.', response.status);
  }
  return body as T;
}

export function queryString(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const value = search.toString();
  return value ? `?${value}` : '';
}

function segment(value: string): string {
  return encodeURIComponent(value);
}

/** Follow every server page; never treat the first page as the entire dataset. */
async function collectPages<T>(loader: (page: number) => Promise<Paginated<T>>): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  while (true) {
    const result = await loader(page);
    if (!Array.isArray(result.items) || result.page !== page || !Number.isInteger(result.total_pages)) {
      throw new ApiRequestError('Invalid pagination metadata from API v3.0.', 0);
    }
    items.push(...result.items);
    if (page >= result.total_pages) return items;
    if (result.items.length === 0) throw new ApiRequestError('The server returned an empty page before the final page.', 0);
    page++;
  }
}

export function resolveAssetUrl(value?: string | null): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  return API_BASE_URL ? `${API_BASE_URL}/${value.replace(/^\//, '')}` : `/${value.replace(/^\//, '')}`;
}

export const api = {
  getAccessToken(): string | null {
    return currentSession?.access_token ?? null;
  },

  getSession(): ApiSession | null {
    return currentSession;
  },

  async login(payload: LoginRequest): Promise<LoginResponse> {
    return request<LoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, false);
  },

  async createUser(payload: CreateUserRequest): Promise<CreateUserResponse> {
    return request<CreateUserResponse>('/api/v1/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getUsers(filters: ManagedUsersFilters = {}): Promise<ApiManagedUser[]> {
    return request<ApiManagedUser[]>(`/api/v1/users${queryString({ ...filters })}`);
  },

  async deleteUser(userId: number): Promise<DeleteUserResponse> {
    if (!Number.isInteger(userId) || userId < 1) {
      throw new ApiRequestError('A valid user_id is required.', 422);
    }
    return request<DeleteUserResponse>(`/api/v1/users/${segment(String(userId))}`, { method: 'DELETE' });
  },

  async getProjectsSummary(): Promise<ProjectsSummaryResponse> {
    return request<ProjectsSummaryResponse>('/api/v1/projects/summary');
  },

  async getProjectSites(projectCode: string): Promise<ProjectSitesResponse> {
    return request<ProjectSitesResponse>(`/api/v1/projects/${segment(projectCode)}/sites`);
  },

  async getSiteBuildings(projectCode: string, siteCode: string): Promise<SiteBuildingsResponse> {
    return request<SiteBuildingsResponse>(
      `/api/v1/projects/${segment(projectCode)}/sites/${segment(siteCode)}/buildings`,
    );
  },

  async getBuilding(
    projectCode: string,
    siteCode: string,
    buildingName: string,
    floorName?: string,
  ): Promise<BuildingDetailResponse> {
    const query = floorName ? queryString({ floor: floorName }) : '';
    return request<BuildingDetailResponse>(
      `/api/v1/projects/${segment(projectCode)}/sites/${segment(siteCode)}/buildings/${segment(buildingName)}${query}`,
    );
  },

  async getDeviceSnapshots(filters: SnapshotFilters): Promise<DeviceSnapshot> {
    return request<DeviceSnapshot>(`/api/v1/devices/snapshots${queryString({ ...filters })}`);
  },

  getAlarms(filters: AlarmFilters = {}) {
    return request<Paginated<ApiAlarm>>(`/api/v1/alarms${queryString({ ...filters })}`);
  },
  getAllAlarms(filters: Omit<AlarmFilters, 'page' | 'page_size'> = { status: 'all' }) {
    return collectPages<ApiAlarm>(page => api.getAlarms({ ...filters, page, page_size: 100 }));
  },
  actOnAlarm(id: string | number, action: AlarmAction) {
    return request<{ success: boolean; alarm_id: number; status: string }>(`/api/v1/alarms/${segment(String(id))}/action`, {
      method: 'PATCH', body: JSON.stringify(action),
    });
  },
  getPredictions(filters: PredictionFilters = {}) {
    return request<PredictionsResponse>(`/api/v1/maintenance/predictions${queryString({ ...filters })}`);
  },
  updatePredictionStatus(id: string | number, status: ApiPredictionStatus) {
    return request<{ success: boolean; id: number; status: ApiPredictionStatus }>(`/api/v1/maintenance/predictions/${segment(String(id))}/status`, {
      method: 'PATCH', body: JSON.stringify({ status }),
    });
  },
  generatePredictions() {
    return request<{ success: boolean; generated_count: number }>('/api/v1/maintenance/predictions/generate', { method: 'POST' });
  },
  getTrendDevices(filters: SpatialFilters = {}) {
    return request<TrendDevice[]>(`/api/v1/analytics/trend-devices${queryString({ ...filters })}`);
  },
  getDeviceTrends(deviceCodes: string[], timeRange: TrendRange) {
    return request<DeviceTrendsResponse>(`/api/v1/analytics/device-trends${queryString({ device_codes: deviceCodes.join(','), time_range: timeRange })}`);
  },
  getAlarmStatistics(filters: StatisticsFilters = {}) {
    return request<AlarmStatisticsResponse>(`/api/v1/analytics/alarm-statistics${queryString({ ...filters })}`);
  },
  admin: {
    async list<R extends AdminResource>(resource: R, filters: AdminFilters = {}): Promise<AdminResourceRows[R][]> {
      if (resource === 'devices') {
        return collectPages<AdminResourceRows[R]>(page => request<Paginated<AdminResourceRows[R]>>(
          `/api/v1/admin/devices${queryString({ ...filters, page, page_size: 200 })}`,
        ));
      }
      return request<AdminResourceRows[R][]>(`/api/v1/admin/${resource}${queryString({ ...filters })}`);
    },
    create(resource: AdminResource, payload: Record<string, unknown>) {
      return request<MutationResponse>(`/api/v1/admin/${resource}`, { method: 'POST', body: JSON.stringify(payload) });
    },
    update(resource: AdminResource, id: string | number, payload: Record<string, unknown>) {
      return request<MutationResponse>(`/api/v1/admin/${resource}/${segment(String(id))}`, { method: 'PUT', body: JSON.stringify(payload) });
    },
    remove(resource: AdminResource, id: string | number) {
      return request<MutationResponse>(`/api/v1/admin/${resource}/${segment(String(id))}`, { method: 'DELETE' });
    },
    updatePosition(deviceCode: string, position: { position_x: number; position_y: number }) {
      if (![position.position_x, position.position_y].every(value => Number.isFinite(value) && value >= 0 && value <= 100)) {
        return Promise.reject(new ApiRequestError('Device coordinates must be between 0 and 100 percent.', 422));
      }
      return request<MutationResponse>(`/api/v1/admin/devices/${segment(deviceCode)}/position`, { method: 'PATCH', body: JSON.stringify(position) });
    },
    uploadFloorImage(floorId: number | string, file: File) {
      const data = new FormData();
      data.append('file', file);
      return request<{ success: boolean; floor_plan_url: string }>(`/api/v1/admin/floors/${segment(String(floorId))}/image`, { method: 'POST', body: data });
    },
    removeFloorImage(floorId: number | string) {
      return request<MutationResponse>(`/api/v1/admin/floors/${segment(String(floorId))}/image`, { method: 'DELETE' });
    },
    generateMissingFloors() {
      return request<{ success: boolean; created_floors: number }>('/api/v1/admin/buildings/generate-missing-floors', { method: 'POST' });
    },
  },

  async uploadDeviceConfig(file: File | Blob, filename = 'devices.csv'): Promise<Record<string, unknown>> {
    const data = new FormData();
    data.append('file', file, filename);
    void data;
    throw new ApiRequestError('API v3.0 does not document a bulk CSV upload endpoint. Use the documented device CRUD endpoints.', 501);
  },

  auth: {
    async getSession(): Promise<{ data: { session: ApiSession | null }; error: ClientError | null }> {
      return { data: { session: currentSession }, error: null };
    },

    async signInWithPassword(credentials: { email?: string; username?: string; password: string }) {
      try {
        const response = await api.login({
          username: credentials.username ?? credentials.email ?? '',
          password: credentials.password,
        });
        const session = sessionFromLogin(response);
        saveSession(session, 'SIGNED_IN');
        return { data: { session, user: session.user }, error: null };
      } catch (error) {
        return { data: { session: null, user: null }, error: toClientError(error) };
      }
    },

    async signOut() {
      saveSession(null, 'SIGNED_OUT');
      return { error: null };
    },

    onAuthStateChange(listener: AuthChangeListener) {
      authListeners.add(listener);
      queueMicrotask(() => listener('INITIAL_SESSION', currentSession));
      return {
        data: {
          subscription: {
            unsubscribe: () => authListeners.delete(listener),
          },
        },
      };
    },

    async updateUser(_attributes?: { password?: string }) {
      return {
        data: { user: currentSession?.user ?? null },
        error: { message: 'API v3.0 does not provide a password-change endpoint.', code: 'NOT_SUPPORTED' },
      };
    },
  },
};

export function unsupportedApiError(feature: string): ClientError {
  return {
    code: 'NOT_SUPPORTED',
    message: `${feature} is not available in API v3.0.`,
  };
}
