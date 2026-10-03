// Classic Code sidebar branch: desktop-sidebar.js xF/SF, Ck, rA/oA.
// Keep this model free of UI/browser state so Codex records remain the source.
import { hasPendingApproval, latestTurnError } from "./state.js";
import { t, tn } from "../electron/i18n/index.mjs";
export const CLASSIC_GROUP_OPTIONS = Object.freeze([
  ["date", "Date"],
  ["project", "Folder"],
  ["state", "State"],
  ["custom", "Custom groups"],
  ["none", "None"],
]);
export const CLASSIC_SORT_OPTIONS = Object.freeze([
  ["alpha", "Name"],
  ["created", "Date created"],
  ["recency", "Last activity"],
]);
export const CLASSIC_STATUS_OPTIONS = Object.freeze([
  ["active", "Active"],
  ["archived", "Archived"],
  ["all", "All"],
]);
export const DEFAULT_SIDEBAR_PREFERENCES = Object.freeze({
  groupBy: "project",
  sortBy: "recency",
  status: "active",
  stateActivityDays: 7,
  showEmptyGroups: false,
  collapsedNested: [],
});

export function normalizeSidebarPreferences(value = {}) {
  const option = (key, options) => options.some(([v]) => v === value[key])
    ? value[key] : DEFAULT_SIDEBAR_PREFERENCES[key];
  return {
    groupBy: option("groupBy", CLASSIC_GROUP_OPTIONS),
    sortBy: option("sortBy", CLASSIC_SORT_OPTIONS),
    status: option("status", CLASSIC_STATUS_OPTIONS),
    stateActivityDays: [0, 1, 3, 7, 30].includes(value.stateActivityDays)
      ? value.stateActivityDays : 7,
    showEmptyGroups: value.showEmptyGroups === true,
    // sidebar-groups vc().keys: folded nested heads persist as parent ids.
    collapsedNested: Array.isArray(value.collapsedNested)
      ? [...new Set(value.collapsedNested.filter((id) => typeof id === "string" && id))] : [],
  };
}

export function sessionName(session) {
  return session.name?.trim() || session.preview?.trim() || t("New session");
}

export function folderName(path) {
  return path?.replace(/[/\\]+$/, "").split(/[/\\]/).filter(Boolean).at(-1)
    || path || t("Sessions");
}

