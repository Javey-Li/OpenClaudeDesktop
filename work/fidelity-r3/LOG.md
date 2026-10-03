# Round 3 log

## R02

Home and account: tab colour, menu width, identity, no-key onboarding, changelog/Learn more, usage table, Action Center meta.

### Changes
- Pre-live tab colour (code-home.js:13844-13847 Kw; design-system.css:814-820): `source-home.css` `.sh-tab:disabled { cursor: default; color: var(--cds-text-muted); }`, still above `.sh-tab.is-selected` (equal specificity, the selected rule wins). It beats style.css `button:disabled` (text-disabled).
- Account menu width (sidebar-groups.js:5250-5253 pw `w-[17rem]`; shared-21 :15918-15924, :15995-16000): `source-menu.css` `.smenu-popup.account-menu { width: 17rem; }`. The Learn more child popup gets `.smenu-popup.account-learn-more { min-width: 208px; }` (sidebar-rows.js:16362). Both rules sit before `.smenu-popup.smenu-sheet`, so the coarse sheet keeps full width.
- Identity (sidebar-rows.js:8597-8613 IO):
  - `account-label-model.mjs` gains `accountIdentity(displayName, accountRead)`. With a name it returns {identity: name, orgPrimary 'DeepSeek API', orgSecondary 'API key' | null}. Without one it returns {identity 'DeepSeek API', orgPrimary 'API key' | null}.
  - It also gains `connectionMenuHeader(engine, connected)`, which gives 'DeepSeek Harness connected/disconnected' for 'deepseek' and 'Codex …' otherwise.
  - `main.jsx`: `accountLines = accountIdentity(displayName, boot?.account)` and `accountLabel = orgPrimary ?? ""`. The tV header shows the identity line, then the org line only when orgPrimary exists. The sidebar gets `displayName={accountLines.identity}`. Both 'Local user' literals are gone.
  - The connection menu header now comes from `connectionMenuHeader(engine, !!boot?.connected)`.
  - `source-sidebar.jsx` footer: the whole identity (no first-word split), with the name span `… max-w-full shrink-0 truncate`. Probe: flex baseline alignment is unchanged with overflow hidden.
- Account menu order (sidebar-rows.js:16155-16432):
  - Header, Settings, Usage.
  - Dark/Light appearance, the retained local item, in the Language slot.
  - 'DeepSeek API key' (icon Key, `data-testid user-menu-deepseek-key`), only on the DeepSeek core (`boot.account.deepseek`), in the Inference configuration slot (:16222-16241). It opens Settings › Preferences, the tab that holds the DeepSeek account group.
  - Separator, then 'View changelog' (icon Scroll, :16345-16354), which calls `setWhatsNew(true)`.
  - 'Learn more' submenu (icon Info, :16356-16432) holding only 'Keyboard shortcuts' with ⌘/ (SHORTCUTS_DIALOG_KEYS, no icon, :16424-16431). Keyboard shortcuts is no longer a top-level item.
- No-key onboarding (code-home.js:13752-13754 Lw; Jw :13895-13924):
  - The DeepSeek key card is `sh-card is-outline connection-card` (data-testid kept). It has `.connection-card-title` (13/19, text-primary) and `.connection-card-body` (text-secondary), then end-aligned `SourceSettingsButton size="sm"`: Refresh (secondary), then Get an API key (primary). The button names are unchanged.
  - The Codex ChatGPT card uses the same markup, retitled 'Sign in to Codex', with 'Sign in' as a primary sm button.
  - In `style.css`, the legacy `.connection-card` paint (0.5px border, 15px padding, 12/18, raw buttons) is replaced by the token-only copy/actions rules. R03's .modal-backdrop deletion landed next to it, intact.
  - Composer: with `boot.connected && boot.account.deepseek && !boot.account.account`, `warning` is 'Add a DeepSeek API key to start a session.' and `onReconnect` calls `account-auth {operation:'refresh'}`. Otherwise the lost-connection warning and `reconnect` behave as before.
  - `send()`: the first line is `if (boot?.account?.deepseek && !boot.account.account) return;`. It keeps the draft and sends no thread/start or turn/start.
- Usage page:
  - `electron/usage-model.mjs` `usagePresentation(data, {todayKey})`: daily buckets are sorted newest first and capped at `USAGE_DAILY_DAYS` 30. With todayKey, only the calendar days ending today are kept (the home 30d Pw/rangeCutoff convention). It also returns `dailyLabel` 'Last 30 days' (catalog Rfvi9/BMNS) and `lifetimeTokens` (finite, ≥ 0, else null). tray-menu is unaffected.
  - `source-usage.jsx`:
    - The section (aria-label 'Daily token usage') has the h3 'Last 30 days'.
    - Dates use `formatDayKey` (Intl month-short/day UTC). Non-date keys stay as data.
    - Counts use `Intl.NumberFormat`.
    - A tfoot row 'All time' shows the lifetime total.
    - A muted `span.su-updated` reads 'Last updated: <SourceTimestamp>' beside Refresh ('just now' under 60s; IZL4XAsgrO / ncXJ+kb4mp). While a refresh is in flight it shows 'Refreshing usage…' instead.
    - Copy changed to 'Loading usage limits' (BnVdI6UIEm), also in `source-session-actions.jsx`.
  - `source-usage.css`: `.su-footer>.su-updated` muted, and no bottom border on the tfoot.
  - Line 7 (the usageErrorText regex) is untouched.
- Action Center meta (cc43287c9 :5416-5417, :5473):
  - `main.jsx`: `repoFolderKey` no longer depends on groupBy, so repo-identities is fetched for cwd plus every session cwd (deduped, and skipped once known). `<SourceActionCenter repoIdentities={repoIdentities}>`.
  - `source-action-center.jsx` exports `repoMeta(identity)`: `owner/name`, else the repo name, else undefined. The basename fallback is removed; `.hac-meta` truncation is unchanged.

### Tests
- `node --test tests/account-label-model.test.mjs tests/home-account-usage.test.mjs tests/account-settings-model.test.mjs tests/usage-model.test.mjs tests/source-sidebar-states.test.mjs tests/render-tdz.test.mjs`: 46/46 pass.
- New or updated unit tests:
  - account-label-model: identity cases for name, no name, apiKey and null account; connection header for both engines and both states; main.jsx and sidebar source guards; menu order, the 17rem CSS and no Learn more URLs.
  - home-account-usage: the `.sh-tab:disabled` guard; the Lw key card, composer warning and send-guard source checks; repoMeta and a rendered Action Center meta check.
  - account-settings-model: the Codex card title; the no-key wiring.
  - usage-model: newest first, the 30-day window and cap, harness `accountTokenUsage` fed through, lifetime, page source checks.
  - source-sidebar-states: the footer shows the whole name, with truncate.
- UI scripts updated, not run per the parallel protocol:
  - home-page: before hoverCard, the pre-live Models/30d/7d paint the resolved --cds-text-muted. The Action Center row has no `.hac-meta` for the non-repo fixture folder.
  - home-account-usage: the hold card's pre-live tabs are muted. The no-key step checks the Lw outline geometry, the [data-cds=Button] variants and sizes, and the composer warning. Typing then Enter keeps the draft and sends no thread/start or turn/start. The warning leaves after Refresh.
  - menus-states §9: width 272 and left 8. Items are [Settings, Usage, Dark appearance, View changelog, Learn more], with 1 submenu. Learn more (opened by ArrowRight) holds [Keyboard shortcuts] with ⌘/ caps and is at least 208px wide; ArrowLeft closes only the child. View changelog opens dialog 'What’s new'.
  - usage: fixture day keys relative to today, given oldest first, plus one 45 days back. Asserts heading 'Last 30 days', newest-first formatted rows without the 45-day bucket, the 'All time' total, and the muted 'Last updated: just now' with its `time`.
  - `work/deepseek-live-20261001/live.mjs` ACCOUNT block: waits for `user-menu-header` (the org line can be absent), and records the menu items, the composer warning, the card titles and the Connection settings header.

### Deviations
- Learn more has no DeepSeek links. The only DeepSeek URLs in app/src or harness are platform.deepseek.com/api_keys, /usage and /top_up, so About DeepSeek, Privacy policy and Terms of use were omitted, along with the separator before Keyboard shortcuts.
- 'Last 30 days' is also a calendar window (todayKey) on top of the 30-row cap. The harness lists only active days, so a cap alone would show older days under that label.
- Appearance sits in the Language slot, before the DeepSeek key row in the Inference configuration slot.
- On the key card, the secondary Refresh comes before the primary Get an API key, end-aligned. This keeps the old button order.
- Files outside the list, with small targeted edits: src/source-usage.css (2 rules), tests/source-sidebar-states.test.mjs (footer name), work/deepseek-live-20261001/live.mjs (ACCOUNT reads).

### Remaining gaps
- Not run (protocol): `npm run build`, the suites (menus-states, home-page, home-account-usage, usage, sidebar-chrome, account-lifecycle, sidebar, composer-states) and the r02 live check.
- titlebar-ui-test: the "after the nudge is seen, View changelog reopens What’s new and the nudge stays hidden" check was not added. R03 owns the dialog and titlebar.
- The no-key composer row keeps the generic 'Retry' button label. In-app key entry is still out of scope (the harness answers account/login/start with -32601).
- Action Center `owner/name` meta is unit-tested only; the suite fixture workspace is not a git repo.

## R04
Customize and connectors: skill invocation semantics, local config, toasts and confirm dialog, plugin drill.

### Changes
- Skill invocation (ccb4abbdf-CZf4_5Cg export r, cfaabd194 `Ce && Switch`, customize-skills :3130-3131, customize-skill-detail :118):
  - `harness/packages/codex-app-server/src/catalog.js` skillsListEntry adds `userInvocable` / `modelInvocable` (the whole Harness invocation policy) and `version` when SKILL.md `metadata.version` is present. `enabled` stays model invocation for Codex compatibility. Documented in harness/README.md (skills/list row).
  - `customize-model.mjs`:
    - skillRows keeps `userInvocable` / `modelInvocable` (undefined = Codex core) and `version`.
    - New `skillInvocable(row)` = `row.modelInvocable === undefined ? row.enabled : row.userInvocable !== false`. skillMenuItems (Add › Skills, plugin submenus) uses it.
    - New `skillTrigger(row, copy)`: 'Auto' / 'Slash command + auto' / 'Slash command' (model-hidden); null without the policy.
    - customizeCore: `skillToggleReason` removed (no read-only switch any more); adds `skillTriggerTooltips`, `pluginTabDescriptions` and `connectorRemoveNote` (Claude → DeepSeek).
    - `CONNECTOR_TOASTS` holds the source toast copy.
    - MCP_STATUS_LABELS.signIn is 'Sign-in required' (q87c5Fstfm). The unused `SKILL_FRONTMATTER_KEY` is removed.
  - `main.jsx`: the commandSkills filter ('/') uses skillInvocable (plus the import on line 82).
  - `source-customize.jsx`, when copy.skillToggle is false:
    - no 'Disabled' row badge and no 'Enable skill' switch;
    - 'Try in chat' is enabled for any user-invocable skill;
    - the facts row follows ccb4abbdf: Added by / Version / Last updated / Trigger. Trigger is a SourceTooltip on a tabIndex=0 span with `cursor-help underline decoration-dotted decoration-alpha-2 underline-offset-4`.
    - The Codex path (no policy) keeps its switch, badge and 'Enable skill to try in chat'.
- Connector local config (c08e79e85 En `mt-4`, c2e7fd468 export t):
  - `source-settings.jsx` passes `mcpDefinitions={desktop?.mcpDefinitions}` through SourceCustomize → ConnectorsPage → ConnectorDetail.
  - The connected drill renders LocalConfig between the description and the tools, in `mt-4 > space-y-4`. Each section is a default-open SourceDisclosure titled `font-small-bold text-secondary`, with a `pt-1` panel and the c2e7fd468 code classes:
    - Command (a URL row for url servers);
    - Arguments when there are any;
    - Environment variables as `<span class=text-secondary>NAME</span>=••••••••`.
  - Nothing renders without a matching definition, and env values are never read.
- Connector feedback:
  - New exported `connectorActions({call, store, toasts, …})` drives every action through `useSourceToasts()?.add`. Raw reasons go to console.warn.
    - Reconnect, Reconnect all, card Retry, not-connected Reconnect/Connect, and Sign in: on failure a danger toast, 'Connection to server failed. You can try again.' (customize-connectors :2565-2590).
    - The connected drill's Reconnect: on success 'Tools list refreshed', on failure 'Couldn’t refresh tools list. You can try again.' (c08e79e85 Sn).
    - Remove: on failure 'Failed to remove server' (c5fb58ef0).
  - The added and finish-signing-in notices are gone. Add errors stay in the form's role=alert.
  - ⋮ › Remove connector opens SourceConfirmationDialog:
    - title 'Remove {title}?';
    - body: the c5fb58ef0 personal copy, with DeepSeek in place of Claude;
    - danger 'Remove', initial focus on Remove;
    - `layer {base:520, z:560}`, above the z-500 Settings backdrop.
  - `source-dialog.jsx` adds an optional `layer` prop to SourceDialog/SourceConfirmationDialog (default MODAL_LAYER).
  - `.cz-info`, `.cz-drill-notices` and `.cz-confirm` are deleted from source-customize.css. R08's cursor line was left alone.
- Plugin drill (c36b3644c _e/pe/fe, c26958849 row, c26e90ba3 qt):
  - `plugin-detail-model.mjs` takes `{descriptions, mcpRows}`, with tab copy from customizeCore. Connector items carry the catalog title, the MCP_STATUS_LABELS status, `connected` and `connectorName`.
  - PluginDetail renders connector rows: ConnectorTile 24 in a size-6 slot (opacity-50 unless connected), the title, a muted status line, and a text-muted row when not connected. A click calls `onNavigate('customize-connectors', {connectorName})`.
  - Also from the original:
    - pe's two h-control skeleton bars while the catalog loads;
    - 'This plugin has no required connectors.' for an empty list (exported PluginConnectors);
    - 'Last updated' with a muted '—' for non-local plugins.
  - PluginsPage loads the mcp catalog only when the plugin declares servers.
- `source-disclosure.jsx` (outside the list, small additive edit): an optional `defaultOpen` prop that mounts open at natural height without an entrance transition. The default is unchanged.

### Tests
- `cd harness && node --test tests/catalog.test.mjs`: 7/7 pass. 'quiet' reports userInvocable true / modelInvocable false, the model-only 'auto' reports userInvocable false, and metadata.version is included.
- `cd app && node --test tests/customize-model.test.mjs tests/customize-states.test.mjs tests/plugin-detail.test.mjs`: 43/43 pass.
  - customize-model: skillInvocable and skillMenuItems on both cores, skillTrigger, the new customizeCore copy, CONNECTOR_TOASTS.
  - customize-states:
    - DeepSeek model-hidden skill: no badge or switch, Try in chat enabled, facts order, Trigger 'Slash command'; 'Auto' and 'Slash command + auto' are also covered.
    - Codex is unchanged.
    - LocalConfig: sections, the code classes, TOKEN=••••••••, no value, the URL row, nothing without a match.
    - No cz-info, cz-error or inline confirm. An injected toast store gets one danger toast on a rejected reconnect, and the other outcomes are covered.
    - Plugin rows, pe empty, Last updated —.
  - plugin-detail: DeepSeek tab copy and connector resolution.
- Also run: tests/catalog-wiring.test.mjs, response-markdown-render.test.mjs and render-tdz.test.mjs pass.
  - catalog-wiring and response-markdown-render asserted the old behaviour, so their lines were updated. The composer now lists user-invocable skills. The plugin drill's 'Last updated —' and its connector row are intentional.
- Failures caused by other batches' in-progress main.jsx and sidebar work: composer-env-pickers 'legacy code-ui Popover…' (Codex header text) and source-sidebar-states 'account footer'.
- UI scripts updated, not run per the protocol:
  - skills-mcp:
    - 'Sign-in required';
    - Sign in waits for the oauth login and checks for no inline notice;
    - the connected drill's LocalConfig Command equals the fixture `npx`, with Arguments, FX_TOKEN=•••••••• and no secret, mt-4, between description and tools;
    - the drill Reconnect gives a 'Tools list refreshed' toast;
    - Remove opens the 'Remove fx-new?' ConfirmationDialog above `.ss-settings-backdrop`, focus on Remove; confirming removes the row and shows the toast instead of a page line;
    - Fx Plugin tab copy has no 'Claude';
    - the Connectors-tab row ('Fixture Connected' · 'Connected', 24px tile) opens data-cz-detail=connector;
    - Fx Off shows 'Last updated —'.
  - slash-commands-complete seeds fx-slash-only / fx-model-only / fx-both. '/fx-' lists ['fx-both','fx-slash-only'].
  - Fixture `codex-server.cjs`: the config/read knob `fixture-customize.json mcpConfig` answers mcp_servers tables when no settings seed exists. skills/list passes the seeded flags through unchanged.

