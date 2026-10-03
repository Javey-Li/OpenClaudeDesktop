export function toastDuration(variant='neutral',timeout) {
  if(timeout===undefined)return variant==='neutral'?6500:10000;
  if(!Number.isFinite(timeout)||timeout<=0)return 0;
  return Math.max(6000,timeout);
}
export function createToastStore({now=()=>Date.now(),schedule=setTimeout,cancel=clearTimeout,exitDuration=200}={}) {
  let snapshot=[],sequence=0,disposed=false;
  const listeners=new Set(),records=new Map(),paused=new Set();
  const publish=()=>{snapshot=[...snapshot];for(const listener of listeners)listener();};
  const stop=record=>{if(record.timer!==null){cancel(record.timer);record.timer=null;record.remaining=Math.max(0,record.deadline-now());}};
  const arm=record=>{if(disposed||paused.size||!record.expiring)return;record.deadline=now()+record.remaining;record.timer=schedule(()=>close(record.id),record.remaining);};
  function close(id) {
    const entry=snapshot.find(entry=>entry.id===id),record=records.get(id);
    if(!entry||entry.phase==='ending')return;
    stop(record);snapshot=snapshot.map(entry=>entry.id===id?{...entry,phase:'ending'}:entry);publish();
    if(disposed)return;
    record.exit=schedule(()=>{records.delete(id);snapshot=snapshot.filter(entry=>entry.id!==id);publish();},exitDuration);
  }
  return {
    getSnapshot:()=>snapshot,
    subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},
    // key (the source toast API's uniqueKey, cc43287c9-BMbiZYzF.js:33860-33877 'epitaxy-plan-command-notice'):
    // a live toast with the same key takes the new text and variant in place and restarts its timer, so
    // on/off variants of one notice share a slot instead of stacking.
    add(message,{variant='neutral',timeout,dedupe=true,key}={}){
      if(disposed||typeof message!=='string'||!message)return null;
      const duration=toastDuration(variant,timeout);
      const keyed=typeof key==='string'&&key?snapshot.find(entry=>entry.key===key&&entry.phase!=='ending'):null;
      if(keyed){
        const record=records.get(keyed.id);stop(record);record.remaining=duration;record.expiring=duration>0;
        snapshot=snapshot.map(entry=>entry.id===keyed.id?{...entry,message,variant,count:1}:entry);publish();arm(record);return keyed.id;
      }
      const existing=dedupe&&!key?snapshot.find(entry=>entry.message===message&&!entry.key&&entry.phase!=='ending'):null;
      if(existing){
        const record=records.get(existing.id);stop(record);record.remaining=duration;record.expiring=duration>0;
        snapshot=snapshot.map(entry=>entry.id===existing.id?{...entry,count:entry.count+1}:entry);publish();arm(record);return existing.id;
      }
      const id=++sequence,record={id,remaining:duration,expiring:duration>0,timer:null,exit:null,deadline:0};records.set(id,record);
      snapshot=[{id,message,variant,count:1,phase:'starting',...(typeof key==='string'&&key?{key}:{})},...snapshot];publish();arm(record);return id;
    },
    settle(id){if(disposed)return;snapshot=snapshot.map(entry=>entry.id===id&&entry.phase==='starting'?{...entry,phase:'open'}:entry);publish();},
    close,
    pause(reason){if(disposed||paused.has(reason))return;if(!paused.size)for(const record of records.values())stop(record);paused.add(reason);},
    resume(reason){if(disposed||!paused.delete(reason)||paused.size)return;for(const entry of snapshot)if(entry.phase!=='ending')arm(records.get(entry.id));},
    dispose(){disposed=true;for(const record of records.values()){stop(record);if(record.exit!==null)cancel(record.exit);}records.clear();listeners.clear();snapshot=[];},
  };
}

// git-layout-shared.js:12302-12440 (FN/kN/AN, tN 96): a registered safe region — here the composer zone,
// [data-toast-safe-region] — that overlaps the toast region horizontally lifts it: --toast-clearance is the
// region's distance from the viewport bottom (innerHeight - top), capped at innerHeight - 96, and the scope's
// bottom offset is max(…, --toast-clearance) + 16px. Zero-size and disjoint regions do not count.
export const TOAST_CLEARANCE_FLOOR=96;
export function toastClearance(scopeRect,regionRects,innerHeight){
  let clearance=0;
  for(const rect of regionRects){if(!rect||rect.width===0||rect.height===0||rect.right<=scopeRect.left||rect.left>=scopeRect.right)continue;const lift=innerHeight-rect.top;if(lift>0)clearance=Math.max(clearance,lift);}
  return Math.min(clearance,Math.max(0,innerHeight-TOAST_CLEARANCE_FLOOR));
}
