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

import { firstSentence } from "./board-text-model.mjs";

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

const base = (value) => text(value).split("/").filter(Boolean).pop() ?? "";
const shortId = (value) => text(value).replace(/^mcp:/, "").slice(0, 8);
const prNumber = (url) => /\/pull\/(\d+)/.exec(text(url))?.[1];
const minutes = (ms) => {
  const value = Number(ms);
  if (!(value > 0)) return "";
  return value >= 60_000 ? `${Math.round(value / 60_000)} 分钟` : `${Math.round(value / 1000)} 秒`;
};

function commandSentence(cmd) {
  const line = commandObject(cmd);
  const words = line.split(/\s+/);
  const head = words[0] ?? "";
  const lastFile = [...words].reverse().find((word) => /[\w-]+\.[\w]+$/.test(word) && !word.startsWith("-"));
  if (/^(?:sed|cat|head|tail|less|wc|nl)$/.test(head)) return lastFile ? `读 ${base(lastFile)}` : "读文件";
  if (head === "node" && /\.(?:mjs|js|cjs|ts)$/.test(words[1] ?? "")) return `跑脚本：${base(words[1])}`;
  if (/^(?:rg|grep|ag)$/.test(head)) {
    const rest = line.replace(/^\S+\s+/, "");
    const pattern = /(['"])(.*?)\1/.exec(rest)?.[2] ?? words.slice(1).find((word) => !word.startsWith("-"));
    return pattern ? `搜「${flat(pattern.replace(/^["']|["']$/g, ""), 28)}」` : "搜内容";
  }
  if (/^(?:ls|find|tree)$/.test(head)) return "看目录";
  if (head === "git") return `git ${words.slice(1, 3).filter((word) => !word.startsWith("-")).join(" ")}`.trim();
  if (head === "gh") return `GitHub：${words.slice(1, 3).join(" ")}`;
  if (/(?:npm|pnpm|yarn) (?:run )?test|node --test|vitest|jest|pytest/.test(line)) return "跑测试";
  if (/(?:npm|pnpm|yarn) run build|vite build/.test(line)) return "构建";
  return `跑命令：${flat(line, 48)}`;
}

// One plain sentence per call (R-43): what the call did, in words. The raw JSON stays folded.
export function toolSentence(name, rawArgs) {
  const toolName = text(name);
  const args = parseJson(rawArgs) ?? {};
  const count = (value) => (Array.isArray(value) ? value.length : 0);
  switch (toolName) {
    case "exec_command":
    case "_codex_exec":
      return commandSentence(args.cmd ?? rawArgs);
    case "apply_patch": {
      const patch = patchSummary(typeof rawArgs === "string" ? rawArgs : "");
      if (!patch.files.length) return "改文件";
      return `改 ${patch.files.length} 个文件：${[...new Set(patch.files)].slice(0, 2).join("、")}${patch.files.length > 2 ? " 等" : ""}`;
    }
    case "update_plan": {
      const plan = Array.isArray(args.plan) ? args.plan : [];
      const done = plan.filter((step) => step?.status === "completed").length;
      return plan.length ? `更新计划：${plan.length} 步，做完 ${done} 步` : "更新计划";
    }
    case "view_image": return `看一张图：${base(args.path) || "图片"}`;
    case "write_stdin":
      return text(args.chars) ? `给命令输入「${flat(args.chars, 24)}」` : `等命令输出${minutes(args.yield_time_ms) ? `，最多 ${minutes(args.yield_time_ms)}` : ""}`;
    case "wait_threads": {
      const n = count(args.targets) || count(args.threadIds) || count(args.ids);
      const limit = minutes(args.timeout_ms ?? args.timeoutMs ?? (args.timeout_seconds ?? args.timeoutSeconds) * 1000);
      return `等 ${n || "几"} 条线${limit ? `，${limit}超时` : ""}`;
    }
    case "wait": return "等结果";
    case "list_threads": return `列出最近 ${args.limit ?? ""} 条线`.replace("最近  条", "最近的");
    case "read_thread": return `读线 ${shortId(args.threadId)} 的最近 ${args.turnLimit ?? 1} 轮`;
    case "read_thread_terminal": return "读线程终端";
    case "send_message_to_thread": return `给线 ${shortId(args.threadId)} 发话：${firstSentence(args.prompt, 32) || "（空）"}`;
    case "create_thread":
    case "spawn_agent": return `开新线${text(args.title) ? `：${flat(args.title, 32)}` : ""}`;
    case "watch_pull_request": return prNumber(args.url) ? `盯 PR #${prNumber(args.url)}` : "盯 PR";
    case "unwatch_pull_request": return prNumber(args.url) ? `不再盯 PR #${prNumber(args.url)}` : "不再盯 PR";
    case "list_thread_pull_requests": return "列出这条线的 PR";
    case "web_search": return `搜：${flat(args.query ?? args.q, 40)}`;
    case "js":
    case "js_repl": return text(args.title) ? `跑脚本：${flat(args.title, 40)}` : "跑脚本";
    default: {
      if (toolName.startsWith("mcp__")) {
        const [server, tool] = toolName.replace(/^mcp__/, "").split("__");
        return `调用 ${server}${tool ? ` · ${tool}` : ""}`;
      }
      return text(args.title) ? `${toolName}：${flat(args.title, 40)}` : toolName || "工具";
    }
  }
}

export function toolKind(name) {
  const toolName = text(name);
  if (toolName === "exec_command" || toolName === "_codex_exec" || toolName === "write_stdin") return "shell";
  if (toolName === "apply_patch") return "edit";
  if (toolName === "view_image") return "image";
  if (toolName === "web_search") return "search";
  if (toolName === "update_plan") return "plan";
  if (/thread|wait|spawn_agent/.test(toolName)) return "thread";
  if (/pull_request/.test(toolName)) return "pr";
  if (toolName === "js" || toolName === "js_repl") return "script";
  return "tool";
}

function rawText(value, limit = 900) {
  const parsed = parseJson(value);
  const body = parsed ? JSON.stringify(parsed, null, 2) : text(value);
  return body.length > limit ? `${body.slice(0, limit - 1)}…` : body;
}

function planFrom(calls) {
  const last = [...calls].reverse().find((call) => call.name === "update_plan");
  const plan = parseJson(last?.args)?.plan;
  if (!Array.isArray(plan) || !plan.length) return null;
  const steps = plan.map((step) => ({ step: flat(step?.step, 80), status: ["completed", "in_progress"].includes(step?.status) ? step.status : "pending" }));
  return {
    total: steps.length,
    done: steps.filter((step) => step.status === "completed").length,
    current: steps.find((step) => step.status === "in_progress")?.step ?? "",
    steps,
    at: last.at ? new Date(last.at).toISOString() : "",
  };
}

function outputText(output) {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return output.map((part) => text(part?.text)).filter(Boolean).join("\n");
  return "";
}

function structuredLine(body) {
  const trimmed = text(body).trim();
  if (!/^[\[{]/.test(trimmed)) return "";
  if (trimmed.startsWith("[")) return "返回一个列表。";
  const keys = [...trimmed.matchAll(/["']([^"'\n]{1,24})["']\s*:/g)].map((match) => match[1]);
  const unique = [...new Set(keys)];
  return unique.length
    ? `返回结构化结果：${unique.slice(0, 3).join("、")} 等 ${unique.length} 个字段。`
    : "返回一段结构化结果。";
}

function outputOutcome(raw) {
  const body = outputText(raw);
  const code = /Process exited with code (-?\d+)/.exec(body);
  const exit = code ? Number(code[1]) : /"exit_code":\s*(-?\d+)/.exec(body)?.[1];
  const failed = (exit !== undefined && Number(exit) !== 0) || /^\s*(apply_patch verification failed|error:)/i.test(body);
  const trimmed = body.includes("\nOutput:\n") ? body.slice(body.indexOf("\nOutput:\n") + 9) : body.replace(/^Output:\s*\n/, "");
  return { failed, result: flat(trimmed, 220), raw: rawText(trimmed), line: structuredLine(trimmed) || firstSentence(trimmed, 80), exit: exit === undefined ? null : Number(exit) };
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

function callsFrom(rows) {
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
  return { calls, outputs };
}

function toolsFrom({ calls, outputs }, { openTurn, limit }) {
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
      kind: toolKind(call.name),
      summary: toolSentence(call.name, call.args),
      args: rawText(typeof call.args === "string" ? call.args : JSON.stringify(call.args ?? "")),
      result: outcome?.raw ?? "",
      resultLine: outcome?.line ?? "",
      exit: outcome?.exit ?? null,
      status,
      at: call.at ? new Date(call.at).toISOString() : "",
      durationMs: done && call.at ? Math.max(0, done.at - call.at) : null,
    };
  });
}

export function extractCodexTelemetry(rows, { openTurn = false, partial = false, toolLimit = 6 } = {}) {
  const merged = dedupe(rows);
  const read = callsFrom(merged);
  return {
    context: contextFrom(merged),
    models: modelsFrom(merged, { partial }),
    tools: toolsFrom(read, { openTurn, limit: toolLimit }),
    plan: planFrom(read.calls),
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
