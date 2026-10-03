import test from 'node:test';
import assert from 'node:assert/strict';
import {createToastStore,toastDuration,toastClearance} from '../src/toast-store.mjs';
function harness(){let now=0,id=0;const timers=new Map();const store=createToastStore({now:()=>now,schedule:(fn,delay)=>{timers.set(++id,{at:now+delay,fn});return id;},cancel:key=>timers.delete(key)});return {store,timers,elapse(ms){now+=ms;},tick(ms){const end=now+ms;for(;;){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=end;}};}
test('toast deadlines follow source6500/10000, minimum positive6000 and explicit indefinite',()=>{
 assert.equal(toastDuration(),6500);assert.equal(toastDuration('warning'),10000);assert.equal(toastDuration('neutral',300),6000);assert.equal(toastDuration('warning',12000),12000);assert.equal(toastDuration('neutral',Infinity),0);assert.equal(toastDuration('neutral',0),0);
 const {store,tick}=harness(),id=store.add('Copied');store.settle(id);tick(6499);assert.equal(store.getSnapshot()[0].phase,'open');tick(1);assert.equal(store.getSnapshot()[0].phase,'ending');tick(199);assert.equal(store.getSnapshot().length,1);tick(1);assert.deepEqual(store.getSnapshot(),[]);
});
test('hover focus and window pause preserve remaining time and cannot resume each other',()=>{
 const {store,tick}=harness();store.add('Copied');tick(2000);store.pause('hover');tick(5000);store.pause('focus');store.resume('hover');tick(8000);assert.equal(store.getSnapshot()[0].phase,'starting');store.pause('window');store.resume('focus');tick(2000);store.resume('window');tick(4499);assert.equal(store.getSnapshot().length,1);tick(1);assert.equal(store.getSnapshot()[0].phase,'ending');
});
test('duplicate notices update counts and reset their deadline without reordering or merging ended cards',()=>{
 const {store,tick}=harness();const a=store.add('Copied');store.settle(a);tick(6000);const b=store.add('Saved');assert.equal(store.add('Copied'),a);assert.deepEqual(store.getSnapshot().map(x=>[x.id,x.count]),[[b,1],[a,2]]);tick(500);assert.equal(store.getSnapshot()[1].phase,'open');store.close(a);const next=store.add('Copied');assert.notEqual(next,a);assert.equal(store.getSnapshot()[0].count,1);tick(200);assert.equal(store.getSnapshot().some(x=>x.id===a),false);
});
test('adding during pause never starts a hidden countdown and disposal removes every owned timer/listener',()=>{
 const {store,timers,tick}=harness();let calls=0;store.subscribe(()=>calls++);store.pause('window');store.add('Failed',{variant:'warning'});assert.equal(timers.size,0);tick(50000);store.resume('window');tick(9999);assert.equal(store.getSnapshot().length,1);store.dispose();const before=calls;tick(99999);assert.equal(timers.size,0);assert.equal(calls,before);assert.equal(store.add('late'),null);assert.deepEqual(store.getSnapshot(),[]);
});

test('an elapsed deadline paused before its queued callback expires immediately on resume, rather than becoming indefinite',()=>{
 const {store,elapse,tick}=harness();store.add('Late timer');elapse(7000);store.pause('hover');store.resume('hover');tick(0);assert.equal(store.getSnapshot()[0].phase,'ending');tick(200);assert.equal(store.getSnapshot().length,0);
});

// Fidelity F05: uniqueKey (cc43287c9-BMbiZYzF.js:33860-33877, :11310-11322) replaces the keyed toast in place.
test('a same-key toast replaces the text and variant in place and restarts its deadline instead of stacking',()=>{
 const {store,tick}=harness();const a=store.add('Fast mode is already on.',{variant:'warning',key:'epitaxy-fast-command-notice'});store.settle(a);tick(9000);
 assert.equal(store.add('Fast mode is already off.',{variant:'warning',key:'epitaxy-fast-command-notice'}),a);
 assert.deepEqual(store.getSnapshot().map(x=>[x.id,x.message,x.count,x.key]),[[a,'Fast mode is already off.',1,'epitaxy-fast-command-notice']]);
 tick(9999);assert.equal(store.getSnapshot()[0].phase,'open','the 10s warning deadline restarted');tick(1);assert.equal(store.getSnapshot()[0].phase,'ending');
 const b=store.add('Already in plan mode.',{variant:'warning',key:'epitaxy-plan-command-notice'});assert.notEqual(b,a,'an ending keyed toast is not reused');
 const plain=store.add('Already in plan mode.',{variant:'warning'});assert.notEqual(plain,b,'a keyed toast never merges with an unkeyed one');
 assert.equal(store.add('Already in plan mode. No plan written yet.',{variant:'warning',key:'epitaxy-plan-command-notice'}),b);
 assert.equal(store.getSnapshot().filter(x=>x.key==='epitaxy-plan-command-notice').length,1);
});

// git-layout-shared.js:12302-12440 kN: an overlapping safe region (the composer zone) lifts the toast region above it.
test('toast clearance: innerHeight - top of the overlapping safe regions, capped at innerHeight - 96; disjoint or empty regions do not count',()=>{
 const scope={left:948,right:1308};
 assert.equal(toastClearance(scope,[{left:420,right:1190,top:600,width:770,height:168}],768),168);
 assert.equal(toastClearance(scope,[{left:0,right:900,top:600,width:900,height:168}],768),0,'disjoint horizontally');
 assert.equal(toastClearance(scope,[{left:420,right:1190,top:600,width:0,height:0}],768),0,'zero-size');
 assert.equal(toastClearance(scope,[{left:420,right:1190,top:20,width:770,height:748}],768),672,'capped at innerHeight - 96');
 assert.equal(toastClearance(scope,[{left:420,right:1190,top:700,width:770,height:68},{left:1000,right:1300,top:500,width:300,height:268}],768),268,'the tallest lift wins');
 assert.equal(toastClearance(scope,[],768),0);
});
