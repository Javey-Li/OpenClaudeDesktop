import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { rateLimitRows } from './session-command-model.mjs';
import { SourceDialog, SourceDialogFooter } from './source-dialog.jsx';
import { SourceSettingsButton } from './source-settings-button.jsx';
import { SourceShortcut } from './source-shortcut';
import { shortcutsDialogSections } from './shortcuts-dialog-model.mjs';
import './source-session-actions.css';
import { t } from '../electron/i18n/index.mjs';

// The local action dialogs (Review code, Help, Rewind, Keyboard shortcuts, Run workflow, Bypass) on the
// shared CDS Dialog (source-dialog.jsx: shared-frame-C_2npUJq.js:5561-5574, :5738-5869). The props API is
// unchanged; open/onExited/size/alert/description/bleed/initialFocusRef/footer pass through to SourceDialog.
export function ActionDialog({ title, onClose, children, className = '', showClose = true, ...props }) {
  return <SourceDialog {...props} title={title} onClose={onClose} showClose={showClose} className={`session-action-dialog ${className}`.trim()}>
    {children}
  </SourceDialog>;
}

// shared-21-D098Wd--.js:14583-14625 IR: Dialog size md in comfortable density, the bleed header
// 'Keyboard shortcuts', initial focus on the popup, then one focusable scrolling region
// (rounded-lg, focus-visible shadow-focus) holding zR's sections (OR :14462-14464) and rows
// ($ :14466-14506: label text-sm text-secondary, keycap Shortcuts with 'or' between them).
export function KeyboardShortcutsDialog({ fastMode = false, onClose, ...dialog }) {
  return <ActionDialog {...dialog} title={t("Keyboard shortcuts")} size="md" bleed density="comfortable" className="shortcuts-dialog" onClose={onClose}>
    <div role="region" aria-label={t("Keyboard shortcuts")} tabIndex={0} className="shortcuts-region">
      {shortcutsDialogSections({ fastMode }).map(section => <div key={section.title}>
        <div className="shortcuts-section">{section.title}</div>
        {section.rows.map(row => <div key={row.command} className="shortcuts-row" data-command={row.command}>
          <span className="shortcuts-label">{row.label}</span>
          <span className="shortcuts-keys">{row.keys.map((keys, index) => <React.Fragment key={keys}>
            {index > 0 && <span aria-hidden="true" className="shortcuts-or">{t("or")}</span>}
            <SourceShortcut keys={keys} />
          </React.Fragment>)}</span>
        </div>)}
      </div>)}
    </div>
  </ActionDialog>;
}

export function ReviewDialog({ initialInstructions='', workspaceInfo, onSubmit, onClose, ...dialog }) {
  const [type,setType]=useState(initialInstructions || workspaceInfo?.isRepo === false ? 'custom':'uncommittedChanges'),[value,setValue]=useState(initialInstructions),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const submitting=useRef(false);
  const fields={baseBranch:'branch',commit:'sha',custom:'instructions'};
  return <ActionDialog {...dialog} title={t("Review code")} onClose={onClose}>
    <form onSubmit={async e=>{e.preventDefault();if(submitting.current || type!=='uncommittedChanges'&&!value.trim())return;submitting.current=true;setBusy(true);setError('');try{await onSubmit({type,...(fields[type]?{[fields[type]]:value.trim()}:{})});}catch(e){setError(e.message);}finally{submitting.current=false;setBusy(false);}}}>
      <p>{t("DeepSeek reviews in a read-only sandbox without approval prompts. You can stop the review from this conversation.")}</p>
      <label>{t("Review target")}<select data-autofocus aria-label={t("Review target")} value={type} disabled={busy} onChange={e=>{setType(e.target.value);setValue('');setError('');}}>
        <option value="uncommittedChanges" disabled={!workspaceInfo?.isRepo}>{t("Uncommitted changes")}</option>
        <option value="baseBranch" disabled={!workspaceInfo?.isRepo}>{t("Compare against a branch")}</option>
        <option value="commit" disabled={!workspaceInfo?.isRepo}>{t("A commit")}</option><option value="custom">{t("Custom instructions")}</option>
      </select></label>
      {type==='baseBranch' && <label>{t("Base branch")}<input aria-label={t("Base branch")} list="review-branches" placeholder="main" value={value} disabled={busy} onChange={e=>setValue(e.target.value)}/><datalist id="review-branches">{workspaceInfo?.branches?.map(branch=><option key={branch} value={branch}/>)}</datalist></label>}
      {type==='commit' && <label>{t("Commit")}<input aria-label={t("Commit")} placeholder={t("Commit SHA or reference")} value={value} disabled={busy} onChange={e=>setValue(e.target.value)}/></label>}
      {type==='custom' && <label>{t("Review instructions")}<textarea aria-label={t("Review instructions")} rows={5} maxLength={12000} value={value} disabled={busy} onChange={e=>setValue(e.target.value)}/></label>}
      {!workspaceInfo?.isRepo && type!=='custom' && <p>{t("Select custom instructions, or open a session in a Git repository.")}</p>}
      {error && <p role="alert" className="session-action-error">{error}</p>}
      {/* Qf footer with CDS Buttons: busy keeps Start review in place with its spinner (ks busy). */}
      <SourceDialogFooter><SourceSettingsButton onClick={onClose}>{t("Cancel")}</SourceSettingsButton><SourceSettingsButton type="submit" variant="primary" busy={busy}
        disabled={(type!=='custom'&&!workspaceInfo?.isRepo) || (type!=='uncommittedChanges'&&!value.trim())}>{t("Start review")}</SourceSettingsButton></SourceDialogFooter>
    </form>
  </ActionDialog>;
}

