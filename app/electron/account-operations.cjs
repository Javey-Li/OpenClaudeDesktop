// Codex 0.155.1 account lifecycle. No profile/config writes or invented account data.
function createAccountOperations({getClient,openExternal,onState=()=>{},onAccount=()=>{}}) {
  let state={phase:'idle',login:null,error:''},attempt=null,epoch=0,readRevision=0,accountSnapshot=null;
  const accountChanged=value=>{accountSnapshot=value;onAccount(value);};
  const publish=patch=>{state={...state,...patch};onState(state);return state;};
  const current=t=>attempt===t&&t.epoch===epoch&&t.owner===getClient();
  const requireCurrent=t=>{if(!current(t))throw Error('The DeepSeek connection changed. Try again.');};
  const url=value=>{const parsed=new URL(value);if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw Error('Invalid sign-in URL.');return parsed.href;};
  async function refresh(owner=getClient()) {
    const generation=epoch,revision=++readRevision;
    try {
      await owner.start();if(owner!==getClient()||generation!==epoch||revision!==readRevision)return null;
      const account=await owner.request('account/read',{refreshToken:false});
      if(owner!==getClient()||generation!==epoch||revision!==readRevision)return null;
      accountChanged(account);return account;
    }catch(error){if(owner!==getClient()||generation!==epoch||revision!==readRevision)return null;throw error;}
  }

  async function finish(t,event) {
    if(!current(t))return;
    attempt=null;readRevision++;
    if(!event.success){publish({phase:'idle',login:null,error:event.error||'Sign-in failed. Try again.'});return;}
    const generation=epoch;publish({phase:'refreshing',login:null,error:''});
    try {await refresh(t.owner);if(generation===epoch&&t.owner===getClient()&&!attempt)publish({phase:'idle',error:''});}
    catch(error){if(generation===epoch&&t.owner===getClient()&&!attempt)publish({phase:'idle',error:error.message});}
  }
  async function start(type='chatgpt') {
    if(!['chatgpt','chatgptDeviceCode'].includes(type))throw Error('Unsupported sign-in method.');
    if(state.phase!=='idle'||attempt)throw Error('Finish or cancel the current account operation first.');
    const t={owner:getClient(),epoch,login:null,early:new Map()};attempt=t;readRevision++;
    publish({phase:'starting',login:null,error:''});
    try {
      await t.owner.start();requireCurrent(t);
      const result=await t.owner.request('account/login/start',{type});requireCurrent(t);
      if(result?.type!==type||typeof result.loginId!=='string'||!result.loginId)throw Error('DeepSeek returned an invalid sign-in response.');
      // Retain the true id even if URL validation/opening fails, so cancellation remains possible.
      t.login={type,loginId:result.loginId};
      publish({phase:'waiting',login:t.login,error:''});
      const completion=t.early.get(result.loginId);t.early.clear();
      if(completion){await finish(t,completion);return state;}
      const target=url(type==='chatgpt'?result.authUrl:result.verificationUrl);
      if(type==='chatgptDeviceCode'&&(typeof result.userCode!=='string'||!result.userCode))throw Error('DeepSeek returned an invalid device code.');
      t.login={...t.login,url:target,...(type==='chatgptDeviceCode'?{userCode:result.userCode}:{})};publish({login:t.login});
      await openExternal(target);if(current(t))publish({error:''});
      return state;
    } catch(error) {
      if(current(t)){if(!t.login)attempt=null;publish({phase:t.login?'waiting':'idle',login:t.login,error:error.message});}
      if(t.login && !current(t) && t.owner===getClient() && t.epoch===epoch)return state;
      throw error;
    }
  }
  async function cancel() {
    const t=attempt;
    if(!t?.login||state.phase!=='waiting')throw Error('No sign-in is ready to cancel.');
    publish({phase:'cancelling',error:''});
    try {
      const result=await t.owner.request('account/login/cancel',{loginId:t.login.loginId});requireCurrent(t);
      if(!['canceled','notFound'].includes(result?.status))throw Error('DeepSeek returned an invalid cancellation response.');
      if(result.status==='notFound'&&t.completion){await finish(t,t.completion);return state;}
      attempt=null;readRevision++;publish({phase:result.status==='notFound'?'refreshing':'idle',login:null,error:''});
      if(result.status==='notFound'){
        await refresh(t.owner);
        if(t.owner===getClient()&&t.epoch===epoch)publish({phase:'idle',error:''});
      }
      return state;
    }catch(error){
      if(current(t)&&t.completion){await finish(t,t.completion);return state;}
      if(current(t))publish({phase:'waiting',error:error.message});
      else if(t.owner===getClient()&&t.epoch===epoch&&!attempt)publish({phase:'idle',error:error.message});
      throw error;
    }
  }
  async function reopen() {
    const t=attempt;if(!t?.login?.url||state.phase!=='waiting')throw Error('No sign-in browser page is available.');
    requireCurrent(t);
    try {await openExternal(url(t.login.url));if(current(t))publish({error:''});}
    catch(error){if(current(t))publish({error:error.message});throw error;}
    return state;
  }
  async function logout(confirmed) {
    if(confirmed!==true)throw Error('Confirm sign out first.');
    if(state.phase!=='idle'||attempt)throw Error('Finish or cancel the current account operation first.');
    const owner=getClient(),generation=epoch;readRevision++;publish({phase:'signingOut',error:''});
    try {
      await owner.start();if(owner!==getClient()||generation!==epoch)throw Error('The DeepSeek connection changed. Try again.');
      await owner.request('account/logout',{});
      if(owner!==getClient()||generation!==epoch)return state;
      // The logout succeeded, but an environment-provided credential may remain.
      // Invalidate the old snapshot; only account/read determines the new identity.
      accountChanged(null);await refresh(owner);
      if(owner===getClient()&&generation===epoch)publish({phase:'idle',login:null,error:''});
      return state;
    }catch(error){if(owner===getClient()&&generation===epoch)publish({phase:'idle',error:error.message});throw error;}
  }
  function observe(event) {
    if(event.kind==='connection'&&!event.connected){epoch++;readRevision++;attempt=null;accountSnapshot=null;publish({phase:'idle',login:null,error:''});return;}
    if(event.method==='account/updated'){
      const owner=getClient(),generation=epoch;
      void refresh(owner).catch(error=>{if(owner===getClient()&&generation===epoch)publish({error:error.message});});return;
    }
    if(event.method!=='account/login/completed')return;
    const t=attempt,p=event.params||{};if(!t||!current(t)||typeof p.loginId!=='string')return;
    if(!t.login){t.early.set(p.loginId,p);if(t.early.size>16)t.early.delete(t.early.keys().next().value);return;}
    if(p.loginId!==t.login.loginId)return;
    if(state.phase==='cancelling'){t.completion=p;return;}
    void finish(t,p);
  }
  async function refreshAction(){
    if(state.phase!=='idle')throw Error('Finish or cancel the current account operation first.');
    const owner=getClient(),generation=epoch;publish({phase:'refreshing',error:''});
    try{const result=await refresh(owner);if(owner===getClient()&&generation===epoch)publish({phase:'idle',error:''});return result;}
    catch(error){if(owner===getClient()&&generation===epoch)publish({phase:'idle',error:error.message});throw error;}
  }
  return {snapshot:()=>state,accountSnapshot:()=>accountSnapshot,observe,start,cancel,reopen,logout,refresh,
    run(p={}){if(p.operation==='cancel')return cancel();if(p.operation==='open')return reopen();if(p.operation==='logout')return logout(p.confirmed);if(p.operation==='refresh')return refreshAction();throw Error('Unsupported account operation.');}};
}
module.exports={createAccountOperations};
