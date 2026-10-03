import React, { useEffect, useState } from "react";
import { SourceEmptyState } from "./source-transcript-states.jsx";
import "./source-pane-states.css";

// Changes/Plan pane body states (2.2553.1). Class strings are the source strings;
// every utility they name is in the loaded original /assets/v1/c6a992d55-Vcbdv79k.css.

// Spinner xo (readable/shared-frame-C_2npUJq.js:2300-2360, imported as La): bo
// sizes {sm 12/1.5, md 16/1.75, lg 20/2} through Wi (:1589, px/16 rem times
// --cds-rem-scale); nothing renders until `delay` ms have passed; track
// var(--cds-border), conic head var(--cds-text-muted) (inheritColor false);
// motion-reduce:animate-none stops the sweep.
const SPINNER_SIZES = { sm: { box: 12, stroke: 1.5 }, md: { box: 16, stroke: 1.75 }, lg: { box: 20, stroke: 2 } };
const rem = (px) => `calc(${px / 16}rem * var(--cds-rem-scale, 1))`;
export function SourceSpinner({ size = "sm", delay = 0 }) {
  const [shown, setShown] = useState(delay <= 0);
  useEffect(() => {
    if (delay <= 0) return undefined;
    const timer = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay]);
  if (!shown) return null;
  const { box, stroke } = SPINNER_SIZES[size] ?? SPINNER_SIZES.sm, width = rem(box), line = rem(stroke);
  const at = `calc(100% - ${line})`, mask = `radial-gradient(farthest-side, transparent ${at}, #000 calc(${at} + 0.5px))`;
  return <span data-cds="Spinner" className="relative inline-block shrink-0 align-middle" style={{ width, height: width }} aria-hidden="true">
    <span className="absolute inset-0 rounded-full" style={{ border: `${line} solid var(--cds-border)` }} />
    <span className="absolute inset-0 rounded-full animate-[spin_1s_linear_infinite] motion-reduce:animate-none"
      style={{ background: "conic-gradient(transparent 40%, var(--cds-text-muted))", WebkitMask: mask, mask }} />
  </span>;
}

// rh (readable/tmp-shared-20-BrTrXIRV.js:2703-2717): "flex items-center
// justify-center" + className, lg Spinner with delay 1000. xo wraps a labelled
// spinner in span[role=status].leading-[0] whose label is sr-only text; locally
// the label is the status element's aria-label so it never paints and is named
// from the first frame (no visible text either way).
export function SourceLoadingPane({ label, className = "h-full w-full", delay = 1000 }) {
  return <div className={`flex items-center justify-center ${className} source-pane-state`}>
    <span role="status" aria-label={label} className="leading-[0]"><SourceSpinner size="lg" delay={delay} /></span>
  </div>;
}

// ke (readable/panes-diff-states-current.js:54-92): loading -> rh "Loading
// changes"; otherwise div[data-diff-pane-body][tabIndex=-1].h-full.w-full
// .outline-none around EmptyState P — failed: role=alert, icon Warning and the
// fixed retry copy (no error detail); else "No uncommitted changes" when
// uncommittedOnly, "No changes to show" otherwise.
export const CHANGES_LOADING_LABEL = "Loading changes";
export const CHANGES_FAILED_TITLE = "Couldn’t load the changes. Close and reopen this pane to try again.";
export function changesEmptyTitle(uncommittedOnly) { return uncommittedOnly ? "No uncommitted changes" : "No changes to show"; }
export function SourceChangesState({ state, uncommittedOnly = false }) {
  if (state === "loading") return <SourceLoadingPane label={CHANGES_LOADING_LABEL} />;
  const failed = state === "failed";
  return <div data-diff-pane-body="" tabIndex={-1} className="h-full w-full outline-none source-pane-state">
    <SourceEmptyState role={failed ? "alert" : undefined} icon={failed ? "Warning" : undefined}
      title={failed ? CHANGES_FAILED_TITLE : changesEmptyTitle(uncommittedOnly)} />
  </div>;
}

