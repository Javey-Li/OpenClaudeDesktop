// Worktree sessions' housekeeping (main.cjs prepare-worktree, archive / delete, Settings › Storage), after the official
// 2.2553.1 behaviour: a worktree inside the repository is excluded from the main checkout's status, a session's own
// worktree goes away when the session is archived or deleted (after confirming uncommitted changes), and Storage
// removes the worktrees no session uses any more.
const fs = require("node:fs");
const path = require("node:path");

const GIT = (run, cwd, args, options = {}) => run("git", ["-C", cwd, ...args], { timeout: 20000, maxBuffer: 8 * 1024 * 1024, ...options });

/**
 * Keep a worktree folder inside the repository out of the main checkout's `git status`: its root goes into the
 * repository's own .git/info/exclude (never the tracked .gitignore). No-op when the folder is outside the repository.
 * @returns {Promise<string|null>} the pattern written (or already there), else null
 */
async function excludeWorktreeRoot(run, repoCwd, base) {
  let top, common;
  try {
    top = String((await GIT(run, repoCwd, ["rev-parse", "--show-toplevel"])).stdout).trim();
    common = String((await GIT(run, repoCwd, ["rev-parse", "--git-common-dir"])).stdout).trim();
  } catch { return null; }
  if (!top || !common) return null;
  const root = fs.realpathSync(top), folder = path.resolve(base);
  const relative = path.relative(root, folder);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  const pattern = `/${relative.split(path.sep).join("/")}/`;
  const exclude = path.join(path.isAbsolute(common) ? common : path.join(repoCwd, common), "info", "exclude");
  let text = "";
  try { text = fs.readFileSync(exclude, "utf8"); } catch {}
  if (text.split(/\r?\n/).some((line) => line.trim() === pattern)) return pattern;
  fs.mkdirSync(path.dirname(exclude), { recursive: true });
  fs.appendFileSync(exclude, `${text && !text.endsWith("\n") ? "\n" : ""}# OpenClaude Desktop worktrees\n${pattern}\n`);
  return pattern;
}

// index.chunk-BSJ_SW2t probeUncommittedChanges / statusPorcelain (maxLines is = 1e4): the porcelain lines themselves,
// which the dirty-worktree confirm lists (shared-19 DK, first 10 and "… and {more} more").
const STATUS_FILE_LIMIT = 10000;

/** {exists, changes, files}: the uncommitted entries (untracked included) of a worktree folder, as a count and as
 * their `git status --porcelain` lines (at most 10,000); `unknown` when git could not read it. */
async function worktreeStatus(run, dir) {
  if (typeof dir !== "string" || !fs.existsSync(dir)) return { exists: false, changes: 0, files: [] };
  try {
    const output = String((await GIT(run, dir, ["status", "--porcelain=v1", "--untracked-files=all"])).stdout);
    const lines = output.split("\n").filter((line) => line.trim());
    return { exists: true, changes: lines.length, files: lines.slice(0, STATUS_FILE_LIMIT) };
  } catch { return { exists: true, changes: 0, files: [], unknown: true }; }
}

/**
 * Remove a worktree with git (its branch and commits stay), from the repository's main checkout, then prune. A folder
 * git no longer knows as a worktree is left alone (it may be the user's).
 * @returns {Promise<boolean>} whether the folder is gone
 */
async function removeWorktree(run, dir) {
  if (typeof dir !== "string" || !path.isAbsolute(dir)) return false;
  if (!fs.existsSync(dir)) return true;
  let main = null;
  try {
    const listing = String((await GIT(run, dir, ["worktree", "list", "--porcelain"])).stdout);
    main = /^worktree (.+)$/m.exec(listing)?.[1] ?? null;
  } catch { return false; }
  if (!main || path.resolve(main) === path.resolve(dir)) return false;
  try { await GIT(run, main, ["worktree", "remove", "--force", dir]); } catch { return false; }
  try { await GIT(run, main, ["worktree", "prune"]); } catch {}
  return !fs.existsSync(dir);
}

/** The worktree folders no session (open or archived) works in any more. */
function unusedWorktrees(config) {
  const used = new Set([...(config.threadIds || []), ...(config.archivedThreadIds || [])]
    .map((id) => config.threadMetadata?.[id]?.cwd).filter((cwd) => typeof cwd === "string").map((cwd) => path.resolve(cwd)));
  return (config.worktreeDirectories || []).filter((dir) => typeof dir === "string" && !used.has(path.resolve(dir)));
}

/** Drop a removed worktree from the app's lists. */
function forgetWorktree(config, dir) {
  config.worktreeDirectories = (config.worktreeDirectories || []).filter((entry) => path.resolve(entry) !== path.resolve(dir));
  if (config.worktreeBases && Object.hasOwn(config.worktreeBases, dir)) delete config.worktreeBases[dir];
  // Its sessions keep their own sessionMetadata.originCwd for the Recent folders list.
  if (config.worktreeOrigins && Object.hasOwn(config.worktreeOrigins, dir)) delete config.worktreeOrigins[dir];
}

