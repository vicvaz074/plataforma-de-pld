import type { PldTenant, PldTenantsState } from "./types"

export const PLD_TENANTS_STORAGE_KEY = "pld-tenants"
export const PLD_ACTIVE_TENANT_STORAGE_KEY = "pld-active-tenant-id"

export function buildDefaultPldTenants(activeTenantId = "tenant-demo-pld"): PldTenantsState {
  const tenant: PldTenant = {
    id: activeTenantId,
    schemaVersion: 1,
    rfc: "ISN2103158Q7",
    razonSocial: "Inmuebles Santa Norte, S.A. de C.V.",
    nombreComercial: "Demo PLD Multi-cliente",
    representanteCumplimiento: {
      nombre: "Laura Méndez Ortega",
      cargo: "Representante Encargada de Cumplimiento",
      email: "cumplimiento@example.com",
    },
    responsablesInternos: [
      {
        area: "Cumplimiento PLD",
        nombre: "Laura Méndez Ortega",
        funcion: "Validar expedientes, avisos, informes y alertas.",
      },
      {
        area: "Operaciones",
        nombre: "Daniel Rivas Campos",
        funcion: "Capturar actos u operaciones y soportes.",
      },
      {
        area: "Administración",
        nombre: "Mónica Salcedo Ruiz",
        funcion: "Conservar acuses, folios y evidencia.",
      },
    ],
    actividades: [
      {
        actividadKey: "fraccion-v-inmuebles",
        altaSppldActiva: true,
        fechaAlta: "2025-07-18",
        responsableOperativo: "Jurídico inmobiliario",
        responsableCumplimiento: "Cumplimiento PLD",
        politicaInterna: "Identificación completa previa a firma y control de pagos.",
      },
      {
        actividadKey: "fraccion-vi-metales",
        altaSppldActiva: true,
        fechaAlta: "2025-08-02",
        responsableOperativo: "Ventas corporativas",
        responsableCumplimiento: "Cumplimiento PLD",
        politicaInterna: "DDC reforzada para clientes nuevos u ocasionales de alto monto.",
      },
      {
        actividadKey: "fraccion-viii-vehiculos",
        altaSppldActiva: true,
        fechaAlta: "2025-09-10",
        responsableOperativo: "Operaciones",
        responsableCumplimiento: "Cumplimiento PLD",
        politicaInterna: "Validar congruencia entre perfil económico y valor del vehículo.",
      },
      {
        actividadKey: "fraccion-xv-uso-goce",
        altaSppldActiva: true,
        fechaAlta: "2025-07-18",
        responsableOperativo: "Administración de inmuebles",
        responsableCumplimiento: "Cumplimiento PLD",
        politicaInterna: "Monitoreo de rentas, pagos anticipados y cambios en forma de pago.",
      },
    ],
    manual: {
      version: "1.0-generalizada",
      vigenteDesde: "2026-05-11",
      proximaRevision: "2027-05-11",
    },
    ebr: {
      metodologiaVersion: "CNBV-EBR-2019-ENR-2023",
      ultimaRevision: "2026-05-11",
      proximaRevision: "2027-05-11",
    },
    policies: {
      conservaAnios: 10,
      noGuardarEfirma: true,
      requiereCotejo: true,
    },
  }

  return {
    schemaVersion: 1,
    activeTenantId,
    tenants: [tenant],
  }
}

export function sanitizePldTenant(raw: unknown, fallbackId = "tenant-demo-pld"): PldTenant {
  if (!raw || typeof raw !== "object") {
    return buildDefaultPldTenants(fallbackId).tenants[0]
  }

  const source = raw as Partial<PldTenant> & Record<string, unknown>
  const defaults = buildDefaultPldTenants(typeof source.id === "string" ? source.id : fallbackId).tenants[0]

  return {
    ...defaults,
    ...source,
    id: typeof source.id === "string" && source.id.trim() ? source.id : defaults.id,
    schemaVersion: 1,
    rfc: typeof source.rfc === "string" && source.rfc.trim() ? source.rfc.trim().toUpperCase() : defaults.rfc,
    razonSocial:
      typeof source.razonSocial === "string" && source.razonSocial.trim()
        ? source.razonSocial.trim()
        : defaults.razonSocial,
    representanteCumplimiento:
      source.representanteCumplimiento && typeof source.representanteCumplimiento === "object"
        ? {
            ...defaults.representanteCumplimiento,
            ...source.representanteCumplimiento,
          }
        : defaults.representanteCumplimiento,
    responsablesInternos: Array.isArray(source.responsablesInternos)
      ? source.responsablesInternos as PldTenant["responsablesInternos"]
      : defaults.responsablesInternos,
    actividades: Array.isArray(source.actividades)
      ? source.actividades as PldTenant["actividades"]
      : defaults.actividades,
    manual: source.manual && typeof source.manual === "object" ? { ...defaults.manual, ...source.manual } : defaults.manual,
    ebr: source.ebr && typeof source.ebr === "object" ? { ...defaults.ebr, ...source.ebr } : defaults.ebr,
    policies: {
      ...defaults.policies,
      ...(source.policies && typeof source.policies === "object" ? source.policies : {}),
      noGuardarEfirma: true,
    },
  }
}
