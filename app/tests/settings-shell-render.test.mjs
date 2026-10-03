import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

// Fidelity F14: server-render the Settings shell (portals rendered inline; effects do not run, so the desktop
// snapshot and build-info are still loading) and check the original's rows, options and chrome.
const app = path.resolve(import.meta.dirname, '..');
createRequire(path.join(app, 'package.json'))('react-dom').createPortal = children => children;
globalThis.innerWidth = 1200;
globalThis.document ??= { body: { nodeType: 1 }, documentElement: { dataset: {} } };
let server, Settings, React, render;
before(async () => {
  React = (await import('react')).default;
  ({ renderToStaticMarkup: render } = await import('react-dom/server'));
  const { createServer } = await import('vite'), react = (await import('@vitejs/plugin-react')).default;
  server = await createServer({ configFile: false, root: app, plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  ({ SourceSettings: Settings } = await server.ssrLoadModule('/src/source-settings.jsx'));
});
after(() => server?.close());
const page = (initialSection, config = {}, props = {}) => render(React.createElement(Settings, { open: true, config: { threadIds: [], ...config },
  model: 'm', effort: 'medium', permission: 'ask', boot: { connected: true, models: [] }, busy: false, initialSection,
  desktopCall: async () => ({}), onSave: async () => ({}), onClose() {}, ...props }));
const settingIds = html => [...html.matchAll(/data-setting-id="([^"]+)"/g)].map(match => match[1]);
const control = (html, label) => new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`).exec(html)?.[0] ?? '';

test('General: no version row before build-info, three skeleton rows while the desktop snapshot loads, no keep-awake rows', () => {
  const html = page('general');
  assert.deepEqual(settingIds(html), []);
  assert.equal((html.match(/data-settings-skeleton=""/g) || []).length, 3);
  const row = html.slice(html.indexOf('data-settings-skeleton'), html.indexOf('data-settings-skeleton', html.indexOf('data-settings-skeleton') + 1));
  for (const size of ['h-5 w-36', 'h-5 w-72', 'h-6 w-10']) assert.ok(row.includes(size), size);
  assert.match(row, /rounded-full h-6 w-10/);
  assert.equal(html.includes('Loading version'), false);
  assert.equal(html.includes('Keep computer awake'), false);
});

test('Code: Banners and keep-awake by default, per-type level options, Draw attention gated on Permission requests and Questions', () => {
  const html = page('code');
  for (const label of ['Permission requests', 'Questions', 'Task complete'])
    assert.match(control(html, `${label} notification level`), /data-value="banner"/, label);
  assert.match(control(html, 'Keep computer awake while DeepSeek works'), /aria-checked="true"/);
  assert.match(control(html, 'Keep awake on battery power'), /aria-checked="true"/);
  assert.doesNotMatch(control(html, 'Draw attention on notifications'), /disabled/);
  const off = page('code', { permissionNotifications: 'off', questionNotifications: 'off', keepAwake: false });
  assert.match(control(off, 'Draw attention on notifications'), /disabled=""/);
  assert.equal(off.includes('Keep awake on battery power'), false, 'the battery row follows keep-awake');
  assert.doesNotMatch(control(page('code', { permissionNotifications: 'off', questionNotifications: 'badge' }), 'Draw attention on notifications'), /disabled/);
  // No row is disabled for a save in flight; only the original's gates remain.
  for (const label of ['Notification sound', 'Archive inactive sessions', 'Worktree location', 'Interface font']) assert.doesNotMatch(control(html, label), /disabled/, label);
  // Copy: c71860c77:2188-2212 with DeepSeek substituted and no link; :2316 typographic apostrophe.
  assert.ok(html.includes('Bypass all permission checks and let DeepSeek work uninterrupted. This works well for workflows like fixing lint errors or generating boilerplate code. Letting DeepSeek run arbitrary commands is risky and can result in data loss, system corruption, or data exfiltration (e.g., via prompt injection attacks).'));
  assert.ok(html.includes('the app isn’t focused.'));
});

test('chrome: nav without Usage, search field without a clear button, every close button named Close; Usage opens stacked', () => {
  const html = page('preferences');
  const nav = html.slice(html.indexOf('<nav class="ss-nav"'), html.indexOf('</nav>'));
  assert.ok(nav.includes('<span>Preferences</span>') && nav.includes('<span>Code</span>'));
  assert.equal(nav.includes('<span>Usage</span>'), false);
  assert.match(nav, /<div class="ss-search"><span[^>]*data-cds="Icon"[^>]*>[^<]*<\/span><input aria-label="Search settings"[^>]*\/><\/div>/, 'icon + input only');
  assert.equal(html.includes('Clear settings search'), false);
  assert.deepEqual([...html.matchAll(/aria-label="(Close[^"]*)"/g)].map(match => match[1]), ['Close']);
  const usage = page('usage');
  assert.match(usage, /<header class="ss-usage-header"><h2 class="text-heading-semibold" aria-hidden="true">Usage<\/h2><button type="button" class="ss-close" aria-label="Close">/);
  assert.equal(usage.includes('ss-nav'), false);
  globalThis.innerWidth = 700;
  try {
    const narrow = page('preferences');
    const tabs = [...narrow.matchAll(/role="tab"[^>]*>([^<]+)</g)].map(match => match[1]);
    // Customization pages (C1–C6) join the Settings and Desktop app groups; Customize stays last.
    assert.deepEqual(tabs, ['Preferences', 'Theme', 'Code', 'Instructions', 'Commands', 'Models', 'General', 'Developer', 'Harness', 'Skills', 'Connectors', 'Plugins']);
  } finally { globalThis.innerWidth = 1200; }
});

// Fidelity F14: c71860c77-B72Ova_w ht/X/Z — the storage dialog's rows and kind bars (rendered without the portal).
test('Storage: Disk space used, Code sessions and worktrees, Runtime and App caches and logs rows with Details, no paths', async () => {
  const pages = await server.ssrLoadModule('/src/source-settings-pages.jsx');
  const value = { computedAt: Date.now(), bytes: 18 + 13, incomplete: false, areas: [
    { id: 'code', label: 'Code sessions and worktrees', bytes: 18, sessionCount: 3, worktreeCount: 1, kinds: [
      { id: 'history', label: 'Conversation history', bytes: 5 }, { id: 'worktrees', label: 'Worktrees in use or with changes', bytes: 13 },
      { id: 'otherHistory', label: 'Other DeepSeek Harness history', bytes: 18, outside: true }] },
    { id: 'runtime', label: 'Runtime', bytes: 13, name: 'DeepSeek Harness', versionCount: 1, kinds: [{ id: 'core', label: 'DeepSeek Harness', bytes: 13 }] },
    { id: 'app', label: 'App caches and logs', bytes: 0, kinds: [{ id: 'web', label: 'Web cache', bytes: 0 }, { id: 'logs', label: 'Logs', bytes: 0 }, { id: 'other', label: 'Other', bytes: 0 }] }] };
  const html = render(React.createElement(pages.StorageRows, { value }));
  assert.deepEqual([...html.matchAll(/<span class="settings-row-title">([^<]+)<\/span>/g)].map(match => match[1]),
    ['Disk space used', 'Code sessions and worktrees', 'Runtime', 'App caches and logs']);
  assert.match(html, /<div id="[^"]+" data-settings-desc="">Calculated <time data-cds="RelativeTime"[^>]*class="source-timestamp ss-storage-when">just now<\/time>\.<\/div>/);
  assert.ok(html.includes('3 sessions and 1 worktree.')); assert.ok(html.includes('1 installed DeepSeek Harness version.')); assert.ok(html.includes('Web cache, browser panes and logs.'));
  assert.match(html, /class="ss-storage-size ss-storage-total-size">31 B</);
  assert.deepEqual([...html.matchAll(/aria-label="([^"]+ details)"/g)].map(match => match[1]), ['Code session details', 'Runtime details'], 'an empty App area has no Details');
  assert.equal(/\/Users\/|path/.test(html), false);
  const lower = render(React.createElement(pages.StorageRows, { value: { ...value, incomplete: true } }));
  assert.ok(lower.includes('Some folders couldn’t be measured, so this is a lower bound.'));
  const kinds = render(React.createElement(pages.StorageKinds, { label: 'Code storage by kind', color: 'var(--cds-chart-categorical-2)',
    items: value.areas[0].kinds.map(kind => kind.outside ? { ...kind, tip: 'History from DeepSeek Harness outside Code Desktop. Shown for completeness; not counted above and never removed from here.' } : kind) }));
  assert.match(kinds, /<div role="img" aria-label="Code storage by kind: Conversation history 5 B; Worktrees in use or with changes 13 B" class="ss-storage-kind-bar">/);
  assert.equal((kinds.match(/class="ss-storage-kind-bar">([\s\S]*?)<\/div><ul/)?.[1].match(/<div /g) || []).length, 2, 'the outside kind stays out of the bar');
  assert.deepEqual([...kinds.matchAll(/class="ss-storage-kind-dot" style="background-color:([^;]+);opacity:([\d.]+)"/g)].map(match => [match[1], Number(match[2])]),
    [['var(--cds-chart-categorical-2)', 1], ['var(--cds-chart-categorical-2)', 0.72], ['var(--cds-chart-muted)', 1]]);
  assert.match(kinds, /<button type="button" data-cds="InfoTip" aria-label="More info" class="ss-storage-tip">/);
});

// R03 (c71860c77-CCdfSDER F/I): Developer › Local engine 'Reconnect' is a CDS Button (secondary, sm) like Edit config and
// Developer docs, keeps the name 'Reconnect' while busy, and no bare button is left in a row's control slot.
test('Developer: Reconnect is a CDS Button and no row control is a bare button', () => {
  const html = page('developer');
  const reconnect = /<button[^>]*data-cds="Button"[^>]*>(?:(?!<\/button>)[\s\S])*Reconnect(?:(?!<\/button>)[\s\S])*<\/button>/.exec(html)?.[0] ?? '';
  assert.ok(reconnect, 'Reconnect renders as data-cds=Button');
  assert.match(reconnect, /data-variant="secondary"/);
  assert.match(reconnect, /data-size="sm"/);
  assert.doesNotMatch(reconnect, /disabled=""|aria-busy/);
  assert.equal(html.includes('Connecting…'), false);
  const slots = [...html.matchAll(/<div class="ss-control">([\s\S]*?)<\/div><\/div>/g)].map(match => match[1]);
  assert.ok(slots.some(slot => slot.includes('Reconnect')), 'the Reconnect row control slot is scanned');
  for (const slot of slots) for (const tag of slot.match(/<button[^>]*>/g) || []) assert.match(tag, /data-cds="Button"|class="ss-switch|role="(radio|combobox|switch)"/, tag);
  const busy = page('developer', {}, { busy: true });
  assert.match(/<button[^>]*data-cds="Button"[^>]*>(?:(?!<\/button>)[\s\S])*Reconnect/.exec(busy)?.[0] ?? '', /disabled=""/);
});
