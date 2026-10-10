// Server rendering of the Preview pane (src/source-preview-pane.jsx) in each state it can paint first.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

let server, P;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  P = await server.ssrLoadModule('/src/source-preview-pane.jsx');
});
after(() => server?.close());

const base = { sessionId: 't1', cwd: '/work', url: '', title: '', loading: false, error: null, hasPage: false, canGoBack: false, canGoForward: false, devtools: false,
  viewport: { preset: 'responsive', width: null, height: null, colorScheme: 'system', setByAgent: false }, hostId: null, servers: [], consoleErrors: 0,
  launch: { exists: false, error: null, problems: [], configs: [], autoVerify: true } };
const render = (state, props = {}) => renderToStaticMarkup(React.createElement(P.SourcePreviewPane, { sessionId: 't1', desktop: null, initialState: state, ...props }));

test('header: Servers & settings, the URL field and the navigation group', () => {
  const html = render(base, { onAttachScreenshot: () => {} });
  assert.match(html, /<aside class="source-file-panel detail-panel spv-pane" aria-label="Preview" data-preview-surface="start">/);
  assert.match(html, /aria-label="Servers &amp; settings"/);
  assert.match(html, /aria-label="Enter a URL"/);
  assert.match(html, /role="group" aria-label="Navigation"/);
  for (const label of ['Go back', 'Go forward', 'Attach screenshot', 'Open in default browser', 'Reload']) assert.match(html, new RegExp(`aria-label="${label}"`));
  assert.doesNotMatch(html, /cursor:\s*pointer/);
});

test('no launch.json: the empty start page offers Detect dev server, and Ask DeepSeek only when the agent can be asked', () => {
  const html = render(base, { onAskAgent: () => {} });
  assert.match(html, /data-preview-start="empty"/);
  assert.match(html, /Preview your app/);
  assert.match(html, /data-variant="primary">Detect dev server</);
  assert.match(html, />Ask DeepSeek</);
  assert.doesNotMatch(render(base), />Ask DeepSeek<|>Add server</);
  assert.match(render(base), />Detect dev server</);
});

test('configured servers list with Run / Stop and the launch.json hint', () => {
  const html = render({ ...base, launch: { ...base.launch, exists: true, configs: [{ name: 'web', port: 5173, url: 'http://localhost:5173', attach: false }, { name: 'api', port: 8080, url: 'http://localhost:8080', attach: false }] },
    servers: [{ name: 'api', port: 8080, url: 'http://localhost:8080', status: 'running', error: null }] });
  assert.match(html, /data-preview-start="servers"/);
  assert.match(html, /aria-label="Run web"/);
  assert.match(html, /aria-label="Stop api"/);
  assert.match(html, /:5173/);
  assert.match(html, /Open a server to preview your app, or enter a URL\./);
  assert.match(html, /Edit this list in \.claude\/launch\.json\./);
});

test('a page: the URL shows host and path, the skip link explains F6, the start page is gone', () => {
  const html = render({ ...base, hasPage: true, url: 'http://localhost:5173/about?x=1', title: 'App', canGoBack: true, viewport: { ...base.viewport, preset: 'mobile', width: 375, height: 812 } });
  assert.match(html, /data-preview-surface="page"/);
  assert.match(html, /aria-label="Page URL: http:\/\/localhost:5173\/about\?x=1"/);
  assert.match(html, /<span class="spv-url-host">localhost:5173<\/span><span class="spv-url-rest">\/about\?x=1<\/span>/);
  assert.match(html, /press F6 or Ctrl\+F6 to move back out/);
  assert.match(html, /Mobile · 375 × 812/);
  assert.doesNotMatch(html, /data-preview-start/);
});

