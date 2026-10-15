// Extracted from installed Claude Desktop 2.31226.0. Do not edit.
import { Fl as Kc } from "./shared-100-Bs3K3KCN.js";
import { Bg as Ei } from "./shared-75-BauJ3twV.js";
import { Ik as Mo } from "./shared-26-CT0kz82X.js";
import { tn as au } from "./vendor-intl-C-oMXuBz.js";
import { Il as Dc } from "./shared-100-Bs3K3KCN.js";
import { cA as Ca } from "./shared-26-CT0kz82X.js";
import { ideaFalse as CM } from "../../source-ideas-adapters.jsx";
function mv(e){return typeof e!="string"||!e.includes("<")?e:e.replace(_v,"")}
var _v=/(?:<cc-memory(?:\s+filenames="[^"<>]*")?\s*>|<\/cc-memory\s*>)+/g;
function Wv(e){if(e.startsWith("CRON_TZ=")||e.startsWith("TZ=")){let t=e.indexOf(" "),n=e.indexOf("=");if(t>n)return{zone:e.slice(n+1,t),cron:e.slice(t).trim()}}return{zone:null,cron:e.trim()}}
function Gv(e){try{return Intl.DateTimeFormat(void 0,{timeZone:e}).resolvedOptions().timeZone}catch{return null}}
function Jv(e){return Ca(e)}
function Yv(e){return Mo(e)}
function Zv(e,t,n,r){if(t!=="custom")return{prev:t,minute:r};let i=Yv(Wv(n).cron);return i?{prev:i.frequency,minute:e==="hourly"&&i.frequency==="hourly"?i.minute??r:r}:{prev:t,minute:r}}
function Qv(e,t){let n=new Date(t),r=e.hour,i=e.minute??0;switch(e.frequency){case"hourly":{let e=new Date(n);return e.setSeconds(0,0),e.getMinutes()>=i&&e.setHours(e.getHours()+1),e.setMinutes(i,0,0),e}case"daily":{let e=new Date(n.getFullYear(),n.getMonth(),n.getDate(),r,i);return e<=n&&e.setDate(e.getDate()+1),e}case"weekdays":for(let e=0;e<=7;e++){let t=new Date(n.getFullYear(),n.getMonth(),n.getDate()+e,r,i),a=t.getDay();if(a>=1&&a<=5&&t>n)return t}return new Date(n.getFullYear(),n.getMonth(),n.getDate()+1,r,i);case"weekly":{let t=n.getDay(),a=(e.dayOfWeek-t+7)%7,o=new Date(n.getFullYear(),n.getMonth(),n.getDate()+a,r,i);return o<=n&&o.setDate(o.getDate()+7),o}case"monthly":for(let t=0;t<=12;t++){let a=new Date(n.getFullYear(),n.getMonth()+t,e.dayOfMonth,r,i);if(a.getDate()===e.dayOfMonth&&a>n)return a}return new Date(n.getFullYear()+1,n.getMonth(),1,r,i)}}
function $v(e,t,n){return Array.from({length:31},(r,i)=>Qv({frequency:"monthly",hour:t,minute:n,dayOfWeek:0,dayOfMonth:i+1},e))}
function ey(e,t,n){return Qv({frequency:"daily",hour:t,minute:n,dayOfWeek:0},e).getDate()}
function ty(e,t,n,r,i=!1){let a=new Date(t),o=e.toLocaleTimeString(n.locale,{hour:"numeric",minute:"2-digit"}),s=i?"yes":"other";if(Ei(e,a))return n.formatMessage({defaultMessage:"today at {approx, select, yes {~} other {}}{time}",id:"yRMDg4l20z"},{time:o,approx:s});if(r==="future"){let t=new Date(a);if(t.setDate(a.getDate()+1),Ei(e,t))return n.formatMessage({defaultMessage:"tomorrow at {approx, select, yes {~} other {}}{time}",id:"WWilu3pYVm"},{time:o,approx:s})}else{let t=new Date(a);if(t.setDate(a.getDate()-1),Ei(e,t))return n.formatMessage({defaultMessage:"yesterday at {approx, select, yes {~} other {}}{time}",id:"lWfN0KOW6X"},{time:o,approx:s})}let c=e.toLocaleDateString(n.locale,{month:"short",day:"numeric",...e.getFullYear()===a.getFullYear()?{}:{year:"numeric"}});return n.formatMessage({defaultMessage:"{date} at {approx, select, yes {~} other {}}{time}",id:"CpMRp3wiD7"},{date:c,time:o,approx:s})}
function ny(e,t,n,r,i){return e?ty(Qv(e,r),r,i,"future",n>0):t?ty(new Date(t),r,i,"future"):null}
var ry=au({title:{defaultMessage:"Scheduled tasks",id:"sy7vzf+1SO"},titleRoutines:{defaultMessage:"Routines",id:"Dbc6XaCcol"},bannerLocalAwakeRoutines:{defaultMessage:"Local routines only run while your computer is awake and online.",id:"4aL/3wWUgg"},emptyState:{defaultMessage:"No scheduled tasks yet.",id:"gZvh4BnHgf"},emptyStateRoutines:{defaultMessage:"No routines yet.",id:"nqu1699+6Q"},errorStateRoutines:{defaultMessage:"Couldn\u2019t load routines",id:"AaYiSOA0wl"},retry:{defaultMessage:"Retry",id:"62nsdyMyIO"},loadingLabelRoutines:{defaultMessage:"Loading routines",id:"/JTT/2DU15"},newRoutine:{defaultMessage:"New routine",id:"ZTK8vIOPS5"},paused:{defaultMessage:"Paused",id:"Wgins8THpZ"},oneTime:{defaultMessage:"One-time",id:"/Zj5Ed1O1a"},autoDisabled:{defaultMessage:"Auto-disabled",id:"KlJN0MemFl"},manual:{defaultMessage:"Manual",id:"u4f7h0ylkl"},viaApi:{defaultMessage:"Via API",id:"Zapoj2wX1I"},onGithubEvent:{defaultMessage:"On GitHub event",id:"6L9Y5wO1ji"},nextRunInline:{defaultMessage:"Next run {date}",id:"hYbuk57KUB"},dueInline:{defaultMessage:"Due {date}",id:"5vDqi+KGvG"},local:{defaultMessage:"Local",id:"MpsZ34EpZH"},ssh:{defaultMessage:"SSH",id:"waUHa40VD6"},remote:{defaultMessage:"Cloud",id:"fiPvwYljok"},all:{defaultMessage:"All",id:"zQvVDJ+j59"},showCompleted:{defaultMessage:"Include completed",id:"O6OPwZlzlS"},searchRoutines:{defaultMessage:"Search routines",id:"ZygvlMnrRg"},noSearchResults:{defaultMessage:"No routines match your search.",id:"JiMBqP+f6o"},noFilterResults:{defaultMessage:"No routines match these filters.",id:"PrsfFM1lyK"},noSearchAndFilterResults:{defaultMessage:"No routines match your search and filters.",id:"+iRdoEt8q3"},filterRoutines:{defaultMessage:"{count, plural, =0 {Filter routines} one {Filter routines, # filter active} other {Filter routines, # filters active}}",id:"bPy1nEj+5C"},filterRunsOn:{defaultMessage:"Runs on",id:"rNWDn60RGq"},filterSchedule:{defaultMessage:"Schedule",id:"3dgy02jMxX"},filterStatus:{defaultMessage:"Status",id:"tzMNF3jWoU"},recurring:{defaultMessage:"Recurring",id:"wKWOUozPA3"},active:{defaultMessage:"Active",id:"ndYmZr+XBl"},routineSingular:{defaultMessage:"routine",id:"vpWHJr3qCI"},routinePlural:{defaultMessage:"routines",id:"c+OAnBWakK"},completedHidden:{defaultMessage:"{count, plural, one {# completed routine hidden} other {# completed routines hidden}}",id:"8dcRa4i+v2"},runStarted:{defaultMessage:"Run started.",id:"EThtbMV0N+"},deleteRoutine:{defaultMessage:"Delete routine?",id:"9QpIaEAMM6"},deleteTask:{defaultMessage:"Delete scheduled task?",id:"jTXSpX3Ikw"},deleteBody:{defaultMessage:"Delete \u201C{taskName}\u201D? Any sessions from this routine will be archived.",id:"SJxinqJUmY"},deleteConfirmButton:{defaultMessage:"Delete",id:"K3r6DQW7h+"},deleteFailedRoutine:{defaultMessage:"Routine couldn\u2019t be deleted. Try again.",id:"WA3PxYvEFF"},deleteFailedTask:{defaultMessage:"Scheduled task couldn\u2019t be deleted. Try again.",id:"FF0beQ+syu"}});
function ly(e){return/^\d+$/.test(e)}
function vy(e,t,n){return new Date(2024,0,1,e,t).toLocaleTimeString(n,{hour:"numeric",minute:"2-digit"})}
function yy(e,t){return`${String(e).padStart(2,"0")}:${String(t).padStart(2,"0")}`}
function by(e){let t=e=>String(e).padStart(2,"0");return`${e.getFullYear()}-${t(e.getMonth()+1)}-${t(e.getDate())}T${t(e.getHours())}:${t(e.getMinutes())}`}
function xy(e){let t=e?new Date(e).getTime():NaN;return Number.isNaN(t)?null:t}
function Sy(e){let t=/^(\d{1,2}):(\d{2})$/.exec(e);if(!t)return null;let n=parseInt(t[1],10),r=parseInt(t[2],10);return n<0||n>23||r<0||r>59?null:{hour:n,minute:r}}
function Cy(e,t){return new Date(2024,0,7+e).toLocaleDateString(t,{weekday:"long"})}
function Ay(e,t,n){return e==="hourly"&&t!=="hourly"?0:n}
var jy="run_once_fired";
var My="moved_to_project";
var Ny="auto_disabled_config_rejected";
var Py="auto_disabled_gate_denied";
var Fy="auto_disabled_invalid_cron";
var Iy="auto_disabled_subhourly";
var Ly="auto_disabled_repo_access";
var Ry="auto_disabled_session_gone";
var zy=new Set([jy,My]);
function By(e,t){return e?"active":t?zy.has(t)?"completed":"auto-disabled":"paused"}
var Vy=au({msgRunOnceFired:{defaultMessage:"This one-time routine has run. Set a new schedule to run it again.",id:"O91g4R8kGm"},msgConfigRejected:{defaultMessage:"This routine was disabled because its configuration is no longer valid. Review your settings and re-enable it.",id:"VuEfHe2rAF"},msgGateDenied:{defaultMessage:"This routine was disabled because the feature it uses isn\u2019t available on your plan or organization.",id:"FeO5D28+6b"},msgInvalidCron:{defaultMessage:"This routine was disabled because its cron expression is invalid. Edit the schedule and re-enable it.",id:"KmkyXXggLE"},msgSubhourly:{defaultMessage:"This routine was disabled because it was scheduled more than once per hour. Choose a less frequent schedule and re-enable it.",id:"9mNMhPpnT5"},msgRepoAccess:{defaultMessage:"This routine was disabled because Claude lost access to its repository. Reconnect the repository and re-enable it.",id:"K6niSCYe36"},msgSessionGone:{defaultMessage:"This routine was disabled because its session was archived or deleted. Create a new routine if you still need one.",id:"8bhV0gDh1A"},msgUnknownAutoDisabled:{defaultMessage:"This routine was automatically disabled. Review your settings and re-enable it.",id:"U2glLvTvfJ"}});
var Hy={...Vy,...au({msgRunOnceFired:{defaultMessage:"This one-time task has run. Set a new schedule to run it again.",id:"w/fPCGxW+6"},msgConfigRejected:{defaultMessage:"This scheduled task was disabled because its configuration is no longer valid. Review your settings and re-enable it.",id:"2pBfRP1OJO"},msgGateDenied:{defaultMessage:"This scheduled task was disabled because the feature it uses isn\u2019t available on your plan or organization.",id:"PTgs3EjMqQ"},msgInvalidCron:{defaultMessage:"This scheduled task was disabled because its cron expression is invalid. Edit the schedule and re-enable it.",id:"fHanAVnElZ"},msgSubhourly:{defaultMessage:"This scheduled task was disabled because it was scheduled more than once per hour. Choose a less frequent schedule and re-enable it.",id:"5/j2QZWjmX"},msgRepoAccess:{defaultMessage:"This scheduled task was disabled because Claude lost access to its repository. Reconnect the repository and re-enable it.",id:"1uEYXMRUJ0"},msgSessionGone:{defaultMessage:"This scheduled task was disabled because its session was archived or deleted. Create a new scheduled task if you still need one.",id:"G/vBfk9Jia"},msgUnknownAutoDisabled:{defaultMessage:"This scheduled task was automatically disabled. Review your settings and re-enable it.",id:"wq7iulKbFS"}})};
var Uy={label:"ju6v9r"};
var Wy={plain:"1t899y3",twin:"1tlwcuk"};
function Ky(e,t){return e.endedReason==="moved_to_project"?e.migratedFromLocalTask!==void 0&&Kc(t,Wy.twin)&&Kc(t,"j31kyi")?{bodyId:Wy.twin,twin:e.migratedFromLocalTask}:Kc(t,Wy.plain)?{bodyId:Wy.plain,twin:void 0}:null:null}
function qy(e,t){return e==="moved_to_project"&&Kc(t,Uy.label)?Uy:null}
function Jy(e){return{[jy]:e.msgRunOnceFired,[Ny]:e.msgConfigRejected,[Py]:e.msgGateDenied,[Fy]:e.msgInvalidCron,[Iy]:e.msgSubhourly,[Ly]:e.msgRepoAccess,[Ry]:e.msgSessionGone}}
var Yy={routines:Jy(Vy),scheduled:Jy(Hy)};
function Xy(e,t="routines"){return e?Yy[t][e]??(t==="scheduled"?Hy:Vy).msgUnknownAutoDisabled:null}
function nb(e,t){return e==="synchronize"?"updated":e==="closed"&&t?.clauses.some(e=>e.field==="pr.merged"&&e.op==="FILTER_OP_EQ"&&e.values?.[0]==="true")?"merged":e.replace(/_/g," ")}
function rb(e,t){let n=e?.events;if(!n||n.length===0)return;let r=n[0].indexOf("."),i=r===-1?n[0]:n[0].slice(0,r),a=n.filter(e=>e.startsWith(`${i}.`)).map(e=>e.slice(i.length+1)),o=a.length===0||a.length>=3,s=o?"":t.formatList(a.map(t=>nb(t,e?.filter)),{type:"disjunction"});switch(i){case"pull_request":return t.formatMessage({defaultMessage:"{collapsed, select, yes {On pull request} other {When a PR is {verbs}}}",id:"NzyeP7XGqz"},{collapsed:o?"yes":"other",verbs:s});case"release":return t.formatMessage({defaultMessage:"{collapsed, select, yes {On release} other {When a release is {verbs}}}",id:"dQ+rhsu82v"},{collapsed:o?"yes":"other",verbs:s});default:return t.formatMessage({defaultMessage:"On {event}",id:"sd+VD81hf2"},{event:i.replace(/_/g," ")})}}
function ib(e,t,n){if(e==="github")return rb(t,n)??n.formatMessage(ry.onGithubEvent);if(e==="api")return n.formatMessage(ry.viaApi);if(e==="event")return Dc({id:"caybop",intl:n})}
function xb(e){return e.replace(/-/g," ").replace(/^./,e=>e.toUpperCase())}
var Cb="/morning";
function wb(e){let t=e?.prompt;return t?t.toLowerCase().includes(Cb)?"morning_brief":"other":"unknown"}
function Db(e){return e.displayName??xb(e.id)}
function Ob(e){return e.trim().toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9_-]/g,"").replace(/^[-_]+|[-_]+$/g,"").slice(0,120).replace(/[-_]+$/,"")}
function dx(e){return e.source==="remote"?e.suspensionReason==="device_absent"?{kind:"held",deviceName:e.boundDeviceName}:e.boundDeviceUuid?{kind:"bound",deviceName:e.boundDeviceName}:{kind:"none"}:{kind:"none"}}
var Bx=new Map;
function Ux(e){let t=Bx.get(e);return t!==void 0&&t.length>0?t:void 0}
var jS=class extends Error{constructor(e,t){super(`Routine bind not attempted (${e})`),this.reason=e,this.errorName=t,this.name="RoutineBindUnsignedError"}};
var FS=140;
function zS(e){return Ob(e)||"scheduled-task"}
function BS(e){let t=e.replace(/\s+/g," ");return t.length>FS?`${t.slice(0,139)}\u2026`:t}
function $M(e,t){if(!t)return!1;let n=t.sessions[e.sessionId],r=!!t.explicitUnread?.[e.sessionId]||n===0;if(e.unread===!1&&!r&&!CM())return!1;let i=e.lastActivityAt??e.createdAt??0;return n===void 0?i>t.initializedAt:i>n}
function eN(e){return!e.isRunning&&e.lastActivityAt!==void 0}

export { jy, xb, My, Ky, Wy, wb, Cb, mv, _v, ty, Wv, Gv, Yv, vy, Cy, ib, rb, nb, ry, By, zy, qy, Uy, dx, Ux, Bx, Ay, Ob, zS, ly, by, Jv, BS, FS, jS, Zv, ey, Qv, $v, yy, Sy, xy, Db, ny, Xy, Yy, Jy, Ny, Py, Fy, Iy, Ly, Ry, Vy, Hy, $M, eN, Kc, Ei, Mo, au, Dc, Ca, CM };
