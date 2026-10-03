import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsSearch, settingsMatchRange, normalizeSettingsQuery } from '../src/settings-model.mjs';
const sections=[{id:'code',label:'Code',icon:'Code'},{id:'general',label:'General'},{id:'plugins',label:'Plugins',customize:true,keywords:['marketplace','extensions']}];
const groups=[{tab:'code',rows:[{id:'size',label:'Transcript text size'},{id:'width',label:'Transcript width'},{id:'view',label:'Default transcript view'},{id:'font',label:'Transcript font'},{id:'codeFont',label:'Code font'}]},{tab:'general',rows:[{id:'size',label:'Transcript text size'}]}];
test('three visible children and more navigation retain section identity and accurate hidden count',()=>{
 const hits=settingsSearch(sections,groups,'transcript');assert.deepEqual(hits.map(hit=>hit.kind),['hit','child','child','child','more']);assert.equal(hits[0].label,'Code');assert.deepEqual(hits.filter(h=>h.kind==='child').map(h=>h.id),['size','width','font']);assert.equal(hits.at(-1).count,1);assert.equal(hits.at(-1).id,undefined);assert.equal(hits.at(-1).tab,'code');assert.equal(new Set(hits.map(h=>h.key)).size,hits.length);
});
test('single child presents destination and subtitle while multi-character section hit keeps children',()=>{
 const hits=settingsSearch(sections,groups,'code');assert.deepEqual(hits.map(h=>[h.kind,h.label]),[['hit','Code'],['child','Code font']]);
 const single=settingsSearch(sections,groups,'width');assert.equal(single.length,1);assert.equal(single[0].section,'Code');assert.equal(single[0].via,'Transcript width');assert.equal(single[0].id,'width');
 const short=settingsSearch(sections,groups,'t');// cc011544b Z:605–612 also permits keyword fallback for one-character queries.
 assert.equal(short.length,2);assert.equal(short[0].kind,'hit');assert.equal(short[0].id,'size');assert.equal(short[1].tab,'plugins');assert.equal(short[1].via,'marketplace');
});
test('keywords are fallback section navigation and no unsupported capabilities enter the index',()=>{
 assert.deepEqual(settingsSearch(sections,groups,'marketplace').map(h=>[h.tab,h.via,h.id]),[['plugins','marketplace',undefined]]);assert.deepEqual(settingsSearch(sections,groups,'billing'),[]);assert.equal(settingsSearch(sections,groups,' ').length,3);
});
test('normalization covers accents, curly quotes, word separators and compound query ranking',()=>{
 assert.equal(normalizeSettingsQuery('  Café—“A”_CODE-font\t ’B’ '),'cafe—"a" code font \'b\'');
 const g=[{tab:'code',rows:[{id:'a',label:'Code font'},{id:'b',label:'Font for Code'},{id:'c',label:'Decode Font'},{id:'d',label:'Café Mode'}]}];
 assert.equal(settingsSearch(sections,g,'cafe')[0].id,'d');assert.equal(settingsSearch(sections,g,'code_font').find(h=>h.id)?.id,'a');assert.deepEqual(settingsSearch(sections,g,'code font').filter(h=>h.id).map(h=>h.id),['a','b','c']);
});
test('ordinary sections deduplicate shared labels while Customize preserves distinct catalog entries',()=>{
 const s=[{id:'a',label:'A'},{id:'b',label:'B'},{id:'c',label:'C',customize:true}],g=s.map(t=>({tab:t.id,rows:[{id:'first',label:'Shared'},{id:'second',label:'Shared'}]}));
 assert.deepEqual(settingsSearch(s,g,'shared').map(h=>h.tab),['a','c']);
 const paths=[{tab:'c',rows:[{id:'first',label:'Shared',subpathId:'one'},{id:'second',label:'Shared',subpathId:'two'}]}];assert.equal(settingsSearch(s,paths,'shared').filter(h=>h.kind==='child').length,2);
});
test('matching does not search arbitrary descriptions or synthesize missing rows',()=>{
 assert.deepEqual(settingsSearch(sections,[{tab:'code',rows:[{id:'fast',label:'Fast mode',description:'needle',searchText:'needle'}]}],'needle'),[]);
});
test('literal first-match highlight preserves original Unicode and does not pretend normalized fuzzy matches are contiguous',()=>{
 assert.deepEqual(settingsMatchRange('Code code','CODE'),{start:0,end:4});assert.equal(settingsMatchRange('Code font','code_font'),null);assert.equal(settingsMatchRange('Café','cafe'),null);assert.equal(settingsMatchRange('Anything',''),null);
 assert.deepEqual(settingsMatchRange('İx😀 Code','code'),{start:5,end:9});assert.deepEqual(settingsMatchRange('İx','i'),{start:0,end:1});assert.deepEqual(settingsMatchRange('x😀y','😀'),{start:1,end:3});
});

