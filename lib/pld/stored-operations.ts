import { classifyAvisoSalida, evaluarOperacionVulnerable } from "./operations"
import {
  assertSafeCents,
  centsToMoney,
  coerceLegacyMoneyToCents,
  parseMoneyToCents,
} from "./money"
import type { AvisoSalidaTipo, UmbralStatus } from "./types"

export const PLD_OPERATIONS_STORAGE_KEY = "actividades_vulnerables_operaciones"
export const STORED_PLD_OPERATION_SCHEMA_VERSION = 3 as const

export type PldOperationLifecycleStatus = "active" | "cancelled"
export type PldOperationSubmissionStatus =
  | "not-required"
  | "pending"
  | "presented"
  | "correction-pending"
  | "cancelled"

export type PldOperationHistoryAction =
  | "created"
  | "migrated"
  | "updated"
  | "recalculated"
  | "presented"
  | "submission-status-changed"
  | "deleted"
  | "cancelled"

export interface PldObligatedSubjectSnapshot {
  id?: string
  nombre?: string
  rfc?: string
  clave?: string
}

export interface PldOperationLifecycle {
  status: PldOperationLifecycleStatus
  cancelledAt?: string
  cancelledBy?: string
  cancellationReason?: string
  archivedAt?: string
}

export interface PldOperationSubmission {
  status: PldOperationSubmissionStatus
  wasEverPresented: boolean
  presentedAt?: string
  presentedBy?: string
  reference?: string
  packageId?: string
  correctionReason?: string
  updatedAt: string
}

export interface PldOperationHistoryEntry {
  id: string
  revision: number
  action: PldOperationHistoryAction
  at: string
  actor?: string
  reason?: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}

/**
 * Contrato persistido compatible con los lectores legacy de la aplicación.
 * `montoCentavos` es canónico; `monto` y los demás campos históricos se
 * conservan para no romper consumidores existentes.
 */
export interface StoredPldOperationV3 extends Record<string, unknown> {
  schemaVersion: typeof STORED_PLD_OPERATION_SCHEMA_VERSION
  id: string
  actividadKey: string
  actividadNombre: string
  tipoCliente: string
  detalleTipoCliente?: string
  cliente: string
  rfc: string
  mismoGrupo: boolean
  periodo: string
  mes: number
  anio: number
  montoCentavos: number
  monto: number
  moneda: string
  monedaDescripcion: string
  fechaOperacion: string
  tipoOperacion: string
  evidencia: string
  umaDiaria: number
  identificacionUmbralCentavos: number
  identificacionUmbralPesos: number
  avisoUmbralCentavos: number
  avisoUmbralPesos: number
  umbralStatus: UmbralStatus
  acumuladoClienteCentavos: number
  acumuladoCliente: number
  alerta: string | null
  avisoPresentado: boolean
  alertaResuelta: boolean
  avisoSalidaTipo?: AvisoSalidaTipo
  avisoSalidaLabel?: string
  avisoSalidaDescripcion?: string
  referenciaAviso?: string
  sujetoObligado: PldObligatedSubjectSnapshot
  lifecycle: PldOperationLifecycle
  estadoOperacion: PldOperationLifecycleStatus
  revision: number
  createdAt: string
  updatedAt: string
  history: PldOperationHistoryEntry[]
  submission: PldOperationSubmission
}

export interface SanitizeStoredOperationOptions {
  now?: string
  sujetoObligado?: PldObligatedSubjectSnapshot
}

export interface StoredOperationsMigrationResult {
  operations: StoredPldOperationV3[]
  migrated: boolean
  discardedCount: number
  duplicateIds: string[]
  parseError?: string
}

export interface PldOperationsStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface LoadStoredOperationsOptions extends SanitizeStoredOperationOptions {
  key?: string
  persistMigration?: boolean
}

export interface StoredPldOperationFilters {
  query?: string
  status?: PldOperationLifecycleStatus | "all"
  estado?: PldOperationLifecycleStatus | "all"
  activityKey?: string | string[]
  actividadKey?: string | string[]
  period?: string | string[]
  periodo?: string | string[]
  submissionStatus?: PldOperationSubmissionStatus | PldOperationSubmissionStatus[]
  umbralStatus?: UmbralStatus | UmbralStatus[]
}

export interface StoredPldOperationListResult {
  items: StoredPldOperationV3[]
  matchingCount: number
  hasCriteria: boolean
}

export interface OperationMutationContext {
  at?: string
  actor?: string
  correctionReason?: string
}

export interface CreateStoredOperationOptions extends SanitizeStoredOperationOptions {
  at?: string
  actor?: string
}

export type StoredPldOperationPatch = Partial<
  Omit<
    StoredPldOperationV3,
    | "schemaVersion"
    | "id"
    | "monto"
    | "montoCentavos"
    | "revision"
    | "createdAt"
    | "updatedAt"
    | "history"
    | "lifecycle"
    | "estadoOperacion"
    | "submission"
  >
> & {
  monto?: string | number
  montoCentavos?: number
  sujetoObligado?: Partial<PldObligatedSubjectSnapshot>
}

export type StoredOperationMutationErrorCode =
  | "not-found"
  | "operation-cancelled"
  | "invalid-amount"
  | "correction-reason-required"
  | "confirmation-required"
  | "presented-operation"
  | "not-presented"

export type StoredOperationMutationResult =
  | { ok: true; operation: StoredPldOperationV3; changed: boolean }
  | { ok: false; code: StoredOperationMutationErrorCode; message: string }

export interface OperationRemovalOptions extends OperationMutationContext {
  confirmed?: boolean
  reason?: string
}

export type StoredOperationRemovalResult =
  | {
      ok: true
      action: "deleted" | "cancelled"
      operations: StoredPldOperationV3[]
      operation: StoredPldOperationV3
    }
  | {
      ok: false
      code: StoredOperationMutationErrorCode
      message: string
      operations: StoredPldOperationV3[]
    }

