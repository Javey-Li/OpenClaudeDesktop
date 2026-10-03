import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";
import { SourcePet } from "./source-pet";
import { SourceTooltip } from "./source-tooltip";
import { SourceMenu, menuTriggerProps, useMenuPopup } from "./source-menu";
import { SourceComposerEditor } from "./source-composer-editor";
import { SourceSlashMenu, SlashHint } from "./source-slash-menu";
import { matchCommands, parseSessionCommand, slashQuery, sessionCommands, slashSkills, slashCustomCommands } from "./session-command-model.mjs";
import { SourceComposerAttachments } from "./source-composer-attachments";
import { SourceMentionDropdown } from "./source-mention-dropdown";
import { mentionToken, insertMention, mentionOptions, nextHighlight, MENTION_SEARCH_DELAY, MENTION_RESULT_LIMIT } from "./mention-model.mjs";
import { enterAction, escapeAction, isComposingEvent, submitPriority, windowEscapeAction, escapeExemptTarget, emptyArrowUpDequeues } from "./composer-keys-model.mjs";
import { composerPlaceholder } from "./composer-placeholder.mjs";
import { MODE_MENU_KEYS } from "./chin-shortcuts.mjs";
import { shortcutCaps } from "./source-shortcut";
import { INITIAL_PROMPT_HISTORY, promptHistoryStep, promptHistoryStatus } from "./prompt-history-model.mjs";
import "./source-shortcut.css";
import { usageTriggerCopy, usagePanelCopy, contextRingGeometry, contextRingStroke, CONTEXT_RING_TRACK, compactAction } from "./context-usage-model.mjs";
import { effortName } from "./model-menu-model.mjs";
import { modelAcceptsImages } from "./composer-attachments-model.mjs";
import { BRANCH_EMPTY_MESSAGE, BRANCH_SEARCH_PLACEHOLDER, BRANCH_TOOLTIP, branchTriggerLabel, enterSelection, filterBranches } from "./branch-picker-model.mjs";
import { SourcePopover, SourcePopoverClose, SourcePopoverTitle } from "./source-popover";
import "./source-composer.css";
import { permissionLabel } from "./source-permission-menu.jsx";

// lH (cc43287c9-BMbiZYzF.js:21699): the folder chip reads the basename, or 'Select folder…' with none chosen.
const basename = (path) => path?.split("/").filter(Boolean).pop() || "Select folder\u2026";
// dH (cc43287c9 :20979-20985, :22047-22050, :22076-22081): the env pill, worktree label and Add folder
// tooltips are hoverable:false with collisionPadding {top:48, right:8, bottom:8, left:8}.
const ENV_TOOLTIP = { hoverable: false, collisionPadding: { top: 48, right: 8, bottom: 8, left: 8 } };
export const WORKTREE_TOOLTIP = "Work in an isolated copy of the repository";

// c360a9e1c-GPs-MV9u.js:4544-4575 Ud: Zt{content: tooltip ?? header, shortcut: triggerKey, open: !o && undefined}
// with triggerKey = ve("openModeMenu") (:4924-4945 → chin-shortcuts.mjs "cmd+shift+m"), the raw key spec that the
// tooltip's Mu/Qa text variant renders through po in io modifier order: ⇧⌘M (SourceTooltip draws one <kbd> per key
// with a 0.3em gap). A dangerous (bypass) mode's tooltip
// is "Claude can modify or delete files without asking"; the agent here is Codex, so the copy names Codex (an
// honest adaptation of the same string). No chipLevel description exists locally, so other modes fall back to
// the header 'Mode'. Closed while a chin menu is open (local menuKind, like Add/usage).
// The visible caps (⇧⌘M) of that spec.
export const MODE_MENU_SHORTCUT = shortcutCaps(MODE_MENU_KEYS, true).map(cap => cap.label).join("");
export const modeTooltip = ({ permission, menuKind }) => ({
  content: permission === "bypass" ? "DeepSeek can modify or delete files without asking" : "Mode",
  shortcut: MODE_MENU_KEYS, open: menuKind ? false : undefined,
});

// tooltip: an object wraps the button in a CDS SourceTooltip (no native title); tooltip={false} means no
// wrapper AND no native title (a control the source leaves without any tooltip, e.g. the Model pill,
// shared-14 :7160-7226); omitted keeps the native title={label} fallback.
function ComposerButton({ icon, iconSize = 16, label, children, className = "", tooltip, ...props }) {
  const { title, ...nativeProps } = props;
  const button = (
    <button type="button" className={`sc-button ${icon && !children ? "sc-icon-button" : ""} ${className}`}
      aria-label={label} title={tooltip !== undefined ? undefined : title ?? label} data-cds="Button" {...nativeProps}>
      {typeof icon === "string" ? <Icon name={icon} size={iconSize} /> : icon}
      {children}
    </button>
  );
  return tooltip ? <SourceTooltip {...tooltip}>{button}</SourceTooltip> : button;
}

// c099c328d-CbkcmYSW.js sm({showStop,stop,send}) (2.2553.1; readable batch2 :8349-8383): active key
// swapped during render ([i,a]=w(r), [o,s]=w(null), [c,l]=w(!1); i!==r → a(r),s(i),l(!0)). The active
// layer is im (+ am cds-fade-in only after a swap, never on first mount); the previous one stays mounted
// inert/aria-hidden with om until its own visibility transition ends; any other key renders nothing.
export function SubmitCrossfade({ showStop, stop, send }) {
  const key = showStop ? "stop" : "send";
  const [active, setActive] = useState(key), [prev, setPrev] = useState(null), [animate, setAnimate] = useState(false);
  if (active !== key) { setActive(key); setPrev(active); setAnimate(true); }
  const drop = (event) => { if (event.target === event.currentTarget && event.propertyName === "visibility") setPrev(null); };
  const layer = (name, child) => name === key
    ? <div key={name} className="sc-submit-layer" data-entering={animate ? "" : undefined}>{child}</div>
    : name === prev
      ? <div key={name} className="sc-submit-layer" data-leaving="" inert aria-hidden="true" onTransitionEnd={drop}>{child}</div>
      : null;
  return <div className="sc-submit-cell">{layer("stop", stop)}{layer("send", send)}</div>;
}

// shared-14-BOJVa-jT.js:9760-9787 xT: 12px svg, -rotate-90, aria-hidden; track
// circle stroke=trackStroke, value circle dasharray C / dashoffset C·(1−pct/100),
// round cap, stroke vT(pct), transition-[stroke-dashoffset] duration-300.
export function ContextRing({ pct = 0, trackStroke = CONTEXT_RING_TRACK }) {
  const ring = contextRingGeometry(pct);
  return (
    <svg className="sc-context-ring" width={ring.size} height={ring.size} viewBox={`0 0 ${ring.size} ${ring.size}`} aria-hidden="true">
      <circle cx={ring.center} cy={ring.center} r={ring.radius} fill="none" strokeWidth={ring.stroke} stroke={trackStroke} />
      <circle className="sc-context-ring-value" cx={ring.center} cy={ring.center} r={ring.radius} fill="none" strokeWidth={ring.stroke}
        strokeDasharray={ring.circumference} strokeDashoffset={ring.offset} strokeLinecap="round" stroke={contextRingStroke(pct)} />
    </svg>
  );
}

