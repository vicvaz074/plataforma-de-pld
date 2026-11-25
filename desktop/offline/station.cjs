'use strict';
const {randomUUID} = require('node:crypto');
const path = require('node:path');
const {openVault} = require('./vault.cjs');
const {editable,permittedDraft}=require('./draft-policy.cjs');
const attachments=require('./attachments.cjs');

const LEASE_MS=8*60*60*1000, MAX_BATCH=2*1024*1024, MAX_SNAPSHOT=20*1024*1024;
const recordKey=r=>JSON.stringify([r.collection,r.id]);
const unavailable=Symbol('PLD_CONNECTION_UNAVAILABLE');
const offlineUnavailable=()=>Object.assign(new Error('El servidor interno no está disponible.'),{[unavailable]:true});
const json=(body,status=200,mode)=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...(mode?{'X-PLD-Offline':mode}:{})}});
const reject=(status,code,message)=>json({error:message,message,code},status);
const err=(status,code,message)=>Object.assign(Error(message),{status,code});
const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function canonical(x) {
  if (Array.isArray(x)) return '['+x.map(canonical).join(',')+']';
  if (isObj(x)) return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
  return JSON.stringify(x);
}
function rowsAfter(rows, added) {const m=new Map(rows.map(r=>[recordKey(r),r]));for(const r of added)m.set(recordKey(r),r);return [...m.values()];}
const asRecords=ms=>ms.map(({collection,id,expectedRevision,payload})=>({collection,id,revision:expectedRevision+1,payload,deleted:false}));
function validSession(s){return isObj(s?.user)&&typeof s.user.id==='string'&&s.user.id.length>0&&s.user.status==='active'&&s.user.requiresPasswordChange===false&&s.mfaRequired===false&&['grants','companies','memberships','organizations'].every(k=>Array.isArray(s[k]));}
async function readLimited(response, max) {
  if (Number(response.headers.get('content-length'))>max) throw err(413,'OFFLINE_SIZE_LIMIT','El contenido supera la capacidad de la estación.');
  if (!response.body) throw err(400,'INVALID_JSON','Falta el cuerpo de la solicitud.');
  const reader=response.body.getReader(), chunks=[];let total=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max){void reader.cancel();throw err(413,'OFFLINE_SIZE_LIMIT','El contenido supera la capacidad de la estación.');}chunks.push(Buffer.from(value));}}
  finally{reader.releaseLock();}
  try{return JSON.parse(Buffer.concat(chunks,total).toString());}catch{throw err(400,'INVALID_JSON','El contenido no es JSON válido.');}
}
function createOfflineStation({directory,origin,crypt,contracts,contractsPath,now=Date.now}) {
  if(new URL(origin).origin!==origin || !origin.startsWith('https://'))throw Error('Se requiere el origen HTTPS exacto de la instalación.');
  const {COLLECTION_MODULES,sessionCan}=contracts||require(contractsPath||path.join(process.resourcesPath||path.resolve(__dirname,'../build'),'pld/contracts.cjs'));
  const vault=openVault(directory,origin,crypt), state=vault.state;
  let chain=Promise.resolve(), closed=false;
  const serial=fn=>{const p=chain.then(()=>{if(closed)throw Error('Estación cerrada.');vault.assertOpen();return fn();});chain=p.catch(()=>{});return p;};
  const hashToken=c=>typeof c==='string'&&c.length&&c.length<=16384?vault.digest(c):null;
  const lease=c=>{const key=hashToken(c);return key&&state.leases.find(l=>l.key===key&&l.until>now());};
  const actor=c=>{const l=lease(c);return l&&state.actors.find(a=>a.id===l.actor);};
  const company=(a,id)=>a?.session?.companies.find(co=>co.id===id&&co.status==='active');
  const moduleFor=k=>Object.hasOwn(COLLECTION_MODULES,k)?COLLECTION_MODULES[k]:null;
  const can=(a,id,k,action)=>!!(company(a,id)&&moduleFor(k)&&sessionCan(a.session,company(a,id),moduleFor(k),action));
  const owns=(a,q)=>q.mutations.every(m=>can(a,q.companyId,m.collection,'view')&&can(a,q.companyId,m.collection,'edit'))&&
    (!q.files||q.files.every(f=>can(a,q.companyId,f.collection,'upload')&&can(a,q.companyId,f.collection,'download')));
  const source=(a,q)=>q.sourceId&&(a.recovery||[]).find(e=>e.id===q.sourceId&&e.companyId===q.companyId);
  const visible=(a,q)=>source(a,q)?.body?.mutations||q.mutations;
  const mode=new Map();
  const status=c=>{vault.assertOpen();const a=actor(c), q=a?a.queue.filter(e=>owns(a,e)):[];return {mode:a?(mode.get(a.id)||'offline'):'locked',authorized:!!a,pending:q.length,conflicts:q.filter(e=>e.state==='conflict').length,issues:q.filter(e=>e.state==='conflict').map(({id,companyId,state,code})=>({id,companyId,state,code}))};};
  function revoke(c){const key=hashToken(c);if(!key)return;const n=state.leases.length;state.leases=state.leases.filter(l=>l.key!==key);if(n!==state.leases.length)vault.save();}
  function observe(session,c,expiresAt) {
    if(!validSession(session)||!hashToken(c)){revoke(c);return null;}
    const key=hashToken(c),stamp=now(),ttl=Number(expiresAt);
    state.leases=state.leases.filter(l=>l.key!==key&&l.until>stamp&&l.actor!==session.user.id);
    const until=Math.min(stamp+LEASE_MS,Number.isFinite(ttl)&&ttl>0?ttl:Infinity);
    if(until<=stamp){vault.save();return null;}
    let a=state.actors.find(a=>a.id===session.user.id);
    if(!a){a={id:session.user.id,session,snapshots:[],queue:[]};state.actors.push(a);}
    a.session=session;
    a.snapshots=a.snapshots.filter(s=>company(a,s.id));
    for(const s of a.snapshots)s.records=s.records.filter(r=>can(a,s.id,r.collection,'view'));
    state.leases.push({key,until,actor:a.id});mode.set(a.id,'online');vault.save();return a;
  }
  function deny(c,companyId,status) {
    if(status===401||!companyId){revoke(c);return;}
    const a=actor(c);if(!a)return;
    a.snapshots=a.snapshots.filter(s=>s.id!==companyId);
    a.session.companies=a.session.companies.filter(co=>co.id!==companyId);vault.save();
  }
  function installSnapshot(a,id,v) {
    if(!company(a,id)||v?.company?.id!==id||v.company.organizationId!==company(a,id).organizationId||!Array.isArray(v.records))throw err(502,'SNAPSHOT_SCOPE','No se pudo verificar la empresa de la respuesta.');
    const records=v.records.filter(r=>isObj(r)&&typeof r.id==='string'&&Number.isSafeInteger(r.revision)&&r.revision>0&&can(a,id,r.collection,'view'));
    const s={id,company:v.company,records};a.snapshots=a.snapshots.filter(s=>s.id!==id);a.snapshots.push(s);vault.save();return s;
  }
  function snapshot(a,id) {
    const s=a?.snapshots.find(s=>s.id===id);if(!s||!company(a,id))throw err(403,'OFFLINE_SCOPE','Esta empresa no tiene una copia autorizada disponible.');
    const records=a.queue.filter(e=>e.companyId===id&&owns(a,e)).reduce((r,q)=>rowsAfter(r,asRecords(visible(a,q))),s.records);
    return {company:s.company,records:records.filter(r=>can(a,id,r.collection,'view'))};
  }
  function validate(a,id,ms) {
    if(!Array.isArray(ms)||!ms.length||ms.length>100)throw err(400,'INVALID_BATCH','Se requieren entre 1 y 100 registros.');
    const rows=new Map(snapshot(a,id).records.map(r=>[recordKey(r),r])),seen=new Set();
    for(const m of ms) {
      if(!isObj(m)||!editable.has(m.collection)||typeof m.id!=='string'||!m.id.trim()||m.id.length>180||(!isObj(m.payload)&&!Array.isArray(m.payload))||m.deleted||!Number.isSafeInteger(m.expectedRevision)||m.expectedRevision<0||JSON.stringify(m.payload).length>750000)throw err(503,'OFFLINE_ONLINE_REQUIRED','Este tipo de cambio requiere conexión con el servidor.');
      if(!can(a,id,m.collection,'edit')||!can(a,id,m.collection,'view'))throw err(403,'FORBIDDEN','No tienes permisos de edición para este registro.');
      const k=recordKey(m),old=rows.get(k);if(seen.has(k))throw err(400,'DUPLICATE_MUTATION','El mismo registro aparece dos veces.');seen.add(k);
      if((old?.revision||0)!==m.expectedRevision||old?.deleted)throw err(409,'REVISION_CONFLICT','La revisión no coincide con la copia local.');
      if(!permittedDraft(m.collection,m.id,m.payload,old?.payload))throw err(503,'OFFLINE_ONLINE_REQUIRED','Esta transición no es una captura de borrador. Requiere conexión y validación central.');
      if((m.payload.companyId&&m.payload.companyId!==id)||(m.payload.organizationId&&m.payload.organizationId!==company(a,id).organizationId)||(m.payload.sujetoObligado?.id&&m.payload.sujetoObligado.id!==id))throw err(403,'OFFLINE_SCOPE','El registro corresponde a otra empresa.');
      if(m.collection==='registro-sat-data'&&company(a,id).rfc&&m.payload.identificacion?.rfc&&String(m.payload.identificacion.rfc).trim().toUpperCase()!==company(a,id).rfc.toUpperCase())throw err(403,'OFFLINE_SCOPE','El RFC del Alta no coincide con la empresa activa.');
      if(/"data:[^"]{0,180},/i.test(JSON.stringify(m.payload)))throw err(503,'OFFLINE_ONLINE_REQUIRED','Los archivos requieren conexión con el repositorio corporativo.');
    }
  }
  function stage(a,id,mutations,uncertain=false) {
    if(!a)throw err(401,'OFFLINE_LOCKED','Inicia sesión en línea antes de trabajar sin conexión.');
    const signature=vault.digest(canonical(mutations));
    const existing=a.queue.find(q=>q.signature===signature&&q.companyId===id&&owns(a,q));
    if(existing&&existing.state!=='conflict')return existing;
    if(a.queue.some(q=>q.companyId===id&&q.state==='conflict'))throw err(409,'OFFLINE_CONFLICT','Revisa el conflicto pendiente antes de seguir editando.');
    validate(a,id,mutations);
    if(a.queue.length>=200)throw err(507,'OFFLINE_QUEUE_FULL','Sincroniza los borradores antes de agregar más.');
    const q={id:randomUUID(),companyId:id,mutations,signature,state:uncertain?'uncertain':'pending'};
    a.queue.push(q);vault.save();return q;
  }
  const req=(pathname,method='GET',data)=>new Request(origin+pathname,{method,credentials:'include',redirect:'manual',headers:{'Accept':'application/json',...(data?{'content-type':'application/json','origin':origin}:{})},...(data?{body:JSON.stringify(data)}:{})});
  const refusal=()=>reject(503,'OFFLINE_ONLINE_REQUIRED','Esta acción requiere conexión con el servidor. No se completó ni se guardó como oficial.');
  async function send(online,r) {
    const response=await online(r);
    if(!(response instanceof Response)||response.redirected||(response.url&&new URL(response.url).origin!==origin)||response.status>=300&&response.status<400)throw err(502,'STATION_TRANSPORT','No se aceptó la redirección o respuesta de otra instalación.');
    return response;
  }
  async function syncInner({credential:c,credentialExpiresAt,online},onlyId,targetId) {
    const before=actor(c),sr=await send(online,req('/api/v1/session'));
    if(!sr.ok){if([401,403].includes(sr.status))revoke(c);return sr;}
    const a=observe(await readLimited(sr,1024*1024),c,credentialExpiresAt);
    if(!a||(before&&before.id!==a.id))return reject(401,'OFFLINE_LOCKED','Se requiere una sesión corporativa válida.');
    const companies=[...new Set(a.queue.map(q=>q.companyId))].filter(id=>(!onlyId||onlyId===id)&&company(a,id));
    for(const id of companies) {
      const base='/api/v1/companies/'+encodeURIComponent(id);
      const result=await send(online,req(base+'/snapshot'));
      if(!result.ok){if([401,403,404].includes(result.status))deny(c,id,result.status);return result;}
      const s=installSnapshot(a,id,await readLimited(result,MAX_SNAPSHOT));
      for(const q of [...a.queue].filter(q=>q.companyId===id)) {
        if(!owns(a,q))return reject(403,'FORBIDDEN','El servidor ya no concede edición de este borrador.');
        if(q.state==='conflict')return reject(409,q.code,'Hay un conflicto pendiente de revisión.');
        const by=new Map(s.records.map(r=>[recordKey(r),r]));
        let wire=q.files?.length&&q.files.every(f=>f.url)?attachments.resolve(q.mutations,q.files):q.mutations;
        const applied=q.state==='uncertain'&&wire.every(m=>{const r=by.get(recordKey(m));return r&&!r.deleted&&r.revision===m.expectedRevision+1&&canonical(r.payload)===canonical(m.payload);});
        let acknowledged=applied?wire.map(m=>by.get(recordKey(m))):[],warnings;
        if(!applied) {
          let code;
          if(q.mutations.some(m=>(by.get(recordKey(m))?.revision||0)!==m.expectedRevision))code='OFFLINE_REVISION_CONFLICT';
          if(!code&&q.files?.length){
            const raw=source(a,q)?.body?.mutations;
            if(!raw)code='OFFLINE_UPLOAD_SOURCE_MISSING';
            else{
              const missing=q.files.filter(f=>!f.url);
              if(missing.length){
                const health=await send(online,req('/api/v1/health'));
                if(!health.ok)return health;
                const info=await readLimited(health,65536);
                if(info?.distribution!=='pld-onprem'||info?.capabilities?.idempotentFileUploads!==true)code='OFFLINE_UPLOAD_RECEIPTS_UNSUPPORTED';
              }
              for(const f of missing){
                if(code)break;
                const form=new FormData();form.set('file',new Blob([attachments.originalBody(raw,f)],{type:f.type}),f.name);
                form.set('moduleKey',moduleFor(f.collection));form.set('relatedType',f.collection);form.set('relatedId',q.mutations[f.index].id);
                const upload=await send(online,new Request(origin+base+'/files',{method:'POST',credentials:'include',redirect:'manual',headers:{origin,'x-pld-upload-key':f.key},body:form}));
                if(!upload.ok){
                  if([401,403].includes(upload.status)){deny(c,id,upload.status);return upload;}
                  if(upload.status>=500||upload.status===429)return upload;
                  code='OFFLINE_UPLOAD_REJECTED';break;
                }
                const result=await readLimited(upload,65536);
                if(typeof result.id!=='string'||!/^[-.\w]{1,180}$/.test(result.id)||result.companyId!==id||result.moduleKey!==moduleFor(f.collection)||result.sha256!==f.sha256||result.size!==f.size||result.downloadUrl!==base+'/files/'+encodeURIComponent(result.id)){
                  code='OFFLINE_UPLOAD_UNVERIFIED';break;
                }
                f.url=result.downloadUrl;vault.save();
              }
              if(!code)wire=attachments.resolve(q.mutations,q.files);
            }
          }
          if(!code){
            q.state='uncertain';vault.save(); // Durable before send, including process death during a successful request.
            const wr=await send(online,req(base+'/records/batch','POST',{mutations:wire}));
            if(!wr.ok){if([401,403].includes(wr.status)){deny(c,id,wr.status);return wr;}if(wr.status>=500||wr.status===429)return wr;code=wr.status===409?'OFFLINE_REVISION_CONFLICT':'OFFLINE_SERVER_VALIDATION';}
            else {
              const result=await readLimited(wr,MAX_SNAPSHOT);
              if(!Array.isArray(result?.records)||!q.mutations.every(m=>result.records.some(r=>r.collection===m.collection&&r.id===m.id&&r.revision===m.expectedRevision+1&&!r.deleted)))throw err(502,'UNCONFIRMED_WRITE','No se pudo comprobar la revisión guardada. Se conservará el borrador para reconciliación.');
              acknowledged=result.records.filter(r=>can(a,id,r.collection,'view'));warnings=result.warnings;s.records=rowsAfter(s.records,acknowledged);
            }
          }
          if(code){q.state='conflict';q.code=code;vault.save();return reject(409,code,'El servidor difiere del borrador. No se sobrescribió ningún registro.');}
        }
        a.queue=a.queue.filter(e=>e.id!==q.id);
        if(q.sourceId)a.recovery=(a.recovery||[]).filter(e=>e.id!==q.sourceId);
        vault.save();
        if(targetId===q.id)return json({records:acknowledged,...(warnings?{warnings}:{})});
      }
    }
    return targetId?reject(403,'FORBIDDEN','La sesión actual no autoriza este envío.'):json(status(c));
  }
  async function inner(request,ctx) {
    const {credential:c,credentialExpiresAt,online}=ctx, u=new URL(request.url), p=u.pathname,m=request.method;
    if(u.origin!==origin||u.username||u.password||!p.startsWith('/api/')||(request.headers.has('origin')&&request.headers.get('origin')!==origin))return reject(403,'OFFLINE_ORIGIN','El origen de la solicitud no corresponde a la instalación.');
    if(credentialExpiresAt&&Number(credentialExpiresAt)<=now())revoke(c);
    const scope=/^\/api\/v1\/companies\/([^/]+)\/(snapshot|records\/batch)$/.exec(p);
    const id=scope&&decodeURIComponent(scope[1]),isSnap=m==='GET'&&scope?.[2]==='snapshot'&&!u.search;
    const batch=m==='POST'&&scope?.[2]==='records/batch'&&!u.search;
    const sessionPath=m==='GET'&&p==='/api/v1/session'&&!u.search;
    const signout=m==='POST'&&p==='/api/auth/sign-out';
    const onlineOnly=request.headers.get('x-pld-require-online')==='1';
    if(signout)revoke(c); // Local access ends even if central logout cannot be delivered.
    const prefix='/api/v1/desktop-offline/';
    if(p.startsWith(prefix)){
      if(p===prefix+'status'&&m==='GET')return json(status(c));
      if(!actor(c))return reject(401,'OFFLINE_LOCKED','Vuelve a iniciar sesión en línea.');
      if(p===prefix+'sync'&&m==='POST')return syncInner(ctx);
      const a=actor(c);
      if(p===prefix+'commit'&&m==='POST'){
        const id=u.searchParams.get('companyId'),sourceId=u.searchParams.get('id');
        const item=(a.recovery||[]).find(x=>x.companyId===id&&x.id===sourceId);
        if(!item||!item.collections.every(k=>can(a,id,k,'view')&&can(a,id,k,'edit')))return reject(404,'NOT_FOUND','No se encontró un borrador disponible para esta cuenta y empresa.');
        const manual=()=>reject(422,'MANUAL_REPLAY_REQUIRED','Esta acción requiere revisión y confirmación en línea; se conserva su copia local.');
        if(item.kind!=='records')return manual();
        let q=a.queue.find(e=>e.sourceId===sourceId&&e.companyId===id);
        if(!q){
          if(!Array.isArray(item.body.mutations)||item.body.mutations.length>100)return manual();
          const planned=attachments.planAttachments(item.body.mutations,[origin,a.id,id]);
          try {validate(a,id,planned.mutations);}catch(e){if(e.code==='OFFLINE_ONLINE_REQUIRED')return manual();throw e;}
          if(a.queue.some(q=>q.companyId===id&&q.state==='conflict'))return reject(409,'OFFLINE_CONFLICT','Hay un conflicto pendiente de revisión.');
          if(a.queue.length>=200)throw err(507,'OFFLINE_QUEUE_FULL','Sincroniza los borradores antes de agregar más.');
          q={id:randomUUID(),companyId:id,...planned,state:'pending',sourceId};
          if(!owns(a,q))return reject(403,'FORBIDDEN','No tienes permisos de carga y consulta para estos archivos.');
          a.queue.push(q);vault.save();
        }
        if(!owns(a,q))return reject(403,'FORBIDDEN','La sesión no permite este envío.');
        try{return await syncInner(ctx,id,q.id);}catch(e){
          if(e.code==='MANUAL_REPLAY_REQUIRED')throw err(409,'OFFLINE_UPLOAD_UNVERIFIED','No se pudo verificar la copia reclamada. No se envió de nuevo.');
          if(!e[unavailable])throw e;
          if(!actor(c)||!owns(actor(c),q))return reject(403,'OFFLINE_LOCKED','No hay acceso local vigente.');
          mode.set(a.id,'offline');
          return json({records:asRecords(visible(a,q)),offline:true,pending:true,batchId:q.id},202,'pending');
        }
      }
      if(p===prefix+'recovery'||p.startsWith(prefix+'recovery/')) {
        const {handleRecovery}=require('./recovery.cjs');
        return handleRecovery(request,{actorId:a.id,origin,
          can:(id,k,action)=>a.snapshots.some(s=>s.id===id)&&can(a,id,k,action),
          get:()=>structuredClone((a.recovery||[]).filter(item=>!a.queue.some(q=>q.sourceId===item.id))),
          set:items=>{if(!Array.isArray(items))throw err(400,'INVALID_RECOVERY','Borrador de recuperación no válido.');const claimed=(a.recovery||[]).filter(item=>a.queue.some(q=>q.sourceId===item.id)),all=[...claimed,...items.filter(item=>!claimed.some(v=>v.id===item.id))];if(all.length>200||Buffer.byteLength(JSON.stringify(all))>45*1024*1024)throw err(507,'OFFLINE_CAPACITY','Revisa los borradores antes de agregar más.');a.recovery=all;vault.save();},
          readLimited,json,reject});
      }
      const body=p===prefix+'discard'&&m==='POST'?await readLimited(request,2048):null;
      const q=a.queue.find(e=>e.id===(body?.batchId||u.searchParams.get('batchId'))&&owns(a,e));
      if(!q)return reject(404,'NOT_FOUND','Borrador no disponible.');
      if(p===prefix+'review'&&m==='GET'){
        const by=new Set(q.mutations.map(recordKey)), s=a.snapshots.find(s=>s.id===q.companyId);
        return json({id:q.id,companyId:q.companyId,state:q.state,code:q.code,mutations:visible(a,q),serverRecords:(s?.records||[]).filter(r=>by.has(recordKey(r))),...(q.files?.length?{uploads:q.files.map(f=>({name:f.name,sha256:f.sha256,confirmed:!!f.url,downloadUrl:f.url}))}:{})});
      }
      if(p===prefix+'discard'&&body?.confirm===true&&q.companyId===body.companyId&&q.state==='conflict'){
        a.queue=a.queue.filter(x=>x.id!==q.id);vault.save();return json(status(c));
      }
      return reject(400,'OFFLINE_CONFIRMATION','Confirma el descarte del conflicto y su empresa.');
    }
    const a=actor(c);
    let mutations;
    // Do not block larger connected batches: only the encrypted outbox has a smaller size limit.
    if(batch&&a){try{mutations=(await readLimited(request.clone(),MAX_BATCH))?.mutations;}catch(e){if(e.status!==413)throw e;}}
    try {
      if((isSnap||batch)&&a?.queue.some(q=>q.companyId===id&&owns(a,q))) {
        const sync=await syncInner(ctx,id);
        if(!sync.ok&&!(sync.status===409&&isSnap&&!onlineOnly))return sync;
      }
      const response=await send(online,request);
      if([401,403].includes(response.status)||(isSnap&&response.status===404))deny(c,id,response.status);
      if(!response.ok)return response;
      if(sessionPath)observe(await readLimited(response.clone(),1024*1024),c,credentialExpiresAt);
      const current=actor(c);
      if(current)mode.set(current.id,'online');
      if(isSnap&&current&&company(current,id)){
        try {installSnapshot(current,id,await readLimited(response.clone(),MAX_SNAPSHOT));}
        catch(e){if(e.status!==413)throw e;current.snapshots=current.snapshots.filter(s=>s.id!==id);vault.save();return response;}
        if(current.queue.some(q=>q.companyId===id&&owns(current,q)))return json(snapshot(current,id),200,'pending');
      }
      if(batch&&current){
        const s=current.snapshots.find(s=>s.id===id);
        if(s){
          // A malformed acknowledgment must not promote tentative local state to centrally saved.
          const body=await readLimited(response.clone(),MAX_SNAPSHOT);
          if(!Array.isArray(body?.records))throw err(502,'UNCONFIRMED_WRITE','Falta la confirmación del servidor.');
          s.records=rowsAfter(s.records,body.records.filter(r=>can(current,id,r.collection,'view')));vault.save();
        }
      }
      return response;
    } catch(e) {
      if(!e[unavailable])throw e;
      const current=actor(c);if(current)mode.set(current.id,'offline');
      if(onlineOnly)return refusal();
      if(signout)return json({success:true,localOnly:true,serverRevocationConfirmed:false},200,'local-signout');
      if(m==='GET'&&p==='/api/v1/health')return json({mode:'cloud',environment:'onprem',distribution:'pld-onprem',configured:true,offline:true},200,'cached');
      if(!current)return reject(401,'OFFLINE_LOCKED','Para acceder sin red se requiere una sesión previamente autorizada y vigente.');
      if(sessionPath)return json(current.session,200,'cached');
      if(isSnap)return json(snapshot(current,id),200,'cached');
      if(batch&&mutations){
        const q=stage(current,id,mutations,true);
        return json({records:asRecords(q.mutations),offline:true,pending:true,batchId:q.id},202,'pending');
      }
      return refusal();
    }
  }
  const guarded=async (ctx,fn)=>{
    try{return await fn();}
    catch(e){
      if(e[unavailable]){const a=actor(ctx.credential);if(a)mode.set(a.id,'offline');return reject(503,'STATION_UNAVAILABLE','El servidor no está disponible. Se conservaron los cambios pendientes.');}
      return reject(e.status||503,e.code||'STATION_UNAVAILABLE',e.status?e.message:'No se pudo verificar la conexión o el almacén seguro. No se confirmó ningún guardado.');
    }
  };
  return {
    handle:(r,ctx)=>serial(()=>guarded(ctx,()=>inner(r,ctx))),
    status,
    sync:ctx=>serial(()=>guarded(ctx,()=>syncInner(ctx))),
    close:()=>{if(closed)return Promise.resolve();return chain.then(()=>{if(!closed){closed=true;vault.close();}});}
  };
}
module.exports={createOfflineStation,offlineUnavailable};
