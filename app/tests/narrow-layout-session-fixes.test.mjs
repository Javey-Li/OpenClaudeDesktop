import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { viewportLabel, viewportRows } from '../src/preview-model.mjs';
import { durableEffort } from '../src/model-menu-model.mjs';
import { TILE_CONFIG, chatContentInset, coveredWidth, fromSpec, resolveLayout, withChatMinimum } from '../src/tile-layout-model.mjs';
import { forkMarkersFor } from '../src/fork-marker-model.mjs';
import { reduce } from '../src/state.js';

// Overnight app-src fixes: the agent-set Viewport row, ultracode for this app run only, the chat tile's covered part,
// the tabbed split strip's chrome, the Rewind / status / keep-awake / fork-marker surfaces. Node-only (SSR via Vite).
// The CDS Dialog portals into document.body: render it in place (as cross-r5-render.test.mjs does).
createRequire(path.resolve(import.meta.dirname, '..', 'package.json'))('react-dom').createPortal = (children) => children;
globalThis.document ??= { body: { nodeType: 1 }, documentElement: { dataset: {}, getAttribute: () => null } };
let server, Split, Store, Sidebar, Actions, Lineage;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  Split = await server.ssrLoadModule('/src/source-split-view.jsx');
  Store = await server.ssrLoadModule('/src/split-view-store.mjs');
  Sidebar = await server.ssrLoadModule('/src/source-sidebar.jsx');
  Actions = await server.ssrLoadModule('/src/source-session-actions.jsx');
  Lineage = await server.ssrLoadModule('/src/source-fork-lineage.jsx');
});
after(async () => { await server?.close(); });
const render = (element) => renderToStaticMarkup(element);
const read = (file) => readFileSync(path.resolve(import.meta.dirname, '..', file), 'utf8');

test('Viewport: a size the agent set that matches no preset is a checked Custom · W × H row, set by the assistant', () => {
  const rows = viewportRows({ preset: 'custom', width: 1280, height: 800, setByAgent: true });
  assert.deepEqual(rows.map((row) => [row.value, row.checked]), [['responsive', false], ['mobile', false], ['tablet', false], ['custom', true]]);
  assert.deepEqual({ label: rows[3].label, hint: rows[3].hint, setByAgent: rows[3].setByAgent, keep: rows[3].keep }, { label: 'Custom', hint: '1280 × 800', setByAgent: true, keep: true });
  assert.equal(viewportLabel({ preset: 'custom', width: 1280, height: 800 }), 'Custom · 1280 × 800');
  // A preset: no extra row, and "Set by" only on the checked preset the agent chose.
  const mobile = viewportRows({ preset: 'mobile', width: 375, height: 812, setByAgent: true });
  assert.equal(mobile.length, 3);
  assert.deepEqual(mobile.map((row) => row.setByAgent), [false, true, false]);
  assert.equal(viewportRows({ preset: 'responsive' }).filter((row) => row.checked).length, 1);
  const pane = read('src/source-preview-pane.jsx');
  assert.match(pane, /viewportRows\(state\?\.viewport\)/);
  assert.match(pane, /if \(!row\.keep\) onViewport\(row\.value\)/, 'choosing Custom keeps the size');
});

test('ultracode lasts this app run only: the session keeps the level under it', () => {
  const deepseek = [{ reasoningEffort: 'low' }, { reasoningEffort: 'high' }, { reasoningEffort: 'xhigh' }];
  assert.equal(durableEffort('ultracode', deepseek, true), 'xhigh');
  const codex = [{ reasoningEffort: 'medium' }, { reasoningEffort: 'high' }, { reasoningEffort: 'xhigh' }, { reasoningEffort: 'ultra' }];
  assert.equal(durableEffort('ultra', codex, true), 'xhigh', 'Codex ultra is ultracode while workflows are on');
  assert.equal(durableEffort('ultra', codex, false), 'ultra', 'with workflows off it is the model’s own level');
  assert.equal(durableEffort('ultra', [{ reasoningEffort: 'medium' }, { reasoningEffort: 'ultra' }], true), 'medium');
  assert.equal(durableEffort('high', codex, true), 'high');
  const main = read('src/main.jsx');
  assert.match(main, /const saved = next\.effort \? durableEffort\(next\.effort, levels, workflowState\.enabled\) : null;/);
  assert.match(main, /return updateSessionMetadata\(id, \{ model: next\.model, \.\.\.\(saved \? \{ effort: saved \} : \{\}\) \}\);/);
  assert.match(main, /const running = sessionUltracode\.current\.get\(id\);/);
});

