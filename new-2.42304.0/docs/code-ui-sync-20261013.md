# Code UI sync with reference 2.31226.0 (2026-10-13 – 10-15)

All 39 batches from `docs/code-ui-inventory-20261013.md` are implemented. Each was then reviewed adversarially and integrated in waves (build + unit tests + offscreen suites).

- Reference: `reference/installed-2.31226.0-20261012/ion-dist/assets/v1`. Formatted chunks are in `analysis/code-ui-sync-20261013/readable/`.
- Per-batch notes: `analysis/code-ui-sync-20261013/batches/Bxx.md`. Each has Done, Tests, Skipped, Review and Integration sections, with exact readable line ranges.
- Suite logs: `analysis/code-ui-sync-20261013/suites/` (one folder per wave, plus `final/`).

Symbols are the minified names in the reference chunk (for example `cc43287c9 $m/Hm` is function `$m` and `Hm` in `cc43287c9-*.js`).

## Final verification (2026-10-15)

- **Build:** `npm run build` passes.
- **Unit tests:** the full suite (`node --test --test-concurrency=6 tests/*.test.mjs`, the same files as `npm test`) ran 3486 tests: 3458 pass, 22 fail, 6 skipped.
  - 14 of the failures were load timeouts. These are files-pane-states (12, a vite SSR "transport invoke timed out"), git-status:98 and file-name-search:272. All three files pass when re-run alone (57/57).
  - 8 failures predate this work (see Unresolved below).
- **Offscreen suites:** `run-suites-parallel.mjs -j 4 --all` ran 77 suites. 64 PASS; 3 LOAD (files-pane and sidebar-chrome passed on the serial retry, and transcript-scroll passed after the script fix below); 10 FAIL, all present before this work. Logs: `analysis/code-ui-sync-20261013/suites/final/`, summary `suites/final.run.txt`.
  - After the version bump, titlebar, code, transcript-scroll and home-page were run again and all PASS (`suites/final/postbump/`).
- **Fixes made during the finalize:** both are script updates that follow the reference; no product code changed.
  - `scripts/workflows-ui-test.mjs`: Large transcript text is now 15px, the B38 reference value.
  - `scripts/transcript-scroll-ui-test.mjs`: the script dismisses the B27 split-view tip, a fixed bottom-right banner (shared-frame `wC`), which covered the Send button.
- **Version:** 0.2.185 → **0.2.186** in package.json and package-lock.json. Added the 0.2.186 entry to `src/release-notes.mjs`, which `verify-release-notes` requires. The build stamped `public/build-info.json` with 0.2.186.
- **Package:** `npm run package` produced `releases/OpenClaude Desktop-darwin-arm64/OpenClaude Desktop.app` (CFBundleShortVersionString 0.2.186), and the local ad-hoc signature verified. `node scripts/verify-build.mjs` reports passed: true. The packaged app was not launched or installed.

### Unresolved failures (present before this work)

**Unit tests (8):**
- `bypass-carry:65` and `cross-fixer-r3:188`: stale regexes against main.cjs after the requestRpc and coworkSessions quit refactors.
- `i18n:32`: ICU plural/select placeholders in another agent's `zh-CN/surfaces.mjs`.
- `offscreen-suite-registry:15/:34`: the current-routine-form registry entry and the preview readText floor.
- `source-field-render` ×3: TextField.

**Offscreen suites (10).** Each fails at the step earlier waves recorded:
- edit-read :419, session :723, pane :555, scrollbar-mode :259 and user-markdown :258. All five still expect the read-only `.source-file-preview` / `data-active-line` viewer. Since the Oct 12 file-editor port, writable text tabs open in SourceFileEditor (`.sfv-editor-jump`).
- file-search: New from session B resets the cwd to the remembered surface folder (surface work).
- skills-mcp :1262: `/new` aliases `/clear` and starts fixture-thread-105.
- workflow-config :72: the new workflowSaved row.
- workflows :102: no "Stopped" region after Stop this workflow. This is in the user-owned workflow code and was left alone.
- onboarding :65: setup card padding is 24px 28px.

## Per batch

### B01 Composer folder/file intake, raw group names
- **Ported:** Add › Add folder (cc43287c9 `$m/Hm`, ca80fca8d `zN`). It adds folder chips and extra folders and never leaves the session. In a session it grants through `updateSessionMetadata`, rolls back on failure and shows the "Couldn’t add {count} folder(s)" toast.
- **Ported:** Finder paste and drop splits folders from files (cc43287c9 `cg/$h/sg`, shared-50 `kk`). Folders go through the `/add-dir` route.
- **Ported:** Move-to-group menus show group names raw (shared-21 `lz`).
- **Local files:** `src/composer-attachments-model.mjs`, `main.jsx`, `source-composer.jsx`, `source-sidebar.jsx`.
- **Verified:** `composer-folder-intake` (new), composer/sidebar unit tests, composer-states suite.
- **Review fixes:** rollback only while the session is still current, keep chips that existed before the add, grant live to a running turn.
- **Remaining:**
  - The MN disabled states are remote-only.
  - There is no ccr/ssh add-files lane.
  - Clipboard data with no path that is not an image still gets the image notice.
  - Whether Electron paste reports directories has not been checked live.

