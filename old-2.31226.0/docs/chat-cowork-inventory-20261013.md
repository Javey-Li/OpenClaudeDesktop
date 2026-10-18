# Chat and Cowork inventory (2026-10-13)

Audit of OpenClaude Desktop's Chat and Cowork modes against the installed official frontend 2.31226.0. Code mode is audited separately.

**This is a plan for later.** Per the user, Chat/Cowork implementation waits until the Code UI sync is finished.

Machine-readable version: `analysis/chat-cowork-audit-20261013/inventory.json` (72 verified gaps G01-G72, 82 minor gaps M01-M82, 26 batches).

Status: **missing** (reference has it, local does not), **broken** (present but fails), **divergent** (works, clearly different), **partial** (some states missing), **matches**. Severity: **broken** (real use fails), **obvious** (noticed in normal use), **minor**.

## Inventory by area

### mode-shell

broken 2 · divergent 7 · missing 2 · matches 4. Local copies the compact (Rl) sidebar; More is used as a Chat/Cowork switch only because Chat has no other entry point.

| Item | Kind | Status | Severity | Id | Batch |
|---|---|---|---|---|---|
| Design nav row opens a placeholder page | page | broken | obvious | G01 | B04 |
| Recents filter shows Code options; Group by no-op and changes Code sidebar | interaction | broken | obvious | G02 | B04 |
| Row and title menus are the Code session menu | component | divergent | obvious | G03 | B06 |
| 'More' row is a Chat/Cowork switch | component | divergent | obvious | G04 | B04 |
| Mode switch ⌘⌥←/→ and attention dots | interaction | missing | obvious | G05 | B04 |
| Claude segment tooltip and target | behavior | divergent | minor | M01 | B04 |
| Sidebar Search field entry and keycaps | component | divergent | minor | M02 | B23 |
| Command palette wording and entries | component | divergent | minor | M03 | B23 |
| Nav rows: Projects 'New' badge, Scheduled in Chat | component | divergent | minor | M04 | B23 |
| Customize opens Settings dialog | page | divergent | minor | M05 | B23 |
| Cowork New-row 'Quick task' | interaction | missing | minor | M06 | deferred |
| Session list contents per mode | behavior | matches | minor |  |  |
| Account menu and footer | component | matches | minor |  |  |
| Hide sidebar / back-forward / collapsed peek | component | matches | minor |  |  |
| Title bar height and controls | style | matches | minor |  |  |

### chat-home

missing 4 · divergent 3 · partial 5 · broken 1 · matches 7. Plus menu and model menu are shared with Code; every fix must branch on mode !== 'code'.

| Item | Kind | Status | Severity | Id | Batch |
|---|---|---|---|---|---|
| Incognito chat | interaction | missing | minor | G06 | B26 |
| Model menu lacks Effort section | component | divergent | obvious | G07 | B10 |
| 'Project or folder' chin picker is a stub | component | partial | obvious | G08 | B10 |
| Plus menu: Web search toggle | component | missing | obvious | G09 | B10 |
| Plus menu: screenshot, Add to project, grouping | component | partial | minor | M07 | B10 |
| Plus menu cloud rows | component | missing | minor | M08 | deferred |
| Drag-and-drop stages files twice | behavior | broken | minor | M09 | B10 |
| Long paste 'Pasted text' attachment | interaction | missing | minor | M10 | B21 |
| Connectors entry states | state | partial | minor | M11 | B21 |
| Voice/Dictate placeholders | component | divergent | minor | M12 | B21 |
| Model selector trigger states | state | partial | minor | M13 | B21 |
| Default greeting copy | style | divergent | minor | M14 | B21 |
| Composer placeholder rotation | style | partial | minor | M15 | B21 |
| Greeting component, Spark, home column | component | matches | minor |  |  |
| Chat home below-composer content | page | matches | minor |  |  |
| Cowork 'Ideas for you' list | component | matches | minor |  |  |
| Add files or photos, ⌘U, image paste | interaction | matches | minor |  |  |
| Skills and Plugins submenus | component | matches | minor |  |  |
| Chat style picker (none in reference) | component | matches | minor |  |  |
| Send / Stop control | component | matches | minor |  |  |

### chat-conversation

broken 1 · divergent 7 · missing 6 · partial 2 · matches 4. Chat and Cowork render through the Code transcript, so chat affordances are absent and Code affordances appear.

| Item | Kind | Status | Severity | Id | Batch |
|---|---|---|---|---|---|
| Cowork Fork/Rewind offered but fail | interaction | broken | broken | G10 | B01 |
| Cowork tool rows show raw SDK names | component | divergent | obvious | G11 | B07 |
| Assistant reply Retry | interaction | missing | obvious | G12 | B08 |
| User message Edit | interaction | missing | obvious | G13 | B08 |
| Interrupted banner after Stop | state | missing | obvious | G14 | B08 |
| Thinking cells | component | divergent | obvious | G15 | B08 |
| Web search / fetch rows | component | divergent | obvious | G16 | B07 |
| Conversation options menu | component | divergent | obvious | G17 | B06 |
| Add to / Change project for an existing chat | interaction | missing | obvious | G18 | B06 |
| Version navigation | component | missing | minor | M16 | B22 |
| Feedback thumbs and dialog | interaction | partial | minor | M17 | B22 |
| Inline citations | component | missing | minor | M18 | B22 |
| Artifact creation card | component | partial | minor | M19 | B14 |
| Connector (MCP) tool rows | component | divergent | minor | M20 | B07 |
| Error states copy and actions | state | divergent | minor | M21 | B08 |
| Delete confirmation wording | style | divergent | minor | M22 | B06 |
| Copy, hover timestamp, failed-send Retry/Discard | interaction | matches | minor |  |  |
| Stop response | interaction | matches | minor |  |  |
| Title inline rename | interaction | matches | minor |  |  |
| Markdown, math and code blocks | component | matches | minor |  |  |

### artifacts

missing 11 · divergent 9 · matches 1. The local viewer's closest reference is c667b4aab (CoworkArtifactDetail); it is currently built on the published-frame (c2bb74286) header primitives.

| Item | Kind | Status | Severity | Id | Batch |
|---|---|---|---|---|---|
| HTML/SVG/PDF rendered preview | behavior | missing | obvious | G19 | B12 |
| Transcript artifact block | component | divergent | obvious | G20 | B14 |
| Chat artifact side panel | component | missing | obvious | G21 | B14 |
| Viewer header | component | divergent | obvious | G22 | B12 |
| Delete artifact | interaction | missing | obvious | G23 | B12 |
| Library indexes every edited file | behavior | divergent | obvious | G24 | B13 |
| Default layout grid vs list | state | divergent | obvious | G25 | B13 |
| First-run empty state | state | missing | obvious | G26 | B13 |
| 'New artifact' action | interaction | divergent | obvious | G27 | B13 |
| List row right-click menu | interaction | missing | minor | G28 | B13 |
| Version history / Restore | component | missing | obvious | G29 | B12 |
| Inline file cards open in app | interaction | divergent | obvious | G30 | B03 |
| Overflow menu trigger/items | component | divergent | minor | M23 | B13 |
| Library error/incomplete states | state | divergent | minor | M24 | B13 |
| Missing-file state | state | divergent | minor | M25 | B12 |
| Download as PDF / Pop out | interaction | missing | minor | M26 | B12 |
| Runtime error overlay | state | missing | minor | M27 | B12 |
| Tabs All/Pinned/Yours/Shared/Projects | component | missing | minor | M28 | deferred |
| Share/Publish/Copy link/comments (cloud) | interaction | missing | minor | M29 | deferred |
| Cowork 'Artifact' tool row (cloud) | component | missing | minor | M30 | deferred |
| Library frame, search, cards, skeletons, date groups, pin, Escape/focus | page | matches | minor |  |  |

### projects

missing 6 · partial 3 · broken 2 · divergent 6 · matches 3. One Cowork-style page serves both modes; extracted parts are faithful, the composition around them is thin. tests/local-projects.test.mjs passes 4/4.

| Item | Kind | Status | Severity | Id | Batch |
|---|---|---|---|---|---|
| Knowledge/context rail | component | missing | obvious | G31 | B16 |
| Archive project | interaction | missing | obvious | G32 | B15 |
| Card menu, pin indicator, folder chip | component | partial | obvious | G33 | B15 |
| Sidebar Projects no-op on detail | interaction | broken | obvious | G34 | B05 |
| New-project flow | page | divergent | obvious | G35 | B15 |
| Edit details dialog | component | divergent | minor | M31 | B15 |
| Instructions dialog | component | divergent | minor | M32 | B16 |
| Project session feed | component | partial | obvious | G36 | B16 |
| Opening a project forces Cowork | behavior | divergent | obvious | G37 | B05 |
| Project composer scope not locked | interaction | divergent | obvious | G38 | B05 |
| Add/Change/Remove project on sessions | interaction | missing | obvious | G39 | B06 |
| Load error / retry / skeleton | state | broken | minor | M33 | B05 |
| Search/sort details | interaction | partial | minor | M34 | B15 |
| Back crumb | style | divergent | minor | M35 | B16 |
| Project-page search and load/error states | state | missing | minor | M36 | B16 |
| Chat merged projects page (cloud) | page | missing | minor | M37 | deferred |
| Memory chip and section | component | missing | minor | M38 | deferred |
| Projects empty state, no-match, search expand/Escape | state | matches | minor |  |  |
| Project header (title, description, pin) | component | matches | minor |  |  |
| Composer placeholder, empty feed copy, instructions applied | behavior | matches | minor |  |  |

