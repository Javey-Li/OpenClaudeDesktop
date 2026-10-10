import test from 'node:test';
import assert from 'node:assert/strict';
import { serializePlanComments, planFeedbackWithComments, serializeLineComment, planCommentsStore } from '../src/inline-comments.mjs';

test('plan comments serialize as the official "On selected text" blocks, before the typed feedback', () => {
  const comments = [{ quote: 'Step 2: drop the table\nand recreate it', text: 'Use a migration instead.' }, { quote: 'tests', text: '  ' }];
  assert.equal(serializePlanComments(comments), 'On selected text:\n> Step 2: drop the table\n> and recreate it\nUse a migration instead.');
  assert.equal(planFeedbackWithComments(' Also keep the old API. ', comments), 'On selected text:\n> Step 2: drop the table\n> and recreate it\nUse a migration instead.\n\nAlso keep the old API.');
  assert.equal(planFeedbackWithComments('only this', []), 'only this');
});

test('a changed-line comment names the file and lines, quotes the code', () => {
  assert.equal(serializeLineComment({ path: 'src/a.js', start: 12, code: 'const x = 1;', text: 'Use let.' }), 'In src/a.js, line 12:\n> const x = 1;\nUse let.');
  assert.equal(serializeLineComment({ path: 'b.py', start: 3, end: 5, code: 'a\nb', text: 'x' }), 'In b.py, lines 3–5:\n> a\n> b\nx');
});

test('the plan comment store is per session: add, edit, remove, clear', () => {
  const seen = [];
  const off = planCommentsStore.subscribe(() => seen.push(planCommentsStore.version()));
  planCommentsStore.add('s1', { quote: 'q', text: 'first' });
  planCommentsStore.add('s1', { quote: 'q2', text: '  ' });
  const [entry] = planCommentsStore.get('s1');
  assert.equal(planCommentsStore.get('s1').length, 1);
  planCommentsStore.edit('s1', entry.id, 'changed');
  assert.equal(planCommentsStore.get('s1')[0].text, 'changed');
  assert.deepEqual(planCommentsStore.get('s2'), []);
  planCommentsStore.remove('s1', entry.id);
  assert.deepEqual(planCommentsStore.get('s1'), []);
  planCommentsStore.add('s1', { quote: 'q', text: 'again' });
  planCommentsStore.clear('s1');
  assert.deepEqual(planCommentsStore.get('s1'), []);
  off();
  assert.ok(seen.length >= 5);
});
