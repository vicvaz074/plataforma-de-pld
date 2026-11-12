/** Shared admission/read checks. Reject malformed saved state instead of dropping it. */
type Obj = Record<string, unknown>
const object = (value: unknown): value is Obj => Boolean(value && typeof value === "object" && !Array.isArray(value))
function invalid(path: string): never { throw new Error(`El campo ${path} no es válido; conserva el registro original y corrígelo antes de guardar.`) }
function obj(value: unknown, path: string): Obj { if (!object(value)) invalid(path); return value }
function strings(value: Obj, keys: string[], path: string, required = false) {
  for (const key of keys) if (required || value[key] !== undefined) if (typeof value[key] !== "string") invalid(`${path}.${key}`)
}
function list(value: unknown, path: string): unknown[] { if (!Array.isArray(value)) invalid(path); return value }
function stringList(value: unknown, path: string) { if (list(value,path).some(item => typeof item !== "string")) invalid(path) }
const statuses = ["coincidencia_alta", "posible_coincidencia", "sin_coincidencia", "requiere_revision"]
const relations = ["cliente", "beneficiario-controlador", "representante", "familiar", "socio", "otro"]
function enumeration(value: unknown, choices: string[], path: string) { if (typeof value !== "string" || !choices.includes(value)) invalid(path) }
function decision(value: unknown, path: string) {
  const item = obj(value,path)
  strings(item,["id","subjectName","normalizedSubjectName","evidence","decidedBy","decidedAt"],path,true)
  strings(item,["nextReviewAt","sourceEntityId","relatedPepName","expedienteId"],path)
  enumeration(item.decision,["confirmado_pep","falso_positivo","relacionado_pep","requiere_revision"],`${path}.decision`)
  enumeration(item.relation,relations,`${path}.relation`)
}
export function assertPepInternalRecord(value: unknown): void {
  const item = obj(value,"decisión PEP")
  if (item.schemaVersion !== 1) invalid("decisión PEP.schemaVersion")
  decision(item,"decisión PEP")
}
export function assertPepSearchResponse(value: unknown): void {
  const item = obj(value,"historial PEP"), query = obj(item.query,"historial PEP.query")
  strings(query,["nombre","cargo","dependencia","fechaNacimiento","pais"],"historial PEP.query")
  if (query.relacion !== undefined) enumeration(query.relacion,relations,"historial PEP.query.relacion")
  enumeration(item.status,statuses,"historial PEP.status")
  strings(item,["checkedAt","recommendation"],"historial PEP",true)
  strings(item,["expedienteId"],"historial PEP")
  for (const result of list(item.results,"historial PEP.results")) {
    const r = obj(result,"resultado PEP"), e = obj(r.entity,"resultado PEP.entity")
    enumeration(r.status,statuses,"resultado PEP.status")
    if (typeof r.score !== "number" || !Number.isFinite(r.score) || typeof r.requiresHumanReview !== "boolean") invalid("resultado PEP.score/requiresHumanReview")
    strings(r,["source","note"],"resultado PEP",true); stringList(r.matchedFields,"resultado PEP.matchedFields")
    strings(e,["id","name","source","sourceLabel","sourceUrl"],"entidad PEP",true)
    strings(e,["country","birthDate","dataset","lastSeen"],"entidad PEP")
    for (const key of ["aliases","topics"]) if (e[key] !== undefined) stringList(e[key],`entidad PEP.${key}`)
    if (e.positions !== undefined) for (const position of list(e.positions,"entidad PEP.positions")) {
      const p = obj(position,"cargo PEP"); strings(p,["cargo"],"cargo PEP",true); strings(p,["dependencia","desde","hasta"],"cargo PEP")
    }
    if (r.reviewDecision !== undefined) decision(r.reviewDecision,"resultado PEP.reviewDecision")
  }
  for (const d of list(item.appliedDecisions,"historial PEP.appliedDecisions")) decision(d,"historial PEP.appliedDecisions")
  for (const snapshot of list(item.sourceSnapshots,"historial PEP.sourceSnapshots")) {
    const s = obj(snapshot,"fuente PEP"); strings(s,["sourceId","sourceLabel"],"fuente PEP",true); strings(s,["syncedAt"],"fuente PEP")
    if (typeof s.count !== "number" || !Number.isFinite(s.count)) invalid("fuente PEP.count")
  }
}
export function assertTrainingState(value: unknown): void {
  const state = obj(value,"capacitación")
  if (state.moduleClosed !== undefined && typeof state.moduleClosed !== "boolean") invalid("capacitación.moduleClosed")
  for (const key of ["sessions","employees","documents","traceability"]) {
    if (state[key] === undefined) continue
    for (const raw of list(state[key],`capacitación.${key}`)) {
      const item = obj(raw,`capacitación.${key}`)
      const fields = key === "sessions" ? ["id","title","date","modality","topicsSummary","attendanceDocumentId","temarioDocumentId","evaluationDocumentId","observations","createdAt","createdBy"] : key === "employees" ? ["id","name","role","department","hireDate","lastTrainingDate"] : key === "documents" ? ["id","name","category","dataUrl","fileType","uploadedAt","uploadedBy","sha256","sessionId","employeeId","checklistQuestionId","notes"] : ["id","action","details","user","timestamp","sessionId","employeeId","documentId"]
      strings(item,fields,`capacitación.${key}`)
      strings(item,key === "sessions" ? ["id","title","date","modality","topicsSummary","createdAt","createdBy"] : key === "employees" ? ["id","name","role","department","hireDate"] : key === "documents" ? ["id","name","category","dataUrl","fileType","uploadedAt","uploadedBy"] : ["id","action","details","user","timestamp"],`capacitación.${key}`,true)
      for (const field of key === "sessions" ? ["materialsDocumentIds","attendees"] : key === "employees" ? ["certificates"] : []) stringList(item[field],`capacitación.${key}.${field}`)
      if (key === "employees") for (const entry of list(item.history,"capacitación.employees.history")) { const h = obj(entry,"historial capacitación"); strings(h,["sessionId","sessionTitle","date"],"historial capacitación",true); strings(h,["certificateId"],"historial capacitación") }
      for (const field of key === "sessions" ? ["evaluationApplied"] : key === "employees" ? ["criticalRole","needsInitialTraining"] : []) if (typeof item[field] !== "boolean") invalid(`capacitación.${key}.${field}`)
      for (const field of key === "sessions" ? ["durationHours"] : key === "documents" ? ["size"] : []) if (typeof item[field] !== "number" || !Number.isFinite(item[field])) invalid(`capacitación.${key}.${field}`)
    }
  }
  if (state.trainingPlan !== undefined && state.trainingPlan !== null) {
    const plan = obj(state.trainingPlan,"capacitación.trainingPlan"); strings(plan,["year","approvedBy","approvalDate","objectives","coverage","createdAt","updatedAt"],"capacitación.trainingPlan",true); strings(plan,["planDocumentId"],"capacitación.trainingPlan")
    for (const item of list(plan.schedule,"capacitación.trainingPlan.schedule")) strings(obj(item,"calendario capacitación"),["id","month","topic","audience"],"calendario capacitación",true)
  }
  if (state.officialCompliance !== undefined) { const official = obj(state.officialCompliance,"capacitación.officialCompliance"); strings(official,["name"],"capacitación.officialCompliance",true); strings(official,["lastCertificationDate","certificateDocumentId"],"capacitación.officialCompliance") }
  if (state.checklistAnswers !== undefined) for (const [key,raw] of Object.entries(obj(state.checklistAnswers,"capacitación.checklistAnswers"))) {
    const item = obj(raw,`capacitación.checklistAnswers.${key}`); enumeration(item.answer,["si","no","pendiente"],`capacitación.checklistAnswers.${key}.answer`); strings(item,["notes","evidenceId"],`capacitación.checklistAnswers.${key}`)
  }
}
