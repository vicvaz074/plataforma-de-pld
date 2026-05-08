export function calcularFechaLimiteAvisoOrdinario(fechaOperacion: string | Date): string {
  const date = normalizeDate(fechaOperacion)
  const year = date.getUTCMonth() === 11 ? date.getUTCFullYear() + 1 : date.getUTCFullYear()
  const month = date.getUTCMonth() === 11 ? 0 : date.getUTCMonth() + 1

  return new Date(Date.UTC(year, month, 17)).toISOString().slice(0, 10)
}

export function calcularFechaLimiteAvisoSospecha(fechaConocimiento: string | Date): string {
  if (fechaConocimiento instanceof Date) {
    return new Date(fechaConocimiento.getTime() + 24 * 60 * 60 * 1000).toISOString()
  }

  const offsetMatch = fechaConocimiento.match(/([+-]\d{2}:\d{2})$/)
  const offset = offsetMatch?.[1]
  const date = new Date(fechaConocimiento)
  const plus24 = new Date(date.getTime() + 24 * 60 * 60 * 1000)

  if (!offset) {
    return plus24.toISOString()
  }

  return formatWithOffset(plus24, offset)
}

export function subtractMonths(dateInput: string | Date, months: number): string {
  const date = normalizeDate(dateInput)
  date.setUTCMonth(date.getUTCMonth() - months)
  return date.toISOString().slice(0, 10)
}

function normalizeDate(dateInput: string | Date): Date {
  if (dateInput instanceof Date) {
    return new Date(Date.UTC(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate()))
  }

  return new Date(`${dateInput.slice(0, 10)}T00:00:00.000Z`)
}

function formatWithOffset(date: Date, offset: string): string {
  const sign = offset.startsWith("-") ? -1 : 1
  const [hours, minutes] = offset.slice(1).split(":").map(Number)
  const offsetMinutes = sign * (hours * 60 + minutes)
  const local = new Date(date.getTime() + offsetMinutes * 60 * 1000)
  const isoLocal = local.toISOString().replace("Z", "")

  return `${isoLocal}${offset}`
}
