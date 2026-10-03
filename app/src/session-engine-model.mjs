// Which agent core owns a remembered session, and how loadSessions splits the
// config's session ids between the running core and the other one. The ids
// themselves are never dropped from config: starting Code Desktop with the
// other core (CODE_DESKTOP_CORE=codex) brings those sessions back.

// Thread.cliVersion is "dsh <version>" from the DeepSeek bridge
// (harness codex-app-server threadObject) and a bare semver from Codex.
export function sessionEngine(meta) {
  const version = String(meta?.cliVersion ?? "");
  if (version.startsWith("dsh ")) return "deepseek";
  if (/^\d/.test(version) || meta?.modelProvider === "openai") return "codex";
  return null;
}

// boot.core.engine from initialize; anything but the DeepSeek bridge is Codex.
export const coreEngine = (core) => (core?.engine === "deepseek-harness" ? "deepseek" : "codex");

/**
 * @param {{ids?: string[], results?: PromiseSettledResult<{thread?: object}>[], metadata?: Record<string, object>, archivedIds?: string[], engine?: "codex"|"deepseek"}} input
 *   ids: config.threadIds, results: thread/read per id (same order),
 *   metadata: config.threadMetadata, archivedIds: config.archivedThreadIds.
 * @returns {{active: object[], archived: object[], otherEngine: number, missing: number}}
 *   active: read threads, newest first; archived: remembered rows this core
 *   can open; otherEngine: hidden sessions recorded by the other core;
 *   missing: other ids that could not be read.
 */
export function partitionSessions({ ids = [], results = [], metadata = {}, archivedIds = [], engine = "codex" } = {}) {
  const active = [], archived = [];
  let otherEngine = 0, missing = 0;
  const foreign = (id) => {
    const owner = sessionEngine(metadata[id]);
    return owner !== null && owner !== engine;
  };
  ids.forEach((id, index) => {
    const result = results[index];
    if (result?.status === "fulfilled" && result.value?.thread) active.push(result.value.thread);
    else if (foreign(id)) otherEngine += 1;
    else missing += 1;
  });
  active.sort((a, b) => b.updatedAt - a.updatedAt);
  for (const id of archivedIds) {
    const meta = metadata[id];
    if (!meta) continue;
    const owner = sessionEngine(meta);
    // An unattributed row predates engine tags, so only Codex shows it.
    if (owner === engine || (owner === null && engine === "codex")) archived.push({ ...meta, archived: true });
    else if (foreign(id)) otherEngine += 1;
  }
  return { active, archived, otherEngine, missing };
}

// The one-line sidebar notice for sessions loadSessions kept out of the list.
export function hiddenSessionsNotice(hidden, engine = "codex") {
  const otherEngine = hidden?.otherEngine || 0, missing = hidden?.missing || 0;
  const sessions = (n, kind) => `${n} ${kind}session${n === 1 ? " isn’t" : "s aren’t"}`;
  const parts = [];
  // Sessions that belong to the other core stay silently hidden (user preference); only real load failures are noted.
  void otherEngine;
  if (missing > 0) parts.push(`${missing} session${missing === 1 ? "" : "s"} could not be loaded.`);
  return parts.join(" ");
}
