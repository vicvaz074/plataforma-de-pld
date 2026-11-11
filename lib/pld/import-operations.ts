import * as XLSX from "xlsx"
import { ACTIVIDADES_VULNERABLES_ARTICULO_17 } from "./actividades"
import { createStoredPldOperation, recalculateStoredPldOperationsChronologically, type StoredPldOperationV3 } from "./stored-operations"
import { resolveOperationFinance } from "./operation-finance"
import { validateExpedienteIdentifiers } from "./expediente-eui"
import { IMPORT_CLIENT_LINK_MISSING } from "./import-client-resolution"
import { SAT_TEMPLATE_CATALOG } from "./sat-template-catalog"
import { normalizeSatXlsmLayout, resolvePersonaObjetoScope, satFieldValuesToWorkbookCells } from "./sat-xlsm"
import { isSatXlsmFieldRequired, pruneInactiveSatFieldValues } from "./ui-workflow"
import { getSatOperationBranchMissingLabels } from "./sat-operation-branches"
import { BENEFICIARY_PERSON_TYPE_FIELD_ID, BENEFICIARY_REPEAT_MODE_FIELD_ID, BENEFICIARY_TRUST_MODE_FIELD_ID, PERSONA_OBJETO_DOMICILIO_FIELD_ID, PERSONA_OBJETO_TYPE_FIELD_ID } from "./sat-field-controls"
import type { SatTemplateCatalogItem, SatXlsmField, SatXlsmLayout } from "./types"
import { assertImportFileLimits, assertValidatedTabularWorkbookLimits, preflightCsvTable, IMPORT_LIMITS } from "./import-workbook-limits"

export { assertImportFileLimits, IMPORT_LIMITS } from "./import-workbook-limits"
export type ImportRowStatus = "valid" | "incomplete" | "duplicate" | "rejected"
export interface OperationImportRow {
  id: string; rowNumber: number; status: ImportRowStatus; issues: string[];
  operation: StoredPldOperationV3; source: { fileName: string; fileHash: string; sheet: string; row: number };
}
export interface OperationImportContext {
  companyId: string; companyName: string; companyRfc: string; actor: string;
  activityKey?: string; now?: string;
}
export interface ImportColumnMapping {
  name?: string; rfc?: string; nif?: string; curp?: string; personType?: string; activity?: string;
  date?: string; amount?: string; currency?: string; reference?: string; paymentInstrument?: string;
  exchangeRate?: string; exchangeRateDate?: string; exchangeRateSource?: string;clientId?:string;expedienteId?:string;
}
export interface OperationImportPreview {
  fileHash: string; fileName: string; templateId?: string; headers: string[];
  rows: OperationImportRow[]; warnings: string[]; mapping: ImportColumnMapping;
}

const normal = (input: string) => input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")
const aliases: Record<keyof ImportColumnMapping, string[]> = {
  name: ["cliente", "nombre", "razonsocial", "denominacion", "nombrecliente"], rfc: ["rfc", "rfccliente"], nif: ["nif"], curp: ["curp"],
  personType: ["tipopersona", "tipocliente"], activity: ["actividad", "actividadkey", "fraccion"], date: ["fecha", "fechaoperacion"],
  amount: ["monto", "importe", "montooperacion"], currency: ["moneda", "divisa"], reference: ["referencia", "folio", "referenciaoperacion"],
  paymentInstrument: ["instrumentomonetario", "mediopago", "instrumento"], exchangeRate: ["tipocambio"], exchangeRateDate: ["fechatipocambio"], exchangeRateSource: ["fuentetipocambio"],
  clientId:["clienteid","clientid"],expedienteId:["expedienteid"],
}
export function suggestImportMapping(headers: string[]): ImportColumnMapping {
  return Object.fromEntries(Object.entries(aliases).flatMap(([key, names]) => {
    const header = headers.find((candidate) => names.includes(normal(candidate)))
    return header ? [[key, header]] : []
  }))
}
export function getImportSatTemplates(): SatTemplateCatalogItem[] {
  return SAT_TEMPLATE_CATALOG.flatMap((template) => template.variants.length ? template.variants.map((variant) => ({ ...template, ...variant, variants: [] })) : [template])
}
export async function hashImportBytes(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer)
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("")
}

