# Chat / Cowork source integration

The current Chat/Cowork home, composer, activity panel, project/library pages,
and scheduled list/detail/form/calendar use **2.31226.0**,
freshly extracted from `/Applications/Claude.app` into
`reference/installed-2.31226.0-20261012`. This is the installed version; the
2.31226.1 update offered by the official app has not been installed. Source
hashes are recorded in that snapshot's manifest. Some remaining components still use
`reference/current-2.2553.1`; migration is not claimed complete. UI work follows source declarations; captures are runtime checks.

## Installed-version integration (2026-10-12)

`app/scripts/extract-current-chat-ui.mjs` extracts 62 reachable modules to
`app/src/generated/current-chat`, preserving source declarations and recording
source/output hashes and explicit host boundaries in `provenance.json`.

- `shared-23-CuGEZNcW.js` / `shared-19-DmuztgN-.js`: greeting, current static
  Spark, cap-height sizing, optical spacing, responsive seat and home geometry.
- `shared-18-DaJGQi6_.js`: current home content column and activity dot.
- `shared-5-DXmEIvP_.js`: current composer, two-line home editor, action clusters,
  chin and overlay. Reply Add/Dictate controls sit in the chin; reply width is
  768 px and assistant prose uses the current serif typography.
- `c21f11e6d-CxD82rYo.js`, `cc5a62f6f-BgHG1Ree.js`,
  `c4038fd41-DE0MYtnD.js`: activity sections, empty illustrations, todo rail,
  completed-step folding, shimmer, reveal and keyboard collapse behavior.
- Current titlebar geometry follows DQ/LQ: 48 px header, adjacent title menu,
  Browser and Activity toggles. Local sessions omit cloud sharing.

`prepare-current-chat-ui.mjs` verifies generated/source hashes and scopes the
installed `c6a992d55-C0zTICcS.css` utilities to Chat/Cowork and explicitly versioned
form portals (including their nested popovers/menus). Referenced image assets
are copied from the same installed snapshot and hashed. Existing host font
families and Code styling remain separate. Unsupported voice and cloud services
are not made functional by copying their UI.

Validation: `node work/offscreen-app-integration-20260922/run-suite.mjs current-chat`
checks four window widths, Logo/text separation, draft isolation, real fixture
IPC send, reply geometry, title controls, original activity images, and plan
collapse with mouse/keyboard. The fixture does not prove real model inference.

Latest batch: [0.2.185 scheduled form/calendar](current-routine-form-20261013-185.md), including
current native fields, date keyboard handling, responsive dialog, and local permission persistence.
Earlier batches: [0.2.184 scheduled UI](current-routines-20261012-184.md), [0.2.183 home](current-cowork-home-20261012-183.md),
[0.2.182 home placement](chat-cowork-layout-20261012-182.md), and
[0.2.181 project/library](chat-cowork-ui-20261012-181.md).

## Earlier extracted components

## Source modules

