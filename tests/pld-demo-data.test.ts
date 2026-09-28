import assert from "node:assert/strict"
import test from "node:test"
import { buildSatQueueItems } from "../lib/pld/sat-queue"
import { readFileSync } from "node:fs"
import { normalizeSatXlsmLayout, satFieldValuesToWorkbookCells } from "../lib/pld/sat-xlsm"
import { isSatXlsmFieldRequired } from "../lib/pld/ui-workflow"
import { validateGeneratedSatXml } from "../lib/pld/sat-xml-validation"

import {
  DEMO_STORAGE_KEYS,
  buildPldDemoDataset,
  clearPldDemoData,
  installPldDemoData,
} from "../lib/demo/pld-demo-data"

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }
}

test("PLD demo dataset keeps cross-module RFC and operations coherent", () => {
  const dataset = buildPldDemoDataset(new Date("2026-05-08T12:00:00-06:00"))
  const registro = dataset["registro-sat-data"] as any
  const expedientes = dataset.kyc_expedientes_detalle as any[]
  const operaciones = dataset.actividades_vulnerables_operaciones as any[]
  const evaluaciones = dataset.ebr_evaluaciones as Record<string, any>

  assert.equal(registro.sujetosRegistrados[0].identificacion.rfc, "ISN2103158Q7")
  assert.equal(expedientes.length, 2)
  assert.equal(operaciones.length, 3)

  const rfcsExpediente = new Set(expedientes.map((expediente) => expediente.rfc))
  assert.equal(rfcsExpediente.has("DLV190624M32"), true)
  assert.equal(operaciones.every((operacion) => rfcsExpediente.has(operacion.rfc)), true)
  assert.equal(Object.keys(evaluaciones).every((rfc) => rfcsExpediente.has(rfc)), true)
  assert.equal(operaciones.some((operacion) => operacion.umbralStatus === "aviso"), true)
  assert.equal(evaluaciones.ROGM780915K20.pepScreening.status, "coincidencia-cargo")
  assert.equal(operaciones.every((operacion) => !operacion.avisoPresentado), true)
})

test("demo guiada: tres estados, un paquete vinculado, XML con beneficiario y ninguna celda obligatoria ausente", () => {
  const dataset = buildPldDemoDataset()
  const operations = dataset.actividades_vulnerables_operaciones as any[]
  const packages = dataset["pld-sat-output-packages"] as any[]
  assert.deepEqual(operations.map((op) => op.montoCentavos), [4_000_000, 20_000_000, 40_000_000])
  assert.deepEqual(operations.map((op) => op.umbralStatus), ["sin-obligacion", "identificacion", "aviso"])
  assert.equal(packages.length, 1)
  assert.equal(packages[0].sourceOperationId, operations[2].id)
  assert.equal(packages[0].validation.status, "listo")
  assert.deepEqual(validateGeneratedSatXml(packages[0].xml).errors, [])
  assert.match(packages[0].xml, /ADRIANA/)
  assert.match(packages[0].xml, /<monto_operacion>400000\.00<\/monto_operacion>/)
  assert.match(packages[0].xml, /<valor_referencia>10000000\.00<\/valor_referencia>/)
  assert.equal(buildSatQueueItems({ operations, packages }).length, 3)
  const layout = normalizeSatXlsmLayout(JSON.parse(readFileSync("public/data/sat-xlsm-layouts/sat-fraccion-xv-arrendamiento.json", "utf8")))
  for (const op of operations) {
    const missing = layout.sections.flatMap((s) => s.fields).filter((f) => isSatXlsmFieldRequired(f, op.satFieldValues) && !op.satFieldValues[f.id])
    assert.deepEqual(missing.map((f) => f.id), [])
    const cells = satFieldValuesToWorkbookCells(op.satFieldValues, layout)
    for (const [cell, value] of Object.entries(op.satCellValues)) assert.equal(String(cells[cell]).toUpperCase(), value, cell)
    assert.equal(op.sujetoObligado.id, (dataset["registro-sat-data"] as any).sujetosRegistrados[0].id)
    assert.equal((dataset.kyc_expedientes_detalle as any[]).some((e) => e.expedienteId === op.expedienteReferenciado), true)
  }
})

test("PLD demo installer writes and clears only demo-owned keys", () => {
  const storage = new MemoryStorage()
  storage.setItem("language", "es")

  const result = installPldDemoData(storage, new Date("2026-05-08T12:00:00-06:00"))

  assert.equal(result.keysWritten.length, DEMO_STORAGE_KEYS.length)
  assert.equal(storage.getItem("registro-sat-data") !== null, true)
  assert.equal(storage.getItem("language"), "es")

  clearPldDemoData(storage)

  assert.equal(storage.getItem("registro-sat-data"), null)
  assert.equal(storage.getItem("language"), "es")
})

test("la demo conserva y restaura los datos previos en lugar de borrarlos", () => {
  const storage = new MemoryStorage()
  storage.setItem("registro-sat-data", '{"real":true}')
  storage.setItem("actividades_vulnerables_operaciones", '[{"id":"operacion-previa"}]')
  installPldDemoData(storage, new Date("2026-09-26T12:00:00Z"))
  installPldDemoData(storage, new Date("2026-09-26T12:00:00Z"))
  clearPldDemoData(storage)
  assert.equal(storage.getItem("registro-sat-data"), '{"real":true}')
  assert.equal(storage.getItem("actividades_vulnerables_operaciones"), '[{"id":"operacion-previa"}]')
})

test("la carga fallida por cuota no anuncia éxito y revierte escrituras parciales", () => {
  const storage = new MemoryStorage()
  storage.setItem("registro-sat-data", '{"real":true}')
  const original = storage.setItem.bind(storage)
  let failed = false
  storage.setItem = (key, value) => {
    if (key === "ebr_evaluaciones" && !failed) { failed = true; throw new Error("QuotaExceededError") }
    original(key, value)
  }
  assert.throws(() => installPldDemoData(storage), /QuotaExceededError/)
  assert.equal(storage.getItem("registro-sat-data"), '{"real":true}')
  assert.equal(storage.getItem("kyc_expedientes_detalle"), null)
})

test("la demo tiene IDs y fechas deterministas para el mismo corte", () => {
  const cutoff = new Date("2026-09-26T12:00:00Z")
  assert.deepEqual(buildPldDemoDataset(cutoff), buildPldDemoDataset(cutoff))
})
