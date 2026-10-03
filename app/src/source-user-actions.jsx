// Ordinary user-message actions row. The row always occupies one control
// height (24px) so that revealing controls never moves the following turn;
// until the turn is interacted with, only an aria-hidden reservation and a
// keyboard-reachable "Show message actions" sentinel exist. Copy writes the
// canonical user text exactly. BY (scroll-messages-current.js:39683) puts the
// OY timestamp BEFORE Copy; locally it is the turn's Codex startedAt and is
// omitted when that is null. No rewind or fork is fabricated.
import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';
import { SourceTooltip, SourceTooltipGroup } from './source-tooltip.jsx';
import { createTurnClipboardFeedback, preventRepeatedSelection, turnFooterKeyIndex } from './turn-footer-behavior.mjs';
import { clipboardEnvironment, writeClipboardPayload } from './clipboard-payload.mjs';
import { markdownToClipboardHtml } from './rich-copy-html.mjs';
import { SourceTimestamp } from './source-timestamp.jsx';
import './source-user-actions.css';

function useCoarseInput(root) {
  const [coarse, setCoarse] = useState(false);
  useLayoutEffect(() => {
    const media = root.current?.ownerDocument.defaultView?.matchMedia?.('(pointer: coarse), (hover: none)');
    if (!media) return;
    const changed = () => setCoarse(media.matches);
    changed(); media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, [root]);
  return coarse;
}

function useUserCopyFeedback(identity, text, button) {
  const [state, setState] = useState('idle');
  const controller = useRef(null);
  useLayoutEffect(() => {
    const feedback = createTurnClipboardFeedback({
      trim: false,
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

function UserActions({ identity, itemId, text, startedAtMs, interacted }) {
  const root = useRef(null), copyButton = useRef(null), focusRequested = useRef(false);
  const [latched, setLatched] = useState(false);
  const coarse = useCoarseInput(root);
  const mounted = latched || interacted || coarse;
  const statusId = useId();
  const { state, copy } = useUserCopyFeedback(identity, text, copyButton);
  useLayoutEffect(() => { if (mounted) setLatched(true); }, [mounted]);
  useLayoutEffect(() => {
    if (!mounted || !focusRequested.current) return;
    focusRequested.current = false;
    copyButton.current?.focus();
  }, [mounted]);
  const showActions = () => { focusRequested.current = true; setLatched(true); };
  const copied = state === 'copied', failed = state === 'error';
  const announcement = copied ? 'Copied' : failed ? 'Couldn’t copy to the clipboard. Try again.' : '';
  return <div ref={root} className="sua-row" data-user-actions-id={itemId}>
    {!mounted ? <div className="sua-deferred" data-find-omitted="">
      <span className="sua-placeholder" aria-hidden="true" />
      <button type="button" className="sua-show-actions sua-sr-only" onFocusCapture={showActions}
        onClick={showActions}>Show message actions</button>
    </div> : <div className="sua-toolbar" data-cds="MessageActions" data-reveal="fade"
      role="toolbar" aria-label="Message actions" tabIndex={-1}
      onKeyDown={event => {
        const button = copyButton.current;
        const index = turnFooterKeyIndex(event, { count: button && !button.disabled ? 1 : 0,
          current: event.currentTarget.ownerDocument.activeElement === button ? 0 : -1,
          rtl: event.currentTarget.ownerDocument.defaultView.getComputedStyle(event.currentTarget).direction === 'rtl' });
        if (index !== null) { event.preventDefault(); button?.focus(); }
      }}>
      <SourceTooltipGroup>
        {startedAtMs != null && <SourceTimestamp dateMs={startedAtMs} />}
        <SourceTooltip content="Copy" automatic={true} hoverable={false}>
          <button ref={copyButton} type="button" className="sua-copy" data-cds="Button" data-variant="ghost"
            data-cds-icon-only="" data-cds-ghost=""
            aria-label="Copy" aria-describedby={failed ? statusId : undefined} tabIndex={0}
            onMouseDown={event => {
              const editable = Boolean(event.target.closest?.("input:not([type='hidden']):not([disabled]),[contenteditable]:not([contenteditable='false']),textarea:not([disabled])"));
              if (preventRepeatedSelection({ detail: event.detail, button: event.button, editable })) event.preventDefault();
            }}
            onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && event.repeat) event.preventDefault(); }}
            onClick={() => { void copy(); }}>
            <span className="sua-button-backdrop" aria-hidden="true"><span data-cds-part="paint" /></span>
            <Icon name={copied ? 'Check' : 'Copy'} size={16} />
          </button>
        </SourceTooltip>
      </SourceTooltipGroup>
      <span id={statusId} className="sua-status sua-sr-only" role="status">{announcement}</span>
    </div>}
  </div>;
}

/** Mounted by the user article only when the message has copyable text. The
 * article owns the pointer/focus latch and the hover reveal scope. */
export function SourceUserActions({ sessionKey, itemId, text = '', startedAtMs = null, interacted = false }) {
  const identity = JSON.stringify(['user', sessionKey, itemId]);
  return <UserActions key={identity} identity={identity} itemId={itemId} text={text} startedAtMs={startedAtMs} interacted={interacted} />;
}