### Deviations
- The connected drill's secondary Reconnect (the local stand-in for Sn's refresh) uses the refresh toasts. Every other reconnect uses the connection-failed copy and is silent on success.
- Remove success shows a neutral toast, 'Removed {name} from {config file}.'. The original says nothing; the batch's skills-mcp check asks for a toast in place of the inline line.
- 'Slash command' trigger tooltip: 'Appears in the / menu.' (the first sentence of eFWPHBACre). A DeepSeek model-only skill's disabled Try in chat has no disabledReason, because no source copy fits.
- LocalConfig Arguments are joined with spaces, as Developer does. The source quotes them with a shell-quote helper that was not ported.
- Plugin connector rows have no per-row Connect action (fe `action`).
- Files outside the list (small targeted edits): src/source-disclosure.jsx (defaultOpen), tests/catalog-wiring.test.mjs, tests/response-markdown-render.test.mjs.

### Remaining gaps
- Not run (protocol): `npm run build` and the suites skills-mcp, slash-commands-complete, settings-complete and settings.
- The Native binary badge, per-platform overrides and user config defaults in c2e7fd468 have no local data. The not-running local-config page (`localConfig && !connector`) is not drawn.
- Developer › Local MCP servers still reads 'Sign in required' (settings-model.mjs mcpStatus, not in this batch).

## R03 — Dialog layers, What's new on SourceDialog, action-error toasts, catalog copy

