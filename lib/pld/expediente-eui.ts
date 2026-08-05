import { ACTIVIDADES_VULNERABLES_ARTICULO_17 } from "./actividades"

export const EXPEDIENTE_EUI_SCHEMA_VERSION = 3
export const ARRENDAMIENTO_ACTIVITY_KEY = "fraccion-xv-uso-goce"

export interface ExpedienteIdentifiers {
  rfc: string
  nif: string
  curp: string
}

export interface SatEuiCatalogOption {
  value: string
  label: string
  code: string
}

export interface SatEuiCatalogs {
  actividadesEconomicas: SatEuiCatalogOption[]
  girosMercantiles: SatEuiCatalogOption[]
}

export interface ExpedienteIdentifierContext {
  personaFisica: boolean
  extranjero: boolean
}

const RFC_PATTERN = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/
const CURP_PATTERN = /^[A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/
const NIF_PATTERN = /^[A-Z0-9][A-Z0-9._/-]{1,29}$/
const SAT_EUI_CATALOG_URL = "/data/sat-xlsm-layouts/sat-fraccion-xv-arrendamiento.json"

let satEuiCatalogPromise: Promise<SatEuiCatalogs> | null = null

export const SAT_TIPOS_INMUEBLE: SatEuiCatalogOption[] = [
  ["1", "Casa / Casa en condominio"],
  ["2", "Departamento"],
  ["3", "Edificio habitacional"],
  ["4", "Edificio comercial"],
  ["5", "Edificio de oficinas"],
  ["6", "Local comercial independiente"],
  ["7", "Local en centro comercial"],
  ["8", "Oficina"],
  ["9", "Bodega comercial"],
  ["10", "Bodega industrial"],
  ["11", "Nave industrial"],
  ["12", "Terreno urbano habitacional"],
  ["13", "Terreno no urbano habitacional"],
  ["14", "Terreno urbano comercial o industrial"],
  ["15", "Terreno no urbano comercial o industrial"],
  ["16", "Terreno ejidal"],
  ["17", "Rancho / Hacienda / Quinta"],
  ["18", "Huerta"],
  ["99", "Otro"],
].map(([code, label]) => ({ code, label, value: `${code},${label}` }))

export function normalizeExpedienteIdentifiers(input: Partial<ExpedienteIdentifiers> | null | undefined) {
  return {
    rfc: typeof input?.rfc === "string" ? input.rfc.trim().toUpperCase() : "",
    nif: typeof input?.nif === "string" ? input.nif.trim().toUpperCase() : "",
    curp: typeof input?.curp === "string" ? input.curp.trim().toUpperCase() : "",
  }
}

export function getPrimaryExpedienteIdentifier(identifiers: ExpedienteIdentifiers) {
  return identifiers.rfc || identifiers.nif || identifiers.curp
}

export function validateExpedienteIdentifiers(
  identifiersInput: Partial<ExpedienteIdentifiers>,
  personaFisica: boolean,
): string | null {
  const identifiers = normalizeExpedienteIdentifiers(identifiersInput)
  if (!getPrimaryExpedienteIdentifier(identifiers)) {
    return personaFisica
      ? "Registra al menos un identificador: RFC, NIF o CURP."
      : "Registra al menos un identificador: RFC o NIF."
  }
  if (!personaFisica && identifiers.curp && !identifiers.rfc && !identifiers.nif) {
    return "Para una persona moral, registra RFC o NIF; la CURP no sustituye esos identificadores."
  }
  if (identifiers.rfc && !RFC_PATTERN.test(identifiers.rfc)) {
    return "El RFC no tiene un formato válido con homoclave."
  }
  if (identifiers.curp && !CURP_PATTERN.test(identifiers.curp)) {
    return "La CURP no tiene un formato válido de 18 caracteres."
  }
  if (identifiers.nif && !NIF_PATTERN.test(identifiers.nif)) {
    return "El NIF debe tener entre 2 y 30 caracteres alfanuméricos válidos."
  }
  return null
}

/**
 * Validates the identifiers that apply to the client's legal form and
 * nationality. The legacy validator above remains available for consumers
 * that do not yet provide nationality context.
 */
export function validateClientExpedienteIdentifiers(
  identifiersInput: Partial<ExpedienteIdentifiers>,
  context: ExpedienteIdentifierContext,
): string | null {
  const identifiers = normalizeExpedienteIdentifiers(identifiersInput)

  if (context.personaFisica) {
    if (!identifiers.rfc && !identifiers.curp && !(context.extranjero && identifiers.nif)) {
      return context.extranjero
        ? "Registra al menos un identificador del cliente: RFC, NIF o CURP."
        : "Registra al menos RFC o CURP para el cliente mexicano."
    }
  } else if (!identifiers.rfc && !(context.extranjero && identifiers.nif)) {
    return context.extranjero
      ? "Registra RFC o NIF para la persona moral extranjera."
      : "Registra el RFC de la persona moral mexicana."
  }

  if (identifiers.rfc && !RFC_PATTERN.test(identifiers.rfc)) {
    return "El RFC no tiene un formato válido con homoclave."
  }
  if (identifiers.curp && !CURP_PATTERN.test(identifiers.curp)) {
    return "La CURP no tiene un formato válido de 18 caracteres."
  }
  if (identifiers.nif && !NIF_PATTERN.test(identifiers.nif)) {
    return "El NIF debe tener entre 2 y 30 caracteres alfanuméricos válidos."
  }
  return null
}

export function getActividadEuiLabel(activityKey: string) {
  const actividad = ACTIVIDADES_VULNERABLES_ARTICULO_17.find((item) => item.key === activityKey)
  return actividad ? `${actividad.fraccion} · ${actividad.nombre}` : activityKey
}

export function createLegacyExpedienteId(identifier: string, nombre: string) {
  const source = identifier || nombre || "sin-identificador"
  const normalized = source
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return `legacy-${normalized || "sin-identificador"}`
}

function parseSatOption(raw: string): SatEuiCatalogOption {
  if (raw.includes("||")) {
    const [label = raw, code = raw] = raw.split("||")
    return { value: code.trim(), code: code.trim(), label: label.trim() }
  }
  const commaIndex = raw.indexOf(",")
  if (commaIndex > 0) {
    const code = raw.slice(0, commaIndex).trim()
    const label = raw.slice(commaIndex + 1).trim()
    return { value: code, code, label }
  }
  return { value: raw, code: raw, label: raw }
}

export function loadSatEuiCatalogs(): Promise<SatEuiCatalogs> {
  if (!satEuiCatalogPromise) {
    satEuiCatalogPromise = fetch(SAT_EUI_CATALOG_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`No se pudo cargar el catálogo EUI SAT (${response.status})`)
        return response.json() as Promise<{
          optionLists?: Array<{ id?: string; options?: string[] }>
        }>
      })
      .then((snapshot) => {
        const lists = Array.isArray(snapshot.optionLists) ? snapshot.optionLists : []
        const findOptions = (ids: string[]) =>
          lists.find((list) => ids.includes(String(list.id)))?.options?.map(parseSatOption) ?? []
        return {
          actividadesEconomicas: findOptions(["Actividades", "CATALOGO_DE_ACTIVIDADES_ECONOMICAS"]),
          girosMercantiles: findOptions(["Giros", "CATALOGO_DE_GIRO_MERCANTIL"]),
        }
      })
      .catch((error) => {
        console.error("No se pudieron cargar los catálogos oficiales del EUI:", error)
        satEuiCatalogPromise = null
        return { actividadesEconomicas: [], girosMercantiles: [] }
      })
  }
  return satEuiCatalogPromise
}
