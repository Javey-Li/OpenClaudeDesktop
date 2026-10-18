import test from "node:test";
import assert from "node:assert/strict";
import { SINGLE_CHILD_EXPAND_LIMIT, singleChildFolderChain, treeEntryOpenable, fileTreeGuideStyle, REVEAL_FLASH_MS,
  onEnterReleased, fileTreeCoachmarkEligible, fileTreeNuxDismissed, dismissFileTreeNux, FILE_TREE_NUX_ID, nuxAccountAged, NUX_ACCOUNT_MIN_AGE_MS } from "../src/file-tree-row-model.mjs";

const dir = (path, extra = {}) => ({ name: path.split("/").at(-1), path, directory: true, symlink: false, ...extra });
const file = (path) => ({ name: path.split("/").at(-1), path, directory: false, symlink: false });

test("av: a chain of only-child folders expands, stopping at a file, a link, siblings or a failed read", async () => {
  const tree = {
    src: [dir("src/main")], "src/main": [dir("src/main/java")], "src/main/java": [dir("src/main/java/com")],
    "src/main/java/com": [file("src/main/java/com/App.java"), file("src/main/java/com/Util.java")],
  };
  const calls = [];
  const list = async (path) => { calls.push(path); if (!(path in tree)) throw new Error("ENOENT"); return tree[path]; };
  assert.deepEqual(await singleChildFolderChain("src", list), ["src/main", "src/main/java", "src/main/java/com"]);
  assert.deepEqual(calls, ["src", "src/main", "src/main/java", "src/main/java/com"]);
  assert.deepEqual(await singleChildFolderChain("a", async () => [file("a/only.txt")]), []);
  assert.deepEqual(await singleChildFolderChain("a", async () => [dir("a/b", { symlink: true, link: { target: "x", state: "ok" } })]), []);
  assert.deepEqual(await singleChildFolderChain("a", async () => [dir("a/b"), dir("a/c")]), []);
  assert.deepEqual(await singleChildFolderChain("a", async () => []), []);
  assert.deepEqual(await singleChildFolderChain("missing", list), []);
});

test("av: at most 16 levels", async () => {
  assert.equal(SINGLE_CHILD_EXPAND_LIMIT, 16);
  const list = async (path) => [dir(`${path}/d`)];
  const chain = await singleChildFolderChain("r", list);
  assert.equal(chain.length, 16);
  assert.equal(chain.at(-1), `r${"/d".repeat(16)}`);
});

test("Qo: only a non-link or an ok link opens", () => {
  assert.equal(treeEntryOpenable(file("a.txt")), true);
  assert.equal(treeEntryOpenable({ ...file("l"), link: { target: "a.txt", state: "ok" } }), true);
  for (const state of ["external", "dangling", "cycle"])
    assert.equal(treeEntryOpenable({ ...file("l"), link: { target: "x", state } }), false, state);
});

test("ce9ca5630 g: one 1px border guide per ancestor level from the root icon's centre", () => {
  assert.deepEqual(fileTreeGuideStyle(0), {});
  assert.deepEqual(fileTreeGuideStyle(3), {
    "--file-tree-guides": "repeating-linear-gradient(to right, var(--cds-border) 0 1px, transparent 1px 8px)",
    backgroundPosition: "14px 0", backgroundRepeat: "no-repeat", backgroundSize: "24px 100%",
  });
  assert.equal(REVEAL_FLASH_MS, 1200);
});

function fakeDocument() {
  const view = new EventTarget(), body = { id: "body" };
  const document = { defaultView: view, body, activeElement: body };
  const tree = { ownerDocument: document, nodes: new Set(["row"]), contains(node) { return this.nodes.has(node); } };
  view.addEventListener = view.addEventListener.bind(view);
  const key = (type, key) => Object.assign(new Event(type), { key });
  return { view, document, tree, key };
}

test("c82eca2bd M: the hand-off runs once on Enter release while focus is in the tree or lost", () => {
  const { view, document, tree, key } = fakeDocument();
  let count = 0;
  onEnterReleased(tree, () => count++);
  view.dispatchEvent(key("keyup", "Shift"));
  assert.equal(count, 0);
  document.activeElement = "row";
  view.dispatchEvent(key("keyup", "Enter"));
  view.dispatchEvent(key("keyup", "Enter"));
  assert.equal(count, 1, "one-shot");
  onEnterReleased(tree, () => count++);
  document.activeElement = "elsewhere";
  view.dispatchEvent(key("keyup", "Enter"));
  assert.equal(count, 1, "focus moved elsewhere");
  onEnterReleased(tree, () => count++);
  view.dispatchEvent(new Event("blur"));
  document.activeElement = document.body;
  view.dispatchEvent(key("keyup", "Enter"));
  assert.equal(count, 1, "window blur drops the listener");
  onEnterReleased(tree, () => count++);
  view.dispatchEvent(key("keyup", "Enter"));
  assert.equal(count, 2, "focus lost to the body still hands off");
});

test("Db Oe: the tree coachmark needs the toggle, an open file, room for the tree, a hidden tree, no pop-out", () => {
  const base = { toggleShown: true, hasFile: true, canFit: true, treeVisible: false };
  assert.equal(fileTreeCoachmarkEligible(base), true);
  for (const change of [{ toggleShown: false }, { hasFile: false }, { canFit: false }, { treeVisible: true }, { popout: true }])
    assert.equal(fileTreeCoachmarkEligible({ ...base, ...change }), false, JSON.stringify(change));
});

test("epitaxy_files_tree_nux persists its dismissal and tolerates unavailable storage", () => {
  const data = new Map();
  const storage = { getItem: (key) => (data.has(key) ? data.get(key) : null), setItem: (key, value) => data.set(key, value) };
  assert.equal(FILE_TREE_NUX_ID, "epitaxy_files_tree_nux");
  assert.equal(fileTreeNuxDismissed(storage), false);
  dismissFileTreeNux("accepted", storage);
  assert.equal(fileTreeNuxDismissed(storage), true);
  const broken = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
  assert.equal(fileTreeNuxDismissed(broken), false);
  assert.doesNotThrow(() => dismissFileTreeNux("closed", broken));
});

test("shared-5 Sy: NUXes wait until the account (locally the profile) is a day old; no start time counts as new", () => {
  const now = Date.parse("2026-10-14T12:00:00Z");
  assert.equal(NUX_ACCOUNT_MIN_AGE_MS, 864e5);
  assert.equal(nuxAccountAged(undefined, now), false);
  assert.equal(nuxAccountAged("not a date", now), false);
  assert.equal(nuxAccountAged(new Date(now - 864e5 + 1).toISOString(), now), false);
  assert.equal(nuxAccountAged(new Date(now - 864e5).toISOString(), now), true);
  assert.equal(nuxAccountAged(now - 3 * 864e5, now), true);
});
