# Deferred items from earlier rounds

## Fidelity round (work/fidelity-batches)
- sidebar-drag-and-drop: L effort; medium severity. Menus already let users pin, move to a group and reorder pins. B8's group-header menus add Move up/down for projects. Leave the drag controller, the drop targets and the drag-pin tip for a later round.
- sidebar-open-in-submenu: Low severity, M effort. Needs new installed-editor detection IPC and open -a plumbing. Reordering and keycaps alone have little everyday impact.
- composer-ctrl-r-history-search: Low severity, M effort. A power-user feature (Ctrl+R incremental search with its own header variant); ↑/↓ history already works. Deferred to keep B5 focused on high and medium composer gaps.
- composer-aria-names: Low severity. The product edit is trivial, but per HANDOFF 0.2.112/0.2.120 about 39 UI scripts select by 'Send message', 'Stop response' and 'Model'. Renaming them mid-round, while a regression is in flight and 14 batches share the tree, risks broad selector churn. Do it in one dedicated selector-migration pass, with a shared label-constants module, together with titlebar-window-09.
- titlebar-window-09: Low severity accessible-name change ('More options for {title}'). Like composer-aria-names, it renames a control that 12 UI scripts select by exact name. Schedule it in the same dedicated selector-migration pass.
- transcript-failed-send: Low severity, M effort. It needs a new failed-entry reducer, transcript variant and retry path that interacts with send and queue state. The visible part, the hard-coded legacy colours of .inline-error, is fixed in B1's token restyle. The 'Not delivered · Retry · Discard' row is left for a later round.
- panes-terminal-pane-missing: L effort with a native dependency: node-pty must be rebuilt for Electron, which brings packaging and offscreen-runner risk, plus a new xterm pane, IPC and suites. It is a full feature rather than a fidelity tweak. Plan it as a dedicated project.
- panes-changes-file-list-column: L effort, medium severity. It needs a new resizable column, a folder and kind grouping model, filter, coachmark and scroll sync. B12 already brings the larger Changes scope and display fixes, and B11 wires ⌘⇧Y for the Files tree only. Do the Changes file list next round and route ⌘⇧Y to it then.
- git-multi-repo-rows: Low severity, M effort. It only matters for sessions with additional folders that are separate git repos, which is rare in normal use. It needs new multi-query plumbing and a band container.
- customize-skill-invocation-semantics: Low severity, M effort. It changes the harness catalog's semantics (new userInvocable/modelInvocable fields) and the DeepSeek-specific gating rules. It is not a direct port of an original UI string or layout. B5's slash-skill work already lists skills by user-invocability, so revisit this after that lands.

## DeepSeek round (work/restore-batches)
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
