// The Preview pane's pure logic (source-preview-pane.jsx; main-process side: electron/preview-service.cjs).
// Copy follows the 2.2553.1 legacy Preview pane (panes-tile-current.js G_/bv/N_/Vv/Jv).
import { t } from "../electron/i18n/index.mjs";
import { stripAnsi } from "./ansi-model.mjs";
import { commandRowLabel } from "./command-row-model.mjs";
import { genericToolLabel, isGenericTool } from "./generic-tool-model.mjs";

export const PREVIEW_PANE = "preview";
export const VIEWPORT_PRESETS = Object.freeze([
  { value: "responsive", label: "Responsive" },
  { value: "mobile", label: "Mobile", size: "375 × 812" },
  { value: "tablet", label: "Tablet", size: "768 × 1024" },
]);
export const COLOR_SCHEMES = Object.freeze([
  { value: "system", label: "System", icon: "Computer" },
  { value: "light", label: "Light", icon: "Sun" },
  { value: "dark", label: "Dark", icon: "Moon" },
]);
export const LOGS_HEIGHT = Object.freeze({ initial: 200, min: 80, maxRatio: 0.6 });
export const ADD_SERVER_PROMPT = "Detect this project's dev servers, write them to .claude/launch.json, then call preview_start.";

/** The URL field's two tones: host (and port) in secondary, the rest in muted (Vv). */
export function urlParts(url) {
  if (typeof url !== "string" || !url || url === "about:blank") return { host: "", rest: "" };
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "file:") {
      const file = decodeURIComponent(parsed.pathname);
      const slash = file.lastIndexOf("/");
      return { host: slash >= 0 ? file.slice(slash + 1) : file, rest: "" };
    }
    const rest = `${parsed.pathname === "/" ? "" : parsed.pathname}${parsed.search}${parsed.hash}`;
    return { host: parsed.host, rest };
  } catch {
    return { host: url, rest: "" };
  }
}

/** A server row's status text and tone. */
export function serverStatus(server) {
  switch (server?.status) {
    case "running": return { label: t("Running"), tone: "running" };
    case "starting": return { label: t("Starting…"), tone: "starting" };
    case "stopping": return { label: t("Stopping…"), tone: "starting" };
    case "failed": return { label: t("Failed to start"), tone: "failed" };
    default: return { label: t("Not running"), tone: "stopped" };
  }
}

/** Server rows for the start page and the menu: every configuration, with its live server when there is one. */
export function serverRows(state) {
  const live = new Map((state?.servers ?? []).map((server) => [server.name.toLowerCase(), server]));
  return (state?.launch?.configs ?? []).map((config) => {
    const server = live.get(config.name.toLowerCase()) ?? null;
    const status = server?.status ?? "stopped";
    return { name: config.name, port: server?.port ?? config.port, url: server?.url ?? config.url, attach: config.attach, status, error: server?.error ?? null,
      running: status === "running", busy: status === "starting" || status === "stopping" };
  });
}

// Current cf580efe9 yt: configured rows first, followed by live processes
// whose configuration was removed. Their Stop action must remain reachable.
export function serverMenuRows(state) {
  const configured = serverRows(state);
  const names = new Set(configured.map(row => row.name.toLowerCase()));
  return [...configured, ...(state?.servers ?? []).filter(server => !names.has(server.name.toLowerCase())).map(server => ({
    ...server, running: server.status === 'running', busy: server.status === 'starting' || server.status === 'stopping',
  }))];
}
export const anyServerRunning = (state) => (state?.servers ?? []).some((server) => server.status === "running" || server.status === "starting");

/** The server whose problem the pane shows: the last one started that failed. */
export function failedServer(state, lastStarted) {
  const failed = (state?.servers ?? []).filter((server) => server.status === "failed");
  return failed.find((server) => server.name === lastStarted) ?? (lastStarted ? null : failed[0] ?? null);
}

