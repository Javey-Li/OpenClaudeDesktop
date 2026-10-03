# Restore batches log

## B01

Snapshot: work/restore-batches/snapshots/B01 (taken before any edit).

### What changed
- harness/packages/codex-app-server/src/projection.js
  - New exported `LiveStreamMapper({threadId, projector})` with `frame(frame, nowMs)` → notes and `endTurn(dshTurn)`. It is the former LiveThread.onStream/emitStart logic, unchanged: retry reset, ensureTurn when the turn has no id, abandoned/attempt end clears items.
  - NEW: `block-end` of a known reasoning/text block emits `item/completed` (reasoning `{summary:[text], content:[]}`, agentMessage `{text,…}`), completedAtMs = nowMs. Tool-call blocks are ignored.
  - The abandoned-attempt reasoning body now carries `reasoningText: ''`.
  - ThreadProjector:
    - tracks `approval/asked` (id → callId) and `approval/decided` 'rejected' → `rejectedCalls`;
    - tool/result passes `error: data.error` and `rejected` to completeToolItem;
    - `lastUsageTurnId` is recorded with lastUsage;
    - the turn/end sweep settles leftover inProgress items as 'interrupted' for interrupted turns, else 'failed'.
  - completeToolItem:
    - AbortError (data.error.name, or the exact 'Error: tool call aborted[ before dispatch]' text) → 'interrupted' with no error body. Per type: command output/exitCode null; fileChange/webSearch status only; mcp result/error null; dynamic contentItems [] and success null.
    - A rejected call → 'declined' for commandExecution (output/exitCode null) and fileChange (no error). Other types stay failed.
    - Read card: built from `view.lines` as `N: text`, otherwise readBody(view.content). The no-view fallback uses the same readBody. readBody strips the dsh-tool-fs `<path>/<type>/<content>` envelope and the footer (End of file | File has | Showing | Output capped | Output truncated).
    - webSearch: status completed/failed. results = sources (search view) / raw text (openPage) / null. A failure sets error {message}.
  - toolItem: the web_search/web_fetch/kind 'fetch' branch now comes before the code-search branch. The search branch is restricted to grep, glob, or kind 'search' without `queries`. Glob → `{type:'search', command, query: pattern, path}`. webSearch starts `status:'inProgress'`.
- harness/packages/codex-app-server/src/index.js
  - LiveThread owns `this.stream = new LiveStreamMapper(...)`. onStream returns while hydrating, otherwise maps the frame (try/catch + warn, like onEvent) and notifies each note. turn/end calls `stream.endTurn`. The `streams` map and emitStart are removed.
  - thread/resume: `setImmediate` after the response replays `thread/tokenUsage/updated` (turnId = lastUsageTurnId ?? last turn) and `turn/plan/updated`. It is skipped when the thread is closing and guarded by try/catch.
- app/src/transcript-runtime-stats.mjs: turnActivityLabel returns the thinking ladder only when the LAST live item of the turn is reasoning. Compaction and tools precedence are unchanged.
- app/src/generic-tool-model.mjs: webSearch output formats a list of web sources as `title||url\nurl[\nsnippet (publishedAt)]`, with entries separated by a blank line. String results pass through. Any other shape stays JSON.
- Tests:
  - harness/tests/projection.test.mjs: line-60 expectation → 'interrupted'; 9 new tests (a–g of the spec plus retry/ensureTurn bookkeeping and a test against the installed dsh-tool-web / dsh-tool-fs-search presenters).
  - app/tests/transcript-runtime-stats.test.mjs: thinking-ladder cases through the real reducer, and resume usage → next-turn baseline and context ring.
  - app/tests/generic-tool-model.test.mjs, file-tool-model.test.mjs, command-row-model.test.mjs, tool-group-presentation.test.mjs: one new test each.
- harness/tests/live-smoke.mjs: a cold-resume step after the main flow. It starts a fresh core, sends thread/resume on the smoke thread and prints the replayed usage and wire order. It makes no extra model calls.
- harness/README.md: mapping rows for streaming, glob/grep/abort/deny and the resume replay.

### Tests run
- `cd harness && node --test tests/*.test.mjs`: 15/15 pass (projection suite; was 6).
- `cd app && node --test tests/transcript-runtime-stats.test.mjs tests/generic-tool-model.test.mjs tests/file-tool-model.test.mjs tests/command-row-model.test.mjs tests/tool-group-presentation.test.mjs`: 46/46 pass.
- `cd app && npm test`: 1154 tests, 1153 pass, 1 pre-existing skip, 0 fail (baseline 1148 plus 6 new).
- `npm run build`, then the offscreen suites run-command (covers the reasoning activity label) and transcript-states: both passed.
- `cd harness && node tests/live-smoke.mjs` (1 run):
  - turn 1 Read row output is `1: CODE_DESKTOP_SMOKE_OK` (no footer);
  - the Ask-mode write approval ran and both turns completed;
  - the cold resume printed `RESUME USAGE {turnId = last turn, context 9426, window 1000000}` and `RESUME ORDER usage after response`.
- `work/deepseek-live-20261001/live.mjs b01` (1 run, b01-mupe88a6): no renderer errors. 03a-streaming.png shows "Working…" under the half-written answer; it used to show "Thinking…" (first-mupaykl9/03a).

### Deviations from the spec
- Read fallback: the spec only strips the footer. In the real dsh-tool-fs raw text the footer sits inside `<content>…</content>`, so a `$`-anchored footer regex never matched. The fallback now also unwraps the envelope. The footer regex also accepts a footer-only body (an empty read window).
- generic-tool-model: lists are formatted only when EVERY entry is a plain web source (string url plus optional string title, snippet or publishedAt). Entries with other fields stay JSON. This keeps Codex's "opaque JSON results" contract and the existing `newField` test. publishedAt is shown in parentheses after the snippet, as dsh formatSearchOutput does.
- Abort and reject handling require `isError` (an AbortError result is always isError, and a successful result cannot be a rejected call). Aborted mcp and dynamic items keep durationMs. A failed webSearch has results null.
- completedAtMs for block-end uses the caller's nowMs (Date.now() at receipt), as the instructions say. Chunk frames also carry `frame.time`, which is unused.
- The resume-usage reducer test lives in transcript-runtime-stats.test.mjs, not state.test.mjs. command-row-model already asserted declined→denied and interrupted→stopped, so the new test pins the bridge-shaped items (null output) instead.

### Remaining gaps
- The resume replay in index.js has no unit test, because index.js binds stdio. The live-smoke cold-resume step covers usage only. The plan replay path has not been exercised live, because the smoke session has no todo_write.
- Every streamed text/reasoning block now gets two item/completed notifications (block-end, then the committed assistant/message). The reducer merges by id and activity.cjs dedups by id. Visible in the smoke's AGENT TEXT, which has the reply twice.
- web_fetch `results` is a string, while Codex types it as `Array<JsonValue> | null`. Code Desktop handles it, but other Codex clients would not expect it.
- web_search with no presentation meta (definition unavailable) shows no results body. The spec chose null over the raw text.
- Rejected MCP and dynamic calls still read as failed, because Codex has no declined status for them. Approval outcomes 'unavailable', and 'cancelled' without a turn cancel, still render as failed.
- Glob rows now group under "Searched code" instead of the listFiles category. The spec intends this (source Glob label), but it changes group summaries for existing DeepSeek sessions on replay.

## B02

Snapshot: work/restore-batches/snapshots/B02 (taken before any edit).

### What changed
- harness/packages/codex-app-server/src/projection.js
  - `compaction/start` with no open (non-synthetic) turn opens a synthetic turn `{dsh:null, id:'turn-c<compactionId>', synthetic:true}`. It becomes `current`, goes into `turns`, sets `lastSyntheticCompactionTurnId`, and emits turn/started then item/started (contextCompaction). Compaction inside a real turn behaves as before.
  - `compaction/end` on a synthetic turn:
    - no `error`: item/completed, then turn/completed 'completed';
    - an error matching /\b(abort|cancel|interrupt)/i: turn/completed 'interrupted';
    - any other error: 'failed' with error `Compaction failed: <error>`.
    A failed or stopped compaction emits no item/completed. The app settles the open item from the turn outcome, so live and history both read "Compaction interrupted".
  - New methods:
    - `closeTurn`;
    - `closeSynthetic(turnId, status, error, time)`, which returns [] once the turn is settled;
    - `settleStaleCompaction()`.
    A synthetic turn left open is closed as interrupted by the next `turn/start`, by a new manual compaction, at LiveThread.hydrate, and after a cold historyFor replay. A user/message that arrives while a synthetic turn is current is held for the next turn.
- harness/packages/codex-app-server/src/compact.js (new): `runCompact({execute, signal, threadId, notify, openedTurnId, closeOpened, newTurnId, now})` returns `{turnId, opened, status, error}`.
  - Outcome:
    - aborted → interrupted;
    - a throw, undefined, or `result.kind==='error'` → failed (result.text or errorChain);
    - otherwise completed.
  - When the projector opened a turn, `closeOpened` is always called; it is a no-op when compaction/end already settled the turn. Otherwise it synthesizes `turn-compact-<uuid>` turn/started plus turn/completed.
- harness/packages/codex-app-server/src/queue.js (new):
  - `toQueuedSubmission` and `reorderedMessages` (invalidParams unless the ids are an exact permutation).
  - `ThreadQueue` class:
    - `add`: followup, and remembers `{input, clientUserMessageId}`;
    - `list`: nextTurn, pruning stale remembered entries;
    - `delete`/`update`: -32602 'That queued message already started.' when the id is not in nextTurn; update moves the remembered entry to the replacement id;
    - `reorder`: no splice when the order is unchanged;
    - `start`: steer when running, otherwise wake the parked queue;
    - `interrupt`: `cancel({kind:'user'}, {keepInbox: nextTurn.length>0})`; when kept, it clears next-step, waits for whenIdle(), then resubmits the parked queue;
    - `claimed`, `changed`: thread/queue/changed coalesced to one notification per microtask.
- harness/packages/codex-app-server/src/index.js:
  - LiveThread gets `queue` (ThreadQueue) and `compaction`. status() reports active while a compaction runs. close() closes the queue and aborts the compaction.
  - Subscribes to agent/inbox/inserted|discarded (queue.changed) and agent/inbox/claimed (queue.claimed).
  - `thread/compact/start`:
    - rejects with -32600 {codexErrorInfo:'activeTurnNotSteerable'} when the agent is running, a turn is active, or a compaction is set;
    - otherwise sets `thread.compaction={controller, startedTurn}`, publishes status, and runs runCompact in setImmediate (after the {} response line) with `commands.execute(agent,'/compact',[],signal)`;
    - after a real, completed compaction it notifies thread/tokenUsage/updated (measured context);
    - finally it clears the compaction and publishes status.
  - `turn/interrupt` aborts the compaction first (reason Error 'Compaction interrupted.', name AbortError), then calls `queue.interrupt()`. The approval 'cancel' decision also goes through `queue.interrupt()`.
  - `turn/steer` refuses a compaction turn with activeTurnNotSteerable.
  - `thread/close` and `thread/unsubscribe` do not close a thread while a compaction runs.
  - New thread/queue/add|list|delete|update|reorder|start cases. list returns empty for a thread that is not live, and the method is removed from the empty-list group.
