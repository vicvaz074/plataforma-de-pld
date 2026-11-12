import assert from "node:assert/strict"
import test from "node:test"
import { configurePilotSession, captureModuleScope, assertModuleScope, isModuleScopeCurrent, flushModuleStorage, getModuleStorage, loadCompanyStorage, resetCompanyStorage, retryModuleStorage, uploadPilotFile, getActiveCompany, getPendingModuleChanges, getSaveState, canWriteModuleStorage, getCompanyRecordRevision } from "../lib/pilot/module-storage"
import { type CloudRecord, type PilotSession } from "../lib/pilot/contracts"
import { appendClientProfileDocument, readClientProfile } from "../lib/pld/client-module-profiles"
import { beneficiaryReviewSignature } from "../lib/pld/beneficiary-review"

test("401 then another principal without companies cannot read the previous user's snapshot", async () => {
  const original=globalThis.fetch
  globalThis.fetch=async()=>json({records:[{collection:"pld-training-module",id:"singleton",revision:1,payload:{privateNote:"ONLY USER A"}}]})
  try{
    configurePilotSession(session);await loadCompanyStorage(a)
    assert.match(getModuleStorage().getItem("pld-training-module")!,/ONLY USER A/)
    configurePilotSession(null)
    const other={...session,user:{...session.user,id:"user-with-no-companies",name:"Other"},companies:[]}
    configurePilotSession(other)
    assert.equal(getModuleStorage().getItem("pld-training-module"),null,"A new scope must not grant access to a different principal's cached data")
  }finally{globalThis.fetch=original;resetCompanyStorage()}
})

test("a different principal cannot export/replay quarantined pending changes; same-user reauthentication recovers them",async()=>{
  const original=globalThis.fetch,started=deferred(),finish=deferred(),requests:string[]=[]
  let firstBatch=true
  globalThis.fetch=async(input,init)=>{
    const path=String(input);requests.push(path)
    if(path.endsWith("/snapshot"))return json({records:[]})
    if(path.endsWith("/records/batch")){
      if(firstBatch){firstBatch=false;started.resolve();await finish.promise;return json({error:"Session A expired"},401)}
      return json({records:JSON.parse(String(init?.body)).mutations.map((item:any)=>({...item,revision:item.expectedRevision+1}))})
    }
    throw new Error(path)
  }
  try{
    configurePilotSession(session);await loadCompanyStorage(a)
    const origin=captureModuleScope()
    origin.storage.setItem("pld-training-module",JSON.stringify({privateDraft:"UNSAVED FOR A ONLY"}))
    const draining=flushModuleStorage()
    await started.promise
    configurePilotSession(null)
    assert.throws(()=>getPendingModuleChanges(),/empresa o el acceso cambió/,"An anonymous session cannot export A's pending draft")
    const other={...session,user:{...session.user,id:"different-user",name:"B"},companies:[]}
    configurePilotSession(other)
    assert.equal(getActiveCompany(),null)
    assert.equal(getModuleStorage().getItem("pld-training-module"),null)
    assert.deepEqual(getPendingModuleChanges().collections,{})
    assert.equal(getCompanyRecordRevision("pld-training-module","singleton"),undefined)
    assert.equal(canWriteModuleStorage("pld-training-module"),false)
    assert.throws(()=>getModuleStorage().setItem("pld-training-module","{}"),/consulta/)
    assert.throws(()=>origin.storage.getItem("pld-training-module"),/empresa o el acceso cambió/)
    finish.resolve();await draining
    assert.equal(getSaveState().status,"saved","A's delayed 401 completion cannot poison B's save state")
    assert.deepEqual(getPendingModuleChanges().collections,{})
    assert.equal(requests.filter((path)=>path.endsWith("/records/batch")).length,1,"Nothing from A is replayed while B is signed in")
    configurePilotSession(session)
    assert.equal(getActiveCompany()?.id,a.id)
    assert.match(getModuleStorage().getItem("pld-training-module")!,/UNSAVED FOR A ONLY/)
    assert.equal((getPendingModuleChanges().collections["pld-training-module"] as any).privateDraft,"UNSAVED FOR A ONLY")
    await flushModuleStorage()
    assert.equal(getSaveState().status,"saved");assert.deepEqual(getPendingModuleChanges().collections,{})
    assert.equal(requests.filter((path)=>path.endsWith("/records/batch")).length,2)
    assert.equal(requests.filter((path)=>path.endsWith("/records/batch")).every((path)=>path.includes(a.id)),true)
    assert.throws(()=>origin.storage.setItem("pld-training-module","{}"),/empresa o el acceso cambió/,"Returning as A never revives A's old callbacks")
  }finally{finish.resolve();configurePilotSession(session);await retryModuleStorage().catch(()=>undefined);globalThis.fetch=original;resetCompanyStorage()}
})