| UI | Original module | Local integration |
| --- | --- | --- |
| Home greeting and responsive geometry | `shared-21-D098Wd--.js` (`yb`, `Ab`, `jb`, `Nb`) | `app/src/source-surfaces.jsx` |
| Complete home greeting and static Spark | `shared-24-C4QZCHDk.js` (`tE`), `shared-frame-C_2npUJq.js` (`bd`) | Original component and SVG; host supplies greeting text and locale |
| Home scrolling viewport and content column | `shared-24-C4QZCHDk.js` (`SO` class literals), `shared-21-D098Wd--.js` (`Lx`, `Nb`, `mb`, `Fb`, `Xb`) | `SourceSurfaceHome`, separate from the conversation transcript scroll host |
| Cowork home active/pinned task list | `shared-24-C4QZCHDk.js` (`TD`, `_D`, `vD`, `yD`), `shared-22-Cz3C_T8d.js` (`vO`) | `source-cowork-home.jsx`, local session and approval adapters |
| Empty Cowork home ideas and illustrations | `shared-24-C4QZCHDk.js` (`QD`, original SVG thumbnails), `c2bf50d9e-DFTwgP_Q.js` (`o`) | Original UI and catalog; local shortlist and draft editor adapters |
| Idea hover preview | `shared-11-CDihEvbJ.js` (`lu`), `shared-14-BOJVa-jT.js` (`ZP` preview class) | Original composer overlay; preview state is separate from draft text |
| Home unread/status rules and relative dates | `shared-16-Cg1UfeMy.js` (`Qm`, `$m`), `shared-4-D8W6lHTW.js` (`Ew`), `vendor-intl-Cf4IuK3L.js` (`$t`) | Original predicates and refresh behavior; local Intl formatting |
| Composer, action clusters, footer | `shared-11-CDihEvbJ.js` (`Gu`, `$l`, `cu`) | `app/src/source-chat-composer.jsx` |
| Editor geometry and typography | `shared-8-B5xbG2px.js` (`il`, `Jc`) | Existing ProseMirror editor hosted in the original composer |
| Cowork progress and empty states | `ce5658dc8-CJ_gZ6YY.js` (`yu`, `va`, `bu`) | Local plan events normalized to original todo statuses |
| Cowork section layout and collapse | `cc5a62f6f-ylJcImQa.js` (`A`, `O`) | Local task rail |
| Running text and activity dot | `shared-7-DsClUbcz.js`, `shared-20-BrTrXIRV.js` | Original animation code and image asset |
| Project page and responsive header | `c193cfc9b-B8oGoJPG.js`, `cf35aed38-CgXOe11O.js` | `app/src/source-projects.jsx` |
| Project cards and empty state | `cf8745532-uXq2n8pj.js`, `cbef3b9e7-kx1HRu8z.js` | Local project records |
| Project detail header and session rows | `c71dee58b-CFLphdFa.js` (`wl`), `c75e89812-U9wOm6Ly.js` (`i`, `a`) | Original header/rows with local project services |
| Artifact grid/list, cards, rows, loading and empty states | `cabf52553-BGQcEv7j.js` (`Le`, `ge`, `je`, `Te`) | `app/src/source-artifact-library.jsx` |
| Artifact page frame, glyphs and date groups | `cd75b47e6-6gS9HU0g.js`, `cfcabf2fa--2rO5Hd_.js`, `c042dc97b-DRO8SqaO.js` | Original source with local data adapters |
| Artifact viewer title, actions and frame | `ca324bb72-DogKBzRY.js` (`yt`, `It`), `shared-14-BOJVa-jT.js` (`ev`, `tv`) | `app/src/source-artifact-viewer.jsx` |
| Project illustration | `cbcaf521a-CrWJ5SHy.js` | Original HandBlocks SVG data |
| Text inputs and text areas | `shared-frame-C_2npUJq.js` (`Bh`, `$v`) | Local native forms |
| Fields, labels, hints, validation errors and text fields | `shared-frame-C_2npUJq.js` (`_y`, `vy`, `yy`, `by`, `xy`, `Sy`) | Original composition, classes and warning glyph; native field/accessibility adapter |
| Scheduled cards, summaries and status | `cdbc75b4b-CaOXO81D.js` (`pi`, `oi`, `$r`), `ccd3f68fe-JzfLnZNI.js` (`Zo` grid class) | Persistent local routines |
| Scheduled task menu | `shared-21-D098Wd--.js` (`VV`) | Original run/pause/edit/delete UI, host IPC and menu portal adapters |
| Scheduled detail, history and instructions preview | `ccd3f68fe-JzfLnZNI.js` (`ga`, `va`), `c32f7beb9-C22xyv_3.js` (`o`) | Original page composition; local run records, navigation and dialog primitives |
| Scheduled create/edit form and schedule presets | `c97b955f1-6SCO-W37.js` (`xr`, `Sr`, `Rn`), `shared-19-CjdiaR4X.js` (`dm`) | Full original form with local model, permission, folder and persistence services |
| CDS class conflict resolution | `shared-frame-C_2npUJq.js` (`X`, `Pt`), `vendor-frame-BmPfNbgY.js` (`Wt`, `Lt`) | Original Tailwind merge rules, including CDS typography/density tokens |
| Segmented date input and calendar | `cff2bf6cb-rlnyJMOd.js` (`Zr`, `ri`), `c8ff922bb-BPSJpmre.js` (`Ka`, `Ma`, date/keyboard helpers) | Original monthly schedule date control; host locale, button and popover boundaries |
| Human-readable schedule and ICU messages | `c511d59b8-Cjklq41c.js`, `cc09daa9b-cPVYGM-x.js`, `vendor-intl-Cf4IuK3L.js` (`kt`) | Original schedule formatters and ICU engine; local translations |

