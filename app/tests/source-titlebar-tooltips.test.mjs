import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { RELEASE_NOTES } from '../src/release-notes.mjs';

// c360a9e1c-GPs-MV9u.js yp (6347-6360), mm (7387-7420) and Fp (6760-6810): the
// origin glyph, title button and folder pill use CDS tooltips (Zt), so the SSR
// lead carries no native title.
let server, T;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  // SourceDialog portals to <body>; the server renderer has no portals, so render them inline (as
  // settings-shell-render does) before the first ESM import of react-dom.
  createRequire(path.resolve(import.meta.dirname, '../package.json'))('react-dom').createPortal = (children) => children;
  T = await server.ssrLoadModule('/src/source-titlebar.jsx');
});
after(() => server?.close());
const render = (props) => renderToStaticMarkup(React.createElement(T.SourceTitlebar, { section: 'new', session: { id: 'a', name: 'A title', cwd: '/tmp/work' }, onRename() {}, ...props }));
const lead = (html) => html.slice(html.indexOf('<div class="st-lead"'), html.indexOf('st-measurements'));

test('no native title on .st-origin, .st-title or .st-folder', () => {
  for (const props of [{}, { menuKind: 'folder' }, { session: { id: 'b', name: 'No folder' } }]) {
    const html = lead(render(props));
    for (const name of ['st-origin', 'st-origin-glyph', 'session-title st-title', 'st-folder']) {
      const tag = html.match(new RegExp(`<[a-z]+[^>]*class="${name}"[^>]*>`))?.[0];
      assert.ok(tag, name + ' renders');
      assert.doesNotMatch(tag, /title=/, name);
    }
    assert.doesNotMatch(html, /\stitle="/);
  }
  const html = lead(render({}));
  assert.match(html, /aria-label="A title, rename session"/);
  assert.match(html, /role="img" aria-label="Local"/);
  assert.match(html, /aria-label="Folder: \/tmp\/work"/);
});

// titlebar-release-notes.js:5238-5256 V: the home nudge renders only while
// `justUpdated || modalOpen`; main.jsx passes that as showWhatsNew.
test('home What’s new button follows showWhatsNew', async () => {
  const home = (props) => renderToStaticMarkup(React.createElement(T.SourceTitlebar, { section: 'new', session: null, onRename() {}, ...props }));
  assert.doesNotMatch(home({ showWhatsNew: false }), /st-whats-new|What’s new/);
  assert.doesNotMatch(home({}), /st-whats-new/);
  assert.match(home({ showWhatsNew: true }), /<button type="button" class="st-whats-new">What’s new<\/button>/);
  assert.doesNotMatch(render({ showWhatsNew: true }), /st-whats-new/);
  // R03: the nudge versions come from the bundled, versioned release notes, not from the running package version.
  const notes = await server.ssrLoadModule('/src/release-notes.mjs');
  assert.deepEqual([...T.LOCAL_RELEASE_NOTE_VERSIONS], notes.RELEASE_NOTES.map((entry) => entry.version));
});

// Fidelity F02 (shared-frame-C_2npUJq.js:4572-4580 Mu → Qa variant "text"): tooltip shortcuts are key specs
// that the tooltip draws as one <kbd> per key in io modifier order, so Changes reads ⇧ ⌘ D, not ⌘⇧D.
test('titlebar tooltips carry key specs; the text-variant Shortcut draws Changes as ⇧ ⌘ D', async () => {
  const S = await server.ssrLoadModule('/src/source-shortcut.jsx');
  const C = await server.ssrLoadModule('/src/code-ui.jsx');
  const N = await server.ssrLoadModule('/src/source-nav-buttons.jsx');
  assert.equal(T.CHANGES_TOOLTIP.shortcut, 'cmd+shift+d');
  assert.equal(C.SIDEBAR_TOGGLE_TOOLTIP.hide.shortcut, 'cmd+b');
  assert.deepEqual([N.NAV_TOOLTIPS.back.shortcut, N.NAV_TOOLTIPS.forward.shortcut], ['cmd+[', 'cmd+]']);
  const glyphs = (keys) => [...renderToStaticMarkup(React.createElement(S.SourceShortcut, { keys, variant: 'text', mac: true }))
    .matchAll(/<kbd class="scds-text-key">(?:<span aria-hidden="true">)?([^<]+)/g)].map((match) => match[1]);
  assert.deepEqual(glyphs(T.CHANGES_TOOLTIP.shortcut), ['⇧', '⌘', 'D']);
  assert.deepEqual(glyphs(C.SIDEBAR_TOGGLE_TOOLTIP.show.shortcut), ['⌘', 'B']);
  assert.deepEqual(glyphs(N.NAV_TOOLTIPS.back.shortcut), ['⌘', '[']);
  assert.deepEqual(glyphs('cmd+shift+\\'), ['⇧', '⌘', '\\']);
  assert.deepEqual(glyphs('enter'), ['⏎']);
  // The tooltip renders that variant for `shortcut` and `secondaryHint.shortcut`.
  const tooltip = fs.readFileSync(path.resolve(import.meta.dirname, '../src/source-tooltip.jsx'), 'utf8');
  assert.match(tooltip, /<SourceShortcut variant="text" keys=\{keys\} className="source-tooltip-shortcut" \/>/);
  assert.match(tooltip, /\{shortcut && <TooltipShortcut keys=\{shortcut\} \/>\}/);
  assert.match(tooltip, /<TooltipShortcut keys=\{secondaryHint\.shortcut\} \/>/);
});

// R03 (titlebar-release-notes.js:5156-5236 B): What’s new is the shared CDS Dialog at size md with the bleed header and
// a single 'Close'; the lag note z; one section per entry up to the running version with an h4 date and a neutral
// font-mono version Badge; New / Improved / Fixed groups (empty ones omitted); `code` spans; the limits footnote.
test('LocalReleaseNotes is the bleed md SourceDialog with versioned entries', () => {
  const hadDocument = 'document' in globalThis;
  if (!hadDocument) globalThis.document = { body: {}, documentElement: { getAttribute: () => null } };
  let html;
  try { html = renderToStaticMarkup(React.createElement(T.LocalReleaseNotes, { onClose() {} })); }
  finally { if (!hadDocument) delete globalThis.document; }
  assert.match(html, /<section[^>]*role="dialog"[^>]*data-cds="Dialog" data-dialog-size="md"[^>]*class="sdlg-popup cds-reset st-release-notes"/);
  assert.match(html, /<header class="sdlg-bleed-header"><h2 id="[^"]+" class="sdlg-bleed-title">What’s new<\/h2>/);
  assert.deepEqual([...html.matchAll(/aria-label="([^"]+)"/g)].map((match) => match[1]), ['Close']);
  assert.match(html, /<p class="st-release-note">These release notes are included with this version of the app and may be one release behind\.<\/p>/);
  assert.match(html, /<div class="st-release-date"><h4>October 1, 2026<\/h4><span class="st-release-version" data-cds="Badge" data-variant="neutral">0\.2\.130<\/span><\/div>/);
  assert.deepEqual([...html.matchAll(/<h5>([^<]+)<\/h5>/g)].map((match) => match[1]), ['New', 'Improved']);
  assert.match(html, /<code class="st-release-code">~\/\.dsh<\/code>/);
  // /fork, /review and /rewind ship (session-command-model.mjs): the limits only say they depend on the running core.
  assert.match(html, /<p class="st-release-limits">Known limits: Some commands, such as \/fork, \/review and \/rewind, depend on the running core; the slash menu says when one isn’t available\./);
  assert.doesNotMatch(html, /aren’t available yet|Background jobs don’t appear/);
  // The notes are core-neutral: they describe the frame and name DeepSeek Harness only as the built-in core.
  assert.match(html, /Code Desktop is now a frame for agent cores: choose one in Settings › Cores\./);
  assert.match(html, /DeepSeek Harness is built in; the others install on demand/);
  assert.doesNotMatch(html, /powered by DeepSeek|run on DeepSeek models/);
  assert.equal([...html.matchAll(/<li[ >]/g)].length, RELEASE_NOTES[0].items.length, 'one list item per bundled note');
  assert.doesNotMatch(html, /Codex|modal-backdrop|st-release-header|Close release notes|title="/);
});

// Split view (c360a9e1c-GPs-MV9u.js Im): each side's titlebar ends with its own ghost X ('Close split view',
// epitaxy-pane-close-control) with a CDS tooltip; there is none while the window isn't split.
test('a split side closes itself from the end of its own titlebar', () => {
  const plain = render({});
  assert.doesNotMatch(plain, /data-split-close|Close split view/);
  const html = render({ onCloseSplit() {}, closeSplitShortcut: 'ctrl+cmd+w' });
  const trailing = html.slice(html.indexOf('st-trailing'));
  const close = trailing.match(/<button[^>]*data-split-close=""[^>]*>/)?.[0];
  assert.ok(close, 'close control renders in the trailing actions');
  assert.match(close, /class="code-icon-button epitaxy-pane-close-control"/);
  assert.match(close, /aria-label="Close split view"/);
  assert.doesNotMatch(close, /title=/);
  assert.ok(trailing.lastIndexOf('data-split-close') > trailing.lastIndexOf('Session options'), 'after Session options');
  // No session (a new-session side) still has its close.
  assert.match(render({ session: null, onCloseSplit() {} }), /data-split-close=""/);
});
