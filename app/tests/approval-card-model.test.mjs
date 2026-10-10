import test from "node:test";
import assert from "node:assert/strict";
import { approvalAnnouncement, approvalCardModel, approvalActionIndex, approvalHasVisibleIntersection, approvalKeyIntent, createApprovalHotkeyArming, detailsOverflow, PREVIEW_TOO_LARGE, scrollRegionProps } from "../src/approval-card-model.mjs";
const command = params => ({ id: 7, method: "item/commandExecution/requestApproval", params });
const permissions = params => ({ id: "7", method: "item/permissions/requestApproval", params });
const file = params => ({ id: 8, method: "item/fileChange/requestApproval", params });
const enter = extra => ({ key: "Enter", ...extra });

test("command details retain exact text; the reason has its own slot beside cwd and network context", () => {
  const raw = "printf '%s\\n' '<script>&\\\"'\n# trailing\n";
  const request = command({ command: raw, reason: "Needs a real API response", cwd: "/tmp/project with spaces",
    networkApprovalContext: { protocol: "https", host: "example.test:8443" } });
  const model = approvalCardModel(request);
  assert.equal(model.detail.text, raw);
  // approval-current.js:15275-15284: the decision reason is its own block, never context.
  assert.equal(model.reason, "Needs a real API response");
  assert.deepEqual(model.context, [
    { key: "cwd", text: "Working directory: /tmp/project with spaces" },
    { key: "network", text: "Network access: https://example.test:8443" },
  ]);
  assert.equal(request.params.command, raw);
});

test("reason slot: file and permission reasons move too; blank or absent reasons are null", () => {
  const fileModel = approvalCardModel(file({ reason: "Needs danger-full-access: write /x", grantRoot: "/tmp/allowed" }));
  assert.equal(fileModel.reason, "Needs danger-full-access: write /x");
  assert.deepEqual(fileModel.context.map(part => part.key), ["grant-root", "missing-detail"]);
  assert.equal(approvalCardModel(permissions({ reason: "Write report", permissions: {} })).reason, "Write report");
  assert.equal(approvalCardModel(command({ command: "true", reason: "  " })).reason, null);
  assert.equal(approvalCardModel(command({ command: "true" })).reason, null);
  assert(!approvalCardModel(command({ command: "true", reason: "Why" })).context.some(part => part.key === "reason"));
});

test("sessionGrantable:false leaves only Deny and Allow once; the shifted chord then does nothing", () => {
  for (const request of [command({ command: "touch /x", sessionGrantable: false }), file({ sessionGrantable: false })]) {
    const model = approvalCardModel(request, { changes: [{ path: "/x", kind: { type: "add" } }] });
    assert.equal(model.deny.key, "decline");
    assert.deepEqual(model.allows.map(action => action.key), ["accept"]);
    assert.equal(model.allows[0].primary, true);
    // approval-hotkeys-current.js:100 allowPersistent?.(): swallowed, never upgraded or downgraded.
    assert.deepEqual(approvalKeyIntent(enter({ metaKey: true, shiftKey: true }), { target: "card", model }), { type: "suppress" });
    assert.deepEqual(approvalKeyIntent(enter({ metaKey: true }), { target: "card", model }), { type: "action", action: "accept" });
  }
  // Codex servers never send the field; true behaves the same.
  for (const sessionGrantable of [undefined, true])
    assert.deepEqual(approvalCardModel(command({ command: "true", sessionGrantable })).allows.map(action => action.key), ["acceptForSession", "accept"]);
});

