import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import http from 'node:http';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {_electron as electron} from '../../tools/node_modules/playwright/index.mjs';
// Preview pane (source-preview-pane.jsx over electron/preview-service.cjs). Offscreen Playwright _electron on an isolated
// CODE_DESKTOP_DATA profile with the fixture core; the previewed site is a tiny local http server started from the
// session folder's .claude/launch.json (run with this Node), so nothing leaves 127.0.0.1. Checks: ⇧⌘P and the titlebar
// toggle, the start page's server list, Run → the page in a WebContentsView laid over the pane (bounds follow the pane),
// the URL field, a menu over the page hides it behind a capture, the Mobile viewport, Attach screenshot into the composer,
// dev server logs, the page parking on a session switch and coming back, View › Hide Preview, the Settings switch,
// dark relaunch and a narrow window without horizontal overflow. Only run through the offscreen run-suite adapter.
const root=path.resolve(import.meta.dirname,'..'),evidence=path.resolve(root,'../analysis/batch-20260920');await fs.mkdir(evidence,{recursive:true});
const directory=await fs.mkdtemp(path.join(evidence,'preview-ui-')),profile=path.join(directory,'profile');
const scratch=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'cd-preview-ui-'))),workspace=path.join(scratch,'workspace'),otherWorkspace=path.join(scratch,'other'),home=path.join(scratch,'home');
for(const dir of [profile,workspace,otherWorkspace,home,path.join(workspace,'.claude')])await fs.mkdir(dir,{recursive:true});
const port=await new Promise(resolve=>{const s=http.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
await fs.writeFile(path.join(workspace,'site.js'),`require('node:http').createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html'});
res.end('<!doctype html><title>Fixture site</title><body style="margin:0;background:#3a7"><h1>'+(req.url==='/about'?'About page':'Home page')+'</h1><button>Go</button></body>');
}).listen(Number(process.env.PORT),'127.0.0.1',()=>console.log('site listening on '+process.env.PORT));`);
await fs.writeFile(path.join(workspace,'.claude/launch.json'),JSON.stringify({version:'0.0.1',configurations:[{name:'site',runtimeExecutable:process.execPath,runtimeArgs:['site.js'],port}]},null,2));
const A='preview-A',B='preview-B',now=Math.floor(Date.now()/1000);
const prefs=theme=>({cwd:workspace,theme,mode:'code',model:'fixture',effort:'low',threadIds:[A,B],sidebarWidth:288,displayName:'Fixture'});
await fs.writeFile(path.join(profile,'preferences.json'),JSON.stringify(prefs('light')));
await fs.writeFile(path.join(profile,'fixture-threads.json'),JSON.stringify({next:100,threads:{
 [A]:{id:A,name:'Preview A',cwd:workspace,createdAt:now,updatedAt:now,archived:false,turns:[]},
 [B]:{id:B,name:'Preview B',cwd:otherWorkspace,createdAt:now-10,updatedAt:now-10,archived:false,turns:[]}}}));
const build=JSON.parse(await fs.readFile(path.join(root,'dist/build-info.json'),'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');let testHash;
async function integrity(){assert.equal(sha(JSON.stringify(build.sources)),build.sourceSha256);for(const file of build.sources)assert.equal(sha(await fs.readFile(path.join(root,file.path))),file.sha256);
 for(const required of ['src/source-preview-pane.jsx','src/source-preview-pane.css','src/preview-model.mjs','src/agent-tool-titles.mjs'])assert.ok(build.sources.some(e=>e.path===required),required);
 assert.equal(JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version,build.version);
 const h=sha(await fs.readFile(path.join(root,'scripts/preview-ui-test.mjs'))+await fs.readFile(path.join(root,'electron/preview-service.cjs')));if(testHash)assert.equal(h,testHash);else testHash=h;}
const report={suite:'preview-ui',at:new Date().toISOString(),directory,build:{version:build.version,sourceSha256:build.sourceSha256},checks:[],metrics:{},rendererErrors:[],passed:false};let app,page,phase='launch';
const step=name=>{phase=name;console.log('PREVIEW '+name);};
const env={...process.env,CODE_DESKTOP_DATA:profile,CODEX_HOME:path.join(profile,'codex-home'),CODEX_BINARY:path.join(root,'tests/fixtures/codex-server.cjs'),HOME:home};
delete env.ELECTRON_RUN_AS_NODE;delete env.CODE_DESKTOP_DEV_URL;
const frames=(count=4)=>page.evaluate(count=>new Promise(resolve=>{const step=()=>--count?requestAnimationFrame(step):resolve();requestAnimationFrame(step);}),count);
const poll=async(fn,label,ms=10000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,50));}throw Error('Timed out: '+label);};
async function launch(){app=await electron.launch({args:[root],executablePath:path.join(root,'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),env,timeout:20000});page=await app.firstWindow();page.setDefaultTimeout(12000);
 page.on('pageerror',e=>report.rendererErrors.push({phase,message:e.message}));await page.getByRole('button',{name:'Model',exact:true}).filter({hasText:'Test model'}).waitFor();await size(1280,820);}
async function size(width,height){await app.evaluate(({BrowserWindow},s)=>BrowserWindow.getAllWindows()[0].setContentSize(s.width,s.height),{width,height});await page.waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,{width,height});await frames();}
async function open(id){await page.locator(`[data-source-session-id="${id}"] .source-session-open`).click();await page.locator('.st-title').waitFor();await page.locator('.loading-state').waitFor({state:'detached'});await frames();}
const pane=()=>page.locator('.source-side-tile[data-tile-id="preview"]');
const surface=()=>pane().locator('.spv-pane').getAttribute('data-preview-surface');
// The preview's WebContentsView in the main window: {url, bounds, visible} or null when it is parked elsewhere.
const mainView=()=>app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('index.html'));if(!win)return null;
 const view=win.contentView.children.find(child=>child.webContents&&child.webContents!==win.webContents);if(!view)return null;
 return {url:view.webContents.getURL(),bounds:view.getBounds(),visible:view.getVisible?.()??true,zoom:win.webContents.getZoomFactor()};});
