// Per-session telemetry for the 总管 board, read from Codex rollout rows.
//
// Everything here comes from events the session wrote itself:
//   - token_count        -> Context Window / Context Map (real counts, by token type)
//   - turn_context and thread_settings_applied -> Fallback Chain (which model, when it changed)
//   - function_call / custom_tool_call (+ outputs) -> Tool Call Card
// Nothing is estimated. A field the session never wrote stays null so the UI can say so.

const text = (value) => (typeof value === "string" ? value.trim() : "");
const time = (value) => {
  const at = Date.parse(value ?? "");
  return Number.isFinite(at) ? at : 0;
};
const flat = (value, limit) => {
  const line = text(value).replace(/\s+/g, " ");
  return line.length > limit ? `${line.slice(0, limit - 1)}…` : line;
};

const VERBS = Object.freeze({
  exec_command: "跑命令",
  write_stdin: "给命令输入",
  apply_patch: "改文件",
  view_image: "看图",
  update_plan: "更新计划",
  web_search: "搜索",
  read_mcp_resource: "读资源",
  list_mcp_resources: "列资源",
  tool_search: "找工具",
  js: "跑脚本",
  js_repl: "跑脚本",
});

function parseJson(value) {
  if (value && typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return null; }
}

function patchSummary(input) {
  const files = [];
  let add = 0;
  let del = 0;
  for (const line of text(input).split(/\r?\n/)) {
    const header = /^\*\*\* (?:Update|Add|Delete) File: (.+)$/.exec(line);
    if (header) { files.push(header[1].trim().split("/").pop()); continue; }
    if (line.startsWith("+") && !line.startsWith("+++")) add += 1;
    else if (line.startsWith("-") && !line.startsWith("---")) del += 1;
  }
  return { files, add, del };
}

function commandObject(cmd) {
  const line = text(cmd).split(/\r?\n/).find(Boolean) ?? "";
  const trimmed = line.replace(/^cd\s+\S+\s*&&\s*/, "");
  return flat(trimmed, 96);
}

export function describeTool(name, rawArgs) {
  const toolName = text(name);
  const verb = VERBS[toolName] ?? (toolName.startsWith("mcp__") ? "调用" : toolName || "工具");
  const args = parseJson(rawArgs);
  const title = flat(args?.title, 80);
  if (toolName === "exec_command") return { verb, object: commandObject(args?.cmd ?? rawArgs), mono: true, title };
  if (toolName === "apply_patch") {
    const patch = patchSummary(typeof rawArgs === "string" ? rawArgs : "");
    const names = patch.files.slice(0, 2).join("、");
    const object = patch.files.length ? `${patch.files.length} 个文件${names ? `：${names}${patch.files.length > 2 ? " 等" : ""}` : ""}` : "";
    return { verb, object, mono: false, title: "", diff: patch.files.length ? { add: patch.add, del: patch.del } : null };
  }
  if (toolName === "write_stdin") return { verb, object: flat(args?.chars, 60) || "读输出", mono: true, title };
  const known = VERBS[toolName] !== undefined;
  const object = title || (toolName.startsWith("mcp__") ? flat(toolName.replace(/^mcp__/, "").replace(/__/g, " · "), 80) : "");
  return { verb: known || toolName.startsWith("mcp__") ? verb : toolName || "工具", object, mono: !title && !known, title };
}

function outputText(output) {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return output.map((part) => text(part?.text)).filter(Boolean).join("\n");
  return "";
}

function outputOutcome(raw) {
  const body = outputText(raw);
  const code = /Process exited with code (-?\d+)/.exec(body);
  const exit = code ? Number(code[1]) : /"exit_code":\s*(-?\d+)/.exec(body)?.[1];
  const failed = (exit !== undefined && Number(exit) !== 0) || /^\s*(apply_patch verification failed|error:)/i.test(body);
  const trimmed = body.includes("\nOutput:\n") ? body.slice(body.indexOf("\nOutput:\n") + 9) : body;
  return { failed, result: flat(trimmed, 220), exit: exit === undefined ? null : Number(exit) };
}

function dedupe(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = row?.ordinal != null ? `${row.ordinal}|${row.type}|${row.timestamp}` : null;
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(row);
  }
  return out;
}

function contextFrom(rows) {
  let last = null;
  for (const row of rows) {
    if (row?.type === "event_msg" && row.payload?.type === "token_count" && row.payload.info?.last_token_usage) last = row;
  }
  if (!last) return null;
  const info = last.payload.info;
  const usage = info.last_token_usage;
  const window = Number(info.model_context_window);
  const input = Number(usage.input_tokens) || 0;
  const cached = Math.min(Number(usage.cached_input_tokens) || 0, input);
  const output = Number(usage.output_tokens) || 0;
  const used = input + output;
  if (!used || !(window > 0)) return null;
  return {
    used,
    window,
    percent: Math.min(100, (used / window) * 100),
    parts: { cached, fresh: input - cached, output },
    reasoning: Number(usage.reasoning_output_tokens) || 0,
    at: last.timestamp ?? "",
  };
}

