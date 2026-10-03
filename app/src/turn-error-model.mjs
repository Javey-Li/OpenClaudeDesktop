import { t } from "../electron/i18n/index.mjs";
// Failed-turn presentation for Codex TurnError (work/codex-schema-0.155.1/ts/v2/
// TurnError.ts {message, codexErrorInfo, additionalDetails, misalignment};
// CodexErrorInfo.ts). Copy is the 2.2553.1 source category table
// c1298b0ba-OvgggNMF.js Z (headline/markerLabel/hint/retryHelps) with its
// message tables shared-18 _r/xr/Sr, c1298 Y/X and shared-9 Q/$ (usage limit).
// Pure: no clock, no request, no persistence.

// Source categories reachable from Codex (billing only from DeepSeek failure
// codes). Every mapping is a documented Codex adaptation: Codex reports a
// closed CodexErrorInfo enum, not the Anthropic API error codes/texts the
// source classifier (shared-9 NF) reads.
export const TURN_ERROR_CATEGORIES = Object.freeze([
  "rate_limit", "server_rate_limit", "overloaded", "server_error", "network",
  "auth", "context_length", "invalid_request", "billing", "output_token_limit", "unknown",
]);

// DeepSeek Harness failure codes (LlmFailure.code) the bridge keeps in
// additionalDetails. CodexErrorInfo alone cannot tell an exhausted DeepSeek
// balance (usageLimitExceeded + QUOTA) from a Codex plan limit, nor a
// DeepSeek key from a ChatGPT sign-in.
const DEEPSEEK_BILLING_CODES = ["QUOTA", "ACCOUNT_QUOTA"];
const DEEPSEEK_AUTH_CODES = ["AUTH", "INVALID_CREDENTIAL", "MISSING_CREDENTIAL"];
export const DEEPSEEK_AUTH_HINT = t("Check your DeepSeek API key in DeepSeek Harness settings.");

const NETWORK_VARIANTS = ["httpConnectionFailed", "responseStreamConnectionFailed", "responseStreamDisconnected", "responseTooManyFailedAttempts"];
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

// CodexErrorInfo -> source category.
export function classifyTurnError(info) {
  if (typeof info === "string") switch (info) {
    // Codex plan quota / session budget: the source's usage-limit card is
    // category rate_limit (shared-9 tF "You've reached your" -> rate_limit,
    // headline from aF/XP.generic).
    case "usageLimitExceeded": case "sessionBudgetExceeded": return "rate_limit";
    // Codex request throttling: the source maps the API error code rate_limit
    // to server_rate_limit (shared-9 bF), not to the usage-limit card.
    case "rateLimitExceeded": return "server_rate_limit";
    case "serverOverloaded": return "overloaded";          // bF overloaded
    case "internalServerError": return "server_error";     // bF server_error
    case "unauthorized": return "auth";                    // bF authentication_failed
    case "contextWindowExceeded": return "context_length";
    case "badRequest": return "invalid_request";           // bF invalid_request
    // cyberPolicy / misalignmentPolicyViolation / sandboxError /
    // threadRollbackFailed / other: no source category states the same cause.
    default: return "unknown";
  }
  // Object variants carry {httpStatusCode}; every one is a transport failure.
  if (info && typeof info === "object" && NETWORK_VARIANTS.some((key) => own(info, key))) return "network";
  return "unknown";
}

// shared-9 OF: rate_limit (and extra_usage_required) use the usage icon.
export function turnErrorIcon(category) {
  return category === "rate_limit" ? "usage" : "warning";
}
// shared-21 TE/EE (scroll-messages Ze/He, approval-shared Ce/be).
export const TURN_ERROR_ICONS = Object.freeze({
  warning: Object.freeze({ name: "Warning", tone: "danger" }),
  usage: Object.freeze({ name: "UsageGaugeHigh", tone: "danger" }),
});

