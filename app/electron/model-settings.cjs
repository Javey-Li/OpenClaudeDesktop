// C5 model parameters and pricing, main-process side.
//
// decorate(method, params) runs in the desktop:call "rpc" case after the
// bypass validation and before client.request. On the DeepSeek core only:
//   thread/start | thread/resume | turn/start
//     params.codeDesktop.customization.modelParams = {[wireModelId]: {maxTokens?, temperature?}} | null
//   account/usage/read
//     params.codeDesktop.prices = price overrides | null (official table)
// A Codex core receives nothing extra.
//
// run({op:'official-prices'}) asks the bridge for its official table
// (codeDesktop/pricing/read); a core without it answers {unsupported:true}.
//
// Custom OpenAI-compatible providers (ops providers-read / provider-save /
// provider-remove): the definitions live in <userData>/harness/providers.json,
// the keys encrypted with Electron safeStorage in
// <userData>/harness/provider-keys.bin. Both become one managed `llm-pi-ai`
// overlay row (harness-profile.cjs setManagedRow) and one env var per route
// (setCoreEnv), applied when the core restarts. Keys never reach
// preferences.json, the renderer or ~/.dsh.
//
// API connection (ops connection-read / connection-save): the DeepSeek core
// talks to the official API or to a third-party relay (an Anthropic
// Messages-compatible base URL). The mode and relay URL live in
// <userData>/harness/connection.json; each mode's key sits in the same
// encrypted provider-keys.bin under a reserved name ("@official", "@relay",
// never a valid route). They reach the core as DEEPSEEK_API_KEY and
// DEEPSEEK_BASE_URL (the inherited environment outranks ~/.dsh), applied when
// the core restarts. Without a saved key the launch environment or ~/.dsh applies.
// A relay that names models differently lists its ids (relayModels, or op
// connection-models reads its /v1/models); they replace the llm-deepseek
// adapter's catalog through one managed overlay row.
const fs = require("node:fs");
const path = require("node:path");
const { createRelayProxy } = require("./relay-proxy.cjs");
const METHOD_NOT_FOUND = -32601;
const DEEPSEEK_ENGINE = "deepseek-harness";
const THREAD_METHODS = new Set(["thread/start", "thread/resume", "turn/start"]);

// The pure prefs module is ESM. Electron 44 (Node 24) and the test runner can
// require it synchronously; the async import is a fallback loaded at startup.
let prefsModule = null;
const loading = import("./prefs/model-settings.mjs").then(module => { prefsModule ??= module; }, () => {});
function prefs() {
  if (prefsModule) return prefsModule;
  try { return prefsModule = require("./prefs/model-settings.mjs"); } catch { return null; }
}

