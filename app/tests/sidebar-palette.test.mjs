import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import {
  EMPTY_PALETTE_FILTERS, filterPaletteActions, matchRanges, movePaletteSelection, paletteActions, paletteDateFloor, paletteMode,
  palettePlaceholder, paletteProjects, paletteRelativeTime, paletteSessions, stepPaletteType,
} from '../src/sidebar-palette-model.mjs';
import { dictionary } from '../electron/i18n/index.mjs';

// ⌘K / ⇧⌘K command palette (2.2553.1 c2771e1f6-v15xXKAc.js vm in shared-22 XP), source-sidebar-palette.jsx.
let server, SourceSidebarPalette, SourceSidebar;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  ({ SourceSidebarPalette } = await server.ssrLoadModule('/src/source-sidebar-palette.jsx'));
  ({ SourceSidebar } = await server.ssrLoadModule('/src/source-sidebar.jsx'));
});
after(async () => { await server?.close(); });

const NOW = Date.UTC(2026, 9, 7, 12);
const nowSec = Math.floor(Date.now() / 1000);
const thread = (id, fields = {}) => ({ id, name: 'Session ' + id, cwd: '/fixture/work', createdAt: nowSec, updatedAt: nowSec, ...fields });
const palette = (props) => renderToStaticMarkup(React.createElement(SourceSidebarPalette, {
  open: true, inline: true, sessions: [thread('a', { name: 'Fix login bug' }), thread('b', { name: 'Write docs', cwd: '/fixture/docs' })],
  folders: ['/fixture/work', '/fixture/docs'], actions: paletteActions({ onNew() {}, setSection() {}, onToggleSidebar() {}, onOpenSettings() {} }),
  setQuery() {}, onClose() {}, ...props,
}));

test('vm placeholders per mode and the mode parser', () => {
  assert.equal(palettePlaceholder('default'), 'Search or start a session');
  assert.equal(palettePlaceholder('search'), 'Search sessions and projects');
  assert.equal(palettePlaceholder('actions'), 'Search actions');
  assert.equal(paletteMode('search'), 'search');
  assert.equal(paletteMode('bogus'), 'default');
});

test('Xu relative times and the date filter floors', () => {
  assert.equal(paletteRelativeTime(NOW - 60e3, NOW), 'Just now');
  assert.equal(paletteRelativeTime(NOW - 30 * 60e3, NOW), 'Past hour');
  assert.equal(paletteRelativeTime(NOW - 3 * 864e5, NOW), 'Past week');
  assert.equal(paletteRelativeTime(NOW - 20 * 864e5, NOW), 'Past month');
  assert.equal(paletteRelativeTime(NOW - 400 * 864e5, NOW), null);
  assert.equal(paletteDateFloor('week', NOW), NOW - 7 * 864e5);
  assert.equal(paletteDateFloor(null, NOW), null);
});

test('session and project results: title match, content match, archived only in search, date filter', () => {
  const sessions = [thread('a', { name: 'Fix login bug' }), thread('b', { name: 'Docs', archived: true }), thread('c', { name: 'Other', updatedAt: nowSec - 40 * 86400 })];
  assert.deepEqual(paletteSessions({ sessions, query: 'login' }).map((s) => s.id), ['a']);
  assert.deepEqual(paletteSessions({ sessions, query: 'zzz', contentMatches: new Set(['c']) }).map((s) => s.id), ['c']);
  assert.deepEqual(paletteSessions({ sessions }).map((s) => s.id), ['a', 'c'], 'the default view leaves archived sessions out');
  assert.ok(paletteSessions({ sessions, includeArchived: true }).some((s) => s.id === 'b'));
  assert.deepEqual(paletteSessions({ sessions, filters: { ...EMPTY_PALETTE_FILTERS, date: 'month' } }).map((s) => s.id), ['a']);
  assert.deepEqual(paletteProjects({ folders: ['/x/alpha', '/x/beta'], query: 'alp' }).map((p) => p.name), ['alpha']);
  assert.deepEqual(matchRanges('Fix login Login', 'login'), [[4, 9], [10, 15]]);
});

