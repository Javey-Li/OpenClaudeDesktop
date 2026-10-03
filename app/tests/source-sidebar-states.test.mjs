import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { readFileSync } from 'node:fs';

// Node-only SSR of the real SourceSidebar (no browser, Electron or Codex):
// sidebar-groups.js zP New row selection, OO empty variants and AO skeleton.
let server, SourceSidebar, SourceSidebarEmpty, SourceSidebarSessionMenu, deleteConfirmCopy, olderConfirmCopy;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  ({ SourceSidebar, SourceSidebarEmpty, SourceSidebarSessionMenu, deleteConfirmCopy, olderConfirmCopy } = await server.ssrLoadModule('/src/source-sidebar.jsx'));
});
after(async () => { await server?.close(); });

const now = Math.floor(Date.now() / 1000);
const thread = (id, fields = {}) => ({ id, name: 'Session ' + id, cwd: '/fixture/work', createdAt: now, updatedAt: now, ...fields });
const render = (props) => renderToStaticMarkup(React.createElement(SourceSidebar, { sessions: [thread('s1')], knownFolders: ['/fixture/work'], ...props }));
// Nav rows carry shared-21 ND's "group" (:7590-7597) since 0.2.121 so mD's group-* utilities resolve.
const newRow = (html) => html.match(/<button[^>]*class="source-sidebar-nav-row group"[^>]*>(?:(?!<\/button>).)*New<\/span>/s)?.[0].match(/^<button[^>]*>/)[0];

test('New is selected only on the new route with no open session (zP y = _ && !v) and always carries aria-keyshortcuts', () => {
  const open = newRow(render({ current: 's1', section: 'new' }));
  assert.ok(open, 'New row renders');
  assert.doesNotMatch(open, /data-selected/); assert.doesNotMatch(open, /aria-current/);
  assert.match(open, /aria-keyshortcuts="Meta\+n"/);
  const openHtml = render({ current: 's1', section: 'new' });
  assert.equal(openHtml.match(/data-selected="focused"/g).length, 1, 'only the open session row is selected');
  assert.match(openHtml, /data-source-session-id="s1" data-selected="focused"/);
  const fresh = newRow(render({ current: null, section: 'new' }));
  assert.match(fresh, /data-selected="focused"/); assert.match(fresh, /aria-current="page"/); assert.match(fresh, /aria-keyshortcuts="Meta\+n"/);
  assert.match(render({ current: null, section: 'new' }), /<kbd aria-hidden="true">⌘ N<\/kbd>/);
  const customize = render({ current: null, section: 'customize' });
  assert.doesNotMatch(newRow(customize), /data-selected|aria-current/);
  assert.match(customize, /data-selected="focused"[^>]*>(?:(?!<\/button>).)*Customize/s);
});

test('filtered empty variant: OO copy and Show all sessions button', () => {
  const html = render({ sessions: [thread('s1', { archived: true })], sidebarPreferences: { status: 'active' } });
  assert.match(html, /data-empty-variant="filtered"/);
  assert.match(html, /<p class="source-sidebar-empty-text">No sessions match the current filters<\/p>/);
  assert.match(html, /<button type="button" class="source-sidebar-show-all hide-focus-ring">Show all sessions<\/button>/);
  assert.doesNotMatch(html, /No archived sessions|No sessions match these filters|Open a folder/);
  const archivedFilter = render({ sessions: [], sidebarPreferences: { status: 'archived' } });
  assert.match(archivedFilter, /data-empty-variant="filtered"/);
  // fO (sidebar-groups.js:7600-7609): status all with no sessions is no-sessions, not filtered.
  assert.match(render({ sessions: [], sidebarPreferences: { status: 'all' } }), /data-empty-variant="no-sessions"/);
  assert.match(render({ sessions: [], sidebarPreferences: { groupBy: 'state', stateActivityDays: 3 } }), /data-empty-variant="filtered"/);
  assert.match(render({ sessions: [], sidebarPreferences: { groupBy: 'state', stateActivityDays: 30 } }), /data-empty-variant="no-sessions"/);
});

