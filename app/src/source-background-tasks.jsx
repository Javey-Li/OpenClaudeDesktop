import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Icon} from './icons.jsx';
import {SourceSettingsButton} from './source-settings-button.jsx';
import {dismissedTasks,loopDaysLeft,monitorTasks,previewServerTasks,scheduledLoops,taskKindLabel,taskOutput,taskSections} from './background-tasks-model.mjs';
import { formatDuration } from './command-row-model.mjs';
import { SourceAnsiText } from './source-ansi-text.jsx';
import { SourceCommandLine } from './source-command.jsx';
import { taskOutputFollow } from './task-output-follow.mjs';
import { t } from '../electron/i18n/index.mjs';
import './source-background-tasks.css';
import { localizeBridgeText } from './bridge-text-model.mjs';
const KEY='codeDesktop.dismissedTasks';const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{};}catch{return {};}};
export function SourceTaskOutput({task,sessionId}) {
  const output=useRef(null), key=JSON.stringify([sessionId,task.id]), text=taskOutput(task.output || '');
  useLayoutEffect(()=>{taskOutputFollow.update(key,output.current);},[key,text]);
  return <div className="sbt-detail">
    {task.command&&<div role="region" tabIndex={0} aria-label={t('Command for {task}',{task:task.description})} className="sbt-command">
      <SourceCommandLine command={task.command} scopeKey={key}/>
    </div>}
    {task.output?<pre ref={output} role="region" tabIndex={0} aria-label={t('Output for {task}',{task:task.description})}
      onScroll={e=>taskOutputFollow.record(key,e.currentTarget)}><SourceAnsiText text={text}/></pre>
      :<span>{task.summary&&task.summary!==task.description?task.summary:task.status==='running'?t('No output yet'):task.status==='unknown'?t('Output unavailable'):t('No output captured.')}</span>}
  </div>;
}
function Elapsed({task}){const [now,setNow]=useState(Date.now);useEffect(()=>{if(task.status!=='running'||!Number.isFinite(task.startedAt))return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[task.status,task.startedAt]);const ms=task.status==='running'&&Number.isFinite(task.startedAt)?Math.max(0,now-task.startedAt):task.durationMs;return Number.isFinite(ms)?<span className="sbt-time">{formatDuration(ms/1000)}</span>:null;}
// Tb: a running preview server's uptime, in the UI language (formatDuration is the transcript timer's wording).
function Uptime({startedAt}){const [now,setNow]=useState(Date.now);useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);return <span className="sbt-time">{formatDuration(Math.max(0,now-startedAt)/1000)}</span>;}
// The session folder's preview servers (preview-service.cjs state), pushed as they change.
function usePreviewServers(sessionId,desktop){const [servers,setServers]=useState([]);useEffect(()=>{setServers([]);if(!sessionId||!desktop?.call)return undefined;let live=true;desktop.call('preview-state',{sessionId}).then(state=>{if(live)setServers(previewServerTasks(state));},()=>{});const off=desktop.onEvent?.(event=>{if(event?.kind==='preview'&&event.sessionId===sessionId&&event.state)setServers(previewServerTasks(event.state));});return()=>{live=false;off?.();};},[sessionId,desktop]);return servers;}
// The session's Monitor commands and scheduled prompts (electron/monitor-service.cjs, schedule-service.cjs), pushed as they change.
function useAppFeed(sessionId,desktop,action,kind,key){const [list,setList]=useState([]);useEffect(()=>{setList([]);if(!sessionId||!desktop?.call)return undefined;let live=true;desktop.call(action,{sessionId}).then(value=>{if(live&&Array.isArray(value))setList(value);},()=>{});const off=desktop.onEvent?.(event=>{if(event?.kind===kind&&event.sessionId===sessionId&&Array.isArray(event[key]))setList(event[key]);});return()=>{live=false;off?.();};},[sessionId,desktop,action,kind,key]);return list;}
// 'Next <v>{countdown}</v>' / 'Ends <v>{days}d</v>': the translated sentence with its value in the secondary colour.
function Valued({text,value}){const [before,after='']=text.split('\u0000');return <span>{before}<span className="sbt-value">{value}</span>{after}</span>;}
function Countdown({at}){const [now,setNow]=useState(Date.now);useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);return <span className="sbt-time"><Valued text={t('Next {countdown}',{countdown:'\u0000'})} value={formatDuration(Math.max(0,at-now)/1000)}/></span>;}
// Kb (panes-tile-current.js:15081-15190): "Loop" / "Once", the cadence, Next {countdown} and, for a loop, Ends {days}d.
export function LoopCard({loop,stopping,onStop}){const once=!loop.recurring,title=loop.prompt??(once?t('Scheduled prompt'):t('Recurring loop')),days=once?null:loopDaysLeft(loop);
 return <div className="sbt-card" data-status="running" data-loop={loop.id}><div className="sbt-card-body"><div className="sbt-top">
  <span className="sbt-title" tabIndex={-1} aria-label={once?t('Once: {description}',{description:title}):t('Loop: {description}',{description:title})}><span data-cds="ShimmerText" className="source-shimmer">{title}</span></span>
  {onStop&&<SourceSettingsButton size="sm" variant="secondary" icon="Stop" iconSize="auto" iconOnly className="sbt-stop epitaxy-task-row-secondary" aria-label={stopping?t('Stop requested…'):once?t('Stop this scheduled prompt'):t('Stop this loop')} busy={stopping} disabled={stopping} onClick={onStop}/>}
 </div><div className="sbt-metadata"><div className="sbt-meta">
  <span className="sbt-kind">{once?t('Once'):t('Loop')}</span>
  <span role="status" className="source-sr-only">{stopping?t('Stop requested…'):null}</span>
  {stopping?<span aria-hidden="true">{t('Stop requested…')}</span>:null}
  {(loop.humanSchedule??loop.cron)?<span>{loop.humanSchedule??loop.cron}</span>:null}
 </div><div className="sbt-meta">
  {Number.isFinite(loop.nextFireAt)&&<Countdown at={loop.nextFireAt}/>}
  {days!==null&&<Valued text={t('Ends {days}d',{days:'\u0000'})} value={String(days)}/>}
 </div></div></div></div>;}
