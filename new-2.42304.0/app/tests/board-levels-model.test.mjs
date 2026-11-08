import test from "node:test";
import assert from "node:assert/strict";
import { buildBoardSnapshot } from "../src/board-view-model.mjs";
import { MAIN_THREAD_NAME } from "../src/board-view-model.mjs";
import { buildBoardLevels, findLine, lineProgress } from "../src/board-levels-model.mjs";

const now = "2026-11-07T04:00:00.000Z";
const ago = (minutes) => new Date(Date.parse(now) - minutes * 60_000).toISOString();

test("three levels keep real lines, fix the main title and read T3 failures as sentences", () => {
  const plan = [
    { step: "盘工作树", status: "completed" },
    { step: "补测试", status: "in_progress" },
    { step: "出截图", status: "pending" },
  ];
  const snapshot = buildBoardSnapshot({
    now,
    sources: {
      codex: {
        ok: true, total: 1,
        conversations: [
          { id: "codex:main", threadId: "main", projectId: "fretsense", project: "FretSense",
            title: "标题：接管 Fret Sense 首席职责", source: "codex", status: "running", updatedAt: ago(2),
            preview: "**结论**：先修表格，再跑截图。\n```json\n{\"raw\":true}\n```",
            plan: { total: 3, done: 1, current: "补测试", steps: plan, at: ago(3) } },
        ],
        columns: { decide: [], done: [], stuck: [] },
      },
      t3: {
        ok: true, total: 2,
        conversations: [
          { id: "t3:blocked", threadId: "blocked", projectId: "personal-super-agent", project: "personal-super-agent",
            title: "L4i 总看板三级页面-接续", source: "t3", status: "stuck", updatedAt: ago(4), preview: "Projects · failed" },
          { id: "t3:live", threadId: "live", projectId: "personal-super-agent", project: "personal-super-agent",
            title: "L4j 总看板三级页面-可用模型", source: "t3", status: "running", updatedAt: ago(1), preview: "Projects · running" },
        ],
        columns: {
          decide: [], done: [],
          stuck: [{ id: "t3-stuck:blocked", projectId: "personal-super-agent", project: "personal-super-agent",
            title: "L4i 总看板三级页面-接续", detail: "T3 运行失败 · Projects", kind: "线程", who: "T3", at: ago(4) }],
        },
      },
    },
  });
  const levels = buildBoardLevels(snapshot);
  const project = levels.projects.find((entry) => entry.id === "personal-super-agent");
  assert.ok(project);
  assert.equal(project.counts.lines, 3);
  assert.equal(project.counts.running, 2);
  assert.equal(project.counts.stuck, 1);
  assert.equal(project.status, "stuck");

  const main = project.lines.find((line) => line.main);
  assert.equal(main.name, MAIN_THREAD_NAME);
  assert.equal(main.summary, "先修表格，再跑截图。");
  assert.equal(main.progress.label, "1/3 步");
  assert.equal(main.progress.current, "补测试");

  const blocked = project.lines.find((line) => line.name === "L4i 总看板三级页面-接续");
  assert.equal(blocked.summary, "T3 运行失败");
  assert.equal(blocked.displayReport, "T3 运行失败");
  assert.equal(blocked.report, "T3 运行失败 · Projects");
  assert.doesNotMatch(blocked.summary, /只回传状态：Projects/);

  const live = project.lines.find((line) => line.name === "L4j 总看板三级页面-可用模型");
  assert.equal(live.summary, "T3 只回传状态：在跑，没有最后一句。");
  assert.equal(project.last.line, MAIN_THREAD_NAME);

  assert.equal(findLine(levels, project.id, main.key).line.name, MAIN_THREAD_NAME);
  assert.equal(findLine(levels, project.id, "missing").line, null);
});

test("a plan only counts while the line is open", () => {
  const plan = { total: 2, done: 1, current: "", steps: [], at: now };
  assert.equal(lineProgress({ state: "done", plan }).kind, "state");
  assert.equal(lineProgress({ state: "running", plan, at: now }).label, "1/2 步");
});

