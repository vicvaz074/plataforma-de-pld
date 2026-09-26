import { optionCode, slug, splitCell } from "./sat-xlsm-grid"
import { BENEFICIARY_REPEAT_MODE_FIELD_ID, PERSONA_OBJETO_TYPE_FIELD_ID } from "./sat-field-controls"
import type { SatXlsmField, SatXlsmSection } from "./types"

type Conditions = NonNullable<SatXlsmField["activeWhen"]>

/**
 * Capture controls, never SAT codes or workbook cells. Source: cached official
 * SAT XLSM headings and instructions, consulted 2026-09-26:
 * https://www.sat.gob.mx/minisitio/ActividadesVulnerables/index.html
 */
export interface SatOperationBranchGroup {
  id: string
  label: string
  multiple: boolean
  options: Array<{ id: string; label: string }>
  activeWhen?: Conditions
}

const YES = "si"
const branchId = (templateId: string, key: string) => `sat.branch.${templateId}.${key}`
const when = (id: string): Conditions => [{ fieldId: id, equals: [YES] }]
const matches = (conditions: Conditions | undefined, values: Record<string, string>) =>
  (conditions || []).every((condition) => condition.equals.some((value) =>
    slug(optionCode(value)) === slug(optionCode(values[condition.fieldId] || ""))))
const append = (a: SatXlsmField["activeWhen"], b: Conditions): Conditions =>
  [...(a || []), ...b].filter((condition, index, all) =>
    all.findIndex((other) => JSON.stringify(other) === JSON.stringify(condition)) === index,
  )

const SOURCES = [
  ["recpropios", "Recursos propios"], ["socios", "Aportaciones de socios"],
  ["terceros", "Aportaciones de terceros"], ["prestamofin", "Préstamo financiero"],
  ["prestamonofin", "Préstamo no financiero"], ["finbursatil", "Financiamiento bursátil"],
] as const
const VIRTUAL_OPERATIONS = [
  ["compras", "Compras"], ["ventas", "Ventas"], ["intercambios", "Intercambios"],
  ["transferencias-enviadas", "Transferencias enviadas"],
  ["transferencias-recibidas", "Transferencias recibidas"],
  ["fondos-retirados", "Fondos retirados"], ["fondos-depositados", "Fondos depositados"],
] as const

export function getSatOperationBranchGroups(templateId: string, fields: SatXlsmField[] = []): SatOperationBranchGroup[] {
  return [...getFixedSatOperationBranchGroups(templateId), ...getPartyBranches(templateId, fields).groups,
    ...getLiquidationBranches(templateId, fields).groups, ...getContributionBranches(templateId, fields).groups]
}

