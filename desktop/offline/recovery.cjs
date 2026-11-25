'use strict';
const {createHash}=require('node:crypto');
const root='/api/v1/desktop-offline/recovery';
const limit=30*1024*1024;
const response=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const fail=(status,message)=>response({error:message},status);
const isId=s=>typeof s==='string'&&s.length>0&&s.length<=256;
function permits(item,ctx,company,reading=false) {
  return item.companyId===company && item.collections.every(c=>ctx.can(company,c,'view')&&ctx.can(company,c,'edit')
    &&(!item.hasFiles||ctx.can(company,c,reading?'download':'upload')));
}
function summary({id,kind,collections,createdAt,hasFiles}){return {id,kind,collections,createdAt,hasFiles};}
async function handleRecovery(req,ctx){
  const u=new URL(req.url),company=u.searchParams.get('companyId'),id=u.searchParams.get('id');
  if(u.pathname!==root||!isId(company))return fail(400,'Selecciona la empresa del borrador.');
  if(req.method==='GET'||req.method==='DELETE'){
    const items=ctx.get();
    if(!id && req.method==='GET')return response({items:items.filter(i=>permits(i,ctx,company,true)).map(summary)});
    const item=items.find(i=>i.id===id && permits(i,ctx,company,req.method==='GET'));
    if(!item)return fail(404,'Borrador no disponible para este acceso.');
    if(req.method==='GET')return response(item);
    if(req.headers.get('x-pld-confirm')!=='yes')return fail(400,'Confirma la retirada de esta copia.');
    ctx.set(items.filter(i=>i!==item));
    return response({removed:true});
  }
  if(req.method!=='POST')return fail(405,'Método no admitido.');
  const reader=req.body?.getReader();if(!reader)return fail(400,'Cuerpo vacío.');
  const chunks=[];let length=0;
  for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit){await reader.cancel();return fail(413,'El borrador supera el espacio por elemento. Conserva el archivo original.');}chunks.push(value);}
  let body;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{return fail(400,'Borrador no válido.');}
  let collections,hasFiles;
  if(body?.kind==='records'&&Array.isArray(body.mutations)&&body.mutations.length>0&&body.mutations.length<=5000
    &&body.mutations.every(m=>m&&isId(m.collection)&&isId(m.id)&&Number.isSafeInteger(m.expectedRevision)&&m.expectedRevision>=0&&Object.hasOwn(m,'payload'))){
    collections=[...new Set(body.mutations.map(m=>m.collection))];hasFiles=/"data:[^",]{0,256},/i.test(JSON.stringify(body.mutations));
  }else if(body?.kind==='file'&&isId(body.collection)&&isId(body.name)&&typeof body.data==='string'&&/^data:[^,]{0,256};base64,[A-Za-z0-9+/=]+$/.test(body.data)){
    collections=[body.collection];hasFiles=true;
  }else return fail(400,'El borrador no tiene un formato reconocido.');
  const key=createHash('sha256').update(JSON.stringify([ctx.actorId,ctx.origin,company,body])).digest('hex');
  const item={id:key,companyId:company,collections,hasFiles,kind:body.kind,createdAt:new Date().toISOString(),body};
  if(!permits(item,ctx,company))return fail(403,'No tienes permisos para proteger este borrador en la estación.');
  const items=ctx.get();
  if(!items.some(i=>i.id===key)){
    // No eviction: exhausting space must never remove an earlier draft.
    if(items.length>=200||Buffer.byteLength(JSON.stringify(items))+length>45*1024*1024)return fail(507,'No queda espacio de recuperación. Revisa tus borradores y conserva el original.');
    ctx.set([...items,item]);
  }
  return response({id:key,localOnly:true},201);
}
module.exports={handleRecovery};
