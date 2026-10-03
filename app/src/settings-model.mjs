// Independent settings search, cc011544b ft/Z:535–711. Only index rendered
// capabilities. Ranking normalization is distinct from literal visual marks.
export function normalizeSettingsQuery(value) {
 return String(value).normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[‘’‛]/g, "'").replace(/[“”]/g, '"').replace(/[\s_-]+/g, ' ').trim();
}
function searchSettingsRows(sections, groups, query) {
 const normalized=normalizeSettingsQuery(query),terms=normalized.split(' '),needle=normalized.replaceAll(' ','');
 const rank=value=>{
  const words=normalizeSettingsQuery(value).split(' '),flat=words.join('');
  if(flat===needle)return 0;
  if(flat.startsWith(needle))return 1;
  if(!terms.every(term=>flat.includes(term)))return -1;
  return terms.every(term=>words.some((_,index)=>words.slice(index).join('').startsWith(term)))?2:3;
 };
 const result=(section,kind='hit',row=null,extra={})=>({tab:section.id,section:section.label,icon:section.icon,kind,key:JSON.stringify([section.id,kind,row?.id||null]),label:row?.label||section.label,...(row?{id:row.id,via:row.label,subpathId:row.subpathId,focus:row.focus,targetSection:row.targetSection}:{}),...extra});
 if(!needle)return sections.map(section=>result(section));
 const ranked=sections.flatMap(section=>{
  const seen=new Set();
  const rows=groups.filter(group=>group.tab===section.id).flatMap(group=>group.rows).map(row=>({row,score:rank(row.searchLabel||row.label)}))
   .filter(entry=>entry.score>=0).sort((a,b)=>a.score-b.score).filter(({row})=>{const key=row.collapseKey||JSON.stringify([row.label,row.subpathId||null]);if(seen.has(key))return false;seen.add(key);return true;});
  const nameRank=rank(section.label);
  if(nameRank>=0)return [{section,score:nameRank,nameMatched:true,rows}];
  if(rows.length)return [{section,score:4+rows[0].score,nameMatched:false,rows}];
  const keyword=(section.keywords||[]).find(word=>normalizeSettingsQuery(word).replaceAll(' ','').includes(needle));
  return keyword?[{section,score:8,keyword,rows:[]}]:[];
 }).sort((a,b)=>a.score-b.score);
 const usedLabels=new Set(),hits=[];
 for(const {section,score,nameMatched,rows,keyword} of ranked){
  if(keyword){hits.push(result(section,'hit',null,{score,via:keyword}));continue;}
  const mayRepeat=section.customize||section.id==='connectors';
  const available=mayRepeat?rows:rows.filter(({row})=>!usedLabels.has(row.label));
  const addRow=(entry,kind)=>{if(!mayRepeat)usedLabels.add(entry.row.label);hits.push(result(section,kind,entry.row,{score}));};
  if(needle.length<2){
   if(nameMatched)hits.push(result(section,'hit',null,{score}));
   else if(available[0]&&available[0]===rows[0])addRow(available[0],'hit');
   continue;
  }
  if(!nameMatched&&available.length===1){addRow(available[0],'hit');continue;}
  if(!nameMatched&&!available.length)continue;
  hits.push(result(section,'hit',null,{score}));
  available.slice(0,3).forEach(entry=>addRow(entry,'child'));
  if(available.length>3)hits.push(result(section,'more',null,{score,count:available.length-3}));
 }
 return hits;
}
// A plugin skill visible under Skills should not appear a second time under
// Plugins. Hidden entries behind +N more remain eligible (source D:933–959).
export function settingsSearch(sections,groups,query) {
 const skills=searchSettingsRows(sections.filter(section=>section.id==='customize-skills'),groups,query);
 const visible=new Set(skills.filter(hit=>hit.kind!=='more'&&Array.isArray(hit.subpathId)).map(hit=>JSON.stringify(hit.subpathId)));
 const filtered=visible.size?groups.map(group=>group.tab==='customize-plugins'?{...group,rows:group.rows.filter(row=>!Array.isArray(row.subpathId)||!visible.has(JSON.stringify(row.subpathId)))}:group):groups;
 return searchSettingsRows(sections,filtered,query);
}
// shared-14 Cy/Ty: first literal lower-case substring only. Map back to original
// UTF-16 offsets so expanding case folds (İ) cannot split or eat adjacent text.
export function settingsMatchRange(text,query) {
 const needle=String(query).trim().toLowerCase();if(!needle)return null;
 const folded=text.toLowerCase(),start=folded.indexOf(needle);if(start<0)return null;
 if(text.length===folded.length)return {start,end:start+needle.length};
 const starts=[],ends=[];let offset=0;
 for(const char of text){for(let i=0;i<char.toLowerCase().length;i++){starts.push(offset);ends.push(offset+char.length);}offset+=char.length;}
 return {start:starts[start],end:ends[start+needle.length-1]};
}
// engine: coreEngine(boot.core). The DeepSeek core has no sandbox config, only
// per-session permission presets chosen in the Mode menu (config/read reports
// the open session's, else the default preset).
export const DEEPSEEK_SANDBOX_REASON='Set per session with the Mode menu (DeepSeek Harness permission presets).';
export function sandboxFacts(configResult,requirementsResult,{engine='codex'}={}) {
 const config=configResult?.config,requirements=requirementsResult?.requirements;
 const managed=Object.entries(configResult?.origins||{}).some(([key,value])=>['sandbox_mode','approval_policy'].includes(key)&&['mdm','enterpriseManaged','system','legacyManagedConfigToml','legacyManagedRequirementsToml'].includes(value?.name?.type||value?.source?.type));
 const limited=!!requirements?.allowedSandboxModes||!!requirements?.allowedApprovalPolicies;
 return {mode:config?.sandbox_mode??null,bypass:config?config.sandbox_mode==='danger-full-access'&&config.approval_policy==='never':null,
  reason:managed||limited?'Managed by your organization':config?(engine==='deepseek'?DEEPSEEK_SANDBOX_REASON:'Managed by DeepSeek'):'DeepSeek Harness configuration is unavailable.',allowedModes:requirements?.allowedSandboxModes??null};
}
// desktop-settings-read failures → page notices. Raw RPC text (a method the
// core lacks, a refused read) never becomes a page alert: the affected rows
// already read as unavailable. Only losing the core gets one short notice.
export function desktopErrors(errors) {
 return errors?.connection?[{key:'connection',message:'Couldn’t load settings from the DeepSeek core. Reconnect and try again.'}]:[];
}
export function mcpStatus(server){const state=server.runtimeStatus?.status||server.runtimeStatus?.type||server.runtimeStatus;return server.toolsError?'Failed':state==='connected'?'Running':state==='starting'?'Starting':state==='failed'?'Failed':state==='disabled'?'Disabled':state==='cancelled'?'Cancelled':state==='authenticationRequired'?'Sign in required':state==='notStarted'?'Not started':'Status unavailable';}
