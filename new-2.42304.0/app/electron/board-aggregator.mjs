// Read-only aggregator for the full-page 总管 board.
//
// Sources:
//   - superagent-fretsense on 127.0.0.1:3082 (/orchestrator/api)
//   - T3 threads served by 127.0.0.1:3773 (verified there, listed through
//     `t3 thread list`; the live DB is only used for project ids/paths)
//   - Codex sessions under ~/.codex/sessions
//
// A source that cannot be read is returned as ok:false. It is never replaced
// with fixture rows. Capture remains UI-only until its writer lands.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildBoardSnapshot, projectFor } from "../src/board-view-model.mjs";

const execFileAsync = promisify(execFile);
const DAY = 24 * 60 * 60 * 1000;
const CODEX_LIMIT = 80;
const CODEX_HEAD_BYTES = 2 * 1024 * 1024;
const CODEX_TAIL_BYTES = 1024 * 1024;

const text = (value) => (typeof value === "string" ? value.trim() : "");
const iso = (value) => {
  const at = Date.parse(value ?? "");
  return Number.isFinite(at) ? new Date(at).toISOString() : "";
};
const shortPath = (value) => text(value).replace(os.homedir(), "~");
const firstLine = (value, limit = 88) => {
  const line = text(value).split(/\r?\n/).find(Boolean) ?? "";
  return line.length > limit ? `${line.slice(0, limit - 1)}…` : line;
};
const preview = (value, limit = 180) => {
  const line = text(value).replace(/\s+/g, " ");
  return line.length > limit ? `${line.slice(0, limit - 1)}…` : line;
};
const noiseTitle = (value) => /^(noop|reply with the single word: ready|t3 .*smoke|t3 executor no-op|链路测试)/i.test(text(value));