const deferred = <T = void>() => { let resolve!: (value: T | PromiseLike<T>) => void; const promise = new Promise<T>((done) => { resolve = done }); return { promise, resolve } }
const a = { id: "company-a", organizationId: "org", name: "A", rfc: "AAA010101AAA", status: "active" as const }
const b = { ...a, id: "company-b", name: "B" }
const session: PilotSession = { user: { id: "qa", name: "QA", email: "qa@example.test", platformRole: "superadmin", status: "active", requiresPasswordChange: false, twoFactorEnabled: false }, organizations: [], companies: [a,b], memberships: [], grants: [], mfaRequired: false }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })

test("deferred file reads, uploads, snapshots and A→B→A never adopt the destination binding", async () => {
  const original = globalThis.fetch
  const dataStarted = deferred(), dataReady = deferred(), uploadStarted = deferred(), uploadReady = deferred(), snapshotStarted = deferred(), snapshotReady = deferred()
  const persisted = new Map<string, CloudRecord[]>()
  const writes: string[] = []
  let deferB = true
  globalThis.fetch = async (input, init) => {
    const path = String(input)
    if (path.startsWith("data:")) { dataStarted.resolve(); await dataReady.promise; return new Response("PDF", { headers: { "content-type": "application/pdf" } }) }
    const id = path.includes("company-b") ? b.id : a.id
    if (path.endsWith("/snapshot")) {
      if (id === b.id && deferB) { snapshotStarted.resolve(); await snapshotReady.promise }
      return json({ records: persisted.get(id) || [] })
    }
    if (path.endsWith("/files")) { writes.push(path); uploadStarted.resolve(); await uploadReady.promise; return json({ id: "file-v1", downloadUrl: `/api/v1/companies/${id}/files/file-v1` }, 201) }
    if (path.endsWith("/records/batch")) {
      writes.push(path)
      const records = JSON.parse(String(init?.body)).mutations.map((item: any) => ({ ...item, revision: item.expectedRevision + 1 }))
      persisted.set(id, records)
      return json({ records })
    }
    throw new Error(path)
  }
  try {
    configurePilotSession(session); await loadCompanyStorage(a)
    const origin = captureModuleScope()
    origin.storage.setItem("pld-evidences-documents", JSON.stringify([{ id: "doc-a", fileName: "a.pdf", fileData: "data:application/pdf;base64,QQ==" }]))
    await dataStarted.promise
    const switching = loadCompanyStorage(b)
    assert.equal(isModuleScopeCurrent(origin), false, "invalidate as soon as switching starts")
    assert.throws(() => getModuleStorage(), /empresa o el acceso cambió/)
    assert.throws(() => origin.storage.setItem("pld-training-module", "{}"), /empresa o el acceso cambió/)
    dataReady.resolve(); await uploadStarted.promise
    assert.equal(writes[0], "/api/v1/companies/company-a/files")
    uploadReady.resolve(); await snapshotStarted.promise
    assert.equal(writes.filter((path) => path.includes(b.id)).length, 0)
    assert.throws(() => origin.storage.setItem("pld-training-module", "{}"), /empresa o el acceso cambió/)
    snapshotReady.resolve(); await switching
    deferB = false; await loadCompanyStorage(a)
    assert.throws(() => origin.storage.getItem("pld-evidences-documents"), /empresa o el acceso cambió/, "A→B→A must not revive the original generation")
    assert.match(getModuleStorage().getItem("pld-evidences-documents")!, /company-a\/files\/file-v1/)
    const beforeReload = captureModuleScope(); await loadCompanyStorage(a)
    assert.equal(isModuleScopeCurrent(beforeReload), false, "reloading the same company also invalidates callbacks")

    const readReady = deferred<string>()
    const beforeRead = captureModuleScope()
    let updatedUi = false
    const finishRead = (async () => { const url = await readReady.promise; assertModuleScope(beforeRead); beforeRead.storage.setItem("pld-training-module", JSON.stringify({ documents: [{ id: "late", dataUrl: url }] })); await flushModuleStorage(beforeRead); assertModuleScope(beforeRead); updatedUi = true })()
    const rejected = assert.rejects(finishRead, /empresa o el acceso cambió/)
    await loadCompanyStorage(b); readReady.resolve("data:application/pdf;base64,QQ=="); await rejected
    assert.equal(updatedUi, false); assert.equal(getModuleStorage().getItem("pld-training-module"), null)
  } finally { globalThis.fetch = original; resetCompanyStorage() }
})

