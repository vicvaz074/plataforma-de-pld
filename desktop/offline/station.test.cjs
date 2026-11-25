'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createOfflineStation,offlineUnavailable}=require('./station.cjs');
const root=path.resolve(__dirname,'../..');
const origin='https://corp.example.test', credential='opaque_Secret_Cookie_token',company={id:'comp-a',organizationId:'org-a',status:'active',rfc:'AAA010101AAA',name:'Empresa de prueba'};
const coll='kyc_expedientes_detalle',base='/api/v1/companies/comp-a',pre='/api/v1/desktop-offline/';
const normal=(id='operador')=>({user:{id,status:'active',requiresPasswordChange:false,platformRole:'user'},companies:[company],organizations:[{id:company.organizationId}],memberships:[{userId:id,organizationId:'org-a',role:'capture'}],grants:[{userId:id,companyId:company.id,permissions:{expedientes:['view','edit'],operaciones:['view','edit']}}],mfaRequired:false});
const item=(revision,nombre)=>({collection:coll,id:'exp-uno',expectedRevision:revision,payload:{id:'exp-uno',nombre}});
const req=(route,method='GET',body)=>new Request(origin+route,{method,headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
function fixture(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pld-estacion-')), contractsPath=path.join(dir,'contracts.cjs');
  require('esbuild').buildSync({entryPoints:[path.join(root,'lib/pilot/contracts.ts')],bundle:true,platform:'node',format:'cjs',outfile:contractsPath});
  const wrap=crypto.randomBytes(32);
  // Platform key store stand-in for Node tests only (never used in a distribution).
  const crypt={isEncryptionAvailable:()=>true,encryptString:s=>{const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',wrap,iv),enc=Buffer.concat([c.update(s),c.final()]);return Buffer.concat([iv,c.getAuthTag(),enc]);},decryptString:b=>{const c=crypto.createDecipheriv('aes-256-gcm',wrap,b.subarray(0,12));c.setAuthTag(b.subarray(12,28));return Buffer.concat([c.update(b.subarray(28)),c.final()]).toString();}};
  let clock=Date.now(), active=true, who=normal(), count=0,lose=false,denied=0,unexpected=false;
  const records=new Map();
  const options={directory:dir,origin,crypt,contractsPath,now:()=>clock};
  let station=createOfflineStation(options);
  async function online(r){
    if(!active)throw offlineUnavailable();if(unexpected)throw Error('TLS verification failed');
    const p=new URL(r.url).pathname;
    if(denied)return Response.json({error:'denegado'},{status:denied});
    if(p==='/api/v1/session')return Response.json(who);
    if(p===base+'/snapshot')return Response.json({company,records:[...records.values()]});
    if(p===base+'/records/batch'){
      count++;const {mutations}=await r.json(),rows=[];
      for(const m of mutations){
        const k=JSON.stringify([m.collection,m.id]);if((records.get(k)?.revision||0)!==m.expectedRevision)return Response.json({error:'conflicto'},{status:409});
        rows.push([k,{collection:m.collection,id:m.id,revision:m.expectedRevision+1,payload:m.payload,deleted:false}]);
      }
      for(const [k,row] of rows)records.set(k,row);
      if(lose){lose=false;active=false;throw offlineUnavailable();}
      return Response.json({records:rows.map(([,row])=>row)});
    }
    return Response.json({ok:true});
  }
  t.after(async()=>{await station.close();fs.rmSync(dir,{recursive:true,force:true});});
  const f={
    get opts(){return options;},get dir(){return dir;},get records(){return records;},get sends(){return count;},
    call:(p,m,b,c=credential)=>station.handle(req(p,m,b),{credential:c,online}),
    raw:(r,c=credential)=>station.handle(r,{credential:c,online}),
    sync:(c=credential)=>station.sync({credential:c,online}),stat:(c=credential)=>station.status(c),
    ss:async(c=credential)=>{assert.equal((await f.call('/api/v1/session','GET',undefined,c)).status,200);assert.equal((await f.call(base+'/snapshot','GET',undefined,c)).status,200);},
    setActive:v=>active=v,setWho:v=>who=v,failTLS:v=>unexpected=v,lose:()=>lose=true,deny:v=>denied=v,
    tick:(n)=>clock+=n,reopen:async()=>{await station.close();station=createOfflineStation(options);},
  };return f;
}
test('cifrado, reinicio, revisión provisional y dos cambios sucesivos que sincronizan en orden',async t=>{
  const f=fixture(t);await f.ss();f.setActive(false);
  const write=(r,s)=>f.call(base+'/records/batch','POST',{mutations:[item(r,s)]});
  const uno=await write(0,'Titular ficticio sensible');assert.equal(uno.status,202);assert.equal(uno.headers.get('x-pld-offline'),'pending');
  assert.equal((await write(0,'Titular ficticio sensible')).status,202);assert.equal(f.stat().pending,1);
  assert.equal((await write(1,'Segundo nombre')).status,202);assert.equal(f.stat().pending,2);
  await f.reopen();assert.equal(f.stat().pending,2);assert.equal((await (await f.call(base+'/snapshot')).json()).records[0].payload.nombre,'Segundo nombre');
  for(const rel of fs.readdirSync(f.dir,{recursive:true})){const p=path.join(f.dir,rel);if(fs.statSync(p).isFile()&&!p.endsWith('.cjs')){const data=fs.readFileSync(p);assert.ok(!data.includes(Buffer.from('Titular ficticio sensible')));assert.ok(!data.includes(Buffer.from(credential)));}}
  f.setActive(true);assert.equal((await f.sync()).status,200);assert.equal(f.stat().pending,0);assert.equal(f.sends,2);
  assert.equal([...f.records.values()][0].revision,2);assert.equal([...f.records.values()][0].payload.nombre,'Segundo nombre');
});
test('respuesta perdida ya aplicada se comprueba por identidad, payload y revisión; no se reenvía',async t=>{
  const f=fixture(t);await f.ss();f.lose();
  assert.equal((await f.call(base+'/records/batch','POST',{mutations:[item(0,'Prueba')]})).status,202);
  assert.equal(f.sends,1);await f.reopen();f.setActive(true);
  assert.equal((await f.sync()).status,200);assert.equal(f.sends,1);assert.equal(f.stat().pending,0);
});
test('el conflicto persiste y se puede revisar/descartar explícitamente; nunca se reenvía ni sobrescribe',async t=>{
  const f=fixture(t);await f.ss();f.setActive(false);
  const receipt=await (await f.call(base+'/records/batch','POST',{mutations:[item(0,'Local')]})).json();
  f.records.set(JSON.stringify([coll,'exp-uno']),{collection:coll,id:'exp-uno',revision:1,payload:{id:'exp-uno',nombre:'Servidor'},deleted:false});f.setActive(true);
  assert.equal((await f.sync()).status,409);assert.equal(f.sends,0);assert.equal(f.stat().conflicts,1);
  await f.reopen();assert.equal((await f.sync()).status,409);assert.equal(f.sends,0);
  const review=await (await f.call(pre+'review?batchId='+receipt.batchId)).json();assert.equal(review.mutations[0].payload.nombre,'Local');assert.equal(review.serverRecords[0].payload.nombre,'Servidor');
  assert.equal((await f.call(pre+'discard','POST',{batchId:receipt.batchId,companyId:company.id,confirm:false})).status,400);
  assert.equal((await f.call(pre+'discard','POST',{batchId:receipt.batchId,companyId:company.id,confirm:true})).status,200);assert.equal(f.stat().pending,0);
});
test('sin red no permite finalizar, borrar, aprobar, enviar archivos ni consultar otra empresa',async t=>{
  const f=fixture(t);await f.ss();f.setActive(false);
  for(const mutation of [{...item(0,'a'),deleted:true},{...item(0,'a'),collection:'pld-submissions-workflow'},{...item(0,'a'),collection:'actividades_vulnerables_operaciones',payload:{captureStatus:'complete'}},{...item(0,'a'),payload:{file:'data:text/plain;base64,QQ=='}}])
    assert.equal((await f.call(base+'/records/batch','POST',{mutations:[mutation]})).status,503);
  assert.equal((await f.call(base+'/records/batch','POST',{mutations:[{...item(0,'a'),collection:'actividades_vulnerables_operaciones',payload:{id:'exp-uno',captureStatus:'draft',montoCentavos:100}}]})).status,202);
  assert.equal((await f.call(base+'/files','POST',{})).status,503);
  assert.equal((await f.call(base+'/authorize','POST',{action:'download',moduleKey:'expedientes'})).status,503);
  assert.equal((await f.call('/api/v1/companies/otra/snapshot')).status,403);
  assert.equal((await f.raw(new Request('https://otra.test'+base+'/snapshot'))).status,403);
  assert.equal((await f.call(base+'/snapshot','GET',undefined,'otra-cookie')).status,401);assert.equal(f.stat('otra-cookie').pending,0);
});
test('401/403, cambio de titular, MFA y vencimiento no permiten reutilizar el caché',async t=>{
  const f=fixture(t);await f.ss();f.setActive(false);await f.call(base+'/records/batch','POST',{mutations:[item(0,'privado')]});
  f.setActive(true);f.deny(403);assert.equal((await f.call(base+'/snapshot')).status,403);f.setActive(false);assert.notEqual((await f.call(base+'/snapshot')).status,200);
  f.setActive(true);f.deny(0);f.setWho(normal('otra-persona'));await f.ss('cookie-2');f.setActive(false);
  assert.deepEqual((await (await f.call(base+'/snapshot','GET',undefined,'cookie-2')).json()).records,[]);assert.equal(f.stat('cookie-2').pending,0);
  f.setActive(true);f.deny(401);assert.equal((await f.call('/api/v1/session','GET',undefined,'cookie-2')).status,401);f.setActive(false);
  assert.equal((await f.call(base+'/snapshot','GET',undefined,'cookie-2')).status,401);
  f.setActive(true);f.deny(0);f.setWho({...normal(),mfaRequired:true});await f.call('/api/v1/session');f.setActive(false);assert.equal((await f.call(base+'/snapshot')).status,401);
  f.setActive(true);f.setWho(normal());await f.call('/api/v1/session');assert.equal(f.stat().pending,1);
  f.tick(8*3600*1000+1);f.setActive(false);assert.equal((await f.call(base+'/snapshot')).status,401);
});
test('rechaza TLS inválido; el retiro del permiso de edición no envía los cambios encolados',async t=>{
  const f=fixture(t);await f.ss();f.failTLS(true);assert.equal((await f.call(base+'/snapshot')).status,503);f.failTLS(false);
  f.setActive(false);await f.call(base+'/records/batch','POST',{mutations:[item(0,'draft')]});
  const v=normal();v.grants[0].permissions.expedientes=['view'];f.setWho(v);f.setActive(true);assert.equal((await f.sync()).status,403);assert.equal(f.sends,0);
  f.setActive(false);assert.equal((await f.call(base+'/records/batch','POST',{mutations:[item(0,'nuevo')]})).status,403);
  assert.deepEqual((await (await f.call(base+'/snapshot')).json()).records,[]);
});
test('reintento sólo central no acepta caché ni crea un envío, y salir sin red bloquea al titular',async t=>{
  const f=fixture(t);await f.ss();f.setActive(false);
  const write=req(base+'/records/batch','POST',{mutations:[item(0,'Debe quedar en recuperación')]});
  write.headers.set('x-pld-require-online','1');
  assert.equal((await f.raw(write)).status,503);assert.equal(f.stat().pending,0);
  const read=req(base+'/snapshot');read.headers.set('x-pld-require-online','1');
  assert.equal((await f.raw(read)).status,503);
  const signout=await f.call('/api/auth/sign-out','POST',{});assert.equal(signout.status,200);assert.equal((await signout.json()).serverRevocationConfirmed,false);assert.equal(f.stat().authorized,false);
});
test('sólo borradores EBR y capacitación abierta, plantillas auxiliares sin archivos: positivos y negativos',async t=>{
  const f=fixture(t),session=normal();for(const m of ['ebr','capacitacion','registro','evidencias'])session.grants[0].permissions[m]=['view','edit'];
  f.setWho(session);await f.ss();f.setActive(false);
  const post=(c,id,p,rev=0)=>f.call(base+'/records/batch','POST',{mutations:[{collection:c,id,payload:p,expectedRevision:rev}]});
  for(const collection of ['ebr_evaluaciones','ebr-institutional-assessment']){
    const draft={schemaVersion:3,workflow:{status:'draft'},controls:[],institutionalFactors:[]};
    assert.equal((await post(collection,'ebr-1',{...draft,workflow:{status:'approved'}})).status,503);
    assert.equal((await post(collection,'ebr-1',{...draft,workflow:{status:'review'}})).status,503);
    assert.equal((await post(collection,'ebr-1',draft)).status,202);
    assert.equal((await post(collection,'ebr-1',{...draft,workflow:{status:'draft',approvedBy:'otro'}},1)).status,503);
  }
  const training={moduleClosed:false,employees:[{id:'employee'}],documents:[],sessions:[],traceability:[],trainingPlan:null};
  assert.equal((await post('pld-training-module','singleton',{...training,moduleClosed:true})).status,503);
  assert.equal((await post('pld-training-module','singleton',{...training,trainingPlan:{approvedBy:'tercero'}})).status,503);
  assert.equal((await post('pld-training-module','singleton',training)).status,202);
  assert.equal((await post('pld-training-module','singleton',{...training,documents:[{id:'archivo'}]},1)).status,503);
  assert.equal((await post('pld-training-module','singleton',{...training,employees:[]},1)).status,503);
  const mapping=[{id:'mapping1',signature:'Cliente|Monto',name:'ejemplo.csv',mapping:{name:'Cliente',amount:'Monto'}}];
  for(const c of ['pld-import-mappings','pld-import-mappings-expedientes','pld-import-mappings-registro','pld-import-mappings-evidencias']){
    assert.equal((await post(c,'singleton',[{...mapping[0],mapping:{amount:{formula:'desconocida'}}}])).status,503);
    assert.equal((await post(c,'singleton',mapping)).status,202);
    assert.equal((await post(c,'singleton',[],1)).status,503);
  }
  assert.equal((await post(coll,'review',{reviewStatus:'approved'})).status,503);
  f.setActive(true);assert.equal((await f.sync()).status,200);assert.equal(f.stat().pending,0);
});
