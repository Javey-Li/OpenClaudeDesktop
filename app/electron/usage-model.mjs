// Codex 0.155.1 account/rateLimits/read: absent values are unavailable, never zero.
const finite = value => typeof value === 'number' && Number.isFinite(value);
const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const clamp = value => Math.max(0, Math.min(100, value));
export function usageVariant(used) { return used >= 90 ? 'danger' : used >= 75 ? 'warning' : 'accent'; }
export function usageWindowLabel(minutes, slot) {
 if (minutes === 300) return 'Current session';
 if (minutes === 10080) return 'This week';
 if (finite(minutes) && minutes > 0) {
  if (minutes % 1440 === 0) return `${minutes / 1440}-day limit`;
  if (minutes % 60 === 0) return `${minutes / 60}-hour limit`;
  return `${minutes}-minute limit`;
 }
 return slot === 'primary' ? 'Primary limit' : 'Secondary limit';
}
export function usageResetLabel(seconds, minutes, locale) {
 if (!finite(seconds)) return null;
 const date = new Date(seconds * 1000);
 if (!Number.isFinite(date.getTime())) return null;
 const time = date.toLocaleTimeString(locale, {hour:'numeric',minute:'2-digit'});
 if (minutes === 300) return `Resets at ${time}`;
 if (minutes === 10080) return `Resets ${date.toLocaleDateString(locale,{weekday:'long'})} ${time}`;
 return `Resets ${date.toLocaleString(locale,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}`;
}
// The empty limits copy. DeepSeek bills per token (coreEngine 'deepseek', boot.core
// engine 'deepseek-harness'): there is no plan limit to meter, not an outage.
export function usageEmptyText(engine) {
 return engine === 'deepseek' || engine === 'deepseek-harness' ? 'DeepSeek bills per token; there are no plan usage limits.' : 'Usage limits are unavailable for this account or connection.';
}
// The daily token table: the harness buckets (accountTokenUsage, ascending local YYYY-MM-DD keys) newest
// first, at most USAGE_DAILY_DAYS rows. Given todayKey it keeps the calendar days ending today, like the
// home card's 30d range (code-home.js Pw / home-model.mjs rangeCutoff), so 'Last 30 days' stays true.
export const USAGE_DAILY_DAYS = 30;
export const USAGE_DAILY_LABEL = 'Last 30 days';
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
function dayCutoff(todayKey, days) {
 if (typeof todayKey !== 'string' || !DAY_KEY.test(todayKey)) return null;
 const [year, month, day] = todayKey.split('-').map(Number), date = new Date(year, month - 1, day - (days - 1));
 return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function usagePresentation(data, {todayKey} = {}) {
 const limits = data?.limits;
 const map = limits?.rateLimitsByLimitId;
 const entries = map && typeof map === 'object' && !Array.isArray(map) && Object.keys(map).length
  ? Object.entries(map) : limits?.rateLimits ? [['codex', limits.rateLimits]] : [];
 const base = entries.find(([id, value]) => id === 'codex' || value?.limitId === 'codex');
 const rows = [], credits = [], spending = [];
 for (const [id, value] of entries) {
  if (!value || typeof value !== 'object') continue;
  const isBase = id === base?.[0];
  const name = text(value.limitName) || text(value.normalModelSlug) || id;
  for (const slot of ['primary', 'secondary']) {
   const window = value[slot];
   if (!finite(window?.usedPercent)) continue;
   const used = clamp(window.usedPercent), label = usageWindowLabel(window.windowDurationMins, slot);
   rows.push({key:`${id}:${slot}`, label:isBase ? label : `${name} · ${label}`, used,
    minutes:window.windowDurationMins, resetsAt:window.resetsAt, variant:usageVariant(used),
    description:isBase ? null : `Separate usage limit for ${name}`});
  }
  const credit = value.credits;
  if (credit && typeof credit === 'object') {
   const balance = text(credit.balance);
   const display = credit.unlimited === true ? 'Unlimited' : balance !== null ? balance
    : credit.hasCredits === true ? 'Available' : credit.hasCredits === false ? 'No credits available' : null;
   if (display !== null) credits.push({key:id, name:isBase ? null : name, balance:display});
  }
  const spend = value.individualLimit;
  if (spend && text(spend.limit) && text(spend.used)) spending.push({key:id,name:isBase?null:name,limit:spend.limit,used:spend.used,resetsAt:spend.resetsAt});
 }
 const rawPlan = text(data?.account?.account?.planType) || text(base?.[1]?.planType);
 const planLabels = {free:'Free',go:'Go',plus:'Plus',pro:'Pro',prolite:'Pro Lite',team:'Team',business:'Business',enterprise:'Enterprise',edu:'Edu',edu_plus:'Edu Plus',edu_pro:'Edu Pro'};
 const plan = rawPlan && rawPlan !== 'unknown' ? planLabels[rawPlan] || rawPlan.replaceAll('_',' ') : null;
 const buckets = Array.isArray(data?.tokenUsage?.dailyUsageBuckets) ? data.tokenUsage.dailyUsageBuckets : [];
 const cutoff = dayCutoff(todayKey, USAGE_DAILY_DAYS);
 const daily = buckets.filter(b => text(b?.startDate) && finite(b.tokens) && b.tokens >= 0 && (cutoff === null || (DAY_KEY.test(b.startDate) && b.startDate >= cutoff)))
  .sort((a, b) => a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0).slice(0, USAGE_DAILY_DAYS);
 const lifetime = data?.tokenUsage?.summary?.lifetimeTokens;
 const lifetimeTokens = finite(lifetime) && lifetime >= 0 ? lifetime : null;
 return {rows,credits,spending,plan,daily,dailyLabel:USAGE_DAILY_LABEL,lifetimeTokens};
}
