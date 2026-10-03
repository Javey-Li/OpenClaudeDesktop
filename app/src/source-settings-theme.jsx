// Settings › Theme (C4): accent, UI font, font size, density, corner radius and
// code themes on top of light/dark. Values are applied by theme-custom-model's
// root-level overrides of the existing CDS custom properties; this page only
// edits preferences (customTheme + the existing codeFont / codeTheme* keys).
import React, { useEffect, useId, useRef, useState } from 'react';
import { appearancePreferences } from '../electron/preferences.mjs';
import { normalizeTheme, isDefaultTheme, isFontFamily } from '../electron/prefs/theme.mjs';
import { lightThemes, darkThemes } from './code-theme-catalog.mjs';
import { SourceSelect } from './source-select.jsx';
import { SourceSegments } from './source-segments.jsx';
import { SourceSettingsButton } from './source-settings-button.jsx';
import { SourceCodeFontSetting } from './source-code-font-setting.jsx';
import { SourceCodeThemePreview } from './source-code-theme-preview.jsx';
import { SettingsGroup, settingRow } from './source-settings-kit.jsx';
import { THEME_PRESETS, themePreset, presetValue, applyCustomTheme, exportThemeFile, importThemeFile, loadFontFamilies, FALLBACK_FONTS,
  FONT_SCALE_OPTIONS, RADIUS_OPTIONS, parseHex } from './theme-custom-model.mjs';
import './theme-settings.css';

// The CDS blue the accent replaces (c6a992d55 --cds-blue-450), shown in the picker while unset.
const DEFAULT_ACCENT = '#2a78d6';