function getFixedSatOperationBranchGroups(templateId: string): SatOperationBranchGroup[] {
  const group = (key: string, label: string, options: ReadonlyArray<readonly [string, string]>, multiple = true,
    parent?: string): SatOperationBranchGroup => ({
    id: branchId(templateId, key), label, multiple,
    options: options.map(([value, optionLabel]) => ({ id: branchId(templateId, value), label: optionLabel })),
    activeWhen: parent ? when(branchId(templateId, parent)) : undefined,
  })
  if (templateId === "sat-fraccion-v-inmuebles") {
    return [group("instrumento", "Documento del acto", [["contrato", "Contrato privado"], ["instrumento-publico", "Instrumento público"]], false)]
  }
  if (["sat-fraccion-xii-sp-poder", "sat-fraccion-xii-sp-modif-patrimonial"].includes(templateId)) {
    return [group("autoridad", "Tipo de autoridad", [["administrativa", "Administrativa"], ["jurisdiccional", "Jurisdiccional"]], false),
      group("domicilio-oficina", "Domicilio de la oficina", [["oficina-nacional", "Nacional"], ["oficina-extranjera", "Extranjero"]], false)]
  }
  if (templateId === "sat-fraccion-iii-cheques") {
    return [group("divisas-cheques", "Divisas de los cheques comercializados", [
      ["cheques-1", "Dólar estadounidense"], ["cheques-2", "Dólar canadiense"], ["cheques-3", "Dólar australiano"],
      ["cheques-4", "Libra esterlina"], ["cheques-5", "Euro"], ["cheques-6", "Yen japonés"], ["cheques-9", "Otros"],
    ])]
  }
  if (templateId === "sat-fraccion-viii-vehiculos") {
    return [group("vehiculos", "Tipos de vehículo incluidos", [
      ["terrestre", "Terrestre"], ["maritimo", "Marítimo"], ["aereo", "Aéreo"],
    ])]
  }
  if (templateId === "sat-fraccion-ix-blindaje") {
    return [group("bienes", "Bienes objeto del blindaje", [["vehiculo", "Vehículo"], ["inmueble", "Inmueble"]])]
  }
  if (templateId === "sat-fraccion-x-traslado") {
    return [{ ...group("destinatario", "Figura del destinatario", [["destinatario.pf", "Persona física"],
      ["destinatario.pm", "Persona moral"], ["destinatario.fid", "Fideicomiso"]], false),
      activeWhen: [{ fieldId: "acto-u-operacion.el-destinatario-es-la-persona-objeto-del-aviso.e62", equals: ["NO"] }] }]
  }
  if (templateId === "sat-fraccion-xvi-activos-virtuales") {
    const groups = [group("operaciones", "Operaciones con activos virtuales", VIRTUAL_OPERATIONS)]
    for (const [sheet, label] of VIRTUAL_OPERATIONS.filter(([key]) => key.startsWith("fondos-"))) {
      for (let index = 1; index <= 50; index += 1) {
        for (const [kind, title, options] of [
          ["persona", "Persona beneficiaria", [["pf", "Persona física"], ["pm", "Persona moral"]]],
          ["cuenta", "Datos de cuenta aplicables", [["nacional", "Cuenta nacional"], ["extranjera", "Cuenta extranjera"], ["no-aplica", "Sin cuenta bancaria"]]],
        ] as const) {
          const next = group(`${sheet}.${kind}.${index}`, `${label} · ${title} · Registro ${index}`,
            options.map(([key, value]) => [`${sheet}.${kind}.${index}.${key}`, value] as const), false, sheet)
          if (index > 1) next.activeWhen = append(next.activeWhen, when(`sat.row.${sheet}.bloque-12-r12.${index}`))
          groups.push(next)
        }
      }
    }
    return groups
  }
  if (templateId !== "sat-fraccion-v-bis-desarrollo") return []
  const groups = [group("fuentes", "Fuentes de recursos del desarrollo", SOURCES)]
  for (const source of ["socios", "terceros", "prestamonofin"]) {
    const label = SOURCES.find(([key]) => key === source)![1]
    groups.push(group(`${source}.personas`, `${label}: personas que participan`, [
      [`${source}.pf`, "Persona física"], [`${source}.pm`, "Persona moral"],
      [`${source}.fid`, "Fideicomiso"],
    ], true, source))
  }
  groups.push(group("socios.domicilio", "Domicilio de los socios", [
    ["socios.nacional", "Nacional"], ["socios.internacional", "En el extranjero"],
  ], true, "socios"))
  for (const [source, firstRow] of [["recpropios", 10], ["socios", 98], ["terceros", 54]] as const) {
    const label = SOURCES.find(([key]) => key === source)![1]
    for (let index = 1; index <= 10; index += 1) {
      // The official heading explicitly requires one type per contributor row.
      const next = group(`${source}.aportacion.${index}`, `${label}: forma de aportación · Registro ${index}`, [
        [`${source}.numerario.${index}`, "Numerario"], [`${source}.especie.${index}`, "En especie"],
      ], false, source)
      if (index > 1) next.activeWhen = append(next.activeWhen, when(`sat.row.${source}.aportacion-numerario-r${firstRow}.${index}`))
      groups.push(next)
    }
  }
  return groups
}

export function isSatOperationBranchGroupActive(group: SatOperationBranchGroup, values: Record<string, string>): boolean {
  return matches(group.activeWhen, values)
}

