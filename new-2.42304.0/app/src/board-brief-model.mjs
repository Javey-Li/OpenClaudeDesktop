// Per-project briefs for the 总管 board.
//
// The board already has the lines' own end reports: a Codex conversation's last
// agent message, a superagent thread's latest preview, and the status/title a T3
// thread exposes. This module groups those by project and answers four questions
// without inventing a report: done, open, stuck, and what needs a decision.

import { threadKey } from "./board-agent-model.mjs";

const text = (value) => (typeof value === "string" ? value.trim() : "");
const time = (value) => {
  const at = Date.parse(value ?? "");
  return Number.isFinite(at) ? at : 0;
};

function conversationItem(row) {
  return {
    id: row.id,
    title: text(row.title) || text(row.preview) || "未命名对话",
    detail: text(row.preview),
    source: row.source,
    kind: "会话",
    who: row.source,
    at: row.updatedAt,
    status: row.status,
    threadId: row.threadId,
    ...(row.stale ? { pastKind: "expired", pastLabel: "已过去", pastReason: row.stale.reason } : {}),
  };
}

function columnItem(row) {
  return {
    id: row.id,
    title: text(row.title) || text(row.detail) || "未命名",
    detail: text(row.detail),
    source: row.source,
    kind: text(row.kind) || "事项",
    who: text(row.who) || row.source,
    at: row.at,
    status: row.status,
    threadId: row.threadId,
  };
}

function uniqueByThread(rows) {
  const seen = new Set();
  return rows
    .filter((row) => {
      const key = threadKey(row, row.source);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => time(b.at) - time(a.at));
}

function briefStatus({ stuck, decide, open }) {
  if (stuck.length) return "stuck";
  if (decide.length) return "decide";
  if (open.some((row) => row.status === "waiting")) return "waiting";
  if (open.length) return "running";
  return "done";
}

const RANK = { stuck: 0, decide: 1, waiting: 2, running: 3, done: 4, quiet: 5 };

export function buildProjectBriefs({ projects = [], columns = {}, now = new Date().toISOString() } = {}) {
  const byId = new Map();
  const ensure = (id, name, repo = "", note = "") => {
    const key = text(id) || text(name) || "other";
    if (!byId.has(key)) byId.set(key, { id: key, name: text(name) || "其他", repo: text(repo), note: text(note), conversations: [], columns: { decide: [], done: [], stuck: [], stuckPast: [] } });
    return byId.get(key);
  };

  for (const project of projects) {
    const brief = ensure(project.id, project.name, project.repo, project.note);
    brief.conversations.push(...(project.conversations ?? []));
  }
  for (const key of ["decide", "done", "stuck", "stuckPast"]) {
    for (const row of columns[key] ?? []) {
      const brief = ensure(row.projectId, row.project, row.repo, row.note);
      brief.columns[key].push(row);
    }
  }

  const briefs = [...byId.values()].map((entry) => {
    const conversations = entry.conversations;
    const live = conversations.filter((row) => !row.stale);
    const done = uniqueByThread([
      ...live.filter((row) => row.status === "done").map(conversationItem),
      ...entry.columns.done.map(columnItem),
    ]);
    const open = uniqueByThread(live.filter((row) => row.status === "running" || row.status === "waiting").map(conversationItem));
    const stuck = uniqueByThread([
      ...live.filter((row) => row.status === "stuck" || row.status === "suspected").map(conversationItem),
      ...entry.columns.stuck.map(columnItem),
    ]);
    const decide = uniqueByThread(entry.columns.decide.map(columnItem));
    const past = uniqueByThread([
      ...entry.columns.stuckPast.map(columnItem),
      ...conversations.filter((row) => row.stale).map(conversationItem),
    ]);
    const last = conversations
      .filter((row) => text(row.updatedAt))
      .sort((a, b) => time(b.updatedAt) - time(a.updatedAt))[0];
    const lastReport = last ? {
      text: text(last.preview) || text(last.title) || "这条线没有留下最后一句。",
      title: text(last.title),
      source: last.source,
      at: last.updatedAt,
    } : null;
    const status = briefStatus({ stuck, decide, open });
    const updatedAt = [last?.updatedAt, ...done.map((row) => row.at), ...open.map((row) => row.at), ...stuck.map((row) => row.at), ...decide.map((row) => row.at)]
      .filter(Boolean)
      .sort((a, b) => time(b) - time(a))[0] ?? now;
    return {
      id: entry.id,
      name: entry.name,
      repo: entry.repo,
      note: entry.note,
      status,
      counts: { done: done.length, open: open.length, stuck: stuck.length, decide: decide.length, past: past.length, conversations: conversations.length },
      done,
      open,
      stuck,
      decide,
      past,
      lastReport,
      updatedAt,
    };
  }).filter((brief) => brief.counts.conversations || brief.counts.done || brief.counts.open || brief.counts.stuck || brief.counts.decide || brief.counts.past);

  return briefs.sort((a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9) || time(b.updatedAt) - time(a.updatedAt) || a.name.localeCompare(b.name));
}

export function buildBriefSummary(briefs = []) {
  const sum = (key) => briefs.reduce((total, brief) => total + (brief.counts?.[key] ?? 0), 0);
  const latestDone = briefs.flatMap((brief) => brief.done.map((row) => ({ ...row, project: brief.name })))
    .sort((a, b) => time(b.at) - time(a.at))[0] ?? null;
  return {
    projects: briefs.length,
    done: sum("done"),
    open: sum("open"),
    stuck: sum("stuck"),
    decide: sum("decide"),
    past: sum("past"),
    attention: briefs.filter((brief) => brief.status !== "done").length,
    latestDone,
  };
}
