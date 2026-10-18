import test from 'node:test';
import assert from 'node:assert/strict';
import { diffChangeCommand, diffChangeHeaderOffset, diffChangeShortcuts, diffChangeTargets, pickDiffChange, sameDiffChange } from '../src/diff-change-nav-model.mjs';
import { parseUnifiedDiff } from '../src/diff-model.js';

const PATCH = `diff --git a/a.txt b/a.txt
--- a/a.txt
+++ b/a.txt
@@ -1,6 +1,6 @@
 one
-two
+TWO
 three
 four
-five
 six
+seven
diff --git a/b.txt b/b.txt
new file mode 100644
--- /dev/null
+++ b/b.txt
@@ -0,0 +1,2 @@
+x
+y
`;
const files = parseUnifiedDiff(PATCH).sections.filter((section) => section.type === 'file');
const targets = files.flatMap((file) => diffChangeTargets(file.path, file.hunks));
const order = files.map((file) => file.path);

test('Qr: one target per change block, additions side when the block adds lines, the new file starting after line 0', () => {
  assert.deepEqual(targets, [
    { id: 'a.txt', side: 'additions', lineNumber: 2, oldLine: 2, newLine: 2, removes: true },
    { id: 'a.txt', side: 'deletions', lineNumber: 5, oldLine: 5, newLine: 5, removes: true },
    { id: 'a.txt', side: 'additions', lineNumber: 6, oldLine: 7, newLine: 6, removes: false },
    { id: 'b.txt', side: 'additions', lineNumber: 1, oldLine: 1, newLine: 1, removes: false },
  ]);
});

test('ei: steps from the last change while visible, else from the topmost visible line; none past either end', () => {
  assert.equal(pickDiffChange(targets, order, {}, 1), targets[0], 'no viewport: the first change');
  assert.equal(pickDiffChange(targets, order, {}, -1), null);
  assert.equal(pickDiffChange(targets, order, { last: targets[1] }, 1), targets[2]);
  assert.equal(pickDiffChange(targets, order, { last: targets[1] }, -1), targets[0]);
  assert.equal(pickDiffChange(targets, order, { last: targets[3] }, 1), null);
  // Viewport at a.txt new line 3: next is the deletion block (old 5 > 3? compared on the viewport's side: newLine 5 > 3).
  const viewport = { id: 'a.txt', side: 'additions', lineNumber: 3 };
  assert.equal(pickDiffChange(targets, order, { viewport }, 1), targets[1]);
  assert.equal(pickDiffChange(targets, order, { viewport }, -1), targets[0]);
  // A viewport on the line a change starts at skips that change going back.
  assert.equal(pickDiffChange(targets, order, { viewport: { id: 'a.txt', side: 'additions', lineNumber: 2 } }, -1), null);
  assert.equal(pickDiffChange(targets, order, { viewport: { id: 'a.txt', side: 'deletions', lineNumber: 5 } }, -1), targets[0]);
  // The top of the second file (line 0): next is its first change, previous the last change of the file above.
  assert.equal(pickDiffChange(targets, order, { viewport: { id: 'b.txt', side: 'additions', lineNumber: 0 } }, 1), targets[3]);
  assert.equal(pickDiffChange(targets, order, { viewport: { id: 'b.txt', side: 'additions', lineNumber: 0 } }, -1), targets[2]);
  assert.equal(pickDiffChange([], order, {}, 1), null);
  assert.equal(sameDiffChange(targets[0], { ...targets[0] }), true);
});

test('m6 bindings: F7 / ⇧F7 everywhere, ⌥F5 / ⇧⌥F5 off Linux; other modifiers and IME input never match', () => {
  assert.deepEqual(diffChangeShortcuts(), { next: ['alt+f5', 'f7'], prev: ['shift+alt+f5', 'shift+f7'] });
  assert.deepEqual(diffChangeShortcuts({ linux: true }), { next: ['f7'], prev: ['shift+f7'] });
  assert.equal(diffChangeCommand({ code: 'F7', key: 'F7' }), 'next');
  assert.equal(diffChangeCommand({ code: 'F7', key: 'F7', shiftKey: true }), 'prev');
  assert.equal(diffChangeCommand({ code: 'F5', key: 'F5', altKey: true }), 'next');
  assert.equal(diffChangeCommand({ code: 'F5', key: 'F5', altKey: true, shiftKey: true }), 'prev');
  assert.equal(diffChangeCommand({ code: 'F5', key: 'F5', altKey: true }, { linux: true }), null);
  assert.equal(diffChangeCommand({ code: 'F5', key: 'F5' }), null, 'plain F5 is not a change key');
  assert.equal(diffChangeCommand({ code: 'F7', key: 'F7', metaKey: true }), null);
  assert.equal(diffChangeCommand({ code: 'F7', key: 'F7', altKey: true }), null);
  assert.equal(diffChangeCommand({ code: 'F7', key: 'F7', isComposing: true }), null);
  assert.equal(diffChangeCommand({ code: 'F7', key: 'Process', keyCode: 229 }), null);
});

test('Wo: the sticky header offset is 2rem', () => {
  assert.equal(diffChangeHeaderOffset(16), 32);
  assert.equal(diffChangeHeaderOffset(20), 40);
  assert.equal(diffChangeHeaderOffset(NaN), 32);
});
