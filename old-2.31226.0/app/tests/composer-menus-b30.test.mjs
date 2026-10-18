import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// B30: composer menus and chin polish (ca80fca8d uz/dz/fz, O$/A$/W$, N$; c8e04f916 C; c2d9b9a76 mark row).
let server, C, P;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  C = await server.ssrLoadModule('/src/source-composer.jsx');
  P = await server.ssrLoadModule('/src/source-permission-menu.jsx');
});
after(() => server?.close());
const noop = () => {};
const render = props => renderToStaticMarkup(React.createElement(C.SourceComposer, {
  draft: '', setDraft: noop, onSubmit: noop, onMenu: noop, onStop: noop, running: false, sending: false,
  permission: 'auto', model: { model: 'fixture', displayName: 'Fixture' }, workdir: '/tmp/fixture', ...props }));
const modeTrigger = html => {
  const match = /<button[^>]*class="[^"]*sc-permission[^"]*"[^>]*>[\s\S]*?<\/button>/.exec(html);
  assert.ok(match, 'Mode trigger rendered');
  return match[0];
};

// Mn :20490-20497 dz(uz(t, n === r ? -1 : n, …, "inline"), r, …), An = Ie && St !== "auto".
test('permission badges: Default on the saved mode, Recommended on Auto while another mode is current', () => {
  assert.deepEqual(P.permissionBadges({ value: 'auto', defaultValue: 'auto' }), { auto: 'default' });
  assert.deepEqual(P.permissionBadges({ value: 'ask', defaultValue: 'acceptEdits' }), { acceptEdits: 'default', auto: 'recommended' });
  assert.deepEqual(P.permissionBadges({ value: 'plan', defaultValue: 'auto' }), { auto: 'recommended' }, 'Recommended replaces Default on the same row');
  assert.deepEqual(P.permissionBadges({ value: 'ask', defaultValue: 'bypass', values: ['auto', 'ask'] }), { auto: 'recommended' }, 'a default the menu does not list gets nothing');
  assert.deepEqual(P.permissionBadges({ value: 'ask', defaultValue: 'ask', values: ['ask', 'plan'] }), { ask: 'default' }, 'no Recommended without Auto');
});

// O$/A$ + N$: Manual reads text-warning with the warning as description; W$ skeleton while loading.
test('chin Mode label: truncating span, Manual warning tone and description, skeleton while the mode loads', () => {
  const auto = modeTrigger(render({ permission: 'auto' }));
  assert.match(auto, /<span class="sc-permission-label"><span class="sc-permission-text">Auto<\/span><\/span>/);
  assert.doesNotMatch(auto, /aria-description/);
  const manual = modeTrigger(render({ permission: 'ask' }));
  assert.match(manual, /aria-description="DeepSeek asks before making changes\. Auto is recommended\."/);
  assert.match(manual, /<span class="sc-permission-text" data-warning="">Manual<\/span>/);
  assert.doesNotMatch(modeTrigger(render({ permission: 'ask', sending: true })), /data-warning|aria-description/, 'a disabled trigger drops the warning');
  const loading = modeTrigger(render({ permission: null }));
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /sc-permission-invisible">Mode<\/span><span data-cds="Skeleton" class="smenu-skeleton sc-permission-skeleton" aria-hidden="true">/);
});

// c8e04f916 C: the marked stop, the label row under the track and '{name} ({badge})' value text.
test('effort slider: the badged level marks its stop and names the value text; a warning badge adds the note', () => {
  const levels = [{ reasoningEffort: 'low' }, { reasoningEffort: 'medium', badge: { message: 'Default', variant: 'neutral' } }, { reasoningEffort: 'high' }];
  const html = renderToStaticMarkup(React.createElement(C.EffortControl, { levels, value: 'medium', onChange: noop }));
  assert.match(html, /data-slider-stop="1" data-marked="" title="Medium \(Default\)"/);
  assert.match(html, /aria-valuetext="Medium \(Default\)"/);
  assert.match(html, /<span class="sc-slider-mark-row" aria-hidden="true" data-current=""><span class="sc-slider-mark-span" style="width:100%"><span class="sc-slider-mark-label">Default<\/span>/);
  const low = renderToStaticMarkup(React.createElement(C.EffortControl, { levels, value: 'low', onChange: noop }));
  assert.match(low, /aria-valuetext="Low"/);
  assert.doesNotMatch(low, /sc-slider-mark-row[^>]*data-current/);
  assert.doesNotMatch(html, /sc-effort-warning/);
  const warned = renderToStaticMarkup(React.createElement(C.EffortControl, { levels: [{ reasoningEffort: 'high' }, { reasoningEffort: 'max', badge: { message: 'High usage', variant: 'warning' } }], value: 'max', onChange: noop }));
  assert.match(warned, /data-effort-warning=""[^>]*>[\s\S]*DeepSeek thinks longer with Max effort/);
  assert.doesNotMatch(warned, /sc-slider-mark-row/, 'a warning badge is not a mark');
});
