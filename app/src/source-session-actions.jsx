import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { rateLimitRows } from './session-command-model.mjs';
import { SourceDialog, SourceDialogFooter } from './source-dialog.jsx';
import { SourceSettingsButton } from './source-settings-button.jsx';
import { SourceShortcut } from './source-shortcut';
import { shortcutsDialogSections } from './shortcuts-dialog-model.mjs';
import './source-session-actions.css';

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
  return <ActionDialog {...dialog} title="Keyboard shortcuts" size="md" bleed density="comfortable" className="shortcuts-dialog" onClose={onClose}>
    <div role="region" aria-label="Keyboard shortcuts" tabIndex={0} className="shortcuts-region">
      {shortcutsDialogSections({ fastMode }).map(section => <div key={section.title}>
        <div className="shortcuts-section">{section.title}</div>
        {section.rows.map(row => <div key={row.command} className="shortcuts-row" data-command={row.command}>
          <span className="shortcuts-label">{row.label}</span>
          <span className="shortcuts-keys">{row.keys.map((keys, index) => <React.Fragment key={keys}>
            {index > 0 && <span aria-hidden="true" className="shortcuts-or">or</span>}
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
  return <ActionDialog {...dialog} title="Review code" onClose={onClose}>
    <form onSubmit={async e=>{e.preventDefault();if(submitting.current || type!=='uncommittedChanges'&&!value.trim())return;submitting.current=true;setBusy(true);setError('');try{await onSubmit({type,...(fields[type]?{[fields[type]]:value.trim()}:{})});}catch(e){setError(e.message);}finally{submitting.current=false;setBusy(false);}}}>
      <p>DeepSeek reviews in a read-only sandbox without approval prompts. You can stop the review from this conversation.</p>
      <label>Review target<select data-autofocus aria-label="Review target" value={type} disabled={busy} onChange={e=>{setType(e.target.value);setValue('');setError('');}}>
        <option value="uncommittedChanges" disabled={!workspaceInfo?.isRepo}>Uncommitted changes</option>
        <option value="baseBranch" disabled={!workspaceInfo?.isRepo}>Compare against a branch</option>
        <option value="commit" disabled={!workspaceInfo?.isRepo}>A commit</option><option value="custom">Custom instructions</option>
      </select></label>
      {type==='baseBranch' && <label>Base branch<input aria-label="Base branch" list="review-branches" placeholder="main" value={value} disabled={busy} onChange={e=>setValue(e.target.value)}/><datalist id="review-branches">{workspaceInfo?.branches?.map(branch=><option key={branch} value={branch}/>)}</datalist></label>}
      {type==='commit' && <label>Commit<input aria-label="Commit" placeholder="Commit SHA or reference" value={value} disabled={busy} onChange={e=>setValue(e.target.value)}/></label>}
      {type==='custom' && <label>Review instructions<textarea aria-label="Review instructions" rows={5} maxLength={12000} value={value} disabled={busy} onChange={e=>setValue(e.target.value)}/></label>}
      {!workspaceInfo?.isRepo && type!=='custom' && <p>Select custom instructions, or open a session in a Git repository.</p>}
      {error && <p role="alert" className="session-action-error">{error}</p>}
      {/* Qf footer with CDS Buttons: busy keeps Start review in place with its spinner (ks busy). */}
      <SourceDialogFooter><SourceSettingsButton onClick={onClose}>Cancel</SourceSettingsButton><SourceSettingsButton type="submit" variant="primary" busy={busy}
        disabled={(type!=='custom'&&!workspaceInfo?.isRepo) || (type!=='uncommittedChanges'&&!value.trim())}>Start review</SourceSettingsButton></SourceDialogFooter>
    </form>
  </ActionDialog>;
}

const count = value => Number.isFinite(value) && value>=0 ? Intl.NumberFormat().format(value) : 'Unavailable';
export function SessionStatusDialog({ session, model, effort, serviceTier, permission, cwd, usage, connected, running, operation, account, readStatus, onClose, inline=false }) {
  const [remote,setRemote]=useState(null),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
  useEffect(()=>{let live=true;setLoading(true);setRemote(null);readStatus().then(value=>{if(live)setRemote(value);}).catch(error=>{if(live)setRemote({error:error.message});}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[revision,connected]);
  const rows=rateLimitRows(remote?.limits), currentAccount=remote?.account?.account || account?.account;
  const Frame=inline?InlineStatusFrame:ActionDialog;
  return <Frame title="Session status" onClose={onClose}>
    <dl className="session-status-details">
      <dt>Connection</dt><dd>{connected?'Connected to local DeepSeek':'Disconnected'}</dd>
      <dt>Account</dt><dd>{currentAccount?.type==='chatgpt' ? [currentAccount.email,currentAccount.planType].filter(Boolean).join(' · ') || 'ChatGPT' : currentAccount?.type==='apiKey' ? 'API key' : 'Unavailable'}</dd>
      <dt>Session</dt><dd>{session?.name || session?.preview || (session?'Untitled session':'New session')}{session && <small>{session.id}</small>}</dd>
      <dt>Task state</dt><dd>{session?.archived?'Archived':!connected?'Unknown while disconnected':operation?.phase==='unknown'?'Awaiting DeepSeek confirmation':running?'Running':operation?.phase==='starting'?'Starting':'Idle'}</dd>
      <dt>Next message model</dt><dd>{model || 'Unavailable'}{effort ? ` · ${effort} effort` : ''}</dd>
      <dt>Next message speed</dt><dd>{serviceTier || "Standard"}</dd>
      <dt>Next message permissions</dt><dd>{permission==='bypass'?'Bypass · full access without approval':permission==='plan'?'Plan · read-only':permission==='ask'?'Manual · every change requires approval':permission==='acceptEdits'?'Accept edits · file edits apply without approval':'Auto · DeepSeek requests approval when needed'}</dd>
      <dt>Workspace</dt><dd>{cwd || 'Unavailable'}</dd>
      <dt>Context tokens</dt><dd>{count(usage?.last?.totalTokens)}{Number.isFinite(usage?.modelContextWindow)&&usage.modelContextWindow>0?` / ${count(usage.modelContextWindow)}`:''}</dd>
      <dt>Session tokens</dt><dd>{count(usage?.total?.totalTokens)}</dd>
    </dl>
    <section className="session-status-limits" aria-label="Account usage limits"><h3>Account usage limits</h3>
      {loading?<p role="status">Loading usage limits</p>:rows.length?rows.map(row=><div className="session-limit" key={row.key}><span>{row.label}<strong>{row.remaining.toLocaleString()}% remaining</strong></span><progress max={100} value={row.remaining}/>{row.resetsAt!==null&&<small>Resets {new Date(row.resetsAt*1000).toLocaleString()}</small>}</div>):<p>Unavailable for this account or connection.</p>}
      {remote?.error&&<p role="alert" className="session-action-error">{remote.error}</p>}
    </section>
    <footer><span className="session-action-hint">Context appears after DeepSeek reports usage.</span><button data-autofocus disabled={loading||!connected} onClick={()=>setRevision(x=>x+1)}>Refresh</button></footer>
  </Frame>;
}

function InlineStatusFrame({title,onClose,children}) {return <section className="slash-local-status" aria-label={title}><header><h3>{title}</h3><button aria-label="Dismiss session status" onClick={onClose}><Icon name="X" size={14}/></button></header>{children}</section>;}
export function SlashHelp({onClose,...dialog}) {return <ActionDialog {...dialog} title="Help and support" onClose={onClose}><p>Code Desktop runs local DeepSeek sessions. Slash commands open tools, settings and conversation actions.</p><p>Use the command menu to see the actions available in this session. Session files and approvals are managed by DeepSeek.</p><p>Application documentation: README.md and HANDOFF.md in the Code Desktop project.</p></ActionDialog>;}
export function RewindDialog({turns,onConfirm,onClose,...dialog}) {
 const [selected,setSelected]=useState(null),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <ActionDialog {...dialog} title="Rewind conversation" onClose={()=>!busy&&onClose()}><p>Choose an earlier message. This removes it and all later conversation history. Local file changes remain.</p>
 <div className="slash-rewind-list" role="radiogroup" aria-label="Earlier messages">{turns.map(turn=><label key={turn.id}><input type="radio" name="rewind" checked={selected===turn.id} disabled={busy} onChange={()=>{setSelected(turn.id);setConfirmed(false);}}/>{turn.text}</label>)}</div>
 {error&&<p role="alert">{error}</p>}<SourceDialogFooter><SourceSettingsButton onClick={onClose} disabled={busy}>Cancel</SourceSettingsButton><SourceSettingsButton variant="primary" busy={busy} disabled={!selected} onClick={async()=>{if(!confirmed){setConfirmed(true);return;}setBusy(true);try{await onConfirm(selected);}catch(e){setError(e.message);setBusy(false);}}}>{confirmed?'Confirm rewind':'Rewind to here'}</SourceSettingsButton></SourceDialogFooter></ActionDialog>;
}
