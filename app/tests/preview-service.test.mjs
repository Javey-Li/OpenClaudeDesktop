// The preview service's renderer requests and safety rules (electron/preview-service.cjs) with stand-in Electron
// objects; dev servers are real child processes in a temp folder. The real WebContentsView path runs in
// preview-service-electron.test.mjs (opt-in).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createPreviewService, previewShortcut } = require('../electron/preview-service.cjs');

function fakeElectron() {
  const windows = new Map();
  const cdp = [];
  const partition = { handlers: {}, setPermissionRequestHandler(fn) { this.handlers.request = fn; }, setPermissionCheckHandler(fn) { this.handlers.check = fn; },
    on(event, fn) { this.handlers[event] = fn; }, webRequest: { onBeforeRequest(filter, fn) { partition.handlers.beforeRequest = fn; } }, getUserAgent: () => 'UA' };
  let nextId = 1;
  class Contents extends EventEmitter {
    constructor() {
      super();
      this.id = nextId++; this.url = ''; this.title = ''; this.entries = []; this.index = -1; this.session = partition; this.devtools = false; this.destroyed = false;
      this.navigationHistory = { canGoBack: () => this.index > 0, canGoForward: () => this.index < this.entries.length - 1, goBack: () => this.go(this.index - 1), goForward: () => this.go(this.index + 1) };
      this.debugger = { attached: false, attach: () => { this.debugger.attached = true; }, isAttached: () => this.debugger.attached, on() {},
        sendCommand: async (method, params) => { cdp.push([method, params]); return method === 'Page.captureScreenshot' ? { data: Buffer.from('png').toString('base64') } : {}; } };
    }
    isDestroyed() { return this.destroyed; }
    setWindowOpenHandler(fn) { this.openHandler = fn; }
    go(index) { this.index = index; this.url = this.entries[index]; this.emit('did-navigate', {}, this.url); }
    async loadURL(url) {
      this.emit('did-start-loading');
      this.entries = [...this.entries.slice(0, this.index + 1), url]; this.index = this.entries.length - 1; this.url = url; this.title = `Title of ${url}`;
      this.emit('did-navigate', {}, url);
      setImmediate(() => { this.emit('did-finish-load'); this.emit('did-stop-loading'); });
    }
    getURL() { return this.url; }
    getTitle() { return this.title; }
    isDevToolsOpened() { return this.devtools; }
    openDevTools() { this.devtools = true; } closeDevTools() { this.devtools = false; }
    reload() {} stop() {} focus() {} close() { this.destroyed = true; }
    async executeJavaScriptInIsolatedWorld() { return { ok: true }; }
  }
  class WebContentsView {
    constructor(options) { this.options = options; this.webContents = new Contents(); this.bounds = null; this.visible = true; }
    setBounds(bounds) { this.bounds = bounds; } setVisible(value) { this.visible = value; } setBackgroundColor() {}
  }
  class BrowserWindow extends EventEmitter {
    constructor(options = {}) { super(); this.options = options; this.children = new Set(); this.destroyed = false; this.contentView = { addChildView: (view) => this.children.add(view), removeChildView: (view) => this.children.delete(view) }; }
    isDestroyed() { return this.destroyed; } isVisible() { return this.options.show !== false; } destroy() { this.destroyed = true; this.emit('closed'); }
    static fromWebContents(sender) { return windows.get(sender) ?? null; }
  }
  const sender = (zoom = 1) => {
    const contents = Object.assign(new EventEmitter(), { sent: [], isDestroyed: () => false, getZoomFactor: () => zoom, send(channel, event) { this.sent.push(event); }, focus() {} });
    windows.set(contents, new BrowserWindow({ show: true }));
    return contents;
  };
  const opened = [];
  return { electron: { WebContentsView, BrowserWindow, session: { fromPartition: () => partition }, shell: { openExternal: async (url) => { opened.push(url); }, openPath: async () => '' }, nativeTheme: { shouldUseDarkColors: false } },
    partition, cdp, sender, windows, opened };
}

const freePort = () => new Promise((resolve) => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)); }); });
function project(configurations) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-service-'));
  fs.mkdirSync(path.join(dir, '.claude'));
  fs.writeFileSync(path.join(dir, 'server.js'), 'require("node:http").createServer((q, s) => s.end("ok")).listen(Number(process.env.PORT), "127.0.0.1", () => console.log("listening " + process.env.PORT));');
  if (configurations) fs.writeFileSync(path.join(dir, '.claude/launch.json'), JSON.stringify({ version: '0.0.1', configurations }));
  return dir;
}

