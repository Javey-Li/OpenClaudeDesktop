// Fast typing must not build a chain of queued no-op updates in the composer. Each keystroke's commit flushed the
// [draft] effects synchronously; resetting composerNotice / commandIndex / dismissed (and the rAF mention / emoji
// lookups) to the value they already held still queued a default-lane update because the composer always had work
// pending, so every commit left one behind. React 19 counts that as a nested update and threw "Maximum update depth
// exceeded" (#185) after ~50 keystrokes (composer-states-ui-test fast typing). The resets now skip values in place.
// Also: the suggested-tasks strip and the transcript under it are siblings and need distinct keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const composer = fs.readFileSync(path.join(root, 'src/source-composer.jsx'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src/main.jsx'), 'utf8');

test('per-keystroke resets in the composer skip a value that is already in place', () => {
  assert.match(composer, /useEffect\(\(\) => \{ if \(composerNotice !== null\) setComposerNotice\(null\); \}, \[draft\]\);/);
  assert.match(composer, /useEffect\(\(\)=>\{if\(commandIndex!==0\)setCommandIndex\(0\);if\(dismissed&&!draft\.startsWith\('\/'\)\)setDismissed\(false\);\},\[draft\]\);/);
  assert.doesNotMatch(composer, /\{ setMention\(null\); return; \}/, 'updateMention clears only an open lookup');
  assert.doesNotMatch(composer, /\{ setEmoji\(null\); return; \}/, 'updateEmoji clears only an open lookup');
  assert.match(composer, /if \(mentionDismissed !== null\) setMentionDismissed\(null\); requestAnimationFrame/);
});

test('the suggested tasks and the transcript of a session have different keys', () => {
  assert.match(main, /<SourceSuggestedTasks key=\{`suggested:\$\{current\}`\}/);
  assert.match(main, /<SourceTranscript\s+key=\{current \?\? "draft"\}/);
});
