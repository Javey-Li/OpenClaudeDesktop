import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerminalStore, ownerKeyOf } from '../src/terminal-store.mjs';
import { MAX_CACHED_TERMINALS } from '../src/terminal-pane-model.mjs';

// The renderer's terminal store over a fake preload bridge: owners keyed per session (two sessions at once), output
// routed to kept-alive views, attach replay without duplicates, and agent-opened tabs announced.
function fakeBridge() {
  const calls = [], writes = [];
  let emit = null, attachOutput = '', attachEnd = 0, nextId = 1;
  const pendingAttach = [];
  const bridge = {
    calls, writes,
    onEvent(handler) { emit = handler; return () => { emit = null; }; },
    write(id, data) { writes.push([id, data]); },
    async call(op, params) {
      calls.push([op, params]);
      if (op === 'hello') return { backend: 'pty' };
      if (op === 'list') return [];
      if (op === 'create') {
        const owner = params.sessionId ?? `home:${params.homeWorkspace}`;
        return { id: `term-${String(nextId++).padStart(6, '0')}`, owner, sessionId: params.sessionId, number: nextId - 1, title: null, status: 'running', generation: 1, busy: false };
      }
      if (op === 'attach') return new Promise((resolve) => pendingAttach.push(() => resolve({ output: attachOutput, end: attachEnd })));
      if (op === 'close' || op === 'resize') return true;
      if (op === 'rename') return { id: params.id, owner: params.sessionId, title: params.title, number: 1, status: 'running', generation: 1 };
      if (op === 'restart') return { id: params.id, owner: params.sessionId, title: null, number: 1, status: 'running', generation: 2 };
      throw new Error('unexpected');
    },
    emit: (event) => emit?.(event),
    setAttach(output, end) { attachOutput = output; attachEnd = end; },
    releaseAttach() { while (pendingAttach.length) pendingAttach.shift()(); },
  };
  return bridge;
}
const fakeView = () => { const view = { written: '', resets: 0, disposed: false, write(data) { view.written += data; }, reset() { view.resets += 1; view.written = ''; }, dispose() { view.disposed = true; } }; return view; };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('owners are per session; the New session page is keyed by its folder', () => {
  assert.equal(ownerKeyOf('s1', '/x'), 's1');
  assert.equal(ownerKeyOf(null, '/Users/u/p'), 'home:/Users/u/p');
  assert.equal(ownerKeyOf(null, null), null);
});

test('load, create, select, move and close keep each owner’s tabs apart', async () => {
  const bridge = fakeBridge();
  const store = createTerminalStore({ bridge });
  assert.equal(store.available, true);
  assert.deepEqual(await store.backend(), { backend: 'pty' });
  let notified = 0;
  store.subscribe(() => { notified += 1; });
  await store.load('s1', 's1', null);
  await store.load('s1', 's1', null);
  assert.equal(bridge.calls.filter(([op]) => op === 'list').length, 1, 'listed once');
  const a = await store.create('s1', 's1', null, { cols: 90, rows: 20 });
  const b = await store.create('s1', 's1', null);
  const c = await store.create('s2', 's2', null);
  assert.deepEqual(bridge.calls.find(([op]) => op === 'create')[1], { sessionId: 's1', cols: 90, rows: 20 });
  assert.deepEqual(store.get('s1').tabs.map((tab) => tab.id), [a.id, b.id]);
  assert.equal(store.get('s1').active, b.id, 'a new tab becomes active');
  assert.deepEqual(store.get('s2').tabs.map((tab) => tab.id), [c.id]);
  store.select('s1', a.id);
  assert.equal(store.get('s1').active, a.id);
  store.move('s1', a.id, 1);
  assert.deepEqual(store.get('s1').tabs.map((tab) => tab.id), [b.id, a.id]);
  await store.close('s1', 's1', null, a.id);
  assert.deepEqual(store.get('s1').tabs.map((tab) => tab.id), [b.id]);
  assert.equal(store.get('s1').active, b.id);
  assert.ok(notified > 0);
  // Home owner passes its folder, never a session id.
  await store.create('home:/p', null, '/p');
  assert.deepEqual(bridge.calls.filter(([op]) => op === 'create').at(-1)[1], { sessionId: null, homeWorkspace: '/p', cols: undefined, rows: undefined });
});

