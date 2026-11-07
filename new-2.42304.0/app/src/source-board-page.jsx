import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { Button } from "./arc/button/button";
import SegmentedControl from "./arc/segmented-control/segmented-control";
import {
  CAPTURE_PROJECTS,
  boardTotals,
  conversationSources,
  groupConversations,
} from "./board-view-model.mjs";
import { buildBriefSummary, buildProjectBriefs } from "./board-brief-model.mjs";
import { buildAgentInbox } from "./board-agent-model.mjs";
import { AgentInbox } from "./agent-state-components.jsx";
import { BriefBoard, ConversationCard, SourceFilter, StatusBar } from "./source-board-components.jsx";
import "./source-board-page.css";
import "./arc-tokens.css";
import "./source-board-v2.css";

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
  const inbox = buildAgentInbox({ columns: snapshot.columns ?? {}, projects: snapshot.projects ?? [], older: snapshot.older?.projects ?? [], now: snapshot.generatedAt });
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
          <SourceSettingsButton variant="ghost" icon="ArrowClockwise" size="sm" busy={state.refreshing} onClick={() => refresh({ force: true })}>刷新</SourceSettingsButton>
        </div>
      </div>
      <StatusBar totals={totals} columns={snapshot.columns ?? {}} stuckSummary={snapshot.stuckSummary} summary={briefSummary} past={inbox.past.length} />
    </header>

    <BriefBoard briefs={briefs} summary={briefSummary} sources={snapshot.sources ?? []} now={snapshot.generatedAt} />
    <CaptureBar config={snapshot.capture} onCapture={capture} onOpenLink={onOpenLink} />
    <AgentInbox inbox={inbox} now={snapshot.generatedAt} onOpenLink={onOpenLink} />
    <ConversationList projects={snapshot.projects ?? []} older={snapshot.older} now={snapshot.generatedAt} />

    <footer className="psb-origin">
      <span>只读来源：Codex ~/.codex/sessions · superagent 127.0.0.1:3082 · T3 127.0.0.1:3773</span>
    </footer>
  </section>;
}
