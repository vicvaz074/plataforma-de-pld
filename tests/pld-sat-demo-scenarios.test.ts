import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import { unzipSync } from "fflate"

import {
  buildDefaultPldTenants,
  buildPldOperationalCase,
  buildSatTemplateDemoScenarioValues,
  buildSatTemplateDemoScenarios,
  buildSatWorkbookDownloadValues,
  extractSatXlsmLayoutFromBuffer,
  fillSatXlsmTemplate,
  generateSatOutputPackage,
  getConcreteSatTemplates,
  getSatTemplateCachePath,
} from "../lib/pld"
import { buildPldDemoDataset } from "../lib/demo/pld-demo-data"
import type { SatXlsmLayout } from "../lib/pld"
import { normalizeSatXlsmLayout, satFieldValuesToWorkbookCells } from "../lib/pld/sat-xlsm"
import { validateGeneratedSatXml } from "../lib/pld/sat-xml-validation"

const repoRoot = process.cwd()

function loadLayoutForTemplate(template: ReturnType<typeof getConcreteSatTemplates>[number]): SatXlsmLayout {
  const workbookPath = path.join(repoRoot, getSatTemplateCachePath(template))
  assert.equal(existsSync(workbookPath), true, `${template.templateId} debe tener XLSM cacheado`)
  return extractSatXlsmLayoutFromBuffer(readFileSync(workbookPath), template)
}

test("SAT demo scenarios cover every concrete cached XLSM template including XI and XII variants", () => {
  const concreteTemplates = getConcreteSatTemplates()
  const scenarios = buildSatTemplateDemoScenarios()
  const scenarioIds = new Set(scenarios.map((scenario) => scenario.templateId))

  assert.equal(concreteTemplates.length >= 40, true)
  assert.equal(scenarios.length, concreteTemplates.length)
  assert.equal(scenarioIds.has("sat-fraccion-xi-e-fusion"), true)
  assert.equal(scenarioIds.has("sat-fraccion-xii-sp-poder"), true)
  for (const template of concreteTemplates) assert.equal(scenarioIds.has(template.templateId), true)
})

test("SAT demo scenarios fill every required XLSM field and preserve macros", () => {
  const failures: string[] = []
  for (const scenario of buildSatTemplateDemoScenarios()) {
    const template = scenario.template
    const workbookPath = path.join(repoRoot, getSatTemplateCachePath(template))
    const layout = loadLayoutForTemplate(template)
    const scenarioValues = buildSatTemplateDemoScenarioValues({ scenario, layout })
    const workbookValues = buildSatWorkbookDownloadValues({
      satTemplateId: template.templateId,
      values: scenarioValues.satFieldValues,
      cellValues: scenarioValues.satCellValues,
      tenantRfc: scenario.tenantRfc,
      periodo: scenario.periodo,
      outputKind: "aviso_normal",
      clienteNombre: scenario.clienteNombre,
      clienteRfc: scenario.clienteRfc,
      packageId: scenario.id,
    })
    const filled = fillSatXlsmTemplate(readFileSync(workbookPath), {
      template,
      values: workbookValues,
      layout,
    })
    const originalMacros = unzipSync(readFileSync(workbookPath))["xl/vbaProject.bin"]
    const filledMacros = unzipSync(filled.workbook)["xl/vbaProject.bin"]

    if (filled.status !== "filled") failures.push(`${template.templateId}: ${filled.missingRequiredFields.slice(0, 6).join(", ")}`)
    if (originalMacros && (!filledMacros || !Buffer.from(originalMacros).equals(Buffer.from(filledMacros)))) failures.push(`${template.templateId}: alteró o perdió vbaProject.bin`)

    const fields = layout.sections.flatMap((section) => section.fields)
    for (const field of fields) {
      const value = scenarioValues.satFieldValues[field.id]
      if (!value || !field.options?.length) continue
      if (!field.options.includes(value)) {
        failures.push(`${template.templateId}: ${field.id} usa "${value}" fuera de la lista oficial`)
      }
    }
  }

  assert.deepEqual(failures, [])
})

