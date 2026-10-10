import React, { startTransition, useCallback, useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";
import { SourceTooltip } from "./source-tooltip";
import { SourcePopover } from "./source-popover.jsx";
import { fileKindIcon } from "./file-kind-icon.mjs";
import { breadcrumbFolders, fileFindShortcut, findInText, findStatus, folderLabel, stepFindIndex } from "./file-find-model.mjs";
import { useSettledHighlight } from "./use-settled-highlight.mjs";
import { SourceHighlightedLine } from "./source-diff-code.jsx";
import { SourceEmptyState } from "./source-transcript-states.jsx";
import { SourceLoadingPane, SourceSpinner } from "./source-pane-states.jsx";
import { frontmatterLabel, MARKDOWN_FIRST_CHUNK_CHARS, MARKDOWN_PROGRESSIVE_CHARS, markdownChunkHeight, markdownFilePlan, releaseMarkdownFilePlan } from "./file-markdown-model.mjs";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { breadcrumbParts, csvTruncationCaption, fileHighlightLanguage, filePreviewKind, filePreviewUrl, fileViewerLines, fileViewerTooSlow, jumpRange, parseCsvPreview } from "./file-preview-model.mjs";
import { FILE_MEDIA_KINDS, fileMediaErrorCopy, fileTabReason, fileUnavailableCopy, VIEW_AS_TEXT_LABEL } from "./file-unavailable-model.mjs";
import "./highlight-tokens.css";
import "./source-file-viewer.css";
import { t } from "../electron/i18n/index.mjs";

// Files pane file viewer (2.2553.1 ion-dist/assets/v1/cd2efac6e-CAi4fxTN.js,
// prettier-formatted, jo :2576-4674). Mounted by FilePane for the active tab.
// gc (:3517-3530): a flex column of the Jo/Yo subheader lead (:4794-4872) and a
// flex-1 body. The body is one of: the Zo delayed lg Spinner "Loading file"
// (:4899-4910), an unavailable card (To/Un :3602-3740; binary :4604-4612 with
// Xo "View as text anyway" :4874-4897; empty :4336-4346), or the code view
// (P.Trigger [data-file-viewer] "epitaxy-diff flex-1 min-h-0 [contain:strict]"
// :4470-4480 around the File renderer with {disableFileHeader, overflow:"wrap"}
// :3152-3160). Local adaptation: the File renderer is the Read-row pipeline
// (source-file-tool.jsx ReadBody): fileHighlightLanguage + useSettledHighlight
// + tokenLines + SourceHighlightedLine, one numbered row per line.
// Previews (q = pn ? qo(…) : null, :2650-2657 and :4474-4651): Markdown and
// CSV/TSV render as a document by default, with the subheader Eye/Code toggle
// ("Preview" / "View source"); a file opened at a line starts on its source.
// Images, video and audio (nr/ir) render from their file:// URL.
export const FILE_VIEWER_LABELS = Object.freeze({
  loading: t("Loading file"),
  pathCopied: t("Path copied to clipboard."),
  plainNotice: t("Shown as plain text: formatting this file would be too slow."),
  // The subheader Eye/Code toggle (cd2efac6e :4169-4186).
  preview: t("Preview"),
  viewSource: t("View source"),
  // EpitaxyCsvPreview (cd5fd9055-AkFKEmX0.js).
  tablePreview: t("Table preview"),
  csvEmpty: t("This file is empty."),
  csvError: t("Couldn’t parse this file as a table. Switch to Source to view the raw text."),
});
export const copyPathLabel = (path) => t("Copy path {path}", { path });

// Yo (:4804-4872) with an onCopyPath and no lister: a button "text-body
// text-secondary flex min-w-0 text-left rounded-[3px] -mx-0.75
// hover:bg-fill-ghost-hover" labelled "Copy path {path}" around Ma (:1712-1790):
// span[data-file-breadcrumb] (RTL scroller, so a long path keeps its end in
// view, reset to the start when the file changes) > span[dir=ltr] with the
// leading slash, each folder in text-muted followed by a muted "/", then the
// file name in the default colour.
export function SourceFileBreadcrumb({ displayPath, fullPath, onCopyPath, lister = null }) {
  const { lead, dirs, name } = breadcrumbParts(displayPath);
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollLeft = 0; }, [fullPath]);
  // Yo with a lister (local sessions): a plain div whose folder segments and file name open "Files in {folder}".
  if (lister) {
    const folders = breadcrumbFolders(displayPath);
    return <div className="sfv-path" data-breadcrumb-lister="" title={fullPath}>
      <span ref={ref} data-file-breadcrumb="" className="sfv-breadcrumb">
        <span dir="ltr" className="sfv-breadcrumb-path">
          {folders.lead && <span className="sfv-crumb-lead">{folders.lead}</span>}
          {folders.dirs.map((segment, index) => <React.Fragment key={index}>
            <SourceBreadcrumbSegment segment={segment} className="sfv-crumb-dir" current={displayPath} lister={lister} />
            <span aria-hidden="true" className="sfv-crumb-separator">/</span>
          </React.Fragment>)}
          <SourceBreadcrumbSegment segment={folders.name} className="sfv-crumb-name" title={fullPath} current={displayPath} lister={lister} />
        </span>
      </span>
    </div>;
  }
  const crumbs = <span ref={ref} data-file-breadcrumb="" className="sfv-breadcrumb">
    <span dir="ltr" className="sfv-breadcrumb-path">
      {lead && <span className="sfv-crumb-lead">{lead}</span>}
      {dirs.map((dir, index) => <React.Fragment key={index}>
        <span className="sfv-crumb sfv-crumb-dir">{dir}</span><span className="sfv-crumb-separator">/</span>
      </React.Fragment>)}
      <span className="sfv-crumb sfv-crumb-name">{name}</span>
    </span>
  </span>;
  return onCopyPath
    ? <button type="button" className="sfv-path" aria-label={copyPathLabel(displayPath)} title={fullPath} onClick={onCopyPath}>{crumbs}</button>
    : <div className="sfv-path" title={fullPath}>{crumbs}</div>;
}

