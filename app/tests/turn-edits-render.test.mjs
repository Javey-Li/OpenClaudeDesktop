// B16 D7: the turn edits card after 2.31226.0 cd5a31703 v2e/p0/m0/h0/h2e. Node-only SSR of the actual component.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

let server, SourceTurnEdits, SourceDiff;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  ({ SourceTurnEdits } = await server.ssrLoadModule('/src/source-turn-edits.jsx'));
  ({ SourceDiff } = await server.ssrLoadModule('/src/source-diff.jsx'));
});
after(async () => { await server?.close(); });

const file = (path, additions, deletions) => ({ path, additions, deletions });
const render = (props) => renderToStaticMarkup(React.createElement(SourceTurnEdits, { turnId: 't1', sessionKey: 's1', cwd: '/w', ...props }));
const text = (html) => html.replace(/<[^>]+>/g, '');

test('several files: one list, a header row (ChangesPlusMinus, label, totals with U+2212, chevron), three rows, Show N more', () => {
  const files = [file('/w/src/a/index.js', 2, 1), file('/w/src/b/index.js', 1, 0), file('/w/c.js', 0, 3), file('/w/d.js', 1, 1), file('/w/e.js', 4, 0)];
  const html = render({ edits: { files, additions: 8, deletions: 5 }, onUndo() {}, onView() {}, onViewFile() {} });
  assert.equal((html.match(/<ul role="list"/g) || []).length, 1, 'one U list');
  assert.equal((html.match(/class="ste-edits-row"/g) || []).length, 5, 'header + 3 files + Show more');
  assert.match(text(html), /Edited 5 files/);
  assert.match(html, /\+8<\/span><span class="ste-dels">−5</, 'header totals with the minus sign');
  assert.match(text(html), /Show 2 more/);
  assert.ok(!/View changes/.test(text(html)), 'no standalone View changes button outside embedded use');
  assert.match(text(html), /Undo/);
  // m0: file rows carry the transcript file path menu target; duplicate names get g2e folder hints.
  assert.match(html, /data-file-ref="\/w\/src\/a\/index\.js"/);
  assert.match(html, /index\.js<span class="ste-edits-hint"><span class="sr-only">, <\/span>a<\/span>/);
  assert.ok(!html.includes('data-file-ref="/w/d.js"'), 'the fourth file waits behind Show more');
  assert.equal((html.match(/aria-expanded="false"/g) || []).length, 1);
});

test('one file: its row is the card (no label), with Undo; without an opener it is a static row', () => {
  const html = render({ edits: { files: [file('/w/a.js', 3, 2)], additions: 3, deletions: 2 }, onUndo() {}, onView() {} });
  assert.ok(!/Edited/.test(text(html)));
  assert.match(html, /<button type="button" class="ste-edits-hit" data-file-ref="\/w\/a\.js"/);
  assert.match(text(html), /a\.jsUndo\+3−2/, 'f0: the action (Undo) comes before the counts');
  const plain = render({ edits: { files: [file('/w/a.js', 3, 2)], additions: 3, deletions: 2 } });
  assert.match(plain, /<span class="ste-edits-hit ste-edits-static" data-file-ref="\/w\/a\.js"/);
  assert.ok(!/Undo/.test(text(plain)));
});

test('Changed files rows: draggable with a drag target, not for a removed file', () => {
  const patch = 'diff --git a/src/app.js b/src/app.js\n--- a/src/app.js\n+++ b/src/app.js\n@@ -1 +1 @@\n-a\n+b\n'
    + 'diff --git a/old.txt b/old.txt\ndeleted file mode 100644\n--- a/old.txt\n+++ /dev/null\n@@ -1 +0,0 @@\n-x\n';
  const html = renderToStaticMarkup(React.createElement(SourceDiff, { value: patch, placement: 'changes',
    fileActions: { root: '/repo', onCopy() {}, onAttachFile() {}, onDragFiles() {} },
    fileList: { shown: true, width: 240, tree: false, groupByKind: false, onShownChange() {}, onWidthChange() {}, onCanFitChange() {} } }));
  const rows = html.match(/<button[^>]*data-diff-tree-row=""[^>]*>/g) || [];
  assert.equal(rows.length, 2, html.slice(0, 400));
  assert.equal(rows.filter((row) => row.includes('draggable="true"')).length, 1, 'only the existing file drags');
});
