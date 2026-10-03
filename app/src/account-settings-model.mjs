// Preferences › DeepSeek account: which account row the settings page renders.
// The DeepSeek core's account/read carries a `deepseek` extension (harness
// account.js) describing the API key without its value; that core has no
// ChatGPT sign-in, sign-out or device code, so those rows never appear there.
// Every other snapshot (the Codex core) keeps the legacy ChatGPT rows.
import { t } from "../electron/i18n/index.mjs";

export const DEEPSEEK_KEYS_URL = "https://platform.deepseek.com/api_keys";

/** The key row's description for account/read's `deepseek` facts. */
export function deepseekKeyDescription(deepseek, account) {
  const key = deepseek?.apiKey;
  if (key?.configured === true) {
    if (key.source === "file") return t("Saved in DeepSeek Harness (~/.dsh)");
    if (key.source === "env") return t("From the DEEPSEEK_API_KEY environment variable");
    return t("Configured in DeepSeek Harness");
  }
  if (deepseek?.platform === "credential-stored") return t("Signed in to the DeepSeek Platform");
  // A DeepSeek core answering without the extension: only the account itself is known.
  if (!deepseek && account) return t("Configured in DeepSeek Harness");
  return t("No API key. Add one in DeepSeek Harness or set DEEPSEEK_API_KEY.");
}

/**
 * @param {object | null | undefined} snapshot - account/read (boot.account)
 * @param {{engine?: "codex" | "deepseek"}} [options] - coreEngine(boot.core)
 * @returns {{kind: "legacy"} | {kind: "deepseek", label: string, description: string, showSignOut: false, showSignIn: false, manageUrl: string}}
 */
export function accountSettingsPlan(snapshot, { engine } = {}) {
  const deepseek = snapshot?.deepseek && typeof snapshot.deepseek === "object" ? snapshot.deepseek : null;
  if (!deepseek && engine !== "deepseek") return { kind: "legacy" };
  return {
    kind: "deepseek",
    label: t("DeepSeek API key"),
    description: snapshot == null ? t("Account unavailable") : deepseekKeyDescription(deepseek, snapshot.account),
    showSignOut: false,
    showSignIn: false,
    manageUrl: DEEPSEEK_KEYS_URL,
  };
}
