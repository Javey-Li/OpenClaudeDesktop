import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {_electron as electron} from '../../tools/node_modules/playwright/index.mjs';
import {fileKindIcon} from '../src/file-kind-icon.mjs';
// Files pane tree + filename-search rows (0.2.97). Source: panes-tile-current.js:5692-5775
// tree row: ONE Jt size xs "shrink-0 self-center text-muted" glyph, ae = directory ?
// CaretRight (transition-transform duration-fast motion-reduce:transition-none, rotate-90
// when open) : zr(name) = shared-14 cP; name "truncate text-primary"; no native title.
// File tabs (0.2.101): he (panes-tabs-current.js:333-491) over the ce model (panes-tile-current.js:6656-6710):
// no icon, no native title, 24px tab, 140px label, italic preview, pe close button, 700ms te tooltip
// with the relative dir as detail, and the he context menu (Keep open / Close file / Close other / Close all).
// Isolated profile + protocol fixture; only run through the offscreen run-suite adapter.
const root=path.resolve(import.meta.dirname,'..'),evidence=path.resolve(root,'../analysis/batch-20260920');await fs.mkdir(evidence,{recursive:true});
// The project root is a git repo now (analysis/ is gitignored inside it): keep the fixture workspace outside any repo.
const directory=await fs.mkdtemp(path.join(evidence,'files-pane-ui-')),profile=path.join(directory,'profile'),workspace=path.join(await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'cd-files-pane-'))),'workspace');
await fs.mkdir(profile,{recursive:true});await fs.mkdir(path.join(workspace,'nested','inner'),{recursive:true});await fs.mkdir(path.join(workspace,'skills','demo'),{recursive:true});
const files={'README.md':'# readme\n','index.html':'<p>x</p>\n','app.tsx':'export {};\n','data.csv':'a,b\n','store.sqlite':'','deck.pptx':'','bundle.zip':'','notes.txt':'notes\n','Makefile':'all:\n','config.json':'{}\n',
 'nested/deep.txt':'NESTED_DEEP_FILE\n','quarterly-infrastructure-migration-checklist.txt':'LONG_NAME_FILE\n','nested/inner/leaf.txt':'NESTED_LEAF_FILE\n','skills/demo/SKILL.md':'# skill\n',
 // R09: languages of the original 345-key map (c41eb0199) beyond the old ten extensions.
 'util.mjs':'export const answer = 42;\n','main.go':'package main\n\nfunc main() {}\n'};
for(const [name,body] of Object.entries(files))await fs.writeFile(path.join(workspace,name),body);
await fs.writeFile(path.join(workspace,'photo.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64'));
const A='files-pane-A',now=Math.floor(Date.now()/1000);
const prefs=theme=>({cwd:workspace,theme,mode:'code',model:'fixture',effort:'low',threadIds:[A],sidebarWidth:288,displayName:'Fixture'});
await fs.writeFile(path.join(profile,'preferences.json'),JSON.stringify(prefs('light')));
await fs.writeFile(path.join(profile,'fixture-threads.json'),JSON.stringify({next:100,threads:{[A]:{id:A,name:'Files pane A',cwd:workspace,createdAt:now,updatedAt:now,archived:false,turns:[]}}}));
const glyphs=JSON.parse(await fs.readFile(path.join(root,'src/generated/icons.json'),'utf8')),glyph=name=>String.fromCodePoint(glyphs[name]);
const build=JSON.parse(await fs.readFile(path.join(root,'dist/build-info.json'),'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');let testHash;
async function integrity(){assert.equal(sha(JSON.stringify(build.sources)),build.sourceSha256);for(const file of build.sources)assert.equal(sha(await fs.readFile(path.join(root,file.path))),file.sha256);
 for(const required of ['src/file-kind-icon.mjs','src/source-session.jsx','src/source-session.css','src/source-files-search.jsx'])assert.ok(build.sources.some(e=>e.path===required),required);
 assert.equal(JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version,build.version);
 const h=sha(await fs.readFile(path.join(root,'scripts/files-pane-ui-test.mjs'))+await fs.readFile(path.join(root,'src/file-kind-icon.mjs')));if(testHash)assert.equal(h,testHash);else testHash=h;}
const report={suite:'files-pane-ui',at:new Date().toISOString(),directory,build:{version:build.version,sourceSha256:build.sourceSha256},checks:[],metrics:{},rendererErrors:[],passed:false};let app,page,phase='launch';
const step=name=>{phase=name;console.log('FILESPANE '+name);};
const env={...process.env,CODE_DESKTOP_DATA:profile,CODEX_HOME:path.join(profile,'codex-home'),CODEX_BINARY:path.join(root,'tests/fixtures/codex-server.cjs')};delete env.ELECTRON_RUN_AS_NODE;delete env.CODE_DESKTOP_DEV_URL;
const frames=(count=4)=>page.evaluate(count=>new Promise(resolve=>{const step=()=>--count?requestAnimationFrame(step):resolve();requestAnimationFrame(step);}),count);
async function launch(){app=await electron.launch({args:[root],executablePath:path.join(root,'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),env,timeout:20000});page=await app.firstWindow();page.setDefaultTimeout(12000);
 page.on('pageerror',e=>report.rendererErrors.push({phase,message:e.message}));await page.getByRole('button',{name:'Model',exact:true}).filter({hasText:'Test model'}).waitFor();await size(1280,820);}
async function size(width,height){await app.evaluate(({BrowserWindow},s)=>BrowserWindow.getAllWindows()[0].setContentSize(s.width,s.height),{width,height});await page.waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,{width,height});await frames();}
const pane=()=>page.locator('.source-side-tile[data-tile-id="files"]');
// The tree is labelled "Project files" (panes-tile-current.js:4727; fidelity F11); only the kept tree or the
// filename-search results tree is shown at a time, so the role name stays unambiguous.
const tree=()=>pane().getByRole('tree',{name:'Project files',exact:true});
// F11 helpers: polling, toasts, menu rows ('|' = separator) and the run-suite in-memory clipboard (saved/restored here).
const poll=async(fn,label,ms=10000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,25));}throw Error('Timed out: '+label);};
const toasts=()=>page.locator('.source-toast-card:not([data-phase="ending"]) .source-toast-message').allTextContents();
const itemsOf=locator=>locator.evaluate(m=>[...m.querySelectorAll('[role^="menuitem"],[role="separator"]')].filter(n=>n.closest('[role="menu"]')===m).map(n=>n.getAttribute('role')==='separator'?'|':(n.querySelector('.smenu-label')?.textContent??n.textContent).trim()));
async function saveClipboard(){assert.equal(await app.evaluate(()=>!!globalThis.offscreenClipboard),true,'the Files pane copies require the offscreen in-memory clipboard');
 await app.evaluate(async({clipboard,ClipboardItem})=>{const originals=await clipboard.read();globalThis.filesPaneClipboard=await Promise.all(originals.map(async item=>new ClipboardItem(Object.fromEntries(await Promise.all(item.types.map(async type=>[type,await item.getType(type)]))))));});report.clipboardSaved=true;}
