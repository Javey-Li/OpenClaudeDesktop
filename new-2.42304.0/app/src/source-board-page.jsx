import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { Button } from "./arc/button/button";
import SegmentedControl from "./arc/segmented-control/segmented-control";
import {
  BOARD_COLUMNS,
  CAPTURE_PROJECTS,
  boardTotals,
  conversationSources,
  groupConversations,
  relativeLabel,
} from "./board-view-model.mjs";
import { buildBriefSummary, buildProjectBriefs } from "./board-brief-model.mjs";
import { BriefBoard, ColumnView, ConversationCard, SourceFilter, StatusBar } from "./source-board-components.jsx";
import "./source-board-page.css";
import "./arc-tokens.css";
import "./source-board-v2.css";

const SOURCE_LABELS = { superagent: "Superagent", t3: "T3", codex: "Codex" };
const STATUS_LABELS = { running: "在跑", waiting: "等你", done: "完成", stuck: "卡住", suspected: "可能卡住" };
const CAPTURE_MODES = [
  { id: "note", label: "一句话" },
  { id: "link", label: "一个链接" },
];

const defaultLoad = async () => ({ ok: false, error: "看板只在 Electron 桌面版里读真数据。" });

function dateLabel(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });
}

function timeLabel(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function SourceMark({ source }) {
  return <span className="psb-source-mark" data-source={source}>{SOURCE_LABELS[source] ?? source}</span>;
}

function ReportBlock({ report }) {
  if (!report) {
    return <section className="psb-report psb-report-empty" aria-label="今日汇报">
      <div className="psb-report-aside">
        <span className="psb-eyebrow">今日简报</span>
        <strong>还没生成</strong>
        <p>简报由当前数据即时拼出。</p>
      </div>
      <div className="psb-report-body">
        <p className="psb-report-lede">现在还没有能拼成简报的数据。来源照常读，连上的部分仍然可以先看。</p>
        <p className="psb-report-quiet">这里不补假数据，也不把没连上的来源算进结论。</p>
      </div>
    </section>;
  }
  return <section className="psb-report" aria-labelledby="psb-report-title">
    <div className="psb-report-aside">
      <span className="psb-eyebrow">今日简报</span>
      <strong id="psb-report-title">{report.title}</strong>
      <p>{report.cadence}</p>
      <span className="psb-report-stamp">{timeLabel(report.generatedAt)} 更新</span>
    </div>
    <div className="psb-report-body">
      <span className="psb-report-lede-label">做完了什么</span>
      <p className="psb-report-lede">{report.lines?.[0]?.text}</p>
      <div className="psb-report-lines">
        {(report.lines ?? []).slice(1).filter((line) => line.key !== "sources").map((line) => <div className="psb-report-line" key={line.key}>
          <span>{line.label}</span>
          <p>{line.text}</p>
        </div>)}
      </div>
    </div>
  </section>;
}

function DayBar({ totals, columns }) {
  const label = { running: "在跑", waiting: "等你", decide: "要定", stuck: "卡住", done: "收口" };
  const parts = [
    ["running", totals.running ?? 0],
    ["waiting", totals.waiting ?? 0],
    ["decide", columns.decide?.length ?? 0],
    ["stuck", columns.stuck?.length ?? 0],
    ["done", columns.done?.length ?? 0],
  ].filter(([, value]) => value > 0);
  const total = parts.reduce((sum, [, value]) => sum + value, 0);
  if (!total) return null;
  return <div className="psb-daybar" role="img" aria-label={parts.map(([key, value]) => `${label[key]} ${value}`).join("，")}>
    {parts.map(([key, value]) => <span key={key} data-tone={key} style={{ flexGrow: value }} />)}
  </div>;
}

function SourceReadout({ sources }) {
  const connected = sources.filter((source) => source.status === "connected").length;
  const total = sources.length || 3;
  return <aside className="psb-readout" aria-label="来源读取">
    <div className="psb-readout-head">
      <span>来源</span>
      <b>{connected}<em>/{total}</em></b>
      <span className="psb-readout-word">{connected === total ? "都读到了" : "有缺口"}</span>
    </div>
    <div className="psb-readout-bar" role="img" aria-label={`${connected}/${total} 个来源已读`}>
      {sources.map((source) => <span key={source.id} data-ok={source.status === "connected" || undefined}
        title={`${source.label} · ${source.status === "connected" ? source.detail : source.error}`} />)}
    </div>
    <ul className="psb-readout-list">
      {sources.map((source) => <li key={source.id} data-ok={source.status === "connected" || undefined}>
        <i />
        <span>{source.label}</span>
        <em>{source.status === "connected" ? source.detail : "没连上"}</em>
      </li>)}
    </ul>
  </aside>;
}

function ToolRow({ row, now, open, onToggle }) {
  const running = row.status === "running";
  return <div className="psb-tool" data-open={open || undefined}>
    <button type="button" className="psb-tool-row" aria-expanded={open} onClick={onToggle}>
      <span className="psb-tool-dot" data-status={row.status} aria-hidden="true" />
      <span className="psb-tool-title">{row.title}</span>
      <span className="psb-tool-meta">{row.projectName} · {relativeLabel(row.updatedAt, now)}</span>
      <span className="psb-tool-state" data-status={row.status} aria-label={running ? "在跑" : "等你"}>
        {running ? <span className="psb-tool-dots" aria-hidden="true"><i /><i /><i /></span> : "等你"}
      </span>
      <Icon name="CaretRight" size={12} className="psb-tool-caret" />
    </button>
    {open && <p className="psb-tool-preview">{row.preview || "这条还没留下最后一句。"}
      <em>{STATUS_LABELS[row.status]} · {SOURCE_LABELS[row.source] ?? row.source}</em></p>}
  </div>;
}

function LiveBand({ projects, sources, totals, now }) {
  const [open, setOpen] = useState(null);
  const rows = useMemo(() => {
    const cutoff = Date.parse(now) - 6 * 60 * 60 * 1000;
    const all = projects.flatMap((project) => (project.conversations ?? []).map((row) => ({ ...row, projectName: project.name })));
    return all.filter((row) => (row.status === "running" || row.status === "waiting") && Date.parse(row.updatedAt) >= cutoff)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, 3);
  }, [projects, now]);
  const running = rows.filter((row) => row.status === "running").length;
  const waiting = rows.filter((row) => row.status === "waiting").length;
  const latest = projects.flatMap((project) => project.conversations ?? [])
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
  return <section className="psb-live" aria-label="正在发生">
    <div className="psb-live-main">
      <header className="psb-live-head">
        <span className="psb-eyebrow">正在发生</span>
        <span className="psb-live-count">
          {running ? `${running} 在跑` : "没有在跑"}{waiting ? ` · ${waiting} 等你` : ""}
          <em>共 {totals.conversations ?? 0} 条最近对话</em>
        </span>
      </header>
      {rows.length > 0 ? <div className="psb-tool-list">
        {rows.map((row) => <ToolRow key={row.id} row={row} now={now} open={open === row.id}
          onToggle={() => setOpen(open === row.id ? null : row.id)} />)}
      </div> : <p className="psb-live-empty">
        现在没有在跑的。{latest ? `最近一条 ${relativeLabel(latest.updatedAt, now)} 收口。` : "等有新对话再放上来。"}
      </p>}
    </div>
    <SourceReadout sources={sources} />
  </section>;
}

