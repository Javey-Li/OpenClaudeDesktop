// Input is our embedded engine's actual events, never app-server protocol items.
export function workflowEvent(run,event,at){
 const next={...run,sequence:(run.sequence||0)+1,workflowProgress:(run.workflowProgress||[]).map(p=>({...p}))};
 const progress=next.workflowProgress,agents=progress.filter(p=>p.type==='workflow_agent');
 const phase=(title,fresh=false)=>{let found=!fresh&&progress.findLast(p=>p.type==='workflow_phase'&&p.title===title);if(!found){found={type:'workflow_phase',index:progress.filter(p=>p.type==='workflow_phase').length,title};progress.push(found);}return found;};
 if(event.type==='metadata'){if(event.name)next.name=event.name;if(event.description)next.description=event.description;}
 if(event.type==='phase')phase(String(event.title),true);
 if(['start','end','cached','progress'].includes(event.type)&&event.kind!=='human'&&event.id){
  let agent=agents.find(a=>a.id===event.id);
  if(!agent&&['start','cached'].includes(event.type)){const group=event.phase!=null?phase(String(event.phase)):progress.findLast(p=>p.type==='workflow_phase');agent={type:'workflow_agent',index:agents.length,id:event.id,label:event.label||'Agent',state:event.type==='cached'?'done':'progress',...(group?{phaseIndex:group.index,phaseTitle:group.title}:{}),...(event.type==='start'?{startedAt:at,lastProgressAt:at}:{}),model:event.model||undefined};progress.push(agent);}
  if(agent&&event.type==='progress'&&agent.state==='progress')agent.lastProgressAt=at;
  if(agent&&event.type==='end'){agent.state=event.status&&event.status!=='completed'?'error':'done';agent.error=event.error||(agent.state==='error'?`Agent ${event.status}`:undefined);if(event.model)agent.model=event.model;if(Number.isFinite(event.tokens))agent.tokens=event.tokens;if(Number.isFinite(event.ms))agent.durationMs=event.ms;}
 }
 if(event.type==='settled'){next.status=event.status;next.completedAt=event.recovered?undefined:at;next.durationMs=event.recovered?undefined:Math.max(0,at-run.startedAt);next.summary=event.error;next.result=event.result;for(const p of progress)if(p.type==='workflow_agent'&&p.state==='progress'){p.state='error';p.error=event.status==='stopped'?'Stopped before completion':'Workflow ended before completion';}}
 if(event.type==='plan-agent')next.plannedAgents=(next.plannedAgents||0)+1;
 next.usage={totalTokens:progress.reduce((sum,p)=>sum+(p.tokens||0),0)};
 return next;
}
export const workflowAgentState=(agent,now)=>agent.state==='progress'?(Number.isFinite(agent.lastProgressAt)&&now-agent.lastProgressAt>90000?'stalled':'running'):agent.state==='done'?'done':'error';
export function workflowPhases(run,now){const groups=new Map();for(const p of run.workflowProgress||[]){if(p.type==='workflow_phase')groups.set(p.index,{index:p.index,title:p.title,agents:[]});}
 for(const p of run.workflowProgress||[]){if(p.type!=='workflow_agent')continue;const id=p.phaseIndex??-1;if(!groups.has(id))groups.set(id,{index:id,title:p.phaseTitle||'Agents',agents:[]});groups.get(id).agents.push({...p,displayState:workflowAgentState(p,now)});}
 return [...groups.values()].sort((a,b)=>a.index-b.index).map(p=>({...p,done:p.agents.filter(a=>a.state==='done').length,status:p.agents.some(a=>a.state==='error')?'error':p.agents.some(a=>a.state==='progress')?'running':p.agents.length?'done':'empty',tokens:p.agents.reduce((sum,a)=>sum+(a.tokens||0),0)}));}
export function mergeWorkflow(runs,run){const existing=runs.find(r=>r.id===run.id);if(existing&&existing.sequence>=run.sequence)return runs;return [...runs.filter(r=>r.id!==run.id),run].sort((a,b)=>a.startedAt-b.startedAt);}
export function workflowCells(agents,capacity){if(agents.length<=capacity)return agents;const groups=['done','running','stalled','error'].map(displayState=>({displayState,count:agents.filter(a=>a.displayState===displayState).length})).filter(g=>g.count);const slots=capacity-groups.length;const fractions=groups.map(g=>g.count/agents.length*slots),alloc=fractions.map(n=>Math.floor(n)+1);let left=capacity-alloc.reduce((a,b)=>a+b,0);for(const {i} of fractions.map((v,i)=>({i,f:v-Math.floor(v)})).sort((a,b)=>b.f-a.f)){if(!left--)break;alloc[i]++;}return groups.flatMap((g,i)=>Array.from({length:alloc[i]},()=>({displayState:g.displayState,label:`${g.count} agents`})));}
