import test from "node:test"
import assert from "node:assert/strict"
import { createStoredPldOperation } from "../lib/pld/stored-operations"
import { mergeImportedOperations,type OperationImportRow } from "../lib/pld/import-operations"
import { IMPORT_CLIENT_LINK_MISSING,applyMappedImportClients,readImportClientTargets,requireImportClientResolution,resolveImportRowClient,type ImportClientTarget } from "../lib/pld/import-client-resolution"

const id="c1111111-1111-4111-8111-111111111111",otherId="c2222222-2222-4222-8222-222222222222"
const target:ImportClientTarget={id,kind:"client",nombre:"Cliente Prueba",identifiers:{rfc:"DLV190624M32"},tipoCliente:"pm_mexicana"}
function row(operationId:string,date:string):OperationImportRow{
  const operation=createStoredPldOperation({id:operationId,actividadKey:"fraccion-viii-vehiculos",actividadNombre:"Vehículos",cliente:target.nombre,rfc:target.identifiers.rfc,tipoCliente:"pm_mexicana",expedienteIdentifiers:target.identifiers,
    montoCentavos:37_656_510,moneda:"MXN",fechaOperacion:date,captureStatus:"draft",importSource:{fileName:"captura.xlsm",fileHash:operationId,sheet:"SAT",row:1},importMissing:[IMPORT_CLIENT_LINK_MISSING],importClientResolutionPending:true},
    {at:"2026-11-11T12:00:00Z",actor:"qa",sujetoObligado:{id:"company-one",rfc:"ISN2103158Q7",nombre:"QA"}})!
  return {id:operationId,rowNumber:1,status:"incomplete",issues:[IMPORT_CLIENT_LINK_MISSING],operation,source:{fileName:"captura.xlsm",fileHash:operationId,sheet:"SAT",row:1}}
}
test("two imported rows explicitly assigned to one stable client accumulate",()=>{
  const rows=[row("op-one","2026-02-01"),row("op-two","2026-03-01")].map((item)=>resolveImportRowClient(item,{kind:"client",id},[target]))
  const saved=mergeImportedOperations([],rows,rows.map((item)=>item.id),false)
  assert.equal(saved.added,2);assert.ok(rows.every((item)=>item.status==="valid"));assert.equal(saved.operations[1].acumuladoClienteCentavos,75_313_020)
  assert.equal(saved.operations[1].umbralStatus,"aviso")
})
test("same RFC with two explicitly different stable client IDs never merges",()=>{
  const targets=[target,{...target,id:otherId,nombre:"Otro expediente del cliente"}]
  const rows=[resolveImportRowClient(row("op-a","2026-02-01"),{kind:"client",id},targets),resolveImportRowClient(row("op-b","2026-03-01"),{kind:"client",id:otherId},targets)]
  const saved=mergeImportedOperations([],rows,rows.map((item)=>item.id),false)
  assert.equal(saved.operations[1].acumuladoClienteCentavos,37_656_510);assert.equal(saved.operations[1].umbralStatus,"identificacion")
})
test("unresolved or foreign mapped IDs cannot make a row complete",()=>{
  const item=row("op-unresolved","2026-02-01");item.operation.importClientResolutionRequest={clientId:"foreign-client"}
  assert.equal(applyMappedImportClients([item],[target])[0].operation.captureStatus,"draft")
  assert.throws(()=>resolveImportRowClient(item,{kind:"client",id:"foreign-client"},[target]),/disponible/)
  assert.throws(()=>resolveImportRowClient(item,{kind:"client",id},[{...target,identifiers:{rfc:"AAA010101AAA"}}]),/distinto/)
  assert.equal(mergeImportedOperations([],[item],[item.id],false).added,0)
  const cached={...item,status:"valid" as const,issues:[],operation:{...item.operation,captureStatus:"complete" as const,clienteId:"old-hash-row"}}
  assert.equal(requireImportClientResolution([cached])[0].operation.captureStatus,"draft")
})
test("an intentional provisional group can be reused from the canonical index in another file",()=>{
  const client={id,nombre:target.nombre,rfc:target.identifiers.rfc!,identifiers:target.identifiers,tipoCliente:"pm_mexicana"}
  const first=resolveImportRowClient(row("op-first-file","2026-02-01"),{kind:"provisional",id,client},[])
  assert.equal(first.operation.clienteId,id)
  assert.equal(first.operation.clientIdentityReviewRequired,false)
  const storage={getItem:(key:string)=>key==="actividades_vulnerables_clientes"?JSON.stringify([client]):null}
  const targets=readImportClientTargets(storage)
  const second=resolveImportRowClient(row("op-second-file","2026-03-01"),{kind:"client",id},targets)
  const saved=mergeImportedOperations([],[first,second],[first.id,second.id],false)
  assert.equal(saved.operations[1].acumuladoClienteCentavos,75_313_020)
  const visible=readImportClientTargets({getItem:()=>null},[first.operation]);assert.equal(visible[0].id,id)
})
test("visible operation references never grant a new EUI link without EUI access",()=>{
  const operation={...row("op-visible","2026-02-01").operation,expedienteReferenciado:"private-eui",expedienteId:"private-eui"}
  assert.deepEqual(readImportClientTargets({getItem:()=>null},[operation]),[])
  const targets=readImportClientTargets({getItem:()=>null},[{...operation,clienteId:id}])
  assert.equal(targets.length,1);assert.equal(targets[0].kind,"client");assert.equal(targets[0].id,id)
})