- harness/README.md: mapping rows for thread/compact/start (synthetic `turn-c…` turn) and thread/queue/*; thread/queue/* removed from 未实现; new limitation line for the "nothing to compact" case; file table entries.
- harness/tests: new compact.test.mjs (5) and queue.test.mjs (8); 3 new compaction cases in projection.test.mjs. live-smoke.mjs adds:
  - a queue step (queue/add during a running turn → it runs as the next turn);
  - a compact step (wire order and terminal turn).
- app/electron/main.cjs case 'rpc': a client.request error with a numeric `code` is returned as `{__codeDesktopRpcError:{message, code, data}}`. Allowlist, validation and timeout errors still throw.
- app/src/rpc-error.mjs (new) `rpcResult`. app/src/main.jsx: `rpc` is `call("rpc",…).then(rpcResult)`, the only renderer rpc site; thread-history-model receives this rpc.
- app/tests: new rpc-error.test.mjs (2); session-operations.test.mjs gets a DeepSeek compact case (completed and failed synthetic turns release the lock); queued-messages-model.test.mjs gets the bridge queue shape ('[Image]' preview, null client id) and the steer refusals.

### Tests run
- `cd harness && node --test tests/compact.test.mjs tests/queue.test.mjs tests/projection.test.mjs`: 31/31 pass. This is the whole harness suite.
- `cd app && node --test tests/rpc-error.test.mjs tests/session-operations.test.mjs tests/queued-messages-model.test.mjs tests/state.test.mjs`: 43/43 pass.
- `cd app && npm test`: 1158 tests, 1157 pass, 1 pre-existing skip, 0 fail (B01 left 1154; 4 new).
- `npm run build`, then the offscreen suites composer-states (steer→queue fallback) and session-actions (compact UI): both passed.
- Offline bridge check (scratch script, no model calls): compact on an empty thread gives status active → turn-compact-… started/completed 'completed' → idle. Steer with no turn gives -32600 activeTurnNotSteerable. queue delete and reorder with bad ids give -32602.
- `cd harness && node tests/live-smoke.mjs` (1 run):
  - turns 1 and 2 unchanged;
  - QUEUE ADD/LIST return the original input and clientUserMessageId 'smoke-queued-1';
  - the queued prompt ran as the next turn (`turn-<queued id>`, reply "BRAVO") and the queue is then empty (thread/queue/changed ×3);
  - COMPACT wire: status:active, turn/started, item/started:contextCompaction, item/completed:contextCompaction, turn/completed (turn-c…, completed, ~3.8s), status:idle;
  - thread/read shows 5 turns, the last one `turn-c…:completed:contextCompaction`;
  - cold resume context 5929 (it was 9598 before the compaction).
- `work/deepseek-live-20261001/live.mjs b02` (1 run, b02-mupf7ubh, PROMPTS = read file, `/compact`, "Reply with only the word DONE."):
  - no renderer errors;
  - 03b shows the "Compacted conversation" row and the "Conversation compacted" banner;
  - the next prompt was accepted and answered "DONE", so the lock was released.

### Deviations from the spec
- The spec cites analysis/codex-protocol/v2/ThreadQueue*Params/Response.ts, but those files do not exist (only QueuedSubmission.ts and ThreadQueueChangedNotification.ts). The shapes come from the main.cjs:101-110 comment and the Codex fixture server: add/update return {queuedSubmission}, the other methods return {}.
- Queue state lives in a `ThreadQueue` (queue.js) that owns the remembered map, instead of `LiveThread.queued` plus inline handlers. This keeps the add/list/delete/update/reorder/start/interrupt logic unit-testable; index.js only dispatches. `add` and `update` await inputMessage, so B10's async inputMessage needs no queue change.
- thread/queue/changed is coalesced per microtask instead of "each mutation notifies" plus every inbox event. Otherwise one add would notify twice and a reorder splice (n discarded + n inserted events) 2n+1 times.
- turn/interrupt: the spec assumes the kept next-turn starts by itself after `cancel(..., {keepInbox:true})`. In dsh-agent-loop the aborted turn() rethrows, kick() exits, and only a wake after the abort sets wakeRequested, so kept items stay parked. ThreadQueue.interrupt therefore waits for whenIdle() and resubmits them in order (splice them out, then followup each). This gives the Codex behaviour the fixture models: the next queued turn runs after Stop. thread/queue/start while idle uses the same resubmit, where the spec has a no-op (followup does not re-wake parked items).
- Compaction lifecycle:
  - runCompact always calls closeOpened. The spec says "do nothing" for completed; closeOpened is a no-op when the turn is settled and closes it otherwise.
  - runCompact starts in setImmediate, so the {} response precedes turn/started.
  - A failed or stopped synthetic compaction emits no item/completed. The app's reducer would otherwise show "Compacted conversation" live and "Compaction interrupted" on replay.
  - compaction/end only carries errorChain text, so failure versus abort is classified by text. The bridge aborts with 'Compaction interrupted.' before agent.cancel, so AbortSignal.any keeps that reason instead of `{kind:'user'}` ("[object Object]").
- Additions beyond the spec:
  - turn/steer refuses compaction turns (Codex NonSteerableTurnKind 'compact');
  - stale synthetic turns are settled;
  - close/unsubscribe wait out a running compaction;
  - the approval 'cancel' decision keeps the queue;
  - thread/tokenUsage/updated is sent after a real compaction (context ring drops at once).
- RPC passthrough: the steer IPC case already returned error.data, so the steer→queue fallback at main.jsx:1233 already worked for turn/steer. The new passthrough covers every other rpc error: codes and data now reach the renderer, and the Electron "Error invoking remote method" prefix is gone from those messages.

### Remaining gaps
- "No compactable history yet." is a success from Harness. It ends as an empty completed `turn-compact-…` turn: the banner says "Conversation compacted" and the turn is not in history.
- Abort classification of compaction/end relies on the error text. An adapter abort message without abort/cancel/interrupt wording would show as failed. Stopping a running compaction was only unit-tested, not live.
- index.js wiring (compact/start, queue handlers, inbox subscriptions, interrupt) has no unit test because apply binds stdio. It is covered by the live smoke, the live app run and the offline check. The post-compaction tokenUsage notification was added after the live-smoke run; only the live app run exercised it (no errors), and nothing asserts it.
- The interrupt → resume-queue path is not exercised live. Its resubmit logs 'canceled' inbox splices that the official DSH app may show.
- After a core restart, queued entries rebuild input from message text, so images are marker text with no '[Image]' preview (B10's toCodexInputs). Messages that reach next-turn through turn/start list with clientUserMessageId null.
- close()/quiesce still cancels without keepInbox, so queued prompts are dropped when the core stops (unchanged).
- Automatic (in-turn) compaction failures still emit item/completed (spec: keep the in-turn behaviour).
- The follow-up "empty composer ↑ pulls back the last queued message" (source-composer.jsx) is not implemented; it was not in this batch's instructions.

## B03

Snapshot: work/restore-batches/snapshots/B03 (taken before any edit).

### What changed
- harness/packages/codex-app-server/src/errors.js (new):
  - `threadNotFound(id)` → RpcError(-32602, 'This session is not available in DeepSeek Harness.', {codexErrorInfo:'threadNotFound', threadId});
  - `isThreadNotFound`; `inCauseChain(error, predicate)` (cycle-safe; B09's isSessionOwnedElsewhere can reuse it);
  - `isSessionNotFound`: code SESSION_QUERY_SESSION_NOT_FOUND or name SessionPersistenceNotFoundError anywhere in the cause chain;
  - `requireSession(id, read)`: runs one read, maps not-found failures and an empty result to threadNotFound, rethrows everything else.
- harness/packages/codex-app-server/src/index.js:
  - `CAPABILITIES = {unsupportedMethods:['thread/fork','review/start','thread/revert']}`, returned as `capabilities` by initialize.
  - historyFor wraps the sessionQuery.readSession / persistence read in requireSession (no snapshot.session → threadNotFound).
  - openThread: stat without header → threadNotFound; the agents.resume call is wrapped too (log removed between stat and resume).
  - thread/unarchive: reads first and rethrows threadNotFound (no store update, no thread/unarchived), other read failures still return {}.
- app/electron/main.cjs: `coreInfo(owner)` = {engine (default 'codex'), engineVersion, capabilities ({}), configPath} from client.serverInfo; connect() puts it in `initial.core`; `connectionEvent(owner, status)` adds `core` to connected status events (both status listeners).
- app/src/session-engine-model.mjs (new, pure): `sessionEngine(meta)`, `coreEngine(core)`, `partitionSessions({ids, results, metadata, archivedIds, engine})` → {active, archived, otherEngine, missing} (counts), `hiddenSessionsNotice(hidden, engine)`.
- app/src/main.jsx:
  - `engine = coreEngine(boot?.core)`; commandContext.unsupportedMethods from boot.core.capabilities;
  - loadSessions uses partitionSessions, keeps `hiddenSessions` {otherEngine, missing} in state, prunes tile layouts against every remembered id (own + archived) instead of only the listed ones;
  - the connection event keeps boot.core and refreshes it when the event carries one;
  - SourceSidebar gets engine, hiddenSessions and forkUnavailable (`unsupportedCommand('fork')`); sessionAction('fork') refuses with the same reason;
  - the main.jsx delete dialog passes {engine}.
- app/src/source-sidebar.jsx:
  - deleteConfirmCopy(sessions, {engine}) / olderConfirmCopy(action, count, {engine}) (now exported): DeepSeek ('deepseek' or 'deepseek-harness') gets the Remove copy from the spec, danger kept; Codex strings unchanged;
  - bulk status/failure lines say "Removed N sessions" / "couldn’t be removed" on DeepSeek;
  - one muted notice `<p class="source-sidebar-no-match source-sidebar-hidden-notice" data-sidebar-notice="hidden-sessions">` as the first child of the session list;
  - SourceSidebarSessionMenu `forkUnavailable` takes precedence over the running/archived fork reasons.
- app/src/source-sidebar.css: `.source-sidebar-hidden-notice` (line-height 16px, overflow-wrap anywhere).
- app/src/session-command-model.mjs: `COMMAND_METHODS`, exported `unsupportedCommand(id, context)`; commandUnavailable checks it first ('Not available with the DeepSeek core yet'). The titlebar menu, slash menu (matchCommands), /review dialog and /rewind already gate on commandUnavailable through executeCommand, so they needed no change.
- harness/README.md: initialize/capabilities/boot.core row, unknown-id → threadNotFound row, limitations (fork/review/revert surfaced as unsupported, hidden Codex sessions, Remove copy), errors.js in the file table.
- Tests: harness/tests/errors.test.mjs (5, using the installed SessionQueryError / SessionPersistenceNotFoundError and a real LineTransport); app/tests/session-engine-model.test.mjs (4); session-command-model.test.mjs (+1); source-sidebar-states.test.mjs (+3: delete/older copy, notice, row-menu Fork reason).
- harness/tests/live-smoke.mjs: a NOT FOUND step after INIT (thread/read and thread/resume of a Codex-style id, prints code/data and any stderr line naming the id). No model calls.
- work/deepseek-live-20261001/live.mjs: optional PREFERENCES env (JSON merged into the seeded profile), report.sidebarNotice at 01-home, per-step `alerts` ([role=alert] texts).

### Tests run
- `cd harness && node --test tests/errors.test.mjs tests/projection.test.mjs`: 23/23 pass.
- `cd harness && node --test tests/*.test.mjs`: 36/36 pass.
- `cd app && node --test tests/session-engine-model.test.mjs tests/source-sidebar-states.test.mjs tests/session-command-model.test.mjs tests/sidebar-model.test.mjs`: 41/41 pass.
- `cd app && npm test` (after the last edit): 1166 tests, 1165 pass, 1 pre-existing skip, 0 fail (B02 left 1158; 8 new).
- `npm run build`, then offscreen suites (Codex fixtures): sidebar-rest (source delete copy, run before and after the final edits), slash-commands-complete, session-actions, connection-lifecycle: all passed.
- `cd harness && node tests/live-smoke.mjs` (1 run): INIT carries `capabilities:{unsupportedMethods:[thread/fork, review/start, thread/revert]}`; thread/read and thread/resume of `01a0d269-…c0de` → `-32602 {"codexErrorInfo":"threadNotFound","threadId":…}`; no stderr line naming the id; turns 1/2, queue, compact and cold resume unchanged from B02.
- `live.mjs b03` (1 run, b03-mupg647w; PREFERENCES = 2 Codex ids + 1 archived Codex id with cliVersion 0.155.1/openai metadata + 1 id without metadata; PROMPTS = "Reply with only the word OK.", "/rewind"):
  - no renderer errors; reply "OK";
  - 02b/03b show the notice "3 Codex sessions aren’t available with the DeepSeek core. Start Code Desktop with CODE_DESKTOP_CORE=codex to open them. 1 session could not be loaded." above the list, with only the new DeepSeek session listed;
  - "/rewind" → alert "Not available with the DeepSeek core yet";
  - the profile's preferences.json still holds all seeded ids and metadata afterwards.

### Deviations from the spec
- Notice copy: n = 1 reads "1 Codex session isn’t available … to open it." (the spec template gives "1 … session aren’t"). Under the Codex core, DeepSeek-tagged ids get a symmetric line ("N DeepSeek sessions aren’t available with the Codex core. Start Code Desktop without CODE_DESKTOP_CORE=codex …"); fixtures carry no cliVersion, so Codex fixture runs never show it. The copy lives in the pure `hiddenSessionsNotice`, not inline in the sidebar.
- The "missing" notice applies to both cores (as specified). In Codex mode a failed thread/read used to vanish silently; it now adds "N session(s) could not be loaded."
- Not-found mapping goes through the pure `requireSession` helper (testable) instead of inline try/catch, and also wraps agents.resume. isSessionNotFound additionally recognises SessionPersistenceNotFoundError (the no-sessionQuery fallback path).
- thread/unarchive now rejects threadNotFound for an unknown id instead of swallowing it, so main.cjs (which moves the id only after success) keeps it archived.
- deleteConfirmCopy/olderConfirmCopy accept 'deepseek' and the raw 'deepseek-harness' (the finding's verification uses the latter). Menu item labels stay "Delete" (source fidelity); only dialogs and the bulk status/failure lines change.
- Sidebar row Fork is not a commandUnavailable call site (SourceSidebarSessionMenu has its own reasons); it receives `unsupportedCommand('fork')` as `forkUnavailable`.
- Beyond "keep boot.core on connection events": connected status events now carry `core`, so a connection that comes up without a successful init still gets the right engine.
- tileStore.prune keeps layouts for every remembered id, so hidden sessions keep their pane layout for when their core is back ("never mutate … restores everything").
- `otherEngine` and `missing` are counts.

### Remaining gaps
- loadSessions still makes one full readSession + projector replay per DeepSeek id (the cost half of bridge-protocol-thread-read-cost-notfound is B09).
- index.js wiring (historyFor/openThread/unarchive) has no unit test (stdio-bound). The logic is in errors.js (unit-tested) and the live smoke covers read/resume. The smoke's "no stderr" check only proves no line naming the id appeared; it does not show the listener received other stderr output.
- The finding's alternative (read-only legacy rows "Created with Codex…") was not built; per the instructions, hidden sessions are only counted. The notice is not dismissible and stays while config holds those ids. Pins/groups/sessionMetadata of hidden ids stay in config, so a custom group can look empty.
- Under DeepSeek, an archived row with no engine tag (pre-tag metadata) is hidden and not counted (spec rule).
- The app does not route on `threadNotFound` yet; loadSessions classifies by metadata engine. `threadNotFound` is a bridge extension, not a Codex CodexErrorInfo value.
- The live runner's 01-home shot is taken while the model label still says "Loading models…" (pre-existing wait condition), so report.sidebarNotice was null there; the notice is in 02b/03b.
- thread/fork, review/start and thread/revert themselves remain unimplemented (deferred: bridge-protocol-fork-unsupported).

## B04

Snapshot: work/restore-batches/snapshots/B04 (taken before any edit).

### What changed
- harness/packages/code-desktop-app/cordis.patch.yml: inserts `tool-ask-user` (`@deepseek-ai/dsh-tool-ask-user`, default legacy blocking mode). `codeDesktop/diagnostics` now lists `ask_user_question` and `exit_plan_mode`.
- harness/packages/codex-app-server/src/questions.js (new, pure):
  - `codexQuestions(items)`: AskUserQuestionItem → ToolRequestUserInputQuestion `{id, header ?? '', question (+ "\n\n" + detail, except intent 'plan-review'), isOther:true, isSecret:false, options:[{label, description ?? ''}] ?? null}`;
  - `harnessAnswer(items, response)`: `{answers:[{id, selected, custom?}]}`. Option labels go to `selected`; other strings are joined with '\n' into `custom`, which is left out when blank. A skipped question (absent key) or malformed values give `selected: []`;
  - `isPlanApproval(items, answer)`;
  - `questionItemId(request, turn, asking)`;
  - `questionFailure(aborted, cause)` → the package's `UserQuestionError`: `ASK_ABORTED` or `ASK_CANCELLED`;
  - `permissionHint(params)`: reads `codeDesktop.{permissionMode, afterPlan}`; an unknown mode → null, an invalid afterPlan → 'auto';
  - `afterPlanPermission(afterPlan)`: ask → {mode 'ask', untrusted}, anything else (bypass included) → {mode 'auto', on-request}; workspace-write in both cases.
- harness/packages/codex-app-server/src/index.js:
  - `thread.permission` gains `mode`/`afterPlan`. `applyPermissions` reads the hint, calls `syncPlanMode` (`ctx.get('planMode').set(agent, mode === 'plan')` in try/catch with a logger warning), then `applyPreset` (the old preset half, extracted);
  - `approval/request` returns 'rejected' without asking while `mode === 'plan'`;
  - new `user-questions/request` listener → `askQuestions` for owned agents (`next()` otherwise). It sends `item/tool/requestUserInput {threadId, turnId (the call's turn, else the active turn), itemId, questions, isBlocking:true, autoResolutionMs:null}`. On a plan approval while `mode === 'plan'`, it switches `thread.permission` to `afterPlanPermission(afterPlan)` and re-applies the preset before returning the answer, so the same turn can write;
  - askClient's pending/abort/serverRequest-resolved code moved into a shared `clientRequest(thread, method, params, signal, flag)`. Approvals and questions both use it. It also aborts at once when the signal is already aborted;
  - `status()` reports the flags of pending requests: `waitingOnApproval` and/or `waitingOnUserInput`. `askingItems` tracks the calls whose card is open;
  - diagnostics `toolNames` uses `tools.schemas()`; dsh-tools has no `list()`, so it was always `[]`.
- harness/packages/codex-app-server/src/projection.js: tool/call `exit_plan_mode` with a string `args.plan` first pushes a completed `{type:'plan', id:'plan-<callId>', text}` and then the dynamicToolCall. This is shared by live and replay.
- harness/README.md:
  - new mapping rows: `item/tool/requestUserInput`, Plan mode (hint, planMode.set, escalations refused, plan item + question card, Approve → afterPlan);
  - the approvals row notes the Plan refusal;
  - the Auto/Ask/Plan/Bypass row gains "read-only + Harness plan mode";
  - limitations: the dedicated plan card is not ported; multi_select answers are single-choice; legacy (not timed) ask mode;
  - questions.js added to the file table.
- harness/tests/questions.test.mjs (new, 7 tests); harness/tests/projection.test.mjs (+1).
- harness/tests/live-smoke.mjs:
  - request handler: answers question cards (plan-review → Approve; otherwise a "blue" option or the first one); approvals still get accept;
  - new PLAN step: a separate thread with the plan hint and readOnly policy, prompt "Create plan-smoke.txt…";
  - new ASK step: ask_user_question red/blue.
- app/electron/permission-policy.mjs:
  - `threadPermissionParams`/`turnPermissionParams` take `hints` and `afterPlan`. With `hints === true` they add `codeDesktop:{permissionMode, afterPlan}`: plan only for code + plan + no review, else review, else chat, else the permission; afterPlan must be auto|ask|bypass, default 'auto';
  - new `approvesPlan(request, payload)` and `afterPlanPermission(afterPlan)` (bypass → auto).
- app/electron/session-operations.cjs: hints = `owner.serverInfo?.engine === 'deepseek-harness'`; afterPlan comes from the payload.
- app/src/main.jsx:
  - `afterPlan` ref, updated on every render to the last effective non-Plan permission (default 'auto');
  - `permissionHints()` = {hints: engine === 'deepseek', afterPlan} at the four thread/turn param sites. The two session-action calls pass afterPlan;
  - question/approval responses go through `respondApproval(request, payload)`: after an ok response on DeepSeek while in Plan, an approved plan review calls `bypassMode.select(afterPlanPermission(afterPlan))`, the permission menu's own setter.
- app/src/source-permission-menu.jsx: Plan description "Create a plan before making changes" (shared-14:10296).
- Tests:
  - app/tests/permission-policy.test.mjs (+2);
  - approval-draft-model.test.mjs (+1: plan-review free-text feedback on an isOther question submits, and respond-approval's `approvalResponse` accepts it);
  - session-operations.test.mjs (+1: compact's thread/resume carries the hint only when serverInfo.engine is deepseek-harness).
- work/deepseek-live-20261001/live.mjs: optional `ANSWERS` env ({questionId: label}). While a turn runs, it answers matching question cards (screenshot `0Nq-<id>`). Each step records the composer `permission` label and the `answered` entries with the label before and after.

### Tests run
- `cd harness && node --test tests/questions.test.mjs tests/projection.test.mjs`: 26/26 pass.
- `cd harness && node --test tests/*.test.mjs`: 44/44 pass (B03 left 36).
- `cd app && node --test tests/permission-policy.test.mjs tests/approval-draft-model.test.mjs tests/session-operations.test.mjs`: 55/55 pass.
- `cd app && npm test` (after the last code edit): 1170 tests, 1169 pass, 1 pre-existing skip, 0 fail (B03 left 1166; 4 new).
- `npm run build`, then offscreen suites (Codex fixtures, no hint): permission and approval-card both passed. approval-card exercises the question card through the new respond wrapper.
- Offline bridge check (scratch script, no model calls; session soft-deleted afterwards). The session log was decoded with the zstd CLI:
  - thread/start with the plan hint logs `plan/mode {active:true}`;
  - a plan resume is a no-op;
  - an auto resume logs `plan/mode {active:false}`;
  - an unhinted resume and a chat resume log nothing.
- `cd harness && node tests/live-smoke.mjs` (1 run). The earlier steps are unchanged from B03: init/notFound, turns 1/2, queue, compact, read, cold resume.
  - PLAN: the turn completed. The wire order was: two read-only bash explorations → `plan` item ("# Plan: create `plan-smoke.txt`…") → exit_plan_mode → exactly one request, `item/tool/requestUserInput` with itemId = the exit_plan_mode call id and question `plan-review/Plan review/Approve|Keep planning`. The status flag was `waitingOnUserInput`. After Approve: `fileChange plan-smoke.txt completed` with no approval request, a verification bash, and the file reads `PLAN_OK`.
  - ASK: a single request with itemId = the ask_user_question call, isBlocking true, options Red/Blue with description ''. The tool completed with `{"answers":[{"id":"color_pref","selected":["Blue"]}]}`. Reply "Blue".
- `live.mjs b04` (1 run, b04-muph58hl; PREFERENCES {"permission":"plan"}, ANSWERS {"plan-review":"Approve"}, PROMPTS = create plan-live.txt, "Reply with only the word DONE."):
  - no renderer errors or alerts;
  - 02q-plan-review.png shows the markdown plan above "Using exit_plan_mode" and the card "Approve this plan and leave plan mode?" (Approve / Keep planning / Other, Skip, Submit), with composer mode "Plan";
  - after Submit the composer reads "Auto" (permissionBefore "Plan" → permissionAfter "Auto");
  - the same turn wrote plan-live.txt = `PLAN_LIVE_OK`;
  - the next prompt answered "DONE" and the mode stayed "Auto".

### Deviations from the spec
- Plan sync: `planMode.set(agent, mode === 'plan')` runs on every hinted request, not only on a plan→non-plan transition. The session log keeps `plan/mode` across a core restart while a fresh LiveThread has no previous mode, so the spec's transition rule would leave a restarted Plan session in plan mode after the user picks Auto. set() is a no-op when the state already matches. Unhinted (Codex-shaped) requests never touch plan mode.
- The plan approval path does not call `set(false)` itself. It changes `thread.permission` and the preset directly, and exit_plan_mode queues the exit (narrate:false). This applies only while `thread.permission.mode === 'plan'`, so an unhinted session's permissions are never rewritten.
- Abort code: a question dropped because the request signal is aborted throws `ASK_ABORTED`, the package's own code for a signal abort. Transport errors or a dropped request throw `ASK_CANCELLED` (exit_plan_mode then stays in plan mode and stops). The spec used ASK_CANCELLED for both.
- itemId fallback: the spec takes the newest running ask_user_question/exit_plan_mode. This uses the oldest one that has no open card (`askingItems`), because parallel calls dispatch in model order. Sequential calls (the normal case) give the same result. intent.callId is checked before wait.callId.
- Status flag: questions report `waitingOnUserInput` (Codex ThreadActiveFlag) instead of `waitingOnApproval`.
- App afterPlan switch: guarded by engine === 'deepseek', current effective permission 'plan' and an ok respond result, and it uses `bypassMode.select` (the menu's setter, which also clears a session Bypass). `approvesPlan`/`afterPlanPermission` live in permission-policy.mjs so they can be unit-tested.
- session-operations also forwards `payload.afterPlan` (main.jsx sends it) so a compact in Plan carries the same hint as other requests.
- The finding's alternative, a cordis 'plan' preset with approval 'never', was not added. The spec's approval/request refusal does the same job without patching dsh-base's permission row.
- Also fixed in passing: diagnostics toolNames (`tools.list` → `tools.schemas`).

### Remaining gaps
- The dedicated source plan card (Rse: "proposed a plan", Open plan, Revise + "Plan feedback") is not ported. The plan shows as a markdown plan item plus the generic question card; feedback goes through "Other". The exit_plan_mode row still reads "Using/Used exit_plan_mode", and its expandable JSON body repeats the plan (B11 relabels it).
- The live runs never exercised a write attempted *during* Plan, because the model planned without trying to edit. Escalation refusal in Plan rests on the code path and the offline reasoning, not a live observation. The resulting call would show as Denied (approval/decided rejected).
- `multi_select` questions are answered single-choice (the Codex question schema has no multiSelect). The timed ask mode (attachWait, late replies) is not wired. Questions from sub-agents are refused by Harness itself (DELEGATED_CALLER), not shown.
- Sending a message while a plan review is pending does not dismiss the review (the source's "dismissed to speak instead"). The card stays until it is answered or the turn is stopped.
- If saving the app preference fails after an approval, the next turn is sent as Plan again and the bridge re-enters plan mode.
- Bypass selected before Plan resumes as Auto after approval, by design: Bypass keeps needing its own confirmation.
- index.js wiring (listeners, clientRequest, askQuestions, syncPlanMode) has no unit test, because apply binds stdio. It is covered by the live smoke, the live app run and the offline check. The pure parts are in questions.js.

## B05

Snapshot: work/restore-batches/snapshots/B05 (taken before any edit).

### What changed
- harness/packages/codex-app-server/src/approval.js (new, pure):
  - `escalationModeOf(request)`: reads /escalate sandbox to ([\w-]+)/ from reason, else /with ([\w-]+) permissions/ from displayReason.en; null otherwise.
  - `grantKeyFor({origin, toolName, item, mode})`:
    - ask: 'ask:file' | `ask:command:<cmd>` | `ask:tool:<name>`;
    - escalation: `escalate:<mode|unknown>:command:<cmd>` | `…:file:<sorted paths joined by '|'>` | `…:tool:<name>`;
    - null without an item.
  - `sessionGrantable({origin, mode, item})`: false for escalation fileChanges to danger-full-access or to an unnamed mode, and false without an item.
  - `reasonFor(request, origin)`: ask → null. Otherwise displayReason.en ?? reason, with the "Allow this operation with <mode> permissions:" and "escalate sandbox to <mode>:" ledes stripped, prefixed `Needs <mode>: `. zh is never used.
  - `withinRoots(path, roots)`: path.resolve on both sides; equal to a root or below `root + sep`. A relative path is false.
  - `canonicalTarget(path)`: realpath of the deepest existing ancestor plus the rest.
  - `extraRootsOf(writableRoots, cwd)`: absolute strings only, realpath with a raw-path fallback, deduplicated, cwd removed.
  - `writesInsideRoots(item, roots)`: a fileChange whose change paths (and move_path) are all absolute and all canonicalize inside the roots.
  - `presetTarget(permission)`: the former inline target computation from applyPreset.
  - `SessionGrants`: has/add/size. `presetApplied(target)` drops every 'escalate:' key when the target differs from the previous one.
- harness/packages/codex-app-server/src/index.js:
  - LiveThread has `askedCalls` (a Set), cleared at turn/end. `sessionGrants` is now a SessionGrants. `permission.extraRoots` defaults to [].
  - The Ask-mode pre-execute hook adds exec.callId when it returns 'ask'.
  - approval/request: origin = askedCalls.delete(callId) ? 'ask' : 'escalation'. This is computed before the Plan refusal (kept), so the id never leaks.
  - askClient(thread, request, origin):
    - an escalation where writesInsideRoots(item, extraRoots) is true → 'allowed-once' with no card;
    - reason = reasonFor; grantKey = grantKeyFor; grantable = sessionGrantable;
    - the dead `tool:${toolName}` check is removed;
    - params gain `sessionGrantable` (both methods);
    - acceptForSession stores the key only when grantable.
  - applyPermissions:
    - a sandboxPolicy of type workspaceWrite sets extraRoots = extraRootsOf(writableRoots, cwd);
    - any other given sandbox mode clears them;
    - a bare 'workspace-write' mode (thread/start, resume) keeps them.
  - applyPreset computes presetTarget first and calls `sessionGrants.presetApplied(target)`, even when no presets service is present.
- harness/README.md:
  - the requestApproval row is rewritten (origin, English reason, sessionGrantable, item-driven app headings);
  - new rows for "Allow for this session" (key scheme, preset clearing) and the extra working directories;
  - the acceptForSession limitation is rewritten, plus a new limitation for extra roots (first write is still denied; bash still asks; no extra roots for the rest of a Plan-approved turn);
  - approval.js added to the file table.
- app/src/approval-card-model.mjs:
  - `reason` is its own model field. It is never in `context`.
  - `itemHeading(item, command)` derives the heading for command approvals (not writeStdin):
    - commandExecution + description → run/description, command detail, clampTitle;
    - dynamic subagent/subagent_fork → 'run an agent', meta = description ?? first prompt line (clamped only when it comes from the prompt), pretty-JSON arguments detail;
    - collabAgentToolCall spawnAgent → 'run an agent', meta = first prompt line, prompt detail;
    - skill → 'run skill' with meta `/name` (other args as detail);
    - web_fetch / webSearch openPage → 'fetch <url>';
    - web_search / webSearch search → 'search the web <queries>';
    - mcpToolCall → `use <tool> (<server>)` + JSON;
    - other dynamic tools → `use <tool>` + JSON (no detail when args are empty).
  - The item detail wins over params.command. No "missing-detail" line appears when the heading comes from the item. The working-directory line is kept only for shell commands.
  - heading.meta can be null; the title is then `Allow DeepSeek to <action>?`.
  - `params.sessionGrantable === false` drops the acceptForSession action. approvalKeyIntent then returns {type:'suppress'} for ⌘⇧⏎ (source `allowPersistent?.()`).
  - New export `scrollRegionProps(label, overflow)`.
- app/src/source-approval-card.jsx:
  - the heading renders one .sac-em span when there is no meta;
  - the reason renders first in .sac-content as `<div class="sac-reason scroll-fade-y scroll-fade-size-[8px]">`, which gets tabIndex 0, role group and aria-label "Reason" only while it overflows (its own useOverflowFocus).
- app/src/source-approval-card.css: `.sac-reason` uses wM (text-body, secondary, select-text, break-words, max 3 lines, overflow-y auto, plaintext bidi) plus a focus-visible shadow.
- app/scripts/approval-card-ui-test.mjs: the two `[data-context="reason"]` checks now assert `.sac-reason` is visible and no reason context line exists. cwd and network checks are unchanged.
- Tests:
  - harness/tests/approval.test.mjs (new, 7);
  - app/tests/approval-card-model.test.mjs: the first test is updated (reason slot) and there are 4 new tests;
  - app/tests/source-shortcut.test.mjs: 3 new SSR tests.
- harness/tests/live-smoke.mjs: the extra root `../workspace-extra` is recreated at start. A new EXTRA ROOT step runs on the plan thread in Auto with writableRoots [workspace, extra]: write tool + bash touch into the extra root, retrying with sandbox_permissions. APPROVAL lines are printed up to 400 chars.
- work/deepseek-live-20261001/live.mjs: an optional `APPROVE` env (an action key). Each approval card is screenshotted (`0Na-<n>`), recorded (method, title, .sac-em texts, reason, context, detail, actions) and answered with that action.

### Tests run
- `cd harness && node --test tests/approval.test.mjs tests/projection.test.mjs`: 26/26 pass.
- `cd harness && node --test tests/*.test.mjs`: 51/51 pass (B04 left 44).
- `cd app && node --test tests/approval-card-model.test.mjs tests/source-shortcut.test.mjs tests/approval-state.test.mjs tests/approval-draft-model.test.mjs tests/approval-transport.test.mjs`: 95/95 pass.
- `cd app && npm test` (after the last code edit): 1177 tests, 1176 pass, 1 pre-existing skip, 0 fail (B04 left 1170; 7 new).
- `npm run build`, then the offscreen suites approval-card (with the updated reason checks) and approval-transport: both passed.
- `cd harness && node tests/live-smoke.mjs` (1 run; a first attempt failed at once because macOS has no `timeout` binary, before any request):
  - earlier steps unchanged;
  - the Ask-mode write and the bash card now carry `reason:null, sessionGrantable:true`;
  - EXTRA ROOT:
    - `fileChange extra-root.txt failed` (sandbox denial) → retried `fileChange … completed`, with no approval request (auto-allowed by the bridge);
    - the bash `touch` failed → retried with exactly one `item/commandExecution/requestApproval`, reason "Needs danger-full-access: The file path is outside the session workspace, so full access is needed for this exact touch command to succeed.", sessionGrantable true → completed;
    - file = EXTRA_ROOT_OK and touched = true.
  - This confirms live the denial → escalation → approval/request flow that the finding had inferred.
- `live.mjs b05` (1 run, b05-mupi4xti; PREFERENCES {"permission":"ask"}, APPROVE accept). No renderer errors or alerts. Cards seen:
  - "Allow DeepSeek to run Print the B05 marker?" with ems [run, Print the B05 marker], detail `echo b05-live`, a cwd line, no reason, actions decline/acceptForSession/accept;
  - "Allow DeepSeek to run an agent Say hello?" with a pretty-JSON detail and no context;
  - a write outside the workspace: two Ask-mode "Allow DeepSeek to write b05.txt?" cards (reason null, session allowed), then the escalation card with reason "Needs danger-full-access: The target path … requires full file access." and actions decline/accept only (03a-3.png);
  - b05.txt = B05_OK.

### Deviations from the spec
- Reason label: the spec asks for a visible 'Reason' text-footnote label. In the source, `Up` in approval-current.js is imported as `La` from cf6ae6197, whose export is `bv`. bv renders only a scroll-clamped div and uses `label` solely as the aria-label (with role group and tabIndex 0) while the content overflows; no label text is drawn. The card follows the source: the reason is its own `.sac-reason` block (class name from the spec) with the wM styling, labelled "Reason" for assistive tech only while it scrolls. No `.sac-reason-label` element exists. The SSR test asserts the separate block, its position before the context, and the absence of visible label text. The overflow-gated attributes are unit-tested through `scrollRegionProps`.
- Origin is computed in the approval/request listener before the Plan refusal (not inside askClient), so a refused call's id is consumed too. askedCalls is also cleared at turn/end, for asks the approval service settles without reaching the listener.
- grantKeyFor returns null (and sessionGrantable false) when the projector has no item for the call. In practice tool/call is appended before pre-execute, so this never happens, but a missing item can no longer turn a bash or write ask into a tool-wide `ask:tool:bash` grant. An escalation whose mode cannot be parsed uses `escalate:unknown:` and, for files, is not grantable.
- Extra-roots containment canonicalizes the target (the deepest existing ancestor through realpath), not just path.resolve. A symlink inside an added folder that points outside is not auto-approved. Roots are cleared when a non-workspace-write sandbox is applied, so a later read-only (chat/review) turn cannot reuse them. move_path is checked as well.
- The spec's two module names are merged: the containment helpers live in approval.js (no separate roots.js/roots.test.mjs; the B05 Files list names only approval.js).
- Escalation grant clearing is driven by the computed preset target (`presetTarget`, moved into approval.js), and runs even without a presets service.
- Heading table, choices the spec does not cover:
  - web_search and webSearch carry their query as meta (as the source does with WebSearch query);
  - skill shows the rest of its args as detail (empty for DeepSeek, which has only `name`);
  - spawnAgent's detail is its prompt (collab items have no arguments);
  - "run an agent" is clamped only when the meta comes from the prompt;
  - the working-directory line is dropped for non-command item headings;
  - writeStdin approvals keep their own copy.
- The bridge still sends `"<tool> <json>"` as params.command for non-bash tools (the optional change was not made). The app ignores it whenever the item is found, and it stays a readable fallback when the item is missing.
- The approval-card offscreen suite script had to change (two reason assertions), since the reason intentionally left the context list.

### Remaining gaps
- index.js wiring (askedCalls, origin, auto-allow, extraRoots in applyPermissions, presetApplied in applyPreset) has no unit test, because apply binds stdio. It is covered by the live smoke (EXTRA ROOT step, Ask-mode params) and the live app run. Escalation-grant clearing on a preset change is only unit-tested in SessionGrants, not exercised live.
- An added folder is still not a Harness writable root. The first write there is denied, and the model must retry with sandbox_permissions; the retry is then allowed silently. A model that does not retry reports a failure. Bash writes there always ask.
- For the rest of a turn whose plan was approved in Plan mode, extra roots are empty (Plan's readOnly policy carries none). They come back with the next turn/start.
- Session grants remain in memory only and are lost on a core restart or thread reopen.
- The FileChanges detail inside a fileChange approval card lays out its header wide (icon, path and 'add' spread across the card, 03a-3.png). This predates B05 and was not touched.
- No visible "Reason" label, by design (see deviations). If a visible label is wanted anyway, it is a one-line addition in source-approval-card.jsx.

### B05 review fixes

No new snapshot; snapshots/B05 stays the pre-batch baseline.

- Major, symlink + `..` bypass of the extra-root auto-allow (harness/packages/codex-app-server/src/approval.js):
  - Repro (scratch probe calling the real `writesInsideRoots`, `toolItem` and dsh-fs-local `LocalFileSystem.resolve`): both cases from the review returned true before the fix. In case (1), `<extra>/link/../secret.txt` with link → outside/deep: Harness writes outside/secret.txt. In case (2), relative `esc/../evil` with cwd inside an added parent: the item reads `<cwd>/evil` and Harness writes the parent's sibling `evil`. Both return false after the fix.
  - `writesInsideRoots({item, args, cwd}, roots)` now decides on the call's raw `file_path` (`projector.tools.get(callId).args`), not on the projected item path. It refuses when the spelled path has a `..` segment (`/(^|[\\/])\.\.([\\/]|$)/`), when it is missing or blank, or when it is relative without an absolute cwd. The item must describe exactly that one file: every change path resolves to the same target, with no `..` and no move_path. A fileChange from any other tool shape therefore shows its card.
  - `canonicalTarget` now mirrors dsh-fs-local `resolveLocalTarget`. It never collapses a spelled `..` by text: it realpaths the spelled path, and when that path is missing it walks `dirname` of the spelled path. It returns null for a relative path, or when the missing suffix crosses `..`. fs/promises realpath is the native, physical one; this was checked: `link/..` gives the link target's parent.
- Minor, auto-allow only for recognised escalations: `approvalDecision` auto-allows an extra-root write only when `escalationModeOf(request)` is non-null. Another asker's explicit ask (origin 'escalation', no mode) now shows its card.
- Minor, escalation command grants include the working directory: `escalate:<mode>:command:<item.cwd>\0<cmd>`. Ask-mode `ask:command:<cmd>` keys are unchanged; they run in the workspace-write sandbox.
- Minor, index.js wiring coverage: the decisions moved into approval.js as testable helpers, and index.js now only wires them.
  - `approvalDecision({request, askedCalls, permission, item, args, cwd, grants})` returns reject/allow/ask. It consumes askedCalls first, then applies the Plan refusal, the extra-root auto-allow, the session grant check, and the reason/grantKey/grantable.
  - `approvalAnswer(decision, {grantKey, grantable}, grants)` returns {answer, interrupt}.
  - `updatePermission(permission, params, cwd)` sets approvalPolicy, sandbox (POLICY_SANDBOX moved here), extraRoots and the mode hint, and returns whether a hint came.
  - `presetFor(permission, grants)` returns presetTarget and calls presetApplied.
  - index.js: the approval/request listener calls `answerApproval` (item/call lookup → approvalDecision → askClient for 'ask'). askClient builds the card from the decision and answers through approvalAnswer. applyPermissions = updatePermission (+ syncPlanMode when hinted) + applyPreset, and applyPreset uses presetFor. Behaviour is otherwise unchanged.
- Tests, harness/tests/approval.test.mjs (7 → 11):
  - write calls are built through the real projection `toolItem`;
  - new symlink test: `extra + '/link/../secret.txt'` built by concatenation, the relative `esc/../evil` with cwd inside an extra root (item path asserted as `<cwd>/evil`), a missing-`..` canonicalTarget → null, and a `..` that stays inside the root still asks; non-`..` relative and `/./` spellings still pass;
  - item/args mismatch, move_path, missing or blank file_path;
  - cwd-scoped escalation command keys;
  - approvalDecision: Ask then escalation for one callId, an unrecognised asker shows its card, a `..` write outside asks with grantable false, bash session grant then allow, an Ask grant does not answer it, and Plan rejects while still consuming the record;
  - approvalAnswer;
  - an updatePermission + presetFor sequence: start → Auto turn (roots) → bare resume keeps roots → Plan (no roots, reject, escalation grant dropped) → Auto (ask again, Ask grant kept) → Bypass → Auto drops grants made under full access; an unhinted request leaves the mode alone.
- README: the grant-key row has the cwd-scoped command key. The extra-roots row states the conditions: a recognised escalation; the raw `file_path`, not the item; no `..`; the item is that one file; resolution as in dsh-fs-local. The approval.js file-table row names the new helpers.

#### Tests run
- `cd harness && node --test tests/approval.test.mjs tests/projection.test.mjs`: 30/30 pass.
- `cd harness && node --test tests/*.test.mjs`: 55/55 pass (B05 left 51).
- `cd app && npm test`: 1177 tests, 1176 pass, 1 pre-existing skip, 0 fail (unchanged; no app file touched).
- Scratch probe (above): both review cases flip from true to false, and dsh-fs-local confirms where Harness would have written.
- Offline bridge check through the real runtime, with no turn and no model call: thread/start with a workspaceWrite policy (cwd + workspace-extra) and the auto hint, then resume with readOnly + plan, then resume with untrusted + workspaceWrite + ask. Responses carried read-only, then workspace-write/untrusted. There were no preset or plan-mode warnings on stderr. The session was soft-deleted afterwards.
- Live checks were not rerun. B05 already used its one live-smoke run and its one live.mjs run. The smoke's EXTRA ROOT write uses an absolute path with no `..` and a parsed `danger-full-access` mode, so it still meets the new conditions.

#### Remaining gaps
- The auto-allow now covers only write/edit-shaped calls (a raw `file_path` and one matching change). A future diff-presenting tool with other argument names would show its card. That is fail-closed, by design.
- A `..` that stays inside the added folder (e.g. `extra/a/../b.txt`) also asks. Only the spelling decides; a lexical check alone cannot exclude the symlink case.
- index.js itself still has no stdio-level unit test: answerApproval/askClient/applyPermissions are thin wiring over the tested helpers. Escalation-grant clearing on a real preset change was exercised through the helpers and the offline preset switch, not through a live escalation.

## B06

Snapshot: work/restore-batches/snapshots/B06 (taken before any edit).

### What changed
- harness/packages/codex-app-server/src/projection.js
  - toolItem takes `threadId`. `subagent` / `subagent_fork` → `collabAgentToolCall` spawnAgent `{id: callId, status: inProgress, senderThreadId, receiverThreadIds: [], prompt, model, reasoningEffort (args.reasoning_effort), agentsStates: {}}` plus the bridge field `description`. `send_message` → sendMessage (receiver = agent_id, prompt = message), `interrupt_agent` → interruptAgent, `list_agents` → listAgents. All are in the CollabAgentTool enum.
  - completeToolItem (completeCollabItem):
    - `started subagent <id>` → completed, receivers [id], agentsStates[id] running;
    - `started background subagent job` → completed, no state;
    - foreground output → agentsStates[child] = completed with the output as message; a failure → errored, or interrupted for "subagent run was cancelled";
    - an AbortError → interrupted, and running child states become interrupted.
  - ThreadProjector:
    - state moved into `reset()`;
    - new `inheritedHistory: 'show' | 'hide'` option: 'hide' resets at `session/end-seed {inherited:true}`;
    - `spawns` (childId → {turn, itemId, label}), `childLabel(id)`, `childTurnId(id)`;
    - `agentLabel` from the session's own `subagent/descriptor`.
  - `subagent/catalog` (the parent's discovery fact, logged while the delegating call runs) attaches the child to the running spawn call whose `description` equals the label. An unlabeled fact attaches only when exactly one spawn call is running. The update is emitted as item/started (row still running).
  - user/message `subagent-settled`:
    - the owning row gets agentsStates[child] = {settledStatus(summary), settledMessage(content)} and is re-completed under its own turnId;
    - a `subAgentActivity {id: subagent-<msg id>, kind completed|interrupted, agentThreadId, agentPath}` item goes into the current turn;
    - no userMessage is created.
    `agent-message` → activity `interacted`. Activities wait in `heldActivities` until the turn has its Codex id (flushed in ensureTurn), so a notice never decides a turn id.
  - Exported `settledStatus` / `settledMessage`.
- harness/packages/codex-app-server/src/subagents.js (new, pure):
  - `threadLineage(header, label)`: origin 'subagent' → parentThreadId + `{subAgent:{thread_spawn:{parent_thread_id, depth: delegationDepth ?? 1, agent_path:null, agent_nickname, agent_role:null}}}` + agentNickname; a parentSession without that origin → forkedFromId and 'appServer'.
  - `sourceFilter(sourceKinds)`.
- harness/packages/codex-app-server/src/approval.js:
  - `READ_ONLY_TOOLS` moved here (exported);
  - `rootThreadFor(agent, threads, headerOf)` walks only origin-'subagent' headers, at most 8 levels;
  - `childDecision({rootPolicy, toolName})`;
  - `childApproval({threadId, turnId, callId, toolName, args, item, cwd, label, grants})` → allow (root session grant) or the card {method, params, grantKey, grantable}.
- harness/packages/codex-app-server/src/index.js:
  - `children` map plus a `ChildThread` (child agent, its root, a 'hide' projector hydrated from snapshotEvents, onEvent forwarding the projector's notes, status, route).
  - Listeners:
    - session/event and agent/status also serve children;
    - `subagent/start` → startChild: resolve the root, create the ChildThread, store the label, then notify thread/started (child thread object), status active, and turn/started for an already open turn;
    - `subagent/end` → status idle and drop.
  - LiveThread stores the label on its own `subagent/catalog` events (`rememberLabel` → store `agentLabel`).
  - tools/pre-execute: for a non-root agent, rootThreadFor + childDecision. Mutating calls under an Ask-mode root go through `askChild`: a card on the root via clientRequest (the pending entry is tagged with childId), answered allow / deny `the user rejected tool "<name>"` / cancel (signal aborted) / deny `approval for tool "<name>" was cancelled`. A 'cancel' decision stops the child.
  - turn/interrupt for a non-root id → stopChild: abort that child's cards, then `agents.get(id).cancel({kind:'user'}, {keepInbox:true})`.
  - historyFor serves a running child's projector, and uses 'hide' for origin-'subagent' sessions. threadObject uses threadLineage, the child route, and child status (a sub-agent not running here → idle).
  - listThreads: sourceFilter; isSub = origin 'subagent' only (user forks list as sessions); titles are folded after sort and slice, for the page only.
- harness/README.md: mapping rows for collabAgentToolCall, sub-agent threads, sub-agent Stop and sub-agent approvals; a limitations line; file table (approval.js, subagents.js).
- app/src/agent-model.mjs: agentName falls back to `item.description` before the prompt's first line.
- app/src/approval-card-model.mjs: a spawnAgent card uses `item.description` as meta (unclamped) when present. Codex items have neither field, so Codex behaviour is unchanged.
- Tests:
  - harness/tests/projection.test.mjs: 4 existing cases retargeted from `subagent` to `set_goal` as their stand-in dynamic tool; +6 new: the spec replay incl. replay equality, held activity / turn id, settled texts from the installed dsh-subagent createSettlementMessage/createAgentMessage, catalog correlation + foreground outcomes, control tools, seeded fork.
  - harness/tests/approval.test.mjs: +3 (rootThreadFor, childDecision, childApproval).
  - harness/tests/subagents.test.mjs (new, 2).
  - app/tests/agent-model.test.mjs: +1, bridge projector notes → reducer → agentView completed / 'done' / no notice bubble.
  - app/tests/background-tasks-model.test.mjs: +1, thread_spawn child + running spawn row → running 'agent' task.
  - app/tests/approval-card-model.test.mjs: description heading.
- harness/tests/live-smoke.mjs: new SUBAGENT (Ask-mode continuable child) and SUBAGENT STOP (turn/interrupt on the child) steps.

### Tests run
- `cd harness && node --test tests/projection.test.mjs tests/approval.test.mjs`: 39/39 pass.
- `cd harness && node --test tests/*.test.mjs`: 66/66 pass (B05 left 55).
- `cd app && node --test tests/agent-model.test.mjs tests/background-tasks-model.test.mjs tests/state.test.mjs tests/approval-card-model.test.mjs tests/source-shortcut.test.mjs`: 72/72 pass.
- `cd app && npm test` (after the last code edit): 1179 tests, 1178 pass, 1 pre-existing skip, 0 fail (B05 left 1177; 2 new).
- `npm run build`, then offscreen suites subagents, background-tasks, approval-card: all passed.
- Offline bridge check (scratch, no model calls):
  - thread/list {sourceKinds:['subAgentThreadSpawn']} returns the one existing child (thread_spawn, depth 1, idle);
  - the root list has no parent-linked rows;
  - thread/read of the B05 child gives agentNickname "Say hello" from its descriptor;
  - the B05 parent replays as one spawnAgent row: receivers [child], agentsStates completed "HELLO", description "Say hello".
- `cd harness && node tests/live-smoke.mjs` (1 run). Earlier steps are unchanged from B05.
  - SUBAGENT:
    - child thread/started: parentThreadId = root, thread_spawn source, agentNickname "Write sub marker";
    - status active → idle; child turn/started + completed forwarded; child items fileChange, sendMessage, agentMessage;
    - requests: the root's own subagent call (commandExecution, reason null), then the child's write as item/fileChange/requestApproval with threadId = root, itemId = the child call, reason "Requested by the “Write sub marker” agent.", changes [sub-smoke.txt];
    - row sequence: started [] → catalog item/started [child] running → completed running → settled completed "DONE", under the original turn id;
    - activities: interacted (the child's send_message) and completed;
    - parent user messages: only the human prompt; the notice turn is `turn-n2` with subAgentActivity items;
    - thread/list and thread/read of the child are right; file = SUB_OK.
  - SUBAGENT STOP: the child's bash started, turn/interrupt on the child id → ack ok; child turn interrupted, bash interrupted, row settled {status: interrupted, message: null}.
- `live.mjs b06` (1 run, b06-mupk3rxr; PREFERENCES {"permission":"ask"}, APPROVE accept, foreground delegation prompt):
  - no renderer errors or alerts;
  - cards seen: "Allow DeepSeek to run an agent Write live marker?" (description meta), then "Allow DeepSeek to write sub-live.txt?" with reason "Requested by the “Write live marker” agent." and the diff;
  - 02a-2.png shows "Running agent Write live marker deepseek-flash · Edit · 1" above the card (live child items);
  - 02b-done.png shows "Ran agent Write live marker";
  - sub-live.txt = SUB_LIVE_OK.

### Deviations from the spec
- Child correlation comes from the parent's own `subagent/catalog` event, matched by label (= the call's description), for both live and replay. There is no `childFor(callId)` option fed by subagent/start: SubagentRunInfo carries only {runId, provider, id, local}, with no callId or label, and the listener receives only that info. One-shot forks therefore get their child on replay too, without the "createdAt inside the call window" heuristic.
- Child events are forwarded live (turns and items from durable events; no token deltas), although the spec says child transcripts are not streamed in this batch. Two reasons:
  - The Tasks pane shows Stop for an agent task only when `task.turnId` (state.active[child]) exists, which only a child turn/started provides.
  - The running card's tool count and latest tool read the child's items.
  historyFor serves the same live projection, so thread/read matches what was streamed. assistant-stream frames for children are still not mapped.
- The child approval card uses itemId = the child's own call id, not the root's spawn row. The app looks the card's item up among the root's items; with the spawn row it would read "run an agent <description>" with the prompt and hide the child's actual command or diff. Instead:
  - commands show their command and cwd;
  - writes go through item/fileChange/requestApproval with a bridge `changes` field, which the app already renders;
  - a reason line names the requesting agent;
  - "Allow for this session" grants live in the root's SessionGrants.
- Harness API corrections:
  - ToolExecution has `arguments`, not `args`;
  - the interrupt uses `agents.get(id).cancel({kind:'user'}, {keepInbox:true})` (the DeepSeek app's own stop) with no subagents.interrupt fallback, which needs an authority and is a no-op for a target that is not resident.
- Settled status: Harness's aborted summary reads "was stopped before it finished", which the spec's /interrupt|cancel/ misses, so "was stopped" is matched too. Failure matches /fail|error|abnormal/ (the "ended abnormally" default arm). max-tokens and refusal stay completed, as turnStatusOf treats max-tokens.
- subAgentActivity carries the protocol-required `agentPath` (= child id). Activities wait for the turn's Codex id, so the turn/start response id stays `turn-<human message id>` when a notice and a human message share a turn. `agent-message` → 'interacted' comes from the finding's fix text.
- Seeded-history reset applies only to sub-agent sessions (`inheritedHistory: 'hide'` for origin 'subagent'). A fork the user made in the DeepSeek app keeps showing its copied history, as before. The reset also clears title, plan, usage, approval audit, spawns and label, not only turns/byDshTurn/current/tools/preview.
- Children also skip the card for `send_message` / `interrupt_agent` (CHILD_QUIET_TOOLS). A continuable child is told to report its result with send_message, and these tools change no files. The root's own Ask mode is unchanged.
- sourceFilter lists both kinds when sourceKinds mixes interactive and subAgent* values; the spec's boolean would list only sub-agents.
- A sub-agent that is not running in this process reports status idle, not notLoaded. Its status is truthful, and desktop-settings' archive sweep keeps working for sessions that had children.
- store.js needed no change (update already persists `agentLabel`). Two small app model changes were added for the label (agentName and the spawnAgent card heading). The app tests import the bridge's pure projection.js / subagents.js so they feed bridge-produced items.

### Remaining gaps
- No token-level streaming for children: answers appear in the Tasks pane per step, not per token.
- The background-job delegation form (`started background subagent job …`) does not track the child's end.
- A continuable child cut off by a core restart, so no settled notice was logged, replays as running.
- Children created before this batch have no stored label, so `thread/list` gives agentNickname null. The app falls back to the spawn row's description; thread/read reads the descriptor.
- Root-level Stop still aborts every pending card on the root, including a child's: the child gets "approval for tool … was cancelled" and keeps running (Harness keeps continuable children alive after the parent's stop).
- A child call the user denies shows as failed, not Denied, in the child transcript. The decision bypasses Harness approval events, so no approval/decided is logged.
- Root Ask-mode cards for sendMessage / interruptAgent / listAgents rows now fall back to "Allow DeepSeek to run this command?" with "send_message {…}" as detail. As dynamic items they used to read "use send_message".
- index.js wiring (ChildThread, the subagent/start|end listeners, askChild, stopChild, listThreads) has no stdio-level unit test. It is covered by the pure helpers' tests, the live smoke SUBAGENT/STOP steps and the live app run.
- The settled-notice parse depends on Harness's English summary text. It is pinned against the installed createSettlementMessage.
- The wide FileChanges header inside fileChange approval cards predates this batch and is visible again in 02a-2.png.

## B07

Snapshot: work/restore-batches/snapshots/B07 (taken before any edit).

### What changed
- harness/packages/codex-app-server/src/catalog.js (new, pure):
  - `skillsListEntry(cwd, snapshot)`: SkillSummary → SkillMetadata `{name, description, path, scope, enabled, pluginId:null}`.
    - Scope comes from `skillScope`: project-* → repo; user-* or custom → user; else system.
    - enabled = `invocation.modelInvocable !== false`.
    - Skipped: pathless skills, and skills where both invocation flags are false.
    - `complete:false` adds one `{path: cwd, message}` error.
  - `configReadResponse({permission, mcpEntries})` → `{config:{sandbox_mode, approval_policy, mcp_servers}, origins:{}, layers:null}`.
    - `mcpServerTable`: command, args (strings only), url, cwd and `enabled`.
    - env → `env`, headers → `http_headers`: key names only, every value ''.
  - `latestThreadIn(threads, cwds)`: the most recently active live thread in that cwd (closing threads skipped).
  - `mcpClientEntries`, `serverNameOf`, `fiberPhase` (Cordis FiberState 0–5 mirrored from dsh-host-plugin-inventory) and `mcpRuntimeStatus`:
    - disabled → disabled;
    - active → connected;
    - pending or loading → starting;
    - failed → failed;
    - anything else → null.
  - `mcpServerStatuses(entries, tools)`: one McpServerStatus per dsh-mcp-client entry, sorted by name.
    - tools: from strings or ToolSchema with the `mcp__<server>__` prefix, keyed by raw name, with description and inputSchema (= parameters).
    - authStatus 'unsupported'; resources and resourceTemplates [], serverInfo null.
  - `pluginSummary` / `pluginsInstalledResponse(bundles, dir)` / `pluginReadResponse(bundle, {dir, mcpEntries})`:
    - full PluginSummary, PluginInterface and PluginDetail shapes;
    - one marketplace 'deepseek-harness' with displayName 'DeepSeek Harness profile';
    - undefined bundles → empty catalog;
    - plugin/read lists the serverNames of the MCP client rows the bundle inserts.
- harness/packages/codex-app-server/src/errors.js: `skillToggleUnsupported()` (METHOD_NOT_FOUND; the message names `disable-model-invocation: true`).
- harness/packages/codex-app-server/src/index.js:
  - `CAPABILITIES` gains `skillToggle:false` and `mcpConfigWrite:false`. initialize returns `configPath` (configEditor.documentPath, falling back to profileContext.patchPath).
  - New `ctx.on('skills/change')` → `skills/changed {}`.
  - New dispatcher cases:
    - `config/read`: permission of the latest live thread in `params.cwd` (raw path or realpath), else the default;
    - `mcpServerStatus/list` (removed from the empty-list group);
    - `config/mcpServer/reload`: `fiber.restart()` for running MCP entries, `entry.refresh()` otherwise, each failure only logged;
    - `skills/list`: `ctx.skills.snapshot({cwd})`, with a list() fallback;
    - `skills/config/write`: throws;
    - `plugin/installed` and `plugin/read` (`pluginManager.listBundles()`, profileContext.dir; unknown name → -32602).
  - Helpers: profileMcpEntries (configEditor.entries(), falling back to loader.entries()), toolSchemas, configPath, skillsSnapshot, configPermission, reloadMcpServers, profileBundles.
- harness/README.md:
  - new mapping rows: skills/list, config/read, mcpServerStatus/list + reload, plugin/installed|read; the initialize row now covers configPath and the new capabilities;
  - 未实现 rewritten: MCP writes, OAuth and the per-skill switch are not implemented; skills, config/read, MCP status and plugins are;
  - two new limitation lines (MCP status semantics; the user's own dsh profile is not loaded);
  - the workflows line now says workflows run on the DeepSeek core;
  - catalog.js added to the file table.
- app/electron/settings-pages.cjs: `editConfigTarget(serverInfo)` returns configPath, else `<codexHome>/config.toml`, and throws without either. `recordSettingsFailure(result, key, error)`: -32601 → `<key>Unsupported = true`, anything else → `errors[key]`.
- app/electron/main.cjs:
  - desktop-settings-read records the policy, requirements and servers failures through recordSettingsFailure, so -32601 sets policyUnsupported;
  - desktop-edit-config opens `editConfigTarget(client.serverInfo)`;
  - workflows use `workflowCoreCommand(resolveCore(), CODE_DESKTOP_WORKFLOW_BINARY)`.
- app/electron/workflow-service.cjs:
  - `workflowCoreCommand(core, override)`:
    - override → `{command}`;
    - deepseek → `{command, args:[...prefix,'app-server','--stdio']}`;
    - otherwise `{command}`, keeping the runner's default args.
  - createWorkflowService takes `args` (internally `commandArgs`) and sends it to the child as `commandArgs`.
- app/electron/workflow-child.mjs: `clientOptions.args = options.commandArgs` when it is an array.
- app/electron/customize-operations.cjs: mcp-add and mcp-remove throw before any request when `serverInfo.capabilities.mcpConfigWrite === false`. The message names dsh-mcp-client and configPath. Name validation still runs first.
- app/src/settings-model.mjs:
  - `sandboxFacts(config, requirements, {engine})`: the DeepSeek reason is `DEEPSEEK_SANDBOX_REASON` ('Set per session with the Mode menu (DeepSeek Harness permission presets).'); Codex keeps 'Managed by DeepSeek';
  - new `desktopErrors(errors)`: only `connection` → one fixed short notice.
- app/src/source-settings.jsx:
  - raw `desktop.errors` alerts replaced by `desktopErrors` notices (`p.ss-connection-notice role=status`);
  - sandboxFacts gets the engine;
  - Developer Delete only when `mcpConfigWrite !== false`;
  - SourceCustomize gets `core={boot.core}` and `onEditConfig` (only while connected).
- app/src/source-settings.css: `.ss-connection-notice`.
- app/src/customize-model.mjs:
  - `customizeCore(core)` holds the core-aware copy and switches: deepseek, skillToggle, mcpConfigWrite, configPath/configFile, skillRoots, the skills/detail/connectors/plugins notices, skillToggleReason, addConnectorNote, pluginsEmptyHint;
  - skillAuthor('system') → 'DeepSeek Harness'.
- app/src/source-customize.jsx (SKILL_ROOTS and CONFIG_NOTICE removed; pages read `copy`):
  - Skills: skill-specific notices. Without skillToggle, Enabled is a disabled switch inside SourceTooltip with reason 'Set with disable-model-invocation in this skill’s SKILL.md'.
  - Connectors:
    - without mcpConfigWrite, no 'Add custom connector', AddConnectorForm, 'Remove connector' or removal confirm;
    - a `.cz-config-hint` reads "Add a @deepseek-ai/dsh-mcp-client entry to <configPath>, then Reconnect." next to an Edit config button (disabled without a handler);
    - the add/remove/duplicate messages use configFile;
    - the empty state has no config.toml line on DeepSeek.
  - Plugins: core-aware notice and empty hint.
- app/src/source-customize.css: `.cz-config-hint`.
- Tests:
  - harness/tests/catalog.test.mjs (new, 7);
  - app/tests/catalog-wiring.test.mjs (new, 3: bridge catalog output through skillRows / pluginRows / pluginDetailTabs / mcpRows / mcpDefinitions);
  - settings-pages.test.mjs (+2);
  - settings-complete-model.test.mjs (+2);
  - customize-model.test.mjs (+2; one expectation changed from 'DeepSeek' to 'DeepSeek Harness');
  - customize-states.test.mjs (+3 DeepSeek SSR tests, each with a Codex counterpart);
  - workflow-package.test.mjs (+1, and the isolated-child test records the start message through a stub spawn);
  - app/tests/fixtures/workflow-server.cjs logs `{argv}` at initialize.
- work/deepseek-live-20261001/live.mjs: optional `SETTINGS=1`. After the prompts it opens Settings (⌘,), records and screenshots Code, Developer, Skills, Connectors and Plugins, then the first skill's detail. No model calls.

### Tests run
- `cd harness && node --test tests/catalog.test.mjs tests/projection.test.mjs`: 32/32 pass.
- `cd harness && node --test tests/*.test.mjs`: 73/73 pass (B06 left 66).
- `cd app && node --test` on settings-pages, settings-complete-model, customize-model, customize-states, workflow-package, catalog-wiring, developer-server-actions, settings-catalog-search and settings-search: 71/71 pass.
- `cd app && npm test` (after the last code edit): 1192 tests, 1191 pass, 1 pre-existing skip, 0 fail (B06 left 1179; 13 new).
- `npm run build`, then offscreen suites (Codex fixtures):
  - skills-mcp: passed. Add/remove connector, the skill toggle and the Codex config.toml duplicate message are unchanged.
  - workflows: passed.
  - settings-complete: FAILS at settings-complete-ui-test.mjs:156 (Developer Delete → window.confirm). The bootstrap's blocked `dialog.showMessageBox` never reaches Playwright's dialog event, and the click times out. This is pre-existing: I swapped the 11 changed app files back to the snapshot versions, rebuilt, and got the same TimeoutError at line 156; then restored and rebuilt. Every assertion before that line passed with B07 code, including Code tab 'Managed by your organization', the Developer split and Delete still present on Codex.
- Offline bridge probe (scratch script, real runtime, no model calls):
  - initialize → capabilities {…, skillToggle:false, mcpConfigWrite:false}, configPath …/harness/profile/cordis.patch.yml;
  - skills/list → 35 skills, all scope user from ~/.agents/skills, 45 ms (1 ms cached);
  - config/read → workspace-write / on-request, mcp_servers {};
  - mcpServerStatus/list → [] (the profile has no MCP entries); reload → {};
  - plugin/installed → @deepseek-ai/dsh-base and @code-desktop/dsh-code-desktop-app under 'DeepSeek Harness profile';
  - plugin/read → full PluginDetail;
  - skills/config/write → -32601 with the frontmatter hint; unknown plugin → -32602.
- Offline workflow probe: the runner's own AppServerClient, built from `workflowCoreCommand(resolveCore())` (node + bridge script + app-server --stdio):
  - connected in 869 ms;
  - model/list returned deepseek-flash, deepseek-v4-pro;
  - thread/start with the runner's read-only/never params was accepted (readOnly sandbox, approvalPolicy never), then soft-deleted.
- `SETTINGS=1 PROMPTS='[]' node live.mjs b07` (1 run, b07-muplgfcg, no model calls). No renderer errors and no [role=alert] on any page; '~/.codex' appears nowhere.
  - Code: Sandbox row "workspace-write" with the Mode-menu reason.
  - Developer: "No servers added" with Edit config.
  - Skills: 35 rows, author You.
  - Connectors: the DeepSeek notice and the hint with the real configPath plus Edit config.
  - Plugins: 2 rows under "DeepSeek Harness profile".
  - Skill detail (brandkit): switch disabled and checked, the tooltip reason and the frontmatter notice.
- live-smoke was not run: the chat loop (streaming, turns, approvals, resume) is untouched.

### Deviations from the spec
- `shortDescription` is not set from `whenToUse`. The app's skillDescription prefers shortDescription over description, so Harness routing guidance ("Use when…") would replace the real description in the table, the detail page, the composer menu and search. SkillMetadata.shortDescription is optional, so it is omitted.
- Field names follow the TS types: McpServerStatus uses `runtimeStatus` (the spec says "status") plus `resourceTemplates`. PluginSummary and PluginDetail are complete (source carries `path` = the profile dir, which the type requires).
  - BundleInfo has no `meta.name`. The display name is `meta.title` (LocalizedText, English) or the package name. The description is package `description`, else `meta.description`.
- `config/mcpServer/reload`: `Entry.refresh()` only starts an entry that has no fiber, so it is a no-op for a running or failed server. Reconnect therefore calls `fiber.restart()` (Cordis "dispose and reload with current config") for live fibers and refresh() for the rest.
- `config/read` mcp_servers also carry `cwd`, `enabled` and `http_headers` (header names only), because streamable-http headers carry bearer tokens just as env does.
- `desktop-settings-read`: the -32601 rule applies to all three reads (policyUnsupported, requirementsUnsupported, serversUnsupported) through one tested helper, not only to policy. `desktopErrors` drops every non-connection failure, not just -32601 ones, per "render desktop.errors only for connection failures".
- Codex-mode copy changed only where it was garbled or claimed the DeepSeek core:
  - the skills notice ("…Enabling or disabling a skill connector changes are not supported by the DeepSeek core…") now says changes are saved to ~/.codex/config.toml, and the detail notice likewise;
  - the connectors notice now names ~/.codex/config.toml instead of "DeepSeek Harness";
  - the plugins empty hint no longer says "dsh plugin add";
  - skillAuthor 'system' reads 'DeepSeek Harness' on both cores (it read 'DeepSeek' on Codex too).
  - Fixture-observable behaviour (controls, requests, the duplicate-name message) is unchanged, and skills-mcp passes.
- customize-operations also refuses mcp-add and mcp-remove on a core without mcpConfigWrite, as a guard behind the hidden UI. The Developer page's Delete is hidden on that core too (the spec named only Connectors' Remove).
- The workflow child receives the core's arguments as `commandArgs`, because the IPC message's `args` already holds the workflow script arguments (it also shadowed the new parameter inside startRun).
- app/tests/catalog-wiring.test.mjs did not exist. It was created for the cross-module checks (bridge catalog → app models).

### Remaining gaps
- MCP status is fiber-level only. A server whose first connection fails without failOnStartupError still activates with no tools, reconnects by itself and reads Connected with 0 tools. MCP servers are core-wide, so status is not per session. No live MCP server was exercised (the profile has none). reload/restart and the status mapping are unit-tested with entry doubles only.
- MCP writes (config/batchWrite), MCP OAuth and the per-skill switch remain unsupported. Users edit harness/profile/cordis.patch.yml by hand. MCP servers and plugins from the user's own DeepSeek Harness App profile are not loaded or listed.
- plugin/read reports no skills or hooks for bundles. Bundled-skill ownership (pluginId) is not mapped, so skills never group under Plugins.
- Workflows on the DeepSeek core: `developerInstructions` (a script's agent system prompt) and `outputSchema` are ignored by the bridge. No live workflow agent turn was run (the offline probe stops at thread/start). Workflow threads are ordinary sessions and appear in thread/list; the probe soft-deleted its own.
- "Use in message" stays disabled for a skill with `disable-model-invocation: true` ("Enable skill to try in chat"), although no switch exists on this core. Skill invocation itself is B10.
- skills/list ignores `forceReload`: Harness caches completed catalogs and invalidates them through `skills/change`.
- index.js wiring (profileMcpEntries, configPermission, reloadMcpServers, the new cases) has no stdio-level unit test. It is covered by the pure catalog.js tests, the offline probe and the live app run.
- settings-complete still fails at its native-confirm step. This predates B07 and is an adapter/Electron dialog interaction, not app code.

## B08

Snapshot: work/restore-batches/snapshots/B08 (taken before any edit).

### What changed
- harness/packages/codex-app-server/src/account.js (new, pure):
  - `DEEPSEEK_KEY_REF = 'DEEPSEEK_API_KEY'`.
  - `accountReadResponse({keyInfo, platformState})` → `{account: configured ? {type:'apiKey'} : null, requiresOpenaiAuth:false, deepseek:{apiKey:{configured, source}, platform, links}}`. configured = `keyInfo.configured === true` or platform `'credential-stored'`.
  - `providerAccountResponse(providers)`: the old providers answer, used only without a credentials service.
- harness/packages/codex-app-server/src/usage.js (new):
  - `foldSessionUsage(events)` → `{days:{local YYYY-MM-DD: tokens}, longestTurnSec}`.
    - tokens = `usage.inputTokens + usage.outputTokens` per assistant/message; cacheRead/cacheWrite are never added.
    - turn/start → turn/end wall time.
    - A fork counts only events after its last `session/end-seed {inherited:true}`.
  - `accountTokenUsage(summaries, todayKey)` → `{summary:{lifetimeTokens, peakDailyTokens, longestRunningTurnSec, currentStreakDays, longestStreakDays}, dailyUsageBuckets:[{startDate, tokens}] ascending, threadUsage:null}`.
    - Safe integers only (sums capped at MAX_SAFE_INTEGER).
    - Streaks follow the original heavyWorkWorker `oi`: the current streak counts back from today and is 0 when today is idle.
  - `UsageCache(dir)`: `<stateDir>/usage-cache.json` = `{version:1, timeZone, sessions:{id:{revision, summary}}}`.
    - Malformed entries are dropped on load; a file from another time zone is discarded.
    - Unreadable revisions are remembered in memory only.
    - `retain` prunes sessions that are no longer listed; writes are atomic and happen only when dirty.
  - `sessionUsageSummaries({sessions, cache, liveEvents, readEvents, concurrency=4, onError})`:
    - live threads are folded from memory;
    - unchanged revisions come from the cache;
    - the rest are read with at most 4 in flight;
    - sessions without a revision, or live in another owner, are not cached;
    - a failed read is skipped and not retried until its revision changes.
- harness/packages/codex-app-server/src/index.js:
  - `stateDir` is shared by ThreadStore and UsageCache.
  - account/read → `readAccount()`:
    - `credentials.describe(credentialRef('DEEPSEEK_API_KEY'))` (imported from @deepseek-ai/dsh-credentials) and `deepseekAccount.getState()`, each `.catch → null`;
    - no credentials service → providerAccountResponse.
  - Service wait (new): both services start about 50 ms after initialize (measured), so the app's first account/read reached the fallback.
    - `ctx.inject(['credentials'|'deepseekAccount'])` promises; readAccount waits for them for up to 5 s after plugin start (`ACCOUNT_SERVICE_WAIT_MS`).
    - A service arriving after an answer that lacked it sends `account/updated`.
  - account/updated (only after initialize: `clientReady`) on `credentials/reference-updated`, `credentials/record-updated` and `deepseek-account/signed-out`.
  - account/usage/read → `readAccountUsage()`:
    - `sessionQuery.listSessions()` (falls back to persistence.list) minus `store.get(id).deleted`;
    - revisions from `sessionPersistence.list()`;
    - live threads and children via `agent.session.snapshotEvents()`; others via `readSession(id).events`;
    - concurrent calls share one in-flight fold (`usageRead`).
  - account/login/*, account/logout and account/rateLimits/read are unchanged.
  - codeDesktop/diagnostics also reports `credentials` and `deepseekAccount`.
- harness/README.md:
  - account/read row rewritten; new account/usage/read row;
  - CODE_DESKTOP_CORE_STATE is the state directory (threads.json + usage-cache.json); the no-key card is described;
  - limitations: usage is implemented, balance and in-app key entry are not, plus a line on what the usage fold covers;
  - account.js and usage.js added to the file table.
- app/electron/activity.cjs (ledger v2):
  - USAGE_FIELDS gains `cacheWrite`.
  - With an input/output breakdown, tokens = max(0, Δinput − Δcached − ΔcacheWrite) + Δoutput, using the same per-field baseline rule; a thread's first observation without observedUsage only sets the baseline.
  - Applied to day.tokens and day.models[model]. modelUsage records `{input: uncached, output, cached}`.
  - Payloads with only totalTokens still charge the total delta.
  - New days are created with `v: 2`. The first v2 write to a legacy day (`upgradeDay`) does three things:
    - recomputes models[m] from its modelUsage (input − cached + output);
    - makes modelUsage.input uncached;
    - adjusts day.tokens by the difference.
- app/electron/main.cjs: new threads start with `observedUsage.cacheWrite: 0`.
- app/src/home-model.mjs: new exported `dayModelUsage(day)`.
  - v2 days are read as recorded.
  - Legacy days take tokens per model from modelUsage when present (max(0, input − cached) + output), with input normalised to uncached; otherwise the legacy models value is kept.
  - aggregateLedger uses it for chart, totals and the all-time `{in} in · {out} out` usage.
- app/src/account-settings-model.mjs (new): `DEEPSEEK_KEYS_URL`, `deepseekKeyDescription`, and `accountSettingsPlan(snapshot, {engine})`.
  - Returns the deepseek plan (label, the source-based descriptions from the spec, showSignOut/showSignIn false, manageUrl) when `snapshot.deepseek` exists, or when engine is 'deepseek' (null snapshot → 'Account unavailable').
  - Otherwise returns `{kind:'legacy'}`.
- app/src/source-account-settings.jsx: `useAccountSettings` takes `engine` and `onOpenExternal`.
  - The deepseek plan renders one 'DeepSeek API key' row with Refresh and 'Manage keys' (opens manageUrl through `desktopCall('external')`, the action Developer docs already use).
  - That row has no Sign out, no confirmation and no ChatGPT/device-code row. searchText: 'DeepSeek account API key <description> Manage keys Refresh'.
- app/src/source-settings.jsx: passes engine and onOpenExternal to useAccountSettings, and engine to SourceUsage.
- app/electron/usage-model.mjs: `usageEmptyText(engine)` → 'DeepSeek bills per token; there are no plan usage limits.' on DeepSeek; the old copy otherwise. app/src/source-usage.jsx uses it and keeps the daily table.
- app/src/account-label-model.mjs (new): `accountMenuLines(accountRead)` → `{orgPrimary:'DeepSeek API', orgSecondary: apiKey ? 'API key' : null}`, and `accountOrgLine`.
- app/src/main.jsx:
  - accountLabel = orgPrimary (footer); the menu org line is `accountOrgLine(...)` with data-testid user-menu-header-org.
  - New home card when `boot.account.deepseek && !boot.account.account`: 'Add your DeepSeek API key' plus the spec copy, with Refresh (account-auth refresh) and 'Get an API key' (external DEEPSEEK_KEYS_URL). The ChatGPT card is now gated on `!boot.account.deepseek`.
  - loadStats() moved from init() into the mount effect after init().
  - SourceStatsCard gets `accountPending={!boot || (!!boot.connected && boot.account === undefined)}`.
- app/src/source-home.jsx and app/src/use-home-account-usage.jsx: `accountPending` → hook `pending`. A pending account is not read and its status is 'loading'.
- app/src/style.css: `.connection-card-actions` (flex, 8px gap).
- Tests:
  - harness/tests/account.test.mjs (new, 4) and usage.test.mjs (new, 5);
  - app/tests/activity.test.mjs: per-model test rewritten for v2, plus 2 new (the spec's 8836+60+(260+11) case with a cache-write step, and legacy-day upgrade);
  - home-model.test.mjs: 1 new, and the fixture expectations updated (legacy input excludes cached; a modelUsage-only model on a legacy day now counts);
  - account-settings-model.test.mjs (new, 4, including SSR of useAccountSettings via Vite and a main.jsx key-card wiring check);
  - account-label-model.test.mjs (new, 2);
  - home-stats-load.test.mjs (new, 2);
  - home-account-usage.test.mjs and usage-model.test.mjs: +1 each, both feeding harness usage.js output through the app models.
- UI scripts:
  - home-page-ui-test.mjs: Phase A's hold-skeleton check replaced by "card renders before init settles; account row 'Loading account usage…'". Hold geometry stays covered by composer-fixture-test. Fixture ledger days are marked `v: 2`.
  - usage-ui-test.mjs: waits for the 'Test model' trigger instead of 'pro' in the footer, which no longer shows the plan.
  - menus-states-ui-test.mjs: the stale /Codex · Codex/ becomes /DeepSeek API$/ and never 'DeepSeek · DeepSeek'.
  - home-account-usage-ui-test.mjs: added a no-key DeepSeek account/read case (key card, no ChatGPT card, Refresh clears it).
- work/deepseek-live-20261001/live.mjs: optional `ACCOUNT=1` records:
  - the stats card account row and the home cards;
  - the footer and account menu header;
  - the Preferences account row and the Usage page.

### Tests run
- `cd harness && node --test tests/account.test.mjs tests/usage.test.mjs tests/projection.test.mjs`: 34/34 pass.
- `cd harness && node --test tests/*.test.mjs`: 82/82 pass (B07 left 73).
- `cd app && node --test` on the 7 spec files (activity, home-model, account-settings-model, account-label-model, home-account-usage, usage-model, home-stats-load): 40/40 pass.
- `cd app && npm test` (after the last code edit): 1205 tests, 1204 pass, 1 pre-existing skip, 0 fail (B07 left 1192; 13 new).
- `npm run build`, then offscreen suites (Codex fixtures), all passing:
  - home-account-usage (including the new no-key card step);
  - home-page;
  - usage;
  - account-lifecycle (re-run on the final build);
  - menus-states.
  - First runs before the fixes: home-account-usage made 2 account/usage/read calls (fixed with accountPending); home-page failed on the old hold check, then on the ledger total; usage timed out on the 'pro' wait. All three were fixed as described above.
- Offline bridge probes (scratch scripts, real runtime, no model calls):
  - real ~/.dsh: account/read = `{account:{type:'apiKey'}, requiresOpenaiAuth:false, deepseek.apiKey {configured:true, source:'file'}, platform 'signed-out', links present}`, with no account/updated churn.
    - Before the service wait, the same call returned the provider fallback ("DeepSeek, DeepSeek Account"); diagnostics showed credentials/deepseekAccount false right after initialize and true about 57 ms later.
  - account/usage/read: 721,718 tokens on 2026-10-01 across 27 sessions; longestRunningTurnSec 713; keys summary/dailyUsageBuckets/threadUsage; all safe integers.
    - Timing: first fold 577 ms, later 16–42 ms (cache); two concurrent reads gave identical answers.
  - rateLimits are unchanged (credits null). login/start and logout return -32601.
  - Empty temp DSH_HOME without DEEPSEEK_API_KEY: `{account:null, deepseek.apiKey {configured:false, source:null}}`; usage is all zeros with [] buckets.
    - Writing a fake test key to the temp `.credentials.yaml` produced account/updated 128 ms later; the re-read gave `{account:{type:'apiKey'}, source:'file'}`.
- `ACCOUNT=1 PROMPTS='[]' node live.mjs b08` (1 run, b08-mupnl4wd, no model calls). No renderer errors or alerts.
  - Stats card: "Tokens and active days: account · daily history 2026-10-01–2026-10-01", Total tokens 721.7k.
  - No key or ChatGPT card. Footer "Local · DeepSeek API"; menu header "Local user" / "DeepSeek API · API key".
  - Preferences: "DeepSeek API key" / "Saved in DeepSeek Harness (~/.dsh)" with [Refresh, Manage keys], no sign-in row, no "ChatGPT" anywhere.
  - Usage: "DeepSeek bills per token; there are no plan usage limits." and one daily row (2026-10-01, 721,718).
- live-smoke was not run: the chat loop (streaming, turns, approvals, resume) is untouched.
- The runtime wrote ~/.dsh/code-desktop/usage-cache.json during the probes and the live run. That is its own state file (session ids, revisions, day → token counts).

### Deviations from the spec
- Service wait plus re-notify, which the spec does not mention. Without it, account/read during boot always took the providers fallback, so a missing key went undetected exactly when the app first asks.
- Fallback without a credentials service returns `requiresOpenaiAuth:false` (the old answer said true when no provider existed). No branch of this core may ask for ChatGPT.
- account/updated also fires on `credentials/record-updated` (Platform grants) and `deepseek-account/signed-out`. reference-updated is not filtered by ref, so any committed credential change causes one account re-read.
- `accountSettingsPlan(snapshot, {engine})` takes an optional engine, so the DeepSeek core never falls back to the ChatGPT rows (null snapshot → 'Account unavailable'). Without the engine it matches the spec signature.
- Ledger details beyond the spec:
  - modelUsage.input is uncached in v2 (the finding's verification asks for it);
  - new days carry v:2 from creation;
  - the first v2 write converts a legacy day, so the upgrade day is not half inflated;
  - payloads with only totalTokens keep the total-delta rule (there is no cache to exclude);
  - aggregateLedger's all-time `{in} in` uses uncached input for legacy days too.
- The ChatGPT home card is kept for the Codex core, per the instructions. The finding's verification (remove 'Continue with your ChatGPT account') and its in-app key entry (account/login/start apiKey) were not done; the spec puts key entry out of scope.
- accountMenuLines: `{account:null}` → org line 'DeepSeek API' (instructions), not "no org line" (finding). Codex ChatGPT accounts lose the plan in the footer (the spec removes the planType branch), which is why the usage suite's 'pro' wait changed.
- foldSessionUsage counts assistant/message usage only (instructions). The finding's "plus the last chunk of each assistant/attempt" was not done, so failed or retried attempts are not counted.
- Stats-before-connect exposed a race: the 'connection' event can set boot.connected before init returns boot.account, which caused two account/usage/read calls. `accountPending` holds the read (status 'loading') until the account is known. Not in the spec, but needed to keep one read per identity.
- The empty-limits copy lives in usage-model.mjs `usageEmptyText` so it can be tested. It accepts both 'deepseek' (coreEngine) and 'deepseek-harness'.
- The three updated UI scripts and the new home-account-usage step are listed above. menus-states' 'Codex · Codex' assertion was already stale before this batch.

### Remaining gaps
- On DeepSeek the stats card still calls the Harness log fold "account" usage ("Official account usage…" tooltip, "Tokens and active days: account · …"). The numbers come from this machine's ~/.dsh session logs, not a DeepSeek platform bill. The copy was not changed (source-home was out of the spec's file list).
- account/usage/read covers only this DSH_HOME. Other machines and direct API use are missing; failed attempts are excluded.
  - The first read replays every session log (577 ms for 27 sessions here); later reads are cache hits.
  - Cached day keys are local to the time zone stored in the file.
- A Platform-only sign-in (`credential-stored`, no key) counts as configured per the spec. The default route (deepseek-official) still needs DEEPSEEK_API_KEY, so first requests can fail unless a deepseek-account model is chosen. Not exercised live (this machine has a key and no Platform sign-in).
- No in-app key entry; account/login/* and account/logout stay -32601. Balance credits are deferred (rateLimits stay null).
- index.js wiring (service wait, listeners, readAccountUsage, coalescing) has no stdio unit test. The logic sits in the pure account.js and usage.js (unit-tested); the wiring is covered by the offline probes and the live run.
- The no-key home card was verified with the Codex fixture seeded with the bridge's account/read shape, and with the bridge probe on an empty DSH_HOME. The live app was not run without a key (one live run per batch).
- The e2e home-page suite no longer measures the hold skeleton, which now shows only for the ledger IPC. Geometry is still covered by composer-fixture-test.
- Legacy ledger days without a modelUsage record keep their inflated per-model value. A converted legacy day's day.tokens is corrected only for models that have modelUsage.

## B09

Snapshot: work/restore-batches/snapshots/B09 (taken before any edit).

### What changed
- harness/packages/codex-app-server/src/list.js (new, pure):
  - `sessionListMetadataProjection`: the upstream unit (vendor api/session-controller list.ts:25-56, 80) as is. Key 'sessionListMetadata', zod schema `{blank: boolean, lastPromptAt: number|null}`, init `{blank:true, lastPromptAt:null}`, `applySessionListMetadata` (same reference for unrelated events), wire view = state, stateVersion 1. `registerListProjection(registry, warn)` registers it and reports a refused registration.
  - `titleOf(result)`: `status === 'fulfilled' ? value.title?.title : undefined` (SessionTitleObservationResult).
  - `cachedValues(cache, header)`: `cache.cachedSnapshot(header, ['title','sessionListMetadata'])`, else `cachedPredecessorTitle(header)` (upstream projectionsFor). Any throw counts as a miss. The `title` projection value is a plain string (dsh-session-title types), not `{title}`.
  - `coldRow(header, {meta, cacheValues, title})` → `{name, preview, updatedAtMs, blank, titleKnown, recencyKnown}`:
    - name: store name, then cached title, then a title snapshot;
    - preview: the name or '';
    - updatedAtMs: max(createdAt, cached lastPromptAt, store lastPromptAt);
    - blank: the cache says blank and the store has no name.
  - `readColdThread(id, {stat, cache, meta})`: one stat (requireSession, so a missing stat → threadNotFound) plus the cold row. It returns undefined when name or recency is unknown, or for a sub-agent without a stored label.
  - `matchesSearch(row, term)`: case-insensitive substring of name, preview or cwd.
  - `mustStayLoaded({running, activeTurn, pendingRequests, queued, compacting, runningChildren})`.
- harness/packages/codex-app-server/src/errors.js:
  - `sessionBusyElsewhere(id?)` → RpcError(-32000, 'This session is open in another DeepSeek app. Close it there, then try again.', {codexErrorInfo:'sessionBusyElsewhere', threadId});
  - `isSessionOwnedElsewhere(error)`: name 'SessionAlreadyOwnedError' anywhere in the cause chain (inCauseChain).
- harness/packages/codex-app-server/src/projection.js:
  - exported `isActivity(event)`: turn/start, assistant/message, turn/end, and user/message with source.kind 'user';
  - `ThreadProjector.lastActivityMs` (in reset(), so a sub-agent fork's seeded parent history does not count) advances only on those events. `updatedAtMs` is unchanged and still used for stale-compaction settling.
- harness/packages/codex-app-server/src/index.js:
  - apply() registers the unit through `ctx.inject(['sessionProjections'], …)` with `inner.get('sessionProjections')`. `projectionCache()` waits up to 5 s after start for the registry and `sessionProjectionCache`, which come up after stdio is served.
  - LiveThread: `lastActivityMs` starts null and is set from `projector.lastActivityMs` after hydrate. onEvent copies it monotonically and no longer stamps Date.now() on every event. The turn/start request bump stays.
  - threadObject takes `cold`. `updatedAt = max(createdMs, live?.lastActivityMs ?? projector?.lastActivityMs ?? cold.updatedAtMs ?? createdMs)`. Name and preview fall back to the cold row.
  - thread/read with includeTurns !== true, for an id that is neither live nor a running child, goes through `readColdThread`: one stat plus the cache, no readSession. If the row is unusable it falls back to historyFor. After that replay, `seedListCache` calls `sessionProjectionCache.coldSnapshot(header, inheritedEventCount, events)` (historyFor now returns inheritedEventCount) and remembers a sub-agent's label, so the next read is cold. The seed is skipped for sessions live in ctx.sessions or when the unit was not registered.
  - listThreads:
    - cold rows come from the cache;
    - blank rows are dropped, and so are live rows with no activity and no name;
    - `params.searchTerm` is applied;
    - sorting and paging are unchanged;
    - `readTitleSnapshots` (titleOf) runs only for page rows that are still unnamed and had no cached title row.
  - turn/start: `store.update(id, {lastPromptAt})`.
  - thread/unsubscribe and thread/close answer immediately. Unsubscribe returns `{status: 'unsubscribed' | 'notLoaded'}`, close returns {}. `unload()` closes the thread in the background and tracks it in `unloading`. `keepLoaded` skips the close while any of these hold: agent running, open turn, pending client request, inbox nextTurn, compaction, or a running child of this root.
  - openThread awaits a pending unload of the same id before resuming. A resume failure with SessionAlreadyOwnedError in its cause chain, while no agent of this process holds the id, becomes `sessionBusyElsewhere(id)`.
  - quiesce also awaits background unloads.
- harness/README.md:
  - new mapping rows: session list (cold rows, shared cache, sessionListMetadata registration, lastPromptAt, blank, searchTerm, replay + seed fallback, 5 s wait), updatedAt semantics, thread/unsubscribe|close, sessionBusyElsewhere;
  - the sub-agent row now describes titles from the cache;
  - two limitation bullets;
  - list.js added to the file table.
- app/electron/main.cjs: 'thread/unsubscribe' added to the rpc allowlist.
- app/electron/desktop-settings.cjs: the inactivity sweep treats status 'notLoaded' like 'idle'. The background-terminal, child and worktree checks are unchanged.
- app/src/session-unload-model.mjs (new, pure):
  - `shouldUnload({previous, next, engine, active, pendingApproval, queued, resumed})`: true only for engine 'deepseek', previous set, previous !== next, not active, no approval or queue, and `resumed.has(previous)`;
  - `sessionWork({id, active, approvals, ownerOf})`: an open turn or card on the session or any of its sub-agents (state.js ownerThreadId). A card without a threadId counts as pending.
- app/src/main.jsx:
  - `releaseSession(previous, next)` runs at the start of openSession (covers navigate, back/forward and going home). It also runs when a resume answers after the user already left.
  - busy means: sessionWork, a pending session operation, actionLock, or a send in flight. If the session can be unloaded, it is removed from `resumed.current` and `rpc('thread/unsubscribe')` is sent with errors ignored.
- Tests:
  - harness/tests/thread-list.test.mjs (new, 10);
  - harness/tests/errors.test.mjs (+1, with the installed SessionAlreadyOwnedError);
  - harness/tests/projection.test.mjs (+1);
  - app/tests/session-unload-model.test.mjs (new, 2);
  - app/tests/settings-complete-model.test.mjs (+1: notLoaded → exactly one thread/archive, active/systemError → none).
- harness/tests/live-smoke.mjs:
  - UNLOAD step after LIST: a second core with its own bridge store resumes the smoke thread and gets busy-elsewhere. It then reads the cold row, the first core unsubscribes, and the second core resumes successfully. The step also lists with searchTerm;
  - COLD READ in the fresh core before the cold resume.
- work/deepseek-live-20261001/live.mjs: optional `UNLOAD=1`. After the prompts:
  - a second core (own store, same DSH_HOME) tries thread/resume of the session;
  - the app goes home (New) and the second core retries resume for up to 10 s;
  - the app reopens the row and records messages and alerts.

### Tests run
- `cd harness && node --test tests/thread-list.test.mjs tests/errors.test.mjs tests/projection.test.mjs`: 42/42 pass.
- `cd harness && node --test tests/*.test.mjs`: 94/94 pass (B08 left 82).
- `cd app && node --test tests/session-unload-model.test.mjs tests/settings-complete-model.test.mjs tests/sidebar-model.test.mjs`: 32/32 pass.
- `cd app && npm test` (after the last code edit): 1208 tests, 1207 pass, 1 pre-existing skip, 0 fail (B08 left 1205; 3 new).
- `npm run build`, then offscreen suites on Codex fixtures (openSession now always computes releaseSession): session-actions (run after the final edit), sidebar and connection-lifecycle all passed.
- Offline bridge probes (scratch scripts, isolated DSH_HOME and state dir, no key):
  - a blank thread/start is not listed; searchTerm matches by name and by cwd;
  - core B gets `-32000 sessionBusyElsewhere` while core A has the session;
  - A's unsubscribe answers `{status:'unsubscribed'}` (then `notLoaded`), after which B resumes; A then gets busy-elsewhere until B unsubscribes;
  - cold reads in another core and after a restart return name 'Probe name', preview = name (no replay) and updatedAt = the prompt time;
  - the cache record holds `sessionListMetadata {blank:false, lastPromptAt}`, and the blank session's record holds `{blank:true}`.
- Seeding probe: with the row and the store lastPromptAt removed, round 1 replays (preview = the first prompt) and writes the row back; round 2 is cold.
  - This probe exposed a startup race: right after initialize, `sessionProjectionCache` was not active yet and round 2 replayed. The 5 s service wait fixed it.
- `cd harness && node tests/live-smoke.mjs` (1 run):
  - all earlier steps unchanged: init, notFound, turns, queue, compact, read, plan, ask, extra root, sub-agent, stop, resume order;
  - UNLOAD = `{busy:"-32000 sessionBusyElsewhere", cold:{name:"DeepSeek core smoke", preview:"DeepSeek core smoke", status:"notLoaded"}, unsubscribed:{status:"unsubscribed"}, reopened:"resolved"}`, and the search returned only "DeepSeek core smoke" rows;
  - COLD READ in the fresh core: name = preview = "DeepSeek core smoke", notLoaded.
- `live.mjs b09` (1 real-API run, b09-mupp3bk0, UNLOAD=1, PROMPTS ["Reply with only the word OK."]):
  - reply "OK", no renderer errors;
  - whileOpen busy-elsewhere, but afterLeaving was still busy after 10 s. Cause: releaseSession treated `turnRequested === previous` as in flight, and turnRequested stays set after the turn ends. That condition was removed (a just-answered turn/start is guarded by the bridge: running agent or inbox);
  - reopen worked (1 message, no alerts).
- `live.mjs b09-offline` (b09-offline-mupp94au, same flow with an isolated DSH_HOME/state and no key, so no API request; the turn fails locally with "no API key"):
  - whileOpen busy-elsewhere; afterLeaving resolved 268 ms after clicking New;
  - reopen shows the same transcript as before leaving (user message + API error card), no alerts.

### Deviations from the spec
- Cold thread/read falls back to the replay more often than specified: whenever name or recency is unknown, and for a sub-agent without a stored label. The spec falls back only when there is neither a cache entry nor a store name. Older sessions have a title row but no sessionListMetadata, so for them updatedAt would fall to createdAt. The sidebar would then sort them by creation, and the now-enabled notLoaded sweep could archive a session created long ago but used recently. To keep this one-time, the replay seeds the cache (`coldSnapshot`); that step is not in the spec.
- Recency is max(createdAt, cached lastPromptAt, store lastPromptAt) instead of a `??` chain, so a lagging cache row cannot hide a newer stored prompt. threadObject also clamps to createdAt, because a user fork's copied history is older than the fork.
- listThreads calls readTitleSnapshots only for page rows whose cache had no title row. When the cache answers title null (most sub-agents), that answer is kept. Otherwise the Tasks pane's 2 s poll would keep folding child logs.
- Live rows with no activity and no name are dropped like blank cold rows.
- Registration goes through `ctx.inject(['sessionProjections'])` instead of a bare `ctx.get` at apply time: the service may not be active yet when apply runs. A key already registered at version 1 is shared by the registry itself (ref-counted, first definition kept), and a version clash throws, which is logged. This is the "skip if already registered". The cold paths wait up to 5 s after start for both services (see the probe above).
- thread/unsubscribe answers the Codex ThreadUnsubscribeResponse `{status}` instead of `{}`; thread/close still answers {}. No `thread/closed` notification is sent (the app does not handle it).
- keepLoaded adds two guards to the spec's list: an open projector turn, and a running sub-agent child of this root. close() drains continuable descendants, which would stop background sub-agents.
- openThread waits for a pending background unload of the same id. Without that wait, an in-process SessionAlreadyOwnedError would be misreported as "another DeepSeek app". The mapping is also skipped when an agent of this process holds the id.
- sessionBusyElsewhere data also carries `threadId` (same as threadNotFound).
- App: the busy check also includes pending session operations, actionLock and a send in flight. A sub-agent's turn or card counts for its session (`sessionWork`). The check runs at the top of openSession, so it also covers travel and going home. It runs again when a resume answers after the user left. `turnRequested` is deliberately not used (see the live run).
- store.js needed no change: `update` stores any field.
- The finding's optional loadSessions → single thread/list was not done. Each thread/read is now one stat plus a cache read.
- The finding's fork/sub-agent split and origin-only classification were already done in B06.

### Remaining gaps
- A session open in the DeepSeek app still opens to the generic transcript load-failure state ("Retry"). The friendly sessionBusyElsewhere message shows only in the banner when rows are already displayed. The source's "Can't confirm it's closed" picker status is not ported (no picker yet).
- Cold reads report the default model route, not the session's logged model; thread/resume reports the real one. Nothing in the renderer reads the model from thread/read today.
- The two kinds of row disagree slightly. Cold rows use the last human prompt time (upstream semantics), while live and replayed rows use the last reply or turn end. A row can move by the length of its last turn when it changes from live to cold. Cache rows are throttled (200 events or 5 s; always at turn end and disposal), so a session active in another process can lag by seconds.
- Sessions stay loaded while busy, and there is no idle reaper. A session left while running keeps its lock until the user leaves it again after it finishes, or quits. The app releases only on navigation away. A popout of a released session still gets its plan from the primary window's state, but receives no live events (an idle session produces none anyway).
- Search covers only names known at filter time. A row whose name comes from readTitleSnapshots (no cached title row) cannot match by name.
- The inactivity sweep refuses to archive when `thread/list {sourceKinds:['subAgent'], limit:100}` has a next page. With more than 100 sub-agent sessions under ~/.dsh, auto-archive still never fires (pre-existing; there are 31 cached sessions here now).
- index.js wiring (registration, projectionCache wait, unload/keepLoaded, the cold thread/read branch, the seed) has no stdio unit test. The pure parts are in list.js and errors.js (unit-tested), and the wiring is covered by the offline probes, the live smoke and both live.mjs runs.

### B09 review fixes

No new snapshot; snapshots/B09 stays the pre-batch baseline.

- Major, unloading an idle session killed its background jobs (index.js keepLoaded, list.js):
  - `mustStayLoaded` takes `jobsRunning`. keepLoaded sets it with `ownsRunningJob(ctx.get('jobs'), [thread.id, ...descendants])`: a job in `jobs.list(owner)` owned by that id with status running or stopping. This is the same test as upstream's dsh-jobs archive admission.
  - `descendantIds(ctx.agents.list(), rootId)` walks sub-agent lineage at any depth: origin 'subagent' plus parentSession, skipping forks and loops. close() drains descendants, and their jobs die with them, so their jobs count too. A running descendant now also counts as runningChildren, not only the `children` map.
  - The upstream `workspace/session-activity` waterfall was not used. Its `schedule` family would keep a thread loaded for armed reminders, which outlive the agent anyway, and its `job` family covers only the root.
- Major, "Allow for this session" lost on leaving a session (index.js):
  - `grantsById` in apply() keeps each thread id's SessionGrants for the life of the core.
  - The LiveThread constructor reuses the stored grants, so a reopened thread gets its grants and its last preset back. Escalation grants are still dropped when the effective preset changes.
  - thread/delete drops the entry. Child approvals use `root.sessionGrants` and are unchanged.
- Minor, cold rows stale for the life of the core (list.js `CacheRevisions`, index.js):
  - The B09 wording "can lag by a few seconds" was wrong. The storage domain loads the projection-cache table once per process, so checkpoints another process writes after this core starts are never seen here.
  - thread/read without turns now compares the log's stat revision with the revision the table is known to reflect. Sources:
    - `sessionPersistence.list()`, taken once the cache service is active. projectionCache() now also waits for this listing (`listServicesReady`);
    - the stat revision recorded after a replay seeded the row;
    - the revision stat'd after this core's own unload (the disposal checkpoints).
  - A different or unknown revision gives `cold: undefined`, so the read replays. readColdThread now returns `{header, revision, cold}`.
  - thread/list does not check revisions (the Tasks pane polls it every 2 s). Its rows refresh once a thread/read has replayed and seeded.
- Minor, archiving a loaded session kept its lock (index.js thread/archive): an idle loaded thread (`!keepLoaded`) is unloaded like an unsubscribe. This covers the app's archive action, which drops the id from `resumed` without unsubscribing, and the inactivity sweep. No app change was needed.
- Minor, the per-turn lastPromptAt write clobbered another core's threads.json (store.js): `update` re-reads the file, keeps the in-memory copy only when the file is unreadable, patches its own entry and writes. The workflow runner's core no longer writes back its startup copy over the main core's renames, archives and soft-deletes. Writes are still unlocked, so two updates in the same instant can lose one.
- Minor, seeding from in-memory closers (list.js `seedable`, index.js seedListCache): no seed when the replayed log ends in a turn/end with reason `interrupted`, which is readSession's `interruptedTurnClosers` for a turn still open in storage. seedListCache returns whether it wrote, and only then is the revision recorded.
- Minor, zod undeclared: `"zod": "^4.4.3"` (the range the dsh packages use) was added to packages/codex-app-server/package.json and to its package-lock.json entry. Both were edited by hand, with no install. `npm ls` resolves the hoisted zod@4.6.5 for the bridge.
- README:
  - session list row: seedable, revision check, thread/list exception;
  - unsubscribe/close row: jobs, descendants, archive;
  - grant row: per-id for the core's life;
  - CODE_DESKTOP_CORE_STATE row: shared threads.json, read-merge-write;
  - limitations: grants survive reopen, stale-row wording corrected, archive releases the lock, jobs invisible to backgroundTerminals/list;
  - list.js file row.

#### Tests run
- `cd harness && node --test tests/thread-list.test.mjs tests/errors.test.mjs tests/projection.test.mjs tests/store.test.mjs tests/approval.test.mjs`: 61/61 pass.
  - thread-list.test.mjs: 10 → 14 tests (revision staleness, seedable, ownsRunningJob, descendantIds), plus jobsRunning in mustStayLoaded and the new readColdThread shape.
  - store.test.mjs (new, 1): two stores share one file, plus an unreadable file.
- `cd harness && node --test tests/*.test.mjs`: 99/99 pass (B09 left 94).
- `cd app && node --test tests/session-unload-model.test.mjs tests/settings-complete-model.test.mjs tests/sidebar-model.test.mjs`: 32/32 pass (no app file changed).
- `cd app && npm test` (after the last code edit): 1208 tests, 1207 pass, 1 pre-existing skip, 0 fail.
- Offline probe through the real runtime. Setup: a scratch script with two (then three) bridge cores on an isolated DSH_HOME, each with its own state dir. A local fake Anthropic Messages endpoint (`DEEPSEEK_BASE_URL`, dummy key) scripts the model, so nothing reached the real API.
  - Jobs:
    - the bash schema offers `run_in_background`;
    - after a `sleep 8` background job, unsubscribe answered `unsubscribed`, but liveThreads stayed 1 and core B got `-32000 sessionBusyElsewhere`;
    - the job finished and its completion turn ran ("background job bash-1 … finished" reached the model);
    - the next unsubscribe unloaded the thread (liveThreads 0), and B resumed.
  - Grants: an Ask-mode `echo grant-probe` was answered acceptForSession. After unsubscribe (liveThreads 0), the same command in Ask mode raised no card.
  - Own unload: thread/read straight after this core's unsubscribe was cold (preview = the store name).
  - Archive: thread/archive on the loaded idle thread → liveThreads 0, and B resumed.
  - Staleness:
    - B ran a turn the fake model held open. Both of A's mid-turn thread/reads replayed (preview = first prompt, updatedAt = B's turn start); the second still replayed, so nothing was seeded from the closers.
    - After B's turn and unsubscribe, A's next read replayed and seeded, and the one after was cold with B's prompt time. A's thread/list row showed the same time.
  - A fresh core's first thread/read, right after initialize, was cold: it waited for the revision listing.
- Live checks were not rerun. B09 already used its one live-smoke run and its one real-API live.mjs run. The offline probe covers the new wiring with the real runtime.

#### Remaining gaps
- `thread/backgroundTerminals/list` still answers []. The Tasks pane cannot show or stop Harness jobs. The inactivity sweep's background check cannot see them, so it can flag a loaded, idle session as archived while its job runs. The thread stays loaded and the job survives. Serving jobs there also needs `thread/backgroundTerminals/terminate` → `jobs.kill`.
- A thread kept loaded by a job, a busy sub-agent or any other guard is not unloaded when that work ends. It unloads when the user leaves it again, archives it, or quits (same as B09's busy case).
- thread/list rows of a session another process wrote after this core started stay at the old title/lastPromptAt until a thread/read replays it or the core restarts.
  - A write racing the startup listing (between the table load and the listing) is missed until that session's next change.
  - A session mid-turn in another process replays on every thread/read, the pre-B09 cost, only for that session.
  - So does a log whose last durable event is a crash closer (`interrupted`), which `seedable` cannot tell from an in-memory one.
- Each of this core's own unloads costs one stat. A sub-agent that ran in this process replays once on its next cold read, because its log changed after the listing.
- Grants live only in the core's memory, so a core restart still drops them (documented).
- threads.json read-merge-write is not locked across processes.
- index.js wiring still has no stdio unit test. It is covered by the offline probe above.

## B10

Snapshot: work/restore-batches/snapshots/B10 (taken before any edit).

### What changed
- harness/packages/codex-app-server/src/input.js (new; pure apart from file reads):
  - `encodeTextPart(part)`: the canonical text forms.
    - localImage fallback `[Attached image: P — use read_image to view it]`;
    - image URL `[Attached image URL: U]`;
    - mention `[Referenced: P]`;
    - skill `/name` when the name matches dsh-tool-skill's SKILL_GESTURE grammar `^[a-z0-9]+(?:-[a-z0-9]+)*$`, else `[Use the N skill (P)]`.
  - `imageMediaType(bytes)`: png/jpeg/gif/webp from the magic bytes.
  - `toHarnessContent(input, {imageAllowed, attachments, modelName, read})`:
    - text → text block;
    - with a store, every localImage is read, typed and saved in ONE `attachments.saveImages(batch)` per message (Uint8Array data, name = basename), and the `{type:'image', attachment}` block goes in its slot;
    - `!imageAllowed` with a store → RpcError(-32602, `Model "<name>" does not support image input.`), nothing saved;
    - no store → the text fallback;
    - other parts → encodeTextPart.
    - Unreadable files, unknown formats and store admission refusals (`isImageAdmissionError`: size, pixels, count) are -32602. Storage faults rethrow.
  - `toCodexInputs(content, {imagePath})`:
    - a text block whose whole text is one bracket form → localImage / image / mention (name = basename) / skill;
    - `/name` stays text;
    - an image block → localImage at `imagePath(ref)` (a throw or no path → text '[image]');
    - other text → `{type:'text', text, text_elements: []}`.
  - `promptText(content)`: text blocks that are not bracket forms (the preview).
- harness/packages/codex-app-server/src/projection.js:
  - ThreadProjector takes an `imagePath` option;
  - applyUserMessage uses toCodexInputs, and the preview comes from promptText (no markers, no '[image]');
  - `userInputsOf(message, options)` is kept as an alias over toCodexInputs;
  - the module doc names the user-message mapping.
- harness/packages/codex-app-server/src/queue.js: `toQueuedSubmission(message, remembered, imagePath)` rebuilds input after a restart with toCodexInputs, and ThreadQueue takes `imagePath`.
- harness/packages/codex-app-server/src/models.js:
  - description = `entry.model.description ?? ''`;
  - new `modalitiesOf(entry)` (resolved info, then the listing, then ['text']) used by model/list `inputModalities`;
  - new `ModelCatalog.entryFor(route)`.
- harness/packages/codex-app-server/src/index.js:
  - Config default model 'deepseek-flash';
  - `imagePath = (ref) => ctx.get('attachments')?.imageHostPath(ref)` is passed to the LiveThread, ChildThread and historyFor projectors and to ThreadQueue;
  - `inputMessage(input, thread)` is async. When the input has a localImage and the store is mounted, it loads the catalog and sets imageAllowed = modalitiesOf(entryFor(thread.selection.current ?? defaultRoute)).includes('image') and modelName = the catalog display name;
  - turn/start and turn/steer await it, and ThreadQueue gets `(input) => inputMessage(input, this)` (queue add/update already awaited it since B02);
  - turn/steer re-checks the active turn after the await (see deviations);
  - contextWindow() uses entryFor.
- harness/packages/code-desktop-app/cordis.patch.yml: `model: deepseek-flash`.
- harness/README.md:
  - model/effort row (default id, catalog-only descriptions, inputModalities);
  - new user-input row (both directions, refusal, fallback, imageHostPath);
  - the image limitation rewritten (only text-only models; stored copy in bubbles; text_elements not kept; skills as `/name` text);
  - input.js file row; models.js and bundle rows.
- harness/tests:
  - input.test.mjs (new, 5);
  - models.test.mjs (new, 2);
  - projection.test.mjs (+1);
  - queue.test.mjs (+1);
  - live-smoke.mjs gets an INPUT step: a deepseek-flash thread gets [text, mention, localImage of a generated solid red PNG], and a deepseek-v4-pro thread checks the refusal. input-smoke.png is cleaned at start.
- app/src/composer-attachments-model.mjs:
  - `IMAGE_MODEL_ERROR` 'The selected model doesn’t support image input.';
  - `modelAcceptsImages(model)`: false only when inputModalities is a list without 'image';
  - stageFiles option `imagesAllowed` (default true). When false, image files are dropped with that one notice and no size/cap notice, and other files still stage.
- app/src/main.jsx: `imagesAllowed = modelAcceptsImages(chosen)` on every staging lane:
  - Add files dialog;
  - paste/drop (stageComposerFiles, which takes the composer's value, both referenced and clipboard stageFiles calls);
  - the Changes pane "Attach as context";
  - queue Edit restore, which now also shows its notices.
- app/src/source-composer.jsx:
  - paste/drop pass `imagesAllowed: modelAcceptsImages(model)`;
  - the effort trigger's aria-label is `Effort: ${effortName(effort)}`;
  - effortName now comes from model-menu-model.mjs.
- app/src/model-menu-model.mjs (new, pure):
  - `effortName`;
  - `modelMenuSections({models, fastTier})` → {primary, overflow, showFast: !!fastTier}. This is the old first-four / explicit-section split moved out of the component.
- app/src/source-model-menu.jsx:
  - uses modelMenuSections;
  - drops the local 'Default' badge and shows a catalog badge (`badge.message`, as pS) only;
  - renders the Fast separator, header and row only when showFast. The disabled "not available" row is gone; /fast and Cmd+Alt+F gating are unchanged.
- app/src/source-settings.jsx: effort select labels use effortName (Off/Low/High/Max).
- app/tests:
  - model-menu-model.test.mjs (new, 3);
  - composer-attachments-model.test.mjs (+1);
  - source-composer-dictation.test.mjs: the aria-label case now asserts 'Effort: Low' and 'Effort: High'.
- app/scripts:
  - code-ui-test, composer-fixture-test, tooltip-ui-test: the 'Reasoning effort' selectors become `{name: /^Effort: /}`;
  - menus-states-ui-test step 4: the disabled-Fast-row assertions become "no Fast separator/header/row for a model without a tier, End lands on More models". The step 8b Fast row with a real tier is unchanged.
- work/deepseek-live-20261001/live.mjs:
  - optional `IMAGE=1`: paste a 16×16 red PNG before the first prompt, then record user bubbles (tiles loaded/from the store, file cards, text);
  - optional `MENU=1`: record the model menu rows/badges/Fast, the effort trigger name, then pick DeepSeek-V4-Pro and paste again.

### Tests run
- `cd harness && node --test tests/input.test.mjs tests/projection.test.mjs tests/models.test.mjs`: 34/34 pass.
- `cd harness && node --test tests/*.test.mjs`: 108/108 pass (B09 left 99). The suite was rerun after the last index.js edit.
- `cd app && node --test tests/composer-attachments-model.test.mjs tests/model-menu-model.test.mjs tests/source-composer-dictation.test.mjs`: 17/17 pass.
- `cd app && npm test` (after the last app edit): 1212 tests, 1211 pass, 1 pre-existing skip, 0 fail (B09 left 1208; 4 new).
- `npm run build`, then offscreen suites on Codex fixtures: menus-states (updated step 4, the Fast row with a real tier, model rows), composer-states (Codex paste/drop lane unchanged, no inputModalities), tooltip and code (new Effort selector). All passed.
- Offline bridge probe (scratch script, isolated DSH_HOME and state, no key):
  - model/list: deepseek-flash description '' and isDefault; V4-Pro keeps its catalog description;
  - turn/start [text, mention, skill pdf, localImage] → live item/started, thread/read and a cold replay in a fresh core all give [text, mention, text '/pdf', localImage at `<DSH_HOME>/attachments/v1/objects/97/…`]. The file exists, the preview is '@red.png what color?\n/pdf', and thread/start reports model deepseek-flash;
  - V4-Pro + localImage → `-32602 Model "DeepSeek-V4-Pro" does not support image input.`, and the thread has 0 turns;
  - thread/queue/add with an image → stored and replayed as localImage.
- `cd harness && node tests/live-smoke.mjs` (1 run):
  - INIT, NOT FOUND, MODELS (`deepseek-flash*` now the default), turns 1/2, QUEUE, COMPACT, READ, UNLOAD, PLAN, ASK, EXTRA ROOT, SUBAGENT, SUBAGENT STOP, COLD READ and RESUME are unchanged from B09;
  - INPUT = `{model:"deepseek-flash", live:["text:…","mention:ui-smoke.txt","localImage:store"], replay: same, preview: the typed text, tools:[], reply:"Red", status:"completed", textOnly:"-32602 Model \"DeepSeek-V4-Pro\" does not support image input."}`. The vision model read the image as an image block, with no read_image call.
- `IMAGE=1 MENU=1 live.mjs b10` (1 real-API run, b10-muprnda2, prompt "What is the dominant color of the attached image?…"):
  - no renderer errors; the pasted PNG staged ready; reply "Red";
  - the user bubble has one loaded 16 px image tile from the store path, no file card, and only the typed text;
  - Effort trigger 'Effort: Low';
  - model menu rows: DeepSeek-V41-Flash (no description, no badges) and DeepSeek-V4-Pro (catalog description); no Fast section;
  - after picking V4-Pro, the pasted PNG made no pill and showed the alert "The selected model doesn’t support image input." (screenshots 02b-done, 0m-model-menu, 0m-text-only-paste).

### Deviations from the spec
- imageAllowed reads `modalitiesOf(entry)`: the resolved info's inputModalities, then the listing's, then ['text']. model/list now uses the same function (it used the listing only), so the app's gate and the bridge's check cannot disagree. A route the catalog does not list counts as text only, as upstream's ACP assertImageRoute treats unknown modalities.
- The `Model "<name>"` refusal uses the catalog display name (DeepSeek-V4-Pro), falling back to the model id, because the app shows display names.
- The preview helper `promptText` also leaves out the '[image]' fallback text. Old sessions whose images were sent as `[Attached image: P …]` markers now replay as image tiles at the original path.
- The ChildThread projector also gets imagePath (the spec names LiveThread and historyFor), so a sub-agent's live and replayed items agree.
- turn/steer: the steered message is now built after an await (image saving). If the active turn changed or a compaction started meanwhile, the bridge answers -32600 activeTurnNotSteerable, and the app's existing steer→queue fallback takes it. Before, the build was synchronous and this race did not exist.
- stageFiles with `imagesAllowed:false` reports only the model notice for refused images (no 30 MB or cap notice). The type toast for a non-image paste is unchanged. Lanes besides paste/drop (the Add dialog, Changes pane attach, queue Edit restore) also gate, and the restore lane now surfaces notices it used to swallow.
- The source-model-menu badge renders `model.badge.message` when the catalog has one (pS reads `e.badge.message`). Codex and the bridge send none, so no badge is shown in practice.
- `effortName` moved from source-composer.jsx into model-menu-model.mjs so Settings uses the same capitalization.
- menus-states-ui-test was updated, because its step 4 asserted the disabled Fast row that this batch removes (spec-mandated for Codex too: the original omits the section).

### Remaining gaps
- `text_elements` (inline @mention chip ranges) are not stored. Replayed text parts carry `[]`, so a reopened prompt shows the plain '@path' text plus the file card, not the chip (the finding's optional sidecar was not built).
- A skill shows in the user bubble as '/name' text, not as a skill chip or card. A skill that is not user-invocable gets no injection from the gesture; the model only sees '/name'. Bracket-form skills render as a file card at the skill path, as under Codex.
- Bubble images are the store's normalized copies (`~/.dsh/attachments/v1/objects/…`, no extension, possibly downscaled or re-encoded): the tile's alt/title is the hash, not the original file name (the ref's `name` is not surfaced). Queue entries remembered in memory still show the original path until a restart.
- An image staged before switching to a text-only model is not removed from the composer. Sending is refused by the bridge (-32602, shown as the send error) instead of at staging time.
- Image size limits differ: the app accepts up to 30 MB, attachment-local refuses over 20 MB (`IMAGE_TOO_LARGE`, surfaced as -32602 with the store's message). Remote image URLs still reach the model only as `[Attached image URL: U]` text.
- The turn/steer re-check after the await, and the steer/queue image paths in index.js, have no stdio unit test. Queue add with an image was exercised by the offline probe. Steer with an image was not exercised live.
- Harness's own session/title (the dsh-session-title fallback; the bundle disables the LLM titler) is computed from the raw message text, which may include '[Referenced: …]' blocks (not checked). The app names sessions from the draft and the store name wins in threadObject, so app-created sessions are unaffected.

## B11

Snapshot: work/restore-batches/snapshots/B11 (taken before any edit).

### What changed
- harness/packages/codex-app-server/src/projection.js:
  - new exported `codexErrorInfoOf(failure)`: AUTH / INVALID_CREDENTIAL / MISSING_CREDENTIAL → 'unauthorized'; RATE_LIMIT → 'rateLimitExceeded'; SERVER → 'serverOverloaded' for 503/529, else 'internalServerError'; TRANSPORT / TIMEOUT → `{responseStreamConnectionFailed:{httpStatusCode: status ?? null}}`; CONTEXT_WINDOW_EXCEEDED → 'contextWindowExceeded'; INVALID_REQUEST → 'badRequest'; QUOTA / ACCOUNT_QUOTA → 'usageLimitExceeded'; anything else (EMPTY_RESPONSE, HTTP_<n>, UNKNOWN) → null. Every value checked against analysis/codex-protocol/v2/CodexErrorInfo.ts.
  - new exported `failureError(failure, message?)` → a Codex TurnError: codexErrorInfo from the code, additionalDetails = the code (unless the code is the whole message, as before).
  - turnError (turn/end `{kind:'error'}`) uses failureError.
  - llm/retry: error = failureError(failure, failure.message || code || 'Request failed'), plus the bridge field `retry: {attempt: data.retry ?? null, maxRetries: data.maxRetries ?? null}` (an 'always' policy has no maxRetries → null).
- harness/packages/codex-app-server/src/index.js: agent/error notifies `failureError(error?.failure ?? error, errorChain(error))`. A live LlmError keeps its provider facts (status) in `.failure`; a plain Error has no code and keeps the old null/null shape.
- harness/README.md: new `Turn.error` / `error` mapping row; the commandExecution row names the `description` field; the dynamicToolCall row lists the app's Harness tool words and the title fallback.
- app/src/turn-error-model.mjs:
  - new 'billing' category (headline 'Billing issue', hint 'Add credits to your DeepSeek balance to continue.', retryHelps false, warning icon as source OF);
  - new `turnErrorCategory(error)`: additionalDetails QUOTA or ACCOUNT_QUOTA → billing, otherwise classifyTurnError(codexErrorInfo);
  - describeTurnError: an auth category whose additionalDetails is AUTH / INVALID_CREDENTIAL / MISSING_CREDENTIAL gets `DEEPSEEK_AUTH_HINT` 'Check your DeepSeek API key in DeepSeek Harness settings.'; Codex copy otherwise.
- app/src/state.js: error willRetry:true stores `attempt` and `maxRetries` (positive integers from `params.retry`, else null) in retrying[id].
- app/src/transcript-status-model.mjs: `retryingLabel(attempt, maxRetries)` → 'Retrying (n/max)' when both are positive integers, else 'Retrying…'; `retryingStatus(entry)` maps a retrying entry to `{error: retryShortLabel(codexErrorInfo), attempt, maxRetries}`; transcriptStatusPresentation's `retrying` accepts that object (a plain string still works).
- app/src/main.jsx: passes `retryingStatus(retryingNow)` as the status row's `retrying` (was the bare short label); the retryShortLabel import moved to the status model.
- app/src/description-verb-model.mjs (new): `describeVerb(description)` → {running, done, infinitive} | null. It is an independent port of ZD with the GD/KD/XD/qD/JD helpers and the VD/HD/UD/jae/Mae tables as data (approval-current.js:3551-3792; caller :4118-4160, hO :6022).
- app/src/command-row-model.mjs: `commandRowLabel(command, state, description)`. With a non-blank description:
  - busy → tenses.running ?? description;
  - done → tenses.done ?? description;
  - failed with tenses → `Failed to ${infinitive}`; meta is null in all three;
  - otherwise (failed without tenses, blocked, stopped, denied, unknown) → the existing verb with meta = description.
  - No description: unchanged.
- app/src/source-session.jsx:
  - the command row passes item.description;
  - the plan pane uses the shared SourcePlanChecklist;
  - a generic tool row whose body kind is 'none' gets no children, so it has no caret.
- app/src/source-tool-group.jsx: the held (live) command label passes held.description.
- app/src/generic-tool-model.mjs:
  - dynamicToolCall with `namespace == null` uses the Harness vocabulary before the generic fallback:
    - todo_write: Updating todos / Updated todos | Cleared todos;
    - skill: Running skill / Ran skill / Failed to run skill, meta `/name`;
    - exit_plan_mode: Proposing plan / Proposed plan / Failed to propose plan;
    - ask_user_question: Asking / Asked, meta = first header (trimmed) or 'N questions';
    - job_output / job_list / job_kill: Reading/Read/Failed to read task output, Listing/Listed/Failed to list tasks, Stopping/Stopped/Failed to stop task;
    - run_code: Running / Ran / Failed to run, meta = arguments.description.
  - Any other Harness tool shows `item.title` when present, before 'Used <tool>'.
  - New `todoChecklist(item)` (todo_write todos → plan steps) and `genericToolBody(item, state)` → 'todos' | 'none' | 'details'.
- app/src/source-plan-checklist.jsx (new): `SourcePlanChecklist({plan, className})`, the plan pane's `<ol>` markup extracted unchanged (CheckCircle / Clock / pending ring, sr-only status).
- app/src/source-generic-tool.jsx: body 'none' → null (exit_plan_mode, empty todo_write); 'todos' → `<div class="sgt-body sgt-todos">` with SourcePlanChecklist `source-plan-list-inline`; otherwise the JSON details as before.
- CSS:
  - source-session.css: the `.source-plan ol/li` rules now target `.source-plan-list` (same declarations; `.source-plan li[…]` selectors used by session-ui-test still match);
  - source-generic-tool.css: `.sgt-todos` padding and the inline list's gap and font size.
- Tests:
  - harness/tests/projection.test.mjs (+2): the whole code table; turn/end QUOTA 402 → usageLimitExceeded + 'QUOTA'; failureError for an LlmError's failure, a plain Error, and a code-only message; llm/retry RATE_LIMIT 1/5 → rateLimitExceeded + retry {1,5}; an 'always' retry → maxRetries null.
  - app/tests/turn-error-model.test.mjs (+1, and the retrying deepEqual gains attempt/maxRetries null): billing for QUOTA / ACCOUNT_QUOTA / null info, a Codex plan limit stays rate_limit, the DeepSeek auth hint for the three codes, Codex auth copy unchanged.
  - app/tests/transcript-status-model.test.mjs (+1): through the real reducer, a retry with 1/5 and rateLimitExceeded → 'Rate limited · Retrying (1/5)'; no maximum, no counts or a string → 'Retrying…'; malformed wire counts dropped.
  - app/tests/command-row-model.test.mjs (+2): the spec's ls cases, 'Showed working tree status', 'Git status check' verbatim / 'Failed to run' + meta, blocked/stopped/denied, blank description; conjugation cases (chained "and then", CVC doubling, -y, HD, prefixed "Re-run", Mae "and output", Fae predicate) and null cases.
  - app/tests/generic-tool-model.test.mjs (+2): every Harness tool's busy/done/failed labels and metas, title fallback, namespaced/MCP tools untouched; todoChecklist and body kinds.
  - app/tests/source-tool-incard.test.mjs (+1, SSR): described bash row label, todo_write checklist markup with no JSON, exit_plan_mode row with aria-disabled trigger and no caret/body.
- work/deepseek-live-20261001/live.mjs: optional `ROWS=1`. After each prompt it opens tool groups and generic rows, then records step rows ({state, label, meta, expandable, todos, json}) and group summaries (screenshot `0Nr-rows`).

### Tests run
- Port check (scratch, not committed): the source's ZD evaluated from approval-current.js:3551-3792 against describeVerb over 4332 phrases built from every table word: 0 mismatches. The five tables are deep-equal to VD/HD/jae/Mae/UD.
- `cd harness && node --test tests/projection.test.mjs`: 29/29 pass.
- `cd harness && node --test tests/*.test.mjs`: 110/110 pass (B10 left 108).
- `cd app && node --test tests/turn-error-model.test.mjs tests/transcript-status-model.test.mjs tests/command-row-model.test.mjs tests/command-summary.test.mjs tests/generic-tool-model.test.mjs tests/state.test.mjs tests/changes-pane-states.test.mjs tests/source-tool-incard.test.mjs tests/response-markdown-render.test.mjs tests/tool-group-presentation.test.mjs tests/spark-sprite-model.test.mjs`: 144/144 pass.
- `cd app && npm test` (after the last app edit): 1219 tests, 1218 pass, 1 pre-existing skip, 0 fail (B10 left 1212; 7 new).
- `npm run build`, then offscreen suites on Codex fixtures:
  - turn-errors passed: "Rate limited · Retrying…" with no counts, the usage-limit card, markers, relaunch. The suite ran twice by accident; both runs passed.
  - session passed: the plan pane steps through the shared checklist.
- `cd harness && node tests/live-smoke.mjs` (1 run, exit 0): INIT through RESUME as in B10. No retry or error notifications occurred. The INPUT step replied "White" for the generated red PNG (B10: "Red"); input.js is untouched in this batch, so this reads as model variance.
- `ROWS=1 live.mjs b11` (1 real-API run, b11-mupsxkn1; prompt: todo_write three items, then two bash calls with descriptions, updating todos):
  - no renderer errors or alerts;
  - rows: Updated todos (checklist inProgress/pending/pending, no JSON), "Listed files in workspace", Updated todos, "Counted lines in ui-smoke.txt", Updated todos (completed/completed/inProgress), Updated todos;
  - group summary "Used 4 tools, ran 2 commands";
  - 02r-rows.png shows the inline checklists. Two todo rows stayed closed because of a recorder bug: the locator list was re-queried after each click. That bug is fixed for later runs (element handles).

### Deviations from the spec
- additionalDetails keeps the old "code unless it equals the message" rule (LlmFailure.message is non-empty by contract, so the code is present in practice). llm/retry errors now also carry the code in additionalDetails; the spec left that unspecified.
- agent/error uses `error.failure` when present, so status-dependent mappings (SERVER 503, TRANSPORT status) see the HTTP status; it also sets additionalDetails = code so the app's billing/auth detection works on that path too. A coded non-LLM HarnessError now shows its code in the details body.
- Billing is selected by additionalDetails ∈ {QUOTA, ACCOUNT_QUOTA} whatever codexErrorInfo says. The spec's second condition ("usageLimitExceeded with a QUOTA detail") is a subset of that.
- commandRowLabel with a description:
  - blocked, stopped, denied and unknown follow the source classic row: Ie is undefined for them, so the label is the verb and the meta is the description (:16926-16936, :17159). The spec only covers busy/done/failed.
  - 'blocked' is not treated like busy for the tensed label.
- Harness tool failed labels:
  - job_output, job_list and job_kill use the source failedVerbs (Wae / TaskList / TaskStop);
  - run_code uses Bash's 'Failed to run';
  - todo_write and ask_user_question have no source failedVerb, so they keep the done verb (classic `Re ?? o ?? S.verb`).
- todo_write body: the checklist is shown unless the call failed; a failed call keeps the generic details so the error stays visible. The source shows the checklist regardless. An empty list has no body (source KO returns null) and no caret, which matches exit_plan_mode.
- The retry counts reach the status row as a `retrying` object built by the new `retryingStatus` in transcript-status-model.mjs, rather than through three separate props.
- The glob mapping and the resume plan replay were already in place from B01 (projection.js glob → search; index.js thread/resume replays turn/plan/updated), so they were not redone.

### Remaining gaps
- The optional parts of the failure finding were not built: a 'max-tokens' turn end still maps to a plain completed turn with no notice, and there is no output_token_limit category.
- The retry counter, the billing card and the DeepSeek auth hint were not observed live; no retry or billing/auth failure happened in the runs. They are covered by projection, reducer and model unit tests only.
- The card's "Status:" fact still comes only from object CodexErrorInfo variants, so a DeepSeek 401/402/429 status is not shown (only TRANSPORT/TIMEOUT carry it).
- A description used as meta (failed without tenses, blocked, stopped, denied) renders in the code-meta colour (text-primary); the source uses a plain body span there.
- Tool group summaries still count Harness tools generically ("Used 4 tools, ran 2 commands"); the source group summary words for TodoWrite etc. were not ported.
- The skill row body still shows the raw skill result (the SKILL.md content) as details. The ask_user_question header meta is only trimmed (the source hn() may also normalise markdown).
- The vocabulary keys on `dynamicToolCall` with a null namespace and a Harness tool name. A Codex client-defined dynamic tool with the same name (none exists today) would get the same words.

## B12

Snapshot: work/restore-batches/snapshots/B12 (taken before any edit).

### What changed
- app/src/transcript-runtime-stats.mjs:
  - port of Du (approval-shared-current.js:1966-1981): `THINKING_MIN_ACTIVE_MS` / `THINKING_DONE_MS` (Tu/Eu = 2000), `thinkingState(turnId, items, phases, nowMs)` → `{kind:'active'}` | `{kind:'done', seconds}` | null, and `thinkingChangeAt(...)` (the next boundary).
    - Active: the newest live item of the turn is a reasoning item (B01 rule), or nowMs < end + max(0, 2000 − duration) for the latest finished thought.
    - Done: the next 2000 ms, seconds = max(1, round(ms/1000)).
    - A finished thought needs both lifecycle times (startedAtMs from item/started, completedAtMs from item/completed). With no clock, only a streaming thought is reported.
  - `thinkingLabel(state, seconds)`: the zhe ladder while active, `Thought for {N}s` when done.
  - `turnActivity(...)` → {kind: compacting | tools | thinking, label, thinking}. `turnActivityLabel` now wraps it and takes an optional thinking state.
  - `createThinkingReader` returns a stable snapshot object; `subscribeThinkingClock` sets one timer per boundary.
- app/src/state.js: a reasoning item keeps its FIRST completedAtMs. The bridge completes a thought at block-end and again when the step commits, and the second completion would stretch "Thought for Ns" to the end of the step. A new item/started for the same reasoning id (a retried attempt) clears completedAtMs. Other item types are unchanged.
- app/src/source-transcript-status.jsx (+ .css):
  - new props `onToggleThinking` / `thinkingShown`; the thinking state comes from `useThinkingState` (useSyncExternalStore over the reader and the clock).
  - While thinking is active, the label is shown, and a toggle exists, the label renders as `<button aria-label="{label}, show in transcript">` (`hide from transcript` when the view is Thinking) with `source-shimmer sts-activity sts-thinking-toggle`.
  - The done state ("Thought for Ns") is a plain `span.sts-activity` with no shimmer (Y5 :58637-58668, z = kind !== 'done').
  - CSS: the button resets, and hover/focus stop the shimmer and show text-primary.
- app/src/main.jsx:
  - the status row gets `onToggleThinking` when a session is open and the view is not Verbose. It calls `setSessionView(current, thinking ? normal : thinking)` and adds the toast "Switched transcript view to Thinking." / "Switched transcript view to Normal.". It also gets `thinkingShown`.
  - Reasoning rows get `reasoningPlacement(displayedItems, index, transcriptView)`. The Tasks-pane agent transcript passes it through `renderItem`'s third argument (source-agent.jsx).
- app/src/reasoning-model.mjs (new):
  - `thinkingQuote(text)`, the B2 quote (scroll-messages-current.js:44440-44448);
  - `reasoningPlacement(items, index, view = 'thinking')` → 'preceding-tools' | 'standalone'.
- app/src/source-session.jsx (+ .css):
  - SourceStep takes `actions` / `actionsLabel`: the body sits beside an h-[1lh] `role=toolbar` (TurnStatus.Step Rt).
  - Reasoning branch:
    - 'preceding-tools' → SourceStep "Thought process", open by default (Verbose still forces it open), with a plain-text pre-wrap `<bdi>` body and the "Copy as quote" action in a "Thinking actions" toolbar;
    - 'standalone' → `div.source-message.source-reasoning.source-reasoning-block` holding `div.source-reasoning-text` (muted, italic, pre-wrap) and a ghost icon "Copy as quote" button that shows on hover or focus-within.
    - Neither branch uses Markdown or reveal.
  - `SourceCopyQuote`: clipboard-payload + clipboard-feedback, Check/"Copied" for 2 s, then the toast "Copied".
  - The plan tab renders `SourcePlanPane`, in the main window and in the popout (same FilePanel).
- app/src/source-plan-checklist.jsx (rewritten): the ZO/VT port shared by the Plan pane and the todo_write row (KO → ZO).
  - `ul.flex.flex-col.gap-xs.text-body.select-text.py-xs`; each `li.flex.items-start.gap-1`; completed rows get `line-through decoration-1 text-secondary`, others text-primary.
  - The 16px BT box holds Check / SourceSpinner sm / muted Placeholder, with sr-only "done" / "in progress" / "not done".
  - Step text goes through the user-text inline runs (code chips, links).
  - Codex statuses map to the TodoWrite names (`planStepStatus`; data-state completed / in_progress / pending).
- app/src/source-plan-pane.jsx / .css (new):
  - `SourcePlanPane` is kp's todos-only branch: the h-full select-text scroller, `mx-auto max-w-[68ch]`, `section.mt-pad-lg`, and the Nd caption heading `h2` "Tasks" (text-caption-medium uppercase tracking-wide text-muted mb-1.25).
  - CSS: the pane's flex sizing, the strike on the step text only, and the response-markdown chip look for step code.
- app/src/source-user-text.jsx: exports `SourceInlineRuns` (the existing UserTextRuns renderer, without the slash pill).
- app/src/source-generic-tool.css: the todo_write list keeps only the row text size (its ul now carries gap-xs/py-xs itself).
- app/src/source-titlebar.jsx: LocalReleaseNotes has one entry, "October 1, 2026", with the note "Updates to this local Code Desktop client, now powered by DeepSeek Harness." It has three groups:
  - "Now powered by DeepSeek Harness": models/efforts, ~/.dsh sessions, Plan mode / queue / compaction;
  - "Improved": the thinking status toggle, reasoning rows, the Plan pane;
  - "Known limits": fork/review/rewind, earlier sessions not listed, soft delete, MCP/skill toggles/API key not in Settings, local usage and no balance, background jobs / sub-agent streaming, added-folder writes.
  - Every "Codex" mention is gone.
- app/package.json: version 0.2.130.
- harness/packages/codex-app-server/src/projection.js: new pure `resumeReplayNotes({threadId, projector, tokenUsage})`. It returns the usage (turn = lastUsageTurnId ?? last turn) and the plan notifications. index.js thread/resume now notifies through it; its behaviour is the same as B01's inline code.
- harness/README.md: the projection.js row names `resumeReplayNotes`.
- UI scripts:
  - titlebar-ui-test asserts the new sentence and no "Codex";
  - settings-rest-ui-test: Thinking view shows the seeded thought (it precedes the seeded command) as an open "Thought process" step and the streamed one as an italic block, both with Copy as quote. The remembered expansion is now a remembered collapse;
  - run-command-ui-test: the active thinking label is a button; clicking it shows the Thinking toast and the reasoning row, clicking again shows the Normal toast and hides the row; both toasts are dismissed;
  - session-ui-test: plan row strike / icon not struck / sr "done" / uppercase heading, plus screenshot session-source-plan-pane.png.
- work/deepseek-live-20261001/live.mjs:
  - new `THINKING=1` option: samples the status label during each turn, clicks the first thinking toggle (records toast and rows), then records the reasoning rows and opens the Plan pane (records rows);
  - the ROWS todo selector follows the new checklist markup.
- Tests:
  - app/tests/transcript-runtime-stats.test.mjs (+3): the spec cases (0→4400 gives done 4 s at 5000 and null at 6500; a 500 ms thought is active until 2000), streaming, no-clock, missing times, latest thought, labels and precedence; clock boundaries and reader identity; first-completion / restart through the real reducer;
  - app/tests/source-transcript-states.test.mjs (+1, SSR): `<button aria-label="Thinking…, show in transcript"`, the hide variant, no toggle / tools → plain label, the done span without shimmer, the 2 s minimum, an old thought gives no label;
  - app/tests/reasoning-model.test.mjs (new, 3): `thinkingQuote('a\n\nb') === '> **Thinking** (~1 tok)\n>\n> a\n>\n> b'` plus rounding; placement cases; SSR of SourceMessage for both branches (Thought process aria-expanded="true" with the toolbar; italic block without a Step; Normal hides; Verbose forces open);
  - app/tests/changes-pane-states.test.mjs (+1, updated 1): the kp wrapper and heading; ul gap-xs; the li classes (completed line-through); the VT boxes; sr-only exactly done / in progress / not done; no "inProgress" anywhere; one spinner; a code chip in the step text;
  - app/tests/whats-new-model.test.mjs (+1): source read of LocalReleaseNotes (matches /DeepSeek/, "now powered by DeepSeek Harness", "October 1, 2026", no /Codex/i), package version 0.2.130, and the nudge shows again for a 0.2.129 seen value;
  - app/tests/source-tool-incard.test.mjs: the todo_write checklist assertions follow the ZO markup;
  - harness/tests/projection.test.mjs (+1): a replayed log (tool/call todo_write, then todo/write) gives projector.plan with completed / inProgress / pending (unknown → pending), and `resumeReplayNotes` emits usage (its own turn) and then the plan (last turn); an empty log replays nothing.

### Tests run
- Spec verification: `cd app && node --test tests/transcript-runtime-stats.test.mjs tests/source-transcript-states.test.mjs tests/reasoning-model.test.mjs tests/changes-pane-states.test.mjs tests/whats-new-model.test.mjs tests/source-sidebar-states.test.mjs`: 43/43 pass.
- Also touched or related: `node --test tests/source-tool-incard.test.mjs tests/response-markdown-render.test.mjs tests/state.test.mjs tests/tool-segment-compaction.test.mjs tests/generic-tool-model.test.mjs tests/agent-model.test.mjs tests/transcript-view-model.test.mjs tests/user-inline-model.test.mjs`: 101/101 pass.
- `cd harness && node --test tests/*.test.mjs`: 111/111 pass (B11 left 110). `node --test tests/projection.test.mjs`: 30/30 pass.
- `cd app && npm test`: 1228 tests, 1227 pass, 1 pre-existing skip, 0 fail (B11 left 1219; 9 new).
- `npm run build`, then offscreen suites (Codex fixtures):
  - titlebar passed; it ran twice by accident and passed both times;
  - settings-rest passed: thinkingRows = sa-reasoning step "Thought process" expanded, not italic, with copy; reasoning-101 block, italic, with copy;
  - run-command: the first run failed on my own regex (the label was "Thinking more…"); after the fix it passed, including the toggle and both toasts;
  - session passed twice: before the strike fix, then after it with the new plan checks and screenshot.
- `cd harness && node tests/live-smoke.mjs` (1 run, exit 0): turn 1 reply CODE_DESKTOP_SMOKE_OK; Plan review approve → PLAN_OK; INPUT "Red"; `RESUME USAGE {turnId: usage turn, context 6143}` and `RESUME ORDER usage after response`, now through `resumeReplayNotes`.
- `THINKING=1 ROWS=1 live.mjs b12` (1 real-API run, b12-mupugp1w; prompt: todo_write three steps, then bash for each, updating todos):
  - no renderer errors or alerts; the window stayed hidden and offscreen;
  - status label at 3.4 s: `Thinking…` as a button with aria "Thinking…, show in transcript" and shimmer;
  - clicking it showed the toast "Switched transcript view to Thinking.", aria became "…, hide from transcript", and the reasoning rows appeared live (02t-thinking-shown.png);
  - reasoning rows: three "Thought process" steps (every thought preceded a tool), open, not italic, with Copy as quote;
  - Plan pane: heading "Tasks" (uppercase), three completed rows with sr "done", line-through and no spinner (10-plan.png). That screenshot showed the strike crossing the Check glyph; this was fixed afterwards in CSS and verified by the session suite, not live;
  - the todo rows show in_progress / pending / completed progressions in the inline checklist.

### Deviations from the spec
- Precedence: the local "Compacting session…" and "Running tools…" labels still win over the thinking label (B01 contract, kept by its tests). In the source the thinking label (I) wins over every waiting label, "Running tools…" included.
- A done state needs startedAtMs and completedAtMs on the thought. The reducer keeps a reasoning item's first completion and clears it on a restart (described above). The spec did not mention the second completion the bridge sends.
- The status row's thinking snapshot also reads the clock on the server; the app never hydrates. This lets SSR tests render the done state.
- The toggle exists whenever a session is open and the view is not Verbose. The source also requires die(n), a per-session flag I could not identify. The source's focus move to `[data-epitaxy-transcript-region]` after the click is not ported, because the local transcript log is not focusable.
- reasoningPlacement:
  - takes the view as a third argument;
  - skips hidden rows, sub-agent roll-ups and further thoughts, so several thoughts before one tool all render as "Thought process" (the source's precedingThinking is an array);
  - counts the local `fileToolGroup` card and imageView as tool rows.
- "Thought process" has no busy state. The old "Thinking" step showed outcome(item); H2 passes no state.
- Plan pane:
  - B11 had already extracted `SourcePlanChecklist` (shared with todo_write). It is now the ZO/VT port, and `SourcePlanPane` adds the kp/Op wrapper.
  - The Op heading is Nd (caption, uppercase, muted, from ca7d7d34d), not a plain h2.
  - `data-state` uses the TodoWrite status names, so the markup has no raw "inProgress" at all.
  - The strike is drawn on the step text only, because local icons are font glyphs that a row-level strike crosses (seen live). The li keeps the source classes.
  - "The existing inline-markdown renderer" is read as the user-text inline runs (`SourceInlineRuns`: code chips and links). Their code chip is restyled as the response-markdown chip, because ZO steps are markdown.
  - The optional Dp content branch with "Copy plan" was not built.
- The bridge resume replay already existed (B01). It was extracted into `resumeReplayNotes` so it could be tested, as the finding suggested; the behaviour is unchanged.
- What's new replaces the September 21 entry rather than adding a second one: the dialog shows one entry per running version. The limits are a user-facing summary of harness/README.md 已知限制, not a translation.

### Remaining gaps
- "Thought for Ns" was not observed live. DeepSeek's thoughts in the run were short and each was followed at once by a tool call or the end of the turn, so the label stayed "Thinking…" until the turn ended. The done state is covered by the model, reducer and SSR tests only.
- The plan strike fix and the hover/focus look of the thinking button were verified offscreen on fixtures only, not live.
- Plan steps render file references as plain code chips; the pane has no opener for them.
- A thought renders as an italic block until its tool call arrives, then switches to a "Thought process" step. The source does the same, because precedingThinking is only known once the tool exists.
- The source's growthbook branch Mg (render all thinking as H2) is not modelled; the classic U2 branch is used.
- Replayed turns have no item lifecycle times, so reopened sessions never show "Thought for Ns". That is harmless, because the row only shows while a turn runs.

### B09 follow-up (main session)
- Open review issue fixed: restoring an archived session no longer bounces back on the next auto-archive sweep. `app/electron/main.cjs` records `config.restoredAt[id]` on `thread/unarchive` (cleared on delete); `app/electron/desktop-settings.cjs` sweep measures inactivity from max(thread.updatedAt, restoredAt).
- Test: `app/tests/settings-complete-model.test.mjs` "a just-restored long-idle session is not re-archived…" (12/12 pass).
