import type {
  OperationalWizardStepDiagnostics,
  BlockingReasonsView,
  OperationalMonitoringStatus,
  OperationalMonitoringView,
  RegulatorySourceDisplay,
  SatOutputKind,
  SatOutputOverride,
  SatOutputOverrideRequest,
  SatOutputPackage,
  StepBlockingReason,
  WizardStepStatus,
} from "./types"

export interface BuildOperationalStepDiagnosticsInput {
  stepIndex: number
  hasActiveTenant: boolean
  hasUma: boolean
  hasActividad: boolean
  hasSatFormato: boolean
  clienteNombre: string
  rfc: string
  tipoClienteRequiresDetalle?: boolean
  detalleTipoCliente?: string
  tipoOperacion: string
  montoOperacion: string
  sospecha24h: boolean
  esActividadInmuebles: boolean
  satWorkbookStatus: "pendiente" | "borrador_bloqueado" | "listo"
  satMissingRequiredFields: string[]
  evidenceCanSave: boolean
  evidenceCanClose: boolean
  evidenceMissingCriticalLabels: string[]
  alertaNarrativa: string
  hasEvaluacion: boolean
}

export interface SatPackageActionView {
  id: "official-template" | "filled-workbook" | "xml" | "capture-sheet" | "missing-fields"
  label: string
  enabled: boolean
  emphasis: "primary" | "secondary" | "quiet"
  reason?: string
}

export function buildRegulatorySourceDisplay(input: {
  primarySource: string
  rationale?: string
  warning?: string
  sourceUrl?: string
}): RegulatorySourceDisplay {
  const warning = input.warning?.trim() ?? ""
  const urls = extractUrls([input.sourceUrl, warning].filter(Boolean).join(" "))
  const visibleWarning = compactRegulatoryText(warning)
  const chips: RegulatorySourceDisplay["chips"] = [
    {
      id: normalizeChipId(input.primarySource || "fuente"),
      label: input.primarySource || "Fuente normativa",
      detail: input.rationale || input.primarySource || "Fuente normativa",
      sourceUrl: input.sourceUrl,
      tone: warning ? "warning" : "neutral",
    },
  ]

  if (/gu[ií]a sat/i.test(warning)) {
    chips.push({
      id: "guia-sat-2026",
      label: "Guía SAT 2026",
      detail: warning,
      sourceUrl: urls.find((url) => /GuiaAcumulacionPresentacionAvisos2026/i.test(url)) ?? urls[0],
      tone: "warning",
    })
  }

  return {
    summary: input.rationale?.trim() || input.primarySource || "Fuente normativa",
    visibleWarning,
    detail: [input.rationale, warning].filter(Boolean).join("\n"),
    chips: dedupeSourceChips(chips),
  }
}

export function buildBlockingReasonsView(input: {
  title?: string
  reasons: StepBlockingReason[]
}): BlockingReasonsView {
  const items = input.reasons.reduce<BlockingReasonsView["items"]>((acc, reason) => {
    if (acc.some((item) => item.id === reason.id || item.label === reason.label)) return acc
    acc.push({
      id: reason.id,
      label: reason.label,
      action: reason.description,
      severity: reason.severity,
      kind: reason.kind,
    })
    return acc
  }, [])

  return {
    title: input.title || "Qué falta para avanzar",
    subtitle: items.length
      ? "Completa estos puntos para habilitar el siguiente paso."
      : "Este paso está listo para continuar.",
    hasBlockers: items.length > 0,
    items,
  }
}

export function buildOperationalMonitoringView(input: {
  operations: Array<{
    id?: string
    umbralStatus: OperationalMonitoringStatus
    alerta?: string | null
    alertaResuelta?: boolean
  }>
}): OperationalMonitoringView {
  const lanes: OperationalMonitoringView["lanes"] = [
    {
      status: "aviso",
      label: "Aviso SAT",
      count: 0,
      tone: "danger",
      primaryAction: "Preparar salida SAT",
    },
    {
      status: "identificacion",
      label: "Identificación",
      count: 0,
      tone: "warning",
      primaryAction: "Completar EUI",
    },
    {
      status: "sin-obligacion",
      label: "Monitoreo",
      count: 0,
      tone: "success",
      primaryAction: "Mantener registro",
    },
  ]

  for (const operation of input.operations) {
    const lane = lanes.find((item) => item.status === operation.umbralStatus)
    if (lane) lane.count += 1
  }

  return {
    totalOperations: input.operations.length,
    activeAlerts: input.operations.filter((item) => item.alerta && !item.alertaResuelta).length,
    resolvedAlerts: input.operations.filter((item) => item.alerta && item.alertaResuelta).length,
    lanes,
  }
}

