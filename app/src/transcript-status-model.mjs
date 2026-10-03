import { t, tn } from "../electron/i18n/index.mjs";
import { retryShortLabel } from "./turn-error-model.mjs";
const presentation = (phase, label = "", visible = true, retry = null) => Object.freeze({
  phase,
  label,
  visible,
  busy: phase === "running" || phase === "stopping",
  announce: visible && label !== "",
  retry,
});
// Classic Y5 apiRetry (scroll-messages-current.js:58388/58545): the row reads
// "{short error} · Retrying ({attempt}/{maxRetries})" instead of the activity
// and token stats. Codex ErrorNotification carries no attempt counts, so the
// local label is "Retrying…"; the DeepSeek bridge adds `retry {attempt,
// maxRetries}` (maxRetries null for an unbounded policy).
export const RETRYING_LABEL = t("Retrying…");
const count = (value) => Number.isInteger(value) && value > 0;
export function retryingLabel(attempt, maxRetries) {
  return count(attempt) && count(maxRetries) ? t("Retrying ({attempt}/{maxRetries})", { attempt, maxRetries }) : RETRYING_LABEL;
}
// state.retrying[thread] ({codexErrorInfo, attempt, maxRetries}) -> the
// `retrying` input of transcriptStatusPresentation.
export function retryingStatus(entry) {
  if (!entry) return null;
  return { error: retryShortLabel(entry.codexErrorInfo ?? null), attempt: entry.attempt ?? null, maxRetries: entry.maxRetries ?? null };
}

const HOME = presentation("home", "", false);
const LOADING = presentation("loading", "", false);
const IDLE = presentation("idle");
const RUNNING = presentation("running", t("Working…"));
const STOPPING = presentation("stopping", t("Stopping…"));
const APPROVAL = presentation("approval", t("Waiting for your approval"));
const APPROVAL_REPLACES_ROW = presentation("approval", "", false);

// No timers, inferred completion, request dispatch, or per-turn history. The
// owner passes the current thread's real state on every render. Error alerts
// remain with the owner: a recoverable error must not end a still-active turn.
export function transcriptStatusPresentation({
  sessionKey = null,
  ready = false,
  connected = false,
  running = false,
  stopping = false,
  waiting = false,
  approvalVisible = false,
  retrying = null,
} = {}) {
  if (!sessionKey) return HOME;
  if (!ready) return LOADING;
  // Suppress stale work/approval flags after a lost connection. The actual
  // connection/error UI remains visible elsewhere; the idle mark says nothing.
  if (!connected) return IDLE;
  // Current classic host: hideLoader = inlineApprovals && inlineCardLive.
  if (approvalVisible) return APPROVAL_REPLACES_ROW;
  if (waiting) return APPROVAL;
  if (!running) return IDLE;
  if (stopping) return STOPPING;
  // `retrying`: the short error label, or {error, attempt, maxRetries}.
  const retry = typeof retrying === "string" ? { error: retrying } : retrying;
  if (typeof retry?.error === "string" && retry.error) {
    const label = retryingLabel(retry.attempt, retry.maxRetries);
    return presentation("running", `${retry.error} · ${label}`, true, Object.freeze({ error: retry.error, label }));
  }
  return RUNNING;
}

export function transcriptSparkSize(textSize = "m") {
  if (textSize === "s") return 16;
  if (textSize === "l") return 20;
  return 18;
}

// Classic Y5 passes state "thinking" to the Spark while working or stopping;
// idle/approval rows keep the static mark (state undefined).
export function sparkState(view) {
  return view?.busy ? "thinking" : undefined;
}

// Classic Y5 running-tasks button (scroll-messages-current.js:58273-58327 K):
// '{count, plural, one {# running task} other {# running tasks}}' while any
// task runs, else the Whe-held finished count; null hides the button (P).
export function taskButtonLabel(running = 0, finished = 0) {
  if (running > 0) return tn(running, "{count} running task", "{count} running tasks");
  if (finished > 0) return tn(finished, "{count} task finished", "{count} tasks finished");
  return null;
}

// Whe :58132-58145 (Uhe = 1500): remember the last non-zero running count and
// report it as the finished count for 1500ms after running drops to 0. Kept as
// a timer-owning store so node:test fake timers can drive it; `owner` resets
// the hold when the row starts describing a different session (the source
// remounts its transcript per session).
export const FINISHED_TASK_HOLD_MS = 1500;
export function createFinishedTaskHold(onChange) {
  let held = 0, owner, timer = null;
  const cancel = () => { if (timer !== null) { clearTimeout(timer); timer = null; } };
  return {
    update(running, nextOwner = owner) {
      if (nextOwner !== owner) { owner = nextOwner; cancel(); held = 0; }
      if (running > 0) { cancel(); held = running; return; }
      if (held === 0 || timer !== null) return;
      timer = setTimeout(() => { timer = null; held = 0; onChange?.(); }, FINISHED_TASK_HOLD_MS);
    },
    finished(running, currentOwner = owner) { return running > 0 || currentOwner !== owner ? 0 : held; },
    dispose: cancel,
  };
}
