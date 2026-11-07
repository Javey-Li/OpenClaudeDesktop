import test from "node:test";
import assert from "node:assert/strict";
import {
  describeTool, extractCodexTelemetry, formatDuration, formatTokens, switchReason, toolKind, toolSentence,
} from "../src/board-telemetry-model.mjs";

const at = (minute, second = 0) => `2026-11-07T01:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}.000Z`;
let ordinal = 0;
const row = (type, payload, timestamp) => ({ ordinal: ++ordinal, type, timestamp, payload });

test("context window comes from the last token_count and splits by token type", () => {
  const rows = [
    row("event_msg", { type: "token_count", info: { last_token_usage: { input_tokens: 1000, cached_input_tokens: 400, output_tokens: 50, reasoning_output_tokens: 10 }, model_context_window: 10_000 } }, at(1)),
    row("event_msg", { type: "token_count", info: { last_token_usage: { input_tokens: 4000, cached_input_tokens: 3000, output_tokens: 500, reasoning_output_tokens: 80 }, model_context_window: 10_000 } }, at(2)),
  ];
  const { context } = extractCodexTelemetry(rows);
  assert.equal(context.used, 4500);
  assert.equal(context.window, 10_000);
  assert.equal(Math.round(context.percent), 45);
  assert.deepEqual(context.parts, { cached: 3000, fresh: 1000, output: 500 });
  assert.equal(context.reasoning, 80);
});

test("a session with no token_count has no context, not a made-up one", () => {
  assert.equal(extractCodexTelemetry([row("event_msg", { type: "task_started" }, at(1))]).context, null);
});

test("model chain records the switch and why", () => {
  const rows = [
    row("turn_context", { model: "auto/dfmodel" }, at(1)),
    row("event_msg", { type: "task_complete" }, at(5)),
    row("event_msg", { type: "thread_settings_applied", thread_settings: { model: "commandcode/deepseek/deepseek-v4.1-flash" } }, at(10)),
    row("turn_context", { model: "commandcode/deepseek/deepseek-v4.1-flash" }, at(10, 2)),
    row("event_msg", { type: "turn_aborted" }, at(12)),
    row("turn_context", { model: "auto/dmodel" }, at(20)),
  ];
  const { models } = extractCodexTelemetry(rows);
  assert.deepEqual(models.segments.map((segment) => segment.model), ["auto/dfmodel", "commandcode/deepseek/deepseek-v4.1-flash", "auto/dmodel"]);
  assert.equal(models.segments[1].switchedBy, "settings");
  assert.equal(models.segments[1].ended, "aborted");
  assert.equal(models.segments[2].current, true);
  assert.match(switchReason(models.segments), /deepseek-v4\.1-flash 最后一轮被中断，之后换成 dmodel/);
  assert.match(switchReason(models.segments.slice(0, 2)), /会话设置里改了模型/);
});

test("a single-model session has a one-node chain and no reason", () => {
  const { models } = extractCodexTelemetry([row("turn_context", { model: "auto/dfmodel" }, at(1)), row("turn_context", { model: "auto/dfmodel" }, at(3))]);
  assert.equal(models.segments.length, 1);
  assert.equal(models.segments[0].turns, 2);
  assert.equal(switchReason(models.segments), "");
});

test("tool calls pair with their outputs and keep failures and running calls apart", () => {
  const rows = [
    row("response_item", { type: "function_call", name: "exec_command", call_id: "a", arguments: JSON.stringify({ cmd: "cd /repo && npm test", title: "跑测试" }) }, at(1, 0)),
    row("response_item", { type: "function_call_output", call_id: "a", output: "Chunk ID: 1\nProcess exited with code 1\nOriginal token count: 5\nOutput:\n2 failed" }, at(1, 4)),
    row("response_item", { type: "custom_tool_call", name: "apply_patch", call_id: "b", input: "*** Begin Patch\n*** Update File: /repo/src/a.css\n@@\n-old\n+new\n+newer\n*** End Patch" }, at(2, 0)),
    row("response_item", { type: "custom_tool_call_output", call_id: "b", output: [{ type: "input_text", text: "Success. Updated the following files:\nM /repo/src/a.css" }] }, at(2, 1)),
    row("response_item", { type: "function_call", name: "exec_command", call_id: "c", arguments: JSON.stringify({ cmd: "sleep 30" }) }, at(3, 0)),
  ];
  const { tools } = extractCodexTelemetry(rows, { openTurn: true });
  assert.deepEqual(tools.map((tool) => tool.status), ["failed", "ok", "running"]);
  assert.equal(tools[0].verb, "跑命令");
  assert.equal(tools[0].object, "npm test");
  assert.equal(tools[0].exit, 1);
  assert.equal(tools[0].durationMs, 4000);
  assert.deepEqual(tools[1].diff, { add: 2, del: 1 });
  assert.match(tools[1].object, /a\.css/);
  const closed = extractCodexTelemetry(rows, { openTurn: false }).tools;
  assert.equal(closed[2].status, "unknown");
});

