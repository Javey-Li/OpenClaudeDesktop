// Extracted from installed Claude Desktop 2.31226.0. Do not edit.
import { M as x } from "./vendor-frame-foKw4lFA.js";
import { G as v } from "./vendor-frame-foKw4lFA.js";
import { U as y } from "./vendor-frame-foKw4lFA.js";
import { I as g } from "./vendor-frame-foKw4lFA.js";
import { W as m } from "./vendor-frame-foKw4lFA.js";
function Te(e){return(...t)=>e.current(...t)}
function De(e){let t=y(e);g(()=>{t.current=e},[e]);let[n]=m(()=>Te(t));return n}
function Be(e,t){let n=x(n=>{let r=(t??window).matchMedia(e);return r.addEventListener("change",n),()=>r.removeEventListener("change",n)},[e,t]),r=x(()=>(t??window).matchMedia(e).matches,[e,t]);return v(n,r,()=>!1)}
var Pt=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function Ft(e){return typeof e=="string"&&Pt.test(e)}
function k(e){let t,n=!1;return()=>(n||=(t=e(),!0),t)}
function F(e){if(e.startsWith("__gb__"))return e.slice(6);let t=0;for(let n=0;n<e.length;n++)t=(t<<5)-t+e.charCodeAt(n),t&=t;return((t&4294967295)>>>0).toString()}
var gr=null;
function vr(){return typeof window>"u"?null:gr}
function Cr(e){let t=vr();return t?t.isOn(F(e)):!1}
var Gg=function(e){return e.PerTaskLimit="per_task_limit",e.GlobalLimit="global_limit",e.SignInRequired="sign_in_required",e.HostUnavailable="host_unavailable",e.HostNotAllowed="host_not_allowed",e.ConnectionRemoved="connection_removed",e.FolderNotTrusted="folder_not_trusted",e.FolderMissing="folder_missing",e.StartFailed="start_failed",e.NotAvailable="not_available",e.NotRunBeforeUpdate="not_run_before_update",e}({});
function PO(e){return Cr(e)}
var lN="https://support.claude.com/en/articles/13364135-use-claude-cowork-safely";

export { PO, Cr, vr, gr, F, k, Ft, Pt, Be, lN, De, Te, Gg, x, v, y, g, m };
