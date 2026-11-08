import React, { useMemo, useState } from "react";
import { Badge } from "./arc/badge/badge";
import { Avatar } from "./arc/avatar/avatar";
import { Progress } from "./arc/progress/progress";
import EmptyState from "./arc/empty-state/empty-state";
import { Button } from "./arc/button/button";
import { Tooltip } from "./arc/tooltip/tooltip";
import SegmentedControl from "./arc/segmented-control/segmented-control";
import { Icon } from "./icons";
import { relativeLabel } from "./board-view-model.mjs";
import { RollNumber } from "./agent-state-components.jsx";

const SOURCE_LABELS = { codex: "Codex", superagent: "Superagent", t3: "T3" };
const STATUS_LABELS = { running: "在跑", waiting: "等你", done: "收口", stuck: "卡住", suspected: "可能卡住" };
const STATUS_TONE = { running: "success", waiting: "warning", done: "success", stuck: "danger", suspected: "danger", decide: "warning" };
const SOURCE_TONE = { codex: "neutral", superagent: "info", t3: "warning" };
const SOURCE_ICON = { codex: "Terminal", superagent: "ChatCircle", t3: "Code" };
const COLUMN_LABEL = { done: "做完的", open: "没做完的", stuck: "卡住的", decide: "要定的" };
const COLUMN_TONE = { done: "success", open: "info", stuck: "danger", decide: "warning" };

export function SourceBadge({ source, outline = true }) {
  return <Badge size="sm" tone={SOURCE_TONE[source] ?? "neutral"} outline={outline}>{SOURCE_LABELS[source] ?? source}</Badge>;
}

export function StatusBadge({ status, label }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return <Badge size="sm" tone={tone} dot>{label ?? STATUS_LABELS[status] ?? status}</Badge>;
}

export function StatusBar({ totals, columns, stuckSummary, summary, past }) {
  const done = summary?.done ?? columns.done?.length ?? 0;
  const open = summary?.open ?? (totals.running ?? 0) + (totals.waiting ?? 0);
  const decide = summary?.decide ?? columns.decide?.length ?? 0;
  const stuck = summary?.stuck ?? columns.stuck?.length ?? 0;
  const total = Math.max(done + open + decide + stuck, 1);
  return <section className="psb-statusbar" aria-label="今天的局面">
    <div className="psb-statusbar-badges">
      <Badge tone="success" dot><RollNumber value={summary?.done ?? 0} /> 收口</Badge>
      <Badge tone="info" dot><RollNumber value={open} /> 在跑/等你</Badge>
      <Badge tone="warning"><RollNumber value={decide} /> 要定</Badge>
      <Badge tone="danger" dot><RollNumber value={stuck} /> 卡住</Badge>
      <Badge tone="neutral"><RollNumber value={past ?? summary?.past ?? stuckSummary?.past ?? 0} /> 已过去</Badge>
    </div>
    <div className="psb-statusbar-progress">
      <Progress value={done} max={total} label="收口进度" showValue />
    </div>
  </section>;
}

export function SourceUsage({ sources }) {
  const connected = sources.filter((source) => source.status === "connected").length;
  const total = sources.length || 3;
  return <aside className="psb-readout psb-usage-card" aria-label="来源读取">
    <div className="psb-readout-head">
      <span>来源读取</span>
      <b>{connected}<em>/{total}</em></b>
      <span className="psb-readout-word">{connected === total ? "都读到了" : "有缺口"}</span>
    </div>
    <ul className="psb-readout-list">
      {sources.map((source) => <li key={source.id} data-ok={source.status === "connected" || undefined}>
        <i />
        <span>{source.label}</span>
        <em>{source.status === "connected" ? source.detail : `没连上 · ${source.error}`}</em>
      </li>)}
    </ul>
    <p className="psb-usage-note">
      <span className="psb-usage-live" />
      只读 · 每 60 秒刷新
    </p>
  </aside>;
}

function CountBadge({ label, value, tone }) {
  return <Badge size="sm" tone={tone} outline>{value} {label}</Badge>;
}