test('a load failure, and a page another pane shows (an empty viewport, no notice — as 2.2553.1)', () => {
  const failed = render({ ...base, hasPage: true, url: 'http://localhost:3000/', error: { code: '-102', description: 'ERR_CONNECTION_REFUSED', url: 'http://localhost:3000/' } });
  assert.match(failed, /role="alert"/);
  assert.match(failed, /Couldn’t load this preview/);
  assert.match(failed, /Nothing is answering at http:\/\/localhost:3000\//);
  const elsewhere = render({ ...base, hasPage: true, url: 'http://localhost:3000/', hostId: 'another-pane' });
  assert.match(elsewhere, /data-preview-surface="page"/);
  assert.match(elsewhere, /<span class="spv-url-host">localhost:3000<\/span>/, 'the header still drives the shared page');
  assert.doesNotMatch(elsewhere, /another pane|Show here|data-preview-start/);
});

test('the loading state before main answers', () => {
  const html = render(null);
  assert.match(html, /data-preview-surface="loading"/);
  assert.match(html, /aria-label="Loading preview"/);
});

test('header: Annotate (Edit, ⇧⌘X) sits before Open in default browser and needs a page and a composer', () => {
  const page = { ...base, hasPage: true, url: 'http://localhost:5173/' };
  const html = render(page, { onAttachScreenshot: () => {} });
  assert.match(html, /aria-label="Annotate"[^>]*data-preview-annotate=""/);
  assert.ok(html.indexOf('aria-label="Annotate"') < html.indexOf('aria-label="Open in default browser"'));
  assert.ok(html.indexOf('aria-label="Go forward"') < html.indexOf('aria-label="Annotate"'));
  assert.doesNotMatch(html.match(/<button[^>]*aria-label="Annotate"[^>]*>/)[0], /disabled/);
  assert.match(render(page).match(/<button[^>]*aria-label="Annotate"[^>]*>/)[0], /disabled=""/);
  assert.match(render(base, { onAttachScreenshot: () => {} }).match(/<button[^>]*aria-label="Annotate"[^>]*>/)[0], /disabled=""/);
});

test('sketch: history, fit and the toolbar markup', async () => {
  const S = await server.ssrLoadModule('/src/source-pane-sketch.jsx');
  const mark = (x) => ({ tool: 'pen', color: '#E03131', points: [{ x, y: x }] });
  let h = S.commitMark(S.emptyHistory(), mark(0.1));
  h = S.commitMark(h, mark(0.2));
  assert.equal(h.present.length, 2);
  h = S.undoHistory(h);
  assert.deepEqual(h.present, [mark(0.1)]);
  assert.equal(h.future.length, 1);
  h = S.redoHistory(h);
  assert.equal(h.present.length, 2);
  h = S.clearHistory(h);
  assert.deepEqual(h.present, []);
  assert.equal(S.undoHistory(h).present.length, 2, 'Clear all can be undone');
  assert.equal(S.commitMark(S.undoHistory(h), mark(0.3)).future.length, 0, 'a new mark drops the redo stack');
  assert.deepEqual(S.fitBox({ width: 1600, height: 1000 }, 800, 800, 2), { width: 800, height: 500 });
  assert.deepEqual(S.fitBox({ width: 1600, height: 1000 }, 400, 800, 2), { width: 400, height: 250 });
  assert.equal(S.fitBox({ width: 0, height: 0 }, 400, 800, 2), null);
  const html = renderToStaticMarkup(React.createElement(S.SourcePaneSketch, { backdrop: { src: 'data:image/png;base64,AA==', width: 10, height: 10 }, onCancel() {}, onAttach() {} }));
  for (const label of ['Pen', 'Line', 'Arrow', 'Rectangle', 'Ellipse', 'Red', 'Blue', 'Green', 'Black', 'Undo', 'Redo', 'Clear all']) assert.match(html, new RegExp(`aria-label="${label}"`));
  assert.match(html, /role="group" aria-label="Annotation tool"/);
  assert.match(html, /role="group" aria-label="Ink color"/);
  assert.match(html, /aria-label="Pen" aria-pressed="true"/);
  assert.match(html, />Close</);
  assert.match(html, /data-sketch-attach=""[^>]*data-variant="primary"[^>]*>.*Add to chat/);
  assert.match(html, /<button[^>]*aria-label="Undo"[^>]*disabled=""/);
  assert.doesNotMatch(html, /cursor:\s*pointer/);
});
