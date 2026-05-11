import { findActividadByKey } from "./actividades"
import { calcularFechaLimiteAvisoOrdinario, subtractMonths } from "./dates"
import { getUmaForDate, mxnToUma, roundMoney, umaToMxn } from "./uma"
import type { AcumulacionRule, AvisoSalidaResult, OperacionObligacionResult, OperacionVulnerable, UmbralStatus } from "./types"

const MONEY_TOLERANCE = 0.01
const RCG_URL =
  "https://wwwnp.sat.gob.mx/minisitio/ActividadesVulnerables/documentos/Normateca/Nacional/LFPIORPI/RCG.pdf"
const GUIA_SAT_ACUMULACION_URL =
  "https://www.sat.gob.mx/minisitio/ActividadesVulnerables/documentos/GuiaAcumulacionPresentacionAvisos2026.pdf"

const RCG_ACCUMULATION_KEYS = new Set([
  "fraccion-i-juegos",
  "fraccion-ii-tarjetas-servicios",
  "fraccion-ii-instrumentos-valor",
  "fraccion-iii-cheques",
  "fraccion-iv-prestamos",
  "fraccion-v-inmuebles",
  "fraccion-vi-metales",
  "fraccion-vii-arte",
  "fraccion-viii-vehiculos",
  "fraccion-ix-blindaje",
  "fraccion-x-traslado",
  "fraccion-xii-notarios-a",
  "fraccion-xii-notarios-c",
  "fraccion-xii-notarios-d",
  "fraccion-xiii-donativos",
  "fraccion-xv-uso-goce",
])

const RCG_NON_ACCUMULATION_RATIONALE: Record<string, string> = {
  "fraccion-ii-tarjetas-prepagadas": "RCG art. 19 excluye tarjetas prepagadas de la fraccion II.",
  "fraccion-v-bis-desarrollo":
    "RCG art. 19 no lista V Bis; la guia SAT 2026 difiere y debe revisarse por cumplimiento.",
  "fraccion-xi-a-inmuebles": "RCG art. 19 no lista fraccion XI para acumulacion semestral.",
  "fraccion-xi-b-administracion": "RCG art. 19 no lista fraccion XI para acumulacion semestral.",
  "fraccion-xi-c-cuentas": "RCG art. 19 no lista fraccion XI para acumulacion semestral.",
  "fraccion-xi-d-aportaciones": "RCG art. 19 no lista fraccion XI para acumulacion semestral.",
  "fraccion-xi-e-corporativo": "RCG art. 19 no lista fraccion XI para acumulacion semestral.",
  "fraccion-xii-notarios-b": "RCG art. 19 excluye apartado A incisos b) y e) de fraccion XII.",
  "fraccion-xii-notarios-e": "RCG art. 19 excluye apartado A incisos b) y e) de fraccion XII.",
  "fraccion-xii-corredores-a": "RCG art. 19 excluye todos los incisos del Apartado B de fraccion XII.",
  "fraccion-xii-corredores-b": "RCG art. 19 excluye todos los incisos del Apartado B de fraccion XII.",
  "fraccion-xii-corredores-c": "RCG art. 19 excluye todos los incisos del Apartado B de fraccion XII.",
  "fraccion-xii-corredores-d": "RCG art. 19 excluye todos los incisos del Apartado B de fraccion XII.",
  "fraccion-xiv-aduanal-a": "RCG art. 19 no lista fraccion XIV; el art. 17 la trata como aviso por su naturaleza.",
  "fraccion-xiv-aduanal-b": "RCG art. 19 no lista fraccion XIV; el art. 17 la trata como aviso por su naturaleza.",
  "fraccion-xiv-aduanal-c": "RCG art. 19 no lista fraccion XIV; el art. 17 la trata como aviso por su naturaleza.",
  "fraccion-xiv-aduanal-d": "RCG art. 19 no lista fraccion XIV; el art. 17 la trata como aviso por su naturaleza.",
  "fraccion-xiv-aduanal-e": "RCG art. 19 no lista fraccion XIV; el art. 17 la trata como aviso por su naturaleza.",
  "fraccion-xiv-aduanal-f": "RCG art. 19 no lista fraccion XIV; el art. 17 la trata como aviso por su naturaleza.",
  "fraccion-xvi-activos-virtuales": "RCG art. 19 no lista fraccion XVI; la guia SAT 2026 difiere.",
  "fraccion-xvi-activos-virtuales-operacion": "RCG art. 19 no lista fraccion XVI; la guia SAT 2026 difiere.",
  "fraccion-xvi-activos-virtuales-contraprestacion": "RCG art. 19 no lista fraccion XVI; la guia SAT 2026 difiere.",
}

export interface EvaluarOperacionInput {
  actividadKey: string
  clienteKey: string
  fechaOperacion: string
  montoMxn: number
  operacionesHistoricas?: OperacionVulnerable[]
}

