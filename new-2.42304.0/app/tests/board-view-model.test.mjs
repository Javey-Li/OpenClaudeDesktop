import test from "node:test";
import assert from "node:assert/strict";
import {
  boardTotals,
  buildBoardSnapshot,
  buildIssueDraft,
  buildRuleReport,
  classifyLine,
  conversationSources,
  groupConversations,
  isMainThread,
  MAIN_THREAD_NAME,
  projectFor,
  relativeLabel,
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
          { id: "codex:1", projectId: "fretsense", project: "FretSense", title: "修好识别回放", source: "codex",
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
        conversations: [{ id: "t3:1", projectId: "fretsense", project: "FretSense", title: "白皮书审查", source: "t3",
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
  assert.deepEqual(groups.map((group) => group.name), ["FretSense", "Delicacy"]);
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
  assert.equal(projectFor({ path: "/Users/javeyli/Projects/personal-super-agent-desktop" }).name, "personal-super-agent");
  assert.equal(projectFor({ path: "/Users/javeyli/Projects/Eunoia" }).name, "其他");
});

test("old and archived conversations are folded out of the recent list", () => {
  const snapshot = buildBoardSnapshot({
    now,
    sources: {
      codex: {
        ok: true,
        conversations: [
          { id: "codex:recent", projectId: "fretsense", project: "FretSense", title: "最近的事", status: "done", updatedAt: "2026-11-07T03:00:00.000Z" },
          { id: "codex:old", projectId: "fretsense", project: "FretSense", title: "旧的事", status: "done", updatedAt: "2026-10-01T03:00:00.000Z" },
          { id: "codex:archived", projectId: "delicacy", project: "Delicacy", title: "归档的事", status: "done", updatedAt: "2026-11-07T02:00:00.000Z", archived: true },
        ],
        columns: { decide: [], done: [], stuck: [] },
      },
    },
  });
  assert.equal(snapshot.totals.conversations, 1);
  assert.equal(snapshot.older.count, 2);
  assert.equal(snapshot.older.archived, 1);
});

test("capture drafts a note or link for the selected project", () => {
  const note = buildIssueDraft({ projectId: "fretsense", mode: "note", text: "S05 第四小节先保留" });
  assert.equal(note.ok, true);
  assert.equal(note.repo, "Javey-Li/FretSense");
  assert.match(note.title, /S05/);

  const link = buildIssueDraft({ projectId: "personal-super-agent", mode: "link", text: "https://github.com/Javey-Li/OpenClaudeDesktop/issues/1" });
  assert.equal(link.ok, true);
  assert.equal(link.repo, "Javey-Li/personal-super-agent");
  assert.match(link.title, /链接/);

  assert.equal(buildIssueDraft({ projectId: "guitaros", mode: "note", text: "x" }).ok, false);
  assert.equal(buildIssueDraft({ projectId: "", mode: "note", text: "x" }).ok, false);
  assert.equal(buildIssueDraft({ projectId: "fretsense", mode: "link", text: "not a url" }).ok, false);
  assert.equal(buildIssueDraft({ projectId: "fretsense", mode: "note", text: "   " }).ok, false);
});

test("relative time is read against the board clock", () => {
  assert.equal(relativeLabel("2026-11-07T03:59:30.000Z", now), "刚刚");
  assert.equal(relativeLabel("2026-11-07T03:30:00.000Z", now), "30 分钟前");
  assert.equal(relativeLabel("2026-11-07T01:00:00.000Z", now), "3 小时前");
});

test("the executive Codex conversation is named by its role", () => {
  for (const title of [
    "标题：接管 Fret Sense 首席职责",
    "@标题：接管 Fret Sense 首席职责 @标题：接管 Fret Sense 首席职责 现在你负责总结这两个对话的…",
    "标题接管 Fret Sense 首席职责",
    "接手超级代理主对话",
  ]) assert.equal(isMainThread({ title }), true, title);
  assert.equal(isMainThread({ title: "接管 Fret Sense 的一个普通写线" }), false);
  assert.equal(MAIN_THREAD_NAME, "执行总负责 · Codex 主对话");

  const snapshot = buildBoardSnapshot({
    now,
    sources: {
      codex: {
        ok: true,
        conversations: [{ id: "codex:main", projectId: "fretsense", project: "FretSense",
          title: "标题：接管 Fret Sense 首席职责", status: "running", updatedAt: now, preview: "**结论**：正在收口。" }],
        columns: { decide: [], done: [], stuck: [] },
      },
    },
  });
  const row = snapshot.projects.flatMap((project) => project.conversations)[0];
  assert.equal(row.projectId, "personal-super-agent");
  assert.equal(row.title, MAIN_THREAD_NAME);
  assert.equal(row.main, true);
  assert.equal(row.summary, "正在收口。");
});

test("line names and Issue repos beat a stale workspace project", () => {
  assert.equal(classifyLine({ projectId: "personal-super-agent", title: "L4j 总看板三级页面" }).id, "personal-super-agent");
  assert.equal(classifyLine({ projectId: "personal-super-agent", title: "L8c 接 L8b 收口" }).id, "fretsense");
  assert.equal(classifyLine({ projectId: "personal-super-agent", title: "L15e 0/120 docs 口径" }).id, "fretsense");
  assert.equal(classifyLine({ projectId: "personal-super-agent", title: "V4i 钢琴卷帘回最早版" }).id, "dawdex");
  assert.equal(classifyLine({ projectId: "fretsense", title: "SB3 Obsidian P1" }).id, "obsidian");
  assert.equal(classifyLine({ projectId: "fretsense", title: "R-46 总看板三级页面" }).id, "personal-super-agent");
  assert.equal(classifyLine({ projectId: "personal-super-agent", title: "收口 PR 114",
    preview: "对应 Javey-Li/FretSense Issue #5" }).id, "fretsense");
  assert.equal(classifyLine({ projectId: "fretsense", title: "普通维护" }), null);
});

test("a stored prompt becomes a short line name, not the whole instruction block", () => {
  const snapshot = buildBoardSnapshot({
    now,
    sources: {
      codex: {
        ok: true,
        conversations: [{ id: "codex:prompt", projectId: "personal-super-agent", project: "personal-super-agent",
          title: "你是 L4j 总看板三级页面写线，接续现有工作树。任务：完成 R-43/R-46。",
          status: "running", updatedAt: now, preview: "正在跑" }],
        columns: { decide: [], done: [], stuck: [] },
      },
    },
  });
  assert.equal(snapshot.projects[0].conversations[0].title, "L4j 总看板三级页面写线");
});
