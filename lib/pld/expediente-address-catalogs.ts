import { PAISES } from "@/lib/data/paises"

export const EXPEDIENTE_TIPOS_VIALIDAD = [
  "Calle",
  "Avenida",
  "Boulevard",
  "Calzada",
  "Carretera",
  "Circuito",
  "Privada",
  "Prolongación",
  "Andador",
  "Retorno",
  "Otro",
] as const

export const EXPEDIENTE_TIPO_VIALIDAD_OTRO = "Otro" as const

export type ExpedienteTipoVialidad = (typeof EXPEDIENTE_TIPOS_VIALIDAD)[number]
export type ExpedienteTipoVialidadSelection = ExpedienteTipoVialidad | ""

export function normalizeExpedienteCatalogText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-MX")
    .trim()
}

const EXPEDIENTE_TIPO_VIALIDAD_BY_NORMALIZED_VALUE = new Map<string, ExpedienteTipoVialidad>(
  EXPEDIENTE_TIPOS_VIALIDAD.map((option) => [normalizeExpedienteCatalogText(option), option]),
)

export function getExpedienteTipoVialidadSelection(
  value: string,
): ExpedienteTipoVialidadSelection {
  if (!value.trim()) return ""

  return (
    EXPEDIENTE_TIPO_VIALIDAD_BY_NORMALIZED_VALUE.get(normalizeExpedienteCatalogText(value)) ??
    EXPEDIENTE_TIPO_VIALIDAD_OTRO
  )
}

export function getExpedienteTipoVialidadCustomValue(value: string) {
  if (!value.trim()) return ""

  const catalogOption = EXPEDIENTE_TIPO_VIALIDAD_BY_NORMALIZED_VALUE.get(
    normalizeExpedienteCatalogText(value),
  )

  return catalogOption ? "" : value
}

export function applyExpedienteTipoVialidadSelection(
  currentValue: string,
  selection: ExpedienteTipoVialidad,
) {
  if (selection !== EXPEDIENTE_TIPO_VIALIDAD_OTRO) return selection

  return (
    getExpedienteTipoVialidadCustomValue(currentValue) || EXPEDIENTE_TIPO_VIALIDAD_OTRO
  )
}

export function applyExpedienteTipoVialidadCustomValue(customValue: string) {
  return customValue.trim() ? customValue : EXPEDIENTE_TIPO_VIALIDAD_OTRO
}

export function resolveExpedientePaisCode(value: string) {
  const trimmedValue = value.trim()
  if (!trimmedValue) return ""

  const normalizedValue = normalizeExpedienteCatalogText(trimmedValue)
  return (
    PAISES.find(
      (pais) =>
        normalizeExpedienteCatalogText(pais.code) === normalizedValue ||
        normalizeExpedienteCatalogText(pais.label) === normalizedValue,
    )?.code ?? trimmedValue
  )
}
