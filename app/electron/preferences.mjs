// Shared by the renderer and main process; contains no platform or account IO.
import { DEFAULT_CODE_THEMES, isTheme } from './code-theme-catalog.mjs';
import { DEFAULT_TRANSCRIPT_VIEW, TRANSCRIPT_VIEWS } from './transcript-view-model.mjs';
import { validateTheme } from './prefs/theme.mjs';
import { validateHarnessProfile } from './prefs/harness-profile.mjs';
import { validateInstructions } from './prefs/instructions.mjs';
import { validateModelSettings } from './prefs/model-settings.mjs';
import { validateCustomCommands } from './prefs/custom-commands.mjs';
import { validatePersona } from './prefs/persona.mjs';
import { LOCALE_CODES } from './i18n/index.mjs';
export const appearanceDefaults = Object.freeze({ motion: 'system', interfaceFont: 'anthropic', codeFont: '', transcriptSize: 'm', transcriptWidth: 's',
  codeThemeLight: DEFAULT_CODE_THEMES.light, codeThemeDark: DEFAULT_CODE_THEMES.dark, transcriptView: DEFAULT_TRANSCRIPT_VIEW });
// Code theme ids are validated against the catalog and their column's mode (a dark theme is not a light theme).
const codeThemeKeys = { codeThemeLight: 'light', codeThemeDark: 'dark' };
const choices = { theme:['light','dark','system'], mode:['code','chat'], permission:['auto','ask','acceptEdits','plan'],
  motion:['system','reduce'], interfaceFont:['anthropic','system','dyslexic'], transcriptSize:['s','m','l'], transcriptWidth:['s','m','l'],
  transcriptView:[...TRANSCRIPT_VIEWS], locale:[...LOCALE_CODES] };
// shared-7-DsClUbcz.js xh bi("userThemeMode","auto"): the theme follows the
// system until the user picks Light or Dark. Profiles without (or with an
// unknown) saved theme resolve to it; main.cjs applies the result to
// nativeTheme.themeSource.
export const DEFAULT_THEME = 'system';
export function themePreference(value) {
  return choices.theme.includes(value) ? value : DEFAULT_THEME;
}
export function appearancePreferences(config = {}) {
  return Object.fromEntries(Object.entries(appearanceDefaults).map(([key, fallback]) => [key,
    key === 'codeFont' ? (typeof config[key] === 'string' ? config[key].slice(0,120) : fallback)
      : key in codeThemeKeys ? (isTheme(config[key], codeThemeKeys[key]) ? config[key] : fallback)
      : choices[key].includes(config[key]) ? config[key] : fallback]));
}
export function fastTierForModel(model) {
  // Match the Codex TUI's current_model_fast_service_tier: catalog name, not a
  // hardcoded model allowlist or the deprecated additionalSpeedTiers field.
  return model?.serviceTiers?.find(tier => typeof tier.id === 'string' && tier.name?.toLowerCase() === 'fast') || null;
}
export function selectedCatalogModel(models, id) {
  return models.find(model => (model.model || model.id) === id) || (!id ? models.find(model => model.isDefault) || models[0] : undefined);
}
export function validateServiceTier(models, modelId, tier) {
  if (tier === 'default' || tier === null) return tier;
  const model = selectedCatalogModel(models, modelId);
  if (typeof tier !== 'string' || !model?.serviceTiers?.some(value => value.id === tier))
    throw new Error('This service tier is not available for the selected model.');
  return tier;
}
export function settingsPatch(config, patch, models = []) {
  const next = { ...config };
  for (const [key, values] of Object.entries(choices)) {
    if (!(key in patch)) continue;
    if (!values.includes(patch[key])) throw new Error(`Invalid ${key} setting.`);
    next[key] = patch[key];
  }
  for (const [key, mode] of Object.entries(codeThemeKeys)) {
    if (!(key in patch)) continue;
    if (!isTheme(patch[key], mode)) throw new Error(`Invalid ${key} setting.`);
    next[key] = patch[key];
  }
  for (const key of ['model','effort','displayName','codeFont']) {
    if (!(key in patch)) continue;
    if (typeof patch[key] !== 'string' || patch[key].length > (key === 'codeFont' ? 120 : 200) || /[\x00-\x1f]/.test(patch[key]))
      throw new Error(`Invalid ${key} setting.`);
    next[key] = patch[key];
  }
  if ('codeFont' in patch && /[;{}<>]/.test(patch.codeFont)) throw new Error('Enter a font family name.');
  if ('allowBypassPermissions' in patch) {
    if (typeof patch.allowBypassPermissions !== 'boolean') throw new Error('Invalid bypass permissions setting.');
    next.allowBypassPermissions = patch.allowBypassPermissions;
  }
  if ('fastMode' in patch && typeof patch.fastMode !== 'boolean') throw new Error('Invalid Fast mode setting.');
  if ('fastMode' in patch) next.fastMode = patch.fastMode;
  const fast = fastTierForModel(selectedCatalogModel(models, next.model));
  if (patch.fastMode === true && !fast) throw new Error('Fast mode is not available for this model.');
  if ('model' in patch && !fast) next.fastMode = false;
  if ('persona' in patch) { const v = validatePersona(patch.persona); if (v === null) delete next.persona; else next.persona = v; }
  if ('customCommands' in patch) { const v = validateCustomCommands(patch.customCommands); if (v === null) delete next.customCommands; else next.customCommands = v; }
  if ('modelSettings' in patch) { const v = validateModelSettings(patch.modelSettings); if (v === null) delete next.modelSettings; else next.modelSettings = v; }
  if ('customInstructions' in patch) { const v = validateInstructions(patch.customInstructions); if (v === null) delete next.customInstructions; else next.customInstructions = v; }
  if ('harnessProfile' in patch) { const v = validateHarnessProfile(patch.harnessProfile); if (v === null) delete next.harnessProfile; else next.harnessProfile = v; }
  if ('customTheme' in patch) { const v = validateTheme(patch.customTheme); if (v === null) delete next.customTheme; else next.customTheme = v; }
  return next;
}
