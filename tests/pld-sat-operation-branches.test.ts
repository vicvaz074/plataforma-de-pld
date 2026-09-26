import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { buildSatDynamicOperationForm, normalizeSatXlsmLayout, satFieldValuesToWorkbookCells } from "../lib/pld/sat-xlsm"
import { getSatOperationBranchGroups, getSatOperationBranchMissingLabels, getSatPrimaryAmountFieldIds, getSatRepeatRowControlId, getSatRepeatRowGroups, withSatParticipantOptions } from "../lib/pld/sat-operation-branches"
import { hasSatTemplateWorkbook, resolveSatTemplateForActividad, SAT_TEMPLATE_CATALOG } from "../lib/pld/sat-template-catalog"
import { getSatCatalogValueCode, isSatXlsmFieldActive, isSatXlsmFieldRequired, pruneInactiveSatFieldValues } from "../lib/pld/ui-workflow"
import { buildStructuredSheetFields } from "../lib/pld/sat-xlsm-structure"
import { buildSatTemplateDemoScenarios, buildSatTemplateDemoScenarioValues } from "../lib/pld/sat-demo-scenarios"
import type { SatXlsmField, SatXlsmLayout } from "../lib/pld/types"

function layout(templateId: string): SatXlsmLayout {
  return normalizeSatXlsmLayout(JSON.parse(readFileSync(`public/data/sat-xlsm-layouts/${templateId}.json`, "utf8")))
}
function fieldAt(book: SatXlsmLayout, sheet: string, cell: string): SatXlsmField {
  const field = book.sections.find((s) => s.sheetName === sheet)?.fields.find((f) => f.cell === cell)
  assert.ok(field, `${book.templateId}/${sheet}!${cell}`)
  return field
}
function captureBranch(templateId: string, key: string): Record<string, string> {
  return { [`sat.branch.${templateId}.${key}`]: "si" }
}

test("VIII declares vehicle kinds explicitly: terrestrial does not require or export aircraft/marine data", () => {
  const book = layout("sat-fraccion-viii-vehiculos")
  const fields = book.sections.flatMap((s) => s.fields)
  const terrestrial = fieldAt(book, "Acto u operación", "C12")
  const marine = fieldAt(book, "Acto u operación", "C41")
  const aircraft = fieldAt(book, "Acto u operación", "C71")
  assert.equal(getSatOperationBranchMissingLabels(book.templateId, {}).length, 1)
  const values = { ...captureBranch(book.templateId, "terrestre"),
    [`sat.branch.${book.templateId}.maritimo`]: "no", [`sat.branch.${book.templateId}.aereo`]: "no",
    [terrestrial.id]: "MODELO TERRESTRE", [marine.id]: "OBSOLETO", [aircraft.id]: "OBSOLETO" }
  assert.equal(isSatXlsmFieldRequired(terrestrial, values), true)
  assert.equal(isSatXlsmFieldRequired(marine, values), false)
  assert.equal(isSatXlsmFieldRequired(aircraft, values), false)
  assert.deepEqual(getSatOperationBranchMissingLabels(book.templateId, values), [])
  const pruned = pruneInactiveSatFieldValues({ fields, values })
  assert.equal(pruned[marine.id], undefined)
  const cells = satFieldValuesToWorkbookCells(values, book)
  assert.equal(cells["Acto u operación!C12"], "MODELO TERRESTRE")
  assert.equal(cells["Acto u operación!C71"], undefined)
  assert.equal(Object.keys(cells).some((key) => key.startsWith("sat.")), false)
})

test("V separates a private contract from a public instrument and maps its number/date correctly", () => {
  const book = layout("sat-fraccion-v-inmuebles")
  const fields = book.sections.flatMap((section) => section.fields)
  const number = fields.find((field) => field.id === "instrumento.numero")!
  const date = fields.find((field) => field.id === "instrumento.fecha")!
  const contract = fields.find((field) => field.id === "instrumento.fecha_contrato")!
  assert.equal(number.cell, "B56")
  assert.equal(date.cell, "C56")
  const privateValues = captureBranch(book.templateId, "contrato")
  assert.equal(isSatXlsmFieldRequired(contract, privateValues), true)
  assert.equal(isSatXlsmFieldRequired(number, privateValues), false)
  const publicValues = { ...captureBranch(book.templateId, "instrumento-publico"), [number.id]: "123", [date.id]: "26/09/2026", [contract.id]: "STALE" }
  const cells = satFieldValuesToWorkbookCells(publicValues, book)
  assert.equal(cells["Acto u operación!B56"], "123")
  assert.equal(cells["Acto u operación!C56"], "26/09/2026")
  assert.equal(cells["Acto u operación!G56"], undefined)
})