test("item headings follow the source per-tool copy (approval-current.js:14508-14595)", () => {
  const json = value => JSON.stringify(value, null, 2);
  // Bash with a description: "run" + description, the command as clamped detail.
  const bash = approvalCardModel(command({ command: "npm test -- --watch=false", cwd: "/w" }),
    { type: "commandExecution", command: "npm test -- --watch=false", description: "Run the  unit\ntests" });
  assert.equal(bash.title, "Allow DeepSeek to run Run the unit tests?");
  assert.deepEqual(bash.heading, { action: "run", meta: "Run the unit tests" });
  assert.equal(bash.clampTitle, true);
  assert.deepEqual(bash.detail, { kind: "command", text: "npm test -- --watch=false", value: "npm test -- --watch=false" });
  // EM has no working-directory row (approval-current.js:14507-14515, :15561-15591).
  assert.deepEqual(bash.context, []);
  // The item-less fallback keeps its local Working directory line.
  assert.deepEqual(approvalCardModel(command({ command: "ls", cwd: "/w" })).context.map(part => part.key), ["cwd"]);
  // Without a description the generic title stays.
  const plain = approvalCardModel(command({ command: "ls" }), { type: "commandExecution", command: "ls" });
  assert.equal(plain.title, "Allow DeepSeek to run this command?");
  assert.equal(plain.heading, undefined);

  // DeepSeek subagent: "run an agent" + description and no detail at all (Task/Agent,
  // approval-current.js:14570-14579); the bridge's "<tool> <json>" command loses to the item.
  const args = { description: "Audit the parser", prompt: "Read src/parse.js\nand list bugs" };
  const agent = approvalCardModel(command({ command: `subagent ${JSON.stringify(args)}`, cwd: "/w" }),
    { type: "dynamicToolCall", tool: "subagent", arguments: args });
  assert.equal(agent.title, "Allow DeepSeek to run an agent Audit the parser?");
  assert.deepEqual(agent.heading, { action: "run an agent", meta: "Audit the parser" });
  assert.equal(agent.detail, null);
  assert.equal(agent.clampTitle, undefined);
  assert.deepEqual(agent.context, []);
  assert.equal(approvalCardModel(command({}), { type: "dynamicToolCall", tool: "subagent", arguments: { description: "Say hello", prompt: "Greet" } }).title,
    "Allow DeepSeek to run an agent Say hello?");
  // Without a description the prompt's first line stays the meta.
  const fork = approvalCardModel(command({}), { type: "dynamicToolCall", tool: "subagent_fork", arguments: { prompt: "Try the other approach\nthen report" } });
  assert.deepEqual(fork.heading, { action: "run an agent", meta: "Try the other approach" });
  assert.equal(fork.detail, null);
  const spawn = approvalCardModel(command({}), { type: "collabAgentToolCall", tool: "spawnAgent", prompt: "Index the repo\nquickly" });
  assert.deepEqual(spawn.heading, { action: "run an agent", meta: "Index the repo" });
  assert.equal(spawn.detail, null);
  // The DeepSeek core's spawn row keeps the delegation description: it names the agent.
  const described = approvalCardModel(command({}), { type: "collabAgentToolCall", tool: "spawnAgent", prompt: "Index the repo\nquickly", description: "Index repo" });
  assert.equal(described.title, "Allow DeepSeek to run an agent Index repo?");
  assert.equal(described.clampTitle, undefined);
  assert.equal(described.detail, null);

  assert.deepEqual(approvalCardModel(command({}), { type: "dynamicToolCall", tool: "skill", arguments: { name: "pdf" } }).heading, { action: "run skill", meta: "/pdf" });
  assert.equal(approvalCardModel(command({}), { type: "dynamicToolCall", tool: "skill", arguments: { name: "pdf" } }).detail, null);
  assert.equal(approvalCardModel(command({}), { type: "dynamicToolCall", tool: "web_fetch", arguments: { url: "https://a.test/x" } }).title, "Allow DeepSeek to fetch https://a.test/x?");
  assert.equal(approvalCardModel(command({}), { type: "webSearch", action: { type: "openPage", url: "https://b.test" } }).title, "Allow DeepSeek to fetch https://b.test?");
  assert.equal(approvalCardModel(command({}), { type: "dynamicToolCall", tool: "web_search", arguments: { queries: ["a", "b"] } }).title, "Allow DeepSeek to search the web a, b?");
  assert.equal(approvalCardModel(command({}), { type: "webSearch", query: "q", action: { type: "search", query: "q" } }).title, "Allow DeepSeek to search the web q?");

  // MCP: "use tool (server)" + pretty JSON; any other tool: "use tool".
  const mcp = approvalCardModel(command({ command: "mcp__github__create_issue {}" }),
    { type: "mcpToolCall", server: "github", tool: "create_issue", arguments: { title: "Bug" } });
  assert.equal(mcp.title, "Allow DeepSeek to use create_issue (github)?");
  assert.deepEqual(mcp.heading, { action: "use create_issue (github)", meta: null });
  assert.equal(mcp.detail.text, json({ title: "Bug" }));
  const other = approvalCardModel(command({ command: "send_message {}" }), { type: "dynamicToolCall", tool: "send_message", arguments: { to: "a1", text: "hi" } });
  assert.equal(other.title, "Allow DeepSeek to use send_message?");
  assert.equal(other.detail.text, json({ to: "a1", text: "hi" }));
  const bare = approvalCardModel(command({ command: "job_list {}" }), { type: "dynamicToolCall", tool: "job_list", arguments: {} });
  assert.equal(bare.title, "Allow DeepSeek to use job_list?");
  assert.equal(bare.detail, null);
  assert(!bare.context.some(part => part.key === "missing-detail"));

  // No item: unchanged generic copy; stdin approvals keep theirs.
  assert.equal(approvalCardModel(command({ command: "subagent {}" })).title, "Allow DeepSeek to run this command?");
  assert.equal(approvalCardModel(command({ command: "subagent {}" })).detail.text, "subagent {}");
  assert.match(approvalCardModel(command({ kind: "writeStdin" }), { type: "commandExecution", command: "cat", description: "Read input" }).title, /send input/);
});

