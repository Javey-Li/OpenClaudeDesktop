// Keyboard shortcuts dialog (2.2553.1 shared-21-D098Wd--.js:14583-14625 IR around zR :14946-15420)
// and the app-level chords that main.jsx's window keydown handles. zR lists General, Panes and
// Composer rows ($ :14466-14506); only rows whose chord this app really binds are kept, with
// zR's labels ("Stop Claude’s response" names the local agent). Every chord is matched by
// globalShortcutCommand below, sessionCycleDelta (session-cycle-model.mjs), paneShortcutKind
// (pane-shortcuts.mjs), chinShortcutCommand (chin-shortcuts.mjs), the composer's escapeAction
// (composer-keys-model.mjs), the sidebar's jump and archive chords (sidebar-jump-model.mjs
// isMetaJumpChord/jumpDigit, archiveChord) or the menus' 1-9 digit keys (source-menu.jsx
// data-number-key, chin-shortcuts.mjs modeMenuDigit).
import { MODE_MENU_KEYS } from "./chin-shortcuts.mjs";
import { t } from "../electron/i18n/index.mjs";

// shortcuts_modal binding {key:"/", modifiers:["cmd"], platform:"mac"} (ion-dist shared-7).
export const SHORTCUTS_DIALOG_KEYS = "cmd+/";