### cowork-home

broken 2 · divergent 5 · missing 3 · partial 3 · matches 3. Local follows the chorus unified page; legacy-only elements listed once as deferred.

| Item | Kind | Status | Severity | Id | Batch |
|---|---|---|---|---|---|
| File attachments rejected | interaction | broken | broken | G40 | B01 |
| Connectors/Tools/Skills do nothing for the task | behavior | broken | broken | G41 | B01 |
| Permission menu modes | interaction | divergent | obvious | G42 | B01 |
| Availability / VM setup states | state | missing | obvious | G43 | B09 |
| Folder/project picker | component | partial | obvious | G44 | B10 |
| Add folder replaces and navigates | interaction | divergent | obvious | G45 | B10 |
| Greeting text | style | divergent | minor | M39 | B21 |
| Placeholder rotation | style | divergent | minor | M40 | B21 |
| ⌘↵ footnote | interaction | partial | minor | M41 | B21 |
| Review popover | interaction | partial | minor | M42 | B24 |
| Ideas list selection | component | divergent | minor | M43 | B24 |
| Plugin setup card (cloud) | component | missing | minor | M44 | deferred |
| Legacy AgentNewPageContent elements | page | missing | minor | M45 | deferred |
| Active/pinned and scheduled task list | component | matches | minor |  |  |
| Greeting lockup, spark, home column | style | matches | minor |  |  |
| Idea hover preview and click-to-fill | interaction | matches | minor |  |  |

### cowork-session

broken 4 · divergent 5 · missing 6 · partial 5 · matches 3. tests/cowork-session-service.test.mjs passes 7/7; the attachment rejection is asserted there by design.

| Item | Kind | Status | Severity | Id | Batch |
|---|---|---|---|---|---|
| Output click does nothing | interaction | broken | broken | G46 | B03 |
| Send while running fails | interaction | broken | broken | G47 | B01 |
| Rewind/Fork/Compact fail | interaction | broken | broken | G48 | B01 |
| Attachments and @mentions rejected | behavior | broken | broken | G49 | B01 |
| Tool approval card | component | divergent | obvious | G50 | B07 |
| Tool rows 'Used Write' | component | divergent | obvious | G51 | B07 |
| VM / workspace status | state | missing | obvious | G52 | B09 |
| Context section | component | missing | obvious | G53 | B11 |
| Outputs section | component | partial | obvious | G54 | B03 |
| In-panel preview drawer | page | divergent | obvious | G55 | B03 |
| Progress after reopen | state | partial | obvious | G56 | B03 |
| Progress auto-collapse | behavior | partial | minor | M46 | B03 |
| Panel default/narrow/persistence | behavior | divergent | minor | M47 | B11 |
| Panel shortcut | interaction | missing | minor | M48 | B11 |
| Toggle badge | style | partial | minor | M49 | B11 |
| Scheduled-run and Upcoming sections | component | missing | minor | M50 | B24 |
| Archived notice | state | divergent | minor | M51 | B24 |
| Todo comments | interaction | partial | minor | M52 | B24 |
| Browser/computer-use cards | component | missing | minor | M53 | deferred |
| Session feedback survey (cloud) | component | missing | minor | M54 | deferred |
| Progress section rendering | component | matches | minor |  |  |
| Stop and resume after restart | behavior | matches | minor |  |  |
| AskUserQuestion questions | component | matches | minor |  |  |

### routines

broken 1 · divergent 7 · missing 3 · partial 4 · matches 3. local-routines.test.mjs passes 8/8 but stubs approveFolder, so it cannot catch G57. No calendar view exists in the reference list.

| Item | Kind | Status | Severity | Id | Batch |
|---|---|---|---|---|---|
| Run with default folder fails ('Unknown workspace directory') | behavior | broken | broken | G57 | B02 |
| Run outcome feedback | interaction | divergent | obvious | G58 | B02 |
| Missed/skipped runs in History | state | missing | obvious | G59 | B02 |
| Keep-awake banner and switch | component | divergent | obvious | G60 | B17 |
| 'New task' menu | interaction | divergent | minor | M55 | B17 |
| Template click flow | interaction | divergent | obvious | G61 | B17 |
| 'More ideas' templates | component | missing | obvious | G62 | B17 |
| Loading and load-failure states | state | partial | minor | M56 | B17 |
| Card delete confirmation | component | divergent | minor | M57 | B17 |
| Card status chip variant | style | divergent | minor | M58 | B25 |
| Sort/search/keyboard | interaction | partial | minor | M59 | B25 |
| Card status dot | state | partial | minor | M60 | B25 |
| Shared busy state on detail | state | divergent | minor | M61 | B02 |
| Create/edit success toast | interaction | missing | minor | M62 | B02 |
| Attach task to local project | component | partial | minor | M63 | B25 |
| Cards, overflow menu, empty state, template grid | component | matches | minor |  |  |
| Detail header, schedule switch, actions, history paging | page | matches | minor |  |  |
| Create/edit form (frequency, calendar, cron, discard) | page | matches | minor |  |  |

### chat-settings

missing 8 · divergent 3 · partial 4 · broken 1 · matches 2. The unified 4-group settings nav is employee-gated; the default reference nav is close to local.

| Item | Kind | Status | Severity | Id | Batch |
|---|---|---|---|---|---|
| Global instructions never reach Cowork | behavior | missing | obvious | G63 | B09 |
| Cowork workspace banner | state | missing | obvious | G64 | B09 |
| Cowork settings page | page | missing | obvious | G65 | B09 |
| Settings navigation group label | page | divergent | minor | G66 | B19 |
| General › Profile | component | partial | obvious | G67 | B19 |
| Chat font / transcript rows | component | partial | minor | M64 | B19 |
| Notifications | component | divergent | minor | M65 | B19 |
| Capabilities page | page | missing | minor | M66 | deferred |
| Chat memory settings | page | missing | minor | M67 | deferred |
| 'session' wording in dialogs | component | divergent | minor | M68 | B06 |
| Design placeholder | state | broken | minor | M69 | B04 |
| Incognito | interaction | missing | minor | M70 | B26 |
| Composer add menu Chat rows | component | partial | obvious | G68 | B10 |
| Desktop Extensions page | page | missing | minor | M71 | deferred |
| Account/cloud pages | page | missing | minor | M72 | deferred |
| Customize › Connectors directory | page | partial | minor | M73 | deferred |
| Settings search | interaction | matches | minor |  |  |
| Theme and Motion rows | component | matches | minor |  |  |

### global

divergent 5 · broken 1 · partial 4 · missing 3 · matches 3. tests/i18n.test.mjs currently fails 1/3 (surfaces.mjs ICU placeholders).

| Item | Kind | Status | Severity | Id | Batch |
|---|---|---|---|---|---|
| Shortcuts dialog Code-only | component | divergent | obvious | G69 | B18 |
| Composer model/thinking chords no-op | interaction | broken | minor | M74 | B18 |
| Jump-to-latest uses Code chip | component | divergent | obvious | G70 | B18 |
| Activity panel state not persisted/global | state | partial | obvious | G71 | B11 |
| ⌘⇧S / tooltip / announcement / icon | interaction | partial | minor | M75 | B11 |
| Activity toggle in Chat mode | behavior | divergent | minor | M76 | B11 |
| Narrow overlay mode | state | partial | minor | M77 | B11 |
| Code-only chords active | interaction | divergent | minor | M78 | B18 |
| ⌘. toggles sidebar | interaction | divergent | minor | M79 | B18 |
| ⌘⌥←/→ surface cycling | interaction | missing | minor | M80 | B04 |
| F6 region cycling / Jump to | interaction | missing | minor | M81 | B18 |
| Chat font | component | missing | minor | M82 | B19 |
| zh-CN untranslated strings | behavior | partial | obvious | G72 | B20 |
| Light/dark theme | style | matches | minor |  |  |
| Composer drafts persistence | state | matches | minor |  |  |
| Sidebar toggle, peek, last surface | behavior | matches | minor |  |  |

## Implementation batches

Ordered: broken real-use interactions first, then obvious differences, then minor polish. Each batch is sized for one agent in one sitting. Every change that touches shared Code paths (main.jsx menus, composer, transcript) must branch on `mode !== 'code'`.

