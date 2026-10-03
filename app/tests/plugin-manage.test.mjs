import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { createCustomizeStore } from '../src/customize-store.mjs';
import { customizeCore, pluginChangeOutcome, pluginInstallStatus, pluginRows, appendPluginLog, PLUGIN_LOG_LIMIT } from '../src/customize-model.mjs';
const require = createRequire(import.meta.url);
const { createCustomizeOperations } = require('../electron/customize-operations.cjs');

// Customize › Plugins management on the DeepSeek core (harness plugins.js over dsh-plugin-manager).
let server, M;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  M = await server.ssrLoadModule('/src/source-customize.jsx');
});
after(() => server?.close());

const installed = { marketplaces: [{ name: 'deepseek-harness', path: '/profile', interface: { displayName: 'DeepSeek Harness profile' }, plugins: [
  { id: '@code-desktop/dsh-code-desktop-app', name: '@code-desktop/dsh-code-desktop-app', version: '0.1.0', installed: true, enabled: true, source: { type: 'local' }, interface: { displayName: 'Code Desktop' }, codeDesktop: { removable: false, optional: false, readOnlyReason: 'management-required', loadError: null } },
  { id: 'dsh-plugin-x', name: 'dsh-plugin-x', version: '1.2.3', installed: true, enabled: false, source: { type: 'local' }, interface: { displayName: 'Plugin X' }, codeDesktop: { removable: true, optional: false, readOnlyReason: null, loadError: 'Cannot find module' } },
] }] };

test('plugin rows carry what management may do; only a core that says so manages plugins', () => {
  const rows = pluginRows(installed);
  const core = rows.find((row) => row.id === '@code-desktop/dsh-code-desktop-app'), x = rows.find((row) => row.id === 'dsh-plugin-x');
  assert.deepEqual([core.removable, core.manageable, core.loadError], [false, false, '']);
  assert.deepEqual([x.removable, x.manageable, x.loadError, x.version, x.enabled], [true, true, 'Cannot find module', '1.2.3', false]);
  assert.equal(customizeCore({ engine: 'deepseek', capabilities: { pluginManage: true } }).pluginManage, true);
  assert.equal(customizeCore({ engine: 'deepseek', capabilities: {} }).pluginManage, false);
  assert.equal(customizeCore(null).pluginManage, false, 'Codex keeps the read-only page');
});

test('change results become page outcomes', () => {
  assert.deepEqual(pluginChangeOutcome({ changed: true, application: 'restart-required', stage: 'install', target: 'x', bundle: 'dsh-plugin-x' }), { ok: true, restartRequired: true, bundle: 'dsh-plugin-x' });
  assert.equal(pluginChangeOutcome({ changed: true, application: 'applied', stage: 'enable', target: 'x' }).restartRequired, false);
  const blocked = pluginChangeOutcome({ changed: false, application: 'failed', stage: 'install', target: 'x', pendingBuilds: ['esbuild'], packageResult: { kind: 'build-blocked', output: 'ERR' } });
  assert.deepEqual([blocked.ok, blocked.message, blocked.pendingBuilds, blocked.output], [false, 'The package needs to run build scripts.', ['esbuild'], 'ERR']);
  assert.match(pluginChangeOutcome({ changed: false, application: 'failed', stage: 'install', target: 'x', error: { code: 'incompatible-version', incompatible: [{ name: 'p', version: '2.0.0' }] } }).message, /does not support .*\(p@2\.0\.0\)/);
  assert.equal(pluginChangeOutcome({ changed: false, application: 'failed', stage: 'remove', target: 'x', error: { code: 'not-removable' } }).message, 'This plugin is part of Code Desktop and cannot be removed.');
  assert.deepEqual(pluginChangeOutcome({ changed: false, application: 'cancelled', stage: 'install', target: 'x' }), { ok: false, cancelled: true, message: 'Installation cancelled.' });
  assert.equal(pluginInstallStatus({ phase: 'installing', attempt: { registry: 'https://registry.npmjs.org/', index: 1, total: 2 } }), 'Installing from https://registry.npmjs.org/ (2/2)…');
  assert.equal(pluginInstallStatus({ phase: 'applying' }), 'Applying…');
  assert.equal(appendPluginLog('a'.repeat(PLUGIN_LOG_LIMIT), 'b').length, PLUGIN_LOG_LIMIT);
});