function BriefItem({ row, now }) {
  return <div className="psb-brief-item">
    <SourceBadge source={row.source} />
    <span className="psb-brief-item-title">{row.title}</span>
    <Tooltip content={row.detail || row.title}><span className="psb-brief-item-time">{relativeLabel(row.at, now)}</span></Tooltip>
  </div>;
}

function BriefGroup({ kind, rows, now }) {
  return <div className="psb-brief-group" data-kind={kind}>
    <header>
      <span>{COLUMN_LABEL[kind]}</span>
      <Badge size="sm" tone={COLUMN_TONE[kind]}>{rows.length}</Badge>
    </header>
    <div className="psb-brief-group-rows">
      {rows.slice(0, 3).map((row) => <BriefItem key={`${row.source}:${row.id}`} row={row} now={now} />)}
      {rows.length === 0 && <span className="psb-brief-none">没有</span>}
      {rows.length > 3 && <span className="psb-brief-more">还有 {rows.length - 3} 条</span>}
    </div>
  </div>;
}

function BriefProject({ brief, now, open, onToggle }) {
  const last = brief.lastReport;
  return <div className="psb-brief-project" data-open={open || undefined} data-status={brief.status}>
    <button type="button" className="psb-brief-project-head" aria-expanded={open} onClick={onToggle}>
      <Avatar name={brief.name} size="sm" status={brief.status === "running" ? "online" : undefined} />
      <span className="psb-brief-project-name">
        <b>{brief.name}</b>
        <em>{brief.repo || brief.note || "项目"}</em>
      </span>
      <StatusBadge status={brief.status} label={brief.status === "done" ? "已收口" : undefined} />
      <span className="psb-brief-counts">
        {brief.counts.open > 0 && <CountBadge label="在跑" value={brief.counts.open} tone="info" />}
        {brief.counts.stuck > 0 && <CountBadge label="卡住" value={brief.counts.stuck} tone="danger" />}
        {brief.counts.decide > 0 && <CountBadge label="要定" value={brief.counts.decide} tone="warning" />}
      </span>
      <span className="psb-brief-last">
        {last ? <><SourceBadge source={last.source} /> <span>{last.text}</span></> : <span>还没有最后一句</span>}
      </span>
      <Icon name="CaretRight" size={12} className="psb-brief-caret" />
    </button>
    {open && <div className="psb-brief-detail">
      <BriefGroup kind="done" rows={brief.done} now={now} />
      <BriefGroup kind="open" rows={brief.open} now={now} />
      <BriefGroup kind="stuck" rows={brief.stuck} now={now} />
      <BriefGroup kind="decide" rows={brief.decide} now={now} />
    </div>}
  </div>;
}

