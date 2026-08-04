import { strFromU8, strToU8, unzipSync, zipSync } from "fflate"

import { excelSerialFromDate, satDate } from "./sat-xml"
import {
  isSatXlsmFieldActive,
  isSatXlsmFieldRequired,
  pruneInactiveSatFieldValues,
} from "./ui-workflow"
import type {
  SatDynamicOperationForm,
  SatFilledWorkbookResult,
  SatTemplateCatalogItem,
  SatXlsmField,
  SatXlsmLayout,
  SatXlsmOptionList,
  SatXlsmSection,
} from "./types"

type WorkbookSheet = {
  name: string
  relId: string
  path: string
  state: "visible" | "hidden" | "veryHidden"
}

type ParsedWorkbook = {
  sheets: WorkbookSheet[]
  definedNames: Record<string, string>
  sharedStrings: string[]
}

type CellMap = Record<string, string>
type ResolvedWorkbookCellValue = {
  value: string
  dataType?: SatXlsmField["dataType"]
  writeDateAsText?: boolean
}

type WorkbookStyleKind = "text" | "date" | "other"
type PostalCatalogEntry = {
  estado: string
  municipio: string
}

const SHEET_COMBOS = "Combos"
const XML_SOURCE = "Plantilla oficial SAT XLSM"
const XII_NOTARIOS_A_TEMPLATE_ID = "sat-fraccion-xii-notarios-a"
const XII_NOTARIOS_A_TIPO_ACTO_FIELD_ID = "aviso.tipo-de-acto-realizado.f17"
const XII_NOTARIOS_A_TIPO_ACTO_OTRO_FIELD_ID = "aviso.descripcion-tipo-de-acto-otro.f18"
const XII_NOTARIOS_A_TIPO_ACTO_OTRO_CONDITION = [
  { fieldId: XII_NOTARIOS_A_TIPO_ACTO_FIELD_ID, equals: ["9"] },
]
const BENEFICIARY_PERSON_TYPE_FIELD_ID = "beneficiario.tipo_persona"
const BENEFICIARY_REPEAT_MODE_FIELD_ID = "beneficiario.permitir_repetidos"
const BENEFICIARY_TRUST_MODE_FIELD_ID = "beneficiario.es_fideicomiso"

export function extractSatXlsmLayoutFromBuffer(
  input: Uint8Array,
  template: Pick<SatTemplateCatalogItem, "templateId" | "officialXlsmName">,
): SatXlsmLayout {
  const zip = unzipSync(input)
  const workbook = parseWorkbook(zip)
  const sheetCells = new Map<string, CellMap>()

  for (const sheet of workbook.sheets) {
    const xml = readZipText(zip, sheet.path)
    sheetCells.set(sheet.name, parseSheetCells(xml, workbook.sharedStrings))
  }

  const optionLists = extractOptionLists(workbook, sheetCells)
  const sections: SatXlsmSection[] = workbook.sheets
    .filter((sheet) => sheet.name !== SHEET_COMBOS)
    .map((sheet) => {
      const xml = readZipText(zip, sheet.path)
      const cells = sheetCells.get(sheet.name) || {}
      const validations = parseDataValidations(xml)
      const manualFields = getManualFields(template.templateId, sheet.name, optionLists)
      const mergedFields = mergeFields([
        ...manualFields,
        ...buildValidationFields(sheet.name, cells, validations, optionLists),
        ...(template.templateId.includes("fraccion-v-inmuebles") ? [] : buildLabelFields(sheet.name, cells)),
      ])
      const fields = template.templateId.includes("fraccion-v-inmuebles")
        ? mergedFields.map((field) => (field.source === "manual-sat-map" ? field : { ...field, required: false }))
        : mergedFields

      return {
        id: slug(sheet.name),
        title: sheet.name,
        sheetName: sheet.name,
        sheetState: sheet.state,
        fields,
      }
    })

  return {
    schemaVersion: 1,
    templateId: template.templateId,
    officialXlsmName: template.officialXlsmName,
    generatedAt: new Date().toISOString(),
    workbookHasMacros: Boolean(zip["xl/vbaProject.bin"]),
    sections: applySatTemplateFieldRules(template.templateId, sections),
    optionLists,
    source: XML_SOURCE,
  }
}

export function buildSatDynamicOperationForm(input: {
  template: Pick<SatTemplateCatalogItem, "templateId" | "officialXlsmName">
  layout: SatXlsmLayout
  variantId?: string
  prefill?: Record<string, unknown>
}): SatDynamicOperationForm {
  const layout = normalizeSatXlsmLayout(input.layout)
  const sections = layout.sections.map((section) => ({
    ...section,
    fields: section.fields.map(withInferredSectionKind),
  }))
  const initialValues: Record<string, string> = {}
  const prefill = input.prefill || {}
  const beneficiaryType = beneficiaryPrefillBranch(prefill)
  if (beneficiaryType) initialValues[BENEFICIARY_PERSON_TYPE_FIELD_ID] = beneficiaryType
  if (hasExplicitFiduciaryBeneficiaryPrefill(prefill)) {
    initialValues[BENEFICIARY_TRUST_MODE_FIELD_ID] = "si"
  }

  for (const field of sections.flatMap((section) => section.fields)) {
    const value = prefillValueForField(field, prefill)
    if (value) initialValues[field.id] = value
  }

  return {
    templateId: input.template.templateId,
    templateFile: input.template.officialXlsmName,
    templateVariant: input.variantId,
    sections,
    initialValues,
    requiredFieldIds: layout.sections
      .flatMap((section) => section.fields)
      .filter((field) => field.required || Boolean(field.requiredWhen?.length))
      .map((field) => field.id),
    sourceLayoutGeneratedAt: layout.generatedAt,
  }
}

function withInferredSectionKind(field: SatXlsmField): SatXlsmField {
  if (field.sectionKind) return field
  const sheet = slug(field.sheetName)
  if (sheet.includes("persona-objeto")) return { ...field, sectionKind: "persona_objeto" }
  if (sheet.includes("beneficiario")) return { ...field, sectionKind: "beneficiario_controlador" }
  if (sheet.includes("socio") || sheet.includes("tercero") || sheet.includes("contraparte")) {
    return { ...field, sectionKind: "contraparte" }
  }
  if (sheet.includes("recpropios") || sheet.includes("prestamo") || sheet.includes("liquidacion") || sheet.includes("finbursatil")) {
    return { ...field, sectionKind: "liquidacion" }
  }
  if (sheet.includes("instrumento") || sheet.includes("contrato")) return { ...field, sectionKind: "instrumento" }
  return { ...field, sectionKind: "acto_operacion" }
}

export function normalizeSatXlsmLayout(layout: SatXlsmLayout): SatXlsmLayout {
  const sectionsWithTemplateRules = applySatTemplateFieldRules(layout.templateId, layout.sections)
  const sectionsWithoutAuxiliaryFields = sectionsWithTemplateRules.map((section) => ({
    ...section,
    fields: section.fields.filter((field) => !isAuxiliarySatXlsmField(field)),
  }))

  const hasManualAuthoritativeMap =
    layout.templateId.includes("fraccion-v-inmuebles") ||
    layout.templateId.includes("fraccion-xv-arrendamiento") ||
    layout.templateId.includes("fraccion-xi-b-administracion")

  if (!hasManualAuthoritativeMap) {
    return {
      ...layout,
      sections: sectionsWithoutAuxiliaryFields,
    }
  }

  return {
    ...layout,
    sections: applySatTemplateFieldRules(
      layout.templateId,
      sectionsWithoutAuxiliaryFields.map((section) => {
        const manualFields = getManualFields(layout.templateId, section.sheetName, layout.optionLists)
        const sourceFields = layout.templateId.includes("fraccion-xi-b-administracion")
          ? filterXiBExtractedFields(section.sheetName, section.fields, manualFields)
          : section.fields
        const fields = mergeFields([
          ...manualFields,
          ...sourceFields.map((field) =>
            field.source === "manual-sat-map" ? field : { ...field, required: false },
          ),
        ])
        return { ...section, fields }
      }),
    ),
  }
}

/**
 * Reglas condicionales verificadas contra la plantilla oficial SAT de la
 * Fracción XII (consulta: 2026-08-03). La extracción genérica sólo conserva
 * validaciones de lista, por lo que F18 (validación de longitud) se completa
 * aquí de forma determinista y queda enlazada al catálogo de F17.
 */
function applySatTemplateFieldRules(
  templateId: string,
  sections: SatXlsmSection[],
): SatXlsmSection[] {
  const sectionsWithBeneficiaryRules = sections.map((section) => ({
    ...section,
    fields: section.fields.map(applyBeneficiaryFieldRules),
  }))
  if (templateId !== XII_NOTARIOS_A_TEMPLATE_ID) return sectionsWithBeneficiaryRules

  return sectionsWithBeneficiaryRules.map((section) => {
    if (section.sheetName !== "Aviso") return section

    let hasTipoActoOtro = false
    const fields = section.fields.map((field) => {
      if (field.cell.toUpperCase() === "F17") {
        return { ...field, id: XII_NOTARIOS_A_TIPO_ACTO_FIELD_ID }
      }
      if (field.cell.toUpperCase() !== "F18") return field

      hasTipoActoOtro = true
      return buildXiiNotariosATipoActoOtroField(field)
    })

    if (!hasTipoActoOtro) fields.push(buildXiiNotariosATipoActoOtroField())
    return { ...section, fields }
  })
}

function applyBeneficiaryFieldRules(field: SatXlsmField): SatXlsmField {
  const branch = beneficiaryFieldBranch(field)
  if (!branch) return field

  const activeWhen = appendSatFieldConditions(field.activeWhen, [
    { fieldId: BENEFICIARY_PERSON_TYPE_FIELD_ID, equals: [branch] },
  ])
  if (beneficiaryRepeatIndex(field) > 1) {
    return {
      ...field,
      required: false,
      requiredWhen: undefined,
      activeWhen: appendSatFieldConditions(activeWhen, [
        { fieldId: BENEFICIARY_REPEAT_MODE_FIELD_ID, equals: ["si"] },
      ]),
    }
  }
  if (isFiduciaryBeneficiaryField(field)) {
    return {
      ...field,
      required: false,
      requiredWhen: undefined,
      activeWhen: appendSatFieldConditions(activeWhen, [
        { fieldId: BENEFICIARY_TRUST_MODE_FIELD_ID, equals: ["si"] },
      ]),
    }
  }
  return { ...field, activeWhen }
}

function appendSatFieldConditions(
  current: SatXlsmField["activeWhen"],
  additions: NonNullable<SatXlsmField["activeWhen"]>,
): NonNullable<SatXlsmField["activeWhen"]> {
  const conditions = [...(current || [])]
  for (const addition of additions) {
    const duplicate = conditions.some(
      (condition) =>
        condition.fieldId === addition.fieldId &&
        condition.equals.length === addition.equals.length &&
        condition.equals.every((value, index) => value === addition.equals[index]),
    )
    if (!duplicate) conditions.push(addition)
  }
  return conditions
}

function buildXiiNotariosATipoActoOtroField(
  sourceField?: SatXlsmField,
): SatXlsmField {
  return {
    ...sourceField,
    id: XII_NOTARIOS_A_TIPO_ACTO_OTRO_FIELD_ID,
    label: "Descripción Tipo de Acto (Otro)",
    sheetName: "Aviso",
    cell: "F18",
    required: false,
    dataType: "texto",
    optionListId: undefined,
    options: undefined,
    source: "manual-sat-map",
    conditionalGroup: "tipo-acto-realizado-otro",
    activeWhen: XII_NOTARIOS_A_TIPO_ACTO_OTRO_CONDITION,
    requiredWhen: XII_NOTARIOS_A_TIPO_ACTO_OTRO_CONDITION,
    targetCell: "Aviso!F18",
  }
}

function isAuxiliarySatXlsmField(field: SatXlsmField): boolean {
  const label = slug(field.label)
  return (
    (field.source === "xlsm-label" && slug(field.sheetName).includes("beneficiario")) ||
    (field.source === "xlsm-label" && /^los-campos-marcados-con.*obligatorios?$/.test(label)) ||
    label === "n-a" ||
    label === "na"
  )
}