test("IX blindaje independently activates a vehicle or a property", () => {
  const book = layout("sat-fraccion-ix-blindaje")
  const vehicle = fieldAt(book, "Acto u operación", "B12")
  const property = fieldAt(book, "Acto u operación", "C15")
  const vehicleValues = captureBranch(book.templateId, "vehiculo")
  assert.equal(isSatXlsmFieldRequired(vehicle, vehicleValues), true)
  assert.equal(isSatXlsmFieldActive(property, vehicleValues), false)
  const propertyValues = captureBranch(book.templateId, "inmueble")
  assert.equal(isSatXlsmFieldRequired(property, propertyValues), true)
  assert.equal(isSatXlsmFieldActive(vehicle, propertyValues), false)
})

test("V Bis activates only selected funding source, person and one contribution kind per row", () => {
  const book = layout("sat-fraccion-v-bis-desarrollo")
  const cash = fieldAt(book, "RecPropios", "D10")
  const inKind = fieldAt(book, "RecPropios", "H10")
  const lender = fieldAt(book, "PrestamoFin", "E9")
  const values = { ...captureBranch(book.templateId, "recpropios"), ...captureBranch(book.templateId, "recpropios.numerario.1") }
  assert.equal(isSatXlsmFieldRequired(cash, values), true)
  assert.equal(isSatXlsmFieldRequired(inKind, values), false)
  assert.equal(isSatXlsmFieldRequired(lender, values), false)
  assert.deepEqual(getSatOperationBranchMissingLabels(book.templateId, values), [])
  assert.equal(getSatOperationBranchMissingLabels(book.templateId, { ...values, ...captureBranch(book.templateId, "recpropios.especie.1") }).length, 1)
  const shareholders = { ...captureBranch(book.templateId, "socios"), ...captureBranch(book.templateId, "socios.pf") }
  assert.equal(isSatXlsmFieldRequired(fieldAt(book, "Socios", "D12"), shareholders), true)
  assert.equal(isSatXlsmFieldRequired(fieldAt(book, "Socios", "D25"), shareholders), false)
  assert.equal(isSatXlsmFieldRequired(fieldAt(book, "Socios", "D38"), shareholders), false)
  const prior = fieldAt(book, "Aviso", "B24")
  const modification = fieldAt(book, "Aviso", "C24")
  assert.equal(isSatXlsmFieldRequired(modification, { [prior.id]: "2,No" }), false)
  assert.equal(isSatXlsmFieldRequired(modification, { [prior.id]: "1,Si" }), true)
})

test("XVI isolates operation sheets and beneficiary/account choices per funds record", () => {
  const book = layout("sat-fraccion-xvi-activos-virtuales")
  const purchases = captureBranch(book.templateId, "compras")
  assert.equal(isSatXlsmFieldRequired(fieldAt(book, "Compras", "H9"), purchases), true)
  assert.equal(isSatXlsmFieldRequired(fieldAt(book, "Ventas", "H9"), purchases), false)
  assert.equal(isSatXlsmFieldRequired(fieldAt(book, "Fondos Retirados", "F15"), purchases), false)
  assert.equal(getSatPrimaryAmountFieldIds(book.sections.flatMap((s) => s.fields), purchases).length, 1)
  const funds = { ...captureBranch(book.templateId, "fondos-retirados"),
    ...captureBranch(book.templateId, "fondos-retirados.persona.1.pf"),
    ...captureBranch(book.templateId, "fondos-retirados.cuenta.1.nacional") }
  assert.deepEqual(getSatOperationBranchMissingLabels(book.templateId, funds), [])
  assert.equal(isSatXlsmFieldRequired(fieldAt(book, "Fondos Retirados", "C20"), funds), true)
  assert.equal(isSatXlsmFieldRequired(fieldAt(book, "Fondos Retirados", "F20"), funds), false)
  assert.equal(isSatXlsmFieldRequired(fieldAt(book, "Fondos Retirados", "H20"), funds), true)
  assert.equal(isSatXlsmFieldRequired(fieldAt(book, "Fondos Retirados", "J20"), funds), false)
})

