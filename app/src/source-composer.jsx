import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";
import { SourcePet } from "./source-pet";
import { SourceTooltip } from "./source-tooltip";
import { SourceMenu, menuTriggerProps, useMenuPopup } from "./source-menu";
import { SourceComposerEditor } from "./source-composer-editor";
import { SourceSlashMenu, SlashHint } from "./source-slash-menu";
import { matchCommands, parseSessionCommand, slashQuery, sessionCommands, sessionCommandHint, sessionCommandDescription, slashSkills, slashCustomCommands } from "./session-command-model.mjs";
import { SourceComposerAttachments } from "./source-composer-attachments";
import { SourceMentionDropdown } from "./source-mention-dropdown";
import { SourceEmojiDropdown } from "./source-emoji-dropdown.jsx";
import { emojiToken, emojiMatches, insertEmoji } from "./emoji-model.mjs";
import { mentionToken, insertMention, mentionOptions, nextHighlight, MENTION_SEARCH_DELAY, MENTION_RESULT_LIMIT } from "./mention-model.mjs";
import { enterAction, escapeAction, isComposingEvent, submitPriority, windowEscapeAction, escapeExemptTarget, emptyArrowUpDequeues, createDoubleEscape } from "./composer-keys-model.mjs";
import { composerPlaceholder } from "./composer-placeholder.mjs";
import { MODE_MENU_KEYS } from "./chin-shortcuts.mjs";
import { shortcutCaps } from "./source-shortcut";
import { INITIAL_PROMPT_HISTORY, promptHistoryStep, promptHistoryStatus, historySearchStep, historySearchStatus, isHistorySearchKey, HISTORY_SEARCH_HINT_DELAY } from "./prompt-history-model.mjs";
import "./source-shortcut.css";
import { usageTriggerCopy, usagePanelCopy, contextRingGeometry, contextRingStroke, CONTEXT_RING_TRACK, compactAction } from "./context-usage-model.mjs";
import { planWindowSummary, usageResetCountdown } from "./usage-model.mjs";
import { effortName, hasTopTierEffort, isTopTierEffort } from "./model-menu-model.mjs";
import { EffortLitOverlay } from "./source-effort-lit.jsx";
import { useReducedMotion } from "./use-reduced-motion.js";
import { modelAcceptsImages } from "./composer-attachments-model.mjs";
import { BRANCH_EMPTY_MESSAGE, BRANCH_SEARCH_PLACEHOLDER, BRANCH_TOOLTIP, branchTriggerLabel, enterSelection, filterBranches } from "./branch-picker-model.mjs";
import { SourcePopover, SourcePopoverClose, SourcePopoverTitle } from "./source-popover";
import "./source-composer.css";
import { permissionLabel } from "./source-permission-menu.jsx";
import { SourceSelect } from "./source-select.jsx";
import { t, getAssistantName, getLocale } from "../electron/i18n/index.mjs";

