// Queued / steered messages (2.2553.1 cc43287c9 :28296-28345, :28980-29000;
// cf74bc599 :3889-4240) over the real Codex 0.155.1 app-server queue:
// thread/queue/add|list|update|delete|reorder|start, thread/queue/changed and
// turn/steer. Lanes: Enter while a turn runs = "next" (turn/steer),
// Cmd+Enter = "later" (thread/queue/add). Entries are QueuedSubmission
// {id,input,clientUserMessageId}; the bar only renders what the server lists.
export const QUEUE_LANES = Object.freeze({ next: "steer", later: "queued" });

export function emptyQueue(threadId = null) {
  return { threadId, entries: [], lockedIds: [], revision: 0 };
}

// Official wG: an explicit "later" (or stayOnDraft) forces the queue; without
// a running turn everything is a plain send. Enter while running steers.
export function submitLane({ running, priority, stayOnDraft = false }) {
  if (!running) return "send";
  if (priority === "later" || stayOnDraft) return "later";
  return priority === "next" || priority === undefined ? "next" : "later";
}

// thread/queue/list → {data:[QueuedSubmission], nextCursor}. Any other shape is
// treated as empty rather than invented.
export function queueFromList(response, threadId = null, previous = emptyQueue(threadId)) {
  const data = Array.isArray(response?.data) ? response.data : Array.isArray(response?.entries) ? response.entries : [];
  const entries = data
    .filter((entry) => entry && typeof entry.id === "string" && Array.isArray(entry.input))
    .map((entry) => ({ id: entry.id, input: entry.input, clientUserMessageId: entry.clientUserMessageId ?? null, preview: previewText(entry.input) }));
  const ids = new Set(entries.map((entry) => entry.id));
  return { threadId, entries, lockedIds: previous.lockedIds.filter((id) => ids.has(id)), revision: previous.revision + 1 };
}

// Official ep: text parts joined by a space, images become "[Image]", empty → "…".
export function previewText(input = []) {
  const parts = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    if (item.type === "text" && typeof item.text === "string") parts.push(item.text);
    else if (item.type === "mention" || item.type === "skill") parts.push(`@${item.name ?? item.path ?? ""}`);
    else if (item.type === "image" || item.type === "localImage") parts.push("[Image]");
  }
  return parts.join(" ").replace(/\s+/g, " ").trim() || "…";
}

export function queuedCountLabel(count) {
  return `${count} ${count === 1 ? "message queued" : "messages queued"}`;
}

export function lockEntry(queue, id) {
  if (!queue.entries.some((entry) => entry.id === id) || queue.lockedIds.includes(id)) return queue;
  return { ...queue, lockedIds: [...queue.lockedIds, id] };
}

export function unlockEntry(queue, id) {
  return queue.lockedIds.includes(id) ? { ...queue, lockedIds: queue.lockedIds.filter((entry) => entry !== id) } : queue;
}

// Optimistic removal with a rollback that restores the entry at its index.
export function optimisticRemove(queue, id) {
  const index = queue.entries.findIndex((entry) => entry.id === id);
  if (index < 0) return { queue, rollback: () => queue };
  const entry = queue.entries[index];
  const next = { ...queue, entries: queue.entries.filter((item) => item.id !== id), lockedIds: queue.lockedIds.filter((item) => item !== id), revision: queue.revision + 1 };
  return {
    queue: next,
    rollback: (current = next) => {
      if (current.entries.some((item) => item.id === id)) return current;
      const entries = current.entries.slice();
      entries.splice(Math.min(index, entries.length), 0, entry);
      return { ...current, entries, revision: current.revision + 1 };
    },
  };
}

// Move `fromId` to the slot of `toId` (dnd-kit arrayMove semantics).
export function reorderEntries(entries, fromId, toId) {
  const from = entries.findIndex((entry) => entry.id === fromId);
  const to = entries.findIndex((entry) => entry.id === toId);
  if (from < 0 || to < 0 || from === to) return entries;
  const next = entries.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function optimisticReorder(queue, fromId, toId) {
  const entries = reorderEntries(queue.entries, fromId, toId);
  if (entries === queue.entries) return { queue, rollback: () => queue, ids: queue.entries.map((entry) => entry.id) };
  const next = { ...queue, entries, revision: queue.revision + 1 };
  return { queue: next, rollback: (current = next) => ({ ...current, entries: queue.entries, revision: current.revision + 1 }), ids: entries.map((entry) => entry.id) };
}

// ↑ in an empty editor takes back the newest entry that can still be cancelled (cc43287c9-BMbiZYzF.js
// :31152-31156 _o: findLast of the non-seeded deferred/queued entries); locked (in-flight) entries are
// skipped. null when nothing can be dequeued, so ↑ falls through to prompt history.
export function lastDequeueable(queue) {
  const entries = Array.isArray(queue?.entries) ? queue.entries : [];
  const locked = new Set(queue?.lockedIds || []);
  for (let index = entries.length - 1; index >= 0; index--) if (!locked.has(entries[index].id)) return entries[index];
  return null;
}

// Text restored into the composer for "Edit in composer": the joined text
// parts, plus the file/image items that the composer can re-stage. A skill
// item comes back as its leading '/name' (the skill chip's text form, which
// the next submit turns into the skill item again).
export function editableDraft(entry) {
  const input = entry?.input || [];
  const skill = input.find((item) => item?.type === "skill" && typeof item.name === "string" && item.name);
  const body = input.filter((item) => item?.type === "text").map((item) => item.text).join("\n");
  const text = skill ? `/${skill.name}${body ? ` ${body}` : " "}` : body;
  const attachments = input.filter((item) => item?.type === "localImage" || item?.type === "mention");
  return { text, attachments };
}

// turn/steer failure that must fall back to the queue: Codex reports
// activeTurnNotSteerable for review/compact turns (CodexErrorInfo).
export function isNotSteerable(error) {
  const data = error?.data ?? error?.codexErrorInfo;
  const text = `${error?.message || ""} ${data ? JSON.stringify(data) : ""}`;
  return /activeTurnNotSteerable|not steerable/i.test(text);
}
