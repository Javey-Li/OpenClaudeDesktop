import { connectionInterrupted } from "./item-observation.mjs";
import { observeAgentEvent } from "./agent-model.mjs";
import { beginTurnStats, updateTurnUsage } from './transcript-runtime-stats.mjs';
import { emptyApprovalTransport, reduceApprovalTransport } from "./approval-state.js";
import { normalizeTurnError } from "./turn-error-model.mjs";
export const emptyState = {
  ...emptyApprovalTransport,
  items: {},
  active: {},
  activeVersions: {},
  plans: {},
  // threadId -> the latest proposed plan document: the text of the newest
  // ThreadItem {type:'plan', text} (item/completed or history), shown by the
  // Plan pane (panes-tile-current.js kp/Dp). The DeepSeek bridge projects
  // exit_plan_mode as this item (codex-app-server projection.js).
  planDocs: {},
  diffs: {},
  approvals: [],
  usage: {},
  turnStats: {},
  // TurnErrors Codex reported without a turn identity; the transcript-tail card.
  errors: {},
  // threadId -> turnId -> TurnError {message, codexErrorInfo, additionalDetails}
  // from turn/completed status failed, error willRetry:false and history.
  // Kept per turn: a later turn/started never clears an earlier failure.
  turnErrors: {},
  // threadId -> {turnId, message, codexErrorInfo} while Codex retries
  // (ErrorNotification willRetry:true); local observation only.
  retrying: {},
  operations: {},
  background: {},backgroundReads: {},backgroundStarts: {},taskTurnFacts: {},
  // threadId -> turnId -> {startedAt, completedAt}: Codex Turn Unix seconds or
  // null (ts/v2/Turn.ts) from turn/started, turn/completed and history. Drives
  // the OY message-row timestamps; unlike taskTurnFacts it keeps every turn.
  turnTimes: {},
  // Local observations of item lifecycle; never serialized into Codex requests.
  itemPhases: {},
  // 0.155.1 connection-wide notices: deprecationNotice {summary, details} and
  // warning without a threadId (ServerNotification.ts:90).
  notices: [],
  // warning {threadId, message} scoped to one thread.
  warnings: {},
  // thread/started {thread}: identity of every thread this connection was
  // attached to, including AgentControl-spawned sub-agents.
  threads: {},
  // childThreadId -> parentThreadId (Thread.parentThreadId).
  threadParents: {},
  // parentThreadId -> [childThreadId]; a sub-agent thread is never a session.
  childThreads: {},
  // thread/status/changed {threadId, status} (ThreadStatus).
  threadStatus: {},
  agentLifecycle: {},
};
// A repeated notice carries no new information and the official surface is a
// single non-modal line, so identical entries collapse; the cap only stops an
// unbounded server from growing the array without bound.
const NOTICE_LIMIT = 50;
function appendNotice(list, entry) {
  if ((list || []).some((item) => item.kind === entry.kind && item.summary === entry.summary && item.details === entry.details)) return list;
  return [...list, entry].slice(-NOTICE_LIMIT);
}
// Delta-only items can arrive before the resume response or item/started.
// Symbols stay local to reducer objects and are never sent to Codex or persisted.
const deltaOnlyFields = Symbol("deltaOnlyFields");
const streamFields = ["text", "aggregatedOutput", "reasoningText"];
const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function mergeLiveItem(snapshot, current, baseline) {
  const merged = { ...snapshot, ...current };
  for (const field of streamFields) {
    const live = current[field], saved = snapshot[field];
    if (typeof live !== "string" || typeof saved !== "string") continue;
    const previous = baseline?.[field];
    if (live === previous) {
      // Another field changed while this text still belongs to the baseline.
      merged[field] = saved;
    } else if (current[deltaOnlyFields]?.includes(field)) {
      // With no known base, never guess that an unrelated snapshot precedes the
      // fragment. Accept its complete text only when it already contains ours.
      merged[field] = saved.includes(live) ? saved : live;
    } else if (saved.startsWith(live)) {
      // The snapshot already includes these deltas, possibly with a newer tail.
      merged[field] = saved;
    } else {
      // Current extends an older snapshot, or order is unknown: preserve live.
      // Do not concatenate; that can duplicate deltas contained in the snapshot.
      merged[field] = live;
    }
  }
  return merged;
}

