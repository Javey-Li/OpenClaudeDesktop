// The DeepSeek Usage page: account/usage/read's bridge extension `deepseek` (harness usage.js deepseekUsage,
// estimated CNY at DeepSeek's official peak/off-peak prices) as tiles, a cost breakdown, models and days.
// Absent or malformed (the Codex core, fixtures) -> null, and SourceUsage keeps the Codex layout.
import { compactTokens, formatDayKey } from "./home-model.mjs";
import { t } from "../electron/i18n/index.mjs";

export const COST_DAILY_DAYS = 30;
export const COST_FOOTNOTE = "按 DeepSeek 官方价格估算（峰谷分时），实际以 DeepSeek 平台账单为准";
// account/usage/read deepseek.customPrices: the estimate used the prices from Settings › Models.
export const CUSTOM_COST_FOOTNOTE = "按你在 Settings › Models 中设置的价格估算，实际以 DeepSeek 平台账单为准";
export const DEEPSEEK_USAGE_URL = "https://platform.deepseek.com/usage";
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const count = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : 0);
const money = (value) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null);
const isRecord = (value) => !!value && typeof value === "object" && !Array.isArray(value);

/** ¥ with 2 decimals, 4 below ¥0.01 (never a misleading ¥0.00 for real spend); null -> "—". */
export function formatCny(value, locale) {
  const amount = money(value);
  if (amount === null) return "—";
  const digits = amount > 0 && amount < 0.01 ? 4 : 2;
  return `¥${amount.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
/** Exact count for titles/tooltips. */
export const formatTokenCount = (value, locale) => new Intl.NumberFormat(locale).format(count(value));

function totals(value) {
  if (!isRecord(value)) return null;
  const inputTokens = count(value.inputTokens), cacheReadTokens = count(value.cacheReadTokens),
    cacheWriteTokens = count(value.cacheWriteTokens), outputTokens = count(value.outputTokens);
  return {
    tokens: count(value.tokens), inputTokens, cacheReadTokens, cacheWriteTokens, outputTokens,
    unpricedTokens: count(value.unpricedTokens), costCny: money(value.costCny),
    inputCostCny: money(value.inputCostCny), cacheReadCostCny: money(value.cacheReadCostCny), outputCostCny: money(value.outputCostCny),
  };
}
function dayCutoff(todayKey, days) {
  if (typeof todayKey !== "string" || !DAY_KEY.test(todayKey)) return null;
  const [year, month, day] = todayKey.split("-").map(Number), date = new Date(year, month - 1, day - (days - 1));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
const share = (part, whole) => (whole > 0 ? Math.max(0, Math.min(1, part / whole)) : 0);

/**
 * @returns {null | {
 *   tiles: {key: string, label: string, tokens: number, cost: number | null, partial: boolean}[],
 *   categories: {key: string, label: string, tokens: number, cost: number | null, share: number}[],
 *   categoryBasis: 'cost' | 'tokens',
 *   models: {key: string, name: string, tokens: number, cost: number | null, share: number}[],
 *   daily: {date: string, label: string, tokens: number, cost: number | null, share: number}[],
 *   partial: boolean, customPrices: boolean, usageUrl: string,
 * }}
 */
export function deepseekCostPresentation(data, { todayKey, locale } = {}) {
  const source = data?.tokenUsage?.deepseek;
  if (!isRecord(source)) return null;
  const all = totals(source.allTime), recent = totals(source.last30Days), today = totals(source.today);
  if (!all || !recent || !today) return null;
  const tile = (key, label, value) => ({ key, label, tokens: value.tokens, cost: value.costCny, partial: value.unpricedTokens > 0 && value.costCny !== null });
  const tiles = [tile("all", t("Total tokens"), all), tile("30d", t("Last 30 days"), recent), tile("today", t("Today"), today)];
  // Where the cost goes (all time): cache writes are billed as cache-miss input, so they join Input.
  const pricedTotal = all.costCny ?? 0;
  const categoryBasis = pricedTotal > 0 ? "cost" : "tokens";
  const categories = [
    { key: "input", label: t("Input"), tokens: all.inputTokens + all.cacheWriteTokens, cost: all.inputCostCny },
    { key: "cached", label: t("Cached input"), tokens: all.cacheReadTokens, cost: all.cacheReadCostCny },
    { key: "output", label: t("Output"), tokens: all.outputTokens, cost: all.outputCostCny },
  ].map((entry) => ({ ...entry, share: categoryBasis === "cost" ? share(entry.cost ?? 0, pricedTotal) : share(entry.tokens, all.tokens) }));
  const models = (Array.isArray(source.models) ? source.models : [])
    .filter((entry) => isRecord(entry) && typeof entry.model === "string" && count(entry.tokens) > 0)
    .map((entry) => ({ key: entry.model, name: typeof entry.displayName === "string" && entry.displayName.trim() ? entry.displayName.trim() : entry.model,
      tokens: count(entry.tokens), cost: money(entry.costCny) }))
    .sort((left, right) => right.tokens - left.tokens);
  const modelMax = models.reduce((max, entry) => Math.max(max, entry.tokens), 0);
  const cutoff = dayCutoff(todayKey, COST_DAILY_DAYS);
  const days = (Array.isArray(source.daily) ? source.daily : [])
    .filter((entry) => isRecord(entry) && typeof entry.date === "string" && DAY_KEY.test(entry.date) && count(entry.tokens) > 0
      && (cutoff === null || (entry.date >= cutoff && entry.date <= todayKey)))
    .sort((left, right) => (left.date < right.date ? 1 : left.date > right.date ? -1 : 0))
    .slice(0, COST_DAILY_DAYS);
  const dayMax = days.reduce((max, entry) => Math.max(max, count(entry.tokens)), 0);
  const usageUrl = typeof data?.account?.deepseek?.links?.usageUrl === "string" && /^https:\/\/platform\.deepseek\.com\//.test(data.account.deepseek.links.usageUrl)
    ? data.account.deepseek.links.usageUrl : DEEPSEEK_USAGE_URL;
  return {
    tiles,
    categories,
    categoryBasis,
    models: models.map((entry) => ({ ...entry, share: share(entry.tokens, modelMax) })),
    daily: days.map((entry) => ({ date: entry.date, label: formatDayKey(entry.date, locale), tokens: count(entry.tokens), cost: money(entry.costCny), share: share(count(entry.tokens), dayMax) })),
    partial: all.unpricedTokens > 0,
    customPrices: source.customPrices === true,
    usageUrl,
  };
}

export { compactTokens };
