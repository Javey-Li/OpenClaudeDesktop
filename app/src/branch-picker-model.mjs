import { t } from "../electron/i18n/index.mjs";

// Composer branch picker, step 1 (2.2553.1 cc43287c9-BMbiZYzF.js:22009-22035
// hT props, :12050-12071 branch order; cd2687f9f-CY3xvb9b.js N combobox).
// - Default branch: the repo's defaultBranch (F). Locally that is origin/HEAD's
//   target when the repo has it as a local branch, else main, else master
//   (the source's own main/master fallback for the starting branch, :12057).
// - Order (oe): the default branch first, the rest by localeCompare; a default
//   missing from the list is prepended.
// - Search: Y filters on input; Enter selects the first match (Q) when the
//   query is non-empty; an empty result shows the Empty row "No branches match".
//   The source ranks matches with a fuzzy index over the name after the last
//   "/" (weight .7) and the full label (.3); locally a case-insensitive
//   substring match on the label keeps the sorted order.
// - Trigger label: the chosen branch or "—" (triggerLabel c ?? "—").

export const BRANCH_SEARCH_PLACEHOLDER = t("Search branches…");
export const BRANCH_EMPTY_MESSAGE = t("No branches match");
export const BRANCH_TOOLTIP = t("Branch to start from");

/** F: origin/HEAD ("origin/main" or "main") when it is a local branch, else main, else master, else null. */
export function defaultBranch({ originHead = "", branches = [] } = {}) {
  const list = Array.isArray(branches) ? branches : [];
  const head = typeof originHead === "string" ? originHead.replace(/^refs\/remotes\//, "").replace(/^origin\//, "") : "";
  if (head && list.includes(head)) return head;
  return list.find((name) => name === "main") ?? list.find((name) => name === "master") ?? null;
}

/** oe: default first, then localeCompare; a missing default is prepended. */
export function sortBranches(branches = [], preferred = null) {
  const sorted = [...new Set(Array.isArray(branches) ? branches : [])].sort((left, right) => {
    if (preferred) {
      if (left === preferred) return -1;
      if (right === preferred) return 1;
    }
    return left.localeCompare(right);
  });
  return preferred && !sorted.includes(preferred) ? [preferred, ...sorted] : sorted;
}

/** Y: every branch for an empty query, else the ones whose label contains it. */
export function filterBranches(sorted = [], query = "") {
  const needle = String(query ?? "").trim().toLowerCase();
  if (!needle) return [...sorted];
  return sorted.filter((label) => label.toLowerCase().includes(needle));
}

/** Enter in the search field: the first match, only for a non-empty query. */
export function enterSelection(sorted = [], query = "") {
  if (!String(query ?? "").trim()) return null;
  return filterBranches(sorted, query)[0] ?? null;
}

/** triggerLabel: c ?? "—". */
export function branchTriggerLabel(branch) {
  return typeof branch === "string" && branch ? branch : "—";
}

// Branch step 2 (cc43287c9-BMbiZYzF.js:12084-12145 me/he/ge, :35132 branchChanged at spawn). With worktree on the
// pick is only the worktree's base (D(e)); with it off, a branch other than the checked-out one first checks the
// working tree (me: checkBranchSwitchConflict / isWorkingTreeDirty; a failed check counts as dirty): a clean tree
// records the target and the spawn switches to it, a dirty one opens the GR dialog (ue(t)).
// Returns 'none' | 'worktree' | 'checkout-on-send' | 'resolve-dialog'.
export function branchSwitchPlan({ worktree = false, dirty = false, current = "", target } = {}) {
  if (typeof target !== "string" || !target || target === current) return "none";
  if (worktree) return "worktree";
  return dirty ? "resolve-dialog" : "checkout-on-send";
}

/** The checked-out branch: a recorded pick keeps the real one in `checkedOut` until the spawn switches to it. */
export function checkedOutBranch(info) {
  return typeof info?.checkedOut === "string" ? info.checkedOut : (info?.branch || "");
}

/** The branch a worktree-less spawn must switch to first (:35132), or null. */
export function branchCheckoutTarget(info) {
  if (!info?.isRepo || typeof info.branch !== "string" || !info.branch) return null;
  return info.branch !== checkedOutBranch(info) ? info.branch : null;
}

// UR (:15860-15912) and GR (:15920-16060) copy.
export const WORKING_TREE_ERROR = t("Couldn’t update the working tree.");
export const BRANCH_SWITCH_MODES = Object.freeze(["stash", "commit", "discard"]);
export const BRANCH_SWITCH_LABELS = Object.freeze({ stash: t("Stash changes"), commit: t("Commit as WIP"), discard: t("Discard changes") });
