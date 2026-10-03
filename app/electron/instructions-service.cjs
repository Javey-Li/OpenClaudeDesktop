// Custom instructions (C1): composes the global text, the nearest project file
// (.code-desktop/instructions.md) and the project override from settings into
// the text appended to the agent's system prompt, and attaches it to the core
// requests that start, reopen or continue a session.
//
// DeepSeek core: params.codeDesktop.customization.instructions on thread/start,
// thread/resume and turn/start (the bridge applies it from the next model step).
// Codex core: appended to developerInstructions on thread/start and
// thread/resume (both exist in the 0.155.1 protocol); nothing else is sent.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { normalizeInstructions, projectInstructionsFor } = require("./prefs/instructions.mjs");

const PROJECT_FILE = path.posix.join(".code-desktop", "instructions.md");
const FILE_CAP = 32 * 1024;
const TOTAL_CAP = 40000;
const MAX_LEVELS = 8;
const TRUNCATED = "[truncated]";
const DEEPSEEK_METHODS = new Set(["thread/start", "thread/resume", "turn/start"]);
const CODEX_METHODS = new Set(["thread/start", "thread/resume"]);
const TEMPLATE = `<!--
  Project instructions for Code Desktop.
  Everything outside this comment is appended to the agent's system prompt for
  sessions in this folder and its subfolders. HTML comments are ignored.
  Example:
  - Use pnpm, not npm.
  - Run the unit tests before saying a change is done.
-->
`;

