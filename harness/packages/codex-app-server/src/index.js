/**
 * Codex app-server compatible JSON-RPC on stdio, served from inside a DeepSeek
 * Harness runtime. Code Desktop speaks the Codex v2 protocol it was built for;
 * this plugin answers with Harness agents, sessions, streaming, tools and
 * approvals.
 *
 * Mapping summary
 *   thread              Harness session (agent while loaded)
 *   turn                Harness turn (id from its first human message)
 *   item/*              durable session events + live assistant-stream frames
 *   requestApproval     the `approval/request` waterfall (allow once / reject;
 *                       session grants, reasons and extra roots: approval.js)
 *   requestUserInput    the `user-questions/request` waterfall (questions.js)
 *   sandbox/approval    Harness permission presets; Plan is Harness plan mode
 *   thread/queue/*      the agent's durable next-turn inbox (queue.js)
 *   thread/compact      `/compact` as a Codex compaction turn (compact.js)
 *   unknown thread id   INVALID_PARAMS + codexErrorInfo threadNotFound (errors.js)
 *   session list        headers + the shared projection cache, no log replay
 *                       (list.js); idle threads unload on thread/unsubscribe
 *                       and thread/archive
 *   sub-agents          child sessions as Codex spawned threads (subagents.js);
 *                       their durable events are projected live under the
 *                       child id; Ask-mode approvals land on the root thread
 *   settings catalog    skills/list, config/read, mcpServerStatus/list and
 *                       plugin/installed|read from the skill registry, the
 *                       profile's MCP client entries and bundles (catalog.js)
 *   account             account/read from the credentials service (account.js);
 *                       account/usage/read folded from session logs (usage.js);
 *                       codeDesktop/stats/read: the home card's getCodeStats
 *                       shape from the same folds
 *   user input          Codex parts ↔ Harness content (input.js): images are
 *                       attachment-store image blocks, skills the /name gesture
 *   developerInstructions / outputSchema
 *                       a scoped prompt section / a one-turn structured_output
 *                       capture tool on the agent's scope (structured.js)
 *   plugin management   codeDesktop/plugin/* over dsh-plugin-manager (plugins.js)
 *   dynamic workflows   the Harness `workflow` tool's runs as workflowRun on its
 *                       item (workflows.js); codeDesktop/workflow/stop
 *
 * @module @code-desktop/dsh-codex-app-server
 */

import { randomUUID } from 'node:crypto'
import os from 'node:os'
import { isAbsolute } from 'node:path'
import { realpath } from 'node:fs/promises'
import z from '@deepseek-ai/schemastery'
import { createUserMessage, errorChain } from '@deepseek-ai/dsh-llm'
import { installModelSelection } from '@deepseek-ai/dsh-agent'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { LineTransport, RpcError, METHOD_NOT_FOUND, INVALID_PARAMS, invalidParams } from './transport.js'
import { ModelCatalog, modalitiesOf } from './models.js'
import { LiveStreamMapper, ThreadProjector, failureError, parseArguments, resumeReplayNotes, toolItem, userInputsOf } from './projection.js'
import { toHarnessContent } from './input.js'
import { ThreadStore } from './store.js'
import { ThreadQueue } from './queue.js'
import { runCompact } from './compact.js'
import { isSessionOwnedElsewhere, isThreadNotFound, requireSession, sessionBusyElsewhere, skillToggleUnsupported } from './errors.js'
import { configReadResponse, latestThreadIn, mcpClientEntries, mcpServerStatuses, pluginReadResponse, pluginsInstalledResponse, serverNameOf, skillsListEntry } from './catalog.js'
import { SessionGrants, acceptsEdit, applyPermissions as applyThreadPermissions, applyPreset as applyThreadPreset, approvalAnswer, approvalDecision, childApproval, childDecision, livePermissions, preExecuteDecision, rootThreadFor } from './approval.js'
import { sourceFilter, threadLineage } from './subagents.js'
import { afterPlanPermission, approvedAfterPlan, codexQuestions, harnessAnswer, isPlanApproval, questionFailure, questionItemId } from './questions.js'
import { DEEPSEEK_KEY_REF, accountReadResponse, providerAccountResponse } from './account.js'
import { UsageCache, accountTokenUsage, codeStats, localDayKey, sessionUsageSummaries } from './usage.js'
import { CacheRevisions, cachedValues, coldRow, descendantIds, matchesSearch, mustStayLoaded, ownsRunningJob, readColdThread, registerListProjection, seedable, titleOf } from './list.js'
import { installLogParams, pluginRequest } from './plugins.js'
import { attachDeveloperInstructions, attachStructuredOutput, developerInstructionsOf, hideWorkflowTool, outputSchemaOf, workflowsAllowedBy } from './structured.js'
import { createCustomRef, applyCustomization, installCustomization } from './customization.js'
import { profileReadResponse } from './profile.js'
import { ALIASES as PRICE_ALIASES, DEEPSEEK_PRICES, PEAK_WINDOWS, PRICING_URL } from './pricing.js'

export const name = 'codex-app-server'
export const inject = ['codeDesktopStartup', 'agents', 'llm', 'sessionPersistence', 'sessions']

export const Config = z.object({
  provider: z.string().default('deepseek-official'),
  model: z.string().default('deepseek-flash'),
  stateDir: z.string().default(''),
})

const VERSION = '0.1.0'
const DSH_VERSION = '0.2.0-rc.2'
// What this core can do, reported by initialize (the app keeps it as boot.core.capabilities).
// unsupportedMethods: Codex requests the client should not offer (they always fail here).
// skillToggle: skills/config/write works (no: Harness has no per-skill switch).
// mcpConfigWrite: config/batchWrite can add or remove MCP servers (no: edit the profile patch).
// livePermissions: codeDesktop/thread/permissions applies a Mode change to a running thread (the app keeps
// Mode usable during a turn and sends it only to a core that lists this capability).
// codeStats: codeDesktop/stats/read serves the home stats card (the app falls back to its own ledger without it).
// modelWorkflows: the model's `workflow` tool reports runs as item.workflowRun, stopped by codeDesktop/workflow/stop.
// structuredOutput: thread/start developerInstructions and turn/start outputSchema are honored (structured.js).
// pluginManage (set at initialize when the profile has dsh-plugin-manager): codeDesktop/plugin/* install,
// remove and enable bundles (plugins.js).
const CAPABILITIES = { unsupportedMethods: ['thread/fork', 'review/start', 'thread/revert'], skillToggle: false, mcpConfigWrite: false, livePermissions: true, codeStats: true, modelWorkflows: true, structuredOutput: true }

// How long after start account/read waits for the credentials and account services.
const ACCOUNT_SERVICE_WAIT_MS = 5000
// How long after start cold list rows wait for the projection registry and cache.
const LIST_SERVICE_WAIT_MS = 5000

const seconds = (ms) => Math.floor(ms / 1000)
// The abort reason a stopped /compact logs in its compaction/end error.
const compactionInterrupted = () => Object.assign(new Error('Compaction interrupted.'), { name: 'AbortError' })

