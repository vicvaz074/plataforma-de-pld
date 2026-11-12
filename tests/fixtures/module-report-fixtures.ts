import {
  buildEvidenceProfessionalReport,
  buildFormalAuditProfessionalReport,
  buildGovernanceProfessionalReport,
  buildInternalAuditsProfessionalReport,
  buildKycBlankProfessionalReport,
  buildTrainingProfessionalReport,
} from "../../lib/pld/module-reports"

export const trainingQuestions = [
  { id: "plan", section: "A", question: "¿Se documentó el plan de capacitación?" },
  { id: "seguimiento", section: "B", question: "¿Existe seguimiento completo de las constancias?" },
]
export function trainingFixture(size = 3): Parameters<typeof buildTrainingProfessionalReport>[0] {
  return {
    trainingPlan: { year: "2026", approvedBy: "Comité ficticio QA", approvalDate: "2026-01-15", objectives: "Acreditar la captura íntegra, no cumplimiento real.", coverage: "Personal ficticio del escenario de prueba.", schedule: [{ month: "Noviembre", topic: "Identificación y evidencia", audience: "Equipo QA" }], planDocumentId: "doc-plan" },
    sessions: Array.from({ length: size }, (_, index) => ({ id: `sesion-${index}`, title: `Sesión ficticia ${index}`, date: "2026-11-11", modality: "Presencial", durationHours: 2, topicsSummary: `Contenido completo del temario ${index}: identificación, beneficiario controlador y resguardo de información.`, attendees: [`persona-${index}`], evaluationApplied: index % 2 === 0, materialsDocumentIds: [], observations: `Nota final de sesión ${index}` })),
    employees: Array.from({ length: size }, (_, index) => ({ id: `persona-${index}`, name: `Persona ficticia ${index}`, role: "Captura", department: "Equipo QA", hireDate: "2026-01-01", criticalRole: index % 2 === 0, lastTrainingDate: index % 2 ? "2026-11-11" : undefined, needsInitialTraining: index % 2 === 0, certificates: [`constancia-${index}`], history: [{ sessionId: `sesion-${index}`, sessionTitle: `Sesión ficticia ${index}`, date: "2026-11-11", certificateId: `constancia-${index}` }] })),
    documents: [{ id: "doc-plan", name: "Plan ficticio aprobado.pdf", category: "plan", uploadedAt: "2026-01-15T12:00:00Z", uploadedBy: "QA", sha256: "hash-ficticio-plan", notes: "Documento de prueba, no evidencia real.", dataUrl: "referencia-ficticia" }],
    officialCompliance: { name: "Representante ficticio QA", lastCertificationDate: "2026-11-11" }, traceability: [{ action: "Captura de prueba", details: "Escenario ficticio para comprobar el reporte completo.", user: "QA", timestamp: "2026-11-11T12:00:00Z" }],
    checklistAnswers: { plan: { answer: "si", notes: "Aprobación registrada sólo como prueba.", evidenceId: "doc-plan" } }, moduleClosed: false,
  }
}

export function governanceFixture(): Parameters<typeof buildGovernanceProfessionalReport>[0] {
  return {
    questions: [{ id: "control-1", category: "Designación", question: "¿Se documentó la designación del responsable?", legalReference: "Referencia del cuestionario de prueba", answer: "no", required: true, relatedDocuments: ["gob-doc"], notes: "Existe una captura parcial que debe revisar la persona responsable.", actionPlan: "Solicitar validación documental y registrar fecha de conclusión." }, { id: "control-2", category: "Seguimiento", question: "¿Existe evidencia de seguimiento?", legalReference: "Referencia del cuestionario de prueba", answer: null, required: true, relatedDocuments: [] }],
    documents: [{ id: "gob-doc", name: "Documento de prueba", fileName: "documento-ficticio.pdf", documentType: "oficial", uploadDate: "2026-11-11T12:00:00Z", issueDate: "2026-11-01", retentionUntil: "2036-11-01", status: "vigente", hash: "hash-ficticio", base64: "referencia-ficticia", notes: "No acredita cumplimiento real." }],
    expedienteCerrado: false, manualVersions: [{ version: 1, folio: "QA-001", uploadedAt: "2026-11-11", documentId: "gob-doc", summary: "Versión inicial ficticia." }],
    committeeSessions: [{ sessionNumber: "QA-01", sessionDate: "2026-11-11", attendees: ["Integrante ficticio A", "Integrante ficticio B"], agreements: [{ agreement: "Revisar la documentación del escenario.", responsible: "Responsable ficticio", deadline: "2026-11-30", status: "pendiente" }], notes: "Acta exclusivamente de prueba.", documentId: "gob-doc" }],
    alerts: [{ title: "Revisión documental de prueba", description: "Recordatorio local; no acredita envío externo.", targetDate: "2026-11-30", responsible: "QA" }], trace: [{ timestamp: "2026-11-11T12:00:00Z", action: "Captura ficticia", section: "Designación", user: "QA", details: "Registro de prueba para verificar el detalle exportado." }],
  }
}

