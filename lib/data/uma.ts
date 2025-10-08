export type UmaPeriod = {
  cycle: string
  validFrom: string
  validTo: string
  daily: number
  monthly: number
  annual: number
  months: { month: number; year: number }[]
}

export const UMA_PERIODS: UmaPeriod[] = [
  {
    cycle: "2020",
    validFrom: "2020-02-01",
    validTo: "2021-01-31",
    daily: 86.88,
    monthly: 2641.15,
    annual: 31693.8,
    months: Array.from({ length: 12 }).map((_, index) => {
      const start = new Date(2020, 1, 1)
      start.setMonth(start.getMonth() + index)
      return { month: start.getMonth() + 1, year: start.getFullYear() }
    }),
  },
  {
    cycle: "2021",
    validFrom: "2021-02-01",
    validTo: "2022-01-31",
    daily: 89.62,
    monthly: 2724.45,
    annual: 32693.4,
    months: Array.from({ length: 12 }).map((_, index) => {
      const start = new Date(2021, 1, 1)
      start.setMonth(start.getMonth() + index)
      return { month: start.getMonth() + 1, year: start.getFullYear() }
    }),
  },
  {
    cycle: "2022",
    validFrom: "2022-02-01",
    validTo: "2023-01-31",
    daily: 96.22,
    monthly: 2925.09,
    annual: 35101.08,
    months: Array.from({ length: 12 }).map((_, index) => {
      const start = new Date(2022, 1, 1)
      start.setMonth(start.getMonth() + index)
      return { month: start.getMonth() + 1, year: start.getFullYear() }
    }),
  },
  {
    cycle: "2023",
    validFrom: "2023-02-01",
    validTo: "2024-01-31",
    daily: 103.74,
    monthly: 3162.52,
    annual: 37950.45,
    months: Array.from({ length: 12 }).map((_, index) => {
      const start = new Date(2023, 1, 1)
      start.setMonth(start.getMonth() + index)
      return { month: start.getMonth() + 1, year: start.getFullYear() }
    }),
  },
  {
    cycle: "2024",
    validFrom: "2024-02-01",
    validTo: "2025-01-31",
    daily: 108.57,
    monthly: 3300.53,
    annual: 39606.36,
    months: Array.from({ length: 12 }).map((_, index) => {
      const start = new Date(2024, 1, 1)
      start.setMonth(start.getMonth() + index)
      return { month: start.getMonth() + 1, year: start.getFullYear() }
    }),
  },
]

export const UMA_MONTHS = UMA_PERIODS.flatMap((period) =>
  period.months.map((month) => ({
    ...month,
    cycle: period.cycle,
    daily: period.daily,
    monthly: period.monthly,
    annual: period.annual,
    validFrom: period.validFrom,
    validTo: period.validTo,
  })),
)

export function findUmaByMonthYear(month: number, year: number) {
  return UMA_MONTHS.find((entry) => entry.month === month && entry.year === year)
}

export function listAvailableYears() {
  return Array.from(new Set(UMA_MONTHS.map((entry) => entry.year))).sort((a, b) => a - b)
}

export function listMonthsForYear(year: number) {
  return UMA_MONTHS.filter((entry) => entry.year === year)
    .map((entry) => entry.month)
    .sort((a, b) => a - b)
}
