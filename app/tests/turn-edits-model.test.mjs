import test from 'node:test';
import assert from 'node:assert/strict';
import { turnEdits, undoTurnText, turnEditsLabel } from '../src/turn-edits-model.mjs';

const change = (path, diff, kind = 'update') => ({ path, kind: { type: kind }, diff });
test('turn edits card: files and counts per finished turn, Undo text as the source writes it', () => {
  const items = [
    { id: 'u1', type: 'userMessage', turnId: 't1' },
    { id: 'f1', type: 'fileChange', turnId: 't1', status: 'completed', changes: [change('/w/a.js', '@@ -1,2 +1,2 @@\n-old\n+new\n same\n')] },
    { id: 'f2', type: 'fileChange', turnId: 't1', status: 'completed', changes: [change('/w/b.txt', 'one\ntwo\n', 'add')] },
    { id: 'f3', type: 'fileChange', turnId: 't1', status: 'declined', changes: [change('/w/c.js', '@@ -1 +1 @@\n-x\n+y\n')] },
    { id: 'f4', type: 'fileChange', turnId: 't2', status: 'completed', changes: [change('/w/a.js', '@@ -1 +1 @@\n-a\n+b\n')] },
  ];
  const edits = turnEdits(items, { activeTurnId: 't2' });
  assert.deepEqual([...edits.keys()], ['t1'], 'a running turn has no card yet');
  assert.deepEqual(edits.get('t1'), { files: [{ path: '/w/a.js', additions: 1, deletions: 1 }, { path: '/w/b.txt', additions: 2, deletions: 0 }], additions: 3, deletions: 1 });
  assert.equal(turnEditsLabel(edits.get('t1')), 'Edited 2 files');
  assert.equal(turnEditsLabel({ files: [{ path: '/w/a.js' }] }), 'Edited a.js');
  assert.equal(undoTurnText([{ path: '/w/a.js' }]), 'Undo the changes you made to `/w/a.js` in your last turn and restore it to its previous state.');
  assert.equal(undoTurnText([{ path: 'a' }, { path: 'b' }]), 'Undo the changes you made to these 2 files in your last turn and restore them to their previous state:\n- `a`\n- `b`');
});

// 2.31226.0 cd5a31703 h0 (:71733-71757) and n0/c2e/g2e (:71442-71488, :71717-71732).
import { TURN_EDITS_LIST_LIMIT, turnEditsListView, turnEditFolderHints, disambiguateLabels } from '../src/turn-edits-model.mjs';
test('turn edits list: three rows before Show {count} more; expanded shows all', () => {
  const files = ['a', 'b', 'c', 'd', 'e'].map((name) => ({ path: `/w/${name}.js` }));
  assert.equal(TURN_EDITS_LIST_LIMIT, 3);
  assert.deepEqual(turnEditsListView(files, false), { shown: files.slice(0, 3), hidden: 2 });
  assert.deepEqual(turnEditsListView(files, true), { shown: files, hidden: 2 });
  assert.deepEqual(turnEditsListView(files.slice(0, 3), false), { shown: files.slice(0, 3), hidden: 0 });
});
test('turn edits folder hints: only repeated names, the shortest unique folder suffix (g2e over full folders)', () => {
  const hints = turnEditFolderHints([{ path: '/w/src/a/index.js' }, { path: '/w/src/b/index.js' }, { path: '/w/x.js' }]);
  assert.deepEqual([...hints], [['/w/src/a/index.js', 'a'], ['/w/src/b/index.js', 'b']]);
  assert.deepEqual([...turnEditFolderHints([{ path: '/w/a/lib/util.ts' }, { path: '/w/b/lib/util.ts' }])], [['/w/a/lib/util.ts', 'a/lib'], ['/w/b/lib/util.ts', 'b/lib']]);
  // A file at the session root is named by its folder too (RO(path, undefined) keeps the full folder); one level
  // under the filesystem root becomes the whole folder ('/w', not 'w').
  assert.deepEqual([...turnEditFolderHints([{ path: '/w/index.js' }, { path: '/w/b/index.js' }])], [['/w/index.js', '/w'], ['/w/b/index.js', 'b']]);
  assert.deepEqual([...turnEditFolderHints([{ path: '/p/w/index.js' }, { path: '/p/w/b/index.js' }])], [['/p/w/index.js', 'w'], ['/p/w/b/index.js', 'b']]);
  assert.deepEqual([...turnEditFolderHints([{ path: '/a/index.js' }, { path: '/b/index.js' }])], [['/a/index.js', '/a'], ['/b/index.js', '/b']]);
  assert.deepEqual([...turnEditFolderHints([{ path: 'C:\\r\\a\\x.js' }, { path: 'C:\\r\\b\\x.js' }])].map(([, hint]) => hint), ['a', 'b'], 'Windows separators');
  assert.equal(turnEditFolderHints([{ path: '/w/a.js' }, { path: '/w/b.js' }]).size, 0, 'unique names get no hint');
  assert.deepEqual(disambiguateLabels([{ label: 'x', detail: 'p' }, { label: 'x', detail: 'p' }]), [{ label: 'x', detail: 'p' }, { label: 'x', detail: 'p' }], 'identical folders get no description');
});
