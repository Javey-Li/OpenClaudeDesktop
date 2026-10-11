import { t } from '../electron/i18n/index.mjs';
import {connectionInterrupted} from "./item-observation.mjs";
import {agentTargets,agentView} from './agent-model.mjs';
import {commandRowState} from './command-row-model.mjs';
import {commandText} from './shell-command-model.mjs';
export function backgroundTasks(state,sessionId,{connected=true}={}) {
 const items=state.items?.[sessionId]||[],snapshot=state.background?.[sessionId]?.connectionId===state.approvalConnectionId?state.background?.[sessionId]:undefined,terminals=snapshot?.terminals||[],tasks=[];
 const spawns=items.filter(item=>item.type==='collabAgentToolCall'&&item.tool==='spawnAgent');
 const children=new Set([...spawns.flatMap(agentTargets),...(state.childThreads?.[sessionId]||[]).filter(id=>state.threads?.[id]?.source?.subAgent?.thread_spawn)]);
 for(const id of children){const item=spawns.find(item=>agentTargets(item).includes(id));const agent=agentView(state,item||{},id),facts=state.taskTurnFacts?.[id];tasks.push({id:'agent:'+id,kind:'agent',threadId:id,sourceItem:item,description:agent.name,status:!connected&&agent.status==='running'?'unknown':agent.status,
  // codeDesktop.stoppable false on the sub-agent's thread: the core can't stop that one alone (MiMo's actors share
  // their parent's session), so no Stop is offered.
  ...(state.threads?.[id]?.codeDesktop?.stoppable===false?{stoppable:false}:{}),
  turnId:state.active?.[id],model:agent.model,tokens:state.usage?.[id]?.total?.totalTokens,toolUses:Object.hasOwn(state.items||{},id)?agent.toolCallCount:null,lastTool:agent.latestToolName,summary:agent.result,
  startedAt:Number.isFinite(facts?.startedAt)?facts.startedAt*1000:null,completedAt:Number.isFinite(facts?.completedAt)?facts.completedAt*1000:null,durationMs:facts?.durationMs});}
 const commands=new Map(items.filter(item=>item.type==='commandExecution'&&item.processId).map(item=>[item.id,item]));
 for(const terminal of [...Object.values(snapshot?.knownTerminals||{}),...terminals])if(!commands.has(terminal.itemId))commands.set(terminal.itemId,null);
 for(const [id,item] of commands){const terminal=terminals.find(t=>t.itemId===id&&(!item||t.processId===item.processId));const record=terminal||snapshot?.knownTerminals?.[id];const phase=item&&!item[connectionInterrupted]?commandRowState(item):null;
  const terminalStatus={done:'completed',failed:'failed',stopped:'stopped',denied:'failed'}[phase];
  const start=state.backgroundStarts?.[sessionId]?.[id];
  const newerStart=phase==='busy'&&start?.connectionId===state.approvalConnectionId&&start?.processId===item.processId&&snapshot?.coveredProcesses&&snapshot.coveredProcesses[id]!==item.processId;
  const status=terminalStatus||(!connected||snapshot?.error?'unknown':terminal||newerStart?'running':snapshot?'unknown':phase==='busy'?'running':'unknown');
  // codeDesktop.stoppable false: the core can't stop it (Kimi's background sub-agents), so no Stop is offered.
  const stoppable=record?.codeDesktop?.stoppable!==false;
  // codeDesktop.kind: what the core says the process is (a Monitor, a sub-agent…; Claude's taskType names work too).
  const taskType=typeof record?.codeDesktop?.kind==='string'?record.codeDesktop.kind:typeof item?.codeDesktop?.taskKind==='string'?item.codeDesktop.taskKind:null;
  tasks.push({id:'bash:'+id,kind:'bash',...(taskType?{taskType}:{}),threadId:sessionId,itemId:id,processId:item?.processId||record?.processId,description:commandText(item?.command||record?.command)||t('Command'),command:item?.command||record?.command,output:item?.aggregatedOutput||'',status,...(stoppable?{}:{stoppable:false}),
   startedAt:Number.isFinite(item?.startedAtMs)?item.startedAtMs:null,completedAt:Number.isFinite(item?.completedAtMs)?item.completedAtMs:null,durationMs:item?.durationMs});
 }
 return tasks;
}
export function taskSections(tasks){const order=new Map(tasks.map((task,index)=>[task,index]));return {running:tasks.filter(t=>t.status==='running').sort((a,b)=>(a.startedAt??Infinity)-(b.startedAt??Infinity)),unknown:tasks.filter(t=>t.status==='unknown'),finished:tasks.filter(t=>['completed','failed','stopped'].includes(t.status)).sort((a,b)=>(b.completedAt??-Infinity)-(a.completedAt??-Infinity)||order.get(b)-order.get(a))};}
export function taskOutput(text){return text.length>8000?`${t('… ({count} chars truncated)',{count:text.length-8000})}\n${text.slice(-8000)}`:text;}
export function dismissedTasks(map,sessionId,ids,running=[]){const entries=Object.entries(map||{}).filter(([id,value])=>id!==sessionId&&Array.isArray(value)).slice(-99);const restored=new Set(running);return {...Object.fromEntries(entries),[sessionId]:[...new Set([...(map?.[sessionId]||[]),...ids])].filter(id=>typeof id==='string'&&!restored.has(id)).slice(-1000)};}

