// Offline contract tests only: no test can contact or mutate the real backend.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const json = value => JSON.parse(JSON.stringify(value));
function harness() {
  const requests = [];
  const storage = new Map();
  const window = new EventTarget();
  window.location = { protocol: 'http:', host: 'contract.test' };
  window.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const timers = [];
  class Socket {
    static OPEN = 1; static CONNECTING = 0; static instances = [];
    readyState = 0; sent = [];
    constructor(url) { this.url = url; Socket.instances.push(this); }
    send(value) { this.sent.push(value); }
    close() { this.readyState = 3; this.onclose?.(); }
    open() { this.readyState = 1; this.onopen?.(); }
    message(value) { this.onmessage?.({ data: JSON.stringify(value) }); }
  }
  let respond = () => ({ success: true });
  const context = vm.createContext({ window, Headers, FormData, Blob, File, URL, URLSearchParams, CustomEvent, console, atob,
    queueMicrotask, WebSocket: Socket,
    setTimeout: (run, delay) => { const timer = { run, delay }; timers.push(timer); return timer; }, clearTimeout: timer => { if (timer) timer.cancelled = true; },
    setInterval: (run, delay) => { const timer = { run, delay, interval: true }; timers.push(timer); return timer; }, clearInterval: timer => { if (timer) timer.cancelled = true; },
    fetch: async (path, init = {}) => {
      const request = { path, url: new URL(path, 'http://contract.test'), ...init, method: init.method ?? 'GET' };
      requests.push(request);
      const result = await respond(request);
      return result instanceof Response ? result : new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    },
  });
  const modules = new Map();
  function load(path) {
    const file = resolve(root, path);
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    const source = readFileSync(file, 'utf8').replaceAll('import.meta.env', '({})');
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const require = specifier => {
      assert.ok(specifier.startsWith('.'), 'Only local source modules are permitted');
      const base = resolve(dirname(file), specifier);
      const dependency = [base, base + '.ts', base + '.tsx'].find(existsSync);
      assert.ok(dependency, 'Missing test dependency: ' + specifier);
      return load(dependency);
    };
    vm.runInContext('(function(require,module,exports){' + output + '\n})', context, { filename: file })(require, module, module.exports);
    return module.exports;
  }
  const { api } = load('src/lib/api.ts');
  async function login(role = 'admin') {
    respond = () => ({ access_token: 'offline-contract-token', token_type: 'bearer', user_info: { username: 'contract-user', user_id: 42, real_name: 'Contract Test', role, project_code: null, site_code: null, site_name: null } });
    assert.equal((await api.auth.signInWithPassword({ username: 'contract-user', password: 'not-a-real-password' })).error, null);
  }
  return { api, load, login, requests, Socket, timers, respond: fn => { respond = fn; } };
}

