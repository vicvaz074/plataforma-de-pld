import assert from "node:assert/strict"
import test from "node:test"

import { CLIENTE_TIPOS, findClienteTipoOption, normalizeClienteTipo } from "../lib/data/tipos-cliente"
import { evaluateEvidenceChecklist, getDocumentRequirementsForCliente, normalizeClienteTipoForEvidence } from "../lib/pld/evidence"

test("EUI persisted labels and canonical catalog options resolve to the same client type", () => {
  for (const option of CLIENTE_TIPOS) {
    assert.equal(normalizeClienteTipo(option.value), option.value)
    assert.equal(normalizeClienteTipo(option.label), option.value)
    assert.equal(findClienteTipoOption(option.label)?.value, option.value)
  }
  for (const label of ["Persona Física Mexicana", " persona fisica mexicana ", "PERSONA   FÍSICA MEXICANA"]) {
    assert.equal(normalizeClienteTipo(label), "pf_residente")
    assert.equal(normalizeClienteTipoForEvidence(label), "pf_residente")
    assert.equal(findClienteTipoOption(label)?.value, "pf_residente")
  }
  assert.equal(normalizeClienteTipo("Persona Moral de Derecho Público"), "pm_derecho_publico")
  assert.equal(normalizeClienteTipo("Persona Moral Extranjera"), "pm_extranjera")
  assert.equal(normalizeClienteTipo("pfe"), "pf_visitante", "Preserve the explicit legacy visitor code")
  assert.equal(normalizeClienteTipo("Persona Física Extranjera"), "Persona Física Extranjera", "Nationality alone must not invent residence or visitor status")
  assert.equal(normalizeClienteTipo("unknown-customer-type"), "unknown-customer-type")
})

test("XV PF EUI uses natural-person evidence after reload and when switching from a PM client", () => {
  const activityKey = "fraccion-xv-uso-goce"
  const readPersisted = (tipoCliente: string) => JSON.parse(JSON.stringify({ tipoCliente })) as { tipoCliente: string }
  const moral = readPersisted("Persona moral mexicana")
  assert.ok(getDocumentRequirementsForCliente(moral.tipoCliente, activityKey).some(item => item.id === "pm-acta-constitutiva"))

  const fisica = readPersisted("Persona Física Mexicana")
  const requirements = getDocumentRequirementsForCliente(fisica.tipoCliente, activityKey)
  assert.deepEqual(requirements, getDocumentRequirementsForCliente("pf_residente", activityKey))
  assert.ok(requirements.some(item => item.id === "pf-identificacion-oficial"))
  assert.ok(requirements.some(item => item.id === "pf-curp-rfc"))
  assert.ok(requirements.some(item => item.id === "operacion-soporte"))
  assert.ok(requirements.some(item => item.id === "operacion-forma-pago"))
  assert.ok(!requirements.some(item => item.id.startsWith("pm-") || item.id.startsWith("pme-")))

  const incomplete = evaluateEvidenceChecklist({ requirements, completed: {} })
  assert.equal(incomplete.canSave, true, "Draft capture remains possible")
  assert.equal(incomplete.canClose, false, "Correcting client type does not bypass critical evidence")
  assert.ok(incomplete.missingCritical.some(item => item.id === "pf-identificacion-oficial"))
  const completed = Object.fromEntries(requirements.map(item => [item.id, true]))
  assert.equal(evaluateEvidenceChecklist({ requirements, completed }).canClose, true)
})
