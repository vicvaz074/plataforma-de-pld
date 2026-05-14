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
    const originalHasMacros = Boolean(unzipSync(readFileSync(workbookPath))["xl/vbaProject.bin"])
    const filledHasMacros = Boolean(unzipSync(filled.workbook)["xl/vbaProject.bin"])

    if (filled.status !== "filled") failures.push(`${template.templateId}: ${filled.missingRequiredFields.slice(0, 6).join(", ")}`)
    if (originalHasMacros && !filledHasMacros) failures.push(`${template.templateId}: perdió vbaProject.bin`)

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

test("SAT demo scenarios generate official XML packages without internal platform tags", () => {
  const tenant = {
    ...buildDefaultPldTenants("tenant-demo-sat-i-xvi").tenants[0],
    id: "tenant-demo-sat-i-xvi",
    rfc: "FSC220908AC2",
    razonSocial: "Fixture SAT Demo I-XVI",
  }
  const failures: string[] = []

  for (const scenario of buildSatTemplateDemoScenarios()) {
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
      satFieldValues: scenario.satFieldValues,
      satCellValues: scenario.satCellValues,
      satMissingRequiredFields: [],
      satWorkbookStatus: "listo",
      actor: "Fixture SAT Demo I-XVI",
    })
    const satPackage = generateSatOutputPackage(operationalCase)
    if (satPackage.validation.status !== "listo") failures.push(`${scenario.templateId}: ${satPackage.validation.missingFields.join(", ")}`)
    if (!satPackage.xml.includes(`xsi:schemaLocation="`)) failures.push(`${scenario.templateId}: XML sin schemaLocation`)
    if (!satPackage.xml.includes("<clave_actividad>")) failures.push(`${scenario.templateId}: XML sin clave_actividad`)
    if (/tipo_salida|borrador_no_cargable|validacion|trazabilidad|formato_sat/.test(satPackage.xml)) {
      failures.push(`${scenario.templateId}: XML contiene etiquetas internas`)
    }
  }

  assert.deepEqual(failures, [])
})

test("full PLD demo dataset includes one downloadable SAT package per concrete template scenario", () => {
  const dataset = buildPldDemoDataset(new Date("2026-05-14T12:00:00-06:00"))
  const packages = dataset["pld-sat-output-packages"] as Array<{ satDemoScenarioId?: string; workbookValidationStatus?: string }>
  const scenarioPackages = packages.filter((item) => item.satDemoScenarioId?.startsWith("sat-demo-"))

  assert.equal(scenarioPackages.length, getConcreteSatTemplates().length)
  assert.equal(
    scenarioPackages.every((item) => item.workbookValidationStatus === "strict_synthetic" || item.workbookValidationStatus === "golden_fixture"),
    true,
  )
})
