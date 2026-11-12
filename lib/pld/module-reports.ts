import type { ProfessionalReport } from "./reports"
import { formatPldCalendarDate } from "./calendar-date"

type ReportDate = string | Date | null | undefined
type Section = ProfessionalReport["sections"][number]
const missing = "Sin dato"
const text = (value: string | null | undefined, fallback = missing) => value?.trim() || fallback
const date = (value: ReportDate): string => {
  if (!value) return "Sin fecha"
  const calendar = formatPldCalendarDate(value)
  return calendar ? calendar.split("-").reverse().join("/") : `Fecha por revisar: ${String(value)}`
}
const timestamp = (value: ReportDate): string => {
  if (!value) return "Sin fecha/hora"
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return `${date(value)} (hora sin capturar)`
  if (typeof value === "string" && (!formatPldCalendarDate(value) || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value))) return `Fecha/hora por revisar: ${value}`
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? `Fecha/hora por revisar: ${String(value)}` : `${parsed.toISOString()} UTC`
}
const count = (value: number) => value.toLocaleString("es-MX")
const quantity = (value: number, singular: string, plural: string) => `${count(value)} ${value === 1 ? singular : plural}`
const answer = (value: string | null | undefined) => ({ si: "Sí", no: "No", na: "No aplica", "no-aplica": "No aplica", pendiente: "Pendiente" })[value || ""] || "Sin respuesta"
const table = (title: string, labels: string[], rows: Array<Array<string | number | null>>, emptyMessage = "Sin registros en este alcance."): Section => ({
  title, table: { columns: labels.map(label => ({ label })), rows, emptyMessage },
})
const localDisclaimer = "Reporte de información capturada. No constituye certificación de cumplimiento, opinión de auditor independiente ni aceptación de una autoridad."
const stateBars = (title: string, total: number, values: Array<[string, number]>): Section => ({
  title, bars: values.map(([label, value]) => ({ label, value: total ? value : null, max: total || 1, valueLabel: total ? `${count(value)} de ${quantity(total, "registro", "registros")}` : "Sin registros", tone: "primary" })),
})

interface TrainingDocument { id: string; name: string; category: string; uploadedAt: string; uploadedBy: string; sha256?: string; notes?: string; sessionId?: string; employeeId?: string; dataUrl?: string }
interface TrainingSession { id: string; title: string; date: string; modality: string; durationHours: number; topicsSummary: string; attendees: string[]; evaluationApplied?: boolean; observations?: string; attendanceDocumentId?: string; temarioDocumentId?: string; materialsDocumentIds: string[]; evaluationDocumentId?: string }
interface TrainingEmployee { id: string; name: string; role: string; department: string; hireDate: string; criticalRole?: boolean; lastTrainingDate?: string; needsInitialTraining?: boolean; certificates: string[]; history: { sessionId: string; sessionTitle: string; date: string; certificateId?: string }[] }
interface TrainingState {
  trainingPlan: { year: string; approvedBy: string; approvalDate: string; objectives: string; coverage: string; planDocumentId?: string; schedule: { month: string; topic: string; audience: string }[] } | null
  sessions: TrainingSession[]; employees: TrainingEmployee[]; documents: TrainingDocument[]
  officialCompliance: { name: string; lastCertificationDate?: string; certificateDocumentId?: string }
  traceability: { action: string; details: string; user: string; timestamp: string }[]
  checklistAnswers: Record<string, { answer?: string; notes?: string; evidenceId?: string }>; moduleClosed: boolean
}

