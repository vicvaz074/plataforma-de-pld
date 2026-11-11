import { requireCompany } from "./access"
import { ApiError, type PilotActor, type PilotEnv } from "./types"
import { getPrivateDocumentReference } from "../lib/pld/document-links"
import { beneficiaryReviewSignature } from "../lib/pld/beneficiary-review"
import { reviewSignature } from "../lib/pld/module-continuity"
import { assertPepInternalRecord, assertPepSearchResponse, assertTrainingState } from "../lib/pld/record-shapes"

type Data = Record<string, unknown>
const object = (value: unknown): value is Data => Boolean(value && typeof value === "object" && !Array.isArray(value))
const same = (a: unknown,b: unknown) => reviewSignature(a) === reviewSignature(b)
function rows(value: unknown, label: string): Data[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some(item => !object(item) || typeof item.id !== "string" || !item.id)) throw new ApiError(400,`La colección ${label} no es válida.`,"INVALID_RECORD_SHAPE")
  if (new Set(value.map(item => item.id)).size !== value.length) throw new ApiError(400,`Hay identidades duplicadas en ${label}.`,"INVALID_RECORD_SHAPE")
  return value
}
function without(value: Data, keys: string[]) { return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key))) }

export function validateStructuredRecord(collection: string, payload: unknown) {
  try {
    if (collection === "pld-pep-search-history") assertPepSearchResponse(payload)
    if (collection === "pld-pep-internal-records") assertPepInternalRecord(payload)
    if (collection === "pld-training-module") assertTrainingState(payload)
    if (["beneficiario-controlador-data","gobernanza-control-data"].includes(collection) && !object(payload)) throw new Error("El módulo debe contener un objeto válido.")
    if (collection === "gobernanza-control-data" && object(payload) && payload.expedienteCerrado !== undefined && typeof payload.expedienteCerrado !== "boolean") throw new Error("El cierre de Gobernanza debe ser un valor booleano.")
  } catch (error) { throw new ApiError(400,error instanceof Error ? error.message : "El registro no es válido.","INVALID_RECORD_SHAPE") }
}

/** Only actual file fields are links: normative sourceUrl and free text remain text. */
export function validateDocumentReferences(collection: string, payload: unknown, companyId: string, origin: string) {
  const fields = new Set(["dataUrl","fileData","base64","downloadUrl","file","archivoContenido"])
  const walk = (value: unknown, path: string[]) => {
    if (Array.isArray(value)) { for (const item of value) walk(item,path); return }
    if (!object(value)) return
    for (const [key,item] of Object.entries(value)) {
      const documentUrl = key === "url" && path.some(part => /^(?:attachments|documentos|documents|evidences|evidencias|versionHistory)$/.test(part))
      if (fields.has(key) || documentUrl) {
        if (item !== undefined && item !== null && item !== "" && !getPrivateDocumentReference(item,companyId,origin)) throw new ApiError(400,`La referencia documental ${[...path,key].join(".")} debe ser un archivo privado de esta empresa.`,"INVALID_DOCUMENT_REFERENCE")
      } else walk(item,[...path,key])
    }
  }
  walk(payload,[])
}

