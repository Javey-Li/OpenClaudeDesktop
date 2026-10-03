import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// R09 Plan pane (2.2553.1 readable/panes-tile-current.js kp :1751-1790, Dp :1716-1750, Op, Mp :1830-1866):
// the proposed plan document (state.planDocs) in the 68ch column, the Tasks section after it when todos exist,
// and the header "Copy plan" button while a document exists. Middleware-mode Vite SSR.
let server, S, P, C;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  S = await server.ssrLoadModule('/src/source-session.jsx');
  P = await server.ssrLoadModule('/src/source-plan-pane.jsx');
  C = await server.ssrLoadModule('/src/source-pane-controls.jsx');
});
after(() => server?.close());
const h = React.createElement;
const text = (markup) => markup.replace(/<[^>]+>/g, '');
const controls = ({ menuSections, leading }) => h(C.SourcePaneControls, { tileId: 'plan', paneName: 'Plan', layout: 'right',
  menuSections, leading, onToggleExpand: () => {}, onClose: () => {} });
const panel = (props) => renderToStaticMarkup(h(S.SourceFilePanel, { sessionId: 's', cwd: '/tmp/work', tab: 'plan', paneControls: controls, ...props }));
const DOCUMENT = '# Plan heading\n\nInspect the parser, then fix it.\n';
const TODOS = [{ step: 'Inspect the parser', status: 'completed' }, { step: 'Fix it', status: 'inProgress' }];

test('document and todos: the Markdown heading renders in the Prose column before the "Tasks" h2', () => {
  const markup = panel({ plan: TODOS, planDocument: DOCUMENT });
  const body = markup.slice(markup.indexOf('</header>'));
  assert.match(body, /<div class="h-full select-text overflow-y-auto \[contain:strict\] \[scrollbar-gutter:stable_both-edges\] p-lg source-plan" data-plan-document=""><div class="mx-auto max-w-\[68ch\]"><div data-cds="Prose" data-prose-font="sans" data-size="sm" class="prose source-plan-document"><div class="source-markdown">/);
  const heading = body.indexOf('<h1>Plan heading</h1>'), tasks = body.indexOf('>Tasks</h2>');
  assert.ok(heading > 0, 'the document heading renders');
  assert.ok(tasks > heading, 'Tasks follows the document');
  assert.match(body, /<section class="mt-pad-lg source-plan-tasks"><h2 class="text-caption-medium uppercase tracking-wide text-muted mb-1\.25">Tasks<\/h2>/);
  assert.match(text(body), /Inspect the parser, then fix it\./);
  assert.doesNotMatch(body, /No plan yet/);
});

test('document only: no Tasks section; todos only: Tasks and no document', () => {
  const documentOnly = panel({ plan: [], planDocument: DOCUMENT });
  assert.match(documentOnly, /<h1>Plan heading<\/h1>/);
  assert.doesNotMatch(documentOnly, /Tasks<\/h2>|source-plan-tasks|No plan yet/);
  const todosOnly = panel({ plan: TODOS, planDocument: null });
  assert.match(todosOnly, /<div class="h-full select-text overflow-y-auto \[contain:strict\] \[scrollbar-gutter:stable_both-edges\] p-lg source-plan"><div class="mx-auto max-w-\[68ch\]"><section class="mt-pad-lg source-plan-tasks">/);
  assert.doesNotMatch(todosOnly, /source-plan-document|data-plan-document/);
  const neither = panel({ plan: [], planDocument: null });
  assert.match(text(neither), /No plan yet/);
});

test('"Copy plan": a ghost icon-only Copy button leads the Plan trailing controls only while a document exists', () => {
  const markup = panel({ plan: TODOS, planDocument: DOCUMENT });
  const header = markup.slice(markup.indexOf('<header'), markup.indexOf('</header>'));
  const button = header.match(/<button[^>]*aria-label="Copy plan"[^>]*>/)?.[0];
  assert.ok(button, 'Copy plan in the header');
  assert.match(button, /class="source-icon-button spc-ghost"/);
  assert.doesNotMatch(button, /title=/);
  assert.ok(header.indexOf('class="spc-controls"') < header.indexOf('aria-label="Copy plan"'), 'inside the trailing cluster');
  assert.ok(header.indexOf('aria-label="Copy plan"') < header.indexOf('aria-label="Close panel"'));
  assert.doesNotMatch(panel({ plan: TODOS, planDocument: null }), /Copy plan/, 'no document, no Copy plan (Mp returns null)');
  assert.deepEqual(P.PLAN_COPY_LABELS, { copy: 'Copy plan', copied: 'Copied' });
  const src = fs.readFileSync(path.resolve(import.meta.dirname, '../src/source-plan-pane.jsx'), 'utf8');
  assert.match(src, /<Icon name=\{copied \? "Check" : "Copy"\} size=\{16\} \/>/);
  assert.match(src, /controller\.current\?\.setText\(document \?\? ""\)/);
});

test('wiring: planDocs gate the Plan row, /plan and the popout sync; the pane gate takes todos or a document', () => {
  const main = fs.readFileSync(path.resolve(import.meta.dirname, '../src/main.jsx'), 'utf8');
  assert.match(main, /\.\.\.\(\(state\.plans\[current\]\?\.length \|\| state\.planDocs\?\.\[current\] \|\| openPanes\.has\("plan"\)\) \? \[\{kind: "plan", label: "Plan", icon: "Checklist"\}\] : \[\]\)/);
  assert.match(main, /hasPlan:!!\(state\.plans\[current\]\?\.length\|\|state\.planDocs\?\.\[current\]\)/);
  assert.match(main, /data: \{ plan: state\.plans\[entry\.sessionId\] \?\? null, document: state\.planDocs\?\.\[entry\.sessionId\] \?\? null \}/);
  assert.match(main, /planDocument=\{state\.planDocs\?\.\[current\] \?\? null\}/);
  assert.match(main, /planDocument=\{plan\?\.document \?\? null\}/);
  const session = fs.readFileSync(path.resolve(import.meta.dirname, '../src/source-session.jsx'), 'utf8');
  assert.match(session, /tab === "plan" && \(plan\?\.length \|\| planDocument\) \?/);
  const pane = fs.readFileSync(path.resolve(import.meta.dirname, '../src/source-plan-pane.jsx'), 'utf8');
  assert.doesNotMatch(pane, /Codex has no plan document/);
});