test("a clamped region is focusable and labelled only while it overflows (cf6ae6197 bv)", () => {
  assert.deepEqual(scrollRegionProps("Reason", false), {});
  assert.deepEqual(scrollRegionProps("Reason", true), { tabIndex: 0, role: "group", "aria-label": "Reason" });
});

test("missing command has no fake disclosure; real item fallback preserves argv boundaries", () => {
  assert.equal(approvalCardModel(command({ reason: "Inspect first" })).detail, null);
  assert.equal(approvalCardModel(command({})).context[0].key, "missing-detail");
  const argv = ["printf", "%s", "argument with spaces", ""];
  assert.deepEqual(JSON.parse(approvalCardModel(command({ kind: "writeStdin" }), { command: argv }).detail.text), argv);
  assert.match(approvalCardModel(command({ kind: "writeStdin" })).title, /send input/);
});

test("file grant root remains context even when a real diff exists; empty changes do not create details", () => {
  const changes = [{ path: "/w/a.js", kind: "update", diff: "@@ -1 +1 @@\n-old\n+new\n" }];
  const model = approvalCardModel(file({ grantRoot: "/tmp/allowed" }), { changes });
  assert.deepEqual(model.detail, { kind: "path", text: "/w/a.js", value: changes });
  assert.equal(model.context[0].text, "Requested write root: /tmp/allowed");
  assert.equal(approvalCardModel(file({ changes: [] })).detail, null);
  // EM y (approval-current.js:15254): a bare file name equals the meta, so there is no
  // detail (no path box, preview or toggle); the heading and context stay.
  const bare = approvalCardModel(file({ grantRoot: "/tmp/allowed" }), { changes: [{ path: "a.js", kind: "update", diff: "+x\n" }] });
  assert.equal(bare.detail, null);
  assert.deepEqual(bare.heading, { action: "edit", meta: "a.js" });
  assert.equal(bare.context[0].key, "grant-root");
});

