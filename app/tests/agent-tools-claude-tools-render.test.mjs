// How the transcript shows Claude Code's tools that Code Desktop serves (agent-tools/ask.mjs, notify.mjs, files.mjs,
// findings.mjs, session.mjs): official row verbs, stands-alone rows kept out of tool groups, the AskUserQuestion
// receipt, SendUserFile file cards, ReportFindings as a Review result (and the Changes pane's findings), chapter
// headings and the Suggested task card.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { appToolLabel, appToolStandsAlone, chapterOf, transcriptChapters, suggestedTasks } from '../src/agent-tool-titles.mjs';
import { questionReceipt, questionOutcome, genericToolLabel, genericToolBody } from '../src/generic-tool-model.mjs';
import { groupFileTools } from '../src/file-tool-model.mjs';
import { reportedFindings, reportedFindingsReview, latestReviewFindings, parseBridgeReview } from '../src/review-findings-model.mjs';
import { requestQuestions, answerText } from '../electron/agent-tools/ask.mjs';

let server, S, D, T;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  S = await server.ssrLoadModule('/src/source-session.jsx');
  D = await server.ssrLoadModule('/src/source-deliverables.jsx');
  T = await server.ssrLoadModule('/src/source-suggested-tasks.jsx');
});
after(() => server?.close());

const call = (tool, args, { status = 'completed', text = 'ok', server: name = 'code_desktop', id = tool, ...rest } = {}) => ({
  id, turnId: 't1', type: 'mcpToolCall', server: name, tool, status, arguments: args,
  result: status === 'completed' ? { content: [{ type: 'text', text }] } : null, error: null, ...rest,
});

test('rows read with the official verbs; OpenCode’s code_desktop_ prefix is the same tool', () => {
  assert.deepEqual(appToolLabel(call('PushNotification', { message: 'Build finished' }, { text: 'Notification sent.' }), 'done'), { label: 'Sent notification', meta: 'Build finished' });
  assert.deepEqual(appToolLabel(call('PushNotification', { message: 'x', title: 'Deploy' }, { text: 'Notification not sent: the user is looking at Code Desktop right now.' }), 'done'), { label: 'Notification not sent', meta: 'Deploy' });
  assert.equal(appToolLabel(call('PushNotification', { message: 'x' }, { status: 'inProgress' }), 'busy').label, 'Sending notification');
  assert.equal(appToolLabel(call('PushNotification', { message: 'x' }), 'failed').label, 'Failed to send notification');
  assert.deepEqual(appToolLabel(call('code_desktop_SendUserFile', { files: ['out/report.md'] }, { server: null }), 'done'), { label: 'Sent', meta: 'report.md' });
  assert.deepEqual(appToolLabel(call('SendUserFile', { files: ['a', 'b'] }, { status: 'inProgress' }), 'busy'), { label: 'Sending', meta: '2 files' });
  assert.deepEqual(appToolLabel(call('spawn_task', { title: 'Remove dead option' }), 'done'), { label: 'Suggested task', meta: 'Remove dead option' });
  assert.equal(appToolLabel(call('spawn_task', { title: 'x' }, { status: 'inProgress' }), 'busy').label, 'Suggesting task');
  assert.deepEqual(appToolLabel(call('ReportFindings', { findings: [{}, {}] }), 'done'), { label: 'Reported review findings', meta: '2 findings' });
  assert.deepEqual(appToolLabel(call('open_terminal_tab', { title: 'login' }), 'done'), { label: 'Opened terminal tab', meta: 'login' });
  assert.deepEqual(appToolLabel(call('AskUserQuestion', { questions: [{ header: 'Database' }] }), 'busy'), { label: 'Asking', meta: 'Database' });
});

