import test from 'node:test';import assert from 'node:assert/strict';
import {startFileContextDrag,acceptsFileContextDrag,dropFileContextDrag} from '../src/file-context-drag.mjs';
import {clearFileContextDrag,draggedFilePaths} from '../src/generated/code-editor/file-context-drag.mjs';
import {isBlankTreePress,isBlankTreeTarget} from '../src/generated/code-editor/file-tree-pointer.mjs';
function drag(){const values=new Map(),handlers=new Map();return {dataTransfer:{get types(){return [...values.keys()]},setData:(key,value)=>values.set(key,value),getData:key=>values.get(key)},currentTarget:{addEventListener:(type,fn)=>handlers.set(type,fn)},preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true},handlers};}
test('original drag protocol uses an owner-scoped marker and consumes one attachment snapshot',()=>{
 clearFileContextDrag();const owner={},other={},event=drag();let attached=0;
 assert.equal(startFileContextDrag(event,owner,['/repo/a','/repo/b'],()=>attached++),true);
 assert.deepEqual(event.dataTransfer.types,['application/x-claude-file-context']);assert.equal(event.dataTransfer.getData(event.dataTransfer.types[0]),'1');assert.equal(event.dataTransfer.effectAllowed,'copy');
 assert.equal(acceptsFileContextDrag(event,other),false);assert.equal(dropFileContextDrag(event,other),false);assert.equal(attached,0);
 assert.deepEqual(draggedFilePaths(owner),['/repo/a','/repo/b']);assert.equal(dropFileContextDrag(event,owner),true);assert.equal(attached,1);assert.equal(event.stopped,true);assert.equal(dropFileContextDrag(event,owner),false);
 const cancelled=drag();startFileContextDrag(cancelled,owner,['/repo/c'],()=>attached++);cancelled.handlers.get('dragend')();assert.equal(acceptsFileContextDrag(cancelled,owner),false);
 const forged=drag();forged.dataTransfer.setData('application/x-claude-file-context','1');assert.equal(acceptsFileContextDrag(forged,owner),false);
 for(const paths of [[],Array(101).fill('/repo/a')]){const refused=drag();assert.equal(startFileContextDrag(refused,owner,paths,()=>attached++),false);assert.equal(refused.prevented,true);}
});
test('original blank click rule excludes rows, nonprimary buttons and scrollbars',()=>{
 const tree={contains:()=>true,getBoundingClientRect:()=>({left:10,top:20}),offsetWidth:115,clientWidth:100,offsetHeight:215,clientHeight:200,clientLeft:0,clientTop:0};
 const event={currentTarget:tree,target:{closest:()=>null},button:0,clientX:50,clientY:50};assert.equal(isBlankTreePress(event),true);assert.equal(isBlankTreeTarget(event),true);
 assert.equal(isBlankTreePress({...event,button:2}),false);assert.equal(isBlankTreePress({...event,clientX:112}),false);assert.equal(isBlankTreePress({...event,clientY:225}),false);
 assert.equal(isBlankTreePress({...event,target:{closest:()=>({})}}),false);
});
