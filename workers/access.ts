import { ApiError, type CompanyRow, type GrantRow, type MembershipRow, type PilotActor, type PilotEnv } from "./types"
import { COLLECTION_MODULES } from "../lib/pilot/contracts"

export const MODULES = ["registro", "expedientes", "operaciones", "avisos", "ebr", "pep", "beneficiario", "evidencias", "capacitacion", "auditoria", "gobernanza"] as const
export const ACTIONS = ["view", "edit", "upload", "download", "approve", "archive"] as const
export const COLLECTION_MODULE: Record<string, string> = COLLECTION_MODULES

export function roleActions(role: string): string[] {
  if (role === "admin" || role === "compliance") return [...ACTIONS]
  if (role === "capture") return ["view", "edit", "upload", "download"]
  return ["view", "download"]
}
export async function getMembership(actor: PilotActor, organizationId: string, env: PilotEnv) {
  return env.DB.prepare("SELECT * FROM pld_memberships WHERE userId=? AND organizationId=?").bind(actor.id, organizationId).first<MembershipRow>()
}
export async function requireOrgAdmin(actor: PilotActor, organizationId: string, env: PilotEnv) {
  if (actor.platformRole === "superadmin") return
  const membership = await getMembership(actor, organizationId, env)
  if (membership?.role !== "admin") throw new ApiError(403, "No puedes administrar esta organización.", "FORBIDDEN")
}
export async function requireCompany(actor: PilotActor, companyId: string, env: PilotEnv, moduleKey = "", action = "view") {
  if(companyId.startsWith("inbox:")){
    const parts=companyId.split(":");if(parts.length!==3)throw new ApiError(404,"Bandeja no disponible.","NOT_FOUND")
    const [,organizationId,ownerId]=parts,membership=await getMembership(actor,organizationId,env)
    if(actor.platformRole!=="superadmin"&&(!membership||(ownerId!==actor.id&&membership.role!=="admin")))throw new ApiError(404,"Bandeja no disponible.","NOT_FOUND")
    if(moduleKey&&moduleKey!=="expedientes")throw new ApiError(403,"La bandeja privada sólo conserva expedientes sin asignar.","FORBIDDEN")
    if(actor.platformRole!=="superadmin"&&membership?.role!=="admin"&&!roleActions(membership?.role||"viewer").includes(action))throw new ApiError(403,"No tienes permiso para esta acción.","FORBIDDEN")
    const at=new Date().toISOString()
    await env.DB.prepare("INSERT OR IGNORE INTO pld_companies(id,organizationId,name,rfc,status,isInbox,createdAt,updatedAt) VALUES(?,?,'Expedientes sin asignar','','active',1,?,?)").bind(companyId,organizationId,at,at).run()
    return {id:companyId,organizationId,name:"Expedientes sin asignar",rfc:"",status:"active"} as CompanyRow
  }
  const company = await env.DB.prepare("SELECT id,organizationId,name,rfc,status FROM pld_companies WHERE id=?").bind(companyId).first<CompanyRow>()
  if (!company) throw new ApiError(404, "Empresa no disponible.", "NOT_FOUND")
  if (company.status !== "active" && action !== "view" && action !== "download") throw new ApiError(409, "La empresa está archivada.", "COMPANY_ARCHIVED")
  if (actor.platformRole === "superadmin") return company
  const membership = await getMembership(actor, company.organizationId, env)
  if (!membership) throw new ApiError(404, "Empresa no disponible.", "NOT_FOUND")
  if (membership.role === "admin") return company
  const grant = await env.DB.prepare("SELECT * FROM pld_grants WHERE userId=? AND companyId=?").bind(actor.id, companyId).first<{role:string;permissions:string}>()
  if (!grant) throw new ApiError(404, "Empresa no disponible.", "NOT_FOUND")
  const permissions = JSON.parse(grant.permissions) as Record<string, string[]>
  if(!moduleKey&&!Object.values(permissions).some((actions)=>Array.isArray(actions)&&actions.includes("view")))throw new ApiError(404,"Empresa no disponible.","NOT_FOUND")
  const allowed = !moduleKey || (permissions[moduleKey] ?? []).includes(action)
  if (!allowed) throw new ApiError(403, "No tienes permiso para esta acción.", "FORBIDDEN")
  return company
}

export function collectionModule(collection: string) {
  const module = COLLECTION_MODULE[collection]
  if (!module) throw new ApiError(400, "Colección no reconocida.", "INVALID_COLLECTION")
  return module
}

export async function audit(env: PilotEnv, actor: PilotActor, action: string, entityType: string, entityId: string, organizationId?: string, companyId?: string, details: Record<string, unknown> = {}) {
  await auditStatement(env, actor, action, entityType, entityId, organizationId, companyId, details).run()
}
export function auditStatement(env: PilotEnv, actor: PilotActor, action: string, entityType: string, entityId: string, organizationId?: string, companyId?: string, details: Record<string, unknown> = {}) {
  return env.DB.prepare("INSERT INTO pld_audit (id,organizationId,companyId,actorId,action,entityType,entityId,details,createdAt) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), organizationId || null, companyId || null, actor.id, action, entityType, entityId, JSON.stringify(details), new Date().toISOString())
}
