import React, { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./icons";
import { SourceTooltip, textOverflows } from "./source-tooltip.jsx";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { GitCounts } from "./source-git-counts.jsx";
import { buildGitRailModel } from "./git-rail-model.mjs";
import "./source-git-status.css";
import "./source-git-rail.css";

/** Rail layout of the repository row (git-status-card.js Ii rail branch
 * 1128-1200 → Zi 1633-1760, fact primitives cf6ae6197 eS/nS/iS/aS, placeholder
 * rows c936fcd42 `session-rail-pr-rows`).
 *
 * The official rail lives inside `EpitaxySessionRail` (a full right column
 * with plan/artifacts/chapters/connectors/usage/controls) that is gated by a
 * growth flag; this app has no such host, so the component is only mounted by
 * an explicit caller. With local commit-mode data the facts group carries a
 * single Changes row; Base branch, Status, Review, Checks, GitHub, auto-fix and
 * auto-merge rows need PR/GitHub data that Codex does not provide.
 *
 * No native titles: the title is Zi's `Y{lazy}` = shared-frame Fu
 * OverflowTooltip (full text only while truncated), the Dismiss button is
 * c0b46114c y (tooltip defaults to false) and the disabled Commit uses the
 * Fe/Pu disabled-reason tooltip with its hidden described reason.
 */
export function SourceGitRail({
  status, comparison = null, prMode = "commit", hideRepo = false, prState, prLink = null,
  expanded, onExpandedChange, onOpenChanges, onAction, busy = false, responding = false, onDismiss,
  reservation = null, onMeasured, order,
}) {
  const nav = useRef(null);
  const model = buildGitRailModel({ status, comparison, prMode, prState, hideRepo, prLink, responding });
  const visible = model.visible;
  useEffect(() => {
    // Remembered row height per session (git-pr-slot bl/dl): the caller stores
    // it so the next mount can reserve the same space before status resolves.
    if (!visible || !onMeasured || !nav.current || typeof ResizeObserver !== "function") return undefined;
    const node = nav.current;
    const report = () => onMeasured(Math.round(node.getBoundingClientRect().height));
    report();
    const observer = new ResizeObserver(report);
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible, onMeasured]);
  const pending = status === null || status === undefined;
  return <nav ref={nav} className="sgr-nav" aria-label="Repository and pull request controls" data-layout="rail">
    {pending && reservation?.heightPx > 0 && <RailPlaceholder key="session-rail-pr-rows" heightPx={reservation.heightPx} rows={reservation.rows} />}
    {visible && <RailRow model={model} status={status} expanded={expanded} onExpandedChange={onExpandedChange}
      onOpenChanges={onOpenChanges} onAction={onAction} busy={busy} onDismiss={onDismiss} order={order} />}
  </nav>;
}

const LABEL_WIDTHS = ["34%", "26%", "30%"], VALUE_WIDTHS = ["38%", "24%", "46%"];

/** c936fcd42 Ii/Li: fixed-height reservation with decorative skeleton rows. */
export function RailPlaceholder({ heightPx, rows }) {
  return <div className="sgr-placeholder" style={{ height: heightPx }} data-source-component="GitStatusRailPlaceholder">
    <div className="sgr-skeleton" aria-hidden="true">
      {Array.from({ length: Math.max(1, rows) }, (_, index) => <div className="sgr-fact sgr-skeleton-row" key={index}>
        {index === 0
          ? <><span className="sgr-bone sgr-bone-glyph" /><span className="sgr-bone" style={{ width: "62%" }} /></>
          : <><span className="sgr-bone" style={{ width: LABEL_WIDTHS[index % 3] }} />
            <span className="sgr-skeleton-value"><span className="sgr-bone" style={{ width: VALUE_WIDTHS[index % 3] }} /></span></>}
      </div>)}
    </div>
  </div>;
}

function RailRow({ model, status, expanded, onExpandedChange, onOpenChanges, onAction, busy, onDismiss, order }) {
  const [own, setOwn] = useState(true);
  const open = expanded ?? own;
  const panelId = useId();
  const setOpen = (value) => { if (onExpandedChange) onExpandedChange(value); else setOwn(value); };
  const signal = model.signal;
  const titleRef = useRef(null);
  const keyDown = (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = event.key === "ArrowRight";
    if (next !== open) setOpen(next);
  };
  const trigger = <button type="button" className="sgr-trigger" aria-expanded={open} aria-controls={open ? panelId : undefined}
    data-panel-open={open ? "" : undefined} data-dismiss-inset={onDismiss && (open || !signal) ? "" : undefined}
    onClick={() => setOpen(!open)} onKeyDown={keyDown}>
    <Icon name="CaretRight" size={12} className="sgr-caret" />
    <span role="img" aria-label={model.glyphLabel} className="sgr-glyph"><Icon name="GitBranch" size={16} /></span>
    <SourceTooltip content={() => (textOverflows(titleRef.current, { subpixel: true }) ? model.title : undefined)}>
      <span ref={titleRef} className="sgr-title" data-cds="OverflowTooltip">{model.title}</span>
    </SourceTooltip>
    {signal && !open && <span className={`sgr-signal${onDismiss ? " sgr-signal-yields" : ""}`}><RailSignal signal={signal} /></span>}
  </button>;
  const action = model.action && onAction;
  return <div className="sgr-row" data-source-component="GitStatusRailRow" style={order === undefined ? undefined : { order }}>
    {onDismiss
      ? <div className="sgr-group">
        {trigger}
        <span className="sgr-dismiss-slot">
          <button type="button" className="sg-button sg-dismiss sgr-dismiss" aria-label="Dismiss"
            onMouseDown={(event) => event.preventDefault()} onClick={() => onDismiss(status)}><Icon name="X" size={16} /></button>
        </span>
      </div>
      : trigger}
    {open && <div className="sgr-panel" id={panelId}>
      <div data-rail-group="facts" className="sgr-facts">
        {model.facts.map((fact) => <RailFact key={fact.key} fact={fact} status={status} onOpenChanges={onOpenChanges} />)}
      </div>
      <div data-rail-group="gates" className="sgr-facts" />
      <div data-rail-group="automation" className="sgr-facts" />
      {action && <div className="sgr-action-row">
        <SourceTooltip disabledReason={model.action.disabled ? model.action.disabledReason : undefined} wrapperClassName="sgr-action-wrap">
          {/* Hi: a CDS Button without a variant (secondary, shared-frame :2815), min-w-0 flex-1 (F12). */}
          {/* git-status-card.js:1116 `onMouseDown: Mn`: pointer clicks keep the composer's focus. */}
          <SourceSettingsButton variant="secondary" className="sg-action sgr-action" disabled={model.action.disabled || busy} busy={busy}
            onMouseDown={(event) => event.preventDefault()} onClick={() => onAction(status)}><span className="sgr-action-label">{model.action.label}</span></SourceSettingsButton>
        </SourceTooltip>
      </div>}
    </div>}
  </div>;
}

function RailSignal({ signal }) {
  // shared-21 OV (F12 GitCounts): sr-only unit list + aria-hidden tweened +/−.
  if (signal.kind === "changes") return <GitCounts added={signal.added} removed={signal.removed} className="sgr-counts sgr-counts-caption" />;
  // $i → xn size "s" (cd8aaaf0e q): pill with a min-w-0 truncate label, Nn.neutral tint.
  return <span className="sgr-badge"><span className="sgr-badge-text">{signal.text}</span></span>;
}

function RailFact({ fact, status, onOpenChanges }) {
  const label = <span className="sgr-label">{fact.label}</span>;
  if (fact.key === "changes") {
    const counts = <GitCounts added={fact.added} removed={fact.removed} className="sgr-counts" />;
    if (onOpenChanges) return <SourceTooltip content={fact.hint} detail={fact.hintDetail}>
      <button type="button" className="sgr-fact sgr-fact-action" aria-label={fact.action}
        onMouseDown={(event) => event.preventDefault()} onClick={() => onOpenChanges(status)}>
        {label}<span className="sgr-value">{counts}</span>
      </button>
    </SourceTooltip>;
    return <SourceTooltip content={fact.hintDetail}><div className="sgr-fact">{label}<span className="sgr-value">{counts}</span></div></SourceTooltip>;
  }
  const row = <div className="sgr-fact">{label}<span className="sgr-value"><span className="sgr-value-text">{fact.value}</span></span></div>;
  return fact.hint ? <SourceTooltip content={fact.hint} detail={fact.hintDetail}>{row}</SourceTooltip> : row;
}
