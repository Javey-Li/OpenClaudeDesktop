// Original adaptive selection/drawing toolbar. The host supplies CDS primitives,
// density and owner-window utilities; no tool, layout or discard logic is rewritten.
import {
  useState as e,
  useImperativeHandle as t,
  useEffect as n,
  useLayoutEffect as r,
  useRef as i,
  useCallback as s,
  useMemo as d,
  memo as u,
  Fragment as o,
} from "react";
import { jsx as a, jsxs as c } from "react/jsx-runtime";
export function createPreviewSketchToolbar({
  Button: w,
  Tooltip: S,
  Icon: se,
  Panel: ce,
  Menu: E,
  renderMenuItems: ie,
  ConfirmDialog: T,
  Provider: re,
  Message: de,
  useIntl: D,
  ownerWindow: te,
  asElement: y,
  schedule: x,
  prefersReducedMotion: b,
  ownerDocument: oe,
  useRem: le,
  densityToken: pe,
  resolveLength: C,
}) {
  const l = (...parts) => parts.filter(Boolean).join(" "),
    ue = (value) => value;
  function Ct() {
    return a("span", {
      role: "separator",
      "aria-orientation": "vertical",
      className: "h-4 w-px shrink-0 bg-border",
    });
  }
  const wt = {
    name: "Square",
    viewBox: 16,
    paths: [
      {
        d: "M4.25 3.5H11.75A0.75 0.75 0 0 1 12.5 4.25V11.75A0.75 0.75 0 0 1 11.75 12.5H4.25A0.75 0.75 0 0 1 3.5 11.75V4.25A0.75 0.75 0 0 1 4.25 3.5Z",
        strokeWidth: 1,
      },
    ],
  };
  const Tt = {
    name: "Circle",
    viewBox: 16,
    paths: [{ d: "M3 8A5 5 0 1 0 13 8A5 5 0 1 0 3 8Z", strokeWidth: 1 }],
  };
  const Et = ue({
    pen: { defaultMessage: "Pen", id: "3ODqMYj5Lf" },
    line: { defaultMessage: "Line", id: "QHhNtxVPGF" },
    arrow: { defaultMessage: "Arrow", id: "UTlLBbY88F" },
    rect: { defaultMessage: "Rectangle", id: "I1DHEXQk5F" },
    ellipse: { defaultMessage: "Ellipse", id: "Pq3xtXwwXq" },
    text: { defaultMessage: "Text", id: "zOU/9VFxRH" },
    redact: { defaultMessage: "Redact", id: "D2lWtfIKHl" },
  });
  const Dt = ue({
    solid: { defaultMessage: "Solid", id: "3Cgy3o7W7g" },
    mosaic: { defaultMessage: "Mosaic", id: "tCY2r7xLc5" },
    noise: { defaultMessage: "Noise", id: "8+LZ+1OdoH" },
  });
  const Ot = Object.keys(Dt);
  const kt = ue({
    "#E03131": { defaultMessage: "Red", id: "D+ZFS/jiQh" },
    "#1971C2": { defaultMessage: "Blue", id: "k2tJ9kFBBI" },
    "#2F9E44": { defaultMessage: "Green", id: "1W4okOthcu" },
    "#1F1E1D": { defaultMessage: "Black", id: "XjGbuYjsmF" },
    "#FFFFFF": { defaultMessage: "White", id: "OAG+sQmYha" },
  });
  const At = {
    pen: { icon: "Edit" },
    line: { icon: "LineSegment" },
    arrow: { icon: "ArrowLine" },
    rect: { customIcon: wt },
    ellipse: { customIcon: Tt },
    text: { icon: "TextT" },
    redact: { icon: "EyeSlash" },
  };
  const jt = Object.keys(At);
  const Mt = jt.filter((e) => e !== "redact");
  function Nt({ tool: e }) {
    let t = e === "select" ? { icon: "CursorFilled" } : At[e];
    return "icon" in t
      ? a(se, { name: t.icon, size: "sm" })
      : a(se, { customIcon: t.customIcon, size: "sm" });
  }
  function Pt({ tool: e, armed: t, disabled: n, onToolChange: r }) {
    let i = D();
    return a(w, {
      variant: "ghost",
      iconOnly: !0,
      icon: a(Nt, { tool: e }),
      "aria-label": i.formatMessage(Et[e]),
      pressed: t,
      disabled: n,
      onClick: () => r(t ? "select" : e),
    });
  }
  const Ft = a(se, { name: "Cursor", size: "sm" });
  function It(e) {
    if (e === "solid") return "#000000";
    let t = e === "mosaic" ? 3 : 7,
      n =
        e === "mosaic"
          ? ["#4a4a4a", "#bdbdbd", "#7c7c7c", "#a3a3a3", "#5e5e5e"]
          : ["#1e1e1e", "#e2e2e2", "#6a6a6a", "#b8b8b8", "#3c3c3c", "#8e8e8e"],
      r = 14 / t,
      i = "";
    for (let e = 0; e < t * t; e++) {
      let a = (e % t) * r,
        o = Math.floor(e / t) * r;
      i += `<rect x='${a}' y='${o}' width='${r}' height='${r}' fill='${n[(e * 7 + (e >> 2)) % n.length]}'/>`;
    }
    let a = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'>${i}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(a)}") 0 0 / cover`;
  }
  const Lt = { solid: It("solid"), mosaic: It("mosaic"), noise: It("noise") };
  const Rt = new Set(["#1F1E1D", "#FFFFFF", Lt.solid]);
  function zt({ fill: e, active: t, square: n }) {
    return a("span", {
      "aria-hidden": !0,
      className: l(
        "block h-3.5 w-3.5 transition-shadow group-hover/swatch:shadow-[0_0_0_1px_var(--cds-text-secondary)]",
        n ? "rounded-[3px]" : "rounded-full",
        t
          ? "shadow-[0_0_0_2px_var(--cds-text-primary)]"
          : Rt.has(e)
            ? "shadow-[0_0_0_1px_var(--cds-alpha-5)]"
            : "shadow-[0_0_0_1px_var(--cds-alpha-3)]",
      ),
      style: { background: e },
    });
  }
  const Bt = 300;
  const Vt = 350;
  function Ht(t, r) {
    let [a, o] = e(!1),
      [s, c] = e(!1),
      [l, u] = e(!1),
      d = t !== void 0,
      f = d && (a || s);
    (!d && (a || s) && (o(!1), c(!1)), !f && l && u(!1));
    let p = i(null),
      m = i(null);
    n(
      () => () => {
        (p.current?.cancel(), m.current?.cancel());
      },
      [d],
    );
    let h = (e) => {
        let n = r.current;
        n?.hasAttribute("data-resting") &&
          ((e === "hover" ? o : c)(!0),
          !n.hasAttribute("data-revealed") &&
            (m.current?.cancel(),
            (m.current = x(n, () => u(!0), Vt)),
            b(oe(n)) || t?.onRevealed?.(e)));
      },
      g = (e, t) => {
        e.pointerType !== "touch" &&
          (p.current?.cancel(),
          (p.current = x(
            r.current ?? void 0,
            () => (t ? h("hover") : o(!1)),
            Bt,
          )));
      };
    return {
      revealed: f,
      guardOver: l,
      barProps: d
        ? {
            onPointerEnter: (e) => g(e, !0),
            onPointerLeave: (e) => g(e, !1),
            onPointerDownCapture: () => p.current?.cancel(),
            onFocusCapture: (e) => {
              !s && y(e.target)?.matches(":focus-visible") && h("focus");
            },
            onBlurCapture: (e) => {
              e.currentTarget.contains(y(e.relatedTarget)) || c(!1);
            },
          }
        : void 0,
    };
  }
  function Ut({ label: e, onHide: t, zoom: n }) {
    let r = D();
    return c(o, {
      children: [
        a(Ct, {}),
        n !== void 0 &&
          c(o, {
            children: [
              c("div", {
                className: "flex items-center",
                children: [
                  a(w, {
                    variant: "ghost",
                    iconOnly: !0,
                    icon: "ZoomOut",
                    "aria-label": r.formatMessage({
                      defaultMessage: "Zoom out",
                      id: "/UnJ3SDiCO",
                    }),
                    disabled: !n.canZoomOut,
                    onClick: n.onZoomOut,
                  }),
                  a(w, {
                    variant: "ghost",
                    iconOnly: !0,
                    icon: "ZoomIn",
                    "aria-label": r.formatMessage({
                      defaultMessage: "Zoom in",
                      id: "xbi38cl5pP",
                    }),
                    disabled: !n.canZoomIn,
                    onClick: n.onZoomIn,
                  }),
                ],
              }),
              a(Ct, {}),
            ],
          }),
        a(w, {
          variant: "ghost",
          iconOnly: !0,
          icon: "X",
          "aria-label": e,
          onClick: t,
        }),
      ],
    });
  }
  function Wt({
    tool: n,
    onToolChange: u,
    leadingTool: f,
    toolsDisabled: p = !1,
    resting: m,
    colors: h,
    color: g,
    onColorChange: _,
    redactEnabled: v,
    redactStyle: ee,
    onRedactStyleChange: ne,
    redactionSelected: b,
    hasStrokes: x,
    canUndo: ae,
    canRedo: oe,
    onUndo: se,
    onRedo: ue,
    undoShortcut: fe,
    redoShortcut: O,
    onClear: k,
    onClose: A,
    positiveAction: j,
    positiveActionIconOnly: me,
    handleRef: M,
    concealed: he = !1,
    className: N,
    defaultOpenMenu: ge,
  }) {
    let P = D(),
      F = i(null),
      _e = i(null),
      ve = i(null),
      I = i(null),
      [L, R] = e("full"),
      z = L !== "full",
      ye = me !== void 0,
      be = i(0),
      xe = i(0),
      [B, V] = e(!1),
      H = s(() => {
        if (x) {
          V(!0);
          return;
        }
        A();
      }, [x, A]),
      Se = s(() => {
        (V(!1), A());
      }, [A]),
      Ce = s(() => V(!1), []);
    t(M, () => ({ requestClose: H }), [H]);
    let we = i(null),
      [U, Te] = e(!1),
      Ee = s((e) => {
        ((we.current = y(e.target)), Te(!0));
      }, []),
      W = s((e) => {
        e.currentTarget.contains(y(e.relatedTarget)) || Te(!1);
      }, []),
      De = Ht(z ? void 0 : m, _e);
    r(() => {
      let e = we.current,
        t = e?.isConnected === !1 && U;
      if (!e || !(t || e.matches(":disabled"))) return;
      we.current = null;
      let n = e.ownerDocument,
        r = n.activeElement;
      if (r === e || r === n.body || r === null) {
        let n = t ? _e.current : e.parentElement;
        (y(n?.closest("[tabindex]"))?.focus({ preventScroll: !0 }),
          t && Te(!1));
      }
    }, [ae, oe, x, L, U]);
    let G = s(() => {
      let e = F.current,
        t = _e.current,
        n = ve.current;
      if (!e || !t || !n) return;
      if (t.dataset.layout === "full") {
        let e = I.current,
          t = e?.parentElement?.offsetWidth ?? 0;
        be.current = n.offsetWidth + Math.max(0, (e?.scrollWidth ?? 0) - t);
      } else t.dataset.layout === "compact" && (xe.current = n.offsetWidth);
      let r = e.clientWidth;
      be.current <= r
        ? R("full")
        : !ye || xe.current <= r
          ? R("compact")
          : R("minimal");
    }, [ye]);
    (r(() => {
      let e = F.current,
        t = ve.current;
      if (!e || !t) return;
      let n = new (te(e).ResizeObserver)(G);
      return (n.observe(e), n.observe(t), () => n.disconnect());
    }, [G]),
      r(() => {
        G();
      }, [L, G]));
    let K = m !== void 0,
      Oe = i(K);
    r(() => {
      Oe.current !== K &&
        ((Oe.current = K), (be.current = 0), (xe.current = 0), G());
    }, [K, G]);
    let ke = v ? jt : Mt,
      Ae = d(() => {
        let e = ke.map((e) => ({
          leading: a(Nt, { tool: e }),
          label: P.formatMessage(Et[e]),
          checked: e === n,
          checkedRole: "checkbox",
          disabled: p,
          onSelect: () => u(e === n ? "select" : e),
        }));
        return f
          ? [
              {
                leading: Ft,
                label: f.label,
                checked: f.pressed,
                checkedRole: "checkbox",
                onSelect: f.onPress,
              },
              ...e,
            ]
          : e;
      }, [P, ke, n, u, f, p]),
      q = v && (n === "redact" || b),
      je = d(
        () =>
          q
            ? Ot.map((e) => ({
                key: e,
                label: P.formatMessage(Dt[e]),
                fill: Lt[e],
                active: e === ee,
                onPick: () => ne(e),
              }))
            : h.map((e) => ({
                key: e,
                label: P.formatMessage(kt[e]),
                fill: e,
                active: e === g,
                onPick: () => _(e),
              })),
        [P, q, ee, ne, h, g, _],
      ),
      Me = d(
        () =>
          je.map((e) => ({
            leading: a(zt, { fill: e.fill, square: q }),
            label: e.label,
            checked: e.active,
            checkedRole: "radio",
            onSelect: e.onPick,
          })),
        [je, q],
      ),
      J = f?.pressed ?? !1,
      Ne = d(() => (J ? Ft : a(Nt, { tool: n })), [n, J]),
      Pe = d(
        () => (q ? a(zt, { fill: Lt[ee], square: !0 }) : a(zt, { fill: g })),
        [q, ee, g],
      ),
      Fe = P.formatMessage({
        defaultMessage: "Annotation tool",
        id: "nUFJ0sE5c9",
      }),
      Ie = P.formatMessage({ defaultMessage: "Ink color", id: "k+yLsrlkhB" }),
      Le = P.formatMessage({
        defaultMessage: "Redaction style",
        id: "tBKdfPJtGX",
      }),
      Y = q ? Le : Ie,
      Re = le(),
      ze = 4 + (C(pe("h-control"), Re) - 0.875 * Re) / 2,
      Be = P.formatMessage({ defaultMessage: "Undo", id: "JkS37H8PlA" }),
      Ve = P.formatMessage({
        defaultMessage: "Nothing to undo yet",
        id: "XFpgi7xuL0",
      }),
      He = P.formatMessage({ defaultMessage: "Redo", id: "3XyF4dAMbz" }),
      Ue = P.formatMessage({
        defaultMessage: "Nothing to redo yet",
        id: "jZhy9dr1Lm",
      }),
      X = P.formatMessage({ defaultMessage: "Clear all", id: "QW+Q5NHmeF" }),
      We = P.formatMessage({
        defaultMessage: "Hide annotation tools",
        id: "xZ87eA5X6R",
      }),
      Ge = P.formatMessage({ defaultMessage: "Close", id: "rbrahOGMC3" }),
      Ke = P.formatMessage({
        defaultMessage: "Nothing to clear yet",
        id: "ZRQqPcheUz",
      }),
      qe = ke.map((e) =>
        a(Pt, { tool: e, armed: e === n, disabled: p, onToolChange: u }, e),
      ),
      Je = qe.slice(0, 1),
      Ye = qe.slice(1);
    return c("div", {
      ref: F,
      className: l(
        "pointer-events-none absolute inset-x-2.5 flex justify-center",
        N,
      ),
      children: [
        a(re, {
          children: a(ce, {
            ref: _e,
            "data-layout": L,
            "data-resting": m ? "" : void 0,
            "data-revealed": De.revealed ? "" : void 0,
            "data-concealed": he || void 0,
            inert: he && !U,
            elevation: "panel",
            onFocus: Ee,
            onBlur: W,
            ...De.barProps,
            className: l(
              "w-max max-w-full transition-opacity ease-snap motion-reduce:transition-none",
              he
                ? "pointer-events-none opacity-0 duration-fast"
                : "pointer-events-auto duration-snap",
            ),
            children: c("div", {
              ref: ve,
              className: "flex w-max items-center gap-xs px-sm py-xs",
              children: [
                z
                  ? c(o, {
                      children: [
                        c(E.Root, {
                          open: ge === "tool" || void 0,
                          children: [
                            a(S, {
                              content: Fe,
                              hoverable: !1,
                              children: a(E.TriggerButton, {
                                variant: "ghost",
                                "aria-label": Fe,
                                children: Ne,
                              }),
                            }),
                            a(E.Popup, {
                              side: "top",
                              align: "start",
                              children: ie(Ae),
                            }),
                          ],
                        }),
                        !m &&
                          c(E.Root, {
                            open: ge === "color" || void 0,
                            children: [
                              a(S, {
                                content: Y,
                                hoverable: !1,
                                children: a(E.TriggerButton, {
                                  variant: "ghost",
                                  "aria-label": Y,
                                  children: Pe,
                                }),
                              }),
                              a(E.Popup, {
                                side: "top",
                                align: "start",
                                children: ie(Me),
                              }),
                            ],
                          }),
                      ],
                    })
                  : c(o, {
                      children: [
                        c("div", {
                          role: "group",
                          "aria-label": Fe,
                          className: "flex items-center gap-xs",
                          children: [
                            f &&
                              a(S, {
                                content: f.label,
                                detail: f.detail,
                                shortcut: f.shortcut,
                                hoverable: !1,
                                children: a(w, {
                                  variant: "ghost",
                                  iconOnly: !0,
                                  icon: Ft,
                                  "aria-label": f.label,
                                  shortcut: f.shortcut,
                                  pressed: f.pressed,
                                  onClick: f.onPress,
                                }),
                              }),
                            Je,
                            a("div", {
                              className: m
                                ? l(
                                    "-ms-xs grid transition-[grid-template-columns] duration-base ease-out motion-reduce:transition-none touch:grid-cols-[minmax(0,1fr)]",
                                    De.revealed
                                      ? "grid-cols-[minmax(0,1fr)]"
                                      : "grid-cols-[minmax(0,0fr)]",
                                  )
                                : "contents",
                              children: c("div", {
                                ref: I,
                                "data-more-tools": !0,
                                className: m
                                  ? l(
                                      "flex min-w-0 items-center gap-xs touch:pointer-events-auto",
                                      !(De.revealed && De.guardOver) &&
                                        "pointer-events-none overflow-x-clip",
                                    )
                                  : "contents",
                                children: [
                                  a("span", {
                                    "aria-hidden": !0,
                                    className: m ? "w-0" : "hidden",
                                  }),
                                  Ye,
                                ],
                              }),
                            }),
                          ],
                        }),
                        !m &&
                          c(o, {
                            children: [
                              a(Ct, {}),
                              a("div", {
                                role: "group",
                                "aria-label": Y,
                                className: "flex items-center gap-xs px-xs",
                                children: je.map((e) =>
                                  a(
                                    S,
                                    {
                                      content: e.label,
                                      hoverable: !1,
                                      sideOffset: ze,
                                      children: a("button", {
                                        type: "button",
                                        "aria-label": e.label,
                                        "aria-pressed": e.active,
                                        onClick: e.onPick,
                                        className: l(
                                          "group/swatch focus-visible:outline-hidden focus-visible:shadow-focus",
                                          q ? "rounded-[3px]" : "rounded-full",
                                        ),
                                        children: a(zt, {
                                          fill: e.fill,
                                          active: e.active,
                                          square: q,
                                        }),
                                      }),
                                    },
                                    e.key,
                                  ),
                                ),
                              }),
                            ],
                          }),
                      ],
                    }),
                m
                  ? a(Ut, { label: We, onHide: m.onHide, zoom: m.zoom })
                  : c(o, {
                      children: [
                        a(Ct, {}),
                        c("div", {
                          className: "flex items-center",
                          children: [
                            a(w, {
                              variant: "ghost",
                              iconOnly: !0,
                              icon: "ArrowCounterClockwise",
                              "aria-label": Be,
                              shortcut: fe,
                              disabled: !ae,
                              disabledReason: Ve,
                              onClick: se,
                            }),
                            a(w, {
                              variant: "ghost",
                              iconOnly: !0,
                              icon: "ArrowClockwise",
                              "aria-label": He,
                              shortcut: O,
                              disabled: !oe,
                              disabledReason: Ue,
                              onClick: ue,
                            }),
                            a(w, {
                              variant: "ghost",
                              iconOnly: !0,
                              icon: "Trash",
                              "aria-label": X,
                              disabled: !x,
                              disabledReason: Ke,
                              onClick: k,
                            }),
                          ],
                        }),
                        z
                          ? a(w, {
                              variant: "ghost",
                              iconOnly: !0,
                              icon: "X",
                              "aria-label": Ge,
                              onClick: H,
                            })
                          : a(w, {
                              variant: "ghost",
                              onClick: H,
                              children: Ge,
                            }),
                        L === "minimal" ? me : j,
                      ],
                    }),
              ],
            }),
          }),
        }),
        a(T, {
          initialFocus: "cancel",
          open: B,
          onOpenChange: Ce,
          onConfirm: Se,
          confirmVariant: "danger",
          title: a(de, {
            defaultMessage: "Discard your annotations?",
            id: "MfFrIX0mxC",
          }),
          description: a(de, {
            defaultMessage:
              "You have unsaved marks on this image. Discarding removes them.",
            id: "WrH605g8o7",
          }),
          confirmLabel: a(de, { defaultMessage: "Discard", id: "nmpevlUATU" }),
          cancelLabel: a(de, {
            defaultMessage: "Keep editing",
            id: "nZCHBxEAlK",
          }),
        }),
      ],
    });
  }
  const Gt = u(Wt);
  const Jt = ["#E03131", "#1971C2", "#2F9E44", "#1F1E1D", "#FFFFFF"];
  return { Toolbar: Gt, colors: Jt };
}
