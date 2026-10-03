const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');

const MAX_OUTPUT = 16 * 1024 * 1024;
const MAX_FILES = 10000;
const TOTAL_TIMEOUT = 20000;
const COMMAND_TIMEOUT = 10000;
const DIFF_FLAGS = ['--no-ext-diff', '--no-textconv', '--no-color', '--no-relative', '--src-prefix=a/', '--dst-prefix=b/'];

function failure(message, code) {
  return Object.assign(new Error(message), { code });
}

function environment() {
  // Parent Git context must not redirect a workspace query to another index or
  // object database. No command below contacts a remote or updates the index.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  return { ...env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_OPTIONAL_LOCKS: '0',
    GIT_NO_REPLACE_OBJECTS: '1', GIT_LITERAL_PATHSPECS: '1', LC_ALL: 'C' };
}

function context(cwd, trace) {
  // log.showSignature=false (heavyWorkWorker git config `-c log.showSignature=false`): a repository-local
  // log.showSignature=true would otherwise make log/show run the gpg.program named by that repository.
  return { cwd, deadline: Date.now() + TOTAL_TIMEOUT, output: 0, env: environment(), trace,
    config: ['-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', '-c', 'core.hooksPath=/dev/null', '-c', 'log.showSignature=false'] };
}

async function git(ctx, args, { allowed = [0], input, paths = false } = {}) {
  const remaining = ctx.deadline - Date.now();
  if (remaining <= 0) throw failure('Git workspace query timed out.', 'GIT_TIMEOUT');
  // Test observation only: every spawned argv and the environment keys it ran with.
  ctx.trace?.({ args: [...args], envKeys: Object.keys(ctx.env) });
  return new Promise((resolve, reject) => {
    const child = execFile('git', ['--no-pager', ...ctx.config, ...args], {
      cwd: ctx.cwd, env: ctx.env, encoding: 'buffer', windowsHide: true,
      timeout: Math.min(COMMAND_TIMEOUT, remaining), maxBuffer: MAX_OUTPUT,
    }, (error, stdout, stderr) => {
      ctx.output += stdout.length + stderr.length;
      if (ctx.output > MAX_OUTPUT * 2 || error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
        reject(failure('Git workspace output exceeds the supported limit.', 'GIT_OUTPUT_LIMIT')); return;
      }
      if (error?.killed || error?.signal === 'SIGTERM') {
        reject(failure('Git workspace query timed out.', 'GIT_TIMEOUT')); return;
      }
      if (error && !allowed.includes(error.code)) {
        reject(failure(`Git workspace query failed: ${stderr.toString('utf8').trim().slice(0, 500) || error.message}`, 'GIT_QUERY_FAILED')); return;
      }
      try {
        // A lossy filename could query the wrong file. Reject invalid UTF-8 in
        // path-bearing protocols; human-readable patches remain ordinary text.
        const output = paths ? new TextDecoder('utf-8', { fatal: true }).decode(stdout) : stdout.toString('utf8');
        resolve({ output, code: error?.code || 0, stderr: stderr.toString('utf8') });
      } catch { reject(failure('Git returned a path that cannot be represented as UTF-8.', 'GIT_PATH_ENCODING')); }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input ?? '');
  });
}

function empty(cwd) {
  return { isRepo: false, cwd, repoName: null, branch: null, headSha: null, hasChanges: false, workingTreeDirty: false,
    added: 0, removed: 0, files: 0, binaryFiles: 0, untrackedCount: 0, diffBase: null, scopeBase: null, fileDetails: [], comparison: null };
}

async function repository(cwd, trace) {
  if (typeof cwd !== 'string' || !cwd.trim()) throw new TypeError('A workspace directory is required.');
  const requested = path.resolve(cwd);
  let directory;
  try { directory = await fs.realpath(requested); if (!(await fs.stat(directory)).isDirectory()) return null; }
  catch (error) { if (['ENOENT', 'ENOTDIR'].includes(error.code)) return null; throw error; }
  const ctx = context(directory, trace);
  const top = await git(ctx, ['rev-parse', '--show-toplevel'], { allowed: [0, 128], paths: true });
  if (top.code === 128) {
    if (/not a git repository|must be run in a work tree/.test(top.stderr)) return null;
    throw failure(`Cannot inspect workspace repository: ${top.stderr.trim().slice(0, 500)}`, 'GIT_QUERY_FAILED');
  }
  // Remove exactly the protocol's terminating newline, not valid path spaces.
  ctx.cwd = await fs.realpath(top.output.replace(/\n$/, ''));
  // Clean/process filters can otherwise run programs even with --no-ext-diff.
  // Disable configured filter commands before asking status/diff to read files.
  const filters = await git(ctx, ['config', '--null', '--name-only', '--get-regexp', '^filter\\..*\\.(clean|smudge|process|required)$'], { allowed: [0, 1], paths: true });
  for (const key of filters.output.split('\0').filter(Boolean)) {
    ctx.config.push('-c', `${key}=${key.endsWith('.required') ? 'false' : ''}`);
  }
  const head = await git(ctx, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'], { allowed: [0, 1, 128] });
  if (head.code === 128) throw failure('Repository HEAD cannot be read.', 'GIT_QUERY_FAILED');
  ctx.head = head.code === 0 ? head.output.trim() : null;
  ctx.diffBase = ctx.head || (await git(ctx, ['hash-object', '-t', 'tree', '--stdin'], { input: '' })).output.trim();
  return ctx;
}

function parseStatus(output) {
  const parts = output.split('\0'), records = [];
  for (let at = 0; at < parts.length; at++) {
    const entry = parts[at];
    if (!entry) continue;
    if (entry.length < 4 || entry[2] !== ' ') throw failure('Malformed Git status response.', 'GIT_STATUS_PARSE');
    const indexStatus = entry[0], worktreeStatus = entry[1], pathname = entry.slice(3);
    const record = { path: pathname, indexStatus, worktreeStatus, untracked: entry.startsWith('??'), binary: false, added: 0, removed: 0 };
    if ('RC'.includes(indexStatus) || 'RC'.includes(worktreeStatus)) {
      const oldPath = parts[++at];
      if (!oldPath) throw failure('Incomplete Git rename response.', 'GIT_STATUS_PARSE');
      record.oldPath = oldPath;
    }
    records.push(record);
    if (records.length > MAX_FILES) throw failure('Workspace has too many changed files to inspect.', 'GIT_FILE_LIMIT');
  }
  return records;
}

function parseNumstat(output) {
  const parts = output.split('\0'), records = [];
  for (let at = 0; at < parts.length; at++) {
    if (!parts[at]) continue;
    const match = /^(\d+|-)\t(\d+|-)\t([\s\S]*)$/.exec(parts[at]);
    if (!match) throw failure('Malformed Git numstat response.', 'GIT_NUMSTAT_PARSE');
    let pathname = match[3], oldPath;
    if (!pathname) { oldPath = parts[++at]; pathname = parts[++at]; }
    if (!pathname) throw failure('Incomplete Git numstat path.', 'GIT_NUMSTAT_PARSE');
    records.push({ path: pathname, ...(oldPath ? { oldPath } : {}),
      binary: match[1] === '-' || match[2] === '-', added: match[1] === '-' ? 0 : Number(match[1]), removed: match[2] === '-' ? 0 : Number(match[2]) });
  }
  return records;
}

async function safeFile(ctx, relative) {
  // Porcelain reports an untracked nested repository as a directory. Do not
  // recurse into it or silently treat its contents as this repository's files.
  if (relative.endsWith('/')) return false;
  if (!relative || path.isAbsolute(relative) || relative.includes('\0') || relative.split('/').some((part) => part === '..' || part === '')) {
    throw failure('Git returned a path outside the workspace.', 'GIT_UNSAFE_PATH');
  }
  const parts = relative.split('/');
  let current = ctx.cwd;
  for (let at = 0; at < parts.length; at++) {
    current = path.join(current, parts[at]);
    let stat;
    try { stat = await fs.lstat(current); }
    catch (error) { if (['ENOENT', 'ENOTDIR'].includes(error.code)) return false; throw error; }
    if (at < parts.length - 1) {
      if (stat.isSymbolicLink() || !stat.isDirectory()) return false;
    } else {
      // --no-index treats a directory symlink differently from a file symlink.
      // Supply link text on stdin instead, so Git cannot recurse into a target.
      if (stat.isSymbolicLink()) return { kind: 'symlink', content: await fs.readlink(current, { encoding: 'buffer' }) };
      return stat.isFile() ? { kind: 'file' } : false;
    }
  }
  return false;
}

async function currentFiles(ctx, records) {
  const candidates = new Set(records.filter((record) => record.untracked).map((record) => record.path));
  if (!ctx.head) {
    const tracked = await git(ctx, ['ls-files', '--cached', '-z'], { paths: true });
    for (const pathname of tracked.output.split('\0').filter(Boolean)) candidates.add(pathname);
  }
  if (candidates.size > MAX_FILES) throw failure('Workspace has too many files to inspect.', 'GIT_FILE_LIMIT');
  const result = [];
  for (const pathname of candidates) {
    const file = await safeFile(ctx, pathname);
    if (file) result.push({ path: pathname, ...file });
  }
  return result;
}

function quotePath(value) {
  if (/^[!-~]+$/.test(value) && !/["\\]/.test(value)) return value;
  return '"' + [...Buffer.from(value)].map((byte) => {
    if (byte === 34 || byte === 92) return '\\' + String.fromCharCode(byte);
    if (byte < 32 || byte >= 127) return '\\' + byte.toString(8).padStart(3, '0');
    return String.fromCharCode(byte);
  }).join('') + '"';
}

async function additionDiff(ctx, file, numstat = false) {
  const symlink = file.kind === 'symlink';
  const response = await git(ctx, ['diff', '--no-index', ...DIFF_FLAGS, ...(numstat ? ['--numstat', '-z'] : []), '--', '/dev/null', symlink ? '-' : file.path],
    { allowed: [0, 1], paths: numstat, ...(symlink ? { input: file.content } : {}) });
  if (!symlink || numstat) return response.output;
  // The hunk is produced by Git from the actual link bytes. Replace only the
  // stdin filename/mode metadata, preserving the payload and newline markers.
  return response.output.split('\n').map((line) => {
    if (line === 'diff --git a/- b/-') return `diff --git ${quotePath('a/' + file.path)} ${quotePath('b/' + file.path)}`;
    if (line === 'new file mode 100644') return 'new file mode 120000';
    if (line === '+++ b/-') return `+++ ${quotePath('b/' + file.path)}`;
    return line;
  }).join('\n');
}

async function mapLimited(items, callback) {
  let cursor = 0;
  const results = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, async () => {
    while (cursor < items.length) { const at = cursor++; results[at] = await callback(items[at]); }
  }));
  return results;
}

async function snapshot(cwd, trace) {
  const ctx = await repository(cwd, trace);
  if (!ctx) return null;
  const response = await git(ctx, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=none'], { paths: true });
  return { ctx, records: parseStatus(response.output) };
}

const REMOTE = 'refs/remotes/origin/';

async function refExists(ctx, ref) {
  return (await git(ctx, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { allowed: [0, 1] })).code === 0;
}

function validBranchName(name) {
  return typeof name === 'string' && name.length > 0 && name.length < 512 && !name.startsWith('-') && !/[\0\s~^:?*[\\]/.test(name);
}

/** Session base branch (ion-dist c0547825d session repos: `baseBranch =
 * git.defaultBranch ?? sourceBranch ?? branch`). defaultBranch is the main
 * process getGitInfo order (index.chunk-Mak6MV2t.js): `symbolic-ref --short
 * refs/remotes/origin/HEAD` without its origin/ prefix, else the first of
 * main/master with a refs/remotes/origin/<b>. sourceBranch is the branch a
 * worktree session was created from (preferredBase). Null when nothing resolves
 * (a detached HEAD without a remote or recorded base). */
async function defaultBase(ctx, branch, preferredBase) {
  const remoteHead = await git(ctx, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'], { allowed: [0, 1, 128] });
  const named = remoteHead.code === 0 ? remoteHead.output.trim() : '';
  if (named.startsWith('origin/') && validBranchName(named.slice(7))) return { base: named.slice(7), baseSource: 'default' };
  for (const candidate of ['main', 'master']) {
    if (await refExists(ctx, REMOTE + candidate)) return { base: candidate, baseSource: 'default' };
  }
  if (validBranchName(preferredBase) && (await refExists(ctx, `refs/heads/${preferredBase}`) || await refExists(ctx, REMOTE + preferredBase))) {
    return { base: preferredBase, baseSource: 'session' };
  }
  if (branch) return { base: branch, baseSource: 'current' };
  return { base: null, baseSource: null };
}

/** heavyWorkWorker ua: the base ref is origin/<b>, then <b>, else HEAD (null here,
 * which leaves the plain HEAD diff). */
async function resolveBaseRef(ctx, base) {
  if (!validBranchName(base)) return null;
  if (await refExists(ctx, REMOTE + base)) return REMOTE + base;
  if (await refExists(ctx, `refs/heads/${base}`)) return `refs/heads/${base}`;
  return null;
}

/** heavyWorkWorker fa: `merge-base <ref> HEAD` (|| the ref itself) is the diff
 * base of the default "All changes" scope. An explicit valid base (the Changes
 * "Compare against" choice) replaces the inferred one; an unborn HEAD keeps the
 * empty tree and an unresolvable base keeps HEAD. */
async function scopeBase(ctx, branch, { preferredBase, base: explicit } = {}) {
  let chosen = null;
  if (validBranchName(explicit)) {
    const ref = await resolveBaseRef(ctx, explicit);
    if (ref) chosen = { base: explicit, baseSource: 'custom', baseRef: ref };
  }
  if (!chosen) {
    const inferred = await defaultBase(ctx, branch, preferredBase);
    chosen = { ...inferred, baseRef: inferred.base ? await resolveBaseRef(ctx, inferred.base) : null };
  }
  let mergeBase = null;
  if (ctx.head && chosen.baseRef) {
    const found = await git(ctx, ['merge-base', chosen.baseRef, 'HEAD'], { allowed: [0, 1] });
    mergeBase = found.code === 0 && found.output.trim() ? found.output.trim()
      : (await git(ctx, ['rev-parse', '--verify', '--quiet', `${chosen.baseRef}^{commit}`], { allowed: [0, 1] })).output.trim() || null;
  }
  return { ...chosen, mergeBase, diffBase: mergeBase || ctx.diffBase };
}

/** Local `rev-list --left-right --count <baseRef>...HEAD` against the same base
 * as the diff: behind is the left count, ahead the right. Never fetches; an
 * unborn HEAD is 0/0 and an unresolvable base leaves the counts null instead of
 * inventing a comparison. `same` marks a checkout of the base branch itself
 * (the counts still run, so unpushed work on main shows as ahead). */
async function comparison(ctx, branch, preferredBase, resolved) {
  const scope = resolved || await scopeBase(ctx, branch, { preferredBase });
  const { base, baseSource, baseRef, mergeBase } = scope;
  const result = { base, baseSource, baseRef, mergeBase, ahead: null, behind: null, same: !!branch && branch === base, unpushed: null };
  if (branch && await refExists(ctx, REMOTE + branch) && ctx.head) {
    const count = await git(ctx, ['rev-list', '--count', `${REMOTE}${branch}..HEAD`, '--']);
    result.unpushed = Number(count.output.trim());
  }
  if (!base) return result;
  if (!ctx.head) return { ...result, ahead: 0, behind: 0 };
  if (!baseRef) return result;
  const counts = await git(ctx, ['rev-list', '--left-right', '--count', `${baseRef}...HEAD`, '--']);
  const match = /^(\d+)\s+(\d+)\s*$/.exec(counts.output);
  if (!match) throw failure('Malformed Git rev-list response.', 'GIT_REVLIST_PARSE');
  return { ...result, behind: Number(match[1]), ahead: Number(match[2]) };
}

async function currentBranch(ctx) {
  const branch = await git(ctx, ['symbolic-ref', '--quiet', '--short', 'HEAD'], { allowed: [0, 1] });
  return branch.code === 0 ? branch.output.trim() : null;
}

/** Base branch and ahead/behind for a workspace; null for a non-repository. */
async function workspaceGitComparison(cwd, { preferredBase, trace } = {}) {
  const ctx = await repository(cwd, trace);
  if (!ctx) return null;
  return comparison(ctx, await currentBranch(ctx), preferredBase);
}

/** Band diff stats (heavyWorkWorker ya/ha via getGitDiffStats(cwd, baseBranch)):
 * `diff --numstat -M <mergeBase>` (merge-base of the session base and HEAD,
 * worktree side) plus untracked files, so commits made on the branch keep their
 * +N −M. hasChanges = any file in that diff (Ii shows the row, tc); the Commit
 * gate is workingTreeDirty = any porcelain record (shared-16 wu
 * isWorkingTreeDirty). A repository without a remote compares against its own
 * branch, i.e. the HEAD diff. */
async function workspaceGitStatus(cwd, { preferredBase, trace } = {}) {
  const state = await snapshot(cwd, trace);
  if (!state) return empty(path.resolve(cwd));
  const { ctx, records } = state;
  const byPath = new Map(records.map((record) => [record.path, record]));
  const branch = await currentBranch(ctx);
  const scope = await scopeBase(ctx, branch, { preferredBase });
  const tracked = ctx.head ? parseNumstat((await git(ctx,
    ['diff', ...DIFF_FLAGS, '--find-renames', '--ignore-submodules=none', '--numstat', '-z', scope.diffBase, '--'], { paths: true })).output) : [];
  const additions = await mapLimited(await currentFiles(ctx, records), async (file) => {
    return parseNumstat(await additionDiff(ctx, file, true)).map((record) => ({ ...record, path: file.path, oldPath: undefined }));
  });
  for (const record of [...tracked, ...additions.flat()]) {
    const current = byPath.get(record.path) || { path: record.path, indexStatus: ' ', worktreeStatus: 'M', untracked: false };
    byPath.set(record.path, { ...current, ...record, oldPath: record.oldPath || current.oldPath });
  }
  const files = [...byPath.values()];
  return { isRepo: true, cwd: ctx.cwd, repoName: path.basename(ctx.cwd),
    branch: branch || ctx.head?.slice(0, 7) || null, detached: !branch, headSha: ctx.head,
    hasChanges: files.length > 0, workingTreeDirty: records.length > 0,
    added: files.reduce((sum, file) => sum + file.added, 0), removed: files.reduce((sum, file) => sum + file.removed, 0),
    files: files.length, binaryFiles: files.filter((file) => file.binary).length,
    untrackedCount: records.filter((record) => record.untracked).length, diffBase: scope.diffBase,
    baseKind: !ctx.head ? 'empty-tree' : scope.diffBase === ctx.head ? 'HEAD' : 'merge-base',
    // The base the Changes scope names ('main → working tree'); null leaves only the HEAD diff.
    scopeBase: scope.baseRef ? scope.base : null, fileDetails: files,
    comparison: await comparison(ctx, branch, preferredBase, scope) };
}

const COMMIT_SCOPE = /^commit:([0-9a-f]{7,64})$/i;

/** Changes patch for one diff scope (panes-tile-current.js zm; heavyWorkWorker
 * ya/fa): 'branch' (default) = merge-base(base, HEAD) → worktree plus untracked
 * files, 'uncommitted' = HEAD → worktree plus untracked files, 'commit:<sha>' =
 * heavyWorkWorker ka: `<sha>^..<sha>` (the first-parent patch, so a merge commit
 * is not a combined diff), the empty tree for a root commit. `base` is an
 * explicit "Compare against" branch; an invalid one falls back to the inferred base. */
async function workspaceGitDiff(cwd, { completeContext = false, scope = 'branch', base, preferredBase } = {}) {
  const state = await snapshot(cwd);
  if (!state) return completeContext ? { patch: '', completeContext: false } : '';
  const { ctx, records } = state;
  const options = { scope, base, preferredBase };
  const commit = typeof scope === 'string' ? COMMIT_SCOPE.exec(scope)?.[1] : undefined;
  if (typeof scope === 'string' && scope.startsWith('commit:') && !commit) throw failure('Invalid commit scope.', 'GIT_SCOPE_INVALID');
  let tracked;
  try {
    if (commit) {
      const known = await git(ctx, ['rev-parse', '--verify', '--quiet', `${commit}^{commit}`], { allowed: [0, 1] });
      if (known.code !== 0) throw failure('The selected commit is not in this repository.', 'GIT_SCOPE_INVALID');
      const sha = known.output.trim();
      const parent = await git(ctx, ['rev-parse', '--verify', '--quiet', `${sha}^`], { allowed: [0, 1] });
      const from = parent.code === 0 && parent.output.trim() ? parent.output.trim()
        : (await git(ctx, ['hash-object', '-t', 'tree', '--stdin'], { input: '' })).output.trim();
      tracked = (await git(ctx, ['diff', ...DIFF_FLAGS, '--find-renames', '--ignore-submodules=none',
        ...(completeContext ? ['--unified=2147483647'] : []), from, sha, '--'])).output;
    } else {
      const diffBase = scope === 'uncommitted' ? ctx.diffBase : (await scopeBase(ctx, await currentBranch(ctx), { preferredBase, base })).diffBase;
      // A single Git invocation supplies old and new lines against the pinned
      // commit. Never combine a historical patch with a later disk-file read.
      tracked = ctx.head ? (await git(ctx, ['diff', ...DIFF_FLAGS, '--find-renames', '--ignore-submodules=none',
        ...(completeContext ? ['--unified=2147483647'] : []), diffBase, '--'])).output : '';
    }
  } catch (error) {
    if (!completeContext || error.code !== 'GIT_OUTPUT_LIMIT') throw error;
    return { patch: await workspaceGitDiff(cwd, options), completeContext: false };
  }
  // A commit's own patch has no worktree side; the untracked additions belong to the worktree scopes.
  const additions = commit ? [] : await mapLimited(await currentFiles(ctx, records), (file) => additionDiff(ctx, file));
  const diff = [tracked, ...additions].join('');
  if (Buffer.byteLength(diff) > MAX_OUTPUT) {
    if (completeContext) return { patch: await workspaceGitDiff(cwd, options), completeContext: false };
    throw failure('Git workspace diff exceeds the supported limit.', 'GIT_OUTPUT_LIMIT');
  }
  if (!completeContext) return diff;
  // Match the renderer's existing raw-patch limits. A huge unchanged file must
  // not turn a small usable edit into a giant raw fallback in Changes.
  if (diff.length > 4 * 1024 * 1024 || diff.split('\n').length > 50000) {
    return { patch: await workspaceGitDiff(cwd, options), completeContext: false };
  }
  return { patch: diff, completeContext: true };
}

/** zm Commits submenu data: `log <baseRef>..HEAD`, newest first, at most `limit`
 * (51 = the 50 rows plus one to know that older ones exist), and `total` =
 * `rev-list --count <baseRef>..HEAD` (Oa lists them all; zm counts m.length − 50
 * older commits, so the hidden count stays real without fetching every row).
 * Empty without a resolvable base or with an unborn HEAD. */
async function workspaceGitCommits(cwd, { preferredBase, base, limit = 51, trace } = {}) {
  const ctx = await repository(cwd, trace);
  if (!ctx) return { base: null, commits: [], total: 0 };
  const scope = await scopeBase(ctx, await currentBranch(ctx), { preferredBase, base });
  if (!ctx.head || !scope.baseRef) return { base: scope.baseRef ? scope.base : null, commits: [], total: 0 };
  const count = Math.max(1, Math.min(Number.isSafeInteger(limit) ? limit : 51, 500));
  // heavyWorkWorker Oa: `log --no-show-signature` (the config above also pins log.showSignature=false).
  const log = await git(ctx, ['log', '--no-show-signature', '-z', `--max-count=${count}`, '--format=%H%x1f%h%x1f%s', `${scope.baseRef}..HEAD`, '--']);
  const counted = await git(ctx, ['rev-list', '--count', `${scope.baseRef}..HEAD`, '--']);
  const commits = log.output.split('\0').map((entry) => entry.replace(/^\n/, '')).filter(Boolean).map((entry) => {
    const [sha, shortSha, subject = ''] = entry.split('\x1f');
    return { sha, shortSha, subject };
  }).filter((commit) => /^[0-9a-f]{7,64}$/i.test(commit.sha || ''));
  const total = Number(counted.output.trim());
  return { base: scope.base, commits, total: Number.isSafeInteger(total) && total >= commits.length ? total : commits.length };
}

/** za getLocalBranches: the local branch names for "Compare against". */
async function workspaceGitBranches(cwd, { trace } = {}) {
  const ctx = await repository(cwd, trace);
  if (!ctx) return [];
  const listed = await git(ctx, ['for-each-ref', '--format=%(refname:short)', 'refs/heads/'], { paths: true });
  return listed.output.split('\n').map((line) => line.trim()).filter(validBranchName);
}

module.exports = { workspaceGitStatus, workspaceGitDiff, workspaceGitComparison, workspaceGitCommits, workspaceGitBranches };

// Fidelity F08: the sidebar's Folder grouping keys on repo identity (sidebar-session.js:20892-20903 IJ:
// owner/name when the origin names an owner, the cwd for a repo without one, else no project). Only
// read-only plumbing runs (rev-parse --show-toplevel, config --get remote.origin.url); each cwd resolves
// once per process and is cached, so the renderer can ask again without spawning git.
const repoIdentityCache = new Map();
const REPO_IDENTITY_CACHE_LIMIT = 500;

function remoteRepoName(value) {
  return value.replace(/[/\\]+$/, '').split(/[/\\]/).filter(Boolean).at(-1)?.replace(/\.git$/i, '') || null;
}

/** {host, owner, name} of an origin URL: scheme URLs, scp-like `user@host:owner/name.git`, or a local path
 * (no owner). Owner is every path segment before the name (GitLab subgroups keep their full path). */
function parseRemoteUrl(url) {
  const value = typeof url === 'string' ? url.trim() : '';
  if (!value) return null;
  let host = null, route;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    let parsed;
    try { parsed = new URL(value); } catch { return null; }
    if (parsed.protocol === 'file:') return { host: null, owner: null, name: remoteRepoName(decodeURIComponent(parsed.pathname)) };
    host = parsed.hostname || null;
    try { route = decodeURIComponent(parsed.pathname); } catch { route = parsed.pathname; }
  } else {
    const scp = /^(?:[^@/\s]+@)?([^:/\s]+):(?!\/)(.+)$/.exec(value);
    if (!scp) return { host: null, owner: null, name: remoteRepoName(value) };
    host = scp[1]; route = scp[2];
  }
  const parts = route.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  const name = parts.length ? parts.at(-1).replace(/\.git$/i, '') : '';
  if (!name) return null;
  return { host, owner: parts.length > 1 ? parts.slice(0, -1).join('/') : null, name };
}

function tildePath(value, home) {
  if (!home) return value;
  const root = home.replace(/[/\\]+$/, '');
  return value === root ? '~' : value.startsWith(root + path.sep) ? '~' + value.slice(root.length) : value;
}

async function resolveRepoIdentity(cwd, { home, trace } = {}) {
  const requested = path.resolve(cwd).replace(/[/\\]+$/, '') || '/';
  const parentDir = path.dirname(requested);
  const parent = tildePath(parentDir === requested ? requested : parentDir, home);
  const none = { isRepo: false, toplevel: null, owner: null, name: null, parent };
  let directory;
  try { directory = await fs.realpath(requested); if (!(await fs.stat(directory)).isDirectory()) return none; }
  catch { return none; }
  const ctx = context(directory, trace);
  try {
    const top = await git(ctx, ['rev-parse', '--show-toplevel'], { allowed: [0, 128], paths: true });
    if (top.code !== 0) return none;
    const toplevel = top.output.replace(/\n$/, '');
    const origin = await git(ctx, ['config', '--get', 'remote.origin.url'], { allowed: [0, 1] });
    const remote = origin.code === 0 ? parseRemoteUrl(origin.output) : null;
    return { isRepo: true, toplevel, owner: remote?.owner || null, name: remote?.name || path.basename(toplevel), parent };
  } catch { return none; }
}

/** Cached repo identity of a workspace folder; never throws (an unreadable folder is not a repo). */
function repoIdentity(cwd, options = {}) {
  if (typeof cwd !== 'string' || !path.isAbsolute(cwd)) return Promise.resolve(null);
  const key = cwd.replace(/[/\\]+$/, '') || cwd;
  if (!repoIdentityCache.has(key)) {
    if (repoIdentityCache.size >= REPO_IDENTITY_CACHE_LIMIT) repoIdentityCache.delete(repoIdentityCache.keys().next().value);
    repoIdentityCache.set(key, resolveRepoIdentity(key, options));
  }
  return repoIdentityCache.get(key);
}

module.exports.repoIdentity = repoIdentity;
module.exports.parseRemoteUrl = parseRemoteUrl;
module.exports.clearRepoIdentityCache = () => repoIdentityCache.clear();
