import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";
import { ToolButton, SIDEBAR_TOGGLE_TOOLTIP } from "./code-ui";
import { SourceNavButtons } from "./source-nav-buttons";
import { SourceTooltip, textOverflows } from "./source-tooltip";
import { SourceSpark } from "./source-spark.jsx";
import { SourceMenu, menuTriggerProps } from "./source-menu";
import { CONTEXT_MENU_ALIGN_OFFSET, CONTEXT_MENU_SIDE_OFFSET } from "./menu-model.mjs";
import {
  buildSidebarGroups, buildNestedRuns, bulkTargets, CLASSIC_GROUP_OPTIONS, CLASSIC_SORT_OPTIONS,
  CLASSIC_STATUS_OPTIONS, clearSidebarFilters, folderName, hasSidebarFilters, lineageKind, movePinned,
  nestedStubCounts, nestedStubText, normalizeSidebarPreferences, sessionArchived, sessionName, sessionState, showAllSessionsPreferences, sidebarEmptyHasNonDefaultFilter, sidebarEmptyVariant, truncateRuns,
  OTHER_PROJECT_KEY, customOrderKey, isCustomOrderKey, moveSection, sectionOrderKeys, sortSectionsAlphabetically, withSectionOrder,
} from "./sidebar-model";
// A sub-agent's approval is attributed to the session that owns it: the
// sub-agent thread is never a sidebar row, so a bare threadId match would
// leave a blocked session with no "awaiting input" state at all.
import { hasPendingApproval, latestTurnError } from "./state.js";
import { describeTurnError } from "./turn-error-model.mjs";
import { archiveBlockedByField, archiveChord, archiveNeighbour, collectJumpRows, createJumpHints, isTypingTarget } from "./sidebar-jump-model.mjs";
import { useSourceToasts } from "./source-toast.jsx";
import {
  clearSelection, createSelection, isSelected, pruneSelection, selectRange, setSelection as replaceSelection, toggleSelection,
} from "./sidebar-selection.mjs";
import {
  KEYBOARD_STEP, KEYBOARD_STEP_LARGE, SIDEBAR_WIDTH, isResizeDrag, sidebarDragFrame, sidebarFloorWidth, sidebarMaxWidth,
} from "./sidebar-width-model.mjs";
import { useSourcePointerResize } from "./use-pointer-resize.js";
import { SourceConfirmationDialog, SourceDialog, SourceDialogFooter, useDialogRetention } from "./source-dialog.jsx";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { hiddenSessionsNotice } from "./session-engine-model.mjs";
import "./source-sidebar.css";
import { t, tn } from "../electron/i18n/index.mjs";

/** Current classic sidebar DOM menus on the shared CDS SourceMenu primitive:
 * sidebar-main Z.Root/Z.Popup (Filter: side bottom, align end, sideOffset 4,
 * classic !min-w-[200px]) and sidebar-session J.Popup (side bottom, align end);
 * the right-click variant follows the context-menu branch (ev.Root over Base
 * UI ContextMenu): data-cds ContextMenu, cursor anchor with the positioner's
 * context-menu defaults sideOffset -5 / alignOffset 2, and al('contextmenu')
 * layer offset 30. */
export function SourceSidebarMenu({ anchor, label, onClose, children, point, kind, initialHighlight }) {
  const cursor = !!point;
  return <SourceMenu.Popup anchor={anchor} point={point} side="bottom" align={cursor ? "start" : "end"}
    sideOffset={cursor ? CONTEXT_MENU_SIDE_OFFSET : kind === "filter" ? 4 : undefined}
    alignOffset={cursor ? CONTEXT_MENU_ALIGN_OFFSET : 0} layer={cursor ? "contextmenu" : "menu"}
    dataCds={cursor ? "ContextMenu" : "Menu"} label={label} onClose={onClose}
    className={kind === "filter" ? "source-sidebar-filter-menu" : undefined} initialHighlight={initialHighlight}>
    {children}
  </SourceMenu.Popup>;
}

// String children are looked up (literal item copy is localized; translated text passes through).
function Choice({ children, checked, radio, onClick, disabled, disabledReason, shortcut, keepOpen, icon, variant, digit }) {
  return <SourceMenu.Item checked={checked} checkedRole={radio ? "radio" : "checkbox"} disabled={disabled} variant={variant} digit={digit}
    disabledReason={disabledReason} shortcut={shortcut} keepOpen={keepOpen} icon={icon} onClick={onClick}>{t(children)}</SourceMenu.Item>;
}

function Divider() { return <SourceMenu.Separator />; }

/** sidebar-main dI: SubmenuTrigger with the current value as footnote trailing text (accent when active). */
function Submenu({ label, detail, active, children, onOpenChange }) {
  return <SourceMenu.Submenu onOpenChange={onOpenChange}>
    <SourceMenu.SubmenuTrigger label={label}
      trailing={detail ? <span className={"source-menu-detail" + (active ? " is-active" : "")}>{detail}</span> : undefined}>{label}</SourceMenu.SubmenuTrigger>
    <SourceMenu.Popup label={label}>{children}</SourceMenu.Popup>
  </SourceMenu.Submenu>;
}

export function SourceSidebarFilterMenu({ preferences, onChange, onClose, knownFolders = [], customGroups = [] }) {
  const prefs = normalizeSidebarPreferences(preferences);
  const update = (patch, keepOpen = false) => {
    onChange({ ...prefs, ...patch });
    if (!keepOpen) onClose();
  };
  const optionMenu = (name, label, options, active = false) => <Submenu
    key={name} label={label} detail={t(options.find(([value]) => value === prefs[name])?.[1])} active={active}>
    {options.map(([value, title]) => <React.Fragment key={value}>
      {name === "groupBy" && value === "none" && <Divider />}
      <Choice radio checked={prefs[name] === value} onClick={() => update({
        [name]: value, ...(name === "groupBy" && value === "state" ? { status: "active" } : {}),
      })}>{t(title)}</Choice>
    </React.Fragment>)}
  </Submenu>;
  return <>
    {optionMenu("status", t("Status"), CLASSIC_STATUS_OPTIONS, prefs.status !== "active")}
    {prefs.groupBy === "state" && optionMenu("stateActivityDays", t("Last activity"),
      [[1, "1d"], [3, "3d"], [7, "7d"], [30, "30d"], [0, "All"]], prefs.stateActivityDays !== 7)}
    <Divider />
    {optionMenu("groupBy", t("Group by"), CLASSIC_GROUP_OPTIONS)}
    {optionMenu("sortBy", t("Sort by"), CLASSIC_SORT_OPTIONS)}
    {((prefs.groupBy === "project" && knownFolders.length > 0) || (prefs.groupBy === "custom" && customGroups.length > 0)) && <>
      <Divider />
      <Choice checked={prefs.showEmptyGroups} keepOpen
        onClick={() => update({ showEmptyGroups: !prefs.showEmptyGroups }, true)}>{t("Show empty groups")}</Choice>
    </>}
    {hasSidebarFilters(prefs) && <>
      <Divider />
      <Choice onClick={() => { onChange(clearSidebarFilters(prefs)); onClose(); }}>{t("Clear filters")}</Choice>
    </>}
  </>;
}

// sidebar-session.js GH: while a row menu is open, letter hotkeys are read at
// the document level except when the key is typed into an editable control.
const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="searchbox"], [role="combobox"]';
const digitFor = (index) => (index < 9 ? String(index + 1) : undefined);
// Bulk result toasts: the composed English ("Archived {count} older sessions",
// "{count} session couldn’t be removed. Try again.") is the dictionary key.
const bulkDoneMessage = (verb, count, noun) => tn(count, `${verb} {count} ${noun}`, `${verb} {count} ${noun}s`);
const bulkFailedMessage = (verb, count) => tn(count, `{count} session couldn’t be ${verb}. Try again.`, `{count} sessions couldn’t be ${verb}. Try again.`);

/**
 * Session row menu (sidebar-session-items.js M single / N multi). Letter keys
 * (p u r f a d; u a d for multi) are handled by a document-level capture
 * listener while the menu is open, never while a submenu is open or the key
 * is typed into an editable target. Items with no local backing (Copy link,
 * Share, Export, Set model, project/cloud/runner items) are not rendered.
 */
