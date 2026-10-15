import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {EditorState,Compartment,history,undo,redo,highlightWhitespace,scrollPastEnd,lineNumbers} from '../src/code-editor-core.mjs';

test('extracted editor bytes match the installed-reference snapshot and contain only the declared vendor dependency',async()=>{
 const root=path.resolve(import.meta.dirname,'..');
 const dir=path.join(root,'src/generated/code-editor');
 const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json')));
 assert.equal(manifest.referenceVersion,'2.31226.0');
 for(const entry of manifest.modules){
  const generated=await fs.readFile(path.join(dir,entry.name));
  const reference=await fs.readFile(path.join(root,'../reference/current-2.31226.0/ion-dist/assets/v1',entry.name));
  assert.deepEqual(generated,reference);assert.equal(createHash('sha256').update(generated).digest('hex'),entry.sha256);
 }
 assert.deepEqual(manifest.modules[0].imports,['./vendor-prosemirror-DGtrMU0c.js']);
 assert.deepEqual(manifest.modules[1].imports,[]);
});
test('original CodeMirror state preserves edits, undo/redo and live tab-size reconfiguration',()=>{
 const tabSize=new Compartment();let state=EditorState.create({doc:'\talpha\n',extensions:[history(),tabSize.of(EditorState.tabSize.of(4)),highlightWhitespace(),scrollPastEnd(),lineNumbers()]});
 const dispatch=transaction=>{state=transaction.state;};
 dispatch(state.update({changes:{from:1,to:6,insert:'beta'},userEvent:'input'}));assert.equal(state.doc.toString(),'\tbeta\n');
 assert.equal(undo({state,dispatch}),true);assert.equal(state.doc.toString(),'\talpha\n');
 assert.equal(redo({state,dispatch}),true);assert.equal(state.doc.toString(),'\tbeta\n');
 dispatch(state.update({effects:tabSize.reconfigure(EditorState.tabSize.of(8))}));assert.equal(state.tabSize,8);
 assert.equal(state.doc.toString(),'\tbeta\n');
});
