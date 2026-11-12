import type { ProfessionalReport } from "./reports"
import type { IntegrationClient, IntegrationSubject } from "./integration-records"
import type { StoredPldOperationV3 } from "./stored-operations"
import type { StoredSubmission, SubmissionTrace } from "./submissions"
import type { SatOutputPackage } from "./types"
import { areOperationCurrenciesEquivalent, formatOperationFinancialSummary, isMxnCurrency, sanitizeOperationFinance } from "./operation-finance"
import { formatMoneyFromCents } from "./money"
import { resolveOperationOutputKind } from "./sat-queue"
import { findClienteTipoLabel } from "../data/tipos-cliente"

export type AvisosReportKind = "consolidated" | "notice" | "trace"
export interface AvisosReportInput {
  operations: readonly StoredPldOperationV3[]
  clients: readonly IntegrationClient[]
  subjects: readonly IntegrationSubject[]
  packages: readonly SatOutputPackage[]
  submissions: readonly StoredSubmission[]
  subjectId?: string
  clientId?: string
  currentOperationId?: string
  currentSubmissionId?: string
  currentTrace?: readonly (Omit<SubmissionTrace, "timestamp"> & { timestamp: Date | string })[]
  clientRiskLabels?: Readonly<Record<string, string>>
  subjectRegistrations?: readonly { id: string; registroCompleto: boolean }[]
}

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
const string = (value: unknown) => typeof value === "string" ? value.trim() : ""
const selected = (value: string | undefined) => Boolean(value && value !== "__all__")
export const reportQuantity = (count: number, singular: string, plural: string) => `${count} ${count === 1 ? singular : plural}`

/** Report filters use the stable relationship, never an RFC as authority. The
 * caller already supplies the active company's authorized records. */
export function reportOperationClientId(operation: StoredPldOperationV3): string {
  return string(operation.expedienteId || operation.expedienteReferenciado || operation.clienteId || operation.clientId || object(operation.expedienteEui).expedienteId)
}
function subjectId(value: unknown): string {
  const raw = object(value)
  return string(object(raw.sujetoObligado).id || raw.sujetoObligadoId || object(raw.expedienteEui).sujetoObligadoId || raw.tenantId)
}
export function selectAvisosReportScope(input: AvisosReportInput) {
  const subject = input.subjects.find((item) => item.id === input.subjectId)
  const subjectIds = new Set([input.subjectId, ...(subject?.aliasIds || [])].filter((value): value is string => Boolean(value)))
  const client = input.clients.find((item) => item.id === input.clientId)
  const clientIds = new Set([input.clientId, client?.expedienteId, client?.clientId].filter((value): value is string => Boolean(value)))
  const allOperations = input.operations.filter((operation) =>
    (!selected(input.subjectId) || subjectIds.has(subjectId(operation))) &&
    (!selected(input.clientId) || clientIds.has(reportOperationClientId(operation))),
  )
  const operations = allOperations.filter((operation) => operation.lifecycle.status === "active" && operation.captureStatus !== "draft")
  const linkedIds = new Set(operations.map(reportOperationClientId).filter(Boolean))
  const clients = input.clients.filter((item) =>
    (!selected(input.clientId) || item.id === input.clientId) &&
    (!selected(input.subjectId) || subjectIds.has(item.sujetoObligadoId || "") || [item.id, item.clientId, item.expedienteId].some((id) => Boolean(id && linkedIds.has(id)))),
  )
  const operationIds = new Set(allOperations.map((operation) => operation.id))
  const submissions = input.submissions.filter((submission) => operationIds.has(submission.operationId) ||
    (!selected(input.subjectId) && !selected(input.clientId)))
  return { operations, allOperations, clients, submissions,
    scopeLabel: `${selected(input.subjectId) ? `Sujeto: ${subject?.nombre || input.subjectId}` : "Todos los sujetos vinculados"} | ${selected(input.clientId) ? `Cliente: ${client?.nombre || input.clientId}` : "Todos los clientes"}` }
}

