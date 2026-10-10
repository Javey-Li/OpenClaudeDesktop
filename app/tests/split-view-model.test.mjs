import test from 'node:test';
import assert from 'node:assert/strict';
import * as split from '../src/split-view-model.mjs';
import { createSplitViewStore } from '../src/split-view-store.mjs';

const { emptySplit, clampRatio, splitTabbed, ratioFromPointer, ratioPercent, stepRatio, sideShowing, reportSide, openSplit, closeSide, swapSides,
  focusSide, focusNext, openInFocusedSide, splitCommand, splitLayout, restoreSplit, splitMenuState, sessionSplitItem, SPLIT_MIN_PANE_PX, SPLIT_COMMANDS } = split;
const withPrimary = (id) => reportSide(emptySplit, 0, { current: id, title: 'Primary' });

test('default store clock preserves the browser timer receiver during startup and reporting', (t) => {
  const calls = [], reports = [];
  t.mock.method(globalThis, 'setTimeout', function (callback, delay) {
    assert.equal(this, globalThis);
    calls.push(['set', delay]);
    return 17;
  });
  t.mock.method(globalThis, 'clearTimeout', function (id) {
    assert.equal(this, globalThis);
    calls.push(['clear', id]);
  });
  const store = createSplitViewStore({ report: (changed) => reports.push(changed) });
  store.reportNow();
  // A change of the sessions shown is reported at once (main.cjs routes unread marks and notifications by it) ...
  store.reportSide(0, { current: 'a', title: 'A' });
  assert.equal(reports.length, 2);
  // ... anything else (a title, the ratio, the focus) waits for the debounce.
  store.reportSide(0, { current: 'a', title: 'A, renamed' });
  store.flushReport();
  assert.deepEqual(calls, [['clear', null], ['clear', null], ['clear', null], ['set', 250], ['clear', 17]]);
  assert.equal(reports.length, 2, 'the same layout is not reported twice');
});

test('ratio: both sides keep the minimum width; the divider keys step, jump to the ends and reset', () => {
  assert.equal(clampRatio(0.5, 1000), 0.5);
  assert.equal(clampRatio(0.1, 1000), 0.36);
  assert.equal(clampRatio(0.95, 1000), 0.64);
  assert.equal(clampRatio(0.2, 600), 0.5, 'too narrow for two minimum sides: halves');
  assert.equal(clampRatio(NaN), 0.5);
  assert.equal(clampRatio(0.05), 0.15, 'unmeasured: 15..85%');
  assert.equal(splitTabbed(2 * SPLIT_MIN_PANE_PX), true);
  assert.equal(splitTabbed(2 * SPLIT_MIN_PANE_PX + 1), false);
  assert.equal(splitTabbed(0), false, 'an unmeasured host is not tabbed');
  assert.equal(ratioFromPointer(700, 100, 1200), 0.5);
  assert.equal(ratioFromPointer(0, 100, 1200), 0.3);
  assert.equal(ratioPercent(0.333), 33);
  assert.equal(stepRatio(0.5, 'ArrowLeft', { width: 1200 }), 0.48);
  assert.equal(stepRatio(0.5, 'ArrowRight', { width: 1200, shift: true }), 0.6);
  assert.equal(stepRatio(0.5, 'Home', { width: 1200 }), 0.3);
  assert.equal(stepRatio(0.5, 'End', { width: 1200 }), 0.7);
  assert.equal(stepRatio(0.7, 'Enter', { width: 1200 }), 0.5);
  assert.equal(stepRatio(0.5, 'a'), null);
});