// Sb / xb (panes-tile-current.js:14494-14520): the kind a task row names. Claude's taskType values map onto the
// seven labels; anything else is a plain "Task".
const TASK_TYPES={local_agent:'agent',in_process_teammate:'agent',remote_agent:'remote_agent',local_bash:'bash',local_workflow:'workflow',monitor_mcp:'monitor',monitor_ws:'monitor',dream:'dream'};
const TASK_KINDS=['agent','remote_agent','bash','workflow','monitor','dream','task'];
export function taskKind(task){const raw=task?.taskType??task?.kind;return TASK_KINDS.includes(raw)?raw:TASK_TYPES[raw]??'task';}
export function taskKindLabel(task){return ({agent:t('Agent'),remote_agent:t('Remote agent'),bash:t('Bash'),workflow:t('Workflow'),monitor:t('Monitor'),dream:t('Dream'),task:t('Task')})[taskKind(task)];}
/** qb (panes-tile-current.js:15192-15265): the session's preview servers that are up, starting or failed, for the
 * Running section. Stopped servers are not tasks. */
export function previewServerTasks(state){return (state?.servers??[]).filter(server=>['running','starting','stopping','failed'].includes(server?.status)).map(server=>({id:'preview:'+server.name,name:server.name,port:server.port??null,status:server.status==='failed'?'error':server.status,startedAt:Number.isFinite(server.startedAt)?server.startedAt:null}));}

// OpenClaude Desktop's own background sources (electron/monitor-service.cjs, schedule-service.cjs), pushed by main.
/** A session's Monitor commands as Background tasks rows: Claude's monitor_mcp tasks (kind "Monitor", expandable output, Stop). */
export function monitorTasks(list){return (Array.isArray(list)?list:[]).filter(entry=>entry&&typeof entry.id==='string').map(entry=>({id:'monitor:'+entry.id,monitorId:entry.id,kind:'bash',taskType:'monitor_mcp',description:entry.description||entry.command||t('Monitor'),command:entry.command,output:entry.output||'',
 status:['running','completed','failed','stopped'].includes(entry.status)?entry.status:'unknown',startedAt:Number.isFinite(entry.startedAt)?entry.startedAt:null,completedAt:Number.isFinite(entry.startedAt)&&Number.isFinite(entry.durationMs)?entry.startedAt+entry.durationMs:null,durationMs:Number.isFinite(entry.durationMs)?entry.durationMs:undefined}));}
/** Kb (panes-tile-current.js:15081-15190): a session's scheduled prompts as Loop / Once rows of the Running section. */
export function scheduledLoops(list){return (Array.isArray(list)?list:[]).filter(entry=>entry&&typeof entry.id==='string').map(entry=>({id:entry.id,prompt:typeof entry.prompt==='string'&&entry.prompt?entry.prompt:null,recurring:entry.recurring!==false,cron:entry.cron??null,humanSchedule:entry.humanSchedule??null,
 nextFireAt:Number.isFinite(entry.nextFireAt)?entry.nextFireAt:null,expiresAt:Number.isFinite(entry.expiresAt)?entry.expiresAt:null}));}
/** 'Ends {days}d': whole days left before a recurring loop expires, at least 1. */
export function loopDaysLeft(loop,now=Date.now()){return Number.isFinite(loop?.expiresAt)?Math.max(1,Math.round((loop.expiresAt-now)/864e5)):null;}
