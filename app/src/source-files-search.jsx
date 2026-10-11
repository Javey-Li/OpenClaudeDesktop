import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { fileKindIcon } from "./file-kind-icon.mjs";
import { createFileSearchController, emptySearchState, isPlainSearchKey,
  pathSegments, rangePaths, resultNavigation, searchLimitMessage } from "./files-search-model.mjs";
import "./source-files-search.css";
import { t } from "../electron/i18n/index.mjs";

const desktopCall = (action, params) => window.desktop?.call(action, params) ??
  Promise.reject(new Error(t("Open OpenClaude Desktop to search local filenames.")));

function LitPath({ text, positions, offset = 0 }) {
  return pathSegments(text, positions, offset).map((segment, index) => segment.lit
    ? <span data-lit="" key={index}>{segment.text}</span> : segment.text);
}

function SearchingFiles() {
  const [announce, setAnnounce] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setAnnounce(true), 100);
    return () => clearTimeout(timer);
  }, []);
  return <span role="status" className="sfs-loading-status">
    <span data-cds="Spinner" className="sfs-spinner" aria-hidden="true"><span /><span /></span>
    {announce && <span className="sfs-sr-only">{t("Searching files")}</span>}
  </span>;
}

/** Source adapter inside .source-files-tree, replacing its folder/Refresh
 * header. Existing tree/notices stay mounted as children while filtered.
 * onOpen is the FilePane.openFile authority for previews.
 * Main derives cwd+scope from sessionId, or validates the home folder selection
 * against its own saved/approved workspace roots.
 */
