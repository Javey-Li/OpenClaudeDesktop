import test from 'node:test';
import assert from 'node:assert/strict';
import { FILE_MENU_LABELS, fileContextMenu, fileCopyChoices, fileLinkLabel } from '../src/file-context-menu-model.mjs';

// Mn (c856385e2-k3utJqnh.js :962-1060), Gg/Kg (panes-tile-current.js:6030-6085), l_ (:6809-6862), Rg (:5572-5588).
const shape = (entries) => entries.map((entry) => entry.kind === 'separator' ? '---'
  : entry.kind === 'submenu' ? [entry.label, entry.items.map((item) => item.label)] : entry.label);

test('file_browser: Attach as context, Copy ▸ (Absolute path, Relative path, Filename), separator, Show in Finder', () => {
  const entries = fileContextMenu({ surface: 'file_browser', root: '/work/space', path: 'src/app.js', canAttach: true, canShowInFinder: true });
  assert.deepEqual(shape(entries), ['Attach as context', ['Copy', ['Absolute path', 'Relative path', 'Filename']], '---', 'Show in Finder']);
  const copy = entries[1].items;
  assert.deepEqual(copy.map((item) => item.value), ['/work/space/src/app.js', 'src/app.js', 'app.js']);
  assert.equal(entries.at(-1).value, '/work/space/src/app.js');
  assert.ok(!entries.some((entry) => entry.label === FILE_MENU_LABELS.revealInTree), 'no Reveal in file tree in the tree');
});

test('no Attach as context without a composer; no Show in Finder without the reveal target', () => {
  assert.deepEqual(shape(fileContextMenu({ surface: 'file_browser', root: '/w', path: 'a.txt' })), [['Copy', ['Absolute path', 'Relative path', 'Filename']]]);
  assert.deepEqual(shape(fileContextMenu({ surface: 'file_browser', root: '/w', path: 'a.txt', canShowInFinder: true })), [['Copy', ['Absolute path', 'Relative path', 'Filename']], '---', 'Show in Finder']);
});

test('file_tab adds the Reveal in file tree section after the file items', () => {
  const entries = fileContextMenu({ surface: 'file_tab', root: '/w', path: 'nested/deep.txt', canAttach: true, canShowInFinder: true, canRevealInTree: true });
  assert.deepEqual(shape(entries), ['Attach as context', ['Copy', ['Absolute path', 'Relative path', 'Filename']], '---', 'Show in Finder', '---', 'Reveal in file tree']);
  assert.equal(entries.at(-1).action, 'reveal-in-tree');
  assert.equal(entries.at(-1).value, 'nested/deep.txt');
  // A missing tab (canRevealInTree false) and a path outside the working directory have no reveal.
  assert.deepEqual(shape(fileContextMenu({ surface: 'file_tab', root: '/w', path: 'x.txt' })), [['Copy', ['Absolute path', 'Relative path', 'Filename']]]);
  const outside = fileContextMenu({ surface: 'file_tab', root: '/w', path: '/etc/hosts', canRevealInTree: true });
  assert.deepEqual(shape(outside), [['Copy', ['Absolute path', 'Filename']]], 'an absolute outside path has no Relative path and no reveal');
});

test('copy choices are cwd-relative inside the workspace and strip control characters', () => {
  assert.deepEqual(fileCopyChoices('/w', '/w/src/a.ts'), { absolute: '/w/src/a.ts', relative: 'src/a.ts', filename: 'a.ts' });
  assert.deepEqual(fileCopyChoices('/w/', 'a.ts'), { absolute: '/w/a.ts', relative: 'a.ts', filename: 'a.ts' });
  assert.deepEqual(fileCopyChoices('/w', 'dir/'), { absolute: '/w/dir', relative: 'dir/', filename: 'dir' });
  const entries = fileContextMenu({ root: '/w', path: 'a‮b.txt' });
  assert.equal(entries[0].items[1].value, 'ab.txt');
});

test('link labels (Rg)', () => {
  assert.equal(fileLinkLabel({ target: '../lib', state: 'ok' }), 'Link to ../lib');
  assert.equal(fileLinkLabel({ target: '/opt/x', state: 'external' }), 'Link to /opt/x, outside the working directory');
  assert.equal(fileLinkLabel({ target: 'gone', state: 'dangling' }), 'Broken link to gone');
  assert.equal(fileLinkLabel({ target: 'loop', state: 'cycle' }), 'Circular link to loop');
  assert.equal(fileLinkLabel({ target: '', state: 'ok' }), 'Symbolic link');
});
