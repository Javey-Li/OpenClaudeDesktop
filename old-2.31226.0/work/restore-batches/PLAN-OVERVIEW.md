# Restore plan overview

Plan for the DeepSeek-core gaps and the remaining Claude Desktop fidelity work.

Spot-checks confirmed every high-severity claim I tested:
- harness/packages/codex-app-server/src/index.js:712 calls `commands.execute()` with 3 arguments. dsh-commands/lib/index.js:332 reads `signal.aborted` without a guard, so `/compact` always throws. It returns `{}` with no turn, so session-operations.cjs:119-183 keeps the lock forever.
- index.js:194-206 drops `block-end` chunks, although the DeepSeek adapter emits them (dsh-llm-deepseek/lib/index.js:1971).
- projection.js ignores tool/result `data.error`. The AbortError info is persisted at dsh-agent-loop/lib/index.js:696-706, and `approval/asked` / `approval/decided` events are durable.
- projection.js:208-210 renders the read body with its `N:` prefixes and footer. Confirmed against dsh-tool-fs formatReadOutput and presentResult.
- `web_search` matches the grep/glob branch first (projection.js:143 versus dsh-tool-web presentSearchCall `kind: 'search'`).
- account/read, account/usage/read, skills/list and the queue stubs behave as the audits describe.

New issue found while checking: Electron `ipcRenderer.invoke` drops `error.data`. As a result `isNotSteerable` (queued-messages-model.mjs:102) can never see `activeTurnNotSteerable`, and the renderer cannot see `threadNotFound`. Batch 2 adds an RPC error passthrough that batches 3 and 9 rely on.

Duplicates merged:
- compact: 2 findings
- queue: 3 findings
- abort/reject status: 2 findings
- subagents: 3 findings, including the Ask-mode bypass for child agents
- user-input round trip and images: 4 findings
- skills: settings page plus bridge
- config/read: 2 findings
- account: API-key page plus no-key onboarding
- usage: account/usage/read stub plus Usage tab
- additional folders: 2 findings
- Codex sessions vanishing plus the thread/read not-found case

Ordering:
- Batches 1-8 fix high-severity behaviour broken on the DeepSeek core: stream and tool outcomes, compact/queue, core capabilities and legacy sessions, Plan mode and questions, approvals, sub-agents, settings catalog, account/usage.
- Batches 9-11 are medium DeepSeek degradations plus closely related fidelity work.
- Batch 12 is fidelity polish. The What's new notes go there on purpose, so the release notes describe the final state after all earlier batches.

Shared conventions every batch must keep:
- Testable bridge logic lives in pure modules under harness/packages/codex-app-server/src. index.js binds stdin/stdout at apply, so it cannot be unit-tested directly.
- `cd harness && node --test tests/projection.test.mjs` must stay green after every batch.
- Batch 3 introduces `boot.core` = {engine, engineVersion, capabilities, configPath}. Later batches extend `CAPABILITIES` in index.js and read `boot.core` in the app. They do not invent new plumbing.
- Batch 3 creates src/errors.js. Later batches add to it instead of creating new error helpers.

Deferred items are either L-effort fidelity work or depend on data Harness does not provide.

## Deferred
- home-usage-full-history-stats: L-effort fidelity change, not high severity. Batch 8's usage.js session fold can later be extended into the 182-day heavyWorkWorker-style stats payload.
- home-usage-balance-credits: Low severity. Harness exposes a wallet balance only after a DeepSeek Platform sign-in (deepseekAccount.getBalance); there is no balance call for API-key users. Batch 8 already replaces the misleading 'unavailable' copy.
- sidebar-sessions-external-sessions-unreachable: L effort: a new resume picker, adoption IPC and import hint. It needs the thread/list row fixes from batch 9 first. Showing only the app's own sessions matches the original's default sidebar behaviour; schedule it after batch 9.
- bridge-protocol-fork-unsupported: Implementing thread/fork and review/start was deferred to keep the batches bounded. Batch 3 disables fork, review and rewind honestly through capabilities.unsupportedMethods. The 'forks hidden as sub-agents' mapping bug is fixed in batch 6 (origin-only classification).
- tool-rows-edit-hunk-numbering: Harness computeHunkDiffs drops structuredPatch oldStart/newStart (dsh-tool-fs/lib/index.js:414-437). Real line numbers would need file reads at result time plus persisted per-call metadata so replays match. Merging hunks without real starts would give misleading gutters. Revisit if upstream adds hunk starts to presentationMeta.
- approvals-permissions-mode-menu-accept-edits: Fidelity M that builds on the mode hint from batch 4 and the approval module from batch 5. Batch capacity is used up; it is a natural next batch (accept write/edit in pre-execute, ask for bash).
- settings-customize-storage-report: Fidelity M on a rarely used dialog, and it does not affect the agent core. Deferred for capacity.
- handoff-backlog-collapsed-sidebar-peek: Fidelity M unrelated to the DeepSeek core switch. Deferred for capacity.
- handoff-backlog-session-cycling-go-menu: Fidelity M (menu plus keyboard cycling) unrelated to the core switch. Deferred for capacity.
- handoff-backlog-files-tab-overflow: Fidelity M (geometry port plus overflow menu). Deferred for capacity.
- handoff-backlog-changes-file-list-column: L-effort fidelity change (resizable file tree column plus prefs and shortcut), not high severity.
- handoff-backlog-changes-word-whitespace-toggles: Low-severity fidelity change. Deferred for capacity.
- handoff-backlog-composer-ctrl-r-search: Low-severity fidelity change. Deferred for capacity.
