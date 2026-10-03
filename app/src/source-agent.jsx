import React, {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Icon} from './icons.jsx';
import {SourceSpark} from './source-spark.jsx';
import {agentTargets,agentView,agentOperationLabel,agentPromptNeeded,agentRowLabel} from './agent-model.mjs';
import {commandRowState} from './command-row-model.mjs';
import {groupFileTools} from './file-tool-model.mjs';
import {reasoningPlacement} from './reasoning-model.mjs';
import './source-agent.css';
import {t} from '../electron/i18n/index.mjs';

export function SourceAgentTool({item,context,inGroup,Step,defaultOpen,forcedOpen,sessionKey,pendingApprovalItemIds}) {
  const targets=agentTargets(item);
  if (item.tool !== 'spawnAgent' || !targets.length || !context) {
    const names=targets.map(id=>context ? agentView(context.state,item,id).name : id).join(', ');
    // K (approval-current.js:16848): a spawn waiting on its Ask-mode card is 'blocked'.
    const state=commandRowState(item,!!pendingApprovalItemIds?.has(item.id));
    // An unstarted spawn (awaiting approval, denied, failed to start) takes the same
    // tensed description label as the agent row below.
    const spawn=item.tool==='spawnAgent' && agentRowLabel(item,names||null,{busy:'running',blocked:'awaiting',done:'completed'}[state] ?? state);
    return <Step item={item} classic caretSize={14} defaultOpen={defaultOpen} forcedOpen={forcedOpen} sessionKey={sessionKey} state={state}
      label={spawn ? spawn.label : agentOperationLabel(item)} meta={(spawn ? spawn.name : names) || undefined}>
      <div role="group" aria-label={t("Tool call details")} className="source-tool-output">
        {item.prompt && <p>{item.prompt}</p>}
        {targets.map(id=><div key={id}>{context && <button className="sag-link" onClick={event=>context.onOpen(item,id,event.currentTarget)}>{agentView(context.state,item,id).name}</button>}
          {item.agentsStates?.[id]?.message && <pre>{item.agentsStates[id].message}</pre>}</div>)}
      </div>
    </Step>;
  }
  return targets.map(id=>{
    const agent=agentView(context.state,item,id),running=agent.status==='running';
    const card=running && !agent.toolCallCount && !inGroup, row=agentRowLabel(item,agent.name,agent.status);
    const open=event=>context.onOpen(item,id,event.currentTarget);
    return <div key={id} className={`source-message sag ${card?'sag-card-wrap':''}`} data-transcript-item-id={item.id} data-agent-thread-id={id} data-agent-state={agent.status}>
      <div role="button" tabIndex={0} data-transcript-keeps-pin="" className={`sag-trigger ${card?'sag-card':''}`} onClick={open}
        onKeyDown={event=>{if(event.target===event.currentTarget && ['Enter',' '].includes(event.key)){event.preventDefault();open(event);}}}>
        {card ? <><span className="sag-surface"/><Icon name="AgentsSimple" size={16}/><span className="sag-description source-shimmer">{agent.name}</span></> : <>
          {/* :17112-17126: label = Ie ?? verb (Ie truncates in a min-w-0 slot); the meta
              only when !Ie. :17127-17131 he: the model whenever known, muted once settled. */}
          <span className={`sag-verb ${running?'source-shimmer':''}`} data-described={row.described ? "" : undefined}>{row.label}</span>
          {row.name && <span className="sag-name" title={row.name}>{row.name}</span>}
          {agent.model && <span className="sag-model">{agent.model}</span>}
          {running && agent.toolCallCount>0 && <span className="sag-activity">{agent.model?'· ':''}{agent.latestToolName} · {agent.toolCallCount}</span>}
          {agent.status==='stopped' && <span className="sag-outcome">{t("Stopped")}</span>}
        </>}
        {running && <span className="source-sr-only">{t("running")}</span>}
        <Icon name="CaretRight" size={16} className="sag-caret"/>
      </div>
    </div>;
  });
}

