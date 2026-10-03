import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { readFile, listFiles } = require("../electron/files.cjs");
// The Files pane viewer's read (cd2efac6e To/Un cards): expected outcomes are
// classified results; the traversal guard still never reads outside the root.
test("preview classifies missing, outside, large, binary and empty files and keeps the traversal guard", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "code-desktop-test-"));
  await fs.mkdir(path.join(root, "project"));
  const p = path.join(root, "project");
  try {
    await fs.writeFile(path.join(p, "ok.txt"), "Hello");
    await fs.writeFile(path.join(root, "outside.txt"), "Private");
    await fs.symlink(path.join(root, "outside.txt"), path.join(p, "link"));
    await fs.writeFile(path.join(p, "binary"), Buffer.from([0, 1, 65]));
    await fs.writeFile(path.join(p, "empty.txt"), "");
    await fs.mkdir(path.join(p, "folder"));
    await fs.writeFile(
      path.join(p, "large"),
      Buffer.alloc(1024 * 1024 + 1, 65),
    );
    assert.deepEqual(await readFile(p, "ok.txt"), { path: "ok.txt", text: "Hello" });
    assert((await listFiles(p)).some((f) => f.name === "ok.txt"));
    assert.deepEqual(await readFile(p, "missing.js"), { path: "missing.js", unavailable: "missing" });
    assert.deepEqual(await readFile(p, "nested/missing.js"), { path: "nested/missing.js", unavailable: "missing" });
    assert.deepEqual(await readFile(p, "../outside.txt"), { path: "../outside.txt", unavailable: "outside_root" });
    assert.deepEqual(await readFile(p, "../nope.txt"), { path: "../nope.txt", unavailable: "outside_root" }, "a missing path outside is still outside");
    assert.deepEqual(await readFile(p, path.join(root, "outside.txt")), { path: path.join(root, "outside.txt"), unavailable: "outside_root" });
    assert.deepEqual(await readFile(p, "link"), { path: "link", unavailable: "outside_root" }, "an escaping symlink is outside");
    assert.deepEqual(await readFile(p, "large"), { path: "large", unavailable: "too_large", size: 1024 * 1024 + 1 });
    assert.deepEqual(await readFile(p, "binary"), { path: "binary", unavailable: "binary" });
    assert.deepEqual(await readFile(p, "binary", { force: true }), { path: "binary", text: "\u0000\u0001A" }, "View as text anyway");
    assert.deepEqual(await readFile(p, "empty.txt"), { path: "empty.txt", text: "" });
    assert.deepEqual(await readFile(p, "folder"), { path: "folder", unavailable: "read_error" });
    assert.deepEqual(await readFile(path.join(root, "gone"), "ok.txt"), { path: "ok.txt", unavailable: "read_error" }, "a missing root");
    // The traversal guard: nothing outside the workspace is returned, forced or not.
    for (const relative of ["../outside.txt", "link"]) assert.equal((await readFile(p, relative, { force: true })).text, undefined, relative);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

// Rg link rows (panes-tile-current.js:5572-5588, :5762-5769): directory from the target, link {target, state}.
test("listFiles marks symlinks ok / external / dangling and takes directory from the target", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "code-desktop-test-"));
  const p = path.join(root, "project");
  try {
    await fs.mkdir(path.join(p, "lib", "inner"), { recursive: true });
    await fs.writeFile(path.join(p, "lib", "a.txt"), "A");
    await fs.mkdir(path.join(root, "elsewhere"));
    await fs.symlink("lib", path.join(p, "lib-link"));
    await fs.symlink("lib/a.txt", path.join(p, "file-link"));
    await fs.symlink(path.join(root, "elsewhere"), path.join(p, "external-link"));
    await fs.symlink("does-not-exist", path.join(p, "dangling-link"));
    await fs.symlink("loop-b", path.join(p, "loop-a"));
    await fs.symlink("loop-a", path.join(p, "loop-b"));
    const entries = Object.fromEntries((await listFiles(p)).map((entry) => [entry.name, entry]));
    assert.deepEqual(entries["lib-link"], { name: "lib-link", path: "lib-link", directory: true, symlink: true, link: { target: "lib", state: "ok" } });
    assert.deepEqual(entries["file-link"], { name: "file-link", path: "file-link", directory: false, symlink: true, link: { target: "lib/a.txt", state: "ok" } });
    assert.deepEqual(entries["external-link"].link, { target: path.join(root, "elsewhere"), state: "external" });
    assert.equal(entries["external-link"].directory, true);
    assert.deepEqual(entries["dangling-link"], { name: "dangling-link", path: "dangling-link", directory: false, symlink: true, link: { target: "does-not-exist", state: "dangling" } });
    assert.equal(entries["loop-a"].link.state, "cycle");
    assert.deepEqual(entries.lib, { name: "lib", path: "lib", directory: true, symlink: false }, "plain rows carry no link");
    // A directory link expands (its target is inside); an external one is still refused by the scope guard.
    assert.deepEqual((await listFiles(p, "lib-link")).map((entry) => entry.name), ["inner", "a.txt"]);
    await assert.rejects(listFiles(p, "external-link"), /outside/);
    // Directory links sort with the folders.
    const order = (await listFiles(p)).map((entry) => entry.name);
    assert.ok(order.indexOf("lib-link") < order.indexOf("file-link"));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

// R09 (cd2efac6e nr/ir): images, video and audio are classified by name and size without reading their bytes;
// NUL text is still binary, and View as text anyway (force) reads a media file's bytes.
test("readFile classifies png/mp4/mp3 as media without a read; NUL text stays binary", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "code-desktop-test-"));
  try {
    // 2 MiB of NUL bytes: a read would answer too_large (or binary).
    await fs.writeFile(path.join(root, "photo.png"), Buffer.alloc(2 * 1024 * 1024));
    await fs.writeFile(path.join(root, "clip.mp4"), Buffer.from([0, 0, 0, 24]));
    await fs.writeFile(path.join(root, "song.MP3"), "ID3");
    await fs.writeFile(path.join(root, "nul.txt"), Buffer.from([65, 0, 66]));
    await fs.writeFile(path.join(root, "icon.svg"), "<svg/>");
    // An unreadable mp4: a read would fail with read_error.
    await fs.chmod(path.join(root, "clip.mp4"), 0o000);
    assert.deepEqual(await readFile(root, "photo.png"), { path: "photo.png", kind: "image", size: 2 * 1024 * 1024, unavailable: "image" });
    assert.deepEqual(await readFile(root, "clip.mp4"), { path: "clip.mp4", kind: "video", size: 4, unavailable: "video" });
    assert.deepEqual(await readFile(root, "song.MP3"), { path: "song.MP3", kind: "audio", size: 3, unavailable: "audio" });
    assert.deepEqual(await readFile(root, "nul.txt"), { path: "nul.txt", unavailable: "binary" });
    assert.deepEqual(await readFile(root, "icon.svg"), { path: "icon.svg", text: "<svg/>" }, "svg is text (no allowSvg)");
    assert.deepEqual(await readFile(root, "photo.png", { force: true }), { path: "photo.png", unavailable: "too_large", size: 2 * 1024 * 1024 }, "forced: the bytes are read");
    assert.deepEqual(await readFile(root, "missing.png"), { path: "missing.png", unavailable: "missing" });
  } finally {
    await fs.chmod(path.join(root, "clip.mp4"), 0o644).catch(() => {});
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("files.cjs media lists match the renderer's fileMediaKind (cd2efac6e je/ye)", async () => {
  const { fileMediaKind } = await import("../src/file-preview-model.mjs");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "code-desktop-test-"));
  try {
    for (const name of ["a.png", "b.JPG", "c.jpeg", "d.gif", "e.bmp", "f.webp", "g.avif", "h.svg", "i.ico", "j.mp4", "k.webm", "l.MOV", "m.m4v", "n.ogv", "o.mkv",
      "p.mp3", "q.m4a", "r.aac", "s.wav", "t.flac", "u.opus", "v.ogg", "w.oga", "x.wma", "y.txt"]) {
      await fs.writeFile(path.join(root, name), "x");
      assert.equal((await readFile(root, name)).kind ?? null, fileMediaKind(name), name);
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
