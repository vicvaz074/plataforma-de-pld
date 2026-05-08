import { matchPepCargo } from "./pep"
import type { EbrEvaluation, EbrFactorResult, PepScreeningInput } from "./types"

export interface EbrEvaluationInput {
  clienteKey: string
  clienteNombre: string
  tipoCliente?: string
  actividadKey?: string
  paisResidencia?: string
  formaPago?: string
  montoOperacionMxn?: number
  comportamiento?: "esperado" | "inusual" | "inconsistente"
  beneficiarioControladorIdentificado?: boolean
  listasRestrictivas?: "sin-coincidencia" | "posible-coincidencia" | "coincidencia"
  investigacionOSancion?: boolean
  pep?: PepScreeningInput
}

export function evaluateEbr(input: EbrEvaluationInput): EbrEvaluation {
  const pepScreening = input.pep ? matchPepCargo(input.pep) : undefined
  const factors: EbrFactorResult[] = [
    scoreFactor("Cliente", scoreTipoCliente(input.tipoCliente), input.tipoCliente || "Sin clasificar"),
    scoreFactor("Geografia", scoreGeografia(input.paisResidencia), input.paisResidencia || "Sin pais"),
    scoreFactor("Forma de pago", scoreFormaPago(input.formaPago), input.formaPago || "No indicada"),
    scoreFactor("Comportamiento", scoreComportamiento(input.comportamiento), input.comportamiento || "Sin validar"),
    scoreFactor(
      "Beneficiario controlador",
      input.beneficiarioControladorIdentificado === false ? 4 : 1,
      input.beneficiarioControladorIdentificado === false ? "No identificado" : "Identificado o no aplicable",
    ),
    scoreFactor("Listas", scoreListas(input.listasRestrictivas), input.listasRestrictivas || "No consultado"),
    scoreFactor("PEP", pepScreening?.status === "coincidencia-cargo" ? 4 : pepScreening?.status === "posible-pep" ? 3 : 1, pepScreening?.status || "No declarado"),
  ]

  if (input.investigacionOSancion) {
    factors.push(scoreFactor("Investigacion o sancion", 4, "Declarada o detectada"))
  }

  const score = Math.round((factors.reduce((sum, factor) => sum + factor.score, 0) / (factors.length * 4)) * 100)
  const riskLevel = score >= 80 || factors.some((factor) => factor.score === 4 && ["PEP", "Listas"].includes(factor.factor))
    ? "Reforzado"
    : score >= 62
      ? "Alto"
      : score >= 38
        ? "Medio"
        : "Bajo"

  return {
    id: `ebr-${input.clienteKey}-${Date.now()}`,
    clienteKey: input.clienteKey,
    clienteNombre: input.clienteNombre,
    evaluatedAt: new Date().toISOString(),
    score,
    riskLevel,
    factors,
    pepScreening,
    recommendedActions: buildRecommendedActions(riskLevel, pepScreening?.status),
  }
}

function scoreFactor(factor: string, score: number, label: string): EbrFactorResult {
  return {
    factor,
    score,
    label,
    rationale: score >= 4 ? "Requiere debida diligencia reforzada." : score >= 3 ? "Requiere documentacion complementaria." : "Riesgo ordinario documentable.",
  }
}

function scoreTipoCliente(value?: string): number {
  if (!value) return 2
  if (/fideicomiso|extranjera|estructura/i.test(value)) return 3
  if (/publico|gobierno/i.test(value)) return 3
  return 1
}

function scoreGeografia(value?: string): number {
  if (!value) return 2
  if (/mexico|méxico|mx/i.test(value)) return 1
  if (/alto riesgo|sancion|paraíso|paraiso/i.test(value)) return 4
  return 3
}

function scoreFormaPago(value?: string): number {
  if (!value) return 2
  if (/efectivo|activo virtual|cripto/i.test(value)) return 4
  if (/tercero|internacional/i.test(value)) return 3
  return 1
}

function scoreComportamiento(value?: EbrEvaluationInput["comportamiento"]): number {
  if (value === "inconsistente") return 4
  if (value === "inusual") return 3
  if (value === "esperado") return 1
  return 2
}

function scoreListas(value?: EbrEvaluationInput["listasRestrictivas"]): number {
  if (value === "coincidencia") return 4
  if (value === "posible-coincidencia") return 3
  if (value === "sin-coincidencia") return 1
  return 2
}

function buildRecommendedActions(riskLevel: EbrEvaluation["riskLevel"], pepStatus?: string): string[] {
  const actions = ["Conservar cuestionario EBR y evidencia consultada en el expediente."]

  if (riskLevel === "Alto" || riskLevel === "Reforzado") {
    actions.push("Aplicar debida diligencia reforzada y aprobacion del responsable de cumplimiento.")
    actions.push("Aumentar frecuencia de monitoreo transaccional y actualizacion documental.")
  }

  if (pepStatus === "coincidencia-cargo" || pepStatus === "posible-pep") {
    actions.push("Documentar declaracion PEP, cargo, dependencia, relacion y criterio de revision humana.")
  }

  return actions
}