/** What a server failure code says to the user (the message from main is model-facing English). */
export function serverErrorText(error, name) {
  switch (error?.code) {
    case "not-found": return t("The command for {name} wasn’t found. Check “runtimeExecutable” in .claude/launch.json.", { name });
    case "port-in-use": return t("Port {port} is already in use. Stop whatever is using it, or set “autoPort”: true in .claude/launch.json.", { port: /Port (\d+)/.exec(error.message ?? "")?.[1] ?? "" });
    case "port-held": return t("Port {port} is already in use by a dev server in another session. Stop that server, then try again.", { port: heldPort(error) ?? "" });
    case "exited": return t("The dev server exited during startup. Check its output below.");
    case "timeout": return t("The dev server didn’t answer in time.");
    case "no-config": return t("This folder has no .claude/launch.json yet.");
    case "no-server": return t("{name} isn’t in .claude/launch.json.", { name });
    default: return error?.message ? String(error.message) : t("Couldn’t start the dev server.");
  }
}

// ca80fca8d xq: the port another session's dev server holds (the start-failed card then says so instead of sending the
// error to the agent). Locally main sets error.heldPort with code "port-held" (preview-service.cjs spawnServer).
export function heldPort(error) {
  if (Number.isInteger(error?.heldPort) && error.heldPort > 0) return error.heldPort;
  const match = /^Port (\d+) is in use by another chat's dev server/.exec(String(error?.message ?? ""));
  return match ? Number(match[1]) : undefined;
}

/** The start failure as one text (the reference's start error): the message, then the output tail without colors. */
export function startFailureText(error, lines = []) {
  const output = (lines ?? []).map((line) => stripAnsi(String(line))).filter((line, index) => !(index === 0 && line.startsWith("$ ")));
  return [String(error?.message ?? "").trim(), output.slice(-40).join("\n").trim()].filter(Boolean).join("\n\n");
}