export function buildTrainingProfessionalReport(state: TrainingState, questions: readonly { id: string; section: string; question: string }[]): ProfessionalReport {
  const pending = state.employees.filter(employee => employee.needsInitialTraining === true).length
  const undated = state.employees.filter(employee => !employee.lastTrainingDate).length
  const captured = questions.filter(question => Boolean(state.checklistAnswers[question.id]?.answer)).length
  const documentNames = new Map(state.documents.map(document => [document.id, document.name]))
  const employeeNames = new Map(state.employees.map(employee => [employee.id, employee.name]))
  const documentName = (id?: string) => id ? documentNames.get(id) || `Referencia: ${id}` : "No vinculado"
  const employeeName = (id: string) => employeeNames.get(id) || `ID: ${id}`
  const sections: Section[] = [
    stateBars("Cobertura documental del personal", state.employees.length, [["Inducción pendiente", pending], ["Sin fecha de capacitación", undated], ["Con fecha registrada", state.employees.length - undated]]),
    { title: "Plan anual", paragraphs: state.trainingPlan ? [
      `Periodo: ${text(state.trainingPlan.year)}. Aprobación registrada: ${text(state.trainingPlan.approvedBy)}; fecha: ${date(state.trainingPlan.approvalDate)}.`,
      `Objetivos: ${text(state.trainingPlan.objectives)}`, `Cobertura: ${text(state.trainingPlan.coverage)}`, `Documento: ${documentName(state.trainingPlan.planDocumentId)}`,
    ] : ["No existe un plan anual registrado. Esta ausencia no se interpreta como cumplimiento."] },
    table("Calendario completo del plan", ["Mes", "Tema", "Público"], (state.trainingPlan?.schedule || []).map(item => [text(item.month), text(item.topic), text(item.audience)])),
    table("Sesiones registradas", ["Sesión / ID", "Fecha", "Modalidad / horas", "Participantes"], state.sessions.map(session => [
      `${session.title}\n${session.id}`, date(session.date), `${text(session.modality)} / ${Number.isFinite(session.durationHours) ? session.durationHours : missing}`, session.attendees.length,
    ])),
    ...state.sessions.map((session): Section => ({ title: `Sesión: ${session.title}`, paragraphs: [
      `ID: ${session.id}. Fecha: ${date(session.date)}. Temario: ${text(session.topicsSummary)}`, `Participantes: ${session.attendees.map(employeeName).join("; ") || "Sin participantes registrados"}`,
      `Evaluación aplicada: ${session.evaluationApplied === true ? "Sí" : session.evaluationApplied === false ? "No" : missing}. Evidencia: ${documentName(session.evaluationDocumentId)}`,
      `Asistencia: ${documentName(session.attendanceDocumentId)}. Temario: ${documentName(session.temarioDocumentId)}. Materiales: ${session.materialsDocumentIds.map(id => documentName(id)).join("; ") || "No vinculados"}`,
      `Observaciones: ${text(session.observations, "Sin observaciones capturadas")}`,
    ] })),
    table("Personal e inducción", ["Persona / ID", "Puesto / área", "Ingreso", "Última capacitación", "Inducción", "Puesto crítico"], state.employees.map(employee => [
      `${employee.name}\n${employee.id}`, `${text(employee.role)} / ${text(employee.department)}`, date(employee.hireDate), date(employee.lastTrainingDate), employee.needsInitialTraining === true ? "Pendiente" : employee.needsInitialTraining === false ? "No marcada como pendiente" : missing,
      employee.criticalRole === true ? "Sí" : employee.criticalRole === false ? "No" : missing,
    ])),
    table("Historial completo por persona", ["Persona", "Sesión", "Fecha", "Constancia"], state.employees.flatMap(employee => employee.history.map(entry => [employee.name, `${entry.sessionTitle}\n${entry.sessionId}`, date(entry.date), documentName(entry.certificateId)]))),
    table("Constancias vinculadas al personal", ["Persona", "Constancia", "Puesto crítico"], state.employees.flatMap(employee => employee.certificates.map(id => [employee.name, documentName(id), employee.criticalRole === true ? "Sí" : employee.criticalRole === false ? "No" : missing]))),
    { title: "Representante encargado de cumplimiento", paragraphs: [`Nombre: ${text(state.officialCompliance.name)}`, `Capacitación registrada: ${date(state.officialCompliance.lastCertificationDate)}. Documento: ${documentName(state.officialCompliance.certificateDocumentId)}.`], note: "La fecha y el archivo documentan una captura; no acreditan por sí solos certificación o vigencia legal." },
    table("Cuestionario y evidencias", ["Sección / pregunta", "Respuesta", "Notas", "Evidencia"], questions.map(question => { const response = state.checklistAnswers[question.id]; return [`${question.section}. ${question.question}`, answer(response?.answer), text(response?.notes, "Sin notas"), documentName(response?.evidenceId)] })),
    table("Documentos de capacitación", ["Documento / ID", "Categoría / vínculo", "Carga / autor", "Integridad / notas"], state.documents.map(document => [
      `${document.name}\n${document.id}`, `${document.category}\n${document.sessionId || document.employeeId || "Sin vínculo específico"}`, `${timestamp(document.uploadedAt)} / ${text(document.uploadedBy)}`, `SHA-256: ${text(document.sha256)}\n${text(document.notes, "Sin notas")}\n${document.dataUrl ? "Referencia de archivo registrada" : "Sin referencia de archivo"}`,
    ])),
    table("Trazabilidad del módulo", ["Fecha/hora UTC", "Acción", "Usuario", "Detalle"], state.traceability.map(entry => [timestamp(entry.timestamp), entry.action, entry.user, entry.details])),
  ]
  return { title: "Capacitación y control interno", subtitle: "Plan, ejecución y evidencia documental", scopeLabel: "Empresa activa; todos los registros del módulo, sin recorte de sesiones o personal", period: state.trainingPlan?.year || "Periodo no capturado", summary: [
    `${quantity(state.sessions.length, "sesión registrada", "sesiones registradas")} y ${quantity(state.employees.length, "persona registrada", "personas registradas")}; ${count(pending)} con inducción marcada pendiente y ${count(undated)} sin fecha de capacitación.`,
    `${count(captured)} de ${quantity(questions.length, "pregunta", "preguntas")} ${captured === 1 ? "tiene" : "tienen"} respuesta capturada. Revisión interna: ${state.moduleClosed ? "cierre registrado" : "abierta"}; no equivale a aprobación normativa.`,
  ], metrics: [{ label: "Sesiones", value: count(state.sessions.length) }, { label: "Personal", value: count(state.employees.length) }, { label: "Inducción pendiente", value: count(pending) }, { label: "Documentos", value: count(state.documents.length) }], sections, sources: ["Captura vigente de Capacitación: pld-training-module. Cuestionario y documentos vinculados de la empresa activa."], disclaimers: [localDisclaimer], filename: "reporte-capacitacion-control.pdf" }
}