`app/scripts/extract-chat-ui.mjs` walks the original module bindings and writes reachable
source declarations to `app/src/generated/chat`. Asset root URLs become relative URLs
for Electron file loading. `provenance.json` records source hashes, generated hashes,
selected declarations, and import boundaries. `prepare-ui.mjs` checks those hashes and
copies original CSS, fonts, icons, animation images, and empty-state illustrations.
Generated modules should be regenerated, not edited by hand.
The two calendar modules also retain their audited module-level initialization
statements in source order. These populate locale dictionaries and initialize
focus/transition helpers. Their byte ranges are recorded as `initializers` in
the provenance manifest; copying declarations alone would lose this behavior.
Inline homepage class literals are extracted from their AST nodes; their byte ranges
are recorded in the manifest, alongside whole-declaration provenance.

## Host boundaries

`source-chat-adapters.jsx` connects React, existing desktop buttons/tooltips/menus,
local translations, field labels, attachment containers and scoped state.
`source-project-adapters.jsx` binds the original header to local mutations and menus;
cloud sharing and membership providers are not mounted. Project
routing uses the host rather than the official router. Account services and analytics
are not imported. Task annotation controls that require the original attachment service
are disabled by the caller.

`electron/local-projects.mjs` stores project records in local preferences. New projects
use an app-owned directory or a folder explicitly selected in the native chooser.
Opening a project selects its Cowork directory and shows the detail composer and project sessions.
Project names, descriptions, pins and instructions are editable. Drafts have separate project
keys, and new task metadata records an explicit project ID even when folders are shared.
The host validates project/folder identity and applies saved instructions on start/resume;
project IDs are stripped before calling a core.
This does not change Code's folder. Chat and Cowork share their non-Code history, while
old sessions without surface metadata remain Code sessions.

`electron/artifact-index.mjs` records completed Chat/Cowork file outputs, presented
files, and provider file artifacts. It backfills legacy and paginated histories on the
first library visit in an app run, excludes Code, and reports incomplete history reads.
Deletion tombstones prevent an older history read from resurrecting a deleted file.
Pins persist in preferences. Cards open an in-app preview; an explicit toolbar action
opens the default OS application. Preview reads resolve the artifact key to its registered
session directory and use the existing scoped reader, including symlink checks. Markdown,
CSV/TSV, images, media and highlighted source reuse the document/file renderers.
The source artifact header replaces the generic titlebar, preserving collapsed-sidebar
navigation and split-window controls. Returning restores library search, layout and focus.
`source-artifact-adapters.jsx` supplies localization, local dates, glyph metadata and
host menus. Grid/list cards, skeletons, date grouping and page structure are extracted.

The earlier home greeting rendered the original `tE` component rather than reconstructing
its markup. Its Spark boundary uses the original `bd`, the idle branch used by `dv`
when no animation state is supplied. `size="100%"` follows the cap-height wrapper;
the original CSS applies the 1.4 scale and 0.45em spacing. Locale and pending-language
context are supplied by the host. The original centering, wrapping and greeting-change
animation remain in the extracted component.
The earlier original `Lx` content column owned homepage headroom, width and the 1.5rem
gap between greeting and composer. Its outer viewport owns scrolling and stable
scrollbar gutters. The host no longer substitutes fixed horizontal padding and
a handwritten greeting bottom margin. Conversation, project and Code layouts keep
their separate containers. The current source's Chat home does not render the older
fixed Write/Learn/Brainstorm/Analyze chips. Cowork's active-task section now uses
the original filtering, stable ordering, five-row fold, pinned/running/awaiting
headings and clear-active behavior. `cowork-home-model.mjs` adapts persisted local
read/pin metadata, live turns and parent-owned approvals. Rows open their real
sessions; review uses the existing in-session approval controls. Clear active
marks activity read without deleting sessions or unpinning them. The inline cloud
approval popup and scheduled rows are not connected. Dates use
the source relative-time component; icon and locale services use host adapters.

Empty Cowork home renders the original `QD` ideas list with its SVG illustrations,
300ms hover preview, immediate keyboard-focus preview and click/Enter selection.
The host shortlist selects three unchanged entries from the original ideas catalog
(file themes, organized notes and webpage-to-spreadsheet), rather than claiming a
cloud experiment assignment or offering an uninstalled setup skill. Chinese labels
and prompts use the local dictionary. Selecting an idea updates and focuses the
draft without submitting; preview uses the original `lu` overlay, hides only the
editor visually, and never writes to the draft. Leaving the row or interacting
with the editor clears the preview. Account/plugin-specific suggestions and
rotation are not connected.

## Checks