test('the chat tile’s content stays in the part its neighbour does not cover', () => {
  assert.equal(coveredWidth(320, 257, 12), 51);
  assert.equal(coveredWidth(320, 400, 12), 0);
  assert.equal(coveredWidth(0, 100, 12), 0);
  assert.equal(coveredWidth(320, Number.NaN, 12), 0);
  const css = read('src/source-tile-layout.css');
  assert.match(css, /\.source-chat-tile-content \{\n  height: 100%;\n  padding-inline-start: var\(--tile-covered-content-start, 0px\);\n  padding-inline-end: var\(--tile-covered-content-end, 0px\);\n\}/);
  assert.match(css, /\.source-chat-tile-content > \.st-toolbar \{\n  margin-inline-start: var\(--tile-covered-extra-start, 0px\);\n  margin-inline-end: var\(--tile-covered-extra-end, 0px\);\n\}/);
  // The transcript and composer keep 280 px: only the titlebar follows the chat down to its 100 px floor.
  assert.deepEqual(chatContentInset(51, 320), { content: 40, extra: 11 });
  assert.deepEqual(chatContentInset(20, 320), { content: 20, extra: 0 });
  assert.deepEqual(chatContentInset(208, 320), { content: 40, extra: 168 });
  assert.deepEqual(chatContentInset(Number.NaN, 320), { content: 0, extra: 0 });
});

test('a reopened layout gives a chat dragged to its floor its 320 px back, keeping the pane’s minimum', () => {
  const tiles = [{ id: 'chat', overflowMin: { width: 320, anchor: 'left' } }, { id: 'terminal' }];
  const tileById = (id) => tiles.find((tile) => tile.id === id) ?? null;
  const widths = (layout, width) => {
    const out = {};
    resolveLayout(layout.root, { width, height: 800 }, tileById, TILE_CONFIG, (stack, child, index, flex, box) => { out[child.tileId] = box.width; });
    return out;
  };
  const stub = fromSpec({ direction: 'row', children: [['chat', 0.1], ['terminal', 1.9]] });
  assert.equal(widths(stub, 1400).chat, 100);
  const restored = withChatMinimum(stub, { width: 1400, height: 800 }, tileById);
  assert.ok(Math.abs(widths(restored, 1400).chat - 320) <= 1);
  assert.equal(widths(restored, 1400).terminal, 1400 - 12 - widths(restored, 1400).chat);
  // A narrow split side: the chat gets what the pane's 280 px leaves.
  const narrow = withChatMinimum(stub, { width: 500, height: 800 }, tileById);
  assert.ok(Math.abs(widths(narrow, 500).chat - (500 - 12 - 280)) <= 1);
  // Already wide enough, or no neighbour: unchanged.
  const wide = fromSpec({ direction: 'row', children: [['chat', 2], ['terminal', 3]] });
  assert.equal(withChatMinimum(wide, { width: 1400, height: 800 }, tileById), wide);
  const alone = fromSpec({ direction: 'row', children: [['chat', 1]] });
  assert.equal(withChatMinimum(alone, { width: 1400, height: 800 }, tileById), alone);
  const jsx = read('src/source-tile-layout.jsx');
  assert.match(jsx, /restoredFor\.current === restoreKey/);
  assert.match(read('src/main.jsx'), /restoreKey=\{tileOwner\} onRestoreLayout=\{restoreTileLayout\}/);
});

test('titlebar: the lead clips, and a cramped row lets Preview and Terminal step into ⋯', () => {
  const css = read('src/source-titlebar.css');
  assert.match(css, /\.st-lead \{[^}]*overflow: clip;/);
  assert.match(css, /\.st-toolbar \.st-trailing\[data-cramped\] \[data-pane-toggle\] \{\n  display: none;\n\}/);
  assert.match(read('src/source-titlebar.jsx'), /data-cramped=\{cramped \|\| undefined\}/);
});

