import assert from "node:assert/strict"
import test from "node:test"

import {
  buildSatQueueItems,
  removeLinkedSatPackage,
  upsertLinkedSatPackage,
} from "../lib/pld/sat-queue"
import { sanitizeStoredPldOperations } from "../lib/pld/stored-operations"
import type { SatOutputPackage } from "../lib/pld/types"

function satPackage(overrides: Partial<SatOutputPackage> = {}): SatOutputPackage {
  return {
    id: "satpkg-default",
    schemaVersion: 1,
    createdAt: "2026-08-01T12:00:00.000Z",
    tenantId: "tenant-1",
    tenantRfc: "SOA010101AA1",
    tenantName: "Sujeto obligado",
    periodo: "202608",
    formatoId: "formato-1",
    actividadKey: "fraccion-v-inmuebles",
    clienteNombre: "Cliente Uno",
    clienteRfc: "CUO010101AA1",
    outputKind: "aviso_normal",
    label: "Aviso normal",
    xml: "<archivo />",
    xmlFileName: "aviso.xml",
    ficha: "campo,valor",
    fichaFileName: "ficha.csv",
    validation: {
      status: "listo",
      missingFields: [],
      errors: [],
      warnings: [],
    },
    downloads: [],
    ...overrides,
  }
}

test("SAT queue shows reportable, identification and internal operations without inventing XML", () => {
  const linkedRevisionOne = satPackage({
    id: "satpkg-op-aviso-old",
    schemaVersion: 2,
    sourceOperationId: "op-aviso",
    sourceOperationRevision: 1,
  })
  const linkedRevisionTwo = satPackage({
    id: "satpkg-op-aviso",
    schemaVersion: 2,
    sourceOperationId: "op-aviso",
    sourceOperationRevision: 2,
    updatedAt: "2026-08-03T12:00:00.000Z",
  })
  const legacy = satPackage({ id: "satpkg-demo", clienteRfc: "MISMO010101AA1" })

  const items = buildSatQueueItems({
    operations: [
      {
        id: "op-aviso",
        revision: 2,
        actividadKey: "fraccion-v-inmuebles",
        actividadNombre: "Transmisión de inmuebles",
        cliente: "Cliente aviso",
        rfc: "MISMO010101AA1",
        periodo: "202608",
        fechaOperacion: "2026-08-03",
        montoCentavos: 1_000_000_000,
        umbralStatus: "aviso",
        avisoSalidaTipo: "aviso_normal",
      },
      {
        id: "op-identificacion",
        actividadKey: "fraccion-v-inmuebles",
        cliente: "Cliente identificación",
        periodo: "202608",
        fechaOperacion: "2026-08-02",
        umbralStatus: "identificacion",
      },
      {
        id: "op-interna",
        actividadKey: "fraccion-v-inmuebles",
        cliente: "Cliente interno",
        periodo: "202608",
        fechaOperacion: "2026-08-01",
        umbralStatus: "sin-obligacion",
      },
    ],
    packages: [linkedRevisionOne, linkedRevisionTwo, legacy],
  })

  const aviso = items.find((item) => item.sourceOperationId === "op-aviso" && item.source === "operation")
  const identificacion = items.find((item) => item.sourceOperationId === "op-identificacion")
  const interna = items.find((item) => item.sourceOperationId === "op-interna")
  const legacyItem = items.find((item) => item.packageId === "satpkg-demo")

  assert.equal(items.length, 4)
  assert.equal(aviso?.kind, "sat_output")
  assert.equal(aviso?.packageId, "satpkg-op-aviso")
  assert.equal(identificacion?.kind, "identification_only")
  assert.equal(identificacion?.label, "Sólo identificación")
  assert.equal(identificacion?.package, undefined)
  assert.equal(interna?.kind, "internal_record")
  assert.equal(interna?.label, "Registro interno")
  assert.equal(interna?.package, undefined)
  assert.equal(legacyItem?.source, "unlinked_package")
})

test("SAT queue never links a legacy package by matching RFC", () => {
  const items = buildSatQueueItems({
    operations: [
      {
        id: "op-reportable",
        actividadKey: "fraccion-v-inmuebles",
        cliente: "Cliente igual",
        rfc: "RFC010101AA1",
        periodo: "202608",
        umbralStatus: "aviso",
      },
    ],
    packages: [satPackage({ id: "legacy-rfc-match", clienteRfc: "RFC010101AA1" })],
  })

  const operationItem = items.find((item) => item.source === "operation")
  assert.equal(items.length, 2)
  assert.equal(operationItem?.kind, "sat_output")
  assert.equal(operationItem?.package, undefined)
})

