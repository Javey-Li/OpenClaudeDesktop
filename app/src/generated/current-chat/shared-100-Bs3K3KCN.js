// Extracted from installed Claude Desktop 2.31226.0. Do not edit.
import { q as Vr } from "./vendor-intl-C-oMXuBz.js";
import { K as v } from "./vendor-frame-foKw4lFA.js";
import { pe as y } from "./vendor-frame-foKw4lFA.js";
import { Gt as Br } from "./vendor-intl-C-oMXuBz.js";
var Xi="secret";
function Zi(e){return`${Xi}:${e}`}
var El=new Set;
function kl(e,t){for(let n of El)try{n(e,t)}catch{}}
function jl(e,t,n=!1){let{messages:r}=e,i=r?.[t];if(typeof i=="string")return i.replace(/'\{(.*?)\}'/gi,"{$1}");if(r&&!Object.hasOwn(r,t))return n&&El.size>0&&e.locale.toLowerCase()!==e.defaultLocale.toLowerCase()&&kl(t,e.locale)," "}
function Ml({id:e,dangerouslyVisiblePublicValues:t}){let n=Vr();if(t===void 0){let t=jl(n,Zi(e),!0);if(t!==void 0)return v(y,{children:t})}return v(Br,{id:Zi(e),defaultMessage:" ",values:t})}
function Fl(e,t){let n=e??{},r=Zi(t);if(!(r in n))return!1;let i=n[r];return typeof i=="string"?i.trim().length>0:Array.isArray(i)?i.some(e=>e.type!==0||e.value.trim().length>0):i!=null}
function Il({id:e,intl:t,dangerouslyVisiblePublicValues:n}){let r=Zi(e);if(n===void 0){let e=jl(t,r);if(e!==void 0)return e}return t.formatMessage({id:r,defaultMessage:" "},n)}
function Fb(e,t=!1,n=!1){return t||e.liveStatus==="awaiting"?"awaiting":e.liveStatus?e.liveStatus:!n&&e.pendingToolPermissions?.length?"awaiting":e.isRunning?"running":"idle"}

export { Il, Zi, Xi, jl, El, kl, Fl, Ml, Fb, Vr, v, y, Br };
