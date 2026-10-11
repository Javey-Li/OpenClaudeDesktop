import { registerCodexPack } from './codex-pack.mjs';
registerCodexPack();
// Claude Code's own tools that OpenClaude Desktop's agent-tools server serves to a core without them (agent-tools/ask.mjs,
// notify.mjs, files.mjs, findings.mjs, session.mjs, terminal.mjs open_terminal_tab), the per-core rule that leaves out
// a tool the core has natively (nativeTools, agent-tools-host.cjs isToolListed), and Codex's Default-mode questions.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import * as ask from '../electron/agent-tools/ask.mjs';
import * as notify from '../electron/agent-tools/notify.mjs';
import * as files from '../electron/agent-tools/files.mjs';
import * as findings from '../electron/agent-tools/findings.mjs';
import * as session from '../electron/agent-tools/session.mjs';
import * as terminal from '../electron/agent-tools/terminal.mjs';
import { coreCapabilities, allCores } from '../electron/core-registry.mjs';

const require = createRequire(import.meta.url);
const { createAgentToolsHost } = require('../electron/agent-tools-host.cjs');
const { defaultModeQuestions } = require('../electron/codex-default-questions.cjs');
const SERVER = new URL('../electron/agent-tools-server.mjs', import.meta.url).pathname;
const TOOLS_DIR = new URL('../electron/agent-tools', import.meta.url).pathname;
const tool = (module, name) => module.tools.find((entry) => entry.name === name);
const textOf = (result) => (typeof result === 'string' ? result : result.content.map((part) => part.text).join('\n'));
const made = [];
const tmp = () => { const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cd-claude-tools-'))); made.push(dir); return dir; };
test.after(() => { for (const dir of made) fs.rmSync(dir, { recursive: true, force: true }); });

const QUESTIONS = { questions: [
  { question: 'Which database should I target?', header: 'Database', options: [{ label: 'Postgres (Recommended)', description: 'The production one' }, { label: 'SQLite', description: 'Local only' }] },
  { question: 'Which checks?', header: 'Checks', multiSelect: true, options: [{ label: 'Lint', description: '' }, { label: 'Tests', description: '' }, { label: 'Types', description: '' }] },
] };

test('AskUserQuestion validates Claude’s schema and maps it to the question card’s requestUserInput questions', () => {
  const questions = ask.requestQuestions(QUESTIONS);
  assert.deepEqual(questions.map((q) => [q.id, q.header, q.isOther, q.isSecret, q.options.length, q.multiSelect === true]), [['q1', 'Database', true, false, 2, false], ['q2', 'Checks', true, false, 3, true]]);
  assert.throws(() => ask.requestQuestions({ questions: [] }), /1 to 4/);
  assert.throws(() => ask.requestQuestions({ questions: Array.from({ length: 5 }, (_, i) => ({ question: `Q${i}?`, header: 'h', options: [{ label: 'a' }, { label: 'b' }] })) }), /at most 4/);
  assert.throws(() => ask.requestQuestions({ questions: [{ question: 'One?', header: 'h', options: [{ label: 'only' }] }] }), /2 to 4 options/);
  assert.throws(() => ask.requestQuestions({ questions: [{ question: 'Dup?', header: 'h', options: [{ label: 'a' }, { label: 'a' }] }] }), /two options/);
  assert.equal(ask.requestQuestions({ questions: [{ question: 'Long header?', header: 'A very long header text', options: [{ label: 'a' }, { label: 'b' }] }] })[0].header.length, 12);
});

test('AskUserQuestion waits for the card and tells the model the answers; a stopped or impossible card is an error', async () => {
  const handler = tool(ask, 'AskUserQuestion').handler;
  const asked = [];
  const ctx = (answer) => ({ sessionId: 's', questions: { ask: async (questions) => { asked.push(questions); return answer; } } });
  const answered = textOf(await handler(QUESTIONS, ctx({ answers: { q1: { answers: ['SQLite'] }, q2: { answers: ['Lint', 'Types'] } } })));
  assert.equal(answered, 'User has answered your questions: "Which database should I target?"="SQLite", "Which checks?"="Lint, Types". You can now continue with the user’s answers in mind.');
  assert.equal(asked[0].length, 2);
  assert.match(textOf(await handler(QUESTIONS, ctx({ answers: { q1: { answers: ['Something else entirely'] } } }))), /"Which database should I target\?"="Something else entirely"\. One question was skipped\./);
  assert.match(textOf(await handler(QUESTIONS, ctx({ answers: {} }))), /^The user skipped the questions/);
  assert.match(textOf(await handler(QUESTIONS, ctx({ answers: { q1: { answers: [ask.DISMISSED] }, q2: { answers: [ask.DISMISSED] } } }))), /sent a message instead/);
  await assert.rejects(handler(QUESTIONS, ctx(null)), /dismissed the questions/);
  await assert.rejects(handler(QUESTIONS, ctx(undefined)), /plain text/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(handler(QUESTIONS, { ...ctx({ answers: {} }), signal: controller.signal }), /stopped/);
  await assert.rejects(handler(QUESTIONS, { sessionId: 's' }), /can’t be shown/);
});

test('PushNotification follows the settings outcome and sends at most one every 10 seconds per session', async () => {
  notify.resetNotifyLimits();
  const handler = tool(notify, 'PushNotification').handler;
  const sent = [];
  const ctx = (sessionId, outcome = 'sent') => ({ sessionId, notifications: { send: (note) => { sent.push({ sessionId, ...note }); return outcome; } } });
  assert.equal(await handler({ message: 'Build finished', title: 'Done' }, ctx('a')), 'Notification sent.');
  assert.deepEqual(sent[0], { sessionId: 'a', title: 'Done', message: 'Build finished' });
  await assert.rejects(handler({ message: 'Again' }, ctx('a')), /wait \d+ s/);
  assert.equal(await handler({ message: 'Other session' }, ctx('b')), 'Notification sent.');
  assert.match(await handler({ message: 'x' }, ctx('c', 'focused')), /^Notification not sent: the user is looking/);
  assert.match(await handler({ message: 'x' }, ctx('c', 'off')), /turned these notifications off/);
  assert.equal(await handler({ message: 'Now allowed' }, ctx('c')), 'Notification sent.', 'a notification not sent does not count against the limit');
  await assert.rejects(handler({ message: 'x'.repeat(201) }, ctx('d')), /longer than 200/);
  await assert.rejects(handler({ message: '  ' }, ctx('d')), /required/);
  await assert.rejects(handler({ message: 'x' }, { sessionId: 'e' }), /aren’t available/);
});

test('SendUserFile sends files inside the session folder only, as deliverables', async () => {
  const root = tmp(), outside = tmp();
  fs.mkdirSync(path.join(root, 'out'));
  fs.writeFileSync(path.join(root, 'out/report.md'), '# Report');
  fs.writeFileSync(path.join(root, 'shot.png'), 'png');
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'no');
  fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(root, 'link.txt'));
  const handler = tool(files, 'SendUserFile').handler;
  const result = await handler({ files: ['out/report.md', path.join(root, 'shot.png'), './out/report.md'], caption: 'The review' }, { cwd: root });
  assert.equal(result.content[0].text, 'Sent 2 files to the user: report.md, shot.png.');
  assert.deepEqual(result.structuredContent, { deliverables: [{ path: path.join(root, 'out/report.md'), description: 'The review' }, { path: path.join(root, 'shot.png'), description: 'The review' }] });
  await assert.rejects(handler({ files: [path.join(outside, 'secret.txt')] }, { cwd: root }), /outside the session’s working folder/);
  await assert.rejects(handler({ files: ['link.txt'] }, { cwd: root }), /outside/, 'a link leading out of the folder is refused');
  await assert.rejects(handler({ files: ['out'] }, { cwd: root }), /not a file/);
  await assert.rejects(handler({ files: ['missing.txt'] }, { cwd: root }), /doesn’t exist/);
  await assert.rejects(handler({ files: [] }, { cwd: root }), /at least one/);
  await assert.rejects(handler({ files: Array(21).fill('shot.png') }, { cwd: root }), /at most 20/);
});

