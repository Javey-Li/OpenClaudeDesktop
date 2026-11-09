// Three levels for the 总管 board.
//
//   1. 今天的局面 — one card per project: running, needs you, stuck, last sentence.
//   2. 项目页     — one card per line in that project: name, state, progress, last sentence.
//   3. 线详情     — one line: monitor, tool calls, context map, model fallback chain.
//
// Built only from the snapshot the aggregator already read (Codex sessions,
// superagent, T3). Nothing is filled in; a line without a plan shows its state.

import { buildAgentInbox } from "./board-agent-model.mjs";
import { firstSentence } from "./board-text-model.mjs";

const DAY = 24 * 60 * 60 * 1000;
const text = (value) => (typeof value === "string" ? value.trim() : "");
const time = (value) => {
  const at = Date.parse(value ?? "");
  return Number.isFinite(at) ? at : 0;
};

export const LINE_STATE_LABEL = Object.freeze({ decide: "要你定", stuck: "卡住", waiting: "等你", running: "在跑", done: "收口" });
const RANK = Object.freeze({ decide: 0, stuck: 1, waiting: 2, running: 3, done: 4 });
const PROJECT_RANK = Object.freeze({ decide: 0, stuck: 1, running: 2, done: 3 });

export const LINE_FILTERS = Object.freeze([
  { id: "all", label: "全部", states: ["decide", "stuck", "waiting", "running", "done"] },
  { id: "attention", label: "要处理", states: ["decide", "stuck", "waiting"] },
  { id: "running", label: "在跑", states: ["running"] },
  { id: "done", label: "收口", states: ["done"] },
]);

// Progress a line can honestly claim: its own plan (update_plan), else its turn count, else its state.
// A plan only counts while the line is open and the plan is not hours older than the line's last event.
export function lineProgress(line) {
  const plan = line.plan;
  const fresh = plan?.total && line.state !== "done" && (!plan.at || time(line.at) - time(plan.at) < 2 * 60 * 60 * 1000);
  if (fresh) {
    return { kind: "plan", done: plan.done, total: plan.total, ratio: plan.done / plan.total, label: `${plan.done}/${plan.total} 步`, current: plan.current };
  }
  const turns = (line.models?.segments ?? []).reduce((sum, segment) => sum + (segment.turns || 0), 0);
  if (line.state === "done") return { kind: "state", ratio: 1, label: line.outcome === "settled" ? "工单已结束" : "已收口" };
  if (turns) return { kind: "turns", label: `第 ${turns} 轮` };
  return { kind: "state", label: LINE_STATE_LABEL[line.state] ?? "" };
}

const T3_STATUS = Object.freeze({ running: "在跑", working: "在跑", completed: "已完成", failed: "失败", error: "出错", idle: "空闲", waiting: "在等" });

// T3's failure/completion rows are generated as "T3 运行失败 · <T3 project>".
// The board project comes from the line name or Issue repo, so the T3 folder
// name ("Projects") is not a board project; keep the raw report and show the fact.
function t3DisplayReport(value) {
  const report = text(value);
  if (/^T3 运行失败 · /i.test(report)) return "T3 运行失败";
  if (/^T3 回合完成 · /i.test(report)) return "T3 回合完成";
  return report;
}

function toLine(item, past = false) {
  // A T3 conversation reports "<project> · <status>". After a column row is
  // merged in, the report may instead be "T3 运行失败 · <project>"; that is a
  // readable sentence and must not be parsed as a status line.
  const rawReport = item.report || item.detail;
  const displayReport = item.source === "t3" ? t3DisplayReport(rawReport) : rawReport;
  const t3 = item.source === "t3"
    ? /^.+ · (running|working|completed|failed|error|idle|waiting)$/i.exec(rawReport)
    : null;
  const sentence = t3 ? "" : firstSentence(displayReport, 120);
  const status = t3 ? T3_STATUS[t3[1].toLowerCase()] ?? t3[1] : "";
  const summary = sentence || (t3 ? `T3 只回传状态：${status}，没有最后一句。` : displayReport || "这条线没有留下最后一句。");
  return {
    ...item,
    key: past ? `past:${item.key}` : item.key,
    name: item.title,
    summary,
    displayReport,
    past,
    spoke: Boolean(sentence),
    progress: lineProgress(item),
  };
}

function projectStatus(counts) {
  if (counts.decide) return "decide";
  if (counts.stuck) return "stuck";
  if (counts.running) return "running";
  return "done";
}