### B02 Popout window correctness
- **Ported:** comments from a popped-out Changes or Plan pane are relayed to the composer (c44d00c7f `ma/ha/ga`, `popout-add-to-prompt` IPC, window-registry add-to-prompt route).
- **Ported:** popouts mirror the main window's appearance (cd377abb5 `qn/Jn/Yn/ar` → `src/appearance-root.mjs`).
- **Ported:** a restored pinned popout shows the pressed pin (shared-18 `mx/hx`).
- **Ported:** popout size is 900×700 with a 400×320 minimum (cd377abb5 `Vn/Q`).
- **Verified:** inline-comments, window-registry, appearance-root, popout-window tests; split-windows and pane-layout suites (900×700 is asserted).
- **Review fix:** `config-updated` replaces the config instead of merging into it, so a theme reset reaches popouts.
- **Remaining:**
  - Comments become composer snippets, not session annotations.
  - `lang` and text size are not mirrored live.
  - A relay that main rejects still drops the comment.

### B03 Home folder picker
- **Ported:** picking a Recent folder saves it as the Home folder (cc43287c9 `FZ/NZ`, shared-75 `EL`).
- **Ported:** the Recent list uses each session's origin folder and hides missing and scratch folders (c749529a1 `_/E/D/P`).
- **Ported:** a detected-projects tier reads VS Code, Cursor and Zed history and scans home folders (asar `getDetectedProjects`), in the new `electron/recent-folders.cjs`.
- **Ported:** first-run placeholder (`Zq`). The env tooltip names the running core.
- **Verified:** recent-folders-model/main, composer-placeholder, worktrees tests; home-page and composer-states suites.
- **Review fixes:** main only trusts folders it recorded itself (a security fix), uses a 50-slot fs queue, and checks scratch folders against originCwd. node:sqlite was confirmed in Electron 44.
- **Remaining:** no remote-host recents; no scratch-workspace feature locally.

### B04 Sidebar loading and persistence
- **Ported:** skeleton, then "Couldn’t load your sessions" with Try again (shared-21 `BQ/VQ/HQ/UQ/YQ`).
- **Ported:** persisted group collapse (shared-50 `collapsedGroups`).
- **Ported:** Show less with held state and announcements (shared-21 `H0`, `y0/x0/S0`, xg `showFewerRows`).
- **Ported:** row menu separator and Unarchiving…; sidebar error boundary (`lK`); hover-reveal Hide sidebar (`tK`).
- **Review additions:** the Bz 500 ms multi-click guard, and the open row's folded group expands (`mS`).
- **Verified:** sidebar-model, source-sidebar-states tests; sidebar, sidebar-rest, sidebar-chrome suites.
- **Remaining:**
  - The boundary wraps the whole sidebar (the reference wraps only the list).
  - First run with no core shows the load-failed alert.
  - No remembered skeleton row count.

### B05 Composer queue, slash trigger, send/stop
- **Ported:** queued "Send now" (cf74bc599 `nS/oS/aS`, cc43287c9 `queueBarSendNow`). It steers through turn/steer and restores the entry on refusal.
- **Ported:** mid-message slash menu (shared-5 `mS/yS`, c5cd1b4dc `qt`).
- **Ported:** StopCircle Stop button, `code-prompt-send`/`code-prompt-stop` test ids, the fork tooltip row, and the editor max height `min(24rem,40svh)` (ca80fca8d `vP/yP`).
- **Verified:** queued-messages, session-command, composer-editor tests; composer-states, slash-commands-complete, tooltip and ui029 suites. 45 scripts switched to the test ids.
- **Remaining:**
  - steerHeadOnly (cloud only).
  - The "Sending…" busy state ends after the queue delete.
  - A single promote lock.
  - The fork row shows even when the draft has attachments.

### B06 Keyboard: type-to-focus, scroll keys, F6
- **Ported:** type-to-focus and Tab-to-composer (cc43287c9 :45084-45180, ca80fca8d `focusAndInsert`).
- **Ported:** Arrow/Page transcript scroll with the reference easing.
- **Ported:** F6 / ⇧F6 region cycling (ca1d33d05 `FocusRegionNavigationOn`). The review corrected the stops (conversation, header, main, composer ring, pane order) and added `jump_to_*` palette commands.
- **Local files:** `pane-keys-model.mjs`, `focus-region-model.mjs`, `use-focus-regions.js`, `focus-regions.css`.
- **Verified:** pane-keys and focus-region tests; transcript-scroll, edit-read, run-command and code-fence suites.
- **Remaining:** no key queue for an unmounted editor; no Home/End pane handler; no dframe-content ring variant; no jump-command bangs.

