import React, { useEffect, useRef, useState } from 'react';
import { ActionDialog } from './source-session-actions.jsx';
import { SourceSettingsButton } from './source-settings-button.jsx';
import { SourceDialogFooter } from './source-dialog.jsx';
import './source-bypass-permission.css';
import { t } from '../electron/i18n/index.mjs';
import { assistantName } from './persona-store.mjs';

// wr's securityLink target (ion-dist c936fcd42): the permission-mode and sandbox guidance Bypass skips. Claude's own page
// covers Claude Code only, so the dialog links the running core's guidance instead (bypassGuide).
export const SECURITY_GUIDE_URL = 'https://code.claude.com/docs/en/security';
/** The running core's Bypass guidance: its descriptor's securityUrl (a security guide), else its homepage, else null. */
export function bypassGuide(descriptor) {
  const https = (value) => typeof value === 'string' && /^https:\/\//.test(value) ? value : null;
  const name = typeof descriptor?.name === 'string' && descriptor.name ? descriptor.name : null;
  if (!name) return null;
  if (https(descriptor.securityUrl)) return { url: descriptor.securityUrl, name, label: 'security guide' };
  if (https(descriptor.homepage)) return { url: descriptor.homepage, name, label: 'documentation' };
  return null;
}

// The opt-in is a local preference. Confirming Bypass in the Mode menu remembers it as the mode (like every other
// mode, preference 'permission'), so new sessions, reconnects and restarts keep it while the opt-in stays on
// (preferences.mjs drops it back to Auto when the opt-in is turned off; main checks the core's requirements when
// it is saved and validates every Bypass request). A scope-bound selection still covers a Bypass carried by a
// core switch (carry) before the remembered mode is saved.
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
  const remembered = permission === 'bypass', base = remembered ? 'auto' : permission;
  const active = available && (remembered || (previousConnection.current === connectionKey && selected.has(scope)));
  const clear = () => setSelected(current => { const next = new Set(current); next.delete(scope); return next; });
  return {
    permission: active ? 'bypass' : base,
    available,
    remembered: available && remembered,
    forSession(id, folder) {
      const target = JSON.stringify([connectionKey, id ?? null, id ? null : folder]);
      return available && (remembered || (previousConnection.current === connectionKey && selected.has(target))) ? 'bypass' : base;
    },
    confirming: available && pending?.scope === scope,
    select(value) {
      if (value === 'bypass') { if (available && !active) setPending({ scope }); }
      else { clear(); setPending(null); onChange(value); }
    },
    confirm() {
      if (pending !== live.current.pending || pending?.scope !== live.current.scope || !live.current.enabled || live.current.mode !== 'code') return;
      setSelected(current => new Set(current).add(pending.scope)); setPending(null);
      onChange('bypass');
    },
    cancel() { setPending(null); },
    // The plan card's 'Accept/Implement and bypass permissions' (approval-current.js Mk bypassPermissions): the
    // click on that explicitly labelled action is the confirmation, so it takes the current scope without the
    // dialog (main validated the opt-in and the core's requirements for that answer or turn). Other modes select.
    adopt(value) {
      if (value !== 'bypass') { clear(); setPending(null); onChange(value); return; }
      if (!live.current.enabled || live.current.mode !== 'code') return;
      setSelected(current => new Set(current).add(live.current.scope)); setPending(null);
      onChange('bypass');
    },
    // A user core switch carried Bypass to this connection (main.cjs bypassCarry): the current scope takes it
    // without asking again; the caller checks it is the scope confirmed before the switch (bypass-carry.mjs
    // carryApplies). False when it can't apply here.
    carry() {
      if (!available || previousConnection.current !== connectionKey) return false;
      setSelected(current => new Set(current).add(scope)); setPending(null);
      return true;
    },
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
export function SourceBypassDialog({ cwd, guide = null, onConfirm, onClose, open, onExited }) {
  return <ActionDialog open={open} onExited={onExited} alert size="sm" title={t("Bypass all permissions?")} className="source-bypass-dialog" showClose={false} onClose={onClose}>
    <p>{t("{name} will read, edit, and execute files without asking — including potentially destructive commands. Only use this in isolated or disposable environments.", { name: assistantName() })}</p>
    {cwd && <div className="source-bypass-workspace">{cwd}</div>}
    {/* wr: p.mt-3.text-footnote.text-muted ending 'Read our <securityLink>security guide</securityLink> for details.'
        (a TextLink, external). OpenClaude Desktop keeps its own persistence sentence (it remembers Bypass as the mode). */}
    <p className="source-bypass-note">{t("Stays on for new sessions until you change the mode. You can change it at any time.")}
      {guide && <>{" "}{t("Read {core}’s {link} for details.", { core: guide.name, link: "{link}" }).split(/\{link\}/).flatMap((piece, index) => index ? [<button key="link" type="button" data-cds="TextLink" className="source-bypass-link"
        onClick={() => void globalThis.desktop?.call?.("external", { url: guide.url })?.catch?.(() => {})}>{guide.label === "security guide" ? t("security guide") : t("documentation")}</button>, piece] : [piece])}</>}</p>
    <SourceDialogFooter><SourceSettingsButton data-autofocus onClick={onClose}>{t("Cancel")}</SourceSettingsButton><SourceSettingsButton variant="primary" onClick={onConfirm}>{t("Bypass permissions")}</SourceSettingsButton></SourceDialogFooter>
  </ActionDialog>;
}