function CaptureBar({ config, onCapture, onOpenLink, onCaptured }) {
  const [mode, setMode] = useState("note");
  const [projectId, setProjectId] = useState("");
  const [value, setValue] = useState("");
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const submit = async (event) => {
    event.preventDefault();
    if (!projectId) { setNotice({ ok: false, text: "先选项目。" }); return; }
    if (!value.trim()) { setNotice({ ok: false, text: "先写点什么。" }); return; }
    setBusy(true);
    setNotice(null);
    try {
      const result = await onCapture?.({ mode, projectId, text: value });
      if (!result?.ok) throw new Error(result?.error || "Issue 没写成。");
      setNotice({ ok: true, text: `已开 Issue · ${result.repo}`, href: result.url, repo: result.repo });
      onCaptured?.(result);
      setValue("");
      inputRef.current?.focus();
    } catch (error) {
      setNotice({ ok: false, text: error?.message || "Issue 没写成。" });
    } finally {
      setBusy(false);
    }
  };
  return <section className="psb-capture" aria-label="往看板丢一件事">
    <div className="psb-capture-head">
      <div>
        <span className="psb-eyebrow">丢东西进来</span>
        <p>{config?.hint || "一句话和链接都会写成所选项目的 GitHub Issue。"}</p>
      </div>
      <div className="psb-capture-modes">
        <SegmentedControl label="丢进来的类型" value={mode} options={CAPTURE_MODES.map((entry) => ({ value: entry.id, label: entry.label }))}
          onValueChange={(next) => { setMode(next); setNotice(null); inputRef.current?.focus(); }} />
      </div>
    </div>
    <form className="psb-capture-form" onSubmit={submit}>
      <Icon name={mode === "link" ? "Link" : "Chat"} size={18} className="psb-capture-icon" />
      <select className="psb-capture-project" value={projectId} aria-label="选项目"
        onChange={(event) => { setProjectId(event.target.value); setNotice(null); }}>
        <option value="">先选项目</option>
        {CAPTURE_PROJECTS.map((project) => <option key={project.id} value={project.id} disabled={!project.repo}>
          {project.name}{project.repo ? "" : "（没有仓库）"}
        </option>)}
      </select>
      <input ref={inputRef} value={value} onChange={(event) => { setValue(event.target.value); setNotice(null); }}
        aria-label={mode === "link" ? "链接" : "一句话"} placeholder={mode === "link" ? "粘贴一个链接…" : "比如：S05 第四小节先保留，别折回两拍"} />
      <Button variant={value.trim() && projectId ? "primary" : "secondary"} size="sm" type="submit" loading={busy} disabled={!value.trim() || !projectId}>写 Issue</Button>
    </form>
    <div className="psb-capture-foot" aria-live="polite">
      <span>{config?.hint}</span>
      {notice && <span className="psb-capture-notice" data-ok={notice.ok || undefined}>
        {notice.ok ? <Icon name="Check" size={14} /> : <Icon name="WarningCircle" size={14} />}
        {notice.text}
        {notice.href && <button type="button" className="psb-issue-link" onClick={() => onOpenLink?.(notice.href)}>打开 Issue</button>}
      </span>}
    </div>
  </section>;
}

