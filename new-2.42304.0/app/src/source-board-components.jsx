import React, { useMemo, useState } from "react";
import { Badge } from "./arc/badge/badge";
import { Avatar } from "./arc/avatar/avatar";
import { Progress } from "./arc/progress/progress";
import UsageMeter from "./arc/usage-meter/usage-meter";
import EmptyState from "./arc/empty-state/empty-state";
import { Button } from "./arc/button/button";
import { Tooltip } from "./arc/tooltip/tooltip";
import SegmentedControl from "./arc/segmented-control/segmented-control";
import { Icon } from "./icons";
import { relativeLabel } from "./board-view-model.mjs";

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

export function StatusBar({ totals, columns, stuckSummary, summary }) {
  const done = summary?.done ?? columns.done?.length ?? 0;
  const open = summary?.open ?? (totals.running ?? 0) + (totals.waiting ?? 0);
  const decide = summary?.decide ?? columns.decide?.length ?? 0;
  const stuck = summary?.stuck ?? columns.stuck?.length ?? 0;
  const total = Math.max(done + open + decide + stuck, 1);
  return <section className="psb-statusbar" aria-label="今天的局面">
    <div className="psb-statusbar-badges">
      <Badge tone="success" dot>{summary?.done ?? 0} 收口</Badge>
      <Badge tone="info" dot>{open} 在跑/等你</Badge>
      <Badge tone="warning">{decide} 要定</Badge>
      <Badge tone="danger" dot>{stuck} 卡住</Badge>
      <Badge tone="neutral">{stuckSummary?.past ?? 0} 已过去</Badge>
    </div>
    <div className="psb-statusbar-progress">
      <Progress value={done} max={total} label={`最近 3 天收口 ${done} / ${done + open + decide + stuck}`} showValue />
    </div>
  </section>;
}

export function SourceUsage({ sources }) {
  const segments = sources.map((source) => ({
    id: source.id,
    label: source.label,
    value: source.status === "connected" ? 1 : 0,
  }));
  return <div className="psb-usage-card" aria-label="来源读取">
    <UsageMeter label="来源读取" limit={sources.length || 3} unit="个" decimals={0} segments={segments} freeLabel="未读" warnAt={2} />
    <p className="psb-usage-note">
      <span className="psb-usage-live" />
      {sources.filter((source) => source.status === "connected").length}/{sources.length || 3} 来源已读 · 只读 · 每 60 秒刷新
    </p>
  </div>;
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
        <CountBadge label="收口" value={brief.counts.done} tone="success" />
        <CountBadge label="在跑" value={brief.counts.open} tone="info" />
        <CountBadge label="卡住" value={brief.counts.stuck} tone="danger" />
        <CountBadge label="要定" value={brief.counts.decide} tone="warning" />
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
  const attention = briefs.filter((brief) => brief.status !== "done").length;
  const rows = useMemo(() => briefs.filter((brief) => filter === "all" ? true : filter === "attention" ? brief.status !== "done" : brief.status === "done"), [briefs, filter]);
  const total = summary.done + summary.open + summary.stuck + summary.decide;
  const doneRows = useMemo(() => briefs.flatMap((brief) => brief.done.map((row) => ({ ...row, projectName: brief.name }))).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)), [briefs]);
  const openRows = useMemo(() => briefs.flatMap((brief) => brief.open.map((row) => ({ ...row, projectName: brief.name }))).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)), [briefs]);
  const stuckRows = useMemo(() => briefs.flatMap((brief) => brief.stuck.map((row) => ({ ...row, projectName: brief.name }))), [briefs]);
  const decideRows = useMemo(() => briefs.flatMap((brief) => brief.decide.map((row) => ({ ...row, projectName: brief.name }))), [briefs]);
  const top = (items) => items.slice(0, 2).map((row) => `「${row.title.length > 34 ? `${row.title.slice(0, 33)}…` : row.title}」`).join("、");
  const title = summary.decide ? `先看 ${summary.decide} 件要定的`
    : summary.stuck ? `先看 ${summary.stuck} 件卡住的`
      : summary.open ? `${summary.open} 条还在跑或等你`
        : `最近收口 ${summary.done} 条`;
  const lede = `最近 3 天 ${summary.projects} 个项目、${total} 条线：${summary.done} 条已收口，${summary.open} 条在跑或等你，${summary.decide} 件要定，${summary.stuck} 件卡住。`;
  const latestReport = doneRows[0]?.detail || doneRows[0]?.title;
  const answers = [
    { key: "done", label: "做完了什么", tone: "success", value: summary.done, text: latestReport ? `最近收口：${latestReport.length > 88 ? `${latestReport.slice(0, 87)}…` : latestReport}` : "最近还没有收口。" },
    { key: "open", label: "没做完什么", tone: "info", value: summary.open, text: `现在 ${summary.open} 条在跑或等你${top(openRows) ? `：${top(openRows)}` : ""}。` },
    { key: "stuck", label: "卡在哪", tone: "danger", value: summary.stuck, text: summary.stuck ? `${summary.stuck} 件卡住：${top(stuckRows)}。` : "现在没有卡住的。" },
    { key: "decide", label: "要你定什么", tone: "warning", value: summary.decide, text: summary.decide ? `${summary.decide} 件要定：${top(decideRows)}。` : "没有等你定的事。" },
  ];
  return <section className="psb-brief" aria-labelledby="psb-brief-title">
    <header className="psb-brief-head">
      <div>
        <span className="psb-eyebrow">各线汇报</span>
        <h2 id="psb-brief-title">{title}</h2>
      </div>
      <SegmentedControl label="汇报筛选" value={filter} onValueChange={setFilter} options={[
        { value: "all", label: "全部", accessory: <span className="psb-seg-count">{briefs.length}</span> },
        { value: "attention", label: "要处理", accessory: <span className="psb-seg-count">{attention}</span> },
        { value: "done", label: "已收口", accessory: <span className="psb-seg-count">{briefs.length - attention}</span> },
      ]} />
    </header>
    <div className="psb-brief-overview">
      <div className="psb-brief-main">
        <p className="psb-brief-lede">{lede}</p>
        <div className="psb-brief-badges">
          <Badge tone="success" dot>{summary.done} 收口</Badge>
          <Badge tone="info" dot>{summary.open} 在跑/等你</Badge>
          <Badge tone="danger" dot>{summary.stuck} 卡住</Badge>
          <Badge tone="warning" dot>{summary.decide} 要定</Badge>
          <Badge tone="neutral">{summary.past} 已过去</Badge>
        </div>
        <div className="psb-brief-answers">
          {answers.map((answer) => <div className="psb-brief-answer" key={answer.key} data-tone={answer.tone}>
            <header><span>{answer.label}</span><Badge size="sm" tone={answer.tone}>{answer.value}</Badge></header>
            <p>{answer.text}</p>
          </div>)}
        </div>
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

