import test from "node:test";
import assert from "node:assert/strict";
import { emptyState, reduce, ownerThreadId, isChildThread, childThreadIds, isSubAgentThread, hasPendingApproval } from "../src/state.js";

const event = (method, params) => ({ event: { method, params } });
const thread = (id, extra = {}) => ({ id, sessionId: id, parentThreadId: null, historyMode: "paginated", model: "gpt-6-astra", agentNickname: null, agentRole: null, status: { type: "idle" }, turns: [], ...extra });

test("deprecationNotice without a threadId becomes a connection notice and repeats collapse", () => {
  const summary = "Full-history hydration is deprecated for paginated threads; use `excludeTurns: true`, then page with `thread/turns/list` and `thread/items/list`.";
  let s = reduce(emptyState, event("deprecationNotice", { summary, details: null }));
  assert.deepEqual(s.notices, [{ kind: "deprecation", summary, details: null }]);
  const again = reduce(s, event("deprecationNotice", { summary, details: null }));
  assert.equal(again, s, "an identical notice does not produce a new state");
  s = reduce(s, event("deprecationNotice", { summary: "review/start with delivery \"detached\" is deprecated and will be removed in a future release.", details: "Use thread/start followed by review/start with delivery \"inline\"." }));
  assert.equal(s.notices.length, 2);
  assert.equal(s.notices[1].details, "Use thread/start followed by review/start with delivery \"inline\".");
  assert.equal(reduce(s, event("deprecationNotice", { details: "no summary" })), s, "a notice without a summary is ignored");
});

test("warning routes by threadId: scoped to a thread, otherwise connection-wide", () => {
  let s = reduce(emptyState, event("warning", { threadId: "a", message: "Thread warning." }));
  assert.deepEqual(s.warnings, { a: ["Thread warning."] });
  assert.deepEqual(s.notices, []);
  assert.equal(reduce(s, event("warning", { threadId: "a", message: "Thread warning." })), s, "duplicate thread warning collapses");
  s = reduce(s, event("warning", { threadId: "a", message: "Second warning." }));
  assert.deepEqual(s.warnings.a, ["Thread warning.", "Second warning."]);
  s = reduce(s, event("warning", { threadId: null, message: "Connection warning." }));
  assert.deepEqual(s.notices, [{ kind: "warning", summary: "Connection warning.", details: null }]);
  assert.deepEqual(s.warnings.a, ["Thread warning.", "Second warning."], "a connection warning never lands in a thread");
});

test("thread/started records sub-agent identity and the parent-child map", () => {
  let s = reduce(emptyState, event("thread/started", { thread: thread("parent") }));
  assert.deepEqual(s.threadParents, {});
  assert.equal(s.threads.parent.model, "gpt-6-astra");
  assert.equal(s.threads.parent.parentThreadId, null);
  s = reduce(s, event("thread/started", { thread: thread("child", { parentThreadId: "parent", agentNickname: "quiet-otter", agentRole: "explorer", model: "gpt-5.6-sol", canAcceptDirectInput: false }) }));
  assert.equal(s.threads.child.agentNickname, "quiet-otter");
  assert.equal(s.threads.child.agentRole, "explorer");
  assert.equal(s.threads.child.model, "gpt-5.6-sol");
  assert.equal(s.threads.child.canAcceptDirectInput, false);
  assert.deepEqual(s.threadParents, { child: "parent" });
  assert.deepEqual(s.childThreads, { parent: ["child"] });
  // A sub-agent can spawn its own sub-agent (SubAgentSource depth).
  s = reduce(s, event("thread/started", { thread: thread("grandchild", { parentThreadId: "child" }) }));
  assert.equal(ownerThreadId(s, "grandchild"), "parent");
  assert.equal(ownerThreadId(s, "parent"), "parent");
  assert.equal(isChildThread(s, "grandchild"), true);
  assert.equal(isChildThread(s, "parent"), false);
  assert.deepEqual(childThreadIds(s, "parent"), ["child", "grandchild"]);
  assert.deepEqual(childThreadIds(s, "grandchild"), []);
  // Repeating thread/started must not duplicate the child entry.
  s = reduce(s, event("thread/started", { thread: thread("child", { parentThreadId: "parent" }) }));
  assert.deepEqual(s.childThreads.parent, ["child"]);
  assert.equal(reduce(s, event("thread/started", {})), s, "a notification without a thread is ignored");
});

