import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// B37: SSR of shared-19 EK (checking footnote) and DK (changed-file list) with their source class strings.
let server, M;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  M = await server.ssrLoadModule('/src/source-worktree-dispose-dialog.jsx');
});
after(() => server?.close());

test('EK reserves its line invisibly, then reveals with aria-busy while the check runs', () => {
  assert.equal(renderToStaticMarkup(React.createElement(M.WorktreeChecking, { hold: 'reserve' })),
    '<p class="mt-md text-footnote text-muted invisible">Checking for uncommitted changes…</p>');
  assert.equal(renderToStaticMarkup(React.createElement(M.WorktreeChecking, { hold: 'reveal' })),
    '<p class="mt-md text-footnote text-muted animate-placeholder-reveal" aria-busy="true">Checking for uncommitted changes…</p>');
});

test('DK lists the first ten porcelain lines in a pre and counts the rest', () => {
  const lines = Array.from({ length: 12 }, (_, index) => ` M src/f${index}.js`);
  const html = renderToStaticMarkup(React.createElement(M.WorktreeChangeList, { changes: lines }));
  assert.match(html, /^<pre class="mt-md max-h-40 overflow-auto whitespace-pre-wrap rounded bg-alpha-1 p-sm text-code text-secondary" data-worktree-changes="">/);
  assert.ok(html.includes(lines.slice(0, 10).join('\n')));
  assert.ok(!html.includes('f10.js'));
  assert.match(html, /\n… and 2 more<\/pre>$/);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(M.WorktreeChangeList, { changes: lines.slice(0, 3) })), /more/);
});