### B07 Files live refresh
- **Ported:** agent edits invalidate open tabs; focus and 5 s staleness re-reads (c4e0cfada `Te/K/Ee/Y/X`, cd2efac6e `El`).
- **Ported:** fs.watch-backed tree refresh (`electron/files-watch.cjs`, cccc2cf0a `mv/Ey`).
- **Ported:** root tree retry (`Oy`) and dropping restored tabs for deleted files (`Ic/Rl`).
- **Review fixes:** focus handoff after retry; a newer read restarts an in-flight one.
- **Verified:** file-live-refresh, files-pane-states, tile-layout-store tests; files-pane and file-editor suites.
- **Remaining:** popout Files windows get no agent-edit invalidation; folders are watched only while the tree is visible; a recreated folder is not re-watched.

### B08 Git band PR state
- **Ported:** "Commit changes" label.
- **Ported:** `gh pr view` lookup (`electron/git-pull-request.cjs`, shared-18 `_T`, cc43287c9 `cR/mR`): view/merged/queued band, `#N` link, CI glyph, gh install/auth hint.
- **Ported:** Create PR split button (cd5a31703 `_Le/En/Te`).
- **Ported:** branch and repo chip menus.
- **Ported:** Action Center Pull requests section (cc43287c9 `QR/$R/hR/vR/cz/iz`) and the sidebar Open PR row.
- **Review additions:** failure-kind warning glyph (c5da7eb42 `JE`), PR title tooltip, repo:base tooltip.
- **Verified:** git-pull-request, git-rail-model, source-git-band, home-model tests; git-band, git-rail and git suites.
- **Remaining:**
  - No merge, ready, auto-merge, review-count or conflict controls (cloud only).
  - No PR pane or hover card.
  - Commit stays offered with a PR and a dirty tree.
  - The toast has no "open anyway" link.
  - PR association is per run only.

### B09 Title bar session menu, rename dialog
- **Ported:** CaretDown header menu and title context menu (c593f7513 `Om/wm`, ca80fca8d `E0`).
- **Ported:** ⋮ "View options" (cf74bc599 `ZT`, ca80fca8d `C4`).
- **Ported:** Rename session dialog (shared-16 `Jd`) and the title tooltip (`vm`).
- **Review fixes:** optimistic rename with the "Rename failed. You can try again." warning; no Keep awake when archived; the context menu opens at the pointer.
- **Verified:** session-title-menu-model, titlebar-tooltips tests; titlebar, menus-states, session-actions suites (18 scripts relabelled).
- **Remaining:** inline-rename failure path; the "Session menu" accessible name; the disabled title has no context menu.

### B10 Sidebar drag and drop, group menus
- **Ported:** pointer drags (shared-19 `DY/QJ`, shared-22 `ZO/XO`, `LY` ghost): pin, reorder, unpin, move to group, bulk.
- **Ported:** tear-off at the cursor (`positionWindowState`).
- **Ported:** drop into the session area; numbered Move-to-group submenu (`lz/cz`); multi-select Pin/Unpin and Set model for {count} (ce4f4374c `Me/Ne`, c39a247c4 `ve`).
- **Review fixes:** "Ungroup" label, pinned family shifts together, drop onto a folded Pinned goes to the top.
- **Verified:** sidebar-drag/bulk and window-state tests; sidebar-rest and split-windows suites.
- **Remaining:** no native halo; a truncated Pinned list drops at the end; the tear-off outside the window needs a manual check.

### B11 Transcript chapters
- **Ported:** chapter store (cd5a31703 `Hw/jwe/Iwe/Lwe/Fwe`, `epitaxy-chapters-v2`).
- **Ported:** TOC rail (cf74bc599 `tb/nb/eb`), Pin as chapter / Unpin chapter (footer `H6e`, menu `TI`), and the heading with in-place rename (`CX/wX/SX`).
- **Review fixes:** menu separator; the pin anchor no longer depends on the transcript view.
- **Verified:** session-chapters-model, source-chapters tests; transcript-states, turn-footer and rich-copy suites.
- **Remaining:** no claude.ai title generation; tool rows have no pin entry; no read-only gate; no offscreen check of the rail itself.

### B12 Rewind flow, message menu
- **Ported:** Rewind picker (cc43287c9 `J1/Y1`) and confirm (`K1`) with the file-change preview and request flow (`G4`).
- **Ported:** Rewind/Fork explanation tooltips (cd5a31703 `EI/zNe/NI/PI`).
- **Ported:** Copy image / Save image in the message menu (cd5a31703 `dI/TNe/TI`, c26fb8b6b `Ge/Ke`).
- **Review fixes:** composer refocus after a rewind; StrictMode-safe busy state.
- **Verified:** rewind-flow-model, transcript-context-menu tests; slash-commands-complete, user-actions and session-actions suites.
- **Remaining:**
  - No "Code only" restore (no core supports it).
  - No pre-/clear resume.
  - The confirm and image-menu paths have no offscreen coverage.

### B13 File previews
- **Ported:** sandboxed HTML preview served over the private `oc-file-preview://` scheme (cd2efac6e `Ql/nu/su`, `electron/file-preview-frame.cjs`).
- **Ported:** SVG as `<img>`, PDF via Chromium (c6e1d8764 `K`), and the preview-body context menu (cd2efac6e `im/Yd`, c3e58cab4 `Tn`).
- **Review fixes:** frame links are confirmed through the external-link dialog (`Ba/za`, cfdfec14c); Copy shows a toast.
- **Verified:** file-preview-frame/model, file-context-menu, file-viewer tests; files-pane and file-editor suites.
- **Remaining:**
  - Mermaid is gated in the reference.
  - No Office/VM previews.
  - The frame has an opaque origin (localStorage throws).
  - Find does not work inside the frame.
  - No filePaneOnly route.