test("rows read from both ends of a file are not counted twice", () => {
  const shared = row("event_msg", { type: "token_count", info: { last_token_usage: { input_tokens: 10, output_tokens: 1 }, model_context_window: 100 } }, at(1));
  const call = row("response_item", { type: "function_call", name: "exec_command", call_id: "z", arguments: "{\"cmd\":\"ls\"}" }, at(2));
  const { tools } = extractCodexTelemetry([shared, call, shared, call]);
  assert.equal(tools.length, 1);
});

test("tool descriptions and number formats stay short", () => {
  assert.equal(describeTool("write_stdin", { chars: "" }).object, "读输出");
  assert.equal(describeTool("close_agent", "{}").object, "");
  assert.equal(formatTokens(950_000), "950k");
  assert.equal(formatTokens(1_500), "1.5k");
  assert.equal(formatDuration(4000), "4.0s");
  assert.equal(formatDuration(125_000), "2m05s");
});

test("each tool call says what it did in one sentence", () => {
  assert.equal(toolSentence("exec_command", JSON.stringify({ cmd: "cd /repo && npm run test" })), "跑测试");
  assert.equal(toolSentence("exec_command", JSON.stringify({ cmd: "rg -n 'Piano Roll' /repo" })), "搜「Piano Roll」");
  assert.equal(toolSentence("exec_command", JSON.stringify({ cmd: "node /repo/apps/server/dist/bin.mjs thread list" })), "跑脚本：bin.mjs");
  assert.equal(toolSentence("apply_patch", "*** Begin Patch\n*** Update File: /repo/src/a.css\n@@\n-old\n+new\n*** End Patch"),
    "改 1 个文件：a.css");
  assert.equal(toolSentence("update_plan", JSON.stringify({ plan: [
    { step: "a", status: "completed" }, { step: "b", status: "in_progress" },
  ] })), "更新计划：2 步，做完 1 步");
  assert.equal(toolKind("apply_patch"), "edit");
  assert.equal(toolKind("mcp__github__list_issues"), "tool");
});

test("raw arguments stay complete and the line plan comes from its own calls", () => {
  const args = JSON.stringify({ cmd: "npm run test", note: "x".repeat(600) });
  const plan = [
    { step: "盘工作树", status: "completed" },
    { step: "补测试", status: "in_progress" },
    { step: "出截图", status: "pending" },
  ];
  const rows = [
    row("response_item", { type: "function_call", name: "exec_command", call_id: "a", arguments: args }, at(1)),
    row("response_item", { type: "function_call", name: "update_plan", call_id: "b", arguments: JSON.stringify({ plan }) }, at(2)),
    row("response_item", { type: "function_call_output", call_id: "a", output: "Chunk ID: 1\nProcess exited with code 0\nOutput:\nall pass" }, at(2, 4)),
  ];
  const telemetry = extractCodexTelemetry(rows, { openTurn: false });
  assert.equal(telemetry.tools[0].summary, "跑测试");
  assert.ok(telemetry.tools[0].args.length > 240);
  assert.match(telemetry.tools[0].args, /"note"/);
  assert.equal(telemetry.tools[0].resultLine, "all pass");
  assert.deepEqual(telemetry.plan.steps.map((step) => step.status), ["completed", "in_progress", "pending"]);
  assert.equal(telemetry.plan.done, 1);
  assert.equal(telemetry.plan.current, "补测试");
});

test("structured tool output is summarised, not printed as raw JSON", () => {
  const rows = [
    row("response_item", { type: "function_call", name: "exec_command", call_id: "a",
      arguments: JSON.stringify({ cmd: "node /repo/apps/server/dist/bin.mjs status" }) }, at(1)),
    row("response_item", { type: "function_call_output", call_id: "a",
      output: "Output:\n{'status': 'running', 'runCount': 1, 'itemCount': 131, 'pendingRequestCount': 0, 'note': 'x'}" }, at(1, 2)),
  ];
  const { tools } = extractCodexTelemetry(rows);
  assert.equal(tools[0].summary, "跑脚本：bin.mjs");
  assert.doesNotMatch(tools[0].resultLine, /^\{['"]/);
  assert.match(tools[0].resultLine, /返回结构化结果/);
  assert.match(tools[0].resultLine, /status/);
  assert.match(tools[0].result, /status/);
});
