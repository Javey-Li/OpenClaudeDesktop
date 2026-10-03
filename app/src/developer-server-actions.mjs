import { t } from '../electron/i18n/index.mjs';

// Dot-delimited names need quoted key paths in the existing RPC adapter; keep
// those on Edit config until that capability exists.
export function canRemoveDeveloperServer(definition, status) {
  return typeof definition?.name === 'string' && !status?.pluginId && /^[A-Za-z0-9_-]{1,64}$/.test(definition.name);
}

export async function removeDeveloperServer(name, { confirm, call, refresh }) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(name)) throw new Error(t('Use Edit config to remove this server.'));
  const accepted = await confirm(t('Are you sure you want to remove the MCP server “{name}”?\n\nThis changes the DeepSeek Harness configuration. Project or managed configuration may still provide this server.', { name }));
  if (!accepted) return false;
  let failure;
  try { await call({ operation: 'mcp-remove', name }); }
  catch (error) { failure = error; }
  // A reload can fail after the write succeeded. Re-read either way; do not
  // remove rows optimistically or erase the original actionable error.
  try { await refresh(); }
  catch (error) { failure ||= error; }
  if (failure) throw failure;
  return true;
}

// A removal refresh can overtake the initial settings read. Only the latest
// request in the mounted connection/session may paint a snapshot or error.
export function createSettingsSnapshotReader({ read, onValue, onError, refreshCatalog }) {
  let live = true, request = 0;
  return {
    async refresh(catalog = false) {
      if (!live) return;
      const version = ++request;
      try {
        const value = await read();
        if (live && version === request) {
          onValue(value);
          if (catalog) await refreshCatalog?.();
        }
        return value;
      } catch (reason) {
        if (live && version === request) onError(reason);
        throw reason;
      }
    },
    dispose() { live = false; },
  };
}
