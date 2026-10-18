// Extracted from installed Claude Desktop 2.31226.0. Do not edit.
import { pA as s } from "./shared-26-CT0kz82X.js";
import { useRoutineIntl as _ } from "../../source-routine-adapters.jsx";
import { O as w } from "./caa9df187-DFQv8cbo.js";
import { me as i } from "./vendor-frame-foKw4lFA.js";
import { ge as a } from "./vendor-frame-foKw4lFA.js";
import { K as r } from "./vendor-frame-foKw4lFA.js";
import { SourceIcon as f } from "../../source-chat-adapters.jsx";
import { zx as m } from "./shared-frame-DVFSKIcx.js";
import { L as y } from "./c0efc2620-BdXsfbkU.js";
import { Il as c } from "./shared-100-Bs3K3KCN.js";
import { k as C } from "./caa9df187-DFQv8cbo.js";
import { D as S } from "./caa9df187-DFQv8cbo.js";
import { sl as p } from "./shared-frame-DVFSKIcx.js";
import { R as x } from "./c0efc2620-BdXsfbkU.js";
import { Ml as l } from "./shared-100-Bs3K3KCN.js";
import { yu as u } from "./shared-frame-DVFSKIcx.js";
import { w as T } from "./caa9df187-DFQv8cbo.js";
import { K as b } from "./c0efc2620-BdXsfbkU.js";
import { R as e } from "./vendor-frame-foKw4lFA.js";
import { De as o } from "./shared-0-tP5vNlHv.js";
import { U as n } from "./vendor-frame-foKw4lFA.js";
import { I as t } from "./vendor-frame-foKw4lFA.js";
import { ap as d } from "./shared-frame-DVFSKIcx.js";
function D(e,r){let i=o(r),a=n(e);t(()=>(a.current&&i(!0),()=>i(!1)),[i])}
function O({loading:t,disabledReason:n,locked:a=!1,labelledBy:o,pickerOpen:s,onPickerOpenChange:c,onPress:m,intentProps:h}){let g=e();return D(s,c),t?r("span",{"data-testid":"routine-repo-placeholder-loading","data-size":"sm",className:"inline-flex h-control items-center animate-placeholder-reveal",children:r(u.Chip,{shape:"control",width:96})}):r(d,{reason:n??void 0,children:i(p,{size:"sm",variant:"secondary",disabled:a||n!==null,"aria-labelledby":`${o} ${g}`,...h,onClick:m,"data-testid":"routine-repo-placeholder",children:[r("span",{id:g,className:"truncate max-w-[200px]",children:r(l,{id:"1roxnaf"})}),r(f,{name:"CaretDown",size:"xs",className:"shrink-0 opacity-60"})]})})}
function k(e,t){return t.type==="schedule"?c({id:"1cne7dv",intl:e}):t.type==="api"?c({id:"ed5ing",intl:e}):e.formatMessage(t.desc)}
var A="min-w-12";
var j="min-w-32";
function M({type:e}){let t=_(),n=w.find(t=>t.type===e)??w[0];return i("span",{className:a("flex shrink-0 items-center gap-2 text-body text-primary",j),"data-testid":"routine-trigger-name",children:[r(f,{name:n.icon,size:"sm",className:"text-muted"}),t.formatMessage(n.title)]})}
function N({onRemove:e,disabled:t=!1,lockedReason:n}){let i=_();return r(p,{iconOnly:!0,icon:"Trash",size:"sm",variant:"ghost","aria-label":i.formatMessage(T.remove),onClick:e,disabled:t||n!==void 0,disabledReason:n??""})}
function P({value:e,eventTypesOffered:t,eventTypesBlockedReason:n,available:a,onPick:o,intentProps:s,disabled:l=!1,disabledReason:u}){let d=_(),p=w.find(t=>t.type===e)??w[0],h=d.formatMessage(p.title);return i(m.Root,{children:[r(m.TriggerButton,{size:"sm",variant:"secondary",disabled:l,disabledReason:u??"",icon:r(f,{name:p.icon,size:"sm"}),"aria-label":y(d,c({id:"cvp74g",intl:d}),h),...s,"data-testid":"routine-trigger-type",children:h}),r(m.Popup,{align:"start",className:"min-w-[280px]",children:C.filter(e=>e.type==="schedule"||t).map(t=>{let i=t.type!=="schedule"&&n!==null,s=t.type===e||a.includes(t.type);return r(m.Item,{icon:t.icon,disabled:i||!s,description:k(d,t),disabledReason:i?n:s?void 0:d.formatMessage(S.alreadyAdded),onClick:()=>{t.type!==e&&o(t.type)},children:d.formatMessage(t.title)},t.type)})})]})}
function F({available:e,eventTypesBlockedReason:t,onAdd:n,intentProps:a,disabled:o=!1}){let s=_();return e.length===0?null:i(m.Root,{children:[r(m.Trigger,{render:r(p,{iconOnly:!0,icon:"Add",size:"sm",variant:"ghost",disabled:o,"aria-label":s.formatMessage(S.addAnother),...a,"data-testid":"routine-trigger-add"})}),r(m.Popup,{align:"end",className:"min-w-[280px]",children:C.filter(t=>e.includes(t.type)).map(e=>{let i=e.type!=="schedule"&&t!==null;return r(m.Item,{icon:e.icon,disabled:i,description:k(s,e),disabledReason:i?t:void 0,onClick:()=>n(e.type),children:s.formatMessage(e.title)},e.type)})})]})}
function I({code:e,list:t=!1,headerEnd:n=null,scheduleShown:o,schedulePills:s,scheduleRowEnd:c,scheduleSubRows:d,renderRowStart:f,renderRowEnd:p,pendingEventType:m,onboardingNote:h,locked:g=!1}){let _=e?.EventRows;return i("div",{className:x,"data-testid":"routine-trigger-card",children:[t&&i("div",{className:"flex items-center gap-2 px-lg py-3.5 [&+&]:border-t-0.5 [[data-routine-inset]+&]:border-t-0.5 [[data-one-form-rows]_&]:mx-pad-lg [[data-one-form-rows]_&]:px-0","data-testid":"routine-trigger-header",children:[r("span",{className:a("mr-2 text-body text-primary","font-medium"),children:r(l,{id:"10vov3d"})}),r("div",{className:"grow"}),n]}),o&&i("div",{className:a("flex items-center gap-2 px-lg py-3.5 [&+&]:border-t-0.5 [[data-routine-inset]+&]:border-t-0.5 [[data-one-form-rows]_&]:mx-pad-lg [[data-one-form-rows]_&]:px-0","flex-wrap gap-y-2.5"),children:[f(-1,"schedule"),s,r("span",{className:"ml-auto flex shrink-0 items-center gap-2",children:c})]}),o&&d,_!==void 0&&e!==null&&r(_,{code:e,renderRowStart:f,renderRowEnd:p,layout:t?"list":"pills",locked:g}),m!==null&&e===null&&i("div",{className:a("flex items-center gap-2 px-lg py-3.5 [&+&]:border-t-0.5 [[data-routine-inset]+&]:border-t-0.5 [[data-one-form-rows]_&]:mx-pad-lg [[data-one-form-rows]_&]:px-0","gap-3"),"data-testid":"routine-trigger-row-pending",children:[t?r(M,{type:m}):r("span",{className:a("mr-2 text-body text-primary","min-w-12","font-medium"),children:r(l,{id:"10vov3d"})}),r(u.Block,{height:32,className:"w-[160px] rounded-full"}),r(u.Block,{height:32,className:"w-[200px] rounded-full"})]}),h]})}
function L({repositoryOnly:e=!1,onSetUp:t}){return i(b,{icon:r(f,{name:"Info",size:"sm",className:"text-muted"}),children:[r("span",{className:"mr-2",children:e?r(l,{id:"1mbgtmi"}):r(l,{id:"1fsserb"})}),r(p,{size:"xs",variant:"secondary",onClick:t,children:r(l,{id:"y1ol33"})})]})}
function R(e){return e.cronExpression?{kind:"cron",cron:e.cronIsUtc?e.cronExpression:s(e.cronExpression)}:e.fireAtMs===void 0?null:{kind:"once",runOnceAt:new Date(e.fireAtMs).toISOString()}}
function H(e,t,n){return t!==null&&JSON.stringify(e)!==t?e:n}

export { R, H, M, j, A, P, k, F, I, N, L, O, D, s, _, w, i, a, r, f, m, y, c, C, S, p, x, l, u, T, b, e, o, n, t, d };
