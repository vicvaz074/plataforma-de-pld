import { findActividadByKey } from "./actividades"
import type {
  EbrControlEffectiveness,
  EbrControlMitigant,
  EbrMethodologyEvaluation,
  EbrMethodologyFactorKey,
  EbrMethodologyInput,
  EbrRiskLevel,
} from "./types"

const WEIGHTS: EbrMethodologyEvaluation["weights"] = {
  clientesUsuarios: 0.3,
  productosServicios: 0.3,
  canalesTransacciones: 0.2,
  geografia: 0.2,
}

const CONTROL_LABELS: Record<string, string> = {
  gobiernoCorporativo: "Gobierno corporativo",
  representanteCumplimiento: "Representante encargado de cumplimiento",
  manualPld: "Manual de PLD",
  capacitacion: "Programa de capacitación anual",
  monitoreoAutomatizado: "Mecanismos automatizados de monitoreo",
  auditoria: "Auditoría en materia de PLD",
  kyc: "Identificación y conocimiento del cliente",
  beneficiarioControlador: "Identificación de beneficiario controlador",
  resguardoDocumental: "Resguardo documental",
  presentacionAvisos: "Presentación oportuna de avisos",
}

export function evaluatePldEbrMethodology(input: EbrMethodologyInput): EbrMethodologyEvaluation {
  const factors = [
    buildFactor("clientesUsuarios", "Clientes y usuarios", [
      indicator("Tipo de persona", scoreTipoPersona(input.cliente.tipoPersona), input.cliente.tipoPersona || "No clasificado"),
      indicator(
        "Actividad económica",
        scoreActividadEconomica(input.cliente.actividadEconomica),
        input.cliente.actividadEconomica || "No documentada",
      ),
      indicator("PEP", scorePep(input.cliente.pepStatus), input.cliente.pepStatus || "No consultado"),
      indicator(
        "Beneficiario controlador",
        input.cliente.beneficiarioControladorIdentificado === false ? 3 : 1,
        input.cliente.beneficiarioControladorIdentificado === false ? "No identificado" : "Identificado o no aplicable",
      ),
      indicator("Listas", scoreListas(input.cliente.listasRestrictivas), input.cliente.listasRestrictivas || "No consultado"),
      indicator(
        "Congruencia transaccional",
        scoreCongruencia(input.cliente.congruenciaTransaccional),
        input.cliente.congruenciaTransaccional || "No evaluada",
      ),
    ]),
    buildFactor("productosServicios", "Productos y servicios", [
      indicator("Alto valor", input.productoServicio.altoValor ? 3 : 1, input.productoServicio.altoValor ? "Bien o servicio de alto valor" : "Valor ordinario"),
      indicator("Portabilidad", input.productoServicio.portabilidad ? 3 : 1, input.productoServicio.portabilidad ? "Portátil o almacena valor" : "Baja portabilidad"),
      indicator(
        "Transferibilidad",
        input.productoServicio.transferibilidad ? 3 : 1,
        input.productoServicio.transferibilidad ? "Transferible o revendible" : "Transferibilidad limitada",
      ),
      indicator("Anonimato", input.productoServicio.anonimato ? 3 : 1, input.productoServicio.anonimato ? "Puede facilitar anonimato" : "Identificación directa"),
      indicator("Efectivo", input.productoServicio.efectivo ? 3 : 1, input.productoServicio.efectivo ? "Uso de efectivo" : "Pago trazable"),
    ]),
    buildFactor("canalesTransacciones", "Canales y transacciones", [
      indicator("Canal", scoreCanal(input.canal.tipo), input.canal.tipo || "No documentado"),
      indicator("Intermediarios", input.canal.intermediario ? 3 : 1, input.canal.intermediario ? "Participan intermediarios" : "Relación directa"),
    ]),
    buildFactor("geografia", "Geografía y jurisdicciones", [
      indicator("Zona de riesgo", scoreZona(input.geografia.zonaRiesgo), input.geografia.zonaRiesgo || "No evaluada"),
      indicator("Frontera", input.geografia.frontera ? 3 : 1, input.geografia.frontera ? "Zona o flujo fronterizo" : "Sin componente fronterizo"),
    ]),
  ]

  const inherentScore = round2(
    factors.reduce((total, factor) => total + factor.score * WEIGHTS[factor.key], 0),
  )
  const controls = buildControls(input.controles)
  const reduction = controls.length
    ? controls.reduce((total, control) => total + control.reduction, 0) / controls.length
    : 0
  const residualScore = round2(Math.max(1, inherentScore - reduction))
  const actividad = findActividadByKey(input.actividadKey)
  const residualLevel = scoreToLevel(residualScore)
  const priority = residualLevel === "Alto" || residualLevel === "Medio-Alto" || inherentScore >= 2.35
    ? "Prioridad 1"
    : residualLevel === "Medio"
      ? "Prioridad 2"
      : "Prioridad 3"

  return {
    id: `ebr-metodologia-${input.actividadKey}-${Date.now()}`,
    actividadKey: input.actividadKey,
    evaluatedAt: new Date().toISOString(),
    weights: WEIGHTS,
    factors,
    controls,
    inherent: {
      score: inherentScore,
      level: scoreToLevel(inherentScore),
    },
    residual: {
      score: residualScore,
      level: residualLevel,
    },
    actionPlan: [
      {
        priority,
        action: buildActionPlanText(priority, actividad.nombre, residualLevel),
      },
    ],
  }
}

