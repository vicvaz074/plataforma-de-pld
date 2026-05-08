import { findActividadByKey } from "./actividades"
import { calcularFechaLimiteAvisoOrdinario, subtractMonths } from "./dates"
import { getUmaForDate, mxnToUma, roundMoney, umaToMxn } from "./uma"
import type { OperacionObligacionResult, OperacionVulnerable } from "./types"

const MONEY_TOLERANCE = 0.01

export interface EvaluarOperacionInput {
  actividadKey: string
  clienteKey: string
  fechaOperacion: string
  montoMxn: number
  operacionesHistoricas?: OperacionVulnerable[]
}

export function evaluarOperacionVulnerable(input: EvaluarOperacionInput): OperacionObligacionResult {
  const actividad = findActividadByKey(input.actividadKey)
  const uma = getUmaForDate(input.fechaOperacion)
  const identificacionUmbralMxn = umaToMxn(actividad.identificacionUmbralUma, uma)
  const avisoUmbralMxn = umaToMxn(actividad.avisoUmbralUma, uma)
  const currentOperation: OperacionVulnerable = {
    id: "operacion-actual",
    actividadKey: input.actividadKey,
    clienteKey: input.clienteKey,
    fechaOperacion: input.fechaOperacion,
    montoMxn: input.montoMxn,
  }

  const ventanaInicio = subtractMonths(input.fechaOperacion, 6)
  const ventanaFin = input.fechaOperacion.slice(0, 10)
  const candidates = [...(input.operacionesHistoricas ?? []), currentOperation]
    .filter((operation) => operation.actividadKey === input.actividadKey)
    .filter((operation) => operation.clienteKey === input.clienteKey)
    .filter((operation) => operation.fechaOperacion.slice(0, 10) >= ventanaInicio)
    .filter((operation) => operation.fechaOperacion.slice(0, 10) <= ventanaFin)
    .filter((operation) => shouldAccumulate(operation, actividad.identificacionUmbralUma, identificacionUmbralMxn))
    .sort((a, b) => a.fechaOperacion.localeCompare(b.fechaOperacion))

  const montoAcumuladoMxn = roundMoney(candidates.reduce((total, operation) => total + operation.montoMxn, 0))
  const currentMeetsIdentification =
    actividad.identificacionUmbralUma === 0 || input.montoMxn + MONEY_TOLERANCE >= identificacionUmbralMxn
  const currentMeetsNotice =
    actividad.avisoSiempre ||
    (actividad.avisoUmbralUma > 0 && input.montoMxn + MONEY_TOLERANCE >= avisoUmbralMxn) ||
    (actividad.avisoUmbralUma > 0 && montoAcumuladoMxn + MONEY_TOLERANCE >= avisoUmbralMxn)

  const status = currentMeetsNotice ? "aviso" : currentMeetsIdentification ? "identificacion" : "sin-obligacion"
  const obligaciones = buildObligaciones(status)
  const alertas = buildAlertas(status, actividad.avisoSiempre, montoAcumuladoMxn, avisoUmbralMxn)

  return {
    status,
    actividad,
    uma,
    montoUma: mxnToUma(input.montoMxn, uma),
    identificacionUmbralMxn,
    avisoUmbralMxn,
    fechaLimiteAviso: status === "aviso" ? calcularFechaLimiteAvisoOrdinario(input.fechaOperacion) : undefined,
    acumulacion: {
      aplica: candidates.length > 1,
      ventanaInicio,
      ventanaFin,
      montoAcumuladoMxn,
      operacionesConsideradas: candidates,
    },
    obligaciones,
    alertas,
  }
}

function shouldAccumulate(
  operation: OperacionVulnerable,
  identificacionUmbralUma: number,
  identificacionUmbralMxn: number,
): boolean {
  if (identificacionUmbralUma === 0) {
    return true
  }

  return operation.montoMxn + MONEY_TOLERANCE >= identificacionUmbralMxn
}

function buildObligaciones(status: OperacionObligacionResult["status"]): string[] {
  if (status === "aviso") {
    return [
      "Integrar expediente de identificacion y soporte del acto u operacion.",
      "Preparar aviso ordinario a mas tardar el dia 17 del mes inmediato siguiente.",
      "Conservar acuse, evidencia y trazabilidad de revision.",
    ]
  }

  if (status === "identificacion") {
    return [
      "Integrar expediente de identificacion del cliente o usuario.",
      "Documentar beneficiario controlador cuando corresponda.",
      "Acumular operaciones elegibles durante una ventana de hasta seis meses.",
    ]
  }

  return [
    "Conservar registro interno de la operacion.",
    "Mantener monitoreo por cliente, actividad y periodo.",
  ]
}

function buildAlertas(status: OperacionObligacionResult["status"], avisoSiempre = false, acumulado = 0, aviso = 0): string[] {
  const alerts: string[] = []

  if (avisoSiempre) {
    alerts.push("La fraccion seleccionada es objeto de aviso por su naturaleza conforme al articulo 17.")
  }

  if (status === "aviso" && acumulado >= aviso && aviso > 0) {
    alerts.push("La obligacion de aviso se activa por monto individual o acumulacion dentro de la ventana SAT.")
  }

  return alerts
}
