import React, { useCallback, useMemo, useSyncExternalStore } from "react";
import { Icon } from "./icons";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { SourceTooltip } from "./source-tooltip";
import { fileKindIcon } from "./file-kind-icon.mjs";
import { fileBasename } from "./file-tool-model.mjs";
import { turnEditFolderHints, turnEditsListView } from "./turn-edits-model.mjs";
import { createToolGroupExpansion } from "./tool-group-expansion.mjs";
import { tn, t } from "../electron/i18n/index.mjs";
import "./source-turn-edits.css";

// 2.31226.0 cd5a31703 v2e 'turn_edits_card' (readable :71797-71964) over s0/c0/f0/p0/m0/h2e/g2e/h0 (:71543-71757) and the
// c425fb3cf card classes (V card, U list, Q disclosure caret): after a finished turn that edited files, one list.
// Several files: a header row (ChangesPlusMinus, 'Edited # files', the s0 totals, a chevron, the 'View this turn’s
// changes' tooltip) that opens the Changes pane, with Undo as its action (latest turn, idle: it asks the agent to put
// the files back), then one row per file (file-kind icon, name with a g2e folder hint when names repeat, counts,
// chevron) that opens that file's diff, three at most before 'Show {count} more' (expansion remembered per turn, dS).
// One file: that file's row is the whole card, with Undo. Each file row carries data-file-ref, so a right-click opens
// the transcript's file path menu (n_ surface 'transcript', source-transcript.jsx fileRefMenu).
// Not ported: the artifact row (claude.ai artifacts), the embedded 'Changes' disclosure (no local embedded host),
// ranOnComputer/readRefused (remote-host files and the cloud read gate).

// dS (cc6e9624e): a turn's Show more state outlives the row's unmount (virtualized transcript, session switches).
const turnEditsExpansion = createToolGroupExpansion();

/** s0: `flex shrink-0 items-center gap-0.5 text-body tabular-nums`, '+a' text-git-added and '−d' (U+2212) text-git-removed. */
function EditCounts({ additions, deletions }) {
  return <span className="ste-edits-counts">
    <span className="ste-adds">+{additions}</span><span className="ste-dels">{"−"}{deletions}</span>
  </span>;
}

/** m2e: `flex shrink-0 text-secondary`, CaretRight 14. */
function RowChevron({ expanded }) {
  return <span className="ste-edits-chevron" aria-hidden="true">
    <Icon name="CaretRight" size={14} className="ste-edits-caret" data-expanded={expanded || undefined} />
  </span>;
}

/** f0: action (pointer-events-auto), then meta and chevron (gap-2.5); the column itself lets clicks through to the row. */
function RowTrail({ action, meta, chevron }) {
  if (action === undefined && meta === undefined && chevron === undefined) return null;
  return <span className="ste-edits-trail">
    {action !== undefined && <span className="ste-edits-action">{action}</span>}
    {(meta !== undefined || chevron !== undefined) && <span className="ste-edits-meta">{meta}{chevron}</span>}
  </span>;
}

/** p0: li c0 > (button u0 | span l0) > d0 [icon, label, detail] + f0. The button's ::before is the row's hover fill. */
function EditRow({ icon, label, meta, onOpen, chevron = false, tooltip, action, filePath }) {
  const content = <span className="ste-edits-main">
    <span className="ste-edits-icon">{icon}</span>
    <span className="ste-edits-label">{label}</span>
  </span>;
  let hit = onOpen
    ? <button type="button" className="ste-edits-hit" data-file-ref={filePath} onClick={onOpen}>{content}</button>
    : <span className="ste-edits-hit ste-edits-static" data-file-ref={filePath}>{content}</span>;
  if (onOpen && tooltip !== undefined) hit = <SourceTooltip content={tooltip}>{hit}</SourceTooltip>;
  return <li className="ste-edits-row">
    {hit}
    <RowTrail action={action} meta={meta} chevron={onOpen && chevron ? <RowChevron /> : undefined} />
  </li>;
}