async function readHead(file, maxBytes) {
  const handle = await fs.open(file, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

async function readTail(file, maxBytes) {
  const stat = await fs.stat(file);
  const start = Math.max(0, stat.size - maxBytes);
  const handle = await fs.open(file, "r");
  try {
    const buffer = Buffer.alloc(stat.size - start);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

function jsonLines(value) {
  const rows = [];
  for (const line of value.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { rows.push(JSON.parse(line)); } catch { /* a cut line at a read boundary */ }
  }
  return rows;
}

function userCandidate(value) {
  const input = text(value);
  if (!input) return "";
  if (input.startsWith("<")) return "";
  if (input.startsWith("# AGENTS.md instructions") || input.includes("<INSTRUCTIONS>") || input.includes("<app-context>")) return "";
  if (input.startsWith("## Referenced chats with Codex")) return "";
  if (input.includes("<environment_context>") || input.includes("<external_codex_apps_open_page>")) return "";
  return input;
}

function messageText(item) {
  return (Array.isArray(item?.content) ? item.content : [])
    .filter((part) => part && typeof part === "object")
    .map((part) => text(part.text))
    .filter(Boolean)
    .join("\n");
}

function parseCodexFile(head, tail, mtimeMs, now) {
  const headRows = jsonLines(head);
  const tailRows = jsonLines(tail);
  const metaRow = headRows.find((row) => row?.type === "session_meta");
  const meta = metaRow?.payload ?? {};
  if (meta.parent_thread_id) return null;
  let prompt = "";
  let lastAgent = "";
  for (const row of headRows) {
    if (row?.type === "event_msg" && row.payload?.type === "item_completed") {
      const item = row.payload.item;
      if (item?.type === "UserMessage" && !prompt) prompt = userCandidate(messageText(item));
    }
    if (row?.type === "response_item" && row.payload?.type === "message" && row.payload?.role === "user" && !prompt) {
      prompt = userCandidate(messageText(row.payload));
    }
  }
  let lastEvent = "";
  for (const row of [...tailRows].reverse()) {
    if (row?.type === "event_msg") {
      if (!lastEvent) lastEvent = text(row.payload?.type);
      const item = row.payload?.item;
      if (!lastAgent && item?.type === "AgentMessage") lastAgent = messageText(item);
      if (lastEvent && lastAgent) break;
    }
  }
  const cwd = text(meta.cwd) || text((meta.runtime_workspace_roots ?? [])[0]);
  const project = projectFor({ path: cwd });
  const title = firstLine(prompt) || `${project.name} · Codex`;
  const age = now - mtimeMs;
  const status = lastEvent === "turn_aborted" ? "stuck" : age < 5 * 60_000 ? "running" : "done";
  return {
    id: `codex:${text(meta.id) || `${mtimeMs}`}`,
    projectId: project.id,
    project: project.name,
    repo: project.repo,
    note: project.note,
    title,
    preview: preview(lastAgent) || shortPath(cwd),
    source: "codex",
    status,
    updatedAt: new Date(mtimeMs).toISOString(),
    threadId: text(meta.id) || undefined,
    lastEvent,
    cwd,
  };
}

async function walkFiles(root) {
  const files = [];
  const visit = async (dir) => {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    await Promise.all(entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push(full);
    }));
  };
  await visit(root);
  return files;
}

async function readCodexSource({ home, now }) {
  const root = path.join(home, ".codex", "sessions", "2026");
  try {
    await fs.access(root);
  } catch {
    return { ok: false, error: `找不到 ${shortPath(root)}`, conversations: [], columns: { decide: [], done: [], stuck: [] }, total: 0 };
  }
  const files = await walkFiles(root);
  const recent = [];
  for (const file of files) {
    try {
      const stat = await fs.stat(file);
      if (now - stat.mtimeMs <= 45 * DAY) recent.push({ file, stat });
    } catch { /* file left during the scan */ }
  }
  recent.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  const chosen = recent.slice(0, CODEX_LIMIT);
  const rows = (await Promise.all(chosen.map(async ({ file, stat }) => {
    try {
      const [head, tail] = await Promise.all([readHead(file, CODEX_HEAD_BYTES), readTail(file, CODEX_TAIL_BYTES)]);
      return parseCodexFile(head, tail, stat.mtimeMs, now);
    } catch {
      return null;
    }
  }))).filter(Boolean);
  const conversations = rows.filter((row) => !noiseTitle(row.title)).map(({ lastEvent, cwd, ...row }) => row);
  const done = rows.filter((row) => !noiseTitle(row.title) && row.lastEvent === "task_complete" && now - Date.parse(row.updatedAt) <= 2 * DAY)
    .slice(0, 6)
    .map((row) => ({
      id: `codex-done:${row.threadId || row.id}`,
      projectId: row.projectId,
      project: row.project,
      title: row.title,
      detail: `Codex 回合完成 · ${shortPath(row.cwd)}`,
      kind: "会话",
      who: "Codex",
      at: row.updatedAt,
    }));
  const stuck = rows.filter((row) => !noiseTitle(row.title) && row.lastEvent === "turn_aborted" && now - Date.parse(row.updatedAt) <= 7 * DAY)
    .slice(0, 8)
    .map((row) => ({
      id: `codex-stuck:${row.threadId || row.id}`,
      projectId: row.projectId,
      project: row.project,
      title: row.title,
      detail: `Codex 回合中断 · ${shortPath(row.cwd)}`,
      kind: "会话",
      who: "Codex",
      at: row.updatedAt,
    }));
  return {
    ok: true,
    detail: `${rows.length} 个会话`,
    total: rows.length,
    conversations,
    columns: { decide: [], done, stuck },
  };
}

async function fetchJson(url, timeoutMs = 2200) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "x-orchestrator-request": "1" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function readSuperagentSource({ env, now }) {
  const base = (env.PSA_SUPERAGENT_URL || "http://127.0.0.1:3082").replace(/\/$/, "");
  let state;
  try {
    state = await fetchJson(`${base}/orchestrator/api/state`);
  } catch (error) {
    return { ok: false, error: `3082 没回话：${error?.message || error}`, conversations: [], columns: { decide: [], done: [], stuck: [] }, total: 0 };
  }
  const settle = async (path) => {
    try { return await fetchJson(`${base}/orchestrator/api/${path}`); } catch { return null; }
  };
  const [overview, sources, openTickets, endedTickets, threads] = await Promise.all([
    settle("overview"),
    settle("sources"),
    settle("tickets?state=open&limit=100"),
    settle("tickets?state=ended&limit=50"),
    settle("threads?filter=all&limit=100"),
  ]);
  const repo = text(state?.setup?.accounts?.repository) || "Javey-Li/FretSense";
  const project = projectFor({ path: repo, title: "Fret Sense", repo });
  const threadRows = Array.isArray(threads?.items) ? threads.items : [];
  const conversations = threadRows.map((row) => {
    const stage = text(row.stage);
    const status = stage === "error" ? "stuck" : stage === "evaluating" || stage === "queued" ? "running"
      : stage === "subscribed" ? "waiting" : "done";
    return {
      id: `superagent:${row.key}`,
      projectId: project.id,
      project: project.name,
      repo: project.repo,
      note: project.note,
      title: text(row.title) || text(row.key),
      preview: preview(row.latest?.preview) || text(row.latest?.actor),
      source: "superagent",
      status,
      updatedAt: iso(row.lastAt || row.createdAt) || nowIso(now),
      threadId: text(row.key) || undefined,
      href: text(row.url) || undefined,
    };
  });
  const person = Array.isArray(overview?.person) ? overview.person : [];
  const decide = person.map((row) => ({
    id: `superagent-decide:${row.id}`,
    projectId: project.id,
    project: project.name,
    title: text(row.title) || text(row.id),
    detail: text(row.note?.text) || `工单停在 ${text(row.stage) || "person"}${text(row.action) ? ` · ${text(row.action)}` : ""}`,
    kind: "工单",
    who: "Superagent",
    at: iso(row.updatedAt || row.createdAt) || nowIso(now),
  }));
  const problems = Array.isArray(overview?.problems) ? overview.problems : [];
  const stuck = problems.map((row, index) => ({
    id: `superagent-stuck:${text(row.name) || text(row.source?.id) || index}`,
    projectId: project.id,
    project: project.name,
    title: text(row.kind) === "source-error" ? `${text(row.source?.id)} 来源出错`
      : text(row.kind) === "setup" ? "Superagent 启动没完成"
        : text(row.detail) || text(row.kind) || "Superagent 有问题",
    detail: text(row.detail) || text(row.source?.health?.detail) || text(row.kind),
    kind: "问题",
    who: "Superagent",
    at: iso(row.source?.health?.at || row.at) || nowIso(now),
  }));
  const done = (Array.isArray(endedTickets?.items) ? endedTickets.items : []).slice(0, 6).map((row) => ({
    id: `superagent-done:${row.id}`,
    projectId: project.id,
    project: project.name,
    title: text(row.title) || text(row.id),
    detail: text(row.summary) ? preview(row.summary, 140) : `工单结束 · ${text(row.ended?.outcome) || "ended"}`,
    kind: "工单",
    who: "Superagent",
    at: iso(row.updatedAt || row.ended?.at || row.createdAt) || nowIso(now),
  }));
  const sourceCount = Array.isArray(sources) ? sources.length : 0;
  return {
    ok: true,
    detail: `${threadRows.length} 线程 · ${sourceCount} 来源 · ${openTickets?.total ?? 0} 工单`,
    total: threadRows.length,
    conversations,
    columns: { decide, done, stuck },
  };
}

function nowIso(now) {
  return new Date(now).toISOString();
}

async function readT3Projects(dbPath) {
  const sql = "SELECT project_id, title, workspace_root FROM projection_projects WHERE deleted_at IS NULL ORDER BY title";
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      return db.prepare(sql).all();
    } finally {
      db.close();
    }
  } catch {
    const { stdout } = await execFileAsync("sqlite3", ["-readonly", "-json", dbPath, sql], { maxBuffer: 8 * 1024 * 1024 });
    return stdout.trim() ? JSON.parse(stdout) : [];
  }
}

