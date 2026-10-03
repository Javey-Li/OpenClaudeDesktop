// Customize (Skills / Connectors / Plugins) view model over the local Codex
// app-server catalog: skills/list, mcpServerStatus/list, plugin/installed and
// their notifications. Pure functions only; every row is derived from real
// protocol data (no cloud "last updated", author identity or marketplace).
//
// Official shapes traced in analysis/skills-mcp-20260920/source-contract.md:
// customize-skills-current.js:3005-3022 (columns), :3138-3170 (row), :3240-3255
// (author label); customize-plugins-current.js:1328-1350, :1479-1530;
// customize-connectors-current.js:1978-2007 (Connected/Connecting), :1683
// ("Server not responding"); customize-page-shell-current.js:628-655 (owner
// segments rendered only with >= 2 non-empty groups).

import { coreEngine } from "./session-engine-model.mjs";

export const SERVER_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

const text = (value) => (typeof value === "string" ? value : "");
const bySkillName = (a, b) => a.name.localeCompare(b.name);

export function skillDisplayName(skill) {
  return text(skill?.interface?.displayName).trim() || text(skill?.name);
}

export function skillDescription(skill) {
  return text(skill?.interface?.shortDescription).trim() || text(skill?.shortDescription).trim() || text(skill?.description).trim();
}

// Owner group of a skill row (official personal/shared/org segments mapped to
// what Codex reports): plugin-owned first, then the SkillScope.
export function skillGroup(skill) {
  if (skill?.pluginId) return "plugins";
  switch (skill?.scope) {
    case "user": return "personal";
    case "repo": return "repository";
    default: return "managed";
  }
}

export const SKILL_GROUP_LABELS = Object.freeze({
  all: "All", personal: "Personal", repository: "Repository", plugins: "Plugins", managed: "Managed",
});

// Official Hi: Anthropic / owner / "Your organization" / "You". Locally the
// scope is the only real identity signal; plugin rows show the plugin name.
// System skills ship with the core (DeepSeek Harness bundled skills).
export function skillAuthor(row, plugins = []) {
  if (row.pluginId) {
    const plugin = plugins.find((entry) => entry.id === row.pluginId);
    return plugin ? plugin.name : row.pluginId;
  }
  switch (row.scope) {
    case "user": return "You";
    case "repo": return "Repository";
    case "system": return "DeepSeek Harness";
    case "admin": return "Managed";
    default: return "—";
  }
}

// Flatten SkillsListEntry[] (one per cwd) into unique rows keyed by path, plus
// error rows for SkillErrorInfo. `updatedAt` (seconds) is attached by the main
// process from the real SKILL.md mtime and stays null when unknown.
export function skillRows(response, updatedAt = {}) {
  const entries = Array.isArray(response?.data) ? response.data : [];
  const rows = new Map();
  const errors = new Map();
  for (const entry of entries) {
    for (const skill of entry?.skills || []) {
      if (!skill || typeof skill.path !== "string" || !skill.path) continue;
      if (rows.has(skill.path)) continue;
      rows.set(skill.path, {
        kind: "skill",
        id: skill.path,
        path: skill.path,
        skillName: text(skill.name),
        name: skillDisplayName(skill),
        description: skillDescription(skill),
        scope: text(skill.scope) || "user",
        enabled: skill.enabled !== false,
        // The DeepSeek bridge's invocation policy (harness catalog.js); both stay
        // undefined on a Codex core, whose `enabled` is the only gate.
        userInvocable: typeof skill.userInvocable === "boolean" ? skill.userInvocable : undefined,
        modelInvocable: typeof skill.modelInvocable === "boolean" ? skill.modelInvocable : undefined,
        version: text(skill.version).trim() || null,
        pluginId: typeof skill.pluginId === "string" && skill.pluginId ? skill.pluginId : null,
        cwd: text(entry.cwd),
        dependencies: Array.isArray(skill.dependencies?.tools) ? skill.dependencies.tools : [],
        defaultPrompt: text(skill.interface?.defaultPrompt),
        updatedAt: Number.isFinite(updatedAt?.[skill.path]) ? updatedAt[skill.path] : null,
        group: skillGroup(skill),
      });
    }
    for (const error of entry?.errors || []) {
      if (!error || typeof error.path !== "string") continue;
      if (errors.has(error.path)) continue;
      errors.set(error.path, { kind: "error", id: `error:${error.path}`, path: error.path, name: baseName(error.path), message: text(error.message), cwd: text(entry.cwd) });
    }
  }
  return { skills: [...rows.values()].sort(bySkillName), errors: [...errors.values()] };
}

