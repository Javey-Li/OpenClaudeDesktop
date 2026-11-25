import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildMorningBriefReport, parseMorningBrief, tokyoDate } from "../src/board-morning-brief.mjs";
import { readBoardBrief } from "../electron/board-brief.mjs";
import { buildBoardSnapshot } from "../src/board-view-model.mjs";
import { buildBoardLevels } from "../src/board-levels-model.mjs";

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
  assert.equal(report.briefDateLabel, "早报是 11月26日 的");
});

test("today's page uses the morning brief report instead of the live rule report", () => {
  const snapshot = buildBoardSnapshot({ now: `${date}T02:00:00+09:00`, brief: parseMorningBrief(markdown, { expectedDate: date }) });
  const levels = buildBoardLevels(snapshot);
  assert.equal(levels.report.source, "早报");
  assert.equal(levels.report.sections[0].key, "decide");
});

test("missing, stale and malformed briefs keep the fallback report", () => {
  const fallback = { headline: "现在的样子", lines: [{ key: "done" }] };
  assert.match(buildMorningBriefReport({ status: "missing", date }, fallback).briefNotice, /没有文件/);
  assert.match(buildMorningBriefReport({ status: "stale", date: "2026-11-25" }, fallback).briefNotice, /不是今天/);
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
    assert.equal(missing.status, "missing");
    assert.equal(reads, 0);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
