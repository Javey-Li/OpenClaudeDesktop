import {advanceResponseBlocks,remarkPriorDefinitions,remarkResponseBlockQuotes} from './response-block-model.mjs';
import {remarkFrontierDefinitions} from './frontier-definitions.mjs';
import {rehypeResponseReveal} from './response-reveal-model.mjs';
import {reasoningText,isHiddenTranscriptItem} from './transcript-item-visibility.mjs';
import {useResponsePacing} from './use-response-pacing.js';
import {SourceResponseBoundary,SourceBlockBoundary} from './source-response-boundary.jsx';
import {SourceGenericToolBody} from './source-generic-tool.jsx';
import {SourcePlanPane, SourcePlanCopyButton} from './source-plan-pane.jsx';
import {thinkingQuote} from './reasoning-model.mjs';
import {createClipboardFeedback} from './clipboard-feedback.mjs';
import {clipboardEnvironment,writeClipboardPayload} from './clipboard-payload.mjs';
import {useSourceToasts} from './source-toast.jsx';
import {SourceSettingsButton} from './source-settings-button.jsx';
import {isGenericTool,observedGenericTool,genericToolLabel,genericToolBody} from './generic-tool-model.mjs';
import {questionOutcome,questionReceipt,toolOutputImages} from './generic-tool-model.mjs';
import {SourceQuestionReceipt,notePendingQuestion} from './source-question-receipt.jsx';
import {SourceToolImages} from './source-tool-images.jsx';
import { SourceMarkdownSelection } from './source-markdown-selection.jsx';
import { remarkStreamingInline } from './streaming-inline.mjs';
import { useResponseReveal, ResponseRevealScope, ResponseRevealSpan } from './source-response-reveal.jsx';
import { SourceAgentTool } from "./source-agent.jsx";
import { SourceApprovalCard, SourceApprovalCardView } from "./source-approval-card.jsx";
import { previewTooLarge } from "./approval-card-model.mjs";
import { SourceQuestionCard } from "./source-question-card.jsx";
import { approvalIdentity, isPlanReviewRequest } from "./approval-draft-model.mjs";
import { SourcePlanApprovalCard } from "./source-plan-card.jsx";
import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from 'remark-math';
import { remarkResponseMath } from './remark-response-math.mjs';
import { remarkResponseFlow, rehypeResponseFlow } from './response-flow.mjs';
import { remarkResponseFootnotes } from './remark-response-footnotes.mjs';
import { remarkResponseInlineAtoms } from './remark-response-inline-atoms.mjs';
import { SourceResponseMath } from './source-response-math.jsx';
import { SourceResponseImage } from './source-response-image.jsx';
import { responseImageTarget } from './response-image-model.mjs';
import { ResponseTaskInput, ResponseTaskItem } from './source-response-task.jsx';
import { Icon } from "./icons";
import { SourceTooltip, SourceTooltipGroup } from "./source-tooltip.jsx";
import { SourceMenu } from "./source-menu.jsx";
import { FILE_TAB_LABELS, insertFileTab, moveFileTab, tabDetail, tabMenuItems, tabRelativePath, tabTooltip } from "./file-tab-menu-model.mjs";
import { fileContextMenu, fileCopyChoices, fileLinkLabel } from "./file-context-menu-model.mjs";
import { stableIds, tabOverflowLayout } from "./file-tab-overflow-model.mjs";
import { SourceFileViewer, FILE_VIEWER_LABELS } from "./source-file-viewer.jsx";
import { CONTEXT_MENU_ALIGN_OFFSET, CONTEXT_MENU_SIDE_OFFSET } from "./menu-model.mjs";
import { menuTriggerProps } from "./source-menu.jsx";
import { fileKindIcon } from "./file-kind-icon.mjs";
import { useSourcePointerResize } from "./use-pointer-resize.js";
import { SourcePaneControls, SourceFilesSearchButton } from "./source-pane-controls";
import { SourceDiff } from "./source-diff";
import { diffPayload } from './diff-context-model.mjs';
import { useDiffViewPreferences } from "./diff-view-store.mjs";
import { changesMenuSections } from "./changes-menu-model.mjs";
import { SourceChangesState, SourcePlanEmpty, SourceFilesTreeState, SourceTreeErrorRow, SourceFilesEmptyPreview } from "./source-pane-states.jsx";
import { SourceUserText } from "./source-user-text.jsx";
import { SourceUserActions } from "./source-user-actions.jsx";
import { promptHeading } from "./transcript-feed-nav.mjs";
import { useShrinkWrap } from "./use-shrink-wrap.js";
import { SourceCodeBlock } from "./source-code-block";
import { SourceResponseTable, SourceTableScope } from "./source-response-table.jsx";
import { parseFileRef, chipPathOpenable } from "./user-inline-model.mjs";
import { responseLinkTarget, responseUrlLabel, responseForgeRef, forgeRefLabel, forgeRefLabelMatches, forgeRefSameRepo } from './response-link-model.mjs';
import { SourceForgeRepoContext, SourceForgeRef } from './source-forge-ref.jsx';
import { SourceFilesSearch } from "./source-files-search";
import { useFileTreeReveal } from "./use-file-tree-reveal";
import { revealChild } from "./files-search-model.mjs";
import { readMarkdownCodeBlock } from "./code-fence-model.mjs";
import { detectSecrets, maskSecret, maskSecrets, secretLabel } from "./secret-redaction-model.mjs";
import { showsThinking } from "./transcript-view-model.mjs";
import { SourceCommandBody } from "./source-command.jsx";
import { commandRowLabel, commandRowState } from "./command-row-model.mjs";
import { SourceToolGroup } from "./source-tool-group.jsx";
import { ApprovalFileChangeBody, FileToolMessage } from "./source-file-tool.jsx";
import { fileAction } from "./file-tool-model.mjs";
import { rowExpansionKey, toolRowExpansion } from "./tool-group-expansion.mjs";
import "./source-session.css";
import { t } from "../electron/i18n/index.mjs";

// Source chain and deliberate Codex adaptations: analysis/source-session-batch1.md.
const desktopCall = (action, params) =>
  window.desktop?.call(action, params) ??
  Promise.reject(new Error(t("Open Code Desktop to connect to DeepSeek.")));
const basename = (path = "") =>
  path.split(/[\\/]/).filter(Boolean).at(-1) || t("Files");
const textOf = (value) =>
  typeof value === "string" ? value : JSON.stringify(value, null, 2);
const errorMessage = (error) => error?.message || String(error);

// nativeTitle={false}: a control inside a CDS SourceTooltip carries no native title.
function SourceIconButton({ name, label, onClick, nativeTitle = true, ...props }) {
  return (
    <button
      type="button"
      className="source-icon-button"
      aria-label={label}
      title={nativeTitle ? label : undefined}
      onClick={onClick}
      {...props}
    >
      <Icon name={name} size={16} />
    </button>
  );
}

const SourceMarkdownContext = React.createContext({ text: "", isStreaming: false, ownerKey: null });
function SourceMarkdownPre({ node, children, ...props }) {
  const context = React.useContext(SourceMarkdownContext);
  const { text, isStreaming, ownerKey } = context;
  const instanceId = useId();
  const block = readMarkdownCodeBlock(node, text, isStreaming);
  const offset = node?.position?.start?.offset;
  // Later prose may grow while this closed fence stays unchanged. Identity
  // contains only its real owner and stable start position, never source text.
  // A parser node without a position stays isolated to this mounted Pre.
  const scopeKey = JSON.stringify([ownerKey, Number.isInteger(offset) && offset >= 0
    ? ["offset", offset] : ["instance", instanceId]]);
  if (block?.language === 'math' && block.languageSettled) return <SourceResponseMath value={block.text} display fenced />;
  return block ? <SourceCodeBlock {...block} scopeKey={scopeKey} /> : <SourceMarkdownContext.Provider value={{...context, nonInteractive: true, inPre: true}}><pre {...props}>{children}</pre></SourceMarkdownContext.Provider>;
}

function SourceMarkdownTable({ node, children, ...props }) {
  const context = React.useContext(SourceMarkdownContext);
  return <SourceResponseTable {...props} isStreaming={context.isStreaming}
    wrapSnapshot={rows => <SourceMarkdownContext.Provider value={context}>{rows}</SourceMarkdownContext.Provider>}>{children}</SourceResponseTable>;
}
// code-block-current.js:1043-1100 Dr: one masked secret inside inline code,
// bullets for sighted readers, 'Redacted {label}' for assistive technology and
// a 12px Eye/EyeSlash toggle ('Reveal {label}' / 'Hide {label}').
function SourceRedactedSecret({ value, patternId }) {
  const [revealed, setRevealed] = useState(false);
  const label = secretLabel(patternId);
  const mask = useMemo(() => maskSecret(value), [value]);
  return <span data-redacted-secret="" className="smd-secret">
    <span className="smd-secret-value">{revealed ? value : <>
      <span data-find-omitted="" className="source-sr-only smd-secret-sr">{t("Redacted {label}", { label })}</span>
      <span aria-hidden="true">{mask}</span>
    </>}</span>
    <button type="button" className="smd-secret-toggle" aria-pressed={revealed} aria-label={t(revealed ? "Hide {label}" : "Reveal {label}", { label })}
      onClick={event => { event.stopPropagation(); setRevealed(value => !value); }}>
      <Icon name={revealed ? "EyeSlash" : "Eye"} size={12} />
    </button>
  </span>;
}
// Or (:1086-1096): plain runs between the masked secrets.
function secretRuns(text, secrets) {
  const runs = []; let offset = 0;
  for (const secret of secrets) {
    if (secret.start > offset) runs.push(text.slice(offset, secret.start));
    runs.push(<SourceRedactedSecret key={secret.start} value={secret.value} patternId={secret.patternId} />);
    offset = secret.end;
  }
  if (offset < text.length) runs.push(text.slice(offset));
  return runs;
}
// markdown-current.js:4236-4252 Pc: inline code carries data-epitaxy-inline-code
// (and data-epitaxy-file-ref when it reads as a file reference) for the
// transcript context menu. Code that is not a file reference is scanned for
// secrets once its block stops growing; a match masks data-code-text and the
// rendered runs (a non-interactive copy shows the masked text only).
function SourceMarkdownCode({ node, children, ...props }) {
  const context = React.useContext(SourceMarkdownContext);
  const raw = typeof children === 'string' ? children : null;
  const parsed = raw !== null && !context.inPre ? parseFileRef(raw) : null;
  const file = context.nonInteractive ? null : parsed;
  const secrets = useMemo(() => raw === null || parsed || context.isStreaming ? null : detectSecrets(raw), [raw, parsed, context.isStreaming]);
  const inline = context.inPre ? {} : { 'data-epitaxy-inline-code': '', 'data-epitaxy-file-ref': parsed ? '' : undefined };
  if (secrets?.length) {
    const masked = maskSecrets(raw, secrets);
    return <code {...props} {...inline} data-code-text={masked}>{context.nonInteractive ? masked : secretRuns(raw, secrets)}</code>;
  }
  const content = <code {...props} {...inline}>{children}</code>;
  if (!file || !context.onOpenFileRef || !chipPathOpenable(file.path, context.cwd)) return content;
  const open = () => context.onOpenFileRef(file);
  return <span role="button" tabIndex={0} className="smd-file-ref" data-file-ref={file.path} data-file-line={file.line}
    onClick={open} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } }}>{content}</span>;
}
function SourceMarkdownLink({ node, href, children }) {
  const context = React.useContext(SourceMarkdownContext);
  const repoSlug = React.useContext(SourceForgeRepoContext);
  const target = responseLinkTarget(href, context.cwd);
  const inertChildren = <SourceMarkdownContext.Provider value={{...context,nonInteractive:true}}>{children}</SourceMarkdownContext.Provider>;
  if (target.kind === 'file') {
    // Source pi: simple labels become code; a single-level emphasis/code
    // label uses the destination, while descriptive prose retains markup.
    const parts = React.Children.toArray(children);
    let label = '', formatted = false, simple = parts.length > 0;
    for (const part of parts) {
      if (typeof part === 'string') { label += part; continue; }
      if (!React.isValidElement(part) || !(['strong','em','code'].includes(part.type) || part.type === SourceMarkdownCode)) { simple = false; break; }
      const content = React.Children.toArray(part.props.children);
      if (content.length !== 1 || typeof content[0] !== 'string') { simple = false; break; }
      label += content[0]; formatted = true;
    }
    let decodedHref = href; try { decodedHref = decodeURI(href); } catch { /* Literal malformed URL. */ }
    const codeLabel = simple && label && !/\s/.test(label) ? (formatted ? decodedHref : label) : null;
    const content = codeLabel === null ? inertChildren : <code>{codeLabel}</code>;
    if (!target.openable || !context.onOpenFileRef) return content;
    const open = () => context.onOpenFileRef(target.file);
    return <span role="button" tabIndex={0} className={codeLabel === null ? 'smd-file-link' : 'smd-file-ref'}
      data-file-ref={target.file.path} data-file-line={target.file.line} data-file-end-line={target.file.endLine}
      onClick={open} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } }}>{content}</span>;
  }
  if (target.kind !== 'external') return inertChildren;
  const parts = React.Children.toArray(children);
  const open = event => { event.preventDefault(); if (event.button === 0 || event.button === 1) desktopCall('external', { url: target.href }).catch(() => {}); };
  const onAuxClick = event => { if (event.button === 1) open(event); }, onDragStart = event => event.preventDefault();
  // markdown-current.js:4358-4365, :4543-4555: in transcript text a GitHub PR/issue link whose label
  // is empty, '#N', 'owner/repo#N' or its own URL (Gs), with no empty element child, is the rc chip.
  const forgeRef = repoSlug !== null ? responseForgeRef(href) : null;
  if (forgeRef) {
    const textOf = value => typeof value === 'string' || typeof value === 'number' ? String(value)
      : Array.isArray(value) ? value.map(textOf).join('') : React.isValidElement(value) ? textOf(value.props.children) : '';
    if (!parts.some(part => React.isValidElement(part) && textOf(part) === '') && forgeRefLabelMatches(textOf(parts), forgeRef))
      return <SourceForgeRef href={href} forgeRef={forgeRef} label={forgeRefLabel(href, forgeRef, forgeRefSameRepo(forgeRef, repoSlug))}
        onClick={open} onAuxClick={onAuxClick} onDragStart={onDragStart}/>;
  }
  const shortened = parts.every(part => typeof part === 'string' || typeof part === 'number')
    ? responseUrlLabel(parts.join(''), href) : null;
  return <a href={href} target="_blank" rel="noreferrer" title={shortened?.title} onClick={open}
    onAuxClick={event => { if (event.button === 1) open(event); }} onDragStart={event => event.preventDefault()}>{shortened?.label ?? inertChildren}</a>;
}
function SourceMarkdownImage({src,alt}) {
  const context=React.useContext(SourceMarkdownContext);
  return <SourceResponseImage key={JSON.stringify([context.cwd,src])} src={src} alt={alt} cwd={context.cwd} call={desktopCall}
    fallback={<SourceMarkdownLink href={src}>{alt||src}</SourceMarkdownLink>}/>;
}
const RESPONSE_MARKDOWN_COMPONENTS = { img:SourceMarkdownImage, 'response-math': SourceResponseMath, span: ResponseRevealSpan, pre: SourceMarkdownPre, table: SourceMarkdownTable, code: SourceMarkdownCode, a: SourceMarkdownLink, input: ResponseTaskInput, li: ResponseTaskItem };

