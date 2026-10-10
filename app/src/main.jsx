import { threadPermissionParams, turnPermissionParams, approvesPlan, afterPlanPermission, approvedPlanPermission, workflowAccess, planImplementationTurn, bypassAvailability as requirementsBypass } from '../electron/permission-policy.mjs';
import { SourceSuggestedTasks } from "./source-suggested-tasks.jsx";
import { carryApplies } from '../electron/bypass-carry.mjs';
import { useBypassPermission, SourceBypassDialog, bypassGuide } from './source-bypass-permission.jsx';
import {SourceToastProvider, useSourceToasts} from './source-toast.jsx';
import { reportActionError, sessionActionErrorKind, ACTION_ERROR_COPY, cleanErrorReason } from "./action-error-model.mjs";
import { saveConfirmedPreferences } from './preference-save.mjs';
import {WorkflowRow,WorkflowCard,WorkflowLaunch} from "./source-workflow.jsx";
import { resolveWorkflowSettings } from "../electron/prefs/workflow-settings.mjs";
import { ultracodeMatches } from "../electron/prefs/workflow-keyword.mjs";
import { withUltracodeLevel, coreEffort, durableEffort, isTopTierEffort as isUltracodeTier } from "./model-menu-model.mjs";
import {mergeWorkflow} from "./workflow-progress-model.mjs";
import {parseWorkflowLaunch} from "./workflow-launch-model.mjs";
import {isModelWorkflow,modelWorkflowRuns,withModelWorkflowRows,workflowTask,workflowKey} from "./model-workflow-model.mjs";
import {SourceBackgroundTasks} from "./source-background-tasks.jsx";
import {backgroundTasks,taskSections} from "./background-tasks-model.mjs";
import { SourceTasksPane } from "./source-agent.jsx";
import { agentView, subAgentMessageError } from "./agent-model.mjs";
import { ADD_TO_PROMPT_EVENT } from "./inline-comments.mjs";
import { groupFileTools, pathChoices } from "./file-tool-model.mjs";
import { messageItemText, quoteBlock } from "./transcript-context-menu-model.mjs";
import { absoluteDiffPath } from "./diff-file-header-model.mjs";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  SidebarSimple,
  ArrowLeft,
  ArrowRight,
  Plus,
  Code,
  ChatCircle,
  Folder,
  FolderOpen,
  CaretDown,
  CaretRight,
  ArrowUp,
  Stop,
  Check,
  Terminal,
  FileText,
  X,
  MagnifyingGlass,
  Gear,
  SquaresFour,
  Sun,
  Moon,
  Paperclip,
  ArrowClockwise,
  GitBranch,
  ShieldCheck,
  Copy,
  WarningCircle,
  Monitor,
  Files,
  Clock,
  SignIn,
  ArrowsOutSimple,
  DotsThree,
} from "./icons";
import { emptyState, reduce, userText, isItemStreaming, isSubAgentThread, ownerThreadId, hasLiveWork } from "./state";
import { loadThreadHistory, historyRoute, readParams as historyReadParams, resumeParams as historyResumeParams } from "./thread-history-model.mjs";
import { Icon } from "./icons";
import { ToolButton } from "./code-ui";
import "./style.css";
import { SIDEBAR_WIDTH, clampSidebarWidth, effectiveSidebarWidth, narrowViewportQuery, storedSidebarWidth, trafficLightSpacerWidth } from "./sidebar-width-model.mjs";
import { SourceGreeting, SourceStatsCard, useHomeStartedAt } from "./source-home";
import { SourceActionCenter, SourceActionCenterPlaceholder, useSessionsLimit } from "./source-action-center";
import { classifyAttention, sortAttention, landingClear as shapeLandingClear, sessionTimestampMs } from "./home-model.mjs";
import { normalizeSidebarPreferences, sessionArchived, sessionParentId, unreadOnTurnCompleted, withCoreSections } from "./sidebar-model.js";
import { SourceForkLineage, SourceForkMarker } from "./source-fork-lineage.jsx";
import { forkMarkersFor } from "./fork-marker-model.mjs";
import { requestCodexCustomEndpoint } from "./source-settings-models.jsx";
import { SourceSettings } from "./source-settings";
import { appearancePreferences, fastTierForModel, savedPermission, savedSpeed, speedTiersForModel, tierForSpeed, STANDARD_SPEED } from "../electron/preferences.mjs";
import { SourceTitlebar, SourceCollapsedChrome, LocalReleaseNotes, LOCAL_RELEASE_NOTE_VERSIONS } from "./source-titlebar";
import { version as clientVersion } from "../package.json";
import { markSeenValue, readSeenVersion, whatsNewVisible, writeSeenVersion } from "./whats-new-model.mjs";
import { navAvailability } from "./source-nav-buttons";
import { SourceComposer, SourceEffortPopover, SourceUsagePopover, SourceRecentFolderMenu, SourceBranchPickerMenu } from "./source-composer";
import { recentFolders, recentFolderRows, folderPickerBrowsesDirectly } from "./recent-folders-model.mjs";
import { defaultBranch, sortBranches, branchSwitchPlan, checkedOutBranch, branchCheckoutTarget, WORKING_TREE_ERROR } from "./branch-picker-model.mjs";
import { SourceBranchSwitchDialog } from "./source-branch-switch-dialog.jsx";
import { gitRepoMenuItems, COMMIT_RESPONDING_REASON, pullRequestAction, CREATE_PR_TURN_TEXT, CREATE_DRAFT_PR_TURN_TEXT } from "./git-rail-model.mjs";
import { humanPrompts } from "./prompt-history-model.mjs";
import { composerPlaceholder } from "./composer-placeholder.mjs";
import { SourceQueuedMessages } from "./source-queued-messages";
import { stageFiles, markReady, markFailed, removeAttachment, attachmentInputs, isMaxImagesNotice, MAX_IMAGES_TIMEOUT, makeSnippet, addSnippet, snippetText, coreTakesFileMentions, modelAcceptsImages, skillChipInput, IMAGE_PROCESS_ERROR, basename as attachmentBasename, shownThread, shownUserItem, shownUserItems, shownTurns, shownQueueList, firstMessageName } from "./composer-attachments-model.mjs";
import { draftKey as sessionDraftKey, saveDraft, takeDraft, clearDraft, mapDraftAttachments, HOME_DRAFT_KEY, browserStorage, persistDraft, readPersistedDraft, forgetDraft } from "./composer-draft-store.mjs";
import { createCustomizeStore } from "./customize-store.mjs";
import { skillInvocable, skillMenuItems, pluginMenuGroups } from "./customize-model.mjs";
import { agentMentionText, mentionInputs } from "./mention-model.mjs";
import { emptyQueue, queueFromList, previewText, steerInputText, steerTextCount, submitLane, optimisticRemove, optimisticReorder, lockEntry, unlockEntry, editableDraft, isNotSteerable, lastDequeueable } from "./queued-messages-model.mjs";
import { rpcResult } from "./rpc-error.mjs";
import { SourceModelMenu } from "./source-model-menu";
import { SourceMenu } from "./source-menu";
import { SourceToolsMenu } from "./source-tools-menu.jsx";
import { SourceOnboarding } from "./source-onboarding.jsx";
import { SourceComputerUseBanner } from "./source-computer-use.jsx";
import { activeComputerUse } from "./computer-use-model.mjs";
import { defaultProfile, normalizeProfiles, normalizeSelection, toggleInSelection } from "../electron/prefs/tool-profiles.mjs";
import { SourcePermissionMenu, PERMISSION_OPTIONS, bypassOffer } from "./source-permission-menu";
import { SourceTileLayout } from "./source-tile-layout";
import { SourceSplitRoot, SourceSplitHost, splitStore, useSplitSides } from "./source-split-view.jsx";
import { sessionSplitItem, recordSessionSwitch, alternatingPartner, canSuggestSplit, splitSuggestionState, emptySplitSuggestion } from "./split-view-model.mjs";
// The split-view tip's shown / accepted / dismissed counts (per profile: the app's own storage).
const SPLIT_TIP_KEY = "epitaxy-split-suggestion";
import { SourcePaneControls, SourcePopoutControls } from "./source-pane-controls";
import { createTileLayoutStore, emptySessionEntry } from "./tile-layout-store.mjs";
import { CHAT_TILE_ID, PANE_KINDS, chatOnlyLayout, fromSpec, moveTileToEdge, openPane as openPaneInLayout, rememberPaneFlex, removeTile, tileIds } from "./tile-layout-model.mjs";
import { SourceTranscript } from "./source-transcript";
import { SourceFindBar } from "./source-find-bar.jsx";
import { SourceTranscriptStatus } from "./source-transcript-status.jsx";
import { SourceTurnFooter } from "./source-turn-footer.jsx";
import { userMessageActions } from "./message-actions-model.mjs";
import { acceptedSend, failedSend, pendingSend, pendingStillShown, pendingUserRow, retriedSend, withKnownItems } from "./pending-send-model.mjs";
import { SourceTurnError } from "./source-turn-error.jsx";
import { SourceForgeRepoContext } from "./source-forge-ref.jsx";
import { forgeRepoSlug } from "./response-link-model.mjs";
import { SourceTranscriptSkeleton, SourceTranscriptLoadFailure, SourceTranscriptEmpty } from "./source-transcript-states.jsx";
import { misalignmentStop, retryInput, turnErrorPlacements } from "./turn-error-model.mjs";
import { turnEdits, undoTurnText, fileChangesDiff } from "./turn-edits-model.mjs";
import { SourceTurnEdits } from "./source-turn-edits.jsx";
import { requestDiffReveal } from "./diff-reveal.mjs";
import { SourceRecapCard } from "./source-recap-card.jsx";
import { SourceTaskEvent } from "./source-task-event.jsx";
import { backgroundTaskEventsByTurn } from "./task-event-model.mjs";
import { ClaudeImportDialog } from "./source-claude-import.jsx";
import { SourceResumeDialog } from "./source-resume-dialog.jsx";
import { autoCompactPercent } from "./context-usage-model.mjs";
import { MCP_STATUS_LABELS, customizeCore } from "./customize-model.mjs";
import { SourceSwitch } from "./source-switch.jsx";
import { CodexFeedbackDialog } from "./source-codex-feedback.jsx";
import { retryingStatus } from "./transcript-status-model.mjs";
import { buildTurnCopyFooters } from "./turn-copy-model.mjs";
import { turnSecondsToMs } from "./relative-time-model.mjs";
import { useTurnFooterInteraction } from "./use-turn-footer-interaction.js";
import { createApprovalDraftRuntime, dismissQuestionPayload, visibleApprovals } from "./approval-draft-model.mjs";
import { createStopRequestTracker, stopRequestMatches } from "./stop-request-model.mjs";
import { WebLinkContext } from "./web-link-context.mjs";
import { previewLinksStore, webLinkRoute } from "./preview-links-model.mjs";
import { KeyboardShortcutsDialog, SlashHelp, RewindDialog, ReviewDialog, SessionStatusDialog, FeedbackShareDialog } from "./source-session-actions";
import { SourceDialog, SourceDialogFooter, useDialogRetention } from "./source-dialog.jsx";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { withLocalCommandRows, rewindChoices, transcriptMarkdown } from "./slash-actions-model.mjs";
import { withWorkflowToolRuns } from "./agent-tool-titles.mjs";
import { CodeBlockActionsContext, terminalCommandText } from "./code-block-actions.mjs";
import { workflowCommandRows } from "./saved-workflow-commands.mjs";
import { SourceUserText } from "./source-user-text";
import { sessionCommands, parseSessionCommand, commandUnavailable, unsupportedCommand, operationPending, planCommandAction, sideQuestionsSupported, workflowsSupported, workflowEngine, workflowEngineChoice, agentWorkflowPrompt, coreWorkflowCommand, matchCommands } from "./session-command-model.mjs";
import { bootEngine, coreEngine, partitionSessions } from "./session-engine-model.mjs";
import { sessionWork, shouldUnload } from "./session-unload-model.mjs";
import { accountIdentity, accountOrgLine, connectionMenuHeader, coreSignInPrompt } from "./account-label-model.mjs";
import { DEEPSEEK_KEYS_URL, accountMenuSignOut, usesCustomEndpoint } from "./account-settings-model.mjs";
import { signOutConfirmText } from "./settings-core-copy.mjs";
import { SourceGitStatus } from "./source-git-status";
import { useDiffScope } from "./source-diff-scope.jsx";
import { SourceSidebar, SourceSidebarMenu, SourceSidebarSessionMenu, SourceConfirmDialog, deleteConfirmCopy } from "./source-sidebar";
import { SourceMessage as Message, SourceApproval as Approval, SourceFilePanel as FilePanel, SourcePlanHandoffCard, sessionHasThinking, SourceMarkdown } from "./source-session";
import { CardComposerContext } from "./use-card-hotkeys.js";
import { pendingCommandItemIds } from "./command-row-model.mjs";
import { approvalItem, pendingElicitationItemIds, planHandoff } from "./approval-card-model.mjs";
import { setCodeThemes } from "./code-theme-store.mjs";
import codeThemeColors from "./generated/code-theme-colors.json";
import { fileListRoute, paneShortcut, paneShortcutKind } from "./pane-shortcuts.mjs";
import { SourceTerminalPane } from "./source-terminal-pane.jsx";
import { SourcePreviewPane, usePreviewActivity } from "./source-preview-pane.jsx";
import { isTerminalToggle, terminalError } from "./terminal-pane-model.mjs";
import { ownerKeyOf, terminalStore } from "./terminal-store.mjs";
import { CHIN_MENU_KINDS, chinKindOfMenu, chinShortcutCommand, modeMenuDigit, resolveChinRequest } from "./chin-shortcuts.mjs";
import { SHORTCUTS_DIALOG_KEYS, globalShortcutCommand, searchShortcutAction } from "./shortcuts-dialog-model.mjs";
import { promptJumpIndex } from "./transcript-feed-nav.mjs";
import { hasClosedSession, planReopen, popClosedSession, pushClosedSession } from "./closed-session-model.mjs";
import { createSessionCycler } from "./session-cycle-model.mjs";
import { effectiveView, nextTranscriptView, readSessionViews, withSessionView, writeSessionViews, transcriptViewMenu } from "./transcript-view-model.mjs";
import { reasoningPlacement } from "./reasoning-model.mjs";
import { initialAppearance, parseThemeCommand, resolveThemeMode, writeThemeMode, THEME_LABELS } from "./theme-command-model.mjs";
import { applyCustomTheme, themeDensity } from "./theme-custom-model.mjs";
import { withEffortDefaults } from "../electron/prefs/model-settings.mjs";
import { customCommandsStore } from "./custom-commands-store.mjs";
import { mergeCommands, expandCommand } from "./custom-commands-model.mjs";
import { normalizeCustomCommands } from "../electron/prefs/custom-commands.mjs";
import { setPersona } from "./persona-store.mjs";
import { SourceLanguagePicker } from "./source-language-picker.jsx";
import { SourceSideChat } from "./source-side-chat.jsx";
import { t, tn } from "../electron/i18n/index.mjs";
import { coreAssistant, coreById, coreForEngine, coreName, coreSupports, hasSignInOptions, registerCores } from "../electron/core-registry.mjs";
import { getAssistantName, getLocale } from "../electron/i18n/index.mjs";
import { backendBanner, bannerFallbackModel, composerUsageNotice, mergeRateLimits, planUsageSummary, usageLimitReset } from "./usage-model.mjs";
import { SourceSessionNotices, sessionNotices, UNTRUSTED_FOLDER_NOTICE } from "./source-session-notices.jsx";
import { SourceAutoReviews, autoReviewsFor } from "./source-auto-review.jsx";
import { deniedActionSummary, guardianDenialEvent } from "./auto-review-model.mjs";
import { shellModeActive, shellModeCommand, shellModeKind, shellOutputMessage } from "./shell-mode-model.mjs";
import { hooksReviewSummary, hooksView } from "./hooks-model.mjs";
import { localizeBridgeText } from "./bridge-text-model.mjs";
import { SourceGoalStrip } from "./source-goal-strip.jsx";
import { AsyncQuestionsContext } from "./source-async-questions.jsx";
import { settledQuestionIds } from "./async-questions-model.mjs";
import { goalCommandRequest, goalCommandResult, goalNeedsReplaceConfirmation, nativeGoalCommand, nativeInitCommand, INIT_PROMPT } from "./goal-model.mjs";
const api = window.desktop;
// index.html ships data-mode="system" (the loaded CSS resolves it through
// prefers-color-scheme, which nativeTheme.themeSource drives). Before the first
// render the root gets the resolved light/dark from the preload's synchronous
// appearance value, so React never starts from a light frame.
const bootAppearance = initialAppearance(api?.appearance, matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.dataset.mode = bootAppearance.mode;
// Per-session tile layout + file view (2.2553.1 panes store slices); one
// instance per renderer, persisted under localStorage "code-desktop-tiles".
const tileStore = createTileLayoutStore({ storage: (() => { try { return globalThis.localStorage ?? null; } catch { return null; } })() });
const EMPTY_TILE_ENTRY = emptySessionEntry();
const PANE_NAMES = { files: t("Files"), changes: t("Changes"), plan: t("Plan"), tasks: t("Background tasks"), terminal: t("Terminal"), preview: t("Preview") };
const baseTileLayout = (entry) => (entry?.expandedTile ? entry.baseLayout : entry?.tileLayout) ?? null;
// The home page (no session) keeps its own Files pane over the chosen folder
// (local behavior; the official home route has no side panes).
const HOME_TILE_KEY = "home";
const focusedPaneKind = () => {
  const kind = document.activeElement?.closest?.("[data-tile-id]")?.dataset.tileId;
  return PANE_KINDS.includes(kind) ? kind : null;
};
// Menu bar events the renderer acts on (app-menu.cjs: File New Session / Open Folder… / Close Pane,
// View pane items, Go Previous/Next Session and Search…, Help Keyboard Shortcuts).
const MENU_COMMANDS = new Set(["new-session", "new-session-current", "open-folder", "open-file", "toggle-pane", "close-pane", "close-session", "reopen-closed", "open-shortcuts", "cycle-session", "open-search"]);
// Xm (shared-19-CjdiaR4X.js): the sidebar's session row main buttons in order, alias rows skipped,
// starting from the open row (aria-current) or else a data-selected="focused" one.
function sidebarCycleRows() {
  const buttons = [...document.querySelectorAll(".source-sidebar .source-session-row:not([data-alias]) [data-row-main-button]")];
  let selectedIndex = buttons.findIndex((button) => button.getAttribute("aria-current") === "page");
  if (selectedIndex === -1) selectedIndex = buttons.findIndex((button) => button.closest(".source-session-row")?.getAttribute("data-selected") === "focused");
  return { buttons, selectedIndex };
}
const call = (action, p) =>
  api
    ? api.call(action, p)
    : Promise.reject(new Error(t("Open Code Desktop to connect to DeepSeek.")));
const rpc = (method, params = {}) => call("rpc", { method, params }).then(rpcResult);
// Skills / Connectors / Plugins catalog shared by the settings pages and the
// composer Add menu (loaded on demand, refreshed by skills/changed and the
// MCP startup / OAuth notifications).
const customizeStore = createCustomizeStore({ call });
// git-status-card.js:4967 commit mode sends this exact session text; the app
// itself never runs git commit.
const COMMIT_TURN_TEXT = "Commit the working tree changes with a sensible message.";
const GIT_STATUS_RESPONDING_INTERVAL = 10000;
// git-status-card.js cc (5590) / 4930-4960: the commit action is disabled while
// the session responds (git-rail-model COMMIT_RESPONDING_REASON, which names the running core's assistant) or when
// the working tree is clean (F12: Qe isWorkingTreeDirty, not the branch stats that keep the band visible).
const COMMIT_CLEAN_REASON = t("No changes to commit");
// git-status-card.js:4962-4977 xr: every Commit send failure is this danger toast.
const COMMIT_SEND_FAILED = t("Message couldn\u2019t be sent. Try again.");
// git-pr-slot.js:5834 im: a held snapshot of a revisited session is dropped after 6s.
const GIT_BAND_HOLD_MS = 6000;
// Worktree change signal for the Changes panel: only a real change in the
// tracked/untracked set (not a fresh poll object) re-reads the full diff. HEAD
// and the dirty flag are part of it: a commit leaves the branch diff unchanged
// but moves the uncommitted and commit scopes.
function gitChangeKey(status) {
  if (!status?.isRepo) return "";
  return JSON.stringify([status.cwd, status.diffBase, status.headSha, status.workingTreeDirty, status.hasChanges, status.added, status.removed, status.files, status.untrackedCount, status.binaryFiles,
    (status.fileDetails || []).map((file) => [file.path, file.oldPath, file.indexStatus, file.worktreeStatus, file.untracked, file.binary, file.added, file.removed])]);
}
function sameGitStatus(previous, next) {
  return !!previous && !!next && JSON.stringify(previous) === JSON.stringify(next);
}
// SourceMenu placement of the composer environment and chrome menus: env pill and lH folder picker
// (cc43287c9 :20975-21060, :21753-21760) side top / align start; the hT branch list (cd2687f9f N) top /
// start / sideOffset 8; the titlebar folder chip (c360a9e1c Fp :6800-6806) bottom / start; the sidebar
// footer's connection menu opens upward from its start edge.
const ENV_MENUS = Object.freeze({
  local: { side: "top", align: "start", label: "Local environment", className: "sc-env-menu" },
  "home-folder": { side: "top", align: "start", label: "Working directory" },
  branch: { side: "top", align: "start", sideOffset: 8, label: "Branch", className: "sc-branch-menu" },
  folder: { side: "bottom", align: "start", label: "Working directory" },
  connection: { side: "top", align: "start", label: "Connection settings" },
});
const shortDate = (s) =>
  s
    ? new Date(s * 1000).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : "";
function IconButton({
  label,
  children,
  onClick,
  disabled,
  className = "",
  ...props
}) {
  return (
    <button
      className={"icon-button " + className}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
// side: 0 is the window's primary App (sidebar, Settings, window-wide dialogs); 1 is the secondary split side
// (source-split-view.jsx), which opens `initialSession` (or a new session) once it is ready.
// Terminal focus requests are unique in this window: every SourceTerminalPane (both split sides) shares the last one
// it took (source-terminal-pane.jsx handledFocusRequest), so a per-App counter would collide between the sides.
let terminalFocusRequests = 0;
const nextTerminalFocusRequest = () => ++terminalFocusRequests;
// How long a finished session action's status strip stays (main.jsx operationTimers).
const OPERATION_DONE_MS = 5000;
function App({ side = 0, initialSession = null }) {
  const [state, dispatch] = useReducer(reduce, emptyState);
  // Split view: only the focused side takes window keys and menu commands; the window's split store routes the
  // sidebar, notifications and View › Split View to the right side (source-split-view.jsx, split-view-store.mjs).
  const splitView = useSplitSides(), splitActive = !splitView.open || splitView.active === side;
  const splitActiveRef = useRef(splitActive);
  splitActiveRef.current = splitActive;
  // Composer drafts are stored per session; the new-session page's draft is per side, so a split with the new-session
  // page on both sides never writes one side's unsent text over the other's.
  const homeDraftKey = side === 0 ? HOME_DRAFT_KEY : `${HOME_DRAFT_KEY}-split`;
  const draftKey = (sessionId) => (typeof sessionId === "string" && sessionId ? sessionDraftKey(sessionId) : homeDraftKey);
  // This side's workspace <main>: window-level key handlers find this side's composer chrome inside it, and
  // navigateRef / windowKeyRef reach this App's latest navigate and window keys from the split store.
  const mainRef = useRef(null), navigateRef = useRef(null), windowKeyRef = useRef(null);
  const scope = () => mainRef.current ?? document;
  const [, refreshStopRequests] = useReducer(value => value + 1, 0);
  const stopRequests = useRef(null), stopLive = useRef(null);
  if (!stopRequests.current) stopRequests.current = createStopRequestTracker(refreshStopRequests);
  const approvalRuntime = useRef(null);
  if (!approvalRuntime.current) approvalRuntime.current = createApprovalDraftRuntime();
  useLayoutEffect(() => {
    approvalRuntime.current.reconcile(state.approvals);
  }, [state.approvals]);
  useEffect(() => () => approvalRuntime.current.dispose(), []);
  const [boot, setBoot] = useState(null),
    [sessions, setSessionsState] = useState([]),
    // True once init has read the session list (official Kk/$i: the home
    // placeholder and the remembered shape follow the session query, not boot).
    [sessionsLoaded, setSessionsLoaded] = useState(false),
    sessionsLoadedRef = useRef(false),
    // The core whose sessions the list holds (coreEngine of the boot loadSessions read): a reconnect onto another core reloads it.
    sessionsCoreRef = useRef(null),
    // Remembered ids loadSessions kept out of the list: {otherEngine, missing}
    // counts (session-engine-model partitionSessions) for the sidebar notice.
    [hiddenSessions, setHiddenSessions] = useState(null),
    [current, setCurrent] = useState(null),
    [cwd, setCwd] = useState(""),
    [draft, setDraft] = useState(""),
    // Composer attachment entries (composer-attachments-model): images become
    // localImage parts, other files become real Codex mention references.
    [attachments, setAttachments] = useState([]),
    // "@" mentions inserted through the dropdown: {path (relative), name}.
    [mentions, setMentions] = useState([]),
    // Real Codex queue for the open session (thread/queue/list snapshot).
    [queue, setQueue] = useState(() => emptyQueue(null)),
    [additionalFolders, setAdditionalFolders] = useState([]),
    [sending, setSending] = useState(false),
    [error, setErrorText] = useState(""),
    [model, setModel] = useState(""),
    [effort, setEffort] = useState("medium"),
    // The "ultracode" keyword in the draft: alt+w ignores it for this prompt (Claude Code's chat:workflowKeywordToggle).
    [keywordIgnored, setKeywordIgnored] = useState(false),
    [mode, setMode] = useState("code"),
    [theme, setTheme] = useState(bootAppearance.theme),
    [collapsed, setCollapsed] = useState(false),
    [search, setSearch] = useState(""),
    [showSearch, setShowSearch] = useState(false),
    // Inline file-reference chips in user bubbles open the Files pane at a
    // path/line (2.2553.1 gy -> pane open); each click is a fresh request.
    [fileRequest, setFileRequest] = useState(null),
    // A Language change reloads the window with Settings › Preferences open again (source-settings.jsx REOPEN_SETTINGS).
    [splitTip, setSplitTip] = useState(null),
    [settings, setSettingsState] = useState(() => { if (side !== 0) return false; try { const page = globalThis.sessionStorage?.getItem("code-desktop:reopen-settings"); if (page) { globalThis.sessionStorage.removeItem("code-desktop:reopen-settings"); return page; } } catch { /* no storage */ } return false; }),
    [localPreferences, setLocalPreferences] = useState({}),
    // Per-session transcript view overrides (official transcriptModeBySession,
    // newest-last, capped at 100); undefined means "follow the default".
    [sessionViews, setSessionViews] = useState(() => readSessionViews(localStorage)),
    [speed, setSpeed] = useState(STANDARD_SPEED),
    [fastSaving, setFastSaving] = useState(false),
    [whatsNew, setWhatsNew] = useState(false),
    [languagePicker, setLanguagePicker] = useState(false),
    // /btw side chat (source-side-chat.jsx): open, and a question /btw passed to ask on open.
    [sideChat, setSideChat] = useState({ open: false, pending: null }),
    // The running core's own slash commands (capabilities.coreCommands: codeDesktop/commands/list rows).
    [coreCommands, setCoreCommands] = useState([]),
    // titlebar-release-notes.js:5063 P `[a,o]`: last client version whose notes
    // were opened, read once from localStorage (throws/empty read as "").
    [whatsNewSeen, setWhatsNewSeen] = useState(() => readSeenVersion((() => { try { return globalThis.localStorage ?? null; } catch { return null; } })())),
    [actionDialog, setActionDialog] = useState(null),
    [localCommandRows,setLocalCommandRows]=useState({}),
    [workflowRuns,setWorkflowRuns]=useState([]), [workflowLaunch,setWorkflowLaunch]=useState(null),
    [commandSuggestion,setCommandSuggestion]=useState(null),
    [loading, setLoading] = useState(false),
    // Last failed history load {id, message} (xu kind; approval-entry-current.js:4211-4217).
    [loadError, setLoadError] = useState(null),
    // Session whose turn/start was sent: T.starting (approval-entry-current.js:4222)
    // until its first row arrives; the reply lands before turn/started.
    [turnRequested, setTurnRequested] = useState(null),
    // The optimistic user messages per thread, in send order (pending-send-model.mjs): shown from Send until the core
    // echoes them, or kept as 'Not delivered' with Retry / Discard when turn/start is refused.
    [pendingSends, setPendingSends] = useState({}),
    // Messages steered into a running turn (turn/steer) that the transcript doesn't show yet, per thread: Codex lists
    // them above its composer until the model takes them (tui pending_input_preview.rs), and an interrupted turn hands
    // them back (input_restore.rs: the server discards pending input on interrupt).
    [pendingSteers, setPendingSteers] = useState({}),
    [promptSuggestions, setPromptSuggestions] = useState({}),
    // Plan → implement handoff (planHandoff below): threadId → the plan turn the user answered, and whether
    // "Implement" is starting its turn.
    [planHandoffAnswered, setPlanHandoffAnswered] = useState({}),
    [planHandoffBusy, setPlanHandoffBusy] = useState(false),
    [history, setHistory] = useState([null]),
    [historyAt, setHistoryAt] = useState(0),
    [rename, setRename] = useState(null),
    [menu, setMenu] = useState(null),
    // Add › Tools (prefs/tool-profiles.mjs): the core's tool list, and the New draft's turned-off tools
    // (undefined = the default profile's).
    [toolsCatalog, setToolsCatalog] = useState(null),
    // First-run setup (source-onboarding.jsx): null, or the step it opens on ('welcome' | 'connect').
    [onboarding, setOnboarding] = useState(null),
    [draftTools, setDraftTools] = useState(undefined),
    [section, setSection] = useState("new"),
    [sidebarWidth, setSidebarWidth] = useState(288),
    [fullScreen, setFullScreen] = useState(false),
    // Main window zoom factor (index.chunk-ChZ67Jhw.js dispatchZoomFactorChanged).
    [zoomFactor, setZoomFactor] = useState(1),
    // shared-2 sidebarFloor (Km.MIN until SourceSidebar measures its chrome).
    [sidebarFloor, setSidebarFloor] = useState(SIDEBAR_WIDTH.MIN),
    [displayName, setDisplayName] = useState(""),
    // Home stats card (official $O): undefined while the stats are pending (the
    // hold skeleton), null when the main process could not read them (no card),
    // else the original getCodeStats object (main.cjs 'stats').
    [statsSnapshot, setStatsSnapshot] = useState(undefined),
    // The core's last account/rateLimits/read (Codex plan limits, credits, resets) with its account/rateLimits/updated
    // merges, for the composer's usage ring and popover; cleared when the connection or account changes.
    [planLimits, setPlanLimits] = useState(null),
    [statsAttempts, setStatsAttempts] = useState(0),
    // Remembered Action Center shape (official Kk/$i) for the loading placeholder.
    [remembered, setRemembered] = useState(null),
    [sidebarPreferences, setSidebarPreferences] = useState({}),
    [sessionMetadata, setSessionMetadata] = useState({}),
    // Codex's built-in Pinned section id (sidebar snapshot), so a chat pinned in the Codex app reads as pinned here.
    [codexPinnedSection, setCodexPinnedSection] = useState(null),
    [customGroups, setCustomGroups] = useState([]),
    [pinnedOrder, setPinnedOrder] = useState([]),
    // Fidelity F08: persisted Folder/Custom section order (main.cjs sidebar-state "project-order"),
    // cwd -> repo identity for the Folder grouping (main.cjs "repo-identities"), and the collapsed
    // sidebar's hover peek (shared-2 store hovering/peeked + the trigger geometry for the card).
    [projectOrder, setProjectOrder] = useState([]),
    [repoIdentities, setRepoIdentities] = useState({}),
    [peek, setPeek] = useState({ hovering: false, peeked: false, top: 46, left: 6 }),
    [confirmDelete, setConfirmDelete] = useState(null),
    [permission, setPermission] = useState("auto"),
    // init() finished (or failed): until then `permission` is the placeholder default, not the saved mode.
    [initSettled, setInitSettled] = useState(false),
    [worktree, setWorktree] = useState(false),
    [workspaceInfo, setWorkspaceInfo] = useState(null),
    [gitStatus, setGitStatus] = useState(null),
    [gitDiff, setGitDiff] = useState(null),
    [gitStatusError, setGitStatusError] = useState(""),
    [gitDiffError, setGitDiffError] = useState(""),
    // F12: no commit-mode Dismiss (git-status-card 4666-4669, 5180-5181: dismiss needs a forge "no PR" answer).
    // Band hold (git-pr-slot.js:5861-5990 cm): the expired-hold session id, see bandHold below.
    [gitHoldExpired, setGitHoldExpired] = useState(null),
    [gitRefresh, setGitRefresh] = useState(0),
    // "Refresh" in the Changes settings menu (fh diff-refresh, panes-tile-current.js
    // :3715-3730 -> sl re-fetch) re-reads the diff even when the change key is unchanged.
    [diffRefresh, setDiffRefresh] = useState(0);
  // Every banner reason loses Electron's "Error invoking remote method 'desktop:call': Error:" transport wrapper
  // (cleanErrorReason) here, once, so no caught desktop:call rejection shows it.
  const setError = useCallback((value) => setErrorText(typeof value === "string" ? cleanErrorReason(value) : value), []);
  // Settings is window-wide: the secondary split side opens it in the primary side's App.
  const setSettings = side === 0 ? setSettingsState : (value) => { if (!splitStore.toPrimary("settings", value)) setSettingsState(value); };
  useEffect(() => splitStore.register(side, {
    navigate: (id) => navigateRef.current?.(id),
    focus: () => requestAnimationFrame(() => textarea.current?.focus()),
    ...(side === 0 ? { settings: (value) => { setMenu(null); setSettingsState(value); }, windowKey: (command) => windowKeyRef.current?.(command) } : {}),
  }), []);
  const switchHistory = useRef([]);
  const diffRefreshRequested = useRef(false);
  // With the opt-in on, the connected core's requirements (configRequirements/read) can still refuse
  // danger-full-access: a remembered or carried Bypass then reads as Auto there (main would reject every Bypass
  // turn anyway) and the Mode menu shows the managed refusal instead of the Bypass row.
  const bypassOptIn = boot?.config?.allowBypassPermissions === true;
  const [bypassRefusal, setBypassRefusal] = useState(null);
  useEffect(() => {
    if (!bypassOptIn || !boot?.connected) { setBypassRefusal(null); return; }
    let live = true;
    rpc("configRequirements/read").then((value) => { const availability = requirementsBypass(value); if (live) setBypassRefusal(availability.allowed === false ? availability : null); },
      () => { if (live) setBypassRefusal(null); });
    return () => { live = false; };
  }, [bypassOptIn, boot?.connected, state.approvalConnectionId, state.approvalConnectionEpoch]);
  const bypassMode = useBypassPermission({permission, enabled: bypassOptIn && !bypassRefusal, mode,
    sessionKey: current, cwd, connectionKey: JSON.stringify([boot?.connected, state.approvalConnectionId, state.approvalConnectionEpoch]),
    onChange: value => preference("permission", value)});
  const effectivePermission = bypassMode.permission;
  // The open session's own model and effort ({id, model, effort}): picked in it (sessionMetadata model/effort), else the
  // ones its core reports on resume. Settings and Home keep the default for new sessions; a saved preference never
  // replaces the open session's (applyConfirmedPreferences).
  const sessionModel = useRef(null);
  // Sessions in ultracode for this app run only ({id → level}): their metadata keeps the level under it
  // (durableEffort), so a restart reopens them without ultracode, as Claude Code does.
  const sessionUltracode = useRef(new Map());
  // Bypass carried by a user core switch (main.cjs bypassCarry, bound to this connection only): it applies once, and
  // only to the scope it was confirmed for (carryApplies: that session, or a draft in that folder); any other scope
  // drops it. Either way main forgets it, so a later reload of the window starts from the saved default again.
  const carriedBypass = useRef(null), coreSwitchReload = useRef(false); // see switchCore
  useEffect(() => {
    const carry = boot?.bypassCarry, id = carry?.connectionId;
    if (!boot?.connected || !id || id !== state.approvalConnectionId || carriedBypass.current === id || coreSwitchReload.current || !bypassMode.available) return;
    if (carryApplies(carry, { current, cwd }) && !bypassMode.carry()) return;
    carriedBypass.current = id;
    call("bypass-carry-clear").catch(() => {});
  }, [boot?.bypassCarry?.connectionId, boot?.connected, state.approvalConnectionId, state.approvalConnectionEpoch, bypassMode.available, current, cwd]);
  // The last mode chosen other than Plan: an approved DeepSeek plan continues with it.
  const afterPlan = useRef("auto");
  if (effectivePermission !== "plan") afterPlan.current = effectivePermission;
  // The ⌥⌘ session chords (shortcuts-dialog-model.mjs), from the mount-time key listener.
  const sessionChordRef = useRef(null);
  // An agent-made mode change (codeDesktop/thread/mode), from the mount-time event listener.
  const agentModeRef = useRef(null);
  agentModeRef.current = (value) => { if (value === "plan" && effectivePermission !== "plan" && mode === "code") bypassMode.select("plan"); };
  const actionLock = useRef(new Set());
  // Latest collapsed value and guarded toggle for the mount-time desktop event
  // listener (View > Hide/Show Sidebar arrives as {kind:"toggle-sidebar"}).
  const collapsedRef = useRef(false), toggleSidebarRef = useRef(null);
  // Narrow viewport (sidebar-width-model.mjs narrowViewportQuery = shared-2 Ym over the rendered width;
  // sidebar-main.js:15367-15372 d = Se(sl(r)) -> setIsNarrowViewport), re-subscribed when the width
  // changes. While it matches the frame is collapsed (shared-2 Dg) to the 'Show sidebar' trigger and the
  // peek card, without writing preferences.sidebarCollapsed; widening restores the stored state.
  const narrowQuery = narrowViewportQuery(effectiveSidebarWidth(sidebarWidth, sidebarFloor));
  const [narrowViewport, setNarrowViewport] = useState(() => typeof window.matchMedia === "function" && window.matchMedia(narrowQuery).matches);
  const narrowRef = useRef(narrowViewport);
  narrowRef.current = narrowViewport;
  useLayoutEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia(narrowQuery), sync = () => setNarrowViewport(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [narrowQuery]);
  // The secondary split side has no sidebar of its own, so it never draws the collapsed-sidebar chrome.
  const effectiveCollapsed = side === 0 && (collapsed || narrowViewport);
  // Reopen Closed Session (closed-session-model.mjs, shared-19 Wh): ids closed with ⌘W / File > Close Session.
  const [closedSessions, setClosedSessions] = useState([]);
  // Go > Back/Forward arrive as {kind:"navigate", delta} (app-menu.cjs, Cyr).
  const travelShortcutRef = useRef(null);
  const paneShortcutRef = useRef(null);
  const attachRef = useRef(null);
  // 'Open in' editors installed on this Mac (main.cjs installed-editors), read once; [] until then or on failure.
  const [editors, setEditors] = useState([]);
  useEffect(() => {
    let live = true;
    call("installed-editors").then((list) => { if (live && Array.isArray(list)) setEditors(list.filter((entry) => entry && typeof entry.type === "string" && typeof entry.name === "string")); }, () => {});
    return () => { live = false; };
  }, []);
  const openInEditor = (target, type) => call("open-in-editor", { path: target, type }).catch((e) => { if (toasts) toasts.add(e.message || t("Couldn’t open it in that editor."), { variant: "warning" }); else setError(e.message); });
  // ⌘⌥↑ / ⌘⌥↓: the transcript's previous or next user prompt (transcript-feed-nav.mjs promptJumpIndex) to the top.
  const jumpToPrompt = (direction) => {
    const content = transcriptRef.current?.getContent?.(), viewport = content?.parentElement;
    if (!content || !viewport) return;
    const prompts = [...content.querySelectorAll('[data-cds="UserMessage"]')].filter((element) => element.getClientRects().length > 0);
    const top = viewport.getBoundingClientRect().top;
    const index = promptJumpIndex(prompts.map((element) => element.getBoundingClientRect().top - top), direction);
    if (index < 0) return;
    transcriptRef.current?.release?.();
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    prompts[index].scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    const article = prompts[index].closest("[data-feed-article]") ?? prompts[index];
    if (article.tabIndex >= 0) article.focus({ preventScroll: true });
  };
  const fileTreeToggleRef = useRef(null);
  // R10 ⌘⇧Y on the Changes pane: its FilePane registers the Changed files column toggle here.
  const diffTreeToggleRef = useRef(null);
  // File / View / Go / Help menu commands for the renderer (app-menu.cjs) and Go > Search… / ⇧⌘K.
  const menuCommandRef = useRef(null), openSearchRef = useRef(null);
  // Km (session-cycle-model.mjs) over the sidebar's session rows; persists across renders so a held
  // modifier keeps its sequence.
  const sessionCycler = useRef(null);
  if (!sessionCycler.current) sessionCycler.current = createSessionCycler({
    rows: sidebarCycleRows,
    open: (button) => { button.scrollIntoView({ block: "nearest" }); button.click(); },
    home: () => menuCommandRef.current?.({ kind: "new-session" }),
  });
  const commitLock = useRef(false);
  const preferenceRevision = useRef(0);
  const transcriptRef = useRef(null),
    // R09: the ⌘F find bar (SourceFindBar), mounted outside the keyed transcript.
    findBarRef = useRef(null),
    textarea = useRef(null),
    cardComposerDraft = useRef(false),
    resumed = useRef(new Set()),
    // Sub-agent threads: thread/started {thread} whose Thread the app-server
    // classifies as a sub-agent (source {subAgent:...}, or parentThreadId for
    // an AgentControl spawn). Their turn/* and item/* still bucket under their
    // own threadId, but they must never become sidebar sessions.
    childThreads = useRef(new Set()),
    currentRef = useRef(null),
    // Displayed transcript rows of the last render (shownRows), read by
    // openSession's catch to pick the load-failure surface.
    shownRowCount = useRef({ id: null, count: 0 }),
    loadSeq = useRef(0),
    sidebarRevision = useRef(0),
    // The session list as of the last update, readable in the SAME tick it was
    // written. openSession/ensureResumed pick the history route from the Thread
    // they know for the id; reading the `sessions` binding of the running
    // render misses a session created moments earlier (fork -> navigate, or the
    // first loadSessions of a reconnect followed by reopening the target), and
    // an unknown Thread would route a legacy thread down the paginated path.
    sessionsRef = useRef([]),
    modelRef = useRef(model);
  modelRef.current = model;
  // Every Thread enters the list with its preview as the user wrote it (shownThread: no attachment note).
  // A pull request the core bound to a session (codeDesktop.pr: Qwen's PR binding) lights the sidebar's review glyph.
  const withPullRequest = (thread) => {
    const pr = thread?.codeDesktop?.pr;
    return pr && (pr.url || pr.number) && !thread.prState ? { ...thread, prState: "open", prLink: typeof pr.url === "string" ? pr.url : null } : thread;
  };
  function setSessions(next) {
    const list = typeof next === "function" ? next(sessionsRef.current) : next;
    const shown = Array.isArray(list) ? list.map(shownThread).map(withPullRequest) : list;
    sessionsRef.current = Array.isArray(list) && shown.every((thread, index) => thread === list[index]) ? list : shown;
    setSessionsState(sessionsRef.current);
  }
  const knownThread = (id) => sessionsRef.current.find((thread) => thread.id === id);
  const items = state.items[current] || [],
    running = !!state.active[current];
  // cc70f2bdf Ko h / git-chips M I: `Ke(u, text).then(e => e === "written" && addSuccess(message))`;
  // a rejected write raises no success toast and keeps the app error path.
  const toasts = useSourceToasts();
  // F08: the latest reduced state for the mount-time event listener (sub-agent ownership of a completed
  // turn), and the custom group a "New session" from its header menu files the next started session into.
  const latestState = useRef(state);
  latestState.current = state;
  // An optimistic send hands over to the core's own userMessage (pending-send-model.mjs pendingStillShown).
  useEffect(() => {
    const done = Object.entries(pendingSends).flatMap(([threadId, list]) => (list || []).filter((entry) => !pendingStillShown(entry, state.items?.[threadId] || [])).map((entry) => [threadId, entry]));
    if (!done.length) return;
    done.forEach(([, entry]) => entry.attachments.forEach(revokePreview));
    done.forEach(([threadId, entry]) => updatePendingSend(threadId, entry.id, (shown) => shown === entry ? null : shown));
  }, [state.items, pendingSends]);
  const newSessionGroup = useRef(null);
  const copyWithToast = (text, message) => navigator.clipboard.writeText(text)
    .then(() => toasts?.add(message, { variant: "neutral" }), e => setError(e.message));
  // R03: failed non-composer actions take the original's addError danger toast with catalog copy
  // (action-error-model.mjs); the reason, without Electron's IPC prefix, goes to the console only.
  const actionFailed = (kind) => (reason) => { reportActionError(toasts, kind, reason); };
  // Official cc(): the commit action is never busy for its own turn (pi holds
  // only PR creation); it is disabled while responding or when the tree is clean,
  // and the reason is surfaced only while disabled.
  const commitDirty = gitStatus?.workingTreeDirty === true;
  // Chat mode runs every turn read-only (permission-policy.mjs), so a commit turn could not write: the band's Commit says so.
  const commitDisabled = !commitDirty || running || mode === "chat";
  const commitDisabledReason = !commitDirty ? COMMIT_CLEAN_REASON : running ? COMMIT_RESPONDING_REASON
    : mode === "chat" ? t("Chat mode is read-only. Switch to Code to commit.") : undefined;
  // F12 band hold (git-pr-slot.js:5834-5990 cm prBarHeightBySession / prBarSnapshotBySession; git-status-card.js
  // 2816-2962 Na): per session, the last status that showed the band and the band's measured height. Until the
  // revisited session's own status arrives the band renders that snapshot inert (stale), for at most 6s (im).
  // gitStatusOwner names the session the current gitStatus belongs to, so the first frame after a switch never
  // shows the previous session's live band.
  // Declared before the band hold below: bandHoldToken keys on workdir (a later declaration is a TDZ crash).
  const session = sessions.find((s) => s.id === current);
  const workdir = session?.cwd || cwd;
  // This side's open session and title, for the window's split store (sidebar selection, tabs, layout persistence).
  useEffect(() => { splitStore.reportSide(side, { current, title: session ? session.name || session.preview || "" : "" }); }, [current, session?.name, session?.preview]);
  // Multi-window: the window title names its primary session, so the Window menu and Mission Control tell windows apart.
  useEffect(() => { if (side === 0) document.title = session ? `${session.name || session.preview || t("Untitled session")} — Code Desktop` : "Code Desktop"; }, [current, session?.name, session?.preview]);
  // A core whose sessions can run as one of its own primary agents (capabilities.primaryAgents: OpenCode/MiMo's
  // default_agent and custom primary agents): the folder's list, and the agent chosen per session ('' = the draft).
  const [primaryAgents, setPrimaryAgents] = useState(null);
  const [agentChoices, setAgentChoices] = useState({});
  const primaryAgentsSupported = coreSupports(boot?.core, "primaryAgents") && !!boot?.connected;
  useEffect(() => {
    if (!primaryAgentsSupported || !workdir) { setPrimaryAgents(null); return undefined; }
    let live = true;
    Promise.resolve(call("customize", { operation: "agents", cwd: workdir })).then((result) => {
      if (!live) return;
      const rows = Array.isArray(result?.agents) ? result.agents.filter((agent) => agent?.primary && agent.name !== "plan") : [];
      const fallback = typeof result?.defaultAgent === "string" ? result.defaultAgent : rows[0]?.name ?? null;
      setPrimaryAgents(rows.length > 1 ? { rows, defaultAgent: fallback } : null);
    }, () => { if (live) setPrimaryAgents(null); });
    return () => { live = false; };
  }, [primaryAgentsSupported, workdir, boot?.core?.id]);
  const agentChoice = agentChoices[current || ""] ?? null;
  // codeDesktop.agent goes with each turn (and the new session's thread/start) once the user picked one.
  const withAgentChoice = (params, key = current || "") => {
    const agent = primaryAgents ? agentChoices[key] : null;
    return agent ? { ...params, codeDesktop: { ...(params.codeDesktop ?? {}), agent } } : params;
  };
  // Pins and groups Codex keeps on its own threads (Thread.section), where Code Desktop recorded none (sidebar-model).
  const shownSessionMetadata = useMemo(() => withCoreSections(sessionMetadata, sessions, { customGroups, pinnedSectionId: codexPinnedSection }), [sessionMetadata, sessions, customGroups, codexPinnedSection]);
  // A committed feature branch of a GitHub repository: the band offers Create PR (a fixed turn) or GitHub's compare page.
  const bandPrAction = pullRequestAction({ status: gitStatus, identity: repoIdentities[workdir] ?? null, responding: running });
  const bandPr = bandPrAction ? { ...bandPrAction, onCreate: () => sendFixedTurn(CREATE_PR_TURN_TEXT), onDraft: () => sendFixedTurn(CREATE_DRAFT_PR_TURN_TEXT),
    onManual: bandPrAction.manualUrl ? () => call("external", { url: bandPrAction.manualUrl }).catch(actionFailed("open-link")) : null } : null;
  const gitBandMemo = useRef(new Map()), gitStatusOwner = useRef(null);
  const rememberGitBand = (id, status) => {
    gitStatusOwner.current = id;
    if (status?.isRepo && status.hasChanges) gitBandMemo.current.set(id, { ...gitBandMemo.current.get(id), status });
    else gitBandMemo.current.delete(id);
  };
  const rememberBandHeight = useCallback((px) => {
    const entry = gitBandMemo.current.get(currentRef.current);
    if (entry && px > 0) entry.heightPx = px;
  }, []);
  const bandStatus = gitStatus && gitStatusOwner.current === current ? gitStatus : null;
  const bandHeld = current && !bandStatus ? gitBandMemo.current.get(current) : undefined;
  const bandHoldToken = useMemo(() => ({ current, workdir }), [current, workdir]);
  useEffect(() => {
    if (!bandHeld) return undefined;
    const timer = setTimeout(() => setGitHoldExpired(bandHoldToken), GIT_BAND_HOLD_MS);
    return () => clearTimeout(timer);
  }, [!!bandHeld, bandHoldToken]);
  const bandHold = bandHeld && gitHoldExpired !== bandHoldToken ? bandHeld : undefined;
  const operation = state.operations?.[current];
  // A finished session action's strip ('Session forked', 'Conversation compacted', 'Review complete') clears itself
  // after a moment, in every session and not only the open one: the transcript keeps the lasting record (the fork
  // marker, the compaction row, the review). A failed or unconfirmed one stays until dismissed.
  const operationTimers = useRef(new Map());
  useEffect(() => {
    for (const [id, op] of Object.entries(state.operations || {})) {
      const scheduled = operationTimers.current.get(id);
      if (op?.phase !== "completed") { if (scheduled) { clearTimeout(scheduled.timer); operationTimers.current.delete(id); } continue; }
      if (scheduled?.op === op) continue;
      if (scheduled) clearTimeout(scheduled.timer);
      const timer = setTimeout(() => { operationTimers.current.delete(id); dispatch({ type: "dismiss-operation", id, expect: op }); }, OPERATION_DONE_MS);
      operationTimers.current.set(id, { op, timer });
    }
  }, [state.operations]);
  useEffect(() => () => { for (const { timer } of operationTimers.current.values()) clearTimeout(timer); operationTimers.current.clear(); }, []);
  // Forks made in this window: {forkId → {parent, turnId}}, for the parent's 'Forked here' marker (forkMarkersFor).
  const [forkPoints, setForkPoints] = useState({});
  const recordForkPoint = (parentId, forkId, turnId) => {
    const at = turnId || state.items[parentId]?.findLast((row) => typeof row?.turnId === "string" && row.turnId)?.turnId;
    if (parentId && forkId && at) setForkPoints((points) => ({ ...points, [forkId]: { parent: parentId, turnId: at } }));
  };
  const forkMarks = useMemo(() => forkMarkersFor(current, sessions, sessionMetadata, forkPoints), [current, sessions, sessionMetadata, forkPoints]);
  stopLive.current = {
    active: state.active, connected: boot?.connected === true && !state.approvalClosed,
    connectionId: state.approvalConnectionId, connectionEpoch: state.approvalConnectionEpoch,
  };
  const stopping = stopRequests.current.has(current, stopLive.current);
  useLayoutEffect(() => { stopRequests.current.reconcile(stopLive.current); },
    [state.active, boot?.connected, state.approvalClosed, state.approvalConnectionId, state.approvalConnectionEpoch]);
  const turnInteraction = useTurnFooterInteraction(current, items);
  const turnFooters = useMemo(() => {
    // A genuine delta/item-start can precede turn/started or thread/resume.
    // Explicit idle overrides old item observations; unknown active state does not.
    const streamingTurnIds = Object.hasOwn(state.active, current) ? [] : items
      .filter(item => state.itemPhases?.[current]?.[item.id] === "streaming")
      .map(item => item.turnId).filter(Boolean);
    if (operation?.operation === "review" && operationPending(operation) && operation.turnId) streamingTurnIds.push(operation.turnId);
    return new Map(buildTurnCopyFooters(items, {
      activeTurnId: state.active[current], isResponding: running, streamingTurnIds,
    }).map(footer => [footer.anchorItemId, footer]));
  }, [items, current, running, state.active, state.itemPhases, operation]);
  // Good / Bad response on replies (capabilities.messageFeedback: the DeepSeek bridge's dsh-message-feedback): this
  // session's ratings by agentMessage item id, read when the session opens.
  const [messageRatings, setMessageRatings] = useState({});
  const ratingsCore = !!boot?.connected && boot?.core?.capabilities?.messageFeedback === true;
  useEffect(() => {
    if (!current || !ratingsCore || loading) return undefined;
    let live = true;
    rpc("codeDesktop/messageFeedback/list", { threadId: current }).then((value) => {
      if (!live) return;
      const byItem = {};
      for (const entry of Array.isArray(value?.data) ? value.data : []) for (const id of entry.itemIds ?? []) byItem[id] = { rating: entry.rating, version: entry.version };
      setMessageRatings((all) => ({ ...all, [current]: byItem }));
    }, () => {});
    return () => { live = false; };
  }, [current, ratingsCore, loading]);
  const rateReply = async (threadId, itemId, rating) => {
    const known = messageRatings[threadId]?.[itemId] ?? null;
    const next = known?.rating === rating ? null : rating;
    const result = next ? await rpc("codeDesktop/messageFeedback/put", { threadId, itemId, rating: next, ifVersion: known?.version ?? null })
      : await rpc("codeDesktop/messageFeedback/delete", { threadId, itemId, ifVersion: known?.version ?? null });
    setMessageRatings((all) => {
      const byItem = { ...all[threadId] };
      for (const id of result?.itemIds?.length ? result.itemIds : [itemId]) { if (result?.rating) byItem[id] = { rating: result.rating, version: result.version }; else delete byItem[id]; }
      return { ...all, [threadId]: byItem };
    });
  };
  // Failed turns (state.turnErrors): newest-of-last-turn card vs older marker.
  const turnErrorView = useMemo(() => turnErrorPlacements(items, state.turnErrors?.[current], { activeTurnId: state.active[current] }),
    [items, state.turnErrors, current, state.active]);
  const rewindPreselect = useRef(null);
  const misalignedTurn = current ? misalignmentStop(items, state.turnErrors?.[current], { activeTurnId: state.active[current] }) : null;
  // Per-turn edits card (turn-edits-model.mjs, Vpe): what each finished turn changed; Undo on the latest turn only.
  const editsByTurn = useMemo(() => turnEdits(items, { activeTurnId: state.active[current] }), [items, current, state.active]);
  // The Changes pane outside a git repo: the core's turn diff when it sends one, else the session's own fileChange
  // edits (DeepSeek and the bridges send no turn/diff/updated), so View changes is never a dead button.
  const editsNeeded = !gitStatus?.isRepo && !(current && state.diffs[current]);
  const editsDiff = useMemo(() => editsNeeded ? fileChangesDiff(items, { cwd: workdir }) : "", [editsNeeded, items, workdir]);
  const sessionDiff = (current && state.diffs[current]) || editsDiff || null;
  const canViewChanges = !!(gitStatus?.isRepo || sessionDiff);
  const latestTurnId = useMemo(() => { let latest = null; for (const item of items || []) if (item?.turnId) latest = item.turnId; return latest; }, [items]);
  // A steered message is shown as pending until its userMessage (clientId = clientUserMessageId) is in the transcript.
  // A core that doesn't echo the id (clientId null) counts as delivered once one more userMessage with the steer's text
  // is in the transcript than when it was sent (steerBaseline), so Stop doesn't put delivered text back in the composer.
  useEffect(() => {
    const pending = current ? pendingSteers[current] : null;
    if (!pending?.length) return;
    const delivered = new Set((items || []).filter((item) => item?.type === "userMessage" && item.clientId).map((item) => item.clientId));
    const done = new Set(pending.filter((entry) => delivered.has(entry.id) || (entry.inputText && steerTextCount(items, entry.inputText) > (entry.baseline ?? 0))).map((entry) => entry.id));
    if (done.size)
      setPendingSteers((all) => ({ ...all, [current]: (all[current] ?? []).filter((entry) => !done.has(entry.id)) }));
  }, [items, current, pendingSteers]);
  const pendingSteersRef = useRef(pendingSteers);
  pendingSteersRef.current = pendingSteers;
  const retryingNow = state.retrying?.[current];
  // {short error, attempt, maxRetries}: "Rate limited · Retrying (1/5)".
  const retryStatus = retryingNow && running && (!retryingNow.turnId || retryingNow.turnId === state.active[current])
    ? retryingStatus(retryingNow, { locale: getLocale() }) : null;
  // Tile layout for the current session (panes-state-current.js pa/setTileLayout
  // /toggleExpandedTile/moveTileToEdge): the store is the source of truth, so a
  // session switch reads the entering session's saved layout, tabs and tree state.
  const tileState = useSyncExternalStore(tileStore.subscribe, tileStore.getState);
  const tileOwner = current ?? HOME_TILE_KEY;
  const tileEntry = tileState.sessions[tileOwner] ?? null;
  const storedLayout = tileEntry?.tileLayout ?? null;
  const displayLayout = useMemo(() => storedLayout ?? chatOnlyLayout(), [storedLayout]);
  const openPanes = useMemo(() => tileIds(displayLayout), [displayLayout]);
  const panel = PANE_KINDS.find((kind) => openPanes.has(kind)) ?? null;
  const hasPane = openPanes.size > 1 || !openPanes.has(CHAT_TILE_ID);
  const expandedTile = tileEntry?.expandedTile ?? null;
  const agentOpeners = useRef(new Map());
  const [popouts, setPopouts] = useState([]);
  const popoutKeys = useMemo(() => new Set(popouts.map((entry) => `${entry.sessionId}:${entry.pane}`)), [popouts]);
  const openPaneTile = useCallback((kind, sessionId = currentRef.current ?? HOME_TILE_KEY) => {
    if (!sessionId || !PANE_KINDS.includes(kind)) return;
    const entry = tileStore.getSession(sessionId);
    const next = openPaneInLayout(baseTileLayout(entry), kind, tileStore.getState().lastPaneFlexByKind);
    tileStore.setSession(sessionId, { tileLayout: next, baseLayout: null, expandedTile: null });
  }, []);
  const closePaneTile = useCallback((kind, sessionId = currentRef.current ?? HOME_TILE_KEY) => {
    if (!sessionId) return;
    const entry = tileStore.getSession(sessionId);
    if (!entry?.tileLayout) return;
    const next = removeTile(baseTileLayout(entry), kind);
    const remaining = [...tileIds(next)].filter((id) => id !== CHAT_TILE_ID);
    tileStore.setSession(sessionId, { tileLayout: remaining.length ? next : null, baseLayout: null, expandedTile: null, ...(kind === "tasks" ? {taskViews:[]} : {}) });
    if (kind === "tasks") { const saved = agentOpeners.current.get(sessionId); const opener = saved?.element?.isConnected ? saved.element : saved?.childId ? scope().querySelector(`.source-chat-tile-content [data-agent-thread-id="${CSS.escape(saved.childId)}"] .sag-trigger`) : null; opener?.focus({preventScroll:true}); agentOpeners.current.delete(sessionId); }
  }, []);
  const [taskFocus,setTaskFocus]=useState(null);
  const workflows=workflowRuns.filter(run=>run.threadId===current);
  const tasks=[...backgroundTasks(state,current,{connected:!!boot?.connected}),...[...workflows,...modelWorkflowRuns(items,current)].map(workflowTask)];
  useEffect(()=>{if(!current)return;let alive=true;call('workflow-list',{threadId:current}).then(rows=>{if(alive)setWorkflowRuns(old=>rows.reduce(mergeWorkflow,old));}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[current]);
  const openWorkflow=id=>{changeTileView({taskViews:[]});setTaskFocus('workflow:'+id);openPaneTile('tasks');};
  useEffect(()=>{if(!current||!boot?.connected)return;let live=true,timer;const id=current,connectionId=state.approvalConnectionId;const poll=async()=>{const requestId=Symbol('background-read');dispatch({type:'backgroundReadStarted',id,connectionId,requestId});try{const snapshot=await call('background-read',{threadId:id});if(live)dispatch({type:'backgroundSnapshot',id,connectionId,requestId,snapshot});}catch(e){if(live)dispatch({type:'backgroundSnapshot',id,connectionId,requestId,snapshot:{errors:[e.message],terminals:[]}});}finally{if(live)timer=setTimeout(poll,2000);}};poll();return()=>{live=false;clearTimeout(timer);};},[current,boot?.connected,state.approvalConnectionId]);
  const openBackgroundTask=itemId=>{changeTileView({taskViews:[]});setTaskFocus('bash:'+itemId);openPaneTile('tasks');};
  // A task-event row (source-task-event.jsx, L2): the Background tasks pane, on the run its <task-id> names when listed.
  const openTaskEvent=event=>{const task=event?.taskKey?tasks.find(entry=>entry.id===event.taskKey):event?.taskId?tasks.find(entry=>entry.kind==='workflow'&&entry.run?.taskId===event.taskId):null;changeTileView({taskViews:[]});if(task)setTaskFocus(task.id);openPaneTile('tasks');};
  // Finished background commands and agents as Claude's task-event rows at the end of the turn they finished in.
  const taskEventsByTurn=backgroundTaskEventsByTurn(tasks,{items,turnTimes:state.turnTimes?.[current],activeTurnId:state.active[current],backgroundItemIds:new Set(Object.keys(state.background?.[current]?.knownTerminals||{}))});
  const stopBackgroundTask=async task=>{const expected={connectionId:state.approvalConnectionId,connectionEpoch:state.approvalConnectionEpoch};
    if(task.kind==='workflow')return isModelWorkflow(task.run)?rpc('codeDesktop/workflow/stop',{threadId:current,runId:task.run.runId??task.run.id,attemptId:task.run.attemptId}):call('workflow-stop',{id:task.run.id});
    if(task.kind==='agent')await call('interrupt',{threadId:task.threadId,turnId:task.turnId,expected});
    else {const result=await call('background-terminate',{threadId:current,processId:task.processId,expected});if(!result.terminated)throw Error(t('The process was not terminated.'));}
  };
  const openAgent = (item, childId, opener) => {
    const sessionId = currentRef.current;
    if (!sessionId || !childId) return;
    const entry = tileStore.getSession(sessionId), views = entry?.taskViews || [];
    const description = agentView(state, item, childId).name;
    const view = {kind:"subagent", threadId:childId, toolId:item.id, ownerId:item.senderThreadId || sessionId, description};
    if (opener && !opener.closest('.sag-pane')) agentOpeners.current.set(sessionId, {element:opener,childId});
    openPaneTile("tasks",sessionId);
    if (views.at(-1)?.threadId !== childId || views.at(-1)?.toolId !== item.id) tileStore.setSession(sessionId,{taskViews:[...views,view].slice(-32)});
  };
  const loadAgent = async (id) => {
    const baselineItems=state.items[id],baselineActiveVersion=state.activeVersions?.[id];
    const known=state.threads[id],route=historyRoute(known);
    const response=await rpc("thread/read",historyReadParams(id,known));
    const history=await loadThreadHistory(rpc,{threadId:id,thread:response.thread,route});
    dispatch({type:"hydrate",id,thread:{...response.thread,turns:history.turns},baselineItems,baselineActiveVersion});
  };
  const setPanel = useCallback((value) => {
    if (value !== null) { openPaneTile(value); return; }
    const id = currentRef.current ?? HOME_TILE_KEY;
    if (tileStore.getSession(id)?.tileLayout) tileStore.setSession(id, { tileLayout: null, baseLayout: null, expandedTile: null });
  }, [openPaneTile]);
  const togglePaneTile = (kind) => (openPanes.has(kind) ? closePaneTile(kind) : openPaneTile(kind));
  // Built-in terminal pane (source-terminal-pane.jsx): ⌃` / ⌘J, View › Show/Hide Terminal and the titlebar button, in
  // the chat section of a session or of the New session page (its folder). Opening moves focus into the shell; hiding
  // it from inside hands focus back to the composer. A tab the agent opens (run_in_terminal) shows its session's pane.
  const [terminalFocus, setTerminalFocus] = useState(0);
  const terminalAvailable = section === "new" && !!workdir && !!api?.terminal;
  const terminalOwner = ownerKeyOf(current ?? null, current ? null : workdir);
  // '!' shell mode through the terminal pane, for a core without its own (shell-mode-model.mjs): a local session only.
  const shellOptions = { terminal: terminalAvailable && !!current };
  const terminalVersion = useSyncExternalStore(terminalStore().subscribe, terminalStore().version, () => 0);
  const terminalBusy = useMemo(() => !!terminalOwner && terminalStore().busy(terminalOwner), [terminalOwner, terminalVersion]);
  // Preview pane (source-preview-pane.jsx): ⇧⌘P, View › Show/Hide Preview, the titlebar button and the agent's preview
  // tools; one per session (a page needs the session's folder). previewRunning draws the titlebar's activity dot.
  const previewAvailable = section === "new" && !!current && !!api;
  const previewRunning = usePreviewActivity(previewAvailable ? current : null, api);
  const toggleTerminalPane = () => {
    if (!terminalAvailable) return;
    if (!openPanes.has("terminal")) { openPaneTile("terminal"); setTerminalFocus(nextTerminalFocusRequest()); return; }
    const inside = !!document.activeElement?.closest?.('[data-tile-id="terminal"]');
    closePaneTile("terminal");
    // This side's composer (split view: never the other side's).
    if (inside) requestAnimationFrame(() => scope().querySelector(".source-chat-tile-content .ProseMirror")?.focus({ preventScroll: true }));
  };
  // "Open in terminal" (the git band's folder menu, a Files tree folder): a tab in the built-in pane in that folder, as
  // the official app does (git-status-card wt = openTerminalTab); Terminal.app only where there is no pane.
  const openTerminalIn = async (dir) => {
    if (!terminalAvailable || typeof dir !== "string" || !dir) return call("open-terminal", { cwd: dir || workdir });
    const sessionId = currentRef.current ?? null, homeWorkspace = sessionId ? null : workdir, owner = ownerKeyOf(sessionId, homeWorkspace);
    // Listed first, so the pane opening doesn't also start its default tab.
    await terminalStore().load(owner, sessionId, homeWorkspace).catch(() => null);
    await terminalStore().create(owner, sessionId, homeWorkspace, {}, { cwd: dir });
    openPaneTile("terminal");
    setTerminalFocus(nextTerminalFocusRequest());
  };
  // A transcript shell block's "Run in terminal": a new tab of this side's terminal pane in the session folder, with
  // the command typed in (code-block-actions.mjs).
  const runInTerminal = useCallback(async (text, language) => {
    const command = terminalCommandText(text, language);
    if (!command) return;
    const sessionId = currentRef.current ?? null, homeWorkspace = sessionId ? null : workdir, owner = ownerKeyOf(sessionId, homeWorkspace);
    await terminalStore().load(owner, sessionId, homeWorkspace).catch(() => null);
    const info = await terminalStore().create(owner, sessionId, homeWorkspace, {});
    openPaneTile("terminal");
    terminalStore().input(info.id, command);
  }, [workdir, openPaneTile]);
  const codeBlockActions = useMemo(() => (terminalAvailable ? { runInTerminal } : null), [terminalAvailable, runInTerminal]);
  useEffect(() => terminalStore().onOpened((event) => {
    if (typeof event?.sessionId === "string" && event.sessionId) openPaneTile("terminal", event.sessionId);
  }), [openPaneTile]);
  const changeTileLayout = useCallback((next, changedKeys) => {
    const id = currentRef.current ?? HOME_TILE_KEY;
    const flexByKind = tileStore.getState().lastPaneFlexByKind;
    const remembered = rememberPaneFlex(next, changedKeys, flexByKind);
    if (remembered !== flexByKind) tileStore.setGlobal({ lastPaneFlexByKind: remembered });
    tileStore.setSession(id, { tileLayout: next });
  }, []);
  // A reopened layout whose chat was dragged below its 320 px minimum (SourceTileLayout restoreKey), saved for the
  // session it was read for.
  const restoreTileLayout = useCallback((next, owner) => { tileStore.setSession(owner, { tileLayout: next }); }, []);
  const toggleExpandTile = useCallback((kind) => {
    const id = currentRef.current ?? HOME_TILE_KEY, entry = tileStore.getSession(id);
    if (!entry?.tileLayout) return;
    if (entry.expandedTile === kind) { tileStore.setSession(id, { tileLayout: entry.baseLayout ?? entry.tileLayout, baseLayout: null, expandedTile: null }); return; }
    const base = baseTileLayout(entry);
    if (!tileIds(base).has(kind)) return;
    tileStore.setSession(id, { tileLayout: fromSpec({ direction: "row", children: [kind] }), baseLayout: base, expandedTile: kind });
  }, []);
  const moveTileEdge = useCallback((kind, edge) => {
    const id = currentRef.current ?? HOME_TILE_KEY, entry = tileStore.getSession(id);
    if (!entry?.tileLayout) return;
    tileStore.setSession(id, { tileLayout: moveTileToEdge(baseTileLayout(entry), kind, edge), baseLayout: null, expandedTile: null });
  }, []);
  const changeTileView = useCallback((patch) => { tileStore.setSession(currentRef.current ?? HOME_TILE_KEY, patch); }, []);
  // Pop-out (official Ix/tear-off: requestPopOut -> openPopout -> closeSidePane).
  // The tile leaves the layout only after the window was actually created.
  const popoutTile = useCallback(async (kind, position = null) => {
    const id = currentRef.current;
    if (!id) return false;
    try {
      await call("popout-open", { sessionId: id, pane: kind, position });
      closePaneTile(kind, id);
      return true;
    } catch (error) { setError(error.message); return false; }
  }, [closePaneTile]);
  const tearOffTile = useCallback((tileId, screen) => {
    if (!PANE_KINDS.includes(tileId) || tileId === "tasks" || tileId === "terminal" || tileId === "preview" || !api) return false;
    popoutTile(tileId, { x: Math.round(screen.x - 120), y: Math.round(screen.y - 14) });
    return true;
  }, [popoutTile]);
  const chatAnchor = useMemo(() => {
    const root = displayLayout.root;
    const last = root.children[root.children.length - 1];
    return root.direction === "row" && last?.kind === "tile" && last.tileId === CHAT_TILE_ID && root.children.length > 1 ? "right" : "left";
  }, [displayLayout]);
  const tileDefs = useMemo(() => [{ id: CHAT_TILE_ID, name: t("Chat"), overflowMin: { width: 320, anchor: chatAnchor } }, ...PANE_KINDS.map((id) => ({ id, name: PANE_NAMES[id] ?? id }))], [chatAnchor]);
  // A pane window shows one session's data, pushed by the Apps that hold that session: split sides and other windows
  // that never opened it have nothing for it and must not overwrite the popped-out pane with an empty one.
  const holdsSession = (id) => state.items[id] !== undefined || state.plans[id] !== undefined || state.planDocs?.[id] !== undefined;
  useEffect(() => {
    for (const entry of popouts) if (entry.pane === "plan" && holdsSession(entry.sessionId))
      call("popout-sync", { sessionId: entry.sessionId, pane: "plan", data: { plan: state.plans[entry.sessionId] ?? null, document: state.planDocs?.[entry.sessionId] ?? null } }).catch(() => {});
  }, [popouts, state.plans, state.planDocs]);
  // A popped-out Changes pane outside a git repo shows the same session diff as the docked one (turn diff, else edits).
  const popoutDiffsSent = useRef(new Map());
  useEffect(() => {
    const sent = popoutDiffsSent.current, live = new Set();
    for (const entry of popouts) if (entry.pane === "changes" && holdsSession(entry.sessionId)) {
      const sessionItems = state.items[entry.sessionId];
      const diff = state.diffs[entry.sessionId] || fileChangesDiff(sessionItems, { cwd: state.threads?.[entry.sessionId]?.cwd || workdir }) || null;
      live.add(entry.sessionId);
      if (sent.has(entry.sessionId) && sent.get(entry.sessionId) === diff) continue;
      sent.set(entry.sessionId, diff);
      call("popout-sync", { sessionId: entry.sessionId, pane: "changes", data: { diff } }).catch(() => {});
    }
    for (const id of [...sent.keys()]) if (!live.has(id)) sent.delete(id);
  }, [popouts, state.items, state.diffs, state.threads, workdir]);
  const openFileRef = useCallback((ref) => {
    if (!ref || typeof ref.path !== "string") return;
    setPanel("files");
    setFileRequest({ path: ref.path, line: ref.line, endLine: ref.endLine, sequence: Date.now() + Math.random() });
  }, []);
  // The ⌘K search's 'Start a session' row (official palette 'Write a message…' + Send): the text goes to the Home composer
  // and is sent there, in the Home folder, core and mode, as a Home send would.
  const pendingSearchSend = useRef(null);
  const startSessionFromSearch = (text) => {
    if (!text || settings) return;
    pendingSearchSend.current = text;
    navigate(null);
    // After the Home view restored its own draft: the search text replaces it; an unsent one is dropped after a moment.
    setTimeout(() => setDraft(text), 0);
    setTimeout(() => { if (pendingSearchSend.current === text) pendingSearchSend.current = null; }, 3000);
  };
  useEffect(() => {
    const text = pendingSearchSend.current;
    if (!text || current || draft !== text) return;
    pendingSearchSend.current = null;
    void send();
  });
  // File › Open File… (⌘O): a file in the open session's folder opens in its Files pane; any other starts a session draft
  // in the file's folder and opens it once that session starts (pendingFileOpen).
  const pendingFileOpen = useRef(null);
  async function openFileFromMenu() {
    try {
      const picked = await call("open-file-dialog", { inside: session && workdir ? workdir : undefined });
      if (!picked?.path) return;
      if (picked.inside && session) { openFileRef({ path: pathChoices(picked.path, workdir)?.relative || picked.path }); return; }
      pendingFileOpen.current = picked;
      navigate(null);
      setCwd(picked.folder);
      toasts?.add(t("Send a message to start a session in {folder}. {file} opens in Files when it starts.", { folder: picked.folder.split("/").pop() || picked.folder, file: picked.path.split("/").pop() }));
    } catch (error) { setError(error.message); }
  }
  useEffect(() => {
    const pending = pendingFileOpen.current;
    if (!pending || !current || !workdir || !session) return;
    if (pending.path !== workdir && !pending.path.startsWith(`${workdir}/`)) return;
    pendingFileOpen.current = null;
    const timer = setTimeout(() => openFileRef({ path: pathChoices(pending.path, workdir)?.relative || pending.path }), 0);
    return () => clearTimeout(timer);
  }, [current, workdir, session]);
  // A request is consumed by the pane that handled it and never replayed on a
  // later remount (pane closed and reopened, Plan/Changes tab, other session).
  const consumeFileRequest = useCallback((sequence) => {
    setFileRequest((request) => (request && request.sequence === sequence ? null : request));
  }, []);
  useEffect(() => { setFileRequest(null); }, [current]);
  // Changes-pane file header actions (c219730b0 Ze/$e over aa, panes-diff-view-current.js:3700-3774).
  // Diff paths are relative to the root the patch came from: the Git toplevel
  // (workspace-git-status cwd) or, for Codex turn diffs, the session workdir.
  // Open file follows the transcript chip path (openFileRef -> Files pane
  // preview tab), relative to the workdir when inside it. Copy is c3e58cab4
  // (addSuccess "Copied to clipboard." after the write); Attach as context is
  // c856385e2 Hn attachFileToChat over the composer's real path-referenced file
  // attachment (stageFiles -> mention), as the paste/drop referenced lane does.
  const diffRoot = gitStatus?.isRepo ? gitStatus.cwd : workdir;
  const diffFileActions = {
    root: diffRoot,
    onCopy: (text) => copyWithToast(text, t("Copied to clipboard.")),
    onOpenFile: (filePath) => {
      const absolute = absoluteDiffPath(diffRoot, filePath);
      if (!absolute) return;
      openFileRef({ path: pathChoices(absolute, workdir)?.relative || absolute });
    },
    onAttachFile: (filePath) => {
      const absolute = absoluteDiffPath(diffRoot, filePath);
      if (absolute) attachFilePath(absolute);
    },
  };
  function attachFilePath(absolute) {
    if (!absolute) return;
    setAttachments((entries) => {
      const staged = stageFiles(entries, [{ name: attachmentBasename(absolute), path: absolute, type: "" }], { imagesAllowed });
      let next = staged.entries;
      for (const entry of staged.added) if (entry.kind === "image") next = markReady(next, entry.id, { previewUrl: filePreviewUrl(entry.path) });
      if (staged.notices.length) setError(staged.notices.join("\n"));
      return next;
    });
  }
  // 'Attach selection/message as context' (scroll-messages-current.js:33677-33686 S; cc43287c9-BMbiZYzF.js:32293-32305
  // ju). The source adds a context snippet to the composer and schedules its focus: the text becomes a Quote snippet
  // pill (addSnippet; sent ahead of the message as a Markdown quote), and the editor takes focus. The second argument
  // names the caller ('transcript'; the Files pane in B11); it does not change the snippet.
  // eslint-disable-next-line no-unused-vars
  const attachQuoteToDraft = useCallback((text, source = "transcript") => {
    const snippet = quoteBlock(text) ? makeSnippet(text) : null;
    if (!snippet) return false;
    setAttachments((entries) => addSnippet(entries, snippet));
    requestAnimationFrame(() => textarea.current?.focus());
    return true;
  }, []);
  // The terminal pane's "Attach selection as context" (⇧⌘L, its body menu): the selected output becomes a context
  // snippet pill in the composer (Claude's attachAsContext), and the composer takes focus.
  const attachTerminalOutput = useCallback((text) => {
    const snippet = makeSnippet(text);
    if (!snippet) return;
    setAttachments((entries) => addSnippet(entries, snippet));
    requestAnimationFrame(() => textarea.current?.focus());
  }, []);
  // 'Add to prompt' from a pane (inline-comments.mjs addToPrompt: plan comments, changed-line comments): a context
  // snippet pill (Claude's addSnippet), sent ahead of the message; the composer takes focus.
  useEffect(() => {
    const add = (event) => {
      if (!splitActiveRef.current) return;
      const snippet = makeSnippet(typeof event?.detail?.text === "string" ? event.detail.text.trim() : "");
      if (!snippet) return;
      setAttachments((entries) => addSnippet(entries, snippet));
      requestAnimationFrame(() => textarea.current?.focus());
    };
    window.addEventListener(ADD_TO_PROMPT_EVENT, add);
    return () => window.removeEventListener(ADD_TO_PROMPT_EVENT, add);
  }, []);
  const actionPending = operationPending(operation);
  // boot.core (main.cjs connect): engine and capabilities from initialize.
  // A start that failed reports no core (main.cjs init {connected:false, config}): name the chosen core, not Codex.
  const engine = bootEngine(boot);
  const unsupportedMethods = boot?.core?.capabilities?.unsupportedMethods;
  const sessionsShareable = !!boot?.connected && boot?.core?.capabilities?.threadShare === true;
  // Plan/chat/review mode hint for the DeepSeek core (permission-policy.mjs); Codex gets none.
  // networkAccess rides along to turnPermissionParams (threadPermissionParams ignores it): Settings › Code ›
  // Sandbox network access lets workspace-write commands reach the network, a local proxy included.
  const permissionHints = () => ({ hints: coreSupports(boot?.core, "permissionHints"), afterPlan: afterPlan.current, networkAccess: boot?.config?.sandboxNetworkAccess === true,
    autoReview: boot?.core?.capabilities?.autoReview === true });
  // Mode, Model and Effort stay usable during a turn (c360a9e1c-GPs-MV9u.js:4544-4575, :4942, :2829): the source
  // applies a mode change to the live session. A core that lists capabilities.livePermissions (the DeepSeek bridge)
  // takes the turn/start permission params for the running thread at once (codeDesktop/thread/permissions →
  // applyPermissions); Codex has no such request, so there the change goes out with the next turn/start. Model and
  // effort always apply from the next turn/start or steer.
  const livePermissions = boot?.core?.capabilities?.livePermissions === true;
  const appliedMode = useRef(null);
  useEffect(() => {
    const key = `${current}\u0000${effectivePermission}\u0000${mode}`, previous = appliedMode.current;
    appliedMode.current = key;
    if (previous === null || previous === key || !previous.startsWith(`${current}\u0000`)) return;
    if (!current || !running || !livePermissions || !boot?.connected || !resumed.current.has(current)) return;
    rpc("codeDesktop/thread/permissions", { threadId: current, ...turnPermissionParams({ permission: effectivePermission, mode, cwd: workdir || cwd, additionalFolders, ...permissionHints() }) })
      .catch((e) => setError(e.message));
  }, [current, effectivePermission, mode]);
  // Skills in '/' (cc183b3ab-BNeMUZS1.js:619-700): the user-invocable skills of the Customize catalog
  // (customize-store, skills/list; customize-model skillInvocable); session-command-model.mjs keeps the ones with a slash name.
  const customizeSnapshot = useSyncExternalStore(customizeStore.subscribe, customizeStore.getSnapshot, customizeStore.getSnapshot);
  const workflowState = useMemo(() => resolveWorkflowSettings({ config: boot?.config || {}, env: boot?.workflowEnv || {}, managed: boot?.workflowManaged || {}, parallelism: boot?.workflowParallelism ?? 4 }),
    [boot?.config, boot?.workflowEnv, boot?.workflowManaged, boot?.workflowParallelism]);
  // A row that runs the core's own workflow tool (requiresWorkflowTool: MiMo's /deep-research) is left out while the
  // session withholds that tool: Dynamic workflows off, or Code Desktop's engine chosen for this core.
  const coreWorkflowToolOn = workflowState.enabled && workflowEngine(boot?.core, boot?.config?.workflowEngines) === "agent";
  const offeredSkills = useMemo(() => customizeSnapshot.skills.skills.filter((row) => row.requiresWorkflowTool !== true || coreWorkflowToolOn), [customizeSnapshot.skills.skills, coreWorkflowToolOn]);
  const commandSkills = useMemo(() => offeredSkills.filter(skillInvocable)
    .map((row) => ({ name: row.skillName || row.name, description: row.description, path: row.path, argumentHint: row.argumentHint || "" })), [offeredSkills]);
  // Custom slash commands (C3): <userData>/commands and <workdir>/.code-desktop/commands via custom-commands-store.mjs
  // (main custom-commands.cjs watches both folders); rows merged with built-in > project > global > skills precedence.
  const customCommandsSnapshot = useSyncExternalStore(customCommandsStore.subscribe, customCommandsStore.getSnapshot, customCommandsStore.getSnapshot);
  const customCommandsPrefs = JSON.stringify(normalizeCustomCommands(boot?.config?.customCommands));
  useEffect(() => { if (boot) customCommandsStore.load(workdir || cwd, { force: true }); }, [workdir, cwd, customCommandsPrefs, !!boot]);
  const customCommandsEntry = customCommandsSnapshot.entries[workdir || cwd || ""];
  const customCommands = useMemo(() => customCommandsEntry ? mergeCommands({ global: customCommandsEntry.global, project: customCommandsEntry.project,
    builtinIds: sessionCommands.flatMap((entry) => [entry.id, ...(entry.aliases || [])]), skillNames: commandSkills.map((skill) => skill.name) }) : [], [customCommandsEntry, commandSkills]);
  // Saved workflows as /<name> while Code Desktop's engine runs this core's workflows (loaded below workflowState).
  const [savedWorkflowRows, setSavedWorkflowRows] = useState([]);
  const commandContext = { current, archived:session?.archived, connected:!!boot?.connected && !state.approvalClosed,
    loading, running, sending, pending:actionPending, hasHistory:items.length > 0, unsupportedMethods, skills: commandSkills, customCommands: savedWorkflowRows.length ? [...customCommands, ...savedWorkflowRows] : customCommands,
    // '/compact [instructions]' is offered only where the core takes them (session-command-model sessionCommandHint).
    compactInstructions: coreSupports(boot?.core, "compactInstructions"),
    // /usage's description (session-command-model sessionCommandDescription): a per-token core has no plan limits.
    perTokenBilling: coreSupports(boot?.core, "perTokenBilling") };
  const models = useMemo(() => withEffortDefaults(boot?.models || [], boot?.config?.modelSettings), [boot?.models, boot?.config?.modelSettings]);
  const chosen = models.find((m) => m.model === model);
  // A saved model the current core does not list (a Codex model on the DeepSeek core) or a
  // catalog that arrived after init falls back to the catalog default instead of "Default model".
  useEffect(() => {
    if (!models.length || models.some((m) => m.model === model)) return;
    const fallback = models.find((m) => m.isDefault) || models[0];
    setModel(fallback.model);
    setEffort((value) => fallback.supportedReasoningEfforts?.some((e) => e.reasoningEffort === value) ? value : fallback.defaultReasoningEffort || "medium");
  }, [models, model]);
  // Settings › Code › Dynamic workflows in effect (the environment and managed settings main reported win).
  // Saved workflows as /<name> (Claude Code getWorkflowCommands) while Code Desktop's engine runs this core's workflows:
  // its Workflow tool runs them by name.
  // A core with its own saved-workflow library (capabilities.savedWorkflows: ZCode's .zcode/workflows) offers that one
  // while its own engine runs its workflows (main.cjs 'saved-workflows' picks the list).
  const workflowCommandsOn = workflowState.enabled && (workflowEngineChoice(boot?.core, boot?.config?.workflowEngines) === "codeDesktop" || boot?.core?.capabilities?.savedWorkflows === true);
  useEffect(() => {
    const root = workdir || cwd;
    if (!workflowCommandsOn || !root || !boot?.connected) { setSavedWorkflowRows([]); return undefined; }
    let alive = true;
    call("saved-workflows", { cwd: root }).then((list) => { if (alive) setSavedWorkflowRows(workflowCommandRows(list)); }, () => { if (alive) setSavedWorkflowRows([]); });
    return () => { alive = false; };
  }, [workflowCommandsOn, workdir, cwd, boot?.connected, boot?.config?.workflowEngines]);
  // The purple top tier is ultracode while workflows are on (model-menu-model.mjs withUltracodeLevel).
  const efforts = useMemo(() => withUltracodeLevel(chosen?.supportedReasoningEfforts || [], workflowState.enabled), [chosen?.supportedReasoningEfforts, workflowState.enabled]);
  const ultracodeOn = workflowState.enabled && isUltracodeTier(effort) && efforts.some((level) => (level?.reasoningEffort ?? level) === effort);
  // The keyword in a human-typed draft (electron/prefs/workflow-keyword.mjs, Claude's detector): highlighted, and the
  // composer says the turn will be a dynamic workflow unless alt+w ignores it.
  const keywordMatches = workflowState.enabled && workflowState.keywordTrigger ? ultracodeMatches(draft) : [];
  useEffect(() => { if (!keywordMatches.length && keywordIgnored) setKeywordIgnored(false); }, [keywordMatches.length, keywordIgnored]);
  // This side's large-workflow warning limits (its session's ultracode, the size guideline's cap), passed to its own
  // workflow rows and cards: split view's other side has its own.
  const workflowSizeCap = workflowState.sizeWarningAgents.source === "default" && workflowState.sizeSource !== "default" && workflowState.sizeGuideline !== "unrestricted" ? { small: 5, medium: 10, large: 50 }[workflowState.sizeGuideline] : workflowState.sizeWarningAgents.value;
  const workflowWarningLimits = useMemo(() => ({ agents: workflowSizeCap, tokens: workflowState.sizeWarningTokens.value, suppressed: ultracodeOn }),
    [workflowSizeCap, workflowState.sizeWarningTokens.value, ultracodeOn]);
  // The effort popover's Plan mode row: a core with its own Plan reasoning (collaboration modes, no permission hints:
  // Codex's plan_mode_reasoning_effort, else its Plan preset), read when the popover opens.
  const [planEffort, setPlanEffort] = useState(null);
  const planEffortCore = !!boot?.connected && coreSupports(boot?.core, "collaborationModes") && !coreSupports(boot?.core, "permissionHints");
  useEffect(() => {
    if (menu?.kind !== "effort" || !planEffortCore) { if (menu?.kind !== "effort") setPlanEffort(null); return undefined; }
    let live = true;
    call("plan-effort", { op: "read" }).then((value) => { if (live) setPlanEffort({ ...value, saving: false }); }, () => { if (live) setPlanEffort(null); });
    return () => { live = false; };
  }, [menu?.kind, planEffortCore]);
  // Speed: Standard or a faster tier the model lists (Fast, Ultrafast…; preferences.mjs speedTiersForModel).
  // fastTier is the tier the on/off controls turn on: the chosen speed's, else Fast, else the first one listed.
  const speedTiers = speedTiersForModel(chosen);
  const activeTier = tierForSpeed(chosen, speed);
  const fastTier = activeTier || fastTierForModel(chosen) || speedTiers[0] || null;
  const fastEnabled = !!activeTier;
  // Catalog inputModalities without "image" (DeepSeek's text-only models): no image staging.
  const imagesAllowed = modelAcceptsImages(chosen);
  // A core that reads images for a model without vision (capabilities.imageFallback 'path': MiMo) takes them as files.
  const imageFallback = !imagesAllowed && boot?.core?.capabilities?.imageFallback === "path";
  commandContext.dynamicWorkflows = workflowState.enabled;
  // What the running core serves (boot.core; before the first connect, the chosen core): /btw, /workflow, its own
  // commands, and its name for "Not available with {core} yet".
  const runningCore = boot?.core || boot?.config?.core || undefined;
  commandContext.coreName = runningCore ? coreName(runningCore) : "";
  commandContext.sideQuestions = sideQuestionsSupported(runningCore);
  commandContext.workflows = workflowsSupported(runningCore);
  commandContext.workflowEngine = workflowEngine(runningCore, boot?.config?.workflowEngines);
  commandContext.permissionMode = effectivePermission;
  // /cd forks into another folder: a core reporting forkCwd false keeps its folder (only Qwen moves a session).
  commandContext.forkCwd = boot?.core?.capabilities?.forkCwd;
  // /cd on a core that moves the session itself (OpenCode's /move: moveCwd) instead of forking it.
  commandContext.moveCwd = boot?.core?.capabilities?.moveCwd === true;
  // /feedback reaches a bridge core's own feedback channel (Kimi Code), not only Codex's.
  commandContext.feedbackUpload = boot?.core?.capabilities?.feedbackUpload === true;
  // /import: Codex's externalAgentConfig/* (the Claude Code import), only on the Codex core.
  commandContext.claudeImport = !!runningCore && coreForEngine(typeof runningCore === "string" ? runningCore : runningCore.engine).id === "codex";
  // Codex goals (capabilities.nativeGoals, main.cjs coreFeatures): /goal runs thread/goal/* (runCoreCommand).
  const nativeGoals = !!boot?.connected && boot?.core?.capabilities?.nativeGoals === true;
  // Codex's /init (native Codex, no core commands of its own): a turn that writes AGENTS.md (runCoreCommand).
  const nativeInit = !!boot?.connected && coreForEngine(boot?.core?.engine).id === "codex" && !coreSupports(boot?.core, "permissionHints") && !coreSupports(boot?.core, "coreCommands");
  commandContext.coreCommands = [...coreCommands,
    ...(nativeGoals && !coreCommands.some((row) => row?.name === "goal") ? [nativeGoalCommand()] : []),
    ...(nativeInit && !coreCommands.some((row) => row?.name === "init") ? [nativeInitCommand()] : [])];
  // ⌘; reads it from its keydown listener.
  const sideQuestionsRef = useRef(true);
  sideQuestionsRef.current = commandContext.sideQuestions;
  // The core's own slash commands (capabilities.coreCommands): listed for the open session and folder, and listed again
  // when the core says they changed (codeDesktop/commands/changed). No capability, or a failed list: none.
  const coreCommandsListed = !!boot?.connected && coreSupports(boot?.core, "coreCommands");
  useEffect(() => {
    if (!coreCommandsListed) { setCoreCommands((list) => list.length ? [] : list); return undefined; }
    let live = true;
    const load = () => rpc("codeDesktop/commands/list", { ...(current ? { threadId: current } : {}), ...(workdir || cwd ? { cwd: workdir || cwd } : {}) })
      .then((result) => { if (live) setCoreCommands(Array.isArray(result?.data) ? result.data : Array.isArray(result?.commands) ? result.commands : []); })
      .catch(() => { if (live) setCoreCommands([]); });
    void load();
    const unsubscribe = api?.onEvent?.((event) => { if (event?.method === "codeDesktop/commands/changed") void load(); });
    return () => { live = false; unsubscribe?.(); };
  }, [coreCommandsListed, boot?.core, current, workdir, cwd]);
  commandContext.fastAvailable = !!fastTier;
  commandContext.effortAvailable = efforts.length > 0;
  const serviceTier = activeTier ? activeTier.id : "default";
  // An approval belongs to the session that owns its thread. A sub-agent runs
  // on its own threadId (thread_processor.rs:3609-3640) and is deliberately
  // never a session, so matching threadId against `current` alone would leave
  // its serverRequest with no surface at all and block that turn behind an
  // empty screen; ownerThreadId walks the parent chain back to the session.
  const approvalOwner = (approval) => ownerThreadId(state, approval.params?.threadId);
  const approvals = state.approvals.filter(
    (a) => !a.params?.threadId || approvalOwner(a) === current,
  );
  // HE (approval-current.js:2814-2846): a running command row is "blocked"
  // while one of its own approval requests is still unresolved, and its
  // running footer is withheld. The link is the request's itemId; an MCP elicitation's is its in-progress
  // mcpToolCall when it is unambiguous (same server and turn, matching arguments; approval-card-model elicitationItem).
  const pendingApprovalItems = useMemo(() => new Set([...pendingCommandItemIds(approvals), ...approvals.filter(a => a.method === "item/fileChange/requestApproval").map(a => a.params?.itemId).filter(Boolean),
    ...pendingElicitationItemIds(approvals, items)]), [approvals, items]);
  // R07 one card at a time (cc43287c9 :31744 om → mc, :37426): only the oldest answerable
  // request mounts; the rest stay pending and their rows keep 'Needs approval' above.
  const shownApprovals = visibleApprovals(approvals);
  // A pending card's Esc / ⌘⏎ also work from this composer while it is empty (use-card-hotkeys, official
  // isOwnComposer + hasComposerDraft): the card reads the editor and the draft flag at key time.
  cardComposerDraft.current = !!draft.trim() || attachments.length > 0;
  const cardComposer = useMemo(() => ({ composerRef: textarea, draftRef: cardComposerDraft }), []);
  // R07 'Open plan' (Rse :9734-9752): the review's plan item (bridge projection
  // `plan-<exit_plan_mode call id>`, else the turn's latest plan), scrolled to and focused.
  const planItemFor = (request) => items.find((item) => request.params?.itemId && item.id === `plan-${request.params.itemId}`)
    ?? [...items].reverse().find((item) => item.type === "plan" && item.turnId === request.params?.turnId);
  function openPlanItem(itemId) {
    const row = scope().querySelector(`.transcript [data-transcript-item-id="${CSS.escape(itemId)}"]`);
    if (!row) return;
    row.scrollIntoView({ block: "start" });
    if (!row.hasAttribute("tabindex")) row.setAttribute("tabindex", "-1");
    row.focus({ preventScroll: true });
  }
  // R07 Dd (cc43287c9 :32430-32453; send paths :33199, :34705): a message sent while a
  // question waits answers it with the 'sent a message instead' marker (yk re,
  // approval-current.js:8048-8066), through the card's ticket and visible-thread check.
  // Plan reviews, isOther:false/secret questions and sub-agent questions stay pending.
  async function dismissPendingQuestions(threadId) {
    const runtime = approvalRuntime.current;
    for (const request of state.approvals) {
      if (request.method !== "item/tool/requestUserInput" || request.params?.threadId !== threadId) continue;
      const response = dismissQuestionPayload(request), ticket = response && runtime.ticketFor(request);
      if (!ticket) continue;
      await runtime.submit(ticket, "dismiss", (payload) => respondApproval(request, payload), { response,
        getVisibleThreadId: () => (currentRef.current && approvalOwner(request) === currentRef.current ? request.params?.threadId : currentRef.current) });
    }
  }
  // Full-text sidebar search on a core that has it (capabilities.threadSearch: Codex thread/search): a moment after the
  // last keystroke, the sessions whose conversation matches join the title matches (main.cjs thread-search).
  const [searchMatches, setSearchMatches] = useState(null);
  useEffect(() => {
    const term = search.trim();
    if (term.length < 2 || !boot?.connected || !coreSupports(boot?.core, "threadSearch")) { setSearchMatches(null); return; }
    let live = true;
    const timer = setTimeout(() => {
      call("thread-search", { searchTerm: term }).then((result) => {
        if (live) setSearchMatches({ query: term, ids: new Set((Array.isArray(result?.data) ? result.data : []).map((match) => match.id)) });
      }, () => { if (live) setSearchMatches(null); });
    }, 300);
    return () => { live = false; clearTimeout(timer); };
  }, [search, boot?.connected, boot?.core]);
  const groups = useMemo(() => {
    const g = {};
    // The ⌘K palette's query never filters the sidebar (source-sidebar-palette.jsx searches on its own).
    sessions.forEach((s) => {
      (g[s.cwd || cwd] ??= []).push(s);
    });
    return Object.entries(g);
  }, [sessions, cwd]);
  // F08 Folder grouping (sidebar-session.js:20892-20903 IJ): resolve the repo identity of every folder the
  // sidebar shows, off the render path; until an entry arrives the sidebar keys that folder on its cwd.
  // Whatever the grouping: the Action Center row meta (cc43287c9 tA :5416-5417) reads it too.
  const repoFolderKey = [...new Set([cwd, ...sessions.map((thread) => thread.cwd)].filter((dir) => typeof dir === "string" && dir))].sort().join("\u0000");
  useEffect(() => {
    const missing = repoFolderKey ? repoFolderKey.split("\u0000").filter((dir) => !Object.hasOwn(repoIdentities, dir)) : [];
    if (missing.length === 0 || !api) return;
    // An identity does not depend on the request that found it, so a late answer is still merged.
    call("repo-identities", { cwds: missing })
      .then((found) => { if (found && typeof found === "object") setRepoIdentities((previous) => ({ ...previous, ...found })); })
      .catch(() => {});
  }, [repoFolderKey]);
  // An identity can change while the app runs (the agent or the terminal ran `git init` or `git remote add`): the open
  // folder's is read again when its git status disagrees about being a repository, after each of its turns and when
  // the window gains focus, so the sidebar's project group and the PR action follow without a restart.
  const refreshRepoIdentity = useCallback((dir) => {
    if (!api || typeof dir !== "string" || !dir) return;
    call("repo-identities", { cwds: [dir], fresh: true })
      .then((found) => { const next = found?.[dir]; if (next && typeof next === "object") setRepoIdentities((previous) => JSON.stringify(previous[dir]) === JSON.stringify(next) ? previous : { ...previous, [dir]: next }); })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const workdirIdentity = workdir ? repoIdentities[workdir] : undefined;
  useEffect(() => {
    if (!workdir || !gitStatus || workdirIdentity === undefined) return;
    if (!!gitStatus.isRepo !== !!workdirIdentity?.isRepo) refreshRepoIdentity(workdir);
  }, [workdir, gitStatus?.isRepo, workdirIdentity?.isRepo]); // eslint-disable-line react-hooks/exhaustive-deps
  const workdirRef = useRef(workdir);
  workdirRef.current = workdir;
  useEffect(() => {
    const onFocus = () => refreshRepoIdentity(workdirRef.current);
    globalThis.addEventListener?.("focus", onFocus);
    return () => globalThis.removeEventListener?.("focus", onFocus);
  }, [refreshRepoIdentity]);
  useEffect(() => {
    let live = true;
    setWorkspaceInfo(null);
    if (workdir)
      call("workspace-info", { cwd: workdir })
        .then((r) => live && setWorkspaceInfo(r))
        .catch(() => {});
    return () => {
      live = false;
    };
  }, [workdir]);
  useEffect(() => {
    const refresh = () => setGitRefresh(value => value + 1);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  useEffect(() => {
    // Only a session/cwd switch discards the known repository state; refetches
    // (turn start/end, focus, 10s poll) keep the previous data like the official
    // react-query `ui` does, so the band never unmounts between polls. The
    // revisited session's last band is held meanwhile (bandHold below).
    setGitStatus(null);
    setGitStatusError("");
    setGitDiff(null);
    setGitDiffError("");
  }, [current, workdir]);
  useEffect(() => {
    // Official cc70f2bdf ui: the diff-stats query refetches on window focus and
    // every 10s while the session is responding. Results for a superseded
    // session/cwd are dropped; a query still in flight is never duplicated; an
    // unchanged result keeps the previous object.
    let live = true, inFlight = false;
    if (!current || !workdir) return undefined;
    // A menu Refresh re-reads the diff after the fresh status lands, in the same
    // update as any change-key move, so the diff effect runs exactly once.
    const refreshedDiff = () => { if (diffRefreshRequested.current) { diffRefreshRequested.current = false; setDiffRefresh(value => value + 1); } };
    const query = () => {
      if (inFlight) return;
      inFlight = true;
      call("workspace-git-status", { cwd: workdir, sessionId: current })
        .then(result => { if (live) { rememberGitBand(current, result); setGitStatus(previous => sameGitStatus(previous, result) ? previous : result); setGitStatusError(""); refreshedDiff(); } })
        .catch(reason => { if (live) { setGitStatusError(t("Could not read repository changes: {reason}", { reason: reason.message })); setError(t("Could not read repository changes: {reason}", { reason: reason.message })); refreshedDiff(); } })
        .finally(() => { inFlight = false; });
    };
    query();
    const timer = running ? setInterval(query, GIT_STATUS_RESPONDING_INTERVAL) : null;
    return () => { live = false; if (timer) clearInterval(timer); };
  }, [current, workdir, running, gitRefresh]);
  const changeKey = gitChangeKey(gitStatus);
  // F12 Changes diff scope (panes-tile-current.js:2949-3110 zm; Od he = {kind:"branch"}): per session,
  // "All changes vs {base}" by default, "Uncommitted changes", a commit, or another base via "Compare against".
  const diffScope = useDiffScope({ call, cwd: workdir, sessionId: current, status: gitStatus, active: openPanes.has("changes"), refreshKey: diffRefresh });
  const diffScopeKey = JSON.stringify([diffScope.param ?? null, diffScope.base ?? null]);
  const shownDiffScope = useRef(null);
  useEffect(() => {
    // The Changes panel re-reads the full worktree diff only when the panel opens
    // or the change signal moves; the previous diff stays on screen meanwhile.
    // A scope change drops the other scope's patch first (loading, not a stale body).
    if (!openPanes.has("changes") || !changeKey) { setGitDiff(null); setGitDiffError(""); return undefined; }
    if (shownDiffScope.current !== diffScopeKey) { shownDiffScope.current = diffScopeKey; setGitDiff(null); setGitDiffError(""); }
    let live = true;
    call("workspace-git-diff", { cwd: workdir, sessionId: current, completeContext: true, scope: diffScope.param, ...(diffScope.base ? { base: diffScope.base } : {}) })
      .then(result => { if (live) { setGitDiff(result); setGitDiffError(""); } })
      .catch(reason => { if (live) { setGitDiff(""); setGitDiffError("Could not load repository diff: " + reason.message); } });
    return () => { live = false; };
  }, [openPanes, workdir, changeKey, diffRefresh, diffScopeKey]);
  const refreshChanges = useCallback(() => { diffRefreshRequested.current = true; setGitRefresh(value => value + 1); }, []);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  async function refreshSession(id) {
    // A sub-agent thread reaches this connection with its own threadId
    // (thread_processor.rs:3609-3640) but is not a session: neither the
    // official sidebar nor thread/list surfaces it (filters.rs:121-150).
    if (childThreads.current.has(id)) return;
    try {
      const r = await rpc("thread/read", { threadId: id, includeTurns: false });
      if (isSubAgentThread(r.thread)) { childThreads.current.add(id); return; }
      setSessions((s) => [r.thread, ...s.filter((t) => t.id !== id)]);
    } catch {}
  }
  // thread/queue/list for the visible session; stale sessions are dropped.
  // A failure (e.g. a thread the server has not loaded) leaves the bar empty.
  async function loadQueue(id) {
    if (!id) return;
    try {
      const result = await rpc("thread/queue/list", { threadId: id });
      if (currentRef.current !== id) return;
      setQueue((previous) => queueFromList(shownQueueList(result), id, previous.threadId === id ? previous : emptyQueue(id)));
    } catch {
      if (currentRef.current === id) setQueue((previous) => (previous.threadId === id ? previous : emptyQueue(id)));
    }
  }
  function revokePreview(entry) {
    if (entry?.previewUrl?.startsWith("blob:")) { try { URL.revokeObjectURL(entry.previewUrl); } catch {} }
  }
  // Per-session drafts (composer-draft-store.mjs; code-workspace.js:1888-1915, cc43287c9-BMbiZYzF.js:28617 and
  // :6425-6450): leaving a session stashes its text, staged attachments and '@' mentions under
  // `epitaxy-${sessionId}` (the home draft under one key), entering one restores its entry. Stashed
  // attachments keep their preview URLs; only a clear (successful send or command) or a discard revokes.
  // The live values are read from a ref, so a navigation from a mount-time listener stashes the latest draft.
  const composerDrafts = useRef(new Map()), liveComposer = useRef(null);
  liveComposer.current = { text: draft, attachments, mentions };
  // R05 persisted drafts (shared-7-DsClUbcz.js ox 'composer-draft:' + cx/px key, Xx/Qx/Rx; cc43287c9 :6428-6457,
  // :7300-7330 restored_draft): the live composer is mirrored to localStorage (debounced, written at once on a switch
  // and flushed before unload, so ⌘R or a restart keeps it). A key the in-memory map lacks (boot → Home, openSession)
  // is read back; its attachment refs are staged again through 'attachments:inspect' (missing files drop out), and
  // the stored entry is left alone until that finishes.
  const draftRestores = useRef(new Set()), pendingDraftWrite = useRef(null);
  function persistComposer(key, value) {
    if (!draftRestores.current.has(key)) persistDraft(browserStorage(), key, value);
  }
  function restorePersistedDraft(key) {
    const stored = readPersistedDraft(browserStorage(), key);
    if (!stored) return null;
    if (stored.attachments.length) rehydrateDraftAttachments(key, stored.attachments);
    return { text: stored.text, mentions: stored.mentions, attachments: [] };
  }
  function rehydrateDraftAttachments(key, refs) {
    draftRestores.current.add(key);
    const stage = (files) => (entries) => {
      const staged = stageFiles(entries, files, { imagesAllowed: true });
      let next = staged.entries;
      for (const entry of staged.added) if (entry.kind === "image") next = markReady(next, entry.id, { previewUrl: filePreviewUrl(entry.path) });
      return next;
    };
    call("attachments:inspect", { paths: refs.map((ref) => ref.path) })
      .then((files) => {
        if (!Array.isArray(files) || files.length === 0) return;
        if (draftKey(currentRef.current) === key) { setAttachments(stage(files)); return; }
        const entry = composerDrafts.current.get(key);
        if (entry) composerDrafts.current = new Map(composerDrafts.current).set(key, { ...entry, attachments: stage(files)(entry.attachments) });
      })
      .catch(() => {})
      .finally(() => { draftRestores.current.delete(key); });
  }
  function switchComposerDraft(leaving, entering) {
    pendingDraftWrite.current = null;
    persistComposer(draftKey(leaving), liveComposer.current);
    const stashed = saveDraft(composerDrafts.current, draftKey(leaving), liveComposer.current);
    let restored = takeDraft(stashed, draftKey(entering));
    if (!stashed.has(draftKey(entering))) restored = { map: restored.map, draft: restorePersistedDraft(draftKey(entering)) ?? restored.draft };
    composerDrafts.current = restored.map;
    liveComposer.current = restored.draft;
    setDraft(restored.draft.text);
    setAttachments(restored.draft.attachments);
    setMentions(restored.draft.mentions);
  }
  // A send or command resolved after its session was left: drop that session's stashed copy if it still
  // holds the submitted text, and release its previews.
  function clearStashedDraft(sessionId, text) {
    const cleared = clearDraft(composerDrafts.current, draftKey(sessionId), { text });
    composerDrafts.current = cleared.map;
    cleared.draft?.attachments.forEach(revokePreview);
    forgetDraft(browserStorage(), draftKey(sessionId), { text });
  }
  useEffect(() => {
    const key = draftKey(current), value = { text: draft, attachments, mentions }, pending = { key, value };
    pendingDraftWrite.current = pending;
    // A write someone else took over (a switch, the unload flush, a Home send handing its draft on) is skipped.
    const timer = setTimeout(() => { if (pendingDraftWrite.current !== pending) return; pendingDraftWrite.current = null; persistComposer(key, value); }, 300);
    return () => clearTimeout(timer);
  }, [current, draft, attachments, mentions]);
  useEffect(() => {
    const flush = () => { const pending = pendingDraftWrite.current; pendingDraftWrite.current = null; if (pending) persistComposer(pending.key, pending.value); };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    // Boot opens Home: its stored draft comes back unless something already filled the composer.
    if (side === 0 && !currentRef.current && !liveComposer.current.text && liveComposer.current.attachments.length === 0) {
      const stored = restorePersistedDraft(homeDraftKey);
      if (stored) { liveComposer.current = stored; setDraft(stored.text); setMentions(stored.mentions); }
    }
    // A secondary split side closing (unmount) keeps its draft like a reload does.
    return () => { flush(); window.removeEventListener("pagehide", flush); window.removeEventListener("beforeunload", flush); };
  }, []);
  // R05 'Send and stay here' (cc43287c9 :35140-35200, :31913 [Kc,qc] backgroundSpawnCount, :27612 Jr): Home
  // launches held while a detached spawn is in flight; the Home composer is disabled until it settles, then refocused.
  const [backgroundSpawns, setBackgroundSpawns] = useState(0), backgroundSpawnsRef = useRef(0), spawnFocus = useRef(false);
  useEffect(() => {
    if (backgroundSpawns > 0 || !spawnFocus.current) return;
    spawnFocus.current = false;
    if (!currentRef.current) textarea.current?.focus();
  }, [backgroundSpawns]);
  // R05 branch step 2 (cc43287c9 :12084-12145 me/he/ge, GR :15920-16120): the dirty-tree dialog's payload.
  const [branchSwitch, setBranchSwitch] = useState(null), branchPick = useRef(null), branchFolder = useRef(workdir);
  branchFolder.current = workdir;
  const shownBranchSwitch = useDialogRetention(branchSwitch);
  // D(e): record the pick; the real branch stays in checkedOut until a worktree-less spawn switches to it.
  function recordBranch(branch, head) {
    setWorkspaceInfo((info) => (info ? { ...info, branch, checkedOut: head || checkedOutBranch(info) } : info));
  }
  // he → me: with worktree off, a branch other than the checked-out one checks the working tree first (a failed
  // check counts as dirty); a clean tree records it, a dirty one opens GR. A newer pick or folder wins.
  async function selectBranch(target) {
    const folder = workdir, checkedOut = checkedOutBranch(workspaceInfo);
    branchPick.current = target;
    if (branchSwitchPlan({ worktree, current: checkedOut, target }) !== "checkout-on-send") { recordBranch(target); return; }
    let check = null;
    try { check = await call("branch-switch-check", { cwd: folder, target }); } catch {}
    if (branchPick.current !== target || branchFolder.current !== folder) return;
    const head = check?.branch || checkedOut;
    const plan = branchSwitchPlan({ worktree, dirty: check ? check.dirty : true, current: head, target });
    if (plan === "resolve-dialog") setBranchSwitch({ cwd: folder, currentBranch: head, targetBranch: target, status: check });
    else recordBranch(target, check?.branch);
  }
  // Late staging results (markReady / markFailed) reach the live composer and every stashed draft.
  function updateComposerAttachments(update) {
    setAttachments(update);
    composerDrafts.current = mapDraftAttachments(composerDrafts.current, update);
  }
  function removeComposerAttachment(id) {
    setAttachments((entries) => { entries.filter((entry) => entry.id === id).forEach(revokePreview); return removeAttachment(entries, id); });
  }
  const filePreviewUrl = (filePath) => encodeURI(`file://${filePath}`);
  // Paste (image lane, official q/ue) and Finder drop: files with a real path
  // are referenced in place; clipboard images are persisted by the main
  // process so localImage can carry an actual path. Notices use the official
  // toast copy on the existing error surface. A model without image input
  // refuses images on both lanes (the composer passes imagesAllowed too).
  function stageComposerFiles(files, { imagesOnly = false, imagesAllowed: allowed = imagesAllowed } = {}) {
    const descriptors = files.map((file) => {
      const filePath = typeof api?.pathForFile === "function" ? api.pathForFile(file) : "";
      return { file, name: file.name, size: file.size, type: file.type, path: filePath || "" };
    });
    // The updater only computes; what follows (notices, toasts, staging clipboard images) runs once React has
    // actually applied it. React may defer an updater past this call (a screenshot staged after an await while other
    // updates are queued), so the follow-up is scheduled from inside the updater with that run's outcome, never from a
    // microtask that could find nothing collected yet. A repeated run replaces the outcome; the follow-up runs once.
    let outcome = null, scheduled = false;
    setAttachments((entries) => {
      const referenced = descriptors.filter((item) => item.path);
      const clipboard = descriptors.filter((item) => !item.path);
      let next = entries, notices = [];
      const first = stageFiles(next, referenced, { imagesOnly, imagesAllowed: allowed, imageFallback });
      next = first.entries; notices = notices.concat(first.notices);
      for (const entry of first.added) if (entry.kind === "image") next = markReady(next, entry.id, { previewUrl: filePreviewUrl(entry.path) });
      const second = stageFiles(next, clipboard.map((item) => ({ name: item.name, size: item.size, type: item.type, previewUrl: URL.createObjectURL(item.file) })), { imagesOnly: true, imagesAllowed: allowed, imageFallback });
      next = second.entries; notices = notices.concat(second.notices.filter((notice) => !notices.includes(notice)));
      const infos = [...new Set([...(first.infos ?? []), ...(second.infos ?? [])])];
      const pending = second.added.map((entry) => ({ entry, file: clipboard.find((item) => item.name === entry.name && item.size === entry.size)?.file }));
      outcome = { notices, infos, pending };
      if (!scheduled) { scheduled = true; queueMicrotask(() => followStaging(outcome)); }
      return next;
    });
  }
  function followStaging({ notices, infos, pending }) {
    if (infos.length && toasts) toasts.add(infos.join("\n"), { variant: "neutral" });
    if (notices.length) {
      const text = notices.join("\n");
      setError(text);
      // notifyMaxImages (c099c328d :1565-1577): 'Maximum of {max} images allowed.' goes away after 8s.
      if (notices.some((notice) => isMaxImagesNotice(notice))) setTimeout(() => setErrorText((value) => (value === cleanErrorReason(text) ? "" : value)), MAX_IMAGES_TIMEOUT);
    }
    (async () => {
      for (const { entry, file } of pending) {
        try {
          if (!file) throw new Error(t("Failed to process image. You can try again."));
          const bytes = new Uint8Array(await file.arrayBuffer());
          const staged = await call("attachments:stage", { name: entry.name, type: entry.mime, bytes });
          updateComposerAttachments((entries) => (entries.some((item) => item.id === entry.id) ? markReady(entries, entry.id, { path: staged.path }) : entries));
        } catch (reason) {
          // The entry leaves wherever it now lives (live or stashed); the official notice follows only while it existed.
          const known = liveComposer.current.attachments.some((item) => item.id === entry.id)
            || [...composerDrafts.current.values()].some((stash) => stash.attachments.some((item) => item.id === entry.id));
          updateComposerAttachments((entries) => markFailed(entries, entry.id).entries);
          if (known) { revokePreview(entry); setError(t(IMAGE_PROCESS_ERROR)); }
        }
      }
    })();
  }
  // Trusted files:search on the composer lane for "@" mentions (50 results,
  // superseded/cancelled requests resolve to an empty list).
  const mentionRequest = useRef(0);
  // The core's references for a folder (capabilities.references: OpenCode's `references` config), kept a minute.
  const mentionReferences = useRef(new Map());
  async function coreReferences(folder) {
    if (!folder || !coreSupports(boot?.core, "references")) return [];
    const cached = mentionReferences.current.get(folder);
    if (cached && Date.now() - cached.at < 60000) return cached.data;
    const data = await rpc("codeDesktop/references/list", { cwd: folder }).then((value) => (Array.isArray(value?.data) ? value.data : []), () => []);
    mentionReferences.current.set(folder, { at: Date.now(), data });
    return data;
  }
  // What the core's own @ names besides files (capabilities.mentionTargets: Qwen's @mcp: / @ext:), kept a minute.
  const mentionTargetCache = useRef(new Map());
  async function coreMentionTargets(folder) {
    if (!coreSupports(boot?.core, "mentionTargets")) return [];
    const key = folder || "";
    const cached = mentionTargetCache.current.get(key);
    if (cached && Date.now() - cached.at < 60000) return cached.data;
    const data = await rpc("codeDesktop/mentions/list", folder ? { cwd: folder } : {}).then((value) => (Array.isArray(value?.data) ? value.data : []), () => []);
    mentionTargetCache.current.set(key, { at: Date.now(), data });
    return data;
  }
  async function searchMentionFiles(query) {
    const trimmed = query.trim().slice(0, 64);
    const root = current ? undefined : (workdir || cwd);
    if (!current && !root) return [];
    const requestId = `mention-${++mentionRequest.current}`;
    try {
      // A bare '@' browses: the project's files, shallowest first (the official provider lists the index for '').
      const [result, references, targets] = await Promise.all([
        call("files:search", { pane: "composer", requestId, sessionId: current ?? null, homeWorkspace: current ? undefined : root, query: trimmed, browse: !trimmed }),
        coreReferences(workdir || cwd).catch(() => []),
        coreMentionTargets(workdir || cwd).catch(() => []),
      ]);
      const needle = trimmed.toLowerCase();
      // References first ('@docs'), then the core's own targets and sessions, then the project's files.
      const named = references.filter((entry) => !needle || entry.name.toLowerCase().includes(needle))
        .map((entry) => ({ reference: true, path: entry.name, target: entry.path, description: entry.description || entry.source?.repository || entry.path }));
      const literal = targets.filter((entry) => !needle || entry.name.toLowerCase().includes(needle) || entry.text.toLowerCase().includes(needle))
        .map((entry) => ({ literal: true, kind: entry.kind, name: entry.name, text: entry.text, description: [entry.kind === "extension" ? t("Extension") : t("Connector"), entry.description].filter(Boolean).join(" · ") }));
      // Another session in this folder (capabilities.sessionMentions: ZCode's # mentions, read with ReadSessionContext).
      const folder = workdir || cwd;
      const others = coreSupports(boot?.core, "sessionMentions")
        ? sessions.filter((entry) => entry?.id && entry.id !== current && (!folder || entry.cwd === folder) && !sessionArchived(entry) && !sessionParentId(entry))
          .filter((entry) => !needle || (entry.name || entry.preview || "").toLowerCase().includes(needle)).slice(0, 8)
          .map((entry) => ({ session: { id: entry.id, title: entry.name || entry.preview || t("Untitled session") }, description: t("Session") })) : [];
      return [...named, ...literal, ...others, ...(result?.error ? [] : (result?.matches || []))];
    } catch { return []; }
  }
  function rememberMention(option) {
    setMentions((list) => (list.some((entry) => entry.path === option.path) ? list : [...list, { path: option.path, name: option.label, ...(option.target ? { target: option.target } : {}),
      ...(option.literal ? { literal: true } : {}), ...(option.session ? { session: option.session } : {}) }]));
  }
  // The mention chip's menu (c856385e2 Z for a ccd-files mention): Copy ▸ with the c3e58cab4 'Copied to clipboard.'
  // toast, Open in ▸ Files pane. Paths are relative to the root the '@' search ran in.
  const mentionActions = { root: workdir || cwd, onCopy: (text) => copyWithToast(text, t("Copied to clipboard.")), onOpen: (path) => openFileRef({ path }) };
  // Queue bar actions over the real Codex queue with optimistic removal and
  // rollback; edit = delete + restore into the draft (official onEdit).
  async function queueCancel(id) {
    const threadId = queue.threadId;
    if (!threadId || queue.lockedIds.includes(id)) return;
    setQueue((current) => lockEntry(current, id));
    try {
      await rpc("thread/queue/delete", { threadId, queuedSubmissionId: id });
      setQueue((current) => (current.threadId === threadId ? optimisticRemove(current, id).queue : current));
    } catch (reason) {
      setQueue((current) => unlockEntry(current, id));
      setError(reason.message);
    }
  }
  async function queueEdit(id) {
    const threadId = queue.threadId, entry = queue.entries.find((item) => item.id === id);
    if (!threadId || !entry || queue.lockedIds.includes(id)) return;
    setQueue((current) => lockEntry(current, id));
    try {
      await rpc("thread/queue/delete", { threadId, queuedSubmissionId: id });
      setQueue((current) => (current.threadId === threadId ? optimisticRemove(current, id).queue : current));
      const restored = editableDraft(entry);
      setDraft((value) => (value.trim() ? `${restored.text}\n${value}` : restored.text));
      if (restored.attachments.length) setAttachments((entries) => {
        const staged = stageFiles(entries, restored.attachments.map((item) => ({ name: item.name || attachmentBasename(item.path), path: item.path, type: "" })), { imagesAllowed });
        let next = staged.entries;
        for (const added of staged.added) if (added.kind === "image") next = markReady(next, added.id, { previewUrl: filePreviewUrl(added.path) });
        if (staged.notices.length) setError(staged.notices.join("\n"));
        return next;
      });
      textarea.current?.focus();
    } catch (reason) {
      setQueue((current) => unlockEntry(current, id));
      setError(reason.message);
    }
  }
  async function queueReorder(fromId, toId) {
    const threadId = queue.threadId;
    if (!threadId) return;
    const { queue: next, rollback, ids } = optimisticReorder(queue, fromId, toId);
    if (next === queue) return;
    setQueue(next);
    try { await rpc("thread/queue/reorder", { threadId, queuedSubmissionIds: ids }); }
    catch (reason) { setQueue((current) => (current.threadId === threadId ? rollback(current) : current)); setError(reason.message); }
  }
  async function init() {
    setLoading(true);
    try {
      const b = await call("init");
      registerCores(b.extensionCores); // imported Extension Pack cores (extension-packs.cjs)
      setBoot(b);
      setLocalPreferences(appearancePreferences(b.config));
      setSpeed(savedSpeed(b.config));
      setSidebarPreferences(b.config.sidebarPreferences || {});
      setSessionMetadata(b.config.sessionMetadata || {});
      setCustomGroups(b.config.customGroups || []);
      setPinnedOrder(Array.isArray(b.config.pinnedOrder) ? b.config.pinnedOrder : []);
      setProjectOrder(Array.isArray(b.config.projectOrder) ? b.config.projectOrder : []);
      sidebarRevision.current = b.config.sidebarRevision || 0;
      setDisplayName(b.config.displayName || "");
      // shared-2 $m: a stored number is clamped by qm (200..420), else Km.DEFAULT.
      setSidebarWidth(storedSidebarWidth(b.config.sidebarWidth));
      // shared-2 Zm {collapsed, sidebarWidth}: collapsed is restored with the width.
      collapsedRef.current = b.config.sidebarCollapsed === true;
      setCollapsed(collapsedRef.current);
      setFullScreen(b.fullScreen || false);
      setZoomFactor(Number.isFinite(b.zoomFactor) ? b.zoomFactor : 1);
      setPermission(savedPermission(b.config));
      setCwd(b.config.cwd);
      setTheme(b.config.theme);
      setMode(b.config.mode || "code");
      const selected =
        b.models?.find((m) => m.model === b.config.model) ||
        b.models?.find((m) => m.isDefault) ||
        b.models?.[0];
      setModel(selected?.model || "");
      setEffort(
        selected?.supportedReasoningEfforts?.some(
          (e) => e.reasoningEffort === b.config.effort,
        )
          ? b.config.effort
          : selected?.defaultReasoningEffort || "medium",
      );
      setError(b.error || b.warnings?.join("\n") || "");
      if (b.approvalSnapshot)
        dispatch({ event: { ...b.approvalSnapshot, kind: "approval-snapshot" } });
      for (const notice of Array.isArray(b.connectionNotices) ? b.connectionNotices : []) dispatch({ event: notice });
      for (const operation of b.sessionOperations || []) dispatch({event:{...operation, kind:'session-operation', connectionId:b.approvalSnapshot?.connectionId, connectionEpoch:b.approvalSnapshot?.connectionEpoch}});
      if (b.connected) await loadSessions(b);
      // The context usage main kept for threads still attached across a window reload (no core replays it then).
      if (b.connected && b.threadUsage && typeof b.threadUsage === "object") dispatch({ type: "usage-restore", usage: b.threadUsage });
      // Split view / windows: the secondary side opens the session it was split with; the primary side restores this
      // window's layout (a relaunch, or the session a new window was opened for: main.cjs windowLayout).
      if (side === 1 && initialSession && b.connected) navigate(initialSession);
      if (side === 0 && b.connected) restoreWindowLayout(b.windowLayout);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setInitSettled(true);
    }
  }
  // Session list (thread/read per owned id + archived metadata). Marks the list
  // loaded so the home leaves its remembered-shape placeholder. Sessions of
  // the other core and unreadable ids are counted for the sidebar notice and
  // stay in config, so switching cores brings them back.
  async function loadSessions(b) {
    const own = b.config.threadIds || [], archivedIds = b.config.archivedThreadIds || [];
    const results = await Promise.allSettled(
      own.map((threadId) =>
        rpc("thread/read", { threadId, includeTurns: false }),
      ),
    );
    const { active, archived, otherEngine, missing, missingIds } = partitionSessions({ ids: own, results, metadata: b.config.threadMetadata || {}, archivedIds, engine: coreEngine(b.core) });
    setSessions([...active, ...archived]);
    setHiddenSessions({ otherEngine, missing, missingIds });
    sessionsCoreRef.current = coreEngine(b.core);
    // Tile layouts of hidden sessions are kept for when their core is back.
    tileStore.prune([HOME_TILE_KEY, ...own, ...archivedIds]);
    sessionsLoadedRef.current = true;
    setSessionsLoaded(true);
    return { active, archived };
  }
  useEffect(() => {
    const unsub = api?.onEvent((e) => {
      if(e.kind === "workflow") {setWorkflowRuns(old=>mergeWorkflow(old,e.run));return;}
      dispatch({ event: e });
      if (side === 0) customizeStore.observe(e);
      if(e.kind === "desktop-navigate" && side === 0) openInFocusedSide(e.threadId);
      if(e.kind === "desktop-archived") setSessions(rows=>rows.map(row=>row.id===e.threadId?{...row,archived:true}:row));
      if (e.kind === "window") setFullScreen(e.fullScreen);
      if (e.kind === "zoom-factor" && Number.isFinite(e.zoomFactor)) setZoomFactor(e.zoomFactor);
      if (e.kind === "popouts") setPopouts(Array.isArray(e.popouts) ? e.popouts : []);
      if (e.kind === "popout-docked" && typeof e.sessionId === "string" && side === 0) openPaneTile(e.pane, e.sessionId);
      // The agent opened a page in a session's preview (preview_start / navigate): that session shows its Preview pane.
      if (e.kind === "preview-reveal" && typeof e.sessionId === "string" && side === 0) openPaneTile("preview", e.sessionId);
      if (e.kind === "toggle-sidebar" && side === 0) toggleSidebarRef.current?.();
      // Menu commands go to the focused split side; the sidebar search lives in the primary side.
      if (e.kind === "navigate" && (e.delta === -1 || e.delta === 1) && splitActiveRef.current) travelShortcutRef.current?.(e.delta);
      if (MENU_COMMANDS.has(e.kind) && (e.kind === "open-search" ? side === 0 : splitActiveRef.current)) menuCommandRef.current?.(e);
      // Edit ▸ Find (app-menu.cjs ISr): the transcript's find bar (source-find-bar.jsx) opens or steps.
      if (e.kind === "find-open" && splitActiveRef.current) transcriptRef.current?.openFind?.();
      if (e.kind === "find-step" && splitActiveRef.current) transcriptRef.current?.stepFind?.(e.forward !== false);
      if (e.kind === "open-settings" && side === 0) { setMenu(null); setActionDialog(null); setWhatsNew(false); setShowSearch(false); setRename(null); setSettings(true); }
      if (e.kind === "stats" && e.stats && Array.isArray(e.stats.dailyActivity)) setStatsSnapshot(e.stats);
      // An Extension Pack was imported or removed: register its cores and re-render what keys on them.
      if (e.kind === "extensions" && Array.isArray(e.cores)) { registerCores(e.cores); setBoot(value => value ? { ...value, extensionCores: e.cores } : value); }
      if (e.kind === "connection") {
        if (!e.connected) { resumed.current.clear(); childThreads.current.clear(); }
        // boot.core survives a disconnect; a (re)connect refreshes it (main.cjs connectionEvent).
        // Before init() resolves boot stays null (the catalog is still loading); init carries the fresher state.
        setBoot((b) => b && ({ ...b, connected: e.connected, ...(e.core ? { core: e.core } : {}) }));
        // Another window switched cores (Settings › Cores): this window's copy, models and efforts are the old core's
        // ("Message DeepSeek" while Codex runs). It reloads too, as the window that switched does (switchCore); the
        // switch's own disconnect is no error here.
        // The name main.cjs chose (config.core), not one derived from the engine: a test fixture or a CODEX_BINARY
        // override reports no engine (read as Codex) while the copy rightly stays the chosen core's.
        if (e.connected && typeof e.assistant === "string" && !coreSwitchReload.current && e.assistant !== getAssistantName()) {
          coreSwitchReload.current = true;
          setTimeout(() => location.reload(), 150);
        } else if (e.error && !coreSwitchReload.current) setError(e.error);
      }
      if (e.method === "thread/started" && e.params?.thread?.id && isSubAgentThread(e.params.thread)) childThreads.current.add(e.params.thread.id);
      if (e.method === "turn/completed") { refreshSession(e.params.threadId); if (e.params.threadId === currentRef.current) { loadQueue(e.params.threadId); refreshRepoIdentity(workdirRef.current); } }
      // Steers the model never took: an interrupted turn discards them on the server, so they come back to the
      // composer (Codex input_restore.rs); after a normal end they are dropped once the transcript is reloaded.
      if (e.method === "turn/completed" && pendingSteersRef.current[e.params?.threadId]?.length) {
        const threadId = e.params.threadId, left = pendingSteersRef.current[threadId].filter((entry) => !e.params?.turn?.id || entry.turnId === e.params.turn.id);
        setPendingSteers((all) => ({ ...all, [threadId]: (all[threadId] ?? []).filter((entry) => !left.includes(entry)) }));
        if (e.params?.turn?.status === "interrupted" && left.length) restoreSteers(threadId, left);
      }
      // F08 (context-menu-shared.js:19421-19437 kR, sidebar-groups.js:9030-9040): a turn that completes
      // for a sidebar row other than the open session leaves it 'Unread response'; opening it clears it.
      if (side === 0 && e.method === "turn/completed" && !splitStore.isShown(e.params?.threadId) && unreadOnTurnCompleted({ threadId: e.params?.threadId, currentId: currentRef.current,
        knownIds: new Set(sessionsRef.current.map((thread) => thread.id)), ownerOf: (id) => childThreads.current.has(id) ? null : ownerThreadId(latestState.current, id) }))
        updateSessionMetadata(e.params.threadId, { unread: true }, { automatic: true }).catch(() => {});
      if (e.method === "thread/queue/changed" && e.params?.threadId === currentRef.current) loadQueue(e.params.threadId);
      // The agent put itself into plan mode (ACP bridge codeDesktop/thread/mode: Kimi's EnterPlanMode, Gemini's
      // enter_plan_mode): the picker follows, so the next turn goes out as Plan and the plan card leaves it.
      if (e.method === "codeDesktop/thread/mode" && e.params?.threadId === currentRef.current && e.params.permission === "plan") agentModeRef.current?.("plan");
      // The core's suggested next prompt (MiMo /predict, Qwen follow-up suggestions); a new turn drops it.
      if (e.method === "codeDesktop/promptSuggestion" && typeof e.params?.threadId === "string" && typeof e.params.suggestion === "string" && e.params.suggestion.trim())
        setPromptSuggestions((all) => ({ ...all, [e.params.threadId]: e.params.suggestion.trim().slice(0, 400) }));
      if (e.method === "turn/started" && typeof e.params?.threadId === "string") setPromptSuggestions((all) => all[e.params.threadId] ? { ...all, [e.params.threadId]: null } : all);
      // An agent-generated title (thread/name/updated) names the sidebar row and the window title.
      if (e.method === "thread/name/updated" && typeof e.params?.threadId === "string" && typeof e.params.threadName === "string" && e.params.threadName.trim())
        setSessions((rows) => rows.map((row) => row.id === e.params.threadId ? { ...row, name: e.params.threadName.trim() } : row));
      // A pull request the core bound to a session (codeDesktop/thread/pr: Qwen after `gh pr create`).
      if (e.method === "codeDesktop/thread/pr" && typeof e.params?.threadId === "string" && e.params.pr && typeof e.params.pr === "object")
        setSessions((rows) => rows.map((row) => row.id === e.params.threadId ? { ...row, codeDesktop: { ...row.codeDesktop, pr: e.params.pr }, prState: row.prState ?? "open", prLink: typeof e.params.pr.url === "string" ? e.params.pr.url : row.prLink ?? null } : row));
      if (e.method === "account/rateLimits/updated") setPlanLimits((previous) => mergeRateLimits(previous, e.params?.rateLimits));
      if (e.method === "account/updated" || e.kind === "connection") setPlanLimits(null);
      // An early account event must not turn a null boot into a partial one: that ends modelsLoading with no
      // catalog ('Default model', disabled) while model/list is still pending. init returns both snapshots.
      if(e.kind==='account-auth')setBoot(b=>b&&({...b,auth:e.auth}));
      if(e.kind==='account-snapshot')setBoot(b=>b&&({...b,account:e.account}));
      // Codex's own sidebar sections imported in main (codex-sections.cjs): the new pins and groups.
      if(e.kind==='sidebar-state'&&e.state)applySidebarState(e.state);
      // Another window or the other split side changed the session list or the settings (main.cjs emitSessionList /
      // emitConfig): this side's list and appearance follow.
      if (e.kind === "session-list") applySessionList(e);
      if (e.kind === "config-updated" && e.config && typeof e.config === "object") applySharedConfig(e.config);
    });
    init();
    // Stats load beside init, not after the whole connect: main.cjs needs only the
    // core's initialize (or last launch's kept result). The 'stats' push event
    // refreshes them after turns.
    loadStats();
    call("home-shape").then((shape) => {
      setDisplayName((value) => value || shape?.displayName || "");
      setRemembered({ sessions: shape?.rememberedActionCenterCounts?.sessions || 0, projects: 0, prs: 0 });
    }).catch(() => setRemembered({ sessions: 0, projects: 0, prs: 0 }));
    return () => unsub?.();
  }, []);
  async function loadStats() {
    setStatsAttempts((count) => count + 1);
    try { setStatsSnapshot(await call("stats")); }
    catch { setStatsSnapshot(null); }
  }
  // Attention rows (official Lk/Pk over local state): pending approval → blocked,
  // unread and not running → unread; pinned/archived/acked/responding skipped.
  const attentionRows = useMemo(() => {
    if (!boot) return [];
    // Same ownership rule as the transcript: a sub-agent's approval flags the
    // session that owns it, which is the only row the user can open.
    const approvalIds = new Set(state.approvals.map((approval) => ownerThreadId(state, approval.params?.threadId)).filter(Boolean));
    const rows = [];
    for (const item of sessions) {
      const meta = sessionMetadata[item.id] || {};
      const timestamp = sessionTimestampMs(item);
      const kind = classifyAttention({ archived: sessionArchived(item), pinned: !!meta.pinned, hasApproval: approvalIds.has(item.id),
        running: !!state.active[item.id], unread: !!meta.unread, ackedAt: meta.ackedAt, timestamp });
      if (kind) rows.push({ session: item, kind, timestamp });
    }
    return sortAttention(rows);
  }, [boot, sessions, sessionMetadata, state.approvals, state.active, state.threadParents]);
  // Placeholder until the session list is in: gating on `boot` alone would show
  // the landing-clear card (and flip the greeting) between init and thread/read,
  // and write a transient 0 into rememberedActionCenterCounts.
  const homeLoading = !sessionsLoaded;
  const homeLandingClear = homeLoading ? shapeLandingClear(remembered) : attentionRows.length === 0;
  const sessionsRowLimit = useSessionsLimit();
  // Zk's mount time (Lo startedAt): the stats hold skeleton's delayed reveal counts from it.
  const homeStartedAt = useHomeStartedAt(section === "new" && !current);
  useEffect(() => {
    if (side !== 0 || homeLoading || !remembered || remembered.sessions === attentionRows.length) return;
    const next = { sessions: attentionRows.length, projects: 0, prs: 0 };
    setRemembered(next);
    call("settings", { rememberedActionCenterCounts: next }).catch(() => {});
  }, [homeLoading, remembered, attentionRows.length]);
  async function ackSession(item) {
    applySidebarState(await call("session-ack", { id: item.id, ackedAt: sessionTimestampMs(item) }));
  }
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    // Only the resolved light/dark is written (never "system"); a flip finishes
    // running colour transitions on the next frame (shared-7 wh/jh).
    const update = () => { writeThemeMode(document, resolveThemeMode(theme, media.matches)); };
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme]);
  const prefs = appearancePreferences(localPreferences);
  // Official rg/sR: html carries data-system-font / data-dyslexic-font, and every
  // cds-root gets data-font (anthropic → "sans", otherwise the system branch;
  // OpenDyslexic rides on that branch through --font-ui-dyslexic).
  const cdsFont = prefs.interfaceFont === "anthropic" ? "sans" : "system";
  useEffect(() => { setPersona(boot?.config?.persona); }, [boot?.config?.persona]);
  useEffect(() => {
    const root = document.documentElement;
    for (const key of ["motion","transcriptSize","transcriptWidth"]) root.dataset['local' + key[0].toUpperCase() + key.slice(1)] = prefs[key];
    // scroll-shared-10-current.js:17688-17708 CM/DM: the in-app Reduce motion
    // setting is html[data-reduce-motion="true"], which the loaded CSS's
    // motion-reduce variants and local reduce rules key on; data-local-motion
    // stays as an alias for the older local rules.
    if (prefs.motion === "reduce") root.dataset.reduceMotion = "true";
    else delete root.dataset.reduceMotion;
    root.toggleAttribute("data-system-font", prefs.interfaceFont === "system");
    root.toggleAttribute("data-dyslexic-font", prefs.interfaceFont === "dyslexic");
    root.dataset.font = cdsFont;
    for (const key of ["--cds-font-code","--cds-font-mono"]) {
      if (prefs.codeFont) root.style.setProperty(key, JSON.stringify(prefs.codeFont) + ', anthropic-mono, monospace');
      else root.style.removeProperty(key);
    }
    // Official c6e73333a: the selected themes' editor/selection colors become
    // --code-theme-* variables; the worker tokenizes under the same pair.
    const pair = setCodeThemes({ light: prefs.codeThemeLight, dark: prefs.codeThemeDark });
    // c66fe388e he(): html carries the pair as data-code-theme-light/-dark, which the
    // claude-light/claude-dark code-box ring keys on (design-system.css:56758-56768).
    root.dataset.codeThemeLight = pair.light;
    root.dataset.codeThemeDark = pair.dark;
    for (const mode of ["light", "dark"]) {
      const colors = codeThemeColors[pair[mode]];
      root.style.setProperty(`--code-theme-${mode}-bg`, colors.bg);
      root.style.setProperty(`--code-theme-${mode}-fg`, colors.fg);
      root.style.setProperty(`--code-theme-${mode}-selection-bg`, colors.selection);
    }
    root.style.setProperty("--cds-code-text-selection-bg", `light-dark(${codeThemeColors[pair.light].selection}, ${codeThemeColors[pair.dark].selection})`);
    window.dispatchEvent(new Event("local-motion-change"));
    // Keyed on the appearance values, not the object: a model or effort save re-creates localPreferences
    // (applyConfirmedPreferences) and must not re-apply appearance or announce a motion change.
  }, [JSON.stringify(prefs)]);
  useEffect(() => { writeSessionViews(localStorage, sessionViews); }, [sessionViews]);
  useEffect(() => { applyCustomTheme(document, boot?.config); }, [JSON.stringify(boot?.config?.customTheme ?? null)]);
  // titlebar-release-notes.js:5166-5168 B: markSeen() as soon as the notes open,
  // so the nudge hides once they close and returns only for a new version.
  const whatsNewHasNotes = LOCAL_RELEASE_NOTE_VERSIONS.includes(clientVersion);
  useEffect(() => {
    if (!whatsNew) return;
    const value = markSeenValue({ version: clientVersion, hasNotes: whatsNewHasNotes });
    if (value == null) return;
    try { writeSeenVersion(globalThis.localStorage ?? null, value); } catch {}
    setWhatsNewSeen(value);
  }, [whatsNew, whatsNewHasNotes]);
  // B (titlebar-release-notes.js:5156-5236) is a CDS Dialog: it stays mounted through its exit transition.
  const shownWhatsNew = useDialogRetention(whatsNew);
  const setSessionView = (sessionId, view) => setSessionViews((map) => withSessionView(map, sessionId, view, prefs.transcriptView));
  const hasThinking = sessionHasThinking(items);
  const transcriptView = effectiveView(sessionViews[current], prefs.transcriptView, { hasThinking });
  // Closed dialogs stay mounted through their exit transition (source-dialog.jsx useDialogRetention); the rename
  // form is keyed by its session so typing (a new rename object per keystroke) does not remount it.
  const shownActionDialog = useDialogRetention(actionDialog), shownConfirmDelete = useDialogRetention(confirmDelete);
  const shownBypass = useDialogRetention(bypassMode.confirming && !menu), shownRename = useDialogRetention(rename?.id ?? null);
  const lastRename = useRef(null), renameInput = useRef(null);
  if (rename) lastRename.current = rename;
  const renameShown = rename ?? lastRename.current;
  const actionDialogProps = (kind) => ({ open: shownActionDialog.open && actionDialog?.kind === kind, onExited: shownActionDialog.onExited });
  // source-sidebar.jsx filters the list by `search` even while the field is hidden, so hiding it
  // (Escape, ⌘K, its toolbar toggle, opening Settings) also clears the query, before paint.
  useLayoutEffect(() => { if (!showSearch) setSearch(""); }, [showSearch]);
  useEffect(() => {
    function key(e) {
      if (!splitActiveRef.current) return;
      // The sidebar and its search belong to the primary side: the secondary side hands those keys over.
      if (side !== 0 && ["toggle-sidebar", "search", "search-palette"].includes(globalShortcutCommand(e))) {
        e.preventDefault();
        if (!e.repeat) splitStore.toPrimary("windowKey", globalShortcutCommand(e));
        return;
      }
      // globalShortcutCommand (shortcuts-dialog-model.mjs) matches each chord exactly as this
      // handler always has; the Keyboard shortcuts dialog lists the same chords.
      const command = globalShortcutCommand(e);
      if (command === "settings") { e.preventDefault(); setMenu(null); setActionDialog(null); setWhatsNew(false); setShowSearch(false); setRename(null); setSettings(true); return; }
      // Km (shared-19-CjdiaR4X.js): ⌘⇧[ / ⌘⇧] and Ctrl+Tab / Ctrl+Shift+Tab walk the sidebar's session
      // rows through the new-session page. Same guards as ⌘[ / ⌘]; every other key ends a held sequence.
      // A consumed step preventDefaults, so Go > Previous/Next Session's accelerator does not fire too.
      if (settings || actionDialog || rename || whatsNew) sessionCycler.current.reset();
      else if (sessionCycler.current.keydown(e)) { e.preventDefault(); return; }
      if (settings) return;
      // sidebar-main.js:14680 Vf("toggle_sidebar") cmd+b. preventDefault marks
      // the key handled, so Electron does not also run the View menu's
      // CmdOrCtrl+B accelerator (key equivalents reach the page first and only
      // unhandled ones go to the menu); repeats are swallowed as well. While
      // Settings is open the key stays unhandled and the menu event meets the
      // same guard, so one press toggles at most once. "cmd" is Meta on this
      // macOS-only build; Ctrl+B stays the text fields' move-backward binding.
      if (command === "toggle-sidebar") {
        e.preventDefault();
        if (!e.repeat) toggleSidebarRef.current?.();
        return;
      }
      // ⌥⌘P/R/A/U/O: the open session's pin, rename, archive, read/unread and fork (sessionChordRef).
      if (["pin-session", "rename-session", "archive-session", "unread-session", "fork-session"].includes(command)) {
        if (actionDialog || rename || whatsNew || menu) return;
        e.preventDefault();
        if (!e.repeat) sessionChordRef.current?.(command);
        return;
      }
      // qM shortcut "cmd+[" / "cmd+]" (sidebar-session.js:10742-10743), the
      // key equivalents of Go > Back/Forward (index.chunk-D6ATlqeD.js gyr
      // Cyr("Command+[","Command+]")). Handled like ⌘B above: preventDefault
      // keeps the menu's registered hidden-twin accelerator from firing too.
      if (command === "back" || command === "forward") {
        e.preventDefault();
        if (!e.repeat) travelShortcutRef.current?.(command === "back" ? -1 : 1);
        return;
      }
      // shortcuts_modal cmd+/ (shared-22-Cz3C_T8d.js:11709, :11740-11749): preventDefault +
      // stopPropagation, then I() = v(!0) opens the dialog (an open one stays open). The single
      // local dialog slot is not taken from another dialog, the rename form or a confirm.
      if (command === "shortcuts") {
        e.preventDefault(); e.stopPropagation();
        if (!e.repeat) openShortcuts();
        return;
      }
      // search_palette cmd+shift+k (sidebar-groups.js:4999-5047 sw: preventDefault + stopPropagation,
      // then open in search mode): opens and focuses the search, never toggles it.
      if (command === "search-palette") {
        e.preventDefault(); e.stopPropagation();
        openSearchRef.current?.();
        return;
      }
      // aR toggleDiff cmd+shift+d / toggleBrowser cmd+shift+f (pane-shortcuts.mjs):
      // handled like ⌘B (preventDefault, repeats swallowed) and routed through
      // paneShortcutRef, inert under the same overlays as toggleSidebarRef.
      // toggleTerminal ctrl+` / cmd+j (shared-21 aR; terminal-pane-model.mjs): like the pane keys above.
      if (isTerminalToggle(e)) {
        if (actionDialog || rename || whatsNew || layerOpen()) return;
        e.preventDefault();
        if (!e.repeat) toggleTerminalPane();
        return;
      }
      const paneKind = paneShortcutKind(e);
      if (paneKind) {
        e.preventDefault();
        if (paneShortcut(e)) paneShortcutRef.current?.(paneKind);
        return;
      }
      // pR cmd+w (shared-21-D098Wd--.js:14357-14360) with File > Close Session (index.chunk-ChZ67Jhw.js
      // iwr/owr): while a session view shows, ⌘W closes its focused (or first open) pane, else the session
      // view, which ⇧⌘T can reopen. Elsewhere, or under a menu or dialog, the key stays unhandled and File's
      // own ⌘W item (Close Pane / Close Window) applies.
      if (command === "close-session") {
        if (menu || actionDialog || rename || whatsNew || layerOpen() || !(session || splitView.open) || section !== "new") return;
        e.preventDefault();
        if (!e.repeat) closeSessionView();
        return;
      }
      // reopenClosed cmd+shift+t (shared-21 :14261-14266; cb24e6301-6olw3OC9.js useReopenClosedShortcut,
      // inert under a modal layer).
      if (command === "reopen-closed") {
        if (menu || actionDialog || rename || whatsNew || layerOpen()) return;
        e.preventDefault();
        if (!e.repeat) reopenClosedSession();
        return;
      }
      // jumpPrevPrompt / jumpNextPrompt cmd+alt+up/down (shared-21 :14186-14268): the open session's previous or next
      // prompt of the user scrolls to the top of the transcript and takes the feed's focus.
      if (command === "jump-prev-prompt" || command === "jump-next-prompt") {
        if (menu || actionDialog || rename || whatsNew || layerOpen() || !current || section !== "new") return;
        e.preventDefault();
        jumpToPrompt(command === "jump-prev-prompt" ? -1 : 1);
        return;
      }
      // backgroundTasks ctrl+b (matchBy key): the Tasks pane's background list. A focused text field keeps ⌃B (move
      // backward), as the official binding skips editable targets.
      if (command === "background-tasks") {
        if (menu || actionDialog || rename || whatsNew || layerOpen() || !session || section !== "new") return;
        if (e.target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
        e.preventDefault();
        if (e.repeat) return;
        if (openPanes.has("tasks")) closePaneTile("tasks");
        else { changeTileView({ taskViews: [] }); openPaneTile("tasks"); }
        return;
      }
      // file_upload cmd+u: Add › Add files or photos for the composer (a session or Home).
      if (command === "file-upload") {
        if (menu || actionDialog || rename || whatsNew || layerOpen() || section !== "new") return;
        e.preventDefault();
        if (!e.repeat) attachRef.current?.();
        return;
      }
      // cycleTranscriptMode ctrl+o (shared-21 :14189; code-workspace.js:1957-1958, :2273-2280 _e): the open
      // session's view steps through qa filtered by availability (transcript-view-model.mjs). The keyboard
      // path (c360a9e1c-GPs-MV9u.js um, via "keyboard") shows no 'Switched transcript view' toast; those
      // belong to the loading indicator's thinking toggle (cd5a31703 V, main.jsx onToggleThinking).
      if (command === "transcript-view") {
        if (menu || actionDialog || rename || whatsNew || layerOpen() || !current || section !== "new") return;
        e.preventDefault();
        setSessionView(current, nextTranscriptView(transcriptView, { hasThinking }));
        return;
      }
      if (command === "new-session") {
        e.preventDefault();
        navigate(null);
      }
      // shared-21 keybindings: closePane cmd+\ (Backslash), toggleExpandPane cmd+shift+\.
      if ((command === "close-pane" || command === "expand-pane") && !menu && !actionDialog) {
        const kind = focusedPaneKind() ?? PANE_KINDS.find((candidate) => openPanes.has(candidate));
        if (kind) { e.preventDefault(); if (command === "expand-pane") toggleExpandTile(kind); else closePaneTile(kind); }
      }
      // A hidden search never filters: the query is cleared whenever the field hides (layout effect below).
      // ⌘K toggles through searchShortcutAction: opening always shows a usable field (see searchShortcut);
      // it does not open behind an action dialog, the rename form, What's New or another modal layer.
      if (command === "search") {
        e.preventDefault();
        if (showSearch || !(actionDialog || rename || whatsNew || document.getElementById("root")?.inert === true)) searchShortcut(true);
      }
      // Base UI useDismiss (vendor-frame-BmPfNbgY.js:16734-16748): a popup or dialog that handled
      // Escape prevents it, so nothing else closes; otherwise only the topmost local layer does.
      if (e.key === "Escape" && !e.defaultPrevented) {
        if (menu) setMenu(null);
        else if (rename) setRename(null);
        else if (actionDialog) setActionDialog(null);
        // Nb / uR (sidebar-groups.js:2689-2695, sidebar-main.js:15186-15200): Escape closes the open peek
        // and refocuses 'Show sidebar' (an open sidebar menu took the Escape first).
        else if (closePeek({ focusTrigger: true })) e.preventDefault();
        else if (showSearch) setShowSearch(false);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  // Km s/l: releasing the modifier (or every modifier) and leaving the window end a held cycle.
  useEffect(() => {
    const cycler = sessionCycler.current, keyup = (e) => cycler.keyup(e), blur = () => cycler.reset();
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keyup", keyup); window.removeEventListener("blur", blur); };
  }, []);
  // c360a9e1c-GPs-MV9u.js:4655-4775 Zd T: a CAPTURE-phase window keydown while the composer panel is active
  // (chin-shortcuts.mjs). Inert for defaultPrevented events, under Settings/dialogs/rename/search, while a
  // non-chin menu is open, or with no composer chin. Plain Digit1-9 in the open Mode menu pick the Nth
  // rendered item (numberedModeItems; the item's own click path selects, closes and refocuses) from any target,
  // repeats included like T (:4728-4737, no repeat guard), and Digit0 is claimed but selects nothing; Mode/Model/
  // Effort chords are preventDefault'ed + stopPropagation'ed, never open on a repeat, and resolve through
  // qd/w onto the same anchors the chin buttons use — a disabled or missing trigger (a pending send disables
  // Mode and Model; F05 keeps them live during a turn) is a no-op. toggleFastMode is claimed only when honored (s && !a): a Fast tier
  // exists and the model menu's own Fast control would be enabled. Escape keeps the existing handlers
  // (SourceMenu document listener, SourceComposer's window stop listener and the bubble handler above).
  // useLayoutEffect, not useEffect: the listener closes over state, and a passive effect is re-registered only in
  // React's later passive-effect task, so right after a DefaultLane commit (e.g. the Fast save resolving: DOM reads
  // 'Fast mode on', fastSaving false) the window still held the previous closure (fastSaving true) and dropped the
  // chord — reproduced deterministically by work/claude-ui-sweep/0.2.120/chin-listener-race-probe.mjs. A layout
  // effect swaps the listener synchronously inside the same commit as the DOM.
  useLayoutEffect(() => {
    function chin(e) {
      if (e.defaultPrevented || settings || actionDialog || rename || showSearch || whatsNew || workflowLaunch || bypassMode.confirming) return;
      const openKind = chinKindOfMenu(menu?.kind);
      if (menu && !openKind) return;
      if (!splitActiveRef.current) return;
      const chinNode = scope().querySelector(".sc-chin");
      if (!chinNode || chinNode.closest("[inert]")) return;
      const digit = openKind === "mode" ? modeMenuDigit(e) : null;
      if (digit !== null) {
        e.preventDefault(); e.stopPropagation();
        if (digit >= 1) document.querySelector(`.sp-permission-menu [data-number-key="${digit}"]:not([data-disabled])`)?.click();
        return;
      }
      const command = chinShortcutCommand(e);
      if (!command) return;
      if (command === "fast") {
        if (!fastTier || fastSaving || running || sending || !boot?.connected) return;
        e.preventDefault(); e.stopPropagation();
        if (!e.repeat) changeSpeed(nextSpeed()).catch(error => setError(error.message));
        return;
      }
      e.preventDefault(); e.stopPropagation();
      const request = resolveChinRequest({ command, openKind, repeat: e.repeat, effortCount: efforts.length, modelCount: models.length,
        modeCount: PERMISSION_OPTIONS.filter(option => option.value !== "bypass" || bypassMode.available).length });
      if (!request) return;
      if (request.action === "close") { closeMenu(); return; }
      const trigger = chinNode.querySelector({ mode: ".sc-permission", model: ".sc-model-trigger", effort: ".sc-effort-trigger" }[request.kind]);
      if (!trigger || trigger.disabled) return;
      openMenu(CHIN_MENU_KINDS[request.kind], trigger);
    }
    window.addEventListener("keydown", chin, true);
    return () => window.removeEventListener("keydown", chin, true);
  });
  // retry: xu's Retry (approval-entry-current.js:4214 onRetry A) refetches the
  // same session in place, so it keeps the composer draft, attachments, queue
  // and history position that a navigation resets.
  async function openSession(id, { retry = false } = {}) {
    transcriptRef.current?.capture();
    const seq = ++loadSeq.current;
    const leaving = currentRef.current;
    releaseSession(currentRef.current, id);
    setActionDialog(null);
    setLoadError(null);
    setTurnRequested(null);
    // Home keeps a Files pane that was open in the session being left (local
    // home behavior: the file browser over the chosen folder stays available).
    if (!id && currentRef.current) {
      const leaving = tileStore.getSession(currentRef.current);
      if (leaving?.tileLayout && tileIds(baseTileLayout(leaving)).has("files")) openPaneTile("files", HOME_TILE_KEY);
    }
    currentRef.current = id;
    setCurrent(id);
    if (id && sessionMetadata[id]?.unread) updateSessionMetadata(id, { unread: false }).catch(actionFailed("mark-read"));
    // Leaving Home for a session drops a pending custom-group "New session" (F08 Mz).
    if (id) newSessionGroup.current = null;
    setError("");
    if (!retry) {
      switchComposerDraft(leaving, id);
      setQueue(emptyQueue(id));
      setAdditionalFolders(id ? sessionMetadata[id]?.additionalFolders || [] : []);
    }
    if (!id) {
      applySessionModel(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const known = knownThread(id);
      const isArchived = known?.archived;
      // 0.155.1: only historyMode "legacy" still hydrates the whole thread in
      // one response. A paginated thread is resumed with excludeTurns:true and
      // paged, which is what keeps the deprecationNotice from being emitted.
      // `route` is captured from the same Thread that shapes the request, so
      // hydration can never take the branch the request did not ask for.
      const route = historyRoute(known);
      const r = await rpc(isArchived ? "thread/read" : "thread/resume", isArchived
        ? historyReadParams(id, known)
        : historyResumeParams({
            threadId: id,
            ...threadPermissionParams({permission: bypassMode.forSession(id, known?.cwd || cwd), mode, ...permissionHints()}),
          }, known));
      if (!isArchived) resumed.current.add(id);
      // Left while it was resuming: release it now, not at the next visit.
      if (seq !== loadSeq.current) { releaseSession(id, currentRef.current); return; }
      applySessionModel(id, r);
      const history = await loadThreadHistory(rpc, { threadId: id, thread: r.thread, route, initialPage: r.initialTurnsPage ?? null });
      if (seq === loadSeq.current) {
        dispatch({ type: "hydrate", id, thread: { ...r.thread, turns: history.turns }, baselineItems: state.items[id], baselineActive: state.active[id], baselineActiveVersion: state.activeVersions?.[id] });
        if (r.thread.cwd) setCwd(r.thread.cwd);
        if (!isArchived) loadQueue(id);
      }
    } catch (e) {
      if (seq === loadSeq.current) {
        setLoadError({ id, message: e.message });
        // An empty pane shows the source failure state instead of the raw
        // message; with displayed rows on screen the composer banner still
        // reports it. The count is the render's shownRows (items + local command
        // and workflow rows, after grouping), not this closure's stale items, so
        // exactly one of the alert and the banner reports every failure.
        if (shownRowCount.current.id === id && shownRowCount.current.count > 0) setError(e.message);
      }
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }
  // DeepSeek: unsubscribe a session the user left once nothing is in flight,
  // so its Harness write lock is free for the DeepSeek app (session-unload-model).
  // A later send, resume or session action reopens it through the core.
  function releaseSession(previous, next) {
    // Split view: a session the other side shows (a swap, a move) stays subscribed.
    const otherSide = splitStore.sideShowing(previous);
    if (otherSide !== null && otherSide !== side && splitStore.getState().open) return;
    const work = sessionWork({ id: previous, active: state.active, approvals: state.approvals, ownerOf: (threadId) => ownerThreadId(state, threadId) });
    // turnRequested stays set after its turn ends, so it is not "in flight"; a
    // turn/start just answered is guarded by the core (running agent or inbox).
    const busy = work.active || operationPending(state.operations?.[previous]) || actionLock.current.has(previous)
      || (sending && current === previous);
    const queued = queue.threadId === previous && queue.entries.length > 0;
    if (!shouldUnload({ previous, next, engine: boot?.core, active: busy, pendingApproval: work.pendingApproval, queued, resumed: resumed.current })) return;
    resumed.current.delete(previous);
    rpc("thread/unsubscribe", { threadId: previous }).catch(() => {});
  }
  const closeSideChat = useCallback(() => setSideChat(value => value.open ? { open: false, pending: null } : value), []);
  useEffect(() => { setSideChat(value => value.open ? { open: false, pending: null } : value); }, [current]);
  // A reconnect onto a core without side questions closes an open card.
  useEffect(() => { if (!commandContext.sideQuestions) setSideChat(value => value.open ? { open: false, pending: null } : value); }, [commandContext.sideQuestions]);
  useEffect(() => {
    const toggle = (event) => {
      if (event.repeat || event.isComposing || !event.metaKey || event.shiftKey || event.altKey || event.ctrlKey || event.key !== ";") return;
      if (!currentRef.current || settings || !splitActiveRef.current) return;
      // A core without side questions (Codex) leaves ⌘; alone; an open card still closes.
      if (!sideQuestionsRef.current) { setSideChat(value => value.open ? { open: false, pending: null } : value); return; }
      event.preventDefault(); event.stopPropagation();
      setSideChat(value => ({ open: !value.open, pending: null }));
    };
    document.addEventListener("keydown", toggle, true);
    return () => document.removeEventListener("keydown", toggle, true);
  }, [settings]);
  function navigate(id) {
    // Split view: a session the other side already shows is focused there, never opened twice in one window.
    const shownOn = id && splitStore.getState().open ? splitStore.sideShowing(id) : null;
    if (shownOn !== null && shownOn !== side) { splitStore.focus(shownOn, { move: true }); return; }
    // shared-19 Rh -> Mh: opening a row (or any navigation) closes the collapsed sidebar's peek.
    closePeek();
    // Any navigation drops a pending custom-group "New session" (groupAction sets it after navigating).
    newSessionGroup.current = null;
    setSection("new");
    setMenu(null);
    setHistory((h) => [...h.slice(0, historyAt + 1), id]);
    setHistoryAt(historyAt + 1);
    openSession(id);
    noteSessionSwitch(id);
  }
  // Split-view tip (2.2553.1 "epitaxy-split-suggestion"): switching back and forth between two sessions (A, B, A, B
  // within 30 s) offers to show them side by side, with Claude's backoff between shows (split-view-model.mjs).
  function noteSessionSwitch(id) {
    if (side !== 0 || splitStore.getState().open) { switchHistory.current = []; return; }
    switchHistory.current = recordSessionSwitch(switchHistory.current, id, Date.now());
    const partner = alternatingPartner(switchHistory.current);
    if (!partner || splitTip) return;
    let saved = emptySplitSuggestion;
    try { saved = splitSuggestionState(JSON.parse(globalThis.localStorage?.getItem(SPLIT_TIP_KEY) || "null")); } catch { /* no storage */ }
    if (!canSuggestSplit(saved)) return;
    try { globalThis.localStorage?.setItem(SPLIT_TIP_KEY, JSON.stringify({ ...saved, shown: saved.shown + 1, lastShownAt: Date.now() })); } catch { /* no storage */ }
    switchHistory.current = [];
    setSplitTip({ partner });
  }
  function closeSplitTip(outcome) {
    setSplitTip(null);
    try {
      const saved = splitSuggestionState(JSON.parse(globalThis.localStorage?.getItem(SPLIT_TIP_KEY) || "null"));
      globalThis.localStorage?.setItem(SPLIT_TIP_KEY, JSON.stringify({ ...saved, [outcome]: saved[outcome] + 1 }));
    } catch { /* no storage */ }
  }
  function travel(delta) {
    const at = historyAt + delta;
    if (at < 0 || at >= history.length) return;
    setHistoryAt(at);
    openSession(history[at]);
  }
  // ⌘[ / ⌘] and Go > Back/Forward share the ⌘B guard: inert under Settings,
  // action dialogs, inline rename and What's New. The buttons call travel().
  travelShortcutRef.current = (delta) => {
    if (settings || actionDialog || rename || whatsNew) return;
    travel(delta);
  };
  // index.chunk-D6ATlqeD.js Syr: the Go menu's go-back/go-forward items are
  // enabled from canGoBack/canGoForward on every navigation.
  const navigation = navAvailability(historyAt, history.length);
  useEffect(() => {
    if (splitActive) call("navigation-state", navigation).catch(() => {});
  }, [navigation.canGoBack, navigation.canGoForward, splitActive]);
  // shortcuts_modal: ⌘/ and Help > Keyboard Shortcuts (kjr) open the dialog (I = v(!0): an open one
  // stays open). The single local dialog slot is not taken from another dialog, the rename form or a confirm.
  function openShortcuts() {
    if (settings || rename || confirmDelete || (actionDialog && actionDialog.kind !== "shortcuts")) return;
    setMenu(null);
    setActionDialog((dialog) => dialog?.kind === "shortcuts" ? dialog : { kind: "shortcuts" });
  }
  // ⌘K toggles the command palette (command_palette) and ⇧⌘K / Go > Search… open it in search mode (sw
  // n("search")), both through searchShortcutAction (shortcuts-dialog-model.mjs). The palette
  // (source-sidebar-palette.jsx) is a centred overlay whatever the sidebar state: showSearch holds its
  // entry mode ("default" / "search"), and the palette focuses its own field.
  function searchShortcut(toggle) {
    const action = searchShortcutAction({ showSearch, toggle });
    if (action === "close") { setShowSearch(false); return; }
    setMenu(null);
    setShowSearch(action === "open-search" ? "search" : "default");
  }
  // ⇧⌘K and Go > Search… never toggle; inert under the same overlays as ⌘[ / ⌘].
  openSearchRef.current = () => {
    if (settings || actionDialog || rename || whatsNew) return;
    searchShortcut(false);
  };
  // Split view (source-split-view.jsx). navigateRef: the split store's way into this side's latest navigate.
  // windowKeyRef: ⌘B / ⌘K / ⇧⌘K pressed in the secondary side, handled by this (primary) side's sidebar.
  navigateRef.current = navigate;
  windowKeyRef.current = (command) => {
    if (command === "toggle-sidebar") toggleSidebarRef.current?.();
    else if (command === "search-palette") openSearchRef.current?.();
    else if (command === "search" && (showSearch || !(actionDialog || rename || whatsNew || document.getElementById("root")?.inert === true))) searchShortcut(true);
  };
  // The sidebar, a notification or a deep link opens a session in the window's focused split side, or focuses the
  // side that already shows it; without a split it is navigate().
  function openInFocusedSide(id) {
    if (side === 0 && !splitStore.getState().open) { (navigateRef.current ?? navigate)(id); return; }
    splitStore.openInFocusedSide(id);
  }
  // A relaunch, or a window opened for a session (main.cjs init windowLayout): its primary session and its split.
  function restoreWindowLayout(layout) {
    const known = (id) => typeof id === "string" && sessionsRef.current.some((thread) => thread.id === id);
    if (known(layout?.current)) navigate(layout.current);
    const split = layout?.split;
    if (split && (split.sessionId === null || known(split.sessionId))) splitStore.restore(split);
  }
  // Another window (or the other split side) added, renamed, archived or deleted a session (main.cjs emitSessionList).
  function applySessionList(event) {
    const id = typeof event.threadId === "string" ? event.threadId : null;
    if (event.op === "added" && typeof event.thread?.id === "string")
      setSessions((rows) => rows.some((row) => row.id === event.thread.id) ? rows : [event.thread, ...rows]);
    else if (event.op === "renamed" && id && typeof event.name === "string")
      setSessions((rows) => rows.some((row) => row.id === id && row.name !== event.name) ? rows.map((row) => row.id === id ? { ...row, name: event.name } : row) : rows);
    else if ((event.op === "archived" || event.op === "unarchived") && id) {
      const archived = event.op === "archived";
      setSessions((rows) => rows.some((row) => row.id === id && !!row.archived !== archived) ? rows.map((row) => row.id === id ? { ...row, archived } : row) : rows);
    } else if (event.op === "deleted" && id) {
      setSessions((rows) => rows.some((row) => row.id === id) ? rows.filter((row) => row.id !== id) : rows);
      if (currentRef.current === id) (navigateRef.current ?? navigate)(null);
    }
  }
  // Settings saved in another window or the other split side (main.cjs emitConfig): appearance, language, names.
  function applySharedConfig(shared) {
    setBoot((value) => value?.config ? { ...value, config: { ...value.config, ...shared } } : value);
    setLocalPreferences(appearancePreferences(shared));
    if (typeof shared.theme === "string") setTheme(shared.theme);
    if (typeof shared.displayName === "string") setDisplayName(shared.displayName);
  }
  // A modal layer the local overlay state does not track: a sidebar dialog or menu (#root inert / role=menu).
  function layerOpen() {
    return document.getElementById("root")?.inert === true || !!document.querySelector('[role="menu"]');
  }
  // closed-session-model.mjs over the loaded session list (shared-19 Gh: a deleted session is skipped).
  function sessionExists(id) {
    return sessions.some((entry) => entry.id === id);
  }
  // ⌘W / File > Close Session (iwr/owr, shared-19 $h): the focused or first open pane, else the session
  // view itself, recorded for Reopen Closed Session (Kh) before the view goes Home.
  function closeSessionView() {
    const kind = focusedPaneKind() ?? PANE_KINDS.find((candidate) => openPanes.has(candidate));
    if (kind) { closePaneTile(kind); return; }
    // Split view: ⌘W closes the focused side before it closes a session view.
    if (splitView.open) { splitStore.close(side); return; }
    if (!current) return;
    setClosedSessions((stack) => pushClosedSession(stack, current));
    navigate(null);
  }
  // ⇧⌘T / File > Reopen Closed Session (cb24e6301 h): pop the newest existing entry (qh), then planReopen
  // focuses a session already shown or navigates to it.
  function reopenClosedSession() {
    const { id, stack } = popClosedSession(closedSessions, sessionExists);
    setClosedSessions(stack);
    if (id && planReopen(id, { currentId: current }) === "navigate") navigate(id);
  }
  // Menu bar commands (app-menu.cjs), each behind the guard of its keyboard twin: New Session (⌘N),
  // Open Folder… (the composer's folder()), View Show/Hide Changes and Files (⌘⇧D / ⌘⇧F), Close
  // Pane (⌘\ on the focused or first open pane), Close Session (⌘W) and Reopen Closed Session (⇧⌘T),
  // Keyboard Shortcuts (⌘/), Previous/Next Session (onCycleSession: one fresh Km step) and Search… (⇧⌘K).
  // ⇧⌘N / File › New Session with Current Settings (2.2553.1 palette new_code_session_from_current): the New session
  // page in the open session's folder, with its model, effort and Mode (applySessionModel would put the saved ones back).
  function newSessionFromCurrent() {
    if (settings) return;
    const id = currentRef.current;
    const keep = id ? { model, effort, cwd: knownThread(id)?.cwd || workdir || cwd } : null;
    navigate(null);
    if (!keep) return;
    if (keep.model) setModel(keep.model);
    if (keep.effort) setEffort(keep.effort);
    if (keep.cwd) setCwd(keep.cwd);
  }
  menuCommandRef.current = (e) => {
    if (e.kind === "new-session") { if (!settings) navigate(null); }
    else if (e.kind === "new-session-current") newSessionFromCurrent();
    else if (e.kind === "open-folder") { if (!settings) folder(); }
    else if (e.kind === "open-file") { if (!settings) void openFileFromMenu(); }
    else if (e.kind === "toggle-pane") {
      if (e.pane === "changes" || e.pane === "files") paneShortcutRef.current?.(e.pane);
      else if (e.pane === "terminal" && !(settings || actionDialog || rename || whatsNew)) toggleTerminalPane();
      else if (e.pane === "preview") paneShortcutRef.current?.("preview");
      // View › Show/Hide Side Chat: what ⌘; does (the /btw card), where the core serves side questions.
      else if (e.pane === "sideChat" && current && !settings && commandContext.sideQuestions) setSideChat((value) => ({ open: !value.open, pending: null }));
    }
    else if (e.kind === "close-pane") {
      if (settings || menu || actionDialog) return;
      const kind = focusedPaneKind() ?? PANE_KINDS.find((candidate) => openPanes.has(candidate));
      if (kind) closePaneTile(kind);
    }
    else if (e.kind === "close-session") { if (!(settings || menu || actionDialog || rename || whatsNew || layerOpen()) && (session || splitView.open) && section === "new") closeSessionView(); }
    else if (e.kind === "reopen-closed") { if (!(settings || actionDialog || rename || whatsNew || layerOpen())) reopenClosedSession(); }
    else if (e.kind === "open-shortcuts") openShortcuts();
    else if (e.kind === "cycle-session") { if (!(settings || actionDialog || rename || whatsNew) && (e.delta === -1 || e.delta === 1)) sessionCycler.current.step(e.delta); }
    // View › Command Palette… toggles like ⌘K; Go › Search… only opens.
    else if (e.kind === "open-search") { if (e.toggle === true) { if (!(settings || actionDialog || rename || whatsNew)) searchShortcut(true); } else openSearchRef.current?.(); }
  };
  // View > Show/Hide Changes and Files, Close Pane and File's ⌘W item follow the renderer's pane report
  // (index.chunk-ChZ67Jhw.js cSr sessionPanes / bNr): a pane is available where its ⌘⇧D / ⌘⇧F key works
  // (paneShortcutRef) and Close Pane wherever ⌘\ has a pane to close. session.open is iwr's lSr (the
  // session view shows: ⌘W reads Close Session) and reopenClosed is cb24e6301's report ({available: true,
  // enabled: Jh}). Main rebuilds only on a change.
  const paneMenuAvailable = !!session && section === "new";
  const menuState = { panes: { changes: { enabled: paneMenuAvailable, open: openPanes.has("changes") }, files: { enabled: paneMenuAvailable && !!workdir, open: openPanes.has("files") },
    terminal: { enabled: terminalAvailable && !settings, open: openPanes.has("terminal") },
    preview: { enabled: previewAvailable && !settings, open: openPanes.has("preview") },
    ...(commandContext.sideQuestions !== false ? { sideChat: { enabled: !!current && !settings && commandContext.sideQuestions === true, open: sideChat.open } } : {}) },
    closePane: { enabled: PANE_KINDS.some((kind) => openPanes.has(kind)) },
    session: { open: paneMenuAvailable || splitView.open }, reopenClosed: { available: true, enabled: hasClosedSession(closedSessions, sessionExists) } };
  const menuStateKey = JSON.stringify(menuState);
  useEffect(() => { if (splitActive) call("menu-state", menuState).catch(() => {}); }, [menuStateKey, splitActive]);
  async function folder() {
    try {
      const dir = await call("folder");
      if (dir) {
        setCwd(dir);
        navigate(null);
      }
    } catch (e) {
      setError(e.message);
    }
  }
  // `permission`: a turn sent right after a mode change in the same handler (the plan handoff), before the
  // re-render that makes it the effective permission.
  function turnOptions(turnCwd, permission = effectivePermission, { keyword = false } = {}) {
    // A listed model with no effort levels (a relay or custom-provider model) runs at its own default, as the composer's
    // 'Model default' chip says: no saved effort goes with it.
    const listed = models.find((entry) => entry.model === model || entry.id === model);
    const effortless = !!listed && !(Array.isArray(listed.supportedReasoningEfforts) && listed.supportedReasoningEfforts.length);
    const options = {
      model: model || null,
      serviceTier,
      // Ultracode runs at xhigh (model-menu-model.mjs coreEffort).
      effort: effortless ? null : coreEffort(effort) || null,
      cwd: turnCwd,
      ...turnPermissionParams({permission, mode, cwd: turnCwd, additionalFolders, ...permissionHints()}),
    };
    // The turn's workflow facts for main (workflow-tool-service.cjs): the Mode workflow agents inherit, the "ultracode"
    // keyword and ultracode mode. Main takes them out before the request reaches the core.
    options.codeDesktop = { ...(options.codeDesktop ?? {}), workflowTurn: { permission, mode, ultracode: ultracodeOn, ...(keyword ? { keyword: true } : {}) } };
    return withAgentChoice(options);
  }
  async function ensureResumed(id) {
    if (resumed.current.has(id)) return;
    const known = knownThread(id);
    const route = historyRoute(known);
    const restored = await rpc("thread/resume", historyResumeParams({
      threadId: id,
      ...threadPermissionParams({permission: bypassMode.forSession(id, known?.cwd || cwd), mode, ...permissionHints()}),
    }, known));
    resumed.current.add(id);
    const history = await loadThreadHistory(rpc, { threadId: id, thread: restored.thread, route, initialPage: restored.initialTurnsPage ?? null });
    dispatch({ type: "hydrate", id, thread: { ...restored.thread, turns: history.turns }, baselineItems: state.items[id], baselineActive: state.active[id], baselineActiveVersion: state.activeVersions?.[id] });
  }
  // Band/rail Commit action (git-status-card.js:4955-4990): a real turn with the
  // official text, under the session's current permission mode and approvals.
  // The button itself is disabled while responding (cc), so this only guards
  // the same preconditions as send(). F12 (git-status-card.js:4962-4977): every
  // failure, the offline and archived preconditions included, is the xr danger
  // toast "Message couldn’t be sent. Try again." and nothing else.
  function sendCommitTurn() { return sendFixedTurn(COMMIT_TURN_TEXT); }
  // A fixed turn the app sends for the user (Commit, Create PR, a core's own /workflow), under the session's options.
  async function sendFixedTurn(text, extraInput = []) {
    const id = current;
    if (!id || loading || sending || running || actionPending || commitLock.current) return;
    const failed = () => toasts?.add(COMMIT_SEND_FAILED, { variant: "danger" });
    if (!boot?.connected || session?.archived) { failed(); return; }
    commitLock.current = true;
    try {
      await ensureResumed(id);
      setTurnRequested(id);
      await rpc("turn/start", {
        threadId: id,
        input: [...(text || !extraInput.length ? [{ type: "text", text, text_elements: [] }] : []), ...extraInput],
        ...turnOptions(workdir || cwd),
      });
    } catch (e) {
      setTurnRequested(value => value === id ? null : value);
      console.warn(e);
      failed();
    } finally {
      commitLock.current = false;
    }
  }
  // Card "Try again" (cf6ae6197 CS pe -> onRetryLastTurn): Codex has no
  // retry-turn request, so the failed turn's own text-only user input is sent
  // again as a new turn/start under the session's current options.
  // Safety buffering's 'Retry with {model}': stop the held turn, then send its own message again with the faster model.
  async function retryWithModel(nextModel) {
    const id = current, turnId = state.active[id], input = turnId ? retryInput(items, turnId) : null;
    if (!id || !turnId || !input || !nextModel) return;
    await stop();
    for (let waited = 0; waited < 10000 && stopLive.current.active?.[id]; waited += 100) await new Promise((resolve) => setTimeout(resolve, 100));
    if (stopLive.current.active?.[id]) return;
    try {
      setTurnRequested(id);
      await rpc("turn/start", { threadId: id, input, ...turnOptions(workdir || cwd), model: nextModel });
    } catch (e) {
      setTurnRequested((value) => value === id ? null : value);
      setError(e.message);
    }
  }
  // 'Auto-continue when limits reset' (turn error card): retry the failed turn at the reset time, once. Any other
  // send, a session switch, a running turn or a reconnect drops it.
  const [autoResume, setAutoResume] = useState(null);
  useEffect(() => { setAutoResume((value) => value && value.threadId !== current ? null : value); }, [current]);
  useEffect(() => { if (running || !boot?.connected) setAutoResume(null); }, [running, boot?.connected]);
  useEffect(() => {
    if (!autoResume?.at) return undefined;
    const timer = setTimeout(() => { const pending = autoResume; setAutoResume(null); if (currentRef.current === pending.threadId) void retryFailedTurn(pending.turnId); }, Math.max(0, autoResume.at - Date.now()) + 5000);
    return () => clearTimeout(timer);
  }, [autoResume]);
  // /recap: Codex's catch-up prompt (tui app/recap.rs RECAP_PROMPT_PREFIX) asked as a side question, so the answer
  // never joins the session; shown as Claude's dismissible 'Recap' card at the transcript tail, whose answer renders as
  // Markdown in a bounded scroller (models answer in Markdown even when asked not to).
  const [recaps, setRecaps] = useState({});
  async function runRecap(threadId) {
    if (!threadId) return;
    setRecaps((all) => ({ ...all, [threadId]: { status: "loading", text: "" } }));
    const question = "Write a brief catch-up for a user returning to this task. In at most 40 words and one or two plain-text sentences, explain the objective, what was completed or learned, and the next step or blocker. Mention changed files, tests, approvals, or requested decisions only when relevant. Never claim changes were made or tests passed unless the conversation confirms it. If the task is complete, say so instead of inventing more work. Use the user's language; omit greetings, markdown, lists, and tool chatter.";
    try {
      const result = await rpc("codeDesktop/sideQuestion", { threadId, question, history: [], requestId: globalThis.crypto?.randomUUID?.() ?? `recap-${Date.now()}` });
      const text = typeof result?.text === "string" ? result.text.trim().slice(0, 4000) : "";
      if (!text) throw new Error(t("Could not generate a recap. Please try again."));
      setRecaps((all) => ({ ...all, [threadId]: { status: "done", text, at: Date.now() } }));
    } catch (e) {
      setRecaps((all) => { const next = { ...all }; delete next[threadId]; return next; });
      if (toasts) toasts.add(e.message || t("Could not generate a recap. Please try again."), { variant: "warning" }); else setError(e.message);
    }
  }
  const recap = current ? recaps[current] : null;
  // Claude's 'awayRecap' transcript tail row (source-recap-card.jsx rR), not a notice above the composer.
  const dismissRecap = () => setRecaps((all) => { const next = { ...all }; delete next[current]; return next; });
  // The edits card's Undo (Gpe): Fpe's request as an ordinary next turn.
  async function sendUndoTurn(files) {
    const id = current, text = undoTurnText(files);
    if (!id || !files?.length || loading || sending || running || actionPending || !boot?.connected || session?.archived) return;
    setError("");
    try {
      await ensureResumed(id);
      setTurnRequested(id);
      await rpc("turn/start", { threadId: id, input: [{ type: "text", text, text_elements: [] }], ...turnOptions(workdir || cwd) });
    } catch (e) {
      setTurnRequested((value) => value === id ? null : value);
      setError(e.message);
    }
  }
  // Codex's 'Acknowledge findings and continue' after a misalignment pause: its own steer message is the next turn.
  async function continueMisalignment(message) {
    const id = current;
    if (!id || typeof message !== "string" || !message || loading || sending || running || actionPending || !boot?.connected || session?.archived) return;
    setError("");
    try {
      await ensureResumed(id);
      setTurnRequested(id);
      await rpc("turn/start", { threadId: id, input: [{ type: "text", text: message, text_elements: [] }], ...turnOptions(workdir || cwd) });
    } catch (e) {
      setTurnRequested((value) => value === id ? null : value);
      setError(e.message);
    }
  }
  // Codex's /auto-review: approve one retry of an action its reviewer denied in 'Approve for me'
  // (thread/approveGuardianDeniedAction with the rebuilt GuardianAssessmentEvent, auto-review-model.mjs). Only where the
  // core has auto-review, for a live session.
  const approveDeniedOnce = current && boot?.connected && !session?.archived && coreSupports(boot?.core, "autoReview")
    ? async (review) => {
      const event = guardianDenialEvent(review);
      if (!event) throw new Error(t("This denial can’t be approved from here."));
      await ensureResumed(current);
      await rpc("thread/approveGuardianDeniedAction", { threadId: current, event });
    } : null;
  async function retryFailedTurn(turnId) {
    const id = current, input = retryInput(items, turnId);
    if (!id || !input || loading || sending || running || actionPending || !boot?.connected || session?.archived) return;
    setError("");
    try {
      await ensureResumed(id);
      // A core that resumes a failed or stopped turn itself (capabilities.continueTurn: Qwen's session continue) picks up
      // where it stopped, so the model never sees the message twice; nothing to resume falls back to sending it again.
      if (boot?.core?.capabilities?.continueTurn === true) {
        const resumed = await rpc("codeDesktop/turn/continue", { threadId: id }).catch(() => null);
        if (resumed?.accepted === true) return;
      }
      await rpc("turn/start", { threadId: id, input, ...turnOptions(workdir || cwd) });
    } catch (e) {
      setError(e.message);
    }
  }
  // Composer input for the current draft: text with mention byte ranges,
  // the additional-folder note, then real attachment parts. A leading skill
  // chip (or its '/name' text) becomes the {type:"skill"} item after them —
  // where the Add › Skills pill used to put it — and leaves the text.
  function composerInput(text, turnCwd) {
    const parsed = parseSessionCommand(text, commandContext);
    const chip = parsed?.skill ? skillChipInput(text, parsed.skill) : null;
    // A session mention reads as ZCode's '[#title](#id)'; a literal @ target ('@mcp:github') stays text (agentMentionText).
    // Context snippets (Quote pills) lead the message as Markdown quotes (snippetText; Claude's be).
    const body = snippetText(attachments) + agentMentionText(chip ? chip.text : parsed?.custom ? expandCommand(parsed.custom.body, parsed.args) : text, mentions);
    const root = (turnCwd || "").replace(/\/$/, "");
    const fileMentions = mentions.filter((entry) => !entry.literal && !entry.session);
    // A reference mention ('@docs') resolves to its own folder; a file mention is relative to the turn's folder.
    const mentioned = mentionInputs(body, fileMentions, { resolvePath: (relative) => fileMentions.find((entry) => entry.path === relative && entry.target)?.target ?? (root ? `${root}/${relative}` : relative) });
    return [
      ...(chip && !body.trim() ? [] : [{ type: "text", text: body, text_elements: mentioned.text_elements }]),
      ...(additionalFolders.length ? [{ type: "text", text: "Additional workspace directories for this task:\n" + additionalFolders.join("\n"), text_elements: [] }] : []),
      ...mentioned.items,
      ...attachmentInputs(attachments, { fileMentions: coreTakesFileMentions(boot?.core) }),
      ...(chip ? [chip.item] : []),
    ];
  }
  // `started`: the thread a first message from Home created. Once thread/start made it current, leaving it
  // stashed the still-live draft under that id rather than under Home's key.
  // '!command' on a core without its own shell mode: a terminal tab runs it in the session folder (shown in the pane),
  // and when it ends its output goes to the model as the user's message (queued if a turn runs by then).
  async function runTerminalShell(command) {
    const id = current, text = draft, sequence = loadSeq.current;
    if (!id) { setError(t("Start a local session first to run shell commands.")); return; }
    if (sending || !boot?.connected || session?.archived) return;
    setError("");
    let info;
    try { info = await terminalStore().run(id, command); }
    catch (e) { setError(terminalError(e, t("Failed to start command in terminal"))); return; }
    openPaneTile("terminal", id);
    clearComposerDraft(sequence, text, [], id);
    try {
      const result = await terminalStore().wait(id, info.id, 30 * 60 * 1000);
      if (result?.closed) return;
      if (result?.running) { setError(t("The command is still running in the terminal, so its output wasn’t sent.")); return; }
      const turnCwd = workdir || cwd, input = composerInput(shellOutputMessage(command, result), turnCwd);
      await ensureResumed(id);
      if (latestState.current.active?.[id]) { await rpc("thread/queue/add", { threadId: id, input, clientUserMessageId: crypto.randomUUID() }); loadQueue(id); return; }
      setTurnRequested(id);
      try { await rpc("turn/start", { threadId: id, input, ...turnOptions(turnCwd, effectivePermission) }); }
      catch (e) { setTurnRequested((value) => value === id ? null : value); throw e; }
    } catch (e) { setError(e?.message ? cleanErrorReason(e.message) : t("Couldn’t send the command’s output to {core}. Check the terminal tab.", { core: coreName(boot?.core) })); }
  }
  function clearComposerDraft(sequence, text, entries, sessionId, started = sessionId) {
    if (sequence !== loadSeq.current) {
      clearStashedDraft(sessionId, text);
      if (started !== sessionId) clearStashedDraft(started, text);
      return;
    }
    setDraft((value) => (value === text ? "" : value));
    setAttachments((value) => { value.filter((entry) => entries.includes(entry)).forEach(revokePreview); return value.filter((entry) => !entries.includes(entry)); });
    setMentions([]);
    // The live key is rewritten by the persist effect; a Home send dropped its stored Home copy when thread/start made
    // the new session current (send()), so only the stashed (navigated-away) case above needs the text-guarded forget.
  }
  // Steer or queue while a turn runs (official lanes: Enter = "next" →
  // turn/steer with the active turn id, Cmd+Enter = "later" → thread/queue/add;
  // a non-steerable review/compact turn falls back to the queue).
  // Interrupted steers go back to the composer of their session (appended to whatever is typed there).
  function restoreSteers(threadId, entries) {
    const text = entries.map((entry) => entry.text).filter((value) => typeof value === "string" && value.trim()).join("\n\n");
    if (!text) return;
    if (threadId === currentRef.current) setDraft((value) => value.trim() ? `${value}\n\n${text}` : text);
    else {
      // Another session's stashed draft (composerDrafts, keyed like the live switch) takes the text.
      const key = draftKey(threadId), stashed = composerDrafts.current.get(key);
      const value = { text: stashed?.text?.trim() ? `${stashed.text}\n\n${text}` : text, attachments: stashed?.attachments ?? [], mentions: stashed?.mentions ?? [] };
      composerDrafts.current = saveDraft(composerDrafts.current, key, value);
      persistComposer(key, value);
    }
    if (toasts) toasts.add(tn(entries.length, "The turn stopped before your message was sent. It’s back in the composer.", "The turn stopped before your {count} messages were sent. They’re back in the composer.", { count: entries.length }), { variant: "warning" });
  }
  async function sendWhileRunning(priority) {
    const id = current, turnId = state.active[id];
    if (!id || !turnId || sending || !boot?.connected || session?.archived) return;
    const text = draft, entries = attachments, sequence = loadSeq.current;
    const lane = submitLane({ running: true, priority });
    // The "ultracode" keyword (not ignored with ⌥W) goes with a steered or queued message too: main adds its reminder.
    const keyword = keywordMatches.length > 0 && !keywordIgnored;
    if (keyword) setKeywordIgnored(false);
    const queueHint = keyword ? { codeDesktop: { workflowTurn: { keyword: true } } } : {};
    setSending(true);
    setError("");
    try {
      await dismissPendingQuestions(id); // R07 Dd: answer a waiting question first, then steer or queue.
      const input = composerInput(text, workdir || cwd);
      const clientUserMessageId = crypto.randomUUID();
      if (lane === "next") {
        const outcome = await call("steer", { threadId: id, expectedTurnId: turnId, input, clientUserMessageId, ...(keyword ? { keyword: true } : {}) });
        if (!outcome.ok) {
          if (!isNotSteerable(outcome)) throw new Error(outcome.message || t("The message could not be sent to the running turn."));
          await rpc("thread/queue/add", { threadId: id, input, clientUserMessageId, ...queueHint });
        } else {
          const inputText = steerInputText(input);
          setPendingSteers((all) => ({ ...all, [id]: [...(all[id] ?? []), { id: clientUserMessageId, input, text, turnId, preview: previewText(input), inputText, baseline: steerTextCount(latestState.current.items?.[id], inputText) }] }));
        }
      } else {
        await rpc("thread/queue/add", { threadId: id, input, clientUserMessageId, ...queueHint });
      }
      clearComposerDraft(sequence, text, entries, id);
      loadQueue(id);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }
  // Codex's asynchronous questions (request_user_input_async): an answer goes out as an ordinary message, steered into
  // the running turn (queued when it can't be steered) or as the next turn, as the Codex TUI sends it; answered and
  // skipped ones stay closed for this run of the app, and a later user message settles them in the transcript itself.
  const [asyncQuestionsDone, setAsyncQuestionsDone] = useState(() => new Set());
  const asyncQuestionsSettled = useMemo(() => {
    const settled = settledQuestionIds(items);
    for (const key of asyncQuestionsDone) if (key.startsWith(`${current}:`)) settled.add(key.slice(String(current).length + 1));
    return settled;
  }, [items, asyncQuestionsDone, current]);
  async function answerAsyncQuestion(itemId, text) {
    const id = current, turnId = state.active[id];
    if (!id || !boot?.connected || session?.archived) throw new Error(t("Your answer couldn’t be sent. Try again."));
    await ensureResumed(id);
    const input = [{ type: "text", text, text_elements: [] }];
    const clientUserMessageId = crypto.randomUUID();
    if (turnId) {
      const outcome = await call("steer", { threadId: id, expectedTurnId: turnId, input, clientUserMessageId });
      if (!outcome.ok) {
        if (!isNotSteerable(outcome)) throw new Error(outcome.message || t("The message could not be sent to the running turn."));
        await rpc("thread/queue/add", { threadId: id, input, clientUserMessageId });
        loadQueue(id);
      } else { const inputText = steerInputText(input); setPendingSteers((all) => ({ ...all, [id]: [...(all[id] ?? []), { id: clientUserMessageId, input, text, turnId, preview: previewText(input), inputText, baseline: steerTextCount(latestState.current.items?.[id], inputText) }] })); }
    } else {
      setTurnRequested(id);
      try { await rpc("turn/start", { threadId: id, input, ...turnOptions(workdir || cwd) }); }
      catch (e) { setTurnRequested((value) => value === id ? null : value); throw e; }
    }
    setAsyncQuestionsDone((all) => new Set(all).add(`${id}:${itemId}`));
  }
  const asyncQuestions = useMemo(() => ({
    settled: asyncQuestionsSettled,
    canAnswer: !!boot?.connected && !session?.archived && !loading && !!current,
    answer: (itemId, text) => answerAsyncQuestionRef.current(itemId, text),
    skip: (itemId) => setAsyncQuestionsDone((all) => new Set(all).add(`${current}:${itemId}`)),
  }), [asyncQuestionsSettled, boot?.connected, session?.archived, loading, current]);
  const answerAsyncQuestionRef = useRef(answerAsyncQuestion);
  answerAsyncQuestionRef.current = answerAsyncQuestion;
  async function send({ priority } = {}) {
    if (boot?.account?.deepseek && !boot.account.account) return; // R02: no DeepSeek key → no thread/turn (composer warning); the draft stays.
    // A known skill ('/pdf …', a chip from '/' or Add › Skills) parses without error and goes out as a message.
    const parsed = parseSessionCommand(draft, commandContext);
    if (parsed?.coreCommand) {
      if (parsed.error) { setError(parsed.error); return; }
      setCommandSuggestion(null);
      await runCoreCommand(parsed.coreCommand, parsed.args, draft);
      return;
    }
    // The core's own /feedback (feedback/upload): Codex's category / note / logs dialog (CodexFeedbackDialog), or another
    // core's that takes it (capabilities.feedbackUpload: Kimi Code, also as /bug).
    if (parsed && !parsed.coreCommand && (parsed.requested === "feedback" || (parsed.requested === "bug" && commandContext.feedbackUpload)) && (commandContext.claudeImport || commandContext.feedbackUpload) && boot?.connected) {
      setCommandSuggestion(null);
      setActionDialog({ kind: "codex-feedback", threadId: current || null, note: parsed.args || "", core: commandContext.claudeImport ? null : commandContext.coreName });
      setDraft((value) => value === draft ? "" : value);
      return;
    }
    if (parsed && !parsed.skill && !parsed.custom) {
      if (parsed.error) { setError(parsed.error); setCommandSuggestion(parsed.suggestion); return; }
      setCommandSuggestion(null);
      await executeCommand(parsed.id, parsed.args, draft);
      return;
    }
    if (actionPending) return;
    // A core that needs a sign-in it doesn't have (account/read requiresOpenaiAuth with no account: Codex, the ACP
    // cores' signInPrompt) would only fail the request upstream with a 401 after its retries. Like the DeepSeek key
    // gate above, nothing is sent and the draft stays; the core's sign-in starts instead (slash commands, /login
    // included, still run above).
    if (signInRequired) { startCoreSignIn(); return; }
    // ⌘⌥⏎ 'Send in a forked session': /fork with the draft as the fork's first message (an idle session, text only).
    if (priority === "fork") {
      if (!current || running || loading || sending || !draft.trim() || attachments.length) return;
      await executeCommand("fork", draft.trim(), draft);
      return;
    }
    if (!(draft.trim() || attachments.length) || attachments.some((entry) => entry.status !== "ready")) return;
    // Codex stopped this chat as a precaution (misalignment): like its own client, ordinary input stays off until a
    // new session or the card's explicit acknowledgment. The draft is kept.
    if (misalignedTurn && !running) { setError(t("This chat was stopped as a precaution. Start a new session to continue.")); return; }
    // '!command': the user's own shell command, not a prompt. A core with shell mode (Codex) runs it (thread/shellCommand);
    // on any other core it runs in a terminal tab and its output goes to the model (runTerminalShell).
    const shellCommand = shellModeCommand(draft, boot?.core, shellOptions);
    if (shellModeActive(draft, boot?.core, shellOptions)) {
      if (!shellCommand) return;
      if (running) { setError(t("Wait for {core} to finish before running a shell command.", { core: coreName(boot?.core) })); return; }
      if (attachments.length) { setError(t("A shell command can’t include attachments. Remove them, or remove the ! to send a message.")); return; }
      if (mentions.length) { setError(t("@-mentions can’t be used in a shell command. Remove them, or remove the ! to send a message.")); return; }
      if (shellModeKind(boot?.core, shellOptions) === "terminal") { await runTerminalShell(shellCommand); return; }
    }
    if (running) { await sendWhileRunning(priority); return; }
    if (loading || sending || !boot?.connected || session?.archived) return;
    // A human-typed "ultracode" (not ignored with alt+w) opts this turn into a dynamic workflow (Claude's keyword trigger).
    const keywordRequested = keywordMatches.length > 0 && !keywordIgnored && !shellCommand;
    if (keywordRequested) setKeywordIgnored(false);
    // 'Send and stay here' (cc43287c9 :35140-35200 stayOnDraft): ⌘⏎ on Home starts the session detached — no setCurrent,
    // no history entry — inserts its row and leaves an empty, focused Home composer. A second launch waits for the
    // first spawn (qc background spawn count, Jr).
    const stay = priority === "stay" && !current;
    if (stay && backgroundSpawnsRef.current > 0) return;
    if (current) {
      const transcript = transcriptRef.current;
      const identity = transcript?.getIdentity();
      transcript?.jumpToLatest({
        expectedSessionKey: `code:${current}`,
        expectedGeneration: identity?.generation,
      });
    }
    const sendSequence = loadSeq.current, origin = current;
    if (!stay) setSending(true);
    setError("");
    const text = draft;
    const entries = attachments, mentionList = mentions;
    let id = current;
    // F08 Mz: a session started after a custom group's "New session" is filed into that group.
    const startedGroup = current ? null : newSessionGroup.current;
    let turnCwd = workdir || cwd;
    // Et: a background launch empties the Home composer at dispatch; a failed one puts the draft back (no(T, D)) while
    // Home still shows an empty composer.
    let launched = false;
    // A thread this send created whose first turn never started (turn/start refused: an image the core can't read,
    // an oversized attachment, a disconnect) is discarded instead of left as an empty sidebar row.
    let createdHere = false, turnStarted = false, historyPushed = false;
    const restoreStay = () => {
      const live = liveComposer.current;
      if (currentRef.current || live.text || live.attachments.length) { entries.forEach(revokePreview); return; }
      setDraft(text); setAttachments(entries); setMentions(mentionList);
    };
    if (stay) {
      backgroundSpawnsRef.current += 1;
      setBackgroundSpawns((count) => count + 1);
      setDraft(""); setAttachments([]); setMentions([]);
    }
    // The optimistic bubble (approval-current.js:39548): the message leaves the composer at once and shows dimmed with
    // 'Sending…' until the core echoes it. Its previews stay alive for the bubble (revoked when it hands over).
    let pendingEntry = null;
    const showPending = (threadId) => {
      if (stay || shellCommand || !threadId) return;
      pendingEntry = { ...withKnownItems(pendingSend({ threadId, text, attachments: entries }), latestState.current.items?.[threadId] || []),
        input: composerInput(text, turnCwd), mentions: mentionList, turnCwd };
      const shown = pendingEntry;
      // A refused send stays above the new one until its own Retry or Discard.
      setPendingSends((all) => ({ ...all, [threadId]: [...(all[threadId] || []).filter((entry) => entry.status === "failed"), shown] }));
      setDraft((value) => (value === text ? "" : value));
      setAttachments((value) => value.filter((entry) => !entries.includes(entry)));
      setMentions([]);
    };
    if (id) showPending(id);
    try {
      if (!id && worktree && workspaceInfo?.isRepo) {
        turnCwd = await call("prepare-worktree", {
          cwd,
          branch: workspaceInfo.branch,
        });
        // A background launch (stay) leaves the Home environment as it was (stayOnDraft keeps qe/Q and useWorktree), so
        // every ⌘⏎ gets its own worktree; only a launch that opens its session hands Home over to the worktree.
        if (!stay && sendSequence === loadSeq.current) {
          setCwd(turnCwd);
          setWorktree(false);
        }
      }
      // Branch step 2 (cc43287c9 :35132 branchChanged; the spawn's 'git switch <branch>', asar index.chunk-l0PS_wmg.js):
      // with worktree off a recorded branch other than the checked-out one is switched to before the session starts;
      // a failure shows UR's toast and keeps the draft.
      const checkout = !id && !worktree ? branchCheckoutTarget(workspaceInfo) : null;
      if (checkout) {
        try { await call("branch-checkout", { cwd: turnCwd, branch: checkout }); }
        catch {
          if (toasts) toasts.add(t(WORKING_TREE_ERROR), { variant: "danger" }); else setError(t(WORKING_TREE_ERROR));
          if (stay) restoreStay();
          return;
        }
        setWorkspaceInfo((info) => (info && info.branch === checkout ? { ...info, checkedOut: checkout } : info));
      }
      if (!id) {
        const startParams = {
          cwd: turnCwd,
          model: model || null,
          serviceTier,
          ...threadPermissionParams({permission: effectivePermission, mode, ...permissionHints()}),
          // Codex only: the DeepSeek core honors developerInstructions (structured.js, for workflow agents), and its
          // persona and custom instructions come from the profile and codeDesktop.customization instead.
          ...(coreSupports(boot?.core, "customization") ? {} : { developerInstructions:
            "You are the assistant in Code Desktop, a local desktop client. Follow the user language. When asked for a plan, use the plan tool. Do not claim to be Claude." }),
        };
        // The draft's turned-off tools (Add › Tools); main saves them as the new session's.
        if (toolSelection) startParams.codeDesktop = { ...startParams.codeDesktop, tools: sessionTools };
        const r = await rpc("thread/start", withAgentChoice(startParams, ""));
        id = r.thread.id;
        createdHere = true;
        // Ultracode picked on Home carries into the session it starts, for this app run only.
        if (ultracodeOn) sessionUltracode.current.set(id, effort);
        // The draft's agent choice now belongs to the new session.
        if (agentChoices[""]) setAgentChoices((choices) => { const { [""]: drafted, ...rest } = choices; return { ...rest, [r.thread.id]: drafted }; });
        setDraftTools(undefined);
        // main saved the draft's set as the new session's (config.threadTools); mirror it for Add › Tools.
        const startedTools = toolSelection ? normalizeSelection(sessionTools) : null;
        if (startedTools) setBoot(value => value?.config ? { ...value, config: { ...value.config, threadTools: { ...value.config.threadTools, [r.thread.id]: startedTools } } } : value);
        bypassMode.adoptSession(id);
        // :35161-35168 vi(a, t.split('\n')[0].slice(0, 80)): a background launch is titled from its first line.
        // A message that is only attachments is named after its files (a core refuses an empty name).
        const name = firstMessageName(text, entries, stay ? { max: 80, firstLine: true } : { max: 64 });
        setSessions((s) => [{ ...r.thread, name }, ...s.filter((t) => t.id !== r.thread.id)]);
        if (!stay && sendSequence === loadSeq.current) {
          // The New session page's terminals (its folder) go with the session they started: their pane stays open,
          // running commands and scrollback included.
          const homeTerminals = workdir && terminalStore().get(ownerKeyOf(null, workdir))?.tabs?.length > 0;
          const homeTerminalOpen = !!tileStore.getSession(HOME_TILE_KEY)?.tileLayout && tileIds(baseTileLayout(tileStore.getSession(HOME_TILE_KEY))).has("terminal");
          if (homeTerminals) void terminalStore().adopt(id, workdir).then((moved) => { if (moved.length && homeTerminalOpen) { openPaneTile("terminal", id); closePaneTile("terminal", HOME_TILE_KEY); } });
          setCurrent(id);
          currentRef.current = id;
          // The live draft now belongs to the new session's key: drop the stored Home copy outright (it may hold an
          // older debounced prefix that a text-guarded forget would miss) and the pending Home write.
          pendingDraftWrite.current = null;
          forgetDraft(browserStorage(), homeDraftKey);
          setHistory((h) => [...h, id]);
          setHistoryAt((h) => h + 1);
          historyPushed = true;
          showPending(id);
        }
        resumed.current.add(id);
        // A core that names its sessions (generatesTitles) keeps its own title; the first message stays the local name meanwhile.
        if (name.trim() && !coreSupports(boot?.core, "generatesTitles")) await rpc("thread/name/set", { threadId: id, name });
        // Codex names a new session from its first message (titleRequest): the first-message name stays until it does.
        if (name.trim() && text.trim() && coreSupports(boot?.core, "titleRequest")) void requestThreadTitle(id, name, text, turnCwd);
      }
      if (startedGroup && newSessionGroup.current === startedGroup) newSessionGroup.current = null;
      await updateSessionMetadata(id, { additionalFolders, ...(startedGroup && !origin ? { customGroupId: startedGroup } : {}) });
      await ensureResumed(id);
      if (!stay) setTurnRequested(id);
      // Shell mode: Codex runs the command as its own turn (a commandExecution with source userShell).
      if (shellCommand) await rpc("thread/shellCommand", { threadId: id, command: shellCommand });
      else await rpc("turn/start", { threadId: id, input: pendingEntry?.input ?? composerInput(text, turnCwd), ...turnOptions(turnCwd, effectivePermission, { keyword: keywordRequested }) });
      turnStarted = true;
      const accepted = pendingEntry;
      if (accepted) updatePendingSend(id, accepted.id, acceptedSend);
      if (stay) {
        launched = true;
        entries.forEach(revokePreview);
        forgetDraft(browserStorage(), homeDraftKey, { text });
      } else clearComposerDraft(sendSequence, text, entries, origin, id);
    } catch (e) {
      if (stay) { if (!launched) restoreStay(); }
      else setTurnRequested(value => value === id ? null : value);
      const refused = pendingEntry;
      if (createdHere && !turnStarted && id) {
        // A session this send created goes away with its message back in the composer: no bubble is kept.
        if (refused) updatePendingSend(id, refused.id, () => null);
        discardFailedStart(id, { text, entries, mentions: mentionList, historyPushed, stay });
        setError(e.message);
      } else if (refused && !turnStarted) {
        // :39779-39823: the refused send stays in the transcript as 'Not delivered' with Retry / Discard (no banner).
        updatePendingSend(id, refused.id, (entry) => failedSend(entry, e));
      } else setError(e.message);
    } finally {
      if (stay) {
        backgroundSpawnsRef.current -= 1;
        spawnFocus.current = true;
        setBackgroundSpawns((count) => count - 1);
      } else setSending(false);
    }
  }
  // send()'s rollback for a session it created whose first turn/start failed: the row leaves the sidebar, the window
  // goes back to Home with the message still in the composer (so it can be fixed and resent), and the empty thread is
  // deleted from the core (archived where a core can't delete). Never touches a session that has a turn.
  function discardFailedStart(id, { text, entries, mentions: mentionList, historyPushed, stay }) {
    setSessions((list) => list.filter((thread) => thread.id !== id));
    setSessionMetadata((value) => { if (!(id in value)) return value; const next = { ...value }; delete next[id]; return next; });
    setPinnedOrder((order) => order.includes(id) ? order.filter((known) => known !== id) : order);
    resumed.current.delete(id);
    if (!stay) {
      if (historyPushed) {
        setHistory((h) => { const at = h.lastIndexOf(id); return at < 0 ? h : [...h.slice(0, at), ...h.slice(at + 1)]; });
        setHistoryAt((at) => Math.max(0, at - 1));
      }
      // The composer copy stashed under the discarded session's key is dropped (its previews stay: Home reuses them).
      const dropStash = () => { composerDrafts.current = clearDraft(composerDrafts.current, draftKey(id)).map; forgetDraft(browserStorage(), draftKey(id)); };
      if (currentRef.current === id) {
        void openSession(null);
        dropStash();
        const live = { text, attachments: entries, mentions: mentionList };
        liveComposer.current = live;
        setDraft(text); setAttachments(entries); setMentions(mentionList);
      } else {
        // The user already left: the message waits in Home's composer slot instead of the deleted session's.
        // An optimistic send already emptied that composer, so an empty stash falls back to the message itself.
        const stashed = composerDrafts.current.get(draftKey(id));
        const restored = stashed?.text?.trim() || stashed?.attachments?.length ? stashed : text.trim() || entries.length ? { text, attachments: entries, mentions: mentionList } : stashed;
        dropStash();
        if (restored && !composerDrafts.current.has(homeDraftKey) && currentRef.current) composerDrafts.current = saveDraft(composerDrafts.current, homeDraftKey, restored);
      }
    }
    void rpc("thread/delete", { threadId: id }).catch(() => rpc("thread/archive", { threadId: id })).catch(() => {});
  }
  // One optimistic send of a thread changes (change returns the new entry, or null to drop it).
  function updatePendingSend(threadId, entryId, change) {
    setPendingSends((all) => {
      const list = all[threadId];
      if (!list?.some((entry) => entry.id === entryId)) return all;
      const next = list.map((entry) => entry.id === entryId ? change(entry) : entry).filter(Boolean);
      if (next.length) return { ...all, [threadId]: next };
      const { [threadId]: _dropped, ...rest } = all;
      return rest;
    });
  }
  // 'Not delivered' Retry (:39779-39823): the same input goes out again as a new turn/start.
  async function retryPendingSend(threadId, entryId) {
    const entry = pendingSends[threadId]?.find((shown) => shown.id === entryId);
    if (!entry || entry.status !== "failed" || running || loading || sending || actionPending || !boot?.connected || session?.archived) return;
    updatePendingSend(threadId, entryId, (shown) => retriedSend(shown, latestState.current.items?.[threadId] || []));
    setSending(true);
    setError("");
    try {
      await ensureResumed(threadId);
      setTurnRequested(threadId);
      await rpc("turn/start", { threadId, input: entry.input, ...turnOptions(entry.turnCwd, effectivePermission) });
      updatePendingSend(threadId, entryId, acceptedSend);
    } catch (e) {
      setTurnRequested((value) => value === threadId ? null : value);
      updatePendingSend(threadId, entryId, (shown) => failedSend(shown, e));
    } finally { setSending(false); }
  }
  // Discard: the bubble goes and its message returns to the composer (after whatever is typed there now).
  function discardPendingSend(threadId, entryId) {
    const entry = pendingSends[threadId]?.find((shown) => shown.id === entryId);
    if (!entry || entry.status !== "failed") return;
    updatePendingSend(threadId, entryId, () => null);
    const live = liveComposer.current;
    if (!live.text.trim() && !live.attachments.length) { setDraft(entry.text); setAttachments(entry.attachments); setMentions(entry.mentions || []); }
    else {
      if (entry.text) setDraft((value) => value.trim() ? `${value}\n\n${entry.text}` : entry.text);
      if (entry.attachments.length) setAttachments((value) => [...value, ...entry.attachments.filter((part) => !value.includes(part))]);
    }
    textarea.current?.focus();
  }
  async function performOperation(operation, extra = {}) {
    const id = currentRef.current, sequence = loadSeq.current;
    if (!id || actionLock.current.has(id)) throw new Error(t("A session action is already starting."));
    const expected = {connectionId:state.approvalConnectionId, connectionEpoch:state.approvalConnectionEpoch};
    actionLock.current.add(id);
    setError("");
    try {
      const result = await call("session-action", {operation, threadId:id, permission: effectivePermission, afterPlan: afterPlan.current, mode, expected, ...extra});
      if (operation === "fork") {
        const fork = result.thread;
        recordForkPoint(id, fork.id, null);
        setSessionMetadata(value => ({...value, [fork.id]:result.sessionMetadata}));
        setSessions(value => [fork, ...value.filter(thread => thread.id !== fork.id)]);
        if (sequence === loadSeq.current && expected.connectionId === stopLive.current.connectionId && stopLive.current.connected) {
          navigate(fork.id);
          setAdditionalFolders(result.sessionMetadata?.additionalFolders || []);
          if (result.warning) setError(result.warning);
        }
      }
      return result;
    } finally { actionLock.current.delete(id); }
  }
  // A core command (/goal …) runs on the core against the open session's agent, never as a model message; the core
  // answers {kind: "success" | "error", text} (codeDesktop/commands/execute).
  async function runCoreCommand(entry, args, sourceDraft, { confirmed = false } = {}) {
    const notice = (message, options) => { if (toasts) toasts.add(message, options); else setError(message); };
    // DeepSeek's /feedback uploads the session when feedback sharing is on: confirm first (FeedbackShareDialog).
    const feedback = coreSupports(boot?.core, "harnessProfile") && (entry.definitionId === "@deepseek-ai/dsh-command-feedback" || entry.name === "feedback");
    if (feedback && !confirmed && boot?.config?.deepseekFeedbackSharing === true && current && commandContext.connected) {
      setActionDialog({ kind: "feedback-share", text: args, run: () => runCoreCommand(entry, args, sourceDraft, { confirmed: true }) });
      return;
    }
    // The same session preconditions as a built-in session command (commandUnavailable).
    if (!current) { setError(t("Open a session first")); return; }
    if (session?.archived) { setError(t("Restore this archived session first")); return; }
    if (!commandContext.connected) { setError(t("Reconnect to DeepSeek first")); return; }
    if (loading) { setError(t("Wait for the session to load")); return; }
    // codeDesktop/commands/execute carries no input items: staged files would silently not go with it.
    if (attachments.length) { setError(t("/{command} can’t take attachments. Remove them, or send them in a message.", { command: entry.name })); return; }
    const origin = current;
    setError("");
    if (nativeInit && entry.name === "init") {
      try {
        if (args) { setError(t("/{command} doesn’t take arguments here. Remove the text after the command and try again.", { command: "init" })); return; }
        await ensureResumed(origin);
        setTurnRequested(origin);
        await rpc("turn/start", { threadId: origin, input: [{ type: "text", text: INIT_PROMPT, text_elements: [] }], ...turnOptions(workdir || cwd) });
        if (currentRef.current === origin) setDraft((value) => value === sourceDraft ? "" : value);
        else clearStashedDraft(origin, sourceDraft);
      } catch (e) { setTurnRequested((value) => value === origin ? null : value); setError(e.message); }
      return;
    }
    if (nativeGoals && entry.name === "goal") {
      try {
        let request = goalCommandRequest(args, origin, state.goals?.[origin] ?? null);
        if (request.error) { setError(request.error); return; }
        // Codex and the DeepSeek core edit a goal in place; another core's goals take /goal edit as a new objective,
        // which then asks before replacing the current one.
        if (request.edit && !["codex", "deepseek"].includes(coreForEngine(boot?.core?.engine).id))
          request = { method: "thread/goal/set", params: { threadId: origin, objective: request.params.objective, status: "active" } };
        // A new objective while a goal is unfinished asks first (Replace / Keep current goal), from the core's own view.
        const replacing = request.method === "thread/goal/set" && request.params.objective && !request.edit;
        if (replacing && !confirmed) {
          const existing = (await rpc("thread/goal/get", { threadId: origin }).catch(() => null))?.goal ?? state.goals?.[origin] ?? null;
          if (goalNeedsReplaceConfirmation(existing)) {
            setActionDialog({ kind: "goal-replace", current: existing.objective, objective: request.params.objective,
              run: () => runCoreCommand(entry, args, sourceDraft, { confirmed: true }) });
            return;
          }
        }
        // /goal pause and /goal clear change the goal without resuming the thread (goalAction).
        const quiet = request.method === "thread/goal/clear" || (request.method === "thread/goal/set" && request.params.status === "paused" && !request.params.objective);
        if (!quiet) await ensureResumed(origin);
        // Replacing clears the current goal first, as Codex's TUI does (ThreadGoalSetMode::ReplaceExisting).
        if (replacing && confirmed) await rpc("thread/goal/clear", { threadId: origin });
        const result = await rpc(request.method, request.params);
        if (quiet) applyGoalResult(origin, request.method, result);
        if (currentRef.current === origin) setDraft((value) => value === sourceDraft ? "" : value);
        else clearStashedDraft(origin, sourceDraft);
        notice(goalCommandResult(request, result));
      } catch (e) { setError(localizeBridgeText(e.message)); }
      return;
    }
    try {
      // A command can start a model turn on the agent (/goal), so it carries the session's turn/start permission,
      // model and effort (the core refuses one without them); a collaboration mode belongs to turn/start only.
      const { collaborationMode: _mode, cwd: _cwd, serviceTier: _tier, ...turn } = turnOptions(workdir || cwd);
      const result = await rpc("codeDesktop/commands/execute", { ...turn, threadId: origin, command: entry.name, args });
      if (currentRef.current === origin) setDraft((value) => value === sourceDraft ? "" : value);
      else clearStashedDraft(origin, sourceDraft);
      if (result?.kind === "error") notice(result.text || t("/{command} didn’t finish.", { command: entry.name }), { variant: "warning" });
      else if (feedback && boot?.config?.deepseekFeedbackSharing !== true) notice(t("Feedback saved on this computer. To send it to DeepSeek, turn on Share feedback with DeepSeek in Settings › Code › Privacy."));
      else if (result?.text) notice(result.text);
    } catch (e) { setError(e.message); }
  }
  async function executeCommand(id, args = "", sourceDraft) {
    const command = sessionCommands.find(command => command.id === id);
    if (!command) return;
    const unavailable = commandUnavailable(command, commandContext);
    if (unavailable) { setError(unavailable); return; }
    const sequence = loadSeq.current, origin = current;
    // A command that navigated (/clear, /fork) clears the stashed copy of its session's draft instead.
    const clearCommand = () => {
      if (sourceDraft === undefined) return;
      if (sequence === loadSeq.current) setDraft(value => value === sourceDraft ? "" : value);
      else clearStashedDraft(origin, sourceDraft);
    };
    // cc43287c9-BMbiZYzF.js:30292 ni() addSuccess / addWarning / addError: slash notices are CDS toasts.
    const notice = (message, options) => { if (toasts) toasts.add(message, options); else setError(message); };
    setMenu(null); setActionDialog(null); setError("");
    try {
      if (id === "compact") {
        // /compact [instructions] (ZCode's own '/compact [instructions]'): only a core that takes them.
        if (args && !coreSupports(boot?.core, "compactInstructions")) { setError(t("/compact doesn’t take instructions with {core}. Send it without text after the command.", { core: coreName(boot?.core) })); return; }
        await performOperation(id, args ? { instructions: args } : {}); clearCommand();
      }
      else if (id === "cd") {
        // /cd <path>: the session continues in that folder as a fork with its history (session-operations forkFolder).
        if (!args) { setError(t("Name a folder: /cd <path>.")); return; }
        const origin=current;
        if (coreSupports(boot?.core, "moveCwd") && boot?.core?.capabilities?.forkCwd === false) {
          // OpenCode's /move: the same session continues in that folder (another folder of its project), the user's
          // uncommitted changes carried along when they choose so.
          const target = args;
          const { changes = 0 } = await rpc("codeDesktop/thread/move", { threadId: current, check: true }).catch(() => ({ changes: 0 }));
          const move = async (moveChanges) => {
            const moved = await rpc("codeDesktop/thread/move", { threadId: origin, cwd: target, moveChanges });
            if (moved?.thread?.id) { refreshSession(moved.thread.id); openSession(moved.thread.id); }
            if (moved?.moved) notice(t("Session moved to {folder}.", { folder: moved.thread?.cwd ?? target }));
          };
          clearCommand();
          // Uncommitted changes: the Claude-styled three-way sheet (Bring changes / Leave them here / Cancel); Cancel,
          // Escape and the backdrop abort the move.
          if (changes > 0) { setActionDialog({ kind: "move-changes", changes, folder: target, run: move }); return; }
          await move(false);
          return;
        }
        await performOperation("fork", { cwd: args });
        if(currentRef.current!==origin) setDraft(value=>value===sourceDraft?'':value);
        if(sourceDraft!==undefined) clearStashedDraft(origin,sourceDraft);
      }
      else if (id === "fork") {
        const origin=current,originCwd=workdir,options=turnOptions(workdir);
        const result=await performOperation("fork");
        if(args){await ensureResumed(result.thread.id);await rpc("turn/start",{threadId:result.thread.id,input:[{type:"text",text:args,text_elements:[]}],...options,cwd:result.thread.cwd||originCwd});}
        // Navigation during fork increments loadSeq; only clear the command in the new fork.
        if(currentRef.current===result.thread.id || currentRef.current===origin) setDraft(value=>value===sourceDraft?'':value);
        if(sourceDraft!==undefined) clearStashedDraft(origin,sourceDraft);
      } else {
        switch (id) {
          case "review": setActionDialog({kind:"review", instructions:args}); break;
          case "status": {
            const record={id:crypto.randomUUID(),after:items.at(-1)?.id,session,model:chosen?.displayName||model,effort,efforts:chosen?.supportedReasoningEfforts||null,serviceTier:activeTier?activeTier.name:t("Standard"),permission:effectivePermission,cwd:workdir,usage:state.usage[current],connected:!!boot?.connected,running,operation,account:boot?.account,
              core:{name:coreName(boot?.core),engine:boot?.core?.engine??null,capabilities:boot?.core?.capabilities??null,version:typeof boot?.core?.engineVersion==="string"?boot.core.engineVersion:null,perTokenBilling:coreSupports(boot?.core,"perTokenBilling")},appVersion:clientVersion};
            setLocalCommandRows(value=>({...value,[current]:[...(value[current]||[]),record]}));break;
          }
          case "help": setActionDialog({kind:"help"}); break;
          case "import": setActionDialog({kind:"claude-import"}); break;
          case "recap": void runRecap(current); break;
          // /btw [question]: the side chat, without touching the running turn.
          case "btw": setSideChat({ open: true, pending: args || null }); clearCommand(); break;
          case "clear": navigate(null); break;
          // 'Resume a session': every session the core keeps, its own CLI's or app's included (source-resume-dialog.jsx).
          case "resume": setActionDialog({ kind: "resume", query: args || "" }); break;
          case "config": setSettings("code"); break;
          case "login": setSettings("preferences#account"); break;
          case "update": setSettings("cores"); break;
          case "usage": setSettings("usage"); break;
          case "sandbox": setSettings("code#sandbox"); break;
          case "theme": {
            // cc43287c9 zI: auto is system; no or an unknown argument opens the picker.
            const parsed=parseThemeCommand(args);
            if(parsed.open){setSettings("preferences#theme");break;}
            // :33700-33716 addSuccess('Appearance set to …') → a neutral toast.
            await updatePreferences({theme:parsed.set});notice(t('Appearance set to {theme}',{theme:t(THEME_LABELS[parsed.set])}),{variant:'neutral'});break;
          }
          case "skills": setSettings("customize-skills"); break;
          case "mcp": setSettings("customize-connectors"); break;
          case "plugin": setSettings("customize-plugins"); break;
          case "fast": {
            // /fast <speed>: a tier by name (/fast ultrafast) or standard, when the model lists more than one.
            const word=String(args||"").trim().toLowerCase(), named=word&&word!=="on"&&word!=="off"?(word===STANDARD_SPEED?STANDARD_SPEED:speedTiers.find(tier=>tier.key===word)?.key):null;
            if(word&&!["on","off"].includes(word)&&!named)throw new Error(speedTiers.length>1?t("Use /fast, /fast on, /fast off, or /fast {speeds}.",{speeds:[STANDARD_SPEED,...speedTiers.map(tier=>tier.key)].join(" | ")}):t("Use /fast, /fast on, or /fast off."));
            if(named){if(named===(activeTier?.key??STANDARD_SPEED))notice(t('Speed is already {speed}.',{speed:activeTier?.name??t('Standard')}),{variant:'warning',key:'epitaxy-fast-command-notice'});else await changeSpeed(named);break;}
            const next=word?word==="on":!fastEnabled;
            // :11310-11322 addWarning(…, {uniqueKey:'epitaxy-fast-command-notice'}).
            if(next===fastEnabled)notice(next?t('Fast mode is already on.'):t('Fast mode is already off.'),{variant:'warning',key:'epitaxy-fast-command-notice'});else await changeFastMode(next);break;
          }
          case "model": {
            if(!args){setMenu({kind:"model",anchor:scope().querySelector('.sc-model-trigger')});break;}
            const next=models.find(m=>m.model===args||m.id===args);if(!next)throw new Error(t('“{name}” isn’t an available model.',{name:args}));
            await chooseModel({model:next.model,effort:next.defaultReasoningEffort});break;
          }
          case "effort":
            // /effort alone opens the effort popover on its chip (the model pill when the chip is absent).
            if(!args){setMenu({kind:"effort",anchor:scope().querySelector('.sc-chin .sc-effort-trigger')||scope().querySelector('.sc-model-trigger'),token:++menuToken.current});break;}
            if(!efforts.some(e=>e.reasoningEffort===args))throw new Error(t('“{name}” isn’t an available effort level.',{name:args}));
            // Ultracode is this session only (Claude: interactive toggles never persist it): Home keeps it unsaved.
            if(currentRef.current){setEffort(args);await chooseModel({effort:args});}else if(workflowState.enabled&&isUltracodeTier(args))setEffort(args);else await updatePreferences({effort:args});break;
          case "permissions": setMenu({kind:"permission",anchor:scope().querySelector('.sc-permission')}); break;
          case "plan": {
            // :33830-33880 → vG (planCommandAction): Plan is always in the local Mode menu; hasPlan (rS) is a written
            // plan, and the pane opens (yG) unless it already shows.
            const plan=planCommandAction({arg:args,currentMode:effectivePermission,hasPlan:!!(state.plans[current]?.length||state.planDocs?.[current]),canOpenPane:!!current,paneAlreadyOpen:openPanes.has('plan')});
            if(plan.switchToPlan)await updatePreferences({permission:'plan'});
            if(plan.openPane)setPanel('plan');
            // :33860-33877 addWarning(…, {uniqueKey:'epitaxy-plan-command-notice'}).
            if(plan.notice)notice(plan.notice==='already_in_plan_no_plan'?t('Already in plan mode. No plan written yet.'):t('Already in plan mode.'),{variant:'warning',key:'epitaxy-plan-command-notice'});
            if(plan.composerText!==null)setDraft(plan.composerText);break;
          }
          case "diff": togglePaneTile("changes"); break;
          case "tasks": togglePaneTile("tasks"); break;
          case "workflows": changeTileView({taskViews:[]});openPaneTile('tasks');break;
          // A core with only its own workflow engine (Qwen Code) runs /workflow itself; its run shows in the WorkflowCard.
          // A core with its own /workflow command (ZCode) gets that command as typed (its path "command:workflow" row),
          // so the core loads its workflow-design guidance itself.
          case "workflow": if (workflowEngine(runningCore, boot?.config?.workflowEngines) === "agent") { const own = coreWorkflowCommand(commandContext.skills); await (own ? sendFixedTurn(args, [{ type: "skill", name: own.name, path: own.path }]) : sendFixedTurn(agentWorkflowPrompt(args))); clearCommand(); break; }
            setWorkflowLaunch({...parseWorkflowLaunch(args),threadId:current,cwd:workdir,model,effort:coreEffort(effort),permission:effectivePermission,mode,access:workflowAccess({permission:effectivePermission,mode}),after:items.at(-1)?.id});break;
          case "rename":
            if(args){if(!await renameSession(current,args))return;}else setRename({id:current,name:session?.name||session?.preview||""});break;
          case "add-dir": {
            const dir=await call('folder',{additional:true,...(args?{path:args,cwd:workdir}:{})});
            if(dir&&sequence===loadSeq.current){const next=[...new Set([...additionalFolders,dir])];setAdditionalFolders(next);if(current)await updateSessionMetadata(current,{additionalFolders:next});}break;
          }
          case "export": {
            const full=await readFullHistory(current);
            if(full.truncated||full.unavailable)throw new Error(t('Conversation history is incomplete. Export was not saved.'));
            await call('slash-export',{threadId:current,markdown:transcriptMarkdown(shownThread(full.thread),shownTurns(full.turns))});break;
          }
          case "rewind": {
            const full=await readFullHistory(current);
            if(full.thread.historyMode!=='paginated')throw new Error(t('Rewind is not available for legacy sessions.'));
            // 'Rewind to here' from the message menu opens with that message chosen.
            const preselected=rewindPreselect.current;rewindPreselect.current=null;
            if(sequence===loadSeq.current)setActionDialog({kind:'rewind',threadId:current,turns:rewindChoices(shownTurns(full.turns)),preselected});break;
          }
        }
        clearCommand();
      }
    // :33437-33444 / :33800-33810: a failed command (bad argument, refused action) is a warning toast, not the composer banner.
    } catch (error) { if (sequence === loadSeq.current) notice(error.message, {variant:'warning'}); }
  }
  async function readFullHistory(id) {
    const known=state.threads[id]||sessions.find(thread=>thread.id===id),route=historyRoute(known);
    const response=await rpc('thread/read',historyReadParams(id,known));
    const history=await loadThreadHistory(rpc,{threadId:id,thread:response.thread,route});
    return {...history,thread:response.thread};
  }
  async function rewindConversation(beforeTurnId, { restoreFiles = false } = {}) {
    const id=actionDialog.threadId,sequence=loadSeq.current,baselineItems=state.items[actionDialog.threadId],baselineActiveVersion=state.activeVersions?.[actionDialog.threadId];
    const result=await call('slash-rewind',{threadId:id,beforeTurnId,restoreFiles,expected:{connectionId:state.approvalConnectionId,connectionEpoch:state.approvalConnectionEpoch}});
    const history=await loadThreadHistory(rpc,{threadId:id,thread:result.thread,route:historyRoute(result.thread)});
    if(history.truncated||history.unavailable)throw new Error(t('Rewind succeeded, but retained history could not be fully loaded. Reopen the session.'));
    dispatch({type:'hydrate',id,thread:{...result.thread,turns:history.turns},replaceHistory:true,baselineItems,baselineActiveVersion});
    setLocalCommandRows(rows=>({...rows,[id]:[]}));
    if(sequence===loadSeq.current){setDraft(actionDialog.turns.find(t=>t.id===beforeTurnId)?.text||'');setActionDialog(null);}
    // A core that restored files in the same rewind (thread/revert codeDesktop.filesRestored: Qwen's file history) says how many.
    const restoredFiles=Array.isArray(result?.codeDesktop?.filesRestored)?result.codeDesktop.filesRestored.length:0;
    if(restoredFiles&&toasts)toasts.add(tn(restoredFiles,'Rewound. {count} file was restored.','Rewound. {count} files were restored.',{count:restoredFiles}));
  }
  async function readSessionStatus() {
    if (!boot?.connected) return {error:t("Reconnect to load account usage limits.")};
    const [account, limits] = await Promise.allSettled([rpc("account/read", {refreshToken:false}), rpc("account/rateLimits/read")]);
    return {account:account.status === "fulfilled" ? account.value : null, limits:limits.status === "fulfilled" ? limits.value : null,
      error:[account,limits].filter(result => result.status === "rejected").map(result => result.reason.message).join("\n")};
  }
  async function readAccountUsageDetails() {
    const data = await readSessionStatus();
    // Quota is required for this page. A failed RPC must reach SourceUsage's
    // failed-refresh path, rather than replacing its last snapshot with null.
    // A successful empty limits object remains a valid, unavailable snapshot.
    if (data.limits == null) throw new Error(data.error || t("Usage limits are unavailable for this account or connection."));
    setPlanLimits(data.limits);
    // main answers a per-token account's refused limits with codeDesktop.perTokenBilling (account-operations
    // perTokenRefusal, through perTokenUsage). boot.core only learns it on the next connect, so the running core takes it now and the
    // Usage page (usageEmptyText(boot.core)) explains per-token billing instead of "unavailable".
    if (data.limits?.codeDesktop?.perTokenBilling === true)
      setBoot((b) => b?.core && typeof b.core === "object" && b.core.capabilities?.perTokenBilling !== true
        ? { ...b, core: { ...b.core, capabilities: { ...(b.core.capabilities ?? {}), perTokenBilling: true } } } : b);
    try { data.tokenUsage = await rpc("account/usage/read", {}); }
    catch (error) { data.tokenUsageError = error.message; }
    // A core with no daily buckets or breakdown (Codex on an API key or custom endpoint): the page shows the tokens
    // Code Desktop counted on this Mac instead, the same numbers as Home's stats card (main.cjs 'stats').
    const usage = data.tokenUsage;
    if (!(Array.isArray(usage?.dailyUsageBuckets) && usage.dailyUsageBuckets.length) && !usage?.deepseek && !usage?.breakdown) {
      try { data.localStats = await call("stats"); } catch {}
    }
    return data;
  }
  // Usage page actions (Codex 0.155.1): redeem an earned usage-limit reset after the page's confirmation, and a
  // workspace member's request to the owner. main.cjs rebuilds both params.
  const usageActions = useMemo(() => ({
    consumeResetCredit: (params) => rpc("account/rateLimitResetCredit/consume", params),
    sendCreditsNudge: (creditType) => rpc("account/sendAddCreditsNudgeEmail", { creditType }),
  }), []);
  // Opening the usage popover refreshes the plan limits (hd md refresh on open), without the reset-credit details.
  const refreshPlanLimits = () => {
    if (!boot?.connected) return;
    rpc("account/rateLimits/read", { excludeResetCreditDetails: true }).then((limits) => { if (limits && typeof limits === "object") setPlanLimits(limits); }, () => {});
  };
  // Plan limits are read once per connection on a core with plan limits, so the composer's usage notice
  // (composerUsageNotice) knows the windows before the first account/rateLimits/updated.
  useEffect(() => { if (boot?.connected && !coreSupports(boot?.core, "perTokenBilling")) refreshPlanLimits(); }, [boot?.connected, boot?.core]);
  // Codex's startup hook review (startup_hooks_review.rs 'Hooks need review'): once per connection and folder, a notice
  // when hooks there are new or changed since they were trusted, so they don't silently stop running. 'Review hooks'
  // opens Customize › Hooks.
  const [hooksReview, setHooksReview] = useState(null);
  const hooksChecked = useRef(new Set());
  const hooksFolder = workdir || cwd || "";
  useEffect(() => {
    if (!boot?.connected || coreForEngine(boot?.core?.engine).kind !== "native" || !coreSupports(boot?.core, "hooksList")) { setHooksReview(null); return; }
    const key = `${boot?.core?.engine ?? ""}:${hooksFolder}`;
    if (hooksChecked.current.has(key)) return;
    hooksChecked.current.add(key);
    let live = true;
    call("customize", { operation: "hooks", cwd: hooksFolder || undefined })
      .then((result) => { if (live) { const count = hooksView(result, hooksFolder || null).needsReview; setHooksReview(count > 0 ? { folder: hooksFolder, count } : null); } }, () => {});
    return () => { live = false; };
  }, [boot?.connected, boot?.core, hooksFolder]);
  useEffect(() => { if (!boot?.connected) hooksChecked.current.clear(); }, [boot?.connected]);
  const hooksNotice = hooksReview && hooksReview.folder === hooksFolder
    ? { kind: "hooksReview", level: "info", summary: hooksReviewSummary(hooksReview.count), details: t("Until you trust them, {core} skips them.", { core: coreName(boot?.core) }),
      actions: [{ label: t("Review hooks"), run: () => setSettings("customize-hooks") }], onDismiss: () => setHooksReview(null) } : null;
  const usageNotice = useMemo(() => planLimits && !coreSupports(boot?.core, "perTokenBilling")
    ? composerUsageNotice(planLimits, { core: coreName(boot?.core), locale: getLocale() }) : null, [planLimits, boot?.core]);
  // Codex's backend banner from the same usage read (rateLimitUpsell; tui backend_banners.rs): the backend's own title,
  // description and remedies, plus its fallback for a blocked model, which Codex switches to and back from once
  // ordinary usage is allowed again (chatwidget/backend_banners.rs, luna_reserve_return.rs). Here the switch is one
  // click, and the return is automatic only for a switch made from this banner.
  const upsell = useMemo(() => planLimits && !coreSupports(boot?.core, "perTokenBilling")
    ? backendBanner(planLimits.rateLimitUpsell, { accountId: planLimits.accountId, planType: planLimits.rateLimits?.planType }) : null, [planLimits, boot?.core]);
  const upsellFallback = bannerFallbackModel(upsell, model, models);
  const upsellSwitch = useRef(null);
  useEffect(() => {
    const made = upsellSwitch.current;
    if (!made || planLimits?.ordinaryUsageAllowed !== true) return;
    upsellSwitch.current = null;
    if (model === made.to) updatePreferences({ model: made.from, ...(made.effort ? { effort: made.effort } : {}) });
  }, [planLimits?.ordinaryUsageAllowed, model]);
  const upsellNotice = upsell ? {
    kind: "upsell", level: "info", summary: upsell.title, details: upsell.description || null,
    dismissKey: `upsell:${upsell.type}:${upsell.title}`, dismissible: upsell.dismissible,
    actions: [
      ...(upsellFallback ? [{ label: t("Switch to {model}", { model: upsellFallback.displayName || upsellFallback.model }), run: () => {
        upsellSwitch.current = { from: model, effort, to: upsellFallback.model };
        updatePreferences({ model: upsellFallback.model, effort: upsellFallback.defaultReasoningEffort });
      } }] : []),
      ...upsell.actions.map((action) => ({ label: action.label, run: () => {
        if (action.kind === "url") call("external", { url: action.url }).catch(actionFailed("open-link"));
        else if (action.kind === "reset") setSettings("usage");
        else if (action.kind === "nudge") rpc("account/sendAddCreditsNudgeEmail", { creditType: action.creditType }).then((value) => {
          const ok = ["sent", "cooldown_active"].includes(value?.status);
          const message = action.creditType === "credits"
            ? (ok ? t("Workspace owner notified.") : t("Couldn’t notify your workspace owner. Try again."))
            : (ok ? t("Limit increase requested.") : t("Couldn’t request a limit increase. Try again."));
          if (toasts) toasts.add(message, { variant: ok ? "neutral" : "danger" }); else if (!ok) setError(message);
        }, (error) => setError(error.message));
      } })),
    ],
  } : null;
  // ChatGPT workspace headlines on Codex (account/workspaceMessages/read, every 5 minutes like tui workspace_messages.rs):
  // the newest headline as a notice, dismissed per messageId. A disabled feature or a refused read shows nothing.
  const [workspaceHeadline, setWorkspaceHeadline] = useState(null);
  const chatgptAccount = boot?.account?.account?.type === "chatgpt" && coreForEngine(boot?.core?.engine).id === "codex";
  useEffect(() => {
    if (!boot?.connected || !chatgptAccount) { setWorkspaceHeadline(null); return undefined; }
    let live = true;
    const read = () => rpc("account/workspaceMessages/read", {}).then((value) => {
      if (!live) return;
      const headlines = value?.featureEnabled === false ? [] : (Array.isArray(value?.messages) ? value.messages : [])
        .filter((message) => message?.messageType === "headline" && typeof message.messageBody === "string" && message.messageBody.trim() && typeof message.messageId === "string");
      headlines.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
      setWorkspaceHeadline(headlines[0] ?? null);
    }, () => { if (live) setWorkspaceHeadline(null); });
    void read();
    const timer = setInterval(read, 5 * 60 * 1000);
    return () => { live = false; clearInterval(timer); };
  }, [boot?.connected, chatgptAccount]);
  const [headlineDismissals, setHeadlineDismissals] = useState(() => { try { return JSON.parse(globalThis.localStorage?.getItem("code-desktop.workspaceHeadlineDismissed") || "[]") || []; } catch { return []; } });
  const headlineNotice = workspaceHeadline && !headlineDismissals.includes(workspaceHeadline.messageId) ? {
    kind: "workspaceHeadline", level: "info", summary: workspaceHeadline.messageBody.trim(), details: null, dismissKey: `headline:${workspaceHeadline.messageId}`,
    onDismiss: () => setHeadlineDismissals((all) => { const next = [...all, workspaceHeadline.messageId].slice(-50); try { globalThis.localStorage?.setItem("code-desktop.workspaceHeadlineDismissed", JSON.stringify(next)); } catch {} return next; }),
  } : null;
  // Codex holding a request for extra safety checks (state.safetyBuffering; tui chatwidget/safety_buffering.rs): say
  // why the spinner waits, and offer its faster model, which stops this turn and sends the same message with it.
  const buffering = current ? state.safetyBuffering?.[current] : null;
  const fasterModel = buffering?.fasterModel ? models.find((entry) => entry.model === buffering.fasterModel) : null;
  const bufferingNotice = buffering && running ? {
    kind: "safetyBuffering", level: "info", summary: t("Giving this request a little extra thought"),
    details: buffering.fasterModel ? t("If you’d rather not wait, retry with a faster model. It may be less capable of handling complex requests.")
      : t("No action is required. {core} will keep waiting, and this notice closes when the response is ready.", { core: coreName(boot?.core) }),
    dismissKey: `safety:${current}:${buffering.turnId ?? ""}`,
    actions: [
      ...(buffering.fasterModel ? [{ label: t("Retry with {model}", { model: fasterModel?.displayName || buffering.fasterModel }), run: () => void retryWithModel(buffering.fasterModel) }] : []),
      { label: t("Learn more"), run: () => call("external", { url: "https://help.openai.com/en/articles/20001326" }).catch(actionFailed("open-link")) },
    ],
  } : null;
  // Codex's model upgrade (Model.upgradeInfo {model, upgradeCopy, modelLink, retirementAt}; tui startup_prompts.rs
  // migration prompt): the saved model has a successor and maybe a retirement date. Dismissed per model, remembered.
  const [upgradeDismissals, setUpgradeDismissals] = useState(() => { try { return JSON.parse(globalThis.localStorage?.getItem("code-desktop.modelUpgradeDismissed") || "{}") || {}; } catch { return {}; } });
  const savedModel = models.find((entry) => entry.model === model);
  const upgradeInfo = savedModel?.upgradeInfo && typeof savedModel.upgradeInfo.model === "string" && savedModel.upgradeInfo.model !== model ? savedModel.upgradeInfo : null;
  const upgradeTarget = upgradeInfo ? models.find((entry) => entry.model === upgradeInfo.model) : null;
  const upgradeKey = upgradeInfo ? `${model}>${upgradeInfo.model}` : null;
  const upgradeNotice = upgradeInfo && current && !upgradeDismissals[upgradeKey] ? {
    kind: "modelUpgrade", level: Number.isFinite(upgradeInfo.retirementAt) ? "warning" : "info",
    summary: upgradeInfo.upgradeCopy || t("A newer model is available: {model}", { model: upgradeTarget?.displayName || upgradeInfo.model }),
    details: Number.isFinite(upgradeInfo.retirementAt)
      ? t("{model} retires on {date}.", { model: savedModel.displayName || model, date: new Date(upgradeInfo.retirementAt * 1000).toLocaleDateString(getLocale(), { year: "numeric", month: "long", day: "numeric" }) }) : null,
    dismissKey: `upgrade:${upgradeKey}`,
    onDismiss: () => setUpgradeDismissals((all) => { const next = { ...all, [upgradeKey]: true }; try { globalThis.localStorage?.setItem("code-desktop.modelUpgradeDismissed", JSON.stringify(next)); } catch {} return next; }),
    actions: [
      ...(upgradeTarget ? [{ label: t("Try {model}", { model: upgradeTarget.displayName || upgradeTarget.model }), run: () => updatePreferences({ model: upgradeTarget.model, effort: upgradeTarget.defaultReasoningEffort }) }] : []),
      ...(typeof upgradeInfo.modelLink === "string" && /^https:\/\//.test(upgradeInfo.modelLink) ? [{ label: t("Learn more"), run: () => call("external", { url: upgradeInfo.modelLink }).catch(actionFailed("open-link")) }] : []),
    ],
  } : null;
  // A turn that failed on a usage limit re-reads the limits, so the backend's banner (and its fallback) appears.
  const usageFailure = current ? Object.values(state.turnErrors?.[current] ?? {}).some((error) => /usageLimitExceeded/i.test(JSON.stringify(error?.codexErrorInfo ?? error?.error?.codexErrorInfo ?? ""))) : false;
  useEffect(() => { if (usageFailure && !coreSupports(boot?.core, "perTokenBilling")) refreshPlanLimits(); }, [usageFailure, current]);
  // Opening a session on a core with goals reads its goal once (a goal set from the CLI or before a restart).
  useEffect(() => {
    if (!nativeGoals || !current || loading) return undefined;
    let live = true;
    const threadId = current;
    rpc("thread/goal/get", { threadId }).then((result) => {
      if (live && result?.goal && typeof result.goal.objective === "string") dispatch({ event: { method: "thread/goal/updated", params: { threadId, turnId: null, goal: result.goal } } });
    }, () => {});
    return () => { live = false; };
  }, [nativeGoals, current, loading]);
  // The goal strip's Pause / Resume / Clear (Codex thread/goal/set|clear); the strip follows thread/goal/updated|cleared.
  const [goalBusy, setGoalBusy] = useState(false);
  async function goalAction(patch) {
    const threadId = currentRef.current;
    if (!threadId || goalBusy) return;
    setGoalBusy(true);
    try {
      // Pause and Clear never resume the thread first: resuming a thread whose goal is active starts a goal round
      // before the pause arrives. The core changes a goal of an unloaded thread in its store (Codex state_db).
      if (patch?.status === "active") await ensureResumed(threadId);
      const result = patch ? await rpc("thread/goal/set", { threadId, ...patch }) : await rpc("thread/goal/clear", { threadId });
      applyGoalResult(threadId, patch ? "thread/goal/set" : "thread/goal/clear", result);
    } catch (error) { setError(localizeBridgeText(error.message)); }
    finally { setGoalBusy(false); }
  }
  // A goal answer for a thread that isn't loaded may come without its thread/goal/updated|cleared notification.
  function applyGoalResult(threadId, method, result) {
    if (method === "thread/goal/clear") dispatch({ event: { method: "thread/goal/cleared", params: { threadId } } });
    else if (method === "thread/goal/set" && result?.goal && typeof result.goal.objective === "string")
      dispatch({ event: { method: "thread/goal/updated", params: { threadId, turnId: null, goal: result.goal } } });
  }
  // Codex disabled a project's .codex settings until the folder is trusted (configWarning): trust it like the TUI's
  // onboarding does (main.cjs codex-trust-project), then reconnect so the core loads them.
  const [trustingProject, setTrustingProject] = useState(false);
  // A bridge core's folder trust (capabilities.workspaceTrust: Gemini, Kimi) from a session's 'until you trust the folder'
  // notice: the agent's own trust rule is written and its idle sessions restart to load the folder's files.
  const [trustedFolders, setTrustedFolders] = useState(() => new Set());
  async function trustBridgeFolder(folder) {
    try {
      await call("customize", { operation: "mcp-trust", cwd: folder });
      setTrustedFolders((all) => new Set(all).add(folder));
      toasts?.add(t("Folder trusted. {core} loads its project settings in new turns.", { core: coreName(boot?.core) }));
    } catch (error) { if (toasts) toasts.add(error.message, { variant: "warning" }); else setError(error.message); }
  }
  const canTrustProject = !!boot?.connected && coreForEngine(boot?.core?.engine).id === "codex" && !coreSupports(boot?.core, "permissionHints");
  async function trustProject() {
    if (trustingProject) return;
    setTrustingProject(true);
    try {
      await call("codex-trust-project", { cwd: workdir });
      toasts?.add(t("Folder trusted. Reconnecting to load its settings…"));
      await reconnect();
    } catch (error) { setError(error.message); }
    finally { setTrustingProject(false); }
  }
  // The account's plan (account/read) names the popover header, as on the Usage page; else the bucket's planType.
  const planUsage = useMemo(() => planLimits ? planUsageSummary(planLimits, { core: coreName(boot?.core), account: boot?.account }) : null, [planLimits, boot?.core, boot?.account]);
  // Mode menu with the Bypass opt-in off: the core's requirements decide between the 'Enable' row and a managed
  // 'Disabled by your organization' row (the opt-in itself is still validated in main on every request).
  const [bypassRequirements, setBypassRequirements] = useState(null);
  const permissionMenuToken = menu?.kind === "permission" ? menu.token : null;
  useEffect(() => {
    if (permissionMenuToken === null || boot?.config?.allowBypassPermissions === true || !boot?.connected) return;
    let live = true;
    rpc("configRequirements/read").then((value) => { if (live) setBypassRequirements(requirementsBypass(value)); }, () => { if (live) setBypassRequirements(null); });
    return () => { live = false; };
  }, [permissionMenuToken]);
  const usageMenuToken = menu?.kind === "usage" ? menu.token : null;
  useEffect(() => { if (usageMenuToken !== null) refreshPlanLimits(); }, [usageMenuToken]);
  function updateSidebarPreferences(next) {
    setSidebarPreferences(next);
    call("settings", { sidebarPreferences: next }).catch(actionFailed("save-preference"));
  }
  function applySidebarState(result) {
    if (result.revision < sidebarRevision.current) return;
    sidebarRevision.current = result.revision;
    setSessionMetadata(result.sessionMetadata);
    setCustomGroups(result.customGroups);
    if (Object.hasOwn(result, "codexPinnedSectionId")) setCodexPinnedSection(result.codexPinnedSectionId ?? null);
    setSidebarPreferences(result.sidebarPreferences);
    if (Array.isArray(result.pinnedOrder)) setPinnedOrder(result.pinnedOrder);
    if (Array.isArray(result.projectOrder)) setProjectOrder(result.projectOrder);
  }
  // automatic: a turn finishing elsewhere marks its row unread; main.cjs skips it while any window shows the session.
  async function updateSessionMetadata(id, patch, { automatic = false } = {}) {
    applySidebarState(await call("sidebar-state", { operation: "metadata", id, patch, ...(automatic ? { automatic: true } : {}) }));
  }
  // The session's own worktree before archive / delete (main worktree-status): null when it has none or another session
  // shares it; false when uncommitted changes need the 'Archive/Delete session with uncommitted changes?' confirm,
  // which repeats the action with worktreeChecked.
  async function sessionWorktree(action, target, payload) {
    if (payload.worktreeChecked) return payload.worktree ?? null;
    const status = await call("worktree-status", { threadId: target.id }).catch(() => null);
    if (!status?.worktree || status.shared) return null;
    if (status.changes > 0) { setActionDialog({ kind: "worktree-dirty", action, target, payload, status }); return false; }
    return status;
  }
  async function sessionAction(action, target, payload = {}) {
    switch (action) {
      case "rename":
        if (!await renameSession(target.id, payload.name)) throw new Error(t(ACTION_ERROR_COPY.rename));
        return;
      case "archive":
      case "unarchive": {
        if (state.active[target.id] || operationPending(state.operations?.[target.id]) || actionLock.current.has(target.id)) throw new Error(t("Stop the running task before archiving it."));
        // A session in its own worktree: confirm uncommitted changes first, then the worktree goes with it.
        const worktree = action === "archive" ? await sessionWorktree(action, target, payload) : null;
        if (worktree === false) return;
        const result = await rpc("thread/" + action, { threadId: target.id });
        if (worktree?.worktree && !worktree.shared) void call("worktree-remove", { worktree: worktree.worktree }).catch(() => {});
        if (action === "archive") resumed.current.delete(target.id);
        setSessions(list => list.map(thread => thread.id === target.id ? { ...thread, ...result.thread, archived: action === "archive" } : thread));
        // ⌘⇧⌫ (source-sidebar.jsx, shared-19 rg) opens the neighbouring row itself (keepView).
        if (action === "archive" && currentRef.current === target.id && !payload.keepView) navigate(null);
        return;
      }
      case "delete": {
        // Protocol thread/delete; main.cjs refuses running/pending sessions and
        // drops the id from every config list. Callers confirm before calling.
        if (state.active[target.id] || operationPending(state.operations?.[target.id]) || actionLock.current.has(target.id)) throw new Error(t("Stop the running task before deleting it."));
        const worktree = await sessionWorktree(action, target, payload);
        if (worktree === false) return;
        await rpc("thread/delete", { threadId: target.id });
        if (worktree?.worktree && !worktree.shared) void call("worktree-remove", { worktree: worktree.worktree }).catch(() => {});
        resumed.current.delete(target.id);
        setSessions(list => list.filter(thread => thread.id !== target.id));
        setSessionMetadata(value => { const next = { ...value }; delete next[target.id]; return next; });
        setPinnedOrder(order => order.filter(id => id !== target.id));
        if (currentRef.current === target.id) navigate(null);
        clearStashedDraft(target.id);
        return;
      }
      case "fork": {
        // Sidebar Fork (official onFork): same session-operations lock as the
        // composer /fork, but for the row's thread instead of the open one.
        const unsupported = unsupportedCommand("fork", commandContext);
        if (unsupported) throw new Error(unsupported);
        if (actionLock.current.has(target.id)) throw new Error(t("A session action is already starting."));
        const expected = { connectionId: state.approvalConnectionId, connectionEpoch: state.approvalConnectionEpoch };
        actionLock.current.add(target.id);
        try {
          const result = await call("session-action", { operation: "fork", threadId: target.id, permission: bypassMode.forSession(target.id, target.cwd), afterPlan: afterPlan.current, mode, expected,
            ...(typeof payload.lastTurnId === "string" && payload.lastTurnId ? { lastTurnId: payload.lastTurnId } : {}) });
          const fork = result.thread;
          recordForkPoint(target.id, fork.id, typeof payload.lastTurnId === "string" ? payload.lastTurnId : null);
          setSessionMetadata(value => ({ ...value, [fork.id]: result.sessionMetadata }));
          setSessions(value => [fork, ...value.filter(thread => thread.id !== fork.id)]);
          // Forking the open session (⌥⌘O, its row's Fork, Fork from here) opens the fork, as /fork does, so the next
          // message goes to the fork and not the original; a fork of another row stays in the sidebar. Not when the
          // user has moved on or the connection changed while it ran.
          if (currentRef.current === target.id && expected.connectionId === stopLive.current.connectionId && stopLive.current.connected) {
            navigate(fork.id);
            setAdditionalFolders(result.sessionMetadata?.additionalFolders || []);
          }
          if (result.warning) setError(result.warning);
          return result;
        } finally { actionLock.current.delete(target.id); }
      }
      case "open-terminal": return call("open-terminal", { cwd: target.cwd });
      case "pinned-order": return applySidebarState(await call("sidebar-state", { operation: "pinned-order", ids: payload.ids }));
      case "reveal-folder": return call("reveal-folder", { cwd: target.cwd });
      case "open-in-editor": return call("open-in-editor", { path: target.cwd, type: payload?.type });
      case "pin": return updateSessionMetadata(target.id, { pinned: true });
      case "unpin": return updateSessionMetadata(target.id, { pinned: false });
      case "mark-read": return updateSessionMetadata(target.id, { unread: false });
      case "mark-unread": return updateSessionMetadata(target.id, { unread: true });
      case "move-to-group": return updateSessionMetadata(target.id, { customGroupId: payload.groupId });
      case "keep-awake": return updateSessionMetadata(target.id, { keepAwake: payload?.value === true });
      // A core's own share page (capabilities.threadShare: OpenCode /share): public once shared, so it asks first.
      case "share": {
        if (!payload?.confirmed) { setActionDialog({ kind: "share", target }); return; }
        const result = await rpc("codeDesktop/thread/share", { threadId: target.id, enabled: true });
        setSessions((list) => list.map((thread) => thread.id === target.id ? { ...thread, codeDesktop: { ...thread.codeDesktop, shareUrl: result?.shareUrl ?? null } } : thread));
        if (result?.shareUrl) copyWithToast(result.shareUrl, t("Share link copied to clipboard."));
        return result;
      }
      case "copy-share-link": return target.codeDesktop?.shareUrl ? copyWithToast(target.codeDesktop.shareUrl, t("Share link copied to clipboard.")) : undefined;
      case "unshare": {
        await rpc("codeDesktop/thread/share", { threadId: target.id, enabled: false });
        setSessions((list) => list.map((thread) => thread.id === target.id ? { ...thread, codeDesktop: { ...thread.codeDesktop, shareUrl: null } } : thread));
        toasts?.add(t("This conversation is no longer shared."));
        return;
      }
      // The row's Export (sidebar-session-items.js:467-473): /export's transcript for that session, open or not.
      case "export": {
        const full = await readFullHistory(target.id);
        if (full.truncated || full.unavailable) throw new Error(t("Conversation history is incomplete. Export was not saved."));
        return call("slash-export", { threadId: target.id, markdown: transcriptMarkdown(shownThread(full.thread), shownTurns(full.turns)) });
      }
      default: throw new Error(t("Unsupported session action."));
    }
  }
  async function createGroup(name, sessionId, sessionIds) {
    applySidebarState(await call("sidebar-state", { operation: "create-group", name, sessionId, sessionIds }));
  }
  async function groupAction(action, group, payload = {}) {
    // F08 header menus: the persisted section order (jB Move up / Move down / Sort A to Z) and Mz's
    // "New session" in a custom group (prefilled folder; the started session is filed into the group).
    if (action === "project-order") return applySidebarState(await call("sidebar-state", { operation: "project-order", ids: payload.ids }));
    if (action === "new-session") {
      if (payload.cwd) setCwd(payload.cwd);
      navigate(null);
      newSessionGroup.current = group.customGroupId;
      return;
    }
    applySidebarState(await call("sidebar-state", { operation: action + "-group", id: group.customGroupId, name: payload.name }));
  }
  // A generated title replaces the first-message name only while the session still has that name (the Codex TUI keeps a
  // name the user gave meanwhile). Best effort: no title, no change.
  async function requestThreadTitle(id, placeholder, text, titleCwd) {
    try {
      const result = await rpc("codeDesktop/threadTitle", { threadId: id, text, ...(titleCwd ? { cwd: titleCwd } : {}) });
      const title = typeof result?.title === "string" ? result.title.trim() : "";
      if (!title || title === placeholder || knownThread(id)?.name !== placeholder) return;
      await rpc("thread/name/set", { threadId: id, name: title });
      setSessions((list) => list.map((thread) => thread.id === id && thread.name === placeholder ? { ...thread, name: title } : thread));
    } catch (error) { console.warn(error); }
  }
  async function renameSession(id, name) {
    try {
      await rpc("thread/name/set", { threadId: id, name });
      setSessions(list => list.map(thread => thread.id === id ? { ...thread, name } : thread));
      return true;
    } catch (error) { setError(error.message); return false; }
  }
  async function stop() {
    const live = stopLive.current, threadId = currentRef.current;
    if (!live.connected || threadId !== current || !live.active[threadId]) return;
    const request = stopRequests.current.begin({ threadId, turnId: live.active[threadId],
      connectionId: live.connectionId, connectionEpoch: live.connectionEpoch });
    if (!request) return;
    try {
      await call("interrupt", {
        threadId: request.threadId,
        turnId: request.turnId,
        expected: { connectionId: request.connectionId, connectionEpoch: request.connectionEpoch },
        // Stop pauses the session's working goal too (the strip then offers Resume), so the core doesn't start
        // another goal round after the next message.
        ...(nativeGoals && state.goals?.[request.threadId]?.status === "active" ? { pauseGoal: true } : {}),
      });
    } catch (e) {
      const owned = stopRequests.current.fail(request);
      if (owned && currentRef.current === request.threadId && stopRequestMatches(request, stopLive.current))
        setError(e.message);
    } finally {
      stopRequests.current.reconcile(stopLive.current);
    }
  }
  function applyConfirmedPreferences(saved) {
    setBoot(value => ({...value, config:saved}));
    setLocalPreferences(appearancePreferences(saved));
    setSpeed(savedSpeed(saved));
    const ownModel = !!currentRef.current && sessionModel.current?.id === currentRef.current;
    for (const key of ["theme","model","effort","mode","displayName","permission"]) {
      const setters = {theme:setTheme,model:setModel,effort:setEffort,mode:setMode,displayName:setDisplayName,permission:setPermission};
      if (ownModel && (key === "model" || key === "effort")) continue;
      if (saved[key] !== undefined && (key !== "model" || saved[key])) setters[key](saved[key]);
    }
  }
  // A model (and its effort) picked in the composer: the open session's own (sessionMetadata), or on Home the default.
  function chooseModel(choice) {
    const id = currentRef.current;
    if (!id) return updatePreferences(choice);
    const next = { id, model: choice.model ?? sessionModel.current?.model ?? model, effort: choice.effort ?? sessionModel.current?.effort ?? effort };
    sessionModel.current = next;
    if (choice.model) setModel(choice.model);
    if (choice.effort) setEffort(choice.effort);
    const levels = models.find((entry) => entry.model === next.model)?.supportedReasoningEfforts || [];
    const saved = next.effort ? durableEffort(next.effort, levels, workflowState.enabled) : null;
    if (next.effort && saved !== next.effort) sessionUltracode.current.set(id, next.effort); else sessionUltracode.current.delete(id);
    return updateSessionMetadata(id, { model: next.model, ...(saved ? { effort: saved } : {}) });
  }
  // Entering a session: its own model and effort when the catalog lists it; leaving to Home: the saved default.
  function applySessionModel(id, reported = null) {
    if (!id) {
      if (sessionModel.current) {
        sessionModel.current = null;
        const saved = boot?.config;
        if (saved?.model && models.some((entry) => entry.model === saved.model)) setModel(saved.model);
        if (saved?.effort) setEffort(saved.effort);
      }
      return;
    }
    const own = sessionMetadata[id] ?? {};
    const pick = typeof own.model === "string" && own.model ? { model: own.model, effort: own.effort ?? null }
      : typeof reported?.model === "string" && reported.model ? { model: reported.model, effort: reported.reasoningEffort ?? null } : null;
    const listed = pick && models.find((entry) => entry.model === pick.model);
    if (!listed) { if (sessionModel.current) applySessionModel(null); return; }
    // Ultracode is a level of an xhigh model while workflows are on (model-menu-model.mjs withUltracodeLevel), and
    // lasts this app run only: a session picked it in now gets it back; a saved or core-reported top tier (an older
    // build's metadata, Codex's thread effort) reopens one level under it (durableEffort).
    const levels = listed.supportedReasoningEfforts || [];
    const running = sessionUltracode.current.get(id);
    if (running) pick.effort = running;
    else if (pick.effort) pick.effort = durableEffort(pick.effort, levels, workflowState.enabled);
    const supports = (value) => !!value && withUltracodeLevel(levels, workflowState.enabled).some((item) => item.reasoningEffort === value);
    const carried = supports(effort) ? (running || !isUltracodeTier(effort) || !workflowState.enabled ? effort : durableEffort(effort, levels, true)) : null;
    const nextEffort = supports(pick.effort) ? pick.effort : carried || listed.defaultReasoningEffort || effort;
    sessionModel.current = { id, model: listed.model, effort: nextEffort };
    setModel(listed.model);
    if (nextEffort) setEffort(nextEffort);
  }
  function updatePreferences(patch) {
    if (Object.hasOwn(patch, "permission")) bypassMode.clear();
    return saveConfirmedPreferences({ revision: preferenceRevision, patch, call, apply: applyConfirmedPreferences });
  }
  function preference(key, value) {
    // Existing direct controls (notably the effort slider) must respond to each
    // keystroke immediately. A late save failure restores confirmed disk state.
    const setters = {theme:setTheme,model:setModel,effort:setEffort,mode:setMode,displayName:setDisplayName,permission:setPermission};
    setters[key]?.(value);
    return updatePreferences({[key]:value}).catch(error => { setError(error.message); });
  }
  // The title-bar Chat / Code switch. Chat runs every turn read-only (permission-policy.mjs), so switching into it says so
  // once in a toast, instead of tasks silently 'finishing' without edits.
  function switchMode(next) {
    if (next === mode) return;
    preference("mode", next);
    if (next === "chat") {
      const message = t("Chat mode is read-only: {assistant} can answer and read files, but can’t edit files or run commands. Switch back to Code to make changes.", { assistant: getAssistantName() });
      if (toasts) toasts.add(message, { variant: "neutral" }); else setError(message);
    }
  }
  // An approved DeepSeek plan review leaves Plan, as the source plan card's
  // accept changes the mode (approval-current.js Rse → onModeChange). The core
  // already continues the turn that way; the next turn must not go out as Plan.
  // R07: the plan card names its target (codeDesktop.afterPlan: Accept → Manual, the
  // primary → the mode used before Plan), as Rse's accept passes targetMode.
  async function respondApproval(request, payload) {
    const outcome = await call("respond", payload);
    const next = approvedPlanPermission(request, payload, afterPlan.current);
    // 'Accept and bypass permissions' was the user's explicit choice on the card (main validated it): adopt it
    // without the Mode menu's confirmation, as the source plan card's accept sets bypassPermissions directly.
    if (outcome?.ok === true && coreSupports(boot?.core, "permissionHints") && effectivePermission === "plan" && next)
      bypassMode.adopt(next);
    return outcome;
  }
  // Plan → implement handoff on a core without permission hints (Codex and native packs): after a Plan turn that
  // produced a plan item the core waits, as Codex's own client asks "Implement this plan?" (approval-card-model
  // planHandoff). Implement leaves Plan for the mode chosen on the card (the one used before Plan, or Manual) and
  // sends Codex's implementation message as a turn in it; the collaboration mode goes back to default with it
  // (turnPermissionParams). Stay in Plan only puts the card away for that turn.
  const handoff = current && boot?.connected && !loading && !session?.archived ? planHandoff({
    items, hints: coreSupports(boot?.core, "permissionHints"), permission: effectivePermission, mode, running,
    waiting: approvals.length > 0 || sending || actionPending || turnRequested === current || (queue.threadId === current && queue.entries.length > 0),
    turnErrors: state.turnErrors?.[current], answered: planHandoffAnswered[current] }) : null;
  const answerPlanHandoff = (threadId, turnId) => setPlanHandoffAnswered((value) => ({ ...value, [threadId]: turnId }));
  async function implementPlan(target) {
    const id = current, plan = handoff;
    if (!id || !plan || planHandoffBusy) return;
    const next = planImplementationTurn(target ?? afterPlan.current, { bypass: bypassMode.available });
    const turnCwd = workdir || cwd;
    setPlanHandoffBusy(true);
    setError("");
    try {
      await ensureResumed(id);
      setTurnRequested(id);
      await rpc("turn/start", { threadId: id, input: [{ type: "text", text: next.text, text_elements: [] }], ...turnOptions(turnCwd, next.permission) });
      answerPlanHandoff(id, plan.turnId);
      // The turn went out in that mode; the Mode picker follows (a failed start keeps Plan and the card).
      bypassMode.adopt(next.permission);
    } catch (e) {
      setTurnRequested((value) => value === id ? null : value);
      setError(e.message);
    } finally {
      setPlanHandoffBusy(false);
    }
  }
  async function changeFastMode(value) {
    if (fastSaving) return;
    setFastSaving(true);
    try { await updatePreferences({model, fastMode:value}); }
    finally { setFastSaving(false); }
  }
  // A speed by key ('standard', 'fast', 'ultrafast'…): the model menu's Speed rows and /fast <speed>.
  async function changeSpeed(value) {
    if (fastSaving) return;
    setFastSaving(true);
    try { await updatePreferences({model, speed:value}); }
    finally { setFastSaving(false); }
  }
  // Cmd+Alt+F: on/off with one faster tier; with several, Standard → each tier in catalog order → Standard.
  const nextSpeed = () => {
    if (speedTiers.length <= 1) return fastEnabled ? STANDARD_SPEED : (fastTier?.key ?? STANDARD_SPEED);
    const order = [STANDARD_SPEED, ...speedTiers.map(tier => tier.key)];
    return order[(order.indexOf(activeTier?.key ?? STANDARD_SPEED) + 1) % order.length];
  };
  // First-run setup opens by itself once: on the DeepSeek core with no key at all (no DeepSeek key and no custom
  // provider key), unless it was finished or put off before (config.onboarded).
  const onboardingOffered = useRef(false);
  // The running core's sign-in options (core descriptor `login`, e.g. Codex: ChatGPT, device code, API key).
  const signInCore = boot?.connected ? coreForEngine(boot.core?.engine) : null;
  // Setup's Sign in step only for a core whose login offers something to do (Qwen Code's is empty: its provider is
  // configured in its own settings file, so setup finishes instead of showing a card with only 'Skip for now').
  const signInOptions = (login) => ["browser", "deviceCode", "apiKey"].some((kind) => Array.isArray(login?.[kind]) && login[kind].length > 0);
  // The card's browser sign-in (a native core's first browser option, e.g. Codex "Continue with ChatGPT").
  const signInBrowser = signInCore?.login?.browser?.[0] || null;
  // A Codex custom endpoint (Settings › Models) needs no sign-in: account/read says requiresOpenaiAuth false.
  const signedIn = !!boot?.account?.account || usesCustomEndpoint(boot?.account, boot?.core);
  // Home's sign-in card and the composer warning, for the running core (no card while setup's Sign in step is open).
  const signInPrompt = boot?.connected && onboarding !== "signin" ? coreSignInPrompt(boot.account, boot.core) : null;
  // The composer's warning and the send gate: a core whose account/read says a sign-in is required.
  const signInRequired = !!signInPrompt && boot.account?.requiresOpenaiAuth === true;
  // Home card's Sign in, the composer warning's Sign in and the send gate: a native core's browser sign-in starts here,
  // a bridge core's (one of several providers) is chosen in Settings › Preferences › Account.
  function startCoreSignIn() {
    if (signInPrompt?.action === "login") {
      call("login", { type: signInBrowser?.type || "chatgpt", ...(signInBrowser?.provider ? { codeDesktop: { provider: signInBrowser.provider } } : {}) }).catch((e) => setError(e.message));
      return;
    }
    setSettings("preferences#account");
  }
  useEffect(() => {
    if (side !== 0 || onboardingOffered.current || !boot?.connected || !boot.config || boot.config.onboarded === true) return;
    // A core other than DeepSeek Harness chosen during setup (the window reloaded onto it): its Sign in step, or done.
    if (boot.config.core && boot.config.core !== "deepseek" && signInOptions(signInCore?.login)) {
      onboardingOffered.current = true;
      if (signedIn) updatePreferences({ onboarded: true }).catch(() => {});
      else setOnboarding("signin");
      return;
    }
    if (!boot.account?.deepseek || boot.account.account) return;
    onboardingOffered.current = true;
    setOnboarding("welcome");
  }, [boot?.connected, boot?.config, boot?.account, signInCore?.id]);
  // The Sign in step ends when the core reports an account.
  useEffect(() => {
    if (onboarding !== "signin" || !signedIn) return;
    const timer = setTimeout(() => { setOnboarding(null); updatePreferences({ onboarded: true }).catch(e => setError(e.message)); }, 600);
    return () => clearTimeout(timer);
  }, [onboarding, signedIn]);
  // Saved connection → restart the core so it reads the new key, then make the chosen model the default.
  // Connect a model sets up DeepSeek Harness, so finishing it runs that core: a core an earlier pick in Choose your
  // agent left selected (selected before its start failed) gives way to it.
  async function finishOnboarding({ model: chosen, route }) {
    const reselect = typeof boot?.config?.core === "string" && boot.config.core !== "deepseek";
    if (reselect) await call("cores", { op: "select", id: "deepseek" });
    const b = await reconnect();
    if (!b?.connected) throw new Error(t("The connection was saved, but the core didn’t start. Check Settings › Models."));
    const list = b.models || [];
    const pick = list.find(entry => entry.model === chosen)
      || list.find(entry => entry.provider === route && (entry.model === `${route}/${chosen}` || entry.model.endsWith(`/${chosen}`) || entry.model.endsWith(`:${chosen}`)));
    await updatePreferences({ onboarded: true, ...(pick ? { model: pick.model, effort: pick.defaultReasoningEffort || effort } : {}) });
    setOnboarding(null);
    // The copy named the core it left ("Message Codex"): reload for DeepSeek's.
    if (reselect && coreAssistant("deepseek") !== getAssistantName()) setTimeout(() => location.reload(), 150);
  }
  // Setup › Choose your agent picked a core other than DeepSeek Harness (core-manager.cjs installed it if needed):
  // choose it, restart the connection on it, and finish setup.
  async function chooseOnboardingCore(id) {
    // The copy names the new core's assistant: switchCore reloads (setup continues at Sign in after the reload).
    const { b, reload } = await switchCore(id, { requireConnected: true });
    if (!b?.connected) throw new Error(t("The core didn’t start. Check Settings › Cores."));
    if (reload) return;
    if (signInOptions(coreForEngine(b.core?.engine).login) && !b.account?.account && !usesCustomEndpoint(b.account, b.core)) { setOnboarding("signin"); return; }
    await updatePreferences({ onboarded: true });
    setOnboarding(null);
  }
  // Choosing a core (Settings › Cores, Setup): select it, restart the connection on it and, when the assistant name
  // changes ("Message Codex"), reload for the new copy. An active Bypass rides along to the new connection only
  // (main.cjs bypassCarry, one shot), for the scope it was confirmed in (this folder and session, as the Bypass scope
  // key holds them); the reloaded page applies it, so this page doesn't consume it first.
  async function switchCore(id, { requireConnected = false } = {}) {
    const carry = bypassMode.permission === "bypass" ? { carryBypass: true, carryCwd: cwd || "", carrySession: current || null } : null;
    const next = await call("cores", { op: "select", id, ...carry });
    const reload = coreAssistant(next?.selected ?? id) !== getAssistantName();
    coreSwitchReload.current = reload;
    const b = await reconnect(carry || undefined);
    if (reload && (b?.connected || !requireConnected)) setTimeout(() => location.reload(), 150);
    else coreSwitchReload.current = false;
    return { next, b, reload: coreSwitchReload.current };
  }
  function skipOnboarding() {
    setOnboarding(null);
    updatePreferences({ onboarded: true }).catch(e => setError(e.message));
  }
  // options {carryBypass, carryCwd, carrySession}: only switchCore asks main to carry Bypass to the new connection; a plain Reconnect revokes it.
  async function reconnect(options) {
    const navigation = loadSeq.current;
    const target = currentRef.current;
    setLoading(true);
    resumed.current.clear();
    try {
      const b = await call("reconnect", options?.carryBypass === true ? { carryBypass: true, carryCwd: options.carryCwd, carrySession: options.carrySession } : undefined);
      if (b.approvalSnapshot)
        dispatch({ event: { ...b.approvalSnapshot, kind: "approval-snapshot" } });
      for (const notice of Array.isArray(b.connectionNotices) ? b.connectionNotices : []) dispatch({ event: notice });
      registerCores(b.extensionCores); // imported Extension Pack cores (extension-packs.cjs)
      setBoot(b);
      // Main reconciled and saved config.model/effort/fastMode against this core's catalog on connect
      // (per-core memory), so it comes first: after a core switch or a Settings › Models Restart the
      // remembered model returns. The model in use and the catalog default are the fallbacks.
      const saved = b.models?.find(item => item.model === b.config?.model);
      const selected = saved || b.models?.find(item => item.model === modelRef.current)
        || b.models?.find(item => item.isDefault) || b.models?.[0];
      const supports = value => selected?.supportedReasoningEfforts?.some(item => item.reasoningEffort === value);
      setModel(selected?.model || "");
      setEffort(value => saved && supports(b.config?.effort) ? b.config.effort : supports(value) ? value : selected?.defaultReasoningEffort || "medium");
      if (b.config) setSpeed(savedSpeed(b.config));
      setError(b.warnings?.join("\n") || "");
      // A launch without Codex never read the session list; the first
      // successful reconnect does, so the home can leave its placeholder.
      // A reconnect that lands on another core (Settings › Cores, a fallback after a removal) reads the list again:
      // the sidebar holds that core's sessions, and a session of the core it left goes back to Home instead of reopening.
      const coreChanged = b.connected && sessionsLoadedRef.current && sessionsCoreRef.current !== coreEngine(b.core);
      const listed = b.connected && (!sessionsLoadedRef.current || coreChanged) ? await loadSessions(b) : null;
      const stillListed = !coreChanged || !!listed?.active.some((thread) => thread.id === target) || !!listed?.archived.some((row) => row.id === target);
      if (navigation === loadSeq.current && target === currentRef.current && target) await openSession(stillListed ? target : null);
      return b;
    } catch (e) {
      setError(e.message);
    } finally {
      if (navigation === loadSeq.current) setLoading(false);
    }
  }
  // Each open carries a token so a re-targeted menu (right-click while another
  // menu is open) mounts a fresh popup instead of updating the live one.
  const menuToken = useRef(0);
  const openMenu = (kind, anchor, data, entry) => {
    setMenu((m) =>
      m?.kind === kind && m.anchor === anchor && entry === undefined ? null : { kind, anchor, data, entry, token: ++menuToken.current },
    );
  };
  const closeMenu = () => setMenu(null);
  // Composer folder picker (recent-folders-model.mjs): recents from the session list, the chosen folder
  // prepended, minus the dismissals main.cjs persists (dismiss-recent-folder → config.dismissedRecentFolders).
  const dismissedRecentFolders = boot?.config?.dismissedRecentFolders;
  const recentFolderList = useMemo(() => {
    const list = recentFolders({ sessions, current: workdir, dismissedAt: dismissedRecentFolders });
    return { rows: recentFolderRows(list, workdir), browseDirectly: folderPickerBrowsesDirectly(list) };
  }, [sessions, workdir, dismissedRecentFolders]);
  const dismissRecentFolder = (dir) => {
    const withDismissed = (dismissed) => setBoot((b) => (b ? { ...b, config: { ...b.config, dismissedRecentFolders: dismissed } } : b));
    withDismissed({ ...(dismissedRecentFolders || {}), [dir]: Date.now() });
    call("dismiss-recent-folder", { path: dir }).then(withDismissed).catch(actionFailed("dismiss-recent"));
  };
  // Branch picker order (cc43287c9 :12062-12071): the default branch first, the rest by localeCompare.
  const branchChoices = useMemo(() => {
    const branches = workspaceInfo?.branches || [];
    return sortBranches(branches, defaultBranch({ originHead: workspaceInfo?.originHead, branches }));
  }, [workspaceInfo]);
  // Add → "Add files or photos": the dialog returns stat facts; images are
  // referenced by path (preview from the file), other files become mentions.
  attachRef.current = () => attach();
  const attach = () =>
    call("attachments")
      .then((files) => {
        if (!files?.length) return;
        setAttachments((entries) => {
          const staged = stageFiles(entries, files, { imagesAllowed });
          if (staged.notices.length) setError(staged.notices.join("\n"));
          let next = staged.entries;
          for (const entry of staged.added) if (entry.kind === "image") next = markReady(next, entry.id, { previewUrl: filePreviewUrl(entry.path) });
          return next;
        });
      })
      .catch((e) => setError(e.message));
  // Skill chips: selecting a skill (Add menu, a plugin's skill row or Settings › Skills "Use in message") replaces
  // any skill chip in the draft and puts the picked one plus a space at its start (c099c328d-CbkcmYSW.js:7926-7940
  // B → wv), not an attachment pill; that leading chip becomes the {type:"skill"} input on submit (composerInput).
  // Focus follows once Settings has let go of the window.
  const applySkill = useCallback((item) => {
    const name = item.skillName || item.name || item.label;
    const row = customizeStore.getSnapshot().skills.skills.find((skill) => skill.path === item.path);
    textarea.current?.insertSkill?.({ id: name, description: item.description || row?.description || "", argumentHint: item.argumentHint || "" });
    setSettings(false);
    requestAnimationFrame(() => textarea.current?.focus());
  }, []);
  const addSkills = useMemo(() => ({
    loading: customizeSnapshot.skills.status === "loading",
    items: skillMenuItems(offeredSkills.filter((row) => !row.pluginId)),
  }), [customizeSnapshot.skills]);
  const addPlugins = useMemo(() => ({
    loading: customizeSnapshot.plugins.status === "loading" || customizeSnapshot.skills.status === "loading",
    groups: pluginMenuGroups(customizeSnapshot.plugins.rows, customizeSnapshot.skills.skills),
  }), [customizeSnapshot.plugins, customizeSnapshot.skills]);
  // Settings › Customize props: `call` is module-level, so these stay stable
  // across App re-renders. An unstable `call` would re-run PluginsPage's
  // plugin/read effect (and reset its detail) on every streamed token.
  const customizeCall = useCallback((payload) => call("customize", payload), []);
  const customizeOpenExternal = useCallback((url) => call("external", { url }), []);
  const customizeReveal = useCallback((target) => call("reveal-item", { path: target }).catch(actionFailed("reveal-file")), []);
  const toolSelection = boot?.core?.capabilities?.toolSelection === true;
  useEffect(() => {
    if (menu?.kind !== "add" || !toolSelection) return;
    let live = true;
    call("tools-list").then(result => { if (live) setToolsCatalog(result); }, () => {});
    return () => { live = false; };
  }, [menu?.kind, toolSelection]);
  // The tools the open session (or the New draft) turns off, and switching them: a session's set is saved by
  // main (config.threadTools) and reaches the core with its next message.
  const toolProfiles = normalizeProfiles(boot?.config?.toolProfiles);
  const sessionTools = current ? normalizeSelection(boot?.config?.threadTools?.[current])
    : draftTools !== undefined ? draftTools : defaultProfile(boot?.config)?.tools ?? null;
  function setSessionTools(next) {
    if (!current) { setDraftTools(normalizeSelection(next)); return; }
    const threadId = current;
    call("thread-tools", { threadId, tools: next }).then(saved => setBoot(value => {
      if (!value?.config) return value;
      const threadTools = { ...value.config.threadTools };
      if (saved) threadTools[threadId] = saved; else delete threadTools[threadId];
      return { ...value, config: { ...value.config, threadTools } };
    })).catch(e => setError(e.message));
  }
  function applyToolProfile(profile) {
    setSessionTools(profile?.tools ?? null);
    if (profile?.model && models.some(m => m.model === profile.model)) preference("model", profile.model);
    if (profile?.permission) bypassMode.select(profile.permission);
  }
  useEffect(() => {
    if (menu?.kind !== "add") return;
    customizeStore.loadSkills({ cwd: workdir || cwd });
    customizeStore.loadPlugins({ cwd: workdir || cwd });
    if (boot?.connected) customizeStore.loadMcp({ cwd: workdir || cwd, threadId: current ?? null });
    // A native core's connector on/off states, for the Connectors submenu's switches.
    if (boot?.connected && customizeCore(boot?.core).connectorSettings) customizeStore.loadMcpConfig({ cwd: workdir || cwd });
  }, [menu?.kind, workdir, cwd]);
  // The '/' list needs the skills too: a draft that starts with '/' loads them (cached per cwd by the store).
  const slashDraft = draft.startsWith("/");
  useEffect(() => {
    if (slashDraft && boot?.connected) customizeStore.loadSkills({ cwd: workdir || cwd });
  }, [slashDraft, boot?.connected, workdir, cwd]);
  // Customize › Plugins "Restart DeepSeek": the Reconnect path restarts the core, which loads the saved plugin changes.
  const reconnectRef = useRef(null);
  reconnectRef.current = reconnect;
  const customize = useMemo(() => ({ store: customizeStore, threadId: current, cwd: workdir || cwd, call: customizeCall,
    onUseSkill: applySkill, onOpenExternal: customizeOpenExternal, onRevealPath: customizeReveal, onRestartCore: () => reconnectRef.current?.() }),
    [current, workdir, cwd, customizeCall, applySkill, customizeOpenExternal, customizeReveal]);
  // shared-21 IO (sidebar-rows.js:8597-8613): the tV header identity + org line and the pw footer
  // `identity · orgPrimary` (account-label-model.mjs); no invented user without a preferred name.
  // boot.core outlives a disconnect (a crash, a reconnect in progress); before the first connect, the chosen core.
  const accountLines = accountIdentity(displayName, boot?.account, boot?.core || boot?.config?.core || undefined);
  const accountLabel = accountLines.orgPrimary ?? "";
  // shared-2 commitSidebarWidth (qm clamp): the handle calls this once per
  // drag end / key press, so each commit is exactly one settings write; the
  // live drag only moves --df-sidebar-width on the root.
  const saveWidth = (w) => {
    const next = clampSidebarWidth(w);
    setSidebarWidth(next);
    call("settings", { sidebarWidth: next }).catch(() => {});
  };
  // shared-2 dframe-store persists collapsed beside sidebarWidth: one settings
  // write per actual change, which also relabels View > Hide/Show Sidebar.
  const setSidebarCollapsed = (next) => {
    if (collapsedRef.current === next) return;
    collapsedRef.current = next;
    clearTimeout(peekTimer.current);
    setPeek((previous) => ({ ...previous, hovering: false, peeked: false }));
    setCollapsed(next);
    call("settings", { sidebarCollapsed: next }).catch(() => {});
  };
  // F08 collapsed hover peek. shared-19 Nh: a mouse pointerenter on the 'Show sidebar' trigger, the peek
  // bridge or the card opens it (setHovering: hovering + peeked); leaving starts the 180ms Ah grace, which
  // waits while a menu is open or a text field in the card has focus. Mh: a navigation closes it and,
  // when focus was in the card, returns focus to the trigger; Escape (Nb) closes it and focuses the trigger.
  // The card sits 8px under the trigger (desktop-layout.css:1388-1396 top calc(100% + 8px)) and 6px from
  // the toolbar's start edge.
  const peekTimer = useRef(null), peekState = useRef(peek);
  peekState.current = peek;
  const peekTrigger = () => document.querySelector('.df-collapsed-chrome button[aria-controls="frame-peek-popover"]');
  const peekGeometry = (trigger) => {
    const root = trigger?.closest(".dframe-root"), toolbar = trigger?.closest(".workspace-toolbar");
    if (!trigger || !root) return null;
    const rect = trigger.getBoundingClientRect(), base = root.getBoundingClientRect(), start = (toolbar ?? root).getBoundingClientRect();
    return { top: Math.round(rect.bottom - base.top + 8), left: Math.round(start.left - base.left + 6), bridge: Math.round(rect.bottom - base.top) };
  };
  // The frame is collapsed by the stored preference or by the narrow viewport (shared-2 Dg).
  const frameCollapsed = () => collapsedRef.current || narrowRef.current;
  const peekEnter = (event) => {
    if (event.pointerType !== "mouse" || !frameCollapsed()) return;
    clearTimeout(peekTimer.current); peekTimer.current = null;
    const trigger = event.currentTarget instanceof Element && event.currentTarget.matches('[aria-controls="frame-peek-popover"]') ? event.currentTarget : null;
    const geometry = peekGeometry(trigger);
    setPeek((previous) => previous.hovering && !geometry ? previous : { ...previous, hovering: true, peeked: true, ...geometry });
  };
  // shared-2 toggleCollapsed while Dg (narrow): {hovering: true, peeked: true} placed under the trigger.
  const openPeek = () => {
    clearTimeout(peekTimer.current); peekTimer.current = null;
    const geometry = peekGeometry(peekTrigger());
    setPeek((previous) => ({ ...previous, hovering: true, peeked: true, ...geometry }));
  };
  const peekLeave = (event) => {
    if (event.pointerType !== "mouse") return;
    clearTimeout(peekTimer.current);
    const settle = () => {
      const active = document.activeElement;
      const typing = active instanceof HTMLElement && (active.matches("input, textarea") || active.isContentEditable)
        && !!document.getElementById("frame-peek-popover")?.contains(active);
      if (document.querySelector('[role="menu"]') || typing) { peekTimer.current = setTimeout(settle, 180); return; }
      peekTimer.current = null;
      setPeek((previous) => previous.hovering ? { ...previous, hovering: false } : previous);
    };
    peekTimer.current = setTimeout(settle, 180);
  };
  const closePeek = ({ focusTrigger = false } = {}) => {
    if (!frameCollapsed() || !peekState.current.hovering) return false;
    clearTimeout(peekTimer.current); peekTimer.current = null;
    const active = document.activeElement;
    if (focusTrigger || (document.getElementById("frame-peek-popover")?.contains(active) && !active?.matches?.("input, textarea"))) peekTrigger()?.focus();
    setPeek((previous) => ({ ...previous, hovering: false }));
    return true;
  };
  useEffect(() => () => clearTimeout(peekTimer.current), []);
  // shared-2 setIsNarrowViewport resets the peek (wg) on entering the narrow viewport; leaving it docks
  // or collapses from the stored preference with the card closed.
  useEffect(() => {
    clearTimeout(peekTimer.current); peekTimer.current = null;
    setPeek((previous) => previous.hovering || previous.peeked ? { ...previous, hovering: false, peeked: false } : previous);
  }, [narrowViewport]);
  // shared-2 toggleCollapsed: while narrow (Dg) it opens or closes the peek card instead of the stored
  // preference. Used by ⌘B, View > Show/Hide Sidebar and the 'Show sidebar' trigger (Nb onClick Tb(r)).
  const toggleNarrowPeek = () => { if (peekState.current.hovering) closePeek(); else openPeek(); };
  const expandSidebar = () => { if (narrowRef.current) toggleNarrowPeek(); else setSidebarCollapsed(false); };
  // ⌘B and the View menu share one toggle; it is inert under Settings, action
  // dialogs, inline rename and What's New (their own key handling owns focus).
  toggleSidebarRef.current = () => {
    if (settings || actionDialog || rename || whatsNew) return;
    if (narrowRef.current) { toggleNarrowPeek(); return; }
    setSidebarCollapsed(!collapsedRef.current);
  };
  // ⌘⇧D / ⌘⇧F: the Changes toggle (cl) and the view menu's Files row exist only
  // for an open session in the chat section (SourceTitlebar `session &&
  // section === "new"`); Files also needs a workspace folder.
  paneShortcutRef.current = (kind) => {
    if (settings || actionDialog || rename || whatsNew || !session || section !== "new") return;
    // ⌘⇧Y toggleDiffFileList (pane-shortcuts.mjs fileListRoute; c936fcd42 ei/$r,
    // code-workspace.js:2230-2241): the focused (or only) Files pane's tree
    // (fileTreeToggleRef), else the open Changes pane's file list (diffTreeToggleRef,
    // registered while the column can show), else Changes opens with the list shown.
    if (kind === "file-list") {
      const route = fileListRoute({ filesOpen: openPanes.has("files") && !!fileTreeToggleRef.current, changesOpen: openPanes.has("changes"),
        focused: focusedPaneKind(), changesCanShow: !!diffTreeToggleRef.current });
      if (route === "files") fileTreeToggleRef.current?.();
      else if (route === "changes") diffTreeToggleRef.current?.();
      else if (route === "open-changes") { openPaneTile("changes"); if (!tileStore.getState().diffShowTree) tileStore.setGlobal({ diffShowTree: true }); }
      return;
    }
    if (kind === "files" && !workdir) return;
    if (kind === "preview" && !previewAvailable) return;
    togglePaneTile(kind);
  };
  // Official ce4f4374c "Transcript view" submenu (c360a9e1c Dm rows): radio
  // items, Thinking only when the session has reasoning, and a separated
  // "Make {mode} the default" row when the session's view differs from the
  // default. No nudge toast or analytics: neither has a Codex counterpart.
  function transcriptViewSubmenu(sessionId) {
    if (!sessionId) return null;
    const rows = transcriptViewMenu({ sessionView: sessionViews[sessionId], defaultView: prefs.transcriptView,
      hasThinking: sessionHasThinking(state.items[sessionId] || []) });
    return <SourceMenu.Submenu>
      <SourceMenu.SubmenuTrigger label={t("Transcript view")}>{t("Transcript view")}</SourceMenu.SubmenuTrigger>
      <SourceMenu.Popup label={t("Transcript view")}>
        <SourceMenu.Group>
          {rows.items.map(row => <SourceMenu.Item key={row.view} checked={row.checked} checkedRole="radio" data-transcript-view={row.view}
            onClick={() => { if (row.view !== rows.current) setSessionView(sessionId, row.view); }}>{row.label}</SourceMenu.Item>)}
        </SourceMenu.Group>
        {rows.makeDefault && <>
          <SourceMenu.Separator />
          <SourceMenu.Item data-transcript-view-default={rows.makeDefault.view}
            onClick={() => { updatePreferences({ transcriptView: rows.makeDefault.view }).catch(actionFailed("save-preference")); }}>{rows.makeDefault.label}</SourceMenu.Item>
        </>}
      </SourceMenu.Popup>
    </SourceMenu.Submenu>;
  }

  const menuContent = () => {
    switch (menu.kind) {
      case "local":
        // cc43287c9-BMbiZYzF.js:20975-21060 env pill menu (Z.Popup side top, align start, !min-w-[200px]):
        // the Local row is a checked radio (VV); environment settings stay a plain row.
        return (
          <>
            <SourceMenu.Item checked checkedRole="radio">{t("Local")}</SourceMenu.Item>
            <SourceMenu.Separator />
            {/* The local environment's settings (Worktree location, Sandbox mode, Sandbox network access) live on
                Code › Local sessions: open there, anchored on Worktree location, as /sandbox opens code#sandbox. */}
            <SourceMenu.Item onClick={() => setSettings("code#worktreeLocation")}>{t("Environment settings")}</SourceMenu.Item>
          </>
        );
      case "home-folder":
        // lH (cc43287c9 :21638-21850) + dH frecents (:21921-21928): recents by last use with the chosen
        // folder prepended; dismissing persists a dismissedAt per path (main.cjs dismiss-recent-folder).
        return <SourceRecentFolderMenu rows={recentFolderList.rows} onSelect={setCwd} onDismiss={dismissRecentFolder} onBrowse={folder} />;
      case "folder":
        // c360a9e1c-GPs-MV9u.js:6760-6830 Fp → Gt.Popup side bottom / align start, and :6555-6588 Ep: a Group
        // with GroupLabel 'Working directory' over the shared repo items (Ko/qo → gitRepoMenuItems).
        return (
          <SourceMenu.Group>
            <SourceMenu.GroupLabel>{t("Working directory")}</SourceMenu.GroupLabel>
            {gitRepoMenuItems({ openFolder: true, copyPath: true, openTerminal: true }).map((item) => <React.Fragment key={item.label}>
              {item.separatorBefore && <SourceMenu.Separator />}
              <SourceMenu.Item onClick={() => item.label === "Copy path" || item.label === t("Copy path")
                ? copyWithToast(workdir, t("Path copied to clipboard."))
                : item.label === "Open in terminal" ? openTerminalIn(workdir).catch(e => setError(e.message))
                : call("reveal-folder", { cwd: workdir }).catch(e => setError(e.message))}>{t(item.label)}</SourceMenu.Item>
            </React.Fragment>)}
          </SourceMenu.Group>
        );
      case "branch":
        // hT step 1: a searchable radio list; choosing a branch never touches the worktree checkbox. Step 2 (he/me):
        // with worktree off a different branch checks the working tree (selectBranch).
        return <SourceBranchPickerMenu branches={branchChoices} current={workspaceInfo?.branch || ""}
          onSelect={(branch) => { selectBranch(branch); }} />;
      case "add":
        // Official composer Add menu (c752b32f8 yr over CDS Menu; c099c328d :8052-8330 em = [Qp 'Add files or
        // photos', ...Kp: 'Add folder' (icon Folder), ...Hp: 'Slash commands', connectors, plugins], no separators;
        // 'Import GitHub/Linear issue' need integrations absent here): file/folder
        // rows, then the Skills submenu (scroll-shared-10 jy: icon Scroll, skill
        // rows sorted by label, footer = separator + "Manage skills") and the
        // Plugins submenu (Bv/zv: one submenu per enabled plugin holding its
        // skills, footer "Manage plugins"). "Browse skills/plugins" open the
        // claude.ai Directory and have no Codex counterpart, so they are absent.
        return (
          <>
            <SourceMenu.Item icon="Attachment" shortcut="cmd+u" onClick={attach}>{t("Add files or photos")}</SourceMenu.Item>
            <SourceMenu.Item icon="Folder" onClick={folder}>{t("Add folder")}</SourceMenu.Item>
            <SourceMenu.Item icon="SlashShortcutCommand" onClick={() => { setDraft(d=>d.startsWith('/')?d:'/'+d); textarea.current?.focus(); textarea.current?.dispatchEvent(new Event('open-slash')); }}>{t("Slash commands")}</SourceMenu.Item>
            {/* Local: per-session tools (harness tool-gate.js), only with a core that can turn them off. */}
            {toolSelection && (
              <SourceMenu.Submenu>
                <SourceMenu.SubmenuTrigger icon="Tool" data-testid="add-tools">{t("Tools")}</SourceMenu.SubmenuTrigger>
                <SourceMenu.Popup label={t("Tools")} className="add-tools-popup">
                  <SourceToolsMenu catalog={toolsCatalog} selection={sessionTools} profiles={toolProfiles}
                    onToggle={(name, options) => setSessionTools(toggleInSelection(sessionTools, name, options))}
                    onProfile={applyToolProfile} onManage={() => setSettings("profiles")} />
                </SourceMenu.Popup>
              </SourceMenu.Submenu>
            )}
            {/* jy (:9309-9338) returns null when it has no skill rows: there is
                no "loading"/"empty" row in the Skills submenu, the entry is
                simply absent until skills/list answers. */}
            {addSkills.items.length > 0 && (
              <SourceMenu.Submenu>
                <SourceMenu.SubmenuTrigger icon="Scroll" data-testid="add-skills">{t("Skills")}</SourceMenu.SubmenuTrigger>
                <SourceMenu.Popup label={t("Skills")} className="add-skills-popup">
                  {addSkills.items.map((item) => <SourceMenu.SkillItem key={item.path} item={item} onSelect={applySkill} />)}
                  <SourceMenu.Separator />
                  <SourceMenu.Item icon="Tool" onClick={() => setSettings("customize-skills")}>{t("Manage skills")}</SourceMenu.Item>
                </SourceMenu.Popup>
              </SourceMenu.Submenu>
            )}
            {/* Bv (:8881-8925): {type:"loading"} is the c752b32f8 Q skeleton
                row (h-control, 20x20 + 96x16, no text). The official empty
                state is an "Add plugins" button that opens the claude.ai
                Directory; Codex has no such install path, so — like Bv's
                arePluginsAvailable === false branch — nothing is drawn. */}
            {/* gi/_i/vi (tmp-c752b32f8 :2065-2200): Connectors, one row per MCP server with its status (a server that
                needs sign-in leads to its page in Customize › Connectors), a skeleton while the list loads, then
                Add connector and Manage connectors. */}
            {boot?.connected && (customizeSnapshot.mcp?.status === "loading" && !customizeSnapshot.mcp?.rows?.length
              ? <div className="smenu-skeleton-row" data-add-loading="connectors">
                  <span className="smenu-skeleton" style={{ width: 20, height: 20 }} />
                  <span aria-hidden="true" className="smenu-skeleton" style={{ width: 96, height: 16 }} />
                </div>
              : <SourceMenu.Submenu>
                  <SourceMenu.SubmenuTrigger icon="Connectors" data-testid="add-connectors">{t("Connectors")}</SourceMenu.SubmenuTrigger>
                  <SourceMenu.Popup label={t("Connectors")} className="add-connectors-popup">
                    {(customizeSnapshot.mcp?.rows || []).map((row) => {
                      // A connector the core's config can turn on or off (native Codex, customize mcp-enable): a switch row
                      // that stays open; one that needs a sign-in still leads to its page.
                      const setting = customizeSnapshot.mcpConfig?.status === "ready" ? customizeSnapshot.mcpConfig.servers?.[row.name]
                        : customizeCore(boot?.core).connectorToggle ? { enabled: row.kind !== "disabled", editable: true } : null;
                      if (setting?.editable && row.kind !== "signIn") return <SourceMenu.Item key={row.id} data-connector={row.name} keepOpen role="menuitemcheckbox"
                        aria-checked={setting.enabled !== false} hint={setting.enabled === false ? t("Off") : MCP_STATUS_LABELS[row.kind] || undefined}
                        trailing={<SourceSwitch decorative checked={setting.enabled !== false} />}
                        onClick={() => { customizeStore.setMcpEnabled(row.name, setting.enabled === false).catch((e) => { if (toasts) toasts.add(e.message, { variant: "warning" }); else setError(e.message); }); }}>{row.title || row.name}</SourceMenu.Item>;
                      return <SourceMenu.Item key={row.id} data-connector={row.name} hint={MCP_STATUS_LABELS[row.kind] || undefined}
                        onClick={() => { setSettings("customize-connectors"); }}>{row.title || row.name}</SourceMenu.Item>;
                    })}
                    {(customizeSnapshot.mcp?.rows || []).length > 0 && <SourceMenu.Separator />}
                    <SourceMenu.Item icon="Add" onClick={() => setSettings("customize-connectors")}>{t("Add connector")}</SourceMenu.Item>
                    <SourceMenu.Item icon="Tool" onClick={() => setSettings("customize-connectors")}>{t("Manage connectors")}</SourceMenu.Item>
                  </SourceMenu.Popup>
                </SourceMenu.Submenu>)}
            {addPlugins.loading
              ? <div className="smenu-skeleton-row" data-add-loading="">
                  <span className="smenu-skeleton" style={{ width: 20, height: 20 }} />
                  <span aria-hidden="true" className="smenu-skeleton" style={{ width: 96, height: 16 }} />
                </div>
              : addPlugins.groups.length > 0 && (
                <SourceMenu.Submenu>
                  <SourceMenu.SubmenuTrigger icon="Plugin" data-testid="add-plugins">{t("Plugins")}</SourceMenu.SubmenuTrigger>
                  <SourceMenu.Popup label={t("Plugins")} className="add-plugins-popup">
                    {addPlugins.groups.map((group) => (
                      <SourceMenu.Submenu key={group.id}>
                        <SourceMenu.SubmenuTrigger icon="Plugin" data-plugin-id={group.id}>{group.label}</SourceMenu.SubmenuTrigger>
                        <SourceMenu.Popup label={group.label} className="add-plugin-skills-popup">
                          {group.items.map((item) => <SourceMenu.SkillItem key={item.path} item={item} onSelect={applySkill} />)}
                        </SourceMenu.Popup>
                      </SourceMenu.Submenu>
                    ))}
                    <SourceMenu.Separator />
                    <SourceMenu.Item icon="Tool" onClick={() => setSettings("customize-plugins")}>{t("Manage plugins")}</SourceMenu.Item>
                  </SourceMenu.Popup>
                </SourceMenu.Submenu>
              )}
          </>
        );
      case "titlebar":
        return <>
          {/* panes-toggle-current.js:3236-3253: only Files carries a shortcut (F("toggleBrowser") = aR cmd+shift+f). */}
          {/* usePaneViewItems (panes-toggle-current.js:3215-3290): the titlebar toggles a cramped titlebar folded away
              (_s, in titlebar order), then Files, Background tasks, Plan. */}
          {[...(menu.anchor?.closest?.(".st-trailing")?.hasAttribute("data-cramped") ? [
              ...(previewAvailable?[{kind:"preview",label:"Preview",icon:"Play",shortcut:"cmd+shift+p"}]:[]),
              // The built-in terminal (⌘J, as View › Show Terminal; ⌃` toggles it too).
              ...(terminalAvailable?[{kind:"terminal",label:"Terminal",icon:"CommandLinePrompt",shortcut:"cmd+j"}]:[])] : []),
            {kind: "files", label: "Files", icon: "Folder", shortcut: "cmd+shift+f"},
            ...((tasks.length||openPanes.has("tasks"))?[{kind:"tasks",label:"Background tasks",icon:"AgentsSimple"}]:[]),
            ...((state.plans[current]?.length || state.planDocs?.[current] || openPanes.has("plan")) ? [{kind: "plan", label: "Plan", icon: "Checklist"}] : [])]
            .map(item => <SourceMenu.Item key={item.kind} className="st-view-item" icon={item.icon} checked={openPanes.has(item.kind)} shortcut={item.shortcut}
              onClick={() => (item.kind === "terminal" ? toggleTerminalPane() : togglePaneTile(item.kind))}>{t(item.label)}</SourceMenu.Item>)}
          <SourceMenu.Separator />
          {transcriptViewSubmenu(menu.data?.id)}
          <SourceMenu.Separator />
          {sessionCommands.filter(command => ["compact","fork","review","status"].includes(command.id)).map(command => {
            const reason = commandUnavailable(command, commandContext);
            return <SourceMenu.Item key={command.id} icon={command.icon} disabled={!!reason} disabledReason={reason || undefined}
              onClick={() => executeCommand(command.id)}>{command.label}</SourceMenu.Item>;
          })}
          <SourceMenu.Separator />
          <SourceSidebarSessionMenu session={menu.data} metadata={sessionMetadata[menu.data.id]} customGroups={customGroups} state={state} editors={editors} shareable={sessionsShareable} windowActions={windowActions}
            onAction={(...args) => sessionAction(...args).catch(actionFailed(sessionActionErrorKind(args[0])))} onClose={closeMenu}
            onDelete={() => setConfirmDelete(menu.data)}
            onRename={() => setRename({ id: menu.data.id, name: menu.data.name || menu.data.preview || "" })} />
        </>;
      case "session":
        return <>
          {transcriptViewSubmenu(menu.data?.id)}
          <SourceMenu.Separator />
          <SourceSidebarSessionMenu session={menu.data} metadata={sessionMetadata[menu.data.id]} customGroups={customGroups} state={state} editors={editors} shareable={sessionsShareable} windowActions={windowActions}
            onAction={(...args) => sessionAction(...args).catch(actionFailed(sessionActionErrorKind(args[0])))} onClose={closeMenu}
            onDelete={() => setConfirmDelete(menu.data)}
            onRename={() => setRename({ id: menu.data.id, name: menu.data.name || menu.data.preview || "" })} />
        </>;
      case "account":
        // sidebar-rows.js:16155-16432 $B (J.Popup side top, pw's w-[17rem]): tV Header (IO identity, then
        // "org · secondary" only when there is an org line), Settings, Usage (uV), then the Language and
        // Inference configuration slots (:16222-16241), here (no appearance item: that is Settings › Theme)
        // on the DeepSeek core the key row (Settings › Preferences › DeepSeek account). After the
        // separator: View changelog (Scroll, :16345-16354) reopens the What's new notes, and Learn more
        // (Info, min-w-[208px], :16356-16432) ends with Keyboard shortcuts ⌘/ (:16424-16431). Its
        // About / Usage policy / Privacy / Terms links are omitted: this project holds no DeepSeek URL
        // for them; Learn more adds the running core's project page (descriptor homepage) instead. Log out
        // (:16434-16440, after a separator) is Sign out here, offered exactly when Settings › Preferences
        // offers it (accountMenuSignOut: the core reports a signed-in account of its own), with the same
        // confirmed two-step logout.
        return (
          <>
            <SourceMenu.Header className="account-menu-header">
              <span className="smenu-header-line" data-testid="user-menu-header">{accountLines.identity}</span>
              {accountLines.orgPrimary && <span className="smenu-header-line smenu-header-secondary" data-testid="user-menu-header-org">{accountOrgLine(accountLines)}</span>}
            </SourceMenu.Header>
            <SourceMenu.Item icon="Settings" shortcut="cmd+," data-testid="user-menu-settings" onClick={() => setSettings(true)}>{t("Settings")}</SourceMenu.Item>
            {/* sidebar-rows.js:16769-16793 uV (claudified_usage_page_pace treatment): Usage, right after Settings,
                opens the nav-hidden Usage section in the stacked Settings dialog (fidelity F14). */}
            <SourceMenu.Item icon="UsageGaugeMiddle" data-testid="user-menu-usage" onClick={() => setSettings("usage")}>{t("Usage")}</SourceMenu.Item>
            {/* shared-21 $B :16218-16227: Language (Globe, user-menu-language) opens "Choose your language". */}
            <SourceMenu.Item icon="Globe" data-testid="user-menu-language" onClick={() => setLanguagePicker(true)}>{t("Language")}</SourceMenu.Item>
            {boot?.account?.deepseek && <SourceMenu.Item icon="Key" data-testid="user-menu-deepseek-key" onClick={() => setSettings("preferences")}>{t("DeepSeek API key")}</SourceMenu.Item>}
            <SourceMenu.Separator />
            <SourceMenu.Item icon="Scroll" onClick={() => setWhatsNew(true)}>{t("View changelog")}</SourceMenu.Item>
            <SourceMenu.Submenu>
              <SourceMenu.SubmenuTrigger icon="Info">{t("Learn more")}</SourceMenu.SubmenuTrigger>
              <SourceMenu.Popup label={t("Learn more")} className="account-learn-more">
                {/* shared-21-D098Wd--.js:16424-16431: J.Item {shortcut: Mn("shortcuts_modal").shortcutString} → ⌘/, no icon. */}
                <SourceMenu.Item shortcut={SHORTCUTS_DIALOG_KEYS} onClick={()=>setActionDialog({kind:"shortcuts"})}>{t("Keyboard shortcuts")}</SourceMenu.Item>
                {boot?.connected && /^https:\/\//.test(coreForEngine(boot?.core?.engine).homepage || "") && <SourceMenu.Item data-testid="user-menu-core-homepage"
                  onClick={() => call("external", { url: coreForEngine(boot.core?.engine).homepage }).catch(actionFailed("open-link"))}>
                  {t("{core} project page", { core: coreName(boot.core) })}</SourceMenu.Item>}
              </SourceMenu.Popup>
            </SourceMenu.Submenu>
            {accountMenuSignOut(boot?.account, { engine: boot?.core, connected: boot?.connected }) && <>
              <SourceMenu.Separator />
              <SourceMenu.Item icon="Logout" data-testid="user-menu-sign-out" onClick={() => setActionDialog({ kind: "sign-out" })}>{t("Sign out")}</SourceMenu.Item>
            </>}
          </>
        );
      case "connection":
        // Sidebar footer connection settings (local): a Header naming the running core and its state, then Items.
        return (
          <>
            <SourceMenu.Header>{connectionMenuHeader(engine, !!boot?.connected)}</SourceMenu.Header>
            <SourceMenu.Item icon="ArrowClockwise" onClick={reconnect}>{t("Reconnect")}</SourceMenu.Item>
            <SourceMenu.Item icon="Settings" onClick={() => setSettings(true)}>{t("Settings")}</SourceMenu.Item>
          </>
        );
      default:
        return null;
    }
  };
  // Transcript right-click menus (source-transcript.jsx; transcript-context-menu-model.mjs): message text by row id,
  // attach only while this session's composer can take it, file references through the Files pane, the session-scoped
  // reveal IPC and the c3e58cab4 'Copied to clipboard.' path copies; links open through the external opener.
  const composerAttachable = section === "new" && !session?.archived;
  sessionChordRef.current = (command) => {
    const row = current ? (sessions.find((thread) => thread.id === current) ?? session) : null;
    if (!row) return;
    const fail = actionFailed(command === "fork-session" ? "fork" : "session-action");
    if (command === "pin-session") void updateSessionMetadata(row.id, { pinned: !row.pinned }).catch(fail);
    else if (command === "rename-session") setRename({ id: row.id, name: row.name || row.preview || "" });
    else if (command === "archive-session") void sessionAction("archive", row).catch(actionFailed("archive"));
    else if (command === "unread-session") void updateSessionMetadata(row.id, { unread: !row.unread }).catch(fail);
    else if (command === "fork-session") void sessionAction("fork", row).catch(actionFailed("fork"));
  };
  // A session's row or titlebar menu: Open in split view / Close split view / Open in new window (official lE/uE, cE).
  const windowActions = {
    splitItem: (id) => sessionSplitItem(splitView, id),
    onOpenSplit: (row) => splitStore.open(row.id),
    onCloseSplit: (index) => splitStore.close(index),
    // ⌃⌘W (View › Split View › Close Split View) closes the focused side: its row carries the chord.
    closeSplitShortcut: (index) => (splitView.open && splitView.active === index ? "ctrl+cmd+w" : undefined),
    onOpenWindow: (row) => {
      call("window-open", { sessionId: row.id }).catch((e) => { const message = cleanErrorReason(e?.message || "") || t("Couldn’t open a new window."); if (toasts) toasts.add(message, { variant: "danger" }); else setError(message); });
    },
  };
  // A clicked web link from a reply or the terminal (preview-links-model.mjs webLinkRoute): a plain click on a page on
  // this computer opens in this session's Preview pane, anything else in the default browser. Stable for the
  // WebLinkContext consumers; the ref reads this render's session.
  const webLinkRef = useRef(null);
  // "Open links in preview" is the profile's preference (config.previewLinks): every window and side reads it.
  const savedPreviewLinks = boot?.config?.previewLinks;
  const savePreviewLinksRef = useRef(null);
  savePreviewLinksRef.current = (value) => updatePreferences({ previewLinks: value });
  useEffect(() => {
    if (!boot?.config) return;
    previewLinksStore.connect(typeof savedPreviewLinks === "boolean" ? savedPreviewLinks : undefined, (value) => savePreviewLinksRef.current(value));
  }, [savedPreviewLinks, !!boot?.config]);
  webLinkRef.current = (url, event) => {
    if (webLinkRoute(url, event, { previewAvailable, enabled: previewLinksStore.getSnapshot() }) === "preview") {
      openPaneTile("preview", current);
      call("preview-navigate", { sessionId: current, url }).catch(actionFailed("open-link"));
      return;
    }
    call("external", { url }).catch(actionFailed("open-link"));
  };
  const openWebLink = useCallback((url, event) => webLinkRef.current?.(url, event), []);
  const transcriptActions = {
    cwd: workdir || cwd,
    resolveMessage: (itemId) => messageItemText(shownUserItem(items.find((item) => item.id === itemId))),
    onAttachText: composerAttachable ? (text) => attachQuoteToDraft(text, "transcript") : null,
    onAttachFile: composerAttachable ? attachFilePath : null,
    onOpenFile: openFileRef,
    onRevealFile: current ? (absolute) => call("reveal-tool-file", { sessionId: current, path: absolute }).catch(actionFailed("reveal-file")) : null,
    onCopyPath: (text) => { if (text) copyWithToast(text, t("Copied to clipboard.")); },
    onOpenLink: (href) => { call("external", { url: href }).catch(actionFailed("open-link")); },
    // Open in Browser pane (a link to a page on this computer): this session's Preview pane opens on it.
    onOpenInPreview: previewAvailable ? (href) => { openPaneTile("preview", current); call("preview-navigate", { sessionId: current, url: href }).catch(actionFailed("open-link")); } : null,
    // Rewind to here / Fork from here (transcript-context-menu-model.mjs): only for a finished turn of an idle, live
    // session whose core serves the request.
    resolveTurn: (itemId) => {
      const row = items.find((item) => item.id === itemId);
      if (!row?.turnId || row.turnId === state.active[current]) return null;
      return { turnId: row.turnId, user: row.type === "userMessage" };
    },
    onRewindTo: current && !running && !session?.archived && boot?.connected && !unsupportedMethods?.includes("thread/revert")
      ? (turnId) => { rewindPreselect.current = turnId; void executeCommand("rewind", "", undefined); } : null,
    // capabilities.forkAtTurn false (MiniMax): the core forks only whole conversations, so no 'Fork from here'.
    onForkFrom: current && !running && !session?.archived && boot?.connected && !unsupportedMethods?.includes("thread/fork") && boot?.core?.capabilities?.forkAtTurn !== false
      ? (turnId) => void sessionAction("fork", session ?? { id: current }, { lastTurnId: turnId }).catch(actionFailed("fork")) : null,
  };
  // Files pane tree-row and tab menus (file-context-menu-model.mjs, Mn): Attach as context through the same
  // path attachment as the Changes header and the transcript, Show in Finder through the session-scoped reveal IPC.
  const filePaneActions = { onAttachFile: transcriptActions.onAttachFile, onRevealFile: transcriptActions.onRevealFile,
    editors, onOpenInEditor: editors.length ? openInEditor : null,
    // A folder row's "Open in terminal": a tab in this side's terminal pane, in that folder.
    onOpenInTerminal: terminalAvailable ? (dir) => void openTerminalIn(dir).catch((e) => setError(terminalError(e, t("Failed to open terminal tab")))) : null };
  // A run the model's Workflow call launched is that call's row (2.2553.1 J6); /workflow runs follow their anchor.
  const toolRuns = withWorkflowToolRuns(items, workflows);
  const shownRows =groupFileTools(withLocalCommandRows(withModelWorkflowRows(toolRuns.items),[...(localCommandRows[current]||[]),...toolRuns.rows]),transcriptView);
  shownRowCount.current = { id: current, count: shownRows.length };
  // approval-entry-current.js:4211-4233: xu (load failure) and Cl ("No messages
  // yet") replace the whole transcript scroller, so no status row is drawn with them.
  const emptyPane = current && !loading && shownRows.length === 0 && !pendingSends[current]?.length
    ? (loadError?.id === current ? "failure"
      // Cl: not running, no failure (P: session error) and not starting
      // (T.starting; locally the first send in flight).
      : !running && !sending && turnRequested !== current && !state.errors[current] && approvals.length === 0 ? "empty" : null)
    : null;
  const trafficLightSpacer = trafficLightSpacerWidth(zoomFactor);
  return (
    <div
      className={
        // R01: collapsed by the stored preference or the narrow viewport (sidebar-main.js:15367-15372).
        "desktop-app dframe-root " + (effectiveCollapsed ? "sidebar-collapsed" : "") + (side === 1 ? " split-secondary" : "")
      }
      data-variant="web"
      data-frame-mode={mode}
      data-fullscreen={fullScreen || undefined}
      // sidebar-main.js:15304-15320 dR mirrors the peek store onto the root (F08).
      data-hovering={effectiveCollapsed && peek.hovering || undefined}
      data-peeked={effectiveCollapsed && peek.peeked || undefined}
      // sidebar-main.js:15391-15392 with shared-2 Qg: max(sidebarWidth,
      // sidebarFloor), and _v's zoom-aware traffic-light spacer.
      style={{ "--df-sidebar-width": effectiveSidebarWidth(sidebarWidth, sidebarFloor) + "px", "--df-traffic-light-spacer": trafficLightSpacer + "px",
        "--df-peek-top": peek.top + "px", "--df-peek-left": peek.left + "px", "--df-peek-bridge-top": (peek.bridge ?? peek.top - 8) + "px" }}
    >
      {side === 0 && <SourceSidebar
        windowActions={windowActions}
        repoIdentities={repoIdentities}
        editors={editors}
        shareable={sessionsShareable}
        onStartSession={startSessionFromSearch}
        projectOrder={projectOrder}
        peekOpen={effectiveCollapsed && peek.hovering}
        onPeekEnter={peekEnter}
        onPeekLeave={peekLeave}
        sessions={sessions}
        sidebarPreferences={sidebarPreferences}
        onSidebarPreferencesChange={updateSidebarPreferences}
        sessionMetadata={shownSessionMetadata}
        customGroups={customGroups}
        pinnedOrder={pinnedOrder}
        knownFolders={groups.map(([dir]) => dir)}
        fallbackCwd={cwd}
        loading={!boot}
        onSessionAction={sessionAction}
        engine={boot?.core || engine}
        hiddenSessions={hiddenSessions}
        // 'N sessions could not be loaded': read them again, or drop the ones that still fail from the list.
        onRetryHidden={boot?.connected ? () => loadSessions(boot).catch((error) => setError(error.message)) : undefined}
        onForgetHidden={boot?.connected ? async () => {
          try {
            const { removed = [] } = await call("forget-sessions", { threadIds: hiddenSessions?.missingIds ?? [] }) ?? {};
            if (removed.length) setHiddenSessions((value) => value ? { ...value, missing: Math.max(0, value.missing - removed.length), missingIds: (value.missingIds ?? []).filter((id) => !removed.includes(id)) } : value);
            setBoot((value) => value?.config ? { ...value, config: { ...value.config, threadIds: (value.config.threadIds || []).filter((id) => !removed.includes(id)) } } : value);
          } catch (error) { setError(error.message); }
        } : undefined}
        forkUnavailable={unsupportedCommand("fork", commandContext) || undefined}
        onCreateGroup={createGroup}
        onGroupAction={groupAction}
        collapsed={effectiveCollapsed}
        onCollapse={() => setSidebarCollapsed(!collapsedRef.current)}
        onCollapsedChange={setSidebarCollapsed}
        historyAt={historyAt}
        historyLength={history.length}
        travel={travel}
        mode={mode}
        onMode={switchMode}
        onNew={() => openInFocusedSide(null)}
        groups={groups}
        current={splitView.open ? splitView.sides[splitView.active].current : current}
        state={state}
        onOpen={openInFocusedSide}
        onProject={(dir) => {
          setCwd(dir);
          navigate(null);
        }}
        onMenu={openMenu}
        onAccount={(e, entry) => openMenu("account", e.currentTarget, undefined, entry)}
        accountMenuOpen={menu?.kind === "account"}
        connectionMenuOpen={menu?.kind === "connection"}
        displayName={accountLines.identity}
        accountLabel={accountLabel}
        search={search}
        setSearch={setSearch}
        searchMatches={searchMatches?.query === search.trim() ? searchMatches.ids : null}
        showSearch={showSearch}
        setShowSearch={setShowSearch}
        deepSearch={!!boot?.connected && coreSupports(boot?.core, "threadSearch")}
        onOpenSettings={(section) => { setMenu(null); setSettings(section); }}
        connectionIssue={!!boot && !boot.connected}
        onFolder={folder}
        sidebarWidth={sidebarWidth}
        setSidebarWidth={saveWidth}
        sidebarFloor={sidebarFloor}
        onSidebarFloor={setSidebarFloor}
        fullScreen={fullScreen}
        trafficLightSpacer={trafficLightSpacer}
        cdsFont={cdsFont}
        section={section}
        // Customize opens its real pages (Settings › Customize: Skills, Connectors, Plugins), not an empty surface.
        setSection={(key) => { if (key === "customize") { setMenu(null); setSettings("customize-skills"); } else setSection(key); }}
      />}
      <SourceSplitHost side={side} chrome={effectiveCollapsed ? <SourceCollapsedChrome onExpand={expandSidebar} peekOpen={peek.hovering}
        onPeekEnter={peekEnter} onPeekLeave={peekLeave} historyAt={historyAt} historyLength={history.length} travel={travel} /> : null}>
      <main
        ref={mainRef}
        className="workspace epitaxy-root cds-root"
        data-density={themeDensity(boot?.config)}
        data-font={cdsFont}
        data-platform="desktop"
      >
        <WebLinkContext.Provider value={openWebLink}>
        <SourceTileLayout layout={displayLayout} onLayoutChange={changeTileLayout} tiles={tileDefs} hasPane={hasPane} onTileTearOff={tearOffTile} restoreKey={tileOwner} onRestoreLayout={restoreTileLayout}
          renderTile={(tileId, tileApi) => tileId === "preview" ? (
            current ? <SourcePreviewPane key={current} sessionId={current} desktop={api} headerCenter={tileApi.dragHandle} onError={setError} onClose={() => closePaneTile("preview")}
              onAttachScreenshot={(file) => stageComposerFiles([file], { imagesOnly: true })}
              // Settings › Code › Preview › 'Let {assistant} use the preview' off: the agent has no preview tools, so the pane
              // neither promises them nor asks the agent to call them.
              agentUsesPreview={boot?.config?.agentPreview !== false}
              onAskAgent={boot?.connected && !session?.archived && boot?.config?.agentPreview !== false ? (text) => { void sendFixedTurn(text); } : null}
              controls={<SourcePaneControls tileId="preview" paneName={PANE_NAMES.preview} layout={baseTileLayout(tileEntry)} expanded={expandedTile === "preview"}
                onMoveToEdge={edge => moveTileEdge("preview", edge)} onToggleExpand={() => toggleExpandTile("preview")} onClose={() => closePaneTile("preview")} />} /> : null
          ) : tileId === "terminal" ? (
            <SourceTerminalPane sessionId={current ?? null} homeWorkspace={current ? null : workdir} cwd={workdir} focusRequest={terminalFocus || null}
              headerCenter={tileApi.dragHandle} onOpenFile={openFileRef} onOpenExternal={openWebLink}
              onClosePane={() => closePaneTile("terminal", current ?? HOME_TILE_KEY)}
              onAttachSelection={attachTerminalOutput}
              controls={<SourcePaneControls tileId="terminal" paneName={PANE_NAMES.terminal} layout={baseTileLayout(tileEntry)} expanded={expandedTile === "terminal"}
                onMoveToEdge={edge => moveTileEdge("terminal", edge)} onToggleExpand={() => toggleExpandTile("terminal")} onClose={() => closePaneTile("terminal")} />} />
          ) : tileId === "tasks" ? (
            <SourceTasksPane transcriptView={transcriptView} state={state} sessionId={current} views={tileEntry?.taskViews || []} background={<SourceBackgroundTasks key={current} tasks={tasks} sessionId={current} renderWorkflow={task=><WorkflowCard run={task.run} warningLimits={workflowWarningLimits} onStop={()=>stopBackgroundTask(task)} onMember={isModelWorkflow(task.run)?(agent,action)=>rpc('codeDesktop/workflow/member',{threadId:current,runId:task.run.runId??task.run.id,attemptId:task.run.attemptId,seq:Number(agent.id),action}).then(r=>{if(r?.accepted===false)throw Error(t('This agent can’t be retried or skipped right now.'));}):(agent,action)=>call('workflow-member',{id:task.run.id,memberId:agent.id,action})}
              onPause={isModelWorkflow(task.run)?(task.run.pauseControls===true?paused=>rpc('codeDesktop/workflow/pause',{threadId:current,runId:task.run.runId??task.run.id,paused}):undefined):paused=>call('workflow-pause',{id:task.run.id,paused})}
              onResume={isModelWorkflow(task.run)&&task.run.resumable===true?()=>rpc('codeDesktop/workflow/resume',{threadId:current,runId:task.run.runId??task.run.id}):undefined}
              onArtifact={isModelWorkflow(task.run)&&boot?.core?.capabilities?.workflowArtifacts===true?artifact=>rpc('codeDesktop/workflow/artifact',{threadId:current,runId:task.run.runId??task.run.id,artifactId:artifact.id,version:artifact.version}):undefined}
              renderMarkdown={text=><SourceMarkdown text={text} cwd={workdir} onOpenFileRef={openFileRef}/>} onOpenFile={openFileRef}
              onSettings={isModelWorkflow(task.run)&&boot?.core?.capabilities?.workflowRunSettings===true?settings=>rpc('codeDesktop/workflow/settings',{threadId:current,runId:task.run.runId??task.run.id,...settings}):undefined} models={models}
              onSave={isModelWorkflow(task.run)?undefined:options=>call('workflow-save',{id:task.run.id,...options})}/>} onOpen={openAgent} onStop={stopBackgroundTask} focusTask={taskFocus} onFocusDone={()=>setTaskFocus(null)} error={state.background?.[current]?.error} finishedExpanded={tileEntry?.finishedExpanded||false} onFinishedExpanded={value=>changeTileView({finishedExpanded:value})}/>} onOpen={openAgent} onLoad={loadAgent}
              canMessage={id=>!!boot?.connected&&state.threads?.[id]?.canAcceptDirectInput===true&&!!state.threads?.[id]?.parentThreadId}
              onMessage={(id,text)=>rpc('turn/start',{threadId:id,input:[{type:'text',text,text_elements:[]}]}).catch(error=>{throw new Error(subAgentMessageError(error));})}
              onBack={() => changeTileView({taskViews:(tileEntry?.taskViews || []).slice(0,-1)})} onClose={() => closePaneTile("tasks")}
              headerCenter={tileApi.dragHandle} controls={<SourcePaneControls tileId="tasks" paneName={PANE_NAMES.tasks} layout={baseTileLayout(tileEntry)} expanded={expandedTile === "tasks"}
                onMoveToEdge={edge => moveTileEdge("tasks",edge)} onToggleExpand={() => toggleExpandTile("tasks")} onClose={() => closePaneTile("tasks")} />}
              renderItem={(childItem,childId,placement) => <Message item={childItem} agentNested agentContext={{state,onOpen:openAgent}} sessionKey={childId} reasoningPlacement={placement}
                isStreaming={isItemStreaming(state,childId,childItem)} cwd={state.threads[childId]?.cwd || workdir}
                onOpenFileRef={openFileRef} transcriptView={transcriptView} pendingApprovalItemIds={pendingApprovalItems} />} />
          ) : tileId !== CHAT_TILE_ID ? (
            <FilePanel
              cwd={workdir}
              sessionId={current ?? null}
              searchPane="main"
              tab={tileId}
              plan={state.plans[current]}
              planDocument={state.planDocs?.[current] ?? null}
              diff={gitStatus?.isRepo ? gitDiff : sessionDiff}
              diffScope={diffScope.param}
              diffScopeControl={tileId === "changes" ? diffScope.control : null}
              loading={tileId === "changes" && !!current && !gitStatusError && (gitStatus === null || gitStatus.isRepo && gitDiff === null)}
              diffError={gitStatusError || gitDiffError}
              onClose={() => closePaneTile(tileId)}
              onRefresh={refreshChanges}
              openRequest={tileId === "files" ? fileRequest : null}
              onOpenRequestHandled={consumeFileRequest}
              diffFileActions={tileId === "changes" ? diffFileActions : null}
              review={tileId === "changes" && current ? { items: state.items[current], active: !!running, onSend: boot?.connected && !session?.archived ? (text) => sendFixedTurn(text) : null, onRerun: () => { void executeCommand("review"); } } : null}
              fileActions={tileId === "files" ? filePaneActions : null}
              treeToggleRef={tileId === "files" ? fileTreeToggleRef : tileId === "changes" ? diffTreeToggleRef : null}
              diffTree={tileId === "changes" ? tileState : null}
              onDiffTreeChange={tileId === "changes" ? tileStore.setGlobal : null}
              view={tileEntry ?? EMPTY_TILE_ENTRY}
              onViewChange={changeTileView}
              headerCenter={tileApi.dragHandle}
              paneControls={({ menuSections, leading }) => <SourcePaneControls tileId={tileId} paneName={PANE_NAMES[tileId]} layout={baseTileLayout(tileEntry)} expanded={expandedTile === tileId}
                menuSections={menuSections} leading={leading} onMoveToEdge={(edge) => moveTileEdge(tileId, edge)} onToggleExpand={() => toggleExpandTile(tileId)}
                onPopOut={api && !popoutKeys.has(`${current}:${tileId}`) ? () => popoutTile(tileId) : undefined}
                onClose={() => closePaneTile(tileId)} />}
            />
          ) : (
          <div className="source-chat-tile-content">
            <SourceTitlebar collapsed={effectiveCollapsed} onExpand={expandSidebar} section={section}
              peekOpen={effectiveCollapsed && peek.hovering} onPeekEnter={peekEnter} onPeekLeave={peekLeave}
              session={session} panes={openPanes} onTogglePane={(kind) => (kind === "terminal" ? toggleTerminalPane() : togglePaneTile(kind))} onMenu={openMenu} menuKind={menu?.kind} loading={loading}
              terminalAvailable={terminalAvailable} terminalBusy={terminalBusy}
              previewAvailable={previewAvailable} previewRunning={previewRunning}
              onRename={renameSession} onWhatsNew={() => setWhatsNew(true)}
              showWhatsNew={side === 0 && whatsNewVisible({ version: clientVersion, hasNotes: whatsNewHasNotes, seen: whatsNewSeen, open: whatsNew })}
              historyAt={historyAt} historyLength={history.length} travel={travel}
              changesDirty={!!(gitStatus?.isRepo && gitStatus.hasChanges)}
              onCloseSplit={splitView.open ? () => splitStore.close(side) : undefined}
              closeSplitShortcut={splitView.open && splitView.active === side ? "ctrl+cmd+w" : undefined} />
            <div className="source-chat-body">
          <div className="conversation">
            {section === "new" ? (
              <>
                {/* sidebar-main.js:20491: ZB is app-level, outside the per-session
                    transcript, so a session switch keeps the bar and its query and
                    recounts against the new transcript (scope and reveal are read
                    through transcriptRef at call time). */}
                <SourceFindBar ref={findBarRef} shortcuts={splitActive} sessionKey={current ?? "draft"}
                  getScope={() => transcriptRef.current?.getContent?.()}
                  scroll={{ reveal: (rect) => transcriptRef.current?.reveal?.(rect) ?? false }} />
                {/* Tasks the agent suggested (spawn_task, Code Desktop's agent tools): Start begins a new session with the
                    task's prompt in its folder, as the ⌘K 'Start a session' row does; nothing runs before that. */}
                {current && <SourceSuggestedTasks key={`suggested:${current}`} items={state.items[current]} sessionId={current} cwd={workdir || null}
                  disabled={!boot?.connected || !!settings}
                  onStart={(task) => { const folder = task.cwd || knownThread(current)?.cwd || workdir || cwd; startSessionFromSearch(task.prompt); if (folder) setCwd(folder); }} />}
                <SourceTranscript
                  key={current ?? "draft"}
                  ref={transcriptRef}
                  findBarRef={findBarRef}
                  sessionKey={current ? `code:${current}` : null}
                  ready={!loading}
                  pendingInput={approvals.length > 0}
                  interactionHandlers={turnInteraction.handlers}
                  messageActions={transcriptActions}
                  responding={running}
                  onFeedEscape={() => textarea.current?.focus()}
                >
                  {!current && (
                    <div className="welcome">
                      <SourceGreeting displayName={displayName} landingClear={homeLandingClear} />
                      {/* Official Zk: landing clear → stats card (hidden when the
                          stats read failed, $O undefined); otherwise the Action
                          Center; while sessions load, the remembered shape. */}
                      {remembered && (homeLoading && !homeLandingClear
                        ? <SourceActionCenterPlaceholder counts={remembered} limit={sessionsRowLimit} />
                        : homeLandingClear
                          ? statsSnapshot === null ? null : (
                            <div className="home-content" aria-busy={statsSnapshot === undefined || undefined}>
                              <SourceStatsCard stats={statsSnapshot} startedAt={homeStartedAt} models={models} surface="fill" attempts={statsAttempts} onRetry={loadStats} connected={!!boot?.connected} />
                            </div>)
                          : <SourceActionCenter rows={attentionRows} limit={sessionsRowLimit} menuOpenId={menu?.kind === "session" ? menu.data?.id : undefined} repoIdentities={repoIdentities}
                              onOpen={(item) => navigate(item.id)}
                              onDismiss={(item) => ackSession(item).catch((e) => setError(e.message))}
                              onMarkAllRead={(list) => Promise.all(list.map((item) => updateSessionMetadata(item.id, { unread: false }))).catch((e) => setError(e.message))}
                              onContextMenu={(item, anchor) => openMenu("session", anchor, item)} />)}
                      {/* Zk (cc43287c9-BMbiZYzF.js:5104-5180) has no connection card: nothing shows
                          while the core starts, and a lost connection is the composer's warning
                          row (data-cds-composer-warning + Retry). The key card is the local stand-in
                          for the sign-in gate, once account/read has answered without a key. Both cards
                          speak the Lw outline language (code-home.js:13752-13754: .sh-card.is-outline) with
                          a Jw text-body title (:13895-13924), a text-secondary body and CDS Buttons. */}
                      {boot?.connected && boot.account?.deepseek && !boot.account.account && (
                        <div className="sh-card is-outline connection-card" data-testid="deepseek-key-card">
                          <div className="connection-card-copy">
                            <span className="connection-card-title">{t("Add your DeepSeek API key")}</span>
                            <span className="connection-card-body">{t("Choose Add key and paste your key to start. A key saved in DeepSeek Harness or set as DEEPSEEK_API_KEY also works; refresh after adding one there.")}</span>
                          </div>
                          {/* Add key reopens setup's Connect a model step (it saves the key and restarts the core), which
                              'Set up later' otherwise leaves unreachable. */}
                          <div className="connection-card-actions">
                            <SourceSettingsButton size="sm" onClick={() => call("account-auth", { operation: "refresh" }).catch((e) => setError(e.message))}>{t("Refresh")}</SourceSettingsButton>
                            <SourceSettingsButton size="sm" onClick={() => call("external", { url: DEEPSEEK_KEYS_URL }).catch((e) => setError(e.message))}>{t("Get an API key")}</SourceSettingsButton>
                            <SourceSettingsButton size="sm" variant="primary" onClick={() => setOnboarding("connect")}>{t("Add key")}</SourceSettingsButton>
                          </div>
                        </div>
                      )}
                      {/* The running core's sign-in (account-label-model coreSignInPrompt): Codex's ChatGPT sign-in starts
                          here; a bridge core's sign-ins and keys are in Settings › Account. The DeepSeek core never asks. */}
                      {signInPrompt && (
                          <div className="sh-card is-outline connection-card" data-testid="core-sign-in-card" data-core-sign-in={signInPrompt.action}>
                            <div className="connection-card-copy">
                              <span className="connection-card-title">{t("Sign in to {name}", { name: signInPrompt.name })}</span>
                              <span className="connection-card-body">{signInPrompt.action === "login" ? (signInBrowser?.label ? t(signInBrowser.label) : t("Sign in in your browser to continue.")) : t("Sign in or add an API key in Settings › Preferences › Account so {name} can answer.", { name: signInPrompt.name })}</span>
                            </div>
                            <div className="connection-card-actions">
                              {signInPrompt.action === "login"
                                ? <SourceSettingsButton size="sm" variant="primary" onClick={startCoreSignIn}>{t("Sign in")}</SourceSettingsButton>
                                : <>
                                  <SourceSettingsButton size="sm" onClick={() => call("account-auth", { operation: "refresh" }).catch((e) => setError(e.message))}>{t("Refresh")}</SourceSettingsButton>
                                  <SourceSettingsButton size="sm" variant="primary" onClick={() => setSettings("preferences")}>{t("Open Settings")}</SourceSettingsButton>
                                </>}
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                  {/* transcriptLinks (scroll-messages-current.js:56305-56309) with the session repo slug En()
                      for the GitHub reference chips (source-forge-ref.jsx). */}
                  <AsyncQuestionsContext.Provider value={asyncQuestions}>
                  <CodeBlockActionsContext.Provider value={codeBlockActions}>
                  <SourceForgeRepoContext.Provider value={forgeRepoSlug(repoIdentities[workdir])}>
                  {/* A fork names the session it came from and links back (official 'Forked from {title}'). */}
                  {current && (() => {
                    const forked = typeof session?.forkedFromId === "string" && session.forkedFromId || sessionMetadata[current]?.forkedFrom;
                    const parentId = forked ? sessionParentId(session, sessionMetadata) : null;
                    if (!parentId) return null;
                    const parent = sessions.find((row) => row.id === parentId);
                    return <SourceForkLineage parentTitle={parent ? parent.name || parent.preview || null : null} onOpen={parent ? () => navigate(parentId) : null} />;
                  })()}
                  {shownRows.map((item, index, displayedItems) => {
                    // A /workflow run's local row; a model-started run (model-workflow-model.mjs) is a turn row below.
                    if(item.workflowRun&&!item.turnId)return <WorkflowRow key={item.id} run={item.workflowRun} warningLimits={workflowWarningLimits} onOpen={()=>openWorkflow(workflowKey({...item.workflowRun,itemId:item.id}))}/>;
                    if(item.localCommand)return <div key={item.id} data-local-command="status"><div className="source-user-bubble"><SourceUserText text="/status" nonInteractive/></div><SessionStatusDialog {...item} inline readStatus={readSessionStatus} onClose={()=>setLocalCommandRows(rows=>({...rows,[current]:(rows[current]||[]).filter(row=>row.id!==item.id)}))}/></div>;
                    const footer = turnFooters.get(item.toolGroup?.at(-1)?.id || item.id);
                    return <React.Fragment key={`${current}:${item.id}`}>
                      {item.workflowRun ? <WorkflowRow run={item.workflowRun} warningLimits={workflowWarningLimits} onOpen={()=>openWorkflow(workflowKey({...item.workflowRun,itemId:item.id}))}/> :
                      <Message item={item} isInterrupting={stopping} agentContext={{state,onOpen:openAgent,onTask:openBackgroundTask,onTaskEvent:openTaskEvent}} sessionKey={current} isStreaming={isItemStreaming(state, current, item)} turnStart={!!item.turnId && item.turnId !== displayedItems[index - 1]?.turnId}
                        cwd={workdir} onOpenFileRef={openFileRef} onOpenChanges={() => { if (!canViewChanges) return false; setPanel("changes"); return true; }} transcriptView={transcriptView} pendingApprovalItemIds={pendingApprovalItems}
                        turnStartedAtMs={item.type === "userMessage" ? turnSecondsToMs(state.turnTimes?.[current]?.[item.turnId]?.startedAt) : null}
                        reasoningPlacement={item.type === "reasoning" ? reasoningPlacement(displayedItems, index, transcriptView) : undefined}
                        userActions={item.type === "userMessage" ? userMessageActions({ turnId: item.turnId, activeTurnId: state.active[current], running,
                          rewindServed: !!(current && !session?.archived && boot?.connected && !unsupportedMethods?.includes("thread/revert")),
                          busyReason: t("Rewind is unavailable while {name} is working", { name: coreName(boot?.core) }),
                          onRewindTo: transcriptActions.onRewindTo, onForkFrom: transcriptActions.onForkFrom }) : null} />}
                      <SourceAutoReviews reviews={autoReviewsFor(state.autoReviews?.[current], item)} onApproveOnce={approveDeniedOnce ?? undefined} />
                      {footer && (() => {
                        // The reply the rating belongs to: the turn's last agent message.
                        const replyId = ratingsCore ? items.findLast((row) => row.turnId === footer.turnId && row.type === "agentMessage")?.id : null;
                        return <SourceTurnFooter sessionKey={current} turnId={footer.turnId}
                          text={footer.text} completedAtMs={turnSecondsToMs(state.turnTimes?.[current]?.[footer.turnId]?.completedAt)} {...turnInteraction.forTurn(footer.turnId)}
                          onFork={transcriptActions.onForkFrom ? () => transcriptActions.onForkFrom(footer.turnId) : null}
                          rating={replyId ? { value: messageRatings[current]?.[replyId]?.rating ?? null, onRate: (value) => rateReply(current, replyId, value).catch((e) => toasts?.add?.(e.message, { variant: "danger" })) } : null} />;
                      })()}
                      {item.turnId && editsByTurn.has(item.turnId) && displayedItems.findLastIndex(row => row.turnId === item.turnId) === index && (() => {
                        const edits = editsByTurn.get(item.turnId);
                        const canUndo = item.turnId === latestTurnId && !running && !loading && !sending && !!boot?.connected && !session?.archived && !misalignedTurn;
                        return <SourceTurnEdits edits={edits} turnId={item.turnId}
                          onUndo={canUndo ? () => void sendUndoTurn(edits.files) : undefined}
                          onView={canViewChanges ? () => setPanel("changes") : undefined}
                          onViewFile={canViewChanges ? (path) => { requestDiffReveal(path); setPanel("changes"); } : undefined} />;
                      })()}
                      {item.turnId && taskEventsByTurn.has(item.turnId) && displayedItems.findLastIndex(row => row.turnId === item.turnId) === index
                        && <SourceTaskEvent events={taskEventsByTurn.get(item.turnId)} itemId={`task-events:${item.turnId}`} onOpen={openTaskEvent} />}
                      {(() => {
                        // Inside the failed turn, after its last displayed row (scroll-messages error item).
                        const variant = item.turnId && turnErrorView.get(item.turnId);
                        if (!variant || displayedItems.findLastIndex(row => row.turnId === item.turnId) !== index) return null;
                        const canRetry = variant === "card" && !running && !loading && !!boot?.connected && !session?.archived && !!retryInput(items, item.turnId);
                        // CS onCompact (scroll-messages-current.js:56347-56383 onCompactLastTurn): the newest card of
                        // the last turn, on a live session whose core serves thread/compact/start.
                        const canCompact = variant === "card" && !running && !loading && !!boot?.connected && !session?.archived
                          && !unsupportedMethods?.includes("thread/compact/start");
                        return <SourceTurnError key={`${current}:${item.turnId}:${variant}`} error={state.turnErrors[current][item.turnId]} turnId={item.turnId} variant={variant}
                          onRetry={canRetry ? () => retryFailedTurn(item.turnId) : undefined}
                          onCompact={canCompact ? () => performOperation("compact").catch((e) => { if (toasts) toasts.add(e.message, { variant: "warning" }); else setError(e.message); }) : undefined}
                          onViewUsage={variant === "card" && !coreSupports(boot?.core, "perTokenBilling") ? () => setSettings("usage") : undefined}
                          onNewSession={variant === "card" ? () => navigate(null) : undefined}
                          onOpenSettings={variant === "card" ? (page) => setSettings(page) : undefined}
                          onOpenLink={variant === "card" ? (url) => call("external", { url }).catch(actionFailed("open-link")) : undefined}
                          onEditConfig={variant === "card" && !!boot?.connected ? () => call("desktop-edit-config").catch(actionFailed("open-config")) : undefined}
                          model={model}
                          onContinue={variant === "card" && !running && !loading && !!boot?.connected && !session?.archived ? (message) => continueMisalignment(message) : undefined}
                          // Recovery beyond Try again: rewind to before the failed turn (thread/revert), pick another model
                          // in the composer's menu, or the core's own sign-in (Settings › Account) after an auth failure;
                          // a sign-in that succeeded after the failure settles the card ('Signed in again').
                          onRewind={variant === "card" && transcriptActions.onRewindTo ? () => transcriptActions.onRewindTo(item.turnId) : undefined}
                          onSwitchModel={variant === "card" && !running && !!boot?.connected ? () => { const trigger = scope().querySelector(".sc-model-trigger"); if (trigger && !trigger.disabled) openMenu("model", trigger); } : undefined}
                          onSignIn={variant === "card" && hasSignInOptions(boot?.core) ? startCoreSignIn : undefined}
                          signInLabel={t("Sign in to {core}", { core: coreName(boot?.core) })}
                          signedInAgain={Number.isFinite(boot?.auth?.signedInAt) && boot.auth.signedInAt > (state.turnErrorAt?.[current]?.[item.turnId] ?? 0)}
                          limitReset={variant === "card" && planLimits && !coreSupports(boot?.core, "perTokenBilling") ? usageLimitReset(planLimits, { locale: getLocale() }) : null}
                          autoContinue={variant === "card" && canRetry ? { armed: autoResume?.threadId === current && autoResume?.turnId === item.turnId,
                            onChange: (on) => setAutoResume(on ? { threadId: current, turnId: item.turnId, at: usageLimitReset(planLimits, { locale: getLocale() })?.resetsAtMs ?? null } : null) } : null} />;
                      })()}
                      {/* After the last row of a turn a fork was made at: 'Forked here: {title}', opening the fork. */}
                      {item.turnId && forkMarks.has(item.turnId) && displayedItems.findLastIndex(row => row.turnId === item.turnId) === index
                        && <SourceForkMarker forks={forkMarks.get(item.turnId)} onOpen={(id) => navigate(id)} />}
                    </React.Fragment>;
                  })}
                  {/* The optimistic user message (pending-send-model.mjs): 'Sending…' until the core echoes it, or
                      'Not delivered' with Retry / Discard after a refused turn/start. */}
                  {current && (pendingSends[current] || []).map((entry) => {
                    const row = pendingUserRow(entry, { onRetry: () => { void retryPendingSend(current, entry.id); }, onDiscard: () => discardPendingSend(current, entry.id) });
                    return <Message key={`${current}:${row.id}`} item={row} sessionKey={current} isStreaming={false} turnStart={true} cwd={workdir} onOpenFileRef={openFileRef} transcriptView={transcriptView} />;
                  })}
                  </SourceForgeRepoContext.Provider>
                  </CodeBlockActionsContext.Provider>
                  </AsyncQuestionsContext.Provider>
                  {/* _d (approval-entry-current.js:1141-1190) pending phase. With
                      cached rows only the sr-only announcement remains. */}
                  {loading && current && (shownRows.length === 0
                    ? <div className="loading-state source-transcript-pending" role="status"><span className="sr-only">{t("Loading session")}</span><SourceTranscriptSkeleton /></div>
                    : <div className="loading-state" role="status"><span className="sr-only">{t("Loading session")}</span></div>)}
                  {emptyPane === "failure" && <SourceTranscriptLoadFailure onRetry={() => openSession(current, { retry: true })} />}
                  {emptyPane === "empty" && <SourceTranscriptEmpty />}
                  <CardComposerContext.Provider value={cardComposer}>
                  {shownApprovals.map((a) => (
                    <Approval
                      key={a.bridgeApproval.instanceId}
                      runtime={approvalRuntime.current}
                      request={a}
                      item={approvalItem(a, items)}
                      // The file request's in-card diff header opens its path (ToolPath).
                      sessionKey={current} cwd={workdir} onOpenFileRef={openFileRef}
                      // approval-draft-model.submit refuses a response unless the
                      // thread the approval belongs to is the visible one. A
                      // sub-agent thread is never itself visible, so the session
                      // that owns it stands in for it; without this its card
                      // would render but every button would stay inert.
                      getVisibleThreadId={() => (currentRef.current && approvalOwner(a) === currentRef.current ? a.params?.threadId : currentRef.current)}
                      respond={payload => respondApproval(a, payload)}
                      isActive={!!boot?.connected && !loading && current === approvalOwner(a)}
                      menuOpen={!!menu || settings || showSearch || !!rename || whatsNew || !!actionDialog || (effectiveCollapsed && peek.hovering)}
                      // R07 plan card: the primary's target (Mk) and the 'Open plan' link.
                      planTarget={afterPlanPermission(afterPlan.current, { bypass: bypassMode.available })}
                      bypassAvailable={bypassMode.available}
                      onOpenPlan={(() => { const plan = planItemFor(a); return plan ? () => openPlanItem(plan.id) : undefined; })()}
                    />
                  ))}
                  </CardComposerContext.Provider>
                  {handoff && shownApprovals.length === 0 && <SourcePlanHandoffCard key={`${current}:${handoff.turnId}`} handoffKey={`${current}:${handoff.turnId}`}
                    target={afterPlanPermission(afterPlan.current, { bypass: bypassMode.available })} bypassAvailable={bypassMode.available} busy={planHandoffBusy}
                    isActive={!!boot?.connected && !loading} menuOpen={!!menu || settings || showSearch || !!rename || whatsNew || !!actionDialog || (effectiveCollapsed && peek.hovering)}
                    onImplement={implementPlan} onStay={() => answerPlanHandoff(current, handoff.turnId)}
                    onOpenPlan={handoff.planItemId ? () => openPlanItem(handoff.planItemId) : undefined} />}
                  {state.errors[current] && (() => {
                    // A failure without a turn identity is still a source error item (scroll-messages-current.js:56486-56500
                    // ehe card), at the transcript tail. Try again resends the last text-only prompt when there is one.
                    const lastTurnId = items.findLast((item) => item?.type === "userMessage" && item.turnId)?.turnId;
                    const canRetry = !running && !loading && !!boot?.connected && !session?.archived && !!lastTurnId && !!retryInput(items, lastTurnId);
                    return <SourceTurnError key={`${current}:thread`} error={state.errors[current]} turnId="thread" variant="card"
                      onRetry={canRetry ? () => retryFailedTurn(lastTurnId) : undefined}
                      onViewUsage={!coreSupports(boot?.core, "perTokenBilling") ? () => setSettings("usage") : undefined}
                      onOpenSettings={(page) => setSettings(page)} onOpenLink={(url) => call("external", { url }).catch(actionFailed("open-link"))}
                      onNewSession={() => navigate(null)} model={model}
                      onEditConfig={boot?.connected ? () => call("desktop-edit-config").catch(actionFailed("open-config")) : undefined} />;
                  })()}
                  {recap && <SourceRecapCard recap={recap} sessionKey={current} onDismiss={dismissRecap} />}
                  {!emptyPane && <SourceTranscriptStatus sessionKey={current} ready={!loading}
                    turnId={state.active[current]} turnStats={state.turnStats?.[current]}
                    items={state.items[current]} itemPhases={state.itemPhases?.[current]}
                    connected={!!boot?.connected} running={running} stopping={stopping} retrying={retryStatus} sending={sending && !running}
                    onOpenLink={(url) => call("external", { url }).catch(actionFailed("open-link"))}
                    waiting={approvals.length > 0} approvalVisible={approvals.length > 0}
                    /* Xhe :58739-58800: runningTaskCount (Gb) and the tasks-pane toggle only when side
                       panes exist (open session in the chat section); running tasks are never dismissed. */
                    runningTaskCount={taskSections(tasks).running.length} tasksPaneOpen={openPanes.has('tasks')}
                    onToggleTasksPane={session && section === "new" ? () => togglePaneTile('tasks') : null}
                    /* X5 V :58762-58778 (onToggleThinking only when the view is Thinking or
                       does not already show reasoning, i.e. never in Verbose). */
                    onToggleThinking={current && transcriptView !== "verbose" ? () => {
                      const next = transcriptView === "thinking" ? "normal" : "thinking";
                      setSessionView(current, next);
                      toasts?.add(next === "thinking" ? t("Switched transcript view to Thinking.") : t("Switched transcript view to Normal."));
                    } : null}
                    thinkingShown={transcriptView === "thinking"} />}
                </SourceTranscript>
                {/* F09 review: no Home connection card shows the reason any more, so a failed start,
                    initialize or reconnect shows here on Home too, above the composer's warning row. */}
                {error && (
                  <div role="alert" className="inline-error composer-error">
                    <span>{error}</span>{commandSuggestion&&<button onClick={()=>{setDraft(`/${commandSuggestion} `);setError("");setCommandSuggestion(null);textarea.current?.focus();}}>/{commandSuggestion}</button>}
                    <ToolButton
                      label={t("Dismiss error")}
                      icon="X"
                      tooltip
                      onClick={() => setError("")}
                    />
                  </div>
                )}
                {current && state.goals?.[current] && <SourceGoalStrip goal={state.goals[current]} busy={goalBusy}
                  onPause={nativeGoals ? () => goalAction({ status: "paused" }) : undefined}
                  onResume={nativeGoals ? () => goalAction({ status: "active" }) : undefined}
                  onClear={nativeGoals ? () => goalAction(null) : undefined}
                  onEdit={nativeGoals && state.goals[current].status !== "complete" ? () => { setDraft(`/goal edit ${state.goals[current].objective}`); requestAnimationFrame(() => textarea.current?.focus()); } : undefined} />}
                <SourceSessionNotices
                  notices={[...(hooksNotice ? [hooksNotice] : []), ...(bufferingNotice ? [bufferingNotice] : []), ...(upsellNotice ? [upsellNotice] : []), ...(upgradeNotice ? [upgradeNotice] : []), ...(headlineNotice ? [headlineNotice] : []),
                    ...(usageNotice ? [{ ...usageNotice, actions: [{ label: t("View usage"), run: () => setSettings("usage") }] }] : []),
                    ...sessionNotices({ notices: state.notices, warnings: (current && state.warnings[current]) || [], threadNotices: (current && state.threadNotices?.[current]) || [] })
                      // A bridge core's 'ignores this folder's … until you trust the folder' (Gemini's folder trust): gone once
                      // trusted here, and 'Trust this folder' writes the agent's own trust rule (codeDesktop/workspace/trust).
                      .filter((notice) => !(notice.kind === "warning" && UNTRUSTED_FOLDER_NOTICE.test(notice.summary) && trustedFolders.has(workdir)))
                      .map((notice) => notice.kind === "warning" && UNTRUSTED_FOLDER_NOTICE.test(notice.summary) && workdir && boot?.core?.capabilities?.workspaceTrust === true
                        ? { ...notice, actions: [{ label: t("Trust this folder"), run: () => void trustBridgeFolder(workdir) }] } : notice)
                      // A network access Codex's auto-review denied: 'Approve once' retries it (Codex's /auto-review).
                      .map((notice) => notice.kind === "autoReviewDenied" && notice.reviewId && approveDeniedOnce && guardianDenialEvent(state.autoReviews?.[current]?.[notice.reviewId])
                        ? { ...notice, actions: [{ label: t("Approve once"), run: () => { const review = state.autoReviews[current][notice.reviewId];
                          if (window.confirm(t("Let {core} retry this once? {action}", { core: coreName(boot?.core), action: deniedActionSummary(review.action) }))) void approveDeniedOnce(review).catch(actionFailed("approve-once")); } }] }
                        : notice)]}
                  onReveal={(file) => call("reveal-config-file", { path: file }).catch((error) => setError(error.message))}
                  onTrust={canTrustProject ? trustProject : undefined} trusting={trustingProject} />
                {session?.archived && <div className="archive-notice">{t("This session is archived.")}<button onClick={() => sessionAction("unarchive", session).catch(actionFailed("unarchive"))}>{t("Restore session")}</button></div>}
                {operation && <div className="session-operation-status" role="status" data-operation={operation.operation} data-phase={operation.phase}>
                  <span>{operation.phase === "failed" ? operation.error || t("Session action failed.")
                    : operation.phase === "unknown" ? operation.error
                    : operation.phase === "completed" ? ({compact:t("Conversation compacted"), review:t("Review complete"), fork:t("Session forked")}[operation.operation])
                    : ({compact:t("Compacting conversation…"), review:t("Reviewing code…"), fork:t("Forking session…")}[operation.operation])}</span>
                  {!actionPending && <button aria-label={t("Dismiss session action")} onClick={() => dispatch({type:"dismiss-operation", id:current})}><Icon name="X" size={12}/></button>}
                </div>}
                {current && splitTip && !splitView.open && splitTip.partner !== current && sessions.some((thread) => thread.id === splitTip.partner) && <div className="sqm-band epitaxy-band-enter" data-testid="epitaxy-split-suggestion" role="status">
                  <div className="sqm-row sqm-single">
                    <span className="sqm-preview sqm-tip-text">{t("See multiple sessions side by side in split view.")}</span>
                    <button type="button" className="sc-button sqm-tip-action" onClick={() => { const partner = splitTip.partner; closeSplitTip("accepted"); splitStore.open(partner); }}>{t("Open in split view")}</button>
                    <button type="button" aria-label={t("Dismiss")} data-cds="Button" className="sc-button sc-icon-button sqm-ghost" onClick={() => closeSplitTip("dismissed")}><Icon name="X" size={12}/></button>
                  </div>
                </div>}
                {current && pendingSteers[current]?.length > 0 && <div className="sqm-band epitaxy-band-enter" data-pending-steers="" data-count={pendingSteers[current].length} role="status">
                  <div className="sqm-row sqm-single">
                    <span className="sqm-count">{tn(pendingSteers[current].length, "Sending after the next step", "{count} messages sending after the next step", { count: pendingSteers[current].length })}</span>
                    <span className="sqm-preview">{pendingSteers[current].map((entry) => entry.preview).join(" · ")}</span>
                  </div>
                </div>}
                {current && queue.threadId === current && queue.entries.length > 0 && (
                  <SourceQueuedMessages key={`${current}:queued`} entries={queue.entries} lockedIds={queue.lockedIds}
                    onCancel={queueCancel} onEdit={queueEdit} onReorder={queueReorder} />
                )}
                {/* Computer use: while the agent controls the computer, the latest screenshot, the action and Stop. */}
                {current && running && <SourceComputerUseBanner active={activeComputerUse(items, item => ["inProgress", "running"].includes(item?.status))}
                  coreName={coreName(boot?.core)} onStop={() => void stop()} stopping={stopping} />}
                <SourceComposer
                  fastMode={fastEnabled}
                  speedLabel={activeTier?.name ?? null}
                  fastAvailable={!!fastTier}
                  // Dynamic workflows (Claude Code's prompt input): the keyword's notice (alt+w ignores it for this prompt) and
                  // ultracode's status line; the keyword is highlighted while it counts.
                  workflowKeyword={keywordMatches.length ? { ignored: keywordIgnored, onToggle: () => setKeywordIgnored((value) => !value) } : null}
                  ultracode={ultracodeOn}
                  commandContext={commandContext} onCommand={executeCommand} commandScope={current}
                  // cc43287c9 :28625-28628 historyResetKey `${draftKey}:${sessionId}` only for an existing
                  // session (the New draft has no history); getHumanPrompts = OE over the open thread.
                  historyResetKey={current ? `${mode}:${current}` : undefined}
                  getHumanPrompts={() => humanPrompts(shownUserItems(items))}
                  // F12: no onDismiss in commit mode; the counts toggle Changes (git-status-card 5024-5045 Zn toggle:true);
                  // a revisited session shows its held snapshot until its own status arrives.
                  // '!' shell mode (shell-mode-model.mjs) is the composer's own bash mode (Claude's bashModeAvailable): the purple
                  // 'bash' badge and ring, no note above the card.
                  shellMode={shellModeKind(boot?.core, shellOptions)}
                  beforeComposer={current && (bandStatus ? <SourceGitStatus status={bandStatus} prMode={bandPr ? "create" : "commit"} pr={bandPr}
                    onOpenFolder={() => call("reveal-folder", { cwd: gitStatus?.cwd || workdir }).catch(actionFailed("reveal"))}
                    onCopyPath={path => copyWithToast(path || gitStatus?.cwd || workdir, t("Path copied to clipboard."))}
                    onCopyBranch={branch => copyWithToast(branch || gitStatus?.branch || "", t("Branch name copied to clipboard."))}
                    onOpenChanges={() => togglePaneTile("changes")} onMeasured={rememberBandHeight}
                    onAction={sendCommitTurn} actionLabel={t("Commit")} actionDisabled={commitDisabled} actionDisabledReason={commitDisabledReason} />
                    : bandHold ? <SourceGitStatus stale status={bandHold.status} heightPx={bandHold.heightPx} prMode="commit"
                      onAction={sendCommitTurn} actionLabel={t("Commit")} /> : null)}
                  showPet={!current && !error && !draft.startsWith("/")}
                  showContext={!current}
                  // cc43287c9 :28686 placeholder Yn ? 'Type / for commands' : 'Describe a task or ask a question'
                  // (Yn = Pn?.id ?? null, :27454) — composer-placeholder.mjs; chat mode keeps its own copy.
                  placeholder={composerPlaceholder({ sessionId: current, mode })}
                  suggestion={current && boot?.config?.promptSuggestions !== false ? promptSuggestions[current] ?? null : null}
                  onAcceptSuggestion={() => setPromptSuggestions((all) => ({ ...all, [current]: null }))}
                  draft={draft}
                  setDraft={setDraft}
                  textarea={textarea}
                  attachments={attachments}
                  onRemoveAttachment={removeComposerAttachment}
                  // R06 pill click (c099c328d Gl :3542-3550, adapted): a file opens in the Files pane (F11 viewer), a directory is revealed.
                  onOpenAttachmentFile={(entry, action) => action === "reveal" ? transcriptActions.onRevealFile?.(entry.path)
                    : openFileRef({ path: pathChoices(entry.path, workdir)?.relative || entry.path })}
                  onStageFiles={stageComposerFiles}
                  searchFiles={searchMentionFiles}
                  onMention={rememberMention}
                  queueEnabled={!!current && running && !!boot?.connected && !session?.archived}
                  onSubmit={send}
                  // cc43287c9 :28620 stayOnDraftHint (cn === 'draft' && !Yn): ⌘⏎ on Home is 'Send and stay here'.
                  stayOnDraft={!current}
                  running={running}
                  sending={sending || actionPending}
                  stopping={stopping}
                  // cc43287c9-BMbiZYzF.js:27612 Jr / :28636-28638: the editor stays typeable while the session loads or
                  // the core is away (only an archived session locks it); sending waits for both (send() checks too).
                  // Jr also holds `c > 0`: Home stays locked while a 'Send and stay here' spawn is in flight.
                  editable={!session?.archived && !(backgroundSpawns > 0 && !current)}
                  canSubmit={!!boot?.connected && !loading}
                  // Enter while sending is gated: say why under the composer (still starting, or a session loading).
                  connectingHint={!boot?.connected && (loading || !initSettled) ? t("Still connecting to DeepSeek. Try again in a moment.")
                    : boot?.connected && loading ? t("Wait for the session to load") : undefined}
                  // Escape belongs to the topmost local layer (the window handler above) before it stops a turn.
                  // A pending approval, plan or question card claims it too: Esc answers the card (Deny, Revise…) through
                  // its document hotkeys, and when the card does not take it (a draft here) it must not stop the turn.
                  escapeClaimed={!!(settings || actionDialog || rename || whatsNew || workflowLaunch || bypassMode.confirming || confirmDelete || showSearch || (effectiveCollapsed && peek.hovering)
                    || (current && shownApprovals.length > 0 && !!boot?.connected && !loading))}
                  // Esc Esc (code-workspace.js Gl → openRewindPicker): Rewind for an idle, live session whose core serves
                  // thread/revert and that has a turn to go back to, as the message menu's 'Rewind to here'.
                  onRewind={current && !running && !session?.archived && boot?.connected && !unsupportedMethods?.includes("thread/revert")
                    && items.some((item) => item.type === "userMessage" && item.turnId && item.turnId !== state.active[current])
                    ? () => { rewindPreselect.current = null; void executeCommand("rewind", "", undefined); } : null}
                  // c099c328d :11162-11188 / cc43287c9 :28653 onEmptyArrowUp = handleDequeueLastQueued (:31152-31156).
                  onEmptyArrowUp={() => {
                    const last = queue.threadId === current ? lastDequeueable(queue) : null;
                    if (!last) return false;
                    queueEdit(last.id);
                    return true;
                  }}
                  mentions={mentions}
                  mentionActions={mentionActions}
                  // A DeepSeek core without a key: the warning row stands in for the sign-in gate (send() refuses), and
                  // its Add key opens the same key step as the home key card's.
                  warning={boot !== null && boot?.connected === false && !loading ? t("Connection to {core} lost.", { core: coreName(boot?.core) })
                    : boot?.connected && boot.account?.deepseek && !boot.account.account ? t("Add a DeepSeek API key to start a session.")
                    : signInRequired ? t("Sign in to {name} to start a session.", { name: signInPrompt.name }) : undefined}
                  // A missing sign-in's action is the sign-in itself (send() starts it too); a missing DeepSeek key's is
                  // Add key, setup's Connect a model step like the home key card's (it saves the key and restarts the
                  // core); any other sign-in prompt re-reads account/read; a lost connection reconnects.
                  onReconnect={signInRequired ? startCoreSignIn : boot?.connected && boot.account?.deepseek && !boot.account.account ? () => setOnboarding("connect")
                    : boot?.connected && signInPrompt ? () => call("account-auth", { operation: "refresh" }).catch((e) => setError(e.message)) : reconnect}
                  reconnectLabel={signInRequired ? t("Sign in") : boot?.connected && boot.account?.deepseek && !boot.account.account ? t("Add key") : undefined}
                  onStop={stop}
                  workdir={workdir}
                  workspaceInfo={workspaceInfo}
                  onMenu={openMenu}
                  model={chosen}
                  effort={effort}
                  // Before init() settles the saved mode is unknown: null makes the chip a neutral "Mode" placeholder.
                  permission={boot || initSettled ? effectivePermission : null}
                  permissionOpen={menu?.kind === "permission"}
                  modelOpen={menu?.kind === "model"}
                  modelsLoading={boot === null}
                  menuKind={menu?.kind}
                  worktree={worktree}
                  setWorktree={setWorktree}
                  usage={state.usage[current]} planUsage={planUsage}
                  // c360a9e1c hd Y: with no session (sessionRef null) the trigger reads 'Context 0'.
                  usageFresh={!current}
                  mode={mode}
                  onCodeMode={mode === "chat" ? () => switchMode("code") : undefined}
                  onFolder={folder}
                  folderMenu={!recentFolderList.browseDirectly}
                  additionalFolders={additionalFolders}
                  onAddFolder={() => call("folder", { additional: true }).then(dir => { if (dir && dir !== cwd) setAdditionalFolders(list => [...new Set([...list, dir])]); }).catch(e => setError(e.message))}
                  onRemoveFolder={dir => setAdditionalFolders(list => list.filter(item => item !== dir))}
                />
              </>
            ) : (
              <div className="section-surface">
                <header>
                  <h1>{t(section[0].toUpperCase() + section.slice(1))}</h1>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      section === "artifacts"
                        ? setPanel("files")
                        : setSettings(true)
                    }
                  >
                    <Icon
                      name={section === "artifacts" ? "Folder" : "Settings"}
                    />
                    {section === "artifacts" ? t("Browse project") : t("Settings")}
                  </button>
                </header>
                <p>
                  {section === "artifacts"
                    ? t("Files created in your workspace are available in the project browser.")
                    : section === "routines"
                      ? t("Scheduled tasks aren’t available in Code Desktop yet.")
                      : t("Configure your local DeepSeek environment and workspace.")}
                </p>
                {section === "artifacts" && (
                  <FilePanel
                    cwd={workdir}
                    sessionId={current ?? null}
                    searchPane="artifacts"
                    tab="files"
                    onClose={() => setSection("new")}
                  />
                )}
              </div>
            )}
          </div>
            </div>
          </div>
          )} />
        </WebLinkContext.Provider>
      </main>
      </SourceSplitHost>
      {shownBypass.value && <SourceBypassDialog key={`bypass-${shownBypass.key}`} open={shownBypass.open} onExited={shownBypass.onExited} cwd={workdir || cwd} guide={bypassGuide(coreForEngine(boot?.core?.engine))} onConfirm={bypassMode.confirm} onClose={bypassMode.cancel}/> }
      {menu?.kind === "model" ? <SourceModelMenu key={menu.token ?? "model"} anchor={menu.anchor} models={models} selected={model} onSelect={m => { Promise.resolve(chooseModel({model:m.model, effort:m.defaultReasoningEffort})).catch(e=>setError(e.message)); }} scopeNote={current ? t("Changed for this session only. New sessions use the model from Settings.") : null} fastTier={fastTier} fastMode={fastEnabled} speedTiers={speedTiers} speed={activeTier?.key ?? STANDARD_SPEED} onSpeedChange={value=>changeSpeed(value).catch(e=>setError(e.message))} fastDisabled={fastSaving || running || sending || !boot?.connected} fastSaving={fastSaving} onFastModeChange={value=>changeFastMode(value).catch(e=>setError(e.message))} onClose={closeMenu} initialHighlight={menu.entry} /> : menu?.kind === "permission" ? <SourcePermissionMenu key={menu.token ?? "permission"} anchor={menu.anchor} value={effectivePermission} defaultValue={permission} bypassEnabled={bypassMode.available}
        bypassOffer={bypassOffer({ enabled: bypassOptIn && !bypassRefusal, availability: bypassOptIn ? bypassRefusal : bypassRequirements })}
        onEnableBypass={() => { closeMenu(); setSettings("code#bypass"); }} onChange={value => bypassMode.select(value)} onClose={closeMenu} onSelectComplete={() => textarea.current?.focus()} initialHighlight={menu.entry}
        agents={primaryAgents?.rows ?? null} agentValue={agentChoice ?? primaryAgents?.defaultAgent ?? null} defaultAgent={primaryAgents?.defaultAgent ?? null}
        onAgentChange={(name) => setAgentChoices((choices) => ({ ...choices, [current || ""]: name }))} /> : ["session", "titlebar"].includes(menu?.kind) ? <SourceSidebarMenu key={menu.token ?? menu.kind} anchor={menu.anchor} kind={menu.kind} label={t("Session menu")} onClose={closeMenu} initialHighlight={menu.entry}>{menuContent()}</SourceSidebarMenu> : menu?.kind === "account" ? <SourceMenu.Popup key={menu.token ?? "account"} anchor={menu.anchor} side="top" align="start" label={t("Account menu")} className="account-menu" onClose={closeMenu} initialHighlight={menu.entry}>{menuContent()}</SourceMenu.Popup> : menu?.kind === "add" ? <SourceMenu.Popup key={menu.token ?? "add"} anchor={menu.anchor} side="top" align="start" label={t("Add")} className="add-menu" onClose={closeMenu} initialHighlight={menu.entry}>{menuContent()}</SourceMenu.Popup> : menu?.kind === "effort" ? <SourceEffortPopover key={menu.token ?? "effort"} anchor={menu.anchor} levels={efforts} value={effort}
        onChange={value => { if (currentRef.current) { setEffort(value); Promise.resolve(chooseModel({ effort: value })).catch(e => setError(e.message)); } else if (workflowState.enabled && isUltracodeTier(value)) setEffort(value); else preference("effort", value); }} onClose={closeMenu}
        plan={planEffort ? { ...planEffort, onChange: (value) => { setPlanEffort((old) => old && { ...old, saving: true }); call("plan-effort", { op: "write", value }).then((next) => setPlanEffort({ ...next, saving: false }), (e) => { setPlanEffort((old) => old && { ...old, saving: false }); setError(e.message); }); } } : null} />
      : menu?.kind === "usage" ? <SourceUsagePopover key={menu.token ?? "usage"} anchor={menu.anchor} usage={state.usage[current]} fresh={!current}
        plan={planUsage} onViewUsage={() => { closeMenu(); setSettings("usage"); }}
        onSeeDetails={current ? () => executeCommand("status") : undefined} onClose={closeMenu}
        // c360a9e1c :4136-4139 hd: oe = an onCompact for an open session; ae closes the popover, then compacts
        // (performOperation('compact') through executeCommand). Tw's inputs: replying, detached, compacting.
        onCompact={current && !session?.archived && !unsupportedMethods?.includes("thread/compact/start") ? () => { closeMenu(); executeCommand("compact"); } : undefined}
        compactState={{ running: running || (actionPending && operation?.operation !== "compact"), connected: !!boot?.connected,
          compacting: operation?.operation === "compact" && actionPending, autoCompactPct: autoCompactPercent(boot?.core, state.usage[current]) }} />
      : ENV_MENUS[menu?.kind] ? <SourceMenu.Popup key={menu.token ?? menu.kind} anchor={menu.anchor} {...ENV_MENUS[menu.kind]} label={t(ENV_MENUS[menu.kind].label)}
        onClose={closeMenu} initialHighlight={menu.kind === "branch" ? null : menu.entry}>{menuContent()}</SourceMenu.Popup>
      : null}
      {/* R05 GR (cc43287c9 :28413-28421 mounted with ge): onResolved → D(le) records the target; Cancel keeps the branch. */}
      {shownBranchSwitch.value && <SourceBranchSwitchDialog key={`branch-switch-${shownBranchSwitch.key}`} open={shownBranchSwitch.open} onExited={shownBranchSwitch.onExited}
        currentBranch={shownBranchSwitch.value.currentBranch} targetBranch={shownBranchSwitch.value.targetBranch} status={shownBranchSwitch.value.status}
        onResolve={(mode) => call("branch-switch-resolve", { cwd: shownBranchSwitch.value.cwd, mode, currentBranch: shownBranchSwitch.value.currentBranch })}
        onResolved={() => { const { targetBranch, currentBranch } = shownBranchSwitch.value;
          recordBranch(targetBranch, currentBranch); setBranchSwitch(null); refreshChanges(); }}
        onCancel={() => setBranchSwitch(null)}
        onError={() => { if (toasts) toasts.add(t(WORKING_TREE_ERROR), { variant: "danger" }); else setError(t(WORKING_TREE_ERROR)); }} />}
      {shownActionDialog.value?.kind === "shortcuts" && <KeyboardShortcutsDialog key={`action-${shownActionDialog.key}`} {...actionDialogProps("shortcuts")} fastMode={models.some(m => speedTiersForModel(m).length > 0)} sideChat={commandContext.sideQuestions !== false} onClose={()=>setActionDialog(null)}/>}
      {shownActionDialog.value?.kind === "sign-out" && <SourceConfirmDialog key={`action-${shownActionDialog.key}`} {...actionDialogProps("sign-out")}
        title={t("Sign out")} body={signOutConfirmText(boot?.core)} confirmLabel={t("Confirm sign out")} onClose={() => setActionDialog(null)}
        onConfirm={() => call("account-auth", { operation: "logout", confirmed: true })} />}
      {/* A core's public share page (OpenCode /share) and OpenCode's /cd with uncommitted changes: the app's
          Claude-styled sheets, not native confirm() boxes (English OK/Cancel). */}
      {shownActionDialog.value?.kind === "share" && <SourceConfirmDialog key={`action-${shownActionDialog.key}`} {...actionDialogProps("share")}
        title={t("Share this conversation?")} body={t("Anyone with the link can read it on {core}’s public share page until you stop sharing.", { core: coreName(boot?.core) })}
        confirmLabel={t("Share conversation")} onClose={() => setActionDialog(null)} onConfirm={() => sessionAction("share", shownActionDialog.value.target, { confirmed: true })} />}
      {shownActionDialog.value?.kind === "move-changes" && <MoveChangesDialog key={`action-${shownActionDialog.key}`} {...actionDialogProps("move-changes")}
        changes={shownActionDialog.value.changes} folder={shownActionDialog.value.folder} onClose={() => setActionDialog(null)} onChoose={(moveChanges) => shownActionDialog.value.run(moveChanges)} />}
      {shownActionDialog.value?.kind === "goal-replace" && <SourceConfirmDialog key={`action-${shownActionDialog.key}`} {...actionDialogProps("goal-replace")}
        title={t("Replace goal?")} body={t("The current goal “{current}” isn’t finished. Replace it with “{objective}” and start that now?", { current: shownActionDialog.value.current.length > 200 ? `${shownActionDialog.value.current.slice(0, 200)}…` : shownActionDialog.value.current, objective: shownActionDialog.value.objective.length > 200 ? `${shownActionDialog.value.objective.slice(0, 200)}…` : shownActionDialog.value.objective })}
        confirmLabel={t("Replace goal")} onClose={() => setActionDialog(null)} onConfirm={() => shownActionDialog.value.run()} />}
      {shownActionDialog.value?.kind === "worktree-dirty" && <SourceConfirmDialog key={`action-${shownActionDialog.key}`} {...actionDialogProps("worktree-dirty")}
        title={shownActionDialog.value.action === "delete" ? t("Delete session with uncommitted changes?") : t("Archive session with uncommitted changes?")}
        body={tn(shownActionDialog.value.status.changes, "This session’s worktree has {count} uncommitted change. It is removed with the session; commit or copy what you want to keep first.", "This session’s worktree has {count} uncommitted changes. It is removed with the session; commit or copy what you want to keep first.")}
        danger confirmLabel={shownActionDialog.value.action === "delete" ? t("Delete anyway") : t("Archive anyway")} onClose={() => setActionDialog(null)}
        onConfirm={() => { const { action, target, payload, status } = shownActionDialog.value; return sessionAction(action, target, { ...payload, worktreeChecked: true, worktree: status }); }} />}
      {shownActionDialog.value?.kind === "help" && <SlashHelp key={`action-${shownActionDialog.key}`} {...actionDialogProps("help")} onClose={()=>setActionDialog(null)}
        commands={matchCommands("", commandContext)} coreLabel={commandContext.coreName} docsUrl={runningCore ? coreForEngine(typeof runningCore === "string" ? runningCore : runningCore.engine).homepage ?? null : null}
        onShortcuts={() => setActionDialog({ kind: "shortcuts" })} onSettings={(page) => setSettings(page)} onWhatsNew={() => setWhatsNew(true)}
        onOpenLink={(url) => call("external", { url }).catch(actionFailed("open-link"))}/>}
      {shownActionDialog.value?.kind === "codex-feedback" && <CodexFeedbackDialog key={`action-${shownActionDialog.key}`} {...actionDialogProps("codex-feedback")} rpc={rpc} onOpenLink={(url) => call("external", { url }).catch(actionFailed("open-link"))}
        threadId={shownActionDialog.value.threadId} initialNote={shownActionDialog.value.note} onClose={() => setActionDialog(null)}
        {...(shownActionDialog.value.core ? { coreLabel: shownActionDialog.value.core, logsSupported: false } : {})} />}
      {shownActionDialog.value?.kind === "resume" && <SourceResumeDialog key={`action-${shownActionDialog.key}`} {...actionDialogProps("resume")} desktopCall={call} fullText={coreSupports(boot?.core, "threadSearch")}
        cwd={workdir || cwd || ""} initialQuery={shownActionDialog.value.query} onClose={() => setActionDialog(null)}
        onOpened={async (id) => { setActionDialog(null); await refreshSession(id); navigate(id); }} />}
      {shownActionDialog.value?.kind === "claude-import" && <ClaudeImportDialog key={`action-${shownActionDialog.key}`} {...actionDialogProps("claude-import")} desktopCall={call}
        cwds={[workdir || cwd].filter(Boolean)} onDone={() => { void customizeStore?.loadSkills?.({ cwd: workdir || cwd, force: true }); void customizeStore?.loadMcp?.({ cwd: workdir || cwd, threadId: current ?? null, force: true }); }} onClose={() => setActionDialog(null)} />}
      {shownActionDialog.value?.kind === "feedback-share" && <FeedbackShareDialog key={`action-${shownActionDialog.key}`} {...actionDialogProps("feedback-share")} text={shownActionDialog.value.text}
        onConfirm={async () => { const run = shownActionDialog.value.run; setActionDialog(null); await run(); }} onClose={() => setActionDialog(null)} />}
      {shownActionDialog.value?.kind === "rewind" && <RewindDialog key={`action-${shownActionDialog.key}`} {...actionDialogProps("rewind")} turns={shownActionDialog.value.turns} preselected={shownActionDialog.value.preselected} canRestoreFiles={boot?.core?.capabilities?.rewindFiles === true} onConfirm={rewindConversation} onClose={()=>setActionDialog(null)}/>}
      {shownActionDialog.value?.kind === "review" && <ReviewDialog key={`action-${shownActionDialog.key}`} {...actionDialogProps("review")} initialInstructions={shownActionDialog.value.instructions} workspaceInfo={workspaceInfo} core={boot?.core} permission={effectivePermission}
        onClose={() => setActionDialog(null)} onSubmit={async target => { const dialog = actionDialog; await performOperation("review", {target}); setActionDialog(value => value === dialog ? null : value); }} />}
      {shownWhatsNew.value && <LocalReleaseNotes key={`whats-new-${shownWhatsNew.key}`} open={shownWhatsNew.open} onExited={shownWhatsNew.onExited} onClose={() => setWhatsNew(false)} />}
      {languagePicker && <SourceLanguagePicker open onClose={() => setLanguagePicker(false)} onSave={updatePreferences} />}
      {current && <SourceSideChat threadId={current} open={sideChat.open} rpc={rpc}
        contextCount={items.filter(item => item?.type === "userMessage" || item?.type === "agentMessage").length}
        pending={sideChat.pending} onPendingTaken={() => setSideChat(value => ({ ...value, pending: null }))}
        onClose={closeSideChat}
        onBranch={(text) => { setSideChat({ open: false, pending: null }); navigate(null); setDraft(text); }} />}
      {workflowLaunch&&<WorkflowLaunch initial={workflowLaunch} onClose={()=>setWorkflowLaunch(null)} onPick={()=>call('workflow-pick')} onStart={async options=>{const run=await call('workflow-start',{...options,threadId:workflowLaunch.threadId,model:workflowLaunch.model,effort:workflowLaunch.effort,cwd:workflowLaunch.cwd,permission:workflowLaunch.permission,mode:workflowLaunch.mode,after:workflowLaunch.after});setWorkflowRuns(old=>mergeWorkflow(old,run));if(currentRef.current===run.threadId)openWorkflow(run.id);}}/>}
      {onboarding && <SourceOnboarding key={onboarding} startAt={onboarding} desktopCall={call} onDone={finishOnboarding} onSkip={skipOnboarding} onCoreChosen={chooseOnboardingCore}
        signIn={signInCore?.login ? { core: signInCore, auth: boot?.auth, account: boot?.account?.account ?? null, connected: !!boot?.connected,
          onLogin: (type, extra) => call("login", { type, ...extra }), onAccountAction: p => call("account-auth", p), onOpenExternal: url => call("external", { url }).catch(() => {}),
          // Codex through a relay: setup ends and Settings › Models opens at the Codex endpoint (codexProvider), with
          // Custom endpoint chosen and the Base URL field focused (requestCodexCustomEndpoint).
          ...(coreSupports(boot?.core, "codexProvider") ? { onCustomEndpoint: () => { requestCodexCustomEndpoint(); skipOnboarding(); setSettings("models#codex-provider"); } } : {}) } : null}
        onOpenExternal={url => call("external", { url }).catch(() => {})} />}
      {<SourceSettings open={!!settings} config={{...boot?.config,...localPreferences,theme,displayName,fastMode:fastEnabled,speed}} model={model} effort={effort} permission={permission}
        boot={boot} busy={running || sending || actionPending}
        coreBusy={hasLiveWork(state) || sending || actionPending} onSave={updatePreferences} onClose={()=>setSettings(false)}
        initialSection={typeof settings === "string" ? settings : undefined} readUsage={readAccountUsageDetails} usageActions={usageActions} desktopCall={call}
        onQuickSetup={() => { setSettings(false); setOnboarding("connect"); }}
        customize={customize}
        onFolder={async()=>{const dir=await call("folder");if(dir){setBoot(b=>({...b,config:{...b.config,cwd:dir}}));setCwd(dir);navigate(null);}}}
        onReconnect={reconnect} onSwitchCore={switchCore} onLogin={(type, extra) => call("login", { type, ...extra })} onAccountAction={p=>call("account-auth",p)} onRefreshAccount={()=>call("account-auth",{operation:"refresh"})}
        onReveal={target=>call("reveal-settings",{target})} />}
      {shownConfirmDelete.value && <SourceConfirmDialog key={`confirm-delete-${shownConfirmDelete.key}`} open={shownConfirmDelete.open} onExited={shownConfirmDelete.onExited}
        {...deleteConfirmCopy([shownConfirmDelete.value], { engine: boot?.core || engine })} onClose={() => setConfirmDelete(null)}
        onConfirm={() => sessionAction("delete", shownConfirmDelete.value)} />}
      {/* Rename on the shared Dialog (source-dialog.jsx): size sm, title, the name field (initial focus) and a
          Qf footer with CDS Buttons; Escape, the backdrop and Close dismiss it. */}
      {shownRename.value && renameShown && (
        <SourceDialog key={`rename-${shownRename.key}`} open={shownRename.open} onExited={shownRename.onExited} size="sm" title={t("Rename session")}
          initialFocusRef={renameInput} onClose={() => setRename(null)} className="rename-session-dialog">
          <form
            className="rename-session-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!rename?.name.trim()) return;
              try {
                await rpc("thread/name/set", {
                  threadId: rename.id,
                  name: rename.name,
                });
                setSessions((s) =>
                  s.map((t) =>
                    t.id === rename.id ? { ...t, name: rename.name } : t,
                  ),
                );
                setRename(null);
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            <input
              ref={renameInput}
              aria-label={t("Session name")}
              value={renameShown.name}
              onChange={(e) => setRename((current) => current && { ...current, name: e.target.value })}
            />
            <SourceDialogFooter>
              <SourceSettingsButton onClick={() => setRename(null)}>{t("Cancel")}</SourceSettingsButton>
              <SourceSettingsButton type="submit" variant="primary" disabled={!renameShown.name.trim()}>{t("Save")}</SourceSettingsButton>
            </SourceDialogFooter>
          </form>
        </SourceDialog>
      )}
    </div>
  );
}
// Popped-out pane window (?popout=<sessionId>&pane=<kind>&cwd=<dir>): the same
// pane component over the same scoped IPC; approvals/events stay with the
// primary window. Plan data is pushed by the primary through popout-sync.
function PopoutApp({ sessionId, pane, cwd }) {
  const [connected, setConnected] = useState(null);
  const [error, setErrorText] = useState("");
  const setError = useCallback((value) => setErrorText(typeof value === "string" ? cleanErrorReason(value) : value), []);
  const [plan, setPlan] = useState(null);
  const [gitStatus, setGitStatus] = useState(null);
  const [gitDiff, setGitDiff] = useState(null);
  const [sessionDiff, setSessionDiff] = useState(null);
  const [gitError, setGitError] = useState("");
  const [gitDismissedKey, setGitKey] = useState(0);
  useEffect(() => {
    let live = true;
    call("init").then((boot) => {
      if (!live) return;
      setConnected(!!boot?.connected);
      if (boot?.error) setError(boot.error);
    }).catch((reason) => { if (live) { setConnected(false); setError(reason.message); } });
    const unsubscribe = api?.onEvent((event) => {
      if (event.kind === "popout-data" && event.pane === "plan") setPlan(event.data ?? null);
      if (event.kind === "popout-data" && event.pane === "changes") setSessionDiff(typeof event.data?.diff === "string" && event.data.diff ? event.data.diff : null);
      if (event.kind === "popout-refresh") setGitKey((value) => value + 1);
    });
    return () => { live = false; unsubscribe?.(); };
  }, []);
  useEffect(() => {
    if (pane !== "changes" || !cwd) return undefined;
    let live = true;
    call("workspace-git-status", { cwd, sessionId })
      .then((status) => {
        if (!live) return;
        setGitStatus(status);
      })
      .catch((reason) => { if (live) setGitError(t("Could not read repository changes: {reason}", { reason: reason.message })); });
    return () => { live = false; };
  }, [pane, cwd, sessionId, gitDismissedKey]);
  // F12: the popped-out Changes pane has its own zm diff scope (default "All changes vs {base}").
  const popoutScope = useDiffScope({ call, cwd, sessionId, status: gitStatus, active: pane === "changes", refreshKey: gitDismissedKey });
  const popoutScopeKey = JSON.stringify([popoutScope.param ?? null, popoutScope.base ?? null]);
  const popoutShownScope = useRef(null);
  useEffect(() => {
    if (pane !== "changes" || !cwd || !gitStatus?.isRepo) return undefined;
    let live = true;
    if (popoutShownScope.current !== popoutScopeKey) { popoutShownScope.current = popoutScopeKey; setGitDiff(null); }
    call("workspace-git-diff", { cwd, sessionId, completeContext: true, scope: popoutScope.param, ...(popoutScope.base ? { base: popoutScope.base } : {}) })
      .then((diff) => { if (live) setGitDiff(diff); })
      .catch((reason) => { if (live) setGitError(t("Could not read repository changes: {reason}", { reason: reason.message })); });
    return () => { live = false; };
    // gitStatus is a fresh object per status read (popout-refresh / Refresh), which re-reads the diff as before.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pane, cwd, sessionId, gitStatus, popoutScopeKey]);
  // The pane window has no preference state of its own: main sets
  // nativeTheme.themeSource from the saved theme, so this window's
  // prefers-color-scheme is the app's resolved mode and follows every change.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => { writeThemeMode(document, resolveThemeMode("system", media.matches)); };
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const dock = () => call("popout-dock", { sessionId, pane }).catch((reason) => setError(reason.message));
  // eE: the header pin toggles setPopoutAlwaysOnTop for this window; main answers with the stored value.
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const toggleAlwaysOnTop = () => call("popout-always-on-top", { value: !alwaysOnTop })
    .then((value) => setAlwaysOnTop(value === true)).catch((reason) => setError(reason.message));
  useEffect(() => { document.title = `${PANE_NAMES[pane] ?? t("Pane")} — Code Desktop`; }, [pane]);
  return (
    <div className="popout-root" data-popout-pane={pane} data-popout-session={sessionId} data-connected={connected}>
      <main className="workspace epitaxy-root cds-root popout-workspace" data-density="compact" data-platform="desktop">
        {error && <p className="source-panel-error popout-error" role="alert">{error}</p>}
        <div className="popout-tile source-side-tile">
          <FilePanel
            cwd={cwd}
            sessionId={sessionId}
            searchPane="main"
            tab={pane}
            plan={plan?.plan ?? null}
            planDocument={plan?.document ?? null}
            diff={gitStatus?.isRepo ? gitDiff : sessionDiff}
            diffScope={popoutScope.param}
            diffScopeControl={popoutScope.control}
            loading={pane === "changes" && !gitError && (gitStatus === null || (gitStatus.isRepo && gitDiff === null))}
            diffError={gitError}
            onClose={dock}
            onRefresh={() => { setGitError(""); setGitKey((value) => value + 1); }}
            paneControls={({ menuSections, leading }) => <SourcePopoutControls paneName={PANE_NAMES[pane]} menuSections={menuSections} leading={leading} onDock={dock}
              alwaysOnTop={alwaysOnTop} onToggleAlwaysOnTop={toggleAlwaysOnTop} />}
          />
        </div>
      </main>
    </div>
  );
}
const popoutQuery = new URLSearchParams(window.location.search);
const popoutSession = popoutQuery.get("popout");
createRoot(document.getElementById("root")).render(
  <SourceToastProvider>{popoutSession && PANE_KINDS.includes(popoutQuery.get("pane"))
    ? <PopoutApp sessionId={popoutSession} pane={popoutQuery.get("pane")} cwd={popoutQuery.get("cwd") || ""} />
    : <SourceSplitRoot renderSide={(side, secondary) => <App side={side} initialSession={secondary?.sessionId ?? null} />} />}</SourceToastProvider>,
);