// lH (cc43287c9-BMbiZYzF.js:21699): the folder chip reads the basename, or 'Select folder…' with none chosen.
const basename = (path) => path?.split("/").filter(Boolean).pop() || t("Select folder\u2026");
// dH (cc43287c9 :20979-20985, :22047-22050, :22076-22081): the env pill, worktree label and Add folder
// tooltips are hoverable:false with collisionPadding {top:48, right:8, bottom:8, left:8}.
const ENV_TOOLTIP = { hoverable: false, collisionPadding: { top: 48, right: 8, bottom: 8, left: 8 } };
export const WORKTREE_TOOLTIP = t("Work in an isolated copy of the repository");

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
  content: permission === "bypass" ? t("DeepSeek can modify or delete files without asking") : t("Mode"),
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
  return tooltip ? <SourceTooltip {...tooltip} content={t(tooltip.content)}>{button}</SourceTooltip> : button;
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
  fastMode = false, fastAvailable = false, speedLabel = null,
  draft, setDraft, textarea, attachments = [], onRemoveAttachment, onOpenAttachmentFile, onStageFiles, onSubmit,
  running, sending, stopping = false, editable = true, canSubmit = true, escapeClaimed = false, onEmptyArrowUp,
  // Esc Esc (code-workspace.js Gl): opens Rewind from an empty, idle composer; null where the session can't rewind.
  onRewind = null,
  mentions = [], mentionActions, onStop, onReconnect, reconnectLabel, warning, connectingHint, workdir, workspaceInfo, onMenu,
  model, effort = "", permission, permissionOpen = false, modelOpen = false, modelsLoading = false, menuKind, worktree, setWorktree, usage, usageFresh = false, planUsage = null, mode, onCodeMode, onFolder,
  folderMenu = true,
  showPet = false, showContext = showPet, onAddFolder, additionalFolders = [], onRemoveFolder, beforeComposer,
  commandContext, onCommand, commandScope, searchFiles, onMention, queueEnabled = false, placeholder,
  // The core's suggested next prompt (codeDesktop/promptSuggestion: MiMo's predicted prompt, Qwen's follow-up
  // suggestion): shown as the empty editor's placeholder, Tab puts it in the draft.
  suggestion = null, onAcceptSuggestion,
  getHumanPrompts, historyResetKey,
  // cc43287c9 :28620 stayOnDraftHint = cn === 'draft' && !Yn: the Home draft offers 'Send and stay here' (⌘⏎).
  stayOnDraft = false,
  // Dynamic workflows: {ignored, onToggle} while the draft has the "ultracode" keyword (alt+w ignores it for this
  // prompt, as Claude Code's chat:workflowKeywordToggle), and whether ultracode mode is on (its status line).
  workflowKeyword = null, ultracode = false,
  // '!' shell mode on this core (shell-mode-model.mjs shellModeKind: "core" | "terminal" | null) — Claude's
  // bashModeAvailable. The draft keeps the leading '!' (main.jsx's send path reads it); the editor shows the rest.
  shellMode = null,
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
  // Bash mode (c099c328d-CbkcmYSW.js Em/Y): '!' typed into an empty editor turns it on and is consumed, Backspace in an
  // empty editor or Esc turns it off; while on, the card wears the purple ring (vm 'inset-ring-1 inset-ring-pro'), the
  // header the 'bash' pro badge, the placeholder is 'Enter a shell command', and slash and mention suggestions are off (wh).
  const bashAvailable = !!shellMode;
  const bashMode = bashAvailable && draft.startsWith("!");
  const editorText = bashMode ? draft.slice(1) : draft;
  const bashModeRef = useRef(false);
  bashModeRef.current = bashMode;
  // The suggested next prompt shows (ghost overlay, Tab / → take it) only over an empty chat editor.
  const showSuggestion = !!suggestion && !bashMode && !draft;
  // Ctrl+R history search (c099c328d _d :4516-4715): its state, and the '↑ ↓ cycle · esc cancel' hint that fades in
  // after historySearchHintDelayMs (gd = 6s) without a keystroke.
  const [search, setSearchState] = useState(null), searchRef = useRef(null), searchHintTimer = useRef(null);
  searchRef.current = search;
  const setSearch = useCallback((next) => {
    clearTimeout(searchHintTimer.current); searchHintTimer.current = null;
    searchRef.current = next ? { ...next, showHints: false } : null;
    setSearchState(searchRef.current);
    if (next) searchHintTimer.current = setTimeout(() => { searchHintTimer.current = null; setSearchState((value) => value && { ...value, showHints: true }); }, HISTORY_SEARCH_HINT_DELAY);
  }, []);
  useEffect(() => () => clearTimeout(searchHintTimer.current), []);
  useLayoutEffect(() => { setSearch(null); }, [historyResetKey, setSearch]);
  // A send refused in the composer itself (a mention in a shell command): Claude's addError copy, until the next edit.
  const [composerNotice, setComposerNotice] = useState(null);
  // Per-keystroke resets skip a value that is already in place: under fast typing every such no-op setState is still
  // queued (the component always has work pending), each commit then leaves a default-lane update behind, and React
  // counts that chain as nested updates until it throws "Maximum update depth exceeded" (#185).
  useEffect(() => { if (composerNotice !== null) setComposerNotice(null); }, [draft]);
  const query=slashQuery(draft), suggestions=commandContext&&query!==null?matchCommands(query,commandContext):[];
  const showCommands=!!onCommand&&commandFocus&&query!==null&&!dismissed&&suggestions.length>0&&!historyNav&&!bashMode&&!search;
  const selected=Math.min(commandIndex,Math.max(0,suggestions.length-1));
  useEffect(()=>{if(commandIndex!==0)setCommandIndex(0);if(dismissed&&!draft.startsWith('/'))setDismissed(false);},[draft]);
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
  const compactInstructions=commandContext?.compactInstructions===true,workflowEngine=commandContext?.workflowEngine,perTokenBilling=commandContext?.perTokenBilling===true;
  const chipCatalog=useMemo(()=>[...sessionCommands.map(entry=>({id:entry.id,description:sessionCommandDescription(entry,{perTokenBilling}),argumentHint:sessionCommandHint(entry,{compactInstructions,workflowEngine,skills:commandSkills}),kind:'command'})),
    ...slashCustomCommands(commandCustom).map(command=>({id:command.name,description:command.description,argumentHint:command.argumentHint,kind:'custom'})),
    ...slashSkills(commandSkills,commandCustom).map(skill=>({id:skill.name,description:skill.description,argumentHint:skill.argumentHint,kind:'skill'}))],[commandSkills,commandCustom,compactInstructions,workflowEngine,perTokenBilling]);
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
      // CDS editor qc max-h-96: grows to 24rem (384px) before it scrolls.
      element.style.height = `${Math.max(24, Math.min(element.scrollHeight, parseFloat(getComputedStyle(element).maxHeight) || 384))}px`;
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
    if (!element || !searchFilesRef.current || historyNavRef.current || bashModeRef.current || searchRef.current || element.selectionStart !== element.selectionEnd) { if (mentionRef.current !== null) setMention(null); return; }
    const token = mentionToken(element.value, element.selectionStart);
    if (!token || mentionDismissed === `${token.start}:${element.value.slice(token.start, token.end)}`) { if (mentionRef.current !== null) setMention(null); return; }
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
  // ':' emoji suggestions (c099c328d 'emoji-suggestion', :4943-5030): off in bash mode, history recall and search;
  // Escape dismisses that ':' until it is edited away (dismissedTriggerFrom).
  const [emoji, setEmoji] = useState(null), emojiRef = useRef(null), emojiDismissed = useRef(null);
  emojiRef.current = emoji;
  const updateEmoji = useCallback(() => {
    const element = editor.current;
    if (!element || historyNavRef.current || bashModeRef.current || searchRef.current || element.selectionStart !== element.selectionEnd) { if (emojiRef.current !== null) setEmoji(null); return; }
    const token = emojiToken(element.value, element.selectionStart);
    if (emojiDismissed.current !== null && element.value[emojiDismissed.current] !== ":") emojiDismissed.current = null;
    const options = token && emojiDismissed.current !== token.start ? emojiMatches(token.query) : [];
    if (!options.length) { if (emojiRef.current !== null) setEmoji(null); return; }
    const caret = caretViewportRect(element, token.start);
    setEmoji((current) => ({ token, caret, options, highlighted: current?.token?.start === token.start && current.token.query === token.query ? current.highlighted : 0 }));
  }, []);
  const acceptEmoji = (option) => {
    const element = editor.current, current = emojiRef.current;
    if (!element || !current || !option) return;
    const token = emojiToken(element.value, element.selectionStart) || current.token;
    setEmoji(null);
    if (element.replaceText) { element.replaceText(token.start, token.end, option.char); return; }
    const result = insertEmoji(element.value, token, option.char);
    setDraft(bashModeRef.current ? `!${result.text}` : result.text);
    requestAnimationFrame(() => { const node = editor.current; if (node) { node.focus(); node.setSelectionRange(result.caret, result.caret); } });
  };
  const closeEmoji = useCallback(() => { const current = emojiRef.current; if (current) emojiDismissed.current = current.token.start; setEmoji(null); }, []);
  const emojiOpen = !!emoji && emoji.options.length > 0;

  // A known skill parses without error and is sent as a message (session-command-model.mjs).
  const command = parseSessionCommand(draft, commandContext);
  const hostCommand = !!command && !command.skill && !command.custom;
  const disabled = !editable;
  const hasContent = !!editorText.trim() || attachments.length > 0;
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
  // The same listener counts Esc Esc for Rewind (createDoubleEscape): only while the panel is active, the composer is
  // empty (no text, no attachments) and no turn runs; a stop or a claimed Escape starts the count over.
  const card = useRef(null), escapeState = useRef(null), doubleEscape = useRef(null);
  if (!doubleEscape.current) doubleEscape.current = createDoubleEscape();
  escapeState.current = { running, stopping, claimed: !!menuKind || escapeClaimed, onStop, onRewind, empty: !hasContent && !bashMode };
  useLayoutEffect(() => {
    const listener = (event) => {
      const state = escapeState.current, node = card.current;
      const panelActive = !!node?.isConnected && !node.closest("[inert], [data-split-inactive]");
      const targetIsCanvas = escapeExemptTarget(event.target);
      const action = windowEscapeAction({ key: event.key, defaultPrevented: event.defaultPrevented, isComposing: event.isComposing, keyCode: event.keyCode,
        running: state.running, interrupting: state.stopping, latched: escapeStopLatch.current, overlayOpen: state.claimed,
        targetIsCanvas, panelActive });
      if (action !== "stop") {
        if (event.key !== "Escape") return;
        const rewind = doubleEscape.current.press({ key: event.key, defaultPrevented: event.defaultPrevented, isComposing: event.isComposing, keyCode: event.keyCode,
          repeat: event.repeat, metaKey: event.metaKey, ctrlKey: event.ctrlKey, altKey: event.altKey, shiftKey: event.shiftKey, targetIsCanvas,
          claimed: state.claimed || !panelActive || state.running || !state.empty || !state.onRewind });
        if (rewind) { event.preventDefault(); state.onRewind(); }
        return;
      }
      doubleEscape.current.reset();
      event.preventDefault();
      escapeStopLatch.current = true;
      state.onStop?.({ trigger: "escape" });
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  // connectingHint: the core is still starting (canSubmit false). Enter on a message then says so under the
  // composer instead of doing nothing; the draft stays and the hint clears once the core is ready.
  const [blockedSubmit, setBlockedSubmit] = useState(false);
  useEffect(() => { if (!connectingHint) setBlockedSubmit(false); }, [connectingHint]);
  const submit = (priority) => {
    if (!canSend) {
      if (connectingHint && hasContent && !hostCommand && !running) setBlockedSubmit(true);
      return;
    }
    // c099c328d :10795 Jh: a mention in a shell command is refused with Claude's message.
    if (bashMode && editor.current?.querySelector?.("[data-mention]")) {
      setComposerNotice(t("@-mentions can’t be used in a shell command. Remove the mention or send it as a message."));
      return;
    }
    setDismissed(true);
    dismissHistoryNav();
    setSearch(null);
    onSubmit({ priority });
  };
  const open = (kind) => (event) => onMenu(kind, event.currentTarget);
  // c360a9e1c hd: tooltip ge / ariaLabel Se / ringPct le from the thread tokenUsage
  // (last.totalTokens over modelContextWindow); context-usage-model.mjs.
  // planUsage (usage-model planUsageSummary): the core's fullest plan-limit window names the tooltip detail (hd fe/T).
  const planTop = planUsage?.top ?? null;
  const usageCopy = usageTriggerCopy(usage, { fresh: usageFresh, plan: planTop ? { summary: planWindowSummary(planTop), resets: usageResetCountdown(planTop.resetsAt, planTop.minutes, { locale: getLocale() }), percent: Math.round(planTop.used) } : null });
  const effortAvailable = (model?.supportedReasoningEfforts?.length || 0) > 1;
  // A listed model with no effort levels (a custom-provider or relay model) runs at its own default: the chip says
  // 'Model default', as Settings › Reasoning effort does, rather than a saved level the model never reported.
  const noEffortLevels = !!model && !model.supportedReasoningEfforts?.length;
  const effortLabel = noEffortLevels ? t("Model default") : effortName(effort, model?.supportedReasoningEfforts);
  // On its own beside the model a one-character level ('中', '低', '高') reads as anything but effort: a translated
  // chip says what it is ('推理：中'); English keeps the bare level, as the official chip.
  const effortChip = noEffortLevels || getLocale() === "en-US" ? effortLabel : t("{name} effort chip", { name: effortLabel });
  const [dragOver, setDragOver] = useState(false);
  const acceptsFiles = !!onStageFiles && editable;

  const keyDown = (event) => {
    // alt+w (event.code: on a Mac the key types "∑"): ignore, or restore, the "ultracode" keyword for this prompt.
    if (workflowKeyword && event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey && event.code === "KeyW" && !isComposingEvent(event)) {
      event.preventDefault();
      workflowKeyword.onToggle?.();
      return;
    }
    // Ctrl+R history search (c099c328d ya :11166 `(Ci || !t) && bi(e)`): it owns the keys while it runs, and starts
    // only when no suggestion popup is open.
    if (historyResetKey && (searchRef.current || (!mentionOpen && !showCommands && !emojiOpen))) {
      const element = editor.current;
      const step = historySearchStep(searchRef.current, { key: event.key, code: event.code, ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey, shiftKey: event.shiftKey,
        composing: isComposingEvent(event), inEditor: !!element && element.contains(event.target), text: element?.value ?? editorText,
        prompts: !searchRef.current && isHistorySearchKey({ key: event.key, code: event.code, ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey, shiftKey: event.shiftKey }) ? (getHumanPrompts?.() || []) : [] });
      if (step.action !== "none") {
        if (!step.pass) { event.preventDefault(); event.stopPropagation(); }
        if (step.action === "start") { dismissHistoryNav(); setMention(null); setEmoji(null); }
        if (step.state) setSearch(step.state); else setSearch(null);
        if (typeof step.text === "string") element?.recallText?.(step.text, { caret: step.caret });
        else if (step.action === "accept" && element?.setSelectionRange) { const end = element.value.length; element.setSelectionRange(end, end); }
        return;
      }
    }
    // c099c328d :11189-11213: Tab or → in an empty editor takes the suggested prompt (accept_method 'tab' | 'arrow_right').
    if ((event.key === "Tab" || event.key === "ArrowRight") && showSuggestion && !searchRef.current && !mentionOpen && !emojiOpen && !showCommands && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey && !isComposingEvent(event)) {
      event.preventDefault();
      event.stopPropagation();
      const element = editor.current;
      if (element?.recallText) element.recallText(suggestion); else setDraft(suggestion);
      onAcceptSuggestion?.();
      return;
    }
    // c099c328d :11215-11221: '!' in an empty editor turns bash mode on (the '!' is consumed); Backspace in an empty
    // editor turns it off.
    if (bashAvailable && !isComposingEvent(event) && !event.metaKey && !event.ctrlKey && !event.altKey && !(editor.current?.value ?? editorText)) {
      if (event.key === "!" && !bashMode) { event.preventDefault(); setDraft("!"); return; }
      if (event.key === "Backspace" && bashMode) { event.preventDefault(); setDraft(""); return; }
    }
    // Ld onKeyDown (:5068-5085): the emoji list owns ↑/↓ (wrapping), Enter / Tab and Escape while it shows rows.
    if (emojiOpen && !isComposingEvent(event)) {
      const plain = !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeEmoji(); return; }
      if ((event.key === "ArrowUp" || event.key === "ArrowDown") && plain) {
        event.preventDefault(); event.stopPropagation();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setEmoji((current) => (current ? { ...current, highlighted: (current.highlighted + step + current.options.length) % current.options.length } : current));
        return;
      }
      if ((event.key === "Enter" && !event.shiftKey) || (event.key === "Tab" && plain)) { event.preventDefault(); event.stopPropagation(); acceptEmoji(emoji.options[emoji.highlighted]); return; }
    }
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
    if (onEmptyArrowUp && !historyNav && !bashMode && emptyArrowUpDequeues({ event, empty: !(editor.current?.value ?? draft), popupOpen: mentionOpen || showCommands })
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
      // :11236-11239: Esc leaves bash mode (the command stays as chat text) before it would blur the editor.
      if (bashMode && !running && !event.defaultPrevented) { event.preventDefault(); setDraft(editorText); return; }
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
        <ComposerButton className="sc-context-chip" icon="Laptop" iconSize={16} label={t("Local environment")}
          tooltip={{ content: "Where DeepSeek runs", ...ENV_TOOLTIP }} onClick={open("local")}
          {...menuTriggerProps({ open: menuKind === "local", onOpen: (entry, event) => onMenu("local", event.currentTarget, undefined, entry) })}>{t("Local")}</ComposerButton>
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
            <ComposerButton className="sc-branch-chip" icon="GitBranch" iconSize={16} label={t("Branch")}
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
                <span id={worktreeLabelId}>{t("worktree")}</span>
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
            {onRemoveFolder && <button type="button" aria-label={t("Remove {name}", { name: basename(path) })}
              disabled={running || sending} onClick={() => onRemoveFolder(path)}>
              <Icon name="X" size={12} />
            </button>}
          </span>
        ))}
        {/* :22076-22093: ko{content 'Add another folder', hoverable:false, collisionPadding}. */}
        {workdir && onAddFolder && <ComposerButton className="sc-context-chip sc-add-folder" label={t("Add another folder")} icon="FolderPlus" iconSize={16}
          tooltip={{ content: "Add another folder", ...ENV_TOOLTIP }} onClick={onAddFolder} />}
      </div>}
      {beforeComposer}
      {!warning && blockedSubmit && connectingHint && (
        <div className="sc-warning-row" role="status" data-tone="info" data-pet={showPet || undefined}>
          <span className="sc-warning-text">{connectingHint}</span>
        </div>
      )}
      {warning && (
        // The Home pet (.sc-pet, 80px, right-anchored) rises over this row: data-pet reserves its width so the
        // right-aligned Retry stays visible and clickable.
        <div className="sc-warning-row" role="status" data-cds-composer-warning="" data-pet={showPet || undefined}>
          <span className="sc-warning-text">{warning}</span>
          {onReconnect && <button type="button" className="sc-warning-action" onClick={onReconnect}>{reconnectLabel || t("Retry")}</button>}
        </div>
      )}
      {(workflowKeyword || ultracode) && !warning && (
        // Claude Code's prompt-input notices: the keyword's (30s there, while it's in the draft here) and ultracode's status.
        <div className="sc-warning-row sc-workflow-notice" role="status" data-tone="workflow" data-pet={showPet || undefined} data-workflow-notice={workflowKeyword ? (workflowKeyword.ignored ? "ignored" : "keyword") : "ultracode"}>
          <span className="sc-warning-text">{workflowKeyword
            ? (workflowKeyword.ignored ? t("Ultracode keyword ignored for this prompt · ⌥W to undo") : t("Dynamic workflow requested for this turn · ⌥W to ignore"))
            : <><span className="sc-ultracode-word">{t("ultracode")}</span>{" · "}{t("xhigh effort + dynamic workflows for maximum thoroughness")}</>}</span>
        </div>
      )}
      {composerNotice && (
        // Qt.addError (c099c328d :10795): a send the composer refuses says why above the card until the next edit.
        <div role="alert" className="inline-error sc-composer-notice" data-composer-notice="">
          <span>{composerNotice}</span>
          <ComposerButton icon="X" label={t("Dismiss error")} tooltip={{ content: "Dismiss error" }} onClick={() => setComposerNotice(null)} />
        </div>
      )}
      {showPet && <SourcePet />}
      <form ref={card} className="composer sc-composer epitaxy-prompt" data-cds-shell=""
        data-cds="ChatComposer" data-busy={running || sending || undefined} data-disabled={disabled || undefined}
        data-drag-over={dragOver || undefined} data-bash-mode={bashMode || undefined}
        onDragOver={(event) => { if (acceptsFiles && event.dataTransfer?.types?.includes("Files")) { event.preventDefault(); setDragOver(true); } }}
        onDragLeave={() => setDragOver(false)} onDrop={drop}
        onSubmit={(event) => { event.preventDefault(); submit(running ? "next" : undefined); }}>
        {showCommands && <SourceSlashMenu commands={suggestions} selected={selected} onSelect={chooseCommand} onHover={setCommandIndex} id={commandId} query={query||''} caret={commandCaret} editorRef={editor} onDismiss={()=>setDismissed(true)} preSession={!commandContext.current}/>}
        {showCommands&&query===''&&<SlashHint editorRef={editor} getCaret={caretViewportRect} caret={hintCaret} text={t("Type to filter")}/>}
        {/* Em :8928-8966: sr-only live statuses next to the card — bash mode (while the core has it), then the history
            search or the History strip. */}
        {bashAvailable && <span className="sc-sr-only" role="status" data-bash-status="">{bashMode ? t("Bash mode. Press Escape to return to chat.") : t("Chat mode")}</span>}
        <span className="sc-sr-only" role="status" data-history-status="">{search ? historySearchStatus(search, t) : promptHistoryStatus(historyNav)}</span>
        <div className="sc-surface">
          {/* Nn.Header (:9021-9025): the 'bash' pro badge, then the history hint (wm: search or History strip). */}
          {(bashMode || search || historyNav) && <div className="sc-history-header-grid">
            <div className="sc-history-header-clip">
              <div className="sc-history-header" data-cds="ChatComposerHeader" aria-hidden="true">
                {bashMode && <span className="sc-bash-badge" data-cds="Badge" data-variant="pro" data-size="sm" title={t("Run as a shell command")}>{t("bash")}</span>}
                {search ? <>
                  <span className="sc-history-search-label" data-failed={search.failed || undefined}>{t("Search history:")}</span>
                  <span className="sc-history-search-query">{search.query}<span className="sc-history-search-caret">{"▎"}</span></span>
                  <span className="sc-history-search-hints" aria-hidden="true" data-shown={search.showHints || undefined}>
                    <kbd data-cds="Kbd" className="scds-key scds-key-square sc-history-kbd">↑</kbd>
                    <kbd data-cds="Kbd" className="scds-key scds-key-square sc-history-kbd">↓</kbd>
                    {t("cycle")}
                    <span aria-hidden="true">·</span>
                    <kbd data-cds="Kbd" className="scds-key sc-history-kbd">esc</kbd>
                    {t("cancel")}
                  </span>
                </> : historyNav ? <>
                  <span className="sc-history-count">{t("History {index}/{total}", { index: historyNav.index, total: historyNav.total })}</span>
                  {historyNav.hasDraft && <>
                    <span aria-hidden="true">·</span>
                    <span className="sc-history-draft"><kbd data-cds="Kbd" className="scds-key scds-key-square sc-history-kbd">↓</kbd> {t("to restore your draft")}</span>
                  </>}
                </> : null}
              </div>
            </div>
          </div>}
          <SourceComposerAttachments entries={attachments} onRemove={onRemoveAttachment} onOpenFile={onOpenAttachmentFile} disabled={sending} />
          <div className="sc-input-row">
            <SourceComposerEditor className="sc-input epitaxy-prompt-input" data-cds="ChatComposerEditor"
              inputRef={assignEditor} scope={commandScope} aria-label={t("Message DeepSeek")} rows={1} disabled={disabled}
              keywordHighlight={!!workflowKeyword && !workflowKeyword.ignored}
              mentions={mentions} chips={chipCatalog} mentionActions={mentionActions}
              aria-autocomplete="list" aria-controls={showCommands ? commandId : undefined} aria-expanded={showCommands || mentionOpen || emojiOpen} aria-activedescendant={showCommands && suggestions[selected] ? `${commandId}-${selected}` : undefined}
              // :8988 `placeholder: H ? "" : je`: a shown suggestion clears the placeholder (the ghost overlay below draws
              // it); bash mode reads 'Enter a shell command' (:10463-10468).
              placeholder={showSuggestion ? "" : bashMode ? t("Enter a shell command") : placeholder ?? composerPlaceholder({ mode })}
              onBlur={() => { setCommandFocus(false); setMention(null); setEmoji(null); }} onFocus={() => setCommandFocus(true)}
              // Bash mode: the editor holds the command, the draft keeps the leading '!' for the send path.
              value={editorText} onChange={(event) => { setDraft(bashModeRef.current ? `!${event.target.value}` : event.target.value); if (mentionDismissed !== null) setMentionDismissed(null); requestAnimationFrame(() => { updateMention(); updateEmoji(); }); }}
              onSelect={() => { if (mentionRef.current) updateMention(); if (emojiRef.current) updateEmoji(); }}
              onClick={() => { updateMention(); updateEmoji(); }} onKeyUp={(event) => { if (["ArrowLeft", "ArrowRight"].includes(event.key)) { updateMention(); updateEmoji(); } }}
              emoticons={!bashMode}
              onPaste={paste} onKeyDown={keyDown} />
            {/* Nn.Overlay (:9031-9039): the suggested prompt alone, 'truncate text-muted', aria-hidden. */}
            {showSuggestion && <div className="sc-suggestion-ghost" aria-hidden="true" data-prompt-suggestion-ghost="">{suggestion}</div>}
            {/* c099c328d A(sm,{showStop:Ki,stop,send}): both controls share one grid cell and crossfade. */}
            <SubmitCrossfade showStop={showStop}
              stop={
                // c099c328d stop: hn{content 'Stop', shortcut Vt?void 0:'escape', hoverable:!1, lazy, open Ki?void 0:!1}
                // around Ut{ghost iconOnly icon Ih, aria-keyshortcuts Vt?void 0:nn('escape') → 'Escape', className jh}.
                // Vt (Escape claimed elsewhere) ↔ local menuKind or escapeClaimed. Accessible name stays 'Stop response' (HANDOFF 0.2.112).
                <SourceTooltip content={t("Stop")} shortcut={menuKind || escapeClaimed ? undefined : "escape"} hoverable={false} open={menuKind || !showStop ? false : undefined}>
                  <div className="sc-submit-slot">
                    <ComposerButton className="sc-submit" label={t("Stop response")} tooltip={false} icon="Stop"
                      aria-keyshortcuts={menuKind || escapeClaimed ? undefined : "Escape"} onClick={() => onStop?.({ trigger: "button" })}
                      onMouseDown={(event) => event.preventDefault()} />
                  </div>
                </SourceTooltip>
              }
              send={
                // c099c328d ga: Ut{ghost iconOnly icon Nh (ArrowReturn sm text-secondary group-disabled/btn:text-disabled),
                // aria-keyshortcuts nn('enter') → 'Enter', busy/busyLabel 'Sending', className `${jh} ${Fh}`};
                // send tooltip open:!Ki&&void 0 → closed while Stop is the active control.
                <SourceTooltip content={t("Send")} shortcut="enter" open={menuKind || showStop ? false : undefined}
                  // c099c328d :8870-8895: the second row is 'Queue for later' while busy, else 'Send and stay here' (de) on the
                  // Home draft. No ⌘⌥⏎ fork row (q): thread/fork is unsupported on the DeepSeek core.
                  secondaryHint={stopAvailable && queueEnabled ? { label: t("Queue for later"), shortcut: "cmd+enter" }
                    : stayOnDraft && !running ? { label: t("Send and stay here"), shortcut: "cmd+enter" } : undefined}>
                  <div className="sc-submit-slot">
                    <button className="sc-button sc-icon-button sc-submit" data-cds="Button" type="submit"
                      aria-label={t("Send message")} aria-keyshortcuts="Enter" disabled={!canSend} aria-busy={sending || undefined}
                      onMouseDown={(event) => event.preventDefault()}>
                      {sending ? <><span className="sc-spinner" aria-hidden="true" /><span className="sc-sr-only">{t("Sending")}</span></> : <Icon name="ArrowReturn" size={16} />}
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
      {emojiOpen && !mentionOpen && <SourceEmojiDropdown options={emoji.options} highlighted={emoji.highlighted} caret={emoji.caret}
        onSelect={acceptEmoji} onHover={(index) => setEmoji((current) => (current ? { ...current, highlighted: index } : current))}
        onClose={() => setEmoji(null)} />}
      <div className="composer-footer sc-chin" data-cds="ChatComposerChin" data-size="xs">
        <div className="sc-chin-leading">
          <ComposerButton className="sc-add" label={t("Add")} icon="Add" onClick={open("add")} disabled={sending}
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
          {/* Chat mode (title-bar switch) runs every turn read-only whatever the permission chip says: the chin names it,
              and a click goes back to Code. */}
          {mode === "chat" && <ComposerButton className="sc-chat-mode" icon="Chat" label={t("Chat (read-only)")} onClick={onCodeMode} disabled={!onCodeMode}
            data-chat-mode="" tooltip={{ content: "Switch to Code", detail: t("In Chat mode, {assistant} can’t edit files or run commands.", { assistant: getAssistantName() }) }}>
            <span>{t("Chat (read-only)")}</span></ComposerButton>}
          <ComposerButton className="sc-permission" label={t("Permission mode")} onClick={open("permission")}
            {...menuTriggerProps({ open: permissionOpen, onOpen: (entry, event) => onMenu("permission", event.currentTarget, undefined, entry), disabled: sending || permission == null })}
            tooltip={modeTooltip({ permission, menuKind })}
            // permission null: the saved mode hasn't loaded yet (startup), so the chip names no mode rather than a wrong one.
            disabled={sending || permission == null} aria-busy={permission == null || undefined}>
            {/* cf6ae6197 `ht = triggerLabel ?? label`: the full item label. */}{permission == null ? t("Mode") : permissionLabel(permission)}</ComposerButton>
        </div>
        <div className="sc-chin-trailing">
          {/* shared-14 kS: while the catalog loads the trigger is disabled and shows a
              spinner with the loading label; an empty catalog shows the empty label. */}
          {/* shared-14 :7160-7226: the Model pill has no tooltip unless a warning exists (none locally) → tooltip={false}. */}
          <ComposerButton className="sc-model-trigger" label={t("Model")} onClick={open("model")} tooltip={false}
            {...menuTriggerProps({ open: modelOpen, onOpen: (entry, event) => onMenu("model", event.currentTarget, undefined, entry), disabled: sending || !model || modelsLoading })}
            disabled={sending || !model || modelsLoading} aria-busy={modelsLoading || undefined}>
            {modelsLoading
              ? <><span className="sc-spinner" aria-hidden="true" /><span>{t("Loading models…")}</span></>
              : <span>{model?.displayName || model?.model || t("Default model")}{fastMode && <span className="sc-fast-label"> {speedLabel || t("Fast")}</span>}</span>}
          </ComposerButton>
          {/* c8e04f916 (prettier :236-262): the effort trigger sits in f{content: effortLabel, detail: warning text
              (only for a warning badge — none locally), open: !popoverOpen && undefined}; its accessible name is
              effortSelectorTrigger 'Effort: {name}'. The source renders the chip text plainly (effort.js:255); the
              purple top tier (ultra) borrows the shared-14 :6565 menu-row 'text-pro font-medium' here on request. */}
          {effort && <ComposerButton className="sc-effort-trigger" label={t("Effort: {name}", { name: effortLabel })} aria-haspopup="dialog" aria-expanded={menuKind === "effort"}
            data-top-tier={!noEffortLevels && isTopTierEffort(effort) ? "" : undefined}
            tooltip={{content:"Effort", open:menuKind === "effort" ? false : undefined}}
            disabled={sending || !effortAvailable} onClick={open("effort")}>{effortChip}</ComposerButton>}
          {/* c360a9e1c _d: ghost iconOnly Button (tooltip:false) with icon Xr ring, wrapped in
              Zt {content: ge, detail: xe, open: popover open ? false : undefined}. */}
          <ComposerButton className="sc-usage-trigger" label={usageCopy.ariaLabel} icon={<ContextRing pct={usageCopy.ringPct} />} onClick={open("usage")}
            aria-haspopup="dialog" aria-expanded={menuKind === "usage"}
            tooltip={{content:usageCopy.tooltip, detail:usageCopy.detail ?? undefined, open:menuKind ? false : undefined}} />
          {/* c360a9e1c :4840-4848 + :4972-4980: sr-only role=status live region (ze, last in the trailing Ve after the usage trigger) 'Fast mode on'/'Fast mode off'.
              The source renders it unconditionally; here it is rendered only when the model has a Fast tier
              (no fast state exists otherwise). */}
          {fastAvailable && <span role="status" aria-live="polite" className="sr-only">{fastMode ? (speedLabel && speedLabel.toLowerCase() !== "fast" ? t("{speed} speed on", { speed: speedLabel }) : t("Fast mode on")) : t("Fast mode off")}</span>}
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
        <SourceMenu.GroupLabel>{t("Recent")}</SourceMenu.GroupLabel>
        {rows.map((row) => <RecentFolderItem key={row.path} row={row} onSelect={onSelect} onDismiss={onDismiss} />)}
      </SourceMenu.Group>
      <SourceMenu.Separator />
    </>}
    <SourceMenu.Item onClick={() => onBrowse?.()}>{t("Open folder…")}</SourceMenu.Item>
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
        <span data-dismiss-recent="" aria-hidden="true" title={t("Remove from recent")} className="sc-recent-dismiss"><Icon name="X" size={12} /></span>
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
// plan {configured, preset, onChange} (a core with its own Plan reasoning: Codex's plan_mode_reasoning_effort): a
// 'Plan mode' choice under the slider, since Plan never uses the everyday effort there. '' is the core's default.
export function SourceEffortPopover({ anchor, levels, value, onChange, onClose, plan = null }) {
  const popup = useRef(null);
  const planLevels = (levels || []).map((level) => (typeof level === "string" ? level : level?.reasoningEffort ?? level?.id)).filter(Boolean);
  return (
    <SourcePopover anchor={anchor} side="top" align="end" dataCds="ModelSelectorEffort" className="sc-effort-popover" label={t("Effort")}
      onClose={onClose} initialFocus={(type) => type === "keyboard" ? popup.current?.querySelector('input[type="range"]:not(:disabled)') : null}>
      <EffortControl levels={levels} value={value} onChange={onChange} rootRef={popup} />
      {plan && planLevels.length > 0 && <div className="sc-effort-plan" data-effort-plan="">
        <span className="sc-effort-plan-label">{t("Plan mode")}</span>
        <SourceSelect label={t("Plan mode effort")} align="end" className="sc-effort-plan-select" value={plan.configured ?? ""} disabled={plan.saving}
          items={[{ value: "", label: plan.preset ? t("Default ({effort})", { effort: effortName(plan.preset, levels) }) : t("Default") },
            ...planLevels.map((level) => ({ value: level, label: effortName(level, levels) }))]}
          onChange={(next) => plan.onChange(next || null)} />
      </div>}
    </SourcePopover>
  );
}

