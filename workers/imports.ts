import { requireCompany, auditStatement } from "./access"
import { body, identifier, json, text } from "./http"
import { ApiError, type PilotActor, type PilotEnv } from "./types"
import { getImportSatTemplates, parseOperationImport, readOperationImportWorkbook } from "../lib/pld/import-operations"
import { sanitizeStoredPldOperation, type StoredPldOperationV3 } from "../lib/pld/stored-operations"
import type { SatXlsmLayout } from "../lib/pld/types"
import { findActividadByKey } from "../lib/pld/actividades"
import { mfaPolicyEnabled } from "./auth"
import { identifySatImportWorkbook } from "../lib/pld/sat-import-fingerprint"

interface ImportJob {id:string;companyId:string;actorId:string;fileVersionId:string;status:string;moduleKey:string;idempotencyKey:string;attempts:number;result:string;error?:string}
export async function dispatchImportOutbox(env:PilotEnv){
  if(!env.IMPORT_QUEUE)return
  const cutoff=new Date(Date.now()-5*60_000).toISOString()
  await env.DB.batch([env.DB.prepare("UPDATE pld_import_jobs SET status='queued' WHERE status='processing' AND updatedAt<?").bind(cutoff),env.DB.prepare("UPDATE pld_import_outbox SET dispatchedAt=NULL WHERE jobId IN (SELECT id FROM pld_import_jobs WHERE status='queued' AND updatedAt<?)").bind(cutoff)])
  const rows=(await env.DB.prepare("SELECT jobId FROM pld_import_outbox WHERE dispatchedAt IS NULL LIMIT 100").all<{jobId:string}>()).results
  for(const row of rows){await env.IMPORT_QUEUE.send({jobId:row.jobId});await env.DB.prepare("UPDATE pld_import_outbox SET dispatchedAt=? WHERE jobId=?").bind(new Date().toISOString(),row.jobId).run()}
}
export async function handleImports(request:Request,url:URL,actor:PilotActor,env:PilotEnv):Promise<Response|null>{
  const match=url.pathname.match(/^\/api\/v1\/companies\/([^/]+)\/imports(?:\/([^/]+))?(?:\/(preview))?$/)
  if(!match)return null
  const companyId=identifier(match[1]);await requireCompany(actor,companyId,env,"operaciones","view")
  if(request.method==="POST"&&!match[2]){
    await requireCompany(actor,companyId,env,"operaciones","upload")
    if(!env.IMPORT_QUEUE)throw new ApiError(503,"La cola de importación no está configurada.","QUEUE_NOT_CONFIGURED")
    const input=await body(request),fileVersionId=identifier(input.fileVersionId),idempotencyKey=text(input.idempotencyKey,"la referencia de importación",180)
    const activityKey=input.activityKey?text(input.activityKey,"la actividad",100):undefined
    if(activityKey){try{findActividadByKey(activityKey)}catch{throw new ApiError(400,"Actividad no reconocida.","INVALID_ACTIVITY")}}
    const file=await env.DB.prepare("SELECT v.id,d.moduleKey FROM pld_file_versions v JOIN pld_documents d ON d.id=v.documentId WHERE v.id=? AND v.companyId=?").bind(fileVersionId,companyId).first<{id:string;moduleKey:string}>()
    if(!file)throw new ApiError(404,"Archivo de origen no disponible.","NOT_FOUND")
    await requireCompany(actor,companyId,env,file.moduleKey,"download")
    const existing=await env.DB.prepare("SELECT * FROM pld_import_jobs WHERE companyId=? AND idempotencyKey=?").bind(companyId,idempotencyKey).first<ImportJob>()
    if(existing)return json({...existing,result:JSON.parse(existing.result)},200)
    const id=crypto.randomUUID(),at=new Date().toISOString(),company=await requireCompany(actor,companyId,env)
    await env.DB.batch([env.DB.prepare("INSERT INTO pld_import_jobs(id,companyId,actorId,fileVersionId,status,moduleKey,idempotencyKey,createdAt,updatedAt,result) VALUES(?,?,?,?,'queued','operaciones',?,?,?,?)").bind(id,companyId,actor.id,fileVersionId,idempotencyKey,at,at,JSON.stringify({activityKey})),env.DB.prepare("INSERT INTO pld_import_outbox(jobId) VALUES(?)").bind(id),auditStatement(env,actor,"import.queued","import",id,company.organizationId,companyId,{fileVersionId,activityKey})])
    // Outbox survives queue outages; scheduled dispatch retries without duplicate records.
    try{await dispatchImportOutbox(env)}catch{ /* Status remains queued; no false completion. */ }
    return json({id,companyId,status:"queued",createdAt:at},202)
  }
  if(request.method==="GET"&&!match[2])return json({jobs:(await env.DB.prepare("SELECT id,fileVersionId,status,moduleKey,attempts,createdAt,updatedAt,error FROM pld_import_jobs WHERE companyId=? ORDER BY createdAt DESC LIMIT 100").bind(companyId).all()).results})
  if(request.method==="GET"&&match[2]){
    const job=await env.DB.prepare("SELECT * FROM pld_import_jobs WHERE id=? AND companyId=?").bind(identifier(match[2]),companyId).first<ImportJob>()
    if(!job)throw new ApiError(404,"Importación no disponible.","NOT_FOUND")
    if(match[3]==="preview"){
      if(job.status!=="ready")throw new ApiError(409,"La importación todavía no tiene vista previa.","IMPORT_NOT_READY")
      const file=await env.EVIDENCE_BUCKET.get(`imports/${companyId}/${job.id}/preview.json`)
      if(!file)throw new ApiError(404,"Vista previa no disponible.","NOT_FOUND")
      return new Response(file.body,{headers:{"Content-Type":"application/json","Cache-Control":"private, no-store"}})
    }
    return json({...job,result:JSON.parse(job.result)})
  }
  throw new ApiError(405,"Método no permitido.","METHOD_NOT_ALLOWED")
}

