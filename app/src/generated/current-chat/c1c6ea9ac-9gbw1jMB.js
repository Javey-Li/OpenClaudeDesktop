// Extracted from installed Claude Desktop 2.31226.0. Do not edit.
import { W as e } from "./vendor-frame-foKw4lFA.js";
import { U as n } from "./vendor-frame-foKw4lFA.js";
import { ee as t } from "./vendor-frame-foKw4lFA.js";
import { M as r } from "./vendor-frame-foKw4lFA.js";
import { lc as a } from "./shared-25-B37c0AC9.js";
import { cc as i } from "./shared-25-B37c0AC9.js";
function o(o,s,{frozen:c=!1,axis:l="x"}={}){let[u,d]=e(!1),f=n(o);t(()=>{f.current=o},[o]);let p=r(()=>{let e=f.current;d(e!==null&&(l==="y"?e.scrollHeight>e.clientHeight:e.scrollWidth>e.clientWidth))},[l]);return t(()=>{if(c)return;if(!o){p();return}let e=new(a(o))(p);e.observe(o),p();let t=!0;return i(o).fonts?.ready.then(()=>{t&&p()}),()=>{t=!1,e.disconnect()}},[o,c,p]),t(()=>{c||p()},[c,p,s]),u}

export { o, e, n, t, r, a, i };