test("file detail is the full path (SM, approval-current.js:15201-15205); several changes list every path", () => {
  const one = approvalCardModel(file({}), { changes: [{ path: "/w/src/a/b.ts", kind: { type: "add" }, diff: "+x\n" }] });
  assert.equal(one.detail.kind, "path");
  assert.equal(one.detail.text, "/w/src/a/b.ts");
  assert.equal(one.heading.meta, "b.ts");
  assert.equal(one.clampTitle, true);
  assert.equal(one.detail.value[0].diff, "+x\n", "the changes stay the preview source");
  const many = approvalCardModel(file({}), { changes: [{ path: "/w/a.ts", kind: "update", diff: "" }, { path: "/w/b.ts", kind: "update", diff: "" }] });
  assert.equal(many.detail.text, "/w/a.ts\n/w/b.ts");
  assert.equal(many.title, "Allow DeepSeek to edit files?");
  // KS singleLine: control characters are escaped, spaces kept.
  assert.equal(approvalCardModel(file({}), { changes: [{ path: "/w/a  b\nc.ts", kind: "add" }] }).detail.text, "/w/a  b[U+000A]c.ts");
  // params.changes (a sub-agent card) wins over the item and names the same path.
  assert.equal(approvalCardModel(file({ changes: [{ path: "/w/child.ts", kind: { type: "add" }, diff: "" }] })).detail.text, "/w/child.ts");
  // Opaque (non-list) changes keep the raw block.
  assert.equal(approvalCardModel(file({ changes: { odd: true } })).detail.kind, "changes");
});

test("a change over 200,000 characters gets the fM sentence (approval-current.js:14792-14798) and no preview", () => {
  const big = approvalCardModel(file({}), { changes: [{ path: "/w/big.txt", kind: { type: "add" }, diff: "x".repeat(200001) }] });
  assert.deepEqual(big.context, [{ key: "too-large", text: PREVIEW_TOO_LARGE }]);
  assert.match(PREVIEW_TOO_LARGE, /^Preview unavailable \u2014 this change is too large to show here \(over 200,000 characters\)\. The full change appears in the conversation after it runs\.$/);
  assert.deepEqual(approvalCardModel(file({}), { changes: [{ path: "/w/ok.txt", kind: { type: "add" }, diff: "x".repeat(200000) }] }).context, []);
});

test("approvalAnnouncement follows pM (approval-current.js:14799-14905)", () => {
  const bash = approvalCardModel(command({ command: "npm  test\n--watch=false" }),
    { type: "commandExecution", command: "npm test", description: "Run the unit tests" });
  assert.equal(approvalAnnouncement(bash), "Permission requested: run. npm test --watch=false, Run the unit tests");
  const write = approvalCardModel(file({}), { changes: [{ path: "/w/created.ts", kind: { type: "add" }, diff: "+x\n" }] });
  assert.equal(approvalAnnouncement(write), "Permission requested: write. /w/created.ts, created.ts");
  const agent = approvalCardModel(command({}), { type: "dynamicToolCall", tool: "subagent", arguments: { description: "Say hello", prompt: "Greet" } });
  assert.equal(approvalAnnouncement(agent), "Permission requested: run an agent, Say hello");
  // A headingless card announces its own phrase; a long detail is capped at 150 with ", truncated".
  const long = approvalCardModel(command({ command: "x".repeat(200) }));
  assert.equal(approvalAnnouncement(long), `Permission requested: run this command. ${"x".repeat(150)}, truncated`);
  // The decision reason and the too-large sentence follow as extra blocks.
  const reasoned = approvalCardModel(file({ reason: "Needs workspace-write" }), { changes: [{ path: "/w/big.txt", kind: "add", diff: "x".repeat(200001) }] });
  assert.equal(approvalAnnouncement(reasoned), `Permission requested: write. /w/big.txt, big.txt. Needs workspace-write. ${PREVIEW_TOO_LARGE}`);
  assert.equal(approvalAnnouncement(approvalCardModel(permissions({}))), "Permission requested: use these permissions");
});

