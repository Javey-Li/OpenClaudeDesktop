const fs = require('node:fs/promises');
const path = require('node:path');

// Only fields rendered in Developer. In particular, HTTP headers, tokens and
// environment values must not be included in this renderer-facing snapshot.
function mcpDefinitions(config) {
  return Object.entries(config?.mcp_servers || {}).flatMap(([name, value]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    return [{ name, ...(typeof value.command === 'string' ? { command: value.command } : {}),
      ...(typeof value.url === 'string' ? { url: value.url } : {}),
      args: Array.isArray(value.args) ? value.args.filter(arg => typeof arg === 'string') : [],
      environmentNames: [...new Set([...Object.keys(value.env || {}),
        ...(Array.isArray(value.env_vars) ? value.env_vars.filter(name => typeof name === 'string') : [])])],
    }];
  });
}

// Developer › Edit config opens the core's own configuration file: the
// DeepSeek core reports its profile patch (initialize configPath); a Codex
// app-server keeps config.toml in its home.
function editConfigTarget(serverInfo) {
  if (typeof serverInfo?.configPath === 'string' && serverInfo.configPath) return serverInfo.configPath;
  const home = serverInfo?.codexHome;
  if (typeof home !== 'string' || !home) throw new Error('DeepSeek Harness configuration location is unavailable.');
  return path.join(home, 'config.toml');
}

// desktop-settings-read: a method the core does not implement (-32601) is
// not a page error; `<key>Unsupported` lets the rows read as unavailable.
function recordSettingsFailure(result, key, error) {
  if (error?.code === -32601) result[`${key}Unsupported`] = true;
  else result.errors[key] = error?.message || String(error);
}

const within = (file, root) => file === root || file.startsWith(root + path.sep);

// dsh-session-persistence-jsonl encodeSegment: a session's directory under <root>/--<project>--/ is its id
// with '~' and every code unit outside [A-Za-z0-9._-] escaped as ~XXXX ('.' and '..' escaped whole).
function sessionSegment(id) {
  if (id === '.') return '~002E';
  if (id === '..') return '~002E~002E';
  let out = '';
  for (let i = 0; i < id.length; i++) {
    const ch = id[i];
    out += ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch) ? ch : '~' + id.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0');
  }
  return out;
}
// index.chunk-ChZ67Jhw.js cfi (Cache, Code Cache, GPUCache, Dawn*Cache) plus Chromium's other HTTP-side caches.
const WEB_CACHE = new Set(['Cache', 'Code Cache', 'GPUCache', 'Shared Dictionary', 'Service Worker']);
const webCache = name => WEB_CACHE.has(name) || /^Dawn.*Cache$/.test(name);

// The core the app runs (codex.cjs resolveCore): the DeepSeek Harness package around its bridge script,
// otherwise the core executable itself.
function storageCoreRoot(core) {
  if (core?.kind === 'deepseek' && typeof core.prefix?.[0] === 'string') return path.resolve(path.dirname(core.prefix[0]), '..');
  return typeof core?.command === 'string' && path.isAbsolute(core.command) ? core.command : null;
}

// Walk one root without following symlinks, skipping other measured roots nested inside it; each regular
// file goes to bucket(path segments below the root). A missing root is empty, not a lower bound.
async function measure(root, { io, limit, skip, bucket }) {
  const totals = new Map(), add = (key, size) => totals.set(key, (totals.get(key) || 0) + size);
  let stat, incomplete = false, visited = 0;
  try { stat = await io.lstat(root); } catch (error) { return { totals, incomplete: error?.code !== 'ENOENT', exists: false }; }
  if (stat.isFile()) { add(bucket([]), stat.size); return { totals, incomplete, exists: true }; }
  if (!stat.isDirectory()) return { totals, incomplete, exists: false };
  const todo = [{ directory: root, segments: [] }];
  while (todo.length) {
    if (visited >= limit) { incomplete = true; break; }
    const { directory, segments } = todo.pop();
    let entries;
    try { entries = await io.readdir(directory, { withFileTypes: true }); }
    catch { incomplete = true; continue; }
    for (const entry of entries) {
      if (++visited > limit) { incomplete = true; break; }
      const target = path.join(directory, entry.name), next = [...segments, entry.name];
      if (entry.isSymbolicLink() || skip.some(other => within(target, other))) continue;
      if (entry.isDirectory()) todo.push({ directory: target, segments: next });
      else if (entry.isFile()) {
        try {
          // Recheck the entry: a replaced symlink cannot make us count its target.
          const file = await io.lstat(target);
          if (file.isFile()) add(bucket(next), file.size);
        } catch { incomplete = true; }
      }
    }
  }
  return { totals, incomplete, exists: true };
}