| # | Batch | Priority | Items |
|---|---|---|---|
| B01 | Cowork runtime: gate or support what the composer and transcript offer | broken | G10, G48, G40, G49, G47, G41, G42 |
| B02 | Scheduled tasks: make runs start, report outcome, and record skipped runs | broken | G57, G58, G59, M61, M62 |
| B03 | Cowork outputs: clickable rows, live list, in-app preview, Progress after reopen | broken | G46, G30, G54, G55, G56, M46 |
| B04 | Sidebar shell in Chat/Cowork: Design row, per-mode recents filter, More overflow, mode switching | broken | G01, G02, G04, G05, M01, M69, M80 |
| B05 | Projects routing: route-state detail, Chat projects, locked composer scope, load error | broken | G34, G37, G38, M33 |
| B06 | Chat/Cowork session menus (row + title) and Add/Change/Remove project | obvious | G03, G17, G18, G39, M22, M68 |
| B07 | Cowork SDK tool normalization, web search rows and Cowork approval card | obvious | G11, G51, G16, G50, M20 |
| B08 | Chat message actions: Retry, Edit, interrupted banner, thinking cells | obvious | G12, G13, G14, G15, M21 |
| B09 | Cowork workspace status, Cowork global instructions and Settings › Cowork page | obvious | G43, G52, G64, G63, G65 |
| B10 | Chat/Cowork composer: model menu Effort, folder/project picker, Add menu | obvious | G07, G08, G44, G45, G09, G68, M07, M09 |
| B11 | Cowork activity panel shell: Context section, persisted collapse, narrow overlay, ⌘⇧S | obvious | G53, G71, M47, M77, M48, M75, M49, M76 |
| B12 | Artifact viewer: rendered HTML/SVG/PDF, reference header, delete, versions | obvious | G19, G22, G23, G29, M25, M26, M27 |
| B13 | Artifact library: what is indexed, defaults, empty state, New artifact, menus | obvious | G24, G25, G26, G27, G28, M23, M24 |
| B14 | Artifact block in transcript and side panel next to the conversation | obvious | G20, G21, M19 |
| B15 | Projects list: card menu, archive, creation flow | obvious | G32, G33, G35, M31, M34 |
| B16 | Project detail: knowledge/context rail and rich session feed | obvious | G31, G36, M32, M35, M36 |
| B17 | Scheduled list: keep-awake banner, templates flow, More ideas, New task, states | obvious | G60, G61, G62, M55, M56, M57 |
| B18 | Chat/Cowork shortcuts dialog and key handling; Chat jump-to-latest button | obvious | G69, G70, M74, M78, M79, M81 |
| B19 | Settings for Chat users: profile, Chat font, notifications, nav group label | obvious | G67, G66, M64, M82, M65 |
| B20 | zh-CN coverage for extracted Chat/Cowork modules and failing i18n test | obvious | G72 |
| B21 | Chat/Cowork home and composer polish | minor | M10, M11, M12, M13, M14, M39, M15, M40, M41 |
| B22 | Conversation extras: version navigation, feedback dialog, citations | minor | M16, M17, M18 |
| B23 | Sidebar search field, palette wording, nav row flags, Customize page | minor | M02, M03, M04, M05 |
| B24 | Cowork home/session polish: Review popover, ideas, run sections, archived notice, todo comments | minor | M42, M43, M50, M51, M52 |
| B25 | Scheduled list details: status chip, sort/search keys, status dot, project attach | minor | M58, M59, M60, M63 |
| B26 | Incognito chat (Chat only) | minor | G06, M70 |

### B01 — Cowork runtime: gate or support what the composer and transcript offer

Priority: **broken**

- **G10** Cowork: 'Fork from here' and 'Rewind to here' are offered but always fail (broken/broken) — Hide for cowork-vm sessions now; later implement Cowork revert + 'Restart session from here'; replace reply Fork with 'Spin off a new task'.
- **G48** Rewind, Fork and Compact offered on Cowork sessions but always fail (broken/broken, duplicate of G10) — Gate per engine; hide Fork/Compact; implement rewind/edit.
- **G40** File attachments on a Cowork task are offered but always rejected (broken/broken) — Copy attachments into <cwd>/uploads and send path text (or image blocks); else disable staging in Cowork.
- **G49** Attachments and @file mentions in a Cowork task are rejected (broken/broken, duplicate of G40) — See G40; mentions inside cwd become path text.
- **G47** Sending a message while a Cowork task runs fails (broken/broken) — Forward mid-turn input to the SDK channel (stream-json user record) and accept queue; or disable queueing for Cowork.
- **G41** Connectors/Tools/Skills in the Cowork Add menu do nothing (skills make the send fail) (broken/broken) — Wire MCP/tool/skill config into the VM session or hide these submenus in Cowork; inline skill chip as text.
- **G42** Cowork permission menu offers Code modes; Auto behaves like Manual (divergent/obvious) — Mode prop on SourcePermissionMenu with the Cowork set/labels; make Auto real or omit it; don't write the global Code preference.

Reference to port:
- cc1aae219 Tj showRewind / Aj 'user-message-rewind' (readable 6930-7240), YA 'Spin off a new task' (6224-6320)
- c21f11e6d CoworkSessionView local rewind/edit ho/go/mo (readable 18920-19110), Nt gate (18035)
- shared-28 CT frontend-queue gate + asar LocalAgentModeSessions.sendMessage (messageBuffer push while running)
- shared-23 XI file-drop-bridge / opened-files-bridge, enableScreenDrop (readable 7184-7246)
- shared-8 mj.cowork/hj/_j Cowork permission labels (readable 16433-16640)
- cb1e253a0 Qv/$v connector attach messages

Local files:
- `app/src/main.jsx`, `app/src/source-chat-composer.jsx`, `app/src/source-permission-menu.jsx`, `app/src/source-bypass-permission.jsx`, `app/src/composer-attachments-model.mjs`, `app/src/message-actions-model.mjs`, `app/electron/cowork-runtime/session-service.mjs`, `app/electron/cowork-runtime/sdk-channel.mjs`, `app/electron/main.cjs`, `app/tests/cowork-session-service.test.mjs`

Verify with:
- `cd app && node --test tests/cowork-session-service.test.mjs`
- `cd app && node --test tests/queued-messages-model.test.mjs`
- `cd app && node --test tests/session-command-model.test.mjs`
- `cd app && node --test tests/transcript-context-menu-model.test.mjs`
- `cd app && node --test tests/composer-attachments-model.test.mjs`
- `cd app && node --test tests/permission-policy.test.mjs`
- `cd app && node --test tests/bypass-carry.test.mjs`
- `app/scripts/surfaces-ui-test.mjs`
- `app/scripts/permission-ui-test.mjs`
- `app/scripts/user-actions-ui-test.mjs`
- `app/scripts/composer-states-ui-test.mjs`

Notes: Start with the stopgap engine gate (sessionMetadata[current].engine === 'cowork-vm' or cw- thread id) so Fork/Compact/Code-rewind, queue/steer, attachments, Tools/Connectors/Skills and Bypass stop failing; then add real support in session-service: mid-turn stream-json user input, attachment copy into <cwd>/uploads, 'Restart session from here' rewind, Cowork permission option set (Manual / Auto / Skip) with Auto actually differing from default. Update the 'unsupported attachments are explicit' test when attachments become supported.

### B02 — Scheduled tasks: make runs start, report outcome, and record skipped runs

Priority: **broken**

- **G57** Running a task with the default folder fails with 'Unknown workspace directory' (broken/broken) — Approve all routine cwds at startup and on save; main-level regression test.
- **G58** Run outcome feedback: no started/failed toast; failures pile up as permanent alerts (divergent/obvious) — useSourceToasts for run outcome with View link; remove alert list.
- **G59** Missed or skipped runs are not shown in History (missing/obvious) — Record missedRuns with reasons in start() and the overlap branch.
- **M61** Busy state shared across actions on the detail page (divergent/minor) — Track busy as {id, action}.
- **M62** No success toast after create/edit (missing/minor) — Wire addSuccess to toasts.

Reference to port:
- shared-18 FH run hook: AH 'Scheduled task “{name}” started.' + View link (kH=8000), MH runFailed
- ccd3f68fe _o It missedRuns merge (readable 1189-1282) and missed row renderer (2745-2792)
- c97b955f1 ga addSuccess '“{name}” created.' / 'updated.' (3022, 3286)

Local files:
- `app/electron/main.cjs`, `app/electron/local-routines.mjs`, `app/electron/routine-runner.mjs`, `app/src/source-routines.jsx`, `app/src/source-routine-adapters.jsx`, `app/src/source-routine-form-adapters.jsx`, `app/src/toast-store.mjs`, `app/src/source-toast.jsx`

Verify with:
- `cd app && node --test tests/local-routines.test.mjs`
- `cd app && node --test tests/toast-store.test.mjs`
- `app/scripts/current-routines-ui-test.mjs`
- `app/scripts/current-routine-form-ui-test.mjs`

Notes: Approve every routine cwd (including the auto-created scheduled-tasks/<id>) at startup and on save; add a main-level regression test that does not stub approveFolder. Toast store needs an action/link option for 'View'. Use the reference enum values for missedRuns.reason.

### B03 — Cowork outputs: clickable rows, live list, in-app preview, Progress after reopen

Priority: **broken**

- **G46** Clicking an output in the activity panel does nothing (broken/broken) — Pass {path: file.path}; later the in-panel drawer (G55).
- **G30** Inline file cards cannot be previewed in the app (divergent/obvious) — Card click → onOpenFileRef; Ur-style split button with app name/icon; also fix Outputs rows (G46).
- **G54** Outputs section only partly implemented (partial/obvious) — Live outputs from Write/Edit items; deliverables for interrupted/failed turns; Lx header and rows.
- **G55** No in-panel file preview drawer (divergent/obvious) — Selected state + drawer using the file/artifact viewers.
- **G56** Progress is empty after reopening a Cowork session (partial/obvious) — In hydrate, derive plans from the last TodoWrite item (todoChecklist).
- **M46** Progress does not auto-collapse when all steps finish (partial/minor) — Port zi/Bi logic.

Reference to port:
- c21f11e6d Gx Cr/$i/da SELECT_FILE handlers and drawer toggle (readable 9322-9385, 9662-10000)
- c21f11e6d Lx Outputs/Working folder (8355-8590), gx folder group (8028), Xt/zi progress collapse (9520-9545)
- cc1aae219 XQ present_files cell SELECT_FILE 'tool_cell_present_files'
- c86bf9d9f Ur 'Open in {appName}' split button + 'More ways to open' (readable 2969-3100)
- cb1e253a0 / ccba96ec3 wn todos derived from transcript

