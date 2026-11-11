import assert from "node:assert/strict"
import test from "node:test"
import { getEvidenceRetention, snapshotEvidenceVersion, summarizeGovernance, type EvidenceVersionSnapshot } from "../lib/pld/evidence-lifecycle"
import { mergeClientProfile, readClientProfile } from "../lib/pld/client-module-profiles"
import { mergeExternalEvidence } from "../lib/pld/module-continuity"
import { createStoredPldOperation, loadStoredPldOperations, sanitizeStoredPldOperation, recalculateStoredPldOperationsChronologically } from "../lib/pld/stored-operations"
import { confirmSubmission, mergeSubmission, readStoredSubmissions, type StoredSubmission } from "../lib/pld/submissions"
import { resolveOperationClientIdentity } from "../lib/pld/operation-client-identity"
import { moduleControlAction } from "../lib/pilot/control-permissions"
import { cloudRegistrationIssue, prefillCompanyRegistration } from "../lib/pilot/company-registration"
import { getTrainingProofPolicy } from "../lib/pld/training-proof-policy"

test("capacitación: política interna no acepta fechas futuras, imposibles ni constancias sin archivo",()=>{
  const now=new Date("2026-11-11T18:00:00Z")
  assert.equal(getTrainingProofPolicy({date:"2026-11-11",hasDocument:true,now}).ready,true)
  assert.equal(getTrainingProofPolicy({date:"2026-11-12",hasDocument:true,now}).status,"future-date")
  assert.equal(getTrainingProofPolicy({date:"2026-02-30",hasDocument:true,now}).status,"invalid-date")
  assert.equal(getTrainingProofPolicy({date:"2026-11-11",hasDocument:false,now}).status,"missing-document")
  assert.equal(getTrainingProofPolicy({date:"2025-11-11",hasDocument:true,now}).ready,true)
  assert.equal(getTrainingProofPolicy({date:"2025-11-10",hasDocument:true,now}).status,"review-due")
  assert.equal(getTrainingProofPolicy({date:"2026-11-12",hasDocument:true,now:new Date("2026-11-12T03:00:00Z")}).status,"future-date","Mexico City day, not UTC tomorrow")
})

test("Alta cloud está anclada a una empresa, conserva la captura y no elimina sujetos mezclados",()=>{
  const company={rfc:"DLV190624M32",name:"Empresa activa"}
  const blank={rfc:"",nombre:"",fecha:"2026-01-01",curp:"CURP-CAPTURADA"}
  assert.deepEqual(prefillCompanyRegistration(blank,company),{...blank,rfc:company.rfc,nombre:company.name})
  assert.equal(prefillCompanyRegistration({...blank,nombre:"Nombre ya capturado"},company).nombre,"Nombre ya capturado")
  assert.equal(cloudRegistrationIssue({},company),null)
  assert.equal(cloudRegistrationIssue({sujetosRegistrados:[{id:"stable-legacy-id",identificacion:{rfc:company.rfc}}]},company),null)
  const mixed={sujetosRegistrados:[{id:"one",identificacion:{rfc:company.rfc}},{id:"two",identificacion:{rfc:"OTHER"}}]}
  const before=JSON.stringify(mixed)
  assert.match(cloudRegistrationIssue(mixed,company) || "",/varios sujetos/)
  assert.equal(JSON.stringify(mixed),before)
  assert.ok(cloudRegistrationIssue({identificacion:{rfc:"OTRO010101AAA"}},company))
  assert.ok(cloudRegistrationIssue({sujetosRegistrados:[{id:"unknown",identificacion:{rfc:""}}]},company))
  assert.ok(cloudRegistrationIssue({}, {...company,rfc:""}))
})

test("permisos UI distinguen captura, aprobación, archivos y navegación consultable", () => {
  assert.equal(moduleControlAction({ tag: "button", text: "Guardar operación" }), "edit")
  assert.equal(moduleControlAction({ tag: "button", text: "Ver y editar" }), "edit")
  assert.equal(moduleControlAction({ tag: "input", type: "file" }), "upload")
  assert.equal(moduleControlAction({ tag: "button", text: "Confirmar presentación con acuse" }), "approve")
  assert.equal(moduleControlAction({ tag: "button", text: "Cancelar operación" }), "archive")
  assert.equal(moduleControlAction({ tag: "button", text: "Cancelar" }), null)
  assert.equal(moduleControlAction({ tag: "button", text: "Descargar PDF" }), "download")
  assert.equal(moduleControlAction({ tag: "input", text: "Buscar operaciones" }), null)
  assert.equal(moduleControlAction({ tag: "button", role: "combobox", text: "Cliente Uno", context: "browse" }), null)
  assert.equal(moduleControlAction({ tag: "button", text: "Siguiente" }), null)
  assert.equal(moduleControlAction({ tag: "button", text: "Ver", action: "archive" }), "archive")
  assert.equal(moduleControlAction({ tag: "button", action: "download", context: "browse" }), "download")
})