export function BriefBoard({ briefs, summary, sources, now }) {
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState(null);
  const rows = useMemo(() => briefs.filter((brief) => filter === "all" ? true : filter === "attention" ? brief.status !== "done" : brief.status === "done"), [briefs, filter]);
  const doneRows = useMemo(() => briefs.flatMap((brief) => brief.done.map((row) => ({ ...row, projectName: brief.name }))).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)), [briefs]);
  const openRows = useMemo(() => briefs.flatMap((brief) => brief.open.map((row) => ({ ...row, projectName: brief.name }))).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)), [briefs]);
  const stuckRows = useMemo(() => briefs.flatMap((brief) => brief.stuck.map((row) => ({ ...row, projectName: brief.name }))), [briefs]);
  const decideRows = useMemo(() => briefs.flatMap((brief) => brief.decide.map((row) => ({ ...row, projectName: brief.name }))), [briefs]);
  const top = (items) => items.slice(0, 2).map((row) => `「${row.title.length > 34 ? `${row.title.slice(0, 33)}…` : row.title}」`).join("、");
  const title = summary.decide ? "有要你定的事"
    : summary.stuck ? "有线卡住了"
      : summary.open ? "有线还在跑或等你"
        : "最近的线都收口了";
  const lede = "只看最近 3 天；更早没动的在「已过去」。";
  const answers = [
    { key: "done", label: "做完了什么", tone: "success", text: doneRows.length ? `最近收口：${top(doneRows)}。` : "最近还没有收口。" },
    { key: "open", label: "没做完什么", tone: "info", text: openRows.length ? `还在跑或等你：${top(openRows)}。` : "现在没有在跑的。" },
    { key: "stuck", label: "卡在哪", tone: "danger", text: stuckRows.length ? `${top(stuckRows)}。` : "现在没有卡住的。" },
    { key: "decide", label: "要你定什么", tone: "warning", text: decideRows.length ? `${top(decideRows)}。` : "没有等你定的事。" },
  ];
  return <section className="psb-brief" aria-labelledby="psb-brief-title">
    <header className="psb-brief-head">
      <div>
        <span className="psb-eyebrow">各线汇报</span>
        <h2 id="psb-brief-title">{title}</h2>
      </div>
      <SegmentedControl label="汇报筛选" value={filter} onValueChange={setFilter} options={[
        { value: "all", label: "全部" },
        { value: "attention", label: "要处理" },
        { value: "done", label: "已收口" },
      ]} />
    </header>
    <div className="psb-brief-overview">
      <div className="psb-brief-main">
        <p className="psb-brief-lede">{lede}</p>
        <dl className="psb-brief-ledger">
          {answers.map((answer) => <div className="psb-brief-line" key={answer.key} data-tone={answer.tone}>
            <dt>{answer.label}</dt>
            <dd>{answer.text}</dd>
          </div>)}
        </dl>
      </div>
      <SourceUsage sources={sources} />
    </div>
    <div className="psb-brief-list">
      {rows.length === 0 ? <EmptyState label="没有符合条件的项目" title="这个筛选下没有项目" description="换回全部，或等下一轮汇报。"
        action={<Button variant="ghost" size="sm" onClick={() => setFilter("all")}>看全部项目</Button>} /> : rows.map((brief) =>
          <BriefProject key={brief.id} brief={brief} now={now} open={openId === brief.id}
            onToggle={() => setOpenId(openId === brief.id ? null : brief.id)} />)}
    </div>
    <p className="psb-brief-source">最后一句来自各线的结束报告：Codex 会话最后一条、T3 线程、superagent 线程。没有最后一句的线只显示状态。</p>
  </section>;
}

export function ConversationCard({ row, now, selected, onSelect }) {
  return <button type="button" className="psb-conv-card" data-selected={selected || undefined} aria-expanded={selected} onClick={() => onSelect(row.id)}>
    <span className="psb-conv-card-head">
      <Avatar name={row.project} size="sm" status={row.status === "running" ? "online" : undefined} />
      <span className="psb-conv-card-name">{row.project}</span>
      <StatusBadge status={row.status} />
      <SourceBadge source={row.source} />
      <span className="psb-conv-card-time">{relativeLabel(row.updatedAt, now)}</span>
    </span>
    <span className="psb-conv-card-title">{row.title}</span>
    <span className="psb-conv-card-preview">{row.preview || "这条线还没留下最后一句。"}</span>
    <span className="psb-conv-card-foot">
      <Badge size="sm" tone="neutral">{row.threadId ? "线程" : "会话"}</Badge>
      <span>{row.unread ? "未读" : "已读"}</span>
      <span className="psb-conv-card-open">{selected ? "收起" : "看最后一句"} <Icon name="CaretRight" size={11} /></span>
    </span>
  </button>;
}

export function SourceFilter({ sources, value, onChange }) {
  return <SegmentedControl label="按来源筛选" value={value} onValueChange={onChange} options={[
    { value: "all", label: "全部" },
    ...sources.map((source) => ({ value: source.id, label: source.label, accessory: <span className="psb-seg-count">{source.count}</span> })),
  ]} />;
}

export function ProjectIcon({ source }) {
  return <span className="psb-source-icon"><Icon name={SOURCE_ICON[source] ?? "SquaresFour"} size={14} /></span>;
}
