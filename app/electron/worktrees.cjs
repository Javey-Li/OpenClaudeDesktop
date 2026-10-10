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
  fs.appendFileSync(exclude, `${text && !text.endsWith("\n") ? "\n" : ""}# Code Desktop worktrees\n${pattern}\n`);
  return pattern;
}

/** {exists, changes}: the uncommitted entries (untracked included) of a worktree folder. */
async function worktreeStatus(run, dir) {
  if (typeof dir !== "string" || !fs.existsSync(dir)) return { exists: false, changes: 0 };
  try {
    const output = String((await GIT(run, dir, ["status", "--porcelain=v1", "--untracked-files=all"])).stdout);
    return { exists: true, changes: output.split("\n").filter((line) => line.trim()).length };
  } catch { return { exists: true, changes: 0, unknown: true }; }
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
}

module.exports = { excludeWorktreeRoot, worktreeStatus, removeWorktree, unusedWorktrees, forgetWorktree };