Local files:
- `app/src/source-surfaces.jsx`, `app/src/source-surfaces.css`, `app/src/source-deliverables.jsx`, `app/src/source-session.jsx`, `app/src/main.jsx`, `app/src/state.js`, `app/src/generic-tool-model.mjs`, `app/electron/cowork-runtime/session-service.mjs`, `app/electron/cowork-runtime/deliverables.mjs`, `app/electron/main.cjs`

Verify with:
- `cd app && node --test tests/cowork-session-service.test.mjs`
- `cd app && node --test tests/state.test.mjs`
- `cd app && node --test tests/generic-tool-model.test.mjs`
- `app/scripts/surfaces-ui-test.mjs`
- `app/scripts/current-chat-ui-test.mjs`
- `app/scripts/files-pane-ui-test.mjs`

Notes: One-line fix first: source-surfaces.jsx:63 must pass {path}. Then live outputs from Write/Edit tool items, emit deliverables for interrupted/failed turns, Lx header (folder title, Go to folder, Browse files), selected-row drawer, hydrate state.plans from the last TodoWrite item. Download all is cloud.

### B04 — Sidebar shell in Chat/Cowork: Design row, per-mode recents filter, More overflow, mode switching

Priority: **broken**

- **G01** Design nav row opens a placeholder page (broken/obvious) — Drop the row (local equivalent of EJ()===null) or give it an external href; never route 'design' to the generic section-surface.
- **G02** Recents filter in Chat/Cowork shows Code options; Group by does nothing and changes the Code sidebar (broken/obvious) — Per-mode sidebarPreferences; pass per-mode groupBy; mode-specific menu variants and tooltip.
- **G04** 'More' row is a Chat/Cowork switch, not the overflow menu (divergent/obvious) — Port Tae/Dae overflow with 'Edit sidebar…' pin dialog; move Chat/Cowork switching to the titlebar segment (NR fixed target or PR pills).
- **G05** Mode switch: no ⌘⌥←/→ shortcut (attention dots flag-gated) (missing/obvious) — Window keydown Meta+Alt+Arrow → switch surface; tooltip hint; dialog rows. Dots optional.
- **M01** Claude segment tooltip and target (divergent/minor) — Persist last non-code surface; NR tooltip; allow switching during send.
- **M69** Design section is a placeholder pointing to Settings (broken/minor, duplicate of G01) — See G01.
- **M80** Missing ⌘⌥←/→ surface cycling (missing/minor, duplicate of G05) — See G05.

Reference to port:
- shared-21 cY/lY nav catalog + EJ Design gate (readable 15318-15350, 15466-15912)
- shared-21 C1/T1 filter menus (19690-20520), RS/dC per-mode prefs
- shared-21 Tae/Dae More overflow (26508-26740), D2 pinned/overflow (21576-21808), k2 'Edit sidebar…' dialog
- shared-21 NR/IR/FR mode switch (9955-10430), shared-22 kj/Aj arrow chord (14386-14411), shared-1 chorus_surface_prev/next
- c518a31cc ge() 'Next/Previous sidebar tab'

Local files:
- `app/src/source-sidebar.jsx`, `app/src/sidebar-model.js`, `app/src/main.jsx`, `app/electron/main.cjs`, `app/src/shortcuts-dialog-model.mjs`, `app/electron/preferences.mjs`

Verify with:
- `cd app && node --test tests/sidebar-model.test.mjs`
- `cd app && node --test tests/source-sidebar-states.test.mjs`
- `cd app && node --test tests/shortcuts-dialog-model.test.mjs`
- `cd app && node --test tests/preferences.test.mjs`
- `app/scripts/sidebar-ui-test.mjs`
- `app/scripts/sidebar-rest-ui-test.mjs`
- `app/scripts/sidebar-chrome-ui-test.mjs`

Notes: Drop the Design row (no local Design target). sidebarPreferences become per mode; Chat menu = Group by (Date/None) + Sort by; Cowork adds Project/Unread/Custom groups. More becomes the overflow list with 'Edit sidebar…'; move Chat/Cowork switching to the titlebar segment (fixed target, persisted). Add ⌘⌥←/→ chord. Attention dots are flag-gated (sidebar_tab_activity_dots) and optional.

### B05 — Projects routing: route-state detail, Chat projects, locked composer scope, load error

Priority: **broken**

- **G34** Clicking 'Projects' in the sidebar on a project detail does nothing (broken/obvious) — projectId as route state cleared by the Projects row; or a nav counter key.
- **G37** Opening any project forces Cowork; no Chat project page (divergent/obvious) — Keep current mode; accept surface 'chat' with instructions only; Chat copy and rail.
- **G38** Project composer scope not locked; 'Open folder…' drops the project (divergent/obvious) — scopeLocked prop renders a disabled project label.
- **M33** Load error and retry state wrong; no loading skeleton (broken/minor) — Clear error on reload; Et error; skeleton.

Reference to port:
- shared-24 router project/$uuid vs cowork/project/$uuid; cce610d10 ProjectDetailRoute/CoworkProjectRoute
- c71dee58b Ff composer default 'chat' (7754-7812), If Chat project page (7818-8070), Ke selectionLocked (7820-7975, 4235-4275)
- shared-18 SC selectionLocked picker (4436-4470)
- c17beaa76 vn load error 'Couldn’t load your projects' + skeleton (1480-1495)

Local files:
- `app/src/main.jsx`, `app/src/source-projects.jsx`, `app/src/source-sidebar.jsx`, `app/src/source-chat-composer.jsx`, `app/electron/local-projects.mjs`

Verify with:
- `cd app && node --test tests/local-projects.test.mjs`
- `cd app && node --test tests/surface-policy.test.mjs`
- `app/scripts/surfaces-ui-test.mjs`
- `app/scripts/current-library-ui-test.mjs`

Notes: Make projectId route state (cleared by the sidebar Projects row, recorded in history). openLocalProject keeps the current mode; applyProjectContext accepts surface 'chat' (instructions only). Project composer chip becomes a disabled label (no Open folder…, no mode radios). Clear error on reload. No dedicated projects UI script exists yet: add app/scripts/current-projects-ui-test.mjs here or in B15.

### B06 — Chat/Cowork session menus (row + title) and Add/Change/Remove project

Priority: **obvious**

- **G03** Chat/Cowork row and title menus are the Code session menu (divergent/obvious) — Surface-aware menu variant in tf/kC order; label caret 'More options for {label}' and title '{name}, rename chat'.
- **G17** Conversation options menu shows Code session actions instead of the chat menu (divergent/obvious, duplicate of G03) — Same fix as G03 (mode branch in the 'session' menu case, drop transcriptViewSubmenu).
- **G18** 'Add to project' / 'Change project' for an existing chat is missing (missing/obvious) — xu submenu in the session menu + a local projectId patch (sidebar-state metadata or local-projects 'assign').
- **G39** No Add to / Change / Remove from project on sessions (missing/obvious, duplicate of G18) — See G18; reuse the menu on project-page rows.
- **M22** Delete confirmation says 'session' (divergent/minor) — Chat/task copy by surface.
- **M68** Chat/Cowork dialogs say 'session' instead of chat/task (divergent/minor, duplicate of M22) — See M22 (also rename dialog title).

Reference to port:
- shared-16 qn/kC chat menu (3542-3860), Qd/tf Cowork session menu (5135-5880), xu 'Add to project'/'Change project'/'Remove from project' (3190-3243, 5779-5830)
- ca2ef848d RQ/LQ title split: 'More options for {label}', '{name}, rename chat' (25731-25960)
- shared-75 Th chat copy 'Delete chat?', 'Rename chat'; shared-1 wj 'Delete task'

Local files:
- `app/src/source-sidebar.jsx`, `app/src/source-titlebar.jsx`, `app/src/main.jsx`, `app/src/source-projects.jsx`, `app/electron/main.cjs`, `app/electron/local-projects.mjs`

Verify with:
- `cd app && node --test tests/session-operations.test.mjs`
- `cd app && node --test tests/local-projects.test.mjs`
- `cd app && node --test tests/source-sidebar-states.test.mjs`
- `cd app && node --test tests/source-titlebar-tooltips.test.mjs`
- `app/scripts/session-actions-ui-test.mjs`
- `app/scripts/titlebar-ui-test.mjs`
- `app/scripts/sidebar-ui-test.mjs`

Notes: Surface-aware SourceSidebarSessionMenu: chat = Pin, Mark read/unread, Rename, Add/Change project, Archive, Delete; cowork adds Schedule (local routine form), Remove from project, Move to group, split/new-window open items. No editors/Terminal/Finder, Fork, Export, Keep awake, Transcript view. Backend: allow projectId in the sidebar-state metadata patch. Decide cwd mismatch policy for Cowork moves.

### B07 — Cowork SDK tool normalization, web search rows and Cowork approval card

Priority: **obvious**

- **G11** Cowork tool rows show raw SDK tool names ('Used WebSearch', 'Used Read', 'Used Bash') (divergent/obvious) — Normalize SDK tool names in session-service (preferred) or add a Claude tool table.
- **G51** Cowork transcript tool rows read 'Used Write', 'Used Bash', 'Used TodoWrite' (divergent/obvious, duplicate of G11) — See G11.
- **G16** Web search / fetch rows: plain text instead of the source result list (divergent/obvious) — Reference verbs and N results meta; PH/FH result list; fetch copy with hostname; same presenter for Cowork.
- **G50** Cowork tool approvals use the shell-command card with raw JSON and no task-scoped allow (divergent/obvious) — Per-thread allowed tools + acceptForSession labelled 'Allow for this task'; per-tool headings.
- **M20** Connector (MCP) tool rows (divergent/minor) — Display name/icon from MCP rows.

