// Extracted from installed Claude Desktop 2.31226.0. Do not edit.
import { W as u } from "./vendor-frame-foKw4lFA.js";
import { U as _ } from "./vendor-frame-foKw4lFA.js";
import { I as f } from "./vendor-frame-foKw4lFA.js";
import { M as b } from "./vendor-frame-foKw4lFA.js";
var vu="data-cds-dock-group";
var Du="in-data-cds-dock-masked:bg-page";
var bv="max-w-5xl";
function FF(e={}){let{timeout:t=2e3,trim:n=!0}=e,[r,i]=u(!1),a=_(void 0),o=_(!0);return f(()=>(o.current=!0,()=>{o.current=!1,a.current!==void 0&&(clearTimeout(a.current),a.current=void 0),i(!1)}),[]),{didCopy:r,copyToClipboard:b(async(e,r)=>{let s=typeof e=="string"?e:e.text,c=await IF(n?s.trim():s,typeof e=="string"?void 0:e.html,r);return!c||!o.current?c:(a.current!==void 0&&clearTimeout(a.current),i(!0),a.current=setTimeout(()=>{i(!1),a.current=void 0},t),!0)},[t,n])}}
async function IF(e,t,n){let r=(n?.ownerDocument?.defaultView??globalThis).navigator?.clipboard;if(!r)return!1;if(t)try{return await r.write([new ClipboardItem({"text/plain":new Blob([e],{type:"text/plain"}),"text/html":new Blob([t],{type:"text/html"})})]),!0}catch{}try{return await r.writeText(e),!0}catch{return!1}}

export { FF, IF, bv, vu, Du, u, _, f, b };
