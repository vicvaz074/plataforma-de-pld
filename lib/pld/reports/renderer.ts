import type { jsPDF } from "jspdf"
import type { ProfessionalReport, ProfessionalReportContext, ReportBar, ReportMetric, ReportSection, ReportTableColumn } from "./types"

export const PROFESSIONAL_REPORT_VERSION = "2.0"
export const REPORT_LOGO_URL = "/logo-davara-governance/logo-davara-governance-black.png"
export const REPORT_PAGE = { width: 210, height: 297, margin: 18, top: 46, bottom: 272 } as const
const INK = "#14263F", ACCENT = "#F47A12", MUTED = "#526175", LINE = "#DCE2E8", PALE = "#F3F6F9"
const WIDTH = REPORT_PAGE.width - REPORT_PAGE.margin * 2
const FONT = 10.5, LEADING = 4.8, PAD = 2.4

/** Typography normalization, not data shortening. Standard PDF fonts support Spanish. */
function text(value: unknown): string {
  return String(value ?? "").replace(/\r\n?/g, "\n").replace(/\t/g, "  ")
    .replace(/[\u2010-\u2015\u2212]/g, "-").replace(/\u202f|\u00a0/g, " ")
    .replace(/≠/g, " no equivale a ").replace(/→/g, " -> ").replace(/←/g, " <- ")
    .replace(/✓|✔/g, "Sí").replace(/✗|✘/g, "No")
}

export function safeReportFilename(filename: string): string {
  const base = filename.replace(/\.pdf$/i, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]+/g, "-").replace(/\.{2,}/g, "-").replace(/\s+/g, "-")
    .replace(/^-+|[ .-]+$/g, "").slice(0, 140)
  return `${base || "reporte-pld"}.pdf`
}