test("IV prefill writes 10,000,000 once, not 50 disbursements; additional rows require explicit capture", () => {
  const template = resolveSatTemplateForActividad("fraccion-iv-prestamos")
  const book = layout(template.templateId)
  const form = buildSatDynamicOperationForm({ template, layout: book, prefill: { montoMxn: "10000000.00", fechaOperacion: "2026-09-26" } })
  const fields = form.sections.flatMap((s) => s.fields)
  const first = fieldAt(book, "Acto u operación", "E173")
  const second = fieldAt(book, "Acto u operación", "E174")
  assert.equal(form.initialValues[first.id], "10000000.00")
  assert.equal(form.initialValues[second.id], undefined)
  assert.equal(Object.values(form.initialValues).filter((value) => value === "10000000.00").length, 1)
  assert.equal(isSatXlsmFieldRequired(second, form.initialValues), false)
  const selected = { ...form.initialValues, [getSatRepeatRowControlId(second)]: "si" }
  assert.equal(isSatXlsmFieldRequired(second, selected), true)
  assert.ok(getSatRepeatRowGroups(fields, selected).some((group) => group.rows.some((row) => row.index === 2 && row.active)))
  const legacy = pruneInactiveSatFieldValues({ fields, values: { [second.id]: "5.00" } })
  assert.equal(legacy[second.id], "5.00")
  const removed = pruneInactiveSatFieldValues({ fields, values: { ...legacy, [getSatRepeatRowControlId(second)]: "no" } })
  assert.equal(removed[second.id], undefined)
})

test("effective-value pruning removes descendants of hidden stale controllers and all cell aliases", () => {
  const base = { sheetName: "Test", required: false, dataType: "texto" as const, source: "manual-sat-map" as const }
  const fields: SatXlsmField[] = [
    { ...base, id: "parent", label: "Parent", cell: "A1" },
    { ...base, id: "child", label: "Child", cell: "A2", activeWhen: [{ fieldId: "parent", equals: ["9"] }] },
    { ...base, id: "detail", label: "Detail", cell: "A3", activeWhen: [{ fieldId: "child", equals: ["99"] }] },
  ]
  assert.deepEqual(pruneInactiveSatFieldValues({ fields, values: { parent: "1", child: "99,Otro", detail: "STALE", "Test!A2": "99", "Test!A3": "STALE" } }), { parent: "1" })
  assert.equal(getSatCatalogValueCode("OTRA OCUPACIÓN||99"), "99")
})

test("OOXML text-length between uses formula2 as maximum, not formula1 minimum", () => {
  const fields = buildStructuredSheetFields({ sheetName: "Test", cells: { A1: "* Nombre" }, optionLists: [], validations: [
    { type: "textLength", sqref: ["B1"], formula1: "1", formula2: "200" },
  ] })
  assert.equal(fields.find((field) => field.cell === "B1")?.maxLength, 200)
})

test("a preselected Excel catalogue remains editable and merged inputs expose only their anchor", () => {
  const fields = buildStructuredSheetFields({ sheetName: "Test", cells: { B4: "* Ya se encuentra determinada?", C4: "NO", B6: "* Descripción" },
    optionLists: [{ id: "Modif", label: "Modif", sourceSheet: "Combos", sourceRange: "A1:A2", options: ["SI", "NO"] }],
    validations: [{ type: "list", sqref: ["C4"], formula1: "Modif", optionListId: "Modif" },
      { type: "textLength", sqref: ["C6:F6"], formula1: "1", formula2: "200" }], mergedRanges: ["C6:F6"] })
  assert.deepEqual(fields.map((field) => field.cell).sort(), ["C4", "C6"])
  assert.equal(fields.find((field) => field.cell === "C4")?.required, true)
  assert.deepEqual(fields.find((field) => field.cell === "C4")?.options, ["SI", "NO"])
})

test("XI-C maps to administration/accounts SPR03 and corporate SPR04 stays XI-E", () => {
  assert.equal(resolveSatTemplateForActividad("fraccion-xi-c-cuentas").officialXlsmName, "SPR03_AdministracionDeRecursos_v5_0.xlsm")
  const corporate = resolveSatTemplateForActividad("fraccion-xi-e-corporativo", "spr-04-constitucion-personas-morales")
  assert.equal(corporate.officialXlsmName, "SPR04_ConstitucionDePersonasMorales_v5_0.xlsm")
  assert.equal(corporate.variants.some((variant) => variant.actividadKeys.includes("fraccion-xi-c-cuentas")), false)
})

