import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { DEEPSEEK_KEYS_URL, accountSettingsPlan, deepseekKeyDescription } from "../src/account-settings-model.mjs";
import { accountReadResponse } from "../../harness/packages/codex-app-server/src/account.js";

// Preferences › DeepSeek account. The DeepSeek bridge's account/read (harness
// account.js) carries `deepseek`; the Codex core keeps the ChatGPT rows.
const deepseek = (keyInfo, platformState) => accountReadResponse({ keyInfo, platformState });

test("a DeepSeek snapshot is one API key row described by the key's source, with no sign-in or sign-out", () => {
  const cases = [
    [deepseek({ configured: true, source: "file" }), "Saved in DeepSeek Harness (~/.dsh)"],
    [deepseek({ configured: true, source: "env" }), "From the DEEPSEEK_API_KEY environment variable"],
    [deepseek({ configured: true, source: "user-env" }), "Configured in DeepSeek Harness"],
    [deepseek({ configured: false }, { status: "credential-stored", links: null }), "Signed in to the DeepSeek Platform"],
    [deepseek({ configured: false }, { status: "signed-out", links: null }), "No API key. Add one in DeepSeek Harness or set DEEPSEEK_API_KEY."],
  ];
  for (const [snapshot, description] of cases) {
    const plan = accountSettingsPlan(snapshot);
    assert.deepEqual(plan, { kind: "deepseek", label: "DeepSeek API key", description, showSignOut: false, showSignIn: false, manageUrl: "https://platform.deepseek.com/api_keys" });
    assert.doesNotMatch(JSON.stringify(plan), /ChatGPT|Sign out/);
  }
  assert.match(accountSettingsPlan(deepseek({ configured: false })).description, /DEEPSEEK_API_KEY/);
  assert.equal(DEEPSEEK_KEYS_URL, "https://platform.deepseek.com/api_keys");
});

test("the Codex core keeps the legacy rows; the DeepSeek core never falls back to them", () => {
  assert.deepEqual(accountSettingsPlan({ account: { type: "chatgpt", planType: "plus" }, requiresOpenaiAuth: true }), { kind: "legacy" });
  assert.deepEqual(accountSettingsPlan(null), { kind: "legacy" });
  assert.deepEqual(accountSettingsPlan(null, { engine: "codex" }), { kind: "legacy" });
  assert.equal(accountSettingsPlan(null, { engine: "deepseek" }).description, "Account unavailable");
  // A DeepSeek core without the extension (no credentials service): only the account is known.
  assert.equal(accountSettingsPlan({ account: { type: "apiKey" }, requiresOpenaiAuth: false }, { engine: "deepseek" }).description, "Configured in DeepSeek Harness");
  assert.match(accountSettingsPlan({ account: null, requiresOpenaiAuth: false }, { engine: "deepseek" }).description, /DEEPSEEK_API_KEY/);
  assert.equal(deepseekKeyDescription(undefined, null), "No API key. Add one in DeepSeek Harness or set DEEPSEEK_API_KEY.");
});

let server, M;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, ".."), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: "custom", logLevel: "error" });
  M = await server.ssrLoadModule("/src/source-account-settings.jsx");
});
after(() => server?.close());
const noBackend = () => { throw Error("SSR may not call the backend"); };
function rows(props) {
  let result;
  function Probe() {
    result = M.useAccountSettings({ connected: true, busy: false, onLogin: noBackend, onAccountAction: noBackend, onRefreshAccount: noBackend, onOpenExternal: noBackend, ...props });
    return React.createElement(React.Fragment, null, result.map((row) => React.createElement("section", { key: row.id, "data-row": row.id, "data-search": row.searchText ?? "" }, row.label, " ", row.description, row.control, row.below)));
  }
  const html = renderToStaticMarkup(React.createElement(Probe));
  return { rows: result, html };
}