// Caret position of a textarea in viewport pixels via a mirror element that
// copies the textarea's typography, padding and wrapping. The mirror is a
// measurement scratch node and is removed synchronously.
const MIRROR_PROPERTIES = ["fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "lineHeight", "textTransform", "wordSpacing", "textIndent",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "boxSizing", "tabSize"];
export function caretViewportRect(textarea, position) {
  if(textarea.getCaretViewportRect)return textarea.getCaretViewportRect(position);
  const document = textarea.ownerDocument;
  const mirror = document.createElement("div");
  const style = getComputedStyle(textarea);
  for (const property of MIRROR_PROPERTIES) mirror.style[property] = style[property];
  Object.assign(mirror.style, { position: "fixed", top: "0", left: "0", visibility: "hidden", pointerEvents: "none", whiteSpace: "pre-wrap", overflowWrap: "break-word", wordBreak: "normal", overflow: "hidden", width: `${textarea.getBoundingClientRect().width}px` });
  mirror.textContent = textarea.value.slice(0, position);
  const marker = document.createElement("span");
  marker.textContent = textarea.value.slice(position) || ".";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const box = textarea.getBoundingClientRect();
  const markerBox = marker.getBoundingClientRect();
  const mirrorBox = mirror.getBoundingClientRect();
  const left = box.left + (markerBox.left - mirrorBox.left) - textarea.scrollLeft;
  const top = box.top + (markerBox.top - mirrorBox.top) - textarea.scrollTop;
  const lineHeight = parseFloat(style.lineHeight) || markerBox.height || 20;
  mirror.remove();
  return { left, top, bottom: top + lineHeight, height: lineHeight };
}

// code-composer-input -> CDS ChatComposer card + code-footer's chin branch.
// Backend-only actions stay at the boundary supplied by the existing App.
// State families (2.2553.1 c099c328d / shared-11 / cf74bc599):
//  - attachments: CDS Attachments slot above the editor row (pills, paste/drop);
//  - "@" mentions: caret token lookup through the trusted files:search lane;
//  - queue/steer: Enter = steer, Cmd+Enter = queue while a turn runs;
//  - IME/keyboard: Escape swallowed while composing, Escape stops a busy turn
//    once (from the editor or, through the window listener, from anywhere),
//    idle Escape blurs the editor, key-repeat guard, Cmd+Enter ignored while
//    composing, ↑ in an empty editor takes back the newest queued message;
//  - editable vs submittable (cc43287c9-BMbiZYzF.js:27612 Jr, :28636-28638): the editor is disabled
//    (data-disabled on the card) only for archived sessions and real locks (`editable`); loading and a
//    lost connection keep it typeable and only gate sending (`canSubmit`); data-busy while a turn runs.
export function SourceComposer({
  fastMode = false, fastAvailable = false,
  draft, setDraft, textarea, attachments = [], onRemoveAttachment, onOpenAttachmentFile, onStageFiles, onSubmit,
  running, sending, stopping = false, editable = true, canSubmit = true, escapeClaimed = false, onEmptyArrowUp,
  mentions = [], mentionActions, onStop, onReconnect, warning, workdir, workspaceInfo, onMenu,
  model, effort = "", permission, permissionOpen = false, modelOpen = false, modelsLoading = false, menuKind, worktree, setWorktree, usage, usageFresh = false, mode, onFolder,
  folderMenu = true,
  showPet = false, showContext = showPet, onAddFolder, additionalFolders = [], onRemoveFolder, beforeComposer,
  commandContext, onCommand, commandScope, searchFiles, onMention, queueEnabled = false, placeholder,
  getHumanPrompts, historyResetKey,
  // cc43287c9 :28620 stayOnDraftHint = cn === 'draft' && !Yn: the Home draft offers 'Send and stay here' (⌘⏎).
  stayOnDraft = false,
}) {
  const editor = useRef(null);
  const worktreeLabelId = useId(), worktreeDescriptionId = useId();
  const commandId = useId();
  const [commandIndex, setCommandIndex] = useState(0), [dismissed, setDismissed] = useState(false);
  const [commandFocus,setCommandFocus]=useState(false),[commandCaret,setCommandCaret]=useState(null),[hintCaret,setHintCaret]=useState(null);
  // Prompt-history recall (c099c328d :10677-10697 Zi/Vj with caretAfterRecall "end"); the model
  // state lives in a ref, the strip state (Vj navState) in React state. historyNav = nav !== null
  // (:10733 wi) disables the slash and mention suggestions like wh (:9712-9719).
  const history = useRef(INITIAL_PROMPT_HISTORY), [historyNav, setHistoryNav] = useState(null);
  const historyNavRef = useRef(null);
  historyNavRef.current = historyNav;
  // nf(resetKey,{onMount:"skip"}) + effect: a new session/draft key clears the strip and index.
  useLayoutEffect(() => { history.current = { ...INITIAL_PROMPT_HISTORY, resetKey: historyResetKey }; setHistoryNav(null); }, [historyResetKey]);
  // Vj dismissNavState (f(null)): Pi submit :10770 and insertSlashCommand :10937 hide the strip only.
  const dismissHistoryNav = useCallback(() => { history.current = { ...history.current, nav: null }; setHistoryNav(null); }, []);
  const query=slashQuery(draft), suggestions=commandContext&&query!==null?matchCommands(query,commandContext):[];
  const showCommands=!!onCommand&&commandFocus&&query!==null&&!dismissed&&suggestions.length>0&&!historyNav;
  const selected=Math.min(commandIndex,Math.max(0,suggestions.length-1));
  useEffect(()=>{setCommandIndex(0);if(!draft.startsWith('/'))setDismissed(false);},[draft]);
  useEffect(()=>{setDismissed(false);setCommandIndex(0);},[commandScope]);
  useLayoutEffect(()=>{
    if(!showCommands)return;
    const update=()=>{const node=editor.current;if(!node)return;setCommandCaret(caretViewportRect(node,0));setHintCaret(caretViewportRect(node,node.selectionStart));};
    update();window.addEventListener('resize',update);window.addEventListener('scroll',update,true);
    return()=>{window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);};
  },[draft,commandFocus,showCommands]);
  useEffect(()=>{const node=editor.current;const open=()=>{dismissHistoryNav();setDismissed(false);};node?.addEventListener('open-slash',open);return()=>node?.removeEventListener('open-slash',open);},[]);
  // A chosen skill row inserts the chip marked kind 'skill' (command.kind from matchCommands).
  const chooseCommand=id=>{setDismissed(true);const command=suggestions.find(value=>value.id===id);if(command)editor.current?.insertCommand(command);};
  // c099c328d-CbkcmYSW.js:10637-10673 li/di: the names a draft restored from text turns back into chips.
  const commandSkills=commandContext?.skills,commandCustom=commandContext?.customCommands;
  const chipCatalog=useMemo(()=>[...sessionCommands.map(entry=>({id:entry.id,description:entry.description,argumentHint:entry.argumentHint||'',kind:'command'})),
    ...slashCustomCommands(commandCustom).map(command=>({id:command.name,description:command.description,argumentHint:command.argumentHint,kind:'custom'})),
    ...slashSkills(commandSkills,commandCustom).map(skill=>({id:skill.name,description:skill.description,argumentHint:skill.argumentHint,kind:'skill'}))],[commandSkills,commandCustom]);
  const assignEditor = useCallback((element) => {
    editor.current = element;
    if (typeof textarea === "function") textarea(element);
    else if (textarea) textarea.current = element;
  }, [textarea]);
  useLayoutEffect(() => {
    const element = editor.current;
    if (!element) return;
    const measure = () => {
      element.style.height = "auto";
      element.style.height = `${Math.max(24, Math.min(element.scrollHeight, 190))}px`;
    };
    measure();
    let width = element.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const next = element.getBoundingClientRect().width;
      if (next === width) return;
      width = next;
      measure();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [draft, showContext]);

  // "@" mention lookup: the caret token drives a debounced files:search
  // (120ms, 50 results) on the composer lane; stale responses are dropped.
  const [mention, setMention] = useState(null); // {token, options, highlighted, caret, dismissedAt}
  const mentionSeq = useRef(0), mentionRef = useRef(null);
  mentionRef.current = mention;
  // The lookup callback lives in a ref: parents pass a fresh function on every
  // render (streaming deltas re-render App), and the debounce must only restart
  // when the token itself changes, never because the callback identity did.
  const searchFilesRef = useRef(searchFiles);
  searchFilesRef.current = searchFiles;
  const mentionEnabled = !!searchFiles;
  const [mentionDismissed, setMentionDismissed] = useState(null);
  const updateMention = useCallback(() => {
    const element = editor.current;
    if (!element || !searchFilesRef.current || historyNavRef.current || element.selectionStart !== element.selectionEnd) { setMention(null); return; }
    const token = mentionToken(element.value, element.selectionStart);
    if (!token || mentionDismissed === `${token.start}:${element.value.slice(token.start, token.end)}`) { setMention(null); return; }
    const caret = caretViewportRect(element, token.start);
    setMention((current) => ({ token, caret, options: current?.token?.start === token.start ? current.options : [], highlighted: current?.token?.start === token.start ? current.highlighted : 0, query: token.query }));
  }, [mentionDismissed]);
  useEffect(() => {
    if (!mention || !mentionEnabled) return undefined;
    const sequence = ++mentionSeq.current;
    const timer = setTimeout(async () => {
      let matches = [];
      try { matches = await searchFilesRef.current?.(mention.query); } catch { matches = []; }
      if (!Array.isArray(matches)) matches = [];
      if (sequence !== mentionSeq.current) return;
      const options = mentionOptions(matches, { limit: MENTION_RESULT_LIMIT });
      setMention((current) => (current && current.token.start === mention.token.start && current.query === mention.query
        ? { ...current, options, highlighted: Math.min(current.highlighted, Math.max(0, options.length - 1)) } : current));
    }, MENTION_SEARCH_DELAY);
    return () => clearTimeout(timer);
  }, [mention?.query, mention?.token?.start, mentionEnabled]);
  useEffect(() => { setMention(null); setMentionDismissed(null); }, [commandScope]);
  // c099c328d-CbkcmYSW.js:10502-10520 Vr: the pick replaces the token with the atomic mention node plus a
  // space (source-composer-editor.jsx insertMention); a plain textarea falls back to the '@path ' text.
  const acceptMention = (option) => {
    const element = editor.current, current = mentionRef.current;
    if (!element || !current || !option) return;
    const token = mentionToken(element.value, element.selectionStart) || current.token;
    onMention?.(option);
    setMention(null);
    if (element.insertMention) { element.insertMention(token, option); return; }
    const result = insertMention(element.value, token, option.path);
    setDraft(result.text);
    requestAnimationFrame(() => { const node = editor.current; if (node) { node.focus(); node.setSelectionRange(result.caret, result.caret); } });
  };
  const closeMention = useCallback(() => {
    const current = mentionRef.current, element = editor.current;
    if (current && element) setMentionDismissed(`${current.token.start}:${element.value.slice(current.token.start, current.token.end)}`);
    setMention(null);
  }, []);
  const mentionOpen = !!mention && mention.options.length > 0;

  // A known skill parses without error and is sent as a message (session-command-model.mjs).
  const command = parseSessionCommand(draft, commandContext);
  const hostCommand = !!command && !command.skill && !command.custom;
  const disabled = !editable;
  const hasContent = !!draft.trim() || attachments.length > 0;
  const attachmentsReady = attachments.every((entry) => entry.status === "ready");
  const canSend = hasContent && (hostCommand ? !!draft.trim() : !sending && editable && canSubmit && attachmentsReady && (!running || queueEnabled));
  // Official showStop = busy && !interrupting (main composer), then Ki: while
  // busy the Stop control yields to Send once the editor has content and the
  // queue-vs-steer lanes are available. Once a stop is requested the crossfade
  // shows the (disabled) Send glyph, not Stop; Escape is no longer offered.
  const stopAvailable = running && !stopping;
  const showStop = stopAvailable && !(hasContent && queueEnabled);
  const escapeStopLatch = useRef(false);
  useEffect(() => { if (!running) escapeStopLatch.current = false; }, [running]);
  // c099c328d-CbkcmYSW.js:10129-10150: a window keydown listener stops a busy turn on an Escape nobody
  // claimed — focus in the transcript, a pane or the page — through the same latch as the editor branch.
  // A local menu, dialog or Settings claims Escape (menuKind / escapeClaimed); defaultPrevented events,
  // IME composition and canvas / [role=application] targets (shared-6 JL) are left alone, and so is a
  // composer under an inert root. Registered as a layout effect like the chin listener (main.jsx), over a
  // ref read at event time, so the handler never acts on a stale render.
  const card = useRef(null), escapeState = useRef(null);
  escapeState.current = { running, stopping, claimed: !!menuKind || escapeClaimed, onStop };
  useLayoutEffect(() => {
    const listener = (event) => {
      const state = escapeState.current, node = card.current;
      const action = windowEscapeAction({ key: event.key, defaultPrevented: event.defaultPrevented, isComposing: event.isComposing, keyCode: event.keyCode,
        running: state.running, interrupting: state.stopping, latched: escapeStopLatch.current, overlayOpen: state.claimed,
        targetIsCanvas: escapeExemptTarget(event.target), panelActive: !!node?.isConnected && !node.closest("[inert]") });
      if (action !== "stop") return;
      event.preventDefault();
      escapeStopLatch.current = true;
      state.onStop?.({ trigger: "escape" });
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  const submit = (priority) => {
    if (!canSend) return;
    setDismissed(true);
    dismissHistoryNav();
    onSubmit({ priority });
  };
  const open = (kind) => (event) => onMenu(kind, event.currentTarget);
  // c360a9e1c hd: tooltip ge / ariaLabel Se / ringPct le from the thread tokenUsage
  // (last.totalTokens over modelContextWindow); context-usage-model.mjs.
  const usageCopy = usageTriggerCopy(usage, { fresh: usageFresh });
  const effortAvailable = (model?.supportedReasoningEfforts?.length || 0) > 1;
  const [dragOver, setDragOver] = useState(false);
  const acceptsFiles = !!onStageFiles && editable;

  const keyDown = (event) => {
    if (mentionOpen) {
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && !isComposingEvent(event)) {
        event.preventDefault();
        setMention((current) => (current ? { ...current, highlighted: nextHighlight(current.highlighted, current.options.length, event.key) } : current));
        return;
      }
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeMention(); return; }
      if ((event.key === "Tab" || event.key === "Enter") && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (isComposingEvent(event)) { event.preventDefault(); return; }
        event.preventDefault();
        acceptMention(mention.options[mention.highlighted]);
        return;
      }
    }
    if (showCommands && !isComposingEvent(event)) {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setDismissed(true); return; }
      if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); setCommandIndex((selected + (event.key === "ArrowDown" ? 1 : -1) + suggestions.length) % Math.max(1, suggestions.length)); return; }
      if (event.key === "Tab" && !event.shiftKey && suggestions[selected]) { event.preventDefault(); chooseCommand(suggestions[selected].id); return; }
      if (event.key === "Enter" && !event.shiftKey && suggestions[selected]) { event.preventDefault(); chooseCommand(suggestions[selected].id); return; }
    }
    // c099c328d ya :11162-11188: plain ↑ in an empty editor first takes back the newest queued message
    // (onEmptyArrowUp = handleDequeueLastQueued); only when nothing can be dequeued does history run.
    if (onEmptyArrowUp && !historyNav && emptyArrowUpDequeues({ event, empty: !(editor.current?.value ?? draft), popupOpen: mentionOpen || showCommands })
      && onEmptyArrowUp()) { event.preventDefault(); event.stopPropagation(); return; }
    // c099c328d ya :11170-11188: history runs only when no suggestion popup owns the keys.
    if (!mentionOpen && !showCommands && historyResetKey) {
      const element = editor.current, inEditor = !!element && element.contains(event.target);
      const arrow = event.key === "ArrowUp" || event.key === "ArrowDown";
      const step = promptHistoryStep(history.current, {
        resetKey: historyResetKey, key: event.key, shiftKey: event.shiftKey, metaKey: event.metaKey, ctrlKey: event.ctrlKey, altKey: event.altKey,
        composing: isComposingEvent(event), inEditor,
        atStart: arrow && inEditor && event.key === "ArrowUp" ? !!element.caretAtEdge?.("start") : false,
        atEnd: arrow && inEditor && event.key === "ArrowDown" ? !!element.caretAtEdge?.("end") : false,
        text: element?.value ?? draft, prompts: arrow ? (getHumanPrompts?.() || []) : [],
      });
      history.current = step.state;
      if (step.nav !== historyNavRef.current) setHistoryNav(step.nav);
      if (step.action === "swallow") { event.preventDefault(); event.stopPropagation(); return; }
      if (step.action === "recall" || step.action === "restore") {
        event.preventDefault(); event.stopPropagation();
        setMention(null);
        element.recallText?.(step.text);
        return;
      }
    }
    if (event.key === "Escape") {
      const action = escapeAction({ event, running, interrupting: stopping, escapeClaimed: !!menuKind || escapeClaimed, popupOpen: false, stopLatched: escapeStopLatch.current });
      if (action === "swallow") { event.preventDefault(); event.stopPropagation(); return; }
      if (action === "stop") { event.preventDefault(); event.stopPropagation(); escapeStopLatch.current = true; onStop?.({ trigger: "escape" }); return; }
      // :11223-11245: an idle editor (no turn to stop or recall) gives up focus ($?.commands.blur()).
      if (!running && !event.defaultPrevented) editor.current?.blur?.();
      return;
    }
    const action = enterAction({ event, popupOwnsEnter: showCommands && !!suggestions[selected] });
    if (action === "none" || action === "newline" || action === "popup") return;
    if (action === "ignore") { if (event.repeat) { event.preventDefault(); event.stopPropagation(); } return; }
    event.preventDefault();
    submit(submitPriority(action, running, { stayOnDraft }));
  };
  const paste = (event) => {
    if (!acceptsFiles) return;
    const files = Array.from(event.clipboardData?.files || []);
    if (!files.length) return;
    event.preventDefault();
    onStageFiles(files, { source: "paste", imagesOnly: true, imagesAllowed: modelAcceptsImages(model) });
  };
  const drop = (event) => {
    setDragOver(false);
    if (!acceptsFiles) return;
    const files = Array.from(event.dataTransfer?.files || []);
    if (!files.length) return;
    event.preventDefault();
    onStageFiles(files, { source: "drop", imagesAllowed: modelAcceptsImages(model) });
  };

  return (
    <div className="composer-zone sc-zone" data-epitaxy-chat-column data-toast-safe-region="">
      {showContext && <div className="sc-context-row">
        {/* cc43287c9-BMbiZYzF.js:20979-20985: the env pill sits in ko{content 'Where Claude runs'} (here the
            agent is DeepSeek); Z.Root/Popup side top, align start. */}
        <ComposerButton className="sc-context-chip" icon="Laptop" iconSize={16} label="Local environment"
          tooltip={{ content: "Where DeepSeek runs", ...ENV_TOOLTIP }} onClick={open("local")}
          {...menuTriggerProps({ open: menuKind === "local", onOpen: (entry, event) => onMenu("local", event.currentTarget, undefined, entry) })}>Local</ComposerButton>
        {/* lH (:21638-21850): ko{content 'Working directory', detail: the path in a block, RTL-ellipsised
            <bdi>}; the trigger is named by its basename. With no folder and nothing recent (b) the chip is a
            plain button that browses directly; otherwise it opens the Recent menu (main.jsx 'home-folder'). */}
        <ComposerButton className="sc-context-chip sc-folder-chip" icon="Folder" iconSize={16} label={basename(workdir)}
          tooltip={{ content: "Working directory", detail: workdir ? <span className="sc-tooltip-path"><bdi>{workdir}</bdi></span> : undefined }}
          {...(folderMenu ? menuTriggerProps({ open: menuKind === "home-folder", onOpen: (entry, event) => onMenu("home-folder", event.currentTarget, undefined, entry) }) : {})}
          onClick={folderMenu ? open("home-folder") : () => onFolder?.()}><span>{basename(workdir)}</span></ComposerButton>
        {workspaceInfo?.isRepo && (
          <div className="sc-branch-worktree">
            {/* hT (:22009-22035): tooltip 'Branch to start from', triggerLabel c ?? '—'; the searchable list is main.jsx 'branch'. */}
            <ComposerButton className="sc-branch-chip" icon="GitBranch" iconSize={16} label="Branch"
              tooltip={{ content: BRANCH_TOOLTIP }} onClick={open("branch")}
              {...menuTriggerProps({ open: menuKind === "branch", disabled: running || sending, onOpen: (entry, event) => onMenu("branch", event.currentTarget, undefined, entry) })}
              disabled={running || sending}><span>{branchTriggerLabel(workspaceInfo.branch)}</span></ComposerButton>
            <span className="sc-worktree-divider" aria-hidden="true" />
            {/* :22042-22074: ko{content O, hoverable:false, collisionPadding} around the label; the checkbox is
                labelled by 'worktree' and described by an sr-only copy of O (no native title). */}
            <SourceTooltip content={WORKTREE_TOOLTIP} {...ENV_TOOLTIP}>
              <label className="sc-worktree">
                <span className="sc-worktree-checkbox">
                  <input type="checkbox" checked={!!worktree} disabled={running || sending}
                    aria-labelledby={worktreeLabelId} aria-describedby={worktreeDescriptionId}
                    onChange={(event) => setWorktree(event.target.checked)} />
                  <Icon name="Check" size={16} weight="strong" style={{ fontSize: 12 }} />
                </span>
                <span id={worktreeLabelId}>worktree</span>
                <span id={worktreeDescriptionId} className="sc-sr-only">{WORKTREE_TOOLTIP}</span>
              </label>
            </SourceTooltip>
          </div>
        )}
        {/* GV/YB (:21198-21220, :18891-18915): an added folder keeps the source's native title = its path. */}
        {additionalFolders.map((path) => (
          <span className="sc-context-chip sc-extra-folder" key={path} title={path}>
            <Icon name="Folder" size={16} />
            <span>{basename(path)}</span>
            {onRemoveFolder && <button type="button" aria-label={`Remove ${basename(path)}`}
              disabled={running || sending} onClick={() => onRemoveFolder(path)}>
              <Icon name="X" size={12} />
            </button>}
          </span>
        ))}
        {/* :22076-22093: ko{content 'Add another folder', hoverable:false, collisionPadding}. */}
        {workdir && onAddFolder && <ComposerButton className="sc-context-chip sc-add-folder" label="Add another folder" icon="FolderPlus" iconSize={16}
          tooltip={{ content: "Add another folder", ...ENV_TOOLTIP }} onClick={onAddFolder} />}
      </div>}
      {beforeComposer}
      {warning && (
        <div className="sc-warning-row" role="status" data-cds-composer-warning="">
          <span className="sc-warning-text">{warning}</span>
          {onReconnect && <button type="button" className="sc-warning-action" onClick={onReconnect}>Retry</button>}
        </div>
      )}
      {showPet && <SourcePet />}
      <form ref={card} className="composer sc-composer epitaxy-prompt" data-cds-shell=""
        data-cds="ChatComposer" data-busy={running || sending || undefined} data-disabled={disabled || undefined}
        data-drag-over={dragOver || undefined}
        onDragOver={(event) => { if (acceptsFiles && event.dataTransfer?.types?.includes("Files")) { event.preventDefault(); setDragOver(true); } }}
        onDragLeave={() => setDragOver(false)} onDrop={drop}
        onSubmit={(event) => { event.preventDefault(); submit(running ? "next" : undefined); }}>
        {showCommands && <SourceSlashMenu commands={suggestions} selected={selected} onSelect={chooseCommand} onHover={setCommandIndex} id={commandId} query={query||''} caret={commandCaret} editorRef={editor} onDismiss={()=>setDismissed(true)} preSession={!commandContext.current}/>}
        {showCommands&&query===''&&<SlashHint editorRef={editor} getCaret={caretViewportRect} caret={hintCaret} text="Type to filter"/>}
        {/* Em :8938-8966: sr-only live status next to the card (search state is out of scope). */}
        <span className="sc-sr-only" role="status" data-history-status="">{promptHistoryStatus(historyNav)}</span>
        <div className="sc-surface">
          {historyNav && <div className="sc-history-header-grid">
            <div className="sc-history-header-clip">
              <div className="sc-history-header" data-cds="ChatComposerHeader" aria-hidden="true">
                <span className="sc-history-count">History {historyNav.index}/{historyNav.total}</span>
                {historyNav.hasDraft && <>
                  <span aria-hidden="true">·</span>
                  <span className="sc-history-draft"><kbd data-cds="Kbd" className="scds-key scds-key-square sc-history-kbd">↓</kbd> to restore your draft</span>
                </>}
              </div>
            </div>
          </div>}
          <SourceComposerAttachments entries={attachments} onRemove={onRemoveAttachment} onOpenFile={onOpenAttachmentFile} disabled={sending} />
          <div className="sc-input-row">
            <SourceComposerEditor className="sc-input epitaxy-prompt-input" data-cds="ChatComposerEditor"
              inputRef={assignEditor} scope={commandScope} aria-label="Message DeepSeek" rows={1} disabled={disabled}
              mentions={mentions} chips={chipCatalog} mentionActions={mentionActions}
              aria-autocomplete="list" aria-controls={showCommands ? commandId : undefined} aria-expanded={showCommands || mentionOpen} aria-activedescendant={showCommands && suggestions[selected] ? `${commandId}-${selected}` : undefined}
              placeholder={placeholder ?? composerPlaceholder({ mode })}
              onBlur={() => { setCommandFocus(false); setMention(null); }} onFocus={() => setCommandFocus(true)}
              value={draft} onChange={(event) => { setDraft(event.target.value); setMentionDismissed(null); requestAnimationFrame(updateMention); }}
              onSelect={() => { if (mentionRef.current) updateMention(); }}
              onClick={updateMention} onKeyUp={(event) => { if (["ArrowLeft", "ArrowRight"].includes(event.key)) updateMention(); }}
              onPaste={paste} onKeyDown={keyDown} />
            {/* c099c328d A(sm,{showStop:Ki,stop,send}): both controls share one grid cell and crossfade. */}
            <SubmitCrossfade showStop={showStop}
              stop={
                // c099c328d stop: hn{content 'Stop', shortcut Vt?void 0:'escape', hoverable:!1, lazy, open Ki?void 0:!1}
                // around Ut{ghost iconOnly icon Ih, aria-keyshortcuts Vt?void 0:nn('escape') → 'Escape', className jh}.
                // Vt (Escape claimed elsewhere) ↔ local menuKind or escapeClaimed. Accessible name stays 'Stop response' (HANDOFF 0.2.112).
                <SourceTooltip content="Stop" shortcut={menuKind || escapeClaimed ? undefined : "escape"} hoverable={false} open={menuKind || !showStop ? false : undefined}>
                  <div className="sc-submit-slot">
                    <ComposerButton className="sc-submit" label="Stop response" tooltip={false} icon="Stop"
                      aria-keyshortcuts={menuKind || escapeClaimed ? undefined : "Escape"} onClick={() => onStop?.({ trigger: "button" })}
                      onMouseDown={(event) => event.preventDefault()} />
                  </div>
                </SourceTooltip>
              }
              send={
                // c099c328d ga: Ut{ghost iconOnly icon Nh (ArrowReturn sm text-secondary group-disabled/btn:text-disabled),
                // aria-keyshortcuts nn('enter') → 'Enter', busy/busyLabel 'Sending', className `${jh} ${Fh}`};
                // send tooltip open:!Ki&&void 0 → closed while Stop is the active control.
                <SourceTooltip content="Send" shortcut="enter" open={menuKind || showStop ? false : undefined}
                  // c099c328d :8870-8895: the second row is 'Queue for later' while busy, else 'Send and stay here' (de) on the
                  // Home draft. No ⌘⌥⏎ fork row (q): thread/fork is unsupported on the DeepSeek core.
                  secondaryHint={stopAvailable && queueEnabled ? { label: "Queue for later", shortcut: "cmd+enter" }
                    : stayOnDraft && !running ? { label: "Send and stay here", shortcut: "cmd+enter" } : undefined}>
                  <div className="sc-submit-slot">
                    <button className="sc-button sc-icon-button sc-submit" data-cds="Button" type="submit"
                      aria-label="Send message" aria-keyshortcuts="Enter" disabled={!canSend} aria-busy={sending || undefined}
                      onMouseDown={(event) => event.preventDefault()}>
                      {sending ? <><span className="sc-spinner" aria-hidden="true" /><span className="sc-sr-only">Sending</span></> : <Icon name="ArrowReturn" size={16} />}
                    </button>
                  </div>
                </SourceTooltip>
              } />
          </div>
        </div>
      </form>
      {mentionOpen && <SourceMentionDropdown options={mention.options} highlighted={mention.highlighted} caret={mention.caret}
        onSelect={acceptMention} onHover={(index) => { if (index !== null) setMention((current) => (current ? { ...current, highlighted: index } : current)); }}
        onClose={closeMention} />}
      <div className="composer-footer sc-chin" data-cds="ChatComposerChin" data-size="xs">
        <div className="sc-chin-leading">
          <ComposerButton className="sc-add" label="Add" icon="Add" onClick={open("add")} disabled={sending}
            tooltip={{content:"Add", open:menuKind ? false : undefined}} />
          {/* No dictation slot: c360a9e1c-GPs-MV9u.js:4892-4907 renders bH{squareSeam, 'flex shrink-0 items-center
              empty:hidden gap-xs', children:[P ? null : (ce ?? nf{…}), null]} and nf (:5067-5095) returns null when
              hideDictation; Code passes hideDictation:!Bu (cc43287c9-BMbiZYzF.js:36836, Bu = Sd(…).dictationEnabled
              :32338-32360). This Codex client has no dictation, so bH is an empty div → empty:hidden (display:none)
              and the mn.Chin leading slot (shared-11 cu 'flex items-center self-start', no gap) holds Add then Mode. */}
          {/* c360a9e1c-GPs-MV9u.js:4544-4575 Ud / :4942 (disabled only without items), :4961 renderModelSelector and :2829
              rn = !r || lt > 0: Mode, Model and Effort stay usable while a turn runs; the choice is saved at once and goes
              out with the next turn/start (and, on the DeepSeek core, to the running agent — main.jsx). `sending` still
              gates them: a turn/start in flight was built from the previous choice. */}
          <ComposerButton className="sc-permission" label="Permission mode" onClick={open("permission")}
            {...menuTriggerProps({ open: permissionOpen, onOpen: (entry, event) => onMenu("permission", event.currentTarget, undefined, entry) })}
            tooltip={modeTooltip({ permission, menuKind })}
            disabled={sending}>{/* cf6ae6197 `ht = triggerLabel ?? label`: the full item label. */}{permissionLabel(permission)}</ComposerButton>
        </div>
        <div className="sc-chin-trailing">
          {/* shared-14 kS: while the catalog loads the trigger is disabled and shows a
              spinner with the loading label; an empty catalog shows the empty label. */}
          {/* shared-14 :7160-7226: the Model pill has no tooltip unless a warning exists (none locally) → tooltip={false}. */}
          <ComposerButton className="sc-model-trigger" label="Model" onClick={open("model")} tooltip={false}
            {...menuTriggerProps({ open: modelOpen, onOpen: (entry, event) => onMenu("model", event.currentTarget, undefined, entry), disabled: sending || !model || modelsLoading })}
            disabled={sending || !model || modelsLoading} aria-busy={modelsLoading || undefined}>
            {modelsLoading
              ? <><span className="sc-spinner" aria-hidden="true" /><span>Loading models…</span></>
              : <span>{model?.displayName || model?.model || "Default model"}{fastMode && <span className="sc-fast-label"> Fast</span>}</span>}
          </ComposerButton>
          {/* c8e04f916 (prettier :236-262): the effort trigger sits in f{content: effortLabel, detail: warning text
              (only for a warning badge — none locally), open: !popoverOpen && undefined}; its accessible name is
              effortSelectorTrigger 'Effort: {name}'. */}
          {effort && <ComposerButton className="sc-effort-trigger" label={`Effort: ${effortName(effort)}`} aria-haspopup="dialog" aria-expanded={menuKind === "effort"}
            tooltip={{content:"Effort", open:menuKind === "effort" ? false : undefined}}
            disabled={sending || !effortAvailable} onClick={open("effort")}>{effortName(effort)}</ComposerButton>}
          {/* c360a9e1c _d: ghost iconOnly Button (tooltip:false) with icon Xr ring, wrapped in
              Zt {content: ge, detail: xe, open: popover open ? false : undefined}. */}
          <ComposerButton className="sc-usage-trigger" label={usageCopy.ariaLabel} icon={<ContextRing pct={usageCopy.ringPct} />} onClick={open("usage")}
            aria-haspopup="dialog" aria-expanded={menuKind === "usage"}
            tooltip={{content:usageCopy.tooltip, detail:usageCopy.detail ?? undefined, open:menuKind ? false : undefined}} />
          {/* c360a9e1c :4840-4848 + :4972-4980: sr-only role=status live region (ze, last in the trailing Ve after the usage trigger) 'Fast mode on'/'Fast mode off'.
              The source renders it unconditionally; here it is rendered only when the model has a Fast tier
              (no fast state exists otherwise). */}
          {fastAvailable && <span role="status" aria-live="polite" className="sr-only">{fastMode ? "Fast mode on" : "Fast mode off"}</span>}
        </div>
      </div>
    </div>
  );
}

