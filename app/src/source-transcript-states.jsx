import React from "react";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { Icon } from "./icons";
import "./source-transcript-states.css";

// Transcript pane states of approval-entry-current.js (2.2553.1):
// _d :1141-1190 pending -> gd -> Zw skeleton, :4211-4217 xu load failure and
// :4224-4233 Cl "No messages yet". Class strings are the source strings; every
// utility they name is in the loaded original /assets/v1/c6a992d55-Vcbdv79k.css.

// ion-dist shared-8-B5xbG2px.js O_: per-paragraph line widths of the k_ skeleton.
export const SKELETON_PARAGRAPHS = [["w-[96%]", "w-full", "w-[92%]", "w-[58%]"], ["w-full", "w-[94%]", "w-[41%]"], ["w-[97%]", "w-[90%]", "w-[66%]"]];
// shared-frame hc wave motion: --cds-skel-i cycles through floor(ic 2000 / oc 90) slots.
const WAVE_SLOTS = Math.floor(2000 / 90);
// k_ Xi = gc (shared-frame :3448-3480) inside a SkeletonGroup (Ns context true), so
// the group branch renders: no role, no ::after shimmer, class X(c,"h-[1em] max-w-full
// rounded bg-[var(--cds-skeleton-base)]",n). X is tailwind-merge (shared-frame :230 Pt
// with borderRadius theme key "card"), so the caller's h-/w-/max-w-/rounded-card win;
// the strings below are that merge's output. The breathe animation comes from the
// loaded design-system rule [data-cds=SkeletonGroup][data-motion=wave] [data-cds=Skeleton].
const BUBBLE_CLASS = "bg-[var(--cds-skeleton-base)] box-content h-[1lh] w-72 max-w-[85%] rounded-card py-md text-heading";
const lineClass = (width) => `max-w-full rounded bg-[var(--cds-skeleton-base)] h-[0.72em] ${width}`;
// hc's wave effect assigns --cds-skel-i in DOM order from 0 to every Skeleton that has
// none; this markup is static, so the same indices are written at render time.
const Bar = ({ className, index }) => <div data-cds="Skeleton" className={className} style={{ "--cds-skel-i": String(index % WAVE_SLOTS) }} />;

// Zw (readable/shared-22-Cz3C_T8d.js:5356-5374) around k_ (shared-8 k_) held by hc
// (shared-frame :3206+). gd (approval-entry-current.js:1126-1139) always passes an
// object hold: {none:"handoff"} when the __gb__2846116625 gate (cfc63964b b(),
// default false) is on, else {none:"route"}. An object hold is not "delayed", so hc
// renders data-hold="none" data-shown immediately with no reveal delay; the local
// route is the gate-off branch. hasEarlier is false locally (no earlier-page
// indicator exists), so the top padding is 48. Zw's inner column also carries the
// message-column class f_ (shared-12 Km: mx-auto, 768px measure, 32px gutters); the
// local .source-transcript-content already applies that column padding around it.
// hc's onAnimationStart pc() cross-document phase sync is not reproduced (one document).
export function SourceTranscriptSkeleton({ hasEarlier = false, holdReason = "route" }) {
  let index = 0;
  return <div data-transcript-skeleton="" aria-hidden="true" className="h-full overflow-hidden [scrollbar-gutter:stable_both-edges]" style={{ paddingTop: 48 + (hasEarlier ? 40 : 0) }}>
    <div className="w-full [--msg-gap:0px]">
      <div data-cds="SkeletonGroup" data-motion="wave" data-hold="none" data-hold-reason={holdReason} data-shown="" role="status"
        className="text-prose flex flex-col fade-out-bottom h-[calc(100vh-12.5rem)]">
        <span className="sr-only" data-skeleton-label="true">Loading</span>
        <div aria-hidden="true" className="contents">
          <div data-testid="chat-message-skeleton" className="contents">
            <div className="mt-[var(--msg-gap,1.5rem)] flex shrink-0 justify-end"><Bar className={BUBBLE_CLASS} index={index++} /></div>
            <div className="mt-xs mb-xs h-6 shrink-0" />
            <div className="flex shrink-0 flex-col gap-[0.75em] pl-[var(--msg-text-inset,0.5rem)] pr-[var(--msg-inset-end,0.5rem)]">
              {SKELETON_PARAGRAPHS.map((lines, paragraph) => <div key={paragraph} className="flex flex-col">
                {lines.map((width, line) => <div key={line} className="flex h-[1lh] items-center"><Bar className={lineClass(width)} index={index++} /></div>)}
              </div>)}
            </div>
            <div className="mt-xs h-6 shrink-0" />
          </div>
        </div>
      </div>
    </div>
  </div>;
}

// EmptyState u (ion-dist cc0a875c8-B6xI6vLN.js): root r, optional string icon
// (Icon size "lg" = 24px glyph, class i "!size-7 text-muted" = 28px box), text
// block a, title o, body s, actions c. The children slot is unused by these callers.
export function SourceEmptyState({ icon, title, body, actions, role }) {
  return <div role={role} className="flex h-full flex-col items-center justify-center gap-md px-lg py-lg text-center source-empty-state">
    {icon && <Icon name={icon} size={24} className="!size-7 text-muted" aria-hidden="true" />}
    <div className="flex flex-col items-center gap-1">
      <p className="max-w-[36ch] break-words text-body text-primary">{title}</p>
      {body && <p className="max-w-[36ch] break-words text-footnote text-muted">{body}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center justify-center gap-1">{actions}</div>}
  </div>;
}

// xu = V (ion-dist c4ea84cb3-BrWqBPlP.js) default branch: role=alert EmptyState,
// "Couldn’t load this session", B's default body (Codex reports no load-failure
// kind, so the kind-specific bodies never apply) and a primary CDS Button "Retry".
export const LOAD_FAILURE_TITLE = "Couldn’t load this session";
export const LOAD_FAILURE_BODY = "Something went wrong while loading earlier messages.";
export function SourceTranscriptLoadFailure({ onRetry }) {
  return <SourceEmptyState role="alert" title={LOAD_FAILURE_TITLE} body={LOAD_FAILURE_BODY}
    actions={<SourceSettingsButton variant="primary" onClick={onRetry}>Retry</SourceSettingsButton>} />;
}

// approval-entry-current.js:4224-4233 Cl with only the title.
export const EMPTY_TRANSCRIPT_TITLE = "No messages yet";
export function SourceTranscriptEmpty() {
  return <SourceEmptyState title={EMPTY_TRANSCRIPT_TITLE} />;
}