export interface MarkOperationPresentedOptions extends OperationMutationContext {
  reference?: string
  packageId?: string
}

export interface RecalculateStoredOperationsOptions extends OperationMutationContext {
  recordHistory?: boolean
}

const UMBRAL_STATUSES = new Set<UmbralStatus>(["sin-obligacion", "identificacion", "aviso"])
const SUBMISSION_STATUSES = new Set<PldOperationSubmissionStatus>([
  "not-required",
  "pending",
  "presented",
  "correction-pending",
  "cancelled",
])
const HISTORY_ACTIONS = new Set<PldOperationHistoryAction>([
  "created",
  "migrated",
  "updated",
  "recalculated",
  "presented",
  "submission-status-changed",
  "deleted",
  "cancelled",
])
const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function positiveInteger(value: unknown, fallback = 1) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : fallback
}

function finiteNumber(value: unknown, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function toIso(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.trim()) return fallback
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString()
}

function normalizeNow(value?: string) {
  const fallback = new Date().toISOString()
  return toIso(value, fallback)
}

function normalizeOperationDate(value: unknown, now: string) {
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      const candidate = `${match[1]}-${match[2]}-${match[3]}`
      const parsed = new Date(`${candidate}T00:00:00.000Z`)
      if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === candidate) {
        return candidate
      }
    }
  }
  return now.slice(0, 10)
}

export function periodFromOperationDate(fechaOperacion: string) {
  const match = fechaOperacion.match(/^(\d{4})-(\d{2})/)
  return match ? `${match[1]}${match[2]}` : ""
}

export function normalizeOperationPeriod(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return ""
  const digits = String(value).replace(/\D/g, "")
  if (digits.length !== 6) return ""
  const month = Number(digits.slice(4, 6))
  return month >= 1 && month <= 12 ? digits : ""
}

function sanitizeSubject(
  raw: Record<string, unknown>,
  fallback?: PldObligatedSubjectSnapshot,
): PldObligatedSubjectSnapshot {
  const subject = isRecord(raw.sujetoObligado) ? raw.sujetoObligado : {}
  return {
    id:
      optionalString(subject.id) ??
      optionalString(raw.sujetoObligadoId) ??
      optionalString(raw.tenantId) ??
      fallback?.id,
    nombre:
      optionalString(subject.nombre) ??
      optionalString(raw.sujetoObligadoNombre) ??
      optionalString(raw.tenantNombre) ??
      fallback?.nombre,
    rfc:
      optionalString(subject.rfc)?.toUpperCase() ??
      optionalString(raw.sujetoObligadoRfc)?.toUpperCase() ??
      optionalString(raw.tenantRfc)?.toUpperCase() ??
      fallback?.rfc,
    clave:
      optionalString(subject.clave) ??
      optionalString(raw.claveSujetoObligado) ??
      fallback?.clave,
  }
}

function sanitizeLifecycle(raw: Record<string, unknown>, now: string): PldOperationLifecycle {
  const lifecycle = isRecord(raw.lifecycle) ? raw.lifecycle : {}
  const submission = isRecord(raw.submission) ? raw.submission : {}
  const legacyStatus = raw.estadoOperacion === "cancelled" || raw.estadoOperacion === "cancelado"
  const cancelled =
    lifecycle.status === "cancelled" ||
    submission.status === "cancelled" ||
    legacyStatus ||
    raw.cancelada === true ||
    raw.cancelado === true

  if (!cancelled) return { status: "active" }

  return {
    status: "cancelled",
    cancelledAt: toIso(
      lifecycle.cancelledAt ?? raw.cancelledAt ?? raw.canceladoEn,
      now,
    ),
    cancelledBy:
      optionalString(lifecycle.cancelledBy) ?? optionalString(raw.cancelledBy) ?? optionalString(raw.canceladoPor),
    cancellationReason:
      optionalString(lifecycle.cancellationReason) ??
      optionalString(raw.cancellationReason) ??
      optionalString(raw.motivoCancelacion),
    archivedAt: optionalString(lifecycle.archivedAt)
      ? toIso(lifecycle.archivedAt, now)
      : undefined,
  }
}

function inferredSubmissionStatus(raw: Record<string, unknown>, umbralStatus: UmbralStatus) {
  if (raw.avisoPresentado === true) return "presented" as const
  if (umbralStatus === "aviso" || raw.sospecha24h === true) return "pending" as const
  return "not-required" as const
}

function sanitizeSubmission(
  raw: Record<string, unknown>,
  lifecycle: PldOperationLifecycle,
  umbralStatus: UmbralStatus,
  updatedAt: string,
): PldOperationSubmission {
  const submission = isRecord(raw.submission) ? raw.submission : {}
  const candidateStatus = SUBMISSION_STATUSES.has(submission.status as PldOperationSubmissionStatus)
    ? (submission.status as PldOperationSubmissionStatus)
    : inferredSubmissionStatus(raw, umbralStatus)
  const wasEverPresented =
    submission.wasEverPresented === true ||
    raw.avisoPresentado === true ||
    candidateStatus === "presented" ||
    candidateStatus === "correction-pending"
  const status = lifecycle.status === "cancelled" ? "cancelled" : candidateStatus
  const presentedAtValue =
    submission.presentedAt ?? raw.presentedAt ?? raw.avisoPresentadoEn ?? raw.fechaPresentacion

  return {
    status,
    wasEverPresented,
    presentedAt:
      wasEverPresented && typeof presentedAtValue === "string"
        ? toIso(presentedAtValue, updatedAt)
        : wasEverPresented
          ? updatedAt
          : undefined,
    presentedBy: optionalString(submission.presentedBy) ?? optionalString(raw.presentadoPor),
    reference:
      optionalString(submission.reference) ??
      optionalString(raw.referenciaPresentacion) ??
      optionalString(raw.referenciaAviso),
    packageId: optionalString(submission.packageId) ?? optionalString(raw.satPackageId),
    correctionReason:
      optionalString(submission.correctionReason) ?? optionalString(raw.motivoCorreccion),
    updatedAt: toIso(submission.updatedAt, updatedAt),
  }
}