/** Pure factory: no browser, storage, permissions, fetch, or download side effects. */
export async function renderProfessionalReport(
  report: ProfessionalReport,
  context: ProfessionalReportContext,
  logoBytes?: Uint8Array | string,
): Promise<jsPDF> {
  const { jsPDF: Pdf } = await import("jspdf")
  const doc = new Pdf({ unit: "mm", format: "a4", orientation: "portrait", compress: true, putOnlyUsedFonts: true })
  doc.setProperties({ title: text(report.title), subject: text(report.subtitle || "Reporte PLD de la empresa seleccionada"), author: text(context.generatedBy), creator: `Davara Governance PLD - reportes ${PROFESSIONAL_REPORT_VERSION}`, keywords: "PLD, confidencial, reporte interno, Davara Governance" })
  doc.setLanguage("es-MX")
  const created = new Date(context.generatedAt)
  if (!Number.isNaN(created.getTime())) doc.setCreationDate(created)
  doc.setLineHeightFactor(1.2)
  let y: number = REPORT_PAGE.top

  const style = (size = FONT, bold = false, color = INK) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(color)
  }
  const rule = (at: number, color = LINE) => { doc.setDrawColor(color); doc.setLineWidth(0.25); doc.line(REPORT_PAGE.margin, at, REPORT_PAGE.width - REPORT_PAGE.margin, at) }
  const header = () => {
    if (logoBytes) {
      const image = doc.getImageProperties(logoBytes)
      const w = 46, h = w * image.height / image.width
      doc.addImage(logoBytes, "PNG", REPORT_PAGE.margin, 12, w, h, "davara-official-logo")
    } else {
      // The pure factory permits a logo-free test. Production download always
      // supplies the exact official image, never a recreation of the wordmark.
      style(8, true, MUTED); doc.text("PREVENCIÓN DE LAVADO DE DINERO", REPORT_PAGE.margin, 20)
    }
    style(8, true, MUTED); doc.text("REPORTE PLD", REPORT_PAGE.width - REPORT_PAGE.margin, 20, { align: "right" })
    const companyContext = `Empresa: ${context.company.name || "Sin dato"} | RFC: ${context.company.rfc || "Sin dato"}`
    const companyLines = lines(companyContext, WIDTH, 7.2)
    const scopeLines = lines(`Alcance: ${report.scopeLabel || "Empresa seleccionada"}`, WIDTH, 7.2)
    const compactCompany = companyLines.length <= 2 ? companyLines : ["Empresa y RFC: contexto íntegro al inicio del reporte."]
    const compactScope = scopeLines.length <= 2 ? scopeLines : ["Alcance: descripción íntegra al inicio del reporte."]
    style(7.2, false, MUTED)
    compactCompany.forEach((line, index) => doc.text(line, REPORT_PAGE.margin, 27 + index * 3.5))
    compactScope.forEach((line, index) => doc.text(line, REPORT_PAGE.margin, 34 + index * 3.5))
    rule(41, ACCENT)
  }
  const nextPage = () => { doc.addPage(); header(); y = REPORT_PAGE.top }
  const space = (height: number) => { if (y + height > REPORT_PAGE.bottom) nextPage() }
  const lines = (value: unknown, width = WIDTH, size = FONT, bold = false): string[] => {
    style(size, bold)
    // jsPDF splits even an unbroken source URL / single long table cell. Do
    // not cap line count, row count or source count and do not use ellipses.
    return text(value).split("\n").flatMap(part => part ? doc.splitTextToSize(part, Math.max(width, 3)) as string[] : [""])
  }
  const paragraphHeight = (value: unknown, size = FONT, bold = false, width = WIDTH, gap = 2) => lines(value, width, size, bold).length * size * 0.352778 * 1.35 + gap
  const titleHeight = (value: string) => Math.max(17, lines(value, WIDTH - 4, 13, true).length * 6.6 + 6)
  const keepTogether = (height: number) => { if (height <= REPORT_PAGE.bottom - REPORT_PAGE.top) space(height) }
  const write = (value: unknown, options: { size?: number; bold?: boolean; color?: string; indent?: number; gap?: number } = {}) => {
    const size = options.size ?? FONT, indent = options.indent ?? 0, leading = size * 0.352778 * 1.35
    const wrapped = lines(value, WIDTH - indent, size, options.bold)
    for (const line of wrapped) {
      space(leading)
      style(size, options.bold, options.color ?? INK)
      doc.text(line, REPORT_PAGE.margin + indent, y + size * 0.352778, { baseline: "alphabetic" })
      y += leading
    }
    y += options.gap ?? 2
  }
  const sectionTitle = (title: string) => {
    space(17); y += 4
    const wrapped = lines(title, WIDTH - 4, 13, true)
    for (const line of wrapped) {
      space(7)
      doc.setFillColor(ACCENT); doc.rect(REPORT_PAGE.margin, y + 1, 1.1, 4.8, "F")
      style(13, true); doc.text(line, REPORT_PAGE.margin + 4, y + 5)
      y += 6.6
    }
    y += 2
  }
  const metrics = (items: ReportMetric[]) => {
    for (let start = 0; start < items.length;) {
      // A solitary fourth metric need not consume a second full row. Only use
      // four columns when labels and values fit without shrinking typography.
      const four = items.slice(start, start + 4)
      const fitsFour = items.length - start === 4 && four.every(item => lines(item.value, WIDTH / 4 - 9, 18, true).length === 1 && lines(item.label, WIDTH / 4 - 9, FONT).length === 1 && (!item.note || lines(item.note, WIDTH / 4 - 9, 8).length <= 2))
      const group = items.slice(start, start + (fitsFour ? 4 : 3)), column = WIDTH / group.length
      start += group.length
      const cells = group.map(item => ({ value: lines(item.value, column - 9, 18, true), label: lines(item.label, column - 9, FONT), note: item.note ? lines(item.note, column - 9, 8) : [] }))
      const height = Math.max(...cells.map(cell => cell.value.length * 7.8 + cell.label.length * LEADING + cell.note.length * 4 + 11))
      if (height > 60) {
        for (const item of group) { write(item.label, { bold: true }); write(item.value, { size: 14 }); if (item.note) write(item.note, { size: 8, color: MUTED }) }
        continue
      }
      space(height + 4); rule(y); y += 4
      cells.forEach((cell, index) => {
        const x = REPORT_PAGE.margin + column * index + 3
        let cy = y
        cell.value.forEach(line => { style(18, true); doc.text(line, x, cy + 6); cy += 7.8 })
        cy += 1.5
        cell.label.forEach(line => { style(); doc.text(line, x, cy + 3.5); cy += LEADING })
        cell.note.forEach(line => { style(8, false, MUTED); doc.text(line, x, cy + 3); cy += 4 })
        if (index) { doc.setDrawColor(LINE); doc.line(x - 3, y, x - 3, y + height - 7) }
      })
      y += height; rule(y); y += 3
    }
  }
  const barGroupHeight = (items: ReportBar[]) => items.reduce((height, bar) => height + paragraphHeight(bar.label, FONT, true, WIDTH, 1) + paragraphHeight(`${bar.valueLabel || "Sin dato"} | Escala: 0 a ${bar.max || 100}`, 8, false, WIDTH, 1) + (typeof bar.value === "number" && bar.value < 0 ? 12 : 8), items.every(item => item.value === null || !Number.isFinite(item.value)) ? 10 : 0)
  const bars = (items: ReportBar[], title?: string) => {
    if (!items.length) return
    const known = items.filter(item => typeof item.value === "number" && Number.isFinite(item.value))
    const sameMax = known.length && known.every(item => item.max === known[0].max)
    const declaredMax = known[0]?.max
    const commonMax = Math.max(1, ...known.map(item => Math.abs(item.value as number)), ...(sameMax && typeof declaredMax === "number" && Number.isFinite(declaredMax) && declaredMax > 0 ? [declaredMax] : []))
    if (!known.length) write("Sin datos evaluados. No se asigna un valor cero.", { size: 8, color: MUTED })
    for (const bar of items) {
      const label = lines(bar.label, WIDTH, FONT, true)
      // Keep the label adjacent to its evidence; a pathological long label is
      // still fully written and may continue before its mark on the next page.
      const labelBlock = label.length * FONT * 0.352778 * 1.35 + paragraphHeight(`${bar.valueLabel || "Sin dato"} | Escala: 0 a ${bar.max || 100}`, 8) + 12
      if (labelBlock < REPORT_PAGE.bottom - REPORT_PAGE.top && y + labelBlock > REPORT_PAGE.bottom) {
        nextPage()
        if (title) sectionTitle(`${title} (continuación)`)
      }
      write(bar.label, { bold: true, gap: 1 })
      const knownValue = typeof bar.value === "number" && Number.isFinite(bar.value)
      const value = knownValue ? bar.value as number : null
      const scale = Math.max(1, Math.abs(value ?? 0), typeof bar.max === "number" && Number.isFinite(bar.max) && bar.max > 0 ? bar.max : commonMax)
      const valueLabel = value === null ? `Sin dato${bar.valueLabel ? ` (${bar.valueLabel})` : ""}` : bar.valueLabel || new Intl.NumberFormat("es-MX", { maximumFractionDigits: 20 }).format(value)
      const formatNumber = (number: number) => new Intl.NumberFormat("es-MX", { maximumFractionDigits: 20 }).format(number)
      write(`${valueLabel}${value === null ? "" : `  |  Escala: ${value < 0 ? `${formatNumber(-scale)} a 0` : `0 a ${formatNumber(scale)}`}`}`, { size: 8, color: MUTED, gap: 1 })
      space(9)
      if (value !== null) {
        const zero = value < 0 ? REPORT_PAGE.margin + WIDTH : REPORT_PAGE.margin
        doc.setDrawColor(LINE); doc.setLineWidth(0.3); doc.line(REPORT_PAGE.margin, y + 4, REPORT_PAGE.margin + WIDTH, y + 4)
        doc.setDrawColor(MUTED); doc.line(zero, y, zero, y + 5)
        doc.setFillColor(bar.tone === "accent" ? ACCENT : bar.tone === "muted" ? "#8390A0" : bar.tone === "success" ? "#207460" : INK)
        const w = WIDTH * Math.abs(value) / scale
        if (w > 0) doc.rect(value < 0 ? zero - w : zero, y, w, 3.8, "F")
        if (value < 0) { style(7, false, MUTED); doc.text("Base cero a la derecha; valor negativo", REPORT_PAGE.margin, y + 8) }
      } else {
        doc.setDrawColor(LINE); doc.setLineDashPattern([1, 1], 0); doc.line(REPORT_PAGE.margin, y + 2, REPORT_PAGE.margin + WIDTH, y + 2); doc.setLineDashPattern([], 0)
      }
      y += value !== null && value < 0 ? 12 : 8
    }
  }
  const drawTable = (columns: ReportTableColumn[], rows: Array<Array<string | number | null>>) => {
    const weights = columns.map(column => column.width && Number.isFinite(column.width) && column.width > 0 ? column.width : 1)
    const total = weights.reduce((a, b) => a + b, 0)
    const widths = weights.map(weight => WIDTH * weight / total)
    const headers = columns.map((column, index) => lines(column.label, widths[index] - PAD * 2, 9, true))
    const headerHeight = Math.max(...headers.map(cell => cell.length), 1) * LEADING + PAD * 2
    const tableHeader = () => {
      space(headerHeight + LEADING + PAD * 2)
      doc.setFillColor(INK); doc.rect(REPORT_PAGE.margin, y, WIDTH, headerHeight, "F")
      let x = REPORT_PAGE.margin
      headers.forEach((cell, index) => {
        style(9, true, "#FFFFFF")
        cell.forEach((line, row) => doc.text(line, columns[index].align === "right" ? x + widths[index] - PAD : x + PAD, y + PAD + 3.2 + row * LEADING, { align: columns[index].align ?? "left" }))
        x += widths[index]
      })
      y += headerHeight
    }
    // Reserve the complete first row when it fits on a fresh page. Painting a
    // header first and then moving that row creates a misleading empty table.
    const firstRow = rows[0]
    if (firstRow) {
      const firstRowHeight = Math.max(...columns.map((_, index) => lines(firstRow[index] ?? "-", widths[index] - PAD * 2, 9).length), 1) * LEADING + PAD * 2
      keepTogether(headerHeight + firstRowHeight)
    }
    tableHeader()
    rows.forEach((row, rowIndex) => {
      const cells = columns.map((_, index) => lines(row[index] === null || row[index] === undefined || row[index] === "" ? "-" : row[index], widths[index] - PAD * 2, 9))
      const count = Math.max(...cells.map(cell => cell.length), 1)
      const fullHeight = count * LEADING + PAD * 2
      const freshCapacity = REPORT_PAGE.bottom - REPORT_PAGE.top - headerHeight
      if (fullHeight <= freshCapacity && y + fullHeight > REPORT_PAGE.bottom) { nextPage(); tableHeader() }
      let offset = 0
      while (offset < count) {
        let capacity = Math.floor((REPORT_PAGE.bottom - y - PAD * 2) / LEADING)
        if (capacity < 1) { nextPage(); tableHeader(); capacity = Math.floor((REPORT_PAGE.bottom - y - PAD * 2) / LEADING) }
        const take = Math.min(capacity, count - offset), height = take * LEADING + PAD * 2
        if (rowIndex % 2 === 1) { doc.setFillColor(PALE); doc.rect(REPORT_PAGE.margin, y, WIDTH, height, "F") }
        let x = REPORT_PAGE.margin
        cells.forEach((cell, index) => {
          style(9)
          cell.slice(offset, offset + take).forEach((line, rowNumber) => doc.text(line, columns[index].align === "right" ? x + widths[index] - PAD : x + PAD, y + PAD + 3.2 + rowNumber * LEADING, { align: columns[index].align ?? "left" }))
          x += widths[index]
        })
        y += height; rule(y); offset += take
        if (offset < count) {
          nextPage(); tableHeader()
          write(`Registro ${rowIndex + 1} - continuación de la misma fila`, { size: 8, color: MUTED, gap: 2 })
        }
      }
    })
    y += 4
  }
  const table = (definition: NonNullable<ReportSection["table"]>) => {
    const count = Math.max(definition.columns.length, ...definition.rows.map(row => row.length), 1)
    const columns = Array.from({ length: count }, (_, index) => definition.columns[index] ?? { label: `Columna ${index + 1}` })
    if (!definition.rows.length) { write(definition.emptyMessage || "Sin registros en el ámbito seleccionado.", { color: MUTED }); return }
    const weights = columns.map(column => column.width && Number.isFinite(column.width) && column.width > 0 ? column.width : 1)
    const total = weights.reduce((a, b) => a + b, 0)
    const tooNarrow = weights.some(weight => WIDTH * weight / total < 18)
    const tooTall = columns.some((column, index) => lines(column.label, WIDTH * weights[index] / total - PAD * 2, 9, true).length * LEADING > 45)
    if (tooNarrow || tooTall) {
      write("Detalle por registro para conservar la lectura de todas las columnas.", { size: 8, color: MUTED })
      definition.rows.forEach((row, index) => {
        space(18); write(`Registro ${index + 1}`, { bold: true })
        drawTable([{ label: "Campo", width: 1 }, { label: "Contenido", width: 2 }], columns.map((column, cell) => [column.label, row[cell] ?? null]))
      })
    } else drawTable(columns, definition.rows)
  }
  const tableLeadHeight = (definition: NonNullable<ReportSection["table"]>) => {
    if (!definition.rows.length) return paragraphHeight(definition.emptyMessage || "Sin registros en el ámbito seleccionado.")
    const count = Math.max(definition.columns.length, definition.rows[0].length, 1)
    const columns = Array.from({ length: count }, (_, index) => definition.columns[index] ?? { label: `Columna ${index + 1}` })
    const weights = columns.map(column => column.width && Number.isFinite(column.width) && column.width > 0 ? column.width : 1)
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    const widths = weights.map(weight => WIDTH * weight / total)
    const headerHeight = Math.max(...columns.map((column, index) => lines(column.label, widths[index] - PAD * 2, 9, true).length), 1) * LEADING + PAD * 2
    if (widths.some(width => width < 18) || headerHeight > 50) return 45
    const rowHeight = Math.max(...columns.map((_, index) => lines(definition.rows[0][index] ?? "-", widths[index] - PAD * 2, 9).length), 1) * LEADING + PAD * 2
    return headerHeight + Math.min(rowHeight, REPORT_PAGE.bottom - REPORT_PAGE.top - headerHeight - titleHeight("Tabla") - 4) + 4
  }

  header()
  write(report.title || "Reporte PLD", { size: 23, bold: true, gap: 3 })
  if (report.subtitle) write(report.subtitle, { size: 11, color: MUTED, gap: 4 })
  write(context.company.name || "Empresa no indicada", { size: 11, bold: true })
  write(`RFC: ${context.company.rfc || "Sin dato"}`, { size: 8.5, color: MUTED })
  if (report.scopeLabel) write(`Alcance: ${report.scopeLabel}`, { size: 8.5, color: MUTED })
  if (report.period) write(`Periodo: ${report.period}`, { size: 8.5, color: MUTED })
  write(`Generado: ${Number.isNaN(created.getTime()) ? text(context.generatedAt) : created.toISOString()} | Por: ${context.generatedBy || "Sin dato"}`, { size: 8, color: MUTED, gap: 4 })
  sectionTitle("Resumen ejecutivo")
  if (report.summary.length) report.summary.forEach(paragraph => { if (paragraph.trim()) write(paragraph) })
  else write("Sin resumen disponible para el ámbito seleccionado.", { color: MUTED })
  if (report.metrics?.length) { y += 3; metrics(report.metrics) }
  for (const section of report.sections) {
    const paragraphBlock = (section.paragraphs || []).filter(paragraph => paragraph.trim()).reduce((height, paragraph) => height + paragraphHeight(paragraph), 0)
    if (section.bars?.length) keepTogether(titleHeight(section.title) + paragraphBlock + barGroupHeight(section.bars) + 3)
    else if (section.table) keepTogether(titleHeight(section.title) + paragraphBlock + tableLeadHeight(section.table) + 3)
    sectionTitle(section.title)
    section.paragraphs?.forEach(paragraph => { if (paragraph.trim()) write(paragraph) })
    if (section.bars?.length) bars(section.bars, section.title)
    if (section.table) table(section.table)
    if (section.note) write(section.note, { size: 8, color: MUTED })
  }
  const defaultDisclaimer = "La obligación de aviso, la preparación, la validación XML local y la presentación documentada son estados distintos. Este reporte no acredita aceptación del SAT."
  const limitsHeight = titleHeight("Alcance y límites") + paragraphHeight(defaultDisclaimer, 8) + (report.disclaimers || []).filter(paragraph => paragraph.trim()).reduce((height, paragraph) => height + paragraphHeight(paragraph, 8), 0)
  const sources = (report.sources || []).filter(source => source.trim())
  const sourcesHeight = sources.length ? titleHeight("Fuentes y trazabilidad") + sources.reduce((height, source, index) => height + paragraphHeight(`${index + 1}. ${source}`, 8), 0) : 0
  keepTogether(sourcesHeight + limitsHeight + 3)
  if (sourcesHeight) {
    sectionTitle("Fuentes y trazabilidad")
    sources.forEach((source, index) => write(`${index + 1}. ${source}`, { size: 8 }))
  }
  keepTogether(limitsHeight + 2)
  sectionTitle("Alcance y límites")
  write(defaultDisclaimer, { size: 8 })
  report.disclaimers?.forEach(paragraph => { if (paragraph.trim()) write(paragraph, { size: 8 }) })

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); rule(278)
    style(7.5, false, MUTED)
    doc.text(`CONFIDENCIAL | Versión ${PROFESSIONAL_REPORT_VERSION}`, REPORT_PAGE.margin, 283)
    doc.text(`Página ${page} de ${pages}`, REPORT_PAGE.width - REPORT_PAGE.margin, 283, { align: "right" })
    style(7.2, false, MUTED)
    doc.text("Validación local no equivale a aceptación del SAT.", REPORT_PAGE.margin, 288)
  }
  return doc
}