```sh
node app/scripts/extract-chat-ui.mjs
npm --prefix app run build
node --test app/tests/artifact-index.test.mjs app/tests/agent-tools-claude-tools-render.test.mjs
node --test app/tests/local-projects.test.mjs app/tests/surface-policy.test.mjs app/tests/permission-policy.test.mjs
node --test app/tests/cowork-home-model.test.mjs
node --test app/tests/source-field-render.test.mjs
node --test app/tests/source-calendar-render.test.mjs
node app/scripts/surfaces-ui-test.mjs
```

The Electron check uses a separate temporary profile and local fixture backend. It covers
surface drafts, Chat read-only requests, Cowork tasks and stopping, original progress
collapse with mouse/keyboard, image loading, reply geometry, project creation/search,
restart persistence, project pins, independent drafts, instructions reaching the core,
project task folder/metadata, and reopening project sessions. Artifact checks create real
fixture files, exercise search, pins, view switching and restart persistence, verify the
scoped file-open request, and return to the source conversation. The OS file-open call
is stubbed after path validation so the test does not launch an external application.
Viewer checks cover Markdown, CSV, an actual image, source switching, content reload,
missing-file errors, sidebar navigation, and focus/search restoration.
Greeting checks measure the actual SVG bounds in Chat and Cowork at four window widths,
verifying the source scale, percentage sizing and absence of text overlap/overflow.
They also verify the home scroll host and original greeting-to-composer spacing.
Cowork overview checks cover a real running task, unread order, five-row expansion,
persisted clear-active metadata, retained pins/history, and opening a task. Pure
model tests cover surface/archive/child filtering and nested approval ownership.
Idea checks exercise original illustration rendering, hover with an empty or
existing draft, keyboard selection, focus restoration and absence of automatic sends.
Scheduled checks exercise keyboard menu access, creation, pause, manual and timer
dispatch through real Electron IPC, Cowork permissions, history navigation, restart
persistence, edits, original instructions preview/focus restoration and deletion without deleting sessions. Unit checks cover missed
occurrences, overlapping launches, one-shot failures, edits/deletion during launch,
disconnection, and refusal to substitute a saved core/model.
Form checks cover required descriptions, custom-cron validation, weekly time/day
presets, permission changes, and the original unsaved-change confirmation (which
initially focuses Keep editing). Model/permission validation, description persistence
and edits to expired one-shot schedules are covered through the local service.
Background SSR checks cover original field markup, simultaneous hints/errors,
invalid/disabled state, label/control associations, nested field isolation and
unbound inputs. These do not open Electron or any browser window.
Calendar SSR checks cover segmented date input, the month grid, selected and
unavailable dates, navigation limits, English/Chinese labels and original locale
initializers. Date-helper checks cover invalid dates, leap years and rollover.
On 2026-10-12 the user permitted desktop interaction again. The signed release
was launched with a separate fixture profile and checked through native UI:
monthly date selection, disabled past dates, Escape dismissal, restoration of
focus to Calendar, and saving the chosen day into the actual scheduler all passed.
The displayed monthly recurrence matched the persisted `0 9 15 * *` expression.
The current 1200×800 home also displays the source Spark without greeting overlap.
The earlier four-width measurements have not been rerun for this package.

The same release was checked for the original home's three-row schedule limit,
Show more/Show less, opening a task, and returning through All scheduled tasks.
The six original starter cards render their titles, schedule hints and previews;
Weekly review prefilled Friday at 16:00, saved through Electron IPC, and then
appeared on the Cowork home with its next run. The 25 focused model/SSR/scheduler
tests passed; source provenance, build and ad-hoc signing also passed.
Evidence is in `analysis/chat-cowork/ui-sync-*` (local, ignored test data).
The older all-surfaces fixture script predates the VM routing change and was not
rerun; these checks do not establish real VM/model execution.

Release startup exposed an omitted main-process dependency: the package excluded
`deliverable-records.mjs`, its `agent-tool-titles.mjs` dependency and the lazy
`thread-history-model.mjs` import. All three now ship alongside the existing
main-process shared models; the rebuilt `.app` was launched successfully.

## Remaining integration