export function baseName(path) {
  const parts = String(path || "").split(/[\\/]/).filter(Boolean);
  if (parts.length && parts[parts.length - 1] === "SKILL.md") parts.pop();
  return parts.pop() || String(path || "");
}

// Segmented owner filter: only groups with rows, and the control is shown
// only when at least two groups are non-empty (official De).
export function skillGroupOptions(skills) {
  const counts = {};
  for (const row of skills) counts[row.group] = (counts[row.group] || 0) + 1;
  const present = ["personal", "repository", "plugins", "managed"].filter((group) => counts[group] > 0);
  return { show: present.length >= 2, options: ["all", ...present].map((value) => ({ value, label: SKILL_GROUP_LABELS[value], count: value === "all" ? skills.length : counts[value] })) };
}

export function filterSkills(skills, { query = "", group = "all" } = {}) {
  const term = query.trim().toLowerCase();
  return skills.filter((row) => (group === "all" || row.group === group)
    && (!term || `${row.name} ${row.skillName} ${row.description}`.toLowerCase().includes(term)));
}

export function filterErrors(errors, { query = "" } = {}) {
  const term = query.trim().toLowerCase();
  return errors.filter((row) => !term || `${row.name} ${row.path} ${row.message}`.toLowerCase().includes(term));
}

// Apply a skills/config/write response to the rows (row badge follows
// effectiveEnabled, never the optimistic request).
export function applySkillEnabled(skills, path, effectiveEnabled) {
  return skills.map((row) => (row.path === path ? { ...row, enabled: effectiveEnabled !== false } : row));
}

// Whether '/' and Add › Skills offer a skill (official: the session's
// user-invocable skills, cc183b3ab :619-700). A Codex core reports only
// `enabled`; the DeepSeek bridge also reports the invocation policy, where a
// slash-only skill (disable-model-invocation) has enabled false but stays
// user-invocable and a `user-invocable: false` skill is model-only.
export function skillInvocable(row) {
  return row?.modelInvocable === undefined ? !!row?.enabled : row.userInvocable !== false;
}

// ccb4abbdf export r "Trigger" fact (shown when userInvocable is reported):
// "Auto" for a model-only skill, "Slash command + auto" otherwise; a
// model-hidden skill reads "Slash command" (customize-skill-detail :118).
export function skillTrigger(row, copy = customizeCore()) {
  if (row?.userInvocable === undefined) return null;
  if (row.userInvocable === false) return { label: "Auto", tooltip: copy.skillTriggerTooltips.auto };
  if (row.modelInvocable === false) return { label: "Slash command", tooltip: copy.skillTriggerTooltips.slash };
  return { label: "Slash command + auto", tooltip: copy.skillTriggerTooltips.both };
}

// Composer Add menu → Skills submenu items (official Ay/jy): user-invocable
// skills (skillInvocable), icon Scroll, sorted by label.
export function skillMenuItems(skills) {
  return skills.filter(skillInvocable).map((row) => ({
    type: "skill", icon: "Scroll", label: row.name, skillName: row.skillName, path: row.path, description: row.description, pluginId: row.pluginId,
  })).sort((a, b) => a.label.localeCompare(b.label));
}