test('ReportFindings checks the typed findings and records them without side effects', async () => {
  const handler = tool(findings, 'ReportFindings').handler;
  const list = [{ file: 'src/a.js', line: 12, summary: 'Off by one', failure_scenario: 'n = 0 reads past the end', category: 'correctness', verdict: 'CONFIRMED' }];
  assert.match(await handler({ findings: list, level: 'high' }), /^Reported 1 finding\./);
  assert.match(await handler({ findings: [{ ...list[0], outcome: 'fixed' }] }), /1 with an outcome/);
  assert.match(await handler({ findings: [] }), /^No findings reported/);
  await assert.rejects(handler({ findings: [{ file: 'a', summary: 's' }] }), /failure_scenario/);
  await assert.rejects(handler({ findings: [{ ...list[0], verdict: 'MAYBE' }] }), /verdict/);
  await assert.rejects(handler({ findings: [{ ...list[0], outcome: 'done' }] }), /outcome/);
  await assert.rejects(handler({ findings: list, level: 'huge' }), /level/);
  await assert.rejects(handler({}), /must be a list/);
  assert.deepEqual(findings.normalizeFindings({ findings: [{ ...list[0], line: 0 }] })[0].line, undefined);
});

test('mark_chapter, spawn_task and dismiss_task only describe the transcript; a suggestion gets a task id', async () => {
  session.resetSuggestions();
  const mark = tool(session, 'mark_chapter').handler, spawnTask = tool(session, 'spawn_task').handler, dismiss = tool(session, 'dismiss_task').handler;
  assert.equal(await mark({ title: 'Test verification' }), 'Chapter “Test verification” marked.');
  await assert.rejects(mark({ title: 'x'.repeat(41) }), /under 40/);
  await assert.rejects(mark({}), /required/);
  const ctx = { sessionId: 's1', cwd: '/tmp' };
  const text = await spawnTask({ title: 'Remove dead option', tldr: 'Noticed it while fixing the menu.', prompt: 'Remove the unused option in src/x.js.' }, ctx);
  const id = /task_id: (task_[0-9a-f]{8})$/.exec(text)?.[1];
  assert.ok(id, text);
  await assert.rejects(spawnTask({ title: 'T', tldr: 't', prompt: 'p', cwd: 'relative/dir' }, ctx), /absolute/);
  await assert.rejects(spawnTask({ title: 'T', tldr: 't', prompt: 'p', cwd: '/definitely/not/here' }, ctx), /doesn’t exist/);
  await assert.rejects(spawnTask({ title: 'x'.repeat(61), tldr: 't', prompt: 'p' }, ctx), /under 60/);
  for (let i = 1; i < session.MAX_SUGGESTIONS; i++) await spawnTask({ title: `T${i}`, tldr: 't', prompt: 'p' }, ctx);
  await assert.rejects(spawnTask({ title: 'One too many', tldr: 't', prompt: 'p' }, ctx), /already suggested 20/);
  assert.equal(await dismiss({ task_id: id }, ctx), `Suggested task ${id} withdrawn.`);
  assert.match(await spawnTask({ title: 'Room again', tldr: 't', prompt: 'p' }, ctx), /task_id: task_/);
  await assert.rejects(dismiss({ task_id: 'nope' }, ctx), /task_id must be/);
});

