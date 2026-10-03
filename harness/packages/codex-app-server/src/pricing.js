/**
 * DeepSeek official API prices, for the estimated cost on the Usage page
 * (account/usage/read `deepseek`, usage.js deepseekUsage). Pure.
 *
 * CNY per 1M tokens, off-peak / peak, from
 * https://api-docs.deepseek.com/zh-cn/quick_start/pricing (checked 2026-10-03):
 *
 *   model              cache-hit input   cache-miss input   output
 *   deepseek-flash     0.02 / 0.04       1 / 2              4 / 8
 *   deepseek-v4-pro    0.15 / 0.30       4.5 / 9            13.5 / 27
 *
 * The older ids deepseek-v4-flash and deepseek-v4-flash-vision-exp are billed
 * as deepseek-flash. Any other model has no price: its tokens still count, its
 * cost is unknown (null), never zero.
 *
 * Peak is Beijing time (UTC+8, no daylight saving) Monday–Friday 09:00–12:00
 * and 14:00–18:00; everything else is off-peak. Statutory holidays (and their
 * make-up working days) are ignored: a weekday holiday is priced as peak, so
 * the estimate can only err high there.
 *
 * Harness TokenUsage is disjoint: inputTokens is the uncached (cache-miss)
 * input, cacheReadTokens the cache hits, cacheWriteTokens input written to the
 * cache (DeepSeek bills it as a miss), outputTokens includes reasoning.
 */

export const PRICING_URL = 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing'

/** CNY per 1M tokens by canonical model id and tier. */
export const DEEPSEEK_PRICES = Object.freeze({
  'deepseek-flash': Object.freeze({
    displayName: '4.1 Flash',
    offPeak: Object.freeze({ cacheHit: 0.02, cacheMiss: 1, output: 4 }),
    peak: Object.freeze({ cacheHit: 0.04, cacheMiss: 2, output: 8 }),
  }),
  'deepseek-v4-pro': Object.freeze({
    displayName: '4 Pro',
    offPeak: Object.freeze({ cacheHit: 0.15, cacheMiss: 4.5, output: 13.5 }),
    peak: Object.freeze({ cacheHit: 0.3, cacheMiss: 9, output: 27 }),
  }),
})

const ALIASES = Object.freeze({ 'deepseek-v4-flash': 'deepseek-flash', 'deepseek-v4-flash-vision-exp': 'deepseek-flash' })

/** The canonical priced model id for a source model id, or null when DeepSeek publishes no price for it. */
export function pricedModel(model) {
  if (typeof model !== 'string') return null
  const id = model.trim().toLowerCase()
  if (Object.hasOwn(DEEPSEEK_PRICES, id)) return id
  return Object.hasOwn(ALIASES, id) ? ALIASES[id] : null
}

/** The display name the app uses for a model ('4.1 Flash', '4 Pro'), else the id itself. */
export function modelDisplayName(model) {
  const priced = pricedModel(model)
  return priced ? DEEPSEEK_PRICES[priced].displayName : model
}

const BEIJING_OFFSET_MS = 8 * 3600 * 1000

/** Whether an epoch-ms time falls in DeepSeek's peak window (Beijing Mon–Fri 09–12, 14–18). */
export function isPeakTime(time) {
  if (!Number.isFinite(time)) return false
  const beijing = new Date(time + BEIJING_OFFSET_MS)
  const weekday = beijing.getUTCDay()
  if (weekday === 0 || weekday === 6) return false
  const minute = beijing.getUTCHours() * 60 + beijing.getUTCMinutes()
  return (minute >= 9 * 60 && minute < 12 * 60) || (minute >= 14 * 60 && minute < 18 * 60)
}

/** 'peak' | 'offPeak' for an epoch-ms time. */
export const pricingTier = (time) => (isPeakTime(time) ? 'peak' : 'offPeak')

/**
 * CNY for one model and tier's token counts, by billing category (cache writes
 * are billed with cache-miss input). Null when the model has no price.
 * @param {string} model
 * @param {'peak' | 'offPeak'} tier
 * @param {{inputTokens?: number, cacheReadTokens?: number, cacheWriteTokens?: number, outputTokens?: number}} tokens
 * @returns {{input: number, cacheRead: number, output: number, total: number} | null}
 */
export function costCny(model, tier, { inputTokens = 0, cacheReadTokens = 0, cacheWriteTokens = 0, outputTokens = 0 } = {}) {
  const priced = pricedModel(model)
  const price = priced && DEEPSEEK_PRICES[priced][tier === 'peak' ? 'peak' : 'offPeak']
  if (!price) return null
  const input = ((inputTokens + cacheWriteTokens) * price.cacheMiss) / 1e6
  const cacheRead = (cacheReadTokens * price.cacheHit) / 1e6
  const output = (outputTokens * price.output) / 1e6
  return { input, cacheRead, output, total: input + cacheRead + output }
}
