import { activeStoredPldOperations, loadStoredPldOperations } from "./stored-operations"
import { getIntegrationClient, type IntegrationStorage } from "./integration-records"
import { validateGeneratedSatXml } from "./sat-xml-validation"

type RecordValue = Record<string, any>
const record = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {}
const array = (value: unknown): RecordValue[] => Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : []

export function parseStoredObject(raw: string | null): RecordValue {
  if (!raw) return {}
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("El registro local no contiene un objeto válido; no se sobrescribió.")
  return parsed as RecordValue
}

export function parseStoredArray(raw: string | null): RecordValue[] {
  if (!raw) return []
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed) || parsed.some((item) => !item || typeof item !== "object" || Array.isArray(item))) throw new Error("La colección local no es válida; no se sobrescribió.")
  return parsed
}

/** Count a collection, not its metadata or its enclosing keyed map. */
export function countStoredRecords(value: unknown, collectionKeys: string[] = []): number {
  if (Array.isArray(value)) return value.length
  const data = record(value)
  for (const key of collectionKeys) {
    if (Array.isArray(data[key])) return data[key].length
    if (data[key] && typeof data[key] === "object") return countStoredRecords(data[key])
  }
  const entries = Object.entries(data).filter(([key]) => !["schemaVersion", "version", "updatedAt", "createdAt"].includes(key))
  if (!entries.length) return 0
  if (data.id || data.rfc || data.identificacion?.rfc) return 1
  if (entries.every(([, entry]) => entry && typeof entry === "object" && !Array.isArray(entry))) return entries.length
  return 0
}

export function readActiveModuleOperations(storage: IntegrationStorage) {
  return activeStoredPldOperations(loadStoredPldOperations(storage, { persistMigration: false }).operations)
}

export function readGovernanceIntegrationSnapshot(storage: IntegrationStorage) {
  const read = (key: string) => { try { return JSON.parse(storage.getItem(key) || "null") } catch { return null } }
  const training = read("pld-training-module") ?? read("capacitacion-control-data")
  const audits = read("auditoria-interna-registros")
  const evidence = read("pld-evidences-documents") ?? read("evidencias-trazabilidad-data")?.documentos
  return {
    capacitacionDocuments: countStoredRecords(training?.documents ?? training?.documentos),
    auditoriaHallazgos: array(audits).filter((item) => typeof item.findings === "string" && item.findings.trim()).length,
    monitoreoAlertas: readActiveModuleOperations(storage).filter((item) => item.alerta && !item.alertaResuelta).length,
    evidenciasResguardadas: array(evidence).filter((item) => !item.archived).length,
  }
}

/** A validation applies only to the exact reviewed payload; changes require review again. */
export function reviewSignature(value: unknown): string {
  const stable = (item: unknown): unknown => {
    if (item instanceof Date) return item.toISOString()
    if (Array.isArray(item)) return item.map(stable)
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => [key, stable(val)]))
    return item
  }
  return JSON.stringify(stable(value))
}

export function restoreAuditWorkflow(raw: RecordValue, defaults: {
  responses: RecordValue; scopeAnswers: RecordValue; reviewAnswers: RecordValue; finalChecklist?: Record<string, boolean>
}) {
  const responses = Object.fromEntries(Object.entries(defaults.responses).map(([id, fallback]) => {
    const saved = record(record(raw.responses)[id])
    return [id, {
      ...fallback,
      answer: ["si", "no", "na", ""].includes(saved.answer) ? saved.answer : fallback.answer,
      evidences: array(saved.evidences).flatMap((evidence) => {
        const uploadedAt = new Date(evidence.uploadedAt)
        return evidence.id && typeof evidence.url === "string" && Number.isFinite(uploadedAt.getTime()) ? [{ ...evidence, uploadedAt, url: /^(?:data:|\/api\/)/.test(evidence.url) ? evidence.url : "" }] : []
      }),
    }]
  }))
  const scopeAnswers = Object.fromEntries(Object.entries(defaults.scopeAnswers).map(([id, fallback]) => [id, ["si", "no", "na"].includes(raw.scopeAnswers?.[id]) ? raw.scopeAnswers[id] : fallback]))
  const reviewAnswers = Object.fromEntries(Object.entries(defaults.reviewAnswers).map(([id, fallback]) => {
    const saved = record(record(raw.reviewAnswers)[id])
    return [id, { ...fallback, rating: ["cumple", "cumple-mayor", "cumple-parcial", "no-cumple", "no-aplica", ""].includes(saved.rating) ? saved.rating : "", findings: typeof saved.findings === "string" ? saved.findings : "", recommendations: typeof saved.recommendations === "string" ? saved.recommendations : "" }]
  }))
  // Version 1 computed these flags from unrelated records; they were not confirmations.
  const historicalChecklist = raw.schemaVersion >= 2
    ? Object.fromEntries(Object.entries(record(raw.finalChecklist)).filter(([, value]) => typeof value === "boolean"))
    : {}
  const finalChecklist = { ...historicalChecklist, ...Object.fromEntries(Object.entries(defaults.finalChecklist || {}).map(([id, fallback]) => [id, raw.schemaVersion >= 2 && typeof raw.finalChecklist?.[id] === "boolean" ? raw.finalChecklist[id] : fallback])) }
  return { responses, scopeAnswers, reviewAnswers, finalChecklist, scopeExclusions: typeof raw.scopeExclusions === "string" ? raw.scopeExclusions : "" }
}