const turnSeconds = (value) => typeof value === "number" && Number.isFinite(value) ? value : null;
// One entry per turn; a missing field never erases a value already observed.
function recordTurnTimes(bucket, turns) {
  let next = bucket;
  for (const turn of turns) {
    if (!turn?.id) continue;
    const old = bucket?.[turn.id];
    const entry = { startedAt: turnSeconds(turn.startedAt) ?? old?.startedAt ?? null, completedAt: turnSeconds(turn.completedAt) ?? old?.completedAt ?? null };
    if (old && old.startedAt === entry.startedAt && old.completedAt === entry.completedAt) continue;
    if (next === bucket) next = { ...bucket };
    next[turn.id] = entry;
  }
  return next;
}
function withTurnTimes(state, id, turns) {
  const bucket = state.turnTimes?.[id], next = recordTurnTimes(bucket, turns);
  return next === bucket ? state : { ...state, turnTimes: { ...state.turnTimes, [id]: next } };
}

function hydrate(state, action) {
  state = startThread(state, {...action.thread, id:action.id});
  // Turn.startedAt/completedAt from thread/read, resume initialTurnsPage and
  // thread/turns/list; live entries for turns absent from this page are kept.
  state = withTurnTimes(state, action.id, action.thread.turns || []);
  const snapshot = (action.thread.turns || []).flatMap((turn) =>
    (turn.items || []).map((item) => ({ ...item, ...(item.type === "contextCompaction" ? {status:turn.status} : {}), turnId: turn.id })),
  );
  const snapshotActive = (action.thread.turns || []).find(
    (turn) => turn.status === "inProgress",
  )?.id || null;
  const hasBaseline = owns(action, "baselineItems");
  let items = snapshot;
  if (hasBaseline) {
    const baseline = new Map((action.baselineItems || []).map((item) => [item.id, item]));
    const current = new Map((state.items[action.id] || []).map((item) => [item.id, item]));
    const seen = new Set();
    items = snapshot.map((item) => {
      seen.add(item.id);
      const live = current.get(item.id);
      return live && live !== baseline.get(item.id)
        ? mergeLiveItem(item, live, baseline.get(item.id))
        : item;
    });
    // A stream can introduce items absent from the in-flight snapshot. Preserve
    // known history too: a partial snapshot cannot justify deleting local rows.
    for (const item of current.values()) if (!seen.has(item.id) && (!action.replaceHistory || !baseline.has(item.id) || item !== baseline.get(item.id))) items.push(item);
  }
  const activeChanged = owns(action, "baselineActiveVersion")
    ? (state.activeVersions?.[action.id] || 0) !== (action.baselineActiveVersion || 0)
    : owns(action, "baselineActive") && state.active[action.id] !== action.baselineActive;
  // Turn.status "failed" + Turn.error (ts/v2/Turn.ts) from thread/read,
  // thread/resume or thread/turns/list: the failure survives a relaunch.
  // Live entries for turns absent from this page are kept.
  const historyErrors = Object.fromEntries((action.thread.turns || [])
    // A completed turn keeps an error too: the bridge's output-limit stop (R08).
    .filter((turn) => turn?.id && (turn.status === "failed" || turn.status === "completed") && turn.error)
    .map((turn) => [turn.id, normalizeTurnError(turn.error)]));
  const turnErrors = Object.keys(historyErrors).length
    ? { ...state.turnErrors, [action.id]: { ...state.turnErrors?.[action.id], ...historyErrors } } : state.turnErrors;
  return {
    ...state,
    turnErrors,
    turnStats: activeChanged || !snapshotActive ? state.turnStats : { ...state.turnStats,
      [action.id]: beginTurnStats(state.turnStats?.[action.id], action.thread.turns.find(turn => turn.id === snapshotActive), false) },
    agentLifecycle: activeChanged || !(action.thread.turns || []).length ? state.agentLifecycle : observeAgentEvent(state.agentLifecycle, {
      method:snapshotActive ? "turn/started" : "turn/completed", params:{threadId:action.id,turn:snapshotActive ? action.thread.turns.find(turn=>turn.id===snapshotActive) : action.thread.turns.at(-1)}
    }, {}),
    items: { ...state.items, [action.id]: items },
    planDocs: withPlanDocument(state.planDocs, action.id, items.findLast((item) => item?.type === "plan" && typeof item.text === "string" && item.text)),
    active: { ...state.active, [action.id]: activeChanged ? state.active[action.id] : snapshotActive },
  };
}
// planDocs: a history replay or a completed plan item sets the thread's
// document; a history without one keeps the document already observed.
function withPlanDocument(planDocs = {}, id, item) {
  if (!item || planDocs[id] === item.text) return planDocs;
  return { ...planDocs, [id]: item.text };
}

