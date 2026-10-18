# Code UI inventory vs. reference 2.31226.0 (2026-10-13)

Scope: Code mode only. Reference: `reference/installed-2.31226.0-20261012/ion-dist/assets/v1`. Formatted chunks are in `analysis/code-ui-sync-20261013/readable/`. The machine-readable inventory, with a batch id on every gap, is `analysis/code-ui-sync-20261013/inventory.json`.

Status (as of the 2026-10-15 finalize): done (Bxx) / partial / skipped / matches; the original audit status was missing / broken / divergent / partial. Severity: broken > obvious > minor. Per-batch results: `docs/code-ui-sync-20261013.md`.

## Inventory by area

### Home
| Item | Status | Sev |
|---|---|---|
| Recent pick not persisted as the Home folder | done (B03) | obvious |
| Recent list shows worktree paths and deleted folders | done (B03) | obvious |
| SSH section in the env menu | skipped (B28: no SSH transport for local cores) | obvious |
| Action Center Pull requests section | done (B08) | minor |
| Local env row → 'Edit local environment' | done (B28) | minor |
| Env tooltip hard-codes DeepSeek; first-run placeholder | done (B03) | minor |
| Backlog chips, errored = Needs input, hover preview, fixed greeting, spawn phases, group chip, git-missing dialog, stale release notes | done (B29; hover card read-only, no quick approve) | minor |
| Greeting, stats card, Sessions section, folder chip, branch picker/worktree | matches | — |

### Sidebar
| Item | Status | Sev |
|---|---|---|
| Startup/disconnected shows 'no sessions' (no skeleton / load-failed) | done (B04) | obvious |
| Group collapse not persisted | done (B04) | obvious |
| No 'Show less' | done (B04) | obvious |
| Drag to Pinned / groups | done (B10) | obvious |
| Title bar caret menu / 'View options' overflow | done (B09) | obvious |
| User group names passed through t() | done (B01) | minor |
| Open PR row item, multi Pin/Set model, Move-to-group submenu, separators, error boundary, truncated title tooltip, hover-reveal | done (B04, B08, B09, B10) | minor |
| Filter menu, row menu, glyphs/rename/keyboard, chrome | matches | — |

### Composer
| Item | Status | Sev |
|---|---|---|
| Add › Add folder leaves the session | done (B01) | broken |
| Paste of non-image files/folders refused | done (B01) | obvious |
| Queued message 'Send now' | done (B05) | obvious |
| Mid-message slash menu | done (B05) | obvious |
| Stop glyph StopCircle; 'Stop'/'Send' names | done (B05) | obvious |
| Fork tooltip row, editor max height, Add menu shape, permission/model/effort badges, auto-compact copy, fast chord, chin truncation, rich text, mention providers, slash states, saved draft, GitHub issue import | done (B05, B30, B31); saved draft pill skipped | minor |
| Bash mode, history, chin chords, menus, mentions, attachments, stop/queue keys | matches | — |

### Transcript
| Item | Status | Sev |
|---|---|---|
| Session chapters TOC rail | done (B11) | obvious |
| Pin as chapter / Unpin chapter | done (B11) | obvious |
| Rewind confirm + picker | done (B12; 'Code only' needs core support) | obvious |
| Chapter rename, Rewind/Fork explanations, image items in message menu, thinking note | done (B11, B12); thinking note gated (B35) | minor |
| Context menu, hover actions, footer, status row, thinking, code block chrome, error card, jump chip, plan card | matches | — |

### Files
| Item | Status | Sev |
|---|---|---|
| Open tabs don't refresh on disk changes | done (B07) | obvious |
| Tree doesn't watch directories | done (B07) | obvious |
| HTML/SVG rendered preview | done (B13) | obvious |
| Mermaid diagrams (gated) | skipped (gated in reference) | minor |
| Missing/outside/binary card actions, breadcrumb/editor/preview menus, trailing-slash folders, auto-expand, symlink rows, reveal flash, indent guides, root retry, Enter focus, restored-tab drop, coachmark, PDF preview | done (B07, B13, B32, B33) | minor |
| Tree, tabs, search, editor, Markdown/CSV/media cards | matches | — |

