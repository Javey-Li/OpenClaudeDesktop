const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  Menu, powerSaveBlocker, powerMonitor, Notification, clipboard, nativeImage, Tray, nativeTheme, screen,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const run = promisify(execFile);
const { CodexClient, stopAllCodexClients, resolveCore } = require("./codex.cjs");
const { respondToApproval } = require("./respond-approval.cjs");
const { interruptTurn } = require("./interrupt-turn.cjs");
const { createSessionOperations } = require("./session-operations.cjs");
const { createCustomizeOperations } = require("./customize-operations.cjs");
const { installShutdownHandler } = require("./shutdown.cjs");
const { listFiles, readFile, scopedPath } = require("./files.cjs");
const {createImageOperations}=require('./image-files.cjs');
const imageOperations=createImageOperations({getRoot:workspaceQueryRoot,clipboard,nativeImage,showSaveDialog:options=>dialog.showSaveDialog(win,options)});
const { createFileNameSearch } = require("./file-name-search.cjs");
const fileSearch = createFileNameSearch();
// Main-owned folder choices survive home/session navigation for this process.
// A renderer may select one of these values, never introduce a new root.
const approvedWorkspaceRoots = new Set();
// Working directories observed from the Codex thread list. Repository queries
// are scoped to these, the chosen folder, approved roots and session metadata.
const observedThreadCwds = new Set();
function workspaceQueryRoot(cwd) {
  const requested = typeof cwd === "string" && cwd ? cwd : config.cwd;
  const known = [config.cwd, ...approvedWorkspaceRoots, ...observedThreadCwds,
    ...Object.values(config.threadMetadata || {}).map(meta => meta?.cwd)];
  if (!known.includes(requested)) throw new Error("Unknown workspace directory.");
  return requested;
}
// A worktree session compares against the branch it was created from; every
// other local session uses the inferred default (official baseIsResolvedDefault).
function sessionBaseBranch(sessionId, cwd) {
  const fromSession = sessionId && config.sessionMetadata?.[sessionId]?.baseBranch;
  if (typeof fromSession === "string" && fromSession) return fromSession;
  const fromWorktree = config.worktreeBases?.[cwd];
  return typeof fromWorktree === "string" && fromWorktree ? fromWorktree : undefined;
}
const { recordActivity, readableLedger, ledgerStats, statsShape, statsCoreKey, keptCodeStats } = require("./activity.cjs");
const { workspaceGitStatus, workspaceGitDiff, workspaceGitComparison, workspaceGitCommits, workspaceGitBranches } = require("./git-status.cjs");
const { porcelainEntries, wouldBranchSwitchConflict } = require("./branch-switch.cjs");
app.setName("Code Desktop");
if (process.env.CODE_DESKTOP_DATA)
  app.setPath("userData", process.env.CODE_DESKTOP_DATA);
let win;
// Popped-out side panes (2.2553.1 openPopout type "epitaxy-side-pane"): one
// BrowserWindow per session+pane, same preload/sandbox, no approval routing.
const popouts = new Map();
const POPOUT_ACTIONS = new Set(["init", "files", "file", "files:search", "files:search:cancel", "workspace-git-status", "workspace-git-diff", "workspace-git-commits", "workspace-git-branches", "popout-dock", "popout-always-on-top", "home-shape"]);
const POPOUT_KINDS = new Set(["files", "changes", "plan"]);
let config;
let configPath;
let client;
let initial;
let connecting;
let desktopSettings;
let workflowService;
const {createAccountOperations}=require('./account-operations.cjs');
const accountOperations=createAccountOperations({getClient:()=>client,openExternal:url=>shell.openExternal(url),
  onState:auth=>emit({kind:'account-auth',auth}),onAccount:account=>{if(initial)initial={...initial,account};emit({kind:'account-snapshot',account});}});