export function getAcumulacionRuleForActividad(actividadKey: string): AcumulacionRule {
  const actividad = findActividadByKey(actividadKey)

  if (RCG_ACCUMULATION_KEYS.has(actividad.key)) {
    return {
      applies: true,
      mode: actividad.identificacionUmbralUma > 0 ? "umbral-identificacion" : "todas-las-operaciones",
      source: "Reglas de Caracter General art. 19",
      sourceUrl: RCG_URL,
      rationale:
        actividad.identificacionUmbralUma > 0
          ? "Acumula actos u operaciones por cliente cuando alcanzan umbral de identificacion y no rebasan individualmente el aviso."
          : "Acumula todas las operaciones por cliente debajo del umbral individual de aviso durante seis meses.",
      warning:
        actividad.key === "fraccion-i-juegos"
          ? "La fraccion I si acumula conforme RCG art. 19; no usar la nota operativa de no acumulacion."
          : undefined,
    }
  }

  return {
    applies: false,
    mode: "no-acumula",
    source: "Reglas de Caracter General art. 19",
    sourceUrl: RCG_URL,
    rationale:
      RCG_NON_ACCUMULATION_RATIONALE[actividad.key] ??
      "La actividad no esta listada expresamente en RCG art. 19 para acumulacion semestral.",
    warning:
      actividad.key.includes("fraccion-v-bis") || actividad.key.startsWith("fraccion-xi-") || actividad.key.startsWith("fraccion-xvi")
        ? `La guia SAT de acumulacion 2026 (${GUIA_SAT_ACUMULACION_URL}) difiere en algunas fracciones; este sistema usa RCG art. 19 como criterio operativo.`
        : undefined,
  }
}

export function evaluarOperacionVulnerable(input: EvaluarOperacionInput): OperacionObligacionResult {
  const actividad = findActividadByKey(input.actividadKey)
  const uma = getUmaForDate(input.fechaOperacion)
  const identificacionUmbralMxn = umaToMxn(actividad.identificacionUmbralUma, uma)
  const avisoUmbralMxn = umaToMxn(actividad.avisoUmbralUma, uma)
  const acumulacionRule = getAcumulacionRuleForActividad(input.actividadKey)
  const currentOperation: OperacionVulnerable = {
    id: "operacion-actual",
    actividadKey: input.actividadKey,
    clienteKey: input.clienteKey,
    fechaOperacion: input.fechaOperacion,
    montoMxn: input.montoMxn,
  }

  const ventanaInicio = subtractMonths(input.fechaOperacion, 6)
  const ventanaFin = input.fechaOperacion.slice(0, 10)
  const candidates = acumulacionRule.applies
    ? [...(input.operacionesHistoricas ?? []), currentOperation]
        .filter((operation) => operation.actividadKey === input.actividadKey)
        .filter((operation) => operation.clienteKey === input.clienteKey)
        .filter((operation) => operation.fechaOperacion.slice(0, 10) >= ventanaInicio)
        .filter((operation) => operation.fechaOperacion.slice(0, 10) <= ventanaFin)
        .filter((operation) => shouldAccumulate(operation, acumulacionRule, actividad.identificacionUmbralUma, identificacionUmbralMxn, avisoUmbralMxn))
        .sort((a, b) => a.fechaOperacion.localeCompare(b.fechaOperacion))
    : [currentOperation]

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
      aplica: acumulacionRule.applies && candidates.length > 1,
      rule: acumulacionRule,
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
  rule: AcumulacionRule,
  identificacionUmbralUma: number,
  identificacionUmbralMxn: number,
  avisoUmbralMxn: number,
): boolean {
  if (!rule.applies) return false
  if (avisoUmbralMxn > 0 && operation.montoMxn + MONEY_TOLERANCE >= avisoUmbralMxn) {
    return false
  }

  if (rule.mode === "todas-las-operaciones" || identificacionUmbralUma === 0) {
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
      "Aplicar acumulacion semestral solo cuando la fraccion este listada en RCG art. 19.",
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

export function classifyAvisoSalida(input: {
  status?: UmbralStatus
  fechaOperacion?: string
  fechaConocimientoSospecha?: string
  periodoSinOperaciones?: boolean
  supuesto27Bis?: boolean
  sospecha24h?: boolean
  evidenceCanClose?: boolean
}): AvisoSalidaResult {
  const warnings: string[] = []
  const evidenceCanClose = input.evidenceCanClose ?? true

  if (input.sospecha24h) {
    if (!evidenceCanClose) {
      warnings.push("Falta evidencia critica; el aviso 24 horas no debe retrasarse, documentar justificacion.")
    }
    return {
      tipo: "aviso_24h",
      label: "Aviso de 24 horas",
      descripcion: "Se activa por indicios o sospecha, incluso si el acto u operacion no se celebro.",
      canClose: evidenceCanClose,
      warnings,
    }
  }

  if (input.periodoSinOperaciones) {
    return {
      tipo: "informe_ceros",
      label: "Informe en ceros",
      descripcion: "Periodo sin actos u operaciones objeto de aviso ni supuestos 27 Bis.",
      canClose: evidenceCanClose,
      warnings,
    }
  }

  if (input.supuesto27Bis) {
    return {
      tipo: "informe_27_bis",
      label: "Informe 27 Bis",
      descripcion: "Operacion exceptuada de aviso por supuesto de RCG art. 27 Bis; conservar soporte y reportar en el formato aplicable.",
      fechaLimite: input.fechaOperacion ? calcularFechaLimiteAvisoOrdinario(input.fechaOperacion) : undefined,
      canClose: evidenceCanClose,
      warnings,
    }
  }

  if (input.status === "aviso") {
    return {
      tipo: "aviso_normal",
      label: "Aviso normal",
      descripcion: "Operacion objeto de aviso ordinario al dia 17 del mes inmediato siguiente.",
      fechaLimite: input.fechaOperacion ? calcularFechaLimiteAvisoOrdinario(input.fechaOperacion) : undefined,
      canClose: evidenceCanClose,
      warnings,
    }
  }

  return {
    tipo: "sin_salida",
    label: "Sin aviso o informe",
    descripcion: "La operacion no activa salida regulatoria en este momento; conservar monitoreo y evidencia.",
    canClose: evidenceCanClose,
    warnings,
  }
}
