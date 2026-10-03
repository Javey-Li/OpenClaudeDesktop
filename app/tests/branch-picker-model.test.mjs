import test from 'node:test';
import assert from 'node:assert/strict';
import { BRANCH_EMPTY_MESSAGE, BRANCH_SEARCH_PLACEHOLDER, BRANCH_TOOLTIP, branchTriggerLabel, defaultBranch, enterSelection, filterBranches, sortBranches } from '../src/branch-picker-model.mjs';

// Fidelity F03: branch picker step 1 (cc43287c9-BMbiZYzF.js:22009-22035 hT props, :12062-12071 order,
// cd2687f9f-CY3xvb9b.js N search/Enter/Empty).
test('copy matches the hT props', () => {
  assert.equal(BRANCH_TOOLTIP, 'Branch to start from');
  assert.equal(BRANCH_SEARCH_PLACEHOLDER, 'Search branches…');
  assert.equal(BRANCH_EMPTY_MESSAGE, 'No branches match');
  assert.equal(branchTriggerLabel('feature/x'), 'feature/x');
  assert.equal(branchTriggerLabel(''), '—');
  assert.equal(branchTriggerLabel(undefined), '—');
});

test('default branch: origin/HEAD when it is a local branch, else main, else master', () => {
  assert.equal(defaultBranch({ originHead: 'origin/develop', branches: ['main', 'develop'] }), 'develop');
  assert.equal(defaultBranch({ originHead: 'refs/remotes/origin/develop', branches: ['develop'] }), 'develop');
  assert.equal(defaultBranch({ originHead: 'origin/trunk', branches: ['main', 'feature'] }), 'main', 'a remote-only default falls back');
  assert.equal(defaultBranch({ branches: ['master', 'feature'] }), 'master');
  assert.equal(defaultBranch({ branches: ['feature', 'zeta'] }), null);
});

test('order: the default branch first, the rest by localeCompare; a missing default is prepended', () => {
  assert.deepEqual(sortBranches(['zeta', 'feature', 'main', 'alpha'], 'main'), ['main', 'alpha', 'feature', 'zeta']);
  assert.deepEqual(sortBranches(['zeta', 'feature'], null), ['feature', 'zeta']);
  assert.deepEqual(sortBranches(['zeta', 'feature'], 'main'), ['main', 'feature', 'zeta']);
  assert.deepEqual(sortBranches(['b', 'a', 'b'], 'b'), ['b', 'a'], 'duplicates collapse');
});

test('typing filters case-insensitively; an empty query lists everything; no match yields the Empty row', () => {
  const sorted = sortBranches(['main', 'feature/login', 'Feature-two', 'zeta'], 'main');
  assert.deepEqual(filterBranches(sorted, ''), sorted);
  // The sorted order is kept (localeCompare puts 'Feature-two' before 'feature/login').
  assert.deepEqual(filterBranches(sorted, 'FEAT'), sorted.filter((name) => /feat/i.test(name)));
  assert.equal(filterBranches(sorted, 'FEAT').length, 2);
  assert.deepEqual(filterBranches(sorted, 'login'), ['feature/login']);
  assert.deepEqual(filterBranches(sorted, 'zzz'), []);
});

test('Enter selects the first match only for a non-empty query', () => {
  const sorted = sortBranches(['main', 'feature/login', 'zeta'], 'main');
  assert.equal(enterSelection(sorted, 'e'), 'feature/login');
  assert.equal(enterSelection(sorted, '  '), null);
  assert.equal(enterSelection(sorted, ''), null);
  assert.equal(enterSelection(sorted, 'zzz'), null);
});

// R05 branch step 2 (cc43287c9-BMbiZYzF.js:12084-12145 me/he, :35132 branchChanged).
test('branchSwitchPlan: same branch none, worktree base, clean checkout on send, dirty dialog', async () => {
  const { branchSwitchPlan, checkedOutBranch, branchCheckoutTarget, WORKING_TREE_ERROR, BRANCH_SWITCH_LABELS } = await import('../src/branch-picker-model.mjs');
  assert.equal(branchSwitchPlan({ worktree: false, dirty: false, current: 'main', target: 'feature/login' }), 'checkout-on-send');
  assert.equal(branchSwitchPlan({ worktree: false, dirty: true, current: 'main', target: 'zeta-topic' }), 'resolve-dialog');
  assert.equal(branchSwitchPlan({ worktree: true, dirty: true, current: 'main', target: 'zeta-topic' }), 'worktree', 'a worktree never touches the checkout');
  assert.equal(branchSwitchPlan({ worktree: false, dirty: true, current: 'main', target: 'main' }), 'none');
  assert.equal(branchSwitchPlan({ current: 'main' }), 'none');
  // The chip shows the pick; the real branch stays in checkedOut until the spawn switches.
  assert.equal(checkedOutBranch({ isRepo: true, branch: 'main' }), 'main');
  assert.equal(checkedOutBranch({ isRepo: true, branch: 'zeta-topic', checkedOut: 'main' }), 'main');
  assert.equal(checkedOutBranch(null), '');
  assert.equal(branchCheckoutTarget({ isRepo: true, branch: 'zeta-topic', checkedOut: 'main' }), 'zeta-topic');
  assert.equal(branchCheckoutTarget({ isRepo: true, branch: 'main' }), null);
  assert.equal(branchCheckoutTarget({ isRepo: true, branch: 'main', checkedOut: 'main' }), null);
  assert.equal(branchCheckoutTarget({ isRepo: false, branch: 'x', checkedOut: 'y' }), null);
  assert.equal(WORKING_TREE_ERROR, 'Couldn’t update the working tree.');
  assert.deepEqual(BRANCH_SWITCH_LABELS, { stash: 'Stash changes', commit: 'Commit as WIP', discard: 'Discard changes' });
});