// Pa: ArrowDown opens a segment's folder, ArrowLeft / ArrowRight move between segments.
function segmentKeys(event, open) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.key === "ArrowDown") { event.preventDefault(); open(); return; }
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  const segments = [...(event.currentTarget.closest("[data-file-breadcrumb]")?.querySelectorAll("[data-breadcrumb-segment]") ?? [])];
  const at = segments.indexOf(event.currentTarget), next = segments[event.key === "ArrowRight" ? at + 1 : at - 1];
  if (at >= 0 && next) { event.preventDefault(); next.focus(); }
}

// Ia / Y: a segment inside the workspace is a button (Na "rounded-[3px] px-0.75 hover:bg-fill-ghost-hover
// data-[popup-open]:bg-fill-ghost-hover") opening the w-72 "Files in {folder}" popover; anything else is plain text.
function SourceBreadcrumbSegment({ segment, className, title, current, lister }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  if (segment.dir === null) return <span className={`sfv-crumb ${className}`} title={title}>{segment.label}</span>;
  const folder = folderLabel(segment.dir, lister.rootLabel ?? "");
  return <>
    <button ref={trigger} type="button" className={`sfv-crumb sfv-crumb-button ${className}`} title={title} data-breadcrumb-segment=""
      data-popup-open={open || undefined} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => setOpen((value) => !value)} onKeyDown={(event) => segmentKeys(event, () => setOpen(true))}>{segment.label}</button>
    {open && <SourcePopover anchor={trigger.current} side="bottom" align="start" padding="sm" className="sfv-folder-popover"
      label={t("Files in {folder}", { folder })} onClose={() => setOpen(false)}>
      <SourceFolderList dir={segment.dir} current={current} lister={lister} onOpen={(path) => { setOpen(false); lister.onOpenFile(path); }} />
    </SourcePopover>}
  </>;
}

const FOLDER_ENTRY_LIMIT = 200; // Ca
function useFolderEntries(lister, dir) {
  const [state, setState] = useState({ entries: null, error: false });
  useEffect(() => {
    let live = true;
    setState({ entries: null, error: false });
    Promise.resolve().then(() => lister.list(dir)).then(
      (entries) => { if (live) setState({ entries: Array.isArray(entries) ? entries.slice(0, FOLDER_ENTRY_LIMIT) : [], error: false }); },
      () => { if (live) setState({ entries: null, error: true }); });
    return () => { live = false; };
  }, [lister, dir]);
  return state;
}