// lH menu (cc43287c9-BMbiZYzF.js:21753-21848), rendered in a SourceMenu.Popup side top / align start: a 'Recent'
// group of radio rows (the current folder checked; title = the path; the parent directory as description when
// basenames collide), each non-current row with a trailing 'Remove from recent' X (data-dismiss-recent; a click
// on it keeps the menu open) and Delete/Backspace to dismiss; then a separator and 'Open folder…'.
export function SourceRecentFolderMenu({ rows = [], onSelect, onDismiss, onBrowse }) {
  return <>
    {rows.length > 0 && <>
      <SourceMenu.Group>
        <SourceMenu.GroupLabel>Recent</SourceMenu.GroupLabel>
        {rows.map((row) => <RecentFolderItem key={row.path} row={row} onSelect={onSelect} onDismiss={onDismiss} />)}
      </SourceMenu.Group>
      <SourceMenu.Separator />
    </>}
    <SourceMenu.Item onClick={() => onBrowse?.()}>Open folder…</SourceMenu.Item>
  </>;
}

function RecentFolderItem({ row, onSelect, onDismiss }) {
  const popup = useMenuPopup();
  // After a dismissal the highlight (and focus) stays in the list: the next row, else the previous one.
  const dismiss = row.dismissible && onDismiss ? (node) => {
    const items = [...(popup?.node.current?.querySelectorAll('[role^="menuitem"]:not([data-disabled])') ?? [])];
    const at = items.indexOf(node), next = items[at + 1] ?? items[at - 1] ?? null;
    onDismiss(row.path);
    if (next) requestAnimationFrame(() => { if (next.isConnected) popup?.highlight(next); });
  } : undefined;
  return (
    <SourceMenu.Item checked={row.checked} checkedRole="radio" title={row.path} description={row.description} data-recent-folder={row.path}
      aria-keyshortcuts={dismiss ? "Delete" : undefined}
      onClick={(event) => {
        if (dismiss && event.target.closest?.("[data-dismiss-recent]")) { event.preventDefault(); dismiss(event.currentTarget); return; }
        onSelect?.(row.path);
      }}
      onKeyDown={dismiss ? (event) => { if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); dismiss(event.currentTarget); } } : undefined}
      trailing={dismiss ? <span className="sc-recent-dismiss-slot">
        <span data-dismiss-recent="" aria-hidden="true" title="Remove from recent" className="sc-recent-dismiss"><Icon name="X" size={12} /></span>
      </span> : undefined}>{row.label}</SourceMenu.Item>
  );
}

