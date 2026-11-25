import type { RecordMutation } from "./contracts"

export type RecoveryBody = { kind: "records"; mutations: RecordMutation[] } | { kind: "file"; collection: string; name: string; data: string }
export type RecoverySummary = { id: string; kind: RecoveryBody["kind"]; collections: string[]; hasFiles: boolean; createdAt: string }
export type Recovery = RecoverySummary & { companyId: string; body: RecoveryBody }
export function isStationRenderer() {
  return typeof window !== "undefined" && window.location.protocol === "https:" && /Electron\//i.test(window.navigator.userAgent)
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
