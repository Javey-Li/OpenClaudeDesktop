import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "./icons";
import { SourceMenu } from "./source-menu";
import { SourceTooltip, SourceTooltipGroup } from "./source-tooltip";
import { SourceConfirmationDialog } from "./source-dialog";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { useCodeThemes } from "./code-theme-store.mjs";
import { useReducedMotion } from "./use-reduced-motion.js";
import { FIND_LABELS, findInputKey, findStatusText } from "./transcript-find-model.mjs";
import {
  KEY_SEQUENCES, MINIMUM_CONTRAST_RATIO, SCROLLBACK_LINES, findLinks, relativeToFolder, safeWebUrl, shouldAutoClose, tabLabel,
  terminalError, terminalFont, terminalFontSize, terminalKeyAction, terminalTheme,
} from "./terminal-pane-model.mjs";
import { ownerKeyOf, terminalStore } from "./terminal-store.mjs";
import { useTabDragReorder } from "./use-tab-drag-reorder.mjs";
import { MAX_TERMINALS_PER_OWNER } from "../electron/terminal-model.mjs";
// terminal-service.cjs sweep: a tab whose start folder is gone keeps its scrollback and says so.
const FOLDER_GONE = "The session folder no longer exists.";
import { t, tn } from "../electron/i18n/index.mjs";
import "./source-terminal-pane.css";

// Terminal pane (independent implementation of the 2.2553.1 terminal pane: cccc2cf0a pane + Xd tab strip, c6bf19e8f
// ShellTerminal). A tile like Changes/Files/Plan: the tab strip sits in the 32px pane header ([tabs][+][More] then the
// drag handle and the pane controls), the body is one xterm per tab. The shells run in the main process
// (electron/terminal-service.cjs) and keep running while another session shows; this pane only attaches to them.
//
// Props: sessionId (null on the New session page, which then passes homeWorkspace), cwd (the folder the shells start
// in, for path links), headerCenter (the tile drag handle), controls (SourcePaneControls), onClosePane (closing the last
// tab closes the pane), onOpenFile({path,line}) (Files pane), onOpenExternal(url, event) (a plain click on a local page opens Preview), focusRequest (a changing value that
// moves focus into the active terminal).

const xtermModules = { promise: null };
function loadXterm() {
  if (!xtermModules.promise) {
    xtermModules.promise = Promise.all([
      import("@xterm/xterm"), import("@xterm/addon-fit"), import("@xterm/addon-search"), import("@xterm/addon-unicode11"),
      import("@xterm/addon-web-links"), import("@xterm/xterm/css/xterm.css"),
    ]).then(([xterm, fit, search, unicode, links]) => {
      // xterm's own screen-reader strings (its helper textarea's label, the too-much-output announcement) in the UI language.
      try {
        xterm.Terminal.strings.promptLabel = t("Terminal input");
        xterm.Terminal.strings.tooMuchOutput = t("Too much output to announce, navigate to rows manually to read");
      } catch { /* an xterm without localizable strings keeps its English */ }
      return {
        Terminal: xterm.Terminal, FitAddon: fit.FitAddon, SearchAddon: search.SearchAddon, Unicode11Addon: unicode.Unicode11Addon,
        WebLinksAddon: links.WebLinksAddon,
      };
    });
    xtermModules.promise.catch(() => { xtermModules.promise = null; });
  }
  return xtermModules.promise;
}
// The WebGL renderer is optional: a context loss (or no WebGL) leaves the DOM renderer in place.
let webglModule = null;
function loadWebgl() {
  if (!webglModule) webglModule = import("@xterm/addon-webgl").then((module) => module.WebglAddon).catch(() => null);
  return webglModule;
}
const themeColorCache = new Map();
function loadThemeColors(id) {
  if (!themeColorCache.has(id)) themeColorCache.set(id, import("./highlight-theme-loaders.mjs").then((module) => module.themeColors(id)).catch(() => null));
  return themeColorCache.get(id);
}

// Root appearance: light/dark mode, the code font chain and the root font size, re-read when main.jsx changes them.
function readAppearance() {
  if (typeof document === "undefined") return "light||16";
  const root = document.documentElement, style = getComputedStyle(root);
  return `${root.dataset.mode === "dark" ? "dark" : "light"}|${style.getPropertyValue("--cds-font-code").trim()}|${parseFloat(style.fontSize) || 16}`;
}
function subscribeAppearance(listener) {
  if (typeof MutationObserver === "undefined") return () => {};
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode", "style", "class", "data-font"] });
  return () => observer.disconnect();
}
function useAppearance() {
  const key = useSyncExternalStore(subscribeAppearance, readAppearance, () => "light||16");
  return useMemo(() => {
    const [mode, codeFont, root] = key.split("|");
    return { mode, codeFont, rootPx: Number(root) || 16 };
  }, [key]);
}