// hT step 1 (cc43287c9 :22009-22035 over cd2687f9f N), in a SourceMenu.Popup side top / align start / sideOffset 8:
// radio rows without icons or heading (sorted by branch-picker-model), the Empty row 'No branches match', the h-1
// spacer and the search field last (side top). Typing filters; Enter selects the highlighted row, else the first
// match of a non-empty query. Arrow keys move into the list; other keys stay in the field.
export function SourceBranchPickerMenu({ branches = [], current = "", onSelect }) {
  const popup = useMenuPopup();
  const [query, setQuery] = useState("");
  const input = useRef(null);
  const shown = filterBranches(branches, query);
  useEffect(() => {
    const frame = requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, []);
  return <>
    <div className="sc-branch-list">
      {shown.map((branch) => <SourceMenu.Item key={branch} checked={branch === current} checkedRole="radio" data-branch={branch}
        onClick={() => onSelect?.(branch)}>{branch}</SourceMenu.Item>)}
    </div>
    {shown.length === 0 && <div className="sc-branch-empty">{BRANCH_EMPTY_MESSAGE}</div>}
    <div className="sc-branch-spacer" aria-hidden="true" />
    <div className="sc-branch-search">
      <Icon name="Search" size={12} />
      <input ref={input} type="text" value={query} placeholder={BRANCH_SEARCH_PLACEHOLDER} aria-label={BRANCH_SEARCH_PLACEHOLDER}
        autoComplete="off" spellCheck={false} onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) { event.stopPropagation(); return; }
          if (event.key === "Enter") {
            event.preventDefault(); event.stopPropagation();
            const highlighted = popup?.highlighted;
            if (highlighted?.isConnected) { highlighted.click(); return; }
            const first = enterSelection(branches, query);
            if (first) { onSelect?.(first); popup?.close("item-click"); }
            return;
          }
          if (["ArrowDown", "ArrowUp", "Escape", "Tab"].includes(event.key)) return;
          event.stopPropagation();
        }} />
    </div>
  </>;
}