function isoDate(value: unknown): string {
  if (typeof value === "number") { const parsed = XLSX.SSF.parse_date_code(value); return parsed ? `${parsed.y}-${String(parsed.m).padStart(2,"0")}-${String(parsed.d).padStart(2,"0")}` : "" }
  const text = String(value ?? "").trim()
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  const date = match ? `${match[3]}-${match[2]}-${match[1]}` : text
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date ? date : ""
}
const text = (value: unknown) => String(value ?? "").trim()
function personType(value: string) {
  const normalized = normal(value)
  return ["pf", "personafisica", "pfresidente"].includes(normalized) ? "pf_residente"
    : ["pm", "personamoral", "pmmexicana"].includes(normalized) ? "pm_mexicana"
    : ["pfvisitante", "pmextranjera", "fideicomiso"].includes(normalized) ? value : ""
}
function activityKey(value: string, context: OperationImportContext) {
  return ACTIVIDADES_VULNERABLES_ARTICULO_17.find((activity) => activity.key === value)?.key || context.activityKey || ""
}
function buildRow(input: { values: Record<string, unknown>; mapping: ImportColumnMapping; context: OperationImportContext;
  fileHash: string; fileName: string; row: number; sheet: string; existing: readonly StoredPldOperationV3[];
  sat?: { templateId: string; templateFile: string; activity: string; fields: Record<string,string>; cells: Record<string,string>; missing: string[]; paymentApplicable: boolean };
}): OperationImportRow {
  const { values, mapping, context } = input
  const get = (key: keyof ImportColumnMapping) => values[mapping[key] || ""]
  const tipoCliente = personType(text(get("personType")))
  const identifiers = { rfc:text(get("rfc")).toUpperCase(), nif:text(get("nif")).toUpperCase(), curp:text(get("curp")).toUpperCase() }
  const fechaOperacion = isoDate(get("date"))
  const activity = input.sat?.activity || activityKey(text(get("activity")), context)
  const amountText = text(get("amount"))
  const currency = text(get("currency")).toUpperCase()
  const finance = resolveOperationFinance({ amountText, currency, exchangeRate:text(get("exchangeRate")), exchangeRateDate:isoDate(get("exchangeRateDate")), exchangeRateSource:text(get("exchangeRateSource")) })
  const issues: string[] = []
  if (!context.companyId || !context.companyRfc) issues.push("Selecciona el sujeto obligado con RFC antes de importar.")
  if (!text(get("name"))) issues.push("Nombre o denominación del cliente")
  if (!tipoCliente) issues.push("Tipo de persona (pf_residente, pm_mexicana u otro tipo aplicable)")
  const identifierError = validateExpedienteIdentifiers(identifiers, tipoCliente.startsWith("pf"))
  if (identifierError) issues.push(identifierError)
  if (!fechaOperacion) issues.push("Fecha de operación válida (AAAA-MM-DD o DD/MM/AAAA)")
  if (!ACTIVIDADES_VULNERABLES_ARTICULO_17.some((item) => item.key === activity)) issues.push("Actividad exacta aplicable")
  if (!finance.ok) issues.push(finance.error)
  if ((!input.sat || input.sat.paymentApplicable) && !text(get("paymentInstrument"))) issues.push("Instrumento monetario")
  if (input.sat?.missing.length) issues.push(...input.sat.missing.map((field) => `SAT: ${field}`))
  if (!input.sat) issues.push("Completar y validar formato SAT desde la operación")
  issues.push(IMPORT_CLIENT_LINK_MISSING)
  const id = `import-${input.fileHash.slice(0,24)}-${normal(input.sheet).slice(0,12)}-${input.row}`
  const duplicate = input.existing.some((operation) => operation.id === id || (operation.importSource as {fileHash?:string;row?:number;sheet?:string} | undefined)?.fileHash === input.fileHash && (operation.importSource as {row?:number}).row === input.row && (operation.importSource as {sheet?:string}).sheet === input.sheet)
  const now = context.now || new Date().toISOString()
  const operation = createStoredPldOperation({
    id, actividadKey:activity, actividadNombre:ACTIVIDADES_VULNERABLES_ARTICULO_17.find((item) => item.key === activity)?.nombre || "Actividad pendiente",
    cliente:text(get("name")), rfc:identifiers.rfc, identifiers, expedienteIdentifiers:identifiers,
    tipoCliente:tipoCliente || "pf_residente",importClientResolutionPending:true,importClientResolutionRequest:{clientId:text(get("clientId")),expedienteId:text(get("expedienteId"))},
    fechaOperacion, periodo:fechaOperacion ? fechaOperacion.slice(0,7).replace("-", "") : "", dateReviewRequired:!fechaOperacion,
    montoCentavos:finance.ok ? finance.montoCentavos : 0, monto:finance.ok ? finance.montoCentavos / 100 : 0,
    moneda:currency || "MXN", finance:finance.ok ? finance.finance : undefined,
    captureStatus:issues.length ? "draft" : "complete", financeReviewRequired:!finance.ok,
    captureDraft:issues.length ? {amountText, currency:currency || "MXN",exchangeRate:text(get("exchangeRate")),exchangeRateDate:text(get("exchangeRateDate")),exchangeRateSource:text(get("exchangeRateSource"))} : undefined,
    tipoOperacion:text(get("reference")) || "Operación importada", referenciaAviso:text(get("reference")) || undefined,
    evidencia:`Importación ${input.fileName} · ${input.sheet} · fila ${input.row}. Verificar soporte documental.`,
    liquidacion:{fechaPago:fechaOperacion,formaPago:"",instrumento:text(get("paymentInstrument")),moneda:currency,montoCentavos:finance.ok ? finance.montoCentavos : 0},
    satTemplateId:input.sat?.templateId,satTemplateVariant:input.sat?.templateId,satTemplateFile:input.sat?.templateFile,
    satFieldValues:input.sat?.fields,satCellValues:input.sat?.cells,satMissingRequiredFields:input.sat?.missing || ["Capturar formato SAT"],
    satWorkbookStatus:input.sat && !input.sat.missing.length ? "listo" : "borrador_bloqueado",
    importSource:{fileName:input.fileName,fileHash:input.fileHash,sheet:input.sheet,row:input.row},importRaw:{...values},
    importMissing:issues, requisitosChecklist:{}, avisoPresentado:false,
  }, {at:now, actor:context.actor, sujetoObligado:{id:context.companyId,rfc:context.companyRfc,nombre:context.companyName}})
  if (!operation) throw new Error("No se pudo construir el registro importado.")
  return {id,rowNumber:input.row,status:duplicate ? "duplicate" : issues.length ? "incomplete" : "valid",issues,operation,
    source:{fileName:input.fileName,fileHash:input.fileHash,sheet:input.sheet,row:input.row}}
}

