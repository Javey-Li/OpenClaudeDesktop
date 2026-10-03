// Native window chrome values, kept pure so they are unit-testable.
// index.chunk-ChZ67Jhw.js ssn={light:"#fcfcfb",dark:"#151515"} and jP():
// windows are created with, and repainted on nativeTheme "updated" to, the
// background of the resolved appearance.
const WINDOW_BACKGROUND = Object.freeze({ light: "#fcfcfb", dark: "#151515" });
function windowBackground(dark) {
  return dark ? WINDOW_BACKGROUND.dark : WINDOW_BACKGROUND.light;
}
// Hon=.25 / CP: zoom factors are clamped to [0.25, 5]; Uon=Math.log(1.2),
// Won/Gon/Kon: zoom levels to the same range in Chromium's 1.2^level steps.
const ZOOM_FACTOR = Object.freeze({ MIN: 0.25, MAX: 5 });
const clampZoomFactor = (factor) => Math.min(ZOOM_FACTOR.MAX, Math.max(ZOOM_FACTOR.MIN, Number.isFinite(factor) ? factor : 1));
const ZOOM_LEVEL = Object.freeze({ MIN: Math.log(ZOOM_FACTOR.MIN) / Math.log(1.2), MAX: Math.log(ZOOM_FACTOR.MAX) / Math.log(1.2) });
const clampZoomLevel = (level) => Math.min(ZOOM_LEVEL.MAX, Math.max(ZOOM_LEVEL.MIN, level));
// lNr=.5 (Zoom In) and -.5 (Zoom Out) per ONr step; Actual Size is level 0 (SNr).
const ZOOM_STEP = 0.5;
function zoomLevelAfter(level, request) {
  if (request?.reset === true) return 0;
  const delta = Number.isFinite(request?.delta) ? request.delta : 0;
  return clampZoomLevel((Number.isFinite(level) ? level : 0) + delta);
}
// eun=12 and run(base, zoom): each coordinate becomes
// max(0, round((v + eun/2) * CP(zoom) - eun/2)).
const TRAFFIC_LIGHT_SIZE = 12;
function scaleTrafficLights(base, zoom) {
  const half = TRAFFIC_LIGHT_SIZE / 2, factor = clampZoomFactor(zoom);
  const scale = (value) => Math.max(0, Math.round((value + half) * factor - half));
  return { x: scale(base.x), y: scale(base.y) };
}
// aun(zoom) = run({x:iun, y:iun}, zoom) with iun=33/2: {x:17, y:17} at 100%
// (lun; uun feeds the main window's trafficLightPosition).
const TRAFFIC_LIGHT_ORIGIN = Object.freeze({ x: 33 / 2, y: 33 / 2 });
function trafficLightPosition(zoom = 1) {
  return scaleTrafficLights(TRAFFIC_LIGHT_ORIGIN, zoom);
}
module.exports = { WINDOW_BACKGROUND, windowBackground, ZOOM_FACTOR, clampZoomFactor, ZOOM_LEVEL, clampZoomLevel, ZOOM_STEP, zoomLevelAfter, TRAFFIC_LIGHT_SIZE, scaleTrafficLights, trafficLightPosition };