// c8e04f916 (readable/code-effort.js:269-279) p.Popup: data-cds "ModelSelectorEffort", 'isolate flex w-[220px]
// select-none flex-col gap-lg' on the CDS Popover (default padding lg); the composer passes side top / align end.
// initialFocus he: a pointer open focuses the popup, a keyboard open (⌘⇧E, Enter on the chip) the slider.
export function SourceEffortPopover({ anchor, levels, value, onChange, onClose }) {
  const popup = useRef(null);
  return (
    <SourcePopover anchor={anchor} side="top" align="end" dataCds="ModelSelectorEffort" className="sc-effort-popover" label="Effort"
      onClose={onClose} initialFocus={(type) => type === "keyboard" ? popup.current?.querySelector('input[type="range"]:not(:disabled)') : null}>
      <EffortControl levels={levels} value={value} onChange={onChange} rootRef={popup} />
    </SourcePopover>
  );
}

// c360a9e1c-GPs-MV9u.js:4240-4285 vd: Qt.Popup side top, align end, sideOffset 8, padding none, 'epitaxy-root
// break-words w-[360px] max-w-[calc(100vw-2rem)] max-h-[min(var(--available-height),640px)]', an sr-only
// Title 'Usage', then 'flex flex-col py-sm' around the yc panel. initialFocus n: keyboard → the default
// (first tabbable), a pointer → the popup.
export function SourceUsagePopover({ anchor, usage, fresh = false, onSeeDetails, onCompact, compactState, onClose }) {
  return (
    <SourcePopover anchor={anchor} side="top" align="end" sideOffset={8} padding="none" className="epitaxy-root sc-usage-popover" label="Usage"
      onClose={onClose} initialFocus={(type) => type === "keyboard" || null}>
      <SourcePopoverTitle className="sp-sr-only">Usage</SourcePopoverTitle>
      <div className="sc-usage-body"><SourceUsagePanel usage={usage} fresh={fresh} onSeeDetails={onSeeDetails} onCompact={onCompact} compactState={compactState} /></div>
    </SourcePopover>
  );
}