export function getSatOperationBranchMissingLabels(templateId: string, values: Record<string, string>, fields: SatXlsmField[] = []): string[] {
  const branches = getSatOperationBranchGroups(templateId, fields).filter((group) => {
    if (!isSatOperationBranchGroupActive(group, values)) return false
    const count = group.options.filter((option) => values[option.id] === YES).length
    return count === 0 || (!group.multiple && count !== 1)
  }).map((group) => group.label)
  const references = withSatParticipantOptions(fields, values).filter((field) => {
    if (!PARTICIPANT_LISTS[field.optionListId || ""] || !matches(field.activeWhen, values)) return false
    const value = values[field.id] ?? values[`${field.sheetName}!${field.cell}`] ?? ""
    if (!value.trim()) return false // The normal required-field evaluator handles empty values.
    const reference = value.match(/^R\d{2}(?=\s|$)/)?.[0]
    return !reference || !field.options?.some((option) => option.startsWith(`${reference} - `))
  }).map((field) => `${field.label}: selecciona una persona participante vigente`)
  return [...branches, ...references]
}

/** No defaults: declaring a branch is an explicit capture decision. */
export function applySatOperationBranchRules(templateId: string, sections: SatXlsmSection[]): SatXlsmSection[] {
  const partyControls = getPartyBranches(templateId, sections.flatMap((section) => section.fields)).controls
  const liquidationControls = getLiquidationBranches(templateId, sections.flatMap((section) => section.fields)).controls
  const contributionControls = getContributionBranches(templateId, sections.flatMap((section) => section.fields)).controls
  return sections.map((section) => ({ ...section, fields: section.fields.filter((field) => {
    if (templateId !== "sat-fraccion-xvi-activos-virtuales" || !slug(field.sheetName).startsWith("fondos-")) return true
    // The official card repeats every 11 rows: capture at +3 (operation)
    // and +8 (person/account). Old copied validations on blank separator rows
    // are not fields (some even describe a bank name as a birth date).
    const offset = (splitCell(field.cell).row - 12) % 11
    return offset === 3 || offset === 8
  }).map((field) => {
    const sheet = slug(field.sheetName)
    const block = slug(field.repeatGroup || "")
    const { col, row } = splitCell(field.cell)
    const conditions: Conditions = []
    const enable = (key: string) => conditions.push(...when(branchId(templateId, key)))
    if (["sat-fraccion-xii-sp-poder", "sat-fraccion-xii-sp-modif-patrimonial"].includes(templateId) && sheet === "aviso") {
      if (col === "C" && row >= 23 && row <= 25) enable("administrativa")
      if (col === "F" && row >= 23 && row <= 26) enable("jurisdiccional")
      if (row === 33) enable("oficina-nacional")
      if (row === 37) enable("oficina-extranjera")
    }
    if (templateId === "sat-fraccion-v-inmuebles" && sheet === "acto-u-operacion" && row >= 56 && row <= 65) {
      enable(col === "G" ? "contrato" : "instrumento-publico")
    }
    const partyControl = partyControls.get(field.id)
    if (partyControl) conditions.push(...when(partyControl))
    const liquidationControl = liquidationControls.get(field.id)
    if (liquidationControl) conditions.push(...when(liquidationControl))
    const contributionControl = contributionControls.get(field.id)
    if (contributionControl) conditions.push(...when(contributionControl))
    if (templateId === "sat-fraccion-iii-cheques" && sheet === "acto-u-operacion" && col === "C" && row >= 12 && row <= 18) {
      enable(`cheques-${row === 18 ? 9 : row - 11}`)
      return { ...field, label: `Número de cheques comercializados · ${field.label.replace(/^Número de cheques comercializados · /, "")}`,
        required: true, dataType: "numero", activeWhen: append(field.activeWhen, conditions) }
    }
    if (block.startsWith("especie-") && /^(tipo-de-inmueble|codigo-postal|estado|municipio-delegacion|folio-real)/.test(slug(field.label))) {
      const kind = section.fields.find((candidate) => candidate.repeatGroup === field.repeatGroup &&
        (candidate.repeatIndex || 1) === (field.repeatIndex || 1) && slug(candidate.label) === "tipo-de-bien")
      const propertyCodes = (kind?.options || []).filter((option) => /inmueble/i.test(option)).map(optionCode)
      if (kind && propertyCodes.length) conditions.push({ fieldId: kind.id, equals: propertyCodes })
    }
    // All ten XI books use the same 16=virtual asset branch, not only SPR03.
    if (templateId.startsWith("sat-fraccion-xi-") && sheet === "operaciones-financieras") {
      const instrument = section.fields.find((candidate) => slug(candidate.label) === "instrumento-monetario" &&
        (candidate.repeatIndex || 1) === (field.repeatIndex || 1))
      if (instrument && field.id !== instrument.id) {
        const label = slug(field.label)
        if (/activo(s)?-virtual(es)?/.test(label)) conditions.push({ fieldId: instrument.id, equals: ["16"] })
        if (/moneda|divisa/.test(label)) {
          const codes = [...new Set((instrument.options || []).map(optionCode).filter((code) => code !== "16"))]
          if (codes.length) conditions.push({ fieldId: instrument.id, equals: codes })
        }
      }
    }
    if (templateId === "sat-fraccion-viii-vehiculos") {
      for (const kind of ["terrestre", "maritimo", "aereo"]) {
        if (block.startsWith(`vehiculo-${kind}-`)) enable(kind)
      }
    }
    if (templateId === "sat-fraccion-x-traslado" && sheet === "acto-u-operacion") {
      const cellCondition = (cell: string, equals: string[]) => {
        const controller = section.fields.find((candidate) => candidate.cell === cell)
        if (controller) conditions.push({ fieldId: controller.id, equals })
      }
      if (block === "efectivo-o-instrumentos-monetarios-r12" && col !== "B") {
        cellCondition(`B${row}`, col < "F" ? ["EFECTIVO O INSTRUMENTO MONETARIO"] : ["BIENES U OBJETOS"])
      }
      if (row === 42) cellCondition("C6", ["1001", "1003"])
      if (row === 48 || row === 52) cellCondition("C6", ["1002", "1003"])
      if (row === 48 && col === "E") cellCondition("D48", ["CUSTODIA EN SUCURSAL"])
      if (row === 52) cellCondition("D48", ["CUSTODIA CUANDO NO ES EN SUCURSAL"])
      if (row === 58 || row === 62 || row === 67 || row === 71) cellCondition("C6", ["1001", "1003"])
      if (row === 58 && col === "D") cellCondition("C58", ["NACIONAL"])
      if (row === 58 && ["G", "H", "I", "J"].includes(col)) cellCondition("C58", ["INTERNACIONAL"])
      if (row === 67 || row === 71) cellCondition("E62", ["NO"])
      if ((row === 67 || row === 71) && ["B", "C", "D", "E", "F", "G"].includes(col)) {
        enable(`destinatario.${row === 67 ? "pf" : col >= "E" ? "fid" : "pm"}`)
      }
    }
    if (templateId === "sat-fraccion-ix-blindaje" && sheet === "acto-u-operacion") {
      if (row >= 12 && row <= 13) enable("vehiculo")
      if (row >= 15 && row <= 26) enable("inmueble")
    }
    if (templateId === "sat-fraccion-xvi-activos-virtuales" && VIRTUAL_OPERATIONS.some(([key]) => key === sheet)) {
      enable(sheet)
      if (sheet.startsWith("fondos-") && (row - 12) % 11 >= 8) {
        const index = field.repeatIndex || 1
        if (["C", "D", "E"].includes(col)) enable(`${sheet}.persona.${index}.pf`)
        if (col === "F") enable(`${sheet}.persona.${index}.pm`)
        if (["H", "I"].includes(col)) enable(`${sheet}.cuenta.${index}.nacional`)
        if (["J", "K"].includes(col)) enable(`${sheet}.cuenta.${index}.extranjera`)
      }
    }
    if (templateId === "sat-fraccion-v-bis-desarrollo" && sheet === "aviso" &&
      block.startsWith("el-desarrollo-fue-objeto-") && col === "C") {
      const controller = section.fields.find((candidate) => candidate.cell === `B${row}`)
      if (controller) conditions.push({ fieldId: controller.id, equals: ["1", "si", "sí"] })
    }
    if (templateId === "sat-fraccion-v-bis-desarrollo" && SOURCES.some(([key]) => key === sheet)) {
      enable(sheet)
      if (["socios", "terceros", "prestamonofin"].includes(sheet)) {
        if (block.startsWith("persona-fisica-")) enable(`${sheet}.pf`)
        if (block.startsWith("persona-moral-")) enable(`${sheet}.pm`)
        if (block.startsWith("fideicomiso-")) enable(`${sheet}.fid`)
      }
      if (sheet === "socios" && block.startsWith("domicilio-")) {
        enable(`socios.${block.startsWith("domicilio-nacional-") ? "nacional" : "internacional"}`)
      }
      if (block.startsWith("aportacion-numerario-")) {
        const inKindStart = sheet === "terceros" ? "H" : "G"
        enable(`${sheet}.${col >= inKindStart ? "especie" : "numerario"}.${field.repeatIndex || 1}`)
        if (col === "F") {
          const controller = section.fields.find((candidate) => candidate.cell === `E${row}`)
          if (controller) conditions.push({ fieldId: controller.id, equals: ["1", "si", "sí"] })
        }
      }
    }
    const originalConditions = field.activeWhen?.filter((condition) =>
      !condition.fieldId.startsWith(`sat.branch.${templateId}.personas.`) &&
      (!partyControl || condition.fieldId !== PERSONA_OBJETO_TYPE_FIELD_ID) &&
      // "Otro bien" is a separate contribution category. It is not the
      // description of the nearby real-estate catalog's "99,Otro" entry.
      !(contributionControl?.endsWith(".otro-bien") && condition.fieldId.includes("tipo-de-inmueble")))
    let conditionalField = conditions.length ? { ...field, activeWhen: append(originalConditions, conditions) } : field
    if (templateId === "sat-fraccion-v-inmuebles" && sheet === "acto-u-operacion" && row === 56) {
      conditionalField = { ...conditionalField, required: true, requiredWhen: undefined }
    }
    if (templateId === "sat-fraccion-vii-arte" && sheet === "acto-u-operacion" && col === "C" && field.repeatGroup) {
      // xmlDatosObra always emits descripcion; it is not an "Otro" detail.
      conditionalField = { ...conditionalField, required: (field.repeatIndex || 1) === 1, requiredWhen: undefined,
        activeWhen: conditionalField.activeWhen?.filter((condition) => !condition.fieldId.includes("tipo-de-objeto")) }
    }
    if (contributionControl?.endsWith(".otro-bien")) conditionalField = { ...conditionalField, required: true, requiredWhen: undefined }
    if (templateId === "sat-fraccion-x-traslado" && sheet === "acto-u-operacion") {
      // These cells are mandatory in xmlDetalleOperaciones although the source
      // workbook omits an asterisk on the recipient question and description.
      if (field.cell === "E62") conditionalField = { ...conditionalField, required: true }
      if (block === "efectivo-o-instrumentos-monetarios-r12" && col === "H") {
        conditionalField = { ...conditionalField, required: true, requiredWhen: undefined,
          activeWhen: conditionalField.activeWhen?.filter((condition) => !condition.fieldId.includes("tipo-de-valor-trasladado")) }
      }
    }
    if (templateId === "sat-fraccion-xvi-activos-virtuales" && sheet === "intercambios" && col === "H") {
      const side = (row - 9) % 3 === 0 ? "ENVIADO" : "RECIBIDO"
      return { ...conditionalField, label: `${side} · Monto de operación`, required: (field.repeatIndex || 1) === 1 }
    }
    return conditionalField
  }) }))
}

