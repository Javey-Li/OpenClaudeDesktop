// Extracted from installed Claude Desktop 2.31226.0. Do not edit.
import { me as O } from "./vendor-frame-foKw4lFA.js";
import { K as w } from "./vendor-frame-foKw4lFA.js";
import { ge as k } from "./vendor-frame-foKw4lFA.js";
import { yu as Y } from "./shared-frame-DVFSKIcx.js";
import { LocalizedMessage as Z } from "../../source-chat-adapters.jsx";
import { useRoutineIntl as Q } from "../../source-routine-adapters.jsx";
import { useRoutineAnalytics as Ec } from "../../source-routine-adapters.jsx";
import { useRoutineErrors as ti } from "../../source-routine-adapters.jsx";
import { useRoutineBridge as ts } from "../../source-routine-adapters.jsx";
import { jy as ff } from "./shared-2-DtKYxnkM.js";
import { Il as J } from "./shared-100-Bs3K3KCN.js";
import { xb as Id } from "./shared-2-DtKYxnkM.js";
import { My as ef } from "./shared-2-DtKYxnkM.js";
import { Ky as mf } from "./shared-2-DtKYxnkM.js";
import { noRemoteModel as Wd } from "../../source-routine-adapters.jsx";
import { noRemoteModel as Oo } from "../../source-routine-adapters.jsx";
import { V as N } from "./vendor-frame-foKw4lFA.js";
import { unavailableMigration as Do } from "../../source-routine-adapters.jsx";
import { noRemoteModel as zd } from "../../source-routine-adapters.jsx";
import { M as D } from "./vendor-frame-foKw4lFA.js";
import { tn as X } from "./vendor-intl-C-oMXuBz.js";
import { PO as tt } from "./shared-0-tP5vNlHv.js";
import { wb as Gd } from "./shared-2-DtKYxnkM.js";
import { routineErrorMessage as Lt } from "../../source-routine-adapters.jsx";
import { HostButton as id } from "../../source-chat-adapters.jsx";
import { RoutineSourceMenu as fd } from "../../source-routine-adapters.jsx";
import { HostTooltip as Zu } from "../../source-chat-adapters.jsx";
import { UnavailableRoutineBadge as UV } from "../../source-routine-adapters.jsx";
import { RoutineFragment as rg } from "../../source-routine-detail-adapters.jsx";
import { pe as E } from "./vendor-frame-foKw4lFA.js";
import { RoutineSourceMenu as tg } from "../../source-routine-adapters.jsx";
import { By as of } from "./shared-2-DtKYxnkM.js";
import { noRemoteModel as Xh } from "../../source-routine-adapters.jsx";
import { useDesktopFrame as Ru } from "../../source-chat-adapters.jsx";
import { bv as Ot } from "./shared-1-BPVqFfwb.js";
import { homeTone as wD } from "../../source-home-adapters.jsx";
import { HomeIcon as rd } from "../../source-home-adapters.jsx";
import { HomeStatusDot as _D } from "../../source-home-adapters.jsx";
import { useDesktopFrame as iE } from "../../source-chat-adapters.jsx";
import { oc as Sr } from "./shared-25-B37c0AC9.js";
function Iy(e){return"getAnimations"in e&&typeof e.getAnimations=="function"}
function Ly(e){let t=e.target;if(!Iy(t))return;let n=Sr(t)?.performance.timeOrigin??performance.timeOrigin;for(let e of t.getAnimations()){let t=e.effect?.getTiming(),r=t?.duration;t?.iterations!==1/0||typeof r!="number"||r<=0||(e.startTime=-(n%r))}}
function Ry({kind:e}){return w("span",{className:"status-dot","data-kind":e,onAnimationStart:Ly})}
function Px({children:e,className:t,narrow:n}){let r=Ru()?"div":"main";return w(r,{className:k("mx-auto mt-4 w-full flex-1 px-md md:px-8 lg:mt-6",n?Ot:"max-w-7xl",t),children:e})}
function ES(e,t,n){let r=of(e,t);return n&&(r==="paused"||r==="active")?"on-hold":r}
var mT="./assets/v1/c25011d97-Dg-b7-mk.png";
function hT({className:e,size:t}){let n={backgroundImage:`url(${mT})`},r=t===void 0?n:{...n,width:t,height:t};return w("span",{className:k("status-dot",e),"data-kind":"clay",style:r,onAnimationStart:Ly})}
function lD(e){e.buttons===0&&e.stopPropagation()}
function uD({label:e,detail:t,live:n=!1,tooltip:r=!0,triggerClassName:i="",children:a}){let o=iE(),s=w("span",{role:n?"status":"img","aria-label":e,className:`flex min-h-3.5 min-w-3.5 shrink-0 items-center justify-center ${i}`,onPointerMove:lD,onPointerEnter:lD,onMouseMove:lD,children:a});return!r||!o?s:w(Zu,{content:e,detail:t,delay:500,closeDelay:0,hoverable:!1,lazy:!0,className:"pointer-events-none",children:s})}
var pD="[mask-image:radial-gradient(circle_at_calc(100%_-_1px)_4px,transparent_5px,black_5.5px)]";
var mD="[mask-image:radial-gradient(circle_at_calc(100%_-_1px)_4px,transparent_6.5px,black_7px)]";
var hD={ChatSimple:14};
function gD({name:e,dot:t,muted:n=!0}){let r=hD[e],i=t==="error",a=wD(SD);return O("span",{className:"relative inline-flex",children:[w(rd,{name:e,...r===void 0?{size:"auto"}:{customSize:r},className:k(n&&"text-muted",t&&(i?mD:pD))}),t&&(i?w("span",{"aria-hidden":!0,className:"absolute -top-px -right-1",children:w(rd,{name:"Warning",customSize:10,className:a})}):w("span",{"aria-hidden":!0,className:"absolute top-px -right-0.5",children:w(_D,{kind:t})}))]})}
var SD="text-warning";
function pI({count:e=6,columns:t="two",variant:n="text",silent:r=!1,gallery:i=!1,textCardHeightPx:a,className:o,gridClassName:s}){return O("div",{role:r?void 0:"status","aria-hidden":r||void 0,className:o,children:[!r&&w("span",{className:"sr-only",children:w(Z,{defaultMessage:"Loading",id:"iFsDVRnIHW"})}),w("div",{"aria-hidden":!0,className:s??(t==="three"?"grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3":"grid auto-rows-fr grid-cols-1 gap-3 md:grid-cols-2 md:gap-6"),children:Array.from({length:e}).map((e,t)=>n==="thumbnail"?i?w(mI,{},t):O("div",{className:"flex flex-col rounded-card bg-surface-1 shadow-card-ring [--cds-ring-inner:1px] [--cds-ring-outer:0px]",children:[w("div",{className:"h-[164px]"}),w("div",{className:"mx-px border-t border-alpha-1"}),O("div",{className:"flex flex-col gap-xs p-lg pt-md",children:[w("div",{className:"flex h-5 items-center",children:w(Y,{height:14,width:"70%"})}),w("div",{className:"flex h-4 items-center",children:w(Y,{height:11,width:"50%"})})]})]},t):O("div",{className:k("flex",a===void 0&&"h-[140px]","flex-col gap-md rounded-card bg-surface-1 p-lg shadow-card-ring [--cds-ring-inner:1px] [--cds-ring-outer:0px]"),style:a===void 0?void 0:{height:a},children:[w(Y,{height:16,width:"60%"}),O("div",{className:"flex flex-grow flex-col gap-xs",children:[w(Y,{height:12}),w(Y,{height:12,width:"85%"})]}),w(Y,{height:10,width:100,className:"mt-auto"})]},t))})]})}
function mI({blank:e=!1}){return O("div",{className:"flex h-full flex-col rounded-card bg-surface-2 shadow-card-ring [--cds-ring-inner:1px] [--cds-ring-outer:0px]",children:[w("div",{className:"h-[160px]"}),w("div",{className:k("mx-px border-t",e?"border-transparent":"border-alpha-1")}),O("div",{className:"flex flex-col gap-xs p-3.5",children:[w("div",{className:"flex h-[1lh] items-center text-body",children:e?null:w(Y,{height:14,width:"70%"})}),w("div",{className:"flex h-[1lh] items-center text-caption",children:e?null:w(Y,{height:11,width:"50%"})})]})]})}
function $z(){return Xh()}
function rB(e,t){return $z()?t:e}
function eV(e,t){if(!t||e.includes("\\")||/^[A-Za-z]:/.test(e))return e;let n=t.endsWith("/")?t.slice(0,-1):t;if(e===n||e===n+"/")return"~";let r=n+"/";return e.startsWith(r)?"~/"+e.slice(r.length):e}
function SV({pinReorder:e,slots:t,showIcon:n=!0}){if(e===void 0)return null;let{onMoveUp:r,onMoveDown:i}=e;return O(E,{children:[r!==void 0&&w(t.Item,{onClick:r,icon:n?"ArrowUp":void 0,children:w(Z,{defaultMessage:"Move up",id:"wmFdwsKtFc"})}),i!==void 0&&w(t.Item,{onClick:i,icon:n?"ArrowDown":void 0,children:w(Z,{defaultMessage:"Move down",id:"H/r5m64n8M"})})]})}
var TV="1ofwflq";
function EV(e){return e.fireAt?e.source==="remote"?e.endedReason===ff:!!e.lastRunAt:!1}
function DV(e){let t=ES(e.enabled,e.endedReason,e.suspensionReason);return t==="auto-disabled"||t==="on-hold"?t:t==="completed"||EV(e)?"completed":"paused"}
var OV=X({oneShotTimePassed:{defaultMessage:"This one-time task\u2019s scheduled time has passed, so it can\u2019t be turned back on here. Run it now or create a new task.",id:"bGAI/nQBDE"},oneShotTimePassedRetime:{defaultMessage:"This one-time task\u2019s scheduled time has passed, so it can\u2019t be turned back on yet. Edit it to choose a new time, or run it now.",id:"9JN1qU8iBG"},failed:{defaultMessage:"Schedule couldn\u2019t be enabled. You can try again.",id:"2ri4T6QHSG"},pauseFailed:{defaultMessage:"Schedule couldn\u2019t be paused. You can try again.",id:"iDNc35weoy"}});
function kV(e){return e.source==="remote"&&!e.cronExpression&&e.fireAt!==void 0&&!EV(e)}
function AV(e,t){return kV(e)&&!e.enabled&&e.fireAt!==void 0&&e.fireAt<=t}
function jV(e){return e.source!=="remote"&&e.migratedToRemoteAt!==void 0&&e.migratedToRemote?.revertedAt===void 0}
function MV(e,t,n){return!e&&n?.newLocalTasksOff===!0&&t!=null&&jV(t)}
function NV(e,t){return t?.newLocalTasksOff===!0&&e!=null&&!e.enabled&&jV(e)}
function PV(e,t,n){return NV(e,t)?J({intl:n,id:TV}):void 0}
function FV(e,t){e(J({intl:t,id:TV}))}
var IV="__gb__2026372043";
function RV(e){return e?OV.oneShotTimePassedRetime:OV.oneShotTimePassed}
function zV(e,t){e(t.formatMessage(RV(tt(IV))))}
function BV(e,t,n){e(Lt(n)??t.formatMessage(OV.failed),{error:n,errorContext:{tags:{source:"scheduled_task_enable"}},messageForLogging:"Cowork scheduled task enable IPC failed."})}
function HV(e,t,n){e(Lt(n)??t.formatMessage(OV.pauseFailed),{error:n,errorContext:{tags:{source:"scheduled_task_disable"}},messageForLogging:"Cowork scheduled task disable IPC failed."})}
var WV=X({no_prompt:{defaultMessage:"Can\u2019t move this task because its file couldn\u2019t be read.",id:"74ayq7gcmk"},local_folders:{defaultMessage:"Can\u2019t move this task because it uses local folders or files.",id:"JfHCDRUf+C"},projects:{defaultMessage:"Can\u2019t move this task yet. Moving would disconnect it from its projects. To run it in the cloud, create a new task instead.",id:"9C5nL0oRXk"},space:{defaultMessage:"This task uses a project on this computer, so it can only run here. To use the cloud, create a new task without it.",id:"es3vTUUA4o"},chrome:{defaultMessage:"Can\u2019t move this task because it uses Claude in Chrome.",id:"+JntkchELp"},cwd:{defaultMessage:"Can\u2019t move this task because it uses a local working directory.",id:"Rndy8UVBtI"},dispatch_hook:{defaultMessage:"Can\u2019t move this task because it notifies a local dispatch session.",id:"FJqKx2GjnF"},pattern_approvals:{defaultMessage:"Can\u2019t move this task because it has pattern-scoped tool approvals.",id:"co2lbYLIl3"},sub_hourly:{defaultMessage:"Can\u2019t move this task because cloud tasks run at most once per hour.",id:"S61gNMMIyj"},custom_cron:{defaultMessage:"Can\u2019t move this task because its schedule isn\u2019t supported.",id:"KzZeUGMhBo"}});
function GV({scheduledTask:e,onRunNow:t,isRunning:n,onEdit:r,onRename:i,onDelete:a,isDeleting:o=!1,onMigrate:s,isMigrating:c=!1,buttonSize:l="icon_sm",showRunNow:u=!0,showPauseToggle:d=!0,showDelete:f=!0,readState:p,pin:m,trigger:h,triggerTooltip:g,open:_,onOpenChange:v}){let y=Q(),{track:b}=Ec(),{addError:x,addWarning:S}=ti(),C=ts(),T=e.source??"local",k=!!e.cronExpression||kV(e),A=PV(e,C,y),j=e.displayName??Id(e.id),M=e.endedReason===ef,P=f&&(!M||mf(e,y.messages)!==null),F=s!==void 0&&!M&&(c||T==="local"&&e.enabled),I=Wd(),L=Oo(),R=N(()=>F?c?{ok:!0}:Do(e,{remoteFoldersSupported:I,remoteProjectsSupported:L,currentLocalScheduler:zd()}):null,[F,c,e,I,L]),z=D(async()=>{if(C?.updateScheduledTaskStatus){if(AV(e,Date.now())){zV(S,y);return}try{if(MV(await C.updateScheduledTaskStatus(e.id,"enabled",void 0,T),e,C)){FV(S,y);return}b({event_key:"claudeai.cowork.scheduled_task.enabled",space_id:e.spaceId,task_kind:Gd(e)})}catch(e){BV(x,y,e)}}},[C,e,T,b,x,S,y]),ee=D(()=>{p&&(p.onToggle(),p.sessionId&&b({event_key:p.isUnread?"claudeai.cowork.session.marked_read":"claudeai.cowork.session.marked_unread",session_id:p.sessionId,source:"hover_menu"}))},[p,b]),B=D(async()=>{if(C?.updateScheduledTaskStatus)try{await C.updateScheduledTaskStatus(e.id,"disabled",void 0,T),b({event_key:"claudeai.cowork.scheduled_task.disabled",space_id:e.spaceId,task_kind:Gd(e)})}catch(e){HV(x,y,e)}},[C,e,T,b,x,y]),te=w(id,{iconOnly:!0,icon:"DotsVertical",variant:"ghost",size:l==="icon"?void 0:"sm",tooltip:!1,className:"pointer-events-auto","aria-label":y.formatMessage({defaultMessage:"More options for {label}",id:"rKQPgfPvWS"},{label:j}),onClick:e=>{e.stopPropagation(),e.preventDefault()},onMouseDown:e=>{e.stopPropagation(),e.preventDefault()}});return M&&!p&&!P?null:O(fd.Root,{open:_,onOpenChange:v,children:[g===void 0?w(fd.Trigger,{render:h??te}):w(Zu,{content:g,children:w(fd.Trigger,{render:h??te})}),O(fd.Popup,{align:"end",children:[u&&!M&&w(fd.Item,{icon:"Play",disabled:n||!e.prompt,onClick:t,children:w(Z,{defaultMessage:"Run now",id:"v+MsvNCgFi"})}),d&&k&&!M&&w(fd.Item,{icon:e.enabled?"Pause":"PlayCircle",disabled:A!==void 0,disabledReason:A??null,onClick:e.enabled?()=>void B():()=>void z(),children:e.enabled?w(Z,{defaultMessage:"Pause",id:"s9HbCiWnAN"}):w(Z,{defaultMessage:"Enable",id:"TqSTI0/TZI"})}),m&&w(fd.Item,{"data-testid":"toggle-scheduled-task-pin-trigger",icon:m.pinned?"PinSlash":"Pin",onClick:m.onToggle,children:m.pinned?w(Z,{defaultMessage:"Unpin",id:"opNVQCTN4x"}):w(Z,{defaultMessage:"Pin",id:"puLNUJezx6"})}),p&&w(fd.Item,{"data-testid":"toggle-scheduled-task-read-trigger",onClick:ee,icon:p.isUnread?"Eye":"EyeSlash",children:p.isUnread?p.marksSeveral?w(Z,{defaultMessage:"Mark all as read",id:"/af+jQ8xvW"}):w(Z,{defaultMessage:"Mark as read",id:"64Hq/+q+KI"}):w(Z,{defaultMessage:"Mark as unread",id:"vLAPJDu9y6"})}),i&&!M&&w(fd.Item,{"data-testid":"rename-scheduled-task-trigger",icon:"Edit",onClick:()=>setTimeout(i,100),children:w(Z,{defaultMessage:"Rename",id:"FPJlgifNwD"})}),!M&&w(fd.Item,{icon:i?"Settings":"Edit",onClick:()=>setTimeout(r,100),children:w(Z,{defaultMessage:"Edit",id:"wEQDC6Wv3/"})}),R&&w(Zu,{multiline:!0,side:"right",content:R.ok?w(UV,{migratesBound:(e.userSelectedFolders?.length??0)>0}):void 0,children:w("div",{children:w(fd.Item,{icon:"Cloud",disabled:!R.ok||c,disabledReason:R.ok?null:y.formatMessage(WV[R.reason]),onClick:R.ok&&!c?s:void 0,children:w(Z,{defaultMessage:"Move to cloud",id:"Rl96x0Mg7A"})})})}),w(rg,{separator:"before",children:w(SV,{pinReorder:m?.reorder,slots:tg})}),P&&O(E,{children:[(!M||p)&&w(fd.Separator,{}),w(fd.Item,{variant:"danger",icon:"Trash",disabled:o,onClick:()=>setTimeout(a,100),children:w(Z,{defaultMessage:"Delete",id:"K3r6DQW7h+"})})]})]})]})}

export { mI, pI, GV, kV, EV, PV, NV, jV, TV, AV, zV, RV, OV, IV, MV, FV, BV, HV, WV, SV, DV, ES, eV, rB, $z, Px, gD, hD, SD, mD, pD, uD, lD, Ry, Ly, Iy, hT, mT, O, w, k, Y, Z, Q, Ec, ti, ts, ff, J, Id, ef, mf, Wd, Oo, N, Do, zd, D, X, tt, Gd, Lt, id, fd, Zu, UV, rg, E, tg, of, Xh, Ru, Ot, wD, rd, _D, iE, Sr };