test("reauthentication invalidates an upload and old storage; failed save retains uploaded-file cache", async () => {
  const original = globalThis.fetch
  const started = deferred(), finish = deferred()
  let waitUpload = true, uploads = 0, conflict = false
  globalThis.fetch = async (input, init) => {
    const path = String(input)
    if (path.startsWith("data:")) return new Response("PDF", { headers: { "content-type": "application/pdf" } })
    if (path.endsWith("/snapshot")) return json({ records: [] })
    if (path.endsWith("/files")) { uploads++; started.resolve(); if (waitUpload) await finish.promise; return json({ id: "v1", downloadUrl: "/api/v1/companies/company-a/files/v1" }, 201) }
    if (path.endsWith("/records/batch")) {
      if (conflict) return json({ error: "Conflicto conservado" }, 409)
      return json({ records: JSON.parse(String(init?.body)).mutations.map((item: any) => ({ ...item, revision: item.expectedRevision + 1 })) })
    }
    throw new Error(path)
  }
  try {
    configurePilotSession(session); await loadCompanyStorage(a)
    const before = captureModuleScope()
    const uploading = uploadPilotFile(new File(["PDF"], "proof.pdf", { type: "application/pdf" }), "evidencias")
    const rejected = assert.rejects(uploading, /empresa o el acceso cambió/)
    await started.promise
    configurePilotSession(null); configurePilotSession(session)
    finish.resolve(); await rejected
    assert.throws(() => before.storage.setItem("pld-training-module", "{}"), /empresa o el acceso cambió/)
    waitUpload = false; conflict = true
    getModuleStorage().setItem("pld-evidences-documents", JSON.stringify([{ id: "doc", fileName: "proof.pdf", fileData: "data:application/pdf;base64,QQ==" }]))
    await assert.rejects(flushModuleStorage(), /Conflicto conservado/)
    assert.equal(uploads, 2)
    conflict = false; await retryModuleStorage()
    assert.equal(uploads, 2, "retry must reuse the legitimate upload from the failed batch")
  } finally { globalThis.fetch = original; resetCompanyStorage() }
})

test("two deferred BC uploads merge the latest archive, notes and document history", async () => {
  const data = new Map<string, string>()
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
  const key = "beneficiario-controlador-data"
  storage.setItem(key, JSON.stringify({ schemaVersion: 3, profiles: { client: { documentos: [{ id: "old", archived: false, url: "version-old", sha256: "same" }], trazabilidad: [], preguntas: [{ id: "q", notes: "original" }], validation: { signature: "old" } } } }))
  const one = deferred(), two = deferred()
  const upload = async (id: string, read: Promise<void>) => { await read; return appendClientProfileDocument(storage, key, "client", { id, url: `version-${id}`, sha256: "same" }, { id: `trace-${id}` }) }
  const first = upload("first", one.promise), second = upload("second", two.promise)
  const latest = JSON.parse(storage.getItem(key)!); latest.profiles.client.documentos[0].archived = true; latest.profiles.client.preguntas[0].notes = "concurrent note"; storage.setItem(key, JSON.stringify(latest))
  two.resolve(); await second; one.resolve(); await first
  const final = readClientProfile(storage.getItem(key), "client")
  assert.deepEqual(final.documentos.map((doc: any) => doc.id), ["old", "second", "first"])
  assert.equal(final.documentos[0].archived, true); assert.equal(final.preguntas[0].notes, "concurrent note"); assert.equal(final.trazabilidad.length, 2); assert.equal(final.validation, null)
  const signature = beneficiaryReviewSignature(final)
  final.documentos[1].url = "different-version-same-claimed-hash"
  assert.notEqual(beneficiaryReviewSignature(final), signature)
})
