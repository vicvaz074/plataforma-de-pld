export type MoneyParseErrorCode =
  | "required"
  | "invalid-format"
  | "too-many-decimals"
  | "negative-not-allowed"
  | "zero-not-allowed"
  | "unsafe-amount"

export type MoneyParseResult =
  | {
      ok: true
      cents: number
      decimal: string
    }
  | {
      ok: false
      code: MoneyParseErrorCode
      message: string
    }

export interface MoneyParseOptions {
  allowNegative?: boolean
  allowZero?: boolean
  allowCurrencySymbol?: boolean
}

export interface MoneyFormatOptions {
  currency?: string
  locale?: string
  currencyDisplay?: "symbol" | "narrowSymbol" | "code" | "name"
}

const MAX_SAFE_CENTS = BigInt(Number.MAX_SAFE_INTEGER)

const MONEY_PARSE_MESSAGES: Record<MoneyParseErrorCode, string> = {
  required: "Ingresa un monto.",
  "invalid-format": "Usa un monto válido, por ejemplo 10000000 o 10,000,000.00.",
  "too-many-decimals": "El monto admite como máximo dos decimales.",
  "negative-not-allowed": "El monto no puede ser negativo.",
  "zero-not-allowed": "El monto debe ser mayor a cero.",
  "unsafe-amount": "El monto excede el máximo que puede conservarse exactamente.",
}

function moneyParseError(code: MoneyParseErrorCode): MoneyParseResult {
  return { ok: false, code, message: MONEY_PARSE_MESSAGES[code] }
}

function decimalFromCents(cents: number) {
  const sign = cents < 0 ? "-" : ""
  const absolute = Math.abs(cents)
  const whole = Math.floor(absolute / 100)
  const fraction = (absolute % 100).toString().padStart(2, "0")
  return `${sign}${whole}.${fraction}`
}

function parseNumberToCents(value: number, options: Required<MoneyParseOptions>): MoneyParseResult {
  if (!Number.isFinite(value)) return moneyParseError("invalid-format")
  if (value < 0 && !options.allowNegative) return moneyParseError("negative-not-allowed")
  if (value === 0 && !options.allowZero) return moneyParseError("zero-not-allowed")

  const scaled = value * 100
  if (!Number.isSafeInteger(Math.round(scaled))) return moneyParseError("unsafe-amount")

  const rounded = Math.round(scaled)
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 2
  if (Math.abs(scaled - rounded) > tolerance) return moneyParseError("too-many-decimals")

  return { ok: true, cents: rounded, decimal: decimalFromCents(rounded) }
}

/**
 * Convierte una captura monetaria a centavos enteros sin pasar por aritmética
 * de punto flotante. Acepta dígitos simples o agrupados con comas y hasta dos
 * decimales, por ejemplo `10000000`, `10,000,000` y `10,000,000.00`.
 */
export function parseMoneyToCents(
  input: string | number,
  options: MoneyParseOptions = {},
): MoneyParseResult {
  const resolvedOptions: Required<MoneyParseOptions> = {
    allowNegative: options.allowNegative ?? false,
    allowZero: options.allowZero ?? true,
    allowCurrencySymbol: options.allowCurrencySymbol ?? true,
  }

  if (typeof input === "number") {
    return parseNumberToCents(input, resolvedOptions)
  }

  let value = input.trim()
  if (!value) return moneyParseError("required")

  if (resolvedOptions.allowCurrencySymbol) {
    value = value.replace(/^\$\s*/, "")
  }

  const isNegative = value.startsWith("-")
  if (isNegative && !resolvedOptions.allowNegative) {
    return moneyParseError("negative-not-allowed")
  }

  const unsigned = isNegative ? value.slice(1) : value
  const dotIndex = unsigned.indexOf(".")
  if (dotIndex !== -1) {
    if (unsigned.indexOf(".", dotIndex + 1) !== -1) return moneyParseError("invalid-format")
    const fraction = unsigned.slice(dotIndex + 1)
    if (fraction.length > 2 && /^\d+$/.test(fraction)) return moneyParseError("too-many-decimals")
  }

  const match = unsigned.match(/^(\d+|\d{1,3}(?:,\d{3})+)(?:\.(\d{1,2}))?$/)
  if (!match) return moneyParseError("invalid-format")

  const wholeDigits = match[1].replace(/,/g, "").replace(/^0+(?=\d)/, "") || "0"
  const fractionDigits = (match[2] ?? "").padEnd(2, "0")
  const centsBigInt = BigInt(wholeDigits) * BigInt(100) + BigInt(fractionDigits || "0")
  const signedCents = isNegative ? -centsBigInt : centsBigInt

  if (signedCents > MAX_SAFE_CENTS || signedCents < -MAX_SAFE_CENTS) {
    return moneyParseError("unsafe-amount")
  }

  const cents = Number(signedCents)
  if (cents === 0 && !resolvedOptions.allowZero) return moneyParseError("zero-not-allowed")

  return { ok: true, cents, decimal: decimalFromCents(cents) }
}

export function moneyToCentsOrThrow(input: string | number, options: MoneyParseOptions = {}) {
  const parsed = parseMoneyToCents(input, options)
  if (!parsed.ok) {
    throw new RangeError(parsed.message)
  }
  return parsed.cents
}

export function isValidMoneyInput(input: string | number, options: MoneyParseOptions = {}) {
  return parseMoneyToCents(input, options).ok
}

export function assertSafeCents(cents: number) {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError("Los centavos deben ser un entero seguro.")
  }
  return cents
}

/** Espejo numérico para consumidores legacy. La fuente canónica sigue siendo el entero. */
export function centsToMoney(cents: number) {
  return assertSafeCents(cents) / 100
}

/** Valor decimal sin separadores, útil para XML, XLSM y controles de texto. */
export function centsToDecimalString(cents: number) {
  return decimalFromCents(assertSafeCents(cents))
}

export function formatMoneyFromCents(cents: number, options: MoneyFormatOptions = {}) {
  const amount = centsToMoney(cents)
  const currency = options.currency ?? "MXN"
  const locale = options.locale ?? "es-MX"

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: options.currencyDisplay ?? "symbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch (_error) {
    return `${centsToDecimalString(cents)} ${currency}`
  }
}

/**
 * Adaptador tolerante reservado para migrar números legacy. Las nuevas
 * capturas deben usar `parseMoneyToCents`, que rechaza más de dos decimales.
 */
export function coerceLegacyMoneyToCents(input: unknown, fallbackCents = 0) {
  if (typeof input === "string" || typeof input === "number") {
    const parsed = parseMoneyToCents(input, { allowNegative: true })
    if (parsed.ok) return parsed.cents

    if (typeof input === "number" && Number.isFinite(input)) {
      const rounded = Math.round(input * 100)
      if (Number.isSafeInteger(rounded)) return rounded
    }
  }

  return assertSafeCents(fallbackCents)
}
