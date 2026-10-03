import test from 'node:test';
import assert from 'node:assert/strict';
import {USAGE_DAILY_DAYS,usageEmptyText,usagePresentation,usageVariant,usageResetLabel} from '../src/usage-model.mjs';
import {accountTokenUsage} from '../../harness/packages/codex-app-server/src/usage.js';
const window=(usedPercent,windowDurationMins=300)=>({usedPercent,windowDurationMins,resetsAt:1790035200});
test('usage prefers named buckets and displays used amounts, actual plan and extra model names',()=>{
 const p=usagePresentation({account:{account:{planType:'pro'}},limits:{rateLimits:{primary:window(99)},rateLimitsByLimitId:{codex:{primary:window(3),secondary:window(53,10080)},model:{limitName:'Fast model',secondary:window(95,10080)}}}});
 assert.equal(p.plan,'Pro');assert.deepEqual(p.rows.map(r=>[r.label,r.used,r.variant]),[['Current session',3,'accent'],['This week',53,'accent'],['Fast model · This week',95,'danger']]);
});
test('usage handles absent, null, nonfinite and zero honestly with legacy fallback',()=>{
 assert.deepEqual(usagePresentation(null),{rows:[],credits:[],spending:[],plan:null,daily:[],dailyLabel:'Last 30 days',lifetimeTokens:null});
 for(const used of [null,undefined,NaN,Infinity,'20'])assert.equal(usagePresentation({limits:{rateLimits:{primary:window(used)}}}).rows.length,0);
 assert.equal(usagePresentation({limits:{rateLimitsByLimitId:{},rateLimits:{primary:window(0)}}}).rows[0].used,0);
 assert.equal(usagePresentation({limits:{rateLimits:{primary:window(110)}}}).rows[0].used,100);
 assert.equal(usagePresentation({limits:{rateLimits:{primary:window(-5)}}}).rows[0].used,0);
});
test('source meter warning thresholds are 75 and 90; unknown durations are not mislabeled',()=>{
 assert.deepEqual([74,75,89,90,95].map(usageVariant),['accent','warning','warning','danger','danger']);
 for(const [duration,label] of [[null,'Primary limit'],[60,'1-hour limit'],[1440,'1-day limit'],[30,'30-minute limit']])assert.equal(usagePresentation({limits:{rateLimits:{primary:window(5,duration)}}}).rows[0].label,label);
});
test('credit balance retains backend units, unlimited and unavailable are distinct; spend does not invent a month',()=>{
 const p=usagePresentation({limits:{rateLimitsByLimitId:{codex:{credits:{balance:'0',hasCredits:false,unlimited:false},individualLimit:{limit:'500',used:'3',remainingPercent:99,resetsAt:1790035200}},extra:{credits:{balance:null,hasCredits:true,unlimited:false}},third:{credits:{unlimited:true}}}}});
 assert.deepEqual(p.credits.map(c=>c.balance),['0','Available','Unlimited']);assert.equal(p.spending[0].limit,'500');assert.equal('monthly' in p.spending[0],false);
 assert.equal(usagePresentation({limits:{rateLimits:{credits:{balance:null}}}}).credits.length,0);
});
test('usage preserves text as data and ignores malformed daily buckets without treating failure as zero',()=>{
 const p=usagePresentation({account:{account:{planType:'<img onerror=alert(1)>'}},tokenUsage:{dailyUsageBuckets:[null,{startDate:'2026-09-22',tokens:0},{startDate:'bad',tokens:null},{startDate:'<b>x</b>',tokens:1234}]}});
 assert.equal(p.plan,'<img onerror=alert(1)>');assert.deepEqual(p.daily.map(d=>[d.startDate,d.tokens]),[['<b>x</b>',1234],['2026-09-22',0]],'kept as data, sorted newest (greatest key) first');assert.deepEqual(usagePresentation({tokenUsage:{dailyUsageBuckets:{bad:true}}}).daily,[]);
});
test('reset labels use window-specific formats and omit missing or out-of-range dates',()=>{
 for(const v of [null,undefined,'12',Infinity,1e30])assert.equal(usageResetLabel(v,300,'en-US'),null);
 assert.match(usageResetLabel(1790035200,300,'en-US'),/^Resets at /);
 assert.match(usageResetLabel(1790035200,10080,'en-US'),/^Resets (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) /);
});
test('DeepSeek core: per-token billing copy instead of unavailable limits, and the bridge daily table',()=>{
 assert.equal(usageEmptyText('deepseek'),'DeepSeek bills per token; there are no plan usage limits.');
 assert.equal(usageEmptyText('deepseek-harness'),'DeepSeek bills per token; there are no plan usage limits.');
 for(const engine of ['codex',undefined])assert.equal(usageEmptyText(engine),'Usage limits are unavailable for this account or connection.');
 // The bridge's all-null rateLimits plus its folded token usage.
 const empty={limitId:null,limitName:null,primary:null,secondary:null,credits:null,individualLimit:null,spendControlReached:null,planType:null,rateLimitReachedType:null};
 const p=usagePresentation({limits:{rateLimits:empty,rateLimitsByLimitId:null},tokenUsage:accountTokenUsage([{days:{'2026-09-30':271,'2026-10-01':1200},longestTurnSec:30}],'2026-10-01')});
 assert.deepEqual(p.rows,[]);assert.deepEqual(p.credits,[]);assert.equal(p.plan,null);
 assert.deepEqual(p.daily,[{startDate:'2026-10-01',tokens:1200},{startDate:'2026-09-30',tokens:271}],'newest first');
 assert.equal(p.lifetimeTokens,1471);assert.equal(p.dailyLabel,'Last 30 days');
});
// R02: the harness reports every active day ascending since the first session; the page shows the last 30
// calendar days ending today (the home card's 30d range), newest first, capped at 30 rows, plus the
// all-time summary.lifetimeTokens.
const key=(base,offset)=>{const [y,m,d]=base.split('-').map(Number),date=new Date(y,m-1,d-offset);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;};
test('daily table: newest first, the last 30 days ending today, at most 30 rows, lifetime total kept',()=>{
 const today='2026-10-01',days={};for(let offset=0;offset<90;offset++)days[key(today,offset)]=offset+1;
 const tokenUsage=accountTokenUsage([{days,longestTurnSec:5}],today);
 assert.deepEqual(tokenUsage.dailyUsageBuckets.slice(0,2).map(b=>b.startDate),[key(today,89),key(today,88)],'precondition: the harness sorts ascending');
 const p=usagePresentation({tokenUsage},{todayKey:today});
 assert.equal(USAGE_DAILY_DAYS,30);assert.equal(p.daily.length,30);
 assert.deepEqual(p.daily.slice(0,3).map(b=>[b.startDate,b.tokens]),[[today,1],['2026-09-30',2],['2026-09-29',3]]);
 assert.equal(p.daily.at(-1).startDate,'2026-09-02','today minus 29 days is the oldest row');
 assert.equal(p.lifetimeTokens,90*91/2,'the total is the all-time summary, not the visible rows');
 // Sparse history: older days never pose as 'Last 30 days'; without todayKey only the cap applies.
 const sparse={dailyUsageBuckets:[{startDate:'2026-06-01',tokens:5},{startDate:'2026-09-20',tokens:7},{startDate:'2026-10-01',tokens:9}],summary:{lifetimeTokens:21}};
 assert.deepEqual(usagePresentation({tokenUsage:sparse},{todayKey:today}).daily.map(b=>b.startDate),['2026-10-01','2026-09-20']);
 assert.deepEqual(usagePresentation({tokenUsage:sparse}).daily.map(b=>b.startDate),['2026-10-01','2026-09-20','2026-06-01']);
 assert.equal(usagePresentation({tokenUsage:{...tokenUsage}}).daily.length,30,'cap without a clock');
 for(const lifetimeTokens of [undefined,null,-1,NaN,'12'])assert.equal(usagePresentation({tokenUsage:{dailyUsageBuckets:[],summary:{lifetimeTokens}}}).lifetimeTokens,null);
 assert.equal(usagePresentation({tokenUsage:{dailyUsageBuckets:[],summary:{lifetimeTokens:0}}}).lifetimeTokens,0);
 // Month boundaries use calendar days (2026-03-01 minus 29 days is 2026-01-31).
 assert.deepEqual(usagePresentation({tokenUsage:{dailyUsageBuckets:[{startDate:'2026-01-30',tokens:1},{startDate:'2026-01-31',tokens:2}]}},{todayKey:'2026-03-01'}).daily.map(b=>b.startDate),['2026-01-31']);
});
test('Usage page source: formatted dates and counts, Last updated beside Refresh, catalog loading copy',async()=>{
 const fs=await import('node:fs/promises');const path=await import('node:path');
 const app=path.resolve(import.meta.dirname,'..');
 const page=await fs.readFile(path.join(app,'src/source-usage.jsx'),'utf8');
 assert.match(page,/const dayCell=key=>\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(key\)\?formatDayKey\(key\):key;/);
 assert.match(page,/const tokenCount=value=>new Intl\.NumberFormat\(\)\.format\(value\);/);
 assert.match(page,/const todayKey=localDayKey\(new Date\(\)\);/);assert.match(page,/usagePresentation\(data,\{todayKey\}\)/);
 // DeepSeek core: the estimated-cost layout replaces the limits copy and the token table only when the bridge sent `deepseek`.
 assert.match(page,/const cost=deepseekCostPresentation\(data,\{todayKey\}\);/);assert.match(page,/\{!cost&&daily\.length>0&&<section/);
 assert.match(page,/<td>\{dayCell\(bucket\.startDate\)\}<\/td><td>\{tokenCount\(bucket\.tokens\)\}<\/td>/);
 assert.match(page,/<tfoot><tr><th scope="row">All time<\/th><td>\{tokenCount\(lifetimeTokens\)\}<\/td><\/tr><\/tfoot>/);
 assert.match(page,/<span className="su-updated">Last updated: <SourceTimestamp dateMs=\{updatedAt\}\/><\/span>/);
 assert.doesNotMatch(page,/Loading usage limits…|toLocaleString\(\)<\/td>|<td>\{bucket\.startDate\}<\/td>/);
 assert.match(page,/<span>Loading usage limits<\/span>/);
 const actions=await fs.readFile(path.join(app,'src/source-session-actions.jsx'),'utf8');
 assert.match(actions,/<p role="status">Loading usage limits<\/p>/);assert.doesNotMatch(actions,/Loading usage limits…/);
 const css=await fs.readFile(path.join(app,'src/source-usage.css'),'utf8');
 assert.match(css,/\.su-footer>\.su-updated\{color:var\(--cds-text-muted\)\}/);
 const {formatDayKey}=await import('../src/home-model.mjs');
 assert.equal(formatDayKey('2026-09-30','en-US'),'Sep 30','UTC keeps the key day in any zone');
});