export async function processImportJob(env:PilotEnv,jobId:string){
  const job=await env.DB.prepare("SELECT * FROM pld_import_jobs WHERE id=?").bind(jobId).first<ImportJob>()
  if(!job||job.status==="ready"||job.status==="failed")return
  if(job.status==="processing")throw new Error("IMPORT_ALREADY_PROCESSING")
  const claim=await env.DB.prepare("UPDATE pld_import_jobs SET status='processing',attempts=attempts+1,updatedAt=? WHERE id=? AND status='queued'").bind(new Date().toISOString(),jobId).run()
  if(!claim.meta.changes)return
  try{
    const row=await env.DB.prepare("SELECT id,name,email,platformRole,status,requiresPasswordChange,twoFactorEnabled FROM user WHERE id=?").bind(job.actorId).first<Record<string,unknown>>()
    if(!row||row.status!=="active")throw new Error("El usuario ya no tiene acceso.")
    if(row.requiresPasswordChange)throw new Error("El usuario debe cambiar su contraseña antes de procesar la importación.")
    if(!row.twoFactorEnabled&&await mfaPolicyEnabled(String(row.id),env))throw new Error("El usuario debe configurar MFA antes de procesar la importación.")
    const actor={...row,requiresPasswordChange:Boolean(row.requiresPasswordChange),twoFactorEnabled:Boolean(row.twoFactorEnabled)} as unknown as PilotActor
    const company=await requireCompany(actor,job.companyId,env,"operaciones","upload")
    const source=await env.DB.prepare("SELECT v.*,d.moduleKey FROM pld_file_versions v JOIN pld_documents d ON d.id=v.documentId WHERE v.id=? AND v.companyId=?").bind(job.fileVersionId,job.companyId).first<{objectKey:string;fileName:string;moduleKey:string}>()
    if(!source)throw new Error("No se encontró el archivo de origen.")
    await requireCompany(actor,job.companyId,env,source.moduleKey,"download")
    const object=await env.EVIDENCE_BUCKET.get(source.objectKey)
    if(!object)throw new Error("No se encontró el archivo de origen.")
    const bytes=new Uint8Array(await new Response(object.body).arrayBuffer()),layouts:SatXlsmLayout[]=[],options=JSON.parse(job.result||"{}") as {activityKey?:string},warnings:string[]=[]
    const workbook=readOperationImportWorkbook(bytes,source.fileName),recognition=identifySatImportWorkbook(workbook),templates=getImportSatTemplates()
    let template=templates.find((item)=>item.officialXlsmName.toLowerCase()===source.fileName.toLowerCase())
    if(!template&&recognition.status==="recognized")template=templates.find((item)=>item.templateId===recognition.templateIds[0])
    if(!template&&recognition.status==="ambiguous")throw new Error("El libro coincide con varias variantes SAT. Selecciona explícitamente formato y actividad antes de importarlo.")
    let activityKey=options.activityKey
    if(template){
      if(!activityKey||!template.actividadKeys.includes(activityKey)){
        if(template.actividadKeys.length!==1)throw new Error("El formato corresponde a varias actividades. Selecciona la actividad exacta para importar; no se eligió una por inferencia.")
        activityKey=template.actividadKeys[0];warnings.push("Se utilizó la única actividad asociada al formato oficial reconocido.")
      }
      if(!env.ASSETS)throw new Error("No está disponible el layout del formato SAT.")
      const response=await env.ASSETS.fetch(new Request(`${env.BETTER_AUTH_URL}/data/sat-xlsm-layouts/${template.templateId}.json`))
      if(!response.ok)throw new Error("No se pudo cargar el layout del formato SAT.")
      layouts.push(await response.json() as SatXlsmLayout)
      warnings.push(...recognition.evidence)
    }
    const existingRows=(await env.DB.prepare("SELECT payload FROM pld_records WHERE companyId=? AND collection='actividades_vulnerables_operaciones' AND deleted=0").bind(company.id).all<{payload:string}>()).results
    const existing=existingRows.map((row)=>sanitizeStoredPldOperation(JSON.parse(row.payload))).filter((op):op is StoredPldOperationV3=>op!==null)
    const preview=await parseOperationImport({bytes,fileName:source.fileName,context:{companyId:company.id,companyRfc:company.rfc,companyName:company.name,actor:actor.id,activityKey,now:new Date().toISOString()},existing,layouts,templateId:template?.templateId})
    preview.warnings.unshift(...warnings)
    await env.EVIDENCE_BUCKET.put(`imports/${company.id}/${job.id}/preview.json`,new TextEncoder().encode(JSON.stringify(preview)),{httpMetadata:{contentType:"application/json"}})
    const counts=Object.fromEntries(["valid","incomplete","duplicate","rejected"].map((status)=>[status,preview.rows.filter((row)=>row.status===status).length]))
    await env.DB.batch([env.DB.prepare("UPDATE pld_import_jobs SET status='ready',result=?,error=NULL,updatedAt=? WHERE id=?").bind(JSON.stringify({activityKey,requestedActivityKey:options.activityKey,fileHash:preview.fileHash,fileName:preview.fileName,counts,warnings:preview.warnings}),new Date().toISOString(),job.id),auditStatement(env,actor,"import.preview_ready","import",job.id,company.organizationId,company.id,{counts})])
  }catch(error){
    const message=error instanceof ApiError?error.message:error instanceof Error?error.message.slice(0,500):"No se pudo leer el archivo."
    const retry=job.attempts<2
    await env.DB.prepare("UPDATE pld_import_jobs SET status=?,error=?,updatedAt=? WHERE id=?").bind(retry?"queued":"failed",message,new Date().toISOString(),job.id).run()
    if(retry)throw new Error("IMPORT_RETRY")
  }
}
