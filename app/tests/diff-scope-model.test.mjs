import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DIFF_SCOPE, UNCOMMITTED_DIFF_SCOPE, DIFF_SCOPE_COMMIT_LIMIT, branchSearchEmptyLabel, commitScopeLabel, compareAgainstBranches,
  diffScopeParam, diffScopeSections, diffScopeTrigger, filterSearchItems, resolveDiffScope, sameDiffScope,
} from '../src/diff-scope-model.mjs';

// 2.2553.1 readable/panes-tile-current.js:2842-3117 (Fm, Im, zm, Bm) and
// panes-diff-states-current.js:351 (an unset scope resolves to {kind:"branch"}).
const commit = (index) => ({ sha: index.toString(16).padStart(40, 'a'), shortSha: index.toString(16).padStart(7, 'a'), subject: `Commit ${index}` });
const shape = (sections) => sections.map((section) => [section.key, section.items.map((item) => item.label)]);

test('trigger: branch label "main → working tree", aria-label "Diff scope: …"; uncommitted and commit labels; null without a base', () => {
  const branch = diffScopeTrigger(DEFAULT_DIFF_SCOPE, { base: 'main' });
  assert.deepEqual(branch, { label: 'main → working tree', ariaLabel: 'Diff scope: main → working tree', branch: { base: 'main', head: 'working tree' } });
  assert.deepEqual(diffScopeTrigger(UNCOMMITTED_DIFF_SCOPE, { base: 'main' }), { label: 'Uncommitted changes', ariaLabel: 'Diff scope: Uncommitted changes', branch: null });
  const listed = commit(3);
  assert.equal(diffScopeTrigger({ kind: 'commit', sha: listed.sha }, { base: 'main', commits: [listed] }).label, `${listed.shortSha} Commit 3`);
  assert.equal(commitScopeLabel('0123456789abcdef', []), '0123456', 'Bm falls back to the 7-character sha');
  assert.equal(diffScopeTrigger(DEFAULT_DIFF_SCOPE, { base: null }), null);
});

test('resolve: unset → branch; unavailable uncommitted → branch; no base → uncommitted; params', () => {
  assert.deepEqual(resolveDiffScope(undefined, { base: 'main' }), DEFAULT_DIFF_SCOPE);
  assert.deepEqual(resolveDiffScope(UNCOMMITTED_DIFF_SCOPE, { base: 'main', uncommittedAvailable: false }), DEFAULT_DIFF_SCOPE);
  assert.deepEqual(resolveDiffScope(UNCOMMITTED_DIFF_SCOPE, { base: 'main' }), UNCOMMITTED_DIFF_SCOPE);
  assert.deepEqual(resolveDiffScope(DEFAULT_DIFF_SCOPE, { base: null }), UNCOMMITTED_DIFF_SCOPE, 'no resolvable base keeps the HEAD diff');
  assert.deepEqual(resolveDiffScope({ kind: 'commit', sha: '--bad' }, { base: 'main' }), DEFAULT_DIFF_SCOPE);
  const sha = 'abcdef1234567';
  assert.equal(diffScopeParam(resolveDiffScope({ kind: 'commit', sha }, { base: 'main' })), `commit:${sha}`);
  assert.equal(diffScopeParam(DEFAULT_DIFF_SCOPE), 'branch');
  assert.equal(diffScopeParam(UNCOMMITTED_DIFF_SCOPE), 'uncommitted');
  assert.equal(sameDiffScope({ kind: 'commit', sha }, { kind: 'commit', sha }), true);
  assert.equal(sameDiffScope({ kind: 'commit', sha }, { kind: 'commit', sha: 'abcdef1234568' }), false);
  assert.equal(sameDiffScope(DEFAULT_DIFF_SCOPE, UNCOMMITTED_DIFF_SCOPE), false);
});

