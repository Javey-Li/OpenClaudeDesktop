import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { installedEditors, openInEditor, editorApp, EDITORS } = require('../electron/editors.cjs');

test('installed editors come from app bundles in /Applications or ~/Applications, sorted by name, without Xcode', () => {
  const present = new Set(['/Applications/Visual Studio Code.app', '/home/me/Applications/JetBrains Toolbox/WebStorm.app', '/Applications/Cursor.app', '/Applications/Xcode.app']);
  const list = installedEditors({ home: '/home/me', exists: (file) => present.has(file) });
  assert.deepEqual(list, [{ type: 'cursor', name: 'Cursor' }, { type: 'vscode', name: 'VS Code' }, { type: 'webstorm', name: 'WebStorm' }]);
  assert.ok(!EDITORS.some((editor) => /xcode/i.test(editor.type)));
  assert.equal(editorApp(EDITORS.find((e) => e.type === 'zed'), { home: '/h', exists: () => false }), null);
});

test('openInEditor runs open -a with the app bundle; it refuses unknown editors, relative or missing paths, and uninstalled apps', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'editors-'));
  const calls = [];
  const run = (file, args, options, done) => { calls.push([file, args]); done(null); };
  const exists = (file) => file === '/Applications/Zed.app';
  assert.equal(await openInEditor(dir, 'zed', { exists, run }), true);
  assert.deepEqual(calls, [['/usr/bin/open', ['-a', '/Applications/Zed.app', dir]]]);
  await assert.rejects(openInEditor(dir, 'notepad', { exists, run }), /Unknown editor/);
  await assert.rejects(openInEditor('relative/path', 'zed', { exists, run }), /Invalid file path/);
  await assert.rejects(openInEditor(path.join(dir, 'missing'), 'zed', { exists, run }), /no longer exists/);
  await assert.rejects(openInEditor(dir, 'cursor', { exists, run }), /no longer installed/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the Files pane menu gets an Open in submenu of the editors, and Show in Finder loses its own separator', async () => {
  const { fileContextMenu } = await import('../src/file-context-menu-model.mjs');
  const editors = [{ type: 'cursor', name: 'Cursor' }, { type: 'vscode', name: 'VS Code' }];
  const entries = fileContextMenu({ root: '/repo', path: 'src/a.js', canShowInFinder: true, editors });
  const kinds = entries.map((entry) => entry.kind === 'submenu' ? `submenu:${entry.label}` : entry.kind === 'item' ? entry.action : entry.kind);
  assert.deepEqual(kinds, ['submenu:Copy', 'separator', 'submenu:Open in', 'show-in-finder']);
  assert.deepEqual(entries[2].items, [
    { kind: 'item', action: 'open-in-editor', label: 'Cursor', value: '/repo/src/a.js', editor: 'cursor' },
    { kind: 'item', action: 'open-in-editor', label: 'VS Code', value: '/repo/src/a.js', editor: 'vscode' },
  ]);
  const plain = fileContextMenu({ root: '/repo', path: 'src/a.js', canShowInFinder: true });
  assert.deepEqual(plain.map((entry) => entry.kind), ['submenu', 'separator', 'item']);
});
