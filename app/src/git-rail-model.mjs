import { t, tn } from "../electron/i18n/index.mjs";

// Pure model for the rail layout of the repository row (git-status-card.js Ii
// rail branch 1128-1200, Zi 1633-1760, $i/ea 1762-1865, na 1867-2075, rs
// 4051-4058, prMode 4711/4912). No DOM, no git: it only decides which facts a
// local session may honestly show.

export const COMMIT_TURN_TEXT = "Commit the working tree changes with a sensible message.";
export const COMMIT_CLEAN_REASON = t("No changes to commit");
// "DeepSeek" is the assistant-as-actor word t() rewrites to the running core's assistant ("Codex", "GLM", …).
export const COMMIT_RESPONDING_REASON = t("DeepSeek is working \u2014 wait for the turn to finish");

/** cc/lc (5590-5600) + reasons 4930-4960 for a local commit-mode session: the
 * action is disabled while the session responds or when the working tree is
 * clean (Sn = lc(xn, X, Qe), Qe = shared-16 wu isWorkingTreeDirty — not the
 * branch stats, which keep the row visible after a commit); the reason exists
 * only while disabled and prBusy never comes from a commit turn. */
export function commitAction(status, { responding = false } = {}) {
  const dirty = status?.workingTreeDirty === true;
  const disabled = !dirty || responding;
  const disabledReason = !dirty ? COMMIT_CLEAN_REASON : responding ? COMMIT_RESPONDING_REASON : undefined;
  return { label: t("Commit"), text: COMMIT_TURN_TEXT, disabled, disabledReason };
}

/** cc70f2bdf-CILU7c4u.js Ko 2270-2385 + qo 2387-2394: the repo chip menu is
 * [open-in/reveal items] | [Copy path (+ Change directory…)] | [Open in terminal],
 * each non-empty group after the first starting with separatorBefore. The band
 * passes only cwd (git-status-card 4793 mr{cwd, …}, no branch), so the copy
 * group is the single "Copy path" row. Local capabilities: Finder reveal and
 * clipboard, and the terminal opener where the caller offers it (openTerminal);
 * there is no change-directory session ref, so that row stays absent. The reveal row is the shared reveal label
 * (c856385e2 wn → c18ab0d94 b(): "Show in Finder" on macOS, en-US LVY6c4L1SF). */
export function gitRepoMenuItems({ openFolder = true, copyPath = true, openTerminal = false } = {}) {
  // openTerminal: the last group's 'Open in terminal' (main.cjs open-terminal, the same opener as the sidebar's Open in).
  const groups = [openFolder ? [{ label: "Show in Finder" }] : [], copyPath ? [{ label: "Copy path" }] : [], openTerminal ? [{ label: "Open in terminal" }] : []];
  const items = [];
  for (const group of groups)
    group.forEach((item, index) => items.push(index === 0 && items.length > 0 ? { ...item, separatorBefore: true } : item));
  return items;
}

const basename = (value = "") => value.split("/").filter(Boolean).pop() || value;
const isCount = (value) => Number.isFinite(value) && value >= 0;

/** `Oe = prMode === "commit" || prMode === "none"`: local-only presentation. */
export function isLocalOnly(prMode) {
  return prMode === "commit" || prMode === "none";
}

/** Collapsed badge ($i/ea + Xa): counted changes, uncounted "Changes", or "No changes". */
export function railSignal(status) {
  if (!status?.isRepo) return null;
  const counted = isCount(status.added) && isCount(status.removed) && (status.added > 0 || status.removed > 0);
  if (counted) return { kind: "changes", added: status.added, removed: status.removed };
  return status.hasChanges ? { kind: "uncounted", text: t("Changes") } : { kind: "clean", text: t("No changes") };
}

/** rs(): behind is only meaningful for a live checkout on a branch other than
 * its base, with a positive behind count. The official tooltip message id
 * `xq0t4i` is absent from every shipped catalog, so the wording here is local. */
export function behindIndicator(comparison, branch) {
  if (!comparison || comparison.same || !comparison.base) return null;
  if (!branch || branch === comparison.base) return null;
  if (!isCount(comparison.behind) || comparison.behind <= 0) return null;
  const count = comparison.behind;
  return { count, base: comparison.base, tooltip: tn(count, "{count} commit behind {base}", "{count} commits behind {base}", { base: comparison.base }) };
}

/** Ii rail branch: `baseBranch: Oe || (c === undefined && A === j) ? undefined : A`. */
export function visibleBaseBranch({ prMode, prState, baseBranch, branch }) {
  if (isLocalOnly(prMode)) return undefined;
  if (prState === undefined && baseBranch === branch) return undefined;
  return baseBranch || undefined;
}

/** Facts group (na): Repository only with a PR link, Status only for PR states,
 * Base branch only when visible, Changes when counted. Gates/automation stay
 * empty without GitHub data. */
