'use strict';
const {createHash}=require('node:crypto');
const sha=b=>createHash('sha256').update(b).digest('hex');
const extensions={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg','image/webp':'webp','application/json':'json','text/plain':'txt','text/csv':'csv','text/xml':'xml','application/xml':'xml','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'xlsx','application/vnd.ms-excel.sheet.macroenabled.12':'xlsm'};
const prefix='pld-offline-file:';
const invalid=()=>Object.assign(Error('No se puede enlazar este tipo de adjunto automáticamente.'),{status:422,code:'MANUAL_REPLAY_REQUIRED'});
function decode(value) {
  const i=value.indexOf(','),mime=i<6?'':value.slice(5,i).toLowerCase(),b64=value.slice(i+1);
  if(!mime.endsWith(';base64')||!b64||b64.length>28_000_000||b64.length%4||!/^([A-Za-z0-9+/]*={0,2})$/.test(b64))throw invalid();
  const bytes=Buffer.from(b64,'base64'),type=mime.slice(0,-7);
  if(!bytes.length||bytes.length>20*1024*1024||bytes.toString('base64')!==b64)throw invalid();
  return {type,bytes};
}
function planAttachments(raw,scope) {
  if(!Array.isArray(raw)||!raw.length||raw.length>100)throw invalid();
  const files=[],mutations=raw.map((m,index)=>{
    if(!m||typeof m!=='object')throw invalid();
    function walk(v,trail,parentName) {
      if(trail.length>64)throw invalid();
      if(typeof v==='string'){
        if(v.startsWith(prefix))throw invalid();
        if(!/^data:/i.test(v))return v;
        const {type,bytes}=decode(v),hash=sha(bytes),allowed=/\.(?:pdf|png|jpg|jpeg|webp|json|txt|csv|xml|docx|xlsx|xlsm)$/i;
        let name=parentName&&allowed.test(parentName)?parentName:extensions[type]?'adjunto.'+extensions[type]:null;
        if(!name||files.length>=60)throw invalid();
        name=name.replace(/[\r\n"\\/\u0000-\u001f]/g,'_').slice(0,180);
        const key=sha(JSON.stringify([...scope,m.collection,m.id,trail,hash,name]));
        files.push({index,trail,key,sha256:hash,size:bytes.length,type,name,collection:m.collection});
        return prefix+key;
      }
      if(Array.isArray(v))return v.map((item,i)=>walk(item,[...trail,i],parentName));
      if(v&&typeof v==='object'){
        const name=[v.fileName,v.archivoNombre,v.name].find(s=>typeof s==='string'&&/\.[a-z0-9]{2,8}$/i.test(s))||parentName;
        return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,walk(x,[...trail,k],name)]));
      }return v;
    }
    return {collection:m.collection,id:m.id,expectedRevision:m.expectedRevision,payload:walk(m.payload,[]),...(m.deleted?{deleted:true}:{})};
  });
  return {mutations,files};
}
const originalBody=(raw,file)=>{let value=raw[file.index].payload;for(const k of file.trail)value=value[k];const {bytes}=decode(value);if(sha(bytes)!==file.sha256)throw invalid();return bytes;};
function resolve(mutations,files) {
  const result=structuredClone(mutations);
  for(const f of files){let p=result[f.index];for(const k of ['payload',...f.trail].slice(0,-1))p=p[k];const last=['payload',...f.trail].at(-1);if(p[last]!==prefix+f.key||!f.url)throw invalid();p[last]=f.url;}
  return result;
}
module.exports={planAttachments,originalBody,resolve};
