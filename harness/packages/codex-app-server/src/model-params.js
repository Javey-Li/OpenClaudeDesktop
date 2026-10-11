/**
 * Per-model request parameters from OpenClaude Desktop (Settings → Models): max
 * output tokens and temperature, sent by the app on thread/start,
 * thread/resume and turn/start as
 * params.codeDesktop.customization.modelParams = {[wireModelId]: {maxTokens?, temperature?}} | null
 * (customization.js applyCustomization stores it on the thread's ref).
 *
 * installModelParams adds an agent-scoped `agent/request` waterfall listener,
 * prepended so it is outermost and sees the model chosen by
 * installModelSelection, that rewrites the resolved LlmCallConfig of every request:
 *   - temperature: the entry's value, else removed (the adapter default);
 *   - maxTokens:   the entry's value; without one, the config's own value is
 *                  kept unless it is the value this listener set last time
 *                  (the logged header carries it into the next proposal).
 * The ref is read at every request, so a change applies from the next step.
 * dsh-llm's LlmCallConfig has no top_p, so none is offered.
 */

// The app's isModelId (prefs/model-settings.mjs): custom provider ids may carry `@` or `+`, catalog ids `( )`.
const MODEL_ID = /^[A-Za-z0-9_.:/()@+-]{1,128}$/
const MAX_ENTRIES = 50
export const MAX_TOKENS_MIN = 256
export const MAX_TOKENS_MAX = 1000000
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value)

/**
 * Bridge-side validation of the app's modelParams: finite values clamped to
 * the Settings ranges, unknown fields and malformed ids dropped.
 * @param {unknown} value
 * @returns {Record<string, {maxTokens?: number, temperature?: number}> | null}
 */
export function normalizeModelParams(value) {
  if (!isRecord(value)) return null
  const out = {}
  for (const [id, entry] of Object.entries(value)) {
    if (Object.keys(out).length >= MAX_ENTRIES) break
    if (id === '__proto__' || !MODEL_ID.test(id) || !isRecord(entry)) continue
    const params = {}
    if (typeof entry.maxTokens === 'number' && Number.isFinite(entry.maxTokens)) params.maxTokens = clamp(Math.floor(entry.maxTokens), MAX_TOKENS_MIN, MAX_TOKENS_MAX)
    if (typeof entry.temperature === 'number' && Number.isFinite(entry.temperature)) params.temperature = Math.round(clamp(entry.temperature, 0, 2) * 100) / 100
    if (Object.keys(params).length) out[id] = params
  }
  return Object.keys(out).length ? out : null
}

// The maxTokens each ref's listener last wrote, so removing the setting
// drops it from later requests instead of keeping it from the logged header.
const applied = new WeakMap()

/** The entry for a resolved config's (provider, model). */
export function modelParamsFor(ref, cfg, catalog) {
  const table = ref?.modelParams
  if (!isRecord(table) || !cfg) return undefined
  const wire = catalog?.wireId ? catalog.wireId(cfg.provider, cfg.model) : cfg.model
  for (const key of [wire, cfg.model, `${cfg.provider}/${cfg.model}`]) {
    if (typeof key === 'string' && Object.hasOwn(table, key)) return table[key]
  }
  return undefined
}

/**
 * Rewrite one resolved request config (exported for tests).
 * @param {{provider: string, model: string, temperature?: number, maxTokens?: number}} cfg
 * @param {object} ref - {modelParams}
 * @param {{wireId?: (provider: string, model: string) => string}} [catalog]
 */
export function applyModelParams(cfg, ref, catalog) {
  if (!cfg || typeof cfg !== 'object') return cfg
  const { temperature: _temperature, ...rest } = cfg
  const params = modelParamsFor(ref, cfg, catalog)
  const last = applied.get(ref)
  if (params?.maxTokens) {
    rest.maxTokens = params.maxTokens
    applied.set(ref, params.maxTokens)
  } else if (last !== undefined && rest.maxTokens === last) {
    // Kept until a value is set again: a request that fails before its header
    // is logged leaves the old value in the next proposal.
    delete rest.maxTokens
  }
  return params?.temperature != null ? { ...rest, temperature: params.temperature } : rest
}

/**
 * Couple a thread's customization ref to request routing.
 * @param {{on: Function}} agentCtx - the Agent's scoped context
 * @param {{modelParams?: object | null}} ref - mutable, owned by the thread
 * @param {{catalog?: {wireId: Function}}} [options]
 * @returns {() => void} disposer
 */
export function installModelParams(agentCtx, ref, { catalog } = {}) {
  // Prepended so this listener is outermost: cordis waterfalls run listeners
  // in registration order, so `await next()` then returns the config after
  // installModelSelection (registered earlier) has forced the thread's model.
  // Appended, it would see the seed proposal's (previous/default) model.
  return agentCtx.on('agent/request', async (_payload, next) => applyModelParams(await next(), ref, catalog), { prepend: true })
}
