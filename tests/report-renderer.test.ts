import assert from "node:assert/strict"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import type { TextItem } from "pdfjs-dist/types/src/display/api"
import { renderProfessionalReport, safeReportFilename, type ProfessionalReport } from "../lib/pld/reports"

const context = { company: { name: "Empresa de prueba - DATOS ILUSTRATIVOS", rfc: "AAA010101AAA" }, generatedBy: "QA de reportes", generatedAt: "2026-11-11T18:00:00.000Z" }
const logo = new Uint8Array(readFileSync("public/logo-davara-governance/logo-davara-governance-black.png"))
const base: ProfessionalReport = { title: "Reporte de prueba", summary: [], sections: [], filename: "reporte-prueba.pdf" }
async function extract(document: Awaited<ReturnType<typeof renderProfessionalReport>>) {
  const bytes = new Uint8Array(document.output("arraybuffer"))
  const pdf = await getDocument({ data: bytes, useSystemFonts: true }).promise
  const pages: Array<{ text: string; items: TextItem[] }> = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const items = content.items.filter((item): item is TextItem => "str" in item)
    const viewport = page.getViewport({ scale: 1 })
    assert.ok(Math.abs(viewport.width - 595.28) < 1 && Math.abs(viewport.height - 841.89) < 1, "Every page remains A4")
    for (const item of items) {
      if (!item.str.trim()) continue
      assert.ok(item.transform[4] >= 47, `Text clipped at left edge: ${item.str}`)
      assert.ok(item.transform[4] + item.width <= viewport.width - 45, `Text clipped at right edge: ${item.str}`)
      assert.ok(item.transform[5] > 18 && item.transform[5] < viewport.height - 25, `Text outside page bounds: ${item.str}`)
    }
    pages.push({ text: items.map(item => item.str).join(" "), items })
  }
  const metadata = await pdf.getMetadata()
  await pdf.destroy()
  return { pages, text: pages.map(page => page.text).join(" "), metadata }
}

test("professional report empty/unknown values stay distinct from zero and retain metadata", async () => {
  const document = await renderProfessionalReport({ ...base, title: "Evaluación EBR", subtitle: "Información sin evaluar", sections: [{ title: "Estado evaluado", bars: [{ label: "Sin evaluar", value: null, max: 100 }, { label: "Resultado registrado", value: 0, max: 100, valueLabel: "0 puntos" }, { label: "Dato inválido", value: Number.NaN, max: Number.POSITIVE_INFINITY }, { label: "Escala inválida", value: 10, max: Number.POSITIVE_INFINITY }] }, { title: "Operaciones", table: { columns: [{ label: "Registro" }], rows: [], emptyMessage: "No hay operaciones del periodo." } }] }, context, logo)
  const result = await extract(document)
  assert.match(result.text, /Sin dato/)
  assert.match(result.text, /0 puntos/)
  assert.match(result.text, /Sin resumen disponible/)
  assert.match(result.text, /No hay operaciones del periodo/)
  assert.match(result.text, /no acredita aceptación del SAT/)
  assert.match(result.text, /QA de reportes/)
  assert.match(result.text, /2026-11-11T18:00:00.000Z/)
  assert.equal((result.metadata.info as { Title: string }).Title, "Evaluación EBR")
  assert.equal((result.metadata.info as { Author: string }).Author, "QA de reportes")
  assert.ok(!/NaN|undefined|Infinity/.test(result.text))
})

test("professional report keeps all 140 rows, exact centavo labels, long cells and sources through pagination", async () => {
  const tokens = Array.from({ length: 900 }, (_, index) => `DETALLE_${String(index).padStart(4, "0")}`)
  const rows: Array<Array<string | number | null>> = Array.from({ length: 140 }, (_, index) => [`REGISTRO_${String(index).padStart(4, "0")}`, index === 71 ? tokens.join(" ") : `Cliente de prueba ${index}`, "$10,000,000.00", index === 21 ? "Cancelada con motivo documentado" : "Revisión pendiente"])
  const report: ProfessionalReport = {
    ...base, title: "Operaciones y trazabilidad", scopeLabel: "Empresa de prueba; incluye cancelaciones y revisiones históricas", period: "Noviembre 2026",
    summary: ["Datos ilustrativos de pruebas automatizadas, no representan cumplimiento real."],
    metrics: [{ label: "Monto de prueba", value: "$10,000,000.00", note: "MXN - centavos exactos" }],
    sections: [{ title: "Resultados ilustrativos", bars: [{ label: "Datos disponibles", value: 80, max: 140, valueLabel: "80 registros" }, { label: "Sin evaluar", value: null, valueLabel: "Revisión pendiente" }] }, { title: "Historial completo", table: { columns: [{ label: "Referencia", width: 1 }, { label: "Detalle íntegro", width: 2 }, { label: "Importe MXN", width: 1.3, align: "right" }, { label: "Estado", width: 1.3 }], rows } }],
    sources: Array.from({ length: 30 }, (_, index) => `FUENTE_${String(index).padStart(4, "0")} - lector autorizado, revisión histórica de prueba; https://example.test/fuente/${index}`),
    disclaimers: ["LIMITE_FINAL - una operación cancelada no se presenta como obligación monetaria vigente."],
  }
  const document = await renderProfessionalReport(report, context, logo)
  const result = await extract(document)
  assert.ok(result.pages.length > 6)
  for (let index = 0; index < rows.length; index++) assert.ok(result.text.includes(String(rows[index][0])), `Missing row ${index}`)
  for (const token of tokens) assert.ok(result.text.includes(token), `Long single cell loses ${token}`)
  for (let index = 0; index < 30; index++) assert.ok(result.text.includes(`FUENTE_${String(index).padStart(4, "0")}`), `Missing source ${index}`)
  assert.match(result.text, /\$10,000,000\.00/)
  assert.match(result.text, /LIMITE_FINAL/)
  assert.match(result.text, /Cancelada con motivo documentado/)
  assert.ok(result.pages.filter(page => page.text.includes("Referencia") && page.text.includes("Detalle íntegro")).length >= 4, "Repeated table headers identify continuation pages")
  result.pages.forEach((page, index) => assert.ok(page.text.includes(`Página ${index + 1} de ${result.pages.length}`), "Complete page numbering"))
  if (process.env.PLD_REPORT_QA_DIR) {
    mkdirSync(process.env.PLD_REPORT_QA_DIR, { recursive: true })
    writeFileSync(path.join(process.env.PLD_REPORT_QA_DIR, "report-renderer-qa.pdf"), Buffer.from(document.output("arraybuffer")))
  }
})