export function SourceMarkdown({ text = "", isStreaming = false, paceReveal = false, isInterrupting = false, sessionKey = null, itemId, cwd = null, onOpenFileRef = null }) {
  const instanceId = useId();
  const ownerKey = JSON.stringify([sessionKey, itemId ?? ["instance", instanceId]]);
  return <OwnedSourceMarkdown key={ownerKey} {...{text,isStreaming,paceReveal,isInterrupting,ownerKey,cwd,onOpenFileRef}}/>;
}
function OwnedSourceMarkdown({ text: sourceText, isStreaming, paceReveal, isInterrupting, ownerKey, cwd, onOpenFileRef }) {
  return <SourceResponseBoundary text={sourceText}>
    <RichSourceMarkdown {...{sourceText,isStreaming,paceReveal,isInterrupting,ownerKey,cwd,onOpenFileRef}}/>
  </SourceResponseBoundary>;
}
const SourceMarkdownBlock = React.memo(function SourceMarkdownBlock({block,ownerKey,cwd,onOpenFileRef,ledger}) {
  const context=React.useMemo(()=>({text:block.text,isStreaming:block.frontier,ownerKey:JSON.stringify([ownerKey,block.start]),cwd,onOpenFileRef}),[block,ownerKey,cwd,onOpenFileRef]);
  const remarkPlugins=React.useMemo(()=>[remarkGfm,[remarkMath,{singleDollarTextMath:false}],remarkResponseMath,remarkResponseFootnotes,[remarkFrontierDefinitions,{enabled:block.frontier}],[remarkPriorDefinitions,{definitions:block.definitions}],[remarkStreamingInline,{enabled:block.frontier}],remarkResponseInlineAtoms,remarkResponseBlockQuotes,remarkResponseFlow],[block.definitions,block.frontier]);
  const rehypePlugins=React.useMemo(()=>[rehypeResponseFlow,...(ledger?[[rehypeResponseReveal,{ledger,blockOffset:block.index}]]:[])],[ledger,block.index]);
  return <SourceMarkdownContext.Provider value={context}><Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}
    urlTransform={(value,key,node)=>(node.tagName==='a'&&value.startsWith('file:///'))||node.tagName==='img'&&['data','file'].includes(responseImageTarget(value,cwd).kind)?value:defaultUrlTransform(value)}
    components={RESPONSE_MARKDOWN_COMPONENTS}>{block.text}</Markdown></SourceMarkdownContext.Provider>;
});
function SourceMarkdownBlocks({text,isStreaming,ownerKey,cwd,onOpenFileRef,ledger}) {
  const [snapshot,setSnapshot]=React.useState(()=>advanceResponseBlocks(null,text,isStreaming));
  let state=snapshot;
  if(snapshot.text!==text||snapshot.isStreaming!==isStreaming){state=advanceResponseBlocks(snapshot,text,isStreaming);setSnapshot(state);}
  return state.blocks.map(block=><React.Fragment key={block.index}>{block.index>0?'\n':null}<SourceMarkdownBlock {...{block,ownerKey,cwd,onOpenFileRef,ledger}}/></React.Fragment>);
}
function RichSourceMarkdown({ sourceText, isStreaming, paceReveal, isInterrupting, ownerKey, cwd, onOpenFileRef }) {
  const [fallbackActive,setFallbackActive]=React.useState(false);
  const activateFallback=React.useCallback(()=>setFallbackActive(true),[]);
  const text=useResponsePacing(sourceText,{enabled:paceReveal&&isStreaming&&!fallbackActive,interrupting:isInterrupting&&isStreaming});
  const reveal=useResponseReveal(text,isStreaming);
  const open=React.useRef(onOpenFileRef);open.current=onOpenFileRef;
  const openFile=React.useCallback(file=>open.current?.(file),[]);
  return <ResponseRevealScope animations={reveal.animations}><SourceTableScope scopeKey={ownerKey}><SourceMarkdownSelection text={text}>
    <SourceBlockBoundary onFallback={activateFallback} fallback={<SourceMarkdownBlock block={{index:0,start:0,text,definitions:'',frontier:isStreaming}} {...{ownerKey,cwd}} onOpenFileRef={onOpenFileRef?openFile:null} ledger={reveal.ledger}/>}>
      <SourceMarkdownBlocks {...{text,isStreaming,ownerKey,cwd}} onOpenFileRef={onOpenFileRef?openFile:null} ledger={reveal.ledger}/>
    </SourceBlockBoundary>
  </SourceMarkdownSelection></SourceTableScope></ResponseRevealScope>;
}

function outcome(item) {
  if (item.status === "inProgress" || item.status === "running") return "busy";
  // Codex reports the outcome in `status`; a command's own non-zero exit code
  // is not a tool failure and the official row never reads one
  // (approval-current.js:16934, and "Exit code {code}" at :21215 belongs to the
  // environment setup-script step, not to a tool row). Command rows go through
  // commandRowState; this helper stays status-only for every other item type.
  if (item.status === "failed") return "failed";
  if (["declined", "denied"].includes(item.status)) return "denied";
  if (["interrupted", "cancelled", "canceled", "stopped"].includes(item.status))
    return "stopped";
  if (item.status === "blocked") return "blocked";
  return "done";
}

export { reasoningText } from './transcript-item-visibility.mjs';
/** True when a transcript contains at least one renderable reasoning item (official Ma). */
export function sessionHasThinking(items = []) {
  return items.some((item) => item?.type === "reasoning" && reasoningText(item) !== "");
}

// TurnStatus.Step: the label is muted, meta is primary, and only exceptional
// outcomes have a status word. Successful steps deliberately have no badge.
// Words and tones: c05970c42-DsE8IUGc.js:61-92 (Ce). "blocked" reads
// "Needs approval", not the state name.
const STEP_OUTCOME_WORD = {
  failed: t("Failed"),
  stopped: t("Stopped"),
  unknown: t("Status unavailable"),
  denied: t("Denied"),
  blocked: t("Needs approval"),
};
function SourceStep({
  item,
  label,
  meta,
  metaTitle,
  trailing,
  caretSize = 12,
  classic = false,
  state = "done",
  children,
  className = "",
  defaultOpen = false,
  forcedOpen = false,
  sessionKey = null,
  actions = null,
  actionsLabel,
  after = null,
}) {
  // PN / dN (approval-current:16830–16875): Verbose forces the body open,
  // while the explicit row intention survives remounts and view changes.
  const id = useId();
  const expansionKey = rowExpansionKey(sessionKey ?? id, item.id);
  const remembered = useSyncExternalStore(toolRowExpansion.subscribe,
    () => toolRowExpansion.get(expansionKey), () => toolRowExpansion.get(expansionKey));
  const open = forcedOpen || (remembered ?? defaultOpen);
  const [mountedKey, setMountedKey] = useState(open ? expansionKey : null);
  useEffect(() => { if (open) setMountedKey(expansionKey); }, [open, expansionKey]);
  const mounted = open || mountedKey === expansionKey;
  const toggle = () => { if (!forcedOpen) toolRowExpansion.set(expansionKey, !open); };
  const hasBody = children != null;
  return (
    <div
      className={`source-message source-step ${classic ? 'source-step-classic' : ''} ${className}`}
      data-transcript-item-id={item.id}
      data-cds="TurnStatusStep"
      data-state={state}
    >
      <div
        role="button"
        tabIndex={hasBody ? 0 : -1}
        className="source-step-trigger"
        aria-expanded={hasBody ? open : undefined}
        aria-controls={hasBody ? id : undefined}
        onClick={event => { if (hasBody && event.currentTarget.contains(event.target)) toggle(); }}
        aria-disabled={!hasBody || undefined}
        onKeyDown={event => {
          if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); if (hasBody) toggle(); }
        }}
      >
        <span
          className={`source-step-label ${state === "busy" ? "source-shimmer" : ""}`}
        >
          {label}
        </span>
        {meta && (
          <span className="source-step-meta" title={metaTitle || (typeof meta === "string" ? meta : undefined)}>
            {meta}
          </span>
        )}
        {trailing}
        {STEP_OUTCOME_WORD[state] && !(classic && state === "failed") && (
          <span className="source-step-outcome">{STEP_OUTCOME_WORD[state]}</span>
        )}
        {hasBody && (
          <Icon name="CaretRight" size={caretSize} className="source-step-caret" />
        )}
        {state === "busy" && (
          <span className="source-sr-only">{t("In progress")}</span>
        )}
      </div>
      {/* c425fb3cf:j - the body mounts on the first expansion and a later close
          only hides it, so scroll position inside a tool output survives a
          collapse. */}
      {mounted && (
        <div id={id} className="source-step-detail" hidden={!open}>
          {/* TurnStatus.Step Rt (c05970c42:965-1009): the body beside an
              h-[1lh] actions toolbar named by actionsLabel. */}
          {actions ? <div className="source-step-detail-row" data-cds-actions-scope="">
            <div className="source-step-detail-body">{children}</div>
            <div className="source-step-actions" role="toolbar" aria-label={actionsLabel || t("Message actions")}>{actions}</div>
          </div> : children}
        </div>
      )}
      {/* RN (approval-current.js:17093, :17302): content that belongs to the row but sits outside
          its collapsible body, such as the hoisted QO output images, stays in the row root so the
          row is one transcript item (feed article runs, follow-pin and footer-hover lookups). */}
      {after}
    </div>
  );
}

function Diff({ value = "", scopeKey, ...props }) {
  return <SourceDiff value={value} scopeKey={scopeKey} {...props} />;
}

// File actions now have the corresponding UO/GO bodies (edit-read-ui).

// Ordinary user turn (2.2553.1 j1 standard branch): an outer column with the
// source 8px gap holds the bubble group (4px gap: attachments, bubble) and a
// persistent actions row. The article is the pointer/focus latch and hover
// reveal scope. The bubble keeps its 85% ceiling and then shrink-wraps by
// measurement; the row is mounted only for real copyable text.
const IMAGE_URL = /^(?:https?:|data:image\/)/i;
function attachmentSource(part) {
  if (typeof part.path === "string" && part.path.startsWith("/"))
    return encodeURI(`file://${part.path}`);
  const url = part.imageUrl || part.url || part.image_url;
  return typeof url === "string" && IMAGE_URL.test(url) ? url : null;
}
function isImagePart(part) {
  return typeof part.type === "string" && part.type.toLowerCase().includes("image");
}
function extensionBadge(name) {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(name);
  return match ? match[1].toUpperCase() : "";
}

// ep -> $f (scroll-shared-10): a tile is natural only when the frame setting
// naturalImageTiles is true, or "sized" with finite width/height on the image
// item (Zf). Local Codex image parts carry no dimensions, so the tile is the
// non-natural Of branch: a 7.5rem square rounded-card Card (hairline
// border-strong ring, surface-1, field drop shadow) whose img fills it with
// object-contain and 120x120 attributes, fading in on load. No sr-only name
// (media="content"), no tile-media/picture markers, no lightbox. A failed
// load keeps the square and shows the Image glyph at 50% opacity.
function UserImageTile({ part, index }) {
  const [state, setState] = useState("loading");
  const src = attachmentSource(part);
  const name = part.path ? basename(part.path) : t("Attached image {number}", { number: index + 1 });
  return (
    <div data-cds="MessageAttachmentsImage" data-state={state === "failed" ? "failed" : undefined}
      className="source-user-attachment-image" title={part.path || undefined}>
      <div data-cds="Card" className="source-user-attachment-card">
        <span aria-hidden="true" className="source-user-attachment-fill" />
        {src && state !== "failed" && (
          <img src={src} alt={name} width={120} height={120} loading="lazy" decoding="async"
            className="source-user-attachment-picture" data-loaded={state === "loaded" ? "" : undefined}
            onLoad={() => setState("loaded")} onError={() => setState("failed")}
            onDragStart={(event) => event.preventDefault()} />
        )}
        {(!src || state === "failed") && (
          <span aria-hidden="true" className="source-user-attachment-glyph"><Icon name="Image" size={24} /></span>
        )}
      </div>
    </div>
  );
}

