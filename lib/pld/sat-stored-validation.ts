import { validateGeneratedSatXml } from "./sat-xml-validation"
import type { SatDownloadOption, SatOutputValidation } from "./types"

/** Historical status is not proof that stored XML matches the current verified XSD. */
export function revalidateStoredSatPackage<T extends { xml: string; validation: SatOutputValidation; downloads: SatDownloadOption[] }>(value: T): T {
  const checked = validateGeneratedSatXml(value.xml)
  const strings = (items: unknown): string[] => Array.isArray(items) ? items.filter((item): item is string => typeof item === "string") : []
  const missingFields = strings(value.validation.missingFields)
  const errors = Array.from(new Set([...strings(value.validation.errors), ...checked.errors.map((error) => `XML: ${error}`)]))
  const ready = checked.valid && value.validation.status === "listo" && !missingFields.length && !errors.length
  return {
    ...value,
    validation: { ...value.validation, status: ready ? "listo" : "borrador_bloqueado", missingFields, errors, warnings: strings(value.validation.warnings) },
    downloads: value.downloads.map((download) => download.kind === "xml" || download.id === "xml" ? { ...download, status: ready ? "available" : "blocked" } : download),
  }
}
