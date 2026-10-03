import React, { useLayoutEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { SourceTooltip } from "./source-tooltip";
import { createClipboardFeedback } from "./clipboard-feedback.mjs";
import { SourcePlanChecklist } from "./source-plan-checklist.jsx";
import "./source-plan-pane.css";
import { t } from "../electron/i18n/index.mjs";

// kp (panes-tile-current.js:1751-1790) over plan {content, todos}. The plan
// document is the latest proposed plan (state.planDocs: the Codex `plan` item,
// which the DeepSeek bridge projects from exit_plan_mode); the todos are
// turn/plan/updated. Every branch is the h-full select-text scroller around
// the mx-auto 68ch column. Content: Dp (:1716-1750), the Markdown in the CDS
// Prose (Ti font sans, size sm), then Op when todos exist. Todos only: Op,
// section.mt-pad-lg with the Nd caption heading (ca7d7d34d:
// text-caption-medium uppercase tracking-wide, muted tone) "Tasks" above the
// ZO list. Neither: SourcePlanEmpty. Not ported: the wp comment hint
// (:1676-1700; plan comments do not exist locally) and Mp's "Open in" menu.
// renderMarkdown(text) is the pane's response renderer (SourceMarkdown).
const SCROLLER = "h-full select-text overflow-y-auto [contain:strict] [scrollbar-gutter:stable_both-edges] p-lg";
function SourcePlanTasks({ plan }) {
  return (
    <section className="mt-pad-lg source-plan-tasks">
      <h2 className="text-caption-medium uppercase tracking-wide text-muted mb-1.25">{t("Tasks")}</h2>
      <SourcePlanChecklist plan={plan} />
    </section>
  );
}
export function SourcePlanPane({ plan, document = null, renderMarkdown = null }) {
  const todos = Array.isArray(plan) && plan.length > 0 ? plan : null;
  const content = typeof document === "string" && document ? document : null;
  return (
    <div className={`${SCROLLER} source-plan`} data-plan-document={content ? "" : undefined}>
      <div className="mx-auto max-w-[68ch]">
        {content && (
          <div data-cds="Prose" data-prose-font="sans" data-size="sm" className="prose source-plan-document">
            {renderMarkdown ? renderMarkdown(content) : <p className="whitespace-pre-wrap">{content}</p>}
          </div>
        )}
        {todos && <SourcePlanTasks plan={todos} />}
      </div>
    </div>
  );
}

// Mp (:1830-1866): with plan content, a ghost icon-only base Button, Copy →
// Check, labelled "Copy plan" → "Copied" while the copy is fresh (the
// aria-label is its CDS tooltip); onMouseDown keeps the focus where it was.
export const PLAN_COPY_LABELS = Object.freeze({ copy: t("Copy plan"), copied: t("Copied") });
export function SourcePlanCopyButton({ document }) {
  const [state, setState] = useState("idle");
  const controller = useRef(null);
  useLayoutEffect(() => {
    const feedback = createClipboardFeedback({
      writeText: (value) => typeof navigator !== "undefined" && navigator.clipboard?.writeText
        ? navigator.clipboard.writeText(value) : Promise.reject(new Error("Clipboard unavailable")),
      onState: setState,
    });
    controller.current = feedback;
    return () => { controller.current = null; feedback.dispose(); };
  }, []);
  useLayoutEffect(() => { controller.current?.setText(document ?? ""); }, [document]);
  const copied = state === "copied";
  const label = copied ? PLAN_COPY_LABELS.copied : PLAN_COPY_LABELS.copy;
  return (
    <SourceTooltip content={label} side="bottom" hoverable={false}>
      <button type="button" className="source-icon-button spc-ghost" aria-label={label} data-plan-copy=""
        onMouseDown={(event) => event.preventDefault()} onClick={() => { void controller.current?.copy(); }}>
        <Icon name={copied ? "Check" : "Copy"} size={16} />
      </button>
    </SourceTooltip>
  );
}
