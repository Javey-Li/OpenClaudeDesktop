// The Preview pane's browser and dev servers, per session (main process).
//
// Each session that previews something owns one WebContentsView (2.2553.1 PreviewContext: a WebContentsView, never
// a <webview>) in the "persist:preview" partition: no Node, context isolation, sandbox, no dialogs, every
// permission denied (clipboard writes on localhost aside), downloads through the system Save dialog of the window
// showing the page (refused for a page nobody sees), http(s) pages anywhere and file://
// only inside the session's folder. The renderer pane that shows the session reports its viewport rectangle
// (preview-attach) and the view is laid over it in that pane's window.
//
// Who shows the page follows 2.2553.1 (index.chunk showPreview/hidePreview, claimantId = the pane slot's useId):
// the page has one host at a time. The pane showing it holds it; another pane of the same session (split view, a
// second window) asking to show it is refused — no notice, it paints the empty viewport and asks again 50/250/1000 ms
// later and on its next layout change — and its hide is ignored. A holder that hides the page (pane closed or not
// visible, session switched, an overlay covering it, window gone) lets go, and the next pane that shows it takes it.
// A page nobody shows moves to a hidden parking window and keeps running, so the agent's tools keep working; after
// five minutes unseen (2.2553.1 "Reaped hidden preview view", 3e5 ms) a localhost or file page is closed — its dev
// server keeps running — and comes back at the same address when a pane shows it or the agent uses it again.
//
// Overlays: a WebContentsView is drawn above the window's DOM, so a menu or dialog over the pane would be hidden
// behind the page. The pane detects that (preview-occlude): the view is captured, hidden, and the capture stands in
// until the overlay leaves.
//
// Dev servers come from the session folder's .claude/launch.json (preview-launch.mjs) and are shared by every
// session of that folder: spawned in the folder with the app's environment (login-shell PATH, no app secrets) plus
// PORT, logs kept, ready once the port answers, stopped as a process group. Closing a pane or a window never stops
// them; Stop (the pane's menu, preview_stop) or quitting the app does. Such a command runs outside the core's sandbox,
// so the agent (preview_start) starts one only after the user approved that exact configuration in this session; the
// user's own Start in the pane never asks.
//
// Outside sites: the agent asks once per site and session before it opens or uses one, a declined site stays
// declined, and while the agent drives the page the page's own navigations and popups to an unapproved outside site
// are held and asked about the same way (holdOutside), so a link, redirect or script can't take it there unasked.
//
// CDP (webContents.debugger) gives the console and network logs, device emulation for the viewport presets and
// the color scheme, screenshots, and native input. A page in the parking window gets no native input, so clicks
// and keys there are DOM events in an isolated world (preview-page-scripts.cjs).
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn, execFile } = require("node:child_process");
const scripts = require("./preview-page-scripts.cjs");
const launch = require("./preview-launch.mjs");

// Cookies and local storage of previewed pages (2.2553.1 legacy preview "Keep cookies"): by default an in-memory session
// for this app run (EPHEMERAL_PARTITION); with Servers & settings › Keep cookies, the on-disk one, kept across restarts.
// Either is shared by every session's preview.
const PARTITION = "persist:preview";
const EPHEMERAL_PARTITION = "code-desktop-preview";
const CONSOLE_LIMIT = 500;
const NETWORK_LIMIT = 300;
const LOG_LIMIT = 1000;
const READY_TIMEOUT_MS = 180000;
const EARLY_EXIT_MS = 3000;
const PRESETS = Object.freeze({ mobile: { width: 375, height: 812 }, tablet: { width: 768, height: 1024 } });
const COLOR_SCHEMES = new Set(["system", "light", "dark"]);
const PLACEHOLDER = { dark: "#131312", light: "#f5f5f5" };
// 2.2553.1 q_r: a hidden page is reaped after five minutes unseen.
const REAP_HIDDEN_MS = 300000;
// What the agent's console and network reads say after a reap (2.2553.1 preview tools, verbatim).
const RECLAIMED_NOTE = "Preview view was reclaimed while hidden, so its earlier console and network output is gone. Interact with the preview (navigate or screenshot) and re-read to collect fresh entries.";
// eslint-disable-next-line no-control-regex
const stripAnsi = (text) => String(text).replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "").replace(/\x1b\][^\x07]*\x07/g, "");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const push = (list, entry, limit) => { list.push(entry); if (list.length > limit) list.splice(0, list.length - limit); };
// A file the preview downloaded from the web carries macOS's quarantine flag (Gatekeeper checks it before it opens),
// as a browser's download would; one the file already has is kept.
function quarantine(file) {
  if (process.platform !== "darwin") return;
  try { if (!fs.lstatSync(file).isFile()) return; } catch { return; }
  execFile("/usr/bin/xattr", ["-p", "com.apple.quarantine", file], { timeout: 5000 }, (missing) => {
    if (!missing) return;
    execFile("/usr/bin/xattr", ["-w", "com.apple.quarantine", `0081;${Math.floor(Date.now() / 1000).toString(16)};Code Desktop;`, file], { timeout: 5000 }, () => {});
  });
}

/**
 * The Preview pane chord a key press inside the previewed page stands for (an Electron before-input-event input), else
 * null: "sketch" ⇧⌘X (Annotate), "close" ⌘W (close the preview), "address" ⌘L (the address field). Ctrl stands in for
 * ⌘ off macOS, as the pane's own keydown takes either.
 */
function previewShortcut(input) {
  if (!input || input.type !== "keyDown" || input.isAutoRepeat || input.alt) return null;
  const command = process.platform === "darwin" ? input.meta && !input.control : input.control && !input.meta;
  if (!command) return null;
  const key = String(input.key ?? "").toLowerCase();
  if (key === "x" && input.shift) return "sketch";
  if (key === "w" && !input.shift) return "close";
  if (key === "l" && !input.shift) return "address";
  return null;
}

function portAnswers(port, host, timeout = 600) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const done = (value) => { socket.destroy(); resolve(value); };
    socket.setTimeout(timeout, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}
const portOpen = async (port) => (await portAnswers(port, "127.0.0.1")) || (await portAnswers(port, "::1"));
function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { const { port } = server.address(); server.close(() => resolve(port)); });
  });
}

/**
 * @param {object} options
 * @param {object} options.electron            { WebContentsView, BrowserWindow, session, shell, nativeTheme }
 * @param {(id: string) => ({id: string, cwd: string}|null)} options.getSession   a known session and its folder
 * @param {() => Promise<object>} [options.spawnEnv]   the environment dev servers get
 * @param {(event: object) => void} [options.broadcast] an app-wide event (every window)
 */