### B14 Diff comments
- **Ported:** inline annotation cards in Changes (c44d00c7f `ha/ga/Ca/Ho/Vo`, caec4a2d4 `In`).
- **Ported:** line-number drag ranges and the selection chip plus body menu (c44d00c7f `yo`).
- **Review fixes:** cards on old-side context rows, tint for the active range, the body menu works without comments, the partial-span rule, chip-timer cancel.
- **Verified:** diff-comments model/render tests; the changes-pane suite with the new diff-comments step.
- **Remaining:**
  - Comments go out as composer snippets.
  - No count badge (PR comments only).
  - No Post to GitHub.
  - No ⌘-click on a line number.

### B15 Changes column and states
- **Ported:** Commits section (c44d00c7f `Zr/qr/Kr/Wr/Gr`) with roving keys and Copy SHA.
- **Ported:** failed state with Try again (cb61be3a2 `ze/W`), stale dim on scope switch (`Xc/al/Je`), and commit search in the scope menu (cccc2cf0a `C_`).
- **Review fixes:** unlayered button styles; tooltip group; the column stays beside the empty state; a gone commit scope resets (`te`).
- **Verified:** diff-commits, diff-scope, changes-pane-states, git-status tests; changes-pane, git-rail, diff and git suites.
- **Remaining:** Enter does not move focus to the diff body; the failed state still replaces the column.

### B16 Turn edits card, changed-file menus
- **Ported:** the turn edits card restructure (cd5a31703 `v2e/p0/m0/h0/h2e`, c425fb3cf).
- **Ported:** Changed-files row menus, tooltips and drag (c44d00c7f `vc/yc/Sc/Nr/Ar`).
- **Ported:** diff header Open in / Show in Finder (c856385e2 `cn/rn/tn/Ut`).
- **Review fixes:** rows probe the diff (`x2e/Yg`), otherwise open the file; full folder hints.
- **Verified:** turn-edits model/render, file-context-menu tests; changes-pane, diff and edit-read suites.
- **Remaining:**
  - The transcript file menu lists only the Files pane under Open in.
  - Removed files cannot be attached.
  - No comment counts.

### B17 Preview start page, dev-server detection
- **Ported:** the no-launch.json empty state (cf580efe9 `gr`, cf550b864 `_n`).
- **Ported:** static detection ported from the main-process `rUi/eUi/tUi/nUi`. It adds or appends to launch.json, then Use this starts the server (`fr/dr/ar/Si`).
- **Ported:** the Browser-tools-off state (`Or`) and the hidden Dev servers trigger (`Xr`).
- **Review fix:** an empty `configurations` array shows the start page.
- **Verified:** preview-launch, preview-detection-model, preview-pane-render, preview-service tests; preview suite.
- **Remaining:** no agent-based detection scan; HTML/Django/bun candidates were dropped (matching the reference).

### B18 Preview server states
- **Ported:** start-failure card with auto-send to the agent (cf580efe9 `yr/Or/Er/Rr/zr`, ca80fca8d `kq`) and the port-held error.
- **Ported:** Stopped card (`mr`) and the restored last frame (`ri`, frames saved at quit).
- **Ported:** setting-up/starting states (`bi`, `Or`) and the logs drawer source and persistence (`bn`, `ua`).
- **Review fix:** failure logs are re-read on each failed run.
- **Verified:** preview-model, preview-pane-render, preview-service tests; preview and shutdown suites.
- **Remaining:** no crab GIF; no auto-start; failure notes are keyed by server name; no offscreen coverage of the cards.

### B19 Terminal pane
- **Ported:** drop paths into the terminal (cccc2cf0a `lg/og/sg/cg`, c73f45bc3 `Fo`).
- **Ported:** running-command tab titles via the extracted cf718f694 adapter (`generated/code-editor/terminal-titles.mjs`).
- **Ported:** More terminals overflow, the Shell exited overlay (c6bf19e8f), the chunk-load failure (`Rg/Bg`), and rename / auto-close rules.
- **Review fixes:** focus goes to the overlay button; restart error state; stale titles cleared on exit.
- **Verified:** terminal-drop-titles, terminal-model, terminal-pane-render tests; terminal suite.
- **Remaining:** in-app drag is gated on the composer accepting attachments; no `$n` combining-mark cap; no live overflow layout.

### B20 Code-block inline run
- **Ported:** Run in terminal streams output inline with Cancel (c19e90103 `Bg/Lg/Pg/Ng`, ca41b3815, c11959232, c03935b01, c7146e7f4, c26fb8b6b `qn/Xn`).
- **Ported:** the bash-turn path that sends output to the model (cc43287c9 `sb/oh`) and the `Bg` block eligibility rules.
- **Local files:** `code-block-run-model.mjs`, `terminal-store.mjs`, terminal-service `probe/ready` ops.
- **Review fixes:** queue output before the PTY key exists; ignore terminal replies; refuse a second run while one is going; focus ring.
- **Verified:** code-block-run, terminal-store, terminal-service tests; code-fence, terminal, run-command and stream-highlight suites.
- **Remaining:**
  - An OSC 133 run waits for D (the reference settles after 750 ms).
  - The bash turn runs in a dedicated tab.
  - Echo stripping does not know the PTY width.

