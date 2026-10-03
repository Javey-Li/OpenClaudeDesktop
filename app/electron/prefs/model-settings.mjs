// C5 model parameters and pricing (preferences.json key `modelSettings`).
// Pure: imported by the main process (settingsPatch, model-settings.cjs) and
// the renderer (Settings → Models, withEffortDefaults for the model menus).
//
//   params   {[modelId]: {maxTokens?, temperature?, effort?}}
//            maxTokens / temperature travel to the DeepSeek bridge as
//            params.codeDesktop.customization.modelParams (model-params.js);
//            effort only replaces the catalog's defaultReasoningEffort here.
//   prices   null (the official table) | {[modelId]: {displayName?, offPeak, peak}}
//            CNY per 1M tokens; account/usage/read gets it as
//            params.codeDesktop.prices (bridge pricing.js priceTable).
// top_p is not offered: no Harness LlmCallConfig field carries it.
export const MODEL_SETTINGS_DEFAULT = Object.freeze({ params: Object.freeze({}), prices: null });
export const DEFAULT = MODEL_SETTINGS_DEFAULT;
export const MAX_TOKENS_MIN = 256;
export const MAX_TOKENS_MAX = 1000000;
export const TEMPERATURE_MIN = 0;
export const TEMPERATURE_MAX = 2;
export const PRICE_MAX = 10000;
export const MAX_ENTRIES = 50;
export const DISPLAY_NAME_MAX = 60;
export const PRICE_TIERS = Object.freeze(['offPeak', 'peak']);
export const PRICE_FIELDS = Object.freeze(['cacheHit', 'cacheMiss', 'output']);
const MODEL_ID = /^[A-Za-z0-9_.:/-]{1,128}$/;
const EFFORT = /^[a-z0-9_-]{1,32}$/;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\x00-\x1f\x7f]/;
const isRecord = value => !!value && typeof value === 'object' && !Array.isArray(value);
const round = (value, places) => Math.round(value * 10 ** places) / 10 ** places;

export const isModelId = value => typeof value === 'string' && value !== '__proto__' && MODEL_ID.test(value);

/** One parameter's user-facing error, or null when the value is valid (undefined = unset). */
export function modelParamError(field, value) {
  if (value === undefined) return null;
  if (field === 'maxTokens') {
    if (!Number.isInteger(value) || value < MAX_TOKENS_MIN || value > MAX_TOKENS_MAX)
      return `Max output tokens must be a whole number from ${MAX_TOKENS_MIN} to ${MAX_TOKENS_MAX.toLocaleString('en-US')}.`;
    return null;
  }
  if (field === 'temperature') {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < TEMPERATURE_MIN || value > TEMPERATURE_MAX)
      return `Temperature must be a number from ${TEMPERATURE_MIN} to ${TEMPERATURE_MAX}.`;
    return null;
  }
  if (field === 'effort') return typeof value === 'string' && EFFORT.test(value) ? null : 'Choose a reasoning effort.';
  return 'Unknown model parameter.';
}

/** One price's user-facing error, or null. */
export function priceError(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= PRICE_MAX ? null
    : `Prices must be numbers from 0 to ${PRICE_MAX.toLocaleString('en-US')} CNY per 1M tokens.`;
}

function paramsEntry(value, strict) {
  if (!isRecord(value)) { if (strict) throw new Error('Invalid model parameters.'); return null; }
  const entry = {};
  for (const field of ['maxTokens', 'temperature', 'effort']) {
    const raw = value[field];
    if (raw === undefined || raw === null || raw === '') continue;
    const error = modelParamError(field, raw);
    if (error) { if (strict) throw new Error(error); continue; }
    entry[field] = field === 'temperature' ? round(raw, 2) : raw;
  }
  if (strict) for (const key of Object.keys(value)) if (!['maxTokens', 'temperature', 'effort'].includes(key)) throw new Error('Unknown model parameter.');
  return Object.keys(entry).length ? entry : null;
}

