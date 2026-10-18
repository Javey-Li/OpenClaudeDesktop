// Original state, history commands and export generation gate. OCR is a host capability.
import { useState as e, useRef as i, useCallback as s } from "react";
export function createPreviewSketchState({
  usePlatform: f,
  useRedaction: m,
  skipTextDetection: p,
  useTextTargets: qt,
  asElement: y,
  isTextInput: h,
  matchCommand: g,
  shortcut: _,
}) {
  var Jt = ["#E03131", "#1971C2", "#2F9E44", "#1F1E1D", "#FFFFFF"];
  var Yt = "#1F1E1D";
  var Xt = "#FFFFFF";
  var Zt = Jt[0];
  var Qt = [
    "sketchUndo",
    "sketchRedo",
    "sketchDeleteSelection",
    "sketchDeselect",
  ];
  var $t = { count: 0, canUndo: !1, canRedo: !1 };
  function en(t, n, r) {
    let a = f(),
      o = i(null),
      [c, l] = e("pen"),
      u = m(n),
      d = !u && c === "redact" ? "pen" : c,
      [v, ee] = e(() => Zt),
      [te, ne] = e("solid"),
      [re, ie] = e(null),
      [b, x] = e($t),
      [ae, S] = e(!1),
      oe = i(0),
      {
        textTargets: se,
        handleTextTargetRedacted: C,
        textRedactionCount: w,
        resetTextRedactionCount: T,
      } = qt(p("__gb__2978899829") ? void 0 : r, d === "redact"),
      ce = s(() => {
        o.current?.undo();
      }, []),
      E = s(() => {
        o.current?.redo();
      }, []),
      le = s(
        (e) => {
          let n = y(e.target);
          if (e.defaultPrevented || !n || h(n)) return;
          let r = g(e, { isClaudeApp: a, commands: Qt }),
            i = e.currentTarget,
            s = n.closest(
              '[role="dialog"], [role="alertdialog"], [role="menu"]',
            ),
            c = !i.contains(n) || (s !== null && s !== i && i.contains(s));
          if (r === null) {
            t &&
              e.key === "Escape" &&
              !c &&
              !e.nativeEvent.isComposing &&
              e.keyCode !== 229 &&
              (e.preventDefault(), e.stopPropagation());
            return;
          }
          if (r === "sketchDeleteSelection" || r === "sketchDeselect") {
            if (c) return;
            (
              r === "sketchDeleteSelection"
                ? o.current?.deleteSelection()
                : o.current?.clearSelection()
            )
              ? (e.preventDefault(),
                e.stopPropagation(),
                e.preventBaseUIHandler?.(),
                e.nativeEvent.stopImmediatePropagation())
              : r === "sketchDeselect" &&
                t &&
                (e.preventDefault(), e.stopPropagation(), e.repeat || t());
            return;
          }
          (e.preventDefault(),
            e.stopPropagation(),
            !c &&
              (r === "sketchUndo" && b.canUndo
                ? o.current?.undo()
                : r === "sketchRedo" && b.canRedo && o.current?.redo()));
        },
        [a, b.canUndo, b.canRedo, t],
      ),
      ue = s(() => {
        o.current?.clear();
      }, []),
      de = s(() => {
        l("select");
      }, []),
      D = s((e) => {
        ((Zt = e), ee(e), o.current?.recolorSelection(e));
      }, []),
      fe = s((e) => {
        (ne(e), o.current?.restyleSelection(e));
      }, []),
      O = s((e) => {
        (ie(e?.kind ?? null),
          e?.kind === "redact" && ne(e.redactStyle ?? "solid"));
      }, []),
      pe = s(async (e) => {
        let t = o.current;
        if (!t) return null;
        let n = ++oe.current,
          r = await e(t);
        return oe.current === n ? r : null;
      }, []),
      k = s(() => {
        (oe.current++, T());
      }, [T]);
    return {
      canvasRef: o,
      redactEnabled: u,
      textTargets: se,
      handleTextTargetRedacted: C,
      textRedactionCount: w,
      tool: d,
      setTool: l,
      color: v,
      redactStyle: te,
      handleRedactStyleChange: fe,
      redactionSelected: re === "redact" && d === "select",
      handleSelectionChange: O,
      hasStrokes: b.count > 0,
      canUndo: b.canUndo,
      canRedo: b.canRedo,
      handleHistoryChange: x,
      gestureActive: ae,
      handleGestureActiveChange: S,
      handleUndo: ce,
      handleRedo: E,
      handleKeyDown: le,
      undoShortcut: _("sketchUndo", a),
      redoShortcut: _("sketchRedo", a),
      handleClear: ue,
      handleToolDone: de,
      handleColorChange: D,
      exportSketch: pe,
      cancel: k,
    };
  }
  return en;
}
