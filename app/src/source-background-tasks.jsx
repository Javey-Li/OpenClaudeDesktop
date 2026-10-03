import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Icon} from './icons.jsx';
import {SourceSettingsButton} from './source-settings-button.jsx';
import {dismissedTasks,taskOutput,taskSections} from './background-tasks-model.mjs';
import { SourceAnsiText } from './source-ansi-text.jsx';
import { SourceCommandLine } from './source-command.jsx';
import { taskOutputFollow } from './task-output-follow.mjs';
import './source-background-tasks.css';
const KEY='codeDesktop.dismissedTasks';const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{};}catch{return {};}};
export function SourceTaskOutput({task,sessionId}) {
  const output=useRef(null), key=JSON.stringify([sessionId,task.id]), text=taskOutput(task.output || '');
  useLayoutEffect(()=>{taskOutputFollow.update(key,output.current);},[key,text]);
  return <div className="sbt-detail">
    {task.command&&<div role="region" tabIndex={0} aria-label={'Command for '+task.description} className="sbt-command">
      <SourceCommandLine command={task.command} scopeKey={key}/>
    </div>}
    {task.output?<pre ref={output} role="region" tabIndex={0} aria-label={'Output for '+task.description}
      onScroll={e=>taskOutputFollow.record(key,e.currentTarget)}><SourceAnsiText text={text}/></pre>
      :<span>{task.summary&&task.summary!==task.description?task.summary:task.status==='running'?'No output yet':task.status==='unknown'?'Output unavailable':'No output captured.'}</span>}
  </div>;
}
function Elapsed({task}){const [now,setNow]=useState(Date.now);useEffect(()=>{if(task.status!=='running'||!Number.isFinite(task.startedAt))return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[task.status,task.startedAt]);const ms=task.status==='running'&&Number.isFinite(task.startedAt)?Math.max(0,now-task.startedAt):task.durationMs;return Number.isFinite(ms)?<span className="sbt-time">{Math.floor(ms/60000)>0?`${Math.floor(ms/60000)}m `:''}{Math.floor(ms/1000)%60}s</span>:null;}
export function SourceBackgroundTasks({tasks,sessionId,onOpen,onStop,renderWorkflow,focusTask,onFocusDone,error,finishedExpanded=false,onFinishedExpanded}){
 const [dismissed,setDismissed]=useState(read),[expanded,setExpanded]=useState(()=>new Set()),[stopping,setStopping]=useState({}),[notice,setNotice]=useState(''),root=useRef(null),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const runningIds=tasks.filter(t=>t.status==='running').map(t=>t.id),visible=tasks.filter(t=>t.status==='running'||!dismissed[sessionId]?.includes(t.id)),sections=taskSections(visible);
 useEffect(()=>{const ids=dismissed[sessionId]||[];if(!runningIds.some(id=>ids.includes(id)))return;const next=dismissedTasks(dismissed,sessionId,[],runningIds);setDismissed(next);try{localStorage.setItem(KEY,JSON.stringify(next));}catch{}},[runningIds.join('\0'),sessionId]);
 useEffect(()=>{if(tasks.some(t=>t.status==='stopped'&&stopping[t.id]))setNotice('Task stopped');setStopping(old=>{const settled=Object.keys(old).filter(id=>tasks.find(t=>t.id===id)?.status!=='running');if(!settled.length)return old;const next={...old};for(const id of settled)delete next[id];return next;});},[tasks,stopping]);
 useEffect(()=>{if(!focusTask)return;setExpanded(old=>new Set([...old,focusTask]));if(sections.finished.some(t=>t.id===focusTask))onFinishedExpanded(true);const frame=requestAnimationFrame(()=>{root.current?.querySelector(`[data-task-id="${CSS.escape(focusTask)}"]`)?.scrollIntoView({block:'start'});onFocusDone?.();});return()=>cancelAnimationFrame(frame);},[focusTask]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),5000);return()=>clearTimeout(timer);},[notice]);
 async function stop(task){if(stopping[task.id])return;root.current?.focus();setStopping(v=>({...v,[task.id]:true}));setNotice('Stop requested…');try{await onStop(task);}catch(e){if(alive.current){setStopping(v=>{const next={...v};delete next[task.id];return next;});setNotice('Couldn’t stop the task — check your connection and try again. '+e.message);}}}
 function clear(){const next=dismissedTasks(dismissed,sessionId,sections.finished.map(t=>t.id),runningIds);setDismissed(next);try{localStorage.setItem(KEY,JSON.stringify(next));}catch{}root.current?.focus();}
 const row=task=>task.kind==='workflow'?<React.Fragment key={task.id}>{renderWorkflow(task)}</React.Fragment>:<TaskCard key={task.id} task={task} sessionId={sessionId} expanded={expanded.has(task.id)} stopping={!!stopping[task.id]} onStop={()=>stop(task)} onOpen={onOpen} onToggle={()=>setExpanded(value=>{const next=new Set(value);next.has(task.id)?next.delete(task.id):next.add(task.id);return next;})}/>;
 return <div ref={root} className="sbt-root" tabIndex={-1}><span role="status" className="source-sr-only">{notice}</span>{error&&<p role="alert" className="sbt-error">{error}</p>}{!visible.length?<div className="sbt-empty"><Icon name="AgentsSimple" size={28}/><span>Background tasks appear here</span></div>:<div className="sbt-content">{sections.running.length>0&&<section><h3>Running</h3><div className="sbt-list">{sections.running.map(row)}</div></section>}{sections.unknown.length>0&&<section><h3>Status unavailable</h3><div className="sbt-list">{sections.unknown.map(row)}</div></section>}{sections.finished.length>0&&<section><div className="sbt-section-heading"><h3><button aria-expanded={finishedExpanded} onClick={()=>onFinishedExpanded(!finishedExpanded)}>Finished <span>{sections.finished.length}</span><Icon name="CaretRight" size={12} className={finishedExpanded?'sbt-finished-caret sbt-open':'sbt-finished-caret'}/></button></h3><SourceSettingsButton className="sbt-clear" size="sm" variant="ghost" icon="Trash" iconSize="auto" iconOnly aria-label="Clear finished tasks" onClick={clear}/></div>{finishedExpanded&&<div className="sbt-list">{sections.finished.map(row)}</div>}</section>}</div>}</div>;
}

