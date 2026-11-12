import { auditStatement, requireCompany } from "./access"
import { body, identifier, json } from "./http"
import { ApiError, type PilotActor, type PilotEnv } from "./types"
import { handleRecords } from "./records"

type Row=Record<string,unknown>
type Manifest={version:1;companyId:string;createdAt:string;records:Row[];documents:Row[];files:Row[];history:Row[]}
async function sha(bytes:ArrayBuffer){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map((v)=>v.toString(16).padStart(2,"0")).join("")}
async function load(env:PilotEnv,companyId:string,id:string){
  const row=await env.DB.prepare("SELECT * FROM pld_backups WHERE id=? AND companyId=?").bind(id,companyId).first<Row>()
  if(!row)throw new ApiError(404,"Respaldo no disponible.","NOT_FOUND")
  const object=await env.EVIDENCE_BUCKET.get(String(row.manifestKey))
  if(!object)throw new ApiError(409,"No está disponible el manifiesto privado del respaldo.","BACKUP_MISSING")
  const bytes=await new Response(object.body).arrayBuffer()
  if(await sha(bytes)!==row.sha256)throw new ApiError(409,"El manifiesto no coincide con su hash.","BACKUP_INTEGRITY")
  const manifest=JSON.parse(new TextDecoder().decode(bytes)) as Manifest
  if(manifest.version!==1||manifest.companyId!==companyId)throw new ApiError(409,"El respaldo no corresponde a esta empresa.","BACKUP_SCOPE")
  return {row,manifest,bytes}
}