// c2d611398-m3q28S31.js I/V/L/z (the yc panel) with the local data: the context section (V) when hd's ie holds
// (a tokenUsage report, or no session yet), with no fetched breakdown, so its header is a disabled button
// without a caret over a 4px bar (chart-reference tint track, the dT threshold fill); then, for an open
// session, the separator and the 'See detailed breakdown' row (z, a Popover.Close) that opens /status.
// Plan-limit windows, the noData copy and the stale/engine notices have no local data (or branch) and stay absent.
// The compact action (gd → Ga/Tw, only with an onCompact: hd oe) is the H row after the bar.
export function SourceUsagePanel({ usage, fresh = false, onSeeDetails, onCompact, compactState }) {
  const panel = usagePanelCopy(usage, { fresh });
  const compact = onCompact ? compactAction({ contextPct: panel.contextPct, ...compactState }) : { kind: "hidden" };
  return <>
    {panel.contextMode && <div className="sc-usage-context">
      <button type="button" className="sc-usage-row sc-usage-context-header" disabled>
        <span className="sc-usage-muted">Context window</span>
        <span className="sc-usage-muted sc-usage-summary">{panel.summary}</span>
      </button>
      <div className="sc-usage-context-body">
        <div className="sc-usage-bar" role="progressbar" aria-valuenow={panel.contextPct ?? undefined}
          aria-valuetext={panel.contextPct === null ? panel.summary : undefined} aria-valuemin={0} aria-valuemax={100}>
          {panel.contextPct !== null && <div className="sc-usage-bar-fill" style={{ width: `${panel.contextPct}%`, background: contextRingStroke(panel.contextPct) }} />}
        </div>
      </div>
      {compact.kind !== "hidden" && <UsageCompactRow onCompact={onCompact} disabledReason={compact.reason} />}
    </div>}
    {onSeeDetails && <>
      {panel.contextMode && <div className="sc-usage-separator" aria-hidden="true" />}
      <SourcePopoverClose className="sc-usage-row sc-usage-link" onClick={onSeeDetails}>See detailed breakdown</SourcePopoverClose>
    </>}
  </>;
}