// command: what the chord does here; keys: one Shortcut per alternative ("or" between them).
const GENERAL = [
  // ⌘K: zR's command_palette row "Search or start a session" toggles the command palette
  // (source-sidebar-palette.jsx); its 'New session' row starts one from the typed text.
  { command: "search", label: t("Search or start a session"), keys: ["cmd+k"] },
  // zR search_palette row: ⇧⌘K opens (never toggles) the palette in search mode (Go > Search…).
  { command: "search-palette", label: t("Search"), keys: ["cmd+shift+k"] },
  // zR toggles with kR ["cmd+b", "cmd+."] (main.jsx, View > Hide Sidebar): ⌘. works from a text field too.
  { command: "toggle-sidebar", label: t("Toggle sidebar"), keys: ["cmd+b", "cmd+."] },
  { command: "shortcuts", label: t("Keyboard shortcuts"), keys: [SHORTCUTS_DIALOG_KEYS] },
  // AR: the Claude app's Settings row is "cmd+,".
  { command: "settings", label: t("Settings"), keys: ["cmd+,"] },
  { command: "new-session", label: t("New session"), keys: ["cmd+n"] },
  // File › New Window (app-menu.cjs, CmdOrCtrl+Shift+N): a menu accelerator, not a renderer chord.
  { command: "new-session-current", label: t("New session with current settings"), keys: ["cmd+shift+n"] },
  // zR isClaudeApp block (shared-21-D098Wd--.js:15017-15060): pR "cmd+w" closes the focused pane, else
  // the session view (File > Close Session); hR("reopenClosed") "cmd+shift+t" (:14261-14266).
  { command: "close-session", label: t("Close tab, pane, or session"), keys: ["cmd+w"] },
  { command: "reopen-closed", label: t("Reopen closed session"), keys: ["cmd+shift+t"] },
  // Session rows bound by the sidebar cycle (session-cycle-model.mjs, Go menu).
  { command: "next-session", label: t("Next session"), keys: ["cmd+shift+]", "ctrl+tab"] },
  { command: "previous-session", label: t("Previous session"), keys: ["cmd+shift+[", "ctrl+shift+tab"] },
  // ⌘1–9 (sidebar-jump-model.mjs bL) and, without ccd_palette_session_actions, ⌘⇧⌫ (shared-19 rg).
  { command: "jump-session", label: t("Jump to session"), keys: ["cmd+1…9"] },
  { command: "archive-session", label: t("Archive session"), keys: ["cmd+shift+backspace", "cmd+alt+a"] },
  // :15173-15178 mR("cycleTranscriptMode") = "ctrl+o" (:14189).
  { command: "transcript-view", label: t("Transcript view"), keys: ["ctrl+o"] },
  // zR session rows (shared-21-D098Wd--.js:15060-15140): ⌥⌘P/R/A/U/O on the open session.
  { command: "pin-session", label: t("Pin / unpin session"), keys: ["cmd+alt+p"] },
  { command: "rename-session", label: t("Rename session"), keys: ["cmd+alt+r"] },
  { command: "unread-session", label: t("Mark session as read/unread"), keys: ["cmd+alt+u"] },
  { command: "fork-session", label: t("Fork session"), keys: ["cmd+alt+o"] },
  // :15157-15170 jumpPrevPrompt / jumpNextPrompt (promptJump gate) "cmd+alt+up" / "cmd+alt+down".
  { command: "jump-prev-prompt", label: t("Jump to previous prompt"), keys: ["cmd+alt+up"] },
  { command: "jump-next-prompt", label: t("Jump to next prompt"), keys: ["cmd+alt+down"] },
  { command: "stop", label: t("Stop DeepSeek’s response"), keys: ["esc"] },
];
const PANES = [
  { command: "changes", label: t("Toggle changes"), keys: ["cmd+shift+d"] },
  // :15200-15206 mR("toggleDiffFileList") = "cmd+shift+y" (pane-shortcuts.mjs 'file-list').
  { command: "file-list", label: t("Toggle file list in changes or files"), keys: ["cmd+shift+y"] },
  // :15208-15214 mR("goToDiffFile") = "cmd+p": the Changes pane's Go to file (diff-go-to-file-model.mjs isGoToFileShortcut).
  { command: "go-to-file", label: t("Go to file in changes"), keys: ["cmd+p"] },
  { command: "files", label: t("Toggle Files"), keys: ["cmd+shift+f"] },
  // togglePreview "cmd+shift+p" (shared-21-D098Wd--.js:14146-14207).
  { command: "preview", label: t("Toggle preview"), keys: ["cmd+shift+p"] },
  // zR mR("toggleSketchMode") "Annotate page in preview" (titlebar-shared-21.js:15236-15245): the Preview pane's
  // Annotate button (source-preview-pane.jsx SKETCH_SHORTCUT), also from inside the previewed page (preview-service.cjs).
  { command: "annotate", label: t("Annotate page in preview"), keys: ["cmd+shift+x"] },
  // toggleTerminal ctrl+` / cmd+j (shared-21 aR; terminal-pane-model.mjs isTerminalToggle, View › Show Terminal ⌘J).
  { command: "terminal", label: t("Toggle terminal"), keys: ["ctrl+`", "cmd+j"] },
  { command: "close-pane", label: t("Close pane"), keys: ["cmd+\\"] },
  // mR("toggleExpandPane") = aR "cmd+shift+\\" (sidebar-rows.js:14187).
  { command: "expand-pane", label: t("Expand or collapse pane"), keys: ["cmd+shift+\\"] },
  // backgroundTasks "ctrl+b" (matchBy key): the Tasks pane's background list; left to a focused text field.
  { command: "background-tasks", label: t("Background tasks"), keys: ["ctrl+b"] },
];
// View › Split View's chords (split-view-model.mjs splitShortcut, official vNr accelerators).
const SPLIT = [
  { command: "split-new-right", label: t("New session on the right"), keys: ["ctrl+cmd+\\"] },
  // zR {shortcut:"alt+click"} (titlebar-shared-21.js:15062-15067): ⌥-click a sidebar row (source-sidebar.jsx onOpenSplit).
  { command: "split-open", label: t("Open session in split view"), keys: ["alt+click"] },
  { command: "split-focus-next", label: t("Focus next split view"), keys: ["ctrl+]"] },
  { command: "split-focus-previous", label: t("Focus previous split view"), keys: ["ctrl+["] },
  { command: "split-close", label: t("Close split view"), keys: ["ctrl+cmd+w"] },
];
const COMPOSER = [
  { command: "mode", label: t("Open mode menu"), keys: [MODE_MENU_KEYS] },
  { command: "model", label: t("Open model menu"), keys: ["cmd+shift+i"] },
  { command: "effort", label: t("Open effort selector"), keys: ["cmd+shift+e"] },
  // Shown only when a model offers a Fast tier (zR: setFastMode && some model has fast mode).
  { command: "fast", label: t("Toggle fast mode"), keys: ["cmd+alt+f"], fastOnly: true },
  { command: "menu-item", label: t("Select menu item"), keys: ["1…9"] },
  // shared-7 file_upload {key:"u", modifiers:["cmd"]}: Add › Add files or photos (:15364).
  { command: "file-upload", label: t("Add files or photos"), keys: ["cmd+u"] },
  // :15284 attachTerminalOutput "cmd+shift+l": the transcript selection as composer context (source-transcript.jsx).
  { command: "attach-selection", label: t("Attach selection as context"), keys: ["cmd+shift+l"] },
  // zR :15370-15382 'Send in a forked session' cmd+alt+enter.
  { command: "send-fork", label: t("Send in a forked session"), keys: ["cmd+alt+enter"] },
  // zR toggleSideChat "cmd+;" (shared-21-D098Wd--.js:15060-15140), bound in main.jsx; listed only where the core
  // serves side questions (session-command-model.mjs sideQuestionsSupported).
  { command: "side-chat", label: t("Toggle side chat"), keys: ["cmd+;"], sideChatOnly: true },
];

