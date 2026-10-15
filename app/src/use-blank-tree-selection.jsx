import {useRef} from 'react';
import {isBlankTreePress,isBlankTreeTarget} from './generated/code-editor/file-tree-pointer.mjs';
export function useBlankTreeSelection(clear){
 const pressed=useRef(false);
 return {onPointerDown:event=>{pressed.current=isBlankTreePress(event);},onPointerCancel:()=>{pressed.current=false;},onClick:event=>{const blank=pressed.current;pressed.current=false;if(blank&&isBlankTreeTarget(event))clear();}};
}
