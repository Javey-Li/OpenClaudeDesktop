/**
 * Model-initiated dynamic workflows: the Harness `workflow` tool
 * (dsh-tool-workflow over dsh-workflow-ptc) → Code Desktop workflow runs.
 *
 * The tool call stays a Codex dynamicToolCall item; the bridge adds
 * `workflowRun` (a bridge field) in the app's own run shape
 * (app/src/workflow-progress-model.mjs: workflow_phase / workflow_agent
 * progress entries), so the transcript row and the Tasks card render it like
 * a run the user started with /workflow.
 *
 *   tool/call workflow              run 'running', declared meta.phases listed
 *   tool-workflow/run-start         the engine's run id (durable record)
 *   workflow/phase                  a phase() call (live engine event only)
 *   tool-workflow/agent-start|end   one agent() member (durable records)
 *   tool-workflow/run-end           completed / stopped / failed (durable)
 *   tool/result                     foreground errors; a background run's job id
 *
 * Durable records replay with the session log, so a resumed session shows the
 * same run (phase() calls are not recorded; agents carry their phase).
 */

/** The model-facing tool name (dsh-tool-workflow `toolName`, default config). */
export const WORKFLOW_TOOL = 'workflow'

const RECORD_TYPES = new Set(['tool-workflow/run-start', 'tool-workflow/agent-start', 'tool-workflow/agent-end', 'tool-workflow/run-end'])
export const isWorkflowRecord = (type) => RECORD_TYPES.has(type)

// dsh-tool-workflow's background acceptance text (README "Tool-call history and result").
const BACKGROUND_JOB = /started in the background as job (\S+?)\.(?:\s|$)/u
const STOP_STATUS = { completed: 'completed', cancelled: 'stopped', error: 'failed' }
const AGENT_STATE = { completed: 'done', failed: 'error', cancelled: 'error' }
const AGENT_ERROR = { failed: 'Agent failed', cancelled: 'Agent cancelled' }

const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null)

function clone(run) {
  return { ...run, sequence: (run.sequence ?? 0) + 1, workflowProgress: (run.workflowProgress ?? []).map((entry) => ({ ...entry })) }
}

// workflowEvent's phase(): find by title, else append with the next index.
function phaseOf(progress, title) {
  let found = progress.findLast((entry) => entry.type === 'workflow_phase' && entry.title === title)
  if (!found) {
    found = { type: 'workflow_phase', index: progress.filter((entry) => entry.type === 'workflow_phase').length, title }
    progress.push(found)
  }
  return found
}

function withUsage(run) {
  run.usage = { totalTokens: run.workflowProgress.reduce((sum, entry) => sum + (entry.tokens || 0), 0) }
  return run
}

/**
 * The run a `workflow` tool call starts. Until the engine names it
 * (run-start) its id is the call's, so the app can address it at once.
 * @param {any} args - the tool call's parsed arguments ({meta, script, args?, run_in_background?})
 */
export function workflowRunOf(args, callId, time) {
  const meta = args?.meta && typeof args.meta === 'object' ? args.meta : {}
  const name = text(meta.name) ?? 'workflow'
  const run = {
    id: `call-${callId}`,
    source: 'model',
    callId,
    runId: null,
    name,
    description: text(meta.description) ?? name,
    status: 'running',
    startedAt: time,
    background: args?.run_in_background === true,
    sequence: 1,
    workflowProgress: [],
  }
  for (const phase of Array.isArray(meta.phases) ? meta.phases : []) {
    const title = text(phase?.title)
    if (title) phaseOf(run.workflowProgress, title)
  }
  return withUsage(run)
}

/** A phase() call. */
export function workflowPhase(run, title, time) {
  const label = text(title)
  if (!label || run.status !== 'running') return run
  const next = clone(run)
  const phase = phaseOf(next.workflowProgress, label)
  next.currentPhase = phase.index
  return withUsage(next)
}

/** One durable `tool-workflow/*` record. */
export function workflowRecord(run, type, data, time) {
  const next = clone(run)
  const progress = next.workflowProgress
  const agents = progress.filter((entry) => entry.type === 'workflow_agent')
  switch (type) {
    case 'tool-workflow/run-start':
      if (typeof data?.runId === 'string' && data.runId) {
        next.runId = data.runId
        next.id = data.runId
      }
      if (text(data?.name)) next.name = text(data.name)
      break
    case 'tool-workflow/agent-start': {
      const id = String(data?.seq ?? agents.length + 1)
      if (agents.some((agent) => agent.id === id)) break
      const group = text(data?.phase) ? phaseOf(progress, text(data.phase))
        : Number.isInteger(next.currentPhase) ? progress.find((entry) => entry.type === 'workflow_phase' && entry.index === next.currentPhase) : undefined
      progress.push({
        type: 'workflow_agent', index: agents.length, id, label: text(data?.label) ?? 'Agent', state: 'progress',
        ...(group ? { phaseIndex: group.index, phaseTitle: group.title } : {}),
        ...(typeof data?.childId === 'string' ? { childId: data.childId } : {}),
        startedAt: time, lastProgressAt: time,
      })
      break
    }
    case 'tool-workflow/agent-end': {
      const agent = agents.find((candidate) => candidate.id === String(data?.seq))
      if (!agent || agent.state !== 'progress') break
      agent.state = AGENT_STATE[data?.outcome] ?? 'error'
      if (agent.state === 'error') agent.error = AGENT_ERROR[data?.outcome] ?? 'Agent failed'
      if (Number.isFinite(agent.startedAt)) agent.durationMs = Math.max(0, time - agent.startedAt)
      break
    }
    case 'tool-workflow/run-end':
      return settle(next, STOP_STATUS[data?.stopReason] ?? 'failed', time, run.summary)
    default:
      return run
  }
  return withUsage(next)
}

/**
 * The tool's own result. Foreground: a failure settles the run with the
 * tool's error text (run-end may never come when the run could not start).
 * Background: the acceptance names the job the Stop control kills.
 */
export function workflowToolResult(run, { isError, text: output }, time) {
  if (!isError) {
    const job = BACKGROUND_JOB.exec(output ?? '')
    if (!job) return run
    const next = clone(run)
    next.background = true
    next.jobId = job[1]
    return withUsage(next)
  }
  const message = text(output)?.replace(/^Error:\s*/u, '') ?? 'Workflow failed'
  if (run.status !== 'running') return run.summary ? run : { ...run, summary: message }
  const stopped = /\bcancelled\b/u.test(message)
  return settle(clone(run), stopped ? 'stopped' : 'failed', time, message)
}

/** The tool call ended without a result (turn interrupted, session restarted). */
export function workflowInterrupted(run, time) {
  if (run.status !== 'running' || run.background) return run
  return settle(clone(run), 'stopped', time, 'Stopped')
}

function settle(run, status, time, summary) {
  run.status = status
  run.completedAt = time
  run.durationMs = Number.isFinite(run.startedAt) ? Math.max(0, time - run.startedAt) : undefined
  if (status !== 'completed') run.summary = summary ?? (status === 'stopped' ? 'Stopped' : 'Workflow failed')
  for (const entry of run.workflowProgress) {
    if (entry.type !== 'workflow_agent' || entry.state !== 'progress') continue
    entry.state = 'error'
    entry.error = status === 'stopped' ? 'Stopped before completion' : 'Workflow ended before completion'
  }
  return withUsage(run)
}
