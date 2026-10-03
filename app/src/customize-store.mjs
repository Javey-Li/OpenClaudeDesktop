// Renderer-side cache for the Customize catalog shared by the settings pages
// and the composer Add menu. One instance per window; loads go through the
// main-process "customize" operation and notifications refresh the cache:
//   skills/changed                  → debounced skills/list (forceReload)
//   mcpServer/startupStatus/updated → patch the row, re-list on ready/failed
//   mcpServer/oauthLogin/completed  → re-list
// Every dependency (call, timers) is injected so the logic is unit-testable.
import { SKILLS_CHANGED_DEBOUNCE_MS, applySkillEnabled, mcpRows, patchMcpRow, pluginRows, skillRows } from "./customize-model.mjs";

const IDLE = Object.freeze({ status: "idle", error: "", at: 0 });

export function createCustomizeStore({ call, setTimeout: schedule = globalThis.setTimeout, clearTimeout: cancel = globalThis.clearTimeout, now = Date.now } = {}) {
  let state = {
    skills: { ...IDLE, skills: [], errors: [], cwd: undefined },
    plugins: { ...IDLE, rows: [], raw: null, cwd: undefined },
    mcp: { ...IDLE, rows: [], threadId: null, cwd: "" },
  };
  const listeners = new Set();
  const inflight = { skills: null, plugins: null, mcp: null };
  const params = { skills: {}, plugins: {}, mcp: {} };
  let generation = { skills: 0, plugins: 0, mcp: 0 };
  let skillsTimer = null, mcpTimer = null;

  const emit = () => { for (const listener of listeners) listener(state); };
  const patch = (key, value) => { state = { ...state, [key]: { ...state[key], ...value } }; emit(); };

  // A workspace switch must re-list: the cached rows belong to the previous
  // cwd and the main process re-keys knownSkillPaths on every skills/list.
  async function loadSkills({ cwd, force = false } = {}) {
    const nextCwd = cwd === undefined ? params.skills.cwd : cwd;
    const changed = nextCwd !== params.skills.cwd;
    params.skills.cwd = nextCwd;
    if (!force && !changed && state.skills.status === "ready") return state.skills;
    if (inflight.skills && !force && !changed) return inflight.skills;
    const id = ++generation.skills;
    patch("skills", { status: state.skills.status === "ready" && !changed ? "ready" : "loading", loading: true, error: "", cwd: nextCwd });
    const promise = (async () => {
      try {
        const result = await call("customize", { operation: "skills", cwd: params.skills.cwd, forceReload: !!force });
        if (id !== generation.skills) return state.skills;
        const rows = skillRows(result?.data ? result : { data: [] }, result?.updatedAt || {});
        patch("skills", { status: "ready", loading: false, skills: rows.skills, errors: rows.errors, error: "", at: now() });
        // Plugin skill counts derive from these rows.
        if (state.plugins.raw) patch("plugins", { rows: pluginRows(state.plugins.raw, rows.skills) });
      } catch (error) {
        if (id !== generation.skills) return state.skills;
        patch("skills", { status: state.skills.status === "ready" ? "ready" : "error", loading: false, error: error?.message || "Skills could not be loaded." });
      } finally { if (inflight.skills === promise) inflight.skills = null; }
      return state.skills;
    })();
    inflight.skills = promise;
    return promise;
  }

  async function loadPlugins({ cwd, force = false } = {}) {
    const nextCwd = cwd === undefined ? params.plugins.cwd : cwd;
    const changed = nextCwd !== params.plugins.cwd;
    params.plugins.cwd = nextCwd;
    if (!force && !changed && state.plugins.status === "ready") return state.plugins;
    if (inflight.plugins && !force && !changed) return inflight.plugins;
    const id = ++generation.plugins;
    patch("plugins", { status: state.plugins.status === "ready" && !changed ? "ready" : "loading", loading: true, error: "", cwd: nextCwd });
    const promise = (async () => {
      try {
        const result = await call("customize", { operation: "plugins", cwd: params.plugins.cwd });
        if (id !== generation.plugins) return state.plugins;
        patch("plugins", { status: "ready", loading: false, raw: result, rows: pluginRows(result, state.skills.skills), error: "", at: now() });
      } catch (error) {
        if (id !== generation.plugins) return state.plugins;
        patch("plugins", { status: state.plugins.status === "ready" ? "ready" : "error", loading: false, error: error?.message || "Plugins could not be loaded." });
      } finally { if (inflight.plugins === promise) inflight.plugins = null; }
      return state.plugins;
    })();
    inflight.plugins = promise;
    return promise;
  }

  async function loadMcp({ threadId, cwd, force = false } = {}) {
    const nextThread = threadId === undefined ? params.mcp.threadId ?? null : threadId;
    const nextCwd = cwd === undefined ? params.mcp.cwd : cwd;
    const changed = nextThread !== (params.mcp.threadId ?? null) || nextCwd !== params.mcp.cwd;
    params.mcp.threadId = nextThread; params.mcp.cwd = nextCwd;
    if (!force && !changed && state.mcp.status === "ready") return state.mcp;
    if (inflight.mcp && !force && !changed) return inflight.mcp;
    const id = ++generation.mcp;
    patch("mcp", { status: state.mcp.status === "ready" && !changed ? "ready" : "loading", loading: true, error: "", threadId: nextThread, cwd: nextCwd });
    const promise = (async () => {
      try {
        const result = await call("customize", { operation: "mcp", threadId: nextThread, cwd: nextCwd });
        if (id !== generation.mcp) return state.mcp;
        patch("mcp", { status: "ready", loading: false, rows: mcpRows(result), error: "", at: now() });
      } catch (error) {
        if (id !== generation.mcp) return state.mcp;
        patch("mcp", { status: state.mcp.status === "ready" ? "ready" : "error", loading: false, error: error?.message || "Connectors could not be loaded." });
      } finally { if (inflight.mcp === promise) inflight.mcp = null; }
      return state.mcp;
    })();
    inflight.mcp = promise;
    return promise;
  }

  // Skill toggle: optimistic off, the row follows effectiveEnabled from the
  // response, and a failure restores the previous flag for the caller to announce.
  async function setSkillEnabled(path, enabled) {
    const previous = state.skills.skills.find((row) => row.path === path);
    if (!previous) throw new Error("Unknown skill.");
    patch("skills", { skills: applySkillEnabled(state.skills.skills, path, enabled) });
    try {
      const result = await call("customize", { operation: "skill-toggle", path, enabled });
      patch("skills", { skills: applySkillEnabled(state.skills.skills, path, result?.effectiveEnabled) });
      return result;
    } catch (error) {
      patch("skills", { skills: applySkillEnabled(state.skills.skills, path, previous.enabled) });
      throw error;
    }
  }

  function scheduleSkillsReload() {
    if (state.skills.status === "idle") return;
    cancel(skillsTimer);
    skillsTimer = schedule(() => { skillsTimer = null; loadSkills({ force: true }); }, SKILLS_CHANGED_DEBOUNCE_MS);
  }
  function scheduleMcpReload() {
    if (state.mcp.status === "idle") return;
    cancel(mcpTimer);
    mcpTimer = schedule(() => { mcpTimer = null; loadMcp({ force: true }); }, SKILLS_CHANGED_DEBOUNCE_MS);
  }

  function observe(event) {
    if (!event || typeof event.method !== "string") return;
    if (event.method === "skills/changed") scheduleSkillsReload();
    else if (event.method === "mcpServer/startupStatus/updated") {
      if (state.mcp.status === "idle") return;
      const result = patchMcpRow(state.mcp.rows, event.params, { threadId: params.mcp.threadId ?? null });
      if (result.rows !== state.mcp.rows) patch("mcp", { rows: result.rows });
      if (result.relist) scheduleMcpReload();
    } else if (event.method === "mcpServer/oauthLogin/completed") scheduleMcpReload();
  }

  function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  function dispose() { cancel(skillsTimer); cancel(mcpTimer); listeners.clear(); }

  return { getSnapshot: () => state, subscribe, loadSkills, loadPlugins, loadMcp, setSkillEnabled, observe, dispose,
    get params() { return params; } };
}