function settleObservedItem(item, status) {
  const next = { ...item, status };
  delete next[connectionInterrupted];
  return next;
}

function nextActiveVersion(state, id) {
  return { ...state.activeVersions, [id]: (state.activeVersions?.[id] || 0) + 1 };
}

export function isItemStreaming(state, threadId, item) {
  if (!item || !["agentMessage", "reasoning", "plan", "contextCompaction"].includes(item.type)) return false;
  const active = state.active[threadId];
  if (["completed", "failed", "interrupted", "stopped", "cancelled", "canceled"].includes(item.status)) return false;
  const phase = state.itemPhases?.[threadId]?.[item.id];
  // A real delta may arrive before the initial thread/resume response. An
  // absent active entry is unknown, whereas an explicit null is known idle.
  if (!active) return !owns(state.active, threadId) && phase === "streaming";
  const review = state.operations?.[threadId];
  const activeReviewItem = review?.operation === "review" && ["starting", "running", "unknown"].includes(review.phase)
    && review.turnId === item.turnId;
  if (item.turnId !== active && !activeReviewItem) return false;
  if (phase) return phase === "streaming";
  if (["inProgress", "running"].includes(item.status)) return true;
  // A resumed active turn does not report agentMessage lifecycle status. Its
  // final item may still grow; earlier items have already yielded to successors.
  const items = state.items[threadId] || [];
  for (let index = items.length - 1; index >= 0; index--)
    if (items[index].turnId === active) return items[index].id === item.id;
  return false;
}

function observeItemPhase(state, threadId, itemId, phase) {
  return {
    ...state.itemPhases,
    [threadId]: { ...state.itemPhases?.[threadId], [itemId]: phase },
  };
}

// Updates the named item. Without a `create` an unknown item is left alone:
// no notification may invent a transcript row Codex has not reported.
function upsertItem(items, itemId, update, create) {
  if (!itemId) return items;
  const at = items.findIndex((item) => item.id === itemId);
  if (at < 0 && !create) return items;
  const next = items.slice();
  if (at < 0) next.push(create());
  else next[at] = update(next[at]);
  return next;
}

// thread/started {thread}. The stdio server attaches every initialized
// connection to each new thread, including AgentControl-spawned sub-agents
// (lib.rs:1252-1266 -> thread_processor.rs:3609-3640 try_attach_thread_listener),
// so a child thread's turn/* and item/* arrive here keyed by the CHILD id.
// The parent link is what lets those buckets belong to the parent session;
// the child is never a session of its own (official thread/list also omits
// sub-agent sources unless asked, filters.rs:121-150).
function startThread(state, thread) {
  if (!thread?.id) return state;
  const spawn = thread.source?.subAgent?.thread_spawn;
  const parent = thread.parentThreadId || spawn?.parent_thread_id || null;
  const record = {
    id: thread.id,
    parentThreadId: parent,
    source: thread.source ?? null,
    cwd: thread.cwd ?? null,
    agentNickname: thread.agentNickname ?? spawn?.agent_nickname ?? null,
    agentRole: thread.agentRole ?? spawn?.agent_role ?? null,
    model: thread.model ?? null,
    historyMode: thread.historyMode ?? null,
    canAcceptDirectInput: thread.canAcceptDirectInput ?? null,
    status: thread.status ?? null,
  };
  const next = { ...state, threads: { ...state.threads, [thread.id]: { ...state.threads[thread.id], ...record } } };
  if (thread.status) next.threadStatus = { ...state.threadStatus, [thread.id]: thread.status };
  if (!parent) return next;
  const siblings = state.childThreads[parent] || [];
  next.threadParents = { ...state.threadParents, [thread.id]: parent };
  next.childThreads = { ...state.childThreads, [parent]: siblings.includes(thread.id) ? siblings : [...siblings, thread.id] };
  return next;
}