// La: skeleton rows while loading, "Couldn’t list this folder" / "Empty folder" (Ra: h-control px-md
// text-footnote text-muted), else the compact tree (Xt variant compact): folders expand in place, a file opens.
function SourceFolderList({ dir, current, lister, onOpen, depth = 0 }) {
  const { entries, error } = useFolderEntries(lister, dir);
  const list = useRef(null);
  useEffect(() => { if (depth === 0 && entries?.length) list.current?.querySelector("[data-folder-row]")?.focus({ preventScroll: true }); }, [entries, depth]);
  if (!entries) return error
    ? <p className="sfv-folder-note">{t("Couldn’t list this folder")}</p>
    : <div className="sfv-folder-skeleton" aria-hidden="true">{Array.from({ length: depth ? 2 : 6 }, (_, index) => <span key={index} />)}</div>;
  if (!entries.length) return <p className="sfv-folder-note">{t("Empty folder")}</p>;
  return <ul ref={list} role={depth ? "group" : "tree"} aria-label={depth ? undefined : t("Files in {folder}", { folder: folderLabel(dir, lister.rootLabel ?? "") })} className="sfv-folder-list"
    onKeyDown={depth ? undefined : (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const rows = [...event.currentTarget.querySelectorAll("[data-folder-row]")];
      const at = rows.indexOf(event.target.closest?.("[data-folder-row]"));
      const next = rows[event.key === "ArrowDown" ? at + 1 : Math.max(0, at - 1)];
      if (next) { event.preventDefault(); next.focus(); }
    }}>
    {entries.map((entry) => <SourceFolderRow key={entry.path} entry={entry} current={current} lister={lister} onOpen={onOpen} depth={depth} />)}
  </ul>;
}

function SourceFolderRow({ entry, current, lister, onOpen, depth }) {
  const [expanded, setExpanded] = useState(false);
  const directory = !!entry.directory;
  const selected = !directory && entry.path === current;
  return <li role="treeitem" aria-expanded={directory ? expanded : undefined} aria-selected={selected || undefined}>
    <button type="button" className="sfv-folder-row" data-folder-row="" data-selected={selected || undefined} tabIndex={-1}
      style={{ paddingInlineStart: `calc(var(--cds-pad-sm, 8px) + ${depth * 12}px)` }}
      onClick={() => (directory ? setExpanded((value) => !value) : onOpen(entry.path))}
      onKeyDown={(event) => {
        if (!directory) return;
        if (event.key === "ArrowRight" && !expanded) { event.preventDefault(); setExpanded(true); }
        else if (event.key === "ArrowLeft" && expanded) { event.preventDefault(); setExpanded(false); }
      }}>
      {directory
        ? <Icon name="CaretRight" size={12} className={expanded ? "sfv-folder-caret sfv-open" : "sfv-folder-caret"} />
        : <span className="sfv-folder-caret" aria-hidden="true" />}
      <Icon name={directory ? (expanded ? "FolderOpen" : "Folder") : fileKindIcon(entry.name)} size={16} className="sfv-folder-icon" />
      <span className="sfv-folder-name">{entry.name}</span>
    </button>
    {directory && expanded && <SourceFolderList dir={entry.path} current={current} lister={lister} onOpen={onOpen} depth={depth + 1} />}
  </li>;
}

// Xi: the find bar (qn role=search): the "Find in file…" field, "{current} of {total}" or "No results" (aria-live,
// text-footnote text-muted tabular-nums), then the ghost Previous match (ArrowUp) / Next match (ArrowDown) /
// Close find bar (X, esc) buttons.
function SourceFileFindBar({ query, status, inputRef, onQuery, onNext, onPrev, onClose }) {
  const has = status.total > 0;
  const total = status.capped ? `${status.total.toLocaleString()}+` : status.total.toLocaleString();
  const button = (label, icon, onClick, disabled, shortcut) => <SourceTooltip content={label} shortcut={shortcut} hoverable={false}>
    <button type="button" className="source-icon-button sfv-find-button" aria-label={label} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>
      <Icon name={icon} size={16} />
    </button>
  </SourceTooltip>;
  return <div role="search" className="sfv-find" data-file-find=""
    onKeyDown={(event) => { if (event.key === "Escape" && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
    <input ref={inputRef} className="sfv-find-input" value={query} spellCheck={false} autoComplete="off" aria-label={t("Find in file")} placeholder={t("Find in file…")}
      onChange={(event) => onQuery(event.target.value)}
      onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); if (event.shiftKey) onPrev(); else onNext(); } }} />
    <span aria-live="polite" className="sfv-find-status">{query.length === 0 ? "" : has ? t("{current} of {total}", { current: status.current.toLocaleString(), total }) : t("No results")}</span>
    {button(t("Previous match"), "ArrowUp", onPrev, !has, "cmd+shift+g")}
    {button(t("Next match"), "ArrowDown", onNext, !has, "cmd+g")}
    {button(t("Close find bar"), "X", onClose, false, "esc")}
  </div>;
}