test('no-sessions empty variant: OO copy and the xO pictogram at scale .55', () => {
  const html = render({ sessions: [] });
  assert.match(html, /data-empty-variant="no-sessions"/);
  assert.match(html, /Sessions you start will show up here/);
  assert.match(html, /<div aria-hidden="true"><svg width="82.5" height="77" viewBox="0 0 150 140" fill="none"/);
  const d = html.match(/<path d="([^"]+)" fill="hsl\(var\(--pictogram-200\)\)"/)[1];
  assert.equal(d.length, 29168, 'length of the reference bO() string (checked equal once against sidebar-groups.js:7645-7686)');
  assert.ok(d.startsWith('M90 0h20v20h-20zM90 40h20v20h-20zM70 20h20v20h-20zM110 20h20v20h-20zM20 40h1v1h-1z'));
  // gO: seven 20x20 and four 10x20 rects, half the cells kept; _O: every other row and column.
  const cells = d.match(/h1v1h-1z/g).length;
  assert.equal(cells, (7 * 400 + 4 * 200) / 2 + (400 + 200 + 200) / 4);
  assert.doesNotMatch(html, /Start a session to see it here|Open a folder/);
  const direct = renderToStaticMarkup(React.createElement(SourceSidebarEmpty, { variant: 'filtered' }));
  assert.doesNotMatch(direct, /Show all sessions/, 'no button without a handler');
});

test('search keeps the local no-match line; loading shows the AO skeleton instead of an empty state', () => {
  const search = render({ search: 'zzz' });
  assert.match(search, /No matching sessions/); assert.doesNotMatch(search, /data-empty-variant/);
  const loading = render({ sessions: [], loading: true });
  assert.doesNotMatch(loading, /data-empty-variant/);
  assert.match(loading, /<div class="df-placeholder-rows source-sidebar-skeleton" data-testid="sidebar-rows-skeleton" role="status" aria-label="Loading sessions">/);
  const rows = [...loading.matchAll(/<div data-row="" class="source-sidebar-skeleton-row">(.*?)<\/div>/g)].map((match) => match[1]);
  assert.equal(rows.length, 3);
  rows.forEach((row, index) => {
    assert.match(row, /<span class="source-leading-slot"><span data-cds="Skeleton" class="smenu-skeleton source-skeleton-dot" style="width:6px;height:6px"><\/span><\/span>/);
    assert.ok(row.includes(`style="width:${['68%', '54%', '44%'][index]};height:var(--df-row-font, 13px)"`), row);
  });
  assert.doesNotMatch(loading, /source-sidebar-loading/);
  // AO rows carry Wn = TD (sidebar-rows.js:7177) pl-[calc(var(--df-row-px)+var(--df-row-indent,0px))].
  const css = readFileSync(path.resolve(import.meta.dirname, '../src/source-sidebar.css'), 'utf8');
  const rule = css.match(/\.source-sidebar-skeleton-row \{([^}]*)\}/)[1];
  assert.match(rule, /padding-right: var\(--df-row-px\);/);
  assert.match(rule, /padding-left: calc\(var\(--df-row-px\) \+ var\(--df-row-indent, 0px\)\);/);
});

