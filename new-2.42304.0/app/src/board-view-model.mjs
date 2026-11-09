// Board snapshot model for the full-page 总管 board.
//
// Pure merge + display helpers. The Electron aggregator owns all reads:
// Codex sessions under ~/.codex/sessions, a running superagent instance's
// /orchestrator/api, and the T3 threads served by 127.0.0.1:3773. A failed
// source stays failed; nothing here fills a gap with fixture data.

import { cleanBoardTitle, leadingRef, settledLabel, splitStuck, staleConversation } from "./board-stuck-model.mjs";
import { threadKey } from "./board-agent-model.mjs";
import { firstSentence, plainText } from "./board-text-model.mjs";
import { assignWorkItemKeys } from "./board-work-item-model.mjs";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const RECENT_DAYS = 3;

const time = (value) => {
  const at = Date.parse(value ?? "");
  return Number.isFinite(at) ? at : 0;
};

const text = (value) => (typeof value === "string" ? value.trim() : "");
const firstLine = (value, limit = 80) => {
  const line = text(value).split(/\r?\n/).find(Boolean) ?? "";
  return line.length > limit ? `${line.slice(0, limit - 1)}…` : line;
};

export const BOARD_COLUMNS = Object.freeze([
  { key: "decide", title: "要我定的", eyebrow: "01", empty: "没有等你定的事。" },
  { key: "done", title: "做完的", eyebrow: "02", empty: "今天还没有收口的事。" },
  { key: "stuck", title: "卡住的", eyebrow: "03", empty: "没有卡住的事。" },
]);

export const BOARD_SOURCES = Object.freeze([
  { id: "codex", label: "Codex", hint: "~/.codex/sessions" },
  { id: "superagent", label: "Superagent", hint: "127.0.0.1:3082 /orchestrator/api" },
  { id: "t3", label: "T3", hint: "127.0.0.1:3773 · 只读线程库" },
]);

const PROJECTS = [
  { id: "fretsense", name: "FretSense", repo: "Javey-Li/FretSense", note: "主产品",
    patterns: [/\/FretSense(?:\/|$)/i, /FretSense-fleet/i, /fretsense-batch/i, /superagent-fretsense/i] },
  { id: "delicacy", name: "Delicacy", repo: "Javey-Li/Delicacy-HTML", note: "设计智能",
    patterns: [/delicacy-html/i, /\/Delicacy(?:\/|$)/i] },
  { id: "guitaros", name: "GuitarOS", repo: "", note: "教学系统",
    patterns: [/\/guitarOS(?:\/|$)/i, /guitar-brain/i] },
  { id: "dawdex", name: "DAWdex", repo: "", note: "暂存",
    patterns: [/\/DAWdex(?:\/|$)/i] },
  { id: "mission", name: "mission", repo: "", note: "个人系统",
    patterns: [/\/Projects\/mission(?:\/|$)/i] },
  { id: "personal-super-agent", name: "personal-super-agent", repo: "Javey-Li/personal-super-agent", note: "总管",
    patterns: [/personal-super-agent/i, /dsh-superagent/i, /dshsa-/i, /\/OpenClaudeDesktop(?:\/|$)/i, /\/OpenClaude Desktop(?:\/|$)/i] },
  { id: "obsidian", name: "Obsidian", repo: "", note: "第二大脑",
    patterns: [/\/Obsidian Vault(?:\/|$)/i] },
  { id: "other", name: "其他", repo: "", note: "", patterns: [] },
];

export const CAPTURE_PROJECTS = Object.freeze(PROJECTS
  .filter((project) => project.id !== "other")
  .map(({ id, name, repo }) => ({ id, name, repo })));

const otherProject = PROJECTS[PROJECTS.length - 1];
const byId = (id) => {
  const project = PROJECTS.find((entry) => entry.id === id) ?? otherProject;
  return { id: project.id, name: project.name, repo: project.repo, note: project.note };
};

