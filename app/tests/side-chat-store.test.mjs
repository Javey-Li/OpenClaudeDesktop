import test from 'node:test';
import assert from 'node:assert/strict';
import { createSideChatStore } from '../src/side-chat-store.mjs';
import { parseSessionCommand, sessionCommands } from '../src/session-command-model.mjs';

test('side chat store: ask, stream, finish, history and clear per session', () => {
  const store = createSideChatStore();
  let changes = 0;
  store.subscribe(() => changes++);
  store.ask('t1', 'first?', 'r1');
  assert.deepEqual(store.get('t1'), { messages: [{ role: 'user', text: 'first?' }, { role: 'assistant', text: '' }], status: 'thinking', error: null, requestId: 'r1' });
  store.delta('t1', 'r1', 'Hel'); store.delta('t1', 'r1', 'lo');
  store.delta('t1', 'stale', 'ignored');
  assert.equal(store.get('t1').messages[1].text, 'Hello');
  store.finish('t1', 'r1', { text: 'Hello there' });
  assert.equal(store.get('t1').status, 'idle');
  assert.deepEqual(store.history('t1'), [{ question: 'first?', answer: 'Hello there' }]);
  assert.deepEqual(store.get('t2').messages, [], 'sessions are separate');
  // A failed question with no answer is dropped and its error shown.
  store.ask('t1', 'second?', 'r2');
  store.finish('t1', 'r2', { error: 'boom' });
  assert.deepEqual(store.get('t1').messages.map(message => message.text), ['first?', 'Hello there']);
  assert.equal(store.get('t1').error, 'boom');
  store.clear('t1');
  assert.deepEqual(store.get('t1').messages, []);
  assert.ok(changes >= 6);
});

test('/btw is a session command that works while a turn runs', () => {
  const btw = sessionCommands.find(command => command.id === 'btw');
  assert.ok(btw && btw.session === true && !btw.idle);
  const parsed = parseSessionCommand('/btw what did we decide?');
  assert.equal(parsed.id, 'btw');
  assert.equal(parsed.args, 'what did we decide?');
});
