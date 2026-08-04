import test from "node:test"
import assert from "node:assert/strict"

import {
  PLD_OPERATIONS_STORAGE_KEY,
  cancelStoredPldOperation,
  createStoredPldOperation,
  deleteOrCancelStoredPldOperation,
  editStoredPldOperation,
  filterStoredPldOperations,
  formatMoneyFromCents,
  listStoredPldOperations,
  loadStoredPldOperations,
  migrateStoredPldOperations,
  moneyToCentsOrThrow,
  parseMoneyToCents,
  recalculateStoredPldOperationsChronologically,
  sanitizeStoredPldOperation,
  type StoredPldOperationV3,
} from "../lib/pld"

const NOW = "2026-08-03T12:00:00.000Z"

function legacyOperation(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2,
    id: "op-legacy-001",
    actividadKey: "fraccion-viii-vehiculos",
    actividadNombre: "Fracción VIII – Vehículos",
    tipoCliente: "pf_residente",
    cliente: "José Álvarez",
    rfc: "aalj800101abc",
    mismoGrupo: false,
    periodo: "2026-05",
    mes: 5,
    anio: 2026,
    monto: 10_000_000,
    moneda: "MXN",
    monedaDescripcion: "Peso mexicano (MXN)",
    fechaOperacion: "2026-05-10",
    tipoOperacion: "Adquisición de automóvil",
    evidencia: "Contrato y transferencia",
    umaDiaria: 117.31,
    identificacionUmbralPesos: 376_565.1,
    avisoUmbralPesos: 753_130.2,
    umbralStatus: "aviso",
    acumuladoCliente: 10_000_000,
    alerta: "Preparar aviso",
    avisoPresentado: false,
    alertaResuelta: false,
    referenciaAviso: "AV-ÁGUILA-001",
    claveSujetoObligado: "AV-SO-01",
    satFieldValues: { "pago.monto": "10000000.00" },
    customLegacyField: { remains: true },
    ...overrides,
  }
}

function operation(overrides: Record<string, unknown> = {}) {
  const sanitized = sanitizeStoredPldOperation(legacyOperation(overrides), { now: NOW })
  assert.ok(sanitized)
  return sanitized
}

test("money parser preserves ten million pesos as exact integer cents", () => {
  for (const input of ["10000000", "10,000,000", "10,000,000.00"]) {
    const parsed = parseMoneyToCents(input)
    assert.equal(parsed.ok, true)
    if (parsed.ok) {
      assert.equal(parsed.cents, 1_000_000_000)
      assert.equal(parsed.decimal, "10000000.00")
    }
  }

  assert.equal(moneyToCentsOrThrow("$ 10,000,000.00"), 1_000_000_000)
  assert.equal(formatMoneyFromCents(1_000_000_000), "$10,000,000.00")
})

test("money parser rejects malformed grouping and more than two decimals", () => {
  const tooPrecise = parseMoneyToCents("10,000,000.001")
  assert.deepEqual(tooPrecise.ok ? null : tooPrecise.code, "too-many-decimals")
  assert.equal(parseMoneyToCents("10,00,000.00").ok, false)
  assert.equal(parseMoneyToCents("-10.00").ok, false)
  assert.equal(parseMoneyToCents("0", { allowZero: false }).ok, false)
})

test("legacy operations migrate in place to V3 without changing IDs or storage key", () => {
  const storageValues = new Map<string, string>([
    [PLD_OPERATIONS_STORAGE_KEY, JSON.stringify([legacyOperation()])],
  ])
  const writes: string[] = []
  const storage = {
    getItem(key: string) {
      return storageValues.get(key) ?? null
    },
    setItem(key: string, value: string) {
      writes.push(key)
      storageValues.set(key, value)
    },
  }

  const result = loadStoredPldOperations(storage, { now: NOW })

  assert.equal(result.migrated, true)
  assert.equal(result.operations.length, 1)
  assert.equal(result.operations[0].id, "op-legacy-001")
  assert.equal(result.operations[0].schemaVersion, 3)
  assert.equal(result.operations[0].montoCentavos, 1_000_000_000)
  assert.equal(result.operations[0].monto, 10_000_000)
  assert.equal(result.operations[0].periodo, "202605")
  assert.equal(result.operations[0].rfc, "AALJ800101ABC")
  assert.deepEqual(result.operations[0].customLegacyField, { remains: true })
  assert.equal(result.operations[0].history[0].action, "migrated")
  assert.deepEqual(writes, [PLD_OPERATIONS_STORAGE_KEY])

  const persisted = migrateStoredPldOperations(storageValues.get(PLD_OPERATIONS_STORAGE_KEY), {
    now: NOW,
  })
  assert.equal(persisted.migrated, false)
  assert.equal(persisted.operations[0].id, "op-legacy-001")
})

