import { t, tn } from "../electron/i18n/index.mjs";

// Changes-pane diff scope, 2.2553.1 readable/panes-tile-current.js:2842-3117
// (Fm branch order, Im "Compare against" section, zm scope trigger + sections,
// Bm commit label) and panes-diff-states-current.js:340-357 (an unset scope, or
// an unavailable "uncommitted", resolves to he = {kind:"branch"}). Pure: plain
// data in, plain data out; the React trigger lives in source-diff-scope.jsx.

export const DEFAULT_DIFF_SCOPE = Object.freeze({ kind: "branch" });
export const UNCOMMITTED_DIFF_SCOPE = Object.freeze({ kind: "uncommitted" });
// zm Rm: at most 50 commit rows, then "{n} older commits not shown".
export const DIFF_SCOPE_COMMIT_LIMIT = 50;
// zm Lm, rendered by the label as an ArrowRight glyph with alt "to".
export const DIFF_SCOPE_ARROW = "→";
export const DIFF_SCOPE_LABELS = Object.freeze({
  workingTree: t("working tree"),
  to: t("to"),
  allChanges: t("All changes"),
  uncommitted: t("Uncommitted changes"),
  compareAgainst: t("Compare against"),
  searchBranches: t("Search branches"),
  branchesFailed: t("Couldn’t load branches"),
  noBranchesMatch: t("No branches match"),
  loadingBranches: t("Loading branches…"),
  defaultHint: t("default"),
  commits: t("Commits"),
  noMessage: t("(no message)"),
});

const SHA = /^[0-9a-f]{7,64}$/i;
export const isCommitSha = (value) => typeof value === "string" && SHA.test(value);

/** _s: two scopes are the same choice. */
export function sameDiffScope(left, right) {
  if (!left || !right || left.kind !== right.kind) return false;
  return left.kind !== "commit" || left.sha === right.sha;
}

/** Od R (panes-diff-states-current.js:351): no scope, or "uncommitted" while it is
 * unavailable, is the default branch scope. Local rule (zm returns null without a
 * base, and the HEAD diff is the only honest view then): with no resolvable base
 * every scope falls back to "uncommitted". */
export function resolveDiffScope(scope, { base, uncommittedAvailable = true } = {}) {
  if (!base) return UNCOMMITTED_DIFF_SCOPE;
  if (!scope || (scope.kind === "uncommitted" && !uncommittedAvailable)) return DEFAULT_DIFF_SCOPE;
  if (scope.kind === "commit") return isCommitSha(scope.sha) ? scope : DEFAULT_DIFF_SCOPE;
  return scope.kind === "uncommitted" ? UNCOMMITTED_DIFF_SCOPE : DEFAULT_DIFF_SCOPE;
}

/** The workspace-git-diff `scope` argument for a resolved scope. */
export function diffScopeParam(scope) {
  if (scope?.kind === "commit" && isCommitSha(scope.sha)) return `commit:${scope.sha}`;
  return scope?.kind === "uncommitted" ? "uncommitted" : "branch";
}

/** Bm: "{shortSha} {subject}" for a listed commit, else the 7-character sha. */
export function commitScopeLabel(sha, commits) {
  const commit = commits?.find((entry) => entry.sha === sha);
  return commit ? `${commit.shortSha} ${commit.subject}` : String(sha ?? "").slice(0, 7);
}

/** zm y / w: the branch label "{base} → {head ?? working tree}" (two truncating
 * spans around the ArrowRight), "Uncommitted changes", or the commit label; the
 * trigger is named "Diff scope: {label}". Null without a base (zm returns null). */
export function diffScopeTrigger(scope, { base, head, commits } = {}) {
  if (!base) return null;
  const target = head ?? DIFF_SCOPE_LABELS.workingTree;
  const label = scope?.kind === "uncommitted" ? DIFF_SCOPE_LABELS.uncommitted
    : scope?.kind === "commit" ? commitScopeLabel(scope.sha, commits)
    : `${base} ${DIFF_SCOPE_ARROW} ${target}`;
  return {
    label,
    ariaLabel: t("Diff scope: {label}", { label }),
    branch: scope?.kind === "commit" || scope?.kind === "uncommitted" ? null : { base, head: target },
  };
}

/** Fm: unique branches without the default and the current branch, sorted with
 * localeCompare, then the default (when known) first. */
export function compareAgainstBranches(branches, defaultBase, current) {
  const rest = [...new Set(branches || [])].filter((name) => name !== defaultBase && name !== current)
    .sort((left, right) => left.localeCompare(right));
  return defaultBase === undefined || defaultBase === null ? rest : [defaultBase, ...rest];
}

