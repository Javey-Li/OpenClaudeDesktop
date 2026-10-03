// Composer folder picker (2.2553.1 cc43287c9-BMbiZYzF.js:21638-21850 lH,
// :21863-22005 dH) over the recent-folder list of c749529a1-BaBwa-p0.js.
// - S (dh): a folder's recency is the latest activity (updatedAt, else
//   createdAt) of the sessions that ran in it; most recent first; a dismissed
//   folder stays hidden until a session is created there after the dismissal
//   (x); session-backed folders first; at most 8 (_ = 8).
// - dH: the chosen folder is prepended when it is not already listed.
// - lH: label = basename (Mr); the parent directory (DT) becomes the row
//   description only when two listed folders share a basename; the current
//   folder is the checked radio and is never dismissible.
// Locally there are no detected projects, so every row is session-backed or
// the current folder. Dismissals are {path: dismissedAt ms} from the main
// process config (the source keeps them in localStorage
// "ccd-dismissed-recent-folders-v1").

export const RECENT_FOLDER_LIMIT = 8;

/** Mr: the last path segment (a bare "/" stays "/"). */
export function folderBasename(path = "") {
  const parts = String(path).split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : String(path);
}

/** DT: everything before the last "/" or "\\", or null at the root. */
export function parentDirectory(path = "") {
  const value = String(path);
  const at = Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\"));
  return at > 0 ? value.slice(0, at) : null;
}

// Thread timestamps are seconds (Codex) or milliseconds; compare in ms.
function ms(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value < 1e12 ? value * 1000 : value;
  if (typeof value === "string") { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : 0; }
  return 0;
}

/** S + the dH prepend: [{path}] ordered for the Recent group. */
export function recentFolders({ sessions = [], current = "", dismissedAt = {}, limit = RECENT_FOLDER_LIMIT } = {}) {
  const activity = new Map(), created = new Map();
  for (const session of sessions) {
    const path = typeof session?.cwd === "string" ? session.cwd : "";
    if (!path) continue;
    const last = ms(session.updatedAt ?? session.createdAt), born = ms(session.createdAt);
    activity.set(path, Math.max(activity.get(path) ?? 0, last));
    created.set(path, Math.max(created.get(path) ?? 0, born));
  }
  const dismissed = dismissedAt && typeof dismissedAt === "object" ? dismissedAt : {};
  const list = [...activity.entries()]
    .sort(([, left], [, right]) => right - left)
    .filter(([path]) => {
      const at = Number(dismissed[path]);
      return !Number.isFinite(at) || (created.get(path) ?? 0) > at;
    })
    .slice(0, limit)
    .map(([path]) => ({ path }));
  return current && !list.some((entry) => entry.path === current) ? [{ path: current }, ...list] : list;
}

/** lH rows: label, collision description, radio state and dismissibility. */
export function recentFolderRows(list = [], current = "") {
  const counts = new Map();
  for (const { path } of list) { const name = folderBasename(path); counts.set(name, (counts.get(name) ?? 0) + 1); }
  return list.map(({ path }) => {
    const label = folderBasename(path), parent = parentDirectory(path), isCurrent = path === current;
    return { path, label, description: parent && counts.get(label) > 1 ? parent : undefined, checked: isCurrent, dismissible: !isCurrent };
  });
}

/** lH b: no folder chosen and nothing recent, so the chip browses directly instead of opening the menu. */
export function folderPickerBrowsesDirectly(list = []) {
  return list.length === 0;
}