/** Non-destructive recovery only. This is intentionally not a full database rollback. */
export async function handleBackups(request:Request,url:URL,actor:PilotActor,env:PilotEnv):Promise<Response|null>{
  const match=url.pathname.match(/^\/api\/v1\/companies\/([^/]+)\/backups(?:\/([^/]+))?(?:\/(restore))?$/)
  if(!match)return null
  if(actor.platformRole!=="superadmin")throw new ApiError(403,"Sólo el superadministrador administra respaldos.","FORBIDDEN")
  const company=await requireCompany(actor,identifier(match[1]),env)
  if(request.method==="GET"&&!match[2])return json({backups:(await env.DB.prepare("SELECT id,companyId,sha256,createdAt,createdBy,recordCount,fileCount FROM pld_backups WHERE companyId=? ORDER BY createdAt DESC LIMIT 100").bind(company.id).all()).results})
  if(request.method==="POST"&&!match[2]){
    const snapshot=await env.DB.batch([
      env.DB.prepare("SELECT * FROM pld_records WHERE companyId=?").bind(company.id),
      env.DB.prepare("SELECT * FROM pld_documents WHERE companyId=?").bind(company.id),
      env.DB.prepare("SELECT * FROM pld_file_versions WHERE companyId=?").bind(company.id),
      env.DB.prepare("SELECT * FROM pld_record_versions WHERE companyId=?").bind(company.id),
    ]) as Array<{results:Row[]}>
    const id=crypto.randomUUID(),at=new Date().toISOString(),manifest:Manifest={version:1,companyId:company.id,createdAt:at,records:snapshot[0].results,documents:snapshot[1].results,files:snapshot[2].results,history:snapshot[3].results},keys:string[]=[]
    if(manifest.files.length>50||manifest.files.reduce((sum,file)=>sum+Number(file.size),0)>100*1024*1024)throw new ApiError(413,"El respaldo interactivo admite 50 versiones y 100 MB. Solicita un respaldo administrado para este volumen.","BACKUP_LIMIT")
    try{
      for(const file of manifest.files){
        const original=await env.EVIDENCE_BUCKET.get(String(file.objectKey))
        if(!original)throw new ApiError(409,"Falta una versión documental. No se anunció un respaldo incompleto.","FILE_MISSING")
        const bytes=await new Response(original.body).arrayBuffer()
        if(await sha(bytes)!==file.sha256)throw new ApiError(409,"Una versión documental no coincide con su hash.","FILE_INTEGRITY")
        const key=`backups/${company.id}/${id}/files/${file.id}`
        await env.EVIDENCE_BUCKET.put(key,bytes,{httpMetadata:{contentType:String(file.mimeType)}});keys.push(key);file.backupObjectKey=key
      }
      const bytes=new TextEncoder().encode(JSON.stringify(manifest))
      if(bytes.byteLength>20*1024*1024)throw new ApiError(413,"El manifiesto requiere un respaldo administrado.","BACKUP_LIMIT")
      const hash=await sha(bytes.buffer),key=`backups/${company.id}/${id}/manifest.json`
      await env.EVIDENCE_BUCKET.put(key,bytes,{httpMetadata:{contentType:"application/json"}});keys.push(key)
      await env.DB.batch([env.DB.prepare("INSERT INTO pld_backups(id,companyId,manifestKey,sha256,createdAt,createdBy,recordCount,fileCount) VALUES(?,?,?,?,?,?,?,?)").bind(id,company.id,key,hash,at,actor.id,manifest.records.length,manifest.files.length),auditStatement(env,actor,"backup.created","backup",id,company.organizationId,company.id,{recordCount:manifest.records.length,fileCount:manifest.files.length})])
      return json({id,companyId:company.id,sha256:hash,createdAt:at,recordCount:manifest.records.length,fileCount:manifest.files.length,scope:"non-destructive-recovery"},201)
    }catch(error){for(const key of keys)await env.EVIDENCE_BUCKET.delete(key);throw error}
  }
  if(match[2]){
    const {row,manifest,bytes}=await load(env,company.id,identifier(match[2]))
    if(request.method==="GET"&&!match[3]){
      await auditStatement(env,actor,"backup.downloaded","backup",String(row.id),company.organizationId,company.id).run()
      return new Response(bytes,{headers:{"Content-Type":"application/json","Content-Disposition":`attachment; filename="respaldo-${row.id}.json"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}})
    }
    if(request.method==="POST"&&match[3]==="restore"){
      const input=await body(request)
      if(input.confirmCompanyId!==company.id||!Array.isArray(input.expectedRevisions)||input.expectedRevisions.length>100)throw new ApiError(400,"Confirma la empresa y selecciona hasta cien registros con revisión esperada.","INVALID_RECOVERY")
      const selected=new Map(input.expectedRevisions.map((item)=>{if(!item||typeof item!=="object"||Array.isArray(item))throw new ApiError(400,"Revisión no válida.","INVALID_RECOVERY");const x=item as Row,revision=Number(x.revision);if(!Number.isSafeInteger(revision)||revision<0)throw new ApiError(400,"Revisión no válida.","INVALID_RECOVERY");return [`${identifier(x.collection)}\0${identifier(x.id)}`,revision]})),mutations:Row[]=[],skipped:Array<{collection:string;id:string;reason:string}>=[]
      if(selected.size!==input.expectedRevisions.length||[...selected.keys()].some((key)=>!manifest.records.some((record)=>`${record.collection}\0${record.id}`===key)))throw new ApiError(400,"La selección contiene registros duplicados o ajenos al respaldo.","INVALID_RECOVERY")
      for(const record of manifest.records){
        const key=`${record.collection}\0${record.id}`
        if(!selected.has(key)||record.deleted)continue
        const current=await env.DB.prepare("SELECT revision,deleted FROM pld_records WHERE companyId=? AND collection=? AND id=?").bind(company.id,record.collection,record.id).first<{revision:number;deleted:number}>()
        if((current?.revision||0)!==selected.get(key))throw new ApiError(409,"Un registro cambió. No se sobrescribieron los datos actuales.","REVISION_CONFLICT")
        const payload=JSON.parse(String(record.payload)) as Row
        let reason=current&&!current.deleted?"ACTIVE_RECORD_PRESERVED":undefined
        if(record.collection==="pld-sat-output-packages"||record.collection==="pld-submissions-workflow")reason="SAT_HISTORY_REQUIRES_MANUAL_REVIEW"
        if(record.collection==="actividades_vulnerables_operaciones"&&(payload.avisoPresentado===true||(payload.submission as Row|undefined)?.wasEverPresented===true))reason="PRESENTED_OPERATION_REQUIRES_MANUAL_REVIEW"
        if(!current&&await env.DB.prepare("SELECT 1 FROM pld_record_versions WHERE companyId=? AND collection=? AND id=? LIMIT 1").bind(company.id,record.collection,record.id).first())reason="HISTORY_WITHOUT_CURRENT_REQUIRES_REVIEW"
        if(reason){skipped.push({collection:String(record.collection),id:String(record.id),reason});continue}
        mutations.push({collection:record.collection,id:record.id,expectedRevision:selected.get(key),payload,deleted:false})
      }
      const fileIds=Array.isArray(input.fileVersionIds)?input.fileVersionIds.map(identifier):[],fileChanges=[],keys:string[]=[]
      if(fileIds.some((id)=>!manifest.files.some((file)=>file.id===id)))throw new ApiError(400,"La versión no forma parte de este respaldo.","INVALID_RECOVERY")
      try{
        for(const file of manifest.files.filter((item)=>fileIds.includes(String(item.id)))){
          const current=await env.DB.prepare("SELECT objectKey,sha256 FROM pld_file_versions WHERE id=? AND companyId=?").bind(file.id,company.id).first<{objectKey:string;sha256:string}>()
          if(current&&current.sha256!==file.sha256)throw new ApiError(409,"La versión actual tiene otro hash; requiere revisión.","FILE_INTEGRITY")
          const existing=current?await env.EVIDENCE_BUCKET.get(current.objectKey):null
          if(existing){if(await sha(await new Response(existing.body).arrayBuffer())!==file.sha256)throw new ApiError(409,"El archivo actual tiene otro contenido; se conservó para revisión.","FILE_INTEGRITY");continue}
          const backup=await env.EVIDENCE_BUCKET.get(String(file.backupObjectKey))
          if(!backup)throw new ApiError(409,"Falta el archivo privado del respaldo.","BACKUP_MISSING")
          const fileBytes=await new Response(backup.body).arrayBuffer()
          if(await sha(fileBytes)!==file.sha256)throw new ApiError(409,"El archivo del respaldo no coincide con su hash.","BACKUP_INTEGRITY")
          const key=`recovered/${company.id}/${file.id}/${crypto.randomUUID()}`,guard=crypto.randomUUID()
          await env.EVIDENCE_BUCKET.put(key,fileBytes,{httpMetadata:{contentType:String(file.mimeType)}});keys.push(key)
          fileChanges.push(env.DB.prepare("INSERT INTO pld_revision_guard(id,valid) VALUES(?,CASE WHEN COALESCE((SELECT objectKey FROM pld_file_versions WHERE id=? AND companyId=?),'')=? THEN 1 ELSE 0 END)").bind(guard,file.id,company.id,current?.objectKey||""))
          const doc=manifest.documents.find((doc)=>doc.id===file.documentId)!
          fileChanges.push(env.DB.prepare("INSERT INTO pld_documents(id,companyId,moduleKey,title,relatedType,relatedId,revision,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(doc.id,company.id,doc.moduleKey,doc.title,doc.relatedType,doc.relatedId,doc.revision,doc.createdAt,doc.updatedAt))
          fileChanges.push(env.DB.prepare("INSERT INTO pld_file_versions(id,documentId,companyId,version,objectKey,sha256,fileName,mimeType,size,status,createdAt,uploadedBy,reviewedBy,reviewedAt,reason) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET objectKey=excluded.objectKey").bind(file.id,file.documentId,company.id,file.version,key,file.sha256,file.fileName,file.mimeType,file.size,file.status,file.createdAt,file.uploadedBy,file.reviewedBy,file.reviewedAt,file.reason),env.DB.prepare("DELETE FROM pld_revision_guard WHERE id=?").bind(guard))
        }
        if(fileChanges.length)await env.DB.batch(fileChanges)
      }catch(error){for(const key of keys)await env.EVIDENCE_BUCKET.delete(key);if(String(error).includes("CHECK constraint"))throw new ApiError(409,"El archivo cambió durante la recuperación.","REVISION_CONFLICT");throw error}
      let records:unknown[]=[]
      if(mutations.length){
        const target=new URL(`/api/v1/companies/${encodeURIComponent(company.id)}/records/batch`,request.url)
        try{const restored=await handleRecords(new Request(target,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mutations})}),target,actor,env);records=((await restored!.json()) as {records:unknown[]}).records}catch(error){throw new ApiError(error instanceof ApiError?error.status:409,`Los archivos recuperados (${keys.length}) se conservaron; los registros no se restauraron porque requieren revisión. ${error instanceof ApiError?error.message:""}`,"RECOVERY_RECORDS_NOT_APPLIED")}
      }
      await auditStatement(env,actor,"backup.recovered","backup",String(row.id),company.organizationId,company.id,{filesRecovered:keys.length,recordsRecovered:records.length,skipped:skipped.length}).run()
      return json({scope:"non-destructive-recovery",records,filesRecovered:keys.length,skipped,fullDisasterRecovery:false})
    }
  }
  throw new ApiError(405,"Método no permitido.","METHOD_NOT_ALLOWED")
}
