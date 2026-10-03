import test from 'node:test'
import assert from 'node:assert/strict'
import { ThreadProjector } from '../packages/codex-app-server/src/projection.js'
import { workflowRunOf, workflowRecord, workflowToolResult, workflowInterrupted } from '../packages/codex-app-server/src/workflows.js'
import { workflowsAllowedBy } from '../packages/codex-app-server/src/structured.js'

let seq = 0
const ev = (type, data) => ({ type, data, seq: ++seq, time: 2_000_000 + seq * 10 })
const meta = { name: 'audit', description: 'Audit files', phases: [{ title: 'Scan' }, { title: 'Fix' }] }

function startWorkflow(p, callId = 'w1', args = { meta, script: 'return 1' }) {
  p.apply(ev('turn/start', { turn: 1 }))
  p.apply(ev('user/message', { id: 'u1', content: [{ type: 'text', text: 'go' }], source: { kind: 'user' } }))
  return p.apply(ev('tool/call', { turn: 1, step: 1, callId, name: 'workflow', arguments: JSON.stringify(args) }))
}
const runOf = (p, callId = 'w1') => p.turns[0].items.find((item) => item.id === callId).workflowRun
const agents = (run) => run.workflowProgress.filter((entry) => entry.type === 'workflow_agent')

test('a workflow call is a dynamic tool item with its running run and declared phases', () => {
  const p = new ThreadProjector({ threadId: 't' })
  const notes = startWorkflow(p)
  const item = notes.find((note) => note.method === 'item/started').params.item
  assert.equal(item.type, 'dynamicToolCall')
  assert.equal(item.tool, 'workflow')
  assert.equal(item.workflowRun.id, 'call-w1')
  assert.equal(item.workflowRun.source, 'model')
  assert.equal(item.workflowRun.status, 'running')
  assert.equal(item.workflowRun.name, 'audit')
  assert.equal(item.workflowRun.description, 'Audit files')
  assert.deepEqual(item.workflowRun.workflowProgress, [{ type: 'workflow_phase', index: 0, title: 'Scan' }, { type: 'workflow_phase', index: 1, title: 'Fix' }])
})

test('records name the run, add agents in their phases and settle it', () => {
  const p = new ThreadProjector({ threadId: 't' })
  startWorkflow(p)
  let notes = p.apply(ev('tool-workflow/run-start', { runId: 'r1', name: 'audit' }))
  assert.equal(notes[0].method, 'item/started')
  assert.equal(notes[0].params.startedAtMs, undefined, 'an update carries no lifecycle time')
  assert.equal(runOf(p).id, 'r1')
  assert.ok(p.hasWorkflowRun('r1'))
  // A live phase() call, then an agent without its own phase joins it.
  notes = p.workflowPhase('r1', 'Report', 2_000_500)
  assert.equal(notes.length, 1)
  p.apply(ev('tool-workflow/agent-start', { runId: 'r1', seq: 1, label: 'scan a', phase: 'Scan', childId: 'c1' }))
  p.apply(ev('tool-workflow/agent-start', { runId: 'r1', seq: 2, label: 'report', childId: 'c2' }))
  p.apply(ev('tool-workflow/agent-end', { runId: 'r1', seq: 1, outcome: 'completed' }))
  p.apply(ev('tool-workflow/agent-end', { runId: 'r1', seq: 2, outcome: 'failed' }))
  const run = runOf(p)
  assert.deepEqual(agents(run).map((agent) => [agent.label, agent.state, agent.phaseTitle, agent.childId]), [['scan a', 'done', 'Scan', 'c1'], ['report', 'error', 'Report', 'c2']])
  assert.equal(agents(run)[1].error, 'Agent failed')
  assert.ok(Number.isFinite(agents(run)[0].durationMs))
  notes = p.apply(ev('tool-workflow/run-end', { runId: 'r1', stopReason: 'completed' }))
  assert.equal(runOf(p).status, 'completed')
  assert.ok(Number.isFinite(runOf(p).durationMs))
  // The tool result completes the item; the run stays completed.
  notes = p.apply(ev('tool/result', { message: { toolCallId: 'w1', content: [{ type: 'text', text: 'workflow "audit" completed (2 agents).' }], isError: false } }))
  const done = notes.find((note) => note.method === 'item/completed').params.item
  assert.equal(done.status, 'completed')
  assert.equal(done.workflowRun.status, 'completed')
})

test('history replays the same run without live phase events', () => {
  const p = new ThreadProjector({ threadId: 't' })
  startWorkflow(p)
  p.apply(ev('tool-workflow/run-start', { runId: 'r2', name: 'audit' }))
  p.apply(ev('tool-workflow/agent-start', { runId: 'r2', seq: 1, label: 'a', phase: 'Fix', childId: 'c' }))
  p.apply(ev('tool-workflow/agent-end', { runId: 'r2', seq: 1, outcome: 'cancelled' }))
  p.apply(ev('tool-workflow/run-end', { runId: 'r2', stopReason: 'cancelled' }))
  const run = runOf(p)
  assert.equal(run.status, 'stopped')
  assert.equal(agents(run)[0].phaseTitle, 'Fix')
  assert.equal(agents(run)[0].error, 'Agent cancelled')
})