interface GovernanceQuestion { id: string; category: string; question: string; legalReference: string; answer: string | null; required: boolean; relatedDocuments: string[]; notes?: string; actionPlan?: string }
interface GovernanceDocument { id: string; name: string; fileName: string; documentType: string; uploadDate: string; issueDate: string; expiryDate?: string; retentionUntil: string; status: string; hash: string; base64: string; archived?: boolean; notes?: string; signedBy?: string; signedAt?: string }
export function buildGovernanceProfessionalReport(input: {
  questions: GovernanceQuestion[]; documents: GovernanceDocument[]; expedienteCerrado: boolean
  manualVersions: { version: number; folio: string; uploadedAt: string; documentId: string; summary: string }[]
  committeeSessions: { sessionNumber: string; sessionDate: string; attendees: string[]; agreements: { agreement: string; responsible: string; deadline: string; status: string }[]; notes?: string; documentId?: string }[]
  alerts: { title: string; description: string; targetDate: string; responsible: string; lastReminder?: string }[]
  trace: { timestamp: string; action: string; section: string; user: string; details?: string }[]
}): ProfessionalReport {
  const { questions, documents } = input
  const yes = questions.filter(question => question.answer === "si").length
  const no = questions.filter(question => question.answer === "no").length
  const na = questions.filter(question => question.answer === "no-aplica").length
  const unanswered = questions.length - yes - no - na
  const documentNames = new Map(documents.map(document => [document.id, document.fileName]))
  const documentName = (id: string) => documentNames.get(id) || `Referencia: ${id}`
  return { title: "Gobernanza y control interno", subtitle: "Respuestas, documentación y acciones pendientes", scopeLabel: "Empresa activa; cuestionario completo, documentos activos y archivados", summary: [
    `${quantity(questions.length, "control", "controles")}: ${quantity(yes, "respuesta afirmativa", "respuestas afirmativas")}, ${quantity(no, "negativa", "negativas")}, ${count(na)} no aplica y ${count(unanswered)} sin respuesta.`,
    `${quantity(questions.filter(question => Boolean(question.actionPlan?.trim())).length, "plan capturado", "planes capturados")}. Un plan no transforma una respuesta negativa en cumplimiento. Revisión interna ${input.expedienteCerrado ? "con cierre registrado" : "abierta"}.`,
  ], metrics: [{ label: "Controles", value: count(questions.length) }, { label: "Sin respuesta", value: count(unanswered) }, { label: "Documentos", value: count(documents.length) }, { label: "Sesiones de comité", value: count(input.committeeSessions.length) }], sections: [
    stateBars("Distribución de respuestas capturadas", questions.length, [["Sí", yes], ["No", no], ["No aplica", na], ["Sin respuesta", unanswered]]),
    ...questions.map((question): Section => ({ title: `${question.category}: ${question.question}`, paragraphs: [
      `ID: ${question.id}. Respuesta: ${answer(question.answer)}. Campo obligatorio en el cuestionario: ${question.required ? "Sí" : "No"}.`,
      `Referencia mostrada en el módulo: ${text(question.legalReference)}`, `Notas / justificación: ${text(question.notes, "Sin notas capturadas")}`, `Plan de acción: ${text(question.actionPlan, "Sin plan capturado")}`,
      `Evidencias vinculadas: ${question.relatedDocuments.map(id => documentName(id)).join("; ") || "Ninguna"}`,
    ] })),
    table("Inventario documental completo", ["Documento / ID", "Fechas", "Estado / firma interna", "Integridad / notas"], documents.map(document => [
      `${document.name}\n${document.fileName}\n${document.id}`, `Emisión: ${date(document.issueDate)}\nCarga: ${timestamp(document.uploadDate)}\nVencimiento: ${date(document.expiryDate)}\nConservación: ${date(document.retentionUntil)}`, `${document.archived ? "Archivado" : "Activo"}; ${document.status}\nAprobación interna: ${text(document.signedBy, "No registrada")} / ${timestamp(document.signedAt)}`, `SHA-256: ${text(document.hash)}\n${document.base64 ? "Referencia de archivo registrada" : "Sin referencia de archivo"}\n${text(document.notes, "Sin notas")}`,
    ])),
    table("Versiones de manuales", ["Versión / folio", "Carga UTC", "Documento", "Resumen del cambio"], input.manualVersions.map(version => [String(version.version) + " / " + version.folio, timestamp(version.uploadedAt), documentName(version.documentId), version.summary])),
    ...input.committeeSessions.map((session): Section => ({ title: `Comité: sesión ${session.sessionNumber}`, paragraphs: [`Fecha: ${date(session.sessionDate)}. Participantes: ${session.attendees.join("; ") || "Sin captura"}.`, `Notas: ${text(session.notes, "Sin notas")}. Documento: ${session.documentId ? documentName(session.documentId) : "No vinculado"}.`], table: { columns: [{ label: "Acuerdo" }, { label: "Responsable" }, { label: "Fecha compromiso" }, { label: "Estado" }], rows: session.agreements.map(agreement => [agreement.agreement, agreement.responsible, date(agreement.deadline), agreement.status]), emptyMessage: "Sin acuerdos registrados." } })),
    table("Recordatorios y seguimiento", ["Recordatorio", "Responsable / fecha", "Detalle", "Último registro local UTC"], input.alerts.map(alert => [alert.title, `${alert.responsible} / ${date(alert.targetDate)}`, alert.description, timestamp(alert.lastReminder)])),
    table("Trazabilidad", ["Fecha/hora UTC", "Sección / acción", "Usuario", "Detalle"], input.trace.map(entry => [timestamp(entry.timestamp), `${entry.section} / ${entry.action}`, entry.user, text(entry.details, "Sin detalle")])),
  ], sources: ["Captura vigente de Gobernanza: gobernanza-control-data. Las referencias de cada pregunta se reproducen sin una nueva revisión normativa."], disclaimers: [localDisclaimer, "Las aprobaciones y cierres son registros internos; los recordatorios locales no acreditan el envío de correo."], filename: "gobernanza-control.pdf" }
}