function satPreview(input: { workbook: XLSX.WorkBook; fileName: string; fileHash: string; context:OperationImportContext; existing:readonly StoredPldOperationV3[];
  layout:SatXlsmLayout; template:SatTemplateCatalogItem }): OperationImportRow {
  const layout = normalizeSatXlsmLayout(input.layout)
  const cells: Record<string,string> = {}, fields: Record<string,string> = {}
  for (const section of layout.sections) for (const field of section.fields) {
    const cell = input.workbook.Sheets[field.sheetName]?.[field.cell] as XLSX.CellObject | undefined
    if (!cell || cell.v === undefined || cell.v === "") continue
    // Preserve date-time text and invalid capture for review instead of dropping it.
    const value = field.dataType === "fecha" ? isoDate(cell.v) || text(cell.v) : text(cell.v)
    fields[field.id] = value; cells[`${field.sheetName}!${field.cell}`] = value
  }
  const all = layout.sections.flatMap((section) => section.fields)
  const label = (field:SatXlsmField) => normal(field.label)
  const rowNumber = (field:SatXlsmField) => Number(/\d+$/.exec(field.cell)?.[0] || 0)
  const columnNumber = (field:SatXlsmField) => [...field.cell.replace(/\d/g, "").toUpperCase()].reduce((total,char) => total * 26 + char.charCodeAt(0) - 64, 0)
  const populated = all.filter((field) => Boolean(fields[field.id]))
  const first = (pattern:RegExp) => {const field=all.find((candidate) => pattern.test(candidate.id) && fields[candidate.id]);return field ? fields[field.id] : ""}
  const isClientSheet = (field:SatXlsmField) => /^(personaobjetodelaviso|aviso)$/.test(normal(field.sheetName))
  const entityKind = (field:SatXlsmField):"persona_fisica"|"persona_moral"|"fideicomiso"|undefined => {
    const condition = field.activeWhen?.find((item) => item.fieldId === PERSONA_OBJETO_TYPE_FIELD_ID)
    const scope = resolvePersonaObjetoScope(field)
    if (scope === "representante" || /representa|apoderad/.test(normal(field.id))) return undefined
    if (scope === "fideicomiso" || /denominacionfiduciario/.test(label(field))) return "fideicomiso"
    if (scope === "cliente_pm" || /denominacion.*razonsocial|^razonsocial$/.test(label(field)) || /^persona_aviso\.pm\./.test(field.id)) return "persona_moral"
    if (scope === "cliente_pf" || condition?.equals.includes("persona_fisica") || /^persona_aviso\.pf\./.test(field.id) || /\.persona-fisica-/.test(field.id)) return "persona_fisica"
    // Unrepeated primary-person rows in the official XII/XVI sheets carry no repeatGroup.
    if (/^nombres?$/.test(label(field)) && isClientSheet(field) && !field.repeatGroup) return "persona_fisica"
    return undefined
  }
  const identityAnchor = (field:SatXlsmField) => /^(nombre|nombres|denominacionorazonsocial|razonsocial|denominacionfiduciario)$/.test(label(field))
  const clientAnchors = populated.filter((field) => {
    if (!isClientSheet(field) || !identityAnchor(field)) return false
    const kind = entityKind(field)
    return kind === "persona_fisica" ? /^nombres?$/.test(label(field)) : kind === "persona_moral" ? /denominacion.*razonsocial|^razonsocial$/.test(label(field)) : kind === "fideicomiso" && /denominacionfiduciario/.test(label(field))
  }).sort((a,b) => rowNumber(a) - rowNumber(b) || columnNumber(a) - columnNumber(b))
  // A corporate name is authoritative over its representative's given name.
  const primary = clientAnchors.find((field) => entityKind(field) !== "persona_fisica") || clientAnchors[0]
  const kind = primary ? entityKind(primary)! : "persona_moral"
  fields[PERSONA_OBJETO_TYPE_FIELD_ID] = kind
  const inPrimaryRow = (field:SatXlsmField) => Boolean(primary && field.sheetName === primary.sheetName && rowNumber(field) === rowNumber(primary))
  const primaryFields = populated.filter(inPrimaryRow).sort((a,b) => columnNumber(a) - columnNumber(b))
  const primaryValue = (pattern:RegExp) => {const field=primaryFields.find((candidate) => pattern.test(label(candidate)));return field ? fields[field.id] : ""}
  fields[PERSONA_OBJETO_DOMICILIO_FIELD_ID] = populated.some((field) => isClientSheet(field) && /domiciliointernacional|domicilioextranjero/.test(normal(field.repeatGroup || field.id))) ? "internacional" : "nacional"
  const beneficiaryAnchors = populated.filter((field) => /beneficiario/.test(normal(field.sheetName)) && identityAnchor(field))
  fields[BENEFICIARY_PERSON_TYPE_FIELD_ID] = beneficiaryAnchors.some((field) => /denominacion/.test(label(field))) ? "persona_moral" : "persona_fisica"
  fields[BENEFICIARY_TRUST_MODE_FIELD_ID] = beneficiaryAnchors.some((field) => /fiduciario/.test(label(field))) ? "si" : "no"
  fields[BENEFICIARY_REPEAT_MODE_FIELD_ID] = beneficiaryAnchors.some((field) => (field.repeatIndex || 1) > 1) ? "si" : "no"
  // Branch and repeated-row switches exist only in the UI, never in workbook cells.
  // Recover them from occupied cells; ordinary SAT selectors remain authoritative.
  for (const field of populated) for (const condition of field.activeWhen || []) {
    if (/^sat\.(?:branch|row)\./.test(condition.fieldId) && condition.equals.length === 1) fields[condition.fieldId] = condition.equals[0]
  }
  const active = pruneInactiveSatFieldValues({fields:all,values:fields})
  const activeFirst = (pattern:RegExp) => {const field=all.find((candidate) => pattern.test(candidate.id) && active[candidate.id]);return field ? active[field.id] : ""}
  const missing = all.filter((field) => isSatXlsmFieldRequired(field,active) && !active[field.id]).map((field) => field.label)
  missing.push(...getSatOperationBranchMissingLabels(layout.templateId,active,all))
  const pf = kind === "persona_fisica"
  const name = primary ? pf ? [fields[primary.id], primaryValue(/^apellidopaterno$/), primaryValue(/^apellidomaterno$/)].filter(Boolean).join(" ") : fields[primary.id] : ""
  if (clientAnchors.filter((field) => !inPrimaryRow(field)).length) missing.push("Revisar persona objeto: el libro contiene varias personas o participantes; conserva todos sus datos")
  const extraAmountLabels: Record<string,string[]> = {
    "sat-fraccion-ii-tarjetas-servicios": ["montototaldelgastoacumuladoenelperiodo"],
    "sat-fraccion-x-traslado": ["montotrasladadoyocustodiado"],
  }
  const amounts = all.filter((field) => field.dataType === "moneda" && (/^(monto(?:de)?(?:la)?(?:operacion|pago|aportacion|prestamo)|importe|monto$)/.test(label(field)) || extraAmountLabels[layout.templateId]?.includes(label(field))) && active[field.id])
  const primaryAmountField = amounts.length === 1 ? amounts[0] : amounts.find((field) => field.id === "pago.monto")
  const primaryAmount = primaryAmountField ? active[primaryAmountField.id] : ""
  if (amounts.length > 1) missing.push("Revisar importe total: el libro contiene varios pagos")
  const paymentFields = primaryAmountField ? all.filter((field) => active[field.id] && field.sheetName === primaryAmountField.sheetName && rowNumber(field) === rowNumber(primaryAmountField)) : []
  const paymentValue = (pattern:RegExp) => {
    const field=paymentFields.find((candidate) => pattern.test(label(candidate)))
    if (field) return active[field.id]
    const matches = all.filter((candidate) => active[candidate.id] && primaryAmountField?.sheetName === candidate.sheetName && pattern.test(label(candidate)))
    const distinct = [...new Set(matches.map((candidate) => active[candidate.id]))]
    return distinct.length === 1 ? distinct[0] : ""
  }
  const currencyValue = paymentValue(/^(?:tipode)?moneda|^divisa/) || activeFirst(/^pago\.moneda$|^operacion_financiera\.moneda$/)
  const currency = ({"1":"MXN","2":"USD","3":"EUR"} as Record<string,string>)[currencyValue.split(",")[0]] || (/^[A-Z]{3}$/.test(currencyValue) ? currencyValue : "")
  const operationDateField = populated.find((field) => field.id === "acto.fecha_operacion") || populated.find((field) => /^fechad?e?(la)?operacion|^fechayhoradelaoperacion|^fechaoperacion|^fechadelasaportaciones/.test(label(field)))
  const operationDate = operationDateField ? fields[operationDateField.id] : ""
  const rowValues = {name,rfc:primaryValue(/^rfc(?:delsocio)?$/),nif:primaryValue(/^nif|identificacionfiscal/),curp:pf ? primaryValue(/^curp$/) : "",
    personType:kind === "fideicomiso" ? "fideicomiso" : pf ? "pf_residente" : "pm_mexicana",date:operationDate.split(/[T ]/)[0],amount:primaryAmount,currency,
    reference:first(/^persona_aviso\.referencia$/) || (() => {const field=populated.find((candidate) => /^referencia(?:delaviso)?$/.test(label(candidate)));return field ? fields[field.id] : ""})(),
    instrument:paymentValue(/^instrumentomonetario/) || activeFirst(/^pago\.instrumento_monetario$|^operacion_financiera\.instrumento_monetario$/)}
  const mapping = {name:"name",rfc:"rfc",nif:"nif",curp:"curp",personType:"personType",date:"date",amount:"amount",currency:"currency",reference:"reference",paymentInstrument:"instrument"}
  const activity = input.context.activityKey && input.template.actividadKeys.includes(input.context.activityKey) ? input.context.activityKey : input.template.actividadKeys.length === 1 ? input.template.actividadKeys[0] : ""
  const subjectField = populated.find((field) => field.id === "persona_aviso.sujeto_obligado_rfc") || populated.find((field) => isClientSheet(field) && ["C4","C5"].includes(field.cell) && /^rfc(?:deltribunalodependencia)?$/.test(label(field)))
  const satSubject = subjectField ? fields[subjectField.id] : ""
  if (satSubject && satSubject.toUpperCase() !== input.context.companyRfc.toUpperCase()) missing.push("El RFC del sujeto obligado del libro no coincide con la empresa activa")
  return buildRow({...input,values:rowValues,mapping,row:1,sheet:"SAT",sat:{templateId:input.template.templateId,templateFile:input.template.officialXlsmName,activity,fields:active,cells:satFieldValuesToWorkbookCells(active,layout),missing,paymentApplicable:all.some((field) => /instrumentomonetario/.test(label(field)))}})
}

