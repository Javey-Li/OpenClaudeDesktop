// The shared runtime owns submission, identity and draft lifetime.
import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useApprovalDraft } from "./use-approval-draft.js";
import { approvalActionIndex, approvalAnnouncement, approvalCardModel, approvalHasVisibleIntersection, approvalKeyIntent, createApprovalHotkeyArming, detailsOverflow, scrollRegionProps } from "./approval-card-model.mjs";
import { SourceShortcut } from "./source-shortcut.jsx";
import { usePersona } from "./use-persona.js";
import { assistantName } from "./persona-store.mjs";
import "./source-approval-card.css";
import { t } from "../electron/i18n/index.mjs";

function useOverflowFocus(ref, contentKey) {
  const [overflow, setOverflow] = useState(false);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let live = true;
    const measure = () => { if (live) setOverflow(detailsOverflow(element)); };
    const window = element.ownerDocument.defaultView;
    const resize = window?.ResizeObserver && new window.ResizeObserver(measure);
    resize?.observe(element);
    const observeChildren = () => {
      resize?.disconnect();
      resize?.observe(element);
      for (const child of element.children) resize?.observe(child);
      measure();
    };
    const mutation = window?.MutationObserver && new window.MutationObserver(observeChildren);
    mutation?.observe(element, { childList: true, subtree: true, characterData: true });
    element.ownerDocument.fonts?.ready.then(measure);
    observeChildren();
    return () => { live = false; resize?.disconnect(); mutation?.disconnect(); };
  }, [ref, contentKey]);
  return overflow;
}

// approval-actions-current Xo: allow clicks are armed after 400 ms; window
// activation / visibility changes rearm. Deny remains immediately available.
export function useAllowArming(root, armKey, active) {
  const at = useRef(Date.now());
  useLayoutEffect(() => { at.current = Date.now(); }, [armKey, active]);
  useLayoutEffect(() => {
    const document = root.current?.ownerDocument;
    const window = document?.defaultView;
    if (!document || !window) return;
    let hadFocus = document.hasFocus();
    const rearm = () => { at.current = Date.now(); };
    const checkFocus = () => {
      const focused = document.hasFocus();
      if (focused && !hadFocus) rearm();
      hadFocus = focused;
    };
    const onFocus = () => { if (!hadFocus) rearm(); checkFocus(); };
    const visible = () => { if (document.visibilityState === "visible") rearm(); };
    const timer = window.setInterval(checkFocus, 250);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", checkFocus);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", checkFocus);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [root]);
  return () => Date.now() - at.current >= 400;
}

// keycap: approval-current.js:15846-15854 gives only Allow once `shortcut: "cmd+enter"`
// (deny/persistent allows carry chordHintHidden in card placement, approval-actions-current.js
// :3181-3183); CDS Button ks (shared-frame :2936-2944) draws it after the label inside the
// gap-1 content span, which Button busy fades with the label (the cap keeps its width).
export function ActionButton({ action, busy, busyAction, enabled, onAction, shortcut, keycap }) {
  const spinning = busy && busyAction === action.key;
  return <button type="button" className="sac-button" data-cds="Button"
    data-variant={action.primary ? "primary" : "secondary"}
    data-approval-primary={action.primary ? "" : undefined}
    data-approval-action={action.key} disabled={!enabled && !busy}
    aria-disabled={busy || !enabled || undefined} aria-busy={spinning || undefined}
    aria-keyshortcuts={shortcut}
    onClick={event => {
      if (busy || !enabled) { event.preventDefault(); event.stopPropagation(); return; }
      onAction(action.key);
    }}
    onKeyDown={event => {
      if ((event.key === "Enter" || event.key === " ") && event.repeat) event.preventDefault();
    }}>
    <span className="sac-button-backdrop" aria-hidden="true"><span data-cds-part="paint" /></span>
    <span className="sac-button-label" data-busy={spinning || undefined}>{action.label}</span>
    {keycap && <SourceShortcut keys={keycap} aria-hidden="true" data-busy={spinning || undefined}
      className="scds-in-button scds-trailing" />}
    {spinning && <span className="sac-button-spinner" aria-hidden="true"><span data-cds="Spinner"><i /><i /></span></span>}
  </button>;
}

export function BusyAnnouncement() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(timer);
  }, []);
  return <span className="sac-visually-hidden" role="status">{ready ? t("Sending response") : ""}</span>;
}

// NM (approval-current.js:15959-16006): an sr-only role=status span. A new request
// identity (or new copy for it) clears it, then fills it 50 ms later so screen readers
// announce the blocking prompt; re-renders of the same identity and text stay silent.
function ApprovalAnnouncement({ identity, text }) {
  const ref = useRef(null), announced = useRef({});
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const last = announced.current;
    if (!text || (last.identity === identity && last.text === text)) {
      if (last.identity !== identity) { element.textContent = ""; announced.current = {}; }
      return;
    }
    element.textContent = "";
    const window = element.ownerDocument.defaultView ?? globalThis;
    const timer = window.setTimeout(() => {
      element.textContent = text;
      announced.current = { identity, text };
    }, 50);
    return () => window.clearTimeout(timer);
  }, [identity, text]);
  return <span ref={ref} className="sac-visually-hidden" role="status" data-approval-announcement="" />;
}

