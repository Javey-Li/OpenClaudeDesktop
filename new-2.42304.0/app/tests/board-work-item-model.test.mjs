import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildBoardSnapshot } from "../src/board-view-model.mjs";
import { buildBoardLevels } from "../src/board-levels-model.mjs";
import { readT3TicketBindings } from "../electron/board-aggregator.mjs";

const now = "2026-11-09T04:00:00.000Z";
const ago = (hours) => new Date(Date.parse(now) - hours * 3_600_000).toISOString();

// Real fixture values, copied from this machine on 2026-11-09:
// - superagent ticket bc6ac72e... had control threads github:122 and github:123;
// - ~/.dsh/state/superagent-fretsense/t3-threads.json bound the same ticket to
//   mcp:launch:6a52d624...;
// - that T3 thread left a Codex provider session 01a1b613-a508-7... in
//   ~/.codex/sessions/2026/11/07.
// Only the titles are shortened; ids and relations are unchanged.
const TICKET_122_123 = "bc6ac72e0835fbb985fb46f98e83c0d8";
const T3_WORKER = "mcp:launch:6a52d62498f80c1bb1ec2bc2f09d8ac72d86a34e831938eb815dfbbe0e6586e3";
const CODEX_EXECUTOR = "01a1b613-a508-7183-a5c3-890ad5827a87";
const CODEX_CHILD = "01a1a4a7-be18-7f33-bf80-eeba0be86091";
const CODEX_CONTROL = "01a1a0ab-0efe-7b42-8193-24b2d48391df";

const empty = { decide: [], done: [], stuck: [] };

function superagentControl() {
  return {
    ok: true, total: 2,
    conversations: [
      { id: "superagent:github:122", threadId: "github:122", ticketId: TICKET_122_123,
        ticketTitle: "在 docs/README.md 治理来源列表补充 AGENTS.md 与 AGENT_STARTUP.md 两项",
        workItemRole: "control", projectId: "fretsense", project: "FretSense",
        title: "#122 docs: 治理来源", source: "superagent", status: "done", updatedAt: ago(20), preview: "已合并" },
      { id: "superagent:github:123", threadId: "github:123", ticketId: TICKET_122_123,
        ticketTitle: "在 docs/README.md 治理来源列表补充 AGENTS.md 与 AGENT_STARTUP.md 两项",
        workItemRole: "control", projectId: "fretsense", project: "FretSense",
        title: "#123 docs: 治理来源", source: "superagent", status: "done", updatedAt: ago(19), preview: "已合并" },
    ],
    columns: empty,
  };
}

function t3Worker(fields = {}) {
  return {
    ok: true, total: 1,
    conversations: [{
      id: `t3:${T3_WORKER}`, threadId: T3_WORKER, ticketId: TICKET_122_123, workItemRole: "execution",
      projectId: "fretsense", project: "FretSense", title: "docs: 治理来源",
      source: "t3", status: "running", updatedAt: ago(1), preview: "FretSense · running", ...fields,
    }],
    columns: empty,
  };
}

function codexExecutor() {
  return {
    ok: true, total: 1,
    conversations: [{
      id: `codex:${CODEX_EXECUTOR}`, threadId: CODEX_EXECUTOR, ticketId: TICKET_122_123,
      workItemRole: "execution", projectId: "fretsense", project: "FretSense",
      title: "Context handoff (full_thread_summary):", source: "codex", status: "done",
      updatedAt: ago(2), preview: "PR #123 的合并与落地内容已核验。",
    }],
    columns: empty,
  };
}