// ---------------------------------------------------------------------------
// Core-aware copy and controls (boot.core: main.cjs coreInfo). A Codex
// app-server keeps skills and MCP servers in ~/.codex/config.toml, which
// skills/config/write and config/batchWrite edit. The DeepSeek core reads
// skills from Harness roots, has no per-skill switch (capabilities.skillToggle
// false) and loads MCP servers from its own profile patch, which it does not
// write (capabilities.mcpConfigWrite false). Servers without these
// capabilities (Codex, UI fixtures) keep every control.

export const CODEX_CONFIG_FILE = "~/.codex/config.toml";
export const MCP_CLIENT_PACKAGE = "@deepseek-ai/dsh-mcp-client";

export function customizeCore(core) {
  const deepseek = coreEngine(core) === "deepseek";
  const capabilities = core?.capabilities || {};
  const configPath = typeof core?.configPath === "string" && core.configPath ? core.configPath : null;
  const configFile = deepseek ? configPath || "the DeepSeek core profile" : CODEX_CONFIG_FILE;
  return {
    deepseek,
    skillToggle: capabilities.skillToggle !== false,
    mcpConfigWrite: capabilities.mcpConfigWrite !== false,
    // The DeepSeek core's dsh-plugin-manager (harness plugins.js): install, remove and turn bundles on/off.
    pluginManage: capabilities.pluginManage === true,
    configPath,
    configFile,
    // DeepSeek: dsh-skill-filesystem project and home roots, in precedence order.
    skillRoots: deepseek
      ? ["<project>/.dsh/skills", "<project>/.agents/skills", "~/.dsh/skills", "~/.agents/skills"]
      : ["~/.codex/skills", "~/.agents/skills", "<workspace>/.agents/skills"],
    addConnectorNote: deepseek ? `Saved to ${configFile}.` : `Saved to ${CODEX_CONFIG_FILE}, shared with the Codex CLI.`,
    // Source copy that names the assistant, with Claude → DeepSeek:
    // c6f9b6c10 s("skills"), customize-skills :3104-3108, customize-connectors
    // :3693-3697 (its claude.ai "Learn more" link is not drawn) and
    // customize-plugins :1418-1421.
    skillDescriptionTooltip: "DeepSeek uses these descriptions when deciding which skills to use in chat.",
    skillsEmpty: "Add skills to extend DeepSeek’s capabilities.",
    connectorsEmpty: "Unlock more with DeepSeek when you connect your team’s tools.",
    pluginsEmpty: "Give DeepSeek role-level expertise with plugins",
    // ccb4abbdf r Trigger tooltips (hjJUiuUPEX / eFWPHBACre); a slash-only
    // skill keeps the first sentence only, since it never runs automatically.
    skillTriggerTooltips: {
      auto: "DeepSeek runs this skill automatically when it’s relevant to your request.",
      both: "Appears in the / menu. DeepSeek can also run it automatically when relevant.",
      slash: "Appears in the / menu.",
    },
    // c36b3644c _e tab descriptions (knl1HOkRzw / 7E0XKPYZcj / jBsLHc22T9).
    pluginTabDescriptions: {
      skills: "Invoke by typing / in chat, or let DeepSeek use them automatically for relevant tasks.",
      connectors: "Tools and data sources this plugin connects to. Connect each one so DeepSeek can use it.",
      hooks: "Commands this plugin runs automatically — on session events, or when its skills are used.",
    },
    // c5fb58ef0 personal removal dialog body (xonrKBdErN + GXIZPZXIvC); its
    // claude.ai "project files synced" sentence has no local counterpart.
    connectorRemoveNote: "However, DeepSeek won’t be able to access new content or perform new tasks.",
  };
}

// Connector action toasts (N() addError / addSuccess): c08e79e85 Sn
// (KODL04UyPx, MMd95RjV2L), customize-connectors :2565-2590 (tDkUqq5UZf) and
// c5fb58ef0 (6ZBacUc8Qf).
export const CONNECTOR_TOASTS = Object.freeze({
  connectFailed: "Connection to server failed. You can try again.",
  refreshFailed: "Couldn’t refresh tools list. You can try again.",
  refreshed: "Tools list refreshed",
  removeFailed: "Failed to remove server",
});