const PARTICIPANT_LISTS: Record<string, { pf: number; pm: number; fiduciaryColumn: string }> = {
  SP1105_LISTA_PERSONA_APORTA: { pf: 12, pm: 45, fiduciaryColumn: "G" },
  SP1109_LISTA_DE_FIDEICOMITENTES: { pf: 17, pm: 35, fiduciaryColumn: "F" },
}

/** Reproduces the official ListasCombos formulas for the two contribution
 * links. R01 identifies a participant row, not the client or the RFC. No
 * formula, macro or arbitrary workbook expression is executed. */
export function withSatParticipantOptions(fields: SatXlsmField[], values: Record<string, string>): SatXlsmField[] {
  const controls = inferSatRepeatRowControls(fields, values)
  const byCell = new Map(fields.map((field) => [`${field.sheetName}!${field.cell}`, field]))
  const read = (cell: string) => {
    const key = `Acto u operación!${cell}`
    const field = byCell.get(key)
    if (!field || !matches(field.activeWhen, controls)) return ""
    return (values[field.id] ?? values[key] ?? "").trim()
  }
  const cache = new Map<string, string[]>()
  return fields.map((field) => {
    const spec = PARTICIPANT_LISTS[field.optionListId || ""]
    if (!spec) return field
    const listId = field.optionListId!
    if (!cache.has(listId)) {
      const limit = listId === "SP1105_LISTA_PERSONA_APORTA" ? 30 : 15
      const options: string[] = []
      for (let index = 0; index < limit; index++) {
        const physicalName = ["B", "C", "D"].map((col) => read(`${col}${spec.pf + index}`)).filter(Boolean).join(" ")
        const name = [physicalName, read(`B${spec.pm + index}`), read(`${spec.fiduciaryColumn}${spec.pm + index}`)].filter(Boolean).join("")
        if (name) options.push(`R${String(index + 1).padStart(2, "0")} - ${name.toUpperCase()}`)
      }
      cache.set(listId, options)
    }
    return { ...field, dataType: "catalogo", options: cache.get(listId),
      placeholder: "Captura primero a la persona participante y selecciona su fila" }
  })
}