// Fidelity F14: shared-22:2274-2285 / :3915-3918 zC — Usage is navHidden (claudified_usage_page_pace treatment):
// left out of the nav and the narrow tabs, still a search destination.
test('nav-hidden sections leave the nav and the narrow tabs but stay searchable',async()=>{
 const {settingsNavSections}=await import('../src/settings-shell-model.mjs');
 const shell=[{id:'preferences',label:'Preferences'},{id:'usage',label:'Usage',navHidden:true},{id:'code',label:'Code'}];
 assert.deepEqual(settingsNavSections(shell).map(s=>s.id),['preferences','code']);
 const plain=[{id:'a'},{id:'b'}];assert.equal(settingsNavSections(plain),plain);
 assert.deepEqual(settingsSearch(shell,[],'usage').map(hit=>[hit.kind,hit.tab]),[['hit','usage']]);
 const fs=await import('node:fs'),path=await import('node:path');
 const text=fs.readFileSync(path.resolve(import.meta.dirname,'../src/source-settings.jsx'),'utf8');
 assert.match(text,/\{id:'usage',label:'Usage',icon:'UsageGaugeMiddle',group:'Settings',navHidden:true\}/);
 assert.match(text,/const navTabs = settingsNavSections\(tabs\);/);
 assert.match(text,/\{navTabs\.map\(t=><button role="tab"/,'narrow tablist');
 assert.match(text,/<ul>\{navTabs\.filter\(t=>t\.group===group\)\.map\(/,'wide nav');
 assert.match(text,/settingsSearch\(tabs,/,'search receives the unfiltered sections');
 const main=fs.readFileSync(path.resolve(import.meta.dirname,'../src/main.jsx'),'utf8');
 const settingsItem=main.indexOf('data-testid="user-menu-settings"'),usageItem=main.indexOf('data-testid="user-menu-usage"');
 assert.ok(settingsItem>0&&usageItem>settingsItem&&main.slice(settingsItem,usageItem).split('<SourceMenu.Item').length===2,'Usage follows Settings in the account menu');
 assert.match(main.slice(usageItem-80,usageItem+120),/icon="UsageGaugeMiddle" data-testid="user-menu-usage" onClick=\{\(\) => setSettings\("usage"\)\}>Usage</);
});
// Fidelity F14: c71860c77-B72Ova_w It — General lists version, Run on startup, Menu bar and Storage; keep-awake is a Code row only.
test("searching 'keep awake' finds a single Code section hit; General no longer repeats the keep-awake rows",async()=>{
 const sections=[{id:'code',label:'Code'},{id:'general',label:'General'}];
 const groups=[{tab:'code',title:'Local sessions',rows:[{id:'keepAwake',label:'Keep computer awake while DeepSeek works'},{id:'keepAwakeOnBattery',label:'Keep awake on battery power'}]},
  {tab:'general',title:'General desktop settings',rows:[{id:'version',label:'Desktop app version'},{id:'startup',label:'Run on startup'},{id:'menuBarEnabled',label:'Menu bar'},{id:'storage',label:'Storage'}]}];
 const hits=settingsSearch(sections,groups,'keep awake');
 assert.ok(hits.length>0);assert.deepEqual([...new Set(hits.map(hit=>hit.tab))],['code']);assert.equal(hits.filter(hit=>hit.kind==='hit').length,1);
 const fs=await import('node:fs'),path=await import('node:path');
 const text=fs.readFileSync(path.resolve(import.meta.dirname,'../src/source-settings.jsx'),'utf8');
 const general=text.slice(text.indexOf("{tab:'general',title:'General desktop settings'"),text.indexOf("{tab:'developer',title:'Local MCP servers'"));
 assert.ok(general.length>0);assert.equal(general.includes('keepAwake'),false);assert.equal(general.includes('Loading version'),false);
 assert.match(general,/skeleton:desktop===null/);assert.match(general,/\.\.\.\(build\?\.version\?\[row\('version'/);
 assert.equal(text.split('...keepAwake').length,2,'the keep-awake rows render once, on the Code page');
});
