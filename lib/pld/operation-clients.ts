import { normalizeExpedienteIdentifiers, type ExpedienteIdentifiers } from "./expediente-eui"

export interface SavedOperationClient {
  id:string; rfc:string; identifiers:ExpedienteIdentifiers; nombre:string; tipoCliente:string;
  mismoGrupo:boolean; detalleTipoCliente?:string
}
const text=(input:unknown)=>typeof input==="string"?input.trim():""
export function readSavedOperationClient(input:unknown,legacyPosition:number):SavedOperationClient|null{
  if(!input||typeof input!=="object"||Array.isArray(input))return null
  const raw=input as Record<string,unknown>,nombre=text(raw.nombre)||text(raw.cliente)
  if(!nombre)return null
  const source=(raw.identifiers&&typeof raw.identifiers==="object"?raw.identifiers:raw.expedienteIdentifiers&&typeof raw.expedienteIdentifiers==="object"?raw.expedienteIdentifiers:raw) as Record<string,unknown>
  const identifiers=normalizeExpedienteIdentifiers({rfc:text(source.rfc),curp:text(source.curp),nif:text(source.nif)})
  return {...raw,id:text(raw.id)||text(raw.clienteId)||`legacy-client-position-${legacyPosition}`,nombre,rfc:identifiers.rfc,identifiers,
    tipoCliente:text(raw.tipoCliente)||"pf_residente",mismoGrupo:raw.mismoGrupo===true,detalleTipoCliente:text(raw.detalleTipoCliente)||undefined}
}
export function mergeOperationClientsById<T extends SavedOperationClient>(clients:readonly T[],incoming:readonly T[]):T[]{
  const result=new Map(clients.map(client=>[client.id,client]))
  for(const client of incoming)result.set(client.id,{...result.get(client.id),...client})
  return [...result.values()].sort((a,b)=>a.nombre.localeCompare(b.nombre,"es"))
}
/** The visible operation snapshot can be reused by ID without reading a richer
 * client index from a module the user cannot access. Unlinked legacy rows are
 * not assigned/merged through RFC, CURP or NIF. */
export function operationClientFromSnapshot(operation:{clienteId?:unknown;cliente:string;rfc:string;identifiers?:unknown;expedienteIdentifiers?:unknown;tipoCliente:string;mismoGrupo:boolean;detalleTipoCliente?:string}):SavedOperationClient|null{
  const id=text(operation.clienteId)
  return id?readSavedOperationClient({id,nombre:operation.cliente,rfc:operation.rfc,identifiers:operation.identifiers||operation.expedienteIdentifiers,
    tipoCliente:operation.tipoCliente,mismoGrupo:operation.mismoGrupo,detalleTipoCliente:operation.detalleTipoCliente},0):null
}