test("child-thread items bucket under the child id and never touch the parent", () => {
  let s = reduce(emptyState, event("thread/started", { thread: thread("child", { parentThreadId: "parent" }) }));
  s = reduce(s, event("turn/started", { threadId: "child", turn: { id: "t1" } }));
  s = reduce(s, event("item/started", { threadId: "child", turnId: "t1", item: { id: "i1", type: "commandExecution", command: "printf x", status: "inProgress" } }));
  assert.equal(s.items.parent, undefined, "the parent transcript never receives a sub-agent item");
  assert.equal(s.items.child.length, 1);
  assert.equal(s.active.child, "t1");
  assert.equal(s.active.parent, undefined);
  assert.equal(ownerThreadId(s, "child"), "parent", "the child bucket resolves to its parent session");
});

test("thread/status/changed records the runtime status per thread", () => {
  let s = reduce(emptyState, event("thread/status/changed", { threadId: "a", status: { type: "active", activeFlags: ["waitingOnApproval"] } }));
  assert.deepEqual(s.threadStatus.a, { type: "active", activeFlags: ["waitingOnApproval"] });
  assert.deepEqual(s.threads.a.status, { type: "active", activeFlags: ["waitingOnApproval"] });
  s = reduce(s, event("thread/status/changed", { threadId: "a", status: { type: "idle" } }));
  assert.deepEqual(s.threadStatus.a, { type: "idle" });
  assert.equal(reduce(s, event("thread/status/changed", { threadId: "a" })), s, "a status-less notification is ignored");
});

test("item/fileChange/patchUpdated replaces the whole change set", () => {
  const first = [{ path: "/w/one.txt", kind: "update", diff: "-one\n+ONE" }];
  const second = [...first, { path: "/w/two.txt", kind: "add", diff: "+two" }];
  let s = reduce(emptyState, event("item/started", { threadId: "a", turnId: "t1", item: { id: "f1", type: "fileChange", status: "inProgress", changes: first } }));
  s = reduce(s, event("item/fileChange/patchUpdated", { threadId: "a", turnId: "t1", itemId: "f1", changes: second }));
  assert.deepEqual(s.items.a[0].changes, second);
  assert.equal(s.items.a[0].status, "inProgress", "the patch does not settle the item");
  assert.equal(s.items.a.length, 1);
  // A patch can precede item/started. It must NOT synthesize a row: an item
  // with no lifecycle status is drawn as settled (source-session.jsx:100
  // outcome() -> "done"), so the transcript would show a finished "Edited /
  // N files" step for a patch the model is still revising. Nothing is lost -
  // item/started carries the authoritative FileChangeItem, changes included.
  // (Changed from the 0.2.15 expectation, which asserted the synthesized row.)
  const early = reduce(emptyState, event("item/fileChange/patchUpdated", { threadId: "b", turnId: "t9", itemId: "f9", changes: first }));
  assert.deepEqual(early.items.b ?? [], [], "an update for an unreported item invents no row");
  const late = reduce(early, event("item/started", { threadId: "b", turnId: "t9", item: { id: "f9", type: "fileChange", status: "inProgress", changes: second } }));
  assert.deepEqual(late.items.b.map(entry => entry.id), ["f9"]);
  assert.equal(late.items.b[0].status, "inProgress");
  assert.deepEqual(late.items.b[0].changes, second, "the server's own item is authoritative");
  assert.equal(reduce(s, event("item/fileChange/patchUpdated", { threadId: "a", itemId: "f1" })), s, "a patch without changes is ignored");
});