function indicator(label: string, score: number, rationale: string) {
  return {
    label,
    score,
    rationale,
  }
}

function buildFactor(
  key: EbrMethodologyFactorKey,
  label: string,
  indicators: Array<{ label: string; score: number; rationale: string }>,
) {
  const score = round2(indicators.reduce((total, item) => total + item.score, 0) / indicators.length)

  return {
    key,
    label,
    score,
    level: scoreToLevel(score),
    indicators,
  }
}

function scoreTipoPersona(value?: string) {
  if (!value) return 2
  if (/fideicomiso|extranjera|derecho_publico|estructura|moral/i.test(value)) return 2.5
  return 1.5
}

function scoreActividadEconomica(value?: string) {
  if (!value) return 2
  if (/efectivo|alto flujo|alto riesgo|informal|joya|veh[ií]culo|inmueble|activo virtual/i.test(value)) return 3
  return 2
}

function scorePep(value?: EbrMethodologyInput["cliente"]["pepStatus"]) {
  if (value === "coincidencia_alta" || value === "posible_coincidencia" || value === "requiere_revision") return 3
  if (value === "sin_coincidencia") return 1
  return 2
}

function scoreListas(value?: EbrMethodologyInput["cliente"]["listasRestrictivas"]) {
  if (value === "coincidencia") return 3
  if (value === "posible-coincidencia") return 2.5
  if (value === "sin-coincidencia") return 1
  return 2
}

function scoreCongruencia(value?: EbrMethodologyInput["cliente"]["congruenciaTransaccional"]) {
  if (value === "inconsistente") return 3
  if (value === "inusual") return 2.5
  if (value === "esperada") return 1
  return 2
}

function scoreCanal(value?: EbrMethodologyInput["canal"]["tipo"]) {
  if (value === "no_presencial") return 3
  if (value === "mixto") return 2
  if (value === "presencial") return 1
  return 2
}

function scoreZona(value?: EbrMethodologyInput["geografia"]["zonaRiesgo"]) {
  if (value === "alta_incidencia" || value === "fronteriza") return 3
  if (value === "turistica_alto_valor") return 2
  if (value === "ordinaria") return 1
  return 2
}

function buildControls(controles: Record<string, EbrControlEffectiveness>): EbrControlMitigant[] {
  return Object.entries(CONTROL_LABELS).map(([key, label]) => {
    const effectiveness = controles[key] ?? "baja"

    return {
      key,
      label,
      effectiveness,
      reduction: reductionFor(effectiveness),
    }
  })
}

function reductionFor(value: EbrControlEffectiveness) {
  if (value === "alta") return 1
  if (value === "media") return 0.5
  return 0
}

function scoreToLevel(score: number): EbrRiskLevel {
  if (score >= 2.35) return "Alto"
  if (score >= 2.1) return "Medio-Alto"
  if (score >= 1.6) return "Medio"
  return "Bajo"
}

function buildActionPlanText(priority: "Prioridad 1" | "Prioridad 2" | "Prioridad 3", actividad: string, level: EbrRiskLevel) {
  if (priority === "Prioridad 1") {
    return `Aplicar debida diligencia reforzada, monitoreo intensificado y validación del responsable de cumplimiento para ${actividad}. Riesgo residual: ${level}.`
  }

  if (priority === "Prioridad 2") {
    return `Mantener expediente actualizado, monitoreo periódico y revisión de señales de alerta para ${actividad}. Riesgo residual: ${level}.`
  }

  return `Conservar evidencia ordinaria y reevaluar cuando cambie el perfil del cliente u operación para ${actividad}. Riesgo residual: ${level}.`
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}
