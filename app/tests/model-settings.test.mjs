import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { createModelSettings } = require('../electron/model-settings.cjs');

const tier = (cacheHit, cacheMiss, output) => ({ cacheHit, cacheMiss, output });
const deepseek = (request = async () => ({})) => ({ serverInfo: { engine: 'deepseek-harness' }, start: async () => {}, request });
const codex = (request = async () => { throw new Error('should not be called'); }) => ({ serverInfo: { engine: 'codex' }, start: async () => {}, request });

test('decorate adds modelParams to thread methods on the DeepSeek core only', () => {
  const config = { modelSettings: { params: { 'deepseek-flash': { maxTokens: 4096, temperature: 0.4, effort: 'max' } } } };
  let client = deepseek();
  const settings = createModelSettings({ getConfig: () => config, getClient: () => client });
  for (const method of ['thread/start', 'thread/resume', 'turn/start']) {
    const params = { threadId: 't', codeDesktop: { afterPlan: 'auto', customization: { instructions: 'hi' } } };
    settings.decorate(method, params);
    assert.deepEqual(params.codeDesktop, { afterPlan: 'auto', customization: { instructions: 'hi', modelParams: { 'deepseek-flash': { maxTokens: 4096, temperature: 0.4 } } } });
  }
  const none = createModelSettings({ getConfig: () => ({}), getClient: () => client });
  const params = {};
  none.decorate('turn/start', params);
  assert.deepEqual(params, { codeDesktop: { customization: { modelParams: null } } }, 'null clears a value the bridge holds');
  const other = {};
  settings.decorate('thread/list', other);
  assert.deepEqual(other, {});
  client = codex();
  const codexParams = { threadId: 't' };
  settings.decorate('turn/start', codexParams);
  settings.decorate('account/usage/read', codexParams);
  assert.deepEqual(codexParams, { threadId: 't' });
});

test('decorate adds price overrides to account/usage/read', () => {
  const prices = { 'deepseek-flash': { offPeak: tier(0, 1, 2), peak: tier(0, 2, 4) } };
  let config = { modelSettings: { prices } };
  const settings = createModelSettings({ getConfig: () => config, getClient: () => deepseek() });
  const params = {};
  settings.decorate('account/usage/read', params);
  assert.deepEqual(params, { codeDesktop: { prices } });
  config = {};
  const reset = {};
  settings.decorate('account/usage/read', reset);
  assert.deepEqual(reset, { codeDesktop: { prices: null } });
});

test('official-prices reads codeDesktop/pricing/read; Codex or an old bridge is unsupported', async () => {
  const official = { 'deepseek-flash': { displayName: '4.1 Flash', offPeak: tier(0.02, 1, 4), peak: tier(0.04, 2, 8) } };
  const calls = [];
  const bridge = deepseek(async (method, params) => { calls.push([method, params]); return { official, aliases: { 'deepseek-v4-flash': 'deepseek-flash' }, pricingUrl: 'https://example.test/pricing', peakWindows: 'Beijing' }; });
  const settings = createModelSettings({ getConfig: () => ({}), getClient: () => bridge });
  assert.deepEqual(await settings.run({ op: 'official-prices' }), { official, aliases: { 'deepseek-v4-flash': 'deepseek-flash' }, pricingUrl: 'https://example.test/pricing', peakWindows: 'Beijing' });
  assert.deepEqual(calls, [['codeDesktop/pricing/read', {}]]);
  assert.deepEqual(await createModelSettings({ getConfig: () => ({}), getClient: () => codex() }).run({ op: 'official-prices' }), { unsupported: true });
  const old = deepseek(async () => { throw Object.assign(new Error('Method not found'), { code: -32601 }); });
  assert.deepEqual(await createModelSettings({ getConfig: () => ({}), getClient: () => old }).run({ op: 'official-prices' }), { unsupported: true });
  const broken = deepseek(async () => { throw new Error('boom'); });
  await assert.rejects(createModelSettings({ getConfig: () => ({}), getClient: () => broken }).run({ op: 'official-prices' }), /boom/);
  await assert.rejects(settings.run({ op: 'nope' }), /Unsupported/);
});