export function SourceFilesSearch({ sessionId = null, searchPane = "main", cwd, activePath, onOpen, onClear,
  children, enabled = true, refreshKey = 0, call = desktopCall }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState(emptySearchState);
  const [selected, setSelected] = useState(() => new Set());
  const ids = useId();
  const input = useRef(null), results = useRef(null), keptTree = useRef(null);
  const controller = useRef(null), anchor = useRef(0), focused = useRef({ index: 0, path: null });
  const focusInResults = useRef(false), callbacks = useRef(null), currentQuery = useRef(query);
  const enabledNow = useRef(enabled), lastRefresh = useRef(refreshKey);
  callbacks.current = { call, onOpen, onClear };
  currentQuery.current = query;
  enabledNow.current = enabled;
  const hasQuery = query.trim().length > 0;
  const busy = state.phase === "debouncing" || state.phase === "loading";
  const stale = hasQuery && state.matchedQuery !== query.trim();
  const resultId = `${ids}-results`, treeId = `${ids}-tree`, hintId = `${ids}-hint`, limitId = `${ids}-limit`;

  useLayoutEffect(() => {
    const resource = createFileSearchController({ sessionId, pane: searchPane, workspaceRoot: cwd,
      search: request => callbacks.current.call("files:search", request),
      cancel: request => callbacks.current.call("files:search:cancel", request),
      onState: setState,
      onActivate: entry => callbacks.current.onOpen(entry),
      enabled: enabledNow.current && Boolean(cwd),
    });
    controller.current = resource;
    resource.setQuery(currentQuery.current);
    return () => { resource.dispose(); if (controller.current === resource) controller.current = null; };
  }, [sessionId, searchPane, cwd]);

  useLayoutEffect(() => {
    controller.current?.setEnabled(enabled && Boolean(cwd));
    if (!enabled) focusInResults.current = false;
  }, [enabled, sessionId, searchPane, cwd]);

  useLayoutEffect(() => {
    if (lastRefresh.current !== refreshKey) {
      lastRefresh.current = refreshKey;
      controller.current?.refresh();
    }
  }, [refreshKey]);

  useLayoutEffect(() => {
    setSelected(previous => new Set([...previous].filter(path => state.matches.some(match => match.path === path))));
    if (!enabled || !hasQuery || !focusInResults.current) return;
    const document = results.current?.ownerDocument;
    if (!document || (document.activeElement !== document.body && !results.current.contains(document.activeElement))) return;
    const old = focused.current;
    const pathIndex = state.matches.findIndex(match => match.path === old.path);
    focusResult(pathIndex >= 0 ? pathIndex : Math.min(old.index, state.matches.length - 1));
  }, [state.matches, enabled, hasQuery]);

  function focusResult(index) {
    if (index < 0) { input.current?.focus(); return; }
    const row = results.current?.querySelectorAll("[data-tree-row]")[index];
    row?.focus();
    row?.scrollIntoView({ block: "nearest" });
  }
  function change(value) {
    const wasQuery = currentQuery.current.trim().length > 0;
    currentQuery.current = value;
    setQuery(value);
    controller.current?.setQuery(value);
    if (wasQuery && !value.trim()) callbacks.current.onClear?.(activePath);
  }
  function clear() {
    change("");
    input.current?.focus();
  }
  function selectAt(index, event) {
    const entry = state.matches[index];
    if (!entry) return;
    if (event.shiftKey) setSelected(new Set(rangePaths(state.matches, anchor.current, index)));
    else if (event.metaKey || event.ctrlKey) setSelected(previous => {
      const next = new Set(previous);
      next.has(entry.path) ? next.delete(entry.path) : next.add(entry.path);
      return next;
    });
    else { anchor.current = index; setSelected(new Set([entry.path])); }
  }
  function activate(index, event, keep = false) {
    const entry = state.matches[index];
    if (!entry) return;
    controller.current?.cancelEnter();
    selectAt(index, event);
    if (!(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey))
      callbacks.current.onOpen(entry, { preview: !keep });
  }
  function resultKey(event) {
    if (event.nativeEvent.isComposing || event.keyCode === 229 || event.altKey) return;
    const row = event.target.closest("[data-tree-row]");
    const index = row ? Number(row.dataset.rowIndex) : -1;
    const destination = resultNavigation(event.key, index, state.matches.length, isPlainSearchKey(event));
    if (destination !== null) {
      event.preventDefault();
      controller.current?.cancelEnter();
      if (destination === "input") input.current?.focus();
      else {
        focusResult(destination);
        if (event.shiftKey) setSelected(new Set(rangePaths(state.matches, anchor.current, destination)));
        else if (!event.metaKey && !event.ctrlKey) anchor.current = destination;
      }
    } else if ((event.key === "a" || event.key === "A") && (event.metaKey || event.ctrlKey) && !event.shiftKey) {
      event.preventDefault();
      setSelected(new Set(state.matches.map(entry => entry.path)));
    } else if ((event.key === "Enter" || event.key === " ") && index >= 0) {
      event.preventDefault();
      if (event.key === " " && (event.shiftKey || event.metaKey || event.ctrlKey)) selectAt(index, event);
      else activate(index, {});
    } else if (event.key === "Tab" && event.shiftKey && index >= 0 && !event.ctrlKey && !event.metaKey) {
      // Let the browser's subsequent Shift+Tab leave the tree for the input.
      event.currentTarget.focus({ preventScroll: true });
    }
  }
  function inputKey(event) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Escape") {
      controller.current?.cancelEnter();
      if (query) { event.preventDefault(); event.stopPropagation(); clear(); }
      return;
    }
    if (!isPlainSearchKey(event)) return;
    if (event.key === "ArrowDown") {
      const row = hasQuery ? results.current?.querySelector("[data-tree-row]")
        : keptTree.current?.querySelector("[data-tree-row], .source-tree-row");
      if (row) {
        event.preventDefault();
        controller.current?.cancelEnter();
        row.focus();
        row.scrollIntoView({ block: "nearest" });
        anchor.current = 0;
      }
    } else if (event.key === "Enter" && !event.repeat && hasQuery) {
      event.preventDefault();
      controller.current?.requestEnter();
    }
  }
  return <div className="sfs-browser" data-search-phase={state.phase} inert={!enabled ? true : undefined}>
    <div className="sfs-filter-bar">
      <div className="sfs-field" data-has-clear={Boolean(query)} onMouseDown={event => {
        if (event.button !== 0 || event.target.closest("input, button") || !cwd) return;
        event.preventDefault();
        input.current?.focus();
      }}>
        <span className="sfs-start-slot">
          {busy ? <SearchingFiles /> : <Icon name="Search" size={16} />}
        </span>
        <input ref={input} type="text" value={query} maxLength={64}
          aria-label={t("Filter files")} placeholder={t("Filter files…")} spellCheck={false} autoComplete="off"
          aria-controls={hasQuery ? resultId : treeId}
          aria-describedby={`${hintId}${hasQuery && state.phase === "success" && state.truncated ? ` ${limitId}` : ""}`}
          disabled={!cwd} onChange={event => change(event.target.value)} onKeyDown={inputKey}
          onBlur={() => controller.current?.cancelEnter()} />
        {query && <span className="sfs-clear-slot"><button type="button" aria-label={t("Clear filter")}
          onMouseDown={event => event.preventDefault()} onClick={clear}><Icon name="X" size={12} /></button></span>}
      </div>
      <p id={hintId} className="sfs-sr-only">{t("Results update as you type. Press Down Arrow to go to results, and Up Arrow on the first result to return here.")}</p>
    </div>
    <div ref={keptTree} id={treeId} className="sfs-kept-tree" hidden={hasQuery} inert={hasQuery ? true : undefined}
      onKeyDown={event => {
        if (event.key !== "ArrowUp" || !isPlainSearchKey(event)) return;
        const rows = keptTree.current.querySelectorAll("[data-tree-row], .source-tree-row");
        if (rows[0] === event.target || rows[0]?.contains(event.target)) { event.preventDefault(); input.current?.focus(); }
      }}>{typeof children === "function" ? children({ filtered: hasQuery }) : children}</div>
    <div ref={results} id={resultId} className="sfs-results" role="tree" aria-label={t("Project files")}
      aria-multiselectable="true" aria-busy={busy || undefined} hidden={!hasQuery} inert={!hasQuery ? true : undefined}
      data-stale={stale || undefined} tabIndex={0} onKeyDown={resultKey}
      onPointerDown={() => controller.current?.cancelEnter()}
      onFocusCapture={event => {
        focusInResults.current = true;
        if (event.target === event.currentTarget && !event.currentTarget.contains(event.relatedTarget) && event.currentTarget.matches(":focus-visible")) {
          const current = state.matches.findIndex(entry => entry.path === activePath);
          focusResult(Math.max(0, current));
        }
      }} onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) focusInResults.current = false;
      }}>
      {state.matches.map((entry, index) => {
        const slash = entry.path.lastIndexOf("/"), parent = slash >= 0 ? entry.path.slice(0, slash) : "";
        const hasNameMatches = entry.positions.some(position => position > slash);
        return <div key={entry.path} className="sfs-result-row" role="treeitem" aria-level={1}
          aria-selected={selected.has(entry.path)} aria-current={activePath === entry.path || undefined}
          data-tree-row="" data-row-index={index} tabIndex={-1}
          onFocus={() => { focused.current = { path: entry.path, index }; }}>
          <button type="button" tabIndex={-1} data-tree-primary="" aria-label={entry.path}
            onClick={event => activate(index, event)} onDoubleClick={event => activate(index, event, true)}>
            {/* shared-14 cP file-kind glyph (panes-tile-current.js:5692 zr(name)). */}
            <Icon name={fileKindIcon(entry.name)} size={12} />
            <span className="sfs-result-name" data-has-matches={hasNameMatches || undefined}>
              <LitPath text={entry.name} positions={entry.positions} offset={slash + 1} />
            </span>
            {parent && <span className="sfs-result-parent"><LitPath text={parent} positions={entry.positions} /></span>}
          </button>
        </div>;
      })}
      {state.phase === "error" && <div className="sfs-notice sfs-error" role="alert">
        <span>{state.error?.message || t("Couldn’t search filenames.")}</span>
        <button type="button" onClick={() => controller.current?.refresh()}>{t("Retry")}</button>
      </div>}
      {state.phase === "success" && !state.matches.length && <div className="sfs-notice">{t("No matching files")}</div>}
      {state.phase === "success" && state.truncated && <p id={limitId} className="sfs-limit">
        {searchLimitMessage(state)}
      </p>}
    </div>
  </div>;
}