/** OR sections of zR, filtered to this app's bindings, plus the split view chords. */
export function shortcutsDialogSections({ fastMode = false, sideChat = false } = {}) {
  const rows = (list) => list.filter((row) => (!row.fastOnly || fastMode) && (!row.sideChatOnly || sideChat)).map(({ fastOnly, sideChatOnly, ...row }) => row);
  return [
    { title: t("General"), rows: rows(GENERAL) },
    { title: t("Panes"), rows: rows(PANES) },
    { title: t("Split view"), rows: rows(SPLIT) },
    { title: t("Composer"), rows: rows(COMPOSER) },
  ];
}

// The app-level chords of main.jsx's window keydown handler, matched exactly as before:
// ⌘, / Ctrl+, Settings and ⌘N / ⌘K / ⌘\ also accept Ctrl; ⌘B and ⌘[ ⌘] are Meta only
// (Ctrl+B stays the text fields' move-backward key) and match e.code; ⌘/ is the
// shortcuts_modal binding (shared-22-Cz3C_T8d.js:11709, :11740-11749); ⇧⌘K is
// search_palette {key:"k", shift:true} (sidebar-main.js:19987), Meta only. ⌘W is pR (shared-21
// :14357-14360, fR: the typed character, else KeyW) and ⇧⌘T reopenClosed (matchBy "char"), both
// Meta only; ⌃O is cycleTranscriptMode (code KeyO), Control only.
const typedChar = (event, letter, code) => (/^[ -~]$/.test(event.key ?? "") ? event.key.toLowerCase() === letter : event.code === code);
export function globalShortcutCommand(event) {
  if (!event) return null;
  const meta = !!event.metaKey, ctrl = !!event.ctrlKey, alt = !!event.altKey, shift = !!event.shiftKey;
  if ((meta || ctrl) && event.key === ",") return "settings";
  const plainMeta = meta && !ctrl && !alt && !shift && !event.isComposing;
  // toggle_sidebar: ⌘B, and kR's ⌘. (shared-7 {key:"."}).
  if (plainMeta && (event.code === "KeyB" || event.code === "Period")) return "toggle-sidebar";
  if (plainMeta && event.code === "BracketLeft") return "back";
  if (plainMeta && event.code === "BracketRight") return "forward";
  if (plainMeta && event.code === "Slash") return "shortcuts";
  if (meta && shift && !ctrl && !alt && !event.isComposing && event.code === "KeyK") return "search-palette";
  if ((meta || ctrl) && event.key === "n") return "new-session";
  if ((meta || ctrl) && !alt && event.code === "Backslash") return shift ? "expand-pane" : "close-pane";
  if (meta && !ctrl && !alt && !event.isComposing && typedChar(event, "w", "KeyW")) return shift ? null : "close-session";
  if (meta && shift && !ctrl && !alt && !event.isComposing && typedChar(event, "t", "KeyT")) return "reopen-closed";
  if (ctrl && !meta && !alt && !shift && !event.isComposing && event.code === "KeyO") return "transcript-view";
  // backgroundTasks ctrl+b (matchBy key): Control only; the caller leaves it to a focused text field (move backward).
  if (ctrl && !meta && !alt && !shift && !event.isComposing && event.key?.toLowerCase() === "b") return "background-tasks";
  // file_upload cmd+u.
  if (plainMeta && event.code === "KeyU") return "file-upload";
  // jumpPrevPrompt / jumpNextPrompt cmd+alt+up / cmd+alt+down.
  if (meta && alt && !ctrl && !shift && !event.isComposing && (event.key === "ArrowUp" || event.key === "ArrowDown")) return event.key === "ArrowUp" ? "jump-prev-prompt" : "jump-next-prompt";
  // pB (shared-7 keybinding match): a key binding compares event.key case-insensitively with exact modifiers, so
  // ⌘K with Caps Lock (key "K", no Shift) is still command_palette; ⇧⌘K is search_palette above.
  if ((meta || ctrl) && !shift && event.key?.toLowerCase() === "k") return "search";
  // ⌥⌘ session chords: matched by code (⌥ turns event.key into another character on a Mac).
  if (meta && alt && !ctrl && !shift && !event.isComposing) {
    const chord = { KeyP: "pin-session", KeyR: "rename-session", KeyA: "archive-session", KeyU: "unread-session", KeyO: "fork-session" }[event.code];
    if (chord) return chord;
  }
  return null;
}

// ⌘K (command_palette, toggles) and ⇧⌘K / Go > Search… (search_palette, opens): the palette is an
// overlay that shows whatever the sidebar state (sidebar-groups.js:4999-5024 sw), so the sidebar is
// never expanded for it. ⌘K closes an open palette or opens it in its default mode; ⇧⌘K opens it in
// search mode, or switches an open one to search mode (sw n("search")).
export function searchShortcutAction({ showSearch = false, toggle = false } = {}) {
  if (toggle) return showSearch ? "close" : "open";
  return "open-search";
}
