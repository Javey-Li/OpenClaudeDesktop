// Fidelity F14: pure pieces of the Settings shell and Local sessions rows, ported from the original.

// shared-22-Cz3C_T8d.js:3915-3918 zC: nav-hidden sections leave the nav and the narrow tabs only.
export function settingsNavSections(sections) {
  return sections.some(section => section.navHidden) ? sections.filter(section => !section.navHidden) : sections;
}

// cc011544b _t (SettingsNavSearch) focuses its field on mount; shared-22:4508/:4549 sw: the popup never
// takes initial focus itself. The narrow tabs and the stacked (nav-hidden) Usage page have no search, so
// the popup keeps focus there.
export function settingsInitialFocus({ narrow, section }) {
  return !narrow && section !== 'usage' ? 'search' : 'popup';
}

// c71860c77-yvGrrWO9.js:2004-2029 D: permission and question offer Off / Badge only / Banners; Task complete
// (idle) offers Off / Banners. No item is disabled (:2240-2275).
const OFF = { value: 'off', label: 'Off' }, BADGE = { value: 'badge', label: 'Badge only' }, BANNER = { value: 'banner', label: 'Banners' };
export const NOTIFICATION_LEVEL_ITEMS = Object.freeze({
  permissionNotifications: Object.freeze([OFF, BADGE, BANNER]),
  questionNotifications: Object.freeze([OFF, BADGE, BANNER]),
  completeNotifications: Object.freeze([OFF, BANNER]),
});
// :2270 `value: A?.[e] ?? "banner"`: an unset level reads as Banners.
export const notificationLevel = value => value ?? 'banner';
// :2108 F = si.every(e => A?.[e] === "off") with si = ['permission','question'] (:1923); the Draw attention
// switch is disabled when both are Off (:2335 `disabled: W && F`).
export function drawAttentionDisabled(levels) {
  return ['permissionNotifications', 'questionNotifications'].every(key => levels?.[key] === 'off');
}
// index.chunk-ChZ67Jhw.js tV: `Db("ccKeepAwakeWhileWorking") !== !1`: keep-awake is on unless turned off.
export const keepAwakeEnabled = value => value !== false;
