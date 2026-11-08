import test from "node:test";
import assert from "node:assert/strict";
import { buildBriefSummary, buildProjectBriefs } from "../src/board-brief-model.mjs";

const now = "2026-11-07T04:00:00.000Z";

test("briefs group conversations and column items by project", () => {
  const briefs = buildProjectBriefs({
    now,
    projects: [
      { id: "fretsense", name: "FretSense", repo: "Javey-Li/FretSense", conversations: [
        { id: "c1", title: "修回放", preview: "回放修好了，测试通过。", source: "codex", status: "done", updatedAt: "2026-11-07T03:50:00.000Z" },
        { id: "c2", title: "改指板", preview: "还在改。", source: "t3", status: "running", updatedAt: "2026-11-07T03:58:00.000Z" },
      ] },
    ],
    columns: {
      decide: [{ id: "d1", projectId: "fretsense", project: "FretSense", title: "要不要保留 S07", kind: "工单", who: "Superagent", at: "2026-11-07T03:40:00.000Z" }],
      done: [],
      stuck: [{ id: "s1", projectId: "fretsense", project: "FretSense", title: "权限没回", detail: "生产库超时", kind: "问题", who: "Superagent", at: "2026-11-07T02:00:00.000Z" }],
      stuckPast: [],
    },
  });
  assert.equal(briefs.length, 1);
  assert.equal(briefs[0].status, "stuck");
  assert.equal(briefs[0].counts.done, 1);
  assert.equal(briefs[0].counts.open, 1);
  assert.equal(briefs[0].counts.decide, 1);
  assert.equal(briefs[0].counts.stuck, 1);
  assert.equal(briefs[0].lastReport.text, "还在改。");
  assert.equal(briefs[0].done[0].detail, "回放修好了，测试通过。");
});

test("a project with only a decision is ranked before a quiet done project", () => {
  const briefs = buildProjectBriefs({
    now,
    projects: [
      { id: "done", name: "Done", conversations: [{ id: "c1", title: "收口", preview: "完成", source: "codex", status: "done", updatedAt: "2026-11-07T03:00:00.000Z" }] },
      { id: "decide", name: "Decide", conversations: [] },
    ],
    columns: {
      decide: [{ id: "d1", projectId: "decide", project: "Decide", title: "选 A 还是 B", kind: "工单", who: "Superagent", at: "2026-11-07T03:00:00.000Z" }],
      done: [], stuck: [], stuckPast: [],
    },
  });
  assert.deepEqual(briefs.map((brief) => brief.name), ["Decide", "Done"]);
});

test("summary counts every project and names the latest done line", () => {
  const briefs = buildProjectBriefs({
    now,
    projects: [
      { id: "a", name: "A", conversations: [{ id: "a1", title: "A 收口", preview: "A 完成", source: "codex", status: "done", updatedAt: "2026-11-07T03:00:00.000Z" }] },
      { id: "b", name: "B", conversations: [{ id: "b1", title: "B 收口", preview: "B 完成", source: "t3", status: "done", updatedAt: "2026-11-07T03:30:00.000Z" }] },
    ],
    columns: { decide: [], done: [], stuck: [], stuckPast: [] },
  });
  const summary = buildBriefSummary(briefs);
  assert.equal(summary.projects, 2);
  assert.equal(summary.done, 2);
  assert.equal(summary.latestDone.title, "B 收口");
  assert.equal(summary.latestDone.project, "B");
});

test("a T3 line without a last message falls back to its title", () => {
  const briefs = buildProjectBriefs({
    now,
    projects: [{ id: "t3", name: "T3", conversations: [{ id: "t31", title: "只有标题", preview: "", source: "t3", status: "done", updatedAt: "2026-11-07T03:00:00.000Z" }] }],
    columns: { decide: [], done: [], stuck: [], stuckPast: [] },
  });
  assert.equal(briefs[0].lastReport.text, "只有标题");
});