test("invalid stored JSON is not overwritten during read sanitization", () => {
  let writes = 0
  const result = loadStoredPldOperations({
    getItem: () => "{broken",
    setItem: () => {
      writes += 1
    },
  })
  assert.equal(result.operations.length, 0)
  assert.equal(typeof result.parseError, "string")
  assert.equal(writes, 0)
})

test("new operations start at revision one with a creation audit entry", () => {
  const created = createStoredPldOperation(legacyOperation({ schemaVersion: undefined }), {
    at: NOW,
    actor: "Capturista PLD",
  })
  assert.ok(created)
  assert.equal(created.revision, 1)
  assert.equal(created.createdAt, NOW)
  assert.equal(created.history.length, 1)
  assert.equal(created.history[0].action, "created")
  assert.equal(created.history[0].actor, "Capturista PLD")
})

test("V3 canonical cents override a stale legacy numeric mirror", () => {
  const migrated = operation({ montoCentavos: 1_000_000_000, monto: 99.99 })
  assert.equal(migrated.montoCentavos, 1_000_000_000)
  assert.equal(migrated.monto, 10_000_000)
})

test("editing preserves the ID, synchronizes cents and records correction before/after", () => {
  const presented = operation({
    avisoPresentado: true,
    presentedAt: "2026-06-17T10:00:00.000Z",
  })

  const blocked = editStoredPldOperation(presented, { monto: "9,999,999.00" })
  assert.equal(blocked.ok, false)
  if (!blocked.ok) assert.equal(blocked.code, "correction-reason-required")

  const result = editStoredPldOperation(
    presented,
    { monto: "10,000,000.00", fechaOperacion: "2026-06-03" },
    {
      at: "2026-08-03T14:00:00.000Z",
      actor: "Oficial PLD",
      correctionReason: "Corrección de fecha y monto contra escritura.",
    },
  )
  assert.equal(result.ok, true)
  if (!result.ok) return

  assert.equal(result.operation.id, presented.id)
  assert.equal(result.operation.revision, presented.revision + 1)
  assert.equal(result.operation.montoCentavos, 1_000_000_000)
  assert.equal(result.operation.monto, 10_000_000)
  assert.equal(result.operation.periodo, "202606")
  assert.equal(result.operation.submission.status, "correction-pending")
  assert.equal(result.operation.history.at(-1)?.action, "updated")
  assert.equal(result.operation.history.at(-1)?.before?.fechaOperacion, "2026-05-10")
  assert.equal(result.operation.history.at(-1)?.after?.fechaOperacion, "2026-06-03")
})

test("editing audit stores changed document metadata without nesting history or base64 payloads", () => {
  const initial = operation({
    documentosSoporte: [
      {
        id: "doc-1",
        requisito: "Contrato",
        notas: "Versión inicial",
        archivoNombre: "contrato.pdf",
        archivoContenido: "data:application/pdf;base64,CONTENIDO-MUY-GRANDE",
        fechaRegistro: "2026-05-10",
      },
    ],
  })

  const result = editStoredPldOperation(
    initial,
    {
      documentosSoporte: [
        {
          id: "doc-2",
          requisito: "Contrato",
          notas: "Versión corregida",
          archivoNombre: "contrato-corregido.pdf",
          archivoContenido: "data:application/pdf;base64,NUEVO-CONTENIDO-MUY-GRANDE",
          fechaRegistro: "2026-08-03",
        },
      ],
    },
    { at: NOW },
  )
  assert.equal(result.ok, true)
  if (!result.ok) return

  const event = result.operation.history.at(-1)
  const serializedAudit = JSON.stringify({ before: event?.before, after: event?.after })
  assert.equal(serializedAudit.includes("CONTENIDO-MUY-GRANDE"), false)
  assert.equal(serializedAudit.includes("NUEVO-CONTENIDO-MUY-GRANDE"), false)
  assert.equal(Object.hasOwn(event?.before ?? {}, "history"), false)
  assert.equal(Object.hasOwn(event?.after ?? {}, "history"), false)
  assert.equal(serializedAudit.includes("archivoContenidoOmitido"), true)
})