// B29 worktree start (asar index.chunk-BSJ_SW2t.js createWorktree: onInitStatus 'worktree_fetch' → refreshSourceRef,
// resolveWorktreeStartPoint, then 'worktree_add'). Before `git worktree add` the base branch is fetched from origin
// (+refs/heads/<branch>:refs/remotes/origin/<branch>, no FETCH_HEAD), at most once a minute per repository and branch;
// a failed or refused fetch continues from the refs on disk. The worktree then starts at origin's commit when the
// local branch is missing or behind it (a fast-forward), else at the local branch.
const SOURCE_REF_MAX_AGE_MS = 60000;
const lastSourceRefFetch = new Map();
/** Ja: a branch name the fetch refspec can carry safely. */
function fetchableBranch(branch) {
  return typeof branch === "string" && branch.length > 0 && branch.length <= 255 && !branch.startsWith("-") && !branch.startsWith("origin/")
    && !branch.startsWith("refs/") && /^[A-Za-z0-9._/-]+$/.test(branch) && !branch.includes("..") && !branch.endsWith(".lock") && !branch.endsWith("/");
}
async function revParse(run, cwd, ref) {
  try { return String((await GIT(run, cwd, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`])).stdout).trim() || null; }
  catch { return null; }
}
/**
 * The start point for a new worktree off `branch`: {start, fetched, outcome}. onPhase('worktree_fetch') announces the
 * fetch. Never throws for a fetch problem; a git that cannot run at all surfaces in the later worktree add.
 */
async function refreshedStartPoint(run, cwd, branch, { onPhase, now = Date.now } = {}) {
  if (!fetchableBranch(branch)) return { start: branch || "HEAD", outcome: "skipped_ref" };
  let hasOrigin = false;
  try { hasOrigin = !!String((await GIT(run, cwd, ["remote", "get-url", "origin"])).stdout).trim(); } catch { hasOrigin = false; }
  if (!hasOrigin) return { start: branch, outcome: "no_origin" };
  const key = `${path.resolve(cwd)}\0${branch}`;
  let outcome = "throttled";
  const last = lastSourceRefFetch.get(key);
  if (last === undefined || now() - last >= SOURCE_REF_MAX_AGE_MS) {
    onPhase?.("worktree_fetch");
    try {
      await GIT(run, cwd, ["fetch", "--no-write-fetch-head", "origin", `+refs/heads/${branch}:refs/remotes/origin/${branch}`],
        { timeout: 30000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
      lastSourceRefFetch.set(key, now());
      outcome = "fetched";
    } catch { outcome = "failed"; }
  }
  const [remote, local] = await Promise.all([revParse(run, cwd, `refs/remotes/origin/${branch}`), revParse(run, cwd, `refs/heads/${branch}`)]);
  if (remote && (!local || local === remote)) return { start: remote, outcome, fastForward: false };
  if (remote && local) {
    try {
      await GIT(run, cwd, ["merge-base", "--is-ancestor", local, remote]);
      return { start: remote, outcome, fastForward: true };
    } catch { /* the local branch has commits origin lacks: keep it */ }
  }
  return { start: local ? branch : remote ?? branch, outcome, fastForward: false };
}

// B29 rY/nY (cc43287c9 :17250-17390, I.ExecBlocked / I.StartupFailed / missing): why git could not run.
// ENOENT is no git at all; macOS's /usr/bin/git stub without the Command Line Tools fails with xcrun's
// "invalid active developer path" / "no developer tools"; EACCES/EPERM is a blocked exec; anything else that kept git
// from starting (a broken config file) is a startup failure.
function gitUnavailable(error) {
  if (!error) return null;
  const text = `${error.stderr ?? ""}\n${error.message ?? ""}`;
  if (error.code === "ENOENT" || /xcrun: error: invalid active developer path|No developer tools were found|xcode-select: note: no developer tools/i.test(text))
    return { reason: "missing" };
  if (error.code === "EACCES" || error.code === "EPERM") return { reason: "exec_blocked" };
  if (/fatal: (?:bad config|unable to access '[^']*config)|error: could not lock config file|fatal: unknown error occurred while reading the configuration files/i.test(text))
    return { reason: "startup_failed", message: String(error.stderr || error.message || "").trim().split("\n").slice(0, 3).join("\n") };
  return null;
}

module.exports = { excludeWorktreeRoot, worktreeStatus, removeWorktree, unusedWorktrees, forgetWorktree, refreshedStartPoint, fetchableBranch, gitUnavailable,
  _resetSourceRefFetches: () => lastSourceRefFetch.clear() };
