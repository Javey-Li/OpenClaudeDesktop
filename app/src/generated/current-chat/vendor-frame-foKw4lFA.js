// Extracted from installed Claude Desktop 2.31226.0. Do not edit.
import { memo as D } from "react";
import { useContext as N } from "react";
import { createContext as x } from "react";
import { jsx as K } from "react/jsx-runtime";
import { jsxs as me } from "react/jsx-runtime";
import { classNames as ge } from "../../source-chat-adapters.jsx";
import { forwardRef as w } from "react";
import { useRef as U } from "react";
import { useState as W } from "react";
import { useEffect as I } from "react";
import { useCallback as M } from "react";
import { useLayoutEffect as ee } from "react";
import { useMemo as V } from "react";
import { useId as R } from "react";
import { useImperativeHandle as z } from "react";
import { useInsertionEffect as B } from "react";
import { Fragment as pe } from "react/jsx-runtime";
import { Fragment as d } from "react";
import { useSyncExternalStore as G } from "react";
import { Children as l } from "react";
import { cloneElement as b } from "react";
import { useEffectEvent as L } from "react";
import { useDeferredValue as F } from "react";
import { default as s } from "react";
import { useReducer as te } from "react";
import { flushSync as ds } from "react-dom";
import { isValidElement as T } from "react";
import { version as re } from "react";
import { createElement as S } from "react";
import { Suspense as h } from "react";
import { createPortal as us } from "react-dom";
function Wt(e,t){if(e&&!t)return e;if(!e&&t)return t;if(e||t)return{...e,...t}}
var Gt={};
function Kt(e,t,n,r,i){if(!n&&!r&&!i&&!e)return Jt(t);let a=Jt(e);return t&&(a=Yt(a,t)),n&&(a=Yt(a,n)),r&&(a=Yt(a,r)),i&&(a=Yt(a,i)),a}
function Jt(e){return $t(e)?{...en(e,Gt)}:Xt(e)}
function Yt(e,t){return $t(t)?en(t,e):Zt(e,t)}
function Xt(e){let t={...e};for(let e in t){let n=t[e];Qt(e,n)&&(t[e]=nn(n))}return t}
function Zt(e,t){if(!t)return e;for(let n in t){let r=t[n];switch(n){case"style":e[n]=Wt(e.style,r);break;case"className":e[n]=an(e.className,r);break;default:e[n]=Qt(n,r)?tn(e[n],r):r}}return e}
function Qt(e,t){let n=e.charCodeAt(0),r=e.charCodeAt(1),i=e.charCodeAt(2);return n===111&&r===110&&i>=65&&i<=90&&(typeof t=="function"||t===void 0)}
function $t(e){return typeof e=="function"}
function en(e,t){return $t(e)?e(t):e??Gt}
function tn(e,t){return t?e?(...n)=>{let r=n[0];if(on(r)){let i=r;rn(i);let a=t(...n);return i.baseUIHandlerPrevented||e?.(...n),a}let i=t(...n);return e?.(...n),i}:nn(t):e}
function nn(e){return e&&((...t)=>{let n=t[0];return on(n)&&rn(n),e(...t)})}
function rn(e){return e.preventBaseUIHandler=()=>{e.baseUIHandlerPrevented=!0},e}
function an(e,t){return t?e?t+" "+e:t:e}
function on(e){return typeof e=="object"&&!!e&&"nativeEvent"in e}

export { Kt, Jt, $t, en, Gt, Xt, Qt, nn, on, rn, Yt, Zt, Wt, an, tn, D, N, x, K, me, ge, w, U, W, I, M, ee, V, R, z, B, pe, d, G, l, b, L, F, s, te, ds, T, re, S, h, us };
