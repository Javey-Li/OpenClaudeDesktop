// Main window bounds persistence, ported from index.chunk-ChZ67Jhw.js Sbe
// (with Cbe/wbe/Tbe validation and Ebe display placement). Pure apart from
// the injected screen, fs and timers, so it is unit-testable.
// - The file is userData/window-state.json (ybe) holding {x, y, width,
//   height, isMaximized, isFullScreen, displayBounds}; a missing or corrupt
//   file falls back to Dfn {width:1200, height:800} with no position, which
//   Electron centres.
// - Saves are debounced bbe=1000ms after resize/move/maximize/unmaximize/
//   enter-full-screen/leave-full-screen (xbe) and immediate on "close"; a
//   minimized window is skipped, and normal bounds are not overwritten while
//   maximized or full screen.
// - manage() maximizes or enters full screen as stored.
const nodeFs = require("node:fs");
const path = require("node:path");
const DEFAULT_WINDOW_SIZE = Object.freeze({ width: 1200, height: 800 }); // Dfn
const WINDOW_STATE_FILE = "window-state.json"; // ybe
const SAVE_DELAY_MS = 1000; // bbe
const WINDOW_EVENTS = Object.freeze(["resize", "move", "maximize", "unmaximize", "enter-full-screen", "leave-full-screen"]); // xbe
const positive = (value) => Number.isInteger(value) && value > 0; // Co
// Tbe: a display rectangle with integer origin and positive size.
function validRect(value) {
  if (!value || typeof value !== "object") return undefined;
  return Number.isInteger(value.x) && Number.isInteger(value.y) && positive(value.width) && positive(value.height)
    ? { x: value.x, y: value.y, width: value.width, height: value.height } : undefined;
}
// wbe: keep a stored shape only when it carries a size or a maximized/full-screen
// flag; a position is kept only together with a size.
function validWindowState(raw, defaults = DEFAULT_WINDOW_SIZE) {
  if (!raw || typeof raw !== "object") return undefined;
  const size = positive(raw.width) && positive(raw.height) ? { width: raw.width, height: raw.height } : undefined;
  const isMaximized = raw.isMaximized === true, isFullScreen = raw.isFullScreen === true;
  if (!size && !isMaximized && !isFullScreen) return undefined;
  return {
    ...(size && Number.isInteger(raw.x) && Number.isInteger(raw.y) ? { x: raw.x, y: raw.y } : {}),
    ...(size ?? { width: defaults.width, height: defaults.height }),
    isMaximized, isFullScreen, displayBounds: validRect(raw.displayBounds),
  };
}
const sameRect = (a, b) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height; // Abe
const intersects = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height; // kbe
// Lye/Iye: shrink to the work area, then clamp the origin inside it.
function fitInto(frame, area) {
  const width = Math.min(frame.width, area.width), height = Math.min(frame.height, area.height);
  return { width, height, x: Math.min(Math.max(frame.x, area.x), area.x + Math.max(0, area.width - width)),
    y: Math.min(Math.max(frame.y, area.y), area.y + Math.max(0, area.height - height)) };
}
// Dbe/Obe: the display of the saved display's size nearest to its old origin.
function sameSizedDisplay(displays, saved) {
  let best;
  for (const display of displays)
    if (display.bounds.width === saved.width && display.bounds.height === saved.height
      && (!best || Math.abs(display.bounds.x - saved.x) + Math.abs(display.bounds.y - saved.y) < Math.abs(best.bounds.x - saved.x) + Math.abs(best.bounds.y - saved.y)))
      best = display;
  return best;
}
// Ebe: the saved display when it still exists; any display the frame still
// touches; a same-sized display (keeping the offset); otherwise centred on the
// primary display, shrunk to its work area (Nye).
function placeOnDisplays(state, screen) {
  if (state.x === undefined || state.y === undefined) return state;
  const frame = { x: state.x, y: state.y, width: state.width, height: state.height };
  const displays = screen.getAllDisplays(), saved = state.displayBounds;
  const same = saved && displays.find((display) => sameRect(display.bounds, saved));
  const sized = saved && sameSizedDisplay(displays, saved);
  let placed;
  if (same) placed = fitInto(frame, same.workArea);
  else if (displays.some((display) => intersects(frame, display.bounds))) placed = fitInto(frame, (screen.getDisplayMatching(frame) || screen.getPrimaryDisplay()).workArea);
  else if (saved && sized) placed = fitInto({ ...frame, x: frame.x + sized.bounds.x - saved.x, y: frame.y + sized.bounds.y - saved.y }, sized.workArea);
  else {
    const { workArea } = screen.getPrimaryDisplay();
    const width = Math.min(frame.width, workArea.width), height = Math.min(frame.height, workArea.height);
    placed = { width, height, x: workArea.x + Math.max(0, Math.floor((workArea.width - width) / 2)), y: workArea.y + Math.max(0, Math.floor((workArea.height - height) / 2)) };
  }
  return { ...state, ...placed };
}
// Cbe + placeOnDisplays (OLi calls e.placeOnDisplays() before creating the window).
function loadWindowState(file, screen, { fs = nodeFs, defaults = DEFAULT_WINDOW_SIZE } = {}) {
  const fallback = { width: defaults.width, height: defaults.height, isMaximized: false, isFullScreen: false };
  let stored;
  try { stored = validWindowState(JSON.parse(fs.readFileSync(file, "utf8")), defaults); } catch { stored = undefined; }
  return placeOnDisplays(stored ?? fallback, screen);
}
// BrowserWindow options for the stored frame (no x/y lets Electron centre it).
function windowStateBounds(state) {
  return { ...(state.x !== undefined && state.y !== undefined ? { x: state.x, y: state.y } : {}), width: state.width, height: state.height };
}
// manage()'s first step: re-enter the stored maximized / full-screen state.
function restoreWindowState(win, state) {
  if (state.isMaximized) win.maximize();
  if (state.isFullScreen) win.setFullScreen(true);
}
function writeAtomic(fs, file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + ".tmp", JSON.stringify(value, null, 2));
  fs.renameSync(file + ".tmp", file);
}
// manage()/unmanage(): listeners on the window, debounced saves and the close flush.
function trackWindowState(win, { file, screen, state, delay = SAVE_DELAY_MS, fs = nodeFs, timers = { setTimeout, clearTimeout } }) {
  let current = { ...state }, timer = null, failed = false, disposed = false;
  const capture = () => {
    if (win.isDestroyed() || win.isMinimized()) return false;
    const bounds = win.getBounds(), isMaximized = win.isMaximized(), isFullScreen = win.isFullScreen();
    const next = { ...current, ...(isMaximized || isFullScreen ? {} : bounds), isMaximized, isFullScreen,
      displayBounds: (screen.getDisplayMatching(bounds) || screen.getPrimaryDisplay()).bounds };
    const changed = failed || ["x", "y", "width", "height", "isMaximized", "isFullScreen"].some((key) => next[key] !== current[key]);
    current = next;
    return changed;
  };
  const write = () => {
    try { writeAtomic(fs, file, current); failed = false; }
    catch { failed = true; }
  };
  const flush = () => {
    timers.clearTimeout(timer); timer = null;
    if (!disposed && capture()) write();
  };
  const schedule = () => { timers.clearTimeout(timer); timer = timers.setTimeout(flush, delay); };
  const dispose = () => {
    if (disposed) return;
    timers.clearTimeout(timer); timer = null; disposed = true;
    for (const name of WINDOW_EVENTS) win.removeListener(name, schedule);
    win.removeListener("close", flush);
    win.removeListener("closed", dispose);
  };
  for (const name of WINDOW_EVENTS) win.on(name, schedule);
  win.on("close", flush);
  win.on("closed", dispose);
  return { flush, dispose, get state() { return { ...current }; } };
}
module.exports = { DEFAULT_WINDOW_SIZE, WINDOW_STATE_FILE, SAVE_DELAY_MS, WINDOW_EVENTS, validWindowState, placeOnDisplays,
  loadWindowState, windowStateBounds, restoreWindowState, trackWindowState };