test("one Ticket's control and execution sessions count as one work item", () => {
  const snapshot = buildBoardSnapshot({
    now,
    sources: { superagent: superagentControl(), t3: t3Worker(), codex: codexExecutor() },
  });
  const levels = buildBoardLevels(snapshot);
  const fretsense = levels.projects.find((project) => project.id === "fretsense");
  assert.equal(fretsense.counts.lines, 1);
  assert.equal(fretsense.counts.sessions, 4);
  assert.equal(fretsense.sessionCounts.running, 1);
  assert.equal(fretsense.sessionCounts.done, 3);
  const line = fretsense.lines[0];
  assert.equal(line.workItemKey, `fretsense:ticket:${TICKET_122_123}`);
  assert.equal(line.sessionCount, 4);
  assert.equal(line.sessionLabel, "4 个会话 · 控制 2 · 执行 2");
  assert.deepEqual(line.sessions.map((session) => session.role).sort(), ["control", "control", "execution", "execution"]);
});

test("sessions without a Ticket or registered work-item id stay separate", () => {
  const snapshot = buildBoardSnapshot({
    now,
    sources: {
      codex: {
        ok: true, total: 2,
        conversations: [
          { id: "codex:a", threadId: "a", projectId: "fretsense", project: "FretSense",
            title: "同一个标题", source: "codex", status: "running", updatedAt: ago(1), preview: "…" },
          { id: "codex:b", threadId: "b", projectId: "fretsense", project: "FretSense",
            title: "同一个标题", source: "codex", status: "running", updatedAt: ago(1), preview: "…" },
        ],
        columns: empty,
      },
      t3: {
        ok: true, total: 1,
        conversations: [{ id: "t3:c", threadId: "c", projectId: "fretsense", project: "FretSense",
          title: "同一个标题", source: "t3", status: "running", updatedAt: ago(1), preview: "…" }],
        columns: empty,
      },
    },
  });
  const fretsense = buildBoardLevels(snapshot).projects.find((project) => project.id === "fretsense");
  assert.equal(fretsense.counts.lines, 3);
  assert.equal(fretsense.counts.sessions, 3);
  assert.equal(fretsense.lines.every((line) => line.workItemKey === null), true);
  assert.equal(fretsense.lines.every((line) => line.sessionCount === 1), true);
});

test("a real Codex parent/child lineage is one work item with control and execution", () => {
  const snapshot = buildBoardSnapshot({
    now,
    sources: {
      codex: {
        ok: true, total: 2,
        conversations: [
          { id: `codex:${CODEX_CONTROL}`, threadId: CODEX_CONTROL, projectId: "fretsense", project: "FretSense",
            title: "wo016 控线", source: "codex", status: "running", updatedAt: ago(1),
            preview: "控线在调度。", workItemRole: "control" },
          { id: `codex:${CODEX_CHILD}`, threadId: CODEX_CHILD, parentThreadId: CODEX_CONTROL,
            workItemRole: "execution", projectId: "fretsense", project: "FretSense",
            title: "wo016 trainer test", source: "codex", status: "done", updatedAt: ago(3), preview: "子会话完成。" },
        ],
        columns: empty,
      },
    },
  });
  const fretsense = buildBoardLevels(snapshot).projects.find((project) => project.id === "fretsense");
  assert.equal(fretsense.counts.lines, 1);
  assert.equal(fretsense.counts.sessions, 2);
  assert.equal(fretsense.lines[0].workItemKey, `fretsense:lineage:${CODEX_CONTROL}`);
  assert.equal(fretsense.lines[0].sessionLabel, "2 个会话 · 控制 1 · 执行 1");
});

test("one thread is counted once across stuckPast, older and live buckets", () => {
  const snapshot = buildBoardSnapshot({
    now,
    sources: {
      codex: {
        ok: true, total: 1,
        conversations: [{ id: "codex:handoff", threadId: "handoff", projectId: "fretsense", project: "FretSense",
          title: "Context handoff (full_thread_summary):", source: "codex", status: "stuck",
          updatedAt: ago(96), preview: "handoff" }],
        columns: {
          decide: [], done: [],
          stuck: [{ id: "codex-stuck:handoff", threadId: "handoff", projectId: "fretsense", project: "FretSense",
            title: "Context handoff (full_thread_summary):", detail: "Codex 回合中断", kind: "会话", who: "Codex", at: ago(96) }],
        },
      },
    },
  });
  const levels = buildBoardLevels(snapshot);
  const fretsense = levels.projects.find((project) => project.id === "fretsense");
  assert.equal(fretsense.lines.length, 0);
  assert.equal(fretsense.past.length, 1);
  assert.equal(fretsense.counts.sessions, 1);
  assert.equal(fretsense.counts.pastSessions, 1);
  assert.equal(levels.projects.flatMap((project) => [...project.lines, ...project.past]).filter((line) => line.threadId === "handoff").length, 1);
});

