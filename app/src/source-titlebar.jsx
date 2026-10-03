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
import { LOCAL_RELEASE_NOTE_VERSIONS, RELEASE_NOTE_KINDS, RELEASE_NOTE_KIND_LABELS, releaseNoteDate, releaseNoteSegments, releaseNotesFor } from "./release-notes.mjs";
import "./source-titlebar.css";

// panes-toggle-current.js:3160-3172 diff spec + cl (:3571-3593): label
// "Changes" (constant: no activeLabel), shortcut F("toggleDiff") = aR cmd+shift+d
// (shared-21-D098Wd--.js:14165-14169), ze side "bottom" with the tooltip's
// default hoverable (shared-frame Nu hoverable = !0). The tooltip gets the raw key
// spec and Mu draws it in io order, ⇧⌘D (shared-frame-C_2npUJq.js:4572-4580).
export const CHANGES_TOOLTIP = { content: "Changes", shortcut: "cmd+shift+d", side: "bottom", hoverable: true };
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

// Hp → Hf → kf/Bp/bp; shared-12 Wm/Km/Ym/qm/th.
// See analysis/source-titlebar-batch1.md for source/version boundaries.
export function SourceTitlebar({
  collapsed,
  onExpand,
  section,
  session,
  panes = new Set(),
  onTogglePane,
  onMenu,
  menuKind,
  onRename,
  onWhatsNew,
  showWhatsNew = false,
  loading,
  historyAt = 0,
  historyLength = 1,
  travel,
  changesDirty = false,
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
  const title = session?.name || session?.preview || "Untitled";
  const folder =
    session?.cwd?.split(/[\\/]/).filter(Boolean).at(-1) || "Workspace";
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
      return;
    }
    let frame;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const available =
          row.clientWidth - (trailing.current?.offsetWidth || 0) - 12;
        const required =
          32 +
          (titleMeasure.current?.offsetWidth || 0) +
          (parseFloat(
            getComputedStyle(titleButton.current?.parentElement || row)
              .columnGap,
          ) || 6) +
          (folderMeasure.current?.offsetWidth || 0);
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
  function beginEdit(event) {
    if (loading || saving || !onRename) return;
    event.preventDefault();
    event.stopPropagation();
    transaction.current++;
    submitted.current = false;
    keyboardEntry.current =
      event.detail === 0 || event.currentTarget.matches(":focus-visible");
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
        setRenameError(ACTION_ERROR_COPY.rename);
      }
    } catch (error) {
      if (token === transaction.current && id === sessionId.current) {
        submitted.current = false;
        // sidebar-groups.js:15393-15402: the catalog copy; the raw reason is for the console only.
        console.warn("Rename failed:", error);
        setRenameError(ACTION_ERROR_COPY.rename);
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
  function openSessionMenu(event) {
    event.preventDefault();
    onMenu?.("session", event.currentTarget, session);
  }
  return (
    <header className="workspace-toolbar st-toolbar window-drag">
      {collapsed && (
        // sidebar-groups.js:2774-2840 Ib: df-collapsed-chrome = Nb (2685,
        // collapsed trigger "Show sidebar", Kl cmd+b) then df-collapsed-nav
        // around Pb (2752-2766, qM with placement "sidebar").
        <div className="df-collapsed-chrome">
          {/* sidebar-groups.js:2679-2750 Nb: a pointerenter opens the peek; aria-expanded follows it,
              aria-controls names the sidebar body (the peek card) and the trigger is bg-neutral-30 while open. */}
          <ToolButton label="Show sidebar" tooltip={SIDEBAR_TOGGLE_TOOLTIP.show} icon="Sidebar" onClick={onExpand}
            aria-expanded={peekOpen} aria-controls="frame-peek-popover" data-peek-open={peekOpen || undefined}
            onPointerEnter={onPeekEnter} onPointerLeave={onPeekLeave} />
          <div className="df-collapsed-nav">
            <SourceNavButtons placement="sidebar" historyAt={historyAt} historyLength={historyLength} travel={travel} />
          </div>
        </div>
      )}
      <div
        ref={inner}
        className="st-inner epitaxy-titlebar"
        aria-busy={loading || saving || undefined}
      >
        {section !== "new" ? (
          <span className="session-title st-section-title">
            {section[0].toUpperCase() + section.slice(1)}
          </span>
        ) : session ? (
          <div className="st-lead" data-pills-compact={compact || undefined}>
            {/* c360a9e1c-GPs-MV9u.js:6347-6360 yp: the labelled origin glyph is
                wrapped in Zt (shared-frame Nu, `no as Zt` :177; default side
                "top", which flips below at the window top) with content =
                label; no native title. */}
            <span className="st-origin">
              <SourceTooltip content="Local">
                <span
                  className="st-origin-glyph"
                  data-testid="epitaxy-origin-indicator"
                  role="img"
                  aria-label="Local"
                >
                  <Icon name="Laptop" size={18} />
                </span>
              </SourceTooltip>
            </span>
            <div className="st-title-and-pill">
              {editing ? (
                <input
                  ref={input}
                  className="st-title-input"
                  aria-label="Session name"
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
                // c360a9e1c:7387-7420 mm: the title button sits in Zt {content
                // "Rename"} (Nu defaults) and has no native title.
                <SourceTooltip content="Rename">
                <button
                  ref={titleButton}
                  type="button"
                  className="session-title st-title"
                  aria-label={`${title}, rename session`}
                  disabled={loading || !onRename}
                  onClick={beginEdit}
                  onContextMenu={openSessionMenu}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && event.repeat)
                      event.preventDefault();
                  }}
                >
                  {title}
                </button>
                </SourceTooltip>
              )}
              {/* c360a9e1c:6760-6810 Fp: Zt {content [environmentName, cwd,
                  repoNames].filter(Boolean).join(" · "), open:false while the
                  folder menu is open}. Local adaptation: there is no
                  environment or repo name, so the content is the cwd only
                  (none without a cwd). The Gt.Trigger opens main.jsx 'folder',
                  the 'Working directory' menu (side bottom, align start). */}
              <SourceTooltip content={session.cwd || undefined} open={menuKind === "folder" ? false : undefined}>
              <button
                type="button"
                className="st-folder"
                aria-label={`Folder: ${session.cwd || folder}`}
                aria-haspopup="menu"
                aria-expanded={menuKind === "folder"}
                data-popup-open={menuKind === "folder" ? "" : undefined}
                disabled={loading}
                onClick={(event) => onMenu?.("folder", event.currentTarget)}
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
              </SourceTooltip>
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
                Loading session
              </span>
            )}
            {saving && (
              <span className="st-visually-hidden" role="status">
                Saving session name
              </span>
            )}
          </div>
        ) : null}
        <SourceTooltipGroup>
          <div ref={trailing} className="st-trailing panel-toggles">
            {/* titlebar-release-notes.js:5238-5256 V: ghost text-accent button
                only while `justUpdated || modalOpen` (whats-new-model.mjs). */}
            {!session && section === "new" && showWhatsNew && (
              <button
                type="button"
                className="st-whats-new"
                onClick={onWhatsNew}
              >
                What’s new
              </button>
            )}
            {session && section === "new" && (
              <>
                <ToolButton
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
                  label="Session options"
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
                    onMenu?.("titlebar", event.currentTarget, session)
                  }
                />
              </>
            )}
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
      <h5>{RELEASE_NOTE_KIND_LABELS[kind]}</h5>
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
    <SourceDialog open={open} onExited={onExited} onClose={onClose} bleed size="md" title="What’s new" className="st-release-notes">
      <p className="st-release-note">These release notes are included with this version of the app and may be one release behind.</p>
      <div className="st-release-scroll">
        {entries.length === 0
          ? <p className="st-release-empty">No release notes yet.</p>
          : entries.map((entry) => (
            <section key={entry.version} className="st-release-entry">
              <div className="st-release-date">
                <h4>{releaseNoteDate(entry.date)}</h4>
                <span className="st-release-version" data-cds="Badge" data-variant="neutral">{entry.version}</span>
              </div>
              {RELEASE_NOTE_KINDS.map((kind) => <ReleaseNoteGroup key={kind} kind={kind} items={entry.items} />)}
              {entry.limits?.length > 0 && <p className="st-release-limits">Known limits: {entry.limits.join(" ")}</p>}
            </section>
          ))}
      </div>
    </SourceDialog>
  );
}
