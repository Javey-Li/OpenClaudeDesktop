// Model menu decisions (current 2.2553.1 shared-14 FS → AS/kS), kept pure so
// they can be tested without the portal-based SourceMenu.Popup.

import { t } from "../electron/i18n/index.mjs";

const modelKey = (model) => model?.model || model?.id;

// Effort display name: Codex/Harness report ids (low, high, max…); the menu,
// the composer trigger ('Effort: High', c8e04f916 effortSelectorTrigger) and
// Settings capitalize them. Display-only, so the capitalized name is the dictionary key.
// efforts (optional): the model's own levels. A model whose only levels are none/default is a thinking switch (Qwen's
// toggle-only models: 'Thinking off' / 'Thinking on', model-configuration.ts), not two effort levels.
// Kimi's thinking option is the same switch spelled off/on (acp-server buildThinkingOption: 'off' plus the model's
// efforts, or off/on for a boolean thinking model), so 'off' and 'on' read as Thinking off / Thinking on wherever they
// appear (Kimi labels them so; DeepSeek Harness's 'off' level is its non-thinking mode too), never 'Effort: On'.
const levelId = (level) => typeof level === "string" ? level : level?.reasoningEffort ?? level?.id;
const TOGGLE_PAIRS = [["none", "default"], ["off", "on"]];
export const isThinkingToggle = (efforts) => Array.isArray(efforts) && efforts.length === 2 && new Set(efforts.map(levelId)).size === 2
  && TOGGLE_PAIRS.some((pair) => efforts.every((level) => pair.includes(levelId(level))));
// c74045701 effort labels: xhigh reads 'Extra high' (kDEj60CmLq); other ids capitalise as before.
const EFFORT_NAMES = Object.freeze({ xhigh: "Extra high" });
export const effortName = (value = "", efforts) => (isThinkingToggle(efforts) && (value === "none" || value === "default")) || value === "off" || value === "on"
  ? t(value === "none" || value === "off" ? "Thinking off" : "Thinking on")
  : t(EFFORT_NAMES[value] ?? String(value).charAt(0).toUpperCase() + String(value).slice(1));

// The purple top tier is a named effort, not "whatever is last": c8e04f916 accents the previewed label only when
// its id is Xx 'ultracode' (scratch effort.js:150 `B?.id === v`), and c360a9e1c:5257 mounts the lit slider overlay
// only when effort_options.at(-1) is ultracode (dn). Codex 0.155.1 ships the twin 'ultra' ("Maximum reasoning with
// automatic task delegation") as the last level of gpt-6-astra / gpt-5.6-sol / -terra, so those get the accent
// and the overlay; gpt-5.6-luna (…max), gpt-5.5 (…xhigh) and DeepSeek Harness (off/low/high/max) get neither.
const TOP_TIER_EFFORTS = new Set(["ultra", "ultracode"]);
export const effortId = (level) => typeof level === "string" ? level : level?.id || level?.reasoningEffort;
export const isTopTierEffort = (id) => TOP_TIER_EFFORTS.has(id);
export const hasTopTierEffort = (levels) => Array.isArray(levels) && isTopTierEffort(effortId(levels.at(-1)));

