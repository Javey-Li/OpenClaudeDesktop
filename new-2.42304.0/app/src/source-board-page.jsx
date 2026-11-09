import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, ChevronRight, CircleAlert, Copy, Link, MessageCircle } from "lucide-react";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { Button } from "./arc/button/button";
import SegmentedControl from "./arc/segmented-control/segmented-control";
import { CAPTURE_PROJECTS, relativeLabel } from "./board-view-model.mjs";
import { LINE_FILTERS, buildBoardLevels, filterLines, findLine } from "./board-levels-model.mjs";
import { shortModel } from "./board-telemetry-model.mjs";
import { plainText } from "./board-text-model.mjs";
import {
  ContextMap, ContextWindow, FallbackChain, LineMonitor, SOURCE_LABELS, StateChip, StateGlyph, ToolCallGroup,
} from "./agent-state-components.jsx";
import "./source-board-page.css";
import "./arc-tokens.css";
import "./source-board-v2.css";
import "./board-levels.css";

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

function CaptureBar({ config, onCapture, onOpenLink }) {
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
      setNotice({ ok: true, text: `已开 Issue · ${result.repo}`, href: result.url });
      setValue("");
      inputRef.current?.focus();
    } catch (error) {
      setNotice({ ok: false, text: error?.message || "Issue 没写成。" });
    } finally {
      setBusy(false);
    }
  };
  return <section className="psb-capture psl-capture" aria-label="往看板丢一件事">
    <div className="psb-capture-head">
      <span className="psb-eyebrow">丢东西进来</span>
      <div className="psb-capture-modes">
        <SegmentedControl label="丢进来的类型" value={mode} options={CAPTURE_MODES.map((entry) => ({ value: entry.id, label: entry.label }))}
          onValueChange={(next) => { setMode(next); setNotice(null); inputRef.current?.focus(); }} />
      </div>
    </div>
    <form className="psb-capture-form" onSubmit={submit}>
      {mode === "link" ? <Link size={18} className="psb-capture-icon" /> : <MessageCircle size={18} className="psb-capture-icon" />}
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
        {notice.ok ? <Check size={14} /> : <CircleAlert size={14} />}
        {notice.text}
        {notice.href && <button type="button" className="psb-issue-link" onClick={() => onOpenLink?.(notice.href)}>打开 Issue</button>}
      </span>}
    </div>
  </section>;
}

/* ---------- shared chrome ---------- */

function Crumbs({ trail, onGo }) {
  return <nav className="psl-crumbs" aria-label="看板层级">
    {trail.map((entry, index) => {
      const last = index === trail.length - 1;
      return <React.Fragment key={entry.id}>
        {index > 0 && <ChevronRight size={10} className="psl-crumb-sep" />}
        {last ? <span aria-current="page">{entry.label}</span>
          : <button type="button" onClick={() => onGo(entry.view)}>{entry.label}</button>}
      </React.Fragment>;
    })}
  </nav>;
}

function Stat({ value, label, tone }) {
  return <span className="psl-stat" data-tone={value ? tone : undefined} data-zero={value ? undefined : true}>
    <b>{value}</b><em>{label}</em>
  </span>;
}

/* ---------- level 1: 今天的局面 ---------- */

function Report({ report, sources }) {
  const down = sources.filter((source) => source.status !== "connected");
  return <section className="psl-report" aria-label="今天的汇报">
    <div className="psl-report-head">
      <span className="psb-eyebrow">汇报</span>
      <h2>{report.headline}</h2>
    </div>
    <dl className="psl-report-lines">
      {report.lines.map((line) => <div key={line.key} data-key={line.key}>
        <dt>{line.label}</dt><dd>{line.text}</dd>
      </div>)}
    </dl>
    <p className="psl-report-sources" data-down={down.length || undefined}>
      {down.length ? `${down.map((source) => source.label).join("、")} 没连上，其余按连上的算。` : `${sources.length} 个来源都连上了：${sources.map((source) => source.label).join(" · ")}`}
    </p>
  </section>;
}

