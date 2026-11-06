// Board snapshot model for the full-page 总管 board.
//
// Pure merge + display helpers. The Electron aggregator owns all reads:
// Codex sessions under ~/.codex/sessions, a running superagent instance's
// /orchestrator/api, and the T3 threads served by 127.0.0.1:3773. A failed
// source stays failed; nothing here fills a gap with fixture data.

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
  { id: "other", name: "其他", repo: "", note: "", patterns: [] },
];

export const CAPTURE_PROJECTS = Object.freeze(PROJECTS
  .filter((project) => project.id !== "other")
  .map(({ id, name, repo }) => ({ id, name, repo })));

const otherProject = PROJECTS[PROJECTS.length - 1];

export function projectFor({ path: workspace = "", title = "", repo = "" } = {}) {
  const matched = PROJECTS.find((project) => project.patterns.some((pattern) => pattern.test(workspace)));
  if (matched) return { ...matched, patterns: undefined };
  return { ...otherProject, patterns: undefined, repo: text(repo) };
}

const projectMeta = (row) => {
  if (row.projectId && row.project) {
    return { id: row.projectId, name: row.project, repo: text(row.repo), note: text(row.note) };
  }
  return projectFor({ path: row.workspace || row.cwd || row.repo, title: row.project });
};

function normalizeConversation(row, source) {
  const project = projectMeta(row);
  return {
    id: text(row.id) || `${source}:${Math.random().toString(36).slice(2)}`,
    projectId: project.id,
    project: project.name,
    repo: project.repo,
    note: project.note,
    title: text(row.title) || "未命名对话",
    preview: text(row.preview),
    source,
    status: ["running", "waiting", "stuck", "suspected"].includes(row.status) ? row.status : "done",
    updatedAt: row.updatedAt || row.at || new Date().toISOString(),
    archived: !!row.archived,
    unread: !!row.unread,
    threadId: text(row.threadId) || undefined,
    href: text(row.href) || undefined,
  };
}

function normalizeColumnItem(row, source) {
  const project = projectMeta(row);
  return {
    id: text(row.id),
    projectId: project.id,
    project: project.name,
    title: text(row.title) || text(row.detail) || "未命名",
    detail: text(row.detail),
    source,
    kind: text(row.kind) || "事项",
    who: text(row.who) || source,
    at: row.at || row.updatedAt || new Date().toISOString(),
    href: text(row.href) || undefined,
  };
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
  return {
    conversations: conversations.length,
    running: conversations.filter((row) => row.status === "running").length,
    waiting: conversations.filter((row) => row.status === "waiting").length,
    unread: conversations.filter((row) => row.unread).length,
  };
}

export function buildRuleReport(snapshot) {
  const decide = snapshot.columns?.decide ?? [];
  const done = snapshot.columns?.done ?? [];
  const stuck = snapshot.columns?.stuck ?? [];
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
      { key: "stuck", label: "卡在哪", text: stuck.length ? `${stuck.length} 件卡住：${titles(stuck)}${more(stuck)}。` : "没有卡住的事。" },
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
  const seen = new Set();
  const allConversations = conversationRows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
  const cutoff = time(now) - RECENT_DAYS * DAY;
  const recent = allConversations.filter((row) => !row.archived && time(row.updatedAt) >= cutoff);
  const older = allConversations.filter((row) => row.archived || time(row.updatedAt) < cutoff);
  const projects = mergeProjects(recent);
  for (const key of Object.keys(columnRows)) {
    const seenTitle = new Set();
    columnRows[key] = columnRows[key]
      .filter((row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) === index)
      .sort((a, b) => time(b.at) - time(a.at))
      .filter((row) => {
        const titleKey = row.title.replace(/\s+/g, " ").toLowerCase();
        if (seenTitle.has(titleKey)) return false;
        seenTitle.add(titleKey);
        return true;
      })
      .slice(0, 12);
  }
  const snapshot = {
    schemaVersion: "psa.board.v1",
    generatedAt: now,
    columns: columnRows,
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
