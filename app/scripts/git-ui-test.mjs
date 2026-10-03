import { _electron as electron } from '../../tools/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'), evidence=path.join(root,'../analysis/batch-20260920');
const profile=await fs.mkdtemp(path.join(evidence,'git-ui-profile-')), cwd=path.join(profile,'git-workspace'), now=Math.floor(Date.now()/1000);
await fs.mkdir(cwd);const git=(...args)=>execFileSync('git',args,{cwd,env:{...process.env,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1'},encoding:'utf8'});
git('init','-b','main');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');
await fs.writeFile(path.join(cwd,'change.txt'),'original\n');git('add','.');git('commit','-m','Fixture base');
await fs.writeFile(path.join(cwd,'change.txt'),'replacement\nsecond\n');
await fs.writeFile(path.join(profile,'preferences.json'),JSON.stringify({cwd,theme:'light',model:'fixture',threadIds:['git-ui-thread']}));
await fs.writeFile(path.join(profile,'fixture-threads.json'),JSON.stringify({next:100,threads:{'git-ui-thread':{id:'git-ui-thread',cwd,name:'Git status verification',createdAt:now,updatedAt:now,turns:[],archived:false}}}));
const env={...process.env,CODE_DESKTOP_DATA:profile,CODEX_BINARY:path.join(root,'tests/fixtures/codex-server.cjs')};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({executablePath:path.join(root,'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),args:[root],env}), checks=[],errors=[];
await app.evaluate(async({clipboard,ClipboardItem})=>{const originals=await clipboard.read();globalThis.gitUiClipboard=await Promise.all(originals.map(async item=>new ClipboardItem(Object.fromEntries(await Promise.all(item.types.map(async type=>[type,await item.getType(type)]))))));});
try{
 const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));
 await page.locator('[data-source-session-id="git-ui-thread"] .source-session-open').click();const row=page.locator('.sg-row');await row.waitFor();
 assert.equal(await row.locator('.sg-added').textContent(),'+2');assert.equal(await row.locator('.sg-removed').textContent(),'−1');
 const geometry=await row.evaluate(el=>({height:el.offsetHeight,width:el.getBoundingClientRect().width,gap:document.querySelector('.sc-composer').getBoundingClientRect().top-el.getBoundingClientRect().bottom}));assert.equal(geometry.height,40);assert.equal(geometry.width,768);assert.equal(geometry.gap,6);checks.push('real Git HEAD→working-tree counts and source40px/768px/6px geometry');
 /* F12: .sg-diff is the secondary CDS Button named by its sr-only counts ('2 additions, 1 deletion'); 'View changes' is only its tooltip (shared-21 OV, git-status-card 1287-1305). */
 assert.equal(await row.locator('.sg-diff').getAttribute('aria-label'),null);assert.equal(await row.locator('.sg-diff .sr-only').textContent(),'2 additions, 1 deletion');
 await row.locator('.sg-diff').click();await page.locator('.source-diff').filter({hasText:'+replacement'}).waitFor();assert.match(await page.locator('.source-diff').textContent(),/\u2212original/);/* removed-line marker is U+2212 since 0.2.45 (source-diff.jsx:53 DiffLine; work/diff-separators-headless-20260922/check.mjs:62); HANDOFF 0.2.125 */checks.push('changes panel loads actual local diff');
 /* F12 git-status-card 5024-5045 Zn({toggle:true}): a second click on the counts closes Changes. */
 await row.locator('.sg-diff').click();await page.locator('[data-pane-kind="diff"]').waitFor({state:'detached'});checks.push('counts toggle the Changes pane closed');
 await page.getByRole('button',{name:'main',exact:true}).click();await page.getByRole('menuitem',{name:'Copy branch name'}).click();await app.evaluate(async({clipboard})=>{const deadline=Date.now()+3000;while(await clipboard.readText()!=='main'&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));});assert.equal(await app.evaluate(({clipboard})=>clipboard.readText()),'main');checks.push('branch menu copies actual branch');
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(800,600));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(evidence,'git-source-compact.png')});
 /* F12 git-status-card 4666-4669 / 5180-5181: a commit-mode row has no Dismiss and no reserved space. */
 assert.equal(await page.locator('.sg-dismiss, .sg-dismiss-reserved').count(),0);assert.equal(await row.count(),1);checks.push('compact layout; commit mode has no Dismiss');
 assert.deepEqual(errors,[]);const report={passed:true,at:new Date().toISOString(),fixture:true,realGit:true,checks,geometry,errors};await fs.writeFile(path.join(evidence,'git-ui-test.json'),JSON.stringify(report,null,2));console.log(report);
}finally{await app.evaluate(async({clipboard})=>{const originals=globalThis.gitUiClipboard;if(originals?.length)await clipboard.write(originals);else await clipboard.clear();delete globalThis.gitUiClipboard;});await app.close();}