function BoardItem({ row, now, selected, onSelect, tone, past }) {
  return <button type="button" className="psb-column-row" data-selected={selected || undefined} data-past={past || undefined}
    data-tone={tone || undefined} aria-expanded={selected} onClick={() => onSelect(row.id)}>
    <span className="psb-row-meta">
      {tone === "done" && <span className="psb-row-check" aria-label="已完成">✓</span>}
      <span>{row.project}</span>
      <span>{row.kind}</span>
      <span>{relativeLabel(row.at, now)}</span>
      {past && <span className="psb-past-tag">{row.pastLabel || "已过去"}</span>}
    </span>
    <span className="psb-row-title">{row.title}</span>
    <span className="psb-row-detail">{row.detail}</span>
    <span className="psb-row-foot">
      <SourceMark source={row.source} />
      <span>{row.who}</span>
      {past && <span className="psb-past-reason">{row.pastReason}</span>}
      <span className="psb-row-word">{selected ? "收起" : "展开"}</span>
    </span>
  </button>;
}

function BoardColumn({ column, rows, past = [], now, selected, onSelect }) {
  const [pastOpen, setPastOpen] = useState(false);
  const reasonText = useMemo(() => {
    const label = { recovered: "已恢复", test: "测试", pilot: "试点", review: "旧复核", expired: "过期" };
    const counts = new Map();
    for (const row of past) counts.set(row.pastKind, (counts.get(row.pastKind) ?? 0) + 1);
    return [...counts.entries()].slice(0, 2).map(([kind, count]) => `${count} 件${label[kind] ?? "已过去"}`).join(" · ");
  }, [past]);
  return <section className="psb-column" data-column={column.key}>
    <header className="psb-column-head">
      <span className="psb-eyebrow">{column.eyebrow}</span>
      <h2>{column.title}</h2>
      <span className="psb-column-count">{rows.length}</span>
      {past.length > 0 && <span className="psb-column-past">已过去 {past.length} 件</span>}
    </header>
    <div className="psb-column-scroll">
      {rows.length === 0 ? <p className="psb-column-empty">{past.length > 0 && column.key === "stuck" ? "现在没有卡住的。" : column.empty}</p>
        : rows.map((row) => <BoardItem key={row.id} row={row} now={now} tone={column.key}
          selected={selected === row.id} onSelect={(id) => onSelect(selected === id ? null : id)} />)}
      {past.length > 0 && <section className="psb-past" data-open={pastOpen || undefined}>
        <button type="button" className="psb-past-toggle" aria-expanded={pastOpen} onClick={() => setPastOpen(!pastOpen)}>
          <span>已过去</span>
          <b>{past.length} 件</b>
          <em>· {reasonText}</em>
          <i>{pastOpen ? "收起" : "展开"}</i>
        </button>
        {pastOpen && <div className="psb-past-list">
          {past.map((row) => <BoardItem key={row.id} row={row} now={now} tone={column.key} past
            selected={selected === row.id} onSelect={(id) => onSelect(selected === id ? null : id)} />)}
        </div>}
      </section>}
    </div>
  </section>;
}

