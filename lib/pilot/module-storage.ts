import { pilotApi, jsonRequest } from "./api"
import { COLLECTION_MODULES, sessionCan, type CloudRecord, type Company, type ModuleKey, type PilotSession } from "./contracts"
import { decodeCollection, diffCollection, encodeCollection } from "./record-codecs"

export type SaveState = { status: "saved" | "saving" | "error"; pending: number; message?: string; warnings?: string[] }
let session: PilotSession | null = null
let company: Company | null = null
let connected = false
let cache = new Map<string, string>()
let records: CloudRecord[] = []
let pending = new Map<string, string | null>()
let running: Promise<void> | null = null
let lastError: Error | null = null
let state: SaveState = { status: "saved", pending: 0 }
const listeners = new Set<() => void>()
const preferences = new Map<string, string>()
const uploaded = new Map<string, string>()
const companyNotices = new Map<string, string[]>()
let loadEpoch = 0

export function getPilotSession() { return session }
export function getActiveCompany() { return company }
export function getCompanyRecordRevision(collection: string, id: string) { return records.find((record) => record.collection === collection && record.id === id && !record.deleted)?.revision }
export function isCloudConnected() { return connected }
export function canWriteModuleStorage(key: string) { return !connected ? process.env.NEXT_PUBLIC_PLD_MODE === "demo" : Boolean(COLLECTION_MODULES[key] && sessionCan(session, company, COLLECTION_MODULES[key], "edit")) }
export function getSaveState() { return state }
export function subscribeSaveState(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
function publish(next: SaveState) { state = { ...next, warnings: company ? companyNotices.get(company.id) : undefined }; listeners.forEach((listener) => listener()) }
export function dismissStorageNotices() { if (company) companyNotices.delete(company.id); publish({ ...state, warnings: undefined }) }
export function configurePilotSession(value: PilotSession | null) { session = value }

export function getPendingModuleChanges() { return { companyId: company?.id, exportedAt: new Date().toISOString(), collections: Object.fromEntries([...pending].map(([key, value]) => [key, value === null ? null : JSON.parse(value)])) } }
export async function loadCompanyStorage(nextCompany: Company, options: { discardUnsaved?: boolean } = {}) {
  const epoch = ++loadEpoch
  if (options.discardUnsaved && running) throw new Error("Espera a que termine la solicitud actual.")
  if (!options.discardUnsaved) await flushModuleStorage()
  const snapshotPath = nextCompany.id.startsWith("inbox:") ? `/organizations/${encodeURIComponent(nextCompany.organizationId)}/inbox` : `/companies/${encodeURIComponent(nextCompany.id)}/snapshot`
  const result = await pilotApi<{ records: CloudRecord[] }>(snapshotPath)
  if (epoch !== loadEpoch) throw new DOMException("Se abrió otra empresa durante la solicitud.", "AbortError")
  company = nextCompany; connected = true; records = result.records
  cache = new Map(); pending = new Map(); uploaded.clear(); lastError = null
  for (const key of Object.keys(COLLECTION_MODULES)) {
    if (!result.records.some((r) => r.collection === key && !r.deleted)) continue
    cache.set(key, JSON.stringify(decodeCollection(key, records)))
  }
  if (!cache.has("pld-tenants")) cache.set("pld-tenants", JSON.stringify({ schemaVersion: 1, activeTenantId: nextCompany.id, tenants: [{ id: nextCompany.id, schemaVersion: 1, rfc: nextCompany.rfc, razonSocial: nextCompany.name, nombreComercial: nextCompany.name, representanteCumplimiento: { nombre: "", cargo: "", email: "" }, responsablesInternos: [], actividades: [], manual: {}, ebr: {}, policies: { conservaAnios: 10, noGuardarEfirma: true, requiereCotejo: true } }] }))
  publish({ status: "saved", pending: 0 })
}
export function resetCompanyStorage() {
  if (pending.size || running) throw new Error("Espera a que se guarden los cambios antes de salir.")
  loadEpoch++; company = null; session = null; connected = false; cache.clear(); records = []; uploaded.clear(); companyNotices.clear(); lastError = null
  publish({ status: "saved", pending: 0 })
}

export async function uploadPilotFile(file: File, moduleKey: ModuleKey, documentId?: string, expectedRevision?: number) {
  if (!connected || !company) throw new Error("Selecciona una empresa conectada para guardar el archivo.")
  const body = new FormData(); body.set("file", file); body.set("moduleKey", moduleKey)
  if (documentId) body.set("documentId", documentId)
  if (expectedRevision !== undefined) body.set("expectedRevision", String(expectedRevision))
  return pilotApi<{ id: string; documentId: string; version: number; sha256: string; downloadUrl: string; fileName: string }>(`/companies/${encodeURIComponent(company.id)}/files`, { method: "POST", body })
}

async function externalize(value: unknown, moduleKey: ModuleKey, fileName?: string): Promise<unknown> {
  if (typeof value === "string" && /^data:[^,]*,/i.test(value)) {
    const uploadKey = `${moduleKey}\u0000${value}`
    const existing = uploaded.get(uploadKey)
    if (existing) return existing
    const blob = await (await fetch(value)).blob()
    const extensions: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "application/xml": "xml", "text/xml": "xml", "application/json": "json", "text/plain": "txt", "text/csv": "csv", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx", "application/vnd.ms-excel.sheet.macroenabled.12": "xlsm" }
    const result = await uploadPilotFile(new File([blob], fileName || `evidencia.${extensions[blob.type.split(";")[0].toLowerCase()] || "bin"}`, { type: blob.type }), moduleKey)
    uploaded.set(uploadKey, result.downloadUrl)
    return result.downloadUrl
  }
  if (Array.isArray(value)) { const next = []; for (const item of value) next.push(await externalize(item, moduleKey)); return next }
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {}
    const object = value as Record<string, unknown>
    const name = [object.fileName, object.archivoNombre, object.name].find((item) => typeof item === "string" && /\.[a-z0-9]{2,8}$/i.test(item)) as string | undefined
    for (const [key, item] of Object.entries(value)) next[key] = await externalize(item, moduleKey, name)
    return next
  }
  return value
}

