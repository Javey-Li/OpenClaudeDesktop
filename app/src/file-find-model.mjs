// Files pane viewer: "Find in file" and the breadcrumb folder lister (2.2553.1 cd2efac6e-CAi4fxTN.js).
// Find (zi / qi / Xi): case-insensitive matches over the file's lines, at most FIND_LIMIT of them; Enter / ⌘G
// step forward, Shift+Enter / ⇧⌘G back, both wrapping. The bar reads "{current} of {total}" or "No results".
// Breadcrumb (ja :Ma): every folder segment inside the workspace lists that folder; the file name lists its parent.

export const FIND_LIMIT = 10000;

/** Matches of query in text: [{line (1-based), start, end}] in document order (case-insensitive, literal). */
export function findInText(text, query, limit = FIND_LIMIT) {
  if (typeof text !== "string" || typeof query !== "string" || query === "") return [];
  const haystack = text.toLowerCase(), needle = query.toLowerCase();
  const matches = [];
  let line = 1, lineStart = 0, counted = 0;
  for (let at = haystack.indexOf(needle); at !== -1 && matches.length < limit; at = haystack.indexOf(needle, at + needle.length)) {
    // Count the newlines before the match (each one once).
    for (let next = text.indexOf("\n", counted); next !== -1 && next < at; next = text.indexOf("\n", counted)) { line++; lineStart = next + 1; counted = next + 1; }
    const lineEnd = text.indexOf("\n", at);
    // A match never spans lines (the viewer highlights one row at a time).
    if (lineEnd !== -1 && lineEnd < at + needle.length) continue;
    matches.push({ line, start: at - lineStart, end: at - lineStart + needle.length });
  }
  return matches;
}

/** The next active index after a step of delta (±1), wrapping; -1 when there are no matches. */
export function stepFindIndex(index, delta, total) {
  if (!total) return -1;
  if (index < 0) return delta > 0 ? 0 : total - 1;
  return (((index + delta) % total) + total) % total;
}

/** The first match on or after line (the find bar opened at the viewer's position), else 0. */
export function firstMatchFrom(matches, line) {
  if (!matches.length) return -1;
  if (!Number.isInteger(line)) return 0;
  const index = matches.findIndex((match) => match.line >= line);
  return index < 0 ? 0 : index;
}

/** {current, total, capped} for the "{current} of {total}" status (total shown as "10,000+" when capped). */
export function findStatus(matches, index, limit = FIND_LIMIT) {
  return { current: index >= 0 ? index + 1 : 0, total: matches.length, capped: matches.length >= limit };
}

// ⌘F opens, ⌘G / ⇧⌘G step (Ctrl off macOS); null for any other key.
export function fileFindShortcut(event, { mac = true } = {}) {
  const mod = mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  if (!mod || event.altKey) return null;
  const key = String(event.key || "").toLowerCase();
  if (key === "f" && !event.shiftKey) return "open";
  if (key === "g") return event.shiftKey ? "prev" : "next";
  return null;
}

/**
 * Breadcrumb segments of a workspace-relative displayPath ("src/app/main.js"): {lead, dirs: [{label, dir}], name:
 * {label, dir}} where dir is the workspace-relative folder that segment lists ("" for the workspace root), or null
 * when the segment is outside the workspace (an absolute or ~ path).
 */
export function breadcrumbFolders(displayPath) {
  const value = String(displayPath ?? "");
  const lead = /^\/+/.exec(value)?.[0] ?? "";
  const outside = lead !== "" || /^(?:~|[A-Za-z]:[\\/])/.test(value);
  const parts = value.slice(lead.length).split("/").filter((part) => part !== "");
  const name = parts.pop() ?? value;
  const dirs = parts.map((label, index) => ({ label, dir: outside ? null : parts.slice(0, index + 1).join("/") }));
  return { lead, dirs, name: { label: name, dir: outside ? null : parts.join("/") } };
}

/** The last segment of a folder path, for "Files in {folder}" (the workspace root reads as rootLabel). */
export function folderLabel(dir, rootLabel = "") {
  const value = String(dir ?? "").replace(/\/+$/, "");
  if (!value) return rootLabel;
  return value.slice(value.lastIndexOf("/") + 1) || value;
}