export function BoardCard({ row, now, tone, past, selected, onSelect }) {
  return <button type="button" className="psb-card" data-tone={tone} data-past={past || undefined} data-selected={selected || undefined}
    aria-expanded={selected} onClick={() => onSelect(row.id)}>
    <span className="psb-card-head">
      <Avatar name={row.project} size="sm" />
      <span className="psb-card-project">{row.project}</span>
      <StatusBadge status={tone} label={tone === "done" ? "收口" : tone === "decide" ? "要定" : tone === "stuck" ? "卡住" : undefined} />
      <SourceBadge source={row.source} />
    </span>
    <span className="psb-card-title">{row.title}</span>
    {row.detail && <span className="psb-card-detail">{row.detail}</span>}
    <span className="psb-card-foot">
      <Badge size="sm" tone="neutral">{row.kind}</Badge>
      <Tooltip content={`${row.who} · ${row.project}`}><span className="psb-card-time">{relativeLabel(row.at, now)}</span></Tooltip>
      {past && <Badge size="sm" tone="neutral">{row.pastLabel || "已过去"}</Badge>}
      {past && <span className="psb-card-past">{row.pastReason}</span>}
      <span className="psb-card-open">{selected ? "收起" : "展开"} <Icon name="CaretRight" size={11} /></span>
    </span>
  </button>;
}

export function ColumnView({ column, rows, past = [], now, selected, onSelect }) {
  const [pastOpen, setPastOpen] = useState(false);
  const reasonText = useMemo(() => {
    const label = { recovered: "已恢复", test: "测试", pilot: "试点", review: "旧复核", expired: "过期" };
    const counts = new Map();
    for (const row of past) counts.set(row.pastKind, (counts.get(row.pastKind) ?? 0) + 1);
    return [...counts.entries()].slice(0, 2).map(([kind, count]) => `${count} 件 ${label[kind] ?? "已过去"}`).join(" · ");
  }, [past]);
  return <section className="psb-column" data-column={column.key}>
    <header className="psb-column-head">
      <span className="psb-eyebrow">{column.eyebrow}</span>
      <h2>{column.title}</h2>
      <Badge size="sm" tone={column.key === "stuck" ? "danger" : column.key === "done" ? "success" : "warning"}>{rows.length}</Badge>
      {column.key === "done" && rows.length > 0 && <span className="psb-column-note">最近 {rows.length} 件</span>}
      {past.length > 0 && <span className="psb-column-past">已过去 {past.length} 件</span>}
    </header>
    <div className="psb-column-cards">
      {rows.length === 0 ? <EmptyState title={past.length > 0 ? "现在没有卡住的" : column.empty}
        description={past.length > 0 ? "旧的试点、测试、复核和过期回合收在下面。" : "这一栏现在没有需要看的。"}
        icon={<Icon name={column.key === "stuck" ? "Check" : "SquaresFour"} size={18} />} />
        : rows.map((row) => <BoardCard key={row.id} row={row} now={now} tone={column.key} selected={selected === row.id}
          onSelect={(id) => onSelect(selected === id ? null : id)} />)}
    </div>
    {past.length > 0 && <div className="psb-past">
      <Button variant="ghost" size="sm" onClick={() => setPastOpen(!pastOpen)} aria-expanded={pastOpen}>
        已过去 {past.length} 件 <span className="psb-past-reasons">· {reasonText}</span>
        <Icon name="CaretRight" size={11} className="psb-past-caret" />
      </Button>
      {pastOpen && <div className="psb-past-cards">
        {past.map((row) => <BoardCard key={row.id} row={row} now={now} tone={column.key} past
          selected={selected === row.id} onSelect={(id) => onSelect(selected === id ? null : id)} />)}
      </div>}
    </div>}
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