export function buildBoardLevels(snapshot = {}) {
  const now = snapshot.generatedAt ?? new Date().toISOString();
  const inbox = buildAgentInbox({
    columns: snapshot.columns ?? {},
    projects: snapshot.projects ?? [],
    older: snapshot.older?.projects ?? [],
    now,
    doneWithinMs: 3 * DAY,
    doneLimit: Infinity,
    superagentDone: true,
  });
  const byProject = new Map();
  const ensure = (item) => {
    const id = item.projectId || "other";
    if (!byProject.has(id)) byProject.set(id, { id, name: item.project || "其他", lines: [], past: [] });
    return byProject.get(id);
  };
  for (const item of inbox.items) ensure(item).lines.push(toLine(item));
  for (const item of inbox.past) ensure(item).past.push(toLine(item, true));

  const meta = new Map((snapshot.projects ?? []).map((project) => [project.id, project]));
  const projects = [...byProject.values()].map((project) => {
    const lines = project.lines.sort((a, b) => RANK[a.state] - RANK[b.state] || time(b.at) - time(a.at));
    const counts = {
      lines: lines.length,
      running: lines.filter((line) => line.state === "running").length,
      decide: lines.filter((line) => line.state === "decide" || line.state === "waiting").length,
      stuck: lines.filter((line) => line.state === "stuck").length,
      done: lines.filter((line) => line.state === "done").length,
      past: project.past.length,
    };
    const recent = [...lines, ...project.past].sort((a, b) => time(b.at) - time(a.at));
    const latest = recent.find((line) => line.spoke) ?? recent[0] ?? null;
    return {
      id: project.id,
      name: project.name,
      repo: meta.get(project.id)?.repo ?? "",
      note: meta.get(project.id)?.note ?? "",
      status: projectStatus(counts),
      counts,
      last: latest ? { line: latest.name, text: latest.summary, at: latest.at, source: latest.source } : null,
      updatedAt: recent[0]?.at ?? "",
      lines,
      past: project.past.sort((a, b) => time(b.at) - time(a.at)),
    };
  }).sort((a, b) => {
    if ((a.id === "other") !== (b.id === "other")) return a.id === "other" ? 1 : -1;
    return PROJECT_RANK[a.status] - PROJECT_RANK[b.status] || time(b.updatedAt) - time(a.updatedAt) || a.name.localeCompare(b.name);
  });

  return { projects, report: buildLevelReport(projects), now };
}

const clip = (value, limit = 24) => (value.length > limit ? `${value.slice(0, limit - 1)}…` : value);
const names = (lines, limit = 3) => lines.slice(0, limit).map((line) => clip(line.name)).join("、")
  + (lines.length > limit ? ` 等 ${lines.length} 条` : "");

// The report at the top of level 1: four short answers from the lines themselves.
export function buildLevelReport(projects = []) {
  const all = projects.flatMap((project) => project.lines.map((line) => ({ ...line, projectName: project.name })));
  const pick = (states) => all.filter((line) => states.includes(line.state)).sort((a, b) => time(b.at) - time(a.at));
  const decide = pick(["decide", "waiting"]);
  const stuck = pick(["stuck"]);
  const running = pick(["running"]);
  const done = pick(["done"]);
  const headline = decide.length ? `先看 ${decide.length} 件要你定的`
    : stuck.length ? `有 ${stuck.length} 条会话卡住了`
      : running.length ? `${running.length} 条会话在跑，没有要你定的`
        : done.length ? "都收口了，没有要你定的" : "今天还没有动静";
  return {
    headline,
    counts: { decide: decide.length, stuck: stuck.length, running: running.length, done: done.length, projects: projects.length },
    lines: [
      { key: "decide", label: "要你定", text: decide.length ? names(decide) : "没有。" },
      { key: "stuck", label: "卡在哪", text: stuck.length ? names(stuck) : "没有卡住的线。" },
      { key: "running", label: "在跑", text: running.length ? names(running) : "现在没有在跑的线。" },
      { key: "done", label: "刚收口", text: done.length ? names(done) : "最近 3 天没有收口的。" },
    ],
  };
}

export function filterLines(lines, filterId) {
  const filter = LINE_FILTERS.find((entry) => entry.id === filterId) ?? LINE_FILTERS[0];
  return lines.filter((line) => filter.states.includes(line.state));
}

export function findLine(levels, projectId, lineKey) {
  const project = levels.projects.find((entry) => entry.id === projectId);
  if (!project) return { project: null, line: null };
  const line = [...project.lines, ...project.past].find((entry) => entry.key === lineKey) ?? null;
  return { project, line };
}