// Source table Z. Hints use the source's no-rewind branch (hintNoRewind):
// c1298 xe picks it whenever canRewind is false, and this app has no rewind
// (the card's Compact session action does not change the hint). Documented
// adaptations are marked inline.
const TABLE = Object.freeze({
  rate_limit: { headline: t("Usage limit reached"), // shared-9 Q.generic
    // $.generic: no reset time, TurnError carries no resetsAt.
    hint: t("You’ve reached your usage limit. Try again after your limit resets."), retryHelps: true },
  server_rate_limit: { headline: t("Server is temporarily limiting requests"), markerLabel: t("Server was temporarily limiting requests"),
    hint: t("Too many requests right now — try again in a moment."), retryHelps: true },
  overloaded: { headline: t("Service is busy"), markerLabel: t("Service was busy"),
    hint: t("Try again in a moment, or switch to a different model."), retryHelps: true },
  // Sr.serverError continues "If it keeps happening, check {statusUrl}." — the
  // Anthropic status page says nothing about the Codex backend, so it is cut.
  server_error: { headline: t("Server error"),
    hint: t("The server returned an error while handling this message. It’s usually temporary."), retryHelps: true },
  network: { headline: t("Connection problem"), hint: t("Check your internet connection, VPN, or proxy and try again."), retryHelps: true },
  auth: { headline: t("Authentication failed"), hint: t("Sign in again to continue."), retryHelps: false },
  // X.contextLengthNoRewind: the Compact/Rewind hint names card actions this app lacks.
  context_length: { headline: t("Your context window is full"), markerLabel: t("Context window was full"),
    hint: t("This chat is too long to continue. Start a new chat."), retryHelps: false },
  invalid_request: { headline: t("Invalid request"), hint: t("The request couldn’t be completed."), retryHelps: false },
  // Source billing (shared-18 _r.billing, c1298 X.billing "Add credits or
  // update billing to continue."): the hint names the DeepSeek balance, the
  // only billing a DeepSeek failure can mean.
  billing: { headline: t("Billing issue"), hint: t("Add credits to your DeepSeek balance to continue."), retryHelps: false },
  // Z.output_token_limit (shared-18 _r.outputTokenLimit, c1298 X.outputTokenLimit
  // "Ask Claude to continue, …"): the hint names DeepSeek.
  output_token_limit: { headline: t("Response exceeded the output limit"),
    hint: t("Ask DeepSeek to continue, or break the task into smaller steps."), retryHelps: true },
  unknown: { headline: t("An API error occurred"), hint: t("Try sending your message again."), retryHelps: true },
});

// shared-9 AF: an HTTP status named in the message text.
function textStatus(message) {
  const match = /(?:API error:?|HTTP(?:\/\d(?:\.\d)?)?|status(?:\s*code)?:?)\s*(4\d{2}|5\d{2})\b/i.exec(message || "");
  return match ? Number(match[1]) : undefined;
}
// CodexErrorInfo object variants forward the upstream status.
export function turnErrorStatus(info) {
  if (!info || typeof info !== "object") return undefined;
  for (const value of Object.values(info))
    if (value && Number.isInteger(value.httpStatusCode)) return value.httpStatusCode;
  return undefined;
}

// c1298 xe for one category: unknown retries only for no status / 429 / 5xx
// (shared-18 Br), otherwise its hint becomes X.invalidRequest.
export function presentTurnError(category, { message = "" } = {}) {
  const key = own(TABLE, category) ? category : "unknown";
  const row = TABLE[key];
  let { hint, retryHelps } = row;
  if (key === "unknown") {
    const status = textStatus(message);
    retryHelps = status === undefined || status === 429 || status >= 500;
    if (!retryHelps) hint = TABLE.invalid_request.hint;
  }
  // c1298 xe recovery flags: compactHelps for context_length, modelSwitchHelps
  // for overloaded (model_not_found / model_requires_strict_sandbox have no
  // Codex identity here).
  return Object.freeze({ category: key, headline: row.headline, markerLabel: row.markerLabel ?? row.headline, hint, retryHelps,
    compactHelps: key === "context_length", modelSwitchHelps: key === "overloaded", icon: turnErrorIcon(key) });
}