function priceEntry(value, strict) {
  const fail = message => { if (strict) throw new Error(message); return null; };
  if (!isRecord(value)) return fail('Invalid price.');
  const entry = {};
  if (value.displayName !== undefined && value.displayName !== '') {
    const name = typeof value.displayName === 'string' ? value.displayName.trim() : null;
    if (name === null || name.length > DISPLAY_NAME_MAX || CONTROL.test(name)) {
      if (strict) throw new Error(`Model names must be ${DISPLAY_NAME_MAX} characters or fewer.`);
    } else if (name) entry.displayName = name;
  }
  for (const tier of PRICE_TIERS) {
    if (!isRecord(value[tier])) return fail('Every price needs off-peak and peak values.');
    const prices = {};
    for (const field of PRICE_FIELDS) {
      const error = priceError(value[tier][field]);
      if (error) return fail(error);
      prices[field] = round(value[tier][field], 6);
    }
    entry[tier] = prices;
  }
  return entry;
}

function modelMap(value, entryOf, strict, label) {
  if (!isRecord(value)) { if (strict) throw new Error(`Invalid ${label}.`); return {}; }
  const keys = Object.keys(value);
  if (strict && keys.length > MAX_ENTRIES) throw new Error(`Use ${MAX_ENTRIES} models or fewer.`);
  const out = {};
  for (const key of keys) {
    if (Object.keys(out).length >= MAX_ENTRIES) break;
    if (!isModelId(key)) { if (strict) throw new Error('Model ids may use letters, digits and . _ : / - only (128 characters at most).'); continue; }
    const entry = entryOf(value[key], strict);
    if (entry) out[key] = entry;
  }
  return out;
}

/** Lenient read: always a valid {params, prices}. */
export function normalize(value) {
  const input = isRecord(value) ? value : {};
  const prices = isRecord(input.prices) ? modelMap(input.prices, priceEntry, false, 'prices') : null;
  return { params: modelMap(input.params, paramsEntry, false, 'model parameters'), prices: prices && Object.keys(prices).length ? prices : null };
}

/** Strict write check: throws a user-facing Error; null resets to the default. */
export function validate(value) {
  if (value === null) return null;
  if (!isRecord(value)) throw new Error('Invalid model settings.');
  for (const key of Object.keys(value)) if (key !== 'params' && key !== 'prices') throw new Error('Invalid model settings.');
  const params = value.params === undefined ? {} : modelMap(value.params, paramsEntry, true, 'model parameters');
  const prices = value.prices === undefined || value.prices === null ? null : modelMap(value.prices, priceEntry, true, 'prices');
  return { params, prices: prices && Object.keys(prices).length ? prices : null };
}
export const validateModelSettings = validate;
export const normalizeModelSettings = normalize;

/**
 * Catalog models with the user's default effort: an entry's
 * defaultReasoningEffort becomes params[m.model].effort when that effort is
 * one of its supportedReasoningEfforts. Unchanged entries keep their identity.
 */
export function withEffortDefaults(models, modelSettings) {
  const list = Array.isArray(models) ? models : [];
  const params = normalize(modelSettings).params;
  if (!Object.keys(params).length) return list;
  return list.map(model => {
    const effort = model && Object.hasOwn(params, model.model) ? params[model.model].effort : undefined;
    if (!effort || effort === model.defaultReasoningEffort) return model;
    const supported = (model.supportedReasoningEfforts || []).some(item => (item?.reasoningEffort ?? item) === effort);
    return supported ? { ...model, defaultReasoningEffort: effort } : model;
  });
}

/** {[wireModelId]: {maxTokens?, temperature?}} for the bridge, or null when nothing applies. */
export function modelParamsForCore(modelSettings) {
  const out = {};
  for (const [id, entry] of Object.entries(normalize(modelSettings).params)) {
    const core = {};
    if (entry.maxTokens !== undefined) core.maxTokens = entry.maxTokens;
    if (entry.temperature !== undefined) core.temperature = entry.temperature;
    if (Object.keys(core).length) out[id] = core;
  }
  return Object.keys(out).length ? out : null;
}