function fixtures(h) {
  const distribution = { total: 2, online: 1, normal: 0, alarm: 1, fault: 0, offline: 1 };
  const projects = [{ project_id: 42, project_code: 'P', project_name: 'Project', project_name_zh: '项目', description: '' }];
  const sites = [{ site_id: 101, project_code: 'P', site_code: 'S', site_name: 'Site', site_name_zh: '站点', latitude: 0, longitude: 0 }];
  const buildings = [{ building_id: 9, project_code: 'P', site_code: 'S', building_name: 'A/B', building_name_zh: '', total_floors: 2, basement_floors: 0 }];
  const floors = ['G/F', '1/F'].map((label, index) => ({ floor_id: 77 + index, project_code: 'P', site_code: 'S', building_name: 'A/B', floor_label: label, floor_number: index, floor_plan_url: '/static/' + index + '.png' }));
  const point = { device_id: 'D/1', device_type_code: 'SMK_OPT', label: 'Sensor', category: 'Detection', terminal_type: 'Smoke detector', status: 2, position_x: 0, position_y: 100, current_value: 0, unit: 'ppm', battery_value: null, signal_power: 0, alarm_min: 0, alarm_max: 100, last_seen: '2026-10-22T11:00:00' };
  const devices = [{ ...point, device_code: point.device_id, ...floors[0], serial_number: 'serial', notes: '' }];
  const types = [{ type_id: 5, code: 'SMK_OPT', category: 'Detection', name_en: 'Smoke', name_zh: '烟感', name_zh_tw: '', priority: 'critical', unit: 'ppm', has_numeric_value: true, possible_states: ['Normal','Alarm','Fault','Offline'] }];
  const resources = { projects, sites, buildings, floors, devices, 'device-types': types,
    'fsd-codes': [{ code_id: 6, code: 'F1', frequency: 'Annual', description_en: 'Inspect', description_zh: '检查', device_category: 'Detection', is_active: true }],
    'maintenance-rules': [{ rule_id: 7, name: 'Trend', name_zh: '趋势', rule_type: 'Trend_Analysis', device_category: 'All Categories', threshold: 1, time_window_hours: 24, min_probability: 0.5, recommendation: 'Check', recommendation_zh: '检查', is_active: true }] };
  h.respond(request => {
    const { pathname: path, searchParams: query } = request.url;
    if (request.method !== 'GET') return { success: true, project_id: 42, created_floors: 0 };
    if (path === '/api/v1/projects/summary') return { device_status_distribution: distribution, projects: projects.map(project => ({ ...project, device_count: 2, alarm_count: 1, fault_count: 0, site_count: 1, building_count: 1, sites: [] })) };
    if (path === '/api/v1/projects/P/sites') return { device_status_distribution: distribution, sites: sites.map(site => ({ ...site, id: site.site_id, total_devices: 2, online_count: 1, alarm_count: 1, fault_count: 0, building_count: 1 })) };
    if (path === '/api/v1/projects/P/sites/S/buildings') return { device_status_distribution: distribution, buildings: [{ ...buildings[0], floors: ['G/F','1/F'], total_devices: 2, floor_details: floors.map(floor => ({ floor_name: floor.floor_label, floor_number: floor.floor_number, alarm_count: 0, fault_count: 0, offline_count: 0 })) }] };
    if (path.startsWith('/api/v1/projects/P/sites/S/buildings/')) return { building_name: 'A/B', current_floor: query.get('floor'), floors: ['G/F','1/F'], floor_plan_url: query.get('floor') === 'G/F' ? '/static/0.png' : '/static/1.png', devices: query.get('floor') === 'G/F' ? [point] : [] };
    if (path.startsWith('/api/v1/admin/')) {
      const name = path.split('/')[4];
      return name === 'devices' ? { total: devices.length, page: 1, page_size: 200, total_pages: 1, items: devices } : resources[name];
    }
    if (path === '/api/v1/alarms') return { total: 1, page: 1, page_size: 100, total_pages: 1, items: [{ id: 902, device_id: 'D/1', device_label: 'Sensor', project_code: 'P', site_code: 'S', site_name: 'Site', building_name: 'A/B', floor_name: 'G/F', category: 'Detection', severity: 'Alarm', status: 'active', description: 'Server description', alarm_type: 'Fire', triggered_at: point.last_seen, position_x: 0, position_y: 100 }] };
    if (path === '/api/v1/maintenance/predictions') return { counts: { all: 1, pending: 1, in_progress: 0, resolved: 0, ignored: 0 }, items: [{ id: 31, device_id: 'D/1', device_label: 'Sensor', project_code: 'P', site_name: 'Site', building_name: 'A/B', floor_name: 'G/F', status: 'pending', fault_probability: 0.7, triggered_by_rule_id: 7 }] };
    if (path === '/api/v1/analytics/trend-devices') return [{ device_code: 'D/1', label: 'Sensor', unit: 'ppm', tag_display: 'D/1 (ppm)' }];
    if (path === '/api/v1/analytics/device-trends') return { time_range: query.get('time_range'), series: [{ device_code: 'D/1', label: 'Sensor', unit: 'ppm', points: [['2026-10-22T11:00:01',0],['2026-10-22T11:02:37',null],['2026-10-22T11:04:19',3]] }] };
    throw new Error('Unexpected offline request: ' + path);
  });
  return { resources, point };
}

test('REST path encoding, bearer headers, snapshot scope and all-page pagination', async () => {
  const h = harness(); await h.login();
  h.respond(r => r.url.pathname.includes('/snapshots') ? { device_id: 'D/1', status: 0 } : { total: 2, page: Number(r.url.searchParams.get('page')), page_size: 1, total_pages: 2, items: [{ id: r.url.searchParams.get('page') }] });
  assert.equal((await h.api.getDeviceSnapshots({ device_id: 'D/1' })).status, 0);
  assert.equal(h.requests.at(-1).url.searchParams.get('device_id'), 'D/1');
  assert.equal(h.requests.at(-1).headers.get('Authorization'), 'Bearer offline-contract-token');
  assert.equal((await h.api.getAllAlarms()).length, 2);
  assert.equal(h.requests.at(-1).url.searchParams.get('status'), 'all');
  assert.equal((await h.api.admin.list('devices')).length, 2);
  h.respond(() => ({ devices: [] }));
  await h.api.getBuilding('P', 'S', 'A/B', 'G/F');
  assert.match(h.requests.at(-1).path, /A%2FB\?floor=G%2FF/);
});

