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
let uploaded = new Map<string, string>()
let companyNotices = new Map<string, string[]>()
let dataOwnerUserId: string | null = null
interface PrincipalStorage {
  company: Company | null; connected: boolean; cache: typeof cache; records: CloudRecord[];
  pending: typeof pending; running: Promise<void> | null; lastError: Error | null;
  uploaded: typeof uploaded; companyNotices: typeof companyNotices; state: SaveState
}
// Memory-only recovery: a different signed-in user never receives these maps.
const quarantinedPrincipals = new Map<string, PrincipalStorage>()
let loadEpoch = 0
let scopeGeneration = 0
let authGeneration = 0
let loading = false

export interface ModuleScope { readonly generation: number; readonly authGeneration: number; readonly companyId: string | null; readonly storage: Storage }
const staleScope = () => new DOMException("La empresa o el acceso cambió. Vuelve a iniciar la acción en el expediente actual.", "AbortError")
export function isModuleScopeCurrent(scope: ModuleScope) { return !loading && dataOwnerUserId === (session?.user.id ?? null) && scope.generation === scopeGeneration && scope.authGeneration === authGeneration && scope.companyId === (company?.id ?? null) }
export function assertModuleScope(scope: ModuleScope) {
  if (!isModuleScopeCurrent(scope)) throw staleScope()
}
export function captureModuleScope(): ModuleScope {
  const scope = { generation: scopeGeneration, authGeneration, companyId: company?.id ?? null, storage: null as unknown as Storage }
  assertModuleScope(scope)
  const target = !connected && typeof window !== "undefined" && process.env.NEXT_PUBLIC_PLD_MODE === "demo" ? window.localStorage : companyStorage
  scope.storage = {
    get length() { assertModuleScope(scope); return target.length },
    key(index) { assertModuleScope(scope); return target.key(index) },
    getItem(key) { assertModuleScope(scope); return target.getItem(key) },
    setItem(key, value) { assertModuleScope(scope); target.setItem(key, value) },
    removeItem(key) { assertModuleScope(scope); target.removeItem(key) },
    clear() { assertModuleScope(scope); target.clear() },
  }
  return scope
}

// A drain may finish changes queued BEFORE switching began, but it must never
// follow the mutable company/session binding after an asynchronous boundary.
interface DrainScope { company: Company; authGeneration: number; pending: typeof pending; uploaded: typeof uploaded }
function assertDrainScope(scope: DrainScope) {
  if (scope.authGeneration !== authGeneration || scope.company !== company || scope.pending !== pending) throw staleScope()
}

