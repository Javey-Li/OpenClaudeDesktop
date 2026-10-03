// Customize catalog operations (Skills / Connectors / Plugins) as a validated
// desktop:call family instead of widening the raw rpc allowlist. Every method
// exists in the installed Codex app-server schema (work/codex-schema-0.155.1
// ClientRequest.json): skills/list, skills/config/write, mcpServerStatus/list,
// config/mcpServer/reload, mcpServer/oauth/login, config/batchWrite,
// plugin/installed, plugin/read, hooks/list.
//
// skills/config/write and config/batchWrite edit the shared ~/.codex/config.toml
// (the only real mechanism); the renderer says so next to those controls. A
// core reporting capabilities.mcpConfigWrite false (the DeepSeek bridge loads
// MCP servers from its own profile patch) never receives config/batchWrite.
const fs = require("node:fs");
const path = require("node:path");

const SERVER_NAME = /^[A-Za-z0-9_.-]{1,64}$/;
const MCP_LIST_TIMEOUT = 15000;
const MCP_WRITE_TIMEOUT = 30000;

const SKILL_FILE_MAX_BYTES = 512 * 1024;

function createCustomizeOperations({ getClient, getConfig, knownCwd, stat = fs.promises.stat, readFile = fs.promises.readFile }) {
  // Only paths returned by the last skills/list may be toggled or read; the
  // name selector is never used.
  const knownSkillPaths = new Set();
  // Names from the last mcpServerStatus/list, so "mcp-add" never upserts over
  // a server the CLI already has in the shared ~/.codex/config.toml.
  const knownServerNames = new Set();

  const client = async () => { const owner = getClient(); await owner.start(); return owner; };
  const optionalString = (value, label) => {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value !== "string") throw new Error(`Invalid ${label}.`);
    return value;
  };
  function threadIdParam(threadId) {
    if (threadId === undefined || threadId === null || threadId === "") return undefined;
    const config = getConfig();
    if (typeof threadId !== "string" || ![...(config.threadIds || []), ...(config.archivedThreadIds || [])].includes(threadId)) throw new Error("Unknown session.");
    return threadId;
  }
  function cwdsParam(cwd) {
    if (cwd === undefined || cwd === null || cwd === "") return undefined;
    return [knownCwd(cwd)];
  }
  function serverName(name) {
    if (typeof name !== "string" || !SERVER_NAME.test(name)) throw new Error("Use 1–64 letters, digits, dots, dashes or underscores for the name.");
    return name;
  }
  function assertMcpWritable(owner) {
    const info = owner.serverInfo;
    if (info?.capabilities?.mcpConfigWrite === false)
      throw new Error(`Connector changes are not supported by the DeepSeek core. Add a @deepseek-ai/dsh-mcp-client entry to ${info.configPath || "the core profile"}, then Reconnect.`);
  }
  async function skillUpdatedAt(skillPath) {
    // SkillMetadata.path is the SKILL.md file; a directory path also works.
    const candidates = skillPath.endsWith("SKILL.md") ? [skillPath] : [path.join(skillPath, "SKILL.md"), skillPath];
    for (const candidate of candidates) {
      try {
        const info = await stat(candidate);
        return Math.floor(info.mtimeMs / 1000);
      } catch { /* try the next candidate */ }
    }
    return null;
  }

  async function run(p = {}) {
    const operation = p.operation;
    switch (operation) {
      case "skills": {
        const owner = await client();
        const params = {};
        const cwds = cwdsParam(p.cwd);
        if (cwds) params.cwds = cwds;
        if (p.forceReload === true) params.forceReload = true;
        const result = await owner.request("skills/list", params);
        const updatedAt = {};
        knownSkillPaths.clear();
        for (const entry of result?.data || []) {
          for (const skill of entry?.skills || []) {
            if (typeof skill?.path !== "string" || !skill.path) continue;
            knownSkillPaths.add(skill.path);
            if (!(skill.path in updatedAt)) updatedAt[skill.path] = await skillUpdatedAt(skill.path);
          }
        }
        return { data: result?.data || [], updatedAt };
      }
      case "skill-file": {
        // SKILL.md of a listed skill, read straight from disk (there is no
        // app-server method for it). Missing file => content null, which the
        // renderer draws as the official "No files to show."
        if (typeof p.path !== "string" || !knownSkillPaths.has(p.path)) throw new Error("Unknown skill.");
        const target = p.path.endsWith("SKILL.md") ? p.path : path.join(p.path, "SKILL.md");
        let info;
        try { info = await stat(target); }
        catch { return { path: target, content: null }; }
        if (typeof info.isFile === "function" && !info.isFile()) return { path: target, content: null };
        if (Number.isFinite(info.size) && info.size > SKILL_FILE_MAX_BYTES) throw new Error("The skill file is too large to show.");
        return { path: target, content: await readFile(target, "utf8") };
      }
      case "skill-toggle": {
        if (typeof p.path !== "string" || !knownSkillPaths.has(p.path)) throw new Error("Unknown skill.");
        if (typeof p.enabled !== "boolean") throw new Error("Invalid skill setting.");
        const owner = await client();
        const result = await owner.request("skills/config/write", { path: p.path, enabled: p.enabled });
        return { effectiveEnabled: typeof result?.effectiveEnabled === "boolean" ? result.effectiveEnabled : p.enabled };
      }
      case "mcp": {
        const owner = await client();
        const params = { detail: "toolsAndAuthOnly" };
        const threadId = threadIdParam(p.threadId);
        if (threadId) params.threadId = threadId;
        const cursor = optionalString(p.cursor, "cursor");
        if (cursor) params.cursor = cursor;
        // The listing may start configured servers; bound the wait.
        const result = await owner.request("mcpServerStatus/list", params, MCP_LIST_TIMEOUT);
        knownServerNames.clear();
        for (const server of result?.data || []) if (typeof server?.name === "string" && server.name) knownServerNames.add(server.name);
        return result;
      }
      case "mcp-reload": {
        const owner = await client();
        await owner.request("config/mcpServer/reload", {}, MCP_WRITE_TIMEOUT);
        return true;
      }
      case "mcp-login": {
        const owner = await client();
        const params = { name: serverName(p.name) };
        const threadId = threadIdParam(p.threadId);
        if (threadId) params.threadId = threadId;
        const result = await owner.request("mcpServer/oauth/login", params, MCP_WRITE_TIMEOUT);
        const url = new URL(String(result?.authorizationUrl || ""));
        if (!["https:", "http:"].includes(url.protocol)) throw new Error("The sign-in URL is not supported.");
        // The renderer opens it through the "external" operation; never loaded here.
        return { authorizationUrl: url.href };
      }
      case "mcp-add": {
        const name = serverName(p.name);
        const owner = await client();
        assertMcpWritable(owner);
        // An upsert on an existing mcp_servers.<name> would silently replace
        // the CLI's command/args/env/url. Refuse instead; removal stays the
        // explicit, confirmation-gated path.
        if (knownServerNames.has(name)) throw new Error(`A connector named ${name} is already in ~/.codex/config.toml. Remove it first or choose another name.`);
        const value = mcpServerValue(p);
        await owner.request("config/batchWrite", { edits: [{ keyPath: `mcp_servers.${name}`, value, mergeStrategy: "upsert" }], reloadUserConfig: true }, MCP_WRITE_TIMEOUT);
        await owner.request("config/mcpServer/reload", {}, MCP_WRITE_TIMEOUT);
        return { name, value };
      }
      case "mcp-remove": {
        // A null value clears the key (config_manager_service apply_merge →
        // clear_path); verified against an isolated CODEX_HOME before use.
        const name = serverName(p.name);
        const owner = await client();
        assertMcpWritable(owner);
        await owner.request("config/batchWrite", { edits: [{ keyPath: `mcp_servers.${name}`, value: null, mergeStrategy: "replace" }], reloadUserConfig: true }, MCP_WRITE_TIMEOUT);
        await owner.request("config/mcpServer/reload", {}, MCP_WRITE_TIMEOUT);
        knownServerNames.delete(name);
        return { name };
      }
      case "plugins": {
        const owner = await client();
        const params = {};
        const cwds = cwdsParam(p.cwd);
        if (cwds) params.cwds = cwds;
        return owner.request("plugin/installed", params);
      }
      case "plugin-read": {
        if (typeof p.pluginName !== "string" || !p.pluginName) throw new Error("Unknown plugin.");
        const owner = await client();
        const params = { pluginName: p.pluginName };
        const marketplacePath = optionalString(p.marketplacePath, "marketplace path");
        if (marketplacePath) params.marketplacePath = marketplacePath;
        return owner.request("plugin/read", params);
      }
      case "hooks": {
        const owner = await client();
        const params = {};
        const cwds = cwdsParam(p.cwd);
        if (cwds) params.cwds = cwds;
        return owner.request("hooks/list", params);
      }
      default:
        throw new Error("Unknown customize operation.");
    }
  }
  return { run, knownSkillPaths, knownServerNames };
}

// Validate the "Add custom connector" form into a mcp_servers.<name> table:
// stdio {command,args} or streamable HTTP {url}. Arguments must already be an
// array of non-empty strings.
function mcpServerValue({ command, args, url } = {}) {
  const cmd = typeof command === "string" ? command.trim() : "";
  const link = typeof url === "string" ? url.trim() : "";
  if (cmd) {
    if (cmd.includes("\0")) throw new Error("Invalid command.");
    const list = Array.isArray(args) ? args : [];
    if (list.some((item) => typeof item !== "string" || !item || item.includes("\0"))) throw new Error("Invalid arguments.");
    return list.length ? { command: cmd, args: list } : { command: cmd };
  }
  if (link) {
    let parsed;
    try { parsed = new URL(link); } catch { throw new Error("Enter a valid http(s) URL."); }
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Enter a valid http(s) URL.");
    return { url: parsed.href };
  }
  throw new Error("Enter a command or a URL.");
}

module.exports = { createCustomizeOperations, mcpServerValue, SERVER_NAME, MCP_LIST_TIMEOUT, SKILL_FILE_MAX_BYTES };