function BoardColumns({ columns, now, selected, onSelect }) {
  return <section className="psb-columns" aria-label="总管的三个栏">
    {BOARD_COLUMNS.map((column) => <ColumnView key={column.key} column={column} rows={columns[column.key] ?? []}
      past={column.key === "stuck" ? columns.stuckPast ?? [] : []} now={now} selected={selected} onSelect={onSelect} />)}
  </section>;
}

function ConversationRow({ row, now, selected, onSelect }) {
  return <button type="button" className="psb-conv-row" data-selected={selected || undefined} aria-expanded={selected}
    onClick={() => onSelect(row.id)}>
    <span className="psb-conv-top">
      <span className="psb-status-dot" data-status={row.status} aria-hidden="true" />
      <span className="psb-conv-title">{row.title}</span>
      {row.unread && <span className="psb-unread" aria-label="未读" />}
      <span className="psb-conv-time">{relativeLabel(row.updatedAt, now)}</span>
    </span>
    <span className="psb-conv-meta">
      <SourceMark source={row.source} />
      <span>{STATUS_LABELS[row.status]}</span>
      <span>{row.preview}</span>
    </span>
    {selected && <span className="psb-conv-preview">{row.preview} <em>打开对话仍由真实会话接管。</em></span>}
  </button>;
}

function ProjectGroups({ groups, now, selected, onSelect }) {
  return groups.map((group) => <section className="psb-project" key={group.id}>
    <header className="psb-project-head">
      <div>
        <h3>{group.name}</h3>
        <span>{group.repo}</span>
      </div>
      <span>{group.note}</span>
      <span className="psb-project-count">{group.conversations.length}</span>
    </header>
    <div className="psb-project-grid">
      {group.conversations.map((row) => <ConversationCard key={row.id} row={row} now={now} selected={selected === row.id}
        onSelect={(id) => onSelect(selected === id ? null : id)} />)}
    </div>
  </section>);
}

function ConversationList({ projects, older, now }) {
  const [source, setSource] = useState("all");
  const [selected, setSelected] = useState(null);
  const [showOlder, setShowOlder] = useState(false);
  const sources = useMemo(() => conversationSources(projects), [projects]);
  const filter = (project) => ({
    ...project,
    conversations: source === "all" ? project.conversations : project.conversations.filter((row) => row.source === source),
  });
  const groups = useMemo(() => groupConversations(projects.map((project) => ({
    ...filter(project),
  }))), [projects, source]);
  const olderGroups = useMemo(() => groupConversations((older?.projects ?? []).map(filter)), [older, source]);
  const total = groups.reduce((count, group) => count + group.conversations.length, 0);
  const olderTotal = olderGroups.reduce((count, group) => count + group.conversations.length, 0);
  return <section className="psb-conversations" aria-labelledby="psb-conversations-title">
    <header className="psb-section-head">
      <div>
        <span className="psb-eyebrow">按项目 · 最近 3 天</span>
        <h2 id="psb-conversations-title">最近对话</h2>
      </div>
      <span className="psb-section-count">{total} 条</span>
      <div className="psb-source-filter-arc"><SourceFilter sources={sources.filter((entry) => entry.count > 0)} value={source} onChange={setSource} /></div>
    </header>
    {groups.length === 0 ? <div className="psb-conversation-empty">
      <p>这个来源最近 3 天没有对话。</p>
      <button type="button" onClick={() => setSource("all")}>看全部</button>
    </div> : <ProjectGroups groups={groups} now={now} selected={selected} onSelect={setSelected} />}
    {olderTotal > 0 && <section className="psb-older" data-open={showOlder || undefined}>
      <button type="button" className="psb-older-toggle" aria-expanded={showOlder} onClick={() => setShowOlder(!showOlder)}>
        <span>旧对话与已归档</span>
        <b>{olderTotal}</b>
        <em>{older?.archived ? `含 ${older.archived} 条归档` : "默认折叠"}</em>
        <i>{showOlder ? "收起" : "展开"}</i>
      </button>
      {showOlder && <ProjectGroups groups={olderGroups} now={now} selected={selected} onSelect={setSelected} />}
    </section>}
    <footer className="psb-conversations-foot">
      <span>默认只显示最近 3 天；更旧和归档的对话折叠在下面。</span>
      <span>点一条对话就能展开它最后说到哪；打开真实会话仍走左侧列表或 ⌘K。</span>
    </footer>
  </section>;
}

