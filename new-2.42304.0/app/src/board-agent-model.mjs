// Agent Inbox model for the 总管 board.
//
// One row per thing that needs a state: a decision, a stuck run, a run that is
// waiting or running, and the last few that finished. Rows from the three
// sources are merged by thread id so a Codex session that shows up both as a
// column row and as a conversation is one row that carries the session's
// context, model and tool telemetry.

import { firstSentence } from "./board-text-model.mjs";

const text = (value) => (typeof value === "string" ? value.trim() : "");
const plain = (value) => firstSentence(value, 140);
const time = (value) => {
  const at = Date.parse(value ?? "");
  return Number.isFinite(at) ? at : 0;
};

export const INBOX_STATES = Object.freeze(["decide", "stuck", "waiting", "running", "done"]);
const RANK = Object.freeze({ decide: 0, stuck: 1, waiting: 2, running: 3, done: 4 });
const DONE_LIMIT = 8;

export const INBOX_FILTERS = Object.freeze([
  { id: "attention", label: "要处理", states: ["decide", "stuck", "waiting"] },
  { id: "running", label: "在跑", states: ["running"] },
  { id: "done", label: "收口", states: ["done"] },
  { id: "all", label: "全部", states: INBOX_STATES },
]);

const CONVERSATION_STATE = { running: "running", waiting: "waiting", stuck: "stuck", suspected: "stuck", done: "done" };

export function threadKey(row, source) {
  const id = text(row.threadId) || text(row.id).replace(/^(?:codex|codex-done|codex-stuck|t3|t3-done|t3-stuck|superagent|superagent-decide|superagent-done|superagent-stuck):/, "");
  return `${source}:${id}`;
}

function lastTool(tools = []) {
  return tools.length ? tools[tools.length - 1] : null;
}

function stepFor(item) {
  if (item.state === "running") {
    const tool = lastTool(item.tools);
    if (tool) return `${tool.verb}${tool.object ? ` · ${tool.object}` : ""}`;
  }
  return item.detail || "";
}

function fromConversation(row) {
  const state = CONVERSATION_STATE[row.status] ?? "done";
  return {
    key: threadKey(row, row.source),
    id: row.id,
    state,
    title: row.title,
    project: row.project,
    projectId: row.projectId,
    source: row.source,
    at: row.updatedAt,
    detail: plain(row.preview),
    kind: "会话",
    fromConversation: true,
    href: row.href,
    threadId: row.threadId,
    ticketId: row.ticketId,
    ticketTitle: row.ticketTitle,
    workItemId: row.workItemId,
    parentThreadId: row.parentThreadId,
    workItemRole: row.workItemRole,
    session: row.session !== false,
    context: row.context ?? null,
    models: row.models ?? null,
    tools: row.tools ?? [],
    plan: row.plan ?? null,
    report: text(row.preview),
    main: row.main,
    outcome: row.outcome,
    pastReason: row.stale?.reason,
  };
}

function fromColumn(row, state) {
  return {
    key: threadKey(row, row.source),
    id: row.id,
    state,
    title: row.title,
    project: row.project,
    projectId: row.projectId,
    source: row.source,
    at: row.at,
    detail: plain(row.detail),
    kind: text(row.kind) || "事项",
    href: row.href,
    threadId: row.threadId,
    ticketId: row.ticketId,
    ticketTitle: row.ticketTitle,
    workItemId: row.workItemId,
    parentThreadId: row.parentThreadId,
    workItemRole: row.workItemRole,
    session: row.session !== false,
    context: null,
    models: null,
    tools: [],
    plan: null,
    report: text(row.detail),
    outcome: row.settled ? "settled" : undefined,
    pastReason: row.pastReason,
  };
}

function merge(into, extra) {
  const report = [into, extra].find((entry) => entry.fromConversation && entry.detail);
  return {
    ...into,
    detail: into.state === "done" && report ? report.detail : into.detail || extra.detail,
    href: into.href ?? extra.href,
    threadId: into.threadId ?? extra.threadId,
    context: into.context ?? extra.context,
    models: into.models ?? extra.models,
    tools: into.tools?.length ? into.tools : extra.tools,
    plan: into.plan ?? extra.plan,
    report: into.state === "done" && report ? report.report : into.report || extra.report,
    main: into.main ?? extra.main,
    ticketId: into.ticketId ?? extra.ticketId,
    ticketTitle: into.ticketTitle ?? extra.ticketTitle,
    workItemId: into.workItemId ?? extra.workItemId,
    parentThreadId: into.parentThreadId ?? extra.parentThreadId,
    workItemRole: into.workItemRole ?? extra.workItemRole,
    session: into.session === false || extra.session === false ? false : into.session ?? extra.session,
  };
}