test("wide tables and long unbroken sources preserve every column instead of clipping or truncating", async () => {
  const columns = Array.from({ length: 12 }, (_, index) => ({ label: `COLUMNA_${index}` }))
  const cells = columns.map((_, index) => `CONTENIDO_${index}`)
  const url = `https://example.test/${"segmento-".repeat(200)}FINAL_URL_COMPLETA`
  const result = await extract(await renderProfessionalReport({ ...base, sections: [{ title: "Tabla extensa", table: { columns, rows: [cells] } }], sources: [url] }, context))
  assert.match(result.text, /Detalle por registro/)
  for (const cell of cells) assert.ok(result.text.includes(cell))
  for (const column of columns) assert.ok(result.text.includes(column.label))
  const body = result.pages.flatMap(page => page.items.filter(item => item.transform[5] > 72 && item.transform[5] < 715)).map(item => item.str).join("").replace(/\s/g, "")
  assert.ok(body.includes(url), "An unbroken source is wrapped, never shortened; repeating page chrome is not part of the source")
})

test("negative values have a truthful zero baseline and long headings are not discarded", async () => {
  const titleTokens = Array.from({ length: 180 }, (_, index) => `TITULO_${index}`)
  const columnTokens = Array.from({ length: 220 }, (_, index) => `ENCABEZADO_${index}`)
  const result = await extract(await renderProfessionalReport({ ...base, title: titleTokens.join(" "), scopeLabel: "Alcance de prueba", sections: [{ title: "Valor negativo de prueba", bars: [{ label: "Ajuste registrado", value: -25, max: 100, valueLabel: "-25 MXN" }] }, { title: "Tabla", table: { columns: [{ label: columnTokens.join(" ") }, { label: "Valor" }], rows: [["CELDA_COMPLETA", "10,000,000.00"]] } }] }, context, logo))
  assert.match(result.text, /Escala: -100 a 0/)
  for (const token of titleTokens) assert.ok(result.text.includes(token), `Missing long title token ${token}`)
  for (const token of columnTokens) assert.ok(result.text.includes(token), `Missing long header token ${token}`)
  assert.match(result.text, /CELDA_COMPLETA/)
  result.pages.forEach(page => { assert.match(page.text, /Empresa de prueba/); assert.match(page.text, /Alcance de prueba/) })
})

test("download filenames cannot escape a user's download directory or lose the PDF extension", () => {
  assert.equal(safeReportFilename("../../Reporte compañía 2026.PDF"), "Reporte-compania-2026.pdf")
  assert.equal(safeReportFilename(""), "reporte-pld.pdf")
  assert.equal(safeReportFilename("reporte.xlsx"), "reporte.xlsx.pdf")
  assert.ok(safeReportFilename("A".repeat(300)).length <= 144)
})

test("large bar charts repeat their evidence heading on continuation pages", async () => {
  const bars = Array.from({ length: 24 }, (_, index) => ({ label: `FACTOR_${index}`, value: index, max: 100, valueLabel: `${index} puntos` }))
  const result = await extract(await renderProfessionalReport({ ...base, sections: [{ title: "Comparación de factores", bars }] }, context, logo))
  const figurePages = result.pages.filter(page => /FACTOR_\d/.test(page.text))
  assert.ok(figurePages.length >= 3)
  for (const page of figurePages) assert.match(page.text, /Comparación de factores/, "A chart cannot continue without its evidence context")
  for (const bar of bars) assert.ok(result.text.includes(bar.label))
})
