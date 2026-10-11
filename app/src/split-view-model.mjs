// Split view: two sessions side by side in one window, each side its own App (transcript, composer, panes,
// model and permission state); see source-split-view.jsx. Claude Desktop 2.2553.1 (desktop-sidebar.js
// WR/GR, ER/DR/CR/wR, IR; desktop-layout.css .dframe-pane-*) shows a primary pane and extra session panes in
// columns and rows; OpenClaude Desktop keeps two columns: the primary side (0) and the secondary side (1).
// Pure state transitions: each returns { state, effects } where an effect asks a side's App to navigate
// ({ navigate: [side, sessionId|null] }) or to take keyboard focus ({ focus: side }).

// _x.MIN_PX (official) is the smallest pane; locally each side keeps room for a 320px chat tile and padding.
export const SPLIT_MIN_PANE_PX = 360;
export const SPLIT_DIVIDER_PX = 1;
export const SPLIT_DEFAULT_RATIO = 0.5;
export const SPLIT_KEY_STEP = 0.02;
export const SPLIT_KEY_STEP_LARGE = 0.1;
// Official vNr accelerators and Pv commands (View › Split View). New Session Below and Move Up / Down need rows,
// which a two-column split does not have.
export const SPLIT_COMMANDS = Object.freeze(["new-right", "focus-next", "focus-previous", "move-left", "move-right", "close"]);
// The sidebar row drag (source-sidebar.jsx) → drop on the session area opens the session in split view.
export const SESSION_DRAG_TYPE = "application/x-code-desktop-session";

const EMPTY_SIDE = Object.freeze({ current: null, title: "" });
export const emptySplit = Object.freeze({ open: false, secondary: null, active: 0, ratio: SPLIT_DEFAULT_RATIO, sides: Object.freeze([EMPTY_SIDE, EMPTY_SIDE]), tabs: false });

const sessionId = (value) => typeof value === "string" && value.length > 0 && value.length <= 200 && !/[\u0000-\u001f]/.test(value) ? value : null;
const unchanged = (state) => ({ state, effects: [] });

/** The primary side's share of the width, kept so both sides stay at least `min` px wide. */
export function clampRatio(ratio, width = 0, min = SPLIT_MIN_PANE_PX) {
  const value = Number.isFinite(ratio) ? ratio : SPLIT_DEFAULT_RATIO;
  const floor = width > 0 ? Math.min(0.5, min / width) : 0.15;
  return Math.min(1 - floor, Math.max(floor, value));
}
/** Too narrow for two sides of `min` px: the split shows one side at a time behind tabs. */
export function splitTabbed(width, min = SPLIT_MIN_PANE_PX) {
  return Number.isFinite(width) && width > 0 && width < min * 2 + SPLIT_DIVIDER_PX;
}
export function ratioFromPointer(x, left, width, min = SPLIT_MIN_PANE_PX) {
  if (!(width > 0)) return SPLIT_DEFAULT_RATIO;
  return clampRatio((x - left) / width, width, min);
}
export const ratioPercent = (ratio) => Math.round(clampRatio(ratio) * 100);
/** The divider's keys (role=separator): arrows step, Shift steps further, Home/End go to the ends, Enter resets. */
export function stepRatio(ratio, key, { width = 0, shift = false, min = SPLIT_MIN_PANE_PX } = {}) {
  const step = shift ? SPLIT_KEY_STEP_LARGE : SPLIT_KEY_STEP;
  switch (key) {
    case "ArrowLeft": case "ArrowDown": return clampRatio(ratio - step, width, min);
    case "ArrowRight": case "ArrowUp": return clampRatio(ratio + step, width, min);
    case "Home": return clampRatio(0, width, min);
    case "End": return clampRatio(1, width, min);
    case "Enter": return SPLIT_DEFAULT_RATIO;
    default: return null;
  }
}

// Official OR() chords (vNr accelerators): ⌃] / ⌃[ focus the next / previous side, ⌃⌘\ opens a new session on the
// right, ⌃⌘W closes the focused side. source-split-view.jsx matches them first (preventDefault), so the menu
// accelerators only fire for clicks (app-menu.cjs splitDispatch); the ⌘/ shortcuts dialog lists the same chords.
export function splitShortcut(event) {
  if (!event || event.defaultPrevented || event.repeat || event.altKey || event.shiftKey || !event.ctrlKey) return null;
  if (!event.metaKey && event.code === "BracketRight") return "focus-next";
  if (!event.metaKey && event.code === "BracketLeft") return "focus-previous";
  if (event.metaKey && event.code === "Backslash") return "new-right";
  if (event.metaKey && event.code === "KeyW") return "close";
  return null;
}