// lp/sp (scroll-shared-10): a real non-image path part becomes a square file
// card with a two-line footnote name and an uppercase extension badge.
function UserFileCard({ part }) {
  const name = basename(part.path);
  const badge = extensionBadge(name);
  return (
    <div data-cds="MessageAttachmentsFile" className="source-user-attachment-file" title={part.path}>
      <div data-cds="Card" className="source-user-attachment-card">
        <span aria-hidden="true" className="source-user-attachment-fill" />
        <div className="source-user-attachment-file-body">
          <span aria-hidden="true" className="source-user-attachment-name"><bdi>{name}</bdi></span>
          <span className="sr-only">{name}</span>
          {badge && <span className="source-user-attachment-badge">{badge}</span>}
        </div>
      </div>
    </div>
  );
}

function SourceUserMessage({ item, turnStart, sessionKey, cwd = null, onOpenFileRef = null, agentNested = false, turnStartedAtMs = null }) {
  const text = (item.content || [])
    .filter((part) => part.type === "text" || part.text)
    .map((part) => part.text || "")
    .join("\n");
  const attachments = (item.content || []).filter(
    (part) => !part.text && (part.path || part.imageUrl || part.url || part.image_url),
  );
  const hasFileAttachments = attachments.some((part) => typeof part.path === "string" && part.path !== "");
  const [interacted, setInteracted] = useState(false);
  const latch = interacted ? undefined : () => setInteracted(true);
  const bubbleRef = useShrinkWrap({ enabled: true });
  // scroll-messages-current.js:39513-39521: the sr-only 'You said: {prompt}'
  // h2 (Fe = af(prompt)) opens the message group, outside find.
  const heading = useMemo(() => promptHeading(text), [text]);
  return (
    <article
      className="source-message message user-message source-user-message"
      data-transcript-item-id={item.id}
      data-cds="UserMessage"
      data-turn-start={turnStart || undefined}
      onPointerEnter={latch}
      onFocusCapture={latch}
    >
      <div className="source-user-group" data-cds="UserMessageGroup">
        {heading && <h2 data-find-omitted="" className="sr-only select-none">{heading}</h2>}
        {attachments.length > 0 && (
          <div className="source-user-attachments" data-cds="MessageAttachments">
            {attachments.map((part, index) =>
              isImagePart(part) || !part.path
                ? <UserImageTile key={index} part={part} index={index} />
                : <UserFileCard key={index} part={part} />)}
          </div>
        )}
        {text && <div className="source-user-bubble" ref={bubbleRef}><SourceUserText text={text} sessionKey={sessionKey} itemId={item.id}
          cwd={cwd} onOpenFileRef={onOpenFileRef} hasFileAttachments={hasFileAttachments} /></div>}
      </div>
      {/* Codex has one startedAt per turn: only the user row that opens its turn
          shows it; a steer added mid-turn gets no time (no per-message timestamp). */}
      {text && !agentNested && <SourceUserActions sessionKey={sessionKey} itemId={item.id} text={text} interacted={interacted}
        startedAtMs={turnStart ? turnStartedAtMs : null} />}
    </article>
  );
}

// V2 / oue (scroll-messages-current.js:44449-44525): "Copy as quote" writes
// the B2 quote, flips to Check / "Copied" and adds the "Copied" toast. The
// step action sits in the TurnStatus.Step toolbar; the standalone block uses a
// ghost icon button revealed on hover or focus.
function SourceCopyQuote({ text, variant = "hover" }) {
  const toasts = useSourceToasts();
  const button = useRef(null), controller = useRef(null);
  const [state, setState] = useState("idle");
  useLayoutEffect(() => {
    const feedback = createClipboardFeedback({
      timeout: 2000, onState: setState,
      writeText: async value => {
        if (!await writeClipboardPayload(clipboardEnvironment(button.current), { text: value })) throw Error("Clipboard unavailable");
      },
    });
    controller.current = feedback;
    return () => { controller.current = null; feedback.dispose(); };
  }, []);
  useLayoutEffect(() => { controller.current?.setText(thinkingQuote(text)); }, [text]);
  const copied = state === "copied", label = copied ? t("Copied") : t("Copy as quote");
  const copy = () => { void controller.current?.copy().then(done => { if (done) toasts?.add(t("Copied")); }); };
  return <SourceTooltip content={label} hoverable={false}>
    <SourceSettingsButton ref={button} variant="ghost" size={variant === "action" ? "xs" : undefined} iconOnly icon={copied ? "Check" : "Copy"}
      iconSize={variant === "action" ? "auto-sm" : "auto"} className="source-reasoning-copy-button" aria-label={label}
      onMouseDown={variant === "action" ? undefined : event => event.preventDefault()} onClick={copy} />
  </SourceTooltip>;
}

// transcriptView (official c819d4a78 branch): thinking/verbose render reasoning
// items, normal hides them; verbose additionally mounts steps expanded.
// Group members (inToolGroup) are m8's RN{inGroup, inCard:true}
// (approval-current.js:54035-54063): command and Read/Edit bodies take the
// inCard layouts of Uoe/GO (:6874-6941) and UO (:6784-6837).
const NO_PENDING_APPROVALS = new Set();
export function SourceMessage({ isInterrupting = false, item, agentContext = null, agentNested = false, inToolGroup = false, turnStart = false, isStreaming = false, sessionKey = null, cwd = null, onOpenFileRef = null, onOpenChanges = null, transcriptView = "normal", pendingApprovalItemIds = NO_PENDING_APPROVALS, turnStartedAtMs = null, reasoningPlacement = "standalone" }) {
  if (isHiddenTranscriptItem(item, transcriptView)) return null;
  const stepDefaults = { forcedOpen: transcriptView === "verbose", sessionKey };
  if (item.type === "collabAgentToolCall") return <SourceAgentTool item={item} context={agentContext} inGroup={inToolGroup} Step={SourceStep} pendingApprovalItemIds={pendingApprovalItemIds} {...stepDefaults} />;
  if (item.type === "fileToolGroup") return <SourceToolGroup agentContext={agentContext} item={item} pendingApprovalItemIds={pendingApprovalItemIds} transcriptView={transcriptView}
    cwd={cwd} sessionKey={sessionKey} onOpenFileRef={onOpenFileRef} onOpenChanges={onOpenChanges}
    renderItem={member => <SourceMessage agentContext={agentContext} agentNested={agentNested} inToolGroup item={member} turnStart={false} isStreaming={isStreaming} sessionKey={sessionKey} cwd={cwd}
      onOpenFileRef={onOpenFileRef} onOpenChanges={onOpenChanges} transcriptView={transcriptView} pendingApprovalItemIds={pendingApprovalItemIds} />} />;

  if (item.type === "userMessage")
    return <SourceUserMessage agentNested={agentNested} item={item} turnStart={turnStart} sessionKey={sessionKey} cwd={cwd} onOpenFileRef={onOpenFileRef} turnStartedAtMs={turnStartedAtMs} />;
  if (item.type === "agentMessage" || item.type === "plan")
    return (
      <article
        className="source-message message assistant-message source-assistant-message"
        data-transcript-item-id={item.id}
        data-cds="AssistantMessage"
        data-turn-start={turnStart || undefined}
      >
        <SourceMarkdown text={item.text || ""} isStreaming={isStreaming} paceReveal={item.type === "agentMessage"} isInterrupting={isInterrupting} sessionKey={sessionKey} itemId={item.id} cwd={cwd} onOpenFileRef={onOpenFileRef} />
      </article>
    );
  if (item.type === "reasoning") {
    const text = reasoningText(item);
    if (!text.trim() || !showsThinking(transcriptView)) return null;
    // Thinking before tools is H2, an open "Thought process" step; any other
    // thought is the classic U2 block (scroll-messages-current.js:44475-44545).
    // Both are plain text: no Markdown and no reveal pacing.
    if (reasoningPlacement === "preceding-tools")
      return (
        <SourceStep item={item} label={t("Thought process")} className="source-reasoning source-reasoning-step" defaultOpen {...stepDefaults}
          actions={<SourceCopyQuote text={text} variant="action" />} actionsLabel={t("Thinking actions")}>
          <div className="source-reasoning-step-text"><bdi>{text}</bdi></div>
        </SourceStep>
      );
    return (
      <div className="source-message source-reasoning source-reasoning-block" data-transcript-item-id={item.id}>
        <div className="source-reasoning-text">{text}</div>
        <div className="source-reasoning-copy"><SourceCopyQuote text={text} /></div>
      </div>
    );
  }
  if (item.type === "fileChange" || fileAction(item)) {
    // QO under a standalone row, inside the row root after its body (RN approval-current.js:17302);
    // in a group FileToolMessage's body has them (FN :17324).
    const images = inToolGroup ? [] : (item.fileRun || [item]).flatMap(toolOutputImages);
    return <FileToolMessage item={item} Step={SourceStep} pendingApprovalItemIds={pendingApprovalItemIds} {...stepDefaults} inCard={inToolGroup}
      sessionKey={sessionKey} cwd={cwd} onOpenFileRef={onOpenFileRef} onOpenChanges={onOpenChanges}
      after={images.length ? <SourceToolImages images={images} itemId={item.id} /> : null} />;
  }
  if (item.type === "commandExecution") {
    const state = commandRowState(item, pendingApprovalItemIds.has(item.id));
    // approval-current.js:16326-16365 GM/KM/XM + :17279 `ne ? GM : null`: a
    // running bash row with a live background task gets "View live output"
    // in its heading, after verb/meta and before the running text and glyph;
    // it must not toggle the row (stopPropagation on click and keydown).
    const live = state === "busy" && item.processId && agentContext?.onTask
      ? <button type="button" className="src-cmd-live" data-row-live=""
          onClick={event => { event.stopPropagation(); agentContext.onTask(item.id); }}
          onKeyDown={event => event.stopPropagation()}>{t("View live output")}</button>
      : undefined;
    return (
      <SourceStep item={item} {...stepDefaults} {...commandRowLabel(item.command, state, item.description)} state={state} classic caretSize={14} trailing={live}>
        <SourceCommandBody
          item={item}
          state={state}
          scopeKey={JSON.stringify([sessionKey, item.id, "command"])}
          inCard={inToolGroup}
        />
      </SourceStep>
    );
  }
  if (isGenericTool(item)) {
    const observed=observedGenericTool(item,agentContext?.state,sessionKey);
    const state=commandRowState(observed,pendingApprovalItemIds.has(item.id));
    // wue (approval-current.js:45232-45240): an answered question is the vZ receipt card, not a row.
    const receipt=questionReceipt(observed,state);
    if(receipt)return <SourceQuestionReceipt item={item} pairs={receipt} sessionKey={sessionKey}/>;
    if((state==='busy'||state==='blocked')&&observed.type==='dynamicToolCall'&&observed.tool==='ask_user_question')notePendingQuestion(sessionKey,item.id);
    // Nothing answered: the Asked row with wue's outcome note ('Skipped') in RN's outcome slot.
    const outcome=questionOutcome(observed,state);
    const images=toolOutputImages(observed);
    // An exit_plan_mode or empty todo_write row has no body, so no caret.
    const body=genericToolBody(observed,state)==='none'?null:<SourceGenericToolBody item={item} state={state} cwd={cwd} onOpenFileRef={onOpenFileRef} inCard={inToolGroup}/>;
    // QO: output images in the body inside a group (FN :17324); under a standalone row they are
    // hoisted out of the collapsible body but stay in the row root, after it (RN :17302).
    const column=images.length?<SourceToolImages images={images} itemId={item.id}/>:null;
    return <SourceStep item={item} {...stepDefaults} {...genericToolLabel(observed,state)}
      state={state} classic caretSize={14} className="source-generic-step" trailing={outcome?<span className="source-step-outcome">{outcome}</span>:undefined}
      after={inToolGroup?null:column}>
      {/* KO :6943-6944: an MCP body is the standalone WO card only outside a group row. */}
      {inToolGroup&&column?<>{body}{column}</>:body}
    </SourceStep>;
  }
  if (item.type === "contextCompaction")
    return (
      <SourceStep
        item={item}
        {...stepDefaults}
        label={isStreaming ? t("Compacting conversation") : ["failed", "stopped"].includes(outcome(item)) ? t("Compaction interrupted") : t("Compacted conversation")}
        state={outcome(item)}
      />
    );
  if (item.type === "enteredReviewMode" || item.type === "exitedReviewMode")
    return <SourceStep item={item} {...stepDefaults} label={item.type === "enteredReviewMode" ? t("Review started") : t("Review result")} state="done">
      {item.review && <SourceMarkdown text={item.review} sessionKey={sessionKey} itemId={item.id} cwd={cwd} onOpenFileRef={onOpenFileRef} />}
    </SourceStep>;
  return null;
}

export function SourceWorking({
  stopping = false,
  waiting = false,
  elapsedSeconds,
  label,
}) {
  const text =
    label ||
    (stopping
      ? t("Stopping…")
      : waiting
        ? t("Waiting for your approval")
        : t("Working…"));
  return (
    <div
      className="source-message source-working"
      role="status"
      data-testid="code-working-line"
      data-working-row
    >
      <span className={waiting ? "" : "source-shimmer"}>{text}</span>
      {Number.isFinite(elapsedSeconds) && elapsedSeconds >= 2 && !waiting && (
        <span className="source-working-time">
          {t("{seconds}s", { seconds: Math.floor(elapsedSeconds) })}
        </span>
      )}
    </div>
  );
}

