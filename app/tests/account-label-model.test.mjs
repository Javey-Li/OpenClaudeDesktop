import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { accountIdentity, accountMenuLines, accountOrgLine, connectionMenuHeader } from "../src/account-label-model.mjs";

const root = path.resolve(import.meta.dirname, "..");

// Original sidebar-rows tV: identity, then `orgPrimary · orgSecondary` (or orgPrimary alone).
test("account menu org line: 'DeepSeek API · API key' for a key account, never 'DeepSeek · DeepSeek'", () => {
  const key = accountMenuLines({ account: { type: "apiKey" }, requiresOpenaiAuth: false });
  assert.deepEqual(key, { orgPrimary: "DeepSeek API", orgSecondary: "API key" });
  assert.equal(accountOrgLine(key), "DeepSeek API · API key");
  for (const snapshot of [{ account: null }, null, undefined, { account: { type: "chatgpt", planType: "plus" } }]) {
    const lines = accountMenuLines(snapshot);
    assert.deepEqual(lines, { orgPrimary: "DeepSeek API", orgSecondary: null });
    assert.equal(accountOrgLine(lines), "DeepSeek API");
    assert.doesNotMatch(accountOrgLine(lines), /DeepSeek · DeepSeek/);
  }
});

// R02, shared-21 IO (sidebar-rows.js:8597-8613): identity = principal name || provider label; with a
// principal the org line is label (+ subtitle), without one it is the subtitle alone.
test("account identity: the preferred name with 'DeepSeek API' (· API key), else the provider label itself", () => {
  const key = { account: { type: "apiKey" }, requiresOpenaiAuth: false };
  assert.deepEqual(accountIdentity("Ada Lovelace", key), { identity: "Ada Lovelace", orgPrimary: "DeepSeek API", orgSecondary: "API key" });
  assert.equal(accountOrgLine(accountIdentity("Ada Lovelace", key)), "DeepSeek API · API key");
  assert.deepEqual(accountIdentity("Ada Lovelace", { account: null }), { identity: "Ada Lovelace", orgPrimary: "DeepSeek API", orgSecondary: null });
  for (const name of ["", "   ", null, undefined]) {
    assert.deepEqual(accountIdentity(name, key), { identity: "DeepSeek API", orgPrimary: "API key", orgSecondary: null }, "no invented 'Local user'");
    for (const snapshot of [{ account: null }, null, undefined, { account: { type: "chatgpt", planType: "plus" } }])
      assert.deepEqual(accountIdentity(name, snapshot), { identity: "DeepSeek API", orgPrimary: null, orgSecondary: null });
  }
  assert.equal(accountIdentity("  Grace  ", null).identity, "Grace");
});

test("the Connection settings header names the running core", () => {
  assert.equal(connectionMenuHeader("deepseek", true), "DeepSeek Harness connected");
  assert.equal(connectionMenuHeader("deepseek", false), "DeepSeek Harness disconnected");
  assert.equal(connectionMenuHeader("codex", true), "Codex connected");
  assert.equal(connectionMenuHeader("codex", false), "Codex disconnected", "the Codex fixture text (approval-ui.mjs) is unchanged");
  assert.equal(connectionMenuHeader(undefined, false), "Codex disconnected");
});

test("main.jsx renders the IO identity in the header and footer, with no 'Local user' fallback", async () => {
  const main = await fs.readFile(path.join(root, "src/main.jsx"), "utf8");
  assert.match(main, /const accountLines = accountIdentity\(displayName, boot\?\.account\);\s*const accountLabel = accountLines\.orgPrimary \?\? "";/);
  assert.match(main, /data-testid="user-menu-header">\{accountLines\.identity\}</);
  assert.match(main, /\{accountLines\.orgPrimary && <span className="smenu-header-line smenu-header-secondary" data-testid="user-menu-header-org">\{accountOrgLine\(accountLines\)\}<\/span>\}/);
  assert.match(main, /displayName=\{accountLines\.identity\}\s+accountLabel=\{accountLabel\}/);
  assert.match(main, /<SourceMenu\.Header>\{connectionMenuHeader\(engine, !!boot\?\.connected\)\}<\/SourceMenu\.Header>/);
  assert.doesNotMatch(main, /Local user/);
  assert.doesNotMatch(main, /\{accountLabel\} · DeepSeek/);
  assert.doesNotMatch(main, /planType \|\| "DeepSeek API"/);
  const sidebar = await fs.readFile(path.join(root, "src/source-sidebar.jsx"), "utf8");
  assert.doesNotMatch(sidebar, /displayName\.split\(" "\)\[0\]/, "the footer shows the whole identity");
  assert.match(sidebar, /<span className="whitespace-nowrap text-secondary max-w-full shrink-0 truncate">\{accountName\}<\/span>/);
});

// R02 account menu (sidebar-rows.js:16155-16432 $B, pw w-[17rem] at sidebar-groups.js:5250-5253).
test("account menu: 17rem popup, DeepSeek key row, View changelog, Learn more holding Keyboard shortcuts", async () => {
  const css = await fs.readFile(path.join(root, "src/source-menu.css"), "utf8");
  assert.match(css, /\.smenu-popup\.account-menu \{ width: 17rem; \}/);
  assert.match(css, /\.smenu-popup\.account-learn-more \{ min-width: 208px; \}/);
  assert.ok(css.indexOf(".smenu-popup.account-menu {") < css.indexOf(".smenu-popup.smenu-sheet {"), "the coarse sheet keeps its full width");
  const main = await fs.readFile(path.join(root, "src/main.jsx"), "utf8");
  const account = main.slice(main.indexOf('case "account":'), main.indexOf('case "connection":'));
  const order = ["Settings</SourceMenu.Item>", "Usage</SourceMenu.Item>", "appearance\"}", "DeepSeek API key</SourceMenu.Item>", "<SourceMenu.Separator />",
    "View changelog</SourceMenu.Item>", '<SourceMenu.SubmenuTrigger icon="Info">Learn more', "Keyboard shortcuts</SourceMenu.Item>"].map((needle) => account.indexOf(needle));
  assert.ok(order.every((index) => index > 0), `every item present: ${order}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, "Settings, Usage, appearance, key row, separator, View changelog, Learn more › Keyboard shortcuts");
  assert.match(account, /\{boot\?\.account\?\.deepseek && <SourceMenu\.Item icon="Key" data-testid="user-menu-deepseek-key" onClick=\{\(\) => setSettings\("preferences"\)\}>DeepSeek API key/);
  assert.match(account, /<SourceMenu\.Item icon="Scroll" onClick=\{\(\) => setWhatsNew\(true\)\}>View changelog/);
  assert.match(account, /<SourceMenu\.Popup label="Learn more" className="account-learn-more">[\s\S]*<SourceMenu\.Item shortcut=\{SHORTCUTS_DIALOG_KEYS\} onClick=\{\(\)=>setActionDialog\(\{kind:"shortcuts"\}\)\}>Keyboard shortcuts/);
  assert.doesNotMatch(account, /icon="Keyboard"/, "Keyboard shortcuts left the top level");
  assert.doesNotMatch(account, /https?:\/\//, "no invented Learn more URLs");
});
