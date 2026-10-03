const fs = require("node:fs/promises");
const path = require("node:path");
async function scopedPath(root, relative = "") {
  const realRoot = await fs.realpath(root);
  const requested = path.resolve(realRoot, relative);
  const resolved = await fs.realpath(requested);
  if (resolved !== realRoot && !resolved.startsWith(realRoot + path.sep))
    throw new Error("File is outside the selected workspace.");
  return resolved;
}
// Symlink rows (2.2553.1 readable/panes-tile-current.js:5572-5588 Rg, the
// file-tree-link-mark at :5762-5769): the target text, and whether it resolves
// inside the working directory (ok), outside it (external), not at all
// (dangling) or into a loop (cycle). The row takes `directory` from the target,
// so a directory link expands (through scopedPath, which still refuses one that
// leaves the workspace).
async function linkInfo(realRoot, full) {
  let target = "";
  try { target = await fs.readlink(full); } catch { /* unreadable link text */ }
  try {
    const resolved = await fs.realpath(full);
    const stat = await fs.stat(resolved);
    const inside = resolved === realRoot || resolved.startsWith(realRoot + path.sep);
    return { directory: stat.isDirectory(), link: { target, state: inside ? "ok" : "external" } };
  } catch (error) {
    return { directory: false, link: { target, state: error?.code === "ELOOP" ? "cycle" : "dangling" } };
  }
}
async function listFiles(root, relative = "", { includeChild } = {}) {
  const target = await scopedPath(root, relative);
  const realRoot = await fs.realpath(root);
  const entries = await fs.readdir(target, { withFileTypes: true });
  const compareEntries = (a, b) =>
    Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name);
  const sorted = (await Promise.all(entries
    .filter((e) => ![".git", "node_modules", ".DS_Store"].includes(e.name))
    .map(async (e) => {
      const entry = {
        name: e.name,
        path: path.join(relative, e.name),
        directory: e.isDirectory(),
        symlink: e.isSymbolicLink(),
      };
      return entry.symlink ? { ...entry, ...(await linkInfo(realRoot, path.join(target, e.name))) } : entry;
    })))
    .sort(compareEntries);
  const page = sorted.slice(0, 500);
  // A reveal hint only retains an already-enumerated, normally eligible child.
  // This bounds the response at 500; it does not bypass exclusions or fabricate
  // a path that was not present in the actual directory snapshot.
  const validHint = typeof includeChild === "string" && includeChild.length > 0 &&
    includeChild.length <= 4096 && !includeChild.includes("/") && !includeChild.includes("\0") &&
    includeChild !== "." && includeChild !== "..";
  if (validHint) {
    const index = sorted.findIndex(entry => entry.name === includeChild);
    if (index >= 500) {
      page[499] = sorted[index];
      page.sort(compareEntries);
    }
  }
  return page;
}
// The Files pane viewer's read (2.2553.1 cd2efac6e To/Un cards :3602-3740,
// binary :4604-4612, empty :4336-4346): expected outcomes are classified
// results, never thrown errors, so the pane opens a tab with the matching card
// instead of an IPC error string. The traversal guard is unchanged: nothing
// outside the workspace's real path is read (outside_root).
const PREVIEW_LIMIT = 1024 * 1024;
// Images, video and audio (cd2efac6e nr/ir :2672-2673 over shared-4 Jh and
// shared-11 gh/hh; the same lists as file-preview-model.mjs fileMediaKind) are
// shown from their file:// URL, so the read only classifies them by name and
// size and never loads the bytes. `unavailable` repeats the kind: the Files
// pane keeps a no-text result as {unavailable, size} (source-session.jsx
// loadFile), and the viewer reads these three kinds as media, not as cards.
// "View as text anyway" (force) reads the bytes as before.
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "bmp", "webp", "avif"]);
function mediaKind(name) {
  const at = name.lastIndexOf(".");
  if (IMAGE_EXTENSIONS.has(at < 0 ? "" : name.slice(at + 1).toLowerCase())) return "image";
  if (/\.(mp4|webm|mov|m4v|ogv)$/i.test(name)) return "video";
  if (/\.(mp3|m4a|aac|wav|flac|opus|ogg|oga)$/i.test(name)) return "audio";
  return null;
}
async function readFile(root, relative, { force = false } = {}) {
  const requested = relative;
  let target;
  try {
    target = await scopedPath(root, relative);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      // A missing path that lexically leaves the workspace is still refused as outside.
      try {
        const realRoot = await fs.realpath(root), lexical = path.resolve(realRoot, relative);
        if (lexical !== realRoot && !lexical.startsWith(realRoot + path.sep)) return { path: requested, unavailable: "outside_root" };
      } catch { return { path: requested, unavailable: "read_error" }; }
      return { path: requested, unavailable: "missing" };
    }
    if (/outside the selected workspace/.test(error?.message ?? "")) return { path: requested, unavailable: "outside_root" };
    return { path: requested, unavailable: "read_error" };
  }
  try {
    const stat = await fs.stat(target);
    if (!stat.isFile()) return { path: requested, unavailable: "read_error" };
    const kind = force ? null : mediaKind(String(requested));
    if (kind) return { path: requested, kind, size: stat.size, unavailable: kind };
    if (stat.size > PREVIEW_LIMIT) return { path: requested, unavailable: "too_large", size: stat.size };
    const b = await fs.readFile(target);
    if (!force && b.includes(0)) return { path: requested, unavailable: "binary" };
    return { path: requested, text: b.toString("utf8") };
  } catch (error) {
    return { path: requested, unavailable: error?.code === "ENOENT" ? "missing" : "read_error" };
  }
}
module.exports = { scopedPath, listFiles, readFile };
