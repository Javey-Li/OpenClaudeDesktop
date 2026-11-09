// Work-item grouping for the 总管 board.
//
// A work item is only formed from an explicit machine key: a Ticket id, a
// registered work_item_id, or a parent/child lineage edge. Titles, model names,
// time proximity and similar paths are never used as a join key. A session
// without one of those keys stays its own row and is counted as a session.
//
// The project board counts work items; each item shows its sessions separately,
// with control and execution roles. A work item's state is its newest live
// session, so an old interrupted worker does not keep a finished item open.

const text = (value) => (typeof value === "string" ? value.trim() : "");
const time = (value) => {
  const at = Date.parse(value ?? "");
  return Number.isFinite(at) ? at : 0;
};

const STATE_RANK = Object.freeze({ decide: 0, stuck: 1, waiting: 2, running: 3, done: 4 });
const STALE_MS = 12 * 60 * 60 * 1000;

export const WORK_ITEM_ROLE_LABEL = Object.freeze({ control: "控制", execution: "执行" });

export function workItemIdentity(row = {}) {
  const ticketId = text(row.ticketId ?? row.ticket_id ?? row.ticket?.id);
  const workItemId = text(row.workItemId ?? row.work_item_id ?? row.workItem?.id);
  const parentThreadId = text(row.parentThreadId ?? row.parent_thread_id ?? row.lineage?.parentThreadId);
  return {
    ticketId,
    workItemId,
    parentThreadId,
    title: text(row.workItemTitle ?? row.ticketTitle ?? row.ticket?.title),
    role: text(row.workItemRole),
  };
}

const threadOf = (row) => text(row.threadId) || text(row.id);

/**
 * Adds `workItemKey` to rows using only explicit machine relations.
 *
 * Ticket beats a registered work-item id, which beats an inherited lineage
 * key. A child keeps its own Ticket when it has one; otherwise it inherits the
 * nearest parent's key. A child whose parent is not in this snapshot still
 * gets a lineage key so it does not merge with an unrelated row.
 */
export function assignWorkItemKeys(rows = []) {
  const byThread = new Map();
  for (const row of rows) {
    const id = threadOf(row);
    if (id) byThread.set(id, row);
  }
  const childCount = new Map();
  for (const row of rows) {
    const parent = workItemIdentity(row).parentThreadId;
    if (parent) {
      childCount.set(parent, (childCount.get(parent) ?? 0) + 1);
    }
  }
  const resolved = new Map();
  const resolving = new Set();

  const resolve = (row) => {
    const id = threadOf(row);
    if (id && resolved.has(id)) return resolved.get(id);
    const own = workItemIdentity(row);
    let result;
    if (own.ticketId) {
      result = { ...own, key: `ticket:${own.ticketId}`, inherited: false };
    } else if (own.workItemId) {
      result = { ...own, key: `work-item:${own.workItemId}`, inherited: false };
    } else if (own.parentThreadId) {
      const parent = byThread.get(own.parentThreadId);
      if (parent && id && !resolving.has(id)) {
        resolving.add(id);
        const parentItem = resolve(parent);
        resolving.delete(id);
        result = {
          key: parentItem.key || `lineage:${own.parentThreadId}`,
          ticketId: parentItem.ticketId,
          workItemId: parentItem.workItemId,
          parentThreadId: own.parentThreadId,
          title: parentItem.title || own.title,
          role: own.role || "execution",
          inherited: true,
        };
      } else {
        result = {
          key: `lineage:${own.parentThreadId}`,
          ticketId: "",
          workItemId: "",
          parentThreadId: own.parentThreadId,
          title: own.title,
          role: own.role || "execution",
          inherited: true,
        };
      }
    } else if (id && childCount.has(id)) {
      result = {
        key: `lineage:${id}`,
        ticketId: "",
        workItemId: "",
        parentThreadId: "",
        title: own.title,
        role: "control",
        inherited: false,
      };
    } else {
      result = { ...own, key: "", inherited: false };
    }
    if (id) resolved.set(id, result);
    return result;
  };

  return rows.map((row) => {
    if (row.workItemKey) {
      return {
        ...row,
        workItemTicketId: row.workItemTicketId || null,
        workItemTitle: text(row.workItemTitle) || "",
        workItemRole: row.workItemRole || null,
      };
    }
    const item = resolve(row);
    const id = threadOf(row);
    const hasChildren = childCount.has(id);
    const role = text(row.workItemRole) || item.role
      || (item.parentThreadId ? "execution" : hasChildren ? "control" : "");
    const scoped = item.key ? `${text(row.projectId) || "other"}:${item.key}` : "";
    return {
      ...row,
      workItemKey: scoped || null,
      workItemTicketId: item.ticketId || null,
      workItemId: item.workItemId || row.workItemId || null,
      parentThreadId: item.parentThreadId || row.parentThreadId || null,
      workItemTitle: text(row.workItemTitle) || item.title || "",
      workItemRole: role || null,
    };
  });
}

function sessionOf(item) {
  if (item.session === false) return false;
  if (item.session === true) return true;
  return item.fromConversation === true || Boolean(item.threadId);
}