// A Thread the app-server classifies as a sub-agent. Thread.parentThreadId is
// only set for AgentControl thread_spawn (ts/v2/Thread.ts), whereas the
// app-server's own sidebar classification keys on Thread.source
// (SessionSource = ... | {subAgent: SubAgentSource}, filters.rs:121-150):
// a "review" or "compact" sub-agent has source {subAgent:...} and
// parentThreadId null. work/protocol-0155-audit/probe.json threadListSub shows
// three such review threads on this machine, so a parentThreadId-only guard
// would let them become sidebar sessions.
export function isSubAgentThread(thread) {
  const source = thread?.source;
  if (source && typeof source === "object" && !Array.isArray(source) && owns(source, "subAgent")) return true;
  return typeof thread?.parentThreadId === "string" && !!thread.parentThreadId;
}

// The session that owns a bucket: a sub-agent can itself spawn sub-agents
// (SubAgentSource depth), so the parent chain is followed to its root.
export function ownerThreadId(state, threadId) {
  const seen = new Set();
  let id = threadId;
  while (id && state.threadParents?.[id] && !seen.has(id)) {
    seen.add(id);
    id = state.threadParents[id];
  }
  return id;
}

export function isChildThread(state, threadId) {
  return !!state.threadParents?.[threadId];
}

// Is a serverRequest waiting on this SESSION, including one raised by a
// sub-agent running for it? A sub-agent thread is never a sidebar row and
// never navigable, so its approval has to be attributed to the session that
// owns it or it can be neither answered nor flagged.
export function hasPendingApproval(state, threadId) {
  if (!threadId) return false;
  return (state.approvals || []).some(
    (approval) => approval.params?.threadId && ownerThreadId(state, approval.params.threadId) === threadId,
  );
}

// Every descendant bucket of one session, nearest first.
export function childThreadIds(state, threadId) {
  const out = [], queue = [...(state.childThreads?.[threadId] || [])], seen = new Set();
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    queue.push(...(state.childThreads?.[id] || []));
  }
  return out;
}

function retainCompletedItemPhases(phases = {}) {
  return Object.fromEntries(Object.entries(phases).map(([threadId, items]) => [
    threadId,
    Object.fromEntries(Object.entries(items).filter(([, phase]) => phase === "completed")),
  ]));
}