### B21 Tasks pane, subagent view
- **Ported:** subagent stick-to-bottom (cccc2cf0a `Ow/qa`, c7f8992b4 `T/C`).
- **Ported:** Clear finished tasks in the header (`rw`), "Stops in" (`OC/QS`), Stopping…, truncation copy (`lC/sC`), and the /tasks and /workflows behaviour (`o4/s4`).
- **Review fixes:** follow releases on the reader's scroll; key classifier; disabled hover styling.
- **Verified:** background-tasks-model, task-output-follow, agent-tools-background tests; background-tasks and subagents suites.
- **Remaining:** reduced qa port; local `codeDesktop.dismissedTasks` key; no `/workflow` alias.

### B22 Plan pane comments
- **Ported:** inline plan comment marks (cccc2cf0a `Ah/jh/Mh/kh/Lh/Rh`) with the floating editor (cd5a31703 `Na/wot`, c82eca2bd `H`).
- **Ported:** plan-mode gating (`Xh`) and the loading / earlier-history error states (`Jh/Hh`).
- **Review fixes:** tooltip layer, the alert role on text only, reset on session change.
- **Verified:** plan-comments-model, source-plan-pane tests; pane-layout and session suites (the pane suite fails earlier at a pre-existing step).
- **Remaining:**
  - No plan "Open in" (no core reports a plan file).
  - No selection band layer.
  - Comments are per window.
  - Sub-agent plan reviews also enable comments.

### B23 Settings nav and sections
- **Ported:** nav General / This computer › System / Customize, and Usage in the nav (shared-19 `BC/ZC`).
- **Ported:** Code › Browser group with Open links and Keep cookies (c71860c77 DzP8HoeV `Kr`, cdc95db1a `f`).
- **Ported:** Prompt suggestions row (`cr`), the Sessions heading, the dialog clamp (`JD`) and manual narrow tabs (`BD`).
- **Review fixes:** sessionless preview-storage IPC; Usage placed after General; roving narrow tabs; "Settings › General" copy.
- **Verified:** settings-shell-render, settings-search, preferences, preview-service tests; settings, settings-complete, settings-rest, usage and menu-bar suites.
- **Remaining:**
  - Usage opened directly keeps the stacked dialog.
  - Turning Prompt suggestions off does not stop MiMo's predict call.
  - Extension Packs need a rebuild to report promptSuggestion.

### B24 Customize Skills and Plugins
- **Ported:** "Your skills" list with Filter/Sort, sections and row menus (c5e558aae, ccea1f474 `Ws/Xs/ec/Ra`, c27f32a39, c6a2a31c4).
- **Ported:** "Your plugins" list with Show/Sort, the Manage marketplaces dialog, and plugin detail Commands/Monitors/Agents tabs (c24c8737b, c99ed1520).
- **Review fixes:** CDS `Badge` (shared-frame `Xo/Ho`), New-badge rules, always-on tabs, Remove skill? copy, marketplace "Last updated".
- **Verified:** customize-list-model, plugin-detail, customize-states, plugin-manage tests; extension-packs and settings suites. The skills-mcp suite passes every B24 step and then fails at a pre-existing step.
- **Remaining:**
  - No Discover tab or usage sorts (cloud).
  - Plugins have no updatedAt.
  - No core reports commands, monitors or agents yet.
  - Section names use the core's name.

### B25 Command palette, shortcuts dialog
- **Ported:** palette Actions catalog with registry groups (shared-1 `_R`, cf74bc599 `wO`, c2771e1f6 `Yo`).
- **Ported:** shortcuts dialog with three sections (c518a31cc `Ce`); ⌥⌘G opens the PR; ⌘. removed.
- **Review fixes:** session rows are titled with the session name; Unarchive is hidden while it runs.
- **Verified:** sidebar-palette, shortcuts-dialog-model tests; session-actions, menus-states, sidebar-chrome suites.
- **Remaining:**
  - Palette row actions, compose mode and the Unread group are gated in the reference.
  - No facets.
  - Archive keeps a second chord.
  - Some reference chords are not bound locally.

### B26 Adaptive split grid
- **Ported:** a pane store port (shared-16 `Q` `qa/Aa/…/Ka`): up to 5×2 panes, CSS grid with column, row and corner resizers (CDS `Kr`).
- **Ported:** New session below, move and focus chords (`N$/F$`), narrow parking (`u1`), the pane grip with ⌘-drag move (`uN/BM/UM`), the drop overlay (`xJ/SJ`), and the Close pane control (`VT`).
- **Review fixes:** extra panes open their session; View-options pane items (`Qse`); the drag label is portaled; the primary pane is always a named region.
- **Verified:** split-view-model/render, split-windows-wiring, window-registry, app-menu tests; split-windows, files-pane and session-actions suites.
- **Remaining:**
  - Draft blip before an extra pane's boot.
  - No external drag cancel.
  - Close focus handoff.
  - Per-window persistence.

