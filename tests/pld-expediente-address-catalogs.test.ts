import assert from "node:assert/strict"
import test from "node:test"

import {
  EXPEDIENTE_TIPOS_VIALIDAD,
  applyExpedienteTipoVialidadCustomValue,
  applyExpedienteTipoVialidadSelection,
  getExpedienteTipoVialidadCustomValue,
  getExpedienteTipoVialidadSelection,
  normalizeExpedienteCatalogText,
  resolveExpedientePaisCode,
} from "../lib/pld/expediente-address-catalogs"

test("expediente uses the requested street-type catalog in its exact order", () => {
  assert.deepEqual(EXPEDIENTE_TIPOS_VIALIDAD, [
    "Calle",
    "Avenida",
    "Boulevard",
    "Calzada",
    "Carretera",
    "Circuito",
    "Privada",
    "Prolongación",
    "Andador",
    "Retorno",
    "Otro",
  ])
})

test("expediente street types normalize case, accents and surrounding whitespace", () => {
  assert.equal(normalizeExpedienteCatalogText("  PROLONGACIÓN  "), "prolongacion")
  assert.equal(getExpedienteTipoVialidadSelection("AVENIDA"), "Avenida")
  assert.equal(getExpedienteTipoVialidadSelection("prolongacion"), "Prolongación")
})

test("legacy and custom street types are exposed through Otro without losing their value", () => {
  assert.equal(getExpedienteTipoVialidadSelection("EJE VIAL"), "Otro")
  assert.equal(getExpedienteTipoVialidadCustomValue("EJE VIAL"), "EJE VIAL")
  assert.equal(getExpedienteTipoVialidadSelection(""), "")
  assert.equal(getExpedienteTipoVialidadCustomValue("Otro"), "")
})

test("selecting Otro preserves a custom value and selecting a catalog option clears it", () => {
  assert.equal(applyExpedienteTipoVialidadSelection("EJE VIAL", "Otro"), "EJE VIAL")
  assert.equal(applyExpedienteTipoVialidadSelection("Avenida", "Otro"), "Otro")
  assert.equal(applyExpedienteTipoVialidadSelection("EJE VIAL", "Calle"), "Calle")
})

test("the open Otro input stores its text in tipoVialidad and remains open when cleared", () => {
  assert.equal(applyExpedienteTipoVialidadCustomValue("Sendero peatonal"), "Sendero peatonal")
  assert.equal(applyExpedienteTipoVialidadCustomValue(""), "Otro")
  assert.equal(applyExpedienteTipoVialidadCustomValue("   "), "Otro")
})

test("legacy country names migrate to ISO codes without depending on accents", () => {
  assert.equal(resolveExpedientePaisCode("México"), "MX")
  assert.equal(resolveExpedientePaisCode("mexico"), "MX")
  assert.equal(resolveExpedientePaisCode("España"), "ES")
  assert.equal(resolveExpedientePaisCode("GB"), "GB")
  assert.equal(resolveExpedientePaisCode("País histórico"), "País histórico")
})
