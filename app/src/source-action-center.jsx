import React, { useEffect, useState } from "react";
import { Icon } from "./icons";
import { SourceTooltip } from "./source-tooltip.jsx";
import { ATTENTION_KINDS, PLACEHOLDER_WIDTHS, narrowRelativeTime, sessionsLimit } from "./home-model.mjs";
import "./source-action-center.css";

// 2.2553.1 Action Center (cc43287c9 Zk/Qk/tA/Ak/Dk/Ok/Mk/Nk). Only the Sessions
// section has a local data source; Projects and Pull requests are omitted, which
// matches the official null-for-empty rendering. Hover preview cards, prompt
// suggestion chips and the Working/Ready-for-review kinds have no local data.

/** tA meta (cc43287c9 :5416-5417, :5473): `owner/name` for a repo with a remote, its name for a local
 *  repo, nothing outside a repo or while the identity (main.cjs 'repo-identities') is unknown. */
export const repoMeta = (identity) => (identity?.owner ? `${identity.owner}/${identity.name}` : identity?.isRepo ? identity.name || undefined : undefined);

/** Vk: media-query row limit, capped at five for the Sessions section. */
export function useSessionsLimit() {
  const [height, setHeight] = useState(() => (typeof window === "undefined" ? 0 : window.innerHeight));
  useEffect(() => {
    const update = () => setHeight(window.innerHeight);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return sessionsLimit(height);
}

function Pill({ kind }) {
  const label = ATTENTION_KINDS[kind]?.label;
  return (
    <span className="hac-pill">
      <span className="hac-dot-slot"><span className="hac-dot" data-kind={kind} /></span>
      {label !== undefined && <span className="hac-pill-text"><span className="hac-pill-label" data-kind={kind}>{label}</span></span>}
    </span>
  );
}

/** Ak: pill, title, optional subtitle/meta, narrow relative time, caret. */
function RowButton({ kind, title, subtitle, meta, time, now, ...props }) {
  return (
    <button type="button" data-row-main-button="" className="hac-main" {...props}>
      <span className="hac-main-lead">
        <Pill kind={kind} />
        <span className="hac-titles">
          <span className="hac-title">{title}</span>
          {subtitle ? <span className="hac-subtitle">{subtitle}</span> : null}
        </span>
      </span>
      <span className="hac-main-trail">
        {meta ? <span className="hac-meta">{meta}</span> : null}
        <span className="hac-time">
          {time ? <time dateTime={new Date(time).toISOString()}>{narrowRelativeTime(time, now)}</time> : null}
        </span>
        <Icon name="CaretRight" size={16} className="hac-caret" />
      </span>
    </button>
  );
}

function SessionRow({ row, menuOpen, now, identity, onOpen, onDismiss, onContextMenu }) {
  const { session, kind } = row;
  const name = session.name || session.preview || "";
  const title = name || "Untitled session";
  return (
    <li className="hac-row" data-menu-open={menuOpen || undefined} data-attention-kind={kind} data-session-id={session.id}
      onContextMenu={onContextMenu ? (event) => {
        event.preventDefault();
        onContextMenu(session, event.currentTarget.querySelector("[data-row-main-button]"), { x: event.clientX, y: event.clientY });
      } : undefined}>
      <div className="hac-row-body">
        <RowButton kind={kind} title={title} meta={repoMeta(identity)} time={row.timestamp} now={now}
          aria-label={`Open session ${name}`} onClick={() => onOpen(session, kind)} />
      </div>
      {onDismiss && (
        <SourceTooltip content="Dismiss" hoverable={false}>
          <button type="button" className="hac-dismiss" data-row-dismiss="" aria-label="Dismiss session"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.stopPropagation(); onDismiss(session, kind); }}>
            <Icon name="X" size={16} />
          </button>
        </SourceTooltip>
      )}
    </li>
  );
}

/** Qk: null when empty; header with Mark all as read and Show more/less. */
function SessionsSection({ rows, limit, menuOpenId, now, repoIdentities, onOpen, onDismiss, onMarkAllRead, onContextMenu }) {
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) return null;
  const visible = expanded ? rows : rows.slice(0, limit);
  const hidden = rows.length - visible.length;
  const clearable = rows.some((row) => row.kind === "unread");
  return (
    <section className="hac-section" data-action-center-section="sessions">
      <header className="hac-header">
        <h2 className="hac-heading">Sessions</h2>
        <span className="sh-spacer" />
        {clearable && onMarkAllRead && (
          <button type="button" className="hac-ghost" onClick={() => onMarkAllRead(rows.filter((row) => row.kind === "unread").map((row) => row.session))}>
            Mark all as read
          </button>
        )}
        {rows.length > limit && (
          <button type="button" className="hac-ghost" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
            {expanded ? "Show less" : `Show ${hidden} more`}
          </button>
        )}
      </header>
      <ul role="list" className="hac-list">
        {visible.map((row) => (
          <SessionRow key={row.session.id} row={row} menuOpen={menuOpenId === row.session.id} now={now} identity={repoIdentities?.[row.session.cwd]}
            onOpen={onOpen} onDismiss={onDismiss} onContextMenu={onContextMenu} />
        ))}
      </ul>
    </section>
  );
}

/** Zk body when attention rows exist: pt-24 pb-56 column with 40px section gaps. */
export function SourceActionCenter({ rows, limit, menuOpenId, now = Date.now(), repoIdentities, onOpen, onDismiss, onMarkAllRead, onContextMenu }) {
  return (
    <div className="source-action-center">
      <SessionsSection rows={rows} limit={limit} menuOpenId={menuOpenId} now={now} repoIdentities={repoIdentities}
        onOpen={onOpen} onDismiss={onDismiss} onMarkAllRead={onMarkAllRead} onContextMenu={onContextMenu} />
    </div>
  );
}

/** Mk/Nk: aria-hidden skeleton rows mirroring the remembered count; hidden at zero. */
function PlaceholderSection({ title, count, limit, dismissSlot }) {
  if (!count) return null;
  return (
    <section className="hac-section" data-action-center-section="placeholder">
      <header className="hac-header">
        <h2 className="hac-heading">{title}</h2>
        {count > limit && <button type="button" className="hac-ghost is-invisible" tabIndex={-1} aria-hidden="true">Show {count - limit} more</button>}
      </header>
      <ul role="list" aria-hidden="true" className="hac-list">
        {Array.from({ length: Math.min(count, limit) }, (_, index) => (
          <li key={index} className="hac-row is-placeholder">
            <Pill kind="placeholder" />
            <span className="hac-skeleton-slot"><span data-cds="Skeleton" className="sh-skeleton hac-skeleton-bar" style={{ width: PLACEHOLDER_WIDTHS[index % PLACEHOLDER_WIDTHS.length] }} /></span>
            <Icon name="CaretRight" size={16} className="hac-caret is-invisible" />
            {dismissSlot && <span className="hac-dismiss-slot" />}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SourceActionCenterPlaceholder({ counts, limit }) {
  return (
    <div className="source-action-center" aria-busy="true">
      <span className="hac-sr-only" data-skeleton-label="">Loading…</span>
      <PlaceholderSection title="Sessions" count={counts?.sessions || 0} limit={limit} dismissSlot />
    </div>
  );
}
