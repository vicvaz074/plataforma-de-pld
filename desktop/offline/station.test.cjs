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
test('sincroniza contra el Worker real: cliente, EUI, operación con 10 millones, empresa aislada y ningún aviso inventado',async t=>{
  const f=fixture(t),dir=f.dir,workerPath=path.join(dir,'worker.cjs'),assetsPath=path.join(dir,'assets');
  fs.mkdirSync(assetsPath);fs.writeFileSync(path.join(assetsPath,'index.html'),'<html>Prueba interna</html>');
  require('esbuild').buildSync({entryPoints:[path.join(root,'workers/index.ts')],bundle:true,platform:'node',format:'cjs',target:'node22',outfile:workerPath});
  const server=await require('../runtime/index.cjs').startServer({databasePath:path.join(dir,'central.sqlite'),storagePath:path.join(dir,'adjuntos'),assetsPath,migrationsPath:path.join(root,'migrations'),workerPath,secret:crypto.randomBytes(42).toString('hex')});
  let station,reachable=true,cookie='',loseUploadAck=false;
  try{
    const admin={name:'Prueba local',email:'qa@example.test',password:crypto.randomBytes(24).toString('hex')};
    await server.bootstrap(admin);
    const net=(p,method='GET',payload,extra={})=>fetch(server.origin+p,{method,headers:{origin:server.origin,...(cookie?{cookie}:{}),...(payload&&!(payload instanceof FormData)?{'content-type':'application/json'}:{}),...extra},body:payload instanceof FormData?payload:payload?JSON.stringify(payload):undefined});
    const login=await net('/api/auth/sign-in/email','POST',{email:admin.email,password:admin.password});assert.equal(login.status,200);
    cookie=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');assert.ok(cookie);
    const org=await (await net('/api/v1/organizations','POST',{name:'Organización de prueba'})).json();
    const addCo=async name=>(await (await net('/api/v1/companies','POST',{name,organizationId:org.id,rfc:name==='A'?'AAA010101AAA':'BBB010101BBB'})).json()).id;
    const a=await addCo('A'),b=await addCo('B'),to=id=>'/api/v1/companies/'+id;
    const settings={...f.opts,directory:path.join(dir,'otro-equipo')};
    station=createOfflineStation(settings);
    const ctx={credential:crypto.randomBytes(32).toString('hex'),online:async r=>{
      if(!reachable)throw offlineUnavailable();
      const multipart=r.headers.get('content-type')?.startsWith('multipart/form-data'),uploadKey=r.headers.get('x-pld-upload-key');
      const result=await net(new URL(r.url).pathname,r.method,r.body?(multipart?await r.formData():await r.json()):undefined,uploadKey?{'x-pld-upload-key':uploadKey}:{});
      if(loseUploadAck&&uploadKey&&result.ok){loseUploadAck=false;reachable=false;throw offlineUnavailable();}
      // Emulate the HTTPS corporate reverse proxy in this loopback-only test.
      return new Response(result.body,{status:result.status,headers:result.headers});
    }};
    const call=(route,method,body)=>station.handle(req(route,method,body),ctx);
    assert.equal((await call('/api/v1/session')).status,200);
    for(const id of [a,b])assert.equal((await call(to(id)+'/snapshot')).status,200);
    reachable=false;
    const client={id:'cliente-c',nombre:'Ejemplo ficticio',identifiers:{rfc:'QAAX010101123'}};
    const eui={id:'expediente-e',expedienteId:'expediente-e',nombre:'Ejemplo ficticio',identifiers:client.identifiers,companyId:a};
    const op={id:'operacion-o',clienteId:client.id,expedienteId:eui.id,cliente:client.nombre,fechaOperacion:'2026-11-24',tipoCliente:'pm_mexicana',actividadKey:'fraccion-xv-uso-goce',monto:10000000,montoCentavos:1000000000,captureStatus:'draft',moneda:'MXN',companyId:a};
    const mutations=[['actividades_vulnerables_clientes',client],['kyc_expedientes_detalle',eui],['actividades_vulnerables_operaciones',op]];
    for(const [collection,payload] of mutations)assert.equal((await call(to(a)+'/records/batch','POST',{mutations:[{collection,id:payload.id,payload,expectedRevision:0}]})).status,202);
    const inst={workflow:{status:'draft'},controls:[],institutionalFactors:[],sources:[],methodologyAccepted:false,reviewPlan:{nextReviewAt:'',owner:'',actions:[]}};
    const training={moduleClosed:false,employees:[],documents:[],sessions:[],traceability:[],trainingPlan:null,checklistAnswers:{a1:{answer:'pendiente',notes:'Revisar el plan'}}};
    const mappings=[{id:'mapeo1',signature:'Cliente|Importe',mapping:{name:'Cliente',amount:'Importe'}}];
    for(const [collection,payload] of [['ebr-institutional-assessment',inst],['pld-training-module',training],['pld-import-mappings',mappings]])assert.equal((await call(to(a)+'/records/batch','POST',{mutations:[{collection,id:'singleton',payload,expectedRevision:0}]})).status,202);
    await station.close();station=createOfflineStation(settings);assert.equal(station.status(ctx.credential).pending,6);
    reachable=true;const synced=await station.sync(ctx);assert.equal(synced.status,200,JSON.stringify(await synced.json()));
    assert.equal(station.status(ctx.credential).pending,0);
    const rows=(await (await net(to(a)+'/snapshot')).json()).records;
    const actual=rows.find(r=>r.collection==='actividades_vulnerables_operaciones').payload;
    assert.equal(actual.captureStatus,'draft');assert.equal(actual.montoCentavos,1000000000);assert.equal(actual.sujetoObligado.id,a);assert.equal(actual.expedienteId,eui.id);
    assert.ok(rows.some(r=>r.collection==='ebr-institutional-assessment'&&r.payload.workflow.status==='draft'));
    assert.ok(rows.some(r=>r.collection==='pld-training-module'&&r.payload.moduleClosed===false));
    assert.ok(!rows.some(r=>r.collection==='pld-sat-output-packages'&&!r.deleted));
    assert.equal((await (await net(to(b)+'/snapshot')).json()).records.length,0);
    const txt=Buffer.from('Contenido ficticio de adjunto'),data='data:text/plain;base64,'+txt.toString('base64');
    const document={id:'exp-con-archivo',expedienteId:'exp-con-archivo',companyId:a,nombre:'Ejemplo',adjunto:{fileName:'ejemplo.txt',dataUrl:data}};
    function work(n,nombre){return {kind:'records',mutations:[{id:document.id,collection:coll,expectedRevision:n,payload:{...document,nombre}}]};}
    const recovery=pre+'recovery?companyId='+a,commit=pre+'commit?companyId='+a+'&id=';
    async function protect(body){const x=await call(recovery,'POST',body);assert.equal(x.status,201);return (await x.json()).id;}
    // Copy alone does not opt into auto-replay. An unrelated file isn't a journal.
    const standalone=await protect({kind:'file',name:'ejemplo.txt',collection:coll,data});
    const noReplay=await call(commit+standalone,'POST');assert.equal(noReplay.status,422);assert.equal((await noReplay.json()).code,'MANUAL_REPLAY_REQUIRED');
    const first=await protect(work(0,'primera'));
    loseUploadAck=true;const waiting=await call(commit+first,'POST');assert.equal(waiting.status,202);
    assert.equal((await (await net(to(a)+'/files')).json()).files.length,1); // Uploaded, not yet linked/approved.
    assert.equal((await (await net(to(a)+'/snapshot')).json()).records.some(r=>r.id===document.id),false);
    const local=(await (await call(to(a)+'/snapshot')).json()).records.find(r=>r.id===document.id);
    assert.equal(local.payload.adjunto.dataUrl,data);
    const list=(await (await call(recovery)).json()).items;assert.ok(!list.some(i=>i.id===first));assert.ok(list.some(i=>i.id===standalone));
    const second=await protect(work(1,'segunda'));assert.equal((await call(commit+second,'POST')).status,202);
    await station.close();station=createOfflineStation(settings);reachable=true;
    const sync2=await station.sync(ctx);assert.equal(sync2.status,200,JSON.stringify(await sync2.json()));
    const final=(await (await net(to(a)+'/snapshot')).json()).records.find(r=>r.id===document.id),versions=(await (await net(to(a)+'/files')).json()).files;
    assert.equal(final.revision,2);assert.equal(final.payload.nombre,'segunda');assert.equal(versions.length,1);
    assert.equal(versions[0].status,'pending');assert.equal(versions[0].sha256,crypto.createHash('sha256').update(txt).digest('hex'));assert.equal(final.payload.adjunto.dataUrl,versions[0].downloadUrl);
    assert.deepEqual(Buffer.from(await (await net(versions[0].downloadUrl)).arrayBuffer()),txt);
    assert.equal((await call(recovery+'&id='+first)).status,404);
    // Connected foreground gets a central, canonical acknowledgment, no offline header.
    const third=await protect(work(2,'tercera'));const ack=await call(commit+third,'POST');assert.equal(ack.status,200);assert.equal(ack.headers.get('x-pld-offline'),null);assert.equal((await ack.json()).records[0].payload.nombre,'tercera');
  }finally{await station?.close();await server.close();}
});
test('Alta sin acuse ni sujeto nuevo, plan abierto de auditoría y notas de gobernanza sin declarar cumplimiento',async t=>{
  const f=fixture(t),sess=normal();for(const m of ['registro','auditoria','gobernanza'])sess.grants[0].permissions[m]=['view','edit'];f.setWho(sess);
  const reg='registro-sat-data',aud='auditoria-planes-accion',gov='gobernanza-control-data';
  const questionnaire={expedienteCerrado:false,questions:[{id:'q1',answer:'no',notes:'',actionPlan:'',required:true}],documents:[],trace:[],manualVersions:[],committeeSessions:[],alerts:[]};
  f.records.set(JSON.stringify([gov,'singleton']),{id:'singleton',collection:gov,revision:1,payload:questionnaire});
  await f.ss();f.setActive(false);
  const send=(c,id,p,rev=0)=>f.call(base+'/records/batch','POST',{mutations:[{id,collection:c,payload:p,expectedRevision:rev}]});
  const alta={schemaVersion:2,identificacion:{rfc:company.rfc},contactos:[{correo:'qa@example.test'}],actividades:[],datosChecklist:{q:{notes:'pendiente',completed:false}},documentos:[],sujetosRegistrados:[],documentosRegistro:{detalle:null,acuse:null,aceptacion:null}};
  assert.equal((await send(reg,'singleton',{...alta,sujetosRegistrados:[{id:'otra'}]})).status,503);
  assert.equal((await send(reg,'singleton',{...alta,documentosRegistro:{acuse:{id:'simulado'}}})).status,503);
  assert.equal((await send(reg,'singleton',{...alta,identificacion:{rfc:'OTRA010101AA0'}})).status,403);
  assert.equal((await send(reg,'singleton',alta)).status,202);
  const plan={id:'plan1',source:'Revisión interna',action:'Documentar políticas',responsible:'Captura',deadline:'2026-12-01',status:'Pendiente',progress:0};
  assert.equal((await send(aud,plan.id,{...plan,status:'Cerrado'})).status,503);assert.equal((await send(aud,plan.id,{...plan,progress:100})).status,503);
  assert.equal((await send(aud,plan.id,plan)).status,202);
  const notes={...questionnaire,questions:[{...questionnaire.questions[0],notes:'Definir tarea',actionPlan:'Capacitar al equipo'}]};
  assert.equal((await send(gov,'singleton',{...notes,expedienteCerrado:true},1)).status,503);
  assert.equal((await send(gov,'singleton',{...notes,questions:[{...notes.questions[0],answer:'si'}]},1)).status,503);
  assert.equal((await send(gov,'singleton',notes,1)).status,202);f.setActive(true);assert.equal((await f.sync()).status,200);
});
test('un archivo guardado para recuperación no se sube sin opt-in, snapshot propio, permiso de carga y soporte de recibos',async t=>{
  const f=fixture(t),sess=normal(),protect=pre+'recovery?companyId='+company.id,commit=pre+'commit?companyId='+company.id+'&id=';
  const body={kind:'records',mutations:[{...item(0,'ejemplo'),payload:{id:'exp-uno',archivo:{name:'nota.txt',dataUrl:'data:text/plain;base64,QUJD'}}}]};
  await f.ss();assert.equal((await f.call(protect,'POST',body)).status,403);
  sess.grants[0].permissions.expedientes.push('upload','download');f.setWho(sess);await f.ss();
  const receipt=await (await f.call(protect,'POST',body)).json();assert.ok(receipt.id);
  await f.sync();assert.equal(f.sends,0);assert.equal(f.stat().pending,0);
  // Test server lacks explicit idempotent-file capability; it gets no upload or record.
  assert.equal((await f.call(commit+receipt.id,'POST')).status,409);assert.equal(f.sends,0);assert.equal(f.stat().conflicts,1);
  const [issue]=f.stat().issues;assert.equal(issue.code,'OFFLINE_UPLOAD_RECEIPTS_UNSUPPORTED');
  const details=await (await f.call(pre+'review?batchId='+issue.id)).json();assert.equal(details.uploads[0].confirmed,false);
  f.setActive(false);assert.equal((await f.call(pre+'review?batchId='+issue.id,'GET',undefined,'cookie-ajena')).status,401);
});
