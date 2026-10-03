import { t } from '../electron/i18n/index.mjs';
import {connectionInterrupted} from "./item-observation.mjs";
import {agentTargets,agentView} from './agent-model.mjs';
import {commandRowState} from './command-row-model.mjs';
export function backgroundTasks(state,sessionId,{connected=true}={}) {
 const items=state.items?.[sessionId]||[],snapshot=state.background?.[sessionId]?.connectionId===state.approvalConnectionId?state.background?.[sessionId]:undefined,terminals=snapshot?.terminals||[],tasks=[];
 const spawns=items.filter(item=>item.type==='collabAgentToolCall'&&item.tool==='spawnAgent');
 const children=new Set([...spawns.flatMap(agentTargets),...(state.childThreads?.[sessionId]||[]).filter(id=>state.threads?.[id]?.source?.subAgent?.thread_spawn)]);
 for(const id of children){const item=spawns.find(item=>agentTargets(item).includes(id));const agent=agentView(state,item||{},id),facts=state.taskTurnFacts?.[id];tasks.push({id:'agent:'+id,kind:'agent',threadId:id,sourceItem:item,description:agent.name,status:!connected&&agent.status==='running'?'unknown':agent.status,
  turnId:state.active?.[id],model:agent.model,tokens:state.usage?.[id]?.total?.totalTokens,toolUses:Object.hasOwn(state.items||{},id)?agent.toolCallCount:null,lastTool:agent.latestToolName,summary:agent.result,
  startedAt:Number.isFinite(facts?.startedAt)?facts.startedAt*1000:null,completedAt:Number.isFinite(facts?.completedAt)?facts.completedAt*1000:null,durationMs:facts?.durationMs});}
 const commands=new Map(items.filter(item=>item.type==='commandExecution'&&item.processId).map(item=>[item.id,item]));
 for(const terminal of [...Object.values(snapshot?.knownTerminals||{}),...terminals])if(!commands.has(terminal.itemId))commands.set(terminal.itemId,null);
 for(const [id,item] of commands){const terminal=terminals.find(t=>t.itemId===id&&(!item||t.processId===item.processId));const record=terminal||snapshot?.knownTerminals?.[id];const phase=item&&!item[connectionInterrupted]?commandRowState(item):null;
  const terminalStatus={done:'completed',failed:'failed',stopped:'stopped',denied:'failed'}[phase];
  const start=state.backgroundStarts?.[sessionId]?.[id];
  const newerStart=phase==='busy'&&start?.connectionId===state.approvalConnectionId&&start?.processId===item.processId&&snapshot?.coveredProcesses&&snapshot.coveredProcesses[id]!==item.processId;
  const status=terminalStatus||(!connected||snapshot?.error?'unknown':terminal||newerStart?'running':snapshot?'unknown':phase==='busy'?'running':'unknown');
  tasks.push({id:'bash:'+id,kind:'bash',threadId:sessionId,itemId:id,processId:item?.processId||record?.processId,description:item?.command||record?.command||t('Command'),command:item?.command||record?.command,output:item?.aggregatedOutput||'',status,
   startedAt:Number.isFinite(item?.startedAtMs)?item.startedAtMs:null,completedAt:Number.isFinite(item?.completedAtMs)?item.completedAtMs:null,durationMs:item?.durationMs});
 }
 return tasks;
}
export function taskSections(tasks){const order=new Map(tasks.map((task,index)=>[task,index]));return {running:tasks.filter(t=>t.status==='running').sort((a,b)=>(a.startedAt??Infinity)-(b.startedAt??Infinity)),unknown:tasks.filter(t=>t.status==='unknown'),finished:tasks.filter(t=>['completed','failed','stopped'].includes(t.status)).sort((a,b)=>(b.completedAt??-Infinity)-(a.completedAt??-Infinity)||order.get(b)-order.get(a))};}
export function taskOutput(text){return text.length>8000?`${t('… ({count} chars truncated)',{count:text.length-8000})}\n${text.slice(-8000)}`:text;}
export function dismissedTasks(map,sessionId,ids,running=[]){const entries=Object.entries(map||{}).filter(([id,value])=>id!==sessionId&&Array.isArray(value)).slice(-99);const restored=new Set(running);return {...Object.fromEntries(entries),[sessionId]:[...new Set([...(map?.[sessionId]||[]),...ids])].filter(id=>typeof id==='string'&&!restored.has(id)).slice(-1000)};}
