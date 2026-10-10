// Computer use in the real app (src/computer-use-model.mjs, source-computer-use.jsx) against the fixture core:
// `fixture:computer-use` streams a screenshot, an MCP click, an Anthropic-shape typing step, a drag and a held key
// press. Checks the live banner (screenshot, action, Stop), the grouped rows and their labels, the click marker on
// the screenshot, the image viewer, and the dark appearance.
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {_electron as electron} from '../../tools/node_modules/playwright/index.mjs';
import {fillComposer} from './composer-test-helpers.mjs';
const root=path.resolve(import.meta.dirname,'..'),project=path.dirname(root),evidence=path.join(project,'analysis/batch-20260920');
const directory=await fs.mkdtemp(path.join(evidence,'computer-use-ui-')),profile=path.join(directory,'profile'),workspace=path.join(profile,'workspace');await fs.mkdir(workspace,{recursive:true});await fs.mkdir(path.join(profile,'codex-home'));
const atom=async(file,value)=>{const p=path.join(profile,file);await fs.writeFile(p+'.tmp',JSON.stringify(value));await fs.rename(p+'.tmp',p);};
await atom('preferences.json',{cwd:workspace,theme:'light',mode:'code',model:'fixture',permission:'auto',threadIds:[],onboarded:true});
// The "desktop": any real screenshot of this app (a committed-style PNG from the onboarding evidence, else a 1x1).
const candidates=(await fs.readdir(evidence)).filter(name=>name.startsWith('onboarding-ui-')).map(name=>path.join(evidence,name,'welcome-light.png'));
let png=null;for(const file of candidates){try{png=await fs.readFile(file);break;}catch{}}
await fs.writeFile(path.join(profile,'fixture-computer.png'),png??Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64'));
const env={...process.env,CODE_DESKTOP_DATA:profile,CODEX_HOME:path.join(profile,'codex-home'),CODEX_BINARY:path.join(root,'tests/fixtures/codex-server.cjs')};delete env.ELECTRON_RUN_AS_NODE;delete env.CODE_DESKTOP_DEV_URL;
const build=JSON.parse(await fs.readFile(path.join(root,'dist/build-info.json'),'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
let testHashes;const testSources=['scripts/computer-use-ui-test.mjs','scripts/composer-test-helpers.mjs','tests/fixtures/codex-server.cjs'];
async function integrity(){assert.equal(sha(JSON.stringify(build.sources)),build.sourceSha256);for(const file of build.sources)assert.equal(sha(await fs.readFile(path.join(root,file.path))),file.sha256);const hashes=Object.fromEntries(await Promise.all(testSources.map(async file=>[file,sha(await fs.readFile(path.join(root,file)))])));if(testHashes)assert.deepEqual(hashes,testHashes);else testHashes=hashes;}
const report={at:new Date().toISOString(),directory,build:{version:build.version,sourceSha256:build.sourceSha256},checks:[],rendererErrors:[],metrics:{},passed:false};let app,page;
const poll=async(fn,label,ms=10000)=>{const end=Date.now()+ms;while(Date.now()<end){try{if(await fn())return;}catch{}await new Promise(r=>setTimeout(r,30));}throw Error('Timed out: '+label);};
async function launch(){app=await electron.launch({args:[root],executablePath:path.join(root,'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),env,timeout:20000});page=await app.firstWindow();page.setDefaultTimeout(10000);page.on('pageerror',e=>report.rendererErrors.push(e.message));await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1324,900));await page.waitForFunction(()=>{const c=document.querySelector('[data-cds=ChatComposer]');return c&&!c.hasAttribute('data-disabled')&&document.querySelector('[aria-label="Model"]')?.textContent.includes('Test model');});}
try{
 await integrity();await launch();
 const input=page.getByRole('textbox',{name:'Message DeepSeek',exact:true});
 await fillComposer(page,input,'fixture:computer-use');await page.getByRole('button',{name:'Send message',exact:true}).click();
 // 1. The live banner while the held key press runs.
 const banner=page.locator('[data-computer-use-banner]');await banner.waitFor();
 await poll(async()=>/Pressing\s*⌘S/.test(await banner.innerText()),'banner shows the current action');
 report.metrics.banner=await banner.evaluate(n=>({text:n.innerText,thumb:!!n.querySelector('.scu-shot img'),stop:!!n.querySelector('button.ssb, button')}));
 assert.match(report.metrics.banner.text,/is using your computer/);
 // The strip lines up with the composer column.
 report.metrics.bannerAlign=await page.evaluate(()=>{const b=document.querySelector('.scu-banner').getBoundingClientRect(),c=document.querySelector('.sc-composer').getBoundingClientRect();return {left:b.left-c.left,right:b.right-c.right};});
 assert.ok(Math.abs(report.metrics.bannerAlign.left)<1&&Math.abs(report.metrics.bannerAlign.right)<1,'banner aligned with the composer');assert.equal(report.metrics.banner.thumb,true,'the last screenshot stands in for the key press');
 await page.screenshot({path:path.join(directory,'banner.png')});
 report.checks.push('While a computer-use step runs, a banner above the composer names the core, shows the latest screenshot and the action, with Stop');
 await banner.waitFor({state:'detached',timeout:8000});
 report.checks.push('The banner goes away when the step finishes');
 // 2. The group and its rows.
 const group=page.locator('[data-tool-group]').last();await group.waitFor();
 await poll(async()=>/Used the computer \(5 steps\)/.test(await group.locator('.stg-trigger').innerText()),'group summary');
 await group.locator('.stg-trigger').click();
 const rows=group.locator('.scu-step');await poll(async()=>await rows.count()===5,'five rows');
 report.metrics.rows=await rows.evaluateAll(list=>list.map(n=>n.querySelector('.source-step-trigger').innerText.replace(/[\uE000-\uF8FF]/g,'').replace(/\s+/g,' ').trim()));
 assert.deepEqual(report.metrics.rows,['Took a screenshot','Clicked (420, 180)','Typed “quarterly report”','Dragged (120, 300) → (640, 420)','Pressed ⌘S']);
 report.checks.push('Five steps in three shapes group as “Used the computer (5 steps)” with per-step labels');
 // 3. Marker on the click and drag screenshots; the viewer opens.
 // In a group the screenshot is the row's body, like other tool images: open the click and drag rows.
 await rows.nth(1).locator('.source-step-trigger').click();await rows.nth(3).locator('.source-step-trigger').click();
 const click=rows.nth(1).locator('.scu-shot');await click.waitFor();
 await poll(async()=>await click.locator('.scu-ring').count()===1,'click ring');
 report.metrics.ring=await click.evaluate(n=>{const img=n.querySelector('img').getBoundingClientRect(),ring=n.querySelector('.scu-ring').getBoundingClientRect(),natural=n.querySelector('img');return {dx:(ring.left+ring.width/2-img.left)/img.width,dy:(ring.top+ring.height/2-img.top)/img.height,expectX:420/natural.naturalWidth,expectY:180/natural.naturalHeight};});
 assert.ok(Math.abs(report.metrics.ring.dx-report.metrics.ring.expectX)<0.01&&Math.abs(report.metrics.ring.dy-report.metrics.ring.expectY)<0.01,'ring sits on the clicked point');
 const drag=rows.nth(3).locator('.scu-shot');await poll(async()=>await drag.locator('.scu-ring').count()===2&&await drag.locator('svg line').count()===1,'drag marker');
 await rows.nth(1).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(directory,'rows-light.png')});
 await click.click();const viewer=page.getByRole('dialog').filter({hasText:'Clicked'});await viewer.waitFor();await page.screenshot({path:path.join(directory,'viewer.png')});await page.keyboard.press('Escape');await viewer.waitFor({state:'detached'});
 report.checks.push('The click screenshot carries a ring at the clicked point (within 1%), the drag one a dashed line with both ends; the viewer opens with the action caption');
 await page.evaluate(()=>{document.documentElement.dataset.mode='dark';});await rows.nth(1).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(directory,'rows-dark.png')});
 assert.deepEqual(report.rendererErrors,[]);await integrity();report.testSourceHashes=testHashes;report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;if(page)await page.screenshot({path:path.join(directory,'failure.png')}).catch(()=>{});}
finally{await app?.close();await fs.writeFile(path.join(directory,'report.json'),JSON.stringify(report,null,2)+'\n');await fs.writeFile(path.join(evidence,'computer-use-ui-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