test("R60 follows its FretSense repository, not its R prefix", () => {
  const snapshot = buildBoardSnapshot({
    now,
    sources: {
      t3: {
        ok: true, total: 1,
        conversations: [{ id: "t3:r60", threadId: "r60", projectId: "fretsense", project: "FretSense",
          title: "R60 Me加载态与Scale重叠小修", source: "t3", status: "running", updatedAt: ago(1), preview: "FretSense · running" }],
        columns: empty,
      },
    },
  });
  const levels = buildBoardLevels(snapshot);
  const fretsense = levels.projects.find((project) => project.id === "fretsense");
  const psa = levels.projects.find((project) => project.id === "personal-super-agent");
  assert.equal(fretsense.lines[0].name, "R60 Me加载态与Scale重叠小修");
  assert.equal(psa, undefined);
});

test("the same Ticket in two projects stays two work items", () => {
  const snapshot = buildBoardSnapshot({
    now,
    sources: {
      codex: {
        ok: true, total: 2,
        conversations: [
          { id: "codex:a", threadId: "a", ticketId: TICKET_122_123, projectId: "fretsense", project: "FretSense",
            title: "同一工单 · FretSense", source: "codex", status: "running", updatedAt: ago(1), preview: "…" },
          { id: "codex:b", threadId: "b", ticketId: TICKET_122_123, projectId: "personal-super-agent", project: "personal-super-agent",
            title: "同一工单 · PSA", source: "codex", status: "running", updatedAt: ago(1), preview: "…" },
        ],
        columns: empty,
      },
    },
  });
  const levels = buildBoardLevels(snapshot);
  const fretsense = levels.projects.find((project) => project.id === "fretsense");
  const psa = levels.projects.find((project) => project.id === "personal-super-agent");
  assert.equal(fretsense.counts.lines, 1);
  assert.equal(psa.counts.lines, 1);
  assert.notEqual(fretsense.lines[0].workItemKey, psa.lines[0].workItemKey);
});

test("a stuck execution session makes its work item count as stuck", () => {
  const snapshot = buildBoardSnapshot({
    now,
    sources: {
      superagent: superagentControl(),
      codex: {
        ok: true, total: 1,
        conversations: [{ id: "codex:stuck", threadId: "stuck", ticketId: TICKET_122_123, workItemRole: "execution",
          projectId: "fretsense", project: "FretSense", title: "执行会话", source: "codex",
          status: "stuck", updatedAt: ago(1), preview: "卡住了" }],
        columns: empty,
      },
    },
  });
  const fretsense = buildBoardLevels(snapshot).projects.find((project) => project.id === "fretsense");
  assert.equal(fretsense.counts.lines, 1);
  assert.equal(fretsense.counts.stuck, 1);
  assert.equal(fretsense.counts.done, 0);
  assert.equal(fretsense.lines[0].state, "stuck");
});

test("the T3 ledger binds a real Ticket id to its thread", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "psa-r67-"));
  const file = path.join(dir, "t3-threads.json");
  fs.writeFileSync(file, JSON.stringify({
    version: 1,
    threads: {
      [TICKET_122_123]: {
        threadId: T3_WORKER,
        project: "/Users/javeyli/Projects/FretSense",
      },
    },
  }));
  const bindings = readT3TicketBindings(file);
  assert.equal(bindings.get(T3_WORKER)?.ticketId, TICKET_122_123);
  fs.rmSync(dir, { recursive: true, force: true });
});