test('the store runs one install, follows its progress and output, and asks for a restart', async () => {
  const calls = [];
  let finish;
  const call = (kind, payload) => {
    calls.push(payload);
    if (payload.operation === 'plugins') return Promise.resolve(installed);
    if (payload.operation === 'plugin-install') return new Promise((resolve) => { finish = resolve; });
    if (payload.operation === 'plugin-cancel-install') return Promise.resolve({ status: 'cancelled' });
    if (payload.operation === 'plugin-set-enabled') return Promise.resolve({ changed: true, application: 'restart-required', stage: 'enable', target: payload.pluginName });
    return Promise.resolve({});
  };
  const store = createCustomizeStore({ call, setTimeout: () => 0, clearTimeout: () => {}, newId: () => 'req-1' });
  await store.loadPlugins({ cwd: '/repo' });
  const pending = store.installPlugin('dsh-plugin-y');
  assert.deepEqual(calls.at(-1), { operation: 'plugin-install', spec: 'dsh-plugin-y', requestId: 'req-1' });
  await assert.rejects(store.installPlugin('other'), /Another plugin/);
  store.observe({ method: 'codeDesktop/plugin/installProgress', params: { requestId: 'req-1', phase: 'installing', attempt: { registry: null, index: 0, total: 1 } } });
  store.observe({ method: 'codeDesktop/plugin/installLog', params: { requestId: 'req-1', stream: 'stdout', text: 'Packages: +1\n' } });
  store.observe({ method: 'codeDesktop/plugin/installLog', params: { requestId: 'someone-else', stream: 'stdout', text: 'ignored' } });
  assert.equal(store.getSnapshot().pluginOps.install.log, 'Packages: +1\n');
  assert.equal(store.getSnapshot().pluginOps.install.attempt.total, 1);
  finish({ changed: true, application: 'restart-required', stage: 'install', target: 'dsh-plugin-y', bundle: 'dsh-plugin-y' });
  const outcome = await pending;
  assert.equal(outcome.ok, true);
  assert.equal(store.getSnapshot().pluginOps.install.status, 'done');
  assert.equal(store.getSnapshot().pluginOps.restartRequired, true);
  assert.ok(calls.filter((payload) => payload.operation === 'plugins').length >= 2, 'the list reloads after a change');
  // A new core connection loaded the change.
  store.observe({ kind: 'connection', connected: true });
  assert.equal(store.getSnapshot().pluginOps.restartRequired, false);
  store.clearPluginInstall();
  assert.equal(store.getSnapshot().pluginOps.install, null);
  assert.equal((await store.setPluginEnabled('dsh-plugin-x', true)).ok, true);
  assert.deepEqual(calls.findLast((payload) => payload.operation === 'plugin-set-enabled'), { operation: 'plugin-set-enabled', pluginName: 'dsh-plugin-x', enabled: true });
  // A failed install keeps its outcome for the form; build approval retries with the names.
  const store2 = createCustomizeStore({ call: (kind, payload) => { calls.push(payload); return Promise.resolve(payload.operation === 'plugin-install' ? { changed: false, application: 'failed', stage: 'install', target: 'z', pendingBuilds: ['esbuild'], packageResult: { kind: 'build-blocked' } } : installed); }, newId: () => 'req-2' });
  assert.deepEqual((await store2.installPlugin('z')).pendingBuilds, ['esbuild']);
  assert.equal(store2.getSnapshot().pluginOps.install.status, 'failed');
  await store2.installPlugin('z', { approvedBuilds: ['esbuild'] });
  assert.deepEqual(calls.at(-1), { operation: 'plugin-install', spec: 'z', requestId: 'req-2', approvedBuilds: ['esbuild'] });
});