test('sections: diff-scope (All changes vs main, Uncommitted changes), diff-base, diff-commits with 51 → 50 rows + "1 older commit not shown"', () => {
  const commits = Array.from({ length: 51 }, (_, index) => commit(index + 1));
  const sections = diffScopeSections({ scope: DEFAULT_DIFF_SCOPE, base: 'main', defaultBase: 'main', commits });
  assert.deepEqual(shape(sections), [['diff-scope', ['All changes', 'Uncommitted changes']], ['diff-base', ['Compare against']], ['diff-commits', ['Commits']]]);
  const [scope, base, list] = sections;
  assert.deepEqual(scope.items.map(({ value, hint, checked, checkedRole }) => ({ value, hint, checked, checkedRole })), [
    { value: 'branch', hint: 'vs main', checked: true, checkedRole: 'radio' },
    { value: 'uncommitted', hint: undefined, checked: false, checkedRole: 'radio' },
  ]);
  const compare = base.items[0];
  assert.equal(compare.hint, 'main'); assert.equal(compare.searchLabel, 'Search branches'); assert.equal(compare.searchEmptyLabel, 'Loading branches…');
  const rows = list.items[0].items;
  assert.equal(DIFF_SCOPE_COMMIT_LIMIT, 50);
  assert.equal(rows.length, 51);
  assert.deepEqual(rows.slice(0, 2).map(({ label, hint, checked, checkedRole }) => ({ label, hint, checked, checkedRole })), [
    { label: 'Commit 1', hint: commits[0].shortSha, checked: undefined, checkedRole: 'radio' },
    { label: 'Commit 2', hint: commits[1].shortSha, checked: undefined, checkedRole: 'radio' },
  ]);
  assert.deepEqual({ label: rows[50].label, disabled: rows[50].disabled }, { label: '1 older commit not shown', disabled: true });
  assert.equal(diffScopeSections({ base: 'main', commits: Array.from({ length: 53 }, (_, index) => commit(index + 1)) })[2].items[0].items.at(-1).label, '3 older commits not shown');
  // workspace-git-commits fetches 51 rows plus `total` (rev-list --count): zm's m.length − 50 over all 120 commits.
  const capped = diffScopeSections({ base: 'main', commits, commitTotal: 120 })[2].items[0].items;
  assert.equal(capped.length, 51); assert.deepEqual({ label: capped[50].label, disabled: capped[50].disabled }, { label: '70 older commits not shown', disabled: true });
  assert.equal(diffScopeSections({ base: 'main', commits: commits.slice(0, 50), commitTotal: 50 })[2].items[0].items.length, 50, 'exactly 50: no older row');
  assert.equal(diffScopeSections({ base: 'main', commits, commitTotal: 3 })[2].items[0].items.at(-1).label, '1 older commit not shown', 'a stale smaller total never hides listed rows');
  // A listed commit scope checks only its own row; no commits → no section; no uncommitted when unavailable.
  const picked = diffScopeSections({ scope: { kind: 'commit', sha: commits[1].sha }, base: 'main', commits: commits.slice(0, 3) });
  assert.deepEqual(picked[2].items[0].items.map((row) => row.checked), [false, true, false]);
  assert.equal(picked[0].items[0].checked, false);
  assert.deepEqual(shape(diffScopeSections({ base: 'main', uncommittedAvailable: false })), [['diff-scope', ['All changes']], ['diff-base', ['Compare against']]]);
  assert.equal(diffScopeSections({ base: 'main', commits: [{ ...commit(1), subject: '' }] })[2].items[0].items[0].label, '(no message)');
});

test('selection: scope rows, commit rows and Compare against route through the callbacks (Im onSelect rules)', () => {
  const calls = [];
  const options = { base: 'main', defaultBase: 'main', current: 'feature', commits: [commit(1)], branches: { list: ['zeta', 'main', 'alpha', 'feature'], loaded: true },
    onSelectScope: (scope) => calls.push(['scope', scope]), onSelectBase: (name) => calls.push(['base', name]), onBaseMenuOpen: () => calls.push(['open']) };
  const sections = diffScopeSections(options);
  sections[0].items[1].onSelect(); sections[0].items[0].onSelect();
  sections[2].items[0].items[0].onSelect();
  const compare = sections[1].items[0];
  compare.onOpenChange(true); compare.onOpenChange(false);
  // Fm: unique, without default and current, sorted, then the default first with a "default" hint.
  assert.deepEqual(compare.items.map((row) => [row.label, row.hint, row.checked]), [['main', 'default', true], ['alpha', undefined, false], ['zeta', undefined, false]]);
  compare.items[0].onSelect(); // the current, non-overridden base: nothing
  compare.items[1].onSelect();
  assert.deepEqual(calls, [['scope', UNCOMMITTED_DIFF_SCOPE], ['scope', DEFAULT_DIFF_SCOPE], ['scope', { kind: 'commit', sha: commit(1).sha }], ['open'],
    ['base', 'alpha'], ['scope', DEFAULT_DIFF_SCOPE]]);
  calls.length = 0;
  // An override: the picked base stays listed; picking the default clears it.
  const overridden = diffScopeSections({ ...options, base: 'topic', overridden: true, branches: { list: [], loaded: true } })[1].items[0];
  assert.deepEqual(overridden.items.map((row) => [row.label, row.checked]), [['main', false], ['topic', true]]);
  overridden.items[0].onSelect();
  assert.deepEqual(calls, [['base', null], ['scope', DEFAULT_DIFF_SCOPE]]);
});

test('Compare against helpers: Fm order, Im empty labels, H search filter', () => {
  assert.deepEqual(compareAgainstBranches(['b', 'a', 'b', 'main', 'cur'], 'main', 'cur'), ['main', 'a', 'b']);
  assert.deepEqual(compareAgainstBranches(['b', 'a'], undefined, undefined), ['a', 'b']);
  assert.equal(branchSearchEmptyLabel({ error: true }), 'Couldn’t load branches');
  assert.equal(branchSearchEmptyLabel({ loaded: true, count: 3 }), 'No branches match');
  assert.equal(branchSearchEmptyLabel({ loaded: false }), 'Loading branches…');
  assert.equal(branchSearchEmptyLabel({ loaded: true, count: 0 }), 'Loading branches…');
  assert.deepEqual(filterSearchItems([{ label: 'Main' }, { label: 'feature/x' }, { label: 'release' }], 'MA').map((row) => row.label), ['Main']);
  assert.equal(filterSearchItems([{ label: 'a' }], '').length, 1);
});
