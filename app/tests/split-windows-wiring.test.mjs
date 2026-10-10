import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import appMenu from '../electron/app-menu.cjs';
import { dictionary } from '../electron/i18n/index.mjs';

// Multi-window and split view wiring: View › Split View and File › New Window (app-menu.cjs), main.cjs routing
// through window-registry.cjs, the renderer's split sides in main.jsx, and zh-CN copy for every new string.
const { appMenuTemplate, splitMenuState } = appMenu;
const app = path.resolve(import.meta.dirname, '..');
const read = (file) => readFileSync(path.join(app, file), 'utf8');
const viewMenu = (splitState) => appMenuTemplate({ sidebarOpen: true, splitState, emit: (event, window) => calls.push([event, window]) }).find((item) => item.label === 'View').submenu;
let calls = [];

test('View › Split View follows official yNr/vNr: items, accelerators, enabled from the focused window report, split-view clicks', () => {
  calls = [];
  const split = viewMenu({ newRight: false, split: true, moveLeft: true, moveRight: false }).find((item) => item.label === 'Split View');
  assert.ok(split, 'the submenu is in View');
  assert.deepEqual(split.submenu.map((item) => item.type === 'separator' ? '---' : [item.label, item.accelerator ?? null, item.enabled]), [
    ['New Session on the Right', 'Control+Command+\\', false], '---',
    ['Focus Next Split View', 'Control+]', true], ['Focus Previous Split View', 'Control+[', true], '---',
    ['Move Split View Left', null, true], ['Move Split View Right', null, false], '---',
    ['Close Split View', 'Control+Command+W', true]]);
  const target = { id: 7 };
  const close = split.submenu.at(-1);
  close.click({}, target);
  close.click({}, target, { triggeredByAccelerator: true, ctrlKey: true });
  close.click({}, target, { triggeredByAccelerator: true, ctrlKey: false });
  assert.deepEqual(calls, [[{ kind: 'split-view', command: 'close' }, target], [{ kind: 'split-view', command: 'close' }, target]],
    'a chord the renderer already matched (⌃ held) is not dispatched twice');
  const closed = viewMenu(undefined).find((item) => item.label === 'Split View').submenu;
  assert.deepEqual(closed.filter((item) => item.label).map((item) => item.enabled), [false, false, false, false, false, false], 'no report: nothing enabled');
  assert.deepEqual(splitMenuState({ newRight: 1, split: 'yes', moveLeft: true }), { newRight: false, split: false, moveLeft: true, moveRight: false });
});

test('File › New Window emits new-window for the menu window (no accelerator: ⇧⌘N is New Session with Current Settings); main.cjs opens it cascaded from that window', () => {
  calls = [];
  const file = appMenuTemplate({ sidebarOpen: true, emit: (event, window) => calls.push([event, window]) }).find((item) => item.label === 'File').submenu;
  const item = file.find((entry) => entry.label === 'New Window');
  assert.equal(item.accelerator, undefined);
  assert.equal(file.find((entry) => entry.label === 'New Session with Current Settings').accelerator, 'CmdOrCtrl+Shift+N');
  item.click({}, { id: 3 });
  assert.deepEqual(calls, [[{ kind: 'new-window' }, { id: 3 }]]);
  const main = read('electron/main.cjs');
  assert.match(main, /if \(e\?\.kind === "new-window"\) return void openWindow\(\{ from: windowRegistry\.isMain\(target\) \? target : win \}\)/);
});