export function timestampMs(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 100000000000 ? value * 1000 : value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function sessionUpdatedAt(session) {
  return timestampMs(session.updatedAt ?? session.updatedAtMs ?? session.timestamp);
}

export function sessionArchived(session) {
  return session.archived === true || session.isArchived === true;
}

// Code classic has four buckets. The five ready/idle buckets elsewhere in the
// bundle belong to the combined Cowork list and must not leak into this branch.
export const CLASSIC_STATE_OPTIONS = Object.freeze([
  ["blocked", "Needs input"],
  ["review", "Ready for review"],
  ["working", "Working"],
  ["done", "Completed"],
]);

export function sessionState(session, state = {}) {
  if (sessionArchived(session)) return "done";
  // A sub-agent's approval belongs to the session that owns it (state.js
  // hasPendingApproval): the sub-agent thread itself is never a sidebar row.
  const hasApproval = hasPendingApproval(state, session.id);
  // A failed latest turn (state.turnErrors) keeps the pre-turn-card meaning.
  if (hasApproval || state.errors?.[session.id] || latestTurnError(state, session.id) || session.hasError) return "blocked";
  if (state.active?.[session.id] || session.status?.type === "active" || session.liveStatus === "running") return "working";
  if (["open", "draft", "approved", "changesRequested", "conflicting"].includes(session.prState)) return "review";
  return "done";
}

export function hasSidebarFilters(preferences) {
  const p = normalizeSidebarPreferences(preferences);
  return p.status !== "active" || (p.groupBy === "state" && p.stateActivityDays !== 7)
    || (["project", "custom"].includes(p.groupBy) && p.showEmptyGroups);
}

export function clearSidebarFilters(preferences) {
  return { ...normalizeSidebarPreferences(preferences), status: "active", stateActivityDays: 7, showEmptyGroups: false };
}

/** sidebar-groups.js:21843-21847 OU, the Code list's "Show all sessions"
 * (handleShowAllCodeSessions He at :21497-21507): status "all", environments
 * cleared (no local environment filter) and activity days 0 when
 * codeCutsByAge (bH at :20896, groupBy "state"). Deliberately not
 * clearSidebarFilters, which mirrors the filter menu's "Clear filters"
 * (sidebar-main.js:12802-12811, "active" + 7 days). */
export function showAllSessionsPreferences(preferences) {
  const p = normalizeSidebarPreferences(preferences);
  return { ...p, status: "all", ...(p.groupBy === "state" ? { stateActivityDays: 0 } : {}) };
}

/** sidebar-groups.js:7600-7609 fO, the empty-state hasNonDefaultFilter:
 * status "archived", or activity days in (0,7) under codeCutsByAge, or an
 * environment selection (none locally). Status "all", 30d/All days and
 * showEmptyGroups do not count, unlike hasSidebarFilters (filter badge). */
export function sidebarEmptyHasNonDefaultFilter(preferences) {
  const p = normalizeSidebarPreferences(preferences);
  return p.status === "archived" || (p.groupBy === "state" && p.stateActivityDays > 0 && p.stateActivityDays < 7);
}

/** sidebar-groups.js:7700-7705 CO + wO: no empty state while any row is
 * visible; otherwise "filtered" when rows exist behind the filters, a
 * non-default filter is set, or archived sessions exist, else "no-sessions". */
export function sidebarEmptyVariant({ visible = 0, total = 0, hasNonDefaultFilter = false, hasArchived = false } = {}) {
  if (visible > 0) return undefined;
  const variant = total > 0 || hasNonDefaultFilter ? "filtered" : "no-sessions";
  return variant === "no-sessions" && hasArchived ? "filtered" : variant;
}

export function compareSessions(sortBy = "recency", locale) {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
  return (a, b) => {
    if (sortBy === "alpha") {
      const byName = collator.compare(sessionName(a), sessionName(b));
      if (byName) return byName;
    }
    if (sortBy === "created") {
      const byCreated = timestampMs(b.createdAt ?? b.createdAtMs) - timestampMs(a.createdAt ?? a.createdAtMs);
      if (byCreated) return byCreated;
    }
    return sessionUpdatedAt(b) - sessionUpdatedAt(a) || String(a.id).localeCompare(String(b.id));
  };
}

export function localDayBoundaries(now = Date.now(), days = 7) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - index);
    return date.getTime();
  });
}

/**
 * Returns [{key,label,sessions,cwd?,customGroupId?,projectKey?,kind}]. A session appears once.
 * metadata is local persisted UI state, never a fabricated Codex thread status.
 * repoIdentities: cwd -> {isRepo, toplevel, owner, name, parent} | null (main.cjs repo-identities);
 * projectOrder: the persisted section order (project keys and "ccg::" custom group keys).
 */
