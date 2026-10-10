import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import registryModule from '../electron/window-registry.cjs';
import windowState from '../electron/window-state.cjs';

const { MAIN_WINDOW_KEY, OPEN_WINDOWS_FILE, sanitizeLayout, layoutSessions, routeEvent, restorableWindows, launchLayout, newWindowKey, createWindowRegistry } = registryModule;
const { windowStateFile, cascadeWindowState, forgetWindowState, WINDOW_STATE_FILE } = windowState;

let nextId = 1;
class FakeContents extends EventEmitter {
  constructor() { super(); this.sent = []; this.destroyed = false; this.mainFrame = { id: 'frame' }; }
  send(channel, event) { this.sent.push([channel, event]); }
  isDestroyed() { return this.destroyed; }
}
class FakeWindow extends EventEmitter {
  constructor() { super(); this.id = nextId++; this.webContents = new FakeContents(); this.destroyed = false; }
  isDestroyed() { return this.destroyed; }
}
function fakeTimers() {
  const pending = new Map(); let next = 1;
  return { pending, setTimeout: (fn) => { const id = next++; pending.set(id, fn); return id; }, clearTimeout: (id) => pending.delete(id),
    run() { const due = [...pending.values()]; pending.clear(); for (const fn of due) fn(); } };
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'window-registry-'));
const events = (window) => window.webContents.sent.map(([, event]) => event);

test('sanitizeLayout keeps a primary session and a split side; one session never shows on both sides', () => {
  assert.deepEqual(sanitizeLayout(null), { current: null, split: null });
  assert.deepEqual(sanitizeLayout({ current: 'a' }), { current: 'a', split: null });
  assert.deepEqual(sanitizeLayout({ current: 'a', split: { sessionId: 'b', ratio: 0.3, active: 1 } }), { current: 'a', split: { sessionId: 'b', ratio: 0.3, active: 1 } });
  assert.deepEqual(sanitizeLayout({ current: 'a', split: { sessionId: 'a', ratio: 'x', active: 7 } }), { current: 'a', split: { sessionId: null, ratio: 0.5, active: 0 } });
  assert.deepEqual(sanitizeLayout({ current: 'bad\u0000id', split: { ratio: 5 } }).split.ratio, 0.85);
  assert.equal(sanitizeLayout({ current: 'x'.repeat(201) }).current, null);
  assert.deepEqual(layoutSessions({ current: 'a', split: { sessionId: 'b' } }), ['a', 'b']);
  assert.deepEqual(layoutSessions({ split: { sessionId: 'b' } }), ['b']);
});

test('routeEvent: desktop-navigate targets the session, window-scoped kinds with a windowId one window, the rest every window', () => {
  assert.deepEqual(routeEvent({ kind: 'desktop-navigate', threadId: 't1' }), { target: 'session', sessionId: 't1' });
  assert.deepEqual(routeEvent({ kind: 'popout-docked', windowId: 4, sessionId: 's', pane: 'files' }), { target: 'window', windowId: 4 });
  assert.deepEqual(routeEvent({ kind: 'window', windowId: 2, fullScreen: true }), { target: 'window', windowId: 2 });
  assert.deepEqual(routeEvent({ kind: 'popout-docked', sessionId: 's' }), { target: 'all' }, 'no owner: every window');
  assert.deepEqual(routeEvent({ method: 'item/agentMessage/delta', params: { threadId: 't1' } }), { target: 'all' });
  assert.deepEqual(routeEvent({ kind: 'connection', connected: true }), { target: 'all' });
  assert.deepEqual(routeEvent(null), { target: 'none' });
});

test('restorableWindows: validated keys in order, unique, capped, the focused key kept; an empty file opens the main window', () => {
  assert.deepEqual(restorableWindows(null), { windows: [{ key: MAIN_WINDOW_KEY, layout: { current: null, split: null } }], focused: MAIN_WINDOW_KEY });
  const restored = restorableWindows({ focused: 'w-2', windows: [{ key: 'main', layout: { current: 'a' } }, { key: 'w-2', layout: { current: 'b', split: { sessionId: 'c', ratio: 0.4, active: 1 } } },
    { key: 'w-2' }, { key: 'BAD KEY' }, { key: '../escape' }] });
  assert.deepEqual(restored.windows.map((entry) => entry.key), ['main', 'w-2']);
  assert.equal(restored.focused, 'w-2');
  assert.deepEqual(restored.windows[1].layout, { current: 'b', split: { sessionId: 'c', ratio: 0.4, active: 1 } });
  assert.equal(restorableWindows({ windows: Array.from({ length: 20 }, (_, index) => ({ key: `w-${index}` })) }).windows.length, 8);
  assert.equal(restorableWindows({ focused: 'nope', windows: [{ key: 'w-1' }] }).focused, 'w-1');
  assert.match(newWindowKey(() => 'ABCD-1234-ef'), /^w-abcd1234ef$/);
  assert.match(newWindowKey(), /^w-[a-z0-9]{1,12}$/);
});

