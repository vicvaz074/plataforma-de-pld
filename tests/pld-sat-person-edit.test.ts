import assert from "node:assert/strict"
import test from "node:test"
import { applySatPersonEdit, applySatBeneficiaryEdit } from "../lib/pld/sat-person-edit"
import type { SatXlsmField } from "../lib/pld/types"
import { buildSatQuestionnaireDedupedFieldView, buildSatQuestionnaireFieldView } from "../lib/pld/ui-workflow"
const field = (label: string, group = "persona-fisica-r19", index = 1) => ({id: `persona-objeto-del-aviso.${group}.dato.f19`, label, sectionKind: "persona_objeto", repeatGroup: group, repeatIndex: index} as SatXlsmField)
test("SAT client edits preserve separate client, representative and address snapshots", () => {
  const original = {tipo: "persona_fisica", nombre: "Ana", rfc: "CLIENTE", representante: {rfc: "REPRESENTANTE"}, domicilio: {calle: "Anterior"}}
  assert.equal(applySatPersonEdit(original, field("Nombre(s)"), "María").nombre, "María")
  const rep = applySatPersonEdit(original, field("RFC", "datos-del-representate-r55"), "NUEVO")
  assert.equal(rep.rfc, "CLIENTE")
  assert.equal(rep.representante.rfc, "NUEVO")
  assert.equal(applySatPersonEdit(original, field("Calle, avenida o vía", "domicilio-nacional-r104"), "Reforma").domicilio.calle, "Reforma")
})
test("SAT subject RFC, additional client rows and property fields never overwrite EUI client", () => {
  const original = {tipo: "persona_moral", rfc: "CLIENTE"}
  assert.equal(applySatPersonEdit(original, {...field("RFC", ""), id:"persona-objeto-del-aviso.rfc.c4"}, "SUJETO"), original)
  assert.equal(applySatPersonEdit(original, field("RFC", "persona-moral-r37", 2), "OTRO"), original)
  assert.equal(applySatPersonEdit(original, {...field("RFC"), sectionKind:"acto_operacion"}, "ACTO"), original)
})
test("beneficiary edits update the confirmation snapshot without replacing another beneficiary", () => {
  const beneficiary = {tipo: "persona_moral", nombre: "Anterior", rfc: "BC"}
  const bcField = {...field("Denominación o razón social"), sectionKind: "beneficiario_controlador" as const}
  assert.equal(applySatBeneficiaryEdit(beneficiary, bcField, "Nueva sociedad").nombre, "Nueva sociedad")
  assert.equal(applySatBeneficiaryEdit(beneficiary, {...bcField, repeatIndex: 2}, "Segunda sociedad"), beneficiary)
  assert.equal(applySatBeneficiaryEdit(beneficiary, field("RFC"), "CLIENTE"), beneficiary)
})
test("questionnaire deduplication retains branch controllers outside the active section", () => {
  const branch = "sat.branch.sat-fraccion-viii-vehiculos.terrestre"
  const vehicle = {...field("Modelo", "vehiculo-terrestre-r12"), sectionKind: "acto_operacion" as const, required: true, activeWhen: [{fieldId: branch, equals: ["si"]}]}
  const deduped = buildSatQuestionnaireDedupedFieldView({fields:[vehicle], values:{[branch]:"si"}, missingRequiredIds:[vehicle.id]})
  assert.equal(deduped.values[branch], "si")
  assert.deepEqual(buildSatQuestionnaireFieldView({fields:deduped.fields,values:deduped.values,missingRequiredIds:deduped.missingRequiredIds}).visibleFieldIds, [vehicle.id])
  assert.deepEqual(buildSatQuestionnaireFieldView({fields:deduped.fields,values:{...deduped.values,[branch]:"no"},missingRequiredIds:deduped.missingRequiredIds}).visibleFieldIds, [])
})