function SourceFileUnavailable({ reason, path, onViewAsText }) {
  const copy = fileUnavailableCopy(reason);
  const body = copy.body && <>{copy.body}{copy.showsPath && <><br /><span className="select-text break-all">{path}</span></>}</>;
  const action = copy.action === "view-as-text" && onViewAsText
    // xxs secondary CDS Button: the xxs size is data-step="1" (shared-frame :2976).
    ? <SourceSettingsButton variant="secondary" data-step="1" onClick={onViewAsText}>{VIEW_AS_TEXT_LABEL}</SourceSettingsButton>
    : null;
  return <SourceEmptyState role={copy.role} title={<span className="select-text">{copy.title}</span>} body={body} actions={action} />;
}

// The code view: rows of a muted tabular-nums gutter (as the Read rows'
// .sft-read-number, sized by the digit count of the last line) and the
// highlighted code, wrapped (overflow "wrap"). line..endLine are the jump range:
// those rows carry data-active (da :1529-1549, at most 200 rows) and the first
// one is centred once per request (fa :1550-1576: only when it is not already
// in view).
function SourceFileCode({ path, text, line, endLine, scrollNonce, scopeKey, find = null }) {
  const scroller = useRef(null);
  const language = fileHighlightLanguage(path);
  const tooSlow = useMemo(() => fileViewerTooSlow(text, language), [text, language]);
  const tokens = useSettledHighlight({ text, language: tooSlow ? "text" : language, isFrontier: false, languageSettled: true, scopeKey }, scroller);
  const lines = useMemo(() => fileViewerLines(tokens, text), [tokens, text]);
  const range = jumpRange(line, endLine);
  const jumped = useRef(null);
  useLayoutEffect(() => {
    const node = scroller.current;
    if (!range || !node) return;
    const key = `${path}\u0000${range.first}\u0000${range.last}\u0000${scrollNonce ?? ""}`;
    if (jumped.current === key) return;
    const row = node.querySelector(`[data-line="${range.first}"]`);
    if (!row) return;
    jumped.current = key;
    const box = node.getBoundingClientRect(), rect = row.getBoundingClientRect();
    const inView = rect.top >= box.top && rect.bottom <= box.bottom;
    const covers = rect.height > box.height && rect.bottom > box.top && rect.top < box.bottom;
    if (!inView && !covers) node.scrollTop += (rect.top + rect.bottom) / 2 - (box.top + box.bottom) / 2;
  }, [path, range?.first, range?.last, scrollNonce, lines.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // oa: every match is ::highlight(match), the current one ::highlight(current), its row tinted; the current match is
  // centred when it is out of view.
  const findId = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const names = { match: `sfv-find-match-${findId}`, current: `sfv-find-current-${findId}` };
  const activeMatch = find && find.index >= 0 ? find.matches[find.index] : null;
  useLayoutEffect(() => {
    const node = scroller.current, view = node?.ownerDocument.defaultView;
    const registry = view?.CSS?.highlights, Highlight = view?.Highlight;
    const clear = () => { registry?.delete(names.match); registry?.delete(names.current); };
    if (!node || !find || !find.matches.length) { clear(); return undefined; }
    const rangeAt = (match) => {
      const code = node.querySelector(`[data-line="${match.line}"] code`);
      if (!code) return null;
      const walker = node.ownerDocument.createTreeWalker(code, 4);
      let offset = 0, start = null, range = null;
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        const length = text.nodeValue.length;
        if (!start && match.start < offset + length) { range = node.ownerDocument.createRange(); range.setStart(text, match.start - offset); start = text; }
        if (start && match.end <= offset + length) { range.setEnd(text, match.end - offset); return range; }
        offset += length;
      }
      return null;
    };
    if (registry && Highlight) {
      const all = new Highlight(), current = new Highlight();
      find.matches.slice(0, 2000).forEach((match, index) => { const range = rangeAt(match); if (range) (index === find.index ? current : all).add(range); });
      if (activeMatch && find.index >= 2000) { const range = rangeAt(activeMatch); if (range) current.add(range); }
      registry.set(names.match, all);
      registry.set(names.current, current);
    }
    if (activeMatch) {
      const row = node.querySelector(`[data-line="${activeMatch.line}"]`);
      if (row) {
        const box = node.getBoundingClientRect(), rect = row.getBoundingClientRect();
        if (rect.top < box.top || rect.bottom > box.bottom) node.scrollTop += (rect.top + rect.bottom) / 2 - (box.top + box.bottom) / 2;
      }
    }
    return clear;
  }, [find, lines]); // eslint-disable-line react-hooks/exhaustive-deps
  const digits = String(lines.length).length;
  return <div data-file-viewer="" className="epitaxy-diff sfv-viewer">
    {find && <style>{`::highlight(${names.match}){background:rgba(255,213,0,.25);border-radius:2px}::highlight(${names.current}){background:rgba(255,213,0,.55);color:black;border-radius:2px}`}</style>}
    <div ref={scroller} className="source-file-preview sfv-scroller select-text" data-highlighted={tokens ? "" : undefined}
      data-active-line={range ? range.first : undefined} data-active-end-line={range && range.last !== range.first ? range.last : undefined}
      style={{ "--sfv-number-width": `${Math.max(3, digits)}ch` }}>
      {tooSlow && <p role="note" className="sfv-plain-note">{FILE_VIEWER_LABELS.plainNotice}</p>}
      {lines.map((row, index) => {
        const number = index + 1;
        return <div key={index} className="sfv-line" data-line={number}
          data-active={range && number >= range.first && number <= range.last ? "" : undefined}
          data-find-active={activeMatch?.line === number ? "" : undefined}>
          <span className="sfv-number" data-number={number} aria-hidden="true" />
          <code className="scb-code source-diff-code"><SourceHighlightedLine tokens={row} />{index < lines.length - 1 || text.endsWith("\n") ? "\n" : ""}</code>
        </div>;
      })}
    </div>
  </div>;
}

// The preview scroller (P.Trigger with q set, :4478-4480): "flex-1 min-h-0
// overflow-y-auto [contain:strict] [scrollbar-gutter:stable_both-edges]
// select-text p-lg". It keeps .source-file-preview, the viewer scroller class.
const PREVIEW_SCROLLER = "flex-1 min-h-0 overflow-y-auto [contain:strict] [scrollbar-gutter:stable_both-edges] select-text p-lg source-file-preview sfv-preview";

// Ei (:908-937), "progressive" as the viewer calls it: a source above Si
// renders at once only when it is plain text or its first chunk is at most
// 24576 chars; otherwise it waits for a deferred render behind the Zo
// "Loading file" spinner. A source at or below Si renders at once.
function useMarkdownFileBody(text) {
  const large = text.length > MARKDOWN_PROGRESSIVE_CHARS;
  const plan = useMemo(() => (large ? markdownFilePlan(text) : null), [large, text]);
  useEffect(() => () => releaseMarkdownFilePlan(text), [text]);
  const first = plan !== null && plan.chunks.length > 1 ? plan.chunks[0] : null;
  const immediate = !large || plan.plain || (first !== null && first.length <= MARKDOWN_FIRST_CHUNK_CHARS);
  const deferred = useDeferredValue(large ? text : "", large && immediate ? text : "");
  const deferredSmall = useDeferredValue(large ? "" : text);
  if (!large || deferred === text) return { body: text, pending: false };
  const shown = deferred === "" ? deferredSmall : deferred;
  if (shown === "") return immediate ? { body: text, pending: false } : { body: "", pending: true };
  return { body: shown, pending: false };
}

// ki (:939-965): the frontmatter fields as a two-column <dl> above the body,
// labels through Oi ("allowed-tools" -> "Allowed tools").
function SourceFrontmatter({ frontmatter }) {
  if (!frontmatter || frontmatter.fields.length === 0) return null;
  return <dl className="grid grid-cols-[max-content_1fr] items-baseline gap-x-[28px] gap-y-md mb-[24px] pb-[20px] border-b border-alpha-2 sfv-frontmatter">
    {frontmatter.fields.map(({ key, value }) => <React.Fragment key={key}>
      <dt className="text-footnote text-muted">{frontmatterLabel(key)}</dt>
      <dd className="text-body text-primary min-w-0 break-words">{value}</dd>
    </React.Fragment>)}
  </dl>;
}

// Ni (:1044-1078): one more chunk per idle period (requestIdleCallback with a
// 100 ms timeout, else a 16 ms timer), inside a transition.
function useMountedChunks(total) {
  const [count, setCount] = useState(1);
  const shown = Math.min(count, total);
  useEffect(() => {
    if (shown >= total) return undefined;
    if (typeof window === "undefined") { startTransition(() => setCount(total)); return undefined; }
    const next = () => startTransition(() => setCount(shown + 1));
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(next, { timeout: 100 });
      return () => { try { window.cancelIdleCallback(handle); } catch {} };
    }
    const timer = window.setTimeout(next, 16);
    return () => window.clearTimeout(timer);
  }, [shown, total]);
  return shown;
}