test('stands-alone tools and mark_chapter are never folded into a tool group; other app tools still are', () => {
  const items = [call('read_terminal', {}, { id: 'a' }), call('PushNotification', { message: 'x' }, { id: 'b' }), call('list_terminal_tabs', {}, { id: 'c' }), call('mark_chapter', { title: 'Fix' }, { id: 'd' }), call('screenshot', {}, { id: 'e' }), call('preview_list', {}, { id: 'f' })];
  assert.ok(['PushNotification', 'SendUserFile', 'ReportFindings', 'AskUserQuestion', 'mark_chapter'].every((tool) => appToolStandsAlone(call(tool, {}))));
  assert.ok(!appToolStandsAlone(call('screenshot', {})));
  assert.ok(appToolStandsAlone({ type: 'dynamicToolCall', tool: 'present', codeDesktop: { deliverables: [{ path: 'a' }] } }), 'the DeepSeek core’s present cards too');
  assert.deepEqual(groupFileTools(items).map((row) => row.type === 'fileToolGroup' ? row.toolGroup.map((member) => member.id).join('+') : row.id), ['a', 'b', 'c', 'd', 'e+f']);
});

test('an answered AskUserQuestion is the question receipt; skipped and dismissed read as such', () => {
  const args = { questions: [{ question: 'Which database?', header: 'Database', options: [{ label: 'Postgres', description: '' }, { label: 'SQLite', description: '' }] }, { question: 'Tests?', header: 'Tests', options: [{ label: 'Yes', description: '' }, { label: 'No', description: '' }] }] };
  const questions = requestQuestions(args);
  const answered = call('AskUserQuestion', args, { text: answerText(questions, { answers: { q1: { answers: ['SQLite'] } } }) });
  assert.deepEqual(questionReceipt(answered, 'done'), [{ question: 'Which database?', answer: 'SQLite' }, { question: 'Tests?', answer: 'Skipped' }]);
  const skipped = call('AskUserQuestion', args, { text: answerText(questions, { answers: {} }) });
  assert.equal(questionReceipt(skipped, 'done'), null);
  assert.equal(questionOutcome(skipped, 'done'), 'Skipped');
  assert.equal(genericToolLabel(skipped, 'done').label, 'Asked');
  assert.equal(genericToolBody(call('AskUserQuestion', args, { status: 'inProgress' }), 'busy'), 'questions');
  const html = renderToStaticMarkup(React.createElement(S.SourceMessage, { item: answered, sessionKey: 's1' }));
  assert.match(html, /Which database\?/);
  assert.match(html, /SQLite/);
});

test('a finished SendUserFile is file cards: structured content, or the call’s own files from a bridge that drops it', () => {
  const structured = call('SendUserFile', { files: ['out/r.md'] }, { result: { content: [{ type: 'text', text: 'Sent 1 file' }], structuredContent: { deliverables: [{ path: '/w/out/r.md', description: 'The report' }] } } });
  assert.deepEqual(D.itemDeliverables(structured), [{ path: '/w/out/r.md', description: 'The report' }]);
  const bridged = call('code_desktop_SendUserFile', { files: ['out/r.md', 'shot.png', 'out/r.md'], caption: 'Review' }, { server: null });
  assert.deepEqual(D.itemDeliverables(bridged), [{ path: 'out/r.md', description: 'Review' }, { path: 'shot.png', description: 'Review' }]);
  assert.equal(D.itemDeliverables(call('SendUserFile', { files: ['a'] }, { status: 'inProgress' })), null, 'a running call is its Sending row');
  assert.equal(D.itemDeliverables({ ...bridged, result: { content: [{ type: 'text', text: 'outside' }], isError: true } }), null);
  const html = renderToStaticMarkup(React.createElement(S.SourceMessage, { item: bridged, sessionKey: 's1' }));
  assert.match(html, /data-deliverables=""/);
  assert.match(html, /data-deliverable="shot\.png"/);
});

