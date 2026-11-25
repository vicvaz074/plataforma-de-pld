import type { CloudRecord, RecordMutation } from "./contracts"

export type RecoveryBody = { kind: "records"; mutations: RecordMutation[] } | { kind: "file"; collection: string; name: string; data: string }
export type RecoverySummary = { id: string; kind: RecoveryBody["kind"]; collections: string[]; hasFiles: boolean; createdAt: string }
export type Recovery = RecoverySummary & { companyId: string; body: RecoveryBody }
export function isStationRenderer() {
  return typeof window !== "undefined" && window.location.protocol === "https:" && /\bDavaraPLDStation\/1\b/.test(window.navigator.userAgent)
}
const endpoint = (companyId: string, id?: string) => "/api/v1/desktop-offline/recovery?" + new URLSearchParams({companyId,...(id?{id}:{})})
async function request<T>(company: string, id?: string, init?: RequestInit) {
  const r = await fetch(endpoint(company,id),{cache:"no-store",credentials:"same-origin",...init})
  const body = await r.json()
  if(!r.ok)throw Error(body?.error || "La estación no pudo conservar o recuperar el borrador.")
  return body as T
}
export const listRecovery = (company:string) => request<{items:RecoverySummary[]}>(company)
export const getRecovery = (company:string,id:string) => request<Recovery>(company,id)
export async function protectDraft(company:string,body:RecoveryBody) {
  const result=await request<{id:string;localOnly:true}>(company,undefined,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
  if(!result?.localOnly||!result.id)throw Error("La estación no confirmó su copia de recuperación.")
  window.dispatchEvent(new Event("pld-station-updated"))
  return result.id
}
export async function forgetDraft(company:string,id:string) {
  await request(company,id,{method:"DELETE",headers:{"x-pld-confirm":"yes"}})
  window.dispatchEvent(new Event("pld-station-updated"))
}

export type StationWrite = { records: CloudRecord[]; pending?: boolean; warnings?: Array<{message?:string;operationIds?:string[]}> }
/** Only the native broker owns a claimed journal: it serializes upload,
 * attachment association, revision checks and reconnect retries. Never fall
 * back to the legacy write after an ambiguous response. */
export async function commitStationDraft(company:string,id:string,expected:readonly RecordMutation[]):Promise<StationWrite|null> {
  const r=await fetch("/api/v1/desktop-offline/commit?"+new URLSearchParams({companyId:company,id}),{
    method:"POST",credentials:"same-origin",cache:"no-store"
  })
  const result=await r.json()
  if(r.status===422 && result?.code==="MANUAL_REPLAY_REQUIRED")return null
  const confirmed=r.status===200 && !r.headers.has("x-pld-offline") && !result?.pending
  const queued=r.status===202 && r.headers.get("x-pld-offline")==="pending" && result?.pending===true
  if(!(confirmed||queued) || !Array.isArray(result?.records) || !expected.every(m=>result.records.some((row:CloudRecord)=>row.collection===m.collection&&row.id===m.id&&row.revision===m.expectedRevision+1)))
    throw Error(result?.message || result?.error || "La estación no confirmó la revisión de cada registro. Su copia se conserva para revisión.")
  window.dispatchEvent(new Event("pld-station-updated"))
  return result
}
