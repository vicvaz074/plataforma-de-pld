'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {approvedCookie,isDisconnected,createStationTransport}=require('./station-shell.cjs');
const origin='https://pld.empresa.test';
const cookie={name:'__Secure-better-auth.session_token',value:'opaque-test-session',domain:'pld.empresa.test',secure:true,httpOnly:true,expirationDate:Date.now()/1000+600};
test('offline identity is an unexpired HttpOnly secure server session, never another token',()=>{
  assert.equal(approvedCookie([cookie],origin).credential,cookie.value);
  for(const bad of [{expirationDate:Date.now()/1000-10},{httpOnly:false},{secure:false},{domain:'elsewhere.test'},{name:'display-user'}])assert.equal(approvedCookie([{...cookie,...bad}],origin).credential,null);
  assert.equal(approvedCookie([cookie,{...cookie,name:'better-auth.session_token'}],origin).credential,null);
});
test('trust failures never enter disconnected mode',()=>{
  for(const msg of ['net::ERR_INTERNET_DISCONNECTED','net::ERR_CONNECTION_REFUSED','net::ERR_NAME_NOT_RESOLVED'])assert.equal(isDisconnected(Error(msg)),true);
  for(const msg of ['net::ERR_CERT_AUTHORITY_INVALID','net::ERR_SSL_PROTOCOL_ERROR','net::ERR_FAILED','Forbidden','net::ERR_TOO_MANY_REDIRECTS'])assert.equal(isDisconnected(Error(msg)),false);
});
test('station shell stays on the configured origin and guards replay across a changed identity',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'station-shell-'));let active=[cookie],proxy,tlsFailure=null,consumer=null,tick=0;
  fs.writeFileSync(path.join(dir,'index.html'),'shell packaged with desktop');
  const ctx={
    session:{protocol:{handle(s,h){assert.equal(s,'https');proxy=h;},unhandle(){}},cookies:{get:async()=>active},fetch:async(url,opts)=>{assert.equal(opts.credentials,'include');assert.equal(opts.bypassCustomProtocolHandlers,true);assert.equal(opts.headers.get('authorization'),null);assert.equal(opts.headers.get('cookie'),null);if(tlsFailure)throw tlsFailure;assert.ok(url.startsWith(origin+'/api/'));return Response.json({ok:true});}},
    origin,assetsPath:dir,directory:dir,crypt:{},intervalMs:1_000_000,
    offline:{offlineUnavailable:()=>Object.assign(Error('red desconectada'),{code:'NO_NETWORK'}),createOfflineStation(){return {status:()=>({pending:1}),sync:async a=>{assert.equal(a.credential,cookie.value);tick++;},handle:async(r,auth)=>{consumer=auth;try{return await auth.online(r);}catch(e){return Response.json({code:e.code==='NO_NETWORK'?'offline':'forbidden'},{status:503});}},close(){}};}}
  };
  const shell=createStationTransport(ctx);
  try{
    assert.equal(await (await proxy(new Request(origin+'/'))).text(),'shell packaged with desktop');
    assert.equal((await proxy(new Request('https://otra.test/'))).status,403);
    assert.equal((await proxy(new Request(origin+'/api/v1/bootstrap',{method:'POST'}))).status,404);
    assert.equal((await proxy(new Request(origin+'/api/v1/session',{headers:{origin:'https://otra.test'}}))).status,403);
    assert.equal((await proxy(new Request(origin+'/api/v1/session',{headers:{cookie:'must-not-forward',authorization:'must-not-forward'}}))).status,200);
    active=[];await assert.rejects(consumer.online(new Request(origin+'/api/v1/session')),/segura/);
    active=[cookie];await shell.poll();assert.equal(tick,1);
    tlsFailure=Error('net::ERR_CERT_AUTHORITY_INVALID');assert.equal((await(await proxy(new Request(origin+'/api/v1/session'))).json()).code,'forbidden');
    tlsFailure=Error('net::ERR_INTERNET_DISCONNECTED');assert.equal((await(await proxy(new Request(origin+'/api/v1/session'))).json()).code,'offline');
  }finally{await shell.close();fs.rmSync(dir,{recursive:true,force:true});}
});