export function buildSidebarGroups({
  sessions = [], preferences, metadata = {}, customGroups = [], knownFolders = [],
  state = {}, search = "", fallbackCwd = "", now = Date.now(), locale, pinnedOrder = [],
  repoIdentities = {}, projectOrder = [],
} = {}) {
  const prefs = normalizeSidebarPreferences(preferences);
  const query = search.trim().toLocaleLowerCase(locale);
  const compare = compareSessions(prefs.sortBy, locale);
  const seen = new Set();
  const list = sessions.filter((session) => {
    if (!session?.id || seen.has(session.id)) return false;
    seen.add(session.id);
    if (prefs.status === "active" && sessionArchived(session)) return false;
    if (prefs.status === "archived" && !sessionArchived(session)) return false;
    if (query && !sessionName(session).toLocaleLowerCase(locale).includes(query)) return false;
    const time = sessionUpdatedAt(session);
    if (prefs.groupBy === "state" && prefs.stateActivityDays > 0 && time
      && !metadata[session.id]?.pinned && now - time > prefs.stateActivityDays * 86400000) return false;
    return true;
  }).sort(compare);
  const pinned = orderPinned(list.filter((session) => metadata[session.id]?.pinned), pinnedOrder);
  const rest = list.filter((session) => !metadata[session.id]?.pinned);
  const output = pinned.length ? [{ key: "pinned", label: t("Pinned"), sessions: pinned, kind: "pinned" }] : [];
  if (prefs.groupBy === "none") {
    if (rest.length) output.push({ key: "sessions", label: prefs.status === "archived" ? t("Archived") : t("Sessions"), sessions: rest, kind: "none" });
    return output;
  }
  if (prefs.groupBy === "date") {
    const days = localDayBoundaries(now);
    const buckets = Array.from({ length: 8 }, () => []);
    for (const session of rest) {
      const at = days.findIndex((boundary) => sessionUpdatedAt(session) >= boundary);
      buckets[at < 0 ? 7 : at].push(session);
    }
    buckets.forEach((bucket, index) => {
      if (!bucket.length) return;
      const label = index === 0 ? t("Today") : index === 1 ? t("Yesterday") : index === 7 ? t("Older")
        : new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(days[index]);
      output.push({ key: index === 7 ? "older" : `day-${index}`, label, sessions: bucket, kind: "date" });
    });
    return output;
  }
  if (prefs.groupBy === "state") {
    for (const [key, label] of CLASSIC_STATE_OPTIONS) {
      const bucket = rest.filter((session) => sessionState(session, state) === key);
      if (bucket.length) output.push({ key: `state-${key}`, label: t(label), sessions: bucket, kind: "state" });
    }
    return output;
  }
  if (prefs.groupBy === "custom") {
    const assigned = new Set();
    for (const group of orderCustomGroups(customGroups, projectOrder)) {
      if (!group?.id || !group.name) continue;
      const bucket = rest.filter((session) => metadata[session.id]?.customGroupId === group.id);
      bucket.forEach((session) => assigned.add(session.id));
      if (bucket.length || (prefs.showEmptyGroups && !query)) output.push({
        key: `custom:${group.id}`, label: group.name, customGroupId: group.id,
        sessions: bucket, kind: "custom", cwd: group.cwd,
      });
    }
    const ungrouped = rest.filter((session) => !assigned.has(session.id));
    if (ungrouped.length) output.push({ key: "custom-ungrouped", label: t("Ungrouped"), sessions: ungrouped, kind: "custom" });
    return output;
  }
  // sidebar-groups.js:19580-19592: a project bucket per repo identity (IJ, sidebar-session.js:20892-20903),
  // sessions without one in the `__no_project__` bucket appended last (:19640-19650, label otherProjects
  // 'Other'). An identity still resolving (repoIdentities has no entry) keys on the cwd, as before.
  const folders = new Map(), other = [];
  const bucketFor = (cwd) => {
    const identity = cwd ? repoIdentities?.[cwd] : null;
    const key = projectKey(cwd, identity);
    if (key === OTHER_PROJECT_KEY) return null;
    if (!folders.has(key)) folders.set(key, { key, cwd, identity, sessions: [] });
    return folders.get(key);
  };
  for (const session of rest) {
    const bucket = bucketFor(session.cwd || fallbackCwd);
    if (bucket) bucket.sessions.push(session); else other.push(session);
  }
  if (prefs.showEmptyGroups && !query) for (const cwd of knownFolders) if (cwd) bucketFor(cwd);
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
  const named = [...folders.values()].map((bucket) => ({ ...bucket, name: projectName(bucket.cwd, bucket.identity) }));
  // BJ (sidebar-session.js:20966-20985): a name shared by two buckets gets ' · {owner}' for a repo with
  // an owner, else ' · {parent folder}' of its local path.
  const nameCount = new Map();
  for (const bucket of named) nameCount.set(bucket.name, (nameCount.get(bucket.name) || 0) + 1);
  const folderGroups = named.map((bucket) => {
    const extra = nameCount.get(bucket.name) > 1 ? bucket.identity?.owner || bucket.identity?.parent || parentFolder(bucket.cwd) : null;
    return { key: `project:${bucket.key}`, projectKey: bucket.key, label: extra ? `${bucket.name} · ${extra}` : bucket.name,
      cwd: bucket.cwd, sessions: bucket.sessions, kind: "project" };
  });
  const byDefault = (a, b) => prefs.sortBy === "alpha"
    ? collator.compare(a.label, b.label) || a.key.localeCompare(b.key)
    : a.sessions.length && b.sessions.length ? compare(a.sessions[0], b.sessions[0])
      : b.sessions.length - a.sessions.length || collator.compare(a.label, b.label);
  // qs/BJ "manual" (sidebar-session.js:15858-15860, :20972-20984): once a stored order names a present
  // project, ranked buckets come first in that order and the rest follow; otherwise the local sort applies.
  const rank = new Map((Array.isArray(projectOrder) ? projectOrder : []).filter((key) => !isCustomOrderKey(key)).map((key, index) => [key, index]));
  const manual = folderGroups.some((group) => rank.has(group.projectKey));
  folderGroups.sort((a, b) => {
    if (manual) {
      const left = rank.get(a.projectKey), right = rank.get(b.projectKey);
      if (left !== undefined || right !== undefined) return left === undefined ? 1 : right === undefined ? -1 : left - right;
    }
    return byDefault(a, b);
  });
  if (other.length) folderGroups.push({ key: `project:${OTHER_PROJECT_KEY}`, projectKey: OTHER_PROJECT_KEY, label: t("Other"), sessions: other, kind: "project" });
  return output.concat(folderGroups);
}

