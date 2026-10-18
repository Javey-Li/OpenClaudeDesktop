import { t } from "../electron/i18n/index.mjs";

// Changes pane "Changed files" column model (2.2553.1). Pure: no React, no DOM.
// Sources (readable/):
// - panes-diff-view-current.js:2577-2586 di/fi (the test-path regex, ported exactly),
//   :3916-4036 Sa/Ca/wa/Ta/Ea/Da/Oa/ka (kind rules: generated > build > test > source),
//   Aa/ja/Ma (folder tree with single-child folder chains joined, flat list),
//   :4038-4096 Pa/Fa/Ia/La (collapsed folders, kind sections open while they hold the
//   active file), :4334-4411 Ga (tree keyboard rows), :4221-4223 za (section labels),
//   :472-501 Mn/Pn (file order: tree or list path order), :5221-5232 Qe (large diff).
// - tmp-shared-20-BrTrXIRV.js:9339-9372 kT/jT/MT/NT (numeric collator path compare;
//   folders first in tree order, files first in list order).
// - cf3dc7910-CGMuwDxG.js l = {DEFAULT 240, MIN 160, MAX 640} and b (rounded clamp);
//   panes-diff-view-current.js:5075 So = DEFAULT + 160 (treeHideBelowPx).
// "Filter" here is Mn's inclusion filter (_t/De: only listable files); the original
// column has no text filter field, so none is modelled.

export const DIFF_FILE_LIST_WIDTH = Object.freeze({ DEFAULT: 240, MIN: 160, MAX: 640 });
// So: the column fits only when the diff body is at least this wide.
export const DIFF_FILE_LIST_MIN_PANE = DIFF_FILE_LIST_WIDTH.DEFAULT + 160;
// Qe: additions + deletions above this collapse every file.
export const LARGE_DIFF_LINES = 5000;
export const DIFF_FILE_KINDS = Object.freeze(["test", "build", "generated"]);

export const DIFF_FILE_LIST_LABELS = Object.freeze({
  changedFiles: t("Changed files"),
  showFiles: t("Show files"),
  hideFiles: t("Hide files"),
  resize: t("Resize file list"),
  groupByFolder: t("Group files by folder"),
  groupByKind: t("Separate test, build, and generated files"),
  test: t("Test files"),
  build: t("Build files"),
  generated: t("Generated files"),
  largeBanner: t("Files are collapsed for large diffs. Select a file to expand it."),
  expandAllTooLarge: t("This diff is too large to expand at once. Select a file to expand it."),
  coachmark: t("Open the file list to see everything this diff touches and jump between files."),
});

// di (:2577-2583), ported exactly.
const TEST_PATH = new RegExp(
  [
    "(^|\\/)__(tests|snapshots)__\\/",
    "[._](test|spec)\\.[^/]+$",
    "(^|\\/)test_[^/]*\\.py$",
    "\\.snap$",
  ].join("|"),
);
// wa (:3918-3937).
const GENERATED_PATH = new RegExp(
  [
    "(^|\\/)(package-lock\\.json|npm-shrinkwrap\\.json|yarn\\.lock|pnpm-lock\\.yaml|bun\\.lockb?|Cargo\\.lock|Gemfile\\.lock|Podfile\\.lock|composer\\.lock|poetry\\.lock|uv\\.lock|Pipfile\\.lock|go\\.sum|flake\\.lock|pubspec\\.lock|mix\\.lock|packages\\.lock\\.json)$",
    "(^|\\/)(__generated__|generated|gen)\\/",
    "[._]gen(erated)?\\.[^/]+$",
    "\\.pb\\.(go|h|cc|ts|js)$",
    "\\.pb\\.gw\\.go$",
    "_pb2(_grpc)?\\.pyi?$",
    "_pb\\.(d\\.ts|js|ts)$",
    "\\.g\\.dart$",
    "\\.[Dd]esigner\\.cs$",
    "\\.min\\.(js|css)$",
    "\\.(js|css)\\.map$",
    "(^|\\/)(\\.next|\\.nuxt|\\.svelte-kit|\\.parcel-cache|__pycache__)\\/",
    "\\.(pyc|tsbuildinfo)$",
    "^dist\\/",
  ].join("|"),
);
// Ta (:3938-3945).
const BUILD_PATH = new RegExp(
  [
    "(^|\\/)BUILD(\\.bazel)?$",
    "(^|\\/)WORKSPACE(\\.bazel|\\.bzlmod)?$",
    "(^|\\/)MODULE\\.bazel(\\.lock)?$",
    "\\.bzl$",
  ].join("|"),
);
// Ea (:3946-3955).
const TEST_LIKE_PATH = new RegExp(
  [
    "\\.stories\\.[jt]sx?$",
    "(^|\\/)conftest\\.py$",
    "Tests?\\.(swift|kt|java)$",
    "_unittest\\.(cc|cpp)$",
    "(^|\\/|_)tests\\.rs$",
    "(^|\\/)(tests?|spec|__Snapshots__|e2e([-_]tests?)?)\\/",
  ].join("|"),
);