export function projectFor({ path: workspace = "", title = "", repo = "" } = {}) {
  const matched = PROJECTS.find((project) => project.patterns.some((pattern) => pattern.test(workspace)));
  if (matched) return { ...matched, patterns: undefined };
  return { ...otherProject, patterns: undefined, repo: text(repo) };
}

// The executive Codex conversation. Its stored title is its first prompt
// ("接管 Fret Sense 首席职责 现在你负责总结……", "接手超级代理主对话"); the board names it by role.
export const MAIN_THREAD_NAME = "执行总负责 · Codex 主对话";
const MAIN_TITLE = /^(?:@?\s*标题\s*[:：]?\s*)?(?:接管|接手)\s*.{0,16}?(?:首席职责|主对话)/;
export function isMainThread({ title = "" } = {}) {
  return MAIN_TITLE.test(text(title));
}

// Project attribution order: an explicit repo/Issue first, then the row's
// project metadata, and only when metadata is unknown the line name rules
// (L4/W this desktop, V the DAWdex video, SB the Obsidian rebuild). R-xx is a
// Router task number, not a project prefix.
const NAME_KEYWORDS = [
  ["fretsense", /fret\s?sense/i],
  ["delicacy", /delicacy/i],
  ["guitaros", /guitar\s?os/i],
  ["dawdex", /dawdex|钢琴卷帘|piano roll|cubase/i],
  ["obsidian", /obsidian|第二大脑/i],
  ["mission", /\bmission\b/i],
  ["personal-super-agent", /super\s?agent|超级代理|总看板/i],
];
const LINE_TOKEN = String.raw`(?:L(?:4|5|6|7|8|14|15)[a-z]?|W\d+[a-z]?|V\d+[a-z]?|SB\d*[a-z]?|PSA\d*[a-z]?|R-?\d+)`;
const LINE_AT_START = new RegExp(`^${LINE_TOKEN}(?=[\\s·:：\\-–—]|$)`);
const LINE_IN_NAME = new RegExp(`(?:^|[\\s（(【\\[])(${LINE_TOKEN})(?=[\\s·:：\\-–—，,。]|$)`);
const LINE_PROJECT = [
  ["fretsense", /^L(?:8|15)/i],
  ["personal-super-agent", /^(?:L(?:4|5|6|7|14)|W|SB|PSA)/i],
  ["dawdex", /^V/i],
];
const REPO_PROJECT = [
  ["fretsense", /Javey-Li\/FretSense\b/i],
  ["delicacy", /Javey-Li\/Delicacy-HTML\b/i],
  ["guitaros", /Javey-Li\/(?:GuitarOS|guitar-brain)\b/i],
  ["dawdex", /Javey-Li\/DAWdex\b/i],
  ["mission", /Javey-Li\/mission\b/i],
  ["personal-super-agent", /Javey-Li\/(?:personal-super-agent|dsh-superagent[\w-]*|OpenClaudeDesktop)\b/i],
];

export function classifyLine({ projectId = "", title = "", preview = "", repo = "" } = {}) {
  if (isMainThread({ title })) return byId("personal-super-agent");
  const name = text(title);
  const repoHit = REPO_PROJECT.find(([, pattern]) => pattern.test(`${text(repo)} ${name} ${text(preview)}`));
  if (repoHit) return byId(repoHit[0]);
  if (projectId && projectId !== "other") return null;
  // Line names are the last resort. A stored title can be a whole first prompt,
  // so match keywords on the opening line name, not on body mentions.
  const atStart = LINE_AT_START.exec(name)?.[0];
  const embedded = atStart ? null : LINE_IN_NAME.exec(name.slice(0, 48))?.[1];
  const token = atStart ?? embedded;
  const lineProject = token ? LINE_PROJECT.find(([, pattern]) => pattern.test(token)) : null;
  if (lineProject) return byId(lineProject[0]);
  const keyword = NAME_KEYWORDS.find(([, pattern]) => pattern.test(shortLineTitle(name)));
  if (keyword) return byId(keyword[0]);
  return byId("other");
}

