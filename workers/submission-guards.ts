import { ApiError, type PilotEnv, type PilotActor } from "./types"
import { scopedFileVersionId } from "./http"
import { sanitizeStoredPldOperation } from "../lib/pld/stored-operations"

type Data=Record<string,unknown>
const object=(value:unknown):value is Data=>Boolean(value&&typeof value==="object"&&!Array.isArray(value))
const stable=(value:unknown):string=>JSON.stringify(Array.isArray(value)?value.map((item)=>JSON.parse(stable(item))):object(value)?Object.fromEntries(Object.keys(value).sort().filter((key)=>value[key]!==undefined).map((key)=>[key,JSON.parse(stable(value[key]))])):value)??"null"
function captureSnapshot(value:Data){return Object.fromEntries(Object.entries(value).filter(([key])=>!["revision","updatedAt","submission","avisoPresentado","history"].includes(key)))}

/** Validates a documented presentation, not authenticity or acceptance by SAT. */
export async function validateSubmission(input:{id:string;payload:Data;companyId:string;actor:PilotActor;env:PilotEnv;mutations:unknown[];changes:Array<{collection:string;id:string;payload:unknown}>;at:string}){
  const {payload,env,companyId}=input,operationId=String(payload.operationId||""),presenting=payload.status==="presented"
  if(!["draft","correction-pending","presented"].includes(String(payload.status)))throw new ApiError(400,"Estado de aviso no válido.","INVALID_SUBMISSION_STATUS")
  if(!operationId&&!presenting&&!payload.correctionOf)return payload // Unassigned draft; never a presentation.
  const currentRow=await env.DB.prepare("SELECT revision,payload FROM pld_records WHERE companyId=? AND collection='actividades_vulnerables_operaciones' AND id=? AND deleted=0").bind(companyId,operationId).first<{revision:number;payload:string}>()
  if(!currentRow)throw new ApiError(404,"La operación del aviso no está disponible en esta empresa.","SUBMISSION_OPERATION_MISSING")
  const current=sanitizeStoredPldOperation(JSON.parse(currentRow.payload),{now:input.at})!
  const pending=input.mutations.find((candidate)=>object(candidate)&&candidate.collection==="actividades_vulnerables_operaciones"&&candidate.id===operationId)
  const pendingRecord=object(pending)?pending:undefined,canonical=input.changes.find((candidate)=>candidate.collection==="actividades_vulnerables_operaciones"&&candidate.id===operationId)
  const operation=sanitizeStoredPldOperation(canonical?.payload||pendingRecord?.payload||current,{now:input.at})
  const prepared=Number(payload.preparedOperationRevision),source=Number(payload.sourceOperationRevision)
  if(!Number.isSafeInteger(prepared)||prepared<1||payload.id!==input.id||input.id!==`submission-${operationId}-r${prepared}`)throw new ApiError(400,"Usa un borrador propio de la revisión capturada de la operación.","INVALID_SUBMISSION_ID")
  const targetRevision=presenting?currentRow.revision+1:pendingRecord?Number(pendingRecord.expectedRevision)+1:currentRow.revision
  if(!operation||operation.lifecycle.status==="cancelled"||prepared!==(presenting?currentRow.revision:targetRevision)||source!==(presenting?currentRow.revision+1:prepared))throw new ApiError(409,"La operación cambió; prepara un aviso para su revisión actual.","SUBMISSION_REVISION_CONFLICT")
  if(presenting&&(!pendingRecord||pendingRecord.deleted===true||Number(pendingRecord.expectedRevision)!==currentRow.revision||!object(pendingRecord.payload)||!object(pendingRecord.payload.submission)||pendingRecord.payload.submission.status!=="presented"))throw new ApiError(400,"La presentación debe guardarse junto con la nueva revisión de la operación.","SUBMISSION_OPERATION_BATCH_REQUIRED")
  if(presenting&&stable(captureSnapshot(pendingRecord!.payload as Data))!==stable(captureSnapshot(JSON.parse(currentRow.payload) as Data)))throw new ApiError(409,"Guarda y valida los cambios de captura antes de documentar su presentación; no se presentan cambios que no están en el paquete revisado.","SUBMISSION_CAPTURE_CHANGED")
  const rows=(await env.DB.prepare("SELECT id,payload FROM pld_records WHERE companyId=? AND collection='pld-submissions-workflow' AND deleted=0").bind(companyId).all<{id:string;payload:string}>()).results
  const presented=rows.map((row)=>({id:row.id,payload:JSON.parse(row.payload) as Data})).filter((row)=>row.payload.operationId===operationId&&row.payload.status==="presented")
    .sort((left,right)=>Number(right.payload.sourceOperationRevision)-Number(left.payload.sourceOperationRevision))
  const previous=presented[0]
  if(current.submission.wasEverPresented){
    if(!previous)throw new ApiError(409,"Falta el aviso histórico presentado; conserva los datos y solicita revisión antes de corregir.","SUBMISSION_HISTORY_REQUIRED")
    if(payload.correctionOf!==previous.id||Number(payload.previousOperationRevision)!==Number(previous.payload.sourceOperationRevision))throw new ApiError(409,"La corrección debe enlazar el último aviso presentado sin modificarlo.","CORRECTION_LINK_REQUIRED")
  }else if(payload.correctionOf)throw new ApiError(400,"La operación no tiene una presentación histórica que corregir.","INVALID_CORRECTION_LINK")
  if(!presenting)return {...payload,schemaVersion:2}
  if(operation.captureStatus==="draft")throw new ApiError(409,"Completa la captura antes de registrar una presentación.","SUBMISSION_INCOMPLETE")
  const packageRow=await env.DB.prepare("SELECT revision,payload FROM pld_records WHERE companyId=? AND collection='pld-sat-output-packages' AND id=? AND deleted=0").bind(companyId,`satpkg-${operationId}`).first<{revision:number;payload:string}>()
  const packet=packageRow?JSON.parse(packageRow.payload) as Data:undefined
  if(!packet||packet.sourceOperationId!==operationId||Number(packet.sourceOperationRevision)!==currentRow.revision||!object(packet.validation)||packet.validation.status!=="listo")throw new ApiError(409,"La salida SAT debe estar validada localmente y corresponder a la revisión previa exacta de la operación.","SUBMISSION_PACKAGE_STALE")
  const form=object(payload.form)?payload.form:{}
  if(!form.folio||!form.digitalSeal||!form.submissionDate||!form.acknowledgementDate)throw new ApiError(400,"Completa folio, sello y fechas de presentación y acuse.","SUBMISSION_INCOMPLETE")
  if(previous&&object(previous.payload.form)&&String(previous.payload.form.folio||"").trim()===String(form.folio).trim())throw new ApiError(400,"La corrección requiere un folio nuevo; conserva el anterior en su aviso histórico.","CORRECTION_REFERENCE_REUSE")
  for(const field of ["submissionDate","acknowledgementDate"]){const day=String(form[field]);if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day)throw new ApiError(400,"Registra fechas de presentación y acuse válidas.","INVALID_SUBMISSION_DATE")}
  const attachments:unknown[]=Array.isArray(payload.attachments)?payload.attachments:[],ack=attachments.find((item)=>object(item)&&item.type==="Acuse SAT")
  if(!object(ack))throw new ApiError(400,"Adjunta el archivo de acuse SAT.","ACK_REQUIRED")
  const versionId=scopedFileVersionId(ack.dataUrl,companyId,env.BETTER_AUTH_URL),file=versionId?await env.DB.prepare("SELECT sha256,objectKey FROM pld_file_versions WHERE id=? AND companyId=?").bind(versionId,companyId).first<{sha256:string;objectKey:string}>():null
  if(!file||file.sha256!==ack.sha256||!await env.EVIDENCE_BUCKET.get(file.objectKey))throw new ApiError(400,"El acuse debe corresponder a un archivo recuperable de esta empresa.","INVALID_ACK")
  if(presented.some((record)=>(Array.isArray(record.payload.attachments)?record.payload.attachments:[]).some((attachment:unknown)=>object(attachment)&&attachment.type==="Acuse SAT"&&attachment.sha256===file.sha256)))throw new ApiError(400,"La corrección requiere un acuse nuevo; no se reutiliza el archivo de una presentación anterior.","ACK_REUSE_FORBIDDEN")
  return {...payload,schemaVersion:2,confirmedBy:input.actor.id,confirmedAt:input.at,preparedPackageId:`satpkg-${operationId}`,preparedPackageRevision:packageRow!.revision,
    preparedPackageSourceRevision:currentRow.revision}
}
