import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { readFileSync } from 'node:fs';

// Node-only SSR of the split view (source-split-view.jsx) and the session row's split / window items
// (source-sidebar.jsx), over a split-view-store.mjs store: no browser, Electron or core.
let server, Split, Store, Sidebar, I18n;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  Split = await server.ssrLoadModule('/src/source-split-view.jsx');
  Store = await server.ssrLoadModule('/src/split-view-store.mjs');
  Sidebar = await server.ssrLoadModule('/src/source-sidebar.jsx');
  I18n = await server.ssrLoadModule('/electron/i18n/index.mjs');
});
after(async () => { await server?.close(); });

const timers = { setTimeout: () => 0, clearTimeout: () => {} };
const storeWith = (setup = () => {}) => { const store = Store.createSplitViewStore({ timers }); setup(store); return store; };
const host = (store, side = 0) => renderToStaticMarkup(React.createElement(Split.SourceSplitHost, { side, store },
  React.createElement('main', { className: 'workspace', 'data-side-content': side })));

test('closed: the workspace sits in the primary pane alone, no regions, divider or slot', () => {
  const html = host(storeWith());
  assert.match(html, /^<div class="split-host" data-pane-count="1"><div class="split-row"><div class="split-pane split-pane-primary" id="split-pane-0"><main class="workspace" data-side-content="0"><\/main><\/div><\/div><\/div>$/);
  assert.doesNotMatch(html, /role="separator"|role="region"|split-pane-secondary/);
});