// qb (panes-tile-current.js:15192-15265) inside Wb: "Preview" · Starting…/Failed · uptime, then localhost:port.
function PreviewServerCard({server,stopping,onStop}){const failed=server.status==='error';
 return <div className="sbt-card" data-status={failed?'failed':'running'} data-preview-server={server.name}><div className="sbt-card-body"><div className="sbt-top">
  <span className="sbt-title" tabIndex={-1} aria-label={t('Preview server: {name}',{name:server.name})}><span data-cds="ShimmerText" className={failed?'':'source-shimmer'}>{server.name}</span></span>
  {onStop&&<SourceSettingsButton size="sm" variant="secondary" icon="Stop" iconSize="auto" iconOnly className="sbt-stop epitaxy-task-row-secondary" aria-label={stopping?t('Stopping server…'):t('Stop this server')} busy={stopping} disabled={stopping} onClick={onStop}/>}
 </div><div className="sbt-metadata"><div className="sbt-meta">
  <span className="sbt-kind">{t('Preview')}</span>
  <span role="status" className="source-sr-only">{stopping?t('Stopping…'):null}</span>
  {stopping?<span aria-hidden="true">{t('Stopping…')}</span>:server.status==='starting'?<span>{t('Starting…')}</span>:failed?<span className="sbt-failed">{t('Failed')}</span>:null}
  {!failed&&Number.isFinite(server.startedAt)&&<Uptime startedAt={server.startedAt}/>}
 </div>{server.port?<div className="sbt-meta"><span>{`localhost:${server.port}`}</span></div>:null}</div></div></div>;}
