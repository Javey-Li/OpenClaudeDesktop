// Settings › Models (C5): the API connection (DeepSeek's official API or a
// third-party relay, with its key) up top; under Advanced, per-model request
// defaults (max output tokens, temperature, default reasoning effort), the
// editable CNY price table the Usage page's estimated cost uses and custom
// providers. Model values live in preferences (modelSettings); main's
// model-settings.cjs sends them to the DeepSeek bridge with each thread/turn
// request and account/usage/read, and keeps the connection and its keys. A
// Codex core gets a notice and disabled controls.
import React, { useEffect, useId, useRef, useState } from 'react';
import { SourceSelect } from './source-select.jsx';
import { SourceSegments } from './source-segments.jsx';
import { SourceDisclosure } from './source-disclosure.jsx';
import { SourceDialog, SourceDialogFooter } from './source-dialog.jsx';
import { SourceSettingsButton } from './source-settings-button.jsx';
import { SettingsGroup, settingRow } from './source-settings-kit.jsx';
import { effortName } from './model-menu-model.mjs';
import { DEEPSEEK_KEYS_URL } from './account-settings-model.mjs';
import { t, tn } from '../electron/i18n/index.mjs';
import {
  normalize, parseNumberInput, setModelParam, effectivePrices, setPrice, addPrice, removePrice, resetPrices, priceEdited,
  PRICE_TIERS, PRICE_FIELDS, MAX_TOKENS_MIN, MAX_TOKENS_MAX, PROVIDER_PROTOCOLS, validateProvider,
  relayBaseURLError, OFFICIAL_BASE_URL,
} from '../electron/prefs/model-settings.mjs';
import './models-settings.css';

const TIER_LABELS = { offPeak: t('Off-peak'), peak: t('Peak') };
const FIELD_LABELS = { cacheHit: t('Cache hit'), cacheMiss: t('Cache miss'), output: t('Output') };
const DEFAULT_PRICING_URL = 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing';
// Above Settings (layer 500), like the other Settings page dialogs.
const SETTINGS_LAYER = Object.freeze({ base: 520, z: 520 });
const PROTOCOL_LABELS = { 'openai-completions': 'OpenAI Chat Completions', 'openai-responses': 'OpenAI Responses', 'anthropic-messages': 'Anthropic Messages' };