interface EvidenceVersion { version: number; timestamp: string; user: string; changeNote: string; fileData?: string; fileName?: string; fileSize?: number; fileType?: string; sha256?: string; objectReference?: string; documentDate?: string }
interface ReportEvidence { id: string; expedienteId: string; module: string; submodule: string; documentType: string; title: string; notes?: string; uploadDate: string; documentDate: string; user: string; fileName: string; fileSize: number; fileType: string; fileData?: string; sha256?: string; reviewStatus?: string; reviewNote?: string; reviewedHash?: string; reviewedAt?: string; version: number; versionHistory: EvidenceVersion[]; archived: boolean; source?: string; sourceId?: string; sourceRevision?: string; sourceReference?: { storageKey: string; recordId: string; kind: string; documentId?: string }; legalHold?: boolean }
const evidenceReview = (document: ReportEvidence) => document.reviewStatus === "approved"
  ? document.sha256 && document.reviewedHash === document.sha256 ? "Aprobada para el hash actual" : "Aprobación registrada; hash por confirmar"
  : document.reviewStatus === "rejected" ? "Rechazada" : document.reviewStatus === "pending" ? "Pendiente de revisión" : "Sin revisión registrada"

export function buildEvidenceProfessionalReport(input: { expedienteId: string; documents: ReportEvidence[]; logs: { documentId: string; timestamp: string; action: string; user: string; details: string }[]; moduleName: (module: string) => string; retentionLabel: (document: ReportEvidence) => string }): ProfessionalReport {
  const { documents } = input
  const approved = documents.filter(document => document.reviewStatus === "approved" && Boolean(document.sha256) && document.reviewedHash === document.sha256).length
  const rejected = documents.filter(document => document.reviewStatus === "rejected").length
  const pending = documents.filter(document => document.reviewStatus === "pending").length
  const unverified = documents.length - approved - rejected - pending
  const documentIds = new Set(documents.map(document => document.id))
  const logs = input.logs.filter(log => documentIds.has(log.documentId))
  return { title: "Expediente de evidencias", subtitle: input.expedienteId, scopeLabel: `Empresa activa; expediente ${input.expedienteId}; todos sus módulos y documentos, incluidos los archivados`, summary: [
    `${quantity(documents.length, "documento", "documentos")}: ${quantity(documents.filter(document => document.archived).length, "archivado", "archivados")} y ${quantity(documents.filter(document => !document.archived).length, "activo", "activos")}.`,
    `${quantity(approved, "revisión aprobada", "revisiones aprobadas")} para el hash actual; ${quantity(pending, "pendiente", "pendientes")}, ${quantity(rejected, "rechazada", "rechazadas")} y ${count(unverified)} sin revisión verificable. Una referencia de archivo no equivale a aprobación.`,
  ], metrics: [{ label: "Documentos", value: count(documents.length) }, { label: "Versiones históricas", value: count(documents.reduce((sum, document) => sum + document.versionHistory.length, 0)) }, { label: "Aprobados / hash", value: count(approved) }, { label: "Eventos", value: count(logs.length) }], sections: [
    stateBars("Estado de revisión documental", documents.length, [["Aprobación para hash actual", approved], ["Pendiente", pending], ["Rechazada", rejected], ["Sin revisión verificable", unverified]]),
    ...documents.map((document): Section => ({ title: `${input.moduleName(document.module)}: ${document.title}`, paragraphs: [
      `Documento ${document.id}; versión actual ${document.version}. Archivo: ${document.fileName}; tipo: ${document.fileType}; tamaño registrado: ${count(document.fileSize)} bytes.`,
      `Submódulo: ${document.submodule}. Tipo documental: ${document.documentType}. Autor: ${document.user}. Fecha documental: ${date(document.documentDate)}; carga: ${timestamp(document.uploadDate)}.`,
      `Estado: ${document.archived ? "Archivado" : "Activo"}. Conservación: ${input.retentionLabel(document)}. Retención precautoria: ${document.legalHold ? "Sí" : "No registrada"}.`,
      `Revisión: ${evidenceReview(document)}. Fecha de revisión: ${timestamp(document.reviewedAt)}. Nota: ${text(document.reviewNote, "Sin nota")}`, `Notas del documento: ${text(document.notes, "Sin notas")}`,
      `SHA-256: ${text(document.sha256)}. Hash revisado: ${text(document.reviewedHash)}. ${document.fileData ? "Referencia de archivo actual registrada" : "Sin referencia de archivo actual"}.`,
      `Origen: ${text(document.source, "Manual / no especificado")}; ID: ${text(document.sourceId)}; revisión: ${text(document.sourceRevision)}. Referencia: ${document.sourceReference ? `${document.sourceReference.storageKey} / ${document.sourceReference.recordId} / ${document.sourceReference.kind} / ${document.sourceReference.documentId || "Sin documento específico"}` : "No registrada"}.`,
    ], table: { columns: [{ label: "Versión / registro UTC" }, { label: "Autor / cambio" }, { label: "Archivo / referencia" }, { label: "SHA-256" }], rows: document.versionHistory.map(version => [`${version.version} / ${timestamp(version.timestamp)}\nDocumento: ${date(version.documentDate)}`, `${version.user}\n${version.changeNote}`, `${text(version.fileName)}\n${version.fileSize === undefined ? "Tamaño sin dato" : count(version.fileSize) + " bytes"}\n${version.fileData || version.objectReference ? "Referencia histórica registrada" : "Sin referencia de archivo"}`, text(version.sha256)]), emptyMessage: "Sin versiones históricas registradas." } })),
    table("Trazabilidad del expediente", ["Fecha/hora UTC", "Documento / acción", "Usuario", "Detalle"], logs.map(log => [timestamp(log.timestamp), `${log.documentId} / ${log.action}`, log.user, log.details])),
  ], sources: ["Metadatos y trazabilidad de la empresa activa: pld-evidences-documents y pld-evidences-logs. Estado de conservación calculado por el motor vigente del módulo."], disclaimers: [localDisclaimer, "Este inventario no contiene los archivos adjuntos ni demuestra su disponibilidad remota. Archivar no significa eliminar ni autoriza destruir documentos."], filename: `expediente-${input.expedienteId}.pdf` }
}

