// End-to-end smoke of the real DeepSeek Harness core against a scripted model:
// a local Anthropic-Messages server (DEEPSEEK_BASE_URL) answers every request,
// so no key or network is needed. Covers what unit tests cannot: the bridge's
// scoped prompt sections and tools on a live agent, and the Harness `workflow`
// tool's run as item.workflowRun.
//
// Usage: node tests/fake-model-smoke.mjs   (exit code 0 = all checks passed)
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
const require = createRequire(import.meta.url)
const root = path.resolve(import.meta.dirname, '..')
// The client drops the core's stderr; keep it for failure reports.
const stderr = []
const childProcess = require('node:child_process')
const spawn = childProcess.spawn
childProcess.spawn = (...args) => {
  const child = spawn(...args)
  child.stderr?.on('data', (chunk) => stderr.push(String(chunk)))
  return child
}
const { CodexClient } = require('../../app/electron/codex.cjs')

const cleanup = []
const home = await fs.mkdtemp(path.join(os.tmpdir(), 'cd-fake-model-'))
const workspace = path.join(home, 'workspace')
await fs.mkdir(workspace, { recursive: true })
const requests = []

// ------------------------------------------------------------ scripted model

const textOf = (content) => (typeof content === 'string' ? content : (content ?? []).map((block) => block.text ?? (block.type === 'tool_result' ? textOf(block.content) : '')).join('\n'))
const systemOf = (body) => textOf(Array.isArray(body.system) ? body.system : body.system ?? '')
const lastUser = (body) => [...body.messages].reverse().find((message) => message.role === 'user')
const hasToolResult = (body, name) => body.messages.some((message) => message.role === 'assistant' && Array.isArray(message.content) && message.content.some((block) => block.type === 'tool_use' && block.name === name))
  && lastUser(body)?.content?.some?.((block) => block.type === 'tool_result')

const WORKFLOW_SCRIPT = `
phase('Scan')
const [a, b] = await parallel([
  () => agent('CHILD one: say hi', { label: 'child-one', phase: 'Scan' }),
  () => agent('CHILD two: report', { label: 'child-two', phase: 'Scan', schema: { type: 'object', properties: { verdict: { type: 'string' } }, required: ['verdict'], additionalProperties: false } }),
])
phase('Write')
const c = await agent('CHILD write: done', { label: 'child-write' })
return { a, b, c }
`

const SLOW_SCRIPT = `
phase('Wait')
const slow = await agent('CHILD slow: never answers', { label: 'slow' })
return { slow }
`

function reply(body) {
  const tools = (body.tools ?? []).map((tool) => tool.name)
  const user = textOf(lastUser(body)?.content)
  // A child's own prompt is its first user message (the parent's history only quotes it in the script).
  const firstUser = textOf(body.messages.find((message) => message.role === 'user')?.content)
  if (/^CHILD slow/.test(firstUser)) return { hang: true }
  for (const [marker, background] of [['RUN_SLOW_FOREGROUND', false], ['RUN_SLOW_BACKGROUND', true]]) {
    if (new RegExp(marker).test(user) && !hasToolResult(body, 'workflow'))
      return { tool: { name: 'workflow', input: { meta: { name: background ? 'slow-background' : 'slow-foreground', description: 'Waits forever' }, script: SLOW_SCRIPT, ...(background ? { run_in_background: true } : {}) } } }
  }
  // A workflow child (its prompt starts with CHILD).
  if (/^CHILD/.test(firstUser)) {
    if (tools.includes('structured_output') && !hasToolResult(body, 'structured_output')) return { tool: { name: 'structured_output', input: { verdict: 'fine' } } }
    return { text: 'child ok' }
  }
  if (tools.includes('structured_output') && !hasToolResult(body, 'structured_output')) return { tool: { name: 'structured_output', input: { answer: 'forty-two', count: 42 } } }
  const write = /WRITE_FILE (\S+)/.exec(user)
  if (write && !hasToolResult(body, 'write')) return { tool: { name: 'write', input: { file_path: write[1], content: 'written by an agent\n' } } }
  if (/RUN_WORKFLOW/.test(user) && !hasToolResult(body, 'workflow')) {
    return { tool: { name: 'workflow', input: { meta: { name: 'fake-audit', description: 'Fake audit workflow', phases: [{ title: 'Scan' }, { title: 'Write' }, { title: 'Unused' }] }, script: WORKFLOW_SCRIPT } } }
  }
  return { text: `plain reply to: ${user.slice(0, 40)}` }
}