const projectMeta = (row) => {
  const given = row.projectId && row.project
    ? { id: row.projectId, name: row.project, repo: text(row.repo), note: text(row.note) }
    : projectFor({ path: row.workspace || row.cwd || row.repo, title: row.project });
  const { patterns, ...meta } = given;
  return classifyLine({ projectId: meta.id, title: row.title, preview: row.preview ?? row.detail, repo: row.repo }) ?? meta;
};

// A Codex session's stored title can be its whole first prompt. A line name is
// the opening clause ("L4j 总看板三级页面写线"), not the instructions after it.
function shortLineTitle(value) {
  const title = text(value).replace(/^你是\s*/, "").trim();
  const clause = title.split(/[，,。；;\n]/)[0].trim();
  const token = LINE_AT_START.exec(clause)?.[0] ?? LINE_IN_NAME.exec(clause.slice(0, 48))?.[1];
  const named = token ? clause.slice(clause.indexOf(token)) : clause;
  if (token && named.slice(token.length).trim().length < 4) return token;
  return named.length > 52 ? `${named.slice(0, 51).trimEnd()}…` : named;
}

const lineTitle = (row, fallback) => (isMainThread({ title: row.title }) ? MAIN_THREAD_NAME
  : shortLineTitle(plainText(cleanBoardTitle(row.title))) || fallback);

function normalizeConversation(row, source) {
  const project = projectMeta(row);
  return {
    id: text(row.id) || `${source}:${Math.random().toString(36).slice(2)}`,
    projectId: project.id,
    project: project.name,
    repo: project.repo,
    note: project.note,
    title: lineTitle(row, "未命名对话"),
    main: isMainThread({ title: row.title }) || undefined,
    preview: text(row.preview),
    summary: firstSentence(row.preview),
    source,
    status: ["running", "waiting", "stuck", "suspected"].includes(row.status) ? row.status : "done",
    updatedAt: row.updatedAt || row.at || new Date().toISOString(),
    archived: !!row.archived,
    unread: !!row.unread,
    threadId: text(row.threadId) || undefined,
    ticketId: text(row.ticketId) || undefined,
    ticketTitle: text(row.ticketTitle) || undefined,
    workItemId: text(row.workItemId) || text(row.work_item_id) || undefined,
    parentThreadId: text(row.parentThreadId) || text(row.parent_thread_id) || undefined,
    workItemRole: ["control", "execution"].includes(text(row.workItemRole)) ? text(row.workItemRole) : undefined,
    session: row.session === false ? false : true,
    href: text(row.href) || undefined,
    context: row.context ?? null,
    models: row.models ?? null,
    tools: Array.isArray(row.tools) ? row.tools : [],
    plan: row.plan ?? null,
    outcome: text(row.outcome) || undefined,
  };
}

function normalizeColumnItem(row, source) {
  const project = projectMeta(row);
  return {
    id: text(row.id),
    projectId: project.id,
    project: project.name,
    title: lineTitle(row, cleanBoardTitle(row.detail) || "未命名"),
    detail: text(row.detail),
    source,
    kind: text(row.kind) || "事项",
    who: text(row.who) || source,
    category: text(row.category),
    sourceId: text(row.sourceId),
    recovered: row.recovered === true,
    at: row.at || row.updatedAt || new Date().toISOString(),
    href: text(row.href) || undefined,
    threadId: text(row.threadId) || undefined,
    ticketId: text(row.ticketId) || undefined,
    ticketTitle: text(row.ticketTitle) || undefined,
    workItemId: text(row.workItemId) || text(row.work_item_id) || undefined,
    parentThreadId: text(row.parentThreadId) || text(row.parent_thread_id) || undefined,
    workItemRole: ["control", "execution"].includes(text(row.workItemRole)) ? text(row.workItemRole) : undefined,
    session: row.session === false ? false : undefined,
    ref: Number.isFinite(Number(row.ref)) && row.ref !== null && row.ref !== "" ? Number(row.ref) : undefined,
  };
}

