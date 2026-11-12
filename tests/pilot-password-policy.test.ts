import assert from "node:assert/strict"
import test from "node:test"
import { verifyPassword } from "better-auth/crypto"
import { isValidPasswordLength, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "../lib/pilot/password-policy"
import { handleAdmin } from "../workers/admin"
import { ApiError, type DbStatement, type PilotActor, type PilotEnv } from "../workers/types"

const owner: PilotActor = { id: "owner-fixture", name: "Owner fixture", email: "owner@example.test", platformRole: "superadmin", status: "active", requiresPasswordChange: false, twoFactorEnabled: false }

function adminHarness(membershipRole?: string) {
  const writes: Array<{ sql: string; values: unknown[] }> = []
  const db = {
    prepare(sql: string) {
      const statement = {
        sql, values: [] as unknown[],
        bind(...values: unknown[]) { this.values = values; return this },
        async first() { return sql.includes("FROM pld_memberships") && membershipRole ? { role: membershipRole } : null },
        async all() { return { results: [], success: true } },
        async run() { return { success: true, meta: {} } },
      }
      return statement
    },
    async batch(statements: DbStatement[]) { writes.push(...statements as unknown as typeof writes); return [] },
    async exec() { return undefined },
  }
  const env = { DB: db } as unknown as PilotEnv
  const create = (input: Record<string, unknown>, actor = owner) => {
    const url = new URL("https://pilot.example.test/api/v1/users")
    return handleAdmin(new Request(url, { method: "POST", body: JSON.stringify({ organizationId: "org-fixture", name: "Fictitious account", email: "account@example.test", role: "viewer", companyIds: [], ...input }) }), url, actor, env)
  }
  return { create, writes }
}

test("Password policy: 11–128 opaque characters, including whitespace", () => {
  assert.equal(PASSWORD_MIN_LENGTH, 11)
  assert.equal(PASSWORD_MAX_LENGTH, 128)
  for (const value of ["x".repeat(10), "x".repeat(129), "", 12345678901, null, undefined, {}, []]) assert.equal(isValidPasswordLength(value), false)
  for (const value of ["x".repeat(11), "x".repeat(128), " T3st-Pass "]) assert.equal(isValidPasswordLength(value), true)
})

test("Admin rejects invalid chosen passwords before writing accounts or audit", async () => {
  for (const value of ["x".repeat(10), "x".repeat(129), null, 12345678901, {}, []]) {
    const harness = adminHarness()
    await assert.rejects(harness.create({ initialPassword: value }), (error: unknown) => error instanceof ApiError && error.status === 400 && error.code === "INVALID_PASSWORD_LENGTH")
    assert.deepEqual(harness.writes, [])
  }
})

test("Admin chosen 11-character password is hashed unchanged, never echoed or audited", async () => {
  const harness = adminHarness(), password = " T3st-Pass "
  assert.equal(password.length, 11)
  const response = await harness.create({ initialPassword: password })
  assert.equal(response?.status, 201)
  const result = await response!.json() as Record<string, any>
  assert.equal(result.initialPasswordSet, true)
  assert.equal(result.user.requiresPasswordChange, true)
  assert.equal("temporaryPassword" in result, false)
  assert.equal(JSON.stringify(result).includes(password), false)
  const account = harness.writes.find((entry) => entry.sql.startsWith("INSERT INTO account"))!
  const hash = String(account.values[3])
  assert.notEqual(hash, password)
  assert.equal(await verifyPassword({ hash, password }), true)
  assert.equal(await verifyPassword({ hash, password: password.trim() }), false)
  const audit = harness.writes.filter((entry) => entry.sql.startsWith("INSERT INTO pld_audit"))
  assert.equal(audit.length, 1)
  assert.equal(JSON.stringify(audit).includes(password), false)
  assert.equal(JSON.stringify(audit).includes(hash), false)
  assert.match(harness.writes.find((entry) => entry.sql.startsWith("INSERT INTO user"))!.sql, /requiresPasswordChange/)
})

test("Admin generated credential response remains compatible", async () => {
  const harness = adminHarness(), response = await harness.create({})
  assert.equal(response?.status, 201)
  const result = await response!.json() as Record<string, any>
  assert.equal(isValidPasswordLength(result.temporaryPassword), true)
  assert.equal("initialPasswordSet" in result, false)
  const hash = String(harness.writes.find((entry) => entry.sql.startsWith("INSERT INTO account"))!.values[3])
  assert.equal(await verifyPassword({ hash, password: result.temporaryPassword }), true)
})

test("Chosen credential does not bypass organization RBAC or admin protection", async () => {
  const actor = { ...owner, id: "ordinary-fixture", platformRole: "user" as const }
  for (const role of [undefined, "capture", "viewer"]) {
    const harness = adminHarness(role)
    await assert.rejects(harness.create({ initialPassword: "QAtest2026!" }, actor), (error: unknown) => error instanceof ApiError && error.status === 403)
    assert.deepEqual(harness.writes, [])
  }
  const harness = adminHarness("admin")
  await assert.rejects(harness.create({ role: "admin", initialPassword: "QAtest2026!" }, actor), (error: unknown) => error instanceof ApiError && error.status === 403)
  assert.deepEqual(harness.writes, [])
})