// fi
export function isTestPath(path) {
  return TEST_PATH.test(path);
}
// Da
export function diffFileKind(path) {
  return GENERATED_PATH.test(path) ? "generated"
    : BUILD_PATH.test(path) ? "build"
      : isTestPath(path) || TEST_LIKE_PATH.test(path) ? "test"
        : "source";
}
// Oa
export function groupFilesByKind(files) {
  const groups = { source: [], test: [], build: [], generated: [] };
  for (const file of files) groups[diffFileKind(file.filePath)].push(file);
  return groups;
}
// ka (Ca = source then Sa).
export function orderFilesByKind(files) {
  const groups = groupFilesByKind(files);
  return ["source", ...DIFF_FILE_KINDS].flatMap((kind) => groups[kind]);
}

// kT/OT: numeric collator, code-unit tie break.
let collator = null;
function compareSegment(a, b) {
  if (a === b) return 0;
  collator ??= new Intl.Collator(undefined, { numeric: true });
  return collator.compare(a, b) || (a < b ? -1 : 1);
}
// NT: segment by segment; at the first level where one side is a file and the
// other a folder, `fileSide` (1 = files after folders, -1 = files first) decides.
function comparePaths(a, b, fileSide) {
  let i = 0, j = 0;
  for (;;) {
    const x = a.indexOf("/", i), y = b.indexOf("/", j);
    const aLast = x === -1, bLast = y === -1;
    if (aLast !== bLast) return aLast ? fileSide : -fileSide;
    const order = compareSegment(aLast ? a.slice(i) : a.slice(i, x), bLast ? b.slice(j) : b.slice(j, y));
    if (order !== 0 || aLast) return order;
    i = x + 1; j = y + 1;
  }
}
// jT (tree order) / MT (list order).
export const compareTreePaths = (a, b) => comparePaths(a, b, 1);
export const compareListPaths = (a, b) => comparePaths(a, b, -1);
// Pn: "… " truncation placeholders sort last.
const placeholder = (path) => path.startsWith("… ");
export function compareDiffPaths(a, b, mode = "tree") {
  const pa = placeholder(a), pb = placeholder(b);
  if (pa !== pb) return pa ? 1 : -1;
  return mode === "tree" ? compareTreePaths(a, b) : compareListPaths(a, b);
}

// Mn inclusion filter, local shape: a parsed diff-model file section is listable
// when it has a path (pathless parser fallbacks and raw sections stay body-only).
// Counts are the file's own +/-; a parser fallback (null counts) lists none.
export function diffFileEntries(sections) {
  const entries = [];
  const seen = new Set();
  for (const section of sections ?? []) {
    if (section?.type !== "file" || typeof section.path !== "string" || !section.path || seen.has(section.path)) continue;
    seen.add(section.path);
    const counted = Number.isFinite(section.added) && Number.isFinite(section.removed);
    entries.push({
      filePath: section.path,
      additions: counted ? section.added : null,
      deletions: counted ? section.removed : null,
      status: section.status ?? "modified",
      removed: section.status === "deleted",
    });
  }
  return entries;
}

// Mn sort + ka: the order both the column and the diff body use.
export function orderDiffFiles(entries, { tree = true, groupByKind = false } = {}) {
  const sorted = [...entries].sort((a, b) => compareDiffPaths(a.filePath, b.filePath, tree ? "tree" : "list"));
  return groupByKind ? orderFilesByKind(sorted) : sorted;
}
// Body sections reordered to the file order; sections that are not listable
// (raw patch text, pathless fallbacks, duplicate paths) keep their relative
// order after the listed files.
export function orderDiffSections(sections, options) {
  const list = sections ?? [];
  const order = orderDiffFiles(diffFileEntries(list), options).map((entry) => entry.filePath);
  const rank = new Map(order.map((path, index) => [path, index]));
  const listed = [], rest = [], placed = new Set();
  for (const section of list) {
    const path = section?.type === "file" ? section.path : null;
    if (path && rank.has(path) && !placed.has(path)) { listed.push(section); placed.add(path); } else rest.push(section);
  }
  listed.sort((a, b) => rank.get(a.path) - rank.get(b.path));
  return [...listed, ...rest];
}

