import test from "node:test"
import assert from "node:assert/strict"
import { resolveOperationFinance, resolveNotarialNoticeBase, sanitizeOperationFinance } from "../lib/pld/operation-finance"
import { evaluarOperacionVulnerable } from "../lib/pld/operations"

test("MXN remains exactly ten million; foreign amount needs a documented rate", () => {
  const mxn = resolveOperationFinance({ amountText: "10,000,000.00", currency: "MXN" })
  assert.equal(mxn.ok && mxn.montoCentavos, 1_000_000_000)
  assert.equal(resolveOperationFinance({ amountText: "100", currency: "USD" }).ok, false)
  const usd = resolveOperationFinance({ amountText: "10,000,000", currency: "USD", exchangeRate: "18.123456", exchangeRateDate: "2026-09-26", exchangeRateSource: "Fuente documentada de prueba" })
  assert.equal(usd.ok && usd.montoCentavos, 18_123_456_000)
  if (usd.ok) assert.deepEqual(sanitizeOperationFinance(usd.finance), usd.finance)
  assert.equal(resolveOperationFinance({ amountText: "1.001", currency: "MXN" }).ok, false)
})

test("FX rounds once at the MXN cent, rejects missing source and invalid date", () => {
  const input = { amountText: "0.01", currency: "USD", exchangeRate: "1.5", exchangeRateDate: "2026-09-26", exchangeRateSource: "Prueba" }
  const result = resolveOperationFinance(input)
  assert.equal(result.ok && result.montoCentavos, 2)
  assert.equal(resolveOperationFinance({ ...input, exchangeRateSource: "" }).ok, false)
  assert.equal(resolveOperationFinance({ ...input, exchangeRateDate: "2026-02-30" }).ok, false)
})

test("a cent below a threshold must not trigger the notice", () => {
  const base = { actividadKey: "fraccion-iv-prestamos", clienteKey: "cliente-1", fechaOperacion: "2026-09-26", montoMxn: 0 }
  const threshold = evaluarOperacionVulnerable(base).avisoUmbralMxn
  assert.equal(evaluarOperacionVulnerable({ ...base, montoMxn: threshold - 0.01 }).status, "identificacion")
  assert.equal(evaluarOperacionVulnerable({ ...base, montoMxn: threshold }).status, "aviso")
})

test("XI depends on the financial act, XVI has concurrent amount and service-fee triggers", () => {
  const base = { actividadKey: "fraccion-xi-c-cuentas", clienteKey: "cliente-1", fechaOperacion: "2026-09-26", montoMxn: 100 }
  assert.equal(evaluarOperacionVulnerable({ ...base, operacionFinancieraPorCuentaCliente: false }).status, "identificacion")
  assert.equal(evaluarOperacionVulnerable({ ...base, operacionFinancieraPorCuentaCliente: true }).status, "aviso")
  for (const key of ["fraccion-xvi-activos-virtuales", "fraccion-xvi-activos-virtuales-operacion", "fraccion-xvi-activos-virtuales-contraprestacion"]) {
    assert.equal(evaluarOperacionVulnerable({ ...base, actividadKey: key, contraprestacionCentavos: 46_924 }).status, "aviso")
    assert.equal(evaluarOperacionVulnerable({ ...base, actividadKey: key, contraprestacionCentavos: 46_923 }).status, "identificacion")
    assert.equal(evaluarOperacionVulnerable({ ...base, actividadKey: key, montoMxn: 24_635.10 }).status, "aviso")
  }
})

test("notarial notice compares all applicable valuations; unknown transfer amounts remain reportable", () => {
  assert.equal(resolveNotarialNoticeBase({ precioPactadoCentavos: 100, valorCatastralCentavos: 200, valorComercialCentavos: 300, principalGarantizadoCentavos: 400 }), 400)
  const base = { actividadKey: "fraccion-xii-notarios-a", clienteKey: "cliente-1", fechaOperacion: "2026-09-26", montoMxn: 100 }
  assert.equal(evaluarOperacionVulnerable({ ...base, montoBaseAvisoCentavos: 93_848_000 }).status, "aviso")
  assert.equal(evaluarOperacionVulnerable({ ...base, actividadKey: "fraccion-x-traslado", montoNoDeterminado: true }).status, "aviso")
})