test("XI-A uses instrument 16 for virtual assets and independent party type instead of all figures", () => {
  const book = layout("sat-fraccion-xi-a-inmuebles")
  const fields = book.sections.flatMap((s) => s.fields)
  const instrument = fieldAt(book, "Operaciones financieras", "D7")
  const virtual = fieldAt(book, "Operaciones financieras", "F7")
  const currency = fieldAt(book, "Operaciones financieras", "E7")
  assert.equal(isSatXlsmFieldRequired(virtual, { [instrument.id]: "8,Transferencia Interbancaria" }), false)
  assert.equal(isSatXlsmFieldRequired(virtual, { [instrument.id]: "16,Activos virtuales" }), true)
  assert.equal(isSatXlsmFieldActive(currency, { [instrument.id]: "16,Activos virtuales" }), false)
  const partyGroup = getSatOperationBranchGroups(book.templateId, fields).find((group) => group.id.includes("personas."))
  assert.ok(partyGroup)
  const pm = partyGroup.options.find((option) => option.id.endsWith(".pm"))!
  const values = { [pm.id]: "si", "persona_objeto.tipo_persona": "persona_fisica" }
  assert.equal(isSatXlsmFieldRequired(fieldAt(book, "Acto u operación", "B44"), values), true)
  assert.equal(isSatXlsmFieldRequired(fieldAt(book, "Acto u operación", "B11"), values), false)
  assert.equal(isSatXlsmFieldRequired(fieldAt(book, "Acto u operación", "F44"), values), false)
})

test("XII company participants do not inherit the client's person kind", () => {
  const book = layout("sat-fraccion-xii-notarios-c")
  const fields = book.sections.flatMap((s) => s.fields)
  const group = getSatOperationBranchGroups(book.templateId, fields).find((item) => item.id.includes("personas."))!
  assert.ok(group)
  const values = { [group.options.find((item) => item.id.endsWith(".pf"))!.id]: "si", "persona_objeto.tipo_persona": "persona_moral" }
  assert.equal(isSatXlsmFieldRequired(fieldAt(book, "Persona Objeto del aviso", "B39"), values), true)
  assert.equal(isSatXlsmFieldRequired(fieldAt(book, "Persona Objeto del aviso", "B52"), values), false)
  assert.equal(isSatXlsmFieldRequired(fieldAt(book, "Persona Objeto del aviso", "B65"), values), false)
})

test("XII public servants choose one authority and one office address without mixing the client", () => {
  for (const id of ["sat-fraccion-xii-sp-poder", "sat-fraccion-xii-sp-modif-patrimonial"]) {
    const book = layout(id)
    const values = { ...captureBranch(id, "administrativa"), ...captureBranch(id, "oficina-nacional") }
    const administrative = fieldAt(book, "Aviso", "C23")
    const court = fieldAt(book, "Aviso", "F23")
    const exterior = fieldAt(book, "Aviso", "G33")
    const foreign = fieldAt(book, "Aviso", "B37")
    assert.equal(isSatXlsmFieldRequired(administrative, values), true)
    assert.equal(isSatXlsmFieldRequired(exterior, values), true)
    assert.equal(isSatXlsmFieldActive(court, values), false)
    assert.equal(isSatXlsmFieldActive(foreign, values), false)
    const opposite = { ...captureBranch(id, "jurisdiccional"), ...captureBranch(id, "oficina-extranjera") }
    assert.equal(isSatXlsmFieldActive(court, opposite), true)
    assert.equal(isSatXlsmFieldActive(foreign, opposite), true)
    assert.equal(isSatXlsmFieldActive(administrative, opposite), false)
    assert.equal(isSatXlsmFieldActive(exterior, opposite), false)
  }
})

test("demo values distinguish date-group IDs from money and preserve obligated-party RFC", () => {
  const scenario = buildSatTemplateDemoScenarios().find((item) => item.templateId === "sat-fraccion-iv-prestamos")!
  const book = layout(scenario.templateId)
  const { satFieldValues: values } = buildSatTemplateDemoScenarioValues({ scenario, layout: book })
  assert.equal(values[fieldAt(book, "Acto u operación", "E173").id], String(scenario.montoMxn))
  assert.equal(values[fieldAt(book, "Persona Objeto del aviso", "C4").id], scenario.tenantRfc)
  assert.equal(values["persona_objeto.tipo_persona"], "persona_moral")
  assert.match(values[fieldAt(book, "Persona Objeto del aviso", "C6").id], /^[A-Z0-9]{1,14}$/)
})