test('HTML 404 from the website server is reported as a proxy problem without leaking its page', async () => {
  const h = harness();
  h.respond(() => new Response('<html><body><h1>404 Not Found</h1></body></html>', {
    status: 404,
    headers: { 'Content-Type': 'text/html' },
  }));
  const result = await h.api.auth.signInWithPassword({ username: 'test-user', password: 'test-only' });
  assert.match(result.error.message, /proxy \/api\/.*port 8888/i);
  assert.doesNotMatch(result.error.message, /<html|404 Not Found/i);
});

test('physical status, zero/null coordinates, exact category and per-floor images remain faithful', async () => {
  const h = harness(); await h.login(); fixtures(h);
  const { apiData, statusName, categoryFromApi } = h.load('src/lib/apiData.ts');
  assert.deepEqual([0,1,2,3].map(statusName), ['Normal','Fault','Alarm','Offline']);
  assert.throws(() => statusName(8), /Unknown/);
  assert.equal(categoryFromApi('Unknown pump-like description'), '');
  assert.equal((await apiData.devices([])).length, 0);
  const device = (await apiData.devices())[0];
  assert.equal(device.position_x, 0); assert.equal(device.position_y, 100);
  assert.equal(device.current_value, 0); assert.equal(device.battery_value, null);
  assert.equal(device.status, 'Alarm'); assert.equal(device.is_active, undefined);
  const images = await apiData.floorPlanImages();
  assert.deepEqual(json(images).map(row => new URL(row.image_url, 'http://contract.test').pathname), ['/static/0.png','/static/1.png']);
  const alarm = (await apiData.alarms())[0];
  assert.equal(alarm.id, '902'); assert.equal(alarm.severity, 'alarm');
  assert.equal(alarm.devices.status, ''); // Work-order severity is not physical status.
});

test('prediction locations are joined by actual device code, absent confidence/time remain blank; trends preserve irregular points', async () => {
  const h = harness(); await h.login(); fixtures(h);
  const { apiData } = h.load('src/lib/apiData.ts');
  const prediction = (await apiData.predictions())[0];
  assert.equal(prediction.devices.code, 'D/1');
  assert.equal(prediction.devices.floors.buildings.sites.project_id, 'P');
  assert.equal(prediction.confidence_score, null); assert.equal(prediction.created_at, '');
  const { fetchNumericDevices, fetchReadings } = h.load('src/lib/analytics.ts');
  assert.equal((await fetchNumericDevices())[0].id, 'D/1');
  assert.deepEqual(json(await fetchReadings(['D/1'], '24h')), [
    { device_id: 'D/1', recorded_at: '2026-10-22T11:00:01', value: 0 },
    { device_id: 'D/1', recorded_at: '2026-10-22T11:04:19', value: 3 },
  ]);
  assert.equal(h.requests.some(request => request.url.pathname.includes('device_readings')), false);
});

test('admin writes use physical IDs, devices use their code, and position writes use PATCH only', async () => {
  const h = harness(); await h.login(); fixtures(h);
  const { mutateLegacy } = h.load('src/lib/apiMutations.ts');
  await mutateLegacy('projects', 'update', { name: 'Updated' }, [{ column: 'id', op: 'eq', value: 'P' }]);
  let request = h.requests.find(r => r.method === 'PUT');
  assert.equal(request.url.pathname, '/api/v1/admin/projects/42');
  assert.equal(JSON.parse(request.body).project_code, undefined);
  assert.equal(JSON.parse(request.body).project_name, 'Updated');
  await mutateLegacy('devices', 'update', { position_x: 0, position_y: 100 }, [{ column: 'id', op: 'eq', value: 'D/1' }]);
  request = h.requests.find(r => r.method === 'PATCH');
  assert.equal(request.url.pathname, '/api/v1/admin/devices/D%2F1/position');
  assert.deepEqual(JSON.parse(request.body), { position_x: 0, position_y: 100 });
  await assert.rejects(mutateLegacy('devices', 'update', { is_active: true }, [{ column: 'id', op: 'eq', value: 'D/1' }]), /does not define/);
  await assert.rejects(mutateLegacy('alarm_events', 'update', { status: 'resolved' }, [{ column: 'id', op: 'eq', value: '902' }]), /only documents/);
  await assert.rejects(mutateLegacy('sites', 'delete', {}, []), /Unscoped/);
  assert.equal(h.requests.some(r => r.url.pathname.includes('/generate-missing-floors')), false);
});

