import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { strFromU8, unzipSync } from "fflate"
import * as XLSX from "xlsx"
import { normalizeSatFieldValues } from "../lib/pld/sat-field-values"
import { fillSatXlsmTemplate, normalizeSatXlsmLayout, satFieldValuesToWorkbookCells } from "../lib/pld/sat-xlsm"
import type { SatXlsmLayout } from "../lib/pld/types"

const template = { templateId: "sat-fraccion-xv-arrendamiento", officialXlsmName: "Arrendamiento_v4_5.xlsm" }
const layout = normalizeSatXlsmLayout(JSON.parse(readFileSync(`public/data/sat-xlsm-layouts/${template.templateId}.json`, "utf8")) as SatXlsmLayout)
const fields = layout.sections.flatMap((section) => section.fields)

test("SAT admission canonicalizes cell aliases, preserves known legacy cents and rejects ambiguous duplicates", () => {
  const field = fields.find((candidate) => candidate.id === "pago.monto")!
  assert.ok(field)
  const key = `${field.sheetName}!${field.cell}`
  assert.deepEqual(normalizeSatFieldValues(fields, { [key.toLowerCase().replace(field.sheetName.toLowerCase(), field.sheetName)]: "10000000.01", [field.id]: "10000000.01" }), { [field.id]: "10000000.01" })
  assert.throws(() => normalizeSatFieldValues(fields, { [key]: "1", [field.id]: "2" }), /no coinciden/)
  assert.equal(normalizeSatFieldValues([], { "pago.monto": "10000000.01" })["pago.monto"], "10000000.01")
  const alert = fields.find((candidate) => candidate.id === "persona_aviso.tipo_alerta")!, alertCell = `${alert.sheetName}!${alert.cell}`
  for (const values of [{ [alertCell]: "100,SIN ALERTA.", [alert.id]: "100,Sin alerta." }, { [alert.id]: "100,Sin alerta.", [alertCell]: "100,SIN ALERTA." }]) {
    assert.equal(normalizeSatFieldValues(fields, values)[alert.id], "100,Sin alerta.")
  }
})

test("unknown fields, formula/numeric-only destinations and malformed A1 syntax never reach XML interpolation", () => {
  for (const key of ["persona_aviso.unknown", "sat.branch.unknown", "sat.row.unknown", "Acto u operación!1", "Acto u operación!A0", "Acto u operación!XFE1", "Acto u operación!A1048577", "Acto u operación!A1!B2", 'Acto u operación!A1\"/><c r=\"B2', "Acto u operación!A1.*", "Acto u operación!ZZ1000", "Combos!A1"]) {
    assert.throws(() => normalizeSatFieldValues(fields, { [key]: "unsafe" }), /SAT/, key)
    assert.throws(() => satFieldValuesToWorkbookCells({ [key]: "unsafe" }, layout), /SAT/, key)
  }
})

test("known virtual controls and explicit repeat-row values remain available without becoming workbook cells", () => {
  const repeated = fields.find((field) => (field.repeatIndex || 1) > 1)!
  assert.ok(repeated)
  const values = normalizeSatFieldValues(fields, { "persona_objeto.tipo_persona": "persona_moral", [repeated.id]: "fila adicional", "beneficiario.permitir_repetidos": "si" })
  assert.equal(values[repeated.id], "fila adicional")
  assert.equal(values["beneficiario.permitir_repetidos"], "si")
  const branch = fields.flatMap((field) => field.activeWhen || []).find((condition) => /^sat\.(?:branch|row)\./.test(condition.fieldId))!
  if (branch) assert.equal(normalizeSatFieldValues(fields, { [branch.fieldId]: branch.equals[0] })[branch.fieldId], branch.equals[0])
})

test("export rejects injected addresses with or without a supplied layout and treats replacement tokens as literal data", () => {
  const book = new Uint8Array(readFileSync(`public/sat-templates/${template.templateId}/${template.officialXlsmName}`))
  for (const optionalLayout of [layout, undefined]) assert.throws(() => fillSatXlsmTemplate(book, { template, layout: optionalLayout, values: { 'Acto u operación!C12\"/><c r=\"A1': "bad" } }), /SAT/)
  const field = fields.find((candidate) => candidate.id === "persona_aviso.referencia")!
  const value = "$&-$`-$'-<literal>"
  const result = fillSatXlsmTemplate(book, { template, layout, values: { [field.id]: value } })
  const entries = unzipSync(result.workbook)
  const xml = Object.entries(entries).filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).map(([, bytes]) => strFromU8(bytes)).join("")
  assert.ok(xml.includes("&lt;literal&gt;"))
  assert.equal(XLSX.read(result.workbook, { type: "array" }).Sheets[field.sheetName][field.cell].v, value)
  assert.equal(result.writtenCells.filter((cell) => cell === `${field.sheetName}!${field.cell}`).length, 1)
})