function sessionView(item) {
  return {
    key: item.threadKey || item.key,
    id: item.id,
    source: item.source,
    role: item.workItemRole || "",
    roleLabel: WORK_ITEM_ROLE_LABEL[item.workItemRole] || "",
    name: item.name || item.title || "未命名会话",
    state: item.state,
    at: item.at,
    past: !!item.past,
    summary: item.summary || "",
  };
}

export function sessionLabel(sessions = []) {
  if (!sessions.length) return "";
  if (sessions.length === 1) return sessions[0].roleLabel || "1 个会话";
  const control = sessions.filter((session) => session.role === "control").length;
  const execution = sessions.filter((session) => session.role === "execution").length;
  const unknown = sessions.length - control - execution;
  const parts = [];
  if (control) parts.push(`控制 ${control}`);
  if (execution) parts.push(`执行 ${execution}`);
  if (unknown) parts.push(`会话 ${unknown}`);
  return `${sessions.length} 个会话${parts.length ? ` · ${parts.join(" · ")}` : ""}`;
}

function withoutGroupFields(item) {
  const { members, sessions, sessionLabel: _label, sessionCount, ...rest } = item;
  return rest;
}

function chooseMember(members, now) {
  const live = members.filter((member) => !member.past && !isStale(member, now));
  const pool = live.length ? live : members;
  return pool.slice().sort((a, b) => {
    const delta = time(b.at) - time(a.at);
    if (delta) return delta;
    return (STATE_RANK[a.state] ?? 9) - (STATE_RANK[b.state] ?? 9);
  })[0];
}

function isStale(item, now = new Date().toISOString()) {
  if (!item || item.past) return false;
  if (!["stuck", "suspected", "running", "waiting"].includes(item.state)) return false;
  const at = time(item.at);
  return at > 0 && time(now) - at >= STALE_MS;
}

function effectiveState(chosen, members, now) {
  if (!chosen || chosen.past) return chosen?.state;
  const live = members.filter((member) => !member.past && !isStale(member, now));
  if (!live.length) return chosen.state;
  return live.reduce((best, member) => (
    (STATE_RANK[member.state] ?? 9) < (STATE_RANK[best] ?? 9) ? member.state : best
  ), chosen.state);
}

/**
 * Collapses rows that share an explicit work item. Rows without a key are
 * returned untouched, one row per session.
 */
export function groupLineItems(items = [], { now = new Date().toISOString() } = {}) {
  const groups = new Map();
  const order = [];
  for (const item of items) {
    if (!item.workItemKey) {
      const sessions = sessionOf(item) ? [sessionView(item)] : [];
      order.push({ ...item, sessionCount: sessions.length, sessionLabel: sessionLabel(sessions), sessions });
      continue;
    }
    let group = groups.get(item.workItemKey);
    if (!group) {
      group = { key: item.workItemKey, title: "", members: [] };
      groups.set(item.workItemKey, group);
      order.push(group);
    }
    group.members.push(item);
    if (!group.title) group.title = text(item.workItemTitle) || text(item.name) || text(item.title);
  }

  return order.map((entry) => {
    if (!entry.members) return entry;
    const chosen = chooseMember(entry.members, now);
    const state = effectiveState(chosen, entry.members, now) || "done";
    const sessions = entry.members.filter(sessionOf).map(sessionView);
    const past = entry.members.every((member) => member.past);
    const title = entry.title || chosen.name || chosen.title;
    return {
      ...withoutGroupFields(chosen),
      key: `work:${entry.key}`,
      workItemKey: entry.key,
      workItemTitle: title,
      name: title,
      title,
      state,
      at: chosen.at,
      past,
      sessionCount: sessions.length,
      sessionLabel: sessionLabel(sessions),
      sessions,
    };
  });
}

function lineIdentity(item) {
  const threadId = text(item.threadId);
  if (threadId) return `${text(item.source)}:${threadId}`;
  const id = text(item.id).replace(/^(?:codex|codex-done|codex-stuck|t3|t3-done|t3-stuck|superagent|superagent-decide|superagent-done|superagent-stuck):/, "");
  return `${text(item.source)}:${id || text(item.key).replace(/^past:/, "")}`;
}

/**
 * Keeps one row per thread across live and past buckets. The newest real
 * timestamp wins; on an exact tie a past row wins, so an older live copy
 * cannot re-enter the live board.
 */
export function dedupeLineItems(items = []) {
  const best = new Map();
  const order = [];
  for (const item of items) {
    const key = lineIdentity(item);
    if (!key || key === ":") { order.push(item); continue; }
    const existing = best.get(key);
    if (!existing) {
      best.set(key, item);
      order.push(key);
      continue;
    }
    const at = time(item.at);
    const existingAt = time(existing.at);
    const wins = at !== existingAt ? at > existingAt
      : item.past !== existing.past ? item.past
        : (STATE_RANK[item.state] ?? 9) < (STATE_RANK[existing.state] ?? 9);
    if (wins) best.set(key, item);
  }
  return order.map((key) => (typeof key === "string" ? best.get(key) : key))
    .filter((key) => key && typeof key === "object");
}