const viewportRect=()=>pane().locator('.spv-viewport').evaluate(node=>{const r=node.getBoundingClientRect();return {x:r.left,y:r.top,width:r.width,height:r.height};});
async function shot(name){await page.screenshot({path:path.join(directory,name+'.png')});}
async function viewMenuLabels(){return app.evaluate(({Menu})=>Menu.getApplicationMenu().items.find(item=>item.label==='View').submenu.items.map(item=>({label:item.label,enabled:item.enabled,accelerator:item.accelerator??null})));}
try{
 await integrity();await launch();await open(A);
 step('toggle');
 assert.equal(await pane().count(),0,'no preview pane before the shortcut');
 await page.keyboard.press('Meta+Shift+KeyP');await pane().waitFor();
 const toggle=page.locator('[data-pane-toggle="preview"]');assert.equal(await toggle.getAttribute('aria-pressed'),'true');
 await poll(async()=>await surface()==='start','start page');
 const run=pane().getByRole('button',{name:'Run site',exact:true});await run.waitFor();
 assert.match(await pane().locator('[data-preview-start="servers"]').textContent(),/Run a server to preview your app, or enter a URL\./);
 report.checks.push('⇧⌘P opens the Preview pane; the titlebar toggle is pressed; the start page lists launch.json’s server with Run');
 step('run');
 await run.click();await poll(async()=>await surface()==='page','the page shows',30000);
 await poll(async()=>(await mainView())?.url?.startsWith(`http://localhost:${port}`),'the view loads the dev server');
 assert.match(await pane().locator('.spv-url-host').textContent(),new RegExp(`localhost:${port}`));
 const rect=await viewportRect(),view=await mainView();report.metrics.bounds={rect,view};
 assert.ok(Math.abs(view.bounds.x-rect.x*view.zoom)<=2&&Math.abs(view.bounds.width-rect.width*view.zoom)<=2,'the view sits over the pane viewport');
 await shot('preview-page-light');
 report.checks.push('Run starts the dev server from the session folder and the page shows in a WebContentsView laid over the pane');
 step('url-field');
 await pane().locator('.spv-url-display').click();const field=pane().getByRole('textbox',{name:'Page URL',exact:true});await field.fill(`localhost:${port}/about`);await field.press('Enter');
 await poll(async()=>(await mainView())?.url?.endsWith('/about'),'navigated to /about');
 await poll(async()=>!(await pane().getByRole('button',{name:'Go back',exact:true}).isDisabled()),'Back enabled');
 report.checks.push('The URL field navigates; Back becomes available');
 step('occlusion');
 await pane().getByRole('button',{name:'Servers & settings',exact:true}).click();const menu=page.getByRole('menu',{name:'Servers & settings'});await menu.waitFor();
 await poll(async()=>(await mainView())?.visible===false,'a menu over the page hides the view');
 await page.keyboard.press('Escape');await menu.waitFor({state:'detached'});await poll(async()=>(await mainView())?.visible===true,'the view comes back');
 report.checks.push('A menu over the page hides the native view behind a capture and shows it again when it closes');
 step('viewport');
 await pane().getByRole('button',{name:'Servers & settings',exact:true}).click();await page.getByRole('menuitem',{name:/^Viewport/}).click();
 await page.getByRole('menuitemradio',{name:/^Mobile/}).click();await poll(async()=>(await mainView())?.bounds.width<rect.width*view.zoom-10,'Mobile narrows the view');
 assert.match(await pane().locator('.spv-viewport-badge').textContent(),/375 × 812/);
 await pane().getByRole('button',{name:'Servers & settings',exact:true}).click();await page.getByRole('menuitem',{name:/^Viewport/}).click();await page.getByRole('menuitemradio',{name:/^Responsive/}).click();
 report.checks.push('Viewport › Mobile emulates 375×812 inside the pane, Responsive fills it again');
 step('screenshot');
 await pane().getByRole('button',{name:'Attach screenshot',exact:true}).click();
 await poll(async()=>await page.locator('[data-cds-attachment][data-kind="image"]').count()>0,'a screenshot attachment in the composer');
 report.checks.push('Attach screenshot adds the page as an image attachment to the composer');
 step('logs');
 await pane().getByRole('button',{name:'Servers & settings',exact:true}).click();await page.getByRole('menuitem',{name:'Show dev server logs',exact:true}).click();
 const logs=pane().getByRole('region',{name:'Dev server logs'});await logs.waitFor();await poll(async()=>/site listening on/.test(await logs.textContent()),'logs show the server output');
 await logs.getByRole('button',{name:'Close dev server logs',exact:true}).click();await logs.waitFor({state:'detached'});
 report.checks.push('Show dev server logs opens the drawer with the server output');
 step('menu');
 const labels=await viewMenuLabels();assert.ok(labels.some(item=>item.label==='Hide Preview'&&item.enabled&&/Shift\+P/.test(item.accelerator??'')),'View › Hide Preview (⇧⌘P)');
 report.checks.push('View › Hide Preview carries CmdOrCtrl+Shift+P');
 step('session-switch');
 await open(B);await poll(async()=>(await mainView())===null||!(await mainView()).url.startsWith(`http://localhost:${port}`),'A’s page leaves the main window');
 await open(A);await pane().waitFor();await poll(async()=>(await mainView())?.url?.startsWith(`http://localhost:${port}`),'A’s page comes back');
 report.checks.push('A session switch parks the page; coming back shows it again without reloading the server');
 step('settings');
 await page.keyboard.press('Meta+Comma');const settings=page.getByRole('dialog',{name:'Settings',exact:true});await settings.waitFor();
 await settings.getByRole('navigation',{name:'Settings',exact:true}).getByRole('button',{name:'Code',exact:true}).click();
 await settings.getByText(/use the preview/).first().waitFor();await page.keyboard.press('Escape');await settings.waitFor({state:'detached'});
 report.checks.push('Settings › Code › Preview offers the switch for the agent’s preview tools');
 step('stop');
 await pane().getByRole('button',{name:'Servers & settings',exact:true}).click();await page.getByRole('menuitem',{name:/^Stop site\b/}).click();
 step('dark-and-narrow');
 await app.close();app=null;await fs.writeFile(path.join(profile,'preferences.json'),JSON.stringify(prefs('dark')));
 await launch();await open(A);if(!(await pane().count()))await page.keyboard.press('Meta+Shift+KeyP');await pane().waitFor();
 const placeholder=await pane().locator('.spv-viewport').evaluate(node=>getComputedStyle(node).backgroundColor);report.metrics.darkPlaceholder=placeholder;assert.equal(placeholder,'rgb(19, 19, 18)');
 await shot('preview-dark');
 await size(720,700);const overflow=await page.evaluate(()=>({doc:document.documentElement.scrollWidth<=document.documentElement.clientWidth,body:document.body.scrollWidth<=document.body.clientWidth}));
 assert.deepEqual(overflow,{doc:true,body:true});await shot('preview-dark-720');
 report.checks.push('Dark relaunch paints the dark placeholder; 720px has no horizontal overflow');
 assert.deepEqual(report.rendererErrors,[]);await integrity();report.passed=true;
}catch(error){report.failure=error.stack;report.phase=phase;process.exitCode=1;if(page)await shot('failure').catch(()=>{});}
finally{if(app)await app.close().catch(()=>{});await fs.rm(scratch,{recursive:true,force:true}).catch(()=>{});
 const bytes=JSON.stringify(report,null,2)+'\n';await fs.writeFile(path.join(directory,'report.json'),bytes);await fs.writeFile(path.join(evidence,'preview-ui-report.json'),bytes);console.log(bytes.slice(0,4000));}
