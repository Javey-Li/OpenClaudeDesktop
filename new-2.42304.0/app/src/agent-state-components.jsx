import React, { useEffect, useMemo, useState } from "react";
import { Tooltip } from "./arc/tooltip/tooltip";
import { Check, ChevronDown, ChevronRight, Code2, FilePenLine, GitPullRequest, Image, ListChecks, MessagesSquare, Search, SquareTerminal, Wrench } from "lucide-react";
import { relativeLabel } from "./board-view-model.mjs";
import { contextTone } from "./board-agent-model.mjs";
import { LINE_STATE_LABEL } from "./board-levels-model.mjs";
import { formatDuration, formatTokens, shortModel, switchReason } from "./board-telemetry-model.mjs";
import "./agent-state.css";

export const SOURCE_LABELS = { codex: "Codex", superagent: "Superagent", t3: "T3" };
const PART_LABEL = { cached: "已缓存输入", fresh: "新输入", output: "输出" };
const KIND_ICON = { shell: SquareTerminal, edit: FilePenLine, image: Image, search: Search, plan: ListChecks, thread: MessagesSquare, pr: GitPullRequest, script: Code2, tool: Wrench };

function ToolKindIcon({ kind, size = 13 }) {
  const Glyph = KIND_ICON[kind] ?? Wrench;
  return <Glyph size={size} strokeWidth={1.8} aria-hidden="true" />;
}

