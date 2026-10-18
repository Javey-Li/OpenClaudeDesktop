import React, { useRef } from "react";
import { SourceTooltip } from "./source-tooltip";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { findingCounts, findingsStatusText } from "./review-findings-model.mjs";
import { t } from "../electron/i18n/index.mjs";
import "./source-pane-review.css";

// Review findings in the Changes pane (2.2553.1). The bar is the pane's subheader (hh over Cd wrap, panes-tile-current
// .js:3887-4125): the "Finding {current} of {total}" status (Applying fixes… / Fixes applied), CaretLeft / CaretRight
// "Previous finding" / "Next finding" when there are two or more, a spacer, then "Apply fixes" while some are open
// or "Re-run review" once every one is fixed (secondary sm), and a ghost sm "Dismiss". The card (Rn,
// panes-diff-view-current.js:614-760) sits under the finding's line in the diff: "flex flex-col gap-1.25 rounded
// border bg-surface-2 px-2.5 py-md" (accent ring when current), the Fixed / Fixing… / category badges, a secondary
// sm "Dismiss finding" X, the summary (text-body-medium), the failure scenario (text-body text-muted), then "Fix this
// one" (text-accent) and "Next →" (text-muted) while it is open.

function StepButton({ label, icon, disabled, onClick }) {
  return (
    <SourceTooltip content={label} disabledReason={disabled ? label : undefined} side="bottom" hoverable={false}>
      <SourceSettingsButton variant="ghost" iconOnly icon={icon} iconSize="auto" className="spr-step" aria-label={label} disabled={disabled}
        onMouseDown={(event) => event.preventDefault()} onClick={onClick} />
    </SourceTooltip>
  );
}

/**
 * @param {object} props
 * @param {Array<object>} props.findings
 * @param {Record<string, string>} props.statuses   id → open | fixing | addressed
 * @param {number} props.currentIndex
 * @param {(index: number) => void} props.onStep
 * @param {(() => void) | null} props.onApply        null when no turn can be sent
 * @param {(() => void) | null} props.onRerun
 * @param {() => void} props.onDismiss
 */
export function SourceReviewFindingsBar({ findings, statuses = {}, currentIndex = 0, onStep, onApply = null, onRerun = null, onDismiss, busy = false }) {
  if (!findings.length) return null;
  const counts = findingCounts(findings, statuses);
  const allFixed = counts.addressed === findings.length;
  const canApply = !allFixed && counts.open > 0;
  return (
    <div className="epitaxy-panel-subheader spr-bar" data-review-findings="">
      <span role="status" className="spr-status">{findingsStatusText(findings, statuses, currentIndex)}</span>
      {findings.length > 1 && <>
        <StepButton label={t("Previous finding")} icon="CaretLeft" disabled={currentIndex <= 0} onClick={() => onStep(currentIndex - 1)} />
        <StepButton label={t("Next finding")} icon="CaretRight" disabled={currentIndex >= findings.length - 1} onClick={() => onStep(currentIndex + 1)} />
      </>}
      <span className="spr-grow" />
      {allFixed
        ? onRerun && <SourceSettingsButton variant="secondary" size="sm" className="spr-action" disabled={busy} onClick={onRerun}>{t("Re-run review")}</SourceSettingsButton>
        : canApply && onApply && <SourceSettingsButton variant="secondary" size="sm" className="spr-action" disabled={busy} data-review-apply="" onClick={onApply}>{t("Apply fixes")}</SourceSettingsButton>}
      <SourceSettingsButton variant="ghost" size="sm" className="spr-action spr-dismiss" onClick={onDismiss}>{t("Dismiss")}</SourceSettingsButton>
    </div>
  );
}

function Badge({ variant, children }) {
  return <span className="spr-badge" data-cds="Badge" data-variant={variant} data-size="xs">{children}</span>;
}

/**
 * @param {object} props
 * @param {object} props.finding            {id, summary, detail, category, verdict}
 * @param {boolean} [props.current]
 * @param {string} [props.status]           open | fixing | addressed
 * @param {() => void} [props.onDismiss]
 * @param {(() => void) | null} [props.onFix]
 * @param {(() => void) | null} [props.onNext]
 */
export function SourceReviewFindingCard({ finding, current = false, status = "open", onDismiss, onFix = null, onNext = null }) {
  const card = useRef(null);
  return (
    <div className="spr-card-slot" data-review-finding={finding.id}>
      <div ref={card} tabIndex={-1} aria-current={current || undefined} className="spr-card" data-current={current || undefined}>
        <div className="spr-card-top">
          <div className="spr-badges">
            {status === "addressed" ? <Badge variant="success">{t("Fixed")}</Badge>
              : status === "fixing" ? <Badge variant="neutral">{t("Fixing…")}</Badge>
                : finding.verdict ? <Badge variant={finding.verdict === "CONFIRMED" ? "danger" : "warning"}>{finding.verdict === "CONFIRMED" ? t("Confirmed") : t("Plausible")}</Badge>
                  : null}
            {finding.category && <Badge variant="neutral">{finding.category}</Badge>}
          </div>
          {onDismiss && <SourceSettingsButton size="sm" variant="secondary" icon="X" iconSize="auto" iconOnly className="spr-card-dismiss" aria-label={t("Dismiss finding")}
            onClick={() => { const node = card.current; if (node?.contains(node.ownerDocument.activeElement)) node.closest(".source-changes")?.focus?.({ preventScroll: true }); onDismiss(); }} />}
        </div>
        <p className="spr-summary">{finding.summary}</p>
        {finding.detail && <p className="spr-detail">{finding.detail}</p>}
        {status === "open" && (onFix || onNext) && (
          <div className="spr-card-actions">
            {onFix && <button type="button" className="spr-fix" onClick={() => { card.current?.focus({ preventScroll: true }); onFix(); }}>{t("Fix this one")}</button>}
            {onNext && <button type="button" className="spr-next" onClick={onNext}>{t("Next →")}</button>}
          </div>
        )}
      </div>
    </div>
  );
}