interface AuditRecord { id: string; date: ReportDate; scope: string[]; findings: string; responsible: string; status: string; followUpDue?: ReportDate }
interface AuditPlan { id: string; source: string; action: string; responsible: string; deadline: ReportDate; status: string; progress?: number }
interface AuthorityRecord { id: string; authority: string; receivedAt: ReportDate; dueDate: ReportDate; respondedAt?: ReportDate; status: string; responsible: string; documents: string[] }
const auditTable = (records: AuditRecord[]) => table("Bitácora íntegra de auditorías internas", ["ID / fecha", "Alcance", "Hallazgos", "Responsable / estado", "Seguimiento"], records.map(record => [`${record.id}\n${date(record.date)}`, record.scope.join("; "), record.findings, `${record.responsible}\n${record.status}`, date(record.followUpDue)]))
const planTable = (plans: AuditPlan[]) => table("Planes de acción completos", ["ID / origen", "Acción", "Responsable / fecha", "Estado / avance registrado"], plans.map(plan => [`${plan.id}\n${plan.source}`, plan.action, `${plan.responsible}\n${date(plan.deadline)}`, `${plan.status}\n${Number.isFinite(plan.progress) ? plan.progress + "%" : "Sin avance capturado"}`]))
const authorityTable = (requests: AuthorityRecord[]) => table("Observaciones y requerimientos de autoridad", ["ID / autoridad", "Recepción / vencimiento", "Responsable / estado", "Respuesta", "Documentos vinculados"], requests.map(request => [`${request.id}\n${request.authority}`, `${date(request.receivedAt)} / ${date(request.dueDate)}`, `${request.responsible}\n${request.status}`, date(request.respondedAt), request.documents.join("; ") || "Sin documentos vinculados"]))