function ProjectCard({ project, now, onOpen }) {
  const { counts } = project;
  return <button type="button" className="psl-card psl-project-card" data-status={project.status} onClick={onOpen}
    aria-label={`${project.name}：工作项在跑 ${counts.running}，要你定 ${counts.decide}，卡住 ${counts.stuck}；会话 ${counts.sessions}`}>
    <span className="psl-card-top">
      <StateGlyph state={project.status} />
      <span className="psl-card-name">{project.name}</span>
      {project.note && <span className="psl-card-note">{project.note}</span>}
      <ArrowRight size={13} className="psl-card-go" />
    </span>
    <span className="psl-stats">
      <Stat value={counts.running} label="在跑" tone="running" />
      <Stat value={counts.decide} label="要你定" tone="decide" />
      <Stat value={counts.stuck} label="卡住" tone="stuck" />
    </span>
    <span className="psl-card-last">{project.last?.text || "还没有动静。"}</span>
    <span className="psl-card-meta">
      {project.last && <span>{project.last.line}</span>}
      <span>工作项 {counts.lines} · 会话 {counts.sessions}</span>
      {project.last && <span>{relativeLabel(project.last.at, now)}</span>}
    </span>
  </button>;
}

function TodayLevel({ snapshot, levels, capture, onOpenLink, onGo, refresh, refreshing }) {
  return <>
    <header className="psb-masthead psl-masthead">
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
          <SourceSettingsButton variant="ghost" icon="ArrowClockwise" size="sm" busy={refreshing} onClick={refresh}>刷新</SourceSettingsButton>
        </div>
      </div>
    </header>
    <div className="psl-today-top">
      <Report report={levels.report} sources={snapshot.sources ?? []} />
      <CaptureBar config={snapshot.capture} onCapture={capture} onOpenLink={onOpenLink} />
    </div>
    <section className="psl-section" aria-labelledby="psl-projects-title">
      <header className="psl-section-head">
        <h2 id="psl-projects-title">项目</h2>
        <span>{levels.projects.length} 个 · 点开看每条线</span>
      </header>
      {levels.projects.length === 0 ? <p className="psl-empty">最近 3 天没有任何线。</p>
        : <div className="psl-grid psl-grid-projects">
          {levels.projects.map((project) => <ProjectCard key={project.id} project={project} now={levels.now}
            onOpen={() => onGo({ level: "project", projectId: project.id })} />)}
        </div>}
    </section>
  </>;
}

/* ---------- level 2: 项目页 ---------- */

function LineProgress({ progress }) {
  if (!progress || progress.kind === "state") return null;
  return <span className="psl-progress" data-kind={progress.kind}>
    {progress.ratio != null && <span className="psl-progress-bar" aria-hidden="true"><i style={{ width: `${Math.round(progress.ratio * 100)}%` }} /></span>}
    <em>{progress.label}</em>
  </span>;
}

function LineCard({ line, now, onOpen }) {
  const model = line.models?.segments?.find((segment) => segment.current)?.model;
  return <button type="button" className="psl-card psl-line-card" data-state={line.state} data-past={line.past || undefined} onClick={onOpen}>
    <span className="psl-card-top">
      <StateGlyph state={line.state} />
      <span className="psl-card-name">{line.name}</span>
      <StateChip state={line.state} />
    </span>
    <LineProgress progress={line.progress} />
    <span className="psl-card-last">{line.summary}</span>
    <span className="psl-card-meta">
      <span>{SOURCE_LABELS[line.source] ?? line.source}</span>
      {line.sessionCount > 0 && <span>会话 {line.sessionCount} · {line.sessionLabel}</span>}
      {model && <span>{shortModel(model)}</span>}
      <span>{line.pastReason || relativeLabel(line.at, now)}</span>
      {line.context && <span className="psl-card-ctx"><ContextWindow context={line.context} /></span>}
    </span>
  </button>;
}