test("abrir Bandeja no descarta ni reescribe registros inconsistentes o con ID duplicado", () => {
  for (const values of [[{ id: "one", monto: 100 }, null], [{ id: "one" }, { id: "one" }]]) {
    const original = JSON.stringify(values)
    let writes = 0
    const result = loadStoredPldOperations({ getItem: () => original, setItem: () => { writes += 1 } })
    assert.equal(result.discardedCount > 0 || result.duplicateIds.length > 0, true)
    assert.equal(writes, 0)
  }
})

test("un borrador sin fecha o con fecha imposible no inventa la fecha de hoy ni entra a acumulación",()=>{
  for(const date of ["","2026-02-30",undefined]){
    const draft=sanitizeStoredPldOperation({id:"missing-date",fechaOperacion:date,monto:10_000_000,captureStatus:"complete"},{now:"2026-11-11T12:00:00Z"})!
    assert.equal(draft.fechaOperacion,"")
    assert.equal(draft.periodo,"")
    assert.equal(draft.dateReviewRequired,true)
    assert.equal(draft.captureStatus,"draft")
    assert.equal(draft.createdAt,"2026-11-11T12:00:00.000Z","createdAt is a separate audit timestamp, not an operation date")
    assert.deepEqual(recalculateStoredPldOperationsChronologically([draft]),[draft])
  }
})

test("la sustitución externa conserva los bytes y metadatos de la versión anterior", () => {
  const previous = { id: "evidence", source: "actos", sourceId: "act-1", version: 1, versionHistory: [] as EvidenceVersionSnapshot[], archived: true,
    uploadDate: "2026-09-01", documentDate: "2026-09-01", user: "original-user", fileName: "v1.pdf", fileSize: 10,
    fileType: "application/pdf", fileData: "data:application/pdf;base64,djE=" }
  const incoming = { ...previous, fileName: "v2.pdf", fileData: "data:application/pdf;base64,djI=", uploadDate: "2026-11-11", user: "second-user" }
  const changed = mergeExternalEvidence([previous], [incoming], "2026-11-11")[0]
  assert.equal(changed.version, 2)
  assert.equal(changed.archived, true)
  assert.equal(changed.versionHistory[0].fileData, previous.fileData)
  assert.equal(changed.versionHistory[0].fileName, "v1.pdf")
  assert.equal(changed.versionHistory[0].user, "original-user")
  assert.equal(snapshotEvidenceVersion(incoming).fileData, incoming.fileData)
})

test("el hash evita versiones falsas al externalizar; un cambio real reinicia la aprobación",()=>{
  const original={id:"doc",source:"capacitacion",sourceId:"origin",version:1,versionHistory:[] as EvidenceVersionSnapshot[],archived:false,
    uploadDate:"2026-11-11",documentDate:"2026-11-11",user:"actor",fileName:"one.pdf",fileSize:3,fileType:"application/pdf",fileData:"data:application/pdf;base64,YWJj",
    sha256:"hash-one",reviewStatus:"approved" as "approved"|"pending",reviewedHash:"hash-one",reviewedAt:"2026-11-11"}
  const externalized=mergeExternalEvidence([original],[{...original,fileData:"/api/v1/companies/one/files/version-one"}],"2026-11-11")[0]
  assert.equal(externalized.version,1)
  assert.equal(externalized.reviewStatus,"approved")
  const changed=mergeExternalEvidence([externalized],[{...externalized,fileData:"/api/v1/companies/one/files/version-two",sha256:"hash-two",archived:true}],"2026-11-12")[0]
  assert.equal(changed.version,2)
  assert.equal(changed.reviewStatus,"pending")
  assert.equal(changed.reviewedHash,undefined)
  assert.equal(changed.versionHistory[0].sha256,"hash-one")
  assert.equal(changed.archived,true)
})

test("conservación usa fecha del acto/entrega y no interpreta archivo como eliminación", () => {
  assert.equal(getEvidenceRetention({ documentDate: "2001-01-01" }).endsAt, null)
  assert.equal(getEvidenceRetention({ documentDate: "2001-01-01", activityDate: "2026-11-11" }).endsAt, "2036-11-11T00:00:00.000Z")
  assert.equal(getEvidenceRetention({ module: "auditoria", documentType: "dictamen", documentDate: "2029-03-20", auditDeliveredAt: "2029-03-20", auditPeriodYear:2028 }).endsAt, "2034-03-20T00:00:00.000Z")
  assert.equal(getEvidenceRetention({ module:"auditoria",documentType:"dictamen",documentDate:"2026-01-01",auditDeliveredAt:"2026-03-20" }).status,"review-required")
  assert.equal(getEvidenceRetention({ module:"auditoria",documentType:"dictamen",documentDate:"2026-01-01",auditDeliveredAt:"2026-03-20",auditPeriodYear:2025 }).endsAt,null)
  assert.equal(getEvidenceRetention({ activityKey: "fraccion-xiv-aduanal-d", activityDate: "2026-11-11", documentDate: "2026-01-01" }).status, "review-required")
  assert.equal(getEvidenceRetention({ legalHold: true, documentDate: "2026-01-01", activityDate: "2026-11-11" }).endsAt, null)
})