const OUTPUT_KIND_LABELS: Record<SatOutputKind, string> = {
  aviso_normal: "Aviso normal",
  informe_ceros: "Informe en ceros",
  informe_27_bis: "Informe 27 Bis",
  aviso_24h: "Aviso 24 horas",
}

export function buildOperationalStepDiagnostics(
  input: BuildOperationalStepDiagnosticsInput,
): OperationalWizardStepDiagnostics {
  const reasons: StepBlockingReason[] = []
  const addReason = (reason: StepBlockingReason) => reasons.push(reason)

  if (input.stepIndex === 0) {
    if (!input.hasActiveTenant) {
      addReason(required("active-tenant", "Sujeto obligado activo", "Selecciona o carga el sujeto obligado que reporta."))
    }
    if (!input.hasUma) {
      addReason(required("uma", "UMA del periodo", "Selecciona un periodo con UMA vigente para calcular umbrales."))
    }
  }

  if (input.stepIndex === 1) {
    if (!input.hasActividad) {
      addReason(required("actividad", "Actividad vulnerable", "Selecciona la fracción y subactividad aplicable."))
    }
    if (!input.hasSatFormato) {
      addReason(required("sat-formato", "Formato SAT", "Resuelve el formato SAT oficial para la actividad seleccionada."))
    }
  }

  if (input.stepIndex === 2) {
    if (!input.clienteNombre.trim()) {
      addReason(required("cliente-nombre", "Nombre o razón social del cliente", "Captura o vincula el cliente desde el EUI."))
    }
    if (!input.rfc.trim()) {
      addReason(required("cliente-rfc", "RFC del cliente", "Captura el RFC o confirma que el expediente lo contiene."))
    }
    if (input.tipoClienteRequiresDetalle && !input.detalleTipoCliente?.trim()) {
      addReason(
        required("cliente-detalle", "Detalle del tipo de cliente", "Especifica giro, naturaleza o subtipo para evaluar evidencia."),
      )
    }
  }

  if (input.stepIndex === 4) {
    if (!input.tipoOperacion.trim()) {
      addReason(required("tipo-operacion", "Tipo de operación", "Selecciona o captura el tipo de acto u operación."))
    }
    if (!input.sospecha24h && !input.montoOperacion.trim()) {
      addReason(required("monto-operacion", "Monto de operación", "Captura el monto o activa aviso 24 horas si no hubo operación."))
    }
    if (input.esActividadInmuebles && !input.sospecha24h && input.satWorkbookStatus !== "listo") {
      const fields = input.satMissingRequiredFields.length
        ? input.satMissingRequiredFields.join(", ")
        : "campos obligatorios del XLSM"
      addReason({
        id: "sat-xlsm-fields",
        label: "Campos obligatorios del Excel SAT",
        description: `Completa los campos SAT pendientes: ${fields}.`,
        kind: "sat",
        severity: "required",
      })
    }
  }

  if (input.stepIndex === 5 && input.sospecha24h && input.alertaNarrativa.trim().length < 20) {
    addReason({
      id: "narrativa-24h",
      label: "Narrativa de aviso 24 horas",
      description: "Describe hechos, fuente del indicio, fecha de conocimiento y acción tomada.",
      kind: "narrative",
      severity: "required",
    })
  }

  if (input.stepIndex === 6 && !input.evidenceCanSave) {
    addReason({
      id: "evidencia-guardar",
      label: "Evidencia minima para guardar",
      description: "Revisa el checklist documental antes de continuar.",
      kind: "evidence",
      severity: "required",
    })
  }

  if (input.stepIndex === 7 && !input.hasEvaluacion) {
    addReason(required("evaluacion", "Evaluación de operación", "Completa monto, actividad y periodo para calcular salida SAT."))
  }

  const status = getStatus(reasons, input)
  return {
    status,
    canContinue: reasons.length === 0,
    reasons,
    alertTitle: reasons.length ? "Faltan datos para continuar" : "Paso listo",
    alertDescription: reasons.length
      ? reasons.map((reason) => reason.label).join(", ")
      : "Puedes avanzar al siguiente paso.",
  }
}

