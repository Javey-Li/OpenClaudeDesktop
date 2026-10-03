import {t} from '../electron/i18n/index.mjs';
// Host actions mapped to real Codex 0.155.1 capabilities. Claude 2.2553.1
// cc183b3ab supplies names/aliases; there is no app-server CLI command catalog.
export const sessionCommands = [
  {id:'compact',label:t('Compact conversation'),description:t('Summarize earlier context in this session'),session:true,idle:true,icon:'Archive'},
  {id:'clear',aliases:['reset','new'],label:t('New session'),description:t('Clear conversation history and free up context')},
  // /btw (cc183b3ab btw, 4Iu0xDY9v4): not idle-only, a side question never interrupts the running turn.
  {id:'btw',label:t('Side question'),description:t('Ask a quick side question without adding to the session'),argumentHint:'[question]',session:true,icon:'Chat'},
  {id:'review',label:t('Review code'),description:t('Review changes, a branch, commit, or instructions'),argumentHint:'[instructions]',session:true,idle:true,icon:'Search'},
  {id:'fork',label:t('Fork session'),description:t('Fork this session into a new one'),argumentHint:'[prompt]',session:true,idle:true,icon:'GitBranch'},
  {id:'rename',aliases:['name'],label:t('Rename session'),description:t('Rename this session'),argumentHint:'[new title]',session:true},
  {id:'model',label:t('Choose model'),description:t('Set the model for this session'),argumentHint:'[model-id]',connected:true,idle:true},
  {id:'effort',label:t('Reasoning effort'),description:t('Set the effort level for this session'),argumentHint:'[level]',connected:true,idle:true},
  {id:'fast',label:t('Fast mode'),description:t('Turn fast mode on or off'),argumentHint:'[on|off]',connected:true,idle:true},
  {id:'plan',label:t('Plan mode'),description:t('Switch to plan mode or view this session’s plan'),argumentHint:'[open|<description>]',idle:true},
  {id:'permissions',aliases:['allowed-tools'],label:t('Permission mode'),description:t('Change the permission mode'),idle:true},
  {id:'resume',aliases:['continue'],label:t('Find a session'),description:t('Search and continue a DeepSeek session from this computer'),argumentHint:'[search]'},
  {id:'status',label:t('Session status'),description:t('Show this session’s version, model, environment, and account'),session:true,idle:true,icon:'UsageGaugeMiddle'},
  {id:'usage',aliases:['stats','cost'],label:t('Usage'),description:t('Show plan usage and rate limits')},
  {id:'diff',label:t('Show changes'),description:t('Show or hide this session’s changes'),session:true},
  {id:'workflow',label:t('Run workflow'),description:t('Run a local dynamic workflow'),argumentHint:'[path] [--plan] [--resume run-id] [--args JSON]',session:true},
  {id:'workflows',label:t('Workflows'),description:t('Show workflows in background tasks'),session:true},
  {id:'tasks',aliases:['bashes'],label:t('Background tasks'),description:t('Show this session’s background tasks'),session:true},
  {id:'config',aliases:['settings'],label:t('Settings'),description:t('Open Code settings')},
  {id:'theme',label:t('Appearance'),description:t('Set the appearance (system, light, or dark)'),argumentHint:'[system|light|dark]'},
  {id:'sandbox',label:t('Sandbox'),description:t('Open Code sandbox settings')},
  {id:'add-dir',label:t('Add directory'),description:t('Add another folder to this session'),argumentHint:'[path]'},
  {id:'export',label:t('Export conversation'),description:t('Export this session’s transcript'),session:true,idle:true},
  {id:'rewind',label:t('Rewind conversation'),description:t('Rewind the session to an earlier message'),session:true,idle:true},
  {id:'skills',label:t('Skills'),description:t('Browse and manage your skills')},
  {id:'mcp',label:t('Connectors'),description:t('Manage MCP connectors')},
  // Existing local plugin management is real; unsupported /plugin install is not advertised.
  {id:'plugin',aliases:['plugins','marketplace'],label:t('Plugins'),description:t('Manage plugins')},
  {id:'help',label:t('Help'),description:t('Get help and support')},
];
const findCommand = name => sessionCommands.find(c => c.id === name || c.aliases?.includes(name));
export function commandSuggestion(name) {
  const distance = (a,b) => { let row=Array.from({length:b.length+1},(_,i)=>i); for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next;}return row[b.length]; };
  const ranked=sessionCommands.map(c=>({id:c.id,d:Math.min(...[c.id,...c.aliases||[]].map(n=>distance(name,n)))})).sort((a,b)=>a.d-b.d);
  return ranked[0]?.d <= (name.length<=4?1:2) && ranked[0].d !== ranked[1]?.d ? ranked[0].id : null;
}
// Skills in '/' (cc183b3ab-BNeMUZS1.js:619-700: the slash list is the session's supported commands, which
// include its user-invocable skills; c099c328d-CbkcmYSW.js:10637-10690 maps each name to its entry). Only
// enabled skills whose name is one slash token (plugin-qualified names keep their ':' or '.') reach the list;
// a built-in command keeps its own name.
const SLASH_NAME=/^[a-z0-9][a-z0-9_:.-]*$/i;
export function slashSkills(skills=[],customCommands=[]) {
  const seen=new Set(slashCustomCommands(customCommands).map(command=>command.name.toLowerCase())),out=[];
  for(const skill of Array.isArray(skills)?skills:[]){
    const name=typeof skill?.name==='string'?skill.name:'',key=name.toLowerCase();
    if(!SLASH_NAME.test(name)||findCommand(key)||seen.has(key)||typeof skill.path!=='string'||!skill.path)continue;
    seen.add(key);out.push({name,description:skill.description||'',argumentHint:skill.argumentHint||'',path:skill.path});
  }
  return out;
}
const findSkill=(name,context)=>slashSkills(context?.skills,context?.customCommands).find(skill=>skill.name.toLowerCase()===name);
// Custom commands (C3; custom-commands-model.mjs mergeCommands rows): user prompt templates from
// <userData>/commands and <project>/.code-desktop/commands. Built-in commands win; a shadowed row is not offered.
const CUSTOM_NAME=/^[a-z0-9][a-z0-9_-]{0,63}$/i;
export function slashCustomCommands(customCommands=[]) {
  const seen=new Set(),out=[];
  for(const row of Array.isArray(customCommands)?customCommands:[]){
    const name=typeof row?.name==='string'?row.name:'',key=name.toLowerCase();
    if(!CUSTOM_NAME.test(name)||row.shadowedBy||findCommand(key)||seen.has(key))continue;
    seen.add(key);out.push({name,description:row.description||'',argumentHint:row.argumentHint||'',body:typeof row.body==='string'?row.body:'',scope:row.scope==='project'?'project':'global',path:row.path||''});
  }
  return out;
}
const findCustom=(name,context)=>slashCustomCommands(context?.customCommands).find(command=>command.name.toLowerCase()===name);
// A known skill parses as {skill, args} with no error: send() treats it as a message, whose leading
// '/name' becomes the {type:'skill'} input item.
export function parseSessionCommand(text, context={}) {
  const value=String(text).trim(),named=/^\/([a-z0-9][a-z0-9_:.-]*)(?=\s|$)/i.exec(value);
  const custom=named&&!findCommand(named[1].toLowerCase())?findCustom(named[1].toLowerCase(),context):null;
  if(custom)return {id:custom.name,args:value.slice(named[0].length).trim(),requested:named[1].toLowerCase(),command:null,skill:null,custom,suggestion:null,error:null};
  const skill=named&&!findCommand(named[1].toLowerCase())?findSkill(named[1].toLowerCase(),context):null;
  if(skill)return {id:skill.name,args:value.slice(named[0].length).trim(),requested:named[1].toLowerCase(),command:null,skill,suggestion:null,error:null};
  const match=/^\/([a-z0-9][a-z0-9_-]*)\b/i.exec(value);
  if(!match || value[match[0].length]==='/')return null;
  const requested=match[1].toLowerCase(),command=findCommand(requested),id=command?.id||requested,args=value.slice(match[0].length).trim();
  const suggestion=command?null:commandSuggestion(requested);
  let error=null;
  if(!command)error=requested==='cd'?t('Changing the directory isn’t available for this session.'):['feedback','bug','share','login','logout','ultrareview','usage-credits','extra-usage'].includes(requested)?t('/{command} isn’t available in the app.',{command:requested}):t('/{command} isn’t a command here.',{command:requested});
  else if(/[\r\n]/.test(value))error=t('/{command} only works on a single line. Remove the extra lines and try again.',{command:requested});
  else if(args&&!command.argumentHint)error=t('/{command} doesn’t take arguments here. Remove the text after the command and try again.',{command:requested});
  return {id,args,requested,command,suggestion,error};
}
// The core request behind each session action. A core lists the ones it
// cannot serve in initialize capabilities.unsupportedMethods (boot.core).
const COMMAND_METHODS={fork:'thread/fork',review:'review/start',rewind:'thread/revert'};
export function unsupportedCommand(id, context={}) {
  return context.unsupportedMethods?.includes(COMMAND_METHODS[id])?t('Not available with the DeepSeek core yet'):'';
}
export function commandUnavailable(command, context={}) {
  const unsupported=unsupportedCommand(command.id,context);
  if(unsupported)return unsupported;
  if(command.id==='workflow'&&context.dynamicWorkflows!==true)return t('Enable Dynamic workflows in Code settings first');
  if(command.id==='status'&&context.running)return t('Session info is available when DeepSeek finishes this turn.');
  if(command.id==='fast'&&context.fastAvailable===false)return t('Fast mode is not available for this model');
  if(command.id==='effort'&&context.effortAvailable===false)return t('Reasoning effort is not available for this model');
  if(command.session&&!context.current)return t('Open a session first');
  if(command.session&&context.archived)return t('Restore this archived session first');
  if((command.session||command.connected)&&!context.connected)return t('Reconnect to DeepSeek first');
  if((command.session||command.idle)&&context.loading)return t('Wait for the session to load');
  if(command.idle&&(context.running||context.sending||context.pending))return t('Wait for the current task to finish or stop it');
  if(['compact','fork','review','rewind'].includes(command.id)&&!context.hasHistory)return t('Send a message first');
  return '';
}
export function slashQuery(text) {
  const value=String(text);
  return value.startsWith('/')&&!/^\/\s/.test(value)&&value.length<=51&&!/[\r\n]/.test(value)?value.slice(1):null;
}
export function matchCommands(query, context={}) {
  const value=String(query).replace(/^\//,'').toLowerCase();
  if(value.length>50)return [];
  const spaced=/^(\S+)\s+(\S)?/.exec(value);
  if(spaced&&(spaced[2]||findCommand(spaced[1])||findCustom(spaced[1],context)||findSkill(spaced[1],context)))return [];
  const q=value.trim();
  const rank=c=>c.id===q?0:c.aliases?.includes(q)?1:c.id.startsWith(q)?2:c.aliases?.some(a=>a.startsWith(q))?3:4;
  const commands=sessionCommands.filter(c=>!commandUnavailable(c,context)&&(!q||[c.id,...c.aliases||[]].some(n=>n.includes(q))))
    .sort((a,b)=>rank(a)-rank(b)).map(c=>({...c,matchedAlias:q&&!c.id.includes(q)?c.aliases?.find(n=>n.includes(q)):null}));
  // Skill rows follow the host commands: {id: name, description, argumentHint, kind:'skill', path}.
  // Custom rows sit between them (the menu draws a 'Custom' header before the first): kind 'custom'.
  const custom=slashCustomCommands(context.customCommands).map(command=>({id:command.name,description:command.description,argumentHint:command.argumentHint,kind:'custom',scope:command.scope,matchedAlias:null}))
    .filter(command=>!q||command.id.toLowerCase().includes(q)).sort((a,b)=>rank({id:a.id.toLowerCase()})-rank({id:b.id.toLowerCase()}));
  const skills=slashSkills(context.skills,context.customCommands).map(skill=>({id:skill.name,description:skill.description,argumentHint:skill.argumentHint,kind:'skill',path:skill.path,matchedAlias:null}))
    .filter(skill=>!q||skill.id.toLowerCase().includes(q)).sort((a,b)=>rank({id:a.id.toLowerCase()})-rank({id:b.id.toLowerCase()}));
  return [...commands,...custom,...skills];
}
export function commandArgumentHint(text, context={}) {
  if(text.length>128||!/^\/\S+[ \t]+$/.test(text))return '';
  const name=text.trim().slice(1).toLowerCase();
  return findCommand(name)?.argumentHint||findCustom(name,context)?.argumentHint||'';
}
// '/plan [open|share|<description>]' (cc43287c9-BMbiZYzF.js:28880-28916 vG). Not yet planning: switch to Plan, open the
// pane when a plan exists (bare/open) or leave the description in the draft. Already planning: open the pane when it
// can, otherwise the 'already_in_plan' / 'already_in_plan_no_plan' notice; a description still goes to the draft
// with 'already_in_plan'. Plan not selectable: only a bare '/plan' over a written plan opens the pane.
export function planCommandAction({arg='',currentMode,planSelectable=true,hasPlan=false,canOpenPane=false,paneAlreadyOpen=false}={}){
  const planning=currentMode==='plan',lower=arg.toLowerCase(),described=arg!==''&&lower!=='open'&&lower!=='share',openable=hasPlan&&canOpenPane&&!paneAlreadyOpen;
  if(!planning&&!planSelectable)return described||!openable?{kind:'unavailable'}:{kind:'run',switchToPlan:false,openPane:true,notice:null,composerText:null};
  if(described)return {kind:'run',switchToPlan:!planning,openPane:planning&&openable,notice:planning?'already_in_plan':null,composerText:arg};
  return {kind:'run',switchToPlan:!planning,openPane:openable,notice:planning?(hasPlan?(openable?null:'already_in_plan'):'already_in_plan_no_plan'):null,composerText:null};
}
export const operationPending=operation=>['starting','running','unknown'].includes(operation?.phase);
export function rateLimitRows(result) {
  const entries=result?.rateLimitsByLimitId&&Object.keys(result.rateLimitsByLimitId).length?Object.entries(result.rateLimitsByLimitId):result?.rateLimits?[['codex',result.rateLimits]]:[];
  return entries.flatMap(([key,limits])=>['primary','secondary'].flatMap(window=>{
    const data=limits?.[window];if(!data||!Number.isFinite(data.usedPercent))return [];
    const minutes=data.windowDurationMins;
    return [{key:`${key}:${window}`,label:`${limits.limitName||key} · ${Number.isFinite(minutes)&&minutes>0?minutes%1440===0?t('{count} days',{count:minutes/1440}):minutes%60===0?t('{count} hours',{count:minutes/60}):t('{count} minutes',{count:minutes}):window}`,remaining:Math.max(0,Math.min(100,100-data.usedPercent)),resetsAt:Number.isFinite(data.resetsAt)?data.resetsAt:null}];
  }));
}
