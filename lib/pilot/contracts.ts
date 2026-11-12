export type ModuleKey = "registro" | "expedientes" | "operaciones" | "avisos" | "ebr" | "pep" | "beneficiario" | "evidencias" | "capacitacion" | "auditoria" | "gobernanza"
export type PermissionAction = "view" | "edit" | "upload" | "download" | "approve" | "archive"
export type OrganizationRole = "admin" | "compliance" | "capture" | "viewer"
export interface PilotUser { id: string; name: string; email: string; platformRole: "superadmin" | "user"; status: "active" | "suspended"; requiresPasswordChange: boolean; twoFactorEnabled: boolean; lastAccess?: number | string | null }
export interface Organization { id: string; name: string; mfaEnabled: boolean }
export interface Company { id: string; organizationId: string; name: string; rfc: string; status: "active" | "archived" }
export interface Membership { organizationId: string; userId: string; role: OrganizationRole }
export interface CompanyGrant { companyId: string; userId: string; permissions: Partial<Record<ModuleKey, PermissionAction[]>> }
export interface PilotSession { user: PilotUser; organizations: Organization[]; companies: Company[]; memberships: Membership[]; grants: CompanyGrant[]; mfaRequired: boolean }
export interface CloudRecord { collection: string; id: string; revision: number; payload: unknown; deleted?: boolean }
export interface RecordMutation { collection: string; id: string; expectedRevision: number; payload: unknown; deleted?: boolean }
export interface AuditEvent { id: string; actorId: string; action: string; organizationId?: string; companyId?: string; entityId?: string; createdAt: string }
export interface AdminSnapshot { organizations: Organization[]; companies: Company[]; users: PilotUser[]; memberships: Membership[]; grants: CompanyGrant[]; audit: AuditEvent[] }

/** Shared authorization vocabulary. Server grants are authoritative. */
export const MODULE_LABELS: Record<ModuleKey, string> = {
  registro: "Alta y registro", expedientes: "Expedientes", operaciones: "Actos y operaciones", avisos: "Avisos e informes",
  ebr: "EBR", pep: "WhoIs PEP", beneficiario: "Beneficiario controlador", evidencias: "Evidencias",
  capacitacion: "Capacitación", auditoria: "Auditoría", gobernanza: "Gobernanza",
}
export const ALL_ACTIONS: PermissionAction[] = ["view", "edit", "upload", "download", "approve", "archive"]
export function rolePermissions(role: OrganizationRole): CompanyGrant["permissions"] {
  const actions: PermissionAction[] = role === "admin" || role === "compliance" ? ALL_ACTIONS : role === "capture" ? ["view", "edit", "upload", "download"] : ["view", "download"]
  return Object.fromEntries(Object.keys(MODULE_LABELS).map((key) => [key, [...actions]]))
}

export const COLLECTION_MODULES: Record<string, ModuleKey> = {
  "registro-sat-data": "registro", "pld-tenants": "registro", "pld-active-tenant-id": "registro",
  kyc_expedientes_detalle: "expedientes", actividades_vulnerables_clientes: "expedientes",
  actividades_vulnerables_operaciones: "operaciones", "pld-sat-output-packages": "avisos", "pld-sat-format-snapshot": "avisos",
  "pld-submissions-workflow": "avisos", "monitoreo-operaciones-data": "operaciones", ebr_evaluaciones: "ebr",
  "beneficiario-controlador-data": "beneficiario", "pld-training-module": "capacitacion", "capacitacion-control-data": "capacitacion",
  "auditoria-lineamientos": "auditoria", "auditoria-interna-registros": "auditoria", "auditoria-observaciones-autoridades": "auditoria",
  "auditoria-planes-accion": "auditoria", "auditoria-verificacion-data": "auditoria", "auditoria-verificacion-workflow": "auditoria",
  "pld-evidences-documents": "evidencias", "pld-evidences-logs": "evidencias", "evidencias-trazabilidad-data": "evidencias",
  "gobernanza-control-data": "gobernanza", "pld-pep-internal-records": "pep", "pld-pep-search-history": "pep",
  "pld-pep-decisions": "pep", "pld-import-mappings": "operaciones", "pld-import-history": "operaciones",
  "pld-import-history-registro": "registro", "pld-import-history-expedientes": "expedientes", "pld-import-history-evidencias": "evidencias",
  "pld-import-mappings-registro": "registro", "pld-import-mappings-expedientes": "expedientes", "pld-import-mappings-evidencias": "evidencias",
  documents: "evidencias", completedActivities: "gobernanza", userSectionsProgress: "gobernanza",
  "audit-reminders": "auditoria", "ebr-institutional-assessment": "ebr",
}
export const PATH_MODULES: Record<string, ModuleKey> = {
  "/registro-sat": "registro", "/kyc-expediente": "expedientes", "/actividades-vulnerables": "operaciones", "/avisos-informes": "avisos",
  "/ebr": "ebr", "/pep-whois": "pep", "/beneficiario-controlador": "beneficiario", "/evidencias-trazabilidad": "evidencias",
  "/capacitacion-control": "capacitacion", "/auditoria-verificacion": "auditoria", "/gobernanza-control": "gobernanza",
}
export function sessionCan(session: PilotSession | null, company: Company | null, module: ModuleKey, action: PermissionAction) {
  if (!session || session.user.status !== "active" || !company || company.status !== "active") return false
  if (company.id === `inbox:${company.organizationId}:${session.user.id}` && session.organizations.some((org) => org.id === company.organizationId)) {
    const membership = session.memberships.find((item) => item.organizationId === company.organizationId)
    return module === "expedientes" && ["view", "edit", "upload", "download"].includes(action) && (session.user.platformRole === "superadmin" || Boolean(membership && rolePermissions(membership.role).expedientes?.includes(action)))
  }
  if (session.user.platformRole === "superadmin") return true
  if (session.memberships.some((m) => m.organizationId === company.organizationId && m.role === "admin")) return true
  return Boolean(session.grants.find((grant) => grant.companyId === company.id && grant.userId === session.user.id)?.permissions[module]?.includes(action))
}
export function sessionIsAdmin(session: PilotSession | null) {
  return Boolean(session?.user.status === "active" && (session.user.platformRole === "superadmin" || session.memberships.some((m) => m.role === "admin")))
}

/** Navigation is discoverability, not authorization to read or save company data.
 * An active administrator can discover every module before creating a company
 * (or while viewing a private inbox); sessionCan still requires its real scope. */
export function sessionCanNavigate(session: PilotSession | null, company: Company | null, module: ModuleKey) {
  if (!session || session.user.status !== "active") return false
  return sessionIsAdmin(session) || sessionCan(session, company, module, "view")
}
