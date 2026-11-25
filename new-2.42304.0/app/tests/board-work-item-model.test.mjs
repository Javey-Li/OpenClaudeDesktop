import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncBuiltinESMExports } from "node:module";
import { buildBoardSnapshot } from "../src/board-view-model.mjs";
import { buildBoardLevels } from "../src/board-levels-model.mjs";
import { readT3TicketBindings } from "../electron/board-aggregator.mjs";

const now = "2026-11-09T04:00:00.000Z";
const ago = (hours) => new Date(Date.parse(now) - hours * 3_600_000).toISOString();

// Synthetic fixture values. Only the relations matter to these tests.
const TICKET_ID = "11111111111111111111111111111111";
const T3_WORKER = "mcp:launch:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CODEX_EXECUTOR = "11111111-1111-4111-8111-111111111111";
const CODEX_CHILD = "22222222-2222-4222-8222-222222222222";
const CODEX_CONTROL = "33333333-3333-4333-8333-333333333333";

const empty = { decide: [], done: [], stuck: [] };

function superagentControl(fields = {}) {
  return {
    ok: true, total: 2,
    conversations: [
      { id: "superagent:github:101", threadId: "github:101", ticketId: TICKET_ID,
        ticketTitle: "Synthetic governance Ticket",
        workItemRole: "control", projectId: "fretsense", project: "FretSense",
        title: "#101 docs: synthetic", source: "superagent", status: "done", updatedAt: ago(20), preview: "已合并", ...fields },
      { id: "superagent:github:102", threadId: "github:102", ticketId: TICKET_ID,
        ticketTitle: "Synthetic governance Ticket",
        workItemRole: "control", projectId: "fretsense", project: "FretSense",
        title: "#102 docs: synthetic", source: "superagent", status: "done", updatedAt: ago(19), preview: "已合并", ...fields },
    ],
    columns: empty,
  };
}

function t3Worker(fields = {}) {
  return {
    ok: true, total: 1,
    conversations: [{
      id: `t3:${T3_WORKER}`, threadId: T3_WORKER, ticketId: TICKET_ID, workItemRole: "execution",
      projectId: "fretsense", project: "FretSense", title: "docs: synthetic",
      source: "t3", status: "running", updatedAt: ago(1), preview: "FretSense · running", ...fields,
    }],
    columns: empty,
  };
}

function codexExecutor() {
  return {
    ok: true, total: 1,
    conversations: [{
      id: `codex:${CODEX_EXECUTOR}`, threadId: CODEX_EXECUTOR, ticketId: TICKET_ID,
      workItemRole: "execution", projectId: "fretsense", project: "FretSense",
      title: "Context handoff (full_thread_summary):", source: "codex", status: "done",
      updatedAt: ago(2), preview: "Synthetic PR merged.",
    }],
    columns: empty,
  };
}