test('a stopped turn stops a foreground run and its running agents', () => {
  const p = new ThreadProjector({ threadId: 't' })
  startWorkflow(p)
  p.apply(ev('tool-workflow/run-start', { runId: 'r3', name: 'audit' }))
  p.apply(ev('tool-workflow/agent-start', { runId: 'r3', seq: 1, label: 'a', childId: 'c' }))
  p.apply(ev('turn/end', { turn: 1, reason: { kind: 'aborted', reason: { kind: 'user' } } }))
  const run = runOf(p)
  assert.equal(run.status, 'stopped')
  assert.equal(agents(run)[0].state, 'error')
  assert.equal(agents(run)[0].error, 'Stopped before completion')
})

test('a background run keeps running past its tool call and names its job', () => {
  const p = new ThreadProjector({ threadId: 't' })
  startWorkflow(p, 'w1', { meta, script: 'x', run_in_background: true })
  p.apply(ev('tool-workflow/run-start', { runId: 'r4', name: 'audit' }))
  p.apply(ev('tool/result', { message: { toolCallId: 'w1', content: [{ type: 'text', text: 'workflow "audit" started in the background as job workflow-7. Its return value arrives with the completion notice; check on it with job_output, stop it with job_kill.' }], isError: false } }))
  p.apply(ev('turn/end', { turn: 1, reason: { kind: 'completed' } }))
  assert.equal(runOf(p).status, 'running')
  assert.equal(runOf(p).jobId, 'workflow-7')
  // Its records keep arriving after the turn.
  const notes = p.apply(ev('tool-workflow/run-end', { runId: 'r4', stopReason: 'completed' }))
  assert.equal(notes[0].method, 'item/completed')
  assert.equal(runOf(p).status, 'completed')
})

test('a workflow that cannot start fails with the tool error', () => {
  const p = new ThreadProjector({ threadId: 't' })
  startWorkflow(p)
  p.apply(ev('tool/result', { message: { toolCallId: 'w1', content: [{ type: 'text', text: 'Error: workflow run failed: SyntaxError: Unexpected token' }], isError: true } }))
  assert.equal(runOf(p).status, 'failed')
  assert.equal(runOf(p).summary, 'workflow run failed: SyntaxError: Unexpected token')
})

test('run-start pairs with the waiting call of the same name', () => {
  const p = new ThreadProjector({ threadId: 't' })
  startWorkflow(p, 'w1', { meta: { name: 'first', description: 'd' }, script: 'x' })
  p.apply(ev('tool/call', { turn: 1, step: 1, callId: 'w2', name: 'workflow', arguments: JSON.stringify({ meta: { name: 'second', description: 'd' }, script: 'x' }) }))
  p.apply(ev('tool-workflow/run-start', { runId: 'r-second', name: 'second' }))
  assert.equal(runOf(p, 'w2').id, 'r-second')
  assert.equal(runOf(p, 'w1').id, 'call-w1')
  // Unknown runs are ignored.
  assert.deepEqual(p.workflowPhase('nope', 'x'), [])
})

test('the structured_output capture is the turn answer, never a tool row', () => {
  const p = new ThreadProjector({ threadId: 't' })
  p.apply(ev('turn/start', { turn: 1 }))
  p.apply(ev('user/message', { id: 'u1', content: [{ type: 'text', text: 'q' }], source: { kind: 'user' } }))
  const call = p.apply(ev('tool/call', { turn: 1, step: 1, callId: 's1', name: 'structured_output', arguments: JSON.stringify({ answer: 'x', n: 1 }) }))
  assert.deepEqual(call, [])
  // A rejected capture (schema violation) shows nothing; the model tries again.
  assert.deepEqual(p.apply(ev('tool/result', { message: { toolCallId: 's1', content: [{ type: 'text', text: 'bad' }], isError: true } })), [])
  p.apply(ev('tool/call', { turn: 1, step: 2, callId: 's2', name: 'structured_output', arguments: JSON.stringify({ answer: 'y', n: 2 }) }))
  const notes = p.apply(ev('tool/result', { message: { toolCallId: 's2', content: [{ type: 'text', text: 'Structured output recorded.' }], isError: false } }))
  const message = notes.find((note) => note.method === 'item/completed').params.item
  assert.equal(message.type, 'agentMessage')
  assert.deepEqual(JSON.parse(message.text), { answer: 'y', n: 2 })
  assert.ok(!p.turns[0].items.some((item) => item.type === 'dynamicToolCall'))
})

test('reducers are pure and settle only running runs', () => {
  const run = workflowRunOf({ meta }, 'c', 1)
  const named = workflowRecord(run, 'tool-workflow/run-start', { runId: 'r', name: 'audit' }, 2)
  assert.equal(run.id, 'call-c')
  assert.equal(named.id, 'r')
  const done = workflowRecord(named, 'tool-workflow/run-end', { stopReason: 'error' }, 3)
  assert.equal(done.status, 'failed')
  assert.equal(workflowInterrupted(done, 4), done)
  assert.equal(workflowToolResult(named, { isError: false, text: 'workflow "audit" completed (0 agents).' }, 4), named)
})

test('the Dynamic workflows hint is read only when the request carries it', () => {
  assert.equal(workflowsAllowedBy({ codeDesktop: { dynamicWorkflows: true } }), true)
  assert.equal(workflowsAllowedBy({ codeDesktop: { dynamicWorkflows: false } }), false)
  assert.equal(workflowsAllowedBy({ codeDesktop: { permissionMode: 'default' } }), null)
  assert.equal(workflowsAllowedBy({}), null)
})
