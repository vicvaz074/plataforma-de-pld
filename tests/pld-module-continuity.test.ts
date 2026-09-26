import assert from "node:assert/strict"
import test from "node:test"
import { buildOperationalEvidenceLinks, countStoredRecords, mergeExternalEvidence, parseStoredArray, parseStoredObject, readActiveModuleOperations, readGovernanceIntegrationSnapshot, resolveEvidenceSource, restoreAuditWorkflow, reviewSignature } from "../lib/pld/module-continuity"

const NOW = "2026-09-26T12:00:00.000Z"
function storage(initial: Record<string, unknown>) {
  const data = new Map(Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]))
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
}

test("collection counts recognize indexed legacy maps without treating metadata as records", () => {
  assert.equal(countStoredRecords({ schemaVersion: 2, updatedAt: NOW, "id-one": { id: "one" }, "id-two": { id: "two" } }), 2)
  assert.equal(countStoredRecords({ schemaVersion: 2, updatedAt: NOW }), 0)
  assert.equal(countStoredRecords({ sujetosRegistrados: [] }, ["sujetosRegistrados"]), 0)
  assert.equal(countStoredRecords({ packages: { one: {}, two: {}, three: {} } }, ["packages"]), 3)
  assert.equal(countStoredRecords({ identificacion: { rfc: "SO" }, actividades: [] }), 1)
})

test("malformed persistent collections are rejected instead of becoming empty defaults", () => {
  assert.throws(() => parseStoredObject("[]"))
  assert.throws(() => parseStoredObject("null"))
  assert.throws(() => parseStoredArray("{}"))
  assert.throws(() => parseStoredArray("[null]"))
  assert.deepEqual(parseStoredObject(null), {})
  assert.deepEqual(parseStoredArray(null), [])
})

test("audit workflow survives serialization including portable data URLs and typed dates", () => {
  const raw = JSON.parse(JSON.stringify({
    schemaVersion: 2,
    responses: { one: { answer: "si", evidences: [{ id: "file", fileName: "evidence.pdf", fileSize: 3, url: "data:application/pdf;base64,AAA", uploadedAt: new Date(NOW) }, { id: "legacy", url: "blob:expired", uploadedAt: NOW }] } },
    scopeAnswers: { one: "no", two: "invalid" }, scopeExclusions: "Fuera del periodo revisado",
    reviewAnswers: { one: { rating: "cumple-parcial", findings: "Hallazgo", recommendations: "Corregir" } },
    finalChecklist: { one: true, two: "true" },
  }))
  const restored = restoreAuditWorkflow(raw, { responses: { one: { answer: "", evidences: [] } }, scopeAnswers: { one: "si", two: "si" }, reviewAnswers: { one: { rating: "", findings: "", recommendations: "" } }, finalChecklist: { one: false, two: false } })
  assert.equal(restored.responses.one.answer, "si")
  assert.equal(restored.responses.one.evidences[0].url, "data:application/pdf;base64,AAA")
  assert.equal(restored.responses.one.evidences[0].uploadedAt.toISOString(), NOW)
  assert.equal(restored.responses.one.evidences[1].id, "legacy", "retain legacy attachment metadata even when blob expired")
  assert.equal(restored.responses.one.evidences[1].url, "")
  assert.equal(restored.scopeAnswers.one, "no")
  assert.equal(restored.scopeAnswers.two, "si")
  assert.equal(restored.scopeExclusions, "Fuera del periodo revisado")
  assert.equal(restored.reviewAnswers.one.rating, "cumple-parcial")
  assert.deepEqual(restored.finalChecklist, { one: true, two: false })
  assert.deepEqual(restoreAuditWorkflow({ ...raw, schemaVersion: 1 }, { responses: {}, scopeAnswers: {}, reviewAnswers: {}, finalChecklist: { one: false } }).finalChecklist, { one: false }, "old inferred flags are not manual confirmations")
})

test("beneficiary confirmation remains valid after reload but changes invalidate its signature", () => {
  const state = { clientType: "moral", documents: [{ id: "doc", at: new Date(NOW) }], answers: { b: "si", a: "no" } }
  const signature = reviewSignature(state)
  assert.equal(reviewSignature(JSON.parse(JSON.stringify(state))), signature)
  assert.equal(reviewSignature({ ...state, answers: { a: "no", b: "si" } }), signature)
  assert.notEqual(reviewSignature({ ...state, clientType: "fisica" }), signature)
})

const evidence = {
  id: "retained-id", source: "gobernanza", sourceId: "source-one", fileData: "data:application/pdf;base64,AAA", fileName: "old.pdf", fileSize: 3, fileType: "application/pdf",
  version: 2, versionHistory: [{ version: 1, timestamp: NOW, user: "Reviewer", changeNote: "Previous update" }], archived: true, notes: "Nota local", user: "Source", uploadDate: NOW, documentDate: NOW,
}