test('main-process operations validate and need a managing core', async () => {
  const requests = [];
  let capabilities = { pluginManage: true };
  const client = { start: async () => {}, get serverInfo() { return { capabilities }; }, request: async (method, params, timeout) => { requests.push({ method, params, timeout }); return { ok: true }; } };
  const ops = createCustomizeOperations({ getClient: () => client, getConfig: () => ({ threadIds: [] }), knownCwd: (cwd) => cwd });
  await ops.run({ operation: 'plugin-install', spec: ' dsh-plugin-y ', requestId: 'r1', approvedBuilds: ['esbuild'] });
  assert.deepEqual(requests.at(-1).params, { spec: 'dsh-plugin-y', requestId: 'r1', approvedBuilds: ['esbuild'] });
  assert.equal(requests.at(-1).method, 'codeDesktop/plugin/install');
  assert.ok(requests.at(-1).timeout >= 10 * 60 * 1000, 'an install may take minutes');
  await assert.rejects(ops.run({ operation: 'plugin-install', spec: '--registry=x', requestId: 'r1' }), /package name/);
  await assert.rejects(ops.run({ operation: 'plugin-install', spec: 'p', requestId: '../x' }), /Invalid install request/);
  await assert.rejects(ops.run({ operation: 'plugin-set-enabled', pluginName: 'p', enabled: 'yes' }), /Invalid plugin state/);
  await ops.run({ operation: 'plugin-remove', pluginName: 'dsh-plugin-x' });
  assert.deepEqual(requests.at(-1), { method: 'codeDesktop/plugin/remove', params: { pluginName: 'dsh-plugin-x' }, timeout: 5 * 60 * 1000 });
  capabilities = {};
  await assert.rejects(ops.run({ operation: 'plugin-inspect', spec: 'p' }), /not supported/);
});

test('the add form, restart notice and detail controls render their states', () => {
  const store = { inspectPlugin() {}, installPlugin() {}, cancelPluginInstall() {}, clearPluginInstall() {}, setPluginEnabled() {}, removePlugin() {} };
  const idle = renderToStaticMarkup(React.createElement(M.AddPluginForm, { store, install: null, onClose() {} }));
  assert.match(idle, /aria-label="Add plugin"/);
  assert.match(idle, /aria-label="Plugin package"/);
  assert.match(idle, />Install</);
  assert.doesNotMatch(idle, /Cancel install/);
  const running = renderToStaticMarkup(React.createElement(M.AddPluginForm, { store, install: { requestId: 'r', spec: 'p', status: 'running', phase: 'installing', attempt: { registry: 'https://registry.npmjs.org/', index: 0, total: 1 }, log: 'Progress: resolved 1', outcome: null }, onClose() {} }));
  assert.match(running, /Installing from https:\/\/registry\.npmjs\.org\/…/);
  assert.match(running, /Cancel install/);
  assert.match(running, /data-plugin-install="running"/);
  const blocked = renderToStaticMarkup(React.createElement(M.AddPluginForm, { store, install: { requestId: 'r', spec: 'p', status: 'failed', log: '', outcome: { ok: false, message: 'The package needs to run build scripts.', pendingBuilds: ['esbuild'] } }, onClose() {} }));
  assert.match(blocked, /role="alert">The package needs to run build scripts\./);
  assert.match(blocked, /<strong>esbuild<\/strong>/);
  assert.match(blocked, /Allow these scripts and retry/);
  const done = renderToStaticMarkup(React.createElement(M.AddPluginForm, { store, install: { requestId: 'r', spec: 'p', status: 'done', log: '', outcome: { ok: true, restartRequired: true, bundle: 'dsh-plugin-y' } }, onClose() {} }));
  assert.match(done, /Installed dsh-plugin-y\. Restart DeepSeek to load it\./);
  assert.match(done, />Close</);
  const banner = renderToStaticMarkup(React.createElement(M.PluginRestartBanner, { onRestartCore() {} }));
  assert.match(banner, /Plugin changes apply after DeepSeek restarts/);
  assert.match(banner, /Restart DeepSeek/);
  const [, x] = pluginRows(installed).sort((a, b) => (a.removable ? 1 : -1));
  const detail = renderToStaticMarkup(React.createElement(M.PluginDetail, { plugin: x, detail: { description: 'X' }, error: '', skills: [], view: null, onView() {}, onBack() {}, onSkill() {}, copy: customizeCore({ engine: 'deepseek', capabilities: { pluginManage: true } }), manage: React.createElement('span', { 'data-manage': '' }) }));
  assert.match(detail, /data-manage=""/);
  assert.match(detail, /This plugin could not load: Cannot find module/);
});