// kp (readable/panes-tile-current.js:1751-1766): no content and no todos ->
// EmptyState {icon Checklist, "No plan yet", body}. Honest local adaptation of
// the body: Codex, not Claude, writes the plan (turn/plan/updated) while it works.
export const PLAN_EMPTY_TITLE = "No plan yet";
export const PLAN_EMPTY_BODY = "DeepSeek writes the plan here as it works. Keep chatting.";
export function SourcePlanEmpty() {
  return <SourceEmptyState icon="Checklist" title={PLAN_EMPTY_TITLE} body={PLAN_EMPTY_BODY} />;
}

// Files pane tree states (2.2553.1 panes-tile-current.js Ig :5496-5512), all in
// Jg (:6101-6110) "flex items-center justify-center px-lg py-2.5 text-body
// text-muted": loading -> Yg (:6111-6113) a bare sm Spinner, read error with no
// data -> fixed copy (never the raw error), no rows -> "Folder is empty".
// Local addition: the loading box is role=status with an sr-only "Loading" name
// (Yg's spinner is aria-hidden and unlabelled), so the state is announced.
export const FILES_FOLDER_ERROR = "Couldn’t read this folder.";
export const FILES_FOLDER_EMPTY = "Folder is empty";
export const FILES_TREE_LOADING_LABEL = "Loading";
// Jg with "No working directory for this session" (panes-tile-current.js:4780-4786),
// the tree body of a pane without a working directory.
export const FILES_NO_WORKING_DIRECTORY = "No working directory for this session";
const FILES_TREE_STATE_CLASS = "flex items-center justify-center px-lg py-2.5 text-body text-muted";
export function SourceFilesTreeState({ state }) {
  if (state === "loading") return <div role="status" className={`${FILES_TREE_STATE_CLASS} source-files-tree-state`} data-tree-state="loading">
    <SourceSpinner size="sm" /><span className="sr-only">{FILES_TREE_LOADING_LABEL}</span>
  </div>;
  return <div className={`${FILES_TREE_STATE_CLASS} source-files-tree-state`} data-tree-state={state}>
    {state === "error" ? FILES_FOLDER_ERROR : state === "no-cwd" ? FILES_NO_WORKING_DIRECTORY : FILES_FOLDER_EMPTY}
  </div>;
}

// Lg (panes-tile-current.js:5547-5570): the only row Pg (:5335-5350) adds for a
// subfolder without data is a failed read, {kind:"error"} at the children's
// depth. A focusable (tabIndex -1) treeitem the roving keys reach, with no
// [data-tree-primary] button, so Enter/Space/click do nothing; style ko(depth)
// (c621b1e2d o) = paddingLeft 8 + depth * 8 over px-lg.
export function SourceTreeErrorRow({ depth }) {
  return <div role="treeitem" aria-level={depth + 1} data-tree-row="" tabIndex={-1}
    className="source-tree-error flex items-center min-h-control px-lg text-body text-muted outline-none"
    style={{ paddingLeft: 8 + depth * 8 }}>
    <span className="truncate">{FILES_FOLDER_ERROR}</span>
  </div>;
}

// Empty file preview (panes-tile-current.js:6355-6390): EmptyState yu (the
// cc0a875c8 EmptyState SourceEmptyState restates) with icon Folder inside
// "flex min-h-0 min-w-0 flex-1 flex-col". p = open tab count, N = tree shown.
// Clicking a file path in the transcript opens the Files pane locally too.
export function filesEmptyPreviewCopy({ tabs, treeShown }) {
  return tabs > 0
    ? { title: "No file selected", body: "Pick an open file above, or click a file path in the conversation." }
    : { title: "Open files appear here", body: treeShown
      ? "Pick a file in the tree, or click a file path in the conversation."
      : "Click a file path in the conversation to open it." };
}
export function SourceFilesEmptyPreview({ tabs, treeShown }) {
  const { title, body } = filesEmptyPreviewCopy({ tabs, treeShown });
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col source-file-empty-preview">
    <SourceEmptyState icon="Folder" title={title} body={body} />
  </div>;
}