test("source refresh preserves IDs, archive status and version history; actual updates create one version", () => {
  const source = { ...evidence, id: "regenerated", version: 1, versionHistory: [], archived: false, notes: "Nota fuente", uploadDate: "2026-09-27T00:00:00Z" }
  const stable = mergeExternalEvidence([evidence], [source], NOW)
  assert.equal(stable[0].id, "retained-id")
  assert.equal(stable[0].archived, true)
  assert.equal(stable[0].version, 2)
  assert.equal(stable[0].notes, "Nota local")
  assert.equal(stable[0].uploadDate, NOW)
  assert.deepEqual(stable[0].versionHistory, evidence.versionHistory)
  const updated = mergeExternalEvidence(stable, [{ ...source, fileData: "data:application/pdf;base64,BBB" }], NOW)
  assert.equal(updated[0].version, 3)
  assert.equal(updated[0].versionHistory.length, 2)
  assert.equal(mergeExternalEvidence(updated, [{ ...source, fileData: "data:application/pdf;base64,BBB" }], NOW)[0].version, 3)
  assert.deepEqual(mergeExternalEvidence(updated, [], NOW), updated, "missing source must not delete evidence")
  assert.equal(mergeExternalEvidence([{ ...evidence, sourceOverride: true }], [{ ...source, fileData: "changed" }], NOW)[0].fileData, evidence.fileData)
})

test("operational references connect EUI, Actos and SAT without duplicating file payloads or declaring them presented", () => {
  const source = storage({
    kyc_expedientes_detalle: [{ expedienteId: "eui-one", nombre: "Cliente", identifiers: { nif: "NIF-001" }, actualizadoEn: NOW, expedienteEui: { documentacion: { acta: true } } }],
    actividades_vulnerables_operaciones: [{ id: "op-one", expedienteId: "eui-one", revision: 2, documentosSoporte: [{ id: "doc-one", requisito: "Contrato", archivoNombre: "contrato.pdf", archivoContenido: "data:application/pdf;base64,AAA", fechaRegistro: NOW }, { id: "notes-only", notas: "No es archivo" }] }],
    "pld-sat-output-packages": [{ id: "sat-one", sourceOperationId: "op-one", sourceOperationRevision: 2, createdAt: NOW, xml: "<archivo />", xmlFileName: "aviso.xml" }],
  })
  const links = buildOperationalEvidenceLinks(source, NOW)
  assert.equal(links.length, 3)
  assert.ok(links.every((link) => link.expedienteId === "eui-one" && !("fileData" in link)))
  assert.equal(links[0].documentType, "registro-expediente")
  assert.equal(links[2].documentType, "paquete-sat-preparado")
  assert.equal(resolveEvidenceSource(source, links[1].sourceReference), "data:application/pdf;base64,AAA")
  assert.equal(resolveEvidenceSource(source, links[2].sourceReference), undefined, "an evidence reference must not bypass XML validation")
  assert.match(resolveEvidenceSource(source, links[0].sourceReference) || "", /^data:application\/json/)
  source.setItem("actividades_vulnerables_operaciones", "[]")
  assert.equal(resolveEvidenceSource(source, links[1].sourceReference), undefined)
})

test("governance reads current module keys and excludes cancelled/draft/resolved operations", () => {
  const operation = { id: "op", actividadKey: "fraccion-viii-vehiculos", cliente: "Cliente", rfc: "AAA010101AA1", tipoCliente: "pf_residente", monto: 10_000_000, fechaOperacion: "2026-09-26", periodo: "2026-09", alerta: "Preparar aviso", lifecycle: { status: "active" }, alertaResuelta: false }
  const source = storage({
    "pld-training-module": { documents: [{ id: "1" }, { id: "2" }] },
    "auditoria-interna-registros": [{ id: "1", findings: "Hallazgo pendiente" }, { id: "2", findings: "" }],
    "pld-evidences-documents": [{ id: "1", archived: false }, { id: "2", archived: true }],
    actividades_vulnerables_operaciones: [operation, { ...operation, id: "cancelled", lifecycle: { status: "cancelled" } }, { ...operation, id: "draft", captureStatus: "draft" }, { ...operation, id: "resolved", alertaResuelta: true }],
  })
  assert.equal(readActiveModuleOperations(source).length, 2)
  assert.deepEqual(readGovernanceIntegrationSnapshot(source), { capacitacionDocuments: 2, auditoriaHallazgos: 1, monitoreoAlertas: 1, evidenciasResguardadas: 1 })
})