Scheduled now has local persistence, creation, edits, pause/enable, deletion, search,
sorting, manual runs and one-time/recurring timers. `electron/local-routines.mjs`
reserves a run and advances its deadline before dispatch, avoids overlapping runs,
retains up to 100 run records and skips missed occurrences on restart. In-flight
records on restart/disconnect are marked unconfirmed/interrupted, not successful.
`routine-runner.mjs` uses the same validated RPC pipeline as the composer, with the
saved core/model, permission and network choices. Each run gets a new Cowork session;
the actual turn-completed event settles its history. Removing a schedule keeps its
sessions/files. Execution requires the app running and the computer awake. This is
separate from the existing session-only CronCreate/List/Delete tools.
The original `TD` Cowork home now consumes the same local schedule store through
`useLocalRoutines`, including change notifications and protection against stale
list replies. Its own sorting, paused icons, next-run copy and three-row folding
are unchanged. Recurring schedules route to the original detail; one-shot tasks
remain excluded from this home section, as in the original source.
The empty Scheduled page uses the extracted `fo` starter cards, `co` catalog,
`so` copy, illustrations and `uo` grid class. Choosing a card pre-fills the local
form and does not send a model request or create a task until Save. Templates
that need email/calendar show an explicit missing-connection notice. Their cloud
setup conversation and connectors are not implemented.
The Scheduled cards, status formatter, action menu and complete `ga` detail/history
composition are original source. The detail's instructions preview retains the
original trigger and content, with the host dialog supplying its portal and focus
trap. Saved runs map to the original session rows, including trigger origin and
this-computer labels. Enable/edit/delete/run callbacks use the local scheduler.
The delete description explicitly states that local deletion keeps conversations
and files, rather than promising the original service's archive behavior.
Account/device lookups and cloud-only branches are disabled; host primitives supply
switches, tooltips, optional disclosures and confirmation dialogs.
The full `xr` create/edit component now replaces the handwritten editor. Its classic
local form owns field order, required-description validation, schedule presets,
custom-cron feedback, model selection, folder chips and dirty-state handling.
Local adapters bind the available core's actual models and permission modes;
updates preserve saved core/network settings and refuse cross-core substitution.
The original class merge helper prevents `contents` field wrappers from retaining
conflicting flex layout. Select controls support the form's ghost/compact variants.
Fields now use the original `_y`/`Sy` composition, including separate hints and
warning-icon errors. The native provider binds labels, descriptions and controls
on the initial render and passes validation/disabled state into the original
input context. It supplies controlled application validation, not Base UI's
automatic validation engine. Select defaults live in the components CSS layer
so the original form's utility widths can override them.
The monthly schedule now uses the full original segmented date input and month
calendar, including commit-on-blur handling, date availability, calendar navigation
and React Aria keyboard helpers. The host popover receives the original close
event, computed alignment offset and modal layer; `initialFocus=false` leaves
initial calendar focus to the source component. Host adapters bind the app locale
and calendar buttons. Selector, folder chooser and dialog primitives still use
host implementations. Alternate form experiments, drafting with Claude, cloud/device
migration, project binding and unified Code routine integration remain unfinished.

This is not yet a complete desktop replica. Project detail now uses the original header
and session rows, but its knowledge, membership and full activity menus are not connected.
The local detail composition and navigation still need the complete original frame integration. The create-project form uses original controls in the host dialog,
but does not yet include every original creation option. The artifact library is connected
to local file outputs and document previews. Interactive HTML/React, PDF/Office rendering,
in-app artifact editing, sharing/publishing and creation templates still need integration. Design still needs its page integration. Voice and incognito services are not connected.
The original activity panel's complete output/context/browsing sections and responsive
panel placement are not yet fully integrated.

## Installed 2.31226.0 follow-up — 0.2.181

Projects and Artifacts now use current extracted declarations. The current graph
has 29 modules, with source and output hashes recorded in
`app/src/generated/current-chat/provenance.json`.

- `c193cfc9b-2wgBbI8O`: Page; `cf35aed38-kaP0vyce`: PageHeader/search.
- `cf8745532-BMxkFAAg`: project card; `cbef3b9e7-CuJuDnSt`: empty state.
- `c71dee58b-X8_F3dre` / `c75e89812-Cz6W_Gc9`: project header and session rows.
- `c230724a2-BxatGObJ`: artifact library, grid/list, cards, metadata and glyphs.
- `c2bb74286-D8NXeKVk`, `c028ce168-BgWF3hW2`, `shared-9-CAAkBVM3`: artifact title/actions and frame.
- `shared-frame-DVFSKIcx` `yy`: current TextInput used by page search and project names.

Host adapters supply local data/navigation/menus and native field semantics.
The local artifact thumbnail boundary uses the current original fallback glyph;
cloud thumbnails and sharing are not enabled. Form dialogs, some controls and
Cowork task/idea/schedule components still use older source or host primitives.
Validation and remaining scope are recorded in [0.2.181](chat-cowork-ui-20261012-181.md).
