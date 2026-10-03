import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createManualTextSave } from './manual-text-save.mjs';
import { SourceSettingsButton } from './source-settings-button.jsx';
import { SourceSwitch } from './source-switch.jsx';
import { SourceSelect } from './source-select.jsx';
import { SettingsGroup, settingRow } from './source-settings-kit.jsx';
import { INSTRUCTIONS_MAX_CHARS, normalizeInstructions, projectInstructionsFor, withProjectInstructions, instructionsProjectList } from '../electron/prefs/instructions.mjs';
import './source-profile-setting.css';
import './instructions-settings.css';

// C1 Settings → Instructions: global and per-project custom instructions that
// the core appends to the agent's system prompt. Every save sends the whole
// customInstructions object (read-modify-write over the saved config).

const LIMIT_LABEL = INSTRUCTIONS_MAX_CHARS.toLocaleString('en-US');
const countLabel = n => `${n.toLocaleString('en-US')} / ${LIMIT_LABEL}`;
const baseName = p => (p === '/' ? '/' : p.split('/').filter(Boolean).at(-1) || p);
const sizeLabel = bytes => (bytes < 1024 ? `${bytes} ${bytes === 1 ? 'byte' : 'bytes'}` : `${(bytes / 1024).toFixed(1)} KB`);
export const WHEN_IT_APPLIES = {
  deepseek: 'Changes apply from your next message in any session, including sessions that are already open.',
  codex: 'Changes apply to new sessions and to sessions reopened after a restart.',
};

/** Large manual-save textarea (SourceProfileSetting pattern) with a character count. */
export function InstructionsEditor({ label, value, onSave, placeholder, disabled = false }) {
  const [draft, setDraft] = useState(value), [status, setStatus] = useState({ saving: false, error: '' });
  const latest = useRef({ value, onSave }), edited = useRef(false), owner = useRef(null), field = useRef(null);
  const countId = useId(), errorId = useId(); latest.current = { value, onSave };
  useLayoutEffect(() => {
    const controller = createManualTextSave({
      save: text => latest.current.onSave(text),
      validate: text => { if (text.length > INSTRUCTIONS_MAX_CHARS) throw new Error(`Instructions must be ${LIMIT_LABEL} characters or fewer.`); },
      onState: setStatus,
    });
    owner.current = controller; return () => { controller.dispose(); owner.current = null; };
  }, []);
  useEffect(() => { setDraft(current => { if (!edited.current) return value; if (current === value) edited.current = false; return current; }); }, [value]);
  const dirty = draft !== value, over = draft.length > INSTRUCTIONS_MAX_CHARS;
  return <form className="ss-profile-setting ins-editor" onSubmit={event => { event.preventDefault(); event.stopPropagation(); if (dirty) void owner.current?.submit(draft); }}>
    <textarea ref={field} data-cds="TextArea" className="ins-textarea" aria-label={label} rows={12} spellCheck={false} value={draft} placeholder={placeholder} disabled={disabled}
      aria-invalid={status.error || over ? true : undefined} data-invalid={status.error || over ? '' : undefined}
      aria-describedby={[countId, status.error ? errorId : ''].filter(Boolean).join(' ')}
      onChange={event => { edited.current = status.saving || event.currentTarget.value !== latest.current.value; setDraft(event.currentTarget.value); owner.current?.edit(); }}
      onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
    <div className="ins-editor-footer">
      <span id={countId} className="ins-count" data-over={over || undefined}>{countLabel(draft.length)}</span>
      {dirty && <div className="ss-profile-actions" data-size="sm">
        <SourceSettingsButton variant="ghost" size="sm" disabled={status.saving} onClick={() => { owner.current?.edit(); edited.current = false; setDraft(latest.current.value); field.current?.focus(); }}>Revert</SourceSettingsButton>
        <SourceSettingsButton type="submit" variant="primary" size="sm" busy={status.saving} disabled={over}>Save</SourceSettingsButton>
      </div>}
    </div>
    {status.error && <span id={errorId} className="ss-row-error" role="alert" title={status.error}>Couldn’t save the setting. Try again.</span>}
  </form>;
}

