// File items of the Files pane menus (2.2553.1). Mn
// (ion-dist/assets/v1/c856385e2-k3utJqnh.js, prettier-formatted, :962-1060):
// "Attach as context" while a composer exists, the "Copy" submenu (Absolute
// path when resolved, Relative path unless the path is absolute, Filename),
// then the reveal item ("Show in Finder", c18ab0d94) with separatorBefore when
// there is no "Open in" submenu (kn :903-933). Tree rows use surface
// "file_browser" (readable/panes-tile-current.js:5691-5700 jc); file tabs use
// "file_tab" (l_ :6809-6862), whose extra "reveal" section — "Reveal in file
// tree", only for a path inside the working directory that is not missing —
// Gg (:6030-6048) renders after the items behind a separator.
// Pure: entries are {kind:"item"|"submenu"|"separator", ...}; the pane maps
// actions to handlers. "Open in" (no detected editors locally) and the
// directory "Open in terminal" section (no terminal pane) have no local target.
import { absoluteDiffPath, splitPosixPath, stripClipboardControls } from "./diff-file-header-model.mjs";
import { tabRelativePath } from "./file-tab-menu-model.mjs";
import { t } from "../electron/i18n/index.mjs";

export const FILE_MENU_LABELS = Object.freeze({
  attach: t("Attach as context"),
  copy: t("Copy"),
  absolutePath: t("Absolute path"),
  relativePath: t("Relative path"),
  filename: t("Filename"),
  showInFinder: t("Show in Finder"),
  revealInTree: t("Reveal in file tree"),
});
export const FILE_MENU_SURFACES = Object.freeze(["file_browser", "file_tab"]);

// Rg/zg (readable/panes-tile-current.js:5572-5588): the symlink mark's alt and
// the tree row tooltip detail; "Symbolic link" when the target is unknown.
const LINK_LABELS = Object.freeze({
  ok: t("Link to {target}"),
  external: t("Link to {target}, outside the working directory"),
  dangling: t("Broken link to {target}"),
  cycle: t("Circular link to {target}"),
});
export function fileLinkLabel(link) {
  const target = typeof link?.target === "string" ? link.target : "";
  return target !== "" && Object.hasOwn(LINK_LABELS, link?.state) ? LINK_LABELS[link.state].replace("{target}", target) : t("Symbolic link");
}

const isAbsolute = (value) => /^(?:\/|[A-Za-z]:[\\/]|~(?:$|[\\/]))/.test(value);

/** Copy values for one pane path: cwd-relative when inside the working directory. */
export function fileCopyChoices(root, path) {
  const relative = tabRelativePath(path, root);
  const absolute = absoluteDiffPath(root, relative);
  const filename = splitPosixPath((absolute ?? relative).replace(/\/+$/, ""))[1];
  return {
    absolute: absolute ?? null,
    relative: relative && !isAbsolute(relative) ? relative : null,
    filename,
  };
}

export function fileContextMenu({ surface = "file_browser", root, path, canAttach = false, canShowInFinder = false, canRevealInTree = false } = {}) {
  const choices = fileCopyChoices(root, path);
  const copy = (label, value) => value ? { kind: "item", action: "copy", label, value: stripClipboardControls(value) } : null;
  const entries = [];
  if (canAttach) entries.push({ kind: "item", action: "attach", label: FILE_MENU_LABELS.attach });
  entries.push({ kind: "submenu", label: FILE_MENU_LABELS.copy, items: [
    copy(FILE_MENU_LABELS.absolutePath, choices.absolute),
    copy(FILE_MENU_LABELS.relativePath, choices.relative),
    copy(FILE_MENU_LABELS.filename, choices.filename),
  ].filter(Boolean) });
  if (canShowInFinder && choices.absolute) entries.push({ kind: "separator" }, { kind: "item", action: "show-in-finder", label: FILE_MENU_LABELS.showInFinder, value: choices.absolute });
  if (surface === "file_tab" && canRevealInTree && choices.relative)
    entries.push({ kind: "separator" }, { kind: "item", action: "reveal-in-tree", label: FILE_MENU_LABELS.revealInTree, value: choices.relative });
  return entries;
}
