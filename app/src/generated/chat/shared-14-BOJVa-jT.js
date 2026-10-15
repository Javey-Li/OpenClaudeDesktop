// Extracted from Claude Desktop 2.2553.1 shared-14-BOJVa-jT.js. Only asset URLs are made relative. Do not edit.
import { qu as se } from "./shared-0-8LmBcbZC.js";
var ev="flex h-12 shrink-0 items-center justify-between gap-sm bg-surface-3 pl-2 pr-3";
var tv="relative min-h-0 flex-1 bg-surface-2 after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:border-t after:border-alpha-1 after:content-['']";
var nv="aspect-square w-control px-0";
var rv="shrink-0 rounded-md enabled:hover:bg-fill-ghost-hover";
var iv="text-gray-900/80 dark:text-gray-0/70";
function Rx(e){let t=e.name.trim(),n=se(e.id);if(n&&!n.internal){let e=t.toLowerCase().indexOf(n.base.toLowerCase());if(e>=0){let r=e+n.base.length;return{family:t.slice(0,r).trim(),variant:t.slice(r).trim()}}}let r=t.split(/\s+/),i=r.findIndex(e=>/\d/.test(e));return i<0||i===r.length-1?{family:t,variant:""}:{family:r.slice(0,i+1).join(" "),variant:r.slice(i+1).join(" ")}}
function Hx(e){let{family:t,variant:n}=Rx(e);return{group:t.toLowerCase(),title:n?t:void 0,hint:n||void 0}}
var ideaPreviewClass="animate-preview-prompt-in line-clamp-2 text-muted";
export { tv, ev, Hx, Rx, nv, rv, iv, ideaPreviewClass, se };
