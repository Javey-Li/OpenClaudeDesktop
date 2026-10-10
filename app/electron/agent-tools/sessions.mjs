// Claude Desktop's ccd_session_mgmt tools that only read the app's sessions, or name the calling one (2.2553.1
// index.chunk-uZRTWaFR.js): list_sessions, get_session and set_session_title. Archiving, deleting, stopping and
// messaging another session stay with the user. Every core gets them: none has the app's session list.
// ctx.sessions: { list() → [{id, title, folder, archived, updatedAt, running}], get(id) → that | null, rename(title) }
//               (main.cjs; rename acts on the calling session only)
export const group = "sessions";
export const MAX_TITLE = 120;

const when = (seconds) => (Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null);
const shape = (session, self) => ({
  session_id: session.id,
  title: session.title || "(untitled)",
  ...(session.folder ? { folder: session.folder } : {}),
  status: session.archived ? "archived" : session.running ? "running" : "idle",
  ...(when(session.updatedAt) ? { updated_at: when(session.updatedAt) } : {}),
  ...(session.id === self ? { current: true } : {}),
});
function service(ctx) {
  if (!ctx?.sessions || typeof ctx.sessions.list !== "function") throw new Error("The session list isn’t available here.");
  return ctx.sessions;
}

export const tools = [
  {
    name: "list_sessions",
    title: "List sessions",
    description: "List the user's Code Desktop sessions, most recently active first: session_id, title, working folder, and whether each is running, idle or archived (yours is marked current). Read-only. Use it to find a related session the user mentions; never act on another session without the user asking.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Only sessions whose title or folder contains this text (case-insensitive)." },
        include_archived: { type: "boolean", description: "Include archived sessions. Default false." },
        limit: { type: "integer", minimum: 1, maximum: 100, description: "At most this many (default 25)." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    handler: async (args = {}, ctx) => {
      const query = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";
      const limit = Number.isInteger(args.limit) ? Math.min(100, Math.max(1, args.limit)) : 25;
      const list = service(ctx).list()
        .filter((session) => args.include_archived === true || !session.archived)
        .filter((session) => !query || `${session.title ?? ""} ${session.folder ?? ""}`.toLowerCase().includes(query))
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      if (!list.length) return query ? `No sessions match “${args.query}”.` : "No sessions.";
      const shown = list.slice(0, limit).map((session) => shape(session, ctx.sessionId));
      return JSON.stringify({ sessions: shown, ...(list.length > limit ? { more: list.length - limit } : {}) }, null, 2);
    },
  },
  {
    name: "get_session",
    title: "Get session",
    description: "Read one Code Desktop session's details by its session_id (from list_sessions): title, working folder, status and when it was last active. Read-only; without session_id, this session.",
    inputSchema: {
      type: "object",
      properties: { session_id: { type: "string", description: "The session to read. Default: this session." } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    handler: async (args = {}, ctx) => {
      const id = typeof args.session_id === "string" && args.session_id.trim() ? args.session_id.trim() : ctx.sessionId;
      const session = service(ctx).get(id);
      if (!session) throw new Error(`No session ${id}.`);
      return JSON.stringify(shape(session, ctx.sessionId), null, 2);
    },
  },
  {
    name: "set_session_title",
    mainOnly: true, // a sub-agent's call is refused (agent-tools-host.cjs)
    title: "Rename session",
    description: "Set this session's title, as it shows in the sidebar and the window title. Use a short, specific title (a few words) when the conversation's topic is clear and the current title doesn't describe it; don't rename a session the user named themselves unless they ask.",
    inputSchema: {
      type: "object",
      properties: { title: { type: "string", description: `The new title (at most ${MAX_TITLE} characters).` } },
      required: ["title"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async (args = {}, ctx) => {
      const title = typeof args.title === "string" ? args.title.replace(/\s+/g, " ").trim() : "";
      if (!title) throw new Error("title is required.");
      if (title.length > MAX_TITLE) throw new Error(`Keep the title under ${MAX_TITLE} characters.`);
      await service(ctx).rename(title);
      return `Session renamed to “${title}”.`;
    },
  },
];