const store = () => terminalStore();
// The last focus request taken (main.jsx counts up when the pane opens): shared by every pane instance, so a pane that
// mounts again on a session switch never pulls focus for an old request.
let handledFocusRequest = null;

export function SourceTerminalPane({
  sessionId = null, homeWorkspace = null, cwd = null, headerCenter = null, controls = null, onClosePane, onOpenFile, onOpenExternal,
  focusRequest = null, onAttachSelection = null,
}) {
  const terminals = store();
  const owner = ownerKeyOf(sessionId, homeWorkspace);
  const version = useSyncExternalStore(terminals.subscribe, terminals.version, () => 0);
  const state = terminals.get(owner);
  const tabs = state?.tabs ?? [];
  const active = tabs.find((tab) => tab.id === state?.active) ?? tabs[0] ?? null;
  const [error, setError] = useState(terminals.available ? null : t("Couldn’t load the terminal. Reload the page to try again."));
  const [confirm, setConfirm] = useState(null); // { kind: "close"|"close-others", id, count }
  const [renaming, setRenaming] = useState(null); // id
  const [findOpen, setFindOpen] = useState(false);
  const [bell, setBell] = useState(null);
  const [backend, setBackend] = useState(null);
  const [bodyMenu, setBodyMenu] = useState(null); // {x, y, selection}: the terminal body's context menu
  const [attached, setAttached] = useState(0); // announces "Terminal output attached to chat"
  const hadTabs = useRef(null); // the owner whose tabs were seen (a session switch can reuse this pane)
  const creating = useRef(false);
  const host = useRef(null), pane = useRef(null), tabList = useRef(null);
  const viewRef = useRef(null);
  const [overflowing, setOverflowing] = useState(false);
  const hintId = useId(), moveHintId = useId();
  const reducedMotion = useReducedMotion();

  const create = useCallback(async () => {
    if (!owner || creating.current) return null;
    creating.current = true;
    try {
      const size = viewRef.current?.term ? { cols: viewRef.current.term.cols, rows: viewRef.current.term.rows } : {};
      const info = await terminals.create(owner, sessionId, homeWorkspace, size);
      setError(null);
      return info;
    } catch (failure) {
      setError(terminalError(failure, t("Failed to open terminal tab")));
      return null;
    } finally { creating.current = false; }
  }, [owner, sessionId, homeWorkspace, terminals]);

  // Open: list this owner's terminals once, and start one when there is none.
  useEffect(() => {
    if (!owner || !terminals.available) return undefined;
    let alive = true;
    terminals.backend().then((value) => { if (alive) setBackend(value?.backend ?? null); });
    terminals.load(owner, sessionId, homeWorkspace).then((loaded) => {
      if (!alive) return;
      if (loaded && loaded.tabs.length === 0) void create();
    }, (failure) => { if (alive) setError(terminalError(failure, t("Failed to list terminal tabs"))); });
    return () => { alive = false; };
  }, [owner]); // eslint-disable-line react-hooks/exhaustive-deps

  // Closing the last tab closes the pane (official); auto-close a tab whose shell exited cleanly or after `exit`.
  useEffect(() => {
    if (tabs.length) { hadTabs.current = owner; return; }
    if (hadTabs.current === owner && state?.loaded) { hadTabs.current = null; onClosePane?.(); }
  }, [tabs.length, state?.loaded, owner]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    for (const tab of tabs) if (shouldAutoClose(tab, terminals.lastEnter(tab.id))) void terminals.close(owner, sessionId, homeWorkspace, tab.id);
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  // Appearance → xterm options.
  const appearance = useAppearance();
  const codeThemes = useCodeThemes();
  const themeId = codeThemes?.[appearance.mode] ?? null;
  const [themeColors, setThemeColors] = useState(null);
  useEffect(() => {
    let alive = true;
    setThemeColors(null);
    if (themeId && !themeId.startsWith("claude-")) loadThemeColors(themeId).then((colors) => { if (alive) setThemeColors(colors); });
    return () => { alive = false; };
  }, [themeId]);
  const [surface, setSurface] = useState(null);
  useLayoutEffect(() => {
    if (pane.current && typeof getComputedStyle === "function") setSurface(getComputedStyle(pane.current).backgroundColor || null);
  }, [appearance.mode]);
  const theme = useMemo(() => terminalTheme({ themeId, mode: appearance.mode, colors: themeColors, surface }),
    [themeId, appearance.mode, themeColors, surface]);
  const options = useMemo(() => ({ theme, fontFamily: terminalFont(appearance.codeFont), fontSize: terminalFontSize(appearance.rootPx),
    cursorBlink: !reducedMotion }), [theme, appearance.codeFont, appearance.rootPx, reducedMotion]);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Links: http(s) through the app's external opener; file paths the main process confirms open in the Files pane.
  const handlers = useRef({});
  handlers.current = {
    // The click rides along: a plain click on a local page opens it in Preview, ⌘-click in the browser (main.jsx).
    web: (url, event) => { const safe = safeWebUrl(url); if (safe) onOpenExternal?.(safe, event ?? null); },
    file: (relative, line) => onOpenFile?.({ path: relative, ...(line ? { line } : {}) }),
    paths: (list, id) => terminals.paths(sessionId, homeWorkspace, list, id),
    clear: (id) => terminals.clear(sessionId, homeWorkspace, id),
    folder: cwd,
    key: null,
    bell: (id) => setBell({ id, at: Date.now() }),
    // ⇧⌘L / the body menu's "Attach selection as context": the selected output joins this session's draft.
    attach: (text) => {
      if (!onAttachSelection || typeof text !== "string" || !text.trim()) return false;
      onAttachSelection(text);
      setAttached(Date.now());
      return true;
    },
  };

  const factory = useCallback((modules) => (info) => {
    const id = info?.id;
    // A kept view outlives the pane that created it: its callbacks go to whichever pane shows it now (bind below).
    const bound = { handlers };
    const element = document.createElement("div");
    element.className = "stp-xterm";
    const { Terminal, FitAddon, SearchAddon, Unicode11Addon, WebLinksAddon } = modules;
    const term = new Terminal({
      ...optionsRef.current, scrollback: SCROLLBACK_LINES, minimumContrastRatio: MINIMUM_CONTRAST_RATIO, allowProposedApi: true,
      macOptionIsMeta: false, rightClickSelectsWord: false, drawBoldTextInBrightColors: true,
    });
    const fit = new FitAddon(), search = new SearchAddon({ highlightLimit: 1000 });
    term.loadAddon(fit);
    term.loadAddon(search);
    try { term.loadAddon(new Unicode11Addon()); term.unicode.activeVersion = "11"; } catch {}
    term.loadAddon(new WebLinksAddon((event, uri) => { event?.preventDefault?.(); bound.handlers.current.web(uri, event); }));
    // Found paths by text, briefly: they resolve from the shell's current folder, which a `cd` changes.
    const checked = new Map();
    const CHECKED_MS = 3000;
    term.registerLinkProvider({
      provideLinks(lineNumber, callback) {
        const line = term.buffer.active.getLine(lineNumber - 1);
        if (!line) { callback(undefined); return; }
        // Text with a string index → cell column map (wide characters take two cells).
        let text = "";
        const columns = [];
        for (let x = 0; x < term.cols; x++) {
          const cell = line.getCell(x);
          if (!cell) break;
          const chars = cell.getChars();
          if (!chars && cell.getWidth() === 0) continue;
          for (const char of chars || " ") { columns.push(x); text += char; }
        }
        const candidates = findLinks(text).filter((link) => link.kind === "file");
        if (!candidates.length) { callback(undefined); return; }
        const now = Date.now();
        const unknown = [...new Set(candidates.map((link) => link.path))].filter((path) => !(now - (checked.get(path)?.at ?? -Infinity) < CHECKED_MS));
        Promise.resolve(unknown.length ? bound.handlers.current.paths(unknown, id) : []).then((results) => {
          const at = Date.now();
          unknown.forEach((path, index) => checked.set(path, { value: results?.[index] ?? null, at }));
          if (checked.size > 500) checked.clear();
          const found = new Map(candidates.map((link) => [link.path, checked.get(link.path)?.value ?? null]));
          callback(candidates.filter((link) => found.get(link.path)).map((link) => ({
            range: { start: { x: columns[link.start] + 1, y: lineNumber }, end: { x: columns[link.end - 1] + 1, y: lineNumber } },
            text: link.text,
            decorations: { underline: true, pointerCursor: false },
            activate: (event) => { event?.preventDefault?.(); bound.handlers.current.file(found.get(link.path), link.line); },
          })));
        }, () => callback(undefined));
      },
    });
    term.onData((data) => terminals.input(id, data));
    term.onBell(() => bound.handlers.current.bell?.(id));
    term.attachCustomKeyEventHandler((event) => {
      const action = terminalKeyAction(event);
      if (!action) return true;
      if (action === "toggle") return false; // the window handler toggles the pane
      event.preventDefault();
      event.stopPropagation();
      if (action === "clear") { term.clear(); bound.handlers.current.clear?.(id); }
      else if (action === "select-all") term.selectAll();
      else if (action === "attach-selection") bound.handlers.current.attach?.(term.getSelection());
      else if (action === "find") bound.handlers.current.key?.("find");
      else if (action === "find-next" || action === "find-previous") bound.handlers.current.key?.(action);
      else if (KEY_SEQUENCES[action]) terminals.input(id, KEY_SEQUENCES[action]);
      return false;
    });
    // The buffer as plain text on the view's own element (the WebGL renderer leaves no DOM rows to read): the offscreen
    // UI suite reads it; nothing in the app depends on it.
    element.stpReadText = () => {
      const buffer = term.buffer.active, lines = [];
      // A soft-wrapped row continues the previous logical line (xterm marks it isWrapped).
      for (let index = 0; index < buffer.length; index++) {
        const line = buffer.getLine(index), text = line?.translateToString(true) ?? "";
        if (line?.isWrapped && lines.length) lines[lines.length - 1] += text; else lines.push(text);
      }
      return lines.join("\n").replace(/\s+$/, "");
    };
    host.current?.replaceChildren(element);
    term.open(element);
    const view = {
      id, element, term, fit, search, webgl: null, bind: (next) => { bound.handlers = next; },
      write: (data) => term.write(data), reset: () => term.reset(), clear: () => term.clear(),
      dispose: () => { try { view.webgl?.dispose(); } catch {} term.dispose(); element.remove(); },
    };
    loadWebgl().then((WebglAddon) => {
      if (!WebglAddon || !element.isConnected || view.webgl) return;
      try {
        const webgl = new WebglAddon();
        webgl.onContextLoss(() => { try { webgl.dispose(); } catch {} view.webgl = null; });
        term.loadAddon(webgl);
        view.webgl = webgl;
      } catch { /* DOM renderer */ }
    });
    return view;
  }, [terminals]);

  // Show the active tab's view in the body (created on first use, kept across session switches by the store).
  const activeId = active?.id ?? null;
  const [modulesReady, setModulesReady] = useState(null);
  useEffect(() => {
    let alive = true;
    loadXterm().then((modules) => { if (alive) setModulesReady(() => modules); }, () => { if (alive) setError(t("Couldn’t load the terminal. Reload the page to try again.")); });
    return () => { alive = false; };
  }, []);
  const fitNow = useCallback(() => {
    const view = viewRef.current;
    if (!view || !view.element.isConnected || !host.current?.clientWidth) return;
    try {
      const before = `${view.term.cols}x${view.term.rows}`;
      view.fit.fit();
      if (`${view.term.cols}x${view.term.rows}` !== before || !view.sized) {
        view.sized = true;
        void terminals.resize(sessionId, homeWorkspace, view.id, view.term.cols, view.term.rows);
      }
    } catch {}
  }, [terminals, sessionId, homeWorkspace]);
  useLayoutEffect(() => {
    if (!modulesReady || !activeId || !host.current) return undefined;
    const view = terminals.view(activeId, sessionId, homeWorkspace, factory(modulesReady));
    viewRef.current = view;
    view.bind?.(handlers);
    if (view.element.parentNode !== host.current) host.current.replaceChildren(view.element);
    for (const [key, value] of Object.entries(optionsRef.current)) if (view.term.options[key] !== value) view.term.options[key] = value;
    view.sized = false;
    fitNow();
    if (pendingFocus.current) { pendingFocus.current = false; requestAnimationFrame(focusTerminal); }
    return () => {
      if (viewRef.current === view) viewRef.current = null;
      if (view.element.parentNode === host.current) view.element.remove();
      // No longer shown here: this window's size stops limiting the PTY (another window may show it wider).
      void terminals.detach?.(sessionId, homeWorkspace, view.id);
    };
  }, [modulesReady, activeId, owner]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    for (const [key, value] of Object.entries(options)) if (view.term.options[key] !== value) view.term.options[key] = value;
    fitNow();
  }, [options, fitNow]);
  useEffect(() => {
    if (!host.current || typeof ResizeObserver === "undefined") return undefined;
    let frame = 0;
    const observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fitNow); });
    observer.observe(host.current);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [fitNow]);
  // Focus requests (toggle shortcut, pane opened, tab switched by the user).
  const focusTerminal = useCallback(() => { viewRef.current?.term.focus(); }, []);
  const pendingFocus = useRef(false);
  useEffect(() => {
    if (focusRequest === null || focusRequest === undefined || focusRequest === handledFocusRequest) return;
    handledFocusRequest = focusRequest;
    if (viewRef.current) requestAnimationFrame(focusTerminal);
    else pendingFocus.current = true;
  }, [focusRequest, focusTerminal]);
  // An error about one action fades once tabs work again.
  useEffect(() => {
    if (!error || !tabs.length) return undefined;
    const timer = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(timer);
  }, [error, tabs.length]);
  useEffect(() => {
    if (!bell) return undefined;
    const timer = setTimeout(() => setBell(null), 1200);
    return () => clearTimeout(timer);
  }, [bell]);

  // Tab strip overflow → "More terminals".
  useLayoutEffect(() => {
    const list = tabList.current;
    if (!list || typeof ResizeObserver === "undefined") return undefined;
    const measure = () => setOverflowing(list.scrollWidth > list.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [tabs.length]);
  useEffect(() => {
    tabList.current?.querySelector('[role="tab"][aria-selected="true"]')?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [activeId]);

  const select = (id, { focus = false } = {}) => {
    terminals.select(owner, id);
    if (focus) requestAnimationFrame(focusTerminal);
  };
  const close = (id) => {
    const tab = tabs.find((value) => value.id === id);
    if (!tab) return;
    if (tab.busy === true && tab.status === "running") setConfirm({ kind: "close", id, name: tabLabel(tab, tabs.length) });
    else void terminals.close(owner, sessionId, homeWorkspace, id);
  };
  const closeOthers = (id) => {
    const others = tabs.filter((tab) => tab.id !== id);
    const busy = others.filter((tab) => tab.busy === true && tab.status === "running").length;
    if (busy) setConfirm({ kind: "close-others", id, count: busy });
    else for (const tab of others) void terminals.close(owner, sessionId, homeWorkspace, tab.id);
  };
  const confirmed = () => {
    const pending = confirm;
    setConfirm(null);
    if (!pending) return;
    if (pending.kind === "close") void terminals.close(owner, sessionId, homeWorkspace, pending.id);
    else for (const tab of tabs) if (tab.id !== pending.id) void terminals.close(owner, sessionId, homeWorkspace, tab.id);
  };
  const clear = (id) => { if (viewRef.current?.id === id) { viewRef.current.term.clear(); focusTerminal(); } };
  const restart = async () => {
    if (!active) return;
    try { await terminals.restart(sessionId, homeWorkspace, active.id); setError(null); focusTerminal(); }
    catch (failure) { setError(terminalError(failure, t("Failed to open terminal tab"))); }
  };
  const newTab = async () => { const info = await create(); if (info) requestAnimationFrame(focusTerminal); };

  const findRef = useRef(null);
  handlers.current.key = (action) => {
    if (action === "find") setFindOpen(true);
    else findRef.current?.step(action === "find-next");
  };

  // Drag a tab to a new slot (panes-tabs-current.js Oe onReorder); Ctrl+Shift+←/→ below stays the keyboard path.
  const tabDrag = useTabDragReorder({ stripRef: tabList, itemSelector: "[data-terminal-id]", idOf: (node) => node.dataset.terminalId,
    onReorder: (id, toIndex, fromIndex) => terminals.move(owner, id, toIndex - fromIndex) });
  const shownTabs = tabDrag.order(tabs, (tab) => tab.id);
  const onTabKey = (event, id) => {
    const index = tabs.findIndex((tab) => tab.id === id);
    if (event.shiftKey && (event.ctrlKey || event.metaKey) && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      terminals.move(owner, id, event.key === "ArrowLeft" ? -1 : 1);
      requestAnimationFrame(() => tabList.current?.querySelector(`[data-terminal-id="${id}"] [role="tab"]`)?.focus());
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); close(id); return; }
    let next = null;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    select(tabs[next].id);
    requestAnimationFrame(() => tabList.current?.querySelector(`[data-terminal-id="${tabs[next].id}"] [role="tab"]`)?.focus());
  };

  const exited = active?.status === "exited";
  const limited = active?.limited === true || (!active && backend === "script");
  return (
    <aside ref={pane} className="source-file-panel detail-panel stp-pane" aria-label={t("Terminal")} data-terminal-owner={owner || undefined}>
      <header className="source-pane-header" data-pane-header="terminal">
        <div className="source-file-tabbar stp-tabbar" data-view-tab-bar="" onDoubleClick={(event) => { if (event.target === event.currentTarget || event.target === tabList.current) void newTab(); }}>
          <div ref={tabList} className="source-file-tabs stp-tabs" role="tablist" aria-label={t("Terminal tabs")}>
            <SourceTooltipGroup delay={700}>
              {shownTabs.map((tab, index) => (
                <TerminalTab key={tab.id} tab={tab} onPointerDown={(event) => tabDrag.onPointerDown(tab.id, event)} label={tabLabel(tab, tabs.length)} selected={tab.id === activeId} posinset={index + 1}
                  setsize={tabs.length} hintId={hintId} moveHintId={moveHintId} bell={bell?.id === tab.id && !reducedMotion}
                  renaming={renaming === tab.id} onRenameDone={async (title) => {
                    setRenaming(null);
                    if (title !== undefined) { try { await terminals.rename(sessionId, homeWorkspace, tab.id, title); } catch (failure) { setError(terminalError(failure, t("Couldn’t rename the terminal"))); } }
                    requestAnimationFrame(() => tabList.current?.querySelector(`[data-terminal-id="${tab.id}"] [role="tab"]`)?.focus());
                  }}
                  onSelect={() => select(tab.id, { focus: true })} onClose={() => close(tab.id)} onKeyDown={(event) => onTabKey(event, tab.id)}
                  onRename={() => setRenaming(tab.id)} onClear={() => clear(tab.id)} onCloseOthers={tabs.length > 1 ? () => closeOthers(tab.id) : null} />
              ))}
            </SourceTooltipGroup>
          </div>
          <span id={hintId} className="source-sr-only">{t("Press Delete or Backspace to close the terminal")}</span>
          <span id={moveHintId} className="source-sr-only">{t("Press Control+Shift+Left Arrow or Right Arrow to move the terminal")}</span>
          {/* At the per-session cap the button says why instead of failing (aria-disabled keeps its tooltip). */}
          <SourceTooltip content={tabs.length >= MAX_TERMINALS_PER_OWNER ? t("Up to {count} terminals per session", { count: MAX_TERMINALS_PER_OWNER }) : t("New terminal")} side="bottom" hoverable={false}>
            <button type="button" className="source-icon-button stp-new" aria-label={t("New terminal")} disabled={!owner || !terminals.available}
              aria-disabled={tabs.length >= MAX_TERMINALS_PER_OWNER || undefined}
              onMouseDown={(event) => event.preventDefault()} onClick={() => { if (tabs.length < MAX_TERMINALS_PER_OWNER) void newTab(); }}>
              <Icon name="Add" size={16} />
            </button>
          </SourceTooltip>
          {overflowing && <MoreTerminals tabs={tabs} activeId={activeId} onSelect={(id) => select(id, { focus: true })} />}
        </div>
        {headerCenter}
        {controls}
      </header>
      <div className="stp-body" style={{ backgroundColor: theme.background }} data-exited={exited || undefined}
        onKeyDown={(event) => { if (event.key === "Escape" && findOpen) { event.preventDefault(); setFindOpen(false); focusTerminal(); } }}>
        {limited && !exited && <p className="stp-note" role="note">{t("Limited terminal: the terminal module couldn’t load, so the window size can’t change while a program runs.")}</p>}
        {/* The session folder was deleted or renamed: the running command goes on; the tab says why a new shell can't start. */}
        {active?.error === FOLDER_GONE && !exited && <p className="stp-note" role="note">{t(FOLDER_GONE)}</p>}
        <div ref={host} className="stp-host"
          onContextMenu={(event) => {
            const term = viewRef.current?.term;
            if (!term) return;
            event.preventDefault();
            setBodyMenu({ x: event.clientX, y: event.clientY, selection: term.getSelection() || "" });
          }} />
        {bodyMenu && (
          <SourceMenu.Popup anchor={host.current} trigger={null} point={bodyMenu} dataCds="ContextMenu" layer="contextmenu" label={t("Terminal")}
            onClose={() => { setBodyMenu(null); focusTerminal(); }}>
            {/* 2.2553.1 cccc2cf0a Dm: Attach selection as context (only with a selection), then Copy, Paste and Select all. */}
            {onAttachSelection && bodyMenu.selection.trim() && <>
              <SourceMenu.Item shortcut="cmd+shift+l" onClick={() => handlers.current.attach(bodyMenu.selection)}>{t("Attach selection as context")}</SourceMenu.Item>
              <SourceMenu.Separator />
            </>}
            <SourceMenu.Item shortcut="cmd+c" disabled={!bodyMenu.selection} onClick={() => { const text = bodyMenu.selection; void navigator.clipboard?.writeText?.(text).catch(() => {}); }}>{t("Copy")}</SourceMenu.Item>
            <SourceMenu.Item shortcut="cmd+v" disabled={!active || active.status !== "running"} onClick={() => {
              const term = viewRef.current?.term;
              if (!term) return;
              term.focus();
              Promise.resolve(navigator.clipboard?.readText?.()).then((text) => { if (typeof text === "string" && text) term.paste(text); }, () => { try { document.execCommand("paste"); } catch {} });
            }}>{t("Paste")}</SourceMenu.Item>
            <SourceMenu.Separator />
            <SourceMenu.Item shortcut="cmd+a" onClick={() => viewRef.current?.term.selectAll()}>{t("Select all")}</SourceMenu.Item>
          </SourceMenu.Popup>
        )}
        <span className="source-sr-only" role="status" aria-live="polite">{attached ? t("Terminal output attached to chat") : ""}</span>
        {findOpen && <TerminalFind ref={findRef} view={viewRef} background={theme.background} onClose={() => { setFindOpen(false); focusTerminal(); }} />}
        {exited && (
          <div className="stp-exited" role="status">
            <span>{active?.error === FOLDER_GONE ? t(FOLDER_GONE) : t("Shell exited.")}</span>
            {active?.error !== FOLDER_GONE && <SourceSettingsButton size="sm" variant="secondary" onClick={() => void restart()}>{t("Restart shell")}</SourceSettingsButton>}
          </div>
        )}
        {error && !exited && (
          <div className="stp-error" role="alert">
            <span>{error}</span>
            {terminals.available && owner && !tabs.length && <SourceSettingsButton size="sm" variant="secondary" onClick={() => void newTab()}>{t("New terminal")}</SourceSettingsButton>}
          </div>
        )}
        {!tabs.length && !error && <span className="stp-placeholder" data-testid="terminal-pane-placeholder" aria-hidden="true" />}
      </div>
      {confirm && (
        <SourceConfirmationDialog
          title={confirm.kind === "close" ? t("Close terminal?") : t("Close other terminals?")}
          body={confirm.kind === "close" ? t("A command is still running in {name}. Closing the terminal stops it.", { name: confirm.name })
            : tn(confirm.count, "A command is still running in one of the other terminals. Closing them stops it.",
              "Commands are still running in {count} of the other terminals. Closing them stops those commands.")}
          confirmLabel={confirm.kind === "close" ? t("Close terminal") : t("Close other terminals")}
          confirmVariant="danger" onConfirm={confirmed} onCancel={() => setConfirm(null)} />
      )}
    </aside>
  );
}

function TerminalTab({ tab, label, selected, posinset, setsize, hintId, moveHintId, bell, renaming, onRenameDone, onSelect, onClose, onKeyDown, onRename, onClear, onCloseOthers, onPointerDown }) {
  const root = useRef(null), field = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState(label);
  useLayoutEffect(() => { if (renaming) { setDraft(tab.title ?? label); requestAnimationFrame(() => { field.current?.focus(); field.current?.select(); }); } }, [renaming]); // eslint-disable-line react-hooks/exhaustive-deps
  const running = tab.busy === true && tab.status === "running";
  const status = tab.status === "exited" ? t("Shell exited.") : running ? t("Terminal (command running)") : null;
  return (
    <div ref={root} role="presentation" className="source-file-tab stp-tab" data-terminal-id={tab.id} data-selected={selected || undefined}
      data-popup-open={menuOpen || undefined} data-busy={running || undefined} data-exited={tab.status === "exited" || undefined} data-bell={bell || undefined}
      onMouseDown={(event) => { if (event.button === 1 || event.button === 2) event.preventDefault(); }}
      onPointerDown={renaming ? undefined : onPointerDown}
      onAuxClick={(event) => { if (event.button === 1) { event.preventDefault(); onClose(); } }}
      onDoubleClick={(event) => { event.stopPropagation(); onRename(); }}
      onContextMenu={(event) => { event.preventDefault(); setMenuOpen(true); }}>
      <span aria-hidden="true" className="source-file-tab-bg" />
      {renaming ? (
        <input ref={field} className="stp-rename" value={draft} maxLength={64} aria-label={t("Rename terminal")} spellCheck={false}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.nativeEvent?.isComposing) return;
            if (event.key === "Enter") { event.preventDefault(); onRenameDone(draft); }
            else if (event.key === "Escape") { event.preventDefault(); onRenameDone(undefined); }
          }}
          onBlur={() => onRenameDone(draft)} />
      ) : (
        <SourceTooltip content={label} detail={tab.cwd} side="bottom" align="start" delay={700} hoverable={false}>
          <div role="tab" aria-selected={selected} aria-posinset={posinset} aria-setsize={setsize} tabIndex={selected ? 0 : -1}
            aria-describedby={`${hintId} ${moveHintId}`} onClick={onSelect}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(); return; }
              if (event.key === "F2") { event.preventDefault(); onRename(); return; }
              onKeyDown(event);
            }}>
            {running && <span className="stp-tab-dot" aria-hidden="true" />}
            <span className="source-file-tab-label" data-vtb-label=""><span>{label}{status && <span className="source-sr-only">, {status}</span>}</span></span>
          </div>
        </SourceTooltip>
      )}
      {!renaming && <button type="button" tabIndex={-1} aria-hidden="true" aria-label={t("Close terminal")} className="source-file-tab-close"
        onMouseDown={(event) => event.preventDefault()} onClick={(event) => { event.stopPropagation(); onClose(); }}>
        <Icon name="X" size={12} />
      </button>}
      {menuOpen && (
        <SourceMenu.Popup anchor={root.current} trigger={null} side="bottom" align="start" dataCds="ContextMenu" layer="contextmenu"
          onClose={() => setMenuOpen(false)}>
          <SourceMenu.Item onClick={onRename}>{t("Rename terminal")}</SourceMenu.Item>
          <SourceMenu.Item onClick={onClear} disabled={!selected} disabledReason={selected ? undefined : t("Switch to this terminal first")}>{t("Clear terminal")}</SourceMenu.Item>
          <SourceMenu.Separator />
          <SourceMenu.Item onClick={onClose}>{t("Close terminal")}</SourceMenu.Item>
          {onCloseOthers && <SourceMenu.Item onClick={onCloseOthers}>{t("Close other terminals")}</SourceMenu.Item>}
        </SourceMenu.Popup>
      )}
    </div>
  );
}

