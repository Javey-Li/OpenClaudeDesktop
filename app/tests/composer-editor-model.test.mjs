import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorState,NodeSelection} from 'prosemirror-state';
import {history,undo,redo,closeHistory} from 'prosemirror-history';
import {composerSchema,composerText,composerDocument,composerTextOffset,composerPosition,composerSelection,commandTransaction,selectCommandBefore,reconcileComposerText,composerArgumentHint,commandSeparatorPlugin,restoreCommandSeparators,mentionTransaction,skillTransaction,mentionLabel} from '../src/composer-editor-model.mjs';
import {mentionToken,mentionInputs} from '../src/mention-model.mjs';
import {parseSessionCommand} from '../src/session-command-model.mjs';
import {skillChipInput} from '../src/composer-attachments-model.mjs';
const command={id:'theme',description:'Change appearance',argumentHint:'[system|light|dark]'};
const seed=(value,plugins=[])=>EditorState.create({schema:composerSchema,doc:composerDocument(value),plugins});
const selected=(plugins=[])=>{const state=seed('/th',plugins);return state.apply(commandTransaction(state,command));};
test('plain composer text retains Unicode, literal HTML, blank and trailing lines',()=>{for(const value of ['', '中文 👩🏽‍💻', 'a\n\nb\n', '<img src=x onerror=alert(1)>']){const doc=composerDocument(value);assert.equal(composerText(doc),value);for(let offset=0;offset<=value.length;offset++)assert.equal(composerTextOffset(doc,composerPosition(doc,offset)),offset);}});
test('explicit menu selection inserts one atom and separator while preserving the exact command text boundary',()=>{const state=selected();assert.equal(state.doc.firstChild.firstChild.type.name,'command_chip');assert.equal(state.doc.firstChild.firstChild.nodeSize,1);assert.equal(composerText(state.doc),'/theme ');assert.equal(state.selection.from,3);assert.equal(composerPosition(state.doc,3,-1),1);assert.equal(composerPosition(state.doc,3,1),2);assert.equal(composerTextOffset(state.doc,2),6);assert.equal(seed('/theme ').doc.firstChild.firstChild.isText,true);});
test('Backspace first selects the preceding command atom; the next deletion removes it as a whole',()=>{let state=selected();state=state.apply(state.tr.delete(2,3));assert.equal(selectCommandBefore(state,tr=>state=state.apply(tr)),true);assert.ok(state.selection instanceof NodeSelection);assert.deepEqual([composerTextOffset(state.doc,state.selection.from),composerTextOffset(state.doc,state.selection.to)],[0,6]);assert.equal(selectCommandBefore(state),false);state=state.apply(state.tr.deleteSelection());assert.equal(composerText(state.doc),'');});
test('selection mapping includes the full atom and preserves backward ranges and emoji offsets',()=>{let state=selected();state=state.apply(state.tr.insertText('中文🙂',3));const selection=composerSelection(state.doc,1,11,'backward');assert.equal(selection.anchor,7);assert.equal(selection.head,1);assert.equal(composerText(state.doc),'/theme 中文🙂');});
test('external draft edits preserve unaffected atoms and replace an atom fully when its name changes',()=>{let state=selected();state=state.apply(reconcileComposerText(state,'/theme dark'));assert.equal(state.doc.firstChild.firstChild.type.name,'command_chip');assert.equal(composerText(state.doc),'/theme dark');state=state.apply(reconcileComposerText(state,'/model dark'));assert.equal(composerText(state.doc),'/model dark');assert.equal(state.doc.firstChild.firstChild.isText,true);assert.equal(reconcileComposerText(state,'/model dark'),null);});
test('source argument hint requires a selected chip, separator, no arguments and the document size budget',()=>{let state=selected();assert.deepEqual(composerArgumentHint(state.doc),{text:command.argumentHint,position:3});assert.equal(composerArgumentHint(seed('/theme ').doc),null);state=state.apply(state.tr.insertText('dark'));assert.equal(composerArgumentHint(state.doc),null);state=selected();state=state.apply(state.tr.delete(2,3));assert.equal(composerArgumentHint(state.doc),null);state=selected();state=state.apply(state.tr.insertText(' '.repeat(130)));assert.equal(composerArgumentHint(state.doc),null);});
test('separator restoration prevents arguments merging into an atom, respects NBSP and defers while composing',()=>{const plugin=commandSeparatorPlugin();let state=selected([plugin]);state=state.applyTransaction(state.tr.insertText('dark',2,3)).state;assert.equal(composerText(state.doc),'/theme dark');state=state.applyTransaction(state.tr.insertText('\u00a0',2,3)).state;assert.equal(restoreCommandSeparators(state),null);
 const events=new EventTarget();const view={dom:events,composing:true,get state(){return state;},dispatch(tr){state=state.applyTransaction(tr).state;}};const lifecycle=plugin.spec.view(view);state=state.applyTransaction(state.tr.insertText('中',2,3)).state;assert.equal(composerText(state.doc),'/theme中dark');view.composing=false;events.dispatchEvent(new Event('compositionend'));assert.equal(composerText(state.doc),'/theme 中dark');lifecycle.destroy();});