// Fidelity F14: the original's storage areas (c71860c77-B72Ova_w.js ht/mt over index.chunk-ChZ67Jhw.js
// pfi/hfi). 'code': Code Desktop's own conversation history in the core home (sessions/*/<thread id> for
// active and archived threads, plus the bridge's code-desktop records) and its worktrees; everything else in
// that home (other apps' sessions, dsh-runtimes, profiles, ...) is an outside kind, shown but not counted
// (the original's 'Other Claude Code history'). 'runtime': the core package or executable. 'app': web
// caches, logs and everything else in userData. Each file is read at most once and no path is reported.
async function storageReport({ userData, dshHome, codexHome, coreRoot, coreName = 'DeepSeek Harness', threadIds = [], worktreeDirs = [],
  logs = [], limit = 100000, io = fs, now = Date.now }) {
  const home = dshHome ?? codexHome, ids = [...new Set(threadIds.filter(id => typeof id === 'string' && id))];
  const segments = new Set(ids.map(sessionSegment));
  // A dsh session directory is the encoded id; a Codex rollout file ends with -<id>.jsonl.
  const ownSession = name => {
    const stem = name.replace(/\.jsonl(?:\.zstd)?$/, '');
    return segments.has(stem) || ids.some(id => stem.endsWith('-' + id));
  };
  const roots = [];
  const addRoot = async (directory, area, bucket) => {
    if (typeof directory !== 'string' || !directory) return null;
    let resolved;
    try { resolved = await io.realpath(directory); } catch { resolved = path.resolve(directory); }
    if (roots.some(root => root.path === resolved)) return null;
    const root = { path: resolved, area, bucket };
    roots.push(root);
    return root;
  };
  if (home) await addRoot(home, 'code', parts => parts[0] === 'code-desktop' || (parts[0] === 'sessions' && parts.slice(1).some(ownSession)) ? 'history' : 'otherHistory');
  await addRoot(coreRoot, 'runtime', () => 'core');
  const worktrees = [];
  for (const directory of worktreeDirs) { const root = await addRoot(directory, 'code', () => 'worktrees'); if (root) worktrees.push(root); }
  for (const directory of logs) await addRoot(directory, 'app', () => 'logs');
  await addRoot(userData, 'app', parts => webCache(parts[0]) ? 'web' : 'other');
  const totals = { code: new Map(), runtime: new Map(), app: new Map() };
  let incomplete = false, worktreeCount = 0, runtimeFound = false;
  for (const root of roots) {
    const skip = roots.filter(other => other !== root && within(other.path, root.path)).map(other => other.path);
    const result = await measure(root.path, { io, limit, skip, bucket: root.bucket });
    incomplete ||= result.incomplete;
    if (result.exists && worktrees.includes(root)) worktreeCount++;
    if (result.exists && root.area === 'runtime') runtimeFound = true;
    for (const [key, bytes] of result.totals) totals[root.area].set(key, (totals[root.area].get(key) || 0) + bytes);
  }
  const kinds = (area, list) => list.map(([id, label, extra]) => ({ id, label, bytes: totals[area].get(id) || 0, ...extra }));
  const counted = list => list.reduce((sum, kind) => sum + (kind.outside ? 0 : kind.bytes), 0);
  const areas = [];
  if (home) {
    const list = kinds('code', [['history', 'Conversation history'], ['worktrees', 'Worktrees in use or with changes'], ['otherHistory', `Other ${coreName} history`, { outside: true }]]);
    areas.push({ id: 'code', label: 'Code sessions and worktrees', bytes: counted(list), sessionCount: ids.length, worktreeCount, kinds: list });
  }
  const runtime = kinds('runtime', [['core', coreName]]);
  areas.push({ id: 'runtime', label: 'Runtime', bytes: counted(runtime), name: coreName, versionCount: runtimeFound ? 1 : 0, kinds: runtime });
  const app = kinds('app', [['web', 'Web cache'], ['logs', 'Logs'], ['other', 'Other']]);
  areas.push({ id: 'app', label: 'App caches and logs', bytes: counted(app), kinds: app });
  return { computedAt: now(), bytes: areas.reduce((sum, area) => sum + area.bytes, 0), incomplete, areas };
}

module.exports = { mcpDefinitions, storageReport, storageCoreRoot, sessionSegment, editConfigTarget, recordSettingsFailure };
