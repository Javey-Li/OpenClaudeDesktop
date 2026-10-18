// Session cycling (Go > Previous/Next Session, ⌘⇧[ / ⌘⇧], Ctrl+Tab / Ctrl+Shift+Tab), ported from
// ion-dist/assets/v1/shared-19-CjdiaR4X.js Km/Jm/Xm/$m. Position 0 is the new-session page and the sidebar's
// session rows are positions 1..count, so the walk wraps home → first → … → last → home (modulus count + 1).
// While the modifier stays down, the next step continues from the row the previous step opened (Jm), even if
// the selection has not re-rendered yet; held-key repeats closer than Gm = 50ms are swallowed.
export const CYCLE_REPEAT_MS = 50; // Gm

// $m on macOS: Ctrl+Tab / Ctrl+Shift+Tab (no ⌘), or ⌘⇧] / ⌘⇧[ by key code (no Ctrl); Alt never cycles.
export function sessionCycleDelta(event) {
  if (!event || event.altKey) return 0;
  if (event.key === "Tab" && event.ctrlKey && !event.metaKey) return event.shiftKey ? -1 : 1;
  if (event.metaKey && event.shiftKey && !event.ctrlKey) {
    if (event.code === "BracketRight") return 1;
    if (event.code === "BracketLeft") return -1;
  }
  return 0;
}

// qm: pressing or releasing the modifier itself ends a held sequence.
export const isCycleModifier = (event) => event?.key === "Control" || event?.key === "Meta";

// Jm: continue from the last opened row when it is still listed, else from its remembered position.
export function resumePosition(last, lastIndex, count) {
  return lastIndex === -1 ? Math.min(last.pos, count) : lastIndex + 1;
}

/** Km a(): the position to open, 0 for the new-session page; null when there are no rows. */
export function cycleTarget({ count, selectedIndex = -1, last = null, lastIndex = -1 }, delta) {
  if (!(count > 0)) return null;
  const modulus = count + 1;
  const start = last ? resumePosition(last, lastIndex, count) : selectedIndex + 1;
  return (((start + delta) % modulus) + modulus) % modulus;
}

// Km: a held-key repeat within Gm of the previous step is consumed without moving.
export function repeatThrottled(last, now, repeat) {
  return !!(repeat && last && now - last.at < CYCLE_REPEAT_MS);
}

/**
 * Km's controller over injected DOM access: rows() lists the sidebar's row main buttons in order with the
 * index of the open (or focused) one, open(button) scrolls it into view and clicks it, home() opens the
 * new-session page. Returns whether the step was consumed (the caller then preventDefaults the key).
 */
export function createSessionCycler({ rows, open, home, now = () => performance.now() }) {
  let last = null;
  function cycle(delta, repeat = false) {
    const { buttons, selectedIndex } = rows();
    if (!buttons.length) return false;
    const at = now();
    if (repeatThrottled(last, at, repeat)) return true;
    const pos = cycleTarget({ count: buttons.length, selectedIndex, last, lastIndex: last?.button ? buttons.indexOf(last.button) : -1 }, delta);
    const button = pos === 0 ? null : buttons[pos - 1];
    last = { button, pos, at };
    if (button) open(button); else home();
    return true;
  }
  // Km o/s/l: keydown, keyup and blur bookkeeping around cycle().
  function keydown(event) {
    if (isCycleModifier(event)) { if (!event.repeat) last = null; return false; }
    const delta = sessionCycleDelta(event);
    if (delta === 0 || event.defaultPrevented) { if (event.key !== "Shift") last = null; return false; }
    return cycle(delta, event.repeat);
  }
  function keyup(event) { if (isCycleModifier(event) || (!event.ctrlKey && !event.metaKey)) last = null; }
  // The Go menu's onCycleSession: one fresh step.
  function step(delta) { last = null; const consumed = cycle(delta, false); last = null; return consumed; }
  return { cycle, keydown, keyup, step, reset: () => { last = null; } };
}
