// Writes one board capture as a GitHub Issue through the owner's gh session.
// The renderer picks a project first; only the six board projects are accepted.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildIssueDraft } from "../src/board-view-model.mjs";

const execFileAsync = promisify(execFile);

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
