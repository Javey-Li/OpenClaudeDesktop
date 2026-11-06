import test from "node:test";
import assert from "node:assert/strict";
import {
  boardTotals,
  conversationSources,
  createMockBoardSnapshot,
  groupConversations,
  relativeLabel,
  routeCapture,
} from "../src/board-view-model.mjs";

test("the mock board carries the full page: report, three columns and 22 conversations", () => {
  const snapshot = createMockBoardSnapshot();
  assert.equal(snapshot.schemaVersion, "psa.board.v1");
  assert.equal(snapshot.report.lines.length, 4);
  assert.equal(snapshot.columns.decide.length, 4);
  assert.equal(snapshot.columns.done.length, 4);
  assert.equal(snapshot.columns.stuck.length, 3);
  assert.equal(snapshot.projects.length, 5);
  assert.equal(boardTotals(snapshot).conversations, 22);
});

test("conversations stay grouped per project, newest first", () => {
  const groups = groupConversations(createMockBoardSnapshot().projects);
  assert.deepEqual(groups.map((group) => group.name), ["Fret Sense", "Delicacy", "GuitarOS", "DAWdex", "Mission"]);
  for (const group of groups) {
    for (let index = 1; index < group.conversations.length; index++) {
      assert.ok(Date.parse(group.conversations[index - 1].updatedAt) >= Date.parse(group.conversations[index].updatedAt));
    }
  }
  assert.deepEqual(conversationSources(groups).map((source) => source.id), ["superagent", "t3", "codex"]);
});

test("a note goes to the superagent Trigger and a link becomes an Issue", () => {
  const note = routeCapture({ mode: "note", text: "S05 第四小节先保留" });
  assert.equal(note.ok, true);
  assert.equal(note.kind, "trigger");
  assert.equal(note.target, "superagent.inbox");
  assert.match(note.message, /Trigger/);

  const link = routeCapture({ mode: "link", text: "https://github.com/Javey-Li/OpenClaudeDesktop/issues/1" });
  assert.equal(link.ok, true);
  assert.equal(link.kind, "issue");
  assert.equal(link.target, "Javey-Li/OpenClaudeDesktop");
  assert.match(link.message, /Issue/);

  assert.equal(routeCapture({ mode: "link", text: "not a url" }).ok, false);
  assert.equal(routeCapture({ mode: "note", text: "   " }).ok, false);
});

test("the empty variant keeps a real empty state instead of pretending", () => {
  const snapshot = createMockBoardSnapshot({ empty: true });
  assert.equal(snapshot.report, null);
  assert.deepEqual(snapshot.projects, []);
  assert.deepEqual(snapshot.columns, { decide: [], done: [], stuck: [] });
  assert.equal(boardTotals(snapshot).conversations, 0);
});

test("relative time is read against the report's clock, not the test day", () => {
  assert.equal(relativeLabel("2026-11-07T08:39:30+09:00", "2026-11-07T08:40:00+09:00"), "刚刚");
  assert.equal(relativeLabel("2026-11-07T08:10:00+09:00", "2026-11-07T08:40:00+09:00"), "30 分钟前");
  assert.equal(relativeLabel("2026-11-07T05:40:00+09:00", "2026-11-07T08:40:00+09:00"), "3 小时前");
});