export function SourceThemeSettings({ config = {}, desktopCall, onSave }) {
  const prefs = appearancePreferences(config);
  const saved = normalizeTheme(config.customTheme);
  const [optimistic, setOptimistic] = useState({}), [rowErrors, setRowErrors] = useState({}), [notice, setNotice] = useState(null);
  const [liveAccent, setLiveAccent] = useState(null), [fileBusy, setFileBusy] = useState('');
  const writes = useRef(0), latestConfig = useRef(config); latestConfig.current = config;
  const theme = Object.hasOwn(optimistic, 'customTheme') ? normalizeTheme(optimistic.customTheme) : saved;
  const shown = (key, value) => Object.hasOwn(optimistic, key) ? optimistic[key] : value;
  const live = liveAccent ? { ...theme, accent: liveAccent } : theme;
  const liveKey = JSON.stringify(live);

  // Live preview: the document follows the page's optimistic/dragged values at
  // once; main.jsx re-applies the confirmed preference after each save and this
  // page restores it when it closes.
  useEffect(() => { applyCustomTheme(document, { customTheme: live }); }, [liveKey]);
  useEffect(() => () => applyCustomTheme(document, latestConfig.current), []);

  async function commit(rowId, patch) {
    setOptimistic(value => ({ ...value, ...patch })); setRowErrors(value => value[rowId] ? { ...value, [rowId]: null } : value); writes.current++;
    try { await onSave(patch); return true; }
    catch (error) {
      console.warn(`Couldn’t save the ${rowId} setting:`, error);
      setOptimistic(value => { const next = { ...value }; for (const key of Object.keys(patch)) if (Object.is(next[key], patch[key])) delete next[key]; return next; });
      setRowErrors(value => ({ ...value, [rowId]: error?.message || String(error) }));
      return false;
    } finally { if (--writes.current === 0) setOptimistic({}); }
  }
  const saveTheme = (rowId, fields) => {
    const next = { ...theme, ...fields, preset: 'custom' };
    return commit(rowId, { customTheme: isDefaultTheme(next) ? null : next });
  };

  // Accent: the picker previews while dragging and saves once it settles.
  const accentTimer = useRef(null), pendingAccent = useRef(null), latestTheme = useRef(theme), latestOnSave = useRef(onSave);
  latestTheme.current = theme; latestOnSave.current = onSave;
  // Closing Settings inside the debounce must not drop the pick: save it
  // fire-and-forget and keep it on screen (this runs after the restore above).
  useEffect(() => () => {
    clearTimeout(accentTimer.current);
    const accent = pendingAccent.current;
    if (!accentTimer.current || !accent) return;
    accentTimer.current = null; pendingAccent.current = null;
    const next = { ...latestTheme.current, accent, preset: 'custom' }, customTheme = isDefaultTheme(next) ? null : next;
    applyCustomTheme(document, { ...latestConfig.current, customTheme });
    Promise.resolve().then(() => latestOnSave.current({ customTheme }))
      .catch(error => { console.warn('Couldn’t save the themeAccent setting:', error); applyCustomTheme(document, latestConfig.current); });
  }, []);
  const pickAccent = value => {
    setLiveAccent(value); clearTimeout(accentTimer.current); pendingAccent.current = value;
    accentTimer.current = setTimeout(() => { accentTimer.current = null; pendingAccent.current = null; void saveTheme('themeAccent', { accent: value }).finally(() => setLiveAccent(null)); }, 350);
  };
  const flushAccent = () => {
    if (!accentTimer.current || !liveAccent) return;
    clearTimeout(accentTimer.current); accentTimer.current = null; pendingAccent.current = null;
    const value = liveAccent; void saveTheme('themeAccent', { accent: value }).finally(() => setLiveAccent(null));
  };

  const presetId = presetValue(theme);
  const presetItems = [...THEME_PRESETS.map(entry => ({ value: entry.id, label: entry.label })), ...(presetId === 'custom' ? [{ value: 'custom', label: 'Custom' }] : [])];
  const choosePreset = id => {
    setNotice(null);
    if (id === 'custom') return;
    const entry = themePreset(id);
    void commit('themePreset', { customTheme: !entry || entry.id === 'default' ? null : { ...entry.theme } });
  };

  async function importFile() {
    if (fileBusy) return;
    setFileBusy('import'); setNotice(null);
    try {
      const picked = await desktopCall('theme-file', { op: 'import' });
      if (!picked) return;
      const { patch, warnings, name } = importThemeFile(picked.theme);
      if (await commit('themePreset', patch)) setNotice({ kind: warnings.length ? 'warning' : 'status', text: [`Imported ${name ? `“${name}”` : 'theme'}.`, ...warnings].join(' ') });
    } catch (error) { setNotice({ kind: 'error', text: error?.message || String(error) }); }
    finally { setFileBusy(''); }
  }
  async function exportFile() {
    if (fileBusy) return;
    setFileBusy('export'); setNotice(null);
    try {
      const current = { ...config, customTheme: theme, codeFont: shown('codeFont', prefs.codeFont), codeThemeLight: shown('codeThemeLight', prefs.codeThemeLight), codeThemeDark: shown('codeThemeDark', prefs.codeThemeDark) };
      const name = themePreset(presetId)?.label ?? 'My theme';
      const result = await desktopCall('theme-file', { op: 'export', theme: exportThemeFile(current, name), name });
      if (result?.path) setNotice({ kind: 'status', text: `Exported to ${result.path}` });
    } catch (error) { setNotice({ kind: 'error', text: error?.message || String(error) }); }
    finally { setFileBusy(''); }
  }

  const accent = liveAccent ?? theme.accent;
  const presetRow = settingRow('themePreset', 'Theme preset', 'Start from a built-in theme, or import one from a file.',
    <SourceSelect label="Theme preset" value={presetId} items={presetItems} align="end" className="sselect-width-160" onChange={choosePreset}/>,
    { below: <div className="ss-theme-custom-actions">
      <SourceSettingsButton variant="secondary" size="sm" busy={fileBusy === 'import'} onClick={importFile}>Import…</SourceSettingsButton>
      <SourceSettingsButton variant="secondary" size="sm" busy={fileBusy === 'export'} onClick={exportFile}>Export…</SourceSettingsButton>
      <SourceSettingsButton variant="ghost" size="sm" disabled={isDefaultTheme(theme)} onClick={() => { setNotice(null); void commit('themePreset', { customTheme: null }); }}>Reset to default</SourceSettingsButton>
      {notice && <span className={notice.kind === 'error' ? 'ss-error' : 'ss-theme-custom-notice'} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</span>}
    </div> });
  const accentRow = settingRow('themeAccent', 'Accent color', 'Used for primary buttons, links, focus rings and selection.',
    <AccentControl value={accent} onPick={pickAccent} onSettle={flushAccent}
      onCommit={value => { clearTimeout(accentTimer.current); accentTimer.current = null; pendingAccent.current = null; setLiveAccent(null); return saveTheme('themeAccent', { accent: value }); }}/>);
  const uiFontRow = settingRow('themeUiFont', 'Interface font family', 'Any installed font. Leave empty to use the Interface font chosen on the Code page.',
    <UiFontControl value={theme.uiFont} onCommit={value => saveTheme('themeUiFont', { uiFont: value })}/>);
  const codeFontRow = settingRow('themeCodeFont', 'Code font', 'Set a custom monospace font for code and terminal.',
    <SourceCodeFontSetting value={prefs.codeFont} placeholder={prefs.interfaceFont === 'dyslexic' ? 'e.g. OpenDyslexic Mono' : 'e.g. JetBrains Mono'} onSave={value => onSave({ codeFont: value })}/>);
  const fontSizeRow = settingRow('themeFontScale', 'Font size', 'Scales most interface text and controls.', null,
    // The segment button styles are scoped to .ss-control; the below slot needs the wrapper too.
    { below: <div className="ss-control ss-theme-custom-scale"><SourceSegments label="Font size" className="ss-theme-custom-segments" value={theme.fontScale}
      options={FONT_SCALE_OPTIONS.map(value => ({ value, label: `${Math.round(value * 100)}%` }))} onChange={value => saveTheme('themeFontScale', { fontScale: value })}/></div> });
  const densityRow = settingRow('themeDensity', 'Density', 'Comfortable gives controls more room.',
    <SourceSegments label="Density" value={theme.density} options={[{ value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' }]}
      onChange={value => saveTheme('themeDensity', { density: value })}/>);
  const radiusRow = settingRow('themeRadius', 'Corner radius', 'Roundness of buttons, menus, cards and the composer.', null,
    { below: <div className="ss-control ss-theme-custom-scale"><SourceSegments label="Corner radius" className="ss-theme-custom-segments" value={theme.radiusScale} options={RADIUS_OPTIONS}
      onChange={value => saveTheme('themeRadius', { radiusScale: value })}/></div> });
  const codeThemeColumn = (mode, value, items, label, key) => <div className="ss-theme-column">
    <SourceSelect label={label} value={value} items={items} onChange={next => commit('themeCodeTheme', { [key]: next })}/>
    <div className="ss-theme-preview-frame"><SourceCodeThemePreview mode={mode} theme={value}/></div>
  </div>;
  const codeThemeRow = { id: 'themeCodeTheme', label: 'Code theme', description: 'Light and dark code themes',
    grid: <div className="ss-theme-grid">
      {codeThemeColumn('light', shown('codeThemeLight', prefs.codeThemeLight), lightThemes(), 'Light code theme', 'codeThemeLight')}
      {codeThemeColumn('dark', shown('codeThemeDark', prefs.codeThemeDark), darkThemes(), 'Dark code theme', 'codeThemeDark')}
    </div> };

  return <div className="ss-theme-custom">
    <SettingsGroup title="Theme" rows={[presetRow]} rowErrors={rowErrors}/>
    <SettingsGroup title="Colors" rows={[accentRow]} rowErrors={rowErrors}/>
    <SettingsGroup title="Typography" rows={[uiFontRow, codeFontRow, fontSizeRow, densityRow]} rowErrors={rowErrors}/>
    <SettingsGroup title="Shape" rows={[radiusRow]} rowErrors={rowErrors}/>
    <SettingsGroup title="Code theme" rows={[codeThemeRow]} rowErrors={rowErrors}/>
    <SettingsGroup title="Preview">
      <ThemePreviewCard/>
      <p className="ss-theme-custom-note">Light and dark mode follow the Theme setting on the Preferences page. Pop-out windows keep the default theme.</p>
    </SettingsGroup>
  </div>;
}

function AccentControl({ value, onPick, onSettle, onCommit }) {
  const [text, setText] = useState(value), [invalid, setInvalid] = useState(false), errorId = useId(), editing = useRef(false);
  useEffect(() => { if (!editing.current) { setText(value); setInvalid(false); } }, [value]);
  const submit = () => {
    editing.current = false;
    const raw = text.trim();
    if (!raw) { setInvalid(false); if (value) void onCommit(''); return; }
    const hex = parseHex(raw);
    if (!hex) { setInvalid(true); return; }
    setInvalid(false); setText(hex);
    if (hex !== value) void onCommit(hex);
  };
  return <div className="ss-theme-custom-accent">
    <input type="color" className="ss-theme-custom-swatch" aria-label="Accent color picker" value={value || DEFAULT_ACCENT}
      onChange={event => onPick(event.currentTarget.value.toLowerCase())} onBlur={onSettle}/>
    <input data-cds="TextInput" className="cds-input cds-reset ss-theme-custom-field ss-theme-custom-hex" aria-label="Accent color hex" placeholder="Default"
      value={text} maxLength={7} spellCheck={false} aria-invalid={invalid || undefined} data-invalid={invalid ? '' : undefined} aria-describedby={invalid ? errorId : undefined}
      onChange={event => { editing.current = true; setText(event.currentTarget.value); }} onBlur={submit}
      onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); submit(); } }}/>
    <SourceSettingsButton variant="ghost" size="sm" disabled={!value} onClick={() => { editing.current = false; setText(''); setInvalid(false); void onCommit(''); }}>Clear</SourceSettingsButton>
    {invalid && <span id={errorId} className="ss-error" role="alert">Enter a color like #4d6bfe.</span>}
  </div>;
}

