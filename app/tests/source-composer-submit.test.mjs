import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// SSR of the composer Send/Stop cell (2.2553.1 c099c328d-CbkcmYSW.js sm/im/am/om): the first mount
// renders only the active layer, with no am fade-in (c starts false) and no inert/aria-hidden om layer.
let server, C;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  C = await server.ssrLoadModule('/src/source-composer.jsx');
});
after(() => server?.close());
const render = props => renderToStaticMarkup(React.createElement(C.SubmitCrossfade, props));
const stop = React.createElement('button', { type: 'button', 'aria-label': 'Stop response' });
const send = React.createElement('button', { type: 'submit', 'aria-label': 'Send message' });
const layers = html => html.match(/<div class="sc-submit-layer"[^>]*>/g) ?? [];

for (const showStop of [false, true]) test(`first mount (showStop=${showStop}) renders one plain layer in the grid cell`, () => {
  const html = render({ showStop, stop, send });
  assert.match(html, /^<div class="sc-submit-cell">/);
  assert.deepEqual(layers(html), ['<div class="sc-submit-layer">'], 'im only: no data-entering, data-leaving, inert or aria-hidden');
  assert.doesNotMatch(html, /inert|aria-hidden|data-entering|data-leaving/);
  assert.equal(html.includes('Stop response'), showStop);
  assert.equal(html.includes('Send message'), !showStop);
});

// Fidelity F05: cc43287c9-BMbiZYzF.js:27612 Jr / :28636-28638 — `disabled` (archived, real locks) is separate from
// `submitDisabled`: a loading session or a lost connection keeps the editor typeable while Send stays disabled.
const noop = () => {};
const composer = props => renderToStaticMarkup(React.createElement(C.SourceComposer, {
  draft: 'hello', setDraft: noop, onSubmit: noop, onMenu: noop, onStop: noop, running: false, sending: false,
  permission: 'auto', model: { model: 'fixture', displayName: 'Fixture' }, workdir: '/tmp/fixture', ...props }));
const editorTag = html => /<div[^>]*data-cds="ChatComposerEditor"[^>]*>/.exec(html)?.[0] ?? '';
const sendTag = html => /<button[^>]*aria-label="Send message"[^>]*>/.exec(html)?.[0] ?? '';
const cardTag = html => /<form[^>]*data-cds="ChatComposer"[^>]*>/.exec(html)?.[0] ?? '';
test('loading or disconnected: the editor stays contenteditable with no aria-disabled; Send is disabled; the card is not data-disabled', () => {
  for (const props of [{ canSubmit: false }, { canSubmit: false, warning: 'Connection to DeepSeek lost.', onReconnect: noop }]) {
    const html = composer(props);
    assert.match(editorTag(html), /contentEditable="true"/); assert.doesNotMatch(editorTag(html), /aria-disabled/);
    assert.match(sendTag(html), / disabled=""/, 'Send waits for the session and the core');
    assert.doesNotMatch(cardTag(html), /data-disabled/);
  }
  assert.match(composer({ canSubmit: false, warning: 'Connection to DeepSeek lost.', onReconnect: noop }), /data-cds-composer-warning="">.*Retry/, 'the warning row and Retry stay');
  assert.doesNotMatch(sendTag(composer({})), / disabled=""/, 'a connected, loaded session can send');
});
test('an archived (not editable) composer disables the editor and marks the card', () => {
  const html = composer({ editable: false });
  assert.match(editorTag(html), /contentEditable="false"/); assert.match(editorTag(html), /aria-disabled="true"/);
  assert.match(cardTag(html), /data-disabled="true"/); assert.match(sendTag(html), / disabled=""/);
});
test('a host command can still be sent without a connection; a skill message cannot', () => {
  assert.doesNotMatch(sendTag(composer({ draft: '/theme dark', canSubmit: false })), / disabled=""/);
  const skills = [{ name: 'pdf', path: '/s/pdf/SKILL.md' }];
  assert.match(sendTag(composer({ draft: '/pdf go', canSubmit: false, commandContext: { skills } })), / disabled=""/, 'a skill is a message');
  assert.doesNotMatch(sendTag(composer({ draft: '/pdf go', commandContext: { skills } })), / disabled=""/);
});