// Submission identity and draft lifetime are owned by the shared root runtime.
export function SourceApproval(props) {
  if (!approvalIdentity(props.request)) return <SourceApprovalCardView
    request={props.request} item={props.item} enabled={false}
    error={t("This request cannot be answered because its type or required identity is unsupported.")} />;
  // PM (approval-current.js:16105-16127): ExitPlanMode gets Rse's plan card; here the
  // bridge's exit_plan_mode review (question id 'plan-review', R07).
  if (isPlanReviewRequest(props.request)) return <SourcePlanApprovalCard {...props} />;
  return props.request.method === "item/tool/requestUserInput"
    ? <SourceQuestionCard {...props} />
    : <SourceApprovalCard {...props} renderDetails={(detail, model) =>
        detail.kind === "path"
          ? <ApprovalFileDetail detail={detail} meta={model.heading?.meta}
              sessionKey={props.sessionKey} cwd={props.cwd} onOpenFileRef={props.onOpenFileRef} itemId={props.item?.id ?? props.request.params?.itemId} />
          : <pre className="sac-code">{detail.text}</pre>} />;
}
// EM's file request (approval-current.js:15528-15552 U, :15596-15607 Kv + yce): the
// full-path detail box (shown when it differs from the basename meta), then per change
// the transcript's in-card diff body (cd98a1763 ApprovalFileChangeBody). A change over
// the preview limit gets no body; the card shows the fM sentence instead.
function ApprovalFileDetail({ detail, meta, itemId, sessionKey, ...props }) {
  return <>
    {detail.text && detail.text !== meta && <div className="sac-code sac-path">{detail.text}</div>}
    {detail.value.map((change, index) => previewTooLarge(change) || typeof change?.diff !== "string" ? null
      : <ApprovalFileChangeBody key={index} change={change} sessionKey={sessionKey} {...props}
          scopeKey={JSON.stringify([sessionKey, itemId, "approval", index])} isFrontier={false} />)}
  </>;
}

// Tree keyboard model (2.2553.1 panes-tile-current.js:5059-5165 bg, :4700
// root, :5710 treeitem attributes): the tree container holds the tab stop,
// rows are tabIndex -1 treeitems with a [data-tree-primary] activation button.
function treeRows(tree) {
  return Array.from(tree.querySelectorAll("[data-tree-row]")).filter(
    (row) => !row.closest("[hidden], [inert]"),
  );
}
function focusTreeRow(row) {
  if (!row) return;
  row.focus({ preventScroll: true });
  row.scrollIntoView?.({ block: "nearest" });
}
function activateTreeRow(row) {
  row?.querySelector("[data-tree-primary]")?.click();
}
// Flat row/parent indices for a non-virtualized tree: recomputed after any
// subtree change so ArrowLeft can jump to the parent via data-parent-index.
export function indexTreeRows(tree) {
  const rows = treeRows(tree);
  const parents = [];
  rows.forEach((row, index) => {
    const level = Number(row.getAttribute("aria-level") ?? "1");
    while (parents.length && parents[parents.length - 1].level >= level) parents.pop();
    row.setAttribute("data-row-index", String(index));
    if (parents.length) row.setAttribute("data-parent-index", String(parents[parents.length - 1].index));
    else row.removeAttribute("data-parent-index");
    parents.push({ level, index });
  });
  return rows.length;
}
export function treeFocusTarget(tree) {
  const rows = treeRows(tree);
  const current = rows.find((row) => row.getAttribute("aria-current"));
  if (current) return current;
  const box = tree.getBoundingClientRect();
  return rows.find((row) => {
    const rect = row.getBoundingClientRect();
    return rect.top >= box.top && rect.bottom <= box.bottom;
  }) ?? rows[0] ?? null;
}
export function treeKeyDown(event, tree, filterInput) {
  if (event.nativeEvent?.isComposing || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
  const rows = treeRows(tree);
  if (rows.length === 0) return;
  const active = tree.ownerDocument.activeElement;
  // Directory rows contain their children: resolve the innermost row.
  const closest = active?.closest?.("[data-tree-row]") ?? null;
  const row = closest && rows.includes(closest) ? closest : null;
  const index = row ? rows.indexOf(row) : -1;
  const last = rows.length - 1;
  const first = () => rows.indexOf(treeFocusTarget(tree));
  const go = (next) => focusTreeRow(rows[Math.max(0, Math.min(last, next))]);
  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      go(index < 0 ? first() : index + 1);
      return;
    case "ArrowUp":
      event.preventDefault();
      if (index === 0 && filterInput) { filterInput.focus(); return; }
      go(index < 0 ? first() : index - 1);
      return;
    case "Home":
      event.preventDefault();
      go(0);
      return;
    case "End":
      event.preventDefault();
      go(last);
      return;
    case "Tab":
      if (event.shiftKey && row) tree.focus({ preventScroll: true });
      return;
    case "Enter":
    case " ":
      if (!row) return;
      event.preventDefault();
      activateTreeRow(row);
      return;
    case "ArrowRight":
      if (!row) return;
      event.preventDefault();
      if (row.getAttribute("aria-expanded") === "false") activateTreeRow(row);
      else go(index + 1);
      return;
    case "ArrowLeft": {
      if (!row) return;
      event.preventDefault();
      if (row.getAttribute("aria-expanded") === "true") { activateTreeRow(row); return; }
      const parentIndex = row.getAttribute("data-parent-index");
      if (parentIndex !== null) { const at = Number(parentIndex); if (at >= 0) go(at); return; }
      const level = Number(row.getAttribute("aria-level") ?? "1");
      for (let at = index - 1; at >= 0; at--)
        if (Number(rows[at].getAttribute("aria-level") ?? "1") < level) { go(at); return; }
      return;
    }
    default:
  }
}