export function buildGitRailModel({ status, comparison = null, prMode = "commit", prState, hideRepo = false, prLink = null, responding = false }) {
  if (!status?.isRepo) return { visible: false, facts: [], gates: [], automation: [], signal: null, action: null };
  const repoName = status.repoName || basename(status.cwd);
  const branch = status.branch || status.head || "HEAD";
  const signal = railSignal(status);
  const behind = behindIndicator(comparison, status.detached ? null : status.branch);
  const baseBranch = visibleBaseBranch({ prMode, prState, baseBranch: comparison?.base, branch: status.branch });
  const facts = [];
  if (prLink && !hideRepo) facts.push({ key: "repository", label: t("Repository"), value: repoName });
  if (baseBranch) {
    facts.push({ key: "base", label: t("Base branch"), hint: t("A pull request from this branch merges into {branch}.", { branch: baseBranch }),
      hintDetail: behind?.tooltip, value: behind ? t("{branch} · {count} behind", { branch: baseBranch, count: behind.count }) : baseBranch });
  }
  if (signal?.kind === "changes") {
    facts.push({ key: "changes", label: t("Changes"), added: signal.added, removed: signal.removed, action: t("View changes"),
      hint: t("View changes"), hintDetail: baseBranch ? t("Lines added and removed compared with {branch}.", { branch: baseBranch }) : t("Lines added and removed on this branch.") });
  }
  const action = prMode === "commit" ? commitAction(status, { responding }) : null;
  return {
    visible: status.hasChanges === true,
    title: hideRepo ? branch : `${repoName} · ${branch}`,
    glyphLabel: t("Branch"),
    signal, behind, baseBranch, facts, gates: [], automation: [], action,
  };
}

/** Placeholder reservation (c936fcd42 Wi/Gi/Ki/qi): remembered px capped at
 * 360 with max(1, round(px / 28)) rows; otherwise 4 rows (5 with a PR) at
 * 28px each plus 4px gaps when this checkout showed a row before. */
export function railReservation({ remembered, checkoutHadRow = false, hasPr = false }) {
  if (Number.isFinite(remembered) && remembered > 0) {
    const heightPx = Math.min(Math.round(remembered), 360);
    return { heightPx, rows: Math.max(1, Math.round(heightPx / 28)), source: "memory" };
  }
  if (!checkoutHadRow) return { heightPx: 0, rows: 0, source: "none" };
  const rows = hasPr ? 5 : 4;
  return { heightPx: Math.min(rows * 28 + (rows - 1) * 4, 360), rows, source: "checkout" };
}

// Pull requests (git-status-card.js:4711 prMode 'create' for a repository with a GitHub origin; :4985-5020 the split
// button 'Create PR' / 'Create draft PR' / 'Manually create PR', approval-shared :10963-10980 compose mode). Create
// sends the agent a fixed turn, as Commit does; Manually create PR opens GitHub's compare page.
export const CREATE_PR_TURN_TEXT = "Push this branch to GitHub and open a pull request for it with `gh pr create`, with a clear title and a description of the changes.";
export const CREATE_DRAFT_PR_TURN_TEXT = "Push this branch to GitHub and open a draft pull request for it with `gh pr create --draft`, with a clear title and a description of the changes.";
const GITHUB_HOST = /^(?:www\.)?github\.com$/i;

/**
 * The band's pull request action for a session's checkout, or null when it doesn't apply (no GitHub origin, a
 * detached HEAD, or uncommitted changes, which Commit handles first).
 * @param {{status: object|null, identity: {host?: string, owner?: string, name?: string}|null, responding?: boolean}} input
 * @returns {{disabledReason?: string, manualUrl: string|null, manualDisabledReason?: string}|null}
 */
export function pullRequestAction({ status, identity, responding = false }) {
  if (!status?.isRepo || status.detached || !status.branch || status.workingTreeDirty) return null;
  if (!identity?.owner || !identity?.name || !GITHUB_HOST.test(String(identity.host ?? ""))) return null;
  const compared = status.comparison ?? null;
  const base = compared?.base || null;
  const disabledReason = compared?.same || (base && base === status.branch) ? t("Already on the base branch — check out a feature branch first")
    : compared?.ahead === 0 ? t("No changes to create a PR from")
    : responding ? COMMIT_RESPONDING_REASON : undefined;
  const pushed = Number.isFinite(compared?.unpushed);
  const manualUrl = base ? `https://github.com/${identity.owner.split("/").map(encodeURIComponent).join("/")}/${encodeURIComponent(identity.name)}/compare/${encodeURIComponent(base)}...${encodeURIComponent(status.branch)}?expand=1` : null;
  return { ...(disabledReason ? { disabledReason } : {}), manualUrl,
    ...(!pushed ? { manualDisabledReason: t("Branch hasn’t been pushed to GitHub") } : !manualUrl ? { manualDisabledReason: t("Add a GitHub remote to create a pull request") } : {}) };
}
