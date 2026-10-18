import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createLocalRoutines } from '../electron/local-routines.mjs';
import { createRoutineRunner, captureRoutineOptions } from '../electron/routine-runner.mjs';

async function fixture(t, launch = async () => {}) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'local-routines-'));
  let state = [], clock = new Date(2026, 9, 11, 9, 0).getTime();
  const options = { coreId: 'fixture', model: 'fixture-model', effort: 'low', permission: 'ask', networkAccess: false };
  const service = createLocalRoutines({ getState: () => state, commit: value => { state = structuredClone(value); },
    dataDir, approveFolder: value => { if (value !== dataDir) throw new Error('Unapproved folder'); return value; },
    captureOptions: async (execution, previous) => captureRoutineOptions({ config: options, coreId: 'fixture',
      models: [{ model: 'fixture-model' }, { model: 'alternate', defaultReasoningEffort: 'medium' }], execution, previous }),
    launch, now: () => clock, setTimer: () => 1, clearTimer: () => {} });
  t.after(async () => { service.dispose(); await fs.rm(dataDir, { recursive: true, force: true }); });
  return { service, dataDir, options, setTime: value => { clock = value; }, now: () => clock,
    state: () => structuredClone(state), restore: value => { state = structuredClone(value); },
    create: patch => service.request({ action: 'create', name: 'Morning brief', prompt: 'Summarize the notes.', cron: '* * * * *', ...patch }) };
}

test('durable schedules validate input and approved folders, preserve runs on edits and pause deadlines', async t => {
  const f = await fixture(t); f.service.start();
  await assert.rejects(f.create({ cron: '61 * * * *' }), /minute/);
  await assert.rejects(f.create({ folder: '/' }), /Unapproved/);
  await assert.rejects(f.create({ cron: '', fireAt: f.now() - 1 }), /future/);
  const task = await f.create();
  assert.ok((await fs.stat(task.cwd)).isDirectory());
  assert.equal(task.nextRunAt, f.now() + 60000);
  assert.deepEqual(task.options, f.options);
  const edited = await f.service.request({ action: 'update', id: task.id, name: 'Updated before first run', prompt: task.prompt, cron: task.cron, folder: task.cwd });
  assert.equal(edited.cwd, task.cwd);
  assert.equal(edited.runs.length, 0);
  await f.service.request({ action: 'toggle', id: task.id, enabled: false });
  assert.equal(f.state()[0].nextRunAt, null);
  f.setTime(f.now() + 120000); await f.service.tick();
  assert.equal(f.state()[0].runs.length, 0);
  await f.service.request({ action: 'toggle', id: task.id, enabled: true });
  assert.equal(f.state()[0].nextRunAt, f.now() + 60000);
  await f.service.request({ action: 'delete', id: task.id });
  await assert.rejects(f.service.request({ action: 'run', id: task.id }), /not found/);
});

test('a scheduled launch reserves its occurrence, skips overlapping work and captures an early completion', async t => {
  let release, count = 0;
  const f = await fixture(t, async (task, { attach }) => {
    count++; attach('task-thread');
    if (count === 1) await new Promise(resolve => { release = resolve; });
    f.service.observe({ method: 'turn/completed', params: { threadId: 'task-thread', turn: { id: 'turn', status: 'completed' } } });
    return { turnId: 'turn' };
  });
  f.service.start(); const task = await f.create();
  f.setTime(task.nextRunAt); const pending = f.service.tick();
  assert.equal(f.state()[0].runs[0].status, 'running');
  await assert.rejects(f.service.request({ action: 'run', id: task.id }), /already running/);
  f.setTime(f.now() + 60000); await f.service.tick();
  assert.equal(count, 1); assert.equal(f.state()[0].skippedAt, f.now());
  release(); await pending;
  assert.equal(f.state()[0].runs[0].status, 'completed');
  assert.equal(f.state()[0].runs[0].turnId, 'turn');
});

test('restart skips missed dates, marks unconfirmed work interrupted and keeps history', async t => {
  const f = await fixture(t); const at = f.now();
  const daily = await f.create(); const once = await f.create({ cron: '', fireAt: at + 60000 });
  await f.service.request({ action: 'run', id: daily.id });
  const persisted = f.state();
  f.setTime(at + 3600000); f.restore(persisted); f.service.start();
  assert.equal(f.state()[0].runs[0].status, 'interrupted');
  assert.equal(f.state()[0].nextRunAt, f.now() + 60000);
  assert.equal(f.state().find(task => task.id === once.id).enabled, false);
  assert.equal(f.state().find(task => task.id === once.id).nextRunAt, null);
});

