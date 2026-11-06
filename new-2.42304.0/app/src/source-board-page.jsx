import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import {
  BOARD_COLUMNS,
  boardTotals,
  boardVariantFromLocation,
  conversationSources,
  createMockBoardSnapshot,
  groupConversations,
  relativeLabel,
  routeCapture,
} from "./board-view-model.mjs";
import "./source-board-page.css";

const SOURCE_LABELS = { superagent: "Superagent", t3: "T3", codex: "Codex" };
const STATUS_LABELS = { running: "在跑", waiting: "等你", done: "完成", stuck: "卡住" };
const CAPTURE_MODES = [
  { id: "note", label: "一句话" },
  { id: "link", label: "一个链接" },
];

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function defaultLoad({ variant = "normal" } = {}) {
  await wait(180);
  if (variant === "error") return { ok: false, error: "聚合器没有回话：三个来源里有两个超时。" };
  return { ok: true, snapshot: createMockBoardSnapshot({ empty: variant === "empty" }) };
}

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
        <p>汇报任务每天 08:40 写一次。</p>
      </div>
      <div className="psb-report-body">
        <p className="psb-report-lede">今天的汇报还没到。来源照常读，三栏里已有的东西仍然可以先看。</p>
        <p className="psb-report-quiet">这里只放汇报任务的成品，不在看板里临时编结论。</p>
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
        {(report.lines ?? []).slice(1).map((line) => <div className="psb-report-line" key={line.key}>
          <span>{line.label}</span>
          <p>{line.text}</p>
        </div>)}
      </div>
    </div>
  </section>;
}

function CaptureBar({ config, onCaptured }) {
  const [mode, setMode] = useState("note");
  const [value, setValue] = useState("");
  const [notice, setNotice] = useState(null);
  const inputRef = useRef(null);
  const submit = (event) => {
    event.preventDefault();
    const result = routeCapture({ mode, text: value, config });
    if (!result.ok) {
      setNotice({ ok: false, text: result.reason });
      return;
    }
    setNotice({ ok: true, text: `演示：${result.message}`, label: result.label, target: result.target });
    onCaptured?.(result);
    setValue("");
    inputRef.current?.focus();
  };
  return <section className="psb-capture" aria-label="往看板丢一件事">
    <div className="psb-capture-head">
      <div>
        <span className="psb-eyebrow">丢东西进来</span>
        <p>一句话会进 Trigger；一个链接会开成 Issue。第一版只做假处理。</p>
      </div>
      <div className="psb-capture-modes" role="tablist" aria-label="丢进来的类型">
        {CAPTURE_MODES.map((entry) => <button key={entry.id} type="button" role="tab" aria-selected={mode === entry.id}
          className="psb-capture-mode" data-active={mode === entry.id || undefined}
          onClick={() => { setMode(entry.id); setNotice(null); inputRef.current?.focus(); }}>{entry.label}</button>)}
      </div>
    </div>
    <form className="psb-capture-form" onSubmit={submit}>
      <Icon name={mode === "link" ? "Link" : "Chat"} size={18} className="psb-capture-icon" />
      <input ref={inputRef} value={value} onChange={(event) => { setValue(event.target.value); setNotice(null); }}
        aria-label={mode === "link" ? "链接" : "一句话"} placeholder={mode === "link" ? "粘贴一个链接…" : "比如：S05 第四小节先保留，别折回两拍"} />
      <SourceSettingsButton variant="primary" size="sm" type="submit" disabled={!value.trim()}>交给总管</SourceSettingsButton>
    </form>
    <div className="psb-capture-foot" aria-live="polite">
      <span>{config?.hint}</span>
      {notice && <span className="psb-capture-notice" data-ok={notice.ok || undefined}>
        {notice.ok ? <Icon name="Check" size={14} /> : <Icon name="WarningCircle" size={14} />}
        {notice.ok ? `${notice.text} · ${notice.label} → ${notice.target}` : notice.text}
      </span>}
    </div>
  </section>;
}