export function buildAgentInbox({ columns = {}, projects = [], older = [], now = new Date().toISOString(), doneWithinMs = 2 * 24 * 60 * 60 * 1000, doneLimit = DONE_LIMIT, superagentDone = false } = {}) {
  const conversations = projects.flatMap((project) => project.conversations ?? []);
  const byKey = new Map();
  const add = (item) => {
    const existing = byKey.get(item.key);
    if (!existing) { byKey.set(item.key, item); return; }
    const at = time(item.at);
    const existingAt = time(existing.at);
    const winner = at !== existingAt ? (at > existingAt ? item : existing)
      : RANK[item.state] < RANK[existing.state] ? item : existing;
    byKey.set(item.key, merge(winner, winner === item ? existing : item));
  };

  for (const row of columns.decide ?? []) add(fromColumn(row, "decide"));
  for (const row of columns.stuck ?? []) add(fromColumn(row, "stuck"));
  for (const row of columns.done ?? []) add(fromColumn(row, "done"));
  const past = [];
  for (const row of columns.stuckPast ?? []) past.push({ ...fromColumn(row, "stuck"), past: true, pastReason: row.pastReason || "已过去" });
  for (const row of older.flatMap((project) => project.conversations ?? [])) {
    if (row.stale && !row.archived) past.push({ ...fromConversation(row), past: true });
  }
  for (const row of conversations) {
    if (row.stale) { past.push({ ...fromConversation(row), past: true }); continue; }
    if (row.status === "done" && time(now) - time(row.updatedAt) > doneWithinMs) continue;
    if (row.status === "done" && row.source === "superagent" && !superagentDone) continue;
    add(fromConversation(row));
  }
  const pastByKey = new Map();
  const addPast = (item) => {
    const existing = pastByKey.get(item.key);
    if (!existing) { pastByKey.set(item.key, item); return; }
    const base = existing.fromConversation ? existing : item.fromConversation ? item : existing;
    const extra = base === existing ? item : existing;
    pastByKey.set(item.key, {
      ...merge(base, extra),
      pastReason: base.pastReason || extra.pastReason,
      pastKind: base.pastKind ?? extra.pastKind,
      pastLabel: base.pastLabel ?? extra.pastLabel,
      at: time(item.at) > time(existing.at) ? item.at : existing.at,
    });
  };
  for (const item of past) addPast(item);
  // A thread may arrive from both a live column and a historical bucket. Keep
  // one row per source + thread id and let the latest state choose the bucket;
  // equal timestamps prefer the historical row so it cannot re-enter live.
  for (const [key, pastItem] of [...pastByKey]) {
    const liveItem = byKey.get(key);
    if (!liveItem) continue;
    const pastAt = time(pastItem.at);
    const liveAt = time(liveItem.at);
    if (pastAt >= liveAt) {
      byKey.delete(key);
      pastByKey.set(key, {
        ...merge(pastItem, liveItem),
        pastReason: pastItem.pastReason || liveItem.pastReason,
        pastKind: pastItem.pastKind ?? liveItem.pastKind,
        pastLabel: pastItem.pastLabel ?? liveItem.pastLabel,
        at: pastAt >= liveAt ? pastItem.at : liveItem.at,
      });
    } else {
      pastByKey.delete(key);
      byKey.set(key, merge(liveItem, pastItem));
    }
  }

  const ordered = [...byKey.values()].map((item) => ({ ...item, step: stepFor(item) }))
    .sort((a, b) => RANK[a.state] - RANK[b.state] || time(b.at) - time(a.at));
  const live = ordered.filter((item) => item.state !== "done");
  const done = ordered.filter((item) => item.state === "done").slice(0, doneLimit);
  const counts = Object.fromEntries(INBOX_STATES.map((state) => [state, ordered.filter((item) => item.state === state).length]));
  const pastItems = [...pastByKey.values()].sort((a, b) => time(b.at) - time(a.at)).map((item) => ({ ...item, step: item.detail }));
  return { items: [...live, ...done], past: pastItems, counts };
}

export function filterInbox(items, filterId) {
  const filter = INBOX_FILTERS.find((entry) => entry.id === filterId) ?? INBOX_FILTERS[0];
  return items.filter((item) => filter.states.includes(item.state));
}

export function contextTone(percent) {
  if (percent >= 85) return "danger";
  if (percent >= 60) return "warning";
  return "ok";
}
