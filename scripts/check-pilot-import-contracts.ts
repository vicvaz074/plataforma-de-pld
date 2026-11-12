import { readFileSync, writeFileSync } from "node:fs"
import * as XLSX from "xlsx"
import { buildSatTemplateDemoScenarios, buildSatTemplateDemoScenarioValues } from "../lib/pld/sat-demo-scenarios"
import { normalizeSatXlsmLayout, satFieldValuesToWorkbookCells } from "../lib/pld/sat-xlsm"
import { parseOperationImport } from "../lib/pld/import-operations"
import { IMPORT_CLIENT_LINK_MISSING, resolveImportRowClient } from "../lib/pld/import-client-resolution"

/** Lightweight contract probe, not manual/browser or official workbook acceptance.
 * Builds minimal books from cached layout addresses to independently exercise the importer. */
async function main() {
  const matrix: Array<Record<string, unknown>> = []
  for (const scenario of buildSatTemplateDemoScenarios()) {
    const layout = normalizeSatXlsmLayout(JSON.parse(readFileSync(`public/data/sat-xlsm-layouts/${scenario.templateId}.json`, "utf8")))
    const values = buildSatTemplateDemoScenarioValues({ scenario, layout })
    const cells = { ...values.satCellValues, ...satFieldValuesToWorkbookCells(values.satFieldValues, layout) }
    const workbook = XLSX.utils.book_new()
    for (const sheetName of [...new Set(layout.sections.map((section) => section.sheetName))]) {
      const sheet: XLSX.WorkSheet = {}
      for (const [coordinate, value] of Object.entries(cells)) {
        const split = coordinate.lastIndexOf("!")
        if (coordinate.slice(0, split) === sheetName) XLSX.utils.sheet_add_aoa(sheet, [[value]], { origin: coordinate.slice(split + 1) })
      }
      XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
    }
    try {
      const preview = await parseOperationImport({
        bytes: new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" })), fileName: scenario.template.officialXlsmName.replace(/\.xlsm$/i, ".xlsx"),
        templateId: scenario.templateId, layouts: [layout], context: { companyId: "qa-company", companyName: scenario.tenantName,
          companyRfc: scenario.tenantRfc, actor: "contract-fixture", activityKey: scenario.actividadKey, now: "2026-11-11T12:00:00Z" },
      })
      const unlinked=preview.rows[0]
      if(!unlinked.issues.includes(IMPORT_CLIENT_LINK_MISSING)||unlinked.operation.captureStatus!=="draft") throw new Error("Importación sin resolución explícita del cliente no quedó como borrador")
      const clientId=`qa-client-${scenario.templateId}`
      const row=resolveImportRowClient(unlinked,{kind:"client",id:clientId},[{id:clientId,kind:"client",nombre:unlinked.operation.cliente,
        identifiers:unlinked.operation.expedienteIdentifiers||unlinked.operation.identifiers||{rfc:unlinked.operation.rfc},tipoCliente:unlinked.operation.tipoCliente}])
      matrix.push({ templateId: scenario.templateId, activityKey: scenario.actividadKey, status: row.status,
        clientLink: "explicit stable ID resolution in fixture; unlinked input remains draft",
        client: row.operation.cliente, identifiers: row.operation.identifiers, amountCentavos: row.operation.montoCentavos,
        date: row.operation.fechaOperacion, currency: row.operation.moneda, instrument: row.operation.liquidacion,
        retainedFields: Object.keys(row.operation.satFieldValues || {}).length, issues: row.issues })
    } catch (error) { matrix.push({ templateId: scenario.templateId, error: error instanceof Error ? error.message : String(error) }) }
  }
  const output = process.env.PLD_IMPORT_QA_FILE
  if (output) writeFileSync(output, JSON.stringify({ scope: "synthetic layout/import contract only; manual browser acceptance pending", matrix }, null, 2) + "\n")
  for (const row of matrix) console.log(row.templateId, row.error || row.status, JSON.stringify(row.issues || []))
  console.log(JSON.stringify({ templates: matrix.length, valid: matrix.filter((row) => row.status === "valid").length, incomplete: matrix.filter((row) => row.status === "incomplete").length, errors: matrix.filter((row) => row.error).length }))
  if (matrix.some((row) => row.error)) process.exitCode = 1
}
void main()