const {createWorkflowService,workflowCoreCommand}=require("./workflow-service.cjs");
const {createBackgroundTasks}=require("./background-tasks.cjs");
const backgroundOperations=createBackgroundTasks({getClient:()=>client,getConfig:()=>config});
const {desktopPatch,createDesktopSettings} = require("./desktop-settings.cjs");
const {createMenuBar,showWindow} = require("./menu-bar.cjs");
const {appMenuTemplate,sidebarCollapsedPatch,navigationState,menuState,sameMenuState,closeAction,activateAction} = require("./app-menu.cjs");
const {windowBackground,trafficLightPosition,scaleTrafficLights,zoomLevelAfter,clampZoomFactor} = require("./window-chrome.cjs");
const {contextMenuTemplate,externalLink} = require("./context-menu.cjs");
const {DEFAULT_WINDOW_SIZE,WINDOW_STATE_FILE,loadWindowState,windowStateBounds,restoreWindowState,trackWindowState} = require("./window-state.cjs");
let menuBar;
// Set by the app "before-quit" listener (index.chunk-ChZ67Jhw.js kk()): only a
// quit lets the main window's "close" through; otherwise it hides.
let quitting = false;
// True once the main window was hidden by its close handler; a menu command
// for the renderer brings it back (Zxr) and its "show" event clears it.
let mainHidden = false;
const {mcpDefinitions,storageReport,storageCoreRoot,editConfigTarget,recordSettingsFailure} = require("./settings-pages.cjs");
const { createThemeFiles } = require("./theme-files.cjs");
const {createHarnessProfile} = require("./harness-profile.cjs");
const {createInstructionsService} = require("./instructions-service.cjs");
const { createPersonaImage } = require("./persona-image.cjs");
const { createModelSettings } = require("./model-settings.cjs");
const { createCustomCommands } = require("./custom-commands.cjs");
const sessionOperations = createSessionOperations({ getClient: () => client, getConfig: () => config, save, emit });
// Skills / Connectors / Plugins catalog (skills/list, mcpServerStatus/list,
// plugin/installed, ...): validated operations, never the raw rpc allowlist.
const customizeOperations = createCustomizeOperations({ getClient: () => client, getConfig: () => config, knownCwd: (cwd) => workspaceQueryRoot(cwd) });
const themeFiles = createThemeFiles({ dialog, getWindow: () => win });
const harnessProfile = createHarnessProfile({app,shell,dialog,getConfig:()=>config,getClient:()=>client,emit,getWindow:()=>win});
const instructionsService = createInstructionsService({getConfig:()=>config,getClient:()=>client,shell,knownCwd:(cwd)=>workspaceQueryRoot(cwd)});
const personaImage = createPersonaImage({ dialog, getWindow: () => win });
const modelSettings = createModelSettings({ getConfig: () => config, getClient: () => client, app, getHarnessProfile: () => harnessProfile });
const customCommands = createCustomCommands({ app, shell, dialog, getConfig: () => config, emit: (e) => emit(e), getWindow: () => win, knownCwd: (cwd) => workspaceQueryRoot(cwd) });
// Sidebar metadata snapshot returned by every sidebar-state mutation.
function sidebarSnapshot() {
  return { sessionMetadata: config.sessionMetadata, customGroups: config.customGroups, sidebarPreferences: config.sidebarPreferences,
    pinnedOrder: config.pinnedOrder || [], projectOrder: Array.isArray(config.projectOrder) ? config.projectOrder : [], revision: config.sidebarRevision };
}
// OS launchers behind one seam so isolated GUI suites can intercept them the
// way they intercept shell.openPath; production always runs the real command.
const externalOpeners = { terminal: (cwd) => run("open", ["-a", "Terminal", "--", cwd], { timeout: 10000 }) };
globalThis.codeDesktopExternalOpeners = externalOpeners;
const allowed = new Set([
  "thread/start",
  "thread/resume",
  "thread/read",
  "thread/list",
  "thread/name/set",
  "thread/archive",
  "thread/unarchive",
  // Protocol ThreadDeleteParams {threadId}: destructive, so the renderer must
  // confirm first and the guard below refuses running/pending sessions.
  "thread/delete",
  // ThreadUnsubscribeParams {threadId}: the renderer sends it only on the
  // DeepSeek core, for an idle session it left (session-unload-model.mjs), so
  // the Harness write lock is released; the core reopens it on next use.
  "thread/unsubscribe",
  "turn/start",
  // Codex 0.155.1 app-server queue/steer surface (probed against the binary
  // with an isolated CODEX_HOME): thread/queue/add requires clientUserMessageId,
  // delete/update take queuedSubmissionId, reorder takes queuedSubmissionIds,
  // list returns {data, nextCursor}; turn/steer needs expectedTurnId.
  "thread/queue/add",
  "thread/queue/list",
  "thread/queue/update",
  "thread/queue/delete",
  "thread/queue/reorder",
  "thread/queue/start",
  // Codex 0.155.1 paginated thread history: a paginated thread is resumed with
  // excludeTurns (ts/v2/ThreadResumeParams.ts:33-40) and hydrated through these
  // two read-only stable pagers (ts/ClientRequest.ts:108) instead of deprecated
  // full-history hydration.
  "thread/turns/list",
  "thread/items/list",
  "model/list",
  "account/read",
  "account/rateLimits/read",
  "account/usage/read",
  // DeepSeek bridge extension (harness index.js, capabilities.livePermissions): a Mode change during a turn,
  // sent with the turn/start permission params; bypass is validated like turn/start below.
  "codeDesktop/thread/permissions",
  // DeepSeek bridge extension (capabilities.modelWorkflows): stop a run of the model's `workflow` tool.
  "codeDesktop/workflow/stop",
  // DeepSeek bridge extension: the /btw side chat (side-question.js), read-only, plus its cancel.
  "codeDesktop/sideQuestion",
  "codeDesktop/sideQuestion/cancel",
]);
// Deprecated in 0.155.1 and deliberately unreachable from the renderer:
// thread/rollback (thread_processor.rs:810-826, replaced by thread/revert)
// and review/start delivery "detached" (turn_processor.rs:343-352). The
// allowlist already omits them; this records the refusal reason and keeps a
// later edit from re-adding one by accident.
const deprecated = new Map([
  ["thread/rollback", "thread/rollback is deprecated in Codex 0.155.1; thread/revert replaces it."],
]);
// Composer attachment staging: pasted clipboard images must become real files
// so turn/start can carry {type:"localImage",path}. They live under userData.
const IMAGE_TYPES = new Map([["image/png", "png"], ["image/jpeg", "jpg"], ["image/gif", "gif"], ["image/webp", "webp"]]);
const IMAGE_MAX_BYTES = 31457280;
const MIME_BY_EXTENSION = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };
function stagingDirectory() {
  return path.join(app.getPath("userData"), "attachments");
}
// Read-only facts for user-chosen files (dialog or Finder drop): the path must
// be absolute and a regular file; nothing is read beyond stat.
async function inspectAttachments(paths) {
  if (!Array.isArray(paths) || paths.length > 64) throw new Error("Choose at most 64 files.");
  const out = [];
  for (const candidate of paths) {
    if (typeof candidate !== "string" || !path.isAbsolute(candidate) || candidate.includes("\0")) continue;
    let stat;
    try { stat = await fs.promises.stat(candidate); } catch { continue; }
    if (!stat.isFile()) continue;
    const name = path.basename(candidate);
    const extension = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
    out.push({ path: candidate, name, size: stat.size, type: MIME_BY_EXTENSION[extension] || "" });
  }
  return out;
}
async function stageAttachment(payload) {
  const type = typeof payload?.type === "string" ? payload.type.toLowerCase() : "";
  const extension = IMAGE_TYPES.get(type);
  if (!extension) throw new Error("Only PNG, JPEG, GIF, and WebP images are supported.");
  const bytes = payload?.bytes;
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) throw new Error("Failed to process image. You can try again.");
  if (bytes.length > IMAGE_MAX_BYTES) throw new Error("Some images were too large to attach. Maximum size is 30 MB.");
  const directory = stagingDirectory();
  await fs.promises.mkdir(directory, { recursive: true });
  const stem = typeof payload.name === "string" && payload.name ? payload.name.replace(/[^\w.-]+/g, "_").slice(0, 64) : "image";
  const target = path.join(directory, `${Date.now().toString(36)}-${require("node:crypto").randomUUID().slice(0, 8)}-${stem.replace(/\.[^.]*$/, "")}.${extension}`);
  await fs.promises.writeFile(target, bytes, { flag: "wx" });
  return { path: target, name: path.basename(target), size: bytes.length, type };
}
// View > Hide/Show Sidebar label follows the persisted state (index.chunk-ChZ67Jhw.js _Nr/gNr).
// Go > Back/Forward enabled state (index.chunk-D6ATlqeD.js xyr/Syr), reported
// by the renderer's history and carried into every template rebuild.
let navState = navigationState();
// View pane items, Close Pane, File's ⌘W label (Close Session / Close Pane /
// Close Window) and Reopen Closed Session follow the renderer's "menu-state"
// report (the source's BZ.sessionPanes and BZ.reopenClosedSession, sent like
// navigation-state); app-menu.cjs menuState normalizes every key.
let paneMenuState = menuState();
function installAppMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate(appMenuTemplate({ sidebarOpen: config?.sidebarCollapsed !== true, ...navState, zoomed: mainZoomLevel() !== 0,
    fullScreen: liveContents(win) && win.isFullScreen(), allowDevTools: !app.isPackaged, menuState: paneMenuState, emit: menuEmit })));
}
function setMenuState(payload) {
  const next = menuState(payload);
  if (sameMenuState(next, paneMenuState)) return paneMenuState;
  paneMenuState = next;
  installAppMenu();
  return paneMenuState;
}
// Zxr: a menu command aimed at the renderer first brings back a main window
// the user closed (hidden) or minimized, and focuses it when another window
// (a pane window) was the menu's target.
function revealMainWindow(target) {
  if (!liveContents(win)) return;
  if (win.isMinimized()) win.restore();
  else if (mainHidden) win.show();
  if (target && target !== win && !target.isDestroyed()) win.focus();
}
// KK (Window > Show Main Window, the Dock and the tray's Show App): show the
// main window, recreating it when it no longer exists.
function showMainWindow() {
  if (liveContents(win)) showWindow(win);
  else if (!quitting && desktopReady) openMainWindow().catch(() => {});
}
// Help > Troubleshooting > Show Logs in Finder (Ejr): the app's logs folder.
async function showLogs() {
  const logs = app.getPath("logs");
  await fs.promises.mkdir(logs, { recursive: true });
  const error = await shell.openPath(logs);
  if (error) throw new Error(error);
}
// View > Actual Size / Zoom In / Zoom Out arrive as {kind:"zoom"}; Window >
// Show Main Window, Help > Show Logs and View > Enter/Exit Full Screen (xNr:
// the focused window) are main-process actions. A Close Pane aimed at a pane
// window closes (docks) that window, like owr's performClose for a non-main
// window. Every other menu event goes to the renderer.
function menuEmit(e, target) {
  if (e?.kind === "zoom") return applyZoom(e);
  if (e?.kind === "show-main-window") return showMainWindow();
  if (e?.kind === "show-logs") return void showLogs().catch(() => {});
  if (e?.kind === "toggle-full-screen") {
    const window = target && !target.isDestroyed() ? target : BrowserWindow.getFocusedWindow();
    if (window && window.isFullScreenable()) window.setFullScreen(!window.isFullScreen());
    return;
  }
  if ((e?.kind === "close-pane" || e?.kind === "close-session") && target && target !== win && !target.isDestroyed()) return target.close();
  // owr: in the main window the renderer's keydown owns ⌘W (pR); one that still reached File > Close
  // Session through the accelerator was declined there (a menu or dialog is open), so it is not re-sent.
  if (e?.kind === "close-session" && e.accelerator) return;
  revealMainWindow(target);
  emit(e);
}
// Pane windows keep their own traffic-light origin, scaled like the main one
// (index.chunk-ChZ67Jhw.js sun/cun: run(base, zoomFactor) per window).
const POPOUT_TRAFFIC_LIGHTS = Object.freeze({ x: 14, y: 12 });
const liveContents = (window) => window && !window.isDestroyed() && !window.webContents.isDestroyed();
const mainZoomLevel = () => liveContents(win) ? win.webContents.getZoomLevel() : 0;
const zoomFactorOf = (window) => clampZoomFactor(liveContents(window) ? window.webContents.getZoomFactor() : 1);
function placeTrafficLights(window) {
  if (!liveContents(window) || typeof window.setWindowButtonPosition !== "function") return;
  const factor = zoomFactorOf(window);
  window.setWindowButtonPosition(window === win ? trafficLightPosition(factor) : scaleTrafficLights(POPOUT_TRAFFIC_LIGHTS, factor));
}
// ONr/SNr: step (lNr .5) or reset the main window's level; CNr copies it to
// every window and repositions each window's lights (cun); DNr keeps Actual
// Size enabled only while zoomed; aF moves the main lights and dispatches the
// factor to the renderer (dispatchZoomFactorChanged), whose traffic-light
// spacer follows it.
function applyZoom(request) {
  if (!liveContents(win)) return;
  const level = zoomLevelAfter(win.webContents.getZoomLevel(), request);
  for (const window of [win, ...[...popouts.values()].map((entry) => entry.window)]) {
    if (!liveContents(window)) continue;
    window.webContents.setZoomLevel(level);
    placeTrafficLights(window);
  }
  zoomSettled();
}
function zoomSettled() {
  if (!liveContents(win)) return;
  const zoomed = mainZoomLevel() !== 0, menu = Menu.getApplicationMenu();
  for (const id of ["actual-size", "actual-size-numpad"]) {
    const item = menu?.getMenuItemById(id);
    if (item) item.enabled = zoomed;
  }
  emit({ kind: "zoom-factor", zoomFactor: zoomFactorOf(win) });
}
// Ctrl+wheel only requests a zoom ("zoom-changed" does not change the level
// itself, and the source registers no handler); re-sync the chrome so the
// lights always match whatever level the contents report.
function watchZoom(window) {
  window.webContents.on("zoom-changed", () => setImmediate(() => {
    placeTrafficLights(window);
    if (window === win) zoomSettled();
  }));
}
// Preload's synchronous first-paint appearance: the saved preference and the
// resolved mode, so the renderer never starts from a light frame. Windows are
// created only after preferences.mjs has loaded and set themePreference.
let themePreference = null;
// The UI language (electron/i18n), set from preferences.json once it is read.
let i18n = null;
ipcMain.on("desktop:appearance", (e) => {
  const theme = themePreference ? themePreference(config?.theme) : "system";
  e.returnValue = { theme, mode: nativeTheme.shouldUseDarkColors ? "dark" : "light", locale: i18n ? i18n.localePreference(config?.locale) : "en-US" };
});
function setNavigationState(payload) {
  navState = navigationState(payload);
  const menu = Menu.getApplicationMenu();
  const back = menu?.getMenuItemById("go-back"), forward = menu?.getMenuItemById("go-forward");
  if (back) back.enabled = navState.canGoBack;
  if (forward) forward.enabled = navState.canGoForward;
  return navState;
}
function emit(e) {
  if(e.kind==='workflow')desktopSettings?.observe(e);
  if (win && !win.isDestroyed()) win.webContents.send("desktop:event", e);
}
function receive(e) {
  sessionOperations.observe(e);
  accountOperations.observe(e);
  desktopSettings?.observe(e);
  const p = e.params || {};
  const id = p.threadId;
  if (recordActivity(config, e)) save();
  if (id && config.threadIds.includes(id) && e.method === "turn/completed") pushCodeStats();
  // A card hidden by a failed read comes back once the core is reachable again.
  if (e.kind === "connection" && e.connected && statsFailed) pushCodeStats();
  emit(e);
}
// Home stats card (cc43287c9-BMbiZYzF.js:3987-4004 $O getCodeStats; code-home.js:13711-13751
// Iw ranges it). A core listing capabilities.codeStats (the DeepSeek bridge) folds every
// session it can read (codeDesktop/stats/read); its last result stays in config.codeStats so
// the card paints at once on the next launch. Any other core (Codex) gets this client's own
// ledger (activity.cjs ledgerStats). Concurrent reads share one request.
let statsRead = null, statsFailed = false;
function readCodeStats() {
  statsRead ??= (async () => {
    const owner = client;
    // F09 review: the kept result is tagged with its core (activity.cjs keptCodeStats).
    const coreKey = statsCoreKey(resolveCore());
    let core = initial?.core;
    if (!core) {
      // Only initialize is needed to know the core, not the whole connect (model/list).
      try { await owner.start(); core = coreInfo(owner); }
      catch (error) { if (resolveCore().kind === "deepseek") throw error; }
    }
    if (core?.capabilities?.codeStats === true) {
      const stats = await owner.request("codeDesktop/stats/read", {});
      if (!statsShape(stats)) throw new Error("The usage stats could not be read.");
      if (JSON.stringify(stats) !== JSON.stringify(config.codeStats) || config.codeStatsCore !== coreKey) { config.codeStats = stats; config.codeStatsCore = coreKey; save(); }
      return stats;
    }
    if (!readableLedger(config.activity)) throw new Error("The usage ledger could not be read.");
    return ledgerStats(config.activity);
  })().then((stats) => { statsFailed = false; return stats; }, (error) => { statsFailed = true; throw error; })
    .finally(() => { statsRead = null; });
  return statsRead;
}
// The 'stats' push event: a turn that ends during a read is folded by the next one.
function pushCodeStats() {
  const pending = statsRead ? statsRead.catch(() => {}) : Promise.resolve();
  pending.then(readCodeStats).then((stats) => emit({ kind: "stats", stats }), () => {});
}
function save() {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath + ".tmp", JSON.stringify(config, null, 2));
  fs.renameSync(configPath + ".tmp", configPath);
}
// boot.core: initialize's engine report. A Codex app-server (and the UI
// fixtures) reports none, so everything keyed on the core defaults to Codex.
function coreInfo(owner) {
  const info = owner.serverInfo;
  return { engine: info?.engine ?? "codex", engineVersion: info?.engineVersion ?? null, capabilities: info?.capabilities ?? {}, configPath: info?.configPath ?? null };
}
// A (re)connected status carries boot.core for the renderer's connection handler.
function connectionEvent(owner, status) {
  return { kind: "connection", ...status, ...(status.connected ? { core: coreInfo(owner) } : {}) };
}
async function connect() {
  const owner = client;
  if (connecting?.owner === owner) return connecting.promise;
  const attempt = { owner, promise: null };
  attempt.promise = (async () => {
    // The API connection's env (and relay forwarder port) is in place before the core spawns.
    await modelSettings.ready?.();
    await owner.start();
    const [account, models] = await Promise.allSettled([
      accountOperations.refresh(owner),
      owner.request("model/list", { limit: 100 }),
    ]);
    if (owner !== client) throw new Error("DeepSeek connection changed. Reconnect to continue.");
    initial = {
      connected: true,
      core: coreInfo(owner),
      account: accountOperations.accountSnapshot(),
      models: models.status === "fulfilled" ? models.value.data : [],
      warnings: [account, models]
        .filter((x) => x.status === "rejected")
        .map((x) => x.reason.message),
    };
    return initial;
  })();
  connecting = attempt;
  try {
    return await attempt.promise;
  } finally {
    // A stopped client's rejection must not clear a replacement connection.
    if (connecting === attempt) connecting = null;
  }
}
function popoutForSender(sender) {
  for (const entry of popouts.values()) if (entry.window.webContents === sender) return entry;
  return null;
}
function validSender(e, action) {
  if (e.sender === win?.webContents && e.senderFrame === win.webContents.mainFrame) return "primary";
  const popout = popoutForSender(e.sender);
  if (popout && e.senderFrame === e.sender.mainFrame && POPOUT_ACTIONS.has(action)) return "popout";
  throw new Error("Untrusted renderer.");
}
function popoutList() {
  return [...popouts.values()].map((entry) => ({ sessionId: entry.sessionId, pane: entry.pane, alwaysOnTop: entry.alwaysOnTop === true }));
}
// Native context menu (_W, electron-context-menu-excerpt.js:1): built from the
// webContents "context-menu" params and popped up over the window. gW keeps
// one popup at a time, so a previous one is closed first. A hidden window has
// nothing on screen to anchor the menu, so it gets none.
let openContextMenu = null;
function contextMenuAction(item, contents, params) {
  const { action, value, ...rest } = item;
  if (!action) return rest;
  const click = {
    "replace": () => contents.replaceMisspelling(value),
    "learn-spelling": () => contents.session.addWordToSpellCheckerDictionary(value),
    "look-up": () => contents.showDefinitionForSelection(),
    // Eb: http(s) only, through the same opener as the renderer's external links.
    "open-link": () => { if (externalLink(value)) shell.openExternal(new URL(value).href).catch(() => {}); },
    "copy-text": () => clipboard.writeText(value),
    "copy-image": () => contents.copyImageAt(params.x, params.y),
    "inspect": () => {
      contents.inspectElement(params.x, params.y);
      if (contents.isDevToolsOpened()) contents.devToolsWebContents?.focus();
    },
  }[action];
  return { ...rest, click };
}
function attachContextMenu(window) {
  const contents = window.webContents;
  contents.on("context-menu", (_event, params) => {
    if (window.isDestroyed() || !window.isVisible()) return;
    const template = contextMenuTemplate(params, { allowDevTools: !app.isPackaged });
    if (!template.length) return;
    const menu = Menu.buildFromTemplate(template.map((item) => contextMenuAction(item, contents, params)));
    if (openContextMenu && !openContextMenu.window.isDestroyed()) openContextMenu.menu.closePopup(openContextMenu.window);
    openContextMenu = { menu, window };
    menu.popup({ window, x: params.x, y: params.y, callback: () => { if (openContextMenu?.menu === menu) openContextMenu = null; } });
  });
}
function broadcastPopouts() {
  emit({ kind: "popouts", popouts: popoutList() });
}
function popoutKey(sessionId, pane) {
  return `${sessionId}\u0000${pane}`;
}
// Create (or focus) the pane window. The pane leaves the primary layout only
// after this resolves; closing the window docks the pane back.
async function openPopout({ sessionId, pane, position }) {
  if (typeof sessionId !== "string" || ![...config.threadIds, ...config.archivedThreadIds].includes(sessionId)) throw new Error("Unknown session.");
  if (!POPOUT_KINDS.has(pane)) throw new Error("Unknown pane.");
  const key = popoutKey(sessionId, pane);
  const existing = popouts.get(key);
  if (existing && !existing.window.isDestroyed()) {
    existing.window.focus();
    return { existing: true, windowId: existing.window.id };
  }
  const cwd = config.threadMetadata[sessionId]?.cwd;
  if (typeof cwd !== "string" || !path.isAbsolute(cwd)) throw new Error("The session working directory is not available yet.");
  const wantsPosition = position && Number.isFinite(position.x) && Number.isFinite(position.y);
  const parentBounds = win && !win.isDestroyed() ? win.getBounds() : { x: 0, y: 0, ...DEFAULT_WINDOW_SIZE };
  const size = { width: 640, height: 640 };
  const window = new BrowserWindow({
    ...size,
    minWidth: 320,
    minHeight: 240,
    x: Math.round(wantsPosition ? position.x : parentBounds.x + (parentBounds.width - size.width) / 2),
    y: Math.round(wantsPosition ? position.y : parentBounds.y + (parentBounds.height - size.height) / 2),
    title: "Code Desktop",
    titleBarStyle: "hiddenInset",
    // A new pane window opens at the main window's zoom (CNr gives every
    // window the same level), so its lights start scaled.
    trafficLightPosition: scaleTrafficLights(POPOUT_TRAFFIC_LIGHTS, zoomFactorOf(win)),
    backgroundColor: windowBackground(nativeTheme.shouldUseDarkColors),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  const entry = { window, sessionId, pane, docked: false, alwaysOnTop: false };
  popouts.set(key, entry);
  watchZoom(window);
  attachContextMenu(window);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (e, url) => {
    if (url !== window.webContents.getURL()) e.preventDefault();
  });
  window.webContents.once("destroyed", () => void fileSearch.cancelAll());
  window.on("closed", () => {
    if (popouts.get(key) === entry) popouts.delete(key);
    emit({ kind: "popout-docked", sessionId, pane, entryPoint: entry.docked ? "dock" : "window-close" });
    broadcastPopouts();
  });
  const query = { popout: sessionId, pane, cwd };
  if (process.env.CODE_DESKTOP_DEV_URL) {
    const url = new URL(process.env.CODE_DESKTOP_DEV_URL);
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
    await window.loadURL(url.href);
  } else await window.loadFile(path.join(__dirname, "../dist/index.html"), { query });
  broadcastPopouts();
  return { existing: false, windowId: window.id, bounds: window.getBounds() };
}
function fileSearchScope(sender, pane = "main") {
  // "composer" is the @-mention lookup lane; it never supersedes a pane search.
  if (pane !== "main" && pane !== "artifacts" && pane !== "composer")
    throw new Error("Unknown file browser.");
  return `${sender.id}:files:${pane}`;
}
function fileSearchRoot(sessionId, homeWorkspace) {
  let cwd;
  if (sessionId == null) {
    if (homeWorkspace === undefined) cwd = config.cwd;
    else {
      const known = [config.cwd, ...approvedWorkspaceRoots,
        ...[...config.threadIds, ...config.archivedThreadIds]
          .map(id => config.threadMetadata[id]?.cwd)];
      cwd = known.find(value => typeof value === "string" && value === homeWorkspace);
      if (!cwd) throw new Error("Unknown home workspace. Choose a folder first.");
    }
  }
  else {
    if (typeof sessionId !== "string" ||
        ![...config.threadIds, ...config.archivedThreadIds].includes(sessionId))
      throw new Error("Unknown session.");
    cwd = config.threadMetadata[sessionId]?.cwd;
  }
  if (typeof cwd !== "string" || !path.isAbsolute(cwd))
    throw new Error("The session working directory is not available yet.");
  return cwd;
}
// Set once desktop:call is registered: only then can a (re)created main
// window's renderer initialise.
let desktopReady = false;
// OLi: the main window. Its frame comes from userData/window-state.json (Sbe
// over Dfn 1200x800, placed on the current displays), with the source's
// minWidth 600 / minHeight 400, titleBarStyle "hidden", trafficLightPosition
// uun() ({17,17} at 100%) and backgroundColor jP().
function createMainWindow() {
  const stateFile = path.join(app.getPath("userData"), WINDOW_STATE_FILE);
  const saved = loadWindowState(stateFile, screen);
  const window = new BrowserWindow({
    ...windowStateBounds(saved),
    minWidth: 600,
    minHeight: 400,
    title: "Code Desktop",
    titleBarStyle: "hidden",
    trafficLightPosition: trafficLightPosition(1),
    backgroundColor: windowBackground(nativeTheme.shouldUseDarkColors),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  win = window;
  mainHidden = false;
  // Sbe manage(): stored maximize / full screen first, then the save listeners.
  restoreWindowState(window, saved);
  trackWindowState(window, { file: stateFile, screen, state: saved });
  const fullScreenState = () => {
    emit({ kind: "window", fullScreen: window.isFullScreen() });
    installAppMenu();
  };
  window.on("enter-full-screen", fullScreenState);
  window.on("leave-full-screen", fullScreenState);
  window.on("show", () => { mainHidden = false; });
  // index.chunk-ChZ67Jhw.js m.on("close"): unless the app is quitting the
  // close is prevented and the window hides (leaving full screen first); the
  // app keeps running and the Dock, Window > Show Main Window and the tray's
  // Show App bring it back.
  window.on("close", (event) => {
    const action = closeAction({ quitting, fullScreen: window.isFullScreen() });
    if (action === "close") return;
    event.preventDefault();
    const hide = () => { if (window.isDestroyed()) return; mainHidden = true; window.hide(); };
    if (action === "leave-full-screen") { window.once("leave-full-screen", hide); window.setFullScreen(false); }
    else hide();
  });
  window.on("closed", () => { if (win === window) win = null; });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  watchZoom(window);
  attachContextMenu(window);
  window.webContents.on("render-process-gone", () => void fileSearch.cancelAll());
  window.webContents.once("destroyed", () => void fileSearch.cancelAll());
  window.webContents.on("will-navigate", (e, url) => {
    if (url !== window.webContents.getURL()) e.preventDefault();
  });
  return window;
}
function loadMainWindow(window) {
  if (process.env.CODE_DESKTOP_DEV_URL) return window.loadURL(process.env.CODE_DESKTOP_DEV_URL);
  return window.loadFile(path.join(__dirname, "../dist/index.html"));
}
// "activate" / KK with no main window left: a fresh one over the same session state.
async function openMainWindow() {
  const window = createMainWindow();
  installAppMenu();
  await loadMainWindow(window);
  return window;
}
app.whenReady().then(async () => {
  const preferences = await import("./preferences.mjs");
  const { settingsPatch, validateServiceTier, DEFAULT_THEME } = preferences;
  themePreference = preferences.themePreference;
  i18n = await import("./i18n/index.mjs");
  const { validateBypassRequest } = await import("./permission-policy.mjs");
  configPath = path.join(app.getPath("userData"), "preferences.json");
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    config = {};
  }
  const workspace = path.join(app.getPath("documents"), "Code Desktop");
  fs.mkdirSync(workspace, { recursive: true });
  config = {
    cwd: workspace,
    // shared-7 xh bi("userThemeMode","auto"): new profiles follow the system.
    theme: DEFAULT_THEME,
    model: "",
    effort: "medium",
    mode: "code",
    threadIds: [],
    archivedThreadIds: [],
    threadMetadata: {},
    // 2.2553.1 zk: the greeting only uses a preferred name the user set; no OS
    // user name is invented. Existing profiles keep whatever they saved.
    displayName: "",
    sidebarWidth: 288,
    // shared-2 Zm {collapsed:false, sidebarWidth:288}: collapsed persists with width.
    sidebarCollapsed: false,
    stats: {},
    activity: { startedAt: new Date().toISOString(), days: {} },
    sidebarPreferences: {},
    sessionMetadata: {},
    customGroups: [],
    pinnedOrder: [],
    // Fidelity F08: persisted Folder/Custom section order (sidebar-groups.js:19700-19728).
    projectOrder: [],
    rememberedActionCenterCounts: { sessions: 0, projects: 0, prs: 0 },
    worktreeBases: {},
    // Source settings default menuBarEnabled:true; profiles without it get the tray.
    menuBarEnabled: true,
    // Fidelity F14 (index.chunk-ChZ67Jhw.js preference defaults; c71860c77-yvGrrWO9.js:2270): unset notification
    // levels read as Banners and keep-awake (+ on battery) as on, so profiles without the keys show the effective value.
    permissionNotifications: "banner",
    questionNotifications: "banner",
    completeNotifications: "banner",
    keepAwake: true,
    keepAwakeOnBattery: true,
    ...config,
  };
  // Task complete offers only Off/Banners (c71860c77:2004-2029); an older saved 'badge' reads as Banners.
  if (config.completeNotifications === "badge") config.completeNotifications = "banner";
  if (!config.worktreeBases || typeof config.worktreeBases !== "object") config.worktreeBases = {};
  // index.chunk-ChZ67Jhw.js startup nativeTheme.themeSource = userThemeMode,
  // before any window exists: native menus, dialogs, the window background and
  // every renderer's prefers-color-scheme follow the app's choice.
  nativeTheme.themeSource = themePreference(config.theme);
  i18n.setLocale(config.locale);
  // jP / nativeTheme.on("updated"): every live window repaints its native
  // background with the resolved appearance (main and pane windows alike).
  nativeTheme.on("updated", () => {
    for (const window of BrowserWindow.getAllWindows())
      if (!window.isDestroyed()) window.setBackgroundColor(windowBackground(nativeTheme.shouldUseDarkColors));
  });
  if (!fs.existsSync(config.cwd)) config.cwd = workspace;
  approvedWorkspaceRoots.add(config.cwd);
  client = new CodexClient();
  client.on("event", receive);
  const firstClient = client;
  client.on("status", (s) => {
    if (!s.connected) initial = null;
    receive(connectionEvent(firstClient, s));
  });
  createMainWindow();
  desktopSettings = createDesktopSettings({app,powerSaveBlocker,powerMonitor,Notification,getConfig:()=>config,getClient:()=>client,sessionOperations,save,emit,getWindow:()=>win,gitStatus:workspaceGitStatus});
  desktopSettings.start();
  // Workflow agents run on the same core as sessions (the DeepSeek bridge by default).
  const workflowCore=workflowCoreCommand(resolveCore(),process.env.CODE_DESKTOP_WORKFLOW_BINARY);
  workflowService=createWorkflowService({root:path.join(app.getPath("userData"),"workflows"),getConfig:()=>config,emit,command:workflowCore.command,args:workflowCore.args,version:app.getVersion()});
  ipcMain.handle("desktop:call", async (e, action, p = {}) => {
    const senderKind = validSender(e, action);
    switch (action) {
      case "popout-open": return openPopout(p);
      case "popout-dock": {
        const entry = senderKind === "popout" ? popoutForSender(e.sender) : popouts.get(popoutKey(p.sessionId, p.pane));
        if (!entry) throw new Error("Unknown pane window.");
        entry.docked = true;
        entry.window.close();
        return true;
      }
      case "popout-sync": {
        const entry = popouts.get(popoutKey(p.sessionId, p.pane));
        if (entry && !entry.window.isDestroyed()) entry.window.webContents.send("desktop:event", { kind: "popout-data", pane: p.pane, data: p.data ?? null });
        return !!entry;
      }
      case "popout-list": return popoutList();
      case "popout-always-on-top": {
        // The popped-out header's pin (sidebar-support.js:9509-9547 eE/tE ->
        // setPopoutAlwaysOnTop): only a pane window toggles itself.
        const entry = senderKind === "popout" ? popoutForSender(e.sender) : null;
        if (!entry || entry.window.isDestroyed()) throw new Error("Unknown pane window.");
        entry.alwaysOnTop = p.value === true;
        entry.window.setAlwaysOnTop(entry.alwaysOnTop);
        broadcastPopouts();
        return entry.alwaysOnTop;
      }
      case "init": {
        try {
          const owner = client;
          const status = initial || (await connect());
          if (owner !== client) throw new Error("DeepSeek connection changed. Reconnect to continue.");
          return {
            ...status,
            account: accountOperations.accountSnapshot(),
            config,
            fullScreen: win.isFullScreen(),
            zoomFactor: zoomFactorOf(win),
            approvalSnapshot: owner.approvalSnapshot(),
            sessionOperations: sessionOperations.snapshot(),
            auth: accountOperations.snapshot(),
          };
        } catch (error) {
          return {
            connected: false,
            error: error.message,
            config,
            models: [],
          };
        }
      }
      case "reconnect": {
        receive({ kind: "connection", connected: false });
        client.invalidateApprovals("manual_reconnect");
        client.removeAllListeners();
        client.stop();
        client = new CodexClient();
        client.on("event", receive);
        const owner = client;
        client.on("status", (s) => {
          if (!s.connected) initial = null;
          receive(connectionEvent(owner, s));
        });
        initial = null;
        const status = await connect();
        if (owner !== client) throw new Error("DeepSeek connection changed. Reconnect to continue.");
        return { ...status, config, approvalSnapshot: owner.approvalSnapshot() };
      }
      case "interrupt": return interruptTurn(client, p);
      case "steer": {
        // turn/steer against the live connection. The renderer needs to tell a
        // non-steerable active turn (review/compact: activeTurnNotSteerable) from
        // any other failure so it can fall back to thread/queue/add; IPC only
        // carries messages, so the outcome is returned structurally.
        if (typeof p.threadId !== "string" || !p.threadId || typeof p.expectedTurnId !== "string" || !p.expectedTurnId || !Array.isArray(p.input))
          throw new Error("The steer target is unavailable.");
        await client.start();
        try {
          const result = await client.request("turn/steer", { threadId: p.threadId, expectedTurnId: p.expectedTurnId, input: p.input,
            ...(typeof p.clientUserMessageId === "string" ? { clientUserMessageId: p.clientUserMessageId } : {}) });
          return { ok: true, result };
        } catch (error) {
          return { ok: false, message: error.message, data: error.data ?? null, code: error.code ?? null };
        }
      }
      case "session-action": return sessionOperations.run(p);
      case "customize": return customizeOperations.run(p);
      case "rpc": {
        if (deprecated.has(p.method)) throw new Error(deprecated.get(p.method));
        if (!allowed.has(p.method) || deprecated.has(p.method)) throw new Error("Unsupported operation.");
        await client.start();
        const params = { ...(p.params || {}) };
        if (["thread/start","thread/resume","turn/start"].includes(p.method) && Object.hasOwn(params,"serviceTier")) {
          params.serviceTier = validateServiceTier(initial?.models || [], params.model || config.model, params.serviceTier);
        }
        if (["thread/start", "thread/resume", "turn/start", "codeDesktop/thread/permissions"].includes(p.method)) {
          const owner = client;
          await validateBypassRequest(params, () => config, () => owner.request("configRequirements/read", {}));
          if (owner !== client) throw new Error("The DeepSeek connection changed. Try again.");
        }
        // The DeepSeek bridge shows the model its `workflow` tool only while Dynamic workflows is on
        // (harness structured.js workflowsAllowedBy); the setting lives here, so it is stamped here.
        if (["thread/start", "thread/resume", "turn/start", "codeDesktop/thread/permissions"].includes(p.method) && params.codeDesktop && typeof params.codeDesktop === "object") {
          params.codeDesktop = { ...params.codeDesktop, dynamicWorkflows: config.dynamicWorkflows === true };
        }
        if (p.method === "codeDesktop/workflow/stop" && (typeof params.threadId !== "string" || !config.threadIds.includes(params.threadId))) throw new Error("Unknown session.");
        if (p.method === "codeDesktop/sideQuestion" && (typeof params.threadId !== "string" || ![...config.threadIds, ...config.archivedThreadIds].includes(params.threadId))) throw new Error("Unknown session.");
        modelSettings.decorate(p.method, params);
        if (p.method === "turn/start") {
          config.stats[params.threadId] ??= { messages: 0, ids: [] };
          config.stats[params.threadId].model = params.model;
        }
        instructionsService.decorate(p.method, params);
        if (p.method === "thread/start" || p.method === "thread/resume") {
          params.approvalsReviewer = "user";
          params.approvalPolicy = params.approvalPolicy || "on-request";
        }
        if (p.method === "thread/archive") sessionOperations.assertAvailable(params.threadId);
        if (p.method === "thread/delete") {
          if (typeof params.threadId !== "string" || ![...config.threadIds, ...config.archivedThreadIds].includes(params.threadId)) throw new Error("Unknown session.");
          sessionOperations.assertAvailable(params.threadId);
        }
        const release = p.method === "turn/start" ? sessionOperations.reserveMessage(params.threadId) : null;
        let result;
        try { result = await client.request(p.method, params); }
        catch (error) {
          // ipcRenderer.invoke keeps only the message of a thrown error, so a
          // JSON-RPC error from the core (numeric code) is returned whole and
          // rethrown by rpcResult (src/rpc-error.mjs) with its code and data
          // (CodexErrorInfo such as activeTurnNotSteerable).
          if (typeof error?.code === "number")
            return { __codeDesktopRpcError: { message: error.message, code: error.code, data: error.data ?? null } };
          throw error;
        }
        finally { release?.(); }
        if (p.method === "thread/start") {
          config.threadIds = [
            ...new Set([result.thread.id, ...config.threadIds]),
          ];
          config.stats[result.thread.id] = { messages: 0, tokens: 0, observedTokens: 0, observedUsage: { input: 0, output: 0, cached: 0, cacheWrite: 0 }, ids: [] };
          save();
        }
        if (result.thread && (config.threadIds.includes(result.thread.id) || config.archivedThreadIds.includes(result.thread.id))) {
          const { turns, ...metadata } = result.thread;
          config.threadMetadata[result.thread.id] = metadata;
          if (typeof metadata.cwd === "string") observedThreadCwds.add(metadata.cwd);
          // A session started inside a prepared worktree remembers its creation base.
          const base = p.method === "thread/start" && typeof metadata.cwd === "string" ? config.worktreeBases[metadata.cwd] : undefined;
          if (base && !config.sessionMetadata[result.thread.id]?.baseBranch)
            config.sessionMetadata[result.thread.id] = { ...config.sessionMetadata[result.thread.id], baseBranch: base };
          save();
        }
        if (p.method === "thread/list" && Array.isArray(result?.data))
          for (const thread of result.data) if (typeof thread?.cwd === "string") observedThreadCwds.add(thread.cwd);
        if (p.method === "thread/name/set" && config.threadMetadata[params.threadId]) {
          config.threadMetadata[params.threadId].name = params.name;
          save();
        }
        if (p.method === "thread/archive") {
          config.threadIds = config.threadIds.filter((id) => id !== params.threadId);
          config.archivedThreadIds = [...new Set([params.threadId, ...config.archivedThreadIds])];
          save();
        }
        if (p.method === "thread/unarchive") {
          config.archivedThreadIds = config.archivedThreadIds.filter((id) => id !== params.threadId);
          config.threadIds = [...new Set([params.threadId, ...config.threadIds])];
          // A restore restarts the inactivity window; otherwise the next sweep
          // re-archives a long-idle session the user just brought back.
          config.restoredAt = { ...config.restoredAt, [params.threadId]: Date.now() };
          save();
        }
        if (p.method === "thread/delete") {
          const id = params.threadId;
          config.threadIds = config.threadIds.filter((known) => known !== id);
          config.archivedThreadIds = config.archivedThreadIds.filter((known) => known !== id);
          delete config.threadMetadata[id];
          delete config.sessionMetadata[id];
          if (config.stats) delete config.stats[id];
          if (config.restoredAt) delete config.restoredAt[id];
          config.pinnedOrder = (config.pinnedOrder || []).filter((known) => known !== id);
          config.sidebarRevision = (config.sidebarRevision || 0) + 1;
          save();
        }
        return result;
      }
      case "respond": {
        // Capture and validate one live owner synchronously through the wire write.
        return respondToApproval(client, p);
      }
      case "settings": {
        if (p.allowBypassPermissions === true) {
          await client.start();
          await validateBypassRequest({sandbox:"danger-full-access"}, {allowBypassPermissions:true}, () => client.request("configRequirements/read", {}));
        }
        const previous = config;
        config = {...settingsPatch(config, p, initial?.models || []),...desktopPatch(p)};
        if (config.locale !== previous.locale) { i18n.setLocale(config.locale); installAppMenu(); }
        if(typeof p.dynamicWorkflows === "boolean")config.dynamicWorkflows=p.dynamicWorkflows;
        // shared-2-C6aD8DvJ.js Km {MIN:200, MAX:420} / qm (src/sidebar-width-model.mjs).
        if (typeof p.sidebarWidth === "number" && Number.isFinite(p.sidebarWidth))
          config.sidebarWidth = Math.max(200, Math.min(420, p.sidebarWidth));
        Object.assign(config, sidebarCollapsedPatch(p));
        if (p.sidebarPreferences && typeof p.sidebarPreferences === "object")
          config.sidebarPreferences = p.sidebarPreferences;
        if (p.sessionMetadata && typeof p.sessionMetadata === "object")
          config.sessionMetadata = p.sessionMetadata;
        if (Array.isArray(p.customGroups)) config.customGroups = p.customGroups;
        if (p.rememberedActionCenterCounts && typeof p.rememberedActionCenterCounts === "object") {
          // Placeholder shape for the next launch (official Kk/$i remembered counts).
          // Projects/PRs have no local source and stay zero.
          const sessions = Number(p.rememberedActionCenterCounts.sessions);
          config.rememberedActionCenterCounts = { sessions: Number.isInteger(sessions) && sessions >= 0 ? Math.min(sessions, 999) : 0, projects: 0, prs: 0 };
        }
        try { save(); } catch (error) { config = previous; throw error; }
        // xh setThemeMode → setThemeMode(e){nativeTheme.themeSource=e}.
        if ("theme" in p) nativeTheme.themeSource = themePreference(config.theme);
        desktopSettings.power();
        menuBar?.update();
        if (typeof p.sidebarCollapsed === "boolean") installAppMenu();
        return config;
      }
      case "navigation-state": return setNavigationState(p);
      case "menu-state": return setMenuState(p);
      case "repo-identities": {
        // Fidelity F08 Folder grouping (sidebar-session.js:20892-20903 IJ): cwd -> {isRepo, toplevel, owner,
        // name, parent} for the folders the sidebar shows, resolved read-only and cached per cwd
        // (git-status.cjs repoIdentity). The renderer keys on the cwd until an entry arrives.
        const cwds = Array.isArray(p.cwds) ? [...new Set(p.cwds.filter(cwd => typeof cwd === "string" && path.isAbsolute(cwd)))].slice(0, 200) : [];
        const { repoIdentity } = require("./git-status.cjs");
        const identities = await Promise.all(cwds.map(cwd => repoIdentity(cwd, { home: os.homedir() })));
        return Object.fromEntries(cwds.map((cwd, index) => [cwd, identities[index]]));
      }
      case "sidebar-state": {
        if (p.operation === "metadata") {
          if (![...config.threadIds, ...config.archivedThreadIds].includes(p.id)) throw new Error("Unknown session.");
          const previous = config.sessionMetadata[p.id] || {};
          const patch = {};
          for (const key of ["pinned", "unread"]) if (typeof p.patch?.[key] === "boolean") patch[key] = p.patch[key];
          if (p.patch?.customGroupId === null || config.customGroups.some(group => group.id === p.patch?.customGroupId)) patch.customGroupId = p.patch.customGroupId;
          if (Array.isArray(p.patch?.additionalFolders)) patch.additionalFolders = [...new Set(p.patch.additionalFolders.filter(dir => typeof dir === "string" && path.isAbsolute(dir) && fs.existsSync(dir)))];
          config.sessionMetadata[p.id] = { ...previous, ...patch };
        } else if (p.operation === "create-group") {
          if (typeof p.name !== "string" || !p.name.trim()) throw new Error("Enter a group name.");
          const id = require("node:crypto").randomUUID();
          config.customGroups.push({ id, name: p.name.trim() });
          config.sidebarPreferences = { ...config.sidebarPreferences, groupBy: "custom" };
          const known = new Set([...config.threadIds, ...config.archivedThreadIds]);
          const assign = [...new Set([p.sessionId, ...(Array.isArray(p.sessionIds) ? p.sessionIds : [])])].filter(sessionId => typeof sessionId === "string" && known.has(sessionId));
          for (const sessionId of assign) config.sessionMetadata[sessionId] = { ...config.sessionMetadata[sessionId], customGroupId: id };
        } else if (p.operation === "rename-group") {
          if (typeof p.name !== "string" || !p.name.trim()) throw new Error("Enter a group name.");
          config.customGroups = config.customGroups.map(group => group.id === p.id ? { ...group, name: p.name.trim() } : group);
        } else if (p.operation === "delete-group") {
          config.customGroups = config.customGroups.filter(group => group.id !== p.id);
          for (const meta of Object.values(config.sessionMetadata)) if (meta.customGroupId === p.id) meta.customGroupId = null;
          if (Array.isArray(config.projectOrder)) config.projectOrder = config.projectOrder.filter(key => key !== "ccg::" + p.id);
        } else if (p.operation === "pinned-order") {
          // Manual Pinned order (official Move up / Move down): only known ids, no duplicates.
          const known = new Set([...config.threadIds, ...config.archivedThreadIds]);
          if (!Array.isArray(p.ids) || p.ids.some(id => typeof id !== "string" || !known.has(id)) || new Set(p.ids).size !== p.ids.length) throw new Error("Invalid pinned order.");
          config.pinnedOrder = [...p.ids];
        } else if (p.operation === "project-order") {
          // Folder/Custom section order (sidebar-groups.js:19700-19728 menu_up / menu_down / reset): project
          // keys (owner/name or a folder path) and "ccg::<group id>" custom keys; [] restores the default.
          if (!Array.isArray(p.ids) || p.ids.length > 1000 || p.ids.some(id => typeof id !== "string" || !id || id.length > 4096) || new Set(p.ids).size !== p.ids.length) throw new Error("Invalid project order.");
          config.projectOrder = [...p.ids];
        } else throw new Error("Unsupported sidebar operation.");
        config.sidebarRevision = (config.sidebarRevision || 0) + 1;
        save();
        return sidebarSnapshot();
      }
      case "home-shape":
        // Read before Codex connects (official Ti/Kk local store + preferred name):
        // the greeting and the loading placeholder never wait for the catalog.
        return { rememberedActionCenterCounts: config.rememberedActionCenterCounts || { sessions: 0, projects: 0, prs: 0 }, displayName: config.displayName || "" };
      case "stats": {
        // The original stats object (readCodeStats). A failed read without a kept result is
        // an actual failure (official $O: query error without cached data → no card). The
        // last core result paints at once; the fresh fold follows as a 'stats' event.
        // F09 review: only the result of this same core (a CODEX_BINARY Codex never paints a DeepSeek fold).
        const kept = keptCodeStats(config, statsCoreKey(resolveCore()), initial?.core);
        if (!kept) return readCodeStats();
        pushCodeStats();
        return kept;
      }
      case "session-ack": {
        // Action Center dismiss (official onDismissAwaiting = ack(id, timestamp)
        // + markRead(id)): the row stays hidden until the session's timestamp
        // moves past the acknowledgement, and the session is no longer unread.
        if (![...config.threadIds, ...config.archivedThreadIds].includes(p.id)) throw new Error("Unknown session.");
        if (!Number.isFinite(p.ackedAt) || p.ackedAt < 0) throw new Error("Invalid acknowledgement time.");
        config.sessionMetadata[p.id] = { ...config.sessionMetadata[p.id], ackedAt: Math.floor(p.ackedAt), unread: false };
        config.sidebarRevision = (config.sidebarRevision || 0) + 1;
        save();
        return sidebarSnapshot();
      }
      case "workspace-git-status": {
        const cwd = workspaceQueryRoot(p.cwd);
        return workspaceGitStatus(cwd, { preferredBase: sessionBaseBranch(p.sessionId, cwd) });
      }
      case "workspace-git-comparison": {
        const cwd = workspaceQueryRoot(p.cwd);
        return workspaceGitComparison(cwd, { preferredBase: sessionBaseBranch(p.sessionId, cwd) });
      }
      // F12 diff scope (panes-tile-current.js zm): 'branch' (default, merge-base of the session base), 'uncommitted'
      // or 'commit:<sha>'; `base` is the Changes "Compare against" branch (validated in git-status.cjs).
      case "workspace-git-diff": {
        const cwd = workspaceQueryRoot(p.cwd);
        const scope = p.scope === undefined ? "branch" : p.scope;
        if (typeof scope !== "string" || !/^(branch|uncommitted|commit:[0-9a-fA-F]{7,64})$/.test(scope)) throw new Error("Invalid diff scope.");
        return workspaceGitDiff(cwd, { completeContext: p.completeContext === true, scope,
          base: typeof p.base === "string" ? p.base : undefined, preferredBase: sessionBaseBranch(p.sessionId, cwd) });
      }
      case "workspace-git-commits": {
        const cwd = workspaceQueryRoot(p.cwd);
        return workspaceGitCommits(cwd, { base: typeof p.base === "string" ? p.base : undefined, preferredBase: sessionBaseBranch(p.sessionId, cwd) });
      }
      case "workspace-git-branches": return workspaceGitBranches(workspaceQueryRoot(p.cwd));
      case "workspace-info": {
        const cwd = p.cwd || config.cwd;
        try {
          const [branch, branches, originHead] = await Promise.all([
            run("git", ["-C", cwd, "branch", "--show-current"]),
            run("git", ["-C", cwd, "branch", "--format=%(refname:short)"]),
            // The branch picker pins the repo default first (cc43287c9 :12062-12071); origin/HEAD names it.
            run("git", ["-C", cwd, "symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]).catch(() => ({ stdout: "" })),
          ]);
          return {
            isRepo: true,
            branch: branch.stdout.trim(),
            branches: branches.stdout.trim().split("\n").filter(Boolean),
            originHead: originHead.stdout.trim(),
          };
        } catch {
          return { isRepo: false, branch: "", branches: [] };
        }
      }
      // Branch step 2 without a worktree (cc43287c9-BMbiZYzF.js:12084-12095 me, :15860-15912 UR; asar
      // index.chunk-Mak6MV2t.js GitStatusService isWorkingTreeDirty / stashWorkingTree / commitWipForBranchSwitch /
      // discardWorkingTree, index.chunk-l0PS_wmg.js 'switch' at spawn). execFile git only, in a known folder.
      case "branch-switch-check": {
        const cwd = workspaceQueryRoot(p.cwd);
        const [status, branch, numstat] = await Promise.all([
          run("git", ["-C", cwd, "status", "--porcelain", "-z"]),
          run("git", ["-C", cwd, "branch", "--show-current"]),
          run("git", ["-C", cwd, "diff", "HEAD", "--numstat"]).catch(() => ({ stdout: "" })),
        ]);
        const entries = porcelainEntries(status.stdout), files = entries.length;
        let additions = 0, deletions = 0;
        for (const line of numstat.stdout.split("\n")) {
          const [added, deleted] = line.split("\t");
          if (/^\d+$/.test(added)) additions += Number(added);
          if (/^\d+$/.test(deleted)) deletions += Number(deleted);
        }
        // wouldBranchSwitchConflict: `dirty` is set only when the changes block the switch to p.target (unmerged, or
        // a dirty path the target changes); a non-conflicting dirty tree is carried over by 'git switch'.
        const git = (args) => run("git", ["-C", cwd, ...args], { timeout: 30000, maxBuffer: 16 * 1024 * 1024 }).then((result) => result.stdout);
        const dirty = await wouldBranchSwitchConflict(entries, p.target, git);
        return { dirty, branch: branch.stdout.trim(), files, additions, deletions };
      }
      case "branch-switch-resolve": {
        const cwd = workspaceQueryRoot(p.cwd);
        const from = typeof p.currentBranch === "string" ? p.currentBranch : "";
        const output = (error) => `${error?.stdout || ""}\n${error?.stderr || ""}\n${error?.message || ""}`;
        if (p.mode === "stash") {
          // UR passes `epitaxy: pre-switch from ${n}`; stashWorkingTree runs 'stash push -u -m' and treats
          // "No local changes to save" as success.
          try { await run("git", ["-C", cwd, "stash", "push", "-u", "-m", `epitaxy: pre-switch from ${from}`]); }
          catch (error) { if (!/no local changes to save/i.test(output(error))) return { success: false, error: output(error).trim() }; }
        } else if (p.mode === "commit") {
          // commitWipForBranchSwitch → commitAllChanges(cwd, `WIP: epitaxy pre-switch from ${t}`, {skipHooks:true}).
          try { await run("git", ["-C", cwd, "add", "-A"]); }
          catch { return { success: false, error: "Could not stage changes for commit." }; }
          try { await run("git", ["-C", cwd, "commit", "-m", `WIP: epitaxy pre-switch from ${from}`, "--no-verify"]); }
          catch (error) { if (!/nothing (added )?to commit/.test(output(error))) return { success: false, error: output(error).trim() }; }
        } else if (p.mode === "discard") {
          // discardWorkingTree: 'reset --hard', then 'clean -fd -- :/' (a failed clean still counts as success).
          try { await run("git", ["-C", cwd, "reset", "--hard"]); }
          catch (error) { return { success: false, error: output(error).trim() }; }
          await run("git", ["-C", cwd, "clean", "-fd", "--", ":/"]).catch(() => {});
        } else throw new Error("Invalid mode.");
        return { success: true };
      }
      case "branch-checkout": {
        const cwd = workspaceQueryRoot(p.cwd);
        if (typeof p.branch !== "string" || !p.branch || p.branch.startsWith("-")) throw new Error("Invalid branch.");
        await run("git", ["-C", cwd, "switch", p.branch]);
        return { branch: p.branch };
      }
      case "prepare-worktree": {
        const cwd = fs.realpathSync(p.cwd || config.cwd);
        if (typeof p.branch !== "string" || p.branch.startsWith("-"))
          throw new Error("Invalid branch.");
        const name = "codex/" + Date.now().toString(36);
        const base = config.worktreeLocation === "custom" ? config.worktreeDirectory : path.join(cwd,".code","worktrees");
        if(!base)throw new Error("Choose a custom worktree directory first.");
        const dest = path.join(base,path.basename(cwd)+"-"+Date.now().toString(36));
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        await run("git", [
          "-C",
          cwd,
          "worktree",
          "add",
          "-b",
          name,
          dest,
          p.branch || "HEAD",
        ]);
        approvedWorkspaceRoots.add(dest);
        config.worktreeDirectories=[...new Set([...(config.worktreeDirectories||[]),dest])];save();
        // Persist the real creation base so the session's comparison never
        // silently falls back to the inferred default branch.
        if (p.branch) { config.worktreeBases[dest] = p.branch; save(); }
        return dest;
      }
      case "workflow-list": return workflowService.list(p.threadId);
      case "workflow-pick": { const picked=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:i18n.t('Workflow JavaScript'),extensions:['js','mjs','cjs']}]});return picked.canceled?null:picked.filePaths[0]; }
      case "workflow-start": {
        if(!p.plan&&!initial?.models?.some(model=>(model.id===p.model||model.model===p.model)))throw Error('Choose an available DeepSeek model.');
        if(p.effort&&!initial?.models?.find(model=>(model.id===p.model||model.model===p.model))?.supportedReasoningEfforts?.some(e=>e.reasoningEffort===p.effort))throw Error('Choose an available reasoning effort.');
        // Agents take the session Mode's access (permission-policy.mjs workflowAccess), derived here, never sent.
        const { workflowAccess, validateBypassRequest } = await import("./permission-policy.mjs");
        const access = workflowAccess({ permission: p.permission, mode: p.mode });
        if (access === "danger-full-access" && !p.plan) {
          const owner = client;
          await validateBypassRequest({ sandbox: "danger-full-access" }, () => config, () => owner.request("configRequirements/read", {}));
          if (owner !== client) throw new Error("The DeepSeek connection changed. Try again.");
        }
        const { permission, mode, ...options } = p;
        return workflowService.start({...options,access,cwd:workspaceQueryRoot(p.cwd)});
      }
      case "workflow-stop": return workflowService.stop(p.id);
      case "background-read": return backgroundOperations.read(p);
      case "background-terminate": return backgroundOperations.terminate(p);
      case "desktop-settings-read": {
        const owner=client;await owner.start();const connection=owner.connection;
        const requests=[['policy','config/read',{includeLayers:false,cwd:config.cwd}],['requirements','configRequirements/read',{}]];
        const result={desktop:desktopSettings.snapshot(),errors:{}};
        await Promise.all(requests.map(async([key,method,params])=>{try{const value=await owner.request(method,params);if(key==='policy')result.mcpDefinitions=mcpDefinitions(value.config);result[key]=key==='policy'?{config:{sandbox_mode:value.config?.sandbox_mode,approval_policy:value.config?.approval_policy},origins:Object.fromEntries(Object.entries(value.origins||{}).filter(([name])=>['sandbox_mode','approval_policy'].includes(name)))}:value;}catch(error){recordSettingsFailure(result,key,error);}}));
        try{let cursor;const servers=[],seen=new Set();do{const page=await owner.request('mcpServerStatus/list',{limit:100,...(config.threadIds.includes(p.threadId)?{threadId:p.threadId}:{}),...(cursor?{cursor}:{})});servers.push(...(page.data||[]));cursor=page.nextCursor;if(cursor&&seen.has(cursor))throw Error('MCP pagination did not advance.');if(cursor)seen.add(cursor);}while(cursor&&servers.length<1000&&seen.size<100);result.servers=servers;result.serversTruncated=!!cursor;}catch(error){recordSettingsFailure(result,'servers',error);}
        if(owner!==client||owner.connection!==connection||connection?.closed)throw Error('DeepSeek connection changed. Reconnect to continue.');return result;
      }
      case "instructions": return instructionsService.run(p);
      case "desktop-startup": return desktopSettings.setStartup(p.enabled);
      case "persona": return personaImage.run(p);
      case "desktop-worktree-folder": {
        const result=await dialog.showOpenDialog(win,{properties:['openDirectory','createDirectory']});if(result.canceled)return null;
        const directory=await fs.promises.realpath(result.filePaths[0]);config={...config,worktreeLocation:'custom',worktreeDirectory:directory};save();return config;
      }
      case "custom-commands": return customCommands.run(p);
      case "desktop-storage": {
        // Fidelity F14: the original's Code sessions and worktrees / Runtime / App caches and logs areas
        // (index.chunk-ChZ67Jhw.js pfi/hfi; logs = app logs + crash dumps).
        const core=resolveCore(),info=client.serverInfo,logs=[];
        for(const name of ['logs','crashDumps'])try{logs.push(app.getPath(name));}catch{}
        const coreName=info?(info.engine==='deepseek-harness'?'DeepSeek Harness':'Codex'):(core.kind==='deepseek'?'DeepSeek Harness':'Codex');
        return storageReport({userData:app.getPath('userData'),logs,dshHome:info?.codexHome,coreRoot:storageCoreRoot(core),coreName,
          threadIds:[...config.threadIds,...config.archivedThreadIds],worktreeDirs:config.worktreeDirectories||[]});
      }
      case "theme-file": return themeFiles.run(p);
      case "desktop-edit-config": {
        const error=await shell.openPath(editConfigTarget(client.serverInfo));if(error)throw Error(error);return true;
      }
      case "harness-profile": return harnessProfile.run(p);
      case "reveal-settings": {
        const error = await shell.openPath(app.getPath("userData"));
        if (error) throw new Error(error);
        return true;
      }
      case "model-settings": return modelSettings.run(p);
      case "reveal-folder":
        await shell.openPath(p.cwd || config.cwd);
        return true;
      case "reveal-tool-file": {
        // c856385e2:1181–1315 Finder action. Resolve symlinks and scope to
        // server-known session cwd; the renderer cannot authorize a root.
        const root = fileSearchRoot(p.sessionId);
        if (typeof p.path !== "string" || !p.path || p.path.includes("\0")) throw new Error("Invalid file path.");
        const target = await scopedPath(root, p.path);
        shell.showItemInFolder(target);
        return true;
      }
      case "reveal-item": {
        // Settings › Skills "Show in Finder": reveal a file (SKILL.md) instead of
        // opening it. Only absolute, existing paths reported by skills/list.
        const target = p.path;
        if (typeof target !== "string" || !path.isAbsolute(target) || target.includes("\0") || !customizeOperations.knownSkillPaths.has(target)) throw new Error("Unknown skill path.");
        if (!fs.existsSync(target)) throw new Error("The skill file no longer exists.");
        shell.showItemInFolder(target);
        return true;
      }
      case "open-terminal": {
        // Official "Open in → Terminal" (c80a67939 Open in submenu). The folder
        // must be an absolute existing directory; nothing else is passed to open.
        const cwd = typeof p.cwd === "string" && p.cwd ? p.cwd : config.cwd;
        if (!path.isAbsolute(cwd) || cwd.includes("\0")) throw new Error("Unknown workspace directory.");
        let stat;
        try { stat = await fs.promises.stat(cwd); } catch { throw new Error("The session folder no longer exists."); }
        if (!stat.isDirectory()) throw new Error("The session folder no longer exists.");
        await externalOpeners.terminal(cwd);
        return true;
      }
      case "slash-export": {
        if (!config.threadIds.includes(p.threadId) || typeof p.markdown !== "string") throw new Error("Unknown session export.");
        const chosen = await dialog.showSaveDialog(win, { title: i18n.t("Export conversation"), defaultPath: "conversation.md", filters: [{name:"Markdown",extensions:["md"]}] });
        if (chosen.canceled || !chosen.filePath) return null;
        await fs.promises.writeFile(chosen.filePath, p.markdown, "utf8");
        return chosen.filePath;
      }
      case "slash-rewind": {
        const owner=client, connection=owner?.connection;
        const matches=()=>owner===client && connection && !connection.closed && connection.approvalConnectionId===p.expected?.connectionId && connection.approvalConnectionEpoch===p.expected?.connectionEpoch;
        if(!matches() || !config.threadIds.includes(p.threadId) || typeof p.beforeTurnId!=="string" || !p.beforeTurnId) throw new Error("This session changed. Reopen it before rewinding.");
        const release=sessionOperations.reserveMessage(p.threadId);
        try {
          const response=await owner.request("thread/read",{threadId:p.threadId,includeTurns:false});
          if(response.thread?.historyMode!=="paginated") throw new Error("Rewind is not available for legacy sessions.");
          if(!matches())throw new Error("Connection changed before rewind.");
          return await owner.request("thread/revert",{threadId:p.threadId,beforeTurnId:p.beforeTurnId});
        } finally {release();}
      }
      case "folder": {
        if(p.additional && typeof p.path === "string") {
          const expanded=p.path.startsWith("~/")?path.join(os.homedir(),p.path.slice(2)):p.path;
          const absolute=path.resolve(workspaceQueryRoot(p.cwd),expanded);
          const real=await fs.promises.realpath(absolute);
          if(!(await fs.promises.stat(real)).isDirectory())throw new Error("Choose a directory.");
          approvedWorkspaceRoots.add(real);
          return real;
        }
        // cc43287c9-BMbiZYzF.js:21955-21962 / :21983-21990 (ta(title)): 'Select folder for local session' for
        // the session folder, 'Add folder to session' for an additional one; macOS shows the message line.
        const title = p.additional ? i18n.t("Add folder to session") : i18n.t("Select folder for local session");
        const r = await dialog.showOpenDialog(win, {
          title,
          message: title,
          properties: ["openDirectory"],
          defaultPath: config.cwd,
        });
        if (r.canceled) return null;
        if (p.additional) { approvedWorkspaceRoots.add(r.filePaths[0]); return r.filePaths[0]; }
        await fileSearch.cancelAll();
        config.cwd = r.filePaths[0];
        approvedWorkspaceRoots.add(config.cwd);
        save();
        return config.cwd;
      }
      case "dismiss-recent-folder": {
        // lH 'Remove from recent' (cc43287c9 :21652, :21921-21928 → c749529a1 dismiss): one dismissedAt (ms) per
        // path; the Recent list hides the folder until a session is created there afterwards.
        if (typeof p.path !== "string" || !p.path) throw new Error("Invalid folder.");
        const previous = config.dismissedRecentFolders;
        config.dismissedRecentFolders = { ...(previous && typeof previous === "object" ? previous : {}), [p.path]: Date.now() };
        try { save(); } catch (error) { config.dismissedRecentFolders = previous; throw error; }
        return config.dismissedRecentFolders;
      }
      case "attachments": {
        const r = await dialog.showOpenDialog(win, {
          properties: ["openFile", "multiSelections"],
        });
        return r.canceled ? [] : inspectAttachments(r.filePaths);
      }
      case "attachments:inspect": return inspectAttachments(p.paths);
      case "attachments:stage": return stageAttachment(p);
      case "files":
        return listFiles(p.cwd || config.cwd, p.relative || "", {
          includeChild: p.includeChild,
        });
      case "files:search":
        return fileSearch.search({
          scope: fileSearchScope(e.sender, p.pane),
          requestId: p.requestId,
          root: fileSearchRoot(p.sessionId, p.homeWorkspace),
          query: p.query,
        });
      case "files:search:cancel": {
        if (typeof p.requestId !== "string" || !p.requestId || p.requestId.length > 128)
          throw new Error("Invalid search request identifier.");
        return fileSearch.cancel(fileSearchScope(e.sender, p.pane), p.requestId);
      }
      case "file":
        // Files pane viewer: classified results (files.cjs); force re-reads a binary file as text.
        return readFile(p.cwd || config.cwd, p.relative, { force: p.force === true });
      case 'image:read': return imageOperations.read(p);
      case 'image:copy': return imageOperations.copy(p);
      case 'image:save': return imageOperations.save(p);
      case "external": {
        const url = new URL(p.url);
        if (!["https:", "http:"].includes(url.protocol))
          throw new Error("Unsupported URL.");
        await shell.openExternal(url.href);
        return true;
      }
      case "login": return accountOperations.start(p.type || 'chatgpt');
      case "account-auth": return accountOperations.run(p);
      default:
        throw new Error("Unknown operation.");
    }
  });
  installAppMenu();
  desktopReady = true;
  await loadMainWindow(win);
  menuBar = createMenuBar({Tray,Menu,nativeImage,app,iconPath:path.join(__dirname,"assets/TrayIconTemplate.png"),menuModel:await import("./tray-menu.mjs"),
    getWindow:()=>win,getEnabled:()=>config.menuBarEnabled!==false,getAccount:()=>accountOperations.accountSnapshot(),getClient:()=>client});
  menuBar.update();
});
// Registered before installShutdownHandler: the first before-quit marks the
// quit even though the shutdown handler defers it, so the deferred quit's
// window close is let through.
app.on("before-quit", () => { quitting = true; });
installShutdownHandler(app, {
  stop: async () => {
    customCommands.dispose();
    desktopSettings?.dispose();
    menuBar?.dispose();
    await Promise.all([stopAllCodexClients(), fileSearch.dispose(), workflowService?.dispose()]);
  },
});
// index.chunk-ChZ67Jhw.js: window-all-closed does nothing (the app keeps
// running; the main window only hides), and "activate" (a Dock click) restores
// a minimized main window when nothing is visible, shows a hidden one, or
// recreates it when it no longer exists.
app.on("window-all-closed", () => {});
app.on("activate", (_event, hasVisibleWindows) => {
  if (quitting || !desktopReady) return;
  const exists = liveContents(win);
  const action = activateAction({ exists, minimized: exists && win.isMinimized(), visible: exists && win.isVisible(), hasVisibleWindows });
  if (action === "create") openMainWindow().catch(() => {});
  else if (action === "restore") win.restore();
  else if (action === "show") win.show();
});