test('Actions mode rows: Settings → / Customize → sections and app commands', () => {
  const opened = [];
  const actions = paletteActions({ onNew() {}, setSection() {}, onToggleSidebar() {}, onOpenSettings: (id) => opened.push(id) });
  const labels = actions.map((a) => a.label);
  for (const label of ['New session', 'Toggle sidebar', 'Settings', 'Settings → Theme', 'Customize → Skills', 'Customize → Connectors']) assert.ok(labels.includes(label), label);
  actions.find((a) => a.label === 'Customize → Skills').run();
  assert.deepEqual(opened, ['customize-skills']);
  assert.deepEqual(filterPaletteActions(actions, 'theme').map((a) => a.label), ['Settings → Theme']);
  assert.equal(movePaletteSelection(-1, 3, 'ArrowDown'), 0);
  assert.equal(movePaletteSelection(0, 3, 'ArrowUp'), 2);
  assert.equal(stepPaletteType(null, 1), 'session');
  assert.equal(stepPaletteType(null, -1), 'project');
});

test('default mode: a modal dialog with the combobox, Quick actions and Recents, footer key hints', () => {
  const html = palette({});
  assert.match(html, /role="dialog" aria-modal="true" aria-label="Command palette"/);
  assert.match(html, /role="combobox"[^>]*placeholder="Search or start a session"/);
  assert.match(html, /aria-label="Quick actions"/);
  assert.match(html, /aria-label="Recents"/);
  assert.match(html, /Fix login bug/);
  assert.match(html, /<span>Select<\/span>/);
  assert.match(html, /<span>Actions<\/span><span class="spal-keys" aria-hidden="true"><kbd>Tab<\/kbd>/);
  assert.doesNotMatch(html, /cursor:\s*pointer/);
});

test('typed default mode adds the quoted New session send row, matches and the Send hint', () => {
  const html = palette({ query: 'login' });
  assert.match(html, /New session<span class="spal-send-text"><span class="spal-quote">“<\/span>login<span class="spal-quote">”<\/span>/);
  assert.match(html, /<strong class="spal-match">login<\/strong>/);
  assert.match(html, /<span>Send<\/span>/);
  assert.match(html, /1 result available/);
});

test('search mode: type tabs, date filter and the empty state', () => {
  const html = palette({ entry: 'search' });
  assert.match(html, /placeholder="Search sessions and projects"/);
  for (const label of ['All', 'Sessions', 'Projects', 'Today', 'Past week', 'Past month']) assert.match(html, new RegExp(`>${label}</button>`), label);
  assert.match(html, /aria-label="Search mode"/);
  const empty = palette({ entry: 'search', query: 'nothing-matches-this' });
  assert.match(empty, /No results found/);
});

test('every palette string has a zh-CN entry', () => {
  const zh = dictionary('zh-CN');
  for (const s of ['Search or start a session', 'Search sessions and projects', 'Search actions', 'Quick actions', 'Recents', 'Actions', 'Projects',
    'Command palette', 'Command palette options', 'Search results', 'Search mode', 'Actions mode', 'Searching deeper...', 'Filters', 'No results found',
    'Select', '{count} result available', '{count} results available', 'Past hour', 'Past week', 'Past month', 'Past year', 'Settings → {section}',
    'Customize → {section}', 'Show PR status']) assert.ok(zh[s], s);
});

test('the sidebar has no standalone Routines label; Routines is only the nav row', () => {
  const html = renderToStaticMarkup(React.createElement(SourceSidebar, { sessions: [thread('s1')], knownFolders: ['/fixture/work'] }));
  assert.doesNotMatch(html, /source-routines-label/);
  assert.equal(html.match(/>Routines</g).length, 1);
  const css = readFileSync(path.resolve(import.meta.dirname, '../src/source-sidebar.css'), 'utf8');
  assert.doesNotMatch(css, /source-routines-label|source-search-start/);
});

test('pointer-opened menus highlight nothing; the account menu has no invented appearance item', () => {
  const sidebar = readFileSync(path.resolve(import.meta.dirname, '../src/source-sidebar.jsx'), 'utf8');
  assert.match(sidebar, /initialHighlight=\{menu\.entry \?\? "popup"\}/);
  assert.match(sidebar, /onClick=\{\(event\) => onAccount\?\.\(event, keyboardEntry\(event\)\)\}/);
  const main = readFileSync(path.resolve(import.meta.dirname, '../src/main.jsx'), 'utf8');
  // A click (detail > 0) passes no entry, so SourceMenu's focusItemOnOpen "auto" leaves every row unhighlighted.
  assert.match(sidebar, /onMenu\?\.\("connection", event\.currentTarget, undefined, keyboardEntry\(event\)\)/);
  assert.doesNotMatch(main, /t\("Dark appearance"\)|t\("Light appearance"\)/);
});
