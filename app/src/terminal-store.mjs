// Terminal pane state for this window: the tabs of every owner (a session, or the New session page's folder) it has
// shown, the active tab per owner, and the xterm views kept alive across session switches. The PTYs live in the main
// process (electron/terminal-service.cjs); this module only mirrors their info and routes their output. Keyed per
// owner, never "the current session": a window may show two sessions side by side.
//
// The xterm views are created by the pane (source-terminal-pane.jsx) through a factory, so this module never imports
// xterm and stays testable. A view: { write(data), reset(), dispose(), element } — the store keeps at most
// MAX_CACHED_TERMINALS of them (least recently shown first out; they re-attach from the main process's kept output).
import { MAX_CACHED_TERMINALS, unseenData } from "./terminal-pane-model.mjs";

export function ownerKeyOf(sessionId, homeWorkspace) {
  return sessionId ? sessionId : homeWorkspace ? `home:${homeWorkspace}` : null;
}

export function createTerminalStore({ bridge = globalThis.desktop?.terminal ?? null } = {}) {
  const owners = new Map(); // owner → { tabs: info[], active: id|null, loaded, loading: Promise|null, error }
  const views = new Map(); // id → { view, written, queue: events[]|null, lastShown, info }
  const listeners = new Set();
  const openedListeners = new Set();
  const enterAt = new Map(); // id → last Enter keystroke time (auto-close on `exit`)
  let version = 0;
  const notify = () => { version += 1; for (const listener of [...listeners]) { try { listener(); } catch {} } };

  const ownerState = (owner) => {
    if (!owners.has(owner)) owners.set(owner, { tabs: [], active: null, loaded: false, loading: null, error: null });
    return owners.get(owner);
  };
  function upsert(info) {
    if (!info?.id || !info.owner) return;
    const state = ownerState(info.owner);
    const index = state.tabs.findIndex((tab) => tab.id === info.id);
    const previous = index >= 0 ? state.tabs[index] : null;
    state.tabs = index >= 0 ? state.tabs.map((tab) => (tab.id === info.id ? info : tab)) : [...state.tabs, info];
    if (!state.active) state.active = info.id;
    const entry = views.get(info.id);
    if (entry) {
      entry.info = info;
      // A restart starts a fresh shell: the view starts over too.
      if (previous && previous.generation !== info.generation) { try { entry.view.reset(); } catch {} entry.written = 0; }
    }
  }
  function drop(id, owner, { keepView = false } = {}) {
    const state = owner ? owners.get(owner) : [...owners.values()].find((value) => value.tabs.some((tab) => tab.id === id));
    if (state) {
      const index = state.tabs.findIndex((tab) => tab.id === id);
      if (index >= 0) {
        state.tabs = state.tabs.filter((tab) => tab.id !== id);
        if (state.active === id) state.active = state.tabs[Math.min(index, state.tabs.length - 1)]?.id ?? null;
      }
    }
    if (keepView) return;
    const entry = views.get(id);
    if (entry) { try { entry.view.dispose(); } catch {} views.delete(id); }
    enterAt.delete(id);
  }
  function receive(event) {
    if (!event || typeof event !== "object") return;
    if (event.kind === "data") {
      const entry = views.get(event.id);
      if (!entry) return;
      if (entry.queue) { entry.queue.push(event); return; }
      const data = unseenData(event, entry.written);
      if (data) { entry.view.write(data); entry.written = event.end; }
      return;
    }
    // ⌘K in some window: every other view of that terminal clears too (the kept output is gone: terminal-service "clear").
    if (event.kind === "cleared") { const entry = views.get(event.id); if (entry && !entry.queue) { try { entry.view.clear?.(); } catch {} entry.written = event.end; } return; }
    if (event.kind === "state") { upsert(event.info); notify(); return; }
    // "moved": the terminal now belongs to another owner (a session the New session page started): its view stays.
    if (event.kind === "removed") { drop(event.id, event.owner, { keepView: event.reason === "moved" }); notify(); return; }
    if (event.kind === "opened") {
      const state = ownerState(event.owner);
      state.active = event.id;
      for (const listener of [...openedListeners]) { try { listener(event); } catch {} }
      notify();
    }
  }
  let unsubscribe = null, hello = null;
  function connect() {
    if (!bridge || unsubscribe) return;
    unsubscribe = bridge.onEvent(receive);
    hello = Promise.resolve().then(() => bridge.call("hello", {})).catch(() => null);
  }
  connect();

  const params = (sessionId, homeWorkspace) => (sessionId ? { sessionId } : { sessionId: null, homeWorkspace });
  const store = {
    available: !!bridge,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    version: () => version,
    /** Agent-opened tabs ({ owner, sessionId, id }): main.jsx shows the pane for that owner. */
    onOpened(listener) { openedListeners.add(listener); return () => openedListeners.delete(listener); },
    get(owner) { return owner ? owners.get(owner) ?? null : null; },
    async backend() { return hello ? await hello : null; },
    /** Load an owner's tabs once (re-listed after a window reload); resolves with its state. */
    load(owner, sessionId, homeWorkspace) {
      if (!bridge || !owner) return Promise.resolve(null);
      const state = ownerState(owner);
      if (state.loaded) return Promise.resolve(state);
      if (state.loading) return state.loading;
      state.loading = bridge.call("list", params(sessionId, homeWorkspace)).then((list) => {
        for (const info of Array.isArray(list) ? list : []) upsert(info);
        state.loaded = true;
        state.error = null;
        return state;
      }, (error) => { state.error = error?.message || String(error); throw error; }).finally(() => { state.loading = null; notify(); });
      return state.loading;
    },
    async create(owner, sessionId, homeWorkspace, size = {}, { cwd } = {}) {
      const info = await bridge.call("create", { ...params(sessionId, homeWorkspace), cols: size.cols, rows: size.rows, ...(typeof cwd === "string" && cwd ? { cwd } : {}) });
      upsert(info);
      ownerState(owner).active = info.id;
      notify();
      return info;
    },
    /** Shell mode ('!command' on a core without its own): a tab running the command; wait() returns its output. */
    async run(sessionId, command) {
      const info = await bridge.call("run", { sessionId, command });
      upsert(info);
      ownerState(sessionId).active = info.id;
      notify();
      return info;
    },
    wait(sessionId, id, timeoutMs) { return bridge.call("wait", { sessionId, id, timeoutMs }); },
    /** The New session page's terminals (its folder) move to the session its first prompt started. */
    async adopt(sessionId, homeWorkspace) {
      if (!bridge || !sessionId || !homeWorkspace) return [];
      const moved = await bridge.call("adopt", { sessionId, homeWorkspace }).catch(() => []);
      const list = Array.isArray(moved) ? moved : [];
      for (const info of list) upsert(info);
      if (list.length) notify();
      return list;
    },
    select(owner, id) {
      const state = ownerState(owner);
      if (state.active === id || !state.tabs.some((tab) => tab.id === id)) return;
      state.active = id;
      notify();
    },
    move(owner, id, delta) {
      const state = ownerState(owner);
      const index = state.tabs.findIndex((tab) => tab.id === id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= state.tabs.length) return;
      const tabs = [...state.tabs];
      tabs.splice(target, 0, ...tabs.splice(index, 1));
      state.tabs = tabs;
      notify();
    },
    async close(owner, sessionId, homeWorkspace, id) {
      drop(id, owner);
      notify();
      try { await bridge.call("close", { ...params(sessionId, homeWorkspace), id }); } catch {}
    },
    async rename(sessionId, homeWorkspace, id, title) {
      upsert(await bridge.call("rename", { ...params(sessionId, homeWorkspace), id, title }));
      notify();
    },
    async restart(sessionId, homeWorkspace, id) {
      upsert(await bridge.call("restart", { ...params(sessionId, homeWorkspace), id }));
      notify();
    },
    resize(sessionId, homeWorkspace, id, cols, rows) {
      return bridge.call("resize", { ...params(sessionId, homeWorkspace), id, cols, rows }).catch(() => null);
    },
    /** This window stopped showing the terminal: its size no longer limits the PTY (terminal-service.cjs viewers). */
    detach(sessionId, homeWorkspace, id) {
      return bridge.call("detach", { ...params(sessionId, homeWorkspace), id }).catch(() => null);
    },
    /** Which candidates are files, resolved from terminal `id`'s shell folder (then the session folder). */
    paths(sessionId, homeWorkspace, list, id = null) {
      return bridge.call("paths", { ...params(sessionId, homeWorkspace), paths: list, ...(id ? { id } : {}) }).catch(() => list.map(() => null));
    },
    /** ⌘K: the terminal's kept output is dropped too, so a reload, another window or read_terminal never brings it back. */
    clear(sessionId, homeWorkspace, id) {
      return bridge.call("clear", { ...params(sessionId, homeWorkspace), id }).catch(() => null);
    },
    input(id, data) {
      if (!bridge) return;
      if (data.includes("\r")) enterAt.set(id, Date.now());
      bridge.write(id, data);
    },
    lastEnter(id) { return enterAt.get(id) ?? 0; },
    /** The live view of a terminal, created through `factory(info)` and attached to its kept output on first use. */
    view(id, sessionId, homeWorkspace, factory) {
      let entry = views.get(id);
      if (entry) { entry.lastShown = Date.now(); return entry.view; }
      const info = [...owners.values()].flatMap((state) => state.tabs).find((tab) => tab.id === id) ?? null;
      entry = { view: factory(info), written: -1, queue: [], lastShown: Date.now(), info };
      views.set(id, entry);
      const current = entry;
      bridge.call("attach", { ...params(sessionId, homeWorkspace), id }).then((result) => {
        if (views.get(id) !== current) return;
        // The kept output was drawn at the PTY's size (another window's, maybe): replay it at that width, then fit the
        // pane again, so lines and prompts land where the shell put them.
        const term = current.view.term, size = result?.size;
        const replaySized = !!(result?.output && term && Number.isInteger(size?.cols) && Number.isInteger(size?.rows) && (term.cols !== size.cols || term.rows !== size.rows));
        if (replaySized) { try { term.resize(size.cols, size.rows); } catch {} }
        if (result?.output) current.view.write(result.output);
        if (replaySized) {
          const refit = () => { try { current.view.fit?.fit(); } catch {} if (views.get(id) === current && term.cols > 0) void store.resize(sessionId, homeWorkspace, id, term.cols, term.rows); };
          if (typeof term.write === "function" && result?.output) term.write("", refit); else refit();
        }
        current.written = Number.isFinite(result?.end) ? result.end : 0;
        const queued = current.queue;
        current.queue = null;
        for (const event of queued) {
          const data = unseenData(event, current.written);
          if (data) { current.view.write(data); current.written = event.end; }
        }
      }, () => { if (views.get(id) === current) { current.queue = null; current.written = 0; } });
      // Least recently shown views beyond the cap are disposed (their PTYs keep running).
      if (views.size > MAX_CACHED_TERMINALS) {
        const oldest = [...views.entries()].filter(([key]) => key !== id).sort((a, b) => a[1].lastShown - b[1].lastShown)[0];
        if (oldest) { try { oldest[1].view.dispose(); } catch {} views.delete(oldest[0]); }
      }
      return entry.view;
    },
    hasView(id) { return views.has(id); },
    /** Any tab of `owner` with a running command (the titlebar's "Terminal (command running)" dot). */
    busy(owner) { return !!owners.get(owner)?.tabs.some((tab) => tab.busy === true && tab.status === "running"); },
    dispose() { unsubscribe?.(); unsubscribe = null; for (const entry of views.values()) { try { entry.view.dispose(); } catch {} } views.clear(); },
  };
  return store;
}

// One store per window; tests build their own with a fake bridge.
let shared = null;
export function terminalStore() {
  if (!shared) shared = createTerminalStore();
  return shared;
}