test("XII does not offer public-servant books to notaries and maps corporate/trust/loans to B/C/D brokers", () => {
  const notary = resolveSatTemplateForActividad("fraccion-xii-notarios-a")
  assert.equal(hasSatTemplateWorkbook(notary), false)
  assert.deepEqual(notary.variants, [])
  assert.ok(resolveSatTemplateForActividad("fraccion-xii-corredores-b").variants.some((variant) => variant.variantId === "fep-fusion"))
  assert.ok(resolveSatTemplateForActividad("fraccion-xii-corredores-c").variants.every((variant) => /fideicomiso/.test(variant.variantId)))
  assert.equal(resolveSatTemplateForActividad("fraccion-xii-corredores-d").officialXlsmName, "FedatarioMutuo_v4_4.xlsm")
  for (const variant of SAT_TEMPLATE_CATALOG.flatMap((item) => item.variants).filter((v) => v.officialXlsmName.includes("SP_"))) {
    assert.ok(variant.actividadKeys.every((key) => key.startsWith("fraccion-xii-servidores-")))
  }
})

test("XI-D and XI trust contributions reference actual participant rows, never arbitrary free text", () => {
  for (const [id, nameCell, linkCell] of [
    ["sat-fraccion-xi-d-aportaciones", "B12", "B80"],
    ["sat-fraccion-xi-e-fideicomisos", "B17", "B55"],
  ]) {
    const book = layout(id)
    const fields = book.sections.flatMap((s) => s.fields)
    const name = fieldAt(book, "Acto u operación", nameCell)
    const reference = fieldAt(book, "Acto u operación", linkCell)
    const control = name.activeWhen!.find((condition) => condition.fieldId.startsWith("sat.branch."))!
    const values = { [control.fieldId]: "si", [name.id]: "MARIA", [reference.id]: "R01 - MARIA" }
    const resolved = withSatParticipantOptions(fields, values).find((f) => f.id === reference.id)!
    assert.deepEqual(resolved.options, ["R01 - MARIA"])
    assert.equal(getSatOperationBranchMissingLabels(id, values, fields).some((label) => label.includes("participante vigente")), false)
    assert.equal(getSatOperationBranchMissingLabels(id, { ...values, [reference.id]: "R02 - NO EXISTE" }, fields).some((label) => label.includes("participante vigente")), true)
    assert.deepEqual(withSatParticipantOptions(fields, { ...values, [control.fieldId]: "no" }).find((f) => f.id === reference.id)?.options, [])
  }
})

test("XI other-kind contribution description is not tied to the real-estate 99 option", () => {
  for (const [id, cell] of [["sat-fraccion-xi-d-aportaciones", "L80"], ["sat-fraccion-xi-e-fideicomisos", "K55"]]) {
    const book = layout(id)
    const description = fieldAt(book, "Acto u operación", cell)
    const cash = captureBranch(id, "aportacion.1.monetario")
    const other = captureBranch(id, "aportacion.1.otro-bien")
    assert.equal(isSatXlsmFieldActive(description, cash), false)
    assert.equal(isSatXlsmFieldRequired(description, other), true)
    assert.equal(description.activeWhen?.some((condition) => condition.fieldId.includes("tipo-de-inmueble")), false)
  }
})

test("X requires recipient confirmation only for delivery and description for goods, not cash", () => {
  const book = layout("sat-fraccion-x-traslado")
  const type = fieldAt(book, "Acto u operación", "C6")
  const recipient = fieldAt(book, "Acto u operación", "E62")
  const kind = fieldAt(book, "Acto u operación", "B12")
  const description = fieldAt(book, "Acto u operación", "H12")
  assert.equal(isSatXlsmFieldRequired(recipient, { [type.id]: "1001,TRASLADO" }), true)
  assert.equal(isSatXlsmFieldRequired(recipient, { [type.id]: "1002,CUSTODIA" }), false)
  assert.equal(isSatXlsmFieldRequired(description, { [kind.id]: "BIENES U OBJETOS" }), true)
  assert.equal(isSatXlsmFieldActive(description, { [kind.id]: "EFECTIVO O INSTRUMENTO MONETARIO" }), false)
})
