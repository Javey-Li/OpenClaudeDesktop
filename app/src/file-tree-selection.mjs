import {createOriginalFileSelection,selectFileRange,selectAllFiles} from './generated/code-editor/file-selection.mjs';
export {selectFileRange,selectAllFiles};
export function createFileTreeSelection(){
 return createOriginalFileSelection(initialize=>{
  const listeners=new Set();let state;
  const store={getState:()=>state,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
  const set=patch=>{state={...state,...patch};for(const listener of listeners)listener();};
  state=initialize(set,store.getState);return store;
 });
}