async function drain() {
  while (pending.size && company) {
    const batch = [...pending.entries()]
    publish({ status: "saving", pending: batch.length })
    // Coalesce synchronous changes from a moduleKey into one atomic server batch.
    const mutations = []
    for (const [collection, raw] of batch) {
      const moduleKey = COLLECTION_MODULES[collection]
      const parsed = raw === null ? null : JSON.parse(raw)
      const desired = raw === null ? new Map<string, unknown>() : encodeCollection(collection, await externalize(parsed, moduleKey))
      mutations.push(...diffCollection(collection, desired, records))
    }
    const changedCollections = new Set<string>()
    if (mutations.length) {
      const batchPath = company.id.startsWith("inbox:") ? `/organizations/${encodeURIComponent(company.organizationId)}/inbox/records/batch` : `/companies/${encodeURIComponent(company.id)}/records/batch`
      // The API caps atomic batches. A large migration/import is persisted in
      // bounded chunks; each result advances revisions before the next chunk.
      for (let offset = 0; offset < mutations.length; offset += 100) {
        const result = await pilotApi<{ records: CloudRecord[]; warnings?: Array<{ message?: string; operationIds?: string[] }> }>(batchPath, jsonRequest("POST", { mutations: mutations.slice(offset, offset + 100) }))
        for (const warning of result.warnings || []) if (warning.message) companyNotices.set(company.id, [...new Set([...(companyNotices.get(company.id) || []), `${warning.message}${warning.operationIds?.length ? ` (${warning.operationIds.length} operaciones)` : ""}`])])
        const changed = new Map(result.records.map((r) => [`${r.collection}\u0000${r.id}`, r]))
        records = [...records.filter((r) => !changed.has(`${r.collection}\u0000${r.id}`)), ...result.records]
        result.records.forEach((record) => changedCollections.add(record.collection))
      }
    }
    // Server-derived packages and recalculations also update the shared view,
    // without overwriting edits queued while this request was in flight.
    for (const key of changedCollections) {
      if (pending.has(key)) continue
      const value = decodeCollection(key, records)
      if (value === null) cache.delete(key)
      else cache.set(key, JSON.stringify(value))
    }
    for (const [key, raw] of batch) {
      if (pending.get(key) !== raw) continue
      pending.delete(key)
      const value = decodeCollection(key, records)
      if (value === null) cache.delete(key)
      else cache.set(key, JSON.stringify(value))
    }
    publish({ status: pending.size ? "saving" : "saved", pending: pending.size })
    if (typeof window !== "undefined") for (const key of changedCollections) window.dispatchEvent(new CustomEvent("pld-integration-change", { detail: { key } }))
  }
}
function schedule() {
  if (running || lastError) return
  running = Promise.resolve().then(drain).catch((error: unknown) => {
    lastError = error instanceof Error ? error : new Error("No se guardaron los cambios.")
    publish({ status: "error", pending: pending.size, message: lastError.message })
  }).finally(() => { running = null; if (pending.size && !lastError) schedule() })
}
export async function flushModuleStorage() {
  if (!connected) return
  schedule()
  while (running) await running
  if (lastError) throw lastError
}
export async function retryModuleStorage() { lastError = null; schedule(); await flushModuleStorage() }

