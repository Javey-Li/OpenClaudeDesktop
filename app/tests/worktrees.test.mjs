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
  assert.deepEqual(await worktrees.worktreeStatus(run, dest), { exists: true, changes: 1 });
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
