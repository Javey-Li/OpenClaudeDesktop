import { useEffect, useRef } from "react";
import { revealRelation } from "./files-search-model.mjs";

/** Used by SourceTreeNode; the existing expansion state remains owned there.
 * Each reveal generation expands each ancestor once, allowing later manual
 * collapse. Target waits for real rows from files IPC, then scrolls without
 * moving focus. This is Ig's follow=true branch, not an explicit reveal command.
 */
export function useFileTreeReveal({ entry, revealPath, revealGeneration,
  treeVisible, expand, rowRef }) {
  const expanded = useRef(null), scrolled = useRef(null);
  const relation = revealRelation(entry, revealPath);
  useEffect(() => {
    if (!treeVisible || !revealGeneration || relation !== "ancestor" || expanded.current === revealGeneration) return;
    expanded.current = revealGeneration;
    expand(true);
  }, [treeVisible, relation, revealGeneration, expand]);
  useEffect(() => {
    if (!treeVisible || !revealGeneration || relation !== "target" || scrolled.current === revealGeneration) return;
    const row = rowRef.current, view = row?.ownerDocument.defaultView;
    if (!row || !view) return;
    const frame = view.requestAnimationFrame(() => {
      if (!row.isConnected || !row.getClientRects().length || row.closest("[hidden], [inert]")) return;
      row.scrollIntoView({ block: "nearest" });
      scrolled.current = revealGeneration;
    });
    return () => view.cancelAnimationFrame(frame);
  }, [treeVisible, relation, revealGeneration, rowRef]);
}