test("SAT demo scenarios distinguish workbook capture from independently validated XML readiness", () => {
  const tenant = {
    ...buildDefaultPldTenants("tenant-demo-sat-i-xvi").tenants[0],
    id: "tenant-demo-sat-i-xvi",
    rfc: "FSC220908AC2",
    razonSocial: "Fixture SAT Demo I-XVI",
  }
  const failures: string[] = []

  for (const scenario of buildSatTemplateDemoScenarios()) {
    const layout = normalizeSatXlsmLayout(JSON.parse(readFileSync(path.join(repoRoot,
      `public/data/sat-xlsm-layouts/${scenario.templateId}.json`), "utf8")))
    const values = buildSatTemplateDemoScenarioValues({ scenario, layout })
    const operationalCase = buildPldOperationalCase({
      tenant,
      periodo: scenario.periodo,
      actividadKey: scenario.actividadKey,
      clienteId: `cliente-${scenario.clienteRfc}`,
      clienteNombre: scenario.clienteNombre,
      clienteRfc: scenario.clienteRfc,
      tipoCliente: "pm_mexicana",
      fechaOperacion: scenario.fechaOperacion,
      montoMxn: scenario.montoMxn,
      formaPago: scenario.formaPago,
      completedEvidence: scenario.completedEvidence,
      satTemplateId: scenario.templateId,
      satTemplateVariant: scenario.templateId,
      satTemplateFile: scenario.template.officialXlsmName,
      satFieldValues: values.satFieldValues,
      satCellValues: { ...values.satCellValues, ...satFieldValuesToWorkbookCells(values.satFieldValues, layout) },
      satMissingRequiredFields: [],
      satWorkbookStatus: "listo",
      actor: "Fixture SAT Demo I-XVI",
    })
    const satPackage = generateSatOutputPackage(operationalCase)
    const schema = validateGeneratedSatXml(satPackage.xml)
    // A synthetic complete workbook is not proof of an XML valid for SAT. The
    // package must fail closed when the actual XSD rejects it (or no XML exists).
    if (!schema.valid && satPackage.validation.status !== "borrador_bloqueado") {
      failures.push(`${scenario.templateId}: XML rechazado por XSD marcado como listo`)
    }
    if (!schema.valid && !satPackage.validation.errors.length) {
      failures.push(`${scenario.templateId}: bloqueo XML sin diagnóstico visible`)
    }
    if (satPackage.xml && !satPackage.xml.includes(`xsi:schemaLocation="`)) failures.push(`${scenario.templateId}: XML sin schemaLocation`)
    if (satPackage.xml && !satPackage.xml.includes("<clave_actividad>")) failures.push(`${scenario.templateId}: XML sin clave_actividad`)
    if (/tipo_salida|borrador_no_cargable|validacion|trazabilidad|formato_sat/.test(satPackage.xml)) {
      failures.push(`${scenario.templateId}: XML contiene etiquetas internas`)
    }
  }

  assert.deepEqual(failures, [])
})

test("full PLD demo dataset records every concrete template scenario without certifying synthetic data as SAT acceptance", () => {
  const dataset = buildPldDemoDataset(new Date("2026-05-14T12:00:00-06:00"))
  const packages = dataset["pld-sat-output-packages"] as Array<{ satDemoScenarioId?: string; workbookValidationStatus?: string }>
  const scenarioPackages = packages.filter((item) => item.satDemoScenarioId?.startsWith("sat-demo-"))

  assert.equal(scenarioPackages.length, getConcreteSatTemplates().length)
  assert.equal(
    scenarioPackages.every((item) => item.workbookValidationStatus === "strict_synthetic" || item.workbookValidationStatus === "golden_fixture"),
    true,
  )
})