// Ultracode (Claude Code 2.1.280: xhigh effort + standing dynamic-workflow orchestration, this session only). With
// Dynamic workflows on, the purple top tier IS ultracode: a model's own top tier (Codex's 'ultra') keeps its id and
// gains ultracode's standing instruction; a model that reaches xhigh without one gets an 'ultracode' level that runs
// at xhigh (coreEffort). Without xhigh, or with workflows off, the levels are the model's own.
export const ULTRACODE_EFFORT = "ultracode";
export const ultracodeDescription = () => t("ultracode · xhigh effort + dynamic workflows for maximum thoroughness");
export function withUltracodeLevel(levels, workflowsEnabled) {
  if (!workflowsEnabled || !Array.isArray(levels) || !levels.length) return levels;
  // A model's own top tier keeps its id, so its label names the effort the core really runs (Codex's 'ultra': "Maximum
  // reasoning with automatic task delegation"), not xhigh.
  if (hasTopTierEffort(levels)) return levels.map((level, index) => index === levels.length - 1 && typeof level === "object"
    ? { ...level, description: effortId(level) === ULTRACODE_EFFORT ? ultracodeDescription() : t("ultracode · {effort} effort + dynamic workflows for maximum thoroughness", { effort: effortName(effortId(level)) }) } : level);
  if (!levels.some((level) => effortId(level) === "xhigh")) return levels;
  return [...levels, { reasoningEffort: ULTRACODE_EFFORT, description: ultracodeDescription() }];
}
/** The effort a core receives: ultracode runs at xhigh; every other level is the core's own. */
export const coreEffort = (value) => value === ULTRACODE_EFFORT ? "xhigh" : value;
/** The effort a session keeps on disk for a picked level. Ultracode is this app run only (Claude Code: interactive
 * toggles never persist it), so with workflows on the top tier is saved as the level under it: xhigh when the model
 * lists it, else its next-highest level. `levels` are the model's own (without the added ultracode level). */
export function durableEffort(value, levels, workflowsEnabled) {
  if (!workflowsEnabled || !isTopTierEffort(value)) return value;
  const own = (Array.isArray(levels) ? levels : []).map(effortId).filter((id) => id && !isTopTierEffort(id));
  return own.includes("xhigh") ? "xhigh" : own.at(-1) ?? coreEffort(value);
}

// Codex has no main/overflow catalog section, so the returned order is kept
// with the first-four convention; explicit catalog sections take precedence.
// showFast: shared-14 ES returns null when the model has no 'fast' option
// (:6634-6636, rendered `te && a ? F(ES, …) : null` :6949), so the separator,
// header and row exist only for a model with a Fast service tier.
// A catalog this long (OpenCode with OpenRouter: 400+ models) gets a search field, and its main list is capped: the
// default and the selected model first, then the first others, the rest under More models.
export const MODEL_SEARCH_THRESHOLD = 12;
export const MODEL_PRIMARY_CAP = 8;
export const MODEL_SEARCH_LIMIT = 60;
export function modelMenuSections({ models = [], fastTier = null, selected = null } = {}) {
  const available = (Array.isArray(models) ? models : []).filter((model) => typeof modelKey(model) === "string");
  const showFast = !!fastTier;
  if (available.some((model) => model.section === "main" || model.section === "overflow")) {
    let primary = available.filter((model) => model.section !== "overflow");
    let overflow = available.filter((model) => model.section === "overflow");
    if (available.length > MODEL_SEARCH_THRESHOLD && primary.length > MODEL_PRIMARY_CAP) {
      const first = [...primary.filter((model) => model.isDefault), ...primary.filter((model) => modelKey(model) === selected && !model.isDefault)];
      const kept = [...first, ...primary.filter((model) => !first.includes(model))].slice(0, MODEL_PRIMARY_CAP);
      overflow = [...primary.filter((model) => !kept.includes(model)), ...overflow];
      primary = kept;
    }
    return { primary, overflow, showFast, ...(available.length > MODEL_SEARCH_THRESHOLD ? { searchable: true } : {}) };
  }
  return { primary: available.slice(0, 4), overflow: available.slice(4), showFast, ...(available.length > MODEL_SEARCH_THRESHOLD ? { searchable: true } : {}) };
}

/** The models whose name, description (OpenCode: the provider) or id hold every word of the query, best first. */
export function filterModels(models = [], query = "") {
  const words = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored = [];
  for (const model of Array.isArray(models) ? models : []) {
    const id = modelKey(model);
    if (typeof id !== "string") continue;
    const name = String(model.displayName || model.name || id).toLowerCase(), haystack = `${name} ${String(model.description ?? "").toLowerCase()} ${id.toLowerCase()}`;
    if (!words.every((word) => haystack.includes(word))) continue;
    scored.push({ model, score: name.startsWith(words[0]) ? 0 : name.includes(words[0]) ? 1 : 2 });
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, MODEL_SEARCH_LIMIT).map((entry) => entry.model);
}
