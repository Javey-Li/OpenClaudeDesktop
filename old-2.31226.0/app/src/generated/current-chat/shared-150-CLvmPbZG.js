// Extracted from installed Claude Desktop 2.31226.0. Do not edit.
import { R as m } from "./vendor-frame-foKw4lFA.js";
import { me as k } from "./vendor-frame-foKw4lFA.js";
import { pe as D } from "./vendor-frame-foKw4lFA.js";
import { K as S } from "./vendor-frame-foKw4lFA.js";
var iL=e=>e==="peach"?"default":e;
var aL={sm:64,md:96};
var oL={default:"fill-pictogram-highlight-default",heather:"fill-pictogram-highlight-heather",cactus:"fill-pictogram-highlight-cactus"};
var sL={flexShrink:0};
function lL(e,t){return{role:t.role??(e?"img":void 0),"aria-hidden":t["aria-hidden"]??(!e||void 0),"aria-label":t["aria-label"]??(e||void 0)}}
function uL(e,t,n){return typeof e=="string"?S("path",{d:e,...n},t):S("path",{d:e.d,fillRule:e.fillRule,clipRule:e.fillRule,...n},t)}
function dL({asset:e,size:t="md",highlightFill:n="default",alt:r,className:i,style:a,...o}){let s=typeof t=="number"?t:aL[t],c=m(),l=k(D,{children:[e.highlight.map((e,t)=>uL(e,`h${t}`,{className:oL[iL(n)]})),e.line.map((e,t)=>uL(e,`l${t}`,{fill:"currentColor"}))]});return S("svg",{"data-cds":"Pictogram",width:s,height:s,viewBox:"0 0 500 500",fill:"none",xmlns:"http://www.w3.org/2000/svg",style:a?{...sL,...a}:sL,className:i,...o,...lL(r,o),children:e.clip===void 0?l:k(D,{children:[S("g",{clipPath:`url(#${c})`,children:l}),S("defs",{children:S("clipPath",{id:c,children:S("path",{d:e.clip})})})]})})}

export { dL, aL, uL, oL, iL, sL, lL, m, k, D, S };
