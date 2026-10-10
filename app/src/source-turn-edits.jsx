import React, { useState } from "react";
import { Icon } from "./icons";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { SourceTooltip } from "./source-tooltip";
import { fileKindIcon } from "./file-kind-icon.mjs";
import { fileBasename } from "./file-tool-model.mjs";
import { tn, t } from "../electron/i18n/index.mjs";
import "./source-turn-edits.css";

// Vpe 'turn_edits_card' (approval-current.js:54299-54517, classes ion-dist c425fb3cf L/R/ee/z/B/H/U): after a
// finished turn that edited files, a column card. Several files: 'Edited # files', Undo (only the latest turn, while
// idle: it asks the agent to put the files back) and View changes (the Changes pane), a full-bleed separator, then one
// row per file (x8/b8: file-kind icon, basename, y8 counts, CaretRight) that opens that file's diff, five at most
// before 'Show {count} more' (S8/Bpe). One file: the header is that file's row (no label, no View changes).
const LIST_LIMIT = 5;

/** y8: `flex shrink-0 items-center gap-0.5 text-body tabular-nums`, '+a' text-git-added and '-d' text-git-removed. */
function EditCounts({ additions, deletions }) {
  return <span className="ste-counts" aria-label={t("{additions} added, {deletions} removed", { additions, deletions })}>
    <span className="ste-adds">+{additions}</span><span className="ste-dels">-{deletions}</span>
  </span>;
}

/** b8: icon + name (gap-1), then grow and the counts (inline: counts right after the name). */
function FileSummary({ file, inline }) {
  const name = fileBasename(file.path) || file.path;
  return <>
    <span className="ste-file-name-wrap">
      <Icon name={fileKindIcon(name)} size={12} className="ste-file-icon" />
      <span className="ste-file-name">{name}</span>
    </span>
    {!inline && <span className="ste-grow" />}
    <EditCounts additions={file.additions} deletions={file.deletions} />
  </>;
}

/** x8: a button when the file can be opened (H in the list, U in the header), else a plain span. */
function FileRow({ file, onOpen, inHeader = false, tooltip }) {
  if (!onOpen) return <span className={inHeader ? "ste-file-static ste-file-static-header" : "ste-file-static"}><FileSummary file={file} inline={inHeader} /></span>;
  const button = <button type="button" className={inHeader ? "ste-file-row ste-file-row-header" : "ste-file-row"} data-file-path={file.path} onClick={() => onOpen(file.path)}>
    <FileSummary file={file} inline={inHeader} />
    {!inHeader && <span className="ste-caret" aria-hidden="true"><Icon name="CaretRight" size={14} /></span>}
  </button>;
  return tooltip ? <SourceTooltip content={tooltip}>{button}</SourceTooltip> : button;
}

/** S8 + Bpe: the rows, five at most until 'Show {count} more' (its CaretRight turns 90° while expanded). */
function FileList({ files, onOpen }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? files : files.slice(0, LIST_LIMIT), hidden = files.length - LIST_LIMIT;
  return <ul role="list" className="ste-list">
    {shown.map((file) => <li key={file.path} className="ste-list-item"><FileRow file={file} onOpen={onOpen} /></li>)}
    {hidden > 0 && <li className="ste-list-item">
      <button type="button" className="ste-file-row ste-more" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
        <span className="ste-more-label">{expanded ? t("Show less") : t("Show {count} more", { count: hidden })}</span>
        <span className="ste-caret" aria-hidden="true"><Icon name="CaretRight" size={14} className="ste-more-caret" data-expanded={expanded || undefined} /></span>
      </button>
    </li>}
  </ul>;
}

export function SourceTurnEdits({ edits, turnId, onUndo, onView, onViewFile }) {
  if (!edits?.files?.length) return null;
  const files = edits.files;
  const single = files.length === 1 ? files[0] : null;
  // Wpe: a row opens its file in the Changes pane; the single-file header (k = p) opens the turn's changes there.
  const openFile = onViewFile ?? null;
  const headerOpen = single && (onViewFile || onView) ? (path) => (onViewFile ? onViewFile(path) : onView()) : null;
  const viewButton = !single && onView;
  return <div className="source-message ste-edits" data-turn-edits={turnId} data-single={single ? "" : undefined} role="group" aria-label={t("Changes")}>
    <div className={onUndo || viewButton ? "ste-header ste-header-actions" : "ste-header"}>
      {single
        ? <FileRow file={single} onOpen={headerOpen} inHeader tooltip={headerOpen && onView ? t("View this turn’s changes") : undefined} />
        : <span className="ste-label">{tn(files.length, "Edited a file", "Edited {count} files")}</span>}
      {!(single && headerOpen) && <span className="ste-grow" />}
      {onUndo && <SourceTooltip content={t("Ask the agent to undo this turn’s file changes")}>
        <SourceSettingsButton variant="ghost" data-step="1" className="ste-undo" onClick={onUndo}>{t("Undo")}</SourceSettingsButton>
      </SourceTooltip>}
      {viewButton && <SourceTooltip content={t("View this turn’s changes")}>
        <SourceSettingsButton variant="secondary" data-step="1" className="ste-view" onClick={onView}>{t("View changes")}</SourceSettingsButton>
      </SourceTooltip>}
    </div>
    {!single && <>
      <div aria-hidden="true" className="ste-separator" />
      <FileList files={files} onOpen={openFile} />
    </>}
  </div>;
}
