// Command palette model (pure): the ⌘K / ⇧⌘K overlay the sidebar Search button opens, after 2.2553.1
// c2771e1f6-v15xXKAc.js vm (CommandPaletteBody) inside shared-22 XP. Modes are its entrypoints: "default"
// (Quick actions + Recents; typing adds the 'New session “…”' send row), "search" (sessions and projects with
// the Pu type tabs and the date filter) and "actions" (Tab: Settings → / Customize → rows and app commands).
import { folderName, sessionArchived, sessionName, sessionUpdatedAt } from "./sidebar-model.js";
import { t } from "../electron/i18n/index.mjs";

export const PALETTE_MODES = Object.freeze(["default", "search", "actions"]);
// wu: type options (the code list's Sessions and Projects; this app has no searchable chats, tasks or
// artifacts) and the active-date options.
export const PALETTE_TYPES = Object.freeze([["session", "Sessions"], ["project", "Projects"]]);
export const PALETTE_DATES = Object.freeze([["today", "Today"], ["week", "Past week"], ["month", "Past month"]]);
export const EMPTY_PALETTE_FILTERS = Object.freeze({ type: null, date: null });
// Recents in the default view (Cd keeps a handful of rows under the Quick actions group).
export const PALETTE_RECENTS = 8;
const DAY = 24 * 60 * 60 * 1000;

export function paletteMode(value) {
  return value === "search" || value === "actions" ? value : "default";
}

/** vm Bn/En: the input's placeholder and accessible name for a mode (code list: k true). */
export function palettePlaceholder(mode) {
  if (mode === "search") return t("Search sessions and projects");
  if (mode === "actions") return t("Search actions");
  return t("Search or start a session");
}

/** Xu: the relative time a result row shows (null past a year). */
export function paletteRelativeTime(ms, now = Date.now()) {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const minutes = (now - ms) / 60000, start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (minutes < 5) return t("Just now");
  if (minutes < 60) return t("Past hour");
  if (ms >= start.getTime()) return t("Today");
  if (ms >= start.getTime() - DAY) return t("Yesterday");
  const days = (now - ms) / DAY;
  if (days < 7) return t("Past week");
  if (days < 30) return t("Past month");
  if (days < 365) return t("Past year");
  return null;
}

/** The active filter (today / past week / past month) as a lower time bound. */
export function paletteDateFloor(date, now = Date.now()) {
  if (date === "today") { const start = new Date(now); start.setHours(0, 0, 0, 0); return start.getTime(); }
  if (date === "week") return now - 7 * DAY;
  if (date === "month") return now - 30 * DAY;
  return null;
}

export function hasPaletteFilters(filters = EMPTY_PALETTE_FILTERS) {
  return filters.type !== null || filters.date !== null;
}

/** Ranges of `query` (case-insensitive, every occurrence) inside `text`, for the bold match highlight (ra). */
export function matchRanges(text, query) {
  const needle = String(query || "").trim().toLowerCase(), hay = String(text || "").toLowerCase();
  if (!needle) return [];
  const ranges = [];
  for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + needle.length)) ranges.push([at, at + needle.length]);
  return ranges;
}

const matches = (text, query) => String(text || "").toLowerCase().includes(query);

/**
 * Session results: newest first; a title match or a core's full-text match (contentMatches, a Set of ids).
 * The default view leaves archived sessions out; search lists them with the Archived badge (sd).
 */
export function paletteSessions({ sessions = [], query = "", contentMatches = null, filters = EMPTY_PALETTE_FILTERS, includeArchived = false, now = Date.now(), limit = Infinity } = {}) {
  const needle = query.trim().toLowerCase(), floor = paletteDateFloor(filters.date, now);
  return sessions
    .filter((session) => includeArchived || !sessionArchived(session))
    .filter((session) => !needle || matches(sessionName(session), needle) || contentMatches?.has?.(session.id))
    .filter((session) => floor === null || sessionUpdatedAt(session) >= floor)
    .sort((a, b) => sessionUpdatedAt(b) - sessionUpdatedAt(a))
    .slice(0, limit);
}