// sidebar-rows.js qD / JD / $D, sidebar-main.js lI, sidebar-groups.js cI / Vz and
// the SR mode segments: CDS tooltips (portals, absent in SSR) or none, never a
// native title anywhere in the sidebar. JD also takes the More button out of the
// tab order and marks it data-row-action for eO's ArrowLeft/Right.
test('no native titles in the sidebar; the row More button is tabindex -1 with data-row-action', () => {
  const html = render({ current: 's1', onSessionAction() {}, onProject() {}, setShowSearch() {}, showSearch: true, onMenu() {},
    sessions: [thread('s1', { name: 'A long session name that would be truncated in the row' })] });
  assert.doesNotMatch(html, /\stitle="/, 'no element in the sidebar carries a title attribute');
  const tag = (pattern) => html.match(pattern)?.[0];
  for (const [name, pattern] of [['row main button', /<button[^>]*class="source-session-open"[^>]*>/], ['group toggle', /<button[^>]*class="source-group-toggle"[^>]*>/],
    ['Filter', /<button[^>]*aria-label="Filter"[^>]*>/], ['New session in', /<button[^>]*aria-label="New session in work"[^>]*>/],
    ['row More', /<button[^>]*class="source-session-more code-icon-button"[^>]*>/], ['mode radio', /<button role="radio"[^>]*aria-label="Code"[^>]*>/]]) {
    assert.ok(tag(pattern), name + ' renders');
    assert.doesNotMatch(tag(pattern), /title=/, name);
  }
  const more = tag(/<button[^>]*class="source-session-more code-icon-button"[^>]*>/);
  assert.match(more, /tabindex="-1"/); assert.match(more, /data-row-action=""/);
  assert.match(more, /aria-label="More options for A long session name that would be truncated in the row"/);
  assert.match(tag(/<button[^>]*class="source-session-open"[^>]*>/), /data-roving-item=""/);
  assert.match(render({ sidebarPreferences: { status: 'archived' }, onSessionAction() {} }), /aria-label="Filter \(active\)"/);
  // sidebar-groups.js:5352-5377 _w: the header search button is "Search" with the search_palette ⇧⌘K tooltip.
  const search = tag(/<button[^>]*aria-label="Search"[^>]*>/);
  assert.ok(search, 'Search button renders'); assert.doesNotMatch(search, /title=/);
  assert.equal(html.includes('aria-label="Search sessions" placeholder'), true, 'the inline field keeps its name');
  const source = readFileSync(path.resolve(import.meta.dirname, '../src/source-sidebar.jsx'), 'utf8');
  assert.match(source, /<ToolButton label="Search" icon="Search" active=\{showSearch\} tooltip=\{\{ content: "Search", shortcut: "cmd\+shift\+k", hoverable: false \}\}/);
});

test('eO scroller inset: 4px start/top inset with matching negative margins and pb-2', () => {
  const css = readFileSync(path.resolve(import.meta.dirname, '../src/source-sidebar.css'), 'utf8');
  const rule = css.match(/\.source-session-list \{([^}]*)\}/)[1];
  for (const decl of ['padding-top: 4px;', 'padding-left: 4px;', 'margin-top: -4px;', 'margin-left: -4px;', 'padding-bottom: 8px;', 'margin-right: -8px;']) assert.ok(rule.includes(decl), decl);
});

