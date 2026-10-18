import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { setImmediate } from 'node:timers/promises';
import { guestWorkdir } from '../electron/cowork-runtime/session-paths.mjs';
import { CoworkSessions } from '../electron/cowork-runtime/session-service.mjs';

async function fixture(t, extra = {}) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cowork-session-'));
  t.after(() => fs.rm(dataDir, { recursive: true, force: true }));
  const host = new EventEmitter(), calls = [], events = [];
  host.request = async (method, params) => { calls.push({ method, params }); return {}; };
  host.stop = async () => {};
  const settings = { dataDir, host, provider: async model => ({ model: model || 'test', env: { ANTHROPIC_API_KEY: 'fixture-secret' } }),
    approveFolder: async cwd => { if (cwd !== dataDir) throw new Error('Unknown folder.'); return cwd; },
    approval: async () => ({ decision: 'decline' }), emit: event => events.push(event), ...extra };
  const service = new CoworkSessions(settings);
  const started = await service.request('thread/start', { cwd: dataDir, model: 'test' });
  const id = started.thread.id;
  const turn = () => service.request('turn/start', { threadId: id, input: [{ type: 'text', text: 'Do work' }] });
  const message = record => host.emit('event', { event: 'message', sessionId: id, record });
  return { service, settings, dataDir, host, calls, events, id, turn, message };
}

test('Cowork starts lazily, persists ownership and never writes provider credentials to session records', async t => {
  const f = await fixture(t);
  assert.equal(f.calls.length, 0);
  const result = await f.turn(); await setImmediate();
  assert.equal(result.turn.status, 'inProgress');
  assert.equal(f.calls[0].method, 'open'); assert.equal(f.calls[0].params.resume, false);
  assert.equal(f.calls[1].method, 'send');
  const stored = await fs.readFile(f.service.file(f.id), 'utf8');
  assert.equal(stored.includes('fixture-secret'), false); assert.equal(JSON.parse(stored).engine, 'cowork-vm');
  f.message({ type: 'system', subtype: 'init', session_id: f.calls[0].params.sdkSessionId });
  f.message({ type: 'result', subtype: 'success', is_error: false, result: 'Done' });
  assert.equal(f.events.at(-1).method, 'turn/completed');
  assert.equal(f.events.at(-1).params.turn.status, 'completed');
  await f.turn(); await setImmediate();
  assert.equal(f.calls.filter(call => call.method === 'open').at(-1).params.resume, true);
  await f.service.stop();
});

test('streamed and final text reconcile into one item and guest deliverable links map to the host folder', async t => {
  const f = await fixture(t); await f.turn(); await setImmediate();
  f.message({ type: 'stream_event', event: { type: 'message_start', message: { id: 'm' } } });
  f.message({ type: 'stream_event', event: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } } });
  f.message({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '你好' } } });
  f.message({ type: 'assistant', message: { id: 'm', content: [{ type: 'text', text: `你好 [report](${guestWorkdir(f.id)}/outputs/report.md)` }] } });
  f.message({ type: 'result', subtype: 'success', is_error: false, result: 'duplicate final' });
  const { thread } = await f.service.request('thread/read', { threadId: f.id });
  const replies = thread.turns[0].items.filter(item => item.type === 'agentMessage');
  assert.equal(replies.length, 1); assert.equal(replies[0].phase, 'final_answer');
  assert.ok(replies[0].text.includes(`${f.dataDir}/outputs/report.md`));
  assert.equal(f.events.filter(event => event.method === 'item/agentMessage/delta').length, 1);
});

test('tool inputs, approvals and results reach the existing app protocol', async t => {
  const approvals = [];
  const f = await fixture(t, { approval: async (...args) => { approvals.push(args); return { decision: 'accept' }; } });
  await f.turn(); await setImmediate();
  f.message({ type: 'assistant', message: { id: 'm', content: [{ type: 'tool_use', id: 't', name: 'Write', input: { file_path: 'report.md' } }] } });
  f.host.emit('event', { event: 'approval', sessionId: f.id, id: `${f.id}:p`, request: { tool_name: 'Write', tool_use_id: 't', input: { file_path: 'report.md' } } });
  await setImmediate();
  assert.equal(approvals[0][0], 'item/commandExecution/requestApproval');
  assert.equal(f.calls.at(-1).params.response.behavior, 'allow');
  f.message({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't', content: 'saved' }] } });
  const tool = f.events.findLast(event => event.method === 'item/completed').params.item;
  assert.equal(tool.success, true); assert.equal(tool.contentItems[0].text, 'saved');
  f.message({ type: 'result', subtype: 'success', is_error: false });
});