function createModelSettings({ getConfig, getClient, app, getHarnessProfile = () => null, safeStorage, dir, relayProxy = createRelayProxy() }) {
  const isDeepSeek = client => client?.serverInfo?.engine === DEEPSEEK_ENGINE;
  const harnessDir = () => dir || path.join(app.getPath("userData"), "harness");
  const providersFile = () => path.join(harnessDir(), "providers.json");
  const keysFile = () => path.join(harnessDir(), "provider-keys.bin");
  const connectionFile = () => path.join(harnessDir(), "connection.json");
  // What the app was launched with, restored when a saved value is cleared.
  const inherited = { DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL };
  const storage = () => safeStorage ?? (safeStorage = require("electron").safeStorage);

  function writeAtomic(file, data, mode = 0o600) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, data, { mode });
    fs.renameSync(temp, file);
  }
  function readProviders() {
    try { return prefs().normalizeProviders(JSON.parse(fs.readFileSync(providersFile(), "utf8")).providers); } catch { return []; }
  }
  function readKeys() {
    let data;
    try { data = fs.readFileSync(keysFile()); } catch { return {}; }
    try {
      const parsed = JSON.parse(storage().decryptString(data));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? Object.fromEntries(Object.entries(parsed).filter(([, key]) => typeof key === "string" && key)) : {};
    } catch (error) {
      console.warn("Couldn’t read the provider keys:", error?.message || error);
      return {};
    }
  }
  function writeKeys(keys) {
    if (!Object.keys(keys).length) { fs.rmSync(keysFile(), { force: true }); return; }
    if (!storage()?.isEncryptionAvailable?.()) throw new Error("Secure storage is unavailable, so the API key can’t be saved.");
    writeAtomic(keysFile(), storage().encryptString(JSON.stringify(keys)));
  }
  // Export every stored key to the core's environment (before its next spawn).
  function exportKeys(providers = readProviders(), keys = readKeys(), previous = []) {
    const profile = getHarnessProfile();
    if (!profile?.setCoreEnv) return;
    for (const route of previous) if (!providers.some(provider => provider.route === route)) profile.setCoreEnv(prefs().providerKeyEnv(route), null);
    for (const provider of providers) profile.setCoreEnv(prefs().providerKeyEnv(provider.route), keys[provider.route] ?? null);
  }
  function readConnection() {
    try { return prefs().normalizeConnection(JSON.parse(fs.readFileSync(connectionFile(), "utf8"))); } catch { return prefs().normalizeConnection(null); }
  }
  // Relay mode routes the core through the loopback forwarder (relay-proxy.cjs).
  async function exportConnection(connection = readConnection(), keys = readKeys()) {
    const profile = getHarnessProfile();
    if (!profile?.setCoreEnv) return;
    const relay = connection.mode === "relay";
    const key = keys[relay ? prefs().CONNECTION_KEY_RELAY : prefs().CONNECTION_KEY_OFFICIAL];
    let base = inherited.DEEPSEEK_BASE_URL ?? null;
    if (relay) {
      try { base = await relayProxy.start(connection.relayBaseURL); }
      catch (error) { console.warn("Couldn’t start the relay forwarder; using the relay directly:", error?.message || error); base = connection.relayBaseURL; }
    } else await relayProxy.stop();
    profile.setCoreEnv("DEEPSEEK_API_KEY", key ?? inherited.DEEPSEEK_API_KEY ?? null);
    profile.setCoreEnv("DEEPSEEK_BASE_URL", base);
  }
  function connectionView() {
    const keys = readKeys();
    return {
      available: !!getHarnessProfile()?.setCoreEnv,
      ...readConnection(),
      officialKey: !!keys[prefs().CONNECTION_KEY_OFFICIAL],
      relayKey: !!keys[prefs().CONNECTION_KEY_RELAY],
      inheritedKey: !!inherited.DEEPSEEK_API_KEY,
    };
  }
  async function applyProviders(providers, keys, previousRoutes) {
    const profile = getHarnessProfile();
    if (!profile?.setManagedRow) throw new Error("Custom providers need Settings › Harness, which isn’t available.");
    writeAtomic(providersFile(), JSON.stringify({ version: 1, providers }, null, 2) + "\n", 0o644);
    writeKeys(keys);
    const row = prefs().providerOverlayRow(providers);
    if (row) await profile.setManagedRow(prefs().PROVIDER_ROW_ID, row);
    else await profile.removeManagedRow(prefs().PROVIDER_ROW_ID);
    exportKeys(providers, keys, previousRoutes);
  }
  function providersView() {
    const keys = readKeys();
    return {
      available: !!getHarnessProfile()?.setManagedRow,
      protocols: [...prefs().PROVIDER_PROTOCOLS],
      providers: readProviders().map(provider => ({ ...provider, keyEnv: prefs().providerKeyEnv(provider.route), hasKey: !!keys[provider.route] })),
    };
  }
  // Keys are exported once the app is ready (safeStorage needs it), before main's connect().
  // main.cjs connect() awaits ready() before the first core spawn, so the
  // relay forwarder's port is in the core's environment.
  const exported = !app?.whenReady ? Promise.resolve() : app.whenReady().then(async () => {
    await loading;
    try { if (prefs()) { exportKeys(); await exportConnection(); } } catch (error) { console.warn("Couldn’t export the provider keys:", error?.message || error); }
  });

  function decorate(method, params) {
    if (!params || typeof params !== "object" || !prefs() || !isDeepSeek(getClient())) return params;
    const settings = getConfig()?.modelSettings;
    if (THREAD_METHODS.has(method)) {
      const codeDesktop = params.codeDesktop && typeof params.codeDesktop === "object" ? params.codeDesktop : {};
      const customization = codeDesktop.customization && typeof codeDesktop.customization === "object" ? codeDesktop.customization : {};
      params.codeDesktop = { ...codeDesktop, customization: { ...customization, modelParams: prefs().modelParamsForCore(settings) } };
    } else if (method === "account/usage/read") {
      const codeDesktop = params.codeDesktop && typeof params.codeDesktop === "object" ? params.codeDesktop : {};
      params.codeDesktop = { ...codeDesktop, prices: prefs().pricesForCore(settings) };
    }
    return params;
  }

  async function run(p = {}) {
    await loading;
    if (!prefs()) throw new Error("Model settings aren’t available.");
    if (p.op === "providers-read") return providersView();
    if (p.op === "connection-read") return connectionView();
    if (p.op === "connection-save") {
      if (!getHarnessProfile()?.setCoreEnv) throw new Error("The API connection needs Settings › Harness, which isn’t available.");
      const connection = prefs().validateConnection({ ...readConnection(), ...p.connection });
      const keys = readKeys();
      for (const [field, name] of [["officialKey", prefs().CONNECTION_KEY_OFFICIAL], ["relayKey", prefs().CONNECTION_KEY_RELAY]]) {
        const value = p[field];
        if (typeof value === "string" && value.trim()) {
          if (value.length > 4096 || /[\x00-\x1f\x7f]/.test(value.trim())) throw new Error("Invalid API key.");
          keys[name] = value.trim();
        } else if (value === null) delete keys[name];
      }
      if (connection.mode === "relay" && !keys[prefs().CONNECTION_KEY_RELAY]) throw new Error("Enter the relay’s API key.");
      writeAtomic(connectionFile(), JSON.stringify({ version: 1, ...connection }, null, 2) + "\n", 0o644);
      writeKeys(keys);
      await exportConnection(connection, keys);
      // The relay's model ids replace the adapter's catalog (deepseek-flash / deepseek-v4-pro).
      const profile = getHarnessProfile(), row = prefs().relayCatalogRow(connection);
      if (row && profile.setManagedRow) await profile.setManagedRow(prefs().DEEPSEEK_ROW_ID, row);
      else if (!row && profile.removeManagedRow) await profile.removeManagedRow(prefs().DEEPSEEK_ROW_ID);
      return connectionView();
    }
    if (p.op === "connection-models") {
      // GET <base>/v1/models with the typed or the saved relay key; the key never goes back.
      const base = String(p.relayBaseURL ?? readConnection().relayBaseURL ?? "").trim().replace(/\/+$/, "");
      const urlError = prefs().relayBaseURLError(base);
      if (urlError) throw new Error(urlError);
      const key = typeof p.relayKey === "string" && p.relayKey.trim() ? p.relayKey.trim() : readKeys()[prefs().CONNECTION_KEY_RELAY];
      if (!key) throw new Error("Enter the relay’s API key.");
      const root = new URL(base).pathname.endsWith("/v1") ? base : `${base}/v1`;
      let response;
      try { response = await fetch(`${root}/models`, { headers: { authorization: `Bearer ${key}`, "x-api-key": key, "anthropic-version": "2023-06-01" }, signal: AbortSignal.timeout(20000) }); }
      catch (error) { throw new Error(`Couldn’t reach ${root}/models: ${error?.message || error}`); }
      if (!response.ok) throw new Error(`The relay answered ${response.status} for ${root}/models.`);
      const body = await response.json().catch(() => null);
      const list = Array.isArray(body?.data) ? body.data : Array.isArray(body?.models) ? body.models : [];
      return { models: prefs().parseRelayModels(list.map(item => typeof item === "string" ? item : item?.id).filter(id => typeof id === "string").slice(0, prefs().MAX_ENTRIES)) };
    }
    if (p.op === "provider-save") {
      const provider = prefs().validateProvider(p.provider);
      const providers = readProviders(), previousRoutes = providers.map(item => item.route);
      const index = providers.findIndex(item => item.route === (typeof p.previousRoute === "string" ? p.previousRoute : provider.route));
      if (providers.some((item, at) => item.route === provider.route && at !== index)) throw new Error("A provider with that id already exists.");
      if (index < 0 && providers.length >= prefs().MAX_PROVIDERS) throw new Error(`Use ${prefs().MAX_PROVIDERS} providers or fewer.`);
      const keys = readKeys(), oldRoute = index >= 0 ? providers[index].route : null;
      if (oldRoute && oldRoute !== provider.route) { if (keys[oldRoute]) keys[provider.route] = keys[oldRoute]; delete keys[oldRoute]; }
      if (typeof p.apiKey === "string" && p.apiKey.trim()) {
        if (p.apiKey.length > 4096 || /[\x00-\x1f\x7f]/.test(p.apiKey.trim())) throw new Error("Invalid API key.");
        keys[provider.route] = p.apiKey.trim();
      } else if (p.apiKey === null) delete keys[provider.route];
      if (index >= 0) providers[index] = provider; else providers.push(provider);
      await applyProviders(providers, keys, previousRoutes);
      return providersView();
    }
    if (p.op === "provider-remove") {
      const providers = readProviders(), previousRoutes = providers.map(item => item.route);
      const next = providers.filter(item => item.route !== p.route);
      if (next.length === providers.length) throw new Error("Unknown provider.");
      const keys = readKeys(); delete keys[p.route];
      await applyProviders(next, keys, previousRoutes);
      return providersView();
    }
    if (p.op !== "official-prices") throw new Error("Unsupported model settings operation.");
    const client = getClient();
    if (!client) return { unsupported: true };
    await client.start?.();
    if (!isDeepSeek(client)) return { unsupported: true };
    try {
      const result = await client.request("codeDesktop/pricing/read", {});
      if (!result || typeof result !== "object" || !result.official || typeof result.official !== "object") return { unsupported: true };
      return {
        official: result.official,
        aliases: result.aliases && typeof result.aliases === "object" ? result.aliases : {},
        pricingUrl: typeof result.pricingUrl === "string" ? result.pricingUrl : null,
        peakWindows: typeof result.peakWindows === "string" ? result.peakWindows : null,
      };
    } catch (error) {
      if (error?.code === METHOD_NOT_FOUND) return { unsupported: true };
      throw error;
    }
  }

  return { decorate, run, ready: () => exported, dispose: () => relayProxy.stop() };
}

module.exports = { createModelSettings };