test("unpresented operations are deleted while ever-presented operations are cancelled", () => {
  const draft = operation({ id: "op-draft", avisoPresentado: false })
  const presented = operation({ id: "op-presented", avisoPresentado: true })

  const deleted = deleteOrCancelStoredPldOperation([draft, presented], draft.id, {
    confirmed: true,
    at: NOW,
  })
  assert.equal(deleted.ok, true)
  if (deleted.ok) {
    assert.equal(deleted.action, "deleted")
    assert.deepEqual(deleted.operations.map((item) => item.id), [presented.id])
  }

  const missingReason = cancelStoredPldOperation([presented], presented.id, {
    confirmed: true,
    at: NOW,
  })
  assert.equal(missingReason.ok, false)

  const cancelled = deleteOrCancelStoredPldOperation([presented], presented.id, {
    confirmed: true,
    reason: "El acto fue rescindido por las partes.",
    actor: "Oficial PLD",
    at: NOW,
  })
  assert.equal(cancelled.ok, true)
  if (cancelled.ok) {
    assert.equal(cancelled.action, "cancelled")
    assert.equal(cancelled.operation.lifecycle.status, "cancelled")
    assert.equal(cancelled.operation.submission.wasEverPresented, true)
    assert.equal(cancelled.operation.submission.status, "cancelled")
    assert.equal(cancelled.operation.history.at(-1)?.action, "cancelled")
  }
})

test("search is accent-insensitive and combines lifecycle, activity and period filters", () => {
  const active = operation({ id: "op-active", cliente: "José Álvarez", periodo: "2026-05" })
  const otherActivity = operation({
    id: "op-other",
    actividadKey: "fraccion-vi-metales",
    actividadNombre: "Fracción VI – Metales",
  })
  const cancelledBase = operation({ id: "op-cancelled", avisoPresentado: true })
  const cancelledResult = cancelStoredPldOperation([cancelledBase], cancelledBase.id, {
    confirmed: true,
    reason: "Cancelación de prueba",
    at: NOW,
  })
  assert.equal(cancelledResult.ok, true)
  const cancelled = cancelledResult.ok ? cancelledResult.operation : cancelledBase

  assert.deepEqual(
    filterStoredPldOperations([active, otherActivity, cancelled], {
      query: "jose alvarez 2026-05",
      status: "active",
      activityKey: "fraccion-viii-vehiculos",
      period: "2026-05",
    }).map((item) => item.id),
    ["op-active"],
  )
  assert.deepEqual(
    filterStoredPldOperations([active, otherActivity, cancelled], {
      query: "aguila",
      status: "cancelled",
    }).map((item) => item.id),
    ["op-cancelled"],
  )
})

test("unfiltered listing returns five recent active records; criteria return every match", () => {
  const operations = Array.from({ length: 7 }, (_, index) =>
    operation({
      id: `op-${index + 1}`,
      fechaOperacion: `2026-05-${String(index + 1).padStart(2, "0")}`,
    }),
  )
  const defaultList = listStoredPldOperations(operations)
  assert.equal(defaultList.hasCriteria, false)
  assert.equal(defaultList.items.length, 5)
  assert.equal(defaultList.matchingCount, 7)
  assert.equal(defaultList.items[0].id, "op-7")

  const filtered = listStoredPldOperations(operations, { activityKey: "fraccion-viii-vehiculos" })
  assert.equal(filtered.hasCriteria, true)
  assert.equal(filtered.items.length, 7)
  assert.equal(filtered.matchingCount, 7)
})

test("chronological recalculation excludes cancelled operations and uses exact cent mirrors", () => {
  const amountCents = 37_656_510
  const january = operation({
    id: "op-jan",
    fechaOperacion: "2026-01-15",
    montoCentavos: amountCents,
    monto: 1,
    avisoPresentado: false,
  })
  const cancelledBase = operation({
    id: "op-feb-cancelled",
    fechaOperacion: "2026-02-15",
    montoCentavos: amountCents,
    avisoPresentado: true,
  })
  const cancelledResult = cancelStoredPldOperation([cancelledBase], cancelledBase.id, {
    confirmed: true,
    reason: "Operación rescindida",
    at: NOW,
  })
  assert.equal(cancelledResult.ok, true)
  const cancelled = cancelledResult.ok ? cancelledResult.operation : cancelledBase
  const march = operation({
    id: "op-mar",
    fechaOperacion: "2026-03-10",
    montoCentavos: amountCents,
    monto: 1,
    avisoPresentado: false,
  })

  const recalculated = recalculateStoredPldOperationsChronologically(
    [march, cancelled, january],
    { at: NOW },
  )

  assert.deepEqual(recalculated.map((item) => item.id), ["op-jan", "op-feb-cancelled", "op-mar"])
  assert.equal(recalculated[0].montoCentavos, amountCents)
  assert.equal(recalculated[0].monto, 376_565.1)
  assert.equal(recalculated[0].umbralStatus, "identificacion")
  assert.equal(recalculated[1].lifecycle.status, "cancelled")
  assert.equal(recalculated[2].umbralStatus, "aviso")
  assert.equal(recalculated[2].acumuladoClienteCentavos, 75_313_020)
})

