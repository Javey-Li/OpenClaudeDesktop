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
  assert.ok(codex.includes('The API connection, model parameters and pricing apply with the DeepSeek core.'));
  assert.ok(html.includes('API connection') && html.includes('aria-label="API provider"'), 'the connection group renders first');
  assert.match(html, /aria-label="DeepSeek API key"/);
  const plain = render(React.createElement(SourceModelsSettings, { config: {}, boot: { connected: true, models }, engine: 'deepseek', desktopCall: async () => ({ unsupported: true }), onSave: async () => {} }));
  assert.ok(plain.includes('Advanced'));
  assert.equal(plain.includes('aria-label="4.1 Flash max output tokens"'), false, 'Advanced starts closed when nothing in it was changed');
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

test('API connection: official or relay, keys encrypted, exported as DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL', async (t) => {
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'model-connection-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const saved = { key: process.env.DEEPSEEK_API_KEY, url: process.env.DEEPSEEK_BASE_URL };
  delete process.env.DEEPSEEK_API_KEY; delete process.env.DEEPSEEK_BASE_URL;
  t.after(() => { if (saved.key !== undefined) process.env.DEEPSEEK_API_KEY = saved.key; if (saved.url !== undefined) process.env.DEEPSEEK_BASE_URL = saved.url; });
  const safeStorage = { isEncryptionAvailable: () => true, encryptString: text => Buffer.from(`enc:${Buffer.from(text).toString('base64')}`), decryptString: buffer => Buffer.from(String(buffer).slice(4), 'base64').toString() };
  const env = new Map();
  const profile = { setManagedRow: async () => {}, removeManagedRow: async () => {}, setCoreEnv: (key, value) => { if (value == null) env.delete(key); else env.set(key, value); } };
  const forwarder = { calls: [], async start(url) { this.calls.push(['start', url]); return 'http://127.0.0.1:4321/anthropic'; }, async stop() { this.calls.push(['stop']); } };
  const settings = createModelSettings({ getConfig: () => ({}), getClient: () => deepseek(), getHarnessProfile: () => profile, safeStorage, dir, relayProxy: forwarder });
  assert.deepEqual(await settings.run({ op: 'connection-read' }), { available: true, mode: 'official', relayBaseURL: '', relayModels: [], officialKey: false, relayKey: false, inheritedKey: false });
  let view = await settings.run({ op: 'connection-save', connection: { mode: 'official' }, officialKey: 'sk-official' });
  assert.equal(view.officialKey, true);
  assert.equal(JSON.stringify(view).includes('sk-official'), false);
  assert.equal(env.get('DEEPSEEK_API_KEY'), 'sk-official');
  assert.equal(env.has('DEEPSEEK_BASE_URL'), false);
  await assert.rejects(settings.run({ op: 'connection-save', connection: { mode: 'relay', relayBaseURL: 'https://relay.test/anthropic' } }), /relay’s API key/);
  await assert.rejects(settings.run({ op: 'connection-save', connection: { mode: 'relay', relayBaseURL: 'mailto:x' }, relayKey: 'k' }), /https/);
  view = await settings.run({ op: 'connection-save', connection: { mode: 'relay', relayBaseURL: 'https://relay.test/anthropic/' }, relayKey: 'sk-relay' });
  assert.deepEqual(view, { available: true, mode: 'relay', relayBaseURL: 'https://relay.test/anthropic', relayModels: [], officialKey: true, relayKey: true, inheritedKey: false });
  assert.equal(env.get('DEEPSEEK_API_KEY'), 'sk-relay');
  assert.equal(env.get('DEEPSEEK_BASE_URL'), 'http://127.0.0.1:4321/anthropic', 'the core talks to the loopback forwarder');
  assert.deepEqual(forwarder.calls.at(-1), ['start', 'https://relay.test/anthropic']);
  assert.equal(fs.readFileSync(path.join(dir, 'provider-keys.bin'), 'utf8').includes('sk-'), false);
  // Back to official keeps both keys; removing the official key falls back to ~/.dsh.
  await settings.run({ op: 'connection-save', connection: { mode: 'official' } });
  assert.equal(env.get('DEEPSEEK_API_KEY'), 'sk-official');
  assert.equal(env.has('DEEPSEEK_BASE_URL'), false);
  view = await settings.run({ op: 'connection-save', officialKey: null });
  assert.equal(view.officialKey, false);
  assert.equal(view.relayKey, true);
  assert.equal(env.has('DEEPSEEK_API_KEY'), false);
  // Provider routes never see the reserved key names.
  assert.deepEqual((await settings.run({ op: 'providers-read' })).providers, []);
});