// Add / edit one custom provider. The key is write-only: it is sent once to the
// main process (encrypted there) and never read back.
function ProviderDialog({ initial, protocols, onSubmit, onCancel }) {
  const editing = !!initial;
  const [form, setForm] = useState(() => ({ route: initial?.route ?? '', displayName: initial?.displayName ?? '', api: initial?.api ?? protocols[0],
    baseURL: initial?.baseURL ?? '', models: (initial?.models ?? []).join('\n'), apiKey: '' }));
  const [error, setError] = useState(''), [saving, setSaving] = useState(false), [clearKey, setClearKey] = useState(false);
  const routeRef = useRef(null), ids = { help: useId() };
  const set = key => event => { const value = event.target.value; setForm(current => ({ ...current, [key]: value })); };
  const submit = async event => {
    event.preventDefault(); event.stopPropagation();
    if (saving) return;
    let provider;
    try { provider = validateProvider(form); } catch (failure) { setError(failure.message); return; }
    if (!editing && !form.apiKey.trim()) { setError(t('Enter the API key.')); return; }
    setSaving(true); setError('');
    try { await onSubmit({ provider, previousRoute: initial?.route, apiKey: form.apiKey.trim() ? form.apiKey : clearKey ? null : undefined }); }
    catch (failure) { setError(failure?.message || String(failure)); setSaving(false); }
  };
  return <SourceDialog open size="md" layer={SETTINGS_LAYER} title={editing ? t('Edit {name}', { name: initial.displayName || initial.route }) : t('Add provider')} className="msx-dialog"
    description={t('An OpenAI-compatible (or Anthropic Messages) endpoint, served by the Harness pi-ai adapter. Its models join the model menu after the core restarts.')}
    initialFocusRef={routeRef} onClose={() => { if (!saving) onCancel(); }}>
    <form className="msx-form" onSubmit={submit} noValidate>
      <label className="msx-field"><span className="msx-label">{t('Provider id')}</span>
        <input ref={routeRef} data-cds="TextInput" className="cds-input cds-reset" aria-label={t('Provider id')} value={form.route} maxLength={32} spellCheck={false} autoCapitalize="off" autoComplete="off"
          placeholder="openrouter" onChange={event => setForm(current => ({ ...current, route: event.target.value.toLowerCase().replace(/\s/g, '-') }))}/>
      </label>
      <label className="msx-field"><span className="msx-label">{t('Display name')}</span>
        <input data-cds="TextInput" className="cds-input cds-reset" aria-label={t('Provider display name')} value={form.displayName} maxLength={60} placeholder={t('Optional')} onChange={set('displayName')}/>
      </label>
      <div className="msx-field"><span className="msx-label">{t('Protocol')}</span>
        <SourceSelect label={t('Protocol')} value={form.api} onChange={value => setForm(current => ({ ...current, api: value }))}
          items={protocols.map(value => ({ value, label: PROTOCOL_LABELS[value] || value }))}/>
      </div>
      <label className="msx-field"><span className="msx-label">{t('Endpoint URL')}</span>
        <input data-cds="TextInput" className="cds-input cds-reset" aria-label={t('Endpoint URL')} value={form.baseURL} maxLength={512} spellCheck={false} autoCapitalize="off"
          placeholder="https://api.example.com/v1" onChange={set('baseURL')}/>
      </label>
      <label className="msx-field"><span className="msx-label">{t('Model ids')}</span>
        <textarea data-cds="TextArea" className="cds-input cds-reset msx-models" aria-label={t('Model ids')} aria-describedby={ids.help} rows={4} value={form.models} spellCheck={false}
          placeholder={'gpt-4.1-mini\nqwen3-coder'} onChange={set('models')}/>
        <span id={ids.help} className="msx-help">{t('One per line, as the endpoint names them.')}</span>
      </label>
      <label className="msx-field"><span className="msx-label">{t('API key')}</span>
        <input data-cds="TextInput" className="cds-input cds-reset" type="password" aria-label={t('API key')} value={form.apiKey} maxLength={4096} autoComplete="off" spellCheck={false}
          placeholder={editing && initial.hasKey ? t('Saved. Leave empty to keep it.') : 'sk-…'} onChange={set('apiKey')}/>
        <span className="msx-help">{t('Stored encrypted on this Mac and passed to the core as {env}; never written to settings files.', { env: initial?.keyEnv || t('an environment variable') })}</span>
      </label>
      {editing && initial.hasKey && <label className="msx-check"><input type="checkbox" checked={clearKey} disabled={!!form.apiKey} onChange={event => setClearKey(event.target.checked)}/> {t('Remove the saved key')}</label>}
      {error && <p className="msx-error" role="alert">{error}</p>}
      <SourceDialogFooter>
        <SourceSettingsButton disabled={saving} onClick={onCancel}>{t('Cancel')}</SourceSettingsButton>
        <SourceSettingsButton type="submit" variant="primary" busy={saving}>{editing ? t('Save') : t('Add provider')}</SourceSettingsButton>
      </SourceDialogFooter>
    </form>
  </SourceDialog>;
}

// A number field that commits on blur or Enter; Escape restores the saved value.
function NumberField({ label, value, placeholder = t('Default'), min, max, step, disabled, invalid, onCommit, className = '' }) {
  const shown = value === undefined || value === null ? '' : String(value);
  const [draft, setDraft] = useState(shown), editing = useRef(false), input = useRef(null);
  useEffect(() => { if (!editing.current) setDraft(shown); }, [shown]);
  // Chromium reports unparseable text (e.g. "abc", "1e") in a number input as
  // value '' with validity.badInput, which would otherwise commit as a clear.
  // The DOM value is reset too: React skips it when the draft already equals ''.
  const revert = () => { setDraft(shown); if (input.current) input.current.value = shown; };
  const commit = () => {
    editing.current = false;
    if (input.current?.validity?.badInput) onCommit('NaN', revert);
    else if (draft.trim() !== shown) onCommit(draft, revert);
  };
  return <input ref={input} type="number" data-cds="TextInput" className={`cds-input cds-reset msx-number ${className}`} aria-label={label}
    value={draft} placeholder={placeholder} min={min} max={max} step={step} disabled={disabled} inputMode="decimal"
    aria-invalid={invalid ? true : undefined} data-invalid={invalid ? '' : undefined}
    onChange={event => { editing.current = true; setDraft(event.currentTarget.value); }}
    onBlur={commit}
    onKeyDown={event => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === 'Enter') { event.preventDefault(); commit(); }
      else if (event.key === 'Escape' && (draft !== shown || event.currentTarget.validity?.badInput)) { event.preventDefault(); event.stopPropagation(); editing.current = false; revert(); }
    }}/>;
}

