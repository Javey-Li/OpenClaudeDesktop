import React, { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { addToPrompt, planCommentsStore, serializePlanComments } from "./inline-comments.mjs";
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
// sessionId: plan comments (panes-tile-current.js:1600-1700 wp/Plan comment): select text in the plan, comment on it;
// the comments ride the plan review's Revise (source-plan-card.jsx) or go to the composer ('Add to prompt').
export function SourcePlanPane({ plan, document = null, renderMarkdown = null, sessionId = null }) {
  const todos = Array.isArray(plan) && plan.length > 0 ? plan : null;
  const content = typeof document === "string" && document ? document : null;
  const commentable = !!content && !!sessionId;
  const wrap = useRef(null), prose = useRef(null), field = useRef(null);
  const [pending, setPending] = useState(null), [draft, setDraft] = useState(null);
  useSyncExternalStore(planCommentsStore.subscribe, planCommentsStore.version, planCommentsStore.version);
  const comments = commentable ? planCommentsStore.get(sessionId) : [];
  useLayoutEffect(() => { if (draft) field.current?.focus({ preventScroll: true }); }, [draft?.quote]);
  // A selection inside the plan offers 'Comment' just under it.
  const select = () => {
    if (!commentable || draft) return;
    const selection = typeof window !== "undefined" ? window.getSelection() : null;
    const text = selection && !selection.isCollapsed ? selection.toString().trim() : "";
    if (!text || !prose.current?.contains(selection.anchorNode) || !prose.current.contains(selection.focusNode)) { setPending(null); return; }
    const rect = selection.getRangeAt(0).getBoundingClientRect(), box = wrap.current.getBoundingClientRect();
    setPending({ quote: text.slice(0, 2000), top: rect.bottom - box.top + 6, left: Math.max(0, Math.min(rect.left - box.left, box.width - 120)) });
  };
  const save = () => {
    if (!draft?.text?.trim()) return;
    if (draft.id) planCommentsStore.edit(sessionId, draft.id, draft.text); else planCommentsStore.add(sessionId, draft);
    setDraft(null); setPending(null);
    window.getSelection?.()?.removeAllRanges?.();
  };
  const fieldKeys = (event) => {
    if (event.nativeEvent?.isComposing) return;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setDraft(null); }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); save(); }
  };
  const editor = (position) => <div className="spp-comment-editor" style={position} role="group" aria-label={t("Plan comment")}>
    {draft.quote && <blockquote className="spp-comment-quote">{draft.quote}</blockquote>}
    <textarea ref={field} rows={3} aria-label={t("Plan comment")} placeholder={t("What should change here?")} value={draft.text}
      onChange={(event) => setDraft((value) => ({ ...value, text: event.target.value }))} onKeyDown={fieldKeys} />
    <div className="spp-comment-actions">
      <SourceSettingsButton size="sm" variant="ghost" onClick={() => setDraft(null)}>{t("Cancel")}</SourceSettingsButton>
      <SourceSettingsButton size="sm" variant="primary" disabled={!draft.text.trim()} onClick={save}>{draft.id ? t("Save") : t("Comment")}</SourceSettingsButton>
    </div>
  </div>;
  return (
    <div className={`${SCROLLER} source-plan`} data-plan-document={content ? "" : undefined}>
      <div className="mx-auto max-w-[68ch]" ref={wrap}>
        {commentable && <p className="spp-comment-hint">{t("Select any text to leave a comment for DeepSeek")}</p>}
        {content && (
          <div ref={prose} data-cds="Prose" data-prose-font="sans" data-size="sm" className="prose source-plan-document" onMouseUp={select} onKeyUp={select}>
            {renderMarkdown ? renderMarkdown(content) : <p className="whitespace-pre-wrap">{content}</p>}
          </div>
        )}
        {pending && !draft && <SourceSettingsButton size="sm" className="spp-comment-start" style={{ top: pending.top, left: pending.left }} icon="Chat" iconSize={14}
          onMouseDown={(event) => event.preventDefault()} onClick={() => setDraft({ quote: pending.quote, text: "" })}>{t("Comment")}</SourceSettingsButton>}
        {draft && !draft.id && pending && editor({ top: pending.top, left: 0, right: 0 })}
        {comments.length > 0 && <section className="spp-comments" aria-label={t("Plan comments")}>
          <h2 className="text-caption-medium uppercase tracking-wide text-muted">{t("Comments")}</h2>
          {comments.map((entry) => draft?.id === entry.id ? <React.Fragment key={entry.id}>{editor(null)}</React.Fragment>
            : <article key={entry.id} className="spp-comment" data-plan-comment="">
              <blockquote className="spp-comment-quote">{entry.quote}</blockquote>
              <p className="spp-comment-text">{entry.text}</p>
              <div className="spp-comment-actions">
                <SourceSettingsButton size="sm" variant="ghost" onClick={() => setDraft({ id: entry.id, quote: entry.quote, text: entry.text })}>{t("Edit")}</SourceSettingsButton>
                <SourceSettingsButton size="sm" variant="ghost" onClick={() => planCommentsStore.remove(sessionId, entry.id)}>{t("Delete")}</SourceSettingsButton>
              </div>
            </article>)}
          <div className="spp-comments-footer">
            <span className="text-muted">{t("Sent with Revise on the plan card, or add them to your next message.")}</span>
            <SourceSettingsButton size="sm" variant="secondary" onClick={() => { if (addToPrompt(serializePlanComments(comments))) planCommentsStore.clear(sessionId); }}>{t("Add to prompt")}</SourceSettingsButton>
          </div>
        </section>}
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