export function buildInternalAuditsProfessionalReport(records: AuditRecord[]): ProfessionalReport {
  const closed = records.filter(record => record.status === "Cerrado").length
  return { title: "Auditorías internas", subtitle: "Bitácora de hallazgos y seguimiento", scopeLabel: "Empresa activa; todos los registros de la bitácora, sin filtro temporal", summary: [`${quantity(records.length, "auditoría registrada", "auditorías registradas")}; ${count(closed)} con cierre y ${count(records.length - closed)} en otros estados. El cierre capturado no sustituye la revisión de evidencia.`], metrics: [{ label: "Auditorías", value: count(records.length) }, { label: "Cierre registrado", value: count(closed) }, { label: "Otros estados", value: count(records.length - closed) }], sections: [stateBars("Estados de la bitácora", records.length, [["Cerrado", closed], ["En seguimiento", records.filter(record => record.status === "En seguimiento").length], ["Abierto", records.filter(record => record.status === "Abierto").length]]), auditTable(records)], sources: ["Bitácora vigente de la empresa activa: auditoria-interna-registros."], disclaimers: [localDisclaimer], filename: "auditorias-internas.pdf" }
}

export function buildFormalAuditProfessionalReport(input: {
  context: { sujetoObligado: string; rfc: string; actividadVulnerable: string; periodoRevision: string; totalOperaciones: number; montoOperado: number; ultimaActualizacion: Date | null }
  sections: readonly { title: string; foundation: string; questions: readonly { id: string; text: string; ref: string }[] }[]
  answers: Record<string, { rating: string; findings: string; recommendations: string }>
  controlQuestions: readonly { id: string; question: string; relatedArticle?: string }[]
  responses: Record<string, { answer: string; evidences: { id: string; fileName: string; uploadedAt: ReportDate; fileSize: number }[] }>
  scopeItems: readonly { id: string; label: string }[]; scopeAnswers: Record<string, string>; scopeExclusions: string
  checklist: readonly { id: string; label: string; completed: boolean }[]
  audits: AuditRecord[]; requests: AuthorityRecord[]; plans: AuditPlan[]
  versions: { version: string; date: Date; approvedBy: string; notes?: string }[]; source: string
}): ProfessionalReport {
  const questions = input.sections.flatMap(section => section.questions)
  const evaluated = questions.filter(question => Boolean(input.answers[question.id]?.rating)).length
  const unknown = questions.length - evaluated
  const ratingLabels: Record<string, string> = { cumple: "Cumple (capturado)", "cumple-mayor": "Cumple mayormente (capturado)", "cumple-parcial": "Cumple parcialmente (capturado)", "no-cumple": "No cumple (capturado)", "no-aplica": "No aplica (capturado)" }
  return { title: "Informe de auditoría PLD", subtitle: "Revisión documental y seguimiento capturado", scopeLabel: "Empresa activa; alcance y exclusiones declarados en el cuestionario; se incluyen todos los reactivos y registros", period: input.context.periodoRevision, summary: [
    `${count(evaluated)} de ${quantity(questions.length, "reactivo", "reactivos")} con calificación; ${count(unknown)} sin evaluar. No se presume un resultado favorable cuando falta una respuesta.`,
    `${quantity(input.audits.length, "auditoría interna", "auditorías internas")}, ${quantity(input.requests.length, "requerimiento", "requerimientos")} y ${quantity(input.plans.length, "plan de acción", "planes de acción")}. Los estados son los registrados por el equipo, no una opinión independiente automatizada.`,
  ], metrics: [{ label: "Reactivos evaluados", value: `${evaluated} / ${questions.length}` }, { label: "Sin evaluar", value: count(unknown) }, { label: "Requerimientos", value: count(input.requests.length) }, { label: "Planes", value: count(input.plans.length) }], sections: [
    stateBars("Cobertura de evaluación", questions.length, [["Con calificación", evaluated], ["Sin evaluar", unknown]]),
    { title: "Contexto de integración", paragraphs: [`Sujeto detectado: ${input.context.sujetoObligado}; RFC: ${input.context.rfc}. Actividad: ${input.context.actividadVulnerable}.`, `Operaciones vinculadas: ${input.context.ultimaActualizacion ? count(input.context.totalOperaciones) : missing}. Monto MXN: ${input.context.ultimaActualizacion ? new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(input.context.montoOperado) : missing}. Actualización de origen: ${timestamp(input.context.ultimaActualizacion)}.`], note: "El contexto de integración se distingue de las conclusiones de auditoría. Los importes no acreditan revisión de las operaciones." },
    table("Alcance declarado", ["Elemento", "Selección capturada"], input.scopeItems.map(item => [item.label, answer(input.scopeAnswers[item.id])])),
    { title: "Exclusiones y limitaciones capturadas", paragraphs: [text(input.scopeExclusions, "Sin justificación de exclusiones capturada.")] },
    ...input.sections.map((section): Section => ({ title: section.title, paragraphs: [`Referencia del cuestionario: ${section.foundation}`], table: { columns: [{ label: "Reactivo / referencia" }, { label: "Calificación capturada" }, { label: "Hallazgos" }, { label: "Recomendaciones" }], rows: section.questions.map(question => { const response = input.answers[question.id]; return [`${question.id}: ${question.text}\n${question.ref}`, ratingLabels[response?.rating] || "Sin evaluar", text(response?.findings, "Sin hallazgos capturados"), text(response?.recommendations, "Sin recomendación capturada")] }), emptyMessage: "Sin reactivos definidos." } })),
    auditTable(input.audits), authorityTable(input.requests), planTable(input.plans),
    table("Lineamientos y versiones", ["Versión", "Fecha", "Aprobación registrada", "Notas"], input.versions.map(version => [version.version, date(version.date), version.approvedBy, text(version.notes, "Sin notas")])),
    table("Controles operativos y evidencias", ["Pregunta / referencia", "Respuesta", "Evidencias completas"], input.controlQuestions.map(question => { const response = input.responses[question.id]; return [`${question.question}\n${question.relatedArticle || "Sin referencia específica"}`, answer(response?.answer), response?.evidences.map(evidence => `${evidence.fileName} (${evidence.id}; ${timestamp(evidence.uploadedAt)}; ${count(evidence.fileSize)} bytes)`).join("\n") || "Sin evidencias vinculadas"] })),
    table("Checklist de emisión", ["Elemento", "Confirmación interna"], input.checklist.map(item => [item.label, item.completed ? "Confirmado" : "Pendiente de confirmar"])),
  ], sources: ["Captura autorizada de Auditoría: lineamientos, registros internos, requerimientos, planes y workflow de la empresa activa.", input.source, ...new Set(input.sections.map(section => section.foundation))], disclaimers: [localDisclaimer, "Las referencias normativas son las del cuestionario vigente de la plataforma. Este cambio de presentación no incorpora una nueva revisión normativa ni una conclusión favorable automática."], filename: "informe-auditoria-pld.pdf" }
}

export function buildKycBlankProfessionalReport(template: { title: string; code: string; sections: { title: string; fields: string[] }[] }): ProfessionalReport {
  return { title: template.title, subtitle: template.code, scopeLabel: "Plantilla de captura en blanco; no corresponde a un expediente identificado", summary: ["Formato auxiliar para captura documental. Los espacios vacíos no representan información verificada ni cumplimiento."], sections: [
    ...template.sections.map((section): Section => ({ title: section.title, paragraphs: section.fields.map(field => `${field}: ______________________________________________________________`) })),
    { title: "Declaración y firma", paragraphs: ["Declaracion: la persona cliente o usuaria manifiesta bajo protesta de decir verdad que la informacion proporcionada es completa y veraz, y autoriza su uso para fines de cumplimiento PLD.", "Nombre y firma: ________________________________", "Fecha: ____ / ____ / ______"] },
  ], sources: [`Plantilla interna de identificación ${template.code}, campos vigentes del módulo de Auditoría.`], disclaimers: ["Formato auxiliar interno; no sustituye los formatos y documentos aplicables ni acredita una captura completa."], filename: `${template.code.toLowerCase()}.pdf` }
}
