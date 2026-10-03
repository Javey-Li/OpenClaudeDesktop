import test from 'node:test';
import assert from 'node:assert/strict';
import { FILE_UNAVAILABLE_REASONS, VIEW_AS_TEXT_LABEL, fileTabReason, fileUnavailableCopy } from '../src/file-unavailable-model.mjs';

// cd2efac6e-CAi4fxTN.js (prettier): To/Un :3602-3740, binary :4604-4612 + Xo :4874-4897, empty :4336-4346.
test('each reason has the exact source title and body', () => {
  const copy = Object.fromEntries(FILE_UNAVAILABLE_REASONS.map((reason) => [reason, fileUnavailableCopy(reason)]));
  assert.deepEqual([copy.missing.title, copy.missing.body], ['Couldn’t find this file', 'It may have been deleted or moved.']);
  assert.deepEqual([copy.outside_root.title, copy.outside_root.body], ['This file is outside the working directory', 'It can’t be opened here, but it may still exist on disk.']);
  assert.deepEqual([copy.too_large.title, copy.too_large.body], ['Preview isn’t available for this file', 'It’s too large to preview here.']);
  assert.deepEqual([copy.read_error.title, copy.read_error.body], ['Couldn’t read this file', 'It may be unreadable, or the session’s connection may have dropped.']);
  assert.deepEqual([copy.binary.title, copy.binary.body, copy.binary.action], ['This file looks like binary data and can’t be previewed as text.', null, 'view-as-text']);
  assert.deepEqual([copy.empty.title, copy.empty.body, copy.empty.action], ['This file is empty.', null, null]);
  assert.equal(VIEW_AS_TEXT_LABEL, 'View as text anyway');
});

test('error cards are alerts that append the path; binary and empty are plain titles', () => {
  for (const reason of ['missing', 'outside_root', 'too_large', 'read_error']) {
    assert.equal(fileUnavailableCopy(reason).role, 'alert', reason);
    assert.equal(fileUnavailableCopy(reason).showsPath, true, reason);
  }
  for (const reason of ['binary', 'empty']) {
    assert.equal(fileUnavailableCopy(reason).role, undefined, reason);
    assert.equal(fileUnavailableCopy(reason).showsPath, false, reason);
  }
  assert.deepEqual(fileUnavailableCopy('nonsense'), fileUnavailableCopy('read_error'));
});

test('a tab reads as its unavailable reason, empty for an empty body, null otherwise', () => {
  assert.equal(fileTabReason({ path: 'a', unavailable: 'missing' }), 'missing');
  assert.equal(fileTabReason({ path: 'a', unavailable: 'weird' }), 'read_error');
  assert.equal(fileTabReason({ path: 'a', text: '' }), 'empty');
  assert.equal(fileTabReason({ path: 'a', text: 'x' }), null);
  assert.equal(fileTabReason({ path: 'a' }), null, 'still loading');
  assert.equal(fileTabReason(null), null);
});
