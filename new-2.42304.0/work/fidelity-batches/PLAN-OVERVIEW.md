# Fidelity round plan overview

Planner result for the fidelity round. All region findings were triaged into 14 sequential batches; 10 findings are deferred.

Spot-checks (read-only) of doubted high-severity evidence, all CONFIRMED in the current tree:
- Phantom tokens. A scan of app/src/*.css against every --cds-* defined in app/public/assets/v1/*.css and app/src found these undefined names: --cds-focus-color (style.css:57, source-session-actions.css:1), --cds-border-focus (4 files), --cds-text-on-primary (source-sidebar.css:364), --cds-shadow-focus, --cds-fill-ghost-pressed/-active, --cds-radius-card/-chip/-lg/-sm, --cds-duration-fast, --cds-delay-hover, --cds-text-info, --cds-bg-000, --cds-shadow-panel, --cds-keycap-radius and --cds-background-primary. --cds-font-code is set at runtime in main.jsx:921-924, so it is not phantom. The loaded CSS really has .cds-root[data-platform=desktop], [data-mode=system] handling, .rounded-card/.rounded-chip and .shadow-panel-sm/-lg. Both preload woff2 files exist.
- Window and menu. app/electron/main.cjs:896 has `app.on("window-all-closed", () => app.quit())` and no context-menu or activate handler. app-menu.cjs uses the roles editMenu and windowMenu.
- Composer. main.jsx navigate() (~1078-1083) always calls setDraft("") and resetAttachments(). turn/completed (~853) only refreshes, and unread is set only by 'mark-unread'. The global Escape (main.jsx ~999-1005) fans out to every layer and ignores defaultPrevented. source-composer.jsx:452/459/470 disable the pickers while running, and :233 sets disabled = !connected.
- Transcript. highlight-engine.mjs registers 5 grammars. The jump control renders ArrowDown 20 in a 36px circle. The real-app screenshot analysis/batch-20260920/official-fade-middle-028-cu.jpg shows the compact CaretDown chip just above the composer, so the classic branch is right. The transcript is role=log with no onContextMenu.
- Approval card. FileChanges is still used in source-session.jsx:330/629.

Merged duplicates and shared root causes:
- Native context menu: titlebar-window-02 and overlays-native-context-menu.
- Focus ring tokens: overlays-undefined-focus-tokens and tokens-theme-focus-ring-tokens.
- Invisible primary label: overlays-group-dialog-primary-label and tokens-theme-phantom-on-primary.
- One shared CDS Dialog primitive: overlays-dialog-primitive and tokens-theme-dialog-surfaces.
- nativeTheme, window background and traffic lights: titlebar-window-07 and tokens-theme-appearance-plumbing.
- Edit > Find plus the find bar: titlebar-window-03 and transcript-find. Follow the renderer find bar (ZB), not webContents.findInPage.
- Highlight changed words and Hide whitespace changes: panes-diff-word-whitespace-toggles and git-changes-menu-display. Use the client-side gn port, not git -w.
- Branch diff base and scope dropdown, sharing one git-status.cjs scope change: git-diff-scope and panes-changes-scope-picker.
- Legacy code-ui Popover removal, together with the composer folder, branch and env chips: overlays-legacy-popover, home-folder-picker, home-branch-picker and home-env-chip-tooltips.
- sidebar-search-palette: only its minimal part (label 'Search', ⇧⌘K, Go > Search…) is done, with titlebar-window-04. The full palette is deferred.
- composer-mode-menu-accept-edits goes with the approval and harness permission work in B7.

Ordering:
- Tokens and primitives come first: B1 tokens and theme plumbing, B2 dialog, shortcut, Escape and shortcuts dialog, B3 popover and env pickers, B4 Electron window, context menu and menu bar.
- Everyday surfaces follow: B5 composer, B6 transcript rendering, B7 tool cards and approvals, B8 sidebar, B9 home.
- The rest come last: B10 find and feed a11y (after B4 makes the Edit menu explicit), B11 Files pane, B12 git band and Changes, B13 Customize, B14 Settings.

Global rules for every implementer:
- Start only after the concurrent B12 workflow and its regression have finished.
- Re-read the current code before each edit, because line numbers drift between batches.
- Do not touch the B12 surfaces: the 'Thought for Ns' thinking status row, the reasoning/thinking rows, the Plan pane task list and the What's new notes. The one exception is replacing a phantom token if one is still present there.
- Cite the original file:line in code comments.
- Add a HANDOFF.md version entry with its 剩余缺口 per convention.
- Keep light, dark and system modes working.
- Do not add Anthropic-account-only features.

## Deferred
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