### Diff / git
| Item | Status | Sev |
|---|---|---|
| Line comment lost in popped-out Changes | done (B02) | broken |
| 'Commit changes' label | done (B08) | obvious |
| Existing-PR lookup (gh) / PR row | done (B08; merge controls cloud-only) | obvious |
| Inline annotation cards | done (B14) | obvious |
| Diff selection chip + body context menu | done (B14) | obvious |
| Commits section in the file column | done (B15) | obvious |
| Turn edits card layout | done (B16) | obvious |
| Row menus, failed Try again, stale dim, image viewer, F7, commit search, Create PR split, chip menus, Open in, behind-base, dirty-worktree dialog, branch-switch note | done (B08, B15, B16, B34, B37) | minor |
| Scope menu, settings menu, Go to file, file header/column, states, band gating, branch picker | matches | — |

### Terminal / Preview
| Item | Status | Sev |
|---|---|---|
| Preview empty state (no launch.json) | done (B17) | obvious |
| Dev-server detection flow | partial (B17: static scan; agent scan not ported) | obvious |
| Start-failure card | done (B18) | obvious |
| Stopped card | done (B18) | obvious |
| Terminal path drag and drop | done (B19) | obvious |
| Running command on terminal tabs | done (B19) | obvious |
| Code-block inline run | done (B20) | obvious |
| Restored last frame, setting-up states, tools-off state, logs drawer, trigger visibility, allowed sites, landing preview, overflow rows, exited overlay, chunk failure, rename/auto-close | done (B17, B18, B19, B39); cookie import skipped | minor |
| Terminal strip, menus, find; server list; preview tabs/address/menus | matches | — |

### Agents / tasks
| Item | Status | Sev |
|---|---|---|
| Subagent transcript doesn't follow output | done (B21) | obvious |
| Clear finished tasks placement | done (B21) | obvious |
| Plan comments as inline marks + plan-mode gating | done (B22) | obvious |
| Phase naming, large-workflow band, Stops in, verb line, Stopping…, truncation, per-session state, /tasks /workflows, popout, stats line, plan Open in/loading, notification text | done (B21, B22, B27, B35); plan Open in skipped | minor |
| Tasks pane, cards, subagent view, agent/workflow rows, status button, plan pane | matches | — |

### Settings
| Item | Status | Sev |
|---|---|---|
| Nav: 'This computer › System', first entry 'General' | done (B23) | obvious |
| Usage in nav | done (B23) | obvious |
| Browser section (title, Keep cookies, Open links, Allowed sites) | done (B23, B39) | obvious |
| Customize › Skills page | done (B24) | obvious |
| Customize › Plugins page | done (B24) | obvious |
| Dialog size, narrow tabs, Sessions heading, prompt-suggestions toggle, output style, System page groups, storage clean-up, MCP logs/confirm, plugin detail sections, shortcuts rows, usage page | done (B23, B24, B25, B36); output style / MCP logs skipped | minor |
| Search, appearance groups, session rows, Developer MCP, Connectors | matches | — |

### Menus / dialogs
| Item | Status | Sev |
|---|---|---|
| Palette Actions catalog | done (B25) | obvious |
| Rename session dialog | done (B09) | obvious |
| Shortcuts dialog rows/sizing, toast API, dirty-worktree confirm, palette row actions/facets, alertdialog role, InfoTip | done (B25, B37); palette row actions gated, facets skipped | minor |
| Menu bar, context menus, palette shell, dialog shell, what's new, toasts, tooltips, notifications | matches | — |

### Layout / windows
| Item | Status | Sev |
|---|---|---|
| Adaptive split grid | done (B26) | obvious |
| Session/draft popout windows | done (B27) | obvious |
| Restored pin state in popouts | done (B02) | minor |
| New-below/move up-down, narrow parking, drag ghost, grip/Swap, overlay, title split items, close control, popout kinds, popout size, split tip, side-chat popout, resizers, agent layout commands | done (B02, B26, B27) | minor |
| Split shortcuts, Open in submenu, pane visuals, split restore, popout header, tile layout | matches | — |