// sidebar-groups.js:19927 _B and shared-2 zo.otherProjects ('Other'); sidebar-session.js:15826-15829
// _B/vB: custom groups share the persisted section order under a "ccg::" prefix.
export const OTHER_PROJECT_KEY = "__no_project__";
export const CUSTOM_ORDER_PREFIX = "ccg::";
export const customOrderKey = (groupId) => CUSTOM_ORDER_PREFIX + groupId;
export const isCustomOrderKey = (key) => typeof key === "string" && key.startsWith(CUSTOM_ORDER_PREFIX);
const trimTrailingSeparators = (value) => value.replace(/[/\\]+$/, "") || value;

/** IJ (sidebar-session.js:20892-20903) over a resolved repo identity {isRepo, toplevel, owner, name}:
 * owner/name when the origin names an owner (clones and worktrees merge), the cwd for a repo without
 * one, else the no-project bucket. `undefined` (not resolved yet) falls back to the cwd. */
export function projectKey(cwd, identity) {
  if (typeof cwd !== "string" || !cwd) return OTHER_PROJECT_KEY;
  if (identity === undefined) return trimTrailingSeparators(cwd);
  if (!identity?.isRepo) return OTHER_PROJECT_KEY;
  if (identity.owner && identity.name) return `${identity.owner}/${identity.name}`;
  return trimTrailingSeparators(cwd);
}

/** BJ name: the repo name, else the folder name while the identity is unknown. */
export function projectName(cwd, identity) {
  return identity?.isRepo && identity.name ? identity.name : folderName(cwd);
}

/** BJ disambiguation for a repo without an owner: the parent of its local path. */
export function parentFolder(cwd) {
  const trimmed = typeof cwd === "string" ? trimTrailingSeparators(cwd) : "";
  const at = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return at > 0 ? trimmed.slice(0, at) : trimmed;
}

