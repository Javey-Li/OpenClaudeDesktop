// Split view (Claude Desktop 2.2553.1 desktop-sidebar.js WR "dframe-pane-host" / GR, desktop-layout.css
// .dframe-pane-*): two sessions side by side in one window. Each side is its own <App side> (main.jsx) with its
// own transcript, composer, panes, model and permission state; the window-wide pieces (sidebar, Settings, menus,
// the core connection in main.cjs) stay single. SourceSplitRoot mounts the second App into the slot that
// SourceSplitHost renders next to the first App's workspace, so both share one DOM tree, one toast layer and the
// modal inertness of #root. splitStore (split-view-store.mjs) is the window's split state; main.cjs persists it
// per window ("window-layout") and builds View › Split View from it ("split-menu-state").
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { t } from "../electron/i18n/index.mjs";
import { Icon } from "./icons";
import { SourceTooltip } from "./source-tooltip";
import { createSplitViewStore } from "./split-view-store.mjs";
import { SESSION_DRAG_TYPE, SPLIT_COMMANDS, SPLIT_DEFAULT_RATIO, SPLIT_MIN_PANE_PX, clampRatio, ratioFromPointer, ratioPercent, splitShortcut, splitTabbed, stepRatio } from "./split-view-model.mjs";
import "./source-split-view.css";

export { SESSION_DRAG_TYPE };
// Official RL: what a ⌘-press never turns into a side drag, and the movement before it does (kL).
const PANE_DRAG_IGNORED = "a,input,textarea,select,button,[role='button'],[contenteditable='true'],.monaco-editor,.xterm";
const PANE_DRAG_THRESHOLD = 4;
const desktop = () => (typeof window !== "undefined" ? window.desktop : undefined);
export const splitStore = createSplitViewStore({
  report: ({ layout, menu }) => {
    const api = desktop();
    if (!api?.call) return;
    if (layout) api.call("window-layout", layout).catch(() => {});
    if (menu) api.call("split-menu-state", menu).catch(() => {});
  },
});
export function useSplitView(store = splitStore) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
// What a side's App reads from the split: whether it is split, the focused side and both sides' sessions. The ratio
// (changed on every divider move) and the titles stay out of it, so dragging the divider never re-renders an App.
const sidesKey = (state) => `${state.open ? 1 : 0}|${state.active}|${state.sides[0].current ?? ""}|${state.sides[1].current ?? ""}`;
export function useSplitSides(store = splitStore) {
  const read = () => sidesKey(store.getState());
  useSyncExternalStore(store.subscribe, read, read);
  return store.getState();
}
/** Inside the side that is not focused while split (main.jsx and pane key handlers stand down there). */
export function inInactiveSplitSide(node) {
  return !!node?.closest?.("[data-split-inactive]");
}

// splitShortcut (split-view-model.mjs): the official OR() chords, matched in this window's keydown first.
export { splitShortcut };

/** The window's Apps: the primary side always, the secondary side while split (portaled into its slot). */
export function SourceSplitRoot({ renderSide, store = splitStore }) {
  // Re-rendered only when the secondary side mounts, unmounts or moves to a new slot.
  const portalKey = () => { const state = store.getState(); return state.open && state.slot && state.secondary ? `${state.secondary.nonce}:${state.slotVersion}` : ""; };
  useSyncExternalStore(store.subscribe, portalKey, portalKey);
  const split = store.getState();
  useEffect(() => {
    const api = desktop();
    const unsubscribe = api?.onEvent?.((event) => {
      if (event?.kind === "split-view" && SPLIT_COMMANDS.includes(event.command)) store.command(event.command);
    });
    const key = (event) => {
      const command = splitShortcut(event);
      if (!command || document.getElementById("root")?.inert === true) return;
      // Only a chord that applies is taken: ⌃⌘\ while unsplit, the others while split.
      if ((command === "new-right") === store.getState().open) return;
      event.preventDefault();
      store.command(command);
    };
    const flush = () => store.flushReport();
    store.reportNow();
    window.addEventListener("keydown", key);
    window.addEventListener("pagehide", flush);
    return () => { unsubscribe?.(); window.removeEventListener("keydown", key); window.removeEventListener("pagehide", flush); };
  }, [store]);
  return <>
    {renderSide(0, null)}
    {split.open && split.slot && split.secondary
      ? createPortal(<React.Fragment key={`split-${split.secondary.nonce}`}>{renderSide(1, split.secondary)}</React.Fragment>, split.slot)
      : null}
  </>;
}

