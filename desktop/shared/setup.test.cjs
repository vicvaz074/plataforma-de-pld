'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {makeService,account,corporateOrigin,serverSettings,getSecret,probeOrigin}=require('./setup.cjs');
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'pld-setup-test-'));
function cipher(){
  const k=crypto.randomBytes(32);
  return {isEncryptionAvailable:()=>true,encryptString:v=>{
    const iv=crypto.randomBytes(12),enc=crypto.createCipheriv('aes-256-gcm',k,iv);const data=Buffer.concat([enc.update(v,'utf8'),enc.final()]);return Buffer.concat([iv,enc.getAuthTag(),data]);
  },decryptString:b=>{const dec=crypto.createDecipheriv('aes-256-gcm',k,b.subarray(0,12));dec.setAuthTag(b.subarray(12,28));return Buffer.concat([dec.update(b.subarray(28)),dec.final()]).toString();}};
}
const admin={mode:'server',name:'TI de prueba',email:'ADMIN@example.test',password:' inicial-prueba ',confirmation:' inicial-prueba '};
test('account treats passwords as opaque; validates confirmation, identity and length',()=>{
  assert.deepEqual(account(admin),{name:admin.name,email:'admin@example.test',password:admin.password});
  for(const payload of [{name:'  '},{email:'no'},{password:'123',confirmation:'123'},{confirmation:admin.password.trim()}])assert.throws(()=>account({...admin,...payload}));
});
test('corporate origin uses HTTPS only and port is bounded',()=>{
  assert.equal(corporateOrigin(' https://pld.Example.test:8443/ '),'https://pld.example.test:8443');
  for(const u of ['file:///a','http://pld.test','javascript:1','https://u:p@pld.test/','https://pld.test/login','https://pld.test/?credencial=x','https://pld.test/#/login'])assert.throws(()=>corporateOrigin(u));
  for(const port of [0,-1,443,65536,'7.5','9000x'])assert.throws(()=>serverSettings({port}));
  assert.deepEqual(serverSettings({port:'12345',publicOrigin:''}),{port:12345});
});
test('a station validates the on-prem service without credentials or redirects',async()=>{
  const check=async data=>probeOrigin('https://pld.example.test',async(url,init)=>{assert.equal(url,'https://pld.example.test/api/v1/health');assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');return Response.json(data);});
  await check({configured:true,distribution:'pld-onprem'});
  await assert.rejects(check({configured:true,mode:'cloud'}));await assert.rejects(check({configured:false,distribution:'pld-onprem'}));
});
test('missing or wrong key cannot silently regenerate secrets for existing data',()=>{
  const dir=temp(),db=path.join(dir,'data.sqlite'),crypt=cipher();
  try{assert.throws(()=>getSecret(db,'existing',crypt));const one=getSecret(db,'new',crypt);
    assert.equal(getSecret(db,'existing',crypt),one);assert.ok(!fs.readFileSync(path.join(db+'.pld','host-key.json'),'utf8').includes(one));assert.throws(()=>getSecret(db,'existing',cipher()));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('station failure leaves previous config intact and never initializes a database',async()=>{
  const dir=temp();try{
    const opts={userData:dir,resources:{},runtime:{},crypt:cipher(),probe:async origin=>{if(origin!=='https://pld.example.test')throw Error('unavailable');}};
    const s=makeService(opts);assert.equal(await s.resume(),null);
    await s.submit({mode:'client',origin:'https://pld.example.test'});await s.stop();
    const old=fs.readFileSync(path.join(dir,'installation.json'),'utf8');
    await assert.rejects(s.submit({mode:'client',origin:'https://other.example.test'}));assert.equal(fs.readFileSync(path.join(dir,'installation.json'),'utf8'),old);
    assert.equal(fs.existsSync(s.defaultDb),false);assert.equal((await makeService(opts).resume()).origin,'https://pld.example.test');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('no password written to config, interrupted bootstrap can be resumed, no second superadmin',async()=>{
  const dir=temp();try{
    let saved=false,opened=false,bootstrapCount=0,lastBootstrap=null,firstFails=true,closes=0;
    const opts={userData:dir,resources:{migrationsPath:'/fixtures'},crypt:cipher(),runtime:{
      inspectDatabase:()=>({kind:opened?'existing':'new',hasUsers:saved}),
      startServer:async o=>{opened=true;fs.writeFileSync(o.databasePath,'test');return {hasUsers:saved,origin:'http://127.0.0.1:6731',async bootstrap(a){if(firstFails){firstFails=false;throw Error('interrupted');}saved=true;bootstrapCount++;lastBootstrap=a;},async close(){closes++;}};}
    }};const s=makeService(opts);
    await assert.rejects(s.submit({...admin,confirmation:'bad'}));assert.equal(opened,false);
    await assert.rejects(s.submit(admin));assert.equal(s.config(),null);assert.equal(closes,1);
    await s.submit(admin);assert.equal(lastBootstrap.email,'admin@example.test');assert.equal(bootstrapCount,1);
    const config=fs.readFileSync(path.join(dir,'installation.json'),'utf8');assert.ok(!config.includes(admin.password));assert.ok(!config.includes('example.test'));assert.ok(!config.includes('secret'));
    await s.stop();const again=makeService(opts);await again.resume();assert.equal(bootstrapCount,1);await again.stop();
    await assert.rejects(again.submit(admin));fs.unlinkSync(again.defaultDb);
    await assert.rejects(again.resume(),/No se encuentra la base/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
