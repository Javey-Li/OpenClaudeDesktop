import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// The Tasks pane workflow card: Retry/Skip only where the engine controls members,
// skipped agents read as Skipped, and a turn-scoped Stop says so.
let server, W;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  W = await server.ssrLoadModule('/src/source-workflow.jsx');
});
after(() => server?.close());

const now = Date.now();
const run = (extra = {}) => ({ id: 'attempt-1', runId: 'r1', status: 'running', name: 'audit', description: 'Audit', startedAt: now, sequence: 3,
  workflowProgress: [{ type: 'workflow_phase', index: 0, title: 'Scan' },
    { type: 'workflow_agent', index: 1, id: '1', label: 'scan a', state: 'progress', phaseIndex: 0, phaseTitle: 'Scan', startedAt: now, lastProgressAt: now },
    { type: 'workflow_agent', index: 2, id: '2', label: 'scan b', state: 'skipped', phaseIndex: 0, phaseTitle: 'Scan' }], ...extra });
const card = props => renderToStaticMarkup(React.createElement(W.WorkflowCard, { onStop: async () => {}, onMember: async () => {}, ...props }));

test('model runs show Retry/Skip only when they declare member controls', () => {
  assert.doesNotMatch(card({ run: run({ source: 'model', itemId: 'w1' }) }), /Retry agent/, 'Qwen/MiMo runs');
  assert.match(card({ run: run({ source: 'model', itemId: 'w1', memberControls: true }) }), /Retry agent: scan a/);
  assert.match(card({ run: run() }), /Skip agent: scan a/, 'local /workflow runs');
});

test('a skipped agent reads Skipped, not as a failure; the card keeps the tool item identity', () => {
  const html = card({ run: run({ source: 'model', itemId: 'w1' }) });
  assert.match(html, /scan b(?:<\/button>)?<span class="swf-attempt"> · Skipped/);
  assert.doesNotMatch(html, /swf-agent-error/);
  assert.match(html, /data-task-id="workflow:item:w1"/);
});

test('a Stop that interrupts the whole turn says so', () => {
  const html = card({ run: run({ source: 'model', itemId: 'w1', stopScope: 'turn' }) });
  assert.match(html, /aria-label="Stop the turn running this workflow"/);
  assert.match(html, /Stop interrupts the whole turn/);
  assert.match(card({ run: run({ source: 'model', itemId: 'w1' }) }), /aria-label="Stop this workflow"/);
});

test('/workflows controls (Claude Code 2.1.280): pause/resume, filter, save, tool calls, large-workflow warning', () => {
  const local = run({ workflowProgress: [...run().workflowProgress, { type: 'workflow_agent', index: 3, id: '3', label: 'scan c', state: 'progress', phaseIndex: 0, startedAt: now, lastProgressAt: now, toolCalls: 3, lastToolName: 'Bash' }] });
  const html = card({ run: local, onPause: async () => {}, onSave: async () => {} });
  assert.match(html, /aria-label="Pause this workflow"/);
  assert.match(html, /Save workflow…/);
  assert.match(html, /aria-label="Filter agents"/);
  assert.match(html, /3 tool calls · last: Bash/);
  assert.match(card({ run: { ...local, paused: true }, onPause: async () => {} }), /aria-label="Resume this workflow"[\s\S]*Paused|Paused[\s\S]*aria-label="Resume this workflow"/);
  assert.doesNotMatch(card({ run: run({ source: 'model', itemId: 'w1' }), onPause: async () => {}, onSave: async () => {} }), /Pause this workflow|Save workflow/, 'a core\'s own run has neither');
  assert.match(card({ run: local, warningLimits: { agents: 2, tokens: 1_500_000, suppressed: false } }), /data-large-workflow=""/, 'more agents than the cap');
  // Each side passes its own limits: the other side's ultracode never suppresses this one's warning.
  assert.doesNotMatch(card({ run: local, warningLimits: { agents: 2, tokens: 1_500_000, suppressed: true } }), /data-large-workflow=""/);
  assert.doesNotMatch(card({ run: local }), /data-large-workflow=""/, 'defaults: 25 agents');
  assert.equal(W.largeWorkflow(local, { agents: 25, tokens: 1_500_000 }), false);
  const queued = { ...local, usage: { totalTokens: 600_000 }, workflowProgress: [{ type: 'workflow_agent', id: 'a', state: 'progress' }, { type: 'workflow_agent', id: 'b', state: 'start' }, { type: 'workflow_agent', id: 'c', state: 'start' }] };
  assert.equal(W.largeWorkflow(queued, { agents: 25, tokens: 1_500_000 }), true, 'projected: 600k per started agent × 3 scheduled');
  assert.equal(W.largeWorkflow({ ...local, usage: { totalTokens: 1_600_000 } }, { agents: 25, tokens: 1_500_000 }), true, 'actual tokens');
  assert.equal(W.largeWorkflow(local, { agents: 2, tokens: 1_500_000, suppressed: true }), false, 'never in ultracode');
  assert.equal(W.largeWorkflow({ ...local, status: 'completed' }, { agents: 2, tokens: 1 }), false);
});

test('a core\'s own run: Pause only where the core pauses it (Qwen), Resume only on a settled run the core marks resumable (ZCode)', () => {
  const model = (extra = {}) => run({ source: 'model', itemId: 'w1', ...extra });
  assert.match(card({ run: model({ pauseControls: true }), onPause: async () => {} }), /aria-label="Pause this workflow"/);
  assert.match(card({ run: model({ pauseControls: true, paused: true }), onPause: async () => {} }), /aria-label="Resume this workflow"/);
  assert.doesNotMatch(card({ run: model({ pauseControls: true, runId: null }), onPause: async () => {} }), /Pause this workflow/, 'an unnamed run has nothing to pause by');
  const stopped = model({ status: 'stopped', summary: 'Stopped', completedAt: now, durationMs: 1000, resumable: true });
  assert.match(card({ run: stopped, onResume: async () => {} }), /aria-label="Resume this workflow"/);
  assert.doesNotMatch(card({ run: { ...stopped, resumable: undefined }, onResume: async () => {} }), /Resume this workflow/);
  assert.doesNotMatch(card({ run: stopped }), /Resume this workflow/, 'no resume without a handler');
});
