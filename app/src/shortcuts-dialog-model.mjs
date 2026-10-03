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

// shortcuts_modal binding {key:"/", modifiers:["cmd"], platform:"mac"} (ion-dist shared-7).
export const SHORTCUTS_DIALOG_KEYS = "cmd+/";

// command: what the chord does here; keys: one Shortcut per alternative ("or" between them).
const GENERAL = [
  // ⌘K: zR's command_palette row is "Search or start a session"; locally ⌘K toggles the
  // sidebar's session search, which cannot start a session.
  { command: "search", label: "Search sessions", keys: ["cmd+k"] },
  // zR search_palette row: ⇧⌘K opens (never toggles) the search (Go > Search…).
  { command: "search-palette", label: "Search", keys: ["cmd+shift+k"] },
  // zR toggles with kR ["cmd+b", "cmd+."]; only ⌘B is bound (main.jsx, View > Hide Sidebar).
  { command: "toggle-sidebar", label: "Toggle sidebar", keys: ["cmd+b"] },
  { command: "shortcuts", label: "Keyboard shortcuts", keys: [SHORTCUTS_DIALOG_KEYS] },
  // AR: the Claude app's Settings row is "cmd+,".
  { command: "settings", label: "Settings", keys: ["cmd+,"] },
  { command: "new-session", label: "New session", keys: ["cmd+n"] },
  // zR isClaudeApp block (shared-21-D098Wd--.js:15017-15060): pR "cmd+w" closes the focused pane, else
  // the session view (File > Close Session); hR("reopenClosed") "cmd+shift+t" (:14261-14266).
  { command: "close-session", label: "Close tab, pane, or session", keys: ["cmd+w"] },
  { command: "reopen-closed", label: "Reopen closed session", keys: ["cmd+shift+t"] },
  // Session rows bound by the sidebar cycle (session-cycle-model.mjs, Go menu).
  { command: "next-session", label: "Next session", keys: ["cmd+shift+]", "ctrl+tab"] },
  { command: "previous-session", label: "Previous session", keys: ["cmd+shift+[", "ctrl+shift+tab"] },
  // ⌘1–9 (sidebar-jump-model.mjs bL) and, without ccd_palette_session_actions, ⌘⇧⌫ (shared-19 rg).
  { command: "jump-session", label: "Jump to session", keys: ["cmd+1…9"] },
  { command: "archive-session", label: "Archive session", keys: ["cmd+shift+backspace"] },
  // :15173-15178 mR("cycleTranscriptMode") = "ctrl+o" (:14189).
  { command: "transcript-view", label: "Transcript view", keys: ["ctrl+o"] },
  { command: "stop", label: "Stop DeepSeek’s response", keys: ["esc"] },
];
const PANES = [
  { command: "changes", label: "Toggle changes", keys: ["cmd+shift+d"] },
  // :15200-15206 mR("toggleDiffFileList") = "cmd+shift+y" (pane-shortcuts.mjs 'file-list').
  { command: "file-list", label: "Toggle file list in changes or files", keys: ["cmd+shift+y"] },
  { command: "files", label: "Toggle Files", keys: ["cmd+shift+f"] },
  { command: "close-pane", label: "Close pane", keys: ["cmd+\\"] },
  // mR("toggleExpandPane") = aR "cmd+shift+\\" (sidebar-rows.js:14187).
  { command: "expand-pane", label: "Expand or collapse pane", keys: ["cmd+shift+\\"] },
];
const COMPOSER = [
  { command: "mode", label: "Open mode menu", keys: [MODE_MENU_KEYS] },
  { command: "model", label: "Open model menu", keys: ["cmd+shift+i"] },
  { command: "effort", label: "Open effort selector", keys: ["cmd+shift+e"] },
  // Shown only when a model offers a Fast tier (zR: setFastMode && some model has fast mode).
  { command: "fast", label: "Toggle fast mode", keys: ["cmd+alt+f"], fastOnly: true },
  { command: "menu-item", label: "Select menu item", keys: ["1…9"] },
];

/** OR sections of zR, filtered to this app's bindings. */
export function shortcutsDialogSections({ fastMode = false } = {}) {
  const rows = (list) => list.filter((row) => !row.fastOnly || fastMode).map(({ fastOnly, ...row }) => row);
  return [
    { title: "General", rows: rows(GENERAL) },
    { title: "Panes", rows: rows(PANES) },
    { title: "Composer", rows: rows(COMPOSER) },
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
  if (plainMeta && event.code === "KeyB") return "toggle-sidebar";
  if (plainMeta && event.code === "BracketLeft") return "back";
  if (plainMeta && event.code === "BracketRight") return "forward";
  if (plainMeta && event.code === "Slash") return "shortcuts";
  if (meta && shift && !ctrl && !alt && !event.isComposing && event.code === "KeyK") return "search-palette";
  if ((meta || ctrl) && event.key === "n") return "new-session";
  if ((meta || ctrl) && !alt && event.code === "Backslash") return shift ? "expand-pane" : "close-pane";
  if (meta && !ctrl && !alt && !event.isComposing && typedChar(event, "w", "KeyW")) return shift ? null : "close-session";
  if (meta && shift && !ctrl && !alt && !event.isComposing && typedChar(event, "t", "KeyT")) return "reopen-closed";
  if (ctrl && !meta && !alt && !shift && !event.isComposing && event.code === "KeyO") return "transcript-view";
  // pB (shared-7 keybinding match): a key binding compares event.key case-insensitively with exact modifiers, so
  // ⌘K with Caps Lock (key "K", no Shift) is still command_palette; ⇧⌘K is search_palette above.
  if ((meta || ctrl) && !shift && event.key?.toLowerCase() === "k") return "search";
  return null;
}

// ⌘K (command_palette, toggles) and ⇧⌘K / Go > Search… (search_palette, opens): the source's palette is
// an overlay that shows whatever the sidebar state (sidebar-groups.js:4999-5024 sw). Locally the field
// lives in the sidebar, so opening it docks a collapsed sidebar, or floats the peek card while the
// viewport is narrow (the stored collapsed preference stays as it is there). 'open-expand' is a no-op
// expand for a docked sidebar; 'focus' still makes a field hidden in the collapsed card visible.
export function searchShortcutAction({ narrow = false, showSearch = false, toggle = false } = {}) {
  if (showSearch) return toggle ? "close" : "focus";
  return narrow ? "open-peek" : "open-expand";
}