function BoardItem({ row, now, selected, onSelect }) {
  return <button type="button" className="psb-column-row" data-selected={selected || undefined} aria-expanded={selected}
    onClick={() => onSelect(row.id)}>
    <span className="psb-row-meta">
      <span>{row.project}</span>
      <span>{row.kind}</span>
      <span>{relativeLabel(row.at, now)}</span>
    </span>
    <span className="psb-row-title">{row.title}</span>
    <span className="psb-row-detail">{row.detail}</span>
    <span className="psb-row-foot">
      <SourceMark source={row.source} />
      <span>{row.who}</span>
      <span className="psb-row-word">{selected ? "收起" : "展开"}</span>
    </span>
  </button>;
}

function BoardColumns({ columns, now, selected, onSelect }) {
  return <section className="psb-columns" aria-label="总管的三个栏">
    {BOARD_COLUMNS.map((column) => {
      const rows = columns[column.key] ?? [];
      return <section className="psb-column" key={column.key} data-column={column.key}>
        <header className="psb-column-head">
          <span className="psb-eyebrow">{column.eyebrow}</span>
          <h2>{column.title}</h2>
          <span className="psb-column-count">{rows.length}</span>
        </header>
        <div className="psb-column-scroll">
          {rows.length === 0 ? <p className="psb-column-empty">{column.empty}</p> : rows.map((row) => <BoardItem key={row.id} row={row}
            now={now} selected={selected === row.id} onSelect={(id) => onSelect(selected === id ? null : id)} />)}
        </div>
      </section>;
    })}
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
    {selected && <span className="psb-conv-preview">{row.preview} <em>打开对话仍由真实会话接管；这里是演示。</em></span>}
  </button>;
}

