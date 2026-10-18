// Extracted from installed Claude Desktop 2.31226.0. Do not edit.
import { useRoutineSkills as r } from "../../source-routine-detail-adapters.jsx";
import { K as e } from "./vendor-frame-foKw4lFA.js";
import { pe as n } from "./vendor-frame-foKw4lFA.js";
import { d as t } from "./vendor-frame-foKw4lFA.js";
import { UnavailableRoutineBadge as i } from "../../source-routine-detail-adapters.jsx";
var a=/(^|\s)(\/[\w:.-]+)/g;
function o({prompt:o}){let s=r(),c=o.split(a);return e(n,{children:c.map((n,r)=>{if(r%3!=2)return e(t,{children:n},r);let a=n.slice(1),o=s.get(a);return o?e(i,{id:a,info:o},r):e(t,{children:n},r)})})}

export { o, a, r, e, n, t, i };
