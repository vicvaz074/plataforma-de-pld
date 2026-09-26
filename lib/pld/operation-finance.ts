import { centsToDecimalString, parseMoneyToCents } from "./money"

/** Capture currency is independent from the MXN amount used for UMA thresholds. */
export interface PldOperationFinance {
  originalAmount: string
  currency: string
  exchangeRate: string
  exchangeRateDate?: string
  exchangeRateSource?: string
  mxnAmountCents: number
}

export type OperationFinance = PldOperationFinance

export interface PldOperationLegalContext {
  operacionFinancieraPorCuentaCliente?: boolean
  contraprestacionCentavos?: number
  montoBaseAvisoCentavos?: number
  montoNoDeterminado?: boolean
  excluidaPorSupuestoLegal?: boolean
}

export function isMxnCurrency(currency: string) {
  const code = currency.split(",")[0].trim().toUpperCase()
  return ["MXN", "1", "001", "PESO MEXICANO", "PESOS MEXICANOS"].includes(code)
}

/** LFPIORPI art. 17 XII A a): use the highest applicable value, not just the price. */
export function resolveNotarialNoticeBase(input: {
  precioPactadoCentavos: number
  valorCatastralCentavos?: number
  valorComercialCentavos?: number
  principalGarantizadoCentavos?: number
}) {
  const amounts = Object.values(input).filter((value): value is number => value !== undefined)
  if (amounts.some((value) => !Number.isSafeInteger(value) || value < 0)) throw new RangeError("Los valores notariales deben ser centavos enteros no negativos.")
  return Math.max(...amounts)
}

export function resolveOperationFinance(input: {
  amountText: string
  currency: string
  exchangeRate?: string
  exchangeRateDate?: string
  exchangeRateSource?: string
}): { ok: true; montoCentavos: number; finance: PldOperationFinance } | { ok: false; error: string } {
  const amount = parseMoneyToCents(input.amountText, { allowZero: true })
  if (!amount.ok) return { ok: false, error: amount.message }
  if (!input.currency.trim()) return { ok: false, error: "Selecciona la moneda del importe original." }
  const mxn = isMxnCurrency(input.currency)
  const rate = mxn ? "1" : input.exchangeRate?.trim() || ""
  // Decimal arithmetic: no floating point conversion and only one rounding to MXN cents.
  if (!/^\d+(?:\.\d{1,10})?$/.test(rate)) {
    return { ok: false, error: "Captura el tipo de cambio a MXN, positivo y con hasta diez decimales." }
  }
  const [whole, decimals = ""] = rate.split(".")
  const numerator = BigInt(whole + decimals)
  const denominator = BigInt(`1${"0".repeat(decimals.length)}`)
  if (numerator <= BigInt(0)) return { ok: false, error: "El tipo de cambio debe ser mayor a cero." }
  if (!mxn) {
    const date = input.exchangeRateDate || ""
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
      return { ok: false, error: "Captura una fecha válida para el tipo de cambio." }
    }
    if (!input.exchangeRateSource?.trim()) {
      return { ok: false, error: "Documenta la fuente del tipo de cambio utilizado." }
    }
  }
  const converted = (BigInt(amount.cents) * numerator * BigInt(2) + denominator) / (BigInt(2) * denominator)
  if (converted > BigInt(Number.MAX_SAFE_INTEGER)) {
    return { ok: false, error: "El equivalente MXN excede el monto que puede conservarse exactamente." }
  }
  const montoCentavos = Number(converted)
  return {
    ok: true,
    montoCentavos,
    finance: {
      originalAmount: centsToDecimalString(amount.cents),
      currency: input.currency.trim(),
      exchangeRate: rate,
      exchangeRateDate: mxn ? undefined : input.exchangeRateDate,
      exchangeRateSource: mxn ? undefined : input.exchangeRateSource!.trim(),
      mxnAmountCents: montoCentavos,
    },
  }
}

export function sanitizeOperationFinance(raw: unknown): PldOperationFinance | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined
  const value = raw as Record<string, unknown>
  if (typeof value.originalAmount !== "string" || typeof value.currency !== "string") return undefined
  const result = resolveOperationFinance({
    amountText: value.originalAmount,
    currency: value.currency,
    exchangeRate: typeof value.exchangeRate === "string" ? value.exchangeRate : undefined,
    exchangeRateDate: typeof value.exchangeRateDate === "string" ? value.exchangeRateDate : undefined,
    exchangeRateSource: typeof value.exchangeRateSource === "string" ? value.exchangeRateSource : undefined,
  })
  return result.ok ? result.finance : undefined
}
