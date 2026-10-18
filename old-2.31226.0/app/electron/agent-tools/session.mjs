// Claude Desktop's ccd_session tools for this session's transcript (2.2553.1 index.chunk-uZRTWaFR.js): mark_chapter
// (a chapter heading in the transcript, listed in the chapter menu) and spawn_task / dismiss_task (a "Suggested task"
// card the user can start as a new session, or dismiss). None of them does anything outside the transcript: a
// suggested task starts only when the user clicks Start. The renderer reads them back from the tool items
// (src/agent-tool-titles.mjs chapterOf / suggestedTasks).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const group = "session";
export const MAX_CHAPTER_TITLE = 40;
export const MAX_SUGGESTIONS = 20;
const suggested = new Map(); // session id → Set of task ids it suggested (still open)

/** Forget the suggestions (tests). */
export function resetSuggestions() { suggested.clear(); }

const oneLine = (value, max) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");

export const tools = [
  {
    name: "mark_chapter",
    mainOnly: true, // a sub-agent's call is refused (agent-tools-host.cjs)
    title: "Mark chapter",
    description: "Mark the start of a new chapter in this session: the user sees a heading in the transcript and can jump between chapters. Call it when the work shifts to a meaningfully different phase (exploration done and implementation starting, a fix landed and verification begins, the user changed topic). Use it sparingly: a chapter covers a coherent stretch of work, typically 3-8 per session, and not the very first message. The title is a short noun phrase under 40 characters (\"Auth bug fix\", \"Test verification\").",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: `Short noun-phrase title (under ${MAX_CHAPTER_TITLE} characters).` },
        summary: { type: "string", description: "Optional one-line summary of what the chapter covers." },
      },
      required: ["title"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    handler: async (args = {}) => {
      const title = oneLine(args.title, 200);
      if (!title) throw new Error("title is required.");
      if (title.length > MAX_CHAPTER_TITLE) throw new Error(`Keep the chapter title under ${MAX_CHAPTER_TITLE} characters.`);
      return `Chapter “${title}” marked.`;
    },
  },
  {
    name: "spawn_task",
    title: "Suggest a task",
    description: "Suggest a separate task for later: the user sees a \"Suggested task\" card they can start as a new session with one click, or dismiss. Use it for something worth doing that is out of scope for the current change — dead code, stale docs, missing tests, a confirmed TODO, a security issue noticed in passing — not for vague code smells or trivial fixes you can make now. Nothing runs until the user starts it. The prompt must stand alone: the new session won't see this conversation, so include file paths and enough context to act. Returns the task_id (dismiss_task withdraws it).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Imperative action phrase under 60 characters, e.g. \"Remove dead config option\"." },
        tldr: { type: "string", description: "One or two plain sentences for the card: why you suggest it now, then what the new session will do. No file paths." },
        prompt: { type: "string", description: "The new session's first message: self-contained, with paths and context." },
        cwd: { type: "string", description: "Optional absolute path of another project folder to start it in. Default: this session's folder." },
      },
      required: ["title", "tldr", "prompt"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    handler: async (args = {}, ctx) => {
      const title = oneLine(args.title, 200), tldr = oneLine(args.tldr, 600);
      const prompt = typeof args.prompt === "string" ? args.prompt.trim() : "";
      if (!title) throw new Error("title is required.");
      if (title.length > 60) throw new Error("Keep the title under 60 characters.");
      if (!tldr) throw new Error("tldr is required.");
      if (!prompt) throw new Error("prompt is required.");
      if (prompt.length > 20000) throw new Error("The prompt is too long (20,000 characters at most).");
      if (args.cwd !== undefined && args.cwd !== null && args.cwd !== "") {
        if (typeof args.cwd !== "string" || !path.isAbsolute(args.cwd) || args.cwd.includes("\0")) throw new Error("cwd must be an absolute folder path.");
        let directory = false;
        try { directory = fs.statSync(args.cwd).isDirectory(); } catch { directory = false; }
        if (!directory) throw new Error(`The folder ${args.cwd} doesn’t exist.`);
      }
      const open = suggested.get(ctx?.sessionId) ?? new Set();
      if (open.size >= MAX_SUGGESTIONS) throw new Error(`This session already suggested ${MAX_SUGGESTIONS} tasks. Dismiss some with dismiss_task first.`);
      const id = `task_${crypto.randomBytes(4).toString("hex")}`;
      open.add(id);
      suggested.set(ctx?.sessionId, open);
      return `Suggested task shown to the user; it starts only if they click Start. task_id: ${id}`;
    },
  },
  {
    name: "dismiss_task",
    title: "Dismiss suggested task",
    description: "Withdraw a task you suggested with spawn_task in this session, e.g. because it was fixed here after all or a better-scoped suggestion replaces it. Only works for suggestions the user hasn't started.",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string", description: "The task_id spawn_task returned." } },
      required: ["task_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    handler: async (args = {}, ctx) => {
      const id = typeof args.task_id === "string" ? args.task_id.trim() : "";
      if (!/^task_[0-9a-f]{8}$/.test(id)) throw new Error("task_id must be one spawn_task returned (task_ followed by 8 hex digits).");
      const open = suggested.get(ctx?.sessionId);
      // A suggestion from before the app restarted isn't in memory any more: the transcript still withdraws it.
      open?.delete(id);
      return `Suggested task ${id} withdrawn.`;
    },
  },
];