// Pi (:1079-1100): every chunk after the first skips layout while off screen,
// sized by the Vr estimate. renderMarkdown gets the chunk index so each chunk
// is its own response owner.
const SourceMarkdownChunk = React.memo(function SourceMarkdownChunk({ source, index, renderMarkdown }) {
  const style = useMemo(() => (index > 0 ? { contentVisibility: "auto", containIntrinsicSize: `auto ${markdownChunkHeight(source)}px` } : undefined), [source, index]);
  return <div className="epitaxy-file-prose epitaxy-file-prose-chunk sfv-prose" style={style}>{renderMarkdown(source, index)}</div>;
});

// Mi (:1027-1043): the mounted chunks, then the J status row while more remain.
function SourceMarkdownChunks({ chunks, renderMarkdown }) {
  const shown = useMountedChunks(chunks.length);
  return <div>
    {chunks.slice(0, shown).map((chunk, index) => <SourceMarkdownChunk key={index} source={chunk} index={index} renderMarkdown={renderMarkdown} />)}
    {shown < chunks.length && <div role="status" className="animate-placeholder-reveal flex justify-center py-lg text-muted">
      <SourceSpinner size="md" /><span className="sr-only">{FILE_VIEWER_LABELS.loading}</span>
    </div>}
  </div>;
}