function SourceTreeNode({
  entry,
  cwd,
  activePath,
  onOpen,
  level = 0,
  refreshKey,
  call,
  revealPath,
  revealGeneration = 0,
  treeVisible = true,
  expandedPaths,
  onExpandedChange,
  fileMenu = null,
}) {
  const [localOpen, setLocalOpen] = useState(false);
  // Wr.Root ContextMenu (panes-tile-current.js:5701-5790): the point the menu opens at.
  const [menu, setMenu] = useState(null);
  const nameRef = useRef(null), pointerInside = useRef(false), menuReturnFocus = useRef(null);
  const controlled = expandedPaths instanceof Set;
  const open = controlled ? expandedPaths.has(entry.path) : localOpen;
  const setOpen = useCallback((value) => {
    if (controlled) onExpandedChange?.(entry.path, value);
    else setLocalOpen(value);
  }, [controlled, onExpandedChange, entry.path]);
  const rowRef = useRef(null);
  useFileTreeReveal({ entry, revealPath, revealGeneration, treeVisible,
    expand: setOpen, rowRef });
  const [children, setChildren] = useState(null);
  const [error, setError] = useState(false);
  const includeChild = revealChild(entry.path, revealPath);
  useEffect(() => {
    if (!open || !entry.directory) return;
    let live = true;
    // Keep keyed rows mounted during a refresh so expansion survives a clear.
    setError(false);
    call("files", { cwd, relative: entry.path, includeChild })
      .then((data) => live && setChildren(data))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [cwd, entry.path, entry.directory, open, refreshKey, includeChild, call]);
  // Hu (c44d00c7f ma :3872-3897) around the row: 700ms, bottom/start, not
  // hoverable; the name when it is clipped, or when the pointer is on a row that
  // has a detail (the Rg link text, else a file's folder); nothing while the
  // row's menu is open.
  const linkText = entry.link ? fileLinkLabel(entry.link) : null;
  const folder = entry.path.includes("/") ? entry.path.slice(0, entry.path.lastIndexOf("/")) : "";
  const detail = linkText ?? (entry.directory ? null : folder || null);
  const tooltipContent = menu ? null : () => {
    const name = nameRef.current;
    if (name && name.scrollWidth > name.clientWidth) return entry.name;
    return detail && pointerInside.current ? entry.name : null;
  };
  const entries = menu && fileMenu ? fileMenu.entries(entry.path, { surface: "file_browser", directory: !!entry.directory, linkState: entry.link?.state }) : null;
  return (
    <div
      role="treeitem"
      data-tree-row=""
      aria-level={level + 1}
      aria-expanded={entry.directory ? open : undefined}
      aria-selected={activePath === entry.path}
      aria-current={activePath === entry.path ? "page" : undefined}
      tabIndex={-1}
      className="source-tree-item"
      data-popup-open={menu ? "" : undefined}
      onContextMenu={fileMenu ? (event) => {
        // Rows nest inside their parent treeitem: only the innermost row opens.
        if (event.target.closest?.('[role="treeitem"]') !== event.currentTarget) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = rowRef.current?.getBoundingClientRect();
        const keyboard = event.clientX === 0 && event.clientY === 0 && rect;
        menuReturnFocus.current = event.currentTarget.ownerDocument.activeElement;
        setMenu(keyboard ? { x: rect.left, y: rect.bottom } : { x: event.clientX, y: event.clientY });
      } : undefined}
    >
      <SourceTooltip content={tooltipContent} detail={menu ? null : detail} side="bottom" align="start" delay={700} hoverable={false}>
      <button
        ref={rowRef}
        type="button"
        className="source-tree-row"
        data-tree-primary=""
        tabIndex={-1}
        aria-label={entry.name}
        style={{ paddingLeft: 8 + level * 8 }}
        onClick={() => (entry.directory ? setOpen(!open) : onOpen(entry))}
        onDoubleClick={() =>
          !entry.directory && onOpen(entry, { preview: false })
        }
        onPointerEnter={() => { pointerInside.current = true; }}
        onPointerLeave={() => { pointerInside.current = false; }}
        data-file-path={entry.path}
        data-link-state={entry.link?.state}
      >
        {/* panes-tile-current.js:5692-5770: one xs (12px) text-muted glyph,
            ae = directory ? CaretRight (rotate-90 when open) : zr(name)
            (shared-14 cP); no native title on the row; a symlink adds the xs
            muted ArrowUpRight mark whose alt is the Rg link text. */}
        <Icon
          name={entry.directory ? "CaretRight" : fileKindIcon(entry.name)}
          size={12}
          className={entry.directory ? "source-tree-caret" : undefined}
        />
        <span ref={nameRef} className="source-tree-name">{entry.name}</span>
        {linkText && <Icon name="ArrowUpRight" size={12} role="img" aria-hidden={undefined} aria-label={linkText}
          data-testid="file-tree-link-mark" className="source-tree-link-mark" />}
      </button>
      </SourceTooltip>
      {entries && (
        <SourceMenu.Popup anchor={rowRef.current} trigger={null} point={menu} side="bottom" align="start"
          sideOffset={CONTEXT_MENU_SIDE_OFFSET} alignOffset={CONTEXT_MENU_ALIGN_OFFSET} layer="contextmenu" dataCds="ContextMenu"
          label={t("File actions")} onClose={() => setMenu(null)} finalFocus={() => {
            // Base UI returns focus to where it was before the context menu opened.
            const previous = menuReturnFocus.current;
            return previous?.isConnected && previous !== previous.ownerDocument.body ? previous : rowRef.current?.closest('[role="treeitem"]');
          }}>
          <SourceFileMenuEntries entries={entries} onSelect={(item) => fileMenu.select(item, entry.path)} />
        </SourceMenu.Popup>
      )}
      {open && entry.directory && (
        <div role="group">
          {/* Pg (panes-tile-current.js:5335-5350): a subfolder without data adds
              only the Lg error row when its read failed; loading and empty add
              no rows, and retained children win over a failed refresh. */}
          {children === null ? (
            error ? <SourceTreeErrorRow depth={level + 1} /> : null
          ) : (
            children.map((child) => (
              <SourceTreeNode
                key={child.path}
                entry={child}
                cwd={cwd}
                activePath={activePath}
                onOpen={onOpen}
                level={level + 1}
                refreshKey={refreshKey}
                call={call}
                revealPath={revealPath}
                revealGeneration={revealGeneration}
                treeVisible={treeVisible}
                expandedPaths={expandedPaths}
                onExpandedChange={onExpandedChange}
                fileMenu={fileMenu}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Gg/Kg (panes-tile-current.js:6030-6085): items, Copy-style submenus (side
// right, align start, sideOffset -4) and separators from file-context-menu-model.
function SourceFileMenuEntries({ entries, onSelect }) {
  return entries.map((entry, index) => entry.kind === "separator" ? <SourceMenu.Separator key={index} />
    : entry.kind === "submenu" ? <SourceMenu.Submenu key={index}>
        <SourceMenu.SubmenuTrigger>{entry.label}</SourceMenu.SubmenuTrigger>
        <SourceMenu.Popup label={entry.label} side="right" align="start" sideOffset={-4}>
          <SourceFileMenuEntries entries={entry.items} onSelect={onSelect} />
        </SourceMenu.Popup>
      </SourceMenu.Submenu>
    : <SourceMenu.Item key={index} onClick={() => onSelect(entry)}>{entry.label}</SourceMenu.Item>);
}

// Tree container: single tab stop, focus lands on the current or first fully
// visible row; row indices are refreshed whenever the subtree changes.
function SourceTree({ children, busy, filterInputSelector }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const tree = ref.current;
    if (!tree) return undefined;
    indexTreeRows(tree);
    const observer = new MutationObserver(() => indexTreeRows(tree));
    observer.observe(tree, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-level", "hidden"] });
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      role="tree"
      aria-label={t("Project files")}
      aria-busy={busy || undefined}
      tabIndex={0}
      className="source-tree-content"
      // Only a keyboard arrival from outside the tree is redirected to the
      // current row (official yg guards): focus handed back from a row
      // (Shift+Tab on its way out) or a pointer press on the background
      // stays on the container, so sequential focus can leave the tree.
      onFocus={(event) => {
        const tree = event.currentTarget;
        if (event.target !== tree || tree.contains(event.relatedTarget) || !tree.matches(":focus-visible")) return;
        const target = treeFocusTarget(tree);
        if (target) focusTreeRow(target);
      }}
      onKeyDown={(event) => {
        const tree = event.currentTarget;
        if (!tree.contains(event.target)) return;
        const input = filterInputSelector ? tree.closest(".sfs-browser")?.querySelector(filterInputSelector) : null;
        treeKeyDown(event, tree, input);
      }}
    >
      {children}
    </div>
  );
}

// Files pane tab (2.2553.1 readable/panes-tabs-current.js:333-491 he; model
// panes-tile-current.js:6656-6710 ce/le). Local adaptations: no Base UI Tabs /
// ContextMenu primitives (the local roving keys, SourceTooltip and
// SourceMenu stand in) and no pointer drag reorder. data-vtb-id is the strip
// measure's key (_e); an overflowed tab stays laid out but invisible, a compact
// one drops its close button and label mask (he :364-372, :463-466).
function SourceFileTab({ file, cwd, selected, tabIndex, solo, posinset, setsize, hintId, moveHintId, overflowed = false, compact = false, fileMenu = null, onSelect, onClose, onCloseOthers, onCloseAll, onKeep, onKeyDown }) {
  const root = useRef(null), tabRef = useRef(null), labelRef = useRef(null), returnFocus = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // he N/F/ie: a pointer-down on the tab hides its tooltip until the pointer leaves the tab.
  const [pressed, setPressed] = useState(false);
  const [clipped, setClipped] = useState(false);
  const label = basename(file.path), detail = tabDetail(file.path, cwd), preview = file.preview === true;
  // Be (clipped): the label span overflows its max-w-[140px] box.
  useLayoutEffect(() => {
    const node = labelRef.current;
    if (!node) return undefined;
    const measure = () => setClipped(node.scrollWidth > node.clientWidth);
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(node);
    return () => observer?.disconnect();
  }, [label, preview]);
  const tooltip = tabTooltip({ label, detail, clipped, suppressed: menuOpen || pressed });
  const fileEntries = menuOpen && fileMenu ? fileMenu.entries(file.path, { surface: "file_tab", unavailable: file.unavailable }) : null;
  const actions = { keep: () => onKeep(file.path), close: () => onClose(file.path), "close-others": () => onCloseOthers(file.path), "close-all": () => onCloseAll() };
  // Base UI returns focus to where it was before the context menu opened; a
  // closed tab hands it to the tab that is selected afterwards.
  const restoreTarget = () => {
    const previous = returnFocus.current;
    if (previous?.isConnected && previous !== previous.ownerDocument.body) return previous;
    return tabRef.current?.isConnected ? tabRef.current
      : root.current?.ownerDocument.querySelector('.source-file-tabs [role="tab"][aria-selected="true"]') ?? null;
  };
  return (
    <div
      ref={root}
      role="presentation"
      className="source-file-tab"
      data-vtb-id={file.path}
      data-file-path={file.path}
      data-preview={preview || undefined}
      data-selected={selected || undefined}
      data-compact={compact || undefined}
      data-overflowed={overflowed || undefined}
      data-popup-open={menuOpen || undefined}
      onMouseDown={(event) => {
        // _e/Z: a secondary (or macOS Control-) press never moves focus; a middle press is claimed for close.
        if (event.button === 2 || event.button === 1 || (event.button === 0 && event.ctrlKey && /Mac/i.test(navigator.platform ?? ""))) event.preventDefault();
      }}
      // Z (:309-314, he onMouseUp :359): a middle-button mouseup on a closable tab is claimed too.
      onMouseUp={(event) => {
        if (event.button === 1) event.preventDefault();
      }}
      onAuxClick={(event) => {
        if (event.button === 1) {
          event.preventDefault();
          onClose(file.path);
        }
      }}
      onDoubleClick={preview ? () => onKeep(file.path) : undefined}
      onContextMenu={(event) => {
        event.preventDefault();
        returnFocus.current = event.currentTarget.ownerDocument.activeElement;
        setMenuOpen(true);
      }}
      onPointerLeave={() => setPressed(false)}
    >
      <span aria-hidden="true" className="source-file-tab-bg" />
      <SourceTooltip content={tooltip.content} detail={tooltip.detail} side="bottom" align="start" delay={700} hoverable={false}>
        <div
          ref={tabRef}
          role="tab"
          aria-selected={selected}
          aria-posinset={posinset}
          aria-setsize={setsize}
          aria-describedby={[hintId, moveHintId].filter(Boolean).join(" ") || undefined}
          aria-disabled={overflowed || undefined}
          tabIndex={tabIndex}
          onPointerDown={() => setPressed(true)}
          onClick={() => onSelect(file.path)}
          onKeyDown={(event) => {
            // Base UI useButton (nativeButton:false): Enter/Space activate the div tab.
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelect(file.path);
              return;
            }
            onKeyDown(event, file.path);
          }}
        >
          <span ref={labelRef} className="source-file-tab-label" data-vtb-label="" data-clipped={(clipped && !compact) || undefined}>
            <span>
              {label}
              {preview && <span className="source-sr-only">, {FILE_TAB_LABELS.previewTabHint}</span>}
            </span>
          </span>
        </div>
      </SourceTooltip>
      {/* pe: pointer-only close; keyboard users close with Delete/Backspace. A compact tab has none. */}
      {!compact && <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        aria-label={FILE_TAB_LABELS.closeTab}
        className="source-file-tab-close"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onClose(file.path)}
      >
        <Icon name="X" size={12} />
      </button>}
      {menuOpen && (
        <SourceMenu.Popup
          anchor={root.current}
          trigger={null}
          side="bottom"
          align="start"
          dataCds="ContextMenu"
          layer="contextmenu"
          finalFocus={restoreTarget}
          onClose={(reason) => {
            setMenuOpen(false);
            if (reason === "escape-key") restoreTarget()?.focus({ preventScroll: true });
          }}
        >
          {/* he popup (:470-485): renderTabMenuItems Ce — the l_ file items
              (panes-tile-current.js:6809-6862) — then a separator before the
              Keep open / Close items. */}
          {fileEntries?.length > 0 && <>
            <SourceFileMenuEntries entries={fileEntries} onSelect={(item) => fileMenu.select(item, file.path)} />
            <SourceMenu.Separator />
          </>}
          {tabMenuItems({ preview, solo }).map((item) => (
            <SourceMenu.Item key={item.action} onClick={actions[item.action]}>
              {item.label}
            </SourceMenu.Item>
          ))}
        </SourceMenu.Popup>
      )}
    </div>
  );
}

// K/q (panes-tabs-current.js:68-178): the ghost icon-only CaretDown "More
// files" trigger (te tooltip) and a menu (side bottom, align end) of the hidden
// tabs: the basename (italic for a preview, sr-only ", preview"), the folder as
// a caption, a pointer-only X "Close file", and ArrowRight closes the
// highlighted row (sr-only "press right arrow to close").
const EMPTY_STRIP = Object.freeze({ hiddenIds: [], compactIds: [], overflowing: false });
const TREE_TOGGLE_SHORTCUT = "cmd+shift+y";
function SourceFileTabOverflow({ tabs, cwd, onActivate, onClose }) {
  const [open, setOpen] = useState(null);
  const button = useRef(null);
  const hintId = useId();
  return <>
    <SourceTooltip content={FILE_TAB_LABELS.moreTabs} hoverable={false}>
      <SourceSettingsButton ref={button} variant="ghost" iconOnly icon="CaretDown" iconSize="auto" aria-label={FILE_TAB_LABELS.moreTabs}
        className="source-file-tabs-more" {...menuTriggerProps({ open: !!open, onOpen: (entry) => setOpen(entry) })}
        onClick={() => setOpen((value) => (value ? null : "first"))} />
    </SourceTooltip>
    {open && <SourceMenu.Popup anchor={button.current} side="bottom" align="end" label={FILE_TAB_LABELS.moreTabs}
      initialHighlight={open === "last" ? "last" : "first"} onClose={() => setOpen(null)}>
      <span id={hintId} className="source-sr-only">{FILE_TAB_LABELS.closeTabHint}</span>
      {tabs.map((file) => {
        const label = basename(file.path), detail = tabDetail(file.path, cwd), preview = file.preview === true;
        return <SourceMenu.Item key={file.path} aria-describedby={hintId} className="source-file-overflow-row" data-file-path={file.path}
          onClick={() => onActivate(file.path)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowRight") return;
            event.preventDefault();
            event.stopPropagation();
            onClose(file.path);
          }}
          trailing={<span aria-hidden="true" title={FILE_TAB_LABELS.closeTab} className="source-file-overflow-close"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.stopPropagation(); onClose(file.path); }}>
            <Icon name="X" size={12} />
          </span>}>
          <span className="source-file-overflow-copy">
            <span className="source-file-overflow-label" data-preview={preview || undefined} title={label}>
              {label}{preview && <span className="source-sr-only">, {FILE_TAB_LABELS.previewTabHint}</span>}
            </span>
            {detail !== undefined && <span className="source-file-overflow-detail" title={detail}>{detail}</span>}
          </span>
        </SourceMenu.Item>;
      })}
    </SourceMenu.Popup>}
  </>;
}

export function SourceFilePanel(props) {
  return <FilePane key={`${props.sessionId ?? "home"}:${props.searchPane ?? "main"}:${props.cwd || "no-folder"}`} {...props} />;
}

// Controlled/uncontrolled bridge: the session workspace owns the file view in
// the tile store (tabs, active path, tree visibility, expanded folders) so it
// survives closing the pane, switching sessions and relaunching; the
// artifacts browser keeps component-local state.
function useViewState(view, onViewChange, key, fallback) {
  const [local, setLocal] = useState(fallback);
  const controlled = !!view && !!onViewChange && Object.hasOwn(view, key);
  const value = controlled ? view[key] : local;
  const viewRef = useRef(view);
  viewRef.current = view;
  const set = useCallback((next) => {
    if (controlled) {
      const previous = viewRef.current[key];
      const resolved = typeof next === "function" ? next(previous) : next;
      if (resolved !== previous) {
        // Later functional updates before the next render (two file reads
        // resolving together) build on this value, not on the stale view.
        viewRef.current = { ...viewRef.current, [key]: resolved };
        onViewChange({ [key]: resolved });
      }
    } else setLocal(next);
  }, [controlled, onViewChange, key]);
  return [value, set];
}
function FilePane({
  sessionId = null,
  searchPane = "main",
  cwd,
  tab,
  plan,
  // R09: the latest proposed plan document (state.planDocs) for the Plan pane.
  planDocument = null,
  diff,
  diffScope,
  // F12: the zm "Diff scope: …" trigger (source-diff-scope.jsx) shown in place of the Changes title.
  diffScopeControl = null,
  diffError,
  loading = false,
  onClose,
  onRefresh,
  openRequest = null,
  onOpenRequestHandled = null,
  // Changes header actions for SourceDiff placement "changes" (c219730b0 Ze/$e):
  // {root, onCopy, onOpenFile, onAttachFile} from main.jsx.
  diffFileActions = null,
  // Files pane file actions from main.jsx: {onAttachFile(absolute), onRevealFile(absolute)};
  // each is null where it has no target (no composer, no session reveal IPC).
  fileActions = null,
  // main.jsx's ⌘⇧Y (toggleDiffFileList) handle: FilePane registers its tree toggle here
  // (the Files tree for tab "files", the Changed files column for tab "changes").
  treeToggleRef = null,
  // R10 Changes file list state from main.jsx's tile store ({diffShowTree,
  // diffTreeWidth, diffFileTree, diffGroupByKind}) and its setter (patch); without
  // them (popout) the pane keeps component-local state with the same defaults.
  diffTree = null,
  onDiffTreeChange = null,
  call = desktopCall,
  view = null,
  onViewChange = null,
  headerCenter = null,
  paneControls = null,
}) {
  const toasts = useSourceToasts();
  const [diffPreferences, setDiffPreference] = useDiffViewPreferences();
  const diffView = diffPayload(diff);
  const [diffCanFitSplit, setDiffCanFitSplit] = useState(true);
  // requestDiffFoldAll (panes-state-current.js:2809-2821): {collapsed, seq}; each
  // request bumps seq so FileDiff applies it once (source-diff.jsx FileDiff).
  const [diffFoldAll, setDiffFoldAll] = useState(null);
  // R10 Changed files column (panes-tile-current.js:3640-3690 dh, :3740-3779 fh,
  // panes-state-current.js:646-647): visibility, width and grouping persist in the
  // tile store; diffCanFitTree is reported by SourceDiff (?? true, uh) and
  // diffIsLarge (Qe) disables "Expand all files".
  const [diffShowTree, setDiffShowTree] = useViewState(diffTree, onDiffTreeChange, "diffShowTree", false);
  const [diffTreeWidth, setDiffTreeWidth] = useViewState(diffTree, onDiffTreeChange, "diffTreeWidth", 240);
  const [diffFileTree, setDiffFileTree] = useViewState(diffTree, onDiffTreeChange, "diffFileTree", true);
  const [diffGroupByKind, setDiffGroupByKind] = useViewState(diffTree, onDiffTreeChange, "diffGroupByKind", false);
  const [diffCanFitTree, setDiffCanFitTree] = useState(true);
  const [diffIsLarge, setDiffIsLarge] = useState(false);
  // uh: the toggle exists while the column can fit and the body is not empty
  // (diffBodyEmpty: the empty and failed states; loading still shows it).
  const diffListAvailable = tab === "changes" && !diffError && (loading || !!diffView.patch) && diffCanFitTree;
  const toggleDiffTree = useCallback(() => setDiffShowTree((shown) => !shown), [setDiffShowTree]);
  // ke failed shows no error detail; keep the raw reason in the console, once per message.
  const warnedDiffError = useRef("");
  useEffect(() => {
    if (tab === "changes" && diffError && warnedDiffError.current !== diffError) { warnedDiffError.current = diffError; console.warn(diffError); }
  }, [tab, diffError]);
  const [entries, setEntries] = useState(null);
  const [fileTabs, setFileTabs] = useViewState(view, onViewChange, "fileTabs", []);
  const [expandedList, setExpandedList] = useViewState(view, onViewChange, "expandedPaths", null);
  const expandedPaths = useMemo(() => (Array.isArray(expandedList) ? new Set(expandedList) : null), [expandedList]);
  const onExpandedChange = useCallback((path, open) => {
    setExpandedList((list) => {
      const next = new Set(Array.isArray(list) ? list : []);
      if (open) next.add(path); else next.delete(path);
      return [...next];
    });
  }, [setExpandedList]);
  // Inline file-reference chips (2.2553.1 gy -> pane open at line): the
  // request opens the file as a preview tab; the viewer marks line..endLine
  // (data-active rows) and centres it once per request (nonce = the request's
  // sequence, Fu scrollNonce, panes-tile-current.js:6328-6352).
  const [activeLine, setActiveLine] = useState(null);
  const [activePath, setActivePath] = useViewState(view, onViewChange, "activePath", null);
  const [treeError, setTreeError] = useState("");
  const [treeRefreshing, setTreeRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [treeReveal, setTreeReveal] = useState({ path: null, generation: 0 });
  const includeRootChild = revealChild("", treeReveal.path);
  const [paneWidth, setPaneWidth] = useState(0);
  const [treeShown, setTreeShown] = useViewState(view, onViewChange, "treeShown", false);
  const [treeHiddenWhileEmpty, setTreeHiddenWhileEmpty] = useViewState(view, onViewChange, "treeHiddenWhileEmpty", false);
  const treeReturnPath = useRef(null);
  const [treeWidth, setTreeWidth] = useState(() => {
    try {
      const saved = Number(
        localStorage.getItem("code-desktop-files-tree-width"),
      );
      return saved >= 160 && saved <= 640 ? saved : 240;
    } catch {
      return 240;
    }
  });
  const [dragTreeWidth, setDragTreeWidth] = useState(null);
  const treeDragStart = useRef(null);
  const treeHandleFocus = useRef(false);
  // Search files (c_ -> focusFilesTreeFilter): the pending filter focus and a
  // tick that re-runs the focus effect when the tree was already visible.
  const filterFocus = useRef(false);
  const [filterFocusTick, setFilterFocusTick] = useState(0);
  const tabSequence = useRef(0);
  const closeFocus = useRef(null);
  const mounted = useRef(true);
  const pane = useRef(null);
  const closeHintId = useId(), moveHintId = useId();
  // Tab strip overflow (_e, panes-tabs-current.js:503-680; pure model in
  // file-tab-overflow-model.mjs): hidden tabs stay laid out but invisible and
  // are listed in "More files"; the strip scrolls so the active tab shows.
  const tabBar = useRef(null), tabList = useRef(null), reorderFocus = useRef(null);
  const [strip, setStrip] = useState(EMPTY_STRIP);
  useLayoutEffect(() => {
    const list = tabList.current, root = tabBar.current;
    if (!list || tab !== "files") {
      setStrip((previous) => (previous === EMPTY_STRIP ? previous : EMPTY_STRIP));
      return undefined;
    }
    const measure = () => {
      if (!list.isConnected) return;
      const nodes = [...list.querySelectorAll("[data-vtb-id]")];
      const tabs = nodes.map((node) => {
        const label = node.querySelector("[data-vtb-label]");
        return { id: node.dataset.vtbId, start: node.offsetLeft - 4, end: node.offsetLeft - 4 + node.offsetWidth,
          compact: node.hasAttribute("data-compact"), clipped: !!label && label.scrollWidth > label.clientWidth + 1 };
      });
      let overflowWidth = 0, compactSlack = 0;
      const button = root?.querySelector(":scope > [data-vtb-overflow]");
      const win = list.ownerDocument.defaultView;
      if (root && button) overflowWidth = Math.floor(button.getBoundingClientRect().width) + (parseFloat(win?.getComputedStyle(root).columnGap ?? "") || 0);
      const compactCount = tabs.filter((value) => value.compact).length;
      if (root && compactCount > 0) {
        // The free width at the end of the bar, shared by the compact tabs (:589-601).
        const box = root.getBoundingClientRect();
        let right = box.left;
        for (const child of root.children) {
          const rect = child.getBoundingClientRect();
          if (rect.width > 0) right = Math.max(right, child === list ? rect.right - 4 : rect.right);
        }
        compactSlack = Math.max(0, box.right - right) / compactCount;
      }
      const layout = tabOverflowLayout({ tabs, clientWidth: list.clientWidth, scrollWidth: list.scrollWidth, scrollLeft: list.scrollLeft,
        overflowWidth, activeId: activePath, compactSlack });
      if (Math.abs(list.scrollLeft - layout.scrollLeft) > 1) list.scrollLeft = layout.scrollLeft;
      setStrip((previous) => {
        const hiddenIds = stableIds(previous.hiddenIds, layout.hiddenIds), compactIds = stableIds(previous.compactIds, layout.compactIds);
        return hiddenIds === previous.hiddenIds && compactIds === previous.compactIds && previous.overflowing === layout.overflowing
          ? previous : { hiddenIds, compactIds, overflowing: layout.overflowing };
      });
    };
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    if (observer) {
      observer.observe(list);
      if (root) observer.observe(root);
      for (const node of list.querySelectorAll("[data-vtb-id]")) observer.observe(node);
    }
    list.addEventListener("scroll", measure, { passive: true });
    return () => { observer?.disconnect(); list.removeEventListener("scroll", measure); };
  }, [fileTabs, activePath, tab]);
  // _e (:640-663): a focused tab that becomes hidden hands focus to the active
  // tab; a reordered tab keeps focus.
  useLayoutEffect(() => {
    const list = tabList.current;
    if (!list) return;
    const focusTab = (path) => [...list.querySelectorAll("[data-vtb-id]")].find((node) => node.dataset.vtbId === path)?.querySelector('[role="tab"]');
    const moved = reorderFocus.current;
    reorderFocus.current = null;
    if (moved) { const node = focusTab(moved); if (node && node.ownerDocument.activeElement !== node) node.focus({ preventScroll: true }); return; }
    const active = list.ownerDocument.activeElement;
    if (strip.hiddenIds.some((path) => focusTab(path)?.contains(active))) focusTab(activePath)?.focus({ preventScroll: true });
  }, [strip.hiddenIds, fileTabs]); // eslint-disable-line react-hooks/exhaustive-deps
  const hiddenTabs = useMemo(() => fileTabs.filter((file) => strip.hiddenIds.includes(file.path)), [fileTabs, strip.hiddenIds]);
  const activeTab = fileTabs.find((file) => file.path === activePath);
  // The file view (fileView, panes-tile-current.js:6328-6352): the active tab,
  // whatever its body state (loading, text or an unavailable card).
  const preview = activeTab;
  // One read per path at a time; a newer read of the same path wins, and a
  // result only updates a tab that is still open (a closed tab never returns).
  const reads = useRef(new Map());
  function loadFile(path, { force = false } = {}) {
    if (!cwd || typeof path !== "string" || !path) return;
    const token = {};
    reads.current.set(path, token);
    Promise.resolve()
      .then(() => call("file", { cwd, relative: path, ...(force ? { force: true } : {}) }))
      .then((file) => (file && typeof file === "object" ? file : { unavailable: "read_error" }),
        () => ({ unavailable: "read_error" }))
      .then((file) => {
        if (!mounted.current || reads.current.get(path) !== token) return;
        reads.current.delete(path);
        const result = typeof file.text === "string" ? { text: file.text } : { unavailable: file.unavailable ?? "read_error", ...(Number.isFinite(file.size) ? { size: file.size } : {}) };
        setFileTabs((files) => files.map((value) => {
          if (value.path !== path) return value;
          const { text, unavailable, size, ...rest } = value;
          return { ...rest, ...result };
        }));
      });
  }
  // Tabs restored from the persisted store carry only path/preview; the
  // active one is re-read through the same scoped file IPC.
  useEffect(() => {
    if (!activeTab || typeof activeTab.text === "string" || activeTab.unavailable || !cwd || reads.current.has(activeTab.path)) return;
    loadFile(activeTab.path);
  }, [activeTab, cwd]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!openRequest || typeof openRequest.path !== "string") return;
    setActiveLine(Number.isInteger(openRequest.line) && openRequest.line > 0
      ? { path: openRequest.path, line: openRequest.line, nonce: openRequest.sequence,
          endLine: Number.isInteger(openRequest.endLine) && openRequest.endLine >= openRequest.line ? openRequest.endLine : openRequest.line }
      : null);
    openFile({ path: openRequest.path }, { preview: true });
    onOpenRequestHandled?.(openRequest.sequence);
  }, [openRequest]); // eslint-disable-line react-hooks/exhaustive-deps
  const lineMark = preview && activeLine && activeLine.path === preview.path ? activeLine : null;
  useLayoutEffect(() => {
    const request = closeFocus.current;
    if (!request || tab !== "files") return;
    closeFocus.current = null;
    const tabs = [...(pane.current?.querySelectorAll('[role="tab"]') || [])];
    const visible = (node) => node && !node.disabled && node.getClientRects().length > 0 && !node.closest("[hidden], [inert], [data-overflowed]");
    const browserInput = [...(pane.current?.querySelectorAll(`.source-files-tree input[aria-label="${t("Filter files")}"]`) || [])].find(visible);
    const treeButton = [...(pane.current?.querySelectorAll(".source-files-tree button:not(:disabled)") || [])].find(visible);
    const target =
      tabs.find((node) => visible(node) && node.closest(".source-file-tab")?.dataset.filePath === request.path) ||
      tabs.find((node) => visible(node) && node.getAttribute("aria-selected") === "true") ||
      browserInput || treeButton ||
      pane.current?.querySelector(`button[aria-label="${t("Show file tree")}"]`);
    target?.focus({ preventScroll: true });
  }, [fileTabs, activePath, tab]);
  const treeCanFit = paneWidth >= 400;
  // Current e_: no selected file is a tree + empty preview when both fit.
  // The hidden-while-empty preference is separate from tree-beside-file.
  const treeVisible = preview
    ? treeShown && treeCanFit
    : !(treeHiddenWhileEmpty && fileTabs.length === 0);
  const treeIsColumn = treeVisible && treeCanFit;
  const treeLimit = Math.max(160, Math.min(640, paneWidth - 160));
  const visibleTreeWidth = Math.min(dragTreeWidth ?? treeWidth, treeLimit);
  useLayoutEffect(() => {
    if (!treeHandleFocus.current || tab !== "files") return;
    treeHandleFocus.current = false;
    const target = pane.current?.querySelector(
      treeIsColumn
        ? ".source-tree-divider"
        : !treeVisible && treeCanFit
          ? ".source-tree-edge"
          : ".source-pane-header > button[aria-pressed]",
    );
    target?.focus({ preventScroll: true });
  }, [treeVisible, treeIsColumn, treeCanFit, activePath, tab]);
  useEffect(() => {
    const element = pane.current;
    if (!element) return;
    setPaneWidth(element.clientWidth);
    const observer = new ResizeObserver(() =>
      setPaneWidth(element.clientWidth),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  function saveTreeWidth(value) {
    const width = Math.max(160, Math.min(treeLimit, Math.round(value)));
    setTreeWidth(width);
    try {
      localStorage.setItem("code-desktop-files-tree-width", String(width));
    } catch {
      /* optional preference */
    }
  }
  function setVisibleTree(shown) {
    if (shown === treeVisible) return;
    if (
      pane.current?.ownerDocument.activeElement?.matches(
        ".source-tree-divider, .source-tree-edge",
      )
    )
      treeHandleFocus.current = true;
    if (preview) {
      if (treeCanFit) setTreeShown(shown);
      else if (shown) selectFile(null);
    } else if (fileTabs.length > 0) {
      if (!shown) {
        const file =
          fileTabs.find((value) => value.path === treeReturnPath.current) ||
          fileTabs.at(-1);
        selectFile(file.path);
        if (treeCanFit) setTreeShown(false);
      }
    } else {
      setTreeHiddenWhileEmpty(!shown);
    }
  }
  // focusFilesTreeFilter (panes-state-current.js:3097-3113), behind the c_
  // "Search files" button (panes-tile-current.js:6791-6807): clear "tree hidden
  // while empty"; with a file open the tree is shown beside it when it fits,
  // otherwise the pane switches to the tree (vi: fileView undefined, return
  // path kept) - the same paths as "Show file tree". Local adaptation: there is
  // no transient filesTreePeek, so a fitting tree is shown persistently. The
  // effect below then focuses "Filter files" and selects its text. The
  // fileEditDirty branch has no counterpart (local previews are read-only).
  function focusFilesFilter() {
    filterFocus.current = true;
    if (treeHiddenWhileEmpty) setTreeHiddenWhileEmpty(false);
    if (!treeVisible) setVisibleTree(true);
    setFilterFocusTick((value) => value + 1);
  }
  useLayoutEffect(() => {
    if (!filterFocus.current || tab !== "files" || !treeVisible) return;
    const input = pane.current?.querySelector(`.source-files-tree input[aria-label="${t("Filter files")}"]`);
    if (!input || input.disabled || input.closest("[hidden], [inert]")) return;
    filterFocus.current = false;
    input.focus({ preventScroll: true });
    input.select();
  }, [filterFocusTick, treeVisible, tab, activePath]);
  function resizeTreeVisibility(shown) {
    const start = treeDragStart.current;
    // Hiding a tree-only view with open tabs activates its previous file. A
    // drag back across the threshold must restore the original tree-only view.
    if (shown && start.activePath === null && start.hadTabs)
      setActivePath(null);
    else setVisibleTree(shown);
  }
  function cancelTreeResize() {
    const start = treeDragStart.current;
    setActivePath(start.activePath);
    setTreeShown(start.treeShown);
    setTreeHiddenWhileEmpty(start.hiddenWhileEmpty);
    treeReturnPath.current = start.returnPath;
    setDragTreeWidth(null);
    treeHandleFocus.current = true;
  }
  function treeResizeSnapshot() {
    return {
      width: Math.min(treeWidth, treeLimit),
      activePath,
      hadTabs: fileTabs.length > 0,
      treeShown,
      hiddenWhileEmpty: treeHiddenWhileEmpty,
      returnPath: treeReturnPath.current,
    };
  }
  const treeResize = useSourcePointerResize({
    onStart: () => {
      treeDragStart.current = treeResizeSnapshot();
    },
    onMove: (delta) => {
      const value = treeDragStart.current.width + delta;
      setDragTreeWidth(Math.max(160, Math.min(treeLimit, value)));
      resizeTreeVisibility(value >= 80);
    },
    onEnd: (delta) => {
      const value = treeDragStart.current.width + delta;
      if (value >= 80 && delta !== 0) saveTreeWidth(value);
      resizeTreeVisibility(value >= 80);
      setDragTreeWidth(null);
    },
    onCancel: cancelTreeResize,
  });
  const edgeResize = useSourcePointerResize({
    onStart: () => {
      treeDragStart.current = treeResizeSnapshot();
    },
    onMove: (delta) => {
      resizeTreeVisibility(delta >= 80);
      setDragTreeWidth(Math.max(160, Math.min(treeLimit, delta)));
    },
    onEnd: (delta) => {
      const shown = Math.abs(delta) < 3 || delta >= 80;
      resizeTreeVisibility(shown);
      if (delta >= 80) saveTreeWidth(delta);
      setDragTreeWidth(null);
    },
    onCancel: cancelTreeResize,
  });
  function resizeTreeKey(event) {
    if (event.metaKey || event.altKey || event.ctrlKey) return;
    const step = event.shiftKey ? 120 : 24;
    let value;
    if (event.key === "ArrowLeft") value = visibleTreeWidth - step;
    else if (event.key === "ArrowRight") value = visibleTreeWidth + step;
    else if (event.key === "Home") value = 160;
    else if (event.key === "End") value = treeLimit;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setVisibleTree(false);
      return;
    } else return;
    event.preventDefault();
    saveTreeWidth(value);
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      reads.current.clear();
    };
  }, []);
  useEffect(() => {
    if (tab !== "files" || !cwd) {
      setTreeRefreshing(false);
      return;
    }
    let live = true;
    // Fresh data replaces retained keyed rows without losing open ancestors.
    setTreeError("");
    setTreeRefreshing(true);
    call("files", { cwd, relative: "", includeChild: includeRootChild })
      .then((data) => {
        if (live) setEntries(data);
      })
      .catch((e) => {
        if (live) setTreeError(errorMessage(e));
      })
      .finally(() => {
        if (live) setTreeRefreshing(false);
      });
    return () => {
      live = false;
    };
  }, [cwd, tab, refreshKey, includeRootChild, call]);
  // openFileTab (panes-state-current.js:2830-2845 -> F :1596-1616): the tab is
  // created or activated at once — a preview takes the preview slot in place —
  // and its body loads (Zo spinner) into the classified read result, so a
  // missing, outside, large, binary or unreadable file still gets its tab and
  // card. Re-opening an open tab refreshes it and keeps showing its text.
  function openFile(entry, { preview: previewTab = true } = {}) {
    const path = entry?.path;
    if (typeof path !== "string" || !path) return;
    setFileTabs((files) => {
      const existing = files.find((value) => value.path === path);
      const opened = existing
        ? { ...existing, preview: existing.preview === true && previewTab }
        : { path, preview: previewTab, openSequence: ++tabSequence.current };
      return insertFileTab(files, opened);
    });
    setActivePath(path);
    loadFile(path);
  }
  function closeFile(path) {
    closeFiles([path]);
  }
  // Batch setter for closeFile / "Close other files" / "Close all files"
  // (panes-state-current.js:2891-2951 closeFileTab/closeOtherFileTabs/
  // closeAllFileTabs): one state write, since the controlled view setter
  // cannot chain functional updates within one event.
  // keep: undefined for a single close, null for close-all, the kept path for close-others.
  function closeFiles(paths, keep) {
    const closing = new Set(paths);
    // An in-flight read of a closed tab must not resurrect it (loadFile only
    // updates open tabs), and its result is dropped.
    for (const path of closing) reads.current.delete(path);
    const index = fileTabs.findIndex((file) => closing.has(file.path) && file.path === activePath);
    const remaining = fileTabs.filter((file) => !closing.has(file.path));
    // closeOtherFileTabs makes the kept tab the file view.
    const nextPath = keep != null ? keep : (closing.has(activePath)
      ? (remaining[Math.min(index, remaining.length - 1)]?.path ?? null)
      : activePath);
    const rows = [
      ...(pane.current?.querySelectorAll(".source-file-tab") || []),
    ].filter((node) => closing.has(node.dataset.filePath));
    if (rows.some((row) => row.contains(row.ownerDocument.activeElement)))
      closeFocus.current = { path: nextPath };
    setFileTabs((files) => files.filter((file) => !closing.has(file.path)));
    if (nextPath !== activePath) setActivePath(nextPath);
  }
  function keepFile(path) {
    setFileTabs((files) =>
      files.map((file) =>
        file.path === path ? { ...file, preview: false } : file,
      ),
    );
  }
  function selectFile(path) {
    if (path === null && activePath) treeReturnPath.current = activePath;
    setActivePath(path);
  }
  function followSelectedFile(path) {
    setTreeReveal((previous) => ({ path, generation: previous.generation + 1 }));
    setRefreshKey((value) => value + 1);
  }
  // l_ "Reveal in file tree" (revealInFilesTree): show the tree and reveal the row.
  function revealInTree(relative) {
    if (!treeVisible) setVisibleTree(true);
    followSelectedFile(relative);
  }
  // Ge (c856385e2) copies through the clipboard and confirms with the
  // c3e58cab4 "Copied to clipboard." toast; the breadcrumb (Rs, cd2efac6e
  // :3384-3396) copies the relative path with "Path copied to clipboard.".
  function copyText(value, message = t("Copied to clipboard.")) {
    if (!value) return;
    Promise.resolve().then(() => navigator.clipboard.writeText(value))
      .then(() => toasts?.add(message, { variant: "neutral" }), (reason) => console.warn(reason));
  }
  // Tree rows (file_browser) and tabs (file_tab) share Mn's items; Attach and
  // Show in Finder only where main.jsx gave them a target.
  const fileMenu = tab === "files" && cwd ? {
    entries: (path, { surface = "file_browser", directory = false, unavailable, linkState } = {}) => fileContextMenu({
      surface, root: cwd, path,
      canAttach: !!fileActions?.onAttachFile && !directory,
      // The reveal IPC resolves inside the session folder only: no broken, external or looping link.
      canShowInFinder: !!fileActions?.onRevealFile && unavailable !== "missing" && unavailable !== "outside_root" && (!linkState || linkState === "ok"),
      canRevealInTree: unavailable !== "missing",
    }),
    select: (item, path) => {
      if (item.action === "copy") copyText(item.value);
      else if (item.action === "attach") { const absolute = fileCopyChoices(cwd, path).absolute; if (absolute) fileActions?.onAttachFile?.(absolute); }
      else if (item.action === "show-in-finder") fileActions?.onRevealFile?.(item.value);
      else if (item.action === "reveal-in-tree") revealInTree(item.value);
    },
  } : null;
  // ⌘⇧Y (uf toggleDiffFileList, panes-tile-current.js:6650-6655): main.jsx calls
  // the open Files pane's tree toggle, the same path as the ListBullet button.
  useLayoutEffect(() => {
    if (!treeToggleRef || tab !== "files" || !cwd) return undefined;
    const toggle = () => setVisibleTree(!treeVisible);
    treeToggleRef.current = toggle;
    return () => { if (treeToggleRef.current === toggle) treeToggleRef.current = null; };
  });
  // R10 ⌘⇧Y on the Changes pane (dh uf, panes-tile-current.js:3651-3660, enabled
  // only while uh): main.jsx routes 'file-list' here (pane-shortcuts fileListRoute).
  useLayoutEffect(() => {
    if (!treeToggleRef || tab !== "changes" || !diffListAvailable) return undefined;
    const toggle = toggleDiffTree;
    treeToggleRef.current = toggle;
    return () => { if (treeToggleRef.current === toggle) treeToggleRef.current = null; };
  }, [treeToggleRef, tab, diffListAvailable, toggleDiffTree]);
  const title = tab === "files" ? t("Files") : tab === "plan" ? t("Plan") : t("Changes");
  const displayTitle =
    tab === "changes" && diffScope === "uncommitted"
      ? t("Uncommitted changes")
      : title;
  // Pane-supplied "{pane} settings" sections (official f_ for the file pane:
  // a "Show file tree" checkbox that keeps the menu open). The official
  // "Preview tabs" preference has no local counterpart and is not offered.
  const menuSections =
    tab === "files" && cwd
      ? [{ key: "files-tree", items: [{ value: "files-tree", label: t("Show file tree"), checked: treeVisible, checkedRole: "checkbox", keepOpen: true,
          // f_ (panes-tile-current.js:6872-6900): the item carries the ⌘⇧Y shortcut.
          shortcut: treeToggleRef ? TREE_TOGGLE_SHORTCUT : undefined, onSelect: () => setVisibleTree(!treeVisible) }] }]
      : tab === 'changes' ? changesMenuSections({ hasPatch: !diffError && !loading && !!diffView.patch,
        layoutSplit: diffPreferences.layout === 'split', canFitSplit: diffCanFitSplit, wordWrap: diffPreferences.wordWrap,
        onFoldAll: (collapsed) => setDiffFoldAll((previous) => ({ collapsed, seq: (previous?.seq ?? 0) + 1 })),
        onLayoutChange: (layout) => setDiffPreference('layout', layout), onWordWrapChange: (value) => setDiffPreference('wordWrap', value),
        wordDiff: diffPreferences.wordDiff, hideWhitespace: diffPreferences.hideWhitespace,
        onWordDiffChange: (value) => setDiffPreference('wordDiff', value), onHideWhitespaceChange: (value) => setDiffPreference('hideWhitespace', value),
        // R10 fh :3740-3779 diff-file-list group and :3791-3804 diffIsLarge.
        isLarge: diffIsLarge, fileList: { canFit: diffListAvailable, shown: diffShowTree, tree: diffFileTree, groupByKind: diffGroupByKind,
          shortcut: treeToggleRef ? TREE_TOGGLE_SHORTCUT : undefined, onToggle: toggleDiffTree, onTreeChange: setDiffFileTree, onGroupByKindChange: setDiffGroupByKind },
        onRefresh: () => onRefresh?.() }) : [];
  return (
    <aside
      ref={pane}
      className="source-file-panel detail-panel"
      data-pane-kind={
        tab === "changes" ? "diff" : tab === "files" ? "file" : tab
      }
      data-tree-resizing={
        treeResize.dragging || edgeResize.dragging || undefined
      }
      aria-label={t("{title} panel", { title })}
      aria-busy={
        (tab === "changes" && loading) ||
        (tab === "files" &&
          ((!!activeTab && typeof activeTab.text !== "string" && !activeTab.unavailable) || treeRefreshing || (!!cwd && entries === null && !treeError))) ||
        undefined
      }
      onKeyDown={(event) => {
        // A menu popup portaled from the header still bubbles through React;
        // its Escape closes the menu, not the pane.
        if (event.key === "Escape" && !event.defaultPrevented && !event.target.closest?.('[role="menu"]') && !event.currentTarget.ownerDocument.querySelector('[role="menu"]')) {
          event.stopPropagation();
          onClose?.();
        }
      }}
    >
      <header className="source-pane-header" data-pane-header={tab}>
        {tab === "files" && cwd && (
          // Ut around the ListBullet (panes-tile-current.js:6716-6741): CDS
          // tooltip "Show/Hide file tree" with the ⌘⇧Y keycap (uu("files")),
          // side top / align start, not hoverable; no native title.
          <SourceTooltip content={treeVisible ? t("Hide file tree") : t("Show file tree")} shortcut={treeToggleRef ? TREE_TOGGLE_SHORTCUT : undefined}
            side="top" align="start" hoverable={false}>
            <SourceIconButton
              name="ListBullet"
              label={treeVisible ? t("Hide file tree") : t("Show file tree")}
              nativeTitle={false}
              aria-pressed={treeVisible}
              aria-keyshortcuts={treeToggleRef ? "Meta+Shift+Y" : undefined}
              onClick={() => setVisibleTree(!treeVisible)}
            />
          </SourceTooltip>
        )}
        {tab === "files" && fileTabs.length > 0 ? (
          // Xd tab list (panes-tabs-current.js:1128-1195): the data-view-tab-bar
          // root holds the tablist (a 700ms tooltip provider ne around the
          // tabs, then the end spacer shown while overflowing), the sr-only
          // delete and move hints every tab is described by, and the
          // [data-vtb-overflow] "More files" menu while tabs are hidden.
          <div ref={tabBar} className="source-file-tabbar" data-view-tab-bar="">
          <div
            ref={tabList}
            className="source-file-tabs"
            role="tablist"
            aria-label={t("Open files")}
          >
            <SourceTooltipGroup delay={700}>
              {fileTabs.map((file, index) => (
                <SourceFileTab
                  key={file.path}
                  file={file}
                  cwd={cwd}
                  selected={activePath === file.path}
                  tabIndex={
                    activePath === file.path ||
                    (!activePath && fileTabs[0].path === file.path)
                      ? 0
                      : -1
                  }
                  solo={fileTabs.length === 1}
                  posinset={index + 1}
                  setsize={fileTabs.length}
                  hintId={closeHintId}
                  moveHintId={moveHintId}
                  overflowed={strip.hiddenIds.includes(file.path)}
                  compact={activePath !== file.path && strip.compactIds.includes(file.path)}
                  fileMenu={fileMenu}
                  onSelect={selectFile}
                  onClose={closeFile}
                  onKeep={keepFile}
                  onCloseOthers={(path) => closeFiles(fileTabs.filter((value) => value.path !== path).map((value) => value.path), path)}
                  onCloseAll={() => closeFiles(fileTabs.map((value) => value.path), null)}
                  onKeyDown={(event, path) => {
                    // ge (:275-302): Control (or Meta) + Shift + ArrowLeft/Right
                    // moves the tab one slot (onReorder, panes-tile-current.js:6779).
                    if (event.shiftKey && (event.ctrlKey || event.metaKey) && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
                      event.preventDefault();
                      reorderFocus.current = path;
                      setFileTabs((files) => moveFileTab(files, path, event.key === "ArrowLeft" ? -1 : 1, strip.hiddenIds));
                      return;
                    }
                    // ge (:275-302): Delete/Backspace close the closable tab.
                    if (event.key === "Delete" || event.key === "Backspace") {
                      event.preventDefault();
                      closeFile(path);
                      return;
                    }
                    // Roving focus skips the tabs hidden behind "More files"
                    // (they are disabled Base UI tabs, he :393-397).
                    const reachable = fileTabs.filter((tab) => tab.path === path || !strip.hiddenIds.includes(tab.path));
                    const index = reachable.findIndex(
                      (tab) => tab.path === path,
                    );
                    const next =
                      event.key === "ArrowRight"
                        ? (index + 1) % reachable.length
                        : event.key === "ArrowLeft"
                          ? (index - 1 + reachable.length) % reachable.length
                          : event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? reachable.length - 1
                              : null;
                    if (next !== null) {
                      event.preventDefault();
                      const target = reachable[next].path;
                      selectFile(target);
                      [...event.currentTarget.closest('[role="tablist"]').querySelectorAll("[data-vtb-id]")]
                        .find((node) => node.dataset.vtbId === target)?.querySelector('[role="tab"]')?.focus();
                    }
                  }}
                />
              ))}
            </SourceTooltipGroup>
            <span aria-hidden="true" className="source-file-tabs-spacer" hidden={!strip.overflowing} />
          </div>
          <span id={closeHintId} className="source-sr-only">
            {FILE_TAB_LABELS.closeTabDeleteHint}
          </span>
          <span id={moveHintId} className="source-sr-only">
            {FILE_TAB_LABELS.moveTabHint}
          </span>
          {hiddenTabs.length > 0 && (
            <span data-vtb-overflow="" className="source-file-tabs-overflow">
              <SourceFileTabOverflow tabs={hiddenTabs} cwd={cwd} onActivate={selectFile} onClose={closeFile} />
            </span>
          )}
          </div>
        ) : tab === "changes" && (diffScopeControl || diffListAvailable) ? (
          // dh (panes-tile-current.js:3640-3690): while uh, the ghost iconOnly
          // ListBullet "Show files"/"Hide files" (-ml-[4px], pressed while shown;
          // Ut side top / align start with the ⇧⌘Y keycap) comes before the F12 zm
          // scope trigger (:2949-3110). The lu coachmark is not ported.
          <>
            {diffListAvailable && (
              <SourceTooltip content={diffShowTree ? t("Hide files") : t("Show files")} shortcut={treeToggleRef ? TREE_TOGGLE_SHORTCUT : undefined}
                side="top" align="start" hoverable={false}>
                <SourceIconButton
                  name="ListBullet"
                  className="source-icon-button -ml-[4px]"
                  data-diff-file-list-toggle=""
                  label={diffShowTree ? t("Hide files") : t("Show files")}
                  nativeTitle={false}
                  aria-pressed={diffShowTree}
                  aria-keyshortcuts={treeToggleRef ? "Meta+Shift+Y" : undefined}
                  onClick={toggleDiffTree}
                />
              </SourceTooltip>
            )}
            {diffScopeControl || <span className="source-pane-title">{displayTitle}</span>}
          </>
        ) : (
          // Mt/Tl (shared-12 vm "text-body text-secondary select-none truncate
          // pl-[4px]", panes-toggle-current.js:1428-1431): regular weight, no
          // native title; pl-0 right after the Files ListBullet (:6776).
          <span className="source-pane-title" data-after-toggle={(tab === "files" && cwd) ? "" : undefined}>{displayTitle}</span>
        )}
        {/* ka (panes-toggle-current.js:1614-1632) renders the tile's center drag
            handle o after the header/title content ([H, t, o], then trailing pe),
            so the absolute 44x16 handle paints above the position:relative tab
            strip (.source-file-tabs) it overlaps in a narrow tile. */}
        {headerCenter}
        {/* Trailing slot (panes-tile-current.js:16366-16378): for the file pane
            c_ "Search files" comes before the yh settings menu, then Expand and
            Close; c_ needs a local workdir (jl(session)). */}
        {(() => {
          // Mp (:1830-1866) leads the Plan trailing slot: "Copy plan" while a plan document exists.
          const search = tab === "files" && cwd ? <SourceFilesSearchButton onClick={focusFilesFilter} />
            : tab === "plan" && planDocument ? <SourcePlanCopyButton document={planDocument} /> : null;
          const close = <SourceIconButton name="X" label={t("Close panel")} onClick={onClose} />;
          return typeof paneControls === "function"
            ? paneControls({ menuSections, leading: search }) ?? <>{search}{close}</>
            : <>{search}{paneControls ?? close}</>;
        })()}
      </header>
      {tab === "files" ? (
        <>
          <div
            className="source-file-body"
            data-has-preview={!!preview}
            data-tree-visible={treeVisible}
            data-tree-column={treeIsColumn}
          >
            <div
              className="source-files-tree"
              hidden={!treeVisible}
              style={
                treeIsColumn
                  ? {
                      width: visibleTreeWidth,
                      minWidth: "min(160px, 100% - 160px)",
                      maxWidth: "min(640px, 100% - 160px)",
                    }
                  : undefined
              }
            >
              {treeRefreshing && entries !== null && <span className="source-sr-only" role="status">{t("Refreshing files")}</span>}
              <SourceFilesSearch
                sessionId={sessionId}
                searchPane={searchPane}
                cwd={cwd}
                activePath={activePath}
                onOpen={openFile}
                onClear={followSelectedFile}
                enabled={tab === "files" && treeVisible}
                refreshKey={refreshKey}
                call={call}
              >
              {({ filtered }) => !cwd ? (
                // Jg (panes-tile-current.js:4780-4786): no working directory.
                <SourceFilesTreeState state="no-cwd" />
              ) : entries === null ? (
                // Ig (panes-tile-current.js:5496-5512): Yg spinner while loading,
                // fixed copy when the read failed with no data (the raw error is
                // not rendered), "Folder is empty" when there are no rows.
                <SourceFilesTreeState state={treeError ? "error" : "loading"} />
              ) : !entries.length ? (
                <SourceFilesTreeState state="empty" />
              ) : (
                <SourceTree busy={treeRefreshing} filterInputSelector={`input[aria-label="${t("Filter files")}"]`}>
                  {entries.map((entry) => (
                    <SourceTreeNode
                      key={entry.path}
                      entry={entry}
                      cwd={cwd}
                      activePath={activePath}
                      onOpen={openFile}
                      refreshKey={refreshKey}
                      call={call}
                      revealPath={treeReveal.path}
                      revealGeneration={treeReveal.generation}
                      treeVisible={treeVisible && !filtered}
                      expandedPaths={expandedPaths}
                      onExpandedChange={onExpandedChange}
                      fileMenu={fileMenu}
                    />
                  ))}
                </SourceTree>
              )}
              </SourceFilesSearch>
              {treeIsColumn && (
                <div
                  className="source-tree-divider"
                  role="separator"
                  tabIndex={0}
                  aria-label={t("Resize file tree")}
                  aria-orientation="vertical"
                  aria-valuemin={160}
                  aria-valuemax={treeLimit}
                  aria-valuenow={Math.round(visibleTreeWidth)}
                  onPointerDown={treeResize.onPointerDown}
                  onDoubleClick={() => saveTreeWidth(240)}
                  onKeyDown={resizeTreeKey}
                >
                  <span />
                </div>
              )}
            </div>
            {treeCanFit && !treeVisible && (
              <div
                className="source-tree-edge"
                role="separator"
                tabIndex={0}
                aria-label={t("Show file tree")}
                aria-orientation="vertical"
                aria-valuemin={0}
                aria-valuemax={640}
                aria-valuenow={0}
                onPointerDown={edgeResize.onPointerDown}
                onKeyDown={(event) => {
                  if (["Enter", " ", "ArrowRight"].includes(event.key)) {
                    event.preventDefault();
                    setVisibleTree(true);
                  }
                }}
              >
                <span />
              </div>
            )}
            {preview && (() => {
              // Fu (panes-tile-current.js:6328-6352): the file viewer for the
              // file view, with the jump range of a chip request for this path.
              const relative = tabRelativePath(preview.path, cwd);
              const full = cwd && !/^(?:\/|[A-Za-z]:[\\/]|~)/.test(relative) ? `${String(cwd).replace(/\/+$/, "")}/${relative}` : preview.path;
              return <SourceFileViewer key={preview.path} file={preview} displayPath={relative} fullPath={full}
                line={lineMark?.line} endLine={lineMark?.endLine} scrollNonce={lineMark?.nonce}
                scopeKey={JSON.stringify(["file-viewer", sessionId, cwd, preview.path])}
                onCopyPath={() => copyText(relative, FILE_VIEWER_LABELS.pathCopied)}
                onViewAsText={() => loadFile(preview.path, { force: true })}
                renderMarkdown={(text, chunk = 0) => <SourceMarkdown text={text} sessionKey={sessionId} itemId={chunk ? `file:${preview.path}#${chunk}` : `file:${preview.path}`} cwd={cwd} />} />;
            })()}
            {/* panes-tile-current.js:6355-6390 (!N || M) empty preview. */}
            {!preview && (!treeVisible || treeCanFit) && (
              <SourceFilesEmptyPreview tabs={fileTabs.length} treeShown={treeVisible} />
            )}
          </div>
        </>
      ) : tab === "plan" && (plan?.length || planDocument) ? (
        // kp (panes-tile-current.js:1751-1790): the plan document, then the Tasks.
        <SourcePlanPane plan={plan} document={planDocument}
          renderMarkdown={(text) => <SourceMarkdown text={text} sessionKey={sessionId} itemId="plan-document" cwd={cwd} />} />
      ) : tab === "plan" ? (
        <SourcePlanEmpty />
      ) : diffError ? (
        <SourceChangesState state="failed" />
      ) : loading ? (
        <SourceChangesState state="loading" />
      ) : diffView.patch ? (
        // R10: SourceDiff lays the body out beside the Changed files column and
        // owns the .source-changes scroller (ChangesFileLayout).
        <Diff value={diffView.patch} completeContext={diffView.completeContext} scopeKey={JSON.stringify([sessionId, cwd, diffScope])} layout={diffPreferences.layout} wordWrap={diffPreferences.wordWrap} wordDiff={diffPreferences.wordDiff} hideWhitespace={diffPreferences.hideWhitespace} onCanFitSplitChange={setDiffCanFitSplit} foldAll={diffFoldAll} placement="changes" fileActions={diffFileActions}
          onIsLargeChange={setDiffIsLarge} fileList={{ shown: diffShowTree, width: diffTreeWidth, tree: diffFileTree, groupByKind: diffGroupByKind,
            onShownChange: setDiffShowTree, onWidthChange: setDiffTreeWidth, onCanFitChange: setDiffCanFitTree }} />
      ) : (
        <SourceChangesState state="empty" uncommittedOnly={diffScope === "uncommitted"} />
      )}
    </aside>
  );
}
