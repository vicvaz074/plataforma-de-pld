import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import ts from "typescript"
import { captureModuleScope, assertModuleScope, isModuleScopeCurrent, configurePilotSession, getModuleStorage, flushModuleStorage, loadCompanyStorage, resetCompanyStorage } from "../lib/pilot/module-storage"
import { parseStoredArray, parseStoredObject } from "../lib/pld/module-continuity"
import { snapshotEvidenceVersion } from "../lib/pld/evidence-lifecycle"
import { beneficiaryReviewSignature } from "../lib/pld/beneficiary-review"
import { readClientProfile, mergeClientProfile } from "../lib/pld/client-module-profiles"
import { SUBMISSIONS_STORAGE_KEY, readStoredSubmissions, mergeSubmission, createSubmissionDraft } from "../lib/pld/submissions"
import type { CloudRecord, PilotSession } from "../lib/pilot/contracts"

// Execute the real page callers, not a reimplementation of their guards. Types
// are erased with the project's existing compiler; React/UI dependencies are stubs.
function pageCallers(path: string, names: string[], dependencies: Record<string, unknown>): Record<string, (...args: any[]) => Promise<any>> {
  const source = ts.createSourceFile(path, readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const declarations: string[] = []
  const found = new Set<string>()
  function visit(node: ts.Node) {
    if (ts.isVariableStatement(node)) {
      const matched = node.declarationList.declarations.filter((declaration) => ts.isIdentifier(declaration.name) && names.includes(declaration.name.text))
      if (matched.length) { declarations.push(node.getText(source)); matched.forEach((declaration) => found.add((declaration.name as ts.Identifier).text)); return }
    }
    if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) { declarations.push(node.getText(source)); found.add(node.name.text); return }
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.deepEqual([...found].sort(), [...names].sort(), "all tested production callers must be present")
  const javascript = ts.transpileModule(declarations.join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
  return new Function(...Object.keys(dependencies), `${javascript}\nreturn {${names.join(",")}}`)(...Object.values(dependencies))
}
const deferred = <T = void>() => { let resolve!: (value: T | PromiseLike<T>) => void; const promise = new Promise<T>((done) => { resolve = done }); return { promise, resolve } }
const a = { id: "caller-a", organizationId: "org", name: "A", rfc: "AAA010101AAA", status: "active" as const }, b = { ...a, id: "caller-b", name: "B" }
const session: PilotSession = { user: { id: "qa", name: "QA", email: "qa@example.test", platformRole: "superadmin", status: "active", requiresPasswordChange: false, twoFactorEnabled: false }, organizations: [], companies: [a,b], memberships: [], grants: [], mfaRequired: false }
const scopeDependencies = { captureModuleScope, assertModuleScope, isModuleScopeCurrent, getModuleStorage, flushModuleStorage }
const keys = { documents: "pld-evidences-documents", logs: "pld-evidences-logs", snapshot: "evidencias-trazabilidad-data" }
const jsonResponse = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } })
async function withCloud(run: (requests: string[]) => Promise<void>, transform = (record: any) => record) {
  const original = globalThis.fetch, requests: string[] = [], saved = new Map<string, CloudRecord[]>()
  globalThis.fetch = async (input, init) => {
    const path = String(input); requests.push(path)
    const id = path.includes(b.id) ? b.id : a.id
    if (path.endsWith("/snapshot")) return jsonResponse({ records: saved.get(id) || [] })
    if (path.endsWith("/records/batch")) {
      const records = JSON.parse(String(init?.body)).mutations.map((item: any) => transform({ ...item, revision: item.expectedRevision + 1 }))
      const changed = new Set(records.map((item: any) => `${item.collection}|${item.id}`))
      saved.set(id, [...(saved.get(id) || []).filter((item) => !changed.has(`${item.collection}|${item.id}`)), ...records])
      return jsonResponse({ records })
    }
    throw new Error(`Unexpected ${path}`)
  }
  try { configurePilotSession(session); await loadCompanyStorage(a); await run(requests); await flushModuleStorage() }
  finally { globalThis.fetch = original; resetCompanyStorage() }
}