function SplitDivider({ ratio, hostRef, store, onResizing }) {
  const width = () => hostRef.current?.getBoundingClientRect().width ?? 0;
  const drag = useRef(null);
  const percent = ratioPercent(ratio);
  const floor = Math.round(clampRatio(0, width()) * 100), ceiling = Math.round(clampRatio(1, width()) * 100);
  return <div className="split-divider" role="separator" aria-orientation="vertical" tabIndex={0}
    aria-label={t("Resize split view")} aria-valuenow={percent} aria-valuemin={floor || 15} aria-valuemax={ceiling || 85}
    aria-valuetext={t("{percent}% left, {rest}% right", { percent, rest: 100 - percent })}
    onPointerDown={(event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      drag.current = { id: event.pointerId };
      onResizing(true);
    }}
    onPointerMove={(event) => {
      if (drag.current?.id !== event.pointerId) return;
      const rect = hostRef.current?.getBoundingClientRect();
      if (rect) store.setRatio(ratioFromPointer(event.clientX, rect.left, rect.width), rect.width);
    }}
    onPointerUp={(event) => { if (drag.current?.id === event.pointerId) { drag.current = null; onResizing(false); } }}
    onPointerCancel={() => { drag.current = null; onResizing(false); }}
    onLostPointerCapture={() => { if (drag.current) { drag.current = null; onResizing(false); } }}
    onDoubleClick={() => store.setRatio(SPLIT_DEFAULT_RATIO, width())}
    onKeyDown={(event) => {
      // The store's live ratio: repeated keys before a re-render still step from the last value.
      const next = stepRatio(store.getState().ratio, event.key, { width: width(), shift: event.shiftKey });
      if (next === null) return;
      event.preventDefault();
      store.setRatio(next, width());
    }}>
    <span className="split-divider-line" aria-hidden="true" />
  </div>;
}

function SplitTabs({ split, store, ids, chrome }) {
  // ARIA tabs: choosing a tab shows its side and keeps the keyboard on the tab list.
  const select = (side) => store.focus(side);
  // The strip is the window's top edge: with the sidebar collapsed it starts after the traffic lights and carries the
  // Show sidebar / Back / Forward chrome the hidden titlebars would have shown; its empty space drags the window.
  return <div className="split-tabs-bar" data-chrome={chrome ? "" : undefined}>
    {chrome && <div className="split-tabs-chrome">{chrome}</div>}
    <div className="split-tabs" role="tablist" aria-label={t("Split view")}
    onKeyDown={(event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const side = split.active === 0 ? 1 : 0;
      select(side);
      requestAnimationFrame(() => document.getElementById(ids.tab(side))?.focus());
    }}>
    {[0, 1].map((side) => {
      const title = split.sides[side].title || (split.sides[side].current ? t("Untitled session") : t("New session"));
      return <button key={side} type="button" role="tab" id={ids.tab(side)} aria-controls={ids.pane(side)} aria-selected={split.active === side}
        tabIndex={split.active === side ? 0 : -1} className="split-tab" data-active={split.active === side || undefined} onClick={() => select(side)}>
        <span className="split-tab-label">{title}</span>
      </button>;
    })}
    </div>
    {/* Tabbed, only the shown side has a titlebar, so its close sits on the strip (CDS tooltip with the ⌃⌘W chord). */}
    <SourceTooltip content={t("Close split view")} shortcut="ctrl+cmd+w" side="bottom" hoverable={false}>
      <button type="button" className="split-tabs-close code-icon-button" aria-label={t("Close split view")}
        onClick={() => store.close(split.active)}><Icon name="X" size={14} /></button>
    </SourceTooltip>
  </div>;
}

/** The workspace area of the primary side's App: its <main> on the left and, while split, the divider and the
 * secondary side's slot. Any other side renders its children unchanged. */
