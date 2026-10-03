import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";
import { parseUnifiedDiff } from "./diff-model";
import { previewHunks } from './file-preview-model.mjs';
import { useDiffHunk } from './use-diff-hunk.mjs';
import { SourceHighlightedLine } from './source-diff-code.jsx';
import { splitDiffRows, observeDiffSplitFit } from './diff-view-model.mjs';
import { diffSeparators } from './diff-separator-model.mjs';
import { contextRegions, expandContext, visibleContext } from './diff-context-model.mjs';
import { copyChoices, headerTooltip, pathParts, renamedFrom, renamedFromDisplay, rowLabels, splitPosixPath, stripClipboardControls } from './diff-file-header-model.mjs';
import { fileKindIcon } from './file-kind-icon.mjs';
import { SourceTooltip } from './source-tooltip';
import { SourceMenu } from './source-menu.jsx';
import { SourceSettingsButton } from './source-settings-button.jsx';
import { CONTEXT_MENU_ALIGN_OFFSET, CONTEXT_MENU_SIDE_OFFSET } from './menu-model.mjs';
import { hideWhitespaceChanges } from './diff-whitespace-model.mjs';
import { useSourcePointerResize } from './use-pointer-resize.js';
import { DIFF_FILE_LIST_LABELS, DIFF_FILE_LIST_WIDTH, clampDiffFileListWidth, diffFileEntries, diffFileList, diffFileListCanFit, diffFileListLimit,
  isLargeDiff, kindSectionOpen, openKindSections, orderDiffSections, revealCollapsed, toggleCollapsed, treeRowTarget } from './diff-file-list-model.mjs';
import "./source-diff.css";

// Tn (panes-diff-view-current.js:377-401) with hideWhitespace: gn filters the
// file's own patch; a re-indent-only file keeps its row (counts stay the file's
// real +/-) with whitespaceOnly:true and no body ('Whitespace only' row label),
// otherwise the hunks come from the filtered patch. Parser fallbacks and files
// without hunks are left as they are.
export function withoutWhitespaceChanges(section) {
  if (section?.type !== "file" || section.fallbackReason || !section.hunks?.length || typeof section.raw !== "string") return section;
  const filtered = hideWhitespaceChanges(section.raw);
  if (filtered.whitespaceOnly) return { ...section, hunks: [], whitespaceOnly: true };
  const reparsed = parseUnifiedDiff(filtered.patch).files[0];
  if (!reparsed || reparsed.fallbackReason || !reparsed.hunks.length) return section;
  return { ...section, hunks: reparsed.hunks };
}

function RawPatch({ value, reason }) {
  // Preserve unsupported patch text and classify only visible +/- syntax.
  // There are deliberately no line-number columns or fabricated file counts.
  const chunks = value.length <= 4 * 1024 * 1024 ? value.match(/[^\n]*\n|[^\n]+$/g) || [] : null;
  const lines = chunks?.length <= 50000 ? chunks : null;
  return <div className="sdiff-raw">
    {reason && <div className="sdiff-notice">{reason}. Showing original patch.</div>}
    <pre className="sdiff-raw-code">{lines ? lines.map((line, index) => <code key={index}
      className={line.startsWith("+") && !line.startsWith("+++") ? "added" : line.startsWith("-") && !line.startsWith("---") ? "removed" : ""}>{line}</code>) : value}</pre>
  </div>;
}

// Inline placement only (approval FileChanges); the Changes placement uses the
// c219730b0 W row labels from diff-file-header-model.mjs instead.
function metadata(file) {
  const labels = [];
  if (file.binary) labels.push("Binary file");
  if (file.renamedFrom && file.renamedFrom !== file.path) labels.push(`Renamed from ${file.renamedFrom}`);
  if (file.copiedFrom) labels.push(`Copied from ${file.copiedFrom}`);
  if (file.status === "added") labels.push("New file");
  if (file.status === "deleted") labels.push("Deleted file");
  if (file.oldMode && file.newMode && file.oldMode !== file.newMode) {
    labels.push(file.oldMode === "100644" && file.newMode === "100755" ? "Made executable"
      : file.oldMode === "100755" && file.newMode === "100644" ? "No longer executable"
      : `Mode ${file.oldMode} → ${file.newMode}`);
  } else if (file.newMode && file.status === "added") labels.push(`Mode ${file.newMode}`);
  else if (file.oldMode && file.status === "deleted") labels.push(`Mode ${file.oldMode}`);
  return labels;
}

function DiffLine({ row, lines, wordRanges, side }) {
  if (!row) return <div className="sdiff-split-side sdiff-split-empty" aria-hidden="true"/>;
  const number = side === 'before' ? row.oldLine : row.newLine ?? row.oldLine;
  return <div className={`sdiff-row ${row.type}${side ? ' sdiff-split-side' : ''}`} data-kind={row.type} data-side={side} data-old-line={row.oldLine ?? undefined} data-new-line={row.newLine ?? undefined}>
    <div className="sdiff-line-number" aria-hidden="true">{number}</div>
    <div className="sdiff-code-cell"><span className="sdiff-marker" aria-hidden="true">{row.type === 'added' ? '+' : row.type === 'removed' ? '−' : ' '}</span>
      <code className="sdiff-line-content scb-code source-diff-code"><SourceHighlightedLine tokens={lines[row.side]?.[row.line] || [{ text: row.text }]} ranges={wordRanges?.[row.rowIndex]}/></code>
      {row.notes?.map((text, index) => <div className="sdiff-note" key={index}><code>{text}</code></div>)}
    </div>
  </div>;
}
function DiffHunk({ hunk, file, scopeKey, layout, separator, wordDiff = true }) {
  const ref = useRef(null);
  const fragment = useMemo(() => previewHunks(hunk.rows)[0] || { rows: [], before: '', after: '' }, [hunk.rows]);
  const split = useMemo(() => splitDiffRows(fragment.rows), [fragment.rows]);
  const { lines, wordRanges, highlighted } = useDiffHunk({ hunk: fragment, beforePath: file.oldPath || file.path, afterPath: file.newPath || file.path, scopeKey, wordDiff }, ref);
  return <div className="sdiff-hunk" ref={ref} data-highlighted={highlighted ? '' : undefined} data-word-diff={wordRanges ? '' : undefined}>
    {separator && <div className="sdiff-hunk-separator" data-separator={separator.kind}
      data-separator-first={separator.first || undefined} title={hunk.header}>
      <div className="sdiff-separator-content"><span>{separator.text}</span></div>
    </div>}
    {layout === 'split' ? split.map((pair, index) => <div className="sdiff-split-row" key={index}>
      <DiffLine row={pair.before} side="before" lines={lines} wordRanges={wordRanges}/><DiffLine row={pair.after} side="after" lines={lines} wordRanges={wordRanges}/>
    </div>) : fragment.rows.map((row, index) => row.type === 'note'
      ? <div key={index} className="sdiff-note"><code>{row.text}</code></div>
      : <DiffLine key={index} row={{ ...row, rowIndex: index }} lines={lines} wordRanges={wordRanges}/>)}
  </div>;
}