test('tabbed split view: the strip carries Show sidebar / Back / Forward after the traffic lights and drags the window', () => {
  const store = Store.createSplitViewStore({ timers: { setTimeout: () => 0, clearTimeout: () => {} } });
  store.reportSide(0, { current: 'a', title: 'Alpha' }); store.open('b'); store.reportSide(1, { current: 'b', title: 'Beta' }); store.setTabs(true);
  const chrome = React.createElement('div', { className: 'df-collapsed-chrome', 'data-test-chrome': '' });
  const html = render(React.createElement(Split.SourceSplitHost, { side: 0, store, chrome }, React.createElement('main')));
  assert.match(html, /<div class="split-tabs-bar" data-chrome=""><div class="split-tabs-chrome"><div class="df-collapsed-chrome" data-test-chrome=""><\/div><\/div><div class="split-tabs" role="tablist" aria-label="Split view">/);
  assert.match(html, /<\/div><button type="button" class="split-tabs-close code-icon-button" aria-label="Close split view"/, 'Close sits outside the tablist');
  const plain = render(React.createElement(Split.SourceSplitHost, { side: 0, store }, React.createElement('main')));
  assert.match(plain, /<div class="split-tabs-bar"><div class="split-tabs" role="tablist"/);
  const css = read('src/source-split-view.css');
  assert.match(css, /\.split-tabs-bar \{[^}]*-webkit-app-region: drag;/);
  assert.match(css, /\.split-tabs-bar\[data-chrome\] \{\n  height: 46px;\n  padding-left: calc\(var\(--df-traffic-light-spacer, 74px\) \+ 14px\);/);
  assert.match(css, /\.split-host\[data-tabs\] \.split-pane \.workspace-toolbar \.df-collapsed-chrome \{\n  display: none;/);
  assert.match(read('src/main.jsx'), /<SourceSplitHost side=\{side\} chrome=\{effectiveCollapsed \? <SourceCollapsedChrome/);
});

test('Rewind: each choice is one row, its mark beside its message, over a visually hidden native input', () => {
  const html = render(React.createElement(Actions.RewindDialog, { turns: [{ id: 't1', text: 'First' }, { id: 't2', text: 'Second' }], preselected: 't2', canRestoreFiles: true, onConfirm() {}, onClose() {} }));
  assert.match(html, /<label class="slash-rewind-option"><input class="slash-rewind-input" type="radio" name="rewind"\/><span class="slash-rewind-mark" data-kind="radio" aria-hidden="true"><\/span><span class="slash-rewind-text">First<\/span><\/label>/);
  assert.match(html, /<label class="slash-rewind-option" data-checked="true"><input class="slash-rewind-input" type="radio" name="rewind" checked=""\/><span class="slash-rewind-mark" data-kind="radio" data-checked="true" aria-hidden="true"><span class="slash-rewind-dot"><\/span><\/span><span class="slash-rewind-text">Second<\/span>/);
  assert.match(html, /<label class="slash-rewind-files slash-rewind-option"><input class="slash-rewind-input" type="checkbox"\/><span class="slash-rewind-mark" data-kind="checkbox" aria-hidden="true"><\/span>/);
  const css = read('src/source-session-actions.css');
  assert.match(css, /\.session-action-dialog \.slash-rewind-option\{position:relative;display:flex;flex-direction:row;/, 'scoped past the dialog’s column labels');
});

test('/status footer: hint at the start, Copy session info and Refresh together at the end', () => {
  const props = { session: { id: 'th-1', name: 'Fix bug' }, model: 'GPT', effort: 'high', permission: 'auto', cwd: '/w', usage: null, connected: true, running: false, operation: null, account: null, readStatus: () => new Promise(() => {}), onClose() {}, inline: true };
  const html = render(React.createElement(Actions.SessionStatusDialog, props));
  assert.match(html, /<footer><span class="session-action-hint">[^<]*<\/span><span class="session-status-actions"><button type="button" data-copy-session-info="">Copy session info<\/button>\s*<button type="button" data-autofocus="true" disabled="">Refresh<\/button><\/span><\/footer>/);
});

test('Keep computer awake: a switch row that stays open', () => {
  const thread = { id: 's1', name: 'One', cwd: '/w', updatedAt: 1, status: { type: 'idle' } };
  const menu = (keepAwake) => render(React.createElement(Sidebar.SourceSidebarSessionMenu, { session: thread, metadata: { keepAwake }, onAction() {}, onClose() {}, onRename() {} }));
  const on = menu(true), off = menu(false);
  assert.match(on, /<div aria-checked="true" data-keep-awake="" role="menuitemcheckbox"/);
  assert.match(on, /data-cds="Switch" data-size="xs" data-checked="true" aria-hidden="true"/);
  assert.match(off, /<div aria-checked="false" data-keep-awake="" role="menuitemcheckbox"/);
  assert.match(off, /data-cds="Switch" data-size="xs" aria-hidden="true"/);
});

test('fork marker: "Forked here: {title}" after the turn a fork was made at', () => {
  const sessions = [{ id: 'p', name: 'Parent' }, { id: 'f1', name: 'Fork one' }, { id: 'f2', name: 'Fork two', archived: true }, { id: 'f3', name: 'No turn' }, { id: 'x', name: 'Other', forkedFromId: 'q' }];
  const metadata = { f1: { forkedFrom: 'p' }, f2: { forkedFrom: 'p', forkedAtTurn: 'turn-1' }, f3: { forkedFrom: 'p' } };
  const marks = forkMarkersFor('p', sessions, metadata, { f1: { parent: 'p', turnId: 'turn-2' } });
  assert.deepEqual([...marks.entries()], [['turn-2', [{ id: 'f1', title: 'Fork one', archived: false }]], ['turn-1', [{ id: 'f2', title: 'Fork two', archived: true }]]]);
  assert.equal(forkMarkersFor(null, sessions, metadata).size, 0);
  const html = render(React.createElement(Lineage.SourceForkMarker, { forks: [...marks.get('turn-2'), ...marks.get('turn-1')], onOpen() {} }));
  assert.match(html, /<button type="button" class="source-fork-lineage-link">Forked here: Fork one<\/button>/);
  assert.match(html, /<span class="source-fork-lineage-text">Forked here: Fork two<span class="source-fork-lineage-archived"> · Archived<\/span><\/span>/);
});

test('a finished session action strip is dismissed only while it is still that action', () => {
  const done = { threadId: 't', operation: 'fork', phase: 'completed' };
  const state = { operations: { t: done } };
  assert.equal(reduce(state, { type: 'dismiss-operation', id: 't', expect: done }).operations.t, null);
  const newer = { threadId: 't', operation: 'compact', phase: 'running' };
  const moved = { operations: { t: newer } };
  assert.equal(reduce(moved, { type: 'dismiss-operation', id: 't', expect: done }), moved);
  assert.equal(reduce(moved, { type: 'dismiss-operation', id: 't' }).operations.t, null, 'the X button still dismisses');
});

test('first-run Sign in: Back to Choose your agent, and the relay link opens Custom endpoint', async () => {
  const { SourceOnboarding } = await server.ssrLoadModule('/src/source-onboarding.jsx');
  const core = { id: 'codex', name: 'Codex', login: { browser: [{ type: 'chatgpt', label: 'Sign in with ChatGPT' }] } };
  const html = render(React.createElement(SourceOnboarding, { startAt: 'signin', desktopCall: async () => ({}), onDone() {}, onSkip() {}, onCoreChosen() {}, onOpenExternal() {},
    signIn: { core, auth: null, account: null, connected: true, onLogin() {}, onAccountAction() {}, onOpenExternal() {}, onCustomEndpoint() {} } }));
  assert.match(html, /<div class="sob-actions sob-signin-actions"><button type="button" data-cds="Button" data-variant="ghost"[^>]*>[\s\S]*?Back<\/span><\/button><button type="button" class="sob-text-button sob-signin-skip">Skip for now<\/button><\/div>/);
  const source = read('src/source-onboarding.jsx');
  assert.match(source, /step === "signin" \? \(\) => setStep\("agent"\)/, 'Escape on Sign in goes back too');
  assert.match(source, /initial=\{signIn\?\.core\?\.id \?\? null\}/, 'the chosen core stays selected');
  assert.match(read('src/main.jsx'), /onCustomEndpoint: \(\) => \{ requestCodexCustomEndpoint\(\); skipOnboarding\(\); setSettings\("models#codex-provider"\); \}/);
});
