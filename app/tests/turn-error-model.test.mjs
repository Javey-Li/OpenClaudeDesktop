import test from "node:test";
import assert from "node:assert/strict";
import { classifyTurnError, describeTurnError, DEEPSEEK_AUTH_HINT, presentTurnError, TURN_ERROR_CATEGORIES, turnErrorCategory, retryInput, retryShortLabel, turnErrorDetails, turnErrorPlacements, turnErrorStatus, TURN_ERROR_ICONS } from "../src/turn-error-model.mjs";
import { emptyState, latestTurnError, reduce } from "../src/state.js";
import { transcriptStatusPresentation as status } from "../src/transcript-status-model.mjs";
import { sessionState } from "../src/sidebar-model.js";

test("every CodexErrorInfo variant maps to a source category (c1298b0ba Z)", () => {
  const expected = {
    usageLimitExceeded: "rate_limit", sessionBudgetExceeded: "rate_limit", rateLimitExceeded: "server_rate_limit",
    serverOverloaded: "overloaded", internalServerError: "server_error", unauthorized: "auth",
    contextWindowExceeded: "context_length", badRequest: "invalid_request",
    cyberPolicy: "unknown", misalignmentPolicyViolation: "unknown", threadRollbackFailed: "unknown", sandboxError: "unknown", other: "unknown",
  };
  for (const [info, category] of Object.entries(expected)) assert.equal(classifyTurnError(info), category, info);
  for (const key of ["httpConnectionFailed", "responseStreamConnectionFailed", "responseStreamDisconnected", "responseTooManyFailedAttempts"])
    assert.equal(classifyTurnError({ [key]: { httpStatusCode: 502 } }), "network", key);
  assert.equal(classifyTurnError({ activeTurnNotSteerable: { turnKind: "review" } }), "unknown");
  for (const value of [null, undefined, "", "__proto__", 42, {}, []]) assert.equal(classifyTurnError(value), "unknown");
});

