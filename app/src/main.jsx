import { threadPermissionParams, turnPermissionParams, approvesPlan, afterPlanPermission, approvedPlanPermission, workflowAccess } from '../electron/permission-policy.mjs';
import { useBypassPermission, SourceBypassDialog } from './source-bypass-permission.jsx';
import {SourceToastProvider, useSourceToasts} from './source-toast.jsx';
import { reportActionError, sessionActionErrorKind, ACTION_ERROR_COPY } from "./action-error-model.mjs";
import { saveConfirmedPreferences } from './preference-save.mjs';
import {WorkflowRow,WorkflowCard,WorkflowLaunch} from "./source-workflow.jsx";
import {mergeWorkflow} from "./workflow-progress-model.mjs";
import {parseWorkflowLaunch} from "./workflow-launch-model.mjs";
import {isModelWorkflow,modelWorkflowRuns,withModelWorkflowRows,workflowTask} from "./model-workflow-model.mjs";
import {SourceBackgroundTasks} from "./source-background-tasks.jsx";
import {backgroundTasks,taskSections} from "./background-tasks-model.mjs";
import { SourceTasksPane } from "./source-agent.jsx";
import { agentView } from "./agent-model.mjs";
import { groupFileTools, pathChoices } from "./file-tool-model.mjs";
import { draftWithQuote, messageItemText, quoteBlock } from "./transcript-context-menu-model.mjs";
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
import { emptyState, reduce, userText, isItemStreaming, isSubAgentThread, ownerThreadId } from "./state";
import { loadThreadHistory, historyRoute, readParams as historyReadParams, resumeParams as historyResumeParams } from "./thread-history-model.mjs";
import { Icon } from "./icons";
import { ToolButton } from "./code-ui";
import "./style.css";
import { SIDEBAR_WIDTH, clampSidebarWidth, effectiveSidebarWidth, narrowViewportQuery, storedSidebarWidth, trafficLightSpacerWidth } from "./sidebar-width-model.mjs";
import { SourceGreeting, SourceStatsCard, useHomeStartedAt } from "./source-home";
import { SourceActionCenter, SourceActionCenterPlaceholder, useSessionsLimit } from "./source-action-center";
import { classifyAttention, sortAttention, landingClear as shapeLandingClear, sessionTimestampMs } from "./home-model.mjs";
import { normalizeSidebarPreferences, sessionArchived, unreadOnTurnCompleted } from "./sidebar-model.js";
import { SourceSettings } from "./source-settings";
import { appearancePreferences, fastTierForModel } from "../electron/preferences.mjs";
import { SourceTitlebar, LocalReleaseNotes, LOCAL_RELEASE_NOTE_VERSIONS } from "./source-titlebar";
import { version as clientVersion } from "../package.json";
import { markSeenValue, readSeenVersion, whatsNewVisible, writeSeenVersion } from "./whats-new-model.mjs";
import { navAvailability } from "./source-nav-buttons";
import { SourceComposer, SourceEffortPopover, SourceUsagePopover, SourceRecentFolderMenu, SourceBranchPickerMenu } from "./source-composer";
import { recentFolders, recentFolderRows, folderPickerBrowsesDirectly } from "./recent-folders-model.mjs";
import { defaultBranch, sortBranches, branchSwitchPlan, checkedOutBranch, branchCheckoutTarget, WORKING_TREE_ERROR } from "./branch-picker-model.mjs";
import { SourceBranchSwitchDialog } from "./source-branch-switch-dialog.jsx";
import { gitRepoMenuItems } from "./git-rail-model.mjs";
import { humanPrompts } from "./prompt-history-model.mjs";
import { composerPlaceholder } from "./composer-placeholder.mjs";
import { SourceQueuedMessages } from "./source-queued-messages";
import { stageFiles, markReady, markFailed, removeAttachment, attachmentInputs, modelAcceptsImages, skillChipInput, IMAGE_PROCESS_ERROR, basename as attachmentBasename } from "./composer-attachments-model.mjs";
import { draftKey, saveDraft, takeDraft, clearDraft, mapDraftAttachments, HOME_DRAFT_KEY, browserStorage, persistDraft, readPersistedDraft, forgetDraft } from "./composer-draft-store.mjs";
import { createCustomizeStore } from "./customize-store.mjs";
import { skillInvocable, skillMenuItems, pluginMenuGroups } from "./customize-model.mjs";
import { mentionInputs } from "./mention-model.mjs";
import { emptyQueue, queueFromList, submitLane, optimisticRemove, optimisticReorder, lockEntry, unlockEntry, editableDraft, isNotSteerable, lastDequeueable } from "./queued-messages-model.mjs";
import { rpcResult } from "./rpc-error.mjs";
import { SourceModelMenu } from "./source-model-menu";
import { SourceMenu } from "./source-menu";
import { SourcePermissionMenu, PERMISSION_OPTIONS } from "./source-permission-menu";
import { SourceTileLayout } from "./source-tile-layout";
import { SourcePaneControls, SourcePopoutControls } from "./source-pane-controls";
import { createTileLayoutStore, emptySessionEntry } from "./tile-layout-store.mjs";
import { CHAT_TILE_ID, PANE_KINDS, chatOnlyLayout, fromSpec, moveTileToEdge, openPane as openPaneInLayout, rememberPaneFlex, removeTile, tileIds } from "./tile-layout-model.mjs";
import { SourceTranscript } from "./source-transcript";
import { SourceFindBar } from "./source-find-bar.jsx";
import { SourceTranscriptStatus } from "./source-transcript-status.jsx";
import { SourceTurnFooter } from "./source-turn-footer.jsx";
import { SourceTurnError } from "./source-turn-error.jsx";
import { SourceForgeRepoContext } from "./source-forge-ref.jsx";
import { forgeRepoSlug } from "./response-link-model.mjs";
import { SourceTranscriptSkeleton, SourceTranscriptLoadFailure, SourceTranscriptEmpty } from "./source-transcript-states.jsx";
import { retryInput, turnErrorPlacements } from "./turn-error-model.mjs";
import { retryingStatus } from "./transcript-status-model.mjs";
import { buildTurnCopyFooters } from "./turn-copy-model.mjs";
import { turnSecondsToMs } from "./relative-time-model.mjs";
import { useTurnFooterInteraction } from "./use-turn-footer-interaction.js";
import { createApprovalDraftRuntime, dismissQuestionPayload, visibleApprovals } from "./approval-draft-model.mjs";
import { createStopRequestTracker, stopRequestMatches } from "./stop-request-model.mjs";
import { KeyboardShortcutsDialog, SlashHelp, RewindDialog, ReviewDialog, SessionStatusDialog } from "./source-session-actions";
import { SourceDialog, SourceDialogFooter, useDialogRetention } from "./source-dialog.jsx";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { withLocalCommandRows, rewindChoices, transcriptMarkdown } from "./slash-actions-model.mjs";
import { SourceUserText } from "./source-user-text";
import { sessionCommands, parseSessionCommand, commandUnavailable, unsupportedCommand, operationPending, planCommandAction } from "./session-command-model.mjs";
import { coreEngine, partitionSessions } from "./session-engine-model.mjs";
import { sessionWork, shouldUnload } from "./session-unload-model.mjs";
import { accountIdentity, accountOrgLine, connectionMenuHeader } from "./account-label-model.mjs";
import { DEEPSEEK_KEYS_URL } from "./account-settings-model.mjs";
import { SourceGitStatus } from "./source-git-status";
import { useDiffScope } from "./source-diff-scope.jsx";
import { SourceSidebar, SourceSidebarMenu, SourceSidebarSessionMenu, SourceConfirmDialog, deleteConfirmCopy } from "./source-sidebar";
import { SourceMessage as Message, SourceApproval as Approval, SourceFilePanel as FilePanel, sessionHasThinking } from "./source-session";
import { pendingCommandItemIds } from "./command-row-model.mjs";
import { setCodeThemes } from "./code-theme-store.mjs";
import codeThemeColors from "./generated/code-theme-colors.json";
import { fileListRoute, paneShortcut, paneShortcutKind } from "./pane-shortcuts.mjs";
import { CHIN_MENU_KINDS, chinKindOfMenu, chinShortcutCommand, modeMenuDigit, resolveChinRequest } from "./chin-shortcuts.mjs";
import { SHORTCUTS_DIALOG_KEYS, globalShortcutCommand, searchShortcutAction } from "./shortcuts-dialog-model.mjs";
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
const PANE_NAMES = { files: "Files", changes: "Changes", plan: "Plan", tasks: "Background tasks" };
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
const MENU_COMMANDS = new Set(["new-session", "open-folder", "toggle-pane", "close-pane", "close-session", "reopen-closed", "open-shortcuts", "cycle-session", "open-search"]);
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
    : Promise.reject(new Error("Open Code Desktop to connect to DeepSeek."));
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
// the session responds ("Claude is working") or when the working tree is clean
// (F12: Qe isWorkingTreeDirty, not the branch stats that keep the band visible).
const COMMIT_RESPONDING_REASON = "Claude is working \u2014 wait for the turn to finish";
const COMMIT_CLEAN_REASON = "No changes to commit";
// git-status-card.js:4962-4977 xr: every Commit send failure is this danger toast.
const COMMIT_SEND_FAILED = "Message couldn\u2019t be sent. Try again.";
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
function App() {
  const [state, dispatch] = useReducer(reduce, emptyState);
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
    [error, setError] = useState(""),
    [model, setModel] = useState(""),
    [effort, setEffort] = useState("medium"),
    [mode, setMode] = useState("code"),
    [theme, setTheme] = useState(bootAppearance.theme),
    [collapsed, setCollapsed] = useState(false),
    [search, setSearch] = useState(""),
    [showSearch, setShowSearch] = useState(false),
    // Inline file-reference chips in user bubbles open the Files pane at a
    // path/line (2.2553.1 gy -> pane open); each click is a fresh request.
    [fileRequest, setFileRequest] = useState(null),
    [settings, setSettings] = useState(false),
    [localPreferences, setLocalPreferences] = useState({}),
    // Per-session transcript view overrides (official transcriptModeBySession,
    // newest-last, capped at 100); undefined means "follow the default".
    [sessionViews, setSessionViews] = useState(() => readSessionViews(localStorage)),
    [fastMode, setFastMode] = useState(false),
    [fastSaving, setFastSaving] = useState(false),
    [whatsNew, setWhatsNew] = useState(false),
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
    [history, setHistory] = useState([null]),
    [historyAt, setHistoryAt] = useState(0),
    [rename, setRename] = useState(null),
    [menu, setMenu] = useState(null),
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
    [statsAttempts, setStatsAttempts] = useState(0),
    // Remembered Action Center shape (official Kk/$i) for the loading placeholder.
    [remembered, setRemembered] = useState(null),
    [sidebarPreferences, setSidebarPreferences] = useState({}),
    [sessionMetadata, setSessionMetadata] = useState({}),
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
  const diffRefreshRequested = useRef(false);
  const bypassMode = useBypassPermission({permission, enabled: boot?.config?.allowBypassPermissions === true, mode,
    sessionKey: current, cwd, connectionKey: JSON.stringify([boot?.connected, state.approvalConnectionId, state.approvalConnectionEpoch]),
    onChange: value => preference("permission", value)});
  const effectivePermission = bypassMode.permission;
  // The last mode chosen other than Plan: an approved DeepSeek plan continues with it.
  const afterPlan = useRef("auto");
  if (effectivePermission !== "plan") afterPlan.current = effectivePermission;
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
  const effectiveCollapsed = collapsed || narrowViewport;
  // Reopen Closed Session (closed-session-model.mjs, shared-19 Wh): ids closed with ⌘W / File > Close Session.
  const [closedSessions, setClosedSessions] = useState([]);
  // Go > Back/Forward arrive as {kind:"navigate", delta} (app-menu.cjs, Cyr).
  const travelShortcutRef = useRef(null);
  const paneShortcutRef = useRef(null);
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
  function setSessions(next) {
    sessionsRef.current = typeof next === "function" ? next(sessionsRef.current) : next;
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
  const commitDisabled = !commitDirty || running;
  const commitDisabledReason = !commitDirty ? COMMIT_CLEAN_REASON : running ? COMMIT_RESPONDING_REASON : undefined;
  // F12 band hold (git-pr-slot.js:5834-5990 cm prBarHeightBySession / prBarSnapshotBySession; git-status-card.js
  // 2816-2962 Na): per session, the last status that showed the band and the band's measured height. Until the
  // revisited session's own status arrives the band renders that snapshot inert (stale), for at most 6s (im).
  // gitStatusOwner names the session the current gitStatus belongs to, so the first frame after a switch never
  // shows the previous session's live band.
  // Declared before the band hold below: bandHoldToken keys on workdir (a later declaration is a TDZ crash).
  const session = sessions.find((s) => s.id === current);
  const workdir = session?.cwd || cwd;
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
  // Failed turns (state.turnErrors): newest-of-last-turn card vs older marker.
  const turnErrorView = useMemo(() => turnErrorPlacements(items, state.turnErrors?.[current], { activeTurnId: state.active[current] }),
    [items, state.turnErrors, current, state.active]);
  const retryingNow = state.retrying?.[current];
  // {short error, attempt, maxRetries}: "Rate limited · Retrying (1/5)".
  const retryStatus = retryingNow && running && (!retryingNow.turnId || retryingNow.turnId === state.active[current])
    ? retryingStatus(retryingNow) : null;
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
    if (kind === "tasks") { const saved = agentOpeners.current.get(sessionId); const opener = saved?.element?.isConnected ? saved.element : saved?.childId ? document.querySelector(`.source-chat-tile-content [data-agent-thread-id="${CSS.escape(saved.childId)}"] .sag-trigger`) : null; opener?.focus({preventScroll:true}); agentOpeners.current.delete(sessionId); }
  }, []);
  const [taskFocus,setTaskFocus]=useState(null);
  const workflows=workflowRuns.filter(run=>run.threadId===current);
  const tasks=[...backgroundTasks(state,current,{connected:!!boot?.connected}),...[...workflows,...modelWorkflowRuns(items,current)].map(workflowTask)];
  useEffect(()=>{if(!current)return;let alive=true;call('workflow-list',{threadId:current}).then(rows=>{if(alive)setWorkflowRuns(old=>rows.reduce(mergeWorkflow,old));}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[current]);
  const openWorkflow=id=>{changeTileView({taskViews:[]});setTaskFocus('workflow:'+id);openPaneTile('tasks');};
  useEffect(()=>{if(!current||!boot?.connected)return;let live=true,timer;const id=current,connectionId=state.approvalConnectionId;const poll=async()=>{const requestId=Symbol('background-read');dispatch({type:'backgroundReadStarted',id,connectionId,requestId});try{const snapshot=await call('background-read',{threadId:id});if(live)dispatch({type:'backgroundSnapshot',id,connectionId,requestId,snapshot});}catch(e){if(live)dispatch({type:'backgroundSnapshot',id,connectionId,requestId,snapshot:{errors:[e.message],terminals:[]}});}finally{if(live)timer=setTimeout(poll,2000);}};poll();return()=>{live=false;clearTimeout(timer);};},[current,boot?.connected,state.approvalConnectionId]);
  const openBackgroundTask=itemId=>{changeTileView({taskViews:[]});setTaskFocus('bash:'+itemId);openPaneTile('tasks');};
  const stopBackgroundTask=async task=>{const expected={connectionId:state.approvalConnectionId,connectionEpoch:state.approvalConnectionEpoch};
    if(task.kind==='workflow')return isModelWorkflow(task.run)?rpc('codeDesktop/workflow/stop',{threadId:current,runId:task.run.id}):call('workflow-stop',{id:task.run.id});
    if(task.kind==='agent')await call('interrupt',{threadId:task.threadId,turnId:task.turnId,expected});
    else {const result=await call('background-terminate',{threadId:current,processId:task.processId,expected});if(!result.terminated)throw Error('The process was not terminated.');}
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
  const changeTileLayout = useCallback((next, changedKeys) => {
    const id = currentRef.current ?? HOME_TILE_KEY;
    const flexByKind = tileStore.getState().lastPaneFlexByKind;
    const remembered = rememberPaneFlex(next, changedKeys, flexByKind);
    if (remembered !== flexByKind) tileStore.setGlobal({ lastPaneFlexByKind: remembered });
    tileStore.setSession(id, { tileLayout: next });
  }, []);
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
    if (!PANE_KINDS.includes(tileId) || tileId === "tasks" || !api) return false;
    popoutTile(tileId, { x: Math.round(screen.x - 120), y: Math.round(screen.y - 14) });
    return true;
  }, [popoutTile]);
  const chatAnchor = useMemo(() => {
    const root = displayLayout.root;
    const last = root.children[root.children.length - 1];
    return root.direction === "row" && last?.kind === "tile" && last.tileId === CHAT_TILE_ID && root.children.length > 1 ? "right" : "left";
  }, [displayLayout]);
  const tileDefs = useMemo(() => [{ id: CHAT_TILE_ID, overflowMin: { width: 320, anchor: chatAnchor } }, ...PANE_KINDS.map((id) => ({ id }))], [chatAnchor]);
  useEffect(() => {
    for (const entry of popouts) if (entry.pane === "plan")
      call("popout-sync", { sessionId: entry.sessionId, pane: "plan", data: { plan: state.plans[entry.sessionId] ?? null, document: state.planDocs?.[entry.sessionId] ?? null } }).catch(() => {});
  }, [popouts, state.plans, state.planDocs]);
  const openFileRef = useCallback((ref) => {
    if (!ref || typeof ref.path !== "string") return;
    setPanel("files");
    setFileRequest({ path: ref.path, line: ref.line, endLine: ref.endLine, sequence: Date.now() + Math.random() });
  }, []);
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
    onCopy: (text) => copyWithToast(text, "Copied to clipboard."),
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
  // ju). The source adds a context snippet to the composer and schedules its focus; the local composer has no snippet
  // attachment, so the text goes into the draft as a Markdown quote after what is already there (draftWithQuote), and
  // the editor takes focus. The second argument names the caller ('transcript'; the Files pane in B11); it does not
  // change the inserted text.
  // eslint-disable-next-line no-unused-vars
  const attachQuoteToDraft = useCallback((text, source = "transcript") => {
    if (!quoteBlock(text)) return false;
    setDraft((value) => draftWithQuote(value, text));
    requestAnimationFrame(() => textarea.current?.focus());
    return true;
  }, []);
  const actionPending = operationPending(operation);
  // boot.core (main.cjs connect): engine and capabilities from initialize.
  const engine = coreEngine(boot?.core);
  const unsupportedMethods = boot?.core?.capabilities?.unsupportedMethods;
  // Plan/chat/review mode hint for the DeepSeek core (permission-policy.mjs); Codex gets none.
  const permissionHints = () => ({ hints: engine === "deepseek", afterPlan: afterPlan.current });
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
  const commandSkills = useMemo(() => customizeSnapshot.skills.skills.filter(skillInvocable)
    .map((row) => ({ name: row.skillName || row.name, description: row.description, path: row.path })), [customizeSnapshot.skills.skills]);
  // Custom slash commands (C3): <userData>/commands and <workdir>/.code-desktop/commands via custom-commands-store.mjs
  // (main custom-commands.cjs watches both folders); rows merged with built-in > project > global > skills precedence.
  const customCommandsSnapshot = useSyncExternalStore(customCommandsStore.subscribe, customCommandsStore.getSnapshot, customCommandsStore.getSnapshot);
  const customCommandsPrefs = JSON.stringify(normalizeCustomCommands(boot?.config?.customCommands));
  useEffect(() => { if (boot) customCommandsStore.load(workdir || cwd, { force: true }); }, [workdir, cwd, customCommandsPrefs, !!boot]);
  const customCommandsEntry = customCommandsSnapshot.entries[workdir || cwd || ""];
  const customCommands = useMemo(() => customCommandsEntry ? mergeCommands({ global: customCommandsEntry.global, project: customCommandsEntry.project,
    builtinIds: sessionCommands.flatMap((entry) => [entry.id, ...(entry.aliases || [])]), skillNames: commandSkills.map((skill) => skill.name) }) : [], [customCommandsEntry, commandSkills]);
  const commandContext = { current, archived:session?.archived, connected:!!boot?.connected && !state.approvalClosed,
    loading, running, sending, pending:actionPending, hasHistory:items.length > 0, unsupportedMethods, skills: commandSkills, customCommands };
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
  const efforts = chosen?.supportedReasoningEfforts || [];
  const fastTier = fastTierForModel(chosen);
  const fastEnabled = fastMode && !!fastTier;
  // Catalog inputModalities without "image" (DeepSeek's text-only models): no image staging.
  const imagesAllowed = modelAcceptsImages(chosen);
  commandContext.dynamicWorkflows = boot?.config?.dynamicWorkflows === true;
  commandContext.fastAvailable = !!fastTier;
  commandContext.effortAvailable = efforts.length > 0;
  const serviceTier = fastEnabled ? fastTier.id : "default";
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
  // running footer is withheld. The link is the request's itemId.
  const pendingApprovalItems = useMemo(() => new Set([...pendingCommandItemIds(approvals), ...approvals.filter(a => a.method === "item/fileChange/requestApproval").map(a => a.params?.itemId).filter(Boolean)]), [approvals]);
  // R07 one card at a time (cc43287c9 :31744 om → mc, :37426): only the oldest answerable
  // request mounts; the rest stay pending and their rows keep 'Needs approval' above.
  const shownApprovals = visibleApprovals(approvals);
  // R07 'Open plan' (Rse :9734-9752): the review's plan item (bridge projection
  // `plan-<exit_plan_mode call id>`, else the turn's latest plan), scrolled to and focused.
  const planItemFor = (request) => items.find((item) => request.params?.itemId && item.id === `plan-${request.params.itemId}`)
    ?? [...items].reverse().find((item) => item.type === "plan" && item.turnId === request.params?.turnId);
  function openPlanItem(itemId) {
    const row = document.querySelector(`.transcript [data-transcript-item-id="${CSS.escape(itemId)}"]`);
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
  const groups = useMemo(() => {
    const g = {};
    sessions
      .filter((s) =>
        (s.name || s.preview || "New session")
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
      .forEach((s) => {
        (g[s.cwd || cwd] ??= []).push(s);
      });
    return Object.entries(g);
  }, [sessions, search, cwd]);
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
        .catch(reason => { if (live) { setGitStatusError("Could not read repository changes: " + reason.message); setError("Could not read repository changes: " + reason.message); refreshedDiff(); } })
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
      setQueue((previous) => queueFromList(result, id, previous.threadId === id ? previous : emptyQueue(id)));
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
    if (!currentRef.current && !liveComposer.current.text && liveComposer.current.attachments.length === 0) {
      const stored = restorePersistedDraft(HOME_DRAFT_KEY);
      if (stored) { liveComposer.current = stored; setDraft(stored.text); setMentions(stored.mentions); }
    }
    return () => { window.removeEventListener("pagehide", flush); window.removeEventListener("beforeunload", flush); };
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
    const pending = [];
    setAttachments((entries) => {
      const referenced = descriptors.filter((item) => item.path);
      const clipboard = descriptors.filter((item) => !item.path);
      let next = entries, notices = [];
      const first = stageFiles(next, referenced, { imagesOnly, imagesAllowed: allowed });
      next = first.entries; notices = notices.concat(first.notices);
      for (const entry of first.added) if (entry.kind === "image") next = markReady(next, entry.id, { previewUrl: filePreviewUrl(entry.path) });
      const second = stageFiles(next, clipboard.map((item) => ({ name: item.name, size: item.size, type: item.type, previewUrl: URL.createObjectURL(item.file) })), { imagesOnly: true, imagesAllowed: allowed });
      next = second.entries; notices = notices.concat(second.notices.filter((notice) => !notices.includes(notice)));
      for (const entry of second.added) pending.push({ entry, file: clipboard.find((item) => item.name === entry.name && item.size === entry.size)?.file });
      if (notices.length) setError(notices.join("\n"));
      return next;
    });
    queueMicrotask(async () => {
      for (const { entry, file } of pending) {
        try {
          if (!file) throw new Error("Failed to process image. You can try again.");
          const bytes = new Uint8Array(await file.arrayBuffer());
          const staged = await call("attachments:stage", { name: entry.name, type: entry.mime, bytes });
          updateComposerAttachments((entries) => (entries.some((item) => item.id === entry.id) ? markReady(entries, entry.id, { path: staged.path }) : entries));
        } catch (reason) {
          // The entry leaves wherever it now lives (live or stashed); the official notice follows only while it existed.
          const known = liveComposer.current.attachments.some((item) => item.id === entry.id)
            || [...composerDrafts.current.values()].some((stash) => stash.attachments.some((item) => item.id === entry.id));
          updateComposerAttachments((entries) => markFailed(entries, entry.id).entries);
          if (known) { revokePreview(entry); setError(IMAGE_PROCESS_ERROR); }
        }
      }
    });
  }
  // Trusted files:search on the composer lane for "@" mentions (50 results,
  // superseded/cancelled requests resolve to an empty list).
  const mentionRequest = useRef(0);
  async function searchMentionFiles(query) {
    const trimmed = query.trim().slice(0, 64);
    if (!trimmed) return [];
    const root = current ? undefined : (workdir || cwd);
    if (!current && !root) return [];
    const requestId = `mention-${++mentionRequest.current}`;
    try {
      const result = await call("files:search", { pane: "composer", requestId, sessionId: current ?? null, homeWorkspace: current ? undefined : root, query: trimmed });
      return result?.error ? [] : (result?.matches || []);
    } catch { return []; }
  }
  function rememberMention(option) {
    setMentions((list) => (list.some((entry) => entry.path === option.path) ? list : [...list, { path: option.path, name: option.label }]));
  }
  // The mention chip's menu (c856385e2 Z for a ccd-files mention): Copy ▸ with the c3e58cab4 'Copied to clipboard.'
  // toast, Open in ▸ Files pane. Paths are relative to the root the '@' search ran in.
  const mentionActions = { root: workdir || cwd, onCopy: (text) => copyWithToast(text, "Copied to clipboard."), onOpen: (path) => openFileRef({ path }) };
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
      setBoot(b);
      setLocalPreferences(appearancePreferences(b.config));
      setFastMode(b.config.fastMode === true);
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
      setPermission(b.config.permission || "auto");
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
      for (const operation of b.sessionOperations || []) dispatch({event:{...operation, kind:'session-operation', connectionId:b.approvalSnapshot?.connectionId, connectionEpoch:b.approvalSnapshot?.connectionEpoch}});
      if (b.connected) await loadSessions(b);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
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
    const { active, archived, otherEngine, missing } = partitionSessions({ ids: own, results, metadata: b.config.threadMetadata || {}, archivedIds, engine: coreEngine(b.core) });
    setSessions([...active, ...archived]);
    setHiddenSessions({ otherEngine, missing });
    // Tile layouts of hidden sessions are kept for when their core is back.
    tileStore.prune([HOME_TILE_KEY, ...own, ...archivedIds]);
    sessionsLoadedRef.current = true;
    setSessionsLoaded(true);
  }
  useEffect(() => {
    const unsub = api?.onEvent((e) => {
      if(e.kind === "workflow") {setWorkflowRuns(old=>mergeWorkflow(old,e.run));return;}
      dispatch({ event: e });
      customizeStore.observe(e);
      if(e.kind === "desktop-navigate") navigate(e.threadId);
      if(e.kind === "desktop-archived") setSessions(rows=>rows.map(row=>row.id===e.threadId?{...row,archived:true}:row));
      if (e.kind === "window") setFullScreen(e.fullScreen);
      if (e.kind === "zoom-factor" && Number.isFinite(e.zoomFactor)) setZoomFactor(e.zoomFactor);
      if (e.kind === "popouts") setPopouts(Array.isArray(e.popouts) ? e.popouts : []);
      if (e.kind === "popout-docked" && typeof e.sessionId === "string") openPaneTile(e.pane, e.sessionId);
      if (e.kind === "toggle-sidebar") toggleSidebarRef.current?.();
      if (e.kind === "navigate" && (e.delta === -1 || e.delta === 1)) travelShortcutRef.current?.(e.delta);
      if (MENU_COMMANDS.has(e.kind)) menuCommandRef.current?.(e);
      // Edit ▸ Find (app-menu.cjs ISr): the transcript's find bar (source-find-bar.jsx) opens or steps.
      if (e.kind === "find-open") transcriptRef.current?.openFind?.();
      if (e.kind === "find-step") transcriptRef.current?.stepFind?.(e.forward !== false);
      if (e.kind === "open-settings") { setMenu(null); setActionDialog(null); setWhatsNew(false); setShowSearch(false); setRename(null); setSettings(true); }
      if (e.kind === "stats" && e.stats && Array.isArray(e.stats.dailyActivity)) setStatsSnapshot(e.stats);
      if (e.kind === "connection") {
        if (!e.connected) { resumed.current.clear(); childThreads.current.clear(); }
        // boot.core survives a disconnect; a (re)connect refreshes it (main.cjs connectionEvent).
        // Before init() resolves boot stays null (the catalog is still loading); init carries the fresher state.
        setBoot((b) => b && ({ ...b, connected: e.connected, ...(e.core ? { core: e.core } : {}) }));
        if (e.error) setError(e.error);
      }
      if (e.method === "thread/started" && e.params?.thread?.id && isSubAgentThread(e.params.thread)) childThreads.current.add(e.params.thread.id);
      if (e.method === "turn/completed") { refreshSession(e.params.threadId); if (e.params.threadId === currentRef.current) loadQueue(e.params.threadId); }
      // F08 (context-menu-shared.js:19421-19437 kR, sidebar-groups.js:9030-9040): a turn that completes
      // for a sidebar row other than the open session leaves it 'Unread response'; opening it clears it.
      if (e.method === "turn/completed" && unreadOnTurnCompleted({ threadId: e.params?.threadId, currentId: currentRef.current,
        knownIds: new Set(sessionsRef.current.map((thread) => thread.id)), ownerOf: (id) => childThreads.current.has(id) ? null : ownerThreadId(latestState.current, id) }))
        updateSessionMetadata(e.params.threadId, { unread: true }).catch(() => {});
      if (e.method === "thread/queue/changed" && e.params?.threadId === currentRef.current) loadQueue(e.params.threadId);
      // An early account event must not turn a null boot into a partial one: that ends modelsLoading with no
      // catalog ('Default model', disabled) while model/list is still pending. init returns both snapshots.
      if(e.kind==='account-auth')setBoot(b=>b&&({...b,auth:e.auth}));
      if(e.kind==='account-snapshot')setBoot(b=>b&&({...b,account:e.account}));
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
    if (homeLoading || !remembered || remembered.sessions === attentionRows.length) return;
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
  }, [localPreferences]);
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
        if (menu || actionDialog || rename || whatsNew || layerOpen() || !session || section !== "new") return;
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
      const chinNode = document.querySelector(".sc-chin");
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
        if (!e.repeat) changeFastMode(!fastEnabled).catch(error => setError(error.message));
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
    const work = sessionWork({ id: previous, active: state.active, approvals: state.approvals, ownerOf: (threadId) => ownerThreadId(state, threadId) });
    // turnRequested stays set after its turn ends, so it is not "in flight"; a
    // turn/start just answered is guarded by the core (running agent or inbox).
    const busy = work.active || operationPending(state.operations?.[previous]) || actionLock.current.has(previous)
      || (sending && current === previous);
    const queued = queue.threadId === previous && queue.entries.length > 0;
    if (!shouldUnload({ previous, next, engine, active: busy, pendingApproval: work.pendingApproval, queued, resumed: resumed.current })) return;
    resumed.current.delete(previous);
    rpc("thread/unsubscribe", { threadId: previous }).catch(() => {});
  }
  function navigate(id) {
    // shared-19 Rh -> Mh: opening a row (or any navigation) closes the collapsed sidebar's peek.
    closePeek();
    // Any navigation drops a pending custom-group "New session" (groupAction sets it after navigating).
    newSessionGroup.current = null;
    setSection("new");
    setMenu(null);
    setHistory((h) => [...h.slice(0, historyAt + 1), id]);
    setHistoryAt(historyAt + 1);
    openSession(id);
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
    call("navigation-state", navigation).catch(() => {});
  }, [navigation.canGoBack, navigation.canGoForward]);
  // shortcuts_modal: ⌘/ and Help > Keyboard Shortcuts (kjr) open the dialog (I = v(!0): an open one
  // stays open). The single local dialog slot is not taken from another dialog, the rename form or a confirm.
  function openShortcuts() {
    if (settings || rename || confirmDelete || (actionDialog && actionDialog.kind !== "shortcuts")) return;
    setMenu(null);
    setActionDialog((dialog) => dialog?.kind === "shortcuts" ? dialog : { kind: "shortcuts" });
  }
  // ⌘K toggles the search (command_palette) and ⇧⌘K / Go > Search… open it in search mode (sw
  // n("search")), both through searchShortcutAction (shortcuts-dialog-model.mjs). The source's palette
  // is an overlay that shows whatever the sidebar state; locally the field lives in the sidebar, so a
  // collapsed sidebar is expanded first, or the peek card floats while the viewport is narrow (the
  // stored preference stays), then the field takes focus on the next frame.
  function searchShortcut(toggle) {
    const action = searchShortcutAction({ collapsed: collapsedRef.current, narrow: narrowRef.current, showSearch, toggle });
    if (action === "close") { setShowSearch(false); return; }
    setMenu(null);
    if (action === "open-peek" || narrowRef.current) openPeek();
    else setSidebarCollapsed(false);
    setShowSearch(true);
    requestAnimationFrame(() => document.querySelector(".session-search-wrap input")?.focus());
  }
  // ⇧⌘K and Go > Search… never toggle; inert under the same overlays as ⌘[ / ⌘].
  openSearchRef.current = () => {
    if (settings || actionDialog || rename || whatsNew) return;
    searchShortcut(false);
  };
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
  menuCommandRef.current = (e) => {
    if (e.kind === "new-session") { if (!settings) navigate(null); }
    else if (e.kind === "open-folder") { if (!settings) folder(); }
    else if (e.kind === "toggle-pane") { if (e.pane === "changes" || e.pane === "files") paneShortcutRef.current?.(e.pane); }
    else if (e.kind === "close-pane") {
      if (settings || menu || actionDialog) return;
      const kind = focusedPaneKind() ?? PANE_KINDS.find((candidate) => openPanes.has(candidate));
      if (kind) closePaneTile(kind);
    }
    else if (e.kind === "close-session") { if (!(settings || menu || actionDialog || rename || whatsNew || layerOpen()) && session && section === "new") closeSessionView(); }
    else if (e.kind === "reopen-closed") { if (!(settings || actionDialog || rename || whatsNew || layerOpen())) reopenClosedSession(); }
    else if (e.kind === "open-shortcuts") openShortcuts();
    else if (e.kind === "cycle-session") { if (!(settings || actionDialog || rename || whatsNew) && (e.delta === -1 || e.delta === 1)) sessionCycler.current.step(e.delta); }
    else if (e.kind === "open-search") openSearchRef.current?.();
  };
  // View > Show/Hide Changes and Files, Close Pane and File's ⌘W item follow the renderer's pane report
  // (index.chunk-ChZ67Jhw.js cSr sessionPanes / bNr): a pane is available where its ⌘⇧D / ⌘⇧F key works
  // (paneShortcutRef) and Close Pane wherever ⌘\ has a pane to close. session.open is iwr's lSr (the
  // session view shows: ⌘W reads Close Session) and reopenClosed is cb24e6301's report ({available: true,
  // enabled: Jh}). Main rebuilds only on a change.
  const paneMenuAvailable = !!session && section === "new";
  const menuState = { panes: { changes: { enabled: paneMenuAvailable, open: openPanes.has("changes") }, files: { enabled: paneMenuAvailable && !!workdir, open: openPanes.has("files") } },
    closePane: { enabled: PANE_KINDS.some((kind) => openPanes.has(kind)) },
    session: { open: paneMenuAvailable }, reopenClosed: { available: true, enabled: hasClosedSession(closedSessions, sessionExists) } };
  const menuStateKey = JSON.stringify(menuState);
  useEffect(() => { call("menu-state", menuState).catch(() => {}); }, [menuStateKey]);
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
  function turnOptions(turnCwd) {
    return {
      model: model || null,
      serviceTier,
      effort: effort || null,
      cwd: turnCwd,
      ...turnPermissionParams({permission: effectivePermission, mode, cwd: turnCwd, additionalFolders, ...permissionHints()}),
    };
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
  async function sendCommitTurn() {
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
        input: [{ type: "text", text: COMMIT_TURN_TEXT, text_elements: [] }],
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
  async function retryFailedTurn(turnId) {
    const id = current, input = retryInput(items, turnId);
    if (!id || !input || loading || sending || running || actionPending || !boot?.connected || session?.archived) return;
    setError("");
    try {
      await ensureResumed(id);
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
    const body = chip ? chip.text : parsed?.custom ? expandCommand(parsed.custom.body, parsed.args) : text;
    const root = (turnCwd || "").replace(/\/$/, "");
    const mentioned = mentionInputs(body, mentions, { resolvePath: (relative) => (root ? `${root}/${relative}` : relative) });
    return [
      ...(chip && !body.trim() ? [] : [{ type: "text", text: body, text_elements: mentioned.text_elements }]),
      ...(additionalFolders.length ? [{ type: "text", text: "Additional workspace directories for this task:\n" + additionalFolders.join("\n"), text_elements: [] }] : []),
      ...mentioned.items,
      ...attachmentInputs(attachments),
      ...(chip ? [chip.item] : []),
    ];
  }
  // `started`: the thread a first message from Home created. Once thread/start made it current, leaving it
  // stashed the still-live draft under that id rather than under Home's key.
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
  async function sendWhileRunning(priority) {
    const id = current, turnId = state.active[id];
    if (!id || !turnId || sending || !boot?.connected || session?.archived) return;
    const text = draft, entries = attachments, sequence = loadSeq.current;
    const lane = submitLane({ running: true, priority });
    setSending(true);
    setError("");
    try {
      await dismissPendingQuestions(id); // R07 Dd: answer a waiting question first, then steer or queue.
      const input = composerInput(text, workdir || cwd);
      const clientUserMessageId = crypto.randomUUID();
      if (lane === "next") {
        const outcome = await call("steer", { threadId: id, expectedTurnId: turnId, input, clientUserMessageId });
        if (!outcome.ok) {
          if (!isNotSteerable(outcome)) throw new Error(outcome.message || "The message could not be sent to the running turn.");
          await rpc("thread/queue/add", { threadId: id, input, clientUserMessageId });
        }
      } else {
        await rpc("thread/queue/add", { threadId: id, input, clientUserMessageId });
      }
      clearComposerDraft(sequence, text, entries, id);
      loadQueue(id);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }
  async function send({ priority } = {}) {
    if (boot?.account?.deepseek && !boot.account.account) return; // R02: no DeepSeek key → no thread/turn (composer warning); the draft stays.
    // A known skill ('/pdf …', a chip from '/' or Add › Skills) parses without error and goes out as a message.
    const parsed = parseSessionCommand(draft, commandContext);
    if (parsed && !parsed.skill && !parsed.custom) {
      if (parsed.error) { setError(parsed.error); setCommandSuggestion(parsed.suggestion); return; }
      setCommandSuggestion(null);
      await executeCommand(parsed.id, parsed.args, draft);
      return;
    }
    if (actionPending) return;
    if (!(draft.trim() || attachments.length) || attachments.some((entry) => entry.status !== "ready")) return;
    if (running) { await sendWhileRunning(priority); return; }
    if (loading || sending || !boot?.connected || session?.archived) return;
    // 'Send and stay here' (cc43287c9 :35140-35200 stayOnDraft): ⌘⏎ on Home starts the session detached — no setCurrent,
    // no history entry — inserts its row and leaves an empty, focused Home composer. A second launch waits for the
    // first spawn (qc background spawn count, Jr). thread/fork (⌘⌥⏎) is unsupported on the DeepSeek core.
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
          if (toasts) toasts.add(WORKING_TREE_ERROR, { variant: "danger" }); else setError(WORKING_TREE_ERROR);
          if (stay) restoreStay();
          return;
        }
        setWorkspaceInfo((info) => (info && info.branch === checkout ? { ...info, checkedOut: checkout } : info));
      }
      if (!id) {
        const r = await rpc("thread/start", {
          cwd: turnCwd,
          model: model || null,
          serviceTier,
          ...threadPermissionParams({permission: effectivePermission, mode, ...permissionHints()}),
          // Codex only: the DeepSeek core honors developerInstructions (structured.js, for workflow agents), and its
          // persona and custom instructions come from the profile and codeDesktop.customization instead.
          ...(engine === "deepseek" ? {} : { developerInstructions:
            "You are the assistant in Code Desktop, a local desktop client powered by DeepSeek. Follow the user language. When asked for a plan, use the plan tool. Do not claim to be Claude." }),
        });
        id = r.thread.id;
        bypassMode.adoptSession(id);
        // :35161-35168 vi(a, t.split('\n')[0].slice(0, 80)): a background launch is titled from its first line.
        const name = stay ? text.split("\n")[0].slice(0, 80) : text.slice(0, 64);
        setSessions((s) => [{ ...r.thread, name }, ...s]);
        if (!stay && sendSequence === loadSeq.current) {
          setCurrent(id);
          currentRef.current = id;
          // The live draft now belongs to the new session's key: drop the stored Home copy outright (it may hold an
          // older debounced prefix that a text-guarded forget would miss) and the pending Home write.
          pendingDraftWrite.current = null;
          forgetDraft(browserStorage(), HOME_DRAFT_KEY);
          setHistory((h) => [...h, id]);
          setHistoryAt((h) => h + 1);
        }
        resumed.current.add(id);
        await rpc("thread/name/set", { threadId: id, name });
      }
      if (startedGroup && newSessionGroup.current === startedGroup) newSessionGroup.current = null;
      await updateSessionMetadata(id, { additionalFolders, ...(startedGroup && !origin ? { customGroupId: startedGroup } : {}) });
      const input = composerInput(text, turnCwd);
      await ensureResumed(id);
      if (!stay) setTurnRequested(id);
      await rpc("turn/start", { threadId: id, input, ...turnOptions(turnCwd) });
      if (stay) {
        launched = true;
        entries.forEach(revokePreview);
        forgetDraft(browserStorage(), HOME_DRAFT_KEY, { text });
      } else clearComposerDraft(sendSequence, text, entries, origin, id);
    } catch (e) {
      if (stay) { if (!launched) restoreStay(); }
      else setTurnRequested(value => value === id ? null : value);
      setError(e.message);
    } finally {
      if (stay) {
        backgroundSpawnsRef.current -= 1;
        spawnFocus.current = true;
        setBackgroundSpawns((count) => count - 1);
      } else setSending(false);
    }
  }
  async function performOperation(operation, extra = {}) {
    const id = currentRef.current, sequence = loadSeq.current;
    if (!id || actionLock.current.has(id)) throw new Error("A session action is already starting.");
    const expected = {connectionId:state.approvalConnectionId, connectionEpoch:state.approvalConnectionEpoch};
    actionLock.current.add(id);
    setError("");
    try {
      const result = await call("session-action", {operation, threadId:id, permission: effectivePermission, afterPlan: afterPlan.current, mode, expected, ...extra});
      if (operation === "fork") {
        const fork = result.thread;
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
      if (id === "compact") { await performOperation(id); clearCommand(); }
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
            const record={id:crypto.randomUUID(),after:items.at(-1)?.id,session,model:chosen?.displayName||model,effort,serviceTier:fastEnabled?fastTier.name:"Standard",permission:effectivePermission,cwd:workdir,usage:state.usage[current],connected:!!boot?.connected,running,operation,account:boot?.account};
            setLocalCommandRows(value=>({...value,[current]:[...(value[current]||[]),record]}));break;
          }
          case "help": setActionDialog({kind:"help"}); break;
          case "clear": navigate(null); break;
          case "resume": setSearch(args); setShowSearch(true); break;
          case "config": setSettings("code"); break;
          case "usage": setSettings("usage"); break;
          case "sandbox": setSettings("code"); break;
          case "theme": {
            // cc43287c9 zI: auto is system; no or an unknown argument opens the picker.
            const parsed=parseThemeCommand(args);
            if(parsed.open){setSettings("preferences");break;}
            // :33700-33716 addSuccess('Appearance set to …') → a neutral toast.
            await updatePreferences({theme:parsed.set});notice('Appearance set to '+THEME_LABELS[parsed.set],{variant:'neutral'});break;
          }
          case "skills": setSettings("customize-skills"); break;
          case "mcp": setSettings("customize-connectors"); break;
          case "plugin": setSettings("customize-plugins"); break;
          case "fast": {
            if(args&&!["on","off"].includes(args.toLowerCase()))throw new Error("Use /fast, /fast on, or /fast off.");
            const next=args?args.toLowerCase()==="on":!fastEnabled;
            // :11310-11322 addWarning(…, {uniqueKey:'epitaxy-fast-command-notice'}).
            if(next===fastEnabled)notice(`Fast mode is already ${next?'on':'off'}.`,{variant:'warning',key:'epitaxy-fast-command-notice'});else await changeFastMode(next);break;
          }
          case "model": {
            if(!args){setMenu({kind:"model",anchor:document.querySelector('.sc-model-trigger')});break;}
            const next=models.find(m=>m.model===args||m.id===args);if(!next)throw new Error(`“${args}” isn’t an available model.`);
            await updatePreferences({model:next.model,effort:next.defaultReasoningEffort});break;
          }
          case "effort":
            // /effort alone opens the effort popover on its chip (the model pill when the chip is absent).
            if(!args){setMenu({kind:"effort",anchor:document.querySelector('.sc-chin .sc-effort-trigger')||document.querySelector('.sc-model-trigger'),token:++menuToken.current});break;}
            if(!efforts.some(e=>e.reasoningEffort===args))throw new Error(`“${args}” isn’t an available effort level.`);
            await updatePreferences({effort:args});break;
          case "permissions": setMenu({kind:"permission",anchor:document.querySelector('.sc-permission')}); break;
          case "plan": {
            // :33830-33880 → vG (planCommandAction): Plan is always in the local Mode menu; hasPlan (rS) is a written
            // plan, and the pane opens (yG) unless it already shows.
            const plan=planCommandAction({arg:args,currentMode:effectivePermission,hasPlan:!!(state.plans[current]?.length||state.planDocs?.[current]),canOpenPane:!!current,paneAlreadyOpen:openPanes.has('plan')});
            if(plan.switchToPlan)await updatePreferences({permission:'plan'});
            if(plan.openPane)setPanel('plan');
            // :33860-33877 addWarning(…, {uniqueKey:'epitaxy-plan-command-notice'}).
            if(plan.notice)notice(plan.notice==='already_in_plan_no_plan'?'Already in plan mode. No plan written yet.':'Already in plan mode.',{variant:'warning',key:'epitaxy-plan-command-notice'});
            if(plan.composerText!==null)setDraft(plan.composerText);break;
          }
          case "diff": togglePaneTile("changes"); break;
          case "tasks": togglePaneTile("tasks"); break;
          case "workflows": changeTileView({taskViews:[]});openPaneTile('tasks');break;
          case "workflow": setWorkflowLaunch({...parseWorkflowLaunch(args),threadId:current,cwd:workdir,model,effort,permission:effectivePermission,mode,access:workflowAccess({permission:effectivePermission,mode}),after:items.at(-1)?.id});break;
          case "rename":
            if(args){if(!await renameSession(current,args))return;}else setRename({id:current,name:session?.name||session?.preview||""});break;
          case "add-dir": {
            const dir=await call('folder',{additional:true,...(args?{path:args,cwd:workdir}:{})});
            if(dir&&sequence===loadSeq.current){const next=[...new Set([...additionalFolders,dir])];setAdditionalFolders(next);if(current)await updateSessionMetadata(current,{additionalFolders:next});}break;
          }
          case "export": {
            const full=await readFullHistory(current);
            if(full.truncated||full.unavailable)throw new Error('Conversation history is incomplete. Export was not saved.');
            await call('slash-export',{threadId:current,markdown:transcriptMarkdown(full.thread,full.turns)});break;
          }
          case "rewind": {
            const full=await readFullHistory(current);
            if(full.thread.historyMode!=='paginated')throw new Error('Rewind is not available for legacy sessions.');
            if(sequence===loadSeq.current)setActionDialog({kind:'rewind',threadId:current,turns:rewindChoices(full.turns)});break;
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
  async function rewindConversation(beforeTurnId) {
    const id=actionDialog.threadId,sequence=loadSeq.current,baselineItems=state.items[actionDialog.threadId],baselineActiveVersion=state.activeVersions?.[actionDialog.threadId];
    const result=await call('slash-rewind',{threadId:id,beforeTurnId,expected:{connectionId:state.approvalConnectionId,connectionEpoch:state.approvalConnectionEpoch}});
    const history=await loadThreadHistory(rpc,{threadId:id,thread:result.thread,route:historyRoute(result.thread)});
    if(history.truncated||history.unavailable)throw new Error('Rewind succeeded, but retained history could not be fully loaded. Reopen the session.');
    dispatch({type:'hydrate',id,thread:{...result.thread,turns:history.turns},replaceHistory:true,baselineItems,baselineActiveVersion});
    setLocalCommandRows(rows=>({...rows,[id]:[]}));
    if(sequence===loadSeq.current){setDraft(actionDialog.turns.find(t=>t.id===beforeTurnId)?.text||'');setActionDialog(null);}
  }
  async function readSessionStatus() {
    if (!boot?.connected) return {error:"Reconnect to load account usage limits."};
    const [account, limits] = await Promise.allSettled([rpc("account/read", {refreshToken:false}), rpc("account/rateLimits/read")]);
    return {account:account.status === "fulfilled" ? account.value : null, limits:limits.status === "fulfilled" ? limits.value : null,
      error:[account,limits].filter(result => result.status === "rejected").map(result => result.reason.message).join("\n")};
  }
  async function readAccountUsageDetails() {
    const data = await readSessionStatus();
    // Quota is required for this page. A failed RPC must reach SourceUsage's
    // failed-refresh path, rather than replacing its last snapshot with null.
    // A successful empty limits object remains a valid, unavailable snapshot.
    if (data.limits == null) throw new Error(data.error || "Usage limits are unavailable for this account or connection.");
    try { data.tokenUsage = await rpc("account/usage/read", {}); }
    catch (error) { data.tokenUsageError = error.message; }
    return data;
  }
  function updateSidebarPreferences(next) {
    setSidebarPreferences(next);
    call("settings", { sidebarPreferences: next }).catch(actionFailed("save-preference"));
  }
  function applySidebarState(result) {
    if (result.revision < sidebarRevision.current) return;
    sidebarRevision.current = result.revision;
    setSessionMetadata(result.sessionMetadata);
    setCustomGroups(result.customGroups);
    setSidebarPreferences(result.sidebarPreferences);
    if (Array.isArray(result.pinnedOrder)) setPinnedOrder(result.pinnedOrder);
    if (Array.isArray(result.projectOrder)) setProjectOrder(result.projectOrder);
  }
  async function updateSessionMetadata(id, patch) {
    applySidebarState(await call("sidebar-state", { operation: "metadata", id, patch }));
  }
  async function sessionAction(action, target, payload = {}) {
    switch (action) {
      case "rename":
        if (!await renameSession(target.id, payload.name)) throw new Error(ACTION_ERROR_COPY.rename);
        return;
      case "archive":
      case "unarchive": {
        if (state.active[target.id] || operationPending(state.operations?.[target.id]) || actionLock.current.has(target.id)) throw new Error("Stop the running task before archiving it.");
        const result = await rpc("thread/" + action, { threadId: target.id });
        if (action === "archive") resumed.current.delete(target.id);
        setSessions(list => list.map(thread => thread.id === target.id ? { ...thread, ...result.thread, archived: action === "archive" } : thread));
        // ⌘⇧⌫ (source-sidebar.jsx, shared-19 rg) opens the neighbouring row itself (keepView).
        if (action === "archive" && currentRef.current === target.id && !payload.keepView) navigate(null);
        return;
      }
      case "delete": {
        // Protocol thread/delete; main.cjs refuses running/pending sessions and
        // drops the id from every config list. Callers confirm before calling.
        if (state.active[target.id] || operationPending(state.operations?.[target.id]) || actionLock.current.has(target.id)) throw new Error("Stop the running task before deleting it.");
        await rpc("thread/delete", { threadId: target.id });
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
        if (actionLock.current.has(target.id)) throw new Error("A session action is already starting.");
        const expected = { connectionId: state.approvalConnectionId, connectionEpoch: state.approvalConnectionEpoch };
        actionLock.current.add(target.id);
        try {
          const result = await call("session-action", { operation: "fork", threadId: target.id, permission: bypassMode.forSession(target.id, target.cwd), afterPlan: afterPlan.current, mode, expected });
          const fork = result.thread;
          setSessionMetadata(value => ({ ...value, [fork.id]: result.sessionMetadata }));
          setSessions(value => [fork, ...value.filter(thread => thread.id !== fork.id)]);
          if (result.warning) setError(result.warning);
          return result;
        } finally { actionLock.current.delete(target.id); }
      }
      case "open-terminal": return call("open-terminal", { cwd: target.cwd });
      case "pinned-order": return applySidebarState(await call("sidebar-state", { operation: "pinned-order", ids: payload.ids }));
      case "reveal-folder": return call("reveal-folder", { cwd: target.cwd });
      case "pin": return updateSessionMetadata(target.id, { pinned: true });
      case "unpin": return updateSessionMetadata(target.id, { pinned: false });
      case "mark-read": return updateSessionMetadata(target.id, { unread: false });
      case "mark-unread": return updateSessionMetadata(target.id, { unread: true });
      case "move-to-group": return updateSessionMetadata(target.id, { customGroupId: payload.groupId });
      default: throw new Error("Unsupported session action.");
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
    setFastMode(saved.fastMode === true);
    for (const key of ["theme","model","effort","mode","displayName","permission"]) {
      const setters = {theme:setTheme,model:setModel,effort:setEffort,mode:setMode,displayName:setDisplayName,permission:setPermission};
      if (saved[key] !== undefined && (key !== "model" || saved[key])) setters[key](saved[key]);
    }
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
  // An approved DeepSeek plan review leaves Plan, as the source plan card's
  // accept changes the mode (approval-current.js Rse → onModeChange). The core
  // already continues the turn that way; the next turn must not go out as Plan.
  // R07: the plan card names its target (codeDesktop.afterPlan: Accept → Manual, the
  // primary → the mode used before Plan), as Rse's accept passes targetMode.
  async function respondApproval(request, payload) {
    const outcome = await call("respond", payload);
    const next = approvedPlanPermission(request, payload, afterPlan.current);
    if (outcome?.ok === true && engine === "deepseek" && effectivePermission === "plan" && next)
      bypassMode.select(next);
    return outcome;
  }
  async function changeFastMode(value) {
    if (fastSaving) return;
    setFastSaving(true);
    try { await updatePreferences({model, fastMode:value}); }
    finally { setFastSaving(false); }
  }
  async function reconnect() {
    const navigation = loadSeq.current;
    const target = currentRef.current;
    setLoading(true);
    resumed.current.clear();
    try {
      const b = await call("reconnect");
      if (b.approvalSnapshot)
        dispatch({ event: { ...b.approvalSnapshot, kind: "approval-snapshot" } });
      setBoot(b);
      const selected = b.models?.find(item => item.model === modelRef.current)
        || b.models?.find(item => item.isDefault) || b.models?.[0];
      setModel(selected?.model || "");
      setEffort(value => selected?.supportedReasoningEfforts?.some(item => item.reasoningEffort === value)
        ? value : selected?.defaultReasoningEffort || "medium");
      setError(b.warnings?.join("\n") || "");
      // A launch without Codex never read the session list; the first
      // successful reconnect does, so the home can leave its placeholder.
      if (b.connected && !sessionsLoadedRef.current) await loadSessions(b);
      if (navigation === loadSeq.current && target === currentRef.current && target) await openSession(target);
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
    items: skillMenuItems(customizeSnapshot.skills.skills.filter((row) => !row.pluginId)),
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
  useEffect(() => {
    if (menu?.kind !== "add") return;
    customizeStore.loadSkills({ cwd: workdir || cwd });
    customizeStore.loadPlugins({ cwd: workdir || cwd });
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
  const accountLines = accountIdentity(displayName, boot?.account);
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
      <SourceMenu.SubmenuTrigger label="Transcript view">Transcript view</SourceMenu.SubmenuTrigger>
      <SourceMenu.Popup label="Transcript view">
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
            <SourceMenu.Item checked checkedRole="radio">Local</SourceMenu.Item>
            <SourceMenu.Separator />
            <SourceMenu.Item onClick={() => setSettings(true)}>Environment settings</SourceMenu.Item>
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
            <SourceMenu.GroupLabel>Working directory</SourceMenu.GroupLabel>
            {gitRepoMenuItems({ openFolder: true, copyPath: true }).map((item) => <React.Fragment key={item.label}>
              {item.separatorBefore && <SourceMenu.Separator />}
              <SourceMenu.Item onClick={() => item.label === "Copy path"
                ? copyWithToast(workdir, "Path copied to clipboard.")
                : call("reveal-folder", { cwd: workdir }).catch(e => setError(e.message))}>{item.label}</SourceMenu.Item>
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
            <SourceMenu.Item icon="Attachment" onClick={attach}>Add files or photos</SourceMenu.Item>
            <SourceMenu.Item icon="Folder" onClick={folder}>Add folder</SourceMenu.Item>
            <SourceMenu.Item icon="SlashShortcutCommand" onClick={() => { setDraft(d=>d.startsWith('/')?d:'/'+d); textarea.current?.focus(); textarea.current?.dispatchEvent(new Event('open-slash')); }}>Slash commands</SourceMenu.Item>
            {/* jy (:9309-9338) returns null when it has no skill rows: there is
                no "loading"/"empty" row in the Skills submenu, the entry is
                simply absent until skills/list answers. */}
            {addSkills.items.length > 0 && (
              <SourceMenu.Submenu>
                <SourceMenu.SubmenuTrigger icon="Scroll" data-testid="add-skills">Skills</SourceMenu.SubmenuTrigger>
                <SourceMenu.Popup label="Skills" className="add-skills-popup">
                  {addSkills.items.map((item) => <SourceMenu.SkillItem key={item.path} item={item} onSelect={applySkill} />)}
                  <SourceMenu.Separator />
                  <SourceMenu.Item icon="Tool" onClick={() => setSettings("customize-skills")}>Manage skills</SourceMenu.Item>
                </SourceMenu.Popup>
              </SourceMenu.Submenu>
            )}
            {/* Bv (:8881-8925): {type:"loading"} is the c752b32f8 Q skeleton
                row (h-control, 20x20 + 96x16, no text). The official empty
                state is an "Add plugins" button that opens the claude.ai
                Directory; Codex has no such install path, so — like Bv's
                arePluginsAvailable === false branch — nothing is drawn. */}
            {addPlugins.loading
              ? <div className="smenu-skeleton-row" data-add-loading="">
                  <span className="smenu-skeleton" style={{ width: 20, height: 20 }} />
                  <span aria-hidden="true" className="smenu-skeleton" style={{ width: 96, height: 16 }} />
                </div>
              : addPlugins.groups.length > 0 && (
                <SourceMenu.Submenu>
                  <SourceMenu.SubmenuTrigger icon="Plugin" data-testid="add-plugins">Plugins</SourceMenu.SubmenuTrigger>
                  <SourceMenu.Popup label="Plugins" className="add-plugins-popup">
                    {addPlugins.groups.map((group) => (
                      <SourceMenu.Submenu key={group.id}>
                        <SourceMenu.SubmenuTrigger icon="Plugin" data-plugin-id={group.id}>{group.label}</SourceMenu.SubmenuTrigger>
                        <SourceMenu.Popup label={group.label} className="add-plugin-skills-popup">
                          {group.items.map((item) => <SourceMenu.SkillItem key={item.path} item={item} onSelect={applySkill} />)}
                        </SourceMenu.Popup>
                      </SourceMenu.Submenu>
                    ))}
                    <SourceMenu.Separator />
                    <SourceMenu.Item icon="Tool" onClick={() => setSettings("customize-plugins")}>Manage plugins</SourceMenu.Item>
                  </SourceMenu.Popup>
                </SourceMenu.Submenu>
              )}
          </>
        );
      case "titlebar":
        return <>
          {/* panes-toggle-current.js:3236-3253: only Files carries a shortcut (F("toggleBrowser") = aR cmd+shift+f). */}
          {[{kind: "files", label: "Files", icon: "Folder", shortcut: "cmd+shift+f"},
            ...((state.plans[current]?.length || state.planDocs?.[current] || openPanes.has("plan")) ? [{kind: "plan", label: "Plan", icon: "Checklist"}] : []),
            ...((tasks.length||openPanes.has("tasks"))?[{kind:"tasks",label:"Background tasks",icon:"AgentsSimple"}]:[])]
            .map(item => <SourceMenu.Item key={item.kind} className="st-view-item" icon={item.icon} checked={openPanes.has(item.kind)} shortcut={item.shortcut}
              onClick={() => togglePaneTile(item.kind)}>{item.label}</SourceMenu.Item>)}
          <SourceMenu.Separator />
          {transcriptViewSubmenu(menu.data?.id)}
          <SourceMenu.Separator />
          {sessionCommands.filter(command => ["compact","fork","review","status"].includes(command.id)).map(command => {
            const reason = commandUnavailable(command, commandContext);
            return <SourceMenu.Item key={command.id} icon={command.icon} disabled={!!reason} disabledReason={reason || undefined}
              onClick={() => executeCommand(command.id)}>{command.label}</SourceMenu.Item>;
          })}
          <SourceMenu.Separator />
          <SourceSidebarSessionMenu session={menu.data} metadata={sessionMetadata[menu.data.id]} customGroups={customGroups} state={state}
            onAction={(...args) => sessionAction(...args).catch(actionFailed(sessionActionErrorKind(args[0])))} onClose={closeMenu}
            onDelete={() => setConfirmDelete(menu.data)}
            onRename={() => setRename({ id: menu.data.id, name: menu.data.name || menu.data.preview || "" })} />
        </>;
      case "session":
        return <>
          {transcriptViewSubmenu(menu.data?.id)}
          <SourceMenu.Separator />
          <SourceSidebarSessionMenu session={menu.data} metadata={sessionMetadata[menu.data.id]} customGroups={customGroups} state={state}
            onAction={(...args) => sessionAction(...args).catch(actionFailed(sessionActionErrorKind(args[0])))} onClose={closeMenu}
            onDelete={() => setConfirmDelete(menu.data)}
            onRename={() => setRename({ id: menu.data.id, name: menu.data.name || menu.data.preview || "" })} />
        </>;
      case "account":
        // sidebar-rows.js:16155-16432 $B (J.Popup side top, pw's w-[17rem]): tV Header (IO identity, then
        // "org · secondary" only when there is an org line), Settings, Usage (uV), then the Language and
        // Inference configuration slots (:16222-16241), here the retained local appearance toggle and,
        // on the DeepSeek core, the key row (Settings › Preferences › DeepSeek account). After the
        // separator: View changelog (Scroll, :16345-16354) reopens the What's new notes, and Learn more
        // (Info, min-w-[208px], :16356-16432) ends with Keyboard shortcuts ⌘/ (:16424-16431). Its
        // About / Usage policy / Privacy / Terms links are omitted: this project holds no DeepSeek URL
        // for them. No Sign out: this client has no logout capability.
        return (
          <>
            <SourceMenu.Header className="account-menu-header">
              <span className="smenu-header-line" data-testid="user-menu-header">{accountLines.identity}</span>
              {accountLines.orgPrimary && <span className="smenu-header-line smenu-header-secondary" data-testid="user-menu-header-org">{accountOrgLine(accountLines)}</span>}
            </SourceMenu.Header>
            <SourceMenu.Item icon="Settings" shortcut="cmd+," data-testid="user-menu-settings" onClick={() => setSettings(true)}>Settings</SourceMenu.Item>
            {/* sidebar-rows.js:16769-16793 uV (claudified_usage_page_pace treatment): Usage, right after Settings,
                opens the nav-hidden Usage section in the stacked Settings dialog (fidelity F14). */}
            <SourceMenu.Item icon="UsageGaugeMiddle" data-testid="user-menu-usage" onClick={() => setSettings("usage")}>Usage</SourceMenu.Item>
            <SourceMenu.Item icon={theme === "dark" ? "Sun" : "Moon"} onClick={() => preference("theme", theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? "Light appearance" : "Dark appearance"}
            </SourceMenu.Item>
            {boot?.account?.deepseek && <SourceMenu.Item icon="Key" data-testid="user-menu-deepseek-key" onClick={() => setSettings("preferences")}>DeepSeek API key</SourceMenu.Item>}
            <SourceMenu.Separator />
            <SourceMenu.Item icon="Scroll" onClick={() => setWhatsNew(true)}>View changelog</SourceMenu.Item>
            <SourceMenu.Submenu>
              <SourceMenu.SubmenuTrigger icon="Info">Learn more</SourceMenu.SubmenuTrigger>
              <SourceMenu.Popup label="Learn more" className="account-learn-more">
                {/* shared-21-D098Wd--.js:16424-16431: J.Item {shortcut: Mn("shortcuts_modal").shortcutString} → ⌘/, no icon. */}
                <SourceMenu.Item shortcut={SHORTCUTS_DIALOG_KEYS} onClick={()=>setActionDialog({kind:"shortcuts"})}>Keyboard shortcuts</SourceMenu.Item>
              </SourceMenu.Popup>
            </SourceMenu.Submenu>
          </>
        );
      case "connection":
        // Sidebar footer connection settings (local): a Header naming the running core and its state, then Items.
        return (
          <>
            <SourceMenu.Header>{connectionMenuHeader(engine, !!boot?.connected)}</SourceMenu.Header>
            <SourceMenu.Item icon="ArrowClockwise" onClick={reconnect}>Reconnect</SourceMenu.Item>
            <SourceMenu.Item icon="Settings" onClick={() => setSettings(true)}>Settings</SourceMenu.Item>
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
  const transcriptActions = {
    cwd: workdir || cwd,
    resolveMessage: (itemId) => messageItemText(items.find((item) => item.id === itemId)),
    onAttachText: composerAttachable ? (text) => attachQuoteToDraft(text, "transcript") : null,
    onAttachFile: composerAttachable ? attachFilePath : null,
    onOpenFile: openFileRef,
    onRevealFile: current ? (absolute) => call("reveal-tool-file", { sessionId: current, path: absolute }).catch(actionFailed("reveal-file")) : null,
    onCopyPath: (text) => { if (text) copyWithToast(text, "Copied to clipboard."); },
    onOpenLink: (href) => { call("external", { url: href }).catch(actionFailed("open-link")); },
  };
  // Files pane tree-row and tab menus (file-context-menu-model.mjs, Mn): Attach as context through the same
  // path attachment as the Changes header and the transcript, Show in Finder through the session-scoped reveal IPC.
  const filePaneActions = { onAttachFile: transcriptActions.onAttachFile, onRevealFile: transcriptActions.onRevealFile };
  const shownRows =groupFileTools(withLocalCommandRows(withModelWorkflowRows(items),[...(localCommandRows[current]||[]),...workflows.map(run=>({id:"local-workflow:"+run.id,after:run.after,workflowRun:run}))]),transcriptView);
  shownRowCount.current = { id: current, count: shownRows.length };
  // approval-entry-current.js:4211-4233: xu (load failure) and Cl ("No messages
  // yet") replace the whole transcript scroller, so no status row is drawn with them.
  const emptyPane = current && !loading && shownRows.length === 0
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
        "desktop-app dframe-root " + (effectiveCollapsed ? "sidebar-collapsed" : "")
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
      <SourceSidebar
        repoIdentities={repoIdentities}
        projectOrder={projectOrder}
        peekOpen={effectiveCollapsed && peek.hovering}
        onPeekEnter={peekEnter}
        onPeekLeave={peekLeave}
        sessions={sessions}
        sidebarPreferences={sidebarPreferences}
        onSidebarPreferencesChange={updateSidebarPreferences}
        sessionMetadata={sessionMetadata}
        customGroups={customGroups}
        pinnedOrder={pinnedOrder}
        knownFolders={groups.map(([dir]) => dir)}
        fallbackCwd={cwd}
        loading={!boot}
        onSessionAction={sessionAction}
        engine={engine}
        hiddenSessions={hiddenSessions}
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
        onMode={(m) => preference("mode", m)}
        onNew={() => navigate(null)}
        groups={groups}
        current={current}
        state={state}
        onOpen={navigate}
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
        showSearch={showSearch}
        setShowSearch={setShowSearch}
        onFolder={folder}
        sidebarWidth={sidebarWidth}
        setSidebarWidth={saveWidth}
        sidebarFloor={sidebarFloor}
        onSidebarFloor={setSidebarFloor}
        fullScreen={fullScreen}
        trafficLightSpacer={trafficLightSpacer}
        cdsFont={cdsFont}
        section={section}
        setSection={setSection}
      />
      <main
        className="workspace epitaxy-root cds-root"
        data-density={themeDensity(boot?.config)}
        data-font={cdsFont}
        data-platform="desktop"
      >
        <SourceTileLayout layout={displayLayout} onLayoutChange={changeTileLayout} tiles={tileDefs} hasPane={hasPane} onTileTearOff={tearOffTile}
          renderTile={(tileId, tileApi) => tileId === "tasks" ? (
            <SourceTasksPane transcriptView={transcriptView} state={state} sessionId={current} views={tileEntry?.taskViews || []} background={<SourceBackgroundTasks key={current} tasks={tasks} sessionId={current} renderWorkflow={task=><WorkflowCard run={task.run} onStop={()=>stopBackgroundTask(task)}/>} onOpen={openAgent} onStop={stopBackgroundTask} focusTask={taskFocus} onFocusDone={()=>setTaskFocus(null)} error={state.background?.[current]?.error} finishedExpanded={tileEntry?.finishedExpanded||false} onFinishedExpanded={value=>changeTileView({finishedExpanded:value})}/>} onOpen={openAgent} onLoad={loadAgent}
              onBack={() => changeTileView({taskViews:(tileEntry?.taskViews || []).slice(0,-1)})} onClose={() => closePaneTile("tasks")}
              headerCenter={tileApi.dragHandle} controls={<SourcePaneControls tileId="tasks" paneName="Background tasks" layout={baseTileLayout(tileEntry)} expanded={expandedTile === "tasks"}
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
              diff={gitStatus?.isRepo ? gitDiff : state.diffs[current]}
              diffScope={diffScope.param}
              diffScopeControl={tileId === "changes" ? diffScope.control : null}
              loading={tileId === "changes" && !!current && !gitStatusError && (gitStatus === null || gitStatus.isRepo && gitDiff === null)}
              diffError={gitStatusError || gitDiffError}
              onClose={() => closePaneTile(tileId)}
              onRefresh={refreshChanges}
              openRequest={tileId === "files" ? fileRequest : null}
              onOpenRequestHandled={consumeFileRequest}
              diffFileActions={tileId === "changes" ? diffFileActions : null}
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
              session={session} panes={openPanes} onTogglePane={togglePaneTile} onMenu={openMenu} menuKind={menu?.kind} loading={loading}
              onRename={renameSession} onWhatsNew={() => setWhatsNew(true)}
              showWhatsNew={whatsNewVisible({ version: clientVersion, hasNotes: whatsNewHasNotes, seen: whatsNewSeen, open: whatsNew })}
              historyAt={historyAt} historyLength={history.length} travel={travel}
              changesDirty={!!(gitStatus?.isRepo && gitStatus.hasChanges)} />
            <div className="source-chat-body">
          <div className="conversation">
            {section === "new" ? (
              <>
                {/* sidebar-main.js:20491: ZB is app-level, outside the per-session
                    transcript, so a session switch keeps the bar and its query and
                    recounts against the new transcript (scope and reveal are read
                    through transcriptRef at call time). */}
                <SourceFindBar ref={findBarRef} sessionKey={current ?? "draft"}
                  getScope={() => transcriptRef.current?.getContent?.()}
                  scroll={{ reveal: (rect) => transcriptRef.current?.reveal?.(rect) ?? false }} />
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
                            <span className="connection-card-title">Add your DeepSeek API key</span>
                            <span className="connection-card-body">Save a key in DeepSeek Harness (~/.dsh) or set DEEPSEEK_API_KEY, then refresh.</span>
                          </div>
                          <div className="connection-card-actions">
                            <SourceSettingsButton size="sm" onClick={() => call("account-auth", { operation: "refresh" }).catch((e) => setError(e.message))}>Refresh</SourceSettingsButton>
                            <SourceSettingsButton size="sm" variant="primary" onClick={() => call("external", { url: DEEPSEEK_KEYS_URL }).catch((e) => setError(e.message))}>Get an API key</SourceSettingsButton>
                          </div>
                        </div>
                      )}
                      {/* The Codex core's ChatGPT sign-in; the DeepSeek core never asks for it. */}
                      {boot?.connected &&
                        boot.account?.requiresOpenaiAuth &&
                        !boot.account?.deepseek &&
                        !boot.account?.account && (
                          <div className="sh-card is-outline connection-card">
                            <div className="connection-card-copy">
                              <span className="connection-card-title">Sign in to Codex</span>
                              <span className="connection-card-body">Continue with your ChatGPT account.</span>
                            </div>
                            <div className="connection-card-actions">
                              <SourceSettingsButton size="sm" variant="primary" onClick={() => call("login").catch((e) => setError(e.message))}>Sign in</SourceSettingsButton>
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                  {/* transcriptLinks (scroll-messages-current.js:56305-56309) with the session repo slug En()
                      for the GitHub reference chips (source-forge-ref.jsx). */}
                  <SourceForgeRepoContext.Provider value={forgeRepoSlug(repoIdentities[workdir])}>
                  {shownRows.map((item, index, displayedItems) => {
                    // A /workflow run's local row; a model-started run (model-workflow-model.mjs) is a turn row below.
                    if(item.workflowRun&&!item.turnId)return <WorkflowRow key={item.id} run={item.workflowRun} onOpen={()=>openWorkflow(item.workflowRun.id)}/>;
                    if(item.localCommand)return <div key={item.id} data-local-command="status"><div className="source-user-bubble"><SourceUserText text="/status" nonInteractive/></div><SessionStatusDialog {...item} inline readStatus={readSessionStatus} onClose={()=>setLocalCommandRows(rows=>({...rows,[current]:(rows[current]||[]).filter(row=>row.id!==item.id)}))}/></div>;
                    const footer = turnFooters.get(item.toolGroup?.at(-1)?.id || item.id);
                    return <React.Fragment key={`${current}:${item.id}`}>
                      {item.workflowRun ? <WorkflowRow run={item.workflowRun} onOpen={()=>openWorkflow(item.workflowRun.id)}/> :
                      <Message item={item} isInterrupting={stopping} agentContext={{state,onOpen:openAgent,onTask:openBackgroundTask}} sessionKey={current} isStreaming={isItemStreaming(state, current, item)} turnStart={!!item.turnId && item.turnId !== displayedItems[index - 1]?.turnId}
                        cwd={workdir} onOpenFileRef={openFileRef} onOpenChanges={() => { if (!gitStatus?.isRepo && !state.diffs[current]) return false; setPanel("changes"); return true; }} transcriptView={transcriptView} pendingApprovalItemIds={pendingApprovalItems}
                        turnStartedAtMs={item.type === "userMessage" ? turnSecondsToMs(state.turnTimes?.[current]?.[item.turnId]?.startedAt) : null}
                        reasoningPlacement={item.type === "reasoning" ? reasoningPlacement(displayedItems, index, transcriptView) : undefined} />}
                      {footer && <SourceTurnFooter sessionKey={current} turnId={footer.turnId}
                        text={footer.text} completedAtMs={turnSecondsToMs(state.turnTimes?.[current]?.[footer.turnId]?.completedAt)} {...turnInteraction.forTurn(footer.turnId)} />}
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
                          onCompact={canCompact ? () => performOperation("compact").catch((e) => { if (toasts) toasts.add(e.message, { variant: "warning" }); else setError(e.message); }) : undefined} />;
                      })()}
                    </React.Fragment>;
                  })}
                  </SourceForgeRepoContext.Provider>
                  {/* _d (approval-entry-current.js:1141-1190) pending phase. With
                      cached rows only the sr-only announcement remains. */}
                  {loading && current && (shownRows.length === 0
                    ? <div className="loading-state source-transcript-pending" role="status"><span className="sr-only">Loading session</span><SourceTranscriptSkeleton /></div>
                    : <div className="loading-state" role="status"><span className="sr-only">Loading session</span></div>)}
                  {emptyPane === "failure" && <SourceTranscriptLoadFailure onRetry={() => openSession(current, { retry: true })} />}
                  {emptyPane === "empty" && <SourceTranscriptEmpty />}
                  {shownApprovals.map((a) => (
                    <Approval
                      key={a.bridgeApproval.instanceId}
                      runtime={approvalRuntime.current}
                      request={a}
                      item={items.find(item => item.id === a.params?.itemId)}
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
                      menuOpen={!!menu || settings || showSearch || !!rename || whatsNew || !!actionDialog}
                      // R07 plan card: the primary's target (Mk) and the 'Open plan' link.
                      planTarget={afterPlanPermission(afterPlan.current)}
                      onOpenPlan={(() => { const plan = planItemFor(a); return plan ? () => openPlanItem(plan.id) : undefined; })()}
                    />
                  ))}
                  {state.errors[current] && (() => {
                    // A failure without a turn identity is still a source error item (scroll-messages-current.js:56486-56500
                    // ehe card), at the transcript tail. Try again resends the last text-only prompt when there is one.
                    const lastTurnId = items.findLast((item) => item?.type === "userMessage" && item.turnId)?.turnId;
                    const canRetry = !running && !loading && !!boot?.connected && !session?.archived && !!lastTurnId && !!retryInput(items, lastTurnId);
                    return <SourceTurnError key={`${current}:thread`} error={state.errors[current]} turnId="thread" variant="card"
                      onRetry={canRetry ? () => retryFailedTurn(lastTurnId) : undefined} />;
                  })()}
                  {!emptyPane && <SourceTranscriptStatus sessionKey={current} ready={!loading}
                    turnId={state.active[current]} turnStats={state.turnStats?.[current]}
                    items={state.items[current]} itemPhases={state.itemPhases?.[current]}
                    connected={!!boot?.connected} running={running} stopping={stopping} retrying={retryStatus}
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
                      toasts?.add(next === "thinking" ? "Switched transcript view to Thinking." : "Switched transcript view to Normal.");
                    } : null}
                    thinkingShown={transcriptView === "thinking"} />}
                </SourceTranscript>
                {/* F09 review: no Home connection card shows the reason any more, so a failed start,
                    initialize or reconnect shows here on Home too, above the composer's warning row. */}
                {error && (
                  <div role="alert" className="inline-error composer-error">
                    <span>{error}</span>{commandSuggestion&&<button onClick={()=>{setDraft(`/${commandSuggestion} `);setError("");setCommandSuggestion(null);textarea.current?.focus();}}>/{commandSuggestion}</button>}
                    <ToolButton
                      label="Dismiss error"
                      icon="X"
                      tooltip
                      onClick={() => setError("")}
                    />
                  </div>
                )}
                {session?.archived && <div className="archive-notice">This session is archived.<button onClick={() => sessionAction("unarchive", session).catch(actionFailed("unarchive"))}>Restore session</button></div>}
                {operation && <div className="session-operation-status" role="status" data-operation={operation.operation} data-phase={operation.phase}>
                  <span>{operation.phase === "failed" ? operation.error || "Session action failed."
                    : operation.phase === "unknown" ? operation.error
                    : operation.phase === "completed" ? ({compact:"Conversation compacted", review:"Review complete", fork:"Session forked"}[operation.operation])
                    : ({compact:"Compacting conversation…", review:"Reviewing code…", fork:"Forking session…"}[operation.operation])}</span>
                  {!actionPending && <button aria-label="Dismiss session action" onClick={() => dispatch({type:"dismiss-operation", id:current})}><Icon name="X" size={12}/></button>}
                </div>}
                {current && queue.threadId === current && queue.entries.length > 0 && (
                  <SourceQueuedMessages key={`${current}:queued`} entries={queue.entries} lockedIds={queue.lockedIds}
                    onCancel={queueCancel} onEdit={queueEdit} onReorder={queueReorder} />
                )}
                <SourceComposer
                  fastMode={fastEnabled}
                  fastAvailable={!!fastTier}
                  commandContext={commandContext} onCommand={executeCommand} commandScope={current}
                  // cc43287c9 :28625-28628 historyResetKey `${draftKey}:${sessionId}` only for an existing
                  // session (the New draft has no history); getHumanPrompts = OE over the open thread.
                  historyResetKey={current ? `${mode}:${current}` : undefined}
                  getHumanPrompts={() => humanPrompts(items)}
                  // F12: no onDismiss in commit mode; the counts toggle Changes (git-status-card 5024-5045 Zn toggle:true);
                  // a revisited session shows its held snapshot until its own status arrives.
                  beforeComposer={current && (bandStatus ? <SourceGitStatus status={bandStatus} prMode="commit"
                    onOpenFolder={() => call("reveal-folder", { cwd: gitStatus?.cwd || workdir }).catch(actionFailed("reveal"))}
                    onCopyPath={path => copyWithToast(path || gitStatus?.cwd || workdir, "Path copied to clipboard.")}
                    onCopyBranch={branch => copyWithToast(branch || gitStatus?.branch || "", "Branch name copied to clipboard.")}
                    onOpenChanges={() => togglePaneTile("changes")} onMeasured={rememberBandHeight}
                    onAction={sendCommitTurn} actionLabel="Commit" actionDisabled={commitDisabled} actionDisabledReason={commitDisabledReason} />
                    : bandHold ? <SourceGitStatus stale status={bandHold.status} heightPx={bandHold.heightPx} prMode="commit"
                      onAction={sendCommitTurn} actionLabel="Commit" /> : null)}
                  showPet={!current && !error && !draft.startsWith("/")}
                  showContext={!current}
                  // cc43287c9 :28686 placeholder Yn ? 'Type / for commands' : 'Describe a task or ask a question'
                  // (Yn = Pn?.id ?? null, :27454) — composer-placeholder.mjs; chat mode keeps its own copy.
                  placeholder={composerPlaceholder({ sessionId: current, mode })}
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
                  // Escape belongs to the topmost local layer (the window handler above) before it stops a turn.
                  escapeClaimed={!!(settings || actionDialog || rename || whatsNew || workflowLaunch || bypassMode.confirming || confirmDelete || showSearch || (effectiveCollapsed && peek.hovering))}
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
                  // its Retry re-reads account/read like the home key card's Refresh.
                  warning={boot !== null && boot?.connected === false && !loading ? "Connection to DeepSeek lost."
                    : boot?.connected && boot.account?.deepseek && !boot.account.account ? "Add a DeepSeek API key to start a session." : undefined}
                  onReconnect={boot?.connected && boot.account?.deepseek && !boot.account.account
                    ? () => call("account-auth", { operation: "refresh" }).catch((e) => setError(e.message)) : reconnect}
                  onStop={stop}
                  workdir={workdir}
                  workspaceInfo={workspaceInfo}
                  onMenu={openMenu}
                  model={chosen}
                  effort={effort}
                  permission={effectivePermission}
                  permissionOpen={menu?.kind === "permission"}
                  modelOpen={menu?.kind === "model"}
                  modelsLoading={boot === null}
                  menuKind={menu?.kind}
                  worktree={worktree}
                  setWorktree={setWorktree}
                  usage={state.usage[current]}
                  // c360a9e1c hd Y: with no session (sessionRef null) the trigger reads 'Context 0'.
                  usageFresh={!current}
                  mode={mode}
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
                  <h1>{section[0].toUpperCase() + section.slice(1)}</h1>
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
                    {section === "artifacts" ? "Browse project" : "Settings"}
                  </button>
                </header>
                <p>
                  {section === "artifacts"
                    ? "Files created in your workspace are available in the project browser."
                    : section === "routines"
                      ? "Scheduled tasks are not connected in this local DeepSeek client."
                      : "Configure your local DeepSeek environment and workspace."}
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
      </main>
      {shownBypass.value && <SourceBypassDialog key={`bypass-${shownBypass.key}`} open={shownBypass.open} onExited={shownBypass.onExited} cwd={workdir || cwd} onConfirm={bypassMode.confirm} onClose={bypassMode.cancel}/> }
      {menu?.kind === "model" ? <SourceModelMenu key={menu.token ?? "model"} anchor={menu.anchor} models={models} selected={model} onSelect={m => { updatePreferences({model:m.model, effort:m.defaultReasoningEffort}).catch(e=>setError(e.message)); }} fastTier={fastTier} fastMode={fastEnabled} fastDisabled={fastSaving || running || sending || !boot?.connected} fastSaving={fastSaving} onFastModeChange={value=>changeFastMode(value).catch(e=>setError(e.message))} onClose={closeMenu} initialHighlight={menu.entry} /> : menu?.kind === "permission" ? <SourcePermissionMenu key={menu.token ?? "permission"} anchor={menu.anchor} value={effectivePermission} defaultValue={permission} bypassEnabled={bypassMode.available} onChange={value => bypassMode.select(value)} onClose={closeMenu} onSelectComplete={() => textarea.current?.focus()} initialHighlight={menu.entry} /> : ["session", "titlebar"].includes(menu?.kind) ? <SourceSidebarMenu key={menu.token ?? menu.kind} anchor={menu.anchor} kind={menu.kind} label="Session menu" onClose={closeMenu} initialHighlight={menu.entry}>{menuContent()}</SourceSidebarMenu> : menu?.kind === "account" ? <SourceMenu.Popup key={menu.token ?? "account"} anchor={menu.anchor} side="top" align="start" label="Account menu" className="account-menu" onClose={closeMenu} initialHighlight={menu.entry}>{menuContent()}</SourceMenu.Popup> : menu?.kind === "add" ? <SourceMenu.Popup key={menu.token ?? "add"} anchor={menu.anchor} side="top" align="start" label="Add" className="add-menu" onClose={closeMenu} initialHighlight={menu.entry}>{menuContent()}</SourceMenu.Popup> : menu?.kind === "effort" ? <SourceEffortPopover key={menu.token ?? "effort"} anchor={menu.anchor} levels={efforts} value={effort}
        onChange={value => preference("effort", value)} onClose={closeMenu} />
      : menu?.kind === "usage" ? <SourceUsagePopover key={menu.token ?? "usage"} anchor={menu.anchor} usage={state.usage[current]} fresh={!current}
        onSeeDetails={current ? () => executeCommand("status") : undefined} onClose={closeMenu}
        // c360a9e1c :4136-4139 hd: oe = an onCompact for an open session; ae closes the popover, then compacts
        // (performOperation('compact') through executeCommand). Tw's inputs: replying, detached, compacting.
        onCompact={current && !session?.archived ? () => { closeMenu(); executeCommand("compact"); } : undefined}
        compactState={{ running: running || (actionPending && operation?.operation !== "compact"), connected: !!boot?.connected,
          compacting: operation?.operation === "compact" && actionPending }} />
      : ENV_MENUS[menu?.kind] ? <SourceMenu.Popup key={menu.token ?? menu.kind} anchor={menu.anchor} {...ENV_MENUS[menu.kind]}
        onClose={closeMenu} initialHighlight={menu.kind === "branch" ? null : menu.entry}>{menuContent()}</SourceMenu.Popup>
      : null}
      {/* R05 GR (cc43287c9 :28413-28421 mounted with ge): onResolved → D(le) records the target; Cancel keeps the branch. */}
      {shownBranchSwitch.value && <SourceBranchSwitchDialog key={`branch-switch-${shownBranchSwitch.key}`} open={shownBranchSwitch.open} onExited={shownBranchSwitch.onExited}
        currentBranch={shownBranchSwitch.value.currentBranch} targetBranch={shownBranchSwitch.value.targetBranch} status={shownBranchSwitch.value.status}
        onResolve={(mode) => call("branch-switch-resolve", { cwd: shownBranchSwitch.value.cwd, mode, currentBranch: shownBranchSwitch.value.currentBranch })}
        onResolved={() => { const { targetBranch, currentBranch } = shownBranchSwitch.value;
          recordBranch(targetBranch, currentBranch); setBranchSwitch(null); refreshChanges(); }}
        onCancel={() => setBranchSwitch(null)}
        onError={() => { if (toasts) toasts.add(WORKING_TREE_ERROR, { variant: "danger" }); else setError(WORKING_TREE_ERROR); }} />}
      {shownActionDialog.value?.kind === "shortcuts" && <KeyboardShortcutsDialog key={`action-${shownActionDialog.key}`} {...actionDialogProps("shortcuts")} fastMode={models.some(m => fastTierForModel(m))} onClose={()=>setActionDialog(null)}/>}
      {shownActionDialog.value?.kind === "help" && <SlashHelp key={`action-${shownActionDialog.key}`} {...actionDialogProps("help")} onClose={()=>setActionDialog(null)}/>}
      {shownActionDialog.value?.kind === "rewind" && <RewindDialog key={`action-${shownActionDialog.key}`} {...actionDialogProps("rewind")} turns={shownActionDialog.value.turns} onConfirm={rewindConversation} onClose={()=>setActionDialog(null)}/>}
      {shownActionDialog.value?.kind === "review" && <ReviewDialog key={`action-${shownActionDialog.key}`} {...actionDialogProps("review")} initialInstructions={shownActionDialog.value.instructions} workspaceInfo={workspaceInfo}
        onClose={() => setActionDialog(null)} onSubmit={async target => { const dialog = actionDialog; await performOperation("review", {target}); setActionDialog(value => value === dialog ? null : value); }} />}
      {shownWhatsNew.value && <LocalReleaseNotes key={`whats-new-${shownWhatsNew.key}`} open={shownWhatsNew.open} onExited={shownWhatsNew.onExited} onClose={() => setWhatsNew(false)} />}
      {workflowLaunch&&<WorkflowLaunch initial={workflowLaunch} onClose={()=>setWorkflowLaunch(null)} onPick={()=>call('workflow-pick')} onStart={async options=>{const run=await call('workflow-start',{...options,threadId:workflowLaunch.threadId,model:workflowLaunch.model,effort:workflowLaunch.effort,cwd:workflowLaunch.cwd,permission:workflowLaunch.permission,mode:workflowLaunch.mode,after:workflowLaunch.after});setWorkflowRuns(old=>mergeWorkflow(old,run));if(currentRef.current===run.threadId)openWorkflow(run.id);}}/>}
      {<SourceSettings open={!!settings} config={{...boot?.config,...localPreferences,theme,displayName,fastMode}} model={model} effort={effort} permission={permission}
        boot={boot} busy={running || sending || actionPending} onSave={updatePreferences} onClose={()=>setSettings(false)}
        initialSection={typeof settings === "string" ? settings : undefined} readUsage={readAccountUsageDetails} desktopCall={call}
        customize={customize}
        onFolder={async()=>{const dir=await call("folder");if(dir){setBoot(b=>({...b,config:{...b.config,cwd:dir}}));setCwd(dir);navigate(null);}}}
        onReconnect={reconnect} onLogin={type=>call("login",{type})} onAccountAction={p=>call("account-auth",p)} onRefreshAccount={()=>call("account-auth",{operation:"refresh"})}
        onReveal={target=>call("reveal-settings",{target})} />}
      {shownConfirmDelete.value && <SourceConfirmDialog key={`confirm-delete-${shownConfirmDelete.key}`} open={shownConfirmDelete.open} onExited={shownConfirmDelete.onExited}
        {...deleteConfirmCopy([shownConfirmDelete.value], { engine })} onClose={() => setConfirmDelete(null)}
        onConfirm={() => sessionAction("delete", shownConfirmDelete.value)} />}
      {/* Rename on the shared Dialog (source-dialog.jsx): size sm, title, the name field (initial focus) and a
          Qf footer with CDS Buttons; Escape, the backdrop and Close dismiss it. */}
      {shownRename.value && renameShown && (
        <SourceDialog key={`rename-${shownRename.key}`} open={shownRename.open} onExited={shownRename.onExited} size="sm" title="Rename session"
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
              aria-label="Session name"
              value={renameShown.name}
              onChange={(e) => setRename((current) => current && { ...current, name: e.target.value })}
            />
            <SourceDialogFooter>
              <SourceSettingsButton onClick={() => setRename(null)}>Cancel</SourceSettingsButton>
              <SourceSettingsButton type="submit" variant="primary" disabled={!renameShown.name.trim()}>Save</SourceSettingsButton>
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
  const [error, setError] = useState("");
  const [plan, setPlan] = useState(null);
  const [gitStatus, setGitStatus] = useState(null);
  const [gitDiff, setGitDiff] = useState(null);
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
      .catch((reason) => { if (live) setGitError("Could not read repository changes: " + reason.message); });
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
      .catch((reason) => { if (live) setGitError("Could not read repository changes: " + reason.message); });
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
  useEffect(() => { document.title = `${PANE_NAMES[pane] ?? "Pane"} — Code Desktop`; }, [pane]);
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
            diff={gitStatus?.isRepo ? gitDiff : null}
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
    : <App />}</SourceToastProvider>,
);