async function restoreClipboard(){await app.evaluate(async({clipboard})=>{const saved=globalThis.filesPaneClipboard;if(!saved)throw Error('Clipboard backup unavailable');if(saved.length)await clipboard.write(saved);else await clipboard.clear();delete globalThis.filesPaneClipboard;});report.clipboardRestored=true;}
async function open(){await page.locator(`[data-source-session-id="${A}"] .source-session-open`).click();await page.locator('.st-title').waitFor();await page.locator('.loading-state').waitFor({state:'detached'});await frames();}
async function openFiles(){await page.getByRole('button',{name:'Session options',exact:true}).click();await page.getByRole('menuitemcheckbox',{name:'Files',exact:true}).click();await pane().waitFor();await tree().getByRole('button',{name:'README.md',exact:true}).waitFor();await frames();}
async function shot(name){await page.screenshot({path:path.join(directory,name+'.png')});}
// Every rendered treeitem: its primary button holds exactly one 12px icon in --cds-text-muted and a --cds-text-primary name.
const rows=()=>tree().evaluate(treeNode=>{const probe=document.createElement('span');treeNode.append(probe);const color=v=>{probe.style.color=`var(${v})`;return getComputedStyle(probe).color;};
 const muted=color('--cds-text-muted'),primary=color('--cds-text-primary');probe.remove();
 return {muted,primary,rows:[...treeNode.querySelectorAll('[role="treeitem"]')].map(row=>{const button=row.querySelector(':scope > [data-tree-primary]'),icons=[...button.querySelectorAll('[data-cds="Icon"]')],icon=icons[0],s=icon&&getComputedStyle(icon),name=button.querySelector(':scope > span:last-child');
  return {name:button.getAttribute('aria-label'),path:button.dataset.filePath,level:Number(row.getAttribute('aria-level')),expanded:row.getAttribute('aria-expanded'),icons:icons.length,glyph:icon?.textContent,fontSize:s?.fontSize,color:s?.color,
   transform:s?.transform,transitionDuration:s?.transitionDuration,transitionProperty:s?.transitionProperty,nameColor:getComputedStyle(name).color,rowTitle:row.getAttribute('title'),buttonTitle:button.getAttribute('title'),titled:row.querySelectorAll(':scope > [data-tree-primary] [title]').length,
   height:button.getBoundingClientRect().height,paddingLeft:getComputedStyle(button).paddingLeft};})};});
function assertRows(snapshot,label){assert.ok(snapshot.rows.length>=12,label+': rows rendered');for(const row of snapshot.rows){const where=`${label} ${row.path}`;
 assert.equal(row.icons,1,where+': exactly one icon');assert.equal(row.fontSize,'12px',where+': 12px icon');assert.equal(row.color,snapshot.muted,where+': icon colour = --cds-text-muted');
 assert.equal(row.nameColor,snapshot.primary,where+': name = --cds-text-primary');assert.equal(row.glyph,glyph(row.expanded===null?fileKindIcon(row.name):'CaretRight'),where+': glyph');
 assert.equal(row.rowTitle,null,where+': no treeitem title');assert.equal(row.buttonTitle,null,where+': no row title');assert.equal(row.titled,0,where+': no nested title');
 assert.ok(Math.abs(row.height-24)<=.5,where+': 24px row');assert.equal(row.paddingLeft,`${8+8*(row.level-1)}px`,where+': indent 8 + 8 * level');}}
