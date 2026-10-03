import test from 'node:test';import assert from 'node:assert/strict';
import {CYCLE_REPEAT_MS,sessionCycleDelta,isCycleModifier,cycleTarget,repeatThrottled,createSessionCycler} from '../src/session-cycle-model.mjs';
// shared-19-CjdiaR4X.js Km/Jm/Xm/$m: position 0 is the new-session page, rows are 1..count.
const key=(over={})=>({key:'',code:'',metaKey:false,ctrlKey:false,shiftKey:false,altKey:false,repeat:false,defaultPrevented:false,...over});
const NEXT=key({key:']',code:'BracketRight',metaKey:true,shiftKey:true}),PREV=key({key:'[',code:'BracketLeft',metaKey:true,shiftKey:true});
const CTRL_TAB=key({key:'Tab',code:'Tab',ctrlKey:true}),CTRL_SHIFT_TAB=key({key:'Tab',code:'Tab',ctrlKey:true,shiftKey:true});

test('$m: ⌘⇧] / ⌘⇧[ by key code and Ctrl+Tab / Ctrl+Shift+Tab; Alt or the other modifier never cycles',()=>{
 assert.equal(sessionCycleDelta(NEXT),1);assert.equal(sessionCycleDelta(PREV),-1);
 assert.equal(sessionCycleDelta(CTRL_TAB),1);assert.equal(sessionCycleDelta(CTRL_SHIFT_TAB),-1);
 // Shift+] reports key "}" on a US layout; the code is what counts.
 assert.equal(sessionCycleDelta({...NEXT,key:'}'}),1);
 for(const event of [{...NEXT,altKey:true},{...NEXT,ctrlKey:true},{...NEXT,shiftKey:false},{...CTRL_TAB,metaKey:true},{...CTRL_TAB,altKey:true},key({key:'Tab'}),key({key:'k',code:'KeyK',metaKey:true,shiftKey:true}),undefined])
  assert.equal(sessionCycleDelta(event),0,JSON.stringify(event));
 assert.equal(isCycleModifier(key({key:'Meta'})),true);assert.equal(isCycleModifier(key({key:'Control'})),true);assert.equal(isCycleModifier(key({key:'Shift'})),false);
});

test('cycleTarget wraps home → first → … → last → home in both directions (modulus count + 1)',()=>{
 const count=3,walk=(delta)=>{const seen=[];let selectedIndex=-1;for(let step=0;step<count+1;step++){const pos=cycleTarget({count,selectedIndex},delta);seen.push(pos);selectedIndex=pos-1;}return seen;};
 assert.deepEqual(walk(1),[1,2,3,0]);
 assert.deepEqual(walk(-1),[3,2,1,0]);
 assert.equal(cycleTarget({count:3,selectedIndex:2},1),0,'last → home');
 assert.equal(cycleTarget({count:3,selectedIndex:0},-1),0,'first → home');
 assert.equal(cycleTarget({count:0,selectedIndex:-1},1),null,'no rows, nothing to open');
 // Jm: a held sequence continues from the last opened row, or its remembered position when that row left.
 assert.equal(cycleTarget({count:3,selectedIndex:-1,last:{pos:1},lastIndex:0},1),2);
 assert.equal(cycleTarget({count:2,selectedIndex:-1,last:{pos:3},lastIndex:-1},1),0,'min(pos, count) + 1 wraps');
});

test('Gm: held-key repeats within 50ms are swallowed',()=>{
 assert.equal(CYCLE_REPEAT_MS,50);
 assert.equal(repeatThrottled({at:100},149,true),true);
 assert.equal(repeatThrottled({at:100},150,true),false);
 assert.equal(repeatThrottled({at:100},120,false),false,'a fresh press is never throttled');
 assert.equal(repeatThrottled(null,120,true),false);
});

function harness(names,selected=null){
 const buttons=names.map(name=>({name})),log=[];let now=0,current=selected;
 const cycler=createSessionCycler({
  rows:()=>({buttons,selectedIndex:current===null?-1:names.indexOf(current)}),
  open:button=>{log.push(button.name);},home:()=>{log.push('home');},now:()=>now});
 return {cycler,log,tick:(ms)=>{now+=ms;},select:(name)=>{current=name;}};
}

test('a held ⌘ walks the rows from the last opened one even before the selection re-renders (Jm)',()=>{
 const {cycler,log,tick}=harness(['A','B','C']);
 for(let i=0;i<4;i++){assert.equal(cycler.keydown(NEXT),true);tick(200);}
 assert.deepEqual(log,['A','B','C','home']);
 cycler.keyup(key({key:'Meta'}));
 for(let i=0;i<4;i++){assert.equal(cycler.keydown(PREV),true);tick(200);}
 assert.deepEqual(log.slice(4),['C','B','A','home']);
});

test('after the modifier is released the next step starts from the open row; repeats are throttled',()=>{
 const {cycler,log,tick,select}=harness(['A','B','C'],'B');
 assert.equal(cycler.keydown(CTRL_TAB),true);assert.deepEqual(log,['C']);
 assert.equal(cycler.keydown({...CTRL_TAB,repeat:true}),true,'a fast repeat is consumed');assert.deepEqual(log,['C']);
 tick(60);assert.equal(cycler.keydown({...CTRL_TAB,repeat:true}),true);assert.deepEqual(log,['C','home']);
 cycler.keyup(key({key:'Control'}));select('A');
 cycler.keydown(CTRL_SHIFT_TAB);assert.deepEqual(log.at(-1),'home','from A, previous is the new-session page');
 // Any other key ends the sequence; Shift alone does not.
 cycler.keydown(key({key:'Shift'}));cycler.keydown(CTRL_SHIFT_TAB);assert.equal(log.at(-1),'C');
 cycler.keydown(key({key:'x',code:'KeyX'}));select('B');cycler.keydown(NEXT);assert.equal(log.at(-1),'C');
});

test('defaultPrevented chords, unrelated keys and an empty list are not consumed; step() is one fresh menu step',()=>{
 const {cycler,log}=harness(['A','B']);
 assert.equal(cycler.keydown({...NEXT,defaultPrevented:true}),false);
 assert.equal(cycler.keydown(key({key:'a',code:'KeyA'})),false);
 assert.deepEqual(log,[]);
 assert.equal(cycler.step(1),true);assert.equal(cycler.step(1),true);assert.deepEqual(log,['A','A'],'each menu step starts from the selection');
 const empty=harness([]);assert.equal(empty.cycler.keydown(NEXT),false);assert.equal(empty.cycler.step(-1),false);assert.deepEqual(empty.log,[]);
});
