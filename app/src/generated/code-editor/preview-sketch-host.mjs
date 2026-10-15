// Original Preview sketch host, mode switch, focus, export and toolbar composition.
import {
  useState as e,
  useImperativeHandle as t,
  useEffect as n,
  useEffectEvent as r,
  useLayoutEffect as i,
  useRef as a,
  useCallback as s,
  useMemo as ee,
  memo as u,
} from "react";
import { jsx as o, jsxs as c } from "react/jsx-runtime";
export function createPreviewSketchHost({
  usePlatform: te,
  isTextInput: re,
  isApplication: ne,
  popupSelector: f,
  hasOtherEscapeOwner: ce,
  openPopupSelector: le,
  asElement: m,
  ownerWindow: ae,
  suppressContextMenu: p,
  releaseEscape: ie,
  DisabledReasonTooltip: h,
  Button: g,
  useIntl: se,
  useErrors: oe,
  Toolbar: ue,
  useSketch: de,
  colors: fe,
  Canvas: pe,
}) {
  const l = (...parts) => parts.filter(Boolean).join(" "),
    d = "data-escape-owner",
    me = "#1F1E1D";
  const he = (() => {
    function l(e) {
      return { width: e.pixelWidth / e.dpr, height: e.pixelHeight / e.dpr };
    }
    return l;
  })();
  var ge = "bottom-2.5",
    _ = "--sketch-bar-reach",
    v = "--sketch-bar-drop",
    _e =
      "top-[calc(100%+var(--sketch-bar-drop,0px))] mt-2.5 -mx-[var(--sketch-bar-reach,0px)]",
    y = "h-[calc(var(--cds-h-control)+var(--cds-pad-xs)*2+1.25rem)]",
    b = "pb-[calc(var(--cds-h-control)+var(--cds-pad-xs)*2+1.25rem)]",
    ve = `${f},[${d}]`,
    ye = { [d]: "" };
  function be(e) {
    return e.isComposing || e.keyCode === 229;
  }
  function xe(e) {
    return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
  }
  function x({
    backdrop: u,
    onCancel: d,
    onAttach: f,
    scopeTokens: p = !1,
    source: _,
    pageTool: v,
    barUnder: y = !1,
    rescaleOnResize: b = !1,
    attachHeld: x,
    focusHandoverRef: S,
    ref: C,
  }) {
    let [w, T] = e(null),
      E = v?.picking ?? !1,
      D = v?.resting !== void 0,
      O = E || D;
    O && w !== null && T(null);
    let k = O ? void 0 : w ? w.backdrop : u,
      A = k?.src ?? null,
      j = k?.pixelWidth === void 0 ? null : he(k),
      M = j === null,
      N = a(null),
      P = a(null),
      F = s(() => {
        let e = ae(N.current);
        (e && ie(e), P.current?.requestClose());
      }, []),
      {
        canvasRef: Ce,
        redactEnabled: we,
        tool: I,
        setTool: L,
        color: R,
        redactStyle: z,
        handleRedactStyleChange: Te,
        redactionSelected: Ee,
        handleSelectionChange: De,
        hasStrokes: B,
        canUndo: Oe,
        canRedo: ke,
        handleHistoryChange: V,
        gestureActive: Ae,
        handleGestureActiveChange: je,
        handleUndo: Me,
        handleRedo: Ne,
        handleKeyDown: Pe,
        undoShortcut: Fe,
        redoShortcut: Ie,
        handleClear: Le,
        handleToolDone: Re,
        handleColorChange: ze,
        exportSketch: H,
        cancel: U,
        textTargets: Be,
        handleTextTargetRedacted: Ve,
        textRedactionCount: W,
      } = de(
        F,
        _,
        A
          ? {
              url: A,
              host: "preview",
              scale: k?.pixelWidth === void 0 ? void 0 : k.dpr,
            }
          : void 0,
      );
    O && I === "select" && L("pen");
    let He = s(
        (e) => {
          (V(e), e.count > 0 && u !== void 0 && T((e) => e ?? { backdrop: u }));
        },
        [V, u],
      ),
      G = !O;
    (t(
      C,
      () => ({
        hasMarks: () => G && B,
        requestClose: () => P.current?.requestClose(),
      }),
      [G, B],
    ),
      n(() => {
        let e = N.current;
        G &&
          e &&
          !e.contains(e.ownerDocument.activeElement) &&
          e.focus({ preventScroll: !0 });
      }, [G]));
    let K = a(null),
      Ue = r(() => {
        !D ||
          v?.mayTakeFocus?.() === !1 ||
          queueMicrotask(() => {
            let e = N.current,
              t = e?.ownerDocument.activeElement;
            e &&
              (t === null || t === e.ownerDocument.body) &&
              e
                .querySelector("[data-resting] button:not(:disabled)")
                ?.focus({ preventScroll: !0 });
          });
      });
    (i(
      () => (
        S.current && Ue(),
        (S.current = !1),
        () => {
          let e = K.current;
          S.current = e !== null && e === e.ownerDocument.activeElement;
        }
      ),
      [S],
    ),
      n(() => {
        G || U();
      }, [G, U]),
      n(() => {
        let e = N.current,
          t = e?.ownerDocument;
        if (!e || !t || !G) return;
        let n = (n) => {
          if (n.key !== "Escape" || n.defaultPrevented || be(n) || xe(n))
            return;
          let r = m(n.target);
          if (r && (e.contains(r) || re(r) || ne(r) || r.closest(ve) !== null))
            return;
          let i = e.closest("[data-pane-root]"),
            a =
              r === null ||
              r === t.body ||
              r === t.documentElement ||
              (i !== null && i.contains(r)),
            o = i ? ce(i, e) : t.querySelector(le) !== null;
          !a || o || (n.preventDefault(), n.stopPropagation(), n.repeat || F());
        };
        return (
          t.addEventListener("keydown", n, !0),
          () => t.removeEventListener("keydown", n, !0)
        );
      }, [F, G]));
    let q = se(),
      J = oe(),
      Y = s(async () => {
        let e = q.formatMessage({
            defaultMessage: "Couldn\u2019t save your annotations. Try again.",
            id: "VRJcpQWzaV",
          }),
          t = !1,
          n;
        try {
          n = await H(async (e) => {
            let n;
            return (
              A
                ? (n = await e.toComposite(A))
                : ((n = e.toPNG("#ffffff")),
                  e
                    .getStrokes()
                    .some(
                      (e) => e.kind !== "redact" && e.color === "#FFFFFF",
                    ) && (n = e.toPNG(me))),
              (t = e.getStrokes().length > 0),
              !t && A?.startsWith("data:image/png") ? A : n
            );
          });
        } catch (t) {
          J?.addError(e, {
            error: t,
            messageForLogging: "Preview annotation composite failed",
          });
          return;
        }
        if (n !== null) {
          if (!n.startsWith("data:") || (t && n === A)) {
            J?.addError(e, {
              messageForLogging: "Preview annotation composite fail-safe",
            });
            return;
          }
          f(n, { annotated: t, textRedactions: W() });
        }
      }, [A, f, H, J, q, W]),
      We = s(() => {
        (U(), d());
      }, [U, d]),
      X = v?.onDraw,
      Ge = s(
        (e) => {
          (L(e), X?.());
        },
        [L, X],
      ),
      Ke = ee(
        () =>
          v?.label === void 0
            ? void 0
            : {
                label: v.label,
                detail: v.detail,
                shortcut: v.shortcut,
                pressed: v.picking,
                onPress: v.onTogglePick,
              },
        [v],
      ),
      Z = q.formatMessage({ defaultMessage: "Add to chat", id: "oBu4r1Zt46" }),
      qe = !G || (!B && A === null),
      Je = qe || x !== void 0,
      Q = E
        ? q.formatMessage({
            defaultMessage: "Click an element on the page to add it.",
            id: "ORl9wEfAbK",
          })
        : qe
          ? q.formatMessage({
              defaultMessage: "Nothing to add yet",
              id: "gW2ifrLbxu",
            })
          : x,
      Ye = o(g, {
        variant: "primary",
        disabled: Je,
        onClick: () => void Y(),
        children: Z,
      }),
      Xe = o(g, {
        variant: "primary",
        iconOnly: !0,
        icon: "Add",
        "aria-label": Z,
        disabled: Je,
        onClick: () => void Y(),
      }),
      Ze = te();
    return c("div", {
      ref: N,
      ...(G ? ye : void 0),
      tabIndex: -1,
      onFocus: (e) => {
        let t = m(e.target);
        K.current = t?.matches(":focus-visible") ? t : null;
      },
      onBlur: () => {
        K.current = null;
      },
      onKeyDown: G ? Pe : void 0,
      onContextMenu: Ze ? Se : void 0,
      className: l(
        "absolute inset-0 outline-none draggable-none",
        p && "epitaxy-root text-body text-primary break-words",
        O && "pointer-events-none",
      ),
      children: [
        k === null && o("div", { className: "absolute inset-0 bg-surface-3" }),
        k !== void 0 &&
          o("div", {
            className:
              "absolute inset-0 flex items-start justify-center-safe overflow-clip",
            children: c("div", {
              className: l("relative", j ? "shrink-0" : "h-full w-full"),
              style: j ?? void 0,
              children: [
                k &&
                  o("img", {
                    src: k.src,
                    alt: "",
                    draggable: !1,
                    className: l(
                      "absolute inset-0 h-full w-full max-w-none select-none pointer-events-none",
                      M && "object-cover object-left-top",
                    ),
                  }),
                o(pe, {
                  ref: Ce,
                  className: "absolute inset-0 h-full w-full",
                  tool: I,
                  color: R,
                  redactStyle: z,
                  textTargets: Be,
                  onTextTargetRedacted: Ve,
                  onSelectionChange: De,
                  backdropCover: M,
                  rescaleOnResize: b,
                  strokeWidth: 4,
                  onHistoryChange: He,
                  onToolDone: Re,
                  onGestureActiveChange: je,
                }),
              ],
            }),
          }),
        o(ue, {
          className: y ? _e : ge,
          tool: G ? I : "select",
          onToolChange: G ? L : Ge,
          leadingTool: Ke,
          toolsDisabled: O && v?.canDraw === !1,
          resting: v?.resting,
          colors: fe,
          color: R,
          onColorChange: ze,
          redactEnabled: we,
          redactStyle: z,
          onRedactStyleChange: Te,
          redactionSelected: Ee,
          hasStrokes: G && B,
          canUndo: G && Oe,
          canRedo: G && ke,
          onUndo: Me,
          onRedo: Ne,
          undoShortcut: Fe,
          redoShortcut: Ie,
          onClear: Le,
          onClose: We,
          handleRef: P,
          concealed: G && Ae,
          positiveAction: o(h, { hoverable: !1, reason: Q, children: Ye }),
          positiveActionIconOnly: o(h, {
            hoverable: !1,
            reason: Q,
            children: Xe,
          }),
        }),
      ],
    });
  }
  function Se(e) {
    p(e, e.currentTarget) && e.preventDefault();
  }
  function S({ layerKey: e, ...t }) {
    let n = a(!1);
    return o(x, { ...t, focusHandoverRef: n }, e);
  }
  var C = u(S);
  return C;
}
