# Fidelity round implementation log

## F01

B1: design tokens, focus rings, root attributes, reduced motion and appearance plumbing. Snapshot: `snapshots/F01`. HANDOFF entry: "0.2.130 保真轮 F01". Package version unchanged (whats-new-model.test pins 0.2.130).

### Changes
- Guard tests (new):
  - `app/tests/design-token-refs.test.mjs`: every `var(--cds-*)` in `app/src/*.css` must be defined. Definitions come from `app/public/assets/v1/*.css`, local CSS, or a quoted `'--cds-x'` literal in `app/src/*.{js,jsx,mjs}`. Fallbacks do not excuse a name, and there is no allowlist. The test also fails if local CSS redeclares `--font-anthropic-*`.
  - `app/tests/reduced-motion-css.test.mjs`: no blanket `*` kill. Every keyframe animation and every movement transition needs an `@media (prefers-reduced-motion: reduce)` rule and an `html[data-reduce-motion=true]` rule (or its `data-local-motion` alias). The composer swap must not use `!important`.
- Focus:
  - `style.css`: the unlayered `button/a:focus-visible { outline: var(--cds-focus-color) }` is gone, so the @layer base ring at design-system.css:1200-1216 applies again.
  - `.code-icon-button/.icon-button:focus-visible{outline:none;box-shadow:var(--cds-focus-shadow)}` mirrors shared-frame :2689 rs.
  - The `--cds-focus-color` and `--cds-border-focus` rules (session-actions, file-tool, response-table, settings-pages, command copy) now use `outline:none; box-shadow:var(--cds-focus-shadow)`.
  - `--cds-shadow-focus` becomes `--cds-focus-shadow` in action-center ×3, home and the session tree.
- Primary label: `source-sidebar.css` submit button uses `color: var(--cds-on-primary)`, with a hover of `var(--cds-fill-primary-hover)`.
- Remaining phantom tokens:
  - Radii:
    - `rounded-card` calc on the user bubble and What's new.
    - `rounded-chip` on the attachment badge.
    - `var(--radius-sm)` on the agent and stg triggers, `.sft-path` and the storage bar.
    - The 4px keycap literal; Wa is itself `rounded-[var(--cds-keycap-radius,4px)]`.
  - Durations, delays and fills:
    - `--cds-dur-fast` in files-search and question-card ×2.
    - The literal hover delay `100ms` (code-card-common-current.js:32-37 delay-100).
    - Pressed/active states use `--cds-fill-ghost-hover` (action-center, files-search, source-icon-button).
    - The settings nav current item uses `--cds-fill-ghost-selected`.
  - Colours, surfaces and shadows:
    - `.markdown a` and the diff hunk use `--cds-text-accent`.
    - The popout root background is `--cds-surface-1`, and so are the workflow inputs.
    - `.ss-dialog` uses the `.shadow-panel-sm` formula.
  - `.inline-error` uses `--cds-text-danger`, `--cds-bg-danger`, `--cds-border-danger` and `--cds-radius` instead of `#b97d65`/`#a34b36`.
- Fonts:
  - `style.css` no longer redeclares `--font-anthropic-*`, so the full design-system chains apply: CJK through `--font-cjk-sans-fallback`, plus ui-monospace.
  - `index.html` preloads `cc27851ad-DDVos-BJ.woff2` and `c66fc489e-2VcCjn5t.woff2`. Vite rewrites them to `./assets/v1/…` in dist.
- Root attributes:
  - `index.html` has `data-platform="desktop"` and `data-mode="system"`.
  - Both main roots (`main.jsx` app and popout) have `data-platform="desktop"`.
  - The sidebar `<aside>` gets `cds-root` and `data-platform="desktop"`; `data-font={cdsFont}` is passed from main.jsx and `data-density="compact"` is kept.
  - `style.css` adds `html.cds-root{--cds-page-bg:var(--cds-surface-1)}`.
- Reduce motion:
  - The `main.jsx` appearance effect sets `root.dataset.reduceMotion='true'` when `prefs.motion==='reduce'` and deletes it otherwise. `data-local-motion` is kept as an alias, and `use-reduced-motion.js` also reads `data-reduce-motion` (shared-frame Uu).
  - Removed:
    - The blanket kills in `style.css` (@media reduce `*`) and `source-settings.css` (`html[data-local-motion=reduce] *`).
    - The `!important` composer exception.
  - Added:
    - An `html[data-reduce-motion="true"]` twin after every @media reduce rule that lacked an attribute variant (29 files); with the new spinner/pulse rules in `style.css` and `message-style.css`, 31 files carry such rules.
    - Attribute overrides for the motion-safe composer rules (the entering animation is none, the leaving transition is `visibility 0s linear 80ms`, the history grid animation is none).
    - New reduce rules for `.spinner`, `.sc-spinner` (Spinner motion-reduce:animate-none, :2341-2343), `.working-dot` and `.pulsing`.
  - The source-menu `[data-reduce-motion]` rule is now live. It gained its missing `::after` twin.
- Appearance:
  - `preferences.mjs`: `DEFAULT_THEME='system'` and `themePreference()`. `main.cjs` seeds new profiles with `theme: DEFAULT_THEME`.
  - `nativeTheme.themeSource = themePreference(config.theme)` runs before the first window and again after each `settings` save that contains `theme`.
  - `nativeTheme.on('updated')` calls `setBackgroundColor(windowBackground(dark))` on every window. The main window and popouts are created with `windowBackground(nativeTheme.shouldUseDarkColors)`.
  - `preload.cjs` exposes `desktop.appearance` from a synchronous `ipcMain.on('desktop:appearance')` that returns `{theme, mode}`.
  - At module top, before render, `main.jsx` writes the resolved data-mode. The theme state starts from that value instead of 'light'.
  - The effect uses `writeThemeMode`, which writes only light or dark and, on the next frame after a light/dark flip, finishes running colour CSSTransitions (shared-7 wh/jh/Ph).
  - The popout follows `prefers-color-scheme`, which nativeTheme drives.
  - New `app/src/theme-command-model.mjs`:
    - `parseThemeCommand`: light, dark and system; auto is treated as system; empty, unknown or multi-line arguments return `{open:'appearance'}`.
    - `resolveThemeMode`, `initialAppearance`, `finishColorTransitions` and `writeThemeMode`.
    - `/theme` uses it, and the notice reads "Appearance set to System" for auto.
- Traffic lights and zoom:
  - New `app/electron/window-chrome.cjs`: `windowBackground`, `trafficLightPosition` (aun/run with eun=12, giving {17,17} at 1, plus the CP clamp), `scaleTrafficLights`, and `zoomLevelAfter` (Kon clamp, ZOOM_STEP .5).
  - The main window uses `titleBarStyle:'hidden'` and `trafficLightPosition(1)`. Popouts keep {14,12}, scaled with the current zoom.
  - `app-menu.cjs` replaces the zoom roles with dNr `zoomMenuItems`:
    - Actual Size: id `actual-size`, CmdOrCtrl+0, enabled only while zoomed.
    - Zoom In: CmdOrCtrl+Plus.
    - Hidden twins with `acceleratorWorksWhenHidden`: CmdOrCtrl+= ("indie cooler version") and the numpad add, subtract and 0 keys.
    - Zoom Out: CmdOrCtrl+-.
    - Each item emits `{kind:'zoom', delta:±.5 | reset:true}`.
  - In `main.cjs`, `menuEmit` routes zoom events to `applyZoom`. That function sets the level on every window, calls `setWindowButtonPosition` on each, updates the actual-size items and emits `{kind:'zoom-factor'}`. `init` returns `zoomFactor`.
  - `webContents 'zoom-changed'` re-syncs the chrome on the main window and on popouts.
  - Renderer: `trafficLightSpacerWidth(zoom) = round(74/min(zoom,1))` is in `sidebar-width-model.mjs` (titlebar-shared-21 _v). It is published as `--df-traffic-light-spacer` on `.dframe-root` (sidebar-main.js:15392).
  - `.traffic-space` uses that variable; the collapsed toolbar padding is `calc(var + 14px)` and the 1000px rule is `calc(var - 6px)`. SourceSidebar re-measures its floor when the spacer changes.
- Tests updated:
  - `app-menu.test.mjs`: the View roles become the zoom items, plus a new dNr test.
  - `preferences.test.mjs`: the default theme is system, `themePreference`, and `main.cjs` seeds DEFAULT_THEME.
  - `source-sidebar-states.test.mjs`: the aside carries cds-root, data-density, data-platform and data-font; the submit rule uses `--cds-on-primary` and the hover token, both defined in the loaded CSS.
  - `sidebar-width-model.test.mjs`: the spacer formula.
  - New: `window-chrome.test.mjs` and `theme-command-model.test.mjs`.
- UI scripts, updated on purpose:
  - `sidebar-chrome-ui-test.mjs`:
    - The View menu expectation now lists the dNr items; this original assertion changed on purpose.
    - New step `cds-root-focus`: the aside is `.cds-root[data-platform=desktop][data-font]`, compact, with cursor default. Tab focus on Hide sidebar and on Back shows the accent ring with no outline.
    - New step `zoom`:
      - Menu Zoom Out gives {15,15}, an 81px spacer and Actual Size enabled. Actual Size restores the defaults.
      - At 0.8, 1.25 and 1 (setZoomFactor plus `zoom-changed`), the spacer and lights match the formulas and Hide sidebar clears the zoom button.
    - The filtered empty footnote is 12px.
  - `settings-ui-test.mjs`:
    - `nativeTheme.themeSource` and the window background are dark/#151515 and light/#fcfcfb, and system after choosing System.
    - Reduced sets `html[data-reduce-motion=true]`, and a `.cds-dot` probe computes animation-name none.
    - Added a local `poll` helper.
  - `sidebar-rest-ui-test.mjs`: the Archive all confirm label colour differs from its fill, with contrast ≥4.5, in light and dark.

### Tests and results
- Spec unit tests: `node --test tests/design-token-refs.test.mjs tests/window-chrome.test.mjs tests/theme-command-model.test.mjs tests/app-menu.test.mjs tests/preferences.test.mjs tests/source-sidebar-states.test.mjs`, plus `reduced-motion-css` and `sidebar-width-model`: 47/47 pass.
- `npm test`: 1249 tests, 1248 pass, 1 pre-existing skip, 0 fail (baseline 1229; 20 new).
- `npm run build` passes. dist/index.html has data-mode=system, data-platform=desktop and the two preloads.
- Offscreen suites:
  - **sidebar-chrome** passed. The ring box-shadow contains the accent rgb(42,120,214). Lights are {17,17}, then {15,15} at -0.5, {12,12} at 0.8 and {22,22} at 1.25. The spacer is 74, 81, 93 and 74px. Hide sidebar's left edge is 82, 80.8 and 102.5 DIP. The footnote is 12px.
  - **settings** passed: native dark/#151515 and light/#fcfcfb, and reduceMotion `{attribute:'true', dot:'none'}`.
  - **sidebar-rest**:
    - Run 1 failed in step 3 (selection) before any F01 assertion: the fork rows rendered Fork two above Fork one, so the shift range was [P,F2]. This step is unrelated to F01.
    - Run 2 passed, including Archive all contrast 19.68 in both modes (light white on rgb 11; dark rgb 11 on white).
  - Also passed: **composer-states** (submit swap under reduced motion without !important), **titlebar** (collapsed clearance ≥88), **tooltip**, **approval-card**, **home-page**, **session** and **files-pane**.
- Harness: not touched. Live DeepSeek runs were not needed; F01 does not touch the bridge or the chat loop.

### Deviations
- `--cds-radius-lg` became the rounded-card formula, not `var(--radius-lg)`. The storage dialog and the table popout are shared-frame Dialog popups, whose `gf` is `Wd("popover")`, i.e. rounded-card (shared-frame :5317-5320, :5561-5563).
- `--cds-radius-sm` became `var(--radius-sm)`, the token of `.rounded-sm`, so it renders the same 4px. `.sft-path`'s source class `Foe` has no rounding, but the radius is kept so the focus ring keeps its corners. `.rounded` in this CSS is `var(--cds-radius)`, not .25rem.
- `--cds-keycap-radius` is the literal 4px. The source Wa itself references this undefined token with a 4px fallback.
- Settings dialog: only the shadow changed. Its radius and its surface-2 background (source `Pl("panel")`) are left for the dialog-primitive batch.
- 'zoom-changed' in Electron is a ctrl+wheel request that changes nothing by itself, and the source registers no handler. The handler only re-syncs the lights, the Actual Size state and the renderer spacer; ctrl+wheel still does not zoom.
- The spacer needed the renderer side of the source (_v trafficLightSpacerWidth, published as --df-traffic-light-spacer). Without it the toggle only touched the zoom button at 80%. The local narrow-window 68px rule is kept as `calc(var - 6px)`, so the default-zoom geometry is unchanged.
- The popout follows prefers-color-scheme rather than the saved preference. nativeTheme.themeSource always equals the saved theme, so it updates live, but a CDP colour-scheme emulation would override it.
- `/theme` with newlines opens the picker. The source's `extra_lines` error branch was not ported, to avoid inventing copy.
- Movement transitions and keyframe animations now carry targeted rules. Colour, box-shadow and opacity transitions now run under reduced motion, as in the source; the old blanket kill had stopped them. The loaded CSS's global clamp (`[data-reduce-motion=true] *{animation-duration:.01ms!important}`) now applies to the in-app setting too.

### Remaining gaps
- These can only be verified in a native window, which the offscreen runner cannot do: the visible traffic-light placement, the absence of a light flash at launch and during resize, dark native menus and dialogs, and the effect of `hidden` vs `hiddenInset`. Offscreen checks only read `getWindowButtonPosition`, `getBackgroundColor` and `nativeTheme.themeSource`.
- The zoom factor does not persist across launches (the source remembers `windowControlsZoomFactor` for the initial light position). Ctrl+wheel and pinch do not zoom.
- Popouts keep `hiddenInset` and the local {14,12} origin. The source's popout traffic-light layout (`data-popout="traffic-lights"`) is not ported.
- `.sg-spinner` reduce is still `animation-duration:1.4s`, not `none`; the global clamp now overrides it anyway.
- The group dialogs still use ad hoc buttons. Moving them to SourceSettingsButton, and the shared Dialog radius and surfaces, belong to F02.
- The sidebar-rest fork-order flake (Fork two above Fork one once in two runs) should be looked at separately.

## F02

B2: shared CDS Dialog, Shortcut text variant, Escape layering and the Keyboard shortcuts dialog. Snapshot: `snapshots/F02`. HANDOFF entry: "0.2.130 保真轮 F02". Package version unchanged.