/** Project results: the folders the sidebar knows, by name or path, with their latest activity. */
export function paletteProjects({ folders = [], sessions = [], query = "", filters = EMPTY_PALETTE_FILTERS, now = Date.now() } = {}) {
  const needle = query.trim().toLowerCase(), floor = paletteDateFloor(filters.date, now), latest = new Map();
  for (const session of sessions) if (session.cwd) latest.set(session.cwd, Math.max(latest.get(session.cwd) || 0, sessionUpdatedAt(session)));
  return [...new Set(folders.filter((cwd) => typeof cwd === "string" && cwd))]
    .filter((cwd) => !needle || matches(folderName(cwd), needle) || matches(cwd, needle))
    .filter((cwd) => floor === null || (latest.get(cwd) || 0) >= floor)
    .map((cwd) => ({ cwd, name: folderName(cwd), updatedAt: latest.get(cwd) || 0 }))
    .sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
}

// c2771e1f6 :9634-10079 'Settings → {section}' / 'Customize → {section}' rows for the local Settings sections
// (source-settings.jsx tabs; Usage is nav-hidden there but listed here, as Settings search lists it).
export const PALETTE_SETTINGS_SECTIONS = Object.freeze([
  ["preferences", "Preferences", "Settings"], ["theme", "Theme", "Palette"], ["usage", "Usage", "UsageGaugeMiddle"], ["code", "Code", "Code"],
  ["instructions", "Instructions", "BookText"], ["commands", "Commands", "SlashShortcutCommand"], ["profiles", "Profiles", "Tool"],
  ["models", "Models", "Lightning"], ["general", "General", "Computer"], ["developer", "Developer", "Wrench"], ["cores", "Cores", "Box"],
  ["harness", "Harness", "CommandLine"],
]);
export const PALETTE_CUSTOMIZE_SECTIONS = Object.freeze([
  ["customize-skills", "Skills", "Scroll"], ["customize-connectors", "Connectors", "Connectors"], ["customize-plugins", "Plugins", "Plugin"],
  ["customize-hooks", "Hooks", "CommandLine"],
]);

/**
 * Action rows ({id, label, icon, shortcut?, run}) from what the host can do: new session, the sidebar
 * sections, the sidebar toggle and the Settings / Customize sections.
 */
export function paletteActions({ onNew, setSection, onToggleSidebar, onOpenSettings } = {}) {
  const rows = [];
  if (onNew) rows.push({ id: "new-session", label: t("New session"), icon: "Add", shortcut: "⌘N", run: onNew });
  if (setSection) {
    rows.push({ id: "artifacts", label: t("Artifacts"), icon: "Artifacts", run: () => setSection("artifacts") });
    rows.push({ id: "routines", label: t("Routines"), icon: "Clock", run: () => setSection("routines") });
  }
  if (onToggleSidebar) rows.push({ id: "toggle-sidebar", label: t("Toggle sidebar"), icon: "Sidebar", shortcut: "⌘B", run: onToggleSidebar });
  if (onOpenSettings) {
    rows.push({ id: "settings", label: t("Settings"), icon: "Settings", shortcut: "⌘,", run: () => onOpenSettings(true) });
    for (const [id, label, icon] of PALETTE_SETTINGS_SECTIONS) rows.push({ id: `settings:${id}`, label: t("Settings → {section}", { section: t(label) }), icon, run: () => onOpenSettings(id) });
    for (const [id, label, icon] of PALETTE_CUSTOMIZE_SECTIONS) rows.push({ id: `settings:${id}`, label: t("Customize → {section}", { section: t(label) }), icon, run: () => onOpenSettings(id) });
  }
  return rows;
}

export function filterPaletteActions(actions, query = "") {
  const needle = query.trim().toLowerCase();
  return needle ? actions.filter((action) => action.label.toLowerCase().includes(needle)) : actions;
}

/** Selection movement over a flat list (wraps; -1 enters at the first or last row). */
export function movePaletteSelection(index, count, key) {
  if (count <= 0) return -1;
  if (key === "ArrowDown") return index < 0 ? 0 : (index + 1) % count;
  if (key === "ArrowUp") return index < 0 ? count - 1 : (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return index;
}

/** Pu ←/→: the next type tab (All, then each type), wrapping. */
export function stepPaletteType(type, direction) {
  const values = [null, ...PALETTE_TYPES.map(([value]) => value)];
  const at = Math.max(0, values.indexOf(type));
  return values[(at + direction + values.length) % values.length];
}