function shareWorkItemIdentity(conversations, columns) {
  const byThread = new Map();
  const byTicket = new Map();
  for (const row of conversations) {
    if (row.threadId) byThread.set(row.threadId, row);
    if (row.ticketId) byTicket.set(row.ticketId, row);
  }
  for (const bucket of Object.values(columns)) {
    for (const row of bucket) {
      const source = (row.threadId && byThread.get(row.threadId)) || (row.ticketId && byTicket.get(row.ticketId));
      if (!source) continue;
      row.ticketId ??= source.ticketId;
      row.ticketTitle ??= source.ticketTitle;
      row.workItemId ??= source.workItemId;
      row.parentThreadId ??= source.parentThreadId;
      row.workItemRole ??= source.workItemRole;
    }
  }
}

function mergeProjects(conversations) {
  const byId = new Map();
  for (const row of conversations) {
    const project = byId.get(row.projectId) ?? { id: row.projectId, name: row.project, repo: row.repo, note: row.note, conversations: [] };
    project.conversations.push(row);
    byId.set(row.projectId, project);
  }
  const priority = new Map(PROJECTS.map((project, index) => [project.id, index]));
  return [...byId.values()].map((project) => {
    const last = project.conversations.reduce((newest, row) => Math.max(newest, time(row.updatedAt)), 0);
    return { ...project, last, conversations: project.conversations.sort((a, b) => time(b.updatedAt) - time(a.updatedAt)) };
  }).sort((a, b) => {
    const pa = priority.has(a.id) ? priority.get(a.id) : 100;
    const pb = priority.has(b.id) ? priority.get(b.id) : 100;
    return pa - pb || b.last - a.last || a.name.localeCompare(b.name);
  }).map(({ last, ...project }) => project);
}

function sourceRows(inputs = {}) {
  return BOARD_SOURCES.map((definition) => {
    const result = inputs[definition.id];
    const ok = result?.ok === true;
    return {
      ...definition,
      status: ok ? "connected" : "disconnected",
      detail: ok ? text(result.detail) || "已连上" : "没连上",
      error: ok ? "" : text(result?.error) || "没有回话",
      count: Number(result?.total ?? result?.conversations?.length ?? 0) || 0,
    };
  });
}

export function boardTotals({ projects = [] } = {}) {
  const conversations = projects.flatMap((project) => project.conversations ?? []);
  const live = conversations.filter((row) => !row.stale);
  return {
    conversations: conversations.length,
    running: live.filter((row) => row.status === "running").length,
    waiting: live.filter((row) => row.status === "waiting").length,
    unread: conversations.filter((row) => row.unread).length,
  };
}

function collectSettled(sources) {
  const settled = new Map();
  for (const result of Object.values(sources)) {
    if (!result?.ok) continue;
    for (const entry of result.settled ?? []) {
      const ref = Number(entry?.ref);
      if (Number.isFinite(ref)) settled.set(ref, entry);
    }
  }
  return settled;
}

function reconcileConversation(row, settled, now) {
  const ref = leadingRef(row.title);
  const hit = ref ? settled.get(ref) : null;
  if (hit && ["running", "waiting", "stuck", "suspected"].includes(row.status)) {
    return { ...row, status: "done", outcome: row.outcome || text(hit.outcome) || "ended" };
  }
  const stale = staleConversation(row, now);
  return stale ? { ...row, stale } : row;
}

function settleColumns(columnRows, settled) {
  for (const key of ["decide", "stuck"]) {
    const keep = [];
    for (const row of columnRows[key]) {
      const ref = row.ref ?? leadingRef(row.title);
      const hit = ref ? settled.get(ref) : null;
      if (!hit) { keep.push(row); continue; }
      const label = settledLabel(hit.outcome);
      columnRows.done.push({ ...row, kind: "工单", detail: [label, row.detail].filter(Boolean).join(" · "), settled: true, at: hit.at || row.at });
    }
    columnRows[key] = keep;
  }
}

