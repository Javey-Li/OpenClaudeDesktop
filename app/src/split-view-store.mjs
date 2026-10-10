// One split-view store per renderer (window): the split-view-model.mjs state, the two sides' Apps as
// handlers (navigate / focus / settings), and the window layout reported to main.cjs ("window-layout",
// "split-menu-state") so menus, routing and relaunch follow it. No React here (source-split-view.jsx
// subscribes with useSyncExternalStore), so it is unit-testable.
import * as model from "./split-view-model.mjs";

// Browser timers require their Window receiver; preserve it for the default
// clock while allowing injected clocks to retain their own receiver.
export function createSplitViewStore({ report = () => {}, timers = globalThis, delay = 250 } = {}) {
  let state = model.emptySplit, slot = null, slotVersion = 0, view = { ...state, slot, slotVersion }, nonce = 0, timer = null;
  let reported = { layout: null, menu: null };
  const listeners = new Set();
  const handlers = [null, null];
  // Effects for a side whose App has not registered yet (the secondary side mounts after the split opens).
  const pending = [[], []];

  const notify = () => { view = { ...state, slot, slotVersion }; for (const listener of [...listeners]) listener(); };
  function sendReport() {
    timer = null;
    const layout = model.splitLayout(state), menu = model.splitMenuState(state);
    const layoutKey = JSON.stringify(layout), menuKey = JSON.stringify(menu);
    if (layoutKey === reported.layout && menuKey === reported.menu) return;
    const changed = { layout: layoutKey !== reported.layout ? layout : null, menu: menuKey !== reported.menu ? menu : null };
    reported = { layout: layoutKey, menu: menuKey };
    try { report(changed); } catch {}
  }
  function scheduleReport() {
    timers.clearTimeout(timer);
    timer = timers.setTimeout(sendReport, delay);
  }
  // What main.cjs routes by (windowsShowing: unread marks, notifications' window, a session another window shows):
  // a change of the sessions shown is reported at once; the ratio and focus wait for the debounce.
  const shownKey = (value) => { const layout = model.splitLayout(value); return `${layout.current ?? ""}|${layout.split?.sessionId ?? ""}`; };
  function set(next) {
    if (next === state) return;
    const shownChanged = shownKey(next) !== shownKey(state);
    state = next;
    notify();
    if (shownChanged) { timers.clearTimeout(timer); sendReport(); } else scheduleReport();
  }
  function apply(effect) {
    if (effect.navigate) {
      const [side, id] = effect.navigate;
      if (handlers[side]?.navigate) handlers[side].navigate(id); else pending[side].push(effect);
    }
    if (effect.focus === 0 || effect.focus === 1) {
      const side = effect.focus;
      if (handlers[side]?.focus) handlers[side].focus(); else pending[side].push(effect);
    }
  }
  function run(result) {
    set(result.state);
    for (const effect of result.effects) apply(effect);
    return result.state;
  }
  return {
    getState: () => view,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    /** A side's App: { navigate(id), focus(), settings?(value) }. Returns the unregister function. */
    register(side, handler) {
      handlers[side] = handler;
      const queued = pending[side].splice(0);
      for (const effect of queued) apply(effect);
      return () => { if (handlers[side] === handler) handlers[side] = null; };
    },
    reportSide(side, report) { set(model.reportSide(state, side, report)); },
    open(id = null) { return run(model.openSplit(state, id, { nonce: ++nonce })); },
    close(side = state.active) { return run(model.closeSide(state, side)); },
    swap(direction = null) { return run(model.swapSides(state, direction)); },
    focus(side, options) { return run(model.focusSide(state, side, options)); },
    focusNext() { return run(model.focusNext(state)); },
    openInFocusedSide(id) { return run(model.openInFocusedSide(state, id)); },
    command(name) { return run(model.splitCommand(state, name, { nonce: ++nonce })); },
    restore(split) { return run(model.restoreSplit(state, split, { nonce: ++nonce })); },
    setRatio(ratio, width = 0) { set(model.setRatio(state, ratio, width)); },
    setTabs(tabs) { set(model.setTabs(state, tabs)); },
    /** The secondary side's DOM host (SourceSplitHost) the secondary App portals into. */
    setSlot(element) { if (slot === element) return; slot = element ?? null; slotVersion += 1; notify(); },
    isShown(id) { return model.sideShowing(state, id) !== null; },
    sideShowing(id) { return model.sideShowing(state, id); },
    /** Window-wide surfaces (Settings) belong to the primary side's App. */
    toPrimary(kind, value) { const run = handlers[0]?.[kind]; if (typeof run === "function") { run(value); return true; } return false; },
    layout: () => model.splitLayout(state),
    /** Report the whole state once (a window's renderer just loaded: main keeps nothing from its previous page). */
    reportNow() { timers.clearTimeout(timer); reported = { layout: null, menu: null }; sendReport(); },
    /** Report now (the window is closing or reloading). */
    flushReport() { if (timer === null) return; timers.clearTimeout(timer); sendReport(); },
  };
}