test("rendered DeepSeek rows: Refresh and Manage keys only; Codex rows still offer Sign out and ChatGPT sign-in", () => {
  for (const snapshot of [deepseek({ configured: true, source: "file" }), deepseek({ configured: false })]) {
    const { rows: list, html } = rows({ snapshot, engine: "deepseek" });
    assert.deepEqual(list.map((row) => row.id), ["account"]);
    assert.equal(list[0].label, "DeepSeek API key");
    assert.match(html, />Refresh</);
    assert.match(html, />Manage keys</);
    assert.doesNotMatch(html, /Sign out|ChatGPT|device code|API key authentication/);
    assert.doesNotMatch(list[0].searchText, /Sign out|ChatGPT/);
    assert.match(list[0].searchText, /Manage keys/);
  }
  const unconfigured = rows({ snapshot: deepseek({ configured: false }), engine: "deepseek" });
  assert.match(unconfigured.html, /DEEPSEEK_API_KEY/);
  const codexSignedIn = rows({ snapshot: { account: { type: "chatgpt", email: "a@example.invalid" }, requiresOpenaiAuth: true } });
  assert.match(codexSignedIn.html, />Sign out</);
  const codexSignedOut = rows({ snapshot: { account: null, requiresOpenaiAuth: true } });
  assert.match(codexSignedOut.html, /Sign in with ChatGPT/);
  assert.match(codexSignedOut.html, /Use device code/);
});

test("home: a DeepSeek core without a key gets the key card; the ChatGPT card is only for the Codex core", async () => {
  const fs = await import("node:fs/promises");
  const main = await fs.readFile(path.join(import.meta.dirname, "..", "src/main.jsx"), "utf8");
  assert.match(main, /boot\?\.connected && boot\.account\?\.deepseek && !boot\.account\.account && \(/);
  assert.match(main, /<span className="connection-card-title">\{t\("Add your DeepSeek API key"\)\}<\/span>\s*<span className="connection-card-body">\{t\("Save a key in DeepSeek Harness \(~\/\.dsh\) or set DEEPSEEK_API_KEY, then refresh\."\)\}<\/span>/);
  assert.match(main, /call\("account-auth", \{ operation: "refresh" \}\)[\s\S]{0,120}Refresh/);
  assert.match(main, /call\("external", \{ url: DEEPSEEK_KEYS_URL \}\)[\s\S]{0,120}Get an API key/);
  const chatgpt = main.slice(main.indexOf("boot.account?.requiresOpenaiAuth &&"), main.indexOf("Continue with your ChatGPT account."));
  assert.match(chatgpt, /!boot\.account\?\.deepseek &&/, "the ChatGPT card is gated off the DeepSeek core");
  // R02: the Codex card is titled for Codex, not 'Set up DeepSeek' above ChatGPT copy.
  assert.match(chatgpt, /<span className="connection-card-title">\{t\("Sign in to Codex"\)\}<\/span>/);
  assert.doesNotMatch(main, /Set up DeepSeek/);
});

// R02 wiring: without a key the composer warns (Retry re-reads account/read), send() refuses before any
// thread/start or turn/start, and the account menu reaches the key row in Settings › Preferences.
test("no-key wiring: composer warning + account refresh, a one-line send guard, the account-menu key item", async () => {
  const fs = await import("node:fs/promises");
  const main = await fs.readFile(path.join(import.meta.dirname, "..", "src/main.jsx"), "utf8");
  const missing = "boot?.connected && boot.account?.deepseek && !boot.account.account";
  const warning = main.slice(main.indexOf("warning={boot !== null"), main.indexOf("onStop={stop}"));
  assert.ok(warning.includes(`${missing} ? t("Add a DeepSeek API key to start a session.") : undefined}`));
  assert.ok(warning.includes(`onReconnect={${missing}\n                    ? () => call("account-auth", { operation: "refresh" }).catch((e) => setError(e.message)) : reconnect}`));
  const send = main.slice(main.indexOf("async function send({ priority } = {}) {"), main.indexOf("const parsed = parseSessionCommand(draft, commandContext);", main.indexOf("async function send({ priority } = {}) {")));
  assert.match(send, /\n\s+if \(boot\?\.account\?\.deepseek && !boot\.account\.account\) return;/);
  assert.doesNotMatch(send, /setDraft|thread\/start|turn\/start/, "the guard keeps the draft and starts nothing");
  assert.match(main, /\{boot\?\.account\?\.deepseek && <SourceMenu\.Item icon="Key" data-testid="user-menu-deepseek-key" onClick=\{\(\) => setSettings\("preferences"\)\}>\{t\("DeepSeek API key"\)\}<\/SourceMenu\.Item>\}/);
});