test("actual Evidence upload stops a deferred reader across A→B→A and does not reset destination UI", async () => {
  await withCloud(async (requests) => {
    const read = deferred<string>(), ui: unknown[] = []
    const caller = pageCallers("app/evidencias-trazabilidad/page.tsx", ["commitEvidence", "handleUpload"], {
      ...scopeDependencies, STORAGE_KEYS: keys, parseStoredArray, snapshotEvidenceVersion,
      storageReady: true, formState: { file: new File(["pdf"], "file.pdf"), documentType: "doc", expedienteId: "client-a", submodule: "general", documentDate: "2026-11-11" }, selectedModule: "kyc",
      readFileAsDataUrl: () => read.promise, randomId: () => crypto.randomUUID(),
      setDocuments: (value: unknown) => ui.push(value), setLogs: (value: unknown) => ui.push(value), setFormState: (value: unknown) => ui.push(value), toast: (value: unknown) => ui.push(value), notifyPldIntegrationChange: () => ui.push("event"),
    })
    const scope = captureModuleScope(), uploading = caller.handleUpload()
    await loadCompanyStorage(b); await loadCompanyStorage(a)
    read.resolve("/api/v1/companies/caller-a/files/version"); await uploading
    assert.equal(requests.some((path) => path.endsWith("/records/batch")), false)
    assert.deepEqual(ui, [])
    await assert.rejects(caller.commitEvidence(scope, () => ({ documents: [], logs: [] })), /empresa o el acceso cambió/)
  })
})

test("actual Evidence upload merges canonical archive, notes and logs changed during the read", async () => {
  await withCloud(async () => {
    const read = deferred<string>(), docs: any[] = [], ui: unknown[] = []
    const caller = pageCallers("app/evidencias-trazabilidad/page.tsx", ["commitEvidence", "handleUpload"], {
      ...scopeDependencies, STORAGE_KEYS: keys, parseStoredArray, snapshotEvidenceVersion,
      storageReady: true, formState: { file: new File(["pdf"], "new.pdf"), documentType: "doc", expedienteId: "client-a", submodule: "general", documentDate: "2026-11-11" }, selectedModule: "kyc",
      readFileAsDataUrl: () => read.promise, randomId: () => crypto.randomUUID(),
      setDocuments: (value: any[]) => docs.splice(0, docs.length, ...value), setLogs: () => {}, setFormState: () => {}, toast: (value: unknown) => ui.push(value), notifyPldIntegrationChange: () => {},
    })
    const uploading = caller.handleUpload()
    getModuleStorage().setItem(keys.documents, JSON.stringify([{ id: "existing", expedienteId: "client-a", module: "kyc", documentType: "doc", archived: true, notes: "concurrent", versionHistory: [] }]))
    getModuleStorage().setItem(keys.logs, JSON.stringify([{ id: "concurrent-log" }]))
    read.resolve("/api/v1/companies/caller-a/files/new-version"); await uploading
    assert.equal(docs.length, 2); assert.equal(docs.find((doc) => doc.id === "existing").archived, true); assert.equal(docs.find((doc) => doc.id === "existing").notes, "concurrent")
    assert.equal(JSON.parse(getModuleStorage().getItem(keys.logs)!).length, 2)
    assert.equal((ui[0] as any).title, "Evidencia guardada")
  })
})

test("actual Avisos file handler and save helper keep the originating scope across a deferred digest", async () => {
  await withCloud(async (requests) => {
    const bytes = deferred<ArrayBuffer>(), ui: unknown[] = []
    const caller = pageCallers("app/avisos-informes/page.tsx", ["saveSubmission", "handleFileUpload"], {
      ...scopeDependencies, workflowReadOnly: false, activeSubmission: null, attachments: [],
      setSubmissionSaving: (value: boolean) => ui.push(value), toast: (value: unknown) => ui.push(value),
    })
    const scope = captureModuleScope()
    const uploading = caller.handleFileUpload({ target: { files: [{ name: "acuse.pdf", size: 3, type: "application/pdf", arrayBuffer: () => bytes.promise }] } }, "Acuse SAT")
    await loadCompanyStorage(b)
    bytes.resolve(new Uint8Array([1,2,3]).buffer); await uploading
    assert.deepEqual(ui, [true], "only the pre-await busy update is permitted")
    assert.equal(requests.some((path) => path.endsWith("/records/batch")), false)
    await assert.rejects(caller.saveSubmission(scope, []), /empresa o el acceso cambió/)
    assert.equal(getModuleStorage().getItem("pld-submissions-workflow"), null)
  })
})

