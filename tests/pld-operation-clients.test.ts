import assert from "node:assert/strict"
import test from "node:test"
import { mergeOperationClientsById, operationClientFromSnapshot, readSavedOperationClient } from "../lib/pld/operation-clients"
import { resolveOperationClientIdentity } from "../lib/pld/operation-client-identity"
import { createStoredPldOperation, loadStoredPldOperations, recalculateStoredPldOperationsChronologically, sanitizeStoredPldOperation, storedPldClientIdentity } from "../lib/pld/stored-operations"

const first="c7253e8e-9efa-4d72-91e3-353770b1071f",second="42887e43-0e14-48af-9358-e5bd2cd53ba5"
const rfc="LUPA7906228V4"
function operation(id:string,clienteId?:string,date="2026-05-10"){
  const op=createStoredPldOperation({id,clienteId,cliente:"Cliente ficticio",rfc,tipoCliente:"pf_residente",actividadKey:"fraccion-viii-vehiculos",actividadNombre:"Vehículos",
    fechaOperacion:date,monto:400000,montoCentavos:40000000,moneda:"MXN",captureStatus:"complete",tipoOperacion:"Adquisición",sujetoObligado:{id:"company",rfc:"EQA260101AB1"}})
  assert.ok(op);return op
}
test("manual clients sharing RFC stay separate; explicitly reusing the same ID accumulates",()=>{
  const one=operation("one",first),two=operation("two",second,"2026-05-11")
  assert.notEqual(storedPldClientIdentity(one),storedPldClientIdentity(two))
  const separate=recalculateStoredPldOperationsChronologically([one,two])
  assert.equal(separate[1].umbralStatus,"identificacion")
  const shared=recalculateStoredPldOperationsChronologically([one,{...two,clienteId:first}])
  assert.equal(shared[1].umbralStatus,"aviso")
  assert.equal(shared[1].acumuladoClienteCentavos,80000000)
  assert.notEqual(storedPldClientIdentity(operation("old-one")),storedPldClientIdentity(operation("old-two")),"unlinked legacy snapshots do not silently merge by RFC")
})
test("saved client index and operations-only reuse preserve CURP/NIF with opaque stable IDs",()=>{
  const curp=readSavedOperationClient({id:first,nombre:"Cliente CURP",tipoCliente:"pf_residente",identifiers:{curp:"LUPA790622MNLNRD03"}},0)!
  const nif=readSavedOperationClient({id:second,nombre:"Cliente NIF",tipoCliente:"pm_extranjera",identifiers:{nif:"FOREIGN-42"}},1)!
  assert.equal(curp.rfc,"");assert.equal(nif.rfc,"")
  assert.equal(mergeOperationClientsById([curp],[{...curp,id:second}]).length,2)
  for(const client of [curp,nif]){
    const identity=resolveOperationClientIdentity({clientId:client.id,tipoCliente:client.tipoCliente,identifiers:client.identifiers})
    assert.equal(identity.key,`cliente:${client.id}`);assert.equal(identity.error,null)
    const visible=operationClientFromSnapshot({clienteId:client.id,cliente:client.nombre,rfc:"",identifiers:client.identifiers,tipoCliente:client.tipoCliente,mismoGrupo:false})!
    assert.equal(visible.id,client.id);assert.deepEqual(visible.identifiers,client.identifiers)
  }
  assert.equal(operationClientFromSnapshot({cliente:"Legacy",rfc,tipoCliente:"pf_residente",mismoGrupo:false}),null)
})
test("legacy index entries receive independent position IDs, never RFC-derived identity",()=>{
  const a=readSavedOperationClient({nombre:"Mismo nombre",rfc},0)!,b=readSavedOperationClient({nombre:"Mismo nombre",rfc},1)!
  assert.notEqual(a.id,b.id);assert.equal(a.id.includes(rfc),false)
  assert.equal(resolveOperationClientIdentity({tipoCliente:"pf_residente",rfcText:rfc}).key,"")
})
test("unlinked legacy obligations stay historical and require explicit review instead of being lowered",()=>{
  const baseline=operation("legacy-one",first)
  const legacy={...baseline,clienteId:undefined,captureStatus:"complete",umbralStatus:"aviso",acumuladoClienteCentavos:80000000,acumuladoCliente:800000,avisoSalidaTipo:"aviso_normal"}
  const raw=JSON.stringify([legacy,{...legacy,id:"legacy-two"}]);let writes=0
  const loaded=loadStoredPldOperations({getItem:()=>raw,setItem:()=>{writes++}})
  const reviewed=recalculateStoredPldOperationsChronologically(loaded.operations)
  assert.equal(writes,0)
  for(const op of reviewed){assert.equal(op.clientIdentityReviewRequired,true);assert.equal(op.captureStatus,"draft");assert.equal(op.umbralStatus,"aviso");assert.equal(op.acumuladoClienteCentavos,80000000);assert.equal(op.revision,baseline.revision)}
  const presented=sanitizeStoredPldOperation({...legacy,id:"presented",avisoPresentado:true,submission:{...baseline.submission,status:"presented",wasEverPresented:true,presentedAt:"2026-05-12T12:00:00Z"}})!
  const after=recalculateStoredPldOperationsChronologically([presented])[0]
  assert.equal(after.captureStatus,"complete");assert.equal(after.umbralStatus,"aviso");assert.deepEqual(after.history,presented.history);assert.deepEqual(after.submission,presented.submission);assert.equal(after.revision,presented.revision)
})