Changes
- Settings tooltip layer: `.ss-backdrop{--cds-layer-base:500}` and `.ss-backdrop-stacked{--cds-layer-base:520}` (source-settings.css tail). SourceTooltip (source-tooltip.jsx:546-558) now lands at 630/650, above the dialog; this matches c0db37792:1411-1440 and shared-frame:4738-4770. MoreMenu (it reads `.cz-page`) and SourceSelect (it reads the modal's z-index) are unchanged. Storage keeps 520 on `.ss-storage-dialog`. source-customize.css:7 is untouched.
- Nested dialogs: Font licenses (source-settings.jsx FontLicenses effect) and Storage (source-settings-pages.jsx StorageDialog effect) set and clear `data-nested-dialog-open` on `.ss-settings-dialog`. CSS ports shared-frame:5569 and :5619-5620:
  - an `::after` bg-backdrop overlay, opacity 0→1;
  - blur(2px) on the popup;
  - a transition that now includes filter;
  - transparent `.ss-backdrop-stacked` and `.ss-backdrop.ss-storage-backdrop` with no backdrop blur;
  - reduce-motion twins for both the OS setting and data-reduce-motion.
- Reconnect is now `SourceSettingsButton variant=secondary size=sm busy disabled={busy}` with the constant name 'Reconnect'. The 'Connecting…' label is gone. No plain button remains in a rendered `.ss-control`, so the three legacy `.ss-control button:not(.ss-switch):not(.source-settings-button)` rules are removed (`.ss-control select/input` stay). Side effect: the SourceSelect trigger in settings rows loses the leaked ghost-hover fill and the second .4 opacity when disabled; the `.sselect[data-disabled]` .4 is kept.
- What's new:
  - New app/src/release-notes.mjs has RELEASE_NOTES [{version:'0.2.130', date:'2026-10-01', items:[{kind,text}], limits}]. It derives LOCAL_RELEASE_NOTE_VERSIONS, which source-titlebar re-exports so the main.jsx import is unchanged, and provides hasReleaseNotes, releaseNotesFor (entries ≤ the running version, newest first; all entries when the version is unparseable, as B does), releaseNoteSegments (I: [[keys]] and `code`) and releaseNoteDate (O, UTC long date).
  - LocalReleaseNotes is rebuilt on SourceDialog: bleed, md, title 'What’s new', initial focus on the popup, `.sdlg-popup.st-release-notes{max-height:min(720px,85vh)}`. It renders the lag note z, then one section per entry: an h4 date, a neutral font-mono `data-cds=Badge` version, R groups New/Improved/Fixed (empty groups omitted), SourceShortcut keycaps and `code` spans. 'Known limits' is a muted `.st-release-limits` footnote.
  - Mounted through `useDialogRetention(whatsNew)` (declared right after the markSeen effect), so the exit transition plays.
  - The manual Tab trap, Escape and focus-containment code is deleted, along with `.modal-backdrop.st-release-backdrop`, `.st-release-header*`, the old shell/animation CSS and `@keyframes st-dialog-enter`. The style.css `.modal-backdrop` block is also deleted; it had no other user.
- Action errors:
  - New app/src/action-error-model.mjs holds the per-call-site catalog copy:
    - rename 7ck8ciIf0O
    - archive/unarchive NAJOCQ+6Ax/dqliJPGcDN (the Code session mutations in c6b8adeaf, not the Cowork "task" strings)
    - delete x1taMCWebd
    - fork nGtjMsYWZD
    - pin/unpin L7j7nu8EU0/v5/fMMduyr
    - mark-unread kBqUwOwe7e
    - mark-read silent (shared-16 Oh toasts only on unread)
    - reveal X0Ntx9olgx
    - reveal-file 8Kiu8ZnCtS
    - open-link XE6tFsxNtw
    - save-preference/dismiss-recent 7a1I3aH5Fd, also the fallback for move-to-group, pinned-order and open-terminal
  - It also has the copied IPC-prefix regex (cleanErrorReason) and reportActionError, which adds a danger toast keyed `action-error:<kind>` and console.warns the cleaned reason.
  - main.jsx `actionFailed(kind)` is declared after copyWithToast and routes these sites: mark-read on open, sidebar preferences, dismiss-recent, customizeReveal, transcript-view default, both session menus (kind from sessionActionErrorKind), onRevealFile, onOpenLink, archive-notice Restore, and the git band onOpenFolder. sessionAction rename throws the catalog copy. The banner's Dismiss error ToolButton gets a CDS `tooltip`.
- Catalog copy:
  - image toasts: 'Couldn’t copy image.' / 'Couldn’t save image.', now danger (cfc63964b addError); the reason is logged.
  - manual-text-save fallback: 'Couldn’t save changes. Try again.'
  - titlebar rename: catalog rename string; the reason is logged.
  - code block, turn footer and user actions: 'Couldn’t copy to the clipboard. Try again.' (ugO0/irMRD, the exact "Try again." variant).
  - MCP remove: `Couldn’t remove ${name}.` (K5b1jjmNX7); the reason is logged.
  - 'Review complete'.

Tests
- Unit, all green (55 + 54 related): settings-focus-return (+2: layer base, nested dim), settings-shell-render (+1: Reconnect data-cds=Button sm/secondary, no bare row button, disabled while busy), whats-new-model (rewritten copy test; +3: versioning/no-entry→no nudge, above-version hidden/order/groups, segments), source-titlebar-tooltips (versions from RELEASE_NOTES; +1 LocalReleaseNotes SSR), new action-error-model (5), new ui-copy-catalog (2; reads en-US.json read-only), reduced-motion-css, design-token-refs, toast-store, render-tdz, manual-text-save, response-image, account-settings-model, changes-toggle, response-markdown-render, source-nav-buttons.
- Scripts, syntax-checked only (no build and no suites, per the protocol):
  - settings: hover Theme Light/Dark for 400ms; tooltip visible, positioner z > `.ss-settings-backdrop` z, elementFromPoint at its centre inside it (pointer-events opened only for the probe, since the segment tooltips are hoverable=false).
  - settings-rest (Font licenses) and settings-complete (Storage): the outside pixel equals the Settings-only value, sampled at (6, h/2) through a 1x1 PNG decode; nested backdrop transparent with backdrop-filter none; blur(2px); ::after opacity 1; the attribute is cleared on close.
  - titlebar:
    - ⋮ › Open in › Finder with shell.openPath stubbed to reject shows a danger Toast 'Couldn’t show this folder in the file manager.', no .composer-error, no IPC text.
    - What's new asserts Dialog md, 520px, max-height, 48px alpha-1 bleed header, root inert, Badge, date, groups, 'Close', and data-ending-style on Escape.
    - With no RELEASE_NOTES entry for build.version, it asserts the nudge is absent.
  - code: dialog-scoped 'Close'.
  - turn-footer, user-actions, code-fence, rich-copy: new clipboard copy.

Deviations
- skills-mcp-ui-test.mjs is outside the R03 file list but was updated (2 targeted edits): customizeReveal now toasts, so the refused "Show in Folder" step waits for the 'Couldn’t show this file in its folder.' danger toast and dismisses it. The later 'Dismiss error' click became an assertion that there is no .composer-error.
- open-link uses 'Couldn’t open the page' (XE6tFsxNtw, a page-open failure label without a trailing period). The catalog has no plain external-link failure; every "Couldn’t open link." variant is SSH or deep-link specific.
- What's new uses the root density (comfortable), like every other shared Dialog; the old modal forced data-density=compact. The lag note keeps only z's first sentence, because the online changelog link has no local counterpart. The identity line became the first 'New' item: "This local Code Desktop client is now powered by DeepSeek Harness."
- attach() (the composer Add-files flow, listed at ~2041) stays on the inline banner. It is a composer failure, its staged notices already use the banner, and R05 owns the Add menu.

Remaining gaps
- These still route to setError: renameSession (the titlebar and sidebar rename paths can show the banner next to their own error), the rename dialog submit, the folder pill 'Show in Finder' (~2211), and the activity-center dismiss/mark-all-read (~2528-2529). They were not in R03's site list.
- main.cjs `reveal-folder` ignores shell.openPath's error string, so a removed folder never rejects in production. The titlebar script stubs a rejection instead.
- The unrendered 'mcp-config' row control in source-settings.jsx is still a raw `<button>` (dead code; DeveloperServers renders the CDS one).
- source-settings.css:34 (2px accent focus outline for plain dialog buttons) is unchanged.
- Not yet run: build plus the suites settings, titlebar, settings-rest, settings-complete, code, account-lifecycle, bypass-permission, background-tasks, turn-footer, user-actions, code-fence, rich-copy, git-band and skills-mcp.

## R05 — Composer: Send and stay here, real branch switch, persisted drafts, Add menu order, usage Compact session

### Changes
- **Send and stay here** (c099c328d :8870-8895, :11081-11088, :11270-11282; cc43287c9 :28620, :35140-35200, :31913, :27612):
  - `composer-keys-model.mjs` `submitPriority(action, running, {stayOnDraft})` returns `'stay'` for ⌘⏎ when idle on the Home draft. Enter is unchanged, and ⌘⏎ while running is still `'later'`.
  - `SourceComposer` has a new `stayOnDraft` prop (main.jsx passes `!current`). Its Send tooltip gets the second row 'Send and stay here' ⌘⏎ through `secondaryHint`. There is no ⌘⌥⏎ fork row.
  - `send({priority:'stay'})`:
    - empties the Home composer at dispatch (Et);
    - runs thread/start → thread/name/set (title from the first line, `.slice(0, 80)`) → turn/start without setCurrent or a history push;
    - inserts the sidebar row and forgets the stored Home copy;
    - puts the draft back on failure if Home is still empty (no(T, D)).
  - A `backgroundSpawns` state and ref (qc) block a second launch and disable the Home editor while a spawn runs (Jr `c > 0`). The editor is focused again once the count returns to 0.
- **Branch switch without worktree** (cc43287c9 :12084-12145 me/he/ge, :15860-15912 UR, :15920-16120 GR, :35132; asar index.chunk-Mak6MV2t.js, index.chunk-l0PS_wmg.js):
  - `branch-picker-model.mjs` adds `branchSwitchPlan` (`none` | `worktree` | `checkout-on-send` | `resolve-dialog`), `checkedOutBranch`, `branchCheckoutTarget`, `WORKING_TREE_ERROR` and the mode labels.
  - `main.cjs` adds three execFile git IPCs behind `workspaceQueryRoot`:
    - `branch-switch-check`: porcelain status, current branch, and file/+/− counts from `diff HEAD --numstat`.
    - `branch-switch-resolve`, mirroring the original:
      - stash: `stash push -u -m "epitaxy: pre-switch from <b>"`;
      - commit: `add -A` + `commit -m "WIP: epitaxy pre-switch from <b>" --no-verify`;
      - discard: `reset --hard` + `clean -fd -- :/`.
    - `branch-checkout`: `git switch <b>`.
  - The picker's onSelect now calls `selectBranch`:
    - With worktree on, or the same branch, it records the pick.
    - Otherwise it checks the working tree (a failed check counts as dirty). A clean tree records the pick and keeps the real branch in `workspaceInfo.checkedOut`. A dirty tree opens the dialog.
    - A newer pick or a folder change wins over a stale check.
  - `send()` runs `branch-checkout` before thread/start when the worktree is off and the target differs from the checked-out branch. On failure it shows the danger toast 'Couldn’t update the working tree.', aborts and keeps the draft. The worktree path is unchanged.
  - New `source-branch-switch-dialog.jsx/.css` builds GR on the shared SourceDialog (alert, `max-w-[30rem]`):
    - title 'Uncommitted changes on <code>{current}</code>';
    - description 'Handle them before switching to <code>{target}</code>.';
    - the '{n} files changed +a −d' line;
    - footer aligned between: Cancel | an mS-style split button (primary = the chosen mode, CaretDown 'More options' menu holding the Stash changes / Commit as WIP / Discard changes radio rows);
    - Discard asks again ('Discard uncommitted changes?', Back | Discard, danger);
    - busy and Escape follow the original O; a failure toasts and the dialog stays open.
  - On success the target is recorded (D(le)).
- **Persisted drafts** (shared-7-DsClUbcz.js ox/cx/px, Xx/Qx/Rx ax=20; cc43287c9 :6428-6457, :7300-7330):
  - `composer-draft-store.mjs` adds `persistDraft`, `readPersistedDraft` and `forgetDraft` (with an optional text match), plus `browserStorage`. They work over an injected storage, guard every access, write under `composer-draft:<key>`, and keep only the 20 most recently written entries.
  - `main.jsx`:
    - writes the live composer after a 300 ms debounce;
    - writes the leaving draft at once in `switchComposerDraft`, and flushes the pending write on pagehide/beforeunload;
    - reads the stored entry when the in-memory map lacks the key (boot → Home, openSession);
    - stages attachment refs again through `attachments:inspect`, and does not overwrite the stored entry while that runs;
    - forgets the entry in `clearStashedDraft`, and the Home copy after a Home → new-session send.
- **Add menu order** (c099c328d :8052-8330): the rows are Add files or photos, Add folder (icon Folder, per Kp), Slash commands, then the Skills/Plugins submenus. There are no separators, and the invented 'Mention a file' row is gone.
- **Usage Compact session** (c360a9e1c :4136-4139, :4202-4231; ion-dist cf6ae6197 Tw/bw/xw/Ow; c2d611398 H; ce660512f compactSession):
  - `context-usage-model.mjs` adds `compactAction`. It returns hidden below 50% or while compacting; disabled with 'Available when reconnected' (detached wins) or 'Available when DeepSeek finishes this turn'; otherwise enabled.
  - `SourceUsagePanel` renders the H row after the bar: an empty hint span, then the eo disabled-reason tooltip around a CDS TextLink 'Compact session', with the text-link CSS from design-system.css :1541-1568.
  - main.jsx passes `onCompact` for an open, non-archived session. It closes the popover, then calls `executeCommand('compact')` (performOperation). `compactState` passes running, connected and compacting.

### Tests
- Unit: `node --test tests/composer-keys-model.test.mjs tests/source-composer-submit.test.mjs tests/composer-draft-store.test.mjs tests/branch-picker-model.test.mjs tests/context-usage-model.test.mjs tests/composer-env-pickers.test.mjs tests/render-tdz.test.mjs`: 46/47 pass.
  - The one failure is `composer-env-pickers` 'the legacy code-ui Popover/MenuItem host is gone…'. It asserts `<SourceMenu.Header>Codex {boot?.connected ? …}`, which another batch replaced with `connectionMenuHeader(engine, …)`. Its other assertions still hold.
  - New tests cover:
    - stay priority cases;
    - a probe SSR of the Home Send tooltip rows;
    - draft-store round trip, null/throwing storage, the empty-draft remove, the LRU cap and forget;
    - `branchSwitchPlan` and the checkout target;
    - `compactAction`;
    - SSR of the compact row at 60%, while running, while detached, and absent at 0% / without onCompact / while compacting / on the draft.
- These related source-assertion suites pass (147 tests): app-menu, composer-placeholder, design-token-refs, ui-copy-catalog, reduced-motion-css, source-composer-dictation, sidebar-model and others.
- `vite transformRequest` compiles main.jsx, source-composer.jsx and the new dialog. `node --check` passes for main.cjs and the three edited scripts.
- UI scripts updated (not run, per protocol):
  - composer-states:
    - Add menu row order;
    - no compact row at 0%;
    - the row at 64k/128k, delivered as a `thread/tokenUsage/updated` event on the renderer's desktop:event channel because the codex fixture always reports 100 tokens;
    - §17b: picker-repo feature/login checkout on send; the dirty-tree dialog copy and focus; the More options radio rows; Cancel; Stash with one `epitaxy: pre-switch from feature/login` stash entry;
    - §17c: ⌘⏎ 'fixture:complete stay' stays on Home with an empty, focused composer, makes one thread/start (fixture-history.jsonl) and one turn/start, inserts the row, and checks out zeta-topic;
    - §19: 'keep me' with a mention chip, and 'home draft', survive `page.reload()`; sending A clears its key.
  - tooltip: the Home Send tooltip has two kbd rows ⏎ and ⌘⏎.
  - slash-commands-complete: its 'first Add row is Slash commands' assertion encoded the drift and now expects the original first three rows.

### Deviations
- The GR title follows the original copy, 'Uncommitted changes on {currentBranch}'. The batch text said 'Handle uncommitted changes', but that string exists in no 2.2553.1 bundle; 'Handle them before switching to …' is the description.
- GR's three choices are the original split button with a radio menu, not inline radios.
- The local SourceDialog popup keeps role=dialog (the suites select dialogs by role 'dialog'), with data-alert and data-cds=ConfirmationDialog.
- The Compact action is the original CDS TextLink (xo/Fc) as a native `<button>`, not a 'small button'. The original renders a span role=button.
- The background spawn count covers the whole spawn (thread/start through turn/start), like qc's decrement in the zK finally, not only thread/start. The Home editor is disabled while it runs (Jr) and is focused again afterwards.
- Stashing records the target. The actual `git switch` runs at the next spawn (D(le) → branchChanged at spawn), so the §17 suite verifies the stash, then the switch through the ⌘⏎ launch.

### Remaining gaps
- Not run (protocol): `npm run build` and the suites composer-states, tooltip, git-band, git, skills-mcp, slash-commands-complete and usage.
- GR's '{n} other sessions are using this folder…' note needs the td other-session count, which is not tracked locally.
- The trust check before the dirty-tree check (he → V) has no local equivalent.
- Persisted drafts store only path refs. A deleted file drops out on restore, and images pasted from the clipboard reload from userData/attachments. There is no cross-window storage-event sync, since there is a single renderer.
- The 'Compacts automatically at {pct}%' hint is omitted because the auto-compact threshold is unknown locally.
- A Compact session click is not exercised in a suite. The codex-server fixture has no `thread/compact/start`; session-actions covers performOperation('compact').

## R06

Tool rows and image viewing: category verbs, question receipt, tool output images, attachment preview, Bash title.

### Changes
- Category verbs (cf6ae6197 qO / xk / fk):
  - `file-tool-model.mjs` `fileGroupPresentation`: Harness dynamicToolCalls with no namespace get the source categories through `HARNESS_CATEGORIES`. todo_write → 'todo' ('updated todos', no count), exit_plan_mode → 'proposed a plan', run_code → 'ran code'.
  - A search action whose `tool` is 'glob' is 'found files'; grep keeps 'searched code'. Fixed metas live in `FIXED_META`.
  - ask_user_question, skill, job_* and namespaced (Codex) tools still read 'used'. The failed-count (ik) and first-segment capital are unchanged: a failed todo_write reads 'Updated todos (1 failed)' with isError.
  - Bridge (`projection.js` search mapping): the search action carries `tool: name`.
- Question receipt (approval-current.js:35628-35651 vZ, :16269 rules, :45232-45328 wue; c06cf64bb ms):
  - `generic-tool-model.mjs` has an internal `answerPairs` that keeps `unanswered` ('skipped' / 'dismissed'). `questionAnswers` keeps its {question, answer} shape.
  - New `questionReceipt(item, state)`: only for a 'done', status 'completed', non-error call with at least one real answer. It returns the answered and skipped pairs; a question with no answer entry is left out.
  - New `questionOutcome`: 'Skipped' when every question was skipped.
  - New `source-question-receipt.jsx/.css`: `div.source-message.sqr` with data-transcript-item-id. Rounded-lg, inset 1px --cds-border ring, max-width 480px, overflow clip, select-text, margin-bottom chat-item-gap.
  - Each pair is px-lg py-md, gap 2px, with a border-top between pairs. The question is font-medium text-primary, the answer text-secondary, each collapsed to one line (_Z).
  - The .2s enter fade plays only when the question was seen pending in this renderer (`notePendingQuestion`, consumed by the first mount). It never plays under reduced motion or the local motion setting.
  - `source-session.jsx` SourceMessage renders the receipt in place of the SourceStep. An all-skipped completed question keeps the Asked row, with a `.source-step-outcome` 'Skipped' passed as trailing.
  - `groupFileTools`: an answered question is not groupable, so it always stands alone.
- Tool output images (QO :7398-7445; hoisting :17093/:17302, in-body :17324):
  - Bridge `projection.js`:
    - `toolImage`/`toolImages` take inline {data, mimeType} blocks or Harness attachment refs. A ref is read from `imagePath` (the attachment store's imageHostPath): statSync, then readFileSync as base64.
    - PNG/JPEG/GIF/WebP only, capped at `TOOL_IMAGE_LIMIT` (4 MB of base64). Anything larger, unresolvable or another type stays '[image]'.
    - `textOf(blocks, carried)` drops the placeholder for delivered images.
    - MCP results keep `{type:'image', data, mimeType}` blocks.
    - Dynamic tools append Codex `{type:'inputImage', imageUrl:'data:…'}` items.
    - A read (read_image) commandExecution gets the bridge field `outputImages: [inputImage]`. Its aggregatedOutput becomes the image envelope's description line, e.g. 'image/png image, 1x1 px, 68 bytes'.
    - `completeToolItem` takes `imagePath`, and the projector's tool/result passes `this.imagePath`. This is a one-attribute plumbing edit outside the listed ranges.
  - App:
    - `toolOutputImages(item)` covers MCP image blocks, dynamic inputImage and commandExecution outputImages. Only base64 raster data URLs count, and each part is checked once (WeakMap).
    - `output()` filters image parts out, so no base64 reaches the details or copy text.
    - New `source-tool-images.jsx` (styles in source-generic-tool.css `.stimg*`): a column with pt-md and gap 4px of `button[aria-label='View screenshot']` (cursor zoom-in, rounded-sm, focus shadow). Each holds an img: max-height 360px, 1px --cds-border, 5px radius, alt ''.
    - Standalone rows hoist the column as a `.source-message.stimg-hoisted` sibling (margin-top 0). Group rows render it in the step body.
    - `source-file-tool.jsx`: an image read renders DetailsBody (command/path plus the description line), plus the thumbnails when inCard. It no longer renders the numbered '[image]' code card.
- Image viewer and attachment click (c099c328d :3143-3160, :3518-3590; ImagePreviewModal cb1b78cfa-DUGu0H_X.js; zoom cd5136de8):
  - New `source-image-viewer.jsx/.css`, portalled with MODAL_LAYER (.sdlg-portal):
    - role=dialog aria-modal, labelled by an sr-only title (alt).
    - A fixed grid with p-4 (md p-10), rgb(0 0 0/.5), backdrop brightness 75%. A 40rem frame, a w-fit rounded-md overflow-hidden image wrapper with the zoom shadow, and the img at max-height calc(100vh - 4rem).
    - A dark-scope ghost icon-only X 'Close image preview' (data-testid close-file-preview) at left-full ml-1.5.
    - Escape, a backdrop press and an image press close it. #root is held inert while it is open. Focus returns at once to the origin (else the opener).
    - With motion allowed, a WAAPI FLIP zoom from the origin: .35s cubic-bezier(.32,.72,0,1) in, .25s out, with a 320 ms timer fallback for occluded windows.
    - Annotate is omitted, with a code comment explaining why.
  - `composer-attachments-model.mjs` `attachmentOpenAction(entry)`: 'view' for a ready image with a preview, null while loading or without a path, 'file' for a non-image path, 'reveal' for a directory.
  - `source-composer-attachments.jsx`: the pill body gets onClick → open, and the viewer state stays in the component. File and directory pills call `onOpenFile(entry, action)`.
  - `source-composer.jsx` gets a new prop `onOpenAttachmentFile`, passed through (two-token edit).
  - `main.jsx`: one attribute. 'file' calls `openFileRef({path: relative-to-workdir || absolute})`, the Files pane opener. 'reveal' calls `transcriptActions.onRevealFile` (Finder, session-scoped IPC).
  - The remove X stays hover/focus-revealed.
- Bash title (approval-current.js:6874-6907):
  - The bridge adds `shell: name === 'pwsh' ? 'powershell' : 'bash'` to terminal/bash commandExecutions. Read and search commandExecutions get none.
  - `source-command.jsx` `shellPresentation(shell)`: 'Bash' + '$', 'PowerShell' + '>' (also in the copy text, highlighted as powershell), else 'Shell' + '$' (Codex). `SourceCommandLine` takes `prompt`/`language` props with the old defaults.

### Tests
- `cd harness && node --test tests/projection.test.mjs`: 32/32 pass.
  - New: glob/grep action tool; bash/pwsh shell, which survives completion and stop; read has no shell.
  - New: MCP image preserved; oversized and SVG → '[image]'; attachment ref via imagePath → dynamic inputImage; no imagePath → '[image]'; an oversized ref is never read.
  - New: read_image description line plus outputImages, and projector plumbing.
  - The existing glob deepEqual now includes `tool: 'glob'`.
- `node --test tests/approval.test.mjs tests/compact.test.mjs tests/questions.test.mjs` (harness): 30/30.
- `cd app && node --test tests/tool-group-presentation.test.mjs tests/file-tool-model.test.mjs tests/generic-tool-model.test.mjs tests/tool-cards-f07.test.mjs tests/composer-attachments-model.test.mjs tests/source-tool-incard.test.mjs tests/render-tdz.test.mjs tests/command-row-model.test.mjs tests/tool-segment-compaction.test.mjs`: 80/80.
  - New: category labels; images split from text; receipt pairs, all-skipped outcome, busy, failed and stopped; receipts kept out of groups.
  - New: receipt SSR markup, the all-skipped row with Skipped, Asking while busy, the live fade once, stopped 'Not answered'.
  - New: attachmentOpenAction; Bash/PowerShell/Shell titles and prompts; hoisted vs in-body thumbnails for MCP and read_image.
  - The f07 'expanded Asked row' test became the receipt tests on purpose. The generic-tool inputImage assertion now expects no text for a raster data URL.
- Other related unit files pass, except `tests/composer-env-pickers.test.mjs`. It fails on main.jsx's connection menu header regex (`<SourceMenu.Header>Codex {boot?.connected …}`), which R02 replaced with connectionMenuHeader. Not R06.
- UI scripts were updated but not run (parallel protocol):
  - skills-mcp:
    - The Tool rows seed gains a todo_write ×2 + command group and an MCP 1×1 PNG call.
    - The .sgt-qa block is replaced by receipt assertions: pairs, weight 500, primary/secondary, border-top only between pairs, px-lg/py-md, 480px, ring, 10px margin-bottom, no trigger.
    - New: `.stg-summary` 'Updated todos, ran a command'.
    - New: thumbnail naturalWidth > 0, zoom-in, hoisted after the row, no '[image]'; the viewer dialog 'Screenshot' opens, and Escape closes it with focus back on the thumbnail.
  - run-command: rc-solo has `shell:'bash'` and asserts 'Bash' (light :437 and dark :705). A new turn rc-t4/rc-codex without a shell asserts 'Shell' and '$'.
  - composer-states, step 3b: click the pasted PNG pill → dialog 'pasted.png' whose img src equals the pill preview, no Annotate. Escape returns focus to the pill. A fixture-a.txt pill (added via the patched dialog) opens in the Files pane; then the pane is closed and the pill removed, back to 3 pills.

### Deviations
- Tool thumbnails open the same ImagePreviewModal port as the composer. The source's zp/ma gallery lightbox (multi-image navigation, dim backdrop) and the jg image context menu around each thumbnail are not ported.
- Zoom-from-origin is a WAAPI FLIP of the image wrapper, not the source's view-transition morph (crossfade of the page, radius/inset keyframes).
- A stopped (interrupted) question keeps the row's own 'Stopped' word. The source's RN outcomeNote 'Not answered' replaces that slot, but SourceStep is outside R06's edit range. The body still lists 'Not answered'.
- The directory pill 'reveal' goes to Finder (onRevealFile), because the Files pane has no external tree-reveal request. Outside a session it does nothing.
- `projection.js`: `completeToolItem`'s signature and its single projector call site (one attribute) were edited beyond the listed ranges, for the imagePath plumbing. `node:fs` was imported.
- `source-composer.jsx` (not in the file list) got the two-token prop pass-through the task requires.
- `codex-server.cjs` needed no knob: seeded fixture turns pass the new fields through.
- skills-mcp: the edit was in the Tool rows seed (toolsTurn, ~74-95) and the Tool rows assertions. The F07 comment above it was reworded.
- Image reads with a failed attachment read keep the pre-existing raw envelope plus '[image]' aggregatedOutput.

### Remaining gaps
- Optional item not done: hiding the 'Asking …' row while its own requestUserInput card is pending. main.jsx's pendingApprovalItems does not include requestUserInput item ids, and the main.jsx edit budget was one attribute.
- An MCP call returning only an image (no args or text) still shows a caret with an empty details body (pre-existing SourceGenericToolBody behaviour).
- History replay re-reads attachment files for every image result (≤ 4 MB each). There is no cache.
- No offscreen run yet. Run `npm run build` and `run-suites-parallel.mjs -j 4 skills-mcp run-command edit-read composer-states files-pane approval-card tooltip`.

## R01 — Shell window and keyboard: narrow viewport, ⌘K, ⌘W/⇧⌘T, archive chord, Ctrl+O, dialog rows, custom-group +

### Changes
- **Narrow viewport** (shared-2 Jm/Ym; sidebar-main.js:15367-15372, :15401-15402; shared-2 Dg/toggleCollapsed/setIsNarrowViewport):
  - `sidebar-width-model.mjs` has `narrowViewportMaxWidth(w) = max(700, ceil(w)+329)` and `narrowViewportQuery(w)`.
  - main.jsx keeps a `matchMedia` subscription on the rendered width, `effectiveSidebarWidth(sidebarWidth, sidebarFloor)`, re-subscribing when the query changes. It derives `effectiveCollapsed = collapsed || narrowViewport`.
  - `effectiveCollapsed` is used for the `.dframe-root` class, data-hovering/peeked, SourceSidebar `collapsed`/`peekOpen` (and so the peek inert logic), the titlebar trigger and `escapeClaimed`.
  - `preferences.sidebarCollapsed` is never written for narrow.
  - While narrow, ⌘B, View › Show/Hide Sidebar and the 'Show sidebar' click toggle the peek card (toggleCollapsed under Dg). `openPeek` places it from the trigger geometry, which is now shared with `peekEnter` (`peekGeometry`).
  - Navigation (row, New) and Escape close the card through the existing `closePeek`. Its guard and `peekEnter` now accept a narrow frame.
  - Entering or leaving narrow resets the peek (wg). The trigger icon swap was not ported: Nb→Mb is the same "Sidebar" icon at another size.
- **⌘K**: `searchShortcutAction({collapsed, narrow, showSearch, toggle})` in `shortcuts-dialog-model.mjs` returns close, focus, open-peek or open-expand. main.jsx `searchShortcut(toggle)` serves ⌘K (toggle) and openSearchRef (⇧⌘K / Go › Search…): menus close, the collapsed sidebar expands (or the peek opens when narrow), showSearch is set and the input is focused on rAF.
  - ⌘K no longer opens behind an action dialog, the rename form, What's New or an inert root. Closing still works there.
  - Chin chords (blocked while showSearch) and the first running-turn Escape (escapeClaimed) now act on a visible, focused field.
- **⌘W / ⇧⌘T** (asar iwr/rwr/owr; shared-21 pR :14357-14360, reopenClosed :14261-14266; ion-dist shared-19 Wh/Kh/qh/Jh, cb24e6301 planReopen):
  - New `closed-session-model.mjs`: push (dedupe, newest first, bounded at 50), pop skipping ids whose session is gone, `hasClosedSession`, and `planReopen` → focus | navigate.
  - `globalShortcutCommand` matches ⌘W ('close-session', Meta only, typed char else KeyW), ⇧⌘T ('reopen-closed') and ⌃O ('transcript-view').
  - main.jsx ⌘W, while a session view shows with no menu, dialog or layer: closes the focused or first open pane, else pushes the session and goes Home. ⇧⌘T pops and navigates. Both are also reachable from `menuCommandRef` kinds `close-session` and `reopen-closed`.
  - menuState reports `session:{open}` and `reopenClosed:{available:true, enabled}`.
  - `app-menu.cjs` fileMenuItems:
    - With session.open: Close Session ⌘W (an accelerator-triggered click is marked `accelerator:true`) plus Close Window ⇧⌘W.
    - Otherwise Close Pane, or Close Window with its hidden twin, as before.
    - Reopen Closed Session (CmdOrCtrl+Shift+T, registerAccelerator, enabled from the report, dispatched through `dispatch`/rendererOwned) is appended only while available.
    - `menuState` normalizes the new keys, and the header comment is rewritten.
  - main.cjs menuEmit: close-session from a pane window closes that window. A marked accelerator close-session from the main window is dropped, because the renderer owns ⌘W. The close→hide handler is unchanged for Close Window.
- **⌘⇧⌫** (shared-19 rg/ag/ig/Zm/Qm): `sidebar-jump-model.mjs` has `archiveChord` (also rejects repeats), `archiveBlockedByField` (ng types, contenteditable text) and `archiveNeighbour`. The SourceSidebar window keydown then:
  - requires code mode, no menu or inert root, no multi-selection, and a current session that is listed and not archived;
  - calls `onSessionAction("archive", session, {keepView:true})`;
  - then scrolls to and clicks the next row, else the previous one, else goes Home.
  - main.jsx sessionAction skips its own navigate(null) for `keepView`, which avoids a Home hop in history.
- **Ctrl+O**: `nextTranscriptView(current, {hasThinking})` in `src/transcript-view-model.mjs` cycles qa filtered by Xa. main.jsx handles a plain ⌃O (not composing, no menu, dialog or layer, a session view) with setSessionView.
- **Dialog rows** (zR order and wording):
  - General: Close tab, pane, or session ⌘W; Reopen closed session ⇧⌘T (after New session); Jump to session ⌘1…9; Archive session ⇧⌘⌫; Transcript view ⌃O (before Stop).
  - Panes: Toggle file list in changes or files ⇧⌘Y, after Toggle changes.
  - shortcutCaps already renders ⌘1…9 and ⌫.
- **Custom group '+'** (sidebar-groups.js:13871-13907 cI, :17392-17410, :18560-18590, :19895-19905 Dz):
  - Custom headers get a 12px Add ToolButton with tooltip {content, detail 'Added to {group}', side right, hoverable false}. It calls newSessionInGroup.
  - It sits inside `.source-group-reveal`: opacity 0 until the section has :hover or :focus-within, 1 under (hover:none), and no transition with reduced motion (source-sidebar.css).

### Tests
- Unit, all passing:
  - `sidebar-width-model` (288→700, 200/371→700, 372→701, 400→729, 420→749, query)
  - `shortcuts-dialog-model` (rows, order, caps, chord matching, `searchShortcutAction`)
  - new `closed-session-model`
  - `sidebar-jump-model` (archive chord ctrl, alt, repeat, ⌥ negatives; field guard empty vs filled; neighbour)
  - `transcript-view-model` (Ctrl+O cycle)
  - `app-menu` (session-open, Home and reopen states; menuState normalization)
  - `source-sidebar-states` (custom '+' labels, reveal span, CSS)
  - `render-tdz`
  - `ui-copy-catalog`, `changes-toggle`, `source-nav-buttons`, `source-titlebar-tooltips` and others.
- `tests/composer-env-pickers.test.mjs` fails on the connection-menu header regex (`<SourceMenu.Header>Codex …`), which another batch changed. Not R01.
- UI scripts were updated but not run (parallel protocol); `node --check` passes for each:
  - sidebar-chrome:
    - the pane-menu-state File labels are now Close Session; File › Close Session closes the open pane first;
    - new 'cmd-k-collapsed' step: ⌘B, ⌘K docks and focuses, ⌘K detaches, ⇧⌘I opens Models;
    - the window-600 step is rewritten: collapsed frame, no overflow, full-width content, the pref stays false, keyboard Enter on the trigger toggles the card, a row click closes it, ⌘B and View toggle it, Escape closes it, and 760 docks.
  - menu-bar: seeds one fixture session. New 'close-session' step: Home/session File items, ⌘W → Home with no window close, Reopen enabled, ⇧⌘T reopens, and File › Close Session by click. close-hides then runs from Home.
  - session-actions: the dialog rows, glyphs and order; Control+O switches Normal→Verbose→Normal in the per-session view map.
  - sidebar-rest step 11: with a filled search field, ⌘⇧⌫ archives nothing. Then ArrowDown moves keyboard focus off the open row, and ⌘⇧⌫ archives the open session and opens its neighbour.
  - sidebar: the custom '+' is hidden at rest and revealed on hover. Clicking it goes Home with second-project; the sent session is filed into the group, then deleted again so the later counts hold.

### Deviations
- **⌘⇧⌫ target.** The task describes the keyboard-focused row. The original rg acts on the row whose `data-selected` is "focused", and ao defines that as the session shown in the focused pane (shared-19 ao: `i===0?"focused":"open"`). Keyboard focus is not involved. The port archives the current session's row. The sidebar-rest step proves this on purpose: keyboard focus is moved off it with ArrowDown first.
- **Archive neighbour.** The original always clicks the neighbour (Qm) after commit, which opens it, because the archived row is always the shown one. The port does the same.
- **No Ctrl+O toast.** The task asked for the 'Switched transcript view …' toast. The original keyboard path (c360a9e1c um via "keyboard") only debounces the make-default nudge. Those toasts belong to the loading indicator's thinking toggle (cd5a31703 V). The session-actions step asserts that no toast appears.
- **Custom '+' label.** The task gave `New session in ${group.label}`. Custom groups pass a newSessionTarget (Dz), so the original label is 'New session in {folder}, added to {group}', or 'New session with no folder picked, added to {group}' (catalog BMcP9RIb22 / BkdwdII5Mk). The tooltip is the target with an 'Added to {group}' detail.
- **Hover-reveal scope.** It is applied to the custom '+' only. In the original code list (A = wl() non-null), project buckets' '+' are also hover-revealed with the xs glyph. The project '+' is unchanged here; see remaining gaps.
- **Closed-session stack.** The original Wh is unbounded; the local stack is bounded at 50.
- **⌘K expands the sidebar.** The original ⌘K palette is an overlay that never changes the sidebar. Locally 'open-expand' writes `sidebarCollapsed:false`, as specified.
- **main.jsx edits outside the listed regions:**
  - the narrow block next to collapsedRef;
  - the peek helpers (peekGeometry, openPeek, frameCollapsed, toggleNarrowPeek, expandSidebar, the narrow reset effect);
  - one `keepView` condition in sessionAction;
  - imports and MENU_COMMANDS.

### Remaining gaps
- View › Show/Hide Sidebar keeps its label from `config.sidebarCollapsed`. The original UL(!collapsed) reports the effective state, so while narrow it reads 'Show Sidebar'.
- No boot placeholder or `reportFrameLayout` narrowViewportMaxWidth (cR) is sent to main; there is no local placeholder.
- Project-bucket '+' is not hover-revealed and not the xs glyph (original code list).
- ⌘W covers only the local tiles and the session view. The source's ln() closes tabs, panes or split views; there is no split view or tab-close registry locally.
- ⇧⌘T keeps no `place` (the split position).
- No offscreen run yet. Run `npm run build && node work/fidelity-batches/run-suites-parallel.mjs -j 4 sidebar-chrome menu-bar session-actions sidebar-rest sidebar menus-states pane-layout titlebar shutdown`.

## R07 — Approvals and questions: plan approval card, dismiss-on-send, Other without text, one card at a time, Auto description

### Changes
- Plan approval card. Sources: PM approval-current.js:16105-16127, Mk :9443-9458, Rse :9459-9887.
  - New `src/source-plan-card.jsx` / `.css`. `SourceApproval` (source-session.jsx) routes any request whose questions include id 'plan-review' (`isPlanReviewRequest`) to `SourcePlanApprovalCard`. A malformed review falls back to the question card's error notice.
  - The card reuses the `sac-card` / `sac-body` / `sac-button` chrome. Five helpers that `source-approval-card.jsx` already had (`ActionButton`, `BusyAnnouncement`, `currentlyVisible`, `useAllowArming`, `useHotkeyArming`) are now exported; the only edit to that file is the `export` keyword.
  - Heading (ev): 'DeepSeek proposed a plan'. Trailing it, a footnote TextLink 'Open plan', shown only when a plan item exists.
  - Actions (:9802-9884):
    - Left: 'Reject' and 'Revise…' (esc keycap).
    - Right: 'Accept' (⇧⌘⏎, Manual) and the primary (⌘⏎), labelled from Mk for the target: 'Accept and allow edits' (acceptEdits) or 'Accept and auto mode' (auto).
    - When the target is Manual, only a single primary 'Accept' shows. Bypass is never a target.
  - Accept and the primary use the 400 ms click arming. ⌘⏎ / ⇧⌘⏎ use the hotkey arming plus a visibility check at key time. Reject and Revise… respond at once.
  - Escape or 'Revise…' swaps in the 3-row 'Plan feedback' textarea ('What should change? (optional)'), focused, with Back / Revise (:9734-9801). In the field, Escape goes Back and clears it; Enter (not Shift+Enter) sends Revise.
  - Payloads, from `planReviewResponse` in approval-draft-model:
    - Reject → `['Keep planning']`.
    - Revise → `['Keep planning', feedback.trim()]`.
    - Accept → `['Approve']` + `codeDesktop:{afterPlan:'ask'}`.
    - Primary → `['Approve']` + the target.
  - `runtime.submit(ticket, action, respond, {getVisibleThreadId, response})` sends such a prepared response for question requests. The identity, busy and visible-thread guards are unchanged.
  - `electron/respond-approval.cjs`:
    - Accepts the `codeDesktop.afterPlan` extension only on a plan review, only 'auto' / 'ask' / 'acceptEdits', and with no other keys.
    - Allows the two-value `['Keep planning', text]` answer only on the 'plan-review' question. Every other single-select question keeps the one-answer contract.
  - `electron/permission-policy.mjs` `approvedPlanPermission(request, payload, afterPlan)`: the extension wins over the remembered mode, Bypass maps to Auto, and a non-approval returns null.
  - `main.jsx`:
    - `respondApproval` selects that mode (DeepSeek core, in Plan).
    - The card gets `planTarget = afterPlanPermission(afterPlan.current)`.
    - `onOpenPlan` scrolls to and focuses the plan item: `plan-<itemId>`, else the turn's latest plan item. When the row has no tabindex, the helper sets tabindex=-1.
  - Bridge:
    - `questions.js approvedAfterPlan(response, hint)`: the response's afterPlan ('auto' / 'ask' / 'acceptEdits') wins; otherwise the turn hint is used.
    - `index.js` askQuestions uses it in the plan-mode sync, so `afterPlanPermission` never yields Bypass.
- Dismiss on send. Sources: cc43287c9 :32430-32453 / :33199 / :34705; yk re approval-current.js:8048-8066.
  - `approval-draft-model.mjs` exports `QUESTION_DISMISSED_ANSWER` (lO text copied from shared-11, em dash included) and `dismissQuestionPayload(request)`. The payload answers every question with `[marker]`. It returns null for:
    - plan reviews;
    - questions whose options exclude free text (isOther:false);
    - secret fields;
    - malformed requests.
  - `main.jsx` `dismissPendingQuestions(threadId)` sits beside the approvals code. It submits each dismissible `item/tool/requestUserInput` on the session's own thread through `approvalRuntime`, with the card's ticket (`ticketFor`), the card's `getVisibleThreadId` expression and `respondApproval`.
  - It is called once, awaited, as the first statement in `sendWhileRunning`'s try (after `setSending(true)`, so a double Enter cannot steer twice). The steer or queue then proceeds as before.
- Other without text. Sources: uk :7764-7766, ck :7695, R :7911-7921.
  - `isQuestionAnswered` counts a selected Other as answered, single or multiSelect, when the question isOther.
  - `answerPayload` sends `customText.trim() || 'Something else'` (`OTHER_FALLBACK_ANSWER`).
  - Free-form questions (no options) still need text.
- One card at a time. Sources: cc43287c9 :31744 / :37426; c57f8fcae je.
  - `visibleApprovals(requests)` in approval-draft-model keeps only the oldest answerable request.
  - Unanswerable requests stay visible as error notices and never hold the queue: an unsupported identity, or a question schema error.
  - `main.jsx` renders `shownApprovals`. `approvals` (pendingApprovalItems, the waiting / pendingInput flags) is unchanged, so queued rows keep 'Needs approval'.
  - The next card mounts under a new key, which gives it a fresh 400 ms clock.
- Auto description: `source-permission-menu.jsx` now reads 'DeepSeek handles permission decisions' (aE local branch, shared-14 :10346-10356).
- Fixture (`tests/fixtures/codex-server.cjs`), self-contained knobs:
  - `fixture:plan-review`: emits the plan item `plan-call-plan-<id>`, then the bridge-shaped plan-review requestUserInput (itemId = call id).
  - `fixture:input-steer`: the answer keeps the turn running and is also logged as `response:item/tool/requestUserInput` in fixture-requests.jsonl. The next turn/steer completes the turn ('DISMISSED_QUESTION_STEER_REPLY').
  - `fixture:approval-pair`: two command approvals 30 ms apart. Answering the first keeps the turn; the second completes it.
  - `fixture-core.json {engine}` is copied into initialize.
- `work/deepseek-live-20261001/live.mjs`: with `ANSWERS {"plan-review": "<button label>"}`, it clicks that plan-card button and records the labels and the permission before and after. The old `.sq-option` path cannot answer the new card.

### Tests
- `cd harness && node --test tests/questions.test.mjs tests/approval.test.mjs`: 27/27 pass. New tests:
  - afterPlan from the response overrides the hint; Bypass, unknown and missing values fall back; Bypass never results.
  - Revise pair → selected + custom.
  - The marker answers as custom.
- `cd app && node --test` on permission-policy, approval-draft-model, approval-transport, approval-state, tool-cards-f07, render-tdz, source-shortcut and approval-card-model: 128/128 pass. New or updated:
  - permission-policy: Accept → ask; primary → its target; reject / revise → null; Bypass → auto; the remembered-mode fallback.
  - approval-draft-model:
    - Single Other empty → `['Something else']`, with trimmed text.
    - multiSelect Other → `['Something else', 'Beta']` (this updates the old "empty Other adds nothing" case).
    - Free-form still needs text.
    - Plan payloads for all four actions through the runtime and `approvalResponse`, plus the extension's validation.
    - Dismiss payloads for single, multiSelect and free-form, and the null cases.
    - `visibleApprovals`.
  - approval-transport: a real CodexClient fixture writes the revise pair, the primary with `codeDesktop.afterPlan`, a refused Bypass extension and the marker.
  - approval-state: arrival order → head; resolving the head promotes the next.
  - tool-cards-f07:
    - Plan card SSR: heading, Open plan, left/right groups, labels per target, keycaps, inactive state, malformed fallback.
    - The empty Other enables Submit.
    - Auto copy.
- UI scripts, updated but not run (per the protocol):
  - approval-card. Light and dark screenshots: approval-card-plan-dark.png, approval-card-plan-light.png and approval-card-plan-feedback-light.png.
    - fixture:plan-review:
      - Heading, link and font metrics; groups, labels and variants; keycaps ['', 'Esc', '⇧⌘⏎', '⌘⏎'].
      - Open plan focuses the plan item.
      - A composer send steers but leaves the card pending.
      - Reject / Revise (Escape → field → Escape Back → Revise) / Accept / ⌘⏎ results checked in fixture-responses.jsonl.
    - fixture:input-steer + 'free reply' + Enter → .sq-card detaches; the marker response is logged before the turn/steer.
    - Other enables Submit → ['Something else'].
    - fixture:approval-pair → one card; B's click inside its first 400 ms (MutationObserver) sends nothing; after 450 ms it does.
  - approval-transport: the typed 7/'7' pair and reload-A/B now expect B only after A resolves.
  - permission:
    - The Auto copy.
    - New tail: relaunch with fixture-core `{engine:'deepseek-harness'}`; Accept edits → Plan → plan card labels; Accept → Manual (persisted 'ask').
    - Again: Accept edits → Plan → 'Accept and allow edits' → Accept edits.
    - Both wire responses carry codeDesktop.afterPlan (logged by the proxy).

### Deviations
- Keys are scoped to the card, like SourceApprovalCardView and the question card, instead of Rse's window-level capture listener. Escape typed in the composer does not open Revise. Back returns focus to the card so its keys keep working.
- Single trust-forward target (the mode used before Plan), as the batch specifies. There is no 'More accept options' split button, and no Ultraplan 'Return to terminal'. The pending-comments (`te`) branch is absent too, since the transcript has no selection comments.
- Dismiss-on-send answers only questions on the session's own thread. A sub-agent's question stays pending, because the steered message does not reach that sub-agent. Secret questions are skipped like isOther:false ones. Both send lanes dismiss: the source calls Dd on every non-parked send.
- `planTarget` is computed even under Codex. There the card still works and sends the extension, but the mode only changes on the DeepSeek core, as before.
- The 'Plan approved' row body (Xoe) was skipped, as R06 owns generic-tool-model.

### Remaining gaps
- Not run (protocol): `npm run build`; the approval-card, approval-transport, permission, bypass-permission and composer-states suites; the live Plan-mode run (DSH_HOME=…/scratchpad/dsh-home, `ANSWERS='{"plan-review":"Accept and allow edits"}'`). The light and dark plan-card screenshots come from the approval-card suite once it runs.
- The fixture-core `engine` knob is exercised only by the new permission tail. A DeepSeek-engine relaunch on the Codex fixture is unverified until the suite runs.

## R08 — Transcript: GitHub ref chips, output-limit notice, error recovery actions, thread-error card, dframe cursor policy

### Changes
- GitHub reference chips (markdown-current.js:3580-3687 Ps/Fs/Is/Ls/Rs/zs/Bs/Vs/Us/Ws/Gs/Ks, with c03935b01 Lr/Br/zr/Vr; rc :3713-3786; gate :4358-4365 and :4543-4555):
  - `response-link-model.mjs` gains:
    - `responseForgeRef(href)`: github.com `/{owner}/{repo}/(pull|issues)/{n}`. Ports, credentials, `.`/`..` segments and encoded `%2f`/`%5c`/`%2e` after the number are refused. `new URL()` resolves literal dot segments first, as in the source.
    - `forgeRefLabel(href, ref, sameRepo)`: `#N` or `owner/repo#N`, plus the `(files)`, `(commits)`, `(checks)`, `(comment)` and `(review)` suffixes.
    - `forgeRefLabelMatches` (Gs), `forgeRefSameRepo` (the En() comparison) and `forgeRepoSlug(identity)`.
  - New `source-forge-ref.jsx`:
    - `SourceForgeRepoContext` stands in for transcriptLinks (ds, default off). Its value is the lowercased session repo slug, or `''` when unknown.
    - `SourceForgeRef` draws the rc pill with no PR status known: `<a class="hide-focus-ring smd-forge-ref">` > `span.whitespace-nowrap`. A pull request gets a 12px GitPullRequest glyph in the verbatim Zs slot classes (all present in c6a992d55); an issue gets no glyph. There is no aria-label, because no title is known.
  - `source-session.jsx` SourceMarkdownLink: a second `useContext`, then the forge branch inside the external path. It applies only inside the context, with no element child whose text is empty, and when the label passes Gs. The chip keeps the same onClick, onAuxClick and onDragStart handlers.
  - `source-session.css` adds `.source-markdown a.smd-forge-ref`:
    - rounded-sm, `--cds-bg-accent-muted`, box-decoration clone, px-1.5 (`--spacing`), `--cds-text-accent`;
    - no underline; hover `--cds-bg-accent`; focus-visible focus shadow.
  - `main.jsx` wraps the main transcript `shownRows.map` in `<SourceForgeRepoContext.Provider value={forgeRepoSlug(repoIdentities[workdir])}>`. A repo with no origin owner gives `''`, so the label falls back to `owner/repo#N`. Two imports were added.
- Output limit (c1298b0ba Z.output_token_limit; shared-18 `_r.outputTokenLimit`):
  - `projection.js` turnError: `max-tokens` returns `{message:'Response exceeded the output limit', codexErrorInfo:null, additionalDetails:'MAX_TOKENS', misalignment:null}`. turnStatusOf still says `completed`, and no ErrorNotification is sent.
  - `turn-error-model.mjs`:
    - adds the `output_token_limit` category and row: headline from the source, hint 'Ask DeepSeek to continue, or break the task into smaller steps.', retryHelps true, warning icon;
    - `turnErrorCategory` classifies `additionalDetails === 'MAX_TOKENS'` (exported `OUTPUT_LIMIT_DETAILS`);
    - `turnErrorDetails` returns `''` for this category, following source G `output_token_limit: "drop"`, so there is no View details.
  - `state.js`: the live turn/completed path already stored turnErrors for a turn with an id. History hydration (~:148) now also keeps `completed` turns that carry an error. Without this, the output-limit notice vanished on relaunch. This is a one-line edit outside the stated regions.
- Recovery actions (c1298b0ba xe; cf6ae6197 CS; scroll-messages-current.js:56347-56383):
  - `presentTurnError` returns `compactHelps` (context_length) and `modelSwitchHelps` (overloaded).
  - `SourceTurnError` takes `onCompact`. It renders a secondary sm 'Compact session' before Try again in the ste-actions slot. One shared latch hides every action after any click, as CS N does.
  - `main.jsx` passes `onCompact={() => performOperation("compact")…}` (a failure becomes a warning toast) only when all of these hold:
    - the variant is card;
    - the turn is neither running nor loading;
    - the session is connected and not archived;
    - `thread/compact/start` is not in `unsupportedMethods`.
  - The hint keeps hintNoRewind, because xe picks it by canRewind only.
- Thread error card:
  - `state.js` :435 and :452 store `normalizeTurnError(...)` instead of the bare message.
  - `main.jsx` renders `<SourceTurnError variant="card" turnId="thread">` at the transcript tail. Try again appears only when `retryInput` accepts the last userMessage turn, and resends it through `retryFailedTurn`.
  - The transcript `.inline-error` is gone. The message-style.css `.inline-error` rules stay, because the composer banner (`.inline-error.composer-error`, R03) still uses them.
- Cursor policy (sidebar-main.js:15140-15146 sR; desktop-layout.css:1026-1047 in the loaded shared-styles):
  - `index.html` `<html data-dframe="">`.
  - Ported Tailwind `cursor:pointer` declarations were deleted from:
    - source-tool-group.css (`.stg-trigger`; the classic `.source-step-trigger[aria-expanded]` rule is removed);
    - source-agent.css (`.sag-trigger`, `.sag-link`);
    - source-file-tool.css `.sft-path`;
    - source-disclosure.css;
    - source-transcript-status.css `.sts-thinking-toggle`;
    - source-diff.css `.sdiff-context-gap button`;
    - source-session.css `.source-file-overflow-close`;
    - source-command.css `.src-cmd-copy`;
    - source-sidebar.css `.df-family-handle`;
    - source-workflow.css `.swf-compact`, `.swf-phase-head`;
    - source-customize.css `button.cz-plugin-item`;
    - source-settings-pages.css `.ss-mcp-list button`.
  - Non-button elements switch to `var(--cds-cursor-interactive,default)`: `.sc-command-chip` (shared-14:18295 cursor-pointer), and the `.ss-mcp-advanced` and `.ss-storage-area` summaries.
  - Dead rules: message-style.css `.tool-card summary` / `.thought summary` (decl only), source-session-actions.css `.session-command-option` (unused).
  - Redundant under dframe: source-slash-menu.css `.slash-local-status button`. source-composer.css `.sc-usage-compact` lost its pointer declaration.
  - message-style.css adds dframe exceptions so originals that survive the arrow still do:
    - `[data-cds="TextLink"]:not(:disabled):not([data-disabled]):not(.cursor-default)` gets pointer (the `.cds-text-link[role=button]` exception, because the local TextLinks are `<button>`s);
    - `.stimg-button` gets zoom-in;
    - `.st-toolbar .st-title` gets text (c360a9e1c:7385 fm cursor-text);
    - `.tiles-drag-handle` gets move (c360a9e1c:9673-9688 inline style).
  - Tailwind utilities in c6a992d55 are in `@layer utilities`, so the original `cursor-grab` reorder handle is an arrow. Local `.sqm-handle` now matches it.

### Tests
- `cd harness && node --test tests/projection.test.mjs` passes 33/33. The new case checks that max-tokens gives turn/completed with status completed, the output-limit TurnError, no `error` note, and a snapshot error. A plain completion still has a null error.
- `cd app && node --test tests/response-link-model.test.mjs tests/response-markdown-render.test.mjs tests/turn-error-model.test.mjs tests/state.test.mjs tests/cursor-policy.test.mjs tests/design-token-refs.test.mjs tests/transcript-status-model.test.mjs tests/render-tdz.test.mjs` passes 101/101. Also run: `tests/sidebar-model.test.mjs` 25/25.
  - response-link-model:
    - pull and issue refs, www and case handling, '.' resolution;
    - rejected ports (8443 and 443), credentials, `..`, `%2f`/`%5C`/`%2E`, non-GitHub hosts, `pulls`, 10-digit numbers;
    - labels and suffixes, Gs accept and reject cases, slug helpers.
  - response-markdown-render: SSR inside the context shows:
    - a bare PR URL becomes the exact chip markup (glyph slot, 12px Icon, `acme/widgets#42`, no aria-label);
    - same-repo `#42`; an issue with no glyph; `(files)` and `(review)` suffixes;
    - a descriptive label, a mismatched `#41` or an image child stays a plain `<a>`;
    - ports and GitLab hosts stay plain; outside the context every link stays plain.
  - turn-error-model:
    - the output_token_limit row and category, with no details;
    - compactHelps and modelSwitchHelps across every category;
    - a live completed turn with an error, and the history hydrate;
    - a thread error keeps its TurnError shape, blocks the sidebar and is cleared by turn/started.
    - The existing deepEqual rows gained the two flags.
  - state: output-limit turnErrors, the thread-wide TurnError shape, and the fallback message.
  - transcript-status-model: the recoverable thread error is now read as `.message`.
  - cursor-policy (new):
    - `<html>` has data-dframe, cds-root and data-platform=desktop;
    - the loaded shared-styles rules are present;
    - no app/src/*.css `cursor:pointer` outside the allowlist (the TextLink exception, plus R07's `.spc-open-plan`, which is redundant with it);
    - a self-test of the rule scanner.
- UI scripts and fixture, updated but not run per the protocol:
  - `codex-server.cjs` `fixture:turn-error:*` knobs:
    - `output-limit`: partial reply, then completed + Turn.error MAX_TOKENS;
    - `context`: failed with contextWindowExceeded / CONTEXT_WINDOW_EXCEEDED;
    - `thread`: completes, then `error` with turnId '' and willRetry false.
  - turn-errors:
    - output-limit card in light: headline, hint, Warning in danger, Try again, no View details, after the partial reply.
    - Context card: Compact session in ste-actions with an arrow cursor, no Try again. A click latches it, `[data-operation=compact]` appears, and `thread/compact/start` reaches the fixture.
    - The output-limit marker in light.
    - Relaunch: 4 failed + 1 completed-with-error persisted. Markers and the card are restored, and the context card offers Compact again.
    - Dark: the output-limit marker, then a new output-limit card.
    - Thread error: a card with `data-turn-id=thread` at the tail before the status row, with View details and Try again, and no `.inline-error`.
  - transcript-states: there were no `.inline-error` reads to replace. A guard was added that no non-composer `.inline-error` exists.
  - user-markdown: `um-link-answer` now names `https://github.com/acme/widgets/pull/42` twice, once bare and once labelled. The check covers light and dark (via the account menu):
    - the pill text `acme/widgets#42`, text-accent on bg-accent-muted, rounded-sm, px-1.5, nowrap, link pointer;
    - hover bg-accent;
    - the GitPullRequest 12px glyph slot classes, relative position and margin;
    - the labelled link stays plain;
    - a chip click opens externally exactly once.
  - edit-read: cursor 'default' on the classic `.source-step-trigger` (the assertion was 'pointer'), `.stg-trigger`, `.sft-path` and the file-ref control. The markdown `a[href]` keeps 'pointer', and `<html>` has data-dframe.
  - subagents: `.sag-trigger` cursor is 'default'.
  - run-command (outside the list): the same classic-trigger 'pointer' assertion is now 'default'.

### Deviations
- The fixture core has no `thread/compact/start` handler, and the knob rules kept me from editing its request switch. The turn-errors Compact click therefore ends in the failed phase ('Unknown test method' and a warning toast). The suite asserts the latch, the operation row and the request, not the success copy.
- The output-limit hint names DeepSeek, not Claude. The output-limit card drops View details per the source verdict, unlike the local keep-all adaptation for other categories.
- The forge chip is gated on the main transcript only: background-task and agent-pane transcripts, review text and Files previews keep plain links. There is no PR status icon or title (`se`/`ae`, which need GitHub), no issue→PR resolution (Xs), and no PR pane claim. The same-repo slug compares owner/name only, because repo identities carry no host.
- Files outside the stated regions:
  - `state.js` history filter (~:148) and the emptyState comment;
  - `source-composer.css` (decl only), `source-session-actions.css`, `source-slash-menu.css`;
  - `scripts/run-command-ui-test.mjs`, `tests/transcript-status-model.test.mjs`;
  - new `src/source-forge-ref.jsx` and `tests/cursor-policy.test.mjs`.
- The thread card offers no Compact session; spec 4 covers retry only.

### Remaining gaps
- Not run (protocol): `npm run build` and the suites turn-errors, transcript-states, user-markdown, edit-read, subagents, session-actions, tooltip, composer-states, rich-copy and run-command.
- A turn that completed with the output-limit error has side effects:
  - the sidebar treats it as `latestTurnError`, so the session goes to "blocked";
  - `agent-model.mjs` marks a sub-agent turn with any error as failed;
  - `session-operations.cjs` finishes a review or compact turn with an error as failed.
  Each matches "the turn carries an error", but none was checked against the original.
- The retry-with-model menu for overloaded (modelSwitchHelps, F8 retryModelItems) is not built.
- R07's `.spc-open-plan { cursor:pointer }` is now redundant: the dframe `button` rule outranks it, and the global TextLink exception supplies the pointer. R07 can drop it, then remove it from the cursor-policy allowlist.

## R09 — Files viewer and Plan pane: full language map, Markdown/CSV/image preview, plan document, persistent find bar

### Changes
- Language map (c41eb0199-C-RzbqEe.js `n` + r(); code-language-current.js:78-85 g()):
  - `scripts/generate-highlight-languages.mjs` also parses `n` (345 keys, asserted) and the lockfile table of c8a544a8c (`t`, 16 keys). Every value must be a bundled id or alias. It emits `FILE_EXTENSION_LANGUAGES` and `LOCKFILE_LANGUAGES` into `src/highlight-languages.mjs` (`__proto__: null` literals) and keeps the generated header. Re-running leaves `src/highlight-grammar-loaders.mjs` byte-identical (checked with `cmp`), and the first 240 lines of `highlight-languages.mjs` are unchanged.
  - `fileHighlightLanguage` (file-preview-model.mjs) ports g() around r(): base name (wh), then lockfile (lowercased), then exact name, then compound `.a.b` (component.ts → angular-ts, blade.php, vine.ts), then the last extension, else 'text'. A 'text' result retries the lowercased name, which is g()'s own retry, so 'X.PY' / 'name.TS' still resolve. `sh` is now `zsh` and `.h` is `objective-cpp`, as in the original. Consumers are unchanged (viewer, use-diff-hunk, source-file-tool).
- Files viewer preview (cd2efac6e jo :2576-4674):
  - `filePreviewKind`: zt/Bt plus the qo order; the sandbox arm is not ported. Markdown and CSV/TSV open as a preview by default. `en`: a file opened at a line (lineMark) starts on its source. The hn reset applies when the preview kind, the line or the request nonce changes.
  - The subheader toggle comes after the breadcrumb (Jo actions): a ghost icon-only `source-icon-button` with a CDS tooltip, labelled "View source" (Code) or "Preview" (Eye), shown when Ti !== null (not binary, not media).
  - Markdown: the PREVIEW scroller "flex-1 min-h-0 overflow-y-auto [contain:strict] [scrollbar-gutter:stable_both-edges] select-text p-lg" (it keeps `.source-file-preview`, so suites that wait on its text still work), then `mx-auto max-w-[860px]`, then `.epitaxy-file-prose` around the response renderer. FilePane hands SourceMarkdown in as `renderMarkdown`, which avoids an import cycle. The epitaxy-file-prose heading scale (c19e90103 CSS) is ported in source-file-viewer.css.
  - CSV: EpitaxyCsvPreview, with its parser p() ported as `parseCsvPreview`: delimiter sniff, header detection, 1 MiB / 500 rows / 64 columns / 300-unit cells, the unclosed-quote trim, and a small RFC 4180 reader standing in for csv-parse. Also ported: the truncation caption (`csvTruncationCaption`), the focusable "Table preview" region, and the empty / unparsable Un copy.
  - Media: `electron/files.cjs` classifies the je/ye lists (png jpg jpeg gif bmp webp avif; mp4 webm mov m4v ogv; mp3 m4a aac wav flac opus ogg oga) by name and size, without reading. It returns `{path, kind, size, unavailable: kind}`, and `force` still reads the bytes. NUL text is still 'binary'. The viewer renders `<img>` (alt = base name, object-contain), `<video>` or `<audio>` from `filePreviewUrl(fullPath)`. On an error it shows the original Un copy ("Couldn’t load this file" plus the image or media body) with "View as text anyway". The new helpers are `fileMediaErrorCopy` and `FILE_MEDIA_KINDS`, and `fileTabReason` returns the media kind.
- Pressed paint, appended to source-session.css: `.source-icon-button[aria-pressed="true"]` (plus `:not(:disabled)` and `:hover:not(:disabled)`) is `--cds-text-accent` on `--cds-bg-accent`.
  - Source: shared-frame :2697 cs, applied to every Button's paint layer, and :2723-2724.
  - Other aria-pressed `.source-icon-button` users, each confirmed as a pressed CDS Button in the original: the popped-out pin (sidebar-support tE `pressed`), the arrange picks (panes-toggle ra `pressed`) and R10's Changes file-list toggle.
  - The `:not(:disabled)` form outranks `.spc-pick`'s transparent pressed background, so picks now paint bg-accent as ra does.
- Plan document (panes-tile-current.js kp/Dp/Op/Mp; panes-toggle-current.js:3262-3272):
  - `state.planDocs[threadId]` holds the newest non-empty `plan` item text, from item/completed and from hydrate (findLast). A page without a plan keeps the document already set.
  - `SourcePlanPane({plan, document, renderMarkdown})`: the 68ch column, then the Dp Prose wrapper (`data-cds=Prose`, font sans, data-size sm, class `prose`) around SourceMarkdown, then the Op Tasks section when todos exist. With only todos, Op shows alone. The comment that said "Codex has no plan document" is replaced. The plan CSS maps the Prose size, leading and heading scale onto the response renderer.
  - `SourcePlanCopyButton` (Mp) is a ghost icon-only Copy → Check, labelled "Copy plan" → "Copied" through `createClipboardFeedback`. It is the Plan pane's leading trailing control, but only while a document exists.
  - The gate is todos OR document in four places: the source-session plan gate, the Plan view row, `/plan` hasPlan, and the popout sync (data `{plan, document}`). PopoutApp keeps the data object.
  - The fixture extends `fixture:plan` with a persisted plan item ('# Plan fixture heading', PLAN_DOCUMENT_BODY). The new `fixture:plan-document` sends that item alone.
- Find bar (sidebar-main.js:20491, :17787-18130):
  - SourceFindBar is mounted once in main.jsx before the keyed SourceTranscript (the `findBarRef` hook is declared next to `transcriptRef`). Scope and reveal are read through `transcriptRef.current` at call time.
  - A new `sessionKey` prop keys the scope observer, replacing `getScope`, which is a fresh closure on every render. On a switch with a query it cancels the pending typing search and reruns `runRef.current(query, 'new')`. The existing `keep` recount follows the history load.
  - The transcript handle keeps `openFind`/`stepFind`, delegating to the `findBarRef` prop, so Edit ▸ Find routing is unchanged. The unmount cleanup still clears the highlights.

### Tests
- Command: `node scripts/generate-highlight-languages.mjs`, then `cmp` of the loaders with the pre-run copy (identical). Unit tests: file-preview-model, file-viewer, files, files-pane-states, source-plan-pane (new), state, transcript-feed-nav, transcript-find-model, file-unavailable-model and render-tdz all pass (76/76, plus a files sync test).
  - file-preview-model:
    - every case in the spec, plus CMakeLists.txt, CODEOWNERS, the lockfiles, 'X.PY', 'DOCKERFILE' and a.b.component.ts → typescript;
    - 345/16 keys, and every value normalizes;
    - the generated header, and no map in the loaders;
    - preview, media and URL helpers;
    - the CSV parser and the captions.
  - file-viewer:
    - README with no line → markdown preview and "View source";
    - line 3 → five numbered rows, row 3 active, "Preview";
    - no renderer → no toggle;
    - CSV and TSV tables, and the unparsable copy;
    - png `<img src="file:///tmp/work/img/photo.png" alt="photo.png">`, video and audio;
    - the media error copy.
  - files: png (2 MiB of NUL), an unreadable mp4 and an mp3 are classified without a read; NUL text stays binary; svg is text; force reads the bytes; the lists match `fileMediaKind`.
  - files-pane-states: the pressed rule, and the ListBullet with `aria-pressed="true"`.
  - source-plan-pane:
    - the heading comes before the Tasks h2;
    - with only a document there are no Tasks; with only todos there is no document; with neither, "No plan yet";
    - Copy plan leads the trailing controls only while a document exists;
    - wiring source checks.
  - state: a plan item sets planDocs (not on item/started); the latest one wins; history replay sets it; a page without a plan keeps it.
  - transcript-feed-nav: SourceFindBar is no longer in source-transcript.jsx. It is mounted before the keyed transcript, closes before it opens, is the only one, declares findBarRef before use and passes the sessionKey/getScope wiring. The transcript delegates openFind/stepFind.
- Unrelated failure, other batch: `composer-env-pickers` "legacy code-ui Popover" expects `Codex {boot?.connected …}` while main.jsx now has `connectionMenuHeader(…)`.
- UI scripts updated, not run (protocol):
  - files-pane:
    - `util.mjs` / `main.go` fixtures assert `[data-code-token]` spans in two or more colours;
    - README preview (h1 22px, 860px column) → View source (rows `# readme\n`, "Preview") → Preview;
    - photo.png naturalWidth/Height 1 with `object-fit: contain` and no toggle;
    - the pressed ListBullet colour and fill equal `--cds-text-accent` / `--cds-bg-accent`, in light and after the dark relaunch.
  - session:
    - a second seeded thread "Second fixture session";
    - ⌘F "inspect" 1/N → switch → 1/1 with the query and the active "Inspect" kept and a single bar; ⌘F, then Escape restores the composer focus and clears the highlights;
    - in the second session there is no Plan row until `fixture:plan-document`; then the pane shows the heading in the 68ch Prose column, no Tasks, and Copy plan.
  - pane-layout: after `fixture:plan`, the document heading comes before Tasks (3 steps), and Copy plan is the first trailing control.

### Deviations
- The Files Markdown column is the original's `max-w-[860px]` (cd2efac6e :4618, Ai), not the 68ch in the batch text; 68ch is the Plan pane's Dp column, and that is where it is used. The Markdown is the local response renderer (its own block rhythm), with the file-prose heading scale and 16px gap ported onto it.
- Media reach the viewer as `unavailable: 'image'|'video'|'audio'` beside `kind`, because FilePane's `loadFile` (source-session.jsx, outside R09's regions) keeps only `{text}` or `{unavailable, size}`. No loadFile edit was needed, and the restore and aria-busy guards treat media as settled. Audio is included because ye covers it.
- Lockfile names (c8a544a8c) are included because g() checks them first. Neither the custom-extension registry `e` nor setCustomExtension is ported (nothing registers locally). The lowercase retry is g()'s own, not a local fallback.
- `filePreviewUrl` is duplicated in file-preview-model.mjs with the same encoding as main.jsx's composer helper. main.jsx keeps its local const, so composer behaviour is untouched.
- Shared-file edits outside the listed regions, all small and targeted:
  - source-session.jsx: the import line, the FilePane `planDocument` prop, the trailing-slot leading (Copy plan) and the viewer mount (`renderMarkdown`). The ListBullet needed no JSX change because it already had `aria-pressed`.
  - main.jsx: the `findBarRef` declaration beside `transcriptRef`, the SourceFindBar import, the FilePanel `planDocument` props (tile and popout) and PopoutApp's `setPlan(event.data)`.
- Not ported:
  - the sandbox rich-text preview;
  - Find in file and Reload file (deferred by the batch; Reload is channel-only anyway);
  - the Plan hint line (wp), because no plan comments exist;
  - Mp's "Open in" menu;
  - the CSV `truncatedUpstream` footnote, because local reads never truncate.
- The tooltip side: the header Copy plan uses side bottom (as GhostButton does). The subheader toggle uses the default side, because the original passes no tooltipSide.

### Remaining gaps
- Not run (protocol): `npm run build`, the suites (files-pane, session, pane-layout, highlight, edit-read, changes-pane, diff, user-markdown, sidebar-rest) and the live DeepSeek Plan-mode smoke with the isolated DSH_HOME. The script changes are syntax-checked only (`node --check`).
- In the Files viewer: no Find in file (⌘F stays the transcript bar), no Reload file and no sandbox preview. A forced "View as text anyway" Markdown file still offers the preview (qo's forceText is not tracked).
- `spc-pick` now paints bg-accent through the new rule. source-pane-controls.css:44-48 still states `background: transparent` and could drop it.

## R10 — Changes pane: Changed files column, ⇧⌘Y routing, large-diff auto-collapse

### Changes
- **Model** `app/src/diff-file-list-model.mjs` (new, pure):
  - Kind rules ported exactly from panes-diff-view-current.js: di/fi (:2577-2586), wa/Ta/Ea/Da/Oa/ka (:3916-3962). The order is generated, then build, then test, then source.
  - Path order from Mn/Pn (:472-501) and tmp-shared-20 jT/MT (numeric collator). Tree order puts folders first; list order puts files first; "… " sorts last.
  - Aa/Ma folder tree with single-folder chains joined, and the ja flat list.
  - `diffFileList` builds the separated Test/Build/Generated sections (Ba).
  - `diffFileEntries` is the Mn inclusion filter: file sections with a path, each once, with null counts for parser fallbacks. `orderDiffSections` puts the body in list order.
  - Qe (`isLargeDiff`: additions + deletions > 5000).
  - Selection: La `revealCollapsed`, Ia `kindSectionOpen`/`openKindSections`, Ga `treeRowTarget`.
  - cf3dc7910 width {240, 160, 640}: clamp, limit, and the 400px So fit (unmeasured counts as fitting).
- **SourceDiff** (`source-diff.jsx`), Changes placement only:
  - FileDiff takes `defaultExpanded` (vo defaultCollapsed) and a `reveal` request: a row selection expands that file.
  - A large diff mounts every file collapsed, shows the muted banner `shrink-0 px-md py-1.25 text-body text-muted` above the scroller (:5589-5597) and reports `onIsLargeChange`.
  - With a `fileList` prop, `ChangesFileLayout` renders [column | edge | main (banner + `.source-changes` scroller)] (:5530-5590):
    - The column is `relative shrink-0 flex flex-col min-h-0 border-r` with the stored width and min/max `min(160|640px, 100% - 160px)`.
    - The tree is role=tree "Changed files". Rows are c621b1e2d buttons (treeitem, aria-level, indent 8 + 8·depth, CaretRight folders, kind icon + name or flat path + footnote counts, aria-current). Kind sections are separated by `mt-1 border-t pt-1` with a count.
    - Ga keyboard and Wa focus behavior are ported. ⌘-click opens the file (T).
    - Handles reuse the Files tree `.source-tree-divider`/`.source-tree-edge` and use-pointer-resize.js:
      - "Resize file list" handle: drag below 80px hides the column at the end of the drag (display none during the drag); double-click resets to 240; arrows, Home/End, Enter/Space work as on the Files divider.
      - "Show files" edge: a click, a drag past 80px, or Enter/Space/→ shows the column.
      - Focus hands off between the two handles.
    - Body width is measured and `onCanFitChange` is reported (uh).
  - The copy failure text is now the catalog wording "Couldn’t copy to the clipboard. Try again." (ugO0/irMRD).
- **source-diff.css**:
  - Layout rules for the column.
  - c621b1e2d rows restated unlayered, because style.css's `button` reset (background, padding, font, color) beats the layered utilities.
  - Resize shield (cursor and user-select).
  - R08's line ~69 is untouched.
- **FilePane** (`source-session.jsx`, Changes parts only):
  - New `diffTree`/`onDiffTreeChange` props, read through `useViewState`: controlled from the tile store, local in popouts.
  - `diffCanFitTree` and `diffIsLarge` state.
  - `diffListAvailable` is the uh rule: Changes tab, not failed, loading or a patch, and fits.
  - The ⇧⌘Y toggle registers into `treeToggleRef` for the Changes tab.
  - The header ghost ListBullet "Show files"/"Hide files" (`source-icon-button -ml-[4px]`, aria-pressed, Meta+Shift+Y, SourceTooltip top/start with the ⇧⌘Y keycap) sits before `diffScopeControl` (dh :3640-3690).
  - The menu passes `isLarge` and the `fileList` group.
  - The body is `<Diff fileList onIsLargeChange>`; SourceDiff now owns `.source-changes`.
- **changes-menu-model.mjs**: a leading [diff-file-list] section (fh :3740-3779):
  - Show files: keepOpen checkbox with the shortcut, only while it can fit.
  - Group files by folder.
  - Separate test, build, and generated files.
  - `isLarge` disables diff-expand-all with `tooltip`/`disabledReason` "This diff is too large to expand at once. Select a file to expand it."
  - The header comment is rewritten (removed "never disabled" and "Not local: diff-file-list").
- **tile-layout-store.mjs**:
  - `diffShowTree` now defaults to false (panes-state :646-647).
  - New global, persisted `diffTreeWidth` (240, clamped 160..640), `diffFileTree` (true) and `diffGroupByKind` (false).
- **pane-shortcuts.mjs**: `fileListRoute({filesOpen, changesOpen, focused, changesCanShow})` (c936fcd42 ei/$r, code-workspace.js:2230-2241). It returns:
  - files: Files is focused, or Changes is closed;
  - changes: Changes is open and the list can show;
  - open-changes: neither applies;
  - null: Changes is open but the list cannot show.
- **main.jsx**:
  - `diffTreeToggleRef` is declared next to fileTreeToggleRef.
  - The file-list routing uses `fileListRoute`. open-changes calls `openPaneTile("changes")` and sets `diffShowTree` true.
  - The Changes tile gets `treeToggleRef={diffTreeToggleRef}`, `diffTree={tileState}` and `onDiffTreeChange={tileStore.setGlobal}`.

### Tests
- `node --test tests/diff-file-list-model.test.mjs tests/changes-menu-model.test.mjs tests/changes-pane-states.test.mjs tests/pane-shortcuts.test.mjs`: 28/28 pass.
  - New diff-file-list-model tests: the di regex, Da kinds, tree/list order, Aa/Ma, by-kind sections, inclusion filter and body order, Qe, selection helpers, widths.
  - changes-menu: the file-list group comes first and flips; isLarge gives disabled plus tooltip.
  - changes-pane-states SSR:
    - the header ListBullet before the scope trigger, pressed/unpressed, not on empty/failed/plan;
    - the edge, column, tree rows and kind section;
    - flat paths;
    - a 5001-line patch gives all toggles aria-expanded=false plus the banner; 4999 lines stay expanded.
  - pane-shortcuts: fileListRoute cases and the main.jsx wiring.
- Also passing: diff-file-header, files-pane-states, render-tdz, tile-layout-store, shortcuts-dialog-model, tool-cards-f07, source-diff-scope.
  - `tests/files-pane-states.test.mjs` had its main.jsx routing regex updated on purpose.
- `transcript-feed-nav.test.mjs` "wiring … Edit ▸ Find" (`<SourceFindBar`) fails. Another batch is editing source-transcript; this is not R10.
- Offscreen component harness, in the scratchpad (Vite dev server and a show:false Electron window; no build, not a suite):
  - The column shows at 240px with folders first. A README.md row click puts its section at the scroller top (delta 0) and expands it.
  - Keyboard Home/←/→/End work.
  - Dragging +80 stores 320. Dragging below 80 hides the column at the end of the drag.
  - Edge Enter shows the column and focuses the divider; divider Enter hides it and focuses the edge. An edge drag shows the column at 300.
  - The toggle ref toggles the column. Grouping by kind and the flat list render.
  - ⌘-click opens the file.
  - Large patch: the banner shows and every file is collapsed. Selecting a file expands it, in dark too.
  - Under 400px there is no toggle and no edge.
  - No page errors.
- UI scripts:
  - `scripts/changes-pane-ui-test.mjs` (`node --check` OK, not run):
    - the integrity list adds the model file;
    - the menu shape is FULL_MENU (light and dark);
    - new steps: file-list-toggle (button, tooltip ⇧⌘Y, aria-pressed only, column metrics, store), file-list-menu (Show files keepOpen, caps, Group files by folder flat/back), file-list-shortcut (⇧⌘Y on Changes; focused Files takes it; closed Changes opens with the list), file-list-select (two 400-line files, a row click scrolls and expands, aria-current), file-list-width (drag, stored, kept after reopen), large-diff (huge.txt +5001: banner above the scroller, new file collapsed, all collapsed after reopen, Expand all aria-disabled with the reason and tooltip, select expands, cleanup);
    - the dark relaunch asserts the persisted list and width (screenshot changes-file-list-dark);
    - screenshots: light shown, flat, selected, large, large menu.
  - `diff-ui-test.mjs` is unchanged. With the list hidden by default it should not regress, but the body is now in tree order and no test there depends on DOM order.

### Deviations
- Edge handle name. Following the task and the local Files tree, the edge separator is aria-label "Show files". The original sn keeps aria-label "Resize file list" and shows "Show files" as its tooltip. The handles have no CDS tooltip ("Hide files"/"Show files" + ⇧⌘Y + "Drag to resize"), like the local Files divider.
- The keycap shows whenever main.jsx passes a handle. The original uu() hides the Changes keycap while the focused Files pane owns ⇧⌘Y. The Files pane already behaves this way locally.
- Fold state on refresh. As in the original, a large diff folds files at mount: newly appearing files, or everything on a fresh mount. Files already on screen keep their state. The local FileDiff key is offset-based, so remounts happen more often than with the original path key.
- The body follows the column order (Mn/ka) whenever the Changes pane renders, even with the list hidden; this is the original's order. Without `fileList` (approval cards, tests) the patch order is kept.
- Folder and section open state is component state. The original's per-session module Maps (ha/ya) survive remounts.
- The file list, width and grouping state is global in the tile store; the original keeps the width and grouping in separate localStorage keys. A popout has local state with the same defaults; the original uses an epitaxy-popout key.

### Remaining gaps
- Not ported:
  - the lu coachmark (optional);
  - row tooltips (ma) and the row context menu (Qa);
  - comment counts (Za);
  - the commit list under the column (Ln);
  - the PR-comment and annotation scroll targets.
- No offscreen run yet. Run `cd app && npm run build && node work/fidelity-batches/run-suites-parallel.mjs -j 4 changes-pane diff pane-layout files-pane git-band` (scrollbar-mode also touches `.source-changes`).

## Round-3 integration

Integration of R01–R10. This pass was the only editor of the tree. There is no snapshot and no HANDOFF entry, and the package version is unchanged (0.2.130).

### Starting point
- Harness `node --test tests/*.test.mjs`: 125/125.
- App `npm test`: 1616 tests, 1614 pass, 1 known skip, 1 fail. The failure is `tests/composer-env-pickers.test.mjs`, which still expects the old `Codex {boot?.connected …}` menu header. R02 replaced that header on purpose with `connectionMenuHeader(engine, …)`.
- `npm run build`: pass.

### Unit fix (intended change)
- `tests/composer-env-pickers.test.mjs` now asserts `<SourceMenu.Header>{connectionMenuHeader(engine, !!boot?.connected)}</SourceMenu.Header>`. The R02 section above ("Identity") cites the change.

### First offscreen run (28 required suites, -j 4)
- 22 passed.
- 6 failed both in parallel and in the serial retry: sidebar-chrome, settings-rest, settings-complete, skills-mcp, approval-card, composer-states.
- Later runs reached more steps and exposed a few more failures (below). The extra suites the batches named surfaced the sidebar duplicate-dialog bug.

### Product fixes
- **⌘K matched only a lowercase key (`src/shortcuts-dialog-model.mjs` globalShortcutCommand).**
  - Symptom: sidebar-chrome `cmd-k-collapsed` (R01's new step) found the sidebar still collapsed after ⌘K.
  - Cause: the check was `event.key === "k"`. Playwright's `Meta+K` sends key "K" with no Shift, as Caps Lock does.
  - The original matcher (ion-dist shared-7 pB) compares the key case-insensitively and the modifiers exactly.
  - Fix: `(meta || ctrl) && !shift && event.key?.toLowerCase() === "k"`. ⇧⌘K stays search_palette and ⌃⇧K stays unbound.
  - Unit test: `tests/shortcuts-dialog-model.test.mjs` gains a Caps Lock ⌘K assertion.
- **Duplicate retained dialogs (`src/source-sidebar.jsx`, `src/main.jsx`, documented on `useDialogRetention` in `src/source-dialog.jsx`).**
  - Symptom: the sidebar suite failed on a strict-mode violation, with two 'New group' dialogs and two 'Group name' fields. It failed in about half the runs.
  - Diagnosis: a fiber dump showed two `GroupNameDialog#2` under one SourceSidebar.
  - Cause: sibling `useDialogRetention` slots used bare counter keys in one children list, and React matches explicit keys across that whole list. The 'Delete group?' confirm (key 2), still exiting, sat beside the next 'New group' (key 2). R01's new '+' step deletes a session first, which brings the two counters level.
  - Fix: every slot prefixes its key: `group-`, `confirm-`, `bypass-`, `branch-switch-`, `action-`, `whats-new-`, `confirm-delete-`, `rename-`.
  - New guard: `tests/dialog-retention-keys.test.mjs`.
  - Result: sidebar passed 3 of 4 serial repeats. The fourth hit a Vite dependency re-optimize reload right after the build, which is a dev-server warm-up and unrelated.
- **Partial boot before init (`src/main.jsx` event handler).**
  - Symptom: menus-states was LOAD twice. Either the busy model trigger never showed, or the trigger read `aria-busy` with 'Default model', disabled and no spinner.
  - Cause: the `account-auth`, `account-snapshot` and `connection` updaters spread a null boot. main.cjs emits the account snapshot as soon as the account refresh settles, while `connect()` still waits for `model/list`. The spread turned `boot === null` (the catalog-loading state) into a partial boot with no models. The bug predates Round 3.
  - Fix: these updaters now apply only to an existing boot (`b && …`). `init` already returns the fresher account, auth and connection state.
  - New guard: `tests/boot-events.test.mjs`.
  - A temporary 10 s catalog hold in menus-states was reverted to the original 6 s.

### Cross-batch cleanups named in the reports
- R08 → R07: `.spc-open-plan` loses its dead `cursor: pointer`. The global `[data-cds="TextLink"]` link exception supplies the pointer. The `tests/cursor-policy.test.mjs` allowlist entry is removed.
- R09 → pane controls: `.spc-pick[aria-pressed="true"]` loses `background: transparent`, which R09's pressed-Button rule in source-session.css always overrode. The comment there is updated.

### Script fixes (product behaviour judged correct)
- **settings-rest and settings-complete, `settled()` (R03).**
  - `getAnimations({subtree:true})` includes the nav's `scroll-fade-y` ScrollTimeline animations, which stay 'running' forever.
  - Only document-timeline animations must now finish.
- **skills-mcp, question receipt (R06).** The first pair's border reads `0px solid`, not `0px none`. The loaded CDS preflight gives every element `border-style: solid`, as the original's Tailwind base does.
- **approval-card (R07):**
  - The plan footer wraps. Its four buttons need 489px; the 480px card has 456px of content. Rse's `flex-wrap justify-between [&>div]:grow` footer would wrap the same way. `split` now checks that the left group sits at the start edge and the justify-end accept group ends at the end edge. Screenshots `approval-card-plan-{dark,light}.png` and `approval-card-plan-feedback-light.png` now exist.
  - After Settings › Close, `#root` stays inert through the dialog's exit, as Base UI keeps outside elements marked until unmount. `fill()` therefore never reached the composer. The script now waits for Settings to detach.
  - The transparent Other button lies behind its textarea, so its centre is not a pointer target. The script uses keyboard Space, as approval-transport's `chooseOther` already does.
- **composer-states §19 (R05).**
  - Session A keeps the fixture's section-13 'disconnect' turn. The fixture exits mid-turn and persists that turn as inProgress.
  - After the reload, A therefore resumes busy, and Enter sent `turn/steer` (expectedTurnId turn-114) instead of `turn/start`.
  - The draft-persistence step now uses session E, which has only completed turns.
- **settings-complete, MCP removal failure.** It now expects R03's catalog copy 'Couldn’t remove local-fixture.' (K5b1jjmNX7) instead of the raw fixture reason.
- **titlebar, What's new geometry (LOAD).**
  - It measured 509.6 = 520 × 0.98, the starting scale: `getAnimations()` is empty while `data-starting-style` is set.
  - It now waits for `data-open` and two frames before awaiting the animations.

### Load flakes (passed in the serial retry)
- Run 2: menus-states (root cause fixed above), titlebar (hardened above), and composer-states `swapSnapshot` :822, which passed in every later run.

### Final results
- Harness: 125/125.
- App `npm test`: 1618 tests, 1617 pass, 1 skip, 0 fail. That is two new guard tests plus one new assertion.
- `npm run build`: pass, sourceSha256 `c66d444c1efd27aa…`, 505 sources.
- Offscreen on that build:
  - All 28 required suites PASS on the first parallel pass, with no retries.
  - They ran in one 45-suite run (-j 4, 150 s) with the 17 suites the implementer reports also named: sidebar-rest, sidebar, shutdown, usage, account-lifecycle, connection-lifecycle, code, bypass-permission, background-tasks, turn-footer, user-actions, code-fence, rich-copy, git, subagents, highlight, scrollbar-mode. All 45 passed.
  - The other 15 suites also PASS: turn-timestamps, response-math, stream-highlight, workflows, pane, file-search, transcript-fade, ui029 (alone), protocol-0155, transcript-scroll, integration-race, workflow-package, highlight-coalescing, git-rail, file-search-shutdown.
  - In total, 60/60 suites pass.

### Open items
- Live DeepSeek checks not run in this pass (isolated DSH_HOME): R02 `ACCOUNT=1 … live.mjs r02`, R07 Plan-mode 'Accept and allow edits' → Accept edits, and R09's Plan-mode smoke.
- The fixture core persists a 'disconnect' turn as inProgress. A real core would not resume such a turn as running. Only composer-states touched it, and it now avoids it.
- Implementer gaps stand as logged per batch. The larger ones:
  - R01: the View › Show/Hide Sidebar label reads the stored state while narrow; no narrowViewportMaxWidth.
  - R02: no Learn more links.
  - R03: remaining inline-banner sites; reveal-folder ignores the `openPath` error.
  - R04: Developer › Local MCP servers still reads 'Sign in required'.
  - R05: the other-sessions note and the trust check.
  - R06: the 'Asking …' row shows while its card is pending; no gallery lightbox.
  - R07: no 'More accept options' split.
  - R08: forge chips only in the main transcript; modelSwitchHelps unused.
  - R09: no Find in file or Reload file; main.jsx keeps its own filePreviewUrl.
  - R10: no coachmark, row tooltips, row menus or commit list.
- Native-window acceptance (VoiceOver, IME, trackpad, traffic lights) is unchanged.

### R06 review fixes
- Major (feed article split by hoisted thumbnails): the QO column is now rendered inside the row root, as RN does (approval-current.js:17093, :17302).
  - `SourceStep` (app/src/source-session.jsx) gained an `after` slot, rendered after `.source-step-detail`.
  - `FileToolMessage` (app/src/source-file-tool.jsx) forwards `after`.
  - Both SourceMessage branches (file/read_image and generic MCP/dynamic) pass a plain `<SourceToolImages>` there for standalone rows. Group rows still put the column in the body (FN :17324).
  - `SourceToolImages` lost its `hoisted` variant (`source-message stimg-hoisted`), and the `.stimg-hoisted` CSS rule is gone. No top-level child without `data-transcript-item-id` remains, so describeRows, INTERACTION_ITEM and the turn-footer lookup see one row. No helper change was needed.
- Tests for the major fix:
  - `tests/source-tool-incard.test.mjs` now expects the column as the row root's last child.
  - A new SSR test, 'a standalone MCP row with an image is followed by agent text in the same feed article', splits the markup into top-level rows the way describeRows does. It runs `feedArticles` over user + MCP-with-image + read_image-with-image + agent text, in normal and verbose views, and expects one response article.
  - skills-mcp 'Tool rows': the shot column's parent is the `mcp-shot` row, that row is a direct child of `.source-transcript-content`, and the column is its last child. There is no boundary between that row and `tools-done`, `tools-done` is not role=article and has no feed heading, and the session has exactly 2 articles.
- Minor (receipt ring): `.sqr` uses the outer `box-shadow: 0 0 0 1px var(--cds-border)` (epitaxy-card-outline, design-system.css:56758-56768). The skills-mcp receipt assertion now expects `${border} 0px 0px 0px 1px`, and the checks text says outer ring.
- Minor (stale composer viewer): added a pure `attachmentViewerState(viewer, entries)` in composer-attachments-model.mjs. It keeps the viewer only while its entry is still attached and viewable, using the entry's current preview and name.
  - SourceComposerAttachments renders from it and clears the state during render, before the empty early return. A removed, sent or draft-swapped entry closes the viewer, and a later attachment never reopens it.
  - The unit test is in composer-attachments-model.test.mjs.
- Minor (README): the harness/README.md protocol table now documents:
  - commandExecution `shell` ('bash' or 'powershell' from the tool name; Shell/`$` when absent);
  - read_image `outputImages`;
  - the search action's `tool` (glob → 'found files', grep → 'searched code');
  - MCP `{type:'image', data, mimeType}` blocks;
  - dynamic `inputImage` contentItems.
  A new "工具结果图片" row covers `TOOL_IMAGE_LIMIT` (4 MiB base64, png/jpeg/gif/webp only, '[image]' fallback), and records that Harness image refs are re-read through `ctx.attachments.imageHostPath` on every projection and replay.
- Tests run:
  - App: `node --test` on tool-group-presentation, file-tool-model, generic-tool-model, tool-cards-f07, composer-attachments-model, source-tool-incard and transcript-feed-nav: 74/74.
  - App: render-tdz: 1/1.
  - Harness: projection.test.mjs: 33/33.
  - skills-mcp-ui-test.mjs passes `node --check`.
- Not run, per the parallel protocol: build and suites (skills-mcp, run-command, edit-read, composer-states).

### R05 review fixes
- Major ('Send and stay here' with the worktree on moved Home into the worktree): in `send()` (app/src/main.jsx), the prepare-worktree hand-off is now `if (!stay && sendSequence === loadSeq.current) { setCwd(turnCwd); setWorktree(false); }`. A background launch leaves the Home folder and the Worktree checkbox as they were, so each ⌘⏎ gets its own worktree (cc43287c9 :35140-35200 stayOnDraft keeps qe/Q and useWorktree). Enter still hands Home over as before.
- Major (a sent Home prompt came back as a stale stored prefix):
  - In `send()`, right after `setCurrent(id); currentRef.current = id;` on the !stay path, the stored Home copy is dropped without the text guard (`pendingDraftWrite.current = null; forgetDraft(browserStorage(), HOME_DRAFT_KEY)`). The live draft now belongs to the new session's key, so neither New nor a restart restores an older debounced prefix. A failed turn/start keeps the draft only in the new session.
  - The persist effect's timer now writes only while its own pending entry is still `pendingDraftWrite.current`. A Home timer that fires between setCurrent and the effect cleanup can't write the Home key again, and the switch and unload-flush paths (which already wrote) are not repeated.
  - `clearComposerDraft` no longer runs the matched-path guarded Home forget. The text-guarded forget is kept for the navigated-away (stashed) case through `clearStashedDraft`.
- Minor (branch-switch-check used an any-dirty gate): ported GitStatusService.wouldBranchSwitchConflict (asar index.chunk-Mak6MV2t.js, helpers y/b; porcelain paths from index.chunk-CK46d8Dd.js `i`) into a new pure module, `app/electron/branch-switch.cjs`, which takes an injected git runner:
  - `porcelainEntries` parses `status --porcelain -z`, including rename/copy ORIG_PATH and the unmerged XY set.
  - `pathsOverlap` mirrors b(e,t): a trailing '/' on untracked folders, plus ancestor and descendant matches.
  - `wouldBranchSwitchConflict(entries, target, git)` works as follows:
    - a clean tree → no conflict;
    - an unmerged entry, a target that is missing or starts with '-', or a target unresolvable through refs/heads, then refs/remotes/origin → dirty;
    - otherwise the dirty paths are intersected with `diff --name-only --no-renames -z HEAD <commit>`;
    - any error → the any-dirty gate.
  - `branch-switch-check` (app/electron/main.cjs) uses it with `p.target`, a 30 s timeout and a 16 MiB buffer. `dirty` now means "blocks the switch"; files/additions/deletions still count every entry for the GR body. Without a target it is the old any-dirty gate.
  - `selectBranch` (main.jsx) passes `target`. A dirty but non-conflicting tree records the pick, and the send's `git switch` carries the changes over.
- Tests:
  - New `app/tests/branch-switch.test.mjs`, 4 tests:
    - porcelain parsing, including rename order "XY to\0from\0" (checked against real git);
    - overlap cases;
    - conflict decisions over a fake runner, including fallbacks;
    - a real temp repo where untracked and other-file changes don't block a switch to `zeta` but a dirty README.md does.
  - composer-states:
    - The fixture's zeta-topic branch now commits its own README.md, so §17b's dirty README still opens GR under the refined gate.
    - §17b types 'fixture:complete on', waits until that prefix is stored under composer-draft:epitaxy-draft, inserts ' feature login' and presses Enter at once. After New it asserts the editor is empty and the key is absent.
    - A new §17b step writes an untracked scratch-notes.txt and picks main: no dialog, the chip says main, and the checkout stays feature/login. It then picks feature/login back and removes the file.
    - A new §17c step checks Worktree and makes two ⌘⏎ launches ('fixture:complete stay worktree one/two'). It expects two thread/start cwds, both distinct and under .code/worktrees, none equal to picker-repo. Home keeps the 'picker-repo' folder chip, the checked box, the zeta-topic checkout and the empty Home placeholder. The step then unchecks Worktree.
- Tests run:
  - `node --test` on composer-keys-model, source-composer-submit, composer-draft-store, branch-picker-model, context-usage-model, composer-env-pickers and branch-switch: 50/50 + 4/4.
  - render-tdz: 1/1.
  - `node --check` passes on electron/main.cjs and scripts/composer-states-ui-test.mjs.
- Not run, per the parallel protocol: build and suites (composer-states, tooltip, git-band, git).
- Remaining gaps:
  - Not ported: the original's trust check (requireTrustedCwd) and its feature gate around wouldBranchSwitchConflict (t.Ly(); when off it uses the any-dirty gate). This is unchanged from R05.
  - The new composer-states steps have not run yet. The §17c worktree step is the first suite to use prepare-worktree. It leaves an untracked `.code/` in picker-repo, which no later step reads.

### R09 review fixes
- Major (Markdown preview had no size guard): ported Ai's Ti pre-pass (cd2efac6e :232-1100 prettier-formatted, with shared-16 Bx/zx) into a new pure module, `app/src/file-markdown-model.mjs`:
  - `markdownFileStats` (Lr: definitions and data-URL image lines are not counted) and `markdownTooSlow` (Ci: chars > 524288, pipes > 5000, longestRun > 262144 or longestLine > 32768).
  - `markdownBlockBoundaries` (Bx over zx's line scanner) and `markdownChunks` (Ar: ≥16384-char chunks cut only at block starts, never before a `---` line; Nr keeps the body whole when definitions, footnotes, ambiguous fences, open raw HTML/comment/math blocks or lazy list/indented-code cases appear).
  - `markdownFilePlan` (Ti with its one-entry cache): chunks only above Si = 49152, and `plain` when any chunk trips Ci (so a 1 MB splittable CHANGELOG is progressive, the same file with a trailing `[x]: url` is plain, as in the original). `markdownChunkHeight` is Vr.
  - Checked by a scratch differential fuzz that evals the original functions from the bundle (20k random documents for Bx/Ar/Lr/Vr, 300 large Ti plans, 30k frontmatter blocks): 0 differences.
- source-file-viewer.jsx `SourceFileMarkdown` now follows the viewer's q === "markdown" arm:
  - `useMarkdownFileBody` is Ei in "progressive" mode: above Si it renders at once only when the plan is plain or its first chunk is ≤ 24576 chars; otherwise `useDeferredValue(text, "")` shows the Zo spinner (SourceLoadingPane "Loading file") until the deferred render.
  - `SourceMarkdownDocument` is Ai: the ji branch (`p[role=note].mb-[16px] text-footnote text-muted` with FILE_VIEWER_LABELS.plainNotice, then a `pre.text-code text-primary whitespace-pre-wrap break-words select-text` with the whole source) when plain; otherwise the frontmatter grid, then one `.epitaxy-file-prose.sfv-prose` body or the chunks.
  - `SourceMarkdownChunks`/`useMountedChunks`/`SourceMarkdownChunk` are Mi/Ni/Pi: the first chunk mounts at once, one more per requestIdleCallback (100 ms timeout, else a 16 ms timer) inside startTransition, the J row (`role=status` "animate-placeholder-reveal flex justify-center py-lg text-muted", 16px spinner, sr-only "Loading file") while chunks remain, and every chunk after the first carries `content-visibility:auto; contain-intrinsic-size:auto <Vr>px`.
  - renderMarkdown is now `(text, chunk)`; the pane's lambda (source-session.jsx Files viewer mount, one line) gives chunk n > 0 the item id `file:<path>#n`, so code-block scope keys stay unique per chunk.
  - Scratch SSR probe of SourceFilePanel with a CHANGELOG-style file (the reviewer's setup): 100 KB 102 ms, 400 KB 98 ms, 1 MB 88 ms to the first chunk (was 530 ms / 1.7 s / 4.9 s); with a trailing reference definition the 1 MB file renders plain in 19 ms.
- Minor (frontmatter): `splitFrontmatter` is Ur with the full Qr YAML-subset reader (plain, quoted with escapes, flow sequences and mappings, block scalars with chomping/indent, `- item` lists joined with ", ", nested mappings shown as their dedented source; an unsupported block still splits the body off with no fields). `SourceFrontmatter` is ki: `dl.grid grid-cols-[max-content_1fr] items-baseline gap-x-[28px] gap-y-md mb-[24px] pb-[20px] border-b border-alpha-2` with `dt.text-footnote text-muted` labels through Oi (`frontmatterLabel`: "allowed-tools" → "Allowed tools") and `dd.text-body text-primary min-w-0 break-words`. SKILL.md now shows Name/Description rows above the `# heading`, with no `<hr>` or setext `<h2>`.
- CSS (source-file-viewer.css, appended): `.sfv-frontmatter` / `> dd` and `.sfv-plain-source` reset UA dl/dd/pre margins (the loaded utilities assume the source preflight); `.sfv-prose.epitaxy-file-prose-chunk` keeps the item gap between chunks (0 on the last), and a chunk that starts with h1/h2/h3 restores the 28/24/20 px heading top margin as the difference from the gap (c19e90103 epitaxy-file-prose-chunk rules). A chunk ending on a heading narrows the gap through the existing negative heading bottom margins.
- Minor (CSV relax_quotes): `readCsv` (file-preview-model.mjs) no longer returns 'rejected'. A closing quote followed by anything but a delimiter or EOL leaves quoting with the quote prepended and itself kept (`"a"b` → `"a"b`), as csv-parse's relaxed CSV_INVALID_CLOSING_QUOTE branch does. Also fixed in passing: skip_empty_lines keeps a line whose one field was quoted (`""` → one empty cell, csv-parse wasQuoting). A scratch fuzz against the bundled csv-parse (c63ad9d34 + c02d6193d p, 50k inputs per EOL style) shows 0 differences for LF, CRLF and CR files.
- Tests:
  - New `tests/file-markdown-model.test.mjs` (6): frontmatter value kinds, unsupported blocks, labels, Lr/Ci limits, Bx/Ar chunks and Nr guards, Ti plans.
  - `tests/file-viewer.test.mjs` (+5): a 600 KB CHANGELOG with a trailing definition renders the plain notice and `<pre>` with no `.source-markdown` and never calls the renderer, and a 40000-char line does too; a 100 KB file renders only chunk 0 plus the J status row; a 60 KB unsplittable file shows the Zo spinner; SKILL.md frontmatter renders the dl grid before `<h1>Demo</h1>` (unsupported YAML: no grid; line 1 still opens numbered source); a source check of the per-chunk item id and the new CSS. The CSV case now expects `"a"b` as a table cell and uses `"a,b` for the parse-error copy.
  - `tests/file-preview-model.test.mjs`: `parseCsvPreview('"a"b,c\n', ',')` now expects the relaxed rows; added mid-field quotes, the quoted-empty line and the remaining error (an unclosed quote with no complete record).
- Tests run: `node --test` on file-markdown-model, file-preview-model, file-viewer, files, files-pane-states, source-plan-pane, state, transcript-feed-nav and transcript-find-model: 84/84; render-tdz: 1/1.
- Not run, per the parallel protocol: build and suites (files-pane, user-markdown).
- Remaining gaps:
  - A large body that Nr keeps whole and Ci does not trip (for example 400 KB with a reference definition) still renders in one deferred pass after the spinner, as the original does. That pass still blocks the renderer for the full render time (about 1.7 s at 400 KB in the reviewer's SSR measurement).
  - CSV files that mix line endings still differ: csv-parse auto-discovers one record delimiter and keeps the others as field text, while the local reader ends a record on any of LF, CRLF or CR.
  - The files-pane suite has no large-file or frontmatter step; coverage is the SSR tests above.

## Round-3 fix re-integration

Re-integration of the R05, R06 and R09 review fixes (see the three "review fixes" sections above). This pass was the only editor of the tree. It changed no product code, tests or scripts: everything passed as delivered. There is no snapshot and no HANDOFF entry, and the package version is unchanged (0.2.130).

### Checks
- Harness `node --test tests/*.test.mjs`: 125/125.
- App `npm test`: 1635 tests, 1634 pass, 1 known skip, 0 fail. Since the Round-3 integration that is +17 tests, from the review batches' new and extended files: branch-switch, file-markdown-model, file-viewer, file-preview-model, source-tool-incard, composer-attachments-model and transcript-feed-nav.
- `npm run build`: pass, sourceSha256 `06e9ecd5e11ed664…`, 507 sources (+2: `src/file-markdown-model.mjs` and `electron/branch-switch.cjs`).
- Spot check of the delivered edits:
  - main.jsx :1876 and :1908-1914 carry the `!stay` hand-off and the unguarded Home-draft forget, and the debounce timer checks its own pending entry (:930).
  - source-session.jsx renders `{after}` inside SourceStep, and no `stimg-hoisted` or `hoisted=` remains in src.

### Offscreen
- The 28 required suites (-j 4, 128 s) all PASS on the first parallel pass, with no retries. This includes every suite the review batches left unrun: skills-mcp, run-command, edit-read, composer-states (including the new §17b scratch-file and §17c ⌘⏎ worktree steps), tooltip, git-band, files-pane and user-markdown.
- `--all` on the same build (60 suites, -j 4, 429 s): 60/60 PASS. That covers `git`, which the R05 fixes named but the required list omits, and the transcript, feed and file suites near the R06/R09 changes: turn-footer, user-actions, subagents, transcript-scroll, file-search, pane and others.
- The parallel logs show no uncaught, TypeError or ReferenceError lines.

### Open items
- Live DeepSeek checks were still not run in this pass (isolated DSH_HOME). These are the ones the Round-3 integration listed (R02 account, R07 Plan-mode Accept edits, R09 Plan-mode smoke), plus a live ⌘⏎ worktree launch for the R05 fix.
- composer-states §17c leaves an untracked `.code/` in the fixture's picker-repo, as R05 noted. No later step reads it, and the suite passed both runs.
- The remaining gaps the review batches logged stand:
  - R05: no requireTrustedCwd trust check or wouldBranchSwitchConflict feature gate.
  - R09: a large Nr-whole body renders in one deferred blocking pass; mixed-EOL CSV still differs; files-pane has no large-file or frontmatter step.
- The Round-3 integration's per-batch gaps and native-window acceptance are unchanged.

## Round-3 final regression

Final regression of R01–R10 plus the R05, R06 and R09 review fixes. This pass was the only editor of the tree. It changed no product code, tests or scripts, because no real regression turned up. There is no snapshot, and the package version is unchanged (0.2.130).

### Checks
- Harness `node --test tests/*.test.mjs`: 125/125.
- App `npm test`: 1635 tests, 1634 pass, 1 known skip, 0 fail.
- `npm run build`: pass. Version 0.2.130, sourceSha256 `06e9ecd5e11ed664…`, 507 sources. This is byte-for-byte the build from the fix re-integration, so no source has changed since then.

### Offscreen (`run-suites-parallel.mjs -j 4 --all`, both runs on that build)
- Run 1 (291 s): 57 PASS, 3 LOAD, 0 FAIL. The host's load average was 67–88 for the whole run. The causes were mediaanalysisd, spotlightknowledged and fileproviderd, not the suites.
  - sidebar: during launch, Vite logged "Re-optimizing dependencies because vite config has changed" and reloaded, which destroyed the execution context. This is the dev-server warm-up the Round-3 integration already recorded.
  - shutdown: the quit scenario missed its 6 s host-exit bound. The app's own cleanup was on time: the profile's will-quit evidence was written 1.0 s after the last SIGTERM, which is the 1 s grace. The Electron process then took more than 5 s to exit after will-quit.
  - file-search-shutdown: same pattern, it missed the 6 s bound.
- Serial confirmation:
  - sidebar passed 2/2 and file-search-shutdown passed 2/2.
  - shutdown passed 4 of 5. The failed run was the window-close scenario: its elapsed time fell outside 850–5000 ms. The fixture's SIGTERM came at +0 and will-quit at +1.01 s, so the late part was again the host exit.
  - A `-j 3` rerun at load 88 failed file-search-shutdown both times. The cleanup assertion (< 3.5 s) failed with this timeline: quit → will-quit in 11 ms (worker already reaped) → host exit 3.73 s later.
  - Once the load dropped (13–19), `-j 3` passed 3/3, and file-search-shutdown passed 3/3 serially.
- Host-exit timings on the same build:
  - shutdown quit/window-close: 1149/1223 ms before the load spike; 4125/3991 and 4847/2531 ms during it; 1066/1053 ms after it.
  - file-search-shutdown host exit: 38–54 ms after the spike, 3738/4521 ms during it.
  - Verdict: environment, not a product regression. Nothing in app/electron runs after will-quit, and main.cjs/shutdown.cjs are unchanged since the 23:44 run, which passed at about 1.1 s.
- Run 2 (254 s, load about 20–35): 59 PASS, 1 LOAD, 0 FAIL.
  - home-page LOAD: the day-tooltip dots measured 5.88 px instead of 6. That is 6 × 0.98, the `.source-tooltip-popup[data-state="starting"]` scale during the 120 ms entry transition. The script (home-page-ui-test.mjs:356) measures right after `[role=tooltip]` becomes visible.
  - This is a script race of the same kind as the titlebar What's new fix in the Round-3 integration. It passed on the serial retry and was left unedited (no regression).
- Every one of the 60 suites passed in each run, in the pool or on its serial retry. No suite failed both times.

### Live DeepSeek (isolated DSH_HOME = scratchpad/dsh-home)
- `harness/tests/live-smoke.mjs`: exit 0, about 11 min.
  - INIT reports engine deepseek-harness 0.2.0-rc.2 and unsupportedMethods [thread/fork, review/start, thread/revert].
  - NOT FOUND returns -32602 threadNotFound. MODELS lists deepseek-flash* and deepseek-v4-pro.
  - Turn 1 returns CODE_DESKTOP_SMOKE_OK with a Read tool row. Turn 2 creates deepseek-hello.txt.
  - QUEUE runs BRAVO. COMPACT completes. READ shows 5 turns. UNLOAD returns busy -32000 and reopened.
  - PLAN: plan-review Approve → PLAN_OK. ASK → Blue. EXTRA ROOT returns EXTRA_ROOT_OK and touched.
  - SUBAGENT writes sub-smoke.txt. SUBAGENT STOP shows the child interrupted, with message 'Error: subagent run was cancelled' (projection.js passes the failure text through).
  - INPUT: live and replayed parts are text, mention and localImage:store. The model replied "White" for the red PNG. That is model variance, as in restore-batches B11. The text-only model returns -32602.
  - LIVE MODE returns LIVE_OK with one approval after the switch. COLD READ and RESUME report usage after the response.
- `THEME=dark live.mjs r3-dark` (r3-dark-mur5sb2f) and `live.mjs r3-light` (r3-light-mur5tmcq): exit 0, no renderer errors, one window (hidden and offscreen).
  - Both prompts finished: dark in 6.0/5.1 s, light in 8.2/4.1 s.
  - `report.model` reads 'Loading models…', as in every earlier live run. live.mjs only waits until the trigger no longer says 'Default model'.
- Screenshots compared with analysis/pixel-reference/code-home-current.png and batch-20260920/official-conversation.jpg / official-highlight-stream-complete-027-cu.jpg:
  - Matches:
    - the sidebar chrome (toggle, back/forward, chat/code switcher, New/Artifacts/Routines/Customize, Routines ›);
    - the spark greeting and the What's new link;
    - the stats card (Overview/Models, All/30d/7d, six tiles, heat-map, the Little Prince line);
    - the composer environment chips, the pixel mascot and the '+ · Auto … model · Low · ring' footer;
    - the titlebar's laptop glyph, title and folder pill;
    - the right-aligned grey user bubble, category-verb tool rows ('Read ui-smoke.txt ›', 'Found files, read ui-smoke.txt ›' from R06), the code cards with copy buttons, Markdown tables, and the idle spark under the last turn;
    - dark and light both follow the CDS tokens.
  - Expected differences:
    - no name in the greeting, and 'DeepSeek API · API key' instead of the avatar and plan (R02 identity);
    - the model name;
    - no branch/worktree chips (the workspace is not a git repo);
    - no mic/dictation button;
    - only the pane and ⋮ buttons at the titlebar's right, because the terminal pane and preview are deferred;
    - the empty-sidebar 'Sessions you start will show up here' illustration, and the session under 'Other'.
  - Timing artefacts:
    - in dark, 01-home caught the stats card still in its skeleton;
    - the 'Send ↵' tooltip stays because the pointer rests on the send button;
    - a 1-unit (250 vs 251) offscreen band shows in the light sidebar, unchanged from fidelity-temp-muqx49y2.

### Open items
- home-page-ui-test.mjs:356 should wait for the tooltip's `data-state` to leave 'starting' (or for its animations) before it measures the dots. The titlebar What's new step was hardened the same way.
- The Round-3 live checks are still not run: R02 `ACCOUNT=1`, R07 Plan-mode 'Accept and allow edits', the R09 Plan pane, and the R05 live ⌘⏎ worktree.
- Native-window acceptance is unchanged, and so are the per-batch and review gaps listed above.
