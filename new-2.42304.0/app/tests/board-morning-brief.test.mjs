import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildMorningBriefReport, parseMorningBrief, tokyoDate } from "../src/board-morning-brief.mjs";
import { readBoardBrief } from "../electron/board-brief.mjs";
import { buildBoardSnapshot } from "../src/board-view-model.mjs";
import { buildBoardLevels } from "../src/board-levels-model.mjs";
import { boardCacheCurrent } from "../electron/board-aggregator.mjs";

const date = "2026-11-26";
const markdown = `# ${date} 早报

生成时间：2026-11-26 01:00（东京）

## 昨天做完了什么

- [x] 合成：完成工作项统计
- 合成：补上回归测试

## 卡在哪

- ⚠️ 合成：等待素材

## 要你定什么

- ❓ 合成：选哪个入口

## 今天会做什么

- [ ] 合成：截三张页面
`;

test("morning brief parses four sections and line markers", () => {
  const brief = parseMorningBrief(markdown, { expectedDate: date });
  assert.equal(brief.status, "ready");
  assert.deepEqual(brief.sections.map((section) => section.key), ["done", "blocked", "decide", "today"]);
  assert.equal(brief.sections[0].lines[0].state, "done");
  assert.equal(brief.sections[1].lines[0].state, "stuck");
  assert.equal(brief.sections[2].lines[0].state, "decide");
  assert.equal(brief.sections[3].lines[0].state, "running");
});

test("decisions render first and the report states the brief date", () => {
  const report = buildMorningBriefReport(parseMorningBrief(markdown, { expectedDate: date }), { headline: "fallback", lines: [] });
  assert.equal(report.sections[0].key, "decide");
  assert.equal(report.headline, "先看 1 件要你定的");
  assert.equal(report.briefDateLabel, "11月26日的早报");
});

test("today's page uses the morning brief report instead of the live rule report", () => {
  const snapshot = buildBoardSnapshot({ now: `${date}T02:00:00+09:00`, brief: parseMorningBrief(markdown, { expectedDate: date }) });
  const levels = buildBoardLevels(snapshot);
  assert.equal(levels.report.source, "早报");
  assert.equal(levels.report.sections[0].key, "decide");
});

test("missing, stale and malformed briefs keep the fallback report", () => {
  const fallback = { headline: "现在的样子", lines: [{ key: "done" }] };
  const missing = buildMorningBriefReport({ status: "missing", date }, fallback);
  assert.equal(missing.briefNotice, "今天还没有早报");
  assert.equal(missing.briefTone, "quiet");
  const unconfigured = buildMorningBriefReport({ status: "unconfigured", date }, fallback);
  assert.equal(unconfigured.briefNotice, "");
  const stale = buildMorningBriefReport({ status: "stale", date: "2026-11-25" }, fallback);
  assert.match(stale.briefNotice, /不是今天/);
  assert.equal(stale.briefTone, "alert");
  const malformed = buildMorningBriefReport(parseMorningBrief("# 不是早报", { expectedDate: date }), fallback);
  assert.equal(malformed.headline, "现在的样子");
  assert.match(malformed.briefNotice, /没读好/);
});

test("reader uses only BOARD_BRIEF_DIR and today's Tokyo filename", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "board-brief-"));
  try {
    await fs.writeFile(path.join(dir, `${date}.md`), markdown);
    const now = new Date("2026-11-25T15:30:00.000Z");
    assert.equal(tokyoDate(now), date);
    const brief = await readBoardBrief({ env: { BOARD_BRIEF_DIR: dir }, now });
    assert.equal(brief.status, "ready");
    let reads = 0;
    const missing = await readBoardBrief({ env: {}, now, readFile: async () => { reads += 1; return markdown; } });
    assert.equal(missing.status, "unconfigured");
    assert.equal(reads, 0);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("board cache is invalidated when the Tokyo date changes", () => {
  const beforeMidnight = Date.parse("2026-11-25T14:59:59.000Z");
  const afterMidnight = Date.parse("2026-11-25T15:00:01.000Z");
  const cached = { at: beforeMidnight, date: "2026-11-25", snapshot: { generatedAt: "2026-11-25T23:59:59+09:00" } };
  assert.equal(boardCacheCurrent(cached, beforeMidnight + 500), true);
  assert.equal(boardCacheCurrent(cached, afterMidnight), false);
});
