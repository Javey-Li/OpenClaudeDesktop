import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { DEFAULT_DIFF_SCOPE, UNCOMMITTED_DIFF_SCOPE, diffScopeTrigger } from '../src/diff-scope-model.mjs';

// zm trigger (panes-tile-current.js:3060-3105): ghost TriggerButton `shrink min-w-0 text-secondary`,
// aria-label "Diff scope: {label}", the branch label grid with an xs ArrowRight (alt "to").
let server, SourceDiffScope, GitCounts, gitCountsLabel, SourceFilePanel;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  ({ SourceDiffScope } = await server.ssrLoadModule('/src/source-diff-scope.jsx'));
  ({ GitCounts, gitCountsLabel } = await server.ssrLoadModule('/src/source-git-counts.jsx'));
  ({ SourceFilePanel } = await server.ssrLoadModule('/src/source-session.jsx'));
});
after(async () => { await server?.close(); });

test('scope trigger: ghost CDS Button named "Diff scope: main → working tree" with the two-part label', () => {
  const html = renderToStaticMarkup(React.createElement(SourceDiffScope, { trigger: diffScopeTrigger(DEFAULT_DIFF_SCOPE, { base: 'main' }), sections: [] }));
  assert.match(html, /^<button aria-label="Diff scope: main → working tree" aria-haspopup="menu" aria-expanded="false" type="button" data-cds="Button" data-variant="ghost" class="source-settings-button sds-trigger">/);
  assert.match(html, /<span class="sds-label"><span class="sds-part">main<\/span><span aria-hidden="false" data-cds="Icon" class="sds-arrow"[^>]*role="img" aria-label="to"[^>]*>.<\/span><span class="sds-part">working tree<\/span><\/span>/);
  const uncommitted = renderToStaticMarkup(React.createElement(SourceDiffScope, { trigger: diffScopeTrigger(UNCOMMITTED_DIFF_SCOPE, { base: 'main' }) }));
  assert.match(uncommitted, /aria-label="Diff scope: Uncommitted changes"/);
  assert.match(uncommitted, /<span class="sds-part">Uncommitted changes<\/span>/);
  assert.equal(renderToStaticMarkup(React.createElement(SourceDiffScope, { trigger: null })), '');
  const css = readFileSync(path.resolve(import.meta.dirname, '../src/source-diff-scope.css'), 'utf8');
  assert.match(css, /\.sds-trigger\.source-settings-button\[data-cds=Button\] \{ flex-shrink: 1; min-width: 0; color: var\(--cds-text-secondary\); \}/);
  assert.match(css, /grid-template-columns: minmax\(0, max-content\) auto minmax\(0, max-content\)/);
});

test('GitCounts (shared-21 OV): sr-only unit list, aria-hidden +/− pair, first render at the target value', () => {
  assert.equal(gitCountsLabel(3, 1), '3 additions, 1 deletion');
  assert.equal(gitCountsLabel(1, 0), '1 addition, 0 deletions');
  assert.equal(gitCountsLabel(1200, 2), '1,200 additions, 2 deletions');
  const html = renderToStaticMarkup(React.createElement(GitCounts, { added: 12, removed: 0, className: 'sgr-counts' }));
  assert.equal(html, '<span class="tabular-nums sgr-counts" data-git-counts=""><span class="sr-only">12 additions, 0 deletions</span><span aria-hidden="true" class="contents"><span class="sg-added">+12</span><span class="sg-removed">−0</span></span></span>');
  // DV: 400ms, 1-(1-t)^3, skipped under reduced motion (the OS query or data-reduce-motion via useReducedMotion).
  const source = readFileSync(path.resolve(import.meta.dirname, '../src/source-git-counts.jsx'), 'utf8');
  assert.match(source, /COUNT_TWEEN_MS = 400/);
  assert.match(source, /1 - \(1 - t\) \*\* 3/);
  assert.match(source, /useReducedMotion\(\)/);
});

test('Changes pane header: the scope trigger replaces the title; without it (no base) the plain title stays', () => {
  const control = React.createElement(SourceDiffScope, { trigger: diffScopeTrigger(DEFAULT_DIFF_SCOPE, { base: 'main' }) });
  const panel = (props) => renderToStaticMarkup(React.createElement(SourceFilePanel, { sessionId: 's', cwd: '/tmp/work', tab: 'changes', diff: '', ...props }));
  const withScope = panel({ diffScope: 'branch', diffScopeControl: control });
  const header = withScope.slice(0, withScope.indexOf('</header>'));
  assert.match(header, /aria-label="Diff scope: main → working tree"/);
  assert.doesNotMatch(header, /title="Uncommitted changes"|>Uncommitted changes</);
  // The default branch scope's empty state is "No changes to show" (panes-tile-current.js:3547 uncommittedOnly).
  assert.match(withScope, /No changes to show/);
  const fallback = panel({ diffScope: 'uncommitted' });
  assert.match(fallback.slice(0, fallback.indexOf('</header>')), /Uncommitted changes/);
  assert.match(fallback, /No uncommitted changes/);
  // Other tabs never show the scope control.
  assert.doesNotMatch(panel({ tab: 'plan', diffScopeControl: control }), /Diff scope:/);
});