test('open in split view: a closed split opens on the right and focuses it; an open one shows it on the right; a shown session only takes focus', () => {
  const start = withPrimary('a');
  const opened = openSplit(start, 'b', { nonce: 3 });
  assert.equal(opened.state.open, true);
  assert.equal(opened.state.active, 1);
  assert.deepEqual(opened.state.secondary, { sessionId: 'b', nonce: 3 });
  assert.deepEqual(opened.effects, [{ focus: 1 }]);
  const blank = openSplit(start, null);
  assert.deepEqual(blank.state.secondary.sessionId, null, 'New Session on the Right opens a new-session side');
  const shown = reportSide(opened.state, 1, { current: 'b' });
  assert.deepEqual(openSplit(shown, 'c').effects, [{ navigate: [1, 'c'] }, { focus: 1 }]);
  assert.deepEqual(openSplit({ ...shown, active: 1 }, 'a').effects, [{ focus: 0 }]);
  assert.equal(openSplit({ ...shown, active: 1 }, 'a').state.active, 0);
  assert.equal(sideShowing(shown, 'b'), 1);
  assert.equal(sideShowing(start, 'b'), null);
  assert.equal(sideShowing(shown, null), null);
});

test('close split view: the secondary side closes, or the primary side hands the secondary session over', () => {
  const state = reportSide(reportSide(openSplit(withPrimary('a'), 'b').state, 1, { current: 'b', title: 'B' }), 0, { current: 'a', title: 'A' });
  const right = closeSide(state, 1);
  assert.equal(right.state.open, false);
  assert.deepEqual(right.state.sides, [{ current: 'a', title: 'A' }, { current: null, title: '' }]);
  assert.deepEqual(right.effects, [{ focus: 0 }]);
  const left = closeSide(state, 0);
  assert.deepEqual(left.state.sides[0], { current: 'b', title: 'B' });
  assert.deepEqual(left.effects, [{ navigate: [0, 'b'] }, { focus: 0 }]);
  assert.deepEqual(closeSide(withPrimary('a'), 1).effects, [], 'nothing to close');
});

test('move left / right swap the sessions and the focus follows; focus next / previous switch sides', () => {
  const state = reportSide(openSplit(withPrimary('a'), 'b').state, 1, { current: 'b' });
  assert.equal(state.active, 1);
  const left = swapSides(state, 'left');
  assert.deepEqual(left.state.sides.map((side) => side.current), ['b', 'a']);
  assert.equal(left.state.active, 0);
  assert.deepEqual(left.effects, [{ navigate: [0, 'b'] }, { navigate: [1, 'a'] }, { focus: 0 }]);
  assert.deepEqual(swapSides(state, 'right').effects, [], 'the right side cannot move right');
  assert.deepEqual(focusNext(state).state.active, 0);
  assert.deepEqual(focusNext(state).effects, [{ focus: 0 }]);
  assert.deepEqual(focusSide(state, 0).effects, [], 'a click does not move keyboard focus');
  assert.equal(focusSide(withPrimary('a'), 1).state.active, 0, 'no split: nothing to focus');
});

test('the sidebar opens sessions into the focused side; a session shown on the other side takes focus there', () => {
  const closed = withPrimary('a');
  assert.deepEqual(openInFocusedSide(closed, 'z').effects, [{ navigate: [0, 'z'] }]);
  assert.deepEqual(openInFocusedSide(closed, null).effects, [{ navigate: [0, null] }]);
  const state = reportSide(openSplit(closed, 'b').state, 1, { current: 'b' });
  assert.deepEqual(openInFocusedSide(state, 'z').effects, [{ navigate: [1, 'z'] }]);
  assert.deepEqual(openInFocusedSide({ ...state, active: 0 }, 'z').effects, [{ navigate: [0, 'z'] }]);
  const shown = openInFocusedSide(state, 'a');
  assert.equal(shown.state.active, 0);
  assert.deepEqual(shown.effects, [{ focus: 0 }]);
});

