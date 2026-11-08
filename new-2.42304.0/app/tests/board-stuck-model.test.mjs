import test from "node:test";
import assert from "node:assert/strict";
import { buildBoardSnapshot } from "../src/board-view-model.mjs";
import { cleanBoardTitle, splitStuck } from "../src/board-stuck-model.mjs";

const now = "2026-11-07T04:00:00.000Z";

const row = (patch = {}) => ({
  id: patch.id || "stuck:1",
  title: "一个卡住的事",
  detail: "",
  project: "FretSense",
  at: "2026-11-07T03:30:00.000Z",
  ...patch,
});

test("a current blocker stays in the active column", () => {
  const result = splitStuck([row()], { now });
  assert.equal(result.active.length, 1);
  assert.equal(result.past.length, 0);
});

test("pilot workspaces and test pings move to past", () => {
  const result = splitStuck([
    row({ id: "pilot", title: "独立只读复核 /private/tmp/fretsense-batch1/b1-scales" }),
    row({ id: "test", title: "T3_MCP_REQUIRED_FOR_WORKTREE" }),
    row({ id: "reply", title: "Reply with exactly: FULL_ACCESS_OK" }),
  ], { now });
  assert.equal(result.active.length, 0);
  assert.equal(result.past.length, 3);
  assert.equal(result.past.every((entry) => entry.pastLabel === "已过去"), true);
  assert.match(result.past.find((entry) => entry.id === "pilot").pastReason, /试点临时目录/);
  assert.match(result.past.find((entry) => entry.id === "test").pastReason, /测试记录/);
  assert.equal(result.summary.tests, 2);
});

test("a recovered source goes to past even when the row is fresh", () => {
  const result = splitStuck([row({ id: "source", recovered: true, title: "T3 来源出错" })], { now });
  assert.equal(result.active.length, 0);
  assert.equal(result.past[0].pastLabel, "已恢复");
  assert.equal(result.past[0].pastReason, "来源已恢复");
});

test("a quiet turn expires after the ttl with the age in the reason", () => {
  const result = splitStuck([row({ at: "2026-11-06T02:00:00.000Z" })], { now });
  assert.equal(result.active.length, 0);
  assert.equal(result.past[0].pastKind, "expired");
  assert.match(result.past[0].pastReason, /1 天没有新事件/);
});

test("an old review record moves to past before the generic ttl", () => {
  const result = splitStuck([row({ title: "独立复核：白皮书结论", at: "2026-11-06T20:00:00.000Z" })], { now });
  assert.equal(result.active.length, 0);
  assert.equal(result.past[0].pastReason, "旧复核记录");
});

test("the board snapshot keeps past stuck rows out of the live column", () => {
  const snapshot = buildBoardSnapshot({
    now,
    sources: {
      codex: {
        ok: true,
        columns: {
          decide: [],
          done: [],
          stuck: [
            row({ id: "old", at: "2026-11-05T04:00:00.000Z" }),
            row({ id: "fresh", at: "2026-11-07T03:40:00.000Z", title: "权限没回" }),
          ],
        },
      },
    },
  });
  assert.deepEqual(snapshot.columns.stuck.map((entry) => entry.id), ["fresh"]);
  assert.deepEqual(snapshot.columns.stuckPast.map((entry) => entry.id), ["old"]);
  assert.equal(snapshot.stuckSummary.past, 1);
  assert.match(snapshot.report.lines[2].text, /权限没回/);
});

test("two independent lines with the same title are not collapsed", () => {
  const snapshot = buildBoardSnapshot({
    now,
    sources: {
      codex: {
        ok: true,
        columns: {
          decide: [],
          done: [],
          stuck: [
            row({ id: "codex-stuck:a", title: "同一标题", at: "2026-11-05T04:00:00.000Z" }),
            row({ id: "codex-stuck:b", title: "同一标题", at: "2026-11-05T04:00:00.000Z" }),
          ],
        },
      },
    },
  });
  assert.deepEqual(snapshot.columns.stuckPast.map((entry) => entry.id).sort(), ["codex-stuck:a", "codex-stuck:b"]);
});

test("a recovered source survives normalization and moves to past", () => {
  const snapshot = buildBoardSnapshot({
    now,
    sources: {
      superagent: {
        ok: true,
        columns: {
          decide: [],
          done: [],
          stuck: [row({ id: "t3-source", title: "T3 来源出错", category: "source-error", sourceId: "t3", recovered: true })],
        },
      },
    },
  });
  assert.equal(snapshot.columns.stuck.length, 0);
  assert.equal(snapshot.columns.stuckPast[0].pastLabel, "已恢复");
  assert.equal(snapshot.stuckSummary.recovered, 1);
});

test("titles lose the prompt prefix and wrapping quotes", () => {
  assert.equal(cleanBoardTitle("标题：接管 Fret Sense 首席职责"), "接管 Fret Sense 首席职责");
  assert.equal(cleanBoardTitle("“修好回放”"), "修好回放");
  assert.equal(cleanBoardTitle("接管 Fret Sense 首席职责@标题：接管 Fret Sense 首席职责"), "接管 Fret Sense 首席职责");
  assert.equal(cleanBoardTitle("@标题：接管 Fret Sense 首席职责 @标题：接管 Fret Sense 首席职责 现在你负责总结这两个对话"),
    "接管 Fret Sense 首席职责 现在你负责总结这两个对话");
});

test("a raw trigger payload becomes a readable title", () => {
  assert.equal(cleanBoardTitle('{"trigger_id":"c45a91c3489f4e66cf9fca753b6cd667","from":"","thread":"github:123","at":"2026-11-07T01:00:00Z"}'), "触发信号 · github:123");
  assert.equal(cleanBoardTitle('{"trigger_id":"abc'), "触发信号");
});