test("item/mcpToolCall/progress annotates the running call without settling it", () => {
  let s = reduce(emptyState, event("item/started", { threadId: "a", turnId: "t1", item: { id: "m1", type: "mcpToolCall", server: "files", tool: "read", status: "inProgress" } }));
  s = reduce(s, event("item/mcpToolCall/progress", { threadId: "a", turnId: "t1", itemId: "m1", message: "Indexing 2 of 9" }));
  assert.equal(s.items.a[0].progressMessage, "Indexing 2 of 9");
  assert.equal(s.items.a[0].status, "inProgress");
  s = reduce(s, event("item/mcpToolCall/progress", { threadId: "a", turnId: "t1", itemId: "m1", message: "Indexing 9 of 9" }));
  assert.equal(s.items.a[0].progressMessage, "Indexing 9 of 9");
  assert.equal(s.items.a.length, 1);
  assert.equal(reduce(s, event("item/mcpToolCall/progress", { threadId: "a", itemId: "m1" })), s, "a progress notification without a message is ignored");
  // Same rule as the patch above: progress for an item Codex has not reported
  // creates nothing. A synthesized mcpToolCall row carries no server/tool, so
  // source-session.jsx:441-445 would label it with the literal fallback
  // "Tool" and outcome() would draw it as already done.
  const earlyProgress = reduce(emptyState, event("item/mcpToolCall/progress", { threadId: "c", turnId: "t9", itemId: "m9", message: "Indexing 1 of 9" }));
  assert.deepEqual(earlyProgress.items.c ?? [], [], "progress for an unreported item invents no row");
});

test("unconsumed 0.155.1 notifications leave the state untouched instead of throwing", () => {
  const base = reduce(emptyState, event("thread/started", { thread: thread("a") }));
  for (const [method, params] of [
    ["thread/attachment/updated", { threadId: "a", attachments: [] }],
    ["model/rerouted", { threadId: "a", from: "x", to: "y" }],
    ["skills/changed", {}],
    ["mcpServer/startupStatus/updated", { name: "files" }],
    ["hook/started", { threadId: "a", hook: {} }],
    ["item/plan/delta", { threadId: "a", itemId: "p1", delta: "x" }],
    ["guardianWarning", { threadId: "a", message: "x" }],
  ]) assert.equal(reduce(base, event(method, params)), base, `${method} must be inert`);
});

test("a sub-agent is classified by Thread.source, not only by parentThreadId", () => {
  // The app-server's own list classification keys on Thread.source
  // (SessionSource = ... | {subAgent: SubAgentSource}, filters.rs:121-150),
  // while parentThreadId is set only for an AgentControl thread_spawn
  // (ts/v2/Thread.ts). work/protocol-0155-audit/probe.json threadListSub holds
  // three real review threads with source {subAgent:"review"} and
  // parentThreadId null, so a parentThreadId-only guard admits them.
  assert.equal(isSubAgentThread({ id: "r", source: { subAgent: "review" }, parentThreadId: null }), true);
  assert.equal(isSubAgentThread({ id: "c", source: { subAgent: "compact" }, parentThreadId: null }), true);
  assert.equal(isSubAgentThread({ id: "s", source: { subAgent: { thread_spawn: { parent_thread_id: "p", depth: 1 } } }, parentThreadId: "p" }), true);
  assert.equal(isSubAgentThread({ id: "d", source: "appServer", parentThreadId: "p" }), true);
  assert.equal(isSubAgentThread({ id: "n", source: "appServer", parentThreadId: null }), false);
  assert.equal(isSubAgentThread({ id: "u", source: { custom: "vscode-fork" }, parentThreadId: null }), false);
  assert.equal(isSubAgentThread({ id: "e" }), false);
  assert.equal(isSubAgentThread(null), false);
});

test("an approval raised on a sub-agent thread belongs to the session that owns it", () => {
  // A sub-agent thread is never a session and never navigable, so an approval
  // matched against its own threadId alone would have no surface at all.
  let s = reduce(emptyState, event("thread/started", { thread: thread("child", { parentThreadId: "root" }) }));
  s = reduce(s, event("thread/started", { thread: thread("grandchild", { parentThreadId: "child" }) }));
  s = { ...s, approvals: [{ id: "req-1", params: { threadId: "grandchild" } }] };
  assert.equal(hasPendingApproval(s, "root"), true);
  assert.equal(hasPendingApproval(s, "child"), false, "only the owning session claims it");
  assert.equal(hasPendingApproval(s, "grandchild"), false);
  assert.equal(hasPendingApproval(s, undefined), false);
  assert.equal(hasPendingApproval({ ...s, approvals: [{ id: "req-2", params: {} }] }, "root"), false,
    "a request with no threadId is not attributed to any session");
  assert.equal(hasPendingApproval({ approvals: [{ id: "req-3", params: { threadId: "root" } }] }, "root"), true,
    "an ordinary session approval still matches with no parent table at all");
});