export function SourceBackgroundTasks({tasks:coreTasks,sessionId,onOpen,onStop,renderWorkflow,focusTask,onFocusDone,error,finishedExpanded=false,onFinishedExpanded,desktop=globalThis.desktop}){
 // Monitor commands are tasks of their own (Claude's monitor_mcp rows); scheduled prompts are Loop / Once rows.
 const monitorFeed=useAppFeed(sessionId,desktop,'monitor-state','monitors','monitors'),loops=scheduledLoops(useAppFeed(sessionId,desktop,'schedule-state','schedules','jobs')),[stoppingLoops,setStoppingLoops]=useState(()=>new Set());
 const tasks=React.useMemo(()=>[...coreTasks,...monitorTasks(monitorFeed)],[coreTasks,monitorFeed]);
 useEffect(()=>{setStoppingLoops(old=>{const next=new Set([...old].filter(id=>loops.some(loop=>loop.id===id)));return next.size===old.size?old:next;});},[loops.map(loop=>loop.id).join('\0')]);
 const stopLoop=loop=>{if(!desktop?.call||stoppingLoops.has(loop.id))return;root.current?.focus();setStoppingLoops(old=>new Set([...old,loop.id]));desktop.call('schedule-stop',{sessionId,id:loop.id}).catch(e=>{if(!alive.current)return;setStoppingLoops(old=>{const next=new Set(old);next.delete(loop.id);return next;});setNotice(localizeBridgeText(e?.message||''));});};
 const servers=usePreviewServers(sessionId,desktop),[stoppingServers,setStoppingServers]=useState(()=>new Set());
 // A stop settles when the server leaves the list (stopped) or fails.
 useEffect(()=>{setStoppingServers(old=>{const next=new Set([...old].filter(id=>servers.some(server=>server.id===id&&server.status!=='error')));return next.size===old.size?old:next;});},[servers]);
 const stopServer=server=>{if(!desktop?.call||stoppingServers.has(server.id))return;root.current?.focus();setStoppingServers(old=>new Set([...old,server.id]));desktop.call('preview-server-stop',{sessionId,name:server.name}).catch(e=>{if(!alive.current)return;setStoppingServers(old=>{const next=new Set(old);next.delete(server.id);return next;});setNotice(localizeBridgeText(e?.message||''));});};
 const [dismissed,setDismissed]=useState(read),[expanded,setExpanded]=useState(()=>new Set()),[stopping,setStopping]=useState({}),[notice,setNotice]=useState(''),root=useRef(null),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const runningIds=tasks.filter(t=>t.status==='running').map(t=>t.id),visible=tasks.filter(t=>t.status==='running'||!dismissed[sessionId]?.includes(t.id)),sections=taskSections(visible);
 useEffect(()=>{const ids=dismissed[sessionId]||[];if(!runningIds.some(id=>ids.includes(id)))return;const next=dismissedTasks(dismissed,sessionId,[],runningIds);setDismissed(next);try{localStorage.setItem(KEY,JSON.stringify(next));}catch{}},[runningIds.join('\0'),sessionId]);
 useEffect(()=>{if(tasks.some(t=>t.status==='stopped'&&stopping[t.id]))setNotice(t('Task stopped'));setStopping(old=>{const settled=Object.keys(old).filter(id=>tasks.find(t=>t.id===id)?.status!=='running');if(!settled.length)return old;const next={...old};for(const id of settled)delete next[id];return next;});},[tasks,stopping]);
 useEffect(()=>{if(!focusTask)return;setExpanded(old=>new Set([...old,focusTask]));if(sections.finished.some(t=>t.id===focusTask))onFinishedExpanded(true);const frame=requestAnimationFrame(()=>{root.current?.querySelector(`[data-task-id="${CSS.escape(focusTask)}"]`)?.scrollIntoView({block:'start'});onFocusDone?.();});return()=>cancelAnimationFrame(frame);},[focusTask]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),5000);return()=>clearTimeout(timer);},[notice]);
 async function stop(task){if(stopping[task.id])return;root.current?.focus();setStopping(v=>({...v,[task.id]:true}));setNotice(t('Stop requested…'));try{if(task.monitorId&&desktop?.call)await desktop.call('monitor-stop',{sessionId,id:task.monitorId});else await onStop(task);}catch(e){if(alive.current){setStopping(v=>{const next={...v};delete next[task.id];return next;});setNotice(t('Couldn’t stop the task — check your connection and try again.')+' '+localizeBridgeText(e.message));}}}
 function clear(){const next=dismissedTasks(dismissed,sessionId,sections.finished.map(t=>t.id),runningIds);setDismissed(next);try{localStorage.setItem(KEY,JSON.stringify(next));}catch{}root.current?.focus();}
 const row=task=>task.kind==='workflow'?<React.Fragment key={task.id}>{renderWorkflow(task)}</React.Fragment>:<TaskCard key={task.id} task={task} sessionId={sessionId} expanded={expanded.has(task.id)} stopping={!!stopping[task.id]} onStop={()=>stop(task)} onOpen={onOpen} onToggle={()=>setExpanded(value=>{const next=new Set(value);next.has(task.id)?next.delete(task.id):next.add(task.id);return next;})}/>;
 return <div ref={root} className="sbt-root" tabIndex={-1}><span role="status" className="source-sr-only">{notice}</span>{error&&<p role="alert" className="sbt-error">{error}</p>}{!visible.length&&!servers.length&&!loops.length?<div className="sbt-empty"><Icon name="AgentsSimple" size={28}/><span>{t('Background tasks appear here')}</span></div>:<div className="sbt-content">{(sections.running.length>0||servers.length>0||loops.length>0)&&<section><h3>{t('Running')}</h3><div className="sbt-list">{servers.map(server=><PreviewServerCard key={server.id} server={server} stopping={stoppingServers.has(server.id)} onStop={desktop?.call?()=>stopServer(server):undefined}/>)}{loops.map(loop=><LoopCard key={'loop:'+loop.id} loop={loop} stopping={stoppingLoops.has(loop.id)} onStop={desktop?.call?()=>stopLoop(loop):undefined}/>)}{sections.running.map(row)}</div></section>}{sections.unknown.length>0&&<section><h3>{t('Status unavailable')}</h3><div className="sbt-list">{sections.unknown.map(row)}</div></section>}{sections.finished.length>0&&<section><div className="sbt-section-heading"><h3><button aria-expanded={finishedExpanded} onClick={()=>onFinishedExpanded(!finishedExpanded)}>{t('Finished')} <span>{sections.finished.length}</span><Icon name="CaretRight" size={12} className={finishedExpanded?'sbt-finished-caret sbt-open':'sbt-finished-caret'}/></button></h3><SourceSettingsButton className="sbt-clear" size="sm" variant="ghost" icon="Trash" iconSize="auto" iconOnly aria-label={t('Clear finished tasks')} onClick={clear}/></div>{finishedExpanded&&<div className="sbt-list">{sections.finished.map(row)}</div>}</section>}</div>}</div>;
}

