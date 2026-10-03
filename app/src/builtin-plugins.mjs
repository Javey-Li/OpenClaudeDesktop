// Built-in plugin catalog for Settings › Plugins. A built-in entry is a
// DeepSeek Harness bundle this app knows how to install on its own, so a
// person can add it from the page instead of typing a package spec.
//
// dsh-purge is published on GitHub. Its install spec is the hosted repository
// URL, which @deepseek-ai/dsh-plugin-manager reads as a git spec
// (install-spec.js HOSTED_REPOSITORY_URL), so no registry release is needed.
// The entry carries the repository for display only; `spec` is what installs.

export const BUILTIN_PLUGINS = Object.freeze([
  Object.freeze({
    id: "dsh-purge",
    name: "dsh-purge",
    // The bundle name the plugin manager reports once it is installed.
    pluginName: "dsh-purge",
    author: "YuJunZhiXue",
    spec: "https://github.com/YuJunZhiXue/dsh-purge",
    repository: "https://github.com/YuJunZhiXue/dsh-purge",
    description: "Cybersecurity red-team plugin for DeepSeek Harness: clean host policy and a built-in drill console, with a prompt per model.",
  }),
]);

const text = (value) => (typeof value === "string" ? value : "");

// The installed catalog row for a built-in entry, or undefined. Matching is by
// bundle name, which is what the profile reports for an npm or git bundle.
export function builtinPluginRow(entry, rows = []) {
  const name = text(entry?.pluginName || entry?.name).toLowerCase();
  if (!name) return undefined;
  return rows.find((row) => text(row?.pluginName).toLowerCase() === name || text(row?.name).toLowerCase() === name);
}

// Search the built-in catalog the same way the installed table is searched
// (name, package name, description, author).
export function filterBuiltinPlugins(entries = BUILTIN_PLUGINS, { query = "" } = {}) {
  const term = text(query).trim().toLowerCase();
  if (!term) return entries;
  return entries.filter((entry) => `${entry.name} ${entry.pluginName} ${entry.description} ${entry.author}`.toLowerCase().includes(term));
}