const fileNode = (entry) => ({
  kind: "file",
  name: entry.filePath.slice(entry.filePath.lastIndexOf("/") + 1),
  path: entry.filePath,
  additions: entry.additions,
  deletions: entry.deletions,
  removed: entry.removed,
});
// Ma: a folder whose only child is a folder joins it ("a/b").
function compactFolders(nodes) {
  return nodes.map((node) => {
    if (node.kind !== "dir") return node;
    const children = compactFolders(node.children);
    if (children.length === 1 && children[0].kind === "dir") {
      const only = children[0];
      return { kind: "dir", name: `${node.name}/${only.name}`, path: only.path, children: only.children };
    }
    return { ...node, children };
  });
}
// Aa: group by folder, in input order.
export function diffFileTree(entries) {
  const root = [];
  const folders = new Map([["", root]]);
  for (const entry of entries) {
    const parts = entry.filePath.split("/");
    parts.pop();
    let prefix = "", level = root;
    for (const part of parts) {
      const path = prefix ? `${prefix}/${part}` : part;
      let children = folders.get(path);
      if (!children) {
        children = [];
        folders.set(path, children);
        level.push({ kind: "dir", name: part, path, children });
      }
      prefix = path;
      level = children;
    }
    level.push(fileNode(entry));
  }
  return compactFolders(root);
}
// ja: flat rows (the row shows the folder prefix itself).
export function diffFileFlat(entries) {
  return entries.map(fileNode);
}

// Ra/Ba: the column's top-level rows and the separated kind sections.
export function diffFileList(entries, { tree = true, groupByKind = false } = {}) {
  const files = orderDiffFiles(entries, { tree, groupByKind });
  const groups = groupByKind ? groupFilesByKind(files) : null;
  const source = groups ? groups.source : files;
  const build = (list) => (tree ? diffFileTree(list) : diffFileFlat(list));
  const nodes = build(source);
  const sections = groups
    ? DIFF_FILE_KINDS.filter((kind) => groups[kind].length > 0).map((kind, index) => ({
      kind,
      label: DIFF_FILE_LIST_LABELS[kind],
      count: groups[kind].length,
      paths: groups[kind].map((entry) => entry.filePath),
      nodes: build(groups[kind]),
      separated: index > 0 || nodes.length > 0,
    }))
    : [];
  return { files, nodes, sections };
}

// Ze/Qe: the summed +/- of every listed file; null counts add nothing.
export function diffTotals(entries) {
  let additions = 0, deletions = 0;
  for (const entry of entries ?? []) {
    if (Number.isFinite(entry.additions)) additions += entry.additions;
    if (Number.isFinite(entry.deletions)) deletions += entry.deletions;
  }
  return { additions, deletions };
}
export function isLargeDiff(entries) {
  const { additions, deletions } = diffTotals(entries);
  return additions + deletions > LARGE_DIFF_LINES;
}

// La: selecting a file re-opens every collapsed folder above it.
export function revealCollapsed(collapsed, path) {
  if (path === null || path === undefined) return collapsed;
  let next = null;
  for (const folder of collapsed) if (path.startsWith(`${folder}/`)) { next ??= new Set(collapsed); next.delete(folder); }
  return next ?? collapsed;
}
export function toggleCollapsed(collapsed, path) {
  const next = new Set(collapsed);
  if (next.has(path)) next.delete(path); else next.add(path);
  return next;
}
// Ia/Ba: a kind section is open by default only while it holds the active file;
// after the user toggles it that choice stays, until a newly selected file inside
// it opens it again (openKindSections).
export function kindSectionOpen(stored, holdsActive) {
  return stored === undefined ? holdsActive : stored;
}
export function openKindSections(stored, sections, activePath) {
  if (activePath === null || activePath === undefined) return stored;
  const section = sections.find((entry) => entry.paths.includes(activePath));
  return !section || stored[section.kind] === true ? stored : { ...stored, [section.kind]: true };
}

// Ga row navigation: the index to focus for a key, from the focused row index
// (-1 when the tree itself has focus; then the current row, else the first).
export function treeRowTarget(key, { index, count, currentIndex = -1 }) {
  if (count <= 0) return null;
  const start = currentIndex >= 0 ? currentIndex : 0;
  switch (key) {
    case "ArrowDown": return index < 0 ? start : Math.min(index + 1, count - 1);
    case "ArrowUp": return index < 0 ? start : Math.max(index - 1, 0);
    case "Home": return 0;
    case "End": return count - 1;
    default: return null;
  }
}

// b: a stored width is rounded and clamped; anything else is the default.
export function clampDiffFileListWidth(value, fallback = DIFF_FILE_LIST_WIDTH.DEFAULT) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(DIFF_FILE_LIST_WIDTH.MAX, Math.max(DIFF_FILE_LIST_WIDTH.MIN, Math.round(value)))
    : fallback;
}
// The width the column can take in a body `paneWidth` wide (columnStyle
// maxWidth min(640px, 100% - 160px), never below MIN).
export function diffFileListLimit(paneWidth) {
  return Math.max(DIFF_FILE_LIST_WIDTH.MIN, Math.min(DIFF_FILE_LIST_WIDTH.MAX, (paneWidth || 0) - 160));
}
// uh/Nt: unmeasured (0) counts as fitting, like diffCanFitTree ?? true.
export function diffFileListCanFit(paneWidth) {
  return !(paneWidth > 0) || paneWidth >= DIFF_FILE_LIST_MIN_PANE;
}