function sse(res, events) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
  for (const [event, data] of events) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  res.end()
}

let messageCounter = 0
const server = http.createServer(async (req, res) => {
  let raw = ''
  for await (const chunk of req) raw += chunk
  if (req.method !== 'POST' || !req.url.endsWith('/v1/messages')) {
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: `${req.method} ${req.url}` } }))
    return
  }
  const body = JSON.parse(raw)
  requests.push(body)
  const answer = reply(body)
  // A child that never answers: held until the core aborts the request.
  if (answer.hang) {
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.write(`event: ping\ndata: {"type":"ping"}\n\n`)
    req.on('close', () => res.end())
    return
  }
  const id = `msg_${++messageCounter}`
  const usage = { input_tokens: 10, output_tokens: 5 }
  const start = ['message_start', { type: 'message_start', message: { id, type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null, usage } }]
  const events = [start]
  if (answer.tool) {
    events.push(['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: `toolu_${messageCounter}`, name: answer.tool.name, input: {} } }])
    events.push(['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(answer.tool.input) } }])
  } else {
    events.push(['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }])
    events.push(['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: answer.text } }])
  }
  events.push(['content_block_stop', { type: 'content_block_stop', index: 0 }])
  events.push(['message_delta', { type: 'message_delta', delta: { stop_reason: answer.tool ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 5 } }])
  events.push(['message_stop', { type: 'message_stop' }])
  if (body.stream === false) {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ id, type: 'message', role: 'assistant', model: body.model, content: [answer.tool ? { type: 'tool_use', id: `toolu_${messageCounter}`, name: answer.tool.name, input: answer.tool.input } : { type: 'text', text: answer.text }], stop_reason: answer.tool ? 'tool_use' : 'end_turn', stop_sequence: null, usage }))
    return
  }
  sse(res, events)
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const baseURL = `http://127.0.0.1:${server.address().port}`

// ------------------------------------------------------------------- client

process.env.DSH_HOME = path.join(home, 'dsh')
process.env.CODE_DESKTOP_CORE_STATE = path.join(home, 'state')
process.env.DEEPSEEK_BASE_URL = baseURL
process.env.DEEPSEEK_API_KEY = 'sk-fake-model-smoke'
const client = new CodexClient({ binary: path.join(root, 'bin/codex-app-server.mjs'), initializeTimeout: 60000 })
const events = []
let waiters = []
client.on('event', (event) => {
  events.push(event)
  if (event.kind === 'request') client.respond(event.id, { decision: 'accept' }, event.bridgeApproval)
  for (const waiter of waiters) waiter(event)
})
const waitFor = (predicate, ms = 60000) => {
  const seen = events.find(predicate)
  if (seen) return Promise.resolve(seen)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting\n${stderr.join('').slice(-3000)}`)), ms)
    const waiter = (event) => {
      if (!predicate(event)) return
      clearTimeout(timer)
      waiters = waiters.filter((candidate) => candidate !== waiter)
      resolve(event)
    }
    waiters.push(waiter)
  })
}
const turnDone = (threadId, from) => waitFor((event) => events.indexOf(event) >= from && event.method === 'turn/completed' && event.params?.threadId === threadId)
const checks = []
const check = (name, fn) => { fn(); checks.push(name); console.log('PASS', name) }

let exitCode = 0
try {
  const init = await client.start()
  check('capabilities advertise structured output and model workflows', () => {
    assert.equal(init.capabilities?.structuredOutput, true)
    assert.equal(init.capabilities?.modelWorkflows, true)
  })
  const models = await client.request('model/list', { limit: 100 })
  const model = models.data.find((entry) => entry.isDefault)?.id ?? models.data[0]?.id

  // 1. developerInstructions + outputSchema (the workflow runner's one-shot agent).
  const started = await client.request('thread/start', { cwd: workspace, model, approvalPolicy: 'never', sandbox: 'read-only', developerInstructions: 'DEV_INSTRUCTIONS_MARKER: answer tersely.' })
  const threadId = started.thread.id
  let from = events.length
  const schema = { type: 'object', properties: { answer: { type: 'string' }, count: { type: 'number' } }, required: ['answer', 'count'], additionalProperties: false }
  await client.request('turn/start', { threadId, input: [{ type: 'text', text: 'What is the answer?' }], outputSchema: schema })
  await turnDone(threadId, from)
  const structuredRequest = requests.findLast((body) => (body.tools ?? []).some((tool) => tool.name === 'structured_output'))
  check('developer instructions reach the system prompt', () => assert.match(systemOf(requests.at(0)), /DEV_INSTRUCTIONS_MARKER/))
  check('a thread nobody enabled workflows for has no workflow tool', () => {
    assert.ok(requests.every((body) => !(body.tools ?? []).some((tool) => tool.name === 'workflow')))
    assert.doesNotMatch(systemOf(requests.at(0)), /Use the workflow tool ONLY/)
  })
  check('outputSchema registers the structured_output tool with the schema', () => {
    assert.ok(structuredRequest, 'no request carried structured_output')
    assert.deepEqual(structuredRequest.tools.find((tool) => tool.name === 'structured_output').input_schema.required, ['answer', 'count'])
  })
  const answers = events.slice(from).filter((event) => event.method === 'item/completed' && event.params?.item?.type === 'agentMessage')
  check('the accepted capture is the turn answer as JSON text', () => {
    assert.deepEqual(JSON.parse(answers.at(-1).params.item.text), { answer: 'forty-two', count: 42 })
    assert.ok(!events.slice(from).some((event) => event.params?.item?.tool === 'structured_output'), 'capture shown as a tool row')
  })
  // Next turn without a schema: the capture is gone, the instructions stay.
  from = events.length
  const before = requests.length
  await client.request('turn/start', { threadId, input: [{ type: 'text', text: 'plain follow-up' }] })
  await turnDone(threadId, from)
  check('the capture applies to its turn only', () => {
    const next = requests.slice(before)
    assert.ok(next.length > 0)
    assert.ok(next.every((body) => !(body.tools ?? []).some((tool) => tool.name === 'structured_output')))
    assert.match(systemOf(next[0]), /DEV_INSTRUCTIONS_MARKER/)
  })
  const rejected = await client.request('turn/start', { threadId, input: [{ type: 'text', text: 'x' }], outputSchema: { type: 'array', items: { type: 'string' } } }).then(() => null, (error) => error)
  check('a non-object output schema fails with INVALID_PARAMS', () => assert.equal(rejected?.code, -32602))

  // The /workflow runner's agents (codexAgent.js buildThreadParams): approvalPolicy never and the
  // launch's sandbox on thread/start, nothing on turn/start; read-only, or workspace-write with --write.
  // Mode → access (app permission-policy.mjs workflowAccess): Plan/Ask read-only, Auto/Accept edits
  // workspace-write, Bypass danger-full-access (which also reaches outside the workspace).
  // Not under the temp dir: workspace-write also allows platform temporary areas.
  const outside = await fs.mkdtemp(path.join(os.homedir(), '.cd-fake-model-outside-'))
  cleanup.push(outside)
  for (const [sandbox, target, expected] of [['read-only', path.join(workspace, 'ro.txt'), false], ['workspace-write', path.join(workspace, 'rw.txt'), true],
    ['workspace-write', path.join(outside, 'ww-outside.txt'), false], ['danger-full-access', path.join(outside, 'bypass.txt'), true]]) {
    const agent = (await client.request('thread/start', { cwd: workspace, model, approvalPolicy: 'never', sandbox })).thread.id
    from = events.length
    await client.request('turn/start', { threadId: agent, input: [{ type: 'text', text: `WRITE_FILE ${target}` }] })
    await turnDone(agent, from)
    const exists = await fs.access(target).then(() => true, () => false)
    const where = target.startsWith(workspace) ? 'in' : 'outside'
    check(`a runner agent with ${sandbox} access ${expected ? 'writes' : 'cannot write'} ${where} the workspace without asking`, () => {
      assert.equal(exists, expected)
      assert.ok(!events.slice(from).some((event) => event.kind === 'request'), 'an approval was asked')
    })
  }

  // 2. The model's `workflow` tool → item.workflowRun.
  const wf = await client.request('thread/start', { cwd: workspace, model, approvalPolicy: 'never', sandbox: 'workspace-write', codeDesktop: { dynamicWorkflows: true } })
  const wfId = wf.thread.id
  from = events.length
  await client.request('turn/start', { threadId: wfId, input: [{ type: 'text', text: 'RUN_WORKFLOW please' }] })
  await turnDone(wfId, from)
  check('Dynamic workflows on: the model gets the workflow tool', () => {
    const body = requests.find((candidate) => /RUN_WORKFLOW/.test(JSON.stringify(candidate.messages)))
    assert.ok((body.tools ?? []).some((tool) => tool.name === 'workflow'))
    assert.match(systemOf(body), /Use the workflow tool ONLY/)
  })
  const runs = events.slice(from).filter((event) => event.params?.threadId === wfId && event.params?.item?.workflowRun).map((event) => event.params.item)
  const final = runs.at(-1)
  if (process.env.SMOKE_DEBUG) console.log(JSON.stringify(final, null, 1))
  check('the workflow call carries a run from its first notification', () => {
    assert.equal(runs[0].workflowRun.status, 'running')
    assert.equal(runs[0].workflowRun.name, 'fake-audit')
    assert.deepEqual(runs[0].workflowRun.workflowProgress.filter((entry) => entry.type === 'workflow_phase').map((entry) => entry.title), ['Scan', 'Write', 'Unused'])
  })
  check('the engine run id replaces the call id', () => assert.equal(final.workflowRun.id, final.workflowRun.runId))
  check('the run completes with three agents in their phases', () => {
    assert.equal(final.workflowRun.status, 'completed')
    const agents = final.workflowRun.workflowProgress.filter((entry) => entry.type === 'workflow_agent')
    // parallel() members may start in either order.
    assert.deepEqual(agents.map((agent) => [agent.label, agent.state, agent.phaseTitle]).sort(), [['child-one', 'done', 'Scan'], ['child-two', 'done', 'Scan'], ['child-write', 'done', 'Write']])
    assert.ok(agents.every((agent) => typeof agent.childId === 'string'))
  })
  check('child agent({schema}) got the structured capture', () => {
    assert.ok(requests.some((body) => /CHILD two/.test(JSON.stringify(body.messages)) && (body.tools ?? []).some((tool) => tool.name === 'structured_output')))
  })
  check('the tool result carries the script return value', () => {
    assert.equal(final.status, 'completed')
    const text = final.contentItems.map((part) => part.text).join('')
    assert.match(text, /fake-audit/)
    assert.match(text, /"verdict": "fine"/)
  })
  // Replay: thread/read rebuilds the same run from the durable records.
  const read = await client.request('thread/read', { threadId: wfId, includeTurns: true })
  const replayed = read.thread.turns.flatMap((turn) => turn.items).find((item) => item.workflowRun)
  check('history replays the run from durable records', () => {
    assert.equal(replayed.workflowRun.status, 'completed')
    assert.equal(replayed.workflowRun.id, final.workflowRun.id)
    assert.equal(replayed.workflowRun.workflowProgress.filter((entry) => entry.type === 'workflow_agent').length, 3)
  })
  const stop = await client.request('codeDesktop/workflow/stop', { threadId: wfId, runId: final.workflowRun.id })
  check('stopping a finished run is a no-op', () => assert.equal(stop.status, 'alreadyFinished'))

  // The setting turned off for a live thread: the next turn has no workflow tool.
  await client.request('codeDesktop/thread/permissions', { threadId: wfId, codeDesktop: { dynamicWorkflows: false } })
  from = events.length
  const offFrom = requests.length
  await client.request('turn/start', { threadId: wfId, input: [{ type: 'text', text: 'after the setting went off' }] })
  await turnDone(wfId, from)
  check('Dynamic workflows off: the tool is hidden again', () => {
    assert.ok(requests.slice(offFrom).length > 0)
    assert.ok(requests.slice(offFrom).every((body) => !(body.tools ?? []).some((tool) => tool.name === 'workflow')))
  })

  // 3. Stop: a foreground run stops its turn; a background run is its job.
  const runningAgent = (threadId, name, start) => waitFor((event) => events.indexOf(event) >= start && event.params?.threadId === threadId
    && event.params?.item?.workflowRun?.name === name && event.params.item.workflowRun.workflowProgress.some((entry) => entry.type === 'workflow_agent' && entry.state === 'progress'))
  const fg = (await client.request('thread/start', { cwd: workspace, model, approvalPolicy: 'never', sandbox: 'workspace-write', codeDesktop: { dynamicWorkflows: true } })).thread.id
  from = events.length
  await client.request('turn/start', { threadId: fg, input: [{ type: 'text', text: 'RUN_SLOW_FOREGROUND' }] })
  const live = (await runningAgent(fg, 'slow-foreground', from)).params.item.workflowRun
  check('a running run takes its engine id before its agents report', () => assert.equal(live.id, live.runId))
  const fgStop = await client.request('codeDesktop/workflow/stop', { threadId: fg, runId: live.id })
  const fgTurn = await turnDone(fg, from)
  const fgRun = events.slice(from).filter((event) => event.params?.threadId === fg && event.params?.item?.workflowRun).at(-1).params.item.workflowRun
  check('stopping a foreground run interrupts its turn and settles it stopped', () => {
    assert.equal(fgStop.status, 'stopping')
    assert.equal(fgTurn.params.turn.status, 'interrupted')
    assert.equal(fgRun.status, 'stopped')
    assert.ok(fgRun.workflowProgress.filter((entry) => entry.type === 'workflow_agent').every((agent) => agent.state !== 'progress'))
  })

  const bg = (await client.request('thread/start', { cwd: workspace, model, approvalPolicy: 'never', sandbox: 'workspace-write', codeDesktop: { dynamicWorkflows: true } })).thread.id
  from = events.length
  await client.request('turn/start', { threadId: bg, input: [{ type: 'text', text: 'RUN_SLOW_BACKGROUND' }] })
  await turnDone(bg, from)
  const bgLive = (await runningAgent(bg, 'slow-background', from)).params.item.workflowRun
  const bgItem = events.slice(from).filter((event) => event.params?.threadId === bg && event.params?.item?.workflowRun).at(-1).params.item
  check('a background run keeps running after its tool call returns', () => {
    assert.equal(bgItem.status, 'completed')
    assert.equal(bgItem.workflowRun.background, true)
    assert.equal(typeof bgItem.workflowRun.jobId, 'string')
    assert.equal(bgLive.status, 'running')
  })
  const bgFrom = events.length
  const bgStop = await client.request('codeDesktop/workflow/stop', { threadId: bg, runId: bgLive.id })
  const bgEnd = await waitFor((event) => events.indexOf(event) >= bgFrom && event.params?.threadId === bg && event.params?.item?.workflowRun?.status && event.params.item.workflowRun.status !== 'running')
  check('stopping a background run kills its job', () => {
    assert.equal(bgStop.status, 'stopping')
    assert.equal(bgEnd.params.item.workflowRun.status, 'stopped')
  })
  // 4. Plugins: a local bundle installed, disabled and removed through dsh-plugin-manager.
  check('the core runs its profile from the Harness home and can manage plugins', () => {
    assert.equal(init.capabilities?.pluginManage, true)
    assert.equal(init.configPath, path.join(process.env.DSH_HOME, 'code-desktop', 'profile', 'cordis.patch.yml'))
  })
  const plugin = path.join(home, 'cd-smoke-plugin')
  await fs.mkdir(plugin, { recursive: true })
  await fs.writeFile(path.join(plugin, 'package.json'), JSON.stringify({ name: 'cd-smoke-plugin', version: '1.2.3', description: 'Smoke test plugin', dsh: { bundle: { patch: './cordis.patch.yml' } } }, null, 2))
  await fs.writeFile(path.join(plugin, 'cordis.patch.yml'), '[]\n')
  const notPlugin = path.join(home, 'not-a-plugin')
  await fs.mkdir(notPlugin, { recursive: true })
  await fs.writeFile(path.join(notPlugin, 'package.json'), JSON.stringify({ name: 'plain-package', version: '1.0.0' }))
  const inspected = await client.request('codeDesktop/plugin/inspect', { spec: plugin })
  const refused = await client.request('codeDesktop/plugin/inspect', { spec: notPlugin })
  check('inspect reads a spec before anything installs', () => {
    assert.equal(inspected.status, 'accepted')
    assert.equal(inspected.name, 'cd-smoke-plugin')
    assert.equal(inspected.bundle, true)
    assert.equal(refused.status, 'refused')
    assert.equal(refused.problem, 'not-a-bundle')
  })
  from = events.length
  const installed = await client.request('codeDesktop/plugin/install', { spec: plugin, requestId: 'smoke-install' }, 300000)
  const listed = await client.request('plugin/installed', {})
  const row = listed.marketplaces[0].plugins.find((candidate) => candidate.id === 'cd-smoke-plugin')
  check('install adds and enables the bundle, reporting progress and output', () => {
    assert.equal(installed.changed, true, JSON.stringify(installed).slice(0, 800))
    assert.equal(installed.requestId, 'smoke-install')
    assert.ok(['applied', 'restart-required'].includes(installed.application))
    assert.ok(events.slice(from).some((event) => event.method === 'codeDesktop/plugin/installProgress' && event.params.requestId === 'smoke-install' && event.params.phase === 'installing'))
    assert.ok(events.slice(from).some((event) => event.method === 'codeDesktop/plugin/installLog' && event.params.requestId === 'smoke-install'))
    assert.ok(events.slice(from).some((event) => event.method === 'codeDesktop/plugin/changed'))
    assert.ok(row, 'not listed')
    assert.equal(row.enabled, true)
    assert.equal(row.codeDesktop.removable, true)
  })
  const profileManifest = JSON.parse(await fs.readFile(path.join(process.env.DSH_HOME, 'code-desktop', 'profile', 'package.json'), 'utf8'))
  check('the plugin lives in the user profile, not in this checkout', () => {
    assert.ok(profileManifest.dsh.profile.bundles.includes('cd-smoke-plugin'))
    assert.ok(profileManifest.dsh.profile.bundles.includes('@code-desktop/dsh-code-desktop-app'))
  })
  const checkout = JSON.parse(await fs.readFile(path.join(root, 'profile', 'package.json'), 'utf8'))
  check('the checkout template is untouched', () => assert.ok(!JSON.stringify(checkout).includes('cd-smoke-plugin')))
  const disabled = await client.request('codeDesktop/plugin/setEnabled', { pluginName: 'cd-smoke-plugin', enabled: false })
  const afterDisable = (await client.request('plugin/installed', {})).marketplaces[0].plugins.find((candidate) => candidate.id === 'cd-smoke-plugin')
  check('a plugin can be turned off', () => {
    assert.equal(disabled.changed, true)
    assert.equal(afterDisable.enabled, false)
  })
  const core = (await client.request('plugin/installed', {})).marketplaces[0].plugins.find((candidate) => candidate.id === '@code-desktop/dsh-code-desktop-app')
  const protectedRemove = await client.request('codeDesktop/plugin/remove', { pluginName: '@code-desktop/dsh-code-desktop-app' }, 120000).then((result) => result, (error) => ({ thrown: error.message }))
  check('the core\'s own bundle cannot be removed', () => {
    assert.equal(core.codeDesktop.removable, false)
    assert.ok(protectedRemove.thrown || protectedRemove.changed === false, JSON.stringify(protectedRemove).slice(0, 400))
  })
  const removed = await client.request('codeDesktop/plugin/remove', { pluginName: 'cd-smoke-plugin' }, 300000)
  const afterRemove = (await client.request('plugin/installed', {})).marketplaces[0].plugins.find((candidate) => candidate.id === 'cd-smoke-plugin')
  check('remove uninstalls it', () => {
    assert.equal(removed.changed, true, JSON.stringify(removed).slice(0, 800))
    assert.equal(afterRemove, undefined)
  })
  const badSpec = await client.request('codeDesktop/plugin/install', { spec: '--registry=evil' }).then(() => null, (error) => error)
  check('an option-looking spec is refused before pnpm runs', () => assert.equal(badSpec?.code, -32602))

  console.log(`\n${checks.length} checks passed`)
} catch (error) {
  exitCode = 1
  console.error('FAIL', error?.stack ?? error)
  console.error(stderr.join('').slice(-4000))
} finally {
  try { client.stop() } catch {}
  server.close()
  await fs.rm(home, { recursive: true, force: true }).catch(() => {})
  for (const dir of cleanup) await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  process.exit(exitCode)
}