// Ai (:969-992): the plain fallback (ji :993-1012, the whole source in a
// pre-wrap <pre> under the "too slow" note) when Ti says so; otherwise the
// frontmatter grid, then the body in one prose column or as chunks.
function SourceMarkdownDocument({ source, renderMarkdown }) {
  const { frontmatter, body, plain, chunks } = useMemo(() => markdownFilePlan(source), [source]);
  if (plain) return <div data-markdown-plain="">
    <p role="note" className="mb-[16px] text-footnote text-muted">{FILE_VIEWER_LABELS.plainNotice}</p>
    <pre className="text-code text-primary whitespace-pre-wrap break-words select-text sfv-plain-source">{source}</pre>
  </div>;
  return <>
    <SourceFrontmatter frontmatter={frontmatter} />
    {chunks.length > 1
      ? <SourceMarkdownChunks chunks={chunks} renderMarkdown={renderMarkdown} />
      : <div className="epitaxy-file-prose sfv-prose">{renderMarkdown(body, 0)}</div>}
  </>;
}

// q === "markdown" (:4614-4631): Zo while Ei is pending, else "mx-auto
// max-w-[860px]" around Ai, whose prose is div.epitaxy-markdown
// .epitaxy-file-prose. Locally the Markdown is the response renderer
// (SourceMarkdown, handed in by the pane as renderMarkdown(text, chunk)).
function SourceFileMarkdown({ text, renderMarkdown }) {
  const { body, pending } = useMarkdownFileBody(text);
  return <div data-file-viewer="" data-file-preview="markdown" className={PREVIEW_SCROLLER}>
    {pending
      ? <SourceLoadingPane label={FILE_VIEWER_LABELS.loading} />
      : <div className="mx-auto max-w-[860px]"><SourceMarkdownDocument source={body} renderMarkdown={renderMarkdown} /></div>}
  </div>;
}

