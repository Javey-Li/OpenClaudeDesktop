import { version as clientVersion } from "../package.json";
import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon } from "./icons";
import { ToolButton, SIDEBAR_TOGGLE_TOOLTIP } from "./code-ui";
import { SourceNavButtons } from "./source-nav-buttons";
import { SourceTooltip, SourceTooltipGroup } from "./source-tooltip";
import { menuTriggerProps } from "./source-menu";
import { SourceDialog } from "./source-dialog.jsx";
import { SourceShortcut } from "./source-shortcut.jsx";
import { ACTION_ERROR_COPY } from "./action-error-model.mjs";
import { sessionMenuTriggerLabel, titleTooltipContent, viewOptionsLabel } from "./session-title-menu-model.mjs";
import { LOCAL_RELEASE_NOTE_VERSIONS, RELEASE_NOTE_KINDS, RELEASE_NOTE_KIND_LABELS, releaseNoteDate, releaseNoteSegments, releaseNotesFor } from "./release-notes.mjs";
import "./source-titlebar.css";
import { t } from "../electron/i18n/index.mjs";

// panes-toggle-current.js:3160-3172 diff spec + cl (:3571-3593): label
// "Changes" (constant: no activeLabel), shortcut F("toggleDiff") = aR cmd+shift+d
// (shared-21-D098Wd--.js:14165-14169), ze side "bottom" with the tooltip's
// default hoverable (shared-frame Nu hoverable = !0). The tooltip gets the raw key
// spec and Mu draws it in io order, ⇧⌘D (shared-frame-C_2npUJq.js:4572-4580).
export const CHANGES_TOOLTIP = { content: t("Changes"), shortcut: "cmd+shift+d", side: "bottom", hoverable: true };
// cl indicator: activity (Ic, panes-toggle-current.js:3002-3012: working tree
// dirty for a local non-remote session, 10s refetch while responding) && !p
// renders sl (panes-toggle-current.js:3565-3570) through Button's indicator grid
// (shared-frame-C_2npUJq.js:2885-2905): icon at col/row 1 and an aria-hidden
// span[data-cds-part=indicator] overlaying its top-right corner.
function ChangesIndicatorIcon() {
  return (
    <span className="st-indicator-grid">
      <span className="st-indicator-icon">
        <Icon name="ChangesPlusMinus" />
      </span>
      <span aria-hidden="true" data-cds-part="indicator" className="st-indicator">
        <span className="st-indicator-dot" />
      </span>
    </span>
  );
}

// sidebar-groups.js:2774-2840 Ib: df-collapsed-chrome = Nb (2685, collapsed trigger "Show sidebar", Kl cmd+b) then
// df-collapsed-nav around Pb (2752-2766, qM with placement "sidebar"). The session titlebar shows it while the sidebar
// is collapsed; a tabbed split view (source-split-view.jsx) shows it at the start of its tab strip instead.
export function SourceCollapsedChrome({ onExpand, peekOpen = false, onPeekEnter, onPeekLeave, historyAt = 0, historyLength = 1, travel }) {
  return (
    <div className="df-collapsed-chrome">
      {/* sidebar-groups.js:2679-2750 Nb: a pointerenter opens the peek; aria-expanded follows it,
          aria-controls names the sidebar body (the peek card) and the trigger is bg-neutral-30 while open. */}
      <ToolButton label={t("Show sidebar")} tooltip={SIDEBAR_TOGGLE_TOOLTIP.show} icon="Sidebar" onClick={onExpand}
        aria-expanded={peekOpen} aria-controls="frame-peek-popover" data-peek-open={peekOpen || undefined}
        // ca1d33d05 kt: with the peek card hidden, the "navigation" stop is this trigger, focused without a ring.
        data-focus-region="navigation" data-focus-region-fallback="" data-focus-region-ring="none"
        onPointerEnter={onPeekEnter} onPointerLeave={onPeekLeave} />
      <div className="df-collapsed-nav">
        <SourceNavButtons placement="sidebar" historyAt={historyAt} historyLength={historyLength} travel={travel} />
      </div>
    </div>
  );
}

