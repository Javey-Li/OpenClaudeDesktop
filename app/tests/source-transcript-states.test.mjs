import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// SSR of the transcript pane states (approval-entry-current.js _d :1141-1190,
// xu :4211-4217, Cl :4224-4233). Middleware mode only; no browser/Electron/Codex.
let server, M, Status;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  M = await server.ssrLoadModule('/src/source-transcript-states.jsx');
  ({ SourceTranscriptStatus: Status } = await server.ssrLoadModule('/src/source-transcript-status.jsx'));
});
after(() => server?.close());
const count = (html, needle) => html.split(needle).length - 1;

test('skeleton is Zw around k_: padding 48, hold none, bubble bar and O_ paragraphs in order', () => {
  const html = renderToStaticMarkup(React.createElement(M.SourceTranscriptSkeleton));
  assert.match(html, /^<div data-transcript-skeleton="" aria-hidden="true" class="h-full overflow-hidden \[scrollbar-gutter:stable_both-edges\]" style="padding-top:48px"><div class="w-full \[--msg-gap:0px\]">/);
  assert.match(html, /data-cds="SkeletonGroup" data-motion="wave" data-hold="none" data-hold-reason="route" data-shown=""/);
  assert.match(html, /class="text-prose flex flex-col fade-out-bottom h-\[calc\(100vh-12.5rem\)\]"/);
  assert.match(html, /<div data-testid="chat-message-skeleton" class="contents"><div class="mt-\[var\(--msg-gap,1.5rem\)\] flex shrink-0 justify-end"><div data-cds="Skeleton" class="[^"]*box-content h-\[1lh\] w-72 max-w-\[85%\] rounded-card py-md text-heading"/);
  assert.match(html, /<div class="mt-xs mb-xs h-6 shrink-0"><\/div><div class="flex shrink-0 flex-col gap-\[0.75em\] pl-\[var\(--msg-text-inset,0.5rem\)\] pr-\[var\(--msg-inset-end,0.5rem\)\]">/);
  assert.match(html, /<div class="mt-xs h-6 shrink-0"><\/div><\/div><\/div><\/div><\/div><\/div>$/);
  assert.equal(count(html, 'data-cds="Skeleton"'), 11);
  assert.equal(count(html, '<div class="flex flex-col">'), 3);
  assert.equal(count(html, 'class="flex h-[1lh] items-center"'), 10);
  // Line widths in DOM order are O_ flattened (ion-dist shared-8-B5xbG2px.js).
  const widths = [...html.matchAll(/class="max-w-full rounded bg-\[var\(--cds-skeleton-base\)\] h-\[0\.72em\] (w-[^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(widths, ['w-[96%]', 'w-full', 'w-[92%]', 'w-[58%]', 'w-full', 'w-[94%]', 'w-[41%]', 'w-[97%]', 'w-[90%]', 'w-[66%]']);
  assert.deepEqual(M.SKELETON_PARAGRAPHS.map(p => p.length), [4, 3, 3]);
  // The group branch of gc has no shimmer ::after and no per-bar role.
  assert.doesNotMatch(html, /after:animate|role="status"[^>]*data-cds="Skeleton"/);
  // hc wave: --cds-skel-i in DOM order modulo floor(2000/90)=22.
  assert.deepEqual([...html.matchAll(/--cds-skel-i:(\d+)/g)].map(m => +m[1]), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.match(renderToStaticMarkup(React.createElement(M.SourceTranscriptSkeleton, { hasEarlier: true })), /style="padding-top:88px"/);
});

test('EmptyState u classes; load failure is role=alert with the source copy and a primary Retry', () => {
  const html = renderToStaticMarkup(React.createElement(M.SourceTranscriptLoadFailure, { onRetry() {} }));
  assert.match(html, /^<div role="alert" class="flex h-full flex-col items-center justify-center gap-md px-lg py-lg text-center source-empty-state"><div class="flex flex-col items-center gap-1"><p class="max-w-\[36ch\] break-words text-body text-primary">Couldn’t load this session<\/p><p class="max-w-\[36ch\] break-words text-footnote text-muted">Something went wrong while loading earlier messages\.<\/p><\/div><div class="flex flex-wrap items-center justify-center gap-1"><button type="button" data-cds="Button" data-variant="primary"/);
  assert.match(html, />Retry<\/span><\/button><\/div><\/div>$/);
  assert.equal(M.LOAD_FAILURE_TITLE, 'Couldn’t load this session');
  assert.doesNotMatch(html, /fixture resume failure/);
});

test('Retry button calls onRetry exactly as passed', () => {
  const calls = [];
  const onRetry = () => calls.push('retry');
  const tree = M.SourceTranscriptLoadFailure({ onRetry });
  assert.equal(tree.props.role, 'alert');
  assert.equal(tree.props.actions.props.variant, 'primary');
  tree.props.actions.props.onClick();
  assert.deepEqual(calls, ['retry']);
});

test('empty transcript renders only the "No messages yet" title', () => {
  const html = renderToStaticMarkup(React.createElement(M.SourceTranscriptEmpty));
  assert.equal(html, '<div class="flex h-full flex-col items-center justify-center gap-md px-lg py-lg text-center source-empty-state"><div class="flex flex-col items-center gap-1"><p class="max-w-[36ch] break-words text-body text-primary">No messages yet</p></div></div>');
});

test('skeleton bubble bar keeps the source content-box sizing over the local border-box reset', async () => {
  const fs = await import('node:fs/promises');
  const css = await fs.readFile(path.resolve(import.meta.dirname, '../src/source-transcript-states.css'), 'utf8');
  // shared-8 k_ box-content bubble: 1lh + 2 x pad-md. style.css `* { box-sizing: border-box }`
  // is unlayered and would beat the layered .box-content utility.
  assert.match(css, /\[data-transcript-skeleton\] \.box-content \{\s*box-sizing: content-box;\s*\}/);
});

// Y5 (scroll-messages-current.js:58637-58668): while thinking is active and a
// toggle exists the status label is a shimmering button; "Thought for Ns" is a
// plain span without shimmer.
test('thinking status: a show/hide-in-transcript button while active, a plain span when done', () => {
  const thinking = { id: 'r', turnId: 'turn', type: 'reasoning', summary: [] };
  const base = { sessionKey: 'a', turnId: 'turn', ready: true, connected: true, running: true, items: [thinking], itemPhases: { r: 'streaming' } };
  const render = extra => renderToStaticMarkup(React.createElement(Status, { ...base, ...extra }));
  const shown = render({ onToggleThinking() {} });
  assert.match(shown, /<button aria-label="Thinking…, show in transcript" type="button" class="source-shimmer sts-activity sts-thinking-toggle">Thinking…<\/button>/);
  assert.match(render({ onToggleThinking() {}, thinkingShown: true }), /<button aria-label="Thinking…, hide from transcript"/);
  // No toggle (Verbose), or a running tool: the plain label.
  const plain = render({});
  assert.doesNotMatch(plain, /<button/); assert.match(plain, /<span class="source-shimmer sts-activity">Thinking…<\/span>/);
  const tool = { id: 'c', turnId: 'turn', type: 'commandExecution', status: 'inProgress' };
  assert.doesNotMatch(render({ items: [thinking, tool], onToggleThinking() {} }), /sts-thinking-toggle/);
  // Done: the thought ended just now (lifecycle times) and the answer has not started.
  const now = Date.now();
  const ended = { ...thinking, startedAtMs: now - 4400, completedAtMs: now - 100 };
  const done = renderToStaticMarkup(React.createElement(Status, { ...base, items: [ended], itemPhases: { r: 'completed' }, onToggleThinking() {} }));
  assert.match(done, /aria-label="Thought for 4s"><span class="sts-activity">Thought for 4s<\/span><\/span>/);
  assert.doesNotMatch(done, /<button|source-shimmer sts-activity/);
  // A short thought that just ended is still shown as active (the 2s minimum).
  const brief = { ...thinking, startedAtMs: now - 600, completedAtMs: now - 100 };
  assert.match(renderToStaticMarkup(React.createElement(Status, { ...base, items: [brief], itemPhases: { r: 'completed' }, onToggleThinking() {} })),
    /<button aria-label="Thinking…, show in transcript"/);
  // Long after the thought: no thinking label at all.
  const old = { ...thinking, startedAtMs: now - 60000, completedAtMs: now - 50000 };
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(Status, { ...base, items: [old], itemPhases: { r: 'completed' }, onToggleThinking() {} })), /Thought for|Thinking…/);
});