function createPreviewService({ electron, getSession, spawnEnv = async () => ({ ...process.env }), broadcast = () => {}, logger = console, home = process.env.HOME || "", hostWindow = null, reapHiddenMs = REAP_HIDDEN_MS,
  keepCookies = () => false, setKeepCookies = () => {} }) {
  const { WebContentsView, BrowserWindow, session: electronSession, shell, nativeTheme } = electron;
  // The window a renderer request came from (main.cjs: window-registry hostWindow(sender), which knows every main
  // window and pane popout); both split sides of a window are one webContents, so a side's pane rect is a region of it.
  const windowOf = typeof hostWindow === "function" ? hostWindow : (sender) => BrowserWindow.fromWebContents(sender);
  const previews = new Map(); // session id → preview
  const servers = new Map(); // cwd \0 name → server
  const launchCache = new Map(); // cwd → { mtime, parsed }
  const listening = new WeakSet(); // page contents whose debugger events are wired
  let parking = null;
  const partitionsReady = new Set();
  const keeping = () => { try { return keepCookies() === true; } catch { return false; } };

  // ------------------------------------------------------------------ partition
  function partition(name = keeping() ? PARTITION : EPHEMERAL_PARTITION) {
    const ses = electronSession.fromPartition(name);
    if (partitionsReady.has(name)) return ses;
    partitionsReady.add(name);
    const localOrigin = (value) => { try { return launch.isLocalHost(new URL(value).hostname); } catch { return false; } };
    ses.setPermissionRequestHandler((_contents, permission, callback, details) => callback(permission === "clipboard-sanitized-write" && localOrigin(details?.requestingUrl)));
    ses.setPermissionCheckHandler((_contents, permission, origin) => permission === "clipboard-sanitized-write" && localOrigin(origin));
    // Downloads (2.2553.1 lets preview downloads run): a page shown in a pane gets the system Save dialog over that
    // window, starting in Downloads, and the saved file is quarantined like a browser download. A page nobody sees
    // (parked, or the agent's unseen page) can't put a dialog in front of anyone: the download is cancelled, and the
    // page's console and the agent's next result say why.
    ses.on("will-download", (event, item, contents) => {
      const owner = [...previews.values()].find((preview) => alive(preview) && preview.view.webContents.id === contents?.id) ?? null;
      let file = "download";
      try { file = path.basename(String(item?.getFilename?.() || "")) || "download"; } catch { /* keep the fallback */ }
      if (!owner || !holder(owner)) {
        event.preventDefault();
        if (owner) {
          owner.download = { file, state: "cancelled", reason: "not-shown", at: Date.now() };
          push(owner.console, { level: "warn", text: `Code Desktop didn’t download ${file}: the preview isn’t on screen, so there was nowhere to ask where to save it. Show the Preview pane and try again.`, url: owner.url, line: null, time: Date.now() }, CONSOLE_LIMIT);
          notify(owner);
        }
        return;
      }
      try { item.setSaveDialogOptions?.({ defaultPath: path.join(home || os.homedir(), "Downloads", file) }); } catch { /* Electron's own default */ }
      owner.download = { file, state: "saving", at: Date.now() };
      notify(owner);
      item.once?.("done", (_event, state) => {
        let saved = "";
        try { saved = item.getSavePath?.() || ""; } catch { saved = ""; }
        owner.download = { file: saved ? path.basename(saved) : file, state: state === "completed" ? "completed" : state === "interrupted" ? "failed" : "cancelled", at: Date.now(), ...(state === "completed" && saved ? { path: saved } : {}) };
        if (state === "completed" && saved) {
          let chain = [];
          try { chain = item.getURLChain?.() || []; } catch { chain = []; }
          if (!(chain.length ? chain : [item.getURL?.() || ""]).every((url) => /^file:/i.test(url))) quarantine(saved);
        }
        notify(owner);
      });
    });
    // One listener per session (Electron keeps only the last): file:// loads (pages, frames, images) only from the folder
    // of the session whose page asks; and a local file page the agent drives (often one it wrote) reaches no outside
    // host the user hasn't allowed in this session, so a page can't carry the workspace out where the agent's own
    // sandbox couldn't (its top-level navigations and popups are held the same way: holdOutside).
    ses.webRequest.onBeforeRequest({ urls: ["file://*/*", "http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] }, (details, callback) => {
      const owner = [...previews.values()].find((preview) => preview.view && !preview.view.webContents.isDestroyed() && preview.view.webContents.id === details.webContentsId);
      if (/^file:/i.test(details.url)) {
        let file = "";
        try { file = decodeURIComponent(new URL(details.url).pathname); } catch { /* invalid */ }
        callback({ cancel: !owner || !launch.insideFolderReal(owner.cwd, file) });
        return;
      }
      callback({ cancel: !!owner && details.resourceType !== "mainFrame" && outsideFromAgentFile(owner, details.url) });
    });
    return ses;
  }

  function parkingWindow() {
    if (parking && !parking.isDestroyed()) return parking;
    parking = new BrowserWindow({ show: false, width: 1280, height: 800, skipTaskbar: true, paintWhenInitiallyHidden: true, webPreferences: { backgroundThrottling: false, sandbox: true, contextIsolation: true, nodeIntegration: false } });
    parking.on("closed", () => { parking = null; });
    return parking;
  }

  // ------------------------------------------------------------------ previews
  function preview(sessionId) {
    let entry = previews.get(sessionId);
    if (entry) return entry;
    const known = getSession(sessionId);
    if (!known?.cwd) throw new Error("Unknown session.");
    entry = {
      id: sessionId, cwd: known.cwd, view: null, host: null, paneBounds: null, visible: false, occluded: false, subscribers: new Set(),
      url: "", title: "", loading: false, error: null, crashed: false,
      viewport: { preset: "responsive", width: null, height: null, colorScheme: "system", setByAgent: false },
      console: [], network: [], requests: new Map(), approvedHosts: new Set(), debugger: false, notifyTimer: null, lastServer: null,
      reapTimer: null, reclaimed: false,
      // Servers & settings › Files: the HTML files of the session folder this preview showed, newest first.
      recentFiles: [],
      // The agent's sites: declined ones are never asked about again in this session; agentDriven while the agent last
      // opened or drove the page (the user's own address-bar navigation hands it back), when the page's own
      // navigations to outside sites need the same approval; siteApproval asks for those; blocked is the last one held.
      declinedHosts: new Set(), asking: new Set(), agentDriven: false, siteApproval: null, blocked: null, blockWaiters: new Set(),
      // launch.json commands the agent may start in this session (a fingerprint of each approved configuration).
      approvedServers: new Set(),
      // The page's latest download: { file, state: "saving"|"completed"|"failed"|"cancelled", reason?, at }.
      download: null,
    };
    previews.set(sessionId, entry);
    return entry;
  }
  const alive = (entry) => entry?.view && !entry.view.webContents.isDestroyed();
  // The pane showing the page right now (2.2553.1 claimantId): hidden, covered or gone, it holds nothing.
  const holder = (entry) => {
    const host = entry.host;
    return host && entry.visible && !entry.occluded && host.sender && !host.sender.isDestroyed() && host.window && !host.window.isDestroyed() ? host : null;
  };
  // Pages the reaper may close: local dev servers and the session's files (2.2553.1 reaps port and static-content
  // previews, never an outside site), which come back by loading the same address.
  const reclaimable = (url) => {
    try { const parsed = new URL(url); return parsed.protocol === "file:" || (/^https?:$/.test(parsed.protocol) && launch.isLocalHost(parsed.hostname)); } catch { return false; }
  };
  // A page nobody shows is closed after reapHiddenMs; showing it cancels that, the agent using it starts the wait again.
  function armReap(entry, renew = false) {
    if (!alive(entry) || holder(entry)) { clearTimeout(entry.reapTimer); entry.reapTimer = null; return; }
    if (entry.reapTimer && !renew) return;
    clearTimeout(entry.reapTimer);
    entry.reapTimer = setTimeout(() => reap(entry), reapHiddenMs);
    entry.reapTimer.unref?.();
  }
  function reap(entry) {
    entry.reapTimer = null;
    if (previews.get(entry.id) !== entry || !alive(entry) || holder(entry)) return;
    const view = entry.view;
    if (!reclaimable(view.webContents.getURL() || entry.url)) return;
    try { if (entry.parent && !entry.parent.isDestroyed()) entry.parent.contentView.removeChildView(view); } catch { /* already gone */ }
    Object.assign(entry, { view: null, parent: null, debugger: false, loading: false, crashed: false, reclaimed: true, console: [], network: [], requests: new Map() });
    try { view.webContents.close(); } catch { /* gone */ }
    logger.info?.(`preview: closed the hidden page of ${entry.id}; it reopens at ${entry.url} when shown`);
    notify(entry);
  }
  // A reaped page reopens at its address (2.2553.1 xX recreates the context from the server).
  const revive = (entry) => (!alive(entry) && entry.reclaimed && entry.url ? navigate(entry.id, entry.url) : Promise.resolve(null));

  // ------------------------------------------------------------------ outside sites
  const outsideHost = (url) => {
    try { const parsed = new URL(url); return /^https?:$/.test(parsed.protocol) && !launch.isLocalHost(parsed.hostname) ? parsed.host : null; } catch { return null; }
  };
  const declinedText = (host) => `The user didn’t allow opening ${host} in the preview. Only localhost pages open without asking.`;
  /** A subresource an agent-driven local file page asks for from an outside host this session hasn't allowed (blocked). */
  function outsideFromAgentFile(entry, url) {
    if (!entry.agentDriven) return false;
    let page = "";
    try { page = entry.view.webContents.getURL(); } catch { return false; }
    if (!/^file:/i.test(page)) return false;
    let host = null;
    try { const parsed = new URL(url); host = /^(https?|wss?):$/.test(parsed.protocol) && !launch.isLocalHost(parsed.hostname) ? parsed.host : null; } catch { return false; }
    if (!host || entry.approvedHosts.has(host)) return false;
    push(entry.console, { level: "warn", text: `Code Desktop blocked a request to ${host}: a local file page the agent drives reaches only localhost and sites allowed in this session.`, url: page, line: null, time: Date.now() }, CONSOLE_LIMIT);
    return true;
  }
  /**
   * A navigation or popup the page itself starts while the agent drives it, to an outside host this session hasn't
   * allowed: held (true) — a declined host stays blocked, any other is asked about once, then opened if allowed.
   */
  function holdOutside(entry, url) {
    if (!entry.agentDriven) return false;
    const host = outsideHost(url);
    if (!host || entry.approvedHosts.has(host)) return false;
    entry.blocked = { host, url, at: Date.now(), declined: entry.declinedHosts.has(host) };
    if (!entry.declinedHosts.has(host)) void askOutside(entry, host, url);
    else blockedFor(entry, host);
    return true;
  }
  // A navigation call waiting on a page the user kept from an outside site ends at once instead of timing out.
  const blockedFor = (entry, host) => { for (const waiter of [...entry.blockWaiters]) { try { waiter(host); } catch { /* best effort */ } } };
  async function askOutside(entry, host, url) {
    if (entry.asking.has(host)) return;
    if (typeof entry.siteApproval !== "function") { entry.declinedHosts.add(host); return; }
    entry.asking.add(host);
    let ok = false;
    try { ok = (await entry.siteApproval({ kind: "preview-site", host, url })) === true; } catch { ok = false; }
    entry.asking.delete(host);
    if (!ok) { entry.declinedHosts.add(host); if (entry.blocked?.host === host) entry.blocked = { ...entry.blocked, declined: true }; blockedFor(entry, host); return; }
    entry.approvedHosts.add(host);
    entry.declinedHosts.delete(host);
    if (entry.blocked?.host === host) entry.blocked = null;
    if (alive(entry)) entry.view.webContents.loadURL(url).catch(() => {});
  }

  function ensureView(entry) {
    if (alive(entry)) return entry.view;
    const view = new WebContentsView({
      webPreferences: {
        session: partition(), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false,
        backgroundThrottling: false, disableDialogs: true, plugins: false, spellcheck: false, navigateOnDragDrop: false, safeDialogs: true,
      },
    });
    view.setBackgroundColor("#ffffff");
    entry.view = view;
    entry.crashed = false;
    entry.reclaimed = false;
    const contents = view.webContents;
    // State events of a page the reaper closed never reach the entry's next page.
    const mine = (fn) => (...args) => { if (entry.view === view) fn(...args); };
    const guard = (event, url) => {
      const allowed = launch.navigationAllowed(url, entry.cwd);
      if (!allowed.ok) { event.preventDefault(); entry.error = { code: "blocked", description: allowed.reason, url }; notify(entry); return; }
      // A page the agent drives never leaves for an outside site the user hasn't allowed in this session.
      if (holdOutside(entry, allowed.url)) event.preventDefault();
    };
    contents.on("will-navigate", guard);
    contents.on("will-redirect", guard);
    contents.on("will-frame-navigate", (event) => { if (!event.isMainFrame) { const allowed = launch.navigationAllowed(event.url, entry.cwd); if (!allowed.ok && !/^(data|blob|about):/.test(event.url)) event.preventDefault(); } });
    // New windows load in the same view (the preview is one page); never a new window.
    contents.setWindowOpenHandler(({ url }) => {
      const allowed = launch.navigationAllowed(url, entry.cwd);
      if (allowed.ok && !holdOutside(entry, allowed.url)) setImmediate(() => { if (alive(entry)) contents.loadURL(url).catch(() => {}); });
      return { action: "deny" };
    });
    contents.on("did-start-loading", mine(() => { entry.loading = true; entry.error = null; notify(entry); }));
    contents.on("did-stop-loading", mine(() => { entry.loading = false; notify(entry); }));
    contents.on("did-navigate", mine((_event, url) => { entry.url = url; entry.title = contents.getTitle(); notify(entry); }));
    contents.on("did-navigate-in-page", mine((_event, url, isMainFrame) => { if (isMainFrame) { entry.url = url; notify(entry); } }));
    contents.on("page-title-updated", mine((_event, title) => { entry.title = title; notify(entry); }));
    contents.on("did-fail-load", mine((_event, code, description, url, isMainFrame) => {
      if (!isMainFrame || code === -3) return; // -3: aborted by a newer navigation
      entry.error = { code: String(code), description, url };
      entry.url = url || entry.url;
      notify(entry);
    }));
    contents.on("render-process-gone", mine((_event, details) => { entry.crashed = true; entry.error = { code: "crashed", description: details?.reason || "crashed", url: entry.url }; notify(entry); }));
    contents.on("devtools-opened", () => notify(entry));
    contents.on("devtools-closed", () => notify(entry));
    // F6 / Ctrl+F6 leave the page for the app (the pane's skip link explains it). The pane's own chords also work
    // while focus is in the page, which the host window never sees (2.2553.1 PreviewContext before-input-event:
    // previewSketchShortcut ⇧⌘X, previewCloseShortcut ⌘W, previewAddressBarShortcut ⌘L): the host pane acts on them.
    contents.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown") return;
      const sender = entry.host?.sender;
      if (input.key === "F6") {
        event.preventDefault();
        if (sender && !sender.isDestroyed()) { sender.focus(); sender.send("desktop:event", { kind: "preview-focus-out", sessionId: entry.id, instanceId: entry.host.instanceId }); }
        return;
      }
      const action = previewShortcut(input);
      if (!action || !sender || sender.isDestroyed()) return;
      event.preventDefault();
      sender.focus();
      sender.send("desktop:event", { kind: "preview-shortcut", action, sessionId: entry.id, instanceId: entry.host.instanceId });
    });
    attachDebugger(entry);
    place(entry);
    return view;
  }

  function attachDebugger(entry) {
    const contents = entry.view.webContents;
    if (entry.debugger && contents.debugger.isAttached()) return;
    try { if (!contents.debugger.isAttached()) contents.debugger.attach("1.3"); } catch (error) { logger.warn?.(`preview: debugger unavailable: ${error.message}`); return; }
    entry.debugger = true;
    // Once per page: a re-attach (after the developer tools let go) keeps the listeners it already has.
    if (listening.has(contents)) { for (const domain of ["Runtime.enable", "Log.enable", "Network.enable", "Page.enable"]) contents.debugger.sendCommand(domain).catch(() => {}); applyEmulation(entry).catch(() => {}); return; }
    listening.add(contents);
    contents.debugger.on("detach", () => { if (entry.view?.webContents === contents) entry.debugger = false; });
    contents.debugger.on("message", (_event, method, params) => {
      if (entry.view?.webContents !== contents) return;
      if (method === "Runtime.consoleAPICalled") {
        const text = (params.args || []).map((arg) => arg.value !== undefined ? (typeof arg.value === "string" ? arg.value : JSON.stringify(arg.value)) : arg.description ?? arg.type).join(" ");
        if (/^%cElectron Security Warning/.test(text)) return;
        const frame = params.stackTrace?.callFrames?.[0];
        push(entry.console, { level: { warning: "warn", assert: "error" }[params.type] ?? params.type, text: text.slice(0, 4000), url: frame?.url || "", line: frame ? frame.lineNumber + 1 : null, time: Date.now() }, CONSOLE_LIMIT);
      } else if (method === "Runtime.exceptionThrown") {
        const details = params.exceptionDetails || {};
        push(entry.console, { level: "error", text: String(details.exception?.description || details.text || "Uncaught exception").slice(0, 4000), url: details.url || "", line: details.lineNumber != null ? details.lineNumber + 1 : null, time: Date.now() }, CONSOLE_LIMIT);
      } else if (method === "Page.javascriptDialogOpening") {
        // The page's alert() / confirm() / prompt() never shows (disableDialogs): its console and the agent's next click
        // or key press result say so, and what the call returned, as Claude Desktop's browser does ("Page dialog
        // suppressed"), so an agent testing a confirm()-guarded button doesn't think the button is broken.
        const type = typeof params.type === "string" ? params.type : "unknown";
        if (type === "alert" || type === "confirm" || type === "prompt") {
          const message = String(params.message ?? "").slice(0, 200);
          const returned = { confirm: "confirm() returned false to the page", prompt: "prompt() returned null to the page" }[type] ?? "the call returned immediately";
          push(entry.console, { level: "warn", text: `[Code Desktop preview] Page dialog suppressed (${type}): ${JSON.stringify(message)} — native JavaScript dialogs are disabled in this browser; ${returned}.`,
            url: String(params.url || "").slice(0, 2000), line: null, time: Date.now() }, CONSOLE_LIMIT);
          entry.dialog = { type, message, returned, at: Date.now() };
        }
      } else if (method === "Log.entryAdded") {
        const { level, text, url } = params.entry || {};
        push(entry.console, { level: level === "warning" ? "warn" : level || "info", text: String(text || "").slice(0, 4000), url: url || "", line: null, time: Date.now() }, CONSOLE_LIMIT);
      } else if (method === "Network.requestWillBeSent") {
        const record = { id: params.requestId, method: params.request?.method, url: String(params.request?.url || "").slice(0, 2000), type: params.type || "", status: null, mimeType: "", failed: null, time: Date.now() };
        entry.requests.set(params.requestId, record);
        push(entry.network, record, NETWORK_LIMIT);
        if (entry.requests.size > NETWORK_LIMIT * 2) for (const key of [...entry.requests.keys()].slice(0, NETWORK_LIMIT)) entry.requests.delete(key);
      } else if (method === "Network.responseReceived") {
        const record = entry.requests.get(params.requestId);
        if (record) { record.status = params.response?.status ?? null; record.mimeType = params.response?.mimeType || ""; }
      } else if (method === "Network.loadingFailed") {
        const record = entry.requests.get(params.requestId);
        if (record) record.failed = params.canceled ? "canceled" : params.errorText || "failed";
      }
    });
    // Not awaited: the commands settle once the page's renderer exists (awaiting them before the first load hangs).
    for (const domain of ["Runtime.enable", "Log.enable", "Network.enable", "Page.enable"]) contents.debugger.sendCommand(domain).catch(() => {});
    applyEmulation(entry).catch(() => {});
  }
  function cdp(entry, method, params) {
    if (!alive(entry)) return Promise.reject(new Error("Nothing is open in the preview."));
    attachDebugger(entry);
    if (!entry.view.webContents.debugger.isAttached()) return Promise.reject(new Error("The page can’t be inspected while its developer tools hold it. Close them and try again."));
    return entry.view.webContents.debugger.sendCommand(method, params);
  }

  // The view's rectangle inside the pane: the whole pane, or a preset device size scaled to fit and centred.
  function viewRect(entry) {
    const pane = entry.paneBounds;
    if (!pane) return null;
    const { preset, width, height } = entry.viewport;
    if (preset === "responsive" || !width || !height) return { ...pane, scale: 1 };
    const scale = Math.min(1, pane.width / width, pane.height / height);
    const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
    return { x: pane.x + Math.round((pane.width - w) / 2), y: pane.y + Math.round((pane.height - h) / 2), width: w, height: h, scale };
  }
  async function applyEmulation(entry) {
    if (!alive(entry) || !entry.debugger) return;
    const { preset, width, height, colorScheme } = entry.viewport;
    const rect = viewRect(entry);
    if (preset === "responsive" || !width || !height) {
      await cdp(entry, "Emulation.clearDeviceMetricsOverride").catch(() => {});
      await cdp(entry, "Emulation.setTouchEmulationEnabled", { enabled: false }).catch(() => {});
      await cdp(entry, "Emulation.setUserAgentOverride", { userAgent: entry.view.webContents.session.getUserAgent() }).catch(() => {});
    } else {
      const mobile = width < 768;
      await cdp(entry, "Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: mobile ? 2 : 0, mobile, scale: rect?.scale ?? 1 }).catch(() => {});
      await cdp(entry, "Emulation.setTouchEmulationEnabled", { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 }).catch(() => {});
      if (mobile) {
        const chrome = process.versions.chrome || "140.0.0.0";
        await cdp(entry, "Emulation.setUserAgentOverride", { userAgent: `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrome} Mobile Safari/537.36`, platform: "Android" }).catch(() => {});
      }
    }
    await cdp(entry, "Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: colorScheme === "system" ? "" : colorScheme }] }).catch(() => {});
  }

  // Put the view where it belongs: over its pane in the host window, else parked.
  function place(entry) {
    armReap(entry);
    if (!alive(entry)) return;
    const view = entry.view;
    const hostWindow = entry.host?.window && !entry.host.window.isDestroyed() ? entry.host.window : null;
    const target = hostWindow ?? parkingWindow();
    if (entry.parent !== target) {
      try { if (entry.parent && !entry.parent.isDestroyed()) entry.parent.contentView.removeChildView(view); } catch { /* already gone */ }
      target.contentView.addChildView(view);
      entry.parent = target;
    }
    if (hostWindow && entry.paneBounds) {
      const rect = viewRect(entry);
      view.setBounds({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
      view.setVisible(entry.visible && !entry.occluded);
    } else {
      const last = entry.paneBounds ? viewRect(entry) : { width: 1280, height: 800 };
      view.setBounds({ x: 0, y: 0, width: last.width, height: last.height });
      view.setVisible(true);
    }
  }
  const onScreen = (entry) => !!(entry.host?.window && !entry.host.window.isDestroyed() && entry.host.window.isVisible() && entry.visible && !entry.occluded && entry.parent === entry.host.window);

  // ------------------------------------------------------------------ renderer state
  function launchInfo(cwd) {
    const file = path.join(cwd, launch.LAUNCH_FILE);
    let stat = null;
    try { stat = fs.statSync(file); } catch { /* missing */ }
    const key = stat ? `${stat.mtimeMs}:${stat.size}` : "missing";
    const cached = launchCache.get(cwd);
    if (cached?.key === key) return cached.parsed;
    let text = null;
    if (stat) { try { text = stat.size > 1 << 20 ? "{}" : fs.readFileSync(file, "utf8"); } catch { text = null; } }
    const parsed = { ...launch.parseLaunchConfig(text, cwd), file };
    launchCache.set(cwd, { key, parsed });
    return parsed;
  }
  const serverKey = (cwd, name) => `${cwd}\u0000${name.toLowerCase()}`;
  function serverView(server) {
    return { name: server.name, port: server.port, url: server.url, status: server.status, error: server.error, attach: server.attach === true, startedAt: server.startedAt };
  }
  function snapshot(entry) {
    const info = launchInfo(entry.cwd);
    const folderServers = [...servers.values()].filter((server) => server.cwd === entry.cwd);
    const configs = info.configs.map((config) => ({ name: config.name, port: config.port, url: launch.configUrl(config), attach: config.attach }));
    const contents = alive(entry) ? entry.view.webContents : null;
    return {
      sessionId: entry.id,
      cwd: entry.cwd,
      url: entry.url,
      title: entry.title,
      loading: entry.loading,
      error: entry.error,
      // A reaped page still counts: showing the pane reopens it.
      hasPage: (!!contents || entry.reclaimed) && !!entry.url && entry.url !== "about:blank",
      canGoBack: !!contents && contents.navigationHistory.canGoBack(),
      canGoForward: !!contents && contents.navigationHistory.canGoForward(),
      devtools: !!contents && contents.isDevToolsOpened(),
      viewport: { ...entry.viewport },
      // The pane that shows the page now, or null when nobody does (any pane that shows it takes it).
      hostId: holder(entry)?.instanceId ?? null,
      launch: { exists: info.exists, error: info.exists ? info.error : null, problems: info.problems, configs, autoVerify: info.autoVerify },
      keepCookies: keeping(),
      servers: folderServers.map(serverView),
      consoleErrors: entry.console.filter((line) => line.level === "error").length,
      // The page's latest download (the saved file's path stays here: "preview-download-reveal" shows it in Finder).
      recentFiles: entry.recentFiles.map((file) => ({ path: file, name: path.relative(entry.cwd, file) || path.basename(file), url: require("node:url").pathToFileURL(file).href })),
      download: entry.download ? { file: entry.download.file, state: entry.download.state, reason: entry.download.reason ?? null, at: entry.download.at, canReveal: !!entry.download.path } : null,
      placeholder: nativeTheme.shouldUseDarkColors ? PLACEHOLDER.dark : PLACEHOLDER.light,
    };
  }
  function notify(entry, now = false) {
    clearTimeout(entry.notifyTimer);
    const send = () => {
      entry.notifyTimer = null;
      const state = snapshot(entry);
      for (const sender of [...entry.subscribers]) {
        if (sender.isDestroyed()) { entry.subscribers.delete(sender); continue; }
        sender.send("desktop:event", { kind: "preview", sessionId: entry.id, state });
      }
    };
    if (now) send(); else entry.notifyTimer = setTimeout(send, 40);
  }
  function notifyFolder(cwd) {
    for (const entry of previews.values()) if (entry.cwd === cwd) notify(entry);
  }
  // .claude/launch.json edited by hand (or by the agent) reaches an open pane at once: the folder and its .claude
  // folder are watched (a new .claude folder too) while the pane shows that folder, debounced, for the life of the app.
  const launchWatchers = new Map(); // cwd → { folder, claude, timer }
  function watchLaunch(cwd) {
    if (typeof cwd !== "string" || !cwd || launchWatchers.size >= 64) return;
    let record = launchWatchers.get(cwd);
    if (!record) { record = { folder: null, claude: null, timer: null }; launchWatchers.set(cwd, record); }
    const changed = () => {
      clearTimeout(record.timer);
      record.timer = setTimeout(() => { record.timer = null; watchClaude(); notifyFolder(cwd); }, 150);
      record.timer.unref?.();
    };
    const watch = (dir, filter) => {
      try {
        const watcher = fs.watch(dir, { persistent: false }, (_event, name) => { if (!name || filter(String(name))) changed(); });
        watcher.on("error", () => { try { watcher.close(); } catch { /* closed */ } if (record.claude === watcher) record.claude = null; if (record.folder === watcher) record.folder = null; });
        return watcher;
      } catch { return null; }
    };
    const watchClaude = () => { if (!record.claude) record.claude = watch(path.join(cwd, path.dirname(launch.LAUNCH_FILE)), (name) => name === path.basename(launch.LAUNCH_FILE)); };
    if (!record.folder) record.folder = watch(cwd, (name) => name === path.dirname(launch.LAUNCH_FILE));
    watchClaude();
  }

  // ------------------------------------------------------------------ pane requests
  function subscribe(entry, sender) {
    watchLaunch(entry.cwd);
    if (entry.subscribers.has(sender)) return;
    entry.subscribers.add(sender);
    sender.once("destroyed", () => { entry.subscribers.delete(sender); if (entry.host?.sender === sender) { entry.host = null; place(entry); } });
  }
  function state(sender, sessionId) {
    const entry = preview(sessionId);
    subscribe(entry, sender);
    return snapshot(entry);
  }
  /** The pane's viewport (CSS px in the sender window), whether it shows, and which pane instance asks. */
  function attach(sender, { sessionId, instanceId, bounds, visible = true } = {}) {
    const entry = preview(sessionId);
    subscribe(entry, sender);
    if (typeof instanceId !== "string" || !instanceId) throw new Error("Unknown preview pane.");
    const window = windowOf(sender);
    if (!window || window.isDestroyed?.()) throw new Error("Unknown window.");
    const owner = entry.host;
    const valid = bounds && [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) && bounds.width > 0 && bounds.height > 0;
    const shows = visible !== false && !!valid;
    // 2.2553.1 showPreview / hidePreview: while another pane shows the page, this pane's show is refused and its
    // hide ignored (the snapshot's hostId says who has it); once that pane stops showing it, a pane that shows it takes it.
    const other = owner && owner.instanceId !== instanceId && owner.sender && !owner.sender.isDestroyed() && owner.window && !owner.window.isDestroyed();
    if (other && (holder(entry) || !shows)) return snapshot(entry);
    const zoom = sender.getZoomFactor?.() || 1;
    entry.paneBounds = valid ? { x: Math.round(bounds.x * zoom), y: Math.round(bounds.y * zoom), width: Math.max(1, Math.round(bounds.width * zoom)), height: Math.max(1, Math.round(bounds.height * zoom)) } : entry.paneBounds;
    const changedHost = owner?.instanceId !== instanceId;
    const wasShown = !!holder(entry);
    entry.visible = shows;
    entry.host = { sender, window, instanceId };
    if (changedHost) entry.occluded = false; // the cover was over the other pane
    if (changedHost && !window.__codeDesktopPreviewWatch) {
      window.__codeDesktopPreviewWatch = true;
      // Before the window's views go with it: the page moves to the parking window (windowClosed is the registry's
      // after-the-fact notice for the same thing).
      window.once("close", () => windowClosed(window));
    }
    if (alive(entry)) { place(entry); if (changedHost) applyEmulation(entry).catch(() => {}); }
    else if (shows) revive(entry).catch(() => {});
    if (changedHost || wasShown !== !!holder(entry)) notify(entry);
    return snapshot(entry);
  }
  /** A window that closes (or closed) hands every page it showed to the parking window; the pages keep running. */
  function windowClosed(window) {
    for (const item of previews.values()) {
      if (item.host?.window !== window && item.parent !== window) continue;
      if (item.host?.window === window) item.host = null;
      if (item.parent === window) item.parent = null;
      place(item);
      notify(item);
    }
  }
  function detach(sender, { sessionId, instanceId } = {}) {
    const entry = previews.get(sessionId);
    if (!entry) return false;
    if (entry.host?.instanceId === instanceId && entry.host.sender === sender) {
      entry.host = null;
      place(entry);
      notify(entry);
    }
    return true;
  }
  async function occlude(sender, { sessionId, instanceId, occluded }) {
    const entry = previews.get(sessionId);
    if (!entry || entry.host?.instanceId !== instanceId) return { image: null };
    let image = null;
    if (occluded && !entry.occluded && alive(entry) && entry.visible) {
      try {
        const shot = await Promise.race([cdp(entry, "Page.captureScreenshot", { format: "jpeg", quality: 70 }), sleep(300).then(() => null)]);
        if (shot?.data) image = `data:image/jpeg;base64,${shot.data}`;
      } catch { image = null; }
    }
    const wasShown = !!holder(entry);
    entry.occluded = occluded === true;
    place(entry);
    if (wasShown !== !!holder(entry)) notify(entry);
    return { image };
  }
  function focusPage(sender, { sessionId }) {
    const entry = previews.get(sessionId);
    if (!alive(entry) || entry.host?.sender !== sender) return false;
    entry.view.webContents.focus();
    return true;
  }

  // Navigation: `agent` asks before an outside site (once per site and session).
  async function navigate(sessionId, value, { agent = null } = {}) {
    const entry = preview(sessionId);
    const allowed = launch.navigationAllowed(value, entry.cwd);
    if (!allowed.ok) throw new Error(allowed.reason);
    if (agent) await agent.ensureSite(allowed.url);
    ensureView(entry);
    entry.error = null;
    const contents = entry.view.webContents;
    const done = new Promise((resolve) => {
      let settled = false;
      const finish = (result) => { if (settled) return; settled = true; clearTimeout(timer); contents.off("did-finish-load", ok); contents.off("did-fail-load", failed); entry.blockWaiters.delete(blocked); resolve(result); };
      const ok = () => finish({ ok: true });
      // A redirect to an outside site the user declined (holdOutside): the load ends there.
      const blocked = (host) => finish({ ok: false, code: "blocked", description: declinedText(host) });
      entry.blockWaiters.add(blocked);
      const failed = (_event, code, description, _url, isMainFrame) => { if (isMainFrame && code !== -3) finish({ ok: false, code, description }); };
      const timer = setTimeout(() => finish({ ok: true, slow: true }), 30000);
      contents.on("did-finish-load", ok);
      contents.on("did-fail-load", failed);
    });
    contents.loadURL(allowed.url).catch(() => {});
    rememberFile(entry, allowed.url);
    const result = await done;
    armReap(entry, true);
    notify(entry);
    return { ...result, url: contents.getURL(), title: contents.getTitle() };
  }
  // An HTML file of the session folder the preview opened (file://), for Servers & settings › Files.
  function rememberFile(entry, url) {
    let file;
    try { file = require("node:url").fileURLToPath(url); } catch { return; }
    if (!/\.html?$/i.test(file) || !launch.insideFolder(entry.cwd, file)) return;
    entry.recentFiles = [file, ...entry.recentFiles.filter((other) => other !== file)].slice(0, 8);
  }
  async function openFile(sender, sessionId, file) {
    const entry = preview(sessionId);
    if (typeof file !== "string" || !path.isAbsolute(file) || !/\.html?$/i.test(file)) throw new Error("Choose an HTML file.");
    if (!launch.insideFolderReal(entry.cwd, file)) throw new Error("Choose an HTML file in this session’s folder.");
    subscribe(entry, sender);
    entry.agentDriven = false;
    return navigate(sessionId, require("node:url").pathToFileURL(file).href);
  }
  function userNavigate(sessionId, text) {
    const entry = preview(sessionId);
    const url = launch.parseUserUrl(text, entry.cwd, home);
    if (!url) throw new Error("Enter a URL.");
    entry.agentDriven = false;
    return navigate(sessionId, url);
  }
  function history(sessionId, action) {
    const entry = previews.get(sessionId);
    if (!alive(entry)) return false;
    const contents = entry.view.webContents;
    if (action === "back" && contents.navigationHistory.canGoBack()) contents.navigationHistory.goBack();
    else if (action === "forward" && contents.navigationHistory.canGoForward()) contents.navigationHistory.goForward();
    else if (action === "reload") { if (entry.crashed) { entry.crashed = false; contents.loadURL(entry.url || "about:blank").catch(() => {}); } else contents.reload(); }
    else if (action === "stop") contents.stop();
    return true;
  }
  function emulate(sessionId, { preset, width, height, colorScheme, agent = false } = {}) {
    const entry = preview(sessionId);
    const next = { ...entry.viewport };
    if (preset !== undefined) {
      if (preset === "desktop" || preset === "responsive") Object.assign(next, { preset: "responsive", width: null, height: null });
      else if (PRESETS[preset]) Object.assign(next, { preset, ...PRESETS[preset] });
      else if (preset === "custom") {
        const w = Math.round(Number(width)), h = Math.round(Number(height));
        if (!(w >= 200 && w <= 4000 && h >= 200 && h <= 4000)) throw new Error("A custom viewport is 200–4000 pixels wide and tall.");
        Object.assign(next, { preset: "custom", width: w, height: h });
      } else throw new Error("Unknown viewport preset.");
    }
    if (colorScheme !== undefined) {
      if (!COLOR_SCHEMES.has(colorScheme)) throw new Error("Unknown color scheme.");
      next.colorScheme = colorScheme;
    }
    next.setByAgent = agent === true;
    entry.viewport = next;
    place(entry);
    entry.emulating = applyEmulation(entry).catch(() => {});
    notify(entry);
    return { ...next };
  }
  async function capture(sessionId, { format = "png", quality = 80 } = {}) {
    const entry = previews.get(sessionId);
    if (entry) await revive(entry);
    if (!alive(entry) || !entry.url || entry.url === "about:blank") throw new Error("Nothing is open in the preview.");
    const shot = await cdp(entry, "Page.captureScreenshot", format === "jpeg" ? { format: "jpeg", quality } : { format: "png" });
    return Buffer.from(shot.data, "base64");
  }
  function openDevTools(sessionId) {
    const entry = previews.get(sessionId);
    if (!alive(entry)) throw new Error("Nothing is open in the preview.");
    const contents = entry.view.webContents;
    if (contents.isDevToolsOpened()) contents.closeDevTools(); else contents.openDevTools({ mode: "detach", activate: true });
    return true;
  }
  function openExternal(sessionId) {
    const entry = previews.get(sessionId);
    const url = alive(entry) ? entry.view.webContents.getURL() : entry?.url;
    if (!url || !/^https?:\/\//i.test(url)) throw new Error("This only works for websites.");
    return shell.openExternal(url).then(() => true);
  }

  // ------------------------------------------------------------------ dev servers
  async function startServer(sessionId, name, { open = true, agent = null } = {}) {
    const entry = preview(sessionId);
    const info = launchInfo(entry.cwd);
    if (!info.exists) throw Object.assign(new Error(`No .claude/launch.json in ${entry.cwd}.`), { code: "no-config" });
    const config = info.configs.find((candidate) => candidate.name.toLowerCase() === String(name || "").toLowerCase()) ?? (!name && info.configs.length === 1 ? info.configs[0] : null);
    if (!config) throw Object.assign(new Error(info.configs.length ? `No server named “${name}” in .claude/launch.json. Available: ${info.configs.map((c) => c.name).join(", ")}.` : info.error || "launch.json has no usable configurations."), { code: "no-server" });
    const key = serverKey(entry.cwd, config.name);
    let server = servers.get(key);
    let reused = false;
    if (server && (server.status === "running" || server.status === "starting")) reused = true;
    else {
      // The agent starting a command (not the user's own Start): the user approves that exact configuration first.
      if (agent && !config.attach) await agent.approveServer(config);
      server = servers.get(key);
      if (server && (server.status === "running" || server.status === "starting")) reused = true;
      else server = await spawnServer(entry.cwd, config, key);
    }
    entry.lastServer = config.name;
    notifyFolder(entry.cwd);
    const ready = await server.ready;
    notifyFolder(entry.cwd);
    if (!ready.ok) throw Object.assign(new Error(ready.message), { code: ready.code, logs: server.logs.slice(-40).map(stripAnsi) });
    let page = null;
    if (open) page = await navigate(sessionId, server.url, { agent });
    return { server: serverView(server), reused, page, assignedPort: server.assignedPort ?? null, configuredPort: config.port };
  }
  async function spawnServer(cwd, config, key) {
    const server = { key, cwd, name: config.name, config, child: null, status: "starting", port: config.port, url: launch.configUrl(config), logs: [], error: null, attach: config.attach, startedAt: Date.now(), exitCode: null, ready: null };
    servers.set(key, server);
    const log = (text) => { for (const line of String(text).split(/\r?\n/)) if (line.length) push(server.logs, line.slice(0, 4000), LOG_LIMIT); };
    const fail = (code, message) => { server.status = "failed"; server.error = { code, message }; notifyFolder(cwd); return { ok: false, code, message }; };
    server.ready = (async () => {
      if (config.attach) {
        server.status = "running";
        return { ok: true };
      }
      if (config.port && await portOpen(config.port)) {
        if (!config.autoPort) return fail("port-in-use", `Port ${config.port} is already in use. Stop whatever is using it, or set "autoPort": true for "${config.name}" in .claude/launch.json.`);
        server.port = await freePort();
        server.assignedPort = server.port;
        server.url = launch.configUrl(config, server.port);
      }
      let env;
      try { env = await spawnEnv(); } catch { env = { ...process.env }; }
      // The folder launch.json named was inside the project when it was read (and approved); a link swapped in since
      // doesn't move the command outside it.
      if (!launch.insideFolderReal(cwd, config.cwd)) return fail("cwd", `The "cwd" of “${config.name}” in .claude/launch.json is outside the project folder (it may be a link to another folder). Nothing was run.`);
      let child;
      try {
        child = spawn(config.command, config.args, { cwd: config.cwd, env: { ...env, FORCE_COLOR: "1", ...config.env, ...(server.port ? { PORT: String(server.port) } : {}) }, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
      } catch (error) {
        return fail("spawn", `Couldn’t start \`${config.command}\`: ${error.message}`);
      }
      server.child = child;
      log(`$ ${[config.command, ...config.args].join(" ")}`);
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", log);
      child.stderr.on("data", log);
      let exited = null;
      const exit = new Promise((resolve) => {
        child.once("error", (error) => { exited = { error }; resolve(exited); });
        child.once("exit", (code, signal) => { exited = { code, signal }; resolve(exited); });
      });
      exit.then(() => {
        server.child = null;
        server.exitCode = exited?.code ?? null;
        if (server.status === "running" || server.status === "stopping") {
          if (server.status === "running") log(`[process exited${exited?.code != null ? ` with code ${exited.code}` : ""}]`);
          server.status = "stopped";
        }
        notifyFolder(cwd);
      });
      const describeExit = () => exited?.error?.code === "ENOENT"
        ? fail("not-found", `Command not found: \`${config.command}\`. Check the "runtimeExecutable" field in .claude/launch.json and make sure it's installed and on PATH.`)
        : exited?.error ? fail("spawn", `Couldn’t start \`${config.command}\` (${exited.error.code || exited.error.message}).`)
          : fail("exited", `The dev server exited during startup (code ${exited?.code ?? exited?.signal}). Fix the error in the output, then start it again.`);
      const deadline = Date.now() + READY_TIMEOUT_MS;
      while (Date.now() < deadline) {
        if (exited) return describeExit();
        if (server.status === "stopping" || server.status === "stopped") return { ok: false, code: "stopped", message: "The server was stopped." };
        if (!server.port || await portOpen(server.port)) { server.status = "running"; notifyFolder(cwd); return { ok: true }; }
        await Promise.race([sleep(250), exit]);
      }
      stopProcess(server);
      return fail("timeout", `The dev server didn’t answer on port ${server.port} within ${READY_TIMEOUT_MS / 1000} seconds.`);
    })();
    // A start that fails before the process runs leaves no zombie entry behind in "starting".
    server.ready.then((result) => { if (!result.ok && server.status === "starting") server.status = "failed"; });
    return server;
  }
  // A dev server runs in its own process group (spawnServer detached): a signal goes to the whole group, so the
  // programs npm or a shell started for it get it too.
  function signalGroup(child, name) {
    if (!child?.pid) return;
    try { if (process.platform !== "win32") process.kill(-child.pid, name); else child.kill(name); } catch { try { child.kill(name); } catch { /* gone */ } }
  }
  function stopProcess(server) {
    const child = server.child;
    if (!child?.pid) return;
    const signal = (name) => signalGroup(child, name);
    signal("SIGTERM");
    const timer = setTimeout(() => signal("SIGKILL"), 3000);
    timer.unref?.();
    child.once("exit", () => clearTimeout(timer));
  }
  async function stopServer(sessionId, name) {
    const entry = preview(sessionId);
    const server = servers.get(serverKey(entry.cwd, String(name || entry.lastServer || "")));
    if (!server) throw new Error(`No server named “${name}” is running.`);
    if (server.attach) { servers.delete(server.key); notifyFolder(entry.cwd); return { stopped: true, attach: true }; }
    if (server.child) {
      server.status = "stopping";
      const exited = new Promise((resolve) => server.child.once("exit", resolve));
      stopProcess(server);
      await Promise.race([exited, sleep(4000)]);
    }
    server.status = "stopped";
    notifyFolder(entry.cwd);
    return { stopped: true };
  }
  function serverLogs(sessionId, name, { lines = 200, ansi = true } = {}) {
    const entry = preview(sessionId);
    const server = servers.get(serverKey(entry.cwd, String(name || entry.lastServer || "")));
    if (!server) return { name, lines: [], status: null };
    const out = server.logs.slice(-Math.max(1, Math.min(LOG_LIMIT, lines)));
    return { name: server.name, status: server.status, lines: ansi ? out : out.map(stripAnsi), error: server.error };
  }
  function clearLogs(sessionId, name) {
    const entry = preview(sessionId);
    const server = servers.get(serverKey(entry.cwd, String(name || "")));
    if (server) server.logs.length = 0;
    return true;
  }

  // ------------------------------------------------------------------ the agent's view of one session
  function forSession(session, { requestApproval = async () => false, signal = null } = {}) {
    const sessionId = session.id;
    const entry = () => preview(sessionId);
    const stopped = () => signal?.aborted ? new Error("The turn was stopped. Nothing was run.") : null;
    // A question this call asks closes when the call is cancelled (the turn was stopped).
    const ask = (request) => requestApproval(request, signal ? { signal } : {});
    // The agent uses the page from now on: its own outside navigations ask with this session's approval (no call's
    // signal: the page, not a call, starts them).
    const drive = (item = entry()) => { item.agentDriven = true; item.siteApproval = (request) => requestApproval(request, {}); return item; };
    const ensureSite = async (url) => {
      let parsed;
      try { parsed = new URL(url); } catch { return; }
      if (!/^https?:$/.test(parsed.protocol) || launch.isLocalHost(parsed.hostname)) return;
      const item = entry();
      if (item.approvedHosts.has(parsed.host)) return;
      // Asked once: a host the user declined in this session is refused without asking again.
      if (item.declinedHosts.has(parsed.host)) throw new Error(declinedText(parsed.host));
      const ok = await ask({ kind: "preview-site", host: parsed.host, url: parsed.href });
      if (stopped()) throw stopped();
      if (!ok) { item.declinedHosts.add(parsed.host); throw new Error(declinedText(parsed.host)); }
      item.approvedHosts.add(parsed.host);
      item.declinedHosts.delete(parsed.host);
    };
    // A launch.json command runs outside the core's sandbox, as the user: the agent starts one only after the user
    // approved that exact configuration in this session (an edited launch.json asks again).
    const approveServer = async (config) => {
      const item = entry();
      const fingerprint = crypto.createHash("sha256").update(JSON.stringify([config.command, config.args, config.cwd, config.env ?? {}, config.port ?? null, !!config.autoPort])).digest("hex");
      if (item.approvedServers.has(fingerprint)) return;
      if (stopped()) throw stopped();
      const ok = await ask({ kind: "preview-server", name: config.name, command: config.command, args: config.args, cwd: config.cwd, env: config.env ?? {} });
      if (stopped()) throw stopped();
      if (!ok) throw Object.assign(new Error(`The user didn’t allow starting “${config.name}”. Nothing was run.`), { code: "declined" });
      item.approvedServers.add(fingerprint);
    };
    const agent = { ensureSite, approveServer };
    // The tools work with no pane showing the page; a page the reaper closed reopens first (2.2553.1 YX → xX).
    const requirePage = async () => {
      const item = entry();
      await revive(item);
      if (!alive(item) || !item.url || item.url === "about:blank") throw new Error("Nothing is open in the preview. Start a server with preview_start or open a page with navigate first.");
      await ensureSite(item.view.webContents.getURL());
      armReap(item, true);
      return drive(item);
    };
    // After a click or key press: a navigation it started settles (bounded), and an outside site it was kept from is named.
    const settle = async (item, since) => {
      await sleep(150);
      if (alive(item) && item.view.webContents.isLoading?.()) {
        await new Promise((resolve) => { const timer = setTimeout(resolve, 3000); item.view.webContents.once("did-stop-loading", () => { clearTimeout(timer); resolve(); }); });
      }
      const blocked = item.blocked && item.blocked.at >= since ? item.blocked : null;
      // A download the click started: the user picks where to save it in the Save dialog, or it was cancelled (unseen page).
      const download = item.download && item.download.at >= since ? item.download : null;
      // A JavaScript dialog the page opened meanwhile, which never showed (the Page.javascriptDialogOpening handler).
      const dialog = item.dialog && item.dialog.at >= since ? item.dialog : null;
      return { url: alive(item) ? item.view.webContents.getURL() : item.url, ...(blocked ? { blocked: { host: blocked.host, declined: blocked.declined === true || item.declinedHosts.has(blocked.host) } } : {}),
        ...(dialog ? { dialog: { type: dialog.type, message: dialog.message, returned: dialog.returned } } : {}),
        ...(download ? { download: { file: download.file, state: download.state, ...(download.reason === "not-shown" ? { note: "The preview isn’t on screen, so the download was cancelled. Ask the user to show the Preview pane." } : download.state === "saving" ? { note: "The user chooses where to save it in the Save dialog." } : {}) } } : {}) };
    };
    const isolated = (item, code, gesture = false) => item.view.webContents.executeJavaScriptInIsolatedWorld(scripts.WORLD_ID, [{ code }], gesture);
    const reveal = () => broadcast({ kind: "preview-reveal", sessionId });
    return {
      sessionId,
      cwd: session.cwd,
      launchInfo: () => launchInfo(entry().cwd),
      snapshot: () => snapshot(entry()),
      reveal,
      async start({ name, url } = {}) {
        drive();
        if (url && !name) { reveal(); return { page: await navigate(sessionId, url, { agent }), server: null, reused: false }; }
        reveal();
        return startServer(sessionId, name, { agent });
      },
      stop: (name) => stopServer(sessionId, name),
      logs: (name, options) => serverLogs(sessionId, name, { ...options, ansi: false }),
      list() {
        const item = entry(), info = launchInfo(item.cwd);
        const running = new Map([...servers.values()].filter((server) => server.cwd === item.cwd).map((server) => [server.name.toLowerCase(), server]));
        return {
          launchFile: info.file, exists: info.exists, error: info.error, problems: info.problems,
          servers: info.configs.map((config) => { const server = running.get(config.name.toLowerCase()); return { name: config.name, port: server?.port ?? config.port, url: server?.url ?? launch.configUrl(config), status: server?.status ?? "stopped", attach: config.attach }; }),
          page: alive(item) && item.url ? { url: item.view.webContents.getURL(), title: item.view.webContents.getTitle(), loading: item.loading }
            : item.reclaimed && item.url ? { url: item.url, title: item.title, loading: false, reclaimed: true } : null,
          viewport: { ...item.viewport },
        };
      },
      async navigate(url) {
        const item = entry();
        if (url === "back" || url === "forward") {
          await requirePage();
          history(sessionId, url);
          await sleep(400);
          return { url: item.view.webContents.getURL(), title: item.view.webContents.getTitle() };
        }
        const target = launch.parseUserUrl(url, item.cwd, home);
        if (!target) throw new Error("Give a URL to open.");
        drive(item);
        reveal();
        return navigate(sessionId, target, { agent });
      },
      async screenshot({ quality = 80 } = {}) {
        await requirePage();
        const data = (await capture(sessionId, { format: "jpeg", quality: Math.max(30, Math.min(95, Math.round(quality))) })).toString("base64");
        return { data, mimeType: "image/jpeg" };
      },
      async readPage({ filter = "all", maxChars = 50000 } = {}) {
        const item = await requirePage();
        return isolated(item, scripts.readPageScript({ filter, maxChars }));
      },
      async pageText({ maxChars = 50000 } = {}) {
        const item = await requirePage();
        return isolated(item, scripts.pageTextScript({ maxChars }));
      },
      async click({ ref = null, selector = null, x = null, y = null, doubleClick = false } = {}) {
        const item = await requirePage();
        const since = Date.now();
        const count = doubleClick ? 2 : 1;
        if (onScreen(item)) {
          let point = { x, y, label: "" };
          if (ref || selector) {
            point = await isolated(item, scripts.locateScript({ ref, selector }));
            if (point?.error) throw new Error(point.error);
          } else if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Name an element (ref or selector) or a point (x, y).");
          await cdp(item, "Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y, button: "none" });
          for (let i = 1; i <= count; i++) {
            await cdp(item, "Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: i });
            await cdp(item, "Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: i });
          }
          return { clicked: point.label || (ref || selector || `(${x}, ${y})`), ...(await settle(item, since)) };
        }
        if (!ref && !selector && (!Number.isFinite(x) || !Number.isFinite(y))) throw new Error("Name an element (ref or selector) or a point (x, y).");
        const result = await isolated(item, scripts.domClickScript({ ref, selector, x, y, clickCount: count }), true);
        if (result?.error) throw new Error(result.error);
        return { clicked: ref || selector || `(${x}, ${y})`, ...(await settle(item, since)) };
      },
      async type({ text, ref = null, selector = null, clear = false, submit = false } = {}) {
        const item = await requirePage();
        if (typeof text !== "string") throw new Error("Give the text to type.");
        if (ref || selector) {
          const located = await isolated(item, scripts.locateScript({ ref, selector, focus: true }));
          if (located?.error) throw new Error(located.error);
        }
        if (clear) await isolated(item, "document.execCommand('selectAll'); document.execCommand('delete'); true", true);
        if (text) await cdp(item, "Input.insertText", { text });
        if (submit) await this.press({ keys: "Enter" });
        return { typed: text.length };
      },
      async press({ keys } = {}) {
        const item = await requirePage();
        const since = Date.now();
        const list = (Array.isArray(keys) ? keys : String(keys || "").split(/\s+/)).filter(Boolean);
        if (!list.length) throw new Error("Name the keys to press, e.g. \"Enter\" or \"cmd+a\".");
        for (const combo of list.slice(0, 50)) {
          const key = scripts.parseKeyCombo(combo);
          if (!key) throw new Error(`Unknown key: ${combo}`);
          if (onScreen(item)) {
            const base = { key: key.key, code: key.code, windowsVirtualKeyCode: key.keyCode, nativeVirtualKeyCode: key.keyCode, modifiers: key.modifiers };
            await cdp(item, "Input.dispatchKeyEvent", { type: key.text ? "keyDown" : "rawKeyDown", ...base, ...(key.text ? { text: key.text, unmodifiedText: key.text } : {}), ...(key.commands.length ? { commands: key.commands } : {}) });
            await cdp(item, "Input.dispatchKeyEvent", { type: "keyUp", ...base });
          } else if (key.text && key.text.length === 1 && key.key !== "Enter" && key.text !== "\r") {
            await cdp(item, "Input.insertText", { text: key.text });
          } else {
            await isolated(item, scripts.domKeyScript({ key: key.key, modifiers: key.mods }), true);
          }
        }
        return { pressed: list, ...(await settle(item, since)) };
      },
      // scroll / hover / find (agent-tools/preview.mjs): an element into view or a box by wheel ticks; the pointer
      // over an element (native input on screen, its pointer events otherwise); elements by role, name or text.
      async scroll({ ref = null, selector = null, x = null, y = null, direction = null, amount = 3 } = {}) {
        const item = await requirePage();
        if (!ref && !selector && direction === null) throw new Error("Name an element (ref or selector) to scroll into view, or a direction to scroll.");
        const result = await isolated(item, scripts.scrollScript({ ref, selector, x, y, direction, amount }));
        if (result?.error) throw new Error(result.error);
        return result;
      },
      async hover({ ref = null, selector = null, x = null, y = null } = {}) {
        const item = await requirePage();
        if (!ref && !selector && (!Number.isFinite(x) || !Number.isFinite(y))) throw new Error("Name an element (ref or selector) or a point (x, y).");
        if (onScreen(item)) {
          let point = { x, y, label: "" };
          if (ref || selector) {
            point = await isolated(item, scripts.locateScript({ ref, selector }));
            if (point?.error) throw new Error(point.error);
          }
          await cdp(item, "Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y, button: "none" });
          await sleep(100);
          return { hovered: point.label || ref || selector || `(${x}, ${y})` };
        }
        const result = await isolated(item, scripts.domHoverScript({ ref, selector, x, y }), true);
        if (result?.error) throw new Error(result.error);
        return { hovered: result.hovered || ref || selector || `(${x}, ${y})` };
      },
      async find({ query, limit = 20 } = {}) {
        const item = await requirePage();
        if (typeof query !== "string" || !query.trim()) throw new Error("Give the text to look for.");
        const result = await isolated(item, scripts.findScript({ query, limit }));
        if (result?.error) throw new Error(result.error);
        return { ...result, url: item.view.webContents.getURL() };
      },
      async inspect({ ref = null, selector = null, properties = [] } = {}) {
        const item = await requirePage();
        const result = await isolated(item, scripts.inspectScript({ ref, selector, properties }));
        if (result?.error) throw new Error(result.error);
        return result;
      },
      async fill({ ref = null, selector = null, value = "" } = {}) {
        const item = await requirePage();
        const result = await isolated(item, scripts.fillScript({ ref, selector, value: String(value) }), true);
        if (result?.error) throw new Error(result.error);
        return result;
      },
      /** preview_eval: an expression in the page's own context (debugging; promises are awaited, the value returned as JSON). */
      async evaluate({ expression } = {}) {
        const item = await requirePage();
        if (typeof expression !== "string" || !expression.trim()) throw new Error("Give the JavaScript expression to run.");
        if (expression.length > 20000) throw new Error("The expression is too long (20,000 characters at most).");
        const reply = await cdp(item, "Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true, timeout: 10000, replMode: true });
        if (reply?.exceptionDetails) {
          const details = reply.exceptionDetails;
          throw new Error(`Uncaught ${details.exception?.description || details.exception?.value || details.text || "error"}`.slice(0, 4000));
        }
        const remote = reply?.result ?? {};
        let text;
        if (remote.type === "undefined") text = "undefined";
        else if (Object.hasOwn(remote, "value")) { try { text = JSON.stringify(remote.value, null, 2); } catch { text = String(remote.value); } }
        else text = remote.description ?? remote.type ?? "";
        return { text: text.length > 20000 ? `${text.slice(0, 20000)}\n… (truncated)` : text, type: remote.subtype || remote.type };
      },
      /** null: the page was reaped while hidden, so its earlier output is gone (RECLAIMED_NOTE). */
      consoleMessages({ level = "all", lines = 50, pattern = "", clear = false } = {}) {
        const item = entry();
        if (item.reclaimed && !alive(item)) return null;
        const order = { error: 3, warn: 2 };
        let list = item.console.filter((line) => level === "all" || (level === "error" ? line.level === "error" : (order[line.level] ?? 0) >= 2));
        if (pattern) { const needle = String(pattern).toLowerCase(); list = list.filter((line) => line.text.toLowerCase().includes(needle)); }
        list = list.slice(-Math.max(1, Math.min(CONSOLE_LIMIT, lines)));
        if (clear) item.console.length = 0;
        return list;
      },
      networkRequests({ filter = "all", limit = 50, urlPattern = "" } = {}) {
        const item = entry();
        if (item.reclaimed && !alive(item)) return null;
        let list = item.network.filter((request) => filter !== "failed" || request.failed || (request.status ?? 0) >= 400);
        if (urlPattern) { const needle = String(urlPattern).toLowerCase(); list = list.filter((request) => request.url.toLowerCase().includes(needle)); }
        return list.slice(-Math.max(1, Math.min(NETWORK_LIMIT, limit)));
      },
      async resize({ preset, width, height, colorScheme } = {}) {
        const custom = preset === undefined && Number.isFinite(width) && Number.isFinite(height) ? "custom" : preset;
        const viewport = emulate(sessionId, { preset: custom, width, height, colorScheme, agent: true });
        await entry().emulating;
        return viewport;
      },
    };
  }

  /**
   * The app is quitting (or the service goes away): every dev server gets SIGTERM, up to graceMs to exit, then SIGKILL
   * for whatever is left of its process group, before this resolves (main.cjs awaits it): a server that ignores TERM
   * or shuts down slowly never outlives the app holding its port. The pages close at once.
   */
  function dispose({ graceMs = 2000 } = {}) {
    const running = [...servers.values()].filter((server) => server.child?.pid);
    for (const server of servers.values()) stopProcess(server);
    servers.clear();
    for (const entry of previews.values()) {
      clearTimeout(entry.notifyTimer);
      clearTimeout(entry.reapTimer);
      if (alive(entry)) { try { entry.view.webContents.close(); } catch { /* gone */ } }
    }
    previews.clear();
    for (const record of launchWatchers.values()) { clearTimeout(record.timer); for (const watcher of [record.folder, record.claude]) { try { watcher?.close(); } catch { /* closed */ } } }
    launchWatchers.clear();
    if (parking && !parking.isDestroyed()) parking.destroy();
    parking = null;
    if (!running.length) return Promise.resolve();
    const exits = running.map(({ child }) => child.exitCode !== null || child.signalCode !== null ? Promise.resolve() : new Promise((resolve) => child.once("exit", resolve)));
    return Promise.race([Promise.all(exits), sleep(graceMs)]).then(() => { for (const { child } of running) signalGroup(child, "SIGKILL"); });
  }
  /** The renderer's desktop:call actions (validated here; `sender` is the calling webContents). */
  async function call(sender, action, p = {}) {
    const id = typeof p.sessionId === "string" ? p.sessionId : "";
    switch (action) {
      case "preview-state": return state(sender, id);
      case "preview-attach": return attach(sender, p);
      case "preview-detach": return detach(sender, p);
      case "preview-occlude": return occlude(sender, p);
      case "preview-focus": return focusPage(sender, p);
      case "preview-navigate": subscribe(preview(id), sender); return userNavigate(id, p.url);
      case "preview-history": return history(id, p.action);
      case "preview-emulate": return emulate(id, { preset: p.preset, width: p.width, height: p.height, colorScheme: p.colorScheme });
      case "preview-capture": return { bytes: new Uint8Array(await capture(id, { format: "png" })), name: "preview.png", type: "image/png" };
      case "preview-devtools": return openDevTools(id);
      case "preview-external": return openExternal(id);
      case "preview-download-reveal": {
        const saved = previews.get(id)?.download?.path;
        if (!saved || !fs.existsSync(saved)) throw new Error("The downloaded file isn’t there any more.");
        shell.showItemInFolder(saved);
        return true;
      }
      case "preview-server-start": {
        subscribe(preview(id), sender);
        preview(id).agentDriven = false; // the user's own Start: the page is theirs
        try { const result = await startServer(id, p.name); return { ok: true, server: result.server }; }
        catch (error) { return { ok: false, code: error.code || "error", message: error.message }; }
      }
      case "preview-server-stop": return stopServer(id, p.name);
      case "preview-server-logs": return serverLogs(id, p.name, { lines: Number(p.lines) || 500 });
      case "preview-server-clear-logs": return clearLogs(id, p.name);
      case "preview-keep-cookies": {
        // Pages opened from now on use the chosen session data; an open page keeps its own until it is reopened.
        if (typeof p.enabled !== "boolean") throw new Error("Unknown operation.");
        setKeepCookies(p.enabled);
        for (const entry of previews.values()) notify(entry);
        return snapshot(preview(id));
      }
      case "preview-clear-data": {
        // Every saved cookie, local storage and cache of previewed pages, in all workspaces (both session stores).
        await Promise.all([PARTITION, EPHEMERAL_PARTITION].map((name) => {
          const ses = electronSession.fromPartition(name);
          return Promise.all([ses.clearStorageData(), ses.clearCache?.()].filter(Boolean)).catch(() => {});
        }));
        return snapshot(preview(id));
      }
      case "preview-detect": {
        // The pane's "Detect dev server": the session folder's own scripts (package.json, manage.py) and an HTML entry.
        const entry = preview(id);
        const root = entry.cwd;
        const inside = (name) => { const file = path.resolve(root, name); return launch.insideFolderReal(root, file) ? file : null; };
        return launch.detectServerCandidates({
          read: (name) => { const file = inside(name); if (!file) return null; try { const stat = fs.statSync(file); return stat.isFile() && stat.size <= 1 << 20 ? fs.readFileSync(file, "utf8") : null; } catch { return null; } },
          exists: (name) => { const file = inside(name); try { return !!file && fs.statSync(file).isFile(); } catch { return false; } },
        });
      }
      case "preview-use-server": {
        // A detected server the user chose (Use): written as the project's .claude/launch.json (never over an existing
        // one), then started like the pane's own Run.
        const entry = preview(id);
        const candidate = p.candidate;
        if (!candidate || typeof candidate !== "object" || typeof candidate.name !== "string" || typeof candidate.runtimeExecutable !== "string" || !Array.isArray(candidate.runtimeArgs)) throw new Error("Unknown operation.");
        const file = path.join(entry.cwd, launch.LAUNCH_FILE);
        if (fs.existsSync(file)) throw new Error("This project already has a .claude/launch.json.");
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, launch.launchConfigText(candidate), { flag: "wx" });
        launchCache.delete(entry.cwd);
        notifyFolder(entry.cwd);
        subscribe(entry, sender);
        entry.agentDriven = false;
        try { const result = await startServer(id, candidate.name); return { ok: true, server: result.server }; }
        catch (error) { return { ok: false, code: error.code || "error", message: error.message }; }
      }
      case "preview-auto-verify": {
        // Servers & settings › Enable/Disable auto verify (2.2553.1 U_): top-level autoVerify in .claude/launch.json,
        // written in place so the file's comments and layout stay.
        if (typeof p.enabled !== "boolean") throw new Error("Unknown operation.");
        const entry = preview(id);
        const file = path.join(entry.cwd, launch.LAUNCH_FILE);
        let text;
        try { text = fs.readFileSync(file, "utf8"); } catch { throw new Error("No .claude/launch.json in this folder yet."); }
        fs.writeFileSync(file, launch.withAutoVerify(text, p.enabled));
        launchCache.delete(entry.cwd);
        notifyFolder(entry.cwd);
        return snapshot(entry);
      }
      // Servers & settings › Files › Open file… (2.2553.1 pickHtmlFile): an .html file of the session folder.
      case "preview-open-file": {
        const entry = preview(id);
        const window = windowOf(sender);
        const options = { title: "Open file", defaultPath: entry.cwd, properties: ["openFile"], filters: [{ name: "HTML", extensions: ["html", "htm"] }] };
        const dialog = electron.dialog;
        if (!dialog?.showOpenDialog) throw new Error("Unknown operation.");
        const picked = window && !window.isDestroyed?.() ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
        if (picked.canceled || !picked.filePaths?.[0]) return { canceled: true };
        return openFile(sender, id, picked.filePaths[0]);
      }
      // A recently previewed file of this session (the Files group's list).
      case "preview-open-recent": {
        const entry = preview(id);
        if (!entry.recentFiles.includes(p.path)) throw new Error("Unknown operation.");
        return openFile(sender, id, p.path);
      }
      case "preview-reveal-config": {
        const entry = preview(id);
        const file = path.join(entry.cwd, launch.LAUNCH_FILE);
        if (!fs.existsSync(file)) throw new Error("No .claude/launch.json in this folder yet.");
        const failure = await shell.openPath(file);
        if (failure) throw new Error(failure);
        return true;
      }
      default: throw new Error("Unknown operation.");
    }
  }
  return { call, forSession, snapshot: (id) => snapshot(preview(id)), dispose, launchInfo, windowClosed, PARTITION, EPHEMERAL_PARTITION, _previews: previews, _servers: servers };
}

module.exports = { createPreviewService, previewShortcut, PARTITION, EPHEMERAL_PARTITION, PRESETS, REAP_HIDDEN_MS, RECLAIMED_NOTE };
