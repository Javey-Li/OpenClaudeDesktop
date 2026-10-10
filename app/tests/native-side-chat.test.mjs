import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createNativeSideChat, SIDE_DEVELOPER_INSTRUCTIONS, SIDE_BOUNDARY_PROMPT } = require('../electron/native-side-chat.cjs');

// A fake Codex client: records requests; the test drives notifications through observe().
function fakeClient({ injectFails = false } = {}) {
  const calls = [];
  let forks = 0, turns = 0;
  return { calls, async request(method, params) {
    calls.push({ method, params });
    if (method === 'thread/fork') return { thread: { id: `fork-${++forks}`, ephemeral: true, forkedFromId: params.threadId } };
    if (method === 'thread/inject_items') { if (injectFails) throw Object.assign(new Error('unknown variant'), { code: -32600 }); return {}; }
    if (method === 'turn/start') return { turn: { id: `turn-${++turns}`, status: 'inProgress' } };
    return {};
  } };
}

test('Codex /side: an ephemeral read-only fork with the side instructions, the boundary injected, deltas to the panel', async () => {
  const client = fakeClient(), emitted = [];
  const side = createNativeSideChat({ getClient: () => client, emit: (event) => emitted.push(event), settings: () => ({ model: 'gpt-5.5', effort: 'high' }) });
  const answer = side.ask({ threadId: 'main', question: 'what does this regex do?', history: [], requestId: 'r1' });
  await new Promise((resolve) => setImmediate(resolve));
  const fork = client.calls.find((call) => call.method === 'thread/fork').params;
  assert.deepEqual({ ...fork, developerInstructions: undefined }, { threadId: 'main', ephemeral: true, excludeTurns: true, approvalPolicy: 'never', sandbox: 'read-only', model: 'gpt-5.5', config: { model_reasoning_effort: 'high' }, developerInstructions: undefined });
  assert.equal(fork.developerInstructions, SIDE_DEVELOPER_INSTRUCTIONS);
  assert.equal(client.calls.find((call) => call.method === 'thread/inject_items').params.items[0].content[0].text, SIDE_BOUNDARY_PROMPT);
  const turn = client.calls.find((call) => call.method === 'turn/start').params;
  assert.equal(turn.threadId, 'fork-1');
  assert.equal(turn.input[0].text, 'what does this regex do?');
  assert.deepEqual(turn.sandboxPolicy, { type: 'readOnly', networkAccess: false });
  // The fork's events stay in main; the delta reaches the panel under the parent session.
  assert.equal(side.observe({ method: 'thread/started', params: { thread: { id: 'fork-1' } } }), true);
  assert.equal(side.observe({ method: 'item/agentMessage/delta', params: { threadId: 'fork-1', turnId: 'turn-1', delta: 'It matches ' } }), true);
  assert.deepEqual(emitted.at(-1), { method: 'codeDesktop/sideQuestion/delta', params: { threadId: 'main', requestId: 'r1', text: 'It matches ' } });
  side.observe({ method: 'item/completed', params: { threadId: 'fork-1', turnId: 'turn-1', item: { type: 'agentMessage', text: 'It matches digits.' } } });
  side.observe({ method: 'turn/completed', params: { threadId: 'fork-1', turn: { id: 'turn-1', status: 'completed' } } });
  assert.deepEqual(await answer, { text: 'It matches digits.' });
  assert.equal(side.observe({ method: 'item/agentMessage/delta', params: { threadId: 'main', delta: 'x' } }), false, 'the session itself is not a fork');
  // A follow-up reuses the fork; a fresh chat (no history) drops it and forks again.
  const follow = side.ask({ threadId: 'main', question: 'and groups?', history: [{ question: 'q', answer: 'a' }], requestId: 'r2' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(client.calls.filter((call) => call.method === 'thread/fork').length, 1);
  side.observe({ method: 'turn/completed', params: { threadId: 'fork-1', turn: { id: 'turn-2', status: 'completed' } } });
  await follow;
  const again = side.ask({ threadId: 'main', question: 'new', history: [], requestId: 'r3' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(client.calls.some((call) => call.method === 'thread/unsubscribe' && call.params.threadId === 'fork-1'));
  assert.equal(client.calls.filter((call) => call.method === 'thread/fork').length, 2);
  await side.cancel({ requestId: 'r3' });
  assert.deepEqual(await again, { text: '' });
  assert.ok(client.calls.some((call) => call.method === 'turn/interrupt' && call.params.threadId === 'fork-2'));
});

test('Codex /side: without thread/inject_items the boundary leads the first question; a failed turn rejects', async () => {
  const client = fakeClient({ injectFails: true });
  const side = createNativeSideChat({ getClient: () => client, emit: () => {} });
  const answer = side.ask({ threadId: 'main', question: 'hi', history: [], requestId: 'r1' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(client.calls.find((call) => call.method === 'turn/start').params.input[0].text.startsWith('Side conversation boundary.'));
  side.observe({ method: 'turn/completed', params: { threadId: 'fork-1', turn: { id: 'turn-1', status: 'failed', error: { message: 'boom' } } } });
  await assert.rejects(answer, /boom/);
  assert.equal(side.observe({ method: 'thread/started', params: { thread: { id: 'other', ephemeral: true, forkedFromId: 'nobody' } } }), false);
});
