import React,{useEffect,useId,useRef,useState} from 'react';
import {SourceSettingsButton} from './source-settings-button.jsx';
import {usageEmptyText,usagePresentation,usageResetLabel} from './usage-model.mjs';
import {SourceTimestamp} from './source-timestamp.jsx';
import {formatDayKey,localDayKey} from './home-model.mjs';
import {COST_FOOTNOTE,compactTokens,deepseekCostPresentation,formatCny,formatTokenCount} from './usage-cost-model.mjs';
import './source-usage.css';

// Keep the server reason, omitting only Electron's known transport wrapper.
const usageErrorText = value => String(value).replace(/^Error invoking remote method 'desktop:call': (?:Error: )?/gm, '');

function UsageRow({row}) {
 const title=useId(),description=useId();
 const reset=usageResetLabel(row.resetsAt,row.minutes);
 const detail=[row.description,reset].filter(Boolean).join(' · ');
 const value=`${Math.round(row.used).toLocaleString()}% used`;
 return <div className="su-row" data-variant={row.variant}>
  <div className="su-row-copy"><div id={title}>{row.label}</div>{detail&&<p id={description}>{detail}</p>}</div>
  <div className="su-meter" role="meter" aria-labelledby={title} aria-describedby={detail?description:undefined}
   aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.used} aria-valuetext={value} data-empty={row.used===0||undefined}>
   {row.used>0&&<div className="su-indicator" style={{'--usage-percent':`${row.used.toFixed(1)}%`}}/>}
  </div><span className="su-percent" aria-hidden="true">{value}</span>
 </div>;
}
// Daily table cells: a harness day key as "Sep 30" (home-model formatDayKey, UTC so the key's day is kept;
// any other text stays as data) and grouped token counts.
const dayCell=key=>/^\d{4}-\d{2}-\d{2}$/.test(key)?formatDayKey(key):key;
const tokenCount=value=>new Intl.NumberFormat().format(value);
// DeepSeek core: the bridge's estimated CNY (account/usage/read `deepseek`) in the home stats tiles' language
// (source-home.css .sh-tile: alpha-2 surface, muted label, tabular value). Costs are estimates; the footnote says so.
const approx=cost=>cost===null?'—':`≈ ${formatCny(cost)}`;
function CostTile({tile}) {
 return <div className="su-tile" data-key={tile.key}>
  <span className="su-tile-label">{tile.label}</span>
  <span className="su-tile-value text-title-semibold" title={`${formatTokenCount(tile.tokens)} tokens`}>{compactTokens(tile.tokens)}<span className="su-tile-unit"> tokens</span></span>
  <span className="su-tile-cost">{approx(tile.cost)}{tile.partial&&<span title="Includes models without a published price">+</span>}</span>
 </div>;
}
function CostBreakdown({cost}) {
 return <div className="su-cost-panels">
  <section className="su-panel" aria-label="Where the cost goes">
   <div className="su-panel-heading"><h4 className="text-body-semibold">Where the cost goes</h4><span>All time</span></div>
   <div className="su-stack" aria-hidden="true">{cost.categories.filter(entry=>entry.share>0).map(entry=><i key={entry.key} data-key={entry.key} style={{flexGrow:entry.share}}/>)}</div>
   <ul className="su-legend">{cost.categories.map(entry=><li key={entry.key} data-key={entry.key}>
    <span className="su-swatch" aria-hidden="true"/><span className="su-legend-name">{entry.label}</span>
    <span className="su-legend-tokens" title={`${formatTokenCount(entry.tokens)} tokens`}>{compactTokens(entry.tokens)}</span><span className="su-legend-cost">{formatCny(entry.cost)}</span>
   </li>)}</ul>
  </section>
  <section className="su-panel" aria-label="By model">
   <div className="su-panel-heading"><h4 className="text-body-semibold">By model</h4><span>All time</span></div>
   <ul className="su-models">{cost.models.map(entry=><li key={entry.key}>
    <span className="su-legend-name" title={entry.key}>{entry.name}</span>
    <span className="su-bar" aria-hidden="true"><i style={{width:`${(entry.share*100).toFixed(1)}%`}}/></span>
    <span className="su-legend-tokens" title={`${formatTokenCount(entry.tokens)} tokens`}>{compactTokens(entry.tokens)}</span><span className="su-legend-cost">{formatCny(entry.cost)}</span>
   </li>)}</ul>
  </section>
 </div>;
}
function DeepSeekUsage({cost,onOpenLink}) {
 const used=cost.tiles[0].tokens>0;
 return <>
  <div className="su-tiles">{cost.tiles.map(tile=><CostTile key={tile.key} tile={tile}/>)}</div>
  {used&&<CostBreakdown cost={cost}/>}
  <section className="su-section su-days-section" aria-label="Daily token usage">
   <div className="su-panel-heading"><h3 className="text-heading-semibold">Last 30 days</h3><span>Tokens · est. cost</span></div>
   {cost.daily.length?<table className="su-days"><thead className="su-days-head"><tr><th scope="col">Date</th><th scope="col">Share</th><th scope="col">Tokens</th><th scope="col">Estimated cost</th></tr></thead>
    <tbody>{cost.daily.map(day=><tr key={day.date}><td className="su-day-date">{day.label}</td><td className="su-day-bar" aria-hidden="true"><span className="su-bar"><i style={{width:`${(day.share*100).toFixed(1)}%`}}/></span></td>
     <td className="su-day-tokens" title={`${formatTokenCount(day.tokens)} tokens`}>{compactTokens(day.tokens)}</td><td className="su-day-cost">{formatCny(day.cost)}</td></tr>)}</tbody></table>
    :<p className="su-empty">No DeepSeek usage in the last 30 days.</p>}
  </section>
  <p className="su-footnote">{COST_FOOTNOTE}。{cost.partial&&'Models without a published price count tokens but no cost. '}
   {onOpenLink&&<button type="button" className="su-link" onClick={()=>onOpenLink(cost.usageUrl)}>DeepSeek Platform usage</button>}</p>
 </>;
}
// The parent keys this component by account/connection; each request also has
// an unmount fence. An inline callback changing identity must not refetch forever.
export function SourceUsage({readUsage,engine,onOpenLink}) {
 const [data,setData]=useState(null),[busy,setBusy]=useState(true),[revision,setRevision]=useState(0),[failure,setFailure]=useState(''),[updatedAt,setUpdatedAt]=useState(null);
 const reader=useRef(readUsage);reader.current=readUsage;
 useEffect(()=>{
  let alive=true;setBusy(true);setFailure('');
  Promise.resolve().then(()=>{if(typeof reader.current!=='function')throw Error('Reconnect to load account usage limits.');return reader.current();})
   .then(value=>{if(alive){setData(value);setUpdatedAt(Date.now());}})
   .catch(error=>{if(alive)setFailure(error instanceof Error?error.message:String(error));})
   .finally(()=>{if(alive)setBusy(false);});
  return()=>{alive=false;};
 },[revision]);
 const todayKey=localDayKey(new Date());
 const {rows,credits,spending,plan,daily,dailyLabel,lifetimeTokens}=usagePresentation(data,{todayKey});
 const cost=deepseekCostPresentation(data,{todayKey});
 return <section className="source-usage" aria-label="Your usage" aria-busy={busy} data-cost={cost?true:undefined}>
  <div className="su-heading"><h3 className="text-heading-semibold">Your usage</h3>{plan&&<span>{plan}</span>}</div>
  {busy&&!data?<div className="su-loading" role="status"><span>Loading usage limits</span>{[0,1,2].map(i=><div className="su-skeleton" aria-hidden="true" key={i}><i/><i/></div>)}</div>:<>
   {cost?rows.length>0&&<div className="su-limits">{rows.map(row=><UsageRow key={row.key} row={row}/>)}</div>
    :<div className="su-limits">{rows.map(row=><UsageRow key={row.key} row={row}/>)}{!rows.length&&<p className="su-empty">{usageEmptyText(engine)}</p>}</div>}
   {cost&&<DeepSeekUsage cost={cost} onOpenLink={onOpenLink}/>}
   {credits.map(credit=><section className="su-section" key={credit.key} aria-label={credit.name?`${credit.name} usage credits`:'Usage credits'}>
    <div className="su-section-heading"><h3 className="text-heading-semibold">{credit.name?`${credit.name} usage credits`:'Usage credits'}</h3><strong>{credit.balance}</strong></div>
    <p>Available credits for your account.</p>
   </section>)}
   {spending.map(spend=><section className="su-section" key={spend.key} aria-label="Spend limit">
    <h3 className="text-heading-semibold">{spend.name?`${spend.name} spend limit`:'Spend limit'}</h3><p>{spend.used} used · {spend.limit} limit</p>
    {usageResetLabel(spend.resetsAt)&&<p>{usageResetLabel(spend.resetsAt)}</p>}
   </section>)}
   {/* The bridge's daily buckets, newest first over the last 30 days (catalog Rfvi9/BMNS), with the all-time total. */}
   {!cost&&daily.length>0&&<section className="su-section" aria-label="Daily token usage"><h3 className="text-heading-semibold">{dailyLabel}</h3><table className="su-daily"><thead><tr><th scope="col">Date</th><th scope="col">Tokens</th></tr></thead><tbody>{daily.map((bucket,index)=><tr key={`${bucket.startDate}:${index}`}><td>{dayCell(bucket.startDate)}</td><td>{tokenCount(bucket.tokens)}</td></tr>)}</tbody>
    {lifetimeTokens!==null&&<tfoot><tr><th scope="row">All time</th><td>{tokenCount(lifetimeTokens)}</td></tr></tfoot>}</table></section>}
  </>}
  {(failure||data?.error)&&<p className="su-error" role="alert">{usageErrorText(failure||data.error)}{failure&&data?' Showing the previous usage snapshot.':''}</p>}
  {data?.tokenUsageError&&<p className="su-note">Daily token usage is unavailable: {usageErrorText(data.tokenUsageError)}</p>}
  {/* Muted 'Last updated: {when}' / 'Last updated: just now' (catalog IZL4XAsgrO / ncXJ+kb4mp) beside Refresh. */}
  <footer className="su-footer">{busy&&data?<span role="status">Refreshing usage…</span>:updatedAt!==null&&<span className="su-updated">Last updated: <SourceTimestamp dateMs={updatedAt}/></span>}<SourceSettingsButton disabled={busy} onClick={()=>{setBusy(true);setFailure('');setRevision(r=>r+1);}}>Refresh usage</SourceSettingsButton></footer>
 </section>;
}