Reference to port:
- shared-125 Ru/Wg/Zg/el tool name normalization and group summaries (vendored at app/src/generated/current-chat/shared-125-CbVXqztB.js)
- c05b96c7f wf verb table (readable 6029-6105), 'Used {name} integration' (7771, 8554-8616)
- cc1aae219 BH/FH/PH web search rows (17536-17862), GZ fetch rows (31179-31225), Bash/file rows (16115-16373)
- c14f706e5 ot approval decisions (readable 484-965); cd5a31703 BA/KA/JA title copy

Local files:
- `app/electron/cowork-runtime/session-service.mjs`, `app/src/generic-tool-model.mjs`, `app/src/file-tool-model.mjs`, `app/src/agent-tool-titles.mjs`, `app/src/source-generic-tool.jsx`, `app/src/approval-card-model.mjs`, `app/src/source-approval-card.jsx`

Verify with:
- `cd app && node --test tests/generic-tool-model.test.mjs`
- `cd app && node --test tests/file-tool-model.test.mjs`
- `cd app && node --test tests/tool-group-presentation.test.mjs`
- `cd app && node --test tests/approval-card-model.test.mjs`
- `cd app && node --test tests/cowork-session-service.test.mjs`
- `app/scripts/approval-card-ui-test.mjs`
- `app/scripts/current-chat-ui-test.mjs`
- `app/scripts/transcript-states-ui-test.mjs`

Notes: Normalize in the main process (Bash->commandExecution, Read/Glob/Grep->commandActions, Write/Edit->fileChange, WebSearch/WebFetch->webSearch, mcp__s__t->mcpToolCall, Task->collabAgentToolCall, TodoWrite->plan only). This also feeds Cowork Outputs (B03). Approval: per-thread allowed-tool set with 'Allow for this task'.

### B08 — Chat message actions: Retry, Edit, interrupted banner, thinking cells

Priority: **obvious**

- **G12** Assistant reply has no Retry; Chat shows Code's 'Fork from here' instead (missing/obvious) — Add RetryAction for chat (revert + turn/start with retryInput); onFork null for chat/cowork.
- **G13** User message Edit and inline edit missing; Chat shows Rewind/Fork instead (missing/obvious) — Edit (pencil) with inline editor; chat: edit any finished human turn + human Retry, hide Rewind/Fork; cowork: edit last only, 'Restart session from here'.
- **G14** No 'interrupted' banner after Stop (missing/obvious) — Track interrupted turns in state.js and render a TP port after the last row of the latest one.
- **G15** Thinking hidden in Chat/Cowork unless the Code 'Thinking' transcript view is chosen (divergent/obvious) — In chat/cowork render reasoning as collapsed SourceStep with duration; pass timestamps from session-service; gate Transcript view to Code.
- **M21** Error states copy and recovery actions (divergent/minor) — Chat/cowork copy table in turn-error-model.mjs.

Reference to port:
- cc1aae219 Tj gates (6930-7060), Lt footer retry ga 'action-bar-retry' (27503-27560), xt user actions + nc edit form (29600-29900)
- cc1aae219 TP/EP interrupted banner (9107-9200, 30505-30730); c821a41a9 MS.userCanceled
- c05b96c7f cg thinking cell builder (9157-9310), co/so durations (516-552), lm 'Thought process' (7652-7662)
- cc1aae219 error copy (5224-5577)

Local files:
- `app/src/source-turn-footer.jsx`, `app/src/source-user-actions.jsx`, `app/src/message-actions-model.mjs`, `app/src/main.jsx`, `app/src/source-session.jsx`, `app/src/state.js`, `app/src/turn-error-model.mjs`, `app/electron/cowork-runtime/session-service.mjs`

Verify with:
- `cd app && node --test tests/turn-footer-behavior.test.mjs`
- `cd app && node --test tests/turn-error-model.test.mjs`
- `cd app && node --test tests/state.test.mjs`
- `cd app && node --test tests/reasoning-model.test.mjs`
- `cd app && node --test tests/transcript-view-model.test.mjs`
- `app/scripts/turn-footer-ui-test.mjs`
- `app/scripts/user-actions-ui-test.mjs`
- `app/scripts/turn-errors-ui-test.mjs`

Notes: Chat only gets Retry/Edit/human Retry and loses Rewind/Fork; Cowork keeps a direct 'Restart session from here' (depends on B01) and Edit on the last human message. Code mode unchanged. Thinking: collapsed cells in chat/cowork regardless of transcriptView; carry thinking timestamps from session-service.

### B09 — Cowork workspace status, Cowork global instructions and Settings › Cowork page

Priority: **obvious**

- **G43** No Cowork availability / VM setup states on the new task page (missing/obvious) — cowork-status IPC → cB banner, disabled composer; consume cowork-runtime events.
- **G52** No VM / workspace status or setup UI (missing/obvious, duplicate of G43) — Status card while preparing/booting; failure card with Retry/Copy details.
- **G64** Cowork workspace setup/start banner not wired (missing/obvious, duplicate of G43) — See G43; translate runtime error strings.
- **G63** Global instructions never reach Cowork tasks (missing/obvious) — Cowork-scoped instructions field; per-turn getInstructions callback; fix copy.
- **G65** Cowork settings page absent (missing/obvious) — Settings › Cowork with Cowork files, Trusted folders (persisted), Global instructions.

Reference to port:
- c352a19af VMDownloadBanner L / status card D / setup states I (readable 36-1066)
- c62135ccf ur unsupported wiring (1846-1948); shared-19 cB/oB unsupported banner (14760-14990)
- cabd7b1c1 ft Global instructions, ht Trusted Cowork folders (readable 96-1286)
- c71860c77-Cx6eI2mP Tt Cowork settings page (905-960); cfea69990 L Cowork files

Local files:
- `app/src/main.jsx`, `app/src/source-cowork-home.jsx`, `app/src/source-settings.jsx`, `app/src/source-settings-instructions.jsx`, `app/electron/main.cjs`, `app/electron/preload.cjs`, `app/electron/cowork-runtime/session-service.mjs`, `app/electron/cowork-runtime/reference.mjs`, `app/electron/cowork-runtime/provision.mjs`, `app/electron/routine-runner.mjs`, `app/electron/i18n/zh-CN/surfaces.mjs`

Verify with:
- `cd app && node --test tests/cowork-session-service.test.mjs`
- `cd app && node --test tests/cowork-provision.test.mjs`
- `cd app && node --test tests/cowork-reference.test.mjs`
- `cd app && node --test tests/instructions-service.test.mjs`
- `cd app && node --test tests/settings-pages.test.mjs`
- `app/scripts/surfaces-ui-test.mjs`
- `app/scripts/settings-ui-test.mjs`

Notes: Consume {kind:'cowork-runtime'} events; add a cowork-status IPC for pre-send availability; disable the composer (opacity-40) when unsupported. Cowork global instructions read per turn (not frozen at thread/start). Settings › Cowork: Cowork files (read-only + Reveal), Trusted folders (persist approvals), Global instructions. Skip cloud rows.

### B10 — Chat/Cowork composer: model menu Effort, folder/project picker, Add menu

Priority: **obvious**

- **G07** Model selector menu lacks the Effort section (divergent/obvious) — Add an Effort submenu (radio rows from supportedReasoningEfforts) for chat/cowork; remove the folder-popup Effort row; optionally move search into More models.
- **G08** 'Project or folder' chin picker is a stub (partial/obvious) — Rebuild popup per UN using recentFolderList and localProjects; remove radios and Effort.
- **G44** Folder/project picker is a minimal stand-in (partial/obvious, duplicate of G08) — Same as G08 plus additionalFolders chips, clear selection, 'Work in a project or folder' placeholder.
- **G45** Add › 'Add folder' replaces the Cowork folder and navigates (divergent/obvious) — Per-mode branch: append (and mount) in Cowork, hide in Chat.
- **G09** Plus menu: Web search toggle missing (Chat) (missing/obvious) — Chat-only menuitemcheckbox backed by sessionTools (toolSelection cores) or codexWebSearch; disabled with tooltip otherwise.
- **G68** Chat composer add menu lacks Chat rows and shows Code rows (partial/obvious) — Per-mode add menu (see B10 notes).
- **M07** Plus menu: screenshot, Add to project, grouping and extra rows (partial/minor, duplicate of G68) — Port Ga and Va; drop Slash commands outside Code; separators.
- **M09** Drag-and-drop onto Chat/Cowork composer stages files twice (broken/minor) — Remove form-level drop in chat mode or check defaultPrevented.

Reference to port:
- shared-8 BO/UO model menu (12556-13110); shared-28 Tu Effort submenu (7440-7530)
- shared-8 UN/YN picker (18532-19370); shared-19 qN wrapper (9150-9258)
- c752b32f8 to() add menu (3510-3601): Qa/Ga screenshot/Va Add to project/ga connectors; shared-5 xF 'Web search' (19785-19830)
- shared-8 jx/Ix Cowork 'Add folder' (5540-5808)

Local files:
- `app/src/source-model-menu.jsx`, `app/src/source-chat-composer.jsx`, `app/src/source-composer.jsx`, `app/src/main.jsx`, `app/src/recent-folders-model.mjs`, `app/electron/preload.cjs`, `app/electron/main.cjs`, `app/electron/cowork-runtime/provision.mjs`

