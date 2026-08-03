import { classifyAvisoSalida, evaluarOperacionVulnerable } from "./operations"
import { generateSatOutputPackage } from "./sat-outputs"
import { resolveSatFormatoForActividad } from "./sat-formatos"
import { centsToMoney } from "./money"
import {
  evaluateEvidenceChecklist,
  getDocumentRequirementsForCliente,
} from "./evidence"
import type {
  EvidenceRequirementDecision,
  PldOperationalAuditEvent,
  PldOperationalCase,
  PldTenant,
  SatOutputKind,
  SatOutputStatus,
  SatXmlGenerationResult,
} from "./types"

export interface BuildPldOperationalCaseInput {
  tenant: PldTenant
  periodo: string
  actividadKey: string
  clienteId: string
  clienteNombre: string
  clienteRfc?: string
  tipoCliente: string
  fechaOperacion: string
  montoCentavos?: number
  montoMxn: number
  formaPago: string
  sospecha24h?: boolean
  supuesto27Bis?: boolean
  alertaCodigo?: string
  alertaDescripcion?: string
  suspicionNarrative?: string
  completedEvidence?: Record<string, boolean>
  evidenceJustifications?: Record<string, string>
  satTemplateId?: string
  satTemplateFile?: string
  satTemplateVariant?: string
  satFieldValues?: Record<string, string>
  satCellValues?: Record<string, string>
  satMissingRequiredFields?: string[]
  satWorkbookStatus?: "pendiente" | "borrador_bloqueado" | "listo"
  workbookValidationStatus?: "golden_fixture" | "strict_synthetic" | "pending"
  goldenFixtureId?: string
  satDemoScenarioId?: string
  actor?: string
}

export function buildPldOperationalCase(input: BuildPldOperationalCaseInput): PldOperationalCase {
  const montoCentavos = resolveCanonicalAmountCents(input.montoCentavos)
  const montoMxn = montoCentavos === undefined ? input.montoMxn : centsToMoney(montoCentavos)
  const formato = resolveSatFormatoForActividad(input.actividadKey)
  const obligation = evaluarOperacionVulnerable({
    actividadKey: input.actividadKey,
    clienteKey: input.clienteId,
    fechaOperacion: input.fechaOperacion,
    montoMxn,
  })
  const salida = classifyAvisoSalida({
    status: obligation.status,
    fechaOperacion: input.fechaOperacion,
    supuesto27Bis: input.supuesto27Bis,
    sospecha24h: input.sospecha24h,
  })
  const outputKind = normalizeSatOutputKind(salida.tipo)
  const evidenceStatus = evaluateOperationalEvidenceDecision({
    tipoCliente: input.tipoCliente,
    actividadKey: input.actividadKey,
    completed: input.completedEvidence,
    justifications: input.evidenceJustifications,
    outputKind,
    suspicionNarrative: input.suspicionNarrative,
  })
  const now = new Date().toISOString()
  const actor = input.actor || input.tenant.representanteCumplimiento.nombre || "Sistema PLD"
  const auditTrail: PldOperationalAuditEvent[] = [
    event("case_created", actor, `Caso operativo creado para ${input.clienteNombre}.`, now),
    event("evidence_reviewed", actor, `Evidencia evaluada: ${evidenceStatus.canClose ? "lista" : "pendiente"}.`, now),
    event("sat_output_classified", actor, `Salida SAT sugerida: ${salida.label}.`, now),
  ]

  return {
    id: `case-${input.periodo}-${input.actividadKey}-${input.clienteId}-${Date.now()}`,
    schemaVersion: 1,
    tenantId: input.tenant.id,
    tenantRfc: input.tenant.rfc,
    tenantName: input.tenant.razonSocial,
    periodo: input.periodo,
    actividadKey: input.actividadKey,
    satFormatoId: formato.id,
    satTemplateId: input.satTemplateId,
    satTemplateFile: input.satTemplateFile,
    satTemplateVariant: input.satTemplateVariant,
    satFieldValues: input.satFieldValues,
    satCellValues: input.satCellValues,
    satMissingRequiredFields: input.satMissingRequiredFields,
    satWorkbookStatus: input.satWorkbookStatus,
    workbookValidationStatus: input.workbookValidationStatus,
    goldenFixtureId: input.goldenFixtureId,
    satDemoScenarioId: input.satDemoScenarioId,
    clienteId: input.clienteId,
    clienteNombre: input.clienteNombre,
    clienteRfc: input.clienteRfc,
    tipoCliente: input.tipoCliente,
    fechaOperacion: input.fechaOperacion,
    montoCentavos,
    montoMxn,
    formaPago: input.formaPago,
    evidenceStatus,
    satOutputStatus: {
      kind: outputKind,
      label: salida.label,
      descripcion: salida.descripcion,
      fechaLimite: salida.fechaLimite,
      canClose: salida.canClose && evidenceStatus.canClose,
      warnings: salida.warnings,
    },
    alertaCodigo: input.alertaCodigo,
    alertaDescripcion: input.alertaDescripcion,
    suspicionNarrative: input.suspicionNarrative,
    auditTrail,
  }
}