// q === "csv" (:4633-4641) → EpitaxyCsvPreview (cd5fd9055-AkFKEmX0.js c): an
// Un card when empty or unparsable; otherwise "epitaxy-markdown h-full" with
// the truncation caption, a focusable "Table preview" region and the table
// (a thead only when the first row reads as a header).
function SourceFileCsv({ text, delimiter }) {
  const id = useId();
  const result = useMemo(() => parseCsvPreview(text, delimiter), [text, delimiter]);
  if (result.kind !== "ok")
    return <div data-file-viewer="" data-file-preview="csv" className={PREVIEW_SCROLLER}>
      <SourceEmptyState title={<span className="select-text">{result.kind === "empty" ? FILE_VIEWER_LABELS.csvEmpty : FILE_VIEWER_LABELS.csvError}</span>} />
    </div>;
  const { rows, hasHeader, rowsTruncated, colsTruncated, cellsTruncated } = result.parsed;
  const cut = rowsTruncated || colsTruncated || cellsTruncated, captionId = `${id}-cap`;
  const head = hasHeader ? rows[0] : null, body = hasHeader ? rows.slice(1) : rows;
  return <div data-file-viewer="" data-file-preview="csv" className={PREVIEW_SCROLLER}>
    <div className="epitaxy-markdown source-markdown h-full sfv-csv">
      {cut && <p id={captionId} className="text-footnote text-muted px-0.75">
        {csvTruncationCaption({ rowCount: rows.length, columnCount: rows[0].length, rowsTruncated, colsTruncated, cellsTruncated })}
      </p>}
      <div tabIndex={0} role="region" aria-label={FILE_VIEWER_LABELS.tablePreview} aria-describedby={cut ? captionId : undefined}
        className="overflow-auto focus-visible:outline-hidden focus-visible:shadow-focus sfv-csv-region">
        <table>
          {head && <thead><tr>{head.map((cell, index) => <th key={index} scope={cell === "" ? undefined : "col"} style={{ whiteSpace: "normal" }}>{cell}</th>)}</tr></thead>}
          <tbody>{body.map((row, index) => <tr key={index}>{row.map((cell, at) => <td key={at}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  </div>;
}

// R (nr || ir, :4481-4609): P.Trigger "flex-1 min-h-0 [contain:strict]"
// around "h-full overflow-auto p-md flex items-center justify-center" with the
// <img> (alt = base name, "max-w-full max-h-full object-contain"), <audio>
// ("w-full max-w-[480px]") or <video> ("max-w-full max-h-full"), both
// controls + preload metadata + aria-label base name. A failed load (Jr)
// shows the Un card with "View as text anyway" (Uc).
function SourceFileMedia({ kind, path, url, onViewAsText }) {
  const [failed, setFailed] = useState(false);
  const name = String(path).split(/[\\/]/).pop() || String(path);
  if (failed) {
    const copy = fileMediaErrorCopy(kind);
    return <div data-file-viewer="" data-file-media={kind} data-media-state="error" className="flex-1 min-h-0 [contain:strict] sfv-media">
      <SourceEmptyState title={<span className="select-text">{copy.title}</span>} body={<span className="select-text">{copy.body}</span>}
        actions={onViewAsText ? <SourceSettingsButton variant="secondary" data-step="1" onClick={onViewAsText}>{VIEW_AS_TEXT_LABEL}</SourceSettingsButton> : null} />
    </div>;
  }
  const onError = () => setFailed(true);
  return <div data-file-viewer="" data-file-media={kind} className="flex-1 min-h-0 [contain:strict] sfv-media">
    <div className="h-full overflow-auto p-md flex items-center justify-center">
      {kind === "image"
        ? <img src={url} alt={name} onError={onError} className="max-w-full max-h-full object-contain" />
        : kind === "audio"
          ? <audio src={url} controls preload="metadata" aria-label={name} onError={onError} className="w-full max-w-[480px]" />
          : <video src={url} controls preload="metadata" aria-label={name} onError={onError} className="max-w-full max-h-full" />}
    </div>
  </div>;
}

// The Eye/Code subheader button (:4169-4186): ghost iconOnly base, labelled
// "Preview" (Eye) while the source shows, otherwise "View source" (Code); an
// iconOnly Button shows its aria-label as the CDS tooltip.
function SourceViewToggle({ showingSource, onToggle }) {
  const label = showingSource ? FILE_VIEWER_LABELS.preview : FILE_VIEWER_LABELS.viewSource;
  return <SourceTooltip content={label} hoverable={false}>
    <button type="button" className="source-icon-button sfv-view-toggle" aria-label={label} data-view-toggle=""
      onClick={onToggle} onMouseDown={(event) => event.preventDefault()}>
      <Icon name={showingSource ? "Eye" : "Code"} size={16} />
    </button>
  </SourceTooltip>;
}

/**
 * file: the tab ({path, text?, unavailable?}); displayPath: the path shown and
 * copied (cwd-relative inside the workspace); fullPath: the breadcrumb title
 * and the media file:// URL. renderMarkdown(text, chunk): the pane's Markdown
 * renderer (chunk: the index of a progressive chunk, 0 for a whole body);
 * without it a Markdown file has no preview.
 */
export function SourceFileViewer({ file, displayPath, fullPath, line, endLine, scrollNonce, scopeKey, onCopyPath, onViewAsText, renderMarkdown, findRequest = null, lister = null }) {
  const reason = fileTabReason(file);
  const media = FILE_MEDIA_KINDS.includes(reason) ? reason : null;
  // Xt (:2649): a file kind with a preview. en (:2655): the source shows first
  // when the file is opened at a line; [tn, sn] holds it, and hn (:2658-2667)
  // resets it whenever the preview kind, the line or the request changes.
  const kind = filePreviewKind(file.path);
  const previewable = !!kind && (kind.kind !== "markdown" || typeof renderMarkdown === "function");
  const sourceFirst = line != null;
  const [showSource, setShowSource] = useState(sourceFirst);
  const [request, setRequest] = useState({ previewable, line, scrollNonce });
  if (request.previewable !== previewable || request.line !== line || request.scrollNonce !== scrollNonce) {
    setRequest({ previewable, line, scrollNonce });
    if (previewable) setShowSource(sourceFirst);
  }
  // Ti !== null (:4169): the toggle needs a preview kind and text that is not binary.
  const canToggle = previewable && !media && reason !== "binary";
  // Find in file (Yi / Xi): ⌘F in the viewer or the pane menu's "Find in file" (findRequest bumps) opens the bar on
  // the source; Escape closes it and puts the focus back in the viewer.
  const searchable = !media && !reason && typeof file.text === "string";
  const [find, setFind] = useState({ open: false, query: "", index: -1, nonce: 0 });
  const findInput = useRef(null);
  const root = useRef(null);
  const matches = useMemo(() => (find.open && searchable ? findInText(file.text, find.query) : []), [find.open, find.query, searchable, file.text]);
  const index = matches.length ? Math.min(Math.max(find.index, 0), matches.length - 1) : -1;
  const openFind = useCallback(() => {
    if (!searchable) return;
    setShowSource(true);
    setFind((value) => ({ ...value, open: true, nonce: value.nonce + 1 }));
  }, [searchable]);
  const closeFind = useCallback(() => {
    setFind({ open: false, query: "", index: -1, nonce: 0 });
    root.current?.querySelector(".sfv-scroller")?.focus?.({ preventScroll: true });
  }, []);
  const stepFind = useCallback((delta) => setFind((value) => ({ ...value, index: stepFindIndex(index, delta, matches.length) })), [index, matches.length]);
  useEffect(() => { if (find.open) { findInput.current?.focus(); findInput.current?.select(); } }, [find.open, find.nonce]);
  const lastRequest = useRef(findRequest);
  useEffect(() => { if (findRequest != null && findRequest !== lastRequest.current) openFind(); lastRequest.current = findRequest; }, [findRequest, openFind]);
  const findProps = useMemo(() => (find.open ? { matches, index } : null), [find.open, matches, index]);
  const preview = canToggle && !showSource ? kind : null;
  const body = media
    ? <SourceFileMedia key={file.path} kind={media} path={file.path} url={filePreviewUrl(fullPath || file.path)} onViewAsText={onViewAsText} />
    : reason && reason !== "empty"
      ? <SourceFileUnavailable reason={reason} path={file.path} onViewAsText={onViewAsText} />
      : reason === "empty"
        ? <SourceFileUnavailable reason="empty" path={file.path} />
        : typeof file.text !== "string"
          ? <SourceLoadingPane label={FILE_VIEWER_LABELS.loading} />
          : preview?.kind === "markdown"
            ? <SourceFileMarkdown text={file.text} renderMarkdown={renderMarkdown} />
            : preview?.kind === "csv"
              ? <SourceFileCsv text={file.text} delimiter={preview.delimiter} />
              : <SourceFileCode path={file.path} text={file.text} line={line} endLine={endLine} scrollNonce={scrollNonce} scopeKey={scopeKey} find={findProps} />;
  return <div ref={root} className="source-file-view" data-file-path={file.path} data-file-state={reason ?? (typeof file.text === "string" ? "text" : "loading")}
    data-file-view={preview ? "preview" : canToggle ? "source" : undefined}
    onKeyDown={(event) => {
      const action = searchable ? fileFindShortcut(event, { mac: typeof navigator === "undefined" || /Mac|iPhone|iPad/.test(navigator.platform || "") }) : null;
      if (!action || (action !== "open" && !find.open)) return;
      event.preventDefault(); event.stopPropagation();
      if (action === "open") openFind(); else stepFind(action === "next" ? 1 : -1);
    }}>
    {/* qn flush (cdf69fdd3-DM0fGX-C.js:13-36): "epitaxy-panel-subheader flex
        items-center gap-[4px] shrink-0 px-md" at h-[calc(2rem*rem-scale)];
        Jo puts the actions after the Yo lead. */}
    <div className="epitaxy-panel-subheader sfv-subheader">
      <SourceFileBreadcrumb displayPath={displayPath} fullPath={fullPath} onCopyPath={onCopyPath} lister={lister} />
      {canToggle && <SourceViewToggle showingSource={showSource} onToggle={() => setShowSource((value) => !value)} />}
    </div>
    {find.open && searchable && <SourceFileFindBar query={find.query} status={findStatus(matches, index)} inputRef={findInput}
      onQuery={(query) => setFind((value) => ({ ...value, query, index: 0 }))}
      onNext={() => stepFind(1)} onPrev={() => stepFind(-1)} onClose={closeFind} />}
    <div className="sfv-body">{body}</div>
  </div>;
}