Verify with:
- `cd app && node --test tests/model-menu-model.test.mjs`
- `cd app && node --test tests/recent-folders-model.test.mjs`
- `cd app && node --test tests/composer-attachments-model.test.mjs`
- `app/scripts/composer-states-ui-test.mjs`
- `app/scripts/current-home-ui-test.mjs`
- `app/scripts/menus-states-ui-test.mjs`

Notes: Every change branches on mode !== 'code' so the Code composer is untouched (a parallel Code UI sync owns those paths). Effort moves into the model menu; folder popup loses Chat/Cowork radios and Effort. Add menu per mode: drop Slash commands/Tools outside Code, add Web search (Chat only), Take a screenshot, Add to project, separators. Add folder appends (Cowork) instead of replacing+navigating. Fix the double drop staging.

### B11 — Cowork activity panel shell: Context section, persisted collapse, narrow overlay, ⌘⇧S

Priority: **obvious**

- **G53** Activity panel has no Context section (missing/obvious) — Extract Vx and feed context from normalized tool items.
- **G71** Activity panel open/closed state not persisted or global (partial/obvious) — hx semantics with localStorage persistence.
- **M47** Panel default, narrow-window and persistence behavior differ (divergent/minor) — Reference open rule, overlay below 768, persistence.
- **M77** Activity panel has no narrow overlay mode (partial/minor, duplicate of M47) — See M47.
- **M48** No keyboard shortcut to toggle the activity panel (missing/minor) — ⌘⇧S + announcement + dialog row.
- **M75** No ⌘⇧S shortcut, tooltip or announcement for the activity toggle; different icon (partial/minor, duplicate of M48) — See M48; Sidebar icon.
- **M49** Activity toggle has no step/outputs badge (partial/minor) — Labelled toggle variant.
- **M76** Activity toggle and panel also show in Chat mode (divergent/minor) — Gate on mode === 'cowork'.

Reference to port:
- c21f11e6d Vx Context + zx/Bx/Mx empty state (readable 8661-8826)
- shared-6 hx 'agent-sidebar-store' (userCollapsed), kx 768px narrow observer
- c21f11e6d overlay/backdrop (8921-8990, 10080-10140), GD ⌘⇧S (17181-17195)
- shared-16 gc/si/Us toggle (Sidebar icon, badge), hc announcement

Local files:
- `app/src/source-surfaces.jsx`, `app/src/source-surfaces.css`, `app/src/source-titlebar.jsx`, `app/src/main.jsx`, `app/scripts/extract-current-chat-ui.mjs`, `app/src/generated/current-chat/c21f11e6d-CxD82rYo.js`

Verify with:
- `cd app && node --test tests/narrow-layout-session-fixes.test.mjs`
- `cd app && node --test tests/shortcuts-dialog-model.test.mjs`
- `app/scripts/surfaces-ui-test.mjs`
- `app/scripts/titlebar-ui-test.mjs`

Notes: Extract Vx/zx/Bx/Mx (+Qv/Lb/Kb as practical) and feed contextResourceActivity from normalized tool items (depends on B07). Toggle and panel only in Cowork. Store userCollapsed in localStorage under 'agent-sidebar-store'.

### B12 — Artifact viewer: rendered HTML/SVG/PDF, reference header, delete, versions

Priority: **obvious**

- **G19** Local HTML/SVG/PDF artifacts show as source code, not rendered (missing/obvious) — Sandboxed html/svg preview kind; PDF viewer arm; keep Preview/View source toggle.
- **G22** Viewer header does not match CoworkArtifactDetail (divergent/obvious) — Port standalone header branch; remove Back; More actions menu; skip Share/Version (cloud/separate).
- **G23** No Delete action for an artifact (missing/obvious) — removeArtifact tombstone (removedByUser), IPC action, danger menu item + confirm in library and viewer.
- **G29** No version history in the viewer (Version select / Restore) (missing/obvious) — Snapshot copies + versions[] + read-version/restore-version actions; header Select.
- **M25** Missing-file state shows a raw error (divergent/minor) — Warning block; disable actions.
- **M26** No 'Download as PDF' or 'Pop out' in the viewer (missing/minor) — printToPDF; optional BrowserWindow pop-out.
- **M27** No runtime error overlay for rendered artifacts (missing/minor) — Catch webview errors; 'Try fixing with Claude'.

Reference to port:
- cd2efac6e Ql sandbox arm (Html/Svg) and native preview for pdf/docx/pptx/xlsx (c6e1d8764 N)
- c667b4aab j CoworkArtifactDetail header/versions/folder-missing (readable 227-760), Zt More actions (468-490)
- c230724a2 fi delete confirm 'Delete artifact?' (838-878); c2879f9ce u runtime error panel

Local files:
- `app/src/source-artifact-viewer.jsx`, `app/src/source-file-viewer.jsx`, `app/src/file-preview-model.mjs`, `app/src/source-artifact-library.jsx`, `app/electron/artifact-index.mjs`, `app/electron/main.cjs`, `app/electron/preview-service.cjs`

Verify with:
- `cd app && node --test tests/file-preview-model.test.mjs`
- `cd app && node --test tests/artifact-index.test.mjs`
- `cd app && node --test tests/file-viewer.test.mjs`
- `app/scripts/current-library-ui-test.mjs`
- `app/scripts/preview-ui-test.mjs`

Notes: Sandboxed webview/iframe for html/svg (no node, per-artifact partition, external links ask). Delete only tombstones the index row (never the file). Versions need snapshot copies under userData. Share/Pop out optional; Share is cloud.

### B13 — Artifact library: what is indexed, defaults, empty state, New artifact, menus

Priority: **obvious**

- **G24** Library lists every edited file, not just artifacts (divergent/obvious) — Index only deliverables and codeDesktop.artifacts; keep fileChange deletes for tombstones; update tests.
- **G25** Default library layout is grid instead of list (divergent/obvious) — Default list under 'artifacts-gallery-layout' with one-time legacy key read; List view/Grid view labels.
- **G26** Empty library uses fallback line instead of the first-run empty state (missing/obvious) — Pass emptyState using the cbef3b9e7 empty-state component (variant artifacts).
- **G27** 'New artifact' only opens a blank Cowork composer (divergent/obvious) — Start a local Cowork session with an adapted prompt; re-entry guard; busy label; drop icon.
- **G28** List row right-click shows no artifact menu (missing/minor) — Wrap trigger in a context menu with Pin/Unpin plus local items; add Pin/Unpin to the overflow.
- **M23** Overflow menu trigger and items differ (divergent/minor) — DotsVertical 'More options for {label}', Pin/Unpin first.
- **M24** Library error and incomplete states use raw red text (divergent/minor) — errorState Ki; warning Callout Gi.

Reference to port:
- shared-28 oF cowork items + asar CoworkArtifacts getAllArtifacts
- c230724a2 ko layout hook (3139-3167), ga empty state (2170-2200), la/ua/da New artifact (1920-2144), ci/fi/di menus (710-881), Ki/Gi errors (1722-1742)
- app/src/generated/current-chat/cbef3b9e7 empty-state component

Local files:
- `app/electron/artifact-index.mjs`, `app/src/source-artifact-library.jsx`, `app/src/source-artifact-adapters.jsx`, `app/src/main.jsx`, `app/tests/artifact-index.test.mjs`

Verify with:
- `cd app && node --test tests/artifact-index.test.mjs`
- `app/scripts/current-library-ui-test.mjs`

Notes: Stop indexing plain fileChange items (keep deletes for tombstones). Default list under 'artifacts-gallery-layout'. New artifact starts a Cowork session with a local 'build an HTML file and present it' prompt, busy 'Starting…'.

### B14 — Artifact block in transcript and side panel next to the conversation

Priority: **obvious**

- **G20** Transcript has no artifact block (file card diverges) (divergent/obvious) — Restyle deliverable card as the artifact block; whole-card button opens the side viewer.
- **G21** Chat mode has no artifact side panel (missing/obvious) — Right-hand artifact tile hosting ArtifactDetail or an adapter; local-artifacts 'thread' + save-as.
- **M19** Artifact creation card in chat (partial/minor) — jF-style row opening the viewer.

Reference to port:
- c89efce1a Ht/Bt/Vt artifact block (readable 227-423) as used by cc1aae219 X_ file card
- cbaae0d6d fn/vn ArtifactDetail (714-2070); c322f96dd artifact_detail registration
- cc1aae219 jF 'Created artifact' row (10011-10070)

Local files:
- `app/src/source-deliverables.jsx`, `app/src/source-session.jsx`, `app/src/source-artifact-viewer.jsx`, `app/src/main.jsx`, `app/electron/artifact-index.mjs`, `app/electron/main.cjs`

Verify with:
- `cd app && node --test tests/artifact-index.test.mjs`
- `app/scripts/current-chat-ui-test.mjs`
- `app/scripts/current-library-ui-test.mjs`

Notes: Depends on B12 (renderer) and B03 (in-app open). Deliverable card becomes the reference file-card artifact block opening a right-hand artifact tile; add 'thread' listing and save-as download to local-artifacts. Streaming/Version states only if a local antArtifact path ever exists.

### B15 — Projects list: card menu, archive, creation flow

Priority: **obvious**

- **G32** No archive/delete project anywhere (missing/obvious) — 'archive' action (archivedAt), list filter, gn card menu, header menu item.
- **G33** Project cards lack hover menu, pin indicator and folder chip (partial/obvious) — titleEnd, relative time + folder chip footer, gn overlay.
- **G35** New-project flow differs (no chooser, instructions/files, hidden default location, no auto-open) (divergent/obvious) — Chooser, 'Start a new project' and 'Use an existing folder' forms, create with instructions/files, open created project.
- **M31** Edit project dialog diverges from 'Edit details' (divergent/minor) — Rename, limits, dirty check.
- **M34** Search/sort details (labels, persistence, fuzzy, hint, keys) (partial/minor) — Rename labels, persist sort, port keyboard/announce, search cwd.

