import type { CloudRecord, RecordMutation } from "./contracts"

const ARRAYS = new Set(["kyc_expedientes_detalle", "actividades_vulnerables_clientes", "actividades_vulnerables_operaciones", "pld-sat-output-packages", "pld-evidences-documents", "pld-evidences-logs", "auditoria-lineamientos", "auditoria-interna-registros", "auditoria-observaciones-autoridades", "auditoria-planes-accion", "pld-pep-internal-records", "pld-pep-search-history", "pld-import-history", "documents", "completedActivities"])
ARRAYS.add("pld-submissions-workflow")
ARRAYS.add("audit-reminders")
for (const suffix of ["registro", "expedientes", "evidencias"]) ARRAYS.add(`pld-import-history-${suffix}`)
const DICTIONARIES = new Set(["ebr_evaluaciones"])
export function collectionShape(key: string) { return ARRAYS.has(key) ? "array" : DICTIONARIES.has(key) ? "dictionary" : "singleton" }
function stableTextId(value: unknown) {
  const text = JSON.stringify(value)
  let hash = 2166136261
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return `legacy-${(hash >>> 0).toString(16)}-${text.length}`
}
export function encodeCollection(key: string, value: unknown): Map<string, unknown> {
  const shape = collectionShape(key)
  if (shape === "singleton") return new Map([["singleton", value]])
  if (shape === "dictionary") {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Formato inválido: ${key}`)
    return new Map(Object.entries(value))
  }
  if (!Array.isArray(value)) throw new Error(`La colección ${key} debe contener una lista.`)
  const entries = value.map((item): [string, unknown] => {
    const object = item && typeof item === "object" ? item as Record<string, unknown> : {}
    const id = (key === "kyc_expedientes_detalle" ? object.expedienteId || object.id : object.id || object.expedienteId) || object.rfc || stableTextId(item)
    return [String(id), item]
  })
  const result = new Map(entries)
  if (result.size !== entries.length) throw new Error(`Hay IDs duplicados en ${key}. No se guardó la colección.`)
  return result
}
export function decodeCollection(collection: string, records: readonly CloudRecord[]): unknown {
  const active = records.filter((r) => r.collection === collection && !r.deleted)
  if (collectionShape(collection) === "array") return active.map((r) => r.payload)
  if (collectionShape(collection) === "dictionary") return Object.fromEntries(active.map((r) => [r.id, r.payload]))
  return active.find((r) => r.id === "singleton")?.payload ?? null
}
export function diffCollection(collection: string, desired: Map<string, unknown>, stored: readonly CloudRecord[]): RecordMutation[] {
  const previous = new Map(stored.filter((r) => r.collection === collection).map((r) => [r.id, r]))
  const result: RecordMutation[] = []
  for (const [id, payload] of desired) {
    const old = previous.get(id)
    if (!old || old.deleted || JSON.stringify(payload) !== JSON.stringify(old.payload)) result.push({ collection, id, expectedRevision: old?.revision ?? 0, payload })
  }
  for (const [id, old] of previous) if (!old.deleted && !desired.has(id)) result.push({ collection, id, expectedRevision: old.revision, payload: old.payload, deleted: true })
  return result
}