/** xB (sidebar-session.js:15837-15852) for the custom list: groups ranked by the stored order; groups
 * without a position keep their creation order and come first (-Infinity). */
export function orderCustomGroups(customGroups = [], projectOrder = []) {
  const rank = new Map((Array.isArray(projectOrder) ? projectOrder : []).filter(isCustomOrderKey).map((key, index) => [key, index]));
  if (rank.size === 0) return customGroups;
  return customGroups.map((group, index) => ({ group, index }))
    .sort((a, b) => (rank.get(customOrderKey(a.group?.id)) ?? -Infinity) - (rank.get(customOrderKey(b.group?.id)) ?? -Infinity) || a.index - b.index)
    .map((entry) => entry.group);
}

/** Order keys of the movable sections shown in this list (sidebar-groups.js:19702-19712: the Other
 * bucket is not a section; in the custom list, Ungrouped is not one either). */
export function sectionOrderKeys(groups = []) {
  return groups.flatMap((group) => group.customGroupId ? [customOrderKey(group.customGroupId)]
    : group.kind === "project" && group.projectKey && group.projectKey !== OTHER_PROJECT_KEY ? [group.projectKey] : []);
}

/** Stored order after replacing one kind's section keys (custom "ccg::" keys or project keys) with
 * `keys`; entries of the other kind are kept, and stale keys of this kind follow the new ones. */
export function withSectionOrder(stored = [], keys = []) {
  const list = Array.isArray(stored) ? stored.filter((key) => typeof key === "string") : [];
  const custom = keys.length > 0 && isCustomOrderKey(keys[0]);
  const sameKind = (key) => isCustomOrderKey(key) === custom;
  const next = new Set(keys);
  const stale = list.filter((key) => sameKind(key) && !next.has(key));
  const others = list.filter((key) => !sameKind(key));
  return custom ? [...keys, ...stale, ...others] : [...others, ...keys, ...stale];
}

/** W / menu_up / menu_down (sidebar-groups.js:19714-19724): the section keys with `key` moved one slot. */
export function moveSection(keys = [], key, direction) {
  return movePinned(keys, key, direction);
}

/** 'Sort A to Z' (jB): the sections' keys by label (A to Z), stored as the new order. */
export function sortSectionsAlphabetically(groups = [], locale) {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
  const sections = groups.filter((group) => sectionOrderKeys([group]).length > 0);
  return sections.slice().sort((a, b) => collator.compare(a.label, b.label) || a.key.localeCompare(b.key)).flatMap((group) => sectionOrderKeys([group]));
}

/** A turn that completes for a sidebar row other than the open session leaves it unread (context-menu-
 * shared.js:19421-19437 kR: hasCompleted && isUnread -> 'ready'; sidebar-groups.js:9030-9040 serverUnread
 * = isUnread && !paneSelected). Sub-agent threads (ownerOf(id) !== id) and unknown ids are never rows. */
export function unreadOnTurnCompleted({ threadId, currentId = null, knownIds = [], ownerOf = (id) => id } = {}) {
  if (typeof threadId !== "string" || !threadId || threadId === currentId) return false;
  const known = knownIds instanceof Set ? knownIds.has(threadId) : Array.isArray(knownIds) && knownIds.includes(threadId);
  return known && ownerOf(threadId) === threadId;
}

/** Pinned rows follow the persisted manual order (Move up / Move down); ids
 * missing from it keep the sort order after the ordered ones. */
export function orderPinned(pinned, pinnedOrder = []) {
  if (!Array.isArray(pinnedOrder) || pinnedOrder.length === 0) return pinned;
  const rank = new Map(pinnedOrder.map((id, index) => [id, index]));
  return pinned.map((session, index) => ({ session, index }))
    .sort((a, b) => (rank.get(a.session.id) ?? Infinity) - (rank.get(b.session.id) ?? Infinity) || a.index - b.index)
    .map((entry) => entry.session);
}