### B27 Session popout windows
- **Ported:** sidebar-less session and draft popouts with "Open in main window" and the pin (cd377abb5 `Vn/Q/xi/si`, shared-11 `Xo/Zo`, shared-18 `mx/hx/yx`).
- **Ported:** Tasks and Terminal pane popouts (c03935b01 `$a`) and the side chat popout (cccc2cf0a `kT/AT`).
- **Ported:** split suggestion tip (c11959232 `yd/bd/vd/wd/Td/Ed`) and agent window-layout tools (c2189a16b, `electron/agent-tools/window.mjs`).
- **Integration fixes:** the window tools are added to the ACP bridge `APP_TOOL_NAMES`; the pin shows as pressed.
- **Verified:** session-popout-windows, split-suggestion, layout-command-model tests; split-windows, pane-layout and terminal suites.
- **Remaining:**
  - The Preview popout is gated off in the reference.
  - No side-chat popout while an answer streams.
  - Layout tools accept only "self".
  - Popouts are saved only when a quit starts.

### B28 Local environment
- **Ported:** the Local env row (cc43287c9 `dX Ft`, ca80fca8d `DJ/EJ`) and the "Edit local environment" dialog (c3f9f1667 `Ae/Me/Ne/Pe/Oe`, c29df1c52 `v`, c30c42d34).
- **Ported:** a .env parser and validator (cbd210f48, c66c54bc9) and an encrypted store (`electron/local-environment.cjs`) merged into core spawns.
- **Review fixes:** stuck-save guard direction; Cancel goes through the dirty check; idle detection; core-neutral hint.
- **Verified:** local-environment, sidebar-fork-env-settings tests; home-page suite.
- **Remaining:**
  - **No SSH submenu** (no SSH transport for the cores).
  - Variables apply on reconnect.
  - Workflow runners don't get them.
  - Codex shell policy filters KEY/SECRET/TOKEN names.

### B29 Home Action Center polish
- **Ported:** backlog chips and the See more dialog (cc43287c9 `l0/A0/m0/h0/v0/j0`, asar `Ca` TaskBacklog).
- **Ported:** errored sessions as Needs input (shared-19 `D6/O6/k6`) and the hover card (shared-21 `Vse`, ca0409d7c).
- **Ported:** greeting slot, worktree spawn phases (`_3`), group chip (`CZ/AZ/jZ`), git-missing dialog (`nY/rY`), and the 0.2.185 release notes with a build check.
- **Review fixes:** backlog folder scoping, focus rules, the KJ "Open in terminal" variant.
- **Verified:** task-backlog, home-polish-b29, home-model, worktrees tests; home-page and titlebar suites.
- **Remaining:** no prompt-suggestion chips; the hover card is read-only (no quick approve); no evicted/orphaned filings.

### B30 Composer menus and chin polish
- **Ported:** Add menu Connectors and Plugins shapes (ca80fca8d `jN/zN/GN`).
- **Ported:** Default and Recommended permission badges (`uz/dz/fz/pz`), the Manual warning tone and loading skeleton (`O$/A$/N$/W$`).
- **Ported:** model Default badge and Unsupported row (c593f7513 `lp`), effort slider default mark (c8e04f916, c2d9b9a76), auto-compact hint (`nH…oH`), fast chord while running, chin truncation.
- **Review fixes:** "Add plugins" / "Browse plugins"; per-connector page links; `aria-describedby` on the hint.
- **Verified:** add-menu-model, composer-menus-b30, model-menu-model, context-usage tests; composer-states, permission and menus-states suites.
- **Remaining:**
  - Local Tools and Skills submenus are kept.
  - No Preset badge.
  - The Unsupported row only shows briefly.
  - Connector rows are not tool checkboxes.

### B31 Composer editor features
- **Ported:** rich text with link, strike, inline code and code block, plus input rules, paste paths, the link bubble and the edit dialog (shared-5, shared-175 `Ty/wy/dy/ty/Qv`, shared-7 `yE/lE`, ca80fca8d `bI/KM/qM/JM`).
- **Ported:** @ Sessions and Agents providers with a new `list_events` tool (ca80fca8d `vN/jj/TN`).
- **Ported:** slash loading and failed states (c5cd1b4dc, ccc334009); Import GitHub issue via gh (cc43287c9 `gH/oH/…`, `electron/github-issues.cjs`).
- **Review fixes:** one-character code spans; no link wrap in bash mode; Backspace clears a code block; picker loading state.
- **Verified:** composer-editor-model, mention-model, github-issue-model tests; slash-commands-complete and composer-states suites.
- **Remaining:**
  - No Saved draft pill.
  - No Linear import.
  - No syntax highlighting in code blocks.
  - Drafts persist as text.
  - Bare domains are not autolinked.