// Hp → Hf → kf/Bp/bp; shared-12 Wm/Km/Ym/qm/th.
// See analysis/source-titlebar-batch1.md for source/version boundaries.
export function SourceTitlebar({
  surface = "code",
  activityOpen = false,
  onToggleActivity,
  collapsed,
  onExpand,
  section,
  sectionLabel,
  session,
  panes = new Set(),
  onTogglePane,
  onMenu,
  menuKind,
  // The open titlebar menu was opened by a right-click at the cursor (main.jsx menu.point): the title's context menu,
  // which is not the caret's popup, so the caret stays collapsed (c593f7513 Om: separate Dm instances).
  menuAtPointer = false,
  onRename,
  // c593f7513 wm onRenameStart: the header session menu's Rename asks for the inline title edit ({ id, token };
  // a new token for this session starts it).
  renameRequest,
  onWhatsNew,
  showWhatsNew = false,
  loading,
  historyAt = 0,
  historyLength = 1,
  travel,
  changesDirty = false,
  // Terminal pane toggle (cc70f2bdf Hc terminal item, icon CommandLinePrompt): shown when main.jsx can open the pane;
  // terminalBusy draws the activity dot ("Terminal (command running)") while the pane is hidden.
  terminalAvailable = false,
  terminalBusy = false,
  // Preview pane toggle (panes-toggle-current.js:3091-3130: icon Play, "Preview"); previewRunning draws the activity
  // dot ("Preview (dev server running)") while the pane is closed.
  previewAvailable = false,
  previewRunning = false,
  // Split view (shared-21 VT, an extra pane's paneHost): a secondary pane's titlebar ends with a ghost "Close pane"
  // X (label and tooltip, no chord) that closes that pane; the primary pane has none (it closes through View ›
  // Split View or ⌃⌘W).
  onCloseSplit,
  // B27 session popout (main.jsx SESSION_POPOUT; shared-18 yx/hx): the window's header ends with Open in main window
  // (ArrowInSquare) and Keep window on top (Pin / PinFilled, pressed while on top). { alwaysOnTop, onDock, onTogglePin }.
  popoutWindow = null,
  // F08 collapsed hover peek (main.jsx): open state and the trigger's pointer handlers.
  peekOpen = false,
  onPeekEnter,
  onPeekLeave,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [renameError, setRenameError] = useState("");
  const [compact, setCompact] = useState(false);
  // Narrower than the lead's floor (glyph, a 32px title, the gap, the folder icon chip): the chip is dropped
  // instead of showing as a clipped sliver beside the actions.
  const [folderHidden, setFolderHidden] = useState(false);
  // Too narrow for the lead and every action (a small window with a pane open): the Preview and Terminal toggles,
  // which the ⋮ View options menu also lists, step out so the title, the folder chip and the remaining actions
  // never draw over each other. fullTrailing is the actions' width with every toggle shown.
  const [cramped, setCramped] = useState(false);
  const foldedActivity = cramped && ((previewAvailable && previewRunning && !panes.has("preview")) || (terminalAvailable && terminalBusy && !panes.has("terminal")));
  const fullTrailing = useRef(0);
  const input = useRef(null),
    titleButton = useRef(null),
    inner = useRef(null),
    trailing = useRef(null);
  const titleMeasure = useRef(null),
    folderMeasure = useRef(null);
  const transaction = useRef(0),
    submitted = useRef(false),
    sessionId = useRef(session?.id);
  const restoreTitleFocus = useRef(false),
    keyboardEntry = useRef(false);
  const errorId = useId();
  const title = session?.name || session?.preview || t("Untitled");
  const folder =
    session?.cwd?.split(/[\\/]/).filter(Boolean).at(-1) || t("Workspace");
  sessionId.current = session?.id;
  useEffect(() => {
    transaction.current++;
    submitted.current = false;
    restoreTitleFocus.current = false;
    setEditing(false);
    setSaving(false);
    setRenameError("");
  }, [session?.id]);
  useEffect(
    () => () => {
      transaction.current++;
    },
    [],
  );
  useLayoutEffect(() => {
    if (editing) {
      input.current?.focus();
      input.current?.select();
    } else if (restoreTitleFocus.current) {
      restoreTitleFocus.current = false;
      titleButton.current?.focus({ preventScroll: true });
    }
  }, [editing]);
  // Mp uses measured title/pill budgets. Preserve the folder action as an icon
  // when compact, restoring with the source's 96px spare-room threshold.
  useLayoutEffect(() => {
    const row = inner.current;
    if (!row || !session || section !== "new") {
      setCompact(false);
      setFolderHidden(false);
      setCramped(false);
      return;
    }
    let frame;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const actions = trailing.current;
        if (actions && !actions.hasAttribute("data-cramped"))
          fullTrailing.current = actions.offsetWidth;
        // The header session caret (c593f7513 Om) sits between the title and the folder chip, with its gap.
        const caret = row.querySelector(".st-session-caret");
        const caretWidth = caret ? caret.offsetWidth + 4 : 0;
        // The lead's floor: origin glyph, a 32px title, the caret, the gap and the folder icon chip.
        const leadFloor = 32 + 32 + caretWidth + 4 + 24 + 12;
        const hideable = !!actions?.querySelector("[data-pane-toggle]");
        setCramped((was) =>
          hideable &&
          (was
            ? row.clientWidth < fullTrailing.current + leadFloor + 24
            : row.clientWidth < fullTrailing.current + leadFloor),
        );
        const available =
          row.clientWidth - (actions?.offsetWidth || 0) - 12;
        const required =
          32 +
          (titleMeasure.current?.offsetWidth || 0) +
          (parseFloat(
            getComputedStyle(titleButton.current?.parentElement || row)
              .columnGap,
          ) || 6) +
          (folderMeasure.current?.offsetWidth || 0) +
          caretWidth;
        setFolderHidden(available < 32 + 32 + caretWidth + 4 + 24);
        setCompact((was) =>
          was ? available - required < 96 : available < required,
        );
      });
    };
    const observer = new ResizeObserver(measure);
    [row, trailing.current, titleMeasure.current, folderMeasure.current]
      .filter(Boolean)
      .forEach((node) => observer.observe(node));
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [session?.id, title, folder, section, collapsed]);
  // shared-21 IV m() → wm Ct = bm start() with no event: the edit opens on the session it was asked for, and a
  // keyboard-focused trigger (the menu hands focus back to it) makes Enter/Escape return focus to the title.
  const lastRenameToken = useRef(renameRequest?.token);
  useEffect(() => {
    const token = renameRequest?.token;
    if (token === undefined || token === lastRenameToken.current) return;
    lastRenameToken.current = token;
    if (renameRequest.id !== session?.id) return;
    beginEdit();
  }, [renameRequest?.token]);
  function beginEdit(event) {
    if (loading || saving || !onRename) return;
    event?.preventDefault();
    event?.stopPropagation();
    transaction.current++;
    submitted.current = false;
    keyboardEntry.current = event
      ? event.detail === 0 || event.currentTarget.matches(":focus-visible")
      : document.activeElement?.matches?.(":focus-visible") === true;
    setDraft(title);
    setRenameError("");
    setEditing(true);
  }
  async function commit() {
    if (submitted.current || !session?.id) return;
    submitted.current = true;
    const value = draft.trim();
    if (!value || value === title) {
      setEditing(false);
      return;
    }
    const id = session.id,
      token = transaction.current;
    setSaving(true);
    setRenameError("");
    try {
      const succeeded = await onRename(id, value);
      if (token !== transaction.current || id !== sessionId.current) return;
      if (succeeded !== false) setEditing(false);
      else {
        submitted.current = false;
        setRenameError(t(ACTION_ERROR_COPY.rename));
      }
    } catch (error) {
      if (token === transaction.current && id === sessionId.current) {
        submitted.current = false;
        // sidebar-groups.js:15393-15402: the catalog copy; the raw reason is for the console only.
        console.warn("Rename failed:", error);
        setRenameError(t(ACTION_ERROR_COPY.rename));
      }
    } finally {
      if (token === transaction.current && id === sessionId.current)
        setSaving(false);
    }
  }
  function cancelEdit() {
    transaction.current++;
    submitted.current = true;
    restoreTitleFocus.current = keyboardEntry.current;
    setEditing(false);
    setSaving(false);
    setRenameError("");
  }
  // c593f7513 Om: the title's context menu and the CaretDown trigger open the same header session menu (k);
  // main.jsx 'session-title'. Other surfaces keep the full 'session' menu.
  const sessionMenuKind = surface === "code" ? "session-title" : "session";
  function openSessionMenu(event, entry) {
    event.preventDefault();
    onMenu?.(sessionMenuKind, event.currentTarget, session, entry);
  }
  // shared-21 IV contextMenuTrigger: the title's right-click opens the same menu as a ContextMenu at the cursor
  // (contextMenuAt), as the sidebar rows' context menu does.
  function openSessionContextMenu(event) {
    event.preventDefault();
    onMenu?.(sessionMenuKind, event.currentTarget, session, undefined, { x: event.clientX, y: event.clientY });
  }
  const sessionMenuLabel = surface === "code" ? sessionMenuTriggerLabel(title) : t("Session options");
  return (
    <header className="workspace-toolbar st-toolbar window-drag" data-surface={surface}>
      {collapsed && <SourceCollapsedChrome onExpand={onExpand} peekOpen={peekOpen} onPeekEnter={onPeekEnter} onPeekLeave={onPeekLeave}
        historyAt={historyAt} historyLength={historyLength} travel={travel} />}
      <div
        ref={inner}
        className="st-inner epitaxy-titlebar"
        aria-busy={loading || saving || undefined}
      >
        {section !== "new" ? (
          <span className="session-title st-section-title">
            {sectionLabel ?? t(section[0].toUpperCase() + section.slice(1))}
          </span>
        ) : session ? (
          <div className="st-lead" data-pills-compact={compact || undefined} data-folder-hidden={folderHidden || undefined}>
            {/* c360a9e1c-GPs-MV9u.js:6347-6360 yp: the labelled origin glyph is
                wrapped in Zt (shared-frame Nu, `no as Zt` :177; default side
                "top", which flips below at the window top) with content =
                label; no native title. */}
            {surface === "code" && <span className="st-origin">
              <SourceTooltip content={t("Local")}>
                <span
                  className="st-origin-glyph"
                  data-testid="epitaxy-origin-indicator"
                  role="img"
                  aria-label={t("Local")}
                >
                  <Icon name="Laptop" size={18} />
                </span>
              </SourceTooltip>
            </span>}
            <div className="st-title-and-pill">
              {editing ? (
                <input
                  ref={input}
                  className="st-title-input"
                  aria-label={t("Session name")}
                  aria-invalid={!!renameError}
                  aria-describedby={renameError ? errorId : undefined}
                  title={renameError || undefined}
                  value={draft}
                  readOnly={saving}
                  aria-busy={saving || undefined}
                  size={Math.min(30, Math.max(10, draft.length))}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setRenameError("");
                  }}
                  onBlur={commit}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.nativeEvent.isComposing || event.repeat) return;
                    if (event.key === "Enter") {
                      event.preventDefault();
                      restoreTitleFocus.current = keyboardEntry.current;
                      commit();
                    }
                    if (event.key === "Escape" && !saving) {
                      event.preventDefault();
                      cancelEdit();
                    }
                  }}
                />
              ) : loading && !session.name && !session.preview ? (
                <span className="st-title-skeleton" aria-hidden="true" />
              ) : (
                // c360a9e1c:7387-7420 mm: the title button sits in Zt (Nu defaults) and has no native title.
                // c593f7513 vm (7270-7300): its content is the full title while it is truncated, "Rename" otherwise.
                <SourceTooltip content={() => titleTooltipContent(titleButton.current, title)}>
                <button
                  ref={titleButton}
                  type="button"
                  className="session-title st-title"
                  // ca1d33d05 St (codeTitle, c593f7513 vm titleStop): the renamable title is the pane's "header"
                  // F6 stop, focused without a ring.
                  data-focus-region={loading || !onRename ? undefined : "header"} data-focus-region-ring="none" data-focus-region-order="pane"
                  aria-label={t("{title}, rename session", { title })}
                  disabled={loading || !onRename}
                  onClick={beginEdit}
                  onContextMenu={openSessionContextMenu}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && event.repeat)
                      event.preventDefault();
                  }}
                >
                  {title}
                </button>
                </SourceTooltip>
              )}
              {/* c593f7513 Om (8180-8205): beside the title, a ghost icon-only CaretDown (sm) Button in text-secondary
                  with the trigger label as aria-label and as its bottom tooltip; it opens the header session menu. */}
              {/* jm: until the session is ready (L) the lead is sa's title skeleton, with no Om caret. */}
              {surface === "code" && !(loading && !session.name && !session.preview) && <ToolButton label={sessionMenuLabel} className="code-icon-button st-session-caret"
                {...menuTriggerProps({
                  open: menuKind === "session-title" && !menuAtPointer,
                  disabled: loading,
                  onOpen: (entry, event) => onMenu?.(sessionMenuKind, event.currentTarget, session, entry),
                })}
                disabled={loading}
                tooltip={{ content: sessionMenuLabel, side: "bottom", hoverable: true, automatic: false, open: menuKind ? false : undefined }}
                onClick={(event) => openSessionMenu(event, event.detail === 0 ? "first" : undefined)}>
                <Icon name="CaretDown" size={16} />
              </ToolButton>}
              {/* c360a9e1c:6760-6810 Fp: Zt {content [environmentName, cwd,
                  repoNames].filter(Boolean).join(" · "), open:false while the
                  folder menu is open}. Local adaptation: there is no
                  environment or repo name, so the content is the cwd only
                  (none without a cwd). The Gt.Trigger opens main.jsx 'folder',
                  the 'Working directory' menu (side bottom, align start). */}
              {surface === "code" && <SourceTooltip content={session.cwd || undefined} open={menuKind === "folder" ? false : undefined}>
              <button
                type="button"
                className="st-folder"
                aria-label={t("Folder: {path}", { path: session.cwd || folder })}
                aria-haspopup="menu"
                aria-expanded={menuKind === "folder"}
                data-popup-open={menuKind === "folder" ? "" : undefined}
                disabled={loading}
                onClick={(event) => onMenu?.("folder", event.currentTarget, undefined, event.detail === 0 ? "first" : undefined)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  onMenu?.("folder", event.currentTarget);
                }}
              >
                <Icon name="Folder" size={12} className="st-folder-glyph" />
                <span
                  className="st-folder-label"
                  data-testid="epitaxy-origin-label"
                >
                  {folder}
                </span>
              </button>
              </SourceTooltip>}
              {surface !== "code" && <ToolButton label={sessionMenuLabel} icon="CaretDown"
                aria-haspopup="menu" aria-expanded={menuKind === "session" && !menuAtPointer} onClick={(event) => openSessionMenu(event)} />}
            </div>
            <span aria-hidden="true" className="st-measurements">
              <span ref={titleMeasure} className="st-title-measure">
                {title}
              </span>
              <span ref={folderMeasure} className="st-folder-measure">
                {folder}
              </span>
            </span>
            {renameError && (
              <span id={errorId} className="st-visually-hidden" role="alert">
                {renameError}
              </span>
            )}
            {loading && (
              <span className="st-visually-hidden" role="status">
                {t("Loading session")}
              </span>
            )}
            {saving && (
              <span className="st-visually-hidden" role="status">
                {t("Saving session name")}
              </span>
            )}
          </div>
        ) : null}
        <SourceTooltipGroup>
          <div ref={trailing} className="st-trailing panel-toggles" data-cramped={cramped || undefined}>
            {/* titlebar-release-notes.js:5238-5256 V: ghost text-accent button
                only while `justUpdated || modalOpen` (whats-new-model.mjs). */}
            {!session && section === "new" && showWhatsNew && (
              <button
                type="button"
                className="st-whats-new"
                onClick={onWhatsNew}
              >
                {t("What’s new")}
              </button>
            )}
            {session && section === "new" && (
              <>
                {previewAvailable && (
                  <ToolButton
                    label={surface !== "code" ? t("Browser") : previewRunning && !panes.has("preview") ? t("Preview (dev server running)") : t("Preview")}
                    icon={surface === "code" ? "Play" : "Globe"}
                    active={panes.has("preview")}
                    aria-pressed={panes.has("preview")}
                    aria-keyshortcuts="Meta+Shift+P"
                    data-pane-toggle="preview"
                    disabled={loading}
                    tooltip={{ content: surface !== "code" ? t("Browser") : previewRunning && !panes.has("preview") ? t("Preview (dev server running)") : t("Preview"), shortcut: "cmd+shift+p",
                      side: "bottom", hoverable: true, automatic: false, open: menuKind ? false : undefined }}
                    onClick={() => onTogglePane?.("preview")}
                  >
                    {previewRunning && !panes.has("preview") ? (
                      <span className="st-indicator-grid">
                        <span className="st-indicator-icon"><Icon name="Play" /></span>
                        <span aria-hidden="true" data-cds-part="indicator" className="st-indicator"><span className="st-indicator-dot" /></span>
                      </span>
                    ) : undefined}
                  </ToolButton>
                )}
                {surface === "code" && terminalAvailable && (
                  <ToolButton
                    label={terminalBusy && !panes.has("terminal") ? t("Terminal (command running)") : t("Terminal")}
                    icon="CommandLinePrompt"
                    active={panes.has("terminal")}
                    aria-pressed={panes.has("terminal")}
                    aria-keyshortcuts="Meta+J Control+`"
                    data-pane-toggle="terminal"
                    disabled={loading}
                    tooltip={{ content: terminalBusy && !panes.has("terminal") ? t("Terminal (command running)") : t("Terminal"), shortcut: "cmd+j",
                      side: "bottom", hoverable: true, automatic: false, open: menuKind ? false : undefined }}
                    onClick={() => onTogglePane?.("terminal")}
                  >
                    {terminalBusy && !panes.has("terminal") ? (
                      <span className="st-indicator-grid">
                        <span className="st-indicator-icon"><Icon name="CommandLinePrompt" /></span>
                        <span aria-hidden="true" data-cds-part="indicator" className="st-indicator"><span className="st-indicator-dot" /></span>
                      </span>
                    ) : undefined}
                  </ToolButton>
                )}
                {surface !== "code" && onToggleActivity && <ToolButton label={t("Activity panel")} icon="File"
                  active={activityOpen} aria-pressed={activityOpen} onClick={onToggleActivity} />}
                {surface === "code" && <><ToolButton
                  label={CHANGES_TOOLTIP.content}
                  icon="ChangesPlusMinus"
                  active={panes.has("changes")}
                  aria-pressed={panes.has("changes")}
                  aria-keyshortcuts="Meta+Shift+D"
                  disabled={loading}
                  tooltip={{
                    ...CHANGES_TOOLTIP,
                    automatic: false,
                    open: menuKind ? false : undefined,
                  }}
                  onClick={() => onTogglePane?.("changes")}
                >
                  {changesDirty && !panes.has("changes") ? (
                    <ChangesIndicatorIcon />
                  ) : undefined}
                </ToolButton>
                <ToolButton
                  label={viewOptionsLabel(foldedActivity)}
                  icon="DotsVertical"
                  {...menuTriggerProps({
                    open: menuKind === "titlebar",
                    disabled: loading,
                    onOpen: (entry, event) => onMenu?.("titlebar", event.currentTarget, session, entry),
                  })}
                  disabled={loading}
                  tooltip={{
                    side: "bottom",
                    hoverable: true,
                    automatic: false,
                    open: menuKind ? false : undefined,
                  }}
                  onClick={(event) =>
                    // Base UI: only a keyboard press (detail 0) opens with the first item highlighted.
                    onMenu?.("titlebar", event.currentTarget, session, event.detail === 0 ? "first" : undefined)
                  }
                >
                  {/* A cramped titlebar folds the Preview and Terminal toggles into this menu: their activity dot moves here. */}
                  {foldedActivity ? (
                    <span className="st-indicator-grid">
                      <span className="st-indicator-icon"><Icon name="DotsVertical" /></span>
                      <span aria-hidden="true" data-cds-part="indicator" className="st-indicator"><span className="st-indicator-dot" /></span>
                    </span>
                  ) : undefined}
                </ToolButton></>}
              </>
            )}
            {onCloseSplit && (
              <ToolButton
                label={t("Close pane")}
                icon="X"
                className="code-icon-button epitaxy-pane-close-control"
                data-split-close=""
                tooltip={{
                  content: t("Close pane"),
                  side: "bottom",
                  hoverable: true,
                  automatic: false,
                  open: menuKind ? false : undefined,
                }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={onCloseSplit}
              />
            )}
            {popoutWindow && <>
              <ToolButton
                label={t("Open in main window")}
                icon="ArrowInSquare"
                data-popout-dock=""
                tooltip={{ content: t("Open in main window"), side: "bottom", hoverable: true, automatic: false, open: menuKind ? false : undefined }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={popoutWindow.onDock}
              />
              <ToolButton
                label={popoutWindow.alwaysOnTop ? t("Stop keeping window on top") : t("Keep window on top")}
                icon={popoutWindow.alwaysOnTop ? "PinFilled" : "Pin"}
                active={popoutWindow.alwaysOnTop === true}
                aria-pressed={popoutWindow.alwaysOnTop === true}
                data-popout-pin=""
                tooltip={{ content: popoutWindow.alwaysOnTop ? t("Stop keeping window on top") : t("Keep window on top"), side: "bottom", hoverable: true, automatic: false, open: menuKind ? false : undefined }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={popoutWindow.onTogglePin}
              />
            </>}
          </div>
        </SourceTooltipGroup>
      </div>
    </header>
  );
}

// P (titlebar-release-notes.js:5059-5069) `n`: the nudge shows only for a running version that has an entry
// in the bundled list (release-notes.mjs); main.jsx reads it through this export.
export { LOCAL_RELEASE_NOTE_VERSIONS };

// I (:5071-5094): [[keys]] render as Shortcut keycaps and `code` as an inline code span.
function ReleaseNoteText({ text }) {
  return releaseNoteSegments(text).map((segment, index) =>
    segment.type === "keys" ? <SourceShortcut key={index} keys={segment.value} />
      : segment.type === "code" ? <code key={index} className="st-release-code">{segment.value}</code>
        : <React.Fragment key={index}>{segment.value}</React.Fragment>);
}

// R (:5100-5131): one group per kind, omitted when the entry has none of that kind.
function ReleaseNoteGroup({ kind, items }) {
  const shown = items.filter((item) => item.kind === kind);
  if (!shown.length) return null;
  return (
    <div className="st-release-group">
      <h5>{t(RELEASE_NOTE_KIND_LABELS[kind])}</h5>
      <ul>{shown.map((item, index) => <li key={index}><ReleaseNoteText text={item.text} /></li>)}</ul>
    </div>
  );
}

// B (:5156-5236) WhatsNewModal: the shared Dialog at size md (initial focus on the popup, Escape/Close/outside
// press dismiss it, exit transition kept by main.jsx useDialogRetention) with the bleed 'What’s new' header,
// the lag note z (its changelog link has no counterpart for this local client, so only the first sentence
// stays), then one section per bundled entry up to the running version, newest first: the h4 date beside a
// neutral font-mono version Badge, then New / Improved / Fixed. The DeepSeek "Known limits" of an entry
// follow as a muted footnote.
export function LocalReleaseNotes({ open = true, onClose, onExited }) {
  const entries = useMemo(() => releaseNotesFor(clientVersion), []);
  return (
    <SourceDialog open={open} onExited={onExited} onClose={onClose} bleed size="md" title={t("What’s new")} className="st-release-notes">
      <p className="st-release-note">{t("These release notes are included with this version of the app and may be one release behind.")}</p>
      <div className="st-release-scroll">
        {entries.length === 0
          ? <p className="st-release-empty">{t("No release notes yet.")}</p>
          : entries.map((entry) => (
            <section key={entry.version} className="st-release-entry">
              <div className="st-release-date">
                <h4>{releaseNoteDate(entry.date)}</h4>
                <span className="st-release-version" data-cds="Badge" data-variant="neutral">{entry.version}</span>
              </div>
              {RELEASE_NOTE_KINDS.map((kind) => <ReleaseNoteGroup key={kind} kind={kind} items={entry.items} />)}
              {entry.limits?.length > 0 && <p className="st-release-limits">{t("Known limits:")} {entry.limits.join(" ")}</p>}
            </section>
          ))}
      </div>
    </SourceDialog>
  );
}