Reference to port:
- c17beaa76 Zt card (197-296), gn card menu + archive confirm (1153-1300), rn/an/dn/mn/cn/$t creation (296-846), hn memory chip, vn sort/search (1299-1584)
- shared-19 D1/k1 'Edit details' (24247-24340); c444bcdd7 results keyboard; c365fd3fe count announcement; c259d3b84 file drop zone

Local files:
- `app/src/source-projects.jsx`, `app/src/source-project-adapters.jsx`, `app/electron/local-projects.mjs`, `app/electron/main.cjs`, `app/tests/local-projects.test.mjs`

Verify with:
- `cd app && node --test tests/local-projects.test.mjs`
- `app/scripts/surfaces-ui-test.mjs`

Notes: Archive = archivedAt, list filters it, folder untouched. Create accepts instructions and files; default location ~/Documents/Claude/Projects/<name>; open the created project. Folder picker title param on the 'folder' IPC.

### B16 — Project detail: knowledge/context rail and rich session feed

Priority: **obvious**

- **G31** Project detail has no knowledge/context rail (missing/obvious) — Two-column Df wrapper; Instructions, Context (cwd/folders[]), Scheduled (routine.projectId); Memory/knowledge cloud.
- **G36** Project session list lacks Pinned, status, row menus and paging (partial/obvious) — Port gl/fl fed from local sessions and live state.
- **M32** Instructions dialog diverges ('Edit instructions') (divergent/minor) — Open from rail; Ht strings.
- **M35** Back navigation is an in-content button instead of the title-row crumb (divergent/minor) — 'All projects' title-row crumb.
- **M36** Project-page search filter and load/error states absent (missing/minor) — Busy state, Nf error, title filter.

Reference to port:
- c71dee58b Df/Ef layout (7546-7605), gl/fl feed (2615-3460), Vs crumb (1251-1320), Nf error
- c8ad300b7 cn rail sections (2176-2245), Ht 'Edit instructions' (559-655), Scheduled (1670-1910)

Local files:
- `app/src/source-projects.jsx`, `app/src/source-project-adapters.jsx`, `app/electron/local-projects.mjs`, `app/electron/local-routines.mjs`, `app/src/use-local-routines.jsx`

Verify with:
- `cd app && node --test tests/local-projects.test.mjs`
- `cd app && node --test tests/local-routines.test.mjs`
- `app/scripts/surfaces-ui-test.mjs`

Notes: Rail: Instructions, Context (cwd + folders[]), Scheduled (routines with projectId). Memory/knowledge uploads are cloud: render empty or omit. Feed: Pinned, status pills from live state, row menu reuse (B06), Scheduled run grouping, 20-row paging, 'Local task' fallback.

### B17 — Scheduled list: keep-awake banner, templates flow, More ideas, New task, states

Priority: **obvious**

- **G60** Keep-awake banner and 'Keep awake' switch on the list (divergent/obvious) — Gn banner + new keepAwakeEnabled desktop pref holding powerSaveBlocker.
- **G61** Starter template click opens a prefilled form instead of a Claude setup session (divergent/obvious) — Keep form now; port mc.A once a local routine-creation tool exists.
- **G62** 'More ideas' templates below a short task list (missing/obvious) — Render divider + template grid when tasks.length ≤ 5 and no query.
- **M55** 'New task' is a plain button instead of a menu (divergent/minor) — Keep until a local create tool exists, then port.
- **M56** Loading and load-failure states (partial/minor) — Skeleton, banner, Retry.
- **M57** Delete confirmation from the card menu (divergent/minor) — Use the same tr path with danger confirm.

Reference to port:
- ccd3f68fe nl Bi keep-awake banner (6441-6458), mc templates (5032-5197), more ideas (6667-6682), zi new-task menu (6440-6466), tr delete confirm, Se/Gn states
- c6ad19bb9 Oa 'Keep awake' switch

Local files:
- `app/src/source-routines.jsx`, `app/src/use-local-routines.jsx`, `app/electron/desktop-settings.cjs`, `app/electron/main.cjs`

Verify with:
- `cd app && node --test tests/local-routines.test.mjs`
- `app/scripts/current-routines-ui-test.mjs`

Notes: keepAwakeEnabled is a new desktop pref (not the per-session keepAwake). Template click keeps the form until a local create-scheduled-task agent tool exists; 'Create with Claude' likewise.

### B18 — Chat/Cowork shortcuts dialog and key handling; Chat jump-to-latest button

Priority: **obvious**

- **G69** Keyboard shortcuts dialog is Code-only in Chat/Cowork (divergent/obvious) — Pass mode/section; Chat list with only bound chords.
- **G70** Chat jump-to-latest uses the Code chip (divergent/obvious) — Round button port for non-code modes with keyboard focus return.
- **M74** Composer model/thinking chords are no-ops in Chat/Cowork (broken/minor) — Chat-chin branch; bind ⌘⇧. and ⌘⇧E.
- **M78** Code-only chords stay active in Chat/Cowork sessions (divergent/minor) — mode === 'code' guards.
- **M79** ⌘. toggles the sidebar instead of the side panel in Chat (divergent/minor) — toggle-side-panel outside Code.
- **M81** No F6 region cycling or 'Jump to …' commands (missing/minor) — data-region tags + F6 handler + palette actions.

Reference to port:
- c518a31cc ve/ye/Ce shortcuts modal (192-555)
- shared-8 Re model_selector ⌘⇧. / extended_thinking ⌘⇧E (1871-1885, 16224-16241); shared-1 cai_rosy_feather_toggle ⌘.
- ca1d33d05 bn F6 region cycling, Q jump commands
- ca2ef848d PM/NM/U4 + cf854d0e8 c round 'Scroll to bottom' button

Local files:
- `app/src/shortcuts-dialog-model.mjs`, `app/src/source-session-actions.jsx`, `app/src/main.jsx`, `app/src/chin-shortcuts.mjs`, `app/src/source-transcript.jsx`, `app/src/source-transcript.css`

Verify with:
- `cd app && node --test tests/shortcuts-dialog-model.test.mjs`
- `cd app && node --test tests/chin-shortcuts.test.mjs`
- `cd app && node --test tests/pane-shortcuts.test.mjs`
- `cd app && node --test tests/transcript-scroll.test.mjs`
- `app/scripts/transcript-scroll-ui-test.mjs`
- `app/scripts/transcript-fade-ui-test.mjs`

Notes: Mode-gate Code-only chords; dialog lists only chords actually bound on the surface. Keep the Code chip for mode === 'code'.

### B19 — Settings for Chat users: profile, Chat font, notifications, nav group label

Priority: **obvious**

- **G67** General › Profile only partly present (partial/obvious) — Instructions for Claude row (autosave), local work select, optional randomize avatar.
- **G66** Settings navigation group label differs (divergent/minor) — Rename 'Desktop app' to 'This computer'.
- **M64** Chat font missing; transcript rows sit under Code (partial/minor) — Chat font select; appearance rows on Preferences.
- **M82** Missing 'Chat font' appearance setting (missing/minor, duplicate of M64) — See M64.
- **M65** Notifications: completions under Code; no scheduled-task alerts (divergent/minor) — Notifications group with 'Scheduled tasks' toggle.

Reference to port:
- c0db37792 Fn profile (860-1450), $n Appearance + Jn chat font (1808-1893), pr Notifications (1942-2093)
- shared-19 ZC non-unified nav ('This computer')

Local files:
- `app/src/source-settings.jsx`, `app/src/source-profile-setting.jsx`, `app/electron/preferences.mjs`, `app/electron/desktop-settings.cjs`, `app/electron/routine-runner.mjs`

Verify with:
- `cd app && node --test tests/settings-pages.test.mjs`
- `cd app && node --test tests/settings-search.test.mjs`
- `cd app && node --test tests/preferences.test.mjs`
- `app/scripts/settings-ui-test.mjs`
- `app/scripts/settings-complete-ui-test.mjs`

Notes: Do not adopt the unified 4-group nav (Anthropic-employee gated). Avatar upload, cloud instruction load errors are cloud.

### B20 — zh-CN coverage for extracted Chat/Cowork modules and failing i18n test

Priority: **obvious**

- **G72** zh-CN untranslated strings on Cowork home, Scheduled and Artifacts (partial/obvious) — Add zh-CN entries for reachable strings; fix ICU placeholders.

Reference to port:
- Extracted defaultMessages in app/src/generated/current-chat (shared-19, shared-23, ccd3f68fe, c97b955f1, cdbc75b4b, c230724a2, shared-18)

Local files:
- `app/electron/i18n/zh-CN/surfaces.mjs`, `app/electron/i18n/zh-CN/index.mjs`, `app/src/source-chat-adapters.jsx`, `app/src/source-home-adapters.jsx`, `app/src/source-artifact-adapters.jsx`

Verify with:
- `cd app && node --test tests/i18n.test.mjs`
- `app/scripts/current-routines-ui-test.mjs`
- `app/scripts/current-home-ui-test.mjs`
- `app/scripts/current-library-ui-test.mjs`

Notes: Fix surfaces.mjs:28-29 placeholders first (test is red now). Run again after every other batch that adds strings; local-only concern (reference ships no zh-CN).

### B21 — Chat/Cowork home and composer polish

Priority: **minor**

