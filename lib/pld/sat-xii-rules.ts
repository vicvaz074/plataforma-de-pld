import { splitCell } from "./sat-xlsm-grid"
import type { SatXlsmField, SatXlsmSection } from "./types"

export const XII_SP_PROPERTY = "sat-fraccion-xii-notarios-a"
export const XII_SHARES = "sat-fraccion-xii-corredores-c-compra-venta"
export const XII_SPLIT = "sat-fraccion-xii-corredores-c-escision"
export const XII_PARTY_ROWS = "intervinientes-r41"

/** Exact worksheet boundaries, not label heuristics. SAT XLSM/XSD consulted
 * 2026-09-28; see docs/qa/cierre-2026-09-28.md. IDs/cells remain compatible. */
export function normalizeXiiFields(templateId: string, sections: SatXlsmSection[]): SatXlsmSection[] {
  return sections.map((section) => ({ ...section, fields: section.fields.map((original) => {
    let field = { ...original }
    const { col, row } = splitCell(field.cell)
    if (templateId === XII_SP_PROPERTY && section.sheetName === "Aviso") {
      const start = [41, 55, 68, 83, 96, 109].find((first) => row >= first && row < first + 10)
      if (start !== undefined) {
        field = { ...field, repeatGroup: XII_PARTY_ROWS, repeatIndex: row - start + 1, repeatLimit: 10,
          activeWhen: field.activeWhen?.filter((c) => !c.fieldId.startsWith("sat.row.") && !c.fieldId.includes(".personas.")),
          requiredWhen: field.requiredWhen?.filter((c) => !c.fieldId.startsWith("sat.row.")) }
      }
    }
    if (templateId === XII_SHARES) {
      // The issuer of the shares is always a company, independently of the
      // client, seller or buyer's legal form.
      if (row >= 31 && row <= 40) field.activeWhen = field.activeWhen?.filter((c) => c.fieldId !== "persona_objeto.tipo_persona")
      if (row >= 47 && row <= 56) field = { ...field, repeatGroup: "persona-fisica-r47", repeatIndex: row - 46, repeatLimit: 10 }
      if (field.optionListId === "PERSONAMORAL") field = { ...field, optionListId: "XII_SOCIEDADES_ACCIONES", options: [] }
    }
    if (templateId === XII_SPLIT) {
      if ((row >= 82 && row <= 91 && col === "J") || (row >= 95 && row <= 104 && ["G", "L"].includes(col))) {
        field = { ...field, dataType: "catalogo", optionListId: "XII_SOCIEDADES_ESCINDIDAS", options: [] }
      }
      const controllerCell = row >= 38 && row <= 60 ? "D32" : row >= 67 && row <= 104 ? "D64" : undefined
      if (controllerCell) {
        const controller = section.fields.find((f) => f.cell === controllerCell)
        if (controller && !field.activeWhen?.some((c) => c.fieldId === controller.id)) {
          field.activeWhen = [...(field.activeWhen || []), { fieldId: controller.id, equals: ["SI"] }]
        }
      }
    }
    return field
  }) }))
}

export const XII_COMPANY_LISTS: Record<string, number> = {
  XII_SOCIEDADES_ACCIONES: 31,
  XII_SOCIEDADES_ESCINDIDAS: 67,
}

export function withXiiCompanyOptions(fields: SatXlsmField[], values: Record<string, string>,
  active: (field: SatXlsmField) => boolean): SatXlsmField[] {
  const sheet = "Persona Objeto del aviso"
  const byCell = new Map(fields.filter((f) => f.sheetName === sheet).map((f) => [f.cell, f]))
  return fields.map((field) => {
    const start = XII_COMPANY_LISTS[field.optionListId || ""]
    if (!start) return field
    const options: string[] = []
    for (let row = start; row < start + 10; row++) {
      const company = byCell.get(`B${row}`)
      if (!company || !active(company)) continue
      const value = (values[company.id] ?? values[`${sheet}!B${row}`] ?? "").trim()
      if (value && !options.includes(value)) options.push(value)
    }
    return { ...field, options, placeholder: "Captura primero la sociedad y selecciona su denominación" }
  })
}
