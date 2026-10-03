import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGitRailModel, railSignal, behindIndicator, visibleBaseBranch, railReservation, isLocalOnly, commitAction, COMMIT_TURN_TEXT, COMMIT_CLEAN_REASON, COMMIT_RESPONDING_REASON } from '../src/git-rail-model.mjs';

// F12: the row follows hasChanges (merge-base stats), Commit follows workingTreeDirty (Qe isWorkingTreeDirty).
const dirty = { isRepo: true, cwd: '/tmp/repo', repoName: 'repo', branch: 'feature', hasChanges: true, workingTreeDirty: true, added: 2, removed: 1 };
const comparison = { base: 'main', baseSource: 'default', ahead: 2, behind: 1, same: false, mergeBase: 'abc' };

test('commit mode (every local session) hides Base branch and keeps only the Changes fact', () => {
  const model = buildGitRailModel({ status: dirty, comparison });
  assert.equal(model.visible, true);
  assert.equal(model.title, 'repo · feature');
  assert.equal(model.glyphLabel, 'Branch');
  assert.deepEqual(model.facts.map((fact) => fact.key), ['changes']);
  assert.equal(model.baseBranch, undefined);
  assert.deepEqual(model.gates, []); assert.deepEqual(model.automation, []);
  assert.deepEqual(model.facts[0], { key: 'changes', label: 'Changes', added: 2, removed: 1, action: 'View changes', hint: 'View changes', hintDetail: 'Lines added and removed on this branch.' });
  assert.deepEqual(model.signal, { kind: 'changes', added: 2, removed: 1 });
  assert.deepEqual(model.action, { label: 'Commit', text: COMMIT_TURN_TEXT, disabled: false, disabledReason: undefined }, 'enabled action carries no reason (Hi/Fe reason only while disabled)');
  assert.equal(COMMIT_TURN_TEXT, 'Commit the working tree changes with a sensible message.');
  assert.equal(isLocalOnly('commit'), true); assert.equal(isLocalOnly('none'), true); assert.equal(isLocalOnly('create'), false);
});

test('commit action follows cc(): disabled while responding with the official reason, disabled when clean, never busy', () => {
  assert.equal(COMMIT_RESPONDING_REASON, 'Claude is working \u2014 wait for the turn to finish');
  assert.equal(COMMIT_CLEAN_REASON, 'No changes to commit');
  assert.deepEqual(commitAction(dirty, { responding: true }), { label: 'Commit', text: COMMIT_TURN_TEXT, disabled: true, disabledReason: COMMIT_RESPONDING_REASON });
  assert.deepEqual(commitAction({ ...dirty, workingTreeDirty: false }), { label: 'Commit', text: COMMIT_TURN_TEXT, disabled: true, disabledReason: COMMIT_CLEAN_REASON });
  assert.deepEqual(commitAction({ ...dirty, workingTreeDirty: false }, { responding: true }).disabledReason, COMMIT_CLEAN_REASON, 'clean tree wins over responding (Sn checked first)');
  // After a commit on the branch: the band stays (hasChanges, +N −M for the branch) and Commit is 'No changes to commit'.
  const committed = buildGitRailModel({ status: { ...dirty, workingTreeDirty: false } });
  assert.equal(committed.visible, true); assert.equal(committed.action.disabled, true); assert.equal(committed.action.disabledReason, COMMIT_CLEAN_REASON);
  assert.equal(commitAction({ ...dirty, workingTreeDirty: undefined }).disabled, true, 'only a reported dirty tree enables Commit');
  assert.deepEqual(commitAction(dirty), { label: 'Commit', text: COMMIT_TURN_TEXT, disabled: false, disabledReason: undefined });
  assert.ok(!('busy' in commitAction(dirty, { responding: true })), 'no busy state: pi holds only PR creation and Mi has no commit busy label');
  const responding = buildGitRailModel({ status: dirty, responding: true });
  assert.equal(responding.action.disabled, true); assert.equal(responding.action.disabledReason, COMMIT_RESPONDING_REASON);
  assert.equal(responding.visible, true, 'responding does not hide the row');
  assert.equal(buildGitRailModel({ status: dirty, prMode: 'create', responding: true }).action, null);
});

