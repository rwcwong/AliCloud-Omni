import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const referenceRoot = path.resolve(process.argv[2] || path.join(root, '../OmniOS-main-1008'));
const read = (base, file) => readFileSync(path.join(base, file), 'utf8').replaceAll('\r\n', '\n');
let checks = 0;
function check(name, run) { run(); checks++; console.log(`PASS ${name}`); }
function segment(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `Missing boundary: ${start}`);
  const to = end ? source.indexOf(end, from + start.length) : source.length;
  assert.notEqual(to, -1, `Missing boundary: ${end}`);
  return source.slice(from, to).trimEnd();
}
function renderBlock(source) {
  const start = source.search(/\n  return (?:\(|<)/);
  assert.notEqual(start, -1, 'Missing component render block');
  return source.slice(start).trimEnd()
    .replace(/^\s*<MapTileNotice[^\n]+\/>(?:\n)?/gm, '')
    .replaceAll('pointer-events-none absolute inset-0 z-[1000] flex', 'absolute inset-0 z-[1000] flex')
    .replace(/^\s*if \(!pos\) return null;\n/gm, '');
}

const maps = [
  ['OmniOSHome', 'function LeafletMap(', 'function Legend('],
  ['OmniHomeipad', 'function IpadMap(', 'function IpadAlarmPanel('],
  ['OverviewDashboard3D', 'function LeafletMap(', 'function ProjectRail('],
  ['ProjectMonitoring', 'function InteractiveMap(', 'function StaticMap('],
];
for (const [name, start, end] of maps) {
  const file = `src/scenarios/${name}.tsx`;
  const current = segment(read(root, file), start, end);
  const reference = segment(read(referenceRoot, file), start, end);
  check(`${name}: reference map layout, legends, overlays and tooltips`, () => assert.equal(renderBlock(current), renderBlock(reference)));
  check(`${name}: reference marker geometry and animation`, () => assert.equal(segment(current, '    geoSites.forEach(s => {', '      const marker'), segment(reference, '    geoSites.forEach(s => {', '      const marker')));
  check(`${name}: API migration remains intact`, () => assert.doesNotMatch(read(root, file), /from ['"]\.\.\/lib\/supabase['"]/));
}
for (const [file, start, end] of [
  ['src/scenarios/ProjectMonitoring.tsx', 'function StaticMap(', 'function HKMap('],
  ['src/scenarios/ProjectMonitoring3D.tsx', 'function InteractiveTerrain(', 'function Legend('],
]) {
  check(`${path.basename(file)}: reference static/3D map rendering`, () => assert.equal(renderBlock(segment(read(root, file), start, end)), renderBlock(segment(read(referenceRoot, file), start, end))));
}
check('Reference map CSS is identical', () => assert.equal(segment(read(root, 'src/index.css'), '/* ── Leaflet map pin styles', ''), segment(read(referenceRoot, 'src/index.css'), '/* ── Leaflet map pin styles', '')));
check('Reference Hong Kong image is identical', () => {
  const digest = base => createHash('sha256').update(readFileSync(path.join(base, 'src/assets/images/HK_map_1.jpg'))).digest('hex');
  assert.equal(digest(root), digest(referenceRoot));
});
check('Reference initial viewport is preserved', () => {
  const hook = read(root, 'src/hooks/useLeafletMap.ts');
  assert.match(hook, /center: \[22\.3193, 114\.1694\]/);
  assert.match(hook, /zoom: 11,/);
  assert.doesNotMatch(hook, /fitBounds|panInside/);
});

// Stub Leaflet: URL/key tests make no network requests and use no real credentials.
const tileCalls = [];
const environment = {};
const source = read(root, 'src/lib/mapTiles.ts').replaceAll('import.meta.env', 'mapTestEnvironment');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
const context = {
  exports: {}, mapTestEnvironment: environment,
  require(name) {
    assert.equal(name, 'leaflet');
    return { tileLayer(url, options) { tileCalls.push({ url, options }); return { addTo(map) { return { map, url, options }; } }; } };
  },
};
vm.runInNewContext(compiled, context);
const { createMapTileLayer, hasCartoApiKey } = context.exports;
check('Missing key blocks unauthenticated/watermarked requests', () => {
  assert.equal(hasCartoApiKey(), false);
  assert.equal(createMapTileLayer({}, false), null);
  environment.VITE_CARTO_API_KEY = '   ';
  assert.equal(createMapTileLayer({}, true), null);
  assert.equal(tileCalls.length, 0);
});
environment.VITE_CARTO_API_KEY = 'local-test-key + &/?';
for (const [light, style] of [[false, 'dark_all'], [true, 'rastertiles/voyager']]) {
  check(`Configured key selects reference ${style} tiles`, () => {
    const layer = createMapTileLayer({}, light);
    assert.equal(layer.url, `https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(environment.VITE_CARTO_API_KEY)}`);
    assert.equal(layer.options.maxZoom, 19);
    assert.equal(layer.options.subdomains, 'abcd');
    assert.equal(layer.options.crossOrigin, true);
    assert.match(layer.options.attribution, /OpenStreetMap contributors/);
    assert.match(layer.options.attribution, /CARTO/);
  });
}
// Exercise the real Vite config using fake env files; never read/transmit real credentials.
let projectEnvironment = {};
let referenceEnvironment = {};
const envReads = [];
const configLogs = [];
const configSource = read(root, 'vite.config.ts').replaceAll('import.meta.url', JSON.stringify(pathToFileURL(path.join(root, 'vite.config.ts')).href));
const configCompiled = ts.transpileModule(configSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
const configContext = {
  exports: {}, URL,
  console: { info: text => configLogs.push(text), warn: text => configLogs.push(text) },
  require(name) {
    if (name === 'node:url') return { fileURLToPath };
    if (name === '@vitejs/plugin-react') return () => ({ name: 'test-react' });
    assert.equal(name, 'vite');
    return {
      defineConfig: configure => configure,
      loadEnv(mode, directory, prefix) {
        envReads.push({ mode, directory: path.resolve(directory), prefix });
        const env = path.resolve(directory) === root ? projectEnvironment : referenceEnvironment;
        return Object.fromEntries(Object.entries(env).filter(([key]) => key.startsWith(prefix)));
      },
    };
  },
};
vm.runInNewContext(configCompiled, configContext);
const configure = (projectEnv, referenceEnv, mode = 'development') => {
  projectEnvironment = projectEnv;
  referenceEnvironment = referenceEnv;
  envReads.length = 0;
  configLogs.length = 0;
  return configContext.exports.default({ mode });
};
check('Vite reports missing keys without inventing a credential', () => {
  const config = configure({ VITE_CARTO_API_KEY: '  ' }, {});
  assert.equal(Object.keys(config.define).length, 0);
  assert.match(configLogs.join('\n'), /VITE_CARTO_API_KEY is missing/);
  assert.equal(envReads.length, 2);
  assert.equal(envReads[0].directory, root);
  assert.equal(envReads[1].directory, path.join(root, '../OmniOS-main-1008'));
});
check('Vite restores only the reference basemap key, not backend credentials', () => {
  const config = configure({}, { VITE_CARTO_API_KEY: ' reference-only-test-key ', VITE_SUPABASE_URL: 'not-imported', VITE_API_BASE_URL: 'not-imported' });
  assert.equal(config.define['import.meta.env.VITE_CARTO_API_KEY'], JSON.stringify('reference-only-test-key'));
  assert.equal(Object.keys(config.define).length, 1);
  assert.ok(envReads.every(call => call.prefix === 'VITE_CARTO_API_KEY'));
  assert.match(configLogs.join('\n'), /loaded from OmniOS-main-1008/);
  assert.doesNotMatch(configLogs.join('\n'), /reference-only-test-key|not-imported/);
});
check('Vite prioritizes this project and never logs its key', () => {
  const config = configure({ VITE_CARTO_API_KEY: ' project-only-test-key ' }, { VITE_CARTO_API_KEY: 'reference-only-test-key' });
  assert.equal(config.define['import.meta.env.VITE_CARTO_API_KEY'], JSON.stringify('project-only-test-key'));
  assert.equal(envReads.length, 1);
  assert.doesNotMatch(configLogs.join('\n'), /project-only-test-key|reference-only-test-key/);
});
check('Production builds restore the same mode-specific reference configuration', () => {
  const config = configure({}, { VITE_CARTO_API_KEY: 'production-test-key' }, 'production');
  assert.ok(envReads.every(call => call.mode === 'production'));
  assert.equal(config.define['import.meta.env.VITE_CARTO_API_KEY'], JSON.stringify('production-test-key'));
  assert.equal(config.server.proxy['/api'].target, 'http://47.76.120.26:8888');
});
console.log(`\n${checks} map-reference checks passed. Real CARTO rendering still requires an authorized key.`);