test("single-file change names the file: EM/SM 'Allow DeepSeek to {write|edit} {basename}?' (approval-current.js:14521-14534, :15201-15205)", () => {
  const one = kind => approvalCardModel(file({}), { changes: [{ path: "src/a/b.ts", kind, diff: "+x\n" }] });
  for (const [kind, action] of [[{ type: "update", move_path: null }, "edit"], [{ type: "add" }, "write"], ["update", "edit"], ["add", "write"], [{ type: "delete" }, "edit"]]) {
    const model = one(kind);
    assert.equal(model.title, `Allow DeepSeek to ${action} b.ts?`);
    assert.deepEqual(model.heading, { action, meta: "b.ts" });
    assert.equal(model.clampTitle, true);
  }
  assert.equal(approvalCardModel(file({}), { changes: [{ path: "C:\\repo\\dir\\ x .ts", kind: { type: "add" } }] }).title, "Allow DeepSeek to write  x .ts?");
  for (const changes of [[], [{ path: "a.ts", kind: "update" }, { path: "b.ts", kind: "update" }], [{ kind: { type: "add" } }], [{ path: " ", kind: "add" }]]) {
    const model = approvalCardModel(file({}), { changes });
    assert.equal(model.title, "Allow DeepSeek to edit files?");
    assert.equal(model.heading, undefined);
    assert.equal(model.clampTitle, undefined);
  }
  assert.equal(approvalCardModel(file({ grantRoot: "/tmp" })).title, "Allow DeepSeek to edit files?");
  assert.equal(approvalCardModel(command({ command: "true" })).title, "Allow DeepSeek to run this command?");
  assert.equal(approvalCardModel(command({ command: "true" })).heading, undefined);
  assert.equal(approvalCardModel(permissions({ permissions: {} })).title, "Allow DeepSeek to use these permissions?");
});

test("permissions preserve every unknown field and expose only turn-scoped allow/deny", () => {
  const raw = { network: { enabled: true }, fileSystem: { read: ["/tmp/a"], write: ["/tmp/b"] }, futureCapability: ["real-value"] };
  const model = approvalCardModel(permissions({ cwd: "/tmp/b", reason: "Write report", permissions: raw }));
  assert.deepEqual(JSON.parse(model.detail.text), raw);
  assert.equal(model.deny.key, "deny");
  assert.deepEqual(model.allows.map(action => action.key), ["allow"]);
  assert(model.context.some(part => part.key === "scope" && part.text === "Applies to this turn only."));
  assert.equal(approvalCardModel(permissions({ permissions: {} })).detail.text, "{}");
  assert.equal(approvalCardModel(permissions({})).detail, null);
});

test("unknown and question methods never gain ordinary approval actions", () => {
  for (const method of ["unsupported/tool", "item/tool/requestUserInput", undefined]) {
    const model = approvalCardModel({ method, params: {} });
    assert.equal(model.supported, false);
    assert.equal(model.deny, null);
    assert.deepEqual(model.allows, []);
    assert.equal(approvalKeyIntent(enter({ metaKey: true }), { target: "card", model }), null);
  }
});

test("card Enter focuses primary; four arrows wrap actions without submitting", () => {
  const model = approvalCardModel(command({ command: "true" }));
  assert.deepEqual(approvalKeyIntent(enter(), { target: "card", model }), { type: "focus-primary" });
  assert.equal(approvalKeyIntent(enter(), { target: "content", model }), null);
  assert.equal(approvalActionIndex("ArrowLeft", 0, 3), 2);
  assert.equal(approvalActionIndex("ArrowDown", 2, 3), 0);
  assert.equal(approvalActionIndex("ArrowUp", -1, 3), 2);
  assert.equal(approvalActionIndex("ArrowRight", -1, 3), 0);
  assert.equal(approvalActionIndex("ArrowDown", 0, 0), null);
});

