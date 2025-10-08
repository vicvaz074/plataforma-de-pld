export type UmaPeriod = {
  cycle: string
  validFrom: string
  validTo: string
  daily: number
  monthly: number
  annual: number
  months: { month: number; year: number }[]
}

type UmaCycleSource = {
  cycle: string
  validFrom: string
  validTo: string
  daily: number
}

const UMA_CYCLES_SOURCE: UmaCycleSource[] = [
  {
    cycle: "2020",
    validFrom: "2020-02-01",
    validTo: "2021-01-31",
    daily: 86.88,
  },
  {
    cycle: "2021",
    validFrom: "2021-02-01",
    validTo: "2022-01-31",
    daily: 89.62,
  },
  {
    cycle: "2022",
    validFrom: "2022-02-01",
    validTo: "2023-01-31",
    daily: 96.22,
  },
  {
    cycle: "2023",
    validFrom: "2023-02-01",
    validTo: "2024-01-31",
    daily: 103.74,
  },
  {
    cycle: "2024",
    validFrom: "2024-02-01",
    validTo: "2025-01-31",
    daily: 108.57,
  },
  {
    cycle: "2025",
    validFrom: "2025-02-01",
    validTo: "2026-01-31",
    daily: 115.8,
  },
]

function calculateMonthly(daily: number) {
  return Number((daily * 30.4).toFixed(2))
}

function calculateAnnual(daily: number) {
  return Number((daily * 365).toFixed(2))
}

function buildMonths(validFrom: string, length = 12) {
  const startDate = new Date(validFrom)
  const months = [] as { month: number; year: number }[]
  for (let index = 0; index < length; index += 1) {
    const date = new Date(startDate)
    date.setMonth(startDate.getMonth() + index)
    months.push({ month: date.getMonth() + 1, year: date.getFullYear() })
  }
  return months
}

export const UMA_PERIODS: UmaPeriod[] = UMA_CYCLES_SOURCE.map((cycle) => {
  const monthly = calculateMonthly(cycle.daily)
  const annual = calculateAnnual(cycle.daily)
  return {
    cycle: cycle.cycle,
    validFrom: cycle.validFrom,
    validTo: cycle.validTo,
    daily: cycle.daily,
    monthly,
    annual,
    months: buildMonths(cycle.validFrom),
  }
})

type UmaMonth = {
  month: number
  year: number
  cycle: string
  daily: number
  monthly: number
  annual: number
  validFrom: string
  validTo: string
}

const UMA_MONTHS_FULL: UmaMonth[] = UMA_PERIODS.flatMap((period) =>
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

const WINDOW_START = new Date(2020, 8, 1) // septiembre 2020
const WINDOW_MONTHS = 60
const WINDOW_END = new Date(WINDOW_START)
WINDOW_END.setMonth(WINDOW_START.getMonth() + WINDOW_MONTHS)

export const UMA_MONTHS: UmaMonth[] = UMA_MONTHS_FULL.filter((entry) => {
  const entryDate = new Date(entry.year, entry.month - 1, 1)
  return entryDate >= WINDOW_START && entryDate < WINDOW_END
})

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

export function listUmaByYear(year: number) {
  return UMA_MONTHS.filter((entry) => entry.year === year)
    .sort((a, b) => a.month - b.month)
    .map((entry) => ({
      month: entry.month,
      monthly: entry.monthly,
      cycle: entry.cycle,
    }))
}
