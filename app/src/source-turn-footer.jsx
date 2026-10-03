// Source adapter for the ordinary Code turn-tail MessageActions toolbar.
// Eligibility/turn aggregation and the body-to-footer gap belong to the caller.
import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';
import { SourceTooltip, SourceTooltipGroup } from './source-tooltip.jsx';
import { createTurnClipboardFeedback, preventRepeatedSelection, turnFooterKeyIndex } from './turn-footer-behavior.mjs';
import { clipboardEnvironment, writeClipboardPayload } from './clipboard-payload.mjs';
import { markdownToClipboardHtml } from './rich-copy-html.mjs';
import { SourceTimestamp } from './source-timestamp.jsx';
import './source-turn-footer.css';
import { t } from '../electron/i18n/index.mjs';

function useCoarseInput(root) {
  const [coarse, setCoarse] = useState(false);
  useLayoutEffect(() => {
    const window = root.current?.ownerDocument.defaultView;
    const media = window?.matchMedia?.('(pointer: coarse), (hover: none)');
    if (!media) return;
    const changed = () => setCoarse(media.matches);
    changed(); media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, [root]);
  return coarse;
}

function useTurnCopyFeedback(identity, text, button) {
  const [state, setState] = useState('idle');
  const controller = useRef(null);
  useLayoutEffect(() => {
    const feedback = createTurnClipboardFeedback({
      // Rich text/plain + text/html write with silent plain fallback; the HTML
      // is derived at click time from the same Markdown as the plain payload.
      write: payload => writeClipboardPayload(clipboardEnvironment(button.current), payload),
      getHtml: markdownToClipboardHtml,
      onState: setState,
    });
    controller.current = feedback;
    return () => { controller.current = null; feedback.dispose(); };
  }, [button]);
  useLayoutEffect(() => { controller.current?.setContent(identity, text); }, [identity, text]);
  return { state, copy: () => controller.current?.copy() };
}

function TurnFooter({ identity, turnId, text, completedAtMs, interacted, hovered, focused }) {
  const root = useRef(null), copyButton = useRef(null), focusRequested = useRef(false);
  const [latched, setLatched] = useState(false);
  const coarse = useCoarseInput(root);
  const mounted = latched || interacted || hovered || focused || coarse;
  const statusId = useId();
  const { state, copy } = useTurnCopyFeedback(identity, text, copyButton);
  useLayoutEffect(() => { if (mounted) setLatched(true); }, [mounted]);
  useLayoutEffect(() => {
    if (!mounted || !focusRequested.current) return;
    focusRequested.current = false;
    copyButton.current?.focus();
  }, [mounted]);
  const showActions = () => { focusRequested.current = true; setLatched(true); };
  const copied = state === 'copied', failed = state === 'error';
  const announcement = copied ? t('Copied') : failed ? t('Couldn’t copy to the clipboard. Try again.') : '';
  return <div ref={root} className="stf-footer" data-turn-copy-id={turnId}
    data-row-hovered={hovered ? '' : undefined} data-row-focused={focused ? '' : undefined}
    onPointerEnter={() => setLatched(true)} onFocusCapture={() => setLatched(true)}>
    {!mounted ? <div className="stf-deferred" data-find-omitted="">
      <span className="stf-placeholder" aria-hidden="true" />
      <button type="button" className="stf-show-actions stf-sr-only" onFocusCapture={showActions}
        onClick={showActions}>{t("Show message actions")}</button>
    </div> : <div className="stf-toolbar" data-cds="MessageActions" data-reveal="fade"
      role="toolbar" aria-label={t("Message actions")} tabIndex={-1}
      onKeyDown={event => {
        const button = copyButton.current;
        const index = turnFooterKeyIndex(event, { count: button && !button.disabled ? 1 : 0,
          current: event.currentTarget.ownerDocument.activeElement === button ? 0 : -1,
          rtl: event.currentTarget.ownerDocument.defaultView.getComputedStyle(event.currentTarget).direction === 'rtl' });
        if (index !== null) { event.preventDefault(); button?.focus(); }
      }}>
      <SourceTooltipGroup>
        <SourceTooltip content={t("Copy")} automatic={true} hoverable={false}>
          <button ref={copyButton} type="button" className="stf-copy" data-cds="Button" data-variant="ghost"
            data-cds-icon-only="" data-cds-ghost=""
            aria-label={t("Copy")} aria-describedby={failed ? statusId : undefined} tabIndex={0}
            onMouseDown={event => {
              const editable = Boolean(event.target.closest?.("input:not([type='hidden']):not([disabled]),[contenteditable]:not([contenteditable='false']),textarea:not([disabled])"));
              if (preventRepeatedSelection({ detail: event.detail, button: event.button, editable })) event.preventDefault();
            }}
            onKeyDown={event => {
              if ((event.key === 'Enter' || event.key === ' ') && event.repeat) event.preventDefault();
            }} onClick={() => { void copy(); }}>
            <span className="stf-button-backdrop" aria-hidden="true"><span data-cds-part="paint" /></span>
            <Icon name={copied ? 'Check' : 'Copy'} size={16} />
          </button>
        </SourceTooltip>
        <span id={statusId} className="stf-status stf-sr-only" role="status">{announcement}</span>
        {/* Z0 (scroll-messages-current.js:43193): the timestamp is the LAST
            toolbar element, after Copy, so it takes last:pe-0. */}
        {completedAtMs != null && <SourceTimestamp dateMs={completedAtMs} />}
      </SourceTooltipGroup>
    </div>}
  </div>;
}

// Callers pass actual transcript turn interaction state; no document-wide
// lookup, new transcript anchor or automatic scroll-follow opt-in is added.
// completedAtMs: Codex Turn.completedAt*1000, the local stand-in for the
// source entry.timestamp (56825 K = isStreaming ? undefined : timestamp). Null
// while the turn runs or when Codex reported no completion time: no <time>.
export function SourceTurnFooter({ sessionKey, turnId, text = '', completedAtMs = null, interacted = false, hovered = false, focused = false }) {
  const identity = JSON.stringify([sessionKey, turnId]);
  return <TurnFooter key={identity} identity={identity} turnId={turnId} text={text} completedAtMs={completedAtMs}
    interacted={interacted} hovered={hovered} focused={focused} />;
}
