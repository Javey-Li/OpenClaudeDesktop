// Application menu template and window lifecycle decisions, kept pure so they
// are unit-testable. index.chunk-ChZ67Jhw.js ANr builds the menu bar in the
// order App (Gtr), File (lwr), Edit (ISr), View (pNr), Go (mwr), Window (kNr),
// Help (Djr); the Claude-only Chat/Developer/area menus have no local
// counterpart. Each click is a desktop event; main.cjs handles the window,
// zoom and log events itself and forwards the rest to the renderer.
const { ZOOM_STEP } = require("./window-chrome.cjs");
// Labels are translated when a template is built (installAppMenu runs again
// after the main process sets the locale or the language preference changes).
const { t, getLocale } = require("./i18n/index.mjs");
// Electron names label-less role items in English; other locales name them
// explicitly (en-US keeps the native role labels).
const roleLabel = (text, values) => getLocale() === "en-US" ? {} : { label: t(text, values) };
const APP_NAME = "Code Desktop";
const SEPARATOR = Object.freeze({ type: "separator" });
// RZ(e, dispatch, "cmd"): when a menu item fires through its own accelerator
// with ⌘ held, the chord reached the menu because the page did not take it
// (the renderer owns ⌘⇧D/⌘⇧F/⌘\/⌘⇧[/⌘⇧]/⌘⇧K/⌘/ and preventDefaults them when
// it acts), so the click is not dispatched again. Mouse clicks always are.
const rendererOwned = (event) => event?.triggeredByAccelerator === true && event.metaKey === true;
const dispatch = (emit, payload) => (_item, window, event) => { if (!rendererOwned(event)) emit(payload, window); };
// Gtr: About, Settings… (KK shows the main window first, then navigates),
// Services, Hide / Hide Others / Show All, Quit. The update items (Wtr) have
// no local updater.
function appSubmenu(emit) {
  return {
    label: "Code Desktop",
    submenu: [
      { role: "about", ...roleLabel("About {appName}", { appName: APP_NAME }) },
      SEPARATOR,
      { label: t("Settings…"), accelerator: "CommandOrControl+,", click: (_item, window) => emit({ kind: "open-settings" }, window) },
      SEPARATOR,
      { role: "services", ...roleLabel("Services") },
      SEPARATOR,
      { role: "hide", ...roleLabel("Hide {appName}", { appName: APP_NAME }) },
      { role: "hideOthers", ...roleLabel("Hide Others") },
      { role: "unhide", ...roleLabel("Show All") },
      SEPARATOR,
      { role: "quit", ...roleLabel("Quit {appName}", { appName: APP_NAME }) },
    ],
  };
}
// lwr: New Session (cwr, CmdOrCtrl+N), the ewr Open… block (Open Folder…,
// CmdOrCtrl+Shift+O; Open File… has no local file opener), then nwr. iwr
// names the ⌘W item: "Close Session" (xdFFXdcjAb) while the renderer reports
// a session view (lSr: sessionPanes.diff.enabled, here session.open), else
// "Close Pane" while it reports a closable pane; either comes with Close
// Window on ⌘⇧W. Otherwise ⌘W is Close Window (twr, role close, which hides
// the main window) with a hidden ⌘⇧W twin. rwr then appends Reopen Closed
// Session (t77UbkPnXg, CmdOrCtrl+Shift+T, registerAccelerator, enabled from
// hSr) only while the renderer reports it available.
// owr: the renderer's keydown owns ⌘W in the main window (pR), so a ⌘W that
// reached Close Session through its accelerator is marked and main.cjs does
// not dispatch it again; a pane window's ⌘W closes that window.
function fileMenuItems({ closePane, session = { open: false }, reopenClosed = { available: false, enabled: false }, emit }) {
  const closeWindow = (accelerator = "CmdOrCtrl+W") => ({ label: t("Close Window"), accelerator, role: "close" });
  const closeSession = (_item, window, event) => emit({ kind: "close-session", ...(rendererOwned(event) ? { accelerator: true } : {}) }, window);
  const close = session.open
    ? [{ label: t("Close Session"), accelerator: "CmdOrCtrl+W", click: closeSession }, closeWindow("CmdOrCtrl+Shift+W")]
    : closePane
      ? [{ label: t("Close Pane"), accelerator: "CmdOrCtrl+W", click: (_item, window) => emit({ kind: "close-pane" }, window) }, closeWindow("CmdOrCtrl+Shift+W")]
      : [closeWindow(), { ...closeWindow("CmdOrCtrl+Shift+W"), visible: false, acceleratorWorksWhenHidden: true }];
  const reopen = reopenClosed.available
    ? [{ label: t("Reopen Closed Session"), accelerator: "CmdOrCtrl+Shift+T", registerAccelerator: true, enabled: reopenClosed.enabled === true,
      click: dispatch(emit, { kind: "reopen-closed" }) }]
    : [];
  return [
    { label: t("New Session"), accelerator: "CmdOrCtrl+N", click: (_item, window) => emit({ kind: "new-session" }, window) },
    SEPARATOR,
    { label: t("Open Folder…"), accelerator: "CmdOrCtrl+Shift+O", click: (_item, window) => emit({ kind: "open-folder" }, window) },
    SEPARATOR,
    ...close,
    ...reopen,
  ];
}
// ISr: the Find submenu after FSr — Find… (CmdOrCtrl+F, BSr), Find Next
// (CmdOrCtrl+G) and Find Previous (CmdOrCtrl+Shift+G, USr → the renderer's
// step request). The renderer's find bar (source-find-bar.jsx, ZB) owns the
// chords, so the accelerators are shown but not registered; a click emits
// find-open / find-step. PSr's Find in Files… has no local counterpart.
function findSubmenu(emit) {
  return {
    label: t("Find"),
    submenu: [
      { label: t("Find…"), accelerator: "CmdOrCtrl+F", registerAccelerator: false, click: (_item, window) => emit({ kind: "find-open" }, window) },
      { label: t("Find Next"), accelerator: "CmdOrCtrl+G", registerAccelerator: false, click: (_item, window) => emit({ kind: "find-step", forward: true }, window) },
      { label: t("Find Previous"), accelerator: "CmdOrCtrl+Shift+G", registerAccelerator: false, click: (_item, window) => emit({ kind: "find-step", forward: false }, window) },
    ],
  };
}
// ISr/FSr("mac") in place of the editMenu role: Undo/Redo, Cut/Copy/Paste,
// Paste and Match Style (with the hidden CmdOrCtrl+Shift+V twin), Delete and
// Select All, then a separator and the Find submenu. FSr has no Speech submenu.
function editMenuItems(emit = () => {}) {
  return [
    { label: t("Undo"), accelerator: "CmdOrCtrl+Z", role: "undo" },
    { label: t("Redo"), accelerator: "CmdOrCtrl+Shift+Z", role: "redo" },
    SEPARATOR,
    { label: t("Cut"), accelerator: "CmdOrCtrl+X", role: "cut" },
    { label: t("Copy"), accelerator: "CmdOrCtrl+C", role: "copy" },
    { label: t("Paste"), accelerator: "CmdOrCtrl+V", role: "paste" },
    { label: t("Paste and Match Style"), accelerator: "CmdOrCtrl+Alt+Shift+V", role: "pasteAndMatchStyle" },
    { label: t("Paste and Match Style"), accelerator: "CmdOrCtrl+Shift+V", visible: false, acceleratorWorksWhenHidden: true, role: "pasteAndMatchStyle" },
    { label: t("Delete"), role: "delete" },
    { label: t("Select All"), accelerator: "CmdOrCtrl+A", role: "selectAll" },
    SEPARATOR,
    findSubmenu(emit),
  ];
}
// Go menu: index.chunk-D6ATlqeD.js gyr() = {label:_yr() "Go", submenu:
// [...Cyr("Command+[","Command+]","cmd"), ...wyr(...)]}, placed after View in
// jOr. Cyr pairs each direction: a hidden twin ({...a, visible:!1}) that owns
// the registered accelerator, then the visible item (id "go-back" /
// "go-forward", registerAccelerator:!1, enabled from xyr.canGoBack /
// canGoForward, which Syr updates via getMenuItemById). Both clicks navigate;
// here that is the {kind:"navigate", delta} desktop event. The renderer
// preventDefaults ⌘[ / ⌘] (main.jsx key handler), so like ⌘B the accelerator
// does not also fire. index.chunk-ChZ67Jhw.js Swr then adds, after a
// separator, wwr's Previous/Next Session (Command+Shift+[ / ], RZ →
// dispatchCycleSession) and, after another separator, Search…
// (Command+Shift+K, RZ → dispatchOpenCommandPalette(true)). Cwr's area
// checkboxes need at least two areas, so they never appear here.
function goMenuItems({ canGoBack, canGoForward, emit }) {
  const back = { label: t("Back"), accelerator: "Command+[", click: () => emit({ kind: "navigate", delta: -1 }) };
  const forward = { label: t("Forward"), accelerator: "Command+]", click: () => emit({ kind: "navigate", delta: 1 }) };
  return [
    { ...back, visible: false },
    { ...back, id: "go-back", registerAccelerator: false, enabled: canGoBack === true },
    { ...forward, visible: false },
    { ...forward, id: "go-forward", registerAccelerator: false, enabled: canGoForward === true },
    SEPARATOR,
    { label: t("Previous Session"), accelerator: "Command+Shift+[", click: dispatch(emit, { kind: "cycle-session", delta: -1 }) },
    { label: t("Next Session"), accelerator: "Command+Shift+]", click: dispatch(emit, { kind: "cycle-session", delta: 1 }) },
    SEPARATOR,
    { label: t("Search…"), accelerator: "Command+Shift+K", click: dispatch(emit, { kind: "open-search" }) },
  ];
}
// index.chunk-ChZ67Jhw.js dNr replaces the zoom roles: Actual Size (id
// "actual-size", CmdOrCtrl+0) is enabled only while zoomed (uNr: level !== 0,
// kept current by DNr after each step); Zoom In is CmdOrCtrl+Plus with a
// hidden CmdOrCtrl+= twin; Zoom Out is CmdOrCtrl+-; hidden numpad twins keep
// their accelerators (acceleratorWorksWhenHidden). wNr/TNr step the level by
// lNr=.5 and SNr resets it; here each click is a {kind:"zoom"} desktop event
// that main.cjs applies (ONr/CNr, then aF moves the traffic lights).
function zoomMenuItems({ zoomed, emit }) {
  const reset = () => emit({ kind: "zoom", reset: true });
  const zoomIn = () => emit({ kind: "zoom", delta: ZOOM_STEP }), zoomOut = () => emit({ kind: "zoom", delta: -ZOOM_STEP });
  const hidden = { visible: false, acceleratorWorksWhenHidden: true };
  return [
    { id: "actual-size", label: t("Actual Size"), accelerator: "CmdOrCtrl+0", enabled: zoomed === true, click: reset },
    { label: t("Zoom In"), accelerator: "CmdOrCtrl+Plus", click: zoomIn },
    { label: "Zoom In (indie cooler version)", accelerator: "CmdOrCtrl+=", ...hidden, click: zoomIn },
    { label: t("Zoom Out"), accelerator: "CmdOrCtrl+-", click: zoomOut },
    { label: "Zoom In (numpad)", accelerator: "CmdOrCtrl+numadd", ...hidden, click: zoomIn },
    { label: "Zoom Out (numpad)", accelerator: "CmdOrCtrl+numsub", ...hidden, click: zoomOut },
    { id: "actual-size-numpad", label: "Actual Size (numpad)", accelerator: "CmdOrCtrl+num0", ...hidden, enabled: zoomed === true, click: reset },
  ];
}
// bNr: one gNr Show/Hide item per session pane with a local counterpart
// (Changes CmdOrCtrl+Shift+D, Files CmdOrCtrl+Shift+F; Terminal, Preview and
// Side Chat have none), labelled Hide only while the pane is enabled and open,
// enabled from the renderer's sessionPanes report, then Close Pane
// (CmdOrCtrl+\, enabled from closePane). Clicks go through RZ.
function paneMenuItems({ panes, closePane }, emit) {
  const pane = (kind, show, hide, accelerator) => {
    const { enabled, open } = panes[kind];
    return { label: enabled && open ? hide : show, accelerator, enabled, click: dispatch(emit, { kind: "toggle-pane", pane: kind }) };
  };
  return [
    pane("changes", t("Show Changes"), t("Hide Changes"), "CmdOrCtrl+Shift+D"),
    pane("files", t("Show Files"), t("Hide Files"), "CmdOrCtrl+Shift+F"),
    { label: t("Close Pane"), accelerator: "CmdOrCtrl+\\", enabled: closePane.enabled, click: dispatch(emit, { kind: "close-pane" }) },
  ];
}
// pNr: _Nr opens the View submenu with the sidebar item built by gNr. On
// macOS gNr yields a plain item labelled by the current state (open ? "Hide
// Sidebar" : "Show Sidebar"); the "Sidebar" checkbox variant is
// Windows/Linux only. Its click is dispatchToggleSidebar(Menu) in the focused
// renderer, mirrored here as the {kind:"toggle-sidebar"} desktop event. The
// source's leading "Command Palette…" item and the Split View submenu have no
// local counterpart. Then bNr's pane items, dNr zoom, Reload (fNr,
// CmdOrCtrl+R) and Enter/Exit Full Screen (Control+Command+F, xNr toggles the
// focused window). Developer tools live in the source's hidden Developer
// menu; locally Toggle Developer Tools stays in View for unpackaged builds.
function viewMenuItems({ sidebarOpen, zoomed, fullScreen, allowDevTools, state, emit }) {
  return [
    { label: sidebarOpen ? t("Hide Sidebar") : t("Show Sidebar"), accelerator: "CmdOrCtrl+B", click: () => emit({ kind: "toggle-sidebar" }) },
    SEPARATOR,
    ...paneMenuItems(state, emit),
    SEPARATOR,
    ...zoomMenuItems({ zoomed, emit }),
    SEPARATOR,
    { role: "reload", ...roleLabel("Reload") },
    ...(allowDevTools ? [{ role: "toggleDevTools", ...roleLabel("Toggle Developer Tools") }] : []),
    SEPARATOR,
    { label: fullScreen ? t("Exit Full Screen") : t("Enter Full Screen"), accelerator: "Control+Command+F", click: (_item, window) => emit({ kind: "toggle-full-screen" }, window) },
  ];
}
// kNr: Minimize, Zoom, Show Main Window (KK), Bring All to Front.
function windowMenu(emit) {
  return {
    role: "window",
    label: t("Window"),
    submenu: [
      { role: "minimize", label: t("Minimize") },
      { role: "zoom", label: t("Zoom") },
      SEPARATOR,
      { label: t("Show Main Window"), click: () => emit({ kind: "show-main-window" }) },
      SEPARATOR,
      { role: "front", label: t("Bring All to Front") },
    ],
  };
}
// Djr: Keyboard Shortcuts (kjr, CmdOrCtrl+/, RZ → dispatchOpenKeyboardShortcuts)
// and Troubleshooting ▸ Show Logs in Finder (Ejr/njr). Claude Help and Get
// Support open Anthropic web resources and are omitted; so are the
// Claude-only troubleshooting rows.
function helpMenu(emit) {
  return {
    role: "help",
    label: t("Help"),
    submenu: [
      { label: t("Keyboard Shortcuts"), accelerator: "CmdOrCtrl+/", click: dispatch(emit, { kind: "open-shortcuts" }) },
      SEPARATOR,
      { label: t("Troubleshooting"), submenu: [{ label: t("Show Logs in Finder"), click: () => emit({ kind: "show-logs" }) }] },
    ],
  };
}
function appMenuTemplate({ sidebarOpen, canGoBack = false, canGoForward = false, zoomed = false, fullScreen = false, allowDevTools = false, menuState: state = menuState(), emit }) {
  return [
    appSubmenu(emit),
    { label: t("File"), submenu: fileMenuItems({ closePane: state.closePane.enabled, session: state.session, reopenClosed: state.reopenClosed, emit }) },
    { label: t("Edit"), submenu: editMenuItems(emit) },
    { label: t("View"), submenu: viewMenuItems({ sidebarOpen, zoomed, fullScreen, allowDevTools, state, emit }) },
    { label: t("Go"), submenu: goMenuItems({ canGoBack, canGoForward, emit }) },
    windowMenu(emit),
    helpMenu(emit),
  ];
}
// shared-2 Hm "dframe-store" persists Zm {collapsed:false, sidebarWidth:288}:
// the collapsed flag lives beside the width. Non-boolean values are ignored,
// like the width's number check in main.cjs "settings".
function sidebarCollapsedPatch(patch) {
  return typeof patch?.sidebarCollapsed === "boolean" ? { sidebarCollapsed: patch.sidebarCollapsed } : {};
}
// Renderer "navigation-state" payload (Syr's {canGoBack, canGoForward});
// anything but true reads as unavailable.
function navigationState(payload) {
  return { canGoBack: payload?.canGoBack === true, canGoForward: payload?.canGoForward === true };
}
// Renderer "menu-state" payload: the sessionPanes slice the source keeps in
// BZ ($xr zZ {enabled:false, open:false} per pane) for the panes and Close
// Pane that exist locally, session.open (a session view shows: iwr's lSr)
// and BZ.reopenClosedSession (rSr {available:false, enabled:false}, gSr);
// anything but true reads as false.
function menuState(payload) {
  const pane = (value) => ({ enabled: value?.enabled === true, open: value?.open === true });
  return { panes: { changes: pane(payload?.panes?.changes), files: pane(payload?.panes?.files) }, closePane: { enabled: payload?.closePane?.enabled === true },
    session: { open: payload?.session?.open === true },
    reopenClosed: { available: payload?.reopenClosed?.available === true, enabled: payload?.reopenClosed?.enabled === true } };
}
// vSr/_Sr: the menu is rebuilt only when a reported flag changed.
function sameMenuState(a, b) {
  return JSON.stringify(menuState(a)) === JSON.stringify(menuState(b));
}
// The main window's "close" handler (index.chunk-ChZ67Jhw.js m.on("close")):
// a quit closes it; otherwise the close is prevented and the window hides,
// leaving full screen first (leave-full-screen, then hide).
function closeAction({ quitting, fullScreen }) {
  if (quitting) return "close";
  return fullScreen ? "leave-full-screen" : "hide";
}
// app "activate" (Dock click): recreate a destroyed main window; restore a
// minimized one only when no window is visible; show a hidden one.
function activateAction({ exists, minimized, visible, hasVisibleWindows }) {
  if (!exists) return "create";
  if (minimized) return hasVisibleWindows ? null : "restore";
  return visible ? null : "show";
}
module.exports = { appMenuTemplate, zoomMenuItems, goMenuItems, sidebarCollapsedPatch, navigationState, menuState, sameMenuState,
  closeAction, activateAction, rendererOwned };
