import assert from "node:assert/strict"
import test from "node:test"

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
  assert.equal(expedientes.length >= 3, true)
  assert.equal(operaciones.length >= 5, true)

  const rfcsExpediente = new Set(expedientes.map((expediente) => expediente.rfc))
  assert.equal(rfcsExpediente.has("DLV190624M32"), true)
  assert.equal(operaciones.every((operacion) => rfcsExpediente.has(operacion.rfc)), true)
  assert.equal(Object.keys(evaluaciones).every((rfc) => rfcsExpediente.has(rfc)), true)
  assert.equal(operaciones.some((operacion) => operacion.umbralStatus === "aviso"), true)
  assert.equal(operaciones.some((operacion) => operacion.pepScreening?.status === "coincidencia-cargo"), true)
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
