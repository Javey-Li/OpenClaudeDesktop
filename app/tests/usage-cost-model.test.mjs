import test from 'node:test';
import assert from 'node:assert/strict';
import {COST_FOOTNOTE,DEEPSEEK_USAGE_URL,deepseekCostPresentation,formatCny} from '../src/usage-cost-model.mjs';
import {accountTokenUsage,foldSession} from '../../harness/packages/codex-app-server/src/usage.js';
// Local wall-clock times like the harness fold; the price tier is the same instant's Beijing time.
const at=(day,hour)=>new Date(2026,8,day,hour).getTime();
const reply=(time,model,usage)=>({type:'assistant/message',time,data:{turn:1,step:0,message:{role:'assistant',content:'ok',source:{model}},stream:[],usage}});
test('¥ keeps 2 decimals, 4 below one fen, and unknown cost is a dash, never ¥0',()=>{
 assert.equal(formatCny(12.3456,'en-US'),'¥12.35');assert.equal(formatCny(1234.5,'en-US'),'¥1,234.50');assert.equal(formatCny(0,'en-US'),'¥0.00');
 assert.equal(formatCny(0.00421,'en-US'),'¥0.0042');assert.equal(formatCny(0.01,'en-US'),'¥0.01');
 for(const value of [null,undefined,NaN,-1,'3'])assert.equal(formatCny(value),'—');
 assert.match(COST_FOOTNOTE,/官方价格估算.*峰谷分时.*以 DeepSeek 平台账单为准/);
});
test('the bridge deepseek field becomes tiles, cost categories, models and newest-first days within 30 days',()=>{
 const sessions=[foldSession([
  reply(at(30,10),'deepseek-v4-flash',{inputTokens:600000,outputTokens:300000,cacheReadTokens:66500}),
  reply(at(29,22),'deepseek-v4-pro',{inputTokens:100000,outputTokens:50000,cacheWriteTokens:1000}),
  reply(at(10,9),'deepseek-flash',{inputTokens:1000,outputTokens:1000}),
  reply(at(1,9)-60*864e5,'deepseek-flash',{inputTokens:5,outputTokens:5}),
  reply(at(29,23),'mystery',{inputTokens:10,outputTokens:0}),
 ])];
 const tokenUsage=accountTokenUsage(sessions,'2026-09-30');
 const cost=deepseekCostPresentation({tokenUsage,account:{deepseek:{links:{usageUrl:'https://platform.deepseek.com/usage?x=1'}}}},{todayKey:'2026-09-30',locale:'en-US'});
 assert.deepEqual(cost.tiles.map(t=>[t.key,t.label,t.tokens]),[['all','Total tokens',1119520],['30d','Last 30 days',1119510],['today','Today',966500]]);
 assert.equal(cost.tiles[2].cost,tokenUsage.deepseek.today.costCny);assert.ok(cost.tiles[2].cost>0);
 assert.equal(cost.tiles[0].partial,true,'an unpriced model makes the all-time cost partial');assert.equal(cost.partial,true);
 assert.deepEqual(cost.categories.map(c=>[c.key,c.label,c.tokens]),[['input','Input',702015],['cached','Cached input',66500],['output','Output',351005]],'cache writes bill as input');
 assert.equal(cost.categoryBasis,'cost');assert.ok(Math.abs(cost.categories.reduce((s,c)=>s+c.share,0)-1)<1e-9);
 assert.deepEqual(cost.models.map(m=>[m.name,m.tokens,m.share===1]),[['4.1 Flash',968510,true],['4 Pro',151000,false],['mystery',10,false]]);
 assert.equal(cost.models[2].cost,null);
 assert.deepEqual(cost.daily.map(d=>[d.date,d.label]),[['2026-09-30','Sep 30'],['2026-09-29','Sep 29'],['2026-09-10','Sep 10']],'newest first; the 60-days-old day is left out');
 assert.equal(cost.daily[0].share,1);assert.equal(cost.usageUrl,'https://platform.deepseek.com/usage?x=1');
 // Only the DeepSeek platform is linked.
 assert.equal(deepseekCostPresentation({tokenUsage,account:{deepseek:{links:{usageUrl:'https://evil.example/usage'}}}},{todayKey:'2026-09-30'}).usageUrl,DEEPSEEK_USAGE_URL);
});
test('no deepseek field (Codex core, fixtures) or a malformed one keeps the Codex layout; nothing used is zeros',()=>{
 for(const data of [null,{},{tokenUsage:{summary:{lifetimeTokens:5},dailyUsageBuckets:[]}},{tokenUsage:{deepseek:[]}},{tokenUsage:{deepseek:{allTime:{}}}}])assert.equal(deepseekCostPresentation(data,{todayKey:'2026-09-30'}),null);
 const empty=deepseekCostPresentation({tokenUsage:accountTokenUsage([],'2026-09-30')},{todayKey:'2026-09-30'});
 assert.deepEqual(empty.tiles.map(t=>[t.tokens,t.cost,t.partial]),[[0,0,false],[0,0,false],[0,0,false]]);
 assert.deepEqual([empty.models,empty.daily,empty.categoryBasis],[[],[],'tokens']);
 // Garbage rows never render.
 const junk=deepseekCostPresentation({tokenUsage:{deepseek:{allTime:{tokens:5},last30Days:{},today:{},models:[null,{model:'m',tokens:-1}],daily:[{date:'bad',tokens:5},{date:'2026-09-30',tokens:'5'}]}}},{todayKey:'2026-09-30'});
 assert.deepEqual([junk.models,junk.daily],[[],[]]);assert.equal(junk.tiles[0].cost,null);
});
test('custom prices from Settings › Models switch the footnote source (C5 review)',async()=>{
 const {CUSTOM_COST_FOOTNOTE}=await import('../src/usage-cost-model.mjs');
 const sessions=[foldSession([reply(at(30,10),'deepseek-v4-flash',{inputTokens:1000,outputTokens:1000})])];
 const official=deepseekCostPresentation({tokenUsage:accountTokenUsage(sessions,'2026-09-30')},{todayKey:'2026-09-30'});
 assert.equal(official.customPrices,false);
 const custom=deepseekCostPresentation({tokenUsage:{deepseek:{...accountTokenUsage(sessions,'2026-09-30').deepseek,customPrices:true}}},{todayKey:'2026-09-30'});
 assert.equal(custom.customPrices,true);
 assert.match(CUSTOM_COST_FOOTNOTE,/Settings › Models/);assert.doesNotMatch(CUSTOM_COST_FOOTNOTE,/官方/);
});
