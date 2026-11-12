import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"
import { ALL_ACTIONS, MODULE_LABELS, sessionCan, sessionCanNavigate, sessionIsAdmin, type Company, type ModuleKey, type PilotSession } from "../lib/pilot/contracts"

const company: Company = { id: "company", organizationId: "org", name: "QA ficticia", rfc: "FSC220908AC2", status: "active" }
const owner: PilotSession = {
  user: { id: "owner", name: "QA", email: "qa@example.test", platformRole: "superadmin", status: "active", requiresPasswordChange: false, twoFactorEnabled: false },
  organizations: [], companies: [], memberships: [], grants: [], mfaRequired: false,
}

test("global administrator discovers every module before creating a company without authorizing unscoped data", () => {
  assert.equal(sessionIsAdmin(owner), true)
  for (const module of Object.keys(MODULE_LABELS) as ModuleKey[]) {
    assert.equal(sessionCanNavigate(owner, null, module), true)
    for (const action of ALL_ACTIONS) {
      assert.equal(sessionCan(owner, null, module, action), false, "Navigation must not authorize unscoped storage")
      assert.equal(sessionCan(owner, company, module, action), true, "No self-grants needed for a real company")
      assert.equal(sessionCan(owner, { ...company, status: "archived" }, module, action), false)
    }
  }
})

test("global discovery does not expand a private inbox or an ordinary/suspended user's data access", () => {
  const inbox = { ...company, id: "inbox:org:owner" }
  const withInbox = { ...owner, organizations: [{ id: "org", name: "QA", mfaEnabled: false }] }
  assert.equal(sessionCanNavigate(withInbox, inbox, "operaciones"), true)
  assert.equal(sessionCan(withInbox, inbox, "operaciones", "edit"), false)
  assert.equal(sessionCan(withInbox, inbox, "expedientes", "edit"), true)
  const ordinary: PilotSession = { ...owner, user: { ...owner.user, platformRole: "user" }, grants: [{ userId: "owner", companyId: company.id, permissions: { expedientes: ["view"] } }] }
  assert.equal(sessionIsAdmin(ordinary), false)
  assert.equal(sessionCanNavigate(ordinary, null, "expedientes"), false)
  assert.equal(sessionCanNavigate(ordinary, company, "expedientes"), true)
  assert.equal(sessionCanNavigate(ordinary, company, "operaciones"), false)
  const suspended: PilotSession = { ...owner, user: { ...owner.user, status: "suspended" } }
  assert.equal(sessionIsAdmin(suspended), false)
  assert.equal(sessionCanNavigate(suspended, company, "operaciones"), false)
  assert.equal(sessionCanNavigate(null, null, "expedientes"), false)
})