/** These literal column boundaries are the official "Cuando es..." headings,
 * not an inferred monetary total. Each additional contribution is explicit. */
function getContributionBranches(templateId: string, fields: SatXlsmField[]) {
  const groups: SatOperationBranchGroup[] = []
  const controls = new Map<string, string>()
  const spec = templateId === "sat-fraccion-xi-d-aportaciones" ? ["quien-realiza-la-aportacion-r80", "C", "F", "L"] :
    templateId === "sat-fraccion-xi-e-fideicomisos" ? ["quien-lo-aporta-r55", "C", "E", "K"] :
    templateId === "sat-fraccion-xii-notarios-d" ? ["cuando-es-monetario-r63", "B", "D", "J"] : undefined
  if (!spec) return { groups, controls }
  const [block, cashStart, propertyStart, otherStart] = spec
  const candidates = fields.filter((field) => field.repeatGroup === block)
  for (const index of [...new Set(candidates.map((field) => field.repeatIndex || 1))]) {
    const rowFields = candidates.filter((field) => (field.repeatIndex || 1) === index)
    const id = `aportacion.${index}`
    groups.push({ id: branchId(templateId, id), label: `Tipo de aportación o patrimonio · Registro ${index}`, multiple: false,
      options: ["monetario", "inmueble", "otro-bien"].map((kind) => ({ id: branchId(templateId, `${id}.${kind}`),
        label: kind === "monetario" ? "Monetario" : kind === "inmueble" ? "Inmueble" : "Otro bien" })),
      activeWhen: index > 1 ? when(getSatRepeatRowControlId(rowFields[0])) : undefined })
    for (const field of rowFields) {
      const col = splitCell(field.cell).col
      if (col < cashStart || (templateId === "sat-fraccion-xii-notarios-d" && col >= "L")) continue
      controls.set(field.id, branchId(templateId, `${id}.${col < propertyStart ? "monetario" : col < otherStart ? "inmueble" : "otro-bien"}`))
    }
  }
  return { groups, controls }
}