test('open: Primary and Secondary pane regions, the focused one current, the other inactive, and a keyboard divider without a close button', () => {
  const store = storeWith((s) => { s.reportSide(0, { current: 'a', title: 'Alpha' }); s.open('b'); s.setRatio(0.6, 1400); });
  const html = host(store);
  assert.match(html, /class="split-host" data-split="true" data-pane-count="2"/);
  assert.match(html, /<div class="split-pane split-pane-primary" id="split-pane-0" role="region" aria-label="Primary pane" data-split-inactive="" style="flex-grow:0.6">/);
  assert.match(html, /<div class="split-pane split-pane-secondary" id="split-pane-1" role="region" aria-label="Secondary pane" aria-current="true" data-focused="" style="flex-grow:0.4/);
  assert.match(html, /role="separator" aria-orientation="vertical" tabindex="0" aria-label="Resize split view" aria-valuenow="60"/);
  assert.match(html, /aria-valuetext="60% left, 40% right"/);
  // Each side closes itself from its own titlebar (SourceTitlebar onCloseSplit): the divider carries no close button.
  assert.doesNotMatch(html, /split-close|Close split view/);
  store.focus(0);
  const focusedPrimary = host(store);
  assert.match(focusedPrimary, /id="split-pane-0" role="region" aria-label="Primary pane" aria-current="true" data-focused=""/);
  assert.match(focusedPrimary, /id="split-pane-1" role="region" aria-label="Secondary pane" data-split-inactive=""/);
});

test('narrow: the sides become tabs named by their sessions; only the focused side shows', () => {
  const store = storeWith((s) => { s.reportSide(0, { current: 'a', title: 'Alpha' }); s.open('b'); s.reportSide(1, { current: 'b', title: '' }); s.setTabs(true); });
  const html = host(store);
  assert.match(html, /data-tabs="true"/);
  assert.match(html, /<div class="split-tabs" role="tablist" aria-label="Split view">/);
  assert.match(html, /role="tab" id="split-tab-0" aria-controls="split-pane-0" aria-selected="false" tabindex="-1" class="split-tab"><span class="split-tab-label">Alpha<\/span>/);
  assert.match(html, /role="tab" id="split-tab-1" aria-controls="split-pane-1" aria-selected="true" tabindex="0" class="split-tab" data-active="true"><span class="split-tab-label">Untitled session<\/span>/);
  assert.match(html, /id="split-pane-0" role="tabpanel" aria-labelledby="split-tab-0" data-split-inactive="" hidden=""/);
  assert.match(html, /id="split-pane-1" role="tabpanel" aria-labelledby="split-tab-1" data-focused=""/);
  assert.doesNotMatch(html, /role="separator"/, 'no divider while tabbed');
  // The strip's close has a CDS tooltip (with ⌃⌘W), not a native title.
  assert.match(html, /<button type="button" class="split-tabs-close code-icon-button" aria-label="Close split view"/);
  assert.doesNotMatch(html, /title="Close split view"/);
  const blank = storeWith((s) => { s.open(null); s.setTabs(true); });
  assert.match(host(blank), /<span class="split-tab-label">New session<\/span>/);
});

test('the secondary side renders its workspace unchanged; the root renders only the primary side until the slot exists', () => {
  const store = storeWith((s) => s.open('b'));
  assert.equal(host(store, 1), '<main class="workspace" data-side-content="1"></main>');
  const html = renderToStaticMarkup(React.createElement(Split.SourceSplitRoot, { store, renderSide: (side, secondary) => React.createElement('section', { 'data-side': side, 'data-secondary': secondary?.sessionId ?? '' }) }));
  assert.equal(html, '<section data-side="0" data-secondary=""></section>');
});

test('zh-CN: the split chrome speaks the UI language', (context) => {
  context.after(() => I18n.setLocale('en-US'));
  I18n.setLocale('zh-CN');
  const html = host(storeWith((s) => s.open('b')));
  assert.match(html, /aria-label="主面板"/);
  assert.match(html, /aria-label="副面板"/);
  assert.match(html, /aria-label="调整分屏大小"/);
  const tabbed = host(storeWith((s) => { s.open('b'); s.setTabs(true); }));
  assert.match(tabbed, /aria-label="关闭分屏"/);
});

test('split shortcuts follow the official chords: ⌃] ⌃[ focus, ⌃⌘\\ new session on the right, ⌃⌘W close', () => {
  const key = (code, mods = {}) => Split.splitShortcut({ code, ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, repeat: false, defaultPrevented: false, ...mods });
  assert.equal(key('BracketRight'), 'focus-next');
  assert.equal(key('BracketLeft'), 'focus-previous');
  assert.equal(key('Backslash', { metaKey: true }), 'new-right');
  assert.equal(key('KeyW', { metaKey: true }), 'close');
  assert.equal(key('KeyW'), null, '⌃W alone stays a text binding');
  assert.equal(key('BracketRight', { shiftKey: true }), null);
  assert.equal(key('BracketRight', { repeat: true }), null);
  assert.equal(Split.splitShortcut({ code: 'BracketRight', ctrlKey: false }), null);
});

test('session row menu: Split view and New window live in the Open in submenu (c80a67939 g/_/b/x); rows drag as sessions', () => {
  const now = Math.floor(Date.now() / 1000);
  const thread = (id) => ({ id, name: 'Session ' + id, cwd: '/fixture/work', createdAt: now, updatedAt: now });
  const menu = (windowActions) => renderToStaticMarkup(React.createElement(Sidebar.SourceSidebarSessionMenu, { session: thread('s1'), onAction() {}, onClose() {}, onRename() {}, windowActions }));
  const actions = (item) => ({ splitItem: () => item, onOpenSplit() {}, onCloseSplit() {}, onOpenWindow() {} });
  // The submenu popup renders only while open, so the closed menu shows just the 'Open in' trigger: no top-level window rows.
  for (const item of [{ kind: 'open' }, { kind: 'close', side: 1 }, null]) {
    const html = menu(actions(item));
    assert.doesNotMatch(html, /Open in split view|Open in new window|Close split view|split-trigger|new-window-trigger/, JSON.stringify(item));
    assert.match(html, /Open in/);
  }
  const source = readFileSync(path.resolve(import.meta.dirname, '../src/source-sidebar.jsx'), 'utf8');
  const body = source.slice(source.indexOf('const openInLayout'), source.indexOf('{pinnedAt > 0'));
  assert.match(body, /t\("Split view"\)[\s\S]*t\("New window"\)[\s\S]*editors\.map[\s\S]*t\("Terminal"\)[\s\S]*t\("Finder"\)/, 'layout (Split view, New window), then editors, Terminal, Finder');
  assert.match(body, /splitItem\?\.kind === "open"/, 'Split view only for a session this window does not show');
  assert.match(body, /shortcut=\{digitFor\(index\)\} digit=\{digitFor\(index\)\}/, 'rows are numbered 1-9');
  assert.doesNotMatch(body, /icon=|Close split view"\)/, 'no icons and no Close split view row');
  const sidebar = (props) => renderToStaticMarkup(React.createElement(Sidebar.SourceSidebar, { sessions: [thread('s1')], knownFolders: ['/fixture/work'], ...props }));
  assert.match(sidebar({ windowActions: actions({ kind: 'open' }) }), /data-source-session-id="s1"[^>]*>.*?<button type="button" class="source-session-open"[^>]*draggable="true"/s);
  assert.doesNotMatch(sidebar({}), /draggable="true"/);
});

test('the split CSS never sets cursor:pointer, keeps reduced motion, and the store type is exported for the sidebar', () => {
  const css = readFileSync(path.resolve(import.meta.dirname, '../src/source-split-view.css'), 'utf8');
  assert.doesNotMatch(css, /cursor\s*:\s*pointer/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /html\[data-reduce-motion="true"\] \.split-pane-secondary/);
  assert.equal(Split.SESSION_DRAG_TYPE, 'application/x-code-desktop-session');
  assert.equal(Split.inInactiveSplitSide({ closest: (selector) => (selector === '[data-split-inactive]' ? {} : null) }), true);
  assert.equal(Split.inInactiveSplitSide(null), false);
});
