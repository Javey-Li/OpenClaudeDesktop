// "@" file mentions inside a plain textarea (2.2553.1 c099c328d :3320-3360
// ccd-files options, :8772-8786 mention insertion, :8211 renderedText
// serialization; shared-frame :13107-13300 dropdown geometry). The textarea
// keeps the token as text; on submit the "@path" spans become Codex
// text_elements byte ranges plus {type:"mention",name,path} items.
export const MENTION_WIDTHS = Object.freeze({ base: 420, grouped: 420, wide: 560 });
export const MENTION_SIDE_OFFSET = 24;
export const MENTION_COLLISION_PADDING = 16;
export const MENTION_MAX_HEIGHT = 384;
export const MENTION_RESULT_LIMIT = 50;
export const MENTION_SEARCH_DELAY = 120;

// The token under the caret: "@" at the start of the text or after whitespace,
// followed by non-whitespace, with the caret inside or at its end.
export function mentionToken(text, caret) {
  if (typeof text !== "string" || !Number.isInteger(caret) || caret < 0 || caret > text.length) return null;
  let start = caret;
  while (start > 0 && !/\s/.test(text[start - 1])) start--;
  if (text[start] !== "@") return null;
  if (start > 0 && !/\s/.test(text[start - 1])) return null;
  let end = caret;
  while (end < text.length && !/\s/.test(text[end])) end++;
  const query = text.slice(start + 1, caret);
  if (/[@]/.test(query)) return null;
  return { start, end, query };
}

// Official Vr: insert the mention node followed by a space. The editor inserts the
// atomic node (composer-editor-model.mjs mentionTransaction, leafText "@path");
// this is the same edit on the plain text: the token becomes "@<relative path> "
// and the caret lands after the space, which is what the draft text reads.
export function insertMention(text, token, path) {
  const replacement = `@${path} `;
  const next = text.slice(0, token.start) + replacement + text.slice(token.end);
  return { text: next, caret: token.start + replacement.length };
}

// Every "@path" occurrence of a known inserted mention, non-overlapping,
// longest path first so "src/a" cannot shadow "src/a/b".
export function mentionRanges(text, mentions = []) {
  const paths = [...new Set(mentions.map((entry) => (typeof entry === "string" ? entry : entry?.path)).filter(Boolean))]
    .sort((a, b) => b.length - a.length);
  const ranges = [];
  const taken = [];
  for (const path of paths) {
    const needle = `@${path}`;
    let from = 0;
    while (from <= text.length) {
      const at = text.indexOf(needle, from);
      if (at < 0) break;
      const end = at + needle.length;
      const boundaryBefore = at === 0 || /\s/.test(text[at - 1]);
      const boundaryAfter = end === text.length || /\s/.test(text[end]);
      const overlaps = taken.some(([s, e]) => at < e && end > s);
      if (boundaryBefore && boundaryAfter && !overlaps) { ranges.push({ start: at, end, path }); taken.push([at, end]); }
      from = at + 1;
    }
  }
  return ranges.sort((a, b) => a.start - b.start);
}

const encoder = typeof TextEncoder === "function" ? new TextEncoder() : null;
export function utf8Length(text) {
  if (encoder) return encoder.encode(text).length;
  return Buffer.byteLength(text, "utf8");
}

// v2 UserInput text_elements use UTF-8 byte ranges in the parent text.
export function mentionInputs(text, mentions = [], { name = (path) => path.split("/").filter(Boolean).pop() || path, resolvePath = (path) => path } = {}) {
  const ranges = mentionRanges(text, mentions);
  const text_elements = ranges.map((range) => ({
    byteRange: { start: utf8Length(text.slice(0, range.start)), end: utf8Length(text.slice(0, range.end)) },
    placeholder: null,
  }));
  const items = [];
  const seen = new Set();
  for (const range of ranges) {
    if (seen.has(range.path)) continue;
    seen.add(range.path);
    items.push({ type: "mention", name: name(range.path), path: resolvePath(range.path) });
  }
  return { text, text_elements, items };
}

// Official Fu/Vu: label = basename, description = directory (undefined at root),
// renderedText = path, metadata.positions index into the full path.
export function mentionOptions(matches = [], { limit = MENTION_RESULT_LIMIT } = {}) {
  return matches.slice(0, limit).map((match) => {
    const path = String(match.path || "").replace(/\\/g, "/");
    const slash = path.lastIndexOf("/");
    const label = slash === -1 ? path : path.slice(slash + 1);
    const dir = slash === -1 ? "" : path.slice(0, slash);
    return {
      id: `file-${path}`,
      label,
      description: dir || undefined,
      isDirectory: match.directory === true,
      path,
      renderedText: path,
      positions: Array.isArray(match.positions) ? match.positions.filter(Number.isInteger) : [],
    };
  });
}

// Official Pp: positions are relative to the full path; the label is lit when
// any position falls in its tail, the description when any falls before it.
export function optionHighlights(option) {
  const full = option.renderedText ?? option.label;
  if (!full.endsWith(option.label)) return { label: null, description: null };
  const offset = full.length - option.label.length;
  const positions = option.positions || [];
  const label = positions.some((at) => at >= offset) ? segments(option.label, positions, offset) : null;
  const description = positions.some((at) => at < offset - 1) && option.description !== undefined
    ? segments(option.description, positions, 0) : null;
  return { label, description };
}

// Text segments, never HTML: {text, lit}.
export function segments(text, positions = [], offset = 0) {
  const marked = new Set(positions);
  const out = [];
  let at = offset;
  for (const character of text) {
    const lit = [...Array(character.length)].some((_, index) => marked.has(at + index));
    const previous = out.at(-1);
    if (previous?.lit === lit) previous.text += character;
    else out.push({ text: character, lit });
    at += character.length;
  }
  return out;
}

export function mentionWidth(options, widths = MENTION_WIDTHS) {
  if (options.some((option) => option.description)) return widths.wide;
  if (options.some((option) => option.categoryIcon !== undefined)) return widths.grouped;
  return widths.base;
}

// Popup box above a zero-size caret anchor (side top, align start, sideOffset
// 24, collisionPadding 16, max-h min(available, 384)). Coordinates are viewport
// pixels; the popup bottom sits 24px above the caret top.
export function mentionPopupGeometry({ caret, width, viewport, padding = MENTION_COLLISION_PADDING, offset = MENTION_SIDE_OFFSET }) {
  const available = Math.max(0, caret.top - offset - padding);
  const maxHeight = Math.min(available, MENTION_MAX_HEIGHT);
  const maxLeft = Math.max(padding, viewport.width - padding - width);
  const left = Math.min(Math.max(padding, caret.left), maxLeft);
  return { left, bottom: viewport.height - (caret.top - offset), maxHeight, width };
}

export function nextHighlight(index, count, key) {
  if (!count) return -1;
  if (key === "ArrowDown") return (index + 1) % count;
  if (key === "ArrowUp") return (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return index;
}
