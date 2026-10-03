import { t } from "../electron/i18n/index.mjs";

// Appearance model (pure): the /theme argument, the resolved light/dark mode
// and which running transitions a mode flip finishes.

// cc43287c9-BMbiZYzF.js:11206-11224 LI/RI/zI: "/theme <arg>" sets light, dark
// or follow-system; "auto" is the source's own name for system, so both map to
// the local "system" preference. No argument, an unknown word or extra lines
// open the picker (the source opens Settings > General with "Theme"
// highlighted, :33718-33730); locally Appearance lives on the Preferences page.
const THEME_ARGUMENTS = new Map([["light", "light"], ["dark", "dark"], ["system", "system"], ["auto", "system"]]);
export function parseThemeCommand(args) {
  const text = typeof args === "string" ? args : "";
  if (/[\r\n]/.test(text.trim())) return { open: "appearance" };
  const theme = THEME_ARGUMENTS.get(text.trim().toLowerCase());
  return theme ? { set: theme } : { open: "appearance" };
}
// shared-7 xh "Appearance set to …" toast names.
export const THEME_LABELS = Object.freeze({ light: t("Light"), dark: t("Dark"), system: t("System") });

// shared-7 Bh: follow-system resolves through prefers-color-scheme; an
// explicit choice is used as is. Anything unknown follows the system, which is
// the default preference (shared-7 bi("userThemeMode","auto")).
export function resolveThemeMode(theme, prefersDark) {
  if (theme === "light" || theme === "dark") return theme;
  return prefersDark ? "dark" : "light";
}
// The preload's synchronous {theme, mode} (main process config + nativeTheme)
// seeds the first render so a dark profile never paints a light frame; without
// the bridge (fixtures, SSR) the media query decides.
export function initialAppearance(bridge, prefersDark) {
  const theme = ["light", "dark", "system"].includes(bridge?.theme) ? bridge.theme : "system";
  const mode = bridge?.mode === "light" || bridge?.mode === "dark" ? bridge.mode : resolveThemeMode(theme, prefersDark);
  return { theme, mode };
}

// shared-7-DsClUbcz.js wh/jh/Ph: after html[data-mode] flips between light
// and dark, the next frame finishes every running colour transition so the
// whole surface switches at once. Writes from or to an unresolved value
// (undefined/"system") skip it.
export const isColorTransitionProperty = (property) =>
  property.endsWith("color") || property === "box-shadow" || property === "text-shadow" || property === "fill" || property === "stroke"
  || property === "--tw-gradient-from" || property === "--tw-gradient-via" || property === "--tw-gradient-to";
export const finishesColorTransitions = (from, to) =>
  (from === "light" || from === "dark") && (to === "light" || to === "dark") && from !== to;
export function finishColorTransitions(doc) {
  if (typeof doc?.getAnimations !== "function") return 0;
  const running = doc.getAnimations().filter((animation) => typeof animation.transitionProperty === "string"
    && isColorTransitionProperty(animation.transitionProperty) && animation.playbackRate > 0 && animation.playState !== "paused");
  for (const animation of running) animation.finish();
  return running.length;
}
// Writes the resolved mode to html[data-mode] (never "system") and schedules
// the colour-transition finish for a real flip.
export function writeThemeMode(doc, mode, schedule = (callback) => requestAnimationFrame(callback)) {
  const root = doc.documentElement, previous = root.dataset.mode;
  if (previous === mode) return false;
  root.dataset.mode = mode;
  if (finishesColorTransitions(previous, mode)) schedule(() => finishColorTransitions(doc));
  return true;
}