test('command insertion and later argument typing have distinct reversible history steps',()=>{let state=seed('/th',[history()]);const apply=tr=>state=state.apply(tr);apply(closeHistory(commandTransaction(state,command)));apply(closeHistory(state.tr));apply(state.tr.insertText('dark'));assert.equal(composerText(state.doc),'/theme dark');assert.equal(undo(state,apply),true);assert.equal(composerText(state.doc),'/theme ');assert.equal(undo(state,apply),true);assert.equal(composerText(state.doc),'/th');assert.equal(redo(state,apply),true);assert.equal(state.doc.firstChild.firstChild.type.name,'command_chip');});

test('multiple paragraphs retain blank lines and map every UTF16 text position',()=>{const value='one\n\n中文🙂\n';const doc=composerDocument(value);assert.equal(doc.childCount,4);assert.equal(composerText(doc),value);for(let i=0;i<=value.length;i++)assert.equal(composerTextOffset(doc,composerPosition(doc,i)),i);});
test('cross-paragraph draft edits, selections and command replacement retain all text',()=>{let state=seed('one\ntwo\nthree');const selection=composerSelection(state.doc,2,9);state=state.apply(state.tr.setSelection(selection).insertText('!'));assert.equal(composerText(state.doc),'on!hree');state=seed('one\ntwo');state=state.apply(reconcileComposerText(state,'one more\nlast\n'));assert.equal(composerText(state.doc),'one more\nlast\n');state=state.apply(commandTransaction(state,command));assert.equal(state.doc.childCount,1);assert.equal(composerText(state.doc),'/theme ');});
test('atoms in later paragraphs keep mappings, parent-local hints and separators',()=>{const chip=selected().doc.firstChild;const empty=composerSchema.node('paragraph');let doc=composerSchema.node('doc',null,[empty,chip,empty]);assert.equal(composerText(doc),'\n/theme \n');assert.equal(composerTextOffset(doc,composerPosition(doc,7)),7);assert.deepEqual(composerArgumentHint(doc),{text:command.argumentHint,position:5});let state=EditorState.create({schema:composerSchema,doc});state=state.apply(state.tr.insertText('dark',4,5));assert.equal(composerArgumentHint(state.doc),null);state=state.apply(restoreCommandSeparators(state));assert.equal(composerText(state.doc),'\n/theme dark\n');doc=composerSchema.node('doc',null,[chip,composerSchema.node('paragraph',null,composerSchema.text('argument'))]);assert.equal(composerArgumentHint(doc),null);});

