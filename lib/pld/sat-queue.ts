import type {
  AvisoSalidaTipo,
  SatOutputKind,
  SatOutputPackage,
  SatQueueItem,
  SatQueueItemKind,
  UmbralStatus,
} from "./types"

export interface SatQueueOperationSource {
  id: string
  revision?: number
  actividadKey: string
  actividadNombre?: string
  cliente: string
  rfc?: string
  periodo?: string
  fechaOperacion?: string
  monto?: number
  montoCentavos?: number
  umbralStatus?: UmbralStatus
  avisoSalidaTipo?: AvisoSalidaTipo
  sospecha24h?: boolean
  mismoGrupo?: boolean
  createdAt?: string
  updatedAt?: string
  lifecycle?: {
    status?: "active" | "cancelled"
  }
}

export interface BuildSatQueueItemsInput {
  operations: readonly SatQueueOperationSource[]
  packages: readonly SatOutputPackage[]
}

/**
 * Builds the SAT tray without guessing links from RFC, period or customer name.
 * Legacy packages and packages whose source operation is no longer available are
 * retained as independent rows so demo and historical evidence are never lost.
 */
export function buildSatQueueItems(input: BuildSatQueueItemsInput): SatQueueItem[] {
  const operationsById = new Map(input.operations.map((operation) => [operation.id, operation]))
  const linkedPackages = new Map<string, SatOutputPackage>()
  const independentPackages: SatOutputPackage[] = []

  for (const satPackage of input.packages) {
    const operationId = satPackage.sourceOperationId
    if (!operationId || !operationsById.has(operationId)) {
      independentPackages.push(satPackage)
      continue
    }

    const current = linkedPackages.get(operationId)
    if (!current || comparePackages(current, satPackage) < 0) {
      linkedPackages.set(operationId, satPackage)
    }
  }

  const operationItems = input.operations.map((operation) => {
    const kind = classifyOperationQueueKind(operation)
    const satPackage = kind === "sat_output" ? linkedPackages.get(operation.id) : undefined
    const outputKind = resolveOperationOutputKind(operation)
    const lifecycleStatus = operation.lifecycle?.status === "cancelled" ? "cancelled" : "active"

    return {
      id: `satqueue-operation-${operation.id}`,
      source: "operation" as const,
      kind,
      label: queueLabel(kind, outputKind, satPackage),
      description: queueDescription(kind, satPackage, lifecycleStatus),
      sourceOperationId: operation.id,
      sourceOperationRevision: operation.revision,
      operationStatus: operation.umbralStatus,
      lifecycleStatus,
      packageId: satPackage?.id,
      package: satPackage,
      actividadKey: operation.actividadKey,
      actividadNombre: operation.actividadNombre,
      clienteNombre: operation.cliente || "Cliente sin nombre",
      clienteRfc: operation.rfc,
      periodo: operation.periodo || derivePeriod(operation.fechaOperacion),
      fechaOperacion: operation.fechaOperacion,
      montoCentavos: resolveAmountCents(operation),
      createdAt: operation.createdAt,
      updatedAt: operation.updatedAt,
    } satisfies SatQueueItem
  })

  const historicalLinkedPackages = [...linkedPackages.entries()]
    .filter(([operationId]) => {
      const operation = operationsById.get(operationId)
      return operation && classifyOperationQueueKind(operation) !== "sat_output"
    })
    .map(([, satPackage]) => satPackage)

  const packageItems = [...independentPackages, ...historicalLinkedPackages].map(
    (satPackage, index) => {
      const currentOperation = satPackage.sourceOperationId
        ? operationsById.get(satPackage.sourceOperationId)
        : undefined
      const isHistoricalLinkedPackage = Boolean(
        currentOperation && classifyOperationQueueKind(currentOperation) !== "sat_output",
      )
      return {
        id: `satqueue-package-${satPackage.id}-${index}`,
        source: "unlinked_package",
        kind: "sat_output",
        label: satOutputKindLabel(satPackage.outputKind),
        description: isHistoricalLinkedPackage
          ? "Paquete SAT histórico conservado porque la operación cambió a una clasificación sin salida SAT."
          : satPackage.sourceOperationId
            ? "Paquete SAT histórico cuyo registro de origen ya no está disponible."
            : "Paquete SAT legacy o demo conservado sin vínculo a una operación.",
        sourceOperationId: satPackage.sourceOperationId,
        sourceOperationRevision: satPackage.sourceOperationRevision,
        packageId: satPackage.id,
        package: satPackage,
        actividadKey: satPackage.actividadKey,
        clienteNombre: satPackage.clienteNombre || satPackage.tenantName,
        clienteRfc: satPackage.clienteRfc,
        periodo: satPackage.periodo,
        createdAt: satPackage.createdAt,
        updatedAt: satPackage.updatedAt,
      } satisfies SatQueueItem
    },
  )

  return [...operationItems, ...packageItems].sort(compareQueueItems)
}