// ---------------------------------------------------------------------------
// MCP servers ("Connectors")

export const MCP_STATUS_LABELS = Object.freeze({
  connected: "Connected",
  connecting: "Connecting",
  unreachable: "Server not responding",
  signIn: "Sign-in required",
  disabled: "Disabled",
  notStarted: "Not started",
});

// runtimeStatus is null whenever no thread runtime backs the listing; that is
// "Not started", never "Connected" (official rows only show Check for a live
// connection).
export function mcpStatusKind(server) {
  const runtime = server?.runtimeStatus ?? null;
  if (runtime === "connected") return "connected";
  if (runtime === "starting") return "connecting";
  if (runtime === "failed" || runtime === "cancelled") return "unreachable";
  if (runtime === "authenticationRequired" || server?.authStatus === "notLoggedIn") return "signIn";
  if (runtime === "disabled") return "disabled";
  return "notStarted";
}

export function mcpRows(response) {
  const data = Array.isArray(response?.data) ? response.data : [];
  return data.filter((server) => server && typeof server.name === "string" && server.name).map((server) => ({
    id: server.name,
    name: server.name,
    title: text(server.serverInfo?.title).trim() || server.name,
    version: text(server.serverInfo?.version),
    description: text(server.serverInfo?.description),
    websiteUrl: text(server.serverInfo?.websiteUrl),
    runtimeStatus: server.runtimeStatus ?? null,
    authStatus: text(server.authStatus) || "unknown",
    pluginId: typeof server.pluginId === "string" && server.pluginId ? server.pluginId : null,
    tools: server.tools && typeof server.tools === "object" ? Object.keys(server.tools) : [],
    resourceCount: Array.isArray(server.resources) ? server.resources.length : 0,
    error: null,
    kind: mcpStatusKind(server),
  })).sort((a, b) => a.name.localeCompare(b.name));
}

// mcpServer/startupStatus/updated {threadId,name,status,error,failureReason}
// patches a row in place. Returns {rows, relist}: ready/failed are settled
// states worth a fresh mcpServerStatus/list; starting only marks the row.
export function patchMcpRow(rows, notification, { threadId = null } = {}) {
  const params = notification?.params ?? notification ?? {};
  if (typeof params.name !== "string") return { rows, relist: false };
  if (params.threadId && threadId && params.threadId !== threadId) return { rows, relist: false };
  const index = rows.findIndex((row) => row.name === params.name);
  if (index < 0) return { rows, relist: params.status === "ready" || params.status === "failed" };
  const runtimeStatus = params.status === "starting" ? "starting"
    : params.status === "ready" ? "connected"
    : params.status === "failed" ? (params.failureReason === "reauthenticationRequired" ? "authenticationRequired" : "failed")
    : params.status === "cancelled" ? "cancelled" : rows[index].runtimeStatus;
  const next = rows.slice();
  const patched = { ...rows[index], runtimeStatus, error: text(params.error) || null };
  patched.kind = mcpStatusKind(patched);
  next[index] = patched;
  return { rows: next, relist: params.status === "ready" || params.status === "failed" };
}

export function filterMcp(rows, { query = "" } = {}) {
  const term = query.trim().toLowerCase();
  return rows.filter((row) => !term || `${row.name} ${row.title} ${row.description}`.toLowerCase().includes(term));
}

// customize-connectors Ja (:3013-3023): the uncontained "Filter by status"
// segments, shown above the table whenever at least one connector exists.
export const MCP_STATUS_FILTERS = Object.freeze([
  Object.freeze({ value: "all", label: "All" }),
  Object.freeze({ value: "connected", label: "Connected" }),
  Object.freeze({ value: "notConnected", label: "Not connected" }),
]);