// The category for a whole TurnError: a DeepSeek quota code is billing
// whatever CodexErrorInfo says; everything else classifies by CodexErrorInfo.
// The DeepSeek bridge marks a Harness 'max-tokens' turn end with
// additionalDetails MAX_TOKENS (projection.js turnError).
export const OUTPUT_LIMIT_DETAILS = "MAX_TOKENS";
export function turnErrorCategory(error) {
  if (DEEPSEEK_BILLING_CODES.includes(error?.additionalDetails)) return "billing";
  if (error?.additionalDetails === OUTPUT_LIMIT_DETAILS) return "output_token_limit";
  return classifyTurnError(error?.codexErrorInfo ?? null);
}

export function describeTurnError(error) {
  const view = presentTurnError(turnErrorCategory(error), { message: error?.message });
  // A DeepSeek key, not a ChatGPT sign-in: login is not offered on that core.
  if (view.category === "auth" && DEEPSEEK_AUTH_CODES.includes(error?.additionalDetails))
    return Object.freeze({ ...view, hint: DEEPSEEK_AUTH_HINT });
  return view;
}

// Rp/zp details body. The source joins sections with blank lines (c1298 se).
// Codex adaptation: every category keeps "View details" (source G/K would drop
// it for rate_limit/overloaded/server_error/auth/context_length) because
// Codex's message is the only carrier of specifics such as a reset time.
// output_token_limit follows the source verdict (c1298 G "drop"): its message is
// the headline and MAX_TOKENS is a bridge marker, so it has no details.
export function turnErrorDetails(error) {
  if (turnErrorCategory(error) === "output_token_limit") return "";
  return [error?.message, error?.additionalDetails]
    .filter((part) => typeof part === "string" && part.trim()).map((part) => part.trim()).join("\n\n");
}

// c4a9ee384 sn(error, intl, "short") for the apiRetry status row. The table is
// keyed by the API error type; Codex's closest identities are mapped here.
export function retryShortLabel(info) {
  if (info === "unauthorized") return t("Authentication failed");
  if (info === "rateLimitExceeded" || info === "usageLimitExceeded" || info === "sessionBudgetExceeded") return t("Rate limited");
  if (info === "serverOverloaded") return t("Model overloaded");
  return t("Request failed");
}

export function normalizeTurnError(error) {
  if (!error || typeof error !== "object") return null;
  const message = typeof error.message === "string" && error.message ? error.message : t("DeepSeek reported an error.");
  return {
    message,
    codexErrorInfo: error.codexErrorInfo ?? null,
    additionalDetails: typeof error.additionalDetails === "string" ? error.additionalDetails : null,
  };
}

// scroll-messages-current.js:56485-56503: the newest error of the LAST entry
// renders the full card (ehe/YY), every other error the compact marker (JY).
// Here a turn is an entry: the card belongs to a failed turn only while it is
// the session's latest turn and nothing newer is running.
export function turnErrorPlacements(items, turnErrors, { activeTurnId = null } = {}) {
  const out = new Map();
  if (!turnErrors) return out;
  let latest = null;
  for (const item of items || []) if (item?.turnId) latest = item.turnId;
  if (activeTurnId) latest = activeTurnId;
  for (const turnId of new Set((items || []).map((item) => item?.turnId).filter(Boolean)))
    if (own(turnErrors, turnId) && turnErrors[turnId]) out.set(turnId, turnId === latest ? "card" : "marker");
  return out;
}

// Retry resends the failed turn's own user input through turn/start. Only a
// text-only userMessage can be replayed faithfully (image/localImage/skill/
// mention inputs may reference files that no longer exist), so anything else
// omits the action.
export function retryInput(items, turnId) {
  const user = (items || []).find((item) => item?.turnId === turnId && item.type === "userMessage");
  const content = Array.isArray(user?.content) ? user.content : [];
  if (!content.length || !content.every((part) => part?.type === "text" && typeof part.text === "string")) return null;
  if (!content.some((part) => part.text.trim())) return null;
  return content.map((part) => ({ type: "text", text: part.text, text_elements: Array.isArray(part.text_elements) ? part.text_elements : [] }));
}