function service(cwd, fake = fakeElectron()) {
  const instance = createPreviewService({ electron: fake.electron, getSession: (id) => (id === 's1' || id === 's2' ? { id, cwd } : null), spawnEnv: async () => ({ ...process.env }), logger: { warn() {} } });
  return { fake, instance };
}

test('renderer requests are validated: unknown action, unknown session, unsafe addresses, bad viewports', async (t) => {
  const cwd = project([{ name: 'web', runtimeExecutable: process.execPath, runtimeArgs: ['server.js'], port: 4999 }]);
  const { fake, instance } = service(cwd);
  t.after(() => { instance.dispose(); fs.rmSync(cwd, { recursive: true, force: true }); });
  const sender = fake.sender();
  await assert.rejects(instance.call(sender, 'preview-nope', { sessionId: 's1' }), /Unknown operation/);
  await assert.rejects(instance.call(sender, 'preview-state', { sessionId: 'other' }), /Unknown session/);
  const state = await instance.call(sender, 'preview-state', { sessionId: 's1' });
  assert.deepEqual(state.launch.configs, [{ name: 'web', port: 4999, url: 'http://localhost:4999', attach: false }]);
  assert.equal(state.hasPage, false);
  await assert.rejects(instance.call(sender, 'preview-navigate', { sessionId: 's1', url: 'chrome://settings' }), /web pages \(http and https\)/);
  await assert.rejects(instance.call(sender, 'preview-navigate', { sessionId: 's1', url: 'file:///etc/hosts' }), /session’s folder only/);
  await assert.rejects(instance.call(sender, 'preview-emulate', { sessionId: 's1', preset: 'watch' }), /Unknown viewport preset/);
  await assert.rejects(instance.call(sender, 'preview-emulate', { sessionId: 's1', preset: 'custom', width: 50, height: 50 }), /200–4000/);
  await assert.rejects(instance.call(sender, 'preview-emulate', { sessionId: 's1', colorScheme: 'sepia' }), /Unknown color scheme/);
  await assert.rejects(instance.call(sender, 'preview-capture', { sessionId: 's1' }), /Nothing is open/);
  await assert.rejects(instance.call(sender, 'preview-external', { sessionId: 's1' }), /only works for websites/);
  await assert.rejects(instance.call(sender, 'preview-attach', { sessionId: 's1' }), /Unknown preview pane/);
});

