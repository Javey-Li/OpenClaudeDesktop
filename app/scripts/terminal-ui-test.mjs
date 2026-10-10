import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {_electron as electron} from '../../tools/node_modules/playwright/index.mjs';
// Built-in terminal pane (source-terminal-pane.jsx over electron/terminal-service.cjs). Offscreen Playwright _electron on an
// isolated CODE_DESKTOP_DATA profile with the fixture core; the shell is /bin/sh (CODE_DESKTOP_TERMINAL_SHELL) under a
// temporary HOME, so neither the user's shell nor their dotfiles are read. Checks: ⌃` / ⌘J toggle and focus, typing into a
// real PTY, Terminal 1/2 tabs (+, rename, close, keyboard), ⌘K clear, the in-pane find bar, the busy close confirmation and
// titlebar dot, Shell exited + Restart shell, terminals surviving a session switch, the View menu item, theme in light and
// dark, and a narrow window without horizontal overflow. Only run through the offscreen run-suite adapter.
const root=path.resolve(import.meta.dirname,'..'),evidence=path.resolve(root,'../analysis/batch-20260920');await fs.mkdir(evidence,{recursive:true});
const directory=await fs.mkdtemp(path.join(evidence,'terminal-ui-')),profile=path.join(directory,'profile');
const scratch=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'cd-terminal-ui-'))),workspace=path.join(scratch,'workspace'),otherWorkspace=path.join(scratch,'other'),home=path.join(scratch,'home');
for(const dir of [profile,workspace,otherWorkspace,home])await fs.mkdir(dir,{recursive:true});
await fs.writeFile(path.join(workspace,'README.md'),'# terminal fixture\n');
const A='terminal-A',B='terminal-B',now=Math.floor(Date.now()/1000);
const prefs=theme=>({cwd:workspace,theme,mode:'code',model:'fixture',effort:'low',threadIds:[A,B],sidebarWidth:288,displayName:'Fixture'});
await fs.writeFile(path.join(profile,'preferences.json'),JSON.stringify(prefs('light')));
await fs.writeFile(path.join(profile,'fixture-threads.json'),JSON.stringify({next:100,threads:{
 [A]:{id:A,name:'Terminal A',cwd:workspace,createdAt:now,updatedAt:now,archived:false,turns:[]},
 [B]:{id:B,name:'Terminal B',cwd:otherWorkspace,createdAt:now-10,updatedAt:now-10,archived:false,turns:[]}}}));
