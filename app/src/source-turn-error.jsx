import React, { useLayoutEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { SourceDisclosure } from "./source-disclosure.jsx";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { createClipboardFeedback } from "./clipboard-feedback.mjs";
import { describeTurnError, TURN_ERROR_ICONS, turnErrorDetails, turnErrorStatus } from "./turn-error-model.mjs";
import "./source-turn-error.css";

// approval-shared-current.js:4069-4083 Lp: ghost sm, flush start, Copy/Check.
function CopyDetails({ details }) {
  const [state, setState] = useState("idle");
  const controller = useRef(null);
  useLayoutEffect(() => {
    const feedback = createClipboardFeedback({
      writeText: (value) => typeof navigator === "undefined" || !navigator.clipboard?.writeText
        ? Promise.reject(new Error("Clipboard unavailable")) : navigator.clipboard.writeText(value),
      onState: setState,
    });
    controller.current = feedback;
    return () => { controller.current = null; feedback.dispose(); };
  }, []);
  useLayoutEffect(() => { controller.current?.setText(details); }, [details]);
  const copied = state === "copied";
  return <SourceSettingsButton variant="ghost" size="sm" icon={copied ? "Check" : "Copy"} iconSize={16}
    className="ste-copy" style={{ "--cds-outset-x": "var(--cds-pad-md)" }}
    onClick={() => { void controller.current?.copy(); }}>{copied ? "Copied" : "Copy details"}</SourceSettingsButton>;
}

// approval-shared-current.js:4084-4199 Rp/zp: "View details" disclosure whose
// panel (order-first) holds the error body, the Status line and Copy details;
// the card's actions sit at the end of the same wrapping row.
function TurnErrorDetails({ details, status, actions }) {
  if (!details && !actions) return null;
  const after = actions ? <div className="ste-actions">{actions}</div> : null;
  if (!details) return <div className="ste-details">{after}</div>;
  return <SourceDisclosure className="ste-details" triggerClassName="ste-details-trigger" caret="end" label="View details" after={after}>
    <div className="ste-details-panel">
      <div className="ste-details-box">
        <span className="ste-details-text">{details}</span>
        {status !== undefined && <div className="ste-details-facts"><span>{`Status: ${status}`}</span></div>}
        <div className="ste-details-copy"><CopyDetails details={details}/></div>
      </div>
    </div>
  </SourceDisclosure>;
}

function ErrorIcon({ kind }) {
  const icon = TURN_ERROR_ICONS[kind] || TURN_ERROR_ICONS.warning;
  return <Icon name={icon.name} size={16} className={`ste-icon ste-tone-${icon.tone}`}/>;
}

// One failed Codex turn. variant "card" = newest error of the last turn
// (scroll-messages ehe -> YY -> cf6ae6197 Bp); "marker" = every older one
// (JY -> uJ, scroll-messages-current.js:32289-32330).
export function SourceTurnError({ error, turnId, variant = "card", onRetry, onCompact }) {
  const view = describeTurnError(error);
  const details = turnErrorDetails(error);
  const status = turnErrorStatus(error?.codexErrorInfo);
  // CS latchOnAction (cf6ae6197): one click on any recovery action hides them all.
  const [latched, setLatched] = useState(false);
  if (variant === "marker") return <div className="source-message ste-marker" data-turn-error="marker" data-turn-id={turnId} data-error-category={view.category}>
    <div className="ste-marker-row"><ErrorIcon kind={view.icon}/><span className="ste-marker-label">{view.markerLabel}</span></div>
    <TurnErrorDetails details={details} status={status}/>
  </div>;
  const latch = (action) => () => { setLatched(true); action(); };
  // CS ue (compactHelps && !N && onCompact) without rewind: a plain secondary sm
  // 'Compact session' (ce660512f Ec.compactSession), drawn before Try again (pe).
  const compact = view.compactHelps && onCompact && !latched
    ? <SourceSettingsButton variant="secondary" size="sm" onClick={latch(onCompact)}>Compact session</SourceSettingsButton> : null;
  const retry = view.retryHelps && onRetry && !latched
    ? <SourceSettingsButton variant="secondary" size="sm" onClick={latch(onRetry)}>Try again</SourceSettingsButton> : null;
  const actions = compact || retry ? <>{compact}{retry}</> : null;
  return <div className="source-message ste-card" data-turn-error="card" data-turn-id={turnId} data-error-category={view.category}>
    <div className="ste-body">
      <div className="ste-header"><ErrorIcon kind={view.icon}/><span className="ste-headline">{view.headline}</span></div>
      {view.hint && <span className="ste-hint">{view.hint}</span>}
    </div>
    <TurnErrorDetails details={details} status={status} actions={actions}/>
  </div>;
}