export function getPilotSession() { return session }
export function getActiveCompany() { return company }
export function getCompanyRecordRevision(collection: string, id: string) { return records.find((record) => record.collection === collection && record.id === id && !record.deleted)?.revision }
export function isCloudConnected() { return connected }
export function canWriteModuleStorage(key: string) { return !loading && (!connected ? process.env.NEXT_PUBLIC_PLD_MODE === "demo" : Boolean(COLLECTION_MODULES[key] && sessionCan(session, company, COLLECTION_MODULES[key], "edit"))) }
export function getSaveState() { return state }
/** null means a snapshot is in transition: no module may mount/read it yet. */
export function getModuleStorageGeneration(): number | null { return loading ? null : scopeGeneration }
export function subscribeSaveState(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
function publish(next: SaveState) { state = { ...next, warnings: company ? companyNotices.get(company.id) : undefined }; listeners.forEach((listener) => listener()) }
export function dismissStorageNotices() { if (company) companyNotices.delete(company.id); publish({ ...state, warnings: undefined }) }
export function configurePilotSession(value: PilotSession | null) {
  const changed = JSON.stringify(session) !== JSON.stringify(value)
  if (changed) { scopeGeneration++; authGeneration++; loadEpoch++; loading = false }
  const nextOwner = value?.user.id ?? null
  if (nextOwner !== dataOwnerUserId) {
    if (dataOwnerUserId && (company || cache.size || pending.size || running)) quarantinedPrincipals.set(dataOwnerUserId,{company,connected,cache,records,pending,running,lastError,uploaded,companyNotices,state})
    const saved = nextOwner ? quarantinedPrincipals.get(nextOwner) : undefined
    const canRestore = saved && value && (!saved.company || value.companies.some((item) => item.id === saved.company!.id && item.status === "active") || saved.company.id.startsWith("inbox:") && sessionCan(value,saved.company,"expedientes","view"))
    dataOwnerUserId = nextOwner
    if (saved && canRestore) {
      ({company,connected,cache,records,pending,running,lastError,uploaded,companyNotices,state}=saved)
      quarantinedPrincipals.delete(nextOwner!)
    } else {
      company=null;connected=false;cache=new Map();records=[];pending=new Map();running=null;lastError=null;uploaded=new Map();companyNotices=new Map();state={status:"saved",pending:0}
    }
  }
  session = value
  if (changed) publish(state)
}

export function getPendingModuleChanges() {
  if (!session || dataOwnerUserId !== session.user.id) throw staleScope()
  return { companyId: company?.id, exportedAt: new Date().toISOString(), collections: Object.fromEntries([...pending].map(([key, value]) => [key, value === null ? null : JSON.parse(value)])) }
}
export async function loadCompanyStorage(nextCompany: Company, options: { discardUnsaved?: boolean } = {}) {
  if (!session || dataOwnerUserId !== session.user.id) throw staleScope()
  const epoch = ++loadEpoch
  const auth = authGeneration
  scopeGeneration++; loading = true
  publish(state)
  try {
  if (options.discardUnsaved && running) throw new Error("Espera a que termine la solicitud actual.")
  if (!options.discardUnsaved) await flushModuleStorage()
  if (epoch !== loadEpoch || auth !== authGeneration) throw staleScope()
  const snapshotPath = nextCompany.id.startsWith("inbox:") ? `/organizations/${encodeURIComponent(nextCompany.organizationId)}/inbox` : `/companies/${encodeURIComponent(nextCompany.id)}/snapshot`
  const result = await pilotApi<{ records: CloudRecord[] }>(snapshotPath)
  if (epoch !== loadEpoch || auth !== authGeneration) throw staleScope()
  company = nextCompany; connected = true; records = result.records
  cache = new Map(); pending = new Map(); uploaded.clear(); lastError = null
  for (const key of Object.keys(COLLECTION_MODULES)) {
    if (!result.records.some((r) => r.collection === key && !r.deleted)) continue
    cache.set(key, JSON.stringify(decodeCollection(key, records)))
  }
  if (!cache.has("pld-tenants")) cache.set("pld-tenants", JSON.stringify({ schemaVersion: 1, activeTenantId: nextCompany.id, tenants: [{ id: nextCompany.id, schemaVersion: 1, rfc: nextCompany.rfc, razonSocial: nextCompany.name, nombreComercial: nextCompany.name, representanteCumplimiento: { nombre: "", cargo: "", email: "" }, responsablesInternos: [], actividades: [], manual: {}, ebr: {}, policies: { conservaAnios: 10, noGuardarEfirma: true, requiereCotejo: true } }] }))
  publish({ status: "saved", pending: 0 })
  } finally { if (epoch === loadEpoch) { loading = false; publish(state) } }
}
export function resetCompanyStorage() {
  if (pending.size || running) throw new Error("Espera a que se guarden los cambios antes de salir.")
  if (dataOwnerUserId) quarantinedPrincipals.delete(dataOwnerUserId)
  loadEpoch++; scopeGeneration++; authGeneration++; loading = false; company = null; session = null; dataOwnerUserId=null; connected = false; cache.clear(); records = []; uploaded.clear(); companyNotices.clear(); lastError = null
  publish({ status: "saved", pending: 0 })
}

export async function uploadPilotFile(file: File, moduleKey: ModuleKey, documentId?: string, expectedRevision?: number) {
  const scope = captureModuleScope()
  if (!connected || !company) throw new Error("Selecciona una empresa conectada para guardar el archivo.")
  const result = await uploadScopedFile(file, moduleKey, { company, authGeneration, pending, uploaded }, documentId, expectedRevision)
  assertModuleScope(scope)
  return result
}
async function uploadScopedFile(file: File, moduleKey: ModuleKey, scope: DrainScope, documentId?: string, expectedRevision?: number) {
  assertDrainScope(scope)
  if (!sessionCan(session, scope.company, moduleKey, "edit")) throw new Error("Tu acceso es de consulta para este módulo.")
  const body = new FormData(); body.set("file", file); body.set("moduleKey", moduleKey)
  if (documentId) body.set("documentId", documentId)
  if (expectedRevision !== undefined) body.set("expectedRevision", String(expectedRevision))
  const result = await pilotApi<{ id: string; documentId: string; version: number; sha256: string; downloadUrl: string; fileName: string }>(`/companies/${encodeURIComponent(scope.company.id)}/files`, { method: "POST", body })
  assertDrainScope(scope)
  return result
}

async function externalize(value: unknown, moduleKey: ModuleKey, scope: DrainScope, fileName?: string): Promise<unknown> {
  assertDrainScope(scope)
  if (typeof value === "string" && /^data:[^,]*,/i.test(value)) {
    const uploadKey = `${moduleKey}\u0000${value}`
    const existing = scope.uploaded.get(uploadKey)
    if (existing) return existing
    const blob = await (await fetch(value)).blob()
    assertDrainScope(scope)
    const extensions: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "application/xml": "xml", "text/xml": "xml", "application/json": "json", "text/plain": "txt", "text/csv": "csv", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx", "application/vnd.ms-excel.sheet.macroenabled.12": "xlsm" }
    const result = await uploadScopedFile(new File([blob], fileName || `evidencia.${extensions[blob.type.split(";")[0].toLowerCase()] || "bin"}`, { type: blob.type }), moduleKey, scope)
    assertDrainScope(scope)
    scope.uploaded.set(uploadKey, result.downloadUrl)
    return result.downloadUrl
  }
  if (Array.isArray(value)) { const next = []; for (const item of value) next.push(await externalize(item, moduleKey, scope)); return next }
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {}
    const object = value as Record<string, unknown>
    const name = [object.fileName, object.archivoNombre, object.name].find((item) => typeof item === "string" && /\.[a-z0-9]{2,8}$/i.test(item)) as string | undefined
    for (const [key, item] of Object.entries(value)) next[key] = await externalize(item, moduleKey, scope, name)
    return next
  }
  return value
}