test("actual Avisos upload appends to the latest attachments and trace after its deferred reader", async () => {
  await withCloud(async () => {
    const read = deferred<string>(), started = deferred(), operation = { id: "operation", revision: 1 }
    const original = { ...createSubmissionDraft({ operation, operationType: "aviso", actor: "qa", at: "2026-11-11T12:00:00Z" }), revision: 1 }
    getModuleStorage().setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify([original])); await flushModuleStorage()
    let updatedAttachments: any[] = [], records: any[] = []
    const messages: any[] = []
    const caller = pageCallers("app/avisos-informes/page.tsx", ["saveSubmission", "handleFileUpload"], {
      ...scopeDependencies, workflowReadOnly: false, activeSubmission: original, attachments: [], submissionStorageReady: true,
      operaciones: [operation], selectedOperacionId: operation.id, selectedOperationType: "aviso", sourceOperationRevision: 1, noticeForm: {}, checklistState: {}, evidenceState: {}, traceabilityEntries: [],
      readStoredSubmissions, mergeSubmission, createSubmissionDraft, SUBMISSIONS_STORAGE_KEY,
      readFileAsDataUrl: () => { started.resolve(); return read.promise },
      setSubmissionRecords: (value: any[]) => { records = value }, setAttachments: (value: any[]) => { updatedAttachments = value }, setActiveSubmissionId: () => {}, setTraceabilityEntries: () => {}, setSourceOperationRevision: () => {},
      setSubmissionSaving: () => {}, toast: (value: unknown) => messages.push(value), window: { dispatchEvent() {} }, CustomEvent: class {}, PLD_INTEGRATION_EVENT: "integration",
    })
    const uploading = caller.handleFileUpload({ target: { files: [new File(["PDF"], "support.pdf", { type: "application/pdf" })] } }, "Soporte")
    await started.promise
    const concurrent = { id: "concurrent", type: "Soporte", name: "prior.pdf", size: 2, mimeType: "application/pdf", dataUrl: "/api/v1/companies/caller-a/files/prior", sha256: "a".repeat(64), uploadedAt: "2026-11-11T13:00:00Z" }
    getModuleStorage().setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify([{ ...original, revision: 2, attachments: [concurrent], trace: [{ id: "concurrent-log", action: "other", user: "qa", timestamp: "2026-11-11T13:00:00Z", details: "concurrent", noticeId: original.id }] }]))
    read.resolve("/api/v1/companies/caller-a/files/current"); await uploading
    assert.equal(updatedAttachments.length, 2); assert.equal(updatedAttachments[0].id, "concurrent")
    assert.equal(records[0].trace.length, 2); assert.equal(records[0].revision, 3); assert.equal(messages.at(-1).title, "Documento guardado")
  })
})

