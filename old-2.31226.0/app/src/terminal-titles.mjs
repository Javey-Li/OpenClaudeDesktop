// Running command / shell title per terminal tab (2.31226.0 cf718f694 ge/ue/de, read by cccc2cf0a Zg). The tracking
// itself is the original code (generated/code-editor/terminal-titles.mjs); this module only gives it a store and the
// pane a way to read it. Keyed by terminal id (the reference's ptyKey): a tab's view installs it when it is created.
import { createTerminalTitles } from "./generated/code-editor/terminal-titles.mjs";

// The small part of zustand's store the original code uses: getState / setState(updater) / subscribe.
function createStore(init) {
  let state;
  const listeners = new Set();
  const api = {
    getState: () => state,
    setState(partial) {
      const next = typeof partial === "function" ? partial(state) : partial;
      if (Object.is(next, state)) return;
      const previous = state;
      state = Object.assign({}, state, next);
      for (const listener of [...listeners]) { try { listener(state, previous); } catch {} }
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
  state = init(api.setState, api.getState, api);
  return api;
}

export function createTerminalTitleTracker() {
  const titles = createTerminalTitles({ create: createStore });
  return {
    /** Start tracking an xterm's OSC 0/2 title and OSC 133 C/D command marks for terminal `id`. */
    install: (term, id) => titles.install(term, id),
    /** The terminal closed (or its view was dropped): no title, no pending timer. */
    forget: (id) => titles.forget(id),
    subscribe: (listener) => titles.store.subscribe(listener),
    snapshot: () => titles.store.getState(),
    /** The running command, else the shell's reported title (Vl), for a tab without its own name. */
    value(state, tab) {
      if (!tab?.id || (typeof tab.title === "string" && tab.title) || !titles.enabled()) return undefined;
      return titles.value(state ?? titles.store.getState(), tab.id);
    },
    /** Zg's tab description: the last path segment of a path-like title, else the text itself (de). */
    description: (value) => (value ? titles.description(value) : undefined),
  };
}

let shared = null;
export function terminalTitles() {
  if (!shared) shared = createTerminalTitleTracker();
  return shared;
}
