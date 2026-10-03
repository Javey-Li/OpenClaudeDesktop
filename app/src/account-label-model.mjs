// Account menu header and sidebar footer labels. Original sidebar-rows tV
// renders the identity line, then an org line `orgPrimary · orgSecondary`
// (or orgPrimary alone); the footer pw shows `identity · orgPrimary`. Code
// Desktop has one organisation, the DeepSeek API, and the account kind is
// the secondary part (never "DeepSeek · DeepSeek").

/**
 * @param {object | null | undefined} accountRead - account/read (boot.account)
 * @returns {{orgPrimary: string, orgSecondary: string | null}}
 */
export function accountMenuLines(accountRead) {
  return { orgPrimary: "DeepSeek API", orgSecondary: accountRead?.account?.type === "apiKey" ? "API key" : null };
}

/** The header's org line text. */
export function accountOrgLine({ orgPrimary, orgSecondary }) {
  return orgSecondary ? `${orgPrimary} · ${orgSecondary}` : orgPrimary;
}

/**
 * Footer and menu-header identity, after shared-21 IO (sidebar-rows.js:8597-8613): identity is the
 * principal's display name, else the provider label; with a principal the org line is the label plus
 * the subtitle, without one it is the subtitle alone. Locally the principal is the preferred name
 * (Settings › Profile), the provider label 'DeepSeek API' and the subtitle the account kind.
 * @param {string | null | undefined} displayName
 * @param {object | null | undefined} accountRead - account/read (boot.account)
 * @returns {{identity: string, orgPrimary: string | null, orgSecondary: string | null}}
 */
export function accountIdentity(displayName, accountRead) {
  const { orgPrimary: label, orgSecondary: subtitle } = accountMenuLines(accountRead);
  const name = typeof displayName === "string" ? displayName.trim() : "";
  return name ? { identity: name, orgPrimary: label, orgSecondary: subtitle } : { identity: label, orgPrimary: subtitle, orgSecondary: null };
}

/** The footer 'Connection settings' menu header (a retained local control) names the running core. */
export function connectionMenuHeader(engine, connected) {
  return `${engine === "deepseek" ? "DeepSeek Harness" : "Codex"} ${connected ? "connected" : "disconnected"}`;
}