// :3361-3420 Ge: "connected" keeps the connected rows (M), "notConnected" the
// needs-attention and other rows (P). Locally a row is connected only when its
// runtime reports it (kind "connected"); connecting, broken, sign-in, disabled
// and never-started rows all count as not connected.
export function filterMcpByStatus(rows, status = "all") {
  if (status === "connected") return rows.filter((row) => row.kind === "connected");
  if (status === "notConnected") return rows.filter((row) => row.kind !== "connected");
  return rows;
}

// What the connectors list body shows (customize-connectors :3556-3735):
// the status filter whenever any connector exists; the table when the search
// and filter leave rows (Ve); "Nothing connected." / "Nothing to connect."
// for an empty filter without a search; otherwise Ee — the search no-match
// line, or the empty state when there is nothing at all.
export function connectorsListView({ total = 0, visible = 0, status = "all", query = "" } = {}) {
  const searching = query.trim() !== "";
  const table = visible > 0;
  return {
    filter: total > 0,
    table,
    filterEmpty: !table && status !== "all" && !searching ? (status === "connected" ? "Nothing connected." : "Nothing to connect.") : null,
    empty: !table && (searching || status === "all") ? (searching ? "search" : "empty") : null,
  };
}

// Connector drill-in body (c08e79e85 En) by row state:
// - connected → the px-6 pb-6 page (header row, description, tools);
// - connecting → the centred spinner with "Checking connection…" (n && !isConnected);
// - everything else → the centred not-connected column. `issue` (En I, a
//   failure) draws the "Connection issue" title and the "stopped working"
//   message, and vn's label becomes "Reconnect": a failed/cancelled server,
//   or a runtime that asked to authenticate again (failureReason
//   reauthenticationRequired). A plain Codex notLoggedIn never says a previous
//   sign-in expired, so it reads "not connected yet" with Sign in;
//   never-started rows get Connect (the reload). A disabled server cannot be
//   started from here, so its Connect is disabled (the source's unavailable
//   connector also shows a disabled Connect).
export const CONNECTOR_ACTION_LABELS = Object.freeze({ reconnect: "Reconnect", signIn: "Sign in", connect: "Connect" });

export function connectorDetailState(row) {
  const state = (view, issue, action, disabled = false) => ({ view, issue, action, label: action ? (issue ? "Reconnect" : CONNECTOR_ACTION_LABELS[action]) : null, disabled });
  switch (row?.kind) {
    case "connected": return state("connected", false, null);
    case "connecting": return state("checking", false, null);
    case "unreachable": return state("disconnected", true, "reconnect");
    case "signIn": return state("disconnected", row.runtimeStatus === "authenticationRequired", "signIn");
    case "disabled": return state("disconnected", false, "connect", true);
    default: return state("disconnected", false, "connect");
  }
}

// En message copy (:5QF1f3BckZ / :3lTGLnIzRn), {name} = the connector's display name.
export function connectorDetailMessage(state, name) {
  return state.issue ? `Your connection to ${name} stopped working. Reconnect to continue.` : `You’re not connected to ${name} yet.`;
}

export function validateServerName(name) {
  if (typeof name !== "string" || !name.trim()) return "Enter a connector name.";
  if (!SERVER_NAME_PATTERN.test(name)) return "Use 1–64 letters, digits, dots, dashes or underscores for the name.";
  return "";
}

// Split an arguments string on whitespace; quotes are not interpreted.
export function splitArguments(value) {
  return String(value || "").trim().split(/\s+/).filter(Boolean);
}

// mcp_servers.<name> table value written to ~/.codex/config.toml: either a
// stdio server {command,args} or a streamable-HTTP server {url}.
export function mcpServerConfigValue({ command, args = [], url } = {}) {
  const cmd = text(command).trim();
  const link = text(url).trim();
  if (cmd) {
    const list = Array.isArray(args) ? args.filter((item) => typeof item === "string" && item) : splitArguments(args);
    return list.length ? { command: cmd, args: list } : { command: cmd };
  }
  if (link) {
    let parsed;
    try { parsed = new URL(link); } catch { throw new Error("Enter a valid http(s) URL."); }
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Enter a valid http(s) URL.");
    return { url: parsed.href };
  }
  throw new Error("Enter a command or a URL.");
}