/** The price overrides for account/usage/read, or null for the official table. */
export function pricesForCore(modelSettings) {
  return normalize(modelSettings).prices;
}

/** A copy of an official table ({[id]: {displayName?, offPeak, peak}}) in the prefs shape. */
export function pricesFromOfficial(official) {
  return modelMap(official, priceEntry, false, 'prices');
}

// ---- Settings → Models edits (pure; each returns the next modelSettings or null for the default)

const compact = settings => {
  const next = normalize(settings);
  return Object.keys(next.params).length || next.prices ? next : null;
};

/** Text of a number field → number, undefined (empty) or NaN (not a number). */
export function parseNumberInput(text) {
  const value = String(text ?? '').trim();
  if (!value) return undefined;
  return /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(value) ? Number(value) : NaN;
}

/** Set or clear (undefined) one parameter of one model; throws a user-facing Error when invalid. */
export function setModelParam(settings, modelId, field, value) {
  if (!isModelId(modelId)) throw new Error('Invalid model.');
  const error = modelParamError(field, value);
  if (error) throw new Error(error);
  const current = normalize(settings);
  const entry = { ...(current.params[modelId] || {}) };
  if (value === undefined || value === '') delete entry[field];
  else entry[field] = field === 'temperature' ? round(value, 2) : value;
  const params = { ...current.params };
  if (Object.keys(entry).length) params[modelId] = entry; else delete params[modelId];
  return compact({ ...current, params });
}

/** The price table the page shows: the overrides, else a copy of the official table. */
export function effectivePrices(settings, official) {
  return normalize(settings).prices ?? pricesFromOfficial(official);
}

/** Change one price; the first edit copies the official table into prices. */
export function setPrice(settings, official, modelId, tier, field, value) {
  if (!PRICE_TIERS.includes(tier) || !PRICE_FIELDS.includes(field)) throw new Error('Invalid price.');
  const error = priceError(value);
  if (error) throw new Error(error);
  const prices = effectivePrices(settings, official);
  if (!prices[modelId]) throw new Error('Invalid model.');
  const entry = prices[modelId];
  return compact({ ...normalize(settings), prices: { ...prices, [modelId]: { ...entry, [tier]: { ...entry[tier], [field]: round(value, 6) } } } });
}

/** Add a model with zero prices (to be edited); throws a user-facing Error. */
export function addPrice(settings, official, modelId, displayName = '') {
  const id = String(modelId ?? '').trim();
  if (!isModelId(id)) throw new Error('Model ids may use letters, digits and . _ : / - only (128 characters at most).');
  const prices = effectivePrices(settings, official);
  if (prices[id]) throw new Error('That model already has a price.');
  if (Object.keys(prices).length >= MAX_ENTRIES) throw new Error(`Use ${MAX_ENTRIES} models or fewer.`);
  const name = String(displayName ?? '').trim();
  if (name.length > DISPLAY_NAME_MAX || CONTROL.test(name)) throw new Error(`Model names must be ${DISPLAY_NAME_MAX} characters or fewer.`);
  const zero = { cacheHit: 0, cacheMiss: 0, output: 0 };
  return compact({ ...normalize(settings), prices: { ...prices, [id]: { ...(name ? { displayName: name } : {}), offPeak: { ...zero }, peak: { ...zero } } } });
}

/** Remove one model's price. */
export function removePrice(settings, official, modelId) {
  const prices = { ...effectivePrices(settings, official) };
  delete prices[modelId];
  return compact({ ...normalize(settings), prices });
}

/** Back to the official table (prices null). */
export function resetPrices(settings) {
  return compact({ ...normalize(settings), prices: null });
}

/** Whether a model's prices differ from the official entry (an added model always does). */
export function priceEdited(prices, official, modelId) {
  const entry = prices?.[modelId], base = official?.[modelId];
  if (!entry) return false;
  if (!base) return true;
  return PRICE_TIERS.some(tier => PRICE_FIELDS.some(field => entry[tier]?.[field] !== base[tier]?.[field]));
}