export function reduce(state, action) {
  if (action.type === "dismiss-operation") return { ...state, operations:{...state.operations, [action.id]:null} };
  if(action.type==='backgroundReadStarted'){
    if(action.connectionId!==state.approvalConnectionId)return state;
    const processes=Object.fromEntries((state.items[action.id]||[]).filter(item=>item.type==='commandExecution'&&item.processId).map(item=>[item.id,item.processId]));
    return {...state,backgroundReads:{...state.backgroundReads,[action.id]:{requestId:action.requestId,connectionId:action.connectionId,processes}}};
  }
  if(action.type==='backgroundSnapshot'){
    if(action.connectionId!==state.approvalConnectionId)return state;
    const read=state.backgroundReads?.[action.id];
    if(action.requestId!==undefined&&(read?.requestId!==action.requestId||read.connectionId!==action.connectionId))return state;
    // Membership applies only to commands already observed when this request
    // began. A later item/started must not be negated by an older empty list.
    const coveredProcesses=action.requestId!==undefined?read.processes:Object.fromEntries((state.items[action.id]||[]).filter(item=>item.type==='commandExecution'&&item.processId).map(item=>[item.id,item.processId]));
    const backgroundReads={...state.backgroundReads};
    if(action.requestId!==undefined)delete backgroundReads[action.id];
    for(const thread of action.snapshot.children||[])state=startThread(state,thread);
    return {...state,backgroundReads,background:{...state.background,[action.id]:{connectionId:action.connectionId,coveredProcesses,terminals:action.snapshot.terminals,knownTerminals:{...(state.background?.[action.id]?.connectionId===action.connectionId?state.background[action.id].knownTerminals:{}),...Object.fromEntries((action.snapshot.terminals||[]).map(t=>[t.itemId,t]))},error:action.snapshot.errors?.join('\n')||null}}};
  }
  if (action.type === "hydrate") return hydrate(state, action);
  const e = action.event;
  if (!e) return state;
  if(['turn/started','turn/completed'].includes(e.method)&&e.params?.turn&&e.params.threadId){const turn=e.params.turn,id=e.params.threadId,old=state.taskTurnFacts?.[id];
    if(e.method==='turn/started'||!old||old.id===turn.id)state={...state,taskTurnFacts:{...state.taskTurnFacts,[id]:{id:turn.id,startedAt:turn.startedAt,completedAt:turn.completedAt,durationMs:turn.durationMs}}};
    state=withTurnTimes(state,id,[turn]);
  }
  const agentLifecycle = observeAgentEvent(state.agentLifecycle, e, state.active);
  if (agentLifecycle !== state.agentLifecycle) state = { ...state, agentLifecycle };
  if (e.kind === "session-operation") {
    if (e.connectionId !== state.approvalConnectionId || e.connectionEpoch !== state.approvalConnectionEpoch) return state;
    return {...state, operations:{...state.operations, [e.threadId]:e}};
  }
  const approvalUpdate = reduceApprovalTransport(state, e);
  if (approvalUpdate !== undefined) return approvalUpdate;
  if (e.kind === "connection" && !e.connected)
    return { ...state, turnStats:{}, retrying:{}, backgroundStarts:{}, backgroundReads:{}, agentLifecycle: Object.fromEntries(Object.entries(state.agentLifecycle || {}).map(([id, entry]) => [id, {...entry, status:"unknown", completedObservedAt:null}])), active: {}, itemPhases: retainCompletedItemPhases(state.itemPhases), activeVersions: Object.fromEntries([...new Set([...Object.keys(state.active), ...Object.keys(state.items), ...Object.keys(state.activeVersions || {})])].map(id => [id, (state.activeVersions?.[id] || 0) + 1])), items: Object.fromEntries(Object.entries(state.items).map(([id, list]) => [id, list.map(item => ["inProgress", "running"].includes(item.status) ? { ...item, status: "interrupted", [connectionInterrupted]: true } : item)])) };
  const p = e.params || {},
    id = p.threadId;
  // deprecationNotice carries no threadId and thread/started only carries the
  // Thread, so both are reduced before the per-thread guard below.
  if (e.method === "deprecationNotice") {
    if (typeof p.summary !== "string" || !p.summary) return state;
    const notices = appendNotice(state.notices, { kind: "deprecation", summary: p.summary, details: p.details ?? null });
    return notices === state.notices ? state : { ...state, notices };
  }
  if (e.method === "warning") {
    if (typeof p.message !== "string" || !p.message) return state;
    if (!id) {
      const notices = appendNotice(state.notices, { kind: "warning", summary: p.message, details: null });
      return notices === state.notices ? state : { ...state, notices };
    }
    const existing = state.warnings[id] || [];
    if (existing.includes(p.message)) return state;
    return { ...state, warnings: { ...state.warnings, [id]: [...existing, p.message].slice(-NOTICE_LIMIT) } };
  }
  if (e.method === "thread/started") return startThread(state, p.thread);
  if (!id) return state;
  const items = state.items[id] || [];
  // Codex retrying (ErrorNotification willRetry:true) ends as soon as the
  // stream shows progress again or the turn changes.
  if (state.retrying?.[id] && (e.method === "turn/started" || e.method === "turn/completed" || String(e.method).startsWith("item/")))
    state = { ...state, retrying: { ...state.retrying, [id]: null } };
  if (e.method === "thread/status/changed") {
    if (!p.status) return state;
    return { ...state, threadStatus: { ...state.threadStatus, [id]: p.status },
      threads: { ...state.threads, [id]: { ...state.threads[id], id, status: p.status } } };
  }
  // FileChangePatchUpdatedNotification {threadId, turnId, itemId, changes}:
  // the server replaces the whole change set, it is not a delta.
  //
  // Both this and the progress notification below UPDATE an item and never
  // create one. They can outrun item/started (the same race the delta branch
  // handles with deltaOnlyFields), and a synthesized row would carry no
  // lifecycle status, which source-session.jsx:100 outcome() reads as "done":
  // the transcript would show a settled "Edited / N files" step for a patch the
  // model is still revising, or a settled "Used Tool" step whose label is the
  // literal fallback string because a progress payload carries no server/tool.
  // Nothing is lost by waiting: item/started carries the authoritative
  // FileChangeItem (changes included), and progressMessage is state-only.
  if (e.method === "item/fileChange/patchUpdated") {
    if (!Array.isArray(p.changes) || !items.some((item) => item.id === p.itemId)) return state;
    return { ...state, items: { ...state.items, [id]: upsertItem(items, p.itemId,
      (item) => ({ ...item, changes: p.changes })) } };
  }
  // McpToolCallProgressNotification {threadId, turnId, itemId, message}: a
  // local observation of the running call, never serialized back to Codex.
  if (e.method === "item/mcpToolCall/progress") {
    if (typeof p.message !== "string" || !items.some((item) => item.id === p.itemId)) return state;
    return { ...state, items: { ...state.items, [id]: upsertItem(items, p.itemId,
      (item) => ({ ...item, progressMessage: p.message })) } };
  }
  if (e.method === "turn/started")
    return {
      ...state,
      turnStats: { ...state.turnStats, [id]: beginTurnStats(state.turnStats?.[id], p.turn) },
      active: { ...state.active, [id]: p.turn.id },
      activeVersions: nextActiveVersion(state, id),
      errors: { ...state.errors, [id]: null },
    };
  if (e.method === "turn/completed") {
    // Inline review has an observed nested active ID and an outer completion
    // ID (session-operations owns that association). Only that exact pair may
    // settle a different active ID; an unrelated old turn must still be ignored.
    const operation = state.operations?.[id];
    const associatedReview = operation?.operation === "review" && operation.turnId === p.turn.id && operation.activeTurnId === state.active[id];
    const newerTurn = state.active[id] && state.active[id] !== p.turn.id && !associatedReview;
    return {
      ...state,
      items: { ...state.items, [id]: items.map(item =>
        (["inProgress", "running"].includes(item.status) || item[connectionInterrupted]) && (!item.turnId || item.turnId === p.turn.id)
          ? settleObservedItem(item, p.turn.status === "interrupted" ? "interrupted" : p.turn.error ? "failed" : "completed")
          : item,
      ) },
      active: newerTurn ? state.active : { ...state.active, [id]: null },
      activeVersions: newerTurn ? state.activeVersions : nextActiveVersion(state, id),
      // A failed Turn keeps its TurnError on that turn (scroll-messages error
      // item); only an error without a turn identity stays thread-wide.
      turnErrors: p.turn.error && p.turn.id
        ? { ...state.turnErrors, [id]: { ...state.turnErrors?.[id], [p.turn.id]: normalizeTurnError(p.turn.error) } } : state.turnErrors,
      errors: newerTurn ? state.errors : { ...state.errors, [id]: p.turn.error && !p.turn.id ? normalizeTurnError(p.turn.error) : null },
    };
  }
  // ErrorNotification {error, willRetry, threadId, turnId}. willRetry:true is
  // classic Y5 apiRetry: the status row says "Retrying…", never an error card.
  // The DeepSeek bridge adds `retry {attempt, maxRetries}` ("Retrying (n/max)").
  if (e.method === "error") {
    if (p.willRetry === true) {
      const count = (value) => Number.isInteger(value) && value > 0 ? value : null;
      return { ...state, retrying: { ...state.retrying, [id]: { turnId: p.turnId || state.active[id] || null,
        message: p.error?.message || "", codexErrorInfo: p.error?.codexErrorInfo ?? null,
        attempt: count(p.retry?.attempt), maxRetries: count(p.retry?.maxRetries) } } };
    }
    const error = normalizeTurnError(p.error || {});
    if (p.turnId) return { ...state, retrying: { ...state.retrying, [id]: null },
      turnErrors: { ...state.turnErrors, [id]: { ...state.turnErrors?.[id], [p.turnId]: error } } };
    // A thread-wide failure keeps its TurnError shape for the transcript-tail card.
    return { ...state, retrying: { ...state.retrying, [id]: null }, errors: { ...state.errors, [id]: error } };
  }
  if (e.method === "turn/plan/updated")
    return { ...state, plans: { ...state.plans, [id]: p.plan } };
  if (e.method === "turn/diff/updated")
    return { ...state, diffs: { ...state.diffs, [id]: p.diff } };
  if (e.method === "thread/tokenUsage/updated")
    return { ...state, usage: { ...state.usage, [id]: p.tokenUsage },
      turnStats: { ...state.turnStats, [id]: updateTurnUsage(state.turnStats?.[id], p, state.active[id]) } };
  if (e.method === "item/started" || e.method === "item/completed") {
    const found = items.findIndex((i) => i.id === p.item.id);
    const next = items.slice();
    // ItemStartedNotification.startedAtMs / ItemCompletedNotification.completedAtMs
    // are lifecycle timestamps on the NOTIFICATION, not on ThreadItem. The
    // running Run-a-command footer counts from startedAtMs (official KE reads
    // the tool call's startedAt, approval-current.js:2909-2914), so it is kept
    // as a local observation and never sent back to Codex.
    // A thought ends at its first completion: the DeepSeek bridge closes it at
    // the block end and completes it again when the whole step commits, which
    // must not stretch "Thought for Ns". A restart (item/started) reopens it.
    const thought = p.item.type === "reasoning";
    const lifecycle = e.method === "item/started"
      ? (Number.isFinite(p.startedAtMs) ? { startedAtMs: p.startedAtMs } : {})
      : (Number.isFinite(p.completedAtMs) && !(thought && Number.isFinite(items[found]?.completedAtMs)) ? { completedAtMs: p.completedAtMs } : {});
    const item = { ...p.item, ...lifecycle, ...(p.item.type === "contextCompaction" ? {status:e.method === "item/started" ? "inProgress" : "completed"} : {}), turnId: p.turnId || state.active[id] || items[found]?.turnId };
    if (found < 0) next.push(item);
    else next[found] = { ...next[found], ...item };
    if (thought && e.method === "item/started") delete next[found < 0 ? next.length - 1 : found].completedAtMs;
    delete next[found < 0 ? next.length - 1 : found][connectionInterrupted];
    if (e.method === "item/completed") delete next[found < 0 ? next.length - 1 : found][deltaOnlyFields];
    let backgroundStarts=state.backgroundStarts;
    if(p.item.type==='commandExecution'){
      const starts={...state.backgroundStarts?.[id]};
      if(e.method==='item/started'&&p.item.processId)starts[p.item.id]={processId:p.item.processId,connectionId:state.approvalConnectionId};
      else delete starts[p.item.id];
      backgroundStarts={...state.backgroundStarts,[id]:starts};
    }
    return { ...state, items: { ...state.items, [id]: next },
      backgroundStarts,
      ...(e.method === "item/completed" && p.item.type === "plan" && typeof p.item.text === "string" && p.item.text
        ? { planDocs: withPlanDocument(state.planDocs, id, p.item) } : {}),
      itemPhases: observeItemPhase(state, id, p.item.id, e.method === "item/completed" ? "completed" : "streaming") };
  }
  const field =
    e.method === "item/agentMessage/delta"
      ? "text"
      : e.method === "item/commandExecution/outputDelta"
        ? "aggregatedOutput"
        : e.method === "item/reasoning/summaryTextDelta"
          ? "reasoningText"
          : null;
  if (field) {
    const next = items.slice();
    let at = next.findIndex((i) => i.id === p.itemId);
    if (at < 0) {
      at = next.length;
      next.push({
        id: p.itemId,
        [deltaOnlyFields]: [field],
        turnId: p.turnId || state.active[id],
        type:
          field === "text"
            ? "agentMessage"
            : field === "reasoningText"
              ? "reasoning"
              : "commandExecution",
      });
    }
    next[at] = { ...next[at], [field]: (next[at][field] || "") + p.delta };
    return { ...state, items: { ...state.items, [id]: next },
      itemPhases: observeItemPhase(state, id, p.itemId, state.itemPhases?.[id]?.[p.itemId] === "completed" ? "completed" : "streaming") };
  }
  return state;
}
// The latest turn of a thread failed and nothing newer runs: the sidebar's
// "Needs input" bucket keeps its pre-0.2.94 meaning for failed turns.
export function latestTurnError(state, threadId) {
  const errors = state?.turnErrors?.[threadId];
  if (!errors || state.active?.[threadId]) return null;
  const items = state.items?.[threadId] || [];
  for (let index = items.length - 1; index >= 0; index--)
    if (items[index]?.turnId) return errors[items[index].turnId] || null;
  return null;
}
export function userText(item) {
  return (item.content || []).map((c) => c.text || c.path || "").join("\n");
}
