// Inline comments on a proposed plan and on changed lines (official 2.2553.1: panes-tile-current.js:1600-1700 'Plan
// comment' over a text selection, approval-current.js:9422-9440 Fse prefixing them to the plan feedback, and
// panes-diff-options-current.js:470-500 'Comment on line {line}' / 'Add to prompt'). Plain text, so every core reads
// them: plan comments ride the plan review's Revise feedback, or go to the composer; line comments go to the composer.
import { t } from "../electron/i18n/index.mjs";

const quote = (text) => String(text ?? "").replace(/\r\n?/g, "\n").trim().split("\n").map((line) => `> ${line}`).join("\n");

/** Fse: each comment as "On selected text:\n> quote\n<comment>", blank-line separated. */
export function serializePlanComments(comments = []) {
  return comments.filter((entry) => entry && String(entry.text ?? "").trim())
    .map((entry) => `On selected text:\n${quote(entry.quote)}\n${String(entry.text).trim()}`).join("\n\n");
}

/** The plan feedback a Revise sends: the comments first, then the typed feedback. */
export function planFeedbackWithComments(feedback = "", comments = []) {
  return [serializePlanComments(comments), String(feedback ?? "").trim()].filter(Boolean).join("\n\n");
}

/** A changed-line comment for the composer: where, the quoted code, then the comment. */
export function serializeLineComment({ path, start, end = start, code = "", text = "" }) {
  const where = end && end !== start ? t("In {path}, lines {start}–{end}:", { path, start, end }) : t("In {path}, line {line}:", { path, line: start });
  return [where, code ? quote(code) : null, String(text).trim()].filter(Boolean).join("\n");
}

// Plan comments live per session until a Revise sends them or the user removes them (memory only, like a draft).
const plans = new Map(), listeners = new Set();
let version = 0;
const emit = () => { version++; for (const listener of listeners) listener(); };
export const planCommentsStore = {
  subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  version: () => version,
  get: (threadId) => plans.get(threadId) ?? EMPTY,
  add(threadId, { quote: selected, text }) {
    if (!threadId || !String(text ?? "").trim()) return;
    plans.set(threadId, [...(plans.get(threadId) ?? []), { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, quote: String(selected ?? ""), text: String(text).trim() }]);
    emit();
  },
  edit(threadId, id, text) {
    const list = plans.get(threadId);
    if (!list) return;
    plans.set(threadId, list.map((entry) => (entry.id === id ? { ...entry, text: String(text ?? "").trim() } : entry)).filter((entry) => entry.text));
    emit();
  },
  remove(threadId, id) {
    const list = plans.get(threadId);
    if (!list) return;
    const next = list.filter((entry) => entry.id !== id);
    if (next.length) plans.set(threadId, next); else plans.delete(threadId);
    emit();
  },
  clear(threadId) { if (plans.delete(threadId)) emit(); },
};
const EMPTY = Object.freeze([]);

// The composer takes text from panes through one window event (main.jsx listens and appends it to the draft).
export const ADD_TO_PROMPT_EVENT = "code-desktop:add-to-prompt";
export function addToPrompt(text) {
  const value = String(text ?? "").trim();
  if (!value || typeof window === "undefined") return false;
  window.dispatchEvent(new CustomEvent(ADD_TO_PROMPT_EVENT, { detail: { text: value } }));
  return true;
}