function modelsFrom(rows, { partial }) {
  const events = [];
  for (const row of rows) {
    const at = time(row?.timestamp);
    if (!at) continue;
    const payload = row.payload ?? {};
    if (row.type === "turn_context" && text(payload.model)) events.push({ at, model: text(payload.model), kind: "turn" });
    else if (row.type === "event_msg" && payload.type === "thread_settings_applied" && text(payload.thread_settings?.model)) {
      events.push({ at, model: text(payload.thread_settings.model), kind: "settings" });
    } else if (row.type === "event_msg" && payload.type === "task_complete") events.push({ at, kind: "complete" });
    else if (row.type === "event_msg" && payload.type === "turn_aborted") events.push({ at, kind: "abort" });
  }
  events.sort((a, b) => a.at - b.at);
  const segments = [];
  let current = null;
  let lastModel = "";
  let lastSettingsAt = 0;
  let lastSettingsModel = "";
  for (const event of events) {
    if (event.kind === "settings") {
      lastSettingsAt = event.at;
      lastSettingsModel = event.model;
      continue;
    }
    if (event.kind === "turn") {
      if (event.model !== lastModel) {
        const settled = lastSettingsModel === event.model && event.at - lastSettingsAt < 60_000;
        current = { model: event.model, from: event.at, to: event.at, turns: 0, completed: 0, aborted: 0, lastEnd: "", switchedBy: segments.length ? (settled ? "settings" : "unknown") : "start" };
        segments.push(current);
        lastModel = event.model;
      }
      current.turns += 1;
      current.to = Math.max(current.to, event.at);
      continue;
    }
    if (!current) continue;
    current.to = Math.max(current.to, event.at);
    if (event.kind === "complete") { current.completed += 1; current.lastEnd = "complete"; }
    if (event.kind === "abort") { current.aborted += 1; current.lastEnd = "abort"; }
  }
  if (!segments.length) return null;
  return {
    partial,
    segments: segments.map((segment, index) => ({
      model: segment.model,
      from: new Date(segment.from).toISOString(),
      to: new Date(segment.to).toISOString(),
      turns: segment.turns,
      completed: segment.completed,
      aborted: segment.aborted,
      ended: segment.lastEnd === "abort" ? "aborted" : segment.lastEnd === "complete" ? "complete" : "open",
      switchedBy: segment.switchedBy,
      current: index === segments.length - 1,
    })),
  };
}

function toolsFrom(rows, { openTurn, limit }) {
  const calls = [];
  const outputs = new Map();
  for (const row of rows) {
    if (row?.type !== "response_item") continue;
    const payload = row.payload ?? {};
    if (payload.type === "function_call" || payload.type === "custom_tool_call") {
      calls.push({ at: time(row.timestamp), callId: text(payload.call_id), name: text(payload.name), args: payload.type === "custom_tool_call" ? payload.input : payload.arguments });
    } else if (payload.type === "function_call_output" || payload.type === "custom_tool_call_output") {
      outputs.set(text(payload.call_id), { at: time(row.timestamp), output: payload.output });
    }
  }
  const recent = calls.slice(-limit);
  return recent.map((call, index) => {
    const done = outputs.get(call.callId);
    const described = describeTool(call.name, call.args);
    const outcome = done ? outputOutcome(done.output) : null;
    const isLast = index === recent.length - 1;
    const status = outcome ? (outcome.failed ? "failed" : "ok") : openTurn && isLast ? "running" : "unknown";
    return {
      id: call.callId || `${call.name}:${call.at}`,
      name: call.name,
      verb: described.verb,
      object: described.object,
      mono: described.mono,
      title: described.title,
      diff: described.diff ?? null,
      args: flat(typeof call.args === "string" ? call.args : JSON.stringify(call.args ?? ""), 240),
      result: outcome?.result ?? "",
      exit: outcome?.exit ?? null,
      status,
      at: call.at ? new Date(call.at).toISOString() : "",
      durationMs: done && call.at ? Math.max(0, done.at - call.at) : null,
    };
  });
}

export function extractCodexTelemetry(rows, { openTurn = false, partial = false, toolLimit = 6 } = {}) {
  const merged = dedupe(rows);
  return {
    context: contextFrom(merged),
    models: modelsFrom(merged, { partial }),
    tools: toolsFrom(merged, { openTurn, limit: toolLimit }),
  };
}

export function shortModel(model) {
  return text(model).replace(/^(?:auto|commandcode)\//, "").replace(/^deepseek\//, "");
}

export function formatTokens(value) {
  const count = Number(value) || 0;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(count >= 10_000_000 ? 0 : 1)}M`;
  if (count >= 10_000) return `${Math.round(count / 1000)}k`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

export function formatDuration(ms) {
  if (ms == null) return "";
  if (ms < 1000) return `${Math.max(1, Math.round(ms))}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m${String(Math.round(seconds % 60)).padStart(2, "0")}s`;
}

export function switchReason(segments = []) {
  const index = segments.length - 1;
  if (index < 1) return "";
  const previous = segments[index - 1];
  const current = segments[index];
  const from = shortModel(previous.model);
  const to = shortModel(current.model);
  if (previous.ended === "aborted") return `${from} 最后一轮被中断，之后换成 ${to}。`;
  if (current.switchedBy === "settings") return `会话设置里改了模型：${from} → ${to}。`;
  return `${from} 之后换成 ${to}，会话里没有写原因。`;
}