test("chronological recalculation starts a new accumulation window after a presented operation", () => {
  const amountCents = 37_656_510
  const january = operation({
    id: "op-window-jan",
    fechaOperacion: "2026-01-15",
    montoCentavos: amountCents,
    avisoPresentado: false,
  })
  const februaryPresented = operation({
    id: "op-window-feb",
    fechaOperacion: "2026-02-15",
    montoCentavos: amountCents,
    avisoPresentado: true,
  })
  const march = operation({
    id: "op-window-mar",
    fechaOperacion: "2026-03-15",
    montoCentavos: amountCents,
    avisoPresentado: false,
  })

  const recalculated = recalculateStoredPldOperationsChronologically(
    [march, februaryPresented, january],
    { recordHistory: false },
  )

  assert.equal(recalculated[1].umbralStatus, "aviso")
  assert.equal(recalculated[2].umbralStatus, "identificacion")
  assert.equal(recalculated[2].acumuladoClienteCentavos, amountCents)
})

test("chronological accumulation is isolated by obligated subject", () => {
  const amountCents = 37_656_510
  const subjectOne = operation({
    id: "op-subject-one",
    fechaOperacion: "2026-01-15",
    montoCentavos: amountCents,
    avisoPresentado: false,
    sujetoObligado: { id: "tenant-one", nombre: "Sujeto Uno" },
  })
  const subjectTwo = operation({
    id: "op-subject-two",
    fechaOperacion: "2026-02-15",
    montoCentavos: amountCents,
    avisoPresentado: false,
    sujetoObligado: { id: "tenant-two", nombre: "Sujeto Dos" },
  })

  const recalculated = recalculateStoredPldOperationsChronologically(
    [subjectTwo, subjectOne],
    { recordHistory: false },
  )

  assert.equal(recalculated[0].umbralStatus, "identificacion")
  assert.equal(recalculated[1].umbralStatus, "identificacion")
  assert.equal(recalculated[0].acumuladoClienteCentavos, amountCents)
  assert.equal(recalculated[1].acumuladoClienteCentavos, amountCents)
})

test("editing an unpresented operation synchronizes submission in both directions", () => {
  const internal = operation({
    id: "op-submission-edit",
    umbralStatus: "sin-obligacion",
    avisoPresentado: false,
    submission: {
      status: "not-required",
      wasEverPresented: false,
      updatedAt: "2026-05-10T00:00:00.000Z",
    },
  })

  const reportable = editStoredPldOperation(
    internal,
    { umbralStatus: "aviso" },
    { at: "2026-08-03T13:00:00.000Z" },
  )
  assert.equal(reportable.ok, true)
  if (!reportable.ok) return
  assert.equal(reportable.operation.submission.status, "pending")

  const backToInternal = editStoredPldOperation(
    reportable.operation,
    { umbralStatus: "sin-obligacion" },
    { at: "2026-08-03T14:00:00.000Z" },
  )
  assert.equal(backToInternal.ok, true)
  if (!backToInternal.ok) return
  assert.equal(backToInternal.operation.submission.status, "not-required")
})

test("chronological recalculation synchronizes submission for unpresented operations", () => {
  const amountCents = 37_656_510
  const first = operation({
    id: "op-submission-recalc-one",
    fechaOperacion: "2026-01-15",
    montoCentavos: amountCents,
    avisoPresentado: false,
    submission: {
      status: "pending",
      wasEverPresented: false,
      updatedAt: "2026-01-15T00:00:00.000Z",
    },
  })
  const second = operation({
    id: "op-submission-recalc-two",
    fechaOperacion: "2026-02-15",
    montoCentavos: amountCents,
    avisoPresentado: false,
    submission: {
      status: "not-required",
      wasEverPresented: false,
      updatedAt: "2026-02-15T00:00:00.000Z",
    },
  })

  const recalculated = recalculateStoredPldOperationsChronologically([second, first], {
    at: NOW,
    recordHistory: false,
  })

  assert.equal(recalculated[0].umbralStatus, "identificacion")
  assert.equal(recalculated[0].submission.status, "not-required")
  assert.equal(recalculated[1].umbralStatus, "aviso")
  assert.equal(recalculated[1].submission.status, "pending")
})
