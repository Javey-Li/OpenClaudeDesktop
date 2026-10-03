// Composer usage trigger copy and context ring (2.2553.1).
// shared-14-BOJVa-jT.js:9700-9793: iT/oT/sT compact token format, dT thresholds
// (lT 75 / uT 90), pT fill vars, xT ring (yT 12, bT 2), ST summary.
// c360a9e1c-GPs-MV9u.js:4065-4295 hd/_d: ge tooltip, le ringPct, Se aria-label.
// The composer has no plan-limit meter (md planWindow/planPct/planResets), so
// fe/T are null locally and the tooltip detail (be joined by " · ") is empty;
// nothing is invented for it.

// shared-14 oT(e, sT): >=1e9 B; >=1e6 M (rolls to B at 1000M); >=1e3 k (rolls
// to M); else String(e). sT drops a trailing ".0".
const trimZero = (value) => (value.endsWith(".0") ? value.slice(0, -2) : value);
export function compactTokens(value) {
  if (value >= 1e9) return `${trimZero((value / 1e9).toFixed(1))}B`;
  if (value >= 1e6) {
    const millions = Number((value / 1e6).toFixed(1));
    return millions >= 1e3 ? `${trimZero((value / 1e9).toFixed(1))}B` : `${trimZero(millions.toFixed(1))}M`;
  }
  if (value >= 1e3) {
    const thousands = Number((value / 1e3).toFixed(1));
    return thousands >= 1e3 ? `${trimZero((value / 1e6).toFixed(1))}M` : `${trimZero(thousands.toFixed(1))}k`;
  }
  return String(value);
}

// shared-14 dT (critical >=90, warning >=75, else normal) mapped through hT to
// the CDS fill names; pT = va.fill.{accent,warning,danger}.cssVar.
export const CONTEXT_WARNING_PCT = 75, CONTEXT_CRITICAL_PCT = 90;
export function contextThreshold(pct) {
  return pct >= CONTEXT_CRITICAL_PCT ? "danger" : pct >= CONTEXT_WARNING_PCT ? "warning" : "accent";
}
export const contextRingStroke = (pct) => `var(--cds-fill-${contextThreshold(pct)})`;
// _d icon Xr trackStroke: an.alpha[2].cssVar.
export const CONTEXT_RING_TRACK = "var(--cds-alpha-2)";

// shared-14 xT: size yT 12, stroke bT 2, r=(size-stroke)/2, C=2πr,
// dashoffset C·(1−clamp(pct,0,100)/100).
export const CONTEXT_RING_SIZE = 12, CONTEXT_RING_STROKE = 2;
export function contextRingGeometry(pct, size = CONTEXT_RING_SIZE) {
  const radius = (size - CONTEXT_RING_STROKE) / 2, circumference = 2 * Math.PI * radius;
  return { size, stroke: CONTEXT_RING_STROKE, center: size / 2, radius, circumference,
    offset: circumference * (1 - Math.max(0, Math.min(100, pct)) / 100) };
}

// shared-14 ST(used, max, allowOver=false). hd passes allowOver only when the
// fetched report is fresh and live contextTokens is null (l===null&&v?.stale===!1);
// the app has no such report, so callers keep the default.
export function contextSummary(used, max, allowOver = false) {
  if (max === null || max === undefined || (used > max && !allowOver)) return { summary: compactTokens(used), contextPct: null };
  const pct = Math.round(Math.max(0, Math.min(1, used / max)) * 100);
  return { summary: `${compactTokens(used)} / ${compactTokens(max)} (${pct}%)`, contextPct: pct };
}

// hd: P = usage !== null; Y = !P && (sessionRef === null || spawnedFresh);
// ie = P || Y; K = live/usage tokens ?? 0; G = window ?? null;
// ge = ie ? 'Context {summary}' : 'Usage'; le = ie ? (contextPct ?? 0) : planPct ?? 0;
// Se = ie ? 'Usage: ' + formatList([ge, ...details], unit) : formatList([ge]).
// usage is the thread tokenUsage (thread/tokenUsage/updated): used =
// last.totalTokens, max = modelContextWindow. fresh = the composer has no
// session yet (sessionRef null); locally the draft/New composer.
export function usageTriggerCopy(usage, { fresh = false } = {}) {
  const used = usage?.last?.totalTokens;
  const hasUsage = Number.isFinite(used);
  if (!hasUsage && !fresh) return { tooltip: "Usage", ariaLabel: "Usage", ringPct: 0, contextPct: null, detail: null };
  const max = hasUsage && usage.modelContextWindow > 0 ? usage.modelContextWindow : null;
  const { summary, contextPct } = contextSummary(hasUsage ? used : 0, max);
  const tooltip = `Context ${summary}`, details = [];
  const parts = new Intl.ListFormat("en", { type: "unit" }).format([tooltip, ...details]);
  return { tooltip, ariaLabel: `Usage: ${parts}`, ringPct: contextPct ?? 0, contextPct, detail: details.length ? details.join(" · ") : null };
}

// Usage popover panel (c2d611398-m3q28S31.js I/V over c360a9e1c hd :4065-4232): contextMode = ie || re || c
// with ie = P || Y. Locally P is a thread tokenUsage report and Y the no-session draft; there is no remote
// "no data" branch (re) and no contextOnly surface (c), so V's noData copy never applies and the summary/pct
// are hd's Jr(K, G) over last.totalTokens (0 for the draft) / modelContextWindow.
export function usagePanelCopy(usage, { fresh = false } = {}) {
  const used = usage?.last?.totalTokens;
  const hasUsage = Number.isFinite(used);
  if (!hasUsage && !fresh) return { contextMode: false, summary: null, contextPct: null };
  const max = hasUsage && usage.modelContextWindow > 0 ? usage.modelContextWindow : null;
  return { contextMode: true, ...contextSummary(hasUsage ? used : 0, max) };
}

// Usage popover compact action (ion-dist cf6ae6197-cAiw4Nch.js Tw minPct 50 → bw/xw, Ow; c360a9e1c-GPs-MV9u.js
// :4136-4139 hd ae/oe → gd onCompact, :4225-4231 gd → Ga): below minPct (or with no pct) the row is hidden; while
// compacting it is hidden; a detached session gives 'Available when reconnected', an armed/responding turn
// 'Available when Claude finishes this turn' (the agent here is DeepSeek); otherwise the action is enabled. The
// 'Compacts automatically at {pct}%' hint (Cw) needs the core's auto-compact threshold, which is unknown locally.
export const COMPACT_MIN_PCT = 50;
export const COMPACT_REPLYING_REASON = "Available when DeepSeek finishes this turn";
export const COMPACT_RECONNECT_REASON = "Available when reconnected";
export function compactAction({ contextPct = null, running = false, connected = true, compacting = false, minPct = COMPACT_MIN_PCT } = {}) {
  if (contextPct === null || contextPct === undefined || !Number.isFinite(contextPct) || contextPct < minPct || compacting) return { kind: "hidden" };
  if (!connected) return { kind: "disabled", reason: COMPACT_RECONNECT_REASON };
  if (running) return { kind: "disabled", reason: COMPACT_REPLYING_REASON };
  return { kind: "enabled" };
}