/** cf580efe9 Er: the failure card's chip, the last non-empty line of the error. */
export function failureLogLine(text) {
  const lines = String(text ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
  return lines[lines.length - 1];
}

/** ca80fca8d kq: what a start failure sends to the session's agent (submitToChat). */
export function startFailurePrompt(text) {
  return `The dev server failed to start with the following error:\n\n\`\`\`\n${text}\n\`\`\`\n\nFix, then call preview_start to start the server.`;
}

/** Log line tint (Jv): danger for errors, warning for warnings. */
export function logTone(line) {
  if (/\bERROR\b|\bERR!|\bFATAL\b|\bFAIL(?:ED|URE)?\b/i.test(line)) return "danger";
  if (/\bWARN(ING)?\b/i.test(line)) return "warning";
  return null;
}

/** The page error a load failure shows, or null. */
export function pageError(state) {
  const error = state?.error;
  if (!error) return null;
  if (error.code === "blocked") return { title: t("Couldn’t open this address"), body: error.description ? t(error.description) : "" };
  if (error.code === "crashed") return { title: t("The page stopped working"), body: t("Reload to try again.") };
  const refused = /CONNECTION_REFUSED|ERR_CONNECTION_RESET|ADDRESS_UNREACHABLE/.test(error.description ?? "");
  return { title: t("Couldn’t load this preview"), body: refused ? t("Nothing is answering at {url}. Is the dev server running?", { url: error.url || state.url }) : t("{reason} ({url})", { reason: error.description || t("The page failed to load."), url: error.url || state.url }) };
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0"]);
/**
 * The dev server of this folder the page comes from (its origin is the server's: same port, same or loopback host),
 * else null. records: only servers OpenClaude Desktop started (state.servers); configs: also launch.json configurations
 * that aren't running here (status "stopped"), for a Restart on a page that no longer answers.
 */
export function pageServer(state, { configs = false } = {}) {
  let page;
  try { page = new URL(state?.url ?? ""); } catch { return null; }
  if (!/^https?:$/.test(page.protocol)) return null;
  const portOf = (url) => (url.port || (url.protocol === "https:" ? "443" : "80"));
  const at = (address, port) => {
    try {
      const url = new URL(address);
      return portOf(url) === portOf(page) && (url.hostname === page.hostname || (LOOPBACK.has(url.hostname) && LOOPBACK.has(page.hostname)));
    } catch { return !!port && String(port) === portOf(page) && LOOPBACK.has(page.hostname); }
  };
  const server = (state.servers ?? []).find((entry) => !entry.attach && at(entry.url, entry.port));
  if (server || !configs) return server ?? null;
  const config = (state.launch?.configs ?? []).find((entry) => !entry.attach && at(entry.url, entry.port));
  return config ? { name: config.name, port: config.port, url: config.url, status: "stopped" } : null;
}
/** The page's dev server when it has stopped or failed (the page shown is from before), else null. */
export function stoppedServer(state) {
  const server = state?.hasPage ? pageServer(state) : null;
  return server && (server.status === "stopped" || server.status === "failed") ? server : null;
}

/** A dev server of this folder that is starting (the agent's preview_start, another pane's Run), or null. */
export const startingServer = (state) => (state?.servers ?? []).find((server) => server.status === "starting") ?? null;

/** What the viewport area shows over (or instead of) the page. A page another pane shows is still "page": like
 * 2.2553.1, this pane then paints its empty viewport (no notice) until it gets the page (pageRefused).
 * hold: the card ("failed" | "stopped" | "restored") whose Restart / Try again is running stays up, busy (cf580efe9 Or /
 * mr restartPending), instead of the spinner. settling: bi's spinner hold (serverStartHold). */
export function previewSurface(state, { starting = null, lastStarted = null, hold = null, settling = false } = {}) {
  if (!state) return "loading";
  if (hold) return hold;
  if (starting) return "starting";
  if (failedServer(state, lastStarted) && !state.hasPage) return "failed";
  // 2.2553.1 Xv pv: the page's dev server stopped (Stop, a crash): "Stopped" with Restart covers the old page.
  if (stoppedServer(state)) return "stopped";
  if (state.hasPage && pageError(state)) return "error";
  if (state.hasPage) return "page";
  // cf580efe9 bi: a server starting replaces the start page with a spinner (and keeps it 1.5 s once it runs).
  if (settling || startingServer(state)) return "starting";
  // cf580efe9 Pi / ri: the page from before the app closed, over the start page, until restarted or dismissed.
  if (state.lastFrame?.configName) return "restored";
  return "start";
}

// cf580efe9 bi (readable 2726-2790; vi = 1500): a Run pending from this pane, or any server starting, replaces the server
// list with a spinner; the server it was for is held, and once it runs the spinner stays SERVER_SETTLE_MS more (so the
// page it opens comes up first) before the list returns. prev: the held server name (or null).
export const SERVER_SETTLE_MS = 1500;
export function serverStartHold(prev, { servers = [], pending = null } = {}) {
  const list = servers ?? [];
  const starting = list.find((server) => server.status === "starting");
  const pendingRun = !!pending && !list.some((server) => server.name === pending && server.status === "running");
  const active = !!starting || pendingRun;
  let held = prev ?? null;
  const candidate = pendingRun ? pending : starting?.name;
  if (active && held === null && candidate) held = candidate;
  const heldServer = held === null ? null : list.find((server) => server.name === held);
  if (held !== null && !active && heldServer?.status !== "running") held = null;
  const running = held !== null && heldServer?.status === "running";
  return { held, spinner: active || running, settle: running && !active };
}

/** cf580efe9 wr / Sr: the session's running tool as the "Setting up preview" line (the last running tool call). */
export function previewRunningToolLabel(items = []) {
  for (let index = (items?.length ?? 0) - 1; index >= 0; index--) {
    const item = items[index];
    if (!["inProgress", "running"].includes(item?.status)) continue;
    let label = null;
    if (isGenericTool(item)) label = genericToolLabel(item, "busy");
    else if (item.type === "commandExecution") label = commandRowLabel(item.command, "busy", item.description, item.source);
    if (label?.label) return label.meta ? `${label.label} ${label.meta}` : label.label;
  }
  return null;
}

// cf580efe9 fa bn (readable 4713-4731): whose output the logs drawer shows — the server at the open tab's port, else the
// one started last. Only servers with a port and a process (an attach configuration has no output).
export function logsServer(state) {
  const live = (state?.servers ?? []).filter((server) => !server.attach && Number(server.port) > 0);
  let port = 0;
  try { const url = new URL(state?.url ?? ""); if (/^https?:$/.test(url.protocol) && LOOPBACK.has(url.hostname)) port = Number(url.port || (url.protocol === "https:" ? 443 : 80)); } catch { /* no page */ }
  const atPort = port > 0 ? live.find((server) => Number(server.port) === port) : undefined;
  return atPort ?? [...live].sort((a, b) => (Number(b.startedAt) || 0) - (Number(a.startedAt) || 0))[0] ?? null;
}
/** cf580efe9 ua: the drawer's title, "{name} · localhost:{port}". */
export const logsSourceLabel = (server) => (server?.name && Number(server.port) > 0 ? t("{name} · {host}", { name: server.name, host: `localhost:${server.port}` }) : undefined);
/** cf580efe9 fa Fe("epitaxy-preview-logs-expanded", !1): the drawer's open state, kept across panes and restarts. */
export const PREVIEW_LOGS_EXPANDED_KEY = "epitaxy-preview-logs-expanded";
export function readLogsExpanded(storage) {
  try { return JSON.parse(storage?.getItem?.(PREVIEW_LOGS_EXPANDED_KEY) ?? "false") === true; } catch { return false; }
}
export function writeLogsExpanded(storage, value) {
  try { storage?.setItem?.(PREVIEW_LOGS_EXPANDED_KEY, JSON.stringify(value === true)); } catch { /* private window, blocked storage */ }
}

export const showsPage = (surface) => surface === "page";
/** 2.2553.1 native-view slot (c1dcad2f9 g): a refused show is asked again after these delays, then only when the
 * pane's layout changes. */
export const SHOW_RETRY_MS = Object.freeze([50, 250, 1000]);
/** Whether main refused this pane's show because another pane shows the page (preview-service.cjs attach). */
export const pageRefused = (state, instanceId) => !!state?.hostId && state.hostId !== instanceId;

/** Sample points (viewport coordinates) checked for overlays covering the page: a 3×3 grid inset from the edges. */
export function occlusionSamples(rect, inset = 6) {
  if (!rect || rect.width <= inset * 2 || rect.height <= inset * 2) return [];
  const xs = [rect.left + inset, rect.left + rect.width / 2, rect.right - inset];
  const ys = [rect.top + inset, rect.top + rect.height / 2, rect.bottom - inset];
  return ys.flatMap((y) => xs.map((x) => ({ x, y })));
}
/** True when something other than the pane's own viewport is on top at any sample point. */
export function isOccluded(rect, elementAt, owns) {
  return occlusionSamples(rect).some(({ x, y }) => { const element = elementAt(x, y); return !!element && !owns(element); });
}
export function boundsOf(rect) {
  return rect ? { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.max(0, Math.round(rect.width)), height: Math.max(0, Math.round(rect.height)) } : null;
}
export const sameBounds = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

export function viewportLabel(viewport) {
  if (!viewport || viewport.preset === "responsive") return t("Responsive");
  const preset = VIEWPORT_PRESETS.find((entry) => entry.value === viewport.preset);
  const size = viewport.width && viewport.height ? `${viewport.width} × ${viewport.height}` : preset?.size ?? "";
  return preset ? `${t(preset.label)} · ${size}` : size ? `${t("Custom")} · ${size}` : "";
}
/** The Viewport submenu's radio rows (2.2553.1 kv/Le): the presets, plus a checked "Custom · W × H" row when the
 * reported size matches no preset (the agent's resize_window). Choosing the custom row keeps the size. */
export function viewportRows(viewport) {
  const preset = viewport?.preset ?? "responsive";
  const rows = VIEWPORT_PRESETS.map((entry) => ({ value: entry.value, label: t(entry.label), hint: entry.size, checked: preset === entry.value, setByAgent: preset === entry.value && !!viewport?.setByAgent }));
  if (!rows.some((row) => row.checked) && viewport?.width && viewport?.height) {
    rows.push({ value: "custom", label: t("Custom"), hint: `${viewport.width} × ${viewport.height}`, checked: true, setByAgent: !!viewport.setByAgent, keep: true });
  }
  return rows;
}
export function clampLogsHeight(height, paneHeight) {
  const max = Math.max(LOGS_HEIGHT.min, Math.round((paneHeight || 0) * LOGS_HEIGHT.maxRatio));
  return Math.min(max, Math.max(LOGS_HEIGHT.min, Math.round(height)));
}