// Static 16px symbol geometry from c64baa838; independently implemented
// controls below use native buttons so expansion is also keyboard accessible.
function ExpandIcon({ direction }) {
  return <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor" data-expand-direction={direction}>
    <path d={direction === 'both'
      ? 'M11.47 9.47a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 1 1 1.06-1.06L8 12.94zM7.526 1.418a.75.75 0 0 1 1.004.052l4 4a.75.75 0 1 1-1.06 1.06L8 3.06 4.53 6.53a.75.75 0 1 1-1.06-1.06l4-4z'
      : 'M3.47 5.47a.75.75 0 0 1 1.06 0L8 8.94l3.47-3.47a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 0-1.06'}/>
  </svg>;
}

function ContextGap({ region, onExpand }) {
  const directions = region.chunked ? [...(region.first ? [] : ['up']), ...(region.last ? [] : ['down'])]
    : [region.first ? 'down' : region.last ? 'up' : 'both'];
  return <div className="sdiff-hunk-separator sdiff-context-gap" data-separator="line-info" data-expand-index={region.id}
    data-separator-first={region.first || undefined} data-separator-last={region.last || undefined}>
    <div className="sdiff-separator-wrapper" data-multi-button={directions.length > 1 || undefined}>
      {directions.map(direction => <button key={direction} type="button" className="sdiff-expand" data-direction={direction}
        aria-label={region.remaining <= 100 ? `Expand ${region.remaining} unmodified lines` : `Expand 100 lines ${direction === 'both' ? 'in both directions' : direction === 'up' ? 'below previous change' : 'above next change'}`}
        onClick={event => onExpand(region, direction, event.currentTarget)}><ExpandIcon direction={direction}/></button>)}
      <button type="button" className="sdiff-separator-content" title="Expand unmodified lines"
        onClick={event => onExpand(region, 'both', event.currentTarget)}><span>{region.remaining} unmodified line{region.remaining === 1 ? '' : 's'}</span></button>
    </div>
  </div>;
}

// c219730b0 He: the 16px chevron path (rotated -90deg while collapsed).
const CHEVRON = 'M3.47 5.47a.75.75 0 0 1 1.06 0L8 8.94l3.47-3.47a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 0-1.06';
// c219730b0 Ue: row label class.
const ROW_LABEL_CLASS = 'min-w-0 shrink-[9999] truncate text-body text-muted';

// c784da984 c: directory prefix (truncating) then the last segment; title
// defaults to the path and "" suppresses it; aria-label only with a prefix.
function PathSegments({ path, title = path }) {
  const [directory, base] = splitPosixPath(path);
  return <span dir="ltr" className="flex min-w-0 overflow-hidden whitespace-nowrap" title={title || undefined} aria-label={directory ? path : undefined}>
    {directory && <span className="min-w-0 truncate">{directory}</span>}
    <span className={directory ? 'max-w-full shrink-0 truncate' : 'min-w-0 truncate'}>{base}</span>
  </span>;
}

