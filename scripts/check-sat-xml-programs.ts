import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { buildSatTemplateDemoScenarios, buildSatTemplateDemoScenarioValues } from "../lib/pld/sat-demo-scenarios"
import { normalizeSatXlsmLayout, satFieldValuesToWorkbookCells } from "../lib/pld/sat-xlsm"
import { getSatXmlProgramSource, renderSatWorkbookXml } from "../lib/pld/sat-xml-program"
import { validateGeneratedSatXml } from "../lib/pld/sat-xml-validation"

let success = 0
const results: Record<string, unknown>[] = []
for (const scenario of buildSatTemplateDemoScenarios()) {
  if (process.argv[2] && !scenario.templateId.includes(process.argv[2])) continue
  const layout = normalizeSatXlsmLayout(JSON.parse(readFileSync(`public/data/sat-xlsm-layouts/${scenario.templateId}.json`, "utf8")))
  const values = buildSatTemplateDemoScenarioValues({ scenario, layout })
  const cells = satFieldValuesToWorkbookCells(values.satFieldValues, layout)
  const isPedimento = scenario.actividadKey.startsWith("fraccion-xiv-")
  const output = isPedimento ? { xml: "", errors: [] } : renderSatWorkbookXml(scenario.templateId, { ...values.satCellValues, ...cells })
  const validation = validateGeneratedSatXml(output.xml)
  results.push({ templateId: scenario.templateId, activityKey: scenario.actividadKey, workbook: layout.officialXlsmName,
    source: getSatXmlProgramSource(scenario.templateId), layout: `public/data/sat-xlsm-layouts/${scenario.templateId}.json`,
    sections: layout.sections.map((section) => ({ name: section.sheetName, fields: section.fields.length,
      conditionalFields: section.fields.filter((field) => field.activeWhen?.length || field.requiredWhen?.length).length,
      catalogs: [...new Set(section.fields.flatMap((field) => field.optionListId || []))] })),
    scenario: "synthetic — not manual/browser acceptance", output: isPedimento ? "pedimento — no transaction XML" : "XML",
    xmlGenerated: Boolean(output.xml), xsdValid: isPedimento ? null : validation.valid,
    errors: isPedimento ? [] : [...output.errors, ...validation.errors],
    manualCapture: "pending", browser: "pending", xlsmComparison: "pending" })
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
