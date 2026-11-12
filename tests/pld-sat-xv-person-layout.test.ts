import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { unzipSync } from "fflate"
import XLSX from "xlsx"

import { PERSONA_OBJETO_TYPE_FIELD_ID } from "../lib/pld/sat-field-controls"
import {
  buildSatDynamicOperationForm,
  extractSatXlsmLayoutFromBuffer,
  fillSatXlsmTemplate,
  normalizeSatXlsmLayout,
} from "../lib/pld/sat-xlsm"
import type { SatXlsmLayout } from "../lib/pld/types"

// Verified against the current template linked by the official SAT/SPPLD page
// on 2026-11-11. That page distinguishes this version (through 2027-05-31)
// from the future format effective 2027-06-01; do not mix their coordinates.
// https://sppld.sat.gob.mx/pld/interiores/arrendamiento.html
// https://www.sat.gob.mx/minisitio/ActividadesVulnerables/documentos/Formatos/Fraccion_XV/arrendamiento.zip
const template = { templateId: "sat-fraccion-xv-arrendamiento", officialXlsmName: "Arrendamiento_v4_5.xlsm" }
const workbookBytes = readFileSync("public/sat-templates/sat-fraccion-xv-arrendamiento/Arrendamiento_v4_5.xlsm")
const published: SatXlsmLayout = JSON.parse(readFileSync("public/data/sat-xlsm-layouts/sat-fraccion-xv-arrendamiento.json", "utf8"))
const sheetName = "Persona Objeto del aviso"
const expectedColumns = [
  ["nombre", "B", true], ["apellido_paterno", "C", true], ["apellido_materno", "D", true],
  ["fecha_nacimiento", "E", false], ["rfc", "F", false], ["curp", "G", false],
  ["pais_nacionalidad", "H", true], ["actividad_economica", "I", true],
] as const

test("XV canonical PF fields match the eight original headers and ten input rows, not PM coordinates", () => {
  const workbook = XLSX.read(workbookBytes, { type: "buffer", cellFormula: true })
  const source = workbook.Sheets[sheetName]
  const extracted = extractSatXlsmLayoutFromBuffer(workbookBytes, template)
  const fields = extracted.sections.flatMap(section => section.fields)
  for (let row = 1; row <= 10; row++) {
    for (const [key, column, required] of expectedColumns) {
      const id = `persona_aviso.pf.${row === 1 ? "" : `${row}.`}${key}`
      const field = fields.find(value => value.id === id)
      assert.ok(field, `Missing official field ${id}`)
      assert.equal(field.sheetName, sheetName)
      assert.equal(field.cell, `${column}${18 + row}`)
      assert.equal(field.repeatGroup, "persona_objeto_pf")
      assert.equal(field.repeatIndex, row)
      assert.equal(field.repeatLimit, 10)
      assert.equal(field.source, "manual-sat-map")
      assert.equal(field.required, row === 1 && required)
      assert.equal(String(source[`${column}18`]?.v).trim().startsWith("*"), required)
      assert.equal(source[`A${18 + row}`]?.v, row, "The original row counter must identify each independent record")
    }
  }
  assert.match(String(source.B44?.v), /personas morales o fideicomisos/i, "The representative heading is not a PF heading")
})

test("published XV layout contains canonical PF mappings and keeps catalogs and cells unambiguous", () => {
  const layout = normalizeSatXlsmLayout(published)
  const fields = layout.sections.flatMap(section => section.fields)
  assert.equal(fields.filter(field => field.repeatGroup === "persona_objeto_pf").length, 80)
  for (const [key, column] of expectedColumns) {
    const field = fields.find(value => value.id === `persona_aviso.pf.${key}`)
    assert.equal(field?.cell, `${column}19`)
    assert.equal(field?.targetCell, `${sheetName}!${column}19`)
  }
  const pfCountry = fields.find(field => field.id === "persona_aviso.pf.pais_nacionalidad")!
  const pfActivity = fields.find(field => field.id === "persona_aviso.pf.actividad_economica")!
  assert.equal(pfCountry.optionListId, "Paises")
  assert.equal(pfActivity.optionListId, "Actividades")
  assert.ok(pfCountry.options?.some(value => value.includes("MX")))
  assert.ok(pfActivity.options?.some(value => value.includes("8240200")))
  assert.equal(new Set(fields.map(field => `${field.sheetName}!${field.cell}`)).size, fields.length)
  assert.deepEqual(normalizeSatXlsmLayout(layout), layout, "Repeated normalization must not duplicate fields or conditions")
})

test("XV PF prefill and actual XLSM export use B19:I19 and prune stale PM/representative branches without touching macros", () => {
  const form = buildSatDynamicOperationForm({
    template, layout: published,
    prefill: {
      clienteTipoPersona: "persona_fisica", clienteNombrePf: "ANA QA", clienteApellidoPaterno: "PRUEBA",
      clienteApellidoMaterno: "FLUJO", clienteRfc: "PUFA900101AB1", clientePais: "MEXICO,MX",
      clienteActividadEconomica: "8240200", clienteFechaNacimiento: "1990-01-01",
    },
  })
  assert.equal(form.initialValues[PERSONA_OBJETO_TYPE_FIELD_ID], "persona_fisica")
  assert.equal(form.initialValues["persona_aviso.pf.nombre"], "ANA QA")
  assert.equal(form.initialValues["persona_aviso.pf.apellido_paterno"], "PRUEBA")
  assert.equal(form.initialValues["persona_aviso.pf.rfc"], "PUFA900101AB1")
  const result = fillSatXlsmTemplate(workbookBytes, {
    template, layout: published,
    values: { ...form.initialValues, "persona_aviso.pm.razon_social": "STALE PM", "persona_aviso.representante.nombre": "STALE REPRESENTATIVE" },
  })
  const exported = XLSX.read(result.workbook, { type: "array", cellFormula: true }).Sheets[sheetName]
  assert.equal(exported.B19?.v, "ANA QA")
  assert.equal(exported.C19?.v, "PRUEBA")
  assert.equal(exported.D19?.v, "FLUJO")
  assert.equal(exported.F19?.v, "PUFA900101AB1")
  assert.ok(result.writtenCells.includes(`${sheetName}!I19`))
  assert.equal(result.writtenCells.includes(`${sheetName}!B33`), false)
  assert.equal(result.writtenCells.includes(`${sheetName}!B46`), false)
  assert.equal(exported.B33?.v, undefined)
  assert.equal(exported.B46?.v, undefined)
  assert.ok(!result.missingRequiredFields.some(id => id.startsWith("persona_aviso.pf.")))
  assert.ok(!result.missingRequiredFields.some(id => id.startsWith("persona_aviso.pm.") || id.startsWith("persona_aviso.representante.")))
  const before = unzipSync(workbookBytes), after = unzipSync(result.workbook)
  assert.deepEqual(after["xl/vbaProject.bin"], before["xl/vbaProject.bin"])
  assert.deepEqual(after["xl/styles.xml"], before["xl/styles.xml"])
  assert.deepEqual(after["xl/workbook.xml"], before["xl/workbook.xml"])
})
