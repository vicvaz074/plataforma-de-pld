import { requireCompany } from "./access"
import { identifier } from "./http"
import { ApiError, type DbStatement, type PilotActor, type PilotEnv } from "./types"
import { getIntegrationClient } from "../lib/pld/integration-records"
import { resolveImportRowClient, type ImportClientDecision } from "../lib/pld/import-client-resolution"

type Data=Record<string,unknown>
const object=(value:unknown):value is Data=>Boolean(value&&typeof value==="object"&&!Array.isArray(value))
const value=(input:unknown)=>typeof input==="string"?input.trim():""
const ref=(input:Data)=>value(input.expedienteId)||value(input.expedienteReferenciado)
const clientRef=(input:Data)=>value(input.clienteId)||value(input.clientId)
const archived=(input:Data)=>input.archived===true||input.archivado===true||["archived","archivado","cancelled"].includes(String(input.status||input.estado||""))

/** References are resolved by exact scoped ID, never by RFC/name similarity. */
export async function validateOperationReferences(input:{payload:Data;previous?:Data;operationId:string;companyId:string;actor:PilotActor;env:PilotEnv;mutations:unknown[];derivedKeys:Set<string>;at:string}){
  const {payload,previous,companyId,env,actor}=input,guards:DbStatement[]=[]
  if(value(payload.expedienteId)&&value(payload.expedienteReferenciado)&&payload.expedienteId!==payload.expedienteReferenciado)throw new ApiError(400,"Las referencias de expediente deben identificar el mismo registro.","AMBIGUOUS_EXPEDIENTE_REFERENCE")
  const expedienteId=ref(payload),previousRef=previous?ref(previous):"",resolution=object(payload.importClientResolution)?payload.importClientResolution:undefined
  const changedIdentity=!previous||expedienteId!==previousRef||clientRef(payload)!==clientRef(previous)
  const imported=object(payload.importSource)
  if(imported&&payload.captureStatus!=="draft"&&(!previous||previous.captureStatus==="draft"||payload.importClientResolutionPending===true)&&!resolution)throw new ApiError(400,"Resuelve explícitamente el cliente de la importación antes de completarla.","IMPORT_CLIENT_RESOLUTION_REQUIRED")
  const guard=(collection:string,id:string,revision:number)=>{
    const key=crypto.randomUUID()
    guards.push(env.DB.prepare("INSERT INTO pld_revision_guard(id,valid) VALUES(?,CASE WHEN COALESCE((SELECT revision FROM pld_records WHERE companyId=? AND collection=? AND id=?),0)=? THEN 1 ELSE 0 END)").bind(key,companyId,collection,id,revision),env.DB.prepare("DELETE FROM pld_revision_guard WHERE id=?").bind(key))
  }
  const find=async(collection:string,id:string)=>{
    const pending=input.mutations.find((item)=>object(item)&&item.collection===collection&&item.id===id)
    const row=await env.DB.prepare("SELECT revision,payload,deleted FROM pld_records WHERE companyId=? AND collection=? AND id=?").bind(companyId,collection,id).first<{revision:number;payload:string;deleted:number}>()
    if(object(pending)){
      if(pending.deleted===true||!object(pending.payload))throw new ApiError(409,"La referencia se está retirando o no tiene datos válidos.","REFERENCE_NOT_AVAILABLE")
      const expected=Number(pending.expectedRevision)
      if(!Number.isSafeInteger(expected)||expected<0||(row?.revision||0)!==expected)throw new ApiError(409,"La referencia cambió en otra sesión.","REVISION_CONFLICT")
      guard(collection,id,expected)
      return {payload:pending.payload,revision:expected,pending:true}
    }
    if(!row||row.deleted)return undefined
    const data=JSON.parse(row.payload) as unknown
    if(!object(data))throw new ApiError(409,"La referencia necesita revisión antes de vincularla.","REFERENCE_NOT_AVAILABLE")
    guard(collection,id,row.revision)
    return {payload:data,revision:row.revision,pending:false}
  }
  let expediente:Awaited<ReturnType<typeof find>>
  // An unchanged historical link does not require re-opening an archived EUI.
  if(expedienteId&&changedIdentity){
    await requireCompany(actor,companyId,env,"expedientes","view")
    expediente=await find("kyc_expedientes_detalle",expedienteId)
    if(!expediente)throw new ApiError(404,"El expediente no está disponible en esta empresa.","EXPEDIENTE_NOT_FOUND")
    if(archived(expediente.payload))throw new ApiError(409,"El expediente está archivado; no se vincula a una operación nueva.","EXPEDIENTE_ARCHIVED")
    const identity=value(expediente.payload.expedienteId)||value(expediente.payload.id)
    if(identity&&identity!==expedienteId)throw new ApiError(409,"El ID del expediente requiere revisión.","EXPEDIENTE_IDENTITY_MISMATCH")
  }
  let derivedClient:{collection:string;id:string;expectedRevision:number;payload:Data}|undefined
  if(resolution&&(!previous||changedIdentity||JSON.stringify(resolution)!==JSON.stringify(previous.importClientResolution))){
    const kind=String(resolution.kind),id=identifier(resolution.id)
    if(!["client","expediente","provisional"].includes(kind))throw new ApiError(400,"Decisión de cliente no válida.","INVALID_IMPORT_CLIENT")
    if(kind==="expediente"&&expedienteId!==id||kind!=="expediente"&&(expedienteId||clientRef(payload)!==id))throw new ApiError(400,"La decisión de importación no coincide con la identidad vinculada.","INVALID_IMPORT_CLIENT")
    let target:Data|undefined
    if(kind==="expediente"){
      if(!expediente){await requireCompany(actor,companyId,env,"expedientes","view");expediente=await find("kyc_expedientes_detalle",id)}
      if(!expediente||archived(expediente.payload))throw new ApiError(404,"El expediente seleccionado no está disponible en esta empresa.","EXPEDIENTE_NOT_FOUND")
      target=expediente.payload
    }else{
      const client=await find("actividades_vulnerables_clientes",id)
      if(kind==="client"){
        const operation=await env.DB.prepare("SELECT id,revision,payload FROM pld_records WHERE companyId=? AND collection='actividades_vulnerables_operaciones' AND (json_extract(payload,'$.clienteId')=? OR json_extract(payload,'$.clientId')=?) LIMIT 1").bind(companyId,id,id).first<{id:string;revision:number;payload:string}>()
        if(!client&&!operation)throw new ApiError(404,"El cliente seleccionado no está disponible en esta empresa.","CLIENT_NOT_FOUND")
        if(!operation)await requireCompany(actor,companyId,env,"expedientes","view")
        if(operation)guard("actividades_vulnerables_operaciones",operation.id,operation.revision)
        // Operations-only users reuse the snapshot they can already read,
        // never richer client-index data from a denied Expedientes module.
        target=operation?JSON.parse(operation.payload) as Data:client!.payload
      }else{
        if(!object(resolution.client)||value(resolution.client.id)!==id||!value(resolution.client.nombre)||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))throw new ApiError(400,"El grupo provisional requiere UUID estable y snapshot del cliente.","INVALID_PROVISIONAL_CLIENT")
        target=resolution.client
        if(client){
          const known=getIntegrationClient(client.payload),proposed=getIntegrationClient({...resolution.client,clienteId:id})
          if(!known||!proposed||JSON.stringify(known.identifiers)!==JSON.stringify(proposed.identifiers)||known.nombre.trim().toUpperCase()!==proposed.nombre.trim().toUpperCase())throw new ApiError(409,"El ID provisional ya corresponde a otro snapshot; selecciona el cliente existente.","CLIENT_IDENTITY_CONFLICT")
        }else{
          guard("actividades_vulnerables_clientes",id,0)
          derivedClient={collection:"actividades_vulnerables_clientes",id,expectedRevision:0,payload:{...resolution.client,id,clienteId:id,sourceModule:"operaciones",source:"operation-import",sourceOperationId:input.operationId,companyId,createdAt:input.at,updatedAt:input.at}}
        }
      }
    }
    const normalized=getIntegrationClient({...target,identifiers:object(target.identifiers)?target.identifiers:object(target.expedienteIdentifiers)?target.expedienteIdentifiers:object(target.identificadores)?target.identificadores:undefined})
    if(!normalized)throw new ApiError(400,"El cliente vinculado necesita un snapshot de identificación válido.","INVALID_IMPORT_CLIENT")
    try{resolveImportRowClient({operation:payload,rowNumber:1,status:"valid",issues:[]} as never,resolution as unknown as ImportClientDecision,[{kind:kind==="expediente"?"expediente":"client",id,nombre:normalized.nombre,identifiers:normalized.identifiers,tipoCliente:normalized.tipoCliente}])}catch(error){throw new ApiError(400,error instanceof Error?error.message:"La identidad importada no coincide con el cliente.","IMPORT_CLIENT_IDENTITY_MISMATCH")}
  }
  return {guards,derivedClient}
}
