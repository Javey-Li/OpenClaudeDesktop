// Extracted from installed Claude Desktop 2.31226.0. Do not edit.
import { rB as t } from "./shared-18-DaJGQi6_.js";
import { tn as n } from "./vendor-intl-C-oMXuBz.js";
import { K as e } from "./vendor-frame-foKw4lFA.js";
import { Gt as r } from "./vendor-intl-C-oMXuBz.js";
var i=n({lateStartNote:{defaultMessage:"Routines set for {minute} can start several minutes late. Pick a time a few minutes earlier to start on time.",id:"nDcbd3DQ2C"}});
var a=n({lateStartNote:{defaultMessage:"Scheduled tasks set for {minute} can start several minutes late. Pick a time a few minutes earlier to start on time.",id:"mdtGtRCbfe"}});
function o({minute:n}){let o=t(i,a);return e(r,{...o.lateStartNote,values:{minute:`:${String(n).padStart(2,"0")}`}})}

export { o, i, a, t, n, e, r };
