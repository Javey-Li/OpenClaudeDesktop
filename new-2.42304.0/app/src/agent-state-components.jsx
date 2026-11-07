import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Badge } from "./arc/badge/badge";
import { Tooltip } from "./arc/tooltip/tooltip";
import SegmentedControl from "./arc/segmented-control/segmented-control";
import { Icon } from "./icons";
import { relativeLabel } from "./board-view-model.mjs";
import { INBOX_FILTERS, contextTone, filterInbox } from "./board-agent-model.mjs";
import { formatDuration, formatTokens, shortModel, switchReason } from "./board-telemetry-model.mjs";
import "./agent-state.css";

const SOURCE_LABELS = { codex: "Codex", superagent: "Superagent", t3: "T3" };
const STATE_LABEL = { decide: "要你定", stuck: "卡住", waiting: "等你", running: "在跑", done: "收口" };
const STATE_TONE = { decide: "warning", stuck: "danger", waiting: "warning", running: "info", done: "success" };
const PART_LABEL = { cached: "已缓存输入", fresh: "新输入", output: "输出" };

function reducedMotion() {
  return typeof window !== "undefined"
    && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.reduceMotion === "true");
}

function clock(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/* C03 (transition-behavior / discrete show-hide): content stays mounted once opened and the row height eases with grid-rows. */
function Collapse({ open, children }) {
  const [seen, setSeen] = useState(open);
  useEffect(() => { if (open) setSeen(true); }, [open]);
  return <div className="psa-collapse" data-open={open || undefined}>
    <div className="psa-collapse-inner" inert={!open}>{seen ? children : null}</div>
  </div>;
}

/* B14 / A02: a state change gets one short morph of the mark. A row that stays in the same state never moves. */
export function StateGlyph({ state }) {
  return <svg className="psa-glyph" data-state={state} viewBox="0 0 16 16" aria-hidden="true">
    <circle className="psa-glyph-ring" cx="8" cy="8" r="6.25" pathLength="40" />
    <circle className="psa-glyph-core" cx="8" cy="8" r="2.1" />
    <path className="psa-glyph-check" d="M5.1 8.3l2.1 2.1 3.8-4.1" pathLength="10" />
    <path className="psa-glyph-bang" d="M8 4.7v3.9" pathLength="4" />
    <circle className="psa-glyph-bang-dot" cx="8" cy="11.2" r=".7" />
  </svg>;
}

/* A02 scrolling count: the digit slides once when the number changes, never on mount. */
export function RollNumber({ value }) {
  const [shown, setShown] = useState({ value, direction: null });
  if (shown.value !== value) setShown({ value, direction: value > shown.value ? "up" : "down" });
  return <span className="psa-roll" key={shown.value} data-direction={shown.direction ?? undefined}>{shown.value}</span>;
}

/* A02 "the row slides to its new position": only runs when the order changed, not on expand or filter switches. */
function useListSlide(signature, token) {
  const nodes = useRef(new Map());
  const offsets = useRef(new Map());
  const last = useRef(null);
  useLayoutEffect(() => {
    const next = new Map();
    for (const [key, node] of nodes.current) next.set(key, node.offsetTop);
    const before = last.current;
    if (before && before.signature !== signature && before.token === token && !reducedMotion()) {
      for (const [key, node] of nodes.current) {
        const from = offsets.current.get(key);
        const to = next.get(key);
        if (from == null || to == null || Math.abs(from - to) < 2) continue;
        node.animate([{ transform: `translateY(${from - to}px)` }, { transform: "translateY(0)" }],
          { duration: 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
      }
    }
    offsets.current = next;
    last.current = { signature, token };
  });
  return (key) => (node) => { if (node) nodes.current.set(key, node); else nodes.current.delete(key); };
}

/* A12 Context Window: one low-key meter, real counts from the session's last model call. */
export function ContextWindow({ context, compact = false }) {
  if (!context) return compact ? null : <span className="psa-muted">这条线没有上下文读数。</span>;
  const tone = contextTone(context.percent);
  const percent = context.percent < 1 ? "<1%" : `${Math.round(context.percent)}%`;
  const { parts } = context;
  const detail = `${formatTokens(context.used)} / ${formatTokens(context.window)} tokens · 已缓存输入 ${formatTokens(parts.cached)} · 新输入 ${formatTokens(parts.fresh)} · 输出 ${formatTokens(parts.output)}`;
  return <Tooltip content={detail}>
    <span className="psa-ctxwin" data-tone={tone} data-compact={compact || undefined} aria-label={`上下文已用 ${percent}，${detail}`}>
      {!compact && <span className="psa-ctxwin-label">上下文</span>}
      <span className="psa-ctxwin-bar" aria-hidden="true"><i style={{ width: `${Math.max(2, context.percent)}%` }} /></span>
      <b>{percent}</b>
    </span>
  </Tooltip>;
}

/* A08 Context Map: area, not just a percentage. Blocks are token types the session reported, not content categories. */
export function ContextMap({ context }) {
  if (!context) return <p className="psa-muted">这条线没有上下文读数，所以画不出上下文地图。</p>;
  const parts = ["cached", "fresh", "output"].map((id) => ({ id, value: context.parts[id] })).filter((part) => part.value > 0);
  const free = Math.max(0, context.window - context.used);
  return <figure className="psa-ctxmap">
    <figcaption>
      <span>上下文地图</span>
      <em>{formatTokens(context.used)} / {formatTokens(context.window)} · {context.percent < 1 ? "<1" : Math.round(context.percent)}%</em>
    </figcaption>
    <div className="psa-ctxmap-window" role="img" aria-label={`窗口 ${formatTokens(context.window)}，已用 ${formatTokens(context.used)}，空余 ${formatTokens(free)}`}>
      <span className="psa-ctxmap-used" data-tone={contextTone(context.percent)} style={{ flexGrow: Math.max(context.used, context.window * 0.012) }} />
      <span className="psa-ctxmap-free" style={{ flexGrow: free }}><em>空余 {formatTokens(free)}</em></span>
    </div>
    <div className="psa-ctxmap-blocks">
      {parts.map((part) => <span key={part.id} className="psa-ctxmap-block" data-part={part.id} style={{ flexGrow: part.value }}>
        <b>{PART_LABEL[part.id]}</b>
        <em>{formatTokens(part.value)}</em>
      </span>)}
    </div>
    <p className="psa-ctxmap-note">
      按 token 类型分，不是按内容分类。读数来自会话最后一次模型调用{context.reasoning ? `，输出里含 ${formatTokens(context.reasoning)} 推理` : ""}。
    </p>
  </figure>;
}

/* A07 Fallback Chain, linear: which model, how long, and why it changed. */
export function FallbackChain({ models }) {
  const segments = models?.segments ?? [];
  if (!segments.length) return <p className="psa-muted">这条线没有模型记录。</p>;
  const single = segments.length === 1;
  return <figure className="psa-chain">
    <figcaption>
      <span>模型回退链</span>
      {models.partial && <em>会话很长，只读了头尾</em>}
    </figcaption>
    <ol className="psa-chain-list">
      {segments.map((segment, index) => <li key={`${segment.model}:${segment.from}`} data-current={segment.current || undefined} data-ended={segment.ended}>
        <Tooltip content={`${segment.model} · ${clock(segment.from)}–${clock(segment.to)}`}>
          <span className="psa-chain-node">
            <i aria-hidden="true" />
            <b>{shortModel(segment.model)}</b>
            <em>
              {[segment.turns ? `${segment.turns} 轮` : "", segment.aborted ? `${segment.aborted} 次中断` : "", segment.current ? "当前" : ""]
                .filter(Boolean).join(" · ") || clock(segment.from)}
            </em>
          </span>
        </Tooltip>
        {index < segments.length - 1 && <span className="psa-chain-link" aria-hidden="true" />}
      </li>)}
    </ol>
    <p className="psa-chain-why">{single ? `一直是 ${shortModel(segments[0].model)}，没换过。` : switchReason(segments)}</p>
  </figure>;
}

function ToolMark({ status }) {
  if (status === "ok") return <Icon name="Check" size={13} className="psa-tool-mark" data-status="ok" />;
  if (status === "failed") return <Icon name="WarningCircle" size={13} className="psa-tool-mark" data-status="failed" />;
  if (status === "running") return <span className="psa-tool-mark psa-tool-dots" data-status="running" aria-label="在跑"><i /><i /><i /></span>;
  return <span className="psa-tool-mark" data-status="unknown" aria-label="没有结果">–</span>;
}

/* B01 Tool Call Card: one line per call, opens to arguments and result. */
export function ToolCallCard({ tool }) {
  const [open, setOpen] = useState(false);
  const time = tool.status === "failed" ? (tool.exit != null ? `失败 · exit ${tool.exit}` : "失败")
    : tool.status === "running" ? "在跑" : tool.status === "unknown" ? "没等到结果" : formatDuration(tool.durationMs);
  return <div className="psa-tool" data-status={tool.status} data-open={open || undefined}>
    <button type="button" className="psa-tool-head" aria-expanded={open} onClick={() => setOpen(!open)}>
      <ToolMark status={tool.status} />
      <span className="psa-tool-label">
        <b>{tool.verb}</b>
        {tool.object && <span className={tool.mono ? "psa-mono" : undefined}>{tool.object}</span>}
      </span>
      {tool.diff && <span className="psa-tool-diff"><i data-sign="add">+{tool.diff.add}</i><i data-sign="del">−{tool.diff.del}</i></span>}
      <span className="psa-tool-time">{time}</span>
      <Icon name="CaretRight" size={11} className="psa-tool-caret" />
    </button>
    <Collapse open={open}>
      <dl className="psa-tool-body">
        {tool.title && <><dt>目的</dt><dd>{tool.title}</dd></>}
        <dt>参数</dt><dd className="psa-mono">{tool.args || "—"}</dd>
        <dt>结果</dt><dd className="psa-mono">{tool.result || (tool.status === "running" ? "还在跑" : "没有记录")}</dd>
      </dl>
    </Collapse>
  </div>;
}

export function ToolCallGroup({ tools, source }) {
  if (!tools?.length) {
    return <p className="psa-muted">{source === "codex" ? "这条会话里没读到工具调用。" : `${SOURCE_LABELS[source] ?? source} 不留工具调用记录，只有 Codex 会话有。`}</p>;
  }
  const failed = tools.filter((tool) => tool.status === "failed").length;
  const running = tools.filter((tool) => tool.status === "running").length;
  const ok = tools.filter((tool) => tool.status === "ok").length;
  return <section className="psa-toolgroup" aria-label="工具调用">
    <header>
      <span>最近 {tools.length} 次调用</span>
      <em>{[ok ? `${ok} 完成` : "", failed ? `${failed} 失败` : "", running ? `${running} 在跑` : ""].filter(Boolean).join(" · ")}</em>
    </header>
    {tools.map((tool) => <ToolCallCard key={tool.id} tool={tool} />)}
  </section>;
}

/* A01 Agent Monitor: what this thread is doing right now, from the thread's own records. */
export function AgentMonitor({ item, now, onOpenLink }) {
  const [copied, setCopied] = useState(false);
  const model = item.models?.segments?.find((segment) => segment.current)?.model;
  const bare = !item.tools?.length && !item.context && !item.models?.segments?.length;
  const copy = async () => {
    try { await navigator.clipboard.writeText(item.threadId); setCopied(true); window.setTimeout(() => setCopied(false), 1400); } catch { /* clipboard blocked */ }
  };
  return <div className="psa-monitor">
    <p className="psa-monitor-facts">
      <span>{SOURCE_LABELS[item.source] ?? item.source}</span>
      <span>{item.project}</span>
      {model && <span>{shortModel(model)}</span>}
      <span>{relativeLabel(item.at, now)}</span>
      {item.pastReason && <span>{item.pastReason}</span>}
    </p>
    {item.detail && <p className="psa-monitor-last">{item.detail}</p>}
    {bare ? <p className="psa-muted">{SOURCE_LABELS[item.source] ?? item.source} 这条线只留状态：没有工具调用、上下文和模型记录。</p> : <>
      <ToolCallGroup tools={item.tools} source={item.source} />
      <div className="psa-monitor-pair">
        <ContextMap context={item.context} />
        <FallbackChain models={item.models} />
      </div>
    </>}
    <div className="psa-monitor-actions">
      {item.threadId && <button type="button" onClick={copy}><Icon name="Copy" size={12} />{copied ? "已复制" : "复制线程 ID"}</button>}
      {item.href && <button type="button" onClick={() => onOpenLink?.(item.href)}><Icon name="ArrowUpRight" size={12} />打开原页面</button>}
      <span>只读 · 批准、重试要回真实会话（左侧列表或 ⌘K）</span>
    </div>
  </div>;
}

function AgentRow({ item, now, open, onToggle, onOpenLink, slideRef, past }) {
  return <article className="psa-row" ref={slideRef} data-state={item.state} data-open={open || undefined} data-past={past || undefined}>
    <button type="button" className="psa-row-head" aria-expanded={open} onClick={onToggle}>
      <StateGlyph state={item.state} />
      <span className="psa-row-main">
        <span className="psa-row-title">{item.title}</span>
        {item.step && <span className="psa-row-step" data-live={item.state === "running" || undefined}>{item.step}</span>}
      </span>
      <Badge size="sm" tone={STATE_TONE[item.state]} dot>{STATE_LABEL[item.state]}</Badge>
      <span className="psa-row-meta">
        <span>{item.project}</span>
        <span>{SOURCE_LABELS[item.source] ?? item.source}</span>
      </span>
      <span className="psa-row-ctx"><ContextWindow context={item.context} compact /></span>
      <span className="psa-row-time">{relativeLabel(item.at, now)}</span>
      <Icon name="CaretRight" size={12} className="psa-row-caret" />
    </button>
    <Collapse open={open}><AgentMonitor item={item} now={now} onOpenLink={onOpenLink} /></Collapse>
  </article>;
}

export function AgentInbox({ inbox, now, onOpenLink }) {
  const [filter, setFilter] = useState("all");
  const [openKey, setOpenKey] = useState(null);
  const [pastOpen, setPastOpen] = useState(false);
  const counts = inbox.counts;
  const attention = counts.decide + counts.stuck + counts.waiting;
  const rows = useMemo(() => filterInbox(inbox.items, filter), [inbox.items, filter]);
  const slideRef = useListSlide(rows.map((row) => `${row.key}:${row.state}`).join("|"), filter);
  const options = INBOX_FILTERS.map((entry) => ({ value: entry.id, label: entry.label }));
  const pastReasons = useMemo(() => {
    const tally = new Map();
    for (const row of inbox.past) tally.set(row.pastReason || "已过去", (tally.get(row.pastReason || "已过去") ?? 0) + 1);
    return [...tally.entries()].slice(0, 2).map(([reason, count]) => (count === 1 ? reason : `${count} 件 ${reason}`)).join(" · ");
  }, [inbox.past]);
  const empty = filter === "attention" ? "现在没有要你处理的。" : filter === "running" ? "现在没有在跑的。" : filter === "done" ? "最近 2 天没有收口的。" : "现在什么都没有。";
  return <section className="psa-inbox" aria-labelledby="psa-inbox-title">
    <header className="psa-inbox-head">
      <div>
        <span className="psb-eyebrow">Agent Inbox</span>
        <h2 id="psa-inbox-title">收件箱</h2>
      </div>
      <p className="psa-inbox-sub">{attention ? "要你处理的排在最上面。" : "没有要你处理的，下面是在跑和刚收口的。"}</p>
      <SegmentedControl label="收件箱筛选" value={filter} onValueChange={(next) => { setFilter(next); setOpenKey(null); }} options={options} />
    </header>
    <div className="psa-inbox-list">
      {rows.length === 0 ? <p className="psa-inbox-empty">{empty}</p> : rows.map((item) => <AgentRow key={item.key} item={item} now={now}
        slideRef={slideRef(item.key)} open={openKey === item.key} onToggle={() => setOpenKey(openKey === item.key ? null : item.key)} onOpenLink={onOpenLink} />)}
    </div>
    {inbox.past.length > 0 && <div className="psa-past" data-open={pastOpen || undefined}>
      <button type="button" className="psa-past-toggle" aria-expanded={pastOpen} onClick={() => setPastOpen(!pastOpen)}>
        <span>已过去</span>
        <b>{inbox.past.length} 件</b>
        <em>· {pastReasons}</em>
        <i>{pastOpen ? "收起" : "展开"}</i>
      </button>
      <Collapse open={pastOpen}>
        <div className="psa-inbox-list">
          {inbox.past.map((item) => <AgentRow key={`past:${item.key}`} item={item} now={now} past slideRef={() => {}}
            open={openKey === `past:${item.key}`} onToggle={() => setOpenKey(openKey === `past:${item.key}` ? null : `past:${item.key}`)} onOpenLink={onOpenLink} />)}
        </div>
      </Collapse>
    </div>}
  </section>;
}
