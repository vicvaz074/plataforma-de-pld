import { hashPassword } from "better-auth/crypto"
import { getAuth, assertOrigin, requireActor, mfaPolicyEnabled } from "./auth"
import { getSessionData, handleAdmin } from "./admin"
import { handleRecords } from "./records"
import { handleFiles } from "./files"
import { handleImports, processImportJob, dispatchImportOutbox } from "./imports"
import { handleExpedienteCopy } from "./expediente-copy"
import { handleBackups } from "./backups"
import { ACTIONS, MODULES, auditStatement, requireCompany } from "./access"
import { ApiError, type PilotActor, type PilotEnv } from "./types"
import { body, identifier, json, text } from "./http"
import { isValidPasswordLength, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "../lib/pilot/password-policy"

async function bootstrap(request:Request,env:PilotEnv){
  if(!env.BOOTSTRAP_TOKEN||env.BOOTSTRAP_TOKEN.length<32)throw new ApiError(404,"Recurso no disponible.","NOT_FOUND")
  const token=request.headers.get("authorization")?.replace(/^Bearer /,"")||""
  const a=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token))),b=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(env.BOOTSTRAP_TOKEN)))
  if(a.reduce((diff,value,i)=>diff|(value^b[i]),0)!==0)throw new ApiError(401,"Credencial de instalación no válida.","UNAUTHENTICATED")
  if(await env.DB.prepare("SELECT id FROM user LIMIT 1").first())throw new ApiError(409,"La instalación ya tiene cuentas.","BOOTSTRAP_CLOSED")
  const input=await body(request),email=text(input.email,"el correo",254).toLowerCase(),name=text(input.name,"el nombre"),password=input.password
  if(env.BOOTSTRAP_EMAIL&&email!==env.BOOTSTRAP_EMAIL.trim().toLowerCase())throw new ApiError(403,"El correo no corresponde al titular de esta instalación.","BOOTSTRAP_OWNER_MISMATCH")
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!isValidPasswordLength(password))throw new ApiError(400,`Usa un correo válido y una contraseña de ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caracteres.`,"INVALID_FIELD")
  const hash=await hashPassword(password),id=crypto.randomUUID(),at=Date.now(),actor:PilotActor={id,name,email,platformRole:"superadmin",status:"active",requiresPasswordChange:false,twoFactorEnabled:false}
  try{await env.DB.batch([
    env.DB.prepare("INSERT INTO pld_revision_guard(id,valid) VALUES('bootstrap',CASE WHEN NOT EXISTS(SELECT 1 FROM user) THEN 1 ELSE 0 END)"),
    env.DB.prepare("INSERT INTO user(id,name,email,emailVerified,platformRole,requiresPasswordChange,createdAt,updatedAt) VALUES(?,?,?,1,'superadmin',0,?,?)").bind(id,name,email,at,at),
    env.DB.prepare("INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES(?,?,'credential',?,?,?,?)").bind(crypto.randomUUID(),id,id,hash,at,at),
    env.DB.prepare("DELETE FROM pld_revision_guard WHERE id='bootstrap'"),auditStatement(env,actor,"installation.bootstrapped","user",id),
  ])}catch(error){if(String(error).includes("CHECK constraint"))throw new ApiError(409,"La instalación ya fue completada.","BOOTSTRAP_CLOSED");throw error}
  return json({user:actor},201)
}