- **M10** Long paste does not become a 'Pasted text' attachment (missing/minor) — Text attachment above a length threshold.
- **M11** Connectors entry states in + menu (partial/minor) — Error row with Try again, empty 'Add connector', auth warning count.
- **M12** Voice/Dictate controls are disabled placeholders (divergent/minor) — Render nothing when unavailable.
- **M13** Model selector trigger states (partial/minor) — Reuse Code trigger loading/fast label.
- **M14** Default greeting copy ('{name} returns!') (divergent/minor) — Always 'You’re here!'.
- **M39** Greeting text uses an invented '{name} returns!' (divergent/minor, duplicate of M14) — See M14.
- **M15** Composer placeholder does not rotate (partial/minor) — Alternate with 'Type / for skills' every 5 s.
- **M40** Composer placeholder does not rotate (divergent/minor, duplicate of M15) — See M15.
- **M41** Cmd+Enter 'start and keep going' not advertised (partial/minor) — Render the ⌘↵ footnote on home.

Reference to port:
- shared-23 yN greeting
- shared-9 ax/sx placeholders
- shared-7 vx Pasted text
- c752b32f8 ga connector states
- shared-8 voice split-button / UO trigger
- c62135ccf or ⌘↵ footnote

Local files:
- `app/src/source-surfaces.jsx`, `app/src/composer-placeholder.mjs`, `app/src/source-composer-editor.jsx`, `app/src/source-chat-composer.jsx`, `app/src/main.jsx`

Verify with:
- `cd app && node --test tests/composer-placeholder.test.mjs`
- `cd app && node --test tests/composer-attachments-model.test.mjs`
- `app/scripts/composer-states-ui-test.mjs`
- `app/scripts/current-home-ui-test.mjs`

Notes: Hide voice controls when unavailable instead of disabled placeholders.

### B22 — Conversation extras: version navigation, feedback dialog, citations

Priority: **minor**

- **M16** Version (branch) navigation missing (missing/minor) — After Edit/Retry exist, record replaced turns and port jj.
- **M17** Feedback thumbs only with messageFeedback; no dialog (partial/minor) — Optional local dialog after thumbs-down (feedback itself is cloud).
- **M18** Inline citations missing (missing/minor) — Carry citations and render chips.

Reference to port:
- cc1aae219 jj version nav (7240-7300), pj/hj + shared-7 wy feedback dialog, citation plumbing (9300-9330, 13205-13209)

Local files:
- `app/src/source-turn-footer.jsx`, `app/src/source-user-actions.jsx`, `app/src/main.jsx`, `app/electron/cowork-runtime/session-service.mjs`

Verify with:
- `cd app && node --test tests/message-feedback-rpc.test.mjs`
- `app/scripts/turn-footer-ui-test.mjs`

Notes: Version nav only after B08 Edit/Retry exist and a branch record is kept.

### B23 — Sidebar search field, palette wording, nav row flags, Customize page

Priority: **minor**

- **M02** Sidebar Search field opens the wrong palette entry and has no ⌘K keycaps (divergent/minor) — Open 'default' entry; add df-search-field-keys.
- **M03** Command palette uses Code wording and entries in Chat/Cowork (divergent/minor) — Mode-aware actions/placeholder; Projects from localProjects; 'Scheduled' label.
- **M04** Nav rows: Projects 'New' badge and Scheduled in Chat (divergent/minor) — Drop static badge; consider hiding Scheduled in Chat.
- **M05** Customize opens the Settings dialog instead of a page (divergent/minor) — Section surface with selected row, or accept as local adapter (shared with Code).

Reference to port:
- shared-21 aK search field (14492-14530)
- shared-1 MA..$A palette copy (10561-10685)
- shared-21 cY gates
- shared-21 fJ.customize

Local files:
- `app/src/source-sidebar.jsx`, `app/src/sidebar-palette-model.mjs`, `app/src/source-sidebar-palette.jsx`, `app/src/main.jsx`

Verify with:
- `cd app && node --test tests/sidebar-palette.test.mjs`
- `app/scripts/sidebar-ui-test.mjs`

Notes: Customize as a page is shared with Code: coordinate with the Code audit before changing.

### B24 — Cowork home/session polish: Review popover, ideas, run sections, archived notice, todo comments

Priority: **minor**

- **M42** Awaiting-task 'Review' popover not available (partial/minor) — Inline approval cards; canShowReviewPopover.
- **M43** Ideas list is a local 3-item shortlist (divergent/minor) — Add daily briefing / Customize Cowork; local skill suggestions.
- **M50** Panel lacks the scheduled-run and Upcoming sections (missing/minor) — Record routine id; port Jb/hx.
- **M51** Archived task notice differs (divergent/minor) — Port bD archived branch.
- **M52** Commenting on a todo step is disabled (partial/minor) — Implement comment attachment adapter.

Reference to port:
- shared-19 jI Review popover (12326-12500)
- shared-23 bI/yI ideas
- c21f11e6d Jb/hx run sections, bD archived notice
- c4038fd41 todo comment attachment

Local files:
- `app/src/source-home-adapters.jsx`, `app/src/source-ideas-adapters.jsx`, `app/src/source-surfaces.jsx`, `app/src/main.jsx`, `app/src/source-chat-adapters.jsx`, `app/electron/routine-runner.mjs`

Verify with:
- `cd app && node --test tests/cowork-home-model.test.mjs`
- `cd app && node --test tests/approval-card-model.test.mjs`
- `app/scripts/current-home-ui-test.mjs`
- `app/scripts/surfaces-ui-test.mjs`

### B25 — Scheduled list details: status chip, sort/search keys, status dot, project attach

Priority: **minor**

- **M58** Card status chip uses the unified text variant (divergent/minor) — Export el; use as statusChip.
- **M59** Sort, search and keyboard details on the list header (partial/minor) — 'Sort by' menu, name+description match, arrow keys, announcement.
- **M60** Card status dot only shows running/failed (partial/minor) — Unread/new_run and needs_attention dots.
- **M63** The form cannot attach a task to a local project (partial/minor) — Expose local projects; store projectId.

Reference to port:
- ccd3f68fe el badge chip, zr sort, oi/Ci keys
- cdbc75b4b ai/ri/Di dot
- c97b955f1 project-or-folder picker

Local files:
- `app/src/source-routines.jsx`, `app/src/source-routine-form-adapters.jsx`, `app/scripts/extract-current-chat-ui.mjs`, `app/electron/local-routines.mjs`

Verify with:
- `cd app && node --test tests/local-routines.test.mjs`
- `app/scripts/current-routines-ui-test.mjs`
- `app/scripts/current-routine-form-ui-test.mjs`

### B26 — Incognito chat (Chat only)

Priority: **minor**

- **G06** Incognito chat (Chat only) (missing/minor) — ⌘⇧I on Chat routes only, frame + header label + Exit button, greeting, composer variant, ephemeral session flag in main.cjs.
- **M70** Incognito chat toggle absent (missing/minor, duplicate of G06) — See G06.

Reference to port:
- shared-21 $E/Mre/lA/oj/Aj (2961-5800)
- shared-23 yN 'You’re incognito'
- shared-5 Rf variant 'incognito'
- shared-1 incognito keybinding

Local files:
- `app/src/main.jsx`, `app/src/source-titlebar.jsx`, `app/src/source-surfaces.jsx`, `app/src/shortcuts-dialog-model.mjs`, `app/electron/main.cjs`, `app/electron/artifact-index.mjs`

Verify with:
- `cd app && node --test tests/state.test.mjs`
- `cd app && node --test tests/surface-policy.test.mjs`
- `cd app && node --test tests/shortcuts-dialog-model.test.mjs`
- `app/scripts/current-chat-ui-test.mjs`

Notes: ⌘⇧I only on Chat routes (Code keeps the model-menu binding). No palette row, no 'Use incognito' header toggle.

## Deferred (cloud, account-only or out of plan)

- M06 Cowork New-row 'Quick task' (⌘;) — gated (miniComposeActive) in the reference; only if a local quick-task composer is added
- M08 Plus menu Research / Memory / Add from GitHub / Teach rows — cloud
- M28 Artifact tabs Yours / Shared with you — cloud (a local Pinned/Projects tab is optional)
- M29 Artifact Share / Publish / Copy link / comments / Duplicate — cloud
- M30 Cowork transcript 'Artifact' publish tool row — cloud Artifact tool
- M37 Chat-mode merged projects page (org / shared / visibility filters) — cloud
- M38 Project memory chip and Memory section — no local memory store (cloud in the reference for Chat)
- M44 Cowork home plugin setup card — cloud recommendations
- M45 Legacy AgentNewPageContent-only elements (guest pass, What's new, shuffle) — flag-gated variant, guest pass is cloud
- M53 Browser / computer-use activity cards — no such tools in the local Cowork VM runtime
- M54 Session feedback survey — cloud telemetry
- M66 Capabilities page — mostly cloud rows (optional local Chat file-creation switch later)
- M67 Chat memory settings — server-generated memory (cloud)
- M71 Desktop Extensions (.mcpb) page — not cloud, but out of plan; Connectors covers MCP
- M72 Account pages: Privacy, Billing, Import & export, Claude in Chrome, Dispatch — cloud
- M73 Customize › Connectors directory ('Browse connectors') — cloud
- Cloud pieces inside planned gaps: Design product target (G01), viewer Share (G22), Outputs 'Download all' (G54), rail Memory and Chat knowledge uploads (G31), profile avatar upload and cloud instruction load errors (G67), personalized greeting slots (M14)
