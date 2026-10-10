import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

// Server render of the terminal pane (middleware-mode Vite SSR, as the other pane render tests): the source-file-panel
// shell with the "Terminal tabs" strip in its 32px header, "New terminal", the drag handle and pane controls, the
// xterm host, the exited / limited / error states; and the titlebar's Terminal toggle with its running dot.
const app = path.resolve(import.meta.dirname, '..');
let server, P, S, T, C;
const emitted = [];
let emit = null;
before(async () => {
  globalThis.desktop = { terminal: {
    call: async (op) => (op === 'hello' ? { backend: 'pty' } : []),
    write() {},
    onEvent(handler) { emit = handler; return () => {}; },
  } };
  server = await createServer({ configFile: false, root: app, plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  createRequire(path.join(app, 'package.json'))('react-dom').createPortal = (children) => children;
  S = await server.ssrLoadModule('/src/terminal-store.mjs');
  P = await server.ssrLoadModule('/src/source-terminal-pane.jsx');
  T = await server.ssrLoadModule('/src/source-titlebar.jsx');
  C = await server.ssrLoadModule('/src/source-pane-controls.jsx');
});
after(async () => { await server?.close(); delete globalThis.desktop; });
const h = React.createElement;
const state = (info) => { emitted.push(info); emit({ kind: 'state', info: { owner: 's1', sessionId: 's1', status: 'running', generation: 1, busy: false, title: null, cwd: '/tmp/work', ...info } }); };
const pane = (props = {}) => renderToStaticMarkup(h(P.SourceTerminalPane, { sessionId: 's1', cwd: '/tmp/work', headerCenter: h('span', { className: 'handle' }),
  controls: h(C.SourcePaneControls, { tileId: 'terminal', paneName: 'Terminal', layout: null, onToggleExpand() {}, onClose() {} }), ...props }));

test('an empty pane: header strip, New terminal, handle and controls, the loading cursor', () => {
  const html = pane({ sessionId: 'empty' });
  assert.match(html, /<aside class="source-file-panel detail-panel stp-pane" aria-label="Terminal" data-terminal-owner="empty">/);
  assert.match(html, /<header class="source-pane-header" data-pane-header="terminal">/);
  assert.match(html, /role="tablist" aria-label="Terminal tabs"/);
  assert.match(html, /aria-label="New terminal"/);
  assert.ok(html.indexOf('aria-label="New terminal"') < html.indexOf('class="handle"'), 'the + sits before the drag handle');
  assert.match(html, /data-pane-header="terminal">[\s\S]*class="handle"[\s\S]*<\/header>/);
  assert.match(html, /<div class="stp-host"><\/div>/);
  assert.match(html, /data-testid="terminal-pane-placeholder"/);
  assert.match(html, /Press Delete or Backspace to close the terminal/);
  assert.doesNotMatch(html, /cursor:\s*pointer/);
});

test('tabs: one tab reads "Terminal", several read "Terminal {n}" or their name; running, exited and limited states', () => {
  state({ id: 'term-aaaaaa', number: 1 });
  let html = pane();
  assert.match(html, /data-terminal-id="term-aaaaaa" data-selected="true"/);
  assert.match(html, /role="tab" aria-selected="true" aria-posinset="1" aria-setsize="1" tabindex="0"/);
  assert.match(html, /<span>Terminal<\/span>/);
  state({ id: 'term-bbbbbb', number: 2, busy: true, title: 'dev server' });
  state({ id: 'term-cccccc', number: 3 });
  html = pane();
  assert.match(html, /aria-setsize="3"/);
  assert.match(html, /<span>Terminal 1<\/span>/);
  assert.match(html, /data-terminal-id="term-bbbbbb" data-busy="true"/);
  assert.match(html, /dev server<span class="source-sr-only">, Terminal \(command running\)<\/span>/);
  assert.match(html, /<span>Terminal 3<\/span>/);
  assert.equal((html.match(/tabindex="0"/g) || []).length >= 1, true);
  // The active tab exited: Shell exited. + Restart shell.
  state({ id: 'term-aaaaaa', number: 1, status: 'exited', exitCode: 1 });
  html = pane();
  assert.match(html, /class="stp-exited" role="status"><span>Shell exited\.<\/span>/);
  assert.match(html, />Restart shell</);
  // A limited (script backend) terminal says so.
  state({ id: 'term-aaaaaa', number: 1, status: 'running', limited: true, backend: 'script' });
  html = pane();
  assert.match(html, /class="stp-note" role="note">Limited terminal/);
});

test('without the preload bridge the pane explains it cannot load (no crash)', async () => {
  const store = S.createTerminalStore({ bridge: null });
  assert.equal(store.available, false);
  // The shared store exists already (bridge present); the copy for a bridge-less window is checked through the model.
  const { terminalError } = await server.ssrLoadModule('/src/terminal-pane-model.mjs');
  assert.equal(terminalError(new Error("Error invoking remote method 'terminal:call': Error: Unknown session."), 'x'), 'Unknown session.');
});

test('titlebar: the Terminal toggle with ⌘J, pressed while open, a running dot while hidden', () => {
  const render = (props) => renderToStaticMarkup(h(T.SourceTitlebar, { section: 'new', session: { id: 'a', name: 'A', cwd: '/tmp/work' }, onRename() {}, ...props }));
  assert.doesNotMatch(render({}), /data-pane-toggle="terminal"/, 'hidden unless main.jsx can open it');
  let html = render({ terminalAvailable: true, panes: new Set(['chat']) });
  const button = html.match(/<button[^>]*data-pane-toggle="terminal"[^>]*>/)?.[0];
  assert.ok(button);
  assert.match(button, /aria-label="Terminal"/);
  assert.match(button, /aria-pressed="false"/);
  assert.match(button, /aria-keyshortcuts="Meta\+J Control\+`"/);
  assert.ok(html.indexOf('data-pane-toggle="terminal"') < html.indexOf('aria-label="Changes"'), 'before Changes');
  html = render({ terminalAvailable: true, terminalBusy: true, panes: new Set(['chat']) });
  assert.match(html, /aria-label="Terminal \(command running\)"[^>]*data-pane-toggle="terminal"/);
  assert.match(html, /data-pane-toggle="terminal"[^>]*>(?:(?!<\/button>).)*st-indicator-dot/);
  html = render({ terminalAvailable: true, terminalBusy: true, panes: new Set(['chat', 'terminal']) });
  assert.match(html.match(/<button[^>]*data-pane-toggle="terminal"[^>]*>/)[0], /aria-pressed="true"/);
  assert.doesNotMatch(html, /Terminal \(command running\)/);
});

test('the pane stylesheet follows the app rules: tokens, no pointer cursor, reduced motion for every animation', () => {
  const css = fs.readFileSync(path.join(app, 'src/source-terminal-pane.css'), 'utf8');
  assert.doesNotMatch(css, /cursor\s*:\s*pointer/);
  for (const selector of ['.stp-tab[data-bell] > .source-file-tab-bg', '.stp-placeholder']) {
    assert.ok(css.includes(`html[data-reduce-motion="true"] ${selector} { animation: none; }`), selector);
  }
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
