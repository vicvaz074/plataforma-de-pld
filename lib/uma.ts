export interface UmaPeriod {
  periodLabel: string
  year: number
  start: string
  end: string
  daily: number
  monthly: number
  annual: number
}

export const UMA_PERIODS: UmaPeriod[] = [
  {
    periodLabel: "2020-2021",
    year: 2020,
    start: "2020-02-01",
    end: "2021-01-31",
    daily: 86.88,
    monthly: 2641.15,
    annual: 31693.8,
  },
  {
    periodLabel: "2021-2022",
    year: 2021,
    start: "2021-02-01",
    end: "2022-01-31",
    daily: 89.62,
    monthly: 2724.45,
    annual: 32693.4,
  },
  {
    periodLabel: "2022-2023",
    year: 2022,
    start: "2022-02-01",
    end: "2023-01-31",
    daily: 96.22,
    monthly: 2925.09,
    annual: 35101.08,
  },
  {
    periodLabel: "2023-2024",
    year: 2023,
    start: "2023-02-01",
    end: "2024-01-31",
    daily: 103.74,
    monthly: 3153.7,
    annual: 37844.4,
  },
  {
    periodLabel: "2024-2025",
    year: 2024,
    start: "2024-02-01",
    end: "2025-01-31",
    daily: 108.57,
    monthly: 3300.53,
    annual: 39606.36,
  },
]

export interface UmaMonth {
  key: string
  year: number
  month: number
  label: string
  period?: UmaPeriod
  published: boolean
}

const monthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

const parseDate = (value: string) => new Date(`${value}T00:00:00`)

const findPeriodForMonth = (year: number, month: number) => {
  const monthDate = new Date(Date.UTC(year, month - 1, 1))
  return UMA_PERIODS.find((period) => {
    const start = parseDate(period.start)
    const end = parseDate(period.end)
    return monthDate >= start && monthDate <= end
  })
}

export const generateUmaMonths = (startYear = 2020, startMonth = 9, totalMonths = 60): UmaMonth[] => {
  const months: UmaMonth[] = []
  let currentYear = startYear
  let currentMonth = startMonth

  for (let i = 0; i < totalMonths; i++) {
    const period = findPeriodForMonth(currentYear, currentMonth)
    months.push({
      key: `${currentYear}-${String(currentMonth).padStart(2, "0")}`,
      year: currentYear,
      month: currentMonth,
      label: `${monthNames[currentMonth - 1]} ${currentYear}`,
      period,
      published: Boolean(period),
    })

    currentMonth++
    if (currentMonth > 12) {
      currentMonth = 1
      currentYear += 1
    }
  }

  return months
}

export const getUmaForMonth = (year: number, month: number) => {
  const period = findPeriodForMonth(year, month)
  if (!period) return null
  return period
}

export const formatCurrency = (value: number, currency: string | undefined = "MXN") =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

export const formatUma = (value: number) => `${value.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} UMA`
