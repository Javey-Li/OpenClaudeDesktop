/**
 * Durable DeepSeek Harness session events → Codex v2 turns and thread items.
 *
 * One projector instance per thread consumes the session log in order, both
 * for history replay (thread/read, thread/resume, thread/turns/list) and for
 * live delivery, so item and turn ids are identical either way:
 *
 *   turn id          `turn-<first human user message id>` (else `turn-n<N>`);
 *                    a manual compaction between turns is `turn-c<compactionId>`
 *   user message     the Harness message id; its content goes back to Codex
 *                    parts (input.js toCodexInputs: bracket forms, image blocks)
 *   assistant block  `msg-<turn>.<step>.<block index>` (also used by live streaming)
 *   tool call        the Harness tool call id
 *   proposed plan    `plan-<exit_plan_mode call id>`
 *   agent activity   `subagent-<notice message id>`
 *
 * Delegation (subagent, subagent_fork) is a Codex collabAgentToolCall
 * spawnAgent. Its child comes from the parent's `subagent/catalog` event or
 * the continuable result text; a child's settled notice updates that item
 * instead of becoming a user bubble.
 *
 * `apply()` returns the Codex notifications the event implies; replay simply
 * ignores them.
 */

import { readFileSync, statSync } from 'node:fs'
import { basename, isAbsolute, resolve } from 'node:path'
import { unifiedDiff } from './diff.js'
import { promptText, toCodexInputs } from './input.js'
import { WORKFLOW_TOOL, isWorkflowRecord, workflowInterrupted, workflowPhase, workflowRecord, workflowRunOf, workflowToolResult } from './workflows.js'
import { STRUCTURED_OUTPUT_TOOL } from './structured.js'

const nowSeconds = (ms) => Math.floor((ms ?? Date.now()) / 1000)

export const assistantItemId = (turn, step, index) => `msg-${turn}.${step}.${index}`