function lineageAcrossBuckets({ parentPast, withTicket }) {
  const parent = {
    threadId: "parent",
    ticketId: withTicket ? TICKET_ID : undefined,
    title: "Synthetic parent session",
    workItemRole: "control",
  };
  const child = {
    threadId: "child",
    parentThreadId: "parent",
    title: "Synthetic child session",
    workItemRole: "execution",
  };
  const live = parentPast ? child : parent;
  const past = parentPast ? parent : child;
  return buildBoardSnapshot({
    now,
    sources: {
      codex: {
        ok: true, total: 2,
        conversations: [{
          id: `codex:${live.threadId}`, ...live,
          projectId: "fretsense", project: "FretSense", source: "codex",
          status: "running", updatedAt: ago(1), preview: "Synthetic live session",
        }],
        columns: {
          decide: [], done: [],
          stuck: [{
            id: `codex-stuck:${past.threadId}`, ...past,
            projectId: "fretsense", project: "FretSense", title: past.title,
            detail: "Synthetic interrupted session", kind: "会话", who: "Codex", at: ago(96),
          }],
        },
      },
    },
  });
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
  assert.equal(line.workItemKey, `fretsense:ticket:${TICKET_ID}`);
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

test("a Codex parent/child lineage is one work item with control and execution", () => {
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
          { id: "codex:a", threadId: "a", ticketId: TICKET_ID, projectId: "fretsense", project: "FretSense",
            title: "同一工单 · FretSense", source: "codex", status: "running", updatedAt: ago(1), preview: "…" },
          { id: "codex:b", threadId: "b", ticketId: TICKET_ID, projectId: "personal-super-agent", project: "personal-super-agent",
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

test("a newer done control session does not hide an older running execution", () => {
  const snapshot = buildBoardSnapshot({
    now,
    sources: {
      superagent: superagentControl({ updatedAt: ago(1) }),
      codex: {
        ok: true, total: 1,
        conversations: [{ id: "codex:running", threadId: "running", ticketId: TICKET_ID, workItemRole: "execution",
          projectId: "fretsense", project: "FretSense", title: "执行会话", source: "codex",
          status: "running", updatedAt: ago(2), preview: "还在跑" }],
        columns: empty,
      },
    },
  });
  const fretsense = buildBoardLevels(snapshot).projects.find((project) => project.id === "fretsense");
  assert.equal(fretsense.counts.lines, 1);
  assert.equal(fretsense.counts.running, 1);
  assert.equal(fretsense.counts.done, 0);
  assert.equal(fretsense.lines[0].state, "running");
  assert.equal(fretsense.sessionCounts.running, 1);
  assert.equal(fretsense.sessionCounts.done, 2);
  assert.equal(fretsense.lines[0].sessionLabel, "3 个会话 · 控制 2 · 执行 1");
});

test("a newer done control session does not hide an older stuck execution", () => {
  const snapshot = buildBoardSnapshot({
    now,
    sources: {
      superagent: superagentControl({ updatedAt: ago(1) }),
      codex: {
        ok: true, total: 1,
        conversations: [{ id: "codex:stuck", threadId: "stuck", ticketId: TICKET_ID, workItemRole: "execution",
          projectId: "fretsense", project: "FretSense", title: "执行会话", source: "codex",
          status: "stuck", updatedAt: ago(2), preview: "卡住了" }],
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

test("a work item with only done members stays done", () => {
  const snapshot = buildBoardSnapshot({
    now,
    sources: { superagent: superagentControl() },
  });
  const fretsense = buildBoardLevels(snapshot).projects.find((project) => project.id === "fretsense");
  assert.equal(fretsense.counts.lines, 1);
  assert.equal(fretsense.counts.running, 0);
  assert.equal(fretsense.counts.done, 1);
  assert.equal(fretsense.lines[0].state, "done");
});

test("the T3 ledger binds a Ticket id to its thread", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "psa-r67-"));
  const file = path.join(dir, "t3-threads.json");
  fs.writeFileSync(file, JSON.stringify({
    version: 1,
    threads: {
      [TICKET_ID]: {
        threadId: T3_WORKER,
        project: "/tmp/projects/fretsense",
      },
    },
  }));
  const bindings = readT3TicketBindings(file);
  assert.equal(bindings.get(T3_WORKER)?.ticketId, TICKET_ID);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a missing PSA_T3_BINDINGS_FILE returns empty without reading a file", () => {
  const originalReadFileSync = fs.readFileSync;
  let reads = 0;
  fs.readFileSync = (...args) => {
    reads += 1;
    return originalReadFileSync(...args);
  };
  syncBuiltinESMExports();
  try {
    assert.equal(readT3TicketBindings().size, 0);
    assert.equal(reads, 0);
  } finally {
    fs.readFileSync = originalReadFileSync;
    syncBuiltinESMExports();
  }
});

test("a Ticket row without a thread is a work item, not a session", () => {
  const snapshot = buildBoardSnapshot({
    now,
    sources: {
      superagent: {
        ok: true, total: 0,
        conversations: [],
        columns: {
          decide: [{ id: "superagent-decide:open", ticketId: TICKET_ID, projectId: "fretsense",
            project: "FretSense", title: "Open Ticket", kind: "工单", at: ago(1) }],
          done: [{ id: "superagent-done:done", ticketId: "22222222222222222222222222222222", projectId: "fretsense",
            project: "FretSense", title: "Done Ticket", kind: "工单", at: ago(2) }],
          stuck: [],
        },
      },
    },
  });
  const fretsense = buildBoardLevels(snapshot).projects.find((project) => project.id === "fretsense");
  assert.equal(fretsense.counts.lines, 2);
  assert.equal(fretsense.counts.sessions, 0);
  assert.equal(fretsense.lines.every((line) => line.sessionCount === 0), true);
});

for (const [name, parentPast, withTicket] of [
  ["parent in items and child in past share a Ticket", false, true],
  ["parent in items and child in past group by lineage", false, false],
  ["parent in past and child in items share a Ticket", true, true],
  ["parent in past and child in items group by lineage", true, false],
]) {
  test(name, () => {
    const snapshot = lineageAcrossBuckets({ parentPast, withTicket });
    const fretsense = buildBoardLevels(snapshot).projects.find((project) => project.id === "fretsense");
    const lines = [...fretsense.lines, ...fretsense.past];
    assert.equal(lines.length, 1);
    assert.equal(lines[0].sessionCount, 2);
    assert.deepEqual(lines[0].sessions.map((session) => session.role).sort(), ["control", "execution"]);
    assert.equal(lines[0].workItemKey, withTicket ? `fretsense:ticket:${TICKET_ID}` : "fretsense:lineage:parent");
  });
}
