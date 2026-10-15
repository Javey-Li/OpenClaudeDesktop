// Extracted from installed Claude Desktop 2.31226.0. Do not edit.
import { messageDescriptors as tn } from "../../source-artifact-adapters.jsx";
import { N as e } from "./vendor-frame-foKw4lFA.js";
import { x as l } from "./vendor-frame-foKw4lFA.js";
import { D as u } from "./vendor-frame-foKw4lFA.js";
import { d as o } from "./vendor-frame-foKw4lFA.js";
import { K as a } from "./vendor-frame-foKw4lFA.js";
import { pe as s } from "./vendor-frame-foKw4lFA.js";
function jt(e,t,n=Error){if(!e)throw new n(t)}
function Mt(e){jt(e,"[React Intl] Could not find required `intl` object. <IntlProvider> needs to exist in the component ancestry.")}
function G(e,t){if(e===t)return!0;if(!e||!t)return!1;var n=Object.keys(e),r=Object.keys(t),i=n.length;if(r.length!==i)return!1;for(var a=0;a<i;a++){var o=n[a];if(e[o]!==t[o]||!Object.prototype.hasOwnProperty.call(t,o))return!1}return!0}
var K=l(null);
function q(){let t=e(K);return Mt(t),t}
function Ut(e,t){let{values:n,...r}=e,{values:i,...a}=t;return G(i,n)&&G(r,a)}
function Wt(e){let{formatMessage:t,textComponent:n=o}=q(),{id:r,description:i,defaultMessage:c,values:l,children:u,tagName:d=n,ignoreTag:f}=e,p=t({id:r,description:i,defaultMessage:c},l,{ignoreTag:f});return typeof u=="function"?u(Array.isArray(p)?p:[p]):a(d||s,{children:p})}
var Gt=u(Wt,Ut);
function nn(e){return e}

export { q, K, Mt, jt, Gt, Wt, Ut, G, nn, tn, e, l, u, o, a, s };