test('open_terminal_tab opens a tab at its prompt in the session folder and types nothing', async () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, 'web'));
  const tabs = [], typed = [];
  const service = {
    ownerOf: ({ sessionId }) => ({ owner: `o:${sessionId}`, sessionId, cwd: root }),
    agent: {
      list: () => tabs,
      open: async ({ cwd, title }) => { const tab = { id: `t${tabs.length + 1}`, number: tabs.length + 1, title, cwd, openedBy: 'agent', status: 'running' }; tabs.push(tab); return tab; },
      type: async (...args) => { typed.push(args); return true; },
    },
  };
  const handler = tool(terminal, 'open_terminal_tab').handler;
  const opened = JSON.parse(textOf(await handler({ cwd: 'web', title: 'login' }, { sessionId: 's', terminals: service })));
  assert.deepEqual(opened, { tab_id: 't1', title: 'login', cwd: path.join(root, 'web') });
  assert.deepEqual(typed, []);
  await assert.rejects(handler({ cwd: '/' }, { sessionId: 's', terminals: service }), /inside the session’s working folder/);
  while (tabs.length < terminal.MAX_AGENT_TABS) await handler({}, { sessionId: 's', terminals: service });
  await assert.rejects(handler({}, { sessionId: 's', terminals: service }), /already have 6/);
});