// R05 'Send and stay here' (c099c328d :8870-8895 Send tooltip rows Tm{Send, enter} + de ? Tm{'Send and stay here',
// cmd+enter}; cc43287c9 :28620 stayOnDraftHint on the Home draft). The tooltip popup only mounts on hover, so a
// second SSR server swaps SourceTooltip for a probe that records the props each tooltip receives.
let probeServer, P;
before(async () => {
  const probe = { name: 'tooltip-probe', enforce: 'pre', transform(code, id) {
    if (!id.endsWith('/src/source-tooltip.jsx')) return null;
    return code.replace('export function SourceTooltip(', 'function SourceTooltipOriginal(')
      + '\nexport function SourceTooltip(props) { return React.createElement(React.Fragment, null, SourceTooltipOriginal(props), React.createElement("span", { hidden: true, "data-tooltip-probe": JSON.stringify({ content: typeof props.content === "string" ? props.content : null, shortcut: props.shortcut ?? null, secondaryHint: props.secondaryHint ?? null }) })); }\n';
  } };
  probeServer = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [probe, react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  P = await probeServer.ssrLoadModule('/src/source-composer.jsx');
});
after(() => probeServer?.close());
const probes = props => [...renderToStaticMarkup(React.createElement(P.SourceComposer, {
  draft: 'hello', setDraft: noop, onSubmit: noop, onMenu: noop, onStop: noop, running: false, sending: false,
  permission: 'auto', model: { model: 'fixture', displayName: 'Fixture' }, workdir: '/tmp/fixture', ...props }))
  .matchAll(/data-tooltip-probe="([^"]*)"/g)].map(match => JSON.parse(match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&')));
const sendTooltip = props => probes(props).find(entry => entry.content === 'Send');
test("the Home draft's Send tooltip has the second row 'Send and stay here' ⌘⏎; an open session has none", () => {
  assert.deepEqual(sendTooltip({ stayOnDraft: true }), { content: 'Send', shortcut: 'enter', secondaryHint: { label: 'Send and stay here', shortcut: 'cmd+enter' } });
  assert.deepEqual(sendTooltip({}), { content: 'Send', shortcut: 'enter', secondaryHint: null });
  // While a turn runs with content the second row is the queue lane, never the stay lane.
  assert.deepEqual(sendTooltip({ stayOnDraft: true, running: true, queueEnabled: true }).secondaryHint, { label: 'Queue for later', shortcut: 'cmd+enter' });
  assert.equal(probes({ stayOnDraft: true }).some(entry => /fork/i.test(JSON.stringify(entry))), false, 'no ⌘⌥⏎ fork row: thread/fork is unsupported');
});

// Round-2 walk a10: the Home pet (80px sprite at the composer's top-right) covered the warning row's Retry.
test('a warning row under the Home pet reserves the pet’s width and keeps Retry above the sprite', async () => {
  // SourcePet reads matchMedia / document during render; SSR gets inert stand-ins for this one render.
  const stubs = { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), document: { documentElement: { dataset: {} } } };
  const added = Object.keys(stubs).filter(key => !(key in globalThis));
  for (const key of added) globalThis[key] = stubs[key];
  let withPet;
  try { withPet = composer({ canSubmit: false, warning: 'Connection to DeepSeek lost.', onReconnect: noop, showPet: true }); }
  finally { for (const key of added) delete globalThis[key]; }
  assert.match(withPet, /<div class="sc-warning-row" role="status" data-cds-composer-warning="" data-pet="true">/);
  assert.doesNotMatch(composer({ canSubmit: false, warning: 'Connection to DeepSeek lost.', onReconnect: noop }), /data-pet/);
  const fs = await import('node:fs/promises');
  const css = await fs.readFile(path.resolve(import.meta.dirname, '../src/source-composer.css'), 'utf8');
  const pet = /\.sc-pet \{[^}]*right: (-?\d+)px;[^}]*width: (\d+)px;/.exec(css);
  const pad = /\.sc-warning-row\[data-pet\] \{ padding-right: (\d+)px; \}/.exec(css);
  assert.ok(pet && pad, 'pet geometry and row padding');
  assert.ok(Number(pad[1]) >= Number(pet[2]) + Number(pet[1]), 'the padding clears the sprite box inside the column');
  assert.match(css, /\.sc-warning-action \{ position: relative; z-index: 3; \}/, 'Retry stacks above .sc-pet (z-index 2)');
});

// Round-2 walk b4/b5: before init() settles the saved mode is unknown; the chip must not claim Auto.
test('permission null (saved mode not loaded) renders a disabled, busy "Mode" chip instead of a mode', () => {
  const chip = html => /<button[^>]*class="[^"]*sc-permission[^"]*"[^>]*>.*?<\/button>/.exec(html)?.[0] ?? '';
  const loading = chip(composer({ permission: null, canSubmit: false }));
  assert.match(loading, / disabled=""/); assert.match(loading, /aria-busy="true"/);
  assert.match(loading, />Mode</); assert.doesNotMatch(loading, /Auto/);
  const plan = chip(composer({ permission: 'plan' }));
  assert.doesNotMatch(plan, / disabled=""/); assert.match(plan, /Plan/);
});
test('the connecting hint is not shown until Enter is refused, and main wires it to the startup and session-load gates', async () => {
  assert.doesNotMatch(composer({ canSubmit: false, connectingHint: 'Still connecting to DeepSeek. Try again in a moment.' }), /Still connecting/);
  const fs = await import('node:fs/promises');
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/source-composer.jsx'), 'utf8');
  assert.match(source, /if \(!canSend\) \{\n\s*if \(connectingHint && hasContent && !hostCommand && !running\) setBlockedSubmit\(true\);/);
  const main = await fs.readFile(path.resolve(import.meta.dirname, '../src/main.jsx'), 'utf8');
  assert.match(main, /permission=\{boot \|\| initSettled \? effectivePermission : null\}/);
  assert.match(main, /connectingHint=\{!boot\?\.connected && \(loading \|\| !initSettled\)/);
  const zh = (await import('../electron/i18n/zh-CN/index.mjs')).default;
  assert.equal(typeof zh['Still connecting to DeepSeek. Try again in a moment.'], 'string');
});