test('relay models replace the llm-deepseek catalog; connection-models reads the relay /v1/models', async (t) => {
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'model-relay-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const safeStorage = { isEncryptionAvailable: () => true, encryptString: text => Buffer.from(`enc:${Buffer.from(text).toString('base64')}`), decryptString: buffer => Buffer.from(String(buffer).slice(4), 'base64').toString() };
  const rows = new Map();
  const profile = { setManagedRow: async (id, row) => { rows.set(id, row); }, removeManagedRow: async id => { rows.delete(id); }, setCoreEnv: () => {} };
  const forwarder = { async start() { return 'http://127.0.0.1:4321'; }, async stop() {} };
  const settings = createModelSettings({ getConfig: () => ({}), getClient: () => deepseek(), getHarnessProfile: () => profile, safeStorage, dir, relayProxy: forwarder });
  const view = await settings.run({ op: 'connection-save', connection: { mode: 'relay', relayBaseURL: 'https://relay.test', relayModels: 'deepseek-v4.1-flash\nglm-5.2, glm-5.2' }, relayKey: 'sk-relay' });
  assert.deepEqual(view.relayModels, ['deepseek-v4.1-flash', 'glm-5.2']);
  assert.deepEqual(rows.get('llm-deepseek'), { config: { models: [{ id: 'deepseek-v4.1-flash', name: 'deepseek-v4.1-flash' }, { id: 'glm-5.2', name: 'glm-5.2' }] } });
  await settings.run({ op: 'connection-save', connection: { mode: 'official' } });
  assert.equal(rows.has('llm-deepseek'), false, 'the official API keeps the built-in catalog');
  await assert.rejects(settings.run({ op: 'connection-save', connection: { mode: 'relay', relayBaseURL: 'https://relay.test', relayModels: 'bad id!' } }), /Invalid model id/);
  const realFetch = globalThis.fetch, calls = [];
  t.after(() => { globalThis.fetch = realFetch; });
  globalThis.fetch = async (url, init) => { calls.push([url, init.headers.authorization]); return { ok: true, json: async () => ({ data: [{ id: 'glm-5.2' }, { id: 'deepseek-v4-pro' }] }) }; };
  assert.deepEqual(await settings.run({ op: 'connection-models', relayBaseURL: 'https://relay.test/' }), { models: ['glm-5.2', 'deepseek-v4-pro'] });
  assert.deepEqual(calls, [['https://relay.test/v1/models', 'Bearer sk-relay']], 'the saved relay key, /v1 added once');
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(settings.run({ op: 'connection-models', relayBaseURL: 'https://relay.test/v1', relayKey: 'typed' }), /401/);
});

test('relay forwarder renames <system-reminder> in request bodies and streams the reply back', async (t) => {
  const http = await import('node:http');
  const { createRelayProxy, rewriteBody } = require('../electron/relay-proxy.cjs');
  assert.equal(rewriteBody('a<system-reminder>x</system-reminder>b'), 'a<system_reminder>x</system_reminder>b');
  const seen = [];
  const relay = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    seen.push({ url: req.url, key: req.headers['x-api-key'], body: Buffer.concat(chunks).toString() });
    res.writeHead(200, { 'content-type': 'text/event-stream' }); res.write('data: one\n\n'); setTimeout(() => res.end('data: two\n\n'), 20);
  });
  await new Promise(resolve => relay.listen(0, '127.0.0.1', resolve));
  const proxy = createRelayProxy();
  t.after(async () => { await proxy.stop(); relay.close(); });
  const base = await proxy.start(`http://127.0.0.1:${relay.address().port}/anthropic/`);
  assert.match(base, /^http:\/\/127\.0\.0\.1:\d+\/anthropic$/);
  const response = await fetch(`${base}/v1/messages`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': 'k' }, body: JSON.stringify({ messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }, { type: 'text', text: '<system-reminder>skills</system-reminder>' }] }] }) });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'data: one\n\ndata: two\n\n');
  assert.equal(seen[0].url, '/anthropic/v1/messages');
  assert.equal(seen[0].key, 'k');
  assert.ok(seen[0].body.includes('<system_reminder>skills</system_reminder>') && !seen[0].body.includes('<system-reminder>'));
});