function getLiquidationBranches(templateId: string, fields: SatXlsmField[]) {
  const groups: SatOperationBranchGroup[] = []
  const controls = new Map<string, string>()
  for (const sheetName of [...new Set(fields.map((field) => field.sheetName))]) {
    const kindOf = (field: SatXlsmField) => {
      const block = slug(field.repeatGroup || "")
      if (block.startsWith("especie-")) return "especie"
      if (block.includes("numerario")) return "numerario"
      return undefined
    }
    const candidates = fields.filter((field) => field.sheetName === sheetName && kindOf(field))
    if (new Set(candidates.map(kindOf)).size !== 2) continue
    const id = `liquidacion.${slug(sheetName)}`
    groups.push({ id: branchId(templateId, id), label: `Liquidación · ${sheetName}`, multiple: true,
      options: [{ id: branchId(templateId, `${id}.numerario`), label: "Numerario" }, { id: branchId(templateId, `${id}.especie`), label: "En especie" }] })
    for (const field of candidates) controls.set(field.id, branchId(templateId, `${id}.${kindOf(field)}`))
  }
  return { groups, controls }
}

/** The books place alternative participant tables together. Their person kind
 * is independent of the client selected in the expediente. Keep separate pairs
 * when a book has several participant roles (for example trust parties). */