/** The side showing a session, or null. */
export function sideShowing(state, id) {
  const value = sessionId(id);
  if (!value) return null;
  if (state.sides[0].current === value) return 0;
  return state.open && state.sides[1].current === value ? 1 : null;
}
function withSide(state, side, patch) {
  const sides = state.sides.map((entry, index) => (index === side ? { ...entry, ...patch } : entry));
  return { ...state, sides };
}
/** A side's App reports what it shows (its open session, or null on Home, and the title). */
export function reportSide(state, side, { current = null, title = "" } = {}) {
  const next = { current: sessionId(current), title: typeof title === "string" ? title.slice(0, 200) : "" };
  const entry = state.sides[side];
  if (!entry || (entry.current === next.current && entry.title === next.title)) return state;
  return withSide(state, side, next);
}

/** "Open in split view" (official addPane): a closed split opens with the session (or a new session) on the
 * right and focuses it; an open split shows it on the right; a session already on a side just takes the focus. */
export function openSplit(state, id = null, { nonce = 1 } = {}) {
  const value = sessionId(id);
  const side = sideShowing(state, value);
  if (side !== null) return { state: { ...state, active: side }, effects: [{ focus: side }] };
  if (!state.open)
    return { state: { ...state, open: true, active: 1, secondary: { sessionId: value, nonce }, sides: [state.sides[0], { current: value, title: "" }] }, effects: [{ focus: 1 }] };
  return { state: { ...state, active: 1 }, effects: [{ navigate: [1, value] }, { focus: 1 }] };
}
/** Close Split View (official wR / jx): closing the secondary side leaves the primary; closing the primary side
 * moves the secondary's session into it. */
export function closeSide(state, side = state.active) {
  if (!state.open) return unchanged(state);
  const closed = { ...state, open: false, secondary: null, active: 0, sides: [state.sides[0], EMPTY_SIDE] };
  if (side !== 0) return { state: closed, effects: [{ focus: 0 }] };
  const moved = state.sides[1];
  return { state: { ...closed, sides: [moved, EMPTY_SIDE] }, effects: [{ navigate: [0, moved.current] }, { focus: 0 }] };
}
/** Move Split View Left / Right: the two sessions trade sides and the focus follows the moved session. */
export function swapSides(state, direction = null) {
  if (!state.open) return unchanged(state);
  if (direction === "left" && state.active !== 1) return unchanged(state);
  if (direction === "right" && state.active !== 0) return unchanged(state);
  const [first, second] = state.sides, active = state.active === 0 ? 1 : 0;
  return { state: { ...state, active, sides: [second, first] }, effects: [{ navigate: [0, second.current] }, { navigate: [1, first.current] }, { focus: active }] };
}
/** A click or focus inside a side makes it the focused side; `move` also moves keyboard focus there. */
export function focusSide(state, side, { move = false } = {}) {
  if (!state.open || (side !== 0 && side !== 1)) return unchanged(state);
  const next = state.active === side ? state : { ...state, active: side };
  return { state: next, effects: move ? [{ focus: side }] : [] };
}
/** Focus Next / Previous Split View (⌃] / ⌃[, official CR): two sides, so either direction is the other side. */
export function focusNext(state) {
  if (!state.open) return unchanged(state);
  return focusSide(state, state.active === 0 ? 1 : 0, { move: true });
}
/** A sidebar row, a notification or a deep link opens a session in the focused side; a session another side
 * already shows takes the focus there instead (a session is never shown twice in one window). */