const COLUMN_RANK = Object.freeze({ decide: 0, stuck: 1, done: 2 });
function dedupeColumnsByThread(columnRows) {
  const best = new Map();
  for (const bucket of ["decide", "done", "stuck"]) {
    for (const row of columnRows[bucket]) {
      const key = threadKey(row, row.source);
      const existing = best.get(key);
      if (!existing) { best.set(key, { bucket, row }); continue; }
      const at = time(row.at);
      const existingAt = time(existing.row.at);
      const wins = at !== existingAt ? at > existingAt
        : (COLUMN_RANK[bucket] ?? 9) < (COLUMN_RANK[existing.bucket] ?? 9);
      if (wins) best.set(key, { bucket, row });
    }
  }
  const next = { decide: [], done: [], stuck: [] };
  for (const { bucket, row } of best.values()) next[bucket].push(row);
  for (const bucket of Object.keys(next)) next[bucket].sort((a, b) => time(b.at) - time(a.at));
  return next;
}

export function buildRuleReport(snapshot) {
  const decide = snapshot.columns?.decide ?? [];
  const done = snapshot.columns?.done ?? [];
  const stuck = snapshot.columns?.stuck ?? [];
  const stuckPast = snapshot.columns?.stuckPast ?? [];
  const disconnected = (snapshot.sources ?? []).filter((source) => source.status !== "connected");
  const connected = (snapshot.sources ?? []).length - disconnected.length;
  const titles = (rows) => rows.slice(0, 3).map((row) => `「${row.title.length > 48 ? `${row.title.slice(0, 47)}…` : row.title}」`).join("、");
  const more = (rows) => rows.length > 3 ? `等 ${rows.length} 件` : "";
  const title = decide.length ? `先看 ${decide.length} 件要定的`
    : stuck.length ? `先看 ${stuck.length} 件卡住的`
      : done.length ? `今天已经收口 ${done.length} 件` : "今天还没有要处理的";
  const sourceText = disconnected.length
    ? `${disconnected.map((source) => source.label).join("、")} 没连上；其余按连上的数据算。`
    : `${connected} 个来源都连上了。`;
  return {
    generatedAt: snapshot.generatedAt,
    cadence: "按当前数据即时拼出",
    source: "规则简报",
    title,
    lines: [
      { key: "done", label: "做完了什么", text: done.length ? `做完的栏里有 ${done.length} 件，最近是${titles(done)}。` : "做完的栏里今天还没有东西。" },
      { key: "open", label: "没做完什么", text: `现在有 ${snapshot.totals?.running ?? 0} 条在跑、${snapshot.totals?.waiting ?? 0} 条等你；要你定的有 ${decide.length} 件。` },
      { key: "stuck", label: "卡在哪", text: stuck.length ? `${stuck.length} 件卡住：${titles(stuck)}${more(stuck)}。`
        : stuckPast.length ? `现在没有卡住的；${stuckPast.length} 件已过去，收在卡住的栏下面。` : "没有卡住的事。" },
      { key: "decide", label: "要主人定什么", text: decide.length ? `${decide.length} 件：${titles(decide)}${more(decide)}。` : "没有等你定的事。" },
      { key: "sources", label: "数据来源", text: sourceText },
    ],
  };
}