/** New pinned order after moving `id` one slot up or down; null when it cannot move. */
export function movePinned(orderedIds, id, direction) {
  const at = orderedIds.indexOf(id);
  const to = at + (direction === "up" ? -1 : 1);
  if (at === -1 || to < 0 || to >= orderedIds.length) return null;
  const next = [...orderedIds];
  [next[at], next[to]] = [next[to], next[at]];
  return next;
}

/** sidebar-groups.js:13721-13729 ZF: hidden-child counts for the fold stub.
 * An unread row is counted as unread only; running rows that are not unread
 * count as working. */
export function nestedStubCounts(rows, { isUnread = () => false, isWorking = () => false } = {}) {
  let unread = 0, working = 0;
  for (const row of rows) {
    if (isUnread(row)) unread += 1;
    else if (isWorking(row)) working += 1;
  }
  return { count: rows.length, unread, working };
}

/** sidebar-session.js:19617-19626 + :19660-19662 jK: "{#} nested session(s)",
 * or "{#} more nested session(s)" while some children stay listed. */
export function nestedStubText(hiddenCount, someListed = false) {
  return someListed ? tn(hiddenCount, "{count} more nested session", "{count} more nested sessions")
    : tn(hiddenCount, "{count} nested session", "{count} nested sessions");
}

/** Lineage parent from real Codex Thread fields (forkedFromId, parentThreadId)
 * or the local fork operation's metadata; never guessed from titles. */
export function sessionParentId(session, metadata = {}) {
  const candidates = [session?.forkedFromId, session?.parentThreadId, metadata[session?.id]?.forkedFrom];
  const parent = candidates.find((value) => typeof value === "string" && value);
  return parent && parent !== session.id ? parent : null;
}

export function lineageKind(session, metadata = {}) {
  if (typeof session?.forkedFromId === "string" && session.forkedFromId) return "fork";
  if (typeof session?.parentThreadId === "string" && session.parentThreadId) return "side_session";
  return metadata[session?.id]?.forkedFrom ? "fork" : null;
}

/**
 * sidebar-groups WF/GF/KF: parent map restricted to rows in this bucket, chains
 * flattened to one level (a grandchild becomes a top-level row), children
 * emitted right after their parent at the first family member's position, and
 * the ordered rows split into runs {parentId, rows}.
 */
export function buildNestedRuns(sessions = [], metadata = {}) {
  const ids = new Set(sessions.map((session) => session.id));
  const parentOf = new Map();
  for (const session of sessions) {
    const parent = sessionParentId(session, metadata);
    if (parent && ids.has(parent)) parentOf.set(session.id, parent);
  }
  for (const [child, parent] of [...parentOf]) if (parentOf.has(parent)) parentOf.delete(child);
  if (parentOf.size === 0) return { runs: sessions.length ? [{ parentId: null, rows: [...sessions] }] : [], parentOf, ordered: [...sessions] };
  const children = new Map();
  for (const session of sessions) {
    const parent = parentOf.get(session.id);
    if (parent) children.set(parent, [...(children.get(parent) || []), session]);
  }
  const byId = new Map(sessions.map((session) => [session.id, session]));
  const seen = new Set();
  const ordered = [];
  for (const session of sessions) {
    const head = parentOf.get(session.id) ?? session.id;
    if (seen.has(head)) continue;
    seen.add(head);
    ordered.push(byId.get(head), ...(children.get(head) || []));
  }
  const runs = [];
  for (const session of ordered) {
    const parent = parentOf.get(session.id) ?? null;
    const last = runs.at(-1);
    if (parent && last?.parentId === parent) last.rows.push(session);
    else if (parent) runs.push({ parentId: parent, rows: [session] });
    else if (last && last.parentId === null) last.rows.push(session);
    else runs.push({ parentId: null, rows: [session] });
  }
  return { runs, parentOf, ordered };
}

/**
 * sidebar-groups JT + Vz sets: bulk archive/delete never touch pinned rows,
 * the session open in the window, running sessions (local guard) and, for
 * archive, already archived ones.
 */
