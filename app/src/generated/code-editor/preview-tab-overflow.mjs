// Original shared tab overflow row, size tokens and typeahead-reset keys.
import { useCallback as c } from "react";
import { jsx as s, jsxs as l } from "react/jsx-runtime";
export function createPreviewOverflowRow({
  Item,
  Icon: T,
  OverflowTooltip: C,
}) {
  const O = { Item },
    d = (...values) => values.filter(Boolean).join(" "),
    N = ({ children }) => children,
    x = () => ({});
  const F = new Set([
    "ArrowUp",
    "ArrowDown",
    "Home",
    "End",
    "ArrowRight",
    "Delete",
  ]);
  function I({
    tab: e,
    hintIds: t,
    closeLabel: n,
    previewHint: r,
    deletedHint: i,
    onActivate: a,
    onClose: o,
    sizes: u,
  }) {
    let f = e.closable !== !1,
      p = c(() => a(e.id), [a, e.id]),
      m = c(() => o(e.id), [o, e.id]),
      h = c(
        (e) => {
          if (
            f &&
            (e.key === "ArrowRight" ||
              e.key === "Delete" ||
              e.key === "Backspace")
          ) {
            if ((e.preventDefault(), e.stopPropagation(), e.repeat)) return;
            m();
          }
        },
        [f, m],
      ),
      g = c(
        (e) => {
          f && e.button === 1 && e.preventDefault();
        },
        [f],
      ),
      _ = c(
        (e) => {
          f && e.button === 1 && (e.preventDefault(), m());
        },
        [f, m],
      );
    return s(O.Item, {
      onClick: p,
      onKeyDown: h,
      onMouseDown: g,
      onMouseUp: g,
      onAuxClick: _,
      "aria-describedby": f ? t : void 0,
      className: "gap-sm",
      leading:
        e.icon === void 0
          ? void 0
          : s("span", {
              "aria-hidden": !0,
              className: d("grid place-items-center", u.leadBox),
              children: s(N, { value: u.leadGlyph, children: e.icon }),
            }),
      trailing: f
        ? s("span", {
            "aria-hidden": !0,
            title: n,
            onClick: (e) => {
              (e.stopPropagation(), m());
            },
            onPointerDown: (e) => e.stopPropagation(),
            ...x(u.closeSize),
            className: d(
              "grid shrink-0 cursor-interactive place-items-center rounded-sm text-muted hover:bg-fill-ghost-hover hover:text-primary",
              u.closeBox,
              u.closeInMenuRow,
            ),
            children: s(T, { name: "X", size: u.closeGlyph }),
          })
        : void 0,
      children: l("span", {
        className: "flex min-w-0 flex-col",
        children: [
          l("span", {
            className: d(
              "text-body",
              e.preview && "italic",
              e.deleted && "line-through",
            ),
            children: [
              s(C, { delay: 700, hoverable: !1, children: e.label }),
              e.status !== void 0 &&
                s("span", { className: "sr-only", children: `, ${e.status}` }),
              e.preview &&
                s("span", { className: "sr-only", children: `, ${r}` }),
              e.deleted &&
                s("span", { className: "sr-only", children: `, ${i}` }),
            ],
          }),
          e.detail !== void 0 &&
            s("span", {
              className: "text-caption text-muted",
              children: s(C, { delay: 700, hoverable: !1, children: e.detail }),
            }),
        ],
      }),
    });
  }
  const oe = {
    floorClass: "min-w-[calc(1.25rem*var(--cds-rem-scale,1)_+_4px)]",
    floor: "calc(1.25rem * var(--cds-rem-scale, 1) + 4px)",
    height: "h-[calc(1.5rem*var(--cds-rem-scale,1))]",
    basis: "basis-[192px]",
    pad: "p-[2px]",
    leadBox: "size-[calc(1.25rem*var(--cds-rem-scale,1))]",
    leadGap: "gap-[2px]",
    tabWithIcon: "min-w-[22px]",
    tabNoIcon: "min-w-[6px] pl-[6px]",
    tabIconShed: "min-w-0 pl-[2px]",
    tabEndBare: "",
    closeSize: void 0,
    closeBox: "size-[calc(1.25rem*var(--cds-rem-scale,1))]",
    closeGlyph: "xs",
    closeInMenuRow: "",
    leadGlyph: "xs",
    list: "",
    tabGapPx: 4,
    extraChromePx: 0,
  };
  return { Row: I, sizes: oe, typeaheadResetKeys: F };
}