test('each core lists the Claude tools it has itself; the host serves a stand-in only to a core without one', async (t) => {
  const natives = Object.fromEntries(allCores().map((core) => [core.id, coreCapabilities({ engine: core.engine }).nativeTools]));
  for (const [id, list] of Object.entries(natives)) assert.ok(Array.isArray(list), `${id} declares nativeTools`);
  assert.ok(!natives.gemini.includes('AskUserQuestion'), 'Gemini has no question tool under ACP');
  assert.ok(natives.deepseek.includes('SendUserFile') && natives.qwen.includes('ReportFindings') && natives.codex.includes('AskUserQuestion'));

  const sessions = { 'thread-a': tmp() };
  const listedFor = (core) => (entry) => !entry.native || !natives[core].includes(entry.native);
  let core = 'gemini';
  const host = createAgentToolsHost({ toolsDir: TOOLS_DIR, tmpRoot: tmp(), logger: { warn() {}, log() {} },
    resolveSession: (id, meta) => { const key = id ?? meta.threadId; return Object.hasOwn(sessions, key ?? '') ? { id: key, cwd: sessions[key] } : null; },
    isToolListed: (entry) => listedFor(core)(entry) });
  host.provide('notifications', () => ({ send: () => 'focused' }));
  await host.start();
  t.after(() => host.stop());
  const names = () => host.listTools().map((entry) => entry.name);
  for (const name of ['AskUserQuestion', 'PushNotification', 'SendUserFile', 'ReportFindings', 'mark_chapter', 'spawn_task', 'dismiss_task', 'open_terminal_tab']) assert.ok(names().includes(name), `${name} is served to Gemini`);
  core = 'deepseek';
  assert.ok(!names().includes('SendUserFile') && !names().includes('AskUserQuestion') && names().includes('PushNotification'), 'DeepSeek keeps its own present and question tools');
  await assert.rejects(host.call('thread-a', { name: 'SendUserFile', arguments: { files: ['x'] } }), /use its own SendUserFile tool/);
  core = 'qwen';
  assert.ok(!names().includes('ReportFindings'));

  // Over the stdio MCP server, as a core sees it.
  core = 'gemini';
  const child = spawn(process.execPath, [SERVER], { env: { PATH: process.env.PATH, ...host.launchEnv(), CODE_DESKTOP_AGENT_SESSION: 'thread-a' }, stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(() => child.kill());
  const lines = readline.createInterface({ input: child.stdout });
  const pending = new Map();
  let seq = 0;
  lines.on('line', (line) => { const message = JSON.parse(line); if (message.id != null && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); } });
  const request = (method, params) => new Promise((resolve) => { const id = ++seq; pending.set(id, resolve); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
  await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
  const listed = (await request('tools/list', {})).result.tools;
  const ask = listed.find((entry) => entry.name === 'AskUserQuestion');
  assert.equal(ask.inputSchema.properties.questions.maxItems, 4);
  const chapter = await request('tools/call', { name: 'mark_chapter', arguments: { title: 'Implementation' } });
  assert.deepEqual(chapter.result, { content: [{ type: 'text', text: 'Chapter “Implementation” marked.' }] });
  const note = await request('tools/call', { name: 'PushNotification', arguments: { message: 'Done' } });
  assert.match(note.result.content[0].text, /^Notification not sent/);
  fs.writeFileSync(path.join(sessions['thread-a'], 'out.txt'), 'x');
  const sent = await request('tools/call', { name: 'SendUserFile', arguments: { files: ['out.txt'] } });
  assert.equal(sent.result.structuredContent.deliverables[0].path, path.join(sessions['thread-a'], 'out.txt'));
});

test('Codex gets its request_user_input in Default mode through the flag, quietly, unless the user set it', () => {
  const stages = new Map([['default_mode_request_user_input', { stage: 'underDevelopment', enabled: false }], ['goals', { stage: 'beta', enabled: true }]]);
  const started = defaultModeQuestions('thread/start', { cwd: '/w', config: { a: 1 } }, { native: true, stages });
  assert.deepEqual(started.config, { a: 1, 'features.default_mode_request_user_input': true, suppress_unstable_features_warning: true });
  assert.ok(defaultModeQuestions('thread/resume', { threadId: 't' }, { native: true, stages }).config['features.default_mode_request_user_input']);
  assert.equal(defaultModeQuestions('turn/start', { threadId: 't' }, { native: true, stages }).config, undefined);
  assert.equal(defaultModeQuestions('thread/start', {}, { native: false, stages }).config, undefined, 'only a native Codex');
  assert.equal(defaultModeQuestions('thread/start', {}, { native: true, stages: new Map() }).config, undefined, 'a Codex without the flag');
  assert.equal(defaultModeQuestions('thread/start', {}, { native: true, stages: new Map([['default_mode_request_user_input', { stage: 'underDevelopment', enabled: true }]]) }).config, undefined, 'already on');
  const loud = defaultModeQuestions('thread/start', {}, { native: true, stages: new Map([...stages, ['other_thing', { stage: 'underDevelopment', enabled: true }]]) });
  assert.deepEqual(loud.config, { 'features.default_mode_request_user_input': true }, 'the user’s own unstable flag keeps its warning');
  assert.deepEqual(defaultModeQuestions('thread/start', { config: { 'features.default_mode_request_user_input': false } }, { native: true, stages }).config, { 'features.default_mode_request_user_input': false });
});