export interface EvidenceSourceReference {
  storageKey: string
  recordId: string
  kind: "record" | "operation-document" | "sat-xml" | "audit-file"
  documentId?: string
}

interface MergeableEvidence {
  id: string; source?: string; sourceId?: string; fileData?: string; fileName: string; fileSize: number; fileType: string
  sha256?: string; reviewStatus?: "pending" | "approved" | "rejected"; reviewNote?: string; reviewedHash?: string; reviewedAt?: string;
  sourceRevision?: string; sourceReference?: EvidenceSourceReference; sourceOverride?: boolean; version: number; versionHistory: { version: number; timestamp: string; user: string; changeNote: string; fileData?: string; fileName?: string; fileSize?: number; fileType?: string; sha256?: string; sourceReference?: EvidenceSourceReference }[]
  archived: boolean; notes?: string; uploadDate: string; documentDate: string; user: string
}

/** Never infer deletions or reset a local archive/history when a source refreshes. */
export function mergeExternalEvidence<T extends MergeableEvidence>(previous: T[], incoming: T[], now: string): T[] {
  const result = [...previous]
  for (const item of incoming) {
    const index = result.findIndex((old) => old.source === item.source && old.sourceId === item.sourceId)
    if (index < 0) { result.push(item); continue }
    const old = result[index]
    if (old.sourceOverride) continue
    const sameHash = Boolean(old.sha256 && item.sha256 && old.sha256 === item.sha256)
    const changed = (!sameHash && old.fileData !== item.fileData) || ["fileName", "fileSize", "fileType", "sourceRevision", "sha256"].some((key) => old[key as keyof T] !== item[key as keyof T])
    result[index] = {
      ...old, ...item,
      id: old.id, archived: old.archived || item.archived, notes: old.notes ?? item.notes,
      uploadDate: changed ? item.uploadDate : old.uploadDate,
      documentDate: changed ? item.documentDate : old.documentDate,
      version: old.version + (changed ? 1 : 0),
      versionHistory: changed ? [{ version: old.version, timestamp: old.uploadDate || now, user: old.user, changeNote: "Actualización en el módulo de origen", fileData: old.fileData, fileName: old.fileName, fileSize: old.fileSize, fileType: old.fileType, sha256: old.sha256, sourceReference: old.sourceReference }, ...old.versionHistory] : old.versionHistory,
      reviewStatus: changed ? "pending" : old.reviewStatus, reviewNote: changed ? undefined : old.reviewNote,
      reviewedHash: changed ? undefined : old.reviewedHash, reviewedAt: changed ? undefined : old.reviewedAt,
    }
  }
  return result
}

