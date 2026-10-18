import React, { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useState, useSyncExternalStore } from "react";
import { createFinishedTaskHold, sparkState, taskButtonLabel, transcriptSparkSize, transcriptStatusPresentation } from "./transcript-status-model.mjs";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { SourceSpark, SPARK_PATH } from "./source-spark.jsx";
import "./source-transcript-status.css";
import { t } from "../electron/i18n/index.mjs";
import { createThinkingReader, elapsedTurnSeconds, runtimeStatLabels, subscribeThinkingClock, subscribeTurnClock, thinkingChangeAt, turnActivity } from './transcript-runtime-stats.mjs';
import { createActivityLabelStore } from './activity-label-store.mjs';

// The static path now lives in source-spark.jsx; re-exported for existing imports.
export const TRANSCRIPT_SPARK_PATH = SPARK_PATH;

const noElapsedOnServer = () => null;
// Whe :58132-58145 over createFinishedTaskHold (the timer lives in the model).
export function useFinishedTaskHold(running, owner = null) {
  const [, rerender] = useReducer(count => count + 1, 0);
  const [hold] = useState(() => createFinishedTaskHold(rerender));
  useEffect(() => { hold.update(running, owner); }, [hold, running, owner]);
  useEffect(() => () => hold.dispose(), [hold]);
  return hold.finished(running, owner);
}
// Du thinking state of the running turn: re-read on item changes and when its
// minimum-active or "Thought for Ns" hold runs out. The app never hydrates, so
// the server snapshot reads the clock too (SSR tests render the done state).
function useThinkingState(turnId, items, itemPhases, enabled) {
  const read = useMemo(() => createThinkingReader(enabled ? turnId : null, items || [], itemPhases || {}), [enabled, turnId, items, itemPhases]);
  const subscribe = useCallback(notify => subscribeThinkingClock(nowMs => enabled ? thinkingChangeAt(turnId, items || [], itemPhases || {}, nowMs) : null, notify),
    [enabled, turnId, items, itemPhases]);
  const snapshot = () => read(Date.now());
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
export function SourceTranscriptStatus({ textSize = "m", turnId, turnStats, items, itemPhases,
  runningTaskCount = 0, tasksPaneOpen = false, onToggleTasksPane = null, onToggleThinking = null, thinkingShown = false, onOpenLink = null, ...state }) {
  const view = transcriptStatusPresentation(state);
  const finishedTaskCount = useFinishedTaskHold(runningTaskCount, state.sessionKey ?? null);
  const owned = turnId && turnStats?.turnId === turnId ? turnStats : null;
  const startedAt = view.phase === 'running' ? owned?.startedAt ?? null : null;
  const subscribe = useCallback(notify => subscribeTurnClock(startedAt, notify), [startedAt]);
  const snapshot = useCallback(() => elapsedTurnSeconds(startedAt, Date.now()), [startedAt]);
  const elapsed = useSyncExternalStore(subscribe, snapshot, noElapsedOnServer);
  // apiRetry replaces the activity label (and token stat) until Codex resumes.
  const working = view.phase === 'running' && !view.retry;
  const thinking = useThinkingState(turnId, items, itemPhases, working);
  const activity = working ? turnActivity(turnId, items, itemPhases, elapsed, thinking) : null;
  const immediateLabel = activity?.label || view.label;
  const waiting = working && (!activity || activity.kind === 'tools');
  const owner = JSON.stringify([state.sessionKey, turnId, view.phase]);
  const [labels] = useState(() => createActivityLabelStore({ owner, waiting, label: immediateLabel }));
  const settledLabel = useSyncExternalStore(labels.subscribe, labels.getSnapshot, () => immediateLabel);
  useLayoutEffect(() => { labels.update({ owner, waiting, label: immediateLabel }); }, [labels, owner, waiting, immediateLabel]);
  // Stop/approval/disconnect must never announce held tool activity.
  const label = waiting ? settledLabel : immediateLabel;
  // Y5 :58637-58668: while thinking is active the label is a button that shows
  // or hides reasoning in the transcript; "Thought for Ns" (done) is a plain,
  // non-shimmering span (z = R !== null && p?.kind !== "done").
  const thinkingLabelShown = !waiting && activity?.kind === 'thinking';
  const thinkingToggle = thinkingLabelShown && activity.thinking?.kind === 'active' && typeof onToggleThinking === 'function';
  const thoughtLabel = thinkingLabelShown && activity.thinking?.kind === 'done';
  const stats = view.phase === 'running' ? runtimeStatLabels(elapsed, owned?.outputTokens) : [];
  // Y5 apiRetry keeps only the elapsed clock, after the retry text.
  const retryElapsed = view.retry ? stats[0] : undefined;
  // Y5 K/P (scroll-messages-current.js:58273-58327): ghost xs flush Button,
  // pressed while the tasks pane is open, shown only with a pane toggle and a
  // running or held-finished count. The apiRetry branch (F) has no q().
  const taskLabel = onToggleTasksPane && !view.retry ? taskButtonLabel(runningTaskCount, finishedTaskCount) : null;
  // Every invisible local presentation is a source state without a Y5 row
  // (home, loading, hideLoader when the approval card replaces the loader),
  // so the button never resurrects the row on its own.
  if (!view.visible) return null;
  const size = transcriptSparkSize(textSize);
  const separator = <span className="sts-separator" aria-hidden="true">·</span>;
  const tasks = taskLabel && <SourceSettingsButton variant="ghost" size="xs" flush="both" className="sts-tasks"
    aria-pressed={!!tasksPaneOpen} onClick={onToggleTasksPane}><span className="sts-tasks-label">{taskLabel}</span></SourceSettingsButton>;
  // G (:58293-58298): stopping = label · q(true); idle (not working, P) = q(false);
  // otherwise the stats branch (:58615-58628) = stats [·] q · status.
  const idleTasks = tasks && view.phase === "idle";
  const shown = view.announce || !!tasks;
  return (
    <div
      className="source-transcript-status"
      data-testid="code-transcript-status"
      data-transcript-status={view.phase}
      aria-hidden={!shown || undefined}
    >
      <div
        className={`sts-row${view.busy ? " source-working" : ""}`}
        data-testid={view.busy ? "code-working-line" : undefined}
        data-working-row={view.busy ? "" : undefined}
      >
        {/* Classic Y5: Spark state is "thinking" whenever working or stopping;
            reduced motion, a missing strip or a load failure keep the static svg. */}
        <SourceSpark className="sts-spark" size={size} state={sparkState(view)} />
        <span
          className="sts-label"
          data-visible={shown}
          aria-hidden={!shown || undefined}
          role={view.announce ? "status" : undefined}
          aria-live={view.announce ? "polite" : undefined}
          aria-atomic={view.announce || undefined}
          aria-label={view.announce ? label : undefined}
        >
          {view.retry ? <>
            <span className="sts-activity" data-retry-error="">{view.retry.error}</span><span className="sts-separator" aria-hidden="true">·</span>
            <span className="sts-stat" data-retrying="">{view.retry.label}</span>
            {view.retry.later && <><span className="sts-separator" aria-hidden="true">·</span><span className="sts-stat" data-retry-next="">{view.retry.later}</span></>}
            {retryElapsed && !view.retry.later && <><span className="sts-separator" aria-hidden="true">·</span><span className="sts-stat" data-runtime-stat="elapsed">{retryElapsed}</span></>}
            {view.retry.detail && <><span className="sts-separator" aria-hidden="true">·</span><span className="sts-stat sts-retry-detail" data-retry-detail="" title={view.retry.detail}>{view.retry.detail}</span></>}
            {view.retry.link && onOpenLink && <><span className="sts-separator" aria-hidden="true">·</span>
              <button type="button" className="sts-retry-link" data-retry-link="" onClick={() => onOpenLink(view.retry.link.url)}>{view.retry.link.label}</button></>}
          </> : idleTasks ? tasks : view.phase === "stopping" ? <>
            <span className="source-shimmer sts-activity">{label}</span>
            {tasks && <>{separator}{tasks}</>}
          </> : <>
            {stats.map((stat, index) => <React.Fragment key={index}>
              <span className="sts-stat" data-runtime-stat={index === 0 ? 'elapsed' : 'tokens'}>{stat}</span><span className="sts-separator" aria-hidden="true">·</span>
            </React.Fragment>)}
            {tasks && <>{tasks}{separator}</>}
            {thinkingToggle ? <button aria-label={t(thinkingShown ? '{label}, hide from transcript' : '{label}, show in transcript', { label })} type="button"
              className="source-shimmer sts-activity sts-thinking-toggle" onClick={onToggleThinking}>{label}</button>
              : <span className={view.busy && !thoughtLabel ? 'source-shimmer sts-activity' : 'sts-activity'}>{label}</span>}
          </>}
        </span>
      </div>
    </div>
  );
}