export function currentlyVisible(element) {
  if (!element?.isConnected) return false;
  const document = element.ownerDocument, window = document.defaultView;
  if (!window) return false;
  const clips = [];
  for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    const style = window.getComputedStyle(parent);
    if (style.overflowX === "visible" && style.overflowY === "visible") continue;
    clips.push({ rect: parent.getBoundingClientRect(), overflowX: style.overflowX, overflowY: style.overflowY,
      scrollPaddingTop: style.scrollPaddingTop, scrollPaddingBottom: style.scrollPaddingBottom });
  }
  return approvalHasVisibleIntersection({ rect: element.getBoundingClientRect(),
    viewport: { width: window.innerWidth, height: window.innerHeight }, clips,
    visible: typeof element.checkVisibility !== "function" || element.checkVisibility() });
}

// shared-6 aR observes hidden -> visible before restarting the hotkey clock.
// This is independent of the Xo click clock; an initial visible IO callback
// does not restart the grace, and key dispatch still checks current geometry.
export function useHotkeyArming(root, armKey, active) {
  const clock = useRef(null);
  if (!clock.current) clock.current = createApprovalHotkeyArming({ active });
  useLayoutEffect(() => {
    const state = createApprovalHotkeyArming({ active });
    clock.current = state;
    const element = root.current;
    const document = element?.ownerDocument, window = document?.defaultView;
    if (!element || !window || !window.IntersectionObserver) return;
    let live = true, intersecting = true, frame = 0;
    const check = () => {
      if (live) state.observeVisibility({ intersecting, visible: currentlyVisible(element) });
    };
    const observer = new window.IntersectionObserver(entries => {
      if (!live) return;
      for (const entry of entries) intersecting = entry.isIntersecting;
      check();
    });
    observer.observe(element);
    const schedule = () => {
      if (!live || frame) return;
      frame = window.requestAnimationFrame(() => { frame = 0; check(); });
    };
    document.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      live = false;
      observer.disconnect();
      document.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [root, armKey]);
  useLayoutEffect(() => { clock.current.setActive(active); }, [active]);
  return () => clock.current.isArmed();
}

export function SourceApprovalCardView({ request, item, busy = false, busyAction = null,
  error = "", onAction, enabled = true, isActive = true, menuOpen = false,
  armKey, renderDetails, className = "" }) {
  usePersona(); // C2: re-render the title when the assistant name changes
  const model = approvalCardModel(request, item);
  const [expanded, setExpanded] = useState(true);
  const root = useRef(null), body = useRef(null), actions = useRef(null), reason = useRef(null);
  const detailsId = useId();
  const identity = armKey ?? request?.bridgeApproval?.instanceId ?? request;
  const clickArmed = useAllowArming(root, identity, isActive);
  const hotkeyArmed = useHotkeyArming(root, identity, isActive);
  const overflow = useOverflowFocus(body, `${expanded}:${model.detail?.text ?? ""}:${model.reason ?? ""}:${JSON.stringify(model.context)}`);
  const reasonOverflow = useOverflowFocus(reason, model.reason ?? "");
  useLayoutEffect(() => { setExpanded(true); }, [identity]);
  const actionable = enabled && isActive && typeof onAction === "function" && model.supported;
  const submit = action => { if (actionable && !busy) onAction(action); };
  const shortcutEnabled = actionable && !busy && !menuOpen;
  // The ⌘⏎ keycap follows the same active/menu gate but survives busy (faded, ks :2886 opacity-0),
  // so the stable-size busy action keeps its width.
  const primaryKeycap = actionable && !menuOpen ? "cmd+enter" : undefined;
  const primaryShortcut = "Meta+Enter Control+Enter";

  function keyDown(event) {
    const element = event.target;
    const editor = element.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="menu"],[role="listbox"]');
    const target = editor ? "editor" : element === event.currentTarget ? "card"
      : actions.current?.contains(element) ? "actions" : "content";
    const intent = approvalKeyIntent(event, { target, model, busy,
      active: actionable, menuOpen, armed: hotkeyArmed() });
    if (!intent) return;
    event.preventDefault();
    event.stopPropagation();
    if (intent.type === "action") {
      // An old focused card can be scrolled outside its clipping ancestor.
      // Re-read all geometry at key dispatch; observer state can be one frame old.
      if (currentlyVisible(root.current)) submit(intent.action);
      return;
    }
    const buttons = [...(actions.current?.querySelectorAll('button:not(:disabled):not([aria-disabled="true"])') ?? [])];
    if (intent.type === "focus-primary")
      (buttons.find(button => button.hasAttribute("data-approval-primary")) ?? buttons.at(-1))?.focus();
    else if (intent.type === "navigate") {
      const index = buttons.indexOf(event.currentTarget.ownerDocument.activeElement);
      buttons[approvalActionIndex(intent.key, index, buttons.length)]?.focus();
    }
  }
  // approval-current.js:15399-15470 EM B: with t.meta the title is "Allow Claude to <b>{action}</b>
  // <meta>{metaText}</meta>?", both parts span.text-primary [unicode-bidi:plaintext], inside a span
  // that is line-clamp-2 when t.clampTitle && y (:15254 y = detail !== meta || foldedDetail; the
  // local detail is the changes block); without meta it is "Allow Claude to <b>{action}</b>?".
  // The ev header around B is already text-primary (cf6ae6197 ev), so only the spans are added.
  // The plain title stays the aria-label.
  const title = model.heading
    ? <>{t("Allow {name} to", { name: assistantName() })} <span className="sac-em">{model.heading.action}</span>{model.heading.meta
      ? <> <span className="sac-em">{model.heading.meta}</span></> : null}{t("?")}</>
    : model.title;
  const clamp = model.clampTitle && model.detail ? "" : undefined;
  return <section ref={root} className={`source-message sac-card ${className}`} data-approval-presentation="card"
    data-approval-instance={request?.bridgeApproval?.instanceId} data-approval-method={request?.method}
    data-approval-kind={model.kind}
    role="group" aria-label={t("Permission request: {title}", { title: model.title })} aria-busy={busy || undefined}
    tabIndex={0} onKeyDown={keyDown} onClick={event => event.stopPropagation()}>
    <div ref={body} className="sac-body" tabIndex={overflow ? 0 : undefined}
      role={overflow ? "group" : undefined} aria-label={overflow ? t("Request details") : undefined}>
      <div className="sac-description">
        {model.detail
          ? <button type="button" className="sac-heading" aria-expanded={expanded}
              aria-controls={detailsId} onClick={() => setExpanded(value => !value)}><span data-clamp={clamp}>{title}</span></button>
          : <div className="sac-heading"><span data-clamp={clamp}>{title}</span></div>}
        {(model.reason || model.context.length > 0 || model.detail) && <div className="sac-content">
          {/* approval-current.js:15275-15284 D, before the other content blocks: the decision
              reason in a 3-line scroll clamp (wM) whose "Reason" label is its accessible name
              while it scrolls (cf6ae6197 bv); no visible label. */}
          {model.reason && <div ref={reason} className="sac-reason scroll-fade-y scroll-fade-size-[8px]"
            {...scrollRegionProps(t("Reason"), reasonOverflow)}>{model.reason}</div>}
          {model.context.map(part => <p key={part.key} className="sac-context" data-context={part.key}>{part.text}</p>)}
          {model.detail && <div id={detailsId} className="sac-details" hidden={!expanded}>
            {renderDetails ? renderDetails(model.detail, model) : <pre className="sac-code">{model.detail.text}</pre>}
          </div>}
        </div>}
      </div>
    </div>
    {error && <p role="alert" className="sac-error">{error}</p>}
    {model.supported && <footer ref={actions} className="sac-actions">
      <ActionButton action={model.deny} busy={busy} busyAction={busyAction} enabled={actionable}
        shortcut={shortcutEnabled ? "Escape" : undefined} onAction={submit} />
      <div className="sac-allows" onClickCapture={event => {
        if (!clickArmed()) { event.preventDefault(); event.stopPropagation(); }
      }}>
        {model.allows.map(action => <ActionButton key={action.key} action={action}
          busy={busy} busyAction={busyAction} enabled={actionable} onAction={submit}
          keycap={action.primary ? primaryKeycap : undefined}
          shortcut={shortcutEnabled ? action.primary ? primaryShortcut
            : "Meta+Shift+Enter Control+Shift+Enter" : undefined} />)}
      </div>
    </footer>}
    {busy && <BusyAnnouncement />}
    {model.supported && <ApprovalAnnouncement identity={identity} text={approvalAnnouncement(model)} />}
  </section>;
}

export function SourceApprovalCard({ runtime, request, item, getVisibleThreadId,
  respond, onResolved = () => {}, onError = () => {}, ...presentation }) {
  const { ticket, view } = useApprovalDraft(runtime, request);
  if (!approvalCardModel(request, item).supported)
    return <SourceApprovalCardView {...presentation} request={request} item={item} enabled={false} />;
  if (!ticket || !view || view.phase !== "pending") return null;
  const submit = async action => {
    const result = await runtime.submit(ticket, action, respond, { getVisibleThreadId });
    if (result.status === "answered") onResolved({ request, ticket: result.ticket });
    else if (result.status === "error") onError({ request, ticket: result.ticket, message: result.message });
  };
  return <SourceApprovalCardView {...presentation} key={ticket.key} armKey={ticket.key}
    request={request} item={item} busy={view.busy} busyAction={view.busyAction}
    error={view.error} onAction={submit} />;
}