/** Existing history entries are immutable; only new entries get server identity. */
function history(next: unknown, prior: unknown, actor: PilotActor, at: string, label: string) {
  const old = rows(prior,label), incoming = rows(next,label), ids = new Set(old.map(item => item.id))
  return [...incoming.filter(item => !ids.has(item.id)).map(item => ({...item,user:actor.name,actorId:actor.id,timestamp:at,...("date" in item?{date:at}: {}),...("uploadedAt" in item?{uploadedAt:at}: {})})),...old]
}
async function reviewedFile(doc: Data, urlKey: string, hashKey: string, actor: PilotActor, companyId: string, env: PilotEnv) {
  const reference = getPrivateDocumentReference(doc[urlKey],companyId,env.BETTER_AUTH_URL)
  if (!reference || typeof doc[hashKey] !== "string") throw new ApiError(400,"La revisión requiere una versión privada y su hash.","INVALID_DOCUMENT_REVIEW")
  const file = await env.DB.prepare("SELECT v.sha256,v.objectKey,v.size,v.status,d.moduleKey FROM pld_file_versions v JOIN pld_documents d ON d.id=v.documentId WHERE v.id=? AND v.companyId=? AND d.companyId=v.companyId").bind(reference.versionId,companyId).first<{sha256:string;objectKey:string;size:number;status:string;moduleKey:string}>()
  if (!file || file.sha256 !== doc[hashKey] || ["archived","rejected"].includes(file.status)) throw new ApiError(400,"El archivo revisado no pertenece a esta empresa, cambió de hash o está inactivo.","INVALID_DOCUMENT_REVIEW")
  await requireCompany(actor,companyId,env,file.moduleKey,"download")
  const stored = await env.EVIDENCE_BUCKET.get(file.objectKey)
  if (!stored || stored.size !== file.size) throw new ApiError(400,"La revisión requiere un archivo recuperable en el repositorio.","INVALID_DOCUMENT_REVIEW")
  return {fileVersionId:reference.versionId,sha256:file.sha256}
}
async function documents(next: unknown, prior: unknown, module: string, actor: PilotActor, companyId: string, env: PilotEnv, at: string, governance = false) {
  const incoming = rows(next,"documentos"), old = rows(prior,"documentos"), result: Data[] = []
  for (const doc of incoming) {
    const previous = old.find(item => item.id === doc.id)
    if (Boolean(doc.archived) !== Boolean(previous?.archived)) await requireCompany(actor,companyId,env,module,"archive")
    let canonical = {...doc}
    if (governance) {
      const reviewKeys = ["signedBy","signedById","signedAt","reviewedFile"]
      const changed = previous && !same(without(doc,reviewKeys),without(previous,reviewKeys))
      const carriesReview = previous && doc.signedBy === previous.signedBy && doc.signedAt === previous.signedAt
      if (changed && carriesReview || !doc.signedBy && !doc.signedAt) for (const key of reviewKeys) delete canonical[key]
      else if (carriesReview) canonical = {...canonical,...Object.fromEntries(reviewKeys.map(key => [key,previous[key]]))}
      else {
        await requireCompany(actor,companyId,env,module,"approve")
        const file = await reviewedFile(doc,"base64","hash",actor,companyId,env)
        canonical = {...canonical,signedBy:actor.name,signedById:actor.id,signedAt:at,reviewedFile:file}
      }
      if (previous?.signedAt && !doc.signedAt && !changed) await requireCompany(actor,companyId,env,module,"approve")
    }
    result.push(canonical)
  }
  for (const previous of old) if (!incoming.some(doc => doc.id === previous.id)) {
    await requireCompany(actor,companyId,env,module,"archive")
    result.push({...previous,archived:true,...(governance?{signedBy:undefined,signedById:undefined,signedAt:undefined,reviewedFile:undefined}:{})})
  }
  return result
}

