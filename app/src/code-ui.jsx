import React, { useState } from "react";
import { Icon } from "./icons";
import { SourceTooltip } from "./source-tooltip";
import { t } from "../electron/i18n/index.mjs";
// sidebar-groups.js hw (5320) / Nb (2685): Kl tooltip content + cmd+b, not hoverable.
export const SIDEBAR_TOGGLE_TOOLTIP = {
  hide: { content: t("Hide sidebar"), shortcut: "cmd+b", hoverable: false },
  show: { content: t("Show sidebar"), shortcut: "cmd+b", hoverable: false },
};
export const basename = (p) =>
  p?.split("/").filter(Boolean).pop() || "Select folder";
export function ToolButton({
  label,
  icon,
  onClick,
  disabled,
  active,
  children,
  tooltip,
  ...props
}) {
  // Existing callers retain their native title. Only an explicit tooltip opts
  // into CDS behavior; false suppresses both forms for an external wrapper.
  // String copy is looked up here too, so literal labels are localized.
  label = t(label);
  const customTooltip = tooltip != null && tooltip !== false;
  const tooltipProps = tooltip && typeof tooltip === "object" ? tooltip : {};
  const button = (
    <button
      type="button"
      className={"code-icon-button" + (active ? " is-selected" : "")}
      title={customTooltip || tooltip === false ? undefined : label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children || <Icon name={icon} />}
    </button>
  );
  return customTooltip ? (
    <SourceTooltip
      hoverable={false}
      automatic
      {...tooltipProps}
      content={
        typeof tooltip === "string"
          ? t(tooltip)
          : Object.hasOwn(tooltipProps, "content")
            ? t(tooltipProps.content)
            : label
      }
    >
      {button}
    </SourceTooltip>
  ) : (
    button
  );
}
export function Sidebar({
  collapsed,
  onCollapse,
  historyAt,
  historyLength,
  travel,
  mode,
  onMode,
  onNew,
  groups,
  current,
  state,
  onOpen,
  onProject,
  onMenu,
  onAccount,
  displayName,
  accountLabel,
  search,
  setSearch,
  showSearch,
  setShowSearch,
  onFolder,
  sidebarWidth,
  setSidebarWidth,
  section,
  setSection,
  filter,
}) {
  const [closed, setClosed] = useState(new Set());
  const beginResize = (e) => {
    e.preventDefault();
    const x = e.clientX,
      w = sidebarWidth;
    const move = (e) =>
      setSidebarWidth(Math.max(224, Math.min(420, w + e.clientX - x)));
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };
  return (
    <aside
      className="app-sidebar dframe-sidebar"
      aria-label="Sidebar"
      data-variant="web"
      data-density="compact"
    >
      <div className="sidebar-toolbar df-titlebar window-drag">
        <div className="traffic-space" />
        <ToolButton
          label={collapsed ? "Show sidebar" : "Hide sidebar"}
          tooltip={SIDEBAR_TOGGLE_TOOLTIP[collapsed ? "show" : "hide"]}
          icon="Sidebar"
          onClick={onCollapse}
        />
        <ToolButton
          label="Back"
          icon="ArrowLeft"
          disabled={historyAt === 0}
          onClick={() => travel(-1)}
        />
        <ToolButton
          label="Forward"
          icon="ArrowRight"
          disabled={historyAt >= historyLength - 1}
          onClick={() => travel(1)}
        />
        <div className="mode-switch" role="radiogroup" aria-label="Mode">
          <button
            role="radio"
            aria-label="Claude"
            aria-checked={mode === "chat"}
            title="Claude"
            onClick={() => onMode("chat")}
          >
            <Icon name="Chat" />
          </button>
          <button
            role="radio"
            aria-label="Code"
            aria-checked={mode === "code"}
            title="Code"
            onClick={() => onMode("code")}
          >
            <Icon name="Code" />
          </button>
        </div>
      </div>
      <div className="dframe-sidebar-body">
        <div className="sidebar-primary">
          {[
            ["New", "Add", "new"],
            ["Artifacts", "Artifacts", "artifacts"],
            ["Routines", "Clock", "routines"],
            ["Customize", "Workspace", "customize"],
          ].map(([label, icon, key]) => (
            <button
              key={key}
              className={
                "sidebar-nav-row " + (section === key ? "selected" : "")
              }
              onClick={() => (key === "new" ? onNew() : setSection(key))}
            >
              <Icon name={icon} />
              <span>{label}</span>
              {key === "new" && <kbd>⌘ N</kbd>}
            </button>
          ))}
        </div>
        <div className="sidebar-routines">
          <button onClick={() => setSection("routines")}>
            Routines <Icon name="CaretRight" size={12} />
          </button>
        </div>
        {showSearch && (
          <div className="session-search-wrap">
            <Icon name="Search" size={14} />
            <input
              autoFocus
              aria-label="Search sessions"
              placeholder="Search sessions"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <ToolButton
              label="Close search"
              icon="X"
              onClick={() => {
                setShowSearch(false);
                setSearch("");
              }}
            />
          </div>
        )}
        <nav className="session-list df-session-list">
          {groups.map(([dir, threads], index) => (
            <section key={dir}>
              <div className="project-heading">
                <button
                  title={dir}
                  onClick={() =>
                    setClosed((c) => {
                      const n = new Set(c);
                      n.has(dir) ? n.delete(dir) : n.add(dir);
                      return n;
                    })
                  }
                >
                  {basename(dir)}
                  {closed.has(dir) && <Icon name="CaretRight" size={12} />}
                </button>
                <ToolButton
                  label={"New session in " + basename(dir)}
                  icon="Add"
                  onClick={() => onProject(dir)}
                />
                {index === 0 && (
                  <>
                    <ToolButton
                      label="Search sessions"
                      icon="Search"
                      onClick={() => setShowSearch((s) => !s)}
                    />
                    <ToolButton
                      label="Filter"
                      icon="Toggles"
                      onClick={(e) => onMenu("filter", e.currentTarget)}
                    />
                  </>
                )}
              </div>
              {!closed.has(dir) &&
                threads
                  .filter(
                    (s) =>
                      filter === "all" ||
                      (filter === "running"
                        ? state.active[s.id]
                        : state.approvals.some(
                            (a) => a.params?.threadId === s.id,
                          )),
                  )
                  .map((s) => (
                    <div
                      className={
                        "session-row " + (current === s.id ? "active" : "")
                      }
                      key={s.id}
                    >
                      <button
                        className="session-open"
                        title={s.name || s.preview || "New session"}
                        onClick={() => onOpen(s.id)}
                      >
                        <span
                          className={
                            "session-dot " +
                            (state.active[s.id] ? "pulsing" : "")
                          }
                        />
                        <span>{s.name || s.preview || "New session"}</span>
                        {state.approvals.some(
                          (a) => a.params?.threadId === s.id,
                        ) && <Icon name="Trust" size={12} />}
                      </button>
                      <ToolButton
                        label={"More options for " + (s.name || "session")}
                        icon="DotsHorizontal"
                        className="session-more code-icon-button"
                        onClick={(e) => onMenu("session", e.currentTarget, s)}
                      />
                    </div>
                  ))}
            </section>
          ))}
          {groups.length === 0 && (
            <div className="sidebar-empty">
              <button onClick={onFolder}>
                <Icon name="Folder" size={14} />
                Open a folder
              </button>
              <span>Start a session to see it here.</span>
            </div>
          )}
        </nav>
        <div className="account-footer">
          <button
            className="account-button"
            aria-label="Account menu"
            onClick={onAccount}
          >
            <span className="avatar">
              {displayName
                .split(/[\s_-]+/)
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>
            <span className="account-name">
              {displayName.split(" ")[0]}
              <small> · {accountLabel}</small>
            </span>
            <Icon name="CaretDown" size={12} />
          </button>
          <ToolButton
            label="Connection settings"
            icon="Ant"
            onClick={(e) => onMenu("connection", e.currentTarget)}
          />
        </div>
      </div>
      <div
        className="sidebar-resizer"
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        tabIndex={0}
        aria-valuemin={224}
        aria-valuemax={420}
        aria-valuenow={sidebarWidth}
        onPointerDown={beginResize}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft")
            setSidebarWidth(Math.max(224, sidebarWidth - 8));
          if (e.key === "ArrowRight")
            setSidebarWidth(Math.min(420, sidebarWidth + 8));
        }}
      />
    </aside>
  );
}
export function Composer({
  draft,
  setDraft,
  textarea,
  attachments,
  setAttachments,
  onSubmit,
  running,
  sending,
  connected,
  onStop,
  workdir,
  workspaceInfo,
  onMenu,
  model,
  effort,
  permission,
  worktree,
  setWorktree,
  usage,
  mode,
  onFolder,
}) {
  return (
    <div className="composer-zone" data-epitaxy-chat-column>
      <div className="context-row">
        <button
          className="context-chip"
          aria-haspopup="dialog"
          onClick={(e) => onMenu("local", e.currentTarget)}
        >
          <Icon name="Laptop" size={14} />
          Local
        </button>
        <button
          className="context-chip folder-chip"
          title={workdir}
          onClick={(e) => onMenu("folder", e.currentTarget)}
        >
          <Icon name="Folder" size={14} />
          <span>{basename(workdir)}</span>
        </button>
        {workspaceInfo?.isRepo && (
          <div className="branch-worktree">
            <button
              className="branch-chip"
              role="combobox"
              aria-label="Branch"
              onClick={(e) => onMenu("branch", e.currentTarget)}
            >
              <Icon name="GitBranch" size={14} />
              <span>{workspaceInfo.branch || "HEAD"}</span>
            </button>
            <label title="Work in an isolated copy of the repository">
              <input
                type="checkbox"
                checked={worktree}
                disabled={running || sending}
                onChange={(e) => setWorktree(e.target.checked)}
              />
              worktree
            </label>
          </div>
        )}
        <ToolButton
          label="Add another folder"
          icon="FolderPlus"
          onClick={onFolder}
        />
      </div>
      <form
        onSubmit={onSubmit}
        className="composer epitaxy-prompt"
        data-cds-shell="true"
      >
        <div data-surface>
          <div className="composer-input-row">
            <textarea
              ref={textarea}
              aria-label="Message DeepSeek"
              rows={1}
              placeholder={
                mode === "code"
                  ? "Describe a task or ask a question"
                  : "How can I help you today?"
              }
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
            />
            {running ? (
              <ToolButton
                label="Stop response"
                onClick={onStop}
                icon="StopFilled"
              />
            ) : (
              <button
                className="send-button"
                type="submit"
                aria-label="Send message"
                disabled={!draft.trim() || sending || !connected}
              >
                {sending ? (
                  <span className="spinner" />
                ) : (
                  <Icon name="ArrowReturn" size={16} />
                )}
              </button>
            )}
          </div>
          {attachments.length > 0 && (
            <div className="attachments">
              {attachments.map((p) => (
                <span key={p}>
                  <Icon name="Attachment" size={12} />
                  {basename(p)}
                  <button
                    aria-label={"Remove " + basename(p)}
                    type="button"
                    onClick={() =>
                      setAttachments((a) => a.filter((x) => x !== p))
                    }
                  >
                    <Icon name="X" size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </form>
      <div className="composer-footer">
        <ToolButton
          label="Add"
          icon="Add"
          onClick={(e) => onMenu("add", e.currentTarget)}
        />
        <div className="dictation-controls">
          <ToolButton
            label="Dictation"
            icon="Microphone"
            onClick={(e) => onMenu("dictation", e.currentTarget)}
          />
          <button
            aria-label="Dictation settings"
            onClick={(e) => onMenu("dictation", e.currentTarget)}
          >
            <Icon name="CaretDown" size={12} />
          </button>
        </div>
        <button
          className="permission-button"
          aria-label="Permission mode"
          onClick={(e) => onMenu("permission", e.currentTarget)}
        >
          {permission === "auto"
            ? "Auto"
            : permission === "plan"
              ? "Plan"
              : "Ask"}
        </button>
        <div className="model-controls">
          <button
            className="model-trigger"
            role="combobox"
            aria-label="Model"
            aria-haspopup="listbox"
            disabled={running || sending}
            onClick={(e) => onMenu("model", e.currentTarget)}
          >
            {model?.displayName || model?.model || "Default model"}
          </button>
          <button
            className="effort-trigger"
            role="combobox"
            aria-label="Reasoning effort"
            aria-haspopup="listbox"
            disabled={running || sending}
            onClick={(e) => onMenu("effort", e.currentTarget)}
          >
            <EffortIcon value={effort} />
            {effort[0]?.toUpperCase() + effort.slice(1)}
          </button>
          <button
            className="usage-trigger"
            aria-label="Usage"
            title="Context usage"
            onClick={(e) => onMenu("usage", e.currentTarget)}
          >
            <Icon name="UsageGaugeMiddle" size={15} />
          </button>
          <button
            className="fast-trigger"
            aria-label="Fast mode off"
            title="Fast mode off"
            onClick={(e) => onMenu("fast", e.currentTarget)}
          >
            <Icon name="Lightning" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
function EffortIcon({ value }) {
  // DeepSeek Harness efforts are off/low/high/max.
  const levels = {
    off: 0,
    none: 0,
    minimal: 1,
    low: 1,
    medium: 2,
    high: 3,
    xhigh: 4,
    max: 4,
    ultra: 4,
  };
  return (
    <span className="effort-bars" aria-hidden="true">
      {[1, 2, 3, 4].map((n) => (
        <i key={n} className={n <= (levels[value] ?? 2) ? "filled" : ""} />
      ))}
    </span>
  );
}
