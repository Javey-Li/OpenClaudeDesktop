// /btw side chat (original ca2ef848d Jw/Uw/Hw/Ww, "claudified_btw_side_chat"):
// a floating 400px card at the bottom right that asks quick questions about
// the current session without interrupting or adding to it. The DeepSeek
// bridge answers through codeDesktop/sideQuestion (one auxiliary model call
// that sees the session read-only); deltas arrive as
// codeDesktop/sideQuestion/delta. ⌘; or /btw toggles it; Escape inside closes.
// Each answer can be copied or branched into a new session whose draft starts
// with "Continuing from a side question." (UAw9rsyXsu).
import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SourceSettingsButton } from './source-settings-button.jsx';
import { Icon } from './icons.jsx';
import { SourceShortcut } from './source-shortcut.jsx';
import { SourceMarkdown } from './source-session.jsx';
import { sideChatStore } from './side-chat-store.mjs';
import { t, tn } from '../electron/i18n/index.mjs';
import './source-side-chat.css';

export const SIDE_CHAT_KEYS = 'cmd+;';
const METHOD_NOT_FOUND = -32601, INVALID_REQUEST = -32600;

/**
 * Whether a codeDesktop/sideQuestion failure means the core has no side questions: JSON-RPC method not found, or
 * the invalid request a native Codex app-server answers for a method it doesn't know ("unknown variant
 * `codeDesktop/sideQuestion`, expected one of …", a list of every method it serves).
 */
export function sideQuestionUnsupported(error) {
  if (error?.code === METHOD_NOT_FOUND) return true;
  return error?.code === INVALID_REQUEST && /unknown (?:variant|method)|method not found|not supported/i.test(String(error?.message ?? ''));
}

/** Ask one side question for `threadId`; resolves when the answer settles. */
export async function askSideQuestion({ rpc, threadId, question }) {
  const text = String(question ?? '').trim();
  if (!text || !threadId) return;
  const previous = sideChatStore.get(threadId);
  if (previous.requestId) void rpc('codeDesktop/sideQuestion/cancel', { requestId: previous.requestId }).catch(() => {});
  const history = sideChatStore.history(threadId);
  const requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  sideChatStore.ask(threadId, text, requestId);
  try {
    const result = await rpc('codeDesktop/sideQuestion', { threadId, question: text, history, requestId });
    sideChatStore.finish(threadId, requestId, { text: result?.text });
  } catch (error) {
    // The question stays on screen with the error; Retry is offered unless the core has no side questions at all.
    const unsupported = sideQuestionUnsupported(error);
    const message = unsupported ? t('This core doesn’t support side questions.') : error?.message || t('Something went wrong');
    sideChatStore.finish(threadId, requestId, { error: message, retryable: !unsupported });
  }
}

