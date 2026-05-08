import test from "node:test"
import assert from "node:assert/strict"

import {
  ACTIVIDADES_VULNERABLES_ARTICULO_17,
  calcularFechaLimiteAvisoOrdinario,
  calcularFechaLimiteAvisoSospecha,
  evaluarOperacionVulnerable,
  getUmaForDate,
  matchPepCargo,
  pepCargoFixtures,
} from "../lib/pld"

test("UMA 2026 uses official INEGI daily, monthly and annual values", () => {
  const uma = getUmaForDate("2026-05-08")

  assert.equal(uma.diario, 117.31)
  assert.equal(uma.mensual, 3566.22)
  assert.equal(uma.anual, 42794.64)
  assert.equal(uma.source.includes("INEGI"), true)
})

test("Article 17 catalog keeps customs services under fraction XIV", () => {
  const customs = ACTIVIDADES_VULNERABLES_ARTICULO_17.find((item) => item.key === "fraccion-xiv-aduanal-a")

  assert.equal(customs?.fraccion, "Fracción XIV")
  assert.equal(customs?.nombre, "Servicios de comercio exterior - vehículos")
  assert.equal(customs?.avisoSiempre, true)
})

test("ordinary notices are due on the 17th day of the following month", () => {
  assert.equal(calcularFechaLimiteAvisoOrdinario("2026-05-12"), "2026-06-17")
})

test("suspicion notices are due within 24 hours after knowledge or suspicion", () => {
  assert.equal(calcularFechaLimiteAvisoSospecha("2026-05-08T09:30:00-06:00"), "2026-05-09T09:30:00.000-06:00")
})

test("SAT six-month accumulation only includes operations that meet identification threshold", () => {
  const firstIdentified = 3210 * 117.31
  const belowIdentification = 100000
  const secondIdentified = 3210 * 117.31

  const result = evaluarOperacionVulnerable({
    actividadKey: "fraccion-viii-vehiculos",
    clienteKey: "RFC123456AB1",
    fechaOperacion: "2026-03-10",
    montoMxn: secondIdentified,
    operacionesHistoricas: [
      {
        id: "op-jan",
        actividadKey: "fraccion-viii-vehiculos",
        clienteKey: "RFC123456AB1",
        fechaOperacion: "2026-01-15",
        montoMxn: firstIdentified,
      },
      {
        id: "op-feb",
        actividadKey: "fraccion-viii-vehiculos",
        clienteKey: "RFC123456AB1",
        fechaOperacion: "2026-02-01",
        montoMxn: belowIdentification,
      },
    ],
  })

  assert.equal(result.status, "aviso")
  assert.equal(result.acumulacion.operacionesConsideradas.length, 2)
  assert.equal(result.fechaLimiteAviso, "2026-04-17")
})

test("PEP cargo matching is accent-insensitive and returns review state", () => {
  const result = matchPepCargo(
    {
      cargo: "Director General del Instituto Mexicano del Transporte",
      dependencia: "Secretaria de Comunicaciones y Transportes",
    },
    pepCargoFixtures,
  )

  assert.equal(result.status, "coincidencia-cargo")
  assert.equal(result.requiresHumanReview, true)
  assert.equal(result.matches[0]?.cargo, "DIRECTOR GENERAL DEL INSTITUTO MEXICANO DEL TRANSPORTE")
})