test('dispatch: session and app events reach every main window; desktop-navigate the window showing the session; windowId events one window', () => {
  const registry = createWindowRegistry();
  const a = new FakeWindow(), b = new FakeWindow(), c = new FakeWindow();
  registry.register(a, { key: 'main', layout: { current: 's1' } });
  registry.register(b, { key: 'w-b', layout: { current: 's2', split: { sessionId: 's3' } } });
  registry.register(c, { key: 'w-c' });
  const delta = { method: 'item/agentMessage/delta', params: { threadId: 's1', delta: 'x' } };
  assert.deepEqual(registry.dispatch(delta), [a, b, c]);
  for (const window of [a, b, c]) assert.deepEqual(events(window), [delta]);
  // Focus order: c is the newest-registered; desktop-navigate for s3 goes to b, which shows it on its split side.
  assert.deepEqual(registry.dispatch({ kind: 'desktop-navigate', threadId: 's3' }), [b]);
  assert.deepEqual(registry.windowsShowing('s3'), [b]);
  // A session nobody shows: the newest-focused window opens it.
  registry.noteFocus(a);
  assert.deepEqual(registry.dispatch({ kind: 'desktop-navigate', threadId: 'other' }), [a]);
  // Two windows show the same session: the focused one wins, else the newest-focused.
  registry.setLayout(c, { current: 's1' });
  registry.noteFocus(c);
  assert.deepEqual(registry.dispatch({ kind: 'desktop-navigate', threadId: 's1' }), [c]);
  assert.deepEqual(registry.dispatch({ kind: 'popout-docked', windowId: b.id, sessionId: 's2', pane: 'files' }), [b]);
  // The owner is gone: the newest-focused window docks it.
  assert.deepEqual(registry.dispatch({ kind: 'popout-docked', windowId: 999, sessionId: 's2', pane: 'files' }), [c]);
  // Destroyed windows are skipped everywhere.
  b.destroyed = true;
  assert.deepEqual(registry.dispatch({ kind: 'stats' }), [a, c]);
  assert.deepEqual(registry.mainWindows(), [a, c]);
});

test('sender lookups: only a registered window main frame is a main sender; hostWindow also finds pane popouts', () => {
  const popout = new FakeWindow();
  const registry = createWindowRegistry({ BrowserWindow: { fromWebContents: (contents) => (contents === popout.webContents ? popout : null) } });
  const a = new FakeWindow();
  registry.register(a);
  assert.equal(registry.isMainSender({ sender: a.webContents, senderFrame: a.webContents.mainFrame }), true);
  assert.equal(registry.isMainSender({ sender: a.webContents, senderFrame: { id: 'subframe' } }), false);
  assert.equal(registry.isMainSender({ sender: popout.webContents, senderFrame: popout.webContents.mainFrame }), false);
  assert.equal(registry.windowForSender(a.webContents), a);
  assert.equal(registry.windowForSender(popout.webContents), null);
  assert.equal(registry.hostWindow(a.webContents), a);
  assert.equal(registry.hostWindow(popout.webContents), popout);
  assert.equal(registry.isMain(a), true);
  assert.equal(registry.isMain(popout), false);
});

test('focus, per-window state slots, close listeners and the last focused window', () => {
  const registry = createWindowRegistry();
  const a = new FakeWindow(), b = new FakeWindow();
  registry.register(a); registry.register(b, { key: 'w-b' });
  assert.equal(registry.lastFocused(), b);
  registry.noteFocus(a);
  assert.equal(registry.lastFocused(), a);
  registry.setState(a, 'nav', { canGoBack: true });
  assert.deepEqual(registry.getState(a, 'nav'), { canGoBack: true });
  assert.equal(registry.getState(b, 'nav'), undefined);
  const closed = [];
  registry.onWindowClosed((window, key) => closed.push([window, key]));
  registry.unregister(a);
  assert.deepEqual(closed, [[a, 'main']]);
  assert.equal(registry.lastFocused(), b);
  assert.equal(registry.byKey('w-b'), b);
  assert.equal(registry.keyOf(b), 'w-b');
  assert.equal(registry.unregister(a), null);
});