test('form settings persist, validate model and permission, and preserve completed one-shot schedules on edits', async t => {
  const f = await fixture(t);
  const task = await f.create({ description: ' Daily notes ', execution: { model: 'alternate', permission: 'plan' } });
  assert.equal(task.description, 'Daily notes');
  assert.deepEqual(task.options, { ...f.options, model: 'alternate', permission: 'plan', effort: 'medium' });
  await assert.rejects(f.create({ execution: { model: 'missing' } }), /available model/);
  await assert.rejects(f.create({ execution: { permission: 'unknown' } }), /permission mode/);
  await assert.rejects(f.create({ description: 'a'.repeat(2001) }), /Description/);
  const updated = await f.service.request({ action: 'update', id: task.id, name: task.name, prompt: task.prompt,
    cron: task.cron, execution: { model: 'fixture-model', permission: 'acceptEdits' } });
  assert.equal(updated.options.model, 'fixture-model');
  assert.equal(updated.options.permission, 'acceptEdits');
  assert.equal(updated.description, 'Daily notes');
  const once = await f.create({ cron: '', fireAt: f.now() + 1000 });
  f.setTime(f.now() + 2000); f.service.start();
  const renamed = await f.service.request({ action: 'update', id: once.id, name: 'Past one-shot', prompt: once.prompt, fireAt: once.fireAt });
  assert.equal(renamed.fireAt, once.fireAt);
  assert.equal(renamed.enabled, false);
  assert.equal(renamed.nextRunAt, null);
  await assert.rejects(f.service.request({ action: 'update', id: once.id, name: once.name, prompt: once.prompt, fireAt: once.fireAt, enabled: true }), /future time/);
  assert.throws(() => captureRoutineOptions({ config: f.options, coreId: 'other', models: [], previous: task.options, execution: { model: 'alternate' } }), /Switch to fixture/);
});

test('one-shot failures are visible and cannot loop', async t => {
  const f = await fixture(t, async () => { throw new Error('Model unavailable'); });
  f.service.start(); const task = await f.create({ cron: '', fireAt: f.now() + 60000 });
  f.setTime(task.nextRunAt); await f.service.tick(); await f.service.tick();
  assert.equal(f.state()[0].runs.length, 1);
  assert.equal(f.state()[0].runs[0].status, 'failed');
  assert.equal(f.state()[0].runs[0].error, 'Model unavailable');
  assert.equal(f.state()[0].enabled, false);
  assert.equal(f.state()[0].nextRunAt, null);
});

test('editing during a run keeps its live journal; disconnect aborts further launch steps', async t => {
  let resume, continued = false;
  const f = await fixture(t, async (task, { attach, assertActive }) => {
    attach('thread');
    await new Promise(resolve => { resume = resolve; });
    assertActive(); continued = true;
  });
  f.service.start(); const task = await f.create();
  const run = f.service.request({ action: 'run', id: task.id });
  const edited = await f.service.request({ action: 'update', id: task.id, name: 'Changed', prompt: 'New prompt', cron: task.cron });
  assert.equal(edited.runs[0].threadId, 'thread');
  assert.equal(edited.runs[0].status, 'running');
  assert.deepEqual(edited.options, task.options);
  f.service.observe({ kind: 'connection', connected: false });
  resume(); await run;
  assert.equal(continued, false);
  assert.equal(f.state()[0].runs[0].status, 'interrupted');
  assert.equal(f.state()[0].name, 'Changed');
});

test('deleting a pending launch prevents it sending its turn and does not recreate the task', async t => {
  let resume, sent = false;
  const f = await fixture(t, async (task, { attach }) => {
    await new Promise(resolve => { resume = resolve; });
    attach('late-thread'); sent = true;
  });
  f.service.start(); const task = await f.create();
  const pending = f.service.request({ action: 'run', id: task.id });
  await f.service.request({ action: 'delete', id: task.id });
  resume(); await pending;
  assert.equal(sent, false); assert.deepEqual(f.state(), []);
});

test('runner uses Cowork policies, registers before sending and refuses model/core substitution', async () => {
  let host = { owner: {}, coreId: 'fixture', models: [{ model: 'model', isDefault: true }], hints: true, autoReview: false };
  const options = captureRoutineOptions({ config: { model: 'model', permission: 'ask' }, ...host });
  const calls = [];
  const launch = createRoutineRunner({ context: async () => host, rpc: async ({ method, params }) => {
    calls.push({ method, params });
    if (method === 'thread/start') return { thread: { id: 'thread' } };
    if (method === 'turn/start') { assert.equal(calls.at(-3).method, 'attached'); return { turn: { id: 'turn' } }; }
    return {};
  } });
  await launch({ name: 'Task', prompt: 'Do work', cwd: '/project', options }, { attach: id => calls.push({ method: 'attached', id }) });
  assert.equal(calls[0].params.codeDesktop.surface, 'cowork');
  assert.equal(calls[0].params.approvalPolicy, 'untrusted');
  assert.equal(calls.at(-1).params.codeDesktop.permissionMode, 'ask');
  assert.deepEqual(calls.at(-1).params.sandboxPolicy.writableRoots, ['/project']);
  assert.equal(calls.at(-1).params.sandboxPolicy.networkAccess, false);
  host = { ...host, coreId: 'different' };
  await assert.rejects(launch({ options }, { attach() {} }), /Switch to/);
  assert.equal(calls.length, 4);
  host = { ...host, coreId: 'fixture', models: [] };
  await assert.rejects(launch({ options }, { attach() {} }), /unavailable/);
});
