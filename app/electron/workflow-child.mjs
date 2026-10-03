// A dedicated Node process owns the vendor runtime and its Codex connection.
import fs from 'node:fs/promises';
import path from 'node:path';
import {runWorkflowSource,extractMeta} from '../third-party/codex-workflows-runner/src/runWorkflow.js';
import {Journal} from '../third-party/codex-workflows-runner/src/journal.js';
import {codexAgent,getClient,shutdownClient} from '../third-party/codex-workflows-runner/src/codexAgent.js';
import {startCodexSession} from '../third-party/codex-workflows-runner/src/codexSession.js';
let finishing=false;
const send=event=>{if(process.connected)process.send({event,at:Date.now()});};
async function close(code){if(finishing)return;finishing=true;try{await shutdownClient();}finally{process.exit(code);}}
process.once('SIGTERM',()=>void close(143));process.once('disconnect',()=>void close(143));
process.once('message',async options=>{
 try{
  process.chdir(options.cwd);
  const meta=extractMeta(options.source);if(meta)send({type:'metadata',name:typeof meta.name==='string'?meta.name:undefined,description:typeof meta.description==='string'?meta.description:undefined});
  const journal=new Journal(path.join(options.directory,'journal.jsonl'),{reuse:options.resume});await journal.load();
  // commandArgs: the core's arguments (the DeepSeek bridge script + app-server --stdio); absent = the runner's Codex default.
  const clientOptions={command:options.command,...(Array.isArray(options.commandArgs)?{args:options.commandArgs}:{}),clientInfo:{name:'code-desktop-workflows',title:'Code Desktop',version:options.version}};
  if(!options.plan){const client=await getClient(clientOptions);send({type:'connection',pid:client.pid});}
  // Script options cannot elevate the embedding application's read-only policy.
  const controlled=opts=>({...opts,cwd:options.cwd,sandbox:'read-only',clientOptions,pinnedModel:options.model});
  const result=await runWorkflowSource(options.source,{
   args:options.args,plan:options.plan,journal,defaultModel:options.model,pinnedModel:options.model,
   defaults:{cwd:options.cwd,sandbox:'read-only',effort:options.effort,clientOptions},
   runAgent:(prompt,opts)=>codexAgent(prompt,controlled(opts)),
   startSession:opts=>startCodexSession(controlled(opts)),
   onPhase:title=>send({type:'phase',title}),onEvent:send,
   onProgress:(label,text,id)=>send({type:'progress',id,label}),
   onLog:message=>send({type:'log',message:String(message)}),
   onAgentPlan:agent=>send({type:'plan-agent',...agent}),
  });
  const encoded=JSON.stringify(result??null);await fs.writeFile(path.join(options.directory,'result.json'),encoded);
  send({type:'result',result:encoded.length<65536?result:null});await close(0);
 }catch(error){send({type:'failure',error:String(error?.message??error)});await close(1);}
});
