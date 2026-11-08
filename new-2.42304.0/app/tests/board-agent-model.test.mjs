import test from "node:test";
import assert from "node:assert/strict";
import { buildBoardSnapshot } from "../src/board-view-model.mjs";
import { buildProjectBriefs, buildBriefSummary } from "../src/board-brief-model.mjs";
import { buildAgentInbox, contextTone, filterInbox } from "../src/board-agent-model.mjs";
import { buildBoardLevels } from "../src/board-levels-model.mjs";
import { staleConversation } from "../src/board-stuck-model.mjs";

const now = "2026-11-07T04:00:00.000Z";
const ago = (hours) => new Date(Date.parse(now) - hours * 3_600_000).toISOString();
const empty = { decide: [], done: [], stuck: [] };

function superagent({ conversations = [], columns = empty, settled = [] } = {}) {
  return { ok: true, detail: "x", total: conversations.length, conversations, columns, settled };
}

const thread = (number, status, hours = 2) => ({
  id: `superagent:github:${number}`, projectId: "fretsense", project: "FretSense", title: `#${number} docs: 治理来源`,
  source: "superagent", status, updatedAt: ago(hours), threadId: `github:${number}`,
});

test("merged or ended work leaves 卡住 and 没做完 and shows up as done", () => {
  const snapshot = buildBoardSnapshot({
    now,
    sources: {
      superagent: superagent({
        conversations: [thread(122, "stuck", 1), thread(117, "running", 3)],
        columns: {
          decide: [],
          done: [],
          stuck: [{ id: "superagent-stuck:117", projectId: "fretsense", project: "FretSense", title: "#117 LOOP_BACKLOG 标点", detail: "来源出错", kind: "问题", who: "Superagent", at: ago(1) }],
        },
        settled: [{ ref: 122, outcome: "merged", at: ago(1) }, { ref: 117, outcome: "merged", at: ago(3) }],
      }),
    },
  });
  const conversations = snapshot.projects.flatMap((project) => project.conversations);
  assert.deepEqual(conversations.map((row) => row.status), ["done", "done"]);
  assert.equal(snapshot.columns.stuck.length, 0);
  assert.match(snapshot.columns.done[0].detail, /^已合并 · 来源出错/);
  assert.equal(snapshot.totals.running, 0);
  const summary = buildBriefSummary(buildProjectBriefs({ projects: snapshot.projects, columns: snapshot.columns, now }));
  assert.equal(summary.stuck, 0);
  assert.equal(summary.open, 0);
});

test("work that is still open is not settled by a different number", () => {
  const snapshot = buildBoardSnapshot({
    now,
    sources: { superagent: superagent({ conversations: [thread(130, "stuck", 1)], settled: [{ ref: 122, outcome: "merged", at: ago(1) }] }) },
  });
  assert.equal(snapshot.projects[0].conversations[0].status, "stuck");
});

test("stale rows move to 已过去 instead of counting as open or stuck", () => {
  const stuckOld = { ...thread(140, "suspected", 20) };
  const runningOld = { ...thread(141, "running", 14) };
  const waitingOld = { ...thread(142, "waiting", 30) };
  const runningNow = { ...thread(143, "running", 0.2) };
  const snapshot = buildBoardSnapshot({ now, sources: { superagent: superagent({ conversations: [stuckOld, runningOld, waitingOld, runningNow] }) } });
  const briefs = buildProjectBriefs({ projects: snapshot.projects, columns: snapshot.columns, now });
  const summary = buildBriefSummary(briefs);
  assert.equal(summary.stuck, 0);
  assert.equal(summary.open, 2);
  assert.equal(summary.past, 2);
  assert.equal(snapshot.totals.running, 1);
  assert.equal(staleConversation({ status: "waiting", updatedAt: ago(30) }, now), null);
  assert.match(staleConversation({ status: "waiting", updatedAt: ago(80) }, now).reason, /3 天/);
});

test("the headline follows the data once nothing is stuck", () => {
  const snapshot = buildBoardSnapshot({ now, sources: { superagent: superagent({ conversations: [thread(122, "stuck", 1)], settled: [{ ref: 122, outcome: "merged", at: ago(1) }] }) } });
  const summary = buildBriefSummary(buildProjectBriefs({ projects: snapshot.projects, columns: snapshot.columns, now }));
  assert.equal(summary.stuck, 0);
  assert.equal(summary.decide, 0);
});

