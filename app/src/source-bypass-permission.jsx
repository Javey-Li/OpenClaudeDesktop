import React, { useEffect, useRef, useState } from 'react';
import { ActionDialog } from './source-session-actions.jsx';
import { SourceSettingsButton } from './source-settings-button.jsx';
import { SourceDialogFooter } from './source-dialog.jsx';
import './source-bypass-permission.css';

// The opt-in is a local preference; mode selection is scoped to a session and
// connection. It never becomes a default for unrelated sessions or accounts.
export function useBypassPermission({ permission, enabled, mode, sessionKey, cwd, connectionKey, onChange }) {
  const [selected, setSelected] = useState(() => new Set()), [pending, setPending] = useState(null);
  const scope = JSON.stringify([connectionKey, sessionKey ?? null, sessionKey ? null : cwd]);
  const live = useRef(null); live.current = { scope, enabled, mode, pending };
  const previousConnection = useRef(connectionKey);
  useEffect(() => {
    if (!enabled || previousConnection.current !== connectionKey) { setSelected(new Set()); setPending(null); }
    previousConnection.current = connectionKey;
  }, [enabled, connectionKey]);
  useEffect(() => { setPending(null); }, [scope, mode]);
  const available = enabled && mode === 'code';
  const active = available && previousConnection.current === connectionKey && selected.has(scope);
  const clear = () => setSelected(current => { const next = new Set(current); next.delete(scope); return next; });
  return {
    permission: active ? 'bypass' : permission,
    available,
    forSession(id, folder) {
      const target = JSON.stringify([connectionKey, id ?? null, id ? null : folder]);
      return available && previousConnection.current === connectionKey && selected.has(target) ? 'bypass' : permission;
    },
    confirming: available && pending?.scope === scope,
    select(value) {
      if (value === 'bypass') { if (available && !active) setPending({ scope }); }
      else { clear(); setPending(null); onChange(value); }
    },
    confirm() {
      if (pending !== live.current.pending || pending?.scope !== live.current.scope || !live.current.enabled || live.current.mode !== 'code') return;
      setSelected(current => new Set(current).add(pending.scope)); setPending(null);
    },
    cancel() { setPending(null); },
    // Called only after a successful thread/start, before changing the current id.
    adoptSession(id) {
      if (!active || !id || scope !== live.current.scope || !live.current.enabled || live.current.mode !== 'code') return;
      setSelected(current => { const next = new Set(current); next.delete(scope); next.add(JSON.stringify([connectionKey, id, null])); return next; });
    },
    clear,
  };
}
// shared-frame rp ConfirmationDialog layout (alert title, size sm, no close button) on the shared
// SourceDialog; the warning body, workspace and note are its own children, and Cancel takes the
// initial focus (initialFocus "cancel").
export function SourceBypassDialog({ cwd, onConfirm, onClose, open, onExited }) {
  return <ActionDialog open={open} onExited={onExited} alert size="sm" title="Bypass all permissions?" className="source-bypass-dialog" showClose={false} onClose={onClose}>
    <p>DeepSeek will read, edit, and execute files without asking — including potentially destructive commands. Only use this in isolated or disposable environments.</p>
    {cwd && <div className="source-bypass-workspace">{cwd}</div>}
    <p className="source-bypass-note">Applies to this session’s next messages. You can change the mode at any time.</p>
    <SourceDialogFooter><SourceSettingsButton data-autofocus onClick={onClose}>Cancel</SourceSettingsButton><SourceSettingsButton variant="primary" onClick={onConfirm}>Bypass permissions</SourceSettingsButton></SourceDialogFooter>
  </ActionDialog>;
}
