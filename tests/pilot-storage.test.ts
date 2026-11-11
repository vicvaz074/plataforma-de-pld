import assert from "node:assert/strict"
import test from "node:test"
import { encodeCollection, decodeCollection, diffCollection } from "../lib/pilot/record-codecs"
import { sessionCan, rolePermissions, type CloudRecord, type PilotSession } from "../lib/pilot/contracts"
import { configurePilotSession, flushModuleStorage, getActiveCompany, getModuleStorage, getSaveState, loadCompanyStorage, resetCompanyStorage, retryModuleStorage } from "../lib/pilot/module-storage"

test("company permissions and record codecs keep distinct documents for the same expediente",()=>{
  const encoded=encodeCollection("pld-evidences-documents",[{id:"doc-a",expedienteId:"client"},{id:"doc-b",expedienteId:"client"}])
  assert.equal(encoded.size,2)
  assert.throws(()=>encodeCollection("actividades_vulnerables_operaciones",[{id:"same"},{id:"same"}]),/duplicados/)
  const old:CloudRecord[]=[{collection:"actividades_vulnerables_operaciones",id:"old",revision:7,payload:{id:"old",monto:10}}]
  const mutations=diffCollection("actividades_vulnerables_operaciones",new Map([["old",{id:"old",monto:20}]]),old)
  assert.equal(mutations[0].expectedRevision,7)
  assert.deepEqual(decodeCollection("actividades_vulnerables_operaciones",old),[{id:"old",monto:10}])
  const company={id:"company-a",organizationId:"org-a",name:"Empresa A",rfc:"AAA010101AAA",status:"active" as const}
  const session:PilotSession={user:{id:"user",name:"Captura",email:"test@example.test",platformRole:"user",status:"active",requiresPasswordChange:false,twoFactorEnabled:false},organizations:[{id:"org-a",name:"Org",mfaEnabled:false}],companies:[company],memberships:[{organizationId:"org-a",userId:"user",role:"capture"}],grants:[{companyId:"company-a",userId:"user",permissions:rolePermissions("capture")}],mfaRequired:false}
  assert.equal(sessionCan(session,company,"operaciones","edit"),true)
  assert.equal(sessionCan(session,company,"operaciones","approve"),false)
  assert.equal(sessionCan(session,{...company,id:"company-b"},"operaciones","view"),false)
})

test("connected storage saves individual records, externalizes files and preserves pending changes on conflict",async()=>{
  const original=globalThis.fetch
  const company={id:"company-a",organizationId:"org-a",name:"Empresa A",rfc:"AAA010101AAA",status:"active" as const}
  const session:PilotSession={user:{id:"supreme",name:"QA",email:"qa@example.test",platformRole:"superadmin",status:"active",requiresPasswordChange:false,twoFactorEnabled:false},organizations:[],companies:[company],memberships:[],grants:[],mfaRequired:false}
  let persisted:CloudRecord[]=[];let conflict=false;let uploads=0;const requests:string[]=[]
  globalThis.fetch=async(input,init)=>{
    const path=String(input);requests.push(path)
    if(path.startsWith("data:"))return original(input,init)
    if(path.endsWith("/snapshot"))return new Response(JSON.stringify({records:persisted}),{status:200})
    if(path.endsWith("/files")){uploads++;return new Response(JSON.stringify({id:"file-v1",documentId:"doc",version:1,sha256:"hash",downloadUrl:"/api/v1/companies/company-a/files/file-v1"}),{status:201})}
    if(path.endsWith("/records/batch")){
      if(conflict)return new Response(JSON.stringify({error:"Cambió en otra sesión"}),{status:409})
      const body=JSON.parse(String(init?.body))
      const next=body.mutations.map((item:any)=>({collection:item.collection,id:item.id,revision:item.expectedRevision+1,payload:item.payload,deleted:item.deleted}))
      if(body.mutations.some((item:any)=>item.collection==="actividades_vulnerables_operaciones"))next.push({collection:"pld-sat-output-packages",id:"satpkg-operation-1",revision:1,payload:{id:"satpkg-operation-1",sourceOperationId:"operation-1"}})
      const ids=new Set(next.map((item:any)=>item.collection+"|"+item.id));persisted=[...persisted.filter(item=>!ids.has(item.collection+"|"+item.id)),...next]
      return new Response(JSON.stringify({records:next}),{status:200})
    }
    throw new Error("Unexpected endpoint "+path)
  }
  try{
    configurePilotSession(session);await loadCompanyStorage(company)
    const storage=getModuleStorage()
    storage.setItem("actividades_vulnerables_operaciones",JSON.stringify([{id:"operation-1",montoCentavos:1_000_000_000,monto:10_000_000}]))
    await flushModuleStorage();assert.equal(persisted.find(item=>item.id==="operation-1")?.revision,1)
    assert.equal(JSON.parse(storage.getItem("pld-sat-output-packages")!)[0].sourceOperationId,"operation-1")
    const doc={id:"doc-1",fileName:"example.pdf",fileData:"data:application/pdf;base64,JVBERi0xLjQK"}
    storage.setItem("pld-evidences-documents",JSON.stringify([doc]));await flushModuleStorage()
    assert.equal(uploads,1);assert.doesNotMatch(JSON.stringify(persisted),/base64/)
    assert.match(storage.getItem("pld-evidences-documents")!,/file-v1/)
    storage.setItem("pld-training-module",JSON.stringify({documents:[doc]}));await flushModuleStorage()
    assert.equal(uploads,2,"The same bytes in a different module need an independently authorized file reference")
    storage.setItem("pld-evidences-documents",JSON.stringify([doc,{id:"record-json",fileName:"registro.json",fileData:"data:application/json;charset=utf-8,%7B%22id%22%3A%22cliente%22%7D"}]))
    await flushModuleStorage();assert.equal(uploads,3);assert.doesNotMatch(JSON.stringify(persisted),/data:application\/json/)
    conflict=true
    storage.setItem("actividades_vulnerables_operaciones",JSON.stringify([{id:"operation-1",montoCentavos:1_000_000_001,monto:10_000_000.01}]))
    await assert.rejects(flushModuleStorage(),/Cambió/)
    assert.equal(getSaveState().status,"error")
    await assert.rejects(loadCompanyStorage({...company,id:"company-b"}),/Cambió/)
    assert.equal(getActiveCompany()?.id,"company-a")
    conflict=false;await retryModuleStorage();assert.equal(getSaveState().status,"saved")
    assert.equal((persisted.find(item=>item.id==="operation-1")?.payload as any).montoCentavos,1_000_000_001)
    assert.equal(requests.some(path=>path.includes("company-b")),false)
  }finally{globalThis.fetch=original;resetCompanyStorage()}
})