test("local shortcuts preserve command session versus permission turn semantics", () => {
  const model = approvalCardModel(command({ command: "true" }));
  assert.deepEqual(approvalKeyIntent(enter({ metaKey: true }), { target: "card", model }), { type: "action", action: "accept" });
  assert.deepEqual(approvalKeyIntent(enter({ ctrlKey: true, shiftKey: true }), { target: "actions", model }), { type: "action", action: "acceptForSession" });
  assert.deepEqual(approvalKeyIntent(enter({ metaKey: true, shiftKey: true }), {
    target: "card", model: approvalCardModel(permissions({ permissions: {} })),
  }), { type: "action", action: "allow" });
  assert.deepEqual(approvalKeyIntent({ key: "Escape" }, { target: "card", model, armed: false }), { type: "action", action: "decline" });
});

test("busy/background/menu/editor/IME/alt inputs never become grants; unarmed and repeated activation suppress", () => {
  const base = { target: "card", model: approvalCardModel(command({ command: "true" })) };
  for (const options of [{ busy: true }, { active: false }, { menuOpen: true }, { target: "editor" }])
    assert.equal(approvalKeyIntent(enter({ metaKey: true }), { ...base, ...options }), null);
  for (const properties of [{ isComposing: true }, { nativeEvent: { isComposing: true } }, { keyCode: 229 }, { nativeEvent: { keyCode: 229 } }, { altKey: true }])
    assert.equal(approvalKeyIntent(enter({ metaKey: true, ...properties }), base), null);
  assert.deepEqual(approvalKeyIntent(enter({ metaKey: true }), { ...base, armed: false }), { type: "suppress" });
  assert.deepEqual(approvalKeyIntent(enter({ metaKey: true, repeat: true }), base), { type: "suppress" });
  assert.equal(approvalKeyIntent({ key: "ArrowDown" }, { ...base, target: "content" }), null);
});

test("overflow focus is enabled only when actual scroll height exceeds the viewport", () => {
  assert.equal(detailsOverflow({ scrollHeight: 100, clientHeight: 100 }), false);
  assert.equal(detailsOverflow({ scrollHeight: 100, clientHeight: 99 }), true);
  assert.equal(detailsOverflow({ scrollHeight: 0, clientHeight: 0 }), false);
});

test("keyboard visibility allows partial cards but rejects empty viewport or clipping intersections", () => {
  const viewport = { width: 800, height: 600 };
  const rect = { top: 50, bottom: 250, left: 50, right: 450 };
  const base = { rect, viewport };
  assert.equal(approvalHasVisibleIntersection(base), true);
  assert.equal(approvalHasVisibleIntersection({ ...base, rect: { ...rect, top: 590, bottom: 790 } }), true);
  assert.equal(approvalHasVisibleIntersection({ ...base, rect: { ...rect, top: 600, bottom: 800 } }), false);
  assert.equal(approvalHasVisibleIntersection({ ...base, rect: { ...rect, right: 0, left: -400 } }), false);
  assert.equal(approvalHasVisibleIntersection({ ...base, visible: false }), false);
  assert.equal(approvalHasVisibleIntersection({ ...base, rect: { ...rect, bottom: 50 } }), false);
  const clips = [{ rect: { top: 100, bottom: 200, left: 0, right: 800 }, overflowX: "visible", overflowY: "auto" }];
  assert.equal(approvalHasVisibleIntersection({ ...base, clips }), true);
  assert.equal(approvalHasVisibleIntersection({ ...base, clips: [{ ...clips[0], rect: { top: 250, bottom: 500, left: 0, right: 800 } }] }), false);
  assert.equal(approvalHasVisibleIntersection({ ...base, clips: [...clips,
    { rect: { top: 0, bottom: 600, left: 450, right: 800 }, overflowX: "hidden", overflowY: "visible" }] }), false);
});

