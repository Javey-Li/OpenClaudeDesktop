// Extracted from installed Claude Desktop 2.31226.0. Do not edit.
import { Sw as un } from "./shared-75-BauJ3twV.js";
import { Ft as je } from "./shared-0-tP5vNlHv.js";
import { k as T } from "./shared-0-tP5vNlHv.js";
import { x as v } from "./vendor-frame-foKw4lFA.js";
import { X as gi } from "./shared-frame-DVFSKIcx.js";
var Sa="[--cmp-type-size:max(var(--cds-font-size-text-entry-floor,0px),var(--cmp-font-size,var(--cds-font-size-prose)))] [--cmp-leading:round(var(--cmp-type-size)*1.4,1px)] [--cmp-row-py:max(0px,(var(--cds-h-control)-var(--cmp-leading))/2)] [--cmp-row-h:calc(var(--cmp-leading)+2*var(--cmp-row-py))]";
var Ca=`${Sa} py-[var(--cmp-row-py)] text-[length:var(--cmp-type-size)] leading-[var(--cmp-leading)] font-normal`;
var wa="motion-safe:duration-200";
var Ta=`motion-safe:transition-[padding-left,padding-right] ${wa}`;
var Ea=`transition-opacity duration-200 motion-safe:transition-[opacity,padding-left,padding-right] ${wa}`;
var Da=`w-full max-h-96 min-h-[var(--cmp-row-h)] overflow-y-auto break-words ${Ca} ${Ea}`;
function Oa(e,t){let n=ka(e)?`calc(${e}lh + 2 * var(--cmp-row-py))`:void 0;if(n!==void 0||t!==void 0)return{...n===void 0?void 0:{minHeight:n},...t===void 0?void 0:{maxHeight:t}}}
function ka(e){return e!==void 0&&e>1}
var Aa={glyph:"pl-[6px] compact:pl-[6px] comfortable:pl-[8px]",text:"pl-[4px] compact:pl-[4px] comfortable:pl-[6px]"};
function ja(e){return e==="none"?void 0:Aa[e]}
var Na=.3;
var Pa=v({multiline:!1,startInset:"none",endInset:"none",glideArmed:!0,columnReservesTrailing:!1});
var Fa=v({hasContent:!1,busy:!1,pinSend:!1,form:"new"});
var Ia=v(null);
var Ra="pr-[var(--cmp-trail-w,0px)]";
function za({startInset:e,disabled:t,settled:n,className:r}){return gi(Da,ja(e),!n&&"transition-none motion-safe:transition-none",t&&"cursor-default opacity-60",r)}
var dx=60;
function fx(e){if(e===void 0)return;let t=un(e);return t===""?void 0:t}
function px(e){let t=fx(e);if(t===void 0)return;let n=[...t];return n.length>dx?`${n.slice(0,59).join("")}\u2026`:t}
var mx=new Set(["Claude Desktop (macOS)","Claude Desktop (Windows)","Claude Desktop (Linux)"]);
function hx(e){let t=fx(e);return t!==void 0&&mx.has(t)}
function Pk(e){return e.toolName==="Artifact"&&e.ruleContent==="publish"}
function Fk(e){return/^\d+$/.test(e)}
function Ik(e){if(!e)return null;let t=e.trim().split(/\s+/);if(t.length!==5)return null;let[n,r,i,a,o]=t;if(!Fk(n))return null;let s=parseInt(n,10);if(s<0||s>59)return null;if(r==="*"&&i==="*"&&a==="*"&&o==="*")return{frequency:"hourly",hour:9,minute:s,dayOfWeek:1};if(a!=="*"||!Fk(r))return null;let c=parseInt(r,10);if(c<0||c>23)return null;if(i!=="*"){if(o!=="*"||!Fk(i))return null;let e=parseInt(i,10);return e<1||e>31?null:{frequency:"monthly",hour:c,minute:s,dayOfWeek:1,dayOfMonth:e}}if(o==="*")return{frequency:"daily",hour:c,minute:s,dayOfWeek:1};if(o==="1-5")return{frequency:"weekdays",hour:c,minute:s,dayOfWeek:1};if(Fk(o)){let e=parseInt(o,10);if(e>=0&&e<=7)return{frequency:"weekly",hour:c,minute:s,dayOfWeek:e===7?0:e}}return null}
var zk=[[0,59],[0,23],[1,31],[1,12],[0,7]];
var Bk=[[0,59],[0,23],[1,31],[1,12],[0,6]];
function Vk(e){if(!/^[\d*-]+(\/\d+)?$/.test(e))return null;let[t,n,r]=e.split("/");if(r!==void 0||t===""||n==="")return null;let i;if(n!==void 0&&(!Fk(n)||(i=parseInt(n,10),i===0||!Number.isSafeInteger(i))))return null;if(t==="*")return{start:"*",step:i};let[a,o,s]=t.split("-");if(s!==void 0||o===""||!Fk(a))return null;let c=parseInt(a,10);return o===void 0?{start:c,step:i}:Fk(o)?{start:c,end:parseInt(o,10),step:i}:null}
function Hk(e,t,n=!1){let[r,i]=zk[t],a=t===4,o=new Set;for(let t of e.split(",")){let e=Vk(t.trim());if(e===null||e.start!=="*"&&(e.start<r||e.start>i||e.end!==void 0&&(e.end<r||e.end>i||e.start>e.end)))return null;let s=t=>{if(e.start==="*")return e.step===void 0||(t-(n?r:0))%e.step===0;if(e.end!==void 0){if(t<e.start||t>e.end)return!1}else if(e.step!==void 0){if(t<e.start)return!1}else if(t!==e.start)return!1;return e.step===void 0||(t-e.start)%e.step===0};for(let e=r;e<=i;e++)s(e)&&o.add(a&&e===7?0:e)}return o}
function Uk(e,t){let[n,r]=Bk[t],i=new Set;for(let t of e.split(",")){let e=Vk(t.trim());if(e===null)return null;let a,o;if(e.start==="*"?(a=n,o=r):(a=e.start,o=e.end===void 0?e.step===void 0?e.start:r:e.end),a<n||o>r||a>o)return null;let s=e.step??1;for(let e=a;e<=o;e+=s)i.add(e)}return i}
var Wk=[31,29,31,30,31,30,31,31,30,31,30,31];
function Gk(e){return e.length===5&&e[4]==="7"?[...e.slice(0,4),"0"]:[...e]}
function Kk(e){if(e.length!==5||e[2]!=="*"&&e[4]!=="*")return!1;let t=[];for(let n=0;n<5;n++){let r=Hk(e[n],n);if(r===null)return!1;let i=Uk(e[n],n);if(i===null||r.size!==i.size)return!1;for(let e of r)if(!i.has(e))return!1;t.push(r)}let n=t[2],r=t[3],i=!1;for(let e of r){for(let t of n)if(t<=Wk[e-1]){i=!0;break}if(i)break}return i}
function qk(e){return e.split(",").some(e=>{let t=Vk(e.trim());return t?.start==="*"&&(t.step??1)===1})}
function Jk(e,t,n){let[r,i]=Bk[t];return e.size===i-r+1?n?"*":`${r}-${i}`:[...e].sort((e,t)=>e-t).join(",")}
function Yk(e,t,n,r){let i=Uk(e,t);return i!==null&&i.size===n.size&&[...i].every(e=>n.has(e))&&(r===void 0||qk(e)===r)?e:Jk(n,t,r!==!1)}
function Xk(e){let t=e.trim().split(/\s+/);if(t.length!==5)return null;let n=[];for(let e=0;e<5;e++){let r=Hk(t[e],e,!0);if(r===null||r.size===0)return null;n.push(r)}let[r,,i,a,o]=n,s=!t[2].startsWith("*")&&!t[4].startsWith("*"),c=i.size<31,l=o.size<7;if(!s&&c&&l)return null;let u=[...a].some(e=>[...i].some(t=>t<=Wk[e-1]));if(!s&&!u)return null;let d=e=>s?!1:e||!c&&!l?void 0:!0;return{cron:[Fk(t[0])?t[0]:String(Math.min(...r)),t[1],Yk(t[2],2,i,d(c)),t[3],Yk(t[4],4,o,d(l))].join(" "),fewerRuns:r.size>1}}
function Zk(e){return e?.length===1&&je(e[0])}
function Qk(e,t={}){return $k(e,t).reasons}
function $k(e,t={}){let n=[],r=e.cronExpression;e.prompt||n.push("no_prompt");let i=(e.userSelectedFolders?.length??0)>0;((e.userSelectedFiles?.length??0)>0&&!t.remoteFilesSupported||i&&!t.remoteFoldersSupported)&&n.push("local_folders");let a=e.userSelectedProjectUuids??[];if(a.length>0&&!(t.remoteProjectsSupported&&Zk(a))&&n.push("projects"),e.spaceId&&n.push("space"),(e.chromePermissionMode||(e.chromeAllowedDomains?.length??0)>0)&&n.push("chrome"),(e.cwd||e.place||e.useWorktree||e.sourceBranch)&&n.push("cwd"),e.dispatchSubscribed&&n.push("dispatch_hook"),e.approvedPermissions?.some(e=>e.ruleContent&&!Pk(e))&&n.push("pattern_approvals"),e.cronExpression){let[i]=e.cronExpression.trim().split(/\s+/);if(i!==void 0&&/[*/,-]/.test(i))n.push("sub_hourly");else if(Ik(e.cronExpression)===null){if(t.currentLocalScheduler){let t=Xk(e.cronExpression);t===null?n.push("custom_cron"):r=t.cron}else Kk(Gk(e.cronExpression.trim().split(/\s+/)))||n.push("custom_cron")}}return{reasons:n,cronExpression:r}}
function eA(e,t={}){let[n]=Qk(e,t);return n===void 0?{ok:!0}:{ok:!1,reason:n}}
function tA(e){return e==="auto"||e==="bypassPermissions"}
var iA=1440;
function aA(e,t){let n=new Date().getTimezoneOffset(),r=((e*60+t+n)%iA+iA)%iA;return{hour:Math.floor(r/60),minute:r%60}}
function oA(e,t,n){let r=new Date().getTimezoneOffset(),i=e*60+t+r,a=n;i>=iA?a=(n+1)%7:i<0&&(a=(n-1+7)%7);let o=(i%iA+iA)%iA;return{hour:Math.floor(o/60),minute:o%60,dow:a}}
function sA(e){let t=e.minute??0;switch(e.frequency){case"hourly":return`${t} * * * *`;case"daily":{let n=aA(e.hour,t);return`${n.minute} ${n.hour} * * *`}case"weekdays":{let n=oA(e.hour,t,1);return`${n.minute} ${n.hour} * * ${n.dow}-${n.dow+4}`}case"weekly":{let n=oA(e.hour,t,e.dayOfWeek);return`${n.minute} ${n.hour} * * ${n.dow}`}}}
function cA(e){let t=e.minute??0;switch(e.frequency){case"hourly":return`${t} * * * *`;case"daily":return`${t} ${e.hour} * * *`;case"weekdays":return`${t} ${e.hour} * * 1-5`;case"weekly":return`${t} ${e.hour} * * ${e.dayOfWeek}`;case"monthly":return`${t} ${e.hour} ${e.dayOfMonth} * *`}}
function lA(){return Intl.DateTimeFormat().resolvedOptions().timeZone}
var uA=T(()=>{try{return new Set(Intl.supportedValuesOf("timeZone"))}catch{return new Set}});
function dA(e){return e?e==="UTC"||/^Etc\/GMT(?:\+(?:\d|1[0-2])|-(?:\d|1[0-4]))$/.test(e)||uA().has(e):!1}
function fA(){let e=lA();if(dA(e))return e;let t=new Date().getTimezoneOffset()/60;if(t!==0)return Number.isInteger(t)&&t<=12&&t>=-14?`Etc/GMT${t>0?"+":"-"}${Math.abs(t)}`:e==="Etc/Unknown"?void 0:e}
function pA(e){let t=Ik(e),n=fA();if(!t){let t=e.trim().split(/\s+/),r=t.length===5&&t[4]==="7"?Gk(t).join(" "):e.trim();return n?`CRON_TZ=${n} ${r}`:r}if(t.frequency==="monthly"){let e=cA(t);return n?`CRON_TZ=${n} ${e}`:e}return t.frequency==="hourly"||!n?sA(t):`CRON_TZ=${n} ${cA(t)}`}

export { Ik, Fk, hx, fx, mx, px, dx, eA, Qk, $k, Zk, Pk, Xk, Hk, zk, Vk, Wk, Yk, Uk, Bk, qk, Jk, Kk, Gk, tA, cA, pA, fA, lA, dA, uA, sA, aA, iA, oA, Pa, ja, Aa, Fa, Ca, Sa, Ta, wa, Na, ka, Ra, Ia, za, Da, Ea, Oa, un, je, T, v, gi };
