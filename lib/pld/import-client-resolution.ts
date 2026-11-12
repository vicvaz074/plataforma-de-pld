import type { OperationImportRow } from "./import-operations"
import type { ExpedienteIdentifiers } from "./expediente-eui"
import { normalizeExpedienteIdentifiers } from "./expediente-eui"
import { getIntegrationClient,readExpedienteRecords,type IntegrationStorage } from "./integration-records"

export const IMPORT_CLIENT_LINK_MISSING="Selecciona un cliente existente o crea explícitamente un grupo provisional para esta fila."
export interface ImportClientTarget {id:string;kind:"client"|"expediente";nombre:string;identifiers:Partial<ExpedienteIdentifiers>;tipoCliente?:string}
export interface ProvisionalImportClient {id:string;nombre:string;rfc:string;identifiers:Partial<ExpedienteIdentifiers>;tipoCliente:string}
export type ImportClientDecision={kind:"client"|"expediente";id:string}|{kind:"provisional";id:string;client:ProvisionalImportClient}
const text=(value:unknown)=>typeof value==="string"?value.trim().toUpperCase():""
const family=(value:string|undefined)=>value?.startsWith("pf")?"pf":value?.startsWith("pm")?"pm":value==="fideicomiso"?"fideicomiso":""
export function readImportClientTargets(storage:Pick<IntegrationStorage,"getItem">,operations:readonly unknown[]=[]):ImportClientTarget[]{
  const targets:ImportClientTarget[]=[]
  for(const raw of readExpedienteRecords(storage)){const client=getIntegrationClient(raw);if(client?.expedienteId)targets.push({id:client.expedienteId,kind:"expediente",nombre:client.nombre,identifiers:client.identifiers,tipoCliente:client.tipoCliente})}
  const stored=storage.getItem("actividades_vulnerables_clientes")
  const clients:unknown=stored?JSON.parse(stored):[]
  if(!Array.isArray(clients))throw new Error("El índice de clientes necesita revisión antes de vincular importaciones.")
  for(const item of clients){if(!item||typeof item!=="object"||typeof item.id!=="string")continue;targets.push({id:item.id,kind:"client",nombre:String(item.nombre||item.cliente||"Cliente"),tipoCliente:String(item.tipoCliente||item.tipo||""),identifiers:normalizeExpedienteIdentifiers({...item.identifiers,rfc:item.identifiers?.rfc||item.rfc,nif:item.identifiers?.nif||item.nif,curp:item.identifiers?.curp||item.curp})})}
  // A visible operation authorizes reuse of its stable client snapshot, not
  // access to the referenced EUI. EUI targets come only from readable records.
  for(const raw of operations){const client=getIntegrationClient(raw);if(!client?.clientId)continue;targets.push({id:client.clientId,kind:"client",nombre:client.nombre,identifiers:client.identifiers,tipoCliente:client.tipoCliente})}
  return targets.filter((item,index)=>targets.findIndex((other)=>other.kind===item.kind&&other.id===item.id)===index)
}
export function resolveImportRowClient(row:OperationImportRow,decision:ImportClientDecision,targets:readonly ImportClientTarget[]):OperationImportRow{
  if(row.status==="duplicate"||row.status==="rejected")return row
  const target=decision.kind==="provisional"?{...decision.client,kind:"client" as const}:targets.find((item)=>item.kind===decision.kind&&item.id===decision.id)
  if(!target||!decision.id.trim()||target.id!==decision.id||!target.nombre.trim())throw new Error("Selecciona un cliente disponible de esta empresa.")
  if(decision.kind==="provisional"&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decision.id))throw new Error("El grupo provisional necesita un ID estable generado por la plataforma.")
  const source=(row.operation.expedienteIdentifiers||row.operation.identifiers||{rfc:row.operation.rfc}) as Partial<ExpedienteIdentifiers>
  for(const key of ["rfc","nif","curp"] as const)if(text(source[key])&&text(target.identifiers[key])&&text(source[key])!==text(target.identifiers[key]))throw new Error(`La fila ${row.rowNumber} tiene un ${key.toUpperCase()} distinto del cliente seleccionado.`)
  if(family(row.operation.tipoCliente)&&family(target.tipoCliente)&&family(row.operation.tipoCliente)!==family(target.tipoCliente))throw new Error(`La fila ${row.rowNumber} no corresponde al tipo de persona del cliente seleccionado.`)
  const issues=row.issues.filter((issue)=>issue!==IMPORT_CLIENT_LINK_MISSING)
  const operation={...row.operation,clienteId:decision.kind==="expediente"?undefined:decision.id,expedienteId:decision.kind==="expediente"?decision.id:undefined,expedienteReferenciado:decision.kind==="expediente"?decision.id:undefined,
    importClientResolution:decision.kind==="provisional"?{...decision,client:{...decision.client,identifiers:{...decision.client.identifiers}}}:{...decision},importClientResolutionPending:false,clientIdentityReviewRequired:false,
    importMissing:issues,captureStatus:issues.length?"draft" as const:"complete" as const}
  return {...row,issues,operation,status:issues.length?"incomplete":"valid"}
}

/** IDs supplied by a file are proposals, never permission or an implicit RFC match. */
export function applyMappedImportClients(rows:OperationImportRow[],targets:readonly ImportClientTarget[]):OperationImportRow[]{
  return rows.map((row)=>{
    const request=row.operation.importClientResolutionRequest as {clientId?:string;expedienteId?:string}|undefined
    const kind=request?.expedienteId?"expediente":request?.clientId?"client":undefined
    const id=request?.expedienteId||request?.clientId
    if(!kind||!id||!targets.some((item)=>item.kind===kind&&item.id===id))return row
    try{return resolveImportRowClient(row,{kind,id},targets)}catch{return row}
  })
}
export function requireImportClientResolution(rows:OperationImportRow[]):OperationImportRow[]{
  return rows.map((row)=>{
    if(row.status==="duplicate"||row.status==="rejected"||row.operation.importClientResolution)return row
    const issues=[...new Set([...row.issues,IMPORT_CLIENT_LINK_MISSING])]
    return {...row,status:"incomplete" as const,issues,operation:{...row.operation,clienteId:undefined,expedienteId:undefined,expedienteReferenciado:undefined,importClientResolutionPending:true,importMissing:issues,captureStatus:"draft" as const}}
  })
}
