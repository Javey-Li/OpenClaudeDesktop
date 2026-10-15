import test from "node:test";
import assert from "node:assert/strict";
import { digitFor, moveToGroupRows, multiHotkeys, multiMenuState, openSessionLast, pinTargets } from "../src/sidebar-bulk-model.mjs";

const sessions = [{ id: "a" }, { id: "b" }, { id: "c" }];

test("c39a247c4 X: Pin {count} counts the unpinned, Unpin {count} the pinned selected sessions", () => {
  const metadata = { b: { pinned: true } };
  assert.deepEqual(pinTargets(sessions, metadata, true).map((s) => s.id), ["a", "c"]);
  assert.deepEqual(pinTargets(sessions, metadata, false).map((s) => s.id), ["b"]);
  assert.deepEqual(multiMenuState(sessions, metadata), { count: 3, pin: { count: 2 }, unpin: { count: 1 } });
  assert.deepEqual(multiMenuState(sessions, {}), { count: 3, pin: { count: 3 }, unpin: undefined });
  assert.deepEqual(multiMenuState(sessions, { a: { pinned: true }, b: { pinned: true }, c: { pinned: true } }), { count: 3, pin: undefined, unpin: { count: 3 } });
  assert.deepEqual(pinTargets([{ id: "x", canPin: false }], {}, true), []);
});

test("_e: the open session is changed last", () => {
  assert.deepEqual(openSessionLast(sessions, "a").map((s) => s.id), ["b", "c", "a"]);
  assert.deepEqual(openSessionLast(sessions, null).map((s) => s.id), ["a", "b", "c"]);
});

test("Me hotkeys: p pins first, else unpins; a unarchives an all-archived selection", () => {
  assert.deepEqual(multiHotkeys({ pin: { count: 1 }, unpin: { count: 1 } }), [["p", "pin"], ["u", "mark-unread"], ["a", "archive"], ["d", "delete"]]);
  assert.deepEqual(multiHotkeys({ unpin: { count: 2 } }, { allArchived: true }), [["p", "unpin"], ["u", "mark-unread"], ["a", "unarchive"], ["d", "delete"]]);
  assert.deepEqual(multiHotkeys({}), [["u", "mark-unread"], ["a", "archive"], ["d", "delete"]]);
});

test("lz: groups are numbered radios, Ungrouped only for an assigned session, New group… last", () => {
  const groups = [{ id: "g1", name: "Research" }, { id: "g2", name: "Ideas" }];
  assert.deepEqual(moveToGroupRows({ customGroups: groups, currentGroupId: "g2" }), [
    { kind: "group", id: "g1", name: "Research", checked: false, digit: "1" },
    { kind: "group", id: "g2", name: "Ideas", checked: true, digit: "2" },
    { kind: "separator" },
    { kind: "ungrouped", id: null, checked: false, digit: "3" },
    { kind: "create", digit: "4" },
  ]);
  assert.deepEqual(moveToGroupRows({ customGroups: groups, currentGroupId: undefined }).map((row) => row.kind + (row.digit ?? "")),
    ["group1", "group2", "separator", "create3"]);
  assert.deepEqual(moveToGroupRows({ customGroups: [], currentGroupId: null }).map((row) => row.kind + (row.digit ?? "")), ["create1"]);
  assert.deepEqual(moveToGroupRows({ customGroups: groups, currentGroupId: "g1", canCreate: false }).map((row) => row.kind), ["group", "group", "separator", "ungrouped"]);
  assert.equal(moveToGroupRows({ customGroups: groups, currentGroupId: "g1", numbered: false })[0].digit, undefined);
  assert.equal(digitFor(8), "9");
  assert.equal(digitFor(9), undefined);
});