// sidebar-groups.js:12828-12842 / :7062-7073 mD: only New's df-leading-slot holds the
// df-new-circle around Icon Add "sm" (16) with the group colour utilities.
test('New leading slot holds the df-new-circle Add glyph; no other nav row has it', () => {
  const html = render({ current: null, section: 'new' });
  const rows = [...html.matchAll(/<button[^>]*class="source-sidebar-nav-row group"[^>]*>(?:(?!<\/button>).)*<\/button>/gs)].map((match) => match[0]);
  assert.deepEqual(rows.map((row) => row.match(/<span>([^<]+)<\/span>/)[1]), ['New', 'Artifacts', 'Routines', 'Customize']);
  assert.match(rows[0], /<span class="source-leading-slot df-leading-slot"><span class="df-new-circle flex shrink-0 items-center justify-center rounded-full"><span aria-hidden="true" data-cds="Icon" class="text-secondary group-hover:text-primary group-data-\[selected=focused\]:text-primary" style="font-size:16px;font-weight:533.3">[^<]+<\/span><\/span><\/span><span>New<\/span>/);
  for (const row of rows.slice(1)) {
    assert.doesNotMatch(row, /df-new-circle/);
    assert.match(row, /^<button[^>]*><span class="source-leading-slot"><span aria-hidden="true" data-cds="Icon" class="" style="font-size:16px/);
  }
  assert.equal(html.match(/df-new-circle/g).length, 1);
});

// sidebar-groups.js:5225-5310 pw inside sidebar-main.js:14187-14202 hL / :14970 df-bottom-tray.
test('account footer is the pw df-user-menu-btn: df-on-rail Spark, name, muted dot + suffix, xs caret', () => {
  const html = render({ displayName: 'Fixture Person', accountLabel: 'plus' });
  const tray = html.match(/<div class="df-bottom-tray shrink-0"><div class="df-footer-row account-footer shrink-0 flex items-center gap-\[var\(--df-footer-gap\)\]"><div class="min-w-0 flex-1">(<button[^>]*>)(.*?)<\/button><\/div><div class="df-footer-aux ml-auto flex shrink-0 items-center"><button[^>]*aria-label="Connection settings"/s);
  assert.ok(tray, 'tray > footer row > min-w-0 flex-1 button, then the aux holding the local Connection settings control');
  const [, open, body] = tray;
  assert.match(open, /class="df-user-menu-btn account-button cds-reset flex h-\[max\(28px,var\(--df-footer-btn-size\)\)\] max-w-full items-center gap-\[var\(--df-row-gap\)\] rounded-\[var\(--df-radius-pill\)\] pl-\[var\(--df-row-px\)\] pr-2 text-left outline-none hover:bg-\[var\(--df-hover\)\] focus-visible:shadow-focus"/);
  assert.match(open, /type="button"/); assert.match(open, /data-testid="user-menu-button"/); assert.match(open, /aria-label="Account menu"/); assert.match(open, /aria-haspopup="menu"/);
  assert.match(body, /^<span class="df-on-rail relative flex w-\[var\(--df-leading-slot\)\] shrink-0 items-center justify-center"><svg class="source-spark source-spark shrink-0" data-cds="Spark" data-spark-rendering="static"[^>]*width="16" height="16"/);
  assert.match(body, /<span class="flex min-w-0 gap-1 overflow-hidden text-\[length:var\(--df-row-font\)\] df-footer-suffix items-baseline"><span class="whitespace-nowrap text-secondary max-w-full shrink-0 truncate">Fixture Person<\/span><span aria-hidden="true" class="df-footer-suffix-text text-muted">·<\/span><span class="df-footer-suffix-text min-w-0 whitespace-nowrap text-muted">plus<\/span><\/span><span aria-hidden="true" data-cds="Icon" class="shrink-0 text-muted" style="font-size:12px;font-weight:[\d.]+">[^<]+<\/span>$/);
  assert.doesNotMatch(html, /<small|class="avatar"|class="account-name"/);
  const bare = render({ displayName: 'Fixture', accountLabel: '' });
  // R02: pw shows the whole IO identity (no first-word split), CSS-truncated.
  assert.match(bare, /<span class="whitespace-nowrap text-secondary max-w-full shrink-0 truncate">Fixture<\/span><\/span><span aria-hidden="true" data-cds="Icon" class="shrink-0 text-muted"/, 'no dot or suffix without a label');
});

// sidebar-session.js:13916/13924 and sidebar-groups.js:18641-18669 promise a
// permanent delete, which is true for Codex. The DeepSeek core's thread/delete
// only hides the session (Harness keeps ~/.dsh/sessions), so it says remove.
test('delete confirm copy: Codex keeps the source strings, DeepSeek says remove', () => {
  const one = [thread('s1', { name: 'Middle task' })], two = [thread('s1'), thread('s2')];
  assert.deepEqual(deleteConfirmCopy(one), { title: 'Delete session?', body: '“Middle task” will be permanently deleted. This can’t be undone.', confirmLabel: 'Delete', danger: true });
  assert.deepEqual(deleteConfirmCopy(one, { engine: 'codex' }), deleteConfirmCopy(one));
  assert.equal(deleteConfirmCopy(two).body, 'These 2 sessions will be permanently deleted. This can’t be undone.');
  for (const engine of ['deepseek', 'deepseek-harness']) {
    const single = deleteConfirmCopy(one, { engine }), plural = deleteConfirmCopy(two, { engine });
    for (const copy of [single, plural]) {
      assert.doesNotMatch(copy.body, /permanently|can’t be undone/);
      assert.equal(copy.danger, true);
    }
    assert.deepEqual(single, { title: 'Remove session?', body: '“Middle task” will be removed from Code Desktop. Its history stays in DeepSeek Harness (~/.dsh/sessions) and other DeepSeek apps.', confirmLabel: 'Remove', danger: true });
    assert.deepEqual(plural, { title: 'Remove 2 sessions?', body: 'These 2 sessions will be removed from Code Desktop. Their history stays in DeepSeek Harness (~/.dsh/sessions) and other DeepSeek apps.', confirmLabel: 'Remove', danger: true });
  }
  assert.deepEqual(olderConfirmCopy('delete', 3), { title: 'Delete older sessions?', body: 'This will permanently delete 3 sessions older than a week. Pinned sessions aren’t affected. This can’t be undone.', confirmLabel: 'Delete all', danger: true });
  assert.deepEqual(olderConfirmCopy('delete', 1, { engine: 'deepseek' }), { title: 'Remove older sessions?', body: 'This will remove 1 session older than a week from Code Desktop. Pinned sessions aren’t affected. Their history stays in DeepSeek Harness.', confirmLabel: 'Remove all', danger: true });
  assert.deepEqual(olderConfirmCopy('archive', 2, { engine: 'deepseek' }), olderConfirmCopy('archive', 2));
});

test('hidden sessions: only load failures get a notice; other-core sessions stay silent', () => {
  const html = render({ engine: 'deepseek', hiddenSessions: { otherEngine: 10, missing: 1 } });
  assert.match(html, /data-sidebar-notice="hidden-sessions">1 session could not be loaded\.<\/p>/);
  assert.doesNotMatch(html, /Codex session/);
  for (const props of [{}, { hiddenSessions: null }, { engine: 'deepseek', hiddenSessions: { otherEngine: 10, missing: 0 } }]) assert.doesNotMatch(render(props), /data-sidebar-notice/);
});

test('row menu Fork: the core reason disables it before the running/archived reasons', () => {
  const menu = (props) => renderToStaticMarkup(React.createElement(SourceSidebarSessionMenu, { session: thread('s1'), onAction() {}, onClose() {}, onRename() {}, onFork() {}, onDelete() {}, ...props }));
  const fork = (html) => html.match(/<div role="none" class="smenu-reason"><div role="menuitem"[^>]*data-label="Fork"[^>]*>.*?<span id="[^"]+" hidden="" data-cds-disabled-reason="">([^<]+)<\/span><\/div>/)?.[1];
  assert.equal(fork(menu({ forkUnavailable: 'Not available with the DeepSeek core yet' })), 'Not available with the DeepSeek core yet');
  assert.equal(fork(menu({ forkUnavailable: 'Not available with the DeepSeek core yet', session: thread('s1', { archived: true }) })), 'Not available with the DeepSeek core yet');
  assert.equal(fork(menu({ session: thread('s1', { archived: true }) })), 'Restore this session before forking it.');
  const enabled = menu({});
  assert.equal(fork(enabled), undefined);
  assert.match(enabled, /<div role="menuitem" tabindex="-1" aria-keyshortcuts="f" data-label="Fork" class="smenu-item">/);
});

// sidebar-main.js:14874-14892 pp + shared-frame-C_2npUJq.js:1196-1208 Li: the
// sidebar is its own CDS root (compact on desktop, data-platform, data-font).
test('the sidebar aside is a CDS root carrying data-density, data-platform and data-font', () => {
  const aside = (html) => html.match(/<aside[^>]*>/)[0];
  for (const [props, font] of [[{}, 'sans'], [{ cdsFont: 'system' }, 'system']]) {
    const tag = aside(render(props));
    assert.match(tag, /class="app-sidebar dframe-sidebar source-sidebar cds-root"/);
    assert.match(tag, /data-density="compact"/);
    assert.match(tag, /data-platform="desktop"/);
    assert.match(tag, new RegExp(`data-font="${font}"`));
  }
});

// shared-frame-C_2npUJq.js:2722 primary Button text-on-primary, :2748-2749
// bg-fill-primary (hover bg-fill-primary-hover). Fidelity F02: the group and
// confirm dialogs sit on the shared Dialog (source-dialog.jsx) with CDS Buttons
// (SourceSettingsButton) instead of hand-rolled sidebar dialog rules.
test('group and confirm dialogs use the shared Dialog with the CDS primary/danger Button', () => {
  const read = (file) => readFileSync(path.resolve(import.meta.dirname, '../src/' + file), 'utf8');
  const css = read('source-sidebar.css'), jsx = read('source-sidebar.jsx'), button = read('source-settings-button.css');
  const official = readFileSync(path.resolve(import.meta.dirname, '../public/assets/v1/c6a992d55-Vcbdv79k.css'), 'utf8');
  assert.doesNotMatch(css, /\.source-group-dialog(-backdrop)?\s*\{/);
  assert.doesNotMatch(css, /--cds-text-on-primary/);
  assert.match(jsx, /<SourceDialog open=\{open\} onExited=\{onExited\} size="sm" showClose=\{false\}/);
  assert.match(jsx, /<SourceSettingsButton type="submit" variant="primary" busy=\{pending\}/);
  assert.match(jsx, /<SourceConfirmationDialog [^>]*confirmVariant=\{danger \? "danger" : "primary"\}/s);
  assert.match(button, /\.source-settings-button\[data-variant=primary\] \{ color:var\(--cds-on-primary\);/);
  assert.match(button, /\.source-settings-button\[data-variant=primary\] \.ssb-paint \{ background:var\(--cds-fill-primary\); \}/);
  assert.match(button, /\.source-settings-button\[data-variant=primary\]:is\(:hover,\[aria-haspopup\]\[aria-expanded=true\]\) \.ssb-paint \{ background:var\(--cds-fill-primary-hover\); \}/);
  for (const token of ['--cds-on-primary', '--cds-fill-primary', '--cds-fill-primary-hover', '--cds-on-danger', '--cds-fill-danger']) assert.match(official, new RegExp(token + ':'));
});

// ---- Fidelity F08 ----
// sidebar-rows.js:8060-8270 aO/oO/mO/bO/CO/DO: every leading glyph is a labelled role=img/status span.
test('status glyphs: Idle is role=img, live states are role=status, Archived carries a 16px Archive icon', async () => {
  const idle = render({});
  assert.match(idle, /<span role="img" aria-label="Idle" class="source-status-glyph"><span class="source-session-dot"><\/span><\/span>/);
  const unread = render({ sessionMetadata: { s1: { unread: true } } });
  assert.match(unread, /<span role="status" aria-label="Unread response" class="source-status-glyph"><span class="status-dot" data-kind="ready"><\/span><\/span>/);
  assert.match(render({ state: { active: { s1: 'turn-1' } } }), /<span role="status" aria-label="Running" class="source-status-glyph"><span class="status-dot" data-kind="running"><\/span><\/span>/);
  const archived = render({ sessions: [thread('s1', { archived: true })], sidebarPreferences: { status: 'archived' } });
  assert.match(archived, /data-archived="true"/);
  assert.match(archived, /<span role="img" aria-label="Archived" class="source-status-glyph"><span aria-hidden="true" data-cds="Icon" class="source-status-archived" style="font-size:16px;/);
  // bO: the short turn-error headline; danger Warning for most categories.
  const failed = render({ state: { turnErrors: { s1: { t1: { message: 'boom', codexErrorInfo: 'internalServerError' } } }, items: { s1: [{ id: 'i1', turnId: 't1' }] } } });
  assert.match(failed, /<span role="status" aria-label="Server error" class="source-status-glyph"><span aria-hidden="true" data-cds="Icon" class="source-status-error" style="font-size:16px;[^"]*" data-tone="danger">/);
  const css = readFileSync(path.resolve(import.meta.dirname, '../src/source-sidebar.css'), 'utf8');
  assert.match(css, /\.source-session-row\[data-archived\] \{ color: var\(--cds-text-muted\); opacity: 0\.5; \}/);
  assert.doesNotMatch(css, /\[data-unread\] \.source-session-name/, 'no local unread title colour');
  assert.match(css, /\.source-status-glyph \{ display: flex; min-width: 14px; min-height: 14px;/);
});

test('rows carry the jump-hint attributes; the body is the peek card target', () => {
  const html = render({});
  assert.match(html, /data-source-session-id="s1"[^>]*data-row-key="s1" data-jump-hint-row=""/);
  assert.match(html, /<div class="dframe-sidebar-body" data-testid="sidebar" id="frame-peek-popover">/);
  const collapsed = render({ collapsed: true });
  assert.match(collapsed, /<div class="dframe-peek-bridge" aria-hidden="true"><\/div>/);
  assert.match(collapsed, /<div class="dframe-sidebar-body" data-testid="sidebar" id="frame-peek-popover" inert="">/);
  assert.match(render({ collapsed: true, peekOpen: true }), /<div class="dframe-sidebar-body" data-testid="sidebar" id="frame-peek-popover">/);
});

test('custom group headers: no DotsVertical trigger, the empty copy invites a drop, Other has no "+"', () => {
  const html = render({ sessions: [thread('s1')], customGroups: [{ id: 'g1', name: 'Research' }], sidebarPreferences: { groupBy: 'custom', showEmptyGroups: true },
    onSessionAction() {}, onGroupAction() {}, onProject() {} });
  assert.doesNotMatch(html, /More options for group/);
  assert.match(html, /<p class="source-empty-group">Drag or move sessions here<\/p>/);
  const other = render({ sessions: [thread('s1', { cwd: '/tmp/plain' })], repoIdentities: { '/tmp/plain': { isRepo: false } }, onProject() {}, onSessionAction() {} });
  assert.match(other, /data-group-key="project:__no_project__"><div class="source-group-heading" data-sidebar-group-label=""><button[^>]*><span>Other<\/span>/);
  assert.doesNotMatch(other, /New session in Other/);
  const source = readFileSync(path.resolve(import.meta.dirname, '../src/source-sidebar.jsx'), 'utf8');
  for (const copy of ['>Move up<', '>Move down<', '>Sort A to Z<', '>Rename group<', '>Delete group<', 'label="Rename group"', 'Create and group by custom', '"Create group"', 'The list will switch to Custom groups to show it.'])
    assert.ok(source.includes(copy), copy);
  assert.doesNotMatch(source, />Remove group</);
});

// R01: sidebar-groups.js:17392-17410 / :18560-18590 cI on custom headers with the Dz target (the folder the
// group's sessions share, else none), the 'Added to {group}' tooltip detail and the hover-reveal span.
test('custom group headers get the "+" labelled with the target and the group; Ungrouped and Other get none', () => {
  const html = render({ sessions: [thread('s1'), thread('s2')], sessionMetadata: { s1: { customGroupId: 'g1' } },
    customGroups: [{ id: 'g1', name: 'Research' }, { id: 'g2', name: 'Empty' }], sidebarPreferences: { groupBy: 'custom', showEmptyGroups: true },
    onSessionAction() {}, onGroupAction() {}, onProject() {} });
  assert.match(html, /<span class="source-group-reveal"><button type="button" class="code-icon-button" aria-label="New session in work, added to Research">/);
  assert.match(html, /aria-label="New session with no folder picked, added to Empty"/);
  assert.equal((html.match(/class="source-group-reveal"/g) || []).length, 2, 'one per custom group, none for Ungrouped');
  assert.doesNotMatch(html, /New session in Ungrouped|added to Ungrouped/);
  const plus = html.match(/aria-label="New session in work, added to Research">(.*?)<\/button>/s)[1];
  assert.match(plus, /data-cds="Icon"/);
  // Without a group handler (no Mz 'New session') there is no '+'.
  assert.doesNotMatch(render({ sessions: [thread('s1')], sessionMetadata: { s1: { customGroupId: 'g1' } }, customGroups: [{ id: 'g1', name: 'Research' }],
    sidebarPreferences: { groupBy: 'custom' }, onSessionAction() {} }), /added to Research/);
  const css = readFileSync(path.resolve(import.meta.dirname, '../src/source-sidebar.css'), 'utf8');
  assert.match(css, /\.source-group-reveal \{[^}]*opacity: 0;/);
  assert.match(css, /\.source-session-group:hover \.source-group-reveal,\s*\.source-session-group:focus-within \.source-group-reveal \{ opacity: 1; \}/);
  assert.match(css, /@media \(hover: none\) \{ \.source-group-reveal \{ opacity: 1; \} \}/);
});

test('inline rename keeps the row glyph and selected background; the field is labelled Rename', async () => {
  const { SourceSidebarRenameRow, deleteGroupCopy } = await server.ssrLoadModule('/src/source-sidebar.jsx');
  const html = renderToStaticMarkup(React.createElement(SourceSidebarRenameRow, { label: 'Session s1', selected: true,
    glyph: React.createElement('span', { className: 'glyph-probe' }), onCommit() {}, onClose() {} }));
  assert.match(html, /^<div class="source-session-row source-session-rename" data-row="" data-selected="focused"><span class="source-leading-slot"><span class="glyph-probe"><\/span><\/span><input type="text" maxLength="200" aria-label="Rename" class="hide-focus-ring source-session-rename-input" value="Session s1"\/><\/div>$/);
  const css = readFileSync(path.resolve(import.meta.dirname, '../src/source-sidebar.css'), 'utf8');
  assert.doesNotMatch(css, /\.source-session-rename \{ box-shadow/);
  assert.deepEqual(deleteGroupCopy('Research', 0), { title: 'Delete group?', body: '“Research” will be removed. Nothing is in it.', confirmLabel: 'Delete', danger: true });
  assert.equal(deleteGroupCopy('Research', 1).body, '“Research” will be removed. The 1 item in it will no longer be grouped.');
  assert.equal(deleteGroupCopy('Research', 3).body, '“Research” will be removed. The 3 items in it will no longer be grouped.');
});

test('row results are toasts, not inline status/error rows', () => {
  const source = readFileSync(path.resolve(import.meta.dirname, '../src/source-sidebar.jsx'), 'utf8');
  assert.doesNotMatch(source, /source-sidebar-status|source-sidebar-error|data-sidebar-status/);
  assert.match(source, /older \? "older session" : "session"/);
  assert.match(source, /key: older \? `\$\{action\}-older-bulk` : `group-bulk-\$\{action\}`, timeout: 3000/);
});
