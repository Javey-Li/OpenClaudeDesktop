import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { gitRepoMenuItems, COMMIT_CLEAN_REASON, COMMIT_RESPONDING_REASON } from '../src/git-rail-model.mjs';

// Git band/rail hints are CDS tooltips, never native titles (git-status-card
// 1270-1318 K, 1085-1119 Fe → shared-frame Pu 4869-4895; git-chips D/M; rail
// Zi `Y{lazy}` = Fu OverflowTooltip; c0b46114c y Dismiss tooltip:false). The
// repo menu groups follow cc70f2bdf Ko/qo 2270-2394. Node-only SSR, no window.
let server, SourceGitStatus, SourceGitRail;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  ({ SourceGitStatus } = await server.ssrLoadModule('/src/source-git-status.jsx'));
  ({ SourceGitRail } = await server.ssrLoadModule('/src/source-git-rail.jsx'));
});
after(async () => { await server?.close(); });

const dirty = { isRepo: true, cwd: '/work/space/repo', repoName: 'repo', branch: 'feature/a-rather-long-branch-name', hasChanges: true, workingTreeDirty: true, added: 3, removed: 1 };
const clean = { ...dirty, hasChanges: false, workingTreeDirty: false, added: 0, removed: 0 };
const noop = () => {};
const band = (props) => renderToStaticMarkup(React.createElement(SourceGitStatus, {
  prMode: 'commit', onOpenFolder: noop, onCopyPath: noop, onCopyBranch: noop, onOpenChanges: noop,
  onAction: noop, actionLabel: 'Commit', ...props }));