// c2d611398 H: 'px-lg pb-xs flex items-center gap-sm min-h-[20px] text-footnote' holding the hint span ('flex-1
// min-w-0 truncate text-secondary'; the 'Compacts automatically at {pct}%' copy needs the core's threshold, unknown
// here, so it stays empty) and, inside the eo disabled-reason tooltip, the CDS TextLink (xo, 'shrink-0
// whitespace-nowrap') 'Compact session' (ce660512f compactSession), disabled with the Ow reason.
function UsageCompactRow({ onCompact, disabledReason }) {
  const disabled = disabledReason !== undefined;
  return (
    <div className="sc-usage-compact-row">
      <span className="sc-usage-compact-hint" />
      <SourceTooltip disabledReason={disabledReason}>
        <button type="button" data-cds="TextLink" className="sc-usage-compact" disabled={disabled} data-disabled={disabled || undefined}
          onClick={() => { if (!disabled) onCompact?.(); }}>Compact session</button>
      </SourceTooltip>
    </div>
  );
}

// Hosted by SourceEffortPopover. A committed slider choice intentionally leaves it open.
// The options are the live Codex catalog, never a hard-coded Claude effort list.
export function EffortControl({ levels = [], value, onChange, disabled = false, rootRef }) {
  const options = levels.map((level) => typeof level === "string"
    ? { id: level, name: effortName(level) }
    : { ...level, id: level.id || level.reasoningEffort, name: level.name || level.label || effortName(level.id || level.reasoningEffort) });
  const active = Math.max(0, options.findIndex((option) => option.id === value));
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [help, setHelp] = useState(false);
  const pending = useRef(value);
  const helpId = useId();
  useEffect(() => { pending.current = value; }, [value]);
  const index = Math.min(preview ?? active, Math.max(0, options.length - 1));
  const selected = options[index];
  const maximum = Math.max(0, options.length - 1);
  const unavailable = disabled || options.length < 2;
  const commit = (nextIndex) => {
    setPreview(null);
    setDragging(false);
    const next = options[Number(nextIndex)]?.id;
    if (unavailable || !next || next === pending.current) return;
    pending.current = next;
    onChange(next);
  };

  return (
    <section ref={rootRef} className="sc-effort-control" aria-label="Effort settings">
      <div className="sc-effort-heading">
        {/* p.Title 'shrink-0 text-muted' names the popover dialog. */}
        <div className="sc-effort-title"><SourcePopoverTitle className="sc-effort-label">Effort</SourcePopoverTitle><span key={selected?.id} className="sc-effort-value">{selected?.name || "Unavailable"}</span></div>
        {selected?.description && (
          <div className="sc-effort-help-wrap">
            <button className="sc-effort-help" aria-label="About effort" type="button"
              aria-describedby={help ? helpId : undefined} aria-expanded={help}
              onPointerEnter={() => setHelp(true)} onPointerLeave={() => setHelp(false)}
              onFocus={() => setHelp(true)} onBlur={() => setHelp(false)} onClick={() => setHelp((open) => !open)}>
              <Icon name="Help" size={12} />
            </button>
            {help && <div className="sc-effort-description" role="tooltip" id={helpId}>
              <strong>{selected.name}</strong><span>{selected.description}</span>
            </div>}
          </div>
        )}
      </div>
      <div className="sc-effort-slider-group">
        <div className="sc-effort-scale" aria-hidden="true"><span>Faster</span><span>Smarter</span></div>
        <div className="sc-slider" data-cds="Slider" data-dragging={dragging || undefined} data-disabled={unavailable || undefined}
          style={{ "--sc-slider-position": maximum > 0 ? index / maximum : 0 }}>
          <div className="sc-slider-track" aria-hidden="true"><div className="sc-slider-fill" /></div>
          <div className="sc-slider-stops" aria-hidden="true">
            {options.map((option, stop) => <span key={option.id} data-slider-stop={stop} title={option.name} />)}
          </div>
          <div className="sc-slider-carriage" aria-hidden="true"><span className="sc-slider-handle" /></div>
          <input type="range" min={0} max={maximum} step={1} value={index} disabled={unavailable}
            aria-label="Effort" aria-valuetext={selected?.name || "Unavailable"}
            onChange={(event) => setPreview(Number(event.target.value))}
            onPointerDown={() => setDragging(true)} onPointerUp={(event) => commit(event.currentTarget.value)}
            onPointerCancel={() => { setPreview(null); setDragging(false); }}
            onKeyUp={(event) => {
              if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) commit(event.currentTarget.value);
            }}
            onBlur={(event) => { if (preview !== null) commit(event.currentTarget.value); }} />
        </div>
      </div>
    </section>
  );
}
