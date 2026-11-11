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
})

test("actual provider refresh selects the newly created company instead of its stale captured company", async () => {
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
  const dependencies = {
    useCallback: (callback: unknown) => callback,
    pilotApi: async () => ({ ...owner, companies: [company, next] }),
    mode: "cloud", refreshEpoch: { current: 0 }, configurePilotSession: noop, setSession: noop, setError: noop,
    company, sessionStorage: { getItem: () => company.id }, selectCompany: async (value: Company) => { selected.push(value.id) },
    setCompany: noop, setGeneration: noop, getModuleStorageGeneration: () => 1, setVerifiedPathname: noop, setReady: noop,
    pathname: "/dashboard", router: { replace: noop },
  }
  const js = ts.transpileModule(declaration, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
  const refresh = new Function(...Object.keys(dependencies), `${js}\nreturn refresh`)(...Object.values(dependencies))
  await refresh(false, next.id)
  assert.deepEqual(selected, [next.id])
})