test("SAT queue consumes the shared V3 operation sanitizer and canonical cents", () => {
  const operations = sanitizeStoredPldOperations(
    [
      {
        id: "legacy-identification",
        actividadKey: "fraccion-v-inmuebles",
        actividadNombre: "Transmisión de inmuebles",
        cliente: "Cliente legado",
        rfc: "CLE010101AA1",
        fechaOperacion: "2026-08-03",
        monto: 10_000_000,
        umbralStatus: "identificacion",
      },
    ],
    { now: "2026-08-03T18:00:00.000Z" },
  )
  const items = buildSatQueueItems({ operations, packages: [] })

  assert.equal(operations[0].schemaVersion, 3)
  assert.equal(items[0].montoCentavos, 1_000_000_000)
  assert.equal(items[0].label, "Sólo identificación")
  assert.equal(items[0].package, undefined)
})

test("linked SAT package upsert is deterministic and removal preserves legacy packages", () => {
  const legacy = satPackage({ id: "legacy" })
  const previous = satPackage({
    id: "satpkg-op-1",
    schemaVersion: 2,
    createdAt: "2026-07-01T00:00:00.000Z",
    sourceOperationId: "op-1",
    sourceOperationRevision: 1,
  })
  const duplicate = satPackage({
    id: "satpkg-op-1-duplicate",
    schemaVersion: 2,
    sourceOperationId: "op-1",
    sourceOperationRevision: 1,
  })
  const generated = satPackage({
    id: "satpkg-op-1",
    schemaVersion: 2,
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
    sourceOperationId: "op-1",
    sourceOperationRevision: 2,
  })

  const upserted = upsertLinkedSatPackage([legacy, previous, duplicate], generated)
  assert.equal(upserted.length, 2)
  assert.equal(upserted.find((item) => item.sourceOperationId === "op-1")?.sourceOperationRevision, 2)
  assert.equal(upserted.find((item) => item.sourceOperationId === "op-1")?.createdAt, previous.createdAt)

  const removed = removeLinkedSatPackage(upserted, "op-1")
  assert.deepEqual(removed.map((item) => item.id), ["legacy"])
})

test("linked package reconciliation preserves a manual override for the same source revision", () => {
  const overridden = satPackage({
    id: "satpkg-overridden",
    schemaVersion: 2,
    sourceOperationId: "op-overridden",
    sourceOperationRevision: 3,
    outputKind: "informe_27_bis",
    label: "Informe 27 Bis",
    satOutputOverride: {
      originalKind: "aviso_normal",
      requestedKind: "informe_27_bis",
      reason: "Criterio confirmado por cumplimiento.",
      user: "Oficial PLD",
      at: "2026-08-03T13:00:00.000Z",
    },
    validation: {
      status: "listo",
      missingFields: [],
      errors: [],
      warnings: ["Salida SAT corregida manualmente."],
    },
  })
  const regenerated = satPackage({
    id: "satpkg-regenerated",
    schemaVersion: 2,
    sourceOperationId: "op-overridden",
    sourceOperationRevision: 3,
    outputKind: "aviso_normal",
    label: "Aviso normal",
  })

  const result = upsertLinkedSatPackage([overridden], regenerated)

  assert.equal(result.length, 1)
  assert.equal(result[0].id, "satpkg-regenerated")
  assert.equal(result[0].outputKind, "informe_27_bis")
  assert.equal(result[0].label, "Informe 27 Bis")
  assert.equal(result[0].satOutputOverride?.reason, "Criterio confirmado por cumplimiento.")
  assert.equal(result[0].validation.warnings.includes("Salida SAT corregida manualmente."), true)
})

test("SAT queue preserves a linked package as historical evidence after reclassification", () => {
  const historicalPackage = satPackage({
    id: "satpkg-presented-reclassified",
    schemaVersion: 2,
    sourceOperationId: "op-presented-reclassified",
    sourceOperationRevision: 1,
  })
  const items = buildSatQueueItems({
    operations: [
      {
        id: "op-presented-reclassified",
        revision: 2,
        actividadKey: "fraccion-v-inmuebles",
        actividadNombre: "Transmisión de inmuebles",
        cliente: "Cliente reclasificado",
        rfc: "CRL010101AA1",
        periodo: "202608",
        umbralStatus: "sin-obligacion",
        avisoSalidaTipo: "sin_salida",
      },
    ],
    packages: [historicalPackage],
  })

  const operationItem = items.find((item) => item.source === "operation")
  const evidenceItem = items.find((item) => item.source === "unlinked_package")
  assert.equal(items.length, 2)
  assert.equal(operationItem?.kind, "internal_record")
  assert.equal(operationItem?.package, undefined)
  assert.equal(evidenceItem?.packageId, historicalPackage.id)
  assert.equal(evidenceItem?.sourceOperationId, "op-presented-reclassified")
  assert.match(evidenceItem?.description ?? "", /histórico conservado/i)
})