/** Parse model-produced tool arguments; malformed JSON stays a string. */
export function parseArguments(value) {
  if (typeof value !== 'string') return value ?? {}
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

/** Text of content blocks; an image reads '[image]' unless `carried` (toolImages) delivers it as an image. */
function textOf(blocks, carried) {
  if (!Array.isArray(blocks)) return ''
  return blocks
    .map((block) => (block?.type === 'text' ? block.text : block?.type === 'image' && !carried?.has(block) ? '[image]' : ''))
    .filter(Boolean)
    .join('\n')
}

// Tool-result images for the UI (the source's outputImages, QO approval-current.js:7398-7445,
// is {data, mimeType} base64). An MCP-style block carries the data inline; a Harness block
// (dsh-tool-fs read_image, dsh-mcp-client) carries an attachment ref, read from its host file
// (`imagePath`, the attachment store's imageHostPath). Over this many base64 characters, an
// unknown media type or an unreadable file keeps the '[image]' text.
export const TOOL_IMAGE_LIMIT = 4 * 1024 * 1024
const TOOL_IMAGE_TYPE = /^image\/(?:png|jpeg|gif|webp)$/
const base64Length = (bytes) => Math.ceil(bytes / 3) * 4
function toolImage(block, imagePath) {
  const mimeType = block?.mimeType ?? block?.mediaType ?? block?.attachment?.mediaType
  if (block?.type !== 'image' || typeof mimeType !== 'string' || !TOOL_IMAGE_TYPE.test(mimeType)) return null
  if (typeof block.data === 'string') return block.data && block.data.length <= TOOL_IMAGE_LIMIT ? { data: block.data, mimeType } : null
  const ref = block.attachment
  if (!ref || typeof imagePath !== 'function' || (Number.isFinite(ref.bytes) && base64Length(ref.bytes) > TOOL_IMAGE_LIMIT)) return null
  try {
    const path = imagePath(ref)
    if (typeof path !== 'string' || !path || base64Length(statSync(path).size) > TOOL_IMAGE_LIMIT) return null
    return { data: readFileSync(path).toString('base64'), mimeType }
  } catch {
    return null
  }
}
/** The deliverable image blocks of a result, by block. */
function toolImages(blocks, imagePath) {
  const images = new Map()
  for (const block of Array.isArray(blocks) ? blocks : []) {
    const image = block?.type === 'image' ? toolImage(block, imagePath) : null
    if (image) images.set(block, image)
  }
  return images
}
/** Codex DynamicToolCallOutputContentItem for an image. */
const inputImage = ({ data, mimeType }) => ({ type: 'inputImage', imageUrl: `data:${mimeType};base64,${data}` })

/**
 * Human prompt message → Codex UserInput[] (input.js toCodexInputs). Kept
 * for callers that hold a message rather than its content.
 */
export const userInputsOf = (message, options) => toCodexInputs(message?.content, options)

/**
 * Codex CodexErrorInfo for a Harness failure (LlmFailure {code, status?};
 * codes from dsh-llm and dsh-llm-deepseek providerError). Unknown codes
 * (EMPTY_RESPONSE, HTTP_<n>, UNKNOWN, …) have no Codex identity: null.
 */
export function codexErrorInfoOf(failure) {
  const status = Number.isInteger(failure?.status) ? failure.status : null
  switch (failure?.code) {
    case 'AUTH':
    case 'INVALID_CREDENTIAL':
    case 'MISSING_CREDENTIAL':
      return 'unauthorized'
    case 'RATE_LIMIT':
      return 'rateLimitExceeded'
    case 'SERVER':
      return status === 503 || status === 529 ? 'serverOverloaded' : 'internalServerError'
    case 'TRANSPORT':
    case 'TIMEOUT':
      return { responseStreamConnectionFailed: { httpStatusCode: status } }
    case 'CONTEXT_WINDOW_EXCEEDED':
      return 'contextWindowExceeded'
    case 'INVALID_REQUEST':
      return 'badRequest'
    // An exhausted balance (HTTP 402) or account quota; the code in
    // additionalDetails tells billing apart from a Codex plan limit.
    case 'QUOTA':
    case 'ACCOUNT_QUOTA':
      return 'usageLimitExceeded'
    default:
      return null
  }
}

/**
 * Codex TurnError for a Harness failure ({message, code, status?}): the code
 * stays in additionalDetails unless it is the whole message.
 */
export function failureError(failure, message = failure?.message || failure?.code || 'DeepSeek Harness reported an error.') {
  const code = typeof failure?.code === 'string' && failure.code ? failure.code : null
  return { message, codexErrorInfo: code ? codexErrorInfoOf(failure) : null, additionalDetails: code && code !== message ? code : null, misalignment: null }
}

function turnError(reason) {
  if (!reason) return null
  if (reason.kind === 'error') return failureError(reason.error ?? {})
  if (reason.kind === 'blocked') return { message: 'The turn was blocked by a Harness policy.', codexErrorInfo: null, additionalDetails: null, misalignment: null }
  // A reply cut off by the output cap: the turn still completed (turnStatusOf),
  // but carries the original's output_token_limit error (c1298b0ba Z, shared-18
  // _r.outputTokenLimit); the renderer classifies it by additionalDetails.
  if (reason.kind === 'max-tokens') return { message: 'Response exceeded the output limit', codexErrorInfo: null, additionalDetails: 'MAX_TOKENS', misalignment: null }
  return null
}

function turnStatusOf(reason) {
  switch (reason?.kind) {
    case 'completed':
    case 'max-tokens':
    case 'forked':
      return 'completed'
    case 'aborted':
    case 'interrupted':
      return 'interrupted'
    case 'error':
    case 'blocked':
      return 'failed'
    default:
      return 'completed'
  }
}

/** Parse bash's `[exit code: N]` / signal footer when no structured view exists. */
function parseExitFooter(text) {
  const match = /\n?\[exit code: (-?\d+)\]\s*$/.exec(text)
  if (!match) return { output: text, exitCode: null }
  return { output: text.slice(0, match.index), exitCode: Number(match[1]) }
}

// dsh-tool-fs formatReadOutput: `<path>…</path>\n<type>file</type>\n<content>\n`
// + numbered lines + a blank line + one parenthesized footer + `\n</content>`.
const READ_ENVELOPE = /^<path>[^\n]*<\/path>\n<type>file<\/type>\n<content>\n([\s\S]*)\n<\/content>$/u
const READ_FOOTER = /(?:^|\n)\s*\((?:End of file|File has|Showing|Output capped|Output truncated)[^\n]*\)\s*$/u

/** Numbered read body without the envelope or the footer the UI would show as file content. */
function readBody(text) {
  return (READ_ENVELOPE.exec(text)?.[1] ?? text).replace(READ_FOOTER, '')
}

// dsh-tools toolAbortedResult / toolAbortedBeforeDispatchResult; the content
// text is the fallback for logs written without `data.error`.
const ABORTED_TEXTS = new Set(['Error: tool call aborted', 'Error: tool call aborted before dispatch'])
const isAborted = (error, text) => error?.name === 'AbortError' || ABORTED_TEXTS.has(text)
// compaction/end `error` is only errorChain() text; a cancelled summary reads
// as an abort/cancel (the bridge aborts with "Compaction interrupted.").
const COMPACTION_ABORTED = /\b(?:abort|cancel|interrupt)/i

// Harness delegation and agent-control tools → Codex CollabAgentTool.
const COLLAB_TOOLS = { subagent: 'spawnAgent', subagent_fork: 'spawnAgent', send_message: 'sendMessage', interrupt_agent: 'interruptAgent', list_agents: 'listAgents' }
// dsh-tool-subagent result texts: a continuable child keeps running after the
// call returns; a background job reports only its job id.
const STARTED_SUBAGENT = /^started subagent (\S+)/
const STARTED_JOB = /^started background subagent job /
// dsh-tool-subagent stopReasonError for an aborted foreground run.
const RUN_CANCELLED = /subagent run was cancelled/
// dsh-subagent settlementSummary: "Background subagent <id> was stopped…",
// "…failed…", "…ended abnormally…"; finished/out of room/declined end it too.
const SETTLED_STOPPED = /\bwas stopped\b|\binterrupt|\bcancel/i
const SETTLED_FAILED = /\bfail|\berror|\babnormal/i
// dsh-subagent createSettlementMessage: summary, then this line and the child's closing text.
const CLOSING_LEAD = 'Its closing message:'
const NO_CLOSING = 'It left no closing message.'

/** A child agent state the run (or its stop) ended. */
const endStates = (states, status) => Object.fromEntries(Object.entries(states ?? {}).map(([id, state]) =>
  [id, state?.status === 'running' || state?.status === 'pendingInit' ? { ...state, status } : state]))

/** Codex CollabAgentStatus from a settled notice's one-line summary. */
export function settledStatus(summary) {
  const text = typeof summary === 'string' ? summary : ''
  if (SETTLED_STOPPED.test(text)) return 'interrupted'
  if (SETTLED_FAILED.test(text)) return 'errored'
  return 'completed'
}

/** The child's closing text from a settled notice's content, without the runtime preamble. */
export function settledMessage(content) {
  const texts = (Array.isArray(content) ? content : []).filter((block) => block?.type === 'text' && typeof block.text === 'string').map((block) => block.text)
  const lead = texts.indexOf(CLOSING_LEAD)
  if (lead >= 0) return texts.slice(lead + 1).join('\n') || null
  if (texts.includes(NO_CLOSING)) return null
  // Unknown layout: everything after the summary line.
  return texts.slice(1).join('\n') || null
}

/** A tool the user stopped: Codex 'interrupted' (Stopped) with no error body. */
function interruptedToolItem(item, durationMs) {
  switch (item.type) {
    case 'commandExecution':
      return { ...item, status: 'interrupted', aggregatedOutput: null, exitCode: null, durationMs }
    case 'fileChange':
    case 'webSearch':
      return { ...item, status: 'interrupted' }
    case 'collabAgentToolCall':
      // A stopped foreground delegation stopped its child too.
      return { ...item, status: 'interrupted', agentsStates: endStates(item.agentsStates, 'interrupted') }
    case 'mcpToolCall':
      return { ...item, status: 'interrupted', result: null, error: null, durationMs }
    default:
      return { ...item, status: 'interrupted', contentItems: [], success: null, durationMs }
  }
}

/**
 * Map a Harness tool call to the Codex item that renders it best in Code
 * Desktop. `present` is the tool definition's pure presenter (may be absent).
 * `threadId` is the calling thread (a collab item's sender).
 */
export function toolItem({ callId, name, args, cwd, definition, threadId, time = Date.now() }) {
  // A model-written dynamic workflow: the generic tool item plus its run (workflows.js).
  if (name === WORKFLOW_TOOL) {
    return {
      type: 'dynamicToolCall', id: callId, namespace: null, tool: name, arguments: args ?? {}, status: 'inProgress',
      contentItems: null, success: null, durationMs: null, workflowRun: workflowRunOf(args, callId, time),
    }
  }
  const collab = COLLAB_TOOLS[name]
  if (collab) {
    const target = typeof args?.agent_id === 'string' && args.agent_id ? args.agent_id : null
    const prompt = collab === 'spawnAgent' ? args?.prompt : collab === 'sendMessage' ? args?.message : null
    return {
      type: 'collabAgentToolCall', id: callId, tool: collab, status: 'inProgress', senderThreadId: threadId ?? '',
      receiverThreadIds: target ? [target] : [], prompt: typeof prompt === 'string' ? prompt : null,
      model: typeof args?.model === 'string' ? args.model : null,
      reasoningEffort: typeof args?.reasoning_effort === 'string' ? args.reasoning_effort : null,
      agentsStates: {},
      // Bridge field: the delegation's display label (dsh `description`).
      ...(collab === 'spawnAgent' && typeof args?.description === 'string' ? { description: args.description } : {}),
    }
  }
  let view
  try {
    view = definition?.presentCall?.(args)
  } catch {
    view = undefined
  }
  const absolute = (path) => (typeof path === 'string' && path && !isAbsolute(path) && cwd ? resolve(cwd, path) : path)

  if (view?.card === 'terminal' || (name === 'bash' && typeof args?.command === 'string')) {
    const command = view?.title ?? args?.command ?? ''
    return {
      type: 'commandExecution',
      id: callId,
      pluginId: null,
      scriptPath: null,
      command,
      cwd: absolute(view?.cwd ?? args?.workdir) ?? cwd ?? '',
      processId: null,
      source: 'agent',
      status: 'inProgress',
      commandActions: [{ type: 'unknown', command }],
      aggregatedOutput: null,
      exitCode: null,
      durationMs: null,
      ...(typeof args?.description === 'string' ? { description: args.description } : {}),
      // Bridge field: the shell the tool runs, for the card's Bash/PowerShell title and
      // prompt glyph (source Uoe `bo(e.name) ?? "bash"`, approval-current.js:6874-6907).
      shell: name === 'pwsh' ? 'powershell' : 'bash',
    }
  }
  if (!view && (name === 'write' || name === 'edit') && typeof args?.file_path === 'string') {
    // Presenter unavailable: derive the same diff card the fs tools present.
    view = name === 'write'
      ? { card: 'diff', diffs: [{ path: args.file_path, oldText: null, newText: String(args.content ?? '') }] }
      : { card: 'diff', diffs: [{ path: args.file_path, oldText: args.old_string || null, newText: String(args.new_string ?? '') }] }
  }
  if (!view && (name === 'read' || name === 'read_image') && typeof args?.file_path === 'string') {
    view = { card: 'generic', kind: 'read', title: `Read ${args.file_path}`, locations: [{ path: args.file_path }] }
  }
  if (view?.card === 'diff') {
    const changes = (view.diffs ?? []).map((diff) => fileChangeOf(diff, absolute))
    return { type: 'fileChange', id: callId, changes, status: 'inProgress' }
  }
  const kind = view?.kind
  const path = view?.locations?.[0]?.path ?? args?.file_path ?? args?.path
  if (kind === 'read' && typeof path === 'string') {
    const full = absolute(path)
    const command = view?.title ?? `Read ${path}`
    return {
      type: 'commandExecution', id: callId, pluginId: null, scriptPath: null, command, cwd: cwd ?? '', processId: null,
      source: 'agent', status: 'inProgress', commandActions: [{ type: 'read', command, name: basename(full), path: full }],
      aggregatedOutput: null, exitCode: null, durationMs: null,
    }
  }
  // Before the code-search branch: web_search presents itself as kind 'search'.
  if (name === 'web_search' || name === 'web_fetch' || kind === 'fetch') {
    const queries = Array.isArray(args?.queries) ? args.queries.map(String) : typeof args?.query === 'string' ? [args.query] : null
    const url = typeof args?.url === 'string' ? args.url : null
    return {
      type: 'webSearch',
      id: callId,
      query: url ?? queries?.join(', ') ?? view?.title ?? name,
      action: url ? { type: 'openPage', url } : { type: 'search', query: queries?.[0] ?? null, queries },
      results: null,
      status: 'inProgress',
    }
  }
  if (name === 'grep' || name === 'glob' || (kind === 'search' && !Array.isArray(args?.queries))) {
    // Glob is a search for its pattern too (the source Glob row reads
    // "Searched <pattern>"), not a directory listing.
    const query = args?.pattern ?? args?.query ?? null
    const command = view?.title ?? `${name} ${query ?? ''}`.trim()
    // arguments (a Code Desktop extension of the Codex search action): the call's raw
    // inputs, which the row body lists like the source's generic details (qO). tool (also an
    // extension): the Harness tool name, so a group summary reads glob as the source's
    // 'found files' and grep as 'searched code' (cf6ae6197 fk).
    const action = { type: 'search', command, query, path: absolute(args?.path) ?? null, tool: name,
      ...(args && typeof args === 'object' && !Array.isArray(args) ? { arguments: args } : {}) }
    return {
      type: 'commandExecution', id: callId, pluginId: null, scriptPath: null, command, cwd: cwd ?? '', processId: null,
      source: 'agent', status: 'inProgress', commandActions: [action], aggregatedOutput: null, exitCode: null, durationMs: null,
    }
  }
  const mcp = /^mcp__(.+?)__(.+)$/.exec(name)
  if (mcp) {
    return {
      type: 'mcpToolCall', id: callId, server: mcp[1], tool: mcp[2], status: 'inProgress', arguments: args ?? {},
      appContext: null, pluginId: null, readOnlyHint: null, result: null, error: null, durationMs: null,
    }
  }
  return {
    type: 'dynamicToolCall', id: callId, namespace: null, tool: name, arguments: args ?? {}, status: 'inProgress',
    contentItems: null, success: null, durationMs: null, ...(view?.title ? { title: view.title } : {}),
  }
}

/**
 * A delegation's result. A continuable child is only started (it keeps
 * running until its settled notice); a foreground (one-shot) run returns the
 * child's output, which is the known child's closing message.
 */
function completeCollabItem(item, failed, text) {
  const status = failed ? 'failed' : 'completed'
  if (item.tool !== 'spawnAgent') return { ...item, status }
  const started = failed ? null : STARTED_SUBAGENT.exec(text)
  if (started) {
    const id = started[1]
    return { ...item, status, receiverThreadIds: [id], agentsStates: { ...item.agentsStates, [id]: item.agentsStates?.[id] ?? { status: 'running', message: null } } }
  }
  if (!failed && STARTED_JOB.test(text)) return { ...item, status }
  const outcome = !failed ? 'completed' : RUN_CANCELLED.test(text) ? 'interrupted' : 'errored'
  const states = Object.fromEntries(item.receiverThreadIds.map((id) => [id, { status: outcome, message: text || null }]))
  return { ...item, status, agentsStates: { ...item.agentsStates, ...states } }
}

function fileChangeOf(diff, absolute) {
  const path = absolute(diff.path) ?? diff.path
  if (diff.oldText === null || diff.oldText === undefined) {
    return { path, kind: { type: 'add' }, diff: diff.newText ?? '' }
  }
  return { path, kind: { type: 'update', move_path: null }, diff: unifiedDiff(diff.oldText, diff.newText ?? '') }
}

/**
 * Complete a tool item from its durable result. `error` is the tool/result's
 * `data.error` info; `rejected` says the user declined the call's approval.
 */
export function completeToolItem(item, { name, args, result, definition, cwd, durationMs, error, rejected = false, imagePath }) {
  const failed = result.isError === true
  // MCP, dynamic and read results deliver their images (toolImages); everything else keeps '[image]'.
  const images = !failed && (item.type === 'mcpToolCall' || item.type === 'dynamicToolCall' || item.commandActions?.[0]?.type === 'read')
    ? toolImages(result.content, imagePath) : new Map()
  const text = textOf(result.content, images)
  if (failed && isAborted(error, text)) return interruptedToolItem(item, durationMs)
  if (failed && rejected) {
    // Denied: commands and file changes have a Codex 'declined' status; other
    // item types have none and stay failed.
    if (item.type === 'commandExecution') return { ...item, status: 'declined', aggregatedOutput: null, exitCode: null, durationMs }
    if (item.type === 'fileChange') return { ...item, status: 'declined' }
  }
  let view
  try {
    view = definition?.presentResult?.(args, { content: result.content ?? [], isError: failed, meta: result.meta })
  } catch {
    view = undefined
  }
  const absolute = (path) => (typeof path === 'string' && path && !isAbsolute(path) && cwd ? resolve(cwd, path) : path)
  switch (item.type) {
    case 'commandExecution': {
      if (view?.card === 'terminal') {
        return { ...item, status: failed ? 'failed' : (view.exitCode ?? 0) === 0 ? 'completed' : 'failed', aggregatedOutput: view.output ?? '', exitCode: view.exitCode ?? (failed ? 1 : 0), durationMs }
      }
      if (view?.card === 'read') {
        // One `N: text` line per structured line, so the UI strips exactly one
        // prefix; view.content is that body plus the read footer.
        const body = Array.isArray(view.lines)
          ? view.lines.map((line) => `${line.number}: ${line.text}`).join('\n')
          : readBody(textOf(view.content))
        return { ...item, status: 'completed', aggregatedOutput: body, exitCode: 0, durationMs }
      }
      if (item.commandActions?.[0]?.type === 'read') {
        // No read view: the raw fs envelope and footer would render as file content.
        // read_image: the envelope's one description line, and the image itself as
        // outputImages (a bridge field: Codex inputImage items, like a dynamic tool's).
        const imageRead = images.size > 0 ? /^<path>[^\n]*<\/path>\n<type>image<\/type>\n<content>\n([\s\S]*)\n<\/content>$/u.exec(text) : null
        return { ...item, status: failed ? 'failed' : 'completed', aggregatedOutput: imageRead ? imageRead[1] : readBody(text), exitCode: failed ? 1 : 0, durationMs,
          ...(images.size > 0 ? { outputImages: [...images.values()].map(inputImage) } : {}) }
      }
      if (view?.card === 'search') {
        const body = view.shape === 'paths'
          ? view.paths.join('\n')
          : view.files.flatMap((file) => file.matches.map((match) => `${file.path}:${match.lineNumber}:${match.line}`)).join('\n')
        return { ...item, status: 'completed', aggregatedOutput: body || text, exitCode: 0, durationMs }
      }
      const parsed = name === 'bash' ? parseExitFooter(text) : { output: text, exitCode: null }
      const exitCode = parsed.exitCode ?? (failed ? 1 : 0)
      return { ...item, status: failed || exitCode !== 0 ? 'failed' : 'completed', aggregatedOutput: parsed.output, exitCode, durationMs }
    }
    case 'fileChange': {
      const changes = view?.card === 'diff' && Array.isArray(view.diffs) && view.diffs.length > 0
        ? view.diffs.map((diff) => fileChangeOf(diff, absolute))
        : item.changes
      return { ...item, changes, status: failed ? 'failed' : 'completed', ...(failed ? { error: text } : {}) }
    }
    case 'webSearch': {
      // Search: the structured sources; fetch: the fetched (markdown) text.
      const results = failed ? null
        : view?.card === 'web' && view.kind === 'search' ? view.sources
          : item.action?.type === 'openPage' ? text
            : null
      return { ...item, status: failed ? 'failed' : 'completed', results, ...(failed ? { error: { message: text } } : {}) }
    }
    case 'mcpToolCall':
      return {
        ...item, status: failed ? 'failed' : 'completed', durationMs,
        // An image stays an MCP ImageContent block {type, data, mimeType} for the UI's screenshot thumbnails.
        result: failed ? null : { content: (result.content ?? []).map((block) => (block.type === 'text' ? { type: 'text', text: block.text }
          : images.has(block) ? { type: 'image', ...images.get(block) } : { type: 'text', text: `[${block.type}]` })), structuredContent: null },
        error: failed ? { message: text } : null,
      }
    case 'collabAgentToolCall':
      return completeCollabItem(item, failed, text)
    default:
      return {
        ...item, status: failed ? 'failed' : 'completed', success: !failed, durationMs,
        contentItems: [...(text ? [{ type: 'inputText', text }] : []), ...[...images.values()].map(inputImage)],
      }
  }
}

/**
 * Events that make a thread recent: turn bounds, replies and human prompts
 * (not runtime notices or injected context). The Codex Thread's updatedAt.
 */
export function isActivity(event) {
  switch (event?.type) {
    case 'turn/start':
    case 'assistant/message':
    case 'turn/end':
      return true
    case 'user/message':
      return event.data?.source?.kind === 'user'
    default:
      return false
  }
}

export class ThreadProjector {
  /**
   * `inheritedHistory: 'hide'` drops a fork child's seeded parent history at
   * its `session/end-seed {inherited:true}` marker (sub-agent forks); a fork
   * the user made keeps showing the history it copied ('show', the default).
   * `imagePath` maps a user image block's attachment to a host file path, so
   * the prompt's image is a Codex localImage (the attachment store's imageHostPath).
   * @param {{ threadId: string, cwd?: string, toolDefinition?: (name: string) => any, inheritedHistory?: 'show' | 'hide', imagePath?: (ref: object) => string | undefined }} options
   */
  constructor({ threadId, cwd, toolDefinition, inheritedHistory = 'show', imagePath }) {
    this.threadId = threadId
    this.cwd = cwd
    this.toolDefinition = toolDefinition ?? (() => undefined)
    this.imagePath = imagePath
    this.inheritedHistory = inheritedHistory
    this.lastSeq = -1
    // Time of the last event of any kind (internal: stale-compaction settling).
    this.updatedAtMs = null
    this.reset()
  }

  /** The projected conversation state (everything but the log position). */
  reset() {
    this.turns = []
    this.byDshTurn = new Map()
    this.current = null
    this.heldUserMessages = []
    // subAgentActivity items waiting for their turn's Codex identity.
    this.heldActivities = []
    this.tools = new Map()
    this.preview = ''
    this.title = null
    this.plan = null
    this.lastUsage = null
    this.lastUsageTurnId = null
    // compactionId → owning turn while the compaction is open. A manual
    // /compact runs between turns and gets a synthetic `turn-c<id>` turn.
    this.compactions = new Map()
    this.lastSyntheticCompactionTurnId = null
    // Durable approval audit pairs: approval id → tool call id, and the calls
    // the user declined (their error results render as Denied, not Failed).
    this.approvalCalls = new Map()
    this.rejectedCalls = new Set()
    // child session id → {turn, itemId, label} of the delegation that made it.
    this.spawns = new Map()
    // Model workflow runs (workflows.js) → {turn, itemId}, by app run id and engine run id.
    this.workflowItems = new Map()
    // This session's own delegation label (its `subagent/descriptor`), when it is a sub-agent.
    this.agentLabel = null
    // Thread recency: the last human prompt, reply or turn bound (isActivity).
    // Opening a session, a preset change or a title is not activity.
    this.lastActivityMs = null
  }

  /** The delegation label the parent gave a child, when this log made it. */
  childLabel(childId) {
    return this.spawns.get(childId)?.label ?? null
  }

  /** The turn holding the delegation that made a child. */
  childTurnId(childId) {
    return this.spawns.get(childId)?.turn.id ?? null
  }

  turnIdFor(dshTurn) {
    return this.byDshTurn.get(dshTurn)?.id ?? null
  }

  get activeTurn() {
    return this.current?.status === 'inProgress' ? this.current : null
  }

  /** Codex Turn snapshot (items copied). */
  snapshot(turn, itemsView = 'full') {
    return {
      id: turn.id,
      items: itemsView === 'full' ? turn.items.map((item) => ({ ...item })) : [],
      itemsView,
      status: turn.status,
      error: turn.error,
      startedAt: nowSeconds(turn.startedAtMs),
      completedAt: turn.completedAtMs ? nowSeconds(turn.completedAtMs) : null,
      durationMs: turn.completedAtMs && turn.startedAtMs ? turn.completedAtMs - turn.startedAtMs : null,
    }
  }

  /** Start a turn's Codex identity if it has none yet. */
  ensureTurn(notes, time, fallbackId) {
    const turn = this.current
    if (!turn) return null
    if (turn.id) return turn
    turn.id = fallbackId ?? `turn-n${turn.dsh}`
    this.turns.push(turn)
    notes.push({ method: 'turn/started', params: { threadId: this.threadId, turn: this.snapshot(turn) } })
    // A notice that opened the turn must not decide its id (a human message
    // after it does); its activity item lands once the turn has one.
    for (const item of this.heldActivities.splice(0)) this.pushItem(notes, turn, item, time)
    return turn
  }

  pushItem(notes, turn, item, time, completed = true) {
    const existing = turn.items.findIndex((candidate) => candidate.id === item.id)
    if (existing >= 0) turn.items[existing] = item
    else turn.items.push(item)
    if (notes) {
      notes.push({ method: 'item/started', params: { item, threadId: this.threadId, turnId: turn.id, startedAtMs: time } })
      if (completed) notes.push({ method: 'item/completed', params: { item, threadId: this.threadId, turnId: turn.id, completedAtMs: time } })
    }
  }

  replaceItem(turn, item) {
    const index = turn.items.findIndex((candidate) => candidate.id === item.id)
    if (index >= 0) turn.items[index] = item
    else turn.items.push(item)
  }

  /** Settle a synthetic compaction turn and announce it. */
  closeTurn(notes, turn, status, error, time) {
    turn.status = status
    turn.error = error
    turn.completedAtMs = time
    for (const [id, owner] of this.compactions) if (owner === turn) this.compactions.delete(id)
    notes.push({ method: 'turn/completed', params: { threadId: this.threadId, turn: this.snapshot(turn, 'notLoaded') } })
    if (this.current === turn) this.current = { ...turn }
  }

  /**
   * Close a synthetic compaction turn the log never closed (its compaction/end
   * was not appended); a turn already settled yields no notes.
   * @returns {Array<{method: string, params: object}>}
   */
  closeSynthetic(turnId, status, error = null, time = Date.now()) {
    const turn = this.turns.find((candidate) => candidate.id === turnId && candidate.synthetic)
    if (!turn || turn.status !== 'inProgress') return []
    const notes = []
    this.closeTurn(notes, turn, status, status === 'failed' ? error : null, time)
    return notes
  }

  /** After a replay with nothing running: an open compaction turn was cut off. */
  settleStaleCompaction(time = this.updatedAtMs ?? Date.now()) {
    const turn = this.activeTurn
    return turn?.synthetic ? this.closeSynthetic(turn.id, 'interrupted', null, time) : []
  }

  /**
   * Apply one durable event.
   * @returns {Array<{method: string, params: object}>} Codex notifications implied by the event.
   */
  apply(event) {
    const notes = []
    if (typeof event.seq === 'number') {
      if (event.seq <= this.lastSeq) return notes
      this.lastSeq = event.seq
    }
    const time = typeof event.time === 'number' ? event.time : Date.now()
    this.updatedAtMs = time
    if (isActivity(event)) this.lastActivityMs = time
    const data = event.data ?? {}
    switch (event.type) {
      case 'turn/start': {
        // A compaction turn left open (its end was never logged) cannot outlive the next turn.
        if (this.current?.synthetic && this.current.status === 'inProgress') this.closeTurn(notes, this.current, 'interrupted', null, time)
        const turn = { dsh: data.turn, id: null, items: [], status: 'inProgress', error: null, startedAtMs: time, completedAtMs: null }
        this.current = turn
        this.byDshTurn.set(data.turn, turn)
        const held = this.heldUserMessages.splice(0)
        for (const message of held) this.applyUserMessage(notes, message, time)
        break
      }
      case 'user/message':
        // Runtime notices about sub-agents are agent state, never user bubbles;
        // other non-human sources (injected context) are dropped.
        if (data.source?.kind === 'subagent-settled') this.applySettled(notes, data, time)
        else if (data.source?.kind === 'agent-message') this.applyActivity(notes, data, 'interacted', data.source.senderSessionId, time)
        if (data.source?.kind !== 'user') break
        if (!this.current || this.current.status !== 'inProgress' || this.current.synthetic) {
          this.heldUserMessages.push(data)
          break
        }
        this.applyUserMessage(notes, data, time)
        break
      case 'assistant/message': {
        const turn = this.byDshTurn.get(data.turn) ?? this.current
        if (!turn) break
        if (turn === this.current) this.ensureTurn(notes, time)
        if (!turn.id) break
        const content = data.message?.content ?? []
        content.forEach((block, index) => {
          const id = assistantItemId(data.turn, data.step, index)
          if (block.type === 'text') {
            const item = { type: 'agentMessage', id, text: block.text ?? '', phase: null, memoryCitation: null, delivery: null, questions: null }
            this.replaceItem(turn, item)
            notes.push({ method: 'item/completed', params: { item, threadId: this.threadId, turnId: turn.id, completedAtMs: time } })
          } else if (block.type === 'reasoning' && block.text) {
            const item = { type: 'reasoning', id, summary: [block.text], content: [] }
            this.replaceItem(turn, item)
            notes.push({ method: 'item/completed', params: { item, threadId: this.threadId, turnId: turn.id, completedAtMs: time } })
          }
        })
        if (data.usage) {
          this.lastUsage = data.usage
          this.lastUsageTurnId = turn.id
        }
        break
      }
      case 'tool/call': {
        const turn = this.byDshTurn.get(data.turn) ?? this.current
        if (!turn) break
        if (turn === this.current) this.ensureTurn(notes, time)
        if (!turn.id) break
        const args = parseArguments(data.arguments)
        const definition = this.toolDefinition(data.name)
        this.tools.set(data.callId, { name: data.name, args, turn, startedAtMs: time, definition })
        // The structured-output capture (structured.js) is the turn's answer, not a tool row:
        // its accepted arguments become the closing agentMessage at tool/result.
        if (data.name === STRUCTURED_OUTPUT_TOOL) break
        const item = toolItem({ callId: data.callId, name: data.name, args, cwd: this.cwd, definition, threadId: this.threadId, time })
        if (item.workflowRun) this.workflowItems.set(item.workflowRun.id, { turn, itemId: item.id })
        // The proposed plan reads as the Codex plan item, above its review card.
        if (data.name === 'exit_plan_mode' && typeof args?.plan === 'string') this.pushItem(notes, turn, { type: 'plan', id: `plan-${data.callId}`, text: args.plan }, time)
        this.pushItem(notes, turn, item, time, false)
        if (data.name === 'todo_write' && Array.isArray(args?.todos)) this.applyPlan(notes, turn, args.todos)
        break
      }
      case 'tool/result': {
        const message = data.message ?? {}
        const call = this.tools.get(message.toolCallId)
        if (!call) break
        const turn = call.turn
        if (call.name === STRUCTURED_OUTPUT_TOOL) {
          // Accepted (the tool validated it against the turn's schema): the JSON answer.
          if (message.isError !== true && turn.id) {
            const item = { type: 'agentMessage', id: `structured-${message.toolCallId}`, text: JSON.stringify(call.args ?? null), phase: null, memoryCitation: null, delivery: null, questions: null }
            this.pushItem(notes, turn, item, time)
          }
          break
        }
        const index = turn.items.findIndex((candidate) => candidate.id === message.toolCallId)
        if (index < 0) break
        let item = completeToolItem(turn.items[index], {
          name: call.name, args: call.args, definition: call.definition, cwd: this.cwd,
          result: { content: message.content, isError: message.isError, meta: data.meta },
          durationMs: Math.max(0, time - call.startedAtMs),
          error: data.error, rejected: this.rejectedCalls.has(message.toolCallId), imagePath: this.imagePath,
        })
        if (item.workflowRun) {
          const run = item.status === 'interrupted'
            ? workflowInterrupted(item.workflowRun, time)
            : workflowToolResult(item.workflowRun, { isError: message.isError === true, text: textOf(message.content) }, time)
          item = { ...item, workflowRun: run }
        }
        turn.items[index] = item
        if (item.type === 'collabAgentToolCall' && item.tool === 'spawnAgent') {
          for (const childId of item.receiverThreadIds) if (!this.spawns.has(childId)) this.spawns.set(childId, { turn, itemId: item.id, label: item.description ?? null })
        }
        notes.push({ method: 'item/completed', params: { item, threadId: this.threadId, turnId: turn.id, completedAtMs: time } })
        break
      }
      case 'subagent/catalog':
        this.applyCatalog(notes, data, time)
        break
      case 'subagent/descriptor':
        if (typeof data.label === 'string' && data.label) this.agentLabel = data.label
        break
      case 'session/end-seed':
        // A sub-agent fork starts with its parent's history; its own begins here.
        if (data.inherited === true && this.inheritedHistory === 'hide') this.reset()
        break
      case 'approval/asked':
        if (data.id !== undefined && data.callId !== undefined) this.approvalCalls.set(data.id, data.callId)
        break
      case 'approval/decided': {
        const callId = this.approvalCalls.get(data.id)
        this.approvalCalls.delete(data.id)
        if (callId !== undefined && data.outcome === 'rejected') this.rejectedCalls.add(callId)
        break
      }
      case 'todo/write':
        if (this.current?.id && Array.isArray(data.todos)) this.applyPlan(notes, this.current, data.todos)
        break
      case 'compaction/start': {
        let turn = this.current?.status === 'inProgress' && !this.current.synthetic ? this.ensureTurn(notes, time) : null
        if (!turn) {
          // Manual compaction runs between turns (`turn: null`); Codex runs it
          // as its own turn kind, so it gets a synthetic turn that replays alike.
          if (this.current?.synthetic && this.current.status === 'inProgress') this.closeTurn(notes, this.current, 'interrupted', null, time)
          turn = { dsh: null, id: `turn-c${data.compactionId}`, items: [], status: 'inProgress', error: null, startedAtMs: time, completedAtMs: null, synthetic: true }
          this.current = turn
          this.turns.push(turn)
          this.lastSyntheticCompactionTurnId = turn.id
          notes.push({ method: 'turn/started', params: { threadId: this.threadId, turn: this.snapshot(turn) } })
        }
        const item = { type: 'contextCompaction', id: `compaction-${data.compactionId}` }
        this.compactions.set(data.compactionId, turn)
        this.pushItem(notes, turn, item, time, false)
        break
      }
      case 'compaction/end': {
        const turn = this.compactions.get(data.compactionId)
        if (!turn) break
        this.compactions.delete(data.compactionId)
        const item = { type: 'contextCompaction', id: `compaction-${data.compactionId}` }
        const failure = typeof data.error === 'string' && data.error ? data.error : null
        if (!turn.synthetic || !failure) notes.push({ method: 'item/completed', params: { item, threadId: this.threadId, turnId: turn.id, completedAtMs: time } })
        if (!turn.synthetic || turn.status !== 'inProgress') break
        // A failed or stopped compaction leaves its item open: the turn's
        // outcome settles it, as history does ("Compaction interrupted").
        if (!failure) this.closeTurn(notes, turn, 'completed', null, time)
        else if (COMPACTION_ABORTED.test(failure)) this.closeTurn(notes, turn, 'interrupted', null, time)
        else this.closeTurn(notes, turn, 'failed', { message: `Compaction failed: ${failure}`, codexErrorInfo: null, additionalDetails: null, misalignment: null }, time)
        break
      }
      case 'session/title':
        if (typeof data.title === 'string' && data.title) {
          this.title = data.title
          notes.push({ method: 'thread/name/updated', params: { threadId: this.threadId, threadName: data.title } })
        }
        break
      case 'llm/retry': {
        const turn = this.current?.status === 'inProgress' ? this.ensureTurn(notes, time) : null
        const failure = data.failure ?? {}
        notes.push({
          method: 'error',
          params: {
            error: failureError(failure, failure.message || failure.code || 'Request failed'),
            willRetry: true, threadId: this.threadId, turnId: turn?.id ?? '',
            // Bridge field: the retry count for "Retrying (n/max)"; an
            // 'always' policy has no maximum.
            retry: { attempt: data.retry ?? null, maxRetries: data.maxRetries ?? null },
          },
        })
        break
      }
      case 'turn/end': {
        const turn = this.byDshTurn.get(data.turn)
        if (!turn) break
        if (!turn.id) {
          // A turn that produced nothing visible (e.g. cancelled before the
          // model replied) still has a Codex identity once it ends.
          if (turn === this.current) this.ensureTurn(notes, time)
          else break
        }
        turn.status = turnStatusOf(data.reason)
        turn.error = turnError(data.reason)
        turn.completedAtMs = time
        // A tool still running when its turn closes never completed; history
        // must not show it spinning forever. A stopped turn stopped it too
        // (the live reducer settles it the same way).
        const settled = turn.status === 'interrupted' ? 'interrupted' : 'failed'
        for (const item of turn.items) {
          if (item.status !== 'inProgress') continue
          this.replaceItem(turn, { ...item, status: settled, ...(item.workflowRun ? { workflowRun: workflowInterrupted(item.workflowRun, time) } : {}) })
        }
        notes.push({ method: 'turn/completed', params: { threadId: this.threadId, turn: this.snapshot(turn, 'notLoaded') } })
        if (this.current === turn) this.current = { ...turn, status: turn.status }
        break
      }
      default:
        if (isWorkflowRecord(event.type)) this.applyWorkflow(notes, data, (run) => workflowRecord(run, event.type, data, time))
        break
    }
    return notes
  }

  /**
   * A phase() call of a model workflow this log started (the engine's live
   * `workflow/phase` event; not recorded durably).
   * @returns {any[]} the item notifications
   */
  workflowPhase(runId, title, time = Date.now()) {
    const notes = []
    if (this.workflowItems.has(runId)) this.applyWorkflow(notes, { runId }, (run) => workflowPhase(run, title, time))
    return notes
  }

  /** Whether a model workflow run (by engine run id) belongs to this log. */
  hasWorkflowRun(runId) {
    return this.workflowItems.has(runId)
  }

  /** The tool item of a model workflow run, by app run id or engine run id. */
  workflowItem(runId) {
    const entry = this.workflowItems.get(runId)
    return entry?.turn.items.find((candidate) => candidate.id === entry.itemId)
  }

  /** Update one workflow item's run and re-announce the item (no lifecycle time: the app keeps its own). */
  applyWorkflow(notes, data, reduce) {
    let entry = typeof data?.runId === 'string' ? this.workflowItems.get(data.runId) : undefined
    // run-start names the run of a call still waiting for its id (the record
    // comes after start() returned, while the tool call is in progress).
    if (!entry && typeof data?.runId === 'string') {
      const candidates = [...this.workflowItems.values()].filter(({ turn, itemId }) => {
        const item = turn.items.find((candidate) => candidate.id === itemId)
        return item?.workflowRun && item.workflowRun.runId === null
      })
      entry = candidates.find(({ turn, itemId }) => turn.items.find((candidate) => candidate.id === itemId)?.workflowRun.name === data.name) ?? candidates[0]
      if (entry) this.workflowItems.set(data.runId, entry)
    }
    if (!entry) return
    const index = entry.turn.items.findIndex((candidate) => candidate.id === entry.itemId)
    if (index < 0) return
    const current = entry.turn.items[index]
    const run = reduce(current.workflowRun)
    if (run === current.workflowRun) return
    const item = { ...current, workflowRun: run }
    entry.turn.items[index] = item
    if (!entry.turn.id) return
    notes.push({ method: item.status === 'inProgress' ? 'item/started' : 'item/completed', params: { item, threadId: this.threadId, turnId: entry.turn.id } })
  }

  applyUserMessage(notes, message, time) {
    const turn = this.current
    if (!turn) return
    if (!turn.id) this.ensureTurn(notes, time, `turn-${message.id}`)
    // Bracket forms and images come back as their Codex parts; the preview is typed text only.
    const content = toCodexInputs(message.content, { imagePath: this.imagePath })
    const text = promptText(message.content)
    if (!this.preview && text) this.preview = text.slice(0, 200)
    this.pushItem(notes, turn, { type: 'userMessage', id: message.id, clientId: null, content }, time)
  }

  /**
   * The parent's discovery fact for a child it just made, logged while the
   * delegating call still runs: the running spawn call with that label (the
   * call's `description`), or the only running spawn call when unlabeled.
   */
  applyCatalog(notes, data, time) {
    const childId = data.childId
    if (typeof childId !== 'string' || !childId || this.spawns.has(childId)) return
    const label = typeof data.label === 'string' ? data.label : undefined
    const running = []
    for (const [callId, call] of this.tools) {
      if (COLLAB_TOOLS[call.name] !== 'spawnAgent' || call.childId) continue
      const item = call.turn.items.find((candidate) => candidate.id === callId)
      if (item?.status === 'inProgress') running.push({ call, item })
    }
    const match = label !== undefined ? running.find(({ call }) => call.args?.description === label) : running.length === 1 ? running[0] : undefined
    if (!match) return
    const { call, item } = match
    call.childId = childId
    const next = { ...item, receiverThreadIds: [childId], agentsStates: { ...item.agentsStates, [childId]: { status: 'running', message: null } } }
    this.replaceItem(call.turn, next)
    this.spawns.set(childId, { turn: call.turn, itemId: item.id, label: label ?? next.description ?? null })
    // Still running: the client merges the child into its open row.
    if (call.turn.id) notes.push({ method: 'item/started', params: { item: next, threadId: this.threadId, turnId: call.turn.id, startedAtMs: time } })
  }

  /**
   * A continuable child settled (dsh-subagent createSettlementMessage): its
   * delegation row takes the outcome and closing text, re-completed under
   * its own turn, and the current turn records the activity.
   */
  applySettled(notes, message, time) {
    const childId = message.source?.senderSessionId
    if (typeof childId !== 'string' || !childId) return
    const status = settledStatus(message.source.summary)
    const spawn = this.spawns.get(childId)
    const index = spawn ? spawn.turn.items.findIndex((candidate) => candidate.id === spawn.itemId) : -1
    if (index >= 0) {
      const item = spawn.turn.items[index]
      const next = { ...item, agentsStates: { ...item.agentsStates, [childId]: { status, message: settledMessage(message.content) } } }
      spawn.turn.items[index] = next
      if (spawn.turn.id) notes.push({ method: 'item/completed', params: { item: next, threadId: this.threadId, turnId: spawn.turn.id, completedAtMs: time } })
    }
    this.applyActivity(notes, message, status === 'interrupted' ? 'interrupted' : 'completed', childId, time)
  }

  /** A Codex subAgentActivity roll-up item (never a visible row) in the current turn. */
  applyActivity(notes, message, kind, agentThreadId, time) {
    if (typeof agentThreadId !== 'string' || !agentThreadId) return
    const item = { type: 'subAgentActivity', id: `subagent-${message.id}`, kind, agentThreadId, agentPath: agentThreadId }
    const turn = this.current
    if (turn?.status === 'inProgress' && !turn.synthetic && turn.id) this.pushItem(notes, turn, item, time)
    else this.heldActivities.push(item)
  }

  applyPlan(notes, turn, todos) {
    const plan = todos.map((todo) => ({
      step: String(todo.content ?? todo.step ?? ''),
      status: todo.status === 'in_progress' ? 'inProgress' : todo.status === 'completed' ? 'completed' : 'pending',
    }))
    this.plan = plan
    notes.push({ method: 'turn/plan/updated', params: { threadId: this.threadId, turnId: turn.id, explanation: null, plan } })
  }
}

/**
 * Live `agent/assistant-stream` frames → agentMessage / reasoning lifecycle and
 * deltas, under the same `msg-<turn>.<step>.<block>` ids the projector gives
 * the committed assistant/message. That later commit re-completes the items;
 * the client merges by id, so the repeat is harmless.
 */
export class LiveStreamMapper {
  /** @param {{ threadId: string, projector: ThreadProjector }} options */
  constructor({ threadId, projector }) {
    this.threadId = threadId
    this.projector = projector
    this.streams = new Map()
  }

  /**
   * Map one frame.
   * @returns {Array<{method: string, params: object}>} Codex notifications implied by the frame.
   */
  frame(frame, nowMs = Date.now()) {
    const notes = []
    if (frame.type === 'start') {
      const previous = [...this.streams.values()].find((stream) => stream.turn === frame.turn && stream.step === frame.step)
      // A retried attempt in the same step restarts the visible text.
      if (previous) for (const item of previous.items.values()) this.start(notes, previous, item.index, item.type, nowMs, true)
      this.streams.set(frame.attemptId, { turn: frame.turn, step: frame.step, items: new Map() })
      return notes
    }
    const stream = this.streams.get(frame.attemptId)
    if (!stream) return notes
    if (frame.type === 'end') {
      if (frame.outcome?.kind !== 'committed' || frame.outcome.eventType !== 'assistant/message') {
        // Abandoned attempt: clear what it showed, deltas included.
        const turnId = this.projector.turnIdFor(stream.turn)
        for (const item of stream.items.values()) {
          const id = assistantItemId(stream.turn, stream.step, item.index)
          const body = item.type === 'reasoning'
            ? { type: 'reasoning', id, summary: [], content: [], reasoningText: '' }
            : { type: 'agentMessage', id, text: '', phase: null, memoryCitation: null, delivery: null, questions: null }
          if (turnId) notes.push({ method: 'item/completed', params: { item: body, threadId: this.threadId, turnId, completedAtMs: nowMs } })
        }
      }
      this.streams.delete(frame.attemptId)
      return notes
    }
    const chunk = frame.chunk
    if (!chunk) return notes
    if (chunk.type === 'block-start' && (chunk.blockType === 'text' || chunk.blockType === 'reasoning')) {
      this.start(notes, stream, chunk.index, chunk.blockType === 'text' ? 'text' : 'reasoning', nowMs)
    } else if (chunk.type === 'text-delta' || chunk.type === 'reasoning-delta') {
      const type = chunk.type === 'text-delta' ? 'text' : 'reasoning'
      if (!stream.items.has(chunk.index)) this.start(notes, stream, chunk.index, type, nowMs)
      const turnId = this.projector.turnIdFor(stream.turn)
      if (!turnId || !chunk.text) return notes
      const itemId = assistantItemId(stream.turn, stream.step, chunk.index)
      if (type === 'text') notes.push({ method: 'item/agentMessage/delta', params: { threadId: this.threadId, turnId, itemId, delta: chunk.text } })
      else notes.push({ method: 'item/reasoning/summaryTextDelta', params: { threadId: this.threadId, turnId, itemId, delta: chunk.text, summaryIndex: 0 } })
    } else if (chunk.type === 'block-end' && stream.items.has(chunk.index) && (chunk.block?.type === 'reasoning' || chunk.block?.type === 'text')) {
      // The block is assembled: close it now rather than when the whole step
      // commits, so a finished thought stops reading as "Thinking…".
      const turnId = this.projector.turnIdFor(stream.turn)
      if (!turnId) return notes
      const id = assistantItemId(stream.turn, stream.step, chunk.index)
      const item = chunk.block.type === 'reasoning'
        ? { type: 'reasoning', id, summary: [chunk.block.text ?? ''], content: [] }
        : { type: 'agentMessage', id, text: chunk.block.text ?? '', phase: null, memoryCitation: null, delivery: null, questions: null }
      notes.push({ method: 'item/completed', params: { item, threadId: this.threadId, turnId, completedAtMs: nowMs } })
    }
    return notes
  }

  /** Forget the streams of a finished Harness turn. */
  endTurn(dshTurn) {
    for (const [key, stream] of this.streams) if (stream.turn === dshTurn) this.streams.delete(key)
  }

  start(notes, stream, index, type, nowMs, reset = false) {
    if (!reset) stream.items.set(index, { index, type })
    let turnId = this.projector.turnIdFor(stream.turn)
    if (!turnId) {
      this.projector.ensureTurn(notes, nowMs)
      turnId = this.projector.turnIdFor(stream.turn)
    }
    if (!turnId) return
    const id = assistantItemId(stream.turn, stream.step, index)
    const item = type === 'reasoning'
      ? { type: 'reasoning', id, summary: [], content: [], reasoningText: '' }
      : { type: 'agentMessage', id, text: '', phase: null, memoryCitation: null, delivery: null, questions: null }
    notes.push({ method: 'item/started', params: { item, threadId: this.threadId, turnId, startedAtMs: nowMs } })
  }
}

/** Replay a whole log; returns the projector. */
export function projectHistory(events, options) {
  const projector = new ThreadProjector(options)
  for (const event of events) projector.apply(event)
  return projector
}

/**
 * What only live notifications carry, replayed after a `thread/resume`
 * response: the context usage (turn = the usage's own turn, else the last
 * one) and the last todo list, so the Plan pane survives a reopen or restart.
 * @param {{ threadId: string, projector: ThreadProjector, tokenUsage: (usage: object) => object }} options
 * @returns {Array<{method: string, params: object}>}
 */
export function resumeReplayNotes({ threadId, projector, tokenUsage }) {
  const notes = []
  const lastTurnId = projector.turns.at(-1)?.id ?? ''
  if (projector.lastUsage) {
    notes.push({ method: 'thread/tokenUsage/updated', params: { threadId, turnId: projector.lastUsageTurnId ?? lastTurnId, tokenUsage: tokenUsage(projector.lastUsage) } })
  }
  if (projector.plan?.length) {
    notes.push({ method: 'turn/plan/updated', params: { threadId, turnId: lastTurnId, explanation: null, plan: projector.plan } })
  }
  return notes
}