export async function secureRecordState(collection: string, payload: Data, previous: Data, actor: PilotActor, companyId: string, env: PilotEnv, at: string): Promise<Data> {
  if (collection === "beneficiario-controlador-data") {
    const profiles = payload.profiles === undefined ? undefined : payload.profiles
    if (profiles !== undefined && !object(profiles)) throw new ApiError(400,"Los perfiles de beneficiario controlador no son válidos.","INVALID_RECORD_SHAPE")
    if (object(previous.profiles) && !object(profiles)) throw new ApiError(400,"Conserva los perfiles históricos del expediente.","PROFILE_HISTORY_REQUIRED")
    const secureProfile = async (raw: unknown, prior: unknown): Promise<Data> => {
      if (!object(raw)) throw new ApiError(400,"Perfil de beneficiario controlador no válido.","INVALID_RECORD_SHAPE")
      const old = object(prior)?prior:{}
      const next = {...raw,documentos:await documents(raw.documentos,old.documentos,"beneficiario",actor,companyId,env,at),trazabilidad:history(raw.trazabilidad,old.trazabilidad,actor,at,"trazabilidad"),declaraciones:history(raw.declaraciones,old.declaraciones,actor,at,"declaraciones")}
      const signature = beneficiaryReviewSignature(next), oldSignature = beneficiaryReviewSignature(old)
      const validation = object(raw.validation)?raw.validation:undefined
      if (raw.validation !== undefined && raw.validation !== null && !validation) throw new ApiError(400,"La validación no es válida.","INVALID_RECORD_SHAPE")
      const carriesReview = validation && object(old.validation) && validation.signature === old.validation.signature && validation.validatedAt === old.validation.validatedAt
      if (!validation || carriesReview && signature !== oldSignature) return {...next,validation:null}
      if (carriesReview && signature === oldSignature) return {...next,validation:old.validation}
      await requireCompany(actor,companyId,env,"beneficiario","approve")
      if (validation.signature !== signature) throw new ApiError(400,"El contenido cambió desde la revisión; confirma la versión actual.","INVALID_DOCUMENT_REVIEW")
      const reviewedFiles = []
      for (const doc of next.documentos) if (!doc.archived) reviewedFiles.push(await reviewedFile(doc,"url","sha256",actor,companyId,env))
      return {...next,validation:{signature,validatedAt:at,validatedBy:actor.id,validatedByName:actor.name,reviewedFiles}}
    }
    if (object(profiles)) {
      const prior = object(previous.profiles)?previous.profiles:{}
      for (const key of Object.keys(prior)) if (!(key in profiles)) throw new ApiError(400,"Conserva los perfiles históricos; archiva sus documentos sin eliminar el expediente.","PROFILE_HISTORY_REQUIRED")
      return {...payload,profiles:Object.fromEntries(await Promise.all(Object.entries(profiles).map(async ([id,profile]) => [id,await secureProfile(profile,prior[id])])))}
    }
    return secureProfile(payload,previous)
  }
  if (collection === "gobernanza-control-data" || collection === "pld-training-module") {
    const governance = collection === "gobernanza-control-data", module = governance?"gobernanza":"capacitacion", closure = governance?"expedienteCerrado":"moduleClosed", traceKey = governance?"trace":"traceability"
    const next = {...payload,[traceKey]:history(payload[traceKey],previous[traceKey],actor,at,traceKey)}
    if (governance) {
      next.documents = await documents(payload.documents,previous.documents,module,actor,companyId,env,at,true)
      next.manualVersions = history(payload.manualVersions,previous.manualVersions,actor,at,"manualVersions")
    }
    const changed = !same(without(next,[closure,traceKey,"closedAt","closedBy","closedByName"]),without(previous,[closure,traceKey,"closedAt","closedBy","closedByName"]))
    if (previous[closure] === true && changed) return {...next,[closure]:false,closedAt:undefined,closedBy:undefined,closedByName:undefined}
    if ((next[closure] === true) !== (previous[closure] === true)) await requireCompany(actor,companyId,env,module,"approve")
    if (next[closure] === true && previous[closure] !== true) {
      for (const doc of rows(next.documents,"documentos")) if (!doc.archived) await reviewedFile(doc,governance?"base64":"dataUrl",governance?"hash":"sha256",actor,companyId,env)
      return {...next,closedAt:at,closedBy:actor.id,closedByName:actor.name}
    }
    return {...next,...(next[closure]===true?{closedAt:previous.closedAt,closedBy:previous.closedBy,closedByName:previous.closedByName}:{closedAt:undefined,closedBy:undefined,closedByName:undefined})}
  }
  if (collection === "pld-pep-internal-records") {
    if (previous.id && same(without(payload,["decidedAt","decidedBy","decidedById"]),without(previous,["decidedAt","decidedBy","decidedById"]))) return {...payload,decidedBy:previous.decidedBy,decidedById:previous.decidedById,decidedAt:previous.decidedAt}
    return {...payload,decidedBy:actor.name,decidedById:actor.id,decidedAt:at}
  }
  return payload
}
