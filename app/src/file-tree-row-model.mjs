// B33 File tree polish: pure ports for the Files pane tree rows (reference 2.31226.0 cccc2cf0a-DHtZKTKW and
// ce9ca5630-BmDtcTP7; formatted extracts under analysis/code-ui-sync-20261013/readable/).

// cccc2cf0a rv/av (:3966-3984): expanding a folder also expands each folder below it that is the only entry of
// its parent, at most 16 levels. A failed read, more than one entry, a file or a symbolic link stops the chain.
export const SINGLE_CHILD_EXPAND_LIMIT = 16;
export async function singleChildFolderChain(path, list, limit = SINGLE_CHILD_EXPAND_LIMIT) {
  const chain = [];
  let current = path;
  while (chain.length < limit) {
    let entries;
    try { entries = await list(current); } catch { break; }
    const only = Array.isArray(entries) && entries.length === 1 ? entries[0] : undefined;
    if (!only?.directory || only.link !== undefined || only.symlink === true || typeof only.path !== "string") break;
    chain.push(only.path);
    current = only.path;
  }
  return chain;
}

// cd2efac6e Qo (:1579-1581), used as `P = ol(e)` by the cccc2cf0a My row: a row opens (and a folder toggles)
// only when it is not a link or its link resolves inside the working directory. Broken, circular and external
// links stay inert: aria-disabled, the muted name, not draggable, no open on click, middle click or Enter.
export function treeEntryOpenable(entry) {
  return !entry?.link || entry.link.state === "ok";
}

// ce9ca5630 i/a/s/g (:4-30): rows indent 8px + 8px per level; below the root each row paints one 1px guide per
// ancestor level (the border token every 8px), starting at the centre of the root's xs (12px) icon.
export const FILE_TREE_PAD = 8;
export const FILE_TREE_INDENT = 8;
const FILE_TREE_ICON_PX = 12;
export function fileTreeGuideStyle(level) {
  if (!Number.isInteger(level) || level <= 0) return {};
  return {
    "--file-tree-guides": `repeating-linear-gradient(to right, var(--cds-border) 0 1px, transparent 1px ${FILE_TREE_INDENT}px)`,
    backgroundPosition: `${FILE_TREE_PAD + FILE_TREE_ICON_PX / 2}px 0`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${level * FILE_TREE_INDENT}px 100%`,
  };
}

// cccc2cf0a My (:5655-5669): a row revealed by "Reveal in file tree" (not the follow reveal of the open file)
// scrolls into view and carries data-highlighted for 1200ms, once per reveal.
export const REVEAL_FLASH_MS = 1200;

// cccc2cf0a oy (:4978-4991) with c82eca2bd M (:46-62): Enter that opened a file from the tree hands focus to the
// file once Enter is released, unless focus moved somewhere other than the tree (or the body) by then. The
// listener is one-shot (keyup Enter, capture) and is dropped when the window loses focus.
export function onEnterReleased(tree, callback) {
  const document = tree?.ownerDocument, view = document?.defaultView;
  if (!view) return () => {};
  const controller = new AbortController();
  view.addEventListener("keyup", (event) => {
    if (event.key !== "Enter") return;
    controller.abort();
    const active = document.activeElement;
    if (!active || active === document.body || tree.contains(active)) callback();
  }, { capture: true, signal: controller.signal });
  view.addEventListener("blur", () => controller.abort(), { signal: controller.signal });
  return () => controller.abort();
}

// cccc2cf0a Db Oe (:7077) + c51596d2b ye/be (:84-150, the epitaxy_files_tree_nux NUX item pb :6300): the
// one-time "Browse the project beside your file" coachmark under the tree toggle shows while a file is open
// beside a hidden tree that can fit, outside pop-out windows, until it is accepted, closed or the tree is
// toggled any other way (c51596d2b Z: z(V) for every via except "coachmark").
export const FILE_TREE_NUX_ID = "epitaxy_files_tree_nux";
const NUX_STORAGE_KEY = `code-desktop-nux:${FILE_TREE_NUX_ID}`;
export function fileTreeCoachmarkEligible({ toggleShown, hasFile, canFit, treeVisible, popout = false }) {
  return !!toggleShown && !!hasFile && !!canFit && !treeVisible && !popout;
}
// shared-5 Sy (the NUX queue provider): no NUX shows during onboarding, nor while the account is under a day old
// (yy=864e5, measured from when the provider mounted; an account without created_at counts as new). Locally the
// account is the profile: config.activity.startedAt, stamped on the profile's first launch.
export const NUX_ACCOUNT_MIN_AGE_MS = 864e5;
export function nuxAccountAged(createdAt, now = Date.now()) {
  const created = typeof createdAt === "number" ? createdAt : Date.parse(createdAt ?? "");
  return Number.isFinite(created) && now - created >= NUX_ACCOUNT_MIN_AGE_MS;
}
export function fileTreeNuxDismissed(storage = globalThis.localStorage) {
  try { return storage?.getItem(NUX_STORAGE_KEY) != null; } catch { return false; }
}
export function dismissFileTreeNux(outcome = "closed", storage = globalThis.localStorage) {
  try { storage?.setItem(NUX_STORAGE_KEY, String(outcome)); } catch { /* optional preference */ }
}
