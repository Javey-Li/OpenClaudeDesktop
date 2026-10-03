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
const fs = require("node:fs");
const path = require("node:path");
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

function createModelSettings({ getConfig, getClient, app, getHarnessProfile = () => null, safeStorage, dir }) {
  const isDeepSeek = client => client?.serverInfo?.engine === DEEPSEEK_ENGINE;
  const harnessDir = () => dir || path.join(app.getPath("userData"), "harness");
  const providersFile = () => path.join(harnessDir(), "providers.json");
  const keysFile = () => path.join(harnessDir(), "provider-keys.bin");
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
  app?.whenReady?.().then(() => { try { if (prefs()) exportKeys(); } catch (error) { console.warn("Couldn’t export the provider keys:", error?.message || error); } });

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

  return { decorate, run };
}

module.exports = { createModelSettings };