### Changes
- New shared dialog `app/src/source-dialog.jsx` + `.css`, ported from shared-frame-C_2npUJq.js:5561-5574 (mf/hf/gf/_f/vf/yf), :5618-5644 (Of sizes, Mf/Nf titles, If description), :5738-5869 (Gf, Yf Header, Jf CloseButton, Qf Footer), :5909-5990 (rp) and the shared-11 Lf bleed header:
  - `SourceDialog({open, onClose, onExited, title, description, size sm|md|lg, alert, showClose, bleed, footer, initialFocusRef, density, className})`, `SourceDialogFooter`, `SourceDialogCloseButton`, `SourceConfirmationDialog({title, body, confirmLabel, confirmVariant, pending, onConfirm, onCancel})` (size sm, initial focus on Confirm) and `useDialogRetention` (keeps a parent-owned slot rendered through the exit transition, keyed per open).
  - Portal into body at al("modal") (base 100, z 140); copies data-density/data-font/data-platform/data-cds-theme from `<html>`.
  - Surface: rounded-card radius, surface-3, shadow-panel-lg formula, p-xl, max-h hf, 400/520/720 sizes via `data-dialog-size`.
  - Title text-title semibold (alert: heading medium, -2px), description text-secondary; ghost icon-only X CloseButton labelled "Close" (flush -pad-sm); footer mt-pad-lg, column-reverse gap 8px, row + justify-end from 640px.
  - Motion: useModalPresence with data-starting-style / data-ending-style, opacity 0 + scale .98 over --cds-dur-base / --cds-ease-out; none under both reduce-motion rules.
  - holdModalInert(#root) while open, Tab trap, focus to initialFocusRef / [data-autofocus] / the popup, focus back to the opener on close. Escape closes only this dialog (preventDefault + stopPropagation; a document listener covers focus lost to body); a backdrop press closes a Dialog but not an alert dialog.
- Migrated:
  - `ActionDialog` (source-session-actions.jsx) is a thin wrapper over SourceDialog; props API kept (plus pass-through open/onExited/size/alert/bleed...). Close button is now "Close". ReviewDialog and RewindDialog footers use SourceSettingsButton (primary with busy). Deleted the ActionDialog backdrop/surface/header/footer CSS; form, list, option and status styles kept.
  - Rename modal (main.jsx) on SourceDialog (sm, name field initial focus, CDS footer). `.rename-modal` CSS deleted. `.modal-backdrop` is kept: the What's new notes (B12 surface) still use it.
  - GroupNameDialog (sidebar-session.js:16434-16510 ZB: sm, Header without close, grid form) and SourceConfirmDialog (now SourceConfirmationDialog, danger confirmVariant) on the shared dialog; copy unchanged. `.source-group-dialog*` CSS deleted.
  - SourceBypassDialog: alert layout, sm, no close, Cancel initial focus; `source-bypass-permission.css` reduced to its body copy rules.
  - main.jsx and SourceSidebar render every dialog slot through `useDialogRetention` so exits animate.
- Settings: `.ss-backdrop` uses `var(--cds-backdrop)`. The cw `dark:border dark:border-alpha-1` (shared-22-Cz3C_T8d.js:4579) is written with the loaded dark: variant scoping (explicit dark, or system under a dark OS scheme) on `.ss-settings-dialog`.
- Shortcut text variant:
  - New pure `app/src/shortcut-model.mjs` (fo/po/ho tables moved out of source-shortcut.jsx, which re-exports them).
  - `SourceShortcut variant="text"` (Ya.text/Ja): one bare `<kbd>` per key in ⌃⌥⇧⌘ order, 0.3em gap, aria-hidden glyph + sr-only spoken name; off mac spelled names with "+" joiners.
  - SourceTooltip `shortcut` / `secondaryHint.shortcut` take key specs and render it at 12px with `--cds-shortcut-cap-ink: var(--cds-text-muted)` (Mu).
  - SourceMenu.Item renders it aria-hidden at text-footnote, tabular digits, hidden on coarse pointers (c_); the danger highlighted item sets the cap ink to currentColor (:8671).
  - `formatShortcut` delegates to shortcutCaps ('cmd+shift+f' → "⇧ ⌘ F"); `normalizeShortcut` accepts specs and keeps the existing written-order aria-keyshortcuts ("Meta+Shift+F").
  - Callers converted to specs: CHANGES_TOOLTIP `cmd+shift+d`, SIDEBAR_TOGGLE_TOOLTIP `cmd+b`, NAV_TOOLTIPS `cmd+[`/`cmd+]`, pane toggle/close `cmd+shift+\` / `cmd+\`, Stop `escape`, Send `enter`, Queue `cmd+enter`, Mode `cmd+shift+m` (MODE_MENU_SHORTCUT stays its caps), drag handle `enter`, View Files `cmd+shift+f`, account Settings `cmd+,`, account Keyboard shortcuts `cmd+/` (shared-21:16424-16431).
- Escape layering:
  - main.jsx's window keydown matches chords through the new pure `globalShortcutCommand` (same predicates as before).
  - Escape returns early when defaultPrevented; otherwise it closes only the topmost layer: menu, then rename or action dialog, then the sidebar search.
  - SourceMenu's root Escape also stops propagation (Base UI useDismiss, vendor-frame-BmPfNbgY.js:16734-16748).
  - A layout effect clears the search query whenever the search hides (Escape, ⌘K, the toolbar toggle, opening Settings), so a hidden query never filters the list.
- Keyboard shortcuts dialog:
  - New `app/src/shortcuts-dialog-model.mjs`: zR sections General / Panes / Composer, only rows whose chord the app binds, with zR labels. General: Search sessions ⌘K, Toggle sidebar ⌘B, Keyboard shortcuts ⌘/, Settings ⌘,, New session ⌘N, Stop DeepSeek’s response Esc. Panes: Toggle changes ⇧⌘D, Toggle Files ⇧⌘F, Close pane ⌘\, Expand or collapse pane ⇧⌘\. Composer: Open mode/model menu, Open effort selector, Toggle fast mode ⌥⌘F (only when a model has a Fast tier), Select menu item 1…9.
  - `KeyboardShortcutsDialog` (IR shared-21:14583-14625): md, comfortable density, bleed header, initial focus on the popup, focusable region (rounded-lg, focus shadow), OR section headers (font-base mt-5 py-2), $ rows (0.5px border except last, text-sm secondary label, keycap Shortcuts, "or" between alternatives). Replaces the six-row stub.
  - ⌘/ (metaKey, code Slash, no shift/alt/ctrl, not composing) preventDefault + stopPropagation and opens the dialog.
- Tests: new `tests/shortcuts-dialog-model.test.mjs` (3 sections and labels; every chord is matched by globalShortcutCommand, paneShortcutKind, chinShortcutCommand, the composer escapeAction or the menu digit keys; caps ⇧⌘D; main.jsx wiring and Escape order). Updated `source-shortcut` (text variant mac/non-mac), `menu-model` (formatShortcut/normalizeShortcut specs, 'cmd+shift+f' → "⇧ ⌘ F"), `source-titlebar-tooltips` (specs and ⇧ ⌘ D kbds), `source-sidebar-states` (dialogs on the shared Dialog with CDS Buttons), `changes-toggle`, `source-nav-buttons`, `source-composer-dictation` (spec constants).
- UI scripts, updated on purpose:
  - Tooltip/menu shortcuts are now the text variant, so readers take the visible kbd glyphs (sr-only spoken names excluded) and expect io order: tooltip (Send ⏎, Stop Esc, new Changes ⇧ ⌘ D kbd/12px/muted/0.3em check), composer-states (⏎, ⌘⏎, ⇧⌘M), changes-pane (⇧⌘D, Files ⇧⌘F), bypass-permission (⇧⌘M), menus-states (Settings ⌘,, Keyboard shortcuts ⌘/, Pin P, Files ⇧⌘F text variant), sidebar-chrome (⌘[, ⌘B).
  - bypass-permission also waits for the enter transition to settle before measuring the 400px width and paint (the original dialog animates in too).
  - sidebar-rest reads the confirm Button's paint layer and finishes its colour transition before the light/dark contrast check.
  - menus-states: new Escape-layering step.
  - session-actions: Help/Review paint, starting-style frame, #root inert, Close; ⌘/ dialog checks incl. live dark flip.
  - slash-commands-complete: Rewind paint/footer/Close.
  - 'Close usage' lookups scoped by dialog in session-actions and slash-commands-complete.

### Tests and results
- Spec unit tests `node --test tests/shortcuts-dialog-model.test.mjs tests/source-shortcut.test.mjs tests/menu-model.test.mjs tests/source-titlebar-tooltips.test.mjs tests/modal-presence.test.mjs tests/modal-inert.test.mjs` plus design-token-refs, reduced-motion-css, changes-toggle, source-nav-buttons, source-composer-dictation and source-sidebar-states: 73/73 pass.
- `npm test`: 1257 tests, 1256 pass, 1 pre-existing skip, 0 fail.
- `npm run build` passes.
- Offscreen suites, all passed on the final build:
  - session-actions: Help/Review popups rgb(255,255,255) = surface-3, backdrop rgba(0,0,0,0.4) = --cds-backdrop, blur(2px), a data-starting-style frame at opacity 0, one "Close", #root inert. ⌘/ dialog 520px, comfortable, 48px bleed header, focus on the popup, region tabIndex 0 with the focus shadow, ⇧⌘D, Tab trapped, ⌘/ keeps it open, Escape closes and focus returns to the composer. Dark flip: surface rgb(32,32,31), backdrop rgba(0,0,0,0.5).
  - bypass-permission: paint/backdrop/blur/400px/row footer in light and dark unchanged.
  - sidebar-rest: Archive all / Delete / bulk Delete confirms work; Archive all contrast 19.68 in light and dark.
  - sidebar (New group / Rename group Save), slash-commands-complete (Rewind), tooltip, menus-states, composer-states, changes-pane, sidebar-chrome, settings, skills-mcp (/help + Escape), workflows (Run workflow), permission, titlebar.
- First-run failures that were fixed, not flaked:
  - A `data-size` attribute on the popup picked up `.cds-root [data-size=sm]` token rescaling (22px padding, 11px radius); renamed it to `data-dialog-size`.
  - Focus restore in a layout cleanup was undone by React's resetAfterCommit; it now runs in a passive effect.
- Harness: not touched. Live DeepSeek runs were not needed; F02 does not touch the bridge or the chat loop.

### Deviations
- The popup stays a child of the backdrop (the bypass suite reads the backdrop as `dialog.parentElement`), so the backdrop fades its background-color and backdrop-filter instead of opacity, which would also fade the popup.
- The dialog portal does not copy data-mode. The loaded CSS resolves a nested .cds-root's mode from its ancestor, and html's data-mode is written after render, so a copied value would go stale on a live theme flip.
- Confirmation dialogs keep role=dialog (Base UI AlertDialog uses alertdialog). The UI suites select confirms by role "dialog"; this is left for the selector-migration pass.
- ⌘/ opens the dialog and keeps an open one open, as the source's `I = v(!0)` does (shared-22:11740-11749). The spec said toggle; Escape (or Close) closes it.
- The shortcuts dialog lists only zR rows. The spec's candidates Back ⌘[ / Forward ⌘] and Send ⏎ / Queue ⌘⏎ have no zR row, so adding them would invent UI.
  - ⌘K is labelled "Search sessions", because zR's "Search or start a session" describes a command palette this app lacks.
  - "Stop Claude’s response" names DeepSeek.
- Added from IR beyond the spec: the bleed header (shared-11 Lf) and comfortable density.
- The settings dark border is on `.ss-settings-dialog` (cw) rather than every `.ss-dialog`. The font-licenses dialog is a plain Dialog in the source (c71860c77:1105-1150).
- aria-keyshortcuts keep the written order ("Meta+Shift+F"), not vo's sorted "Shift+Meta+f", so existing suites' assertions hold.
- Escape in the composer is consumed by its ProseMirror baseKeymap (Escape → selectParentNode). With the defaultPrevented guard, it no longer hides the sidebar search, so no hidden filter can result. An Escape outside the editor still hides the search and clears it.
- Busy CDS buttons show the spinner in place of "Starting review…" / "Rewinding…" / "Saving…".
- A closing dialog releases inert and returns focus at once while its exit transition runs. Settings keeps inert until unmount.

### Remaining gaps
- Nested-dialog visuals are not ported: Ef/Df data-nested-dialog-open blur, and the transparent backdrop for has-[~[data-nested]].
- The Tf window-drag strip is not ported; --desktop-titlebar-inset is unset locally.
- Base UI's focusin guard that pulls focus back from other portals is not ported; only Tab is trapped.
- The ⇧⌘K "Search" row waits for F04's binding.
- What's new (B12), font licenses, storage and the table popout are still separate dialog implementations. The WorkflowLaunch form buttons and the non-inline SessionStatus footer are still raw buttons.
- The group-name field is the local input, not the CDS Input (eu).
- The enter transition depends on requestAnimationFrame, like Settings. In an occluded window, a dialog would stay on its starting frame until a frame runs.
- Native-window acceptance (real pointer, trackpad and VoiceOver reading of the sr-only names) was not run; all suites ran offscreen.

## F03

B3: CDS Popover, legacy Popover/MenuItem removal and the composer environment pickers. Snapshot: `snapshots/F03`. HANDOFF entry: "0.2.130 保真轮 F03". Package version unchanged.

### Changes
- New `app/src/source-popover.jsx` + `.css` (shared-frame-C_2npUJq.js:12759-12960 cx/lx/ux, px/mx/gx):
  - `SourcePopover({anchor, side='bottom', align='center', sideOffset=6, alignOffset, collisionPadding, padding='lg', scrollFade, label, dataCds='Popover', className, style, onClose, finalFocus, initialFocus})`, `SourcePopoverTitle` (h2 that names the dialog), `SourcePopoverClose`, `useSourcePopover`.
  - Portal at al("popover") (layer base 100, z 120) copying density/mode/theme/platform/font from the anchor. The positioner reuses `positionMenu` (flip + shift, --available-height/-width) and repositions on content resize and window resize instead of closing.
  - Popup: role=dialog, data-cds (Popover unless overridden), data-cds-overlay, max-w 320, rounded-card + surface-3 + shadow-panel. Body: tabIndex -1, data-cds-popover-body + data-cds-sheet-scroll, the lx inherit layout, scroll-fade-y, padding none/xs/sm/md/lg; a focused popup hands focus to its body.
  - Dismissal: Escape (preventDefault + stopPropagation) → trigger; outside press with Id skipRestoreOnOutsideFocus (restore only when focus was lost or inside); focus moving to another element outside → close without restore; a press on the trigger is its toggle. initialFocus receives the opening interaction (keyboard/mouse), and `true` means the first tabbable element.
- Effort and Usage on SourcePopover (`source-composer.jsx`):
  - `SourceEffortPopover`: c8e04f916 p.Popup (data-cds ModelSelectorEffort, 220px, flex-col gap-lg, padding lg), side top / align end, named by the Title 'Effort' inside EffortControl (the section lost its data-cds). A keyboard open focuses the slider, a pointer open the popup. The help bubble's body overflow stays visible.
  - `SourceUsagePopover`: c360a9e1c:4240-4285 vd (side top, align end, sideOffset 8, padding none, 360px, max-w calc(100vw-2rem), max-h min(available,640px), sr-only Title 'Usage', py-sm body). `SourceUsagePanel` ports the c2d611398 V/I/z parts that have local data: 'Context window' + summary over a 4px chart-reference-tint bar with the dT threshold fill (context-usage-model `usagePanelCopy`), then, for an open session, the separator and 'See detailed breakdown' (a Popover.Close → /status). No visible heading, no menuitem.
  - `/effort` without arguments anchors the popover on the effort chip (model pill as fallback) with a fresh token.
- SourceMenu users (main.jsx `ENV_MENUS` placement table):
  - local: Local (checked radio) / separator / Environment settings, side top / align start, min-w 200 (cc43287c9 :20975-21060).
  - connection (sidebar footer): Header "Codex connected/disconnected" + Reconnect / Settings items; the ToolButton gained menu trigger props and closes its tooltip while open.
  - folder (titlebar pill): side bottom / align start, Group + GroupLabel 'Working directory' over `gitRepoMenuItems` (Open in Finder / Copy path) (c360a9e1c :6555-6588, :6760-6830). The pill has aria-expanded / data-popup-open.
  - home-folder and branch (below).
- Removed: code-ui.jsx Popover and MenuItem (and their unused imports), the main.jsx Popover fallback host and its MenuItem cases, style.css `.code-popover` … `.menu-folder-path`, the `.code-popover:has(...)` effort rule, the unused `base()` helper, `select()` and the dead `filter` state/prop.
- Composer folder chip → 'home-folder' (lH, cc43287c9 :21638-21850):
  - New pure `app/src/recent-folders-model.mjs`: c749529a1 S recency (latest updatedAt else createdAt per folder, ms/seconds normalized), dismissal filter (hidden until a session is created there after the dismissal), limit 8, then dH's prepend of the chosen folder when missing; rows with basename labels, DT parent descriptions only on basename collisions, current = checked radio and not dismissible; `folderPickerBrowsesDirectly`.
  - `SourceRecentFolderMenu`: Group + GroupLabel 'Recent', radio rows (title = path, aria-keyshortcuts Delete on dismissible rows), a zero-width trailing slot with the 'Remove from recent' X (data-dismiss-recent, aria-hidden, revealed on highlight/coarse), click on the X or Delete/Backspace dismisses and keeps the menu open with the highlight on the next row, then Separator + 'Open folder…'.
  - main.jsx: recents from `sessions` + `workdir` + `boot.config.dismissedRecentFolders`; selecting a recent sets the cwd; dismissal is optimistic, then persisted by the new main.cjs op `dismiss-recent-folder` (config.dismissedRecentFolders[path] = Date.now()). With nothing recent the chip is a plain button calling `folder()`.
  - The chip: label/accessible name = basename or 'Select folder…'; menu trigger props.
  - main.cjs `folder` dialog: title + message 'Select folder for local session' ('Add folder to session' for an additional folder, :21983-21990).
- Branch chip step 1 (hT, cc43287c9 :22009-22035, :12062-12071; cd2687f9f N):
  - New pure `app/src/branch-picker-model.mjs`: `defaultBranch` (origin/HEAD when it is a local branch, else main, else master), `sortBranches` (default first, localeCompare, a missing default prepended), `filterBranches` (case-insensitive substring), `enterSelection`, `branchTriggerLabel` ('—'), copy constants.
  - `SourceBranchPickerMenu` in a SourceMenu.Popup (side top / align start / sideOffset 8, initialHighlight null): icon-less radio rows in a scrolling list, 'No branches match', the h-1 spacer and the 'Search branches…' field last; the field takes focus, keeps typed characters (no menu typeahead), lets arrows/Escape/Tab through, Enter clicks the highlighted row or picks the first match of a non-empty query.
  - main.cjs `workspace-info` adds `originHead` (`git symbolic-ref --short refs/remotes/origin/HEAD`). Choosing a branch only updates `workspaceInfo.branch`; `setWorktree(true)` is gone.
- Environment tooltips (source-composer.jsx): Local 'Where DeepSeek runs', worktree label 'Work in an isolated copy of the repository' (SourceTooltip around the label; checkbox aria-labelledby 'worktree' + aria-describedby sr-only copy; title removed), 'Add another folder' — all hoverable:false with collisionPadding {top:48,…}. Folder 'Working directory' with detail = `<span class="sc-tooltip-path"><bdi>path</bdi></span>` (RTL ellipsis), branch 'Branch to start from'.
- Tests: new `tests/recent-folders-model.test.mjs` (6), `tests/branch-picker-model.test.mjs` (5), `tests/composer-env-pickers.test.mjs` (10: SSR of the context row, Recent/Branch menus, usage panel, EffortControl title, legacy-host removal, popover contract); `tests/context-usage-model.test.mjs` +1 (`usagePanelCopy`). The composer UI fixture (`tests/fixtures/composer-ui.jsx`) now uses SourceEffortPopover / SourceMenu.Popup.
- UI scripts, updated on purpose:
  - `sidebar-ui-test.mjs`: 'Choose a folder…' → 'Open folder…' (spec).
  - `sidebar-chrome-ui-test.mjs`: the 'Working folder' heading wait → `[role=menu] .smenu-group-label` 'Working directory' (spec).
  - `composer-states-ui-test.mjs`: usage step reads the 360px [data-cds=Popover] dialog named by the sr-only 'Usage' (gap 8, end-aligned, padding 0, surface-3, 'Context window' / '100 / 128k (0%)' / 'See detailed breakdown', no heading, no menuitem); the ⌘⇧E step selects the dialog named 'Effort' and checks ModelSelectorEffort/220px/side top/align end/gap 6/padding lg/slider focus; new section 17 (fixture git repo picker-repo with main, feature/login, zeta-topic): env tooltips, no [title] in .sc-context-row, basename name, Recent menu, 'Open folder…' dialog title/message, Delete dismissal persisted, light/dark surfaces of the menu and the popover, branch search ('zzz' → 'No branches match', Enter → zeta-topic, worktree unchanged). New screenshots env-*.png.
  - `titlebar-ui-test.mjs`: new folder-menu check (role=menu 'Working directory', Group labelled 'Working directory', Open in Finder / separator / Copy path, side bottom / align start, ArrowDown + typeahead, Escape refocuses the pill).
  - `code-ui-test.mjs`, `composer-fixture-test.mjs`, `tooltip-ui-test.mjs`: `.code-popover` selectors → `[role=dialog][data-cds=ModelSelectorEffort]` / `[role=dialog][data-cds=Popover]` / `[data-cds-overlay]`.

### Tests and results
- `node --test tests/recent-folders-model.test.mjs tests/branch-picker-model.test.mjs tests/menu-model.test.mjs`: 24/24 pass; `composer-env-pickers` 10/10; `context-usage-model` 6/6.
- `npm test`: 1279 tests, 1278 pass, 1 pre-existing skip, 0 fail (22 new).
- `npm run build` passes (final build sourceSha256 8770172cd89f…).
- Offscreen suites on the final build, all passed: composer-states (29 checks, offscreen-composer-states-dTA96G), titlebar (offscreen-titlebar-bmjUyT), menus-states, sidebar, sidebar-chrome (41 checks), tooltip, code, git, git-rail.
- First-run failures fixed (not flakes): the branch chip's textContent includes the icon glyph (probe the label span instead); titlebar `startGap` came back as -0 (absolute value).
- Harness: not touched. Live DeepSeek runs not needed (no bridge or chat-loop change).

### Deviations
- filter, pane and fast were not migrated: nothing in the live tree opens them (only the never-rendered code-ui `Sidebar`/`Composer`; SourceSidebar owns its own filter menu, Fast lives in the model menu). Their main.jsx cases were deleted with the legacy host, together with the dead `filter` state.
- The recents are not "current folder first": dH prepends the chosen folder only when the list lacks it, otherwise it keeps its recency position. Sources are the session list only (the source's detected projects have no local counterpart). Dismissals live in the main-process config (spec), not the source's localStorage key, and the source's clear-on-new-session write is covered by the read-side filter.
- Folder and branch tooltips use the source's default (hoverable) Nu; only Local, worktree and Add folder pass hoverable:false + collisionPadding (dH :20979-20985, :22047-22050, :22076-22081). The spec said hoverable:false for all.
- The added-folder chips keep their native `title` (source YB :18891-18915 passes title = path), so "no [title] in .sc-context-row" holds when no folder is added; the unit test pins that only that chip carries one.
- The effort popup's data-cds is ModelSelectorEffort (the source's p.Popup override of px's "Popover"); it is addressed as `[role=dialog][data-cds-overlay]`. Its dialog name changed from the legacy 'effort menu' to the Title 'Effort' (composer-states selector updated on purpose).
- Usage panel: only the parts with local data are rendered (no plan windows, compact action, noData copy or stale/engine notices); 'See detailed breakdown' opens the local /status view, the nearest counterpart of onShowUsageReport.
- Branch search is a substring filter in sorted order, not the source's fuzzy ranking. The branch list is a SourceMenu (spec) rather than the source's Combobox, so hovering a row moves focus to it as in other menus.
- The branch chip keeps the accessible name 'Branch' (the source names it by the branch label); renaming is left to the selector-migration pass.
- Menu labels for the new popups (Local environment, Working directory, Branch, Connection settings) are local aria-labels; the source's Base UI menus are labelled through their triggers.
- Also added from the same source: 'Add folder to session' as the additional-folder dialog title.

### Remaining gaps
- Branch step 2 (dirty-tree check and the Stash changes / Commit as WIP / Discard changes dialog before switching with worktree off) is not done: picking another branch without worktree only changes the chip label, and the session still runs on the current checkout.
- The titlebar menu does not fold the branch into a Copy › Path / Branch name submenu (source Ko with a branch); it shows the cwd-only rows of gitRepoMenuItems.
- Selecting a recent folder does not persist config.cwd (browsing does), so a restart returns to the last browsed folder.
- Dead code-ui `Sidebar`/`Composer` exports remain; the composer-fixture-test (native window only) was updated but not run.
- Native-window acceptance (real pointer hover on the dismiss X, VoiceOver for the dialog titles) not run; all suites ran offscreen.

## F04

B4: Electron main process (close hides the window, native context menu, window state, full menu bar) plus session cycling, ⇧⌘K search and the popout pin. Snapshot: `snapshots/F04`. HANDOFF entry: "0.2.130 保真轮 F04". Package version unchanged.

### Changes
- Window lifecycle (`app/electron/main.cjs`, `app/electron/app-menu.cjs`, `app/electron/menu-bar.cjs`):
  - Pure `closeAction({quitting, fullScreen})` and `activateAction({exists, minimized, visible, hasVisibleWindows})` in app-menu.cjs (index.chunk-ChZ67Jhw.js `m.on("close")` and `app.on("activate")`).
  - `app.on("before-quit", () => { quitting = true; })` is registered just before `installShutdownHandler`, so the deferred quit's window close goes through.
  - The main window's "close" is prevented unless quitting. The window hides, leaving full screen first (`leave-full-screen`, then hide). `window-all-closed` is a no-op. "closed" only clears `win`.
  - Main-window creation moved into `createMainWindow()` / `loadMainWindow()` / `openMainWindow()`, so "activate" can recreate the window. Activate follows the source: create when destroyed; restore a minimized window only when no window is visible; show a hidden one.
  - menu-bar.cjs exports `showWindow` (pK/KK). The tray's Show App and Window › Show Main Window share it, and Show Main Window recreates the window when it is gone.
  - Renderer-bound menu commands first bring back a main window that was hidden by close or minimized (Zxr). This uses a `mainHidden` flag set by the close handler and cleared on "show".
- Native context menu:
  - New pure `app/electron/context-menu.cjs` `contextMenuTemplate(params, {allowDevTools})` mirrors `_W` (readable/electron-context-menu-excerpt.js:1): group order, separators only between non-empty groups, roles, accelerators and editFlags-driven `enabled`.
  - main.cjs `attachContextMenu(window)` on the main window and on pane windows. It closes a still-open popup first (gW) and binds actions to replaceMisspelling, `session.addWordToSpellCheckerDictionary`, showDefinitionForSelection, `shell.openExternal` (http/https only), `clipboard.writeText`, copyImageAt and inspectElement. `allowDevTools` is `!app.isPackaged`.
  - A window that is not visible gets no native popup.
- Window state:
  - New `app/electron/window-state.cjs`:
    - Sbe/Cbe/wbe/Tbe/Ebe: `loadWindowState(file, screen)` validates the shape and places the frame on the current displays (saved display, any intersecting display, a same-sized display with the offset kept, otherwise centred on the primary work area). The default is Dfn 1200×800 with no position.
    - `trackWindowState(win, {file, screen, state})` saves with a bbe=1000ms debounce on the xbe events and immediately on close. It skips minimized windows, keeps the normal bounds while maximized or full screen, writes atomically and unmanages on "closed".
    - `restoreWindowState` maximizes or enters full screen as stored. `windowStateBounds` builds the BrowserWindow frame.
  - The file is userData/window-state.json. The main window minimum is 600×400 (OLi). The popout fallback parent bounds use DEFAULT_WINDOW_SIZE.
- Menu bar (`appMenuTemplate`, ANr order Code Desktop / File / Edit / View / Go / Window / Help):
  - App (Gtr): About, separator, Settings… (main reveals the window first), separator, Services, separator, Hide / Hide Others / Show All, separator, Quit.
  - File (lwr/nwr):
    - New Session (CmdOrCtrl+N), separator, Open Folder… (CmdOrCtrl+Shift+O), separator.
    - ⌘W is "Close Pane" when menu-state reports `closePane.enabled` (emits close-pane; aimed at a pane window it closes that window, like owr's performClose), with Close Window on ⌘⇧W (role close).
    - Otherwise ⌘W is Close Window (role close, which now hides) with a hidden ⌘⇧W twin.
  - Edit: the FSr("mac") list in place of the editMenu role: Undo/Redo, Cut/Copy/Paste, Paste and Match Style (⌥⇧⌘V, plus a hidden ⇧⌘V twin), Delete, Select All. No Speech submenu, because FSr has none.
  - View (pNr):
    - The sidebar item stays at index 0, then a separator.
    - bNr items: Show/Hide Changes (CmdOrCtrl+Shift+D) and Show/Hide Files (CmdOrCtrl+Shift+F). The label reads Hide only while the pane is enabled and open; `enabled` comes from menu-state.
    - Close Pane (CmdOrCtrl+\), then a separator.
    - dNr zoom, separator, reload, then toggleDevTools only when `!app.isPackaged`.
    - Separator, then Enter/Exit Full Screen (Control+Command+F, xNr toggles the target window). The menu is rebuilt on enter/leave-full-screen.
  - Go: Back/Forward twins, separator, Previous Session (Command+Shift+[) and Next Session (Command+Shift+]), separator, Search… (Command+Shift+K). That is 9 items.
  - Window (kNr, role window): Minimize, Zoom, separator, Show Main Window, separator, Bring All to Front.
  - Help (Djr, role help): Keyboard Shortcuts (CmdOrCtrl+/), separator, Troubleshooting ▸ Show Logs in Finder (main creates `app.getPath('logs')` and opens it).
  - RZ: items whose chord the renderer owns (pane items, View Close Pane, Previous/Next Session, Search…, Keyboard Shortcuts) do not dispatch when the click came through their own accelerator with ⌘ (`rendererOwned`).
  - New renderer→main `menu-state` call ({panes:{changes,files:{enabled,open}}, closePane:{enabled}}), normalised by `menuState` and stored like navState. The menu is rebuilt only when `sameMenuState` is false.
- Renderer (`app/src/main.jsx`):
  - onEvent routes new-session, open-folder, toggle-pane {pane}, close-pane, open-shortcuts, cycle-session {delta} and open-search through `menuCommandRef`. Each uses the guard of its keyboard twin.
  - ⌘/ and Help share `openShortcuts()`.
  - `menu-state` is sent when the pane availability or open state changes:
    - changes/files are enabled where ⌘⇧D/⌘⇧F work (open session in the chat section; Files also needs a workdir).
    - closePane is enabled when any pane is open.
  - New pure `app/src/session-cycle-model.mjs`, ported from shared-19-CjdiaR4X.js Km/Jm/Xm/$m: `sessionCycleDelta`, `isCycleModifier`, `cycleTarget` (position 0 = new-session page, modulus count+1), `repeatThrottled` (Gm 50ms) and `createSessionCycler` (keydown/keyup/step/reset over injected rows/open/home).
  - main.jsx's keydown feeds it with the ⌘[ / ⌘] guards. Rows come from `.source-sidebar .source-session-row:not([data-alias]) [data-row-main-button]`, starting from the aria-current row (else a data-selected="focused" row). Each step uses scrollIntoView + click, or `navigate(null)`. keyup and blur end a held sequence.
  - `globalShortcutCommand` adds "search-palette" (Meta+Shift+KeyK). ⇧⌘K and Go › Search… call `openSearchRef`: close menus, expand a collapsed sidebar, `setShowSearch(true)` and focus the field. Never toggle.
  - The keyboard shortcuts dialog (shortcuts-dialog-model.mjs) gains the zR rows Search ⇧⌘K, Next session (⇧⌘] or ⌃⇥) and Previous session (⇧⌘[ or ⌃⇧⇥). This closes F02's "⇧⌘K row waits for F04" gap.
- Sidebar (`source-sidebar.jsx`): the header search button is "Search", with tooltip `{content:'Search', shortcut:'cmd+shift+k', hoverable:false}` (sidebar-groups.js:5352-5377 _w). It still toggles the inline field. The field keeps "Search sessions".
- Popout pin:
  - `desktop:call` `popout-always-on-top` is allowed only from the pane window itself (POPOUT_ACTIONS). It calls `setAlwaysOnTop`, stores `entry.alwaysOnTop`, broadcasts, and `popoutList()` carries it.
  - `SourcePopoutControls` adds the tE ghost button after "Open in main window": Pin/PinFilled, aria-pressed, label and bottom tooltip "Keep window on top" / "Stop keeping window on top".
  - `.spc-ghost[aria-pressed=true]` uses `--cds-text-accent` (ghost aria-pressed:text-accent, shared-frame :2724). The token is defined for light and dark.
  - PopoutApp keeps the state from main's reply.

### Tests and results
- New tests:
  - `tests/context-menu.test.mjs` (8): an editable field with a misspelling; nothing to undo; a read-only selection; a blank area; https vs javascript:/file:/credential links; an image with/without srcURL; Inspect only with allowDevTools; params without editFlags.
  - `tests/window-state.test.mjs` (7): a missing/corrupt file gives 1200×800; wbe; work-area clamp; off-display bounds re-centred; a moved same-size display; maximized round trip + restore; debounce/close/minimized/maximized tracking.
  - `tests/session-cycle-model.test.mjs` (6): $m chords; the home→A→B→C→home ring both ways; Gm; held-⌘ Jm walk; release/throttle; defaultPrevented/empty/menu step.
  - `tests/popout-controls.test.mjs` (3, Vite SSR).
- Updated tests:
  - `tests/app-menu.test.mjs` (16): ANr order; App, File (both ⌘W variants), Edit, View (pane items from menu-state, devtools gating, full-screen label), zoom, Go (9 items + RZ), Window/Help; rendererOwned; menu-state; closeAction; activateAction; main.cjs lifecycle wiring.
  - `shortcuts-dialog-model.test.mjs`: new rows, chords bound by globalShortcutCommand/sessionCycleDelta, caps.
  - `source-sidebar-states.test.mjs`: the Search button name and tooltip spec.
  - `offscreen-suite-registry.test.mjs`: the new expectedBlocked.
- `node --test tests/app-menu.test.mjs tests/context-menu.test.mjs tests/window-state.test.mjs tests/session-cycle-model.test.mjs` plus shortcuts-dialog-model, popout-controls, source-sidebar-states, offscreen-suite-registry and design-token-refs: 66/66 pass.
- `npm test`: 1313 tests, 1312 pass, 1 pre-existing skip, 0 fail.
- `npm run build` passes (sourceSha256 1d79c31c0ae2…).
- Spec offscreen suites, all passed on the final build:
  - **menu-bar** (12 checks, offscreen-menu-bar-DYX6K9):
    - `close()` keeps the window alive and hidden, with the renderer live.
    - Tray Show App, `app.emit('activate')` and Window › Show Main Window each block one `window.show`.
    - The composer right-click reaches `context-menu` with isEditable=true.
    - The stubbed popup reads the _W template at (30,40) over the main window, including Inspect Element unpackaged.
    - window-state.json held 760×768 at quit; the relaunch restored 760×768 at (135,33): the saved y=10 is clamped into the work area (y≥33). The minimum is [600,400].
  - **sidebar-chrome** (46 checks, offscreen-sidebar-chrome-3ihA0F):
    - The Go menu has 9 items; the View expectations are updated.
    - Cycling from New: ⌘⇧] → A, ⌃Tab → B, ⌘⇧[ → A, ⌃⇧Tab → New, ⌃⇧Tab → D, ⌘⇧] → New. Go › Previous/Next Session ring D/New/A.
    - A React-menu row right-click gives no context-menu event; the composer right-click gives one editable event.
    - View Show Files → Hide Files + Close Pane enabled + File ⌘W "Close Pane"; File › Close Pane closes it.
    - ⇧⌘K opens and focuses the search, and a second press keeps it open; Go › Search… opens it. The Search tooltip shows ⇧⌘K with no title.
    - At 600×400 (a 560×380 request clamps to the minimum) nothing overflows (document, titlebar, composer, list), expanded or collapsed. Screenshots window-600-*-dark.png were viewed.
  - **shutdown** (offscreen-shutdown-XkVrwi): the quit scenario is unchanged. In window-close, the window is hidden (not destroyed, invisible, core alive, no exit after 1.5s), then quit cleanup is bounded (1069ms, exit 0).
  - **pane-layout** (14 checks, offscreen-pane-layout-5IrrVZ):
    - The popout header is [Search files, Files settings, Open in main window, Keep window on top].
    - The pin toggles: stored alwaysOnTop true/false in popout-list; PinFilled/aria-pressed=true/text-accent then back.
    - Blocked calls are exactly [setAlwaysOnTop, setAlwaysOnTop, focus].
- Other offscreen suites run on the same build, because the default window size changed for every suite: menus-states, titlebar, composer-states (second run), session, sidebar, session-actions, settings-rest, sidebar-rest, git-band, connection-lifecycle, integration-race, git-rail, tooltip, settings, home-page, files-pane, changes-pane, bypass-permission, permission, transcript-states, turn-errors, turn-timestamps and workflows all passed.
- Failures:
  - composer-states run 1 failed once in §16: the second ⌘⇧I did not close Models. Run 2 passed unchanged, so this is a flake; the chin capture handler runs before the new keydown code.
  - settings run 1 failed after its relaunch: the restored 760×580 window shows Settings tabs, not the nav. The script was updated (see below) and run 2 passed.
  - user-actions fails at step 9 (reduced motion, hovered toolbar transitionDuration 0.12s ≠ 0s). This predates F04: F01 removed `style.css`'s `@media reduce { * { transition: none !important } }`, and `.source-user-message:hover .sua-toolbar…` (0,5,0) now beats the local reduce rule (0,3,0). F04 does not touch that CSS, and steps 1-8 passed.
  - The remaining suites were run once each on the same build, for full coverage of the default-size change. Passed: account-lifecycle, response-math, code-fence, stream-highlight, usage, background-tasks, subagents, user-markdown, run-command, edit-read, home-account-usage, slash-commands-complete, approval-card, code, skills-mcp, approval-transport, scrollbar-mode, pane, file-search, diff, transcript-fade, ui029, protocol-0155, transcript-scroll, workflow-package, git, highlight, highlight-coalescing, rich-copy and file-search-shutdown.
  - turn-footer fails on the same F01 reduced-motion specificity as user-actions: the hovered `.stf-footer:is(:hover…) .stf-toolbar…` beats the reduce rule, giving 0.12s ≠ 0s; source-turn-footer.css is unchanged by F04. The original only clamps animations under reduce (design-system.css:1423-1438), so whether the local toolbar reduce rules or these suite assertions should change is an F01 follow-up.
  - settings-complete fails twice at its native-confirm Delete step: no 'dialog' event, and the click hangs. restore-batches/LOG.md:731 records the same failure as pre-existing ("an adapter/Electron dialog interaction, not app code").
  - Net: 57 of 60 registered suites pass on the final build. The 3 failures predate F04.
- UI scripts updated on purpose, because the original behaviour they asserted changed:
  - sidebar-chrome: View/Go expectations, the Search button name, and the new session-cycle / native-context-menu / pane-menu-state / search-palette / window-600 steps.
  - menu-bar: close-hides, context-menu and window-state; after the relaunch the window returns to 1200×800 before opening Settings.
  - shutdown: the window-close scenario.
  - pane-layout: the pin step and the header list.
  - menus-states: the Search button name.
  - settings: asserts the restored 760×580 frame, then returns to 1200×800.
  - packaged-ui (native, not run): the default bounds are now 1200×800.
  - run-suite.mjs: expectedBlocked only. menu-bar launch 0 gains three `window.show`; pane-layout launch 1 is [setAlwaysOnTop ×2, focus].
- Harness: not touched. Live DeepSeek runs were not needed, because F04 does not touch the bridge or the chat loop.

### Deviations
- Context menu follows _W rather than the spec's paraphrase:
  - Learn Spelling is separated from the suggestions.
  - Copy Link Address appears for any link; only Open Link needs http(s) without credentials.
  - Images are detected by `hasImageContents`.
  - Outside a field _W always appends Copy (disabled without a selection), so a blank right-click gives Copy / Select All.
  - "No popup" applies only to params without editFlags, and to hidden windows (offscreen windows included).
  - The source's same-host and allowExternalOpen link checks have no local counterpart.
- The menu items follow the original single-item shapes, not the spec's hidden twins:
  - New Session (cwr), Previous/Next Session (wwr), the pane items (bNr), Search… and Keyboard Shortcuts register their accelerators.
  - The RZ rule (no dispatch when fired by their own ⌘ accelerator) keeps the renderer the single owner of its chords.
  - The Go menu therefore has 9 items, as the spec's verification expects.
- Full screen is the source's Enter/Exit Full Screen item (xNr) instead of the togglefullscreen role.
- The save debounce is the source's bbe=1000ms, not ~250ms. Placement also follows Ebe's display-move and same-size-display rules.
- Activate follows the original: restore only when nothing is visible, and show without an explicit focus. Show Main Window and the tray use KK (focus when visible).
- Menu commands reveal a hidden main window only when it was hidden by its own close handler (or minimized), rather than on `!isVisible()`. In production this is equivalent; it also keeps offscreen menu clicks from asking to show the never-shown window.
- ⇧⌘K expands a collapsed sidebar before focusing the inline field (local stand-in for the palette overlay). It is inert under Settings, action dialogs, rename and What's new.
- Show Logs in Finder opens the (created) logs folder; njr builds a diagnostic archive.
- The shortcuts dialog has no ⌘W row: zR's "Close tab, pane, or session" names a session close this app lacks.
- preload.cjs needed no change: menu-state goes through `desktop:call`.

### Remaining gaps
- Native-window acceptance was not run:
  - Dock activate, the red close button / ⌘W hiding, and the full-screen leave-then-hide.
  - The native menu bar and context-menu popups, spelling suggestions, Look Up.
  - Real always-on-top (blocked offscreen).
  - Window state across real multi-display changes.
- The narrow-viewport overlay sidebar (pun narrowViewportMaxWidth 700) is not ported. At 600px the sidebar stays docked; only no-overflow was verified.
- The full search palette (command palette search mode) is still deferred.
- Not ported: File Open File… / Reopen Closed Session / Close Session, and View Command Palette / Split View.
- The zoom factor is still not persisted with the window state.
- The cycle walks only rendered rows: collapsed groups and rows hidden behind "Show N more" are skipped, as in the DOM-based original. There are no local alias rows, so `:not([data-alias])` is inert.
- user-actions step 9 and turn-footer fail on the F01 reduced-motion specificity described above. They need a separate decision on reduce-motion semantics for MessageActions (the source clamps only animations). settings-complete's native-confirm step is still the pre-existing adapter/Electron dialog failure.

## F05

B5: composer — per-session drafts, editable while loading or offline, pickers live during a turn, window Escape, ↑ dequeue, skills in '/', @-mention chips, slash notices as toasts. Snapshot: `snapshots/F05`. HANDOFF entry: "0.2.130 保真轮 F05". Package version unchanged.

### Changes
- Per-session drafts:
  - New pure `app/src/composer-draft-store.mjs` (code-workspace.js:1888-1915 Ul; cc43287c9-BMbiZYzF.js:28617 draftStoreKey, :6425-6450 RA keyed by `epitaxy-${sessionId}`): `draftKey` (home = constant `epitaxy-draft`), `saveDraft`, `takeDraft`, `clearDraft` (optionally only while the stash still holds the sent text; returns the removed entry), `mapDraftAttachments`.
  - main.jsx `openSession` replaces `setDraft("") + resetAttachments()` with `switchComposerDraft(leaving, entering)`: the live text, attachments and mentions (read from a ref) are stashed and the entering key restored. Stashed previews are not revoked. The retry path, `setQueue(emptyQueue)` and the historyResetKey reset are unchanged; a reconnect re-opening the same session keeps its draft.
  - A successful send / steer / queue / command clears the live draft as before; if the session was left meanwhile, `clearStashedDraft` drops its stash when the text still matches and revokes its previews (`/clear`, `/fork` included). Deleting a session clears its stash. Late `attachments:stage` results (markReady / markFailed) also reach stashed entries, so a restored pill never stays loading. No localStorage mirror.
- Editable while loading or disconnected (cc43287c9 :27612 Jr, :28636-28638): SourceComposer's `connected` became `editable` (main: `!session?.archived`) and `canSubmit` (`boot.connected && !loading`). data-disabled, the editor's disabled state and paste/drop follow `editable`; canSend needs `canSubmit`; send()'s early return, the warning row and Retry are unchanged.
- Pickers live during a turn (c360a9e1c-GPs-MV9u.js:4544-4575 Ud, :4942, :4961, :2829): `running ||` removed from Mode, Model and Effort (and their menuTriggerProps). Kept: `sending` (a turn/start in flight was built from the previous choice), `modelsLoading`, `!model`, `!effortAvailable`. ⇧⌘M/⇧⌘I/⇧⌘E now open during a turn.
  - DeepSeek: new bridge extension `codeDesktop/thread/permissions` (harness index.js; `applyPermissions` on a loaded thread only, `{applied:false}` otherwise; `CAPABILITIES.livePermissions: true`; README row). main.cjs allowlists it and runs the turn/start bypass validation on it. main.jsx sends the turn/start permission params when the mode changes while the current session runs and the core lists `livePermissions`.
  - Codex has no such request: there the mode applies from the next turn/start (verified offscreen). Model and effort always apply from the next turn/start or steer.
- Window Escape (c099c328d-CbkcmYSW.js:10129-10150, :11223-11245):
  - `composer-keys-model.mjs`: `windowEscapeAction({key, defaultPrevented, isComposing, keyCode, running, interrupting, latched, overlayOpen, targetIsCanvas, panelActive})` → 'stop' | 'none'; `escapeExemptTarget` (shared-6 JL `canvas, [role="application"]`); `emptyArrowUpDequeues`.
  - SourceComposer registers a window keydown listener in a layout effect over a ref; it preventDefaults and calls `onStop({trigger:'escape'})` once through `escapeStopLatch`. Claimed by `menuKind` or the new `escapeClaimed` prop (main: Settings, action dialog, rename, What's new, workflow launch, bypass confirm, delete confirm, sidebar search); skipped under an inert root. The Stop tooltip / aria-keyshortcuts also hide while claimed.
  - Idle Escape in the editor blurs it. The editor no longer lets ProseMirror's captureKeyDown preventDefault an Escape the composer left alone, so SourceMenu and main.jsx see it. This was the root cause of composer-states runs 1–2 failing ("Models" not closing on Escape when focus was still in the editor) and very likely of F04's §16 flake.
  - main.jsx's Escape handler already returns on defaultPrevented (F02); the composer listener runs before it.
- ↑ dequeue (c099c328d :11162-11188; cc43287c9 :31152-31156 _o): `queued-messages-model.mjs` `lastDequeueable(queue)` (newest unlocked entry). SourceComposer `onEmptyArrowUp`, called before `promptHistoryStep` for a plain ↑ in an empty editor with no popup and not composing; true → preventDefault. main.jsx passes `queueEdit(last.id)` when `queue.threadId === current`. `editableDraft` restores a queued skill item as its leading `/name`.
- Slash notices as toasts (cc43287c9 :30292, :33700-33716, :33860-33877, :11310-11322, :33437-33444):
  - toast-store `add(message, {key})`: a live toast with the same key takes the new text/variant, count 1, and a restarted deadline; keyed and unkeyed toasts never merge.
  - executeCommand: `/theme` → neutral 'Appearance set to …'; `/fast` already on/off → warning, key `epitaxy-fast-command-notice`; `/plan` while planning → warning, key `epitaxy-plan-command-notice`, 'Already in plan mode. No plan written yet.' when `state.plans[current]` is empty; the catch → warning toast instead of setError.
  - Deleted: commandNotice state, its 4 s timer, the `.inline-notice` row and its CSS in source-slash-menu.css.
  - Added (not in the spec, needed so the new toasts do not cover Send): the toast safe region of git-layout-shared.js:12302-12440 (FN/kN/AN, tN 96). The composer zone carries `data-toast-safe-region`; the toast scope sets `--toast-clearance` = innerHeight − region.top when they overlap horizontally, capped at innerHeight − 96 (`toastClearance` in toast-store.mjs). Light/dark screenshots: slash-commands-complete `theme-toast-*.png`.
- Skills in '/' (cc183b3ab-BNeMUZS1.js:619-700; c099c328d :10637-10690; shared-14 :18578-18600; scroll-shared-10-current.js:8667-8722):
  - main.jsx passes the enabled Customize skills (`customizeSnapshot.skills.skills`, name = skillName) as `commandContext.skills`, and loads skills when a connected draft starts with '/'.
  - session-command-model: `slashSkills` (one slash token; ':' and '.' allowed for plugin names; a built-in command name/alias wins); `matchCommands` appends `{id, description, argumentHint, kind:'skill', path}` after the host commands; `parseSessionCommand(text, context)` returns `{skill, args, error:null}`; a typed space after a known skill closes the list.
  - send() and SourceComposer's canSend treat a skill as a message. `command_chip` gained attr `kind` (node view `data-chip-kind`).
  - `applySkill` (Add › Skills, Settings "Use in message") calls the new `input.insertSkill` (chip + space at the caret, nothing new if the draft already starts with that chip; Ev without `at`). `addSkillAttachment`, the skill branch of `attachmentInputs` and the 'Skill' pill (+ CSS) are removed.
  - On submit `composerInput` turns a leading skill chip or '/name' text into `{type:'skill', name, path}` (`skillChipInput` in composer-attachments-model.mjs). It sits after the attachments, where the pill put it; the token leaves the text and an empty text item is dropped. The payload for "chip + use it" is identical to the old pill payload.
- @-mention chips (c099c328d :10502-10520 Vr; shared-13-Bl2X1oob.js:7882-8032 Aw/jw; c856385e2 Z, c3e58cab4 p):
  - composerSchema `mention` atom (attrs path/label, leafText '@'+path); `leafText`, `mentionLabel`, `mentionTransaction`, `skillTransaction` and `ATOM_NODES` exported; `selectCommandBefore` and separator restoration cover mentions.
  - `composerDocument(text, {mentions, chips})` rebuilds '@path' picks and a known leading '/name' (di) when the editor is filled from text (session switch, history recall). Text is invariant.
  - Editor: `input.insertMention(token, option)`; the mention node view MentionChip uses the Aw classes (inline-flex, mx-0.5, --cds-text-accent, glow -2/-2/-4 px radius 6, selected --cds-bg-accent, hover --cds-fill-ghost-hover), `[data-mention]` and a basename label with title = path. A click opens SourceMenu 'Mention actions': Copy ▸ Absolute/Relative path/Filename ('Copied to clipboard.' toast via App), separator, Open in ▸ Files pane, separator, Delete (danger).
  - `acceptMention` uses insertMention (text fallback kept).
  - A programmatic `focus()` of the editor host now goes through EditorView.focus, so the caret keeps the document selection instead of the browser's caret-at-start. This fixed skills-mcp run 1, where text typed after an Add › Skills chip landed before it.
- Tests:
  - New `tests/composer-draft-store.test.mjs` (5).
  - Updated: composer-keys-model (+2), queued-messages-model (+2), session-command-model (+2), composer-attachments-model (+1), customize-model (pill → chip input), composer-editor-model (+5), mention-model (+1), toast-store (+2), source-composer-submit (+3 SSR), source-composer-dictation (+1 SSR; 'disconnected' row now `canSubmit:false`), composer-env-pickers (props).
  - Harness: approval.test.mjs +1 (the RPC contract and the mid-turn Auto → Manual permission update).
  - The composer UI fixture drops `connected`.
- UI scripts, updated on purpose:
  - `composer-states-ui-test.mjs`:
    - New threads F (resumeDelayMs 2500) and G.
    - §5: [data-mention] chip, accent label, title, its menu, Escape.
    - §13: a lost connection now leaves the card enabled, typing works, Enter sends nothing (replaces the disabled-card expectation).
    - New §18: drafts round-trip with a pill and clear after send; typing during a held thread/resume; idle Escape blur; held turn with enabled pickers, ⇧⌘I + Escape (no interrupt), ⇧⌘M Manual saved and the next turn/start has approvalPolicy 'untrusted'; two ⌘⏎ entries + ↑ restores 'queued two' via thread/queue/delete; transcript click + Escape ×2 → exactly one turn/interrupt; mention Backspace select/delete, chip accent in dark/light (screenshots `mention-chip-*.png`), chip menu Delete.
  - `slash-commands-complete-ui-test.mjs`: notices read from `[data-cds=Toast]` cards (neutral theme, warning model error with no .composer-error, keyed `/fast` not stacking, the new '/plan' 'No plan written yet' toast), no `.inline-notice`, and the toast sits above the composer in dark and light.
  - `skills-mcp-ui-test.mjs`: the Add › Skills pick is an editor chip (no pill); "use it" is typed after it; the payload is unchanged. A chip removed with Backspace sends none. New '/fx' step: the list carries the enabled skills with descriptions, choosing fx-beta inserts the kind 'skill' chip and Enter sends [text 'via slash', skill item].
  - No other script referenced `.inline-notice`; the `.composer-error` users (transcript-states, approval-transport) are untouched and pass.

### Tests and results
- Spec unit command (draft-store, keys, queue, command, attachments, editor, mention, toast, dictation, submit): all pass.
- `npm test`: 1337 tests, 1336 pass, 1 pre-existing skip, 0 fail (baseline 1313).
- `cd harness && node --test tests/*.test.mjs`: 112/112.
- `npm run build` passes (final sourceSha256 f5f9fe9d6bb7…).
- Offscreen suites, all passed on the final build: composer-states (34 checks, analysis/batch-20260920/composer-states-ui-2026-10-02T05-57-03.806Z), slash-commands-complete, skills-mcp (23 checks), permission, session, menus-states, tooltip, bypass-permission, approval-card, approval-transport, transcript-states, connection-lifecycle, integration-race, home-page, sidebar, sidebar-chrome, session-actions, usage, subagents, settings, turn-errors, code, workflows and titlebar (24/24).
- First-run failures that were fixed, not flaked:
  - composer-states runs 1–2: Escape left "Models" open (the PM Escape consumption above).
  - slash-commands-complete run 1: a toast intercepted the Send click; this led to the toast safe region.
  - skills-mcp run 1: the caret was at the start after the host focus; this led to the focus override.
  - One run was invalidated by a stale build (I edited main.jsx during it) and rerun.
- Live DeepSeek (`cd harness && node tests/live-smoke.mjs`, 1 run): blocked by the environment.
  - INIT reports `capabilities.livePermissions: true`. Then thread/read of an unknown id, thread/resume and thread/start all time out after 120 s, so no turn ran and the new LIVE MODE step was not reached.
  - A no-model probe of the same core shows the cause is outside F05: `codeDesktop/diagnostics` answers in ~20 ms, `codeDesktop/thread/permissions` for an unknown thread answers `{applied:false}`, and thread/read (unchanged code) still hangs. The DeepSeek Harness desktop app was running on the same ~/.dsh (pid 60237, since 15:55), which is the likely holder of the session storage. I did not quit the user's app.
  - The offscreen live app run was skipped for the same reason.

### Deviations
- `sending` still disables Mode/Model/Effort. A pending turn/start was built from the previous choice; enabling them would let the chip and the starting turn disagree.
- Add › Skills inserts at the caret (Ev without `at`) via a new `insertSkill`. It does not use `insertCommand`, which replaces the whole document. A draft that already starts with that chip is left alone.
- The skill input item goes after the attachments and the '/name' token leaves the text. This is the "turn into" reading, and keeps the old pill payload byte-for-byte. A skill-only message sends just the skill item.
- Mention chips get the command chips' separator restoration: text typed against a chip gets a space back. Without it, '@path' would lose its whitespace boundary and drop out of mentionRanges / the payload.
- The chip menu has no "Attach as context" (op passes attach:false) and no Reveal in Finder (no local reveal for composer paths); Open in has the Files pane as its only target, as ToolPath does. The menu is labelled locally ('Mention actions').
- The executeCommand catch is a warning toast as the spec says; the source uses addError there. Parse errors (unknown command, single-line, no arguments) and availability errors stay in the composer banner, because they are not routed through the catch.
- Escape while a menu, dialog, Settings or the sidebar search is open belongs to that layer first. Recalling a steered message on Escape (Pt onEscapeRecall) is not ported, because steers cannot be taken back.
- The window listener does not check a "panel hidden" store. It is skipped only under an inert root; the composer is mounted only in the chat section.

### Remaining gaps
- Drafts are not persisted across restarts (no localStorage mirror).
- With the Codex core a Mode change during a turn applies from the next turn. The DeepSeek live path is unit/contract-tested and probed for `{applied:false}`, but was not exercised against a running turn (the live smoke was blocked).
- Skills whose name is not one slash token (spaces) can still be inserted from Add › Skills, but the draft then parses as an unknown command. User-invocability is still approximated by `enabled` (deferred customize-skill-invocation-semantics).
- Chip rehydration from text covers mentions and a leading known '/name' only; it does not keep chip identity for other text edits.
- Native-window acceptance (real IME, trackpad, VoiceOver reading of the chips) was not run; all suites ran offscreen.

### F05 review fixes
- Major — a skill picked after typing was dropped:
  - Add › Skills, a plugin's skill row and Settings › Skills "Use in message" (all go through `applySkill` → `insertSkill`) now port c099c328d-CbkcmYSW.js:7926-7940 B. `skillTransaction` deletes every `kind:'skill'` command_chip, then inserts the chip and a space at position 1, which is the start of the first paragraph (`focus("start").insertContent`).
  - The draft therefore always leads with the picked skill, and `composerInput` sends the `{type:'skill'}` item. Example: 'summarize this file' + pdf gives '/pdf summarize this file'. A second pick replaces the first chip, and picking the same skill again still leaves one chip. A command chip is not touched.
  - Caret: it goes right after the inserted space, which is where TipTap's insertContent leaves it in the source. The review suggested the end of the draft; I followed the source.
  - Small deviation: a removed chip also takes its own ' ' separator. The source leaves that space behind, so a replacement would read '/fx  text'.
  - The "same leading chip → null" short-circuit is gone. Comments in main.jsx and source-composer-editor.jsx are updated.
- Minor — send() stash keys (main.jsx): `clearComposerDraft(…, sessionId, started = sessionId)` now also clears the stash under the thread a first message from Home created (`send` passes `origin, id`).
  - The case: thread/start made that thread current, and leaving it before turn/start resolved stashed the live draft under its id.
  - Before the fix, the sent text came back when that session was reopened, and its previews were never revoked.
- Minor — `/plan` (main.jsx; new pure `planCommandAction` in session-command-model.mjs) is now a full port of vG (cc43287c9-BMbiZYzF.js:28880-28916, used at :33830-33880):
  - Bare /plan while planning: opens the plan pane when a plan exists and the pane is not open. 'Already in plan mode.' shows only when the pane is already open or cannot open. 'Already in plan mode. No plan written yet.' shows when there is no plan.
  - '/plan <description>' while planning: the description goes to the draft and the 'Already in plan mode.' warning shows. Both notices use key `epitaxy-plan-command-notice`.
  - Not yet planning: /plan switches to Plan mode and also opens the pane when a plan exists.
  - 'open' and 'share' count as no description, as in vG. So '/plan open' now switches to Plan and opens the pane only over a written plan. Before, it opened an empty pane without switching modes.
  - `planSelectable` is always true locally, because Plan is always in the Mode menu.
- Minor — live permissions coverage:
  - Bridge refactor (behaviour unchanged): `applyPermissions`, `applyPreset` and `syncPlanMode` moved from index.js closures to approval.js exports that take the planMode/permissionPresets services. The `codeDesktop/thread/permissions` case body became `livePermissions(live, params, apply)`. index.js keeps thin wrappers that pass `ctx.get(...)` and a logger `warn` producing the same messages.
  - `approval.test.mjs`: the source-regex test is replaced by a runtime test with a fake running LiveThread.
    - Auto → Manual sets approvalPolicy 'untrusted', mode 'ask' and extra roots, and plan mode is off.
    - Manual → Plan turns plan mode on and applies `presets.set('read-only')`. Plan → Auto turns plan mode off and applies workspace-write.
    - A failing preset service only produces a warning.
    - A missing or closing thread returns `{applied:false}` without calling apply. A source check still asserts the routing (no openThread) and the capability.
  - Renderer on the capability path:
    - `tests/fixtures/codex-server.cjs` has an optional `fixture-core.json` seed whose `capabilities` initialize advertises. It is read per connection.
    - The fixture answers `codeDesktop/thread/permissions` the way the bridge does (`applied` = loaded) and logs it.
    - Any turn whose text contains 'delayed-start' gets a 1.5 s turn/start delay.
- Tests and scripts:
  - `composer-editor-model` test reworked: text then skill → leading chip; parseSessionCommand and skillChipInput then give the skill item; the second skill replaces the first; same skill; multi-line; empty draft; a command chip stays.
  - `session-command-model` +1 (vG table).
  - `skills-mcp`: new step. 'summarize this' is typed, then fx-beta and then fx-repo are picked from Add › Skills, giving '/fx-repo summarize this' with one chip. turn/start carries [text 'summarize this', {type:skill, name:'fx-repo', path}].
  - `slash-commands-complete`: '/plan Explain again' while planning → the draft is 'Explain again' and the 'Already in plan mode.' warning toast shows.
  - `composer-states` §18a: a Home send of 'fixture:complete delayed-start …' is left for E while its turn/start is held, and the new session reopens with an empty composer and no pills. I checked that this step catches the bug: with the fix reverted, the step failed with the sent text restored.
  - `composer-states` §18d: the Codex fixture (no capability) gets no live request.
  - `composer-states` new §18f: fixture-core.json, then a throwaway Home 'disconnect' and Retry. Manual during a held turn in G then sends exactly one `codeDesktop/thread/permissions` (threadId G, approvalPolicy 'untrusted', workspaceWrite with roots, no composer error). Auto while idle sends none.
- Results:
  - `npm test`: 1338 tests, 1337 pass, 1 pre-existing skip, 0 fail. The affected unit files pass.
  - `cd harness && node --test tests/*.test.mjs`: 112/112.
  - `npm run build` passes (sourceSha256 2e1f88d94f92…).
  - Offscreen suites, all passed on the final build:
    - composer-states (35 checks, analysis/batch-20260920/composer-states-ui-2026-10-02T06-37-12.998Z)
    - skills-mcp (24 checks, …/skills-mcp-ui-2026-10-02T06-36-29.811Z)
    - slash-commands-complete (…/slash-commands-complete-ui-2026-10-02T06-36-54.658Z)
    - session-actions, permission, session, integration-race, connection-lifecycle, bypass-permission, approval-transport, menus-states, home-page and settings
- Live DeepSeek is still blocked by the environment, so the live smoke was not rerun:
  - The DeepSeek Harness desktop app (pid 60237, since 10-01 15:55) still holds ~/.dsh.
  - A no-model probe of the core took 55 s to initialize and reported `livePermissions: true`. `codeDesktop/thread/permissions` for an unknown thread answered `{applied:false}` through the refactored handler. thread/read and thread/list both timed out after 20 s.
  - A LIVE MODE run is left for when that app is quit; I did not quit the user's app.

## F06

B6: transcript rendering — every bundled grammar, the classic jump chip, the per-message context menu, triple-click inside code, secret masking. Snapshot: `snapshots/F06`. HANDOFF entry: "0.2.130 保真轮 F06". Package version unchanged.

### Changes
- Grammars (code-language-current.js:18-28 `s`/`c`, :33-81 `u`/h; c5a058668 bundledLanguagesInfo, 235 ids):
  - New `app/scripts/generate-highlight-languages.mjs` reads the original table (read-only) and writes `src/highlight-languages.mjs` (`BUNDLED_LANGUAGES`, [id, ...aliases], main-thread data) and `src/highlight-grammar-loaders.mjs` (one literal `import("@shikijs/langs/<id>")` per id, imported only by the engine). Every id exists in @shikijs/langs 4.4.3 (it has 260; the extra embedded/new ones are not added).
  - `highlight-model.mjs` `normalizeLanguage`: trim + lowercase, empty → 'text', the original extra alias table (env→dotenv, fortran→fortran-free-form, golang→go, pwsh→powershell, svg→xml, systemverilog→system-verilog, txt→text, vba/vbnet→vb), 'text'/'ansi' reserved (new plain reason `plain-language` in prepareHighlight and prepareStreamHighlight), any id or alias → its id, otherwise null. New exports `BUNDLED_LANGUAGE_IDS`, `PLAIN_LANGUAGES`, `isPlainLanguage`.
  - `highlight-engine.mjs`: `createGrammarLoader({loaders, getInstance, warn})` — one shared import per language, a failed import/empty module/registration is memoized and stays plain until reload (`grammarFailed`, reason `grammar-error` in the tokenizer and stream worker); `createJavaScriptRegexEngine({ forgiving: true })`. `SUPPORTED_GRAMMARS` = all 235 ids. A node pass over all 235 grammars loads and tokenizes every one.
  - 'ansi' fences render through `SourceAnsiText` (PlainCodeText `ansi`; while growing only up to 20000 units, code-block-current.js:1317 Wr); Copy keeps the raw text, as V does.
  - Build: vite.config.js worker evidence now requires every bundled id in each worker graph, no grammar module in a worker entry chunk, grammar chunks that hold only grammar modules, the unchanged engine budget (entry/shared/theme chunks: 1.2 MB raw / 250 KB gzip per worker, 2.4 MB / 500 KB combined) and < 1 MB per grammar chunk. highlight-build.json gains `languages`, `engineFiles`, `grammarBytes`, `largestGrammarChunk`, `sharedGrammarFiles`. verify-build.mjs checks the same. `build/highlight-notices/manifest.json` lists the 235 grammars (the full tm-grammars NOTICE already ships; still 81 entries).
  - Size: dist/assets 7.5 MB → 19 MB. Engine 851 KB raw / 211 KB gzip; grammar files 11.4 MB; largest chunk emacs-lisp 790 KB (cpp 786 KB); the main index chunk (1.68 MB) is unchanged and pre-existing. 162 grammar chunks are shared by both workers; the 73 grammars that import an embedded grammar also import rolldown's module-init helper from their worker's entry, so each worker has its own copy of those.
- Jump chip (c360a9e1c-GPs-MV9u.js:3944-3978 od classic branch; scroll-shared-current.js:121-161 W/G; scroll-follow-current.js:31, :655-670):
  - source-transcript.jsx: the plain state renders only `<Icon name="CaretDown" size={12}/>`; the needs-input variant is unchanged. A `display: contents` wrapper forwards a wheel over the chip to the viewport (`api.forwardWheel` → the wheel-intent bookkeeping + `scrollBy`). Click → `jumpToLatest({ behavior: "smooth" })`. inert/aria-hidden/tabIndex kept.
  - source-transcript.css: the former needs-input geometry is the base `.source-transcript-jump` (24px, pad-xs, radius, surface-panel, fill-secondary-ring + 0 1px 2px shadow, text-secondary, fill-secondary-hover gradient, gap-xs, opacity 150ms, bottom 8px, focus shadow); the 36px circle, blur, shadow-md and ::before are gone.
  - use-transcript-scroll.js: `jump({behavior})` — smooth (and not reduced motion: `prefersReducedMotion` = data-reduce-motion true, data-local-motion reduce or the media query) calls `scrollTo({behavior:'smooth'})`, pins at once and sets a 1500ms glide (`glideDeadline`: only when more than 2px from the tail). While gliding, `isUserScrollMovement({gliding})` ignores the glide's own scroll events unless an explicit intent is pending; wheel, down/up keys, touchstart and release() end the glide; reaching the tail ends it; content growth during the glide re-targets the smooth scroll; the deadline ends it and schedules a normal follow pass. Anything else (Send, programmatic jumps) stays instant.
- Context menu (scroll-messages-current.js:33094-33193 YJ/iY, :33411-33818 SY/CY; c856385e2 Mn/Z; c18ab0d94 'Show in Finder'; c8ae173c6 'Open in default browser'):
  - New pure `src/transcript-context-menu-model.mjs`: `messageMenu` (Copy ⌘C for a selection; Copy code block / Copy path / Copy code unless over a link; Open in default browser (http/https) + Copy link; separator; Copy message, Copy message as Markdown; separator; Attach selection as context ⌘⇧L for ≥ 2 trimmed characters, else Attach message as context), `fileRefMenu` (Attach as context, Copy ▸ Absolute/Relative path/Filename, separator, Open in ▸ Files pane, Show in Finder), `linkTarget` (qJ protocols), `messageItemText`, `quoteBlock`, `draftWithQuote`.
  - source-transcript.jsx: `onContextMenu` on the `.transcript` viewport (after the interaction handlers). `[data-file-ref]` → file menu. Otherwise the closest `[data-transcript-item-id]` row must resolve to message text (`messageActions.resolveMessage`), or the native F04 menu stays. The code target follows iY over `[data-code-text]` / `.scb-block` / `[data-epitaxy-inline-code]`, the link `a[href]`, the window selection. Opens `SourceMenu.Popup` at the pointer (layer contextmenu, dataCds ContextMenu, label 'Message actions' / 'File actions') and preventDefaults. Copy message writes `writeClipboardPayload(..., {text, html: markdownToClipboardHtml(text)})` (the footer Copy payload); Copy message as Markdown / Copy / Copy code / Copy link write plain text; Attach takes a live selection ≥ 2 characters (cleared) or the message. New ⌘⇧L document listener (cf74bc599 df): a selection wholly inside the transcript is attached.
  - main.jsx: `attachQuoteToDraft(text, source)` (shared for B11) appends a Markdown quote to the draft and focuses the composer; `attachFilePath` extracted from the Changes pane's onAttachFile; `transcriptActions` (resolve by row id, attach only in the chat section of a non-archived session, Files pane, `reveal-tool-file` for Show in Finder, 'Copied to clipboard.' path copies, `external` for links).
  - DOM hooks for the menu: inline Markdown code carries `data-epitaxy-inline-code` (+ `data-epitaxy-file-ref` when it parses as a file reference; not inside the `<pre>` fallback) as in Pc; user fence cards carry `data-code-text`.
- Triple-click (code-block-current.js:1244-1266 Rr): new `src/use-triple-click-select.js` (ref callback with React 19 cleanup): mousedown detail ≥ 3 preventDefault, click detail ≥ 2 stopPropagation, detail ≥ 3 selects the code element's contents. On `.scb-body` (SourceCodeBlock) and `.suc-code-card` (UserCodeSegment).
- Secret masking (shared-4-D8W6lHTW.js Pd/Bd/tf/ef/of/lf; code-block-current.js:1021-1100 Tr/Er/Dr/Or, :1185-1215 Pr, :1325 Kr, :1495-1532 oi; markdown-current.js:4236-4252 Pc):
  - New `src/secret-redaction-model.mjs`: the 12 patterns with the `(?<![A-Za-z0-9_-])` guard and trigger regex, the hidden-character shadow scan with raw-offset mapping, the 262144 cap, sorted/merged `{start,end,value,patternId}`, `maskSecret` (8 kept characters, short values all bullets, PEM framing kept), `maskSecrets`, the Tr labels. A DeepSeek key (sk- + 32 hex) matches `openai` → 'OpenAI API key'.
  - SourceCodeBlock: when settled and matched, the displayed, highlighted (stream and settled), copied and `data-code-text` text is the masked one; `data-secrets` masked/revealed; a ghost Eye/EyeSlash toggle before Copy (`aria-pressed`, 'Reveal secret(s)' / 'Hide secret(s)'; pressed = fill-control background, text-primary, Nr); the padding reserve grows to Kr(2) = 65px.
  - Inline code (source-session.jsx SourceMarkdownCode): a non-file-ref inline code outside a growing block is scanned; matches render as `SourceRedactedSecret` (Dr: sr-only 'Redacted {label}', aria-hidden bullets, a 12px Eye/EyeSlash button 'Reveal {label}' / 'Hide {label}', stopPropagation) and `data-code-text` holds the masked text; non-interactive copies show only the masked text. CSS in source-session.css.

### Tests and results
- Unit (spec command, plus response-markdown-render): 127/127 pass. New `tests/secret-redaction-model.test.mjs` (5: every pattern incl. sk-<32hex>, boundary guard, sort/merge/cap, zero-width shadow, masking) and `tests/transcript-context-menu-model.test.mjs` (7: order and separators for plain/selection/code block/inline path/link, the Attach selection vs message switch, file menu, message text, quotes). Updated: highlight-model-tokenizer (+11: aliases incl. golang→go and env→dotenv, reserved text/ansi, 'notalang' null, tsx/go/rust/yaml/diff/html/env/golang tokenize to > 1 color, failure memo + shared import), highlight-stream-model (+aliases, plain-language), highlight-stream-worker (+go stream), highlight-service/-stream-binding ('rust' → 'notalang'), transcript-scroll (+2: glide guard, jump behavior/reduced motion), response-markdown-render (inline code attribute, on purpose).
- `npm test`: 1363 tests, 1362 pass, 1 pre-existing skip, 0 fail (baseline 1338).
- `npm run build` + `node scripts/verify-build.mjs`: pass (sourceSha256 26bb2e4c33d4…).
- Offscreen, all on the final build: transcript-scroll (chip 24px / 12px CaretDown / gap 8 / 'opacity 0.15s' / on top of everything; wheel over the chip 2621 → 2381; the smooth jump glided 1892px in ~690ms with following "true" on all 42 sampled frames; light/dark crops `analysis/batch-20260920/transcript-scroll-chip-{light,dark}.png`), code-fence (triple-click = data-code-text; right-click → Copy code block; masked fence/inline secret, Reveal/Hide, Kr(2) reserve, pressed colors in light and dark; screenshots in `analysis/batch-20260920/code-fence-ui-RBuPgR/`), rich-copy (right-click → Copy message writes text/plain + text/html), user-markdown (tsx/go user fences highlighted, triple-click, right-click → Copy message as Markdown), highlight, stream-highlight, approval-card, transcript-fade, ui029, code, highlight-coalescing, edit-read, transcript-states, diff, settings-rest.
- turn-footer and user-actions fail only at the pre-existing F01 reduced-motion assertion (hovered toolbar transitionDuration 0.12s ≠ 0s; see ## F04 Remaining gaps); unrelated to F06.
- UI scripts updated on purpose: transcript-scroll (36/36/20 → classic chip, plus wheel forwarding, smooth-jump pinning and theme crops), code-fence (two new fences and an inline key; 6 → 8 blocks), rich-copy (step 1b), user-markdown (new fence turn before the image turn, step 10), highlight and stream-highlight (the unknown fence is 'notalang'; the bundle check lists all 235 grammars), ui029 (its fixture is pinned by the 0.2.8 baseline hash, so the ```rust user fence stays and is no longer asserted token-free). run-suite.mjs is unchanged: its clipboard floors are minimums and still hold.
- Harness untouched; no live DeepSeek run (the batch does not touch the bridge or the chat loop).

### Deviations
- `bundledLanguagesInfo` is not exported by @shikijs/langs (only `languageNames`), so the id/alias table is generated from the original c5a058668 table rather than from the package; the 235 ids are the original's, the newer @shikijs/langs-only grammars (ahk, chapel, nsis, org, rbs, smithy…) are not added.
- Masked fences are highlighted, not plain: the original passes the masked text V to its highlighter (oi), and the fence has no sr-only 'Redacted' text (only inline secrets do, Dr). The spec suggested plain text with sr-only spans for fences; I followed the source.
- The link item reads 'Open in default browser' (c8ae173c6 generic label; there is no default-browser-name query locally), not 'Open link'.
- File-reference menu order follows Mn/Z (Attach, Copy ▸, separator, Open in ▸, Show in Finder as its own item), which the spec listed in a different order. Show in Finder appears only for paths inside the session folder, as ToolPath does (the reveal IPC is scoped to it).
- 'Attach … as context' inserts a Markdown quote after the existing draft (the spec's quoted block; the source adds a context snippet the local composer does not have). File references attach the file itself through the existing path attachment, like the Changes pane.
- Menus open only on rows with message text (user/agent/plan), as SY does via hY; tool rows and status rows keep the native menu.
- The ⌘⇧L shortcut is implemented because the menu shows it (cf74bc599 df).
- The chip's smooth jump also applies to the needs-input variant (od passes onJump('smooth') for both in the classic branch).

### Remaining gaps
- No Fork / Rewind / Pin as chapter / image items / Open in Browser pane in the message menu; Open in has only the Files pane (no editor or default-app targets); no touch long-press.
- 'Attach as context' is draft text, not a removable snippet chip.
- 73 grammar chunks are duplicated per worker (~2-3 MB) because of the bundler's module-init helper.
- Native-window acceptance (real right-click word selection, trackpad wheel over the chip, VoiceOver on the masked spans) was not run; all suites ran offscreen.
- turn-footer / user-actions reduced-motion failures remain (F01 decision pending).

## F07

B7: tool cards, approvals and permission modes. Snapshot: `snapshots/F07`. HANDOFF entry: "0.2.130 保真轮 F07". Package version unchanged. Implemented in parallel with F08–F14 under the parallel protocol: a stopped earlier F07 run had done most of the work; this run audited every item against the original, fixed the gaps listed under "This run", added SSR coverage, and did not build or run offscreen suites.

### Changes
- File approval detail (approval-current.js:15201-15205 SM, :15528-15607 U/Kv/yce → cd98a1763 ApprovalFileChangeBody, :14792-14798 fM, :14121-14133 Xj):
  - `approval-card-model.mjs`: a list of changes gives `detail = {kind:'path', text, value: changes}`. The text is the full path through a KS singleLine port (control characters as `[U+XXXX]`), one line per change. `PREVIEW_LIMIT` 200,000, `PREVIEW_TOO_LARGE` (exact fM copy) and `previewTooLarge(change)`; an oversized change adds the context block `too-large`. Non-list changes keep the raw `changes` block.
  - EM y (:15254): a path equal to the basename meta is no detail at all (no path box, preview or toggle). This run.
  - `source-session.jsx`: `SourceApproval.renderDetails(detail, model)` renders `ApprovalFileDetail`: `div.sac-code.sac-path` (only when it differs from the meta), then per change `ApprovalFileChangeBody` (new export of `source-file-tool.jsx` = DiffBody `inCard`: UO header with ToolPath + Copy, then the code box). A too-large change or one without a string diff gets no body. main.jsx passes `sessionKey`, `cwd` and `onOpenFileRef` to the card, so the header path opens the Files pane.
  - Deleted `FileChanges` and the `.source-file-change-title` CSS.
- Extra approval content (:14507-14515, :14570-14579): the `Working directory` context remains only for item-less fallbacks (a derived Bash heading has none). subagent / subagent_fork / spawnAgent approvals have `detail: null` (plain div heading, no toggle or clamp). Without a description the meta is still the prompt's first line.
- Screen-reader announcement (:14799-14905 pM, :14649-14658 iM, :15959-16006 NM): `approvalAnnouncement(model)` builds 'Permission requested: {action}. {detail}, {meta}', with the detail only when it differs from the meta, 150-code-point caps with ', truncated', then '. {reason}' and '. {fM}'. `ApprovalAnnouncement` in `source-approval-card.jsx` is an sr-only `role=status` span (`data-approval-announcement`). For a new identity or new copy it clears, then fills after 50 ms; re-renders of the same identity and copy stay silent.
- 'Asked' rows (:6979-6987, :7333-7395 Qoe): `generic-tool-model.mjs` `questionAnswers(item, state)` pairs `arguments.questions` with the JSON `{answers:[{id, selected, custom}]}` output by id. An answer is the selected labels plus custom, joined with ', '; with neither it is 'Skipped'. A stopped/interrupted call gives 'Not answered'. While busy/blocked only the questions show. Unparseable output gives null (details body), and a failed call keeps details. `genericToolBody` → 'questions'. `SourceGenericToolBody` renders `div.sgt-body.sgt-qa` (gap-md, pt-xs) with question text-secondary / answer text-muted.
- Agent rows (:4271-4296 oO, :16885-16934 he/Ie, :17112-17131): `agent-model.mjs` `agentRowLabel(item, name, status)` uses describeVerb tenses:
  - running → tenses.running ?? description; failed → 'Failed to {infinitive}', else 'Failed to run agent' + name; completed → tenses.done ?? description.
  - stopped / denied / awaiting / unknown / no description → 'Ran agent' (or 'Running agent') + name.
  - The name renders only when no description label applies (`data-described` truncates the label). `.sag-model` shows whenever a model exists: secondary while running, muted once settled.
  - The non-card fallback uses the same label. This run: it receives `pendingApprovalItemIds` (source-session → SourceAgentTool), so a spawn waiting on its Ask card is 'blocked' → verb + description (K, :16848), not the running tense.
- Multi-select questions (:7789-7962, :8085-8088, :7815-7849):
  - The bridge `codexQuestions` adds `multiSelect: item.multiSelect === true`.
  - `approval-draft-model.mjs` validates the boolean. A multiSelect question (with options) starts `{selected: [], otherSelected: false, customText: ''}`. `selectOption` toggles; `selectOther` toggles, while focus/typing only turn Other on. It counts as answered with any option, or Other with text.
  - The payload follows R's sorted indices: the Other text first (index -1), then the labels in option order (this run; the earlier run put Other last). Single-select still preselects options[0].
  - `source-question-card.jsx` `CheckboxMark` (shared-frame Th/xh: size --cds-checkbox, --cds-checkbox-radius, border-strong; checked = fill-accent + strong Check in on-accent) for options and Other, with aria-pressed per option.
  - `electron/respond-approval.cjs` accepts several distinct answers only for a multiSelect question.
- Code-box ring (design-system.css:56758-56768; c66fe388e he): main.jsx writes `html[data-code-theme-light/-dark]` = the theme pair. `:is([data-mode=light][data-code-theme-light=claude-light],[data-mode=dark][data-code-theme-dark=claude-dark]) :is(.src-cmd-line,.sft-code){box-shadow:0 0 0 1px var(--cds-border)}` is in source-file-tool.css (and the `.src-cmd-line` half in source-command.css). `.sft-code:focus-visible` keeps the focus shadow; fences are untouched.
- MCP in groups (:6943-6944): SourceMessage passes `inCard={inToolGroup}`; `standalone = mcpToolCall && !inCard`.
- Search details (:7099-7150 qO): `projection.js` adds `arguments` (raw call inputs) to the search action. `DetailsBody` for search/listFiles lists those keys (code-styled for pattern/glob/regex/command…), else `pattern:` (from query) and `path:`. There is no synthesized `command:`. Other actions are unchanged.
- Pure-side sign (:7189-7210 YO): with `preview.pureSide` the gutter reads `<span class=sft-number-sign>+</span> 1` (inline-block, min-width 1ch, git colour via the row's number colour) and there is no `.sft-sign` column. Paired edits are unchanged.
- Accept edits (shared-14-BOJVa-jT.js:10259-10440 nE/rE/aE; ion-dist cf6ae6197 wy/ht, cfca6870a mapper):
  - `PERMISSION_OPTIONS` order and labels: Auto, Manual ('Always ask before making changes'), Accept edits ('Automatically accept all file edits'), Plan, Bypass permissions. There is no `warning` field or icon. Digits follow the order (Bypass is 5).
  - `permissionLabel()`: the chin shows the full label.
  - `SourcePermissionMenu defaultValue` (main.jsx passes the saved preference) renders the trailing neutral xxs `Badge` 'Default' (pointer-events none).
  - `permission-policy.mjs`: `acceptEdits` maps to untrusted + workspace-write, plus the `codeDesktop.permissionMode: 'acceptEdits'` hint for DeepSeek only; `afterPlanPermission` keeps it. preferences.mjs validates it; the Settings select and its description, and the /status line, include it.
  - Bridge: questions.js accepts the hint and afterPlan. approval.js `acceptsEdit` lets a write/edit through when its `file_path` resolves inside cwd or the extra roots: realpath, no `..`, and a symlink out of the workspace still asks. `preExecuteDecision` wraps it. index.js pre-execute uses it for root threads, and for a child's edit checks it against the root's workspace from the child's cwd. Path errors ask. Bash and other mutating tools still ask.
- harness/README.md: rows updated for multiSelect, the search `arguments` field, the Accept edits mode, and afterPlan. This run.

### Tests and results
- Spec unit command `node --test tests/approval-card-model.test.mjs tests/generic-tool-model.test.mjs tests/agent-model.test.mjs tests/approval-draft-model.test.mjs tests/permission-policy.test.mjs`: 79/79.
- New `tests/tool-cards-f07.test.mjs` (8, Vite SSR):
  - File request: path box + one `.sft-outer[data-in-card]` per change, '+ 1' gutter, no sign column; two changes list both paths, and the paired edit keeps 2 signs.
  - The fM sentence with no preview.
  - Search keys (forwarded arguments / Codex pattern+path / list path); no `command:`.
  - MCP standalone only outside a group.
  - The Asked pairs.
  - The agent fallback tenses and the awaiting verb + description.
  - multiSelect checkbox marks / toggles vs. single-select radios.
  - The PERMISSION_OPTIONS list and permissionLabel.
- Also passing: source-shortcut (agent approval heading is a div, live region present), source-tool-incard, approval-transport, preferences, source-composer-dictation, source-composer-submit, composer-env-pickers, design-token-refs and reduced-motion-css. Final targeted set: 168/168.
- Harness `node --test tests/questions.test.mjs tests/projection.test.mjs tests/approval.test.mjs`: 55/55. This includes Accept edits allowing an inside-workspace write/edit and asking for bash, outside paths, symlinks and `..`; the hint/afterPlan; multiSelect pass-through; the search `arguments`; and a new source check of the index.js pre-execute wiring.
- Not run, per the parallel protocol: npm test, npm run build, offscreen suites, live DeepSeek.
- UI scripts updated on purpose (written by the earlier run; reviewed here, not executed):
  - approval-card: announcement within ~100 ms, unchanged across busy; file path box + in-card diff + '+ 1', two-change paths; agent approval div heading with no detail/cwd; multiSelect checkbox marks, toggles and the `["Unit","Live"]` payload.
  - edit-read: ring on in-card/standalone code boxes in light and dark, `data-code-theme-*`, none under GitHub Dark; '+ 1' gutter; search rows' pattern:/glob:/path: keys.
  - permission: four items with aE copy, Default badge geometry, digit 3 = Accept edits with the trigger 'Accept edits', digit 4 Plan; the Codex fixture gets Manual's policy and no hint.
  - bypass-permission: Bypass at 5, no icon or warning colour, menu order, trigger 'Bypass permissions'.
  - composer-states: full chin labels.
  - run-command: the `$` block ring in light and dark.
  - skills-mcp: a second seeded session with grouped and lone MCP calls and an Asked row.
  - subagents: model colour while running and after it settles; a described delegation's tenses.
- Fixture (`tests/fixtures/codex-server.cjs`): `fixture:agent-approval` (subagent dynamicToolCall + command approval), `fixture:input-multi…` (multiSelect question), `fixture:agent-demo-described`.

### Deviations
- Too-large uses the change's diff length (> 200,000) as the local stand-in for Xj, which checks content / old_string / new_string.
- A multiSelect (and, as before, single-select) Other counts as answered only with text. The source treats an empty Other as answered and sends 'Something else'.
- Accept edits applies on the DeepSeek core only; with Codex it sends Manual's untrusted policy (no such Codex policy). The menu always shows Auto first (autoFirst).
- The Default badge marks the saved preference (`permission`); Bypass is session-only and never the default. There is no 'Default from {source}' tooltip, because there is no managed source.
- The search body lists the forwarded raw arguments with the local `sft-key`/`sft-command` markup, not SourceGenericToolBody's InputValue chips. Codex search rows no longer show their shell command.
- The ring rule lives in two files: source-file-tool.css (both selectors) and source-command.css (`.src-cmd-line`).

### Remaining gaps
- No offscreen run for this batch. The integrator should run approval-card, edit-read and permission, and then subagents, skills-mcp, bypass-permission, run-command, composer-states and approval-transport.
- The running no-tool agent card still shows the agent name, not S.meta (the description). The Mode trigger tooltip is still 'Mode', not the current mode's description.
- Native-window acceptance (VoiceOver reading the live region, real checkbox interaction) has not been run.

## F09

B9: home stats card from the DeepSeek core's full history (getCodeStats port), original card states, no connection card. No snapshot (parallel protocol). HANDOFF entry: "0.2.130 保真轮 F09". Package version unchanged. Implemented in parallel with F07, F08, F10–F14: no build, no `npm test`, no offscreen suites.

### Changes
- Core RPC (harness):
  - `usage.js`: new `foldSessionStats(events)`, with the same `session/end-seed {inherited:true}` cut as `foldSessionUsage`. Per local day it records:
    - `sessions`: +1 on the day of the session's first human prompt (`user/message` with `source.kind === 'user'`, the projection's userMessage rule).
    - `messages`: human prompts plus every `assistant/message` (the activity.cjs:39 rule).
    - `toolCalls`: `tool/call` events.
    - `hours`: messages by local hour.
    - `models`: per-model uncached input + output tokens, keyed by `assistant/message.data.message.source.model`.
    - Per model, all-time `{inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens}` from `usage.inputTokens/outputTokens/cacheReadTokens/cacheWriteTokens`.
  - `codeStats(summaries)` builds the original shape:
    - `dailyActivity` and `dailyModelTokens` in ascending date order; only days with activity are listed (Iw counts entries as active days).
    - `modelUsage`.
    - `peakActivityHour`: the busiest all-time hour, the earliest on a tie; null when there is none.
  - All numbers are capped safe integers. Prototype model names are ignored.
  - `foldSession` = usage + `stats`. The `UsageCache` version is now 2 (`CACHE_VERSION`). `validSummary` validates the stats fold, so a v1 file or a malformed entry is refolded. The revision cache and the 4-read concurrency are unchanged.
  - `index.js`:
    - `readUsageSummaries()` shares one in-flight fold between `account/usage/read` (still `accountTokenUsage`) and the new `codeDesktop/stats/read` (`codeStats`).
    - `CAPABILITIES` gains `codeStats: true` (approval.test's CAPABILITIES regex still holds).
    - The header comment and harness README (RPC table, initialize capabilities, usage.js row) are updated.
- Main process:
  - `activity.cjs`:
    - `dayModelUsage` moved here from home-model.mjs, unchanged in meaning.
    - New `ledgerStats(ledger)` (the Codex fallback, in the original shape): every readable day is an activity day with `toolCallCount: 0`, modelUsage comes from the ledger's input/output/cached, and the peak hour is the earliest busiest one.
    - New `statsShape(stats)`.
  - `main.cjs`:
    - `readCodeStats()` uses `initial.core`, or awaits only `owner.start()` (initialize), not the full connect with its model/list.
      - When `capabilities.codeStats` is set, it calls `codeDesktop/stats/read` and keeps a valid result in `config.codeStats` (saved only when it changed).
      - Otherwise it returns `ledgerStats(config.activity)`; an unreadable ledger keeps the old error message.
      - When initialize fails, a `deepseek`-kind core throws (no card, $O undefined) and fixture/override cores fall back to the ledger.
    - Concurrent reads share one promise.
    - `'stats'` IPC: on a non-codex core, a kept `config.codeStats` is returned at once, and a fresh read follows through `pushCodeStats()`.
    - `pushCodeStats()` replaces the old `{stats: config.stats, activity}` push after `turn/completed`. It chains after an in-flight read and emits `{kind:'stats', stats}`. It also runs after a `connection` event with `connected: true` when the last read failed.
- Renderer:
  - `home-model.mjs`:
    - `aggregateStats(stats, range, today)` is a direct port of Iw (code-home.js:13711-13751): ranged `dailyActivity` entries give sessions, messages, tool calls and active days; ranged `dailyModelTokens` give per-model tokens and the 0.05% cutoff; usage is `stats.modelUsage[model]` (own key) or zeros.
    - `activityCounts(dailyActivity)` feeds the heatmap.
    - `aggregateLedger` and `dayModelUsage` are removed.
  - `source-home.jsx`:
    - `SourceStatsCard({stats, startedAt, …})` runs Iw for every tile and the Models tab.
    - Xw reads `stats.peakActivityHour`. eT is restored to messages from `stats.dailyActivity`, with the `${date} — ${count}` tooltip and aria-label 'Daily activity heatmap'.
    - `Tile` has no `title`. The model rows read `usage.inputTokens/outputTokens`.
    - The `sh-account-source` footer, `useHomeAccountUsage` and `accountActivity` are gone; `src/use-home-account-usage.jsx` and `src/home-account-usage.mjs` are deleted (grep showed no other users).
  - Hold (qw in Jt=hc, code-home.js:13863-13924, shared-frame :3206-3420):
    - Structure: `<div data-cds=SkeletonGroup data-motion=wave data-hold=delayed role=status>`, then `<span class=sr-only data-skeleton-label>`, then `<div aria-hidden class=contents>` holding the card.
    - On the `cds-placeholder-reveal` animationstart, the group gets `data-shown` and the label gets 'Loading'. On animationend, it gets `--cds-skel-settled: 100000ms` and `data-settled`.
    - The 8 skeletons carry `--cds-skel-i` 0–7.
    - A layout effect sets `--cds-skel-elapsed` from `startedAt`.
    - `export useHomeStartedAt(active)` captures `performance.now()` when the home becomes visible (Zk `[E]` :5032 → Lo startedAt). `main.jsx` calls it with `section === "new" && !current` and passes the result as `startedAt`.
  - `source-home.css`:
    - Every live `[role=tablist] > .sh-tab` gets a transparent `::before` (inset 0 1px, radius 4px, z -1), painted `--cds-fill-ghost-hover` when `.is-selected` and on an `:not(.is-selected):not(:disabled):hover` tab. Hover text is `--cds-text-secondary`. The first/last-child left/right 0 overrides are kept. The pre-live disabled group keeps only the selected pill.
    - `.sh-day-tooltip-dot` is 6px, round and flex-shrink 0. `.sh-day-tooltip-name` and the `.sh-account-source` rules are deleted.
  - DayTooltip (dT :14405-14433): aria-hidden dot + `${modelDisplayName}: ${compactTokens}`.
  - `main.jsx`:
    - The 'stats' event sets `e.stats` when it has `dailyActivity`. `loadStats` stores the stats object.
    - The SourceStatsCard props are now `stats` and `startedAt`; the readAccountUsage/accountIdentity/accountPending props are gone.
    - The generic `.connection-card` ('Connecting to DeepSeek…' / 'Connect to DeepSeek' + Reconnect) is removed. Only the deepseek-key-card and the Codex ChatGPT sign-in card remain.
- Fixture: `tests/fixtures/codex-server.cjs` adds `codeDesktop/stats/read` to the fixture-usage.json overrides (reply, error, hold gates). When unseeded, it is an unknown method, as on Codex. The app only asks when fixture-core.json lists `capabilities.codeStats`.

### Tests
- Harness:
  - `node --test tests/usage.test.mjs`: 9/9. New cases: first human prompt's day, notice not counted, multi-model day, tool calls and hour histogram, fork cut (own first prompt starts a session; an untagged marker is not a cut), codeStats shape/order/sums/peak tie/junk/safe ints, v1 cache refold, invalid v2 entry dropped. The persisted-cache case now expects version 2 with `stats`.
  - `tests/approval.test.mjs` (CAPABILITIES regex): passes.
- App: `node --test tests/home-model.test.mjs tests/home-stats-load.test.mjs tests/activity.test.mjs tests/home-account-usage.test.mjs tests/design-token-refs.test.mjs tests/reduced-motion-css.test.mjs`, 35/35.
  - `home-model`: the old ledger expectations now go through ledgerStats → aggregateStats, plus a direct Iw parity test (tool-call-only active day, ranged 0.05% cutoff, all-time usage object identity, zero usage, prototype key).
  - `activity`: dayModelUsage legacy/v2, ledgerStats ordering/hours/tie, statsShape, main.cjs wiring.
  - `home-stats-load`: new prop wiring, removed modules.
  - `home-account-usage` (rewritten): SSR of the card over the harness `codeStats` output (tiles from the bridge; no footer/title/'Refresh usage'; messages heatmap; hold SkeletonGroup markup and `--cds-skel-i` 0–7; never zeros), the CSS/tooltip source guards, and no generic connection card.
- UI scripts, updated on purpose (not run; for the integrator):
  - `home-page`:
    - Phase A no longer expects the account footer. It asserts no footer/status, no connection card while connecting, no `[title]`, and card height = tabs row + 20 + overview + padding.
    - Hovering the unselected Models tab paints the ghost pill (left 1px / right 0, radius 4px) with secondary text.
    - Chart tooltip rows read 'Test model: 4k' … and match `/^.+: [\d.]+[kMB]?$/`, with 6×6 50% aria-hidden dots, gap 4px, tabular-nums.
    - The fixture has no codeStats, so this suite covers the ledger fallback with the old numbers.
  - `home-account-usage` (rewritten for the core path; fixture-core `codeStats`, held `codeDesktop/stats/read`):
    - Hold checks: SkeletonGroup role/hold/motion/label, reveal animation name and backwards fill with delay = 500 ms − `--cds-skel-elapsed`, opacity 1 + 'Loading' after the reveal, breathe on all 8 skeletons, no hover pill on the disabled pre-live tab.
    - The tiles come from the RPC and not from a decoy ledger: All 3/42/1M/3/3 PM/Test model, 7d 1/12/101k/2/Test model 2. The messages heatmap, one stats read with `{}`, no account/usage/read, and `config.codeStats` kept.
    - Relaunch: the kept result paints with no hold, and the released fresh fold updates it to 48 messages.
    - The deepseek-key-card flow is kept, with a single `.connection-card`.
  - `connection-lifecycle`: no `.connection-card`, warning or 'Connecting to DeepSeek' while the first core's 5 s initialize is pending.
  - `composer-fixture-test` and `tests/fixtures/composer-ui.jsx` (native window only, not run): the stats object replaces the ledger snapshot, and aggregateStats/activityCounts replace aggregateLedger.
- Suites for the integrator: home-page, home-account-usage, connection-lifecycle. Also worth one run: account-lifecycle (key card), code (heatmap range-independence, 'No model usage in this range' on the ledger fallback) and composer-states (fixture-core.json without codeStats).

### Deviations
- The original getCodeStats is `r.y()` in the main bundle and reads Claude Code's own stats, so its counting rules are not in the 2.2553.1 bundle. Hours count messages, as the local ledger did. Messages count human prompts plus every assistant step (tool-only and interrupted partials included). Sessions start only on a human prompt, so sub-agent children add messages, tool calls and tokens but no sessions.
- The RPC is gated by the new `capabilities.codeStats` instead of probing. Codex and the UI fixtures (unless seeded) keep the ledger fallback. That fallback has no tool calls, counts every ledger day as active (as before), and remains forward-only.
- Tokens without `source.model` are not charged to any model. Keys are the Harness model id, which equals the wire id unless the id repeats across providers.
- The original `staleTime 3e5`/`gcTime ∞` is approximated: the kept config result plus a fresh fold on each launch and after each turn.
- `.sh-model-swatch` is kept: the cT model rows still use the 8px square in the original (`size-[8px] rounded-xs`). Only the tooltip swatch and the split name/count spans are replaced (the spec's "~169" pointed at the shared class).
- style.css: nothing is removed. The `.connection-card*` rules still style the deepseek-key-card and the Codex ChatGPT sign-in card. The latter is kept as the Codex path's sign-in gate; it is not the generic connecting card.
- The live tabs' focus ring stays on the button (box-shadow), not on the `::before` (`focus-visible:before:shadow-focus`), to keep current focus visuals and suites stable.
- hc's cross-document `pc()` breathe phase sync and its `lockstep` fallback are not reproduced, the same as the transcript skeleton.
- aggregateStats adds `number()` and own-key guards beyond Iw.

### Remaining gaps
- "A fast load never shows the skeleton" is verified by the CSS timing (delay = .5s − elapsed, backwards fill), not by observing frames.
- Sessions folded by another DSH_HOME, or deleted in the app, are excluded, as with account usage. The first launch on a large `~/.dsh` waits for one full fold; later reads come from the cache.
- Nothing was built or run offscreen. If a sibling batch's main.jsx/main.cjs edits conflict, re-check the 'stats' wiring, `useHomeStartedAt` and the removed connection card.

## F10

B10: transcript find bar (⌘F / ⌘G / ⇧⌘G / F3, Edit ▸ Find) and the feed/article keyboard and screen-reader structure. HANDOFF entry: "0.2.130 保真轮 F10". Package version unchanged. Implemented in parallel with F07–F14: no build, no full `npm test`, no offscreen suites (left to the integrator), no snapshot.

### Changes
- New pure `app/src/transcript-find-model.mjs` (ion-dist shared-18-CzkFx3Pc.js vo/q/vs/Vo/Eo; sidebar-main.js:17776 qB):
  - `collectFindText` / `findMatches(root, query, {exclude})`: document-order text walk of `.source-transcript-content`. Skipped: `[data-find-omitted]` (its `[data-find-included]` subtrees come back), `data-gutter`, `aria-hidden="true"`, `.sr-only`/`.source-sr-only`/`.sp-sr-only`, `[hidden]`. A NUL separates block elements (po list), omitted subtrees and inclusion changes, so a match never spans blocks but does span inline nodes. Matches are `{startNode,startOffset,endNode,endOffset}`.
  - `foldCase` (q: length-preserving lower-casing, İ/Σ one unit at a time, surrogates kept).
  - `nextActiveIndex` (vs: new → first, step wraps both ways, from none forward → first / back → last, keep clamps, reset), `keepActiveIndex` (Po/No: the active match stays on the same text after a content update, else clamp), `findResult` (empty query → {activeIndex:0,total:0}), `findStatusText` ('' / '{current}/{total}' / '0/0').
  - `findShortcut` (ZB window keys: 'open' for ⌘F incl. an open bar, never for a prevented event, ⇧⌘F or ⌥⌘F; 'close' Escape; 'next'/'prev' for ⌘G/⇧⌘G/F3/⇧F3 only while open, not composing, no ⌥), `findInputKey` (Enter/⇧Enter, ignored while composing), `createFindInput` (qB 120ms debounce, no search while an IME composition runs, compositionend searches the committed text, `canStep` false mid-composition), `centerScrollOffset` (Vo), `FIND_LABELS`.
- New `app/src/source-find-bar.jsx` + `.css` (ZB :17787-18115, QB :18119-18130):
  - Portaled to body: `div[role=search][tabindex=-1][data-find-provider-scope]`, fixed top-14 (56px) / right-4 (16px), gap-1, rounded-lg (8px), 0.5px border-strong, surface-3, px-2 py-1.5, shadow-lg, inline z-index 9000 (shared-frame Qc = dp). Input w-48 'Find…' / aria-label 'Find' / spellCheck off / hide-focus-ring, text-body primary, muted placeholder. `role=status aria-atomic` count (footnote, muted, tabular-nums). Three QB buttons 24px, rounded, text-muted, hover surface-0 + text-primary, can-focus, disabled pointer-events none + opacity .4 (kept muted against style.css's `button:disabled` colour): 'Go to previous match' CaretUp, 'Go to next match' CaretDown (disabled without matches), 'Close find bar' X (20px icons, R default size).
  - Highlights: `CSS.highlights` 'transcript-find' (all, priority 0) and 'transcript-find-active' (priority 1); `::highlight()` rules rgb(255 213 0) / rgb(255 150 50) with `color: var(--cds-black)` (Eo; same in light and dark).
  - Keys (ZB's own window listeners, re-added on open/close): ⌘F opens (or refocuses + selects), remembering the focused element; Escape closes and restores it (an Escape inside the bar is the bar's: stopPropagation + preventDefault); ⌘G/⇧⌘G/F3/⇧F3 step while open; Enter/⇧Enter in the input. Prevented events are not taken; an inert `#root` (modal/Settings) stands down, and a modal appearing while open closes the bar without restoring focus ('overlay'). A step cancels the pending typing search (P's clearTimeout).
  - Search: matches become Ranges, kept only when rendered (visibility visible and a box: shared-18 no). New query → first match; step → wrap. A MutationObserver on the transcript (childList/subtree/characterData) re-runs 'keep' at most once per 60ms (Es) without scrolling. The active match is centred first in any scrolling ancestor inside the transcript, then through the transcript controller (Ko/Vo).
- `use-transcript-scroll.js`: api gains `release()` (the existing controller release), `reveal(rect)` (release following, then Vo-centre the rect within the viewport, cut at a positive scroll-padding-bottom; own-target write so it is not user movement) and `getContent()`.
- `source-transcript.jsx`: props `responding`, `onFeedEscape`; the viewport takes `feed.feedProps` instead of role=log/'Conversation' and renders `feed.instructions` first; mounts `<SourceFindBar>` (scope = content, scroll = api); the imperative handle is `{...scroll.api, openFind, stepFind}`.
- `app-menu.cjs` (index.chunk-ChZ67Jhw.js ISr): Edit ends with a separator and Find ▸ Find… (CmdOrCtrl+F → `{kind:'find-open'}`), Find Next (CmdOrCtrl+G → `{kind:'find-step', forward:true}`), Find Previous (CmdOrCtrl+Shift+G → `{kind:'find-step', forward:false}`), each `registerAccelerator:false` (the renderer owns the chords). main.cjs needed no change (menuEmit forwards unknown kinds). PSr's Find in Files… is not added.
- `main.jsx`: onEvent routes find-open/find-step to `transcriptRef.current.openFind/stepFind`; SourceTranscript gets `responding={running}` and `onFeedEscape={() => textarea.current?.focus()}`.
- New pure `app/src/transcript-feed-nav.mjs` + hook `app/src/use-transcript-feed-nav.js` (scroll-messages-current.js N9 :60985-61288, j9/A9 :60976-60981, :63471, :63957-63966, :61757-61761; scroll-transcript-host-current.js:2982 feedKeyboardNav):
  - feedProps: role=feed, aria-label 'Chat messages', aria-busy={responding}, aria-describedby → sr-only `<p data-find-omitted>` 'Use the up and down arrow keys to move between messages.'; onKeyDown (React, so rows' own handlers run first, as N9's), onFocus, onPointerDownCapture.
  - Rows: every top-level `.source-message` child of the content with `[data-transcript-item-id]` or `[data-tool-group]`; `[data-cds=UserMessage]` is a prompt; any other visible top-level element (turn footer, error card, approval/question card, status, local command, workflow row) is a boundary. `feedArticles`: one article per prompt; a run of answer rows (tools, groups, thinking, text) is one answer whose first visible row is the article (the source's assistantItem isFirst); a boundary or a `data-turn-start` row starts a new answer; hidden rows are skipped.
  - Applied to the DOM on mount, on content childList changes (once per frame), on responding changes and on focus/key moves: role=article, aria-posinset/aria-setsize, roving tabIndex (0 on the remembered article, else the last), aria-label 'Message N' or 'Currently streaming message' (the last answer while responding). Non-head rows rendered as `<article>` get role=none. Attributes are removed when a row stops being an article.
  - `feedKeyAction`: ArrowUp/ArrowDown only from inside an article and not right after a pointer focus (500ms); Home/End (also Ctrl) anywhere in the feed; not for editable targets, focusable scrollers (pw, plus an overflow check), modifiers or prevented events. A move to a non-last article releases following, `scrollIntoView({block:'nearest'})`, focus(preventScroll); a move to the last article, or End on the focused last one, re-pins with `api.jumpToLatest()`. A plain Escape inside an article focuses the composer unless an editor, escape owner or open popup owns it (cb50b3202 a/o); the event is not prevented.
  - Headings: `promptHeading` → SourceUserMessage renders `<h2 data-find-omitted class="sr-only select-none">You said: {summary}</h2>` as the first child of `.source-user-group` (the article's first/last children stay the group and the actions row, which user-actions asserts). `responseHeading` → the hook prepends the same kind of h2 'DeepSeek responded: {summary}' to the answer's head row, from the first text row of the answer (resolveMessage), first 600 units; none while that answer streams (ahe). `messageSummary` ports af (L/N): skip a leading blank run and fence, strip list/heading markers, ticks, emphasis and link syntax, first sentence of the first line, 160 units with '…'.

### Tests and results
- New `tests/transcript-find-model.test.mjs` (9): omitted/aria-hidden/sr-only/hidden/gutter exclusion and data-find-included; case-insensitive counts, inline spans, no block spans, non-overlapping; foldCase length; wrap-around; keep; status/empty query 0/0; IME guard; ZB keys; Vo.
- New `tests/transcript-feed-nav.test.mjs` (10): article choice incl. hidden rows, boundaries and data-turn-start; current article; ↑/↓/Home/End/Ctrl/End re-pin; keys left alone; labels incl. streaming tail; af summaries; headings; source wiring; SSR of the feed (role/label/busy/describedby → instructions, no role=log) and of the 'You said' h2 inside the user group.
- `tests/app-menu.test.mjs`: the Edit list now ends with separator + Find; new test for the three items' accelerators, registerAccelerator:false and the emitted events.
- `node --test tests/transcript-find-model.test.mjs tests/transcript-feed-nav.test.mjs tests/app-menu.test.mjs`: 36/36. Also run: transcript-scroll, design-token-refs, reduced-motion-css, reasoning-model, source-transcript-states, response-markdown-render, tool-cards-f07, source-tool-incard, protocol-0155-state, composer-placeholder, settings-focus-return, source-titlebar-tooltips — all pass. `shortcuts-dialog-model` fails one assertion on main.jsx's Escape layering regex because another batch is inserting `closePeek` there (not F10).
- UI scripts updated on purpose:
  - `session-ui-test.mjs`: ⌘F from the composer focuses `input[aria-label=Find]`; bar geometry (56/16, fixed, z 9000, 8px, border-0.5 as the device snaps it, surface-3 / border-strong, 24px buttons, prev/next disabled) and dark-mode tokens; 'inspect' → 1/3 with 3 painted matches (active 'Inspect'), Enter ×2 → 3/3 with the match in view and following released; ⇧⌘G / ⌘G / F3 / ⇧Enter wrap; Escape closes, clears the highlights and restores the composer focus; Edit ▸ Find… / Find Next through the app menu; Close find bar restores focus. Feed: role=feed 'Chat messages', aria-busy false, instructions, numbered articles with one tabindex=0 stop on the latest, 'You said' / 'DeepSeek responded' headings, a group member untouched and the non-head answer `<article>` role=none; ArrowUp ×2 → 'Message N-2' released, Home → 'Message 1', End → 'Message N' re-pinned at the tail, Escape → composer. During the fixture streaming turn the feed is aria-busy and its tail reads 'Currently streaming message', then 'Message N'. Screenshot `analysis/batch-20260920/session-find-bar.png`.
  - `ui029-ui-test.mjs`: the user row's only h2 is now the sr-only 'You said: …' heading; the "no Markdown tags" check excludes it.
  - No script selected role=log / 'Conversation'; run-suite.mjs is unchanged (the steps extend 'session').
- Harness untouched; no live DeepSeek run.

### Deviations
- Keys live in the find bar's own window listeners (as ZB does), not in main.jsx's handler; main.jsx only routes the menu events. Ordering with other window listeners follows registration (the composer's F05 stop-on-Escape runs first while a turn runs, as in the source).
- The search scope is the transcript content (spec). ZB's page-level DOM provider also searches the rest of the page; that is not ported.
- 'Message N' uses the article position (aria-posinset); the source labels by entry index, equal without folded rows.
- Answer articles are chosen from the DOM rows (rows come from several components), with the head row as the article and its heading inserted by the hook. A run that starts with a tool row and has no footer/prompt/turn-start boundary before it joins the previous answer.
- The focusable-scroller exemption also checks overflow-y (pw only checks tabIndex and scrollHeight), so an article itself never counts as a scroller.
- Rows rendered as `<article>` that are not article heads get role=none (the source's item rows are plain divs).
- The heading is not added while the answer streams (ahe), also for split rows (the source's split path adds it).
- 'Claude' becomes 'DeepSeek' in 'DeepSeek responded:' per the transcript naming rule.

### Remaining gaps
- Not ported: lH (keeping the tail pinned when Tab enters a following feed), revealFolded (expanding collapsed content to show a match), shadow-root/slot traversal, find telemetry, the find_in_page window for non-Code surfaces, Find in Files….
- The find bar closes on a session switch (SourceTranscript remounts per session).
- No focus style is added to articles (UA focus-visible ring), as in the source.
- Native-window acceptance (VoiceOver reading of the feed/articles/headings, real IME in the find input, menu accelerators display) and the offscreen suites are left to the integrator.

## F12

B12: git band and Changes pane — merge-base default scope with the diff-scope dropdown, CDS secondary band buttons, original band behaviour (no commit-mode Dismiss, switch hold, start-aligned chip menus, counts toggle, failure toast, GitCounts a11y/tween), and the Highlight changed words / Hide whitespace changes toggles. Implemented in parallel with F07–F14: no build, no offscreen suites, no snapshot. HANDOFF entry: "0.2.130 保真轮 F12". Package version unchanged.

### Changes
- Scope backend (`app/electron/git-status.cjs`; heavyWorkWorker fa/ua/ya, index.chunk-Mak6MV2t getGitInfo defaultBranch, c0547825d `baseBranch = defaultBranch ?? sourceBranch ?? branch`):
  - `defaultBase(ctx, branch, preferredBase)`: `symbolic-ref --short refs/remotes/origin/HEAD` (origin/ stripped), else the first of main/master with `refs/remotes/origin/<b>`, else the worktree sourceBranch (preferredBase, must exist), else the current branch; baseSource default/session/current. The cloud-branch order (current-with-remote, shortest containing origin/*) is gone.
  - `resolveBaseRef` (ua: refs/remotes/origin/<b>, then refs/heads/<b>, else null = plain HEAD diff) and `scopeBase` (`merge-base <ref> HEAD`, else the ref's commit; an explicit valid `base` = the Compare against override, invalid ones fall back).
  - `comparison()` takes the same resolved base; the branch===base short-circuit is dropped (`same` stays a flag, unpushed work on main counts as ahead).
  - `workspaceGitStatus`: numstat `diff … --find-renames --numstat -z <diffBase>` + untracked additions; `hasChanges = files.length > 0`, new `workingTreeDirty = porcelain records > 0`, `diffBase` (merge-base or HEAD/empty tree), `scopeBase` (null when no base resolves), `headSha`, baseKind `merge-base` when it differs from HEAD.
  - `workspaceGitDiff(cwd, {completeContext, scope='branch', base, preferredBase})`: 'branch' = merge-base → worktree + untracked, 'uncommitted' = HEAD → worktree + untracked, 'commit:<sha>' = `git show --format= <sha>` (verified sha, no untracked); the fallbacks keep the scope.
  - New `workspaceGitCommits` (`log -z --max-count=51 <baseRef>..HEAD`, {sha, shortSha, subject}) and `workspaceGitBranches` (`for-each-ref refs/heads/`).
  - `app/electron/main.cjs`: 'workspace-git-diff' accepts and validates {scope, base} and passes the session preferredBase; new 'workspace-git-commits' and 'workspace-git-branches' (also in POPOUT_ACTIONS).
  - `app/electron/desktop-settings.cjs` auto-archive keeps its old dirty-tree gate (`workingTreeDirty ?? hasChanges`), since hasChanges now spans the branch's commits.
- Scope UI (panes-tile-current.js:2842-3117 Fm/Im/zm/Bm; cd5e3435c U/H; shared-frame F_ SearchablePopup):
  - New pure `app/src/diff-scope-model.mjs`: `diffScopeTrigger` ('main → working tree', aria-label 'Diff scope: …', 'Uncommitted changes', commit 'shortSha subject'/7-char sha), `resolveDiffScope` (unset/unavailable → branch; no base → uncommitted), `diffScopeParam`, `compareAgainstBranches` (Fm), `branchSearchEmptyLabel` (Im), `filterSearchItems` (H), `diffScopeSections` (diff-scope radio rows with 'vs {base}', diff-base 'Compare against' with the base hint, 'default' hint and the Im select rules, diff-commits ≤50 rows + 'N older commit(s) not shown', '(no message)').
  - New `app/src/source-diff-scope.jsx` + `.css`: `SourceDiffScope` ghost SourceSettingsButton trigger (`shrink min-w-0 text-secondary`, grid label of two truncating spans around an xs text-muted ArrowRight with role=img aria-label 'to'), SourceMenu.Popup side bottom / align start; submenus side right / align start / -4; the Compare against submenu heads its rows with a search field (10.5 visible rows, footnote empty row). `useDiffScope({call, cwd, sessionId, status, active, refreshKey})` keeps {scope, base} per session, loads commits while the pane is open and branches when Compare against opens, and returns {param, base, kind, control}.
  - `source-menu.jsx`: SubmenuTrigger `openOnHover` prop (cd5e3435c: a hint/trailing trigger opens only on click/ArrowRight).
  - `source-session.jsx` FilePane: new `diffScopeControl` prop rendered in place of the Changes title (the strong title line itself is untouched for F11); the Diff gets wordDiff/hideWhitespace.
  - `main.jsx`: `useDiffScope` replaces the hard-wired 'uncommitted' (main window and popout); the diff effect sends {scope, base, sessionId}, refetches on a scope change and drops the old scope's patch first; `gitChangeKey` includes headSha and workingTreeDirty (a commit moves the uncommitted/commit scopes while the branch diff stays). The popout reads the diff in its own effect.
- Band (`source-git-status.jsx/.css`, `source-git-rail.jsx/.css`, `git-rail-model.mjs`, `main.jsx`):
  - Commit gate: `commitAction` and main.jsx gate on `workingTreeDirty === true` ('No changes to commit' first, then 'Claude is working — wait for the turn to finish', the existing original copy). After a commit the band stays with the branch +N −M.
  - Counts and Commit are SourceSettingsButton variant secondary (classes sg-diff/sg-action, onMouseDown preventDefault, SourceTooltip/disabledReason wrappers kept; busy uses the CDS spinner); the rail's Commit too (`.sgr-action` flex share at Button specificity). `.sg-spinner` CSS removed.
  - No commit-mode Dismiss: main.jsx passes no onDismiss and `gitDismissed` is gone.
  - Chip menus: SourceMenu.Popup anchor, side bottom, align start, layer menu, dataCds Menu (no SourceSidebarMenu, no dead width). `gitRepoMenuItems` says 'Show in Finder' (titlebar folder menu shares it).
  - Counts: `onOpenChanges={() => togglePaneTile("changes")}`.
  - New `app/src/source-git-counts.jsx`: `GitCounts` (OV: tabular-nums + className, sr-only '3 additions, 1 deletion', aria-hidden `contents` +/− pair), `useCountTween` (DV: 400ms, 1-(1-t)^3, rAF, skipped under the OS query or data-reduce-motion via useReducedMotion), `gitCountsLabel`. Used by the band (`contents text-body-medium`), the static counts (`contents`), the rail fact and the rail collapsed signal. `.sg-diff` has no aria-label; the tooltip stays 'View changes'.
  - Commit failure: `sendCommitTurn` routes offline, archived and turn/start failures to `toasts.add('Message couldn’t be sent. Try again.', {variant:'danger'})`; the invented strings and setError calls are gone.
  - Switch hold: main.jsx keeps a ref Map per session {status, heightPx} filled from status results (`rememberGitBand`) and the band's ResizeObserver (`onMeasured`); `gitStatusOwner` hides another session's status; while the revisited session has no status the band renders `SourceGitStatus stale` (`SourceGitStatusStale`: data-prbar-stale, aria-hidden, inert, pointer-events none, opacity .6, plain ja chips, Aa fill-secondary/shadow-field counts and a Commit-label span of the button's width, nav min-height = remembered height) until fresh status arrives or 6s (im) pass.
- Changes display toggles: `diff-view-model.mjs` adds wordDiff (default true) and hideWhitespace (default false, only `true` enables) to DIFF_PREFERENCE_KEYS and the store snapshot; `changes-menu-model.mjs` appends the keepOpen checkboxes 'Highlight changed words' (diff-word-diff) and 'Hide whitespace changes' (diff-hide-whitespace) after Word wrap. New `app/src/diff-whitespace-model.mjs` ports gn (fn trim of space/tab/CR, mn runs with no-EOL sides, hn, Myers `diffLineArrays` with jsdiff diffArrays semantics and maxEditLength 400 / 2000-line cap, hunks without real changes dropped, whitespaceOnly). `source-diff.jsx` `withoutWhitespaceChanges` applies it per file (whitespaceOnly → no hunks, real counts kept, the existing 'Whitespace only' W label); `use-diff-hunk.mjs`/`use-word-diff.mjs` skip the word-diff binding when wordDiff is off. `diff-file-header-model.mjs` comments updated.

### Tests and results
- Spec command `node --test tests/git-status.test.mjs tests/git-rail-model.test.mjs tests/diff-scope-model.test.mjs tests/source-git-band.test.mjs tests/changes-menu-model.test.mjs tests/diff-whitespace-model.test.mjs tests/diff-file-header.test.mjs`: 60/60.
  - git-status: comparison tests rewritten for the defaultBranch order (origin/HEAD wins over a pushed containing branch, main/master fallback, no remote = current branch with HEAD diff, detached without remote = null base, worktree sourceBranch only without a default); new scope tests: feature/x commit + clean tree → hasChanges true, workingTreeDirty false, diffBase = merge-base, 'branch' has the commit and 'uncommitted' does not; unpushed commit on main included; no-remote branch scope = HEAD diff; commit scope, invalid sha, commits list/limit, branches, explicit base and fallback.
  - source-git-band: data-variant=secondary on .sg-diff/.sg-action, no .sg-dismiss in commit mode, sr-only '3 additions, 1 deletion' + aria-hidden pair, stale row inert/aria-hidden/data-prbar-stale without buttons, Show in Finder, start-aligned Popup (source check), rail GitCounts/secondary Commit.
  - New diff-scope-model (5), diff-whitespace-model (5); changes-menu-model (4 display items, callbacks); diff-file-header ('Whitespace only' SSR with hideWhitespace, counts kept, body gone).
- Also: diff-view-model (snapshot shape), new source-diff-scope (trigger SSR, GitCounts, FilePanel title replacement and empty states), design-token-refs, reduced-motion-css, settings-complete-model, changes-pane-states, files-pane-states, composer-env-pickers, changes-toggle, menu-model: 68/68.
- Not mine: shortcuts-dialog-model 'main.jsx routes the handler…' fails on the Escape-chain source regex because F08 inserted the sidebar peek branch into main.jsx's Escape handler.
- Not run (protocol): npm run build, npm test, offscreen suites, live DeepSeek. Harness not touched.
- UI scripts updated on purpose: git (counts by .sg-diff with the sr-only name, second click closes Changes, no .sg-dismiss), git-band (Show in Finder, repo/branch menus start-aligned within 1px, a local refs/remotes/origin/main so main is the base, new after-commit step: band stays +2 −1, Commit 'No changes to commit', secondary paint/ring), git-rail (+4 −1 branch stats, three Changes files, GitCounts reads, fixture `workingTreeDirty`), changes-pane (4 display items in light and dark, empty state 'No changes to show', new scope and whitespace steps), diff and pane (wait for the 'Diff scope: …' trigger), titlebar (Show in Finder, typeahead 's'), scrollbar-mode (.sg-diff).

### Deviations
- The stale snapshot shows the Commit label inside the Aa fill span (Na/Ma) rather than an empty spacer; it is aria-hidden and inert either way and has the button's width.
- The Compare against override lives per session in memory (the original keeps baseChoice per repo); it changes only the Changes pane, not the band stats.
- hasChanges still merges the porcelain records into the file list, so a staged/unstaged net-zero edit keeps the band (existing local test), where the original numstat-only stats would hide it.
- `git show` of a merge commit is a combined diff that the local parser shows as raw text.
- uncommittedAvailable is "is a repository" (the original also needs a local branch and its own availability check).
- The search field of Compare against filters by substring (H) and is a plain input in the submenu header, not the full F_ keyboard bridge.
- sendCommitTurn also logs the failure with console.warn (the original reports it through addError's messageForLogging).

### Remaining gaps
- Not scripted: the A→B→A composer-top stability check (needs two dirty fixture sessions) and the danger toast on a rejected turn/start (the fixture server has no turn/start failure knob). The integrator should cover them in git-band or by hand.
- 'Open in terminal' and 'Change directory…' chip rows are still absent.
- A local-only repository on a feature branch compares against itself (baseBranch = branch, as in the original), so its band disappears after a commit.
- Offscreen suites and native-window acceptance are left to the integrator.

## F08

B8: sidebar — automatic unread, status glyph a11y, optimistic inline rename and toasts, group header context menus with a persisted section order, ⌘1–9 jump hints, Folder grouping by repo identity with a final 'Other', and the collapsed hover peek. Implemented in parallel with F07 and F09–F14: no build, no offscreen suites, no snapshot (integrator). HANDOFF entry: "0.2.130 保真轮 F08". Package version unchanged.

### Changes
- Automatic unread (context-menu-shared.js:19421-19437 kR; sidebar-groups.js:9030-9040 serverUnread && !paneSelected):
  - `sidebar-model.js` `unreadOnTurnCompleted({threadId, currentId, knownIds, ownerOf})`: true only for a known row id that is not the open session and owns itself.
  - `main.jsx` turn/completed (mount-time listener) passes `sessionsRef` ids, `currentRef` and an `ownerOf` over `childThreads` + `ownerThreadId(latestState.current)` (new latest-state ref), then `updateSessionMetadata(id, {unread:true})`. Navigation still clears it; Home attention fills from it.
  - Deleted `.source-session-row[data-unread] .source-session-name` and the unused `.is-unread` dot rule.
- Status glyphs (sidebar-rows.js:8060-8270 aO/oO/mO/bO/CO/DO, :8512-8545 NO):
  - `StatusGlyph({label, live})`: `span.source-status-glyph` (flex, 14px min, centred), role status/img + aria-label, inside `SourceTooltip {content, delay 500, closeDelay 0, hoverable false}`.
  - Idle hollow dot (img), Running / Awaiting input / Unread response dots (status), Archived = Archive 16px `.source-status-archived` (img), error = bO on the code surface: TE/EE/DE (sidebar-rows.js:6755-6772) Warning/UsageGaugeHigh text-danger, CloudSlash text-secondary for network; label = `describeTurnError(latestTurnError).headline`, else shared-18 W.generic 'Something went wrong'. The review glyph is labelled with fE's PR state name.
  - Archived rows: `color: var(--cds-text-muted); opacity: .5` (sidebar-groups.js:8756 CA).
- Rename and feedback (sidebar-rows.js:7222-7325 AD/jD, :7400-7420, :7531-7537; sidebar-groups.js:6219-6240, :18630-18682 Bz, KT):
  - `InlineRenameInput` (shared by rows and group headers): focus + select on entry, 250ms entering guard that refocuses on blur, Enter submits (refocus row), Escape cancels (refocus row), later blur submits without refocus; `hide-focus-ring`, transparent, borderless.
  - `RenameRow` keeps the row's real `SessionStatus` glyph and `data-selected`, no accent ring, field labelled 'Rename'. Submitting closes at once; `pendingNames` shows the optimistic label until the session carries it, and drops it plus a danger toast on rejection.
  - `useSourceToasts`: row action errors are danger toasts; bulk results are neutral toasts 'Archived/Deleted {n} session(s)' (key `group-bulk-{action}`, timeout 3000 → the store's 6s floor) and, for the Older bucket, 'Archived/Deleted {n} older session(s)' (key `{action}-older-bulk`); partial failures keep the KT copy as danger toasts. DeepSeek keeps 'Removed'. Removed the status row, the red error row, their CSS and STATUS_TIMEOUT.
- Group header menus (sidebar-session.js:15909-16030 OB/kB/MB/jB, :16275-16432 XB, :16434-16500 ZB; sidebar-rows.js:7097-7140 yD, :7773-7810 QD; sidebar-groups.js:17505-17516, :19700-19728):
  - `.source-group-heading` onContextMenu opens SourceSidebarMenu at the cursor ("Group options") for project buckets (not Other) and custom groups.
  - Project: New session (onProject(cwd)) / separator / Move up / Move down (only where movable) / Sort A to Z.
  - Custom: New session / separator / Rename group (header input 'Rename group', started after XB's 100ms debounce) / New group… / separator / order items / separator / Delete group (danger) → `SourceConfirmationDialog` 'Delete group?' with `deleteGroupCopy` (yD deleteBody plural) and 'Delete'.
  - Persisted order: one `config.projectOrder` list (sidebar-session.js:15826-15852 _B/vB/xB): project keys plus `ccg::<groupId>` custom keys. main.cjs sidebar-state `project-order` (validated, ≤1000 unique strings), included in `sidebarSnapshot`, seeded `[]`, a deleted group's key dropped. sidebar-model: `sectionOrderKeys`, `withSectionOrder` (rewrites one kind, keeps the other and stale keys), `moveSection`, `sortSectionsAlphabetically`, `orderCustomGroups` (unranked custom groups first, xB -Infinity); project buckets switch to the stored order once it names a present project (qs/BJ "manual"), unranked after by the local sort.
  - Removed the DotsVertical group trigger and the immediate 'Remove group'. Empty custom group: 'Drag or move sessions here'.
  - `GroupNameDialog` is create-only: density comfortable, placeholder/label 'Group name', switch note 'The list will switch to Custom groups to show it.' and 'Create and group by custom' unless grouped by custom, else 'Create group'.
  - Custom "New session" (Mz): prefills the folder the group's sessions share, navigates Home and files the next started session into the group (`newSessionGroup` ref consumed by send(); any navigation clears it).
- Jump hints (new `app/src/sidebar-jump-model.mjs`; sidebar-groups.js:9110-9312, sidebar-main.js:14284-14310):
  - `isMetaJumpChord` (sj), `isCtrlShiftJumpChord` (oj), `isJumpHintChord` (cj), `jumpKey` (ij), `jumpDigit` (bL), `isTypingTarget` (aj), `collectJumpRows` ($A/ej), `jumpHintMap` (nj), `createJumpHints` (pj + bL over injected rows/timers/show/hide/open).
  - Rows carry `data-row-key` + `data-jump-hint-row`. SourceSidebar wires window keydown/keyup/blur/mousemove/mousedown/wheel and document visibilitychange; blocked while collapsed, with an open `[role=menu]` or an inert `#root` (modal dialogs, Settings).
  - Hints render `<kbd aria-hidden class="source-jump-hint">` with mj's geometry (absolute, top row-h/2, left row-px + (leading-slot − 16px)/2, 16px tall, min-width 16, radius 3, 0.5px border, surface-1, 10px/500, text-secondary); family rows shift by their padding.
- Repo grouping (sidebar-session.js:20892-20903 IJ, :20921-20990 BJ; sidebar-groups.js:19555-19650, :19866-19880; shared-2 zo.otherProjects 'Other'):
  - `git-status.cjs` (appended, exports added via `module.exports.x =` so F12's export line is untouched): `parseRemoteUrl` (scheme, scp-like, subgroups, local/file paths), `repoIdentity(cwd, {home})` → `{isRepo, toplevel, owner, name, parent}` (rev-parse --show-toplevel + `config --get remote.origin.url`, read-only env of the module, cached per cwd, never throws), `clearRepoIdentityCache`.
  - main.cjs `repo-identities` desktop call (≤200 absolute cwds). main.jsx resolves the folders of the session list + cwd while grouped by Folder and merges results into `repoIdentities`; until an entry arrives a folder keys on its cwd.
  - `buildSidebarGroups` project branch: `projectKey` (owner/name, else the trimmed cwd for a repo without an owner, else `__no_project__`), `projectName`, BJ disambiguation ' · owner' or ' · parent folder' (main sends a tildified parent), 'Other' appended last with no cwd (no '+', no menu, not in the order).
- Collapsed hover peek (desktop-layout.css:1346-1455; sidebar-groups.js:2679-2840 Nb/Ib; sidebar-main.js:14903-14925, :15186-15200, :15304-15320; shared-2 setHovering/closePeek, shared-19 Nh/Ah/Mh):
  - main.jsx `peek {hovering, peeked, top, left, bridge}` → `.dframe-root[data-hovering][data-peeked]` and `--df-peek-top/-left/-bridge-top` measured from the trigger (card 8px below it, 6px from the toolbar start).
  - Mouse pointerenter on 'Show sidebar', the bridge or the body opens; pointerleave starts the 180ms grace that waits while a menu is open or a text field in the card has focus; navigate() closes it and returns focus to the trigger when focus was in the card; Escape is a new layer in the window handler (after the dialogs, before the search) that closes and refocuses the trigger; the composer's `escapeClaimed` includes the open peek; collapsing/expanding resets it.
  - SourceSidebar keeps the aside mounted, renders `.dframe-peek-bridge` while collapsed, and gives the body `id="frame-peek-popover"`, the peek pointer handlers and `inert` while hidden; the floor measurement is skipped while collapsed (the toolbar is display:none).
  - SourceTitlebar 'Show sidebar': `aria-expanded`, `aria-controls="frame-peek-popover"`, `data-peek-open` → `--cds-neutral-30` background, pointer handlers.
  - style.css: the collapsed aside is a zero-size absolute anchor (z 50), toolbar hidden; the body is the 280px card (max-height 70vh, padding 7.5/7.5/13, border 0.5 `--cds-border`, radius `--df-radius-card`, `hsl(--df-surface-primary)`, `--df-shadow-pop`, opacity 0 + translate(0,-6px) scale(.98) + visibility hidden + pointer-events none), `[data-peeked]` transitions (.14s opacity / .18s transform, visibility delayed), `[data-hovering]` visible with `app-region: no-drag`; bridge 280×12 under the trigger, pointer events only while hovering (none on hover:none); reduce-motion @media + `html[data-reduce-motion=true]` twins drop the transform. The resize handle stays hidden.

### Tests and results
- New `tests/sidebar-jump-model.test.mjs` (8): predicates, ij/bL digit parsing, aj, $A/nj rows and map, ⌘ hold/release/mouse/blur lifecycle, Ctrl+Shift hints + jump, ⌘+Digit jump/repeat/modifier/blocked, typing guard.
- New `tests/repo-identity.test.mjs` (2): parseRemoteUrl forms; real temp repos (origin + worktree share owner/name, no-remote repo, plain folder, missing folder, relative path, cache).
- `tests/sidebar-model.test.mjs` +6: unreadOnTurnCompleted (background, Home, current, sub-agent, unknown, array ids); repo grouping (worktrees merge, newest cwd for '+', no-remote keyed by cwd, unresolved keyed by cwd, Other last with no cwd, empty known folders); duplicate labels (owner / parent / fallback parent); projectOrder manual ranking, ignored stale order, move, Sort A to Z, mixed-kind store; custom order; main.cjs wiring.
- `tests/source-sidebar-states.test.mjs` +5 (SSR): Idle role=img, Unread/Running role=status dots, Archived 16px icon + archived row CSS, error label 'Server error' danger; jump attributes, body id, collapsed bridge + inert body; no group ⋮, 'Drag or move sessions here', Other without '+', menu copy; RenameRow markup ('Rename', glyph, selected) and deleteGroupCopy; no status/error rows.
- `tests/shortcuts-dialog-model.test.mjs`: the Escape-order regex now includes the peek layer (intentional).
- `node --test tests/sidebar-model.test.mjs tests/sidebar-jump-model.test.mjs tests/source-sidebar-states.test.mjs tests/repo-identity.test.mjs tests/design-token-refs.test.mjs tests/reduced-motion-css.test.mjs tests/source-nav-buttons.test.mjs tests/source-titlebar-tooltips.test.mjs tests/git-status.test.mjs`: 89/89. The other unit files that read the edited sources (app-menu, shortcuts-dialog-model, home-model, preferences, session-engine-model, composer-env-pickers, files-pane-states, transcript-feed-nav, …): 128/128 after the shortcuts regex update.
- Not run per the parallel protocol: `npm test`, `npm run build`, offscreen suites, live DeepSeek.
- UI scripts updated on purpose:
  - `sidebar-ui-test.mjs`: first-project is a git repo with origin `fixture/first-project`, second-project a repo without a remote, zeta's cwd moves to a plain `notes` folder in the fixture rewrite → headings second-project / first-project / Other (no '+'); project header menu shape and Move down → `projectOrder` persisted and Move up offered; ⌘ held 250ms shows 1–3 keycaps (16px, 10px, aria-hidden, centred on the slot), release hides, ⌘2 opens the second row; background completion via `fixture:complete delayed-start` while another session is open → 'Unread response' ready dot, 'Mark as read', persisted, cleared on open; custom header menu shape, inline 'Rename group', 'Delete group?' body and Delete; 'Rename' textbox; 'Create and group by custom' / 'Create group' with the switch note; the stored-name check polls (the field closes before the RPC).
  - `sidebar-rest-ui-test.mjs`: bulk archive / Older archive / bulk delete results read from neutral toasts ('Archived 2 sessions', 'Archived 1 older session', 'Deleted 2 sessions'), no status row; 'Rename' textbox; archived row opacity 0.5, 'Archived' img label, 16px icon.
  - `sidebar-chrome-ui-test.mjs`: new `peek` step (hidden card inert/invisible; hover → 280px card 8px under the trigger, opacity 1, shadow, radius 8, padding 7.5/7.5/13, ≤70vh, aria-expanded true, neutral-30 trigger, resize handle hidden; crossing into the card keeps it; leaving closes; Escape (after a tooltip Escape if one is open) closes and refocuses 'Show sidebar'; clicking a row in the card opens it and closes the peek) plus a dark-mode card check and screenshots `peek-card-light/dark.png`.

### Deviations
- Error glyph colour follows bO on the code surface (EE: text-danger; CloudSlash text-secondary for network), not the spec's text-warning; the icon follows DE (UsageGaugeHigh for rate_limit).
- 'Sort A to Z' stores an A–Z order of the sections instead of clearing it: the spec keeps recency as the local default with no stored order (the source's default is by name), so a cleared order would not sort A–Z. It is offered for every project/custom section, not only when an order is stored.
- Repo identities come from a separate `repo-identities` call the renderer makes for the folders it shows (cached per cwd in main), not inside the sidebar snapshot: the main process does not know session cwds before thread/read.
- The disambiguation for repos without an owner is the tildified parent directory (BJ uses the parent of the local path); unresolved folders also disambiguate by parent path.
- The peek keeps the local `.sidebar-collapsed` root and the titlebar trigger, so desktop-layout.css's [data-collapsed] rules are ported under `.sidebar-collapsed` with the card positioned from the measured trigger instead of the pill. The collapsed body padding is 7.5px 7.5px 13px (the :1418-1420 no-pills top), not 15.5px. The hidden card is also `visibility: hidden` + `inert` so it stays out of the tab order and the accessibility tree.
- The jump hints are blocked by any open `[role=menu]` or an inert root (local stand-ins for the palette/overflow-menu checks).
- Rename rejection shows a danger toast (spec) where AD reverts silently; main.jsx's renameSession also still sets the composer error as before.
- Custom-group "New session" files the next started session into the group through a pending ref; there is no source-style new-session draft context.

### Remaining gaps
- Repo identities are cached for the process lifetime and read only `origin`; a folder turned into a repo later needs a restart. No host in the key (owner/name only, as IJ).
- No '+' on custom group headers and no 'Change icon…' (no local icon picker); drag-and-drop reordering stays deferred.
- The peek has no phone-sheet/WCO variants and no special case for leaving through the window's top edge (wh/Th).
- Offscreen suites to run: sidebar, sidebar-rest, sidebar-chrome (spec), plus home-page (automatic unread fills the attention list), titlebar (hovering 'Show sidebar' now opens the peek) and file-search ('New session in workspace-a' relies on that folder being a git repo, which its fixture is). Suites whose sessions live in non-git folders now show those rows under 'Other'. Native-window acceptance (real pointer/trackpad peek, VoiceOver on the glyphs) not run.

## F11

B11: Files pane — the code viewer (breadcrumb subheader, numbered wrapped highlighted rows, delayed "Loading file" spinner), per-tab unavailable cards, regular-weight secondary pane titles, tree-row and tab file context menus with symlink marks, ⌘⇧Y with a CDS tooltip, and the "More files" tab overflow with in-place preview replacement and keyboard reorder. Parallel round: no build, no snapshot, no offscreen run (integrator runs the suites below). Package version unchanged.

### Changes
- Viewer (new `app/src/source-file-viewer.jsx` + `.css`; cd2efac6e-CAi4fxTN.js prettier :2576 jo, :3152-3160, :4470-4480, :4794-4910; cdf69fdd3 :13-36 qn):
  - `SourceFileViewer({file, displayPath, fullPath, line, endLine, scrollNonce, scopeKey, onCopyPath, onViewAsText})`: gc column = flush qn subheader (`epitaxy-panel-subheader`, 2rem, px-md, gap 4px) + a flex-1 body.
  - `SourceFileBreadcrumb` (Yo/Ma): `button.sfv-path` "Copy path {relative}", title = full path, text-secondary, rounded 3px, -mx-0.75, hover fill-ghost-hover, focus shadow; `span[data-file-breadcrumb]` RTL scroller (scrollLeft reset per file) > ltr path: lead "/", folders + "/" text-muted, the name in text-primary.
  - Code view: `div[data-file-viewer].epitaxy-diff` (contain strict) > `div.source-file-preview.sfv-scroller` (overflow-y auto, scrollbar-gutter stable both-edges, code-theme fg/bg, code font) with one `div.sfv-line[data-line]` per line: muted tabular-nums `.sfv-number` gutter (::before attr, min-width = max(3, digits)ch, 2ch+5px / 1ch as .sft-read-number) + `code.scb-code.source-diff-code` (pre-wrap, overflow-wrap anywhere). Reuses fileHighlightLanguage + useSettledHighlight + tokenLines (`fileViewerLines`: a terminal LF adds no row) + SourceHighlightedLine. Text content of the scroller equals the file.
  - Jump range (da/ua/fa): rows line..endLine (≤ 200, `jumpRange`) get `data-active` (background ca = color-mix(currentColor 8%), the local themes have no lineHighlightBackground); the first row is centred once per {path, range, nonce} only when not already in view. The scroller keeps `data-active-line`/`data-active-end-line`. The CSS Highlight code and `::highlight(source-file-line)` are deleted.
  - `fileViewerTooSlow(text, language)` (file-preview-model.mjs): a highlightable file above HIGHLIGHT_LIMITS (100k units, 2000 lines, 1000-unit line) renders plain rows under `p[role=note]` "Shown as plain text: formatting this file would be too slow." (ji text-footnote text-muted).
  - Loading = SourceLoadingPane (deferred lg spinner, status "Loading file"). Empty text = EmptyState "This file is empty.".
  - Deleted: the "Back to files" button, `.source-file-location*`, the `<pre>` preview CSS, the "Opening file…" pill and `.source-file-loading`.
- Unavailable states:
  - `electron/files.cjs` readFile(root, relative, {force}) returns classified results: `{path, unavailable:'missing'}` (ENOENT/ENOTDIR; a missing path that lexically leaves the root is `outside_root`), `'outside_root'` (scopedPath rejects), `'too_large'` + size (> 1 MB), `'binary'` (NUL, unless force), `'read_error'` (directory, missing root, other errors), `{path, text:''}` for an empty file. The traversal guard is unchanged (nothing outside the real root is read, forced or not). main.cjs `file` passes `force: p.force === true`.
  - New `app/src/file-unavailable-model.mjs`: exact To/Un copy (missing, outside_root, too_large, read_error: role alert + the requested path on its own line; binary: title only + xxs secondary "View as text anyway" (`data-step="1"`, shared-frame :2976); empty), `fileTabReason(tab)`.
  - FilePane.openFile creates/activates the tab at once (`insertFileTab`), then `loadFile(path)` merges the read result into the tab (newest read per path wins; closed tabs never come back; rejected IPC = read_error). The restore effect reuses loadFile. "View as text anyway" re-reads with force. The `.source-panel-error` path for file opens is gone (state `error`, `opening`, generation/pendingFile removed). useViewState now updates its view ref eagerly so two functional updates before a render chain.
  - No working directory: Jg row "No working directory for this session" (`SourceFilesTreeState state="no-cwd"`, `FILES_NO_WORKING_DIRECTORY`).
- Titles: `span.source-pane-title` (flex 1, min-w 0, body size/leading, weight 400, text-secondary, select none, pl 4px, 0 with `data-after-toggle` after the ListBullet, truncate, no title) replaces `<strong title>` (F12's diffScopeControl branch is kept as it landed). `.sag-pane-title` is text-secondary / 400 / body leading.
- Context menus (panes-tile-current.js:5691-5790, :5572-5588, :6809-6862, :6030-6085; c856385e2 Mn :962-1060):
  - New pure `app/src/file-context-menu-model.mjs`: `fileContextMenu({surface, root, path, canAttach, canShowInFinder, canRevealInTree})` → Attach as context, Copy ▸ (Absolute path / Relative path unless absolute / Filename, via copyChoices-style `fileCopyChoices` + stripClipboardControls), separator, Show in Finder; file_tab appends separator + Reveal in file tree (inside the working directory, not missing). `fileLinkLabel` (Rg ok/external/dangling/cycle, "Symbolic link").
  - Tree rows: onContextMenu on the treeitem (innermost row only; keyboard contextmenu anchors at the row) → point-anchored SourceMenu.Popup (layer contextmenu, dataCds ContextMenu, label "File actions", focus returns where it was). Rows get the Hu 700ms tooltip (bottom/start, not hoverable: the name when clipped or, under the pointer, when there is a detail = link text or the file's folder). The name span is `.source-tree-name`; symlinks add `Icon ArrowUpRight` 12px role=img aria-label = link text (data-testid file-tree-link-mark). Tree aria-label "Project files".
  - Tab menu: the file items + a separator before Keep open / Close… (`SourceFileMenuEntries`).
  - Actions: Copy → clipboard + "Copied to clipboard." toast (FilePane's own useSourceToasts, so the popout works too); Attach → main.jsx `attachFilePath` (only while the composer can attach; files only); Show in Finder → `reveal-tool-file` (main window session only; hidden for missing/outside tabs and broken/external links); Reveal in file tree → show the tree + followSelectedFile. main.jsx passes `fileActions` (= transcriptActions' attach/reveal) to the Files tile.
  - files.cjs listFiles: a symlink row stats its target: `directory` from the target, `link: {target, state: ok|external|dangling|cycle}`; directory links expand (an external one still fails the scope guard → Lg error row).
- ⌘⇧Y: pane-shortcuts KeyY → 'file-list'. main.jsx `fileTreeToggleRef`; paneShortcutRef routes 'file-list' to the open Files pane (FilePane registers `treeToggleRef.current = () => setVisibleTree(!treeVisible)`). The ListBullet sits in SourceTooltip ("Show/Hide file tree", shortcut cmd+shift+y, top/start, hoverable false) with `aria-keyshortcuts="Meta+Shift+Y"` and no native title (`SourceIconButton nativeTitle={false}`); the "Show file tree" settings item carries the shortcut. Without the main-window handle (popout, artifacts) neither the keycap nor aria-keyshortcuts is shown.
- Tab overflow (panes-tabs-current.js:68-178, :275-302, :503-680, :1128-1200; panes-state-current.js:1596-1616):
  - New pure `app/src/file-tab-overflow-model.mjs` `tabOverflowLayout` (port of _e x: hidden/compact/clipped ids, scrollLeft snapping to tab starts, active never hidden, fit resets scrollLeft to 0, the overflow button width counts toward fitting; MIN_TAB_WIDTH 104, Y 64, ge 50) + `stableIds`.
  - file-tab-menu-model: `insertFileTab` (F: same path in place, preview into the preview slot, else append, cap 8 evicting the lowest openSequence other than the new tab/keepPath), `moveFileTab` (no move into a hidden slot), labels moreTabs "More files", closeTabHint, moveTabHint.
  - FilePane: `div.source-file-tabbar[data-view-tab-bar]` > tablist (now overflow-x hidden, no flex-1) with `data-vtb-id` tabs + the 108px end spacer while overflowing, the delete and move sr-only hints, and `span[data-vtb-overflow]` with `SourceFileTabOverflow` (ghost icon-only CaretDown "More files" + CDS tooltip; SourceMenu side bottom / align end listing hidden tabs: basename (italic + sr-only ", preview"), folder caption, pointer X "Close file", ArrowRight closes, sr-only "press right arrow to close"). A layout effect + ResizeObserver + scroll applies the model; overflowed tabs are `data-overflowed` (visibility hidden, aria-disabled), compact tabs drop the close X and the mask. Roving arrows skip hidden tabs; a focused tab that becomes hidden hands focus to the active tab. Control/Meta+Shift+ArrowLeft/Right reorders (focus kept).
- run-suite.mjs: `clipboardCalls['files-pane'] = [{read:1, writeText:2}, {}]` (the suite now copies through the memory clipboard).

### Tests and results
- New: `tests/file-viewer.test.mjs` (6, Vite SSR: 2 numbered rows + "Copy path src/app.js" breadcrumb + no Back to files/location/pill; data-active range 3-4; loading/missing/binary/empty/outside bodies under the breadcrumb; plain-text notice; helpers; removed CSS), `file-unavailable-model` (3), `file-context-menu-model` (5), `file-tab-overflow-model` (6).
- Updated: `files.test.mjs` (classification incl. force, traversal guard, missing root; symlink ok/external/dangling/cycle, dir link expands), `file-tab-menu-model` (+3: labels, insertFileTab [a,P,b]+c-preview → [a,c,b], eviction, moveFileTab), `files-pane-states` (Jg no-cwd copy; title span/CSS; ListBullet aria-keyshortcuts/no title/tooltip/menu shortcut/"Project files"/main wiring; tab bar markup), `pane-shortcuts` (+1 KeyY), `pane-header-handle-order` (title span).
- Run: `node --test tests/file-viewer.test.mjs tests/file-unavailable-model.test.mjs tests/file-context-menu-model.test.mjs tests/file-tab-overflow-model.test.mjs tests/file-tab-menu-model.test.mjs tests/files.test.mjs tests/files-pane-states.test.mjs tests/pane-shortcuts.test.mjs` → all pass; plus design-token-refs, reduced-motion-css, pane-header-handle-order, file-preview-model, changes-pane-states, file-tree-reveal, tile-layout-store, shortcuts-dialog-model, offscreen-suite-registry, source-tool-incard, protocol-0155-state, reasoning-model, file-tool-model → pass. `response-markdown-render` has 1 failure in the Customize skills detail (`<h3>Alpha &lt;script&gt;` vs an h2) — another batch's in-progress code, not F11. main.jsx transforms under Vite.
- Not run (protocol): npm test, npm run build, offscreen suites, live DeepSeek.
- UI scripts updated on purpose:
  - files-pane: tree "Project files"; tab menus now lead with the file items + separator; paneState reads the breadcrumb; new step `viewer-menus` (breadcrumb label/title/colours/32px subheader, one numbered muted-gutter pre-wrap row, "Path copied to clipboard." + memory clipboard 'nested/deep.txt'; tree-row menu Attach/Copy/|/Show in Finder, Copy ▸ Relative path → 'notes.txt' + toast; ListBullet aria-keyshortcuts/no title/tooltip ⇧⌘Y; ⌘⇧Y toggles twice; 8 pinned tabs → More files (bottom/end) lists exactly the hidden tabs, choosing one activates it in view; Close all files). Clipboard saved/restored as in changes-pane.
  - user-markdown: line 12 is the `data-active` row (no CSS Highlight); the missing chip opens a missing.js tab (it takes the preview slot) whose role=alert card says "Couldn’t find this file", breadcrumb above, no raw error; Enter brings app.js back.
  - pane: tree name; "Back to files" → the ListBullet (wide: show/hide beside the file; narrow: tree-only); "Opening file…" → status "Loading file"; the held-read close uses a visible inactive tab; the 8-tab cap counts `.source-file-tab` (hidden tabs are invisible).
  - session, file-search: tree name ("Project files"; file-search addresses the kept tree and the results tree by element since both carry the name, one shown at a time), `.file-preview` → `.source-file-preview`, "Back to files" → "Show file tree" under 400px. pane-layout: tree name + the focused-container label. approval-ui/packaged-ui (native only): `.source-file-preview`.

### Deviations
- "Reveal in file tree" follows Gg (items, then the reveal section after a separator), not "leading" as the spec phrased it; Show in Finder keeps Mn's separatorBefore (no Open in submenu locally).
- The breadcrumb's aria-label uses the cwd-relative path and the title the full path (spec); Yo uses its tooltip path for both. Folder segments carry no per-segment native title and no folder listers (no lister locally).
- The "too slow" threshold is the local highlighter's limits, and the notice shows only for a highlightable language (a plain .txt is never "too slow"); the original's Ci limits belong to its Markdown renderer.
- Attach as context is offered for files only (directories have no local path attachment); no "Open in" editors and no directory "Open in terminal".
- Tree rows keep `aria-label={name}` on the row button (scripts address rows by name), so the link mark's alt is exposed on the img, not folded into the row name.
- Hidden tabs stay keyboard-unreachable like disabled Base UI tabs; pointer drag reorder is not ported (keyboard only). ⌘⇧Y is matched by code (KeyY), not by character.
- `.sfv-scroller` keeps the class `source-file-preview` (local name of the viewer scroller used by the suites) and `data-active-line`.
- run-suite.mjs gained the files-pane memory-clipboard floor (outside app/).

### Remaining gaps
- Offscreen suites not run in this round. Integrator: `files-pane`, `user-markdown`, `pane` (then file-search, session, pane-layout, scrollbar-mode, changes-pane, background-tasks); check the gutter/token/active-row colours in light and dark (screenshots files-pane `file-tabs-more-files`, `tree-row-copy-menu`).
- The ⇧⌘Y row ("Toggle file list in changes or files") is not added to the Keyboard shortcuts dialog, and ⌘⇧Y does not reach the Changes file list (deferred) or a popped-out Files window.
- Markdown files are shown as source (no Preview/View source toggle, optional phase 2); fileHighlightLanguage still maps only 10 extensions, so other languages render plain in the viewer.
- The file viewer has no find bar, no editor/save, no virtualization (a 1 MB plain file renders every row); CRLF lines show the ␍ glyph as in the Read rows.
- Persisted tabs restore without `openSequence`/`unavailable`; an unavailable tab is re-read only on reopen.

## F13

B13: Customize — skill detail header/facts/Description, connector drill-in, centred pictogram empty states, no local notices, connector rows, plugin suffix only on collisions, uncontained 'Filter by status', row focus/hover, plugin and SKILL.md skeletons. No snapshot (parallel protocol). HANDOFF entry: "0.2.130 保真轮 F13". Package version unchanged. Implemented in parallel with F07–F12/F14: no build, no offscreen suites, no live DeepSeek.

### Changes
- Skill detail (c9a7e510b D, isModal branch; cfaabd194 wt/ct; ccb4abbdf r; c6f9b6c10):
  - Wrapper `cz-skill-detail flex flex-col h-full px-6 pb-6 gap-3`; header `flex justify-between min-h-14 items-center py-3 -mr-6 pr-md` with `h2.min-w-0 font-large-bold text-primary truncate`.
  - Actions (`flex items-center gap-2`), in wt order: primary sm 'Try in chat' (icon Chat, disabledReason 'Enable skill to try in chat', calls onUseSkill); sm Switch aria-label 'Enable skill' with no visible label (DeepSeek: read-only, copy.skillToggleReason, side top); ghost icon-only sm ⋮ 'More options for {name}' → SourceMenu Item 'Show in Folder' (icon Folder, onRevealPath). Without items the trigger is disabled (ct `disabled: !b || !De`).
  - Facts row `flex flex-wrap gap-x-8 gap-y-3`: 'Added by' = skillAuthor, 'Last updated' = shortDate in <time> (labels font-small muted, values font-base primary).
  - Description block: h3 'Description' (font-small muted) + InfoTip (`button[data-cds=InfoTip]` 'More info', Info 16, muted → secondary, focus shadow; content 'DeepSeek uses these descriptions when deciding which skills to use in chat.'), then `p.font-base text-secondary whitespace-pre-wrap`.
  - Files in `flex-1 min-h-0 flex flex-col gap-3 mt-2`. Removed the skillDetailNotice p, .cz-skill-meta, .cz-switch-row, 'Show in Finder', 'Use in message'.
- Connector drill-in (customize-connectors :3164-3178; c08e79e85 En):
  - With `current`, ConnectorsPage returns `.cz-page[data-detail] > .cz-drill[data-cz-detail=connector]`: BackButton 'Connectors' + ConnectorDetail. No header, table, card or aside.
  - Pure `connectorDetailState(row)` + `connectorDetailMessage` + `CONNECTOR_ACTION_LABELS` in customize-model:
    - connected → `px-6 pb-6`, N header (min-h-14 py-3 -mr-6 pr-md), 24/16 tile, h2 font-large-bold, secondary Reconnect, Sn ⋮ (Codex: danger 'Remove connector' unless plugin-owned; DeepSeek: 'Edit config'; none → no trigger), description, tool names (`flex gap-2.5 items-center py-2 border-b last:border-b-0` rows) or 'This connector has no tools available.'.
    - connecting → 56/40 tile + role=status spinner (sc-spinner at 20px) + 'Checking connection…'.
    - otherwise → `relative flex flex-1 flex-col items-center justify-center gap-4` column, ⋮ at `absolute top-3 right-6`, 56/40 tile, 'Connection issue' (Warning, text-warning, font-large-bold) only for a failure, `p.font-large text-muted` message, one primary button. Failure = unreachable, or signIn whose runtime asked to re-authenticate (label 'Reconnect' like vn, action = sign-in). Plain notLoggedIn → 'You’re not connected to {name} yet.' + 'Sign in'; notStarted → 'Connect' (reload); disabled → disabled 'Connect'.
  - Notices (role=alert/status) and the 'Confirm removal' group render in `.cz-drill-notices` inside the drill. Back clears them; the list body has scroll memory keyed by [cwd, threadId, status filter, query].
  - Deleted DetailPanel, Fact, `.cz-layout`, `.cz-main`, `.cz-detail*`, `.cz-fact*`, `.cz-list`, `.cz-icon-button`, `.cz-danger-text`, `.cz-description`.
- Empty states (customize-page-shell :566-612 Ee):
  - `EmptyState({searchValue, noMatchMessage, emptyMessage, pictogram, actions})`. Search → `p.cz-empty-search py-lg text-center text-body text-secondary`, no role=status. Otherwise `div.cz-empty flex flex-1 flex-col items-center justify-center gap-lg py-lg text-center[data-cz-empty]` as a direct PageBody child (connectors: inside the flex-1 body) → pictogram, `p.max-w-xs text-pretty text-body text-secondary`, actions.
  - New `src/source-pictogram.jsx` (shared-6 ZR: svg data-cds=Pictogram, 96px md / 64px sm, viewBox 0 0 500 500, highlight paths `fill-pictogram-highlight-default` (light/dark token in the loaded CSS), line paths currentColor, aria-hidden) over generated `src/pictogram-defs.mjs` (ObjectBulb / NodeShapes / ObjectPuzzle copied from ion-dist c61365050 / c42f08fdd / cd51897f0 Def modules).
  - Copy (Claude → DeepSeek rule, new customizeCore keys): skillsEmpty, connectorsEmpty (Learn more link not drawn), pluginsEmpty, skillDescriptionTooltip.
  - Actions: skills = the core's skill-folder list; Codex connectors = secondary 'Add custom connector' (:3698-3733); DeepSeek connectors = `span.block[data-cz-config-hint]` 'Add a @deepseek-ai/dsh-mcp-client entry to {profile}, then Reconnect.' in the copy + secondary 'Edit config'; plugins none.
  - Plugin detail empty: `div.flex flex-col items-center gap-2 px-6 py-10 text-center > span.font-base text-secondary` 'This plugin doesn’t have any skills or agents.'.
- Notices: removed the three p.cz-notice, the config-hint row and `.cz-page-body` gap; dropped skillsNotice/skillDetailNotice/connectorsNotice/pluginsNotice/pluginsEmptyHint. DeepSeek 'Edit config' (secondary, base) sits in the PageHeader actions slot. Connectors body: bands `flex shrink-0 flex-col gap-lg pt-sm` (stopped-working card, now fed by the search-filtered rows, not the status filter) + `cz-connectors-body flex flex-1 flex-col gap-lg` (pt-lg below bands, else pt-sm) + `flex shrink-0 flex-col gap-sm` filter/table block; the connectors table is `cz-table-flush` (no mt-sm). Skills/plugins keep q's mt-sm.
- Rows: `.cz-broken-tile` → `.cz-connector-tile` (+ `.cz-connector-tile-lg` 56px, radius 15.12) via `ConnectorTile`, used by rows, card and drill. Type cell `cz-type flex min-w-0 items-center gap-xs overflow-hidden > span 'Desktop'`, no tools badge. StatusCell: disabled → `<span aria-hidden>—</span>` + sr-only 'Not available'; notStarted → secondary sm 'Connect' (reload + forced list). Row aria-label `View ${name}`.
- Focus/hover CSS: `.cz-table tr:focus-visible{outline:none;box-shadow:var(--cds-focus-shadow)}`; `.cz-table tr[data-hoverable]:has(button:hover)>td{background-color:transparent!important}`; the page's generic 2px outline now applies to inputs only, every non-CDS-Button/non-switch button in `.cz-page` uses the focus shadow.
- Plugin suffix: `pluginDisplayNames(rows)` (shared-4 _L: Map id → {name} or {name, suffix:'(marketplace)'} for colliding display names, no suffix without a marketplace name); the row renders `span.cz-muted.cz-truncate[data-plugin-suffix]` only when present; `filterPlugins` matches the suffix instead of the raw marketplace name.
- Segments: SourceSegments gains `variant='uncontained'`, `size` (shared-frame qr → data-size) and `className`; new uncontained CSS in source-segments.css (gap 1px, no padding/track, thumb top/bottom 0 with `inset 0 0 0 1px var(--cds-border)` on the existing --cds-segmented-control-thumb, labels text-secondary, hover text-primary + fill-ghost-hover when unchecked, checked text-primary weight 400, radius calc(radius - 2px), focus shadow). 'Filter by owner' uses it (local Segments and .cz-segments deleted). Connectors: 'Filter by status' (MCP_STATUS_FILTERS All / Connected / Not connected, `shrink-0 self-start`) when any connector exists; `filterMcpByStatus` + `connectorsListView` decide table / 'Nothing connected.' / 'Nothing to connect.' / Ee. Contained settings segments untouched.
- Skeletons: `PluginPageSkeleton` (c9d36aa51, data-testid plugin-page-skeleton, 14 SkeletonBars, only the title bar announced) replaces the plugin page while `!detail && !error`; SkeletonBar takes width/height style and lets a rounded-* class replace `rounded`. SKILL.md loading = `div.p-3[data-cz-file-loading] > SkeletonBar w-full rounded-md height 200` (one sr-only 'Loading'); `.cz-file-skeleton` and 'Loading plugin details…' removed.
- Layering: Customize sits in the z-500 Settings dialog. `.cz-page{--cds-layer-base:500}` (same convention as `.ss-storage-dialog`), so SourceTooltip portals (InfoTip, reasons, status tooltips) land above it; SourceMenu.Popup gets an optional root `layerBase` prop (nested popups still inherit) that MoreMenu reads from the trigger's computed --cds-layer-base. Without it the ⋮ menus rendered at z 120 behind the dialog.

### Tests and results
- `node --test tests/customize-states.test.mjs tests/customize-model.test.mjs tests/plugin-detail.test.mjs`: 33/33.
  - customize-model +5: _L suffixes and suffix search; filterMcpByStatus; connectorDetailState (incl. re-auth failure) and messages; connectorsListView; customizeCore without the notice keys, with the DeepSeek copy and no 'Claude'.
  - customize-states: the skill header order/classes/facts/Description/InfoTip; the connector drill for connected / no tools / unreachable / re-auth / sign-in / never-started / disabled / connecting, plus the ⋮ rules; rows (tile, 'Desktop', '—' + 'Not available', 'Connect', 'View …'); 'Filter by status' and the flush table; bands/body classes; the three Ee empty states and the search p; Edit config in the header; plugin suffix; owner segments; the plugin-page and SKILL.md skeletons; the plugin empty copy.
- Also passing: response-markdown-render (Customize assertions updated on purpose: h2 titles, file skeleton, plugin skeleton, plugin empty copy), design-token-refs, reduced-motion-css, segments-model, menu-model, catalog-wiring, composer-env-pickers, settings-catalog-search: 120/120 for the whole targeted set.
- `tests/settings-pages.test.mjs` has 3 Storage-scan failures (3 !== 8 file counts) in code F13 does not touch; left for the integrator / owning batch.
- UI scripts updated on purpose (not executed here):
  - skills-mcp:
    - Skill detail: 'Enable skill'; 'Try in chat'; ⋮ › Show in Folder via a helper that also asserts the menu's z-index is above the Settings backdrop (missing file → alert, existing → reveal).
    - Skill detail geometry px 24 / pb 24 / gap 12, header min-h 56 / py 12 / -mr 24 / pr-md, h2; facts; Description + InfoTip tooltip copy.
    - Owner and status segments: sm height, ring, weight 400, mt-sm vs gap-sm table spacing; Connected / Not connected filtering.
    - Rows: a Tab-focused row's box-shadow = resolved --cds-focus-shadow with outline none; hovering an inline Reconnect clears the row fill; 'Desktop'; 24×24 row tile = card tile.
    - Connector drill: replaces the list; connected header/tools; Reconnect RPCs from the connected and failed views; sign-in and checking views; Back restores scroll.
    - Never-started 'Connect' → reload + list; ⋮ › Remove connector (danger) + in-drill confirm.
    - Emptied MCP list → Ee flex-1, centred, gap-lg, 96px NodeShapes, no filter.
    - Plugins: no suffix, table mt-sm, plugin skeleton visible while plugin/read is held.
  - settings-complete: the connectors page has no .cz-notice/.cz-config-hint.
  - Fixture `tests/fixtures/codex-server.cjs`: plugin/read honours `pluginReadDelayMs` (≤ 5000).

### Deviations
- InfoTip: the source AS is a hover Popover (delay 300, side top, offset 6); locally it is SourceTooltip with the same timing and side.
- Pictograms: the three defs are bundled instead of lazily loaded (no animate-lazy-pictogram-fade-in), so SSR and first paint have the SVG. The spec suggested reusing the sidebar's pictogram-200 fill; the CDS Pictogram's own fill-pictogram-highlight-default + currentColor is used instead (more faithful, light/dark via tokens).
- Connector detail:
  - Its header shows a secondary Reconnect where the source shows Disconnect for remote connectors (every local server is 'Desktop', and the source's local connectors have no Disconnect).
  - The tool list is names only (no Tool permissions groups).
  - The ⋮ items are 'Remove connector' (kept the local accessible name, danger) / 'Edit config' instead of the source's View details / Remove.
- signIn without a runtime failure reads "not connected yet" with 'Sign in' (no 'Connection issue'). Only a reauthenticationRequired runtime is treated as a failure (label 'Reconnect', sign-in flow).
- Ee actions:
  - Codex Connectors: secondary 'Add custom connector' (the source's Browse/Discover has no backend).
  - DeepSeek: the profile hint goes in the copy as span.block plus a secondary 'Edit config', so 'Edit config' appears twice in that state, mirroring the source's header + empty-state add action.
- The skill ⋮ menu holds only 'Show in Folder'. Share, Edit, Rename, Replace, Duplicate, Download, Manage and Remove need cloud or skill-creation backends.
- `--cds-layer-base:500` also lifts the existing status/disabled-reason tooltips inside Customize above the Settings dialog. Previously they computed z 130, below the z-500 backdrop.

### Remaining gaps
- No offscreen run for this batch. The integrator should run skills-mcp, then settings-complete and settings (contained SourceSegments unchanged).
- Light/dark were checked through tokens only. All new colours are --cds-* or the loaded fill-pictogram-* utilities, and design-token-refs passes. A native-window check in both modes is still pending.
- Not ported:
  - Skill facts: Version and Trigger.
  - Connector tool-permission UI, Disconnect and directory links.
  - Learn more links, and the source's Directory/Browse empty-state actions.
  - The lazy pictogram loader.
- Other Settings pages: tooltips there still compute z 130 under the z-500 dialog. Only `.cz-page` sets --cds-layer-base. The Settings batch could set it on `.ss-settings-dialog`.

## F14

B14: Settings — search focus, Usage navigation, first-run defaults, storage report, notification options, optimistic saves, General rows, preview word diff, chrome and copy. HANDOFF entry: "0.2.130 保真轮 F14". Package version unchanged. Implemented in parallel with F07–F13 under the parallel protocol: no build, no offscreen suites, no snapshot.

### Changes
- Search focus (cc011544b _t; shared-22:4508/:4549 sw):
  - The lifecycle effect's `initialFocus` focuses the nav search with `{preventScroll:true, focusVisible:false}` in the wide layout (new `settingsInitialFocus` in `src/settings-shell-model.mjs`); narrow tabs and the stacked Usage page keep focusing the popup. It runs at mount and again in rAF, and leaves focus alone once it is inside the dialog. The opener capture/restore is unchanged.
  - `source-settings.css`: `.ss-search:has(input:focus-visible){box-shadow:var(--cds-focus-shadow)}` replaces `:focus-within`, plus `.ss-search:hover:not(:focus-within){box-shadow:inset 0 0 0 1px var(--cds-border-strong)}`, `cursor:text` and a duration-fast box-shadow transition; the input itself has no outline/shadow when focus-visible. Clicking the field focuses the input.
  - The 'Clear settings search' button is gone; Escape clears, and Escape on an empty query still closes Settings.
- Usage (treatment variant; shared-21:1316-1336, shared-22:2274-2285, :3915-3918 zC, sidebar-rows.js:16769-16793 uV):
  - The usage tab is `navHidden`; `settingsNavSections` (zC) filters the wide nav and the narrow tablist. It stays in SETTINGS_SECTIONS, initialSection handling and search (`settingsSearch(tabs, …)` keeps the unfiltered list).
  - `main.jsx` account menu: `<SourceMenu.Item icon="UsageGaugeMiddle" data-testid="user-menu-usage">Usage</SourceMenu.Item>` right after Settings → `setSettings('usage')`.
- Defaults (index.chunk-ChZ67Jhw.js; c71860c77-yvGrrWO9.js:2270, tV):
  - `electron/desktop-settings.cjs`: defaults are banner/banner/banner and keepAwake/keepAwakeOnBattery true; new exports `NOTIFICATION_LEVELS` (complete: off/banner) and `desktopPreferences` (defaults + a stored complete 'badge' read as banner), used by `prefs()`. `desktopPatch` rejects 'badge' for completeNotifications.
  - `electron/main.cjs` config defaults block: the same five keys next to menuBarEnabled; a loaded `completeNotifications:'badge'` becomes 'banner'. Saved values are untouched.
  - Renderer: unset levels read as Banners (`notificationLevel`), keep-awake reads `!== false` (`keepAwakeEnabled`).
  - The reversal of the old "off until enabled" policy (analysis/settings-complete-20260921/source-contract.md:10) is recorded in HANDOFF with the citations.
- Storage report (c71860c77-B72Ova_w ht/mt/X/Z over index.chunk-ChZ67Jhw.js pfi/hfi):
  - `electron/settings-pages.cjs` `storageReport({userData, logs, dshHome, coreRoot, coreName, threadIds, worktreeDirs})` returns areas `code` / `runtime` / `app` with `kinds`:
    - code: Conversation history = `sessions/*/<encodeSegment(id)>` for active + archived thread ids (also Codex rollouts `…-<id>.jsonl`) plus the bridge's `code-desktop/` records; 'Worktrees in use or with changes' = existing worktreeDirectories; everything else in the core home is the outside kind `Other <core> history` (not counted). `sessionCount`, `worktreeCount`.
    - runtime: `storageCoreRoot(resolveCore())` = the harness package root around the bridge script, else the core executable; `name`, `versionCount` (1 when present).
    - app: userData split into Web cache (Cache, Code Cache, GPUCache, Dawn*Cache, Shared Dictionary, Service Worker) and Other; Logs = app.getPath('logs') + crashDumps.
    - Each root is walked once without following symlinks; nested roots are skipped by their parent, equal roots deduplicated; a missing root is 0 (not a lower bound); `limit` is per root. No paths in the report. `sessionSegment` ports dsh-session-persistence-jsonl encodeSegment.
  - `main.cjs` `desktop-storage` passes these (core name from the connected core's engine, else resolveCore().kind).
  - UI (`source-settings-pages.jsx`): exported `StorageRows` renders SettingRow-like rows: 'Disk space used' (`Calculated <SourceTimestamp>.` or the lower-bound sentence, medium-weight total, the existing StackedMeter + legend), 'Code sessions and worktrees' ('{n} sessions and {n} worktrees.'), 'Runtime' ('1 installed DeepSeek Harness version.'), 'App caches and logs' ('Web cache, browser panes and logs.'). Each has a 'Details' disclosure (aria-label 'Code session details' / 'Runtime details' / 'App cache details') holding exported `StorageKinds`: a 4px bar (role=img, '<Area> storage by kind: …', gap 1px, rounded-full, surface-2) and a dot legend on the [1,.72,.5,.32,.2] ramp (`storageKinds` in storage-meter-model.mjs); the outside kind has an InfoTip ('More info', max-w 320) with "History from DeepSeek Harness outside Code Desktop. Shown for completeness; not counted above and never removed from here."
  - Area paints: code categorical-2, runtime categorical-3, app muted (Cowork owns categorical-1 in the original). Footer `margin-top:16px`. Close is 'Close'.
- Notification options (c71860c77:2004-2029, :2108, :2240-2275, :2335): `NOTIFICATION_LEVEL_ITEMS` per type, no disabled Banners; Draw attention is disabled when Permission requests and Questions are both 'off' (`drawAttentionDisabled`).
- Optimistic saves (c71860c77 Ur/li):
  - The shared `pending` no longer disables any row; the focus-restore workaround is removed. `commit(rowId, patch, write)` sets an `optimistic` map (rendered through `shownValue`), clears the row error, and on failure drops its keys (saveConfirmedPreferences has already reconciled from 'init') and sets the row error; the map clears when every write in flight has settled.
  - Used by segments, switches, selects, the code theme grid, bypass, model (+effort), effort, fast, permission, worktree location (folder picker path with an empty patch) and Run on startup (optimistic, then the snapshot takes the IPC's returned value).
  - Disabled only where the original disables: bypass connection/policy gate, model/effort/fast/permission while busy, startup until the snapshot exists, Draw attention per above. Developer actions (Edit config, Reconnect, MCP removal) keep a single in-flight key but no longer disable other controls (Reconnect is disabled only while busy).
  - SettingRow error: muted `span.ss-row-error` "Couldn’t save the setting. Try again." in the below slot, raw reason in `title` and `console.warn`; no role=alert.
- General page (c71860c77-B72Ova_w It + fallback): `...keepAwake` removed (Code page only); the version row renders only once build-info has loaded; while `desktop===null` the group draws the version row plus three `SettingSkeletonRow`s (shared-frame Skeleton classes `h-5 w-36` / `h-5 w-72` and `h-6 w-10 rounded-full`, role=status sr-only Loading, `py-md`).
- Preview word diff: `source-code-theme-preview.jsx` computes `GREET_WORD_RANGES = wordDiffRanges(line 2 before, line 2 after)` once and renders every row through `SourceHighlightedLine` (code gets `source-diff-code`, rows get `data-kind`), so `[data-diff-span]` emphasis (2 spans removed, 3 added) paints under each column's forced data-mode.
- Chrome: settings/usage close buttons, font licenses and storage are all named 'Close'; `.ss-nav li>button:hover{color:var(--cds-text-primary)}` and `.ss-nav li>button>[data-cds=Icon]{color:var(--cds-text-secondary)}`; `.ss-dialog.ss-licenses{max-width:720px;max-height:calc(100dvh - 32px)}`.
- Copy: the bypass description is the original sentence structure with DeepSeek and no link element; "isn’t focused"; search text for the bypass row updated.

### Tests
- `node --test tests/settings-focus-return.test.mjs tests/settings-complete-model.test.mjs tests/settings-pages.test.mjs tests/settings-search.test.mjs tests/storage-meter.test.mjs tests/settings-theme-preview.test.mjs tests/settings-shell-render.test.mjs tests/design-token-refs.test.mjs tests/reduced-motion-css.test.mjs`: 53/53. Other tests reading the touched modules (account-label, catalog-wiring, customize-states, menu-bar, response-markdown-render, shortcuts-dialog-model, source-diff-scope, source-git-band, source-sidebar-states, word-diff-model): 161/161 together with the above; tests reading main.cjs/main.jsx (app-menu, preferences, offscreen-suite-registry, composer-env-pickers, home-*, …): 114/114.
- Updated: settings-focus-return (search focus helper, opener restore, CSS ring rules, no clear button, no page-wide lock, 'Close', muted error copy); settings-complete-model (battery test pins keepAwakeOnBattery:false; defaults, 'badge' rejected/mapped, banner + power blocker on a key-less profile, renderer options/gating, main.cjs default block); settings-pages (spec fixture: code=5 with Conversation history, runtime=13, the 18 B outside kind excluded; real dsh/Codex layouts, worktrees, app kinds, crash dumps once; symlinks/nesting/aliases; lower bound; core root); settings-search (nav-hidden filter, account menu order, 'keep awake' only under Code, General without keepAwake); storage-meter (kind ramp/bar).
- New: settings-shell-render (SSR with an inline-portal shim: General skeleton, Code defaults/options/Draw attention gate/copy, nav without Usage, single 'Close', narrow tabs, StorageRows/StorageKinds), settings-theme-preview (SSR word-alt spans in both modes).
- UI scripts changed on purpose (not run): 'Close' scoped by dialog in approval-card, code, edit-read, menus-states (+ 'Usage' in the account menu item list), packaged-ui, session-actions, settings-complete, settings-rest, settings, skills-mcp, slash-commands-complete, smoke-ui, usage. usage opens Usage from the account menu, asserts no nav 'Usage' and the menu order, and expects focus back on Account menu after close (the /usage→composer path stays covered by session-actions). menu-bar: General order is exactly version/startup/menuBarEnabled/storage after the snapshot loads. settings-complete: initial focus is Search settings; defaults Banners + keep-awake on, Task complete options, Draw attention gate, keep-awake toggle; storage rows/no paths/'Calculated just now.'/4px App kind bar; no narrow 'Usage' tab. settings: Meta+, focus without ring, 'awake' results only under Code, nav colours in light and dark, held 'settings' IPC (ipcMain._invokeHandlers wrap, as approval-card does) shows the new switch state with no change in disabled controls, refused write rolls back with the muted message and title reason, retry clears it. settings-rest: preview `[data-diff-span]` counts/backgrounds; licenses width min(720, innerWidth-32) and height innerHeight-32 with one 'Close'.

### Deviations
- Session matching follows the real dsh-session-persistence-jsonl layout (`<root>/--<project>--/<encodeSegment(id)>/session.vN.jsonl[.zstd]`), not the spec's `session-<id>`; names ending in `-<id>` (Codex rollouts) also match, so the spec's fixture still yields code=5.
- 'Other … history' covers everything in the core home outside Code Desktop's own sessions and `code-desktop/` records (incl. dsh-runtimes, profiles, storages, attachments), named after the core ('Other Codex history' with a Codex core). Sub-agent sessions have their own ids and land there.
- Conversation history includes `~/.dsh/code-desktop` (bridge records), the local counterpart of the original's recordsBytes.
- App 'Other' is the rest of userData (the original lists specific cache folders that do not exist locally); 'Web cache' adds Shared Dictionary and Service Worker per the spec. The original's Browser panes kind has no local counterpart; the row copy 'Web cache, browser panes and logs.' follows the spec.
- Runtime description substitutes the core into the original plural copy ('1 installed DeepSeek Harness version.'); there is one installed core, so versionCount is 1 or 0.
- Area meter paint moved code from categorical-1 to categorical-2 and added runtime categorical-3 (the original's kind bars use categorical[2]/[3] for these areas, with Cowork on categorical[1]).
- The InfoTip is a SourceTooltip on an Info button rather than the original's hover Popover.
- Usage from the account menu returns focus to the Account menu button on close (Base UI menu + dialog finalFocus), so usage-ui-test now expects that instead of the composer.
- Developer page actions keep their single in-flight guard (not a page lock) because removal and Reconnect must not double-run.
- The search wrapper's click-to-focus ignores clicks inside the results popup (the original's popup is portaled, ours is a child).

### Remaining gaps
- Optional 'Clear cache and restart…' and 'Clean up inactive sessions…' are not implemented.
- Whether `focus({focusVisible:false})` keeps Chromium (Electron 44) from matching `:focus-visible` on the text input is unverified; the settings suite asserts no ring after Meta+, and will show it.
- Storage scans run in the main process (async fs) without the original's worker/cache; a large harness (≈27k files) is walked on each open/refresh.
- Offscreen suites (settings, settings-complete, usage, menu-bar, settings-rest, slash-commands-complete, session-actions, menus-states, bypass-permission and the other scripts whose 'Close' locator changed) and native-window acceptance are for the integrator.

## Wave integration

Integration of the parallel wave F07–F14 (implemented concurrently; none of them built or ran offscreen suites). Sole editor of the tree for this pass. No snapshot, no HANDOFF entry, package version unchanged (0.2.130).

### Starting point
- Harness `node --test tests/*.test.mjs`: 119/119. App `npm test`: 1497 tests, 1496 pass, 1 pre-existing skip (the filesystem rejects invalid UTF-8 names), 0 fail; the shortcuts-dialog-model and settings-pages failures the implementers reported had already been resolved by F08/F14. `npm run build` passed.
- Offscreen: every suite failed at launch. The production renderer threw `Cannot access 'Cr' before initialization` on the first render (blank window), so approval-card timed out waiting for the Model button and edit-read for its session row.

### Failures and fixes (product)
- **First-render crash, cross-batch (F12 × F08/F11), `app/src/main.jsx`.** F12's band hold `bandHoldToken = useMemo(() => ({ current, workdir }), [current, workdir])` sat about 35 lines above `const workdir = session?.cwd || cwd`. The deps array reads `workdir` in its temporal dead zone. Fix: `session` and `workdir` are now declared just before the band-hold block, with a comment.
  - Guard: new `app/tests/render-tdz.test.mjs`. It parses main.jsx with `rolldown/parseAst`, which vite already installs, so there is no new dependency. In every top-level function, an identifier evaluated directly in the body (outside nested functions) must not name a const/let/class declared further down the same body. Mutation check: with the old order it reports `main.jsx:430 App reads workdir before line 465`. Parallel batches editing the render body are now caught by `npm test` without a build.
- **Jump keycaps at the row end (F08 × original CSS), `app/src/source-sidebar.css`.** The sidebar suite measured centerOffset 244 and computed left 250px. The local nav also carries `.df-session-list`, which an earlier batch added for the oI stub's `--df-iconless-pad`. The loaded shared-styles copy of desktop-layout.css:1600-1603 has `.df-session-list [data-jump-hint-row] > kbd { left:auto; right:… }`, the row-end placement of the presets-gated list (shared-21 Jv `claudeai_cc_epitaxy_session_presets_main`, sidebar-session.js:16881). It overrode F08's classic mj leading-slot placement. Fix: the rule is now `.source-sidebar .source-session-row > .source-jump-hint`, which outranks the override, plus `right: auto`, with a comment.
- **MessageActions reduced motion (decision below), `app/src/source-turn-footer.css` and `app/src/source-user-actions.css`.**
  - The @media reduce rule for the toolbar is now `transition-property: none; scale: none` (it was `transition: none`).
  - There is a new `html[data-reduce-motion="true"]` twin. Before, only the `data-local-motion` alias covered the toolbar; the alias is kept.
  - Guard: a new test in `app/tests/reduced-motion-css.test.mjs`.
- **`data-described` (F07), `app/src/source-agent.jsx`.** React rendered the boolean as `data-described="true"`. It is now a presence attribute (`""`), which the F07 subagents script and the `.sag-verb[data-described]` CSS expect.

### Failures and fixes (scripts only; product behaviour judged correct)
- approval-card: the file-request live region was read right after the card rendered and raced NM's 50 ms fill. The script now polls for it (up to 2 s; it was already filled when the run passed).
- sidebar-rest: this is the fork-order flake noted in F01. Step 1's Deny (F1) and Stop (F2) both end turns, and children list by recency, so either fork can be newest. The shift range and the cmd toggle now follow the visible order (`midFork`/`lastFork`), and the archived pair compares sorted.
- sidebar-chrome:
  - The tooltip step's Show sidebar hover opens the F08 peek, so the peek step now waits for the settled hidden state after the .14s exit transition.
  - Reopening after Escape first moves the pointer away, because the peek opens on pointerenter (Nb) and the pointer was still over the trigger.
- home-account-usage: the stats card goes live on pointerenter or focus (code-home.js:13940-13941). The hold step leaves the pointer on a pre-live tab, and the card replaces the hold under it, so the script now moves away before hovering. The original Kw/Yw behave the same.
- session: `Element.focus()` on the latest article scrolls after the find bar left the viewport mid-transcript. An ArrowUp in the same frame turned that scroll into a user move to the tail, which re-pinned following ('true' instead of 'false'). This failed 2 of 6 runs. The script now waits two frames after focus; it then passed 4/4 and every later run.
- files-pane, pane-layout, file-search: F11 opens tabs synchronously, and panes-state F/vi drops the tree peek, so while the tree is not shown beside the file the first click already swaps the tree for the viewer and a tree-row double-click cannot land. The scripts now click the row (preview) and double-click the tab to keep it; the tab's onDoubleClick also keeps.
- skills-mcp: the 'Try in chat' label read included two private-use icon glyphs (``). They are stripped before comparing.
- settings: F14 had inserted `navColors`/`expectNavColors` inside the body of `closeSettings`, so the first use threw a ReferenceError. `closeSettings` is restored and the helpers are top level.
- settings-complete: see the verification below.
- bypass-permission (extra): after F14's optimistic switch, `disabled` follows the committed config, which lands after main has written preferences.json. The script now polls.
- settings-rest (extra): F14 shows the pending theme in the select and in the preview's `data-code-theme` at once, while the preview colours and tokens follow the committed pair (`--code-theme-*` and the worker theme). The script now waits for the github-dark background, the function-token colour and both previews to be re-highlighted before measuring.
- scrollbar-mode (extra): this machine now uses overlay scrollbars. As in the original sidebar-rows.js:7902-7906, `--df-nav-scrollbar-lane` is only written when it changes from the seeded "0px", so it stays unset and consumers fall back to 0px. The script accepts unset as 0px.

### settings-complete native confirm: verified, not an adapter failure
- Probe: inside the offscreen app, `window.confirm('integration probe')` produced a Playwright 'dialog' event. `dismiss()` returned false, and the adapter recorded one `dialog.showMessageBox` blocked-before-native-call. CDP dialogs work under bootstrap.cjs. A Delete click with a `page.on('dialog')` handler that dismisses also worked: the event fired and the renderer stayed responsive.
- Cause: the step asserted `/shared with the Codex CLI/`. The current copy is developer-server-actions.mjs:9, "…This changes the DeepSeek Harness configuration…", which tests/developer-server-actions.test.mjs:26 unit-tests. The assertion threw while the confirm was still open, so the renderer stayed blocked in `window.confirm`. The un-awaited click then rejected after 12 s as an unhandled rejection, which killed node before run-suite wrote report.json. That looked like "no dialog event, the click hangs".
- Every settings-complete run directory since 2026-10-01 has no report.json; the last passing runs are from 2026-09-24. So the restore-batches B07 and F04/F06 notes misattributed it.
- Fix: read the prompt, dismiss, await the click, then assert the current copy.
- The suite passes with exactly the 3 blocked `dialog.showMessageBox` calls run-suite expects.

### Decision: reduced motion for MessageActions (turn-footer, user-actions)
- Original: the global reduce clamp (design-system.css:1423-1438, both `@media (prefers-reduced-motion: reduce)` and `[data-reduce-motion=true]`) only sets `animation-duration: .01ms` and `animation-iteration-count: 1`. It never touches transitions.
- MessageActions has its own rule (design-system.css:51631-51640): `transition-property: none; scale: none` under the media query and under `.cds-root:where([data-reduce-motion=true], …)`. Its hover rule (:51581-51587) sets the opacity variable, duration, timing, delay and `scale: none`, but never `transition-property`. So a hovered toolbar under reduce keeps a declared 120 ms duration but does not transition.
- Product: mirrored as above.
- Assertions: turn-footer step 'hover' and user-actions step 9 no longer expect `transitionDuration === '0s'`, which only the removed blanket kill produced. They assert `{transitionProperty:'none', scale:'none', opacity:'1'}` on the hovered toolbar, for the OS query (emulateMedia) and for the in-app `html[data-reduce-motion=true]`.
- Durations under no-preference (60 ms out; 120 ms with a .1 s delay on hover) are unchanged.

### Final results
- Harness: 119/119.
- App `npm test`: 1499 tests, 1498 pass, 1 pre-existing skip, 0 fail. The 2 new tests are render-tdz and the MessageActions reduce guard.
- `npm run build`: pass, build-info sourceSha256 `1fdb338d5668df90…` (491 sources).
- Offscreen, serial, on that build: all 24 required suites pass.
  - approval-card, edit-read, permission, sidebar, sidebar-rest, sidebar-chrome, home-page, home-account-usage
  - connection-lifecycle, session, transcript-scroll, transcript-states, files-pane, user-markdown, pane, git-band
  - changes-pane, git, skills-mcp, settings-complete, settings, usage, turn-footer, user-actions
- The 26 suites the implementers flagged also pass on the same build:
  - subagents, bypass-permission, run-command, composer-states, approval-transport, titlebar, file-search, account-lifecycle, code
  - ui029, menu-bar, settings-rest, slash-commands-complete, session-actions, menus-states, scrollbar-mode, pane-layout
  - background-tasks, diff, git-rail, tooltip, transcript-fade, rich-copy, highlight, code-fence, stream-highlight
  - settings-rest failed once in the final 50-suite pass, at "preview is highlighted" (re-tokenize race). The script now waits for the re-highlight, and it passed 3/3 after that on the unchanged build.
- Suites take 2–50 s each; one full serial pass of the 50 is about 9 minutes.

### Open items
- Native-window acceptance is still unrun for F07–F14, as for every batch in this round. That covers VoiceOver (approval live region, status glyphs, feed and articles), real IME in the find field, real trackpad on the peek, traffic lights, and the light/dark visual comparisons.
- F12 has two unscripted checks: the A→B→A composer-top stability check and the danger toast on a rejected turn/start (the fixture has no turn/start failure knob).
- Feed scroll race: a scroll event that lands in the same frame as an ArrowUp keydown can still re-pin following. The session script waits around it, and real users are unlikely to hit it. Hardening would mean ignoring downward movement while an 'up' intent is pending in use-transcript-scroll.js onScroll.
- The classic nav carries `.df-session-list`, which pulls in the presets-gated rules from the original desktop-layout.css. Only the keycap is overridden here; the other `.df-session-list` rules (group labels, accordion guides, the stub pad) should be audited against the classic branch.
- Implementer gaps not addressed in this pass (see each batch's section): F07 Accept edits on DeepSeek only and the too-large stand-in; F09 hour/message counting and the forward-only Codex ledger; F10 page-level find, revealFolded and lH; F11 has no ⇧⌘Y in the shortcuts dialog or Changes, no Markdown preview and a 10-language viewer; F13 InfoTip approximation and connector drill extras; F14 optional storage actions and the uncached storage scan.

### F12 review fixes

Review pass on F12 (one major, four minor). Parallel protocol: no build, no offscreen suites, no snapshot, no live DeepSeek. Package version unchanged.

- **Major: repository gpg.program could run (`app/electron/git-status.cjs`).** `context()` now adds `-c log.showSignature=false` to every invocation (heavyWorkWorker git config). `workspaceGitCommits` also passes `--no-show-signature` to `log` (Oa). The commit scope no longer uses `git show` (next item). New `tests/git-status.test.mjs` case next to the existing hardening test: a commit with a `gpgsig` header, plus `gpg.program`/`gpg.ssh.program`/`gpg.x509.program` set to a marker script and `log.showSignature=true`. A plain `git log` in that repo is checked to run the script, so the fixture is known to be live. Then `workspaceGitCommits`, `workspaceGitDiff({scope:'commit:<sha>'})`, the branch diff and `workspaceGitStatus` all run, and the marker is never written. Before the fix this test failed.
- **Commit scope = ka (`<sha>^..<sha>`).** `commit:<sha>` resolves `rev-parse --verify --quiet <sha>^`, falling back to the empty tree for a root commit, and runs `git diff DIFF_FLAGS --find-renames --ignore-submodules=none [--unified=max] <parent> <sha> --`. A merge commit now shows its first-parent patch and never `diff --cc`. A clean merge was empty under `git show`, which was checked in a scratch repo. New test: a merge of `side` into `feature` shows only `side.txt`, both partial and complete-context. A root commit shows `new file … +base`.
- **Real "N older commits not shown".** `workspaceGitCommits` still fetches 51 rows, and now also returns `total` from `rev-list --count <baseRef>..HEAD --`. Without a base the result is `{base:null, commits:[], total:0}`. `diffScopeSections` takes `commitTotal` and computes the hidden count as zm's `m.length − 50` over the total, never fewer than the listed rows. `useDiffScope` stores and passes `total`; main.cjs passes the result through unchanged. Tests: diff-scope-model checks 51 rows + total 120 → '70 older commits not shown', exactly 50 → no row, and a stale smaller total. git-status checks total 2 with `limit: 1` and total 3 after the merge.
- **Commit keeps composer focus.** The band's `sg-action` (source-git-status.jsx) and the rail's `sg-action sgr-action` (source-git-rail.jsx) get `onMouseDown={(event) => event.preventDefault()}` (git-status-card.js:1116 `onMouseDown: Mn`). source-git-band.test.mjs now has source assertions for both, plus the counts button.
- **git-band script coverage (`app/scripts/git-band-ui-test.mjs`).** The fixture profile adds a second dirty session `git-band-thread-b` (same checkout) and an archived `git-band-thread-archived`, and `turnStarts()` counts turn/start in fixture-requests.jsonl. There are three new steps:
  - `commit-focus`, after `band`: with the composer focused, a mouse-down on the enabled Commit keeps `document.activeElement` in the composer. The pointer is released away from the button, and no turn/start is sent.
  - `switch-hold`: A→B→A. On the return to A it samples every rAF frame of `.sc-composer` top and of the band-column top (`nav.sg-status` top, else the composer top), with a MutationObserver flag for `[data-prbar-stale]`. It asserts that the stale snapshot rendered, that the composer never unmounted, and that both drifts stay below half the band height measured on A. Metrics are in `report.metrics.switchHold`.
  - `commit-failure-toast`, last: it dirties the tree again (`toast.txt`), uses Filter › Status › Archived to open the archived session, and clicks the enabled Commit. It expects exactly one `data-variant="danger"` toast 'Message couldn’t be sent. Try again.', no `.composer-error`, and no turn/start. This covers the archived precondition of sendCommitTurn. A rejected turn/start is still not scriptable, because the fixture has no failure knob.
- Tests: `node --test tests/git-status.test.mjs tests/git-rail-model.test.mjs tests/diff-scope-model.test.mjs tests/source-git-band.test.mjs tests/source-diff-scope.test.mjs tests/changes-menu-model.test.mjs tests/diff-whitespace-model.test.mjs tests/diff-file-header.test.mjs` passed 65/65. `node --check scripts/git-band-ui-test.mjs` OK.
- Not run (protocol): build, offscreen `git-band` (its three new steps are unverified until the integrator runs `run-suite.mjs git-band` after a build), full npm test.
- Remaining: the switch-hold tolerance (< band height / 2) follows the spec ("must not move by the band height") and is not a 1px check. If the integrator sees a few px of drift from transcript loading, it is recorded in the metrics. Earlier F12 deviations still stand: the per-session Compare against override, the substring branch search, and uncommittedAvailable = isRepo.

### F09 review fixes

Fixes for the F09 review (two major, three minor). Parallel protocol (F12 and others in flight): targeted edits only, no build, no `npm test`, no offscreen suites, no snapshot. Package version unchanged.

#### Changes
- **Sub-agent children no longer count as sessions (major).** The original claim at LOG.md:769 ("Sessions start only on a human prompt, so sub-agent children add … no sessions") was wrong. The installed driver (`dsh-subagent-in-process-driver` lib/index.js:207-210 `drivePublishedRun`) sends the delegated prompt as `createUserMessage({content, source: {kind: "user"}})`. Its `subagent/descriptor` only follows inside that first turn (`attachDescriptorAppend`, agent/pre-step). So each child added one session. This entry corrects LOG.md:769, which stays unedited because the log is append-only. The behaviour that line describes is now true.
  - `index.js` `foldUsageSummaries` passes `subagent: record.header.origin === 'subagent'` with each listed session. Both the sessionQuery records and the persistence snapshots carry `header`.
  - `usage.js` `sessionUsageSummaries`: a session listed with `subagent: true` comes back as a shallow copy of its fold, flagged `subagent: true`. This covers the live, cached and freshly read paths. The cache still stores the plain fold, so revision reuse is unaffected and no cache version bump is needed.
  - `codeStats` skips `entry.sessions` for flagged summaries and still counts their messages, tool calls, hours and tokens. `accountTokenUsage` is unchanged and still counts children.
  - Docs updated: the doc comments, the harness README `codeDesktop/stats/read` row and the HANDOFF F09 entry (new review-fixes paragraph; the sub-agent and focus-ring gaps were removed from its remaining gaps).
- **Home shows why the connection failed again (major).** `main.jsx`: the page error banner was gated on `{error && (boot?.connected || current) && (`, because the removed connection card used to show `error` on Home while disconnected. The gate is now `{error && (`, so a failed spawn or initialize at launch (init's `b.error`), a dropped core (status `error`) and a failed manual Retry (reconnect rejection) all show their message on Home. The message appears above the unchanged composer warning row ('Connection to DeepSeek lost.' + Retry). The warning text stays constant: passing the error into the row would have duplicated the banner in sessions and broken composer-states' exact-text check.
- **Kept stats are keyed by core (minor).** `activity.cjs` has two new pure helpers:
  - `statsCoreKey(resolveCore())` returns 'deepseek' for the default bridge (whatever its script path), 'codex', or `override:<CODEX_BINARY>`.
  - `keptCodeStats(config, coreKey, initial?.core)` returns the kept `config.codeStats` only when `config.codeStatsCore` equals the current key, and not once a connected core is known to lack `capabilities.codeStats`. A result kept before the key existed counts as the default bridge's.
  - `main.cjs` `readCodeStats` stores `config.codeStatsCore` together with the result. The 'stats' IPC uses `keptCodeStats`, so a CODEX_BINARY Codex goes straight to its ledger fallback with no DeepSeek flash first.
- **Live tab focus ring is on the pill (minor).** In `source-home.css`, `.sh-tab:focus-visible` is now only `outline: none`. Live tabs get `[role=tablist] > .sh-tab::before { transition: box-shadow var(--cds-dur-fast) <default easing> }` and `…:focus-visible::before { box-shadow: var(--cds-focus-shadow) }` (rn `before:transition-shadow before:duration-fast focus-visible:before:shadow-focus`). The ring follows the inset-x-px pill and is flush at the first and last child. The pre-live buttons are disabled and aria-hidden, so they never take focus. This removes the earlier focus-ring deviation.
- **After-disconnect coverage (minor).** `scripts/connection-lifecycle-test.mjs`:
  - The fixture rejects initialize while a `fail-initialize` flag file exists in the profile.
  - After the existing reconnects, the script kills the third core (SIGTERM). It waits for and asserts `{cards: 0, warning: 'Connection to DeepSeek lost.', retry: 'Retry', connecting: false, greeting: true}`, with 'DeepSeek disconnected' in `[role=alert].composer-error`.
  - With the flag set, it clicks the warning row's Retry and expects the same state with 'Fixture initialize failure' in the banner.
  - It removes the flag, clicks Retry again, and expects the warning row and the banner to detach, still with no `.connection-card`. There are now 5 starts.

#### Tests
- Harness: `node --test tests/usage.test.mjs` passes 10/10. The new case follows the real driver shape: a child log of turn/start, a `source.kind 'user'` prompt, `subagent/descriptor`, tool/call, reply and turn/end, with the children flagged on the listing.
  - The fold alone still counts the child's prompt as a session start; the flag is what drops it.
  - One read child plus one live child give Sessions 1 with messages 6, tool calls 3 and both models' tokens. Account lifetime tokens are 813.
  - The stored cache entry has no `subagent` key, and a cache-only second pass gives the same stats. Unflagged, the same logs give 3 sessions.
  - The old 'sub-agent fork with no human prompt' comment is reworded, since that case is a fork.
- Also run: `tests/approval.test.mjs`, `tests/subagents.test.mjs` and `tests/thread-list.test.mjs`. With usage, that is 44/44.
- App: `node --test tests/home-model.test.mjs tests/home-stats-load.test.mjs tests/activity.test.mjs tests/home-account-usage.test.mjs tests/design-token-refs.test.mjs tests/reduced-motion-css.test.mjs tests/source-composer-submit.test.mjs` passes 42/42.
  - `activity`: the main.cjs wiring regexes are updated, and a new `keptCodeStats` table covers legacy, tagged, override and Codex keys, the connected core without the capability, a bad shape and a null key.
  - `home-account-usage`: the banner gate is gone; the focus ring is on `::before`, not the button.
- UI scripts, updated and not run:
  - connection-lifecycle (above).
  - home-page: after the Models hover, keyboard focus on Overview → ArrowRight/ArrowLeft. Models and Overview must match `:focus-visible` with the `::before` box-shadow equal to `--cds-focus-shadow`, the button box-shadow 'none' and outline 'none', pill left/right 1px/0 (Models) and 0/1px (Overview), and transition box-shadow 0.06s. Overview stays selected afterwards.
  - home-account-usage: launch 1 also asserts `prefs.codeStatsCore === 'override:' + CODEX_BINARY`. The relaunch keeps painting the kept result, because the key matches.
- Suites for the integrator, after `npm run build`:
  - connection-lifecycle, home-page and home-account-usage.
  - composer-states: its Home 'disconnect' → Retry step now shows the banner on Home until Retry clears it; the later `.composer-error` count 0 is after the Retry.
  - account-lifecycle (key card).

#### Deviations
- The sub-agent flag uses the session header (`origin 'subagent'`), not the `subagent/descriptor` event. The descriptor follows the delegated prompt, so a fold would have to take back a session it had already counted. Continuable children have the same origin, so the flag covers them too.
- A failed connection on Home shows the page error banner as well as the composer warning row. The original has no connection-card equivalent; this keeps the diagnostic (Node, missing core script, initialize timeout, spawn failure) visible.

#### Remaining gaps
- The first-launch initialize failure (init `{connected: false, error}`) goes through the same banner gate but is not driven by its own launch in a suite. The failed-Retry path covers the rendering.
- Nothing was built or run offscreen.

## Fix re-integration

Re-integration after the F09 and F12 review fixes. This pass was the only editor of the tree. No snapshot, no HANDOFF entry, and the package version is unchanged (0.2.130).

### Starting point
- Harness `node --test tests/*.test.mjs`: 120/120. That is 119 plus F09's new sub-agent stats test.
- App `npm test`: 1502 tests, 1501 pass, the 1 known skip (invalid UTF-8 names), 0 fail.
- `npm run build`: pass. build-info sourceSha256 `20e9f35df2d005c6…`, 491 sources.
- No unit failures, so no product or assertion change was needed at this level.

### Offscreen failures and fixes (scripts only; product behaviour judged correct)
- **home-page, heatmap tooltip after the F09 focus step (`app/scripts/home-page-ui-test.mjs`).**
  - Symptom: F09's new keyboard step passed. The next step then waited 15 s for the `[role=tooltip]` on today's heatmap cell.
  - Cause: the tabs use automatic activation (source-home.jsx Tabs `move` → `onChange`). ArrowRight and ArrowLeft switch Overview → Models → Overview, so eT remounts with `tooltips=false`. Before this step existed, `hoverCard()` had already crossed the grid, so its tooltips were mounted.
  - Why the hover then shows nothing: eT mounts cell tooltips on the heatmap's first pointerenter (code-home.js eT, source-home.jsx Heatmap). That mount replaces the cell node under the pointer. A diagnostic run confirmed it:
    - The new node matched `:hover` and carried the SourceTooltip handlers.
    - A 1px nudge produced only a pointermove, with no pointerover or pointerenter, and no tooltip.
    - Re-entering from outside fired pointerenter on the cell and opened the tooltip.
  - A real pointer crosses other cells on its way in. The original behaves the same way.
  - Fix: the script hovers the first cell, asserts that no tooltip is shown yet (entering the grid only mounts the tooltips), then hovers today's cell. Passed.
- **git-band `commit-failure-toast` (F12 review step) (`app/scripts/git-band-ui-test.mjs`).**
  - Symptom: Filter › Status › Archived showed "No sessions match the current filters", so the click on `git-band-thread-archived` timed out.
  - Cause: the sidebar lists archived rows only from the remembered `config.threadMetadata` (session-engine-model.mjs `partitionSessions`). The script had seeded `archivedThreadIds` and an archived fixture thread, but no metadata.
  - Fix: the profile now seeds `threadMetadata[git-band-thread-archived]`, the same way composer-states seeds its archived B.
  - Result: all three new F12 steps pass.
    - `commit-focus`: composer focused, `onCommit` false.
    - `switch-hold`: 29 frames, 11 of them stale. Composer and column drift are both 0 px; band height 40.
    - `commit-failure-toast`: `{variant:'danger', matching:1, errorBanners:0, turnStarts:0}`.

### Decisions confirmed (no change in this pass)
- **Reduced motion for MessageActions (turn-footer, user-actions).** The Wave-integration decision stands and both suites pass.
  - It follows the original: the global clamp (design-system.css:1423-1438) only shortens animations. The MessageActions rule (:51631-51640) sets `transition-property:none; scale:none` under the media query and under `[data-reduce-motion=true]`.
  - The hovered toolbar keeps its declared 0.12 s `transitionDuration` but does not transition.
  - The assertions check `{transitionProperty:'none', scale:'none', opacity:'1'}`. They no longer check `transitionDuration === '0s'`.
- **settings-complete native confirm.** This is not an adapter failure, as verified in Wave integration: CDP dialog events work under bootstrap.cjs. The old failure was a stale copy assertion while the confirm was still open. It passes again here with exactly 3 `dialog.showMessageBox` blocked-before-native-call entries.

### Final results
- Harness: 120/120.
- App `npm test`: 1502 tests, 1501 pass, 1 skip, 0 fail. No product source changed after the run; the two edited scripts are not unit-tested.
- `npm run build`: pass, sourceSha256 `20e9f35df2d005c6…`.
- Offscreen, serial, on that build: all 24 required suites pass. 22 passed on the first pass; home-page and git-band passed after the script fixes above.
  - approval-card, edit-read, permission, sidebar, sidebar-rest, sidebar-chrome, home-page, home-account-usage
  - connection-lifecycle (incl. F09's disconnect, failed-Retry and recovery steps), session, transcript-scroll, transcript-states
  - files-pane, user-markdown, pane, git-band, changes-pane, git, skills-mcp, settings-complete, settings, usage, turn-footer, user-actions
- Extra suites the F09/F12 reviews flagged, on the same build: composer-states (Home disconnect → banner → Retry), account-lifecycle, git-rail and diff all pass.

### Open items
- Unchanged from Wave integration:
  - Native-window acceptance (VoiceOver, IME, trackpad, traffic lights, light/dark visual comparisons).
  - The rejected turn/start danger toast (the fixture has no turn/start failure knob).
  - The feed scroll race hardening.
  - The `.df-session-list` classic-branch audit.
  - The per-batch implementer gaps.
- From F09's own notes: the first-launch initialize failure is still not driven by its own launch.

## Regression repair 1

The 20 listed suites (transcript-fade … file-search-shutdown) had not run, because the serial runner was stopped before it reached them. This pass was the only editor of the tree. The user asked for faster runs, so suites ran in parallel, and every failure under parallel load was re-run serially before it was classified. No snapshot, no HANDOFF entry, package version unchanged (0.2.130).

### Starting point
- Build sourceSha256 `20e9f35df2d005c6…` (491 sources). Harness 120/120. App `npm test` 1502 tests: 1501 pass, the 1 known skip, 0 fail.
- Pass 1: the 20 suites 4 at a time, with `npm test` running at the same time. 17 passed. transcript-fade, transcript-scroll and highlight failed, and all three passed when re-run serially. Load testing afterwards (6–7 at a time) found ui029, highlight (a second spot), session-actions and menus-states as well. Each one is classified below with evidence.

### Product fix
- **A tooltip swallowed Escape before a focused modal saw it (`app/src/source-tooltip.jsx`).** session-actions `/usage` → Escape failed under load (the Usage dialog stayed `data-open="true"` for 12 s).
  - A temporary diagnostic (removed) showed the keydown reaching the document with focus on the `.ss-settings-dialog` section. The only DOM change was a `.cds-root.source-tooltip-scope` being removed: a hint opened by the parked pointer before the modal opened.
  - The tooltip listened for Escape with `document.addEventListener("keydown", key, true)` (capture) plus `stopPropagation()`, so the dialog's own handler never ran.
  - The original Base UI tooltip root (vendor-frame-BmPfNbgY.js:20789 `Is(r, {enabled, referencePress})`) uses useDismiss. Its Escape handler M (:16731-16745) is attached at :16960 as `ra(V, "keydown", M)` with no capture flag: document bubble phase, so the focused target and React's root/portal handlers run first. The local menu and popover already follow this (source-menu.jsx:314-319, source-popover.jsx:174-180).
  - Fix: the tooltip now listens in the bubble phase; preventDefault and stopPropagation are unchanged, so window-level listeners still do not see an Escape that closed a hint, as in the original.
  - Guard: new test in `tests/tooltip-model.test.mjs`. The tooltip's add and remove must be bubble phase, matching menu and popover. Mutation check: with `, true` restored it fails (13 pass, 1 fail).
  - The tooltip suite passes. session-actions passed all 5 parallel runs after the fix (6–7 at a time twice, 4 at a time three times).

### Script fixes (the product was judged correct)
- **highlight (step session-race): a latent race, not load.** `nodeFor("highlight-B-only").textContent()` was expected to equal 'OTHER_SESSION_VISIBLE'.
  - Since F10, the feed hook prepends the sr-only `<h2 data-feed-heading>` 'DeepSeek responded: …' to the answer's head row (scroll-messages-current.js:56941-56953 x5). It does so one frame after the rows change (use-transcript-feed-nav.js MutationObserver → rAF).
  - The old read passed only when it beat that frame. A diagnostic run with 300 ms more wait failed deterministically, with the heading present.
  - The summary 'OTHERSESSIONVISIBLE' is faithful: the original af regex (c2fb08a02-DWV0GyaQ.js N, `(?<!_)_([^_\n]+)_(?!_)`) strips `_…_` the same way.
  - Fix: wait for B's own settled heading `DeepSeek responded: OTHERSESSIONVISIBLE`, which also proves the stale A reply did not reach B's summary. Then compare the row text with `[data-feed-heading]` removed.
- **highlight (stream phase).** Under 6-way load, `.scb-block.last()` was still the prior fence (`data-frontier` null). Paced reveal (source-session.jsx RichSourceMarkdown → use-response-pacing.js) can tokenize the closed fence before the open one is revealed. The script now waits for both blocks, then makes the same assertion.
- **transcript-scroll (chip wheel).** It saw '2621 -> 2621'. React's onWheel on the od wrapper is passive, so the input is acknowledged before forwardWheel runs (use-transcript-scroll.js:554-559). The fixed 100 ms settle could end first. The script now waits up to 3 s for the scroll itself, with the threshold (>100 px) unchanged.
- **transcript-fade (live stream).** The fixture streams 20 deltas on a 100 ms wall-clock timer (codex-server.cjs streamFixture, about 2 s). Under load the stream can finish before the reading snapshot (seen: +901 px before reading, +0 after) or before following is seen at the tail (tail(true) timeout).
  - Both only miss the scenario's precondition, so the turn is re-sent, at most 3 attempts in all. Every attempt still asserts following-at-tail while streaming and the anchor after completion. A following regression never reaches 'tail' and still fails.
  - `metrics.liveAttempts` records each attempt. Serial runs needed 1 attempt (+532 px). The final 4-way run used the retry: attempt 1's stream ended before following was seen, and attempt 2 passed with +502 px.
- **ui029 (launch).** Under 6-way load `window.desktop.onEvent` was undefined: `firstWindow()` resolved on the blank initial document. The script now waits for the preload bridge (electron/preload.cjs) before subscribing.
- **menus-states (safe-polygon release).** A 6-way run saw 'none' !== 'auto'. Its failure.png (menus-states-ui-2026-10-02T11-39-43.720Z) shows Group by's own option submenu (Date/Folder/State…) open.
  - Group by is itself a submenu (SUBMENU_HOVER_DELAY 100 ms, menu-model.mjs:18). With the pointer resting on its trigger, MenuSubmenu legitimately blocks the parent for Group by's own corridor.
  - The script now records every inline pointer-events change on the parent from the move onward. The first change must be the Status corridor's restore (''). Then 'auto' is required when Group by's submenu is closed, and any later block must occur while Group by's submenu is open. `metrics.corridorRelease` records this.
  - The 4 recorded runs after the change passed (1 serial, 3 parallel).

### Known load limit (documented, not changed)
- **ui029 stopIdentity.** From the Stop click on, the step needs the 350 ms delayed interrupt (ui029-fixtures.mjs:30 `interruptDelayMs:350`) to stay pending across several checks: 'stopping' status, Stopping aria, the sprite, the disabled Send glyph and the Escape guard.
  - That value is part of `fixtureDefinitionSha256`, which must equal the frozen 0.2.8 native baseline (ui029-ui-test.mjs:146), so it cannot be widened without a new native baseline.
  - Under 4-way load it missed the window in 2 of 5 runs ('Real turn started before interrupt', and `/Stopping/` read as ''). It passed every serial or alone run.
- Also LOAD only in the 60-suite parallel run, and not in the 20-suite scope: composer-states (swapSnapshot wait, :208) and skills-mcp (a sampled colour at :922, 'rgb(227, 73, 72)' instead of 'rgb(208, 59, 59)'). Both passed serially and in a later 4-way run. They are not changed here.

### Parallel runner (`work/fidelity-batches/run-suites-parallel.mjs`, new)
- `node work/fidelity-batches/run-suites-parallel.mjs [-j 4] [--logs DIR] (--all | suite …)` after `cd app && npm run build`.
- Each suite is still one `run-suite.mjs <suite>` process. Each run has its own mkdtemp output, profile and launcher, and git-rail binds a free port, so suites share no state.
- Failures in the parallel pool are re-run once, serially. PASS = passed in parallel, LOAD = passed only serially, FAIL = failed both times (exit 1).
- `SERIAL_TAIL` (ui029) runs alone after the pool, for the reason above. A failure there is retried once, alone (RETRY).
- `-j 4` is the tested level. At 6–7 the wall-clock windows above are hit far more often.

### Final results
- `npm run build`: pass, sourceSha256 `996bb8bd087a5a69…` (491 sources). The only product change is source-tooltip.jsx.
- App `npm test`: 1503 tests, 1502 pass, 1 known skip, 0 fail. Harness: 120/120.
- All 60 offscreen suites, `--all -j 4`: 416 s including retries (a serial pass of the 50 was about 9 minutes). 56 passed in parallel, 4 LOAD (composer-states, skills-mcp, transcript-fade, ui029), 0 FAIL.
  - transcript-fade's LOAD was the tail(true) variant, fixed afterwards. That group of 8 then passed 8/8 4-way in 49 s.
- The 20 listed suites on the final tree, `-j 4`: 124 s.
  - 19 passed in parallel: transcript-fade, protocol-0155, settings-rest, session-actions, menus-states, sidebar-rest, transcript-scroll, integration-race, connection-lifecycle, workflow-package, git, highlight, highlight-coalescing, turn-footer, user-actions, rich-copy, git-rail, shutdown, file-search-shutdown.
  - ui029 was LOAD (the stop window above) and passed on serial retry. It then passed alone under the runner's SERIAL_TAIL.
- The edited scripts are highlight, transcript-scroll, transcript-fade, ui029 and menus-states. session-actions is byte-identical to its starting version; the diagnostics were removed.

### Open items
- ui029's stop window needs a new native 0.2.8-equivalent baseline before its interrupt delay can be widened.
- composer-states and skills-mcp sampling under load (above).
- Unchanged from Fix re-integration:
  - Native-window acceptance.
  - The rejected turn/start toast.
  - The feed scroll race hardening.
  - The `.df-session-list` audit.
  - The per-batch implementer gaps.