test("T3 Projects failures keep the failure but show the line's project, not Projects", () => {
  const rows = [
    ["l4h", "L4h 总看板三级页面-强模型"],
    ["l4g", "L4g 总看板三级页面"],
    ["l4i", "L4i 总看板三级页面-接续"],
    ["v4h", "V4h 钢琴卷帘回最早版-强模型"],
    ["unknown", "说明"],
  ];
  const snapshot = buildBoardSnapshot({
    now,
    sources: {
      t3: {
        ok: true, total: rows.length,
        conversations: rows.map(([id, title]) => ({
          id: `t3:${id}`, projectId: "other", project: "Projects", title,
          source: "t3", status: "stuck", updatedAt: now, preview: "Projects · failed",
        })),
        columns: {
          decide: [], done: [],
          stuck: rows.map(([id, title]) => ({
            id: `t3-stuck:${id}`, projectId: "other", project: "Projects", title,
            detail: "T3 运行失败 · Projects", kind: "线程", who: "T3", at: now,
          })),
        },
      },
    },
  });
  const levels = buildBoardLevels(snapshot);
  const psa = levels.projects.find((project) => project.id === "personal-super-agent");
  for (const name of ["L4h 总看板三级页面-强模型", "L4g 总看板三级页面", "L4i 总看板三级页面-接续"]) {
    const line = psa.lines.find((entry) => entry.name === name);
    assert.ok(line, name);
    assert.equal(line.state, "stuck");
    assert.equal(line.summary, "T3 运行失败");
    assert.equal(line.displayReport, "T3 运行失败");
    assert.equal(line.report, "T3 运行失败 · Projects");
  }
  const dawdex = levels.projects.find((project) => project.id === "dawdex");
  assert.equal(dawdex.lines.find((entry) => entry.name === "V4h 钢琴卷帘回最早版-强模型").summary, "T3 运行失败");
  const other = levels.projects.find((project) => project.id === "other");
  assert.ok(other);
  assert.equal(other.name, "其他");
  assert.equal(other.lines.find((entry) => entry.name === "说明").summary, "T3 运行失败");
  assert.equal([...psa.lines, ...dawdex.lines, ...other.lines].some((line) => line.summary.includes("Projects")), false);
});

test("repo/Issue attribution wins over metadata, and metadata wins over line names", () => {
  const snapshot = buildBoardSnapshot({
    now,
    sources: {
      codex: {
        ok: true, total: 2,
        conversations: [
          { id: "codex:sb", threadId: "sb", projectId: "obsidian", project: "Obsidian",
            title: "SB3 Obsidian P1 机器记录与查询", source: "codex", status: "running", updatedAt: ago(2),
            preview: "## 结论\n**已修好**：`/Users/javeyli/Projects/Obsidian/app.js` 已经能查了。" },
          { id: "codex:psa", threadId: "psa", projectId: "fretsense", project: "FretSense",
            title: "PSA 测试 fixture 修复", source: "codex", status: "done", updatedAt: ago(5),
            preview: "[PR #43](https://github.com/Javey-Li/personal-super-agent/pull/43) 已开。" },
        ],
        columns: { decide: [], done: [], stuck: [] },
      },
    },
  });
  const levels = buildBoardLevels(snapshot);
  const psa = levels.projects.find((project) => project.id === "personal-super-agent");
  const obsidian = levels.projects.find((project) => project.id === "obsidian");
  assert.ok(psa);
  assert.ok(obsidian);
  assert.deepEqual(psa.lines.map((line) => line.name), ["PSA 测试 fixture 修复"]);
  assert.deepEqual(obsidian.lines.map((line) => line.name), ["SB3 Obsidian P1 机器记录与查询"]);

  const sb = obsidian.lines.find((line) => line.name === "SB3 Obsidian P1 机器记录与查询");
  assert.equal(sb.projectId, "obsidian");
  assert.equal(sb.summary, "…/Obsidian/app.js 已经能查了。");
  assert.doesNotMatch(sb.summary, /[*`]|\[|\]\(/);

  const report = levels.report;
  assert.match(report.headline, /条会话/);
  assert.match(report.lines.find((line) => line.key === "running").text, /SB3/);
});
