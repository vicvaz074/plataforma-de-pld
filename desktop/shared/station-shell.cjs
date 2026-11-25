'use strict';
const {staticAssets}=require('../runtime/files.cjs');
const {corporateOrigin}=require('./setup.cjs');

// Only these specific, unreachable-network conditions can select an offline
// workflow. Certificate errors, wrong origin, HTTP denials and unknown errors
// never get treated as temporary loss of connectivity.
const unreachable=new Set(['ERR_CONNECTION_REFUSED','ERR_CONNECTION_TIMED_OUT','ERR_CONNECTION_RESET','ERR_ADDRESS_UNREACHABLE','ERR_NETWORK_CHANGED','ERR_INTERNET_DISCONNECTED','ERR_NAME_NOT_RESOLVED','ERR_TIMED_OUT']);
function isDisconnected(err){
  const msg=String(err?.message||'');
  const m=msg.match(/(?:^|\bnet::)(ERR_[A-Z_]+)\b/);
  return Boolean(m && unreachable.has(m[1]));
}
const trustError=()=>new Error('La conexión segura con el servidor de tu organización no pudo verificarse.');
const sessionNames=['__Host-better-auth.session_token','__Secure-better-auth.session_token','better-auth.session_token'];
function approvedCookie(cookies,origin,now=Date.now()){
  const u=new URL(origin);
  const candidates=cookies.filter(c=>sessionNames.includes(c.name)&&c.httpOnly&&c.secure&&c.value&&
    c.domain?.replace(/^\./,'').toLowerCase()===u.hostname.toLowerCase()&&
    (!c.expirationDate||c.expirationDate*1000>now));
  // Never guess which identity is current if both a legacy and modern
  // session token remain attached to this installation.
  if(candidates.length!==1)return {credential:null,credentialExpiresAt:undefined};
  const c=candidates[0];return {credential:c.value,credentialExpiresAt:c.expirationDate?c.expirationDate*1000:undefined};
}
function createStationTransport({session:s,origin:rawOrigin,assetsPath,directory,crypt,contracts,offline,intervalMs=15000}){
  const origin=corporateOrigin(rawOrigin);
  const store=offline.createOfflineStation({directory,origin,crypt,contracts});
  const assets=staticAssets(assetsPath);
  let running=false,closed=false;
  const credentials=async()=>approvedCookie(await s.cookies.get({url:origin+'/api/v1/session'}),origin);
  function forward(credential){
    return async function online(req){
      const url=new URL(req.url);
      if(closed||url.origin!==origin||!url.pathname.startsWith('/api/')||url.username||url.password)throw trustError();
      // A timer may have captured an earlier session while the user was
      // signing out. Never replay its pending work under a new account.
      if((await credentials()).credential!==credential)throw trustError();
      const headers=new Headers(req.headers);
      for(const k of ['cookie','authorization','host','forwarded','x-forwarded-for','x-forwarded-host','x-forwarded-proto','cf-connecting-ip','connection','content-length','accept-encoding'])headers.delete(k);
      if(!['GET','HEAD'].includes(req.method))headers.set('origin',origin);
      let res;
      try{
        // Bypass our intercepted HTTPS handler exactly once, using Chromium's
        // real TLS checks, enterprise trust settings and origin cookie jar.
        const opts={method:req.method,headers,bypassCustomProtocolHandlers:true,credentials:'include',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'};
        if(!['GET','HEAD'].includes(req.method) && req.body)opts.body=await req.arrayBuffer();
        res=await s.fetch(url.href,opts);
      }catch(err){if(isDisconnected(err))throw offline.offlineUnavailable();throw trustError();}
      if(res.status>=300&&res.status<=399)throw trustError();
      return res;
    };
  }
  async function handle(req){
    const u=new URL(req.url);
    if(u.origin!==origin || u.username || u.password)return Response.json({error:'Origen no permitido.'},{status:403});
    if(!u.pathname.startsWith('/api/'))return assets.fetch(req);
    const ref=req.headers.get('origin');
    if(ref && ref!==origin)return Response.json({error:'Origen no permitido.'},{status:403});
    if(u.pathname.replace(/\/+$/,'')==='/api/v1/bootstrap')return Response.json({error:'No disponible en una estación.'},{status:404});
    const auth=await credentials();
    try {
      const res=await store.handle(req,{...auth,online:forward(auth.credential)});
      if (u.pathname==='/api/auth/sign-out' && req.method==='POST') {
        // Chromium cannot receive a Set-Cookie clearing directive from a
        // disconnected server. Never leave its still-valid login in place
        // after a local sign-out, including when TLS verification failed.
        const rows=await s.cookies.get({url:origin+'/api/auth/sign-out'});
        for(const c of rows)if(sessionNames.includes(c.name))await s.cookies.remove(origin+(c.path||'/'),c.name);
        await s.cookies.flushStore();
      }
      return res;
    }catch{ return Response.json({error:'No se pudo verificar la sesión o la conexión segura con el servidor.'},{status:503,headers:{'Cache-Control':'no-store'}}); }
  }
  async function poll(){
    if(closed||running)return;running=true;
    try{
      const auth=await credentials();
      if(auth.credential){
        const status=await store.status(auth.credential);
        if(Number(status?.pending??status?.pendingCount??0)>0)await store.sync({...auth,online:forward(auth.credential)});
      }
    }catch{/* Pending drafts stay in encrypted storage; UI status permits retry. */}
    finally{running=false;}
  }
  s.protocol.handle('https',handle);
  const timer=setInterval(()=>{void poll();},intervalMs);timer.unref?.();
  return {handle,poll,async close(){if(closed)return;closed=true;clearInterval(timer);s.protocol.unhandle('https');await store.close();}};
}
module.exports={isDisconnected,approvedCookie,createStationTransport};
