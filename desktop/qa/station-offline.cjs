'use strict';
// Run after prepare:resources with: pnpm --dir desktop exec electron qa/station-offline.cjs
// Only a disposable installation on 127.0.0.1 is contacted. Uses Chromium
// networking, Better Auth, the PLD Worker, SQLite, and the OS keychain.
const {app,session,BrowserWindow,safeStorage}=require('electron');
const {randomBytes,randomUUID,X509Certificate}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const http=require('node:http'),https=require('node:https'),assert=require('node:assert/strict');
const {startServer}=require('../runtime/index.cjs');
const {createStationTransport}=require('../shared/station-shell.cjs');
const offline=require('../offline/station.cjs');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'davara-pld-fixture-'));
const resources=path.resolve(__dirname,'../build/pld');
const services=process.env.PLD_QA_SERVICE_FIXTURES?path.resolve(process.env.PLD_QA_SERVICE_FIXTURES):resources;
app.setPath('userData',path.join(temp,'profile'));
app.on('window-all-closed',()=>{}); // Reload the station without stopping the test server.
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const expect=async(result,status,label)=>{
  const r=await result;assert.equal(r.status,status, label+' ('+(r.data?.code||r.data?.error||r.status)+')');return r;
};
async function main(){
  const keyfile=path.join(temp,'tls.key'),certfile=path.join(temp,'tls.crt');
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=127.0.0.1','-keyout',keyfile,'-out',certfile],{stdio:'ignore'});
  const cert=fs.readFileSync(certfile),fp=new X509Certificate(cert).fingerprint256;
  const assetsPath=path.join(resources,'out'),vaultDir=path.join(temp,'station');
  let central,win,shell,pinnedPort=0,dropNextUploadReply=false;
  const actualUploadKeys=[];
  const proxy=https.createServer({key:fs.readFileSync(keyfile),cert},(req,res)=>{
    if(!central){res.writeHead(503);res.end();return;}
    const r=http.request(new URL(req.url,central.listenOrigin),{method:req.method,headers:req.headers},reply=>{
      if(req.method==='POST'&&req.url.endsWith('/files')&&[200,201].includes(reply.statusCode)){
        actualUploadKeys.push(req.headers['x-pld-upload-key']);
        if(dropNextUploadReply){dropNextUploadReply=false;reply.resume();res.destroy();return;}
      }
      res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);
    });
    r.on('error',()=>{res.destroy();});req.pipe(r);
  });
  const connect=()=>new Promise((ok,fail)=>{proxy.once('error',fail);proxy.listen(pinnedPort,'127.0.0.1',()=>{proxy.removeListener('error',fail);pinnedPort=proxy.address().port;ok();});});
  const cut=async()=>{if(!proxy.listening)return;const closing=new Promise(ok=>proxy.close(ok));proxy.closeAllConnections();await closing;};
  await connect();
  const origin='https://127.0.0.1:'+pinnedPort;
  const password=()=>randomBytes(24).toString('hex');
  const adminEmail='responsable@example.test',adminPassword=password(),email='captura@example.test',newPassword=password();
  // This session trusts ONLY its transient local fixture certificate. The
  // product does not provide a way to alter TLS verification.
  const s=session.fromPartition('persist:qa-fixture-only',{cache:false});
  s.setCertificateVerifyProc((req,cb)=>{try{if(req.hostname==='127.0.0.1'&&new X509Certificate(req.certificate.data).fingerprint256===fp){cb(0);return;}}catch{}cb(-3);});
  const statusPath='/api/v1/desktop-offline/status';
  const signIn='/api/auth/sign-in/email';
  let adminCookie='';
  function adminApi(route,method='GET',body){
    return new Promise((ok,fail)=>{
      const r=http.request(new URL(route,central.listenOrigin),{method,headers:{host:new URL(origin).host,origin,...(body?{'content-type':'application/json'}:{}),...(adminCookie?{cookie:adminCookie}:{})}},res=>{
        const chunks=[];res.on('data',v=>chunks.push(v));res.on('end',()=>{if(route===signIn)adminCookie=(res.headers['set-cookie']||[]).map(c=>c.split(';')[0]).join('; ');try{ok({status:res.statusCode,data:JSON.parse(Buffer.concat(chunks).toString())});}catch(e){fail(e);}});
      });r.once('error',fail);r.end(body?JSON.stringify(body):undefined);
    });
  }
  async function openStation(){
    shell=createStationTransport({session:s,origin,assetsPath,directory:vaultDir,crypt:safeStorage,contracts:require(path.join(services,'contracts.cjs')),offline,intervalMs:150});
    win=new BrowserWindow({show:false,webPreferences:{session:s,contextIsolation:true,sandbox:true,nodeIntegration:false}});
    win.webContents.setUserAgent(win.webContents.getUserAgent()+' DavaraPLDStation/1');
    // Fixed static same-origin document avoids UI-driven refetch during the
    // permission checks. Also load the actual expediente and assets below.
    await win.loadURL(origin+'/login.txt');
  }
  async function closeStation(){if(win){win.destroy();win=null;}if(shell){await shell.close();shell=null;}}
  async function api(route,method='GET',body){
    const opts={method,credentials:'include',cache:'no-store',...(body?{headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})};
    const code='fetch('+JSON.stringify(route)+','+JSON.stringify(opts)+').then(async r=>({status:r.status,marker:r.headers.get("x-pld-offline"),data:await r.json()}))';
    return win.webContents.executeJavaScript(code);
  }
  try{
    central=await startServer({databasePath:path.join(temp,'office.sqlite'),storagePath:path.join(temp,'files'),assetsPath,migrationsPath:path.join(services,'migrations'),workerPath:path.join(services,'worker.cjs'),publicOrigin:origin,bootstrapEmail:adminEmail,secret:password()});
    await central.bootstrap({name:'Responsable ficticio',email:adminEmail,password:adminPassword});
    await expect(adminApi(signIn,'POST',{email:adminEmail,password:adminPassword}),200,'Inicio de administración de la instalación efímera');
    const org=(await expect(adminApi('/api/v1/organizations','POST',{name:'Organización ficticia'}),201,'Crear organización')).data;
    const makeCo=(name,rfc)=>adminApi('/api/v1/companies','POST',{organizationId:org.id,name,rfc});
    const co=(await expect(makeCo('Empresa ficticia asignada','AAA010101AAA'),201,'Crear empresa asignada')).data;
    const other=(await expect(makeCo('Empresa ficticia no asignada','BBB010101BBB'),201,'Crear segunda empresa')).data;
    const user=(await expect(adminApi('/api/v1/users','POST',{email,name:'Capturista ficticia',organizationId:org.id,companyIds:[co.id],role:'capture'}),201,'Crear cuenta operativa')).data;
    await expect(adminApi('/api/v1/grants','PUT',{organizationId:org.id,companyId:co.id,userId:user.user.id,role:'capture',permissions:{expedientes:['view','edit','upload','download'],operaciones:['view']}}),200,'Acotar permisos de la capturista');
    await openStation();
    await expect(api(signIn,'POST',{email,password:user.temporaryPassword}),200,'Sesión inicial');
    await expect(api('/api/auth/change-password','POST',{currentPassword:user.temporaryPassword,newPassword,revokeOtherSessions:true}),200,'Cambio obligatorio');
    await expect(api(signIn,'POST',{email,password:newPassword}),200,'Sesión final con permisos de captura');
    const {MODULE_LABELS,ALL_ACTIONS}=require(path.join(services,'contracts.cjs'));
    assert.equal(Object.keys(MODULE_LABELS).length,11,'Si se agrega otro módulo se debe actualizar la matriz y su documentación');
    const allow={expedientes:new Set(['view','edit','upload','download']),operaciones:new Set(['view'])};
    const authorize='/api/v1/companies/'+co.id+'/authorize';
    for(const moduleKey of Object.keys(MODULE_LABELS))for(const action of ALL_ACTIONS){
      const input={moduleKey,action};
      const owner=await expect(adminApi(authorize,'POST',input),200,'Superadministrador: '+moduleKey+'/'+action);
      assert.equal(owner.data.authorized,true);assert.equal(owner.data.companyId,co.id);
      await expect(api(authorize,'POST',input),allow[moduleKey]?.has(action)?200:403,'Capturista: '+moduleKey+'/'+action);
    }
    await expect(api('/api/v1/companies/'+other.id+'/authorize','POST',{moduleKey:'expedientes',action:'view'}),404,'La empresa no asignada no devuelve permisos');
    console.log('OK: API corporativa, 11 módulos × 6 acciones × 2 roles; el superadministrador administra todos y la capturista sólo recibe los permisos expresos.');
    const who=await expect(api('/api/v1/session'),200,'Obtener sesión corporativa');
    assert.equal(who.data.user.id,user.user.id);assert.deepEqual(who.data.companies.map(c=>c.id),[co.id]);
    const base='/api/v1/companies/'+co.id, batch=base+'/records/batch';
    await expect(api(base+'/snapshot'),200,'Sincronizar razón social autorizada');
    assert.equal((await api(statusPath)).data.authorized,true);
    await cut();
    const cached=await expect(api('/api/v1/session'),200,'Reutilizar sesión tras desconectar la red');
    assert.equal(cached.marker,'cached');assert.equal(cached.data.user.id,user.user.id);
    assert.equal((await api(base+'/snapshot')).marker,'cached');
    await expect(api('/api/v1/companies/'+other.id+'/snapshot'),403,'Denegar empresa no asignada sin red');
    const id='exp-'+randomUUID(),fixture='Cliente sintético de continuidad '+randomUUID();
    const mutation={collection:'kyc_expedientes_detalle',id,expectedRevision:0,payload:{id,nombre:fixture}};
    const denied={collection:'actividades_vulnerables_operaciones',id:'op-'+randomUUID(),expectedRevision:0,payload:{captureStatus:'draft'}};
    await expect(api(batch,'POST',{mutations:[denied]}),403,'Denegar cambio en módulo de sólo lectura');
    await expect(api('/api/v1/organizations','POST',{name:'No crear'}),503,'La estación no realiza administración sin red');
    await expect(api(base+'/files'),503,'La estación no descarga evidencia sin red');
    const staged=await expect(api(batch,'POST',{mutations:[mutation]}),202,'Guardar expediente pendiente');
    assert.equal(staged.marker,'pending');assert.equal((await api(statusPath)).data.pending,1);
    // Direct corporate read is independent of the disconnected station.
    assert.equal((await adminApi(base+'/snapshot')).data.records.some(r=>r.id===id),false);
    console.log('OK: sesión, ámbito de empresa y módulo, expediente pendiente y acciones administrativas bloqueadas sin red.');
    await closeStation();await openStation();
    const reloaded=await expect(api(base+'/snapshot'),200,'Reabrir la estación sin red');
    assert.ok(reloaded.data.records.some(r=>r.id===id&&r.payload.nombre===fixture));
    assert.equal((await api(statusPath)).data.pending,1);
    const page=await win.webContents.executeJavaScript('fetch("/kyc-expediente").then(async r=>[r.status,(await r.text()).includes("/_next/")])');
    assert.deepEqual(page,[200,true]);
    await win.loadURL(origin+'/kyc-expediente');
    const visible=()=>win.webContents.executeJavaScript('Array.from(document.querySelectorAll("button")).some(b => b.innerText.trim()==="Nuevo expediente")');
    const paintBy=Date.now()+15000;let painted=false;
    while(!painted&&Date.now()<paintBy){painted=await visible();if(!painted)await pause(100);}
    assert.ok(painted,'El módulo de expediente debe cargar e hidratar con los permisos y la copia sin red.');
    await win.loadURL(origin+'/login.txt');
    const vaults=fs.readdirSync(vaultDir,{recursive:true}).filter(n=>n.endsWith('station.db'));
    assert.equal(vaults.length,1);assert.equal(fs.readFileSync(path.join(vaultDir,vaults[0])).includes(Buffer.from(fixture)),false);
    await connect();
    const until=Date.now()+18000;
    while((await api(statusPath)).data.pending && Date.now()<until)await pause(175);
    assert.equal((await api(statusPath)).data.pending,0,'Sincronización automática sin invocar POST sync');
    const saved=(await expect(adminApi(base+'/snapshot'),200,'Confirmación independiente en la oficina')).data.records.filter(r=>r.id===id);
    assert.equal(saved.length,1);assert.equal(saved[0].revision,1);assert.equal(saved[0].payload.nombre,fixture);
    assert.equal((await adminApi('/api/v1/companies/'+other.id+'/snapshot')).data.records.some(r=>r.id===id),false);
    console.log('OK: reapertura offline, expediente cifrado, pantalla empaquetada y sincronización automática sin duplicados a SQLite central.');
    await cut();
    const revise=nombre=>({mutations:[{...mutation,expectedRevision:1,payload:{...mutation.payload,nombre}}]});
    await expect(api(batch,'POST',revise('Actualización diferida de prueba')),202,'Editar mientras está desconectada');
    await expect(adminApi(batch,'POST',revise('Actualización central independiente')),200,'Editar en otro equipo');
    await connect();
    const conflictBy=Date.now()+15000;let state;
    do{state=(await api(statusPath)).data;if(state.conflicts)break;await pause(175);}while(Date.now()<conflictBy);
    assert.equal(state.conflicts,1);assert.equal(state.pending,1);
    const issue=state.issues[0];assert.equal(issue.companyId,co.id);
    const review=(await expect(api('/api/v1/desktop-offline/review?batchId='+encodeURIComponent(issue.id)),200,'Comparar conflicto')).data;
    assert.equal(review.mutations[0].payload.nombre,'Actualización diferida de prueba');
    assert.equal(review.serverRecords[0].payload.nombre,'Actualización central independiente');
    await expect(api('/api/v1/desktop-offline/discard','POST',{batchId:issue.id,companyId:co.id,confirm:true}),200,'Descartar sólo el borrador confirmado');
    assert.equal((await api(statusPath)).data.pending,0);
    assert.equal((await adminApi(base+'/snapshot')).data.records.find(r=>r.id===id).revision,2);
    console.log('OK: edición concurrente detectada, comparación y resolución explícita sin sobrescritura.');
    await cut();
    const docRecord='eui-'+randomUUID(),pdf=Buffer.from('%PDF-1.4\n% archivo sintético de la estación\n%%EOF');
    const withFile={collection:mutation.collection,id:docRecord,expectedRevision:0,payload:{id:docRecord,nombre:'Expediente sintético con PDF',attachments:[{fileName:'constancia.pdf',dataUrl:'data:application/pdf;base64,'+pdf.toString('base64')}]}};
    const recovery='/api/v1/desktop-offline/recovery?companyId='+encodeURIComponent(co.id);
    const receipt=(await expect(api(recovery,'POST',{kind:'records',mutations:[withFile]}),201,'Proteger expediente con adjunto')).data;
    const commit='/api/v1/desktop-offline/commit?'+new URLSearchParams({companyId:co.id,id:receipt.id});
    const local=await expect(api(commit,'POST'),202,'Entregar expediente y PDF al sincronizador');
    assert.equal(local.data.pending,true);
    await closeStation();await openStation();
    assert.ok((await api(base+'/snapshot')).data.records.some(r=>r.id===docRecord));
    dropNextUploadReply=true;await connect();
    const sentBy=Date.now()+18000;
    do{state=(await api(statusPath)).data;if(!state.pending)break;await pause(175);}while(Date.now()<sentBy);
    assert.equal(state.pending,0,'Servidor debe confirmar el expediente incluso si se perdió el primer acuse de archivo');
    assert.equal(dropNextUploadReply,false,'El servidor procesó la primera subida pero el acuse se perdió');
    const eui=(await adminApi(base+'/snapshot')).data.records.find(r=>r.id===docRecord);
    assert.equal(eui?.revision,1);const ref=eui.payload.attachments[0].dataUrl;
    const versions=(await adminApi(base+'/files')).data.files;
    assert.equal(versions.length,1,'El reintento no debe duplicar versiones documentales');
    assert.equal(versions[0].downloadUrl,ref);assert.equal(versions[0].fileName,'constancia.pdf');
    const downloaded=await win.webContents.executeJavaScript('fetch('+JSON.stringify(ref)+').then(async r=>({status:r.status,bytes:Array.from(new Uint8Array(await r.arrayBuffer()))}))');
    assert.equal(downloaded.status,200);assert.deepEqual(Buffer.from(downloaded.bytes),pdf);
    assert.ok(actualUploadKeys.length>=2,'El envío sin acuse debe reintentarse contra el servidor');assert.match(actualUploadKeys[0],/^[a-f0-9]{64}$/);assert.equal(new Set(actualUploadKeys).size,1);
    console.log('OK: expediente + PDF offline; un acuse perdido no duplica el archivo, que se recupera desde la referencia privada del registro.');
    await cut();
    const logout=await expect(api('/api/auth/sign-out','POST',{}),200,'Cerrar sesión sólo en esta estación');
    assert.equal(logout.data.serverRevocationConfirmed,false);assert.equal((await api(statusPath)).data.authorized,false);
    await connect();await expect(api('/api/v1/session'),401,'No readmitir la sesión cerrada al recuperar la red');
    console.log('OK: cierre local de sesión sin conexión; reconectar no readmite la cuenta anterior.');
  }finally{await closeStation();await cut();await central?.close();}
}
app.whenReady().then(main).then(()=>app.exit(0)).catch(e=>{console.error(e.message);app.exit(1);});