export function SourceInstructionsSettings({ config = {}, engine, desktopCall, onSave, cwd }) {
  const saved = normalizeInstructions(config.customInstructions);
  const [optimistic, setOptimistic] = useState(null), [rowErrors, setRowErrors] = useState({});
  const shown = optimistic ?? saved;
  const projects = instructionsProjectList(cwd, config.threadMetadata);
  const [project, setProject] = useState(() => projects[0] ?? null);
  useEffect(() => { if (project === null && projects[0]) setProject(projects[0]); }, [projects[0]]);
  const [preview, setPreview] = useState(null), [previewError, setPreviewError] = useState(''), [fileBusy, setFileBusy] = useState('');
  const savedKey = JSON.stringify(config.customInstructions ?? null);
  const previewSeq = useRef(0);
  const refresh = async () => {
    const seq = ++previewSeq.current;
    if (!project || !desktopCall) { setPreview(null); return; }
    try {
      const result = await desktopCall('instructions', { op: 'preview', cwd: project });
      if (seq === previewSeq.current) { setPreview(result); setPreviewError(''); }
    } catch (error) {
      if (seq === previewSeq.current) { setPreview(null); setPreviewError(error?.message || String(error)); }
    }
  };
  useEffect(() => { void refresh(); }, [project, savedKey]);

  // Whole-object writes. A failed write drops the optimistic value and shows the row error.
  const write = async (rowId, next) => {
    setOptimistic(next); setRowErrors(v => ({ ...v, [rowId]: null }));
    try { await onSave({ customInstructions: next }); }
    catch (error) { console.warn(`Couldn’t save the ${rowId} setting:`, error); setRowErrors(v => ({ ...v, [rowId]: error?.message || String(error) })); throw error; }
    finally { setOptimistic(null); }
  };
  const quiet = promise => promise.catch(() => {});
  const entry = projectInstructionsFor(shown, project);
  const root = entry?.root ?? project;
  const saveProject = (rowId, patch) => write(rowId, withProjectInstructions(shown, root, { text: entry?.text ?? '', useFile: entry?.useFile !== false, ...patch }));
  // Text editors report their own failure under the field; they skip the row error.
  const persist = next => onSave({ customInstructions: next });
  const savedEntry = projectInstructionsFor(saved, project);
  const fileOp = async op => {
    if (fileBusy || !project) return;
    setFileBusy(op); setRowErrors(v => ({ ...v, 'instructions-file': null }));
    try { const result = await desktopCall('instructions', { op, cwd: project }); if (result && typeof result === 'object') setPreview(result); else void refresh(); }
    catch (error) { setRowErrors(v => ({ ...v, 'instructions-file': error?.message || String(error) })); }
    finally { setFileBusy(''); }
  };
  const isDefault = !shown.global && shown.enabled && !Object.keys(shown.projects).length;
  const file = preview?.file;
  const useFile = entry?.useFile !== false;
  const note = WHEN_IT_APPLIES[engine === 'deepseek' ? 'deepseek' : 'codex'];

  const globalRows = [
    settingRow('instructions-enabled', 'Use custom instructions', 'Append your instructions to the agent’s system prompt. Turn off to pause them without losing the text.',
      <SourceSwitch label="Use custom instructions" checked={shown.enabled} onChange={value => quiet(write('instructions-enabled', { ...shown, enabled: value }))} />),
    settingRow('instructions-global', 'Global instructions', 'Added for every project. For example, your preferred language, tone or tools.', null,
      { below: <InstructionsEditor label="Global instructions" value={saved.global} placeholder="e.g. Answer in English. Prefer small, focused commits."
        onSave={text => persist({ ...saved, global: text })} /> }),
  ];
  const projectRows = project ? [
    settingRow('instructions-project', 'Project', entry && entry.root !== project ? `Saved for ${entry.root} and its subfolders.` : 'Instructions apply to this folder and its subfolders.',
      <SourceSelect label="Project" align="end" className="sselect-width-160" value={project} title={project} onChange={setProject}
        items={projects.map(value => ({ value, label: baseName(value), description: value }))} />),
    settingRow('instructions-file', 'Use .code-desktop/instructions.md', 'Read the nearest instructions file in this project, checked into your repository so the whole team shares it.',
      <SourceSwitch label="Use .code-desktop/instructions.md" checked={useFile} onChange={value => quiet(saveProject('instructions-file', { useFile: value }))} />,
      { below: <div className="ins-file" data-exists={file?.exists || undefined}>
        <span className="ins-file-path" title={file?.path || ''}>{file ? file.path : 'Checking…'}</span>
        <span className="ins-file-status">{!file ? '' : file.exists ? sizeLabel(file.bytes) : 'Not created'}</span>
        {file && <span className="ins-file-actions">
          {file.exists
            ? <><SourceSettingsButton size="sm" busy={fileBusy === 'open-file'} onClick={() => fileOp('open-file')}>Open file</SourceSettingsButton>
              <SourceSettingsButton size="sm" variant="ghost" busy={fileBusy === 'reveal-file'} onClick={() => fileOp('reveal-file')}>Show in Finder</SourceSettingsButton></>
            : <SourceSettingsButton size="sm" busy={fileBusy === 'create-file'} onClick={() => fileOp('create-file')}>Create file</SourceSettingsButton>}
        </span>}
      </div> }),
    settingRow('instructions-project-text', 'Project instructions', 'Stored in Code Desktop only, after the file’s instructions.', null,
      { below: <InstructionsEditor key={root} label="Project instructions" value={savedEntry?.text ?? ''} placeholder="e.g. Use pnpm. Run the unit tests before finishing."
        onSave={text => persist(withProjectInstructions(saved, savedEntry?.root ?? project, { useFile: savedEntry?.useFile !== false, text }))} /> }),
  ] : [settingRow('instructions-project', 'Project', 'Choose a folder for a session to add project instructions.', null)];
  const previewRows = [
    settingRow('instructions-preview', 'Final text', preview
      ? `${preview.chars ? `${preview.chars.toLocaleString('en-US')} characters` : 'Nothing is added'}${preview.truncated ? ' · truncated to 40,000 characters' : ''}${project ? ` · for ${baseName(project)}` : ''}`
      : (previewError ? 'The preview is unavailable.' : 'Loading…'),
      <SourceSettingsButton size="sm" variant="ghost" onClick={() => void refresh()}>Refresh</SourceSettingsButton>,
      { below: <pre className="ins-preview" aria-label="Final instructions text" tabIndex={0} data-empty={!preview?.text || undefined}>{preview?.text || (previewError ? previewError : 'No custom instructions are added to the system prompt.')}</pre> }),
    settingRow('instructions-applies', 'When it applies', note, null),
  ];
  return <div className="ins-page" data-engine={engine}>
    <SettingsGroup title="Global instructions" rows={globalRows} rowErrors={rowErrors} />
    <SettingsGroup title="Project instructions" rows={projectRows} rowErrors={rowErrors} />
    <SettingsGroup title="Preview" rows={previewRows} rowErrors={rowErrors} />
    <SettingsGroup title="Reset" rowErrors={rowErrors} rows={[settingRow('instructions-reset', 'Reset instructions', 'Remove your global text and every project override. Files in your projects are not changed.',
      <SourceSettingsButton size="sm" variant="secondary" disabled={isDefault} onClick={() => { if (window.confirm('Reset all custom instructions? Your global text and project overrides will be removed.')) void quiet(write('instructions-reset', null)); }}>Reset</SourceSettingsButton>)]} />
  </div>;
}
