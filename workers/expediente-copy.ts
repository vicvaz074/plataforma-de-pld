import { auditStatement, requireCompany } from "./access"
import { body, identifier, json } from "./http"
import { validateRecordPayload } from "./records"
import { ApiError, type PilotActor, type PilotEnv } from "./types"

type Version={id:string;documentId:string;objectKey:string;version:number;sha256:string;fileName:string;mimeType:string;size:number}
const collection="kyc_expedientes_detalle"
function object(value:unknown):value is Record<string,unknown>{return Boolean(value&&typeof value==="object"&&!Array.isArray(value))}
function fileReference(value:string,origin:string){
  try{const url=new URL(value,origin),match=url.pathname.match(/^\/api\/v1\/companies\/([^/]+)\/files\/([^/]+)$/);return match?{companyId:decodeURIComponent(match[1]),versionId:decodeURIComponent(match[2])}:undefined}catch{return undefined}
}
function visit(value:unknown,consume:(value:string)=>void){if(typeof value==="string")consume(value);else if(Array.isArray(value))value.forEach((item)=>visit(item,consume));else if(object(value))Object.values(value).forEach((item)=>visit(item,consume))}

/** Explicit reuse is a copy, never a change to the private original or an RFC merge. */
export async function handleExpedienteCopy(request:Request,url:URL,actor:PilotActor,env:PilotEnv):Promise<Response|null>{
  const match=url.pathname.match(/^\/api\/v1\/companies\/([^/]+)\/expedientes\/copy$/)
  if(!match)return null
  if(request.method!=="POST")throw new ApiError(405,"Método no permitido.","METHOD_NOT_ALLOWED")
  const target=await requireCompany(actor,identifier(match[1]),env,"expedientes","edit"),input=await body(request)
  const sourceCompanyId=identifier(input.sourceCompanyId),id=identifier(input.expedienteId),expectedRevision=Number(input.expectedRevision)
  if(!sourceCompanyId.startsWith("inbox:")||target.id.startsWith("inbox:")||!Number.isSafeInteger(expectedRevision)||expectedRevision<1)throw new ApiError(400,"Selecciona un expediente privado y su revisión vigente.","INVALID_COPY")
  const source=await requireCompany(actor,sourceCompanyId,env,"expedientes","view")
  if(source.organizationId!==target.organizationId)throw new ApiError(403,"La reutilización sólo está disponible dentro de la misma organización.","FORBIDDEN")
  const record=await env.DB.prepare("SELECT revision,payload FROM pld_records WHERE companyId=? AND collection=? AND id=? AND deleted=0").bind(source.id,collection,id).first<{revision:number;payload:string}>()
  if(!record)throw new ApiError(404,"Expediente privado no disponible.","NOT_FOUND")
  if(record.revision!==expectedRevision)throw new ApiError(409,"El expediente privado cambió. Actualiza antes de reutilizarlo.","REVISION_CONFLICT")
  if(await env.DB.prepare("SELECT 1 FROM pld_records WHERE companyId=? AND collection=? AND id=?").bind(target.id,collection,id).first())throw new ApiError(409,"La empresa ya tiene un expediente con este ID; no se sobrescribió.","COPY_TARGET_EXISTS")
  const history=(await env.DB.prepare("SELECT revision,payload,deleted,createdAt,actorId FROM pld_record_versions WHERE companyId=? AND collection=? AND id=? ORDER BY revision LIMIT 101").bind(source.id,collection,id).all<{revision:number;payload:string;deleted:number;createdAt:string;actorId:string}>()).results
  if(history.length>100)throw new ApiError(413,"El expediente tiene más de 100 revisiones; solicita una migración asistida.","COPY_LIMIT")
  const sourcePayload=JSON.parse(record.payload) as unknown,versionIds=new Set<string>()
  for(const payload of [sourcePayload,...history.map((revision)=>JSON.parse(revision.payload))])visit(payload,(value)=>{
    const ref=fileReference(value,env.BETTER_AUTH_URL)
    if(!ref)return
    if(ref.companyId!==source.id)throw new ApiError(400,"El expediente contiene archivos de otro ámbito que requieren revisión.","INVALID_FILE_SCOPE")
    versionIds.add(ref.versionId)
  })
  const documents=new Map<string,{title:string;versions:Version[]}>()
  for(const versionId of versionIds){
    const file=await env.DB.prepare("SELECT v.documentId,d.title,d.moduleKey FROM pld_file_versions v JOIN pld_documents d ON d.id=v.documentId WHERE v.id=? AND v.companyId=?").bind(versionId,source.id).first<{documentId:string;title:string;moduleKey:string}>()
    if(!file)throw new ApiError(409,"Falta una versión documental referenciada; no se copió el expediente.","FILE_MISSING")
    await requireCompany(actor,source.id,env,file.moduleKey,"download")
    if(!documents.has(file.documentId))documents.set(file.documentId,{title:file.title,versions:(await env.DB.prepare("SELECT id,documentId,objectKey,version,sha256,fileName,mimeType,size FROM pld_file_versions WHERE documentId=? AND companyId=? ORDER BY version").bind(file.documentId,source.id).all<Version>()).results})
  }
  const allVersions=[...documents.values()].flatMap((doc)=>doc.versions)
  if(allVersions.length>50)throw new ApiError(413,"La copia contiene más de 50 versiones documentales; solicita una migración asistida.","COPY_LIMIT")
  if(allVersions.length)await requireCompany(actor,target.id,env,"expedientes","upload")
  const at=new Date().toISOString(),documentMap=new Map([...documents.keys()].map((key)=>[key,crypto.randomUUID()])),versionMap=new Map(allVersions.map((version)=>[version.id,crypto.randomUUID()])),storedKeys:string[]=[],statements=[]
  const rewrite=(value:unknown,resetReview=false):unknown=>{
    if(typeof value==="string"){
      const ref=fileReference(value,env.BETTER_AUTH_URL)
      if(ref)return `/api/v1/companies/${encodeURIComponent(target.id)}/files/${versionMap.get(ref.versionId)}`
      return versionMap.get(value)||documentMap.get(value)||value
    }
    if(Array.isArray(value))return value.map((item)=>rewrite(item,resetReview))
    if(object(value)){
      const next=Object.fromEntries(Object.entries(value).map(([key,item])=>[key,rewrite(item,resetReview)]))
      const hasFileReference=Object.values(value).some((item)=>typeof item==="string"&&(Boolean(fileReference(item,env.BETTER_AUTH_URL))||versionMap.has(item)))
      if(resetReview&&hasFileReference){
        for(const key of ["reviewStatus","status"])if(key in next)next[key]="pending"
        for(const key of ["reviewedAt","reviewedBy","approvedAt","approvedBy"])delete next[key]
        for(const key of ["approved","reviewed"])if(key in next)next[key]=false
      }
      return next
    }
    return value
  }
  const bindSubject=(value:Record<string,unknown>)=>({...value,companyId:target.id,organizationId:target.organizationId,sujetoObligadoId:target.id,sujetoObligadoNombre:target.name,sujetoObligadoRfc:target.rfc})
  const rewritten=rewrite(sourcePayload,true)
  if(!object(rewritten))throw new ApiError(400,"El expediente no contiene un registro válido.","INVALID_COPY")
  const provenance={companyId:source.id,recordId:id,revision:record.revision,copiedAt:at,copiedBy:actor.id}
  const payload={...bindSubject(rewritten),...(object(rewritten.expedienteEui)?{expedienteEui:bindSubject(rewritten.expedienteEui)}:{}),copiedFrom:provenance,actualizadoEn:at}
  validateRecordPayload(collection,id,payload)
  const revision=record.revision+1,guard=crypto.randomUUID()
  statements.push(env.DB.prepare("INSERT INTO pld_revision_guard(id,valid) VALUES(?,CASE WHEN (SELECT revision FROM pld_records WHERE companyId=? AND collection=? AND id=? AND deleted=0)=? AND NOT EXISTS(SELECT 1 FROM pld_records WHERE companyId=? AND collection=? AND id=?) THEN 1 ELSE 0 END)").bind(guard,source.id,collection,id,expectedRevision,target.id,collection,id))
  try{
    for(const [originalDocumentId,document] of documents){
      const documentId=documentMap.get(originalDocumentId)!
      statements.push(env.DB.prepare("INSERT INTO pld_documents(id,companyId,moduleKey,title,relatedType,relatedId,revision,createdAt,updatedAt) VALUES(?,?,'expedientes',?,'expediente',?,?,?,?)").bind(documentId,target.id,document.title,id,Math.max(...document.versions.map((file)=>file.version)),at,at))
      for(const file of document.versions){
        const original=await env.EVIDENCE_BUCKET.get(file.objectKey)
        if(!original)throw new ApiError(409,"Una versión documental no está disponible; el original se conserva sin cambios.","FILE_MISSING")
        const versionId=versionMap.get(file.id)!,key=`${target.organizationId}/${target.id}/${documentId}/${versionId}`
        const bytes=await new Response(original.body).arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map((item)=>item.toString(16).padStart(2,"0")).join("")
        if(hash!==file.sha256)throw new ApiError(409,"La integridad de una versión no coincide; solicita revisión.","FILE_INTEGRITY")
        await env.EVIDENCE_BUCKET.put(key,bytes,{httpMetadata:{contentType:file.mimeType},customMetadata:{sha256:file.sha256,companyId:target.id,documentId,sourceVersionId:file.id}});storedKeys.push(key)
        statements.push(env.DB.prepare("INSERT INTO pld_file_versions(id,documentId,companyId,version,objectKey,sha256,fileName,mimeType,size,status,createdAt,uploadedBy) VALUES(?,?,?,?,?,?,?,?,?,'pending',?,?)").bind(versionId,documentId,target.id,file.version,key,file.sha256,file.fileName,file.mimeType,file.size,at,actor.id))
      }
      statements.push(auditStatement(env,actor,"file.copied","document",documentId,target.organizationId,target.id,{sourceCompanyId:source.id,sourceDocumentId:originalDocumentId,versions:document.versions.length}))
    }
    for(const snapshot of history)statements.push(env.DB.prepare("INSERT INTO pld_record_versions(companyId,collection,id,revision,payload,deleted,createdAt,actorId) VALUES(?,?,?,?,?,?,?,?)").bind(target.id,collection,id,snapshot.revision,JSON.stringify(rewrite(JSON.parse(snapshot.payload))),snapshot.deleted,snapshot.createdAt,snapshot.actorId))
    statements.push(env.DB.prepare("INSERT INTO pld_records(companyId,collection,id,revision,payload,deleted,createdAt,updatedAt,updatedBy) VALUES(?,?,?,?,?,0,?,?,?)").bind(target.id,collection,id,revision,JSON.stringify(payload),at,at,actor.id),env.DB.prepare("INSERT INTO pld_record_versions(companyId,collection,id,revision,payload,deleted,createdAt,actorId) VALUES(?,?,?,?,?,0,?,?)").bind(target.id,collection,id,revision,JSON.stringify(payload),at,actor.id),env.DB.prepare("DELETE FROM pld_revision_guard WHERE id=?").bind(guard),auditStatement(env,actor,"expediente.copied","expediente",id,target.organizationId,target.id,provenance))
    await requireCompany(actor,source.id,env,"expedientes","view");await requireCompany(actor,target.id,env,"expedientes","edit")
    if(allVersions.length){await requireCompany(actor,source.id,env,"expedientes","download");await requireCompany(actor,target.id,env,"expedientes","upload")}
    await env.DB.batch(statements)
    return json({company:target,records:[{collection,id,revision,payload,deleted:false}],copiedFrom:provenance},201)
  }catch(error){
    for(const key of storedKeys)await env.EVIDENCE_BUCKET.delete(key)
    if(String(error).includes("CHECK constraint"))throw new ApiError(409,"El origen o el destino cambió durante la copia. No se sobrescribieron datos.","REVISION_CONFLICT")
    throw error
  }
}