export function fillSatXlsmTemplate(
  input: Uint8Array,
  options: {
    template: Pick<SatTemplateCatalogItem, "templateId" | "officialXlsmName">
    values: Record<string, string | number | boolean | null | undefined>
    layout?: SatXlsmLayout
  },
): SatFilledWorkbookResult {
  const zip = unzipSync(input)
  const workbook = parseWorkbook(zip)
  const layout = options.layout ? normalizeSatXlsmLayout(options.layout) : undefined
  const styleKinds = parseWorkbookStyleKinds(readZipText(zip, "xl/styles.xml"))
  let postalCatalog: Map<string, PostalCatalogEntry> | undefined
  const getPostalCatalog = () => {
    postalCatalog = postalCatalog || extractPostalCatalog(zip, workbook)
    return postalCatalog
  }
  const normalizedValues = Object.fromEntries(
    Object.entries(options.values).map(([key, value]) => [key, normalizeString(value)]),
  )
  const activeValues = layout
    ? pruneInactiveSatFieldValues({
        fields: layout.sections.flatMap((section) => section.fields),
        values: normalizedValues,
      })
    : normalizedValues
  const cellValues = resolveWorkbookCellValues(activeValues, layout)
  const writtenCells: string[] = []

  for (const sheet of workbook.sheets) {
    const valuesForSheet = cellValues.get(sheet.name)
    if (!valuesForSheet?.size) continue
    const xml = readZipText(zip, sheet.path)
    let updatedXml = xml
    for (const [cell, cellValue] of valuesForSheet) {
      updatedXml = setCellValue(updatedXml, cell, cellValue, styleKinds)
      writtenCells.push(`${sheet.name}!${cell}`)
    }
    updatedXml = refreshPostalFormulaCaches(updatedXml, workbook.sharedStrings, getPostalCatalog)
    zip[sheet.path] = strToU8(updatedXml)
  }

  const missingRequiredFields = layout
    ? layout.sections
        .flatMap((section) => section.fields)
        .filter((field) => isSatXlsmFieldRequired(field, activeValues))
        .filter((field) => {
          const sheetValues = cellValues.get(field.sheetName)
          const byField = normalizeString(activeValues[field.id])
          const byCell = normalizeString(activeValues[`${field.sheetName}!${field.cell}`])
          return !normalizeString(sheetValues?.get(field.cell)?.value) && !byField && !byCell
        })
        .map((field) => field.id)
    : []

  return {
    status: missingRequiredFields.length ? "blocked" : "filled",
    workbook: zipSync(zip),
    fileName: buildFilledWorkbookName(options.template.officialXlsmName),
    writtenCells,
    missingRequiredFields,
    warnings: zip["xl/vbaProject.bin"] ? [] : ["La plantilla no contiene vbaProject.bin; verificar macros oficiales."],
  }
}

export function satFieldValuesToWorkbookCells(
  values: Record<string, string | number | boolean | null | undefined>,
  layout: SatXlsmLayout,
): Record<string, string> {
  const cells: Record<string, string> = {}
  const normalizedLayout = normalizeSatXlsmLayout(layout)
  const fields = normalizedLayout.sections.flatMap((section) => section.fields)
  const normalizedValues = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, normalizeString(value)]),
  )
  const activeValues = pruneInactiveSatFieldValues({ fields, values: normalizedValues })

  for (const field of fields) {
    if (!isSatXlsmFieldActive(field, activeValues)) continue
    const value = activeValues[field.id]
    if (value === undefined || value === null || value === "") continue
    cells[`${field.sheetName}!${field.cell}`] = String(value)
  }

  for (const [key, value] of Object.entries(activeValues)) {
    if (!key.includes("!") || value === undefined || value === null || value === "") continue
    cells[key] = String(value)
  }

  return cells
}

export function buildSatWorkbookDownloadValues(input: {
  satTemplateId?: string
  values?: Record<string, string>
  cellValues?: Record<string, string>
  tenantRfc?: string
  periodo?: string
  outputKind?: string
  clienteNombre?: string
  clienteRfc?: string
  packageId?: string
}): Record<string, string> {
  const values: Record<string, string> = {
    ...(input.values || {}),
    ...(input.cellValues || {}),
  }

  const isInmueblesTemplate = Boolean(input.satTemplateId?.includes("fraccion-v-inmuebles"))
  const isArrendamientoTemplate = Boolean(input.satTemplateId?.includes("fraccion-xv-arrendamiento"))
  if (!isInmueblesTemplate && !isArrendamientoTemplate) return values

  const normalizedInputPeriod = normalizeSatPeriod(input.periodo) || input.periodo
  const setIfEmpty = (key: string, value: unknown) => {
    if (values[key] || value === undefined || value === null || value === "") return
    values[key] = normalizeSatDownloadValueForKey(key, value)
  }

  const isDemoPackage =
    Boolean(input.packageId?.toLowerCase().includes("demo")) ||
    input.clienteRfc === "DLV190624M32" ||
    input.tenantRfc === "ISN2103158Q7"
  const clienteRfc = (input.clienteRfc || "").trim().toUpperCase()
  const clienteNombre = (input.clienteNombre || "").trim()
  const isPersonaMoral =
    clienteRfc.length === 12 ||
    /\b(S\.?A\.?|SAPI|S\.? DE R\.?L\.?|S\.?C\.?|A\.?C\.?|CV|C\.V\.)\b/i.test(clienteNombre)

  setIfEmpty("persona_aviso.sujeto_obligado_rfc", input.tenantRfc)
  setIfEmpty("persona_aviso.periodo", normalizedInputPeriod)
  setIfEmpty("persona_aviso.referencia", buildFallbackReferencia(input.packageId, normalizedInputPeriod))
  setIfEmpty(
    "persona_aviso.prioridad",
    input.outputKind === "aviso_24h" ? "2,24 HORAS CON OPERACIONES" : "1,NORMAL",
  )
  setIfEmpty("persona_aviso.tipo_alerta", input.outputKind === "aviso_24h" ? undefined : "100,Sin alerta.")

  if (isPersonaMoral) {
    setIfEmpty("persona_aviso.pm.razon_social", clienteNombre)
    setIfEmpty("persona_aviso.pm.rfc", clienteRfc)
    setIfEmpty("persona_aviso.pm.pais_nacionalidad", "MEXICO,MX")
  } else {
    const parts = splitPersonName(clienteNombre)
    setIfEmpty("persona_aviso.pf.nombre", parts.nombre)
    setIfEmpty("persona_aviso.pf.apellido_paterno", parts.apellidoPaterno)
    setIfEmpty("persona_aviso.pf.apellido_materno", parts.apellidoMaterno)
    setIfEmpty("persona_aviso.pf.rfc", clienteRfc)
    setIfEmpty("persona_aviso.pf.pais_nacionalidad", "MEXICO,MX")
  }

  setIfEmpty("pago.fecha", values["acto.fecha_operacion"])
  if (isInmueblesTemplate) {
    setIfEmpty("instrumento.fecha", values["acto.fecha_operacion"])
    setIfEmpty("instrumento.fecha_contrato", values["acto.fecha_operacion"])
  }

  if (isDemoPackage && isInmueblesTemplate) {
    setIfEmpty("persona_aviso.pm.fecha_constitucion", "24/06/2019")
    setIfEmpty("persona_aviso.pm.giro_mercantil", "NO APLICA||1000000")
    setIfEmpty("persona_aviso.representante.nombre", "Ricardo")
    setIfEmpty("persona_aviso.representante.apellido_paterno", "Valdés")
    setIfEmpty("persona_aviso.representante.apellido_materno", "Novelo")
    setIfEmpty("persona_aviso.representante.fecha_nacimiento", "02/07/1976")
    setIfEmpty("persona_aviso.representante.rfc", "VANR760702QZ4")
    setIfEmpty("persona_aviso.representante.curp", "VANR760702HNLLVC09")
    setIfEmpty("persona_aviso.domicilio_nacional.estado", "Nuevo León")
    setIfEmpty("persona_aviso.domicilio_nacional.municipio", "San Pedro Garza García")
    setIfEmpty("persona_aviso.domicilio_nacional.ciudad", "San Pedro Garza García")
    setIfEmpty("persona_aviso.domicilio_nacional.colonia", "Valle del Campestre")
    setIfEmpty("persona_aviso.domicilio_nacional.calle", "Avenida Roble")
    setIfEmpty("persona_aviso.domicilio_nacional.numero_exterior", "300")
    setIfEmpty("persona_aviso.domicilio_nacional.codigo_postal", "66260")
    setIfEmpty("persona_aviso.contacto.pais_telefono", "MEXICO,MX")
    setIfEmpty("persona_aviso.contacto.telefono", "8183552200")
    setIfEmpty("persona_aviso.contacto.correo", "cumplimiento@dlv.demo")
    setIfEmpty("beneficiario.pf.nombre", "Adriana")
    setIfEmpty("beneficiario.pf.apellido_paterno", "Luna")
    setIfEmpty("beneficiario.pf.apellido_materno", "Paredes")
    setIfEmpty("beneficiario.pf.fecha_nacimiento", "12/09/1976")
    setIfEmpty("beneficiario.pf.rfc", "LUPA760912QA1")
    setIfEmpty("beneficiario.pf.curp", "LUPA760912MNLNRD04")
    setIfEmpty("beneficiario.pf.pais_nacionalidad", "MEXICO,MX")
    setIfEmpty("instrumento.numero", "INS-DEMO-2026-184")
    setIfEmpty("instrumento.notario", "28")
    setIfEmpty("instrumento.entidad", "19,NUEVO LEÓN")
  }

  for (const [key, value] of Object.entries(values)) {
    values[key] = normalizeSatDownloadValueForKey(key, value)
  }

  return values
}