export function apply(ctx, config) {
  const logger = ctx.logger('codex-app-server')
  const fallback = { provider: config.provider, model: config.model }
  const catalog = new ModelCatalog(ctx.llm, fallback)
  // Bridge metadata lives with the Harness home it belongs to ($DSH_HOME aware).
  const stateDir = config.stateDir || process.env.CODE_DESKTOP_CORE_STATE || `${resolveDshHome()}/code-desktop`
  const store = new ThreadStore(stateDir)
  // Per-session usage folds for account/usage/read and codeDesktop/stats/read (usage.js), loaded on first use.
  let usageCache
  let usageRead = null
  /** @type {Map<string, LiveThread>} */
  const threads = new Map()
  /** Running sub-agents of live threads, by child session id. @type {Map<string, ChildThread>} */
  const children = new Map()
  const opening = new Map()
  /** Threads unloading in the background (thread/unsubscribe), by id: a reopen waits for the lock. */
  const unloading = new Map()
  // "Allow for this session" grants by thread id, for the life of the core:
  // a thread unloaded when the client left it gets them back on reopen.
  /** @type {Map<string, SessionGrants>} */
  const grantsById = new Map()
  let closed = false
  // Set by initialize: notifications before it would reach a client that has not asked yet.
  let clientReady = false

  const transport = new LineTransport(process.stdin, process.stdout, {
    onRequest: (method, params, id) => handle(method, params, id),
    onNotification: () => {},
    onClose: () => void quiesce(),
    log: (message) => logger.warn(message),
  })
  const notify = (method, params) => transport.notify(method, params)
  // A user image block's stored file (attachment-local: the normalized copy under DSH_HOME).
  const imagePath = (ref) => ctx.get('attachments')?.imageHostPath(ref)

  // Cold list rows read the shared projection cache. Registering the upstream
  // sessionListMetadata unit keeps its row (blank, lastPromptAt) in every
  // checkpoint this process writes, as the DeepSeek app does (list.js).
  // Both services start after this plugin serves stdio, so the app's first
  // reads can arrive before them: projectionCache() waits for them (and the
  // revision listing) briefly instead of answering with a full log replay.
  let listProjectionRegistered = false
  let listServicesReady = false
  const listServicesStarted = Date.now()
  // The log revisions this process's cache table reflects (list.js): the
  // table loads once, so a log another process wrote since is replayed.
  const cacheRevisions = new CacheRevisions()
  const listServices = Promise.all([
    new Promise((resolve) => ctx.inject(['sessionProjections'], (inner) => {
      const dispose = registerListProjection(inner.get('sessionProjections'), (error) => logger.warn(`sessionListMetadata projection not registered: ${errorChain(error)}`))
      listProjectionRegistered = dispose !== undefined
      resolve()
    })),
    // The listing comes after the table loaded (the service is active).
    new Promise((resolve) => ctx.inject(['sessionProjectionCache'], () => {
      Promise.resolve().then(() => ctx.sessionPersistence.list())
        .then((snapshots) => cacheRevisions.start(snapshots), (error) => logger.warn(`session revisions unavailable: ${errorChain(error)}`))
        .finally(resolve)
    })),
  ]).then(() => { listServicesReady = true })
  async function projectionCache() {
    const wait = listServicesStarted + LIST_SERVICE_WAIT_MS - Date.now()
    if (wait > 0 && !listServicesReady) {
      let timer
      await Promise.race([listServices, new Promise((resolve) => { timer = setTimeout(resolve, wait) })])
      clearTimeout(timer)
    }
    return ctx.get('sessionProjectionCache')
  }

  // ---------------------------------------------------------------- threads

  class LiveThread {
    constructor(handle, cwd, agentCtx) {
      this.handle = handle
      // The agent's scope: per-thread prompt sections and the turn's structured capture (structured.js).
      this.agentCtx = agentCtx
      // {schema, messageId, dispose, started} while a turn/start outputSchema applies.
      this.structured = null
      // Shows the `workflow` tool again; set while it is hidden (structured.js hideWorkflowTool).
      this.workflowGate = null
      this.agent = handle.agent
      this.id = handle.agent.session.id
      this.cwd = cwd
      this.selection = { current: undefined, assembled: undefined }
      // mode/afterPlan: the app's mode hint (questions.js permissionHint), when sent.
      // extraRoots: the client's writable roots besides cwd (approval.js extraRootsOf).
      this.permission = { approvalPolicy: 'on-request', sandbox: 'workspace-write', mode: undefined, afterPlan: 'auto', extraRoots: [] }
      this.projector = new ThreadProjector({ threadId: this.id, cwd, toolDefinition: (toolName) => toolDefinition(toolName, this.agent), inheritedHistory: inheritedHistoryFor(handle.agent.session.header), imagePath })
      this.stream = new LiveStreamMapper({ threadId: this.id, projector: this.projector })
      this.hydrating = true
      this.buffered = []
      this.sessionGrants = grantsById.get(this.id) ?? new SessionGrants()
      grantsById.set(this.id, this.sessionGrants)
      // Calls the Ask-mode pre-execute hook asked about; any other approval is an escalation.
      this.askedCalls = new Set()
      // Client requests in flight (approvals and questions), by request id.
      this.pendingApprovals = new Map()
      // Tool calls whose question card is open (questionItemId skips them).
      this.askingItems = new Set()
      this.totals = { totalTokens: 0, inputTokens: 0, cachedInputTokens: 0, cacheWriteInputTokens: 0, outputTokens: 0, reasoningOutputTokens: 0 }
      // Prompts, replies and turn bounds only (projection.js lastActivityMs):
      // opening a session or changing its preset is not activity.
      this.lastActivityMs = null
      this.closing = null
      this.queue = new ThreadQueue({ agent: this.agent, threadId: this.id, notify, inputMessage: (input) => inputMessage(input, this), imagePath })
      // {controller, startedTurn} while a thread/compact/start runs.
      this.compaction = null
    }

    hydrate(events) {
      for (const event of events) this.projector.apply(event)
      this.projector.settleStaleCompaction()
      for (const event of events) if (event.type === 'assistant/message' && event.data?.usage) this.addUsage(event.data.usage)
      this.lastActivityMs = this.projector.lastActivityMs
      this.hydrating = false
      const buffered = this.buffered.splice(0)
      for (const event of buffered) this.onEvent(event)
    }

    onEvent(event) {
      if (this.hydrating) {
        this.buffered.push(event)
        return
      }
      let notes
      try {
        notes = this.projector.apply(event)
      } catch (error) {
        logger.warn(`projection failed for ${event.type}: ${errorChain(error)}`)
        return
      }
      // Never behind the turn/start request that bumped it.
      const activity = this.projector.lastActivityMs
      if (activity !== null && (this.lastActivityMs === null || activity > this.lastActivityMs)) this.lastActivityMs = activity
      for (const note of notes) notify(note.method, note.params)
      releasePhases(this, event)
      if (event.type === 'assistant/message' && event.data?.usage) {
        this.addUsage(event.data.usage)
        const turnId = this.projector.turnIdFor(event.data.turn)
        if (turnId) notify('thread/tokenUsage/updated', { threadId: this.id, turnId, tokenUsage: this.tokenUsage(event.data.usage) })
      }
      this.trackStructured(event)
      if (event.type === 'turn/end') {
        this.stream.endTurn(event.data.turn)
        // An ask the approval service settled without a card (policy, abort) leaves its id.
        this.askedCalls.clear()
      }
      // A child this thread just made: its label names it in thread/list.
      if (event.type === 'subagent/catalog') rememberLabel(event.data?.childId, this.projector.childLabel(event.data?.childId))
    }

    /**
     * The outputSchema of a turn/start applies to that turn only: attached when
     * its message lands (at once when the agent was idle), removed at its end.
     */
    applyStructured(schema, messageId) {
      this.dropStructured()
      this.structured = { schema, messageId, dispose: null, started: false }
      if (this.agent.status !== 'running' && !this.projector.activeTurn) this.attachStructured()
    }

    attachStructured() {
      const pending = this.structured
      if (!pending || pending.dispose || !this.agentCtx) return
      try {
        pending.dispose = attachStructuredOutput(this.agentCtx, pending.schema)
      } catch (error) {
        logger.warn(`structured output for ${this.id}: ${errorChain(error)}`)
        this.structured = null
      }
    }

    dropStructured() {
      const pending = this.structured
      this.structured = null
      try { pending?.dispose?.() } catch {}
    }

    trackStructured(event) {
      const pending = this.structured
      if (!pending) return
      if (event.type === 'user/message' && event.data?.id === pending.messageId) {
        this.attachStructured()
        pending.started = true
      } else if (event.type === 'turn/start' && pending.dispose) pending.started = true
      else if (event.type === 'turn/end' && pending.started) this.dropStructured()
    }

    /**
     * The model's `workflow` tool follows the app's Dynamic workflows setting.
     * Hidden until a request allows it, so a client that never says (the
     * workflow runner's own agents) gets no nested workflows.
     */
    gateWorkflows(params, initial = false) {
      const allowed = workflowsAllowedBy(params)
      if (allowed === true && this.workflowGate) {
        this.workflowGate()
        this.workflowGate = null
      } else if ((allowed === false || (allowed === null && initial)) && !this.workflowGate && this.agentCtx) {
        this.workflowGate = hideWorkflowTool(this.agentCtx)
      }
    }

    addUsage(usage) {
      const cached = usage.cacheReadTokens ?? 0
      const input = (usage.inputTokens ?? 0) + cached + (usage.cacheWriteTokens ?? 0)
      this.totals.inputTokens += input
      this.totals.cachedInputTokens += cached
      this.totals.cacheWriteInputTokens += usage.cacheWriteTokens ?? 0
      this.totals.outputTokens += usage.outputTokens ?? 0
      this.totals.reasoningOutputTokens += usage.reasoningTokens ?? 0
      this.totals.totalTokens += usage.totalTokens ?? input + (usage.outputTokens ?? 0)
    }

    tokenUsage(usage) {
      const cached = usage?.cacheReadTokens ?? 0
      const input = (usage?.inputTokens ?? 0) + cached + (usage?.cacheWriteTokens ?? 0)
      let contextTokens = input + (usage?.outputTokens ?? 0)
      try {
        const measured = ctx.get('tokenMeter')?.measure(this.agent.session)?.totalTokens
        if (Number.isFinite(measured)) contextTokens = measured
      } catch {}
      return {
        total: { ...this.totals },
        last: {
          totalTokens: contextTokens,
          inputTokens: input,
          cachedInputTokens: cached,
          cacheWriteInputTokens: usage?.cacheWriteTokens ?? 0,
          outputTokens: usage?.outputTokens ?? 0,
          reasoningOutputTokens: usage?.reasoningTokens ?? 0,
        },
        modelContextWindow: this.contextWindow(),
      }
    }

    contextWindow() {
      try {
        const size = this.agent.session.requestContext?.()?.contextWindow
        if (Number.isFinite(size)) return size
      } catch {}
      return catalog.entryFor(this.selection.current)?.info?.context?.contextWindow ?? null
    }

    status() {
      if (this.pendingApprovals.size > 0) return { type: 'active', activeFlags: [...new Set([...this.pendingApprovals.values()].map((pending) => pending.flag))] }
      return this.agent.status === 'running' || this.projector.activeTurn || this.compaction ? { type: 'active', activeFlags: [] } : { type: 'idle' }
    }

    publishStatus() {
      notify('thread/status/changed', { threadId: this.id, status: this.status() })
    }

    // Live assistant-stream frames → agentMessage / reasoning lifecycle and deltas.
    onStream(frame) {
      if (this.hydrating) return
      let notes
      try {
        notes = this.stream.frame(frame, Date.now())
      } catch (error) {
        logger.warn(`stream mapping failed for ${frame.type}: ${errorChain(error)}`)
        return
      }
      for (const note of notes) notify(note.method, note.params)
    }

    close(reason) {
      if (this.closing) return this.closing
      this.closing = (async () => {
        for (const pending of this.pendingApprovals.values()) pending.abort(reason)
        this.dropStructured()
        this.queue.close()
        this.compaction?.controller.abort(compactionInterrupted())
        try {
          this.agent.cancel({ kind: 'user' })
          await this.agent.whenIdle()
        } catch {}
        try { await ctx.get('subagents')?.drainContinuableDescendants([this.agent]) } catch {}
        try { await ctx.sessions.flush(this.agent.session) } catch {}
        try { await this.handle.dispose() } catch (error) { logger.warn(`dispose ${this.id}: ${errorChain(error)}`) }
      })()
      return this.closing
    }
  }

  /**
   * A running sub-agent of a live root thread, as a Codex spawned thread: its
   * durable session events are projected under its own id (turns and items,
   * like Codex child threads; no token deltas), so the client knows its open
   * turn and can stop it. From subagent/start to subagent/end.
   */
  class ChildThread {
    constructor(agent, root) {
      this.agent = agent
      this.id = agent.session.id
      this.root = root
      this.projector = new ThreadProjector({ threadId: this.id, cwd: agent.session.header?.cwd ?? root.cwd, toolDefinition: (toolName) => toolDefinition(toolName, this.agent), inheritedHistory: 'hide', imagePath })
      let events = []
      try {
        events = agent.session.snapshotEvents()
      } catch (error) {
        logger.warn(`history read failed for sub-agent ${this.id}: ${errorChain(error)}`)
      }
      for (const event of events) this.projector.apply(event)
    }

    onEvent(event) {
      let notes
      try {
        notes = this.projector.apply(event)
      } catch (error) {
        logger.warn(`projection failed for sub-agent ${event.type}: ${errorChain(error)}`)
        return
      }
      for (const note of notes) notify(note.method, note.params)
    }

    status() {
      return this.agent.status === 'running' ? { type: 'active', activeFlags: [] } : { type: 'idle' }
    }

    publishStatus(status = this.status()) {
      notify('thread/status/changed', { threadId: this.id, status })
    }

    route() {
      try {
        const config = this.agent.session.requestHeader?.()?.config
        if (config?.provider && config?.model) return config
      } catch {}
      const options = this.agent.options ?? {}
      return options.provider && options.model ? { provider: options.provider, model: options.model, reasoningEffort: options.reasoningEffort } : undefined
    }
  }

  // A sub-agent fork's log starts with its parent's history; a user fork keeps showing it.
  const inheritedHistoryFor = (header) => (header?.origin === 'subagent' ? 'hide' : 'show')
  const headerOf = (id) => ctx.agents.get?.(id)?.session?.header

  function rememberLabel(childId, label) {
    if (typeof childId !== 'string' || !childId || typeof label !== 'string' || !label) return
    if (store.get(childId).agentLabel !== label) store.update(childId, { agentLabel: label })
  }

  function toolDefinition(toolName, agent) {
    const tools = ctx.get('tools')
    if (!tools) return undefined
    try {
      return (agent ? tools.get(toolName, agent) : undefined) ?? tools.get(toolName)
    } catch {
      try { return tools.get(toolName) } catch { return undefined }
    }
  }

  function byAgent(agent) {
    const thread = agent && threads.get(agent.session?.id)
    return thread?.agent === agent ? thread : undefined
  }

  ctx.on('session/event', (session, event) => {
    const thread = threads.get(session.id)
    if (thread && thread.agent.session === session) return thread.onEvent(event)
    const child = children.get(session.id)
    if (child && child.agent.session === session) child.onEvent(event)
  })
  ctx.on('agent/assistant-stream', ({ agent, frame }) => {
    byAgent(agent)?.onStream(frame)
  })
  ctx.on('agent/status', ({ agent }) => {
    const thread = byAgent(agent)
    if (thread) return thread.publishStatus()
    const child = children.get(agent?.session?.id)
    if (child?.agent === agent) child.publishStatus()
  })
  // A sub-agent of a live thread became resident (created, woken or resumed):
  // the client gets it as a spawned thread. The listener receives only the
  // run info; the child agent is resolvable while the edge is published.
  ctx.on('subagent/start', (info) => {
    try {
      startChild(info)
    } catch (error) {
      logger.warn(`sub-agent start ${info?.id}: ${errorChain(error)}`)
    }
  })
  ctx.on('subagent/end', (info) => {
    const child = children.get(info?.id)
    if (!child) return
    children.delete(child.id)
    child.publishStatus({ type: 'idle' })
  })
  // A model workflow's phase() calls are live engine events only (workflows.js):
  // they reach the thread whose log recorded the run; one before that record is held.
  const heldPhases = new Map()
  ctx.on('workflow/phase', (info, title) => {
    const runId = info?.id
    if (typeof runId !== 'string') return
    for (const thread of threads.values()) {
      if (!thread.projector.hasWorkflowRun(runId)) continue
      for (const note of thread.projector.workflowPhase(runId, title)) notify(note.method, note.params)
      return
    }
    const held = heldPhases.get(runId) ?? []
    if (held.length < 64) heldPhases.set(runId, [...held, title])
    if (heldPhases.size > 64) heldPhases.delete(heldPhases.keys().next().value)
  })
  ctx.on('workflow/end', (info) => { heldPhases.delete(info?.id) })
  // The run's record arrived: replay what came before it.
  const releasePhases = (thread, event) => {
    if (event.type !== 'tool-workflow/run-start') return
    const runId = event.data?.runId
    const held = heldPhases.get(runId)
    if (!held) return
    heldPhases.delete(runId)
    for (const title of held) for (const note of thread.projector.workflowPhase(runId, title)) notify(note.method, note.params)
  }

  // Queue edits, follow-ups and claims all surface as inbox events.
  ctx.on('agent/inbox/inserted', ({ agent }) => byAgent(agent)?.queue.changed())
  ctx.on('agent/inbox/discarded', ({ agent }) => byAgent(agent)?.queue.changed())
  ctx.on('agent/inbox/claimed', ({ agent, message }) => byAgent(agent)?.queue.claimed(message))
  ctx.on('agent/error', ({ agent, turn, error }) => {
    const thread = byAgent(agent)
    if (!thread) return
    const turnId = thread.projector.turnIdFor(turn) ?? ''
    // A coded failure (LlmError keeps its provider facts in `failure`) gets
    // its CodexErrorInfo and the code in additionalDetails, as turn/end does.
    notify('error', { error: failureError(error?.failure ?? error, errorChain(error)), willRetry: false, threadId: thread.id, turnId })
  })
  ctx.on('llm/adapters-updated', () => {
    catalog.invalidate()
    notify('account/updated', { authMode: null })
  })
  // A stored key or Platform grant changed (set, unset, sign-out or an
  // external edit of ~/.dsh/.credentials.yaml): the client re-reads account/read.
  const accountChanged = () => { if (clientReady) notify('account/updated', { authMode: null }) }
  ctx.on('credentials/reference-updated', accountChanged)
  ctx.on('credentials/record-updated', accountChanged)
  ctx.on('deepseek-account/signed-out', accountChanged)
  // Both services start after this plugin serves stdio (about 50 ms after
  // initialize), so the app's first account/read can arrive before them:
  // readAccount waits for them during the first seconds, and one arriving
  // after an answer that lacked it tells the client to re-read.
  const accountServicesStarted = Date.now()
  let accountAnsweredWithout = false
  const accountServices = ['credentials', 'deepseekAccount'].map((service) => new Promise((resolve) => {
    ctx.inject([service], () => {
      resolve()
      if (!accountAnsweredWithout) return
      accountAnsweredWithout = false
      accountChanged()
    })
  }))
  // A skill root, provider or runtime contribution changed: the client re-lists.
  ctx.on('skills/change', () => notify('skills/changed', {}))
  // Plugin management (plugins.js): progress and output of an install, and any completed change.
  ctx.on('plugin-manager/install-state', (progress) => {
    if (clientReady && typeof progress?.requestId === 'string') notify('codeDesktop/plugin/installProgress', { requestId: progress.requestId, phase: progress.phase, attempt: progress.attempt ?? null })
  })
  ctx.on('plugin-manager/install-log', (chunk) => {
    const params = clientReady ? installLogParams(chunk) : null
    if (params) notify('codeDesktop/plugin/installLog', params)
  })
  ctx.on('plugin-manager/changed', (change) => {
    if (!clientReady) return
    notify('codeDesktop/plugin/changed', { reason: change?.reason ?? null })
    // A bundle can bring skills: the client re-lists them too.
    notify('skills/changed', {})
  })

  // Ask mode: every mutating tool call asks first; Accept edits lets a
  // workspace write/edit through (approval.js preExecuteDecision). A sub-agent's
  // call asks on its root thread's card, from here: its own approval policy is 'never'.
  ctx.on('tools/pre-execute', (exec, next) => {
    const thread = byAgent(exec.agent)
    if (!thread) {
      const root = rootThreadFor(exec.agent, threads, headerOf)
      if (!root || childDecision({ rootPolicy: root.permission.approvalPolicy, toolName: exec.name }) !== 'ask-client') return next()
      const ask = () => next().then((decision) => {
        if (decision !== undefined && decision.kind !== 'allow' && decision.kind !== 'ask') return decision
        return askChild(root, exec)
      })
      if (root.permission.mode !== 'acceptEdits') return ask()
      const cwd = exec.agent?.session?.header?.cwd ?? root.cwd
      return acceptsEdit({ permission: root.permission, toolName: exec.name, args: parseArguments(exec.arguments), cwd, root: root.cwd })
        .catch(() => false).then((accepted) => (accepted ? next() : ask()))
    }
    if (thread.permission.approvalPolicy !== 'untrusted') return next()
    return preExecuteDecision({ permission: thread.permission, toolName: exec.name, args: parseArguments(exec.arguments), cwd: thread.cwd })
      .catch(() => 'ask').then((gate) => gate === 'next' ? next() : next().then((decision) => {
        if (decision?.kind !== 'allow' && decision !== undefined) return decision
        if (exec.callId !== undefined) thread.askedCalls.add(exec.callId)
        return { kind: 'ask', reason: `Ask mode: confirm ${exec.name}`, displayReason: { en: 'Ask permissions mode is on.' } }
      }))
  })

  ctx.on('approval/request', (request, next) => {
    const thread = byAgent(request.agent)
    if (!thread || request.callId === undefined) return next()
    return answerApproval(thread, request)
  })

  // ask_user_question and exit_plan_mode's plan review → the question card.
  ctx.on('user-questions/request', (request, next) => {
    const thread = byAgent(request.agent)
    return thread ? askQuestions(thread, request) : next()
  })

  /**
   * One server → client request owned by a thread: it holds the thread's
   * waiting status, and an abort (turn interrupted, thread closed) drops it
   * with serverRequest/resolved so the client removes its card.
   */
  async function clientRequest(thread, method, params, signal, flag, childId = null) {
    const { id, promise } = transport.request(method, params)
    let settled = false
    const pending = {
      flag,
      // The sub-agent whose call this card is for (stopping it drops the card).
      childId,
      abort: (why = 'cancelled') => {
        if (settled) return
        settled = true
        transport.abandon(id, why)
        notify('serverRequest/resolved', { threadId: thread.id, requestId: id })
      },
    }
    thread.pendingApprovals.set(id, pending)
    thread.publishStatus()
    const onAbort = () => pending.abort('Turn interrupted.')
    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) onAbort()
    try {
      const result = await promise
      settled = true
      return result
    } finally {
      signal?.removeEventListener('abort', onAbort)
      thread.pendingApprovals.delete(id)
      thread.publishStatus()
    }
  }

  /**
   * One approval → a Plan refusal, an answer without a card (an extra-root
   * write, a session grant) or one Codex approval card (approval.js
   * approvalDecision). The decision reads the call's raw arguments too.
   */
  async function answerApproval(thread, request) {
    const call = thread.projector.tools.get(request.callId)
    const turn = call?.turn ?? thread.projector.activeTurn
    const item = turn?.items.find((candidate) => candidate.id === request.callId)
    const decision = await approvalDecision({
      request, askedCalls: thread.askedCalls, permission: thread.permission, item, args: call?.args, cwd: thread.cwd, grants: thread.sessionGrants,
    })
    if (decision.kind === 'reject') return 'rejected'
    if (decision.kind === 'allow') return 'allowed-once'
    return askClient(thread, request, { call, turnId: turn?.id ?? '', item, decision })
  }

  /**
   * One approval card. `decision.origin` is 'ask' for the bridge's own
   * Ask-mode ask, else 'escalation' (a Harness sandbox escalation).
   * sessionGrantable is a bridge field (Codex clients ignore it): false hides
   * "Allow for this session" for grants the bridge would not remember.
   */
  async function askClient(thread, request, { call, turnId, item, decision }) {
    const { reason, grantable } = decision
    let method, params
    if (item?.type === 'fileChange') {
      method = 'item/fileChange/requestApproval'
      params = { threadId: thread.id, turnId, itemId: request.callId, startedAtMs: Date.now(), reason, grantRoot: null, sessionGrantable: grantable }
    } else {
      const command = item?.type === 'commandExecution' ? item.command : `${request.toolName} ${typeof call?.args === 'string' ? call.args : JSON.stringify(call?.args ?? {})}`
      method = 'item/commandExecution/requestApproval'
      params = {
        kind: 'command', threadId: thread.id, turnId, itemId: request.callId, startedAtMs: Date.now(), approvalId: null,
        environmentId: null, reason, command, cwd: item?.cwd ?? thread.cwd,
        commandActions: item?.commandActions ?? [{ type: 'unknown', command }],
        sessionGrantable: grantable,
      }
    }
    try {
      const result = await clientRequest(thread, method, params, request.signal, 'waitingOnApproval')
      const { answer, interrupt } = approvalAnswer(result?.decision, decision, thread.sessionGrants)
      if (interrupt) queueMicrotask(() => thread.queue.interrupt())
      return answer
    } catch {
      return 'cancelled'
    }
  }

  /**
   * A sub-agent's call under an Ask-mode root: one card on the root thread
   * (approval.js childApproval), answered for the child's pre-execute hook.
   * Harness wording for the outcomes (dsh-tools serviceAsk).
   */
  async function askChild(root, exec) {
    const child = exec.agent
    const childId = child.session.id
    const cwd = child.session.header?.cwd ?? root.cwd
    const args = parseArguments(exec.arguments)
    const item = toolItem({ callId: exec.callId, name: exec.name, args, cwd, definition: toolDefinition(exec.name, child), threadId: childId })
    const label = store.get(childId).agentLabel ?? root.projector.childLabel(childId) ?? children.get(childId)?.projector.agentLabel ?? null
    const turnId = root.projector.activeTurn?.id ?? root.projector.childTurnId(childId) ?? ''
    const decision = childApproval({ threadId: root.id, turnId, callId: exec.callId, toolName: exec.name, args, item, cwd, label, grants: root.sessionGrants })
    if (decision.kind === 'allow') return { kind: 'allow' }
    try {
      const result = await clientRequest(root, decision.method, decision.params, exec.signal, 'waitingOnApproval', childId)
      const { answer, interrupt } = approvalAnswer(result?.decision, decision, root.sessionGrants)
      if (interrupt) queueMicrotask(() => stopChild(childId))
      return answer === 'allowed-once' ? { kind: 'allow' } : { kind: 'deny', reason: `the user rejected tool "${exec.name}"` }
    } catch {
      return exec.signal?.aborted ? { kind: 'cancel' } : { kind: 'deny', reason: `approval for tool "${exec.name}" was cancelled` }
    }
  }

  /** subagent/start for a child working (at any depth) for a live root thread. */
  function startChild(info) {
    const agent = ctx.agents.get?.(info?.id)
    const root = agent && rootThreadFor(agent, threads, headerOf)
    if (!root || root.closing) return
    let child = children.get(agent.session.id)
    if (child?.agent !== agent) {
      child = new ChildThread(agent, root)
      children.set(child.id, child)
    }
    rememberLabel(child.id, child.projector.agentLabel ?? root.projector.childLabel(child.id))
    notify('thread/started', { thread: threadObject({ id: child.id, header: agent.session.header, projector: child.projector, child }) })
    // Resident to run: its first turn may not have started yet.
    child.publishStatus({ type: 'active', activeFlags: [] })
    // A turn already open when it became resident: the client stops it by id.
    const turn = child.projector.activeTurn
    if (turn?.id) notify('turn/started', { threadId: child.id, turn: child.projector.snapshot(turn, 'notLoaded') })
  }

  /** Stop one sub-agent's work, as the DeepSeek app's own stop does (its queued input stays). */
  function stopChild(childId) {
    for (const root of threads.values()) {
      for (const pending of root.pendingApprovals.values()) if (pending.childId === childId) pending.abort('Turn interrupted.')
    }
    try {
      ctx.agents.get?.(childId)?.cancel({ kind: 'user' }, { keepInbox: true })
    } catch (error) {
      logger.warn(`sub-agent stop ${childId}: ${errorChain(error)}`)
    }
  }

  async function askQuestions(thread, request) {
    const questions = request.questions ?? []
    const itemId = questionItemId(request, thread.projector.activeTurn, thread.askingItems)
    const turnId = thread.projector.tools.get(itemId)?.turn?.id ?? thread.projector.activeTurn?.id ?? ''
    if (itemId) thread.askingItems.add(itemId)
    let response
    try {
      response = await clientRequest(thread, 'item/tool/requestUserInput', {
        threadId: thread.id, turnId, itemId, questions: codexQuestions(questions), isBlocking: true, autoResolutionMs: null,
      }, request.signal, 'waitingOnUserInput')
    } catch (error) {
      throw questionFailure(request.signal?.aborted === true, error)
    } finally {
      thread.askingItems.delete(itemId)
    }
    const answer = harnessAnswer(questions, response)
    // Approved in Plan: the rest of this turn implements the plan, so it runs
    // with the permission chosen before Plan, or the one the app's plan card
    // names on its response (codeDesktop.afterPlan). Harness leaves plan mode
    // itself (exit_plan_mode); the app moves its own permission the same way.
    if (thread.permission.mode === 'plan' && isPlanApproval(questions, answer)) {
      Object.assign(thread.permission, afterPlanPermission(approvedAfterPlan(response, thread.permission.afterPlan)))
      await applyPreset(thread)
    }
    return answer
  }

  // --------------------------------------------------------- thread opening

  async function createThread(params) {
    const cwd = await normalizeCwd(params.cwd)
    const selection = await catalog.selection(params.model, params.effort ?? params.config?.model_reasoning_effort, undefined)
    const sessionId = randomUUID()
    const selectionRef = { current: selection, assembled: undefined }
    const instructions = developerInstructionsOf(params)
    let scope
    const customRef = createCustomRef()
    applyCustomization(customRef, params)
    const handle = await ctx.agents.create({
      sessionId,
      meta: { cwd },
      agentOptions: selection ? { provider: selection.provider, model: selection.model, ...(selection.reasoningEffort ? { reasoningEffort: selection.reasoningEffort } : {}) } : {},
      // A defined setup return value must be a commit handle; return nothing.
      setup: (agentCtx) => {
        scope = agentCtx
        installModelSelection(agentCtx, selectionRef)
        if (instructions) attachDeveloperInstructions(agentCtx, instructions)
        installCustomization(agentCtx, customRef, { catalog })
      },
    })
    // Kept with the bridge metadata: a resumed session gets its instructions back.
    if (instructions) store.update(sessionId, { developerInstructions: instructions })
    const thread = new LiveThread(handle, cwd, scope)
    thread.gateWorkflows(params, true)
    thread.selection = selectionRef
    thread.custom = customRef
    threads.set(thread.id, thread)
    thread.hydrate([])
    await applyPermissions(thread, params)
    try { await ctx.sessions.flush(thread.agent.session) } catch {}
    return thread
  }

  async function openThread(threadId) {
    const live = threads.get(threadId)
    if (live && !live.closing) return live
    if (opening.has(threadId)) return opening.get(threadId)
    const promise = (async () => {
      // A thread still unloading holds this session's write lock until disposed.
      await unloading.get(threadId)
      const header = await requireSession(threadId, async () => (await ctx.sessionPersistence.stat(threadId))?.header)
      await catalog.load().catch(() => undefined)
      const route = catalog.defaultRoute()
      const selectionRef = { current: undefined, assembled: undefined }
      const instructions = developerInstructionsOf(store.get(threadId))
      let scope
      const customRef = createCustomRef()
      // requireSession again: the log can vanish between stat and resume.
      const handle = await requireSession(threadId, () => ctx.agents.resume({
        resumeSessionId: threadId,
        agentOptions: { provider: route.provider, model: route.model },
        setup: (agentCtx, agent) => {
          scope = agentCtx
          if (instructions) attachDeveloperInstructions(agentCtx, instructions)
          const logged = agent.session.requestHeader?.()
          selectionRef.current = logged?.config
            ? { provider: logged.config.provider, model: logged.config.model, ...(logged.config.reasoningEffort && logged.adapterDefaults?.reasoningEffort !== true ? { reasoningEffort: logged.config.reasoningEffort } : {}) }
            : { ...route }
          installModelSelection(agentCtx, selectionRef)
          installCustomization(agentCtx, customRef, { catalog })
        },
      }).catch((error) => {
        // The jsonl write lock is held by another process (the DeepSeek app,
        // a second core); an agent of this process owning it is not that.
        throw isSessionOwnedElsewhere(error) && !ctx.agents.get?.(threadId) ? sessionBusyElsewhere(threadId) : error
      }))
      const thread = new LiveThread(handle, handle.agent.session.header.cwd ?? header.cwd, scope)
      thread.gateWorkflows(undefined, true)
      thread.selection = selectionRef
      thread.custom = customRef
      threads.set(threadId, thread)
      let events = []
      try {
        events = handle.agent.session.snapshotEvents()
      } catch (error) {
        logger.warn(`history read failed for ${threadId}: ${errorChain(error)}`)
      }
      thread.hydrate(events)
      return thread
    })().finally(() => opening.delete(threadId))
    opening.set(threadId, promise)
    return promise
  }

  // approval.js applyPermissions / applyPreset with this core's services: policy, sandbox, extra roots and
  // mode hint, Harness plan mode (syncPlanMode), then the preset.
  function permissionServices() {
    return { planMode: ctx.get('planMode'), presets: ctx.get('permissionPresets'), warn: (message, error) => logger.warn(`${message}: ${errorChain(error)}`) }
  }

  async function applyPermissions(thread, params) {
    thread.gateWorkflows(params)
    await applyThreadPermissions(thread, params, permissionServices())
  }

  async function applyPreset(thread) {
    const { presets, warn } = permissionServices()
    await applyThreadPreset(thread, presets, warn)
  }

  async function applyRoute(thread, params) {
    const wantsModel = typeof params.model === 'string' && params.model
    const wantsEffort = typeof params.effort === 'string' && params.effort
    if (!wantsModel && !wantsEffort) return
    const next = await catalog.selection(params.model, params.effort, thread.selection.current)
    if (!next) return
    const current = thread.selection.current
    if (current?.provider !== next.provider || current?.model !== next.model || current?.reasoningEffort !== next.reasoningEffort) thread.selection.current = next
  }

  async function normalizeCwd(cwd) {
    const value = typeof cwd === 'string' && cwd ? cwd : os.homedir()
    if (!isAbsolute(value)) throw invalidParams(`cwd must be absolute: ${value}`)
    try { return await realpath(value) } catch { return value }
  }

  // ------------------------------------------------------------ projections

  async function historyFor(threadId) {
    const live = threads.get(threadId)
    if (live && !live.closing) return { projector: live.projector, header: live.agent.session.header, live }
    // A running sub-agent: the projection its live notifications came from.
    const child = children.get(threadId)
    if (child) return { projector: child.projector, header: child.agent.session.header, live: undefined, child }
    const query = ctx.get('sessionQuery')
    // An id Harness does not know (e.g. a Codex rollout) is the client's
    // threadNotFound, not an internal error with a stderr stack per id.
    const snapshot = await requireSession(threadId, async () => {
      let read
      if (query) read = await query.readSession(threadId)
      else {
        const handle = await ctx.sessionPersistence.open(threadId, 'read')
        try {
          const log = await handle.read()
          read = { session: handle.header ?? (await ctx.sessionPersistence.stat(threadId))?.header, events: log.events }
        } finally {
          await handle.close?.()
        }
      }
      return read?.session ? read : undefined
    })
    const projector = new ThreadProjector({ threadId, cwd: snapshot.session.cwd, toolDefinition: (toolName) => toolDefinition(toolName), inheritedHistory: inheritedHistoryFor(snapshot.session), imagePath })
    for (const event of snapshot.events ?? []) projector.apply(event)
    projector.settleStaleCompaction()
    return { projector, header: snapshot.session, live: undefined, events: snapshot.events, inheritedEventCount: snapshot.inheritedEventCount }
  }

  const loadedHere = (threadId) => {
    const live = threads.get(threadId)
    return Boolean(live && !live.closing) || children.has(threadId)
  }

  // thread/read without turns of a thread not loaded here (list.js readColdThread).
  const coldThread = async (threadId) => readColdThread(threadId, {
    stat: (id) => ctx.sessionPersistence.stat(id), cache: await projectionCache(), meta: store.get(threadId), revisions: cacheRevisions,
  })

  /**
   * After a replay that served a cold row: write this session's cache record
   * (every registered unit, sessionListMetadata included) so the next cold
   * read needs no replay. Fail-soft; skipped for a session live in-process
   * and for a log a cold read closed in memory (list.js seedable).
   * @returns whether the record was written
   */
  function seedListCache(threadId, history) {
    if (history.header?.origin === 'subagent') rememberLabel(threadId, history.projector.agentLabel)
    const cache = ctx.get('sessionProjectionCache')
    if (!listProjectionRegistered || typeof cache?.coldSnapshot !== 'function' || !history.events || !Number.isInteger(history.inheritedEventCount)) return false
    if (ctx.sessions.get?.(threadId) || !seedable(history.events)) return false
    try {
      cache.coldSnapshot(history.header, history.inheritedEventCount, history.events)
      return true
    } catch (error) {
      logger.warn(`projection cache seed failed for ${threadId}: ${errorChain(error)}`)
      return false
    }
  }

  function routeOf(thread, events) {
    if (thread?.selection.current) return thread.selection.current
    if (events) {
      for (let index = events.length - 1; index >= 0; index--) {
        const event = events[index]
        if (event.type === 'request/header' && event.data?.header?.config) return event.data.header.config
      }
    }
    return catalog.defaultRoute()
  }

  /**
   * One Codex Thread. `cold` is a list.js row for a thread with no projector
   * here (thread/list, cold thread/read). updatedAt is the last prompt, reply
   * or turn bound, never earlier than creation (a fork's copied history).
   */
  function threadObject({ id, header, projector, live, child, events, cold }, { includeTurns = false } = {}) {
    const route = child?.route() ?? routeOf(live, events)
    const meta = store.get(id)
    const createdMs = header?.createdAt ?? Date.now()
    const activityMs = live?.lastActivityMs ?? projector?.lastActivityMs ?? cold?.updatedAtMs ?? null
    const updatedMs = Math.max(createdMs, activityMs ?? createdMs)
    // A sub-agent that is not running here has nothing in flight: idle.
    const status = live ? live.status() : child ? child.status() : header?.origin === 'subagent' ? { type: 'idle' } : { type: 'notLoaded' }
    // Sub-agents: parent link, thread_spawn source and nickname (subagents.js).
    const lineage = threadLineage(header, meta.agentLabel ?? projector?.agentLabel ?? null)
    return {
      id,
      sessionId: id,
      forkedFromId: lineage.forkedFromId,
      parentThreadId: lineage.parentThreadId,
      preview: projector?.preview || meta.name || cold?.preview || '',
      ephemeral: false,
      section: null,
      sectionEnteredAt: null,
      projectId: null,
      historyMode: 'paginated',
      modelProvider: route?.provider ?? catalog.defaultRoute().provider,
      model: route ? catalog.wireId(route.provider, route.model) : null,
      reasoningEffort: route?.reasoningEffort ?? null,
      createdAt: seconds(createdMs),
      updatedAt: seconds(updatedMs),
      recencyAt: seconds(updatedMs),
      status,
      path: null,
      cwd: header?.cwd ?? live?.cwd ?? '',
      cliVersion: `dsh ${DSH_VERSION}`,
      source: lineage.source,
      threadSource: null,
      agentNickname: lineage.agentNickname,
      agentRole: null,
      gitInfo: null,
      name: meta.name ?? projector?.title ?? cold?.name ?? null,
      turns: includeTurns && projector ? projector.turns.map((turn) => projector.snapshot(turn)) : [],
    }
  }

  function sessionResponse(thread, extra = {}) {
    const route = thread.selection.current ?? catalog.defaultRoute()
    return {
      thread: threadObject({ id: thread.id, header: thread.agent.session.header, projector: thread.projector, live: thread }, extra),
      model: catalog.wireId(route.provider, route.model),
      modelProvider: route.provider,
      serviceTier: null,
      cwd: thread.cwd,
      instructionSources: [],
      approvalPolicy: thread.permission.approvalPolicy,
      approvalsReviewer: 'user',
      sandbox: thread.permission.sandbox === 'danger-full-access'
        ? { type: 'dangerFullAccess' }
        : thread.permission.sandbox === 'read-only'
          ? { type: 'readOnly', networkAccess: false }
          : { type: 'workspaceWrite', writableRoots: [thread.cwd], networkAccess: false, excludeTmpdirEnvVar: false, excludeSlashTmp: false },
      reasoningEffort: route.reasoningEffort ?? null,
    }
  }

  function pageTurns(projector, { limit, sortDirection, cursor, itemsView = 'full' } = {}) {
    const ordered = projector.turns.map((turn) => projector.snapshot(turn, itemsView === 'notLoaded' ? 'notLoaded' : 'full'))
    if (sortDirection !== 'asc') ordered.reverse()
    const start = cursor ? Number.parseInt(String(cursor), 10) || 0 : 0
    const size = Number.isInteger(limit) && limit > 0 ? limit : 25
    const data = ordered.slice(start, start + size)
    const next = start + size < ordered.length ? String(start + size) : null
    return { data, nextCursor: next, backwardsCursor: null }
  }

  /**
   * Codex input → this thread's Harness user message (input.js). A local
   * image is saved to the attachment store and sent as an image block when
   * the thread's route declares image input; any other route refuses it.
   */
  async function inputMessage(input, thread) {
    const attachments = ctx.get('attachments')
    let imageAllowed = false
    let modelName
    if (attachments && Array.isArray(input) && input.some((part) => part?.type === 'localImage')) {
      await catalog.load().catch(() => undefined)
      const route = thread?.selection.current ?? catalog.defaultRoute()
      const entry = catalog.entryFor(route)
      // An unlisted route is unknown, and unknown is no image input (as upstream's ACP admission).
      imageAllowed = modalitiesOf(entry).includes('image')
      modelName = entry?.model.name || route?.model
    }
    const content = await toHarnessContent(input, { imageAllowed, attachments, modelName })
    return createUserMessage({ content, source: { kind: 'user' } })
  }

  // ------------------------------------------------------- settings catalog

  // The profile rows this core runs (Loader entries); catalog.js picks the MCP clients.
  function profileMcpEntries() {
    try {
      const editor = ctx.get('configEditor')
      return mcpClientEntries(editor ? editor.entries() : ctx.get('loader')?.entries())
    } catch (error) {
      logger.warn(`profile entries unavailable: ${errorChain(error)}`)
      return []
    }
  }

  function toolSchemas() {
    try { return ctx.get('tools')?.schemas?.() ?? [] } catch { return [] }
  }

  // The patch Settings › Edit config opens: the bridge's own profile, not ~/.dsh.
  const configPath = () => ctx.get('configEditor')?.documentPath ?? ctx.get('profileContext')?.patchPath ?? null

  async function skillsSnapshot(cwd) {
    const skills = ctx.get('skills')
    if (!skills) return { skills: [], complete: true }
    if (typeof skills.snapshot === 'function') return skills.snapshot({ cwd })
    return { skills: await skills.list({ cwd }), complete: true }
  }

  // config/read for a working directory: its most recently active live thread, else the default preset.
  async function configPermission(cwd) {
    if (typeof cwd !== 'string' || !cwd) return undefined
    let resolved = cwd
    try { resolved = await realpath(cwd) } catch {}
    return latestThreadIn(threads.values(), [cwd, resolved])?.permission
  }

  // Reconnect: restart each running MCP client (a reconnect with its current
  // config), start one that never ran. Failures stay per server.
  async function reloadMcpServers() {
    await Promise.all(profileMcpEntries().map(async (entry) => {
      if (entry.disabled) return
      try {
        if (entry.fiber && entry.fiber.uid !== null) await entry.fiber.restart()
        else await entry.refresh?.()
      } catch (error) {
        logger.warn(`MCP server ${serverNameOf(entry)} reload failed: ${errorChain(error)}`)
      }
    }))
  }

  async function profileBundles() {
    const manager = ctx.get('pluginManager')
    return manager ? manager.listBundles() : undefined
  }

  // ---------------------------------------------------------------- account

  async function readAccount() {
    const wait = accountServicesStarted + ACCOUNT_SERVICE_WAIT_MS - Date.now()
    if (wait > 0 && (!ctx.get('credentials') || !ctx.get('deepseekAccount'))) {
      let timer
      await Promise.race([Promise.all(accountServices), new Promise((resolve) => { timer = setTimeout(resolve, wait) })])
      clearTimeout(timer)
    }
    const credentials = ctx.get('credentials')
    if (!credentials || !ctx.get('deepseekAccount')) accountAnsweredWithout = true
    if (!credentials) return providerAccountResponse(ctx.llm.listProviders())
    const [keyInfo, platformState] = await Promise.all([
      Promise.resolve().then(() => credentials.describe(credentialRef(DEEPSEEK_KEY_REF))).catch((error) => {
        logger.warn(`credential describe failed: ${errorChain(error)}`)
        return null
      }),
      Promise.resolve().then(() => ctx.get('deepseekAccount')?.getState()).catch(() => null),
    ])
    return accountReadResponse({ keyInfo, platformState })
  }

  /**
   * Every Harness session except the ones Code Desktop removed, folded by usage.js.
   * The home card, its stats and Settings › Usage may ask together: one fold serves all.
   */
  function readUsageSummaries() {
    usageRead ??= foldUsageSummaries().finally(() => { usageRead = null })
    return usageRead
  }

  async function foldUsageSummaries() {
    usageCache ??= new UsageCache(stateDir)
    const query = ctx.get('sessionQuery')
    const snapshots = await Promise.resolve().then(() => ctx.sessionPersistence.list()).catch((error) => {
      if (!query) throw error
      logger.warn(`session revisions unavailable: ${errorChain(error)}`)
      return []
    })
    const revisions = new Map(snapshots.map((snapshot) => [snapshot.header?.id, snapshot.revision]))
    const records = query ? await query.listSessions() : snapshots.map((snapshot) => ({ header: snapshot.header, live: false }))
    const sessions = records
      .filter((record) => record?.header?.id && !store.get(record.header.id).deleted)
      // Sub-agent children are flagged beside the cached fold: codeStats counts their messages, tool calls and tokens but no session.
      .map((record) => ({ id: record.header.id, revision: revisions.get(record.header.id), live: record.live === true, subagent: record.header.origin === 'subagent' }))
    const summaries = await sessionUsageSummaries({
      sessions,
      cache: usageCache,
      liveEvents: (id) => {
        const thread = threads.get(id)
        const agent = thread && !thread.closing ? thread.agent : children.get(id)?.agent
        try { return agent?.session.snapshotEvents() } catch { return undefined }
      },
      readEvents: async (id) => {
        if (query) return (await query.readSession(id)).events
        const handle = await ctx.sessionPersistence.open(id, 'read')
        try { return (await handle.read()).events } finally { await handle.close?.() }
      },
      onError: (id, error) => logger.warn(`usage read failed for ${id}: ${errorChain(error)}`),
    })
    return summaries
  }

  // ------------------------------------------------------------- dispatcher

  async function handle(method, params) {
    if (closed) throw new RpcError(-32000, 'Code Desktop core is shutting down.')
    switch (method) {
      case 'initialize': {
        clientReady = true
        const home = process.env.DSH_HOME || `${os.homedir()}/.dsh`
        return {
          userAgent: `code-desktop-deepseek-core/${VERSION} (dsh ${DSH_VERSION}; ${process.platform})`,
          codexHome: home,
          platformFamily: process.platform === 'win32' ? 'windows' : 'unix',
          platformOs: process.platform === 'darwin' ? 'macos' : process.platform,
          engine: 'deepseek-harness',
          engineVersion: DSH_VERSION,
          capabilities: { ...CAPABILITIES, pluginManage: Boolean(ctx.get('pluginManager')) },
          configPath: configPath(),
        }
      }
      case 'model/list':
        return { data: await catalog.codexModels(), nextCursor: null }
      case 'account/read':
        return readAccount()
      case 'account/rateLimits/read': {
        const empty = { limitId: null, limitName: null, primary: null, secondary: null, credits: null, individualLimit: null, spendControlReached: null, planType: null, rateLimitReachedType: null }
        return { rateLimits: empty, rateLimitsByLimitId: null, rateLimitResetCredits: null, accountId: null, rateLimitUpsell: null }
      }
      case 'account/usage/read':
        return accountTokenUsage(await readUsageSummaries(), localDayKey(Date.now()), params?.codeDesktop?.prices)
      case 'codeDesktop/pricing/read':
        // Settings → Models → Pricing: the official table the app's overrides start from.
        return { official: DEEPSEEK_PRICES, aliases: PRICE_ALIASES, pricingUrl: PRICING_URL, peakWindows: PEAK_WINDOWS }
      case 'codeDesktop/stats/read':
        // The home stats card (cc43287c9-BMbiZYzF.js:3987-4004 getCodeStats → code-home.js Iw/Xw/eT/cT).
        return codeStats(await readUsageSummaries())
      case 'account/login/start':
      case 'account/login/cancel':
      case 'account/logout':
        throw new RpcError(METHOD_NOT_FOUND, 'DeepSeek uses an API key. Configure it in DeepSeek Harness (dsh) settings.')
      case 'configRequirements/read':
        return { requirements: null }
      case 'config/read':
        return configReadResponse({ permission: await configPermission(params.cwd), mcpEntries: profileMcpEntries() })
      case 'mcpServerStatus/list':
        return { data: mcpServerStatuses(profileMcpEntries(), toolSchemas()), nextCursor: null }
      case 'config/mcpServer/reload':
        await reloadMcpServers()
        return {}
      case 'skills/list': {
        const cwds = Array.isArray(params.cwds) && params.cwds.length ? params.cwds : [os.homedir()]
        const data = []
        for (const cwd of cwds) data.push(skillsListEntry(cwd, await skillsSnapshot(cwd)))
        return { data }
      }
      case 'skills/config/write':
        throw skillToggleUnsupported()
      case 'plugin/installed':
        return pluginsInstalledResponse(await profileBundles(), ctx.get('profileContext')?.dir)
      case 'plugin/read': {
        const bundle = (await profileBundles())?.find((candidate) => candidate.name === params.pluginName)
        if (!bundle) throw invalidParams(`Unknown plugin: ${params.pluginName}`)
        return pluginReadResponse(bundle, { dir: ctx.get('profileContext')?.dir, mcpEntries: profileMcpEntries() })
      }
      case 'thread/start': {
        const thread = await createThread(params)
        const response = sessionResponse(thread)
        notify('thread/started', { thread: response.thread })
        return response
      }
      case 'thread/resume': {
        const thread = await openThread(requireId(params.threadId))
        await applyPermissions(thread, params)
        await applyRoute(thread, params)
        applyCustomization(thread.custom, params)
        const response = sessionResponse(thread, { includeTurns: params.excludeTurns !== true })
        if (params.initialTurnsPage) response.initialTurnsPage = pageTurns(thread.projector, params.initialTurnsPage)
        response.turnsBackwardsCursor = null
        response.itemsBackwardsCursor = null
        thread.publishStatus()
        // Replay what only live notifications carry (context usage, the plan),
        // after the response line so the client has the thread first.
        setImmediate(() => {
          if (thread.closing) return
          try {
            const notes = resumeReplayNotes({ threadId: thread.id, projector: thread.projector, tokenUsage: (usage) => thread.tokenUsage(usage) })
            for (const note of notes) notify(note.method, note.params)
          } catch (error) {
            logger.warn(`resume replay failed for ${thread.id}: ${errorChain(error)}`)
          }
        })
        return response
      }
      case 'thread/read': {
        const id = requireId(params.threadId)
        const includeTurns = params.includeTurns === true
        // Sidebar rows and the inactivity sweep: header + cached row, no replay.
        let cold
        if (!includeTurns && !loadedHere(id)) {
          cold = await coldThread(id)
          if (cold.cold) return { thread: threadObject({ id, header: cold.header, cold: cold.cold }) }
        }
        const history = await historyFor(id)
        // The row now reflects the log at (at least) the revision stat saw.
        if (cold && !history.live && !history.child && seedListCache(id, history)) cacheRevisions.record(id, cold.revision)
        return { thread: threadObject({ id, ...history }, { includeTurns }) }
      }
      case 'thread/turns/list': {
        const history = await historyFor(requireId(params.threadId))
        return pageTurns(history.projector, params)
      }
      case 'thread/items/list': {
        const history = await historyFor(requireId(params.threadId))
        let entries = history.projector.turns.flatMap((turn) => turn.items.map((item) => ({ turnId: turn.id, item })))
        if (params.turnId) entries = entries.filter((entry) => entry.turnId === params.turnId)
        if (params.sortDirection === 'desc') entries.reverse()
        const start = params.cursor ? Number.parseInt(String(params.cursor), 10) || 0 : 0
        const size = Number.isInteger(params.limit) && params.limit > 0 ? params.limit : 200
        return { data: entries.slice(start, start + size), nextCursor: start + size < entries.length ? String(start + size) : null, backwardsCursor: null }
      }
      case 'thread/list':
        return listThreads(params)
      case 'thread/name/set': {
        const id = requireId(params.threadId)
        const nameValue = typeof params.name === 'string' ? params.name.trim() : ''
        store.update(id, { name: nameValue || null })
        const live = threads.get(id)
        if (live && nameValue) {
          try { ctx.get('sessionTitle')?.rename(live.agent.session, nameValue) } catch {}
        }
        notify('thread/name/updated', { threadId: id, ...(nameValue ? { threadName: nameValue } : {}) })
        return {}
      }
      case 'thread/archive': {
        const id = requireId(params.threadId)
        store.update(id, { archived: true })
        // The app drops an archived session without unsubscribing (the
        // inactivity sweep never subscribed): release an idle one's lock here.
        const live = threads.get(id)
        if (live && !live.closing && !keepLoaded(live)) unload(id, live)
        notify('thread/archived', { threadId: id })
        return {}
      }
      case 'thread/unarchive': {
        const id = requireId(params.threadId)
        // An id this core cannot open stays archived: the error tells the app
        // not to move it back into its active list.
        const history = await historyFor(id).catch((error) => {
          if (isThreadNotFound(error)) throw error
          return null
        })
        store.update(id, { archived: false })
        notify('thread/unarchived', { threadId: id })
        return history ? { thread: threadObject({ id, ...history }) } : {}
      }
      case 'thread/delete': {
        const id = requireId(params.threadId)
        const live = threads.get(id)
        if (live) {
          threads.delete(id)
          await live.close('Session deleted.')
        }
        store.update(id, { deleted: true })
        grantsById.delete(id)
        notify('thread/deleted', { threadId: id })
        return {}
      }
      case 'thread/unsubscribe':
      case 'thread/close': {
        // The client left an idle session: release its write lock so the
        // DeepSeek app can continue it. Answered at once; the close (flush,
        // dispose) runs in the background and a reopen waits for it.
        const id = requireId(params.threadId)
        const live = threads.get(id)
        const loaded = Boolean(live && !live.closing)
        if (loaded && !keepLoaded(live)) unload(id, live)
        return method === 'thread/unsubscribe' ? { status: loaded ? 'unsubscribed' : 'notLoaded' } : {}
      }
      case 'turn/start': {
        // Checked first: a schema the core cannot enforce fails the request before anything changes.
        const schema = outputSchemaOf(params)
        const thread = await openThread(requireId(params.threadId))
        await applyPermissions(thread, params)
        await applyRoute(thread, params)
        applyCustomization(thread.custom, params)
        const message = await inputMessage(params.input, thread)
        if (schema) thread.applyStructured(schema, message.id)
        thread.agent.followup(message)
        thread.lastActivityMs = Date.now()
        // A cold row's recency when the cache record lags (list.js coldRow).
        store.update(thread.id, { lastPromptAt: thread.lastActivityMs })
        return { turn: { id: `turn-${message.id}`, items: [], itemsView: 'notLoaded', status: 'inProgress', error: null, startedAt: null, completedAt: null, durationMs: null } }
      }
      case 'turn/steer': {
        const thread = await openThread(requireId(params.threadId))
        const active = thread.projector.activeTurn
        // Codex NonSteerableTurnKind 'compact': the client queues instead.
        if (active?.synthetic || thread.compaction)
          throw new RpcError(-32600, 'A compaction turn cannot be steered.', { codexErrorInfo: 'activeTurnNotSteerable' })
        if (!active || (params.expectedTurnId && active.id !== params.expectedTurnId))
          throw new RpcError(-32600, 'No active turn to steer.', { codexErrorInfo: 'activeTurnNotSteerable' })
        const message = await inputMessage(params.input, thread)
        // Saving images can outlast the turn: a turn that ended meanwhile is the client's queue fallback.
        if (thread.projector.activeTurn !== active || thread.compaction)
          throw new RpcError(-32600, 'No active turn to steer.', { codexErrorInfo: 'activeTurnNotSteerable' })
        thread.agent.steer(message)
        return { turnId: active.id }
      }
      case 'turn/interrupt': {
        const id = requireId(params.threadId)
        const thread = threads.get(id)
        if (thread) {
          for (const pending of thread.pendingApprovals.values()) pending.abort('Turn interrupted.')
          // Before agent.cancel, so the compaction's abort reason is this one.
          thread.compaction?.controller.abort(compactionInterrupted())
          thread.queue.interrupt()
        } else {
          // A sub-agent (the client's Stop on its task): stop that child only.
          stopChild(id)
        }
        return {}
      }
      case 'thread/compact/start': {
        const thread = await openThread(requireId(params.threadId))
        const commands = ctx.get('commands')
        if (!commands) throw new RpcError(METHOD_NOT_FOUND, 'Compaction is not available in this Harness profile.')
        if (thread.agent.status === 'running' || thread.projector.activeTurn || thread.compaction)
          throw new RpcError(-32600, 'Wait for the current turn to finish before compacting.', { codexErrorInfo: 'activeTurnNotSteerable' })
        const compaction = { controller: new AbortController(), startedTurn: thread.projector.lastSyntheticCompactionTurnId }
        thread.compaction = compaction
        thread.publishStatus()
        // After the {} response line, like Codex; the lock above holds meanwhile.
        setImmediate(() => {
          void runCompact({
            execute: (signal) => commands.execute(thread.agent, '/compact', [], signal),
            signal: compaction.controller.signal,
            threadId: thread.id,
            notify,
            openedTurnId: () => {
              const id = thread.projector.lastSyntheticCompactionTurnId
              return id !== compaction.startedTurn ? id : null
            },
            closeOpened: (turnId, status, error) => thread.projector.closeSynthetic(turnId, status, error),
            newTurnId: () => `turn-compact-${randomUUID()}`,
          }).then((outcome) => {
            // The context ring drops to the compacted size now, not at the next reply.
            if (outcome.opened && outcome.status === 'completed' && thread.projector.lastUsage && !thread.closing)
              notify('thread/tokenUsage/updated', { threadId: thread.id, turnId: outcome.turnId, tokenUsage: thread.tokenUsage(thread.projector.lastUsage) })
          }).catch((error) => logger.warn(`compaction ${thread.id}: ${errorChain(error)}`)).finally(() => {
            if (thread.compaction === compaction) thread.compaction = null
            if (!thread.closing) thread.publishStatus()
          })
        })
        return {}
      }
      case 'thread/queue/add':
        return (await openThread(requireId(params.threadId))).queue.add(params)
      case 'thread/queue/list': {
        const live = threads.get(requireId(params.threadId))
        return live && !live.closing ? live.queue.list() : { data: [], nextCursor: null }
      }
      case 'thread/queue/delete':
        return (await openThread(requireId(params.threadId))).queue.delete(requireQueuedId(params.queuedSubmissionId))
      case 'thread/queue/update':
        return (await openThread(requireId(params.threadId))).queue.update(requireQueuedId(params.queuedSubmissionId), params.input)
      case 'thread/queue/reorder':
        return (await openThread(requireId(params.threadId))).queue.reorder(params.queuedSubmissionIds)
      case 'thread/queue/start':
        return (await openThread(requireId(params.threadId))).queue.start(params.queuedSubmissionId)
      case 'thread/backgroundTerminals/list':
        return { data: [], nextCursor: null }
      case 'hooks/list':
        return { data: [] }
      case 'codeDesktop/thread/permissions': {
        // A Mode change while a turn runs: the same permission params turn/start carries
        // (approvalPolicy, sandboxPolicy, codeDesktop hints), applied to the loaded thread now.
        // The preset switches at once (later tool calls ask or not under it), plan mode from the
        // next step (syncPlanMode). A thread that is not loaded here is left alone: its next
        // turn/start or thread/resume carries the new mode anyway.
        return livePermissions(threads.get(requireId(params.threadId)), params, applyPermissions)
      }
      case 'codeDesktop/workflow/stop':
        return stopWorkflow(threads.get(requireId(params.threadId)), params.runId)
      case 'codeDesktop/plugin/inspect':
      case 'codeDesktop/plugin/install':
      case 'codeDesktop/plugin/cancelInstall':
      case 'codeDesktop/plugin/setEnabled':
      case 'codeDesktop/plugin/remove':
        return pluginRequest(method, params, ctx.get('pluginManager'))
      case 'codeDesktop/profile/read': return profileReadResponse({ entries: (() => { try { const e = ctx.get('configEditor'); return e ? e.entries() : ctx.get('loader')?.entries() } catch { return [] } })(), bundles: await profileBundles().catch(() => undefined), patchPath: configPath(), dir: ctx.get('profileContext')?.dir })
      case 'codeDesktop/diagnostics': {
        const tools = ctx.get('tools')
        let toolNames = []
        // dsh-tools has no list(); schemas() is the global model-facing catalog.
        try { toolNames = (tools?.schemas?.() ?? []).map((tool) => tool.name) } catch {}
        return { tools: Boolean(tools), toolNames, permissionPresets: Boolean(ctx.get('permissionPresets')), sessionQuery: Boolean(ctx.get('sessionQuery')), tokenMeter: Boolean(ctx.get('tokenMeter')), commands: Boolean(ctx.get('commands')), sessionTitle: Boolean(ctx.get('sessionTitle')), credentials: Boolean(ctx.get('credentials')), deepseekAccount: Boolean(ctx.get('deepseekAccount')), liveThreads: threads.size }
      }
      default:
        throw new RpcError(METHOD_NOT_FOUND, `${method} is not supported by the DeepSeek core yet.`)
    }
  }

  /**
   * Stop a model workflow run. A background run is its own job (job_kill's
   * path); a foreground run is the running tool call, so its turn stops, as
   * the tool bridges the step's abort signal to the run's cancel().
   */
  function stopWorkflow(thread, runId) {
    if (typeof runId !== 'string' || !runId) throw invalidParams('runId is required')
    const item = thread && !thread.closing ? thread.projector.workflowItem(runId) : undefined
    if (!item?.workflowRun) throw invalidParams('Unknown workflow run.')
    const run = item.workflowRun
    if (run.status !== 'running') return { status: 'alreadyFinished' }
    if (run.jobId) {
      const jobs = ctx.get('jobs')
      if (!jobs) throw new RpcError(-32000, 'Background jobs are not available in this Harness profile.')
      return { status: jobs.kill(run.jobId, thread.id, 'Stopped from Code Desktop') === 'requested' ? 'stopping' : 'alreadyFinished' }
    }
    if (item.status !== 'inProgress') return { status: 'alreadyFinished' }
    for (const pending of thread.pendingApprovals.values()) pending.abort('Turn interrupted.')
    thread.queue.interrupt()
    return { status: 'stopping' }
  }

  // list.js mustStayLoaded: anything in flight keeps the agent (and its lock).
  function keepLoaded(thread) {
    let runningChildren = false
    for (const child of children.values()) if (child.root === thread && child.agent.status === 'running') runningChildren = true
    // Sub-agents by lineage: close() drains them, and their jobs with them.
    let descendants = []
    try { descendants = descendantIds(ctx.agents.list?.() ?? [], thread.id) } catch {}
    for (const id of descendants) if (ctx.agents.get?.(id)?.status === 'running') runningChildren = true
    let queued = 0
    try { queued = thread.agent.inbox?.nextTurn?.length ?? 0 } catch {}
    return mustStayLoaded({
      running: thread.agent.status === 'running',
      activeTurn: Boolean(thread.projector.activeTurn),
      pendingRequests: thread.pendingApprovals.size,
      queued,
      compacting: Boolean(thread.compaction),
      runningChildren,
      // A dev server or a long command the bash tool moved to the background:
      // the agent's disposal would kill it before its completion turn.
      jobsRunning: ownsRunningJob(ctx.get('jobs'), [thread.id, ...descendants]),
    })
  }

  function unload(id, thread) {
    threads.delete(id)
    const done = thread.close('Session closed.').then(async () => {
      // The disposal checkpointed this log: its cache row is current here.
      try { cacheRevisions.record(id, (await ctx.sessionPersistence.stat(id))?.revision) } catch {}
    }).finally(() => {
      if (unloading.get(id) === done) unloading.delete(id)
    })
    unloading.set(id, done)
    return done
  }

  function requireId(value) {
    if (typeof value !== 'string' || !value) throw new RpcError(INVALID_PARAMS, 'threadId is required')
    return value
  }

  function requireQueuedId(value) {
    if (typeof value !== 'string' || !value) throw new RpcError(INVALID_PARAMS, 'queuedSubmissionId is required')
    return value
  }

  async function listThreads(params) {
    const query = ctx.get('sessionQuery')
    let headers
    if (query) headers = (await query.listSessions()).map((record) => record.header)
    else headers = (await ctx.sessionPersistence.list()).map((snapshot) => snapshot.header)
    const cwdFilter = params.cwd === undefined || params.cwd === null ? null : new Set([params.cwd].flat())
    const wantArchived = params.archived === true
    // subAgent* kinds list sub-agent children (origin 'subagent'); a fork is interactive.
    const wantSource = sourceFilter(params.sourceKinds)
    const rows = headers.filter((header) => {
      if (!header?.id || !header.cwd) return false
      const meta = store.get(header.id)
      if (meta.deleted) return false
      if (!wantSource(header)) return false
      if (Boolean(meta.archived) !== wantArchived) return false
      if (cwdFilter && !cwdFilter.has(header.cwd)) return false
      return true
    })
    // Rows without a projector here come from the projection cache (list.js):
    // no log is opened. Blank sessions (no turn yet) are not listed.
    const cache = await projectionCache()
    const items = []
    for (const header of rows) {
      const live = threads.get(header.id)
      const child = children.get(header.id)
      const meta = store.get(header.id)
      let cold
      if (!live && !child) {
        cold = coldRow(header, { meta, cacheValues: cachedValues(cache, header) })
        if (cold.blank) continue
      } else if (live && live.lastActivityMs === null && !meta.name) continue
      const thread = threadObject({ id: header.id, header, projector: live?.projector ?? child?.projector, live, child, cold })
      if (!matchesSearch(thread, params.searchTerm)) continue
      items.push({ thread, cold })
    }
    const key = params.sortKey === 'created_at' || params.sortKey === 'createdAt' ? 'createdAt' : 'updatedAt'
    items.sort((left, right) => right.thread[key] - left.thread[key] || right.thread.createdAt - left.thread.createdAt)
    if (params.sortDirection === 'asc') items.reverse()
    const start = params.cursor ? Number.parseInt(String(params.cursor), 10) || 0 : 0
    const size = Number.isInteger(params.limit) && params.limit > 0 ? params.limit : 50
    const page = items.slice(start, start + size)
    // Title snapshots fold whole logs: only for page rows the cache had no
    // title row for (the Tasks pane polls this every 2 s).
    const untitled = page.filter(({ thread, cold }) => !thread.name && cold && !cold.titleKnown).map(({ thread }) => thread)
    if (query && untitled.length > 0) {
      try {
        const results = await query.readTitleSnapshots(untitled.map((thread) => thread.id))
        for (const result of results) {
          const title = titleOf(result)
          const thread = title && untitled.find((candidate) => candidate.id === result.sessionId)
          if (thread) thread.name = title
        }
      } catch {}
    }
    const data = page.map(({ thread }) => thread)
    for (const thread of data) if (!thread.preview) thread.preview = thread.name ?? ''
    return { data, nextCursor: start + size < items.length ? String(start + size) : null, backwardsCursor: null }
  }

  // ------------------------------------------------------------- lifecycle

  let quiescing
  function quiesce() {
    if (quiescing) return quiescing
    closed = true
    transport.close()
    const live = [...threads.values()]
    threads.clear()
    children.clear()
    quiescing = Promise.allSettled([...live.map((thread) => thread.close('Code Desktop core stopped.')), ...unloading.values()]).then(() => undefined)
    return quiescing
  }

  transport.start()
  ctx.effect(() => () => quiesce(), 'codex-app-server.connection')
}

export { userInputsOf }
