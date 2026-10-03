import {Schema} from 'prosemirror-model';
import {TextSelection,NodeSelection,Plugin} from 'prosemirror-state';
export const composerSchema=new Schema({nodes:{
 doc:{content:'paragraph+'},
 paragraph:{content:'inline*',whitespace:'pre',toDOM:()=>['p',0],parseDOM:[{tag:'p'}]},
 text:{group:'inline'},
 hard_break:{inline:true,group:'inline',selectable:false,toDOM:()=>['br'],parseDOM:[{tag:'br'}],leafText:()=> '\n'},
 // kind 'skill' marks a skill chip (cc183b3ab-BNeMUZS1.js:619-700 skills in the '/' list; the Add › Skills row,
 // scroll-shared-10-current.js:8667-8722 wv/Ev); both kinds are the source skillChip (shared-14 :18578-18600).
 command_chip:{inline:true,group:'inline',atom:true,selectable:true,attrs:{id:{},label:{default:''},description:{default:''},argumentHint:{default:''},kind:{default:'command'}},
  toDOM:node=>['span',{'data-skill-chip':'',dir:'auto'},'/'+node.attrs.id],leafText:node=>'/'+node.attrs.id},
 // An '@' file pick (c099c328d-CbkcmYSW.js:10502-10520 Vr: {type:'mention', attrs:{label: basename, renderedText: path,
 // providerId:'ccd-files'}} + ' '); shared-13 jw renderText `@${renderedText}`, so the draft text, mentionRanges and the
 // mentionInputs payload are the same as for the typed '@path'.
 mention:{inline:true,group:'inline',atom:true,selectable:true,attrs:{path:{},label:{default:''}},
  toDOM:node=>['span',{'data-mention':node.attrs.path,dir:'auto'},'@'+node.attrs.path],leafText:node=>'@'+node.attrs.path},
}});
export const ATOM_NODES=Object.freeze(['command_chip','mention']);
export const leafText=node=>node.isText?node.text:node.type.name==='command_chip'?'/'+node.attrs.id:node.type.name==='mention'?'@'+node.attrs.path:node.type.name==='hard_break'?'\n':'';
export const mentionLabel=path=>String(path||'').split('/').filter(Boolean).pop()||String(path||'');
// Browser insertion/paste can create separate paragraphs. Their two PM boundary
// positions represent one newline in the plain-text RPC/selection API.
function textRuns(doc){const runs=[];doc.forEach((paragraph,start,index)=>{
 if(index)runs.push({from:start-1,to:start+1,value:'\n',text:false});
 paragraph.forEach((node,offset)=>runs.push({from:start+1+offset,to:start+1+offset+node.nodeSize,value:leafText(node),text:node.isText}));
 });return runs;}
export function composerText(doc){return textRuns(doc).map(run=>run.value).join('');}
// Text → document. With `mentions`, every '@path' of a picked file becomes its mention node; with `chips`, a
// leading '/name' of a known command or skill becomes its chip (c099c328d-CbkcmYSW.js:10647-10673 di rebuilds
// '/id' into the chip when the editor is filled from text). composerText(doc) always equals the text.
const MENTION_BOUNDARY=/\s/;
function lineContent(line,{mentions=[],chip=null}={}){
 const nodes=[];let rest=line;
 if(chip){nodes.push(composerSchema.node('command_chip',{id:chip.id,label:chip.id,description:chip.description||'',argumentHint:chip.argumentHint||'',kind:chip.kind==='skill'?'skill':'command'}));rest=line.slice(chip.id.length+1);}
 const paths=[...new Set(mentions.map(entry=>typeof entry==='string'?entry:entry?.path).filter(Boolean))].sort((a,b)=>b.length-a.length);
 let at=0;const taken=[];
 for(const path of paths){const needle='@'+path;let from=0;for(;;){const index=rest.indexOf(needle,from);if(index<0)break;const end=index+needle.length;
  if((index===0||MENTION_BOUNDARY.test(rest[index-1]))&&(end===rest.length||MENTION_BOUNDARY.test(rest[end]))&&!taken.some(([a,b])=>index<b&&end>a))taken.push([index,end,path]);from=index+1;}}
 taken.sort((a,b)=>a[0]-b[0]);
 for(const [start,end,path] of taken){if(start>at)nodes.push(composerSchema.text(rest.slice(at,start)));nodes.push(composerSchema.node('mention',{path,label:mentionLabel(path)}));at=end;}
 if(at<rest.length)nodes.push(composerSchema.text(rest.slice(at)));
 return nodes.length?nodes:null;
}
export function composerDocument(text,{mentions=[],chips=[]}={}){
 const lines=String(text??'').split('\n');
 const first=/^\/([a-z0-9][a-z0-9_:.-]*)(?=\s|$)/i.exec(lines[0]),chip=first?chips.find(entry=>entry?.id===first[1]):null;
 return composerSchema.node('doc',null,lines.map((line,index)=>composerSchema.node('paragraph',null,lineContent(line,{mentions,chip:index===0?chip:null}))));
}
export function composerTextOffset(doc,position){let offset=0;for(const run of textRuns(doc)){
 if(position<=run.from)return offset;
 if(position<run.to)return offset+(run.text?position-run.from:0);
 offset+=run.value.length;
 }return offset;}
export function composerPosition(doc,offset,bias=1){let count=0;for(const run of textRuns(doc)){
 const end=count+run.value.length;
 if(offset<=end)return run.text?run.from+Math.max(0,offset-count):offset<=count?run.from:offset===end||bias>0?run.to:run.from;
 count=end;
 }return doc.content.size-1;}