function normalizeSatDownloadValue(value: unknown): string {
  const normalized = String(value).trim()
  const isoDate = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`
  return normalized
}

function normalizeSatDownloadValueForKey(key: string, value: unknown): string {
  const normalized = normalizeSatDownloadValue(value)
  if (isSatPeriodKey(key)) return normalizeSatPeriod(normalized) || normalized
  if (isPostalCodeKey(key)) return normalizePostalCode(normalized) || normalized
  return normalized
}

function normalizeSatPeriod(value: unknown): string {
  const text = String(value ?? "").trim()
  if (!text) return ""
  const sixDigits = text.match(/^(\d{4})(0[1-9]|1[0-2])$/)
  if (sixDigits) return `${sixDigits[1]}${sixDigits[2]}`
  const yearMonth = text.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/)
  if (yearMonth) return `${yearMonth[1]}${yearMonth[2].padStart(2, "0")}`
  const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) return `${dmy[3]}${dmy[2].padStart(2, "0")}`
  return ""
}

function normalizePostalCode(value: unknown): string {
  const text = String(value ?? "").trim()
  if (!text) return ""
  const exact = text.match(/^\d{4,5}$/)
  if (exact) return text.padStart(5, "0")
  const candidates = [...text.matchAll(/\b\d{4,5}\b/g)].map((match) => match[0])
  const postal = [...candidates].reverse().find((candidate) => candidate.length === 5) || candidates.at(-1)
  return postal ? postal.padStart(5, "0") : ""
}

function buildFallbackReferencia(packageId?: string, periodo?: string): string {
  const raw = packageId || `AVISO-${periodo || "SAT"}`
  return raw
    .replace(/^satpkg-/i, "")
    .replace(/[^a-z0-9-]+/gi, "-")
    .slice(0, 60)
    .toUpperCase()
}

function parseWorkbookStyleKinds(stylesXml: string): Map<string, WorkbookStyleKind> {
  const customFormats = new Map<string, string>()
  for (const tag of matchTags(stylesXml, "numFmt")) {
    const id = getAttr(tag, "numFmtId")
    const code = getAttr(tag, "formatCode")
    if (id && code) customFormats.set(id, code)
  }

  const styleKinds = new Map<string, WorkbookStyleKind>()
  const cellXfs = stylesXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] || ""
  matchTags(cellXfs, "xf").forEach((tag, index) => {
    const numFmtId = getAttr(tag, "numFmtId")
    const formatCode = customFormats.get(numFmtId) || builtinNumberFormatCode(numFmtId)
    styleKinds.set(String(index), classifyNumberFormat(formatCode))
  })
  return styleKinds
}

function builtinNumberFormatCode(numFmtId: string): string {
  if (numFmtId === "14") return "m/d/yy"
  if (numFmtId === "15") return "d-mmm-yy"
  if (numFmtId === "16") return "d-mmm"
  if (numFmtId === "17") return "mmm-yy"
  if (numFmtId === "22") return "m/d/yy h:mm"
  if (numFmtId === "49") return "@"
  return ""
}

function classifyNumberFormat(formatCode: string): WorkbookStyleKind {
  const normalized = formatCode.trim().toLowerCase()
  if (normalized === "@") return "text"
  if (/[dmy]/.test(normalized) && !normalized.includes("@")) return "date"
  return "other"
}

function parseWorkbook(zip: Record<string, Uint8Array>): ParsedWorkbook {
  const workbookXml = readZipText(zip, "xl/workbook.xml")
  const relsXml = readZipText(zip, "xl/_rels/workbook.xml.rels")
  const relationships: Record<string, string> = {}

  for (const rel of matchTags(relsXml, "Relationship")) {
    const id = getAttr(rel, "Id")
    const target = getAttr(rel, "Target")
    if (id && target) relationships[id] = normalizeWorkbookTarget(target)
  }

  const sheets = matchTags(workbookXml, "sheet").map((tag) => {
    const name = getAttr(tag, "name") || "Hoja"
    const relId = getAttr(tag, "r:id")
    const path = relId ? relationships[relId] || "" : ""
    const state = (getAttr(tag, "state") || "visible") as WorkbookSheet["state"]
    return {
      name,
      relId: relId || "",
      path,
      state,
    }
  })

  const definedNames: Record<string, string> = {}
  const definedNameRegex = /<definedName\b([^>]*)>([\s\S]*?)<\/definedName>/g
  let match: RegExpExecArray | null
  while ((match = definedNameRegex.exec(workbookXml))) {
    const name = getAttr(match[1], "name")
    const formula = decodeXml(match[2].trim())
    if (!name || name.startsWith("_xlnm")) continue
    definedNames[name] = formula
  }

  return {
    sheets,
    definedNames,
    sharedStrings: parseSharedStrings(readZipText(zip, "xl/sharedStrings.xml", true)),
  }
}

function parseSharedStrings(xml: string): string[] {
  if (!xml) return []
  const strings: string[] = []
  const regex = /<si\b[\s\S]*?<\/si>/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(xml))) {
    const textParts = [...match[0].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1]))
    strings.push(textParts.join(""))
  }
  return strings
}

function parseSheetCells(xml: string, sharedStrings: string[]): CellMap {
  const cells: CellMap = {}
  const regex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(xml))) {
    const attrs = match[1] || ""
    const body = match[2] || ""
    const ref = getAttr(attrs, "r")
    if (!ref) continue
    cells[ref] = readCellValue(attrs, body, sharedStrings)
  }
  return cells
}

function readCellValue(attrs: string, body: string, sharedStrings: string[]): string {
  const type = getAttr(attrs, "t")
  if (type === "s") {
    const sharedIndex = Number((body.match(/<v>(.*?)<\/v>/) || [])[1])
    return sharedStrings[sharedIndex] || ""
  }
  if (type === "inlineStr") {
    return [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((item) => decodeXml(item[1])).join("")
  }
  const value = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1]
  return value ? decodeXml(value) : ""
}

function extractOptionLists(workbook: ParsedWorkbook, sheetCells: Map<string, CellMap>): SatXlsmOptionList[] {
  const optionLists: SatXlsmOptionList[] = []
  for (const [name, formula] of Object.entries(workbook.definedNames)) {
    const parsedRange = parseDefinedNameRange(formula)
    if (!parsedRange) continue
    const cells = sheetCells.get(parsedRange.sheetName)
    if (!cells) continue
    const options = expandRange(parsedRange.range)
      .map((cell) => cells[cell])
      .map((value) => value?.trim())
      .filter(Boolean) as string[]
    if (!options.length) continue
    optionLists.push({
      id: name,
      label: name,
      sourceSheet: parsedRange.sheetName,
      sourceRange: parsedRange.range,
      options,
    })
  }
  return optionLists
}

function parseDefinedNameRange(formula: string): { sheetName: string; range: string } | null {
  const normalized = formula.replace(/^=/, "")
  const match = normalized.match(/^(?:'([^']+)'|([^!]+))!\$?([A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?)$/i)
  if (!match) return null
  return {
    sheetName: (match[1] || match[2] || "").trim(),
    range: match[3].replace(/\$/g, "").toUpperCase(),
  }
}

function parseDataValidations(xml: string): Array<{ sqref: string[]; optionListId?: string; inlineOptions?: string[] }> {
  const validations: Array<{ sqref: string[]; optionListId?: string; inlineOptions?: string[] }> = []
  // Keep the self-closing alternative separate. A single greedy attribute
  // capture can otherwise consume `/>` and pair that validation with the body
  // of a later node.
  const regex =
    /<dataValidation\b([^>]*)\/>|<dataValidation\b([^>]*)>([\s\S]*?)<\/dataValidation>/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(xml))) {
    const attrs = match[1] || match[2] || ""
    const body = match[3] || ""
    if ((getAttr(attrs, "type") || "").toLowerCase() !== "list") continue
    const sqref = (getAttr(attrs, "sqref") || "")
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean)
    const formula = decodeXml((body.match(/<formula1>([\s\S]*?)<\/formula1>/) || [])[1] || "")
      .replace(/^=/, "")
      .replace(/^"|"$/g, "")
      .trim()
    if (!sqref.length || !formula) continue
    validations.push({
      sqref,
      optionListId: /^[A-Za-z_][\w.]*$/.test(formula) ? formula : undefined,
      inlineOptions: formula.includes(",") ? formula.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
    })
  }
  return validations
}

function buildValidationFields(
  sheetName: string,
  cells: CellMap,
  validations: Array<{ sqref: string[]; optionListId?: string; inlineOptions?: string[] }>,
  optionLists: SatXlsmOptionList[],
): SatXlsmField[] {
  const fields: SatXlsmField[] = []
  const optionMap = new Map(optionLists.map((list) => [list.id, list.options]))

  for (const validation of validations) {
    const refs = validation.sqref.flatMap((range) => expandRange(range).slice(0, 1))
    for (const cell of refs) {
      const label = findNearbyLabel(cell, cells) || `${sheetName} ${cell}`
      fields.push({
        id: `${slug(sheetName)}.${slug(label)}.${cell.toLowerCase()}`,
        label: stripRequiredMarker(label),
        sheetName,
        cell,
        required: label.includes("*"),
        dataType: "catalogo",
        optionListId: validation.optionListId,
        options: validation.optionListId ? optionMap.get(validation.optionListId) || [] : validation.inlineOptions || [],
        source: "xlsm-data-validation",
      })
    }
  }

  return fields
}

function buildLabelFields(sheetName: string, cells: CellMap): SatXlsmField[] {
  const fields: SatXlsmField[] = []
  for (const [labelCell, label] of Object.entries(cells)) {
    if (!label.includes("*") || label.length > 120) continue
    if (isAuxiliaryLabelText(label)) continue
    const { col, row } = splitCell(labelCell)
    const targetCell = `${numberToColumn(columnToNumber(col) + 1)}${row}`
    const existingTarget = cells[targetCell]
    if (existingTarget && existingTarget.includes("*")) continue

    fields.push({
      id: `${slug(sheetName)}.${slug(label)}.${targetCell.toLowerCase()}`,
      label: stripRequiredMarker(label),
      sheetName,
      cell: targetCell,
      required: true,
      dataType: inferDataType(label),
      source: "xlsm-label",
    })
  }
  return fields
}

function isAuxiliaryLabelText(label: string): boolean {
  const normalized = slug(label)
  return /^los-campos-marcados-con.*obligatorios?$/.test(normalized) || normalized === "n-a" || normalized === "na"
}

function inferDataType(label: string): SatXlsmField["dataType"] {
  const normalized = slug(label)
  if (normalized.includes("fecha")) return "fecha"
  if (normalized.includes("monto") || normalized.includes("valor") || normalized.includes("importe")) return "moneda"
  if (normalized.includes("numero") || normalized.includes("cantidad")) return "numero"
  return "texto"
}

function getManualFields(templateId: string, sheetName: string, optionLists: SatXlsmOptionList[]): SatXlsmField[] {
  if (templateId.includes("fraccion-xi-b-administracion")) {
    return getServiciosProfesionalesAdministracionManualFields(sheetName, optionLists)
  }
  if (templateId.includes("fraccion-xv-arrendamiento")) return getArrendamientoManualFields(sheetName, optionLists)
  if (!templateId.includes("fraccion-v-inmuebles")) return []
  const optionMap = new Map(optionLists.map((list) => [list.id, list.options]))
  const field = (
    id: string,
    label: string,
    cell: string,
    dataType: SatXlsmField["dataType"],
    optionListId?: string,
    required = true,
    extras: Partial<SatXlsmField> = {},
  ): SatXlsmField => ({
    id,
    label,
    sheetName,
    cell,
    required,
    dataType,
    optionListId,
    options: optionListId ? optionMap.get(optionListId) || [] : undefined,
    source: "manual-sat-map",
    targetCell: `${sheetName}!${cell}`,
    ...extras,
  })

  if (sheetName === "Persona Objeto del aviso") {
    return [
      field("persona_aviso.sujeto_obligado_rfc", "RFC del sujeto obligado", "C4", "texto", undefined, true, {
        sectionKind: "alta_sat",
      }),
      field("persona_aviso.periodo", "Periodo reportado AAAAMM", "C5", "texto", undefined, true, {
        sectionKind: "alta_sat",
      }),
      field("persona_aviso.referencia", "Referencia del aviso", "C6", "texto", undefined, true, {
        sectionKind: "alta_sat",
      }),
      field("persona_aviso.prioridad", "Prioridad", "E6", "catalogo", "Prioridades", true, {
        sectionKind: "alta_sat",
      }),
      field("persona_aviso.tipo_alerta", "Tipo de alerta", "C7", "catalogo", "Alertas", true, {
        sectionKind: "alta_sat",
      }),
      field("persona_aviso.descripcion_alerta", "Descripción de alerta", "E7", "texto", undefined, false, {
        sectionKind: "alta_sat",
      }),
      field("persona_aviso.aviso_modificatorio", "Aviso modificatorio", "C11", "texto", undefined, false, {
        sectionKind: "alta_sat",
      }),
      field("persona_aviso.folio_previo", "Folio del aviso previo", "C12", "texto", undefined, false, {
        sectionKind: "alta_sat",
      }),
      field("persona_aviso.descripcion_modificacion", "Descripción de modificación", "C13", "texto", undefined, false, {
        sectionKind: "alta_sat",
      }),
      ...buildRepeatedFields({
        groupId: "persona_objeto_pf",
        basePrefix: "persona_aviso.pf",
        labelPrefix: "Persona física objeto del aviso",
        sheetName,
        startRow: 19,
        count: 10,
        sectionKind: "persona_objeto",
        requiredFirstRow: false,
        columns: [
          ["nombre", "Nombre(s)", "B", "texto"],
          ["apellido_paterno", "Apellido paterno", "C", "texto"],
          ["apellido_materno", "Apellido materno", "D", "texto"],
          ["fecha_nacimiento", "Fecha de nacimiento", "E", "fecha"],
          ["rfc", "RFC", "F", "texto"],
          ["curp", "CURP", "G", "texto"],
          ["pais_nacionalidad", "País de nacionalidad", "H", "catalogo", "Paises"],
          ["actividad_economica", "Actividad económica", "I", "catalogo", "Actividades"],
        ],
        field,
      }),
      ...buildRepeatedFields({
        groupId: "persona_objeto_pm",
        basePrefix: "persona_aviso.pm",
        labelPrefix: "Persona moral o fideicomiso objeto del aviso",
        sheetName,
        startRow: 33,
        count: 10,
        sectionKind: "persona_objeto",
        requiredFirstRow: false,
        columns: [
          ["razon_social", "Denominación o razón social", "B", "texto"],
          ["fecha_constitucion", "Fecha de constitución", "C", "fecha"],
          ["rfc", "RFC", "D", "texto"],
          ["pais_nacionalidad", "País de nacionalidad", "E", "catalogo", "Paises"],
          ["giro_mercantil", "Giro mercantil", "F", "catalogo", "Giros"],
          ["denominacion_fiduciario", "Denominación fiduciario", "G", "texto"],
          ["rfc_fiduciario", "RFC fiduciario", "H", "texto"],
          ["identificador_fideicomiso", "Identificador del fideicomiso", "I", "texto"],
        ],
        field,
      }),
      ...buildRepeatedFields({
        groupId: "persona_objeto_representante",
        basePrefix: "persona_aviso.representante",
        labelPrefix: "Representante o apoderado",
        sheetName,
        startRow: 46,
        count: 10,
        sectionKind: "persona_objeto",
        requiredFirstRow: false,
        columns: [
          ["nombre", "Nombre(s)", "B", "texto"],
          ["apellido_paterno", "Apellido paterno", "C", "texto"],
          ["apellido_materno", "Apellido materno", "D", "texto"],
          ["fecha_nacimiento", "Fecha de nacimiento", "E", "fecha"],
          ["rfc", "RFC", "F", "texto"],
          ["curp", "CURP", "G", "texto"],
        ],
        field,
      }),
      ...buildRepeatedFields({
        groupId: "persona_objeto_domicilio_nacional",
        basePrefix: "persona_aviso.domicilio_nacional",
        labelPrefix: "Domicilio nacional",
        sheetName,
        startRow: 60,
        count: 10,
        sectionKind: "persona_objeto",
        requiredFirstRow: false,
        columns: [
          ["codigo_postal", "Código postal", "B", "texto"],
          ["colonia", "Colonia", "E", "texto"],
          ["calle", "Calle, avenida o vía", "F", "texto"],
          ["numero_exterior", "Número exterior", "G", "texto"],
          ["numero_interior", "Número interior", "H", "texto"],
        ],
        field,
      }),
      ...buildRepeatedFields({
        groupId: "persona_objeto_domicilio_internacional",
        basePrefix: "persona_aviso.domicilio_internacional",
        labelPrefix: "Domicilio internacional",
        sheetName,
        startRow: 73,
        count: 10,
        sectionKind: "persona_objeto",
        requiredFirstRow: false,
        columns: [
          ["pais", "País", "B", "catalogo", "Paises"],
          ["estado_provincia", "Estado o provincia", "C", "texto"],
          ["ciudad", "Ciudad o población", "D", "texto"],
          ["colonia", "Colonia", "E", "texto"],
          ["calle", "Calle, avenida o vía", "F", "texto"],
          ["numero_exterior", "Número exterior", "G", "texto"],
          ["numero_interior", "Número interior", "H", "texto"],
          ["codigo_postal", "Código postal", "I", "texto"],
        ],
        field,
      }),
      ...buildRepeatedFields({
        groupId: "persona_objeto_contacto",
        basePrefix: "persona_aviso.contacto",
        labelPrefix: "Contacto",
        sheetName,
        startRow: 86,
        count: 6,
        sectionKind: "persona_objeto",
        requiredFirstRow: false,
        columns: [
          ["pais_telefono", "País del teléfono", "B", "catalogo", "Paises"],
          ["telefono", "Número de teléfono", "C", "texto"],
          ["correo", "Correo electrónico", "D", "texto"],
        ],
        field,
      }),
    ]
  }

  if (sheetName === "Beneficiario controlador") {
    return [
      ...buildRepeatedFields({
        groupId: "beneficiario_controlador_pf",
        basePrefix: "beneficiario.pf",
        labelPrefix: "Beneficiario controlador persona física",
        sheetName,
        startRow: 5,
        count: 10,
        sectionKind: "beneficiario_controlador",
        requiredFirstRow: false,
        columns: [
          ["nombre", "Nombre(s)", "B", "texto"],
          ["apellido_paterno", "Apellido paterno", "C", "texto"],
          ["apellido_materno", "Apellido materno", "D", "texto"],
          ["fecha_nacimiento", "Fecha de nacimiento", "E", "fecha"],
          ["rfc", "RFC", "F", "texto"],
          ["curp", "CURP", "G", "texto"],
          ["pais_nacionalidad", "País de nacionalidad", "H", "catalogo", "Paises"],
        ],
        field,
      }),
      ...buildRepeatedFields({
        groupId: "beneficiario_controlador_pm",
        basePrefix: "beneficiario.pm",
        labelPrefix: "Beneficiario controlador persona moral o fideicomiso",
        sheetName,
        startRow: 18,
        count: 10,
        sectionKind: "beneficiario_controlador",
        requiredFirstRow: false,
        columns: [
          ["razon_social", "Denominación o razón social", "B", "texto"],
          ["fecha_constitucion", "Fecha de constitución", "C", "fecha"],
          ["rfc", "RFC", "D", "texto"],
          ["pais_nacionalidad", "País de nacionalidad", "E", "catalogo", "Paises"],
          ["denominacion_fiduciario", "Denominación fiduciario", "F", "texto"],
          ["rfc_fiduciario", "RFC fiduciario", "G", "texto"],
          ["identificador_fideicomiso", "Identificador del fideicomiso", "H", "texto"],
        ],
        field,
      }),
    ]
  }

  if (sheetName !== "Acto u operación") return []

  return [
    field("acto.fecha_operacion", "Fecha de operación", "C5", "fecha", undefined, true, {
      sectionKind: "acto_operacion",
    }),
    field("acto.tipo_operacion", "Tipo de operación", "C6", "catalogo", undefined, false, {
      sectionKind: "acto_operacion",
    }),
    field("acto.figura_cliente", "Figura del cliente reportado", "C7", "catalogo", "FiguraCliente", true, {
      sectionKind: "acto_operacion",
    }),
    field(
      "acto.figura_sujeto_obligado",
      "Figura de la persona que realiza la actividad",
      "C8",
      "catalogo",
      "FiguraPersona",
      true,
      { sectionKind: "acto_operacion" },
    ),
    ...buildRepeatedFields({
      groupId: "contraparte_pf",
      basePrefix: "contraparte.pf",
      labelPrefix: "Contraparte persona física",
      sheetName,
      startRow: 14,
      count: 10,
      sectionKind: "contraparte",
      requiredFirstRow: false,
      columns: [
        ["nombre", "Nombre(s)", "B", "texto"],
        ["apellido_paterno", "Apellido paterno", "C", "texto"],
        ["apellido_materno", "Apellido materno", "D", "texto"],
        ["fecha_nacimiento", "Fecha de nacimiento", "E", "fecha"],
        ["rfc", "RFC", "F", "texto"],
        ["curp", "CURP", "G", "texto"],
        ["pais_nacionalidad", "País de nacionalidad", "H", "catalogo", "Paises"],
      ],
      field,
    }),
    ...buildRepeatedFields({
      groupId: "contraparte_pm",
      basePrefix: "contraparte.pm",
      labelPrefix: "Contraparte persona moral o fideicomiso",
      sheetName,
      startRow: 27,
      count: 10,
      sectionKind: "contraparte",
      requiredFirstRow: false,
      columns: [
        ["razon_social", "Denominación o razón social", "B", "texto"],
        ["fecha_constitucion", "Fecha de constitución", "C", "fecha"],
        ["rfc", "RFC", "D", "texto"],
        ["pais_nacionalidad", "País de nacionalidad", "E", "catalogo", "Paises"],
        ["denominacion_fiduciario", "Denominación fiduciario", "F", "texto"],
        ["rfc_fiduciario", "RFC fiduciario", "G", "texto"],
        ["identificador_fideicomiso", "Identificador del fideicomiso", "H", "texto"],
      ],
      field,
    }),
    ...buildRepeatedFields({
      groupId: "inmuebles",
      basePrefix: "inmueble",
      labelPrefix: "Inmueble",
      sheetName,
      startRow: 42,
      count: 10,
      sectionKind: "acto_operacion",
      requiredFirstRow: true,
      columns: [
        ["tipo_bien", "Tipo de bien inmueble", "B", "catalogo", "TipoInmueble"],
        ["valor_pactado", "Valor pactado del inmueble", "C", "moneda"],
        ["codigo_postal", "Código postal del inmueble", "D", "texto"],
        ["estado", "Estado", "E", "texto"],
        ["municipio", "Municipio o delegación", "F", "texto"],
        ["calle", "Calle", "G", "texto"],
        ["numero_exterior", "Número exterior", "H", "texto"],
        ["numero_interior", "Número interior", "I", "texto"],
        ["colonia", "Colonia", "J", "texto"],
        ["terreno_m2", "Terreno m2", "K", "numero"],
        ["inmueble_m2", "Inmueble m2", "L", "numero"],
        ["folio_real", "Folio real", "M", "texto"],
      ],
      optionalFirstRowKeys: ["estado", "municipio", "numero_interior"],
      field,
    }),
    field("instrumento.fecha", "Fecha del instrumento", "B56", "fecha", undefined, false, {
      sectionKind: "instrumento",
    }),
    field("instrumento.numero", "Número de instrumento", "C56", "texto", undefined, false, {
      sectionKind: "instrumento",
    }),
    field("instrumento.notario", "Número de notario", "D56", "texto", undefined, false, {
      sectionKind: "instrumento",
    }),
    field("instrumento.entidad", "Entidad del notario", "E56", "catalogo", "Entidades", false, {
      sectionKind: "instrumento",
    }),
    field("instrumento.valor_avaluo", "Valor de avalúo", "F56", "moneda", undefined, false, {
      sectionKind: "instrumento",
    }),
    field("instrumento.fecha_contrato", "Fecha de contrato", "G56", "fecha", undefined, false, {
      sectionKind: "instrumento",
    }),
    ...buildRepeatedFields({
      groupId: "pagos",
      basePrefix: "pago",
      labelPrefix: "Liquidación",
      sheetName,
      startRow: 70,
      count: 10,
      sectionKind: "liquidacion",
      requiredFirstRow: true,
      columns: [
        ["fecha", "Fecha de pago", "B", "fecha"],
        ["forma_pago", "Forma de pago", "C", "catalogo", "FormasPago"],
        ["instrumento_monetario", "Instrumento monetario", "D", "catalogo", "InstrumentoMonetario"],
        ["moneda", "Moneda o divisa", "E", "catalogo", "Monedas"],
        ["monto", "Monto de operación", "F", "moneda"],
      ],
      field,
    }),
  ]
}

function getServiciosProfesionalesAdministracionManualFields(
  sheetName: string,
  optionLists: SatXlsmOptionList[],
): SatXlsmField[] {
  const optionMap = new Map(optionLists.map((list) => [list.id, list.options]))
  const field = (
    id: string,
    label: string,
    cell: string,
    dataType: SatXlsmField["dataType"],
    optionListId?: string,
    required = true,
    extras: Partial<SatXlsmField> = {},
  ): SatXlsmField => ({
    id,
    label,
    sheetName,
    cell,
    required,
    dataType,
    optionListId,
    options: optionListId ? optionMap.get(optionListId) || [] : undefined,
    source: "manual-sat-map",
    targetCell: `${sheetName}!${cell}`,
    ...extras,
  })

  const condition = (fieldId: string, ...equals: string[]) => [{ fieldId, equals }]

  if (sheetName === "Persona Objeto del aviso") {
    return [
      field(
        "persona_aviso.ocupacion",
        "Ocupación de quien presta el servicio profesional",
        "E4",
        "catalogo",
        "CATALOGO_DE_OCUPACION",
        true,
        { sectionKind: "alta_sat" },
      ),
      field(
        "persona_aviso.ocupacion_otro",
        "Descripción de otra ocupación",
        "E5",
        "texto",
        undefined,
        false,
        {
          sectionKind: "alta_sat",
          activeWhen: condition("persona_aviso.ocupacion", "99"),
          requiredWhen: condition("persona_aviso.ocupacion", "99"),
        },
      ),
    ]
  }

  if (sheetName === "Acto u operación") {
    const activoSelectorId = "acto.activo_administrado"
    const otroActivoWhen = condition(activoSelectorId, "99")
    const inmuebleWhen = condition(activoSelectorId, "9")
    const instrumentoFinancieroWhen = condition(activoSelectorId, "10")
    return [
      field("acto.fecha_operacion", "Fecha de operación", "D4", "fecha", undefined, true, {
        sectionKind: "acto_operacion",
      }),
      field(
        "acto.operaciones_financieras_count",
        "Número de operaciones financieras a reportar",
        "D5",
        "numero",
        undefined,
        true,
        { sectionKind: "acto_operacion" },
      ),
      field(
        "acto.area_servicio",
        "Área de servicio",
        "B124",
        "catalogo",
        "CATALOGO_SP1103_AREA_DE_SERVICIO",
        true,
        { sectionKind: "acto_operacion" },
      ),
      field(
        "acto.area_servicio_otro",
        "Descripción de otra área de servicio",
        "C124",
        "texto",
        undefined,
        false,
        {
          sectionKind: "acto_operacion",
          activeWhen: condition("acto.area_servicio", "99"),
          requiredWhen: condition("acto.area_servicio", "99"),
        },
      ),
      field(
        activoSelectorId,
        "Activo administrado",
        "E124",
        "catalogo",
        "CATALOGO_SP1103_ACTIVO_ADMINISTRADO",
        true,
        { sectionKind: "acto_operacion" },
      ),
      field(
        "acto.activo_administrado_otro",
        "Descripción del activo administrado",
        "F124",
        "texto",
        undefined,
        false,
        {
          sectionKind: "acto_operacion",
          activeWhen: otroActivoWhen,
          requiredWhen: otroActivoWhen,
        },
      ),
      field("acto.numero_empleados", "Número de empleados", "H124", "numero", undefined, true, {
        sectionKind: "acto_operacion",
      }),
      field(
        "acto.descripcion_activo_administrado",
        "Descripción del activo administrado",
        "B179",
        "texto",
        undefined,
        false,
        {
          sectionKind: "acto_operacion",
          activeWhen: otroActivoWhen,
          requiredWhen: otroActivoWhen,
        },
      ),
      field(
        "activo_inmueble.tipo",
        "Tipo de inmueble administrado",
        "B14",
        "catalogo",
        "CATALOGO_TIPO_DE_INMUEBLE",
        true,
        { sectionKind: "acto_operacion", activeWhen: inmuebleWhen },
      ),
      field(
        "activo_inmueble.valor_referencia",
        "Valor de referencia del inmueble administrado",
        "C14",
        "moneda",
        undefined,
        true,
        { sectionKind: "acto_operacion", activeWhen: inmuebleWhen },
      ),
      field(
        "activo_inmueble.codigo_postal",
        "Código postal del inmueble administrado",
        "D14",
        "texto",
        undefined,
        true,
        { sectionKind: "acto_operacion", activeWhen: inmuebleWhen },
      ),
      field(
        "activo_inmueble.colonia",
        "Colonia del inmueble administrado",
        "G14",
        "catalogo",
        "COLONIA_SP03_INM_001",
        true,
        { sectionKind: "acto_operacion", activeWhen: inmuebleWhen },
      ),
      field(
        "activo_inmueble.calle",
        "Calle, avenida o vía del inmueble administrado",
        "H14",
        "texto",
        undefined,
        true,
        { sectionKind: "acto_operacion", activeWhen: inmuebleWhen },
      ),
      field(
        "activo_inmueble.numero_exterior",
        "Número exterior del inmueble administrado",
        "I14",
        "texto",
        undefined,
        true,
        { sectionKind: "acto_operacion", activeWhen: inmuebleWhen },
      ),
      field(
        "activo_inmueble.numero_interior",
        "Número interior del inmueble administrado",
        "J14",
        "texto",
        undefined,
        false,
        { sectionKind: "acto_operacion", activeWhen: inmuebleWhen },
      ),
      field(
        "activo_inmueble.folio_real",
        "Folio real del inmueble administrado",
        "K14",
        "texto",
        undefined,
        true,
        { sectionKind: "acto_operacion", activeWhen: inmuebleWhen },
      ),
      field(
        "activo_financiero.estatus_manejo",
        "Estatus del manejo",
        "B69",
        "catalogo",
        "CATALOGO_SP1103_ESTATUS_DE_MANEJO",
        true,
        { sectionKind: "acto_operacion", activeWhen: instrumentoFinancieroWhen },
      ),
      field(
        "activo_financiero.tipo_institucion",
        "Tipo de institución financiera",
        "C69",
        "catalogo",
        "CATALOGO_SP1103_INSTITUCIONES_FINANCIERAS",
        true,
        { sectionKind: "acto_operacion", activeWhen: instrumentoFinancieroWhen },
      ),
      field(
        "activo_financiero.nombre_institucion",
        "Nombre de la institución financiera",
        "E69",
        "texto",
        undefined,
        true,
        { sectionKind: "acto_operacion", activeWhen: instrumentoFinancieroWhen },
      ),
      field(
        "activo_financiero.cuenta_contrato_poliza",
        "Número de cuenta, contrato o póliza",
        "G69",
        "texto",
        undefined,
        true,
        { sectionKind: "acto_operacion", activeWhen: instrumentoFinancieroWhen },
      ),
    ]
  }

  if (sheetName === "Operaciones financieras") {
    const instrumentoSelectorId = "operacion_financiera.instrumento_monetario"
    const virtualWhen = condition(instrumentoSelectorId, "16")
    const monedaWhen = condition(
      instrumentoSelectorId,
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
      "13",
      "14",
      "15",
      "99",
    )
    return [
      field(
        "operacion_financiera.monto",
        "Monto de la operación financiera",
        "B7",
        "moneda",
        undefined,
        true,
        { sectionKind: "liquidacion" },
      ),
      field(
        instrumentoSelectorId,
        "Instrumento monetario",
        "C7",
        "catalogo",
        "CATALOGO_INSTRUMENTO_MONETARIO",
        true,
        { sectionKind: "liquidacion" },
      ),
      field(
        "operacion_financiera.moneda",
        "Moneda o divisa",
        "D7",
        "catalogo",
        "CATALOGO_DE_MONEDAS",
        true,
        { sectionKind: "liquidacion", activeWhen: monedaWhen },
      ),
      field(
        "operacion_financiera.activo_virtual",
        "Activo virtual",
        "E7",
        "catalogo",
        "CATALOGO_DE_ACTIVOS_VIRTUALES",
        true,
        { sectionKind: "liquidacion", activeWhen: virtualWhen },
      ),
      field(
        "operacion_financiera.activo_virtual_otro",
        "Descripción de otro activo virtual",
        "F7",
        "texto",
        undefined,
        false,
        {
          sectionKind: "liquidacion",
          activeWhen: [
            ...virtualWhen,
            ...condition("operacion_financiera.activo_virtual", "999999"),
          ],
          requiredWhen: [
            ...virtualWhen,
            ...condition("operacion_financiera.activo_virtual", "999999"),
          ],
        },
      ),
      field(
        "operacion_financiera.activo_virtual_cantidad",
        "Cantidad de activo virtual operado",
        "G7",
        "numero",
        undefined,
        true,
        { sectionKind: "liquidacion", activeWhen: virtualWhen },
      ),
    ]
  }

  return []
}

function filterXiBExtractedFields(
  sheetName: string,
  fields: SatXlsmField[],
  manualFields: SatXlsmField[],
): SatXlsmField[] {
  const manualCells = new Set(manualFields.map((field) => field.cell.toUpperCase()))
  return fields.filter((field) => {
    const cell = field.cell.toUpperCase()
    const normalizedLabel = slug(field.label)
    if (manualCells.has(cell)) return false
    if (field.optionListId === "CATALOGO_DE_OCUPACION") return false
    if (/^(persona-objeto-del-aviso|acto-u-operacion)-[a-z]+\d+$/.test(normalizedLabel)) return false
    if (/^r\d+$/.test(normalizedLabel)) return false

    if (sheetName === "Acto u operación") {
      const row = Number(cell.match(/\d+/)?.[0] ?? 0)
      if (row >= 13 && row <= 68) return false
      if (row >= 123 && row <= 179) return false
    }
    if (sheetName === "Operaciones financieras") return false
    return true
  })
}

function getArrendamientoManualFields(sheetName: string, optionLists: SatXlsmOptionList[]): SatXlsmField[] {
  const optionMap = new Map(optionLists.map((list) => [list.id, list.options]))
  const field = (
    id: string,
    label: string,
    cell: string,
    dataType: SatXlsmField["dataType"],
    optionListId?: string,
    required = true,
    extras: Partial<SatXlsmField> = {},
  ): SatXlsmField => ({
    id,
    label,
    sheetName,
    cell,
    required,
    dataType,
    optionListId,
    options: optionListId ? optionMap.get(optionListId) || [] : undefined,
    source: "manual-sat-map",
    targetCell: `${sheetName}!${cell}`,
    ...extras,
  })

  if (sheetName === "Persona Objeto del aviso") {
    return [
      field("persona_aviso.sujeto_obligado_rfc", "RFC del sujeto obligado", "C4", "texto", undefined, true, {
        sectionKind: "alta_sat",
      }),
      field("persona_aviso.periodo", "Periodo reportado AAAAMM", "C5", "texto", undefined, true, {
        sectionKind: "alta_sat",
      }),
      field("persona_aviso.referencia", "Referencia del aviso", "C6", "texto", undefined, true, {
        sectionKind: "alta_sat",
      }),
      field("persona_aviso.prioridad", "Prioridad", "E6", "catalogo", "Prioridades", true, {
        sectionKind: "alta_sat",
      }),
      field("persona_aviso.tipo_alerta", "Tipo de alerta", "C7", "catalogo", "Alertas", true, {
        sectionKind: "alta_sat",
      }),
      ...buildRepeatedFields({
        groupId: "persona_objeto_pm",
        basePrefix: "persona_aviso.pm",
        labelPrefix: "Persona moral o fideicomiso objeto del aviso",
        sheetName,
        startRow: 33,
        count: 10,
        sectionKind: "persona_objeto",
        requiredFirstRow: true,
        optionalFirstRowKeys: ["fecha_constitucion", "rfc", "denominacion_fiduciario", "rfc_fiduciario", "identificador_fideicomiso"],
        columns: [
          ["razon_social", "Denominación o razón social", "B", "texto"],
          ["fecha_constitucion", "Fecha de constitución", "C", "fecha"],
          ["rfc", "RFC", "D", "texto"],
          ["pais_nacionalidad", "País de nacionalidad", "E", "catalogo", "Paises"],
          ["giro_mercantil", "Giro mercantil", "F", "catalogo", "Giros"],
          ["denominacion_fiduciario", "Denominación fiduciario", "G", "texto"],
          ["rfc_fiduciario", "RFC fiduciario", "H", "texto"],
          ["identificador_fideicomiso", "Identificador del fideicomiso", "I", "texto"],
        ],
        field,
      }),
      ...buildRepeatedFields({
        groupId: "persona_objeto_representante",
        basePrefix: "persona_aviso.representante",
        labelPrefix: "Representante o apoderado",
        sheetName,
        startRow: 46,
        count: 10,
        sectionKind: "persona_objeto",
        requiredFirstRow: true,
        optionalFirstRowKeys: ["fecha_nacimiento", "rfc", "curp"],
        columns: [
          ["nombre", "Nombre(s)", "B", "texto"],
          ["apellido_paterno", "Apellido paterno", "C", "texto"],
          ["apellido_materno", "Apellido materno", "D", "texto"],
          ["fecha_nacimiento", "Fecha de nacimiento", "E", "fecha"],
          ["rfc", "RFC", "F", "texto"],
          ["curp", "CURP", "G", "texto"],
        ],
        field,
      }),
      ...buildRepeatedFields({
        groupId: "persona_objeto_domicilio_nacional",
        basePrefix: "persona_aviso.domicilio_nacional",
        labelPrefix: "Domicilio nacional",
        sheetName,
        startRow: 60,
        count: 10,
        sectionKind: "persona_objeto",
        requiredFirstRow: true,
        optionalFirstRowKeys: ["estado", "municipio", "numero_interior"],
        columns: [
          ["codigo_postal", "Código postal", "B", "texto"],
          ["estado", "Estado", "C", "texto"],
          ["municipio", "Municipio o delegación", "D", "texto"],
          ["colonia", "Colonia", "E", "texto"],
          ["calle", "Calle, avenida o vía", "F", "texto"],
          ["numero_exterior", "Número exterior", "G", "texto"],
          ["numero_interior", "Número interior", "H", "texto"],
        ],
        field,
      }),
      ...buildRepeatedFields({
        groupId: "persona_objeto_contacto",
        basePrefix: "persona_aviso.contacto",
        labelPrefix: "Contacto",
        sheetName,
        startRow: 86,
        count: 6,
        sectionKind: "persona_objeto",
        requiredFirstRow: true,
        optionalFirstRowKeys: ["correo"],
        columns: [
          ["pais_telefono", "País del teléfono", "B", "catalogo", "Paises"],
          ["telefono", "Número de teléfono", "C", "texto"],
          ["correo", "Correo electrónico", "D", "texto"],
        ],
        field,
      }),
    ]
  }

  if (sheetName === "Beneficiario controlador") {
    return [
      ...buildRepeatedFields({
        groupId: "beneficiario_controlador_pf",
        basePrefix: "beneficiario.pf",
        labelPrefix: "Beneficiario controlador persona física",
        sheetName,
        startRow: 5,
        count: 10,
        sectionKind: "beneficiario_controlador",
        requiredFirstRow: false,
        columns: [
          ["nombre", "Nombre(s)", "B", "texto"],
          ["apellido_paterno", "Apellido paterno", "C", "texto"],
          ["apellido_materno", "Apellido materno", "D", "texto"],
          ["fecha_nacimiento", "Fecha de nacimiento", "E", "fecha"],
          ["rfc", "RFC", "F", "texto"],
          ["curp", "CURP", "G", "texto"],
          ["pais_nacionalidad", "País de nacionalidad", "H", "catalogo", "Paises"],
        ],
        field,
      }),
    ]
  }

  if (sheetName !== "Acto u operación") return []

  return [
    field("acto.fecha_operacion", "Fecha de operación", "C4", "fecha", undefined, true, {
      sectionKind: "acto_operacion",
    }),
    field("acto.tipo_operacion", "Tipo de operación", "C5", "catalogo", "TipoOperacion", true, {
      sectionKind: "acto_operacion",
    }),
    ...buildRepeatedFields({
      groupId: "inmuebles",
      basePrefix: "inmueble",
      labelPrefix: "Inmueble arrendado",
      sheetName,
      startRow: 12,
      count: 10,
      sectionKind: "acto_operacion",
      requiredFirstRow: true,
      optionalFirstRowKeys: ["estado", "municipio", "numero_interior"],
      columns: [
        ["tipo_bien", "Tipo de inmueble", "B", "catalogo", "TipoInmueble"],
        ["valor_referencia", "Valor de referencia", "C", "moneda"],
        ["codigo_postal", "Código postal", "D", "texto"],
        ["estado", "Estado", "E", "texto"],
        ["municipio", "Municipio o delegación", "F", "texto"],
        ["colonia", "Colonia", "G", "texto"],
        ["calle", "Calle, avenida o vía", "H", "texto"],
        ["numero_exterior", "Número exterior", "I", "texto"],
        ["numero_interior", "Número interior", "J", "texto"],
        ["folio_real", "Folio real o antecedentes registrales", "K", "texto"],
        ["fecha_inicio", "Fecha de inicio", "L", "fecha"],
        ["fecha_termino", "Fecha de término", "M", "fecha"],
      ],
      field,
    }),
    ...buildRepeatedFields({
      groupId: "pagos",
      basePrefix: "pago",
      labelPrefix: "Liquidación",
      sheetName,
      startRow: 27,
      count: 25,
      sectionKind: "liquidacion",
      requiredFirstRow: true,
      columns: [
        ["fecha", "Fecha de pago", "B", "fecha"],
        ["forma_pago", "Forma de pago", "C", "catalogo", "FormasPago"],
        ["instrumento_monetario", "Instrumento monetario", "D", "catalogo", "InstrumentoMonetario"],
        ["moneda", "Moneda o divisa", "E", "catalogo", "Monedas"],
        ["monto", "Monto de operación", "F", "moneda"],
      ],
      field,
    }),
  ]
}

function buildRepeatedFields(input: {
  groupId: string
  basePrefix: string
  labelPrefix: string
  sheetName: string
  startRow: number
  count: number
  sectionKind?: SatXlsmField["sectionKind"]
  requiredFirstRow: boolean
  optionalFirstRowKeys?: string[]
  columns: Array<[key: string, label: string, column: string, dataType: SatXlsmField["dataType"], optionListId?: string]>
  field: (
    id: string,
    label: string,
    cell: string,
    dataType: SatXlsmField["dataType"],
    optionListId?: string,
    required?: boolean,
    extras?: Partial<SatXlsmField>,
  ) => SatXlsmField
}): SatXlsmField[] {
  const fields: SatXlsmField[] = []
  for (let index = 0; index < input.count; index += 1) {
    const repeatIndex = index + 1
    const row = input.startRow + index
    for (const [key, label, column, dataType, optionListId] of input.columns) {
      const id = repeatIndex === 1 ? `${input.basePrefix}.${key}` : `${input.basePrefix}.${repeatIndex}.${key}`
      const required =
        input.requiredFirstRow && repeatIndex === 1 && !(input.optionalFirstRowKeys || []).includes(key)
      fields.push(
        input.field(id, label, `${column}${row}`, dataType, optionListId, required, {
          repeatGroup: input.groupId,
          repeatIndex,
          repeatLimit: input.count,
          sectionKind: input.sectionKind,
        }),
      )
    }
  }
  return fields
}

function mergeFields(fields: SatXlsmField[]): SatXlsmField[] {
  const byCell = new Map<string, SatXlsmField>()
  for (const field of fields) {
    const key = `${field.sheetName}!${field.cell}`
    const existing = byCell.get(key)
    if (!existing || fieldPriority(field) > fieldPriority(existing)) byCell.set(key, field)
  }
  return [...byCell.values()]
}

function fieldPriority(field: SatXlsmField) {
  if (field.source === "manual-sat-map") return 3
  if (field.source === "xlsm-data-validation") return 2
  return 1
}

function resolveWorkbookCellValues(
  values: Record<string, string | number | boolean | null | undefined>,
  layout?: SatXlsmLayout,
): Map<string, Map<string, ResolvedWorkbookCellValue>> {
  const result = new Map<string, Map<string, ResolvedWorkbookCellValue>>()
  const fieldMap = new Map<string, SatXlsmField>()
  const cellMap = new Map<string, SatXlsmField>()
  layout?.sections
    .flatMap((section) => section.fields)
    .forEach((field) => {
      fieldMap.set(field.id, field)
      cellMap.set(`${field.sheetName}!${field.cell.toUpperCase()}`, field)
    })

  for (const [key, rawValue] of Object.entries(values)) {
    if (rawValue === undefined || rawValue === null || rawValue === "") continue
    let sheetName = ""
    let cell = ""
    let field: SatXlsmField | undefined
    if (key.includes("!")) {
      ;[sheetName, cell] = key.split("!")
      field = cellMap.get(`${sheetName}!${cell.toUpperCase()}`)
    } else {
      field = fieldMap.get(key)
      if (!field) continue
      sheetName = field.sheetName
      cell = field.cell
    }
    if (!sheetName || !cell) continue
    if (!result.has(sheetName)) result.set(sheetName, new Map())
    const value = normalizeWorkbookValue(key, rawValue, field)
    result.get(sheetName)?.set(cell.toUpperCase(), {
      value,
      dataType: workbookDataTypeForField(field),
      writeDateAsText: shouldWriteDateAsText(field),
    })
  }
  return result
}

function normalizeWorkbookValue(key: string, value: unknown, field?: SatXlsmField): string {
  const normalized = normalizeSatDownloadValue(value)
  if (isSatPeriodField(field) || isSatPeriodKey(key)) return normalizeSatPeriod(normalized) || normalized
  if (isPostalCodeField(field) || isPostalCodeKey(key)) return normalizePostalCode(normalized) || normalized
  return normalized
}

function workbookDataTypeForField(field?: SatXlsmField): SatXlsmField["dataType"] | undefined {
  if (isPostalCodeField(field)) return "numero"
  return field?.dataType
}

function shouldWriteDateAsText(field?: SatXlsmField): boolean {
  return field?.dataType === "fecha"
}

function setCellValue(
  xml: string,
  cellRef: string,
  cellValue: ResolvedWorkbookCellValue,
  styleKinds: Map<string, WorkbookStyleKind>,
): string {
  if (
    cellValue.dataType === "fecha" &&
    cellValue.writeDateAsText &&
    getStyleKindForCell(xml, cellRef, styleKinds) === "text"
  ) {
    const dateText = formatDateForWorkbookText(cellValue.value)
    return setCellInlineString(xml, cellRef, dateText || cellValue.value)
  }
  const numericValue = normalizeTypedNumber(cellValue)
  if (numericValue !== null) return setCellNumber(xml, cellRef, numericValue)
  return setCellInlineString(xml, cellRef, cellValue.value)
}

function normalizeTypedNumber(cellValue: ResolvedWorkbookCellValue): string | null {
  if (cellValue.dataType === "fecha") {
    const serial = excelSerialFromDate(cellValue.value)
    return serial === null ? null : String(serial)
  }
  if (cellValue.dataType === "moneda" || cellValue.dataType === "numero") {
    const numeric = Number(cellValue.value.replace(/,/g, ""))
    return Number.isFinite(numeric) ? String(numeric) : null
  }
  return null
}

function formatDateForWorkbookText(value: string): string {
  const normalized = satDate(value)
  if (!/^\d{8}$/.test(normalized)) return value
  return `${normalized.slice(6, 8)}/${normalized.slice(4, 6)}/${normalized.slice(0, 4)}`
}

function isSatPeriodField(field?: SatXlsmField): boolean {
  if (!field) return false
  return isSatPeriodKey(field.id) || slug(field.label).includes("periodo-reportado")
}

function isSatPeriodKey(key: string): boolean {
  const normalized = slug(key)
  return normalized.endsWith("periodo") || normalized.includes("periodo-reportado")
}

function isPostalCodeField(field?: SatXlsmField): boolean {
  if (!field) return false
  return isPostalCodeKey(field.id) || slug(field.label).includes("codigo-postal")
}

function isPostalCodeKey(key: string): boolean {
  const normalized = slug(key)
  return normalized.includes("codigo-postal")
}

function getStyleKindForCell(
  xml: string,
  cellRef: string,
  styleKinds: Map<string, WorkbookStyleKind>,
): WorkbookStyleKind | undefined {
  const cellRegex = new RegExp(`<c\\b([^>]*\\br="${cellRef}"[^>]*)`)
  const attrs = xml.match(cellRegex)?.[1] || ""
  const style = getAttr(attrs, "s")
  return style ? styleKinds.get(style) : undefined
}

function setCellNumber(xml: string, cellRef: string, value: string): string {
  const rowNumber = Number(cellRef.match(/\d+/)?.[0])
  const cellRegex = cellReplacementRegex(cellRef)
  const existing = xml.match(cellRegex)
  if (existing) {
    const attrs = existing[1] || existing[2] || ""
    const style = getAttr(attrs, "s")
    const styleAttr = style ? ` s="${style}"` : ""
    return xml.replace(cellRegex, `<c r="${cellRef}"${styleAttr}><v>${escapeXml(value)}</v></c>`)
  }

  const cellXml = `<c r="${cellRef}"><v>${escapeXml(value)}</v></c>`
  const rowRegex = new RegExp(`(<row\\b[^>]*\\br="${rowNumber}"[^>]*>)([\\s\\S]*?)(<\\/row>)`)
  if (rowRegex.test(xml)) {
    return xml.replace(rowRegex, (_match, start, body, end) => {
      const inserted = insertCellSorted(body, cellRef, cellXml)
      return `${start}${inserted}${end}`
    })
  }

  return xml.replace("</sheetData>", `<row r="${rowNumber}">${cellXml}</row></sheetData>`)
}

function setCellInlineString(xml: string, cellRef: string, value: string): string {
  const rowNumber = Number(cellRef.match(/\d+/)?.[0])
  const escaped = escapeXml(value)
  const cellRegex = cellReplacementRegex(cellRef)
  const existing = xml.match(cellRegex)
  if (existing) {
    const attrs = existing[1] || existing[2] || ""
    const style = getAttr(attrs, "s")
    const styleAttr = style ? ` s="${style}"` : ""
    return xml.replace(cellRegex, `<c r="${cellRef}"${styleAttr} t="inlineStr"><is><t>${escaped}</t></is></c>`)
  }

  const cellXml = `<c r="${cellRef}" t="inlineStr"><is><t>${escaped}</t></is></c>`
  const rowRegex = new RegExp(`(<row\\b[^>]*\\br="${rowNumber}"[^>]*>)([\\s\\S]*?)(<\\/row>)`)
  if (rowRegex.test(xml)) {
    return xml.replace(rowRegex, (_match, start, body, end) => {
      const inserted = insertCellSorted(body, cellRef, cellXml)
      return `${start}${inserted}${end}`
    })
  }

  return xml.replace("</sheetData>", `<row r="${rowNumber}">${cellXml}</row></sheetData>`)
}

function cellReplacementRegex(cellRef: string): RegExp {
  return new RegExp(`<c\\b([^>]*\\br="${cellRef}"[^>]*)\\/>|<c\\b([^>]*\\br="${cellRef}"[^>]*)>([\\s\\S]*?)<\\/c>`)
}

function extractPostalCatalog(zip: Record<string, Uint8Array>, workbook: ParsedWorkbook): Map<string, PostalCatalogEntry> {
  const combosSheet = workbook.sheets.find((sheet) => sheet.name === SHEET_COMBOS)
  if (!combosSheet?.path) return new Map()
  const xml = readZipText(zip, combosSheet.path, true)
  if (!xml) return new Map()

  const result = new Map<string, PostalCatalogEntry>()
  const rowRegex = /<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g
  let rowMatch: RegExpExecArray | null
  while ((rowMatch = rowRegex.exec(xml))) {
    const row = rowMatch[1]
    const body = rowMatch[2]
    const cp = normalizePostalCode(readCellByRef(body, `N${row}`, workbook.sharedStrings))
    if (!cp) continue
    const estado = readCellByRef(body, `O${row}`, workbook.sharedStrings)
    const municipio = readCellByRef(body, `P${row}`, workbook.sharedStrings)
    if (!estado && !municipio) continue
    result.set(cp, { estado, municipio })
  }
  return result
}

function readCellByRef(rowXml: string, cellRef: string, sharedStrings: string[]): string {
  const cellRegex = new RegExp(`<c\\b([^>]*\\br="${cellRef}"[^>]*)(?:\\/>|>([\\s\\S]*?)<\\/c>)`)
  const match = rowXml.match(cellRegex)
  if (!match) return ""
  return readCellValue(match[1] || "", match[2] || "", sharedStrings)
}

function refreshPostalFormulaCaches(
  xml: string,
  sharedStrings: string[],
  getPostalCatalog: () => Map<string, PostalCatalogEntry>,
): string {
  if (!xml.includes("VLOOKUP") || !xml.includes("Combos!$N$1:$P$")) return xml
  const sheetCells = parseSheetCells(xml, sharedStrings)
  let postalCatalog: Map<string, PostalCatalogEntry> | undefined

  return xml.replace(/<c\b([^>]*\br="([A-Z]+\d+)"[^>]*)>([\s\S]*?)<\/c>/g, (match, attrs, _cellRef, body) => {
    const formula = decodeXml((body.match(/<f\b[^>]*>([\s\S]*?)<\/f>/) || [])[1] || "")
    const lookup = formula.match(/VLOOKUP\(([A-Z]+\d+),Combos!\$N\$1:\$P\$\d+,([23]),0\)/)
    if (!lookup) return match

    const cp = normalizePostalCode(sheetCells[lookup[1]])
    if (!cp) return match
    postalCatalog = postalCatalog || getPostalCatalog()
    const catalogEntry = postalCatalog.get(cp)
    if (!catalogEntry) return match

    const value = lookup[2] === "2" ? catalogEntry.estado : catalogEntry.municipio
    if (!value) return match

    const nextAttrs = attrs.includes(' t="')
      ? attrs.replace(/\s+t="[^"]*"/, ' t="str"')
      : `${attrs} t="str"`
    const escapedValue = escapeXml(value)
    const nextBody = body.includes("<v>")
      ? body.replace(/<v>[\s\S]*?<\/v>/, `<v>${escapedValue}</v>`)
      : body.replace(/(<\/f>)/, `$1<v>${escapedValue}</v>`)

    return `<c${nextAttrs}>${nextBody}</c>`
  })
}

function insertCellSorted(body: string, cellRef: string, cellXml: string): string {
  const targetColumn = columnToNumber(cellRef.match(/[A-Z]+/)?.[0] || "A")
  const cellRegex = /<c\b[^>]*\br="([A-Z]+\d+)"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g
  let match: RegExpExecArray | null
  while ((match = cellRegex.exec(body))) {
    const currentColumn = columnToNumber(match[1].match(/[A-Z]+/)?.[0] || "A")
    if (currentColumn > targetColumn) {
      return `${body.slice(0, match.index)}${cellXml}${body.slice(match.index)}`
    }
  }
  return `${body}${cellXml}`
}

function prefillValueForField(field: SatXlsmField, prefill: Record<string, unknown>): string {
  const beneficiaryBranch = beneficiaryFieldBranch(field)
  if (beneficiaryBranch) {
    if (beneficiaryRepeatIndex(field) > 1) return ""

    const selectedBranch = beneficiaryPrefillBranch(prefill)
    if (!selectedBranch || selectedBranch !== beneficiaryBranch) return ""

    const fiduciaryValue = fiduciaryBeneficiaryPrefill(field, prefill)
    if (fiduciaryValue !== undefined) return stringPrefill(fiduciaryValue)
  }

  const clienteNombrePartes = splitPersonName(stringPrefill(prefill.clienteNombre))
  const beneficiaryPrefill = beneficiaryBranchPrefill(prefill)
  const lookup: Record<string, unknown> = {
    "persona_aviso.sujeto_obligado_rfc": prefill.sujetoObligadoRfc || prefill.tenantRfc,
    "persona_aviso.periodo": prefill.periodo,
    "persona_aviso.referencia": prefill.referenciaAviso,
    "persona_aviso.prioridad": prefill.prioridadAviso || "1,NORMAL",
    "persona_aviso.tipo_alerta": prefill.alertaCodigo || "100,Sin alerta.",
    "persona_aviso.descripcion_alerta": prefill.alertaDescripcion,
    "persona_aviso.ocupacion": prefill.clienteOcupacion,
    "persona_aviso.pf.nombre": prefill.clienteNombreSat || prefill.clienteNombrePf || clienteNombrePartes.nombre,
    "persona_aviso.pf.apellido_paterno": prefill.clienteApellidoPaterno || clienteNombrePartes.apellidoPaterno,
    "persona_aviso.pf.apellido_materno": prefill.clienteApellidoMaterno || clienteNombrePartes.apellidoMaterno,
    "persona_aviso.pf.fecha_nacimiento": prefill.clienteFechaNacimiento,
    "persona_aviso.pf.rfc": prefill.clienteRfc,
    "persona_aviso.pf.curp": prefill.clienteCurp,
    "persona_aviso.pf.pais_nacionalidad": prefill.clientePais || "MEXICO,MX",
    "persona_aviso.pf.actividad_economica": prefill.clienteActividadEconomica,
    "persona_aviso.pm.razon_social": prefill.clienteRazonSocial || prefill.clienteNombre,
    "persona_aviso.pm.fecha_constitucion": prefill.clienteFechaConstitucion,
    "persona_aviso.pm.rfc": prefill.clienteRfc,
    "persona_aviso.pm.pais_nacionalidad": prefill.clientePais || "MEXICO,MX",
    "persona_aviso.pm.giro_mercantil": prefill.clienteGiro,
    "persona_aviso.representante.nombre": prefill.representanteNombre,
    "persona_aviso.representante.apellido_paterno": prefill.representanteApellidoPaterno,
    "persona_aviso.representante.apellido_materno": prefill.representanteApellidoMaterno,
    "persona_aviso.representante.fecha_nacimiento": prefill.representanteFechaNacimiento,
    "persona_aviso.representante.rfc": prefill.representanteRfc,
    "persona_aviso.representante.curp": prefill.representanteCurp,
    "persona_aviso.domicilio_nacional.estado": prefill.clienteEstado || prefill.entidadCliente,
    "persona_aviso.domicilio_nacional.municipio": prefill.clienteMunicipio,
    "persona_aviso.domicilio_nacional.ciudad": prefill.clienteCiudad,
    "persona_aviso.domicilio_nacional.colonia": prefill.clienteColonia,
    "persona_aviso.domicilio_nacional.calle": prefill.clienteCalle,
    "persona_aviso.domicilio_nacional.numero_exterior": prefill.clienteNumeroExterior,
    "persona_aviso.domicilio_nacional.numero_interior": prefill.clienteNumeroInterior,
    "persona_aviso.domicilio_nacional.codigo_postal": prefill.clienteCodigoPostal || prefill.codigoPostal,
    "persona_aviso.contacto.pais_telefono": prefill.clientePaisTelefono || "MEXICO,MX",
    "persona_aviso.contacto.telefono": prefill.clienteTelefono,
    "persona_aviso.contacto.correo": prefill.clienteCorreo,
    "beneficiario.pf.nombre": beneficiaryPrefill.pf.nombre,
    "beneficiario.pf.apellido_paterno": beneficiaryPrefill.pf.apellidoPaterno,
    "beneficiario.pf.apellido_materno": beneficiaryPrefill.pf.apellidoMaterno,
    "beneficiario.pf.fecha_nacimiento": beneficiaryPrefill.pf.fechaNacimiento,
    "beneficiario.pf.rfc": beneficiaryPrefill.pf.rfc,
    "beneficiario.pf.curp": beneficiaryPrefill.pf.curp,
    "beneficiario.pf.pais_nacionalidad": beneficiaryPrefill.pf.pais,
    "beneficiario.pm.razon_social": beneficiaryPrefill.pm.razonSocial,
    "beneficiario.pm.fecha_constitucion": beneficiaryPrefill.pm.fechaConstitucion,
    "beneficiario.pm.rfc": beneficiaryPrefill.pm.rfc,
    "beneficiario.pm.pais_nacionalidad": beneficiaryPrefill.pm.pais,
    "beneficiario.pm.denominacion_fiduciario": prefill.beneficiarioFiduciarioDenominacion,
    "beneficiario.pm.rfc_fiduciario": prefill.beneficiarioFiduciarioRfc,
    "beneficiario.pm.identificador_fideicomiso": prefill.beneficiarioFideicomisoIdentificador,
    "contraparte.pf.nombre": prefill.contraparteNombre,
    "contraparte.pf.apellido_paterno": prefill.contraparteApellidoPaterno,
    "contraparte.pf.apellido_materno": prefill.contraparteApellidoMaterno,
    "contraparte.pf.fecha_nacimiento": prefill.contraparteFechaNacimiento,
    "contraparte.pf.rfc": prefill.contraparteRfc,
    "contraparte.pf.curp": prefill.contraparteCurp,
    "contraparte.pf.pais_nacionalidad": prefill.contrapartePais || "MEXICO,MX",
    "contraparte.pm.razon_social": prefill.contraparteRazonSocial || prefill.contraparteNombre,
    "contraparte.pm.fecha_constitucion": prefill.contraparteFechaConstitucion,
    "contraparte.pm.rfc": prefill.contraparteRfc,
    "contraparte.pm.pais_nacionalidad": prefill.contrapartePais || "MEXICO,MX",
    "acto.fecha_operacion": prefill.fechaOperacion,
    "acto.tipo_operacion": prefill.tipoOperacion,
    "acto.figura_cliente": prefill.figuraCliente,
    "acto.figura_sujeto_obligado": prefill.figuraSujetoObligado,
    "inmueble.valor_pactado": prefill.montoMxn,
    "pago.monto": prefill.montoMxn,
    "pago.fecha": prefill.fechaOperacion,
    "pago.forma_pago": prefill.formaPago,
    "pago.instrumento_monetario": prefill.instrumentoMonetario || prefill.instrumento,
    "pago.moneda": prefill.monedaSat || prefill.moneda || "1,Peso mexicano",
    "inmueble.codigo_postal": prefill.codigoPostal,
    "inmueble.tipo_bien": prefill.tipoInmueble,
    "inmueble.estado": prefill.estadoInmueble,
    "inmueble.municipio": prefill.municipioInmueble,
    "inmueble.calle": prefill.calleInmueble,
    "inmueble.numero_exterior": prefill.numeroExteriorInmueble,
    "inmueble.numero_interior": prefill.numeroInteriorInmueble,
    "inmueble.colonia": prefill.coloniaInmueble,
    "inmueble.terreno_m2": prefill.terrenoM2,
    "inmueble.inmueble_m2": prefill.inmuebleM2,
    "inmueble.folio_real": prefill.folioReal,
    "inmueble.valor_catastral": prefill.inmuebleValorCatastral,
    "instrumento.fecha": prefill.instrumentoFecha,
    "instrumento.numero": prefill.instrumentoNumero,
    "instrumento.notario": prefill.instrumentoNotario,
    "instrumento.entidad": prefill.instrumentoEntidad,
    "instrumento.valor_avaluo": prefill.instrumentoValorAvaluo,
    "instrumento.valor_catastral": prefill.instrumentoValorCatastral,
    "instrumento.fecha_contrato": prefill.instrumentoFechaContrato,
    "operacion_financiera.monto": prefill.montoMxn,
    "operacion_financiera.instrumento_monetario": prefill.instrumentoMonetario || prefill.instrumento,
    "operacion_financiera.moneda": prefill.monedaSat || prefill.moneda,
    "persona.rfc": prefill.clienteRfc,
    "persona.nombre": prefill.clienteNombre,
  }
  const raw = lookup[field.id] ?? inferPrefillValueForExtractedField(field, prefill)
  if (raw === undefined || raw === null || raw === "") return ""
  return String(raw)
}

type BeneficiaryPrefillBranch = "persona_fisica" | "persona_moral"

function beneficiaryFieldBranch(field: SatXlsmField): BeneficiaryPrefillBranch | undefined {
  const id = slug(field.id)
  const repeatGroup = slug(field.repeatGroup || "")
  if (id.startsWith("beneficiario-pf-") || (repeatGroup.startsWith("beneficiario-") && repeatGroup.endsWith("-pf"))) {
    return "persona_fisica"
  }
  if (id.startsWith("beneficiario-pm-") || (repeatGroup.startsWith("beneficiario-") && repeatGroup.endsWith("-pm"))) {
    return "persona_moral"
  }

  if (!slug(field.sheetName).includes("beneficiario")) return undefined
  const { row } = splitCell(field.cell)
  if (row > 0 && row <= 16) return "persona_fisica"
  if (row >= 17) return "persona_moral"
  return undefined
}

function beneficiaryRepeatIndex(field: SatXlsmField): number {
  if (field.repeatIndex && field.repeatIndex > 0) return field.repeatIndex
  const match = field.id.match(/^beneficiario\.(?:pf|pm)\.(\d+)\./)
  return match ? Number(match[1]) : 1
}

function beneficiaryPrefillBranch(prefill: Record<string, unknown>): BeneficiaryPrefillBranch | undefined {
  const explicit = slug(
    stringPrefill(prefill[BENEFICIARY_PERSON_TYPE_FIELD_ID] || prefill.beneficiarioTipoPersonaSat),
  )
  if (["persona-fisica", "fisica", "pf"].includes(explicit)) return "persona_fisica"
  if (["persona-moral", "moral", "pm", "fideicomiso"].includes(explicit)) return "persona_moral"

  if (
    stringPrefill(prefill.beneficiarioPmRazonSocial || prefill.beneficiarioRazonSocial) ||
    stringPrefill(prefill.beneficiarioPmFechaConstitucion || prefill.beneficiarioFechaConstitucion)
  ) {
    return "persona_moral"
  }
  if (
    stringPrefill(prefill.beneficiarioPfNombre || prefill.beneficiarioNombre) ||
    stringPrefill(prefill.beneficiarioPfApellidoPaterno || prefill.beneficiarioApellidoPaterno) ||
    stringPrefill(prefill.beneficiarioPfApellidoMaterno || prefill.beneficiarioApellidoMaterno) ||
    stringPrefill(prefill.beneficiarioPfFechaNacimiento || prefill.beneficiarioFechaNacimiento) ||
    stringPrefill(prefill.beneficiarioPfCurp || prefill.beneficiarioCurp)
  ) {
    return "persona_fisica"
  }
  return undefined
}

function beneficiaryBranchPrefill(prefill: Record<string, unknown>) {
  const branch = beneficiaryPrefillBranch(prefill)
  return {
    pf: {
      nombre: prefill.beneficiarioPfNombre || prefill.beneficiarioNombre,
      apellidoPaterno: prefill.beneficiarioPfApellidoPaterno || prefill.beneficiarioApellidoPaterno,
      apellidoMaterno: prefill.beneficiarioPfApellidoMaterno || prefill.beneficiarioApellidoMaterno,
      fechaNacimiento: prefill.beneficiarioPfFechaNacimiento || prefill.beneficiarioFechaNacimiento,
      rfc: prefill.beneficiarioPfRfc || (branch === "persona_fisica" ? prefill.beneficiarioRfc : undefined),
      curp: prefill.beneficiarioPfCurp || prefill.beneficiarioCurp,
      pais: prefill.beneficiarioPfPais || (branch === "persona_fisica" ? prefill.beneficiarioPais || "MEXICO,MX" : undefined),
    },
    pm: {
      razonSocial: prefill.beneficiarioPmRazonSocial || prefill.beneficiarioRazonSocial,
      fechaConstitucion: prefill.beneficiarioPmFechaConstitucion || prefill.beneficiarioFechaConstitucion,
      rfc: prefill.beneficiarioPmRfc || (branch === "persona_moral" ? prefill.beneficiarioRfc : undefined),
      pais: prefill.beneficiarioPmPais || (branch === "persona_moral" ? prefill.beneficiarioPais || "MEXICO,MX" : undefined),
    },
  }
}

function fiduciaryBeneficiaryPrefill(field: SatXlsmField, prefill: Record<string, unknown>): unknown {
  const id = slug(field.id)
  const label = slug(field.label)
  if (id.includes("denominacion-fiduciario") || label.includes("denominacion-fiduciario")) {
    return prefill.beneficiarioFiduciarioDenominacion || ""
  }
  if (id.includes("rfc-fiduciario") || label.includes("rfc-fiduciario")) {
    return prefill.beneficiarioFiduciarioRfc || ""
  }
  if (id.includes("identificador-fideicomiso") || label.includes("identificador-fideicomiso")) {
    return prefill.beneficiarioFideicomisoIdentificador || ""
  }
  return undefined
}

function isFiduciaryBeneficiaryField(field: SatXlsmField): boolean {
  const semantic = slug(`${field.id} ${field.label}`)
  return semantic.includes("fiduciari") || semantic.includes("fideicomiso")
}

function hasExplicitFiduciaryBeneficiaryPrefill(prefill: Record<string, unknown>): boolean {
  return Boolean(
    stringPrefill(prefill.beneficiarioFiduciarioDenominacion) ||
      stringPrefill(prefill.beneficiarioFiduciarioRfc) ||
      stringPrefill(prefill.beneficiarioFideicomisoIdentificador),
  )
}

function inferPrefillValueForExtractedField(field: SatXlsmField, prefill: Record<string, unknown>): unknown {
  if (field.source === "manual-sat-map") return undefined

  const sheet = slug(field.sheetName)
  const label = slug(field.label)
  const { col, row } = splitCell(field.cell)

  if (sheet.includes("persona-objeto")) {
    const headerValue = inferHeaderPrefill(field, prefill)
    if (headerValue !== undefined) return headerValue
    if (row >= 18 && row <= 32) return inferPersonFieldPrefill(label, col, prefill, "cliente_pf")
    if (row >= 33 && row <= 45) return inferPersonFieldPrefill(label, col, prefill, "cliente_pm")
    if (row >= 46 && row <= 58) return inferPersonFieldPrefill(label, col, prefill, "representante")
    if (row >= 59 && row <= 85) return inferDomicilioFieldPrefill(label, col, prefill)
    if (row >= 86) return inferContactoFieldPrefill(label, col, prefill)
    return inferPersonFieldPrefill(label, col, prefill, "cliente")
  }

  if (sheet.includes("beneficiario")) {
    if (row <= 16) return inferPersonFieldPrefill(label, col, prefill, "beneficiario_pf")
    return inferPersonFieldPrefill(label, col, prefill, "beneficiario_pm")
  }

  if (sheet.includes("acto") || sheet.includes("aviso")) {
    const headerValue = inferHeaderPrefill(field, prefill)
    if (headerValue !== undefined) return headerValue
    if (label.includes("fecha") && !label.includes("nacimiento") && !label.includes("constitucion")) {
      return prefill.fechaOperacion
    }
    const isSurface = /superficie|terreno|construccion|metros-cuadrados|m2/.test(label)
    if (label.includes("valor-catastral")) {
      return prefill.instrumentoValorCatastral || prefill.inmuebleValorCatastral
    }
    const isAuthoritativeMoney = /monto|importe|contraprestacion|precio-pactado|valor-pactado/.test(label)
    if (isAuthoritativeMoney && !isSurface) return prefill.montoMxn
    if (label.includes("moneda") || label.includes("divisa")) return prefill.monedaSat || prefill.moneda
    if (label.includes("instrumento-monetario")) return prefill.instrumentoMonetario || prefill.instrumento
    if (label.includes("codigo-postal")) return prefill.codigoPostal || prefill.clienteCodigoPostal
    if (label.includes("colonia")) return prefill.coloniaInmueble || prefill.clienteColonia
    if (label.includes("calle")) return prefill.calleInmueble || prefill.clienteCalle
    if (label.includes("numero-exterior")) return prefill.numeroExteriorInmueble || prefill.clienteNumeroExterior
    if (label.includes("numero-interior")) return prefill.numeroInteriorInmueble || prefill.clienteNumeroInterior
    if (label.includes("folio-real")) return prefill.folioReal
  }

  if (sheet.includes("recpropios") || sheet.includes("prestamo") || sheet.includes("finbursatil")) {
    if (label.includes("moneda") || label.includes("divisa")) return prefill.monedaSat || prefill.moneda
    if (label.includes("monto")) return prefill.montoMxn
    if (label.includes("instrumento")) return prefill.instrumentoMonetario || prefill.instrumento
  }

  if (sheet.includes("socio") || sheet.includes("tercero")) {
    return inferPersonFieldPrefill(label, col, prefill, "contraparte")
  }

  return undefined
}

function inferHeaderPrefill(field: SatXlsmField, prefill: Record<string, unknown>): unknown {
  const cell = field.cell.toUpperCase()
  const sheet = slug(field.sheetName)

  if (sheet.includes("persona-objeto")) {
    if (cell === "C4") return prefill.sujetoObligadoRfc || prefill.tenantRfc
    if (cell === "C5") return prefill.periodo
    if (cell === "C6") return prefill.referenciaAviso
    if (cell === "E6") return prefill.prioridadAviso || "1,NORMAL"
    if (cell === "C7") return prefill.alertaCodigo || "100,Sin alerta."
    if (cell === "E7") return prefill.alertaDescripcion
  }

  if (sheet.includes("aviso")) {
    if (cell === "C5") return prefill.sujetoObligadoRfc || prefill.tenantRfc
    if (cell === "C6") return prefill.periodo
    if (cell === "C7") return prefill.referenciaAviso
    if (cell === "E7") return prefill.prioridadAviso || "1,NORMAL"
    if (cell === "C8") return prefill.alertaCodigo || "100,Sin alerta."
    if (cell === "E8") return prefill.alertaDescripcion
  }

  return undefined
}

function inferPersonFieldPrefill(
  label: string,
  _col: string,
  prefill: Record<string, unknown>,
  scope: "cliente" | "cliente_pf" | "cliente_pm" | "representante" | "beneficiario_pf" | "beneficiario_pm" | "contraparte",
): unknown {
  const beneficiary = beneficiaryBranchPrefill(prefill)
  if (label.includes("razon-social") || label.includes("denominacion")) {
    if (scope === "beneficiario_pm") return beneficiary.pm.razonSocial
    if (scope === "contraparte") return prefill.contraparteRazonSocial || prefill.contraparteNombre
    return prefill.clienteRazonSocial || prefill.clienteNombre
  }
  if (label.includes("nombre")) {
    if (scope === "beneficiario_pf") return beneficiary.pf.nombre
    if (scope === "representante") return prefill.representanteNombre
    if (scope === "contraparte") return prefill.contraparteNombre
    return prefill.clienteNombrePf || prefill.clienteNombreSat || splitPersonName(stringPrefill(prefill.clienteNombre)).nombre
  }
  if (label.includes("apellido-paterno")) {
    if (scope === "beneficiario_pf") return beneficiary.pf.apellidoPaterno
    if (scope === "representante") return prefill.representanteApellidoPaterno
    if (scope === "contraparte") return prefill.contraparteApellidoPaterno
    return prefill.clienteApellidoPaterno || splitPersonName(stringPrefill(prefill.clienteNombre)).apellidoPaterno
  }
  if (label.includes("apellido-materno")) {
    if (scope === "beneficiario_pf") return beneficiary.pf.apellidoMaterno
    if (scope === "representante") return prefill.representanteApellidoMaterno
    if (scope === "contraparte") return prefill.contraparteApellidoMaterno
    return prefill.clienteApellidoMaterno || splitPersonName(stringPrefill(prefill.clienteNombre)).apellidoMaterno
  }
  if (label.includes("fecha-nacimiento")) {
    if (scope === "beneficiario_pf") return beneficiary.pf.fechaNacimiento
    if (scope === "representante") return prefill.representanteFechaNacimiento
    if (scope === "contraparte") return prefill.contraparteFechaNacimiento
    return prefill.clienteFechaNacimiento
  }
  if (label.includes("fecha-constitucion")) {
    if (scope === "beneficiario_pm") return beneficiary.pm.fechaConstitucion
    if (scope === "contraparte") return prefill.contraparteFechaConstitucion
    return prefill.clienteFechaConstitucion
  }
  if (label === "rfc" || label.includes("rfc")) {
    if (scope === "beneficiario_pf") return beneficiary.pf.rfc
    if (scope === "beneficiario_pm") return beneficiary.pm.rfc
    if (scope === "representante") return prefill.representanteRfc
    if (scope === "contraparte") return prefill.contraparteRfc
    return prefill.clienteRfc
  }
  if (label.includes("curp")) {
    if (scope === "beneficiario_pf") return beneficiary.pf.curp
    if (scope === "representante") return prefill.representanteCurp
    if (scope === "contraparte") return prefill.contraparteCurp
    return prefill.clienteCurp
  }
  if (label.includes("pais") || label.includes("nacionalidad")) {
    if (scope === "beneficiario_pf") return beneficiary.pf.pais
    if (scope === "beneficiario_pm") return beneficiary.pm.pais
    if (scope === "contraparte") return prefill.contrapartePais || "MEXICO,MX"
    return prefill.clientePais || "MEXICO,MX"
  }
  if (label.includes("actividad-economica")) return prefill.clienteActividadEconomica
  if (label.includes("giro-mercantil")) return prefill.clienteGiro
  return undefined
}

function inferDomicilioFieldPrefill(label: string, col: string, prefill: Record<string, unknown>): unknown {
  if (label.includes("codigo-postal")) return prefill.clienteCodigoPostal || prefill.codigoPostal
  if (label.includes("pais")) return prefill.clientePais || "MEXICO,MX"
  if (label.includes("estado") || label.includes("entidad") || col === "C") return prefill.clienteEstado
  if (label.includes("municipio")) return prefill.clienteMunicipio
  if (label.includes("ciudad") || label.includes("poblacion") || col === "D") return prefill.clienteCiudad
  if (label.includes("colonia") || col === "E") return prefill.clienteColonia
  if (label.includes("calle") || label.includes("avenida") || col === "F") return prefill.clienteCalle
  if (label.includes("numero-exterior") || col === "G") return prefill.clienteNumeroExterior
  if (label.includes("numero-interior") || col === "H") return prefill.clienteNumeroInterior
  if (col === "I" || col === "J") return prefill.clienteCodigoPostal || prefill.codigoPostal
  return undefined
}

function inferContactoFieldPrefill(label: string, col: string, prefill: Record<string, unknown>): unknown {
  if (label.includes("pais") || col === "B") return prefill.clientePaisTelefono || "MEXICO,MX"
  if (label.includes("telefono") || col === "C") return prefill.clienteTelefono
  if (label.includes("correo") || col === "D") return prefill.clienteCorreo
  return undefined
}

function stringPrefill(value: unknown): string {
  return value === undefined || value === null ? "" : String(value)
}

function splitPersonName(value: string): { nombre: string; apellidoPaterno: string; apellidoMaterno: string } {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { nombre: value.trim(), apellidoPaterno: "", apellidoMaterno: "" }
  if (parts.length === 2) return { nombre: parts[0], apellidoPaterno: parts[1], apellidoMaterno: "" }
  return {
    nombre: parts.slice(0, -2).join(" "),
    apellidoPaterno: parts[parts.length - 2] || "",
    apellidoMaterno: parts[parts.length - 1] || "",
  }
}

function findNearbyLabel(cellRef: string, cells: CellMap): string {
  const { col, row } = splitCell(cellRef)
  const colNum = columnToNumber(col)
  for (let offset = 1; offset <= 4; offset += 1) {
    const label = cells[`${numberToColumn(colNum - offset)}${row}`]
    if (isUsefulLabel(label)) return label
  }
  for (let offset = 1; offset <= 3; offset += 1) {
    const label = cells[`${col}${row - offset}`]
    if (isUsefulLabel(label)) return label
  }
  return ""
}

function isUsefulLabel(value?: string): value is string {
  if (!value) return false
  const trimmed = value.trim()
  return trimmed.length > 2 && !/^\d+(?:\.\d+)?$/.test(trimmed)
}

function expandRange(range: string): string[] {
  const [start, end = start] = range.replace(/\$/g, "").split(":")
  const a = splitCell(start.toUpperCase())
  const b = splitCell(end.toUpperCase())
  const cells: string[] = []
  for (let row = a.row; row <= b.row; row += 1) {
    for (let col = columnToNumber(a.col); col <= columnToNumber(b.col); col += 1) {
      cells.push(`${numberToColumn(col)}${row}`)
    }
  }
  return cells
}

function splitCell(cell: string): { col: string; row: number } {
  const match = cell.match(/^([A-Z]+)(\d+)$/i)
  return {
    col: (match?.[1] || "A").toUpperCase(),
    row: Number(match?.[2] || 1),
  }
}

function columnToNumber(col: string): number {
  return col
    .toUpperCase()
    .split("")
    .reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0)
}

function numberToColumn(input: number): string {
  let n = Math.max(1, input)
  let result = ""
  while (n > 0) {
    const remainder = (n - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    n = Math.floor((n - remainder) / 26)
  }
  return result
}

function matchTags(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}\\b([^>]*)\\/?>(?:<\\/${tag}>)?`, "g")
  const matches: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(xml))) matches.push(match[1] || "")
  return matches
}

function getAttr(input: string, name: string): string {
  const escapedName = name.replace(":", "\\:")
  const match = input.match(new RegExp(`(?:^|\\s)${escapedName}="([^"]*)"`))
  return match ? decodeXml(match[1]) : ""
}

function readZipText(zip: Record<string, Uint8Array>, path: string, optional = false): string {
  const file = zip[path]
  if (!file) {
    if (optional) return ""
    throw new Error(`No se encontró ${path} dentro del XLSM SAT.`)
  }
  return strFromU8(file)
}

function normalizeWorkbookTarget(target: string): string {
  return target.startsWith("xl/") ? target : `xl/${target.replace(/^\/?xl\//, "")}`
}

function buildFilledWorkbookName(name: string) {
  return name.replace(/\.xlsm$/i, "-relleno-pld.xlsm")
}

function stripRequiredMarker(label: string) {
  return label.replace(/^\*\s*/, "").replace(/\s+/g, " ").trim()
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function normalizeString(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim()
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function decodeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
}
