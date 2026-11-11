import type { Company, Organization } from "@/lib/pilot/contracts"

interface CompanyCreationInput {
  organizationId: string
  organizationName: string
  name: string
  rfc: string
}

interface CompanyCreationActions {
  superadmin: boolean
  createOrganization: (name: string) => Promise<Organization>
  rememberOrganization: (organization: Organization) => void
  createCompany: (input: { organizationId: string; name: string; rfc: string }) => Promise<Company>
}

/** Keep a successful first step when company creation needs to be retried. */
export async function createCompanyWithOrganization(input: CompanyCreationInput, actions: CompanyCreationActions) {
  let organizationId = input.organizationId
  if (!organizationId) {
    if (!actions.superadmin) throw new Error("Selecciona una organización para crear la empresa.")
    const organizationName = input.organizationName.trim()
    if (!organizationName) throw new Error("Escribe el nombre de tu organización.")
    const organization = await actions.createOrganization(organizationName)
    actions.rememberOrganization(organization)
    organizationId = organization.id
  }
  return actions.createCompany({ organizationId, name: input.name, rfc: input.rfc })
}