/** Replaces every prior package explicitly linked to the same operation. */
export function upsertLinkedSatPackage(
  existing: readonly SatOutputPackage[],
  generated: SatOutputPackage,
): SatOutputPackage[] {
  if (!generated.sourceOperationId) return [...existing, generated]

  const linked = existing.filter(
    (item) => item.sourceOperationId === generated.sourceOperationId,
  )
  const previous = [...linked].sort(
    (left, right) => comparableDate(left.createdAt) - comparableDate(right.createdAt),
  )[0]
  const current = [...linked].sort((left, right) => comparePackages(right, left))[0]
  const sameSourceRevision =
    current?.sourceOperationRevision === generated.sourceOperationRevision
  const preservedOverride = sameSourceRevision ? current?.satOutputOverride : undefined
  const base = previous?.createdAt ? { ...generated, createdAt: previous.createdAt } : generated
  const next = preservedOverride
    ? {
        ...base,
        outputKind: preservedOverride.requestedKind,
        label: current.label,
        satOutputOverride: preservedOverride,
        validation: {
          ...base.validation,
          warnings: Array.from(
            new Set([...base.validation.warnings, ...current.validation.warnings]),
          ),
        },
      }
    : base

  return [
    ...existing.filter((item) => item.sourceOperationId !== generated.sourceOperationId),
    next,
  ]
}

/** Removes only explicit links; legacy/demo packages are intentionally untouched. */
export function removeLinkedSatPackage(
  existing: readonly SatOutputPackage[],
  operationId: string,
): SatOutputPackage[] {
  return existing.filter((item) => item.sourceOperationId !== operationId)
}

function classifyOperationQueueKind(operation: SatQueueOperationSource): SatQueueItemKind {
  if (resolveOperationOutputKind(operation)) return "sat_output"
  if (operation.umbralStatus === "identificacion") return "identification_only"
  return "internal_record"
}

function resolveOperationOutputKind(operation: SatQueueOperationSource): SatOutputKind | null {
  if (
    operation.avisoSalidaTipo === "aviso_normal" ||
    operation.avisoSalidaTipo === "informe_27_bis" ||
    operation.avisoSalidaTipo === "aviso_24h"
  ) {
    return operation.avisoSalidaTipo
  }
  if (operation.sospecha24h) return "aviso_24h"
  if (operation.umbralStatus !== "aviso") return null
  return operation.mismoGrupo ? "informe_27_bis" : "aviso_normal"
}

function queueLabel(
  kind: SatQueueItemKind,
  outputKind: SatOutputKind | null,
  satPackage?: SatOutputPackage,
) {
  if (kind === "identification_only") return "Sólo identificación"
  if (kind === "internal_record") return "Registro interno"
  return satOutputKindLabel(satPackage?.outputKind || outputKind || "aviso_normal")
}

function queueDescription(
  kind: SatQueueItemKind,
  satPackage: SatOutputPackage | undefined,
  lifecycleStatus: "active" | "cancelled",
) {
  if (lifecycleStatus === "cancelled") {
    return satPackage
      ? "Operación cancelada o archivada; el paquete se conserva para trazabilidad."
      : "Operación cancelada o archivada conservada para trazabilidad."
  }
  if (kind === "identification_only") {
    return "La operación requiere identificación, pero no genera aviso ni XML SAT."
  }
  if (kind === "internal_record") {
    return "La operación se conserva para monitoreo interno, sin fabricar una salida SAT."
  }
  return satPackage
    ? "Salida SAT real vinculada a esta operación."
    : "Salida SAT pendiente de generación; las descargas permanecen deshabilitadas."
}

function satOutputKindLabel(kind: SatOutputKind) {
  if (kind === "informe_ceros") return "Informe en ceros"
  if (kind === "informe_27_bis") return "Informe 27 Bis"
  if (kind === "aviso_24h") return "Aviso 24 horas"
  return "Aviso normal"
}

function derivePeriod(fechaOperacion?: string) {
  const match = fechaOperacion?.match(/^(\d{4})-(\d{2})/)
  return match ? `${match[1]}${match[2]}` : ""
}

function resolveAmountCents(operation: SatQueueOperationSource) {
  if (Number.isSafeInteger(operation.montoCentavos) && (operation.montoCentavos || 0) >= 0) {
    return operation.montoCentavos
  }
  if (typeof operation.monto !== "number" || !Number.isFinite(operation.monto)) return undefined
  return Math.round(operation.monto * 100)
}

function comparePackages(left: SatOutputPackage, right: SatOutputPackage) {
  const revisionDifference = (left.sourceOperationRevision || 0) - (right.sourceOperationRevision || 0)
  if (revisionDifference !== 0) return revisionDifference
  const dateDifference = comparableDate(left.updatedAt || left.createdAt) - comparableDate(right.updatedAt || right.createdAt)
  if (dateDifference !== 0) return dateDifference
  return left.id.localeCompare(right.id)
}

function compareQueueItems(left: SatQueueItem, right: SatQueueItem) {
  const dateDifference = comparableDate(right.updatedAt || right.createdAt || right.fechaOperacion) -
    comparableDate(left.updatedAt || left.createdAt || left.fechaOperacion)
  if (dateDifference !== 0) return dateDifference
  return left.id.localeCompare(right.id)
}

function comparableDate(value?: string) {
  const time = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(time) ? time : 0
}