/** m0: one file (name, then the folder hint as footnote muted text with an sr-only comma). */
function FileRow({ file, folderHint, onOpen, tooltip, action }) {
  const name = fileBasename(file.path) || file.path;
  const open = useCallback(() => onOpen?.(file.path), [onOpen, file.path]);
  return <EditRow icon={<Icon name={fileKindIcon(name)} size={16} />}
    label={folderHint === undefined ? name : <>{name}<span className="ste-edits-hint"><span className="sr-only">, </span>{folderHint}</span></>}
    meta={<EditCounts additions={file.additions} deletions={file.deletions} />}
    onOpen={onOpen ? open : null} chevron tooltip={tooltip} action={action} filePath={file.path} />;
}

/** h2e: a 16px spacer, 'Show {count} more' / 'Show less' (text-secondary), the Q caret turning 90° while expanded. */
function MoreRow({ count, expanded, onToggle }) {
  return <li className="ste-edits-row">
    <button type="button" className="ste-edits-hit" aria-expanded={expanded} onClick={onToggle}>
      <span className="ste-edits-main">
        <span aria-hidden="true" className="ste-edits-spacer" />
        <span className="ste-edits-label ste-edits-more">{expanded ? t("Show less") : t("Show {count} more", { count })}</span>
      </span>
    </button>
    <RowTrail chevron={<RowChevron expanded={expanded} />} />
  </li>;
}

/** h0: the file rows, three until 'Show {count} more'. */
function FileList({ files, onOpen, expansionKey }) {
  const expanded = useSyncExternalStore(turnEditsExpansion.subscribe, () => turnEditsExpansion.get(expansionKey) ?? false, () => false);
  const hints = useMemo(() => turnEditFolderHints(files), [files]);
  const { shown, hidden } = turnEditsListView(files, expanded);
  return <>
    {shown.map((file) => <FileRow key={file.path} file={file} folderHint={hints.get(file.path)} onOpen={onOpen} />)}
    {hidden > 0 && <MoreRow count={hidden} expanded={expanded} onToggle={() => turnEditsExpansion.set(expansionKey, !expanded)} />}
  </>;
}

export function SourceTurnEdits({ edits, turnId, sessionKey = null, onUndo, onView, onViewFile }) {
  if (!edits?.files?.length) return null;
  const files = edits.files;
  const single = files.length === 1 ? files[0] : null;
  // v2e f (onView): the header (and a lone file's row) reveals the first file the Changes diff lists, else opens the
  // pane; x2e h (onViewFile): a row reveals its own file there, else opens it in the Files pane.
  const viewTurn = onView ?? (onViewFile ? () => onViewFile(files[0].path) : null);
  const viewTooltip = t("View this turn’s changes");
  // E: Undo, ghost xxs footnote; onMouseDown keeps focus where it was (f_).
  const undo = onUndo ? <SourceTooltip content={t("Ask the agent to undo this turn’s file changes")}>
    <SourceSettingsButton variant="ghost" size="xxs" className="ste-undo" onMouseDown={(event) => event.preventDefault()} onClick={onUndo}>{t("Undo")}</SourceSettingsButton>
  </SourceTooltip> : undefined;
  return <div className="source-message ste-edits" data-turn-edits={turnId} data-single={single ? "" : undefined}>
    <ul role="list" className="ste-edits-list">
      {single
        ? <FileRow file={single} onOpen={viewTurn ? () => viewTurn() : null} tooltip={viewTurn ? viewTooltip : undefined} action={undo} />
        : <>
          <EditRow icon={<Icon name="ChangesPlusMinus" size={16} />} label={tn(files.length, "Edited a file", "Edited {count} files")}
            meta={<EditCounts additions={edits.additions} deletions={edits.deletions} />} onOpen={viewTurn} chevron tooltip={viewTooltip} action={undo} />
          <FileList files={files} onOpen={onViewFile ?? null} expansionKey={JSON.stringify([sessionKey, `turn-edits:${turnId}`])} />
        </>}
    </ul>
  </div>;
}