export async function fetchPilot(request:Request,env:PilotEnv):Promise<Response>{
  const url=new URL(request.url)
  try{
    if(url.pathname==="/api/v1/health")return json({mode:"cloud",configured:Boolean(env.DB&&env.EVIDENCE_BUCKET&&env.BETTER_AUTH_SECRET&&env.BETTER_AUTH_URL),environment:env.ENVIRONMENT||"local"})
    assertOrigin(request,env)
    if(url.pathname==="/api/v1/bootstrap"&&request.method==="POST")return await bootstrap(request,env)
    if(url.pathname.startsWith("/api/auth/")){
      const auth=getAuth(env),path=url.pathname.replace("/api/auth","")
      // The only account creation path is the authorized administration API.
      if(path.includes("sign-up")||path.includes("reset-password")||path.includes("request-password-reset"))throw new ApiError(403,"Solicita el acceso o restablecimiento a tu administrador.","ADMIN_MANAGED_ACCOUNT")
      let actor:PilotActor|undefined
      const enrollmentSession=path==="/two-factor/verify-totp"?await auth.api.getSession({headers:request.headers}):null
      if(path==="/change-password"||path==="/two-factor/enable"||path==="/two-factor/disable"||path==="/two-factor/get-totp-uri")actor=await requireActor(request,env,true)
      if(path==="/two-factor/enable"&&actor&&!await mfaPolicyEnabled(actor.id,env))throw new ApiError(403,"MFA está desactivado por política de la plataforma.","MFA_DISABLED")
      if(path==="/two-factor/disable"&&actor&&await mfaPolicyEnabled(actor.id,env))throw new ApiError(403,"La política requiere segundo factor. Contacta al superadministrador.","MFA_REQUIRED")
      const response=await auth.handler(request)
      let authResult:{token?:unknown;user?:{id?:unknown}}|undefined
      if(response.ok&&["/sign-in/email","/two-factor/verify-totp","/two-factor/verify-backup-code"].includes(path)){
        // Only a completed sign-in returns both token and user. A password-only
        // MFA challenge is not recorded as a successful authenticated access.
        const result=await response.clone().json() as {token?:unknown;user?:{id?:unknown}};authResult=result
        if(typeof result.token==="string"&&typeof result.user?.id==="string"){
          const signedIn={id:result.user.id,name:"",email:"",platformRole:"user",status:"active",requiresPasswordChange:false,twoFactorEnabled:false} as PilotActor
          await auditStatement(env,signedIn,"user.signed_in","user",signedIn.id).run()
        }
      }
      if(path==="/two-factor/verify-totp"&&response.ok&&enrollmentSession&&!enrollmentSession.user.twoFactorEnabled){
        const at=Date.now()
        // Better Auth may rotate the enrollment session. Keep the verified
        // session (not a stale pre-enrollment cookie) and invalidate all others.
        const returned=typeof authResult?.token==="string"?await env.DB.prepare("SELECT id FROM session WHERE userId=? AND token=?").bind(enrollmentSession.user.id,authResult.token).first<{id:string}>():null
        const current=returned||await env.DB.prepare("SELECT id FROM session WHERE userId=? ORDER BY createdAt DESC LIMIT 1").bind(enrollmentSession.user.id).first<{id:string}>()
        if(!current)throw new ApiError(401,"Inicia sesión nuevamente para completar MFA.","UNAUTHENTICATED")
        await env.DB.batch([env.DB.prepare("UPDATE user SET mfaEnrolledAt=? WHERE id=?").bind(at,enrollmentSession.user.id),env.DB.prepare("UPDATE session SET createdAt=?,updatedAt=? WHERE id=?").bind(at,at,current.id),env.DB.prepare("DELETE FROM session WHERE userId=? AND id<>?").bind(enrollmentSession.user.id,current.id)])
      }
      if(path==="/change-password"&&response.ok&&actor){await env.DB.batch([env.DB.prepare("UPDATE user SET requiresPasswordChange=0,updatedAt=? WHERE id=?").bind(Date.now(),actor.id),auditStatement(env,actor,"user.password_changed","user",actor.id)])}
      return response
    }
    if(url.pathname.startsWith("/api/v1/")){
      const actor=await requireActor(request,env,url.pathname==="/api/v1/session")
      if(url.pathname==="/api/v1/session"&&request.method==="GET")return json(await getSessionData(actor,env))
      const authorization=url.pathname.match(/^\/api\/v1\/companies\/([^/]+)\/authorize$/)
      if(authorization&&request.method==="POST"){
        const input=await body(request),moduleKey=String(input.moduleKey||""),action=String(input.action||"")
        if(!MODULES.includes(moduleKey as never)||!ACTIONS.includes(action as never))throw new ApiError(400,"Acción o módulo no válido.","INVALID_PERMISSION")
        const company=await requireCompany(actor,identifier(authorization[1]),env,moduleKey,action)
        await auditStatement(env,actor,"action.authorized",moduleKey,company.id,company.organizationId,company.id,{action}).run()
        return json({authorized:true,companyId:company.id,moduleKey,action})
      }
      if(url.pathname==="/api/v1/profile/sessions"&&["GET","DELETE"].includes(request.method)){
        const current=await getAuth(env).api.getSession({headers:request.headers})
        if(request.method==="GET"){
          const sessions=(await env.DB.prepare("SELECT id,createdAt,updatedAt,expiresAt,userAgent FROM session WHERE userId=? ORDER BY updatedAt DESC").bind(actor.id).all<Record<string,unknown>>()).results
          return json({sessions:sessions.map((session)=>({...session,current:session.id===current?.session.id}))})
        }
        const input=await body(request),sessionId=input.sessionId===undefined?undefined:identifier(input.sessionId)
        await env.DB.batch([env.DB.prepare(`DELETE FROM session WHERE userId=?${sessionId?" AND id=?":" AND id<>?"}`).bind(actor.id,sessionId||current?.session.id||""),auditStatement(env,actor,"user.sessions_revoked","user",actor.id,undefined,undefined,{sessionId:sessionId||"others"})])
        return json({ok:true})
      }
      const inbox=url.pathname.match(/^\/api\/v1\/organizations\/([^/]+)\/inbox(?:\/(records\/batch))?$/)
      if(inbox){
        const virtual=`inbox:${decodeURIComponent(inbox[1])}:${actor.id}`,proxy=new URL(request.url)
        proxy.pathname=`/api/v1/companies/${encodeURIComponent(virtual)}/${inbox[2]||"snapshot"}`
        return (await handleRecords(request,proxy,actor,env))!
      }
      if(url.pathname==="/api/v1/profile"&&["GET","PATCH"].includes(request.method)){
        const saved=await env.DB.prepare("SELECT preferences FROM pld_user_preferences WHERE userId=?").bind(actor.id).first<{preferences:string}>(),preferences={language:"es",theme:"system",notifications:true,...JSON.parse(saved?.preferences||"{}")}
        if(request.method==="GET")return json({user:actor,preferences})
        const input=await body(request),name=input.name===undefined?actor.name:text(input.name,"el nombre")
        if(input.preferences!==undefined){
          if(!input.preferences||typeof input.preferences!=="object"||Array.isArray(input.preferences))throw new ApiError(400,"Preferencias no válidas.","INVALID_FIELD")
          const next=input.preferences as Record<string,unknown>
          if(Object.keys(next).some((key)=>!["language","theme","notifications"].includes(key))||next.language!==undefined&&!["es","en"].includes(String(next.language))||next.theme!==undefined&&!["light","dark","system"].includes(String(next.theme))||next.notifications!==undefined&&typeof next.notifications!=="boolean")throw new ApiError(400,"Preferencias no válidas.","INVALID_FIELD")
          Object.assign(preferences,next)
        }
        await env.DB.batch([env.DB.prepare("UPDATE user SET name=?,updatedAt=? WHERE id=?").bind(name,Date.now(),actor.id),env.DB.prepare("INSERT INTO pld_user_preferences(userId,preferences,updatedAt) VALUES(?,?,?) ON CONFLICT(userId) DO UPDATE SET preferences=excluded.preferences,updatedAt=excluded.updatedAt").bind(actor.id,JSON.stringify(preferences),new Date().toISOString()),auditStatement(env,actor,"user.profile_updated","user",actor.id)])
        return json({user:{...actor,name},preferences})
      }
      const response=await handleAdmin(request,url,actor,env)||await handleRecords(request,url,actor,env)||await handleFiles(request,url,actor,env)||await handleImports(request,url,actor,env)||await handleExpedienteCopy(request,url,actor,env)||await handleBackups(request,url,actor,env)
      if(response)return response
      throw new ApiError(404,"Recurso no disponible.","NOT_FOUND")
    }
    if(env.ASSETS)return env.ASSETS.fetch(request)
    return new Response("Frontend no compilado",{status:503})
  }catch(error){
    if(error instanceof ApiError)return json({error:error.message,code:error.code},error.status)
    // Avoid logging request bodies, account details, or document contents.
    console.error("pilot.request.failed",{route:url.pathname.startsWith("/api/auth/")?"auth":url.pathname.startsWith("/api/v1/")?"api-v1":"frontend",method:request.method,error:error instanceof Error?error.name:"UnknownError",...(env.ENVIRONMENT==="test"?{message:String(error)}:{})})
    return json({error:"No se pudo completar la solicitud. Conserva tus cambios e inténtalo de nuevo.",code:"INTERNAL_ERROR"},500)
  }
}
export default {
  fetch:fetchPilot,
  async queue(batch:{messages:Array<{body:{jobId:string};ack():void;retry():void}>},env:PilotEnv){for(const message of batch.messages){try{await processImportJob(env,message.body.jobId);message.ack()}catch{message.retry()}}},
  async scheduled(_controller:unknown,env:PilotEnv){await dispatchImportOutbox(env)},
}
