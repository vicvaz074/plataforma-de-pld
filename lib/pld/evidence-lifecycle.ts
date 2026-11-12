/** Sources consulted 2026-11-11: LFPIORPI art. 18 IV (10 years,
 * excluding XIV); Acuerdo 115/2026 art. 51 (audit report/support: 5 years
 * from delivery; first reviewed period 2028, transitory VIII). Archiving is
 * never destruction or automatic expiry. */
export const EVIDENCE_RETENTION_REVIEWED_AT = "2026-11-11"
export const GENERAL_RETENTION_YEARS = 10
export const RETENTION_SOURCES = {
  identification: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPIORPI.pdf",
  audit: "https://dof.gob.mx/nota_detalle_popup.php?codigo=5795797",
}

export interface EvidenceVersionSnapshot {
  version: number
  timestamp: string
  user: string
  changeNote: string
  fileData?: string
  fileName?: string
  fileSize?: number
  fileType?: string
  sha256?: string
  objectReference?: string
  documentDate?: string
}

export function getEvidenceRetention(input: {
  module?: string; documentType?: string; activityKey?: string; activityDate?: string;
  documentDate: string; auditDeliveredAt?: string; auditPeriodYear?: number; legalHold?: boolean;
}) {
  if (input.legalHold) return { years: null, startsAt: null, endsAt: null, status: "legal-hold" as const, source: RETENTION_SOURCES.identification }
  if (input.activityKey?.startsWith("fraccion-xiv")) return { years: null, startsAt: null, endsAt: null, status: "review-required" as const, source: RETENTION_SOURCES.identification }
  const audit = input.module === "auditoria" && /dictamen|soporte-auditoria/.test(input.documentType || "")
  if (audit && (!Number.isInteger(input.auditPeriodYear) || input.auditPeriodYear! < 2028)) return { years:null,startsAt:null,endsAt:null,status:"review-required" as const,source:RETENTION_SOURCES.audit }
  const start = audit ? input.auditDeliveredAt : input.activityDate
  const years = audit ? 5 : GENERAL_RETENTION_YEARS
  if (!start || !Number.isFinite(Date.parse(start))) return { years, startsAt: null, endsAt: null, status: "start-required" as const, source: audit ? RETENTION_SOURCES.audit : RETENTION_SOURCES.identification }
  if (audit && new Date(start).getUTCFullYear() <= input.auditPeriodYear!) return {years:null,startsAt:null,endsAt:null,status:"review-required" as const,source:RETENTION_SOURCES.audit}
  const date = new Date(start)
  const month = date.getUTCMonth()
  date.setUTCFullYear(date.getUTCFullYear() + years)
  if (date.getUTCMonth() !== month) date.setUTCDate(0)
  return { years, startsAt: start, endsAt: date.toISOString(), status: "scheduled" as const, source: audit ? RETENTION_SOURCES.audit : RETENTION_SOURCES.identification }
}

export function snapshotEvidenceVersion(input: {
  version: number; uploadDate: string; user: string; fileData?: string; fileName: string;
  fileSize: number; fileType: string; sha256?: string; objectReference?: string; documentDate?: string;
}, changeNote = "Nueva versión cargada"): EvidenceVersionSnapshot {
  return { version: input.version, timestamp: input.uploadDate, user: input.user, changeNote,
    fileData: input.fileData, fileName: input.fileName, fileSize: input.fileSize, fileType: input.fileType,
    sha256: input.sha256, objectReference: input.objectReference, documentDate: input.documentDate }
}

export function summarizeGovernance(questions: Array<{ required: boolean; answer: string | null; relatedDocuments: unknown[]; notes?: string; actionPlan?: string }>) {
  const required = questions.filter((question) => question.required)
  const satisfied = required.filter((q) => (q.answer === "si" && q.relatedDocuments.length > 0) || (q.answer === "no-aplica" && Boolean(q.notes?.trim()))).length
  const captured = required.filter((q) => q.answer !== null && q.answer !== "").length
  return { total: required.length, satisfied, captured, noncompliant: required.filter((q) => q.answer === "no").length,
    openPlans: required.filter((q) => q.answer === "no" && Boolean(q.actionPlan?.trim())).length,
    ratio: required.length ? Math.round(satisfied / required.length * 100) : 0 }
}