async function drain(scope: DrainScope) {
  assertDrainScope(scope)
  while (pending.size && company) {
    assertDrainScope(scope)
    const batch = [...pending.entries()]
    publish({ status: "saving", pending: batch.length })
    // Coalesce synchronous changes from a moduleKey into one atomic server batch.
    const mutations = []
    for (const [collection, raw] of batch) {
      const moduleKey = COLLECTION_MODULES[collection]
      if (!sessionCan(session, scope.company, moduleKey, "edit")) throw new Error("Tu acceso es de consulta para este módulo.")
      const parsed = raw === null ? null : JSON.parse(raw)
      const desired = raw === null ? new Map<string, unknown>() : encodeCollection(collection, await externalize(parsed, moduleKey, scope))
      assertDrainScope(scope)
      mutations.push(...diffCollection(collection, desired, records))
    }
    const changedCollections = new Set<string>()
    if (mutations.length) {
      const batchPath = scope.company.id.startsWith("inbox:") ? `/organizations/${encodeURIComponent(scope.company.organizationId)}/inbox/records/batch` : `/companies/${encodeURIComponent(scope.company.id)}/records/batch`
      // The API caps atomic batches. A large migration/import is persisted in
      // bounded chunks; each result advances revisions before the next chunk.
      for (let offset = 0; offset < mutations.length; offset += 100) {
        assertDrainScope(scope)
        const result = await pilotApi<{ records: CloudRecord[]; warnings?: Array<{ message?: string; operationIds?: string[] }> }>(batchPath, jsonRequest("POST", { mutations: mutations.slice(offset, offset + 100) }))
        assertDrainScope(scope)
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
  if (running || lastError || !company) return
  const owner=dataOwnerUserId,scope:DrainScope={company,authGeneration,pending,uploaded}
  const scheduled = Promise.resolve().then(() => drain(scope)).catch((error: unknown) => {
    if (owner !== dataOwnerUserId || scope.authGeneration !== authGeneration || scope.pending !== pending) return
    lastError = error instanceof Error ? error : new Error("No se guardaron los cambios.")
    publish({ status: "error", pending: pending.size, message: lastError.message })
  }).finally(() => {
    const quarantined=owner?quarantinedPrincipals.get(owner):undefined
    if(quarantined?.running===scheduled)quarantined.running=null
    if(running!==scheduled)return
    running = null; if (pending.size && !lastError) schedule()
  })
  running = scheduled
}
export async function flushModuleStorage(scope?: ModuleScope) {
  if (scope) assertModuleScope(scope)
  if (!connected) return
  schedule()
  while (running) await running
  if (lastError) throw lastError
  if (scope) assertModuleScope(scope)
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
  return captureModuleScope().storage
}