// c784da984 p (We passes title "", posix): basename first, then the directory as
// footnote muted text that fades out (data-clipped) once its box is narrower
// than min(dir + last, min(last, 5em) + 1em) - the d() ResizeObserver measure.
function DiffPathLabel({ path }) {
  const { base, directory } = pathParts(path);
  const ref = useRef(null);
  useLayoutEffect(() => {
    const node = ref.current, view = node?.ownerDocument.defaultView;
    if (!node || typeof view?.ResizeObserver !== 'function') return undefined;
    const observer = new view.ResizeObserver(entries => {
      for (const entry of entries) {
        const size = parseFloat(view.getComputedStyle(node).fontSize) || 0, parts = node.firstElementChild?.children;
        const last = parts?.length ? (parts[parts.length - 1]?.scrollWidth ?? 0) : 0;
        const first = parts && parts.length > 1 ? (parts[0]?.scrollWidth ?? 0) : 0;
        const need = Math.min(first + last, Math.min(last, 5 * size) + (first > 0 ? size : 0));
        node.toggleAttribute('data-clipped', entry.contentRect.width < need - 1);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [directory]);
  return <span dir="ltr" className="flex min-w-0 items-baseline gap-1 overflow-hidden whitespace-nowrap">
    <span className="max-w-full shrink-0 truncate">{base}</span>
    {directory && <span ref={ref} className="sdiff-path-directory flex min-w-0 text-footnote text-muted data-[clipped]:opacity-0">
      <PathSegments path={directory} title="" />
    </span>}
  </span>;
}

// c219730b0 Ke: "Renamed from {path}" with the c784da984 c path whose title is
// the full previous path (the only native title the source header carries).
function RenamedFrom({ path, previous }) {
  return <span className="sdiff-renamed flex min-w-0 shrink-[9999] items-baseline gap-1 overflow-hidden whitespace-nowrap text-body text-muted">
    <span className="min-w-0 truncate">Renamed from </span>
    <span className="flex min-w-0 shrink-[9999]"><PathSegments path={renamedFromDisplay(path, previous)} title={previous} /></span>
  </span>;
}

/* Changes placement header: panes-diff-view-current.js:3700-3774 aa over
   c219730b0 We (content), Ze (Open file) and $e (context menu). The trigger
   div carries group/diff-file; hover/focus-within reveal is local CSS
   (source-diff.css) because pointer-coarse:opacity-100 is not in the loaded
   utility copy. hasBody (:3279 meta !== null && hunks.length > 0): a file with
   no text hunks (pure rename, empty new/deleted file, mode-only or binary change)
   gets the aa no-body button - aria-disabled, no aria-expanded, no onClick - and
   We's disabled chevron (opacity-40, collapsed rotation); it renders no body.
   Local adaptations: a toggle with a body keeps aria-controls, a parser fallback
   file (source meta === null) keeps its toggle because the local body shows the
   original patch text instead of hiding it, the
   context menu opens from the contextmenu event (right click, Shift+F10 or the
   Menu key on the focused toggle), and renderFileMenuItems (c856385e2 Vn: Open
   in / remote links) has no local capability, so nothing follows Open file.
   'Attach as context' (c856385e2 Hn attachFileToChat) uses the composer's real
   path-referenced file attachment (main.jsx attachDiffFile -> stageFiles ->
   mention); it is withheld for deleted files, whose path no longer exists. */
function ChangesFileHeader({ file, path, expanded, hasBody, bodyId, onToggle, actions }) {
  const headerRef = useRef(null), toggleRef = useRef(null);
  const [menu, setMenu] = useState(null);
  const real = !!file.path, deleted = file.status === 'deleted';
  // 3469: onOpenFile is withheld for removed files (n.removed ? void 0 : It).
  const onOpenFile = real && !deleted && actions?.onOpenFile ? actions.onOpenFile : undefined;
  const onAttachFile = real && !deleted && actions?.onAttachFile ? actions.onAttachFile : undefined;
  const onCopy = real && actions?.onCopy ? actions.onCopy : undefined;
  const previous = renamedFrom(file), labels = rowLabels(file);
  // We renders +{additions} / −{deletions} unconditionally (aa passes them for
  // binary files too; a binary patch has 0/0 text lines). Only a parser fallback
  // file is without counts: diff-model sets added/removed to null (unknown), and
  // a number there would be invented.
  const counts = Number.isFinite(file.added) && Number.isFinite(file.removed);
  const open = hasBody && expanded;
  const choices = onCopy ? copyChoices(actions.root, file.path) : null;
  // c3e58cab4 f: control characters stripped; the toast follows a written copy.
  const copy = (text) => onCopy(stripClipboardControls(text));
  return <div ref={headerRef} className="sdiff-header group/diff-file relative" data-diff-file-header=""
    onContextMenu={onCopy ? (event) => { event.preventDefault(); event.stopPropagation(); setMenu({ x: event.clientX, y: event.clientY }); } : undefined}>
    {/* aa :3717-3723: onClick/aria-expanded only with a body, else aria-disabled. */}
    <button ref={toggleRef} type="button" className="sdiff-file-toggle aria-disabled:cursor-default" aria-disabled={hasBody ? undefined : true}
      aria-expanded={hasBody ? expanded : undefined} aria-controls={hasBody ? bodyId : undefined} onClick={hasBody ? onToggle : undefined}>
      <span aria-hidden="true" className={`sdiff-chevron flex items-center justify-center size-[16px] shrink-0 text-muted${hasBody ? '' : ' opacity-40'}`}>
        <svg width={16} height={16} viewBox="0 0 16 16"
          className={`transition-transform duration-fast motion-reduce:transition-none${open ? '' : ' -rotate-90'}`}>
          <path d={CHEVRON} fill="currentColor" />
        </svg>
      </span>
      <Icon name={fileKindIcon(path.slice(path.lastIndexOf('/') + 1))} size={12} className="sdiff-file-kind shrink-0 text-muted" />
      <SourceTooltip content={headerTooltip(file, path)} delay={150} multiline side="bottom" hoverable={false}>
        <span className="sdiff-path flex min-w-0 text-body text-secondary"><DiffPathLabel path={path} /></span>
      </SourceTooltip>
      {previous !== undefined && <RenamedFrom path={path} previous={previous} />}
      {labels.map((label) => <span key={label.row} className={`sdiff-row-label ${ROW_LABEL_CLASS}`}>{label.row}</span>)}
      {counts && <span className="sdiff-counts flex shrink-0 items-center gap-0.5 text-body tabular-nums">
        <span className="text-git-added">{`+${file.added}`}</span><span className="text-git-removed">{`−${file.removed}`}</span>
      </span>}
      {onOpenFile && <span aria-hidden="true" data-size="xs" className="w-control shrink-0" />}
    </button>
    {onOpenFile && <span className="sdiff-open-file absolute inset-y-0 right-0 flex items-center pr-md opacity-0 transition-opacity motion-reduce:transition-none group-hover/diff-file:opacity-100 group-focus-within/diff-file:opacity-100 pointer-coarse:opacity-100">
      <SourceTooltip content="Open file" side="bottom" hoverable={false}>
        <SourceSettingsButton size="xs" variant="ghost" icon="ArrowUpRight" iconSize="auto-sm" iconOnly aria-label="Open file" onClick={() => onOpenFile(file.path)} />
      </SourceTooltip>
    </span>}
    {menu && <SourceMenu.Popup anchor={headerRef.current} trigger={toggleRef.current} point={menu} side="bottom" align="start"
      sideOffset={CONTEXT_MENU_SIDE_OFFSET} alignOffset={CONTEXT_MENU_ALIGN_OFFSET} layer="contextmenu" dataCds="ContextMenu"
      label={`${path} actions`} onClose={() => setMenu(null)}>
      {onAttachFile && <SourceMenu.Item onClick={() => onAttachFile(file.path)}>Attach as context</SourceMenu.Item>}
      {/* c3e58cab4 p: SubmenuPopup side right, align start, sideOffset -4. */}
      <SourceMenu.Submenu>
        <SourceMenu.SubmenuTrigger>Copy</SourceMenu.SubmenuTrigger>
        <SourceMenu.Popup label="Copy" side="right" align="start" sideOffset={-4}>
          {choices.absolute && <SourceMenu.Item onClick={() => copy(choices.absolute)}>Absolute path</SourceMenu.Item>}
          <SourceMenu.Item onClick={() => copy(choices.relative)}>Relative path</SourceMenu.Item>
          <SourceMenu.Item onClick={() => copy(choices.filename)}>Filename</SourceMenu.Item>
        </SourceMenu.Popup>
      </SourceMenu.Submenu>
      {onOpenFile && <><SourceMenu.Separator /><SourceMenu.Item onClick={() => onOpenFile(file.path)}>Open file</SourceMenu.Item></>}
    </SourceMenu.Popup>}
  </div>;
}

function FileDiff({ file, scopeKey, layout, completeContext, foldAll = null, placement = "inline", fileActions = null, wordDiff = true, defaultExpanded = true, reveal = null }) {
  // vo defaultCollapsed (panes-diff-view-current.js:5258-5276, :5647): a large
  // diff (Qe) mounts every file collapsed.
  const [expanded, setExpanded] = useState(defaultExpanded);
  // Selecting the file in the Changed files column (scrollToAnnotation -> Xt/Zt,
  // :5346-5381) expands it; a request seen at mount is not replayed.
  const appliedReveal = useRef(reveal?.seq);
  useLayoutEffect(() => {
    if (!reveal || appliedReveal.current === reveal.seq) return;
    appliedReveal.current = reveal.seq;
    if (reveal.path === file.path) setExpanded(true);
  }, [reveal, file.path]);
  // Collapse/Expand all files (fh diff-fold, panes-tile-current.js:3775-3809 ->
  // requestDiffFoldAll {collapsed, seq}, panes-state-current.js:2809-2821): a new
  // seq folds every rendered file once; the source consumes the request
  // (consumeDiffFoldAll), so files mounted later keep the default and manual
  // toggles afterwards still work.
  const appliedFold = useRef(foldAll?.seq);
  useEffect(() => {
    if (!foldAll || appliedFold.current === foldAll.seq) return;
    appliedFold.current = foldAll.seq;
    setExpanded(!foldAll.collapsed);
  }, [foldAll]);
  const [copyState, setCopyState] = useState("");
  const [contextState, setContextState] = useState(null);
  const fileRef = useRef(null), expansionFocus = useRef(null);
  const regions = useMemo(() => contextRegions(file, completeContext), [file, completeContext]);
  const context = useMemo(() => regions && visibleContext(regions, contextState?.file === file ? contextState.expanded : {}), [regions, file, contextState]);
  const expand = (region, direction, target) => {
    if (target.ownerDocument.activeElement === target) expansionFocus.current = target;
    setContextState(previous => ({ file, expanded: expandContext(previous?.file === file ? previous.expanded : {}, region, direction) }));
  };
  useLayoutEffect(() => {
    const target = expansionFocus.current;
    if (target && !target.isConnected) fileRef.current?.querySelector('.sdiff-file-body')?.focus({ preventScroll: true });
    expansionFocus.current = null;
  }, [context]);
  const bodyId = useId();
  const changes = placement === "changes";
  // panes-diff-view-current.js:3279 hasBody; a fallback file's body is its raw patch.
  const hasBody = !changes || !!file.fallbackReason || file.hunks.length > 0;
  // The metadata-only body line below is reachable only in the inline placement
  // (a Changes file without hunks has no body, see hasBody).
  const labels = changes ? [] : metadata(file);
  const separators = useMemo(() => diffSeparators(file.hunks), [file.hunks]);
  const path = file.path || "Patch";
  const copy = async () => {
    try { await navigator.clipboard.writeText(file.raw); setCopyState("Copied patch"); }
    // Catalog clipboard failure wording (en-US ugO0/irMRD), as the code-block copy.
    catch { setCopyState("Couldn’t copy to the clipboard. Try again."); }
  };
  const maximum = file.hunks.reduce((highest, hunk) => Math.max(highest,
    hunk.oldStart + hunk.oldCount - 1, hunk.newStart + hunk.newCount - 1), 1);
  return <section className="sdiff-file" ref={fileRef} data-file-path={file.path || undefined} data-complete-context={regions ? '' : undefined}>
    {changes ? <ChangesFileHeader file={file} path={path} expanded={expanded} hasBody={hasBody} bodyId={bodyId} onToggle={() => setExpanded((value) => !value)} actions={fileActions} />
    : <div className="sdiff-header">
      <button type="button" className="sdiff-file-toggle" aria-expanded={expanded} aria-controls={bodyId}
        title={[path, ...labels].join(" · ")} onClick={() => setExpanded((value) => !value)}>
        <Icon name="CaretDown" size={16} className={`sdiff-caret${expanded ? "" : " is-collapsed"}`} />
        <Icon name="File" size={12} className="sdiff-file-icon" />
        <div className="sdiff-path">{path}</div>
        {labels.length > 0 && <div className="sdiff-meta">{labels.join(" · ")}</div>}
        {file.hunks.length > 0 && !file.fallbackReason && <div className="sdiff-counts" aria-label={`${file.added} additions, ${file.removed} deletions`}>
          <b className="sdiff-count-added">+{file.added}</b><b className="sdiff-count-removed">−{file.removed}</b>
        </div>}
      </button>
      {typeof navigator !== "undefined" && navigator.clipboard?.writeText && <button type="button" className="sdiff-copy"
        aria-label={`Copy patch for ${path}`} title={copyState || "Copy patch"} onClick={copy}>
        <Icon name={copyState === "Copied patch" ? "Check" : "Copy"} size={12} />
      </button>}
    </div>}
    {!changes && copyState && <div className="sdiff-copy-status" role="status">{copyState}</div>}
    {expanded && hasBody && <div id={bodyId} className="sdiff-file-body" tabIndex={-1} style={{ "--sdiff-number-width": `${Math.max(3, String(maximum).length)}ch` }}>
      {file.fallbackReason ? <RawPatch value={file.raw} reason={file.fallbackReason} />
        : context ? context.map(region => region.kind === 'gap'
          ? <ContextGap key={region.id} region={region} onExpand={expand}/>
          : <DiffHunk key={region.id} hunk={region} file={file} layout={layout} wordDiff={wordDiff} scopeKey={JSON.stringify([scopeKey, file.id, file.path, region.id])}/>)
        : file.hunks.length ? file.hunks.map((hunk, index) => <DiffHunk key={index} hunk={hunk} separator={separators[index]} file={file} layout={layout} wordDiff={wordDiff} scopeKey={JSON.stringify([scopeKey, file.id, file.path, index])}/>)
          : <div className="sdiff-metadata-only">{labels.join(" · ") || "No text hunks in this patch"}</div>}
    </div>}
  </section>;
}

// Changed files column rows: c621b1e2d n/a/r/o (row, idle, active, indent), the
// same module the Files tree rows use; source-diff.css restates them unlayered
// because the global `button` reset (style.css) beats the layered utilities.
const TREE_ROW = 'flex items-center gap-1 h-control pr-md rounded text-body text-left w-full select-none focus-visible:outline-hidden hide-focus-ring focus-visible:shadow-focus';
const TREE_ROW_IDLE = 'bg-alpha-0 text-primary hover:bg-fill-ghost-hover data-[pressed]:bg-fill-ghost-hover';
const TREE_ROW_ACTIVE = 'bg-fill-control hover:bg-fill-control text-primary';
const treeIndent = (depth) => ({ paddingLeft: 8 + depth * 8 });
const TREE_ROW_SELECTOR = '[data-diff-tree-row]';

// Ka (panes-diff-view-current.js:4412-4424): a row unmounting with focus inside
// (its folder or section collapsed) hands focus back to the tree.
function useTreeRowFocusReturn() {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const node = ref.current;
    return () => {
      if (node?.contains(node.ownerDocument.activeElement)) node.closest('[role="tree"]')?.focus({ preventScroll: true });
    };
  }, []);
  return ref;
}

// Xa (:4579-4600): footnote +N / −N; a parser fallback (unknown counts) has none.
function DiffTreeCounts({ additions, deletions }) {
  if (!Number.isFinite(additions) || !Number.isFinite(deletions)) return null;
  return <span className="sdiff-tree-counts flex shrink-0 items-center gap-0.5 text-footnote tabular-nums">
    <span className="text-git-added">{`+${additions}`}</span><span className="text-git-removed">{`−${deletions}`}</span>
  </span>;
}

// Ja (:4467-4508): a folder row toggles its subtree.
function DiffTreeFolder({ node, depth, collapsed, onToggle, ...rest }) {
  const ref = useTreeRowFocusReturn();
  const isCollapsed = collapsed.has(node.path);
  return <>
    <button ref={ref} type="button" style={treeIndent(depth)} data-diff-tree-row="" role="treeitem" tabIndex={-1} aria-level={depth + 1}
      aria-expanded={!isCollapsed} onClick={() => onToggle(node.path)} className={`sdiff-tree-row ${TREE_ROW} ${TREE_ROW_IDLE}`}>
      <Icon name="CaretRight" size={12} className={`sdiff-tree-caret shrink-0 text-muted transition-transform duration-fast motion-reduce:transition-none${isCollapsed ? '' : ' rotate-90'}`} />
      <span className="truncate">{node.name}</span>
    </button>
    {!isCollapsed && node.children.map((child) => <DiffTreeNode key={child.path} node={child} depth={depth + 1} collapsed={collapsed} onToggle={onToggle} {...rest} />)}
  </>;
}

// Ya (:4509-4578): kind icon, name (or the folder-prefixed path in the flat
// list, c784da984 posix with no title), counts; aria-current while selected.
// Comment counts (Za) and the row context menu (Qa) have no local source.
function DiffTreeFile({ node, depth, showDirectory, activePath, onSelect, onOpenFile }) {
  const ref = useTreeRowFocusReturn();
  const active = activePath === node.path;
  const directory = node.path.slice(0, -(node.name.length + 1));
  const withDirectory = showDirectory && directory !== '';
  return <button ref={ref} type="button" style={treeIndent(depth)} data-diff-tree-row="" role="treeitem" tabIndex={-1} aria-level={depth + 1}
    aria-current={active || undefined} className={`sdiff-tree-row ${TREE_ROW} ${active ? TREE_ROW_ACTIVE : TREE_ROW_IDLE}`}
    onClick={(event) => {
      // T (:4146-4155): ⌘/Ctrl-click opens a file that still exists.
      if (onOpenFile && !node.removed && (event.metaKey || event.ctrlKey)) { onOpenFile(node.path); return; }
      onSelect(node.path);
    }}>
    <Icon name={fileKindIcon(node.name)} size={12} className="shrink-0 text-muted" />
    {withDirectory
      ? <span className="flex min-w-0 flex-1"><PathSegments path={node.path} title="" /></span>
      : <span className="truncate min-w-0 flex-1">{node.name}</span>}
    <DiffTreeCounts additions={node.additions} deletions={node.deletions} />
  </button>;
}

// qa (:4425-4466)
function DiffTreeNode({ node, ...props }) {
  return node.kind === 'dir' ? <DiffTreeFolder node={node} {...props} /> : <DiffTreeFile node={node} {...props} />;
}

// Ga (:4334-4411): roving focus over the visible rows.
function diffTreeKeyDown(event) {
  const tree = event.currentTarget;
  if (!tree.contains(event.target) || (event.altKey && event.key !== 'Tab') || ((event.metaKey || event.ctrlKey) && event.key !== 'Enter')) return;
  const rows = [...tree.querySelectorAll(TREE_ROW_SELECTOR)];
  if (rows.length === 0) return;
  const focused = tree.ownerDocument.activeElement;
  const index = rows.findIndex((row) => row === focused || row.contains(focused));
  const row = index >= 0 ? rows[index] : null;
  const focusRow = (target) => {
    const next = rows[target];
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.scrollIntoView?.({ block: 'nearest' });
  };
  const target = treeRowTarget(event.key, { index, count: rows.length, currentIndex: rows.findIndex((entry) => entry.hasAttribute('aria-current')) });
  if (target !== null) { focusRow(target); return; }
  if (event.key === 'Tab') { if (event.shiftKey && row) tree.focus({ preventScroll: true }); return; }
  if (event.key === 'ArrowRight') {
    if (!row) return;
    event.preventDefault();
    const expanded = row.getAttribute('aria-expanded');
    if (expanded === 'false') row.click(); else if (expanded === 'true') focusRow(index + 1);
    return;
  }
  if (event.key === 'ArrowLeft') {
    if (!row) return;
    event.preventDefault();
    if (row.getAttribute('aria-expanded') === 'true') { row.click(); return; }
    const level = Number(row.getAttribute('aria-level') ?? '1');
    for (let at = index - 1; at >= 0; at--) if (Number(rows[at].getAttribute('aria-level') ?? '1') < level) { focusRow(at); return; }
    return;
  }
  if (event.key === 'Enter' && row && (event.metaKey || event.ctrlKey) && !event.shiftKey) {
    event.preventDefault();
    const view = tree.ownerDocument.defaultView ?? window;
    row.dispatchEvent(new view.MouseEvent('click', { bubbles: true, cancelable: true, metaKey: event.metaKey, ctrlKey: event.ctrlKey }));
  }
}
// Wa (:4320-4333): keyboard focus landing on the tree moves to the selected (else first) row.
function diffTreeFocus(event) {
  const tree = event.currentTarget;
  if (event.target !== tree || tree.contains(event.relatedTarget)) return;
  let visible = false;
  try { visible = tree.matches(':focus-visible'); } catch { visible = false; }
  if (!visible) return;
  const row = tree.querySelector(`${TREE_ROW_SELECTOR}[aria-current]`) ?? tree.querySelector(TREE_ROW_SELECTOR);
  row?.focus();
  row?.scrollIntoView?.({ block: 'nearest' });
}

// Ra + Ba (:4096-4300): "Changed files" tree; folders (or the flat list) first,
// then the separated Test / Build / Generated sections when grouping by kind.
function DiffFileTree({ list, tree, activePath, onSelect, onOpenFile }) {
  const ref = useRef(null);
  // Pa/La: collapsed folders per scope ("source" or a kind), all open by default.
  const [collapsed, setCollapsed] = useState(() => ({}));
  // Ia: kind sections open only while they hold the selected file until toggled.
  const [sectionsOpen, setSectionsOpen] = useState(() => ({}));
  useLayoutEffect(() => {
    if (activePath === null) return;
    setCollapsed((previous) => {
      let changed = false;
      const next = {};
      for (const [scope, set] of Object.entries(previous)) { next[scope] = revealCollapsed(set, activePath); changed ||= next[scope] !== set; }
      return changed ? next : previous;
    });
    setSectionsOpen((previous) => openKindSections(previous, list.sections, activePath));
  }, [activePath]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (activePath !== null) ref.current?.querySelector(`${TREE_ROW_SELECTOR}[aria-current]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [activePath, tree, list]);
  const toggleIn = (scope) => (path) => setCollapsed((previous) => ({ ...previous, [scope]: toggleCollapsed(previous[scope] ?? EMPTY_SET, path) }));
  const rows = (nodes, scope, depth) => nodes.map((node) => <DiffTreeNode key={node.path} node={node} depth={depth} showDirectory={!tree}
    collapsed={collapsed[scope] ?? EMPTY_SET} onToggle={toggleIn(scope)} activePath={activePath} onSelect={onSelect} onOpenFile={onOpenFile} />);
  return <div ref={ref} role="tree" aria-label={DIFF_FILE_LIST_LABELS.changedFiles} tabIndex={0} onKeyDown={diffTreeKeyDown} onFocus={diffTreeFocus}
    className="sdiff-file-list-tree h-full overflow-y-auto px-xs py-1.25 outline-none hide-focus-ring">
    {rows(list.nodes, 'source', 0)}
    {list.sections.map((section) => {
      const open = kindSectionOpen(sectionsOpen[section.kind], activePath !== null && section.paths.includes(activePath));
      return <div key={section.kind} role="none" className={section.separated ? 'mt-1 border-t pt-1' : undefined}>
        <DiffTreeSection section={section} open={open} onToggle={() => setSectionsOpen((previous) => ({ ...previous, [section.kind]: !open }))} />
        {open && rows(section.nodes, section.kind, 1)}
      </div>;
    })}
  </div>;
}
const EMPTY_SET = new Set();
// Ba header row (:4249-4285).
function DiffTreeSection({ section, open, onToggle }) {
  const ref = useTreeRowFocusReturn();
  return <button ref={ref} type="button" style={treeIndent(0)} data-diff-tree-row="" data-diff-tree-section={section.kind} role="treeitem" tabIndex={-1}
    aria-level={1} aria-expanded={open} onClick={onToggle} className={`sdiff-tree-row ${TREE_ROW} ${TREE_ROW_IDLE}`}>
    <Icon name="CaretRight" size={12} className={`sdiff-tree-caret shrink-0 text-muted transition-transform duration-fast motion-reduce:transition-none${open ? ' rotate-90' : ''}`} />
    <span className="truncate min-w-0 flex-1 text-secondary">{section.label}</span>
    <span className="shrink-0 text-footnote tabular-nums text-muted">{section.count}</span>
  </button>;
}

/* The Changes body with the "Changed files" column (panes-diff-view-current.js
   :5296-5330 Ot resize, :5530-5590 column/edge/shield/body; cf3dc7910 d).
   Width (diffTreeWidth) and visibility (diffShowTree) belong to the caller
   (tile-layout-store via FilePane). The column fits from 400px (So) of body
   width; until measured it counts as fitting (diffCanFitTree ?? true) and the
   result is reported upward (onCanFitTreeChange). Handles reuse the Files tree
   divider/edge (source-session.css .source-tree-divider/.source-tree-edge) and
   use-pointer-resize.js: dragging the column under MIN/2 hides it at the end,
   dragging the edge past MIN/2 shows it, a click on the edge shows it, a
   double-click resets the width; keys as the Files tree divider. */
function ChangesFileLayout({ fileList, entries, activePath, onSelect, onOpenFile, banner, children }) {
  const layoutRef = useRef(null);
  const [bodyWidth, setBodyWidth] = useState(0);
  useLayoutEffect(() => {
    const node = layoutRef.current, view = node?.ownerDocument.defaultView;
    if (!node) return undefined;
    const measure = () => { const width = node.offsetWidth; if (width > 0) setBodyWidth(width); };
    measure();
    if (typeof view?.ResizeObserver !== 'function') return undefined;
    const observer = new view.ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const canFit = diffFileListCanFit(bodyWidth);
  const reportFit = useRef(fileList.onCanFitChange);
  reportFit.current = fileList.onCanFitChange;
  useEffect(() => { reportFit.current?.(canFit); }, [canFit]);
  const tree = fileList.tree !== false, groupByKind = !!fileList.groupByKind;
  const list = useMemo(() => diffFileList(entries, { tree, groupByKind }), [entries, tree, groupByKind]);
  const { MIN, DEFAULT } = DIFF_FILE_LIST_WIDTH;
  // Unmeasured: the stored width, capped by the column's CSS max-width only.
  const limit = bodyWidth > 0 ? diffFileListLimit(bodyWidth) : DIFF_FILE_LIST_WIDTH.MAX;
  const width = clampDiffFileListWidth(fileList.width);
  const shown = !!fileList.shown && canFit;
  const [drag, setDrag] = useState(null);
  const startWidth = useRef(0), handleFocus = useRef(null);
  const visibleWidth = Math.min(drag?.width ?? width, limit);
  const commitWidth = (value) => fileList.onWidthChange?.(Math.max(MIN, Math.min(limit, Math.round(value))));
  const setShown = (value) => fileList.onShownChange?.(value);
  const focusedHandle = () => layoutRef.current?.ownerDocument.activeElement?.closest?.('.sdiff-file-list-divider, .sdiff-file-list-edge');
  const divider = useSourcePointerResize({
    onStart: () => { startWidth.current = visibleWidth; },
    onMove: (delta) => {
      const value = startWidth.current + delta;
      setDrag({ width: Math.max(MIN, Math.min(limit, value)), hidden: value < MIN / 2 });
    },
    onEnd: (delta) => {
      const value = startWidth.current + delta;
      setDrag(null);
      if (value < MIN / 2) { if (focusedHandle()) handleFocus.current = 'edge'; setShown(false); }
      else if (delta !== 0) commitWidth(value);
    },
    onCancel: () => setDrag(null),
  });
  const edge = useSourcePointerResize({
    onStart: () => { startWidth.current = 0; },
    onMove: (delta) => setDrag(delta >= MIN / 2 ? { width: Math.max(MIN, Math.min(limit, delta)), preview: true } : { preview: false }),
    onEnd: (delta) => {
      setDrag(null);
      const click = Math.abs(delta) < 3;
      if (!click && delta < MIN / 2) return;
      if (!click) commitWidth(delta);
      if (focusedHandle()) handleFocus.current = 'divider';
      setShown(true);
    },
    onCancel: () => setDrag(null),
  });
  useLayoutEffect(() => {
    const target = handleFocus.current;
    if (!target) return;
    handleFocus.current = null;
    layoutRef.current?.querySelector(target === 'edge' ? '.sdiff-file-list-edge' : '.sdiff-file-list-divider')?.focus({ preventScroll: true });
  }, [shown]);
  function dividerKeyDown(event) {
    if (event.metaKey || event.altKey || event.ctrlKey) return;
    const step = event.shiftKey ? 120 : 24;
    let value;
    if (event.key === 'ArrowLeft') value = visibleWidth - step;
    else if (event.key === 'ArrowRight') value = visibleWidth + step;
    else if (event.key === 'Home') value = MIN;
    else if (event.key === 'End') value = limit;
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!event.repeat) { handleFocus.current = 'edge'; setShown(false); }
      return;
    } else return;
    event.preventDefault();
    commitWidth(value);
  }
  const columnRendered = shown || !!drag?.preview;
  const resizing = divider.dragging || edge.dragging;
  return <div ref={layoutRef} className="sdiff-changes-layout" data-file-list-shown={shown || undefined} data-resizing={resizing || undefined}>
    {columnRendered && <div className="sdiff-file-list relative shrink-0 flex flex-col min-h-0 border-r"
      style={{ width: visibleWidth, minWidth: `min(${MIN}px, 100% - 160px)`, maxWidth: `min(${DIFF_FILE_LIST_WIDTH.MAX}px, 100% - 160px)`, display: drag?.hidden ? 'none' : undefined }}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DiffFileTree list={list} tree={tree} activePath={activePath} onSelect={onSelect} onOpenFile={onOpenFile} />
      </div>
      {shown && <div className="source-tree-divider sdiff-file-list-divider" role="separator" tabIndex={0} aria-label={DIFF_FILE_LIST_LABELS.resize}
        aria-orientation="vertical" aria-valuemin={MIN} aria-valuemax={limit} aria-valuenow={Math.round(visibleWidth)}
        onPointerDown={divider.onPointerDown} onDoubleClick={() => commitWidth(DEFAULT)} onKeyDown={dividerKeyDown}><span /></div>}
    </div>}
    {canFit && !shown && <div className="source-tree-edge sdiff-file-list-edge" role="separator" tabIndex={0} aria-label={DIFF_FILE_LIST_LABELS.showFiles}
      aria-orientation="vertical" aria-valuemin={0} aria-valuemax={DIFF_FILE_LIST_WIDTH.MAX} aria-valuenow={0} onPointerDown={edge.onPointerDown}
      onKeyDown={(event) => {
        if (!['Enter', ' ', 'ArrowRight'].includes(event.key) || event.metaKey || event.altKey || event.ctrlKey) return;
        event.preventDefault();
        if (event.repeat) return;
        handleFocus.current = 'divider';
        setShown(true);
      }}><span /></div>}
    <div className="sdiff-changes-main">
      {banner}
      <div className="source-changes">{children}</div>
    </div>
  </div>;
}

/** Render only the actual local Codex/Git patch; no inferred unchanged lines.
 * placement "changes" (the Changes pane, source-session.jsx FilePane) renders the
 * c219730b0 We/Ze/$e header with fileActions {root, onCopy, onOpenFile,
 * onAttachFile}; the default "inline" placement (approval-card FileChanges) keeps
 * its existing header (path · metadata, native title, Copy patch).
 * wordDiff / hideWhitespace are the Changes "Highlight changed words" and "Hide
 * whitespace changes" preferences (panes-tile-current.js:3597-3598, 3805-3835);
 * hideWhitespace runs the gn port per file (diff-whitespace-model.mjs, Tn
 * panes-diff-view-current.js:377-401).
 * R10, placement "changes" only:
 * - large diff (Qe, panes-diff-view-current.js:5221-5232): the listed files'
 *   additions + deletions above 5000 mount every file collapsed, show the
 *   muted banner (:5589-5597) and report onIsLargeChange(isLarge).
 * - fileList {shown, width, tree, groupByKind, onShownChange, onWidthChange,
 *   onCanFitChange}: the body is laid out beside the "Changed files" column
 *   (ChangesFileLayout, which also owns the .source-changes scroller), files
 *   follow the column order (Mn tree/list path order, ka by kind), and selecting
 *   a row expands that file and scrolls it to the top (Zt). */
export function SourceDiff({ value = "", scopeKey = "standalone", layout = "unified", wordWrap = true, completeContext = false, onCanFitSplitChange, foldAll = null, placement = "inline", fileActions = null,
  wordDiff = true, hideWhitespace = false, fileList = null, onIsLargeChange }) {
  const root = useRef(null), [canFitSplit, setCanFitSplit] = useState(true);
  useLayoutEffect(() => observeDiffSplitFit(root.current, fit => { setCanFitSplit(fit); onCanFitSplitChange?.(fit); }), [scopeKey, onCanFitSplitChange]);
  const actualLayout = layout === "split" && canFitSplit ? "split" : "unified";
  const changes = placement === "changes";
  const parsed = useMemo(() => parseUnifiedDiff(value), [value]);
  const entries = useMemo(() => (changes ? diffFileEntries(parsed.sections) : []), [changes, parsed]);
  const large = changes && isLargeDiff(entries);
  const listed = !!fileList, tree = fileList?.tree !== false, groupByKind = !!fileList?.groupByKind;
  const sections = useMemo(() => {
    const ordered = listed ? orderDiffSections(parsed.sections, { tree, groupByKind }) : parsed.sections;
    return hideWhitespace ? ordered.map(withoutWhitespaceChanges) : ordered;
  }, [parsed, hideWhitespace, listed, tree, groupByKind]);
  const reportLarge = useRef(onIsLargeChange);
  reportLarge.current = onIsLargeChange;
  useEffect(() => { if (changes) reportLarge.current?.(large); }, [changes, large]);
  const [activePath, setActivePath] = useState(null);
  const [reveal, setReveal] = useState(null);
  const selectFile = useCallback((path) => {
    setActivePath(path);
    setReveal((previous) => ({ path, seq: (previous?.seq ?? 0) + 1 }));
  }, []);
  // Zt: the selected file's section to the top of the scroller (block start).
  useEffect(() => {
    if (!reveal) return;
    const node = [...(root.current?.querySelectorAll('.sdiff-file[data-file-path]') ?? [])].find((section) => section.dataset.filePath === reveal.path);
    const scroller = node?.closest('.source-changes');
    if (!node) return;
    if (!scroller) { node.scrollIntoView?.({ block: 'start' }); return; }
    scroller.scrollTop += node.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  }, [reveal]);
  const banner = changes && large && entries.length > 0
    ? <div className="sdiff-large-banner shrink-0 px-md py-1.25 text-body text-muted">{DIFF_FILE_LIST_LABELS.largeBanner}</div> : null;
  const view = <div ref={root} key={scopeKey} data-layout={actualLayout} data-word-wrap={wordWrap} data-word-highlight={wordDiff} data-hide-whitespace={hideWhitespace || undefined} data-large-diff={large || undefined} className="source-diff diff sdiff-view" data-source-component="FileDiff" data-placement={placement} aria-label="File changes">
    {!listed && banner}
    {sections.map((section) => section.type === "file"
      ? <FileDiff key={`${section.id}:${section.path}`} file={section} scopeKey={scopeKey} layout={actualLayout} completeContext={completeContext} foldAll={foldAll} placement={placement} fileActions={fileActions} wordDiff={wordDiff}
        defaultExpanded={!large} reveal={changes ? reveal : null} />
      : <RawPatch key={section.id} value={section.raw} reason={section.reason} />)}
  </div>;
  if (!listed) return view;
  return <ChangesFileLayout fileList={fileList} entries={entries} activePath={activePath} onSelect={selectFile} onOpenFile={fileActions?.onOpenFile} banner={banner}>{view}</ChangesFileLayout>;
}
