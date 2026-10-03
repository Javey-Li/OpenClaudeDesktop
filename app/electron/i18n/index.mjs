// UI language. Shared by the renderer and the main process (src/ is not
// packaged, so the dictionaries live here like prefs/). Source strings are the
// English copy itself: t('Settings') returns it unchanged in en-US and looks it
// up in the active dictionary otherwise; a missing entry falls back to English.
//
// The renderer takes the locale once, before any module renders, from the
// preload's first-paint appearance (main.cjs desktop:appearance answers with
// preferences.json `locale`); changing the language saves the preference and
// reloads the window, like the original's "Changing the language will reload…".
// Module-level t() calls are therefore safe. The main process calls setLocale
// after reading preferences and rebuilds its menus.
import zhCN from './zh-CN/index.mjs';

export const DEFAULT_LOCALE = 'en-US';
// name: in English (the secondary line); localName: in the language itself.
export const LOCALES = Object.freeze([
  Object.freeze({ locale: 'en-US', name: 'English (United States)', localName: 'English (United States)' }),
  Object.freeze({ locale: 'zh-CN', name: 'Chinese (Simplified)', localName: '简体中文' }),
]);
export const LOCALE_CODES = Object.freeze(LOCALES.map(entry => entry.locale));
const DICTIONARIES = { 'zh-CN': zhCN };

export const isLocale = value => LOCALE_CODES.includes(value);
export const localePreference = value => isLocale(value) ? value : DEFAULT_LOCALE;

let current = (() => {
  try { return localePreference(globalThis.desktop?.appearance?.locale); } catch { return DEFAULT_LOCALE; }
})();
try { if (globalThis.document?.documentElement) globalThis.document.documentElement.lang = current; } catch {}

export function getLocale() { return current; }
/** Main process / tests only; the renderer reloads instead. */
export function setLocale(locale) {
  current = localePreference(locale);
  try { if (globalThis.document?.documentElement) globalThis.document.documentElement.lang = current; } catch {}
  return current;
}
export const dictionary = (locale = current) => DICTIONARIES[locale] ?? null;

const interpolate = (text, values) => values
  ? text.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(values, key) && values[key] !== undefined && values[key] !== null ? String(values[key]) : match)
  : text;

/**
 * Translate one English source string. `values` fill {name} placeholders
 * (applied after the lookup, so translations may reorder them).
 */
export function t(source, values) {
  if (typeof source !== 'string') return source;
  const table = DICTIONARIES[current];
  const text = table && Object.hasOwn(table, source) ? table[source] : source;
  return interpolate(text, values);
}

/** Singular/plural pick on the English side; both forms are dictionary keys. */
export function tn(count, one, other, values) {
  return t(count === 1 ? one : other, { count, ...values });
}