function sanitizeHistoryEntry(
  value: unknown,
  operationId: string,
  fallbackAt: string,
  fallbackRevision: number,
): PldOperationHistoryEntry | null {
  if (!isRecord(value)) return null
  const action = HISTORY_ACTIONS.has(value.action as PldOperationHistoryAction)
    ? (value.action as PldOperationHistoryAction)
    : null
  if (!action) return null
  const revision = positiveInteger(value.revision, fallbackRevision)
  const at = toIso(value.at ?? value.timestamp, fallbackAt)
  return {
    id: optionalString(value.id) ?? `${operationId}:${revision}:${action}:${at}`,
    revision,
    action,
    at,
    actor: optionalString(value.actor) ?? optionalString(value.user),
    reason: optionalString(value.reason) ?? optionalString(value.details),
    before: isRecord(value.before) ? { ...value.before } : undefined,
    after: isRecord(value.after) ? { ...value.after } : undefined,
  }
}

function sanitizeHistory(
  raw: Record<string, unknown>,
  operationId: string,
  revision: number,
  createdAt: string,
  updatedAt: string,
) {
  const source = Array.isArray(raw.history)
    ? raw.history
    : Array.isArray(raw.historialCambios)
      ? raw.historialCambios
      : []
  const entries = source
    .map((entry) => sanitizeHistoryEntry(entry, operationId, updatedAt, revision))
    .filter((entry): entry is PldOperationHistoryEntry => Boolean(entry))

  if (entries.length > 0) return entries

  const action: PldOperationHistoryAction = raw.schemaVersion === 3 ? "created" : "migrated"
  const at = action === "created" ? createdAt : updatedAt
  return [
    {
      id: `${operationId}:${revision}:${action}`,
      revision,
      action,
      at,
      reason: action === "migrated" ? "Migración compatible a StoredPldOperationV3." : undefined,
    },
  ]
}

function sanitizeStringRecord(value: unknown) {
  if (!isRecord(value)) return undefined
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  )
}

function canonicalNestedLiquidation(raw: Record<string, unknown>, montoCentavos: number) {
  if (!isRecord(raw.liquidacion)) return raw.liquidacion
  if (!("monto" in raw.liquidacion) && !("montoCentavos" in raw.liquidacion)) {
    return { ...raw.liquidacion }
  }
  const liquidacionCentavos =
    Number.isSafeInteger(raw.liquidacion.montoCentavos) && Number(raw.liquidacion.montoCentavos) >= 0
      ? Number(raw.liquidacion.montoCentavos)
      : Math.max(0, coerceLegacyMoneyToCents(raw.liquidacion.monto, montoCentavos))
  return {
    ...raw.liquidacion,
    montoCentavos: liquidacionCentavos,
    monto: centsToMoney(liquidacionCentavos),
  }
}

export function sanitizeStoredPldOperation(
  value: unknown,
  options: SanitizeStoredOperationOptions = {},
): StoredPldOperationV3 | null {
  if (!isRecord(value)) return null
  const id = optionalString(value.id)
  if (!id) return null

  const now = normalizeNow(options.now)
  const fechaOperacion = normalizeOperationDate(value.fechaOperacion, now)
  const periodFromDate = periodFromOperationDate(fechaOperacion)
  const periodo = normalizeOperationPeriod(value.periodo) || periodFromDate
  const anio = Number(periodo.slice(0, 4)) || Number(fechaOperacion.slice(0, 4))
  const mes = Number(periodo.slice(4, 6)) || Number(fechaOperacion.slice(5, 7))
  const montoCentavos =
    Number.isSafeInteger(value.montoCentavos) && Number(value.montoCentavos) >= 0
      ? Number(value.montoCentavos)
      : Math.max(0, coerceLegacyMoneyToCents(value.monto, 0))
  const identificacionUmbralCentavos =
    Number.isSafeInteger(value.identificacionUmbralCentavos) && Number(value.identificacionUmbralCentavos) >= 0
      ? Number(value.identificacionUmbralCentavos)
      : Math.max(0, coerceLegacyMoneyToCents(value.identificacionUmbralPesos, 0))
  const avisoUmbralCentavos =
    Number.isSafeInteger(value.avisoUmbralCentavos) && Number(value.avisoUmbralCentavos) >= 0
      ? Number(value.avisoUmbralCentavos)
      : Math.max(0, coerceLegacyMoneyToCents(value.avisoUmbralPesos, 0))
  const acumuladoClienteCentavos =
    Number.isSafeInteger(value.acumuladoClienteCentavos) && Number(value.acumuladoClienteCentavos) >= 0
      ? Number(value.acumuladoClienteCentavos)
      : Math.max(0, coerceLegacyMoneyToCents(value.acumuladoCliente, montoCentavos))
  const umbralStatus = UMBRAL_STATUSES.has(value.umbralStatus as UmbralStatus)
    ? (value.umbralStatus as UmbralStatus)
    : "sin-obligacion"
  const revision = positiveInteger(value.revision, 1)
  const operationFallbackAt = `${fechaOperacion}T00:00:00.000Z`
  const createdAt = toIso(
    value.createdAt ?? value.creadoEn ?? value.fechaCreacion ?? value.fechaRegistro,
    operationFallbackAt,
  )
  const updatedAt = toIso(
    value.updatedAt ?? value.actualizadoEn ?? value.fechaActualizacion,
    createdAt,
  )
  const lifecycle = sanitizeLifecycle(value, updatedAt)
  const submission = sanitizeSubmission(value, lifecycle, umbralStatus, updatedAt)
  const history = sanitizeHistory(value, id, revision, createdAt, updatedAt)
  const sujetoObligado = sanitizeSubject(value, options.sujetoObligado)
  const monto = centsToMoney(montoCentavos)
  const avisoPresentado = submission.wasEverPresented

  return {
    ...value,
    schemaVersion: STORED_PLD_OPERATION_SCHEMA_VERSION,
    id,
    actividadKey: asString(value.actividadKey).trim(),
    actividadNombre: asString(value.actividadNombre).trim(),
    tipoCliente: asString(value.tipoCliente, "pf_residente"),
    detalleTipoCliente: optionalString(value.detalleTipoCliente),
    cliente: asString(value.cliente, "Cliente sin nombre").trim() || "Cliente sin nombre",
    rfc: asString(value.rfc).trim().toUpperCase(),
    mismoGrupo: Boolean(value.mismoGrupo),
    periodo,
    mes,
    anio,
    montoCentavos,
    monto,
    moneda: asString(value.moneda, "MXN").trim().toUpperCase() || "MXN",
    monedaDescripcion: asString(value.monedaDescripcion, "Peso mexicano (MXN)"),
    fechaOperacion,
    tipoOperacion: asString(value.tipoOperacion),
    evidencia: asString(value.evidencia),
    umaDiaria: finiteNumber(value.umaDiaria),
    identificacionUmbralCentavos,
    identificacionUmbralPesos: centsToMoney(identificacionUmbralCentavos),
    avisoUmbralCentavos,
    avisoUmbralPesos: centsToMoney(avisoUmbralCentavos),
    umbralStatus,
    acumuladoClienteCentavos,
    acumuladoCliente: centsToMoney(acumuladoClienteCentavos),
    alerta: typeof value.alerta === "string" ? value.alerta : null,
    avisoPresentado,
    alertaResuelta: Boolean(value.alertaResuelta),
    avisoSalidaTipo:
      typeof value.avisoSalidaTipo === "string"
        ? (value.avisoSalidaTipo as AvisoSalidaTipo)
        : undefined,
    avisoSalidaLabel: optionalString(value.avisoSalidaLabel),
    avisoSalidaDescripcion: optionalString(value.avisoSalidaDescripcion),
    referenciaAviso: optionalString(value.referenciaAviso),
    satFieldValues: sanitizeStringRecord(value.satFieldValues),
    satCellValues: sanitizeStringRecord(value.satCellValues),
    liquidacion: canonicalNestedLiquidation(value, montoCentavos),
    sujetoObligado,
    lifecycle,
    estadoOperacion: lifecycle.status,
    revision,
    createdAt,
    updatedAt,
    history,
    submission,
  }
}