function getPartyBranches(templateId: string, fields: SatXlsmField[]) {
  const groups: SatOperationBranchGroup[] = []
  const controls = new Map<string, string>()
  if (!/^sat-fraccion-xii?-/.test(templateId)) return { groups, controls }
  const eligible = fields.filter((field) => templateId.startsWith("sat-fraccion-xii-") || slug(field.sheetName) === "acto-u-operacion")
  const kindOf = (field: SatXlsmField): string | undefined => {
    const block = slug(field.repeatGroup || "")
    const variant = slug(field.conditionalGroup || "")
    if (!/^(personas?-fisicas?-|personas?-morales?-|persona-moral-|fideicomiso-|contraparte-)/.test(block)) return undefined
    if (variant.includes("fideicomiso") || block.startsWith("fideicomiso-")) return "fid"
    if (/^personas?-fisicas?-/.test(block) || block.endsWith("-pf")) return "pf"
    if (/^(personas?-morales?-|persona-moral-)/.test(block) || block.endsWith("-pm")) return "pm"
    return undefined
  }
  const sheetNames = [...new Set(eligible.map((field) => field.sheetName))]
  for (const sheetName of sheetNames) {
    const sheetFields = eligible.filter((field) => field.sheetName === sheetName && kindOf(field))
    const blocks = [...new Set(sheetFields.map((field) => field.repeatGroup!))]
      .map((id) => ({ id, fields: sheetFields.filter((field) => field.repeatGroup === id) }))
      .sort((a, b) => Math.min(...a.fields.map((field) => splitCell(field.cell).row)) - Math.min(...b.fields.map((field) => splitCell(field.cell).row)))
    const pairs: typeof blocks[] = []
    for (const block of blocks) {
      const isPhysical = block.fields.some((field) => kindOf(field) === "pf")
      const last = pairs[pairs.length - 1]
      if (!last || (isPhysical && last.some((previous) => previous.fields.some((field) => kindOf(field) === "pf")))) pairs.push([block])
      else last.push(block)
    }
    for (const pair of pairs) {
      const kinds = [...new Set(pair.flatMap((block) => block.fields.map(kindOf)).filter((kind): kind is string => Boolean(kind)))]
      if (!kinds.includes("pf") || kinds.length < 2) continue
      const id = `personas.${slug(sheetName)}.${slug(pair[0].id)}`
      groups.push({ id: branchId(templateId, id), label: `Personas participantes · ${sheetName} · Bloque ${groups.length + 1}`,
        multiple: true, options: kinds.map((kind) => ({ id: branchId(templateId, `${id}.${kind}`), label: kind === "pf" ? "Persona física" : kind === "pm" ? "Persona moral" : "Fideicomiso" })) })
      for (const block of pair) for (const field of block.fields) controls.set(field.id, branchId(templateId, `${id}.${kindOf(field)}`))
    }
  }
  return { groups, controls }
}

export function getSatRepeatRowControlId(field: Pick<SatXlsmField, "sheetName" | "repeatGroup" | "repeatIndex">): string {
  return `sat.row.${slug(field.sheetName)}.${slug(field.repeatGroup || "")}.${field.repeatIndex || 1}`
}

