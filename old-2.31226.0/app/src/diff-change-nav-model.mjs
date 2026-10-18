// B34 next / previous change in Changes (2.31226 c44d00c7f Qr/$r/ei/Eo, shared-19 m6 nextDiffChange/prevDiffChange):
// pure parts of the F7 / ⇧F7 navigation (⌥F5 / ⇧⌥F5 off Linux) between the changed blocks of the Changes pane.

/** shared-19 m6: { command, key, when }; `!isLinux` rows are dropped on Linux. */
export function diffChangeShortcuts({ linux = false } = {}) {
  return {
    next: [...(linux ? [] : ["alt+f5"]), "f7"],
    prev: [...(linux ? [] : ["shift+alt+f5"]), "shift+f7"],
  };
}

/** The keydown's command: "next", "prev" or null. Bindings match the key's code with exact modifiers (code F7 / F5). */
export function diffChangeCommand(event, { linux = false } = {}) {
  if (!event || event.isComposing || event.keyCode === 229) return null;
  const code = event.code || (typeof event.key === "string" ? event.key : "");
  if (event.metaKey || event.ctrlKey) return null;
  const shift = !!event.shiftKey, alt = !!event.altKey;
  if (code === "F7" && !alt) return shift ? "prev" : "next";
  if (code === "F5" && alt && !linux) return shift ? "prev" : "next";
  return null;
}

/** Qr(id, diff): one target per change block (a run of removed / added rows between context rows). The target names
 * the additions side when the block adds lines (its first new line), else the deletions side (its first old line);
 * oldLine / newLine are where the block starts on each side and `removes` whether it deletes lines. A hunk with an
 * empty side starts that side at the line after its header's (+(count === 0)), as @pierre/diffs counts. */
export function diffChangeTargets(id, hunks = []) {
  const targets = [];
  for (const hunk of hunks ?? []) {
    let oldLine = hunk.oldStart + (hunk.oldCount === 0 ? 1 : 0);
    let newLine = hunk.newStart + (hunk.newCount === 0 ? 1 : 0);
    const rows = hunk.rows ?? [];
    for (let at = 0; at < rows.length;) {
      const row = rows[at];
      if (row.type === "context") { oldLine++; newLine++; at++; continue; }
      if (row.type !== "added" && row.type !== "removed") { at++; continue; }
      let additions = 0, deletions = 0;
      for (; at < rows.length && rows[at].type !== "context"; at++) {
        if (rows[at].type === "added") additions++;
        else if (rows[at].type === "removed") deletions++;
      }
      const side = additions > 0 ? "additions" : "deletions";
      targets.push({ id, side, lineNumber: side === "additions" ? newLine : oldLine, oldLine, newLine, removes: deletions > 0 });
      oldLine += deletions;
      newLine += additions;
    }
  }
  return targets;
}

/** $r */
export function sameDiffChange(a, b) {
  return !!a && !!b && a.id === b.id && a.side === b.side && a.lineNumber === b.lineNumber;
}

/** ei(targets, fileOrder, {last, viewport}, direction): the change to go to. `last` is the change the previous press
 * went to while it is still on screen (step from it); otherwise `viewport` is the topmost visible line ({id, side,
 * lineNumber}; lineNumber 0 = the top of a file) and the next change is the first one below it, the previous the last
 * one above it (skipping the change that line itself starts). */
export function pickDiffChange(targets, order, { last = null, viewport = null } = {}, direction) {
  if (!targets.length) return null;
  const index = last ? targets.findIndex((entry) => sameDiffChange(entry, last)) : -1;
  if (index !== -1) return targets[index + direction] ?? null;
  if (!viewport) return direction === 1 ? targets[0] ?? null : null;
  const fileIndex = order.indexOf(viewport.id);
  const below = targets.findIndex((entry) => (entry.id === viewport.id
    ? (viewport.side === "additions" ? entry.newLine : entry.oldLine) > viewport.lineNumber
    : order.indexOf(entry.id) > fileIndex));
  if (direction === 1) return below === -1 ? null : targets[below] ?? null;
  const at = (below === -1 ? targets.length : below) - 1;
  const candidate = targets[at];
  if (!candidate) return null;
  const startsHere = candidate.id === viewport.id && (viewport.side === "additions"
    ? candidate.side === "additions" && candidate.newLine === viewport.lineNumber
    : candidate.removes && candidate.oldLine === viewport.lineNumber);
  return startsHere ? targets[at - 1] ?? null : candidate;
}

/** Wo: the sticky file header's height, 2rem at the root font size. */
export function diffChangeHeaderOffset(rootFontSize = 16) {
  return (32 * (Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : 16)) / 16;
}