test('main.cjs wires the decorator before client.request and the desktop:call case', () => {
  const main = readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
  assert.match(main, /const \{ createModelSettings \} = require\("\.\/model-settings\.cjs"\);/);
  assert.match(main, /modelSettings\.decorate\(p\.method, params\);\n {8}if \(p\.method === "turn\/start"\) \{/);
  assert.match(main, /case "model-settings": return modelSettings\.run\(p\);/);
});

test('Settings › Models server-renders per-model rows, the price table and the Codex notice', async (t) => {
  const path = await import('node:path');
  const app = path.resolve(import.meta.dirname, '..');
  const React = (await import('react')).default;
  const { renderToStaticMarkup: render } = await import('react-dom/server');
  const { createServer } = await import('vite'), react = (await import('@vitejs/plugin-react')).default;
  const server = await createServer({ configFile: false, root: app, plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  t.after(() => server.close());
  const { SourceModelsSettings } = await server.ssrLoadModule('/src/source-settings-models.jsx');
  const models = [{ model: 'deepseek-flash', displayName: '4.1 Flash', defaultReasoningEffort: 'high', supportedReasoningEfforts: [{ reasoningEffort: 'off' }, { reasoningEffort: 'high' }, { reasoningEffort: 'max' }] }];
  const config = { modelSettings: { params: { 'deepseek-flash': { maxTokens: 8192, temperature: 0.3, effort: 'max' } }, prices: { 'my-model': { displayName: 'Mine', offPeak: tier(0, 1, 2), peak: tier(0, 2, 4) } } } };
  const page = (engine) => render(React.createElement(SourceModelsSettings, { config, boot: { connected: true, models }, engine, desktopCall: async () => ({ unsupported: true }), onSave: async () => {} }));
  const html = page('deepseek');
  assert.match(html, /<h3[^>]*>4\.1 Flash<\/h3>/);
  assert.match(html, /<input type="number"[^>]*aria-label="4.1 Flash max output tokens"[^>]*value="8192"/);
  assert.match(html, /aria-label="4.1 Flash temperature"[^>]*value="0.3"/);
  assert.match(html, /aria-label="4.1 Flash default reasoning effort"[^>]*data-value="max"/);
  assert.ok(html.includes('top_p is not supported by the DeepSeek Harness adapter.'));
  assert.match(html, /aria-label="Mine off-peak cache miss price"[^>]*value="1"/);
  assert.match(html, /Reset to official prices<\/span><\/button>/);
  const reset = /<button[^>]*>(?:(?!<button).)*Reset to official prices/.exec(html)[0];
  assert.doesNotMatch(reset.slice(0, reset.indexOf('>')), /disabled/, 'custom prices can be reset');
  assert.equal(html.includes('apply with the DeepSeek core'), false);
  const codex = page('codex');
  assert.ok(codex.includes('Model parameters and pricing apply with the DeepSeek core.'));
  assert.match(codex, /<input type="number"[^>]*aria-label="4.1 Flash max output tokens"[^>]*disabled=""/);
});

test('custom providers: definitions on disk, keys encrypted, one managed overlay row and env per route', async (t) => {
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'model-settings-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const safeStorage = { isEncryptionAvailable: () => true, encryptString: text => Buffer.from(`enc:${Buffer.from(text).toString('base64')}`), decryptString: buffer => Buffer.from(String(buffer).slice(4), 'base64').toString() };
  const rows = new Map(), env = new Map();
  const profile = { setManagedRow: async (id, row) => { rows.set(id, row); }, removeManagedRow: async id => { rows.delete(id); }, setCoreEnv: (key, value) => { if (value == null) env.delete(key); else env.set(key, value); } };
  const settings = createModelSettings({ getConfig: () => ({}), getClient: () => deepseek(), getHarnessProfile: () => profile, safeStorage, dir });
  assert.deepEqual(await settings.run({ op: 'providers-read' }), { available: true, protocols: ['openai-completions', 'openai-responses', 'anthropic-messages'], providers: [] });
  const saved = await settings.run({ op: 'provider-save', provider: { route: 'gw', baseURL: 'https://gw.example.com/v1', models: ['m1'] }, apiKey: 'sk-secret' });
  assert.deepEqual(saved.providers, [{ route: 'gw', api: 'openai-completions', baseURL: 'https://gw.example.com/v1', models: ['m1'], keyEnv: 'CODE_DESKTOP_PROVIDER_KEY_GW', hasKey: true }]);
  assert.equal(JSON.stringify(saved).includes('sk-secret'), false, 'the key never goes back to the renderer');
  assert.equal(fs.readFileSync(path.join(dir, 'providers.json'), 'utf8').includes('sk-secret'), false);
  assert.equal(fs.readFileSync(path.join(dir, 'provider-keys.bin'), 'utf8').includes('sk-secret'), false);
  assert.equal(rows.get('llm-pi-ai').config.providers.gw.apiKeyEnv, 'CODE_DESKTOP_PROVIDER_KEY_GW');
  assert.equal(env.get('CODE_DESKTOP_PROVIDER_KEY_GW'), 'sk-secret');
  // Rename keeps the key; an empty apiKey keeps it.
  await settings.run({ op: 'provider-save', previousRoute: 'gw', provider: { route: 'gw2', baseURL: 'https://gw.example.com/v1', models: ['m1', 'm2'] }, apiKey: '' });
  assert.equal(env.get('CODE_DESKTOP_PROVIDER_KEY_GW'), undefined);
  assert.equal(env.get('CODE_DESKTOP_PROVIDER_KEY_GW2'), 'sk-secret');
  assert.deepEqual(Object.keys(rows.get('llm-pi-ai').config.providers), ['gw2']);
  await assert.rejects(settings.run({ op: 'provider-save', provider: { route: 'deepseek', baseURL: 'https://x.test', models: ['m'] } }), /built-in/);
  const removed = await settings.run({ op: 'provider-remove', route: 'gw2' });
  assert.deepEqual(removed.providers, []);
  assert.equal(rows.has('llm-pi-ai'), false);
  assert.equal(env.size, 0);
  assert.equal(fs.existsSync(path.join(dir, 'provider-keys.bin')), false);
  // Without Settings › Harness the feature is unavailable.
  const bare = createModelSettings({ getConfig: () => ({}), getClient: () => deepseek(), safeStorage, dir });
  assert.equal((await bare.run({ op: 'providers-read' })).available, false);
  await assert.rejects(bare.run({ op: 'provider-save', provider: { route: 'gw', baseURL: 'https://gw.example.com/v1', models: ['m1'] }, apiKey: 'k' }), /Harness/);
});