const byName=(snapshot,name)=>snapshot.rows.find(row=>row.name===name);
try{
 await integrity();await launch();await open();
 step('tree-light');await openFiles();
 await tree().getByRole('button',{name:'nested',exact:true}).click();await tree().getByRole('button',{name:'deep.txt',exact:true}).waitFor();
 await tree().getByRole('button',{name:'skills',exact:true}).click();await tree().getByRole('button',{name:'demo',exact:true}).click();await tree().getByRole('button',{name:'SKILL.md',exact:true}).waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('.source-tree-caret')].every(n=>n.getAnimations().every(a=>a.playState==='finished')));await frames();
 let snapshot=await rows();assertRows(snapshot,'light');report.metrics.light=snapshot;
 const expect={'README.md':'Note','index.html':'Globe','app.tsx':'Code','data.csv':'Spreadsheet','store.sqlite':'Database','deck.pptx':'Slides','bundle.zip':'Archive','photo.png':'Image','notes.txt':'File','Makefile':'File','config.json':'Code','SKILL.md':'Scroll','deep.txt':'File'};
 for(const [name,icon] of Object.entries(expect))assert.equal(byName(snapshot,name)?.glyph,glyph(icon),`${name} shows ${icon}`);
 const openCaret=byName(snapshot,'nested'),closedCaret=byName(snapshot,'inner');
 assert.equal(openCaret.expanded,'true');
 assert.match(openCaret.transform,/^matrix\((?:6\.12323e-17|0), 1, -1, (?:6\.12323e-17|0), 0, 0\)$/,'expanded caret is rotate(90deg)');
 assert.equal(closedCaret.expanded,'false');assert.equal(closedCaret.transform,'none','collapsed caret is unrotated');
 const fast=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--cds-dur-fast').trim());report.metrics.durFast=fast;assert.ok(fast,'--cds-dur-fast token resolves');
 assert.equal(openCaret.transitionProperty,'transform');assert.equal(openCaret.transitionDuration,`${parseFloat(fast)/(fast.endsWith('ms')?1000:1)}s`,'caret transition uses --cds-dur-fast');
 assert.equal(byName(snapshot,'README.md').transitionDuration,'0s','file glyphs do not transition');
 await shot('tree-light');
 report.checks.push('Each Files treeitem renders exactly one 12px glyph in --cds-text-muted (README.md Note, index.html Globe, app.tsx/config.json Code, data.csv Spreadsheet, store.sqlite Database, deck.pptx Slides, bundle.zip Archive, photo.png Image, notes.txt/Makefile/deep.txt File, skills/demo/SKILL.md Scroll) with a --cds-text-primary name, no native title, 24px rows indented 8 + 8 * level');
 report.checks.push('Directories show only CaretRight: expanded rotate(90deg) with a transform transition of --cds-dur-fast, collapsed unrotated; file glyphs do not transition');
 step('reduced-motion');await page.evaluate(()=>{document.documentElement.dataset.localMotion='reduce';window.dispatchEvent(new Event('local-motion-change'));});await frames();
 snapshot=await rows();assert.equal(byName(snapshot,'nested').transitionDuration,'0s','no caret transition under data-local-motion=reduce');assert.match(byName(snapshot,'nested').transform,/^matrix\((?:6\.12323e-17|0), 1, -1/);
 await tree().getByRole('button',{name:'nested',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[role="treeitem"] > [data-file-path="nested"]')?.parentElement.getAttribute('aria-expanded')==='false');
 assert.equal(await tree().locator('[data-file-path="nested"] .source-tree-caret').evaluate(n=>getComputedStyle(n).transform),'none','collapsing under reduced motion snaps to unrotated');
 await tree().getByRole('button',{name:'nested',exact:true}).click();await tree().getByRole('button',{name:'deep.txt',exact:true}).waitFor();
 await page.evaluate(()=>{document.documentElement.dataset.localMotion='auto';window.dispatchEvent(new Event('local-motion-change'));});await frames();
 assert.notEqual(await tree().locator('[data-file-path="nested"] .source-tree-caret').evaluate(n=>getComputedStyle(n).transitionDuration),'0s','transition returns when the local motion setting is off');
 report.checks.push('html[data-local-motion=reduce] makes the caret transition 0s (collapse snaps to none, expand to rotate(90deg)); restoring the setting restores the transition');
 step('keyboard');await pane().getByRole('textbox',{name:'Filter files',exact:true}).focus();await page.keyboard.press('Tab');await page.waitForFunction(()=>document.activeElement?.getAttribute('role')==='treeitem');
 await page.keyboard.press('Home');const firstRow=await page.evaluate(()=>document.activeElement.querySelector('[data-tree-primary]').getAttribute('aria-label'));
 const order=[];for(let i=0;i<4;i++){order.push(await page.evaluate(()=>document.activeElement.querySelector('[data-tree-primary]').getAttribute('aria-label')));await page.keyboard.press('ArrowDown');}
 assert.equal(order[0],firstRow);assert.equal(new Set(order).size,4,'ArrowDown walks distinct rows');
 await page.keyboard.press('Home');for(let i=0;i<order.indexOf('nested');i++)await page.keyboard.press('ArrowDown');
 assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-expanded')),'true');await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-expanded')==='false');
 await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-expanded')==='true');await tree().getByRole('button',{name:'deep.txt',exact:true}).waitFor();
 report.metrics.keyboardOrder=order;report.checks.push('Tree keyboard is unchanged: Tab lands on a treeitem, Home/ArrowDown walk rows, ArrowLeft collapses and ArrowRight expands the focused directory');
 step('search-results');const filter=pane().getByRole('textbox',{name:'Filter files',exact:true});await filter.fill('e');await pane().locator('.sfs-browser[data-search-phase="success"]').waitFor();await pane().locator('.sfs-result-row').first().waitFor();
 const results=await pane().locator('.sfs-results').evaluate(list=>{const probe=document.createElement('span');list.append(probe);probe.style.color='var(--cds-text-muted)';const muted=getComputedStyle(probe).color;probe.remove();
  return {muted,rows:[...list.querySelectorAll('.sfs-result-row')].map(row=>{const icons=[...row.querySelectorAll('[data-cds="Icon"]')];return {path:row.querySelector('[data-tree-primary]').getAttribute('aria-label'),icons:icons.length,glyph:icons[0]?.textContent,fontSize:getComputedStyle(icons[0]).fontSize,color:getComputedStyle(icons[0]).color};})};});
 report.metrics.search=results;assert.ok(results.rows.length>=5,'search lists several files');
 for(const row of results.rows){assert.equal(row.icons,1,row.path);assert.equal(row.fontSize,'12px',row.path);assert.equal(row.color,results.muted,row.path);assert.equal(row.glyph,glyph(fileKindIcon(path.posix.basename(row.path))),row.path+' search glyph');}
 assert.ok(new Set(results.rows.map(r=>r.glyph)).size>=3,'search results show several file kinds');await shot('search-light');
 await filter.fill('');await pane().locator('.sfs-results[hidden]').waitFor({state:'attached'});
 report.checks.push('Filename search results use the same shared-14 cP glyph per file at 12px in --cds-text-muted');
 step('file-tabs');
 // 0.2.128: c_ "Search files" (panes-tile-current.js:6791-6807, trailing slot :16366-16378) adds a 24px ghost control + 2px gap
 // to the header, so the four-tab strip below loses 26px at 1280 (r1: README.md clipped). The 2:3 chat:pane split gives the
 // pane 3/5 of a wider window: 1328px (+48 -> ~+29px) restores the strip width these unchanged tab assertions were written for.
 await size(1328,820);
 // Opens from the tree (double-click keeps, single click previews), re-showing the tree if a file view hid it.
 const tabRoot=name=>pane().locator(`.source-file-tab[data-file-path=${JSON.stringify(name)}]`),tabsNow=()=>pane().locator('.source-file-tab').evaluateAll(nodes=>nodes.map(n=>({path:n.dataset.filePath,preview:n.dataset.preview==='true',selected:n.hasAttribute('data-selected')})));
 async function openTab(name,keep){if(!(await tree().isVisible()))await pane().getByRole('button',{name:'Show file tree',exact:true}).click();const row=tree().getByRole('button',{name,exact:true});await row.waitFor();
  // Fidelity F11 opens the tab synchronously (panes-state-current.js F; vi drops the tree peek), so while the tree is not
  // shown beside the file the first click already swaps the tree for the viewer and a row double-click cannot land.
  // Keep the preview through its tab instead (the tab's double-click keeps it, as the row's does).
  await row.click();await page.waitForFunction(n=>document.querySelector(`.source-file-tab[data-file-path$="${n}"][data-preview]`),name);
  if(keep){await pane().locator(`.source-file-tab[data-file-path$=${JSON.stringify(name)}]`).dblclick();await page.waitForFunction(n=>document.querySelector(`.source-file-tab[data-file-path$="${n}"]:not([data-preview])`),name);}await frames();}
 const longName='quarterly-infrastructure-migration-checklist.txt';
 await openTab('notes.txt',true);await openTab(longName,true);await openTab('deep.txt',true);await openTab('README.md',false);
 const deepPath=(await tabsNow()).find(t=>t.path.endsWith('deep.txt')).path;assert.equal(path.posix.basename(deepPath),'deep.txt');
 assert.deepEqual((await tabsNow()).map(t=>[path.posix.basename(t.path),t.preview,t.selected]),[['notes.txt',false,false],[longName,false,false],['deep.txt',false,false],['README.md',true,true]]);
 await page.mouse.move(2,2);await frames();
 const tabInfo=await pane().locator('.source-file-tabs').evaluate(list=>{const probe=document.createElement('span');list.append(probe);const color=v=>{probe.style.color=`var(${v})`;return getComputedStyle(probe).color;},bg=v=>{probe.style.backgroundColor=`var(${v})`;return getComputedStyle(probe).backgroundColor;};
  const tokens={muted:color('--cds-text-muted'),primary:color('--cds-text-primary'),secondary:color('--cds-text-secondary'),selectedBg:bg('--cds-fill-ghost-selected'),hoverBg:bg('--cds-fill-ghost-hover'),radius:(probe.style.borderRadius='var(--cds-radius)',getComputedStyle(probe).borderRadius)};probe.remove();
  return {tokens,tabs:[...list.querySelectorAll('.source-file-tab')].map(root=>{const tab=root.querySelector(':scope > [role="tab"]'),label=root.querySelector('.source-file-tab-label'),inner=label.firstElementChild,close=root.querySelector(':scope > button'),bgLayer=root.querySelector(':scope > .source-file-tab-bg'),rs=getComputedStyle(root),ts=getComputedStyle(tab),ls=getComputedStyle(label);
   return {path:root.dataset.filePath,role:root.getAttribute('role'),tabIcons:tab.querySelectorAll('[data-cds="Icon"]').length,rootIcons:root.querySelectorAll('[data-cds="Icon"]').length,closeIcons:close?.querySelectorAll('[data-cds="Icon"]').length,
    titled:root.querySelectorAll('[title]').length+(root.hasAttribute('title')?1:0),height:root.getBoundingClientRect().height,basis:rs.flexBasis,padding:rs.padding,gap:rs.gap,radius:rs.borderRadius,color:rs.color,justify:rs.justifyContent,
    tabPadLeft:ts.paddingLeft,tabMin:ts.minWidth,tabGap:ts.gap,labelMax:ls.maxWidth,clipped:label.hasAttribute('data-clipped'),mask:ls.maskImage||ls.webkitMaskImage,fontStyle:getComputedStyle(inner).fontStyle,whiteSpace:getComputedStyle(inner).whiteSpace,
    srPreview:[...inner.querySelectorAll('.source-sr-only')].map(n=>n.textContent),name:tab.textContent,bg:getComputedStyle(bgLayer).backgroundColor,bgZ:getComputedStyle(bgLayer).zIndex,bgHidden:bgLayer.getAttribute('aria-hidden'),
    closeTag:close?.tagName,closeType:close?.getAttribute('type'),closeHidden:close?.getAttribute('aria-hidden'),closeTabIndex:close?.tabIndex,closeLabel:close?.getAttribute('aria-label'),closeColor:close&&getComputedStyle(close).color,closeSize:close&&[close.getBoundingClientRect().width,close.getBoundingClientRect().height],closeOpacity:close&&getComputedStyle(close).opacity,closeIconSize:close&&getComputedStyle(close.querySelector('[data-cds="Icon"]')).fontSize};})};});
 report.metrics.fileTabs=tabInfo;const {tokens}=tabInfo;
 for(const t of tabInfo.tabs){const where='tab '+t.path,selected=t.path.endsWith('README.md');
  assert.equal(t.role,'presentation',where);assert.equal(t.tabIcons,0,where+': no icon before the label (ce has no icon)');assert.equal(t.rootIcons,1,where+': only the close X glyph');assert.equal(t.closeIcons,1,where);assert.equal(t.titled,0,where+': no native title');
  assert.ok(Math.abs(t.height-24)<=.5,where+': 24px tab');assert.equal(t.basis,'192px',where);assert.equal(t.padding,'2px',where);assert.equal(t.gap,'4px',where);assert.equal(t.radius,tokens.radius,where+': rounded = --cds-radius (design-system.css:14250)');
  assert.equal(t.tabPadLeft,'6px',where);assert.equal(t.tabMin,'6px',where);assert.equal(t.tabGap,'2px',where);assert.equal(t.labelMax,'140px',where+': label max-w-[140px]');assert.equal(t.whiteSpace,'nowrap',where);
  assert.equal(t.color,selected?tokens.primary:tokens.secondary,where+': text colour');assert.equal(t.justify,selected?'flex-end':'flex-start',where);assert.equal(t.bg,selected?tokens.selectedBg:'rgba(0, 0, 0, 0)',where+': background layer');assert.equal(t.bgZ,'-1',where);assert.equal(t.bgHidden,'true',where);
  assert.equal(t.closeTag,'BUTTON',where);assert.equal(t.closeType,'button',where);assert.equal(t.closeHidden,'true',where+': close button aria-hidden');assert.equal(t.closeTabIndex,-1,where+': close button tabIndex -1');
  assert.equal(t.closeLabel,'Close file',where+': pe label = le.closeTab (panes-tile-current.js:6671)');assert.equal(t.closeColor,selected?tokens.primary:tokens.muted,where+': close colour');assert.deepEqual(t.closeSize,[20,20],where+': 1.25rem close');assert.equal(t.closeOpacity,'1',where+': always visible');assert.equal(t.closeIconSize,'12px',where+': X size xs');}
 const [notesTab,longTab,deepTab,readmeTab]=tabInfo.tabs;
 assert.equal(readmeTab.fontStyle,'italic','preview label is italic');assert.deepEqual(readmeTab.srPreview,[', preview']);assert.equal(readmeTab.name,'README.md, preview');
 for(const t of [notesTab,longTab,deepTab]){assert.equal(t.fontStyle,'normal',t.path);assert.deepEqual(t.srPreview,[],t.path);}
 assert.equal(longTab.clipped,true,'long label is clipped at 140px');assert.match(longTab.mask,/^linear-gradient\((to right|90deg), (rgb\(0, 0, 0\)|#000) calc\(100% - 8px\), (transparent|rgba\(0, 0, 0, 0\)) 100%\)$/,'fe mask on a clipped closable label');
 for(const t of [notesTab,deepTab,readmeTab]){assert.equal(t.clipped,false,t.path);assert.equal(t.mask,'none',t.path);}
 await shot('file-tabs-light');
 report.checks.push('File tabs (he over ce): role=presentation root, no icon, no native title, 24px tall, basis 192px, 2px padding, 4px gap, --cds-radius, 6px tab padding, 140px nowrap label (fe mask only on the clipped one), selected text-primary/justify-end/--cds-fill-ghost-selected; preview label italic with sr-only ", preview"; pe close button <button type=button aria-hidden tabIndex=-1 aria-label="Close file"> 20px, X 12px, always visible, --cds-text-muted (text-primary on the selected tab)');
 // has-[:focus-visible]:shadow-focus (panes-tabs-current.js:357-375) must not be clipped: the Xd tablist z is -mx-[4px] ... overflow-x-hidden p-[4px]
 // (:1138-1141), so every scroll/clip ancestor leaves >=4px around a keyboard-focused tab (the 1px accent ring + part of the 6px glow, design-system.css:52987).
 const ringProbe=()=>page.evaluate(()=>{const tab=document.activeElement,root=tab?.closest('.source-file-tab'),list=root?.closest('.source-file-tabs');if(!root)return null;
  const r=root.getBoundingClientRect(),clip={left:-Infinity,top:-Infinity,right:Infinity,bottom:Infinity};
  for(let n=root.parentElement;n&&n!==document.documentElement;n=n.parentElement){const cs=getComputedStyle(n);if(cs.overflowX==='visible'&&cs.overflowY==='visible')continue;const b=n.getBoundingClientRect(),left=b.left+n.clientLeft,top=b.top+n.clientTop;
   clip.left=Math.max(clip.left,left);clip.top=Math.max(clip.top,top);clip.right=Math.min(clip.right,left+n.clientWidth);clip.bottom=Math.min(clip.bottom,top+n.clientHeight);}
  const ls=getComputedStyle(list),header=list.closest('.source-pane-header').getBoundingClientRect(),lr=list.getBoundingClientRect();
  return {path:root.dataset.filePath,focusVisible:tab.matches(':focus-visible'),shadow:getComputedStyle(root).boxShadow,room:{left:r.left-clip.left,top:r.top-clip.top,right:clip.right-r.right,bottom:clip.bottom-r.bottom},
   listPadding:ls.padding,listMargin:[ls.marginLeft,ls.marginRight],listHeight:lr.height,inHeader:lr.top>=header.top-.5&&lr.bottom<=header.bottom+.5,overflowing:list.scrollWidth>list.clientWidth};});
 await tabRoot('README.md').locator('[role="tab"]').focus();await page.keyboard.press('Home');await page.waitForFunction(()=>document.activeElement?.closest('.source-file-tab')?.dataset.filePath==='notes.txt');await frames();
 const firstRing=await ringProbe();await page.keyboard.press('End');await page.waitForFunction(()=>document.activeElement?.closest('.source-file-tab')?.dataset.filePath==='README.md');await frames();
 const lastRing=await ringProbe();report.metrics.tabFocusRing={first:firstRing,last:lastRing};
 for(const ring of [firstRing,lastRing]){const where='focused tab '+ring.path;assert.equal(ring.focusVisible,true,where+': keyboard focus is :focus-visible');assert.notEqual(ring.shadow,'none',where+': shadow-focus applied');
  assert.equal(ring.listPadding,'4px',where+': tablist p-[4px]');assert.deepEqual(ring.listMargin,['-4px','-4px'],where+': tablist -mx-[4px]');assert.ok(Math.abs(ring.listHeight-32)<=.5,where+': 24px tab + 2*4px');assert.equal(ring.inHeader,true,where+': tablist fits the 32px header');
  for(const side of ['top','bottom'])assert.ok(ring.room[side]>=4-.5,`${where}: ${side} ring room ${ring.room[side]}px`);}
 assert.ok(firstRing.room.left>=4-.5,`first tab left ring room ${firstRing.room.left}px`);assert.equal(lastRing.overflowing,false,'four tabs fit the tablist');assert.ok(lastRing.room.right>=4-.5,`last tab right ring room ${lastRing.room.right}px`);
 assert.deepEqual(await tabsNow().then(t=>t.map(x=>[path.posix.basename(x.path),x.preview,x.selected])),[['notes.txt',false,false],[longName,false,false],['deep.txt',false,false],['README.md',true,true]],'Home/End roving restores README selection');
 // Z (:309-314) on he onMouseUp (:359): a middle-button mouseup on a closable tab is default-prevented (as mousedown/auxclick are).
 assert.equal(await tabRoot('README.md').evaluate(n=>!n.dispatchEvent(new MouseEvent('mouseup',{button:1,bubbles:true,cancelable:true}))),true,'middle mouseup default-prevented');
 await page.evaluate(()=>document.activeElement?.blur());await page.mouse.move(2,2);await frames();
 report.checks.push('Keyboard-focused tab ring is not clipped: the tablist has the Xd p-[4px] / -mx-[4px] (32px tall inside the 32px header) and every clip ancestor leaves >=4px top/bottom around the focused tab, left of the first and right of the last; middle-button mouseup is default-prevented (Z)');
 // te tooltip (panes-tabs-current.js:382-392): delay 700, bottom/start, label + detail (relative dir); none for a short root-level file.
 const hoverTiming=async(name)=>{await page.mouse.move(2,2);await page.waitForFunction(()=>!document.querySelector('.source-tooltip-popup'));await page.waitForTimeout(700);
  await page.evaluate(()=>{window.__tabTip={};const mo=new MutationObserver(()=>{if(!window.__tabTip.at&&document.querySelector('.source-tooltip-popup'))window.__tabTip.at=performance.now();});mo.observe(document.body,{childList:true,subtree:true});window.__tabTip.mo=mo;});
  const box=await tabRoot(name).locator('[role="tab"]').boundingBox();await page.evaluate(()=>{window.__tabTip.start=performance.now();});await page.mouse.move(box.x+box.width/2,box.y+box.height/2);const t0=Date.now();return {t0,box};};
 let hover=await hoverTiming(deepPath);await page.waitForTimeout(Math.max(0,500-(Date.now()-hover.t0)));
 assert.equal(await page.locator('.source-tooltip-popup').count(),0,'no tooltip at 500ms');
 await page.locator('.source-tooltip-popup').waitFor({timeout:Math.max(1,900-(Date.now()-hover.t0))});
 const tip=await page.evaluate(()=>{const popup=document.querySelector('.source-tooltip-popup'),r=popup.getBoundingClientRect();window.__tabTip.mo.disconnect();
  return {elapsed:window.__tabTip.at-window.__tabTip.start,side:popup.closest('[data-side]')?.dataset.side,label:popup.querySelector('.source-tooltip-label')?.textContent,detail:popup.querySelector('.source-tooltip-detail')?.textContent,lines:popup.querySelectorAll('.source-tooltip-label-line').length,left:r.left,top:r.top,titled:document.querySelectorAll('.source-file-tabs [title]').length};});
 report.metrics.deepTooltip={...tip,tab:hover.box};
 assert.ok(tip.elapsed>=500&&tip.elapsed<=900,`tooltip opened after ${tip.elapsed}ms (700ms delay)`);assert.equal(tip.side,'bottom');assert.ok(tip.top>=hover.box.y+hover.box.height-.5,'tooltip below the tab');assert.ok(Math.abs(tip.left-hover.box.x)<=1,`tooltip start-aligned (${tip.left} vs ${hover.box.x})`);
 assert.equal(tip.label,'deep.txt','tooltip content = basename');assert.equal(tip.detail,'nested','tooltip detail = relative dir (ce detail)');assert.equal(tip.lines,1);assert.equal(tip.titled,0);
 await shot('file-tab-tooltip');
 hover=await hoverTiming('notes.txt');await page.waitForTimeout(1000);assert.equal(await page.locator('.source-tooltip-popup').count(),0,'short root-level file: no tooltip');
 hover=await hoverTiming(longTab.path);await page.locator('.source-tooltip-popup').waitFor({timeout:1200});
 assert.deepEqual(await page.evaluate(()=>{const p=document.querySelector('.source-tooltip-popup');return [p.querySelector('.source-tooltip-label')?.textContent,p.querySelector('.source-tooltip-detail')];}),[longName,null],'clipped root-level label: label only, no detail');
 await page.mouse.move(2,2);await page.waitForFunction(()=>!document.querySelector('.source-tooltip-popup'));
 report.checks.push('Tab tooltip (te): nothing at 500ms, shown by 900ms (measured '+Math.round(tip.elapsed)+'ms), below the tab start-aligned, "deep.txt" + detail "nested"; a short root-level file has none; a clipped root-level label shows the label without detail; no native title');
 // he context menu (panes-tabs-current.js:470-485), anchored bottom/start to the tab root.
 // F11: the tab menu now leads with the l_ file items (panes-tile-current.js:6809-6862: Mn Attach as context, Copy, Show in
 // Finder, then Reveal in file tree) and a separator (he renderTabMenuItems); labels are read from .smenu-label.
 // kn's 'Open in' submenu lists the editors installed on this Mac (main.cjs installed-editors); absent when there are none.
 const OPEN_IN=(await page.evaluate(()=>window.desktop.call('installed-editors'))).length?['Open in']:[];
 const FILE_ITEMS=['Attach as context','Copy',...OPEN_IN,'Show in Finder','Reveal in file tree'];
 const menuItems=()=>page.locator('[data-cds="ContextMenu"] [role="menuitem"]').evaluateAll(nodes=>nodes.map(n=>(n.querySelector('.smenu-label')?.textContent??n.textContent).trim()));
 const openMenu=async name=>{await tabRoot(name).locator('[role="tab"]').click({button:'right'});await page.locator('[data-cds="ContextMenu"][data-open]').waitFor();await frames();};
 await openMenu('README.md');assert.deepEqual(await menuItems(),[...FILE_ITEMS,'Keep open','Close file','Close other files','Close all files'],'preview tab menu order');
 const menuGeo=await page.evaluate(()=>{const popup=document.querySelector('[data-cds="ContextMenu"][data-open]'),root=document.querySelector('.source-file-tab[data-popup-open]');return {side:popup.dataset.side,align:popup.dataset.align,popup:popup.getBoundingClientRect().toJSON(),root:root?.getBoundingClientRect().toJSON(),rootPath:root?.dataset.filePath};});
 report.metrics.tabMenu=menuGeo;assert.equal(menuGeo.rootPath,'README.md');assert.equal(menuGeo.side,'bottom');assert.equal(menuGeo.align,'start');assert.ok(menuGeo.popup.top>=menuGeo.root.bottom-.5,'menu below the tab root');assert.ok(Math.abs(menuGeo.popup.left-menuGeo.root.left)<=1,'menu start-aligned to the tab root');
 await shot('file-tab-menu');await page.keyboard.press('Escape');await page.locator('[data-cds="ContextMenu"]').waitFor({state:'detached'});
 await openMenu(deepPath);assert.deepEqual(await menuItems(),[...FILE_ITEMS,'Close file','Close other files','Close all files'],'pinned tab menu has no Keep open');
 assert.deepEqual(await itemsOf(page.locator('[data-cds="ContextMenu"][data-open]')),['Attach as context','Copy','|',...OPEN_IN,'Show in Finder','|','Reveal in file tree','|','Close file','Close other files','Close all files'],'file items, then a separator before the tab items');
 assert.equal(await tabRoot(deepPath).evaluate(n=>getComputedStyle(n.querySelector('.source-file-tab-bg')).backgroundColor),tokens.hoverBg,'data-popup-open tab uses --cds-fill-ghost-hover');
 await page.waitForTimeout(900);assert.equal(await page.locator('.source-tooltip-popup').count(),0,'tooltip suppressed while the tab menu is open');
 await page.keyboard.press('Escape');await page.locator('[data-cds="ContextMenu"]').waitFor({state:'detached'});
 await openMenu('README.md');await page.getByRole('menuitem',{name:'Close other files',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.source-file-tab').length===1);
 assert.deepEqual(await tabsNow(),[{path:'README.md',preview:true,selected:true}],'Close other files leaves only that tab');
 await openMenu('README.md');assert.deepEqual(await menuItems(),[...FILE_ITEMS,'Keep open','Close file'],'solo preview tab: Keep open + Close file');
 await page.getByRole('menuitem',{name:'Keep open',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.source-file-tab[data-preview]'));
 assert.equal(await tabRoot('README.md').locator('.source-file-tab-label > span').evaluate(n=>getComputedStyle(n).fontStyle),'normal','kept tab is no longer italic');
 await openMenu('README.md');assert.deepEqual(await menuItems(),[...FILE_ITEMS,'Close file'],'solo pinned tab: Close file only');await page.keyboard.press('Escape');await page.locator('[data-cds="ContextMenu"]').waitFor({state:'detached'});
 await tabRoot('README.md').locator('.source-file-tab-close').click();await page.waitForFunction(()=>!document.querySelector('.source-file-tab'));
 report.checks.push('Tab context menu (he): the l_ file items (Attach as context, Copy, separator, Show in Finder, separator, Reveal in file tree) and a separator, then the preview tab lists Keep open / Close file / Close other files / Close all files, pinned tab omits Keep open, solo tabs omit the close-other/all items; popup below-start of the tab root with data-popup-open fill-ghost-hover and no tooltip; Close other files leaves only that tab; Keep open drops italics; the aria-hidden close button still closes by pointer');
 step('viewer-menus');
 // F11 (cd2efac6e jo/Yo/Ma, Mn file_browser, toggleDiffFileList, _e/K): the breadcrumb subheader and numbered rows, the
 // tree-row ContextMenu Copy ▸ Relative path, ⌘⇧Y with its CDS tooltip, and "More files" once the tabs overflow.
 await saveClipboard();
 await openTab('deep.txt',true);await pane().locator('[data-file-viewer] .sfv-line').first().waitFor();
 const viewer=await pane().evaluate(n=>{const b=n.querySelector('.sfv-path'),rows=[...n.querySelectorAll('[data-file-viewer] .sfv-line')],probe=document.createElement('span');n.append(probe);probe.style.color='var(--cds-text-muted)';const muted=getComputedStyle(probe).color;probe.style.color='var(--cds-text-secondary)';const secondary=getComputedStyle(probe).color;probe.remove();
  const sub=n.querySelector('.sfv-subheader').getBoundingClientRect();
  return {label:b.getAttribute('aria-label'),lister:b.hasAttribute('data-breadcrumb-lister'),tag:b.tagName,segments:[...b.querySelectorAll('[data-breadcrumb-segment]')].map(s=>s.textContent),title:b.getAttribute('title'),crumb:n.querySelector('.sfv-breadcrumb').textContent,dirColor:getComputedStyle(n.querySelector('.sfv-crumb-dir')).color,muted,secondary,buttonColor:getComputedStyle(b).color,subHeight:sub.height,
   rows:rows.map(r=>[r.dataset.line,r.querySelector('.sfv-number').dataset.number,r.querySelector('code').textContent]),gutterColor:getComputedStyle(rows[0].querySelector('.sfv-number')).color,whiteSpace:getComputedStyle(rows[0].querySelector('code')).whiteSpace,
   back:!!n.querySelector('[aria-label="Back to files"], .source-file-location')};});
 report.metrics.viewer=viewer;
 // Yo with a lister (local sessions, cd2efac6e :4804-4872): a plain div, no Copy path button; each in-workspace segment opens "Files in {folder}".
 assert.equal(viewer.label,null);assert.equal(viewer.lister,true);assert.equal(viewer.tag,'DIV');assert.deepEqual(viewer.segments,['nested','deep.txt']);assert.ok(viewer.title.endsWith('/nested/deep.txt'),viewer.title);assert.equal(viewer.crumb,'nested/deep.txt');
 assert.equal(viewer.dirColor,viewer.muted,'folder segment text-muted');assert.equal(viewer.buttonColor,viewer.secondary,'breadcrumb button text-secondary');assert.ok(Math.abs(viewer.subHeight-32)<=.5,'2rem subheader');
 assert.deepEqual(viewer.rows,[['1','1','NESTED_DEEP_FILE\n']]);assert.equal(viewer.gutterColor,viewer.muted,'muted gutter');assert.equal(viewer.whiteSpace,'pre-wrap');assert.equal(viewer.back,false,'no Back to files / location row');
 const folderSegment=pane().locator('.sfv-path [data-breadcrumb-segment]',{hasText:'nested'}).first();await folderSegment.click();
 const folderPopover=page.getByRole('tree',{name:'Files in nested',exact:true});await folderPopover.waitFor();
 assert.equal(await folderSegment.getAttribute('aria-expanded'),'true');
 assert.deepEqual(await folderPopover.locator('[data-folder-row]').evaluateAll(rows=>rows.map(r=>[r.querySelector('.sfv-folder-name').textContent,r.hasAttribute('data-selected')])),[['inner',false],['deep.txt',true]],'folders first, the open file is the selected row');
 await shot('breadcrumb-folder-popover');await page.keyboard.press('Escape');await folderPopover.waitFor({state:'detached'});/* Escape closes only the popover (source-session.jsx: a portaled layer's Escape never closes the pane) */assert.equal(await pane().count(),1,'the Files pane stays open');
 if(!(await tree().isVisible()))await pane().getByRole('button',{name:'Show file tree',exact:true}).click();
 await tree().getByRole('button',{name:'notes.txt',exact:true}).click({button:'right'});const rowMenu=page.locator('[data-cds="ContextMenu"][data-open]');await rowMenu.waitFor();await frames();
 assert.deepEqual(await itemsOf(rowMenu),['Attach as context','Copy','|',...OPEN_IN,'Show in Finder'],'file_browser items (Mn)');
 await rowMenu.getByRole('menuitem',{name:'Copy',exact:true}).hover();const copyMenu=page.getByRole('menu',{name:'Copy',exact:true});await copyMenu.waitFor();await frames();
 assert.deepEqual(await itemsOf(copyMenu),['Absolute path','Relative path','Filename']);await shot('tree-row-copy-menu');
 await copyMenu.getByRole('menuitem',{name:'Relative path',exact:true}).click();await page.locator('[data-cds="ContextMenu"]').waitFor({state:'detached'});
 await poll(async()=>(await toasts()).includes('Copied to clipboard.'),'copy toast');assert.equal(await app.evaluate(({clipboard})=>clipboard.readText()),'notes.txt');
 await restoreClipboard();
 report.checks.push('Viewer: local-session lister breadcrumb (muted folder segment, text-secondary path, 32px subheader); the nested segment opens "Files in nested" with deep.txt selected, Escape closes it; one numbered pre-wrap row with a muted gutter; no Back to files. Tree row ContextMenu: Attach as context, Copy, separator, Show in Finder; Copy ▸ Relative path writes "notes.txt" with "Copied to clipboard."');
 // ⌘⇧Y toggles the tree beside the open file; the ListBullet tooltip shows the keycap and the button has no native title.
 const treeState=()=>pane().evaluate(n=>n.querySelector('.source-file-body').dataset.treeVisible);
 const toggle=pane().locator('.source-pane-header > button[aria-pressed]');
 assert.deepEqual(await toggle.evaluate(b=>({title:b.getAttribute('title'),keys:b.getAttribute('aria-keyshortcuts')})),{title:null,keys:'Meta+Shift+Y'});
 await page.mouse.move(2,2);await toggle.hover();const treeTip=page.locator('.source-tooltip-popup').filter({hasText:/file tree/});await treeTip.waitFor();
 const tipInfo=await treeTip.evaluate(p=>({label:p.querySelector('.source-tooltip-label')?.textContent??p.textContent,keys:[...p.querySelectorAll('kbd')].map(k=>(k.querySelector('[aria-hidden="true"]')??k).textContent).join('')}));
 report.metrics.treeToggleTooltip=tipInfo;assert.match(tipInfo.label,/^(Show|Hide) file tree/);assert.ok(/⇧/.test(tipInfo.keys)&&/⌘/.test(tipInfo.keys)&&/Y/.test(tipInfo.keys),'⌘⇧Y keycaps: '+tipInfo.keys);
 await page.mouse.move(2,2);await page.evaluate(()=>document.activeElement?.blur());
 const before=await treeState();await page.keyboard.press('Meta+Shift+Y');await poll(async()=>await treeState()!==before,'⌘⇧Y toggles the tree');
 await page.keyboard.press('Meta+Shift+Y');await poll(async()=>await treeState()===before,'⌘⇧Y toggles it back');
 report.checks.push('⌘⇧Y toggles the Files tree ('+before+' → '+(before==='true'?'false':'true')+' → '+before+'); the ListBullet has aria-keyshortcuts Meta+Shift+Y, no title, and a CDS tooltip "'+tipInfo.label+'" with '+tipInfo.keys);
 // Eight pinned tabs overflow the strip: hidden tabs move into "More files" (side bottom, align end) and the active tab stays in view.
 for(const name of ['README.md','index.html','app.tsx','data.csv','notes.txt','Makefile','config.json','bundle.zip'])await openTab(name,true);
 await page.waitForFunction(()=>document.querySelector('.source-side-tile[data-tile-id="files"] [data-vtb-overflow]'));await frames();
 const strip=await pane().evaluate(n=>{const list=n.querySelector('.source-file-tabs'),tabs=[...list.querySelectorAll('.source-file-tab')],lr=list.getBoundingClientRect(),active=list.querySelector('.source-file-tab[data-selected]'),ar=active.getBoundingClientRect();
  return {count:tabs.length,hidden:tabs.filter(t=>t.hasAttribute('data-overflowed')).map(t=>t.dataset.filePath),active:active.dataset.filePath,activeVisible:ar.left>=lr.left-.5&&ar.right<=lr.right+.5&&getComputedStyle(active).visibility==='visible',
   trigger:n.querySelector('[data-vtb-overflow] button')?.getAttribute('aria-label'),stripWidth:list.clientWidth,paneWidth:n.clientWidth};});
 report.metrics.tabOverflow=strip;assert.equal(strip.count,8,'eight tabs (the cap)');assert.ok(strip.hidden.length>0,'some tabs are hidden');assert.equal(strip.trigger,'More files');
 assert.equal(strip.active,'bundle.zip');assert.equal(strip.activeVisible,true,'the active tab is in view');assert.ok(!strip.hidden.includes(strip.active));
 await pane().getByRole('button',{name:'More files',exact:true}).click();const more=page.getByRole('menu',{name:'More files',exact:true});await more.waitFor();await frames();
 const moreInfo=await more.evaluate(m=>({rows:[...m.querySelectorAll('[role="menuitem"]')].map(n=>n.dataset.filePath),side:m.dataset.side,align:m.dataset.align,hint:m.querySelector('.source-sr-only')?.textContent}));
 report.metrics.moreFiles=moreInfo;assert.deepEqual(moreInfo.rows,strip.hidden,'the menu lists exactly the hidden tabs');assert.equal(moreInfo.side,'bottom');assert.equal(moreInfo.align,'end');assert.equal(moreInfo.hint,'press right arrow to close');
 await shot('file-tabs-more-files');
 const target=strip.hidden[0];await more.locator(`[role="menuitem"][data-file-path=${JSON.stringify(target)}]`).click();await more.waitFor({state:'detached'});
 await page.waitForFunction(p=>{const t=[...document.querySelectorAll('.source-side-tile[data-tile-id="files"] .source-file-tab')].find(n=>n.dataset.filePath===p);return t&&t.hasAttribute('data-selected')&&!t.hasAttribute('data-overflowed');},target);
 report.checks.push('Eight pinned tabs in a '+strip.stripWidth+'px strip: '+strip.hidden.length+' hidden behind the ghost CaretDown "More files" menu (bottom/end, rows = the hidden tabs, "press right arrow to close"); choosing '+target+' activates it in view');
 await openMenu(target);await page.getByRole('menuitem',{name:'Close all files',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.source-side-tile[data-tile-id="files"] .source-file-tab'));
 assert.deepEqual(report.rendererErrors,[]);
 step('search-files');
 // c_ (panes-tile-current.js:6791-6807): ghost iconOnly "Search files" first in the file pane's trailing slot (:16366-16378), before the
 // yh settings menu; onClick focusFilesTreeFilter (panes-state-current.js:3097-3113) shows the tree (beside the file when it fits), then
 // focuses "Filter files" and selects its text. The CDS tooltip is the aria-label (shared-frame ks oe/se); no native title.
 const searchButton=pane().getByRole('button',{name:'Search files',exact:true}),filterBox=pane().getByRole('textbox',{name:'Filter files',exact:true});
 const trailing=await pane().locator('.source-pane-header .spc-controls').evaluate(n=>[...n.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')));
 report.metrics.searchFilesTrailing=trailing;assert.deepEqual(trailing.slice(0,2),['Search files','Files settings'],'Search files precedes the Files settings menu');
 assert.equal(trailing.at(-1),'Close panel');assert.ok(trailing.indexOf('Expand')>1||trailing.indexOf('Collapse')>1,'Expand/Collapse after the settings menu');
 assert.deepEqual(await searchButton.evaluate(b=>({title:b.getAttribute('title'),ghost:b.classList.contains('spc-ghost'),icons:b.querySelectorAll('[data-cds="Icon"]').length,text:b.textContent.length})),{title:null,ghost:true,icons:1,text:1});
 await searchButton.hover();await page.locator('.source-tooltip-popup').filter({hasText:'Search files'}).waitFor();await page.mouse.move(2,2);await page.waitForFunction(()=>!document.querySelector('.source-tooltip-popup'));
 const paneState=()=>pane().evaluate(n=>{const body=n.querySelector('.source-file-body'),tree=n.querySelector('.source-files-tree');return {treeVisible:body.dataset.treeVisible,column:body.dataset.treeColumn,treeShown:!!tree&&!tree.hidden&&tree.getClientRects().length>0,
  preview:n.querySelector('.sfv-breadcrumb')?.textContent??null,selected:n.querySelector('.source-file-tab[data-selected]')?.dataset.filePath??null,tabs:[...n.querySelectorAll('.source-file-tab')].map(t=>t.dataset.filePath),paneWidth:n.querySelector('.source-file-panel').clientWidth};});
 const focusedFilter=()=>page.evaluate(()=>{const n=document.activeElement;return n?.getAttribute('aria-label')==='Filter files'?{value:n.value,start:n.selectionStart,end:n.selectionEnd}:null;});
 // Tree shown: the button only focuses and selects.
 await filterBox.fill('notes');await pane().locator('.sfs-browser[data-search-phase="success"]').waitFor();await page.evaluate(()=>document.activeElement?.blur());
 const shownBefore=await paneState();assert.equal(shownBefore.treeShown,true);
 await searchButton.click();await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Filter files');
 assert.deepEqual(await focusedFilter(),{value:'notes',start:0,end:5},'Filter files focused with its text selected');assert.deepEqual(await paneState(),shownBefore,'tree already shown: only focus changes');
 await filterBox.fill('');await pane().locator('.sfs-results[hidden]').waitFor({state:'attached'});
 // Tree hidden with a file open (the pane fits a tree beside it): the tree comes back beside the same file.
 await openTab('notes.txt',true);await filterBox.fill('deep');await pane().locator('.sfs-browser[data-search-phase="success"]').waitFor();
 if(await pane().getByRole('button',{name:'Hide file tree',exact:true}).count())await pane().getByRole('button',{name:'Hide file tree',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.source-side-tile[data-tile-id="files"] .source-file-body')?.dataset.treeVisible==='false');
 const hiddenBefore=await paneState();report.metrics.searchFilesHidden=hiddenBefore;
 assert.ok(hiddenBefore.paneWidth>=400,`pane ${hiddenBefore.paneWidth}px fits the tree beside the file`);assert.equal(hiddenBefore.treeShown,false);assert.equal(path.posix.basename(hiddenBefore.preview??''),'notes.txt');
 await searchButton.click();await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Filter files');
 const hiddenAfter=await paneState();report.metrics.searchFilesShown=hiddenAfter;
 assert.deepEqual(await focusedFilter(),{value:'deep',start:0,end:4},'Filter files focused with its text selected');
 assert.deepEqual([hiddenAfter.treeVisible,hiddenAfter.column,hiddenAfter.treeShown],['true','true',true],'tree shown as a column beside the file');
 assert.deepEqual([hiddenAfter.preview,hiddenAfter.selected,hiddenAfter.tabs],[hiddenBefore.preview,hiddenBefore.selected,hiddenBefore.tabs],'the open file stays selected and previewed');
 await shot('search-files-beside');
 await filterBox.fill('');await pane().locator('.sfs-results[hidden]').waitFor({state:'attached'});
 await tabRoot(hiddenAfter.selected).locator('.source-file-tab-close').click();await page.waitForFunction(()=>!document.querySelector('.source-side-tile[data-tile-id="files"] .source-file-tab'));
 report.checks.push('Search files (c_): ghost icon-only button first in the Files trailing controls ['+trailing.join(', ')+'], CDS tooltip, no native title; with the tree shown it only focuses "Filter files" and selects its text; with the tree hidden and a file open it shows the tree beside that file (pane '+hiddenBefore.paneWidth+'px), keeps the file selected, then focuses and selects the filter');
 assert.deepEqual(report.rendererErrors,[]);
 step('previews');
 // R09 (cd2efac6e qo/en/pn, the Eye/Code toggle :4169-4186, nr :4481-4500; c41eb0199 r(); shared-frame cs :2697/:2724):
 // .mjs/.go highlight, README opens as its Markdown preview and toggles to numbered source and back, photo.png renders
 // from its file:// URL, and the pressed ListBullet is text-accent on bg-accent.
 if(!(await tree().isVisible()))await pane().getByRole('button',{name:'Show file tree',exact:true}).click();
 const pressedPaint=()=>pane().evaluate(n=>{const b=n.querySelector('.source-pane-header > button[aria-pressed="true"]'),probe=document.createElement('span');n.append(probe);
  probe.style.cssText='color:var(--cds-text-accent);background-color:var(--cds-bg-accent)';const accent={color:getComputedStyle(probe).color,background:getComputedStyle(probe).backgroundColor};probe.remove();
  return {label:b?.getAttribute('aria-label')??null,color:b?getComputedStyle(b).color:null,background:b?getComputedStyle(b).backgroundColor:null,accent};});
 await page.mouse.move(2,2);await frames();
 const pressedLight=await pressedPaint();report.metrics.pressedLight=pressedLight;
 assert.equal(pressedLight.label,'Hide file tree','the tree is shown, so the ListBullet is pressed');
 assert.equal(pressedLight.color,pressedLight.accent.color,'pressed ListBullet colour = --cds-text-accent');assert.equal(pressedLight.background,pressedLight.accent.background,'pressed ListBullet fill = --cds-bg-accent');
 const tokenInfo=async name=>{await openTab(name,true);await page.waitForFunction(n=>{const v=document.querySelector(`.source-side-tile[data-tile-id="files"] .source-file-view[data-file-path="${n}"]`);return !!v?.querySelector('.source-file-preview[data-highlighted] [data-code-token]');},name);
  return pane().evaluate((n,name)=>{const v=n.querySelector(`.source-file-view[data-file-path="${name}"]`),spans=[...v.querySelectorAll('[data-code-token]')];return {tokens:spans.length,colors:new Set(spans.map(s=>getComputedStyle(s).color)).size,first:v.querySelector('.sfv-line code').textContent};},name);};
 const mjs=await tokenInfo('util.mjs'),go=await tokenInfo('main.go');report.metrics.highlightedFiles={mjs,go};
 assert.ok(mjs.tokens>=3&&mjs.colors>=2,'util.mjs is highlighted as javascript: '+JSON.stringify(mjs));assert.equal(mjs.first,'export const answer = 42;\n');
 assert.ok(go.tokens>=3&&go.colors>=2,'main.go is highlighted as go: '+JSON.stringify(go));
 await openTab('README.md',true);const readme=pane().locator('.source-file-view[data-file-path="README.md"]'),viewToggle=readme.locator('.sfv-subheader [data-view-toggle]');
 await readme.locator('[data-file-preview="markdown"] .epitaxy-file-prose h1').filter({hasText:'readme'}).waitFor();
 const readmePreview=await readme.evaluate(v=>({view:v.dataset.fileView,label:v.querySelector('[data-view-toggle]').getAttribute('aria-label'),rows:v.querySelectorAll('.sfv-line').length,h1:getComputedStyle(v.querySelector('.epitaxy-file-prose h1')).fontSize,
  column:getComputedStyle(v.querySelector('.max-w-\\[860px\\]')).maxWidth,scroller:v.querySelector('[data-file-preview]').classList.contains('source-file-preview')}));
 report.metrics.readmePreview=readmePreview;assert.deepEqual(readmePreview,{view:'preview',label:'View source',rows:0,h1:'22px',column:'860px',scroller:true});
 await viewToggle.click();await readme.locator('[data-file-viewer] .sfv-line').first().waitFor();
 assert.deepEqual(await readme.evaluate(v=>({view:v.dataset.fileView,label:v.querySelector('[data-view-toggle]').getAttribute('aria-label'),rows:[...v.querySelectorAll('.sfv-line')].map(r=>[r.dataset.line,r.querySelector('code').textContent])})),
  {view:'source',label:'Preview',rows:[['1','# readme\n']]},'View source shows the numbered rows');
 await viewToggle.click();await readme.locator('[data-file-preview="markdown"] h1').waitFor();assert.equal(await viewToggle.getAttribute('aria-label'),'View source');
 await shot('readme-preview');
 await openTab('photo.png',true);const photo=pane().locator('[data-file-viewer][data-file-media="image"] img');await photo.waitFor();
 await page.waitForFunction(()=>{const i=document.querySelector('.source-side-tile[data-tile-id="files"] [data-file-media="image"] img');return !!i&&i.complete&&i.naturalWidth>0;});
 const photoInfo=await photo.evaluate(i=>({naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,alt:i.alt,src:i.getAttribute('src'),fit:getComputedStyle(i).objectFit,toggle:!!document.querySelector('.source-side-tile[data-tile-id="files"] [data-view-toggle]')}));
 report.metrics.photo=photoInfo;assert.deepEqual([photoInfo.naturalWidth,photoInfo.naturalHeight,photoInfo.alt,photoInfo.fit,photoInfo.toggle],[1,1,'photo.png','contain',false]);assert.match(photoInfo.src,/^file:\/\/\/.+\/photo\.png$/);
 await shot('photo-preview');
 await openMenu('photo.png');await page.getByRole('menuitem',{name:'Close all files',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.source-side-tile[data-tile-id="files"] .source-file-tab'));
 if(!(await tree().isVisible()))await pane().getByRole('button',{name:'Show file tree',exact:true}).click();
 report.checks.push('Previews: util.mjs and main.go render highlighted token spans ('+mjs.tokens+' / '+go.tokens+'); README.md opens as its Markdown preview (h1 22px in the 860px prose column) with the "View source" Code toggle, which shows the numbered source and flips to "Preview"; photo.png renders from its file:// URL with naturalWidth 1 and no toggle; the pressed ListBullet paints --cds-text-accent on --cds-bg-accent');
 assert.deepEqual(report.rendererErrors,[]);
 step('dark-relaunch');await app.close();app=null;await fs.writeFile(path.join(profile,'preferences.json'),JSON.stringify({...JSON.parse(await fs.readFile(path.join(profile,'preferences.json'),'utf8')),theme:'dark'}));
 await launch();await open();if(!(await pane().count()))await openFiles();await tree().getByRole('button',{name:'README.md',exact:true}).waitFor();
 if(!(await tree().getByRole('button',{name:'deep.txt',exact:true}).count())){await tree().getByRole('button',{name:'nested',exact:true}).click();await tree().getByRole('button',{name:'deep.txt',exact:true}).waitFor();}
 await page.waitForFunction(()=>[...document.querySelectorAll('.source-tree-caret')].every(n=>n.getAnimations().every(a=>a.playState==='finished')));await frames();
 snapshot=await rows();assertRows(snapshot,'dark');report.metrics.dark=snapshot;
 await page.mouse.move(2,2);await frames();const pressedDark=await pressedPaint();report.metrics.pressedDark=pressedDark;
 assert.equal(pressedDark.label,'Hide file tree');assert.equal(pressedDark.color,pressedDark.accent.color,'dark pressed ListBullet colour = --cds-text-accent');
 assert.equal(pressedDark.background,pressedDark.accent.background,'dark pressed ListBullet fill = --cds-bg-accent');assert.notEqual(pressedDark.color,pressedLight.color,'the accent follows the theme');assert.notEqual(snapshot.primary,report.metrics.light.primary,'dark theme resolves a different --cds-text-primary'); await shot('tree-dark'); // --cds-text-muted is gray-400 in both themes (design-system.css:53578/54142).
 await size(760,768);const overflow=await page.evaluate(()=>({doc:document.documentElement.scrollWidth<=document.documentElement.clientWidth,body:document.body.scrollWidth<=document.body.clientWidth}));
 assert.deepEqual(overflow,{doc:true,body:true});if(await pane().count()){snapshot=await rows();assertRows(snapshot,'dark-760');}await shot('tree-dark-760');
 report.checks.push('Dark relaunch keeps one 12px glyph per row in --cds-text-muted (gray-400 in both themes) with the dark --cds-text-primary name; 760px has no document/body horizontal overflow');
 assert.deepEqual(report.rendererErrors,[]);await integrity();report.passed=true;
}catch(error){report.failure=error.stack;report.phase=phase;process.exitCode=1;if(page)await shot('failure').catch(()=>{});}
finally{if(app&&report.clipboardSaved&&!report.clipboardRestored){try{await restoreClipboard();}catch(error){report.clipboardRestoreError=String(error);report.passed=false;process.exitCode=1;}}
 if(app)await app.close().catch(()=>{});const bytes=JSON.stringify(report,null,2)+'\n';await fs.writeFile(path.join(directory,'report.json'),bytes);await fs.writeFile(path.join(evidence,'files-pane-ui-report.json'),bytes);console.log(bytes.slice(0,4000));}
