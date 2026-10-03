import test from 'node:test';
import assert from 'node:assert/strict';
import { RECENT_FOLDER_LIMIT, folderBasename, folderPickerBrowsesDirectly, parentDirectory, recentFolderRows, recentFolders } from '../src/recent-folders-model.mjs';

// Fidelity F03: composer folder picker (cc43287c9-BMbiZYzF.js:21638-21850 lH, :21921-21928 dH) over the
// recent list of c749529a1-BaBwa-p0.js S (most recent first, dismissal filter, at most 8).
const session = (cwd, updatedAt, createdAt = updatedAt) => ({ cwd, updatedAt, createdAt });

test('recents are the session folders by last activity (updatedAt, else createdAt), seconds or ms', () => {
  const list = recentFolders({ sessions: [
    session('/work/alpha', 100), session('/work/beta', 300), session('/work/alpha', 200), { cwd: '/work/gamma', createdAt: 250 },
    { cwd: '', updatedAt: 999 }, { updatedAt: 999 },
  ] });
  assert.deepEqual(list.map((entry) => entry.path), ['/work/beta', '/work/gamma', '/work/alpha']);
  // Codex seconds and ms timestamps compare on one scale.
  assert.deepEqual(recentFolders({ sessions: [session('/s', 1_700_000_000), session('/ms', 1_600_000_000_000)] }).map((entry) => entry.path), ['/s', '/ms']);
});

test('the chosen folder is prepended only when it is not already listed (dH)', () => {
  const sessions = [session('/work/alpha', 100), session('/work/beta', 300)];
  assert.deepEqual(recentFolders({ sessions, current: '/work/alpha' }).map((entry) => entry.path), ['/work/beta', '/work/alpha']);
  assert.deepEqual(recentFolders({ sessions, current: '/work/new' }).map((entry) => entry.path), ['/work/new', '/work/beta', '/work/alpha']);
  assert.deepEqual(recentFolders({ sessions: [], current: '/work/new' }), [{ path: '/work/new' }]);
});

test('a dismissed folder stays hidden until a session is created there after the dismissal (x)', () => {
  const sessions = [session('/work/alpha', 2_000_000, 1_000_000), session('/work/beta', 3_000_000, 1_000_000)];
  assert.deepEqual(recentFolders({ sessions, dismissedAt: { '/work/beta': 1_500_000_000 } }).map((entry) => entry.path), ['/work/alpha']);
  // updatedAt after the dismissal is not enough; createdAt must be later.
  assert.deepEqual(recentFolders({ sessions: [session('/work/beta', 4_000_000, 1_000_000)], dismissedAt: { '/work/beta': 2_000_000_000 } }), []);
  assert.deepEqual(recentFolders({ sessions: [session('/work/beta', 4_000_000, 3_000_000)], dismissedAt: { '/work/beta': 2_000_000_000 } }).map((entry) => entry.path), ['/work/beta']);
  // The current folder is still prepended even when dismissed (it is the chip's value).
  assert.deepEqual(recentFolders({ sessions, current: '/work/beta', dismissedAt: { '/work/beta': 1_500_000_000 } }).map((entry) => entry.path), ['/work/beta', '/work/alpha']);
});

test('at most 8 recents (_ = 8) before the current folder is prepended', () => {
  const sessions = Array.from({ length: 12 }, (_, index) => session(`/work/p${index}`, 100 + index));
  const list = recentFolders({ sessions });
  assert.equal(RECENT_FOLDER_LIMIT, 8);
  assert.equal(list.length, 8);
  assert.equal(list[0].path, '/work/p11');
  assert.equal(recentFolders({ sessions, current: '/elsewhere' }).length, 9);
});

test('rows: basename label, parent description only for colliding basenames, current checked and not dismissible', () => {
  const rows = recentFolderRows([{ path: '/a/app' }, { path: '/b/app' }, { path: '/c/site' }], '/b/app');
  assert.deepEqual(rows, [
    { path: '/a/app', label: 'app', description: '/a', checked: false, dismissible: true },
    { path: '/b/app', label: 'app', description: '/b', checked: true, dismissible: false },
    { path: '/c/site', label: 'site', description: undefined, checked: false, dismissible: true },
  ]);
  // DT: the parent is null at the root, so a root folder never gets a description.
  assert.equal(parentDirectory('/app'), null);
  assert.equal(parentDirectory('C:\\work\\app'), 'C:\\work');
  assert.equal(folderBasename('/work/app/'), 'app');
  assert.equal(recentFolderRows([{ path: '/app' }, { path: '/x/app' }])[0].description, undefined);
});

test('no folder and nothing recent: the chip browses directly (lH b)', () => {
  assert.equal(folderPickerBrowsesDirectly(recentFolders({ sessions: [], current: '' })), true);
  assert.equal(folderPickerBrowsesDirectly(recentFolders({ sessions: [], current: '/work' })), false);
  assert.equal(folderPickerBrowsesDirectly(recentFolders({ sessions: [session('/work', 1)] })), false);
});
