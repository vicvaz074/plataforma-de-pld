import type { UmaValue } from "./types"

const INEGI_UMA_2026 =
  "INEGI UMA 2026: https://www.inegi.org.mx/contenidos/saladeprensa/boletines/2026/uma/uma2026.pdf"

export const UMA_VALUES: UmaValue[] = [
  {
    year: 2026,
    vigenciaInicio: "2026-02-01",
    vigenciaFin: "2027-01-31",
    diario: 117.31,
    mensual: 3566.22,
    anual: 42794.64,
    source: INEGI_UMA_2026,
  },
  {
    year: 2025,
    vigenciaInicio: "2025-02-01",
    vigenciaFin: "2026-01-31",
    diario: 113.14,
    mensual: 3439.46,
    anual: 41273.52,
    source: "INEGI UMA 2025",
  },
  {
    year: 2024,
    vigenciaInicio: "2024-02-01",
    vigenciaFin: "2025-01-31",
    diario: 108.57,
    mensual: 3300.53,
    anual: 39606.36,
    source: "INEGI UMA 2024",
  },
]

export function getUmaForDate(dateInput: string | Date): UmaValue {
  const date = normalizeDateOnly(dateInput)
  const match = UMA_VALUES.find((uma) => date >= uma.vigenciaInicio && date <= uma.vigenciaFin)

  return match ?? UMA_VALUES[0]
}

export function umaToMxn(uma: number, value: UmaValue): number {
  return roundMoney(uma * value.diario)
}

export function mxnToUma(montoMxn: number, value: UmaValue): number {
  return Number((montoMxn / value.diario).toFixed(4))
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function normalizeDateOnly(dateInput: string | Date): string {
  if (dateInput instanceof Date) {
    return dateInput.toISOString().slice(0, 10)
  }

  return dateInput.slice(0, 10)
}
