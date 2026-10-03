import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSessionCommand as parse,matchCommands,rateLimitRows,sessionCommands,commandUnavailable,unsupportedCommand,slashSkills,planCommandAction} from '../src/session-command-model.mjs';
import {emptyState,reduce} from '../src/state.js';
// Claude 2.2553.1 cc183b3ab/shared-11: canonical host names, gates and
// completion semantics replace the former Codex TUI palette expectations.
const ready={current:'a',connected:true,hasHistory:true};
test('official aliases and argument errors preserve host routing',()=>{
 for(const [input,id] of [['stats','usage'],['new','clear'],['settings','config'],['name','rename'],['continue','resume'],['bashes','tasks'],['allowed-tools','permissions'],['plugins','plugin']])assert.equal(parse('/'+input).id,id);
 assert.equal(parse('/fork A new path').args,'A new path');
 assert.match(parse('/review first\nthen second').error,/only works on a single line/);
 assert.match(parse('/unknown').error,/isn’t a command here/);assert.match(parse('/compact now').error,/doesn’t take arguments here/);
 assert.equal(parse('/compac').suggestion,'compact');assert.equal(parse('/zzzzzz').suggestion,null);
});
test('catalog contains only executable host actions; unavailable rows disappear',()=>{
 for(const id of ['skills','mcp','plugin'])assert.equal(commandUnavailable(sessionCommands.find(c=>c.id===id),{}),'');
 assert.equal(matchCommands('/market',{})[0].id,'plugin');
 assert.equal(matchCommands('connectors',{}).length,0,'descriptions are not command names');
 assert.equal(matchCommands('status',{}).length,0);
 assert.equal(matchCommands('status',{...ready,running:true}).length,0);
 assert.equal(matchCommands('fast',{...ready,fastAvailable:false}).length,0);
 for(const c of [{}, {...ready,archived:true},{...ready,connected:false},{...ready,running:true},{...ready,pending:true}])assert.ok(commandUnavailable(sessionCommands[0],c));
 assert.equal(commandUnavailable(sessionCommands[0],ready),'');
});
test('paths and prose stay ordinary input; slash multi-line is a command error',()=>{
 for(const text of ['/Users/test/project','//not-a-command','Please /review this','```\n/compact\n```'])assert.equal(parse(text),null);
 assert.match(parse('/status\nnew paragraph').error,/single line/);
});
test('rank is exact name, exact alias, name prefix, alias prefix, substring; spaces close exact commands',()=>{
 assert.equal(matchCommands('/co',ready)[0].id,'compact');assert.equal(matchCommands('/sett',ready)[0].matchedAlias,'settings');
 assert.equal(matchCommands('new',ready)[0].id,'clear');assert.deepEqual(matchCommands('compact ',ready),[]);assert.deepEqual(matchCommands('fork prompt',ready),[]);
 assert.deepEqual(matchCommands('x'.repeat(51),ready),[]);
});
test('rate limits prefer explicit buckets, preserve unknown and zero, clamp invalid ranges',()=>{
 assert.deepEqual(rateLimitRows(null),[]);assert.deepEqual(rateLimitRows({rateLimits:{primary:null}}),[]);
 const rows=rateLimitRows({rateLimits:{primary:{usedPercent:99}},rateLimitsByLimitId:{codex:{limitName:'Codex',primary:{usedPercent:0,windowDurationMins:300,resetsAt:123},secondary:{usedPercent:140,windowDurationMins:10080,resetsAt:null}}}});
 assert.equal(rows[0].remaining,100);assert.equal(rows[0].label,'Codex · 5 hours');assert.equal(rows[1].remaining,0);assert.equal(rows[1].resetsAt,null);
});
test('operation events belong to current connection; real compaction start stays busy and failed turn cannot appear successful',()=>{
 let state={...emptyState,approvalConnectionId:'c',approvalConnectionEpoch:1};
 state=reduce(state,{event:{kind:'session-operation',threadId:'a',operation:'compact',phase:'running',connectionId:'old',connectionEpoch:1}});assert.equal(state.operations.a,undefined);
 state=reduce(state,{event:{kind:'session-operation',threadId:'a',operation:'compact',phase:'running',connectionId:'c',connectionEpoch:1}});assert.equal(state.operations.a.phase,'running');
 state=reduce(state,{event:{method:'item/started',params:{threadId:'a',turnId:'t',item:{id:'i',type:'contextCompaction'}}}});assert.equal(state.items.a[0].status,'inProgress');
 state=reduce(state,{event:{method:'turn/completed',params:{threadId:'a',turn:{id:'t',status:'interrupted'}}}});assert.equal(state.items.a[0].status,'interrupted');
});
// boot.core.capabilities.unsupportedMethods (DeepSeek bridge initialize): the
// command's core request is unavailable, checked before every other gate.
test('unsupported core methods disable fork, review and rewind first; the slash menu drops them',()=>{
 const reason='Not available with the DeepSeek core yet';
 assert.ok(commandUnavailable({id:'rewind',session:true,idle:true},{current:'t',connected:true,hasHistory:true,unsupportedMethods:['thread/revert']}));
 const deepseek={current:'t',connected:true,hasHistory:true,unsupportedMethods:['thread/fork','review/start','thread/revert']};
 for(const [id,method] of [['fork','thread/fork'],['review','review/start'],['rewind','thread/revert']]){
  const command=sessionCommands.find(c=>c.id===id);
  assert.equal(commandUnavailable(command,{current:'t',connected:true,hasHistory:true,unsupportedMethods:[method]}),reason,id);
  assert.equal(commandUnavailable(command,{...deepseek,unsupportedMethods:[]}),'',id+' with a capable core');
  assert.equal(commandUnavailable(command,{unsupportedMethods:[method]}),reason,id+' is checked before the session gates');
  assert.equal(unsupportedCommand(id,deepseek),reason);assert.equal(unsupportedCommand(id,{}),'');
 }
 assert.deepEqual(matchCommands('rew',deepseek),[]);assert.equal(matchCommands('rew',ready)[0].id,'rewind');
 assert.deepEqual(matchCommands('fork',deepseek),[]);assert.deepEqual(matchCommands('review',deepseek),[]);
 for(const id of ['compact','status','export'])assert.equal(commandUnavailable(sessionCommands.find(c=>c.id===id),deepseek),'',id+' stays available');
 assert.equal(unsupportedCommand('compact',{unsupportedMethods:['thread/compact/start']}),'','only fork, review and rewind map to core methods');
});