function clock(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/* C03: height eases with grid rows; content stays mounted once opened. */
export function Collapse({ open, children }) {
  const [seen, setSeen] = useState(open);
  useEffect(() => { if (open) setSeen(true); }, [open]);
  return <div className="psa-collapse" data-open={open || undefined}>
    <div className="psa-collapse-inner" inert={!open}>{seen ? children : null}</div>
  </div>;
}

/* B14: one short morph when the state changes; still otherwise. */
export function StateGlyph({ state, size = 16 }) {
  return <svg className="psa-glyph" data-state={state} viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
    <circle className="psa-glyph-ring" cx="8" cy="8" r="6.25" pathLength="40" />
    <circle className="psa-glyph-core" cx="8" cy="8" r="2.1" />
    <path className="psa-glyph-check" d="M5.1 8.3l2.1 2.1 3.8-4.1" pathLength="10" />
    <path className="psa-glyph-bang" d="M8 4.7v3.9" pathLength="4" />
    <circle className="psa-glyph-bang-dot" cx="8" cy="11.2" r=".7" />
  </svg>;
}

export function StateChip({ state }) {
  return <span className="psa-chip" data-state={state}><i aria-hidden="true" />{LINE_STATE_LABEL[state] ?? state}</span>;
}

/* A12 Context Window: a small meter for cards, real counts from the line's last model call. */
export function ContextWindow({ context }) {
  if (!context) return null;
  const percent = context.percent < 1 ? "<1%" : `${Math.round(context.percent)}%`;
  const detail = `上下文 ${formatTokens(context.used)} / ${formatTokens(context.window)}`;
  return <Tooltip content={detail}>
    <span className="psa-ctxwin" data-tone={contextTone(context.percent)} aria-label={`${detail}，${percent}`}>
      <span className="psa-ctxwin-bar" aria-hidden="true"><i style={{ width: `${Math.max(3, context.percent)}%` }} /></span>
      <b>{percent}</b>
    </span>
  </Tooltip>;
}

/* A08 Context Map: area, not a percentage. Blocks are the token types the session reported; free space is hatched. */
export function ContextMap({ context }) {
  if (!context) {
    return <figure className="psa-ctxmap" data-empty>
      <figcaption><span className="psa-fig-title"><i className="psa-fig-mark" aria-hidden="true" />上下文</span></figcaption>
      <p className="psa-muted">这条线没有上下文读数，所以画不出上下文地图。</p>
    </figure>;
  }
  const parts = ["cached", "fresh", "output"].map((id) => ({ id, value: context.parts[id] })).filter((part) => part.value > 0);
  const free = Math.max(0, context.window - context.used);
  const percent = context.percent < 1 ? "<1%" : `${Math.round(context.percent)}%`;
  return <figure className="psa-ctxmap">
    <figcaption>
      <span className="psa-fig-title"><i className="psa-fig-mark" aria-hidden="true" />上下文</span>
      <span className="psa-ctxmap-total"><b>{formatTokens(context.used)}</b> / {formatTokens(context.window)}<em data-tone={contextTone(context.percent)}>{percent}</em></span>
    </figcaption>
    <div className="psa-ctxmap-field" role="img" aria-label={`窗口 ${formatTokens(context.window)}，已用 ${formatTokens(context.used)}，空余 ${formatTokens(free)}`}>
      <div className="psa-ctxmap-used" style={{ flexGrow: Math.max(context.used, context.window * 0.18) }}>
        {parts.map((part) => <span key={part.id} className="psa-ctxmap-block" data-part={part.id} style={{ flexGrow: part.value }}>
          <b>{PART_LABEL[part.id]}</b>
          <em>{formatTokens(part.value)}</em>
        </span>)}
      </div>
      <span className="psa-ctxmap-free" style={{ flexGrow: free }}><em>空余 {formatTokens(free)}</em></span>
    </div>
    <p className="psa-fig-note">按 token 类型分，读数来自最后一次模型调用{context.reasoning ? `；输出里含 ${formatTokens(context.reasoning)} 推理` : ""}。</p>
  </figure>;
}

/* A07 Fallback Chain, linear: which model, for how long, and why it changed. */
export function FallbackChain({ models }) {
  const segments = models?.segments ?? [];
  if (!segments.length) {
    return <figure className="psa-chain" data-empty>
      <figcaption><span className="psa-fig-title"><i className="psa-fig-mark" data-shape="chain" aria-hidden="true" />模型回退链</span></figcaption>
      <p className="psa-muted">这条线没有模型记录。</p>
    </figure>;
  }
  const single = segments.length === 1;
  return <figure className="psa-chain">
    <figcaption>
      <span className="psa-fig-title"><i className="psa-fig-mark" data-shape="chain" aria-hidden="true" />模型回退链</span>
      {models.partial && <span className="psa-fig-aside">会话很长，只读了头尾</span>}
    </figcaption>
    <ol className="psa-chain-list">
      {segments.map((segment) => <li key={`${segment.model}:${segment.from}`} className="psa-chain-node"
        data-current={segment.current || undefined} data-ended={segment.ended}>
        <i className="psa-chain-dot" aria-hidden="true" />
        <span className="psa-chain-text">
          <b>{shortModel(segment.model)}</b>
          <em>{[segment.turns != null ? `${segment.turns} 轮` : "", segment.aborted ? `${segment.aborted} 次中断` : "", `${clock(segment.from)}–${clock(segment.to)}`].filter(Boolean).join(" · ")}</em>
        </span>
        {segment.current && <span className="psa-chain-now">当前</span>}
      </li>)}
    </ol>
    <p className="psa-fig-note">{single ? `一直是 ${shortModel(segments[0].model)}，没换过。` : switchReason(segments)}</p>
  </figure>;
}

function ToolStatus({ status }) {
  if (status === "running") return <span className="psa-tool-status" data-status="running" aria-label="在跑"><i /><i /><i /></span>;
  if (status === "failed") return <span className="psa-tool-status" data-status="failed">失败</span>;
  if (status === "unknown") return <span className="psa-tool-status" data-status="unknown">没等到结果</span>;
  return null;
}

/* B01 Tool Call Card: one plain sentence per call; the raw JSON is folded twice deep. */
export function ToolCallRow({ tool }) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState(false);
  const time = tool.status === "ok" ? formatDuration(tool.durationMs) : "";
  const exit = tool.name === "exec_command" || tool.name === "_codex_exec" ? tool.exit : null;
  const result = tool.status === "failed"
    ? `没成功${tool.exit != null ? `（退出码 ${tool.exit}）` : ""}${tool.resultLine ? `：${tool.resultLine}` : "。"}`
    : tool.resultLine || (tool.status === "running" ? "还在跑。" : tool.status === "unknown" ? "这次调用没留下结果。" : "完成，没有输出。");
  return <li className="psa-tool" data-status={tool.status} data-open={open || undefined}>
    <button type="button" className="psa-tool-head" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span className="psa-tool-icon" aria-hidden="true"><ToolKindIcon kind={tool.kind} /></span>
      <span className="psa-tool-say">{tool.summary || tool.verb}</span>
      {tool.status !== "running" && tool.resultLine && <span className="psa-tool-result">{tool.resultLine}</span>}
      {tool.diff && <span className="psa-tool-diff"><i data-sign="add">+{tool.diff.add}</i><i data-sign="del">−{tool.diff.del}</i></span>}
      {exit != null && <span className="psa-tool-exit" data-ok={exit === 0 || undefined}>{exit === 0 ? `退出 ${exit}` : `退出码 ${exit}`}</span>}
      <ToolStatus status={tool.status} />
      {time && <span className="psa-tool-time">{time}</span>}
      <ChevronDown size={11} className="psa-tool-caret" strokeWidth={1.8} />
    </button>
    <Collapse open={open}>
      <div className="psa-tool-body">
        {tool.title && tool.title !== tool.summary && <p><span>为什么</span>{tool.title}</p>}
        <p><span>结果</span>{result}</p>
        <button type="button" className="psa-tool-raw-toggle" aria-expanded={raw} onClick={() => setRaw(!raw)}>
          {raw ? <ChevronDown size={10} /> : <ChevronRight size={10} />}{raw ? "收起原始参数和结果" : "看原始参数和结果"}
        </button>
        <Collapse open={raw}>
          <div className="psa-tool-raw">
            <span>参数 · {tool.name}</span>
            <pre>{tool.args || "—"}</pre>
            <span>结果</span>
            <pre>{tool.result || "没有记录"}</pre>
          </div>
        </Collapse>
      </div>
    </Collapse>
  </li>;
}

