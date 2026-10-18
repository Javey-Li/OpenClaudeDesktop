import test from 'node:test';
import assert from 'node:assert/strict';
import { sideChatRect, sideChatResizeHandles, sideChatResizeCursor, moveSideChat, resizeSideChat } from '../src/side-chat-geometry.mjs';

const viewport = { width: 1280, height: 820 };
test('original default and anchor placement use 320px width and 340px capped height', () => {
  assert.deepEqual(sideChatRect({ viewport }), { width: 320, height: 340, left: 936, top: 392 });
  assert.deepEqual(sideChatRect({ viewport, topInset: 45, endInset: 12, anchor: { right: 1000, bottom: 700, height: 216 } }),
    { width: 320, height: 200, left: 668, top: 492 });
});
test('saved panels retain the nearer edge on viewport changes and enforce minimum dimensions', () => {
  const saved = { width: 420, height: 400, left: 820, top: 360, viewport };
  assert.deepEqual(sideChatRect({ saved, viewport: { width: 1000, height: 700 }, topInset: 45 }),
    { width: 420, height: 400, left: 540, top: 240 });
  const tiny = sideChatRect({ saved, viewport: { width: 300, height: 220 }, topInset: 45 });
  assert.deepEqual(tiny, { width: 280, height: 160, left: 0, top: 45 });
});
test('all eight handles use original resize cursor directions', () => {
  assert.equal(sideChatResizeHandles.length, 8);
  assert.deepEqual(sideChatResizeHandles.map(({ edges }) => sideChatResizeCursor(edges)),
    ['ns-resize', 'ns-resize', 'ew-resize', 'ew-resize', 'nwse-resize', 'nesw-resize', 'nesw-resize', 'nwse-resize']);
});
test('west/north resizing stops at minimum and preserves opposite edges', () => {
  const rect = { left: 500, top: 300, width: 320, height: 340 };
  assert.deepEqual(resizeSideChat(rect, { w: true, n: true }, { x: 900, y: 900 }, viewport, 45),
    { left: 540, top: 480, width: 280, height: 160 });
  assert.deepEqual(resizeSideChat(rect, { w: true, n: true }, { x: -900, y: -900 }, viewport, 45),
    { left: 16, top: 61, width: 804, height: 579 });
});
test('east/south resizing observes 16px margin while dragging reaches the viewport edges', () => {
  const rect = { left: 500, top: 300, width: 320, height: 340 };
  assert.deepEqual(resizeSideChat(rect, { e: true, s: true }, { x: 900, y: 900 }, viewport, 45),
    { left: 500, top: 300, width: 764, height: 504 });
  assert.deepEqual(moveSideChat(rect, { x: -900, y: -900 }, viewport, 45), { ...rect, left: 0, top: 45 });
  assert.deepEqual(moveSideChat(rect, { x: 900, y: 900 }, viewport, 45), { ...rect, left: 960, top: 480 });
});