function ProjectLevel({ project, now, onGo }) {
  const [filter, setFilter] = useState("all");
  const [pastOpen, setPastOpen] = useState(false);
  const lines = useMemo(() => filterLines(project.lines, filter), [project.lines, filter]);
  const { counts } = project;
  return <>
    <header className="psl-head">
      <Crumbs trail={[{ id: "today", label: "今天的局面", view: { level: "today" } }, { id: project.id, label: project.name }]} onGo={onGo} />
      <div className="psl-head-main">
        <div>
          <h1>{project.name}</h1>
          <p className="psl-head-sub">{[project.note, project.repo].filter(Boolean).join(" · ") || "没有登记仓库"} · 统计口径：工作项为主 · 会话 {counts.sessions}</p>
        </div>
        <span className="psl-stats psl-stats-head">
          <Stat value={counts.running} label="在跑" tone="running" />
          <Stat value={counts.decide} label="要你定" tone="decide" />
          <Stat value={counts.stuck} label="卡住" tone="stuck" />
          <Stat value={counts.done} label="收口" tone="done" />
        </span>
      </div>
    </header>
    <section className="psl-section" aria-labelledby="psl-lines-title">
      <header className="psl-section-head">
        <h2 id="psl-lines-title">每条线</h2>
        <span>工作项 {lines.length} / {counts.lines} · 会话 {counts.sessions} · 最近 3 天</span>
        <SegmentedControl label="按状态筛选" value={filter} onValueChange={setFilter}
          options={LINE_FILTERS.map((entry) => ({ value: entry.id, label: entry.label }))} />
      </header>
      {lines.length === 0 ? <p className="psl-empty">{filter === "attention" ? "这个项目现在没有要你处理的。" : "这个筛选下没有线。"}</p>
        : <div className="psl-grid psl-grid-lines">
          {lines.map((line) => <LineCard key={line.key} line={line} now={now}
            onOpen={() => onGo({ level: "line", projectId: project.id, lineKey: line.key })} />)}
        </div>}
      {project.past.length > 0 && <div className="psl-past">
        <button type="button" className="psl-past-toggle" aria-expanded={pastOpen} onClick={() => setPastOpen(!pastOpen)}>
          {pastOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          已过去 {project.past.length} 条<em>长时间没有新事件，或是测试、试点记录</em>
        </button>
        {pastOpen && <div className="psl-grid psl-grid-lines">
          {project.past.map((line) => <LineCard key={line.key} line={line} now={now}
            onOpen={() => onGo({ level: "line", projectId: project.id, lineKey: line.key })} />)}
        </div>}
      </div>}
    </section>
  </>;
}

/* ---------- level 3: 线详情 ---------- */

function LineLevel({ project, line, now, onGo, onOpenLink }) {
  const [copied, setCopied] = useState(false);
  const report = useMemo(() => plainText(line.displayReport || line.report || line.detail).replace(/\n/g, " "),
    [line.displayReport, line.report, line.detail]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(line.threadId); setCopied(true); window.setTimeout(() => setCopied(false), 1400); } catch { /* clipboard blocked */ }
  };
  const bare = !line.tools?.length && !line.context && !line.models?.segments?.length;
  return <>
    <header className="psl-head psl-head-line">
      <Crumbs trail={[
        { id: "today", label: "今天的局面", view: { level: "today" } },
        { id: project.id, label: project.name, view: { level: "project", projectId: project.id } },
        { id: line.key, label: line.name },
      ]} onGo={onGo} />
      <div className="psl-head-main">
        <div>
          <h1>{line.name}</h1>
          <p className="psl-head-sub">
            <StateChip state={line.state} />
            <span>{SOURCE_LABELS[line.source] ?? line.source}</span>
            <span>{project.name}</span>
            <span>{relativeLabel(line.at, now)}</span>
            {line.pastReason && <span>{line.pastReason}</span>}
          </p>
        </div>
        <span className="psl-head-actions">
          {line.threadId && <button type="button" onClick={copy}><Copy size={12} />{copied ? "已复制" : "复制线程 ID"}</button>}
          {line.href && <button type="button" onClick={() => onOpenLink?.(line.href)}><ArrowUpRight size={12} />打开原页面</button>}
        </span>
      </div>
    </header>

    <section className="psl-detail" aria-label="单线监视">
      <LineMonitor line={line} now={now} />
      {report && report !== line.summary && <p className="psl-detail-report"><span>最后一条汇报</span>{report}</p>}
    </section>

    {bare ? <section className="psl-detail">
      <p className="psa-muted">{SOURCE_LABELS[line.source] ?? line.source} 这条线只留状态：没有工具调用、上下文和模型记录。</p>
    </section> : <>
      <section className="psl-detail" aria-label="工具调用">
        <h2 className="psl-detail-title">工具调用</h2>
        <ToolCallGroup tools={line.tools} source={line.source} />
      </section>
      <section className="psl-detail psl-detail-pair">
        <div><h2 className="psl-detail-title">上下文地图</h2><ContextMap context={line.context} /></div>
        <div><h2 className="psl-detail-title">模型回退链</h2><FallbackChain models={line.models} /></div>
      </section>
    </>}
    <p className="psl-detail-foot">只读 · 批准、重试要回真实会话（左侧列表或 ⌘K）</p>
  </>;
}

