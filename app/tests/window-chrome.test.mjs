import test from 'node:test';
import assert from 'node:assert/strict';
import chrome from '../electron/window-chrome.cjs';
const { windowBackground, WINDOW_BACKGROUND, trafficLightPosition, scaleTrafficLights, clampZoomFactor, zoomLevelAfter, ZOOM_LEVEL, ZOOM_STEP } = chrome;

test('window background follows the resolved appearance (index.chunk-ChZ67Jhw.js ssn/jP)', () => {
  assert.deepEqual(WINDOW_BACKGROUND, { light: '#fcfcfb', dark: '#151515' });
  assert.equal(windowBackground(true), '#151515');
  assert.equal(windowBackground(false), '#fcfcfb');
});

test('traffic lights follow aun/run: {17,17} at 100% and the button centre scales with the zoom', () => {
  assert.deepEqual(trafficLightPosition(1), { x: 17, y: 17 });
  assert.deepEqual(trafficLightPosition(), { x: 17, y: 17 });
  // round((16.5 + 6) * z - 6)
  assert.deepEqual(trafficLightPosition(0.8), { x: 12, y: 12 });
  assert.deepEqual(trafficLightPosition(1.25), { x: 22, y: 22 });
  assert.deepEqual(trafficLightPosition(1.2), { x: 21, y: 21 });
  assert.deepEqual(trafficLightPosition(1 / 1.2), { x: 13, y: 13 });
  // CP clamps the factor to [0.25, 5]; coordinates never go negative.
  assert.deepEqual(trafficLightPosition(0.1), trafficLightPosition(0.25));
  assert.deepEqual(trafficLightPosition(9), trafficLightPosition(5));
  assert.deepEqual(scaleTrafficLights({ x: 0, y: 0 }, 0.25), { x: 0, y: 0 });
  // Pane windows keep their own origin, scaled the same way.
  assert.deepEqual(scaleTrafficLights({ x: 14, y: 12 }, 1), { x: 14, y: 12 });
  assert.deepEqual(scaleTrafficLights({ x: 14, y: 12 }, 1.25), { x: 19, y: 17 });
  assert.equal(clampZoomFactor(Number.NaN), 1);
});

test('zoom steps follow ONr/SNr: ±.5 levels clamped to the Kon range, reset to 0', () => {
  assert.equal(ZOOM_STEP, 0.5);
  assert.equal(zoomLevelAfter(0, { delta: ZOOM_STEP }), 0.5);
  assert.equal(zoomLevelAfter(0.5, { delta: -ZOOM_STEP }), 0);
  assert.equal(zoomLevelAfter(2, { reset: true }), 0);
  assert.equal(zoomLevelAfter(ZOOM_LEVEL.MAX, { delta: ZOOM_STEP }), ZOOM_LEVEL.MAX);
  assert.equal(zoomLevelAfter(ZOOM_LEVEL.MIN, { delta: -ZOOM_STEP }), ZOOM_LEVEL.MIN);
  assert.ok(Math.abs(1.2 ** ZOOM_LEVEL.MAX - 5) < 1e-9 && Math.abs(1.2 ** ZOOM_LEVEL.MIN - 0.25) < 1e-9);
  assert.equal(zoomLevelAfter(1, {}), 1);
  assert.equal(zoomLevelAfter(Number.NaN, { delta: 'x' }), 0);
});
