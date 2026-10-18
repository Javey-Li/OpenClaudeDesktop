import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const worktrees = require('../electron/worktrees.cjs');
const run = promisify(execFile);
const git = (cwd, ...args) => run('git', ['-C', cwd, ...args]);

async function repo() {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'wt-')));
  const root = path.join(base, 'repo');
  fs.mkdirSync(root);
  await git(root, 'init', '-q', '-b', 'main');
  await git(root, '-c', 'user.email=a@b.c', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init');
  return { base, root };
}

test('a worktree inside the repository stays out of its status; removal and cleanup use git, keep dirty ones', async (t) => {
  const { base, root } = await repo();
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const folder = path.join(root, '.code', 'worktrees');
  const dest = path.join(folder, 'repo-1');
  fs.mkdirSync(folder, { recursive: true });
  await git(root, 'worktree', 'add', '-q', '-b', 'deepseek/x', dest, 'HEAD');
  assert.match((await git(root, 'status', '--porcelain')).stdout, /\?\? \.code\//, 'without the exclude the main checkout looks dirty');
  assert.equal(await worktrees.excludeWorktreeRoot(run, root, folder), '/.code/worktrees/');
  assert.equal(await worktrees.excludeWorktreeRoot(run, root, folder), '/.code/worktrees/', 'written once');
  assert.equal((await git(root, 'status', '--porcelain')).stdout.trim(), '');
  assert.equal(await worktrees.excludeWorktreeRoot(run, root, path.join(base, 'elsewhere')), null);
  fs.writeFileSync(path.join(dest, 'new.txt'), 'x');
  assert.deepEqual(await worktrees.worktreeStatus(run, dest), { exists: true, changes: 1, files: ['?? new.txt'] });
  // shared-19 DK lists the porcelain lines themselves (B37).
  fs.mkdirSync(path.join(dest, 'dir'));
  fs.writeFileSync(path.join(dest, 'dir', 'b.txt'), 'y');
  assert.deepEqual(await worktrees.worktreeStatus(run, dest), { exists: true, changes: 2, files: ['?? dir/b.txt', '?? new.txt'] });
  fs.rmSync(path.join(dest, 'dir'), { recursive: true });
  assert.deepEqual(await worktrees.worktreeStatus(run, path.join(base, 'missing')), { exists: false, changes: 0, files: [] });
  assert.deepEqual(await worktrees.worktreeStatus(async () => { throw new Error('git failed'); }, dest), { exists: true, changes: 0, files: [], unknown: true });
  const config = { threadIds: ['a'], archivedThreadIds: [], threadMetadata: { a: { cwd: root } }, worktreeDirectories: [dest], worktreeBases: { [dest]: 'main' } };
  assert.deepEqual(worktrees.unusedWorktrees(config), [dest]);
  assert.equal(await worktrees.removeWorktree(run, dest), true);
  assert.equal(fs.existsSync(dest), false);
  assert.match((await git(root, 'branch', '--list', 'deepseek/x')).stdout, /deepseek\/x/, 'the branch stays');
  worktrees.forgetWorktree(config, dest);
  assert.deepEqual([config.worktreeDirectories, config.worktreeBases], [[], {}]);
  assert.equal(await worktrees.removeWorktree(run, path.join(base, 'not-a-worktree')), true, 'a missing folder counts as gone');
});

test('the git rail status never lists a .code/worktrees folder, even without the exclude', async (t) => {
  const { base, root } = await repo();
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const { workspaceGitStatus } = require('../electron/git-status.cjs');
  await git(root, 'worktree', 'add', '-q', '-b', 'kimi/y', path.join(root, '.code', 'worktrees', 'r'), 'HEAD');
  fs.writeFileSync(path.join(root, 'real.txt'), 'x');
  fs.mkdirSync(path.join(root, 'sub'));
  const status = await workspaceGitStatus(path.join(root, 'sub'));
  const paths = JSON.stringify(status);
  assert.equal(paths.includes('.code/worktrees'), false);
  assert.ok(paths.includes('real.txt'), 'changes outside the session folder still count');
});

// B29 (asar createWorktree worktree_fetch → refreshSourceRef / resolveWorktreeStartPoint): a real origin clone.
test('B29 refreshedStartPoint fetches the base branch from origin and starts from it when the local branch is behind', async (t) => {
  const { base, root } = await repo();
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  worktrees._resetSourceRefFetches();
  const clone = path.join(base, 'clone');
  await run('git', ['clone', '-q', root, clone]);
  await git(root, '-c', 'user.email=a@b.c', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'upstream');
  const upstream = (await git(root, 'rev-parse', 'HEAD')).stdout.trim();
  const phases = [];
  const behind = await worktrees.refreshedStartPoint(run, clone, 'main', { onPhase: (phase) => phases.push(phase) });
  assert.deepEqual(phases, ['worktree_fetch']);
  assert.equal(behind.outcome, 'fetched');
  assert.equal(behind.start, upstream, 'a behind local branch starts at origin (fast-forward)');
  assert.equal(behind.fastForward, true);
  assert.equal((await git(clone, 'rev-parse', 'main')).stdout.trim() === upstream, false, 'the local branch itself is left alone');
  // Within a minute the fetch is not repeated.
  const again = await worktrees.refreshedStartPoint(run, clone, 'main', { onPhase: (phase) => phases.push(phase) });
  assert.equal(again.outcome, 'throttled');
  assert.deepEqual(phases, ['worktree_fetch']);
  // Local commits origin lacks keep the local branch.
  await git(clone, 'merge', '-q', '--ff-only', 'origin/main');
  await git(clone, '-c', 'user.email=a@b.c', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'local');
  assert.equal((await worktrees.refreshedStartPoint(run, clone, 'main')).start, 'main');
  // No origin: nothing to fetch.
  assert.deepEqual(await worktrees.refreshedStartPoint(run, root, 'main'), { start: 'main', outcome: 'no_origin' });
  assert.equal((await worktrees.refreshedStartPoint(run, clone, '--upload-pack=x')).outcome, 'skipped_ref');
  assert.equal(worktrees.fetchableBranch('feature/x'), true);
  assert.equal(worktrees.fetchableBranch('a..b'), false);
  assert.equal(worktrees.fetchableBranch('origin/main'), false);
});

test('B29 gitUnavailable: missing git, the macOS stub, a blocked exec and a broken config', () => {
  assert.deepEqual(worktrees.gitUnavailable(Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' })), { reason: 'missing' });
  assert.deepEqual(worktrees.gitUnavailable({ code: 1, stderr: 'xcrun: error: invalid active developer path (/Library/Developer/CommandLineTools), missing xcrun at: …' }), { reason: 'missing' });
  assert.deepEqual(worktrees.gitUnavailable({ code: 'EACCES', message: 'spawn git EACCES' }), { reason: 'exec_blocked' });
  assert.deepEqual(worktrees.gitUnavailable({ code: 128, stderr: "fatal: bad config line 3 in file /Users/x/.gitconfig\n" }),
    { reason: 'startup_failed', message: 'fatal: bad config line 3 in file /Users/x/.gitconfig' });
  assert.equal(worktrees.gitUnavailable({ code: 128, stderr: "fatal: not a git repository" }), null);
  assert.equal(worktrees.gitUnavailable(null), null);
});