/** The nearest <dir>/.code-desktop/instructions.md, walking up from cwd (≤8 levels, never home or /). */
function findProjectFile(cwd, { home = os.homedir(), fs: fsys = fs } = {}) {
  if (typeof cwd !== "string" || !path.isAbsolute(cwd)) return null;
  let dir = path.resolve(cwd);
  for (let level = 0; level < MAX_LEVELS; level++) {
    if (dir === home || dir === path.parse(dir).root) return null;
    const candidate = path.join(dir, PROJECT_FILE);
    try { if (fsys.statSync(candidate).isFile()) return candidate; } catch {}
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

// The template's comment (and any other HTML comment) contributes nothing.
const stripComments = (text) => text.replace(/<!--[\s\S]*?-->/g, "");
const clean = (text) => (typeof text === "string" ? stripComments(text.replace(/\r\n?/g, "\n")).trim() : "");

/** Reads the project file as UTF-8, capped at 32 KB. */
function readProjectFile(file, fsys = fs) {
  if (!file) return { text: "", bytes: 0, exists: false };
  try {
    const stat = fsys.statSync(file);
    if (!stat.isFile()) return { text: "", bytes: 0, exists: false };
    const fd = fsys.openSync(file, "r");
    try {
      const buffer = Buffer.alloc(Math.min(stat.size, FILE_CAP));
      const read = fsys.readSync(fd, buffer, 0, buffer.length, 0);
      return { text: buffer.subarray(0, read).toString("utf8").replace(/�+$/, ""), bytes: stat.size, exists: true, capped: stat.size > FILE_CAP };
    } finally { fsys.closeSync(fd); }
  } catch { return { text: "", bytes: 0, exists: false }; }
}

/**
 * The final appended text, exactly as the agent receives it.
 * @returns {{text:string, parts:{source:string, path?:string, chars:number}[], chars:number, truncated:boolean, root:string|null}}
 */
function composeInstructions({ prefs, cwd, fileText = "", filePath = null }) {
  const value = normalizeInstructions(prefs);
  const empty = { text: "", parts: [], chars: 0, truncated: false, root: null };
  if (!value.enabled) return empty;
  const parts = [], blocks = [];
  const global = clean(value.global);
  if (global) { blocks.push(`# Custom instructions\n${global}`); parts.push({ source: "global", chars: global.length }); }
  const entry = projectInstructionsFor(value, cwd);
  const file = entry?.useFile === false ? "" : clean(fileText);
  const override = clean(entry?.text);
  const root = entry?.root ?? (filePath ? path.dirname(path.dirname(filePath)) : null) ?? (typeof cwd === "string" ? cwd : null);
  if (file || override) {
    const body = [file, override].filter(Boolean).join("\n\n");
    blocks.push(`# Project instructions (${root})\n${body}`);
    if (file) parts.push({ source: "projectFile", path: filePath, chars: file.length });
    if (override) parts.push({ source: "projectOverride", path: entry.root, chars: override.length });
  }
  let text = blocks.join("\n\n"), truncated = false;
  if (text.length > TOTAL_CAP) { text = `${text.slice(0, TOTAL_CAP - TRUNCATED.length - 1)}\n${TRUNCATED}`; truncated = true; }
  return { text, parts, chars: text.length, truncated, root: file || override ? root : null };
}

/** Reads fresh from disk and composes for cwd. */
function composeFor(prefs, cwd, { home, fs: fsys = fs } = {}) {
  const value = normalizeInstructions(prefs);
  const entry = projectInstructionsFor(value, cwd);
  const filePath = findProjectFile(cwd, { home, fs: fsys });
  const file = readProjectFile(entry?.useFile === false ? null : filePath, fsys);
  return { ...composeInstructions({ prefs: value, cwd, fileText: file.text, filePath }), filePath, entry };
}

/**
 * Mutates params for the core request. engine is serverInfo.engine;
 * read(cwd) returns the composition for cwd.
 */
function decorateCoreParams(method, params, { engine, cwd, read }) {
  if (!params || typeof params !== "object") return params;
  if (engine === "deepseek-harness") {
    if (!DEEPSEEK_METHODS.has(method)) return params;
    const { text } = read(cwd);
    const codeDesktop = params.codeDesktop && typeof params.codeDesktop === "object" ? params.codeDesktop : {};
    params.codeDesktop = { ...codeDesktop, customization: { ...codeDesktop.customization, instructions: text || null } };
    return params;
  }
  if (!CODEX_METHODS.has(method)) return params;
  const { text } = read(cwd);
  if (!text) return params;
  params.developerInstructions = [typeof params.developerInstructions === "string" ? params.developerInstructions : "", text].filter(Boolean).join("\n\n");
  return params;
}

function projectFileTarget(prefs, cwd, options) {
  const found = findProjectFile(cwd, options);
  if (found) return found;
  const entry = projectInstructionsFor(normalizeInstructions(prefs), cwd);
  return path.join(entry?.root ?? cwd, PROJECT_FILE);
}

function createInstructionsService({ getConfig, getClient, shell, knownCwd, home = os.homedir(), fs: fsys = fs }) {
  const prefs = () => getConfig()?.customInstructions;
  const sessionCwd = (params) => {
    const config = getConfig() || {};
    if (typeof params?.cwd === "string" && params.cwd) return params.cwd;
    const meta = typeof params?.threadId === "string" ? config.threadMetadata?.[params.threadId] : undefined;
    return typeof meta?.cwd === "string" && meta.cwd ? meta.cwd : config.cwd;
  };
  const preview = (cwd) => {
    const result = composeFor(prefs(), cwd, { home, fs: fsys });
    const target = projectFileTarget(prefs(), cwd, { home, fs: fsys });
    const file = readProjectFile(target, fsys);
    const engine = getClient()?.serverInfo?.engine === "deepseek-harness" ? "deepseek" : "codex";
    return { text: result.text, parts: result.parts, chars: result.chars, truncated: result.truncated, root: result.root, cwd, engine,
      project: result.entry ? { root: result.entry.root, text: result.entry.text, useFile: result.entry.useFile } : null,
      file: { path: target, exists: file.exists, bytes: file.bytes } };
  };
  async function run(p = {}) {
    const cwd = knownCwd(p.cwd);
    switch (p.op) {
      case "preview": return preview(cwd);
      case "create-file": {
        const target = projectFileTarget(prefs(), cwd, { home, fs: fsys });
        fsys.mkdirSync(path.dirname(target), { recursive: true });
        try { fsys.writeFileSync(target, TEMPLATE, { flag: "wx" }); } catch (error) { if (error?.code !== "EEXIST") throw error; }
        const error = await shell.openPath(target);
        if (error) throw new Error(error);
        return preview(cwd);
      }
      case "open-file": {
        const target = projectFileTarget(prefs(), cwd, { home, fs: fsys });
        if (!readProjectFile(target, fsys).exists) throw new Error("The instructions file doesn’t exist yet.");
        const error = await shell.openPath(target);
        if (error) throw new Error(error);
        return true;
      }
      case "reveal-file": {
        const target = projectFileTarget(prefs(), cwd, { home, fs: fsys });
        if (!readProjectFile(target, fsys).exists) throw new Error("The instructions file doesn’t exist yet.");
        shell.showItemInFolder(target);
        return true;
      }
      default: throw new Error("Unsupported instructions operation.");
    }
  }
  function decorate(method, params) {
    try {
      return decorateCoreParams(method, params, { engine: getClient()?.serverInfo?.engine, cwd: sessionCwd(params),
        read: (cwd) => composeFor(prefs(), cwd, { home, fs: fsys }) });
    } catch (error) {
      // Instructions never block a message; the session runs without them.
      console.warn("Custom instructions were not attached:", error);
      return params;
    }
  }
  return { run, decorate };
}

module.exports = { createInstructionsService, findProjectFile, composeInstructions, composeFor, decorateCoreParams, readProjectFile, PROJECT_FILE, TOTAL_CAP };