test('main.cjs routes through the window registry: any main window is trusted, events dispatch per window, menus reach their window', () => {
  const main = read('electron/main.cjs');
  assert.match(main, /const windowRegistry = createWindowRegistry\(\{ file: \(\) => path\.join\(app\.getPath\("userData"\), OPEN_WINDOWS_FILE\), BrowserWindow \}\);/);
  assert.match(main, /if \(windowRegistry\.isMainSender\(e\)\) return "primary";/);
  assert.match(main, /const sent = windowRegistry\.dispatch\(e\);/);
  assert.doesNotMatch(main, /win\.webContents\.send\("desktop:event"/, 'no event goes to one hard-wired window');
  assert.match(main, /const window = revealMainWindow\(target\);\n\s+if \(window\) windowRegistry\.send\(window, e\);/);
  assert.match(main, /windowRegistry\.register\(window, \{ key, layout \}\);/);
  // Per-window menu reports; the focused window's are shown.
  assert.match(main, /case "navigation-state": return setNavigationState\(p, windowRegistry\.windowForSender\(e\.sender\)\);/);
  assert.match(main, /case "menu-state": return setMenuState\(p, windowRegistry\.windowForSender\(e\.sender\)\);/);
  assert.match(main, /case "split-menu-state": return setSplitMenuState\(p, windowRegistry\.windowForSender\(e\.sender\)\);/);
  assert.match(main, /case "window-layout": return windowRegistry\.setLayout\(windowRegistry\.windowForSender\(e\.sender\), p\);/);
  // Focusing any main window adopts it and clears the notification badge (desktop-settings.cjs clearNotices).
  assert.match(main, /window\.on\("focus", \(\) => \{ adoptMainWindow\(window\); desktopSettings\?\.clearNotices\?\.\(\); \}\);/);
  // Closing one of several windows closes it for good; a quit freezes the list restored at launch.
  assert.match(main, /if \(quitting\) windowRegistry\.freeze\(\);\n\s+else if \(windowRegistry\.mainWindows\(\)\.some\(\(other\) => other !== window\)\) return;/);
  assert.match(main, /const restoredWindows = windowRegistry\.read\(\);\n\s+for \(const entry of restoredWindows\.windows\) createMainWindow\(entry\);/);
  assert.match(main, /windowLayout: windowRegistry\.launchLayoutOf\(windowRegistry\.windowForSender\(e\.sender\)\),/);
  assert.match(main, /window\.webContents\.on\("did-start-loading", \(\) => windowRegistry\.captureLaunch\(window\)\);/);
  // The shared connection keeps a session subscribed while another window shows it.
  assert.match(main, /p\.method === "thread\/unsubscribe" && typeof params\.threadId === "string"\n\s+&& windowRegistry\.windowsShowing\(params\.threadId\)\.some/);
  // Pane popouts dock back into the window that opened them.
  assert.match(main, /emit\(\{ kind: "popout-docked", sessionId, pane, entryPoint: entry\.docked \? "dock" : "window-close", \.\.\.\(entry\.ownerId !== null \? \{ windowId: entry\.ownerId \} : \{\}\) \}\);/);
  // Session list, sidebar and settings changes reach every window.
  for (const pattern of [/emitSessionList\("added", result\.thread\)/, /emitSessionList\("deleted", params\.threadId\)/, /emit\(\{ kind: "sidebar-state", state: sidebarSnapshot\(\) \}\);/, /emitConfig\(\);\n\s+return config;/])
    assert.match(main, pattern);
});

test('main.jsx mounts the window as split sides; only the focused side takes window keys and menu commands', () => {
  const jsx = read('src/main.jsx');
  assert.match(jsx, /function App\(\{ side = 0, initialSession = null \}\) \{/);
  assert.match(jsx, /<SourceSplitRoot renderSide=\{\(side, secondary\) => <App side=\{side\} initialSession=\{secondary\?\.sessionId \?\? null\} \/>\} \/>/);
  assert.match(jsx, /\{side === 0 && <SourceSidebar\n\s+windowActions=\{windowActions\}/, 'the sidebar belongs to the primary side');
  // The tabbed strip carries the collapsed sidebar's chrome (Show sidebar / Back / Forward) the hidden titlebars lose.
  assert.match(jsx, /<SourceSplitHost side=\{side\} chrome=\{effectiveCollapsed \? <SourceCollapsedChrome [^\n]*\n[^\n]*\/> : null\}>\n\s+<main\n\s+ref=\{mainRef\}/);
  assert.match(jsx, /function key\(e\) \{\n\s+if \(!splitActiveRef\.current\) return;/);
  assert.match(jsx, /if \(MENU_COMMANDS\.has\(e\.kind\) && \(e\.kind === "open-search" \? side === 0 : splitActiveRef\.current\)\) menuCommandRef\.current\?\.\(e\);/);
  assert.match(jsx, /const chinNode = scope\(\)\.querySelector\("\.sc-chin"\);/);
  assert.match(jsx, /onOpen=\{openInFocusedSide\}/);
  assert.match(jsx, /if \(splitView\.open\) \{ splitStore\.close\(side\); return; \}/, '⌘W closes the focused side first');
  assert.match(jsx, /const setSettings = side === 0 \? setSettingsState : \(value\) => \{ if \(!splitStore\.toPrimary\("settings", value\)\) setSettingsState\(value\); \};/);
  // Keys in pane components stand down in the side that is not focused.
  assert.match(read('src/source-composer.jsx'), /panelActive(?::| =) !!node\?\.isConnected && !node\.closest\("\[inert\], \[data-split-inactive\]"\)/);
  assert.match(read('src/use-card-hotkeys.js'), /card\.closest\("\[inert\], \[data-split-inactive\]"\)/);
  assert.match(read('src/source-find-bar.jsx'), /if \(!enabled \|\| !shortcuts\) return undefined;/);
});

test('every new English string has zh-CN with the same placeholders', () => {
  const zh = dictionary('zh-CN');
  const sources = ['src/source-split-view.jsx', 'electron/app-menu.cjs'];
  const strings = new Set(['New Window', 'Close a window before opening another.', 'Open in split view', 'Close split view', 'Open in new window', 'Couldn’t open a new window.']);
  for (const file of sources) for (const match of read(file).matchAll(/\bt\("((?:[^"\\]|\\.)+)"/g)) strings.add(match[1].replace(/\\(.)/g, '$1'));
  const missing = [...strings].filter((source) => typeof zh[source] !== 'string' || !zh[source].trim());
  assert.deepEqual(missing, []);
  const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join();
  for (const source of strings) assert.equal(placeholders(zh[source]), placeholders(source), source);
});