function MoreTerminals({ tabs, activeId, onSelect }) {
  const trigger = useRef(null);
  const [open, setOpen] = useState(false);
  return (
    <span className="source-file-tabs-overflow" data-vtb-overflow="">
      <SourceTooltip content={t("More terminals")} side="bottom" hoverable={false}>
        <button ref={trigger} type="button" className="source-icon-button" aria-label={t("More terminals")} aria-haspopup="menu" aria-expanded={open}
          onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen((value) => !value)}>
          <Icon name="CaretDown" size={16} />
        </button>
      </SourceTooltip>
      {open && (
        <SourceMenu.Popup anchor={trigger.current} trigger={trigger.current} side="bottom" align="end" label={t("More terminals")} onClose={() => setOpen(false)}>
          {tabs.map((tab) => (
            <SourceMenu.Item key={tab.id} checked={tab.id === activeId} checkedRole="radio" onClick={() => onSelect(tab.id)}>{tabLabel(tab, tabs.length)}</SourceMenu.Item>
          ))}
        </SourceMenu.Popup>
      )}
    </span>
  );
}

const TerminalFind = React.forwardRef(function TerminalFind({ view, background, onClose }, ref) {
  const input = useRef(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState({ activeIndex: 0, total: 0 });
  const decorations = useMemo(() => ({ matchBackground: "#ffd500", activeMatchBackground: "#ff9632", matchOverviewRuler: "#ffd500", activeMatchColorOverviewRuler: "#ff9632" }), []);
  useEffect(() => {
    const search = view.current?.search;
    if (!search) return undefined;
    const subscription = search.onDidChangeResults(({ resultIndex, resultCount }) => setResult({ activeIndex: resultIndex + 1, total: resultCount }));
    return () => { subscription.dispose(); search.clearDecorations(); };
  }, [view]);
  useLayoutEffect(() => { input.current?.focus(); input.current?.select(); }, []);
  const run = (text, forward = true, incremental = false) => {
    const search = view.current?.search;
    if (!search) return;
    if (!text) { search.clearDecorations(); setResult({ activeIndex: 0, total: 0 }); return; }
    if (forward) search.findNext(text, { incremental, decorations });
    else search.findPrevious(text, { decorations });
  };
  React.useImperativeHandle(ref, () => ({ step: (forward) => run(query, forward) }), [query]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div role="search" className="sfb-root stp-find" style={{ "--stp-find-surface": background }}>
      <input ref={input} className="sfb-input hide-focus-ring" value={query} spellCheck={false} autoComplete="off" aria-label={FIND_LABELS.input}
        placeholder={FIND_LABELS.placeholder}
        onChange={(event) => { setQuery(event.target.value); run(event.target.value, true, true); }}
        onKeyDown={(event) => {
          const direction = findInputKey(event.nativeEvent ?? event);
          if (direction) { event.preventDefault(); run(query, direction === "next"); return; }
          if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
          if ((event.metaKey && event.code === "KeyG")) { event.preventDefault(); run(query, !event.shiftKey); }
        }} />
      <span role="status" aria-atomic="true" className="sfb-status">{findStatusText(query, result)}</span>
      <button type="button" className="sfb-button can-focus" aria-label={FIND_LABELS.previous} disabled={!result.total} onClick={() => run(query, false)}><Icon name="CaretUp" size={20} /></button>
      <button type="button" className="sfb-button can-focus" aria-label={FIND_LABELS.next} disabled={!result.total} onClick={() => run(query, true)}><Icon name="CaretDown" size={20} /></button>
      <button type="button" className="sfb-button can-focus" aria-label={FIND_LABELS.close} onClick={onClose}><Icon name="X" size={20} /></button>
    </div>
  );
});