// c360a9e1c-GPs-MV9u.js:4240-4285 vd: Qt.Popup side top, align end, sideOffset 8, padding none, 'epitaxy-root
// break-words w-[360px] max-w-[calc(100vw-2rem)] max-h-[min(var(--available-height),640px)]', an sr-only
// Title 'Usage', then 'flex flex-col py-sm' around the yc panel. initialFocus n: keyboard → the default
// (first tabbable), a pointer → the popup.
export function SourceUsagePopover({ anchor, usage, fresh = false, plan = null, onViewUsage, onSeeDetails, onCompact, compactState, onClose }) {
  return (
    <SourcePopover anchor={anchor} side="top" align="end" sideOffset={8} padding="none" className="epitaxy-root sc-usage-popover" label={t("Usage")}
      onClose={onClose} initialFocus={(type) => type === "keyboard" || null}>
      <SourcePopoverTitle className="sp-sr-only">{t("Usage")}</SourcePopoverTitle>
      <div className="sc-usage-body"><SourceUsagePanel usage={usage} fresh={fresh} plan={plan} onViewUsage={onViewUsage} onSeeDetails={onSeeDetails} onCompact={onCompact} compactState={compactState} /></div>
    </SourcePopover>
  );
}

// c2d611398-m3q28S31.js I/V/L/z (the yc panel) with the local data: the context section (V) when hd's ie holds
// (a tokenUsage report, or no session yet), with no fetched breakdown, so its header is a disabled button
// without a caret over a 4px bar (chart-reference tint track, the dT threshold fill); then, for an open
// session, the separator and the 'See detailed breakdown' row (z, a Popover.Close) that opens /status.
// Plan-limit windows come from the core's account/rateLimits/read (UsagePlanSection); the noData copy and the
// stale/engine notices have no local data (or branch) and stay absent.
// The compact action (gd → Ga/Tw, only with an onCompact: hd oe) is the H row after the bar.
export function SourceUsagePanel({ usage, fresh = false, plan = null, onViewUsage, onSeeDetails, onCompact, compactState }) {
  const panel = usagePanelCopy(usage, { fresh });
  const planShown = !!plan && (plan.windows.length > 0 || !!plan.credit || !!plan.spend);
  const compact = onCompact ? compactAction({ contextPct: panel.contextPct, ...compactState }) : { kind: "hidden" };
  return <>
    {panel.contextMode && <div className="sc-usage-context">
      <button type="button" className="sc-usage-row sc-usage-context-header" disabled>
        <span className="sc-usage-muted">{t("Context window")}</span>
        <span className="sc-usage-muted sc-usage-summary">{panel.summary}</span>
      </button>
      <div className="sc-usage-context-body">
        <div className="sc-usage-bar" role="progressbar" aria-valuenow={panel.contextPct ?? undefined}
          aria-valuetext={panel.contextPct === null ? panel.summary : undefined} aria-valuemin={0} aria-valuemax={100}>
          {panel.contextPct !== null && <div className="sc-usage-bar-fill" style={{ width: `${panel.contextPct}%`, background: contextRingStroke(panel.contextPct) }} />}
        </div>
      </div>
      {compact.kind !== "hidden" && <UsageCompactRow onCompact={onCompact} disabledReason={compact.reason} autoPct={compactState?.autoCompactPct ?? null} />}
      {/* A core that records this session's spend (thread/tokenUsage codeDesktop.costUsd: OpenCode, MiMo). */}
      {Number.isFinite(usage?.codeDesktop?.costUsd) && <div className="sc-usage-row sc-usage-cost" data-session-cost="">
        <span className="sc-usage-muted">{t("Spent this session")}</span>
        <span className="sc-usage-muted sc-usage-summary">{new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: usage.codeDesktop.costUsd < 1 ? 4 : 2 }).format(usage.codeDesktop.costUsd)}</span>
      </div>}
    </div>}
    {planShown && <>
      {panel.contextMode && <div className="sc-usage-separator" aria-hidden="true" />}
      <UsagePlanSection plan={plan} onViewUsage={onViewUsage} />
    </>}
    {onSeeDetails && <>
      {(panel.contextMode || planShown) && <div className="sc-usage-separator" aria-hidden="true" />}
      <SourcePopoverClose className="sc-usage-row sc-usage-link" onClick={onSeeDetails}>{t("See detailed breakdown")}</SourcePopoverClose>
    </>}
  </>;
}

