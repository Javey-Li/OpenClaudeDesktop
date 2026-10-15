import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {_electron as electron} from '../../tools/node_modules/playwright/index.mjs';
// Git status band hints and repo menu end to end, against a real temp git repo:
// CDS tooltips with source gating instead of native titles (git-status-card
// 1270-1318 K 'View changes' / multiline behind, 1085-1119 Fe → shared-frame
// Pu 4869-4895 disabled reason; git-chips D 46-96 repo tooltip = cwd only when
// it differs from the label and closed while the chip menu is open, M 97-221
// branch tooltip only while the label is truncated), the Ko/qo repo menu
// (cc70f2bdf 2270-2394: Show in Finder | Copy path; F12 c18ab0d94 b() reveal label) and the addSuccess copy
// toasts. Only meaningful under the offscreen adapter with the in-memory
// clipboard (run-suite git-band): writeText never reaches the OS clipboard,
// and Show in Finder is asserted as a menu row only (shell.openPath is
// blocked before any native call and would fail the run's boundary check).
const root=path.resolve(import.meta.dirname,'..'),evidence=path.resolve(root,'../analysis/batch-20260920'),directory=await fs.mkdtemp(path.join(evidence,'git-band-ui-')),profile=path.join(directory,'profile');
const cwd=path.join(profile,'git-band-repo'),SESSION='git-band-thread',now=Math.floor(Date.now()/1000);await fs.mkdir(cwd,{recursive:true});
// F12 review: a second dirty session on the same checkout for the A→B→A band hold, and an archived one for the
// Commit failure toast (sendCommitTurn routes the archived precondition to the xr danger toast).
const SESSION_B='git-band-thread-b',SESSION_ARCHIVED='git-band-thread-archived',COMMIT_FAILED='Message couldn’t be sent. Try again.';
const git=(...args)=>execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid',...args],{cwd,env:{...process.env,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1'},encoding:'utf8'});
git('init','-q','-b','main');await fs.writeFile(path.join(cwd,'change.txt'),'original\n');git('add','.');git('commit','-qm','Fixture base');
// F12: an origin/main remote-tracking ref makes main the session base (getGitInfo defaultBranch), so the band
// counts merge-base(origin/main, HEAD) → worktree and survives a commit on the branch (no network: a local ref only).
git('update-ref','refs/remotes/origin/main','HEAD');
await fs.writeFile(path.join(cwd,'change.txt'),'replacement\nsecond\n'); // dirty worktree: +2 −1
// Second phase switches to this branch (carrying the dirty tree) so the chip label truncates.
const LONG='feature/git-band-source-tooltips-with-an-intentionally-very-long-branch-name-for-truncation';assert.ok(LONG.length>=60);
const RESPONDING_REASON='DeepSeek is working — wait for the turn to finish'; // git-rail-model COMMIT_RESPONDING_REASON: the assistant word of the default core (the fixture profile picks none)
await fs.writeFile(path.join(profile,'preferences.json'),JSON.stringify({cwd,theme:'light',mode:'code',model:'fixture',effort:'low',threadIds:[SESSION,SESSION_B],archivedThreadIds:[SESSION_ARCHIVED],displayName:'Fixture',
 // The sidebar lists archived rows from the remembered metadata only (session-engine-model.mjs partitionSessions), as composer-states seeds it.
 threadMetadata:{[SESSION_ARCHIVED]:{id:SESSION_ARCHIVED,name:'Git band archived session',cwd,createdAt:now-10,updatedAt:now-10}}}));
await fs.writeFile(path.join(profile,'fixture-threads.json'),JSON.stringify({next:100,threads:{[SESSION]:{id:SESSION,cwd,name:'Git band verification',createdAt:now,updatedAt:now,turns:[],archived:false},
 [SESSION_B]:{id:SESSION_B,cwd,name:'Git band second session',createdAt:now-5,updatedAt:now-5,turns:[],archived:false},
 [SESSION_ARCHIVED]:{id:SESSION_ARCHIVED,cwd,name:'Git band archived session',createdAt:now-10,updatedAt:now-10,turns:[],archived:true}}}));
