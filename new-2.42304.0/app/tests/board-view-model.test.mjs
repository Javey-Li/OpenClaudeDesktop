import test from "node:test";
import assert from "node:assert/strict";
import {
  boardTotals,
  buildBoardSnapshot,
  buildRuleReport,
  conversationSources,
  groupConversations,
  projectFor,
  relativeLabel,
  routeCapture,
} from "../src/board-view-model.mjs";

const now = "2026-11-07T04:00:00.000Z";

function fixture() {
  return buildBoardSnapshot({
    now,
    sources: {
      codex: {
        ok: true,
        detail: "2 个会话",
        total: 2,
        conversations: [
          { id: "codex:1", projectId: "fretsense", project: "Fret Sense", title: "修好识别回放", source: "codex",
            status: "running", updatedAt: "2026-11-07T03:58:00.000Z", preview: "正在核对第二遍" },
          { id: "codex:2", projectId: "delicacy", project: "Delicacy", title: "第四小节复核", source: "codex",
            status: "done", updatedAt: "2026-11-07T03:20:00.000Z", preview: "已经收口" },
        ],
        columns: {
          decide: [],
          done: [{ id: "codex-done:2", projectId: "delicacy", project: "Delicacy", title: "第四小节复核", detail: "Codex 回合完成",
            kind: "会话", who: "Codex", at: "2026-11-07T03:20:00.000Z" }],
          stuck: [],
        },
      },
      t3: {
        ok: true,
        detail: "1 个线程 · T3 0.1.7",
        total: 1,
        conversations: [{ id: "t3:1", projectId: "fretsense", project: "Fret Sense", title: "白皮书审查", source: "t3",
          status: "done", updatedAt: "2026-11-06T20:00:00.000Z", preview: "FretSense · completed" }],
        columns: { decide: [], done: [], stuck: [] },
      },
      superagent: {
        ok: false,
        error: "3082 没回话",
        conversations: [],
        columns: { decide: [], done: [], stuck: [] },
        total: 0,
      },
    },
  });
}

test("real source results merge without filling a failed source", () => {
  const snapshot = fixture();
  assert.equal(snapshot.schemaVersion, "psa.board.v1");
  assert.equal(snapshot.projects.length, 2);
  assert.equal(boardTotals(snapshot).conversations, 3);
  assert.equal(snapshot.sources.find((source) => source.id === "superagent").status, "disconnected");
  assert.equal(snapshot.sources.find((source) => source.id === "superagent").detail, "没连上");
  assert.equal(snapshot.sources.find((source) => source.id === "codex").status, "connected");
  assert.equal(snapshot.columns.done.length, 1);
  assert.equal(snapshot.columns.decide.length, 0);
});

test("the rule report counts the columns and names the stuck items", () => {
  const snapshot = fixture();
  snapshot.columns.stuck.push({ id: "s1", title: "权限没回", detail: "", project: "GuitarOS", at: now });
  const report = buildRuleReport(snapshot);
  assert.equal(report.lines.length, 5);
  assert.match(report.lines[0].text, /1 件/);
  assert.match(report.lines[2].text, /权限没回/);
  assert.match(report.lines[3].text, /没有等你定的事/);
  assert.match(report.lines[4].text, /Superagent 没连上/);
});

test("no connected source stays empty and says which sources are down", () => {
  const snapshot = buildBoardSnapshot({
    now,
    sources: {
      codex: { ok: false, error: "找不到会话目录", conversations: [], columns: {}, total: 0 },
      t3: { ok: false, error: "3773 没回话", conversations: [], columns: {}, total: 0 },
      superagent: { ok: false, error: "3082 没回话", conversations: [], columns: {}, total: 0 },
    },
  });
  assert.equal(snapshot.projects.length, 0);
  assert.equal(snapshot.sources.every((source) => source.status === "disconnected"), true);
  assert.match(snapshot.report.lines[4].text, /Codex、Superagent、T3 没连上/);
});

test("conversations stay grouped per project, newest first", () => {
  const groups = groupConversations(fixture().projects);
  assert.deepEqual(groups.map((group) => group.name), ["Fret Sense", "Delicacy"]);
  for (const group of groups) {
    for (let index = 1; index < group.conversations.length; index++) {
      assert.ok(Date.parse(group.conversations[index - 1].updatedAt) >= Date.parse(group.conversations[index].updatedAt));
    }
  }
  assert.deepEqual(conversationSources(groups).map((source) => source.id), ["codex", "superagent", "t3"]);
});

test("workspace paths map to the owner's project names", () => {
  assert.equal(projectFor({ path: "/Users/javeyli/Projects/FretSense" }).id, "fretsense");
  assert.equal(projectFor({ path: "/Users/javeyli/Projects/delicacy-html" }).name, "Delicacy");
  assert.equal(projectFor({ path: "/Users/javeyli/Projects/guitarOS/guitar-brain" }).name, "GuitarOS");
  assert.equal(projectFor({ path: "/Users/javeyli/Projects/personal-super-agent-desktop" }).name, "Personal super agent");
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

test("relative time is read against the board clock", () => {
  assert.equal(relativeLabel("2026-11-07T03:59:30.000Z", now), "刚刚");
  assert.equal(relativeLabel("2026-11-07T03:30:00.000Z", now), "30 分钟前");
  assert.equal(relativeLabel("2026-11-07T01:00:00.000Z", now), "3 小时前");
});
