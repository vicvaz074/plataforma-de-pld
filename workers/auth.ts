import { betterAuth } from "better-auth"
import { twoFactor } from "better-auth/plugins"
import { Kysely } from "kysely"
import { D1Dialect } from "kysely-d1"
import { ApiError, type PilotActor, type PilotEnv } from "./types"

/** Instances are request-local: Cloudflare forbids carrying I/O clients across requests. */
export function getAuth(env: PilotEnv) {
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) throw new ApiError(503, "Configura el secreto de autenticación antes de habilitar accesos.", "AUTH_NOT_CONFIGURED")
  return betterAuth({
    appName: "Davara PLD", baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: { db: new Kysely({ dialect: new D1Dialect({ database: env.DB as never }) }), type: "sqlite", transaction: false },
    trustedOrigins: [env.BETTER_AUTH_URL],
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12, maxPasswordLength: 128 },
    session: { expiresIn: 60 * 60 * 12, updateAge: 60 * 10, cookieCache: { enabled: false } },
    advanced: { database: { generateId: "uuid" }, ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"] } },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 60, customRules: { "/sign-in/email": { window: 60, max: 8 }, "/two-factor/*": {window: 60, max: 8} } },
    user: { additionalFields: {
      platformRole: { type: "string", required: false, defaultValue: "user", input: false },
      status: { type: "string", required: false, defaultValue: "active", input: false },
      requiresPasswordChange: { type: "boolean", required: false, defaultValue: true, input: false },
    } },
    plugins: [twoFactor({ issuer: "Davara PLD" })],
  })
}

export async function requireActor(request: Request, env: PilotEnv, allowSetup = false): Promise<PilotActor> {
  const session = await getAuth(env).api.getSession({ headers: request.headers })
  if (!session?.user?.id) throw new ApiError(401, "Inicia sesión para continuar.", "UNAUTHENTICATED")
  const row = await env.DB.prepare("SELECT id,name,email,platformRole,status,requiresPasswordChange,twoFactorEnabled,mfaEnrolledAt FROM user WHERE id=?").bind(session.user.id).first<Record<string, unknown>>()
  if (!row || row.status !== "active") throw new ApiError(401, "El acceso está suspendido.", "ACCOUNT_SUSPENDED")
  const user: PilotActor = { id: String(row.id), name: String(row.name), email: String(row.email), platformRole: row.platformRole === "superadmin" ? "superadmin" : "user", status: "active", requiresPasswordChange: Boolean(row.requiresPasswordChange), twoFactorEnabled: Boolean(row.twoFactorEnabled) }
  if(Number(row.mfaEnrolledAt)>new Date(session.session.createdAt).getTime())throw new ApiError(401,"La sesión es anterior a la configuración de MFA. Inicia sesión nuevamente.","MFA_REAUTHENTICATION_REQUIRED")
  if (!allowSetup && user.requiresPasswordChange) throw new ApiError(403, "Cambia tu contraseña temporal antes de continuar.", "PASSWORD_CHANGE_REQUIRED")
  if (!allowSetup && await requiresMfaEnrollment(user, env)) throw new ApiError(403, "Configura el segundo factor para continuar.", "MFA_ENROLLMENT_REQUIRED")
  return user
}

export async function mfaPolicyEnabled(userId: string, env: PilotEnv) {
  const user=await env.DB.prepare("SELECT platformRole FROM user WHERE id=?").bind(userId).first<{platformRole:string}>()
  if(user?.platformRole==="superadmin")return Boolean(await env.DB.prepare("SELECT 1 FROM pld_organizations WHERE mfaEnabled=1 LIMIT 1").first())
  const row = await env.DB.prepare("SELECT 1 AS enabled FROM pld_memberships m JOIN pld_organizations o ON o.id=m.organizationId WHERE m.userId=? AND o.mfaEnabled=1 LIMIT 1").bind(userId).first()
  return Boolean(row)
}
export async function requiresMfaEnrollment(actor: PilotActor, env: PilotEnv) {
  return !actor.twoFactorEnabled && await mfaPolicyEnabled(actor.id, env)
}

export function assertOrigin(request: Request, env: PilotEnv) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return
  const origin = request.headers.get("Origin")
  const expected = new URL(env.BETTER_AUTH_URL || request.url).origin
  if (origin && origin !== expected) throw new ApiError(403, "Origen de solicitud no autorizado.", "INVALID_ORIGIN")
  if (!origin && request.headers.get("sec-fetch-site") === "cross-site") throw new ApiError(403, "Solicitud externa no autorizada.", "INVALID_ORIGIN")
}