const turnStarts=async()=>{try{return (await fs.readFile(path.join(profile,'fixture-requests.jsonl'),'utf8')).split('\n').filter(line=>line&&JSON.parse(line).method==='turn/start').length;}catch(error){if(error.code==='ENOENT')return 0;throw error;}};
const build=JSON.parse(await fs.readFile(path.join(root,'dist/build-info.json'),'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');let testHash;
async function integrity(){assert.equal(sha(JSON.stringify(build.sources)),build.sourceSha256);for(const file of build.sources)assert.equal(sha(await fs.readFile(path.join(root,file.path))),file.sha256);
 for(const required of ['src/source-git-status.jsx','src/source-git-rail.jsx','src/git-rail-model.mjs','src/source-tooltip.jsx','src/source-toast.jsx','src/main.jsx'])assert.ok(build.sources.some(e=>e.path===required),'Build does not identify '+required);
 const h=sha(await fs.readFile(path.join(root,'scripts/git-band-ui-test.mjs')));if(testHash)assert.equal(h,testHash);else testHash=h;}
const report={at:new Date().toISOString(),directory,build:{version:build.version,sourceSha256:build.sourceSha256},checks:[],metrics:{},rendererErrors:[],clipboardSaved:false,clipboardRestored:false,passed:false};let app,page,phase='launch';
const step=name=>{phase=name;console.log('GITBAND '+name);};
const poll=async(fn,label,ms=10000)=>{const end=Date.now()+ms;for(;;){try{if(await fn())return;}catch{}if(Date.now()>end)throw Error('Timed out: '+label);await new Promise(r=>setTimeout(r,40));}};
const env={...process.env,CODE_DESKTOP_DATA:profile,CODEX_HOME:path.join(profile,'codex-home'),CODEX_BINARY:path.join(root,'tests/fixtures/codex-server.cjs')};delete env.ELECTRON_RUN_AS_NODE;delete env.CODE_DESKTOP_DEV_URL;
const live='.source-tooltip-popup:not([data-state="ending"])';
// An open, settled CDS tooltip whose label is exactly `label`.
const tooltip=label=>page.waitForFunction(({live,label})=>{const n=document.querySelector(live);return !!n&&n.dataset.state==='open'&&n.querySelector('.source-tooltip-label')?.textContent===label;},{live,label},{timeout:4000});
const tipCount=()=>page.locator(live).count();
async function neutral(){await page.mouse.move(700,160);await page.locator('.source-tooltip-popup').waitFor({state:'detached',timeout:4000});}
// Longer than the 300ms open delay plus the 120ms transition: any tooltip would be showing by now.
const settle=()=>page.waitForTimeout(900);
const titles=()=>page.locator('nav.sg-status').evaluate(n=>[...n.querySelectorAll('[title]')].map(e=>e.outerHTML.slice(0,120)));
const toasts=()=>page.locator('.source-toast-card:not([data-phase="ending"]) .source-toast-message').allTextContents();
const clipboardText=()=>app.evaluate(({clipboard})=>clipboard.readText());
async function shot(name){await page.screenshot({path:path.join(directory,name+'.png')});}
try{
 await integrity();
 app=await electron.launch({args:[root],executablePath:path.join(root,'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),env,timeout:20000});page=await app.firstWindow();page.setDefaultTimeout(10000);page.on('pageerror',e=>report.rendererErrors.push({phase,message:e.message}));
 assert.equal(await app.evaluate(()=>!!globalThis.offscreenClipboard),true,'git band suite requires the offscreen in-memory clipboard');
 // Save every clipboard format (the adapter's isolated store) and restore it in finally.
 await app.evaluate(async({clipboard,ClipboardItem})=>{const originals=await clipboard.read();globalThis.gitBandClipboard=await Promise.all(originals.map(async item=>new ClipboardItem(Object.fromEntries(await Promise.all(item.types.map(async type=>[type,await item.getType(type)]))))));});report.clipboardSaved=true;
 await page.locator(`[data-source-session-id="${SESSION}"] .source-session-open`).click();const row=page.locator('.sg-row');await row.waitFor();
 await page.locator('.loading-state').waitFor({state:'detached'});await page.evaluate(()=>document.fonts.ready);await page.mouse.move(700,160);

 step('band');assert.equal(await row.locator('.sg-added').textContent(),'+2');assert.equal(await row.locator('.sg-removed').textContent(),'−1');
 const repoName=path.basename(cwd);assert.equal(await row.locator('.sg-repo').textContent(),repoName);assert.equal(await row.locator('.sg-branch').getAttribute('aria-label'),'main');
 assert.deepEqual(await titles(),[]);report.metrics.band=await row.evaluate(el=>({height:el.offsetHeight,width:el.getBoundingClientRect().width}));
 report.checks.push('The band above the composer shows the real repo (+2 −1 on main) and nav.sg-status contains no [title] element');

 // F12 review (git-status-card.js:1116 `onMouseDown: Mn` = preventDefault on Commit): pressing the enabled Commit does
 // not take focus from the composer. The pointer is released away from the button, so no Commit turn is sent.
 step('commit-focus');const composer=page.getByRole('textbox',{name:'Message DeepSeek',exact:true});await composer.focus();
 assert.equal(await row.locator('.sg-action').isEnabled(),true,'Commit is enabled on the dirty idle session');const startsBeforeFocus=await turnStarts();
 const commitBox=await row.locator('.sg-action').boundingBox();await page.mouse.move(commitBox.x+commitBox.width/2,commitBox.y+commitBox.height/2);await page.mouse.down();
 report.metrics.commitMouseDown=await page.evaluate(()=>({onCommit:!!document.activeElement?.closest?.('.sg-action'),tag:document.activeElement?.tagName??null}));
 report.metrics.commitMouseDown.composerFocused=await composer.evaluate(el=>el===document.activeElement||el.contains(document.activeElement));
 await page.mouse.move(700,160);await page.mouse.up();
 assert.deepEqual({onCommit:report.metrics.commitMouseDown.onCommit,composerFocused:report.metrics.commitMouseDown.composerFocused},{onCommit:false,composerFocused:true},'pressing Commit keeps the composer focused');
 await page.waitForTimeout(300);assert.equal(await turnStarts(),startsBeforeFocus,'no Commit turn was sent');
 report.checks.push('Pressing the enabled Commit keeps keyboard focus in the composer (onMouseDown preventDefault, git-status-card 1116)');

 // F12 review (git-pr-slot.js:5861-5990 cm, git-status-card.js:2816-2962 Na): A→B→A between two dirty sessions. On the
 // return to A its held snapshot ([data-prbar-stale], min-height = A's measured band) renders until A's status arrives,
 // so neither the composer nor the top of the band column moves by the band height on any frame.
 step('switch-hold');const liveBand=page.locator('.sg-row:not(.sg-row-stale)');
 const columnGeometry=()=>page.evaluate(()=>{const composerNode=document.querySelector('.sc-composer'),nav=document.querySelector('nav.sg-status');const composerTop=composerNode.getBoundingClientRect().top;
  return {composerTop,columnTop:nav?nav.getBoundingClientRect().top:composerTop,bandHeight:nav?nav.getBoundingClientRect().height:0};});
 const holdA=await columnGeometry();assert.ok(holdA.bandHeight>20,'A shows its band: '+JSON.stringify(holdA));report.metrics.holdA=holdA;
 await page.locator(`[data-source-session-id="${SESSION_B}"] .source-session-open`).click();
 await page.locator(`[data-source-session-id="${SESSION_B}"] .source-session-open[aria-current="page"]`).waitFor();
 await poll(async()=>await liveBand.count()===1&&await page.locator('[data-prbar-stale]').count()===0,'B shows its own live band');
 await page.locator('.loading-state').waitFor({state:'detached'});await page.waitForTimeout(300);report.metrics.holdB=await columnGeometry();
 await page.evaluate(()=>{const samples=[];window.gitBandHold={samples,clickAt:null,running:true,staleSeen:false};
  document.addEventListener('click',()=>{if(window.gitBandHold.clickAt===null)window.gitBandHold.clickAt=performance.now();},{capture:true,once:true});
  new MutationObserver((_,observer)=>{if(document.querySelector('[data-prbar-stale]'))window.gitBandHold.staleSeen=true;if(!window.gitBandHold.running)observer.disconnect();}).observe(document.body,{childList:true,subtree:true,attributes:true});
  const tick=()=>{const composerNode=document.querySelector('.sc-composer'),nav=document.querySelector('nav.sg-status'),composerTop=composerNode?composerNode.getBoundingClientRect().top:null;
   samples.push({t:performance.now(),composerTop,columnTop:nav?nav.getBoundingClientRect().top:composerTop,stale:!!document.querySelector('[data-prbar-stale]'),live:!!document.querySelector('.sg-row:not(.sg-row-stale)')});
   if(window.gitBandHold.running)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
 await page.locator(`[data-source-session-id="${SESSION}"] .source-session-open`).click();
 await page.locator(`[data-source-session-id="${SESSION}"] .source-session-open[aria-current="page"]`).waitFor();
 await poll(async()=>await liveBand.count()===1&&await page.locator('[data-prbar-stale]').count()===0,'A shows its live band again',8000);
 await page.locator('.loading-state').waitFor({state:'detached'});await page.waitForTimeout(300);
 const hold=await page.evaluate(()=>{window.gitBandHold.running=false;const {samples,clickAt,staleSeen}=window.gitBandHold;return {clickAt,staleSeen,samples:samples.filter(sample=>clickAt!==null&&sample.t>clickAt)};});
 const missing=hold.samples.filter(sample=>sample.composerTop===null).length;
 const drift=key=>Math.max(...hold.samples.filter(sample=>sample[key]!==null).map(sample=>Math.abs(sample[key]-holdA[key])));
 report.metrics.switchHold={frames:hold.samples.length,staleFrames:hold.samples.filter(sample=>sample.stale).length,staleSeen:hold.staleSeen,missing,
  composerDrift:drift('composerTop'),columnDrift:drift('columnTop'),bandHeight:holdA.bandHeight,final:await columnGeometry()};
 assert.ok(hold.samples.length>=2,'frames were sampled after the switch back to A: '+hold.samples.length);assert.equal(missing,0,'the composer stays mounted');
 assert.ok(hold.staleSeen||report.metrics.switchHold.staleFrames>0,'the held [data-prbar-stale] snapshot rendered on the return to A');
 assert.ok(report.metrics.switchHold.composerDrift<holdA.bandHeight/2,'composer top moved by the band height: '+JSON.stringify(report.metrics.switchHold));
 assert.ok(report.metrics.switchHold.columnDrift<holdA.bandHeight/2,'band column top moved by the band height: '+JSON.stringify(report.metrics.switchHold));
 assert.equal(await row.locator('.sg-added').textContent(),'+2');await shot('switch-hold-return');await page.mouse.move(700,160);
 report.checks.push(`A→B→A between two dirty sessions: on the return to A the inert [data-prbar-stale] snapshot holds the band slot until A's status arrives; over ${report.metrics.switchHold.frames} sampled frames the composer top drifted ${report.metrics.switchHold.composerDrift}px and the band column top ${report.metrics.switchHold.columnDrift}px (band ${holdA.bandHeight}px)`);

 step('view-changes');await row.locator('.sg-diff').hover();await tooltip('View changes');report.metrics.viewChangesSingle=await page.locator(live).evaluate(n=>n.classList.contains('source-tooltip-single'));assert.equal(report.metrics.viewChangesSingle,true);
 assert.deepEqual(await titles(),[]);await shot('view-changes-tooltip');await neutral();
 report.checks.push("Hovering +2 −1 shows the single-line CDS tooltip 'View changes' (K, git-status-card 1296-1318)");

 step('short-branch');await row.locator('.sg-branch').hover();await settle();assert.equal(await tipCount(),0,'an untruncated branch label has no tooltip');
 report.metrics.shortBranch=await row.locator('.sg-branch > span').evaluate(n=>({scrollWidth:n.scrollWidth,clientWidth:n.clientWidth}));assert.ok(report.metrics.shortBranch.scrollWidth<=report.metrics.shortBranch.clientWidth);await neutral();
 report.checks.push('The short branch chip (main, not truncated) shows no tooltip after the open delay');

 step('repo-tooltip');await row.locator('.sg-repo').hover();await tooltip(cwd);await shot('repo-tooltip');
 report.checks.push('The repo chip shows the cwd tooltip because the cwd differs from the repo name (D: tooltip only when !== repoName)');

 step('repo-menu');await row.locator('.sg-repo').click();const menu=page.getByRole('menu',{name:'Repository options',exact:true});await menu.waitFor();
 assert.equal(await row.locator('.sg-repo').getAttribute('aria-expanded'),'true');await settle();assert.equal(await tipCount(),0,'no repo tooltip while its menu is open');
 const box=await row.locator('.sg-repo').boundingBox();await page.mouse.move(box.x+box.width/2+2,box.y+box.height/2);await settle();assert.equal(await tipCount(),0,'re-hovering the chip with its menu open shows no tooltip');
 const rows=await menu.evaluate(n=>[...n.querySelectorAll('[role=menuitem],[role=separator]')].map(e=>e.getAttribute('role')==='separator'?'---':e.textContent.trim()));report.metrics.repoMenu=rows;
 assert.deepEqual(rows,['Show in Finder','---','Copy path','---','Open in terminal']);assert.deepEqual(await titles(),[]);await shot('repo-menu');
 // F12 git-chips D/M: side bottom, align start, so the popup's left edge is the chip's left edge.
 report.metrics.repoMenuAlign=await page.evaluate(()=>({chip:document.querySelector('.sg-repo').getBoundingClientRect().left,menu:document.querySelector('[role=menu]').getBoundingClientRect().left,below:document.querySelector('[role=menu]').getBoundingClientRect().top>=document.querySelector('.sg-repo').getBoundingClientRect().bottom,above:document.querySelector('[role=menu]').getBoundingClientRect().bottom<=document.querySelector('.sg-repo').getBoundingClientRect().top,roomBelow:innerHeight-document.querySelector('.sg-repo').getBoundingClientRect().bottom,menuHeight:document.querySelector('[role=menu]').getBoundingClientRect().height}));
 assert.ok(Math.abs(report.metrics.repoMenuAlign.chip-report.metrics.repoMenuAlign.menu)<=1,'repo menu start-aligned: '+JSON.stringify(report.metrics.repoMenuAlign));// The B08 three-item menu no longer fits under a band at the window's bottom: side bottom flips to top on collision (Base UI flip), as in the reference.
 const fitsBelow=report.metrics.repoMenuAlign.roomBelow>=report.metrics.repoMenuAlign.menuHeight;assert.equal(fitsBelow?report.metrics.repoMenuAlign.below:report.metrics.repoMenuAlign.above,true,'repo menu below the chip, or flipped above when it does not fit: '+JSON.stringify(report.metrics.repoMenuAlign));
 report.checks.push('With the repo menu open no tooltip shows (open:false); the menu is Show in Finder | separator | Copy path | separator | Open in terminal (Ko/qo, B08 cd5a31703 Hle bt), start-aligned with the chip within 1px, below it or flipped above when it does not fit; Show in Finder is not clicked so no native shell call happens');

 step('copy-path');assert.deepEqual(await toasts(),[]);await menu.getByRole('menuitem',{name:'Copy path',exact:true}).click();await menu.waitFor({state:'detached'});
 await poll(async()=>(await toasts()).length>0,'copy path toast');await page.waitForTimeout(300);assert.deepEqual(await toasts(),['Path copied to clipboard.']);
 assert.equal(await clipboardText(),cwd);report.metrics.pathToastVariant=await page.locator('.source-toast-card').first().getAttribute('data-variant');assert.equal(report.metrics.pathToastVariant,'neutral');await shot('copy-path-toast');await neutral();
 report.checks.push("Copy path writes the cwd through navigator.clipboard.writeText (in-memory clipboard) and raises exactly one neutral toast 'Path copied to clipboard.'");

 step('long-branch');git('checkout','-q','-b',LONG);assert.match(git('status','--porcelain'),/change\.txt/);
 // The band refetches on window focus (main.jsx focus → gitRefresh); the real handler runs, only the event is synthetic.
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await poll(async()=>await row.locator('.sg-branch').getAttribute('aria-label')===LONG,'band shows the long branch');
 report.metrics.longBranch=await row.locator('.sg-branch').evaluate(n=>[...n.querySelectorAll('.sg-branch-split > span')].map(s=>({text:s.textContent,scrollWidth:s.scrollWidth,clientWidth:s.clientWidth})));
 assert.equal(report.metrics.longBranch.length,2);assert.equal(report.metrics.longBranch[1].text,LONG.slice(-10));assert.ok(report.metrics.longBranch[0].scrollWidth>report.metrics.longBranch[0].clientWidth,'the head label is truncated');
 assert.deepEqual(await titles(),[]);await row.locator('.sg-branch').hover();await tooltip(LONG);await shot('long-branch-tooltip');
 report.checks.push(`After a real branch switch to a ${LONG.length}-char name the truncated chip shows its full name as a CDS tooltip (M: V only when scrollWidth > clientWidth)`);

 step('branch-menu');await row.locator('.sg-branch').click();const branchMenu=page.getByRole('menu',{name:'Branch options',exact:true});await branchMenu.waitFor();await settle();assert.equal(await tipCount(),0,'no branch tooltip while its menu is open');
 report.metrics.branchMenuAlign=await page.evaluate(()=>({chip:document.querySelector('.sg-branch').getBoundingClientRect().left,menu:document.querySelector('[role=menu]').getBoundingClientRect().left}));
 assert.ok(Math.abs(report.metrics.branchMenuAlign.chip-report.metrics.branchMenuAlign.menu)<=1,'branch menu start-aligned: '+JSON.stringify(report.metrics.branchMenuAlign));
 await branchMenu.getByRole('menuitem',{name:'Copy branch name',exact:true}).click();await branchMenu.waitFor({state:'detached'});
 await poll(async()=>(await toasts()).includes('Branch name copied to clipboard.'),'copy branch toast');assert.equal((await toasts()).filter(t=>t==='Branch name copied to clipboard.').length,1);
 assert.equal(await clipboardText(),LONG);await shot('copy-branch-toast');await neutral();
 report.checks.push("With the branch menu open no tooltip shows; Copy branch name writes the full branch and raises one toast 'Branch name copied to clipboard.'");

 step('running');await page.getByRole('textbox',{name:'Message DeepSeek',exact:true}).fill('fixture:hold');await page.locator('[data-testid="code-prompt-send"]:not([inert] *)').click();
 await poll(async()=>await row.locator('.sg-action').isDisabled(),'Commit disabled while responding');await neutral();
 const described=await row.locator('.sg-action').evaluate(el=>{const wrap=el.closest('.source-tooltip-disabled-trigger'),id=wrap?.getAttribute('aria-describedby'),reason=id&&document.getElementById(id);return {wrapped:!!wrap,tabIndex:wrap?.tabIndex,hidden:reason?.hidden,marker:reason?.hasAttribute('data-cds-disabled-reason'),text:reason?.textContent,title:el.getAttribute('title')};});
 report.metrics.disabledCommit=described;assert.deepEqual(described,{wrapped:true,tabIndex:0,hidden:true,marker:true,text:RESPONDING_REASON,title:null});assert.deepEqual(await titles(),[]);
 await row.locator('.source-tooltip-disabled-trigger').hover();await tooltip(RESPONDING_REASON);assert.equal(await page.locator(live).evaluate(n=>n.classList.contains('source-tooltip-multiline')),true);await shot('running-disabled-reason');
 report.checks.push('During a held turn the disabled Commit sits in the Pu wrapper (tabindex 0, aria-describedby → hidden data-cds-disabled-reason) and hovering shows the multiline reason');
 await neutral();await row.locator('.sg-diff').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains('source-tooltip-disabled-trigger')),true);await tooltip(RESPONDING_REASON);
 report.checks.push(`Keyboard focus on the disabled Commit wrapper shows '${RESPONDING_REASON}'`);
 await page.mouse.move(700,160);await page.getByRole('textbox',{name:'Message DeepSeek',exact:true}).focus();

 // F12 (git-status-card 4725/4912-4960, 5565-5567): commit the work on the branch; the band keeps +2 −1 for the
 // branch (merge-base with origin/main) and Commit is disabled with 'No changes to commit' (clean tree wins over responding).
 step('after-commit');git('add','-A');git('commit','-qm','Fixture commit');assert.equal(git('status','--porcelain').trim(),'');
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await poll(async()=>await row.locator('.sg-action').evaluate(el=>{const wrap=el.closest('.source-tooltip-disabled-trigger'),id=wrap?.getAttribute('aria-describedby');return el.disabled&&!!id&&document.getElementById(id)?.textContent==='No changes to commit';}),'Commit disabled as clean after the commit');
 assert.equal(await row.count(),1,'the band stays after the commit');assert.equal(await row.locator('.sg-added').textContent(),'+2');assert.equal(await row.locator('.sg-removed').textContent(),'−1');
 report.metrics.afterCommitPaint=await row.locator('.sg-action').evaluate(el=>({variant:el.dataset.variant,paint:getComputedStyle(el.querySelector('[data-cds-part=paint]')).backgroundColor,shadow:getComputedStyle(el.querySelector('[data-cds-part=paint]')).boxShadow}));
 assert.equal(report.metrics.afterCommitPaint.variant,'secondary');assert.notEqual(report.metrics.afterCommitPaint.paint,'rgba(0, 0, 0, 0)','secondary fill paint');assert.match(report.metrics.afterCommitPaint.shadow,/inset/,'field ring');
 await shot('after-commit');
 report.checks.push("After a real commit on the branch the band stays with +2 −1 (merge-base with origin/main) and the secondary Commit is disabled with 'No changes to commit'");

 // F12 review (git-status-card.js:4962-4977): every Commit send failure is the xr danger toast and nothing else. The
 // archived session (same checkout, dirtied again) has an enabled Commit; sendCommitTurn's archived precondition fails
 // before any turn/start, with no app error banner.
 step('commit-failure-toast');await fs.writeFile(path.join(cwd,'toast.txt'),'dirty again\n');
 await page.getByRole('button',{name:/^Filter(?: \(active\))?$/}).click();const filterMenu=page.getByRole('menu',{name:'Filter sessions',exact:true});
 await filterMenu.getByRole('menuitem',{name:/^Status/}).click();await page.getByRole('menu',{name:'Status',exact:true}).getByRole('menuitemradio',{name:'Archived',exact:true}).click();
 await filterMenu.waitFor({state:'detached'});await page.locator(`[data-source-session-id="${SESSION_ARCHIVED}"] .source-session-open`).click();
 await page.getByRole('button',{name:'Restore session',exact:true}).waitFor();
 const archivedCommit=page.locator('.sg-row:not(.sg-row-stale) .sg-action');
 await poll(async()=>await archivedCommit.count()===1&&await archivedCommit.isEnabled(),'Commit enabled on the dirty archived session');
 const startsBeforeToast=await turnStarts();assert.equal(await page.locator('.composer-error').count(),0);
 await archivedCommit.click();await poll(async()=>(await toasts()).includes(COMMIT_FAILED),'commit failure toast');
 report.metrics.commitFailureToast={variant:await page.locator('.source-toast-card:not([data-phase="ending"])',{hasText:COMMIT_FAILED}).first().getAttribute('data-variant'),
  matching:(await toasts()).filter(text=>text===COMMIT_FAILED).length,errorBanners:await page.locator('.composer-error').count(),turnStarts:await turnStarts()-startsBeforeToast};
 assert.deepEqual(report.metrics.commitFailureToast,{variant:'danger',matching:1,errorBanners:0,turnStarts:0});await shot('commit-failure-toast');
 report.checks.push(`Commit on an archived session raises exactly one danger toast '${COMMIT_FAILED}' with no app error banner and no turn/start`);

 assert.deepEqual(report.rendererErrors,[]);await integrity();report.passed=true;
}catch(error){report.failure=error.stack;report.phase=phase;process.exitCode=1;if(page)await shot('failure').catch(()=>{});}
finally{
 if(app&&report.clipboardSaved){try{await app.evaluate(async({clipboard})=>{const saved=globalThis.gitBandClipboard;if(!saved)throw Error('Clipboard backup unavailable');if(saved.length)await clipboard.write(saved);else await clipboard.clear();delete globalThis.gitBandClipboard;});report.clipboardRestored=true;}catch(error){report.clipboardRestoreError=String(error);report.passed=false;process.exitCode=1;}}
 if(app)await app.close().catch(()=>{});const bytes=JSON.stringify(report,null,2)+'\n';await fs.writeFile(path.join(directory,'report.json'),bytes);await fs.writeFile(path.join(evidence,'git-band-ui-report.json'),bytes);console.log(bytes);}
