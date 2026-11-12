import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"
import { buildEvidenceProfessionalReport, buildFormalAuditProfessionalReport, buildGovernanceProfessionalReport, buildInternalAuditsProfessionalReport, buildKycBlankProfessionalReport, buildTrainingProfessionalReport } from "../lib/pld/module-reports"
import { auditFixture, evidenceFixture, governanceFixture, trainingFixture, trainingQuestions } from "./fixtures/module-report-fixtures"

test("each module report action explicitly invokes download authorization, including bare form labels", () => {
  let count = 0
  for (const module of ["capacitacion-control", "gobernanza-control", "evidencias-trazabilidad", "auditoria-verificacion"]) {
    const source = ts.createSourceFile(`${module}.tsx`, readFileSync(`app/${module}/page.tsx`, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const visit = (node: ts.Node) => {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === "Button") {
        const attributes = node.attributes.properties.filter(ts.isJsxAttribute)
        const click = attributes.find(attribute => attribute.name.getText(source) === "onClick")?.initializer?.getText(source) || ""
        if (/\b(?:exportReport|handleExportPDF|handleExportExcel|exportExpedienteAsPDF|exportExpedienteAsCSV|exportFormalAuditReport|exportKycFormTemplate|exportAuditsToExcel|exportAuditsToPdf)\b/.test(click)) {
          count++
          assert.equal(attributes.find(attribute => attribute.name.getText(source) === "data-pld-action")?.initializer?.getText(source), '"download"', `${module}: ${click}`)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  assert.equal(count, 13)
})

test("training PDF data retains every session/person/history beyond old 20/25 limits and all long notes", () => {
  const input = trainingFixture(120)
  const lastNote = "Observación extensa de control ".repeat(500) + "FINAL-SESION-119"
  input.sessions[119].observations = lastNote
  const report = buildTrainingProfessionalReport(input, trainingQuestions)
  assert.equal(report.sections.find(section => section.title === "Sesiones registradas")?.table?.rows.length, 120)
  assert.equal(report.sections.find(section => section.title === "Personal e inducción")?.table?.rows.length, 120)
  assert.equal(report.sections.find(section => section.title === "Historial completo por persona")?.table?.rows.length, 120)
  assert.ok(report.sections.find(section => section.title === "Sesión: Sesión ficticia 119")?.paragraphs?.includes(`Observaciones: ${lastNote}`))
  assert.ok(JSON.stringify(report).includes("Persona ficticia 119"))
  assert.equal(report.metrics?.find(metric => metric.label === "Inducción pendiente")?.value, "60")
})

test("empty training is not shown as evaluated, approved or zero-valued chart data", () => {
  const input = trainingFixture(0)
  input.trainingPlan = null
  input.checklistAnswers = {}
  const report = buildTrainingProfessionalReport(input, trainingQuestions)
  assert.ok(report.sections[0].bars?.every(bar => bar.value === null && bar.valueLabel === "Sin registros"))
  assert.match(report.summary[1], /0 de 2 preguntas/)
  assert.ok(report.sections.some(section => section.paragraphs?.some(paragraph => paragraph.includes("No existe un plan"))))
})

test("critical positions remain visible even when a person has no certificates", () => {
  const input = trainingFixture(1)
  input.employees[0].certificates = []
  input.employees[0].criticalRole = true
  const critical = buildTrainingProfessionalReport(input, trainingQuestions).sections.find(section => section.title === "Personal e inducción")!.table!
  const index = critical.columns.findIndex(column => column.label === "Puesto crítico")
  assert.ok(index >= 0)
  assert.equal(critical.rows[0][index], "Sí")
  input.employees[0].criticalRole = false
  const normal = buildTrainingProfessionalReport(input, trainingQuestions).sections.find(section => section.title === "Personal e inducción")!.table!
  assert.equal(normal.rows[0][index], "No")
})

test("governance preserves full question notes, negative answers, plans, evidence and manual/committee history", () => {
  const input = governanceFixture()
  input.questions[0].notes = "Justificación extensa ".repeat(500) + "FINAL-NOTA"
  input.questions[0].actionPlan = "Plan detallado ".repeat(500) + "FINAL-PLAN"
  const report = buildGovernanceProfessionalReport(input)
  const serialized = JSON.stringify(report)
  assert.ok(serialized.includes(input.questions[0].notes))
  assert.ok(serialized.includes(input.questions[0].actionPlan))
  assert.ok(serialized.includes("documento-ficticio.pdf"))
  assert.equal(report.sections[0].bars?.find(bar => bar.label === "No")?.value, 1)
  assert.equal(report.sections[0].bars?.find(bar => bar.label === "Sin respuesta")?.value, 1)
  assert.match(report.summary[1], /Un plan no transforma/)
  assert.equal(report.sections.find(section => section.title === "Versiones de manuales")?.table?.rows.length, 1)
  assert.equal(report.sections.find(section => section.title === "Comité: sesión QA-01")?.table?.rows.length, 1)
})

test("evidence report separates hash approval, file reference, archival, full versions and in-scope logs", () => {
  const input = evidenceFixture()
  input.documents[0].reviewStatus = "approved"
  input.documents[0].reviewedHash = "hash-anterior"
  input.documents[0].notes = "Nota extensa de evidencia ".repeat(500) + "FINAL-EVIDENCIA"
  input.documents[0].versionHistory = Array.from({ length: 130 }, (_, index) => ({ version: index + 1, timestamp: "2026-01-01", user: "QA", changeNote: `Cambio histórico completo ${index}`, fileName: `version-${index}.pdf`, objectReference: `objeto-${index}` }))
  input.logs.push({ documentId: "fuera-del-expediente", timestamp: "2026-11-11", action: "upload", user: "OTRA EMPRESA", details: "NO EXPORTAR" })
  const report = buildEvidenceProfessionalReport(input)
  assert.equal(report.metrics?.find(metric => metric.label === "Aprobados / hash")?.value, "0")
  assert.equal(report.sections[0].bars?.find(bar => bar.label === "Sin revisión verificable")?.value, 1)
  const document = report.sections.find(section => section.title.includes("Identificación ficticia"))!
  assert.equal(document.table?.rows.length, 130)
  assert.ok(document.paragraphs?.some(paragraph => paragraph.includes(input.documents[0].notes!)))
  assert.ok(JSON.stringify(report).includes("version-129.pdf"))
  assert.ok(!JSON.stringify(report).includes("NO EXPORTAR"))
  assert.match(document.paragraphs?.join(" ") || "", /hash por confirmar/)
})

test("formal audit includes every reactivo, unknown ratings, full authority/plan detail and exact financial context", () => {
  const input = auditFixture()
  input.answers["reactivo-6"] = { rating: "", findings: "Hallazgo largo ".repeat(500) + "FINAL-REACTIVO-6", recommendations: "Recomendación final sin recorte" }
  const report = buildFormalAuditProfessionalReport(input)
  const questionnaire = report.sections.find(section => section.title === "Revisión de prueba completa")!
  assert.equal(questionnaire.table?.rows.length, 7)
  assert.equal(questionnaire.table?.rows[6][1], "Sin evaluar")
  assert.equal(questionnaire.table?.rows[6][2], input.answers["reactivo-6"].findings)
  assert.equal(report.metrics?.find(metric => metric.label === "Sin evaluar")?.value, "6")
  assert.ok(JSON.stringify(report).includes("10,000,000.01"))
  assert.ok(JSON.stringify(report).includes("anexo-ficticio.pdf"))
  assert.ok(JSON.stringify(report).includes("Revisar y completar la evidencia de prueba."))
  assert.match(report.scopeLabel || "", /todos los reactivos/)
})

test("internal audit and auxiliary form preserve all rows and fields without special landscape widths", () => {
  const source = auditFixture().audits[0]
  const records = Array.from({ length: 200 }, (_, index) => ({ ...source, id: `AUDITORIA-${index}`, findings: `Hallazgo completo ${index}` }))
  const report = buildInternalAuditsProfessionalReport(records)
  assert.equal(report.sections.find(section => section.table)?.table?.rows.length, 200)
  assert.ok(JSON.stringify(report).includes("Hallazgo completo 199"))
  const fields = Array.from({ length: 100 }, (_, index) => `Campo completo ${index}`)
  const blank = buildKycBlankProfessionalReport({ title: "EUI", code: "QA", sections: [{ title: "Captura", fields }] })
  assert.equal(blank.sections[0].paragraphs?.length, 100)
  assert.ok(blank.sections[0].paragraphs?.[99].includes("Campo completo 99"))
  assert.match(blank.scopeLabel || "", /en blanco/)
})

test("audit trail UTC timestamps retain seconds and ordering while invalid calendar dates remain flagged", () => {
  const training = trainingFixture(1)
  training.trainingPlan!.approvalDate = "2026-02-30"
  training.traceability = [
    { timestamp: "2026-11-11T14:15:17.654Z", action: "Segundo evento", details: "No intercambiar", user: "QA" },
    { timestamp: "2026-11-11T08:15:16.123-06:00", action: "Primer evento", details: "No truncar", user: "QA" },
  ]
  const report = buildTrainingProfessionalReport(training, trainingQuestions)
  const rows = report.sections.find(section => section.title === "Trazabilidad del módulo")?.table?.rows
  assert.equal(rows?.length, 2)
  assert.equal(rows?.[0][0], "2026-11-11T14:15:17.654Z UTC")
  assert.equal(rows?.[1][0], "2026-11-11T14:15:16.123Z UTC")
  assert.match(report.sections.find(section => section.title === "Plan anual")?.paragraphs?.join(" ") || "", /Fecha por revisar: 2026-02-30/)
  const evidence = evidenceFixture()
  evidence.documents[0].uploadDate = "2026-11-11T14:15:17.654Z"
  evidence.documents[0].versionHistory[0].timestamp = "2026-10-01T08:01:02.003-06:00"
  const evidenceReport = buildEvidenceProfessionalReport(evidence)
  assert.match(JSON.stringify(evidenceReport), /2026-11-11T14:15:17.654Z UTC/)
  assert.match(JSON.stringify(evidenceReport), /2026-10-01T14:01:02.003Z UTC/)
  const governance = governanceFixture()
  governance.documents[0].signedAt = "2026-11-11T14:15:17.654Z"
  assert.match(JSON.stringify(buildGovernanceProfessionalReport(governance)), /2026-11-11T14:15:17.654Z UTC/)
})

test("unknown audit integration totals do not become zero financial results", () => {
  const input = auditFixture()
  input.context.ultimaActualizacion = null
  input.context.montoOperado = 0
  input.context.totalOperaciones = 0
  const context = buildFormalAuditProfessionalReport(input).sections.find(section => section.title === "Contexto de integración")
  assert.match(context?.paragraphs?.join(" ") || "", /Operaciones vinculadas: Sin dato\. Monto MXN: Sin dato/)
})

test("all six page exports use scoped async PDF downloads, keep annexes and expose errors", () => {
  const training = readFileSync("app/capacitacion-control/page.tsx", "utf8")
  const governance = readFileSync("app/gobernanza-control/page.tsx", "utf8")
  const evidence = readFileSync("app/evidencias-trazabilidad/page.tsx", "utf8")
  const audit = readFileSync("app/auditoria-verificacion/page.tsx", "utf8")
  for (const source of [training, governance, evidence, audit]) {
    assert.ok(!source.includes("new jsPDF"))
    assert.match(source, /await downloadProfessionalReport\(report, /)
    assert.match(source, /No se pudo exportar/)
  }
  assert.equal((audit.match(/await downloadProfessionalReport\(report, "auditoria"\)/g) || []).length, 3)
  assert.match(training, /serializeCsv\(rows\)/)
  assert.match(governance, /XLSX\.writeFile/)
  assert.match(evidence, /serializeCsv\(rows\)/)
  assert.match(audit, /auditorias-internas\.csv/)
})