export type NoticePreparationStage = "Por preparar" | "Preparación pendiente" | "XML validado localmente" | "Presentación documentada" | "Corrección pendiente" | "Histórico por revisar"
export function hasNoticeObligation(operation: StoredPldOperationV3) {
  return resolveOperationOutputKind(operation) !== null
}
function documentedSubmission(submission: StoredSubmission) {
  const validDay=(value:string|undefined)=>Boolean(value&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value)
  return submission.status === "presented" && Boolean(submission.form.folio?.trim() && submission.form.digitalSeal?.trim() &&
    validDay(submission.form.submissionDate) && validDay(submission.form.acknowledgementDate) && submission.attachments.some((file) => file.type === "Acuse SAT" && file.dataUrl))
}
export function operationNoticeStage(operation: StoredPldOperationV3, input: Pick<AvisosReportInput, "submissions" | "packages">): NoticePreparationStage {
  if (operation.submission.status === "correction-pending") return "Corrección pendiente"
  const submissions = input.submissions.filter((item) => item.operationId === operation.id && item.sourceOperationRevision === operation.revision)
  const documented = submissions.some(documentedSubmission)
  if (operation.submission.status === "presented" && documented) return "Presentación documentada"
  if (operation.submission.status === "presented" || operation.avisoPresentado) return "Histórico por revisar"
  const currentPackages = input.packages.filter((item) => item.sourceOperationId === operation.id && item.sourceOperationRevision === operation.revision)
  if (currentPackages.some((item) => item.validation.status === "listo" && item.xml.trim())) return "XML validado localmente"
  if (currentPackages.length || submissions.length) return "Preparación pendiente"
  return "Por preparar"
}

