// The Preview pane's pure model (src/preview-model.mjs) and the transcript titles of the app's tools
// (src/agent-tool-titles.mjs, through generic-tool-model.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SHOW_RETRY_MS, anyServerRunning, boundsOf, clampLogsHeight, failedServer, fixServerPrompt, isOccluded, logTone, occlusionSamples, pageError, pageRefused, pageServer, previewSurface, stoppedServer, sameBounds, serverErrorText, serverRows, urlParts, viewportLabel } from '../src/preview-model.mjs';
import { appToolCall, appToolLabel } from '../src/agent-tool-titles.mjs';
import { genericToolLabel, genericToolDetails } from '../src/generic-tool-model.mjs';

const state = (patch = {}) => ({ hasPage: false, hostId: null, url: '', error: null, servers: [], launch: { exists: true, configs: [{ name: 'web', port: 3000, url: 'http://localhost:3000', attach: false }] }, viewport: { preset: 'responsive' }, ...patch });

test('urlParts splits host and the rest; files show their name', () => {
  assert.deepEqual(urlParts('http://localhost:5173/a/b?x=1#h'), { host: 'localhost:5173', rest: '/a/b?x=1#h' });
  assert.deepEqual(urlParts('https://example.com/'), { host: 'example.com', rest: '' });
  assert.deepEqual(urlParts('file:///work/app/dist/index.html'), { host: 'index.html', rest: '' });
  assert.deepEqual(urlParts('about:blank'), { host: '', rest: '' });
});

test('server rows merge configurations with live servers', () => {
  const rows = serverRows(state({ servers: [{ name: 'web', port: 3001, url: 'http://localhost:3001', status: 'running' }] }));
  assert.deepEqual(rows, [{ name: 'web', port: 3001, url: 'http://localhost:3001', attach: false, status: 'running', error: null, running: true, busy: false }]);
  assert.equal(serverRows(state())[0].status, 'stopped');
  assert.equal(anyServerRunning(state({ servers: [{ name: 'web', status: 'starting' }] })), true);
  assert.equal(anyServerRunning(state({ servers: [{ name: 'web', status: 'stopped' }] })), false);
});

