// Extracted from installed Claude Desktop 2.31226.0. Do not edit.
import { e as i } from "./c3d5d2a6f-Cb6r-Pna.js";
import { me as t } from "./vendor-frame-foKw4lFA.js";
import { K as e } from "./vendor-frame-foKw4lFA.js";
import { LocalizedMessage as r } from "../../source-chat-adapters.jsx";
import { messageDescriptors as n } from "../../source-artifact-adapters.jsx";
var a=n({manual:{defaultMessage:"Manual",id:"u4f7h0ylkl"},api:{defaultMessage:"API",id:"xwEc8KM8zK"},webhook:{defaultMessage:"GitHub",id:"wO9wb5D8Fn"}});
function o({origin:n}){let o=i(n);return!o||o==="scheduled"?null:t("span",{className:"text-muted",children:[" \u00B7 ",e(r,{...a[o]})]})}

export { o, a, i, t, e, r, n };