test("presentation copies the source strings and retry/icon rules", () => {
  assert.deepEqual({ ...presentTurnError("rate_limit") }, { category: "rate_limit", headline: "Usage limit reached", markerLabel: "Usage limit reached",
    hint: "You’ve reached your usage limit. Try again after your limit resets.", retryHelps: true, compactHelps: false, modelSwitchHelps: false, icon: "usage" });
  assert.deepEqual({ ...presentTurnError("overloaded") }, { category: "overloaded", headline: "Service is busy", markerLabel: "Service was busy",
    hint: "Try again in a moment, or switch to a different model.", retryHelps: true, compactHelps: false, modelSwitchHelps: true, icon: "warning" });
  assert.equal(presentTurnError("server_rate_limit").markerLabel, "Server was temporarily limiting requests");
  assert.equal(presentTurnError("server_rate_limit").hint, "Too many requests right now — try again in a moment.");
  assert.equal(presentTurnError("context_length").hint, "This chat is too long to continue. Start a new chat.");
  assert.equal(presentTurnError("context_length").markerLabel, "Context window was full");
  assert.equal(presentTurnError("context_length").retryHelps, false);
  assert.equal(presentTurnError("auth").retryHelps, false);
  assert.equal(presentTurnError("invalid_request").retryHelps, false);
  assert.equal(presentTurnError("network").headline, "Connection problem");
  assert.doesNotMatch(presentTurnError("server_error").hint, /statusUrl|status\.|check \{/);
  assert.equal(presentTurnError("constructor").category, "unknown");
  const unknown = presentTurnError("unknown", { message: "boom" });
  assert.deepEqual([unknown.headline, unknown.hint, unknown.retryHelps], ["An API error occurred", "Try sending your message again.", true]);
  const client = presentTurnError("unknown", { message: "unexpected status 404 Not Found" });
  assert.deepEqual([client.hint, client.retryHelps], ["The request couldn’t be completed.", false]);
  assert.equal(presentTurnError("unknown", { message: "HTTP 503" }).retryHelps, true);
  assert.deepEqual(TURN_ERROR_ICONS.usage, { name: "UsageGaugeHigh", tone: "danger" });
  assert.deepEqual(TURN_ERROR_ICONS.warning, { name: "Warning", tone: "danger" });
});

test("details join message and additionalDetails; status comes only from the variant", () => {
  assert.equal(turnErrorDetails({ message: " A ", additionalDetails: "B\nC" }), "A\n\nB\nC");
  assert.equal(turnErrorDetails({ message: "A", additionalDetails: null }), "A");
  assert.equal(turnErrorDetails(null), "");
  assert.equal(turnErrorStatus({ responseStreamDisconnected: { httpStatusCode: 503 } }), 503);
  assert.equal(turnErrorStatus({ httpConnectionFailed: { httpStatusCode: null } }), undefined);
  assert.equal(turnErrorStatus("usageLimitExceeded"), undefined);
  assert.equal(describeTurnError({ message: "x", codexErrorInfo: "usageLimitExceeded" }).icon, "usage");
});

test("DeepSeek failure codes: quota is the billing card, a key problem names the DeepSeek key", () => {
  const billing = describeTurnError({ message: "Insufficient Balance", codexErrorInfo: "usageLimitExceeded", additionalDetails: "QUOTA" });
  assert.deepEqual({ ...billing }, { category: "billing", headline: "Billing issue", markerLabel: "Billing issue",
    hint: "Add credits to your DeepSeek balance to continue.", retryHelps: false, compactHelps: false, modelSwitchHelps: false, icon: "warning" });
  assert.equal(describeTurnError({ message: "x", codexErrorInfo: "usageLimitExceeded", additionalDetails: "ACCOUNT_QUOTA" }).category, "billing");
  assert.equal(describeTurnError({ message: "x", codexErrorInfo: null, additionalDetails: "QUOTA" }).category, "billing");
  // A Codex plan limit (no DeepSeek code) keeps the usage-limit card.
  assert.equal(describeTurnError({ message: "x", codexErrorInfo: "usageLimitExceeded", additionalDetails: "resets at 5pm" }).category, "rate_limit");
  for (const code of ["AUTH", "INVALID_CREDENTIAL", "MISSING_CREDENTIAL"]) {
    const auth = describeTurnError({ message: "Authentication Fails", codexErrorInfo: "unauthorized", additionalDetails: code });
    assert.deepEqual([auth.category, auth.headline, auth.hint, auth.retryHelps], ["auth", "Authentication failed", DEEPSEEK_AUTH_HINT, false], code);
  }
  assert.equal(DEEPSEEK_AUTH_HINT, "Check your DeepSeek API key in DeepSeek Harness settings.");
  assert.equal(describeTurnError({ message: "x", codexErrorInfo: "unauthorized", additionalDetails: null }).hint, "Sign in again to continue.");
  assert.equal(describeTurnError({ message: "x", codexErrorInfo: "rateLimitExceeded", additionalDetails: "RATE_LIMIT" }).category, "server_rate_limit");
});

test("R08 output limit: MAX_TOKENS is the source output_token_limit card with no details", () => {
  assert.ok(TURN_ERROR_CATEGORIES.includes("output_token_limit"));
  const error = { message: "Response exceeded the output limit", codexErrorInfo: null, additionalDetails: "MAX_TOKENS" };
  assert.equal(turnErrorCategory(error), "output_token_limit");
  assert.deepEqual({ ...describeTurnError(error) }, { category: "output_token_limit", headline: "Response exceeded the output limit",
    markerLabel: "Response exceeded the output limit", hint: "Ask DeepSeek to continue, or break the task into smaller steps.",
    retryHelps: true, compactHelps: false, modelSwitchHelps: false, icon: "warning" });
  // Source verdict G.output_token_limit "drop": no View details.
  assert.equal(turnErrorDetails(error), "");
  // Another code with the same message is not the output limit.
  assert.equal(turnErrorCategory({ ...error, additionalDetails: "OTHER" }), "unknown");
});

test("R08 recovery flags: compactHelps for context_length, modelSwitchHelps for overloaded (c1298b0ba xe)", () => {
  for (const category of TURN_ERROR_CATEGORIES) {
    const view = presentTurnError(category);
    assert.equal(view.compactHelps, category === "context_length", category);
    assert.equal(view.modelSwitchHelps, category === "overloaded", category);
  }
  const context = describeTurnError({ message: "full", codexErrorInfo: "contextWindowExceeded", additionalDetails: "CONTEXT_WINDOW_EXCEEDED" });
  assert.deepEqual([context.category, context.compactHelps, context.retryHelps, context.hint],
    ["context_length", true, false, "This chat is too long to continue. Start a new chat."]);
  assert.equal(describeTurnError({ message: "busy", codexErrorInfo: "serverOverloaded" }).modelSwitchHelps, true);
});

test("R08 reducer: a completed turn carrying an error keeps it live and from history", () => {
  const error = { message: "Response exceeded the output limit", codexErrorInfo: null, additionalDetails: "MAX_TOKENS", misalignment: null };
  let state = reduce(emptyState, started("t1"));
  state = reduce(state, { event: { method: "turn/completed", params: { threadId: "th", turn: { id: "t1", status: "completed", error } } } });
  assert.deepEqual(state.turnErrors.th.t1, { message: error.message, codexErrorInfo: null, additionalDetails: "MAX_TOKENS" });
  assert.equal(state.errors.th, null); assert.equal(state.active.th, null);
  const hydrated = reduce(emptyState, { type: "hydrate", id: "th", thread: { id: "th", turns: [
    { id: "cut", status: "completed", error, items: [{ id: "u", type: "userMessage", content: [] }] },
    { id: "stopped", status: "interrupted", error: { message: "stop" }, items: [] },
  ] } });
  assert.deepEqual(Object.keys(hydrated.turnErrors.th), ["cut"]);
  assert.equal(turnErrorCategory(hydrated.turnErrors.th.cut), "output_token_limit");
});

test("retry status short labels follow c4a9ee384 sn short table", () => {
  assert.equal(retryShortLabel("rateLimitExceeded"), "Rate limited");
  assert.equal(retryShortLabel("usageLimitExceeded"), "Rate limited");
  assert.equal(retryShortLabel("serverOverloaded"), "Model overloaded");
  assert.equal(retryShortLabel("unauthorized"), "Authentication failed");
  assert.equal(retryShortLabel({ responseStreamDisconnected: { httpStatusCode: null } }), "Request failed");
  assert.equal(retryShortLabel(null), "Request failed");
});

test("placement: the latest turn gets the card, older failures the marker", () => {
  const items = [
    { id: "u1", turnId: "t1", type: "userMessage" }, { id: "u2", turnId: "t2", type: "userMessage" }, { id: "a2", turnId: "t2", type: "agentMessage" },
  ];
  const errors = { t1: { message: "one" }, t2: { message: "two" } };
  assert.deepEqual([...turnErrorPlacements(items, errors)], [["t1", "marker"], ["t2", "card"]]);
  // A newer running turn (even before its items arrive) demotes the card.
  assert.deepEqual([...turnErrorPlacements(items, errors, { activeTurnId: "t3" })], [["t1", "marker"], ["t2", "marker"]]);
  // A later successful turn also demotes it (isLastEntry).
  assert.deepEqual([...turnErrorPlacements([...items, { id: "u3", turnId: "t3", type: "userMessage" }], errors)], [["t1", "marker"], ["t2", "marker"]]);
  // A failure whose turn is not in the loaded transcript is not invented.
  assert.deepEqual([...turnErrorPlacements(items, { t9: { message: "x" } })], []);
  assert.equal(turnErrorPlacements(items, undefined).size, 0);
});

test("retry input replays only a text-only user message", () => {
  const text = [{ type: "text", text: "hello", text_elements: [{ byteRange: { start: 0, end: 1 }, placeholder: null }] }, { type: "text", text: "more" }];
  assert.deepEqual(retryInput([{ id: "u", turnId: "t", type: "userMessage", content: text }], "t"),
    [{ type: "text", text: "hello", text_elements: text[0].text_elements }, { type: "text", text: "more", text_elements: [] }]);
  assert.equal(retryInput([{ id: "u", turnId: "t", type: "userMessage", content: [...text, { type: "localImage", path: "/tmp/a.png" }] }], "t"), null);
  assert.equal(retryInput([{ id: "u", turnId: "t", type: "userMessage", content: [{ type: "text", text: "  " }] }], "t"), null);
  assert.equal(retryInput([{ id: "u", turnId: "t", type: "userMessage", content: text }], "other"), null);
  assert.equal(retryInput([], "t"), null);
});

const started = (turn = "t1") => ({ event: { method: "turn/started", params: { threadId: "th", turn: { id: turn } } } });
const failure = { message: "You've hit your usage limit.", codexErrorInfo: "usageLimitExceeded", additionalDetails: "details", misalignment: null };

test("reducer: a failed turn keeps its TurnError across the next turn/started", () => {
  let state = reduce(emptyState, started("t1"));
  state = reduce(state, { event: { method: "turn/completed", params: { threadId: "th", turn: { id: "t1", status: "failed", error: failure } } } });
  assert.deepEqual(state.turnErrors.th.t1, { message: failure.message, codexErrorInfo: "usageLimitExceeded", additionalDetails: "details" });
  assert.equal(state.errors.th, null);
  state = reduce(state, started("t2"));
  assert.deepEqual(state.turnErrors.th.t1.message, failure.message);
  state = reduce(state, { event: { method: "turn/completed", params: { threadId: "th", turn: { id: "t2", status: "completed", error: null } } } });
  assert.deepEqual(Object.keys(state.turnErrors.th), ["t1"]);
});

test("reducer: willRetry true sets retrying only; progress and turn end clear it", () => {
  let state = reduce(emptyState, started("t1"));
  const retry = { event: { method: "error", params: { threadId: "th", turnId: "t1", willRetry: true, error: { message: "429; retrying", codexErrorInfo: "rateLimitExceeded" } } } };
  state = reduce(state, retry);
  assert.deepEqual(state.retrying.th, { turnId: "t1", message: "429; retrying", codexErrorInfo: "rateLimitExceeded", attempt: null, maxRetries: null });
  assert.equal(state.turnErrors.th, undefined);
  assert.equal(state.errors.th, null);
  assert.equal(state.active.th, "t1");
  for (const event of [
    { method: "item/agentMessage/delta", params: { threadId: "th", turnId: "t1", itemId: "a", delta: "x" } },
    { method: "item/started", params: { threadId: "th", turnId: "t1", item: { id: "b", type: "reasoning" } } },
    { method: "item/reasoning/textDelta", params: { threadId: "th", turnId: "t1", itemId: "b", delta: "y" } },
    { method: "turn/completed", params: { threadId: "th", turn: { id: "t1", status: "completed" } } },
    { method: "turn/started", params: { threadId: "th", turn: { id: "t2" } } },
  ]) {
    const cleared = reduce(reduce(state, retry), { event });
    assert.equal(cleared.retrying.th, null, event.method);
  }
  // Another thread's progress does not clear this thread's retry.
  assert.ok(reduce(state, { event: { method: "item/agentMessage/delta", params: { threadId: "other", itemId: "a", delta: "x" } } }).retrying.th);
  assert.deepEqual(reduce(state, { event: { kind: "connection", connected: false } }).retrying, {});
});

test("reducer: willRetry false records the turn error; no turn id stays thread-wide", () => {
  let state = reduce(emptyState, started("t1"));
  state = reduce(state, { event: { method: "error", params: { threadId: "th", turnId: "t1", willRetry: false, error: failure } } });
  assert.equal(state.turnErrors.th.t1.codexErrorInfo, "usageLimitExceeded");
  assert.equal(state.errors.th, null);
  state = reduce(state, { event: { method: "error", params: { threadId: "th", turnId: "", willRetry: false, error: { message: "No turn", codexErrorInfo: "serverOverloaded" } } } });
  // R08: a thread-wide error keeps the TurnError shape for the transcript-tail card.
  assert.deepEqual(state.errors.th, { message: "No turn", codexErrorInfo: "serverOverloaded", additionalDetails: null });
  assert.equal(describeTurnError(state.errors.th).category, "overloaded");
  assert.equal(sessionState({ id: "th" }, state), "blocked");
  // A turn/completed error without a turn id is thread-wide too; turn/started clears it.
  const noId = reduce(emptyState, { event: { method: "turn/completed", params: { threadId: "th", turn: { status: "failed", error: { message: "Lost", additionalDetails: "X" } } } } });
  assert.deepEqual(noId.errors.th, { message: "Lost", codexErrorInfo: null, additionalDetails: "X" });
  assert.equal(reduce(noId, started("t2")).errors.th, null);
  const empty = reduce(emptyState, { event: { method: "error", params: { threadId: "th", turnId: "t1", willRetry: false } } });
  assert.equal(empty.turnErrors.th.t1.message, "DeepSeek reported an error.");
});

test("hydrate records failed history turns and keeps live ones", () => {
  let state = reduce(emptyState, { event: { method: "turn/completed", params: { threadId: "th", turn: { id: "live", status: "failed", error: { message: "live" } } } } });
  state = reduce(state, { type: "hydrate", id: "th", thread: { id: "th", turns: [
    { id: "old", status: "failed", error: failure, items: [{ id: "u-old", type: "userMessage", content: [] }] },
    { id: "ok", status: "completed", error: null, items: [{ id: "u-ok", type: "userMessage", content: [] }] },
    { id: "no-error", status: "failed", error: null, items: [] },
  ] } });
  assert.deepEqual(Object.keys(state.turnErrors.th).sort(), ["live", "old"]);
  assert.equal(state.turnErrors.th.old.additionalDetails, "details");
  // Latest loaded turn succeeded: the session is not flagged as blocked.
  assert.equal(latestTurnError(state, "th"), null);
  assert.equal(sessionState({ id: "th" }, state), "done");
  const failedLast = reduce(emptyState, { type: "hydrate", id: "th", thread: { id: "th", turns: [{ id: "old", status: "failed", error: failure, items: [{ id: "u", type: "userMessage", content: [] }] }] } });
  assert.equal(latestTurnError(failedLast, "th").message, failure.message);
  assert.equal(sessionState({ id: "th" }, failedLast), "blocked");
  assert.equal(latestTurnError(reduce(failedLast, started("new")), "th"), null);
});

test("status row: retrying replaces the working label; stop wins", () => {
  const ready = { sessionKey: "th", ready: true, connected: true, running: true };
  const retry = status({ ...ready, retrying: "Rate limited" });
  assert.equal(retry.phase, "running");
  assert.equal(retry.label, "Rate limited · Retrying…");
  assert.deepEqual(retry.retry, { error: "Rate limited", label: "Retrying…" });
  assert.equal(status({ ...ready, retrying: "Rate limited", stopping: true }).label, "Stopping…");
  assert.equal(status({ ...ready, running: false, retrying: "Rate limited" }).phase, "idle");
  assert.equal(status(ready).retry, null);
});