// ---- Custom OpenAI-compatible providers (DeepSeek core only)
// The Harness already ships the dormant `llm-pi-ai` adapter row (dsh-base);
// its config `providers: {[route]: {displayName, api, baseURL, apiKeyEnv, models}}`
// turns routes on. Code Desktop writes that one row through Settings › Harness's
// managed overlay (harness-profile.cjs) and exports each key to the core
// process as CODE_DESKTOP_PROVIDER_KEY_<ROUTE>; the key itself is stored
// encrypted (Electron safeStorage), never in preferences.json or ~/.dsh.
export const PROVIDER_PROTOCOLS = Object.freeze(['openai-completions', 'openai-responses', 'anthropic-messages']);
export const PROVIDER_ROW_ID = 'llm-pi-ai';
export const MAX_PROVIDERS = 8;
const ROUTE = /^[a-z0-9][a-z0-9-]{0,31}$/;
const PROVIDER_MODEL = /^[A-Za-z0-9_.:/@+-]{1,128}$/;
const RESERVED_ROUTES = new Set(['deepseek']);

/** The env var the core reads a route's key from. */
export const providerKeyEnv = route => `CODE_DESKTOP_PROVIDER_KEY_${String(route).toUpperCase().replace(/-/g, '_')}`;

/** Strict check of one provider definition (no key); throws a user-facing Error. */
export function validateProvider(value) {
  if (!isRecord(value)) throw new Error('Invalid provider.');
  const route = String(value.route ?? '').trim();
  if (!ROUTE.test(route)) throw new Error('Provider ids use lowercase letters, digits and - (32 characters at most).');
  if (RESERVED_ROUTES.has(route)) throw new Error('“deepseek” is the built-in DeepSeek provider. Choose another id.');
  const displayName = String(value.displayName ?? '').trim();
  if (displayName.length > DISPLAY_NAME_MAX || CONTROL.test(displayName)) throw new Error(`Provider names must be ${DISPLAY_NAME_MAX} characters or fewer.`);
  const api = value.api ?? PROVIDER_PROTOCOLS[0];
  if (!PROVIDER_PROTOCOLS.includes(api)) throw new Error('Choose a protocol.');
  const baseURL = String(value.baseURL ?? '').trim();
  let url;
  try { url = new URL(baseURL); } catch { throw new Error('Enter the endpoint URL, e.g. https://api.example.com/v1.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('The endpoint must be an http(s) URL without credentials.');
  const models = (Array.isArray(value.models) ? value.models : String(value.models ?? '').split(/[\s,]+/))
    .map(id => String(id).trim()).filter(Boolean);
  if (!models.length) throw new Error('List at least one model id.');
  if (models.length > MAX_ENTRIES) throw new Error(`Use ${MAX_ENTRIES} models or fewer.`);
  for (const id of models) if (!PROVIDER_MODEL.test(id)) throw new Error(`Invalid model id: ${id.slice(0, 40)}`);
  return { route, ...(displayName ? { displayName } : {}), api, baseURL, models: [...new Set(models)] };
}

/** Lenient read of the stored provider list. */
export function normalizeProviders(value) {
  const out = [];
  for (const item of Array.isArray(value) ? value : []) {
    if (out.length >= MAX_PROVIDERS) break;
    try { const provider = validateProvider(item); if (!out.some(other => other.route === provider.route)) out.push(provider); } catch {}
  }
  return out;
}

/** The managed `llm-pi-ai` overlay row for the providers, or null to remove it. */
export function providerOverlayRow(providers) {
  const list = normalizeProviders(providers);
  if (!list.length) return null;
  return { config: { providers: Object.fromEntries(list.map(provider => [provider.route, {
    ...(provider.displayName ? { displayName: provider.displayName } : {}),
    api: provider.api, baseURL: provider.baseURL, apiKeyEnv: providerKeyEnv(provider.route),
    models: provider.models.map(id => ({ id })),
  }])) } };
}
