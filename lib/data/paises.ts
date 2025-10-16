import countries from "i18n-iso-countries"
import esLocale from "i18n-iso-countries/langs/es.json"

export interface PaisOption {
  value: string
  label: string
}

let cachedOptions: PaisOption[] | null = null

countries.registerLocale(esLocale)

export function getPaisOptions() {
  if (cachedOptions) return cachedOptions

  const names = countries.getNames("es", { select: "official" })
  const entries = Object.entries(names)

  cachedOptions = entries
    .map(([code, name]) => ({ value: code, label: name as string }))
    .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }))

  return cachedOptions
}