// c2d611398 A/N/M: the plan section. Header 'Plan usage limits · {plan}' (text-footnote text-muted) with the
// ArrowRight link 'View usage in Settings'; each window a label, its reset countdown and percent over a 4px bar in the
// threshold fill; then the credits line (M: 'Usage credits' and its value, a bar for a monthly credit limit).
function UsagePlanSection({ plan, onViewUsage }) {
  const prefix = useId();
  const bar = (percent, labelId) => <div className="sc-usage-plan-bar" role="progressbar" aria-labelledby={labelId} aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
    <div className="sc-usage-plan-fill" style={{ width: `${percent}%`, background: contextRingStroke(percent) }} /></div>;
  return (
    <div className="sc-usage-plan">
      <div className="sc-usage-plan-header">
        <span className="sc-usage-muted">{plan.plan ? `${t("Plan usage limits")} · ${plan.plan}` : t("Plan usage limits")}</span>
        {onViewUsage && <SourcePopoverClose className="sc-usage-plan-link" aria-label={t("View usage in Settings")} onClick={onViewUsage}><Icon name="ArrowRight" size={12} /></SourcePopoverClose>}
      </div>
      <div className="sc-usage-plan-rows">
        {plan.windows.map((row) => {
          const labelId = `${prefix}-${row.key}`, reset = usageResetCountdown(row.resetsAt, row.minutes, { locale: getLocale() });
          return <div className="sc-usage-plan-row" key={row.key} data-variant={row.variant}>
            <div className="sc-usage-plan-line"><span id={labelId} className="sc-usage-plan-label">{row.label}</span>
              <span className="sc-usage-plan-meta">{reset && <span>{reset}</span>}<span>{`${Math.round(row.used)}%`}</span></span></div>
            {bar(row.used, labelId)}
          </div>;
        })}
        {(plan.credit || plan.spend) && <div className="sc-usage-plan-row" data-credits="">
          <div className="sc-usage-plan-line"><span id={`${prefix}-credits`} className="sc-usage-plan-label">{t("Usage credits")}</span>
            <span className="sc-usage-plan-meta">{plan.spend ? plan.spend.detail : plan.credit.balance}</span></div>
          {plan.spend?.percent != null && bar(plan.spend.percent, `${prefix}-credits`)}
          {plan.spend && plan.credit && <span className="sc-usage-plan-note">{plan.credit.balance}</span>}
        </div>}
      </div>
    </div>
  );
}

