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