### Global
| Item | Status | Sev |
|---|---|---|
| Type-to-focus composer / Tab into composer | done (B06) | obvious |
| Popouts don't mirror appearance | done (B02) | obvious |
| Arrow/Page scroll, F6 regions, reload keeps session, Large text size, CSS re-vendor, cjk-order, /theme, zoom snap, ⌘. chord, session chords | done (B06, B25, B38) | minor |
| Theme, fonts, motion, width, scrollbars, focus rings, drafts, persistence | matches | — |

## Implementation batches (run in order)

Broken first, then obvious, then minor. Each batch lists its gap ids (from inventory.json) and the UI script that verifies it.

| # | Batch | Gaps | Main files | UI test |
|---|---|---|---|---|
| B01 | Composer folder/file intake + raw group names | C1, C2, group-name t() | main.jsx, source-composer.jsx, composer-attachments-model.mjs, source-sidebar.jsx | composer-states-ui-test |
| B02 | Popout window correctness | D1, GL2, popout pin state, popout size | main.jsx (PopoutApp), inline-comments.mjs, electron/main.cjs | split-windows-ui-test |
| B03 | Home folder picker | H1, H2, env tooltip, first-run placeholder | main.jsx, recent-folders-model.mjs, electron/main.cjs, composer-placeholder.mjs | home-page-ui-test |
| B04 | Sidebar loading and persistence | S1, S2, S3 + minors | main.jsx, source-sidebar.jsx, sidebar-model.js | sidebar-ui-test |
| B05 | Composer queue, slash, buttons | C3, C4, C5 + minors | source-queued-messages.jsx, session-command-model.mjs, composer-editor-model.mjs, source-composer.jsx | composer-states-ui-test |
| B06 | Keyboard: type-to-focus, scroll keys, F6 | GL1 + minors | main.jsx, use-transcript-scroll.js, source-composer.jsx | transcript-scroll-ui-test |
| B07 | Files live refresh | F1, F2 + minors | source-session.jsx, electron/files.cjs, main.jsx | files-pane-ui-test |
| B08 | Git band PR state | D2, D3, H3 + minors | git-rail-model.mjs, source-git-status.jsx, electron/git-status.cjs, source-action-center.jsx | git-band-ui-test |
| B09 | Title bar session menu + rename dialog | S5, M2, title tooltip | source-titlebar.jsx, main.jsx | titlebar-ui-test |
| B10 | Sidebar drag-and-drop and group menus | S4 + minors | source-sidebar.jsx | sidebar-rest-ui-test |
| B11 | Transcript chapters | T1, T2, chapter rename | source-session.jsx, source-turn-footer.jsx, transcript-context-menu-model.mjs, new chapter store | transcript-states-ui-test |
| B12 | Rewind flow + message menu | T3 + minors | source-session-actions.jsx, main.jsx, transcript-context-menu-model.mjs | user-actions-ui-test |
| B13 | File previews | F3, F4 + minors | file-preview-model.mjs, source-file-viewer.jsx | files-pane-ui-test |
| B14 | Diff comments | D4, D5 | source-diff.jsx, file-comments-store.mjs | changes-pane-ui-test |
| B15 | Changes column and states | D6 + minors | source-diff.jsx, diff-scope-model.mjs, source-pane-states.jsx | changes-pane-ui-test |
| B16 | Turn edits card and changed-file menus | D7 + minors | source-turn-edits.jsx, source-diff.jsx | diff-ui-test |
| B17 | Preview start page and detection | P1, P2 + minors | source-preview-pane.jsx, preview-launch.mjs, preview-service.cjs | preview-ui-test |
| B18 | Preview server states | P3, P4, P5 + minors | source-preview-pane.jsx, preview-model.mjs, preview-service.cjs | preview-ui-test |
| B19 | Terminal pane | P6, P7 + minors | source-terminal-pane.jsx, terminal-pane-model.mjs | terminal-ui-test |
| B20 | Code-block inline run | P8 | source-code-block.jsx, code-block-actions.mjs, main.jsx | run-command-ui-test |
| B21 | Tasks pane and subagent view | A1, A2 + minors | source-agent.jsx, source-background-tasks.jsx, background-tasks-model.mjs | background-tasks-ui-test |
| B22 | Plan pane comments | A3 + minors | source-plan-pane.jsx, source-session.jsx | pane-ui-test |
| B23 | Settings nav and sections | ST1, ST2, ST3 + minors | source-settings.jsx, settings-shell-model.mjs, source-settings.css | settings-ui-test |
| B24 | Customize Skills and Plugins pages | ST4, ST5, plugin detail | source-customize.jsx, plugin-detail-model.mjs | skills-mcp-ui-test |
| B25 | Command palette and shortcuts dialog | M1 + minors | sidebar-palette-model.mjs, source-sidebar-palette.jsx, shortcuts-dialog-model.mjs | menus-states-ui-test |
| B26 | Adaptive split grid | L1 + minors | split-view-model.mjs, source-split-view.jsx, app-menu.cjs, window-registry.cjs | split-windows-ui-test |
| B27 | Session popout windows | L2 + minors | electron/main.cjs, main.jsx, popout-restore.cjs | split-windows-ui-test |
| B28 | SSH and local environment | H4, local env row | main.jsx, electron/main.cjs (new ssh store) | home-page-ui-test |
| B29 | Home Action Center polish | 8 minors | home-model.mjs, source-action-center.jsx, main.jsx | home-page-ui-test |
| B30 | Composer menus and chin polish | 7 minors | main.jsx, source-permission-menu.jsx, source-model-menu.jsx | composer-states-ui-test |
| B31 | Composer editor features | 5 minors | composer-editor-model.mjs, source-composer-editor.jsx, mention-model.mjs | slash-commands-complete-ui-test |
| B32 | File viewer cards and menus | 4 minors | source-file-viewer.jsx, file-unavailable-model.mjs, source-file-editor.jsx | file-editor-ui-test |
| B33 | File tree polish | 7 minors | source-session.jsx, file-name-search-worker.cjs, use-file-tree-reveal.js | files-pane-ui-test |
| B34 | Diff extras | 4 minors | source-diff.jsx, source-git-status.jsx, source-branch-switch-dialog.jsx | diff-ui-test |
| B35 | Agents/tasks polish | 7 minors | workflow-progress-model.mjs, source-workflow.jsx, desktop-settings.cjs | workflows-ui-test |
| B36 | Settings minor pages | 6 minors | source-settings.jsx, source-settings-pages.jsx, source-usage.jsx | settings-rest-ui-test |
| B37 | Dialogs and toasts | 5 minors | toast-store.mjs, source-toast.jsx, source-dialog.jsx, main.jsx | menus-states-ui-test |
| B38 | Global appearance and window | 6 minors | index.html, source-settings.css, window-registry.cjs, window-chrome.cjs, theme-command-model.mjs | settings-ui-test |
| B39 | Preview allowed sites and landing preview | 2 minors | preview-service.cjs, source-preview-pane.jsx, main.jsx | preview-ui-test |

## Deferred
Cloud/account-only, gated with an unconfirmed flag, or no local backend: cloud/remote env menus and Projects section; Feature of the week and CLI import; session presets card (gated); folderless start (gated); sidebar environment filter; session rail toggle (gated); session-list layout (gated); dictation; usage-limit banners; coordinator mode; Read aloud; Run in background (needs core support); remote file browsing; Push / Move to cloud; policy/secure-mode preview banners; cookie import; task families tree (gated); session rail tasks (gated); peer messages; View artifact; Stop review; push-notification modal; Claude-account Code settings; mobile simulators / SSH settings sections; Extensions page; account pages; auto-update banner; Copy session link chord. Local sandbox switches stay as the justified core adaptation.

Refuted (no action): collapsed-group attention badge (gated presets list only); native window.confirm (the reference uses it too).