test('persistence: open windows and layouts are written debounced, frozen at the first quit close, and read back for relaunch', () => {
  const dir = tmp(), file = path.join(dir, OPEN_WINDOWS_FILE), timers = fakeTimers();
  const registry = createWindowRegistry({ file: () => file, timers });
  const a = new FakeWindow(), b = new FakeWindow();
  registry.register(a, { key: 'main', layout: { current: 's1' } });
  registry.register(b, { key: 'w-b' });
  registry.setLayout(b, { current: 's2', split: { sessionId: 's3', ratio: 0.62, active: 1 } });
  assert.equal(fs.existsSync(file), false, 'debounced');
  timers.run();
  const written = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(written, { version: 1, focused: 'w-b', windows: [{ key: 'main', layout: { current: 's1', split: null } }, { key: 'w-b', layout: { current: 's2', split: { sessionId: 's3', ratio: 0.62, active: 1 } } }] });
  // An unchanged report schedules nothing.
  registry.setLayout(b, { current: 's2', split: { sessionId: 's3', ratio: 0.62, active: 1 } });
  assert.equal(timers.pending.size, 0);
  // Quit: freeze writes now; the closes that follow keep the list.
  registry.freeze();
  registry.unregister(a); registry.unregister(b);
  timers.run();
  const restored = registry.read();
  assert.deepEqual(restored.windows.map((entry) => entry.key), ['main', 'w-b']);
  assert.equal(restored.focused, 'w-b');
  // A window closed for good (no quit) drops out of the next write.
  const fresh = createWindowRegistry({ file: () => file, timers });
  const c = new FakeWindow(), d = new FakeWindow();
  fresh.register(c, { key: 'main' }); fresh.register(d, { key: 'w-d' });
  fresh.unregister(d);
  fresh.flush();
  assert.deepEqual(fresh.read().windows.map((entry) => entry.key), ['main']);
  fs.writeFileSync(file, '{broken');
  assert.deepEqual(fresh.read().windows.map((entry) => entry.key), ['main']);
});

test('window-state per window: the main window keeps window-state.json, others their key file; cascade and forget', () => {
  assert.equal(windowStateFile('main'), WINDOW_STATE_FILE);
  assert.equal(windowStateFile(), WINDOW_STATE_FILE);
  assert.equal(windowStateFile('w-abc'), 'window-state-w-abc.json');
  assert.equal(windowStateFile('../x'), WINDOW_STATE_FILE, 'an invalid key never names another path');
  const display = { bounds: { x: 0, y: 0, width: 1470, height: 956 }, workArea: { x: 0, y: 33, width: 1470, height: 923 } };
  const screen = { getDisplayMatching: () => display, getPrimaryDisplay: () => display };
  const base = { width: 1200, height: 800, isMaximized: false, isFullScreen: false };
  assert.deepEqual(cascadeWindowState(base, { x: 100, y: 80, width: 1000, height: 700 }, screen), { ...base, x: 124, y: 104, width: 1000, height: 700 });
  // At the work area's far corner the cascade restarts at its origin.
  assert.deepEqual(cascadeWindowState(base, { x: 470, y: 256, width: 1000, height: 700 }, screen), { ...base, x: 0, y: 33, width: 1000, height: 700 });
  assert.deepEqual(cascadeWindowState(base, null, screen), base);
  assert.deepEqual(cascadeWindowState({ ...base, isMaximized: true }, { x: 1, y: 1, width: 10, height: 10 }, screen), { ...base, isMaximized: true });
  const dir = tmp(), other = path.join(dir, 'window-state-w-abc.json'), main = path.join(dir, WINDOW_STATE_FILE);
  fs.writeFileSync(other, '{}'); fs.writeFileSync(main, '{}');
  assert.equal(forgetWindowState(other), true);
  assert.equal(fs.existsSync(other), false);
  assert.equal(forgetWindowState(main), false);
  assert.equal(fs.existsSync(main), true, 'the main window frame is kept');
});

test('launchLayout: the first window starts on the new-session page unless it was split; other windows reopen what they showed', () => {
  assert.deepEqual(launchLayout('main', { current: 'a' }), { current: null, split: null });
  assert.deepEqual(launchLayout('main', { current: 'a', split: { sessionId: 'b', ratio: 0.4, active: 1 } }), { current: 'a', split: { sessionId: 'b', ratio: 0.4, active: 1 } });
  assert.deepEqual(launchLayout('w-1', { current: 'a' }), { current: 'a', split: null });
  const registry = createWindowRegistry();
  const a = new FakeWindow(), b = new FakeWindow();
  registry.register(a, { key: 'main', layout: { current: 'x' } });
  registry.register(b, { key: 'w-b', layout: { current: 'y' } });
  assert.deepEqual(registry.launchLayoutOf(a), { current: null, split: null });
  assert.deepEqual(registry.launchLayoutOf(b), { current: 'y', split: null });
  assert.deepEqual(registry.layoutOf(a), { current: 'x', split: null }, 'the stored layout keeps the primary session for routing');
  assert.deepEqual(registry.launchLayoutOf(null), { current: null, split: null });
  // A loading page's first (empty) reports never replace what it restores; the next load takes the latest layout.
  registry.setLayout(b, { current: null, split: null });
  assert.deepEqual(registry.launchLayoutOf(b), { current: 'y', split: null });
  registry.setLayout(b, { current: 'z', split: { sessionId: 'q' } });
  registry.captureLaunch(b);
  assert.deepEqual(registry.launchLayoutOf(b), { current: 'z', split: { sessionId: 'q', ratio: 0.5, active: 0 } });
  // The main window's first load starts on Home; a reload after it (⌘R, a Language change) keeps the open session.
  registry.captureLaunch(a);
  assert.deepEqual(registry.launchLayoutOf(a), { current: null, split: null });
  registry.setLayout(a, { current: 'open', split: null });
  registry.captureLaunch(a);
  assert.deepEqual(registry.launchLayoutOf(a), { current: 'open', split: null });
});