function LoadingState() {
  return <div className="psb-state" aria-busy="true">
    <span className="psb-eyebrow">总管</span>
    <h1>正在把今天的局面摊开</h1>
    <p>读 superagent 实例、T3 线程和 Codex 会话。</p>
    <div className="psb-skeleton" aria-hidden="true"><span /><span /><span /></div>
  </div>;
}

function ErrorState({ error, onRetry }) {
  return <div className="psb-state psb-error" role="alert">
    <span className="psb-eyebrow">读不出来</span>
    <h1>看板没拿到数据</h1>
    <p>{error || "聚合器没有回话。"} 三个来源里只要有一个没回，就不假装其它两个是全貌。</p>
    <div className="psb-state-actions">
      <SourceSettingsButton variant="secondary" icon="ArrowClockwise" onClick={onRetry}>再读一次</SourceSettingsButton>
    </div>
  </div>;
}

export function SourceBoardPage({ load, capture, onOpenLink }) {
  const [state, setState] = useState({ status: "loading" });
  const [selected, setSelected] = useState(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async ({ force = false } = {}) => {
    setState((previous) => previous.status === "ready" ? { ...previous, refreshing: true } : { status: "loading" });
    try {
      const result = await (loadRef.current ?? defaultLoad)({ force });
      if (!result?.ok || !result.snapshot) throw new Error(result?.error || "聚合器没有回话。");
      setState({ status: "ready", snapshot: result.snapshot, refreshing: false });
    } catch (error) {
      setState({ status: "error", error: error?.message || "聚合器没有回话。" });
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const previous = document.title;
    document.title = "总看板 — OpenClaude Desktop";
    return () => { document.title = previous; };
  }, []);

  if (state.status === "loading") return <section className="psb-page psb-page-state" aria-label="总看板"><LoadingState /></section>;
  if (state.status === "error") return <section className="psb-page psb-page-state" aria-label="总看板">
    <ErrorState error={state.error} onRetry={() => refresh({ force: true })} />
  </section>;

  const { snapshot } = state;
  const totals = snapshot.totals ?? boardTotals(snapshot);
  const empty = totals.conversations === 0 && (snapshot.columns?.decide?.length ?? 0) + (snapshot.columns?.done?.length ?? 0) + (snapshot.columns?.stuck?.length ?? 0) === 0;
  const briefs = buildProjectBriefs({ projects: snapshot.projects ?? [], columns: snapshot.columns ?? {}, now: snapshot.generatedAt });
  const briefSummary = buildBriefSummary(briefs);
  return <section className="psb-page" aria-label="总看板" data-empty={empty || undefined} data-refreshing={state.refreshing || undefined}>
    <header className="psb-masthead">
      <div className="psb-masthead-top">
        <span className="psb-kicker">总管 <i /> Personal super agent</span>
        <span className="psb-mode-pill">只读</span>
      </div>
      <div className="psb-masthead-main">
        <div>
          <h1>今天的局面</h1>
          <p className="psb-date">{dateLabel(snapshot.generatedAt)} · {timeLabel(snapshot.generatedAt)} 更新</p>
        </div>
        <div className="psb-masthead-actions">
          <span className="psb-source-health" title="聚合来源">
            <span className="psb-live-dot" data-offline={(snapshot.sources ?? []).some((source) => source.status !== "connected") || undefined} />
            {snapshot.sources?.filter((source) => source.status === "connected").length ?? 0}/{snapshot.sources?.length ?? 3} 个来源已读
          </span>
          <SourceSettingsButton variant="ghost" icon="ArrowClockwise" size="sm" busy={state.refreshing} onClick={() => refresh({ force: true })}>刷新</SourceSettingsButton>
        </div>
      </div>
      <StatusBar totals={totals} columns={snapshot.columns ?? {}} stuckSummary={snapshot.stuckSummary} summary={briefSummary} />
    </header>

    <BriefBoard briefs={briefs} summary={briefSummary} sources={snapshot.sources ?? []} now={snapshot.generatedAt} />
    <CaptureBar config={snapshot.capture} onCapture={capture} onOpenLink={onOpenLink} />
    <BoardColumns columns={snapshot.columns ?? {}} now={snapshot.generatedAt} selected={selected} onSelect={setSelected} />
    <ConversationList projects={snapshot.projects ?? []} older={snapshot.older} now={snapshot.generatedAt} />

    <footer className="psb-origin">
      <span>只读来源：Codex ~/.codex/sessions · superagent 127.0.0.1:3082 · T3 127.0.0.1:3773</span>
      <span>{snapshot.sources?.map((source) => `${source.label} ${source.status === "connected" ? source.detail : `没连上（${source.error}）`}`).join(" · ")}</span>
    </footer>
  </section>;
}