export function getReportReliableMxnCents(operation: Pick<StoredPldOperationV3, "financeReviewRequired" | "montoCentavos" | "finance" | "moneda" | "montoNoDeterminado">): number | null {
  if (operation.montoNoDeterminado || operation.financeReviewRequired || !Number.isSafeInteger(operation.montoCentavos) || operation.montoCentavos < 0) return null
  if (operation.finance) {
    const finance = sanitizeOperationFinance(operation.finance)
    if (!finance || !areOperationCurrenciesEquivalent(finance.currency, operation.moneda) || finance.mxnAmountCents !== operation.montoCentavos) return null
  } else if (!isMxnCurrency(operation.moneda)) return null
  return operation.montoCentavos
}
function totalAmount(operations: readonly StoredPldOperationV3[]) {
  let cents = 0, pending = 0
  for (const operation of operations) {
    const value = getReportReliableMxnCents(operation)
    if (value === null) { pending++; continue }
    cents += value
    if (!Number.isSafeInteger(cents)) throw new Error("El importe consolidado excede la precisión admitida; reduce el periodo del reporte.")
  }
  return { formatted: pending > 0 && pending === operations.length ? "Sin total MXN validado" : formatMoneyFromCents(cents, { currency: "MXN" }), pending }
}
export function avisosReportDate(value: string | Date, includeTime = false): string {
  const raw = value instanceof Date ? Number.isFinite(value.getTime()) ? value.toISOString() : "Fecha no válida" : value
  if (!raw) return "Sin fecha"
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T12:00:00Z`)
    if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === raw) return raw.split("-").reverse().join("/")
    return `Fecha no válida: ${raw}`
  }
  const timestamp = Date.parse(raw)
  if (!Number.isFinite(timestamp)) return `Fecha no válida: ${raw}`
  const iso = new Date(timestamp).toISOString()
  return `${iso.slice(0, 10).split("-").reverse().join("/")}${includeTime ? ` ${iso.slice(11, 19)} UTC` : ""}`
}

export interface ReportSubmissionEvent extends SubmissionTrace {
  operationId: string
  operationRevision: string
  submissionState: string
  cancelled: boolean
  unsaved: boolean
}
export function collectAvisosReportTrace(input: AvisosReportInput): ReportSubmissionEvent[] {
  const scope = selectAvisosReportScope(input)
  const operations = new Map(scope.allOperations.map((item) => [item.id, item]))
  const events = new Map<string, ReportSubmissionEvent>()
  const add = (trace: SubmissionTrace, submission?: StoredSubmission, unsaved = false) => {
    const parsedTimestamp = Date.parse(trace.timestamp)
    trace = { ...trace, timestamp: Number.isFinite(parsedTimestamp) ? new Date(parsedTimestamp).toISOString() : trace.timestamp }
    const operationId = submission?.operationId || input.currentOperationId || ""
    const operation = operations.get(operationId)
    const event = { ...trace, operationId, operationRevision: submission ? String(submission.sourceOperationRevision) : operation ? String(operation.revision) : "Sin vínculo",
      submissionState: unsaved ? "En pantalla; no guardado" : submission?.status === "presented" ? documentedSubmission(submission) ? "Presentación histórica con acuse" : "Marcado presentado; soporte por revisar" : "Borrador guardado",
      cancelled: operation?.lifecycle.status === "cancelled", unsaved }
    const key = trace.id || `${trace.noticeId}|${trace.timestamp}|${trace.action}|${trace.details}`
    const previous = events.get(key)
    if (previous) {
      if (["action", "user", "timestamp", "details", "noticeId"].some((field) => previous[field as keyof SubmissionTrace] !== trace[field as keyof SubmissionTrace])) {
        throw new Error("Hay eventos de bitácora con el mismo ID y contenido diferente. Revisa el historial antes de exportar.")
      }
      return
    }
    events.set(key, event)
  }
  for (const submission of scope.submissions) for (const trace of submission.trace) add(trace, submission)
  const currentInScope = Boolean(input.currentOperationId && operations.has(input.currentOperationId)) ||
    (!input.currentOperationId && !selected(input.subjectId) && !selected(input.clientId))
  if (currentInScope) {
    const currentSubmission = scope.submissions.find((item) => item.id === input.currentSubmissionId)
    for (const trace of input.currentTrace || []) {
      const timestamp = trace.timestamp instanceof Date ? Number.isFinite(trace.timestamp.getTime()) ? trace.timestamp.toISOString() : "Fecha no válida" : trace.timestamp
      add({ ...trace, timestamp }, currentSubmission, true)
    }
  }
  return [...events.values()].sort((a, b) => {
    const ta = Date.parse(a.timestamp), tb = Date.parse(b.timestamp)
    return (Number.isFinite(ta) ? ta : Number.MAX_SAFE_INTEGER) - (Number.isFinite(tb) ? tb : Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id)
  })
}

export function buildAvisosProfessionalReport(kind: AvisosReportKind, input: AvisosReportInput): { report: ProfessionalReport; csvRows: (string | number | null)[][] } {
  const scope = selectAvisosReportScope(input)
  const notices = scope.operations.filter(hasNoticeObligation)
  const stages = notices.map((operation) => operationNoticeStage(operation, input))
  const periods = [...new Set(scope.operations.map((operation) => operation.periodo).filter(Boolean))].sort()
  const amounts = totalAmount(scope.operations)
  const currentSubmissions = scope.submissions
  const common = {
    scopeLabel: scope.scopeLabel,
    period: periods.length ? periods.join(", ") : "Sin operaciones en el ámbito seleccionado",
    sources: ["Operaciones, expedientes, paquetes SAT y avisos de la empresa activa.", "Registros leídos por sus IDs estables; no se infieren vínculos de autorización por RFC.", "Los estados de preparación se refieren a la revisión vigente de cada operación."],
    disclaimers: ["Documento interno de revisión. La validación XML local no equivale a presentación ni aceptación por SAT.", "Los borradores y cancelaciones no se suman a operaciones ni importes vigentes. La bitácora conserva el histórico cancelado identificado.", "Los ejemplos ficticios conservan sus etiquetas de origen; este reporte no acredita cumplimiento por sí mismo."],
  }
  const operationColumns = ["Operación / revisión", "Cliente / identificador", "Actividad y periodo", "Importe original / equivalente MXN", "Fecha", "Salida / preparación"]
  const operationRow = (operation: StoredPldOperationV3) => {
    const client = input.clients.find((item) => [item.id, item.expedienteId, item.clientId].includes(reportOperationClientId(operation)))
    const output = ({aviso_normal:"Aviso normal",informe_27_bis:"Informe 27 Bis",aviso_24h:"Aviso de 24 horas"} as Record<string,string>)[resolveOperationOutputKind(operation)||""] || "Tipo de salida por confirmar"
    const treatment = operation.clientIdentityReviewRequired ? "Identidad por revisar; clasificación histórica conservada" : hasNoticeObligation(operation) ? `${output}\n${operationNoticeStage(operation, input)}` : operation.umbralStatus === "identificacion" ? "Sólo identificación; sin XML de aviso" : "Registro interno; sin XML de aviso"
    return [ `${operation.id}\nRevisión ${operation.revision}`, `${operation.cliente}\n${client?.identifier || operation.rfc || "Identificador pendiente"}`, `${operation.actividadNombre}\n${operation.periodo}`, operation.montoNoDeterminado ? "Monto no determinado" : formatOperationFinancialSummary(operation), avisosReportDate(operation.fechaOperacion), treatment ]
  }
  const stageBars = [...new Set(stages)].map((stage) => ({label:stage,value:stages.filter((value) => value === stage).length,max:notices.length || 1,valueLabel:reportQuantity(stages.filter((value) => value === stage).length,"operación","operaciones"),tone:stage === "Presentación documentada" ? "success" as const : stage === "XML validado localmente" ? "primary" as const : "accent" as const}))
  const presentedCount = stages.filter((stage)=>stage === "Presentación documentada").length
  const pendingCount = stages.length - presentedCount

  if (kind === "notice") {
    const noticeAmount = totalAmount(notices)
    const csvRows = [operationColumns, ...notices.map(operationRow)]
    return { csvRows, report: { ...common, title: "Operaciones con obligación de aviso", subtitle: "Obligación, preparación y presentación son estados diferentes.", filename: "operaciones-con-obligacion-de-aviso.pdf",
      summary: [`${reportQuantity(notices.length,"operación vigente tiene","operaciones vigentes tienen")} obligación de aviso en el ámbito seleccionado. ${reportQuantity(presentedCount,"operación cuenta","operaciones cuentan")} con presentación documentada para su revisión actual.`, "Un paquete XML listo no se presenta como un aviso enviado. Las revisiones anteriores permanecen en la bitácora."],
      metrics:[{label:"Operaciones con aviso",value:String(notices.length)},{label:noticeAmount.pending ? "Importe MXN conocido (parcial)" : "Importe equivalente MXN",value:noticeAmount.formatted,note:noticeAmount.pending ? reportQuantity(noticeAmount.pending,"importe pendiente no incluido","importes pendientes no incluidos") : "Centavos exactos"}],
      sections:[{title:"Estado de preparación",bars:stageBars,note:"Conteos sobre operaciones con obligación, no una tasa de cumplimiento."},
        {title:"Detalle completo de operaciones",table:{columns:operationColumns.map((label,index)=>({label,width:index===3?1.4:1})),rows:notices.map(operationRow),emptyMessage:"No hay operaciones con obligación de aviso en este ámbito."}}] } }
  }
  if (kind === "trace") {
    const events = collectAvisosReportTrace(input)
    const unsavedCount = events.filter((event)=>event.unsaved).length
    const savedCount = events.length - unsavedCount
    const columns = ["Fecha UTC", "Acción", "Usuario", "Detalle", "Aviso", "Operación / revisión", "Estado de origen"]
    const rows = events.map((event) => [avisosReportDate(event.timestamp,true),event.action,event.user,event.details,event.noticeId || "Sin aviso",`${event.operationId || "Sin operación"}\nRevisión ${event.operationRevision}`,`${event.submissionState}${event.cancelled ? "; operación cancelada" : ""}`])
    return {csvRows:[columns,...rows],report:{...common,title:"Bitácora completa de avisos",subtitle:"Versiones, eventos y documentos de origen sin truncar el historial.",filename:"bitacora-completa-de-avisos.pdf",
      summary:[`${reportQuantity(events.length,"evento","eventos")} en ${reportQuantity(currentSubmissions.length,"revisión de aviso","revisiones de aviso")} del ámbito seleccionado. Se incluyen versiones anteriores y se eliminan únicamente repeticiones idénticas por ID.`,`${reportQuantity(unsavedCount,"evento existe","eventos existen")} sólo en pantalla y ${unsavedCount === 1 ? "se identifica expresamente como no guardado" : "se identifican expresamente como no guardados"}.`],
      metrics:[{label:"Eventos",value:String(events.length)},{label:"Revisiones de aviso",value:String(currentSubmissions.length)},{label:"Operaciones vinculadas",value:String(new Set(currentSubmissions.map((item)=>item.operationId).filter(Boolean)).size)}],
      sections:[{title:"Origen de los eventos",bars:[{label:"Eventos guardados",value:savedCount,max:events.length||1,valueLabel:reportQuantity(savedCount,"evento","eventos"),tone:"primary"},{label:"En pantalla, sin guardar",value:unsavedCount,max:events.length||1,valueLabel:reportQuantity(unsavedCount,"evento","eventos"),tone:"accent"}]},
        {title:"Bitácora cronológica completa",table:{columns:columns.map((label,index)=>({label,width:index===3?2:1})),rows,emptyMessage:"No hay eventos guardados ni en pantalla para el ámbito seleccionado."}},
        {title:"Versiones y acuses de origen",table:{columns:[{label:"Aviso / revisión"},{label:"Operación / revisión"},{label:"Estado / folio"},{label:"Envío / acuse"},{label:"Documentos y vínculos"}],rows:currentSubmissions.map((submission)=>[`${submission.id}\nRevisión ${submission.revision}`,`${submission.operationId || "Sin vínculo"}\nRevisión ${submission.sourceOperationRevision}`,`${submission.status === "presented" ? documentedSubmission(submission) ? "Presentación histórica con acuse" : "Marcado presentado; soporte por revisar" : "Borrador"}\n${submission.form.folio || "Sin folio"}`,`${avisosReportDate(submission.form.submissionDate || "")}\n${avisosReportDate(submission.form.acknowledgementDate || "")}`,[...submission.attachments.map((file)=>`${file.type}: ${file.name} | versión ${file.id} | SHA-256 ${file.sha256 || "Sin hash"}`),...(submission.correctionOf?[`Corrección de ${submission.correctionOf}`]:[])].join("\n") || "Sin documentos"]),emptyMessage:"No hay versiones de aviso vinculadas."}}]}}
  }

  const columns = ["Cliente / ID estable", "Identificador", "Operaciones", "Con obligación", "Avisos por atender", "EBR vigente", "Tipo de cliente", "Sujeto obligado vinculado", "Registro SAT capturado", "Alertas operativas"]
  const rows = scope.clients.map((client) => {
    const ids = [client.id,client.expedienteId,client.clientId].filter(Boolean)
    const clientOperations = scope.operations.filter((operation) => ids.includes(reportOperationClientId(operation)))
    const obligations = clientOperations.filter(hasNoticeObligation)
    const linkedIds=new Set([client.sujetoObligadoId,...clientOperations.map(subjectId)].filter(Boolean))
    const subjects=input.subjects.filter((item)=>linkedIds.has(item.id)||item.aliasIds?.some((id)=>linkedIds.has(id)))
    const registrations=subjects.map((item)=>{
      const saved=input.subjectRegistrations?.find((record)=>record.id===item.id||item.aliasIds?.includes(record.id))
      return `${item.nombre}: ${saved ? saved.registroCompleto ? "Captura marcada completa" : "Captura incompleta" : "Sin registro vinculado"}`
    })
    return [`${client.nombre}\n${client.id}`,client.identifier || "Pendiente",clientOperations.length,obligations.length,obligations.filter((operation)=>operationNoticeStage(operation,input)!=="Presentación documentada").length,input.clientRiskLabels?.[client.id] || "Sin evaluación vigente",findClienteTipoLabel(client.tipoCliente) || client.tipoCliente || "Sin tipo capturado",subjects.map((item)=>`${item.nombre} | ${item.id}`).join("\n")||"Sin vínculo estable",registrations.join("\n")||"Sin registro vinculado",clientOperations.filter((operation)=>Boolean(operation.alerta)).length]
  })
  const unlinked = scope.operations.filter((operation) => !scope.clients.some((client)=>[client.id,client.expedienteId,client.clientId].includes(reportOperationClientId(operation))))
  const treatment = {notice:notices.length,identification:scope.operations.filter((operation)=>!operation.clientIdentityReviewRequired&&!hasNoticeObligation(operation)&&operation.umbralStatus==="identificacion").length,internal:scope.operations.filter((operation)=>!operation.clientIdentityReviewRequired&&!hasNoticeObligation(operation)&&operation.umbralStatus!=="identificacion").length,identity:scope.operations.filter((operation)=>operation.clientIdentityReviewRequired).length}
  return {csvRows:[columns,...rows],report:{...common,title:"Reporte consolidado por cliente",subtitle:"Expedientes, operaciones y preparación de avisos de la empresa activa.",filename:"reporte-consolidado-por-cliente.pdf",
    summary:[`${reportQuantity(scope.clients.length,"cliente vinculado","clientes vinculados")} y ${reportQuantity(scope.operations.length,"operación vigente","operaciones vigentes")} en el ámbito seleccionado. ${reportQuantity(notices.length,"operación tiene","operaciones tienen")} obligación de aviso; ${reportQuantity(pendingCount,"operación no cuenta","operaciones no cuentan")} con presentación documentada vigente.`,`${reportQuantity(unlinked.length,"operación requiere","operaciones requieren")} un vínculo estable de cliente; ${unlinked.length === 1 ? "se conserva en el detalle sin asignarla" : "se conservan en el detalle sin asignarlas"} por coincidencia de RFC.`],
    metrics:[{label:"Clientes vinculados",value:String(scope.clients.length)},{label:"Operaciones vigentes",value:String(scope.operations.length)},{label:amounts.pending?"Importe MXN conocido (parcial)":"Importe equivalente MXN",value:amounts.formatted,note:amounts.pending?reportQuantity(amounts.pending,"importe por revisar excluido","importes por revisar excluidos") : "Centavos exactos"}],
    sections:[{title:"Tratamiento de las operaciones",bars:[{label:"Con obligación de aviso",value:treatment.notice,max:scope.operations.length||1,valueLabel:reportQuantity(treatment.notice,"operación","operaciones"),tone:"accent"},{label:"Sólo identificación",value:treatment.identification,max:scope.operations.length||1,valueLabel:reportQuantity(treatment.identification,"operación","operaciones"),tone:"primary"},{label:"Registro interno",value:treatment.internal,max:scope.operations.length||1,valueLabel:reportQuantity(treatment.internal,"operación","operaciones"),tone:"muted"},...(treatment.identity?[{label:"Identidad por revisar",value:treatment.identity,max:scope.operations.length||1,valueLabel:reportQuantity(treatment.identity,"operación","operaciones"),tone:"muted" as const}]:[])],note:"La obligación monetaria es independiente del nivel de riesgo EBR."},
      {title:"Detalle por cliente",table:{columns:columns.slice(0,6).map((label,index)=>({label,width:index===0?1.7:1})),rows:rows.map((row)=>row.slice(0,6)),emptyMessage:"No hay clientes vinculados en el ámbito seleccionado."}},
      {title:"Alta, tipo de cliente y alertas",table:{columns:[{label:columns[0],width:1.5},...columns.slice(6).map((label)=>({label}))],rows:rows.map((row)=>[row[0],...row.slice(6)]),emptyMessage:"Sin clientes vinculados."},note:"El estado del registro SAT es un dato capturado, no una certificación global de cumplimiento."},
      {title:"Detalle completo de operaciones",table:{columns:operationColumns.map((label)=>({label})),rows:scope.operations.map(operationRow),emptyMessage:"No hay operaciones vigentes en este ámbito."},note:`${reportQuantity(unlinked.length,"operación sin vínculo estable se mantiene","operaciones sin vínculo estable se mantienen")} sin asignar por RFC.`}]}}
}