async function mapLimit(values, limit, run) {
  const out = new Array(values.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (next < values.length) {
      const index = next++;
      out[index] = await run(values[index], index);
    }
  });
  await Promise.all(workers);
  return out;
}

async function t3Threads(bin, projectId) {
  const { stdout } = await execFileAsync(bin, ["thread", "list", "--json", "--project", projectId], {
    maxBuffer: 8 * 1024 * 1024,
    timeout: 15_000,
  });
  const start = stdout.indexOf("[");
  const end = stdout.lastIndexOf("]");
  if (start < 0 || end < start) throw new Error("T3 没有返回线程 JSON");
  return JSON.parse(stdout.slice(start, end + 1));
}

async function readT3Source({ env, home, now }) {
  const origin = (env.T3_ORIGIN || "http://127.0.0.1:3773").replace(/\/$/, "");
  let descriptor;
  try {
    const response = await fetch(`${origin}/.well-known/t3/environment`, { signal: AbortSignal.timeout(1600) });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    descriptor = await response.json();
  } catch (error) {
    return { ok: false, error: `3773 没回话：${error?.message || error}`, conversations: [], columns: { decide: [], done: [], stuck: [] }, total: 0 };
  }
  const root = env.T3CODE_HOME || path.join(home, ".t3");
  const candidates = [path.join(root, "userdata", "statev2.sqlite"), path.join(root, "statev2.sqlite")];
  let dbPath = "";
  for (const candidate of candidates) {
    try { await fs.access(candidate); dbPath = candidate; break; } catch { /* next */ }
  }
  if (!dbPath) {
    return { ok: false, error: `找不到 T3 线程库 ${shortPath(candidates[0])}`, conversations: [], columns: { decide: [], done: [], stuck: [] }, total: 0 };
  }
  let projects;
  try {
    projects = await readT3Projects(dbPath);
  } catch (error) {
    return { ok: false, error: `T3 项目清单读不出来：${error?.message || error}`, conversations: [], columns: { decide: [], done: [], stuck: [] }, total: 0 };
  }
  const bin = env.T3_BIN || path.join(home, ".t3", "bin", "t3");
  let failures = 0;
  const groups = await mapLimit(projects, 4, async (project) => {
    try {
      const rows = await t3Threads(bin, project.project_id);
      return { project, rows, ok: true };
    } catch (error) {
      failures += 1;
      return { project, rows: [], ok: false, error };
    }
  });
  const succeeded = groups.filter((group) => group.ok).length;
  if (projects.length > 0 && succeeded === 0) {
    return { ok: false, error: `3773 在线，但线程读不出来：${groups[0]?.error?.message || "t3 CLI 没回话"}`,
      conversations: [], columns: { decide: [], done: [], stuck: [] }, total: 0 };
  }
  const rows = groups.flatMap((group) => group.rows.map((row) => ({ ...row, project: group.project })));
  const conversations = rows.filter((row) => !noiseTitle(row.title)).map((row) => {
    const project = projectFor({ path: text(row.project.workspace_root), title: text(row.project.title) });
    const status = text(row.status);
    return {
      id: `t3:${row.threadId}`,
      projectId: project.id,
      project: project.name,
      repo: project.repo,
      note: project.note,
      title: text(row.title) || text(row.threadId),
      preview: `${text(row.project.title) || project.name} · ${status || "没有运行记录"}`,
      source: "t3",
      status: status === "running" || status === "working" ? "running" : status === "waiting" ? "waiting"
        : status === "failed" || status === "error" ? "stuck" : "done",
      updatedAt: iso(row.updatedAt || row.createdAt) || nowIso(now),
      threadId: text(row.threadId),
    };
  });
  const done = rows.filter((row) => !noiseTitle(row.title) && text(row.status) === "completed"
    && now - Date.parse(iso(row.updatedAt) || 0) <= 2 * DAY)
    .slice(0, 6)
    .map((row) => {
      const project = projectFor({ path: text(row.project.workspace_root), title: text(row.project.title) });
      return {
        id: `t3-done:${row.threadId}`,
        projectId: project.id,
        project: project.name,
        title: text(row.title) || text(row.threadId),
        detail: `T3 回合完成 · ${text(row.project.title) || project.name}`,
        kind: "线程",
        who: "T3",
        at: iso(row.updatedAt) || nowIso(now),
      };
    });
  const stuck = rows.filter((row) => !noiseTitle(row.title) && ["failed", "error"].includes(text(row.status)))
    .slice(0, 6)
    .map((row) => {
      const project = projectFor({ path: text(row.project.workspace_root), title: text(row.project.title) });
      return {
        id: `t3-stuck:${row.threadId}`,
        projectId: project.id,
        project: project.name,
        title: text(row.title) || text(row.threadId),
        detail: `T3 运行失败 · ${text(row.project.title) || project.name}`,
        kind: "线程",
        who: "T3",
        at: iso(row.updatedAt) || nowIso(now),
      };
    });
  return {
    ok: true,
    detail: `${rows.length} 个线程 · T3 ${text(descriptor.serverVersion) || "在线"}${failures ? ` · ${failures} 个项目没回` : ""}`,
    total: rows.length,
    conversations,
    columns: { decide: [], done, stuck },
  };
}

let cache = { at: 0, snapshot: null };

export async function readBoardSnapshot({ env = process.env, force = false } = {}) {
  const now = Date.now();
  if (!force && cache.snapshot && now - cache.at < 20_000) {
    return { ok: true, snapshot: cache.snapshot, cached: true };
  }
  const home = os.homedir();
  const [codex, superagent, t3] = await Promise.allSettled([
    readCodexSource({ home, now }),
    readSuperagentSource({ env, now }),
    readT3Source({ env, home, now }),
  ]);
  const settled = (result, label) => result.status === "fulfilled" ? result.value
    : { ok: false, error: `${label} 没回话：${result.reason?.message || result.reason}`, conversations: [], columns: { decide: [], done: [], stuck: [] }, total: 0 };
  const snapshot = buildBoardSnapshot({
    now: new Date(now).toISOString(),
    sources: {
      codex: settled(codex, "Codex"),
      superagent: settled(superagent, "Superagent"),
      t3: settled(t3, "T3"),
    },
  });
  cache = { at: now, snapshot };
  return { ok: true, snapshot };
}
