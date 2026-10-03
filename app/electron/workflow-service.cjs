const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{fork}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const idPattern=/^[a-f0-9-]{36}$/;
// The app-server the workflow runner spawns, from codex.cjs resolveCore(): the
// DeepSeek bridge is a Node script that takes `app-server --stdio` (it drops
// both); a Codex binary keeps the runner's default arguments. An explicit
// override binary (CODE_DESKTOP_WORKFLOW_BINARY) wins.
function workflowCoreCommand(core,override){
 if(override)return {command:override};
 if(core?.kind==='deepseek')return {command:core.command,args:[...(core.prefix||[]),'app-server','--stdio']};
 return {command:core?.command};
}
// args: the app-server's own arguments (commandArgs in the child message;
// `args` there are the workflow script's arguments).
function createWorkflowService({root,getConfig,emit,command,args:commandArgs,version,spawn=fork}){
 const running=new Map(),runs=new Map();let disposed=false,starting=0;
 fs.mkdirSync(root,{recursive:true});
 const model=import(pathToFileURL(path.join(__dirname,'../src/workflow-progress-model.mjs')).href);
 const persist=run=>{const dest=path.join(root,run.id,'meta.json');fs.writeFileSync(dest+'.tmp',JSON.stringify(run));fs.renameSync(dest+'.tmp',dest);};
 const ready=(async()=>{const {workflowEvent}=await model;for(const id of fs.readdirSync(root)){if(!idPattern.test(id))continue;try{
   const directory=path.join(root,id),origin=path.join(directory,'origin.json');let run=JSON.parse(fs.readFileSync(fs.existsSync(origin)?origin:path.join(directory,'meta.json'),'utf8'));
   if(run.id!==id||typeof run.threadId!=='string')continue;
   if(fs.existsSync(origin)){try{for(const line of fs.readFileSync(path.join(directory,'events.jsonl'),'utf8').split('\n')){if(!line)continue;let entry;try{entry=JSON.parse(line);}catch{break;}if(entry.sequence!==run.sequence+1||!Number.isFinite(entry.at))break;run=workflowEvent(run,entry.event,entry.at);}}catch{}}
   if(run.status==='running'){run=workflowEvent(run,{type:'settled',status:'failed',recovered:true,error:'The workflow runner is no longer connected. Its exit time is unknown.'},Date.now());persist(run);}
   runs.set(id,run);
  }catch{}}})();
 async function list(threadId){await ready;return [...runs.values()].filter(r=>r.threadId===threadId).sort((a,b)=>a.startedAt-b.startedAt);}
 function trusted(id){if(!idPattern.test(id)||!runs.has(id))throw Error('Unknown workflow.');const run=runs.get(id);if(!getConfig().threadIds.includes(run.threadId))throw Error('Unknown session.');return run;}
 async function startRun({threadId,file,args={},plan=false,resumeId,model:chosenModel,effort,cwd:requestedCwd,after}){
  await ready;if(disposed)throw Error('Application is closing.');const config=getConfig();
  if(!config.dynamicWorkflows)throw Error('Dynamic workflows are disabled.');
  if(!config.threadIds.includes(threadId))throw Error('Choose a session before starting a workflow.');
  if(running.size>=4)throw Error('Four workflows are already running.');
  if(args===null||typeof args!=='object'||Array.isArray(args))throw Error('Workflow arguments must be a JSON object.');
  const cwd=fs.realpathSync(requestedCwd||config.cwd);
  if(typeof file!== 'string'||!file.trim())throw Error('Choose a workflow file.');
  if(!/[\\/]/.test(file)&&! /\.(?:m?js|cjs)$/.test(file)){const dirs=[path.join(cwd,'.claude/workflows'),path.join(require('node:os').homedir(),'.claude/workflows')];const match=dirs.flatMap(dir=>[file+'.js',file+'.workflow.js',file+'.mjs'].map(name=>path.join(dir,name))).find(f=>fs.existsSync(f));if(!match)throw Error('No saved workflow with this name.');file=match;}
  const script=fs.realpathSync(path.resolve(cwd,file));
  if(!/\.(?:m?js|cjs)$/.test(script)||fs.statSync(script).size>1048576)throw Error('Select a JavaScript workflow smaller than 1 MB.');
  const source=fs.readFileSync(script,'utf8'),hash=crypto.createHash('sha256').update(source).update(JSON.stringify(args)).update(cwd).update(chosenModel||'').update(effort||'').digest('hex');
  const id=crypto.randomUUID(),directory=path.join(root,id);fs.mkdirSync(directory);
  if(resumeId){const previous=trusted(resumeId);if(previous.threadId!==threadId||previous.identity!==hash||previous.status==='running'||previous.plan)throw Error('Resume requires the same script, arguments, model and working directory from a finished run.');const journal=path.join(root,resumeId,'journal.jsonl');if(fs.existsSync(journal))fs.copyFileSync(journal,path.join(directory,'journal.jsonl'));}
  fs.writeFileSync(path.join(directory,'source.workflow.js'),source);
  const {workflowEvent}=await model;
  let run={id,threadId,after:typeof after==='string'?after:undefined,identity:hash,file:script,cwd,args,model:chosenModel,effort,plan:!!plan,description:path.basename(script),status:'running',startedAt:Date.now(),sequence:0,workflowProgress:[]};
  runs.set(id,run);fs.writeFileSync(path.join(directory,'origin.json'),JSON.stringify(run));persist(run);emit({kind:'workflow',run});
  function record(event,at=Date.now()) {run=workflowEvent(run,event,at);runs.set(id,run);fs.appendFileSync(path.join(directory,'events.jsonl'),JSON.stringify({sequence:run.sequence,at,event})+'\n');persist(run);emit({kind:'workflow',run});}
  if(disposed){record({type:'settled',status:'failed',error:'Application is closing.'});return run;}
  let child;try{child=spawn(path.join(__dirname,'workflow-child.mjs'),[],{cwd,detached:true,stdio:['ignore','ignore','pipe','ipc'],env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}});}catch(error){record({type:'settled',status:'failed',error:error.message});return run;}
  let stderr='',outcome=null,stopRequested=false,killTimer=null;
  const completion=new Promise(resolve=>{
   child.stderr?.on('data',data=>{stderr=(stderr+data).slice(-8000);});
   child.on('message',message=>{if(!message||!message.event)return;const event=message.event;if(event.type==='result'||event.type==='failure')outcome=event;else record(event,Number.isFinite(message.at)?message.at:Date.now());});
   child.once('error',error=>{outcome={type:'failure',error:error.message};});
   child.once('close',(code,signal)=>{clearTimeout(killTimer);if(child.pid){try{process.kill(-child.pid,'SIGKILL');}catch{}}running.delete(id);const status=stopRequested?'stopped':code===0&&outcome?.type==='result'?'completed':'failed';record({type:'settled',status,result:outcome?.result,error:status==='stopped'?'Stopped':outcome?.error|| (status==='failed'?`Runner exited (${signal||code}). ${stderr}`:undefined)});resolve(run);});
  });
  const stop=()=>{if(stopRequested)return completion;stopRequested=true;try{process.kill(-child.pid,'SIGTERM');}catch{}killTimer=setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}},1500);return completion;};
  running.set(id,{stop,completion,pid:child.pid});
  child.send({directory,source,cwd,args,plan:!!plan,resume:!!resumeId,model:chosenModel,effort,command,commandArgs,version});return run;
 }
 async function start(params){if(running.size+starting>=4)throw Error('Four workflows are already running.');starting++;try{return await startRun(params);}finally{starting--;}}
 async function stop(id){await ready;trusted(id);const entry=running.get(id);if(!entry)throw Error('This workflow is no longer running.');return entry.stop();}
 async function dispose(){disposed=true;await Promise.all([...running.values()].map(r=>r.stop()));}
 return {list,start,stop,dispose,ready};
}
module.exports={createWorkflowService,workflowCoreCommand};