function resolveCanonicalAmountCents(value: number | undefined) {
  if (value === undefined) return undefined
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("montoCentavos debe ser un entero seguro mayor o igual a cero.")
  }
  return value
}

export function evaluateOperationalEvidenceDecision(input: {
  tipoCliente: string
  actividadKey?: string
  completed?: Record<string, boolean>
  justifications?: Record<string, string>
  outputKind: SatOutputKind
  suspicionNarrative?: string
}): EvidenceRequirementDecision {
  const requirements = getDocumentRequirementsForCliente(input.tipoCliente, input.actividadKey)
  const evaluation = evaluateEvidenceChecklist({
    requirements,
    completed: input.completed,
    justifications: input.justifications,
  })
  const hasNarrative = Boolean(input.suspicionNarrative?.trim() && input.suspicionNarrative.trim().length >= 20)
  const isUrgent = input.outputKind === "aviso_24h"
  const canContinueForSatOutput = isUrgent && hasNarrative
  const closingBlockedReasons = evaluation.missingCritical.map(
    (requirement) => `${requirement.label}: falta evidencia crítica o justificación válida.`,
  )
  const recommendedActions = [
    ...evaluation.recommendedActions,
    ...(isUrgent
      ? [
          canContinueForSatOutput
            ? "Presentar aviso de 24 horas con narrativa, fuente de indicio y evidencia disponible; no esperar cierre documental."
            : "Para aviso de 24 horas, documentar narrativa de hechos o indicios antes de continuar.",
        ]
      : []),
  ]

  return {
    canSave: evaluation.canSave,
    canClose: evaluation.canClose,
    canContinueForSatOutput,
    missingCritical: evaluation.missingCritical,
    missingOptional: evaluation.missingOptional,
    acceptedJustifications: evaluation.justifications,
    closingBlockedReasons,
    recommendedActions,
    sourceNotes: evaluation.sourceNotes,
  }
}

export function generateSatXml(operationalCase: PldOperationalCase): SatXmlGenerationResult {
  const formato = resolveSatFormatoForActividad(operationalCase.actividadKey)
  const outputPackage = generateSatOutputPackage(operationalCase)

  return {
    valid: outputPackage.validation.status === "listo",
    errors: outputPackage.validation.errors.concat(outputPackage.validation.missingFields),
    warnings: [
      ...outputPackage.validation.warnings,
      "XML generado con layout oficial de apoyo; validar una muestra en SPPLD antes de operación productiva total.",
    ],
    xml: outputPackage.xml,
    fileName: outputPackage.xmlFileName,
    formatoId: formato.id,
    outputKind: outputPackage.outputKind,
    generatedAt: outputPackage.createdAt,
  }
}

function normalizeSatOutputKind(kind: string): SatOutputKind {
  if (kind === "informe_ceros" || kind === "informe_27_bis" || kind === "aviso_24h") return kind
  return "aviso_normal"
}

function event(action: PldOperationalAuditEvent["action"], actor: string, detail: string, at: string): PldOperationalAuditEvent {
  return {
    id: `${action}-${at}`,
    at,
    action,
    actor,
    detail,
  }
}
