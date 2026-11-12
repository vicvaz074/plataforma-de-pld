export interface DbStatement {
  bind(...values: unknown[]): DbStatement
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }>
  run(): Promise<{ success: boolean; meta: { changes?: number } }>
}
export interface PilotDatabase {
  prepare(sql: string): DbStatement
  batch(statements: DbStatement[]): Promise<unknown[]>
  exec(sql: string): Promise<unknown>
}
export interface PilotBucket {
  put(key: string, value: ArrayBuffer | ReadableStream | Uint8Array, options?: { httpMetadata?: { contentType: string }; customMetadata?: Record<string, string> }): Promise<unknown>
  get(key: string): Promise<{ body: ReadableStream; size: number } | null>
  delete(key: string): Promise<unknown>
}
export interface PilotEnv {
  DB: PilotDatabase
  EVIDENCE_BUCKET: PilotBucket
  ASSETS?: { fetch(request: Request): Promise<Response> }
  IMPORT_QUEUE?: { send(message: { jobId: string }): Promise<void> }
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  BOOTSTRAP_TOKEN?: string
  BOOTSTRAP_EMAIL?: string
  ENVIRONMENT?: string
}
export interface PilotActor {
  id: string
  name: string
  email: string
  platformRole: "superadmin" | "user"
  status: "active" | "suspended"
  requiresPasswordChange: boolean
  twoFactorEnabled: boolean
}
export interface CompanyRow { id: string; organizationId: string; name: string; rfc: string; status: "active" | "archived" }
export interface MembershipRow { userId: string; organizationId: string; role: "admin" | "compliance" | "capture" | "viewer" }
export interface GrantRow { userId: string; companyId: string; role: string; permissions: Record<string, string[]> }
export interface StoredRecord { collection: string; id: string; revision: number; payload: unknown; deleted: boolean }
export class ApiError extends Error {
  constructor(public status: number, message: string, public code = "REQUEST_FAILED") { super(message) }
}