test("vertical pixel scroll padding participates in the source intersection, percent/auto values do not", () => {
  const base = { rect: { top: 0, bottom: 20, left: 0, right: 100 }, viewport: { width: 800, height: 600 } };
  const clip = { rect: { top: 0, bottom: 200, left: 0, right: 800 }, overflowX: "visible", overflowY: "scroll" };
  assert.equal(approvalHasVisibleIntersection({ ...base, clips: [{ ...clip, scrollPaddingTop: "20px" }] }), false);
  assert.equal(approvalHasVisibleIntersection({ ...base, clips: [{ ...clip, scrollPaddingTop: "19px" }] }), true);
  assert.equal(approvalHasVisibleIntersection({ ...base, clips: [{ ...clip, scrollPaddingTop: "50%" }] }), true);
  assert.equal(approvalHasVisibleIntersection({ ...base, clips: [{ ...clip, scrollPaddingTop: "auto" }] }), true);
});

test("initial visible observation does not restart the 400ms hotkey clock; real hidden-to-visible does once", () => {
  let now = 0;
  const clock = createApprovalHotkeyArming({ now: () => now });
  now = 300;
  assert.equal(clock.observeVisibility({ intersecting: true, visible: true }), false);
  now = 399; assert.equal(clock.isArmed(), false);
  now = 400; assert.equal(clock.isArmed(), true);
  now = 500; clock.observeVisibility({ intersecting: false, visible: true });
  now = 600; assert.equal(clock.observeVisibility({ intersecting: true, visible: true }), true);
  now = 750; assert.equal(clock.observeVisibility({ intersecting: true, visible: true }), false);
  now = 999; assert.equal(clock.isArmed(), false);
  now = 1000; assert.equal(clock.isArmed(), true);
});

test("clipped geometry independently observes hidden state and pane reactivation has its own grace", () => {
  let now = 0;
  const clock = createApprovalHotkeyArming({ now: () => now, active: true });
  now = 500; clock.observeVisibility({ intersecting: true, visible: false });
  now = 600; assert.equal(clock.observeVisibility({ intersecting: false, visible: true }), false);
  now = 700; assert.equal(clock.observeVisibility({ intersecting: true, visible: true }), true);
  now = 1100; assert.equal(clock.isArmed(), true);
  clock.setActive(false);
  now = 1200; clock.setActive(true);
  now = 1500; clock.setActive(true);
  now = 1599; assert.equal(clock.isArmed(), false);
  now = 1600; assert.equal(clock.isArmed(), true);
});

test("reentry grace suppresses only grant chords, never Escape or ordinary focus navigation", () => {
  let now = 0;
  const clock = createApprovalHotkeyArming({ now: () => now });
  now = 500; clock.observeVisibility({ intersecting: false, visible: false });
  now = 600; clock.observeVisibility({ intersecting: true, visible: true });
  const context = { target: "card", model: approvalCardModel(command({ command: "true" })), armed: clock.isArmed() };
  assert.deepEqual(approvalKeyIntent(enter({ metaKey: true }), context), { type: "suppress" });
  assert.deepEqual(approvalKeyIntent({ key: "Escape" }, context), { type: "action", action: "decline" });
  assert.deepEqual(approvalKeyIntent(enter(), context), { type: "focus-primary" });
});