test('commands, menu state, layout persistence and restore', () => {
  assert.deepEqual(SPLIT_COMMANDS, ['new-right', 'focus-next', 'focus-previous', 'move-left', 'move-right', 'close']);
  const closed = withPrimary('a');
  assert.deepEqual(splitMenuState(closed), { newRight: true, split: false, moveLeft: false, moveRight: false });
  const opened = splitCommand(closed, 'new-right').state;
  assert.equal(opened.open, true);
  assert.deepEqual(splitMenuState(opened), { newRight: false, split: true, moveLeft: true, moveRight: false });
  assert.equal(splitCommand(opened, 'new-right').state, opened, 'one secondary side at most');
  assert.equal(splitCommand(opened, 'close').state.open, false);
  assert.equal(splitCommand(opened, 'unknown').state, opened);
  const shown = { ...reportSide(opened, 1, { current: 'b' }), ratio: 0.4 };
  assert.deepEqual(splitLayout(shown), { current: 'a', split: { sessionId: 'b', ratio: 0.4, active: 1 } });
  assert.deepEqual(splitLayout(closed), { current: 'a', split: null });
  const restored = restoreSplit(closed, { sessionId: 'b', ratio: 0.7, active: 0 }, { nonce: 9 });
  assert.equal(restored.state.open, true);
  assert.equal(restored.state.ratio, 0.7);
  assert.equal(restored.state.active, 0);
  assert.deepEqual(restored.state.secondary, { sessionId: 'b', nonce: 9 });
  assert.deepEqual(restored.effects, [], 'a restore does not steal keyboard focus');
  assert.equal(restoreSplit(closed, { sessionId: 'a' }).state.secondary.sessionId, null, 'the primary session is never restored twice');
  assert.equal(restoreSplit(closed, null).state, closed);
  assert.deepEqual(sessionSplitItem(closed, 'a'), null);
  assert.deepEqual(sessionSplitItem(closed, 'z'), { kind: 'open' });
  assert.deepEqual(sessionSplitItem(shown, 'b'), { kind: 'close', side: 1 });
  assert.deepEqual(sessionSplitItem(shown, 'a'), { kind: 'close', side: 0 });
});

test('store: effects reach registered sides (queued until the secondary side registers); shown sessions report at once, the rest is debounced and deduplicated', () => {
  const reports = [], timers = { queue: [], setTimeout(fn) { this.queue.push(fn); return this.queue.length; }, clearTimeout() { this.queue.length = 0; } };
  const store = createSplitViewStore({ report: (changed) => reports.push(changed), timers });
  const calls = [];
  store.register(0, { navigate: (id) => calls.push(['nav0', id]), focus: () => calls.push(['focus0']), settings: (value) => calls.push(['settings', value]) });
  store.reportSide(0, { current: 'a', title: 'A' });
  store.open('b');
  assert.equal(store.getState().open, true);
  assert.deepEqual(calls, [], 'the secondary side is not mounted yet');
  const unregister = store.register(1, { navigate: (id) => calls.push(['nav1', id]), focus: () => calls.push(['focus1']) });
  assert.deepEqual(calls, [['focus1']]);
  store.reportSide(1, { current: 'b', title: 'B' });
  store.openInFocusedSide('c');
  assert.deepEqual(calls.at(-1), ['nav1', 'c']);
  assert.equal(store.toPrimary('settings', 'usage'), true);
  assert.deepEqual(calls.at(-1), ['settings', 'usage']);
  assert.equal(store.isShown('b'), true);
  timers.queue.splice(0).forEach((fn) => fn());
  assert.equal(reports.length, 2, 'the primary session, then the split, each reported when shown');
  assert.deepEqual(reports[0].layout, { current: 'a', split: null });
  assert.deepEqual(reports[1].layout, { current: 'a', split: { sessionId: 'b', ratio: 0.5, active: 1 } });
  assert.deepEqual(reports[1].menu, { newRight: false, split: true, moveLeft: true, moveRight: false });
  store.setRatio(0.5);
  timers.queue.splice(0).forEach((fn) => fn());
  assert.equal(reports.length, 2, 'no change, no report');
  store.setRatio(0.6, 1200);
  store.flushReport();
  assert.deepEqual(reports.at(-1), { layout: { current: 'a', split: { sessionId: 'b', ratio: 0.6, active: 1 } }, menu: null });
  const seen = [];
  const off = store.subscribe(() => seen.push(store.getState().active));
  store.command('focus-next');
  assert.deepEqual(calls.at(-1), ['focus0']);
  assert.deepEqual(seen, [0]);
  off();
  unregister();
  store.close(0);
  assert.deepEqual(calls.at(-2), ['nav0', 'b']);
  const element = { tag: 'slot' };
  store.setSlot(element);
  assert.equal(store.getState().slot, element);
});