### B32 File viewer cards and menus
- **Ported:** missing-file Try again and Create file (cd2efac6e `mp/fp/bp/Cp/wp/Tp`).
- **Ported:** Show in Finder and Add folder on the outside, binary and media cards (`Gl/cu/tp/ep/pp`, asar `DI`).
- **Ported:** breadcrumb context menus (`ko/tc/qs`, c856385e2 `Jt/Zt`).
- **Review fixes:** focus handoff on unmount; loading while the folder offer is pending; outside-file reveal; realpath matching; rollback.
- **Verified:** file-unavailable-model, file-viewer, file-context-menu, session-file-access tests; files-pane and file-editor suites.
- **Remaining:**
  - Added-folder files are read-only.
  - Simplified folder judge.
  - Missing-file name segment menus.

### B33 File tree polish
- **Ported:** trailing-slash folder rows (cccc2cf0a `Pv/Fv`), single-child auto-expand (`iv/av`), disabled symlink rows (cd2efac6e `Qo`), and the reveal flash (`Bv/My`).
- **Ported:** indent guides (ce9ca5630 `g`), the Enter focus handoff (c82eca2bd `M`), and the file-tree coachmark (c51596d2b, shared-frame `mT`).
- **Integration fix:** the NUX gate (shared-5 `Sy`: no onboarding, account at least 24 h old).
- **Verified:** file-tree-row-model, file-name-search, files-search-model, files-pane-states tests; files-pane and file-editor suites.
- **Remaining:** no NUX queue or owner registry; empty folders are not listed as folder rows.

### B34 Diff extras
- **Ported:** View image Before/After (c44d00c7f `Ta…La`, cccc2cf0a `Gb`, `workspace-git-image` IPC).
- **Ported:** F7 / ⇧F7 next and previous change (c44d00c7f `Qr/$r/ei/Eo/ds`).
- **Ported:** behind-base indicator (cd5a31703 `ORe`) and the branch-switch other-sessions note (cc43287c9 `RJ`, shared-8 `cp`).
- **Review fix:** header overlay layout CSS.
- **Verified:** diff-image-model, diff-change-nav-model, git-status, branch-picker tests; git-rail suite (the behind-indicator expectation was fixed), diff and changes-pane suites.
- **Remaining:** captions use toLocaleString; mac-only shortcut rows; no offscreen check of the image dialog.

