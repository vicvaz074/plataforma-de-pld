import { MODULES, auditStatement, requireCompany } from "./access"
import { body, identifier, json, text } from "./http"
import { ApiError, type PilotActor, type PilotEnv } from "./types"

const MAX_FILE_SIZE=20*1024*1024
const MIME_BY_EXTENSION:Record<string,string>={pdf:"application/pdf",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",xlsm:"application/vnd.ms-excel.sheet.macroEnabled.12",csv:"text/csv",txt:"text/plain",json:"application/json",xml:"application/xml",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
type VersionRow={id:string;documentId:string;companyId:string;version:number;objectKey:string;sha256:string;fileName:string;mimeType:string;size:number;status:string;createdAt:string;uploadedBy:string;moduleKey:string;title:string;revision:number}
function metadata(row:VersionRow){const {objectKey:_,...rest}=row;return {...rest,downloadUrl:`/api/v1/companies/${row.companyId}/files/${row.id}`}}
function fileName(value:string){return value.replace(/[\r\n"\\/\u0000-\u001f]/g,"_").slice(0,180)||"documento"}
function disposition(value:string){const name=new TextDecoder().decode(new TextEncoder().encode(fileName(value))),fallback=name.normalize("NFKD").replace(/[^\x20-\x7e]/g,"_").replace(/["\\]/g,"_")||"documento",encoded=encodeURIComponent(name).replace(/[!'()*]/g,(char)=>`%${char.charCodeAt(0).toString(16).toUpperCase()}`);return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`}
async function digest(bytes:ArrayBuffer){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map((v)=>v.toString(16).padStart(2,"0")).join("")}
function validateFile(bytes:Uint8Array,name:string){
  const ext=name.split(".").pop()?.toLowerCase()||"",mime=MIME_BY_EXTENSION[ext]
  if(!mime)throw new ApiError(415,"Formato no permitido. Usa PDF, imagen, Excel, CSV, TXT, JSON, XML o DOCX.","UNSUPPORTED_FILE")
  if(!bytes.length||bytes.length>MAX_FILE_SIZE)throw new ApiError(413,"El archivo debe contener datos y pesar como máximo 20 MB.","FILE_TOO_LARGE")
  const ascii=new TextDecoder().decode(bytes.slice(0,12))
  if(ext==="json"){try{JSON.parse(new TextDecoder().decode(bytes))}catch{throw new ApiError(415,"El archivo no contiene JSON válido.","INVALID_FILE_CONTENT")}}
  if(ext==="pdf"&&!ascii.startsWith("%PDF-"))throw new ApiError(415,"El archivo no contiene un PDF válido.","INVALID_FILE_SIGNATURE")
  if(["xlsx","xlsm","docx"].includes(ext)&&!(bytes[0]===80&&bytes[1]===75))throw new ApiError(415,"El archivo no contiene un documento Office válido.","INVALID_FILE_SIGNATURE")
  if(ext==="png"&&!(bytes[0]===137&&ascii.slice(1,4)==="PNG"))throw new ApiError(415,"PNG no válido.","INVALID_FILE_SIGNATURE")
  if(["jpg","jpeg"].includes(ext)&&!(bytes[0]===255&&bytes[1]===216))throw new ApiError(415,"JPEG no válido.","INVALID_FILE_SIGNATURE")
  return mime
}
async function getVersion(env:PilotEnv,companyId:string,id:string){
  const row=await env.DB.prepare("SELECT v.*,d.moduleKey,d.title,d.revision FROM pld_file_versions v JOIN pld_documents d ON d.id=v.documentId WHERE v.companyId=? AND v.id=? AND d.companyId=v.companyId").bind(companyId,id).first<VersionRow>()
  if(!row)throw new ApiError(404,"Documento no disponible.","NOT_FOUND")
  return row
}
async function storeVersion(env:PilotEnv,actor:PilotActor,companyId:string,input:{bytes:ArrayBuffer;fileName:string;moduleKey:string;title:string;documentId?:string;expectedRevision:number;relatedType?:string;relatedId?:string}){
  const company=await requireCompany(actor,companyId,env,input.moduleKey,"upload")
  const mime=validateFile(new Uint8Array(input.bytes),input.fileName),sha256=await digest(input.bytes),versionId=crypto.randomUUID(),documentId=input.documentId||crypto.randomUUID(),at=new Date().toISOString()
  const old=await env.DB.prepare("SELECT revision,moduleKey FROM pld_documents WHERE id=? AND companyId=?").bind(documentId,companyId).first<{revision:number;moduleKey:string}>()
  if(input.documentId&&!old)throw new ApiError(404,"Documento no disponible.","NOT_FOUND")
  if(old&&(old.moduleKey!==input.moduleKey||old.revision!==input.expectedRevision))throw new ApiError(409,"El documento cambió; vuelve a abrirlo antes de añadir una versión.","REVISION_CONFLICT")
  if(!old&&input.expectedRevision!==0)throw new ApiError(409,"Revisión de documento no válida.","REVISION_CONFLICT")
  const version=(old?.revision||0)+1,objectKey=`${company.organizationId}/${companyId}/${documentId}/${versionId}`
  await env.EVIDENCE_BUCKET.put(objectKey,input.bytes,{httpMetadata:{contentType:mime},customMetadata:{sha256,companyId,documentId}})
  const statements=[],guard=crypto.randomUUID()
  statements.push(env.DB.prepare("INSERT INTO pld_revision_guard(id,valid) VALUES(?,CASE WHEN COALESCE((SELECT revision FROM pld_documents WHERE id=? AND companyId=?),0)=? THEN 1 ELSE 0 END)").bind(guard,documentId,companyId,input.expectedRevision))
  statements.push(env.DB.prepare("INSERT INTO pld_documents(id,companyId,moduleKey,title,relatedType,relatedId,revision,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,title=excluded.title,updatedAt=excluded.updatedAt").bind(documentId,companyId,input.moduleKey,input.title,input.relatedType||null,input.relatedId||null,version,at,at))
  statements.push(env.DB.prepare("INSERT INTO pld_file_versions(id,documentId,companyId,version,objectKey,sha256,fileName,mimeType,size,status,createdAt,uploadedBy) VALUES(?,?,?,?,?,?,?,?,?,'pending',?,?)").bind(versionId,documentId,companyId,version,objectKey,sha256,input.fileName,mime,input.bytes.byteLength,at,actor.id))
  statements.push(env.DB.prepare("DELETE FROM pld_revision_guard WHERE id=?").bind(guard),auditStatement(env,actor,"file.uploaded","document",documentId,company.organizationId,companyId,{versionId,version,sha256,size:input.bytes.byteLength}))
  try{await env.DB.batch(statements)}catch(error){await env.EVIDENCE_BUCKET.delete(objectKey);if(String(error).includes("CHECK constraint"))throw new ApiError(409,"El documento cambió en otra sesión.","REVISION_CONFLICT");throw error}
  return metadata({id:versionId,documentId,companyId,version,objectKey,sha256,fileName:input.fileName,mimeType:mime,size:input.bytes.byteLength,status:"pending",createdAt:at,uploadedBy:actor.id,moduleKey:input.moduleKey,title:input.title,revision:version})
}

export async function handleFiles(request:Request,url:URL,actor:PilotActor,env:PilotEnv):Promise<Response|null>{
  const match=url.pathname.match(/^\/api\/v1\/companies\/([^/]+)\/files(?:\/([^/]+))?(?:\/(restore))?$/)
  if(!match)return null
  const companyId=identifier(match[1]),scope=await requireCompany(actor,companyId,env)
  if(!match[2]&&request.method==="GET"){
    const rows=(await env.DB.prepare("SELECT v.*,d.moduleKey,d.title,d.revision FROM pld_file_versions v JOIN pld_documents d ON d.id=v.documentId WHERE v.companyId=? ORDER BY v.createdAt DESC LIMIT 1000").bind(companyId).all<VersionRow>()).results
    const allowed=new Set<string>();for(const module of MODULES){try{await requireCompany(actor,companyId,env,module,"view");allowed.add(module)}catch(error){if(!(error instanceof ApiError)||![403,404].includes(error.status))throw error}}
    return json({files:rows.filter((row)=>allowed.has(row.moduleKey)).map(metadata)})
  }
  if(!match[2]&&request.method==="POST"){
    if(Number(request.headers.get("content-length"))>MAX_FILE_SIZE+100_000)throw new ApiError(413,"Máximo 20 MB por archivo.","FILE_TOO_LARGE")
    const form=await request.formData(),file=form.get("file")
    if(!file||typeof file==="string")throw new ApiError(400,"Selecciona un archivo.","FILE_REQUIRED")
    const moduleKey=text(form.get("moduleKey"),"el módulo",40)
    if(!MODULES.includes(moduleKey as never))throw new ApiError(400,"Módulo no reconocido.","INVALID_MODULE")
    await requireCompany(actor,companyId,env,moduleKey,"upload")
    const documentId=form.get("documentId")?identifier(form.get("documentId")):undefined,expectedRevision=Number(form.get("expectedRevision")||0)
    if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw new ApiError(400,"Revisión no válida.","INVALID_REVISION")
    return json(await storeVersion(env,actor,companyId,{bytes:await file.arrayBuffer(),fileName:fileName(file.name),moduleKey,title:text(form.get("title")||file.name,"el título"),documentId,expectedRevision,relatedType:text(form.get("relatedType"),"la relación",60,false),relatedId:text(form.get("relatedId"),"el registro relacionado",180,false)}),201)
  }
  if(match[2]){
    const row=await getVersion(env,companyId,identifier(match[2]))
    if(request.method==="GET"&&!match[3]){
      await requireCompany(actor,companyId,env,row.moduleKey,"download")
      const object=await env.EVIDENCE_BUCKET.get(row.objectKey);if(!object)throw new ApiError(404,"El archivo no está disponible; conserva el historial y contacta al administrador.","FILE_MISSING")
      await auditStatement(env,actor,"file.downloaded","file",row.id,scope.organizationId,companyId,{documentId:row.documentId,sha256:row.sha256}).run()
      return new Response(object.body,{headers:{"Content-Type":row.mimeType,"Content-Length":String(object.size),"Content-Disposition":disposition(row.fileName),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox"}})
    }
    if(request.method==="POST"&&match[3]==="restore"){
      await requireCompany(actor,companyId,env,row.moduleKey,"upload");const input=await body(request),object=await env.EVIDENCE_BUCKET.get(row.objectKey)
      if(!object)throw new ApiError(404,"Versión no disponible.","FILE_MISSING")
      const bytes=await new Response(object.body).arrayBuffer()
      return json(await storeVersion(env,actor,companyId,{bytes,fileName:row.fileName,moduleKey:row.moduleKey,title:row.title,documentId:row.documentId,expectedRevision:Number(input.expectedRevision)}),201)
    }
    if(request.method==="PATCH"&&!match[3]){
      const input=await body(request),status=text(input.status,"el estado",20)
      if(!["approved","rejected","archived"].includes(status))throw new ApiError(400,"Estado no reconocido.","INVALID_FIELD")
      const company=await requireCompany(actor,companyId,env,row.moduleKey,status==="archived"?"archive":"approve"),reason=text(input.reason,"el motivo",2000,status!=="approved")
      await env.DB.batch([env.DB.prepare("UPDATE pld_file_versions SET status=?,reviewedBy=?,reviewedAt=?,reason=? WHERE id=? AND companyId=?").bind(status,actor.id,new Date().toISOString(),reason||null,row.id,companyId),auditStatement(env,actor,"file."+status,"file",row.id,company.organizationId,companyId,{sha256:row.sha256,reason})])
      return json({...metadata(row),status,reviewedBy:actor.id,reason})
    }
  }
  throw new ApiError(405,"Método no permitido.","METHOD_NOT_ALLOWED")
}
