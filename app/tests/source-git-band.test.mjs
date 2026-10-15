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
  onAction: noop, actionLabel: 'Commit changes', ...props }));
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
  // The composer's folder menu also opens a terminal there (its last group).
  assert.deepEqual(gitRepoMenuItems({ openTerminal: true }).at(-1), { label: 'Open in terminal', separatorBefore: true });
});

test('band: dirty idle, dirty running and clean render no native titles; disabled Commit is described by its hidden reason', () => {
  const idle = band({ status: dirty });
  noTitles(idle, 'idle');
  // F12 (git-status-card 1081-1122, 1287-1305): counts and Commit are CDS secondary Buttons; the counts have no
  // aria-label (their name is the OV sr-only unit list), the tooltip stays 'View changes'.
  assert.match(idle, /<button type="button" data-cds="Button" data-variant="secondary" class="source-settings-button sg-diff">/);
  assert.match(idle, /<button type="button" data-cds="Button" data-variant="secondary" class="source-settings-button sg-action">.*<span class="ssb-content">Commit changes<\/span><\/button>/, 'enabled Commit is not wrapped and carries no reason');
  assert.doesNotMatch(idle, /sg-diff"? aria-label/);
  assert.doesNotMatch(idle, /data-cds-disabled-reason/);
  assert.match(idle, /class="sg-button sg-repo" data-repo-chip="unbounded" aria-label="repo"/);
  assert.doesNotMatch(idle, /aria-label="Dismiss"|sg-dismiss/, 'commit mode has no Dismiss and no reserved space');

  const running = band({ status: dirty, actionDisabled: true, actionDisabledReason: COMMIT_RESPONDING_REASON });
  noTitles(running, 'running');
  assert.equal(describedReason(running), 'DeepSeek is working — wait for the turn to finish');
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
  assert.match(html, /<span class="sg-stale-fill sg-diff"><span class="sg-added">\+3<\/span><span class="sg-removed">−1<\/span><\/span><span class="sg-stale-fill sg-stale-action">Commit changes<\/span>/);
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

test('B08 band: an existing PR leads with its state glyph and #number link (FB), CI is a static role=img, no Create PR', () => {
  const prView = { number: 42, url: 'https://github.com/acme/widget/pull/42', state: 'open', ci: 'failed', onOpen: noop };
  const html = band({ status: { ...dirty, workingTreeDirty: false }, prMode: 'view', prView, onAction: undefined });
  noTitles(html, 'pr view');
  assert.match(html, /<span role="img" aria-label="Open" class="sg-pr-state" data-tint="opened"><span aria-hidden="true" data-cds="Icon"/);
  assert.match(html, /<a href="https:\/\/github.com\/acme\/widget\/pull\/42" target="_blank" rel="noopener" class="sg-pr-number" data-tint="opened"><bdi>#42<\/bdi><\/a>/);
  assert.match(html, /<span aria-hidden="true" class="sg-pr-gap"><\/span>/, 'the 12px gap precedes the chips');
  assert.match(html, /data-repo-chip="bounded"/, 'view mode bounds the repo chip at 160px');
  assert.match(html, /<span role="img" aria-label="CI: checks failing" class="sg-ci" data-ci="failed">.*<span>CI<\/span><\/span>/);
  assert.doesNotMatch(html, /sg-action|data-pr-action/, 'cd5a31703 Te is null in view mode');
  // pze: the PR keeps the row without any branch changes.
  assert.match(band({ status: clean, prMode: 'view', prView: { ...prView, ci: undefined }, onAction: undefined }), /sg-pr-number/);
  assert.doesNotMatch(band({ status: clean, prMode: 'view', prView: { ...prView, ci: undefined }, onAction: undefined }), /sg-ci/);
});

test('B08 band: a merged PR tints the row (xLe purple) and replaces the trailing controls with "Merged"', () => {
  const prView = { number: 7, url: 'https://github.com/acme/widget/pull/7', state: 'merged', ci: 'passed', onOpen: noop };
  const html = band({ status: dirty, prMode: 'merged', prView });
  assert.match(html, /<div class="sg-row" data-source-component="GitStatusCard" data-pr-accent="purple">/);
  assert.match(html, /<span role="img" aria-label="Merged" class="sg-pr-state" data-tint="merged">/);
  assert.match(html, /class="sg-pr-number" data-tint="merged" data-accent="">/);
  assert.match(html, /<span class="sg-pr-mode-label" data-accent="purple">Merged<\/span>/);
  assert.doesNotMatch(html, /sg-diff|sg-ci|sg-action/, 'counts, CI and actions drop on an accent row');
});

test('B08 band: Create PR split button reads the remembered mode, busy carries the sr-only Creating PR… status', () => {
  const pr = { mode: 'draft', label: 'Create draft PR', busyLabel: 'Creating PR…', busy: false, manualUrl: null, onPrimary: noop, onSelectMode: noop };
  const html = band({ status: { ...dirty, workingTreeDirty: false }, prMode: 'draft', pr });
  assert.match(html, /<span class="sg-pr" data-pr-action="" data-cds="SplitDropdownButton" aria-label="Create draft PR">/);
  assert.match(html, /class="source-settings-button sg-action sg-pr-main">.*<span class="ssb-content">Create draft PR<\/span>/);
  assert.match(html, /aria-label="More PR options"/);
  assert.match(html, /<span role="status" class="sr-only"><\/span>/);
  const busy = band({ status: { ...dirty, workingTreeDirty: false }, prMode: 'draft', pr: { ...pr, busy: true } });
  assert.match(busy, /<span role="status" class="sr-only">Creating PR…<\/span>/);
  const pending = band({ status: { ...dirty, workingTreeDirty: false }, prMode: 'create', pr: { ...pr, mode: 'create', label: 'Create PR', disabledReason: 'Checking for an existing pull request' } });
  assert.equal(describedReason(pending), 'Checking for an existing pull request');
  assert.match(pending, /<button aria-label="More PR options" disabled="" aria-haspopup="menu"[^>]*class="source-settings-button sg-pr-more"/, 'jO disables the caret with the primary');
});

test('B08 band: the gh hint trigger (c219730b0 fn) and the split menu source (radio items, side top / align end)', async () => {
  const pr = { mode: 'create', label: 'Create PR', busy: false, manualUrl: null, onPrimary: noop, onSelectMode: noop };
  const html = band({ status: { ...dirty, workingTreeDirty: false }, prMode: 'create', pr, prHint: { cause: 'gh_signed_out', onRunInTerminal: noop } });
  assert.match(html, /<button aria-haspopup="dialog" aria-expanded="false"[^>]*class="source-settings-button sg-gh-hint">.*GitHub CLI signed out/);
  assert.match(band({ status: { ...dirty, workingTreeDirty: false }, prMode: 'create', pr, prHint: { cause: 'gh_unavailable' } }), /GitHub CLI unavailable/);
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/source-git-status.jsx'), 'utf8');
  assert.match(source, /menu\?\.kind === "pr" && pr && <SourceMenu\.Popup anchor=\{menu\.anchor\} side="top" align="end"/);
  assert.match(source, /checked=\{pr\.mode === mode\} checkedRole="radio" onClick=\{\(\) => run\(pr\.onSelectMode, mode\)\}/);
  // c0a531389 T: Copy branch name, Open branch on GitHub; xt: Open in terminal after a separator. Hle: the repo menu ends with it.
  assert.match(source, /t\("Open branch on GitHub"\)/);
  assert.match(source, /key: "terminal", label: t\("Open in terminal"\), separatorBefore: true/);
  assert.match(source, /gitRepoMenuItems\(\{ openFolder: !!onOpenFolder, copyPath: !!onCopyPath, openTerminal: !!onOpenTerminal \}\)/);
});

test('B08 review: the gh lookup warning (cd5a31703 FB H) shows in every mode; a PR title is the branch chip tooltip', async () => {
  const { prStatusWarning } = await import('../src/git-rail-model.mjs');
  assert.equal(prStatusWarning({ status: 'error', kind: 'network' }), 'GitHub is unreachable. Pull request status may be out of date.');
  assert.equal(prStatusWarning({ status: 'auth', kind: 'auth' }), 'GitHub CLI authentication expired. Run gh auth login to refresh pull request status.');
  assert.equal(prStatusWarning({ status: 'error' }), 'Pull request status couldn’t be checked and may be out of date.');
  assert.equal(prStatusWarning({ status: 'error', kind: 'notFound' }), undefined, 'gO keeps no warning for notFound');
  assert.equal(prStatusWarning({ status: 'missing' }), undefined);
  assert.equal(prStatusWarning({ status: 'none' }), undefined);
  const warning = 'GitHub is unreachable. Pull request status may be out of date.';
  const prView = { number: 7, url: 'https://github.com/acme/widget/pull/7', state: 'merged', ci: 'passed', title: 'Add widget', onOpen: noop };
  const html = band({ status: dirty, prMode: 'merged', prView, prWarning: warning });
  noTitles(html, 'warning');
  assert.match(html, new RegExp(`<span role="img" aria-label="${warning}" class="sg-pr-warning">`), 'the accent row keeps the warning');
  assert.doesNotMatch(band({ status: dirty }), /sg-pr-warning/);
});