// API connection: official DeepSeek API or a third-party relay. Keys are
// write-only (sent once to main, encrypted there); the page only learns whether
// one is saved. Changes reach the core when it restarts.
const CONNECTION_OPTIONS = [{ value: 'official', label: t('DeepSeek official') }, { value: 'relay', label: t('Third-party relay') }];
function ConnectionGroup({ deepseek, desktopCall, onReconnect }) {
  const [view, setView] = useState(null);
  const [draft, setDraft] = useState({ mode: 'official', relayBaseURL: '', relayModels: '', officialKey: '', relayKey: '' });
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [pending, setPending] = useState(false);
  const adopt = result => {
    setView(result);
    setDraft({ mode: result.mode, relayBaseURL: result.relayBaseURL || '', relayModels: (result.relayModels || []).join('\n'), officialKey: '', relayKey: '' });
  };
  useEffect(() => {
    if (!deepseek || typeof desktopCall !== 'function') return undefined;
    let live = true;
    Promise.resolve().then(() => desktopCall('model-settings', { op: 'connection-read' })).then(result => {
      if (live && result && typeof result.mode === 'string') adopt(result);
    }).catch(failure => { if (live) console.warn('Couldn’t read the API connection:', failure); });
    return () => { live = false; };
  }, [deepseek]);
  const disabled = !deepseek || !view?.available || !!busy;
  const relay = draft.mode === 'relay';
  const urlError = relay && draft.relayBaseURL.trim() ? relayBaseURLError(draft.relayBaseURL) : null;
  const modelIds = text => text.split(/[\s,]+/).map(id => id.trim()).filter(Boolean).join('\n');
  const dirty = !!view && (draft.mode !== view.mode || (relay && draft.relayBaseURL.trim().replace(/\/+$/, '') !== (view.relayBaseURL || ''))
    || (relay && modelIds(draft.relayModels) !== (view.relayModels || []).join('\n'))
    || !!draft.officialKey.trim() || !!draft.relayKey.trim());
  const canSave = dirty && !disabled && (!relay || (!relayBaseURLError(draft.relayBaseURL) && (view.relayKey || draft.relayKey.trim())));
  const set = key => event => { const value = event.target.value; setError(''); setDraft(current => ({ ...current, [key]: value })); };
  const save = async (payload, key) => {
    setBusy(key); setError('');
    try { adopt(await desktopCall('model-settings', { op: 'connection-save', ...payload })); setPending(true); }
    catch (failure) { setError(failure?.message || String(failure)); }
    finally { setBusy(''); }
  };
  const submit = event => {
    event.preventDefault(); event.stopPropagation();
    if (!canSave) return;
    void save({ connection: { mode: draft.mode, relayBaseURL: draft.relayBaseURL, relayModels: draft.relayModels }, officialKey: draft.officialKey.trim() || undefined, relayKey: draft.relayKey.trim() || undefined }, 'save');
  };
  // Fill the model list from the relay's /v1/models (typed or saved key).
  const fetchModels = async () => {
    setBusy('models'); setError('');
    try {
      const result = await desktopCall('model-settings', { op: 'connection-models', relayBaseURL: draft.relayBaseURL, relayKey: draft.relayKey.trim() || undefined });
      if (!result?.models?.length) setError(t('The relay didn’t list any models.'));
      else setDraft(current => ({ ...current, relayModels: result.models.join('\n') }));
    } catch (failure) { setError(failure?.message || String(failure)); }
    finally { setBusy(''); }
  };
  const keyInput = (field, saved, label) => <input data-cds="TextInput" className="cds-input cds-reset msx-wide" type="password" aria-label={label}
    value={draft[field]} maxLength={4096} autoComplete="off" spellCheck={false} disabled={disabled}
    placeholder={saved ? `•••••••• ${t('Saved')}` : 'sk-…'} onChange={set(field)}/>;
  const officialKeyHelp = view?.officialKey ? t('Saved encrypted on this Mac. Type a new key to replace it.')
    : view?.inheritedKey ? t('Optional. Without one, the DEEPSEEK_API_KEY the app was launched with is used.')
      : t('Optional. Without one, the key saved in DeepSeek Harness (~/.dsh) is used.');
  const rows = [
    settingRow('connection-mode', t('Provider'), relay ? t('Requests go through a relay that serves DeepSeek’s models.') : t('Requests go straight to {host}.', { host: OFFICIAL_BASE_URL.replace(/^https:\/\//, '') }),
      <SourceSegments label={t('API provider')} value={draft.mode} options={CONNECTION_OPTIONS} disabled={disabled}
        onChange={mode => { setError(''); setDraft(current => ({ ...current, mode })); }}/>),
    ...(relay ? [
      settingRow('connection-relay-url', t('Base URL'), t('An Anthropic Messages-compatible endpoint; /v1/messages is added.'),
        <input data-cds="TextInput" className="cds-input cds-reset msx-wide" aria-label={t('Relay base URL')} value={draft.relayBaseURL} maxLength={512}
          spellCheck={false} autoCapitalize="off" autoComplete="off" disabled={disabled} placeholder="https://relay.example.com/anthropic"
          aria-invalid={urlError ? true : undefined} data-invalid={urlError ? '' : undefined} onChange={set('relayBaseURL')}/>,
        urlError ? { below: <span className="ss-row-error">{urlError}</span> } : {}),
      settingRow('connection-relay-key', t('API key'), view?.relayKey ? t('Saved encrypted on this Mac. Type a new key to replace it.') : t('The key your relay issued.'),
        keyInput('relayKey', view?.relayKey, t('Relay API key'))),
      settingRow('connection-relay-models', t('Models'), t('The model ids your relay serves, one per line. They replace DeepSeek’s in the model menu; leave empty if the relay uses deepseek-flash and deepseek-v4-pro.'),
        <SourceSettingsButton size="sm" disabled={disabled || !!relayBaseURLError(draft.relayBaseURL) || !(view?.relayKey || draft.relayKey.trim())} busy={busy === 'models'} onClick={() => void fetchModels()}>{t('Fetch from relay')}</SourceSettingsButton>,
        { below: <textarea data-cds="TextArea" className="cds-input cds-reset msx-relay-models" aria-label={t('Relay model ids')} rows={4} value={draft.relayModels}
          spellCheck={false} autoCapitalize="off" disabled={disabled} placeholder={'deepseek-v4.1-flash\ndeepseek-v4-pro'} onChange={set('relayModels')}/> }),
    ] : [
      settingRow('connection-official-key', t('API key'), <>{officialKeyHelp}{' '}
        <button type="button" className="msx-link" onClick={() => void Promise.resolve(desktopCall?.('external', { url: DEEPSEEK_KEYS_URL })).catch(() => {})}>{t('Get a key')}</button></>,
        keyInput('officialKey', view?.officialKey, t('DeepSeek API key'))),
    ]),
  ];
  return <form className="msx-connection" onSubmit={submit} noValidate>
    <SettingsGroup title={t('API connection')} rows={rows}>
      <div className="msx-connection-footer">
        <span className="msx-connection-status" role="status">
          {error ? <span className="ss-row-error">{error}</span>
            : pending ? t('Saved. Restart the core to apply.')
              : view && !view.available ? t('Needs Settings › Harness, which isn’t available.') : ''}
        </span>
        {!relay && view?.officialKey && <SourceSettingsButton size="sm" variant="ghost" disabled={disabled} busy={busy === 'remove'}
          onClick={() => void save({ officialKey: null }, 'remove')}>{t('Remove key')}</SourceSettingsButton>}
        {pending && onReconnect && !dirty ? <SourceSettingsButton size="sm" variant="primary"
          onClick={() => { setPending(false); void Promise.resolve(onReconnect()).catch(() => {}); }}>{t('Restart core')}</SourceSettingsButton>
          : <SourceSettingsButton type="submit" size="sm" variant="primary" disabled={!canSave} busy={busy === 'save'}>{t('Save')}</SourceSettingsButton>}
      </div>
    </SettingsGroup>
  </form>;
}

export function SourceModelsSettings({ config = {}, boot, engine, desktopCall, onSave, onReconnect }) {
  const deepseek = engine === 'deepseek';
  const [optimistic, setOptimistic] = useState(undefined), [rowErrors, setRowErrors] = useState({});
  const [official, setOfficial] = useState({ loading: deepseek, prices: null, pricingUrl: null, peakWindows: null, unsupported: !deepseek });
  const [adding, setAdding] = useState(null);
  const [providers, setProviders] = useState({ available: false, protocols: [...PROVIDER_PROTOCOLS], providers: [], changed: false, error: '' });
  const [providerDialog, setProviderDialog] = useState(null), [providerBusy, setProviderBusy] = useState('');
  const writes = useRef(0);
  const saved = normalize(config.modelSettings);
  const current = optimistic === undefined ? saved : normalize(optimistic);
  const models = (boot?.models || []).filter(model => model && typeof model.model === 'string');
  const connected = boot?.connected !== false;

  useEffect(() => {
    if (!deepseek || typeof desktopCall !== 'function') { setOfficial(value => ({ ...value, loading: false, unsupported: true })); return; }
    let live = true;
    setOfficial(value => ({ ...value, loading: true }));
    Promise.resolve().then(() => desktopCall('model-settings', { op: 'official-prices' })).then(result => {
      if (!live) return;
      if (!result || result.unsupported) setOfficial({ loading: false, prices: null, pricingUrl: null, peakWindows: null, unsupported: true });
      else setOfficial({ loading: false, prices: result.official || {}, pricingUrl: result.pricingUrl || null, peakWindows: result.peakWindows || null, unsupported: false });
    }).catch(error => {
      if (!live) return;
      console.warn('Couldn’t read the official prices:', error);
      setOfficial({ loading: false, prices: null, pricingUrl: null, peakWindows: null, unsupported: false, error: error?.message || String(error) });
    });
    return () => { live = false; };
  }, [deepseek, connected, boot?.core?.engine]);
  useEffect(() => {
    if (!deepseek || typeof desktopCall !== 'function') return undefined;
    let live = true;
    Promise.resolve().then(() => desktopCall('model-settings', { op: 'providers-read' })).then(result => {
      if (live && result && Array.isArray(result.providers)) setProviders(value => ({ ...value, ...result, error: '' }));
    }).catch(error => { if (live) console.warn('Couldn’t read the custom providers:', error); });
    return () => { live = false; };
  }, [deepseek]);
  const providerCall = async (key, payload) => {
    setProviderBusy(key);
    try {
      const result = await desktopCall('model-settings', payload);
      setProviders(value => ({ ...value, ...result, changed: true, error: '' }));
      return result;
    } finally { setProviderBusy(''); }
  };

  async function commit(rowId, compute) {
    let next;
    try { next = compute(current); }
    catch (error) { setRowErrors(value => ({ ...value, [rowId]: error?.message || String(error) })); return false; }
    setOptimistic(next ?? null); setRowErrors(value => value[rowId] ? { ...value, [rowId]: null } : value); writes.current++;
    try { await onSave({ modelSettings: next ?? null }); return true; }
    catch (error) {
      console.warn(`Couldn’t save the ${rowId} setting:`, error);
      setRowErrors(value => ({ ...value, [rowId]: error?.message || String(error) }));
      setOptimistic(undefined);
      return false;
    } finally { if (--writes.current === 0) setOptimistic(undefined); }
  }

  const disabled = !deepseek;
  const notice = !deepseek && <p className="ss-connection-notice msx-notice" role="status">{t('The API connection, model parameters and pricing apply with the DeepSeek core.')}</p>;

  // ---- Model defaults
  const paramField = (model, field, props) => {
    const rowId = `model-${model.model}-${field}`;
    return <NumberField {...props} disabled={disabled} invalid={!!rowErrors[rowId]} value={current.params[model.model]?.[field]}
      onCommit={(text, revert) => {
        const value = parseNumberInput(text);
        if (Number.isNaN(value)) { setRowErrors(errors => ({ ...errors, [rowId]: t('Enter a number.') })); revert(); return; }
        void commit(rowId, settings => setModelParam(settings, model.model, field, value)).then(ok => { if (!ok) revert(); });
      }}/>;
  };
  // Validation and save failures show their reason below the row.
  const below = rowId => rowErrors[rowId] ? { below: <span className="ss-row-error" title={rowErrors[rowId]}>{rowErrors[rowId]}</span> } : {};
  const modelGroups = models.map(model => {
    const name = model.displayName || model.model;
    const efforts = (model.supportedReasoningEfforts || []).map(item => item?.reasoningEffort ?? item).filter(value => typeof value === 'string');
    const builtIn = model.defaultReasoningEffort ? effortName(model.defaultReasoningEffort) : '';
    const effortId = `model-${model.model}-effort`;
    const rows = [
      settingRow(`model-${model.model}-maxTokens`, t('Max output tokens'), t('{min}–{max}. Empty uses the model’s default.', { min: MAX_TOKENS_MIN.toLocaleString('en-US'), max: MAX_TOKENS_MAX.toLocaleString('en-US') }),
        paramField(model, 'maxTokens', { label: t('{name} max output tokens', { name }), min: MAX_TOKENS_MIN, max: MAX_TOKENS_MAX, step: 1 }), below(`model-${model.model}-maxTokens`)),
      settingRow(`model-${model.model}-temperature`, t('Temperature'), t('0–2. Lower is more focused, higher more varied. Empty uses the model’s default.'),
        paramField(model, 'temperature', { label: t('{name} temperature', { name }), min: 0, max: 2, step: 0.1 }), below(`model-${model.model}-temperature`)),
      ...(efforts.length ? [settingRow(effortId, t('Default reasoning effort'), t('Applied when you switch to this model.'),
        <SourceSelect label={t('{name} default reasoning effort', { name })} align="end" className="sselect-width-160" disabled={disabled}
          value={current.params[model.model]?.effort ?? ''}
          items={[{ value: '', label: builtIn ? t('Model default ({effort})', { effort: builtIn }) : t('Model default') }, ...efforts.map(value => ({ value, label: effortName(value) }))]}
          onChange={value => void commit(effortId, settings => setModelParam(settings, model.model, 'effort', value || undefined))}/>, below(effortId))] : []),
    ];
    return <SettingsGroup key={model.model} title={name} rows={rows}/>;
  });

  // ---- Pricing
  const officialPrices = official.prices || {};
  const prices = effectivePrices(current, officialPrices);
  const priceIds = Object.keys(prices);
  const customPrices = !!current.prices;
  const pricingUrl = official.pricingUrl || DEFAULT_PRICING_URL;
  const priceTable = id => {
    const entry = prices[id], name = entry.displayName || officialPrices[id]?.displayName || id, rowId = `price-${id}`;
    const edited = customPrices && priceEdited(prices, officialPrices, id);
    return <div key={id} className="msx-price" data-setting-id={rowId} role="group" aria-label={t('{name} prices', { name })}>
      <div className="msx-price-head">
        <span className="text-body settings-row-title">{name}</span>
        {name !== id && <code className="msx-price-id">{id}</code>}
        {edited && <span className="msx-badge">{officialPrices[id] ? t('Edited') : t('Added')}</span>}
        {!officialPrices[id] && <SourceSettingsButton variant="ghost" size="sm" className="msx-price-remove" disabled={disabled} aria-label={t('Remove {name} price', { name })}
          onClick={() => void commit(rowId, settings => removePrice(settings, officialPrices, id))}>{t('Remove')}</SourceSettingsButton>}
      </div>
      <table className="msx-price-table">
        <thead><tr><th scope="col"><span className="sr-only">{t('Tier')}</span></th>{PRICE_FIELDS.map(field => <th key={field} scope="col">{FIELD_LABELS[field]}</th>)}</tr></thead>
        <tbody>{PRICE_TIERS.map(tier => <tr key={tier}><th scope="row">{TIER_LABELS[tier]}</th>{PRICE_FIELDS.map(field => <td key={field}>
          <NumberField className="msx-price-input" label={t('{name} {tier} {field} price', { name, tier: TIER_LABELS[tier].toLowerCase(), field: FIELD_LABELS[field].toLowerCase() })} placeholder="0"
            min={0} max={10000} step={0.01} disabled={disabled} invalid={!!rowErrors[rowId]} value={entry[tier][field]}
            onCommit={(text, revert) => {
              const value = parseNumberInput(text);
              if (value === undefined || Number.isNaN(value)) { setRowErrors(errors => ({ ...errors, [rowId]: t('Enter a price.') })); revert(); return; }
              void commit(rowId, settings => setPrice(settings, officialPrices, id, tier, field, value)).then(ok => { if (!ok) revert(); });
            }}/>
        </td>)}</tr>)}</tbody>
      </table>
      {rowErrors[rowId] && <div className="ss-row-below"><span className="ss-row-error" title={rowErrors[rowId]}>{rowErrors[rowId]}</span></div>}
    </div>;
  };
  const addForm = adding && <form className="msx-add" onSubmit={async event => {
    event.preventDefault(); event.stopPropagation();
    const ok = await commit('price-add', settings => addPrice(settings, officialPrices, adding.id, adding.name));
    if (ok) setAdding(null);
  }}>
    <input data-cds="TextInput" className="cds-input cds-reset msx-text" aria-label={t('Model id')} placeholder={t('Model id, e.g. deepseek-chat')} value={adding.id} maxLength={128} spellCheck={false} autoFocus
      onChange={event => { const id = event.currentTarget.value; setAdding(value => ({ ...value, id })); }}/>
    <input data-cds="TextInput" className="cds-input cds-reset msx-text" aria-label={t('Display name')} placeholder={t('Display name (optional)')} value={adding.name} maxLength={60}
      onChange={event => { const name = event.currentTarget.value; setAdding(value => ({ ...value, name })); }}/>
    <SourceSettingsButton type="submit" variant="primary" size="sm" disabled={!adding.id.trim()}>{t('Add')}</SourceSettingsButton>
    <SourceSettingsButton variant="ghost" size="sm" onClick={() => { setAdding(null); setRowErrors(value => ({ ...value, 'price-add': null })); }}>{t('Cancel')}</SourceSettingsButton>
    {rowErrors['price-add'] && <span className="ss-row-error msx-add-error" role="alert">{rowErrors['price-add']}</span>}
  </form>;
  const pricingRows = [
    settingRow('pricing-source', t('Price table'), <>
      {t('CNY per 1M tokens, used for the estimated cost on the Usage page.')} {customPrices ? t('Your prices replace the official ones.') : t('Showing DeepSeek’s official prices.')}
      {official.peakWindows && <> {t('Peak: {windows}.', { windows: official.peakWindows })}</>}
    </>, <div className="msx-actions">
      <SourceSettingsButton variant="ghost" size="sm" icon="ArrowUpRight" iconPosition="end" onClick={() => void Promise.resolve(desktopCall?.('external', { url: pricingUrl })).catch(() => {})}>{t('Official pricing')}</SourceSettingsButton>
      <SourceSettingsButton size="sm" disabled={disabled || !customPrices} onClick={() => void commit('pricing-source', settings => resetPrices(settings))}>{t('Reset to official prices')}</SourceSettingsButton>
    </div>, below('pricing-source')),
  ];

  // ---- Custom providers (the Harness llm-pi-ai adapter, DeepSeek core only)
  const providerRows = providers.providers.map(provider => settingRow(`provider-${provider.route}`, provider.displayName ? `${provider.displayName} (${provider.route})` : provider.route,
    `${PROTOCOL_LABELS[provider.api] || provider.api} · ${provider.baseURL} · ${tn(provider.models.length, '{count} model', '{count} models')} · ${provider.hasKey ? t('key saved') : t('no key')}`,
    <div className="msx-actions">
      <SourceSettingsButton size="sm" variant="ghost" disabled={!!providerBusy} aria-label={t('Edit {name}', { name: provider.displayName || provider.route })} onClick={() => setProviderDialog({ initial: provider })}>{t('Edit')}</SourceSettingsButton>
      <SourceSettingsButton size="sm" disabled={!!providerBusy} busy={providerBusy === provider.route} aria-label={t('Remove {name}', { name: provider.displayName || provider.route })}
        onClick={() => void providerCall(provider.route, { op: 'provider-remove', route: provider.route }).catch(error => setProviders(value => ({ ...value, error: error?.message || String(error) })))}>{t('Remove')}</SourceSettingsButton>
    </div>));
  const providerGroup = deepseek && providers.available && <SettingsGroup title={t('Custom providers')} rows={providerRows}>
    {!providerRows.length && <p className="msx-empty">{t('Add an OpenAI-compatible endpoint to use its models next to DeepSeek’s.')}</p>}
    {providers.error && <p className="ss-row-error msx-provider-error" role="alert">{providers.error}</p>}
    <div className="msx-add-row msx-provider-actions">
      <SourceSettingsButton size="sm" icon="Add" disabled={!!providerBusy} onClick={() => setProviderDialog({ initial: null })}>{t('Add provider')}</SourceSettingsButton>
      {providers.changed && <><span className="msx-pending" role="status">{t('Restart the core to apply.')}</span>
        {onReconnect && <SourceSettingsButton size="sm" variant="primary" onClick={() => { setProviders(value => ({ ...value, changed: false })); void Promise.resolve(onReconnect()).catch(() => {}); }}>{t('Restart core')}</SourceSettingsButton>}</>}
    </div>
  </SettingsGroup>;

  // Advanced starts open when something in it was already changed.
  const customized = Object.keys(saved.params).length > 0 || !!saved.prices;
  return <div className="msx-page">
    {notice}
    <ConnectionGroup deepseek={deepseek} desktopCall={desktopCall} onReconnect={onReconnect}/>
    <SourceDisclosure className="msx-advanced" triggerClassName="msx-advanced-trigger" defaultOpen={customized}
      label={<span className="msx-advanced-label"><span className="text-heading-semibold">{t('Advanced')}</span><span className="msx-advanced-hint">{t('Model defaults, pricing and custom providers')}</span></span>}>
    <div className="msx-advanced-body">
    <p className="msx-note">{t('Defaults for every DeepSeek session; changes apply from the next request. top_p is not supported by the DeepSeek Harness adapter.')}</p>
    {modelGroups.length ? modelGroups : <SettingsGroup title={t('Model defaults')}><p className="msx-empty">{connected ? t('No models are available yet.') : t('Connect to load the model list.')}</p></SettingsGroup>}
    <SettingsGroup title={t('Pricing')} rows={pricingRows}>
      <div className="msx-prices" aria-busy={official.loading || undefined}>
        {official.loading && !priceIds.length && <p className="msx-empty" role="status">{t('Loading prices…')}</p>}
        {!official.loading && !priceIds.length && <p className="msx-empty">{official.error ? t('Couldn’t load the official prices.') : t('No prices yet.')}</p>}
        {priceIds.map(priceTable)}
      </div>
      <div className="msx-add-row">
        {addForm || <SourceSettingsButton size="sm" icon="Add" disabled={disabled || official.loading} onClick={() => setAdding({ id: '', name: '' })}>{t('Add model price')}</SourceSettingsButton>}
      </div>
    </SettingsGroup>
    {providerGroup}
    </div>
    </SourceDisclosure>
    {providerDialog && <ProviderDialog initial={providerDialog.initial} protocols={providers.protocols?.length ? providers.protocols : [...PROVIDER_PROTOCOLS]}
      onCancel={() => setProviderDialog(null)}
      onSubmit={async ({ provider, previousRoute, apiKey }) => {
        await providerCall(provider.route, { op: 'provider-save', provider, previousRoute, apiKey });
        setProviderDialog(null);
      }}/>}
  </div>;
}