test("inbox merges a session's column row and conversation into one row with telemetry", () => {
  const context = { used: 4500, window: 10_000, percent: 45, parts: { cached: 3000, fresh: 1000, output: 500 }, reasoning: 0 };
  const tools = [{ id: "t", verb: "跑命令", object: "npm test", status: "running" }];
  const snapshot = buildBoardSnapshot({
    now,
    sources: {
      codex: {
        ok: true, total: 2,
        conversations: [
          { id: "codex:abc", threadId: "abc", projectId: "fretsense", project: "FretSense", title: "修回放", source: "codex", status: "suspected", updatedAt: ago(2), preview: "…", context, tools },
          { id: "codex:run", threadId: "run", projectId: "fretsense", project: "FretSense", title: "改指板", source: "codex", status: "running", updatedAt: ago(0.1), preview: "…", context, tools },
        ],
        columns: { decide: [], done: [], stuck: [{ id: "codex-stuck:abc", projectId: "fretsense", project: "FretSense", title: "修回放", detail: "可能卡住", kind: "会话", who: "Codex", at: ago(2) }] },
      },
      superagent: superagent({ columns: { decide: [{ id: "superagent-decide:1", projectId: "fretsense", project: "FretSense", title: "S07 要不要保留", detail: "等主人", kind: "工单", who: "Superagent", at: ago(1) }], done: [], stuck: [] } }),
    },
  });
  const inbox = buildAgentInbox({ columns: snapshot.columns, projects: snapshot.projects, now });
  assert.deepEqual(inbox.items.map((item) => item.state), ["decide", "stuck", "running"]);
  const stuck = inbox.items.find((item) => item.state === "stuck");
  assert.equal(stuck.context.percent, 45);
  assert.equal(stuck.tools.length, 1);
  assert.equal(inbox.items.find((item) => item.state === "running").step, "跑命令 · npm test");
  assert.deepEqual(filterInbox(inbox.items, "attention").map((item) => item.state), ["decide", "stuck"]);
  assert.equal(inbox.counts.running, 1);
});

test("superagent threads that already have a ticket row do not show twice as done", () => {
  const snapshot = buildBoardSnapshot({
    now,
    sources: {
      superagent: superagent({
        conversations: [thread(120, "done", 2)],
        columns: { decide: [], stuck: [], done: [{ id: "superagent-done:t1", projectId: "fretsense", project: "FretSense", title: "按 Issue #119 正文执行", detail: "工单已结束", kind: "工单", who: "Superagent", at: ago(2) }] },
      }),
    },
  });
  const inbox = buildAgentInbox({ columns: snapshot.columns, projects: snapshot.projects, now });
  assert.equal(inbox.items.length, 1);
});

test("stale rows and expired stuck rows land in the inbox's past list", () => {
  const snapshot = buildBoardSnapshot({ now, sources: { superagent: superagent({ conversations: [thread(140, "suspected", 20)] }) } });
  const inbox = buildAgentInbox({ columns: snapshot.columns, projects: snapshot.projects, now });
  assert.equal(inbox.items.length, 0);
  assert.equal(inbox.past.length, 1);
  assert.match(inbox.past[0].pastReason, /20 小时没有新事件/);
});

test("one stale thread in stuckPast and older appears once, and its project count agrees", () => {
  const snapshot = buildBoardSnapshot({
    now,
    sources: {
      codex: {
        ok: true, total: 1,
        conversations: [{ id: "codex:handoff", threadId: "handoff", projectId: "fretsense", project: "FretSense",
          title: "Context handoff (full_thread_summary):", source: "codex", status: "stuck", updatedAt: ago(96), preview: "handoff" }],
        columns: { decide: [], done: [], stuck: [{ id: "codex-stuck:handoff", projectId: "fretsense", project: "FretSense",
          title: "Context handoff (full_thread_summary):", detail: "Codex 回合中断", kind: "会话", who: "Codex", at: ago(96) }] },
      },
    },
  });
  assert.equal(snapshot.columns.stuckPast.length, 1);
  const inbox = buildAgentInbox({ columns: snapshot.columns, projects: snapshot.projects, older: snapshot.older.projects, now });
  assert.equal(inbox.past.length, 1);
  assert.equal(inbox.past[0].key, "codex:handoff");
  const levels = buildBoardLevels(snapshot);
  const fretsense = levels.projects.find((project) => project.id === "fretsense");
  assert.equal(fretsense.past.length, 1);
  assert.equal(fretsense.counts.past, 1);
});

test("context meter tone follows the fill level", () => {
  assert.equal(contextTone(12), "ok");
  assert.equal(contextTone(70), "warning");
  assert.equal(contextTone(90), "danger");
});

test("a thread that kept running past three days lands in the inbox's past list, not the live rows", () => {
  const snapshot = buildBoardSnapshot({
    now,
    sources: {
      codex: {
        ok: true, total: 2,
        conversations: [
          { id: "codex:old", threadId: "old", projectId: "fretsense", project: "FretSense", title: "旧线程", source: "codex", status: "running", updatedAt: ago(96), preview: "…" },
          { id: "codex:new", threadId: "new", projectId: "fretsense", project: "FretSense", title: "新线程", source: "codex", status: "running", updatedAt: ago(0.2), preview: "…" },
        ],
        columns: empty,
      },
    },
  });
  assert.equal(snapshot.totals.running, 1);
  const inbox = buildAgentInbox({ columns: snapshot.columns, projects: snapshot.projects, older: snapshot.older.projects, now });
  assert.deepEqual(inbox.items.map((item) => item.title), ["新线程"]);
  assert.deepEqual(inbox.past.map((item) => item.title), ["旧线程"]);
  assert.match(inbox.past[0].pastReason, /4 天没有新事件/);
});