test("gobernanza: un no con plan de acción no equivale a cumplimiento", () => {
  const summary = summarizeGovernance([{ required: true, answer: "no", notes: "documentado", actionPlan: "corregir", relatedDocuments: [] }])
  assert.equal(summary.ratio, 0)
  assert.equal(summary.captured, 1)
  assert.equal(summary.openPlans, 1)
})

test("beneficiarios por expediente: no se copian perfiles ni se asignan datos legacy por RFC", () => {
  const legacy = JSON.stringify({ documentos: [{ id: "legacy" }] })
  const first = mergeClientProfile(legacy, "eui-1", { documentos: [{ id: "first" }] })
  const second = mergeClientProfile(JSON.stringify(first), "eui-2", { documentos: [{ id: "second" }] })
  assert.equal(second.legacyUnassigned.documentos[0].id, "legacy")
  assert.equal(readClientProfile(JSON.stringify(second), "eui-1").documentos[0].id, "first")
  assert.equal(readClientProfile(JSON.stringify(second), "eui-2").documentos[0].id, "second")
  assert.deepEqual(readClientProfile(JSON.stringify(second), "eui-3"), {})
  assert.throws(() => mergeClientProfile("broken", "eui-1", {}))
})

test("Actos conserva CURP/NIF como tales, sin fabricar RFC ni unir expedientes por identificador", () => {
  const curp = resolveOperationClientIdentity({ expedienteId: "eui-curp", tipoCliente: "pf_residente", rfcText: "LUPA790622MNLNRD03", identifiers: { curp: "LUPA790622MNLNRD03" } })
  assert.equal(curp.error, null)
  assert.equal(curp.identifiers.rfc, "")
  assert.equal(curp.identifiers.curp, "LUPA790622MNLNRD03")
  assert.equal(curp.key, "expediente:eui-curp")
  const nif = resolveOperationClientIdentity({ expedienteId: "other", tipoCliente: "pm_extranjera", identifiers: { nif: "FOREIGN-42" } })
  assert.equal(nif.error, null)
  assert.equal(nif.identifiers.rfc, "")
  assert.equal(nif.key, "expediente:other")
  assert.notEqual(curp.key, nif.key)
})

const makeSubmission = (): StoredSubmission => ({ schemaVersion: 1, id: "op-1", revision: 0, operationId: "op-1", sourceOperationRevision: 1,
  operationType: "relevante", form: { folio: "FOLIO-1", digitalSeal: "sello", submissionDate: "2026-11-10", acknowledgementDate: "2026-11-10" },
  checklist: {}, evidence: {}, attachments: [{ id: "receipt", type: "Acuse SAT", name: "acuse.pdf", size: 100,
    mimeType: "application/pdf", dataUrl: "data:application/pdf;base64,YWN1c2U=", sha256: "abc", uploadedAt: "2026-11-10" }],
  trace: [], status: "draft", createdAt: "2026-11-10", updatedAt: "2026-11-10" })

test("presentación requiere acuse real, misma revisión y actualiza operación sin duplicarla", () => {
  const operation = createStoredPldOperation({ id: "op-1",clienteId:"fixture-client", actividadKey: "fraccion-xv-uso-goce", cliente: "Cliente", monto: 400000,
    fechaOperacion: "2026-11-10", umbralStatus: "aviso", captureStatus: "complete", moneda: "MXN" }, { at: "2026-11-10T12:00:00Z" })!
  const submission = makeSubmission()
  assert.throws(() => confirmSubmission({ submission: { ...submission, attachments: [] }, operations: [operation], actor: "user", at: "2026-11-11" }), /acuse/)
  assert.throws(() => confirmSubmission({ submission: { ...submission, sourceOperationRevision: 0 }, operations: [operation], actor: "user", at: "2026-11-11" }), /cambió/)
  const confirmed = confirmSubmission({ submission, operations: [operation], actor: "user", at: "2026-11-11T12:00:00Z" })
  assert.equal(confirmed.operations.length, 1)
  assert.equal(confirmed.operations[0].avisoPresentado, true)
  assert.equal(confirmed.operations[0].submission.reference, "FOLIO-1")
  assert.equal(confirmed.submission.status, "presented")
  assert.equal(confirmed.submission.sourceOperationRevision, 2)
  const records = mergeSubmission([], submission, 0)
  assert.equal(readStoredSubmissions(JSON.stringify(records))[0].attachments[0].dataUrl, submission.attachments[0].dataUrl)
  assert.throws(() => mergeSubmission(records, submission, 0), /otra vista/)
})