// Ub: metadata is one padded column; only expandable cards own hover paint.
function TaskCard({task,sessionId,expanded,stopping,onStop,onOpen,onToggle}) {
 const running=task.status==='running',expandable=task.kind==='bash';
 const hasDetails=(running&&task.stoppable===false)||!!task.model||Number.isFinite(task.tokens)||Number.isFinite(task.toolUses)||(running&&!!task.lastTool)||task.kind==='agent';
 const title=<><span data-cds="ShimmerText" className={running?'source-shimmer':''}>{task.description}</span>{expandable&&<span className="sbt-caret-slot"><Icon name="CaretRight" size={12} style={{fontSize:'calc(.75rem * var(--cds-rem-scale, 1))'}} className={expanded?'sbt-caret sbt-open':'sbt-caret'}/></span>}</>;
 return <div data-task-id={task.id} className="sbt-card" data-status={task.status} data-expandable={expandable||undefined}>
  <div className="sbt-card-body"><div className="sbt-top">
   {expandable?<button className="sbt-title" aria-label={t('Background task: {task}',{task:task.description})} aria-expanded={expanded} onClick={onToggle}>{title}</button>:<span className="sbt-title">{title}</span>}
   {running&&task.stoppable!==false&&(task.kind==='bash'||task.turnId)&&<SourceSettingsButton size="sm" variant="secondary" icon="Stop" iconSize="auto" iconOnly className="sbt-stop epitaxy-task-row-secondary" aria-label={t('Stop this task')} busy={stopping} disabled={stopping} onClick={onStop}/>}
  </div><div className="sbt-metadata"><div className="sbt-meta">
   <span className="sbt-kind">{taskKindLabel(task)}</span>
   {!running&&<span className={task.status==='failed'?'sbt-failed':''}>{({completed:t('Completed'),failed:t('Failed'),stopped:t('Stopped'),unknown:t('Status unavailable')})[task.status]}</span>}
   <Elapsed task={task}/>
  </div>{hasDetails&&<div className="sbt-meta">
   {task.model&&<span className="sbt-value">{task.model}</span>}
   {Number.isFinite(task.tokens)&&<span><span className="sbt-value">{task.tokens.toLocaleString()}</span> {t('tokens')}</span>}
   {Number.isFinite(task.toolUses)&&<span><span className="sbt-value">{task.toolUses}</span> {task.toolUses===1?t('tool use'):t('tool uses')}</span>}
   {running&&task.lastTool&&<span>{task.lastTool}</span>}
   {running&&task.stoppable===false&&<span className="sbt-hint">{t('Ask DeepSeek to stop this task, or end the session.')}</span>}
   {task.kind==='agent'&&<button className="sbt-link epitaxy-task-row-secondary" aria-label={t('View transcript for {task}',{task:task.description})} onClick={event=>onOpen(task.sourceItem||{},task.threadId,event.currentTarget)}>{t('View transcript')}</button>}
  </div>}</div></div>
  {expanded&&expandable&&<SourceTaskOutput task={task} sessionId={sessionId}/>}
 </div>;
}