/** Im search-empty label: a load failure, a loaded list with no match, else loading. */
export function branchSearchEmptyLabel({ error = false, loaded = false, count = 0 } = {}) {
  if (error) return DIFF_SCOPE_LABELS.branchesFailed;
  return loaded && count > 0 ? DIFF_SCOPE_LABELS.noBranchesMatch : DIFF_SCOPE_LABELS.loadingBranches;
}

/** H (cd5e3435c): rows whose string label contains the lower-cased query. */
export function filterSearchItems(items, query) {
  const needle = String(query ?? "").toLowerCase();
  return (items || []).filter((item) => needle === "" || (typeof item.label === "string" && item.label.toLowerCase().includes(needle)));
}

const noop = () => {};
/** zm S + Im: [diff-scope] | [diff-base] | [diff-commits] menu sections.
 * - diff-scope: "All changes" (hint "vs {base}") and, when available,
 *   "Uncommitted changes", both radio rows.
 * - diff-base: the "Compare against" submenu (hint = the current base) over the
 *   Fm branch list with a "default" hint, searchable, with the Im empty labels.
 *   Picking the current base again does nothing unless it is an override of the
 *   default; picking another base also selects the branch scope.
 * - diff-commits: only with commits; up to 50 radio rows (subject or "(no
 *   message)", shortSha hint, checked only when the commit scope is listed),
 *   then a disabled "{n} older commit(s) not shown" row. n = zm m.length − 50
 *   over the whole base..HEAD list: `commitTotal` (workspace-git-commits
 *   `total`, which fetches only 51 rows) when known, else the rows given. */
export function diffScopeSections({
  scope = DEFAULT_DIFF_SCOPE, base, defaultBase, overridden = false, current, uncommittedAvailable = true,
  commits = [], commitTotal, branches = { list: [], loaded: false, error: false }, baseAvailable = true,
  onSelectScope = noop, onSelectBase = noop, onBaseMenuOpen = noop,
} = {}) {
  const sections = [{ key: "diff-scope", items: [
    { value: "branch", label: DIFF_SCOPE_LABELS.allChanges, hint: t("vs {base}", { base }), checked: scope.kind === "branch", checkedRole: "radio",
      onSelect: () => onSelectScope(DEFAULT_DIFF_SCOPE) },
    ...(uncommittedAvailable ? [{ value: "uncommitted", label: DIFF_SCOPE_LABELS.uncommitted, checked: scope.kind === "uncommitted",
      checkedRole: "radio", onSelect: () => onSelectScope(UNCOMMITTED_DIFF_SCOPE) }] : []),
  ] }];
  if (baseAvailable) {
    const list = branches?.list || [];
    const picked = overridden ? base : undefined;
    const names = compareAgainstBranches(picked === undefined ? list : [...list, picked], defaultBase, current);
    sections.push({ key: "diff-base", items: [{
      value: "diff-base", label: DIFF_SCOPE_LABELS.compareAgainst, hint: base,
      onOpenChange: (open) => { if (open) onBaseMenuOpen(); },
      searchLabel: DIFF_SCOPE_LABELS.searchBranches,
      searchEmptyLabel: branchSearchEmptyLabel({ error: !!branches?.error, loaded: !!branches?.loaded, count: list.length }),
      items: names.map((name) => ({
        value: `diff-base:${name}`, label: name, checked: name === base, checkedRole: "radio",
        hint: name === defaultBase ? DIFF_SCOPE_LABELS.defaultHint : undefined,
        onSelect: () => {
          if (name === base && (!overridden || name !== defaultBase)) return;
          onSelectBase(name === defaultBase ? null : name);
          onSelectScope(DEFAULT_DIFF_SCOPE);
        },
      })),
    }] });
  }
  if (commits?.length > 0) {
    const shown = commits.slice(0, DIFF_SCOPE_COMMIT_LIMIT);
    const listed = scope.kind === "commit" && shown.some((commit) => commit.sha === scope.sha) ? scope.sha : undefined;
    const total = Number.isSafeInteger(commitTotal) && commitTotal >= commits.length ? commitTotal : commits.length;
    const hidden = total - DIFF_SCOPE_COMMIT_LIMIT;
    sections.push({ key: "diff-commits", items: [{
      value: "commits", label: DIFF_SCOPE_LABELS.commits,
      items: [
        ...shown.map((commit) => ({
          value: commit.sha, label: commit.subject || DIFF_SCOPE_LABELS.noMessage, hint: commit.shortSha,
          checked: listed === undefined ? undefined : commit.sha === listed, checkedRole: "radio",
          onSelect: () => onSelectScope({ kind: "commit", sha: commit.sha }),
        })),
        ...(hidden > 0 ? [{ value: "more-commits", label: tn(hidden, "{count} older commit not shown", "{count} older commits not shown"), disabled: true, onSelect: noop }] : []),
      ],
    }] });
  }
  return sections;
}