function AgentTranscript({agent,item,renderItem,loading,error,transcriptView}) {
  const [now,setNow]=useState(Date.now());
  const until=agent.status==='completed' && !agent.items.length && !agent.result && agent.completedObservedAt ? agent.completedObservedAt+2500 : 0;
  useEffect(()=>{setNow(Date.now());if(until>Date.now()){const timer=setTimeout(()=>setNow(Date.now()),until-Date.now());return()=>clearTimeout(timer);}},[until]);
  const running=agent.status==='running' || until>now;
  const visible=agent.items.filter(entry=>entry.type!=='subAgentActivity');
  const resultNeeded=agent.result && !visible.some(entry=>entry.type==='agentMessage' && entry.text===agent.result);
  return <div className="sag-transcript" data-child-thread={agent.id} aria-busy={loading || undefined}><div className="sag-entries">
    {agent.model && <p className="sag-model-note">{t("Model")} <span>{agent.model}</span></p>}
    {agentPromptNeeded(visible,agent.prompt) && renderItem({id:`${item.id}-prompt`,type:'userMessage',content:[{type:'text',text:agent.prompt}]},agent.id)}
    {groupFileTools(visible,transcriptView).map((entry,index,rows)=><React.Fragment key={entry.id}>{renderItem(entry,agent.id,entry.type==='reasoning'?reasoningPlacement(rows,index,transcriptView):undefined)}</React.Fragment>)}
    {resultNeeded && renderItem({id:`${item.id}-result`,type:'agentMessage',text:agent.result},agent.id)}
    {error && <p role="alert" className="source-tool-error">{error}</p>}
    {running || loading ? <div role="status" className="sag-thinking"><SourceSpark size={18} state="thinking"/><span className="source-sr-only">{t("Thinking…")}</span></div> : !visible.length && !agent.result && <p className="sag-empty">{agent.status==='unknown'?t('No activity yet'):t(agent.status==='failed'?'No result — task failed':agent.status==='stopped'?'No result — task stopped':'No result — task ended')}</p>}
  </div></div>;
}
export function SourceTasksPane({transcriptView="normal",state,sessionId,views=[],onBack,onClose,onOpen,onLoad,renderItem,headerCenter,controls,background}) {
  const current=views.at(-1),pane=useRef(null),load=useRef(onLoad);load.current=onLoad;
  const [loadState,setLoadState]=useState({id:null,pending:false,error:null});
  useEffect(()=>{
    if(!current?.threadId)return;
    let live=true;setLoadState({id:current.threadId,pending:true,error:null});
    load.current(current.threadId).then(()=>{if(live)setLoadState({id:current.threadId,pending:false,error:null});},error=>{if(live)setLoadState({id:current.threadId,pending:false,error:error.message});});
    return()=>{live=false;};
  },[current?.threadId,state.approvalConnectionEpoch]);
  useLayoutEffect(()=>{pane.current?.querySelector('.source-pane-header button')?.focus({preventScroll:true});},[current?.threadId]);
  const item=current && (state.items[current.ownerId || sessionId] || []).find(item=>item.id===current.toolId);
  const agent=current && agentView(state,item||{},current.threadId);
  const spawns=(state.items[sessionId] || []).filter(item=>item.type==='collabAgentToolCall' && item.tool==='spawnAgent');
  return <aside ref={pane} className="source-file-panel detail-panel sag-pane" aria-label={t("Background tasks")} onKeyDown={event=>{
    if(event.key==='Escape' && !event.defaultPrevented && !event.target.closest('[role="menu"]')){event.preventDefault();event.stopPropagation();onClose();}
  }}>
    <header className="source-pane-header" data-pane-header="tasks">
      {views.length>0 && <button className="source-icon-button" aria-label={t("Back")} onClick={onBack}><Icon name="CaretLeft" size={16}/></button>}
      <span className="sag-pane-title">{current?.description || t('Background tasks')}</span>{/* ka [H, t, o] then pe (panes-toggle-current.js:1627-1632): handle after the title */}{headerCenter}{controls}
    </header>
    {agent ? <AgentTranscript transcriptView={transcriptView} key={current.threadId} agent={agent} item={item||{}} renderItem={renderItem} loading={loadState.id===current.threadId && loadState.pending} error={loadState.id===current.threadId && loadState.error}/> : !current&&background ? background : <div className="sag-transcript">
      {current ? <p className="sag-empty">{t("No activity yet")}</p> : spawns.map(item=><React.Fragment key={item.id}>{renderItem(item,sessionId)}</React.Fragment>)}
      {!current && !spawns.length && <p className="sag-empty">{t("No activity yet")}</p>}
    </div>}
  </aside>;
}