export function composerSelection(doc,start,end=start,direction='forward'){
 const a=composerPosition(doc,start,start===end?1:-1),b=composerPosition(doc,end,1);return TextSelection.create(doc,direction==='backward'?b:a,direction==='backward'?a:b);
}
// Backspace right after a chip or a mention selects it first; the next Backspace deletes it whole
// (shared-13 Aw atom: the mention is removed as one unit).
export function selectCommandBefore(state,dispatch){const {$from,empty}=state.selection,node=$from.nodeBefore;if(!empty||!ATOM_NODES.includes(node?.type.name))return false;dispatch?.(state.tr.setSelection(NodeSelection.create(state.doc,$from.pos-node.nodeSize)));return true;}
export function commandTransaction(state,command){const atom=composerSchema.node('command_chip',{id:command.id,label:command.id,description:command.description||'',argumentHint:command.argumentHint||'',kind:command.kind==='skill'?'skill':'command'});const paragraph=composerSchema.node('paragraph',null,[atom,composerSchema.text(' ')]),tr=state.tr.replaceWith(0,state.doc.content.size,paragraph);return tr.setSelection(TextSelection.create(tr.doc,3));}
// '@' pick: the token's text range becomes the mention node plus a space; the caret lands after the space.
export function mentionTransaction(state,token,option){const doc=state.doc,from=composerPosition(doc,token.start,1),to=composerPosition(doc,token.end,-1);
 const atom=composerSchema.node('mention',{path:option.path,label:option.label||mentionLabel(option.path)});
 const tr=state.tr.replaceWith(from,Math.max(from,to),[atom,composerSchema.text(' ')]);return tr.setSelection(TextSelection.create(tr.doc,from+2)).scrollIntoView();}
// Add › Skills, a plugin's skill row and Settings › Skills "Use in message" (c099c328d-CbkcmYSW.js:7926-7940 B):
// every skill chip already in the draft goes, then chip + ' ' are inserted at the start (focus("start").insertContent),
// so the draft always leads with the picked skill and composerInput sends it as the {type:'skill'} item. The caret
// lands after the inserted space, where insertContent leaves it. A removed chip also takes its own ' ' separator
// (the source leaves it behind, so a replaced skill would read '/new  text').
export function skillTransaction(state,command){
 const atom=composerSchema.node('command_chip',{id:command.id,label:command.id,description:command.description||'',argumentHint:command.argumentHint||'',kind:'skill'});
 const chips=[];state.doc.descendants((node,start,parent,index)=>{if(node.type.name!=='command_chip'||node.attrs.kind!=='skill')return;const next=parent.maybeChild(index+1);chips.push({from:start,to:start+node.nodeSize+(next?.isText&&next.text.startsWith(' ')?1:0)});});
 const tr=state.tr;for(const {from,to} of chips.reverse())tr.delete(from,to);
 tr.insert(1,[atom,composerSchema.text(' ')]);return tr.setSelection(TextSelection.create(tr.doc,3)).scrollIntoView();}
export function reconcileComposerText(state,value){const old=composerText(state.doc);if(old===value)return null;let start=0,end=0;while(start<old.length&&start<value.length&&old[start]===value[start])start++;while(end<old.length-start&&end<value.length-start&&old[old.length-1-end]===value[value.length-1-end])end++;
 const from=composerPosition(state.doc,start,-1),to=composerPosition(state.doc,old.length-end,1);
 // If a text edit intersects an atom, replace its complete serialized extent.
 const actualStart=composerTextOffset(state.doc,from),actualEnd=composerTextOffset(state.doc,to),suffix=old.length-actualEnd;
 return state.tr.insertText(value.slice(actualStart,value.length-suffix),from,to).setMeta('addToHistory',false);
}
export function composerArgumentHint(doc){if(doc.content.size>128)return null;let hint=null;doc.descendants((node,start)=>{
 if(node.type.name!=='command_chip'||!node.attrs.argumentHint)return;
 const after=start+node.nodeSize;
 if(doc.textBetween(0,start,' ','\uFFFC').trim()||doc.textBetween(after,doc.content.size,' ','\uFFFC').trim())return;
 const trailing=doc.textBetween(after,doc.resolve(after).end(),undefined,'\uFFFC');
 if(trailing.length)hint={text:node.attrs.argumentHint,position:after+trailing.length};
 });return hint;}
export function restoreCommandSeparators(state){const positions=[];state.doc.descendants((node,start,parent,index)=>{if(!ATOM_NODES.includes(node.type.name))return;const next=parent.maybeChild(index+1);if(!next?.isText)return;const text=next.text.replace(/^\u200B+/,'');if(text&&!/^[ \u00a0]/.test(text))positions.push(start+node.nodeSize);});if(!positions.length)return null;let tr=state.tr;for(const pos of positions.reverse())tr=tr.insertText(' ',pos);return tr;}
export function commandSeparatorPlugin(){let view=null;return new Plugin({appendTransaction(transactions,previous,state){return !view?.composing&&transactions.some(tr=>tr.docChanged)?restoreCommandSeparators(state):null;},view(editor){view=editor;const finish=()=>{if(view&&!view.composing){const tr=restoreCommandSeparators(view.state);if(tr)view.dispatch(tr);}};editor.dom.addEventListener('compositionend',finish);return {destroy(){editor.dom.removeEventListener('compositionend',finish);view=null;}};}});}