function ConversationList({ projects, now, onCaptured }) {
  const [source, setSource] = useState("all");
  const [selected, setSelected] = useState(null);
  const sources = useMemo(() => conversationSources(projects), [projects]);
  const groups = useMemo(() => groupConversations(projects.map((project) => ({
    ...project,
    conversations: source === "all" ? project.conversations : project.conversations.filter((row) => row.source === source),
  }))), [projects, source]);
  const total = groups.reduce((count, group) => count + group.conversations.length, 0);
  return <section className="psb-conversations" aria-labelledby="psb-conversations-title">
    <header className="psb-section-head">
      <div>
        <span className="psb-eyebrow">按项目</span>
        <h2 id="psb-conversations-title">全部对话</h2>
      </div>
      <span className="psb-section-count">{total} 条</span>
      <div className="psb-source-filter" role="group" aria-label="按来源筛选">
        <button type="button" data-active={source === "all" || undefined} onClick={() => setSource("all")}>全部</button>
        {sources.filter((entry) => entry.count > 0).map((entry) => <button type="button" key={entry.id} data-active={source === entry.id || undefined}
          onClick={() => setSource(entry.id)}>{entry.label}<span>{entry.count}</span></button>)}
      </div>
    </header>
    {groups.length === 0 ? <div className="psb-conversation-empty">
      <p>这个来源下还没有对话。</p>
      <button type="button" onClick={() => setSource("all")}>看全部</button>
    </div> : groups.map((group) => <section className="psb-project" key={group.id}>
      <header className="psb-project-head">
        <div>
          <h3>{group.name}</h3>
          <span>{group.repo}</span>
        </div>
        <span>{group.note}</span>
        <span className="psb-project-count">{group.conversations.length}</span>
      </header>
      <div className="psb-project-grid">
        {group.conversations.map((row) => <ConversationRow key={row.id} row={row} now={now} selected={selected === row.id}
          onSelect={(id) => setSelected(selected === id ? null : id)} />)}
      </div>
    </section>)}
    <footer className="psb-conversations-foot">
      <span>点一条对话就能展开它最后说到哪；打开真实会话仍走左侧列表或 ⌘K。</span>
      {onCaptured && <span>丢进来的东西不会直接改这些对话。</span>}
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

function ErrorState({ error, onRetry, onSample }) {
  return <div className="psb-state psb-error" role="alert">
    <span className="psb-eyebrow">读不出来</span>
    <h1>看板没拿到数据</h1>
    <p>{error || "聚合器没有回话。"} 三个来源里只要有一个没回，就不假装其它两个是全貌。</p>
    <div className="psb-state-actions">
      <SourceSettingsButton variant="secondary" icon="ArrowClockwise" onClick={onRetry}>再读一次</SourceSettingsButton>
      <SourceSettingsButton variant="ghost" onClick={onSample}>先看示例数据</SourceSettingsButton>
    </div>
  </div>;
}

export function SourceBoardPage({ load }) {
  const variant = useMemo(() => boardVariantFromLocation(window.location.search), []);
  const [override, setOverride] = useState(null);
  const [state, setState] = useState({ status: "loading" });
  const [selected, setSelected] = useState(null);
  const [captured, setCaptured] = useState(null);
  const activeVariant = override ?? variant;
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    setState((previous) => previous.status === "ready" ? { ...previous, refreshing: true } : { status: "loading" });
    try {
      const result = await (loadRef.current ?? defaultLoad)({ variant: activeVariant });
      if (!result?.ok || !result.snapshot) throw new Error(result?.error || "聚合器没有回话。");
      setState({ status: "ready", snapshot: result.snapshot, refreshing: false });
    } catch (error) {
      setState({ status: "error", error: error?.message || "聚合器没有回话。" });
    }
  }, [activeVariant]);

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
    <ErrorState error={state.error} onRetry={refresh} onSample={() => { setOverride("normal"); setState({ status: "loading" }); }} />
  </section>;

  const { snapshot } = state;
  const totals = snapshot.totals ?? boardTotals(snapshot);
  const empty = totals.conversations === 0 && (snapshot.columns?.decide?.length ?? 0) + (snapshot.columns?.done?.length ?? 0) + (snapshot.columns?.stuck?.length ?? 0) === 0;
  return <section className="psb-page" aria-label="总看板" data-empty={empty || undefined} data-refreshing={state.refreshing || undefined}>
    <header className="psb-masthead">
      <div className="psb-masthead-top">
        <span className="psb-kicker">总管 <i /> Personal super agent</span>
        <span className="psb-demo-pill">演示数据</span>
      </div>
      <div className="psb-masthead-main">
        <div>
          <h1>今天的局面</h1>
          <p className="psb-date">{dateLabel(snapshot.generatedAt)} · {timeLabel(snapshot.generatedAt)} 更新</p>
        </div>
        <div className="psb-masthead-actions">
          <span className="psb-source-health" title="聚合来源">
            <span className="psb-live-dot" />{snapshot.sources?.filter((source) => source.status === "ok").length ?? 0} 个来源已读
          </span>
          <SourceSettingsButton variant="ghost" icon="ArrowClockwise" size="sm" busy={state.refreshing} onClick={refresh}>刷新</SourceSettingsButton>
        </div>
      </div>
      <div className="psb-tally" aria-label="今天的数量">
        <span><b>{totals.running ?? 0}</b> 个在跑</span>
        <span><b>{totals.waiting ?? 0}</b> 个等你</span>
        <span><b>{snapshot.columns?.decide?.length ?? 0}</b> 件要定</span>
        <span><b>{totals.unread ?? 0}</b> 条未读</span>
        <span className="psb-tally-note">report task · 只展示，不在看板里重写</span>
      </div>
    </header>

    <ReportBlock report={snapshot.report} />
    <CaptureBar config={snapshot.capture} onCaptured={setCaptured} />
    <BoardColumns columns={snapshot.columns ?? {}} now={snapshot.generatedAt} selected={selected} onSelect={setSelected} />
    <ConversationList projects={snapshot.projects ?? []} now={snapshot.generatedAt} onCaptured={captured} />

    <footer className="psb-origin">
      <span>聚合形状：superagent /orchestrator/api · T3 线程 · ~/.codex/sessions</span>
      <span>{snapshot.sources?.map((source) => `${source.label} ${source.detail}`).join(" · ")}</span>
    </footer>
  </section>;
}
