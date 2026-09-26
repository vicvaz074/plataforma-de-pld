import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { revalidateStoredSatPackage } from "../lib/pld/sat-stored-validation"
import type { SatOutputPackage } from "../lib/pld/types"
import { buildSatPackageActionView } from "../lib/pld/ui-workflow"

test("legacy ready flags cannot enable generic invalid XML or override an independent workbook status", () => {
  const legacy = {
    xml: "<aviso><cliente>DEMO</cliente></aviso>",
    validation: { status: "listo", missingFields: [], errors: [], warnings: [] },
    downloads: [{ id: "xml", kind: "xml", label: "XML", status: "available" }, { id: "filled-workbook", kind: "filled_workbook", label: "XLSM", status: "available" }],
    satWorkbookStatus: "listo",
  } as Pick<SatOutputPackage, "xml" | "validation" | "downloads" | "satWorkbookStatus">
  const checked = revalidateStoredSatPackage(legacy)
  assert.equal(checked.validation.status, "borrador_bloqueado")
  assert.equal(checked.downloads[0].status, "blocked")
  assert.ok(checked.validation.errors.some((message) => message.includes("XSD")))
  assert.equal(checked.satWorkbookStatus, "listo")
  assert.equal(checked.downloads[1].status, "available")
  assert.equal(checked.xml, legacy.xml, "retain historical content without silently deleting it")
  assert.equal(legacy.validation.status, "listo", "reading must not mutate stored history")
  assert.equal(revalidateStoredSatPackage(checked).validation.errors.length, checked.validation.errors.length)
})

test("official XML is downloadable only when its captured package is also complete", () => {
  const xml = readFileSync("tests/fixtures/sat-official/ejemplo_tdr.xml", "utf8")
  const valid = { xml, validation: { status: "listo", missingFields: [], errors: [], warnings: [] }, downloads: [{ id: "xml", kind: "xml", label: "XML", status: "available" }] } as Pick<SatOutputPackage, "xml" | "validation" | "downloads">
  assert.equal(revalidateStoredSatPackage(valid).validation.status, "listo")
  assert.equal(revalidateStoredSatPackage({ ...valid, validation: { ...valid.validation, missingFields: ["Confirmar datos"] } }).downloads[0].status, "blocked")
})

test("workbook and XML actions have independent readiness gates", () => {
  const value = { xml: "<legacy/>", satFieldValues: { "aviso.fecha": "20260926" }, satWorkbookStatus: "listo", satMissingRequiredFields: [], validation: { status: "borrador_bloqueado", missingFields: [], errors: ["XML pendiente"], warnings: [] }, downloads: [] } as unknown as SatOutputPackage
  const actions = buildSatPackageActionView(value)
  assert.equal(actions.find((item) => item.id === "xml")?.enabled, false)
  assert.equal(actions.find((item) => item.id === "filled-workbook")?.enabled, true)
  const inverse = buildSatPackageActionView({ ...value, satWorkbookStatus: "pendiente", validation: { ...value.validation, status: "listo", errors: [] } })
  assert.equal(inverse.find((item) => item.id === "xml")?.enabled, true)
  assert.equal(inverse.find((item) => item.id === "filled-workbook")?.enabled, false)
})