// Ub: metadata is one padded column; only expandable cards own hover paint.
function TaskCard({task,sessionId,expanded,stopping,onStop,onOpen,onToggle}) {
 const running=task.status==='running',expandable=task.kind==='bash';
 const hasDetails=!!task.model||Number.isFinite(task.tokens)||Number.isFinite(task.toolUses)||(running&&!!task.lastTool)||task.kind==='agent';
 const title=<><span data-cds="ShimmerText" className={running?'source-shimmer':''}>{task.description}</span>{expandable&&<span className="sbt-caret-slot"><Icon name="CaretRight" size={12} style={{fontSize:'calc(.75rem * var(--cds-rem-scale, 1))'}} className={expanded?'sbt-caret sbt-open':'sbt-caret'}/></span>}</>;
 return <div data-task-id={task.id} className="sbt-card" data-status={task.status} data-expandable={expandable||undefined}>
  <div className="sbt-card-body"><div className="sbt-top">
   {expandable?<button className="sbt-title" aria-label={'Background task: '+task.description} aria-expanded={expanded} onClick={onToggle}>{title}</button>:<span className="sbt-title">{title}</span>}
   {running&&(task.kind==='bash'||task.turnId)&&<SourceSettingsButton size="sm" variant="secondary" icon="Stop" iconSize="auto" iconOnly className="sbt-stop epitaxy-task-row-secondary" aria-label="Stop this task" busy={stopping} disabled={stopping} onClick={onStop}/>}
  </div><div className="sbt-metadata"><div className="sbt-meta">
   <span className="sbt-kind">{task.kind==='agent'?'Agent':'Bash'}</span>
   {!running&&<span className={task.status==='failed'?'sbt-failed':''}>{({completed:'Completed',failed:'Failed',stopped:'Stopped',unknown:'Status unavailable'})[task.status]}</span>}
   <Elapsed task={task}/>
  </div>{hasDetails&&<div className="sbt-meta">
   {task.model&&<span className="sbt-value">{task.model}</span>}
   {Number.isFinite(task.tokens)&&<span><span className="sbt-value">{task.tokens.toLocaleString()}</span> tokens</span>}
   {Number.isFinite(task.toolUses)&&<span><span className="sbt-value">{task.toolUses}</span> tool {task.toolUses===1?'use':'uses'}</span>}
   {running&&task.lastTool&&<span>{task.lastTool}</span>}
   {task.kind==='agent'&&<button className="sbt-link epitaxy-task-row-secondary" aria-label={'View transcript for '+task.description} onClick={event=>onOpen(task.sourceItem||{},task.threadId,event.currentTarget)}>View transcript</button>}
  </div>}</div></div>
  {expanded&&expandable&&<SourceTaskOutput task={task} sessionId={sessionId}/>}
 </div>;
}
