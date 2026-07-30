import assert from "node:assert/strict"
import test from "node:test"

import {
  ARRENDAMIENTO_ACTIVITY_KEY,
  SAT_TIPOS_INMUEBLE,
  createLegacyExpedienteId,
  getActividadEuiLabel,
  getPrimaryExpedienteIdentifier,
  normalizeExpedienteIdentifiers,
  validateExpedienteIdentifiers,
} from "../lib/pld/expediente-eui"

test("EUI accepts the applicable identifier combinations by person type", () => {
  assert.equal(
    validateExpedienteIdentifiers({ curp: "GOCG650418HVZNMR07" }, true),
    null,
  )
  assert.equal(validateExpedienteIdentifiers({ nif: "ES-X1234567" }, true), null)
  assert.equal(validateExpedienteIdentifiers({ nif: "EU123456789" }, false), null)
  assert.match(validateExpedienteIdentifiers({}, true) ?? "", /RFC, NIF o CURP/)
  assert.match(validateExpedienteIdentifiers({ curp: "GOCG650418HVZNMR07" }, false) ?? "", /RFC o NIF/)
})

test("EUI normalizes identifiers and keeps a stable legacy id without depending on RFC", () => {
  const identifiers = normalizeExpedienteIdentifiers({ nif: " mx-abc/123 ", curp: "gocg650418hvznmr07" })
  assert.deepEqual(identifiers, { rfc: "", nif: "MX-ABC/123", curp: "GOCG650418HVZNMR07" })
  assert.equal(getPrimaryExpedienteIdentifier(identifiers), "MX-ABC/123")
  assert.equal(createLegacyExpedienteId("", "Cliente Extranjero"), "legacy-cliente-extranjero")
})

test("EUI keeps the exact activity key and the 19 official property options only for XV", () => {
  assert.equal(ARRENDAMIENTO_ACTIVITY_KEY, "fraccion-xv-uso-goce")
  assert.match(getActividadEuiLabel("fraccion-xi-b-administracion"), /Fracción XI/)
  assert.equal(SAT_TIPOS_INMUEBLE.length, 19)
  assert.equal(SAT_TIPOS_INMUEBLE.at(-1)?.code, "99")
})