test('stop targets the exact turn, revokes pending approval, and late prior-turn events cannot finish a new turn', async t => {
  let approvalSignal;
  const f = await fixture(t, { approval: async (_method, _params, { signal }) => { approvalSignal = signal; return new Promise(resolve => signal.addEventListener('abort', () => resolve(null), { once: true })); } });
  const first = await f.turn(); await setImmediate();
  f.host.emit('event', { event: 'approval', sessionId: f.id, id: `${f.id}:p`, request: { tool_name: 'Write', tool_use_id: 't', input: {} } });
  await assert.rejects(f.service.request('turn/interrupt', { threadId: f.id, turnId: 'old' }), /changed/);
  await f.service.request('turn/interrupt', { threadId: f.id, turnId: first.turn.id });
  assert.equal(approvalSignal.aborted, true);
  const second = await f.turn(); await setImmediate();
  f.host.emit('event', { event: 'message', sessionId: f.id, turnId: first.turn.id, record: { type: 'result', subtype: 'success' } });
  assert.equal(f.service.live.get(f.id).turn.id, second.turn.id);
  await f.service.stop();
});

test('interrupted process state recovers from disk without booting and never resumes under a different SDK identity', async t => {
  const f = await fixture(t); await f.turn(); await setImmediate();
  const reopened = new CoworkSessions({ ...f.settings, host: new EventEmitter() });
  const restored = await reopened.request('thread/resume', { threadId: f.id });
  assert.equal(restored.thread.turns[0].status, 'interrupted');
  f.message({ type: 'system', subtype: 'init', session_id: 'foreign-session' });
  assert.equal(f.service.live.has(f.id), false);
  assert.match(f.events.at(-1).params.turn.error.message, /identity/);
});

test('task failure, duplicate sends and unsupported attachments are explicit', async t => {
  const f = await fixture(t); await f.turn(); await setImmediate();
  await assert.rejects(f.turn(), /already running/);
  await assert.rejects(f.service.request('thread/delete', { threadId: f.id }), /Stop/);
  f.message({ type: 'result', subtype: 'error_during_execution', is_error: true, errors: ['failed to write'] });
  assert.equal(f.events.at(-1).params.turn.status, 'failed');
  await assert.rejects(f.service.request('turn/start', { threadId: f.id, input: [{ type: 'localImage', path: '/other/image.png' }] }), /selected folder/);
  await f.service.request('thread/archive', { threadId: f.id });
  await f.service.request('thread/unarchive', { threadId: f.id });
  await f.service.request('thread/delete', { threadId: f.id });
  await assert.rejects(f.service.request('thread/read', { threadId: f.id }), /could not be read/);
});

test('Cowork questions, plan steps and actual output files populate the existing UI contracts', async t => {
  const f = await fixture(t, { approval: async (method, params) => {
    assert.equal(method, 'item/tool/requestUserInput'); assert.equal(params.questions[0].question, 'Which format?');
    return { answers: { '0': { answers: ['Markdown'] } } };
  } });
  await f.turn(); await setImmediate();
  f.host.emit('event', { event: 'approval', sessionId: f.id, id: `${f.id}:q`, request: { tool_name: 'AskUserQuestion', tool_use_id: 'question',
    input: { questions: [{ question: 'Which format?', header: 'Format', options: [{ label: 'Markdown', description: 'Text document' }] }] } } });
  await setImmediate(); assert.deepEqual(f.calls.at(-1).params.response.updatedInput.answers, { 'Which format?': 'Markdown' });
  f.message({ type: 'assistant', message: { id: 'm', content: [{ type: 'tool_use', id: 'plan', name: 'TodoWrite', input: { todos: [{ content: 'Write report', status: 'in_progress' }] } }] } });
  assert.deepEqual(f.events.findLast(event => event.method === 'turn/plan/updated').params.plan, [{ step: 'Write report', status: 'inProgress' }]);
  await fs.mkdir(path.join(f.dataDir, 'outputs')); await fs.writeFile(path.join(f.dataDir, 'outputs/report.md'), 'Report');
  f.message({ type: 'result', subtype: 'success', is_error: false });
  const item = f.events.find(event => event.method === 'item/completed' && event.params.item.tool === 'present').params.item;
  assert.equal(item.codeDesktop.deliverables[0].path, path.join(f.dataDir, 'outputs/report.md'));
  const restored = await f.service.request('thread/read', { threadId: f.id }); assert.equal(restored.thread.historyMode, 'legacy');
});