// c2d611398 H: 'px-lg pb-xs flex items-center gap-sm min-h-[20px] text-footnote' holding the hint span ('flex-1
// min-w-0 truncate text-secondary'; the 'Compacts automatically at {pct}%' copy needs the core's threshold, unknown
// here, so it stays empty) and, inside the eo disabled-reason tooltip, the CDS TextLink (xo, 'shrink-0
// whitespace-nowrap') 'Compact session' (ce660512f compactSession), disabled with the Ow reason.
function UsageCompactRow({ onCompact, disabledReason, autoPct = null }) {
  const disabled = disabledReason !== undefined;
  return (
    <div className="sc-usage-compact-row">
      <span className="sc-usage-compact-hint">{Number.isFinite(autoPct) ? t("Compacts automatically at {pct}%", { pct: autoPct }) : null}</span>
      <SourceTooltip disabledReason={disabledReason}>
        <button type="button" data-cds="TextLink" className="sc-usage-compact" disabled={disabled} data-disabled={disabled || undefined}
          onClick={() => { if (!disabled) onCompact?.(); }}>{t("Compact session")}</button>
      </SourceTooltip>
    </div>
  );
}

// c8e04f916 ee (scratch effort.js:21-112): the value label swaps on each index change (direction-aware
// translateY ±0.55em + fade, 0.2s easeOut) with a 4-layer glow (blur 0/0.5/1/2px, plus-lighter) whose opacity
// keyframes run over [0,.342,.563,1]; the outgoing label stays mounted (popLayout) while the blurriest layer
// rises and the wrapper slides out. No animation on first mount; reduced motion renders the plain label. The
// accent (purple top tier) is 'font-medium text-pro'. aria-hidden: the slider's aria-valuetext names the value.
function EffortValueSwap({ label, accent, index }) {
  const reduced = useReducedMotion();
  const [swap, setSwap] = useState({ index, direction: 1, seq: 0, label, accent, leaving: [] });
  let view = swap;
  if (swap.index !== index) {
    view = { index, direction: index > swap.index ? 1 : -1, seq: swap.seq + 1, label, accent,
      leaving: [...swap.leaving, { seq: swap.seq, label: swap.label, accent: swap.accent }].slice(-3) };
    setSwap(view);
  } else if (swap.label !== label || swap.accent !== accent) {
    view = { ...swap, label, accent };
    setSwap(view);
  }
  const drop = (seq) => setSwap((current) => ({ ...current, leaving: current.leaving.filter((entry) => entry.seq !== seq) }));
  // animationend can be skipped (hidden window, motion switched off mid-swap): never keep a leaving label past 250ms.
  useEffect(() => {
    if (!view.leaving.length) return;
    const timer = setTimeout(() => setSwap((current) => current.leaving.length ? { ...current, leaving: [] } : current), 250);
    return () => clearTimeout(timer);
  }, [view.leaving]);
  if (reduced) return <span className="sc-effort-value" aria-hidden="true"><span className="sc-effort-plain" data-accent={accent ? "" : undefined}>{label}</span></span>;
  const layers = (text) => ["0", "0.5", "1", "2"].map((radius) => <span key={radius} className="sc-effort-glow" data-r={radius}>{text}</span>);
  return (
    <span className="sc-effort-value" aria-hidden="true">
      {view.leaving.map((entry) => <span key={entry.seq} className="sc-effort-swap" data-leaving="" data-accent={entry.accent ? "" : undefined}
        style={{ "--sc-dir": view.direction }} onAnimationEnd={(event) => { if (event.target === event.currentTarget) drop(entry.seq); }}>{layers(entry.label)}</span>)}
      <span key={view.seq} className="sc-effort-swap" data-animate={view.seq > 0 ? "" : undefined} data-accent={accent ? "" : undefined}
        style={{ "--sc-dir": view.direction }}>{layers(label)}</span>
    </span>
  );
}

