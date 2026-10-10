import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SHORTCUTS_DIALOG_KEYS, globalShortcutCommand, searchShortcutAction, shortcutsDialogSections } from '../src/shortcuts-dialog-model.mjs';
import { archiveChord, isMetaJumpChord, jumpDigit } from '../src/sidebar-jump-model.mjs';
import { chinShortcutCommand, modeMenuDigit } from '../src/chin-shortcuts.mjs';
import { paneShortcutKind } from '../src/pane-shortcuts.mjs';
import { enterAction, escapeAction } from '../src/composer-keys-model.mjs';
import { digitIndex } from '../src/menu-model.mjs';
import { shortcutCaps } from '../src/shortcut-model.mjs';
import { sessionCycleDelta } from '../src/session-cycle-model.mjs';
import { attachSelectionChord } from '../src/transcript-context-menu-model.mjs';
import { isTerminalToggle } from '../src/terminal-pane-model.mjs';
import { splitShortcut } from '../src/split-view-model.mjs';
import { isGoToFileShortcut } from '../src/diff-go-to-file-model.mjs';

// shared-21-D098Wd--.js:14946-15420 zR, filtered to the chords this app binds.
const CODES = { '.': 'Period', up: 'ArrowUp', down: 'ArrowDown', ',': 'Comma', '/': 'Slash', '\\': 'Backslash', '[': 'BracketLeft', ']': 'BracketRight', '`': 'Backquote', esc: 'Escape', tab: 'Tab', backspace: 'Backspace', enter: 'Enter' };
// A macOS keydown for one key spec ("cmd+shift+d" -> metaKey, shiftKey, key "D", code "KeyD").
function keydown(spec) {
  const parts = spec.split('+'), key = parts.at(-1), mods = new Set(parts.slice(0, -1));
  if (key === 'click') return { click: true, metaKey: mods.has('cmd'), shiftKey: mods.has('shift'), altKey: mods.has('alt'), ctrlKey: mods.has('ctrl') };
  const shiftKey = mods.has('shift');
  const letter = /^[a-z]$/.test(key), digit = /^\d$/.test(key);
  return {
    metaKey: mods.has('cmd'), shiftKey, altKey: mods.has('alt'), ctrlKey: mods.has('ctrl'), isComposing: false, repeat: false,
    key: key === 'esc' ? 'Escape' : key === 'tab' ? 'Tab' : key === 'backspace' ? 'Backspace' : key === 'enter' ? 'Enter' : key === 'up' ? 'ArrowUp' : key === 'down' ? 'ArrowDown' : letter ? (shiftKey ? key.toUpperCase() : key) : key,
    code: letter ? `Key${key.toUpperCase()}` : digit ? `Digit${key}` : CODES[key],
  };
}
// "1…9" names the nine digit keys (after any modifiers: "cmd+1…9").
const expand = (spec) => spec.endsWith('1…9') ? Array.from({ length: 9 }, (_, index) => spec.replace('1…9', String(index + 1))) : [spec];
// What each handler does with the event; the dialog row's command must be one of them.
const appMenu = readFileSync(path.join(import.meta.dirname, '../electron/app-menu.cjs'), 'utf8');
const previewPane = readFileSync(path.join(import.meta.dirname, '../src/source-preview-pane.jsx'), 'utf8');
const sidebar = readFileSync(path.join(import.meta.dirname, '../src/source-sidebar.jsx'), 'utf8');
function bound(event) {
  // A sidebar row's click handler: ⌥-click opens the session in split view (source-sidebar.jsx onOpenSplit).
  if (event.click) return event.altKey && /if \(event\.altKey\) \{[\s\S]{0,200}windowActions\.onOpenSplit\(session\)/.test(sidebar) ? 'split-open' : null;
  // The Preview pane's keydown: ⇧⌘X toggles Annotate (source-preview-pane.jsx toggleSketch, SKETCH_SHORTCUT).
  if (event.code === 'KeyX' && event.shiftKey && event.metaKey && !event.altKey && previewPane.includes('const SKETCH_SHORTCUT = "cmd+shift+x"') && /event\.code === "KeyX"[^\n]*toggleSketch\(\)/.test(previewPane)) return 'annotate';
  // source-split-view.jsx's window keydown takes the split chords before main.jsx's handler.
  const split = splitShortcut(event);
  if (split) return `split-${split}`;
  const global = globalShortcutCommand(event);
  if (global) return global;
  // main.jsx's handler: toggleTerminal ⌃` / ⌘J (terminal-pane-model.mjs).
  if (isTerminalToggle(event)) return 'terminal';
  // File › New Session with Current Settings is the app menu's CmdOrCtrl+Shift+N accelerator.
  if (event.metaKey && event.shiftKey && !event.ctrlKey && !event.altKey && event.code === 'KeyN' && /label: t\("New Session with Current Settings"\), accelerator: "CmdOrCtrl\+Shift\+N"/.test(appMenu)) return 'new-session-current';
  // Km's keydown (session-cycle-model.mjs) runs in the same main.jsx handler.
  const cycle = sessionCycleDelta(event);
  if (cycle) return cycle > 0 ? 'next-session' : 'previous-session';
  const pane = paneShortcutKind(event);
  if (pane) return pane;
  // The Changes pane's keydown: ⌘P opens Go to file (source-diff-pane, diff-go-to-file-model.mjs).
  if (isGoToFileShortcut(event)) return 'go-to-file';
  // SourceSidebar's window keydown: bL ⌘1–9 jump and rg ⌘⇧⌫ archive (sidebar-jump-model.mjs).
  if (isMetaJumpChord(event) && jumpDigit(event)) return 'jump-session';
  if (archiveChord(event)) return 'archive-session';
  const chin = chinShortcutCommand(event);
  if (chin) return chin;
  // The transcript's own keydown: ⇧⌘L attaches the transcript selection (source-transcript.jsx).
  if (attachSelectionChord(event)) return 'attach-selection';
  // The composer editor's Enter: ⌘⌥⏎ sends the draft into a fork (enterAction submit-fork).
  if (event.key === 'Enter' && enterAction({ event }) === 'submit-fork') return 'send-fork';
  // The composer editor's keydown hands Escape to escapeAction (source-composer.jsx); a running turn stops.
  if (event.key === 'Escape' && escapeAction({ event, running: true }) === 'stop') return 'stop';
  // SourceMenu picks the item whose data-number-key is the digit; the Mode menu claims Digit1-9 (modeMenuDigit).
  const digit = modeMenuDigit(event);
  if (digit >= 1 && digitIndex(['1', '2', '3', '4', '5', '6', '7', '8', '9'], event.key) === digit - 1) return 'menu-item';
  return null;
}

test('zR sections, General / Panes / Composer, with the original labels, and the split view chords', () => {
  const sections = shortcutsDialogSections({ fastMode: true });
  assert.deepEqual(sections.map((section) => section.title), ['General', 'Panes', 'Split view', 'Composer']);
  assert.deepEqual(sections.map((section) => section.rows.map((row) => row.label)), [
    ['Search or start a session', 'Search', 'Toggle sidebar', 'Keyboard shortcuts', 'Settings', 'New session', 'New session with current settings', 'Close tab, pane, or session', 'Reopen closed session',
      'Next session', 'Previous session', 'Jump to session', 'Archive session', 'Transcript view',
      'Pin / unpin session', 'Rename session', 'Mark session as read/unread', 'Fork session', 'Jump to previous prompt', 'Jump to next prompt', 'Stop DeepSeek’s response'],
    ['Toggle changes', 'Toggle file list in changes or files', 'Go to file in changes', 'Toggle Files', 'Toggle preview', 'Annotate page in preview', 'Toggle terminal', 'Close pane', 'Expand or collapse pane', 'Background tasks'],
    ['New session on the right', 'Open session in split view', 'Focus next split view', 'Focus previous split view', 'Close split view'],
    ['Open mode menu', 'Open model menu', 'Open effort selector', 'Toggle fast mode', 'Select menu item', 'Add files or photos', 'Attach selection as context', 'Send in a forked session'],
  ]);
  // zR shows Toggle fast mode only when a model offers it.
  assert.deepEqual(shortcutsDialogSections().at(-1).rows.map((row) => row.command), ['mode', 'model', 'effort', 'menu-item', 'file-upload', 'attach-selection', 'send-fork']);
  // Toggle side chat (⌘;) only where the core serves side questions.
  assert.equal(shortcutsDialogSections({ sideChat: true }).at(-1).rows.at(-1).command, 'side-chat');
});

test('every listed chord is one the app binds: the main handler, pane, chin, composer Escape or menu digits', () => {
  for (const section of shortcutsDialogSections({ fastMode: true }))
    for (const row of section.rows)
      for (const spec of row.keys)
        for (const key of expand(spec))
          assert.equal(bound(keydown(key)), row.command, `${section.title} / ${row.label}: ${key}`);
});

test('caps follow the CDS Shortcut io order (⇧⌘D) and ⌘/ is the shortcuts_modal binding', () => {
  const caps = (spec) => shortcutCaps(spec, true).map((cap) => cap.label).join('');
  const all = Object.fromEntries(shortcutsDialogSections({ fastMode: true }).flatMap((section) => section.rows).map((row) => [row.command, row.keys.map(caps)]));
  assert.deepEqual(all, {
    search: ['⌘K'], 'search-palette': ['⇧⌘K'], 'toggle-sidebar': ['⌘B', '⌘.'], shortcuts: ['⌘/'], settings: ['⌘,'], 'new-session': ['⌘N'], 'new-session-current': ['⇧⌘N'],
    'close-session': ['⌘W'], 'reopen-closed': ['⇧⌘T'],
    'next-session': ['⇧⌘]', '⌃⇥'], 'previous-session': ['⇧⌘[', '⌃⇧⇥'], 'jump-session': ['⌘1…9'], 'archive-session': ['⇧⌘⌫', '⌥⌘A'], 'transcript-view': ['⌃O'], stop: ['Esc'],
    'pin-session': ['⌥⌘P'], 'rename-session': ['⌥⌘R'], 'unread-session': ['⌥⌘U'], 'fork-session': ['⌥⌘O'],
    'jump-prev-prompt': ['⌥⌘↑'], 'jump-next-prompt': ['⌥⌘↓'],
    changes: ['⇧⌘D'], 'file-list': ['⇧⌘Y'], 'go-to-file': ['⌘P'], files: ['⇧⌘F'], preview: ['⇧⌘P'], annotate: ['⇧⌘X'], terminal: ['⌃`', '⌘J'], 'close-pane': ['⌘\\'], 'expand-pane': ['⇧⌘\\'], 'background-tasks': ['⌃B'],
    'split-new-right': ['⌃⌘\\'], 'split-open': ['⌥Click'], 'split-focus-next': ['⌃]'], 'split-focus-previous': ['⌃['], 'split-close': ['⌃⌘W'],
    mode: ['⇧⌘M'], model: ['⇧⌘I'], effort: ['⇧⌘E'], fast: ['⌥⌘F'], 'menu-item': ['1…9'], 'file-upload': ['⌘U'], 'attach-selection': ['⇧⌘L'], 'send-fork': ['⌥⌘⏎'],
  });
  assert.equal(SHORTCUTS_DIALOG_KEYS, 'cmd+/');
});

test('globalShortcutCommand keeps the main handler predicates', () => {
  assert.equal(globalShortcutCommand(keydown('cmd+/')), 'shortcuts');
  assert.equal(globalShortcutCommand({ ...keydown('cmd+/'), shiftKey: true, key: '?' }), null, '⇧⌘/ is not the shortcuts chord');
  assert.equal(globalShortcutCommand({ ...keydown('cmd+/'), isComposing: true }), null);
  assert.equal(globalShortcutCommand({ ...keydown('ctrl+b') }), 'background-tasks', 'backgroundTasks ctrl+b (main.jsx leaves it to a focused text field)');
  assert.equal(globalShortcutCommand({ ...keydown('cmd+b'), altKey: true }), null);
  assert.equal(globalShortcutCommand(keydown('ctrl+,')), 'settings');
  assert.equal(globalShortcutCommand(keydown('ctrl+n')), 'new-session');
  assert.equal(globalShortcutCommand(keydown('ctrl+k')), 'search');
  assert.equal(globalShortcutCommand({ ...keydown('cmd+k'), key: 'K' }), 'search', 'pB matches the key case-insensitively (Caps Lock ⌘K)');
  assert.equal(globalShortcutCommand(keydown('cmd+shift+k')), 'search-palette', '⇧⌘K is search_palette, not ⌘K');
  assert.equal(globalShortcutCommand(keydown('ctrl+shift+k')), null, 'search_palette is Meta only');
  assert.equal(globalShortcutCommand({ ...keydown('cmd+shift+k'), altKey: true }), null);
  assert.equal(globalShortcutCommand(keydown('cmd+shift+]')), null, '⌘⇧] is the session cycle, not Forward');
  assert.equal(globalShortcutCommand(keydown('cmd+[')), 'back');
  assert.equal(globalShortcutCommand(keydown('cmd+]')), 'forward');
  assert.equal(globalShortcutCommand({ ...keydown('cmd+\\'), altKey: true }), null);
  assert.equal(globalShortcutCommand(keydown('cmd+shift+d')), null, 'pane chords are paneShortcutKind’s');
  assert.equal(globalShortcutCommand(keydown('esc')), null);
  // pR ⌘W / reopenClosed ⇧⌘T are Meta only; ⇧⌘W is the menu's Close Window. ⌃O is Control only.
  assert.equal(globalShortcutCommand(keydown('cmd+w')), 'close-session');
  assert.equal(globalShortcutCommand(keydown('cmd+shift+w')), null);
  assert.equal(globalShortcutCommand(keydown('ctrl+w')), null);
  assert.equal(globalShortcutCommand({ ...keydown('cmd+w'), altKey: true }), null);
  assert.equal(globalShortcutCommand({ ...keydown('cmd+w'), isComposing: true }), null);
  assert.equal(globalShortcutCommand({ ...keydown('cmd+w'), key: 'ц' }), 'close-session', 'a non-ASCII layout falls back to KeyW (fR)');
  assert.equal(globalShortcutCommand(keydown('cmd+shift+t')), 'reopen-closed');
  assert.equal(globalShortcutCommand(keydown('cmd+t')), null);
  assert.equal(globalShortcutCommand(keydown('ctrl+shift+t')), null);
  assert.equal(globalShortcutCommand(keydown('ctrl+o')), 'transcript-view');
  assert.equal(globalShortcutCommand(keydown('cmd+o')), null);
  assert.equal(globalShortcutCommand(keydown('ctrl+shift+o')), null);
  assert.equal(globalShortcutCommand({ ...keydown('ctrl+o'), isComposing: true }), null);
});

test('searchShortcutAction: ⌘K toggles the palette, ⇧⌘K opens it (or switches it) in search mode; the sidebar never docks', () => {
  assert.equal(searchShortcutAction({ showSearch: false, toggle: true }), 'open');
  assert.equal(searchShortcutAction({ showSearch: 'default', toggle: true }), 'close');
  assert.equal(searchShortcutAction({ showSearch: 'search', toggle: true }), 'close');
  assert.equal(searchShortcutAction({ showSearch: false, toggle: false }), 'open-search');
  assert.equal(searchShortcutAction({ showSearch: 'default', toggle: false }), 'open-search');
  assert.equal(searchShortcutAction(), 'open-search');
});

test('main.jsx routes the handler through globalShortcutCommand and renders the dialog; ⌘/ opens (I = v(!0))', () => {
  const main = readFileSync(path.resolve(import.meta.dirname, '../src/main.jsx'), 'utf8');
  assert.match(main, /const command = globalShortcutCommand\(e\);/);
  assert.match(main, /if \(command === "shortcuts"\) \{\s*e\.preventDefault\(\); e\.stopPropagation\(\);/);
  assert.match(main, /setActionDialog\(\(dialog\) => dialog\?\.kind === "shortcuts" \? dialog : \{ kind: "shortcuts" \}\)/);
  assert.match(main, /<KeyboardShortcutsDialog /);
  assert.doesNotMatch(main, /Slash commands","Type \//, 'the six-row stub is gone');
  // Escape: a consumed Escape closes nothing; otherwise only the topmost local layer.
  // Fidelity F08: the collapsed sidebar's open peek is a layer between the dialogs and the search (Nb / uR).
  assert.match(main, /if \(e\.key === "Escape" && !e\.defaultPrevented\) \{\s*if \(menu\) setMenu\(null\);\s*else if \(rename\) setRename\(null\);\s*else if \(actionDialog\) setActionDialog\(null\);\s*(?:\/\/[^\n]*\n\s*)*else if \(closePeek\(\{ focusTrigger: true \}\)\) e\.preventDefault\(\);\s*else if \(showSearch\) setShowSearch\(false\);/);
  // A hidden search never filters.
  assert.match(main, /useLayoutEffect\(\(\) => \{ if \(!showSearch\) setSearch\(""\); \}, \[showSearch\]\);/);
});

test('official chords: ⌘⌥↑/↓ prompt jumps, ⌃B background tasks, ⌘U add files', async () => {
  const { globalShortcutCommand, shortcutsDialogSections } = await import('../src/shortcuts-dialog-model.mjs');
  const { promptJumpIndex } = await import('../src/transcript-feed-nav.mjs');
  assert.equal(globalShortcutCommand({ metaKey: true, altKey: true, key: 'ArrowUp', code: 'ArrowUp' }), 'jump-prev-prompt');
  assert.equal(globalShortcutCommand({ metaKey: true, altKey: true, key: 'ArrowDown', code: 'ArrowDown' }), 'jump-next-prompt');
  assert.equal(globalShortcutCommand({ ctrlKey: true, key: 'b', code: 'KeyB' }), 'background-tasks');
  assert.equal(globalShortcutCommand({ metaKey: true, key: 'b', code: 'KeyB' }), 'toggle-sidebar');
  assert.equal(globalShortcutCommand({ metaKey: true, key: '.', code: 'Period' }), 'toggle-sidebar', 'kR ⌘.');
  assert.equal(globalShortcutCommand({ metaKey: true, shiftKey: true, key: '>', code: 'Period' }), null);
  assert.equal(globalShortcutCommand({ metaKey: true, key: 'u', code: 'KeyU' }), 'file-upload');
  assert.equal(globalShortcutCommand({ metaKey: true, shiftKey: true, key: 'u', code: 'KeyU' }), null);
  const rows = shortcutsDialogSections().flatMap((section) => section.rows.map((row) => row.command));
  for (const command of ['jump-prev-prompt', 'jump-next-prompt', 'background-tasks', 'file-upload', 'attach-selection']) assert.ok(rows.includes(command), command);
  assert.equal(promptJumpIndex([-300, -20, 2, 400], -1), 1);
  assert.equal(promptJumpIndex([-300, -20, 2, 400], 1), 3);
  assert.equal(promptJumpIndex([10, 400], -1), -1);
  assert.equal(promptJumpIndex([], 1), -1);
});
