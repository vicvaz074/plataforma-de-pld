export interface SatInstrumentoMonetarioOption {
  value: string
  label: string
}

/**
 * Catálogo InstrumentoMonetario de las plantillas XLSM oficiales del SAT.
 *
 * Los valores se conservan como códigos porque son los que se exportan a
 * `instrumento_monetario`; la etiqueta sólo es la representación visible.
 */
export const SAT_INSTRUMENTO_MONETARIO_OPTIONS = [
  { value: "1", label: "Efectivo" },
  { value: "2", label: "Tarjeta de Crédito" },
  { value: "3", label: "Tarjeta de Débito" },
  { value: "4", label: "Tarjeta de Prepago" },
  { value: "5", label: "Cheque Nominativo" },
  { value: "6", label: "Cheque de Caja" },
  { value: "7", label: "Cheques de Viajero" },
  { value: "8", label: "Transferencia Interbancaria" },
  { value: "9", label: "Transferencia Misma Institución" },
  { value: "10", label: "Transferencia Internacional" },
  { value: "11", label: "Orden de Pago" },
  { value: "12", label: "Giro" },
  { value: "13", label: "Oro o Platino Amonedados" },
  { value: "14", label: "Plata Amonedada" },
  { value: "15", label: "Metales Preciosos" },
  { value: "16", label: "Activos Virtuales" },
] as const satisfies readonly SatInstrumentoMonetarioOption[]

export type SatInstrumentoMonetarioCode =
  (typeof SAT_INSTRUMENTO_MONETARIO_OPTIONS)[number]["value"]

export function normalizeSatInstrumentoMonetarioOptions(
  options: readonly string[],
): SatInstrumentoMonetarioOption[] {
  const normalized = options
    .map((option) => {
      const separatorIndex = option.indexOf(",")
      if (separatorIndex < 0) return null
      const value = option.slice(0, separatorIndex).trim()
      const label = option.slice(separatorIndex + 1).trim()
      return value && label ? { value, label } : null
    })
    .filter((option): option is SatInstrumentoMonetarioOption => Boolean(option))

  return normalized.length > 0 ? normalized : [...SAT_INSTRUMENTO_MONETARIO_OPTIONS]
}