test("Codex availableDecisions build the buttons: a prefix rule is 'Always allow', an unlisted session grant and decline are not offered", async () => {
  const offered = ["accept", { acceptWithExecpolicyAmendment: { execpolicy_amendment: ["npm", "test"] } }, "cancel"];
  const model = approvalCardModel(command({ command: "npm test", availableDecisions: offered }));
  assert.deepEqual(model.allows.map(allow => allow.key), ["decision:1", "accept"]);
  assert.equal(model.allows[0].label, "Always allow commands that start with “npm test”");
  assert.match(model.allows[0].title, /every session and project/);
  assert.equal(model.allows[0].persistent, true);
  assert.deepEqual(model.deny, { key: "cancel", label: "Deny", primary: false }, "decline isn't offered: Deny is cancel");
  // ⇧⌘↵ picks the persistent allow.
  assert.deepEqual(approvalKeyIntent(enter({ metaKey: true, shiftKey: true }), { target: "card", model }), { type: "action", action: "decision:1" });
  const host = approvalCardModel(command({ command: "curl x", availableDecisions: ["accept", "acceptForSession",
    { applyNetworkPolicyAmendment: { network_policy_amendment: { host: "registry.npmjs.org", action: "allow" } } }, "decline", "cancel"] }));
  assert.deepEqual(host.allows.map(allow => [allow.key, allow.label]), [["decision:2", "Always allow registry.npmjs.org"], ["acceptForSession", "Allow for this session"], ["accept", "Allow once"]]);
  assert.equal(host.deny.key, "decline");
  // No list (the bridges): the fixed set.
  assert.deepEqual(approvalCardModel(command({ command: "ls" })).allows.map(allow => allow.key), ["acceptForSession", "accept"]);
  const { createRequire } = await import("node:module");
  const { approvalResponse } = createRequire(import.meta.url)("../electron/respond-approval.cjs");
  const request = command({ command: "npm test", availableDecisions: offered });
  assert.deepEqual(approvalResponse(request, { decisionIndex: 1 }), { decision: { acceptWithExecpolicyAmendment: { execpolicy_amendment: ["npm", "test"] } } });
  for (const bad of [{ decisionIndex: 0 }, { decisionIndex: 9 }, { decisionIndex: "1" }, { decisionIndex: 1, decision: "accept" }])
    assert.throws(() => approvalResponse(request, bad), /Invalid decision/);
  assert.deepEqual(approvalResponse(request, { decision: "cancel" }), { decision: "cancel" });
});

test("ZCode's dynamic workflow run: one card with the bridge's script summary and its reason", () => {
  const summary = "Workflow: review-changes — Review changed files\nPhases: 1. Find  2. Verify";
  const model = approvalCardModel(command({ command: summary, reason: "Run this workflow? Its agents will run without asking for approval." }),
    { type: "dynamicToolCall", tool: "CreateWorkflow", arguments: { script: "export const meta={name:'review-changes'}" } });
  assert.equal(model.heading.action, "run a dynamic workflow");
  assert.equal(model.detail.text, summary);
  assert.equal(model.reason, "Run this workflow? Its agents will run without asking for approval.");
  // Other tools keep the generic copy.
  assert.equal(approvalCardModel(command({ command: "x" }), { type: "dynamicToolCall", tool: "Other", arguments: {} }).heading.action, "use Other");
});

test("preview site and dev server cards say the approval lasts for the session, and quote the server's name", () => {
  const request = (agentTool, extra = {}) => ({ method: "item/commandExecution/requestApproval", params: { threadId: "t", turnId: "", itemId: "i", cwd: "/w", codeDesktop: { agentTool }, ...extra } });
  const site = approvalCardModel(request({ kind: "preview-site", host: "example.org", url: "https://example.org/" }));
  assert.deepEqual(site.allows.map((allow) => [allow.key, allow.label]), [["accept", "Allow for this session"]]);
  const server = approvalCardModel(request({ kind: "preview-server", name: "site" }, { command: "npm run dev" }));
  assert.deepEqual(server.allows.map((allow) => [allow.key, allow.label]), [["accept", "Allow for this session"]]);
  assert.match(server.title, /start the dev server “site”\?$/);
  assert.match(approvalCardModel(request({ kind: "preview-server" }, { command: "npm run dev" })).title, /start a dev server\?$/);
});