export function SourceSplitHost({ side = 0, children, chrome = null, store = splitStore }) {
  const split = useSplitView(store);
  const hostRef = useRef(null), primaryRef = useRef(null), slotRef = useRef(null);
  const [resizing, setResizing] = useState(false);
  const [drop, setDrop] = useState(null);
  const ids = { tab: (index) => `split-tab-${index}`, pane: (index) => `split-pane-${index}` };
  const open = side === 0 && split.open;
  // The secondary App portals into this element; publishing it re-renders SourceSplitRoot.
  // Stable, so React calls it only when the slot mounts or unmounts (a new callback per render would publish null and
  // the element again on every render and re-render both sides).
  const setSlot = useCallback((element) => { slotRef.current = element; if (side === 0) store.setSlot(element); }, [side, store]);
  useLayoutEffect(() => () => { if (side === 0) store.setSlot(null); }, [side, store]);
  // Narrow: one side at a time behind tabs (the ratio is re-clamped to the width it gets back).
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (side !== 0 || !host || typeof ResizeObserver !== "function") return undefined;
    const measure = () => {
      const width = host.getBoundingClientRect().width, tabbed = splitTabbed(width, SPLIT_MIN_PANE_PX);
      store.setTabs(tabbed);
      // Side by side again: the ratio is kept, only pulled in so both sides keep their minimum width.
      if (store.getState().open && !tabbed) store.setRatio(store.getState().ratio, width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [side, store]);
  // A click or focus inside a side makes it the focused side (official onPointerDownCapture / onFocusCapture).
  useEffect(() => {
    if (side !== 0 || !open) return undefined;
    const panes = [[primaryRef.current, 0], [slotRef.current, 1]].filter(([element]) => element);
    const handlers = panes.map(([element, index]) => {
      const take = () => store.focus(index);
      element.addEventListener("pointerdown", take, true);
      element.addEventListener("focusin", take);
      return () => { element.removeEventListener("pointerdown", take, true); element.removeEventListener("focusin", take); };
    });
    return () => handlers.forEach((remove) => remove());
  }, [side, open, store, split.slot]);
  // ⌘ (⌃ off macOS) held: data-cmd-held on the host draws the ring and move cursor over a side (official kR); a ⌘-drag
  // that starts inside one side and ends over the other swaps the two sides, as View › Split View › Move Split View
  // does (official RL: a press on a link, field, button or terminal is left alone; 4px before it counts as a drag; the
  // click that ends it is swallowed).
  const sideBySide = open && !split.tabs;
  useEffect(() => {
    const host = hostRef.current;
    if (side !== 0 || !host || !sideBySide) return undefined;
    const mac = /Mac/i.test(navigator.platform || navigator.userAgent || "");
    const altGraph = (event) => !mac && !!event.getModifierState?.("AltGraph");
    const held = (event) => (mac ? event.metaKey : event.ctrlKey);
    const keyDown = (event) => { if (!altGraph(event) && held(event)) host.setAttribute("data-cmd-held", ""); };
    const keyUp = (event) => { if (!held(event)) host.removeAttribute("data-cmd-held"); };
    const clearHeld = () => host.removeAttribute("data-cmd-held");
    const sideAt = (x) => { const rect = host.getBoundingClientRect(); return x < rect.left + rect.width * store.getState().ratio ? 0 : 1; };
    let cancel = null;
    const starts = [[primaryRef.current, 0], [slotRef.current, 1]].filter(([element]) => element).map(([element, index]) => {
      const start = (event) => {
        if (event.button !== 0 || altGraph(event) || !held(event) || event.target.closest?.(PANE_DRAG_IGNORED)) return;
        cancel?.();
        const pointer = event.pointerId, origin = { x: event.clientX, y: event.clientY };
        let dragging = false;
        const controller = new AbortController(), { signal } = controller;
        const finish = () => {
          controller.abort();
          host.removeAttribute("data-pane-dragging");
          setDrop((previous) => previous?.mode === "move" ? null : previous);
          cancel = null;
        };
        document.addEventListener("pointermove", (move) => {
          if (move.pointerId !== pointer) return;
          if (move.buttons === 0) { finish(); return; }
          if (!dragging) {
            if (Math.abs(move.clientX - origin.x) < PANE_DRAG_THRESHOLD && Math.abs(move.clientY - origin.y) < PANE_DRAG_THRESHOLD) return;
            dragging = true;
            host.setAttribute("data-pane-dragging", String(index));
          }
          const over = sideAt(move.clientX);
          setDrop((previous) => over === index ? (previous?.mode === "move" ? null : previous)
            : previous?.mode === "move" && previous.side === over ? previous : { side: over, mode: "move" });
        }, { signal });
        document.addEventListener("pointerup", (up) => {
          if (up.pointerId !== pointer) return;
          const moved = dragging && sideAt(up.clientX) !== index;
          finish();
          if (!dragging) return;
          const swallow = (click) => { click.preventDefault(); click.stopPropagation(); };
          document.addEventListener("click", swallow, { capture: true, once: true });
          setTimeout(() => document.removeEventListener("click", swallow, true), 0);
          if (moved) store.swap();
        }, { signal });
        document.addEventListener("pointercancel", (end) => { if (end.pointerId === pointer) finish(); }, { signal });
        document.addEventListener("selectstart", (select) => select.preventDefault(), { capture: true, signal });
        document.getSelection()?.removeAllRanges();
        cancel = finish;
      };
      element.addEventListener("pointerdown", start);
      return () => element.removeEventListener("pointerdown", start);
    });
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", clearHeld);
    return () => {
      starts.forEach((remove) => remove());
      cancel?.();
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", clearHeld);
      host.removeAttribute("data-cmd-held");
    };
  }, [side, sideBySide, store, split.slot]);
  // Drag a session row from the sidebar onto the session area: closed → open it on the right; open → show it in
  // the side it is dropped on (official canSplit / "Open in split view" drop indicator).
  useEffect(() => {
    const host = hostRef.current;
    if (side !== 0 || !host) return undefined;
    const carries = (event) => Array.from(event.dataTransfer?.types ?? []).includes(SESSION_DRAG_TYPE);
    const targetOf = (event) => {
      const rect = host.getBoundingClientRect(), state = store.getState();
      if (!state.open) return { side: 1, mode: "open" };
      const boundary = state.tabs ? rect.left + rect.width : rect.left + rect.width * state.ratio;
      return { side: state.tabs ? state.active : event.clientX < boundary ? 0 : 1, mode: "replace" };
    };
    const over = (event) => {
      if (!carries(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      const next = targetOf(event);
      setDrop((previous) => previous?.side === next.side && previous?.mode === next.mode ? previous : next);
    };
    const leave = (event) => { if (!host.contains(event.relatedTarget)) setDrop(null); };
    const dropped = (event) => {
      if (!carries(event)) return;
      event.preventDefault();
      const id = event.dataTransfer.getData(SESSION_DRAG_TYPE), target = targetOf(event);
      setDrop(null);
      if (!id) return;
      if (target.mode === "open") store.open(id);
      else if (store.sideShowing(id) !== null) store.focus(store.sideShowing(id), { move: true });
      else { store.focus(target.side); store.openInFocusedSide(id); }
    };
    const end = () => setDrop(null);
    host.addEventListener("dragenter", over);
    host.addEventListener("dragover", over);
    host.addEventListener("dragleave", leave);
    host.addEventListener("drop", dropped);
    window.addEventListener("dragend", end);
    return () => {
      host.removeEventListener("dragenter", over); host.removeEventListener("dragover", over);
      host.removeEventListener("dragleave", leave); host.removeEventListener("drop", dropped);
      window.removeEventListener("dragend", end);
    };
  }, [side, store]);
  if (side !== 0) return children;
  const tabs = open && split.tabs;
  const paneProps = (index) => ({
    id: ids.pane(index),
    role: open ? (tabs ? "tabpanel" : "region") : undefined,
    "aria-label": open && !tabs ? (index === 0 ? t("Primary pane") : t("Secondary pane")) : undefined,
    "aria-labelledby": tabs ? ids.tab(index) : undefined,
    "aria-current": open && !tabs && split.active === index ? "true" : undefined,
    "data-focused": open && split.active === index ? "" : undefined,
    "data-split-inactive": open && split.active !== index ? "" : undefined,
    hidden: tabs && split.active !== index ? true : undefined,
    style: open && !tabs ? { flexGrow: index === 0 ? split.ratio : 1 - split.ratio } : undefined,
  });
  return <div ref={hostRef} className="split-host" data-split={open || undefined} data-tabs={tabs || undefined}
    data-resizing={resizing || undefined} data-dropping={drop ? "" : undefined} data-pane-count={open ? 2 : 1}>
    {tabs && <SplitTabs split={split} store={store} ids={ids} chrome={chrome} />}
    <div className="split-row">
      <div ref={primaryRef} className="split-pane split-pane-primary" {...paneProps(0)}>{children}</div>
      {/* Each side closes itself from the end of its own titlebar (official Im epitaxy-pane-close-control; main.jsx
          passes SourceTitlebar onCloseSplit), so the divider carries only the resize handle. */}
      {open && !tabs && <div className="split-divider-slot">
        <SplitDivider ratio={split.ratio} hostRef={hostRef} store={store} onResizing={setResizing} />
      </div>}
      {open && <div ref={setSlot} className="split-pane split-pane-secondary" {...paneProps(1)} />}
    </div>
    {drop && <div className="split-drop-target" aria-hidden="true" data-side={drop.side} data-mode={drop.mode}
      style={drop.mode !== "open" && !tabs ? (drop.side === 0 ? { left: 0, width: `${split.ratio * 100}%` } : { left: `${split.ratio * 100}%`, right: 0 }) : undefined}>
      <span className="split-drop-label">{drop.mode === "open" ? t("Open in split view") : drop.mode === "move" ? t("Move here") : t("Open here")}</span>
    </div>}
  </div>;
}
