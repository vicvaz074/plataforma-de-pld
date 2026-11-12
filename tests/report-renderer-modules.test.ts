import assert from "node:assert/strict"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import type { TextItem } from "pdfjs-dist/types/src/display/api"
import { renderProfessionalReport, safeReportFilename, type ProfessionalReport } from "../lib/pld/reports"
import { moduleReportFixtures } from "./fixtures/module-report-fixtures"

const context = { company: { name: "EMPRESA FICTICIA QA SA DE CV", rfc: "EQA261111AA1" }, generatedBy: "QA - escenario ficticio", generatedAt: "2026-11-11T15:34:56.789Z" }
const logo = new Uint8Array(readFileSync("public/logo-davara-governance/logo-davara-governance-black.png"))
const compact = (value: unknown) => String(value ?? "").replace(/\s+/g, "").replace(/[\u2010-\u2015\u2212]/g, "-")

async function inspect(report: ProfessionalReport) {
  const document = await renderProfessionalReport(report, context, logo)
  const bytes = new Uint8Array(document.output("arraybuffer"))
  // PDF.js may transfer/detach its input buffer. Keep the original bytes for
  // the optional QA artifact instead of exporting a detached zero-byte file.
  const pdf = await getDocument({ data: bytes.slice(), useSystemFonts: true }).promise
  const pages = []
  for (let index = 1; index <= pdf.numPages; index++) {
    const page = await pdf.getPage(index)
    const content = await page.getTextContent()
    const items = content.items.filter((item): item is TextItem => "str" in item && Boolean(item.str.trim()))
    for (let left = 0; left < items.length; left++) {
      for (let right = left + 1; right < items.length; right++) {
        const a = items[left], b = items[right]
        if (Math.abs(a.transform[5] - b.transform[5]) > 0.6) continue
        const overlap = Math.min(a.transform[4] + a.width, b.transform[4] + b.width) - Math.max(a.transform[4], b.transform[4])
        assert.ok(overlap <= 0.6, `Same-line overlap in ${report.title}, page ${index}: ${a.str} / ${b.str}`)
      }
    }
    const body = items.filter(item => item.transform[5] > 72 && item.transform[5] < 715)
    pages.push({ items, text: items.map(item => item.str).join(" "), bodyText: body.map(item => item.str).join(" ") })
  }
  await pdf.destroy()
  if (process.env.PLD_REPORT_MODULE_QA_DIR) {
    mkdirSync(process.env.PLD_REPORT_MODULE_QA_DIR, { recursive: true })
    writeFileSync(path.join(process.env.PLD_REPORT_MODULE_QA_DIR, safeReportFilename(report.filename)), Buffer.from(bytes))
  }
  return pages
}

test("six real module report fixtures retain body data without same-line KPI/table overlap", async () => {
  for (const report of moduleReportFixtures()) {
    const pages = await inspect(report)
    const allText = compact(pages.map(page => page.bodyText).join(" "))
    for (const metric of report.metrics || []) {
      assert.ok(allText.includes(compact(metric.label)), `Missing metric ${metric.label} in ${report.title}`)
      assert.ok(allText.includes(compact(metric.value)), `Missing metric value ${metric.value} in ${report.title}`)
    }
    for (const section of report.sections) {
      for (const paragraph of section.paragraphs || []) assert.ok(allText.includes(compact(paragraph)), `Missing full paragraph in ${report.title}: ${paragraph}`)
      for (const row of section.table?.rows || []) {
        for (const cell of row) if (cell !== null && String(cell).trim()) assert.ok(allText.includes(compact(cell)), `Missing table value in ${report.title}: ${cell}`)
      }
    }
    if (report.title === "Auditorías internas") {
      for (const page of pages.filter(page => page.bodyText.includes("ID / fecha"))) assert.match(page.bodyText, /AUDIT-QA/, "An ordinary complete first row stays with its table header")
    }
    for (const section of report.sections.filter(section => section.bars && section.bars.length > 1 && section.bars.length <= 4)) {
      const page = pages.find(page => page.bodyText.includes(section.title))
      assert.ok(page, `Missing bar chart title in ${report.title}`)
      for (const bar of section.bars || []) assert.ok(page.bodyText.includes(bar.label), `Keep small chart together with title: ${bar.label} in ${report.title}`)
    }
    const lastPage = pages[pages.length - 1].bodyText
    assert.ok(lastPage.length > 180, `Avoid a final page with only a two-line detached note in ${report.title}`)
    assert.ok(lastPage.includes("Fuentes y trazabilidad") && lastPage.includes("Alcance y límites"), `Small source/limits blocks stay together, not only a detached final disclaimer: ${report.title}`)
  }
})

test("long inline metric labels and monetary values stay inside their own columns", async () => {
  await inspect({ title: "Métricas de prueba", summary: [], metrics: [
    { label: "Reactivos evaluados", value: "1 / 7" },
    { label: "Sin respuesta", value: "6" },
    { label: "Documentos", value: "1" },
    { label: "Sesiones de comité", value: "1" },
    { label: "Importe sin truncar - aclaraciones completas del monto", value: "$10,000,000.00", note: "MXN con dos decimales conservados" },
    { label: "Aprobación documental pendiente", value: "Sin respuesta" },
    { label: "Consulta de documentos relacionados", value: "Documentos" },
  ], sections: [], filename: "metricas-qa.pdf" })
})
