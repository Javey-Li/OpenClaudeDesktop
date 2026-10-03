// The source remembers only follow intent, not a synthesized output position.
// Session + item identity belongs in key; the cache contains no output text.
export function createTaskOutputFollow(limit = 1000) {
  const capacity = Number.isFinite(limit) && limit >= 1 ? Math.floor(limit) : 1000;
  const remembered = new Map();
  return {
    record(key, element) {
      const gap = element.scrollHeight - element.scrollTop - element.clientHeight;
      if (!Number.isFinite(gap)) return;
      remembered.delete(key); remembered.set(key, gap < 16);
      while (remembered.size > capacity) remembered.delete(remembered.keys().next().value);
    },
    update(key, element) {
      if (!element || remembered.get(key) === false) return;
      const selection = element.ownerDocument.defaultView?.getSelection();
      if (selection && !selection.isCollapsed && selection.anchorNode && element.contains(selection.anchorNode)) return;
      element.scrollTop = element.scrollHeight;
    },
  };
}
export const taskOutputFollow = createTaskOutputFollow();
