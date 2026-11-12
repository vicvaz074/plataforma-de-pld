import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"
import { isValidPasswordLength, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "../lib/pilot/password-policy"

function source(file: string) {
  return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
}
function namedHandler(file: string, name: string, scope: Record<string, unknown>) {
  const parsed = source(file)
  let initializer: ts.Expression | undefined
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === name) initializer = node.initializer
    ts.forEachChild(node, visit)
  }
  visit(parsed)
  assert.ok(initializer, `${file}: ${name}`)
  const compiled = ts.transpileModule(`const handler = ${initializer.getText(parsed)}`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  return new Function(...Object.keys(scope), compiled + "\nreturn handler;")(...Object.values(scope)) as (...args: unknown[]) => Promise<void>
}
function inputAttributes(file: string, id: string) {
  const parsed = source(file)
  let attributes: Record<string, string> | undefined
  function visit(node: ts.Node) {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(parsed) === "Input") {
      const attrs = Object.fromEntries(node.attributes.properties.filter(ts.isJsxAttribute).map(attr => [attr.name.getText(parsed), !attr.initializer ? "true" : ts.isStringLiteral(attr.initializer) ? attr.initializer.text : ts.isJsxExpression(attr.initializer) ? attr.initializer.expression?.getText(parsed) || "" : ""]))
      if (attrs.id === id) attributes = attrs
    }
    ts.forEachChild(node, visit)
  }
  visit(parsed)
  assert.ok(attributes, `${file}: ${id}`)
  return attributes
}
const policy = { isValidPasswordLength, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH }

test("account, activation and optional initial-password inputs share opaque password bounds", () => {
  for (const [file, ids] of [["app/profile/page.tsx", ["new", "confirmation"]], ["app/setup/page.tsx", ["setup-password", "setup-confirm"]], ["components/pilot/admin-dashboard.tsx", ["admin-initial-password"]]] as const) {
    for (const id of ids) {
      const attrs = inputAttributes(file, id)
      assert.equal(attrs.type, "password")
      assert.equal(attrs.autoComplete, "new-password")
      assert.equal(attrs.minLength, "PASSWORD_MIN_LENGTH")
      assert.equal(attrs.maxLength, "PASSWORD_MAX_LENGTH")
      assert.ok(attrs["aria-describedby"])
    }
  }
  assert.equal(inputAttributes("components/pilot/admin-dashboard.tsx", "admin-initial-password").required, undefined)
})

test("actual profile handler validates 11–128 before API and preserves submitted characters", async () => {
  for (const length of [10, 11, 128, 129]) {
    const value = " ".repeat(length)
    const calls: unknown[] = []
    const change = namedHandler("app/profile/page.tsx", "change", { ...policy, newPassword: value, confirmation: value, currentPassword: "test-current", setError: () => {}, setSuccess: () => {}, setBusy: () => {}, setCurrentPassword: () => {}, setNewPassword: () => {}, setConfirmation: () => {}, refresh: async () => {}, jsonRequest: (_method: string, body: unknown) => body, pilotApi: async (path: string, body: unknown) => { calls.push([path, body]) } })
    await change({ preventDefault() {} })
    assert.equal(calls.length, length >= 11 && length <= 128 ? 1 : 0)
    if (calls.length) assert.equal((calls[0] as [string, { newPassword: string }])[1].newPassword, value)
  }
})

test("actual activation handler uses the same limits without altering bootstrap authorization", async () => {
  for (const length of [10, 11, 128, 129]) {
    const calls: Array<{ path: string; input: { headers: { Authorization: string }; body: string } }> = []
    const value = "x".repeat(length)
    const activate = namedHandler("app/setup/page.tsx", "activate", { ...policy, password: value, confirmation: value, token: "fictitious-setup-token", email: "qa@example.test", name: "QA", setError: () => {}, setBusy: () => {}, setPassword: () => {}, setConfirmation: () => {}, setToken: () => {}, setDone: () => {}, pilotApi: async (path: string, input: typeof calls[number]["input"]) => { calls.push({ path, input }) } })
    await activate({ preventDefault() {} })
    assert.equal(calls.length, isValidPasswordLength(value) ? 1 : 0)
    if (calls.length) { assert.equal(calls[0].path, "/bootstrap"); assert.equal(calls[0].input.headers.Authorization, "Bearer fictitious-setup-token"); assert.equal(JSON.parse(calls[0].input.body).password, value) }
  }
})

test("actual admin submit omits an empty password and never duplicates a chosen one in success state", async () => {
  for (const length of [0, 10, 11, 128, 129]) {
    const value = "x".repeat(length)
    const calls: Array<{ body: Record<string, unknown>; refreshActor: boolean }> = []
    const credentials: unknown[] = []
    const cleared: string[] = []
    const submit = namedHandler("components/pilot/admin-dashboard.tsx", "submit", { ...policy, initialPassword: value, dialog: "user", busy: false, organizationId: "org-qa", name: "QA User", email: "qa@example.test", rfc: "", role: "viewer", companyIds: ["company-qa"], setError: () => {}, setInitialPassword: (next: string) => cleared.push(next), setDialog: () => {}, setCredential: (next: unknown) => credentials.push(next), mutate: async (_path: string, _method: string, body: Record<string, unknown>, refreshActor: boolean) => { calls.push({ body, refreshActor }); return value ? { initialPasswordSet: true } : { temporaryPassword: "t".repeat(20) } } })
    await submit({ preventDefault() {} })
    const accepted = length === 0 || isValidPasswordLength(value)
    assert.equal(calls.length, accepted ? 1 : 0)
    if (!accepted) continue
    assert.equal(calls[0].refreshActor, false, "Do not remount the one-time dialog")
    assert.deepEqual(calls[0].body.companyIds, ["company-qa"])
    assert.equal(calls[0].body.role, "viewer")
    if (length) {
      assert.equal(calls[0].body.initialPassword, value)
      assert.deepEqual(credentials, [{ email: "qa@example.test", initialPasswordSet: true }])
      assert.equal(JSON.stringify(credentials).includes(value), false)
    } else {
      assert.equal(Object.hasOwn(calls[0].body, "initialPassword"), false)
      assert.deepEqual(credentials, [{ email: "qa@example.test", password: "t".repeat(20) }])
    }
    assert.ok(cleared.includes(""))
  }
})

test("actual admin API success clears transient password before loading and never refreshes the actor for user creation", async () => {
  const events: string[] = []
  const mutate = namedHandler("components/pilot/admin-dashboard.tsx", "mutate", { setBusy: () => {}, setError: () => {}, setInitialPassword: (value: string) => { assert.equal(value, ""); events.push("clear") }, pilotApi: async () => { events.push("api"); return { initialPasswordSet: true } }, jsonRequest: (_method: string, body: unknown) => body, load: async () => { events.push("load") }, refreshSession: async () => { events.push("refresh") } })
  await mutate("/users", "POST", { initialPassword: "x".repeat(11) }, false)
  assert.deepEqual(events, ["api", "clear", "load"])
  const opened: string[] = []
  const open = namedHandler("components/pilot/admin-dashboard.tsx", "open", { useCallback: (handler: unknown) => handler, setError: () => {}, setName: () => {}, setEmail: () => {}, setRfc: () => {}, setInitialPassword: (value: string) => opened.push(value), setCompanyIds: () => {}, setRole: () => {}, setDialog: () => {} })
  await open("user")
  assert.deepEqual(opened, [""])
})