function Missing({ onGo, label }) {
  return <div className="psb-state">
    <span className="psb-eyebrow">不在了</span>
    <h1>{label}</h1>
    <p>最新一次读数里没有它了，可能已经归档。</p>
    <div className="psb-state-actions">
      <SourceSettingsButton variant="secondary" icon="ArrowLeft" onClick={() => onGo({ level: "today" })}>回到今天的局面</SourceSettingsButton>
    </div>
  </div>;
}

/* ---------- loading / error ---------- */

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
  const [view, setView] = useState({ level: "today" });
  const pageRef = useRef(null);
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

  const go = useCallback((next) => {
    setView(next);
    pageRef.current?.scrollTo({ top: 0 });
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

  // Esc goes up one level.
  useEffect(() => {
    if (view.level === "today") return undefined;
    const onKey = (event) => {
      if (event.key !== "Escape" || event.defaultPrevented || event.target?.closest?.("input, textarea, select, [contenteditable]")) return;
      go(view.level === "line" ? { level: "project", projectId: view.projectId } : { level: "today" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, go]);

  const levels = useMemo(() => (state.status === "ready" ? buildBoardLevels(state.snapshot) : null), [state.status, state.snapshot]);

  if (state.status === "loading") return <section className="psb-page psb-page-state" aria-label="总看板"><LoadingState /></section>;
  if (state.status === "error") return <section className="psb-page psb-page-state" aria-label="总看板">
    <ErrorState error={state.error} onRetry={() => refresh({ force: true })} />
  </section>;

  const { snapshot } = state;
  let body;
  if (view.level === "project" || view.level === "line") {
    const { project, line } = findLine(levels, view.projectId, view.lineKey);
    if (!project) body = <Missing onGo={go} label="这个项目最近 3 天没有线了" />;
    else if (view.level === "project") body = <ProjectLevel key={project.id} project={project} now={levels.now} onGo={go} />;
    else if (!line) body = <Missing onGo={go} label="这条线不在最新数据里了" />;
    else body = <LineLevel key={line.key} project={project} line={line} now={levels.now} onGo={go} onOpenLink={onOpenLink} />;
  } else {
    body = <TodayLevel snapshot={snapshot} levels={levels} capture={capture} onOpenLink={onOpenLink} onGo={go}
      refresh={() => refresh({ force: true })} refreshing={state.refreshing} />;
  }
  const levelKey = view.level === "today" ? "today" : view.level === "project" ? `p:${view.projectId}` : `l:${view.lineKey}`;
  return <section ref={pageRef} className="psb-page psl-page" aria-label="总看板" data-level={view.level} data-refreshing={state.refreshing || undefined}>
    <div className="psl-level" key={levelKey}>{body}</div>
    <footer className="psb-origin psl-origin">
      <span>只读来源：Codex ~/.codex/sessions · superagent 127.0.0.1:3082 · T3 127.0.0.1:3773</span>
    </footer>
  </section>;
}
