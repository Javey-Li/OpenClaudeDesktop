// Board captures go to the local inspiration pool by default, or to a GitHub
// Issue when the renderer explicitly picks that destination.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildIssueDraft } from "../src/board-view-model.mjs";
import { buildInspirationDraft, localInspirationEndpoint } from "../src/board-drop-model.mjs";

const execFileAsync = promisify(execFile);
const text = (value) => (typeof value === "string" ? value.trim() : "");

function ghPath(env) {
  return env.GH_BIN || "/Users/javeyli/.local/bin/gh";
}

export async function createBoardIssue(payload = {}, { env = process.env } = {}) {
  const draft = buildIssueDraft(payload);
  if (!draft.ok) return { ok: false, error: draft.reason };
  const path = [
    "/Users/javeyli/.local/bin",
    "/opt/homebrew/bin",
    "/usr/local/bin",
    env.PATH,
  ].filter(Boolean).join(":");
  try {
    const { stdout } = await execFileAsync(ghPath(env), [
      "issue", "create",
      "--repo", draft.repo,
      "--title", draft.title,
      "--body", draft.body,
    ], {
      env: { ...env, PATH: path },
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });
    const url = stdout.split(/\s+/).find((part) => /^https?:\/\//.test(part));
    if (!url) return { ok: false, error: "Issue 写了，但没有拿到链接。" };
    return { ok: true, url, repo: draft.repo, title: draft.title };
  } catch (error) {
    return { ok: false, error: error?.stderr?.trim() || error?.message || "gh 没写成 Issue。" };
  }
}

export async function dropToInspiration(payload = {}, { env = process.env, fetchFn = fetch } = {}) {
  const draft = buildInspirationDraft(payload);
  if (!draft.ok) return { ok: false, status: "error", error: draft.reason };
  let endpoint;
  try { endpoint = localInspirationEndpoint(env.INSPIRATION_POOL_URL); }
  catch (error) { return { ok: false, status: "error", error: error.message }; }
  const headers = { "Content-Type": "application/json" };
  if (env.INSPIRATION_POOL_TOKEN) headers.Authorization = `Bearer ${env.INSPIRATION_POOL_TOKEN}`;
  let response;
  try {
    response = await fetchFn(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(draft.payload),
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { ok: false, status: "offline", error: "灵感池没开着，内容还在，等开了再丢。" };
  }
  const result = await response.json().catch(() => ({}));
  if ((response.status === 200 || response.status === 201) && result.status === "created") {
    return { ok: true, status: "created", message: "已放进灵感池。", id: result.id || result.entry?.id || "" };
  }
  if (response.status === 409 && result.status === "duplicate") {
    return { ok: true, status: "duplicate", message: "这条已经在灵感池里了。", id: result.id || result.entry?.id || "" };
  }
  return { ok: false, status: "error", error: `灵感池没接收：${text(result.error) || response.statusText || "投递失败"}` };
}

export async function createBoardCapture(payload = {}, options = {}) {
  return payload.destination === "issue" ? createBoardIssue(payload, options) : dropToInspiration(payload, options);
}
