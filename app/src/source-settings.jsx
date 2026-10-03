import {SourceProfileSetting} from './source-profile-setting.jsx';
import {useAccountSettings} from './source-account-settings.jsx';
import { SourceSwitch as SettingSwitch } from './source-switch.jsx';
import { SourceSettingsButton } from './source-settings-button.jsx';
import React, { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons';
import { SourceSegments } from './source-segments.jsx';
import { SourceCodeFontSetting } from './source-code-font-setting.jsx';
import { SourceSelect } from './source-select.jsx';
import { bypassAvailability } from '../electron/permission-policy.mjs';
import { appearancePreferences, fastTierForModel } from '../electron/preferences.mjs';
import { lightThemes, darkThemes } from './code-theme-catalog.mjs';
import { TRANSCRIPT_VIEW_LABELS } from './transcript-view-model.mjs';
import { SourceCodeThemePreview } from './source-code-theme-preview.jsx';
import { SourceCustomize } from './source-customize.jsx';
import { createSettingsSnapshotReader, removeDeveloperServer } from './developer-server-actions.mjs';
import './source-settings.css';
import { SourceUsage } from './source-usage';
import { DeveloperServers, StorageDialog } from './source-settings-pages.jsx';
import { useModalPresence } from './use-modal-presence';
import { settingsTabIndex } from './modal-presence.mjs';
import { holdModalInert } from './modal-inert.mjs';
import { settingsSearch, sandboxFacts, mcpStatus, desktopErrors } from './settings-model.mjs';
import { coreEngine } from './session-engine-model.mjs';
import { SettingsSearchResults } from './source-settings-search.jsx';
import { bindSettingsAnchor } from './settings-anchor.mjs';
import { EMPTY_SETTINGS_CATALOG, settingsCatalogGroups } from './settings-catalog-search.mjs';
import { effortName } from './model-menu-model.mjs';
import { settingsNavSections, settingsInitialFocus, NOTIFICATION_LEVEL_ITEMS, notificationLevel, drawAttentionDisabled, keepAwakeEnabled } from './settings-shell-model.mjs';
const noCatalogSubscription=()=>()=>{};
const emptyCatalog=()=>EMPTY_SETTINGS_CATALOG;

// c71860c77 Rr/Br: a text button that opens a large full-height dialog whose
// body is a focusable pre region filled from the plain-text notices file (only
// a text/plain response is shown). Escape closes it and focus returns to the
// button; the settings dialog underneath stays open.
const FONT_LICENSES_URL='./third-party/fonts.txt';
function FontLicenses() {
  const [open,setOpen]=useState(false), [text,setText]=useState(null), [failed,setFailed]=useState(false);
  const button=useRef(null), body=useRef(null), titleId=useId();
  const show=()=>{
    setOpen(true);
    if(text!==null)return;
    fetch(FONT_LICENSES_URL).then(r=>r.ok&&r.headers.get('content-type')?.startsWith('text/plain')?r.text():null).catch(()=>null)
      .then(value=>{if(value!==null)setText(value);else setFailed(true);});
  };
  useEffect(()=>{
    if(!open)return;
    // shared-frame :5619-5620 Ef/Df: while a dialog is nested in it, the Settings popup carries
    // data-nested-dialog-open (its own ::after dim and 2px blur) and the nested backdrop stays clear.
    const parent=button.current?.closest('.ss-settings-dialog');parent?.setAttribute('data-nested-dialog-open','');
    const frame=requestAnimationFrame(()=>body.current?.focus({preventScroll:true}));
    return()=>{cancelAnimationFrame(frame);parent?.removeAttribute('data-nested-dialog-open');button.current?.focus({preventScroll:true});};
  },[open]);
  return <>
    <button type="button" ref={button} className="ss-text-button" aria-haspopup="dialog" aria-expanded={open} onClick={show}>Font licenses</button>
    {open&&createPortal(<div className="ss-backdrop ss-backdrop-stacked" onMouseDown={e=>{if(e.target===e.currentTarget){e.stopPropagation();setOpen(false);}}}>
      <section className="ss-dialog ss-licenses" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        onKeyDown={e=>{
          // Portaled to body: stop React propagation so the settings dialog does not also handle Escape/Tab.
          e.stopPropagation();
          if(e.key==='Escape'){e.preventDefault();setOpen(false);return;}
          if(e.key==='Tab'){const items=[...e.currentTarget.querySelectorAll('button:not(:disabled),[tabindex="0"]')];const first=items[0],last=items.at(-1);
            if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
        }}>
        <header className="ss-licenses-header"><h2 id={titleId}>Font licenses</h2>
          <button type="button" className="ss-close" aria-label="Close" onClick={()=>setOpen(false)}><Icon name="X" size={16}/></button></header>
        <pre ref={body} role="region" aria-label="Font licenses" tabIndex={0} className="ss-licenses-body" aria-busy={text===null&&!failed||undefined}>{text??(failed?'The font licenses file could not be loaded.':'Loading…')}</pre>
      </section>
    </div>,document.body)}
  </>;
}
// c71860c77 _i: two columns (grid-cols-2 gap-md py-md), each a mode-filtered
// Select above the fixed greet.ts diff preview (min-h-[94px] overflow-clip rounded-lg border).
function CodeThemeGrid({ light, dark, onChange }) {
  const column=(mode,value,items,label)=> <div className="ss-theme-column">
    <SourceSelect label={label} value={value} items={items} onChange={next=>onChange(mode==='light'?'codeThemeLight':'codeThemeDark',next)}/>
    <div className="ss-theme-preview-frame"><SourceCodeThemePreview mode={mode} theme={value}/></div>
  </div>;
  return <div className="ss-theme-grid">{column('light',light,lightThemes(),'Light code theme')}{column('dark',dark,darkThemes(),'Dark code theme')}</div>;
}

export { SourceSwitch as SettingSwitch } from './source-switch.jsx';
// shared-22 mS:2424–2501 appends Desktop app before Customize; zC only
// removes hidden entries. Keep the flat array in that same order for tw's
// narrow-screen tabs. hS supplies Scroll, Connectors and Plugin icons.
// Usage follows the claudified_usage_page_pace treatment (shared-21:1316-1336 pv; shared-22:2274-2285
// navHidden): zC (:3915-3918) drops it from the nav and the narrow tabs, the account menu opens it
// (sidebar-rows.js:16769-16793 uV) and search still lists it (the search gets the unfiltered groups).
const tabs = [
  {id:'preferences',label:'Preferences',icon:'Settings',group:'Settings',keywords:['general']},
  {id:'usage',label:'Usage',icon:'UsageGaugeMiddle',group:'Settings',navHidden:true},
  {id:'code',label:'Code',icon:'Code',group:'Settings'},
  {id:'general',label:'General',icon:'Computer',group:'Desktop app'},
  {id:'developer',label:'Developer',icon:'Wrench',group:'Desktop app'},
  {id:'customize-skills',label:'Skills',icon:'Scroll',group:'Customize',customize:true,keywords:['custom instructions','agent skills']},
  {id:'customize-connectors',label:'Connectors',icon:'Connectors',group:'Customize',customize:true,keywords:['mcp','integrations','tools']},
  {id:'customize-plugins',label:'Plugins',icon:'Plugin',group:'Customize',customize:true,keywords:['marketplace','extensions']},
];
const navGroups = ['Settings','Desktop app','Customize'];
export const SETTINGS_SECTIONS = tabs.map(t=>t.id);
const navTabs = settingsNavSections(tabs);
export function SourceSettings({ open = true, ...props }) {
  const presence = useModalPresence(open);
  return presence.present ? <SettingsContent {...props} presence={presence}/> : null;
}
function SettingsContent({ presence, config, model, effort, permission, boot, busy, initialSection, readUsage, desktopCall, customize, onSave, onFolder, onReconnect, onLogin, onAccountAction, onRefreshAccount, onReveal, onClose }) {
  const [tab,setTab]=useState(()=>tabs.some(t=>t.id===initialSection)?initialSection:'preferences'), [query,setQuery]=useState(''), [pending,setPending]=useState(''), [error,setError]=useState(''), [build,setBuild]=useState(null), [focus,setFocus]=useState(null);
  useEffect(()=>{if(tabs.some(t=>t.id===initialSection)){setTab(initialSection);setQuery('');setFocus(null);}},[initialSection]);
  const catalog=useSyncExternalStore(customize?.store?.subscribe||noCatalogSubscription,customize?.store?.getSnapshot||emptyCatalog,customize?.store?.getSnapshot||emptyCatalog);
  useEffect(()=>{
    if(!customize?.store)return;
    const {store,cwd,threadId}=customize;
    // Read-only catalogs; the existing store fences replies and deduplicates
    // simultaneous consumers such as the composer and the actual page.
    void Promise.allSettled([store.loadSkills({cwd}),store.loadPlugins({cwd}),store.loadMcp({cwd,threadId:threadId??null})]);
  },[customize?.store,customize?.cwd,customize?.threadId]);
  const [desktop,setDesktop]=useState(null),[desktopRevision,setDesktopRevision]=useState(0),[storage,setStorage]=useState(null),[rowErrors,setRowErrors]=useState({}),[searchOpen,setSearchOpen]=useState(false),[searchIndex,setSearchIndex]=useState(0),[highlight,setHighlight]=useState(null),[narrow,setNarrow]=useState(()=>innerWidth<=767);
  const refreshDesktop = useRef(null), removingServer = useRef(false);
  useEffect(()=>{const update=()=>setNarrow(innerWidth<=767);window.addEventListener('resize',update);return()=>window.removeEventListener('resize',update);},[]);
  useEffect(() => {
    const reader = createSettingsSnapshotReader({
      read: () => desktopCall('desktop-settings-read', { threadId: customize?.threadId }),
      onValue: setDesktop,
      onError: reason => setDesktop(current => ({ ...current, errors: { ...current?.errors, connection: reason.message } })),
      refreshCatalog: () => customize?.store?.loadMcp({ force: true, cwd: customize?.cwd, threadId: customize?.threadId ?? null }),
    });
    refreshDesktop.current = reader.refresh;
    void reader.refresh().catch(() => {});
    return () => { reader.dispose(); if (refreshDesktop.current === reader.refresh) refreshDesktop.current = null; };
  }, [desktopRevision, boot?.connected, customize?.threadId, customize?.cwd, customize?.store, desktopCall]);
  const removeServer = async name => {
    if (removingServer.current || pending) return false;
    removingServer.current = true; setPending('mcp-remove');
    const refresh = refreshDesktop.current;
    try {
      return await removeDeveloperServer(name, {
        confirm: message => window.confirm(message),
        call: customize.call,
        refresh: () => refresh?.(true),
      });
    } finally { removingServer.current = false; setPending(''); }
  };
  useEffect(()=>{if(!highlight || !presence.visible)return;return bindSettingsAnchor(presence.popup.current,highlight.id,()=>setHighlight(current=>current===highlight?null:current));},[highlight,tab,presence.visible,presence.popup]);
  useEffect(()=>{if(tab==='usage')presence.popup.current?.focus({preventScroll:true});},[tab]);
  const root=presence.popup, search=useRef(null), titleId=useId(), close=useRef(onClose);close.current=onClose;
  const prefs=appearancePreferences(config), account=boot?.account?.account, models=boot?.models || [], chosen=models.find(m=>m.model===model), fast=fastTierForModel(chosen);
  useEffect(()=>{let live=true;fetch('./build-info.json').then(r=>r.json()).then(value=>live&&setBuild(value)).catch(()=>{});return()=>{live=false;};},[]);
  // The opener is read in a layout effect, before any passive effect moves focus: the tab==='usage' effect above
  // is declared first and already focused the popup, so /usage (main.jsx:1352) captured the popup itself and, it
  // being disconnected on close, fell back to Account menu instead of the composer (HANDOFF 0.2.124 session-actions).
  const opener=useRef(null);useLayoutEffect(()=>{opener.current=document.activeElement;},[]);
  useEffect(()=>{
    // cc011544b _t: the wide nav search takes focus on open ({preventScroll, focusVisible:false}) so a query can
    // be typed at once; it leaves focus alone once it is already inside this dialog. Narrow tabs and the
    // stacked Usage page keep focusing the popup (settings-shell-model settingsInitialFocus).
    const initialFocus=()=>{
      const field=settingsInitialFocus({narrow,section:tab})==='search'?search.current:null, active=document.activeElement;
      if(active&&active!==root.current&&root.current?.contains(active))return;
      if(field)field.focus({preventScroll:true,focusVisible:false});else root.current?.focus();
    };
    const previous=opener.current, frame=requestAnimationFrame(initialFocus);
    const releaseInert=holdModalInert(document.getElementById('root'));
    initialFocus();
    return()=>{cancelAnimationFrame(frame);releaseInert();if(previous?.isConnected && previous !== document.body&&!previous.closest('[inert]'))previous.focus({preventScroll:true});else document.querySelector('[aria-label="Account menu"]')?.focus({preventScroll:true});};
  },[]);
  useEffect(()=>{
    // Base UI Dialog useDismiss listens for Escape on the document. The root onKeyDown below only
    // sees keys while focus is inside, so when a focused control is natively disabled mid-action
    // (Refresh usage, Reconnect) focus falls to <body> and Escape was lost. Handle only that case,
    // and only while this is the topmost modal, so nested dialogs keep their own Escape.
    const doc=root.current?.ownerDocument;if(!doc)return;
    const key=e=>{if(e.key!=='Escape'||e.defaultPrevented||e.isComposing)return;const active=doc.activeElement;if(active&&active!==doc.body&&active!==doc.documentElement)return;
      if([...doc.querySelectorAll('[aria-modal="true"]')].at(-1)!==root.current)return;e.preventDefault();close.current();};
    doc.addEventListener('keydown',key);return()=>doc.removeEventListener('keydown',key);
  },[]);
  // Developer-page actions (Edit config, Reconnect, MCP removal) keep one in-flight key so a second press is
  // ignored; they no longer disable the rest of the page.
  async function action(key, fn) {if(pending)return;setPending(key);setError('');setRowErrors(v=>({...v,[key]:null}));try{await fn();}catch(e){setRowErrors(v=>({...v,[key]:e.message}));}finally{setPending('');}}
  // c71860c77 Ur (:1202-1300) and li (:1929-2440): every control saves on its own and nothing else on the page
  // changes state meanwhile. The row shows its new value at once (Dynamic workflows' optimistic `oe`, as
  // main.jsx preference() does for theme and model); a failed write drops it, so the reconciled saved value
  // shows again, with the row's below-slot message. Values clear once every write in flight has settled.
  const [optimistic,setOptimistic]=useState({}), writes=useRef(0);
  const shownValue=(key,saved)=>Object.hasOwn(optimistic,key)?optimistic[key]:saved;
  async function commit(rowId,patch,write=()=>onSave(patch)){
    setOptimistic(v=>({...v,...patch}));setRowErrors(v=>v[rowId]?{...v,[rowId]:null}:v);writes.current++;
    try{await write();}
    catch(e){
      console.warn(`Couldn’t save the ${rowId} setting:`,e);
      setOptimistic(v=>{const next={...v};for(const key of Object.keys(patch))if(Object.is(next[key],patch[key]))delete next[key];return next;});
      setRowErrors(v=>({...v,[rowId]:e?.message||String(e)}));
    }
    finally{if(--writes.current===0)setOptimistic({});}
  }
  const save=(key,value,rowId=key)=>commit(rowId,{[key]:value});
  const segments=(key,label,options)=> <SourceSegments label={label} value={shownValue(key,prefs[key] ?? config[key])} options={options} onChange={value=>save(key,value)}/>;
  const row=(id,label,description,control,searchText)=>({id,label,description,control,searchText:searchText??(typeof description==='string'?description:'')});
  const engine=coreEngine(boot?.core), facts=sandboxFacts(desktop?.policy,desktop?.requirements,{engine}), bypass=bypassAvailability(desktop?.requirements);
  // A core without MCP config writes (DeepSeek: capabilities.mcpConfigWrite false) offers no Delete.
  const mcpWritable=boot?.core?.capabilities?.mcpConfigWrite!==false;
  const booleanRow=(id,label,description,{indent=false,checked=!!shownValue(id,config[id]),disabled=false}={})=>({...row(id,label,description,<SettingSwitch label={label} checked={checked} disabled={disabled} onChange={value=>save(id,value)}/>),indent});
  // c71860c77 Jr (:1455-1500) on the Code page only; unset reads as on (index.chunk-ChZ67Jhw.js tV).
  const awake=key=>keepAwakeEnabled(shownValue(key,config[key]));
  const keepAwake=[booleanRow('keepAwake','Keep computer awake while DeepSeek works','Prevent your computer from sleeping while a Code session is running, so long tasks can finish. Your display can still turn off. Closing the laptop lid will still put it to sleep.',{checked:awake('keepAwake')}),...(awake('keepAwake')?[booleanRow('keepAwakeOnBattery','Keep awake on battery power','',{indent:true,checked:awake('keepAwakeOnBattery')})]:[])];
  // c71860c77:2240-2275: per-type items, unset reads as Banners, no disabled item.
  const level=id=>notificationLevel(shownValue(id,config[id]));
  const levelRow=(id,label,description)=>row(id,label,description,<SourceSelect label={label+' notification level'} value={level(id)} align="end" className="sselect-width-160" onChange={value=>save(id,value)} items={NOTIFICATION_LEVEL_ITEMS[id]}/>);
  const accountRows=useAccountSettings({snapshot:boot?.account,auth:boot?.auth,connected:boot?.connected,busy,engine,onLogin,onAccountAction,onRefreshAccount,onOpenExternal:url=>desktopCall('external',{url})});
  const groups=[
    {tab:'preferences',title:'Appearance',rows:[
      row('theme','Theme','',segments('theme','Theme',[{value:'system',label:'System',icon:'Computer'},{value:'light',label:'Light',icon:'Sun'},{value:'dark',label:'Dark',icon:'Moon'}])),
      row('motion','Motion','Reduce animation in streaming responses and other interface elements.',segments('motion','Motion',[{value:'system',label:'System'},{value:'reduce',label:'Reduced'}])),
    ]},
    {tab:'preferences',title:'Profile',rows:[{id:'name',label:'What should we call you?',description:'Used only in this app.',below:<SourceProfileSetting value={config.displayName || ''} onSave={value=>onSave({displayName:value})}/>}]},
    {tab:'preferences',title:'DeepSeek account',rows:accountRows},
    // c71860c77 pa: appearance precedes local sessions. Codex-only controls stay below.
    {tab:'code',title:'Code appearance',rows:[
      // Searchable as "Code theme" (local index entry; the official search index lists only Code font here).
      {id:'codeTheme',label:'Code theme',description:'Light and dark code themes',grid:<CodeThemeGrid light={shownValue('codeThemeLight',prefs.codeThemeLight)} dark={shownValue('codeThemeDark',prefs.codeThemeDark)} onChange={(key,value)=>save(key,value,'codeTheme')}/>},
      row('codeFont','Code font','Set a custom monospace font for code and terminal.',<SourceCodeFontSetting value={prefs.codeFont} placeholder={prefs.interfaceFont==='dyslexic'?'e.g. OpenDyslexic Mono':'e.g. JetBrains Mono'} onSave={value=>onSave({codeFont:value})}/>),
    ]},
    {tab:'code',title:'Appearance',rows:[
      row('interfaceFont','Interface font',<>Font for the whole interface — menus, sidebars, and panels. <FontLicenses/></>,segments('interfaceFont','Interface font',[{value:'anthropic',label:'Anthropic Sans'},{value:'system',label:'System'},{value:'dyslexic',label:'OpenDyslexic'}]),'Font for the whole interface — menus, sidebars, and panels. Font licenses'),
      row('transcriptSize','Transcript text size','Size of the conversation transcript text.',segments('transcriptSize','Transcript text size',[{value:'s',label:'Small'},{value:'m',label:'Medium'},{value:'l',label:'Large'}])),
      row('transcriptWidth','Transcript width','Maximum width of the transcript and composer columns.',segments('transcriptWidth','Transcript width',[{value:'s',label:'Narrow'},{value:'m',label:'Medium'},{value:'l',label:'Wide'}])),
      row('transcriptView','Default transcript view','The view sessions open in. Picking a view from a session’s Transcript view menu changes only that session.',segments('transcriptView','Default transcript view',['normal','thinking','verbose'].map(value=>({value,label:TRANSCRIPT_VIEW_LABELS[value]})))),
    ]},
    {tab:'code',title:'Local sessions',rows:[
      // c71860c77:2188-2212 YlYBASRBOt with DeepSeek substituted; the <link> to Anthropic's security page has no
      // DeepSeek counterpart, so the link element is dropped.
      row('bypass','Allow bypass permissions mode',<>Bypass all permission checks and let DeepSeek work uninterrupted. This works well for workflows like fixing lint errors or generating boilerplate code. Letting DeepSeek run arbitrary commands is risky and can result in data loss, system corruption, or data exfiltration (e.g., via prompt injection attacks).{!bypass.allowed && <span className="ss-bypass-reason"> {bypass.reason}</span>}</>,<SettingSwitch label="Allow bypass permissions mode" checked={shownValue('allowBypassPermissions',config.allowBypassPermissions)===true} disabled={!config.allowBypassPermissions && (!boot?.connected || !bypass.allowed)} onChange={value=>save('allowBypassPermissions',value,'bypass')}/>,'Bypass all permission checks and let DeepSeek work uninterrupted.'),
      booleanRow('dynamicWorkflows','Dynamic workflows','Let DeepSeek run multiple agents in parallel for complex tasks. Workflows can use a lot of your usage limit quickly.'),
      levelRow('permissionNotifications','Permission requests','DeepSeek needs your approval to use a tool.'),
      levelRow('questionNotifications','Questions','DeepSeek is asking you to choose between options.'),
      levelRow('completeNotifications','Task complete','DeepSeek finished and is waiting for your input.'),
      row('notificationSound','Notification sound','Played when an OS banner is shown.',<SourceSelect label="Notification sound" align="end" className="sselect-width-160" value={shownValue('notificationSound',config.notificationSound)||'system'} onChange={value=>save('notificationSound',value)} items={[{value:'system',label:'System sound'},{value:'none',label:'None'}]}/>),
      booleanRow('drawAttention','Draw attention on notifications','Bounce the Dock icon when DeepSeek needs your attention and the app isn’t focused.',{disabled:drawAttentionDisabled({permissionNotifications:level('permissionNotifications'),questionNotifications:level('questionNotifications')})}),
      ...keepAwake,
      row('archiveInactiveDays','Archive inactive sessions','Automatically archive local sessions after a period of no activity. Sessions that are running or have background work are never archived, and a worktree with uncommitted changes is kept on disk.',<SourceSelect label="Archive inactive sessions" align="end" className="sselect-width-160" value={shownValue('archiveInactiveDays',config.archiveInactiveDays)||0} onChange={value=>save('archiveInactiveDays',Number(value))} items={[0,1,2,7,14,30].map(d=>({value:d,label:d?`${d} ${d===1?'day':'days'}`:'Never'}))}/>),
      // c71860c77:2376-2398 g: the custom choice goes through the folder picker; only the saved location shows.
      row('worktreeLocation','Worktree location','Where to store Git worktrees for isolated coding sessions.',<div className="ss-worktree-control"><SourceSelect label="Worktree location" align="end" value={shownValue('worktreeLocation',config.worktreeLocation)||'project'} title={config.worktreeLocation==='custom'?config.worktreeDirectory:'.code/worktrees'} onChange={value=>value==='custom'?commit('worktreeLocation',{},async()=>{const c=await desktopCall('desktop-worktree-folder');if(c)await onSave({worktreeLocation:c.worktreeLocation});setDesktopRevision(n=>n+1);}):save('worktreeLocation','project')} items={[{value:'project',label:'Inside project',description:'.code/worktrees'},{value:'custom',label:'Custom…'}]}/>{config.worktreeLocation==='custom'&&config.worktreeDirectory&&<div className="ss-worktree-path" title={config.worktreeDirectory}>{config.worktreeDirectory}</div>}</div>),
      row('sandbox','Sandbox mode',facts.reason,<span>{facts.mode||'Unavailable'}</span>),
    ]},
    {tab:'code',title:'Model and permissions',rows:[
      // Disabled only where the original disables: the model and effort pickers while a turn is busy.
      row('model','Model','Used for your next message.',<SourceSelect label="Default model" value={shownValue('model',model)} disabled={busy||!boot?.connected} items={models.map(m=>({value:m.model,label:m.displayName||m.model}))} onChange={value=>{const next=models.find(m=>m.model===value);if(next)commit('model',{model:next.model,effort:next.defaultReasoningEffort});}}/>),
      row('effort','Reasoning effort','Available levels come from the selected model.',<SourceSelect label="Default reasoning effort" value={shownValue('effort',effort)} disabled={busy||!chosen} items={((models.find(m=>m.model===shownValue('model',model))||chosen)?.supportedReasoningEfforts||[]).map(e=>({value:e.reasoningEffort,label:effortName(e.reasoningEffort)}))} onChange={value=>save('effort',value)}/>),
      row('fast','Fast mode',fast ? `${fast.description || 'Uses the model’s Fast service tier'}. Applies to your next message.` : 'Not available for this model.',<SettingSwitch label="Enable fast mode" checked={!!fast&&!!shownValue('fastMode',config.fastMode)} disabled={!fast||!boot?.connected||busy} onChange={value=>save('fastMode',value,'fast')}/>),
      row('permissions','Permission mode','Auto asks when needed. Manual always asks before making changes. Accept edits applies file edits without asking. Plan is read-only.',<SourceSelect label="Default permission mode" value={shownValue('permission',permission)} disabled={busy} onChange={value=>save('permission',value,'permissions')} items={[{value:'auto',label:'Auto'},{value:'ask',label:'Manual'},{value:'acceptEdits',label:'Accept edits'},{value:'plan',label:'Plan'}]}/>),
    ]},
    // c71860c77-B72Ova_w It: version (wt renders nothing until the version is known), Run on startup, Menu bar,
    // Storage. Its own 'Keep computer awake' (scheduled tasks while the app is open) has no local counterpart;
    // the Code page's keep-awake rows stay on the Code page. While the desktop snapshot loads, the fallback
    // branch draws three skeleton rows under the version row.
    {tab:'general',title:'General desktop settings',skeleton:desktop===null,rows:[
      ...(build?.version?[row('version','Desktop app version','',<span className="ss-version">{build.version}</span>)]:[]),
      row('startup','Run on startup','Automatically start Code Desktop when you log in to your computer.',<SettingSwitch label="Run on startup" checked={shownValue('runOnStartup',desktop?.desktop?.runOnStartup)===true} disabled={!desktop?.desktop} onChange={enabled=>commit('startup',{runOnStartup:enabled},async()=>{const value=await desktopCall('desktop-startup',{enabled});setDesktop(current=>current?.desktop?{...current,desktop:{...current.desktop,runOnStartup:value===true}}:current);setDesktopRevision(n=>n+1);})}/>),
      booleanRow('menuBarEnabled','Menu bar','Show Code Desktop in the menu bar.'),
      row('storage','Storage','See how much space Code Desktop uses on this computer.',<SourceSettingsButton size="sm" onClick={()=>setStorage(true)}>Manage</SourceSettingsButton>),
    ]},
    {tab:'developer',title:'Local MCP servers',rows:[
      row('mcp-config','Configuration','Local MCP servers from your DeepSeek Harness configuration.',<button disabled={!boot?.connected} onClick={()=>action('mcp-config',()=>desktopCall('desktop-edit-config'))}>Edit config</button>),
      ...(desktop?.servers||[]).map(server=>row('mcp-'+server.name,server.name,server.toolsError||`${Object.keys(server.tools||{}).length} tools · ${server.authStatus}`,<span>{mcpStatus(server)}</span>)),
      ...(desktop?.servers?.length===0?[row('mcp-empty','No servers added','',null)]:[]),
    ]},
    {tab:'developer',title:'Local engine',rows:[
      // c71860c77-CCdfSDER F/I: the page's actions are CDS Buttons (shared-frame Ao); busy keeps the name 'Reconnect'.
      row('connection','DeepSeek core',boot?.connected?'Connected':'Disconnected',<SourceSettingsButton variant="secondary" size="sm" busy={pending==='reconnect'} disabled={busy} onClick={()=>action('reconnect',onReconnect)}>Reconnect</SourceSettingsButton>),
      row('engine','Engine','Uses DeepSeek Harness with the DeepSeek API key saved in ~/.dsh. Settings here do not rewrite your DeepSeek Harness configuration.',null),
    ]},
  ];
  // Profile belongs in Preferences, before Appearance (c0db37792:1391–1403).
  groups.sort((a,b)=>a.tab==='preferences'&&b.tab==='preferences'?(['Profile','DeepSeek account','Appearance'].indexOf(a.title)-['Profile','DeepSeek account','Appearance'].indexOf(b.title)):0);
  const results=settingsSearch(tabs,[...groups,...settingsCatalogGroups(catalog,{cwd:customize?.cwd,threadId:customize?.threadId??null})],query),shown=groups.filter(group=>group.tab===tab&&group.title!=='Local MCP servers'&&!tabs.find(t=>t.id===group.tab)?.customize);
  const chooseResult=result=>{
    const destination=result.targetSection||result.tab;
    setTab(destination);setQuery('');setSearchOpen(false);setSearchIndex(0);
    setFocus(result.focus||((result.kind==='more'&&destination.startsWith('customize-'))?{searchSeed:query.trim()}:null));
    setHighlight(!result.subpathId&&result.id?{id:result.id}:null);search.current?.blur();root.current?.focus();
  };
  useEffect(()=>{if(searchOpen)root.current?.querySelector('.ss-search-results [data-highlighted]')?.scrollIntoView({block:'nearest'});},[query,searchIndex,searchOpen]);
  const activeTab=tabs.find(t=>t.id===tab);
  const customizePage=activeTab?.customize&&customize ? <SourceCustomize key={JSON.stringify([tab,customize.cwd,customize.threadId])} section={tab} store={customize.store} threadId={customize.threadId} cwd={customize.cwd} call={customize.call}
    core={boot?.core} onEditConfig={boot?.connected?()=>desktopCall('desktop-edit-config'):undefined}
    onUseSkill={customize.onUseSkill} onOpenExternal={customize.onOpenExternal} onRevealPath={customize.onRevealPath} focus={focus} mcpDefinitions={desktop?.mcpDefinitions}
    onRestartCore={customize.onRestartCore}
    onNavigate={(section,target)=>{setFocus(target||null);setTab(section);setQuery('');}} /> : null;
  const closeSearch=()=>{setSearchOpen(false);setQuery('');setSearchIndex(0);};
  // cc011544b _t: the field (icon + input, no clear button; Escape clears) focuses its input when clicked.
  const searchField=<div className="ss-search" onClick={event=>{if(!event.target.closest?.('.ss-search-results'))search.current?.focus();}}><Icon name="Search" size={20}/>
    <input ref={search} aria-label="Search settings" placeholder="Search" value={query} aria-expanded={searchOpen}
      onBlur={closeSearch}
      onChange={event=>{setQuery(event.target.value);setSearchIndex(0);setSearchOpen(event.target.value.trim()!=='');}}
      onKeyDown={event=>{
        if(event.nativeEvent.isComposing){if(event.key==='Escape')event.stopPropagation();return;}
        if(!searchOpen)return;
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeSearch();search.current?.blur();}
        else if(event.key==='Tab')closeSearch();
        else if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();setSearchIndex(index=>(index+(event.key==='ArrowDown'?1:-1)+Math.max(1,results.length))%Math.max(1,results.length));}
        else if(event.key==='Enter'){event.preventDefault();if(results[searchIndex])chooseResult(results[searchIndex]);}
      }}/>
    {searchOpen&&<SettingsSearchResults results={results} query={query} active={searchIndex} onActive={setSearchIndex} onSelect={chooseResult}/>}
  </div>;
  const selectTab = id => { setTab(id);setQuery('');setError('');setFocus(null);setHighlight(null);setSearchOpen(false); };
  const usagePage = tab==='usage';
  const usageIdentity=JSON.stringify([boot?.connected,account?.type,account?.email,account?.planType]);
  // shared-22:4511-4515 ye and cc011544b's page header CloseButton: both are named 'Close'.
  const closeButton = <button type="button" className="ss-close" aria-label="Close" onClick={onClose}><Icon name="X" size={16}/></button>;
  return createPortal(<div className="ss-backdrop ss-settings-backdrop" data-open={presence.visible} onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section ref={root} className="ss-dialog ss-settings-dialog" data-usage={usagePage||undefined} data-open={presence.visible} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
    onKeyDown={e=>{if(!usagePage&&!narrow&&!e.altKey&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='f'){e.preventDefault();e.stopPropagation();search.current?.focus();search.current?.select();return;}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close.current();}if(e.key==='Tab'){const items=[...root.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length&&el.tabIndex>=0);const first=items[0],last=items.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===root.current)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===root.current)){e.preventDefault();first?.focus();}}}}>
    <h2 id={titleId} className="sr-only">{usagePage?'Usage':'Settings'}</h2>
    {usagePage?<header className="ss-usage-header"><h2 className="text-heading-semibold" aria-hidden="true">Usage</h2>{closeButton}</header>:narrow?<header className="ss-narrow"><div className="ss-narrow-heading"><strong aria-hidden="true">Settings</strong>{closeButton}</div><div role="tablist" aria-label="Settings" onKeyDown={event=>{
      const controls=[...event.currentTarget.querySelectorAll('[role="tab"]')], index=controls.indexOf(document.activeElement);
      if(index<0||event.nativeEvent.isComposing||event.altKey||event.metaKey||event.ctrlKey)return;
      const next=settingsTabIndex(index,controls.length,event.key,getComputedStyle(event.currentTarget).direction==='rtl');
      if(next===null)return;event.preventDefault();event.stopPropagation();controls[next].focus();controls[next].scrollIntoView({block:'nearest',inline:'nearest'});
    }}>{navTabs.map(t=><button role="tab" aria-selected={tab===t.id} tabIndex={tab===t.id?0:-1} key={t.id} onFocus={()=>selectTab(t.id)} onClick={()=>selectTab(t.id)}>{t.label}</button>)}</div></header>:<nav className="ss-nav" aria-label="Settings">{searchField}<div className="ss-nav-scroll scroll-fade-y scroll-fade-size-6">{navGroups.map(group=><div key={group}><p>{group}</p><ul>{navTabs.filter(t=>t.group===group).map(t=><li key={t.id}><button aria-current={tab===t.id?'page':undefined} onClick={()=>{setTab(t.id);setQuery('');setError('');setFocus(null);setHighlight(null);setSearchOpen(false);}}><Icon name={t.icon} size={20}/><span>{t.label}</span></button></li>)}</ul></div>)}</div></nav>}
    <div className="ss-pane" data-customize={!!activeTab?.customize}>
    {!usagePage&&!narrow&&<div className="ss-page-header">{closeButton}</div>}
    <div className="ss-content" key={tab} data-page={tab}>{error&&<p className="ss-error" role="alert">{error}</p>}{['code','developer'].includes(tab)&&desktopErrors(desktop?.errors).map(notice=><p className="ss-connection-notice" role="status" key={notice.key}>{notice.message}</p>)}{tab==='developer'&&<DeveloperServers desktop={desktop} connected={boot?.connected} pending={!!pending} error={rowErrors['mcp-config']} onRemove={customize?.call&&mcpWritable ? removeServer : undefined} onEditConfig={()=>action('mcp-config',()=>desktopCall('desktop-edit-config'))} onDocs={()=>action('mcp-config',()=>desktopCall('external',{url:'https://modelcontextprotocol.io/quickstart'}))}/>} {customizePage}{tab==='usage'&&<SourceUsage key={usageIdentity} readUsage={readUsage} engine={engine} onOpenLink={url=>Promise.resolve(desktopCall('external',{url})).catch(()=>{})}/>} {shown.map(group=><section className="ss-group" key={group.tab+group.title}><h3 tabIndex={-1} className="text-heading-semibold settings-row-title">{group.title}</h3><div className="settings-group-dividers">{(group.skeleton?group.rows.filter(row=>row.id==='version'):group.rows).map(row=><SettingRow key={row.id} row={row} error={rowErrors[row.id]}/>)}{group.skeleton&&[0,1,2].map(index=><SettingSkeletonRow key={index}/>)}</div></section>)}</div></div>
  </section>{storage&&<StorageDialog call={desktopCall} settingsRoot={root} onClose={()=>setStorage(false)}/>}</div>,document.body);
}
function SettingRow({row,error}) {
 const label=useId(),description=useId();
 return <div className={(row.grid?'ss-grid-row':'ss-row')} role="group" aria-labelledby={label} aria-describedby={row.description&&!row.grid?description:undefined} data-setting-id={row.id} data-settings-row="" data-indent={row.indent||undefined}>
   <div className="ss-row-top"><div className="ss-row-copy"><div id={label} className={row.grid?'sr-only':'text-body'}><span className="settings-row-title">{row.label}</span></div>{row.description&&!row.grid&&<div id={description} data-settings-desc="">{row.description}</div>}</div>{row.control&&<div className="ss-control">{row.control}</div>}</div>{row.grid}
   {/* c71860c77:1820-1840: a failed save is muted body text in the row's below slot; the raw reason stays in the title (and the console). */}
   {(row.below||error)&&<div className="ss-row-below">{row.below}{error&&<span className="ss-row-error" title={error}>Couldn’t save the setting. Try again.</span>}</div>}
 </div>;
}
// c71860c77-B72Ova_w It fallback: a row of two text bars (h-5 w-36 / h-5 w-72) beside a 40×24 pill, drawn with
// the shared-frame Skeleton classes from the loaded CDS stylesheet (role=status, sr-only "Loading").
const SKELETON_BAR='relative max-w-full overflow-hidden bg-[var(--cds-skeleton-base)] after:absolute after:inset-0 after:animate-[cds-shimmer_2s_linear_infinite] after:bg-[linear-gradient(90deg,transparent,var(--cds-skeleton-sheen),transparent)] motion-reduce:after:hidden';
const SkeletonBar=({className,radius='rounded'})=><div data-cds="Skeleton" role="status" className={`${SKELETON_BAR} ${radius} ${className}`}><span className="sr-only">Loading</span></div>;
function SettingSkeletonRow() {
 return <div className="ss-skeleton-row flex items-center justify-between gap-lg" data-settings-skeleton="">
   <div className="flex min-w-0 flex-1 flex-col gap-1"><SkeletonBar className="h-5 w-36"/><SkeletonBar className="h-5 w-72"/></div>
   <SkeletonBar className="h-6 w-10" radius="rounded-full"/>
 </div>;
}
