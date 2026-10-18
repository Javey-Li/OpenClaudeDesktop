// Extracted from installed Claude Desktop 2.31226.0. Do not edit.
import { useRoutineIntl as a } from "../../source-routine-adapters.jsx";
import { V as e } from "./vendor-frame-foKw4lFA.js";
import { Cy as n } from "./shared-2-DtKYxnkM.js";
function o(){let{locale:t}=a();return e(()=>Array.from({length:7},(e,r)=>n(r,t)),[t])}
var s=[0,30];
function l(e){return(e%60+60)%60}
function f(e=Math.random,t=new Date().getTimezoneOffset()){let n=Array.from({length:40},(e,t)=>20+t).filter(e=>!s.includes(l(e+t)));return n[Math.floor(e()*n.length)]}

export { o, f, s, l, a, e, n };