export function buildBoardSnapshot({ sources = {}, now = new Date().toISOString() } = {}) {
  const conversationRows = [];
  const columnRows = { decide: [], done: [], stuck: [] };
  for (const source of BOARD_SOURCES.map((entry) => entry.id)) {
    const result = sources[source];
    if (!result?.ok) continue;
    for (const row of result.conversations ?? []) conversationRows.push(normalizeConversation(row, source));
    for (const key of ["decide", "done", "stuck"]) {
      for (const row of result.columns?.[key] ?? []) {
        const normalized = normalizeColumnItem(row, source);
        if (normalized.id && normalized.title) columnRows[key].push(normalized);
      }
    }
  }
  const settled = collectSettled(sources);
  settleColumns(columnRows, settled);
  shareWorkItemIdentity(conversationRows, columnRows);
  const keyedConversations = assignWorkItemKeys(conversationRows);
  for (const key of Object.keys(columnRows)) columnRows[key] = assignWorkItemKeys(columnRows[key]);
  Object.assign(columnRows, dedupeColumnsByThread(columnRows));
  const seen = new Set();
  const allConversations = keyedConversations.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  }).map((row) => reconcileConversation(row, settled, now));
  const cutoff = time(now) - RECENT_DAYS * DAY;
  const recent = allConversations.filter((row) => !row.archived && time(row.updatedAt) >= cutoff);
  const older = allConversations.filter((row) => row.archived || time(row.updatedAt) < cutoff);
  const projects = mergeProjects(recent);
  for (const key of Object.keys(columnRows)) {
    const seenThread = new Set();
    columnRows[key] = columnRows[key]
      .filter((row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) === index)
      .sort((a, b) => time(b.at) - time(a.at))
      .filter((row) => {
        const key = threadKey(row, row.source);
        if (seenThread.has(key)) return false;
        seenThread.add(key);
        return true;
      })
      .slice(0, 12);
  }
  const stuckSplit = splitStuck(columnRows.stuck, { now });
  columnRows.stuck = stuckSplit.active;
  const snapshot = {
    schemaVersion: "psa.board.v1",
    generatedAt: now,
    columns: { ...columnRows, stuckPast: stuckSplit.past },
    stuckSummary: stuckSplit.summary,
    projects,
    older: { count: older.length, archived: older.filter((row) => row.archived).length, projects: mergeProjects(older) },
    sources: sourceRows(sources),
    capture: captureConfig(),
    totals: boardTotals({ projects }),
  };
  snapshot.report = buildRuleReport(snapshot);
  return snapshot;
}

export function captureConfig() {
  return {
    hint: "一句话和链接都会写成所选项目的 GitHub Issue。",
  };
}

export function buildIssueDraft({ projectId = "", mode = "note", text: value = "", projects = CAPTURE_PROJECTS } = {}) {
  const input = String(value ?? "").trim();
  if (!projectId) return { ok: false, reason: "先选项目。" };
  if (!input) return { ok: false, reason: "先写点什么。" };
  const project = projects.find((entry) => entry.id === projectId);
  if (!project) return { ok: false, reason: "这个项目不认识。" };
  if (!project.repo) return { ok: false, reason: `${project.name} 还没有 GitHub 仓库。` };
  if (mode === "link") {
    let url;
    try { url = new URL(input); } catch { return { ok: false, reason: "这个链接还读不出来。" }; }
    if (!/^https?:$/.test(url.protocol)) return { ok: false, reason: "只收 http 或 https 链接。" };
    const title = firstLine(`${url.host}${url.pathname}`) || firstLine(input);
    return {
      ok: true,
      projectId,
      repo: project.repo,
      title: `链接 · ${title}`,
      body: `链接：${input}\n\n来自总看板 · ${project.name}\n`,
    };
  }
  const title = firstLine(input) || "总看板里丢进来的一件事";
  return {
    ok: true,
    projectId,
    repo: project.repo,
    title,
    body: `${input}\n\n来自总看板 · ${project.name}\n`,
  };
}

export function groupConversations(projects = []) {
  return projects.map((project) => ({
    ...project,
    conversations: [...(project.conversations ?? [])].sort((a, b) => time(b.updatedAt) - time(a.updatedAt)),
  })).filter((project) => project.conversations.length > 0);
}

export function conversationSources(projects = []) {
  const counts = new Map(BOARD_SOURCES.map((source) => [source.id, 0]));
  for (const project of projects) {
    for (const row of project.conversations ?? []) counts.set(row.source, (counts.get(row.source) ?? 0) + 1);
  }
  return BOARD_SOURCES.map((source) => ({ ...source, count: counts.get(source.id) ?? 0 }));
}

export function relativeLabel(iso, nowIso = new Date().toISOString()) {
  const at = Date.parse(iso ?? "");
  const now = Date.parse(nowIso ?? "");
  if (!Number.isFinite(at) || !Number.isFinite(now)) return "";
  const delta = Math.max(0, now - at);
  if (delta < MINUTE) return "刚刚";
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)} 分钟前`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)} 小时前`;
  if (delta < 7 * DAY) return `${Math.floor(delta / DAY)} 天前`;
  return new Date(at).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}
