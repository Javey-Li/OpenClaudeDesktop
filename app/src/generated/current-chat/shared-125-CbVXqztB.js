// Extracted from installed Claude Desktop 2.31226.0. Do not edit.
import { V as C } from "./vendor-frame-foKw4lFA.js";
import { F as f } from "./vendor-frame-foKw4lFA.js";
import { G as g } from "./vendor-frame-foKw4lFA.js";
function DK(e,t){let n=f(t),r=f(e);return Object.is(n,t)?r:e}
var OK=2**31-1;
function kK(){return()=>void 0}
function jK(e){let t=C(()=>PK(e),[e]);return DK(g(t.subscribe,t.getSnapshot,t.getSnapshot),e)}
function PK(e){let t=()=>e===null||Date.now()<e;return e===null?{subscribe:kK,getSnapshot:t}:{subscribe:t=>{let n,r=typeof document<"u",i=()=>{clearTimeout(n),r&&(document.removeEventListener("visibilitychange",a),window.removeEventListener("focus",a))},a=()=>{clearTimeout(n);let r=e-Date.now();if(!(r>0)){i(),t();return}n=setTimeout(a,Math.min(r,OK))};return r&&(document.addEventListener("visibilitychange",a),window.addEventListener("focus",a)),a(),i},getSnapshot:t}}

export { jK, PK, kK, OK, DK, C, f, g };
