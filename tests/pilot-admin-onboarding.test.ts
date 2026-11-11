import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { createCompanyWithOrganization } from "../components/pilot/admin-onboarding"
import type { Company, Organization } from "../lib/pilot/contracts"

const organization: Organization = { id: "organization-new", name: "Consultoría", mfaEnabled: false }
const company: Company = { id: "company-new", organizationId: organization.id, name: "Empresa", rfc: "AAA010101AAA", status: "active" }
const input = { organizationId: "", organizationName: "  Consultoría  ", name: company.name, rfc: company.rfc }

test("first-company onboarding remembers the organization before creating its company", async () => {
  const calls: string[] = []
  const result = await createCompanyWithOrganization(input, {
    superadmin: true,
    createOrganization: async name => { calls.push("organization"); assert.equal(name, organization.name); return organization },
    rememberOrganization: value => { calls.push("remember"); assert.equal(value.id, organization.id) },
    createCompany: async value => { calls.push("company"); assert.deepEqual(value, { organizationId: organization.id, name: company.name, rfc: company.rfc }); return company },
  })
  assert.equal(result, company)
  assert.deepEqual(calls, ["organization", "remember", "company"])
})

test("a failed company request retries against the saved organization without duplicating it", async () => {
  let organizationId = "", organizationRequests = 0, companyRequests = 0
  const actions = {
    superadmin: true,
    createOrganization: async () => { organizationRequests++; return organization },
    rememberOrganization: (value: Organization) => { organizationId = value.id },
    createCompany: async (value: { organizationId: string }) => {
      assert.equal(value.organizationId, organization.id)
      companyRequests++
      if (companyRequests === 1) throw new Error("RFC no válido.")
      return company
    },
  }
  await assert.rejects(createCompanyWithOrganization(input, actions), /RFC no válido/)
  assert.equal(organizationId, organization.id)
  assert.equal(await createCompanyWithOrganization({ ...input, organizationId }, actions), company)
  assert.equal(organizationRequests, 1)
  assert.equal(companyRequests, 2)
})

test("an existing organization is reused without requiring a global role", async () => {
  assert.equal(await createCompanyWithOrganization({ ...input, organizationId: organization.id }, {
    superadmin: false,
    createOrganization: async () => { assert.fail("Must not create another organization") },
    rememberOrganization: () => { assert.fail("The selected organization already exists") },
    createCompany: async value => { assert.equal(value.organizationId, organization.id); return company },
  }), company)
})

test("missing organization authorization or name performs no creation calls", async () => {
  const actions = {
    superadmin: false,
    createOrganization: async (): Promise<Organization> => { assert.fail("Must validate first") },
    rememberOrganization: () => { assert.fail("No organization was created") },
    createCompany: async (): Promise<Company> => { assert.fail("Must validate first") },
  }
  await assert.rejects(createCompanyWithOrganization(input, actions), /Selecciona una organización/)
  await assert.rejects(createCompanyWithOrganization({ ...input, organizationName: "  " }, { ...actions, superadmin: true }), /nombre de tu organización/)
})

test("admin onboarding consumes the setup link after loading and explicitly selects the created company", () => {
  const source = readFileSync(new URL("../components/pilot/admin-dashboard.tsx", import.meta.url), "utf8")
  assert.match(source, /\[loading,setLoading\]=useState\(true\)/)
  assert.match(source, /if\(!hasLoaded\|\|loading\|\|!isAdmin\|\|setupHandled\.current\)return/)
  assert.match(source, /new URLSearchParams\(url\.search\)\.get\("setup"\)/)
  assert.match(source, /url\.searchParams\.delete\("setup"\)/)
  assert.match(source, /window\.history\.replaceState/)
  assert.doesNotMatch(source, /useSearchParams/)
  assert.match(source, /await refreshSession\(\{companyId:created\.id\}\)/)
  assert.match(source, /companyIds\},dialog!=="user"\)/, "Account creation must not remount the one-time credential dialog")
  assert.match(source, /refreshActor=!path\.endsWith\("\/reset-password"\)/, "Reset credentials must also survive")
  assert.match(source, /Superadministrador global/)
  assert.match(source, /Crear primera empresa/)
})