export function bulkTargets(sessions = [], { metadata = {}, currentId = null, state = {}, action = "archive" } = {}) {
  return sessions.filter((session) => {
    if (!session?.id || metadata[session.id]?.pinned || session.id === currentId) return false;
    if (state.active?.[session.id] || sessionState(session, state) === "working") return false;
    if (action === "archive" && sessionArchived(session)) return false;
    return true;
  });
}

/**
 * Bucket truncation (sidebar-groups.js:13421-13530 bF/xF over shared-16
 * dc/fc; zR 17355-17430 renders the cut rows then BD "Show {count} more").
 * Counts rendered rows: every parent-run row plus the rows a nested run
 * actually shows (`shownRows`, default all). shared-16 dc: nothing is cut
 * unless more than truncateAt + extraRevealed + 1 rows exist (no lone
 * "Show 1 more"). bF: the cut is extended, never reordered, to the furthest
 * keepVisibleIds row past it (source: pane-open / reveal / fetch-floor keys;
 * locally the open session, selected rows and rows awaiting input). Local
 * adaptation: a nested family renders as one block, so a cut that lands
 * inside a nested run, or right after the parent row whose run follows, is
 * extended to the end of that run, and dc is re-checked on the extended cut
 * so that extension never leaves a lone hidden row. bF applies the pane-open
 * keys only while `!isCollapsed && hiddenCount > 0` (13433); keepVisibleIds
 * here also apply to a closed group, which renders nothing until reopened, so
 * the reopened result is the same. Returns the effective extraRevealed so a
 * caller can keep the extension (xF writes j back into state), firstHiddenId
 * for keyboard reveal focus, and SF revealCount = min(truncateAt, hidden).
 */
export function truncateRuns(runs = [], { truncateAt, extraRevealed = 0, keepVisibleIds = null, shownRows = (run) => run.rows } = {}) {
  const items = [];
  runs.forEach((run, index) => { for (const row of run.parentId === null ? run.rows : shownRows(run)) items.push({ index, id: row.id }); });
  let extra = Math.max(0, Number(extraRevealed) || 0);
  const all = { runs, hiddenCount: 0, revealCount: 0, extraRevealed: extra, firstHiddenId: null };
  if (truncateAt === undefined) return all;
  const cuts = () => items.length > truncateAt + extra + 1;
  if (cuts() && keepVisibleIds) {
    const keep = keepVisibleIds instanceof Set ? keepVisibleIds : new Set(keepVisibleIds);
    for (let at = items.length - 1; at >= truncateAt + extra; at -= 1) {
      if (keep.has(items[at].id)) { extra = Math.max(extra, at + 1 - truncateAt); break; }
    }
  }
  if (!cuts()) return { ...all, extraRevealed: extra };
  const last = items[truncateAt + extra - 1];
  let end = last.index, taken = null;
  if (runs[end].parentId === null) {
    taken = runs[end].rows.findIndex((row) => row.id === last.id) + 1;
    if (taken === runs[end].rows.length && runs[end + 1]?.parentId === last.id) { end += 1; taken = null; }
  }
  const visible = runs.slice(0, end + 1);
  if (taken !== null && taken < runs[end].rows.length) visible[end] = { ...runs[end], rows: runs[end].rows.slice(0, taken) };
  const shown = taken === null ? items.filter((item) => item.index <= end).length : items.filter((item) => item.index < end).length + taken;
  // dc re-applied to the extended cut: the nested-family extension can leave
  // a single row past it, which the source (cutting the flat ee list) never
  // shows as "Show 1 more"; render the whole bucket instead.
  if (items.length - shown <= 1) return { ...all, extraRevealed: extra };
  const hiddenCount = items.length - shown;
  return { runs: visible, hiddenCount, revealCount: Math.min(truncateAt, hiddenCount), extraRevealed: extra, firstHiddenId: items[shown].id };
}
