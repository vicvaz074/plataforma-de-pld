import type {
  OperationalWizardStepDiagnostics,
  BlockingReasonsView,
  OperationalMonitoringStatus,
  OperationalMonitoringView,
  RegulatorySourceDisplay,
  SatXlsmField,
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

export interface SatQuestionnaireFieldView {
  visibleFieldIds: string[]
  autoFilledFieldIds: string[]
  optionalHiddenFieldIds: string[]
  visibleRequiredMissingCount: number
  autoFilledCount: number
  optionalHiddenCount: number
}

export interface SatQuestionnaireDedupedFieldView {
  fields: SatXlsmField[]
  values: Record<string, string>
  missingRequiredIds: string[]
  duplicateFieldIdsByRepresentative: Record<string, string[]>
  duplicateHiddenCount: number
}

export const FIXED_SAT_TIPO_OPERACION_BY_TEMPLATE: Record<string, string> = {
  "sat-fraccion-v-inmuebles": "501,Compra Venta de Inmuebles",
  "sat-fraccion-v-bis-desarrollo": "1601,Aportación a Desarrollo(s) Inmobiliario(s)",
  "sat-fraccion-ix-blindaje": "901,Servicios de blindaje",
}

export function getFixedSatTipoOperacion(templateId: string | undefined): string | undefined {
  if (!templateId) return undefined
  return FIXED_SAT_TIPO_OPERACION_BY_TEMPLATE[templateId]
}

export function getSatCatalogValueCode(value: unknown): string {
  const normalized = String(value ?? "").trim()
  if (!normalized) return ""
  return (normalized.split("||")[0] ?? normalized).split(",")[0]?.trim().toLowerCase() ?? ""
}

function normalizeSatConditionalValue(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function matchesSatFieldConditions(
  conditions: SatXlsmField["activeWhen"] | SatXlsmField["requiredWhen"],
  values: Record<string, string>,
): boolean {
  if (!conditions?.length) return true

  return conditions.every((condition) => {
    const currentValue = values[condition.fieldId] ?? ""
    const currentCode = getSatCatalogValueCode(currentValue)
    const currentNormalized = normalizeSatConditionalValue(currentValue)

    return condition.equals.some((candidate) => {
      const candidateCode = getSatCatalogValueCode(candidate)
      const candidateNormalized = normalizeSatConditionalValue(candidate)
      return (
        (candidateCode && currentCode === candidateCode) ||
        (candidateNormalized && currentNormalized === candidateNormalized)
      )
    })
  })
}

export function isSatXlsmFieldActive(
  field: SatXlsmField,
  values: Record<string, string>,
): boolean {
  return matchesSatFieldConditions(field.activeWhen, values)
}

export function isSatXlsmFieldRequired(
  field: SatXlsmField,
  values: Record<string, string>,
): boolean {
  if (!isSatXlsmFieldActive(field, values)) return false
  if (field.requiredWhen?.length) return matchesSatFieldConditions(field.requiredWhen, values)
  return field.required
}

export function filterActiveSatXlsmFields(
  fields: SatXlsmField[],
  values: Record<string, string>,
): SatXlsmField[] {
  return fields.filter((field) => isSatXlsmFieldActive(field, values))
}

export function pruneInactiveSatFieldValues(input: {
  fields: SatXlsmField[]
  values: Record<string, string>
}): Record<string, string> {
  const fieldIds = new Set(input.fields.map((field) => field.id))
  const activeFieldIds = new Set(
    input.fields
      .filter((field) => isSatXlsmFieldActive(field, input.values))
      .map((field) => field.id),
  )

  return Object.fromEntries(
    Object.entries(input.values).filter(([fieldId]) => !fieldIds.has(fieldId) || activeFieldIds.has(fieldId)),
  )
}

export function chooseSatTipoOperacionField(fields: SatXlsmField[]): SatXlsmField | undefined {
  const candidates = fields.filter((field) => {
    const text = normalizeSatFieldText(`${field.id} ${field.label} ${field.optionListId ?? ""}`)
    return (
      field.id === "acto.tipo_operacion" ||
      /(^|-)tipo-(de-)?operacion($|-)/.test(text) ||
      /(^|-)tipoope($|-)|(^|-)tipooperacion($|-)/.test(text)
    )
  })

  return candidates.sort(compareTipoOperacionField)[0]
}

export function buildSatQuestionnaireFieldView(input: {
  fields: SatXlsmField[]
  values: Record<string, string>
  initialValues?: Record<string, string>
  missingRequiredIds: string[]
  showResolvedFields?: boolean
  showOptionalFields?: boolean
  editedFieldIds?: string[]
}): SatQuestionnaireFieldView {
  const missingSet = new Set(input.missingRequiredIds)
  const editedSet = new Set(input.editedFieldIds ?? [])
  const visibleFieldIds: string[] = []
  const autoFilledFieldIds: string[] = []
  const optionalHiddenFieldIds: string[] = []

  for (const field of input.fields.filter((item) => isSatXlsmFieldActive(item, input.values))) {
    const value = (input.values[field.id] ?? "").trim()
    const initialValue = (input.initialValues?.[field.id] ?? "").trim()
    const isMissing = missingSet.has(field.id)
    const isResolved = Boolean(value) && !isMissing
    const isEditedByUser = editedSet.has(field.id)
    const isAutoFilled = isResolved && !isEditedByUser && Boolean(initialValue) && value === initialValue
    const isEmptyOptional = !isSatXlsmFieldRequired(field, input.values) && !value

    if (isAutoFilled) autoFilledFieldIds.push(field.id)
    if (isEmptyOptional) optionalHiddenFieldIds.push(field.id)

    if (
      isMissing ||
      (isEmptyOptional && input.showOptionalFields) ||
      (isResolved && (input.showResolvedFields || !isAutoFilled))
    ) {
      visibleFieldIds.push(field.id)
    }
  }

  return {
    visibleFieldIds,
    autoFilledFieldIds,
    optionalHiddenFieldIds,
    visibleRequiredMissingCount: visibleFieldIds.filter((fieldId) => missingSet.has(fieldId)).length,
    autoFilledCount: autoFilledFieldIds.length,
    optionalHiddenCount: optionalHiddenFieldIds.length,
  }
}

function compareTipoOperacionField(a: SatXlsmField, b: SatXlsmField): number {
  const score = (field: SatXlsmField) =>
    ((field.options?.length ?? 0) > 0 ? 0 : 100) +
    (field.required ? 0 : 10) +
    (field.source === "xlsm-data-validation" ? 0 : field.source === "manual-sat-map" ? 6 : 4) +
    (field.id === "acto.tipo_operacion" ? 2 : 0)
  return score(a) - score(b) || compareSatFieldsForDisplay(a, b)
}

export function isSatFieldManagedByPrimaryCapture(field: SatXlsmField): boolean {
  const label = normalizeSatFieldText(`${field.id} ${field.label} ${field.optionListId ?? ""}`)
  const section = field.sectionKind ?? ""
  const isPersonSection =
    section === "persona_objeto" || section === "beneficiario_controlador" || section === "contraparte"
  const isIdentityOrEuiField =
    /nombre|apellido|denominacion|razon-social|rfc|curp|nacionalidad|pais|fecha-nacimiento|fecha-constitucion|actividad-economica|giro|domicilio|calle|avenida|via|numero-exterior|numero-interior|codigo-postal|colonia|municipio|alcaldia|entidad|ciudad|poblacion|telefono|correo|contacto|representante|apoderado/.test(
      label,
    )
  const isMoneyOrCurrencyField =
    field.dataType === "moneda" ||
    /monto|moneda|divisa|importe|valor|precio|contraprestacion|cantidad-pagada|pago-total/.test(label)
  const isOperationalDate =
    /fecha/.test(label) &&
    !/nacimiento|constitucion/.test(label) &&
    /operacion|pago|liquidacion|aportacion|prestamo|contrato|instrumento/.test(label)
  const isPaymentInstrument = /forma-de-pago|instrumento-monetario|medio-de-pago/.test(label)

  return (isPersonSection && isIdentityOrEuiField) || isMoneyOrCurrencyField || isOperationalDate || isPaymentInstrument
}

export function buildSatQuestionnaireDedupedFieldView(input: {
  fields: SatXlsmField[]
  values: Record<string, string>
  missingRequiredIds: string[]
}): SatQuestionnaireDedupedFieldView {
  const missingSet = new Set(input.missingRequiredIds)
  const buckets = new Map<string, SatXlsmField[]>()
  const passthroughFields: SatXlsmField[] = []

  for (const field of input.fields) {
    const key = getSatQuestionnaireDuplicateKey(field)
    if (!key) {
      passthroughFields.push(field)
      continue
    }
    const group = buckets.get(key) ?? []
    group.push(field)
    buckets.set(key, group)
  }

  const fields: SatXlsmField[] = [...passthroughFields]
  const values: Record<string, string> = {}
  const duplicateFieldIdsByRepresentative: Record<string, string[]> = {}
  const missingRequiredIds: string[] = []
  let duplicateHiddenCount = 0

  for (const field of passthroughFields) {
    values[field.id] = input.values[field.id] ?? ""
    if (missingSet.has(field.id)) missingRequiredIds.push(field.id)
  }

  for (const group of buckets.values()) {
    const representative = chooseSatFieldRepresentative(group)
    const duplicates = group.filter((field) => field.id !== representative.id)
    const representativeValue = getFirstFilledValue(group, input.values)
    const groupHasMissingRequired = group.some((field) => missingSet.has(field.id))

    fields.push(representative)
    values[representative.id] = representativeValue
    if (duplicates.length > 0) {
      duplicateHiddenCount += duplicates.length
      duplicateFieldIdsByRepresentative[representative.id] = duplicates.map((field) => field.id)
    }
    if (groupHasMissingRequired && !representativeValue.trim()) {
      missingRequiredIds.push(representative.id)
    }
  }

  return {
    fields: fields.sort(compareSatFieldsForDisplay),
    values,
    missingRequiredIds,
    duplicateFieldIdsByRepresentative,
    duplicateHiddenCount,
  }
}

export function expandSatFieldValuesForDuplicateFields(input: {
  fields: SatXlsmField[]
  values: Record<string, string>
}): Record<string, string> {
  const deduped = buildSatQuestionnaireDedupedFieldView({
    fields: input.fields.filter((field) => !isSatFieldManagedByPrimaryCapture(field)),
    values: input.values,
    missingRequiredIds: [],
  })
  const output = { ...input.values }

  for (const [representativeId, duplicateIds] of Object.entries(deduped.duplicateFieldIdsByRepresentative)) {
    const value = output[representativeId] ?? deduped.values[representativeId] ?? ""
    if (!value.trim()) continue
    for (const duplicateId of duplicateIds) {
      if (!output[duplicateId]?.trim()) output[duplicateId] = value
    }
  }

  return output
}

export function getActionableSatMissingFieldIds(input: {
  fields: SatXlsmField[]
  missingRequiredIds: string[]
  values?: Record<string, string>
}): string[] {
  const allFieldById = new Map(input.fields.map((field) => [field.id, field] as const))
  const activeFields = input.values
    ? input.fields.filter((field) => isSatXlsmFieldActive(field, input.values ?? {}))
    : input.fields
  const fieldById = new Map(activeFields.map((field) => [field.id, field] as const))
  const missingFields = input.missingRequiredIds
    .map((fieldId) => fieldById.get(fieldId))
    .filter((field): field is SatXlsmField => Boolean(field))
    .filter((field) => {
      if (!isSatFieldManagedByPrimaryCapture(field)) return true
      if (!input.values) return false
      return !(input.values[field.id] ?? "").trim()
    })
  const deduped = buildSatQuestionnaireDedupedFieldView({
    fields: missingFields,
    values: {},
    missingRequiredIds: missingFields.map((field) => field.id),
  })
  const knownIds = new Set(deduped.missingRequiredIds)
  const unknownIds = input.missingRequiredIds.filter((fieldId) => {
    return !allFieldById.has(fieldId)
  })

  return [...unknownIds, ...deduped.fields.map((field) => field.id).filter((fieldId) => knownIds.has(fieldId))]
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

function normalizeSatFieldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function getSatQuestionnaireDuplicateKey(field: SatXlsmField): string | null {
  if (field.repeatGroup) return null
  const label = normalizeSatFieldText(field.label)
  if (!label || label.length < 4) return null
  return `${field.sectionKind ?? "acto_operacion"}|${label}`
}

function chooseSatFieldRepresentative(fields: SatXlsmField[]): SatXlsmField {
  return [...fields].sort(compareSatFieldRepresentative)[0]
}

function compareSatFieldRepresentative(a: SatXlsmField, b: SatXlsmField): number {
  const score = (field: SatXlsmField) =>
    (field.source === "xlsm-label" ? 10 : 0) -
    ((field.options?.length ?? 0) > 0 ? 4 : 0) -
    (field.source === "manual-sat-map" ? 3 : 0) -
    (field.source === "xlsm-data-validation" ? 2 : 0)
  return score(a) - score(b) || compareSatFieldsForDisplay(a, b)
}

function compareSatFieldsForDisplay(a: SatXlsmField, b: SatXlsmField): number {
  const sheetCompare = a.sheetName.localeCompare(b.sheetName)
  if (sheetCompare !== 0) return sheetCompare
  return getCellRow(a.cell) - getCellRow(b.cell) || getCellColumn(a.cell).localeCompare(getCellColumn(b.cell))
}

function getFirstFilledValue(fields: SatXlsmField[], values: Record<string, string>): string {
  for (const field of fields) {
    const value = values[field.id]?.trim()
    if (value) return values[field.id]
  }
  return ""
}

function getCellRow(cell: string): number {
  return Number(cell.match(/\d+/)?.[0] ?? 0)
}

function getCellColumn(cell: string): string {
  return cell.match(/[A-Z]+/i)?.[0]?.toUpperCase() ?? ""
}