test('the surface: start page, starting, failure, page, error; a page another pane shows is still the page surface', () => {
  assert.equal(previewSurface(null), 'loading');
  assert.equal(previewSurface(state(), { instanceId: 'a' }), 'start');
  assert.equal(previewSurface(state(), { instanceId: 'a', starting: 'web' }), 'starting');
  const failed = state({ servers: [{ name: 'web', status: 'failed', error: { code: 'exited', message: 'x' } }] });
  assert.equal(previewSurface(failed, { instanceId: 'a', lastStarted: 'web' }), 'failed');
  assert.equal(failedServer(failed, 'web').name, 'web');
  assert.equal(previewSurface(state({ hasPage: true, url: 'http://localhost:3000/' }), { instanceId: 'a' }), 'page');
  assert.equal(previewSurface(state({ hasPage: true, hostId: 'a' }), { instanceId: 'a' }), 'page');
  // 2.2553.1 has no "showing elsewhere" state: a refused pane paints its empty viewport and asks again.
  assert.equal(previewSurface(state({ hasPage: true, hostId: 'b' }), { instanceId: 'a' }), 'page');
  assert.equal(pageRefused(state({ hasPage: true, hostId: 'b' }), 'a'), true);
  assert.equal(pageRefused(state({ hasPage: true, hostId: 'a' }), 'a'), false);
  assert.equal(pageRefused(state({ hasPage: true, hostId: null }), 'a'), false, 'nobody shows it: not refused');
  assert.deepEqual(SHOW_RETRY_MS, [50, 250, 1000]);
  const broken = state({ hasPage: true, url: 'http://localhost:3000/', error: { code: '-102', description: 'ERR_CONNECTION_REFUSED', url: 'http://localhost:3000/' } });
  assert.equal(previewSurface(broken, { instanceId: 'a' }), 'error');
  assert.match(pageError(broken).body, /Nothing is answering at http:\/\/localhost:3000\//);
  assert.equal(pageError(state({ error: { code: 'crashed' } })).title, 'The page stopped working');
});

test('server errors read in plain words; the fix prompt carries the output', () => {
  assert.match(serverErrorText({ code: 'not-found' }, 'web'), /command for web wasn’t found/);
  assert.match(serverErrorText({ code: 'port-in-use', message: 'Port 3000 is already in use.' }), /Port 3000 is already in use/);
  assert.equal(serverErrorText({ code: 'other', message: 'Boom' }), 'Boom');
  const prompt = fixServerPrompt('web', { message: 'exited (code 1)' }, ['line 1', 'Error: missing module']);
  assert.match(prompt, /"web" failed to start with the following error: exited \(code 1\)/);
  assert.match(prompt, /Error: missing module/);
  assert.match(prompt, /call preview_start/);
});

test('log tones, occlusion sampling, bounds and the logs drawer limits', () => {
  assert.equal(logTone('npm ERR! missing script'), 'danger');
  assert.equal(logTone('Build FAILED'), 'danger');
  assert.equal(logTone('warning: deprecated'), 'warning');
  assert.equal(logTone('ready in 300ms'), null);
  const rect = { left: 100, top: 50, right: 500, bottom: 450, width: 400, height: 400 };
  assert.equal(occlusionSamples(rect).length, 9);
  assert.deepEqual(occlusionSamples({ left: 0, top: 0, right: 5, bottom: 5, width: 5, height: 5 }), []);
  const own = { id: 'viewport' }, menu = { id: 'menu' };
  assert.equal(isOccluded(rect, () => own, (element) => element === own), false);
  assert.equal(isOccluded(rect, (x, y) => (x < 120 && y < 70 ? menu : own), (element) => element === own), true, 'a menu over one corner hides the page');
  assert.deepEqual(boundsOf({ left: 10.4, top: 20.6, width: 300.2, height: 199.5 }), { x: 10, y: 21, width: 300, height: 200 });
  assert.equal(sameBounds({ x: 1, y: 2, width: 3, height: 4 }, { x: 1, y: 2, width: 3, height: 4 }), true);
  assert.equal(clampLogsHeight(20, 600), 80);
  assert.equal(clampLogsHeight(1000, 600), 360);
  assert.equal(viewportLabel({ preset: 'mobile', width: 375, height: 812 }), 'Mobile · 375 × 812');
  assert.equal(viewportLabel({ preset: 'responsive' }), 'Responsive');
});

test('app tool rows read as what they did, for every core’s shape', () => {
  const codex = { type: 'mcpToolCall', server: 'code_desktop', tool: 'preview_start', arguments: { name: 'web' }, status: 'inProgress' };
  assert.deepEqual(appToolLabel(codex, 'busy'), { label: 'Starting preview', meta: 'web' });
  assert.deepEqual(appToolLabel(codex, 'done'), { label: 'Started preview', meta: 'web' });
  assert.deepEqual(appToolLabel(codex, 'failed'), { label: 'Couldn’t start preview', meta: 'web' });
  assert.deepEqual(appToolLabel({ type: 'mcpToolCall', server: 'code_desktop', tool: 'screenshot', arguments: {} }, 'done'), { label: 'Captured page', meta: null });
  assert.deepEqual(appToolLabel({ type: 'mcpToolCall', server: 'code_desktop', tool: 'navigate', arguments: { url: 'http://localhost:3000/about' } }, 'done'), { label: 'Opened page', meta: 'localhost:3000' });
  assert.deepEqual(appToolCall({ type: 'dynamicToolCall', tool: 'code_desktop_click', arguments: { ref: 'ref_2' } }), { tool: 'click', args: { ref: 'ref_2' } }, 'OpenCode prefixes the server');
  assert.equal(appToolCall({ type: 'mcpToolCall', server: 'other', tool: 'screenshot' }), null, 'another server’s screenshot is not ours');
  assert.equal(appToolCall({ type: 'mcpToolCall', server: 'code_desktop', tool: 'unknown_tool' }), null);
  assert.deepEqual(genericToolLabel({ type: 'mcpToolCall', server: 'code_desktop', tool: 'read_page', arguments: {}, status: 'completed' }), { label: 'Read page', meta: null });
  assert.deepEqual(genericToolLabel({ type: 'mcpToolCall', server: 'github', tool: 'list_issues', arguments: {}, status: 'completed' }), { label: 'Used github: list issues', meta: null });
  // The terminal and Workflow tools read as what they did (never "Used code_desktop: run in terminal"), in every shape.
  assert.deepEqual(genericToolLabel({ type: 'mcpToolCall', server: 'code_desktop', tool: 'run_in_terminal', arguments: { command: 'npm run dev', title: 'dev' }, status: 'completed' }), { label: 'Ran in terminal', meta: 'npm run dev' });
  assert.deepEqual(genericToolLabel({ type: 'dynamicToolCall', tool: 'code_desktop_read_terminal', arguments: {}, status: 'inProgress' }), { label: 'Reading terminal', meta: null });
  assert.deepEqual(appToolLabel({ type: 'mcpToolCall', server: 'code_desktop', tool: 'list_terminal_tabs', arguments: {} }, 'failed'), { label: 'Failed to list terminal tabs', meta: null });
  const workflow = { type: 'mcpToolCall', server: 'code_desktop', tool: 'Workflow', arguments: { script: 'export const meta = { name: "audit-auth", description: "x" }\nawait agent("go")', args: { depth: 2 } }, status: 'completed' };
  assert.deepEqual(genericToolLabel(workflow), { label: 'Ran workflow', meta: 'audit-auth' });
  assert.deepEqual(appToolLabel({ ...workflow, arguments: { name: 'review-changes' } }, 'busy'), { label: 'Running workflow', meta: 'review-changes' });
  assert.deepEqual(genericToolDetails(workflow).entries.map((entry) => entry.key), ['args'], 'the inline script is not listed as an input');
});

test('a page whose dev server stopped shows "Stopped" with Restart; a running server, another origin or an attach config keep the page', () => {
  const base = { hasPage: true, url: 'http://localhost:5173/app', launch: { exists: true, configs: [{ name: 'web', port: 5173, url: 'http://localhost:5173/' }] } };
  const stopped = { ...base, servers: [{ name: 'web', port: 5173, url: 'http://localhost:5173/', status: 'stopped' }] };
  assert.equal(previewSurface(stopped), 'stopped');
  assert.equal(stoppedServer(stopped).name, 'web');
  assert.equal(previewSurface({ ...stopped, servers: [{ ...stopped.servers[0], status: 'failed' }] }), 'stopped');
  assert.equal(previewSurface({ ...stopped, url: 'http://127.0.0.1:5173/' }), 'stopped', 'loopback hosts are one place');
  assert.equal(previewSurface({ ...stopped, servers: [{ ...stopped.servers[0], status: 'running' }] }), 'page');
  assert.equal(previewSurface({ ...stopped, url: 'http://localhost:3000/' }), 'page');
  assert.equal(previewSurface({ ...stopped, servers: [{ ...stopped.servers[0], attach: true }] }), 'page');
  assert.equal(previewSurface({ ...stopped, hasPage: false }), 'start');
  assert.equal(previewSurface({ ...stopped, url: 'file:///x/index.html' }), 'page');
  // A config that never ran here: only the Restart on a refused page sees it.
  assert.equal(pageServer(base), null);
  assert.deepEqual(pageServer(base, { configs: true }), { name: 'web', port: 5173, url: 'http://localhost:5173/', status: 'stopped' });
  assert.equal(previewSurface(base), 'page');
});