export function evidenceFixture(): Parameters<typeof buildEvidenceProfessionalReport>[0] {
  return {
    expedienteId: "EXPEDIENTE-FICTICIO-QA", moduleName: module => `Módulo ${module}`, retentionLabel: () => "Fecha inicial pendiente de confirmar",
    documents: [{ id: "evidencia-qa", expedienteId: "EXPEDIENTE-FICTICIO-QA", module: "kyc", submodule: "persona-fisica", documentType: "identificacion", title: "Identificación ficticia", notes: "Contenido de prueba; no contiene un documento de una persona real.", uploadDate: "2026-11-11T12:00:00Z", documentDate: "2026-11-01", user: "QA", fileName: "identificacion-ficticia.pdf", fileSize: 1000, fileType: "application/pdf", fileData: "referencia-ficticia", sha256: "hash-actual", reviewStatus: "pending", version: 2, archived: false, source: "manual", versionHistory: [{ version: 1, timestamp: "2026-10-01T12:00:00Z", user: "QA", changeNote: "Sustitución de archivo ficticio.", fileName: "identificacion-ficticia-v1.pdf", fileSize: 900, fileType: "application/pdf", sha256: "hash-anterior", objectReference: "objeto-historico-ficticio" }] }],
    logs: [{ documentId: "evidencia-qa", timestamp: "2026-11-11T12:00:00Z", action: "upload", user: "QA", details: "Versión 2 registrada en el escenario ficticio." }],
  }
}

export function auditFixture(): Parameters<typeof buildFormalAuditProfessionalReport>[0] {
  return {
    context: { sujetoObligado: "EMPRESA FICTICIA QA SA DE CV", rfc: "EQA261111AA1", actividadVulnerable: "Escenario de prueba documental", periodoRevision: "Noviembre de 2026", totalOperaciones: 1, montoOperado: 10_000_000.01, ultimaActualizacion: new Date("2026-11-11T12:00:00Z") },
    sections: [{ title: "Revisión de prueba completa", foundation: "Cuestionario interno del escenario ficticio", questions: Array.from({ length: 7 }, (_, index) => ({ id: `reactivo-${index}`, text: `Pregunta completa ${index}: ¿Existe evidencia documental verificable?`, ref: `Referencia interna QA-${index}` })) }],
    answers: { "reactivo-0": { rating: "cumple-parcial", findings: "Se requiere verificar la versión final del documento.", recommendations: "Solicitar evidencia completa y registrar responsable y fecha." } },
    controlQuestions: [{ id: "control-qa", question: "¿Se conservaron las evidencias del escenario?" }], responses: { "control-qa": { answer: "", evidences: [{ id: "audit-evidencia", fileName: "evidencia-ficticia.pdf", uploadedAt: "2026-11-11T12:00:00Z", fileSize: 1200 }] } },
    scopeItems: [{ id: "alcance-qa", label: "Identificación documental del escenario" }], scopeAnswers: { "alcance-qa": "si" }, scopeExclusions: "No se evaluó cumplimiento real ni se presentó un archivo ante la autoridad.", checklist: [{ id: "cierre-qa", label: "Conclusión revisada por una persona responsable", completed: false }],
    audits: [{ id: "AUDIT-QA", date: "2026-11-11", scope: ["Identificación", "Evidencias"], findings: "Hallazgo ficticio íntegro para demostrar la conservación de su texto.", responsible: "Auditor ficticio QA", status: "En seguimiento", followUpDue: "2026-11-30" }],
    requests: [{ id: "REQUERIMIENTO-FICTICIO", authority: "SAT", receivedAt: "2026-11-01", dueDate: "2026-11-30", responsible: "QA", status: "Pendiente", documents: ["oficio-ficticio.pdf", "anexo-ficticio.pdf"] }],
    plans: [{ id: "PLAN-QA", source: "AUDIT-QA", action: "Revisar y completar la evidencia de prueba.", responsible: "Responsable ficticio", deadline: "2026-11-30", status: "Pendiente", progress: 0 }], versions: [{ version: "QA-1", date: new Date("2026-11-11T12:00:00Z"), approvedBy: "Comité ficticio", notes: "Versión de prueba." }], source: "Cuestionario capturado; no es una fuente normativa nueva.",
  }
}

export function moduleReportFixtures() {
  const audit = auditFixture()
  return [
    buildTrainingProfessionalReport(trainingFixture(), trainingQuestions),
    buildGovernanceProfessionalReport(governanceFixture()),
    buildEvidenceProfessionalReport(evidenceFixture()),
    buildInternalAuditsProfessionalReport(audit.audits),
    buildFormalAuditProfessionalReport(audit),
    buildKycBlankProfessionalReport({ title: "Formato auxiliar EUI ficticio", code: "QA-EUI", sections: [{ title: "Datos de captura", fields: ["Nombre completo", "RFC / CURP / NIF aplicable", "Domicilio", "Beneficiario controlador"] }] }),
  ]
}
