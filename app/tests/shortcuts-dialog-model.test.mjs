import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SHORTCUTS_DIALOG_KEYS, globalShortcutCommand, searchShortcutAction, shortcutsDialogSections } from '../src/shortcuts-dialog-model.mjs';
import { archiveChord, isMetaJumpChord, jumpDigit } from '../src/sidebar-jump-model.mjs';
import { chinShortcutCommand, modeMenuDigit } from '../src/chin-shortcuts.mjs';
import { paneShortcutKind } from '../src/pane-shortcuts.mjs';
import { escapeAction } from '../src/composer-keys-model.mjs';
import { digitIndex } from '../src/menu-model.mjs';
import { shortcutCaps } from '../src/shortcut-model.mjs';
import { sessionCycleDelta } from '../src/session-cycle-model.mjs';

// shared-21-D098Wd--.js:14946-15420 zR, filtered to the chords this app binds.
const CODES = { ',': 'Comma', '/': 'Slash', '\\': 'Backslash', '[': 'BracketLeft', ']': 'BracketRight', esc: 'Escape', tab: 'Tab', backspace: 'Backspace' };
// A macOS keydown for one key spec ("cmd+shift+d" -> metaKey, shiftKey, key "D", code "KeyD").
function keydown(spec) {
  const parts = spec.split('+'), key = parts.at(-1), mods = new Set(parts.slice(0, -1));
  const shiftKey = mods.has('shift');
  const letter = /^[a-z]$/.test(key), digit = /^\d$/.test(key);
  return {
    metaKey: mods.has('cmd'), shiftKey, altKey: mods.has('alt'), ctrlKey: mods.has('ctrl'), isComposing: false, repeat: false,
    key: key === 'esc' ? 'Escape' : key === 'tab' ? 'Tab' : key === 'backspace' ? 'Backspace' : letter ? (shiftKey ? key.toUpperCase() : key) : key,
    code: letter ? `Key${key.toUpperCase()}` : digit ? `Digit${key}` : CODES[key],
  };
}
// "1…9" names the nine digit keys (after any modifiers: "cmd+1…9").
const expand = (spec) => spec.endsWith('1…9') ? Array.from({ length: 9 }, (_, index) => spec.replace('1…9', String(index + 1))) : [spec];
// What each handler does with the event; the dialog row's command must be one of them.
function bound(event) {
  const global = globalShortcutCommand(event);
  if (global) return global;
  // Km's keydown (session-cycle-model.mjs) runs in the same main.jsx handler.
  const cycle = sessionCycleDelta(event);
  if (cycle) return cycle > 0 ? 'next-session' : 'previous-session';
  const pane = paneShortcutKind(event);
  if (pane) return pane;
  // SourceSidebar's window keydown: bL ⌘1–9 jump and rg ⌘⇧⌫ archive (sidebar-jump-model.mjs).
  if (isMetaJumpChord(event) && jumpDigit(event)) return 'jump-session';
  if (archiveChord(event)) return 'archive-session';
  const chin = chinShortcutCommand(event);
  if (chin) return chin;
  // The composer editor's keydown hands Escape to escapeAction (source-composer.jsx); a running turn stops.
  if (event.key === 'Escape' && escapeAction({ event, running: true }) === 'stop') return 'stop';
  // SourceMenu picks the item whose data-number-key is the digit; the Mode menu claims Digit1-9 (modeMenuDigit).
  const digit = modeMenuDigit(event);
  if (digit >= 1 && digitIndex(['1', '2', '3', '4', '5', '6', '7', '8', '9'], event.key) === digit - 1) return 'menu-item';
  return null;
}

test('three zR sections, General / Panes / Composer, with the original labels', () => {
  const sections = shortcutsDialogSections({ fastMode: true });
  assert.deepEqual(sections.map((section) => section.title), ['General', 'Panes', 'Composer']);
  assert.deepEqual(sections.map((section) => section.rows.map((row) => row.label)), [
    ['Search sessions', 'Search', 'Toggle sidebar', 'Keyboard shortcuts', 'Settings', 'New session', 'Close tab, pane, or session', 'Reopen closed session',
      'Next session', 'Previous session', 'Jump to session', 'Archive session', 'Transcript view', 'Stop DeepSeek’s response'],
    ['Toggle changes', 'Toggle file list in changes or files', 'Toggle Files', 'Close pane', 'Expand or collapse pane'],
    ['Open mode menu', 'Open model menu', 'Open effort selector', 'Toggle fast mode', 'Select menu item'],
  ]);
  // zR shows Toggle fast mode only when a model offers it.
  assert.deepEqual(shortcutsDialogSections().at(-1).rows.map((row) => row.command), ['mode', 'model', 'effort', 'menu-item']);
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
    search: ['⌘K'], 'search-palette': ['⇧⌘K'], 'toggle-sidebar': ['⌘B'], shortcuts: ['⌘/'], settings: ['⌘,'], 'new-session': ['⌘N'],
    'close-session': ['⌘W'], 'reopen-closed': ['⇧⌘T'],
    'next-session': ['⇧⌘]', '⌃⇥'], 'previous-session': ['⇧⌘[', '⌃⇧⇥'], 'jump-session': ['⌘1…9'], 'archive-session': ['⇧⌘⌫'], 'transcript-view': ['⌃O'], stop: ['Esc'],
    changes: ['⇧⌘D'], 'file-list': ['⇧⌘Y'], files: ['⇧⌘F'], 'close-pane': ['⌘\\'], 'expand-pane': ['⇧⌘\\'],
    mode: ['⇧⌘M'], model: ['⇧⌘I'], effort: ['⇧⌘E'], fast: ['⌥⌘F'], 'menu-item': ['1…9'],
  });
  assert.equal(SHORTCUTS_DIALOG_KEYS, 'cmd+/');
});

test('globalShortcutCommand keeps the main handler predicates', () => {
  assert.equal(globalShortcutCommand(keydown('cmd+/')), 'shortcuts');
  assert.equal(globalShortcutCommand({ ...keydown('cmd+/'), shiftKey: true, key: '?' }), null, '⇧⌘/ is not the shortcuts chord');
  assert.equal(globalShortcutCommand({ ...keydown('cmd+/'), isComposing: true }), null);
  assert.equal(globalShortcutCommand({ ...keydown('ctrl+b') }), null, 'Ctrl+B stays the text fields’ move-backward key');
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

test('searchShortcutAction: ⌘K toggles, ⇧⌘K opens; a narrow viewport floats the peek, else the sidebar docks', () => {
  assert.equal(searchShortcutAction({ collapsed: true, narrow: false, showSearch: false, toggle: true }), 'open-expand');
  assert.equal(searchShortcutAction({ collapsed: false, narrow: false, showSearch: false, toggle: true }), 'open-expand');
  assert.equal(searchShortcutAction({ collapsed: false, narrow: true, showSearch: false, toggle: true }), 'open-peek');
  assert.equal(searchShortcutAction({ collapsed: true, narrow: true, showSearch: false, toggle: false }), 'open-peek');
  assert.equal(searchShortcutAction({ collapsed: true, narrow: false, showSearch: true, toggle: true }), 'close');
  assert.equal(searchShortcutAction({ collapsed: false, narrow: true, showSearch: true, toggle: true }), 'close');
  assert.equal(searchShortcutAction({ collapsed: true, narrow: false, showSearch: true, toggle: false }), 'focus');
  assert.equal(searchShortcutAction(), 'open-expand');
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