// Fidelity F05: skills in '/' (cc183b3ab-BNeMUZS1.js:619-700 supported commands include user-invocable skills).
const skills=[{name:'pdf',description:'Read and write PDFs',argumentHint:'[file]',path:'/s/pdf/SKILL.md'},{name:'review',description:'shadowed',path:'/s/review/SKILL.md'},{name:'Bad Name',path:'/s/bad/SKILL.md'},{name:'nopath'},{name:'fx:lint',path:'/p/lint/SKILL.md'}];
test('skills join the slash list after the host commands; a built-in name and non-token names stay out',()=>{
 assert.deepEqual(slashSkills(skills).map(s=>s.name),['pdf','fx:lint']);
 const rows=matchCommands('pd',{skills});
 assert.deepEqual(rows.find(r=>r.id==='pdf'),{id:'pdf',description:'Read and write PDFs',argumentHint:'[file]',kind:'skill',path:'/s/pdf/SKILL.md',matchedAlias:null});
 const all=matchCommands('',{...ready,skills});assert.deepEqual(all.filter(r=>r.kind==='skill').map(r=>r.id),['pdf','fx:lint']);assert.equal(all.findIndex(r=>r.kind==='skill'),all.length-2,'skills follow the commands');
 assert.equal(matchCommands('review',{...ready,skills}).filter(r=>r.id==='review').length,1,'the host review command keeps its name');
 assert.deepEqual(matchCommands('pdf ',{skills}),[],'a typed space after a known skill closes the menu');
});
test('a known skill parses with no error and exposes the skill; unknown names still error',()=>{
 const parsed=parse('/pdf summarize this',{skills});
 assert.equal(parsed.error,null);assert.equal(parsed.skill.name,'pdf');assert.equal(parsed.skill.path,'/s/pdf/SKILL.md');assert.equal(parsed.args,'summarize this');assert.equal(parsed.command,null);
 assert.equal(parse('/pdf',{skills}).args,'');
 assert.equal(parse('/pdf first\nsecond',{skills}).error,null,'a skill message may span lines');
 assert.match(parse('/pdf summarize').error,/isn’t a command here/,'without the skill list the name is unknown');
 assert.match(parse('/nope',{skills}).error,/isn’t a command here/);
 assert.equal(parse('/review x',{skills}).command.id,'review','a host command wins over a same-named skill');
 assert.equal(parse('/fx:lint src',{skills}).skill.name,'fx:lint','a plugin-qualified skill name parses whole');
 assert.equal(parse('/pdf:x',{skills}).error,'/pdf isn’t a command here.','a longer token is not the pdf skill');
});
// cc43287c9-BMbiZYzF.js:28880-28916 vG.
test('/plan follows vG: switch, pane, draft and the already-in-plan notices',()=>{
  const plan=(arg,extra={})=>planCommandAction({arg,currentMode:'auto',canOpenPane:true,...extra});
  const run=(switchToPlan,openPane,notice,composerText)=>({kind:'run',switchToPlan,openPane,notice,composerText});
  assert.deepEqual(plan(''),run(true,false,null,null),'not planning, no plan: switch only');
  assert.deepEqual(plan('',{hasPlan:true}),run(true,true,null,null),'not planning, a plan: switch and open the pane');
  assert.deepEqual(plan('Explain',{hasPlan:true}),run(true,false,null,'Explain'),'a description goes to the draft');
  assert.deepEqual(plan('open'),plan(''),'open and share read as no description');assert.deepEqual(plan('SHARE',{hasPlan:true}),plan('',{hasPlan:true}));
  const planning={currentMode:'plan'};
  assert.deepEqual(plan('',planning),run(false,false,'already_in_plan_no_plan',null));
  assert.deepEqual(plan('',{...planning,hasPlan:true}),run(false,true,null,null),'a written plan opens instead of a notice');
  assert.deepEqual(plan('',{...planning,hasPlan:true,paneAlreadyOpen:true}),run(false,false,'already_in_plan',null));
  assert.deepEqual(plan('',{...planning,hasPlan:true,canOpenPane:false}),run(false,false,'already_in_plan',null));
  assert.deepEqual(plan('Explain',planning),run(false,false,'already_in_plan','Explain'),'a description while planning still warns');
  assert.deepEqual(plan('Explain',{...planning,hasPlan:true}),run(false,true,'already_in_plan','Explain'));
  assert.deepEqual(plan('',{planSelectable:false}),{kind:'unavailable'});
  assert.deepEqual(plan('',{planSelectable:false,hasPlan:true}),run(false,true,null,null));
  assert.deepEqual(plan('Explain',{planSelectable:false,hasPlan:true}),{kind:'unavailable'});
});