export function mcpBatchWriteParams(name, value) {
  const problem = validateServerName(name);
  if (problem) throw new Error(problem);
  return { edits: [{ keyPath: `mcp_servers.${name}`, value, mergeStrategy: value === null ? "replace" : "upsert" }], reloadUserConfig: true };
}

// ---------------------------------------------------------------------------
// Plugins (installed marketplaces only)

export function pluginRows(response, skills = []) {
  const marketplaces = Array.isArray(response?.marketplaces) ? response.marketplaces : [];
  const rows = [];
  const seen = new Set();
  for (const marketplace of marketplaces) {
    const marketplaceName = text(marketplace?.interface?.displayName).trim() || text(marketplace?.name);
    for (const plugin of marketplace?.plugins || []) {
      if (!plugin || plugin.installed !== true || typeof plugin.id !== "string" || seen.has(plugin.id)) continue;
      seen.add(plugin.id);
      rows.push({
        id: plugin.id,
        pluginName: text(plugin.name),
        name: text(plugin.interface?.displayName).trim() || text(plugin.name),
        description: text(plugin.interface?.shortDescription).trim(),
        author: text(plugin.interface?.developerName).trim(),
        enabled: plugin.enabled !== false,
        source: text(plugin.source?.type) || "local",
        marketplaceName,
        marketplacePath: typeof marketplace?.path === "string" ? marketplace.path : null,
        skillCount: skills.filter((skill) => skill.pluginId === plugin.id).length,
        updatedAt: null,
        version: typeof plugin.version === "string" ? plugin.version : null,
        // DeepSeek bridge field (catalog.js pluginSummary): what management may do with this bundle.
        removable: plugin.codeDesktop?.removable === true,
        manageable: !!plugin.codeDesktop && !plugin.codeDesktop.readOnlyReason,
        loadError: text(plugin.codeDesktop?.loadError).trim(),
      });
    }
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

// shared-4 _L (customize-plugins :1307 h = ge(e)): group the rows by display
// name; a unique name is {name}, and every row of a colliding name also gets
// the muted suffix "({marketplace display name})" (none without a marketplace).
export function pluginDisplayNames(rows) {
  const groups = new Map();
  for (const row of rows) {
    const list = groups.get(row.name);
    if (list) list.push(row); else groups.set(row.name, [row]);
  }
  const names = new Map();
  for (const [name, list] of groups) {
    if (list.length === 1) { names.set(list[0].id, { name }); continue; }
    for (const row of list) names.set(row.id, row.marketplaceName ? { name, suffix: `(${row.marketplaceName})` } : { name });
  }
  return names;
}

// :1308-1318 te: the search also matches the collision suffix (the marketplace
// name alone no longer matches, as in the source).
export function filterPlugins(rows, { query = "" } = {}) {
  const term = query.trim().toLowerCase();
  if (!term) return rows;
  const names = pluginDisplayNames(rows);
  return rows.filter((row) => `${row.name} ${row.pluginName} ${row.description} ${names.get(row.id)?.suffix ?? ""}`.toLowerCase().includes(term));
}

// Composer Add menu → Plugins submenu (official zv): one submenu per enabled
// plugin that owns enabled skills; duplicate display names get " (local)".
export function pluginMenuGroups(plugins, skills) {
  const counts = new Map();
  for (const plugin of plugins) counts.set(plugin.name, (counts.get(plugin.name) || 0) + 1);
  return plugins.filter((plugin) => plugin.enabled).map((plugin) => {
    const label = counts.get(plugin.name) > 1 && plugin.source === "local" ? `${plugin.name} (local)` : plugin.name;
    // Cr's hover card reads sourcePluginName for plugin-owned skills.
    return { id: plugin.id, label, items: skillMenuItems(skills.filter((skill) => skill.pluginId === plugin.id)).map((item) => ({ ...item, sourcePluginName: label })) };
  }).filter((group) => group.items.length > 0);
}

// Official rows format updatedAt with dateStyle "short"; the local value is a
// Unix timestamp in seconds from fs.stat.
export function shortDate(seconds, locale = undefined) {
  if (!Number.isFinite(seconds)) return "";
  return new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(new Date(seconds * 1000));
}

// Debounce plan for skills/changed: coalesce bursts, never wait longer than
// the window (the acceptance bound is 500 ms from the notification).
export const SKILLS_CHANGED_DEBOUNCE_MS = 250;

// ---------------------------------------------------------------------------
// Plugin installs (DeepSeek core, harness plugins.js over dsh-plugin-manager).

const INSTALL_FAILURES = {
  "pnpm-missing": "The package manager (pnpm) could not be started.",
  timeout: "The installation timed out.",
  "not-found": "No package was found for this spec.",
  "no-matching-version": "No version of this package matches.",
  network: "The package registry could not be reached. Check your connection and try again.",
  "disk-full": "There is not enough disk space.",
  permission: "The plugin folder is not writable.",
  "build-blocked": "The package needs to run build scripts.",
  integrity: "The downloaded package failed its integrity check.",
};
const MANAGEMENT_ERRORS = {
  "not-bundle": "This package is not a DeepSeek Harness plugin.",
  "not-removable": "This plugin is part of Code Desktop and cannot be removed.",
  "management-required": "Code Desktop needs this plugin.",
  "invalid-spec": "Enter a package name, absolute path, git URL or tarball URL.",
  "incompatible-version": "This plugin does not support this DeepSeek Harness version.",
  "bundle-in-use": "This plugin is in use and cannot be removed now.",
};

// A finished install/remove/toggle (dsh-plugin-manager ChangeResult) → what the page says.
export function pluginChangeOutcome(result) {
  if (!result || typeof result !== "object") return { ok: false, message: "The plugin change did not finish." };
  if (result.application === "cancelled") return { ok: false, cancelled: true, message: "Installation cancelled." };
  const pending = Array.isArray(result.pendingBuilds) ? result.pendingBuilds.filter((name) => typeof name === "string") : [];
  if (result.error || result.application === "failed" || (result.stage === "install" && result.changed !== true)) {
    const kind = result.packageResult?.kind;
    const incompatible = Array.isArray(result.error?.incompatible) && result.error.incompatible.length
      ? ` (${result.error.incompatible.map((item) => `${item.name}@${item.version}`).join(", ")})` : "";
    const message = (result.error?.code && MANAGEMENT_ERRORS[result.error.code] ? MANAGEMENT_ERRORS[result.error.code] + incompatible : "")
      || (kind && INSTALL_FAILURES[kind]) || text(result.error?.diagnostic).trim() || "The plugin change failed.";
    return { ok: false, message, pendingBuilds: pending, output: text(result.packageResult?.output) };
  }
  return { ok: true, restartRequired: result.application === "restart-required" && result.changed !== false, bundle: text(result.bundle) || text(result.target) };
}

// install-state progress → one status line.
export function pluginInstallStatus(install) {
  if (!install) return "";
  if (install.phase === "cancelling") return "Cancelling…";
  if (install.phase === "applying") return "Applying…";
  const attempt = install.attempt;
  const registry = attempt?.registry ? ` from ${attempt.registry}` : "";
  const count = attempt && attempt.total > 1 ? ` (${attempt.index + 1}/${attempt.total})` : "";
  return `Installing${registry}${count}…`;
}

export const PLUGIN_LOG_LIMIT = 20000;
export const appendPluginLog = (log, chunk) => { const next = (log || "") + (chunk || ""); return next.length > PLUGIN_LOG_LIMIT ? next.slice(-PLUGIN_LOG_LIMIT) : next; };
