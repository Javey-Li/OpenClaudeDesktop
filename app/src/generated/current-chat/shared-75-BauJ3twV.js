// Extracted from installed Claude Desktop 2.31226.0. Do not edit.
import { kN as $n } from "./shared-50-Bmc9oUMm.js";
import { k as le } from "./shared-0-tP5vNlHv.js";
import { bN as zi } from "./shared-50-Bmc9oUMm.js";
function Bg(e,t){return e.getFullYear()===t.getFullYear()&&e.getMonth()===t.getMonth()&&e.getDate()===t.getDate()}
function Ug(e){let t=/^(\d{4})-(\d{2})-(\d{2})$/.exec(e);if(!t)return null;let n=new Date(Number(t[1]),Number(t[2])-1,Number(t[3]));return Number.isNaN(n.getTime())||n.getMonth()!==Number(t[2])-1?null:n}
function Wg(e){let t=e=>String(e).padStart(2,"0");return`${e.getFullYear()}-${t(e.getMonth()+1)}-${t(e.getDate())}`}
var QC=le(()=>/(?![\t\n\r\u200C\u200D])[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}\u034F\u115F\u1160\u3164\uFE00-\uFE0F\uFFA0\u{E0100}-\u{E01EF}]/gu);
var $C=le(()=>RegExp(`${zi}{5,}`,"gu"));
var tw=String.raw`\u2800\uFFFC\u{1D159}\u{13441}\u{13442}\u{16910}`;
var nw=RegExp(`[\\s${tw}]+`,"gu");
var rw=le(()=>RegExp(`(^|[\\s${tw}])[\\p{Mn}\\p{Me}\\u200C\\u200D]+`,"gu"));
function gw(e){let t=e.replace(/[\n\r\u2028\u2029]/g," ");return $n(t,$C(),32).replace(rw(),"$1").replace(nw," ").trim()}
var vw=4e3;
function bw(e){return e.replace(QC(),"")}
function Sw(e){return Tw(e,bw)}
function Tw(e,t){return gw(t(e.slice(0,vw)).replace(/\p{Cs}/gu,""))}

export { Sw, Tw, gw, $C, rw, tw, nw, vw, bw, QC, Bg, Wg, Ug, $n, le, zi };