// Hosted by SourceEffortPopover. A committed slider choice intentionally leaves it open.
// The options are the live Codex catalog, never a hard-coded Claude effort list.
export function EffortControl({ levels = [], value, onChange, disabled = false, rootRef }) {
  const options = levels.map((level) => typeof level === "string"
    ? { id: level, name: effortName(level, levels) }
    : { ...level, id: level.id || level.reasoningEffort, name: level.name || level.label || effortName(level.id || level.reasoningEffort, levels) });
  const active = Math.max(0, options.findIndex((option) => option.id === value));
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [help, setHelp] = useState(false);
  const pending = useRef(value);
  // Levels this control committed that have not come back as `value` yet (the home composer saves the preference
  // before its value changes): the slider holds the committed stop meanwhile, so a second quick key steps from it.
  const committed = useRef([]);
  const helpId = useId();
  useEffect(() => {
    const waiting = committed.current;
    // An echo of an earlier commit while a later one is still on its way leaves the held stop alone.
    if (waiting.includes(value) && waiting[waiting.length - 1] !== value) { waiting.splice(0, waiting.indexOf(value) + 1); return; }
    committed.current = [];
    pending.current = value;
    setPreview(null);
  }, [value]);
  const index = Math.min(preview ?? active, Math.max(0, options.length - 1));
  const selected = options[index];
  const maximum = Math.max(0, options.length - 1);
  const unavailable = disabled || options.length < 2;
  // Top tier (model-menu-model.mjs): the accent follows the PREVIEWED id (effort.js:150 ue); the lit overlay
  // mounts only when the last option is the tier (c360a9e1c:5257, `V && !S && D` effort.js:152) and lights at
  // the last stop (effort.js:153 atMax), so a level list without ultra (DeepSeek off…max) gets neither.
  const accent = isTopTierEffort(selected?.id);
  const showLit = !unavailable && hasTopTierEffort(options);
  const atMax = showLit && index === maximum;
  const commit = (nextIndex) => {
    setDragging(false);
    const next = options[Number(nextIndex)]?.id;
    if (unavailable || !next || next === pending.current) { if (!committed.current.length) setPreview(null); return; }
    pending.current = next;
    if (next !== value) { committed.current.push(next); setPreview(Number(nextIndex)); } else { committed.current = []; setPreview(null); }
    onChange(next);
  };

  return (
    <section ref={rootRef} className="sc-effort-control" aria-label={t("Effort settings")}>
      <div className="sc-effort-heading">
        {/* p.Title 'shrink-0 text-muted' names the popover dialog. */}
        <div className="sc-effort-title"><SourcePopoverTitle className="sc-effort-label">{t("Effort")}</SourcePopoverTitle><EffortValueSwap label={selected?.name || t("Unavailable")} accent={accent} index={index} /></div>
        {selected?.description && (
          <div className="sc-effort-help-wrap">
            <button className="sc-effort-help" aria-label={t("About effort")} type="button"
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
        <div className="sc-effort-scale" aria-hidden="true"><span>{t("Faster")}</span><span>{t("Smarter")}</span></div>
        <div className="sc-slider" data-cds="Slider" data-dragging={dragging || undefined} data-disabled={unavailable || undefined} data-at-max={atMax ? "" : undefined}
          style={{ "--sc-slider-position": maximum > 0 ? index / maximum : 0 }}>
          {/* c2d9b9a76 (scratch slider.js:218-247): the overlay rides inside the fill as span[data-slider-overlay]. */}
          <div className="sc-slider-track" aria-hidden="true"><div className="sc-slider-fill">
            {showLit && <span className="sc-slider-overlay" data-slider-overlay="" aria-hidden="true"><EffortLitOverlay lit={atMax} /></span>}
          </div></div>
          <div className="sc-slider-stops" aria-hidden="true">
            {options.map((option, stop) => <span key={option.id} data-slider-stop={stop} title={option.name} />)}
          </div>
          <div className="sc-slider-carriage" aria-hidden="true"><span className="sc-slider-handle" /></div>
          <input type="range" min={0} max={maximum} step={1} value={index} disabled={unavailable}
            aria-label={t("Effort")} aria-valuetext={selected?.name || t("Unavailable")}
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