test("actual Governance upload preserves a concurrent question edit and both deferred uploads", async () => {
  await withCloud(async () => {
    const first = deferred<ArrayBuffer>(), second = deferred<ArrayBuffer>()
    const initial = { questions: [{ id: "manuales-1", relatedDocuments: [], answer: null, notes: "old" }], documents: [], manualVersions: [], trace: [], committeeSessions: [], alerts: [], expedienteCerrado: false }
    getModuleStorage().setItem("gobernanza-control-data", JSON.stringify(initial)); await flushModuleStorage()
    const documents: any[] = [], questions: any[] = [], messages: any[] = []
    class Reader { result = "/api/v1/companies/caller-a/files/private"; onload?: () => void; onerror?: () => void; readAsDataURL() { queueMicrotask(() => this.onload?.()) } }
    const files = new Map<any, unknown>()
    class Data { constructor(private form: any) {} get(key: string) { return key === "file" ? files.get(this.form) : ({ name: "Manual", documentType: "Manual", issueDate: "2026-11-11", expiryDate: "", notes: "", relatedModules: [] } as any)[key] } getAll() { return [] } }
    const caller = pageCallers("app/gobernanza-control/page.tsx", ["handleDocumentUpload"], {
      ...scopeDependencies, FormData: Data, FileReader: Reader, STORAGE_KEY: "gobernanza-control-data", parseStoredObject,
      uploadContext: { questionId: "manuales-1" }, allowedExtensions: ["pdf"], requiresIssueWithin12Months: new Set(), evaluateDocumentStatus: () => "vigente", questionBank: [{ id: "manuales-1", category: "manuales" }], getUserIdentifier: () => "qa", closeUpload: () => {},
      setDocuments: (value: any[]) => documents.splice(0, documents.length, ...value), setQuestions: (value: any[]) => questions.splice(0, questions.length, ...value), setManualVersions: () => {}, setTrace: () => {}, toast: (value: unknown) => messages.push(value),
    })
    const formOne = { reset() {} }, formTwo = { reset() {} }
    files.set(formOne, { name: "first.pdf", size: 3, type: "application/pdf", arrayBuffer: () => first.promise }); files.set(formTwo, { name: "second.pdf", size: 3, type: "application/pdf", arrayBuffer: () => second.promise })
    const one = caller.handleDocumentUpload({ preventDefault() {}, currentTarget: formOne }), two = caller.handleDocumentUpload({ preventDefault() {}, currentTarget: formTwo })
    getModuleStorage().setItem("gobernanza-control-data", JSON.stringify({ ...initial, questions: [{ ...initial.questions[0], answer: "no", notes: "concurrent note", actionPlan: "concurrent plan" }] }))
    second.resolve(new Uint8Array([2]).buffer); await two; first.resolve(new Uint8Array([1]).buffer); await one
    assert.equal(documents.length, 2); assert.equal(questions[0].answer, "no"); assert.equal(questions[0].notes, "concurrent note"); assert.equal(questions[0].actionPlan, "concurrent plan"); assert.equal(questions[0].relatedDocuments.length, 2)
    const saved = JSON.parse(getModuleStorage().getItem("gobernanza-control-data")!); assert.equal(saved.manualVersions.length, 2); assert.equal(saved.trace.length, 2); assert.equal(messages.length, 2)
  })
})

test("actual BC closure signs server-stamped declarations rather than its captured local precursor", async () => {
  await withCloud(async () => {
    const local = [{ id: "declaration", folio: "BC-1", date: new Date("2026-11-10"), user: "local", notes: "Reviewed" }]
    const profile = { preguntas: [{ id: "q", answer: "si" }], documentos: [], declaraciones: local, clientType: "fisica", propertyChain: [], screeningResults: [], trazabilidad: [] }
    getModuleStorage().setItem("beneficiario-controlador-data", JSON.stringify(mergeClientProfile(null, "client-a", profile)))
    let declarations: any[] = local, validation: any
    const messages: any[] = []
    const caller = pageCallers("app/beneficiario-controlador/page.tsx", ["cerrarExpediente"], {
      ...scopeDependencies, storageReady: true, clientType: "fisica", preguntasState: [], isBeneficiarioControladorObligatorio: false, hasDeclaracionDocumento: false, trazabilidad: [], clientId: "client-a", declaraciones: local,
      beneficiaryReviewSignature, readClientProfile, mergeClientProfile, setValidation: (value: unknown) => { validation = value }, setDeclaraciones: (update: any) => { declarations = update(declarations) }, setTrazabilidad: () => {}, toast: (value: unknown) => messages.push(value),
    })
    await caller.cerrarExpediente()
    const canonical = readClientProfile(getModuleStorage().getItem("beneficiario-controlador-data"), "client-a")
    assert.equal(canonical.declaraciones[0].user, "server-actor"); assert.equal(declarations[0].user, "server-actor"); assert.equal(declarations[0].date.toISOString(), "2026-11-11T12:00:00.000Z")
    assert.equal(validation.signature, beneficiaryReviewSignature(canonical)); assert.equal(messages.at(-1).title, "Expediente validado")
  }, (record) => {
    if (record.collection === "beneficiario-controlador-data") for (const profile of Object.values(record.payload.profiles) as any[]) profile.declaraciones = profile.declaraciones.map((entry: any) => entry.user === "local" ? { ...entry, user: "server-actor", date: "2026-11-11T12:00:00.000Z" } : entry)
    return record
  })
})