test('the partition denies permissions and downloads, and file loads outside the folder', async (t) => {
  const cwd = project(null);
  const { fake, instance } = service(cwd);
  t.after(() => { instance.dispose(); fs.rmSync(cwd, { recursive: true, force: true }); });
  const sender = fake.sender();
  await instance.call(sender, 'preview-navigate', { sessionId: 's1', url: 'localhost:3000' });
  const { handlers } = fake.partition;
  const ask = (permission, requestingUrl) => new Promise((resolve) => handlers.request(null, permission, resolve, { requestingUrl }));
  assert.equal(await ask('media', 'http://localhost:3000/'), false);
  assert.equal(await ask('notifications', 'http://localhost:3000/'), false);
  assert.equal(await ask('clipboard-sanitized-write', 'http://localhost:3000/'), true);
  assert.equal(await ask('clipboard-sanitized-write', 'https://example.com/'), false);
  assert.equal(handlers.check(null, 'geolocation', 'http://localhost:3000'), false);
  let prevented = false;
  handlers['will-download']({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true, 'downloads are refused');
  const view = instance._previews.get('s1').view;
  const fileRequest = (url) => new Promise((resolve) => handlers.beforeRequest({ url, webContentsId: view.webContents.id }, resolve));
  assert.deepEqual(await fileRequest(`file://${cwd}/index.html`), { cancel: false });
  assert.deepEqual(await fileRequest('file:///etc/passwd'), { cancel: true });
  // Outside hosts: a page the user opened reaches them; a local file page the agent drives reaches only allowed ones.
  const subresource = (url, resourceType = 'xhr') => new Promise((resolve) => handlers.beforeRequest({ url, resourceType, webContentsId: view.webContents.id }, resolve));
  assert.deepEqual(await subresource('https://cdn.example.com/a.js', 'script'), { cancel: false }, 'the user\'s own page');
  const entry = instance._previews.get('s1');
  entry.agentDriven = true;
  assert.deepEqual(await subresource('https://evil.example.com/?d=x'), { cancel: false }, 'a localhost dev page keeps its outside requests');
  view.webContents.url = `file://${cwd}/index.html`;
  assert.deepEqual(await subresource('https://evil.example.com/?d=x'), { cancel: true }, 'an agent-driven file page reaches no outside host');
  assert.deepEqual(await subresource('wss://evil.example.com/s'), { cancel: true });
  assert.deepEqual(await subresource('http://localhost:5173/api'), { cancel: false });
  assert.deepEqual(await subresource('https://evil.example.com/', 'mainFrame'), { cancel: false }, 'navigations have their own gate (holdOutside)');
  assert.match(entry.console.at(-1).text, /blocked a request to evil\.example\.com/);
  entry.approvedHosts.add('api.example.com');
  assert.deepEqual(await subresource('https://api.example.com/v1'), { cancel: false }, 'a site allowed in this session');
  entry.agentDriven = false;
  assert.equal(view.options.webPreferences.nodeIntegration, false);
  assert.equal(view.options.webPreferences.contextIsolation, true);
  assert.equal(view.options.webPreferences.sandbox, true);
  assert.equal(view.options.webPreferences.disableDialogs, true);
});

test('a download from a shown page gets the Save dialog in Downloads; an unseen page\'s download is cancelled and says why', async (t) => {
  const cwd = project(null);
  const { fake, instance } = service(cwd);
  t.after(() => { instance.dispose(); fs.rmSync(cwd, { recursive: true, force: true }); });
  const sender = fake.sender();
  await instance.call(sender, 'preview-navigate', { sessionId: 's1', url: 'http://localhost:3000/' });
  const entry = instance._previews.get('s1');
  const item = (name) => Object.assign(new EventEmitter(), { options: null, getFilename: () => name, setSaveDialogOptions(options) { this.options = options; }, getSavePath: () => '', getURLChain: () => ['http://localhost:3000/download'], getURL: () => 'http://localhost:3000/download' });
  // Nobody shows the page (parked): no dialog could reach the user.
  let prevented = false;
  const unseen = item('report.csv');
  fake.partition.handlers['will-download']({ preventDefault: () => { prevented = true; } }, unseen, entry.view.webContents);
  assert.equal(prevented, true);
  assert.equal(unseen.options, null);
  assert.match(entry.console.at(-1).text, /didn’t download report\.csv: the preview isn’t on screen/);
  let state = await instance.call(sender, 'preview-state', { sessionId: 's1' });
  assert.deepEqual({ ...state.download, at: 0 }, { file: 'report.csv', state: 'cancelled', reason: 'not-shown', at: 0, canReveal: false });
  // Shown in a pane: the download runs, through the system Save dialog that starts in Downloads.
  await instance.call(sender, 'preview-attach', { sessionId: 's1', instanceId: 'pane', bounds: { x: 0, y: 0, width: 300, height: 300 }, visible: true });
  prevented = false;
  const shown = item('report.csv');
  fake.partition.handlers['will-download']({ preventDefault: () => { prevented = true; } }, shown, entry.view.webContents);
  assert.equal(prevented, false, 'the download proceeds');
  assert.equal(shown.options.defaultPath, path.join(os.homedir(), 'Downloads', 'report.csv'));
  assert.equal((await instance.call(sender, 'preview-state', { sessionId: 's1' })).download.state, 'saving');
  const saved = path.join(cwd, 'report.csv');
  fs.writeFileSync(saved, 'a,b\n');
  shown.getSavePath = () => saved;
  shown.emit('done', {}, 'completed');
  state = await instance.call(sender, 'preview-state', { sessionId: 's1' });
  assert.equal(state.download.state, 'completed');
  assert.equal(state.download.canReveal, true);
  // A download nobody's page started (another contents) is refused.
  prevented = false;
  fake.partition.handlers['will-download']({ preventDefault: () => { prevented = true; } }, item('x.bin'), { id: 9999 });
  assert.equal(prevented, true);
});

test('the pane showing the page holds it; another pane is refused until it lets go; a pane that leaves parks it', async (t) => {
  const cwd = project(null);
  const { fake, instance } = service(cwd);
  t.after(() => { instance.dispose(); fs.rmSync(cwd, { recursive: true, force: true }); });
  const first = fake.sender(1.25), second = fake.sender();
  const attach = (sender, instanceId, patch = {}) => instance.call(sender, 'preview-attach', { sessionId: 's1', instanceId, bounds: { x: 0, y: 0, width: 200, height: 200 }, visible: true, ...patch });
  await instance.call(first, 'preview-navigate', { sessionId: 's1', url: 'http://localhost:3000/' });
  const entry = instance._previews.get('s1');
  const parking = entry.parent;
  assert.equal(parking.options.show, false, 'a page nobody shows lives in a hidden window');
  let state = await attach(first, 'pane-a', { bounds: { x: 100, y: 40, width: 400, height: 300 } });
  assert.equal(state.hostId, 'pane-a');
  assert.equal(entry.parent, fake.windows.get(first));
  assert.deepEqual(entry.view.bounds, { x: 125, y: 50, width: 500, height: 375 }, 'CSS pixels scaled by the window zoom');
  assert.equal(entry.view.visible, true);
  // 2.2553.1 showPreview: a non-owner claimant is refused while the owner shows the page; its hide is ignored too.
  state = await attach(second, 'pane-b');
  assert.equal(state.hostId, 'pane-a', 'a second pane does not take the page');
  assert.equal(state.hasPage, true, 'it still knows there is a page (and paints its empty viewport)');
  assert.equal(entry.parent, fake.windows.get(first));
  await attach(second, 'pane-b', { visible: false });
  await instance.call(second, 'preview-detach', { sessionId: 's1', instanceId: 'pane-b' });
  assert.equal(entry.parent, fake.windows.get(first), 'another pane’s hide leaves the page where it is');
  assert.equal(entry.view.visible, true);
  // The holder hides it (start page, collapsed pane): it lets go, and the next pane that shows the page takes it.
  state = await attach(first, 'pane-a', { visible: false });
  assert.equal(state.hostId, null, 'nobody shows the page');
  state = await attach(second, 'pane-b');
  assert.equal(state.hostId, 'pane-b');
  assert.equal(entry.parent, fake.windows.get(second));
  state = await attach(first, 'pane-a');
  assert.equal(state.hostId, 'pane-b', 'the first pane is refused now');
  // An overlay over the holder hides the page behind a capture — and lets go of it, like 2.2553.1's occluded slot.
  const occluded = await instance.call(second, 'preview-occlude', { sessionId: 's1', instanceId: 'pane-b', occluded: true });
  assert.match(occluded.image, /^data:image\/jpeg;base64,/);
  assert.equal(entry.view.visible, false, 'hidden while an overlay covers it');
  assert.equal(instance.snapshot('s1').hostId, null);
  await instance.call(second, 'preview-occlude', { sessionId: 's1', instanceId: 'pane-b', occluded: false });
  assert.equal(entry.view.visible, true);
  assert.equal(instance.snapshot('s1').hostId, 'pane-b', 'nobody took it meanwhile, so it shows again');
  await instance.call(second, 'preview-occlude', { sessionId: 's1', instanceId: 'pane-b', occluded: true });
  state = await attach(first, 'pane-a');
  assert.equal(state.hostId, 'pane-a', 'a pane takes the page while the holder is covered');
  assert.equal(entry.view.visible, true, 'the cover over the other pane does not hide it here');
  await instance.call(second, 'preview-occlude', { sessionId: 's1', instanceId: 'pane-b', occluded: false });
  assert.equal(entry.parent, fake.windows.get(first), 'the covered pane does not get it back when the cover leaves');
  await instance.call(first, 'preview-detach', { sessionId: 's1', instanceId: 'pane-a' });
  assert.equal(entry.parent.options.show, false, 'parked again');
  assert.equal(instance.snapshot('s1').hostId, null);
  assert.equal((await instance.call(first, 'preview-state', { sessionId: 's1' })).url, 'http://localhost:3000/');
});

test('a page nobody shows is closed after the reap delay and reopens at its address; outside sites and dev servers stay', async (t) => {
  const port = await freePort();
  const cwd = project([{ name: 'web', runtimeExecutable: process.execPath, runtimeArgs: ['server.js'], port }]);
  const fake = fakeElectron();
  const instance = createPreviewService({ electron: fake.electron, getSession: (id) => (id === 's1' || id === 's2' ? { id, cwd } : null), spawnEnv: async () => ({ ...process.env }), logger: { warn() {} }, reapHiddenMs: 40 });
  t.after(() => { instance.dispose(); fs.rmSync(cwd, { recursive: true, force: true }); });
  const sender = fake.sender();
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const started = await instance.call(sender, 'preview-server-start', { sessionId: 's1', name: 'web' });
  assert.equal(started.ok, true, started.message);
  const entry = instance._previews.get('s1');
  const url = entry.url;
  await instance.call(sender, 'preview-attach', { sessionId: 's1', instanceId: 'pane', bounds: { x: 0, y: 0, width: 300, height: 300 }, visible: true });
  await wait(90);
  assert.ok(entry.view, 'a shown page is never reaped');
  entry.console.push({ level: 'error', text: 'old error', url: '', line: null, time: 0 });
  const firstView = entry.view;
  await instance.call(sender, 'preview-detach', { sessionId: 's1', instanceId: 'pane' });
  await wait(90);
  assert.equal(entry.view, null, 'reaped once nobody showed it for the delay');
  assert.equal(firstView.webContents.isDestroyed(), true);
  assert.equal(entry.parent, null);
  const snapshot = instance.snapshot('s1');
  assert.equal(snapshot.hasPage, true, 'the pane still offers the page');
  assert.equal(snapshot.url, url);
  assert.equal(snapshot.servers.find((server) => server.name === 'web').status, 'running', 'the dev server keeps running');
  const agent = instance.forSession({ id: 's1', cwd });
  assert.equal(agent.consoleMessages(), null, 'earlier console output is gone (the tool says so)');
  assert.equal(agent.networkRequests(), null);
  assert.equal(agent.list().page.reclaimed, true);
  // The agent's next page tool reopens it, unseen, at the same address.
  const shot = await agent.screenshot();
  assert.equal(shot.mimeType, 'image/jpeg');
  assert.ok(entry.view && entry.view !== firstView, 'a new page');
  assert.equal(entry.view.webContents.getURL(), url);
  assert.deepEqual(agent.consoleMessages(), [], 'fresh output');
  assert.equal(entry.parent.options.show, false, 'in the parking window');
  // Showing a pane reopens a reaped page too.
  await wait(90);
  assert.equal(entry.view, null, 'reaped again');
  await instance.call(sender, 'preview-attach', { sessionId: 's1', instanceId: 'pane', bounds: { x: 0, y: 0, width: 300, height: 300 }, visible: true });
  assert.ok(entry.view, 'the pane reopens it');
  assert.equal(entry.parent, fake.windows.get(sender));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(entry.view.webContents.getURL(), url);
  // An outside site is never reaped (2.2553.1 reaps port and static previews only).
  const outside = instance.forSession({ id: 's2', cwd }, { requestApproval: async () => true });
  await outside.navigate('https://example.com/');
  await wait(90);
  assert.ok(instance._previews.get('s2').view, 'an outside site stays open');
  await instance.call(sender, 'preview-server-stop', { sessionId: 's1', name: 'web' });
});

test('viewport presets and the color scheme go to CDP emulation; screenshots come from CDP', async (t) => {
  const cwd = project(null);
  const { fake, instance } = service(cwd);
  t.after(() => { instance.dispose(); fs.rmSync(cwd, { recursive: true, force: true }); });
  const sender = fake.sender();
  await instance.call(sender, 'preview-navigate', { sessionId: 's1', url: 'http://localhost:3000/' });
  await instance.call(sender, 'preview-attach', { sessionId: 's1', instanceId: 'pane', bounds: { x: 0, y: 0, width: 300, height: 600 }, visible: true });
  const viewport = await instance.call(sender, 'preview-emulate', { sessionId: 's1', preset: 'mobile', colorScheme: 'dark' });
  assert.deepEqual(viewport, { preset: 'mobile', width: 375, height: 812, colorScheme: 'dark', setByAgent: false });
  await instance._previews.get('s1').emulating;
  const metrics = fake.cdp.filter(([method]) => method === 'Emulation.setDeviceMetricsOverride').at(-1)[1];
  assert.equal(metrics.width, 375);
  assert.equal(metrics.mobile, true);
  assert.ok(metrics.scale < 1, 'scaled to fit the pane');
  const view = instance._previews.get('s1').view;
  assert.ok(view.bounds.width <= 300 && view.bounds.height <= 600);
  assert.deepEqual(fake.cdp.filter(([method]) => method === 'Emulation.setEmulatedMedia').at(-1)[1], { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  assert.ok(fake.cdp.some(([method, params]) => method === 'Emulation.setUserAgentOverride' && /Android/.test(params.userAgent)));
  const shot = await instance.call(sender, 'preview-capture', { sessionId: 's1' });
  assert.equal(Buffer.from(shot.bytes).toString(), 'png');
  assert.equal(shot.type, 'image/png');
});

test('dev servers: start from launch.json, reuse, logs, stop; busy port, autoPort and a missing command', async (t) => {
  const port = await freePort();
  const busy = net.createServer().listen(0, '127.0.0.1');
  await new Promise((resolve) => busy.once('listening', resolve));
  const busyPort = busy.address().port;
  const cwd = project([
    { name: 'web', runtimeExecutable: process.execPath, runtimeArgs: ['server.js'], port },
    { name: 'clash', runtimeExecutable: process.execPath, runtimeArgs: ['server.js'], port: busyPort },
    { name: 'auto', runtimeExecutable: process.execPath, runtimeArgs: ['server.js'], port: busyPort, autoPort: true },
    { name: 'ghost', runtimeExecutable: 'definitely-not-a-command-xyz', port: await freePort() },
  ]);
  const { fake, instance } = service(cwd);
  t.after(() => { instance.dispose(); busy.close(); fs.rmSync(cwd, { recursive: true, force: true }); });
  const sender = fake.sender();
  const started = await instance.call(sender, 'preview-server-start', { sessionId: 's1', name: 'web' });
  assert.equal(started.ok, true, started.message);
  assert.equal(started.server.status, 'running');
  assert.match(instance.snapshot('s1').url, new RegExp(`^http://localhost:${port}/?$`));
  assert.equal(instance.snapshot('s2').servers.find((server) => server.name === 'web').status, 'running', 'sessions of the same folder share the server');
  const serverAsks = [];
  const agent = instance.forSession({ id: 's2', cwd }, { requestApproval: async (request) => { serverAsks.push(request); return true; } });
  const again = await agent.start({ name: 'web' });
  assert.equal(again.reused, true);
  assert.deepEqual(serverAsks, [], 'a server already running starts nothing, so nothing is asked');
  const logs = await instance.call(sender, 'preview-server-logs', { sessionId: 's1', name: 'web' });
  assert.ok(logs.lines.some((line) => line.includes(`listening ${port}`)), logs.lines.join('\n'));
  const clash = await instance.call(sender, 'preview-server-start', { sessionId: 's1', name: 'clash' });
  assert.deepEqual({ ok: clash.ok, code: clash.code }, { ok: false, code: 'port-in-use' });
  const auto = await agent.start({ name: 'auto' });
  assert.notEqual(auto.server.port, busyPort);
  assert.equal(auto.assignedPort, auto.server.port);
  assert.deepEqual(serverAsks.map(({ kind, name, command, args, cwd: folder }) => ({ kind, name, command, args, folder })),
    [{ kind: 'preview-server', name: 'auto', command: process.execPath, args: ['server.js'], folder: cwd }], 'the agent starting a command asks first, with the exact command line');
  const ghost = await instance.call(sender, 'preview-server-start', { sessionId: 's1', name: 'ghost' });
  assert.deepEqual({ ok: ghost.ok, code: ghost.code }, { ok: false, code: 'not-found' });
  const missing = await instance.call(sender, 'preview-server-start', { sessionId: 's1', name: 'nope' });
  assert.equal(missing.code, 'no-server');
  await instance.call(sender, 'preview-server-stop', { sessionId: 's1', name: 'web' });
  assert.equal(instance.snapshot('s1').servers.find((server) => server.name === 'web').status, 'stopped');
  await agent.stop('auto');
});

test('the agent asks once per outside site; localhost never asks', async (t) => {
  const cwd = project(null);
  const { instance } = service(cwd);
  t.after(() => { instance.dispose(); fs.rmSync(cwd, { recursive: true, force: true }); });
  const asked = [];
  let answer = false;
  const agent = instance.forSession({ id: 's1', cwd }, { requestApproval: async (request) => { asked.push(request); return answer; } });
  await agent.navigate('http://localhost:3000/');
  assert.deepEqual(asked, []);
  await assert.rejects(agent.navigate('https://example.com/'), /didn’t allow opening example\.com/);
  answer = true;
  await assert.rejects(agent.navigate('https://example.com/a'), /didn’t allow opening example\.com/, 'a declined site stays declined in this session');
  assert.deepEqual(asked.map((request) => request.host), ['example.com'], 'and is never asked about again');
  await agent.navigate('https://example.org/a');
  await agent.navigate('https://example.org/b');
  assert.deepEqual(asked.map((request) => request.host), ['example.com', 'example.org'], 'an allowed site is remembered');
  await assert.rejects(agent.click({}), /Name an element/);
});

test('the host window comes from the injected lookup (window registry); a closed window parks its pages', async (t) => {
  const cwd = project(null);
  const fake = fakeElectron();
  const asked = [];
  const instance = createPreviewService({ electron: fake.electron, getSession: (id) => (id === 's1' || id === 's2' ? { id, cwd } : null), logger: { warn() {} },
    hostWindow: (sender) => { asked.push(sender); return fake.windows.get(sender) ?? null; } });
  t.after(() => { instance.dispose(); fs.rmSync(cwd, { recursive: true, force: true }); });
  const sender = fake.sender();
  const window = fake.windows.get(sender);
  await instance.call(sender, 'preview-navigate', { sessionId: 's1', url: 'http://localhost:3000/' });
  await instance.call(sender, 'preview-navigate', { sessionId: 's2', url: 'http://localhost:4000/' });
  // Two split sides of one window: two sessions, two views, side by side in the same window.
  await instance.call(sender, 'preview-attach', { sessionId: 's1', instanceId: 'left', bounds: { x: 0, y: 0, width: 300, height: 400 }, visible: true });
  await instance.call(sender, 'preview-attach', { sessionId: 's2', instanceId: 'right', bounds: { x: 640, y: 0, width: 300, height: 400 }, visible: true });
  assert.ok(asked.includes(sender));
  const left = instance._previews.get('s1'), right = instance._previews.get('s2');
  assert.equal(left.parent, window);
  assert.equal(right.parent, window);
  assert.equal(right.view.bounds.x, 640);
  instance.windowClosed(window);
  assert.notEqual(left.parent, window);
  assert.equal(left.parent.options.show, false, 'parked in the hidden window');
  assert.equal(right.parent.options.show, false);
  assert.equal(instance.snapshot('s1').hostId, null);
});

test('the agent starts a launch.json command only after the user approves that exact configuration', async (t) => {
  const port = await freePort();
  const cwd = project([
    { name: 'web', runtimeExecutable: process.execPath, runtimeArgs: ['server.js'], port },
    { name: 'site', url: `http://localhost:${port}` },
  ]);
  const { fake, instance } = service(cwd);
  t.after(() => { instance.dispose(); fs.rmSync(cwd, { recursive: true, force: true }); });
  const asked = [];
  let answer = false;
  const agent = instance.forSession({ id: 's1', cwd }, { requestApproval: async (request) => { asked.push(request); return answer; } });
  await assert.rejects(agent.start({ name: 'web' }), (error) => error.code === 'declined' && /didn’t allow starting “web”\. Nothing was run\./.test(error.message));
  assert.equal(instance._servers.size, 0, 'a declined command never runs');
  answer = true;
  const started = await agent.start({ name: 'web' });
  assert.equal(started.server.status, 'running');
  await agent.stop('web');
  await agent.start({ name: 'web' });
  assert.equal(asked.length, 2, 'approved once per configuration and session');
  await agent.stop('web');
  // An edited launch.json is a new command: asked again.
  fs.writeFileSync(path.join(cwd, '.claude/launch.json'), JSON.stringify({ version: '0.0.1', configurations: [{ name: 'web', runtimeExecutable: process.execPath, runtimeArgs: ['server.js', '--edited'], port }] }));
  await agent.start({ name: 'web' });
  assert.equal(asked.length, 3);
  assert.deepEqual(asked[2].args, ['server.js', '--edited']);
  await agent.stop('web');
  // Another session asks for itself; the user's own Start never asks.
  const other = instance.forSession({ id: 's2', cwd }, { requestApproval: async (request) => { asked.push(request); return false; } });
  await assert.rejects(other.start({ name: 'web' }), /didn’t allow starting/);
  const sender = fake.sender();
  const own = await instance.call(sender, 'preview-server-start', { sessionId: 's2', name: 'web' });
  assert.equal(own.ok, true, own.message);
  assert.equal(asked.length, 4);
  await instance.call(sender, 'preview-server-stop', { sessionId: 's2', name: 'web' });
  // A stopped turn (the call's signal) asks nothing and runs nothing.
  const controller = new AbortController();
  controller.abort();
  const stopped = instance.forSession({ id: 's2', cwd }, { requestApproval: async (request) => { asked.push(request); return true; }, signal: controller.signal });
  await assert.rejects(stopped.start({ name: 'web' }), /The turn was stopped\. Nothing was run\./);
  assert.equal(asked.length, 4);
});

test('a page the agent drives never leaves for an outside site the user hasn’t allowed (links, redirects, popups)', async (t) => {
  const cwd = project(null);
  const { fake, instance } = service(cwd);
  t.after(() => { instance.dispose(); fs.rmSync(cwd, { recursive: true, force: true }); });
  const asked = [];
  let answer = false;
  const agent = instance.forSession({ id: 's1', cwd }, { requestApproval: async (request) => { asked.push(request); return answer; } });
  await agent.navigate('http://localhost:3000/');
  const contents = instance._previews.get('s1').view.webContents;
  const navigate = (event, url) => { let prevented = false; contents.emit(event, { preventDefault: () => { prevented = true; } }, url); return prevented; };
  assert.equal(navigate('will-navigate', 'http://localhost:3000/next'), false, 'localhost needs no approval');
  assert.equal(navigate('will-navigate', 'https://evil.example/?d=secret'), true, 'an outside site is held');
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(asked.map((request) => [request.kind, request.host]), [['preview-site', 'evil.example']]);
  assert.equal(contents.getURL(), 'http://localhost:3000/', 'declined: the page stays');
  assert.equal(navigate('will-redirect', 'https://evil.example/again'), true, 'a declined site stays blocked');
  contents.openHandler({ url: 'https://evil.example/popup' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(asked.length, 1, 'and is not asked about again');
  await assert.rejects(agent.navigate('https://evil.example/'), /didn’t allow opening evil\.example/);
  assert.equal(asked.length, 1);
  // The click's result names the site it was kept from.
  contents.executeJavaScriptInIsolatedWorld = async () => { navigate('will-navigate', 'https://evil.example/clicked'); return { ok: true }; };
  const clicked = await agent.click({ selector: 'a' });
  assert.deepEqual(clicked.blocked, { host: 'evil.example', declined: true });
  assert.equal(clicked.url, 'http://localhost:3000/');
  // An allowed site opens once the user allows it.
  answer = true;
  assert.equal(navigate('will-navigate', 'https://docs.example/page'), true);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(contents.getURL(), 'https://docs.example/page');
  assert.equal(navigate('will-navigate', 'https://docs.example/other'), false, 'remembered');
  // The user's own address-bar navigation hands the page back: their browsing isn't held.
  const sender = fake.sender();
  await instance.call(sender, 'preview-navigate', { sessionId: 's1', url: 'http://localhost:3000/' });
  assert.equal(navigate('will-navigate', 'https://elsewhere.example/'), false);
});

test('previewShortcut: the pane chords pressed inside the page (⇧⌘X Annotate, ⌘W close, ⌘L address); others stay the page\'s', () => {
  const mac = process.platform === 'darwin';
  const press = (key, mods = {}) => ({ type: 'keyDown', key, meta: mac, control: !mac, shift: false, alt: false, ...mods });
  assert.equal(previewShortcut(press('X', { shift: true })), 'sketch');
  assert.equal(previewShortcut(press('w')), 'close');
  assert.equal(previewShortcut(press('l')), 'address');
  assert.equal(previewShortcut(press('x')), null, '⌘X is the page\'s cut');
  assert.equal(previewShortcut(press('w', { shift: true })), null);
  assert.equal(previewShortcut(press('w', { alt: true })), null);
  assert.equal(previewShortcut({ ...press('w'), type: 'keyUp' }), null);
  assert.equal(previewShortcut({ ...press('w'), isAutoRepeat: true }), null);
  assert.equal(previewShortcut(press('w', { meta: false, control: false })), null);
});

test('a .claude/launch.json written while the pane is open reaches it without reopening the pane', async (t) => {
  const cwd = project();
  const { fake, instance } = service(cwd);
  t.after(() => { instance.dispose(); fs.rmSync(cwd, { recursive: true, force: true }); });
  const sender = fake.sender();
  const state = await instance.call(sender, 'preview-state', { sessionId: 's1' });
  assert.equal(state.launch.exists, false);
  fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.claude/launch.json'), JSON.stringify({ version: '0.0.1', configurations: [{ name: 'web', runtimeExecutable: 'npm', runtimeArgs: ['run', 'dev'], port: 5288 }] }));
  const seen = () => sender.sent.some((event) => event.kind === 'preview' && event.state.launch.configs.some((config) => config.name === 'web'));
  for (let i = 0; i < 60 && !seen(); i++) await new Promise((resolve) => setTimeout(resolve, 50));
  assert.ok(seen(), 'the pane got the new configuration');
});