// Fidelity F05: the '@' pick is an atomic mention node (c099c328d-CbkcmYSW.js:10502-10520 Vr; shared-13 jw renderText).
const pick=(value,option)=>{let state=seed(value);state=state.apply(state.tr.setSelection(composerSelection(state.doc,value.length)));const token=mentionToken(composerText(state.doc),value.length);return state.apply(mentionTransaction(state,token,option));};
test('a mention pick replaces the token with one atom plus a space; the doc serializes to the same @path text and payload',()=>{
 const state=pick('see @sr',{path:'src/a.ts',label:'a.ts'}),paragraph=state.doc.firstChild;
 assert.deepEqual(paragraph.content.content.map(node=>node.type.name),['text','mention','text']);
 assert.deepEqual({...paragraph.child(1).attrs},{path:'src/a.ts',label:'a.ts'});assert.equal(paragraph.child(1).nodeSize,1);
 assert.equal(composerText(state.doc),'see @src/a.ts ');assert.equal(composerTextOffset(state.doc,state.selection.from),'see @src/a.ts '.length,'caret after the space');
 // The RPC payload is the one the typed '@src/a.ts ' text produced before.
 const mentions=[{path:'src/a.ts',name:'a.ts'}];
 assert.deepEqual(mentionInputs(composerText(state.doc),mentions),mentionInputs('see @src/a.ts ',mentions));
 assert.deepEqual(mentionInputs(composerText(state.doc),mentions).text_elements,[{byteRange:{start:4,end:13},placeholder:null}]);
 assert.equal(mentionLabel('src/deep/a.ts'),'a.ts');
});
test('Backspace after a mention first selects it, then deletes it whole',()=>{
 let state=pick('see @sr',{path:'src/a.ts',label:'a.ts'});state=state.apply(state.tr.delete(state.selection.from-1,state.selection.from));
 assert.equal(selectCommandBefore(state,tr=>state=state.apply(tr)),true);assert.ok(state.selection instanceof NodeSelection);assert.equal(state.selection.node.type.name,'mention');
 state=state.apply(state.tr.deleteSelection());assert.equal(composerText(state.doc),'see ');
});
test('text typed against a mention gets its separator back, so the @path stays a whole mention',()=>{
 let state=pick('@a',{path:'a.ts'});state=state.applyTransaction(state.tr.delete(2,3)).state;state=state.apply(state.tr.insertText('x',2));
 state=state.apply(restoreCommandSeparators(state));assert.equal(composerText(state.doc),'@a.ts x');
});
test('rehydrating a draft from text restores mention nodes and a known leading chip with identical text',()=>{
 const text='/pdf read @src/a.ts and @src/a.tsx\n@src/a.ts';
 const doc=composerDocument(text,{mentions:[{path:'src/a.ts'},{path:'src/a.tsx'}],chips:[{id:'pdf',kind:'skill',argumentHint:'[file]'}]});
 assert.equal(composerText(doc),text);
 assert.deepEqual(doc.firstChild.content.content.map(node=>node.type.name),['command_chip','text','mention','text','mention']);
 assert.equal(doc.firstChild.firstChild.attrs.kind,'skill');assert.deepEqual({...doc.firstChild.child(4).attrs},{path:'src/a.tsx',label:'a.tsx'});
 assert.deepEqual(doc.lastChild.content.content.map(node=>node.type.name),['mention']);
 assert.equal(composerDocument('x@src/a.ts',{mentions:['src/a.ts']}).firstChild.childCount,1,'no mention without a boundary');
 assert.equal(composerDocument('/pdfx',{chips:[{id:'pdf'}]}).firstChild.firstChild.isText,true);
 for(const value of ['', 'a\n\nb', '/pdf'])assert.equal(composerText(composerDocument(value,{chips:[{id:'pdf'}]})),value);
});
// c099c328d-CbkcmYSW.js:7926-7940 B: delete every skillChip, then focus("start").insertContent(chip + ' ').
test('Add › Skills replaces any skill chip with the picked one at the start of the draft',()=>{
 let state=seed('summarize this file');state=state.apply(state.tr.setSelection(composerSelection(state.doc,19)));
 state=state.apply(skillTransaction(state,{id:'pdf',description:'PDFs'}));
 assert.equal(composerText(state.doc),'/pdf summarize this file','typed text first, skill second: the chip still leads');
 assert.equal(state.doc.firstChild.firstChild.attrs.kind,'skill');assert.equal(composerTextOffset(state.doc,state.selection.from),5,'caret after the inserted space');
 // send(): the draft parses as the skill, and composerInput's skillChipInput turns the chip into the skill item.
 const pdf={name:'pdf',path:'/s/pdf/SKILL.md'},parsed=parseSessionCommand(composerText(state.doc),{skills:[pdf]});
 assert.equal(parsed?.skill?.name,'pdf');assert.deepEqual(skillChipInput(composerText(state.doc),parsed.skill),{text:'summarize this file',item:{type:'skill',name:'pdf',path:pdf.path}});
 state=state.apply(skillTransaction(state,{id:'fx',description:'Effects'}));
 assert.equal(composerText(state.doc),'/fx summarize this file','a second skill replaces the first, separator included');
 assert.deepEqual(state.doc.firstChild.content.content.filter(node=>node.type.name==='command_chip').map(node=>node.attrs.id),['fx']);
 state=state.apply(skillTransaction(state,{id:'fx'}));assert.equal(composerText(state.doc),'/fx summarize this file','the same skill again stays one chip');
 state=seed('one\ntwo');state=state.apply(state.tr.setSelection(composerSelection(state.doc,7)));state=state.apply(skillTransaction(state,{id:'pdf'}));
 assert.equal(composerText(state.doc),'/pdf one\ntwo','inserted at the start of the first paragraph');
 state=seed('');state=state.apply(skillTransaction(state,{id:'pdf'}));assert.equal(composerText(state.doc),'/pdf ');assert.equal(composerTextOffset(state.doc,state.selection.from),5);
 const picked=seed('/th').apply(commandTransaction(seed('/th'),{id:'theme'}));
 assert.equal(composerText(picked.apply(skillTransaction(picked,{id:'pdf'})).doc),'/pdf /theme ','a command chip is not a skill chip and stays');
 assert.equal(commandTransaction(seed('/p'),{id:'pdf',kind:'skill'}).doc.firstChild.firstChild.attrs.kind,'skill');
 assert.equal(commandTransaction(seed('/th'),command).doc.firstChild.firstChild.attrs.kind,'command');
});