export function validateSatOutputOverride(input: {
  suggestedKind: SatOutputKind
  requestedKind: SatOutputKind
  reason: string
}) {
  const errors: string[] = []
  if (input.suggestedKind === input.requestedKind) {
    errors.push("La salida seleccionada ya es la sugerida por la plataforma.")
  }
  if (!input.reason.trim()) {
    errors.push("Captura el motivo de la corrección de salida SAT.")
  }
  return { valid: errors.length === 0, errors }
}

export function applySatOutputOverride<T extends SatOutputPackage>(
  satPackage: T,
  request: SatOutputOverrideRequest,
): T {
  const override: SatOutputOverride = {
    originalKind: satPackage.satOutputOverride?.originalKind ?? satPackage.outputKind,
    requestedKind: request.requestedKind,
    reason: request.reason.trim(),
    user: request.user || "Usuario local",
    at: request.at || new Date().toISOString(),
  }
  const nextKind = request.requestedKind
  const nextLabel = OUTPUT_KIND_LABELS[nextKind]

  return {
    ...satPackage,
    outputKind: nextKind,
    label: nextLabel,
    satOutputOverride: override,
    validation: {
      ...satPackage.validation,
      warnings: [
        ...(satPackage.validation?.warnings || []),
        `Salida SAT corregida manualmente de ${OUTPUT_KIND_LABELS[override.originalKind]} a ${nextLabel}.`,
      ],
    },
  }
}

export function buildSatPackageActionView(satPackage: SatOutputPackage): SatPackageActionView[] {
  const isReady = satPackage.validation.status === "listo"
  const hasWorkbookValues = Boolean(satPackage.satFieldValues)
  const missingCount = satPackage.validation.missingFields.length + (satPackage.satMissingRequiredFields?.length || 0)

  return [
    {
      id: "official-template",
      label: "Plantilla oficial",
      enabled: Boolean(satPackage.officialTemplateUrl),
      emphasis: "quiet",
      reason: satPackage.officialTemplateUrl ? undefined : "Sin URL oficial registrada.",
    },
    {
      id: "filled-workbook",
      label: "Excel SAT rellenado",
      enabled: isReady && hasWorkbookValues,
      emphasis: isReady && hasWorkbookValues ? "primary" : "secondary",
      reason: !hasWorkbookValues
        ? "Este paquete no tiene valores XLSM capturados."
        : !isReady
          ? "Completa los faltantes antes de descargar el Excel final."
          : undefined,
    },
    {
      id: "xml",
      label: isReady ? "XML SAT" : "XML borrador",
      enabled: true,
      emphasis: isReady ? "primary" : "secondary",
      reason: isReady ? undefined : "XML borrador no cargable hasta resolver faltantes.",
    },
    {
      id: "capture-sheet",
      label: "Ficha de captura",
      enabled: true,
      emphasis: "secondary",
    },
    {
      id: "missing-fields",
      label: missingCount ? `Ver ${missingCount} faltante(s)` : "Sin faltantes",
      enabled: true,
      emphasis: missingCount ? "primary" : "secondary",
    },
  ]
}

function required(id: string, label: string, description: string): StepBlockingReason {
  return {
    id,
    label,
    description,
    kind: "field",
    severity: "required",
  }
}

function getStatus(
  reasons: StepBlockingReason[],
  input: BuildOperationalStepDiagnosticsInput,
): WizardStepStatus {
  if (reasons.length > 0) return "blocked"
  if (input.stepIndex === 6 && !input.evidenceCanClose && input.evidenceMissingCriticalLabels.length > 0) {
    return "review"
  }
  return "complete"
}

function extractUrls(value: string): string[] {
  return Array.from(value.matchAll(/https?:\/\/[^\s)]+/g)).map((match) => match[0].replace(/[.,;]+$/, ""))
}

function compactRegulatoryText(value: string): string {
  return value
    .replace(/\((https?:\/\/[^\s)]+)\)/g, "")
    .replace(/https?:\/\/[^\s)]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function normalizeChipId(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function dedupeSourceChips(chips: RegulatorySourceDisplay["chips"]) {
  return chips.filter((chip, index, array) => array.findIndex((item) => item.id === chip.id) === index)
}