test('supported actions, full CRUD methods and multipart images follow the documented contracts', async () => {
  const h = harness(); await h.login(); h.respond(() => ({ success: true }));
  await h.api.actOnAlarm(902, { action: 'dispatch', dispatched_to: 'Assigned team' });
  assert.equal(h.requests.at(-1).method, 'PATCH');
  assert.deepEqual(JSON.parse(h.requests.at(-1).body), { action: 'dispatch', dispatched_to: 'Assigned team' });
  await h.api.updatePredictionStatus(15, 'in_progress');
  assert.equal(h.requests.at(-1).url.pathname, '/api/v1/maintenance/predictions/15/status');
  for (const resource of ['projects','sites','buildings','floors','devices','device-types','fsd-codes','maintenance-rules']) {
    await h.api.admin.create(resource, { explicit: 'test-only' }); assert.equal(h.requests.at(-1).method, 'POST');
    await h.api.admin.update(resource, 3, { explicit: 'test-only' }); assert.equal(h.requests.at(-1).method, 'PUT');
    await h.api.admin.remove(resource, 3); assert.equal(h.requests.at(-1).method, 'DELETE');
  }
  await h.api.admin.uploadFloorImage(77, new File(['test-only'], 'plan.png', { type: 'image/png' }));
  assert.ok(h.requests.at(-1).body instanceof FormData);
  assert.equal(h.requests.at(-1).headers.has('Content-Type'), false);
  assert.equal(h.requests.at(-1).url.pathname, '/api/v1/admin/floors/77/image');
  await assert.rejects(h.api.admin.updatePosition('D', { position_x: -1, position_y: 50 }), /0 and 100/);
});

test('admin view models map each resource to v3 fields without emitting UI-only metadata', async () => {
  const h = harness(); await h.login(); fixtures(h);
  const { mutateLegacy } = h.load('src/lib/apiMutations.ts');
  const cases = [
    ['sites', 'P::S', { contact_phone: 'test-only' }, '/api/v1/admin/sites/101', { project_code: 'P', site_code: 'S', site_name: 'Site' }],
    ['buildings', 'P::S::A%2FB', { name_zh: '楼宇' }, '/api/v1/admin/buildings/9', { project_code: 'P', site_code: 'S', building_name: 'A/B', building_name_zh: '楼宇' }],
    ['floors', 'P::S::A%2FB::G%2FF', { floor_number: 0 }, '/api/v1/admin/floors/77', { floor_label: 'G/F', floor_number: 0 }],
    ['devices', 'D/1', { label: 'Changed label' }, '/api/v1/admin/devices/D%2F1', { code: 'D/1', label: 'Changed label', device_type_code: 'SMK_OPT', floor_label: 'G/F' }],
    ['device_types', '5', { priority: 'critical' }, '/api/v1/admin/device-types/5', { code: 'SMK_OPT', category: 'Detection', priority: 'critical' }],
    ['fsd_codes', '6', { frequency: '6-monthly' }, '/api/v1/admin/fsd-codes/6', { frequency: 'Semi-Annual', device_category: 'Detection' }],
    ['maintenance_rules', '7', { rule_type: 'Baseline_Drift' }, '/api/v1/admin/maintenance-rules/7', { rule_type: 'Baseline_Drift', device_category: 'All Categories' }],
  ];
  for (const [table, id, input, path, fields] of cases) {
    await mutateLegacy(table, 'update', input, [{ column: 'id', op: 'eq', value: id }]);
    const request = h.requests.filter(item => item.method === 'PUT').at(-1);
    assert.equal(request.url.pathname, path);
    const body = JSON.parse(request.body);
    for (const [key, value] of Object.entries(fields)) assert.equal(body[key], value, table + '.' + key);
    for (const key of ['id','api_id','sites','floors','created_at','updated_at','status','brand','control_room_id']) assert.equal(body[key], undefined, table + ' must not emit ' + key);
  }
});