const rail = (props) => renderToStaticMarkup(React.createElement(SourceGitRail, { onOpenChanges: noop, onAction: noop, onDismiss: noop, ...props }));
const noTitles = (html, label) => assert.doesNotMatch(html, /\stitle="/, `${label}: no native title attribute`);
// Pu: wrapper span `aria-describedby=id` + hidden `[data-cds-disabled-reason]` span with that id.
function describedReason(html) {
  const wrapper = html.match(/<span class="source-tooltip-disabled-trigger[^"]*" tabindex="0" aria-describedby="([^"]+)">/);
  assert.ok(wrapper, 'disabled action sits in the focusable disabled-reason wrapper');
  const id = wrapper[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reason = html.match(new RegExp(`<span id="${id}" hidden="" data-cds-disabled-reason="">([^<]*)</span>`));
  assert.ok(reason, 'the described reason is a hidden span with the referenced id');
  return reason[1];
}

test('gitRepoMenuItems: Ko/qo groups — Show in Finder | separator | Copy path; absent rows drop their group', () => {
  // c856385e2 wn → c18ab0d94 b(): the shared reveal label is 'Show in Finder' on macOS.
  assert.deepEqual(gitRepoMenuItems(), [{ label: 'Show in Finder' }, { label: 'Copy path', separatorBefore: true }]);
  assert.deepEqual(gitRepoMenuItems({ openFolder: false }), [{ label: 'Copy path' }], 'the first non-empty group carries no separator');
  assert.deepEqual(gitRepoMenuItems({ copyPath: false }), [{ label: 'Show in Finder' }]);
  assert.deepEqual(gitRepoMenuItems({ openFolder: false, copyPath: false }), []);
});

test('band: dirty idle, dirty running and clean render no native titles; disabled Commit is described by its hidden reason', () => {
  const idle = band({ status: dirty });
  noTitles(idle, 'idle');
  // F12 (git-status-card 1081-1122, 1287-1305): counts and Commit are CDS secondary Buttons; the counts have no
  // aria-label (their name is the OV sr-only unit list), the tooltip stays 'View changes'.
  assert.match(idle, /<button type="button" data-cds="Button" data-variant="secondary" class="source-settings-button sg-diff">/);
  assert.match(idle, /<button type="button" data-cds="Button" data-variant="secondary" class="source-settings-button sg-action">.*<span class="ssb-content">Commit<\/span><\/button>/, 'enabled Commit is not wrapped and carries no reason');
  assert.doesNotMatch(idle, /sg-diff"? aria-label/);
  assert.doesNotMatch(idle, /data-cds-disabled-reason/);
  assert.match(idle, /class="sg-button sg-repo" data-repo-chip="unbounded" aria-label="repo"/);
  assert.doesNotMatch(idle, /aria-label="Dismiss"|sg-dismiss/, 'commit mode has no Dismiss and no reserved space');

  const running = band({ status: dirty, actionDisabled: true, actionDisabledReason: COMMIT_RESPONDING_REASON });
  noTitles(running, 'running');
  assert.equal(describedReason(running), 'Claude is working — wait for the turn to finish');
  assert.match(running, /<button disabled="" type="button" data-cds="Button" data-variant="secondary" class="source-settings-button sg-action">/);
  // After a commit the branch stats keep the band; Commit is disabled with 'No changes to commit'.
  const committed = band({ status: { ...dirty, workingTreeDirty: false }, actionDisabled: true, actionDisabledReason: COMMIT_CLEAN_REASON });
  assert.equal(describedReason(committed), 'No changes to commit');

  // A clean tree hides the band (Ii renders no row without changes).
  assert.equal(band({ status: clean, actionDisabled: true, actionDisabledReason: COMMIT_CLEAN_REASON }), '');
});

test('band: behind indicator keeps role=img/aria-label without a title (multiline K tooltip)', () => {
  const html = band({ status: dirty, showBehind: true, behind: { count: 2, tooltip: '2 commits behind main' } });
  noTitles(html, 'behind');
  assert.match(html, /<span role="img" aria-label="2 commits behind main" class="sg-behind">/);
});

test('band: repo chip is disabled only without any menu row; a busy but enabled action has no reason', () => {
  const html = band({ status: dirty, onOpenFolder: undefined, onCopyPath: undefined, busy: true });
  assert.match(html, /class="sg-button sg-repo" data-repo-chip="unbounded" aria-label="repo" disabled=""/);
  assert.doesNotMatch(html, /data-cds-disabled-reason/);
  assert.match(band({ status: dirty, onOpenFolder: undefined }), /class="sg-button sg-repo" data-repo-chip="unbounded" aria-label="repo" aria-haspopup="menu"/);
});

test('rail: no native titles (title, Dismiss, action); responding Commit is described and takes the Fe min-w-0 flex-1 wrapper', () => {
  const idle = rail({ status: dirty });
  noTitles(idle, 'rail idle');
  assert.match(idle, /<span class="sgr-title" data-cds="OverflowTooltip">repo · feature\/a-rather-long-branch-name<\/span>/);
  assert.match(idle, /<button type="button" class="sg-button sg-dismiss sgr-dismiss" aria-label="Dismiss">/);
  assert.doesNotMatch(idle, /data-cds-disabled-reason/);

  const running = rail({ status: dirty, responding: true });
  noTitles(running, 'rail running');
  assert.equal(describedReason(running), COMMIT_RESPONDING_REASON);
  assert.match(running, /<span class="source-tooltip-disabled-trigger sgr-action-wrap" tabindex="0"/);

  const hidden = rail({ status: clean });
  noTitles(hidden, 'rail clean');
  assert.equal(hidden, '<nav class="sgr-nav" aria-label="Repository and pull request controls" data-layout="rail"></nav>');
});

test('band counts: OV sr-only unit list and an aria-hidden +/− pair (shared-21 16959-17004)', () => {
  const html = band({ status: dirty });
  assert.match(html, /<span class="tabular-nums contents text-body-medium" data-git-counts=""><span class="sr-only">3 additions, 1 deletion<\/span><span aria-hidden="true" class="contents"><span class="sg-added">\+3<\/span><span class="sg-removed">−1<\/span><\/span><\/span>/);
  assert.match(band({ status: { ...dirty, added: 1, removed: 2 } }), /<span class="sr-only">1 addition, 2 deletions<\/span>/);
  assert.match(band({ status: dirty, onOpenChanges: undefined }), /<span class="sg-diff sg-diff-static"><span class="tabular-nums contents" data-git-counts="">/);
});

test('band: commit mode without onDismiss renders no .sg-dismiss and no .sg-dismiss-reserved; chips menus are start-aligned Popups', async () => {
  const html = band({ status: dirty });
  assert.doesNotMatch(html, /sg-dismiss/);
  // dismissReserved stays an explicit opt-in for forge rows (Ii 1365).
  assert.match(band({ status: dirty, dismissReserved: true }), /sg-dismiss-reserved/);
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/source-git-status.jsx'), 'utf8');
  assert.match(source, /<SourceMenu\.Popup anchor=\{menu\.anchor\} side="bottom" align="start" layer="menu" dataCds="Menu"/);
  assert.doesNotMatch(source, /SourceSidebarMenu|width=\{200\}/);
  // git-status-card.js:1116/:1301 `onMouseDown: Mn` on Commit and the counts: a pointer click keeps the composer's focus.
  assert.match(source, /className="sg-action"[^>]*\n?\s*onMouseDown=\{\(event\) => event\.preventDefault\(\)\} onClick=\{\(\) => onAction\(status\)\}/);
  assert.match(source, /className="sg-diff"\s*onMouseDown=\{\(event\) => event\.preventDefault\(\)\}/);
  const rail = await fs.readFile(path.resolve(import.meta.dirname, '../src/source-git-rail.jsx'), 'utf8');
  assert.match(rail, /className="sg-action sgr-action"[^>]*\n?\s*onMouseDown=\{\(event\) => event\.preventDefault\(\)\} onClick=\{\(\) => onAction\(status\)\}/);
});

test('band stale: the held snapshot is inert, aria-hidden, data-prbar-stale, without buttons, menus or tooltips', () => {
  const html = band({ status: dirty, stale: true, heightPx: 52 });
  assert.match(html, /<div class="sg-row sg-row-stale" data-source-component="GitStatusCard" data-prbar-stale="" aria-hidden="true" inert="">/);
  assert.doesNotMatch(html, /<button/);
  assert.doesNotMatch(html, /source-tooltip|aria-haspopup|data-git-counts/);
  assert.match(html, /<span class="sg-stale-fill sg-diff"><span class="sg-added">\+3<\/span><span class="sg-removed">−1<\/span><\/span><span class="sg-stale-fill sg-stale-action">Commit<\/span>/);
  assert.match(html, /style="min-height:52px"/);
  assert.equal(band({ status: clean, stale: true }), '', 'a clean snapshot holds nothing');
  assert.equal(band({ status: { isRepo: false }, stale: true }), '');
  const css = readFileSync(path.resolve(import.meta.dirname, '../src/source-git-status.css'), 'utf8');
  assert.match(css, /\.sg-row-stale \{ pointer-events: none; opacity: \.6; \}/);
});

test('rail: the Changes fact and collapsed signal use GitCounts; Commit is the secondary CDS Button', () => {
  const html = rail({ status: dirty });
  assert.match(html, /<span class="sr-only">3 additions, 1 deletion<\/span>/);
  assert.match(html, /<button type="button" data-cds="Button" data-variant="secondary" class="source-settings-button sg-action sgr-action">/);
  assert.doesNotMatch(html, /sg-spinner/);
});