export function SourceSidebarSessionMenu({
  session, metadata = {}, customGroups = [], state = {}, onAction, onRename, onCreateGroup, onClose,
  onDelete, onFork, forkUnavailable, multi, pinnedSiblings, nested,
}) {
  const submenuOpen = useRef(false);
  const hotkeys = useRef(new Map());
  // Multi "Move {count} to group" digits (official onKeyDownCapture on that
  // submenu popup): 1-9 without modifiers pick an entry while it is open.
  const digitActions = useRef(new Map());
  useEffect(() => {
    const handler = (event) => {
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
      if (event.target instanceof Element && event.target.closest(EDITABLE_SELECTOR)) return;
      const run = submenuOpen.current ? digitActions.current.get(event.key) : hotkeys.current.get(event.key.toLowerCase());
      if (!run) return;
      event.preventDefault(); event.stopPropagation();
      run();
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, []);
  const trackSubmenu = (open) => { submenuOpen.current = open; };
  const act = (action, payload) => { onClose(); onAction(action, session, payload); };
  if (multi) {
    const { count, sessions: selected, onBulk } = multi;
    const allArchived = selected.length > 0 && selected.every(sessionArchived);
    const run = (action, payload) => { onClose(); onBulk(action, selected, payload); };
    hotkeys.current = new Map([
      ["u", () => run("mark-unread")],
      ["a", () => run(allArchived ? "unarchive" : "archive")],
      ["d", () => run("delete")],
    ]);
    const moveEntries = customGroups.length + 1 + (onCreateGroup ? 1 : 0);
    digitActions.current = new Map([
      ...customGroups.map((group) => () => run("move-to-group", { groupId: group.id })),
      () => run("move-to-group", { groupId: null }),
      ...(onCreateGroup ? [() => { onClose(); onCreateGroup(selected); }] : []),
    ].slice(0, 9).map((action, index) => [String(index + 1), action]));
    return <div className="source-session-menu-contents" data-multi-count={count}>
      <Choice shortcut="u" onClick={() => run("mark-unread")}>{t("Mark {count} as unread", { count })}</Choice>
      {(customGroups.length > 0 || onCreateGroup) && <SourceMenu.Submenu onOpenChange={trackSubmenu}>
        <SourceMenu.SubmenuTrigger label={t("Move {count} to group", { count })}>{t("Move {count} to group", { count })}</SourceMenu.SubmenuTrigger>
        <SourceMenu.Popup label={t("Move {count} to group", { count })}>
          <SourceMenu.Group>
            {customGroups.map((group, index) => <Choice key={group.id} shortcut={digitFor(index)} digit={digitFor(index)}
              onClick={() => run("move-to-group", { groupId: group.id })}>{group.name}</Choice>)}
            {customGroups.length > 0 && <Divider />}
            <Choice shortcut={digitFor(customGroups.length)} digit={digitFor(customGroups.length)}
              onClick={() => run("move-to-group", { groupId: null })}>{t("Ungrouped")}</Choice>
          </SourceMenu.Group>
          {onCreateGroup && <>
            <Divider />
            <Choice shortcut={digitFor(moveEntries - 1)} digit={digitFor(moveEntries - 1)}
              onClick={() => { onClose(); onCreateGroup(selected); }}>{t("New group…")}</Choice>
          </>}
        </SourceMenu.Popup>
      </SourceMenu.Submenu>}
      <Divider />
      <Choice shortcut="a" onClick={() => run(allArchived ? "unarchive" : "archive")}>{allArchived ? t("Unarchive {count}", { count }) : t("Archive {count}", { count })}</Choice>
      <Choice shortcut="d" variant="danger" onClick={() => run("delete")}>{t("Delete {count}", { count })}</Choice>
    </div>;
  }
  digitActions.current = new Map();
  const busy = sessionState(session, state) === "working" || hasPendingApproval(state, session.id);
  const running = !!state.active?.[session.id];
  const canArchive = !running;
  const archived = sessionArchived(session);
  // forkUnavailable: the core cannot fork at all (unsupportedCommand, session-command-model).
  const forkReason = forkUnavailable || (running ? t("Stop the running task before forking it.") : archived ? t("Restore this session before forking it.") : undefined);
  const pinnedAt = pinnedSiblings && metadata.pinned ? pinnedSiblings.indexOf(session.id) : -1;
  const reorder = (direction) => {
    const ids = movePinned(pinnedSiblings, session.id, direction);
    if (ids) act("pinned-order", { ids });
  };
  hotkeys.current = new Map([
    ["p", () => act(metadata.pinned ? "unpin" : "pin")],
    ["r", () => { onClose(); onRename(); }],
    ...(canArchive ? [["a", () => act(archived ? "unarchive" : "archive")]] : []),
    ...(!busy ? [["u", () => act(metadata.unread ? "mark-read" : "mark-unread")]] : []),
    ...(onFork && !forkReason ? [["f", () => { onClose(); onFork(session); }]] : []),
    ...(onDelete && canArchive ? [["d", () => { onClose(); onDelete(session); }]] : []),
  ]);
  return <div className="source-session-menu-contents">
    {session.cwd && <>
      <Submenu label={t("Open in")} onOpenChange={trackSubmenu}>
        <Choice onClick={() => act("reveal-folder")}>{t("Finder")}</Choice>
        <Choice onClick={() => act("open-terminal")}>{t("Terminal")}</Choice>
      </Submenu>
      <Divider />
    </>}
    {pinnedAt > 0 && <Choice onClick={() => reorder("up")}>{t("Move up")}</Choice>}
    {pinnedAt !== -1 && pinnedAt < pinnedSiblings.length - 1 && <Choice onClick={() => reorder("down")}>{t("Move down")}</Choice>}
    <Choice shortcut="p" onClick={() => act(metadata.pinned ? "unpin" : "pin")}>{metadata.pinned ? t("Unpin") : t("Pin")}</Choice>
    {!busy && <Choice shortcut="u" onClick={() => act(metadata.unread ? "mark-read" : "mark-unread")}>{metadata.unread ? t("Mark as read") : t("Mark as unread")}</Choice>}
    <Choice shortcut="r" onClick={() => { onClose(); onRename(); }}>{t("Rename")}</Choice>
    {onFork && <Choice shortcut="f" disabled={!!forkReason} disabledReason={forkReason} onClick={() => { onClose(); onFork(session); }}>{t("Fork")}</Choice>}
    {nested && nested.childCount > 0 && <Choice onClick={() => { onClose(); nested.onToggle(); }}>{nested.collapsed ? t("Show nested sessions") : t("Hide nested sessions")}</Choice>}
    {(customGroups.length > 0 || onCreateGroup) && <>
      <Divider />
      <Submenu label={t("Move to group")} onOpenChange={trackSubmenu}>
        {customGroups.map((group) => <Choice key={group.id} checked={metadata.customGroupId === group.id}
          onClick={() => act("move-to-group", { groupId: group.id })}>{group.name}</Choice>)}
        {metadata.customGroupId && <Choice onClick={() => act("move-to-group", { groupId: null })}>{t("Remove from group")}</Choice>}
        {onCreateGroup && <>
          {customGroups.length > 0 && <Divider />}
          <Choice onClick={() => { onClose(); onCreateGroup([session]); }}>{t("New group…")}</Choice>
        </>}
      </Submenu>
    </>}
    <Divider />
    <Choice shortcut="a" disabled={!canArchive} onClick={() => act(archived ? "unarchive" : "archive")}>
      {archived ? t("Unarchive") : t("Archive")}
    </Choice>
    {onDelete && <Choice shortcut="d" variant="danger" disabled={!canArchive} disabledReason={canArchive ? undefined : t("Stop the running task before deleting it.")}
      onClick={() => { onClose(); onDelete(session); }}>{t("Delete")}</Choice>}
  </div>;
}

/** sidebar-rows.js:8060-8088 aO: every leading status glyph sits in a 14px-minimum centred span with
 * role status (live states) or img and the label as its name, inside a CDS tooltip with the same label
 * (Xs delay 500, closeDelay 0, hoverable false). */
function StatusGlyph({ label, live = false, children }) {
  return <SourceTooltip content={label} delay={500} closeDelay={0} hoverable={false}>
    <span role={live ? "status" : "img"} aria-label={label} className="source-status-glyph">{children}</span>
  </SourceTooltip>;
}

// sidebar-rows.js:6687-6697 fE (PR state names) for the review glyph; :6755-6772 TE/EE/DE for the code
// error glyph: rate_limit -> usage, network -> offline, anything else -> warning.
const PR_STATE_LABELS = { open: t("Open"), draft: t("Draft"), approved: t("Approved"), changesRequested: t("Changes requested"), conflicting: t("Merge conflicts") };
const ERROR_GLYPHS = { warning: ["Warning", "danger"], usage: ["UsageGaugeHigh", "danger"], offline: ["CloudSlash", "secondary"] };

/** NO (sidebar-rows.js:8512-8545) with DO/mO/bO/CO (:8152-8270): archived, error, awaiting, running,
 * unread ('ready') and the idle hollow dot. The error label is bO's category title (rO): the short
 * turn-error headline, or shared-18 W.generic 'Something went wrong' when no turn error is known. */
function SessionStatus({ session, state, unread }) {
  const status = sessionState(session, state);
  const approval = hasPendingApproval(state, session.id);
  if (sessionArchived(session)) return <StatusGlyph label={t("Archived")}><Icon name="Archive" size={16} className="source-status-archived" /></StatusGlyph>;
  if (status === "blocked" && !approval) {
    const error = latestTurnError(state, session.id);
    const view = error ? describeTurnError(error) : null;
    const [icon, tone] = ERROR_GLYPHS[view?.category === "rate_limit" ? "usage" : view?.category === "network" ? "offline" : "warning"];
    return <StatusGlyph live label={view?.headline ?? t("Something went wrong")}>
      <Icon name={icon} size={16} className="source-status-error" data-tone={tone} />
    </StatusGlyph>;
  }
  if (status === "blocked" || status === "working" || unread) {
    const kind = approval ? "awaiting" : status === "working" ? "running" : "ready";
    return <StatusGlyph live label={approval ? t("Awaiting input") : status === "working" ? t("Running") : t("Unread response")}>
      <span className="status-dot" data-kind={kind} />
    </StatusGlyph>;
  }
  if (status === "review") return <StatusGlyph label={PR_STATE_LABELS[session.prState] ?? t("Open")}><Icon name="GitPullRequest" size={16} /></StatusGlyph>;
  return <StatusGlyph label={t("Idle")}><span className="source-session-dot" /></StatusGlyph>;
}

/** AD + jD (sidebar-rows.js:7222-7325): the inline edit field. It focuses and selects on entry; a blur in
 * the first 250ms refocuses it; Enter submits and Escape cancels, both returning focus to the row; a
 * later blur submits without moving focus. Submitting closes at once; the caller shows the optimistic
 * name and reverts it if the request fails. jD classes: hide-focus-ring bg-transparent text-primary
 * border-none. */
function InlineRenameInput({ initial, label, maxLength, className = "", onCommit, onClose }) {
  const [value, setValue] = useState(initial);
  const input = useRef(null), done = useRef(false), entering = useRef(true);
  useEffect(() => {
    input.current?.focus(); input.current?.select();
    entering.current = true;
    const timer = setTimeout(() => { entering.current = false; }, 250);
    return () => clearTimeout(timer);
  }, []);
  const finish = (submit, refocus) => {
    if (done.current) return;
    done.current = true;
    onClose(refocus);
    const name = value.trim();
    if (submit && name && name !== initial) onCommit(name);
  };
  return <input ref={input} type="text" value={value} maxLength={maxLength} aria-label={t(label)}
    className={`hide-focus-ring ${className}`.trim()} onChange={(event) => setValue(event.target.value)}
    onBlur={() => {
      if (done.current) return;
      if (entering.current) { input.current?.focus(); input.current?.select(); return; }
      finish(true, false);
    }}
    onKeyDown={(event) => {
      event.stopPropagation();
      if (event.nativeEvent.isComposing) return;
      if (event.key === "Enter") { event.preventDefault(); finish(true, true); }
      else if (event.key === "Escape") { event.preventDefault(); finish(false, true); }
    }} />;
}

/** sidebar-rows.js:7400-7420, :7531-7537: the editing row keeps the row's own leading status glyph and
 * its hover/selected background (kD + ED, no ring); the field is labelled 'Rename'. */
function RenameRow({ label, glyph, selected, nested, onCommit, onClose }) {
  return <div className="source-session-row source-session-rename" data-row="" data-nested={nested || undefined}
    data-selected={selected ? "focused" : undefined}>
    <span className="source-leading-slot">{glyph}</span>
    <InlineRenameInput initial={label} label={t("Rename")} maxLength={200} className="source-session-rename-input" onCommit={onCommit} onClose={onClose} />
  </div>;
}

// sidebar-session.js:16434-16510 ZB on the shared Dialog: size sm, comfortable density (Kl), a Header
// without the close button, a grid gap-2 form whose 'Group name' field takes the initial focus, the
// switchNote when the list is not grouped by custom, and a Footer with Cancel (secondary) and 'Create
// group' / 'Create and group by custom' (primary). Renaming is inline in the group header (QD).
function GroupNameDialog({ switchesToCustom = false, onSubmit, onClose, open, onExited }) {
  const [name, setName] = useState(""), [pending, setPending] = useState(false), [error, setError] = useState("");
  const input = useRef(null);
  const close = () => { if (!pending) onClose(); };
  return <SourceDialog open={open} onExited={onExited} size="sm" showClose={false} density="comfortable" title={t("New group")} initialFocusRef={input}
    onClose={close} className="source-group-dialog">
    <form className="source-group-form" onSubmit={async (event) => {
      event.preventDefault();
      if (!name.trim() || pending) return;
      setPending(true); setError("");
      try { await onSubmit(name.trim()); onClose(); }
      catch (reason) { setError(reason.message || String(reason)); setPending(false); }
    }}>
      <input ref={input} aria-label={t("Group name")} placeholder={t("Group name")} value={name} maxLength={100}
        disabled={pending} onChange={(event) => setName(event.target.value)} />
      {switchesToCustom && <p className="source-group-switch-note">{t("The list will switch to Custom groups to show it.")}</p>}
      {error && <p role="alert">{error}</p>}
      <SourceDialogFooter>
        <SourceSettingsButton disabled={pending} onClick={close}>{t("Cancel")}</SourceSettingsButton>
        <SourceSettingsButton type="submit" variant="primary" busy={pending} disabled={!name.trim()}>{switchesToCustom ? t("Create and group by custom") : t("Create group")}</SourceSettingsButton>
      </SourceDialogFooter>
    </form>
  </SourceDialog>;
}

/** yD deleteBody (sidebar-rows.js:7097-7140) for a custom group holding `count` sessions. */
export function deleteGroupCopy(groupName, count) {
  const rest = count === 0 ? t("Nothing is in it.") : tn(count, "The {count} item in it will no longer be grouped.", "The {count} items in it will no longer be grouped.");
  return { title: t("Delete group?"), body: t("“{name}” will be removed. {rest}", { name: groupName, rest }), confirmLabel: t("Delete"), danger: true };
}

/** Confirm dialog for destructive sidebar actions: the shared ConfirmationDialog (shared-frame rp,
 * danger confirmVariant). The confirm action runs before the dialog closes; a rejection stays
 * inside the dialog. */
export function SourceConfirmDialog({ title, body, confirmLabel, danger = false, onConfirm, onClose, open, onExited }) {
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  return <SourceConfirmationDialog open={open} onExited={onExited} title={title} body={body} descriptionClassName="source-confirm-body"
    confirmLabel={confirmLabel} confirmVariant={danger ? "danger" : "primary"} pending={pending} onCancel={onClose}
    className="source-confirm-dialog" onConfirm={async () => {
      setPending(true); setError("");
      try { await onConfirm(); onClose(); }
      catch (reason) { setError(reason.message || String(reason)); setPending(false); }
    }}>
    {error && <p role="alert" className="source-confirm-error">{error}</p>}
  </SourceConfirmationDialog>;
}

// The DeepSeek core's thread/delete also deletes the Harness history
// (~/.dsh/sessions/<project>/<id>, codex-app-server deleteSessionFiles), so its
// dialogs say so. engine is boot.core's ("deepseek", or the raw "deepseek-harness").
const deletesHarnessHistory = (engine) => engine === "deepseek" || engine === "deepseek-harness";

/** sidebar-session.js:13885-13924 delete confirm copy; DeepSeek names the Harness history too. */
export function deleteConfirmCopy(sessions, { engine } = {}) {
  const count = sessions.length, harness = deletesHarnessHistory(engine);
  return {
    title: tn(count, "Delete session?", "Delete {count} sessions?"),
    body: count === 1
      ? harness ? t("“{name}” and its history in DeepSeek Harness (~/.dsh/sessions) will be permanently deleted. This can’t be undone.", { name: sessionName(sessions[0]) })
        : t("“{name}” will be permanently deleted. This can’t be undone.", { name: sessionName(sessions[0]) })
      : harness ? t("These {count} sessions and their history in DeepSeek Harness (~/.dsh/sessions) will be permanently deleted. This can’t be undone.", { count })
        : t("These {count} sessions will be permanently deleted. This can’t be undone.", { count }),
    confirmLabel: t("Delete"), danger: true,
  };
}

/** sidebar-groups.js:18641-18669 Older bucket confirm copy (DeepSeek: remove copy). */
export function olderConfirmCopy(action, count, { engine } = {}) {
  if (action === "archive") return {
    title: t("Archive older sessions?"),
    body: tn(count, "This will archive {count} session older than a week. Pinned sessions aren’t affected.", "This will archive {count} sessions older than a week. Pinned sessions aren’t affected."),
    confirmLabel: t("Archive all"), danger: false,
  };
  return {
    title: t("Delete older sessions?"),
    body: tn(count, ...(deletesHarnessHistory(engine) ? ["This will permanently delete {count} session older than a week, including its DeepSeek Harness history. Pinned sessions aren’t affected. This can’t be undone.", "This will permanently delete {count} sessions older than a week, including their DeepSeek Harness history. Pinned sessions aren’t affected. This can’t be undone."]
      : ["This will permanently delete {count} session older than a week. Pinned sessions aren’t affected. This can’t be undone.", "This will permanently delete {count} sessions older than a week. Pinned sessions aren’t affected. This can’t be undone."])),
    confirmLabel: t("Delete all"), danger: true,
  };
}

async function mapConcurrent(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      try { results[index] = { status: "fulfilled", value: await task(items[index]) }; }
      catch (reason) { results[index] = { status: "rejected", reason }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// sidebar-groups.js:7648-7671 hO/gO/_O pictogram rects, verbatim; bO
// (:7672-7686) emits hO as whole rects and gO/_O through the vO checkerboard
// (gO cells where (row+col)%2==0, _O cells where row%2==0 && col%2==0).
const EMPTY_PICTO_RECTS = [[90, 0, 20, 20], [90, 40, 20, 20], [70, 20, 20, 20], [110, 20, 20, 20]];
const EMPTY_PICTO_CHECKER = [[20, 40, 20, 20], [20, 80, 20, 20], [0, 60, 20, 20], [40, 60, 20, 20], [90, 20, 20, 20], [140, 40, 10, 20],
  [110, 60, 10, 20], [130, 60, 20, 20], [120, 80, 20, 20], [110, 100, 10, 20], [100, 120, 10, 20]];
const EMPTY_PICTO_SPARSE = [[20, 60, 20, 20], [40, 100, 10, 20], [50, 120, 10, 20]];
const pictoCells = (rects, keep) => {
  let d = "";
  for (const [x, y, w, h] of rects) for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) if (keep(row, col)) d += `M${x + col} ${y + row}h1v1h-1z`;
  return d;
};
let emptyPictoPath = null;
const emptyPictogramPath = () => (emptyPictoPath ??= EMPTY_PICTO_RECTS.map(([x, y, w, h]) => `M${x} ${y}h${w}v${h}h${-w}z`).join("")
  + pictoCells(EMPTY_PICTO_CHECKER, (row, col) => (row + col) % 2 === 0) + pictoCells(EMPTY_PICTO_SPARSE, (row, col) => row % 2 === 0 && col % 2 === 0));

/** sidebar-groups.js:7688-7699 xO (scale .55 from OO) + 7721-7760 OO: the
 * filtered variant offers "Show all sessions" when a handler exists
 * (sidebar-main.js:13774-13778 onShowAllSessions, code mode only). */
export function SourceSidebarEmpty({ variant, onShowAllSessions }) {
  if (variant === "filtered") return <div className="source-sidebar-empty" data-empty-variant="filtered">
    <p className="source-sidebar-empty-text">{t("No sessions match the current filters")}</p>
    {onShowAllSessions && <button type="button" className="source-sidebar-show-all hide-focus-ring" onClick={onShowAllSessions}>{t("Show all sessions")}</button>}
  </div>;
  const scale = 0.55;
  return <div className="source-sidebar-empty" data-empty-variant="no-sessions">
    <p className="source-sidebar-empty-text">{t("Sessions you start will show up here")}</p>
    <div aria-hidden="true"><svg width={150 * scale} height={140 * scale} viewBox="0 0 150 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d={emptyPictogramPath()} fill="hsl(var(--pictogram-200))" />
    </svg></div>
  </div>;
}

/** sidebar-groups.js:7761-7830 AO single-line rows: df-leading-slot with a
 * 6x6 rounded-full Ml skeleton, then a kO-width bar at the row font height.
 * The source row count comes from rememberedRecentsRows, which this app does
 * not persist, so the local count stays 3. */
const SKELETON_WIDTHS = ["68%", "54%", "44%"];
export function SourceSidebarSkeleton({ rows = 3 }) {
  return <div className="df-placeholder-rows source-sidebar-skeleton" data-testid="sidebar-rows-skeleton" role="status" aria-label={t("Loading sessions")}>
    {Array.from({ length: rows }, (_, index) => <div key={index} data-row="" className="source-sidebar-skeleton-row">
      <span className="source-leading-slot"><span data-cds="Skeleton" className="smenu-skeleton source-skeleton-dot" style={{ width: 6, height: 6 }} /></span>
      <span data-cds="Skeleton" className="smenu-skeleton" style={{ width: SKELETON_WIDTHS[index % SKELETON_WIDTHS.length], height: "var(--df-row-font, 13px)" }} />
    </div>)}
  </div>;
}

/** sidebar-groups.js:5113-5207 uw over shared-19-CjdiaR4X.js Os (o_, the CDS
 * ResizeHandle). A drag only moves --df-sidebar-width on .dframe-root (with
 * data-resizing, shared-2 setIsResizing -> sidebar-main.js:15316); raw widths
 * below MIN/2 hide the sidebar live (TL, setCollapsedPref, persisted per
 * change like cmd+b) and the width commits once at the end. A press without
 * a >3px move (Os ws) or Enter/Space is the Hide sidebar toggle (Tm
 * "resize_handle"). Arrows (Os 8 / Shift 32) and Home/End commit once each,
 * clamped to minWidth..Do(innerWidth); minWidth is the sidebar floor (wL). Local adaptations: pointer events with
 * capture (useSourcePointerResize) instead of document mouse events, and
 * Escape/pointercancel restore the start width and expanded state (Os has
 * no cancel). The Tl canHide gate defaults on and has no local toggle. The
 * NL/RL focus hand-off to Show sidebar has no local counterpart. */
// shared-19-CjdiaR4X.js Os class strings for a vertical side="inline-end"
// handle (served by the loaded design-system utilities); the ring and pill
// children are verbatim. shared-styles (desktop-layout.css:1462-1471,
// 2032-2036) adds z-index 25, the 37.5% clip, and the web top/ring values.
const RESIZE_HANDLE_CLASS = "cds-reset group/resize outline-none focus-visible:outline-hidden w-3 cursor-col-resize absolute inset-y-0 end-[calc(-6px_-_(var(--cds-ring-outer,0px)_-_var(--cds-ring-inner,0px))_/_2)]";
const RESIZE_RING_CLASS = "absolute rounded-full transition-shadow duration-fast group-focus-visible/resize:shadow-focus inset-y-0 left-1/2 w-3 -translate-x-1/2 cursor-col-resize";
const RESIZE_PILL_CLASS = "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current transition-[opacity,color,background-color] h-full max-h-12 w-[3px] group-focus-visible/resize:max-h-none";
const RESIZE_PILL_DRAGGING = "text-secondary opacity-100 duration-snap";
const RESIZE_PILL_IDLE = "text-muted opacity-[var(--cds-resize-pill-force,0)] delay-200 duration-base group-hover/resize:opacity-100";
const RESIZE_PILL_FOCUS = "group-focus-visible/resize:bg-fill-accent group-focus-visible/resize:opacity-100 group-focus-visible/resize:delay-0";
function SidebarResizeHandle({ width, minWidth = SIDEBAR_WIDTH.MIN, onCommit, onCollapse, onCollapsedChange }) {
  const handle = useRef(null), drag = useRef(null);
  const start = () => {
    const root = handle.current?.closest(".dframe-root");
    if (!root) return false;
    const startW = Number.parseFloat(getComputedStyle(root).getPropertyValue("--df-sidebar-width"));
    drag.current = { root, startW, currentW: startW, maxW: sidebarMaxWidth(window.innerWidth), minWidth, canHide: true, hidden: false, moved: false };
    root.toggleAttribute("data-resizing", true);
    return true;
  };
  const resize = (delta) => {
    const state = drag.current;
    if (!state) return;
    const frame = sidebarDragFrame(state, delta);
    if (!frame.hidden) {
      state.currentW = frame.width;
      state.root.style.setProperty("--df-sidebar-width", `${state.currentW}px`);
    }
    if (frame.hidden !== state.hidden) { state.hidden = frame.hidden; onCollapsedChange?.(frame.hidden); }
  };
  const release = () => {
    const state = drag.current;
    drag.current = null;
    state?.root.removeAttribute("data-resizing");
    document.body.style.cursor = ""; document.body.style.userSelect = "";
    return state;
  };
  // uw onResizeEnd(dragged).
  const finish = (dragged) => {
    const state = release();
    if (!state) return;
    // Local: a sub-threshold press also restores the var (Os already moved
    // it up to 3px, and uw leaves it there until the next width commit).
    if (!dragged) { state.root.style.setProperty("--df-sidebar-width", `${state.startW}px`); onCollapse?.(); return; }
    if (state.hidden) { state.root.style.setProperty("--df-sidebar-width", `${state.startW}px`); return; }
    onCommit?.(state.currentW);
  };
  const cancel = () => {
    const state = release();
    if (!state) return;
    state.root.style.setProperty("--df-sidebar-width", `${state.startW}px`);
    if (state.hidden) onCollapsedChange?.(false);
  };
  const { onPointerDown, dragging } = useSourcePointerResize({
    focusOnStart: false,
    onStart: () => {
      // Os: col-resize cursor and no text selection on the body while dragging.
      if (start()) { document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; }
    },
    onMove: (delta) => {
      if (drag.current && isResizeDrag(delta)) drag.current.moved = true;
      resize(delta);
    },
    onEnd: () => finish(!!drag.current?.moved),
    onCancel: cancel,
  });
  useEffect(() => () => { if (drag.current) release(); }, []);
  const onKeyDown = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || drag.current || dragging) return;
    if ((event.key === "Enter" || event.key === " ") && !event.shiftKey) {
      event.preventDefault();
      if (event.repeat) return;
      if (start()) finish(false);
      return;
    }
    const step = event.shiftKey ? KEYBOARD_STEP_LARGE : KEYBOARD_STEP;
    const delta = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    if (delta !== 0) {
      event.preventDefault();
      if (start()) { resize(delta); finish(true); }
      return;
    }
    // uw f: Home commits minWidth, End max(minWidth, Do(innerWidth)).
    const target = event.key === "Home" ? minWidth : event.key === "End" ? Math.max(minWidth, sidebarMaxWidth(window.innerWidth)) : null;
    if (target !== null) { event.preventDefault(); onCommit?.(target); }
  };
  // Kl {side right, trackCursorAxis y, hoverable false, cmd+b, "Drag to
  // resize"}; closed while a drag is in progress.
  return <SourceTooltip side="right" trackCursorAxis="y" hoverable={false} content={SIDEBAR_TOGGLE_TOOLTIP.hide.content}
    shortcut={SIDEBAR_TOGGLE_TOOLTIP.hide.shortcut} detail={t("Drag to resize")} open={dragging ? false : undefined}>
    <div ref={handle} className={`${RESIZE_HANDLE_CLASS} sidebar-resizer dframe-resize-handle`} data-cds="ResizeHandle" role="separator" aria-label={t("Resize sidebar")}
      aria-orientation="vertical" tabIndex={0} aria-valuenow={Math.round(Math.max(width, minWidth))}
      aria-valuemin={minWidth} aria-valuemax={SIDEBAR_WIDTH.MAX} data-dragging={dragging ? "" : undefined}
      onPointerDown={onPointerDown} onKeyDown={onKeyDown}>
      <div aria-hidden="true" className={RESIZE_RING_CLASS} />
      <div aria-hidden="true" data-cds-part="resize-pill" className={`${RESIZE_PILL_CLASS} ${dragging ? RESIZE_PILL_DRAGGING : RESIZE_PILL_IDLE} ${RESIZE_PILL_FOCUS}`} />
    </div>
  </SourceTooltip>;
}

const SELECTION_DOMAIN = "code";
const SOURCE_TRUNCATE_AT = 20;
const EMPTY_REVEALED = new Map();
// Dialog backdrops live in a [data-cds-portal] root (source-dialog.jsx).
const SELECTION_SAFE_SELECTOR = '[data-row], [data-cds-portal], [role="menu"], [role="listbox"], [role="dialog"], [role="alertdialog"]';

export function SourceSidebar({
  collapsed, onCollapse, onCollapsedChange, historyAt = 0, historyLength = 1, travel, mode = "code", onMode,
  onNew, groups = [], sessions, current, state = {}, onOpen, onProject, onMenu, onAccount, accountMenuOpen = false, connectionMenuOpen = false,
  displayName = t("Local user"), accountLabel, search = "", setSearch, showSearch, setShowSearch,
  onFolder, sidebarWidth = 288, setSidebarWidth, section, setSection, sidebarFloor = SIDEBAR_WIDTH.MIN, onSidebarFloor, fullScreen = false,
  trafficLightSpacer, cdsFont = "sans",
  sidebarPreferences, onSidebarPreferencesChange, sessionMetadata = {}, customGroups = [], pinnedOrder = [],
  knownFolders, fallbackCwd = "", onSessionAction, onCreateGroup, onGroupAction, loading = false,
  engine = "codex", hiddenSessions, forkUnavailable,
  // Fidelity F08: Folder grouping by repo identity + the persisted section order, and the collapsed
  // hover peek owned by main.jsx (peekOpen mirrors .dframe-root[data-hovering]).
  repoIdentities, projectOrder = [], peekOpen = false, onPeekEnter, onPeekLeave,
}) {
  const toasts = useSourceToasts();
  // Ro addSuccess / addError (sidebar-groups.js:18676-18682): row and bulk results are CDS toasts.
  const notify = (message, options) => toasts?.add(message, options);
  const notifyError = (reason, fallback = t("Something went wrong")) => notify(reason?.message || (reason ? String(reason) : fallback), { variant: "danger" });
  const [localPreferences, setLocalPreferences] = useState(() => normalizeSidebarPreferences(sidebarPreferences));
  const preferences = normalizeSidebarPreferences(sidebarPreferences ?? localPreferences);
  const [closed, setClosed] = useState(new Set()), [menu, setMenuState] = useState(null);
  // Every open gets a fresh token so the popup remounts instead of re-targeting
  // a live instance (a right-click while another sidebar menu is open).
  const menuToken = useRef(0);
  const setMenu = useCallback((next) => setMenuState(next ? { ...next, token: ++menuToken.current } : null), []);
  const navRef = useRef(null), laneSentinel = useRef(null);
  // sidebar-rows.js:7887-7896 + 7970-7977 eO: onScroll pins scrollLeft to 0
  // and marks data-scrolled past 2px (desktop-layout.css:799-801 top fade).
  const [scrolled, setScrolled] = useState(false);
  // sidebar-rows.js:7898-7908: measure the nav scroller's reserved lane
  // (offsetWidth - clientWidth) into --df-nav-scrollbar-lane on the enclosing
  // body, re-measured by a ResizeObserver on a zero-height sentinel inside the
  // scroller. Zero in overlay mode; the thin classic lane otherwise.
  useLayoutEffect(() => {
    const nav = navRef.current, scope = nav?.parentElement, sentinel = laneSentinel.current;
    if (!nav || !scope || !sentinel) return undefined;
    let applied = scope.style.getPropertyValue("--df-nav-scrollbar-lane") || "0px";
    const measure = () => {
      const next = `${nav.offsetWidth - nav.clientWidth}px`;
      if (next !== applied) { applied = next; scope.style.setProperty("--df-nav-scrollbar-lane", next); }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [collapsed]);
  // eO scrollResetKey (sidebar-main filter epoch): a filter change scrolls the
  // list back to the top and clears the fade. Locally keyed on the normalized
  // status/group/sort/activity/empty-groups preferences.
  const scrollResetKey = [preferences.status, preferences.groupBy, preferences.sortBy, preferences.stateActivityDays, preferences.showEmptyGroups].join("\u0000");
  useEffect(() => {
    const nav = navRef.current;
    if (nav && nav.scrollTop !== 0) nav.scrollTop = 0;
    setScrolled(false);
  }, [scrollResetKey]);
  const [renaming, setRenaming] = useState(null), [groupDialog, setGroupDialog] = useState(null), [confirm, setConfirm] = useState(null);
  // Closed dialogs stay mounted through their exit transition (source-dialog.jsx).
  const shownGroupDialog = useDialogRetention(groupDialog), shownConfirm = useDialogRetention(confirm);
  // AD optimistic labels: the submitted name shows until the session (or group) carries it, and is
  // dropped again when the request fails. renamingGroup: the custom group whose header is an input (QD).
  const [pendingNames, setPendingNames] = useState(() => new Map()), [pendingGroupNames, setPendingGroupNames] = useState(() => new Map());
  const [renamingGroup, setRenamingGroup] = useState(null);
  // pj hint store (sidebar-groups.js:9110-9132 qA): {rowKey: digit} while the held-modifier hints show.
  const [jumpHints, setJumpHints] = useState(null);
  const [selection, setSelectionState] = useState(createSelection);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const pendingRevealFocus = useRef(null), toolbarRef = useRef(null);
  // wL (shared-22-Cz3C_T8d.js:13945-13959) sums the chrome bar parts
  // (traffic-light spacer, search, nav, switcher) into the sidebar floor;
  // locally those parts are the toolbar row, measured at max-content. The
  // traffic-light spacer is gone in full screen, like wL's spacer px.
  useLayoutEffect(() => {
    const node = toolbarRef.current;
    // F08: the collapsed aside stays mounted for the hover peek with its toolbar hidden, so the floor
    // keeps its expanded value until the sidebar is shown again.
    if (!node || !onSidebarFloor || collapsed) return;
    // The aside's own right border (0.5px, painted as a device pixel) is
    // part of its width; it is dropped while collapsed, so re-measure then.
    const aside = node.parentElement, previous = node.style.width;
    node.style.width = "max-content";
    const floor = sidebarFloorWidth(node.getBoundingClientRect().width + (aside.offsetWidth - aside.clientWidth));
    node.style.width = previous;
    onSidebarFloor(floor);
  }, [fullScreen, collapsed, onSidebarFloor, trafficLightSpacer]);
  const sourceSessions = useMemo(() => sessions ?? groups.flatMap(([, items]) => items), [sessions, groups]);
  const folders = useMemo(() => knownFolders ?? groups.map(([cwd]) => cwd), [knownFolders, groups]);
  const displayed = useMemo(() => buildSidebarGroups({ sessions: sourceSessions,
    preferences, metadata: sessionMetadata, customGroups, knownFolders: folders,
    state, search, fallbackCwd, pinnedOrder, repoIdentities, projectOrder,
  }), [sourceSessions, preferences.groupBy, preferences.sortBy, preferences.status,
    preferences.stateActivityDays, preferences.showEmptyGroups, sessionMetadata, customGroups, folders, state, search, fallbackCwd, pinnedOrder,
    repoIdentities, projectOrder]);
  // sidebar-groups.js:21476-21486 CO(visible, total, hasNonDefaultFilter) + wO
  // hasArchived; the archived probe is the loaded session list here. The
  // hasNonDefaultFilter is fO (:7600-7609), not the filter badge's test.
  const visibleCount = displayed.reduce((sum, group) => sum + group.sessions.length, 0);
  const emptyVariant = sidebarEmptyVariant({ visible: visibleCount, total: sourceSessions.length,
    hasNonDefaultFilter: sidebarEmptyHasNonDefaultFilter(preferences), hasArchived: sourceSessions.some(sessionArchived) });
  // sidebar-groups zF/WF/GF/KF per bucket: lineage runs from real Thread fields.
  const runsByGroup = useMemo(() => new Map(displayed.map((group) => [group.key, buildNestedRuns(group.sessions, sessionMetadata)])), [displayed, sessionMetadata]);
  const collapsedNested = useMemo(() => new Set(preferences.collapsedNested), [preferences.collapsedNested]);
  const needsInput = useCallback((session) => hasPendingApproval(state, session.id), [state.approvals, state.threadParents]);
  const splitRun = useCallback((run) => {
    const isCollapsed = collapsedNested.has(run.parentId);
    return { collapsed: isCollapsed, kept: isCollapsed ? run.rows.filter(needsInput) : run.rows, hidden: isCollapsed ? run.rows.filter((row) => !needsInput(row)) : [] };
  }, [collapsedNested, needsInput]);
  // Bucket truncation (sidebar-main.js:11657 Yn: code mode truncateAt 20; the
  // 5-row variant needs a sidebar layout context this app does not have, and
  // chat mode never truncates). sidebar-main.js:9300-9316 Px(g, 20, S): the
  // Pinned section is cut at 20 in either mode. xF keeps extraRevealed per
  // bucket; it survives collapsing/reopening the group and is reset when the
  // vF filter epoch changes, locally the group/sort/status/activity/search
  // preferences (the stand-in for sidebar-main filterEpoch).
  const revealEpoch = [preferences.groupBy, preferences.sortBy, preferences.status, preferences.stateActivityDays, search].join("\u0000");
  const [revealState, setRevealState] = useState(() => ({ epoch: revealEpoch, byKey: new Map() }));
  // xF `m && (o(i), c(0), d(null))`: the epoch reset happens during render.
  if (revealState.epoch !== revealEpoch) setRevealState({ epoch: revealEpoch, byKey: new Map() });
  const revealed = revealState.epoch === revealEpoch ? revealState.byKey : EMPTY_REVEALED;
  const truncateAtFor = useCallback((group) => group.kind === "pinned" || mode === "code" ? SOURCE_TRUNCATE_AT : undefined, [mode]);
  // bF keep-visible rows: the open session, selected rows and rows awaiting input.
  const keepVisibleIds = useMemo(() => new Set([current, ...selection.selectedKeys, ...sourceSessions.filter(needsInput).map((session) => session.id)].filter(Boolean)),
    [current, selection.selectedKeys, sourceSessions, needsInput]);
  const truncatedByGroup = useMemo(() => new Map(displayed.map((group) => [group.key, truncateRuns(runsByGroup.get(group.key)?.runs || [], {
    truncateAt: truncateAtFor(group), extraRevealed: revealed.get(group.key) || 0, keepVisibleIds, shownRows: (run) => splitRun(run).kept,
  })])), [displayed, runsByGroup, truncateAtFor, revealed, keepVisibleIds, splitRun]);
  // xF `j > h && c(j)`: a keep-visible extension is written back so the row
  // stays revealed after the session/selection moves on.
  useEffect(() => {
    const grown = [...truncatedByGroup].filter(([key, result]) => result.extraRevealed > (revealed.get(key) || 0));
    if (grown.length === 0) return;
    setRevealState((previous) => {
      const byKey = new Map(previous.epoch === revealEpoch ? previous.byKey : []);
      for (const [key, result] of grown) byKey.set(key, Math.max(byKey.get(key) || 0, result.extraRevealed));
      return { epoch: revealEpoch, byKey };
    });
  }, [truncatedByGroup, revealed, revealEpoch]);
  // Visible row order for shift ranges (sidebar-groups bu ordered key list);
  // rows behind a bucket's Show more are not part of it.
  const visibleOrder = useMemo(() => {
    const ids = [];
    for (const group of displayed) {
      if (closed.has(group.key)) continue;
      for (const run of truncatedByGroup.get(group.key)?.runs || []) {
        if (run.parentId === null) ids.push(...run.rows.map((row) => row.id));
        else ids.push(...splitRun(run).kept.map((row) => row.id));
      }
    }
    return ids;
  }, [displayed, closed, truncatedByGroup, splitRun]);
  const visibleOrderRef = useRef(visibleOrder);
  visibleOrderRef.current = visibleOrder;
  const sessionById = useMemo(() => new Map(sourceSessions.map((session) => [session.id, session])), [sourceSessions]);
  const selectedSessions = useMemo(() => visibleOrder.filter((id) => isSelected(selection, id)).map((id) => sessionById.get(id)).filter(Boolean), [visibleOrder, selection, sessionById]);
  useEffect(() => { setMenu(null); }, [collapsed]);
  useEffect(() => { setSelectionState((previous) => pruneSelection(previous, sessionById.keys())); }, [sessionById]);
  // sidebar-groups ZT/QT: Escape and a plain pointerdown outside rows, menus
  // and dialogs clear a non-empty selection.
  const hasSelection = selection.selectedKeys.size > 0;
  useEffect(() => {
    if (!hasSelection) return undefined;
    const onKey = (event) => { if (event.key === "Escape") setSelectionState(clearSelection); };
    const onPointer = (event) => {
      if (event.shiftKey || event.metaKey || event.ctrlKey || event.button !== 0) return;
      if (event.target instanceof Element && event.target.closest(SELECTION_SAFE_SELECTOR)) return;
      setSelectionState(clearSelection);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer, true);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onPointer, true); };
  }, [hasSelection]);
  // AD h(): an optimistic label is dropped once the real name matches it (or the row/group is gone).
  useEffect(() => {
    setPendingNames((previous) => {
      if (previous.size === 0) return previous;
      const next = new Map([...previous].filter(([id, name]) => sessionById.has(id) && sessionName(sessionById.get(id)) !== name));
      return next.size === previous.size ? previous : next;
    });
  }, [sessionById]);
  useEffect(() => {
    setPendingGroupNames((previous) => {
      if (previous.size === 0) return previous;
      const names = new Map(customGroups.map((group) => [group.id, group.name]));
      const next = new Map([...previous].filter(([id, name]) => names.has(id) && names.get(id) !== name));
      return next.size === previous.size ? previous : next;
    });
  }, [customGroups]);
  const shownName = (session) => pendingNames.get(session.id) ?? sessionName(session);
  const shownGroupLabel = (group) => (group.customGroupId && pendingGroupNames.get(group.customGroupId)) || group.label;
  const forget = (setter, id, name) => setter((previous) => {
    if (previous.get(id) !== name) return previous;
    const next = new Map(previous); next.delete(id); return next;
  });
  const commitSessionRename = (session, name) => {
    setPendingNames((previous) => new Map(previous).set(session.id, name));
    Promise.resolve(onSessionAction?.("rename", session, { name })).catch((reason) => {
      forget(setPendingNames, session.id, name);
      notifyError(reason);
    });
  };
  const commitGroupRename = (group, name) => {
    setPendingGroupNames((previous) => new Map(previous).set(group.customGroupId, name));
    Promise.resolve(onGroupAction?.("rename", group, { name })).catch((reason) => {
      forget(setPendingGroupNames, group.customGroupId, name);
      notifyError(reason);
    });
  };
  // pj + bL (sidebar-jump-model.mjs): ⌘1–9 opens the Nth visible row; holding ⌘ (or Ctrl+Shift) for
  // 200ms shows 1–9 over the leading slots. Inert while collapsed or under a menu or a modal dialog.
  const jumpBlocked = useRef(() => false);
  jumpBlocked.current = () => collapsed || !!document.querySelector('[role="menu"]') || document.getElementById("root")?.inert === true;
  useEffect(() => {
    const hints = createJumpHints({
      rows: () => collectJumpRows(navRef.current?.querySelectorAll("[data-jump-hint-row]") ?? []),
      blocked: () => jumpBlocked.current(),
      typing: () => isTypingTarget(document.activeElement),
      show: setJumpHints, hide: () => setJumpHints(null),
      open: (row) => {
        const button = row.querySelector("[data-row-main-button]");
        if (!button) return;
        button.scrollIntoView({ block: "nearest" });
        button.click();
      },
    });
    const keydown = (event) => hints.keydown(event), keyup = (event) => hints.keyup(event), pointer = (event) => hints.pointer(event), reset = () => hints.reset();
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", reset);
    window.addEventListener("mousemove", pointer);
    window.addEventListener("mousedown", pointer);
    window.addEventListener("wheel", pointer, { passive: true });
    document.addEventListener("visibilitychange", reset);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", reset);
      window.removeEventListener("mousemove", pointer);
      window.removeEventListener("mousedown", pointer);
      window.removeEventListener("wheel", pointer);
      document.removeEventListener("visibilitychange", reset);
      hints.reset();
    };
  }, []);
  useEffect(() => { if (collapsed) setJumpHints(null); }, [collapsed]);
  // ⌘⇧⌫ Archive session (ion-dist shared-19-CjdiaR4X.js rg/ag/ig, sidebar-jump-model.mjs): the row it
  // archives is the one shown in the focused pane (Xm/ao data-selected="focused"; locally the current
  // session, there is no split view), never a typing target with content (ig), under no modal layer or
  // menu (DB), with nothing multi-selected and not already archived. Once the archive commits, Qm
  // scrolls to and clicks the next row, else the previous one (Zm), which opens it; with no neighbour
  // tg returns the view Home. Code mode only ($e() === "code").
  const archiveInFlight = useRef(false), archiveShortcut = useRef(null);
  archiveShortcut.current = (event) => {
    if (event.defaultPrevented || !archiveChord(event) || archiveBlockedByField(document.activeElement)) return;
    if (mode !== "code" || !onSessionAction || !current || archiveInFlight.current || selectionRef.current.selectedKeys.size > 0) return;
    if (document.querySelector('[role="menu"]') || document.getElementById("root")?.inert === true) return;
    const keys = [...new Set([...(navRef.current?.querySelectorAll(".source-session-row[data-row-key]") ?? [])].map((node) => node.getAttribute("data-row-key")))];
    const session = sessionById.get(current);
    if (!keys.includes(current) || !session || sessionArchived(session)) return;
    event.preventDefault();
    const neighbour = archiveNeighbour(keys, current);
    archiveInFlight.current = true;
    Promise.resolve(onSessionAction("archive", session, { keepView: true })).then(() => {
      const button = neighbour && navRef.current?.querySelector(`.source-session-row[data-row-key="${CSS.escape(neighbour)}"] [data-row-main-button]`);
      if (button?.isConnected) { button.scrollIntoView({ block: "nearest" }); button.click(); }
      else onNew?.();
    }, (reason) => notifyError(reason)).finally(() => { archiveInFlight.current = false; });
  };
  useEffect(() => {
    const keydown = (event) => archiveShortcut.current?.(event);
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  const updatePreferences = (next) => {
    const normalized = normalizeSidebarPreferences(next);
    setLocalPreferences(normalized);
    onSidebarPreferencesChange?.(normalized);
  };
  const runAction = async (...args) => {
    try { await onSessionAction?.(...args); }
    catch (reason) { notifyError(reason); }
  };
  // Bulk actions (sidebar-groups XT / CodeSessionRowActionsHost multi payload):
  // concurrency 8, the open session is skipped for archive/delete. Results are
  // toasts (sidebar-groups.js:6219-6240 multi-select 'Archived {n} sessions',
  // key group-bulk-{action}; :18866-18915 Older bucket 'Archived {n} older
  // sessions', key {action}-older-bulk; both 3s; KT partial-failure addError).
  const runBulk = async (action, targets, payload, { older = false } = {}) => {
    const list = action === "archive" || action === "delete" ? targets.filter((session) => session.id !== current) : targets;
    const results = await mapConcurrent(list, 8, (session) => onSessionAction(action, session, payload));
    const done = results.filter((result) => result.status === "fulfilled").length;
    const failed = results.length - done;
    if (done > 0 && (action === "archive" || action === "delete")) notify(bulkDoneMessage(action === "archive" ? "Archived" : "Deleted", done, older ? "older session" : "session"),
      { variant: "neutral", key: older ? `${action}-older-bulk` : `group-bulk-${action}`, timeout: 3000 });
    if (failed > 0) notify(action === "archive" || action === "delete"
      ? bulkFailedMessage(action === "archive" ? "archived" : "deleted", failed)
      : results.find((result) => result.status === "rejected")?.reason?.message || t("Some sessions could not be updated."), { variant: "danger" });
    setSelectionState(clearSelection);
  };
  // A single Delete goes straight to the session action (the open session is
  // allowed and navigates home); bulk Delete skips the open session like archive.
  const requestDelete = (targets) => setConfirm({ ...deleteConfirmCopy(targets, { engine }),
    onConfirm: targets.length === 1 ? () => onSessionAction("delete", targets[0]) : () => runBulk("delete", targets) });
  const toggleGroup = (key) => setClosed((previous) => {
    const next = new Set(previous); next.has(key) ? next.delete(key) : next.add(key); return next;
  });
  const allParentIds = () => [...runsByGroup.values()].flatMap((entry) => entry.runs.filter((run) => run.parentId !== null).map((run) => run.parentId));
  const toggleNested = (parentId, all = false) => {
    const collapse = !collapsedNested.has(parentId);
    const next = new Set(collapsedNested);
    for (const id of all ? allParentIds() : [parentId]) collapse ? next.add(id) : next.delete(id);
    updatePreferences({ ...preferences, collapsedNested: [...next] });
  };
  const headerControls = <>
    {/* sidebar-groups.js:5352-5377 _w: aria-label and Kl content "Search" with the
        search_palette shortcut (⇧⌘K), hoverable false. The source opens its search
        palette; locally the button still toggles the inline search field below. */}
    {setShowSearch && <ToolButton label="Search" icon="Search" active={showSearch} tooltip={{ content: "Search", shortcut: "cmd+shift+k", hoverable: false }}
      onClick={() => setShowSearch((value) => !value)} />}
    {/* sidebar-main.js:12290-12350 lI: hp (shared-frame Nu, default side "top",
        shared-frame-C_2npUJq.js:4588) {content, hoverable:false, open:false
        while the filter menu is open} around a trigger with tooltip:false. */}
    <ToolButton label={hasSidebarFilters(preferences) ? t("Filter (active)") : t("Filter")} icon="Filter"
      tooltip={{ content: hasSidebarFilters(preferences) ? t("Filter (active)") : t("Filter"), hoverable: false, open: menu?.kind === "filter" ? false : undefined }}
      active={menu?.kind === "filter"}
      {...menuTriggerProps({ open: menu?.kind === "filter", onOpen: (entry, event) => setMenu({ kind: "filter", anchor: event.currentTarget, entry }) })}
      onClick={(event) => setMenu(menu?.kind === "filter" ? null : { kind: "filter", anchor: event.currentTarget })} />
  </>;
  // AD p(refocus): Enter/Escape return focus to the row's main button; a blur-submit does not.
  const closeRename = (id, refocus) => {
    setRenaming(null);
    if (refocus) requestAnimationFrame(() => document.querySelector(`[data-source-session-id="${CSS.escape(id)}"] [data-row-main-button]`)?.focus());
  };
  // XB 'Rename group' starts the header edit through a 100ms debounce (YB), after the menu has closed.
  const startGroupRename = (group) => setTimeout(() => setRenamingGroup(group.customGroupId), 100);
  const closeGroupRename = (group, refocus) => {
    setRenamingGroup(null);
    if (refocus) requestAnimationFrame(() => document.querySelector(`[data-group-key="${CSS.escape(group.key)}"] [data-group-toggle]`)?.focus());
  };
  // sidebar-groups H: shift range, cmd/ctrl toggle, alt is a split-pane action
  // with no local counterpart (ignored), plain click clears then opens.
  const rowClick = (event, session) => {
    if (event.shiftKey) {
      event.preventDefault();
      setSelectionState((previous) => selectRange(previous, previous.anchorKey, session.id, visibleOrderRef.current, SELECTION_DOMAIN));
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      setSelectionState((previous) => toggleSelection(previous, session.id, SELECTION_DOMAIN));
      return;
    }
    if (event.altKey) { event.preventDefault(); return; }
    setSelectionState(clearSelection);
    onOpen?.(session.id);
  };
  const openRowMenu = (session, extra) => {
    if (!onSessionAction) return;
    const multi = selectionRef.current.selectedKeys.size > 1 && isSelected(selectionRef.current, session.id);
    setMenu({ kind: "session", session, multi, ...extra });
  };
  const pinnedIds = displayed.find((group) => group.kind === "pinned")?.sessions.map((session) => session.id) || [];
  const renderRow = (session, { nested = null, parent = null, childCount = 0 } = {}) => {
    const selected = current === session.id || isSelected(selection, session.id);
    const glyph = <SessionStatus session={session} state={state} unread={sessionMetadata[session.id]?.unread} />;
    if (renaming === session.id) return <RenameRow key={session.id} label={shownName(session)} glyph={glyph} selected={selected} nested={nested}
      onCommit={(name) => commitSessionRename(session, name)} onClose={(refocus) => closeRename(session.id, refocus)} />;
    const kind = nested ? lineageKind(session, sessionMetadata) : null;
    const lineage = kind === "fork" ? t("Forked from {name}", { name: sessionName(parent) }) : kind ? t("Started by Claude from {name}", { name: sessionName(parent) }) : null;
    const hint = jumpHints?.[session.id];
    // sidebar-groups.js:17202-17213: rows carry data-row-key and data-jump-hint-row for the pj hints.
    return <div key={session.id} className="source-session-row" data-row="" data-source-session-id={session.id}
      data-selected={selected ? "focused" : undefined} data-menu-open={menu?.session?.id === session.id || undefined}
      data-unread={sessionMetadata[session.id]?.unread || undefined} data-archived={sessionArchived(session) || undefined}
      data-nested={nested || undefined} data-child-count={childCount || undefined} data-row-key={session.id} data-jump-hint-row=""
      onContextMenu={(event) => {
        if (!onSessionAction) return;
        event.preventDefault();
        openRowMenu(session, { anchor: event.currentTarget.querySelector('[data-row-main-button]'), point: { x: event.clientX, y: event.clientY } });
      }}>
      <button type="button" className="source-session-open" data-row-main-button="" data-roving-item=""
        aria-current={current === session.id ? "page" : undefined}
        onMouseDown={(event) => { if (event.shiftKey) event.preventDefault(); }}
        onClick={(event) => rowClick(event, session)}
        onDoubleClick={onSessionAction ? (event) => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey) setRenaming(session.id); } : undefined}
        onKeyDown={(event) => {
          if (event.key === "F2" && onSessionAction) { event.preventDefault(); setRenaming(session.id); }
          if ((event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) && onSessionAction) {
            event.preventDefault(); openRowMenu(session, { anchor: event.currentTarget });
          }
        }}>
        <span className="source-leading-slot">{glyph}</span>
        {/* sidebar-rows.js:7675-7729 qD: the label span (ref a) is the trigger of
            Xs {side "right", hoverable:false, lazy}; content is the title only
            while zD says it is truncated (inner scrollWidth > label
            offsetWidth), resolved when the tooltip opens, and none while
            dragging (ic) — here: while this row's menu is open (renaming swaps
            in RenameRow; there is no row drag). No native title. */}
        <SourceTooltip side="right" hoverable={false} open={menu?.session?.id === session.id ? false : undefined}
          content={() => textOverflows(document.querySelector(`[data-source-session-id="${CSS.escape(session.id)}"] .source-session-name`)) ? shownName(session) : undefined}>
          <span className="source-session-name"><span className="source-session-title">{shownName(session)}</span>{lineage && <span className="source-sr-only"> {lineage}</span>}</span>
        </SourceTooltip>
      </button>
      {/* sidebar-groups.js:9303-9312 mj: the aria-hidden keycap over the leading slot. */}
      {hint && <kbd aria-hidden="true" className="source-jump-hint">{hint}</kbd>}
      {/* sidebar-rows.js:7730-7750 JD: tooltip:false, tabIndex -1 and
          data-row-action (reached with ArrowRight from the row, not Tab). */}
      <ToolButton label={t("More options for {name}", { name: shownName(session) })} icon="DotsVertical" className="source-session-more code-icon-button"
        tooltip={false} tabIndex={-1} data-row-action=""
        {...menuTriggerProps({ open: menu?.session?.id === session.id, onOpen: (entry, event) => {
          if (onSessionAction) openRowMenu(session, { anchor: event.currentTarget, entry });
          else onMenu?.("session", event.currentTarget, session, entry);
        } })}
        onClick={(event) => {
          if (!onSessionAction) { onMenu?.("session", event.currentTarget, session); return; }
          if (menu?.session?.id === session.id && !menu.point) setMenu(null);
          else openRowMenu(session, { anchor: event.currentTarget });
        }} />
    </div>;
  };
  // sidebar-groups IR/LR/rI/oI: nested run with tree guide, fold handle and stub.
  const renderNested = (run, group) => {
    const parent = sessionById.get(run.parentId);
    const { collapsed: folded, kept, hidden } = splitRun(run);
    // sidebar-groups.js:13721-13729 ZF: an unread row is not also counted as
    // working; jK: "# more nested sessions" while some children stay listed.
    const { unread, working } = nestedStubCounts(hidden, { isUnread: (row) => !!sessionMetadata[row.id]?.unread, isWorking: (row) => sessionState(row, state) === "working" });
    const stubText = nestedStubText(hidden.length, kept.length > 0);
    const stubLabel = unread > 0 ? t("Show {sessions}, {count} new", { sessions: stubText, count: unread }) : t("Show {sessions}", { sessions: stubText });
    return <div key={`nest:${run.parentId}`} className="source-nested df-accordion-guide df-family" data-nested-parent={run.parentId} data-collapsed={folded || undefined}>
      {/* sidebar-groups.js:13749-13785 rI: Kl {content, lazy, delay 350, side
          "right"}; trackCursorAxis "y" has no local tooltip counterpart. */}
      <SourceTooltip content={folded ? t("Show nested sessions") : t("Hide nested sessions")} delay={350} side="right">
      <button type="button" className="df-family-handle" tabIndex={-1} aria-expanded={!folded}
        aria-label={folded ? t("Show nested sessions") : t("Hide nested sessions")}
        onMouseDown={(event) => event.preventDefault()} onPointerDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onClick={(event) => { event.stopPropagation(); if (event.detail > 1) return; toggleNested(run.parentId, event.altKey); }} />
      </SourceTooltip>
      {kept.map((row) => renderRow(row, { nested: run.parentId, parent }))}
      {hidden.length > 0 && <button type="button" className="df-family-stub" data-row="" data-roving-item="" aria-label={stubLabel}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => { if (event.detail > 1) return; toggleNested(run.parentId); }}>
        <span className="source-nested-stub-text">{stubText}</span>
        {unread > 0 && <span className="source-nested-stub-meta"><span aria-hidden="true">·</span>
          <span className="is-accent"><span className="status-dot" data-kind="ready" aria-hidden="true" />{t("{count} new", { count: unread })}</span></span>}
        {working > 0 && <span className="source-nested-stub-meta"><span aria-hidden="true">·</span>
          <span>{t("{count} working", { count: working })}</span></span>}
      </button>}
    </div>;
  };
  // sidebar-groups.js:13497-13512 xF showMoreRows: reveal truncateAt more
  // rows; ID(e) "always" (keyboard activation: detail 0 or :focus-visible)
  // moves focus to the first newly revealed row.
  const showMore = (group, truncated, event) => {
    const keyboard = event.detail === 0 || event.currentTarget.matches(":focus-visible");
    const step = truncateAtFor(group);
    if (keyboard && truncated.firstHiddenId) pendingRevealFocus.current = truncated.firstHiddenId;
    setRevealState((previous) => {
      const byKey = new Map(previous.epoch === revealEpoch ? previous.byKey : []);
      byKey.set(group.key, Math.max(byKey.get(group.key) || 0, truncated.extraRevealed) + step);
      return { epoch: revealEpoch, byKey };
    });
  };
  useEffect(() => {
    const id = pendingRevealFocus.current;
    if (!id) return;
    pendingRevealFocus.current = null;
    document.querySelector(`[data-source-session-id="${CSS.escape(id)}"] [data-row-main-button]`)?.focus();
  });
  const renderGroupRows = (group) => {
    const entry = runsByGroup.get(group.key);
    if (!entry) return null;
    const truncated = truncatedByGroup.get(group.key);
    const childCounts = new Map();
    for (const run of entry.runs) if (run.parentId !== null) childCounts.set(run.parentId, run.rows.length);
    return <>
      {(truncated?.runs || entry.runs).map((run) => run.parentId === null
        ? run.rows.map((session) => renderRow(session, { childCount: childCounts.get(session.id) || 0 }))
        : renderNested(run, group))}
      {/* sidebar-groups.js:17516-17525 BD / 7177-7231 VD: after the rows while
          rows are hidden; AD classes with a df-leading-slot spacer. */}
      {truncated?.hiddenCount > 0 && <button type="button" className="source-show-more" data-row="" data-roving-item=""
        aria-label={t("Show {count} more in {group}", { count: truncated.revealCount, group: group.label })} onClick={(event) => showMore(group, truncated, event)}>
        <span className="source-leading-slot df-leading-slot" aria-hidden="true" />{t("Show {count} more", { count: truncated.revealCount })}
      </button>}
    </>;
  };
  const olderTargets = (group, action) => bulkTargets(group.sessions, { metadata: sessionMetadata, currentId: current, state, action });
  // sidebar-groups.js:18919-18921 Vz: the Older bucket overflow button exists
  // only while at least one session is archivable or deletable; an open menu
  // closes with it. (The 2.2553.1 row hover card is disabled for every row
  // that is not awaiting input and flag-gated, so no summary card is rendered.)
  const olderGroup = preferences.groupBy === "date" && onSessionAction ? displayed.find((group) => group.key === "older") : null;
  const olderCounts = olderGroup ? { archive: olderTargets(olderGroup, "archive").length, delete: olderTargets(olderGroup, "delete").length } : { archive: 0, delete: 0 };
  const olderMenuAvailable = olderCounts.archive > 0 || olderCounts.delete > 0;
  useEffect(() => { if (!olderMenuAvailable) setMenuState((previous) => previous?.kind === "older" ? null : previous); }, [olderMenuAvailable]);
  // Group header menus: project buckets other than Other (OB inside LB), custom groups (XB). Both need
  // the persisted section order (onGroupAction "project-order").
  const groupMenuKind = (group) => !onGroupAction || !onSessionAction ? null : group.customGroupId ? "custom"
    : group.kind === "project" && group.projectKey && group.projectKey !== OTHER_PROJECT_KEY ? "project" : null;
  const sectionKeysOf = (custom) => sectionOrderKeys(displayed).filter((key) => isCustomOrderKey(key) === custom);
  const saveSectionOrder = (keys) => {
    if (!keys?.length) return;
    Promise.resolve(onGroupAction("project-order", null, { ids: withSectionOrder(projectOrder, keys) })).catch((reason) => notifyError(reason));
  };
  // XB I(): the delete confirm counts the sessions assigned to the group (Zv over the assignments).
  const requestGroupDelete = (group) => {
    const count = sourceSessions.filter((session) => sessionMetadata[session.id]?.customGroupId === group.customGroupId).length;
    setConfirm({ ...deleteGroupCopy(shownGroupLabel(group), count), onConfirm: () => onGroupAction("delete", group) });
  };
  // Mz (sidebar-groups.js:18411-18427): a new session for the group, prefilled with the folder its
  // sessions share (Ez), and filed into the group once it starts.
  const newSessionInGroup = (group) => {
    const folders = new Set(group.sessions.map((session) => session.cwd).filter(Boolean));
    Promise.resolve(onGroupAction("new-session", group, { cwd: folders.size === 1 ? [...folders][0] : null })).catch((reason) => notifyError(reason));
  };
  // pw u (sidebar-groups.js:5241): the whole IO identity (main.jsx accountIdentity), ellipsized by CSS.
  const accountName = displayName;
  const hiddenNotice = hiddenSessionsNotice(hiddenSessions, engine);
  // sidebar-main.js:14874-14892 pp wraps the sidebar in a CDS root provider
  // (shared-frame-C_2npUJq.js:1196-1208 Li: cds-root, data-density compact
  // on desktop, data-platform, data-font), so the sidebar gets compact tokens,
  // the desktop default cursor and the --cds-font-sans family.
  return <aside className="app-sidebar dframe-sidebar source-sidebar cds-root" aria-label={t("Sidebar")} data-variant="web" data-density="compact" data-platform="desktop" data-font={cdsFont}>
    <div ref={toolbarRef} className="sidebar-toolbar df-titlebar window-drag">
      <div className="traffic-space" />
      {/* sidebar-groups.js:5320 hw: "Hide sidebar" with CDS tooltip Kl
          {shortcut:"cmd+b", hoverable:false} and no native title; the sidebar
          is hidden (visibility) while collapsed, so this is the open state only. */}
      <ToolButton label={t("Hide sidebar")} tooltip={SIDEBAR_TOGGLE_TOOLTIP.hide} icon="Sidebar" onClick={onCollapse} />
      {/* sidebar-session.js:10732-10800 qM in the sidebar placement. */}
      <SourceNavButtons placement="sidebar" historyAt={historyAt} historyLength={historyLength} travel={travel} />
      {/* sidebar-groups.js:1815-1830 Ze {tooltipSide "bottom"} -> shared-7 SR:
          icon-only segments get Xa {content, side, hoverable:false}, no native
          title. The cmd+alt+left/right hint (xy) has no local shortcut. */}
      <div className="mode-switch" role="radiogroup" aria-label={t("Mode")}>
        {[["Claude", "chat", "Chat"], ["Code", "code", "Code"]].map(([label, value, icon]) => <SourceTooltip key={value} content={label} side="bottom" hoverable={false}>
          <button role="radio" aria-label={label} aria-checked={mode === value} onClick={() => onMode?.(value)}><Icon name={icon} /></button>
        </SourceTooltip>)}
      </div>
    </div>
    {/* sidebar-main.js:14903-14909: while collapsed, the bridge spans the gap between the 'Show sidebar'
        trigger and the floating body so the pointer can cross it (pointer events only while peeking). */}
    {collapsed && <div className="dframe-peek-bridge" aria-hidden="true" onPointerEnter={onPeekEnter} onPointerLeave={onPeekLeave} />}
    {/* sidebar-main.js:14918-14925: the body is the peek card while collapsed (id = the trigger's
        aria-controls); it is inert while the card is hidden. */}
    <div className="dframe-sidebar-body" data-testid="sidebar" id="frame-peek-popover" inert={collapsed && !peekOpen ? true : undefined}
      onPointerEnter={collapsed ? onPeekEnter : undefined} onPointerLeave={collapsed ? onPeekLeave : undefined}>
      <div className="source-sidebar-primary">
        {/* sidebar-groups.js:12741-12767 zP: New is selected (y = _ && !v) only
            on the new route for the mode (aP :12310), never while a session is
            open; aria-current follows it and aria-keyshortcuts is always
            Rl("cmd+n") = "Meta+n" (shared-frame vo keeps a one-letter key as
            typed after po lowercases it). */}
        {[["New", "Add", "new"], ["Artifacts", "Artifacts", "artifacts"], ["Routines", "Clock", "routines"], ["Customize", "Tool", "customize"]].map(([label, icon, key]) => {
          const selected = key === "new" ? section === "new" && !current : section === key;
          // shared-21 ND (:7590-7597) puts "group" on every plain row button, so the
          // New glyph's group-hover / group-data-[selected=focused] utilities resolve.
          return <button key={key} type="button" className="source-sidebar-nav-row group" data-selected={selected ? "focused" : undefined}
            aria-current={key === "new" && selected ? "page" : undefined} aria-keyshortcuts={key === "new" ? "Meta+n" : undefined}
            onClick={() => key === "new" ? onNew?.() : setSection?.(key)}>
            {/* sidebar-groups.js:12828-12842: only New's df-leading-slot holds mD
                (:7062-7073) - span.df-new-circle around Icon Add "sm" (16, shared-frame
                ra) in text-secondary, primary on row hover / selected. Size, fill and the
                13px/700 glyph come from the loaded shared-styles copy of
                desktop-layout.css:532-542, 884-886, 1917-1929 (web variant fill). */}
            {key === "new"
              ? <span className="source-leading-slot df-leading-slot"><span className="df-new-circle flex shrink-0 items-center justify-center rounded-full">
                <Icon name="Add" size={16} className="text-secondary group-hover:text-primary group-data-[selected=focused]:text-primary" /></span></span>
              : <span className="source-leading-slot"><Icon name={icon} size={16} /></span>}<span>{t(label)}</span>
            {key === "new" && <kbd aria-hidden="true">⌘ N</kbd>}
          </button>;
        })}
      </div>
      <div className="source-routines-label"><button onClick={() => setSection?.("routines")}>{t("Routines")} <Icon name="CaretRight" size={12} /></button></div>
      {showSearch && <div className="session-search-wrap">
        <Icon name="Search" size={14} /><input autoFocus aria-label={t("Search sessions")} placeholder={t("Search sessions")}
          value={search} onChange={(event) => setSearch?.(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Escape") { setShowSearch?.(false); setSearch?.(""); } }} />
        <ToolButton label={t("Close search")} icon="X" tooltip={{ hoverable: false }} onClick={() => { setShowSearch?.(false); setSearch?.(""); }} />
      </div>}
      {/* dframe-nav-scroll: the loaded shared-styles copy of desktop-layout.css:799-801
          masks the top 12px while data-scrolled is set. */}
      <nav ref={navRef} className="source-session-list df-session-list dframe-nav-scroll" aria-label={t("Sessions")} aria-busy={loading}
        data-scrolled={scrolled || undefined}
        onScroll={(event) => {
          const nav = event.currentTarget;
          if (nav.scrollLeft !== 0) nav.scrollLeft = 0;
          setScrolled(nav.scrollTop > 2);
        }}
        onContextMenu={(event) => {
          // sidebar-groups XT: whitespace menu (mounted for the code list) on
          // any right-click that is not on a row, heading control or field.
          if (!onSessionAction || !(event.target instanceof Element)) return;
          if (event.target.closest('[data-row], .source-group-heading, button, input, [role="menu"]')) return;
          event.preventDefault();
          setMenu({ kind: "whitespace", anchor: event.currentTarget, point: { x: event.clientX, y: event.clientY } });
        }}
        onKeyDown={(event) => {
          // sidebar-rows.js:7915-7962 eO. Left/Right move between a [data-row]'s
          // roving item and its [data-row-action]s (clamped; preventDefault only
          // when focus moves). Up/Down/Home/End resolve focus to its row's
          // roving item and do nothing outside a row (group toggles, header
          // buttons); an item missing from the visible list enters at 0 / last.
          // A closed menu trigger (row More) keeps ArrowUp/Down: the source
          // Menu.Trigger opens on them (openOnArrowKeyDown, vendor-frame-
          // BmPfNbgY.js:23791) and stops the event (useListNavigation reference
          // onKeyDown Zr = preventDefault + stopPropagation, :20378-20383,
          // :14774), so eO never sees it. menuTriggerProps only prevents default.
          if (event.defaultPrevented || event.target.tagName === "INPUT" || event.metaKey || event.ctrlKey || event.altKey) return;
          const active = document.activeElement, list = event.currentTarget;
          if (!active || !list.contains(active)) return;
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            const row = active.closest("[data-row]");
            if (!row) return;
            const stops = [...row.querySelectorAll("[data-roving-item], [data-row-action]")];
            if (stops.length < 2) return;
            const next = stops[Math.max(0, Math.min(stops.length - 1, stops.indexOf(active) + (event.key === "ArrowRight" ? 1 : -1)))];
            if (next !== active) { event.preventDefault(); next.focus(); }
            return;
          }
          if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
          const item = active.hasAttribute("data-roving-item") ? active : active.closest("[data-row]")?.querySelector("[data-roving-item]");
          if (!item) return;
          const rows = [...list.querySelectorAll("[data-roving-item]")].filter((row) => row.offsetParent !== null);
          if (rows.length === 0) return;
          const at = rows.indexOf(item);
          const next = event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1
            : at === -1 ? (event.key === "ArrowDown" ? 0 : rows.length - 1)
            : (at + (event.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length;
          event.preventDefault(); rows[next].focus(); rows[next].scrollIntoView({ block: "nearest" });
        }}>
        {/* Local notice (no source counterpart): remembered sessions loadSessions
            kept out of the list, i.e. the other core's or unreadable ones. */}
        {hiddenNotice && <p className="source-sidebar-no-match source-sidebar-hidden-notice" data-sidebar-notice="hidden-sessions">{hiddenNotice}</p>}
        {displayed.length === 0 && <div className="source-group-heading"><span>{preferences.status === "archived" ? t("Archived") : t("Sessions")}</span><div className="source-group-actions">{headerControls}</div></div>}
        {displayed.map((group, index) => <section key={group.key} className="source-session-group" data-group-key={group.key}>
          {/* sidebar-session.js:15909-16030 OB/kB/MB (project) and :16275-16432 XB (custom): the group
              label row is a ContextMenu trigger; the Other and Ungrouped buckets have none. */}
          <div className="source-group-heading" data-sidebar-group-label="" data-menu-open={menu?.kind === "group" && menu.group.key === group.key || undefined}
            onContextMenu={groupMenuKind(group) ? (event) => {
              if (event.target instanceof Element && event.target.closest("input")) return;
              event.preventDefault();
              setMenu({ kind: "group", group, anchor: event.currentTarget, point: { x: event.clientX, y: event.clientY } });
            } : undefined}>
            {/* sidebar-rows.js:7811-7870 $D: the group toggle has no title or tooltip; QD swaps in the
                'Rename group' field (jD classes + -my-1 -ml-1 min-w-0 flex-1 py-1 pl-1 group font). */}
            {renamingGroup && renamingGroup === group.customGroupId
              ? <InlineRenameInput initial={shownGroupLabel(group)} label="Rename group" maxLength={100} className="source-group-rename-input"
                onCommit={(name) => commitGroupRename(group, name)} onClose={(refocus) => closeGroupRename(group, refocus)} />
              : <button type="button" className="source-group-toggle"
                aria-expanded={!closed.has(group.key)} data-group-toggle="" onClick={() => toggleGroup(group.key)}>
                <span>{shownGroupLabel(group)}</span><Icon name="CaretRight" size={12} className="source-group-caret" />
              </button>}
            <div className="source-group-actions">
              {/* sidebar-groups.js:13871-13907 cI: project buckets have no target, so no tooltip.
                  :19866-19880: the Other bucket has no cwd, so no '+'. */}
              {group.cwd && onProject && <ToolButton label={t("New session in {name}", { name: group.label })} icon="Add" tooltip={false} onClick={() => onProject(group.cwd)} />}
              {/* sidebar-groups.js:17392-17410 / :18560-18590 / :19895-19905: a custom group's '+' (cI with the
                  Dz target: the folder its sessions share, else none) is labelled with the target and the group,
                  with the target tooltip and an 'Added to {group}' detail; in the code list it is the xs glyph in
                  the hover-reveal span (opacity 0 until the section has hover or focus within; touch shows it).
                  Its click is the header menu's Mz 'New session' (newSessionInGroup). */}
              {group.customGroupId && onGroupAction && (() => {
                const name = shownGroupLabel(group), folders = new Set(group.sessions.map((session) => session.cwd).filter(Boolean));
                const target = folders.size === 1 ? folderName([...folders][0]) : null;
                const content = target === null ? t("New session with no folder picked") : t("New session in {name}", { name: target });
                return <span className="source-group-reveal">
                  <ToolButton label={target === null ? t("New session with no folder picked, added to {group}", { group: name }) : t("New session in {name}, added to {group}", { name: target, group: name })}
                    tooltip={{ content, detail: t("Added to {group}", { group: name }), side: "right", hoverable: false }} onClick={() => newSessionInGroup(group)}>
                    <Icon name="Add" size={12} />
                  </ToolButton>
                </span>;
              })()}
              {/* sidebar-groups.js:18925-18933 Vz trigger: tooltip:false. */}
              {group === olderGroup && olderMenuAvailable && <ToolButton label={t("Bulk actions for older sessions")} icon="DotsVertical" tooltip={false}
                className="source-older-menu code-icon-button" active={menu?.kind === "older"}
                {...menuTriggerProps({ open: menu?.kind === "older", onOpen: (entry, event) => setMenu({ kind: "older", anchor: event.currentTarget, group, entry }) })}
                onClick={(event) => setMenu(menu?.kind === "older" ? null : { kind: "older", anchor: event.currentTarget, group })} />}
              {index === 0 && headerControls}
            </div>
          </div>
          {!closed.has(group.key) && <div className="source-group-rows" data-group-rows="">
            {renderGroupRows(group)}
            {/* sidebar-groups.js:17505-17516: an empty custom group invites a drop; xB elsewhere. */}
            {group.sessions.length === 0 && <p className="source-empty-group">{group.customGroupId ? t("Drag or move sessions here") : t("No active sessions")}</p>}
          </div>}
        </section>)}
        {loading && sourceSessions.length === 0 && <SourceSidebarSkeleton rows={3} />}
        {/* Local adaptation: the source searches in a palette, so a list search
            with no hits keeps its own line instead of the OO variants. */}
        {!loading && search && visibleCount === 0 && <div className="source-sidebar-no-match">{t("No matching sessions")}</div>}
        {!loading && !search && emptyVariant && <SourceSidebarEmpty variant={emptyVariant}
          onShowAllSessions={() => updatePreferences(showAllSessionsPreferences(preferences))} />}
        {preferences.groupBy === "custom" && onCreateGroup && <button className="source-create-group" onClick={() => setGroupDialog({ kind: "create" })}>
          <Icon name="Add" size={14} />{t("New group")}
        </button>}
        <div ref={laneSentinel} aria-hidden="true" className="source-session-list-lane-sentinel" />
      </nav>
      {/* sidebar-main.js:14970-14976 df-bottom-tray > hL (:14187-14202)
          df-footer-row: LC = pw (sidebar-groups.js:5225-5310, hideSuffix false) in
          min-w-0 flex-1, then df-footer-aux. */}
      <div className="df-bottom-tray shrink-0">
        <div className="df-footer-row account-footer shrink-0 flex items-center gap-[var(--df-footer-gap)]">
          <div className="min-w-0 flex-1">
            <button type="button" data-testid="user-menu-button" aria-label={t("Account menu")}
              className="df-user-menu-btn account-button cds-reset flex h-[max(28px,var(--df-footer-btn-size))] max-w-full items-center gap-[var(--df-row-gap)] rounded-[var(--df-radius-pill)] pl-[var(--df-row-px)] pr-2 text-left outline-none hover:bg-[var(--df-hover)] focus-visible:shadow-focus"
              {...menuTriggerProps({ open: accountMenuOpen, onOpen: (entry, event) => onAccount?.(event, entry) })} onClick={(event) => onAccount?.(event)}>
              {/* Tn = shared-21 _B (:15687-15692): whatever the account, a static
                  Spark (shared-frame dv -> bd) at 16 for "sm" (compact density), shrink-0. */}
              <span className="df-on-rail relative flex w-[var(--df-leading-slot)] shrink-0 items-center justify-center"><SourceSpark size={16} className="shrink-0" /></span>
              <span className="flex min-w-0 gap-1 overflow-hidden text-[length:var(--df-row-font)] df-footer-suffix items-baseline">
                <span className="whitespace-nowrap text-secondary max-w-full shrink-0 truncate">{accountName}</span>
                {accountLabel && <>
                  <span aria-hidden="true" className="df-footer-suffix-text text-muted">·</span>
                  <span className="df-footer-suffix-text min-w-0 whitespace-nowrap text-muted">{accountLabel}</span>
                </>}
              </span>
              {accountName !== "" && <Icon name="CaretDown" size={12} className="shrink-0 text-muted" />}
            </button>
          </div>
          {/* Local control (source aux holds vL/yL/gL): CDS tooltip, no native title. */}
          <div className="df-footer-aux ml-auto flex shrink-0 items-center">
            {/* Opens main.jsx 'connection' (SourceMenu Header + Items, side top / align start); closed tooltip while open. */}
            <ToolButton label={t("Connection settings")} icon="Ant" tooltip={{ hoverable: false, open: connectionMenuOpen ? false : undefined }}
              {...menuTriggerProps({ open: connectionMenuOpen, onOpen: (entry, event) => onMenu?.("connection", event.currentTarget, undefined, entry) })}
              onClick={(event) => onMenu?.("connection", event.currentTarget)} />
          </div>
        </div>
      </div>
    </div>
    {setSidebarWidth && <SidebarResizeHandle width={sidebarWidth} minWidth={sidebarFloor} onCommit={setSidebarWidth} onCollapse={onCollapse} onCollapsedChange={onCollapsedChange} />}
    {menu && <SourceSidebarMenu key={menu.token} anchor={menu.anchor} point={menu.point} kind={menu.kind} initialHighlight={menu.entry}
      label={t(menu.kind === "filter" ? "Filter sessions" : menu.kind === "group" ? "Group options" :menu.kind === "older" ? "Older sessions" : menu.kind === "whitespace" ? "Sessions list options" : "Session options")}
      onClose={() => setMenu(null)}>
      {menu.kind === "filter" && <SourceSidebarFilterMenu preferences={preferences} onChange={updatePreferences} onClose={() => setMenu(null)} knownFolders={folders} customGroups={customGroups} />}
      {menu.kind === "session" && <SourceSidebarSessionMenu session={menu.session} metadata={sessionMetadata[menu.session.id]} customGroups={customGroups}
        state={state} onAction={runAction} onClose={() => setMenu(null)} onRename={() => setRenaming(menu.session.id)}
        onCreateGroup={onCreateGroup ? (targets) => setGroupDialog({ kind: "create", sessions: targets }) : undefined}
        onDelete={(target) => requestDelete([target])} onFork={(target) => runAction("fork", target)} forkUnavailable={forkUnavailable}
        pinnedSiblings={pinnedIds}
        nested={(() => {
          const count = [...runsByGroup.values()].flatMap((entry) => entry.runs).find((run) => run.parentId === menu.session.id)?.rows.length || 0;
          return count ? { childCount: count, collapsed: collapsedNested.has(menu.session.id), onToggle: () => toggleNested(menu.session.id) } : null;
        })()}
        multi={menu.multi ? { count: selectedSessions.length, sessions: selectedSessions, onBulk: (action, targets, payload) => action === "delete" ? requestDelete(targets) : runBulk(action, targets, payload) } : undefined} />}
      {menu.kind === "group" && (() => {
        const group = menu.group, custom = groupMenuKind(group) === "custom";
        const keys = sectionKeysOf(custom), own = custom ? customOrderKey(group.customGroupId) : group.projectKey, at = keys.indexOf(own);
        // jB (sidebar-session.js:15959-15982): Move up / Move down where the section can move, then
        // 'Sort A to Z' (the order reset; locally an A to Z order of these sections).
        const orderItems = <>
          {at > 0 && <Choice onClick={() => saveSectionOrder(moveSection(keys, own, "up"))}>Move up</Choice>}
          {at !== -1 && at < keys.length - 1 && <Choice onClick={() => saveSectionOrder(moveSection(keys, own, "down"))}>Move down</Choice>}
          <Choice onClick={() => saveSectionOrder(sortSectionsAlphabetically(displayed.filter((entry) => custom ? !!entry.customGroupId : entry.kind === "project")))}>Sort A to Z</Choice>
        </>;
        // MB (sidebar-session.js:15983-16030): New session + separator, then the order items.
        if (!custom) return <>
          {group.cwd && onProject && <><Choice onClick={() => onProject(group.cwd)}>{t("New session")}</Choice><Divider /></>}
          {orderItems}
        </>;
        // XB (:16378-16408): New session, separator, Rename group, New group…, AB (separator + order
        // items), separator, Delete group (danger). No local icon picker, so no 'Change icon…'.
        return <>
          <Choice onClick={() => newSessionInGroup(group)}>{t("New session")}</Choice>
          <Divider />
          <Choice onClick={() => startGroupRename(group)}>Rename group</Choice>
          {onCreateGroup && <Choice onClick={() => setGroupDialog({ kind: "create" })}>{t("New group…")}</Choice>}
          <Divider />
          {orderItems}
          <Divider />
          <Choice variant="danger" onClick={() => requestGroupDelete(group)}>Delete group</Choice>
        </>;
      })()}
      {menu.kind === "whitespace" && (() => {
        const archivable = bulkTargets(selectedSessions, { metadata: sessionMetadata, currentId: current, state, action: "archive" });
        const deletable = bulkTargets(selectedSessions, { metadata: sessionMetadata, currentId: current, state, action: "delete" });
        return <>
          <Choice onClick={() => setSelectionState((previous) => replaceSelection(previous, visibleOrderRef.current, SELECTION_DOMAIN))}>{t("Select all")}</Choice>
          {preferences.groupBy === "custom" && onCreateGroup && <Choice onClick={() => setGroupDialog({ kind: "create" })}>{t("New group…")}</Choice>}
          {(archivable.length > 0 || deletable.length > 0) && <>
            <Divider />
            {archivable.length > 0 && <Choice onClick={() => runBulk("archive", archivable)}>{t("Archive selected ({count})", { count: archivable.length })}</Choice>}
            {deletable.length > 0 && <Choice variant="danger" onClick={() => requestDelete(deletable)}>{t("Delete selected ({count})", { count: deletable.length })}</Choice>}
          </>}
        </>;
      })()}
      {menu.kind === "older" && (() => {
        const archivable = olderTargets(menu.group, "archive"), deletable = olderTargets(menu.group, "delete");
        return <>
          {archivable.length > 0 && <Choice onClick={() => setConfirm({ ...olderConfirmCopy("archive", archivable.length), onConfirm: () => runBulk("archive", archivable, undefined, { older: true }) })}>{t("Archive all ({count})", { count: archivable.length })}</Choice>}
          {deletable.length > 0 && <Choice variant="danger" onClick={() => setConfirm({ ...olderConfirmCopy("delete", deletable.length, { engine }), onConfirm: () => runBulk("delete", deletable, undefined, { older: true }) })}>{t("Delete all ({count})", { count: deletable.length })}</Choice>}
        </>;
      })()}
    </SourceSidebarMenu>}
    {shownGroupDialog.value && <GroupNameDialog key={`group-${shownGroupDialog.key}`} open={shownGroupDialog.open} onExited={shownGroupDialog.onExited}
      switchesToCustom={preferences.groupBy !== "custom"} onClose={() => setGroupDialog(null)} onSubmit={async (name) => {
        const dialog = shownGroupDialog.value;
        await onCreateGroup(name, dialog.sessions?.[0]?.id, dialog.sessions?.map((session) => session.id));
        if (dialog.sessions?.length > 1) setSelectionState(clearSelection);
      }} />}
    {shownConfirm.value && <SourceConfirmDialog key={`confirm-${shownConfirm.key}`} open={shownConfirm.open} onExited={shownConfirm.onExited}
      title={shownConfirm.value.title} body={shownConfirm.value.body} confirmLabel={shownConfirm.value.confirmLabel} danger={shownConfirm.value.danger}
      onConfirm={shownConfirm.value.onConfirm} onClose={() => setConfirm(null)} />}
  </aside>;
}

export { SourceSidebar as Sidebar, RenameRow as SourceSidebarRenameRow };