export function readOperationImportWorkbook(bytes:Uint8Array,fileName:string,options: {tabular?:boolean} = {}):XLSX.WorkBook {
  assertImportFileLimits(bytes,fileName)
  if(/\.csv$/i.test(fileName)){
    let content:string
    try{content=new TextDecoder("utf-8",{fatal:true}).decode(bytes)}catch{content=new TextDecoder("windows-1252").decode(bytes)}
    const checked = preflightCsvTable(content)
    return XLSX.read(checked.content,{type:"string",FS:checked.delimiter,raw:true,cellFormula:false,cellHTML:false,bookVBA:false,sheetRows:IMPORT_LIMITS.rows+12})
  }
  if (options.tabular) assertValidatedTabularWorkbookLimits(bytes)
  return XLSX.read(bytes,{type:"array",raw:true,cellFormula:false,cellHTML:false,bookVBA:false,sheetRows:IMPORT_LIMITS.rows + 12})
}

export async function parseOperationImport(input: { bytes:Uint8Array;fileName:string;context:OperationImportContext;existing?:readonly StoredPldOperationV3[];mapping?:ImportColumnMapping;layouts?:SatXlsmLayout[];templateId?:string }): Promise<OperationImportPreview> {
  const templates = getImportSatTemplates()
  const namedTemplate = input.templateId ? templates.find((template) => template.templateId === input.templateId && (!input.context.activityKey || template.actividadKeys.includes(input.context.activityKey)))
    : templates.find((template) => normal(template.officialXlsmName.replace(/\.xlsm$/i,"")) === normal(input.fileName.replace(/\.(?:xlsm|xlsx)$/i,"")))
  const layout = input.layouts?.find((candidate) => candidate.templateId === namedTemplate?.templateId)
  const workbook=readOperationImportWorkbook(input.bytes,input.fileName,{tabular:!(namedTemplate && layout)})
  const fileHash = await hashImportBytes(input.bytes)
  const existing = input.existing || []
  if (namedTemplate && layout) {
    if (!layout.sections.every((section) => Boolean(workbook.Sheets[section.sheetName]))) throw new Error("Las hojas del libro no corresponden al formato SAT seleccionado.")
    return {fileHash,fileName:input.fileName,templateId:namedTemplate.templateId,headers:[],mapping:{},warnings:["El libro se leyó sin ejecutar macros ni controles."],rows:[satPreview({...input,workbook,fileHash,existing,layout,template:namedTemplate})]}
  }
  const sheet = workbook.SheetNames.find((name) => !/^(combos|catalogos|catálogos)$/i.test(name))
  if (!sheet) throw new Error("El libro no contiene una hoja de datos.")
  const worksheet = workbook.Sheets[sheet]
  // sheet_to_json iterates the declared rectangle, including empty cells. Validate
  // the original range before expansion; !fullref prevents sheetRows truncation
  // from silently hiding data outside the import batch.
  const sourceRange = String(worksheet["!fullref"] || worksheet["!ref"] || "A1")
  if (!/^[A-Z]{1,3}[1-9]\d*(?::[A-Z]{1,3}[1-9]\d*)?$/.test(sourceRange)) throw new Error("La tabla contiene un rango de celdas no válido.")
  const range = XLSX.utils.decode_range(sourceRange)
  const width = range.e.c - range.s.c + 1, height = range.e.r - range.s.r + 1
  if (width < 1 || height < 1 || range.e.c >= 16384 || range.e.r >= IMPORT_LIMITS.rows + 10 || width > IMPORT_LIMITS.columns || height > IMPORT_LIMITS.rows + 10 || width * height > IMPORT_LIMITS.cells) throw new Error("La tabla excede el límite de 2,000 filas, 128 columnas o 256,000 celdas. Divide el archivo en lotes.")
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet,{header:1,raw:true,defval:""})
  let headerIndex = matrix.slice(0,10).findIndex((row) => Object.keys(suggestImportMapping(row.map(text))).length >= 2)
  const customHeaders=headerIndex<0
  if(customHeaders)headerIndex=matrix.slice(0,10).findIndex((row)=>row.filter((value)=>typeof value==="string"&&Boolean(value.trim())&&!/^\d+(?:[.,]\d+)?$/.test(value.trim())).length>=2)
  if (headerIndex < 0) throw new Error("No se reconoció una tabla de operaciones. Usa la plantilla de importación o selecciona el formato SAT correspondiente.")
  const headers = matrix[headerIndex].map(text)
  if (new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length) throw new Error("La tabla tiene encabezados duplicados. Renómbralos antes de importar.")
  const mapping = {...suggestImportMapping(headers),...input.mapping}
  const data = matrix.slice(headerIndex + 1).map((values,index)=>({values,rowNumber:headerIndex+index+2})).filter(({values}) => values.some((value) => value !== "" && value !== null))
  if (data.length > IMPORT_LIMITS.rows) throw new Error("Divide el archivo en lotes de hasta 2,000 filas.")
  const rows = data.map(({values,rowNumber}) => buildRow({...input,fileHash,existing,mapping,sheet,row:rowNumber,values:Object.fromEntries(headers.map((header,column) => [header,values[column]]))}))
  return {fileHash,fileName:input.fileName,headers,mapping,rows,warnings:[...(customHeaders?["La primera fila de rótulos se tomó como encabezado. Asigna las columnas y revisa cada fila antes de guardar."]:[]),"La importación tabular conserva datos como borrador hasta completar los campos específicos del formato SAT."]}
}

export function mergeImportedOperations(existing: StoredPldOperationV3[], rows: OperationImportRow[], selected: string[], allowDrafts: boolean): {operations: StoredPldOperationV3[]; added: number} {
  const ids = new Set(existing.map((operation) => operation.id))
  const additions = rows.filter((row) => selected.includes(row.id) && !ids.has(row.id) && (row.status === "valid" || allowDrafts && row.status === "incomplete"))
    .map((row) => {ids.add(row.id);return row.operation})
  return {operations:recalculateStoredPldOperationsChronologically([...existing,...additions],{recordHistory:false}),added: additions.length}
}

export function nativePdfSuggestions(pages: Array<{page:number;text:string}>) {
  return pages.flatMap(({page,text:content}) => {
    const rfc = /\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/.exec(content.toUpperCase())?.[0]
    const date = /\b(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\b/.exec(content)?.[0]
    return [{page,text:content.slice(0,10000),rfc:rfc || "",date:date ? isoDate(date) : ""}]
  })
}