// While an answer streams only sending is blocked: the box stays enabled and focused (disabling a focused textarea
// blurs it to <body>, so a typed follow-up would go nowhere), and Enter keeps the draft until the answer settles.
function SideChatComposer({ busy, placeholder, onSubmit, inputRef }) {
  const [value, setValue] = useState('');
  const submit = () => { const text = value.trim(); if (!text || busy) return; setValue(''); onSubmit(text); };
  useLayoutEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, 120)}px`;
  }, [value, inputRef]);
  return <div className="ssc-composer">
    <div className="ssc-field">
      <textarea ref={inputRef} rows={1} value={value} placeholder={placeholder} aria-label={placeholder} aria-busy={busy || undefined}
        onChange={event => setValue(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }}/>
      <SourceSettingsButton variant="brand" size="sm" icon="ArrowUp" iconSize={16} iconOnly aria-label={t('Send')} disabled={busy || !value.trim()} onClick={submit}/>
    </div>
  </div>;
}

function SideChatMessages({ threadId, messages, status, onBranch }) {
  const list = useRef(null), pinned = useRef(true), count = useRef(0);
  useLayoutEffect(() => {
    const node = list.current, grew = messages.length > count.current;
    count.current = messages.length;
    if (node && (pinned.current || grew)) node.scrollTop = node.scrollHeight;
  }, [messages, status]);
  if (!messages.length) return <div className="ssc-empty"><p>{t('Ask on the side without touching the main chat. DeepSeek sees the full context, and nothing here is added to it.')}</p></div>;
  const streamingIndex = status === 'thinking' ? messages.length - 1 : -1;
  return <div ref={list} className="ssc-messages" onScroll={event => { const node = event.currentTarget; pinned.current = node.scrollHeight - node.scrollTop - node.clientHeight < 48; }}>
    {messages.map((message, index) => message.role === 'user'
      ? <div key={index} className="ssc-user"><p>{message.text}</p></div>
      : <div key={index} className="ssc-answer">
        {message.text ? <div className="ssc-answer-text"><SourceMarkdown text={message.text} isStreaming={index === streamingIndex} sessionKey={`btw-${threadId}`} itemId={`btw-${index}`}/></div> : null}
        {index !== streamingIndex && message.text && <div className="ssc-answer-actions">
          <SourceSettingsButton variant="ghost" size="sm" icon="Copy" iconSize={16} iconOnly aria-label={t('Copy answer')}
            onClick={() => void globalThis.navigator?.clipboard?.writeText(message.text).catch(() => {})}/>
          {onBranch && <SourceSettingsButton variant="ghost" size="sm" icon="GitBranch" iconSize={16} iconOnly aria-label={t('Branch to new chat')}
            onClick={() => onBranch(messages[index - 1]?.role === 'user' ? t('Continuing from a side question.\n\nQ: {question}\n\nA: “{answer}”\n\n', { question: messages[index - 1].text, answer: message.text }) : message.text)}/>}
        </div>}
      </div>)}
    {status === 'thinking' && !messages.at(-1)?.text && <p role="status" className="ssc-thinking">{t('Thinking…')}</p>}
  </div>;
}

/**
 * @param {{threadId: string|null, open: boolean, onClose: () => void, rpc: Function,
 *   contextCount?: number, pending?: string|null, onPendingTaken?: () => void, onBranch?: (draft: string) => void}} props
 */
export function SourceSideChat({ threadId, open, onClose, rpc, contextCount = 0, pending = null, onPendingTaken, onBranch }) {
  const state = useSyncExternalStore(sideChatStore.subscribe, () => sideChatStore.get(threadId), () => sideChatStore.get(threadId));
  const root = useRef(null), input = useRef(null), returnFocus = useRef(null);
  // Deltas from the bridge (any thread: a closed panel keeps streaming into its store).
  useEffect(() => globalThis.desktop?.onEvent?.(event => {
    if (event?.method === 'codeDesktop/sideQuestion/delta' && event.params) sideChatStore.delta(event.params.threadId, event.params.requestId, event.params.text);
  }), []);
  // /btw <question> asks as the panel opens.
  useEffect(() => {
    if (!open || !pending || !threadId) return;
    onPendingTaken?.();
    void askSideQuestion({ rpc, threadId, question: pending });
  }, [open, pending, threadId]);
  // Focus moves in on open and back to where it was on close.
  useLayoutEffect(() => {
    const doc = root.current?.ownerDocument ?? document;
    if (open) { returnFocus.current = doc.activeElement; input.current?.focus(); }
    else if (returnFocus.current) { const target = returnFocus.current; returnFocus.current = null; if (target?.isConnected && doc.activeElement === doc.body) target.focus(); }
  }, [open]);
  // Sending from the Send button disables it (and blurs focus to <body>): when the answer settles, focus comes back
  // to the box so the follow-up can be typed straight away.
  const settled = state.status !== 'thinking';
  useEffect(() => {
    if (!open || !settled) return;
    const doc = root.current?.ownerDocument ?? document;
    const active = doc.activeElement;
    if (!active || active === doc.body) input.current?.focus();
  }, [open, settled]);
  // An outside press closes it, unless it lands in a portal (menu, dialog) the panel doesn't own.
  useEffect(() => {
    if (!open) return undefined;
    const doc = root.current?.ownerDocument ?? document;
    const press = event => {
      const target = event.target;
      if (!target?.isConnected || root.current?.contains(target)) return;
      if (target.closest?.('[data-cds-portal], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')) return;
      onClose();
    };
    doc.addEventListener('mousedown', press);
    return () => doc.removeEventListener('mousedown', press);
  }, [open, onClose]);
  if (!threadId) return null;
  const { messages, status, error, retry } = state;
  const thinking = status === 'thinking';
  // A question that got no answer stays in the list; an empty answer with no error still says so.
  const failure = thinking ? null : error ?? (retry ? t('No answer came back.') : null);
  return <aside ref={root} className="ssc-root" aria-label={t('Side chat')} data-open={open || undefined} inert={!open || undefined} aria-hidden={!open || undefined}
    onKeyDownCapture={event => { if (event.key === 'Escape' && !event.nativeEvent.isComposing) { event.stopPropagation(); event.nativeEvent.stopImmediatePropagation?.(); onClose(); } }}>
    <header className="ssc-header">
      <span className="ssc-title">{t('Side chat')}</span>
      <SourceShortcut keys={SIDE_CHAT_KEYS}/>
      {messages.length > 0 && <SourceSettingsButton variant="ghost" size="sm" icon="Trash" iconSize={16} iconOnly aria-label={t('Clear side chat')}
        onClick={() => { if (state.requestId) void rpc('codeDesktop/sideQuestion/cancel', { requestId: state.requestId }).catch(() => {}); sideChatStore.clear(threadId); requestAnimationFrame(() => input.current?.focus()); }}/>}
      <SourceSettingsButton variant="ghost" size="sm" icon="X" iconSize={16} iconOnly aria-label={t('Close side chat')} onClick={onClose}/>
    </header>
    {contextCount > 0 && <div className="ssc-context">
      <Icon name="Eye" size={12} className="ssc-context-icon"/>
      <span>{tn(contextCount, 'Sees {count} message from main chat', 'Sees {count} messages from main chat')}</span>
      <span className="ssc-readonly">{t('read-only')}</span>
    </div>}
    <SideChatMessages threadId={threadId} messages={messages} status={status} onBranch={onBranch}/>
    {failure && <div className="ssc-error-row">
      <p role="alert" className="ssc-error">{failure}</p>
      {retry && <SourceSettingsButton variant="ghost" size="sm" icon="ArrowClockwise" iconSize={16}
        onClick={() => void askSideQuestion({ rpc, threadId, question: retry })}>{t('Retry')}</SourceSettingsButton>}
    </div>}
    <SideChatComposer inputRef={input} busy={thinking} placeholder={messages.length ? t('Follow up…') : t('Ask a quick question…')}
      onSubmit={question => void askSideQuestion({ rpc, threadId, question })}/>
  </aside>;
}