test('behind data stays available to the model but needs branch !== base and a positive count', () => {
  const model = buildGitRailModel({ status: dirty, comparison });
  assert.deepEqual(model.behind, { count: 1, base: 'main', tooltip: '1 commit behind main' });
  assert.equal(behindIndicator({ ...comparison, behind: 0 }, 'feature'), null);
  assert.equal(behindIndicator({ ...comparison, base: 'feature', same: true, behind: 3 }, 'feature'), null);
  assert.equal(behindIndicator({ ...comparison, base: 'feature', behind: 3 }, 'feature'), null, 'branch === base');
  assert.equal(behindIndicator(comparison, null), null, 'detached HEAD has no branch');
  assert.equal(behindIndicator(null, 'feature'), null);
  assert.equal(behindIndicator({ ...comparison, behind: 2 }, 'feature').tooltip, '2 commits behind main');
  assert.equal(buildGitRailModel({ status: { ...dirty, detached: true, branch: 'abc1234' }, comparison }).behind, null);
});

test('outside commit mode the Base branch fact appears with the behind count and compared-with hint', () => {
  const model = buildGitRailModel({ status: dirty, comparison, prMode: 'create' });
  assert.deepEqual(model.facts.map((fact) => fact.key), ['base', 'changes']);
  assert.equal(model.facts[0].value, 'main · 1 behind');
  assert.equal(model.facts[0].hint, 'A pull request from this branch merges into main.');
  assert.equal(model.facts[0].hintDetail, '1 commit behind main');
  assert.equal(model.facts[1].hintDetail, 'Lines added and removed compared with main.');
  assert.equal(model.action, null);
  assert.equal(visibleBaseBranch({ prMode: 'create', prState: undefined, baseBranch: 'main', branch: 'main' }), undefined, 'A === j with no PR');
  assert.equal(visibleBaseBranch({ prMode: 'create', prState: 'open', baseBranch: 'main', branch: 'main' }), 'main');
  assert.equal(visibleBaseBranch({ prMode: 'commit', prState: 'open', baseBranch: 'main', branch: 'feature' }), undefined);
});

test('signals: counted changes, uncounted dirty (binary-only) and clean; hideRepo drops the repo from the title', () => {
  assert.deepEqual(railSignal({ isRepo: true, hasChanges: true, added: 0, removed: 0 }), { kind: 'uncounted', text: 'Changes' });
  assert.deepEqual(railSignal({ isRepo: true, hasChanges: false, added: 0, removed: 0 }), { kind: 'clean', text: 'No changes' });
  assert.equal(railSignal({ isRepo: false }), null);
  const clean = buildGitRailModel({ status: { ...dirty, hasChanges: false, workingTreeDirty: false, added: 0, removed: 0 } });
  assert.equal(clean.visible, false); assert.deepEqual(clean.facts, []); assert.equal(clean.action.disabled, true);
  assert.equal(buildGitRailModel({ status: dirty, hideRepo: true }).title, 'feature');
  assert.equal(buildGitRailModel({ status: { ...dirty, repoName: undefined, cwd: '/x/y/named' } }).title, 'named · feature');
  assert.equal(buildGitRailModel({ status: null }).visible, false);
  assert.equal(buildGitRailModel({ status: { isRepo: false } }).visible, false);
  assert.deepEqual(buildGitRailModel({ status: dirty, prLink: { numberText: '#1' } }).facts.map((fact) => fact.key), ['repository', 'changes']);
  assert.deepEqual(buildGitRailModel({ status: dirty, prLink: { numberText: '#1' }, hideRepo: true }).facts.map((fact) => fact.key), ['changes']);
});

test('placeholder reservation: remembered px capped at 360 with 28px rows, else 4 rows (5 with PR) at 28px + 4px gaps', () => {
  assert.deepEqual(railReservation({ remembered: 90 }), { heightPx: 90, rows: 3, source: 'memory' });
  assert.deepEqual(railReservation({ remembered: 20 }), { heightPx: 20, rows: 1, source: 'memory' });
  assert.deepEqual(railReservation({ remembered: 1000 }), { heightPx: 360, rows: 13, source: 'memory' });
  assert.deepEqual(railReservation({ checkoutHadRow: true }), { heightPx: 124, rows: 4, source: 'checkout' });
  assert.deepEqual(railReservation({ checkoutHadRow: true, hasPr: true }), { heightPx: 156, rows: 5, source: 'checkout' });
  assert.deepEqual(railReservation({}), { heightPx: 0, rows: 0, source: 'none' });
  assert.deepEqual(railReservation({ remembered: 0, checkoutHadRow: false }), { heightPx: 0, rows: 0, source: 'none' });
});