const build=JSON.parse(await fs.readFile(path.join(root,'dist/build-info.json'),'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');let testHash;
async function integrity(){assert.equal(sha(JSON.stringify(build.sources)),build.sourceSha256);for(const file of build.sources)assert.equal(sha(await fs.readFile(path.join(root,file.path))),file.sha256);
 for(const required of ['src/source-terminal-pane.jsx','src/source-terminal-pane.css','src/terminal-pane-model.mjs','src/terminal-store.mjs'])assert.ok(build.sources.some(e=>e.path===required),required);
 assert.equal(JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version,build.version);
 const h=sha(await fs.readFile(path.join(root,'scripts/terminal-ui-test.mjs'))+await fs.readFile(path.join(root,'electron/terminal-service.cjs')));if(testHash)assert.equal(h,testHash);else testHash=h;}
const report={suite:'terminal-ui',at:new Date().toISOString(),directory,build:{version:build.version,sourceSha256:build.sourceSha256},checks:[],metrics:{},rendererErrors:[],passed:false};let app,page,phase='launch';
const step=name=>{phase=name;console.log('TERMINAL '+name);};
const env={...process.env,CODE_DESKTOP_DATA:profile,CODEX_HOME:path.join(profile,'codex-home'),CODEX_BINARY:path.join(root,'tests/fixtures/codex-server.cjs'),
 CODE_DESKTOP_TERMINAL_SHELL:'/bin/sh',HOME:home,SHELL:'/bin/sh',PS1:'fixture$ ',ENV:''};delete env.ELECTRON_RUN_AS_NODE;delete env.CODE_DESKTOP_DEV_URL;delete env.ZDOTDIR;delete env.BASH_ENV;
const frames=(count=4)=>page.evaluate(count=>new Promise(resolve=>{const step=()=>--count?requestAnimationFrame(step):resolve();requestAnimationFrame(step);}),count);
const poll=async(fn,label,ms=10000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,40));}throw Error('Timed out: '+label);};
async function launch(){app=await electron.launch({args:[root],executablePath:path.join(root,'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),env,timeout:20000});page=await app.firstWindow();page.setDefaultTimeout(12000);
 page.on('pageerror',e=>report.rendererErrors.push({phase,message:e.message}));await page.getByRole('button',{name:'Model',exact:true}).filter({hasText:'Test model'}).waitFor();await size(1280,820);}
async function size(width,height){await app.evaluate(({BrowserWindow},s)=>BrowserWindow.getAllWindows()[0].setContentSize(s.width,s.height),{width,height});await page.waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,{width,height});await frames();}
async function open(id){await page.locator(`[data-source-session-id="${id}"] .source-session-open`).click();await page.locator('.st-title').waitFor();await page.locator('.loading-state').waitFor({state:'detached'});await frames();}
const pane=()=>page.locator('.source-side-tile[data-tile-id="terminal"]');
const tabs=()=>pane().getByRole('tablist',{name:'Terminal tabs',exact:true}).getByRole('tab');
const screen=()=>pane().locator('.stp-host .stp-xterm').evaluate(node=>node.stpReadText?.()??'');
const focusedInTerminal=()=>page.evaluate(()=>!!document.activeElement?.closest?.('[data-tile-id="terminal"] .xterm'));
async function type(text){await page.keyboard.type(text);await page.keyboard.press('Enter');}
async function shot(name){await page.screenshot({path:path.join(directory,name+'.png')});}
async function viewMenuLabels(){return app.evaluate(({Menu})=>Menu.getApplicationMenu().items.find(item=>item.label==='View').submenu.items.map(item=>({label:item.label,enabled:item.enabled,accelerator:item.accelerator??null})));}
try{
 await integrity();await launch();await open(A);
 step('toggle-open');
 assert.equal(await pane().count(),0,'no terminal pane before the shortcut');
 await page.keyboard.press('Control+Backquote');await pane().waitFor();await pane().locator('.stp-xterm .xterm').waitFor();
 await poll(focusedInTerminal,'focus moves into the terminal');
 await poll(async()=>/fixture\$|\$ ?$/m.test(await screen()),'the shell prompt arrives');
 assert.equal(await tabs().count(),1);assert.equal((await tabs().first().textContent()).trim(),'Terminal');
 const titlebarButton=page.locator('[data-pane-toggle="terminal"]');assert.equal(await titlebarButton.getAttribute('aria-pressed'),'true');
 report.checks.push('⌃` opens the Terminal pane beside the chat, starts one login shell and focuses it; the titlebar toggle is pressed');
 step('typing');
 await type('echo marker-$((6*7)); pwd');
 // Wait for pwd's line too: the echo's output can paint a frame before it.
 await poll(async()=>{const text=await screen();return /marker-42/.test(text)&&text.includes(workspace);},'command output');
 {const text=await screen();assert.ok(text.includes(workspace),'the shell starts in the session folder: '+JSON.stringify(text.slice(-600)));}
 const theme=await pane().evaluate(node=>({body:getComputedStyle(node.querySelector('.stp-body')).backgroundColor,surface:getComputedStyle(node.querySelector('.stp-pane')).backgroundColor,
  font:node.querySelector('.xterm-helper-textarea')?getComputedStyle(node.querySelector('.xterm')).fontFamily:null}));
 report.metrics.lightTheme=theme;assert.equal(theme.body,theme.surface,'the Claude Light terminal paints the pane surface');
 await shot('terminal-light');
 report.checks.push('Typing reaches a real PTY in the session folder; the light theme uses the pane surface');
 step('menu');
 let labels=await viewMenuLabels();assert.ok(labels.some(item=>item.label==='Hide Terminal'&&item.enabled&&/J/.test(item.accelerator)),'View › Hide Terminal (⌘J)');
 step('tabs');
 await pane().getByRole('button',{name:'New terminal',exact:true}).click();await poll(async()=>await tabs().count()===2,'second tab');
 assert.deepEqual((await tabs().allTextContents()).map(text=>text.trim()),['Terminal 1','Terminal 2']);
 assert.equal(await tabs().nth(1).getAttribute('aria-selected'),'true');
 await tabs().nth(1).click({button:'right'});await page.getByRole('menuitem',{name:'Rename terminal',exact:true}).click();
 const rename=pane().getByRole('textbox',{name:'Rename terminal',exact:true});await rename.fill('dev server');await rename.press('Enter');
 await poll(async()=>(await tabs().nth(1).textContent()).includes('dev server'),'renamed');
 await tabs().nth(1).focus();await page.keyboard.press('ArrowLeft');await poll(async()=>await tabs().nth(0).getAttribute('aria-selected')==='true','arrow keys move between tabs');
 await tabs().nth(1).focus();await page.keyboard.press('Delete');await poll(async()=>await tabs().count()===1,'Delete closes the focused tab');
 report.checks.push('+ opens Terminal 2; rename from the tab menu; ←/→ roving focus; Delete closes a tab');
 step('clear-and-find');
 await pane().locator('.stp-host').click();await type('echo findme-1; echo findme-2');await poll(async()=>/findme-2/.test(await screen()),'find output');
 await page.keyboard.press('Meta+f');const find=pane().getByRole('search');await find.waitFor();
 await find.getByRole('textbox',{name:'Find',exact:true}).fill('findme');await poll(async()=>/\d+\/\d+/.test(await find.locator('.sfb-status').textContent()),'match count');
 report.metrics.findStatus=await find.locator('.sfb-status').textContent();
 assert.equal(await page.locator('.sfb-root:not(.stp-find)').count(),0,'the transcript find bar stays closed');
 await page.keyboard.press('Escape');await find.waitFor({state:'detached'});await poll(focusedInTerminal,'Escape returns to the terminal');
 await page.keyboard.press('Meta+k');await poll(async()=>!/marker-42/.test(await screen()),'⌘K clears the scrollback');
 report.checks.push('⌘F opens the terminal’s own find bar with a match count, Escape returns focus; ⌘K clears');
 step('busy');
 await type('sleep 30');await poll(async()=>await pane().locator('.stp-tab[data-busy]').count()===1,'busy tab',15000);
 await page.keyboard.press('Meta+j');await pane().waitFor({state:'detached'});
 await poll(async()=>(await titlebarButton.getAttribute('aria-label'))==='Terminal (command running)','titlebar running label while hidden');
 assert.equal(await titlebarButton.locator('.st-indicator-dot').count(),1);
 await titlebarButton.click();await pane().waitFor();
 await pane().locator('.stp-tab .source-file-tab-close').first().click({force:true});
 const dialog=page.getByRole('dialog',{name:'Close terminal?',exact:true});await dialog.waitFor();assert.match(await dialog.textContent(),/Close terminal\?[\s\S]*still running/);
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(await tabs().count(),1);
 await pane().locator('.stp-host').click();await page.keyboard.press('Control+c');await poll(async()=>await pane().locator('.stp-tab[data-busy]').count()===0,'Ctrl-C ends the command',15000);
 report.checks.push('A running command marks the tab, the hidden pane’s titlebar toggle shows “Terminal (command running)” with a dot, and closing asks first');
 step('exited');
 await type('sleep 3; exit 5');await pane().getByText('Shell exited.',{exact:true}).waitFor({timeout:15000});
 await pane().getByRole('button',{name:'Restart shell',exact:true}).click();await pane().getByText('Shell exited.',{exact:true}).waitFor({state:'detached'});
 await poll(async()=>/fixture\$|\$ ?$/m.test(await screen()),'a new prompt after restart');
 report.checks.push('A shell that exits on its own shows Shell exited. with Restart shell, which starts a fresh shell');
 step('session-switch');
 await pane().locator('.stp-host').click();await type('echo keep-alive-A');await poll(async()=>/keep-alive-A/.test(await screen()),'marker in A');
 await open(B);if(!(await pane().count()))await page.keyboard.press('Control+Backquote');await pane().waitFor();
 await poll(async()=>(await screen()).includes(otherWorkspace)||/\$/.test(await screen()),'B has its own shell');
 assert.equal(/keep-alive-A/.test(await screen()),false,'B never shows A’s terminal');
 await open(A);await pane().waitFor();await poll(async()=>/keep-alive-A/.test(await screen()),'A’s terminal survived the switch');
 report.checks.push('Each session keeps its own terminals; switching away and back keeps the shell and its scrollback');
 step('dark-and-narrow');
 await app.close();app=null;await fs.writeFile(path.join(profile,'preferences.json'),JSON.stringify(prefs('dark')));
 await launch();await open(A);if(!(await pane().count()))await page.keyboard.press('Control+Backquote');await pane().locator('.stp-xterm .xterm').waitFor();
 const dark=await pane().evaluate(node=>({body:getComputedStyle(node.querySelector('.stp-body')).backgroundColor,surface:getComputedStyle(node.querySelector('.stp-pane')).backgroundColor}));
 report.metrics.darkTheme=dark;assert.equal(dark.body,dark.surface);assert.notEqual(dark.body,theme.body,'dark paints a different surface');
 await shot('terminal-dark');
 await size(720,700);const overflow=await page.evaluate(()=>({doc:document.documentElement.scrollWidth<=document.documentElement.clientWidth,body:document.body.scrollWidth<=document.body.clientWidth}));
 assert.deepEqual(overflow,{doc:true,body:true});await shot('terminal-dark-720');
 labels=await viewMenuLabels();assert.ok(labels.some(item=>/Terminal/.test(item.label)));
 report.checks.push('Dark relaunch repaints the terminal; 720px has no horizontal overflow');
 assert.deepEqual(report.rendererErrors,[]);await integrity();report.passed=true;
}catch(error){report.failure=error.stack;report.phase=phase;process.exitCode=1;if(page)await shot('failure').catch(()=>{});}
finally{if(app)await app.close().catch(()=>{});await fs.rm(scratch,{recursive:true,force:true}).catch(()=>{});
 const bytes=JSON.stringify(report,null,2)+'\n';await fs.writeFile(path.join(directory,'report.json'),bytes);await fs.writeFile(path.join(evidence,'terminal-ui-report.json'),bytes);console.log(bytes.slice(0,4000));}
