// The "Suggested task" card (2.2553.1 code-transcript.js ud, :1430-1720): tasks the agent suggested with spawn_task
// (OpenClaude Desktop's agent tools, electron/agent-tools/session.mjs) float at the top right of the transcript, newest
// first, stacked when there are more: "Suggested task · in {dir}", the title, the tldr (the prompt on hover), X to
// dismiss, "{position} of {count}" to step through them, and Start, which starts a new session with the task's prompt
// in its folder. Nothing runs until the user clicks Start. A dismissed or started task stays gone for this viewer
// (browser storage: a per-viewer convenience); dismiss_task withdraws one for everyone. B29: X also files the task in
// its folder's backlog (onDismiss → main task-backlog-file), which Home lists under its composer.
import React, { useMemo, useState } from "react";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { suggestedTasks } from "./agent-tool-titles.mjs";
import { t } from "../electron/i18n/index.mjs";
import "./source-suggested-tasks.css";

const STORAGE_PREFIX = "code-desktop:dismissed-tasks:";
function readDismissed(sessionId) {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_PREFIX + sessionId);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((id) => typeof id === "string").slice(-200) : [];
  } catch { return []; }
}
function writeDismissed(sessionId, list) {
  try { globalThis.localStorage?.setItem(STORAGE_PREFIX + sessionId, JSON.stringify(list.slice(-200))); } catch { /* storage unavailable: dismissed for this view only */ }
}
const folderName = (dir) => String(dir ?? "").split("/").filter(Boolean).pop() || String(dir ?? "");

export function SourceSuggestedTasks({ items, sessionId, cwd = null, disabled = false, onStart, onDismiss }) {
  const [dismissed, setDismissed] = useState(() => (sessionId ? readDismissed(sessionId) : []));
  const [index, setIndex] = useState(0);
  const tasks = useMemo(() => suggestedTasks(items, dismissed), [items, dismissed]);
  if (!sessionId || !tasks.length) return null;
  const position = Math.min(index, tasks.length - 1);
  const task = tasks[position];
  const withdraw = (id) => {
    const next = [...new Set([...dismissed, id])];
    setDismissed(next);
    writeDismissed(sessionId, next);
  };
  const dir = task.cwd && task.cwd !== cwd ? task.cwd : null;
  const count = tasks.length;
  return <div className="sst-anchor" data-suggested-tasks="">
    <div className="sst-stack">
      {count > 2 && <div aria-hidden="true" className="sst-layer sst-layer-3" />}
      {count > 1 && <div aria-hidden="true" className="sst-layer sst-layer-2" />}
      <div className="sst-card" key={task.id} data-suggested-task={task.id}>
        <div className="sst-head">
          <div className="sst-copy" role="status">
            <div className="sst-kicker">
              <span className="sst-label">{t("Suggested task")}</span>
              {dir && <span className="sst-dir" title={dir}>{t("· in {dir}", { dir: folderName(dir) })}</span>}
            </div>
            <span className="sst-title">{task.title}</span>
            {task.tldr && <span className="sst-tldr" title={task.prompt}>{task.tldr}</span>}
          </div>
          <SourceSettingsButton variant="ghost" icon="X" iconOnly className="sst-dismiss" aria-label={t("Dismiss suggestion")}
            onClick={() => { withdraw(task.id); onDismiss?.(task); }} />
        </div>
        <div className="sst-actions">
          {count > 1 && <span className="sst-nav">
            <SourceSettingsButton variant="ghost" icon="CaretLeft" iconOnly className="sst-prev" aria-label={t("Show previous suggestion")}
              disabled={position === 0} title={position === 0 ? t("No previous suggestion") : undefined} onClick={() => setIndex(Math.max(0, position - 1))} />
            {t("{position} of {count}", { position: position + 1, count })}
            <SourceSettingsButton variant="ghost" icon="CaretRight" iconOnly aria-label={t("Show next suggestion")}
              disabled={position === count - 1} title={position === count - 1 ? t("No next suggestion") : undefined} onClick={() => setIndex(Math.min(count - 1, position + 1))} />
          </span>}
          <SourceSettingsButton variant="primary" disabled={disabled} onClick={() => { withdraw(task.id); onStart?.(task); }}>{t("Start")}</SourceSettingsButton>
        </div>
      </div>
    </div>
  </div>;
}
