import React,{useEffect,useRef,useState} from 'react';
import {SourceSettingsButton as Button} from './source-settings-button.jsx';
import {accountSettingsPlan} from './account-settings-model.mjs';
import './source-account-settings.css';

export function useAccountSettings({snapshot,auth,connected,busy,engine,onLogin,onAccountAction,onRefreshAccount,onOpenExternal}) {
  const [working,setWorking]=useState(null),[error,setError]=useState(''),[confirm,setConfirm]=useState(false);
  const locked=useRef(false),alive=useRef(true),cancelRef=useRef(null),signoutRef=useRef(null),wasConfirm=useRef(false);
  const scope=useRef(null);scope.current={connected,auth,snapshot};
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>setConfirm(false),[snapshot?.account]);
  useEffect(()=>{if(!connected){setConfirm(false);setError('');}},[connected]);
  useEffect(()=>{if(confirm)cancelRef.current?.focus();else if(wasConfirm.current)signoutRef.current?.focus();wasConfirm.current=confirm;},[confirm]);
  const phase=auth?.phase||'idle',login=auth?.login,account=snapshot?.account;
  const waiting=phase==='waiting',active=phase!=='idle';
  async function run(fn,operation){
    if(locked.current)return;locked.current=true;setWorking(operation);setError('');const owner=scope.current;
    try{await fn();return true;}catch(e){if(alive.current&&scope.current.connected&&owner.snapshot===scope.current.snapshot)setError(e.message);return false;}
    finally{locked.current=false;if(alive.current)setWorking(null);}
  }
  const action=operation=>run(()=>onAccountAction({operation}),operation);
  const disabled=!connected||working||active;
  // ks busy owns the active action without replacing its label or disabling
  // the focused native button. Other actions remain genuinely unavailable.
  const refreshing=working==='refresh'||phase==='refreshing';
  const signingOut=working==='logout'||phase==='signingOut';
  const cancelling=working==='cancel'||phase==='cancelling';
  const signInBusy=working==='chatgpt',deviceBusy=working==='chatgptDeviceCode';
  const message=auth?.error||error;
  const alert=message?<p role="alert" className="ss-account-error">{message}</p>:null;
  // DeepSeek core: one key row (Refresh, Manage keys); no ChatGPT sign-in, sign-out or device code.
  const plan=accountSettingsPlan(snapshot,{engine});
  if(plan.kind==='deepseek')return [{id:'account',label:plan.label,description:plan.description,searchText:`DeepSeek account API key ${plan.description} Manage keys Refresh`,control:<div className="ss-account-controls">
    <Button size="sm" busy={refreshing} disabled={!connected||!onRefreshAccount||!!((working||active)&&!refreshing)} onClick={()=>run(onRefreshAccount,'refresh')}>Refresh</Button>
    <Button size="sm" busy={working==='manage'} disabled={!onOpenExternal||!!(working&&working!=='manage')} onClick={()=>run(()=>onOpenExternal(plan.manageUrl),'manage')}>Manage keys</Button>
  </div>,below:alert}];
  const accountLabel=account?.email || ({chatgpt:'Connected with ChatGPT',chatgptAuthTokens:'Connected with ChatGPT',apiKey:'API key authentication',amazonBedrock:'Amazon Bedrock'})[account?.type] || (account?'Connected':snapshot==null?'Account unavailable':'Not signed in');
  const rows=[{id:'account',label:'Account',description:accountLabel,searchText:'DeepSeek account Sign out Refresh',control:<div className="ss-account-controls">
    <Button size="sm" busy={refreshing} disabled={!connected||!onRefreshAccount||!!((working||active)&&!refreshing)} onClick={()=>run(onRefreshAccount,'refresh')}>Refresh</Button>
    {account&&onAccountAction&&<Button ref={signoutRef} size="sm" disabled={disabled||busy||confirm} onClick={()=>setConfirm(true)}>Sign out</Button>}
  </div>,below:<>{account&&confirm&&<div className="ss-account-confirm"><p>Sign out of the shared DeepSeek account? Other tools using DeepSeek Harness on this computer will also need to sign in again.</p><div className="ss-account-controls"><Button ref={cancelRef} size="sm" disabled={!!working||signingOut} onClick={()=>setConfirm(false)}>Cancel</Button><Button size="sm" variant="primary" busy={signingOut} disabled={!!(working&&!signingOut)||busy||!connected} onClick={async()=>{if(await run(()=>onAccountAction({operation:'logout',confirmed:true}),'logout'))setConfirm(false);}}>Confirm sign out</Button></div></div>}{account&&alert}</>}];
  if(account?.planType)rows.push({id:'plan',label:'Plan',description:account.planType});
  if(!account||['starting','waiting','cancelling'].includes(phase))rows.push({id:'signin',label:'Sign in with ChatGPT',searchText:'Sign in with ChatGPT device code Cancel login',description:phase==='starting'?'Starting sign-in…':phase==='cancelling'?'Cancelling sign-in…':phase==='refreshing'?'Checking account…':waiting?(login?.userCode?'Enter this code on the sign-in page.':'Complete sign-in in your browser.'):'Sign in through your browser, or use a device code.',control:<div className="ss-account-controls">
    {waiting||phase==='cancelling'?<><Button size="sm" busy={working==='open'} disabled={!connected||!!(working&&working!=='open')||!waiting||!onAccountAction||!login?.url} onClick={()=>action('open')}>Open browser</Button><Button size="sm" busy={cancelling} disabled={!connected||!!(working&&!cancelling)||(!waiting&&!cancelling)||!onAccountAction} onClick={()=>action('cancel')}>Cancel sign-in</Button></>:<><Button size="sm" variant="primary" busy={signInBusy} disabled={!connected||!onLogin||!!((working||active)&&!signInBusy)} onClick={()=>run(()=>onLogin('chatgpt'),'chatgpt')}>Sign in</Button><Button size="sm" busy={deviceBusy} disabled={!connected||!onLogin||!!((working||active)&&!deviceBusy)} onClick={()=>run(()=>onLogin('chatgptDeviceCode'),'chatgptDeviceCode')}>Use device code</Button></>}
  </div>,below:<>{login?.userCode&&<code className="ss-account-code" aria-label="Sign-in code">{login.userCode}</code>}{!account&&alert}</>});
  return rows;
}