const count = value => Number.isFinite(value) && value>=0 ? Intl.NumberFormat().format(value) : t('Unavailable');
export function SessionStatusDialog({ session, model, effort, serviceTier, permission, cwd, usage, connected, running, operation, account, readStatus, onClose, inline=false }) {
  const [remote,setRemote]=useState(null),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
  useEffect(()=>{let live=true;setLoading(true);setRemote(null);readStatus().then(value=>{if(live)setRemote(value);}).catch(error=>{if(live)setRemote({error:error.message});}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[revision,connected]);
  const rows=rateLimitRows(remote?.limits), currentAccount=remote?.account?.account || account?.account;
  const Frame=inline?InlineStatusFrame:ActionDialog;
  return <Frame title={t("Session status")} onClose={onClose}>
    <dl className="session-status-details">
      <dt>{t('Connection')}</dt><dd>{connected?t('Connected to local DeepSeek'):t('Disconnected')}</dd>
      <dt>{t('Account')}</dt><dd>{currentAccount?.type==='chatgpt' ? [currentAccount.email,currentAccount.planType].filter(Boolean).join(' · ') || 'ChatGPT' : currentAccount?.type==='apiKey' ? t('API key') : t('Unavailable')}</dd>
      <dt>{t('Session')}</dt><dd>{session?.name || session?.preview || (session?t('Untitled session'):t('New session'))}{session && <small>{session.id}</small>}</dd>
      <dt>{t('Task state')}</dt><dd>{session?.archived?t('Archived'):!connected?t('Unknown while disconnected'):operation?.phase==='unknown'?t('Awaiting DeepSeek confirmation'):running?t('Running'):operation?.phase==='starting'?t('Starting'):t('Idle')}</dd>
      <dt>{t('Next message model')}</dt><dd>{model || t('Unavailable')}{effort ? ` · ${t('{effort} effort', { effort })}` : ''}</dd>
      <dt>{t("Next message speed")}</dt><dd>{serviceTier || t("Standard")}</dd>
      <dt>{t('Next message permissions')}</dt><dd>{permission==='bypass'?t('Bypass · full access without approval'):permission==='plan'?t('Plan · read-only'):permission==='ask'?t('Manual · every change requires approval'):permission==='acceptEdits'?t('Accept edits · file edits apply without approval'):t('Auto · DeepSeek requests approval when needed')}</dd>
      <dt>{t('Workspace')}</dt><dd>{cwd || t('Unavailable')}</dd>
      <dt>{t('Context tokens')}</dt><dd>{count(usage?.last?.totalTokens)}{Number.isFinite(usage?.modelContextWindow)&&usage.modelContextWindow>0?` / ${count(usage.modelContextWindow)}`:''}</dd>
      <dt>{t('Session tokens')}</dt><dd>{count(usage?.total?.totalTokens)}</dd>
    </dl>
    <section className="session-status-limits" aria-label={t("Account usage limits")}><h3>{t("Account usage limits")}</h3>
      {loading?<p role="status">{t("Loading usage limits")}</p>:rows.length?rows.map(row=><div className="session-limit" key={row.key}><span>{row.label}<strong>{t("{percent}% remaining", { percent: row.remaining.toLocaleString() })}</strong></span><progress max={100} value={row.remaining}/>{row.resetsAt!==null&&<small>{t("Resets {date}", { date: new Date(row.resetsAt*1000).toLocaleString() })}</small>}</div>):<p>{t("Unavailable for this account or connection.")}</p>}
      {remote?.error&&<p role="alert" className="session-action-error">{remote.error}</p>}
    </section>
    <footer><span className="session-action-hint">{t("Context appears after DeepSeek reports usage.")}</span><button data-autofocus disabled={loading||!connected} onClick={()=>setRevision(x=>x+1)}>{t("Refresh")}</button></footer>
  </Frame>;
}

function InlineStatusFrame({title,onClose,children}) {return <section className="slash-local-status" aria-label={title}><header><h3>{title}</h3><button aria-label={t("Dismiss session status")} onClick={onClose}><Icon name="X" size={14}/></button></header>{children}</section>;}
export function SlashHelp({onClose,...dialog}) {return <ActionDialog {...dialog} title={t("Help and support")} onClose={onClose}><p>{t("Code Desktop runs local DeepSeek sessions. Slash commands open tools, settings and conversation actions.")}</p><p>{t("Use the command menu to see the actions available in this session. Session files and approvals are managed by DeepSeek.")}</p><p>{t("Application documentation: README.md and HANDOFF.md in the Code Desktop project.")}</p></ActionDialog>;}
export function RewindDialog({turns,onConfirm,onClose,...dialog}) {
 const [selected,setSelected]=useState(null),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <ActionDialog {...dialog} title={t("Rewind conversation")} onClose={()=>!busy&&onClose()}><p>{t("Choose an earlier message. This removes it and all later conversation history. Local file changes remain.")}</p>
 <div className="slash-rewind-list" role="radiogroup" aria-label={t("Earlier messages")}>{turns.map(turn=><label key={turn.id}><input type="radio" name="rewind" checked={selected===turn.id} disabled={busy} onChange={()=>{setSelected(turn.id);setConfirmed(false);}}/>{turn.text}</label>)}</div>
 {error&&<p role="alert">{error}</p>}<SourceDialogFooter><SourceSettingsButton onClick={onClose} disabled={busy}>{t("Cancel")}</SourceSettingsButton><SourceSettingsButton variant="primary" busy={busy} disabled={!selected} onClick={async()=>{if(!confirmed){setConfirmed(true);return;}setBusy(true);try{await onConfirm(selected);}catch(e){setError(e.message);setBusy(false);}}}>{confirmed?t('Confirm rewind'):t('Rewind to here')}</SourceSettingsButton></SourceDialogFooter></ActionDialog>;
}