test('telemetry preserves absent fields and real zeros, and older frames cannot downgrade a snapshot', () => {
  const h = harness();
  const { applyDeviceSignal } = h.load('src/lib/deviceSignals.ts');
  const device = { id: 'D', status: 'Normal', current_value: 8, battery_value: 0, last_seen_at: '2026-10-22T11:00:00' };
  const changed = applyDeviceSignal(device, { deviceId: 'D', status: 'Alarm', timestamp: '2026-10-22T11:00:01', value: 0 });
  assert.equal(changed.status, 'Alarm'); assert.equal(changed.current_value, 0); assert.equal(changed.battery_value, 0);
  assert.equal(applyDeviceSignal(changed, { deviceId: 'D', status: 'Normal', timestamp: '2026-10-22T10:59:00' }).status, 'Alarm');
});

test('failed writes/HTML/401 never fake success; 403 does not log out an authenticated role', async () => {
  const h = harness(); await h.login();
  h.respond(() => ({ success: false })); await assert.rejects(h.api.admin.create('sites', {}), /did not complete/);
  h.respond(() => new Response('<html>gateway</html>', { headers: { 'Content-Type': 'text/html' } }));
  await assert.rejects(h.api.getProjectsSummary(), /non-JSON/);
  h.respond(() => new Response('{"detail":"Forbidden"}', { status: 403, headers: { 'Content-Type': 'application/json' } }));
  await assert.rejects(h.api.getProjectsSummary(), /Forbidden/); assert.ok(h.api.getSession());
  h.respond(() => new Response('{"detail":"Expired"}', { status: 401, headers: { 'Content-Type': 'application/json' } }));
  await assert.rejects(h.api.getProjectsSummary(), /Expired/); assert.equal(h.api.getSession(), null);
});

test('statistics use actual Alarm/Fault buckets and missing endpoints remain empty without network requests', async () => {
  const h = harness(); await h.login();
  h.respond(() => ({ summary: { total_events: 4, critical_events: 1, alarm_events: 2, fault_events: 1 }, trend: [{ date: '2026-10-22', total: 4, alarms: 2, faults: 1 }] }));
  const { apiClient } = h.load('src/lib/apiCompat.ts');
  const result = await apiClient.rpc('get_alarm_stats', { range_label: '7D', p_project_id: 'P', p_site_id: 'P::S', p_building_id: 'P::S::A%2FB', p_category: 'alarm', p_device_category: 'detection' });
  assert.equal(result.error, null); assert.equal(result.data.critical_count, 1);
  assert.deepEqual(json(result.data.buckets).map(row => row.severity), ['alarm','fault']);
  assert.equal(h.requests.at(-1).url.searchParams.get('severity'), 'Alarm');
  assert.equal(h.requests.at(-1).url.searchParams.get('category'), 'Detection');
  const count = h.requests.length;
  for (const table of ['audit_log','control_rooms','compliance_reports','inspection_logs','pending_registrations','simulator_state']) assert.equal((await apiClient.from(table).select('*')).data.length, 0);
  assert.equal(h.requests.length, count);
});

test('dual WebSockets deduplicate identical frames, retain changed readings, reconnect at 5s and heartbeat at 25s', async () => {
  const h = harness(); await h.login();
  const { WebSocketTransport } = h.load('src/transport/WebSocketTransport.ts');
  const transport = new WebSocketTransport(); const signals = [];
  transport.subscribe('test', signal => signals.push(signal));
  assert.equal(h.Socket.instances.length, 2);
  const [first, second] = h.Socket.instances; first.open(); second.open();
  const frame = { type: 'device_status_change', data: { device_id: 'D', status: 2, current_value: 0, timestamp: '2026-10-22T11:00:00' } };
  first.message(frame); second.message(frame); assert.equal(signals.length, 1);
  second.message({ ...frame, data: { ...frame.data, current_value: 1 } }); assert.equal(signals.length, 2);
  assert.equal(signals[0].value, 0); assert.equal(signals[0].batteryValue, undefined);
  assert.ok(h.timers.some(timer => timer.interval && timer.delay === 25_000));
  first.close(); assert.ok(h.timers.some(timer => timer.delay === 5_000));
  transport.destroy();
  const before = signals.length; first.message(frame); assert.equal(signals.length, before);
  transport.subscribe('remount', signal => signals.push(signal)); assert.equal(h.Socket.instances.length, 4);
  transport.destroy();
});
