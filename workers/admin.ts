import { hashPassword } from "better-auth/crypto"
import { ACTIONS, MODULES, auditStatement, roleActions, requireCompany, requireOrgAdmin } from "./access"
import { ApiError, type CompanyRow, type MembershipRow, type PilotActor, type PilotEnv } from "./types"
import { body, identifier, json, text } from "./http"
import { isValidPasswordLength, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "../lib/pilot/password-policy"

const publicUserFields = "u.id,u.name,u.email,u.platformRole,u.status,u.requiresPasswordChange,u.twoFactorEnabled,u.createdAt,u.updatedAt,(SELECT MAX(a.createdAt) FROM pld_audit a WHERE a.actorId=u.id AND a.action='user.signed_in') AS lastAccess"
const roles = ["admin", "compliance", "capture", "viewer"]
function temporaryPassword() { return `PLD-${crypto.randomUUID()}-${crypto.randomUUID().slice(0,8)}!` }
function boolUser(row: Record<string, unknown>) {return { ...row, requiresPasswordChange: Boolean(row.requiresPasswordChange), twoFactorEnabled: Boolean(row.twoFactorEnabled) }}

export async function getSessionData(actor: PilotActor, env: PilotEnv) {
  const memberships = (await env.DB.prepare("SELECT * FROM pld_memberships WHERE userId=?").bind(actor.id).all<MembershipRow>()).results
  const organizations = (await env.DB.prepare(actor.platformRole === "superadmin"
    ? "SELECT id,name,mfaEnabled FROM pld_organizations ORDER BY name"
    : "SELECT o.id,o.name,o.mfaEnabled FROM pld_organizations o JOIN pld_memberships m ON m.organizationId=o.id WHERE m.userId=? ORDER BY o.name")
    .bind(...(actor.platformRole === "superadmin" ? [] : [actor.id])).all<Record<string, unknown>>()).results.map((o) => ({ ...o, mfaEnabled: Boolean(o.mfaEnabled) }))
  const companies = (await env.DB.prepare(actor.platformRole === "superadmin"
    ? "SELECT id,organizationId,name,rfc,status FROM pld_companies WHERE isInbox=0 ORDER BY name"
    : "SELECT DISTINCT c.id,c.organizationId,c.name,c.rfc,c.status FROM pld_companies c JOIN pld_memberships m ON m.organizationId=c.organizationId LEFT JOIN pld_grants g ON g.companyId=c.id AND g.userId=m.userId WHERE m.userId=? AND c.isInbox=0 AND (m.role='admin' OR g.userId IS NOT NULL) ORDER BY c.name")
    .bind(...(actor.platformRole === "superadmin" ? [] : [actor.id])).all<CompanyRow>()).results
  const grants = (await env.DB.prepare("SELECT * FROM pld_grants WHERE userId=?").bind(actor.id).all<Record<string, unknown>>()).results.map((g) => ({ ...g, permissions: JSON.parse(String(g.permissions)) }))
  return { user: actor, organizations, companies, memberships, grants, mfaRequired: organizations.some((o) => o.mfaEnabled) && !actor.twoFactorEnabled }
}

export async function getAdminData(actor: PilotActor, env: PilotEnv) {
  const scope = actor.platformRole === "superadmin" ? undefined : (await env.DB.prepare("SELECT organizationId FROM pld_memberships WHERE userId=? AND role='admin'").bind(actor.id).all<{organizationId:string}>()).results.map((m) => m.organizationId)
  if (scope?.length === 0) throw new ApiError(403, "No tienes acceso a administración.", "FORBIDDEN")
  const where = scope ? ` WHERE organizationId IN (${scope.map(() => "?").join(",")})` : ""
  const organizations = (await env.DB.prepare(scope ? `SELECT * FROM pld_organizations WHERE id IN (${scope.map(() => "?").join(",")})` : "SELECT * FROM pld_organizations").bind(...(scope || [])).all<Record<string,unknown>>()).results.map((o) => ({...o,mfaEnabled:Boolean(o.mfaEnabled)}))
  const companies = (await env.DB.prepare("SELECT id,organizationId,name,rfc,status FROM pld_companies" + (where?where+" AND isInbox=0":" WHERE isInbox=0")).bind(...(scope || [])).all()).results
  const memberships = (await env.DB.prepare("SELECT * FROM pld_memberships" + where).bind(...(scope || [])).all()).results
  const users = (await env.DB.prepare(`SELECT DISTINCT ${publicUserFields} FROM user u${scope ? ` JOIN pld_memberships m ON m.userId=u.id WHERE m.organizationId IN (${scope.map(() => "?").join(",")})` : ""}`).bind(...(scope || [])).all<Record<string,unknown>>()).results.map(boolUser)
  const grants = (await env.DB.prepare(`SELECT g.* FROM pld_grants g JOIN pld_companies c ON c.id=g.companyId${scope ? ` WHERE c.organizationId IN (${scope.map(() => "?").join(",")})` : ""}`).bind(...(scope || [])).all<Record<string,unknown>>()).results.map((g) => ({...g,permissions:JSON.parse(String(g.permissions))}))
  const audit = (await env.DB.prepare("SELECT id,organizationId,companyId,actorId,action,entityType,entityId,details,createdAt FROM pld_audit"+where+" ORDER BY createdAt DESC LIMIT 200").bind(...(scope || [])).all()).results
  return { organizations, companies, memberships, users, grants, audit }
}

async function assertManageTarget(actor: PilotActor, targetId: string, orgId: string, env: PilotEnv) {
  await requireOrgAdmin(actor, orgId, env)
  const target = await env.DB.prepare("SELECT id,platformRole FROM user WHERE id=?").bind(targetId).first<{id:string;platformRole:string}>()
  if (!target) throw new ApiError(404, "Usuario no disponible.", "NOT_FOUND")
  const memberships = (await env.DB.prepare("SELECT * FROM pld_memberships WHERE userId=?").bind(targetId).all<MembershipRow>()).results
  if (!memberships.some((m) => m.organizationId === orgId)) throw new ApiError(404, "Usuario no disponible.", "NOT_FOUND")
  if (target.platformRole === "superadmin") throw new ApiError(403, "Esta cuenta sólo puede modificar sus propias credenciales.", "SUPERADMIN_PROTECTED")
  if (actor.platformRole !== "superadmin") {
    for (const member of memberships) {
      if (member.role === "admin") throw new ApiError(403, "Sólo el superadministrador gestiona administradores.", "FORBIDDEN")
      await requireOrgAdmin(actor, member.organizationId, env)
    }
  }
  return target
}

export async function handleAdmin(request: Request, url: URL, actor: PilotActor, env: PilotEnv): Promise<Response | null> {
  const path = url.pathname.replace(/^\/api\/v1/, "")
  if (path === "/admin" && request.method === "GET") return json(await getAdminData(actor, env))
  if (path === "/organizations" && request.method === "POST") {
    if (actor.platformRole !== "superadmin") throw new ApiError(403, "Sólo el superadministrador crea organizaciones.", "FORBIDDEN")
    const input = await body(request), name = text(input.name, "el nombre"), id = crypto.randomUUID(), at = new Date().toISOString()
    await env.DB.batch([env.DB.prepare("INSERT INTO pld_organizations(id,name,createdAt,updatedAt) VALUES(?,?,?,?)").bind(id,name,at,at), auditStatement(env,actor,"organization.created","organization",id,id)])
    return json({id,name,mfaEnabled:false},201)
  }
  let match = path.match(/^\/organizations\/([^/]+)$/)
  if (match && request.method === "PATCH") {
    const orgId = identifier(match[1]); await requireOrgAdmin(actor,orgId,env)
    const old = await env.DB.prepare("SELECT * FROM pld_organizations WHERE id=?").bind(orgId).first<Record<string,unknown>>()
    if (!old) throw new ApiError(404,"Organización no disponible.","NOT_FOUND")
    const input=await body(request)
    if (input.mfaEnabled !== undefined && (actor.platformRole !== "superadmin" || typeof input.mfaEnabled !== "boolean")) throw new ApiError(403,"Sólo el superadministrador cambia la política MFA.","FORBIDDEN")
    const name=input.name===undefined?String(old.name):text(input.name,"el nombre"), mfaEnabled=input.mfaEnabled===undefined?Boolean(old.mfaEnabled):input.mfaEnabled===true
    const statements=[env.DB.prepare("UPDATE pld_organizations SET name=?,mfaEnabled=?,updatedAt=? WHERE id=?").bind(name,mfaEnabled?1:0,new Date().toISOString(),orgId),auditStatement(env,actor,"organization.updated","organization",orgId,orgId,undefined,{mfaEnabled})]
    if (mfaEnabled !== Boolean(old.mfaEnabled)) statements.push(env.DB.prepare("DELETE FROM session WHERE userId IN (SELECT userId FROM pld_memberships WHERE organizationId=?) AND userId<>?").bind(orgId,actor.id))
    await env.DB.batch(statements)
    return json({id:orgId,name,mfaEnabled})
  }
  if (path === "/companies" && request.method === "POST") {
    const input=await body(request),orgId=identifier(input.organizationId);await requireOrgAdmin(actor,orgId,env)
    const id=crypto.randomUUID(),name=text(input.name,"la razón social"),rfc=text(input.rfc,"el RFC",13,false).toUpperCase(),at=new Date().toISOString()
    if (rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) throw new ApiError(400,"RFC no válido.","INVALID_RFC")
    await env.DB.batch([env.DB.prepare("INSERT INTO pld_companies(id,organizationId,name,rfc,createdAt,updatedAt) VALUES(?,?,?,?,?,?)").bind(id,orgId,name,rfc,at,at),auditStatement(env,actor,"company.created","company",id,orgId,id)])
    return json({id,organizationId:orgId,name,rfc,status:"active"},201)
  }
  match=path.match(/^\/companies\/([^/]+)$/)
  if(match&&request.method==="PATCH") {
    const company=await requireCompany(actor,identifier(match[1]),env);await requireOrgAdmin(actor,company.organizationId,env)
    const input=await body(request),name=input.name===undefined?company.name:text(input.name,"la razón social"),status=input.status===undefined?company.status:input.status,rfc=input.rfc===undefined?company.rfc:text(input.rfc,"el RFC",13,false).toUpperCase()
    if(status!=="active"&&status!=="archived")throw new ApiError(400,"Estado no válido.","INVALID_FIELD")
    if(rfc&&!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc))throw new ApiError(400,"RFC no válido.","INVALID_RFC")
    if(company.rfc&&rfc!==company.rfc&&await env.DB.prepare("SELECT 1 FROM pld_records WHERE companyId=? LIMIT 1").bind(company.id).first())throw new ApiError(409,"No cambies la identidad de una empresa con historial. Crea la razón social correspondiente.","COMPANY_IDENTITY_LOCKED")
    await env.DB.batch([env.DB.prepare("UPDATE pld_companies SET name=?,rfc=?,status=?,updatedAt=? WHERE id=?").bind(name,rfc,status,new Date().toISOString(),company.id),auditStatement(env,actor,"company.updated","company",company.id,company.organizationId,company.id,{status,rfcChanged:rfc!==company.rfc})]);return json({...company,name,rfc,status})
  }
  if(path==="/users"&&request.method==="POST") {
    const input=await body(request),orgId=identifier(input.organizationId);await requireOrgAdmin(actor,orgId,env)
    const name=text(input.name,"el nombre"),email=text(input.email,"el correo",254).toLowerCase(),role=text(input.role||"viewer","el perfil",20)
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!roles.includes(role))throw new ApiError(400,"Revisa correo y perfil.","INVALID_FIELD")
    if(role==="admin"&&actor.platformRole!=="superadmin")throw new ApiError(403,"Sólo el superadministrador crea administradores.","FORBIDDEN")
    const initialPasswordSet=Object.prototype.hasOwnProperty.call(input,"initialPassword")
    if(initialPasswordSet&&!isValidPasswordLength(input.initialPassword))throw new ApiError(400,`La contraseña inicial debe tener entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres.`,"INVALID_PASSWORD_LENGTH")
    if(await env.DB.prepare("SELECT id FROM user WHERE email=?").bind(email).first())throw new ApiError(409,"Ya existe una cuenta con ese correo.","EMAIL_EXISTS")
    const companyIds=Array.isArray(input.companyIds)?[...new Set(input.companyIds.map(identifier))]:[]
    if(companyIds.length>100)throw new ApiError(400,"Demasiadas empresas.","INVALID_FIELD")
    for(const companyId of companyIds){const c=await requireCompany(actor,companyId,env);if(c.organizationId!==orgId)throw new ApiError(403,"La empresa pertenece a otra organización.","FORBIDDEN")}
    const id=crypto.randomUUID(),password=initialPasswordSet?input.initialPassword as string:temporaryPassword(),hash=await hashPassword(password),at=Date.now()
    await env.DB.batch([
      env.DB.prepare("INSERT INTO user(id,name,email,emailVerified,requiresPasswordChange,createdAt,updatedAt) VALUES(?,?,?,1,1,?,?)").bind(id,name,email,at,at),
      env.DB.prepare("INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES(?,?,'credential',?,?,?,?)").bind(crypto.randomUUID(),id,id,hash,at,at),
      env.DB.prepare("INSERT INTO pld_memberships(userId,organizationId,role) VALUES(?,?,?)").bind(id,orgId,role),
      ...companyIds.map((companyId)=>env.DB.prepare("INSERT INTO pld_grants(userId,companyId,role,permissions) VALUES(?,?,?,?)").bind(id,companyId,role,JSON.stringify(Object.fromEntries(MODULES.map((module)=>[module,roleActions(role)]))))),
      auditStatement(env,actor,"user.created","user",id,orgId,undefined,{role,companyIds}),
    ])
    return json({user:{id,name,email,platformRole:"user",status:"active",requiresPasswordChange:true},...(initialPasswordSet?{initialPasswordSet:true}:{temporaryPassword:password})},201)
  }
  match=path.match(/^\/users\/([^/]+)(?:\/(reset-password|sessions))?$/)
  if(match) {
    const userId=identifier(match[1])
    if(request.method==="POST"&&match[2]==="reset-password"){
      const input=await body(request),orgId=identifier(input.organizationId);await assertManageTarget(actor,userId,orgId,env)
      const password=temporaryPassword(),hash=await hashPassword(password)
      await env.DB.batch([env.DB.prepare("UPDATE account SET password=?,updatedAt=? WHERE userId=? AND providerId='credential'").bind(hash,Date.now(),userId),env.DB.prepare("UPDATE user SET requiresPasswordChange=1,updatedAt=? WHERE id=?").bind(Date.now(),userId),env.DB.prepare("DELETE FROM session WHERE userId=?").bind(userId),auditStatement(env,actor,"user.password_reset","user",userId,orgId)])
      return json({temporaryPassword:password})
    }
    if(request.method==="PATCH"&&!match[2]){
      const input=await body(request),orgId=identifier(input.organizationId);await assertManageTarget(actor,userId,orgId,env)
      const old=await env.DB.prepare("SELECT name,status FROM user WHERE id=?").bind(userId).first<{name:string;status:string}>()
      const status=input.status===undefined?old!.status:input.status,name=input.name===undefined?old!.name:text(input.name,"el nombre")
      if(status!=="active"&&status!=="suspended")throw new ApiError(400,"Estado no válido.","INVALID_FIELD")
      const statements=[env.DB.prepare("UPDATE user SET name=?,status=?,updatedAt=? WHERE id=?").bind(name,status,Date.now(),userId)]
      if(input.role!==undefined){const role=text(input.role,"el perfil",20);if(!roles.includes(role))throw new ApiError(400,"Perfil no válido.","INVALID_FIELD");if(actor.platformRole!=="superadmin"&&role==="admin")throw new ApiError(403,"Sólo el superadministrador asigna administradores.","FORBIDDEN");statements.push(env.DB.prepare("UPDATE pld_memberships SET role=? WHERE userId=? AND organizationId=?").bind(role,userId,orgId),env.DB.prepare("UPDATE pld_grants SET role=?,permissions=? WHERE userId=? AND companyId IN (SELECT id FROM pld_companies WHERE organizationId=?)").bind(role,JSON.stringify(Object.fromEntries(MODULES.map((module)=>[module,roleActions(role)]))),userId,orgId))}
      statements.push(env.DB.prepare("DELETE FROM session WHERE userId=?").bind(userId),auditStatement(env,actor,"user.updated","user",userId,orgId,undefined,{status}))
      await env.DB.batch(statements);return json({id:userId,name,status})
    }
    if(request.method==="GET"&&match[2]==="sessions"){
      const orgId=identifier(url.searchParams.get("organizationId"));await assertManageTarget(actor,userId,orgId,env)
      return json({sessions:(await env.DB.prepare("SELECT id,createdAt,updatedAt,expiresAt,userAgent FROM session WHERE userId=?").bind(userId).all()).results})
    }
    if(request.method==="DELETE"&&match[2]==="sessions"){
      const input=await body(request),orgId=identifier(input.organizationId);await assertManageTarget(actor,userId,orgId,env)
      const sessionId=input.sessionId===undefined?undefined:identifier(input.sessionId)
      await env.DB.batch([env.DB.prepare(`DELETE FROM session WHERE userId=?${sessionId?" AND id=?":""}`).bind(userId,...(sessionId?[sessionId]:[])),auditStatement(env,actor,"user.sessions_revoked","user",userId,orgId,undefined,{sessionId:sessionId||"all"})])
      return json({ok:true})
    }
  }
  if(path==="/grants"&&(request.method==="PUT"||request.method==="DELETE")){
    const input=await body(request),orgId=identifier(input.organizationId),companyId=identifier(input.companyId),userId=identifier(input.userId)
    await requireOrgAdmin(actor,orgId,env);const company=await requireCompany(actor,companyId,env)
    if(company.organizationId!==orgId)throw new ApiError(403,"Empresa no autorizada.","FORBIDDEN")
    if(!await env.DB.prepare("SELECT 1 FROM pld_memberships WHERE userId=? AND organizationId=?").bind(userId,orgId).first())throw new ApiError(404,"Usuario no disponible.","NOT_FOUND")
    const targetRole=await env.DB.prepare("SELECT role FROM pld_memberships WHERE userId=? AND organizationId=?").bind(userId,orgId).first<{role:string}>()
    if(actor.platformRole!=="superadmin"&&targetRole?.role==="admin")throw new ApiError(403,"Sólo el superadministrador modifica accesos administrativos.","FORBIDDEN")
    if(request.method==="DELETE") {await env.DB.batch([env.DB.prepare("DELETE FROM pld_grants WHERE userId=? AND companyId=?").bind(userId,companyId),auditStatement(env,actor,"grant.revoked","user",userId,orgId,companyId)]);return json({ok:true})}
    const permissions=(input.permissions&&typeof input.permissions==="object"&&!Array.isArray(input.permissions)?input.permissions:{}) as Record<string,unknown>
    for(const [module,actions] of Object.entries(permissions))if(!MODULES.includes(module as never)||!Array.isArray(actions)||actions.some((action)=>!ACTIONS.includes(action as never)))throw new ApiError(400,"Permisos no válidos.","INVALID_PERMISSIONS")
    const role=text(input.role||targetRole?.role||"viewer","el perfil",20);if(!roles.includes(role))throw new ApiError(400,"Perfil no válido.","INVALID_FIELD")
    if(role==="admin"&&actor.platformRole!=="superadmin")throw new ApiError(403,"No puedes asignar permisos administrativos.","FORBIDDEN")
    await env.DB.batch([env.DB.prepare("INSERT INTO pld_grants(userId,companyId,role,permissions) VALUES(?,?,?,?) ON CONFLICT(userId,companyId) DO UPDATE SET role=excluded.role,permissions=excluded.permissions").bind(userId,companyId,role,JSON.stringify(permissions)),auditStatement(env,actor,"grant.updated","user",userId,orgId,companyId,{role,permissions})])
    return json({userId,companyId,role,permissions})
  }
  return null
}