export function ToolCallGroup({ tools, source }) {
  const kinds = useMemo(() => [...new Set((tools ?? []).map((tool) => tool.kind ?? "tool"))], [tools]);
  if (!tools?.length) {
    return <p className="psa-muted">{source === "codex" ? "这条会话里没读到工具调用。" : `${SOURCE_LABELS[source] ?? source} 不留工具调用记录，只有 Codex 会话有。`}</p>;
  }
  const failed = tools.filter((tool) => tool.status === "failed").length;
  const running = tools.some((tool) => tool.status === "running");
  const total = tools.reduce((sum, tool) => sum + (tool.durationMs ?? 0), 0);
  return <section className="psa-toolgroup" aria-label="工具调用">
    <header className="psa-toolgroup-head">
      <span className="psa-toolgroup-stack" aria-hidden="true">
        {kinds.slice(0, 4).map((kind) => <i key={kind}><ToolKindIcon kind={kind} size={11} /></i>)}
      </span>
      <b>{running ? "正在用工具" : `用了 ${kinds.length} 种工具`}</b>
      <em>最近 {tools.length} 次{total ? ` · ${formatDuration(total)}` : ""}{failed ? ` · ${failed} 次失败` : ""}</em>
    </header>
    <ol className="psa-toollist">{tools.map((tool) => <ToolCallRow key={tool.id} tool={tool} />)}</ol>
  </section>;
}

/* B09 Todo list: the line's own plan, with the step in progress marked. */
export function PlanSteps({ plan }) {
  if (!plan?.steps?.length) return null;
  return <ol className="psa-plan" aria-label={`计划 ${plan.done}/${plan.total}`}>
    {plan.steps.map((step, index) => <li key={`${index}:${step.step}`} data-status={step.status}>
      <i aria-hidden="true">{step.status === "completed" ? <Check size={10} strokeWidth={2.2} /> : null}</i>
      <span>{step.step}</span>
    </li>)}
  </ol>;
}

/* A01 Agent Monitor: what this line is doing now, from its own records. */
export function LineMonitor({ line, now }) {
  const running = line.state === "running";
  const lastTool = line.tools?.length ? line.tools[line.tools.length - 1] : null;
  const step = running && lastTool ? lastTool.summary : line.progress?.current || "";
  const model = line.models?.segments?.find((segment) => segment.current)?.model;
  const when = relativeLabel(line.at, now);
  return <section className="psa-monitor" data-state={line.state}>
    <div className="psa-monitor-pill">
      <StateGlyph state={line.state} size={18} />
      <span className="psa-monitor-label">{running ? "此刻" : LINE_STATE_LABEL[line.state]}</span>
      <p className="psa-monitor-step" data-live={running || undefined}>{step || line.summary}</p>
      {when && <span className="psa-monitor-time">{when}</span>}
    </div>
    <dl className="psa-monitor-facts">
      <div><dt>进度</dt><dd>{line.progress?.label || "—"}</dd></div>
      {model && <div><dt>模型</dt><dd>{shortModel(model)}</dd></div>}
      {line.context && <div><dt>上下文</dt><dd>{line.context.percent < 1 ? "<1" : Math.round(line.context.percent)}%</dd></div>}
    </dl>
    {line.progress?.kind === "plan" && <div className="psa-monitor-bar" aria-hidden="true"><i style={{ width: `${Math.round(line.progress.ratio * 100)}%` }} /></div>}
    <PlanSteps plan={line.progress?.kind === "plan" ? line.plan : null} />
  </section>;
}