export function openInFocusedSide(state, id) {
  const value = sessionId(id);
  const side = sideShowing(state, value);
  if (side !== null && state.open) return { state: { ...state, active: side }, effects: [{ focus: side }] };
  if (side === 0) return { state, effects: [{ navigate: [0, value] }] };
  const target = state.open ? state.active : 0;
  return { state, effects: [{ navigate: [target, value] }] };
}
export function setRatio(state, ratio, width = 0) {
  const next = clampRatio(ratio, width);
  return next === state.ratio ? state : { ...state, ratio: next };
}
export function setTabs(state, tabs) {
  return state.tabs === !!tabs ? state : { ...state, tabs: !!tabs };
}
/** A View › Split View command or its shortcut. */
export function splitCommand(state, command, { nonce = 1 } = {}) {
  switch (command) {
    case "new-right": return state.open ? unchanged(state) : openSplit(state, null, { nonce });
    case "focus-next": case "focus-previous": return focusNext(state);
    case "move-left": return swapSides(state, "left");
    case "move-right": return swapSides(state, "right");
    case "close": return closeSide(state, state.active);
    default: return unchanged(state);
  }
}
/** What main.cjs persists for this window (window-registry.cjs sanitizeLayout). */
export function splitLayout(state) {
  return { current: state.sides[0].current, split: state.open ? { sessionId: state.sides[1].current, ratio: state.ratio, active: state.active } : null };
}
/** Relaunch: reopen the split a window had (main.cjs init → windowLayout.split), unless it is already open. */
export function restoreSplit(state, split, { nonce = 1 } = {}) {
  if (!split || typeof split !== "object" || state.open) return unchanged(state);
  const value = sessionId(split.sessionId);
  const opened = openSplit({ ...state, ratio: clampRatio(split.ratio) }, value === state.sides[0].current ? null : value, { nonce });
  return { state: { ...opened.state, active: split.active === 1 ? 1 : 0 }, effects: [] };
}
/** View › Split View enabled states (official ER/FR reportSplitViewMenuState). */
export function splitMenuState(state) {
  return { newRight: !state.open, split: state.open, moveLeft: state.open && state.active === 1, moveRight: state.open && state.active === 0 };
}
/** The session row menu's split item (official lE/uE): Close split view for a session shown while split,
 * Open in split view for any other; nothing for the primary session of an unsplit window. */
export function sessionSplitItem(state, id) {
  const side = sideShowing(state, id);
  if (side !== null) return state.open ? { kind: "close", side } : null;
  return { kind: "open" };
}

// --- Split-view tip (2.2553.1 Dl / store "epitaxy-split-suggestion"): a user who keeps switching back and forth
// between two sessions (A, B, A, B within 30 s) is offered split view once, with a backoff between shows.
export const SPLIT_SUGGESTION_WINDOW_MS = 30_000;
export const SPLIT_SUGGESTION_MAX_SHOWS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;
// Wait before the nth show (0-based shows so far): none, then a day, then a week.
export const SPLIT_SUGGESTION_BACKOFF_MS = Object.freeze([0, DAY_MS, 7 * DAY_MS]);
export const emptySplitSuggestion = Object.freeze({ shown: 0, lastShownAt: 0, accepted: 0, dismissed: 0 });

/** The last session switches (at most 4), with the new one appended unless it repeats the latest. */
export function recordSessionSwitch(history, id, at) {
  const list = Array.isArray(history) ? history.filter((entry) => entry && typeof entry.id === "string" && Number.isFinite(entry.at)) : [];
  if (typeof id !== "string" || !id || list.at(-1)?.id === id) return list;
  return [...list, { id, at }].slice(-4);
}
/** The other session when the last four switches alternate between two sessions within the window, else null. */
export function alternatingPartner(history, now = Date.now()) {
  if (!Array.isArray(history) || history.length < 4) return null;
  const [a, b, c, d] = history.slice(-4);
  if (a.id === b.id || a.id !== c.id || b.id !== d.id) return null;
  if (now - a.at > SPLIT_SUGGESTION_WINDOW_MS) return null;
  return c.id;
}
/** The saved tip state, sanitized. */
export function splitSuggestionState(value) {
  const v = value && typeof value === "object" ? value : {};
  const count = (key) => Number.isInteger(v[key]) && v[key] >= 0 ? v[key] : 0;
  return { shown: count("shown"), lastShownAt: Number.isFinite(v.lastShownAt) ? v.lastShownAt : 0, accepted: count("accepted"), dismissed: count("dismissed") };
}
/** Whether the tip may show now: never once accepted, at most MAX_SHOWS times, and not before its backoff passed. */
export function canSuggestSplit(state, now = Date.now()) {
  const s = splitSuggestionState(state);
  if (s.accepted > 0 || s.shown >= SPLIT_SUGGESTION_MAX_SHOWS) return false;
  const wait = SPLIT_SUGGESTION_BACKOFF_MS[Math.min(s.shown, SPLIT_SUGGESTION_BACKOFF_MS.length - 1)];
  return now - s.lastShownAt >= wait;
}