/** Additional rows are activated explicitly; capture from an older record can restore its row control. */
export function inferSatRepeatRowControls(fields: SatXlsmField[], values: Record<string, string>): Record<string, string> {
  const result = { ...values }
  for (const field of fields) {
    if (!field.repeatGroup || (field.repeatIndex || 1) <= 1) continue
    const id = getSatRepeatRowControlId(field)
    if (result[id] !== undefined) continue
    const isBeneficiary = field.id.startsWith("beneficiario.") || slug(field.sheetName).includes("beneficiario")
    if (isBeneficiary && values[BENEFICIARY_REPEAT_MODE_FIELD_ID] !== YES) continue
    if ([field.id, `${field.sheetName}!${field.cell}`, field.targetCell].some((key) => key && values[key]?.trim())) {
      result[id] = YES
    }
  }
  return result
}

export function applySatRepeatRowRules(sections: SatXlsmSection[]): SatXlsmSection[] {
  return sections.map((section) => {
    const firstFields = section.fields.filter((field) => field.repeatGroup && (field.repeatIndex || 1) === 1)
    return { ...section, fields: section.fields.map((field) => {
      if (!field.repeatGroup || (field.repeatIndex || 1) <= 1) return field
      const rowCondition = when(getSatRepeatRowControlId(field))
      const first = firstFields.find((candidate) => candidate.repeatGroup === field.repeatGroup &&
        candidate.label === field.label && splitCell(candidate.cell).col === splitCell(field.cell).col)
      return {
        ...field,
        // Per-row activation replaces the former all-rows beneficiary toggle.
        activeWhen: append(field.activeWhen?.filter((condition) => condition.fieldId !== BENEFICIARY_REPEAT_MODE_FIELD_ID), rowCondition),
        required: false,
        requiredWhen: field.requiredWhen?.length ? append(field.requiredWhen, rowCondition) :
          first?.required ? rowCondition : undefined,
      }
    }) }
  })
}

export function getSatRepeatRowGroups(fields: SatXlsmField[], values: Record<string, string>) {
  const controls = inferSatRepeatRowControls(fields, values)
  const groups = new Map<string, { id: string; label: string; limit: number; rows: Array<{ index: number; controlId: string; active: boolean }> }>()
  const visible = new Set<string>()
  for (const field of fields) {
    if (!field.repeatGroup) continue
    const id = `${slug(field.sheetName)}.${slug(field.repeatGroup)}`
    // Visibility comes from the first row. Later rows may have their own
    // branch selection, which is made only after pressing "add record".
    if ((field.repeatIndex || 1) === 1 && matches(field.activeWhen, controls)) visible.add(id)
    const group = groups.get(id) || { id, label: `${field.sheetName} · ${field.repeatGroup.replace(/-r\d+$/, "").replace(/-/g, " ")}`, limit: field.repeatLimit || 1, rows: [] }
    const index = field.repeatIndex || 1
    if (!group.rows.some((row) => row.index === index)) group.rows.push({ index, controlId: getSatRepeatRowControlId(field), active: index === 1 || controls[getSatRepeatRowControlId(field)] === YES })
    groups.set(id, group)
  }
  return [...groups.values()].filter((group) => visible.has(group.id))
    .map((group) => ({ ...group, rows: group.rows.sort((a, b) => a.index - b.index) })).filter((group) => group.rows.length > 1)
}

/** A total may populate one first-row amount, never every disbursement, valuation or capital component. */
export function getSatPrimaryAmountFieldIds(fields: SatXlsmField[], values: Record<string, string> = {}): string[] {
  const exactLabels = new Set(["monto-de-operacion", "monto-operacion", "monto-de-la-operacion-financiera",
    "monto-de-la-liquidacion", "monto-total-del-gasto-acumulado-en-el-periodo", "monto-trasladado-y-o-custodiado"])
  const candidates = fields.filter((field) => (field.repeatIndex || 1) === 1 && exactLabels.has(slug(field.label)) &&
    matches(field.activeWhen, values))
  const cells = new Set(candidates.map((field) => `${field.sheetName}!${field.cell}`))
  return cells.size === 1 ? candidates.map((field) => field.id) : []
}
