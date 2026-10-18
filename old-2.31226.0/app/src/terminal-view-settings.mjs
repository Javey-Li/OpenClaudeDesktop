import { t } from '../electron/i18n/index.mjs';
// 2.31226.0 cf718f694 C/w/T/E, D/O/k/A and cccc2cf0a Jw.
export const TERMINAL_VIEW_KEYS = Object.freeze({cursorStyle:'epitaxy-terminal-cursor-style',cursorBlink:'epitaxy-terminal-cursor-blink',copyOnSelect:'epitaxy-terminal-copy-on-select',scrollback:'epitaxy-terminal-scrollback'});
export const CURSOR_STYLES = ['block','bar','underline'];
export const SCROLLBACK_OPTIONS = [1000,5000,10000];
export const DEFAULT_TERMINAL_VIEW = Object.freeze({cursorStyle:'block',cursorBlink:true,copyOnSelect:false,scrollback:10000});
export function normalizeTerminalView(values={}) {
 return {cursorStyle:CURSOR_STYLES.find(value=>value===values.cursorStyle)??'block',cursorBlink:values.cursorBlink!==false,copyOnSelect:values.copyOnSelect===true,scrollback:SCROLLBACK_OPTIONS.find(value=>value===values.scrollback)??10000};
}
export function createTerminalViewSettings({storage,subscribeStorage=()=>()=>{}}={}) {
 const read=()=>normalizeTerminalView(Object.fromEntries(Object.entries(TERMINAL_VIEW_KEYS).map(([key,item])=>{try{return [key,JSON.parse(storage?.getItem(item)??'null')];}catch{return [key,undefined];}})));
 let current=read();const listeners=new Set();
 const publish=next=>{if(Object.keys(TERMINAL_VIEW_KEYS).every(key=>next[key]===current[key]))return;current=next;for(const listener of [...listeners])listener();};
 const off=subscribeStorage(event=>{if(event.storageArea&&event.storageArea!==storage)return;if(event.key===null||Object.values(TERMINAL_VIEW_KEYS).includes(event.key))publish(read());});
 return {getSnapshot:()=>current,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},set(key,value){if(!Object.hasOwn(TERMINAL_VIEW_KEYS,key))return;const next=normalizeTerminalView({...current,[key]:value});try{storage?.setItem(TERMINAL_VIEW_KEYS[key],JSON.stringify(next[key]));}catch{}publish(next);},dispose(){off();listeners.clear();}};
}
export function terminalViewMenu(settings,set) {
 const labels={block:t('Block'),bar:t('Bar'),underline:t('Underline')};
 const lines=value=>t('{count} lines',{count:value.toLocaleString()});
 return [{key:'terminal-view',items:[
  {value:'terminal-cursor-style',label:t('Cursor style'),hint:labels[settings.cursorStyle],items:CURSOR_STYLES.map(value=>({value:`terminal-cursor-style-${value}`,label:labels[value],checked:settings.cursorStyle===value,checkedRole:'radio',onSelect:()=>set('cursorStyle',value)}))},
  {value:'terminal-cursor-blink',label:t('Blink cursor'),checked:settings.cursorBlink,checkedRole:'checkbox',keepOpen:true,onSelect:()=>set('cursorBlink',!settings.cursorBlink)},
  {value:'terminal-copy-on-select',label:t('Copy on select'),checked:settings.copyOnSelect,checkedRole:'checkbox',keepOpen:true,onSelect:()=>set('copyOnSelect',!settings.copyOnSelect)},
  {value:'terminal-scrollback',label:t('Scrollback'),hint:lines(settings.scrollback),items:SCROLLBACK_OPTIONS.map(value=>({value:`terminal-scrollback-${value}`,label:lines(value),checked:settings.scrollback===value,checkedRole:'radio',onSelect:()=>set('scrollback',value)}))},
 ]}];
}
export function terminalViewOptions(settings,reducedMotion=false){return {cursorStyle:settings.cursorStyle,cursorBlink:settings.cursorBlink&&!reducedMotion,scrollback:settings.scrollback};}
let shared;
export function terminalViewSettings(){
 if(!shared){let storage;try{storage=window.localStorage;}catch{}shared=createTerminalViewSettings({storage,subscribeStorage:fn=>{if(typeof window==='undefined')return()=>{};window.addEventListener('storage',fn);return()=>window.removeEventListener('storage',fn);}});}
 return shared;
}
