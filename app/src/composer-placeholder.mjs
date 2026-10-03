// cc43287c9-BMbiZYzF.js:28680-28699 placeholder: Yn ? 'Type / for commands'
// : (ht ?? (Ki ? 'Describe something to build, change, or fix' : 'Describe a task or ask a question')),
// with :27454 Yn = Pn?.id ?? null (the attached session id). Ki is a flagged
// alternate and ht a caller override the app has no source for, so only the
// default draft copy is kept. Chat mode is not this Code-composer branch and
// keeps the app's own 'How can I help you today?'.
export const SESSION_PLACEHOLDER = "Type / for commands";
export const DRAFT_PLACEHOLDER = "Describe a task or ask a question";
export const CHAT_PLACEHOLDER = "How can I help you today?";
export function composerPlaceholder({ sessionId = null, mode = "code" } = {}) {
  if (mode !== "code") return CHAT_PLACEHOLDER;
  return sessionId ? SESSION_PLACEHOLDER : DRAFT_PLACEHOLDER;
}