test("home, desktop and mobile share discovery while the provider keeps company and generation guards", () => {
  for (const file of ["app/page.tsx", "components/sidebar.tsx", "components/header.tsx"]) {
    const source = readFileSync(file, "utf8")
    assert.match(source, /sessionCanNavigate\(session, company, PATH_MODULES\[/, file)
  }
  const provider = readFileSync("components/pilot/pilot-provider.tsx", "utf8")
  assert.match(provider, /preferredCompanyId \|\| company\?\.id/)
  assert.match(provider, /storageGeneration !== generation/)
  assert.match(provider, /!sessionCan\(session, company, moduleKey, "view"\)/)
  assert.match(provider, /\/dashboard\?setup=company/)
  assert.match(provider, /sessionIsAdmin\(session\) \? "\/dashboard\?setup=company"/)
  assert.match(provider, /session\.user\.requiresPasswordChange \|\| session\.mfaRequired/)
  assert.ok(provider.indexOf(": credentialsPending ?") < provider.indexOf(": needsCompany ?"), "Credential change must still block module contents before company setup")
  assert.match(provider, /Actualiza tu acceso para continuar/)
})

test("organization administrators discover all modules before first-company setup, including pending password change", () => {
  const otherCompany = { ...company, id: "other-company", organizationId: "other-org" }
  for (const requiresPasswordChange of [false, true]) {
    const admin: PilotSession = {
      ...owner,
      user: { ...owner.user, platformRole: "user", requiresPasswordChange },
      organizations: [{ id: "org", name: "QA organization", mfaEnabled: false }],
      memberships: [{ organizationId: "org", userId: owner.user.id, role: "admin" }],
    }
    assert.equal(sessionIsAdmin(admin), true)
    for (const module of Object.keys(MODULE_LABELS) as ModuleKey[]) {
      assert.equal(sessionCanNavigate(admin, null, module), true, module)
      for (const action of ALL_ACTIONS) {
        assert.equal(sessionCan(admin, null, module, action), false, "Discovery must not authorize account-only data")
        assert.equal(sessionCan(admin, company, module, action), true, "Existing organization permissions remain unchanged")
        assert.equal(sessionCan(admin, otherCompany, module, action), false, "No cross-organization data permission")
        assert.equal(sessionCan(admin, { ...company, status: "archived" }, module, action), false)
      }
    }
    const inbox = { ...company, id: `inbox:org:${admin.user.id}` }
    for (const module of Object.keys(MODULE_LABELS) as ModuleKey[]) {
      assert.equal(sessionCanNavigate(admin, inbox, module), true)
      for (const action of ALL_ACTIONS) assert.equal(sessionCan(admin, inbox, module, action), module === "expedientes" && ["view", "edit", "upload", "download"].includes(action), "Inbox remains EUI-only")
    }
    const suspended = { ...admin, user: { ...admin.user, status: "suspended" as const } }
    assert.equal(sessionIsAdmin(suspended), false)
    for (const module of Object.keys(MODULE_LABELS) as ModuleKey[]) assert.equal(sessionCanNavigate(suspended, null, module), false)
  }
})

test("ordinary organizational membership does not grant administrator discovery or cross-company data", () => {
  for (const role of ["compliance", "capture", "viewer"] as const) {
    const ordinary: PilotSession = { ...owner, user: { ...owner.user, platformRole: "user", requiresPasswordChange: true }, memberships: [{ organizationId: "org", userId: owner.user.id, role }], grants: [{ companyId: company.id, userId: owner.user.id, permissions: { expedientes: ["view"] } }] }
    for (const module of Object.keys(MODULE_LABELS) as ModuleKey[]) assert.equal(sessionCanNavigate(ordinary, null, module), false)
    assert.equal(sessionCanNavigate(ordinary, company, "expedientes"), true)
    assert.equal(sessionCanNavigate(ordinary, company, "operaciones"), false)
    assert.equal(sessionCan(ordinary, { ...company, id: "other-company" }, "expedientes", "view"), false)
  }
})

test("actual provider refresh selects the new company and initializes an account-only generation", async () => {
  const file = "components/pilot/pilot-provider.tsx"
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let declaration = ""
  const visit = (node: ts.Node) => {
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some(value => ts.isIdentifier(value.name) && value.name.text === "refresh")) declaration = node.getText(source)
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.ok(declaration, "Exercise the production callback, not a parallel implementation")
  const next = { ...company, id: "new-company", name: "Nueva QA" }
  const selected: string[] = []
  const noop = () => undefined
  const generations: Array<number | null> = []
  const dependencies = {
    useCallback: (callback: unknown) => callback,
    pilotApi: async () => ({ ...owner, companies: [company, next] }),
    mode: "cloud", refreshEpoch: { current: 0 }, configurePilotSession: noop, setSession: noop, setError: noop,
    company, sessionStorage: { getItem: () => company.id }, selectCompany: async (value: Company) => { selected.push(value.id) },
    setCompany: noop, setGeneration: (value: number | null) => { generations.push(value) }, getModuleStorageGeneration: () => 1, setVerifiedPathname: noop, setReady: noop,
    pathname: "/dashboard", router: { replace: noop },
  }
  const js = ts.transpileModule(declaration, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
  const refresh = new Function(...Object.keys(dependencies), `${js}\nreturn refresh`)(...Object.values(dependencies))
  await refresh(false, next.id)
  assert.deepEqual(selected, [next.id])
  const accountOnly = { ...dependencies, company: null, pilotApi: async () => owner }
  const refreshAccount = new Function(...Object.keys(accountOnly), `${js}\nreturn refresh`)(...Object.values(accountOnly))
  await refreshAccount()
  assert.deepEqual(generations, [1], "An empty account must not wait until its first poll to initialize its render key")
})
