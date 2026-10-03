import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskOutputFollow } from '../src/task-output-follow.mjs';

function output(selection = null) {
  const inside = {};
  return { inside, scrollHeight: 1000, clientHeight: 200, scrollTop: 0,
    contains: node => node === inside, ownerDocument: { defaultView: { getSelection: () => selection } } };
}
test('task output follows initially, remembers user pause after reopen, and resumes only within 16px', () => {
  const follow = createTaskOutputFollow(), node = output();
  follow.update('session:item', node); assert.equal(node.scrollTop, 1000);
  node.scrollTop = 300; follow.record('session:item', node);
  const reopened = output(); follow.update('session:item', reopened); assert.equal(reopened.scrollTop, 0);
  reopened.scrollTop = 784; follow.record('session:item', reopened); follow.update('session:item', reopened);
  assert.equal(reopened.scrollTop, 784, 'exactly 16px remains paused in source zb');
  reopened.scrollTop = 785; follow.record('session:item', reopened); follow.update('session:item', reopened);
  assert.equal(reopened.scrollTop, 1000);
});
test('only a noncollapsed selection anchored inside this output pauses following', () => {
  const selection = { isCollapsed: false, anchorNode: null }, node = output(selection), follow = createTaskOutputFollow();
  selection.anchorNode = node.inside; follow.update('key', node); assert.equal(node.scrollTop, 0);
  selection.anchorNode = {}; follow.update('key', node); assert.equal(node.scrollTop, 1000);
  node.scrollTop = 0; selection.anchorNode = node.inside; selection.isCollapsed = true;
  follow.update('key', node); assert.equal(node.scrollTop, 1000);
});
test('session identity separates matching item IDs and bounded cache drops oldest follow intent', () => {
  const follow = createTaskOutputFollow(2), node = output();
  follow.record(JSON.stringify(['a','item']), node);
  follow.update(JSON.stringify(['b','item']), node); assert.equal(node.scrollTop, 1000);
  node.scrollTop = 0; follow.record('second', node); follow.record('third', node);
  follow.update(JSON.stringify(['a','item']), node); assert.equal(node.scrollTop, 1000);
  const other = output(); follow.update('second', other); assert.equal(other.scrollTop, 0);
  follow.update('missing-element', null);
});
