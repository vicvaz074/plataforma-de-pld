import { requireCompany } from "./access"
import { ApiError, type PilotActor, type PilotEnv } from "./types"

type Data=Record<string,unknown>
const object=(value:unknown):value is Data=>Boolean(value&&typeof value==="object"&&!Array.isArray(value))

/** A manual citation is retained, but only a scoped retrievable object is evidence. */
export async function prepareEbrEvidence(payload:Data,actor:PilotActor,companyId:string,env:PilotEnv,at:string,previous?:Data){
  const cache=new Map<string,Data>()
  const currentReview=object(payload.workflow)&&payload.workflow.status!=="draft"
  const resolve=async(value:unknown):Promise<Data|undefined>=>{
    if(value===undefined||value===null)return undefined
    if(!object(value)||typeof value.fileVersionId!=="string"||typeof value.sha256!=="string")throw new ApiError(400,"Selecciona una versión documental recuperable para la evidencia EBR.","INVALID_EBR_EVIDENCE")
    const cached=cache.get(value.fileVersionId)
    if(cached){if(cached.sha256!==value.sha256||value.documentId!==undefined&&cached.documentId!==value.documentId)throw new ApiError(400,"La referencia EBR no coincide con su versión documental.","INVALID_EBR_EVIDENCE");return cached}
    const file=await env.DB.prepare("SELECT v.id,v.documentId,v.sha256,v.objectKey,v.fileName,v.size,v.status,d.moduleKey FROM pld_file_versions v JOIN pld_documents d ON d.id=v.documentId WHERE v.id=? AND v.companyId=? AND d.companyId=v.companyId").bind(value.fileVersionId,companyId).first<{id:string;documentId:string;sha256:string;objectKey:string;fileName:string;size:number;status:string;moduleKey:string}>()
    if(!file||file.sha256!==value.sha256||value.documentId!==undefined&&value.documentId!==file.documentId)throw new ApiError(400,"La evidencia EBR no pertenece a esta empresa o tiene otro hash.","INVALID_EBR_EVIDENCE")
    await requireCompany(actor,companyId,env,file.moduleKey,"download")
    if(currentReview&&["rejected","archived"].includes(file.status))throw new ApiError(400,"La evidencia EBR está rechazada o archivada. Selecciona una versión vigente y revisable.","EBR_EVIDENCE_INACTIVE")
    const stored=await env.EVIDENCE_BUCKET.get(file.objectKey)
    if(!stored||stored.size!==file.size)throw new ApiError(400,"La versión de evidencia EBR no está recuperable; no puede sustentar la revisión.","EBR_EVIDENCE_MISSING")
    const reference={fileVersionId:file.id,documentId:file.documentId,sha256:file.sha256,downloadUrl:`/api/v1/companies/${encodeURIComponent(companyId)}/files/${file.id}`,fileName:file.fileName}
    cache.set(file.id,reference);return reference
  }
  const controls=Array.isArray(payload.controls)?payload.controls:[],factors=Array.isArray(payload.institutionalFactors)?payload.institutionalFactors:[]
  const plan=object(payload.reviewPlan)?payload.reviewPlan:undefined,actions=plan&&Array.isArray(plan.actions)?plan.actions:[]
  if(controls.length>50||factors.length>4||actions.length>100)throw new ApiError(400,"La evaluación excede el límite de controles, factores o acciones.","ASSESSMENT_LIMIT")
  const nextControls=[]
  for(const raw of controls){if(!object(raw))throw new ApiError(400,"Control EBR no válido.","INVALID_ASSESSMENT");const evidence=await resolve(raw.evidence);nextControls.push({...raw,evidence,...(evidence?{evidenceId:evidence.fileVersionId}:{}),...(evidence&&raw.effectiveness!=="unknown"?{reviewedBy:actor.id,reviewedAt:at}:{})})}
  const nextFactors=[]
  for(const raw of factors){if(!object(raw))throw new ApiError(400,"Factor institucional no válido.","INVALID_ASSESSMENT");const evidence=await resolve(raw.evidence);nextFactors.push({...raw,evidence,...(evidence?{evidenceId:evidence.fileVersionId}:{})})}
  const nextActions=[]
  for(const raw of actions){if(!object(raw))throw new ApiError(400,"Acción de seguimiento no válida.","INVALID_ASSESSMENT");const evidence=await resolve(raw.evidence);nextActions.push({...raw,evidence,...(evidence?{evidenceId:evidence.fileVersionId}:{})})}
  const sources=Array.isArray(payload.sources)?payload.sources:[],oldSources=previous&&!previous.needsMigrationReview&&Array.isArray(previous.sources)?previous.sources:[]
  if(sources.length>100)throw new ApiError(400,"La evaluación excede el límite de fuentes.","ASSESSMENT_LIMIT")
  const recordedSources=sources.map((source)=>{
    if(!object(source))throw new ApiError(400,"Fuente EBR no válida.","INVALID_ASSESSMENT")
    const old=oldSources.find((item)=>object(item)&&item.id===source.id&&item.label===source.label&&item.sourceUrl===source.sourceUrl&&item.consultedAt===source.consultedAt)
    return {...source,recordedBy:object(old)&&typeof old.recordedBy==="string"?old.recordedBy:actor.id,recordedAt:object(old)&&typeof old.recordedAt==="string"?old.recordedAt:at}
  })
  return {...payload,controls:nextControls,institutionalFactors:nextFactors,sources:recordedSources,...(plan?{reviewPlan:{...plan,actions:nextActions}}:{})}
}