const companyStorage: Storage = {
  get length() { return cache.size },
  key(index) { return [...cache.keys()][index] ?? null },
  getItem(key) {
    if (key === "userName") return session?.user.name ?? null
    if (key === "userEmail") return session?.user.email ?? null
    if (key === "userRole") return session?.user.platformRole === "superadmin" ? "admin" : session?.memberships.some((m) => m.role === "admin") ? "admin" : "user"
    if (key === "pld-active-tenant-id") return company ? JSON.stringify(company.id) : null
    return cache.get(key) ?? preferences.get(key) ?? null
  },
  setItem(key, value) {
    const moduleKey = COLLECTION_MODULES[key]
    if (!moduleKey) { if (/^(?:postal|cp-|sat-cp|codigo-postal|sepomex)/.test(key)) { preferences.set(key, value); return } throw new Error(`La colección ${key} no está habilitada para guardar en la empresa.`) }
    if (!sessionCan(session, company, moduleKey, "edit")) throw new Error("Tu acceso es de consulta para este módulo.")
    JSON.parse(value)
    if (cache.get(key) === value) return
    encodeCollection(key, JSON.parse(value))
    cache.set(key, value); pending.set(key, value); publish({ status: "saving", pending: pending.size }); schedule()
  },
  removeItem(key) {
    if (/^(?:postal|cp-|sat-cp|codigo-postal|sepomex)/.test(key)) { preferences.delete(key); return }
    const moduleKey = COLLECTION_MODULES[key]
    if (!moduleKey || !sessionCan(session, company, moduleKey, "edit")) throw new Error("No tienes permiso para retirar estos datos.")
    if (!cache.has(key)) return
    cache.delete(key); pending.set(key, null); publish({ status: "saving", pending: pending.size }); schedule()
  },
  clear() { throw new Error("No se permite borrar la empresa desde el almacenamiento del navegador.") },
}
export function getModuleStorage(): Storage {
  if (connected) return companyStorage
  if (typeof window === "undefined") return companyStorage
  // Local demo is an explicit build mode, never a fallback after an API error.
  if (process.env.NEXT_PUBLIC_PLD_MODE === "demo") return window.localStorage
  return companyStorage
}
