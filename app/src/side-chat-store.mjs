// /btw side chat state, per session (original ca2ef848d Cs store:
// messagesByConversation, status, error). Lives for the app's lifetime only:
// nothing here is written to the session or to disk.
//
// One thread's state: {messages: [{role, text}], status: 'idle'|'thinking', error, requestId, retry}.
// A question whose answer failed stays as the last message (no answer after it) and
// `retry` holds its text while asking again could help, so the panel can offer Retry.
const EMPTY = Object.freeze({ messages: Object.freeze([]), status: 'idle', error: null, requestId: null, retry: null });

export function createSideChatStore() {
  const threads = new Map(), listeners = new Set();
  const emit = () => { for (const listener of listeners) listener(); };
  const get = id => threads.get(id) ?? EMPTY;
  const set = (id, patch) => { threads.set(id, { ...get(id), ...patch }); emit(); };
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    get,
    /** Q&A pairs before the pending question, for the next request's history. */
    history(id) {
      const out = [], messages = get(id).messages;
      for (let index = 0; index + 1 < messages.length; index += 2)
        if (messages[index].role === 'user' && messages[index + 1].role === 'assistant' && messages[index + 1].text) out.push({ question: messages[index].text, answer: messages[index + 1].text });
      return out;
    },
    ask(id, question, requestId) {
      const messages = [...get(id).messages];
      // A question whose answer never started is replaced (Bw popLastIfUser).
      if (messages.at(-1)?.role === 'user') messages.pop();
      set(id, { messages: [...messages, { role: 'user', text: question }, { role: 'assistant', text: '' }], status: 'thinking', error: null, requestId, retry: null });
    },
    delta(id, requestId, text) {
      const state = get(id);
      if (state.requestId !== requestId || !text) return;
      const messages = [...state.messages], last = messages.at(-1);
      if (last?.role !== 'assistant') return;
      messages[messages.length - 1] = { ...last, text: last.text + text };
      set(id, { messages });
    },
    /**
     * The final text wins over the streamed deltas. With no answer only the empty answer is
     * dropped: the question stays on screen beside the error, and `retryable` (default true)
     * keeps its text for Retry. The next ask replaces it (popLastIfUser above).
     */
    finish(id, requestId, { text, error, retryable = true } = {}) {
      const state = get(id);
      if (state.requestId !== requestId) return;
      let messages = [...state.messages], retry = null;
      const last = messages.at(-1);
      if (last?.role === 'assistant') {
        const answer = typeof text === 'string' && text ? text : last.text;
        messages = answer ? [...messages.slice(0, -1), { ...last, text: answer }] : messages.slice(0, -1);
        if (!answer && retryable && messages.at(-1)?.role === 'user') retry = messages.at(-1).text;
      }
      set(id, { messages, status: 'idle', error: error ?? null, requestId: null, retry });
    },
    clear(id) { threads.delete(id); emit(); },
  };
}

export const sideChatStore = createSideChatStore();