export function sanitizeStoredPldOperations(
  value: unknown,
  options: SanitizeStoredOperationOptions = {},
) {
  const source = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.operations)
      ? value.operations
      : []
  return source
    .map((operation) => sanitizeStoredPldOperation(operation, options))
    .filter((operation): operation is StoredPldOperationV3 => Boolean(operation))
}

export function createStoredPldOperation(
  value: Record<string, unknown>,
  options: CreateStoredOperationOptions = {},
) {
  const at = normalizeNow(options.at ?? options.now)
  const id = optionalString(value.id)
  if (!id) return null
  const created = sanitizeStoredPldOperation(
    {
      ...value,
      schemaVersion: STORED_PLD_OPERATION_SCHEMA_VERSION,
      revision: 1,
      createdAt: at,
      updatedAt: at,
      lifecycle: { status: "active" },
      estadoOperacion: "active",
      history: [
        buildHistoryEntry({
          operationId: id,
          revision: 1,
          action: "created",
          at,
          actor: options.actor,
        }),
      ],
    },
    { now: at, sujetoObligado: options.sujetoObligado },
  )
  return created
}

function requiresV3Migration(raw: unknown, sanitized: StoredPldOperationV3 | null) {
  if (!isRecord(raw) || !sanitized) return true
  return (
    raw.schemaVersion !== STORED_PLD_OPERATION_SCHEMA_VERSION ||
    raw.montoCentavos !== sanitized.montoCentavos ||
    raw.monto !== sanitized.monto ||
    raw.revision !== sanitized.revision ||
    !isRecord(raw.lifecycle) ||
    !isRecord(raw.submission) ||
    !Array.isArray(raw.history) ||
    raw.createdAt !== sanitized.createdAt ||
    raw.updatedAt !== sanitized.updatedAt ||
    raw.periodo !== sanitized.periodo
  )
}

export function migrateStoredPldOperations(
  raw: unknown,
  options: SanitizeStoredOperationOptions = {},
): StoredOperationsMigrationResult {
  let parsed: unknown = raw
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw) as unknown
    } catch (error) {
      return {
        operations: [],
        migrated: false,
        discardedCount: 0,
        duplicateIds: [],
        parseError: error instanceof Error ? error.message : "JSON inválido",
      }
    }
  }

  const source = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.operations)
      ? parsed.operations
      : []
  if (!Array.isArray(parsed) && !(isRecord(parsed) && Array.isArray(parsed.operations))) {
    return {
      operations: [],
      migrated: false,
      discardedCount: 0,
      duplicateIds: [],
      parseError: "La llave de operaciones no contiene un arreglo legible.",
    }
  }
  const operations: StoredPldOperationV3[] = []
  let discardedCount = 0
  let migrated = !Array.isArray(parsed)
  const seenIds = new Set<string>()
  const duplicateIds = new Set<string>()

  source.forEach((operation) => {
    const sanitized = sanitizeStoredPldOperation(operation, options)
    if (!sanitized) {
      discardedCount += 1
      migrated = true
      return
    }
    if (seenIds.has(sanitized.id)) duplicateIds.add(sanitized.id)
    seenIds.add(sanitized.id)
    if (requiresV3Migration(operation, sanitized)) migrated = true
    operations.push(sanitized)
  })

  return {
    operations,
    migrated,
    discardedCount,
    duplicateIds: [...duplicateIds],
  }
}