/** Metadata links only: source records are not treated as uploaded identification documents. */
export function buildOperationalEvidenceLinks(storage: IntegrationStorage, now: string) {
  const read = (key: string) => { try { return parseStoredArray(storage.getItem(key)) } catch { return [] } }
  const base = (source: "kyc" | "actos" | "sat", sourceId: string, expedienteId: string, date: unknown) => ({
    id: `${source}-${sourceId}`, source, sourceId, expedienteId,
    uploadDate: typeof date === "string" && Number.isFinite(Date.parse(date)) ? date : now,
    documentDate: typeof date === "string" && Number.isFinite(Date.parse(date)) ? date : now,
    user: "Módulo de origen", fileSize: 0, fileType: "application/json", version: 1, versionHistory: [], archived: false,
  })
  const expedientes = read("kyc_expedientes_detalle").flatMap((entry) => {
    const client = getIntegrationClient(entry)
    if (!client) return []
    return [{ ...base("kyc", client.id, client.id, entry.actualizadoEn), module: "kyc" as const, submodule: "Registro vinculado", documentType: "registro-expediente", title: `Expediente: ${client.nombre}`, fileName: `expediente-${client.id}.json`, sourceRevision: entry.actualizadoEn || "", sourceReference: { storageKey: "kyc_expedientes_detalle", recordId: client.id, kind: "record" as const } }]
  })
  const operations = read("actividades_vulnerables_operaciones")
  const support = operations.flatMap((operation) => array(operation.documentosSoporte).filter((doc) => doc.id && doc.archivoContenido).map((doc) => ({
    ...base("actos", `${operation.id}-${doc.id}`, operation.expedienteId || operation.expedienteReferenciado || operation.id, doc.fechaRegistro),
    module: "monitoreo" as const, submodule: "Soporte de operación", documentType: "soporte-operacion", title: doc.requisito || doc.archivoNombre,
    fileName: doc.archivoNombre || "soporte", sourceRevision: `${operation.revision || 1}:${doc.fechaRegistro || ""}`,
    sourceReference: { storageKey: "actividades_vulnerables_operaciones", recordId: operation.id, documentId: doc.id, kind: "operation-document" as const },
  })))
  const packages = read("pld-sat-output-packages").filter((entry) => entry.id && entry.xml).map((entry) => {
    const operation = operations.find((item) => item.id === entry.sourceOperationId)
    return {
      ...base("sat", entry.id, operation?.expedienteId || operation?.expedienteReferenciado || entry.sourceOperationId || entry.id, entry.updatedAt || entry.createdAt),
      module: "reportes" as const, submodule: "Paquete SAT preparado", documentType: "paquete-sat-preparado", title: entry.label || "Paquete SAT (no acredita presentación)",
      fileName: entry.xmlFileName || `${entry.id}.xml`, fileType: "application/xml", sourceRevision: `${entry.sourceOperationRevision || 1}:${entry.updatedAt || entry.createdAt || ""}`,
      sourceReference: { storageKey: "pld-sat-output-packages", recordId: entry.id, kind: "sat-xml" as const },
    }
  })
  return [...expedientes, ...support, ...packages]
}

/** Audit's persisted questionnaire owns actual file bytes/references, not just
 * its audit-register rows. Keep the exact private object and attachment ID. */
export function buildAuditEvidenceLinks(storage:IntegrationStorage,now:string){
  let workflow:RecordValue
  try{workflow=parseStoredObject(storage.getItem("auditoria-verificacion-workflow"))}catch{return []}
  return Object.entries(record(workflow.responses)).flatMap(([questionId,response])=>array(record(response).evidences).flatMap(file=>{
    if(typeof file.id!=="string"||typeof file.url!=="string"||!/^(?:data:|\/api\/)/.test(file.url))return []
    const uploadedAt=typeof file.uploadedAt==="string"&&Number.isFinite(Date.parse(file.uploadedAt))?file.uploadedAt:now
    const documentDate=typeof file.documentDate==="string"&&/^\d{4}-\d{2}-\d{2}/.test(file.documentDate)?file.documentDate:uploadedAt.slice(0,10)
    return [{id:`auditoria-${questionId}-${file.id}`,source:"auditoria" as const,sourceId:`${questionId}-${file.id}`,expedienteId:`auditoria:${questionId}`,
      module:"auditoria" as const,submodule:questionId.startsWith("lineamientos")?"Lineamientos internos":"Revisión y controles",documentType:"evidencia-control-auditoria",
      title:file.fileName||"Evidencia de auditoría",uploadDate:uploadedAt,documentDate,user:file.uploadedBy||"Auditoría · autor en bitácora de origen",
      fileName:file.fileName||"evidencia",fileSize:Number(file.fileSize)||0,fileType:file.fileType||"application/octet-stream",fileData:file.url,
      sha256:typeof file.sha256==="string"?file.sha256:undefined,version:1,versionHistory:[],archived:file.archived===true,
      sourceReference:{storageKey:"auditoria-verificacion-workflow",recordId:questionId,documentId:file.id,kind:"audit-file" as const}}]
  }))
}

export function resolveEvidenceSource(storage: IntegrationStorage, reference: EvidenceSourceReference): string | undefined {
  if(reference.kind==="audit-file"){
    const source=parseStoredObject(storage.getItem(reference.storageKey))
    const file=array(record(record(source.responses)[reference.recordId]).evidences).find(item=>item.id===reference.documentId)
    return typeof file?.url==="string"&&/^(?:data:|\/api\/)/.test(file.url)?file.url:undefined
  }
  const records = parseStoredArray(storage.getItem(reference.storageKey))
  const source = records.find((entry) => entry.id === reference.recordId || getIntegrationClient(entry)?.id === reference.recordId)
  if (!source) return undefined
  if (reference.kind === "sat-xml") {
    if (typeof source.xml !== "string" || source.validation?.status !== "listo" || !validateGeneratedSatXml(source.xml).valid) return undefined
    return `data:application/xml;charset=utf-8,${encodeURIComponent(source.xml)}`
  }
  if (reference.kind === "operation-document") return array(source.documentosSoporte).find((item) => item.id === reference.documentId)?.archivoContenido
  return `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(source, null, 2))}`
}
