import test from "node:test";
import assert from "node:assert/strict";
import { LEGACY_RATIO_KEY, MAX_SESSION_ENTRIES, TILE_STORE_KEY, capSessions, createTileLayoutStore, emptyStoreState, migrateLegacyRatios, partialize, sanitizeSessionEntry, sanitizeStoreState } from "../src/tile-layout-store.mjs";
import { fromSpec, layoutKey } from "../src/tile-layout-model.mjs";

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return { getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key), map };
}
const filesLayout = () => fromSpec({ direction: "row", children: [["chat", 2], ["files", 3]] });

test("legacy chat ratios migrate to 2*side/chat and the old key is removed", () => {
  assert.deepEqual(migrateLegacyRatios(JSON.stringify({ files: 0.4, plan: 2 / 3, bogus: 0.5, changes: "x" })), { files: 3, plan: 1 });
  assert.deepEqual(migrateLegacyRatios("not json"), {});
  const storage = memoryStorage({ [LEGACY_RATIO_KEY]: JSON.stringify({ files: 0.5 }) });
  const store = createTileLayoutStore({ storage });
  assert.deepEqual(store.getState().lastPaneFlexByKind, { files: 2 });
  assert.equal(storage.map.has(LEGACY_RATIO_KEY), false);
  assert.equal(JSON.parse(storage.map.get(TILE_STORE_KEY)).lastPaneFlexByKind.files, 2);
});

test("session entries round-trip through storage without file contents and keep tab order", () => {
  const storage = memoryStorage();
  const store = createTileLayoutStore({ storage });
  store.setSession("A", { tileLayout: filesLayout(), fileTabs: [{ path: "alpha.txt", preview: false, text: "secret" }, { path: "beta.md", preview: true, text: "#" }], activePath: "beta.md", finishedExpanded: true, treeShown: true, expandedPaths: ["src"] });
  const persisted = JSON.parse(storage.map.get(TILE_STORE_KEY));
  assert.equal(persisted.version, 1);
  assert.deepEqual(persisted.sessions.A.fileTabs, [{ path: "alpha.txt", preview: false }, { path: "beta.md", preview: true }]);
  assert.equal(JSON.stringify(persisted).includes("secret"), false);
  const reopened = createTileLayoutStore({ storage });
  const entry = reopened.getSession("A");
  assert.equal(entry.finishedExpanded,true);
  assert.equal(layoutKey(entry.tileLayout), "S[row](T:chat,T:files)");
  assert.equal(entry.tileLayout.root.children[1].flex, 3);
  assert.deepEqual(entry.fileTabs.map((tab) => [tab.path, tab.preview]), [["alpha.txt", false], ["beta.md", true]]);
  assert.equal(entry.activePath, "beta.md");
  assert.equal(entry.treeShown, true);
  assert.deepEqual(entry.expandedPaths, ["src"]);
  assert.equal(reopened.getSession("missing"), null);
  assert.equal(store.getSession("A").fileTabs[0].text, "secret", "in-memory tabs keep their text");
});

test("the store caps at 100 sessions dropping the oldest, prunes removed sessions and notifies subscribers", () => {
  const store = createTileLayoutStore({ storage: memoryStorage() });
  let notified = 0;
  const unsubscribe = store.subscribe(() => { notified += 1; });
  for (let index = 0; index < MAX_SESSION_ENTRIES + 5; index++) store.setSession(`s${index}`, { treeShown: true });
  assert.equal(store.getState().order.length, MAX_SESSION_ENTRIES);
  assert.equal(store.getSession("s0"), null);
  assert.equal(store.getSession("s4"), null);
  assert.ok(store.getSession("s5"));
  store.setSession("s5", { treeShown: false });
  assert.equal(store.getState().order.at(-1), "s5", "touching an entry makes it most recent");
  store.prune(["s5", "s6"]);
  assert.deepEqual(store.getState().order, ["s6", "s5"]);
  const before = notified;
  store.prune(["s5", "s6"]);
  assert.equal(notified, before, "an unchanged prune does not notify");
  unsubscribe();
  store.setGlobal({ filesTreeShown: true });
  assert.equal(notified, before);
  assert.equal(store.getState().filesTreeShown, true);
  assert.equal(capSessions({ ...emptyStoreState(), sessions: { a: {}, b: {} }, order: ["a", "b"] }, 1).order.join(), "b");
});

test("sanitizers reject malformed persisted state and an inconsistent expanded tile", () => {
  assert.deepEqual(sanitizeStoreState(null), emptyStoreState());
  const state = sanitizeStoreState({ version: 1, lastPaneFlexByKind: { files: 3, plan: -1, other: 2 }, diffShowTree: false, sessions: { A: { tileLayout: { root: { kind: "tile", tileId: 1 } }, fileTabs: [{ path: 3 }, { path: "x", preview: "yes" }, { path: "x" }], activePath: "gone" } }, order: ["A", "ghost"] });
  assert.deepEqual(state.lastPaneFlexByKind, { files: 3 });
  assert.equal(state.diffShowTree, false);
  assert.deepEqual(state.order, ["A"]);
  assert.equal(state.sessions.A.tileLayout, null);
  assert.deepEqual(state.sessions.A.fileTabs, [{ path: "x", preview: false }]);
  assert.equal(state.sessions.A.activePath, null);
  const expanded = sanitizeSessionEntry({ tileLayout: fromSpec({ direction: "row", children: ["files"] }), baseLayout: filesLayout(), expandedTile: "files" });
  assert.equal(expanded.expandedTile, "files");
  assert.equal(layoutKey(expanded.baseLayout), "S[row](T:chat,T:files)");
  const broken = sanitizeSessionEntry({ tileLayout: filesLayout(), baseLayout: null, expandedTile: "files" });
  assert.equal(broken.expandedTile, null);
  assert.equal(broken.baseLayout, null);
  const stale = sanitizeSessionEntry({ tileLayout: fromSpec({ direction: "row", children: ["plan"] }), baseLayout: filesLayout(), expandedTile: "files" });
  assert.equal(stale.expandedTile, null);
  assert.equal(layoutKey(stale.tileLayout), "S[row](T:chat,T:files)", "an expanded tile missing from the layout restores the base");
  const tooNew = memoryStorage({ [TILE_STORE_KEY]: JSON.stringify({ version: 99, sessions: { A: {} }, order: ["A"] }) });
  assert.equal(createTileLayoutStore({ storage: tooNew }).getSession("A"), null, "a newer version is not read");
  assert.equal(partialize(emptyStoreState()).version, 1);
});
