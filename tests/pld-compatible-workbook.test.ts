import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { unzipSync, strFromU8 } from "fflate"
import * as XLSX from "xlsx"
import { buildCompatibleSatWorkbook, compatibleWorkbookFileName } from "../lib/pld/sat-compatible-workbook"
import { fillSatXlsmTemplate } from "../lib/pld/sat-xlsm"

test("XLSX compatible conserva $10M, listas y formato; elimina ActiveX/macros y habilita pestañas sin modificar el original", () => {
  const original = readFileSync("public/sat-templates/sat-fraccion-xv-arrendamiento/Arrendamiento_v4_5.xlsm")
  const filled = fillSatXlsmTemplate(original, { template: {templateId: "sat-fraccion-xv-arrendamiento", officialXlsmName: "Arrendamiento_v4_5.xlsm"}, values: { "Acto u operación!C12": "10000000.00" } })
  const before = unzipSync(filled.workbook)
  const compatible = buildCompatibleSatWorkbook(filled.workbook)
  const after = unzipSync(compatible)
  assert.ok(before["xl/vbaProject.bin"])
  assert.equal(Object.keys(after).some((name) => /activeX|vbaProject|vmlDrawing|ctrlProps/i.test(name)), false)
  assert.doesNotMatch(strFromU8(after["[Content_Types].xml"]), /macroEnabled|activeX|vbaProject/)
  assert.match(strFromU8(after["xl/workbook.xml"]), /showSheetTabs="1"/)
  assert.doesNotMatch(strFromU8(after["xl/workbook.xml"]), /<sheet name="Acto u operación"[^>]*state="hidden"/)
  for (const path of Object.keys(after).filter((name) => name.endsWith(".rels"))) assert.doesNotMatch(strFromU8(after[path]), /activeX|vbaProject|vmlDrawing|ctrlProps/)
  assert.deepEqual(after["xl/styles.xml"], before["xl/styles.xml"])
  for (const path of Object.keys(after).filter((name) => /^xl\/worksheets\/[^/]+\.xml$/.test(name))) {
    const a = strFromU8(after[path]), b = strFromU8(before[path])
    assert.equal(a.match(/<dataValidations[\s\S]*?<\/dataValidations>/)?.[0], b.match(/<dataValidations[\s\S]*?<\/dataValidations>/)?.[0])
    assert.doesNotMatch(a, /<controls\b|<oleObjects\b|<legacyDrawing\b/)
  }
  const workbook = XLSX.read(compatible, { type: "array", sheets: ["Acto u operación"] })
  assert.equal(workbook.Sheets["Acto u operación"].C12.v, "10000000.00")
  assert.equal(compatibleWorkbookFileName("aviso.xlsm"), "aviso-compatible.xlsx")
})