test('views attach to the kept output, then take live output once, without duplicates; restart resets the view', async () => {
  const bridge = fakeBridge();
  const store = createTerminalStore({ bridge });
  const info = await store.create('s1', 's1', null);
  const view = fakeView();
  bridge.setAttach('hello ', 6);
  assert.equal(store.view(info.id, 's1', null, () => view), view);
  // Output arriving while the attach is pending is queued, then trimmed against the attach's end.
  bridge.emit({ kind: 'data', id: info.id, data: 'lo world', end: 11 });
  bridge.emit({ kind: 'data', id: info.id, data: '!', end: 12 });
  assert.equal(view.written, '');
  bridge.releaseAttach();
  await tick();
  assert.equal(view.written, 'hello world!');
  bridge.emit({ kind: 'data', id: info.id, data: '!', end: 12 });
  bridge.emit({ kind: 'data', id: info.id, data: '?', end: 13 });
  assert.equal(view.written, 'hello world!?');
  assert.equal(store.view(info.id, 's1', null, () => assert.fail('a kept view is reused')), view);
  // A state event with a new generation resets the view.
  bridge.emit({ kind: 'state', info: { ...info, generation: 2 } });
  assert.equal(view.resets, 1);
  // Keystrokes go fire-and-forget; Enter is remembered for auto-close.
  store.input(info.id, 'exit\r');
  assert.deepEqual(bridge.writes, [[info.id, 'exit\r']]);
  assert.ok(store.lastEnter(info.id) > 0);
  // Removal disposes the view.
  bridge.emit({ kind: 'removed', id: info.id, owner: 's1', reason: 'folder-gone' });
  assert.equal(view.disposed, true);
  assert.equal(store.get('s1').tabs.length, 0);
  assert.equal(store.hasView(info.id), false);
});

test('at most 16 views stay alive; the least recently shown is disposed first', async () => {
  const bridge = fakeBridge();
  const store = createTerminalStore({ bridge });
  const views = [];
  for (let index = 0; index <= MAX_CACHED_TERMINALS; index++) {
    const info = await store.create('s1', 's1', null);
    const view = fakeView();
    views.push([info.id, view]);
    store.view(info.id, 's1', null, () => view);
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  assert.equal(views[0][1].disposed, true);
  assert.equal(store.hasView(views[0][0]), false);
  assert.equal(views.slice(1).every(([, view]) => !view.disposed), true);
});

test('busy state and agent-opened tabs', async () => {
  const bridge = fakeBridge();
  const store = createTerminalStore({ bridge });
  const opened = [];
  store.onOpened((event) => opened.push(event));
  bridge.emit({ kind: 'state', info: { id: 'term-agent1', owner: 's9', sessionId: 's9', number: 1, status: 'running', busy: true, generation: 1 } });
  bridge.emit({ kind: 'opened', id: 'term-agent1', owner: 's9', sessionId: 's9', openedBy: 'agent' });
  assert.deepEqual(opened.map((event) => event.sessionId), ['s9']);
  assert.equal(store.get('s9').active, 'term-agent1');
  assert.equal(store.busy('s9'), true);
  assert.equal(store.busy('s1'), false);
  bridge.emit({ kind: 'state', info: { id: 'term-agent1', owner: 's9', sessionId: 's9', number: 1, status: 'exited', busy: false, generation: 1 } });
  assert.equal(store.busy('s9'), false);
});

test('without a preload bridge the store reports unavailable and does nothing', async () => {
  const store = createTerminalStore({ bridge: null });
  assert.equal(store.available, false);
  assert.equal(await store.load('s1', 's1', null), null);
  assert.equal(store.get('s1'), null);
});