// Free text with suggestions: the installed families from queryLocalFonts()
// (asked for on first focus), else a built-in list. Saves on Enter or blur.
function UiFontControl({ value, onCommit }) {
  const [draft, setDraft] = useState(value), [fonts, setFonts] = useState(FALLBACK_FONTS), [invalid, setInvalid] = useState(false);
  const listId = useId(), errorId = useId(), requested = useRef(false), editing = useRef(false), composing = useRef(false);
  useEffect(() => { if (!editing.current) setDraft(value); }, [value]);
  const loadFonts = () => {
    if (requested.current) return;
    requested.current = true;
    // queryLocalFonts needs user activation; a refused or unavailable query retries on the next focus.
    void loadFontFamilies().then(list => { setFonts(list); if (list === FALLBACK_FONTS) requested.current = false; });
  };
  const submit = () => {
    editing.current = false;
    const next = draft.trim();
    if (!isFontFamily(next)) { setInvalid(true); return; }
    setInvalid(false);
    if (next !== value) void onCommit(next);
  };
  return <div className="ss-theme-custom-font">
    <input data-cds="TextInput" className="cds-input cds-reset ss-theme-custom-field" aria-label="Interface font family" list={listId}
      value={draft} placeholder="e.g. Inter" maxLength={120} spellCheck={false}
      aria-invalid={invalid || undefined} data-invalid={invalid ? '' : undefined} aria-describedby={invalid ? errorId : undefined}
      onFocus={loadFonts} onChange={event => { editing.current = true; setDraft(event.currentTarget.value); }} onBlur={() => { if (editing.current) submit(); }}
      onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
      onKeyDown={event => {
        if (composing.current || event.nativeEvent.isComposing) return;
        if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); submit(); }
      }}/>
    <datalist id={listId}>{fonts.map(name => <option key={name} value={name}/>)}</datalist>
    {invalid && <span id={errorId} className="ss-error" role="alert">Enter a font family name.</span>}
  </div>;
}

// Uses only CDS tokens, so it follows the applied theme in light and dark mode.
function ThemePreviewCard() {
  return <div className="ss-theme-custom-preview" aria-hidden="true" inert>
    <div className="ss-theme-custom-preview-row">
      <SourceSettingsButton variant="primary" size="sm" tabIndex={-1}>Primary</SourceSettingsButton>
      <SourceSettingsButton variant="secondary" size="sm" tabIndex={-1}>Secondary</SourceSettingsButton>
      <span className="ss-theme-custom-chip">Accent</span>
      <span className="ss-theme-custom-link">A link in the text</span>
    </div>
    <pre className="ss-theme-custom-code"><code>{'function greet(name) {\n  return `Hello, ${name}!`;\n}'}</code></pre>
    <div className="ss-theme-custom-composer">Ask DeepSeek to build, fix or explain…</div>
  </div>;
}
