import {beginFileContextDrag,isFileContextDrag,draggedFilePaths,commitFileContextDrag} from './generated/code-editor/file-context-drag.mjs';
export function startFileContextDrag(event,owner,paths,attach){
 if(!owner||!Array.isArray(paths)||!paths.length||paths.length>100||typeof attach!=='function'){event.preventDefault();return false;}
 beginFileContextDrag(event,owner,attach,paths);return true;
}
export function acceptsFileContextDrag(event,owner){return !!owner&&draggedFilePaths(owner)!==undefined&&isFileContextDrag(event);}
export function dropFileContextDrag(event,owner){
 if(!acceptsFileContextDrag(event,owner))return false;
 event.preventDefault();event.stopPropagation();commitFileContextDrag();return true;
}