test('ReportFindings reads as a Review result and is the session’s latest review for the Changes pane', () => {
  const item = call('ReportFindings', { findings: [{ file: '/w/src/a.js', line: 12, summary: 'Off by one', failure_scenario: 'n = 0', outcome: 'no_change_needed' }, { file: 'b.js', summary: 'Leak', failure_scenario: 'many opens' }] }, { id: 'rf' });
  const found = reportedFindings(item, '/w');
  assert.deepEqual(found.map((entry) => [entry.file, entry.line, entry.summary, entry.detail, entry.outcome ?? null]), [['src/a.js', 12, 'Off by one', 'n = 0', 'no change needed'], ['b.js', 1, 'Leak', 'many opens', null]]);
  assert.deepEqual(parseBridgeReview(reportedFindingsReview(found)).map((entry) => [entry.file, entry.line, entry.summary]), [['src/a.js', 12, 'Off by one'], ['b.js', 1, 'Leak']]);
  assert.deepEqual(latestReviewFindings([{ type: 'agentMessage', id: 'm', text: 'hi' }, item], '/w').key, 'rf');
  assert.equal(latestReviewFindings([call('ReportFindings', { findings: [] })], '/w'), null);
  assert.equal(reportedFindings(call('ReportFindings', { findings: [] }, { status: 'inProgress' })), null);
  const html = renderToStaticMarkup(React.createElement(S.SourceMessage, { item, sessionKey: 's1', cwd: '/w' }));
  assert.match(html, /Review result/);
  assert.match(html, /2 findings/);
});

test('mark_chapter is a chapter heading; a failed one is a row', () => {
  const item = call('mark_chapter', { title: 'Test verification', summary: 'Run the suites' }, { id: 'ch1' });
  assert.deepEqual(chapterOf(item), { id: 'ch1', title: 'Test verification', summary: 'Run the suites' });
  assert.equal(chapterOf({ ...item, status: 'failed' }), null);
  assert.deepEqual(transcriptChapters([item, call('screenshot', {})]).map((chapter) => chapter.title), ['Test verification']);
  const html = renderToStaticMarkup(React.createElement(S.SourceMessage, { item, sessionKey: 's1' }));
  assert.match(html, /^<h2 class="source-message source-chapter" data-transcript-item-id="ch1" data-chapter="" id="chapter-ch1" title="Run the suites">Test verification<\/h2>$/);
});

test('suggested tasks: newest first, withdrawn by dismiss_task or the user, shown as the Suggested task card', () => {
  const spawned = (id, title, extra = {}) => call('spawn_task', { title, tldr: `Why ${title}`, prompt: `Do ${title}`, ...extra }, { id: `i-${id}`, text: `Suggested task shown to the user; it starts only if they click Start. task_id: ${id}` });
  const items = [spawned('task_00000001', 'First'), spawned('task_00000002', 'Second', { cwd: '/other/project' }), spawned('task_00000003', 'Third'), call('dismiss_task', { task_id: 'task_00000003' })];
  assert.deepEqual(suggestedTasks(items).map((task) => task.title), ['Second', 'First']);
  assert.deepEqual(suggestedTasks(items, ['task_00000002']).map((task) => task.id), ['task_00000001']);
  assert.deepEqual(suggestedTasks([call('spawn_task', { title: 'x', tldr: 't', prompt: 'p' }, { status: 'inProgress' })]), []);
  const html = renderToStaticMarkup(React.createElement(T.SourceSuggestedTasks, { items, sessionId: 's1', cwd: '/w' }));
  assert.match(html, /data-suggested-task="task_00000002"/);
  assert.match(html, />Suggested task</);
  assert.match(html, /· in project/);
  assert.match(html, />Second</);
  assert.match(html, /title="Do Second"/);
  assert.match(html, /aria-label="Dismiss suggestion"/);
  assert.match(html, /1 of 2/);
  assert.match(html, />Start</);
  assert.equal(renderToStaticMarkup(React.createElement(T.SourceSuggestedTasks, { items: [], sessionId: 's1' })), '');
});
