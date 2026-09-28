import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { unzipSync } from "fflate"
import XLSX from "xlsx"
import { buildSatTemplateDemoScenarios, buildSatTemplateDemoScenarioValues } from "../lib/pld/sat-demo-scenarios"
import { normalizeSatXlsmLayout, satFieldValuesToWorkbookCells, fillSatXlsmTemplate } from "../lib/pld/sat-xlsm"
import { getSatTemplateCachePath } from "../lib/pld/sat-template-catalog"
import { getSatXmlProgramSource, renderSatWorkbookXml } from "../lib/pld/sat-xml-program"
import { validateGeneratedSatXml } from "../lib/pld/sat-xml-validation"

let success = 0
const results: Record<string, unknown>[] = []
const verifyWorkbooks = process.argv.includes("--verify-workbooks")
const filter = process.argv.slice(2).find((arg) => !arg.startsWith("--"))
for (const scenario of buildSatTemplateDemoScenarios()) {
  if (filter && !scenario.templateId.includes(filter)) continue
  const layout = normalizeSatXlsmLayout(JSON.parse(readFileSync(`public/data/sat-xlsm-layouts/${scenario.templateId}.json`, "utf8")))
  const values = buildSatTemplateDemoScenarioValues({ scenario, layout })
  const cells = satFieldValuesToWorkbookCells(values.satFieldValues, layout)
  const isPedimento = scenario.actividadKey.startsWith("fraccion-xiv-")
  const output = isPedimento ? { xml: "", errors: [] } : renderSatWorkbookXml(scenario.templateId, { ...values.satCellValues, ...cells })
  const validation = validateGeneratedSatXml(output.xml)
  const independent = !isPedimento && validation.schemaFile
    ? spawnSync("xmllint", ["--nonet", "--noout", "--schema", "tests/fixtures/sat-official/" + validation.schemaFile, "-"], { input: output.xml, encoding: "utf8" })
    : undefined
  const workbookErrors: string[] = []
  let checkedCells = 0
  if (verifyWorkbooks) {
    const original = readFileSync(getSatTemplateCachePath(scenario.template))
    const filled = fillSatXlsmTemplate(original, { template: scenario.template, layout, values: values.satFieldValues })
    if (filled.status !== "filled") workbookErrors.push(...filled.missingRequiredFields)
    const before = unzipSync(original), after = unzipSync(filled.workbook)
    if (before["xl/vbaProject.bin"] && !Buffer.from(before["xl/vbaProject.bin"]).equals(Buffer.from(after["xl/vbaProject.bin"] || []))) workbookErrors.push("Macros alteradas")
    const workbook = XLSX.read(filled.workbook, { type: "array", cellDates: false })
    for (const [key, expected] of Object.entries(cells)) {
      const split = key.lastIndexOf("!"), sheet = key.slice(0, split), address = key.slice(split + 1)
      const actual = workbook.Sheets[sheet]?.[address]?.v
      const field = layout.sections.flatMap((s) => s.fields).find((f) => f.sheetName === sheet && f.cell === address)
      if (field?.dataType === "fecha") continue // date serials independently covered by unit fixtures
      checkedCells++
      if (String(actual ?? "") !== expected && !(actual !== undefined && expected.trim() && Number.isFinite(Number(expected)) && Number(actual) === Number(expected))) workbookErrors.push(key + ": valor distinto al capturado")
    }
  }
  results.push({ templateId: scenario.templateId, activityKey: scenario.actividadKey, workbook: layout.officialXlsmName,
    source: getSatXmlProgramSource(scenario.templateId), layout: `public/data/sat-xlsm-layouts/${scenario.templateId}.json`,
    sections: layout.sections.map((section) => ({ name: section.sheetName, fields: section.fields.length,
      conditionalFields: section.fields.filter((field) => field.activeWhen?.length || field.requiredWhen?.length).length,
      catalogs: [...new Set(section.fields.flatMap((field) => field.optionListId || []))] })),
    scenario: "synthetic — not manual/browser acceptance", output: isPedimento ? "pedimento — no transaction XML" : "XML",
    xmlGenerated: Boolean(output.xml), xsdValid: isPedimento ? null : validation.valid,
    errors: isPedimento ? [] : [...output.errors, ...validation.errors],
    libxmlValid: independent ? !independent.error && independent.status === 0 : null,
    libxmlErrors: independent?.status ? independent.stderr : independent?.error?.message,
    manualCapture: "pending", browser: "pending",
    xlsmComparison: verifyWorkbooks ? { checkedCells, errors: workbookErrors, macrosUnchanged: !workbookErrors.includes("Macros alteradas") } : "pending" })
  if (process.env.PLD_XML_QA_DIR) {
    mkdirSync(process.env.PLD_XML_QA_DIR, { recursive: true })
    writeFileSync(`${process.env.PLD_XML_QA_DIR}/${scenario.templateId}.json`, JSON.stringify({ cells, errors: [...output.errors, ...validation.errors] }, null, 2))
    if (output.xml) writeFileSync(`${process.env.PLD_XML_QA_DIR}/${scenario.templateId}.xml`, output.xml)
  }
  if (output.errors.length) console.log(scenario.templateId, output.errors.join(" | "))
  else if (!isPedimento) { success++; console.log(scenario.templateId, "XML", output.xml.length) }
}
console.log({ generated: success, xsdValid: results.filter((result) => result.xsdValid).length, templates: results.length })
if (process.env.PLD_XML_QA_DIR) writeFileSync(`${process.env.PLD_XML_QA_DIR}/matrix.json`, JSON.stringify(results, null, 2) + "\n")
if (results.some((row) => row.xsdValid === false || (row.output === "XML" && row.libxmlValid !== true) ||
  (typeof row.xlsmComparison === "object" && (row.xlsmComparison as { errors: string[] }).errors.length))) process.exitCode = 1