### B35 Agents, tasks, notifications
- **Ported:** workflow "Agents" and "Not run" phases (c62da1b56 `ge/he`, cd5a31703 `b1/j0e/I0e`; minimal edits to the user's workflow code).
- **Ported:** large-workflow band with Stop (cc43287c9 `Oq…qq`), running verbs (cccc2cf0a `jC`, c52b02f3f `Pf`), per-session task rows (c03935b01), the conclusion stats line (cccc2cf0a `zw`), and notification titles and suppression (asar NotificationService `TV`).
- **Review fixes:** permission banners titled with the project; forget on delete; rounding; busy focus.
- **Verified:** workflow-size-band-model, workflows-ui-model, background-tasks-model, settings-complete-model tests; background-tasks, subagents, workflow-package, settings-complete suites.
- **Remaining:**
  - No thinking-summary note (gated).
  - Inline Large workflow chip kept.
  - "Failed" instead of "Error".
  - The workflows suite fails at a pre-existing step.

### B36 Settings minor pages
- **Ported:** Clean up inactive sessions (c71860c77 C_7Gqn1u `Nt/Lt/Jt/Kt/X/Rt`, main `rfa/nfa/ifa/cfa` → `electron/code-cleanup.cjs`) and Clear cache and restart (`Pfa/Mvi`).
- **Ported:** Usage Time range and Chart metric (29nOu6oI `B/W/M`).
- **Review fixes:** running workflows count as in use; error copy; aria-describedby; default segment size.
- **Verified:** code-cleanup, storage-cleanup-model, settings-shell-render, usage-cost tests; settings-rest, settings and usage suites.
- **Remaining:**
  - No Output style row, Computer use group or MCP View logs (no local backend).
  - The Cost segment has no reason tooltip.
  - Cancel is global.

### B37 Dialogs and toasts
- **Ported:** dirty-worktree archive/delete copy and in-place delete check (shared-19 `TK/DK/EK/FK/IK/BK/SK`).
- **Ported:** toast description and action API (`aV/mV`), role=alertdialog (shared-frame `_g`) and the InfoTip popover (`pw`).
- **Review fixes:** a queued dirty-worktree confirm for bulk actions with the "More sessions…" line; terminal script role; InfoTip focus ring.
- **Integration fix:** a popup Escape no longer closes Settings (source-popover).
- **Verified:** toast-store, worktree-dispose, infotip tests; sidebar, preview, current-routines and skills-mcp suites.
- **Remaining:**
  - No multi-folder worktree copy.
  - Dedupe is by title + description.
  - Escape from a hover-open InfoTip trigger still reaches Settings.

### B38 Global appearance and window
- **Ported:** re-vendored 2.31226.0 CSS (shared-frame-Vh6rJ546, shared-styles-CTu5t_TM, c6a992d55-C0zTICcS, ce598b86c), the new fonts, and icons.json (370 glyphs).
- **Ported:** Large text at 15/22, cjk-order (ion-dist index.html), localized `/theme` (cc43287c9 `r4`), zoom snapping and the persisted zoom hint (`iSi/pBn/SBn`).
- **Review fix:** start zoom is applied after the first load instead of through webPreferences.zoomFactor.
- **Verified:** design-token-refs, theme-command-model, window-chrome, cjk-order tests; settings, sidebar and split-windows suites.
- **Remaining:** no boot-shell frame; zoom has no offscreen assertion; two provenance comments name the old CSS file.

### B39 Preview allowed sites, landing preview
- **Ported:** persisted allowed origins with the Manage allowed sites dialog in the pane menu and in Settings (cf580efe9 `Xr`, c25b1be4a, c36734a81, cdc95db1a `m`, asar `mP/RP/BP/…`).
- **Ported:** Preview on the New session page (c5da7eb42 `Bd`, `KA`, cf550b864).
- **Review fixes:** cloud metadata and any-address hosts are refused; the dialog closes during add.
- **Verified:** preview-allowed-origins, preview-service, preview-pane-render, settings-shell-render tests; the preview suite, including the allowed-sites step.
- **Remaining:**
  - No "Always allow" on the approval card.
  - No safety/DNS check.
  - No cookie import.
  - The landing preview is not adopted by the new session.

## Remaining differences (consolidated)

**Cloud, account or remote only (skipped by design).**
- PR merge, auto-merge, review and conflict controls, PR pane and hover card.
- claude.ai chapter titles.
- Remote/SSH/WSL environments and recents.
- ccr/ssh add-files lanes.
- Remote PTY reconnect.
- Discover / shared-with-you / usage sorts in Customize.
- Plugin upload/create.
- Linear issue import.
- Copy session link.
- Output style default row.
- Computer use settings.
- Per-server MCP logs.
- Allowed-site safety check and cookie import.
- Prompt-suggestion chips on Action Center rows.
- Native halo tear-off window.
- Steer-head-only queue mode.
- Office/VM file previews.
- Post to GitHub on diff comments.

**Gated off in the reference build.**
- Mermaid in Markdown preview.
- Preview pane popout.
- Palette row actions, compose mode and Unread group.
- Large-workflow band flag (the local band always shows).
- Thinking-summary note.
- View-options Debug submenu.

**Needs core support that no local core has.**
- SSH submenu.
- Rewind "Code only" and pre-/clear resume.
- Agent-based dev-server detection (possible for native Codex cores; left for a follow-up batch).
- Plan "Open in" (no plan file path).
- Plugin commands, monitors and agents tabs: implemented, but no core reports this data.
- Plugin updatedAt.
- Quick approve from the Home hover card (blocked by the visible-thread safety guard).

**Local adaptations and known gaps.**
- Comments (diff, Files, popout) become composer snippets, not session annotations.
- Popouts don't mirror `lang` and text size live.
- A rejected popout relay drops the comment.
- Commit stays offered with a PR and a dirty tree.
- PR association lasts only for the current run.
- An OSC 133 inline run waits for the D marker.
- Stick-to-bottom is a reduced qa port.
- The sidebar boundary wraps the whole sidebar.
- A first run with no core shows the load-failed alert.
- Usage opened directly keeps the stacked dialog.
- Turning Prompt suggestions off doesn't stop MiMo prediction.
- Local env variables apply on reconnect and don't reach workflow runners.
- Session popouts are saved only when a quit starts.
- Agent layout tools accept only `self`.
- No NUX queue.
- Saved draft pill missing.
- No syntax highlighting in composer code blocks.
- Bare domains are not autolinked.
- Files opened from an added folder are read-only.

**Not covered by offscreen suites (unit/SSR only).**
- B10 tear-off outside the window.
- B11 chapter rail.
- B12 rewind confirm with a rewindFiles core, and the image menu.
- B15 commits section (the fixture has no commits ahead of main).
- B18 failure, stopped and restored cards.
- B34 View image dialog.
- B36 cleanup dialog layering.
- B38 zoom.
- B01 real Finder paste.

**Unresolved test failures.** See "Unresolved failures" under Final verification.

## Deferred (from the inventory, not part of the 39 batches)
- Cloud and remote env menus, the Projects section.
- Feature of the week, CLI import.
- Session presets card (gated), folderless start (gated).
- Sidebar environment filter.
- Session rail toggle (gated), session-list layout (gated).
- Dictation.
- Usage-limit banners.
- Coordinator mode.
- Read aloud.
- Run in background (needs core support).
- Remote file browsing.
- Push / Move to cloud.
- Policy and secure-mode preview banners.
- Cookie import.
- Task families tree (gated), session rail tasks (gated).
- Peer messages.
- View artifact.
- Stop review.
- Push-notification modal.
- Claude-account Code settings.
- Mobile simulators and SSH settings sections.
- Extensions page.
- Account pages.
- Auto-update banner.
- Copy session link chord.
- Local sandbox switches stay as the justified core adaptation.

Refuted (no action needed):
- Collapsed-group attention badge.
- Native `window.confirm`.