export function loadStoredPldOperations(
  storage: PldOperationsStorage,
  options: LoadStoredOperationsOptions = {},
): StoredOperationsMigrationResult {
  const key = options.key ?? PLD_OPERATIONS_STORAGE_KEY
  const serialized = storage.getItem(key)
  if (serialized === null) {
    return { operations: [], migrated: false, discardedCount: 0, duplicateIds: [] }
  }

  const result = migrateStoredPldOperations(serialized, options)
  if (result.migrated && !result.parseError && (options.persistMigration ?? true)) {
    storage.setItem(key, JSON.stringify(result.operations))
  }
  return result
}

export function saveStoredPldOperations(
  storage: PldOperationsStorage,
  operations: StoredPldOperationV3[],
  key = PLD_OPERATIONS_STORAGE_KEY,
) {
  const canonical = sanitizeStoredPldOperations(operations)
  storage.setItem(key, JSON.stringify(canonical))
  return canonical
}

export function normalizeOperationSearchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Identidad estable del sujeto obligado para aislar acumulaciones. Se priorizan
 * identificadores inmutables y sólo se recurre al nombre para registros legacy.
 */
export function storedPldSubjectIdentity(subject: PldObligatedSubjectSnapshot | undefined) {
  const candidates: Array<[keyof PldObligatedSubjectSnapshot, string | undefined]> = [
    ["id", subject?.id],
    ["rfc", subject?.rfc],
    ["clave", subject?.clave],
    ["nombre", subject?.nombre],
  ]
  for (const [kind, value] of candidates) {
    const normalized = normalizeOperationSearchText(value)
    if (normalized) return `${kind}:${normalized}`
  }
  return "sin-sujeto"
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

function operationSearchHaystack(operation: StoredPldOperationV3) {
  const monthName = MONTH_NAMES[operation.mes - 1] ?? ""
  const formattedPeriod = operation.periodo
    ? `${operation.periodo.slice(0, 4)}-${operation.periodo.slice(4, 6)}`
    : ""
  return normalizeOperationSearchText(
    [
      operation.cliente,
      operation.rfc,
      operation.tipoOperacion,
      operation.tipoCliente,
      operation.detalleTipoCliente,
      operation.actividadKey,
      operation.actividadNombre,
      operation.periodo,
      formattedPeriod,
      `${monthName} ${operation.anio}`,
      operation.referenciaAviso,
    ].join(" "),
  )
}

export function filterStoredPldOperations(
  operations: StoredPldOperationV3[],
  filters: StoredPldOperationFilters = {},
) {
  const query = normalizeOperationSearchText(filters.query)
  const queryTerms = query.split(" ").filter(Boolean)
  const status = filters.status ?? filters.estado ?? "active"
  const activityKeys = asArray(filters.activityKey ?? filters.actividadKey).filter(Boolean)
  const periods = asArray(filters.period ?? filters.periodo)
    .map(normalizeOperationPeriod)
    .filter(Boolean)
  const submissionStatuses = asArray(filters.submissionStatus)
  const umbralStatuses = asArray(filters.umbralStatus)

  return operations.filter((operation) => {
    if (status !== "all" && operation.lifecycle.status !== status) return false
    if (activityKeys.length > 0 && !activityKeys.includes(operation.actividadKey)) return false
    if (periods.length > 0 && !periods.includes(operation.periodo)) return false
    if (
      submissionStatuses.length > 0 &&
      !submissionStatuses.includes(operation.submission.status)
    ) {
      return false
    }
    if (umbralStatuses.length > 0 && !umbralStatuses.includes(operation.umbralStatus)) return false
    if (queryTerms.length === 0) return true
    const haystack = operationSearchHaystack(operation)
    return queryTerms.every((term) => haystack.includes(term))
  })
}

export function sortStoredPldOperationsByRecency(operations: StoredPldOperationV3[]) {
  return [...operations].sort(
    (left, right) =>
      right.fechaOperacion.localeCompare(left.fechaOperacion) ||
      right.updatedAt.localeCompare(left.updatedAt) ||
      right.id.localeCompare(left.id),
  )
}

export function listStoredPldOperations(
  operations: StoredPldOperationV3[],
  filters: StoredPldOperationFilters = {},
  recentLimit = 5,
): StoredPldOperationListResult {
  const hasCriteria = Boolean(
    normalizeOperationSearchText(filters.query) ||
      filters.status ||
      filters.estado ||
      asArray(filters.activityKey ?? filters.actividadKey).length ||
      asArray(filters.period ?? filters.periodo).length ||
      asArray(filters.submissionStatus).length ||
      asArray(filters.umbralStatus).length,
  )
  const matching = sortStoredPldOperationsByRecency(
    filterStoredPldOperations(operations, filters),
  )
  return {
    items: hasCriteria ? matching : matching.slice(0, Math.max(0, recentLimit)),
    matchingCount: matching.length,
    hasCriteria,
  }
}

const AUDIT_IGNORED_FIELDS = new Set(["history", "revision", "createdAt", "updatedAt", "schemaVersion"])

function valuesEqual(left: unknown, right: unknown) {
  if (Object.is(left, right)) return true
  try {
    return JSON.stringify(left) === JSON.stringify(right)
  } catch (_error) {
    return false
  }
}

function operationDiff(
  before: StoredPldOperationV3,
  after: StoredPldOperationV3,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const beforeSnapshot: Record<string, unknown> = {}
  const afterSnapshot: Record<string, unknown> = {}
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  keys.forEach((key) => {
    if (AUDIT_IGNORED_FIELDS.has(key)) return
    if (!valuesEqual(before[key], after[key])) {
      beforeSnapshot[key] = cloneOperationAuditField(key, before[key])
      afterSnapshot[key] = cloneOperationAuditField(key, after[key])
    }
  })
  return { before: beforeSnapshot, after: afterSnapshot }
}

function cloneOperationAuditField(key: string, value: unknown) {
  if (key === "documentosSoporte" && Array.isArray(value)) {
    return value.map((item) => {
      if (!isRecord(item)) return cloneAuditValue(item)
      const { archivoContenido, ...metadata } = item
      return {
        ...(cloneAuditValue(metadata) as Record<string, unknown>),
        ...(typeof archivoContenido === "string"
          ? { archivoContenidoOmitido: true, archivoContenidoCaracteres: archivoContenido.length }
          : {}),
      }
    })
  }
  return cloneAuditValue(value)
}

function cloneAuditValue(value: unknown) {
  if (value === undefined || value === null || typeof value !== "object") return value
  try {
    return JSON.parse(JSON.stringify(value)) as unknown
  } catch (_error) {
    return String(value)
  }
}

function hasDiff(diff: ReturnType<typeof operationDiff>) {
  return Object.keys(diff.before).length > 0 || Object.keys(diff.after).length > 0
}

function buildHistoryEntry(input: {
  operationId: string
  revision: number
  action: PldOperationHistoryAction
  at: string
  actor?: string
  reason?: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}): PldOperationHistoryEntry {
  return {
    id: `${input.operationId}:${input.revision}:${input.action}:${input.at}`,
    revision: input.revision,
    action: input.action,
    at: input.at,
    actor: optionalString(input.actor),
    reason: optionalString(input.reason),
    before: input.before,
    after: input.after,
  }
}

function mutationError(
  code: StoredOperationMutationErrorCode,
  message: string,
): StoredOperationMutationResult {
  return { ok: false, code, message }
}

export function editStoredPldOperation(
  operation: StoredPldOperationV3,
  patch: StoredPldOperationPatch,
  context: OperationMutationContext = {},
): StoredOperationMutationResult {
  if (operation.lifecycle.status === "cancelled") {
    return mutationError("operation-cancelled", "Una operación cancelada no puede editarse.")
  }

  let montoCentavos = operation.montoCentavos
  if (patch.montoCentavos !== undefined) {
    if (!Number.isSafeInteger(patch.montoCentavos) || patch.montoCentavos < 0) {
      return mutationError("invalid-amount", "El monto en centavos debe ser un entero no negativo.")
    }
    montoCentavos = patch.montoCentavos
  } else if (patch.monto !== undefined) {
    const parsed = parseMoneyToCents(patch.monto)
    if (!parsed.ok) return mutationError("invalid-amount", parsed.message)
    montoCentavos = parsed.cents
  }

  const at = normalizeNow(context.at)
  const editedDatePeriod = periodFromOperationDate(
    String(patch.fechaOperacion ?? operation.fechaOperacion),
  )
  const rawCandidate: Record<string, unknown> = {
    ...operation,
    ...patch,
    ...(editedDatePeriod ? { periodo: editedDatePeriod } : {}),
    id: operation.id,
    montoCentavos,
    monto: centsToMoney(montoCentavos),
    revision: operation.revision,
    createdAt: operation.createdAt,
    updatedAt: operation.updatedAt,
    history: operation.history,
    lifecycle: operation.lifecycle,
    estadoOperacion: operation.lifecycle.status,
    sujetoObligado: {
      ...operation.sujetoObligado,
      ...(patch.sujetoObligado ?? {}),
    },
    submission: operation.submission,
  }
  const sanitized = sanitizeStoredPldOperation(rawCandidate, { now: at })
  if (!sanitized) return mutationError("invalid-amount", "No fue posible sanitizar la operación.")

  const prospectiveSubmission: PldOperationSubmission = operation.submission.wasEverPresented
    ? operation.submission
    : {
        ...operation.submission,
        status: unpresentedSubmissionStatus(sanitized),
        updatedAt: at,
      }
  const prospective = {
    ...sanitized,
    submission: prospectiveSubmission,
  }
  const initialDiff = operationDiff(operation, prospective)
  if (!hasDiff(initialDiff)) return { ok: true, operation, changed: false }

  const correctionReason = context.correctionReason?.trim()
  if (operation.submission.wasEverPresented && !correctionReason) {
    return mutationError(
      "correction-reason-required",
      "Las operaciones presentadas requieren un motivo de corrección.",
    )
  }

  const revision = operation.revision + 1
  const submission: PldOperationSubmission = operation.submission.wasEverPresented
    ? {
        ...operation.submission,
        status: "correction-pending",
        correctionReason,
        updatedAt: at,
      }
    : prospectiveSubmission
  const candidate: StoredPldOperationV3 = {
    ...prospective,
    revision,
    createdAt: operation.createdAt,
    updatedAt: at,
    submission,
    avisoPresentado: submission.wasEverPresented,
    history: operation.history,
  }
  const diff = operationDiff(operation, candidate)
  candidate.history = [
    ...operation.history,
    buildHistoryEntry({
      operationId: operation.id,
      revision,
      action: "updated",
      at,
      actor: context.actor,
      reason: correctionReason,
      before: diff.before,
      after: diff.after,
    }),
  ]
  return { ok: true, operation: candidate, changed: true }
}

export function markStoredPldOperationPresented(
  operation: StoredPldOperationV3,
  options: MarkOperationPresentedOptions = {},
): StoredOperationMutationResult {
  if (operation.lifecycle.status === "cancelled") {
    return mutationError("operation-cancelled", "Una operación cancelada no puede presentarse.")
  }

  const at = normalizeNow(options.at)
  const revision = operation.revision + 1
  const submission: PldOperationSubmission = {
    ...operation.submission,
    status: "presented",
    wasEverPresented: true,
    presentedAt: at,
    presentedBy: optionalString(options.actor),
    reference: optionalString(options.reference) ?? operation.submission.reference,
    packageId: optionalString(options.packageId) ?? operation.submission.packageId,
    correctionReason: undefined,
    updatedAt: at,
  }
  const candidate: StoredPldOperationV3 = {
    ...operation,
    revision,
    updatedAt: at,
    avisoPresentado: true,
    submission,
    history: operation.history,
  }
  const diff = operationDiff(operation, candidate)
  candidate.history = [
    ...operation.history,
    buildHistoryEntry({
      operationId: operation.id,
      revision,
      action: "presented",
      at,
      actor: options.actor,
      reason: options.correctionReason,
      before: diff.before,
      after: diff.after,
    }),
  ]
  return { ok: true, operation: candidate, changed: true }
}

function cancellationReason(options: OperationRemovalOptions) {
  return options.reason?.trim() || options.correctionReason?.trim()
}

export function deleteStoredPldOperation(
  operations: StoredPldOperationV3[],
  id: string,
  options: OperationRemovalOptions = {},
): StoredOperationRemovalResult {
  const operation = operations.find((item) => item.id === id)
  if (!operation) {
    return { ok: false, code: "not-found", message: "No se encontró la operación.", operations }
  }
  if (!options.confirmed) {
    return {
      ok: false,
      code: "confirmation-required",
      message: "Confirma la eliminación de la operación.",
      operations,
    }
  }
  if (operation.submission.wasEverPresented) {
    return {
      ok: false,
      code: "presented-operation",
      message: "Una operación presentada debe cancelarse y conservar su trazabilidad.",
      operations,
    }
  }

  const at = normalizeNow(options.at)
  const revision = operation.revision + 1
  const removed: StoredPldOperationV3 = {
    ...operation,
    revision,
    updatedAt: at,
    history: [
      ...operation.history,
      buildHistoryEntry({
        operationId: operation.id,
        revision,
        action: "deleted",
        at,
        actor: options.actor,
        reason: options.reason,
      }),
    ],
  }
  return {
    ok: true,
    action: "deleted",
    operations: operations.filter((item) => item.id !== id),
    operation: removed,
  }
}

export function cancelStoredPldOperation(
  operations: StoredPldOperationV3[],
  id: string,
  options: OperationRemovalOptions = {},
): StoredOperationRemovalResult {
  const operation = operations.find((item) => item.id === id)
  if (!operation) {
    return { ok: false, code: "not-found", message: "No se encontró la operación.", operations }
  }
  if (!operation.submission.wasEverPresented) {
    return {
      ok: false,
      code: "not-presented",
      message: "Una operación no presentada puede eliminarse; no requiere cancelación histórica.",
      operations,
    }
  }
  if (!options.confirmed) {
    return {
      ok: false,
      code: "confirmation-required",
      message: "Confirma la cancelación de la operación.",
      operations,
    }
  }
  const reason = cancellationReason(options)
  if (!reason) {
    return {
      ok: false,
      code: "correction-reason-required",
      message: "Indica el motivo de cancelación para conservar la trazabilidad.",
      operations,
    }
  }
  if (operation.lifecycle.status === "cancelled") {
    return { ok: true, action: "cancelled", operations, operation }
  }

  const at = normalizeNow(options.at)
  const revision = operation.revision + 1
  const candidate: StoredPldOperationV3 = {
    ...operation,
    revision,
    updatedAt: at,
    lifecycle: {
      status: "cancelled",
      cancelledAt: at,
      cancelledBy: optionalString(options.actor),
      cancellationReason: reason,
      archivedAt: at,
    },
    estadoOperacion: "cancelled",
    submission: {
      ...operation.submission,
      status: "cancelled",
      updatedAt: at,
    },
    history: operation.history,
  }
  const diff = operationDiff(operation, candidate)
  candidate.history = [
    ...operation.history,
    buildHistoryEntry({
      operationId: operation.id,
      revision,
      action: "cancelled",
      at,
      actor: options.actor,
      reason,
      before: diff.before,
      after: diff.after,
    }),
  ]
  return {
    ok: true,
    action: "cancelled",
    operations: operations.map((item) => (item.id === id ? candidate : item)),
    operation: candidate,
  }
}

export function deleteOrCancelStoredPldOperation(
  operations: StoredPldOperationV3[],
  id: string,
  options: OperationRemovalOptions = {},
) {
  const operation = operations.find((item) => item.id === id)
  if (!operation) {
    return {
      ok: false,
      code: "not-found",
      message: "No se encontró la operación.",
      operations,
    } satisfies StoredOperationRemovalResult
  }
  return operation.submission.wasEverPresented
    ? cancelStoredPldOperation(operations, id, options)
    : deleteStoredPldOperation(operations, id, options)
}

function alertForStatus(status: UmbralStatus) {
  if (status === "aviso") {
    return "Supera el umbral de aviso. Preparar aviso para el día 17 del mes inmediato siguiente y cerrar la ventana de acumulación."
  }
  if (status === "identificacion") {
    return "Supera el umbral de identificación. Integrar expediente y aplicar acumulación cuando corresponda."
  }
  return null
}

function unpresentedSubmissionStatus(
  operation: Pick<StoredPldOperationV3, "umbralStatus"> & Record<string, unknown>,
): PldOperationSubmissionStatus {
  return operation.umbralStatus === "aviso" || operation.sospecha24h === true
    ? "pending"
    : "not-required"
}

function recalculatedSubmission(
  operation: StoredPldOperationV3,
  status: UmbralStatus,
  at?: string,
) {
  if (operation.submission.wasEverPresented) return operation.submission
  const nextStatus = unpresentedSubmissionStatus({
    ...operation,
    umbralStatus: status,
  })
  if (nextStatus === operation.submission.status) return operation.submission
  return {
    ...operation.submission,
    status: nextStatus,
    updatedAt: normalizeNow(at),
  }
}

function derivedFallback(operation: StoredPldOperationV3) {
  const status: UmbralStatus =
    operation.avisoUmbralCentavos > 0 && operation.montoCentavos >= operation.avisoUmbralCentavos
      ? "aviso"
      : operation.identificacionUmbralCentavos > 0 &&
          operation.montoCentavos >= operation.identificacionUmbralCentavos
        ? "identificacion"
        : operation.umbralStatus
  return {
    status,
    umaDiaria: operation.umaDiaria,
    identificacionUmbralCentavos: operation.identificacionUmbralCentavos,
    avisoUmbralCentavos: operation.avisoUmbralCentavos,
    acumuladoClienteCentavos: operation.montoCentavos,
  }
}

function applyRecalculatedFields(
  operation: StoredPldOperationV3,
  patch: Partial<StoredPldOperationV3>,
  options: Required<Pick<RecalculateStoredOperationsOptions, "recordHistory">> & OperationMutationContext,
) {
  const candidate = { ...operation, ...patch, history: operation.history }
  const diff = operationDiff(operation, candidate)
  if (!hasDiff(diff)) return operation
  if (!options.recordHistory) return candidate

  const at = normalizeNow(options.at)
  const revision = operation.revision + 1
  return {
    ...candidate,
    revision,
    updatedAt: at,
    history: [
      ...operation.history,
      buildHistoryEntry({
        operationId: operation.id,
        revision,
        action: "recalculated",
        at,
        actor: options.actor,
        reason: "Recálculo cronológico de periodo, UMA, umbrales y acumulación.",
        before: diff.before,
        after: diff.after,
      }),
    ],
  }
}

/**
 * Recalcula en orden cronológico. Las canceladas no participan; una operación
 * presentada cierra la secuencia acumulable de su sujeto, cliente y actividad.
 */
export function recalculateStoredPldOperationsChronologically(
  operations: StoredPldOperationV3[],
  options: RecalculateStoredOperationsOptions = {},
) {
  const ordered = [...operations].sort(
    (left, right) =>
      left.fechaOperacion.localeCompare(right.fechaOperacion) ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  )
  const histories = new Map<string, StoredPldOperationV3[]>()
  const recordHistory = options.recordHistory ?? true

  return ordered.map((operation) => {
    if (operation.lifecycle.status === "cancelled") return operation
    const key = [
      storedPldSubjectIdentity(operation.sujetoObligado),
      operation.actividadKey,
      operation.rfc.toUpperCase(),
    ].join("\u0000")
    const historical = histories.get(key) ?? []
    let derived = derivedFallback(operation)
    let salida: ReturnType<typeof classifyAvisoSalida> | undefined

    try {
      const result = evaluarOperacionVulnerable({
        actividadKey: operation.actividadKey,
        clienteKey: operation.rfc.toUpperCase(),
        fechaOperacion: operation.fechaOperacion,
        montoMxn: centsToMoney(operation.montoCentavos),
        operacionesHistoricas: historical.map((item) => ({
          id: item.id,
          actividadKey: item.actividadKey,
          clienteKey: item.rfc.toUpperCase(),
          fechaOperacion: item.fechaOperacion,
          montoMxn: centsToMoney(item.montoCentavos),
        })),
      })
      derived = {
        status: result.status,
        umaDiaria: result.uma.diario,
        identificacionUmbralCentavos: coerceLegacyMoneyToCents(result.identificacionUmbralMxn),
        avisoUmbralCentavos: coerceLegacyMoneyToCents(result.avisoUmbralMxn),
        acumuladoClienteCentavos: coerceLegacyMoneyToCents(result.acumulacion.montoAcumuladoMxn),
      }
      salida = classifyAvisoSalida({
        status: result.status,
        fechaOperacion: operation.fechaOperacion,
        supuesto27Bis: operation.mismoGrupo && result.status === "aviso",
        sospecha24h: Boolean(operation.sospecha24h),
        evidenceCanClose:
          typeof operation.evidenciaCanClose === "boolean"
            ? operation.evidenciaCanClose
            : undefined,
      })
    } catch (_error) {
      salida = classifyAvisoSalida({
        status: derived.status,
        fechaOperacion: operation.fechaOperacion,
        supuesto27Bis: operation.mismoGrupo && derived.status === "aviso",
        sospecha24h: Boolean(operation.sospecha24h),
      })
    }

    const periodo = periodFromOperationDate(operation.fechaOperacion)
    const nextAlert = alertForStatus(derived.status)
    const alertaResuelta = !nextAlert
      ? true
      : operation.alerta === nextAlert
        ? operation.alertaResuelta
        : false
    const recalculated = applyRecalculatedFields(
      operation,
      {
        periodo,
        anio: Number(periodo.slice(0, 4)),
        mes: Number(periodo.slice(4, 6)),
        umaDiaria: derived.umaDiaria,
        identificacionUmbralCentavos: derived.identificacionUmbralCentavos,
        identificacionUmbralPesos: centsToMoney(derived.identificacionUmbralCentavos),
        avisoUmbralCentavos: derived.avisoUmbralCentavos,
        avisoUmbralPesos: centsToMoney(derived.avisoUmbralCentavos),
        umbralStatus: derived.status,
        acumuladoClienteCentavos: derived.acumuladoClienteCentavos,
        acumuladoCliente: centsToMoney(derived.acumuladoClienteCentavos),
        alerta: nextAlert,
        alertaResuelta,
        avisoSalidaTipo: salida?.tipo,
        avisoSalidaLabel: salida?.label,
        avisoSalidaDescripcion: salida?.descripcion,
        submission: recalculatedSubmission(operation, derived.status, options.at),
      },
      { ...options, recordHistory },
    )

    if (operation.submission.wasEverPresented) {
      histories.set(key, [])
    } else {
      histories.set(key, [...historical, recalculated])
    }
    return recalculated
  })
}

export function activeStoredPldOperations(operations: StoredPldOperationV3[]) {
  return operations.filter((operation) => operation.lifecycle.status === "active")
}

export function sumStoredOperationCents(operations: StoredPldOperationV3[]) {
  return activeStoredPldOperations(operations).reduce((total, operation) => {
    const next = total + operation.montoCentavos
    return assertSafeCents(next)
  }, 0)
}
