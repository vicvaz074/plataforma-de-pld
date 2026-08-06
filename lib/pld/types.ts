export type UmbralStatus = "sin-obligacion" | "identificacion" | "aviso"
export type AvisoSalidaTipo = "aviso_normal" | "informe_ceros" | "informe_27_bis" | "aviso_24h" | "sin_salida"
export type SatOutputKind = "aviso_normal" | "informe_ceros" | "informe_27_bis" | "aviso_24h"
export type DocumentRequirementCategory =
  | "identificacion"
  | "fiscal"
  | "domicilio"
  | "representacion"
  | "beneficiario-controlador"
  | "operacion"
  | "pep-ebr"

export interface DocumentRequirement {
  id: string
  label: string
  category: DocumentRequirementCategory
  critical: boolean
  appliesTo: string[]
  source: string
  requiresJustificationWhenMissing: boolean
  activityOverrides?: string[]
}

export interface EvidenceChecklistEvaluation {
  canSave: boolean
  canClose: boolean
  missingCritical: DocumentRequirement[]
  missingOptional: DocumentRequirement[]
  justifications: Array<{
    requirementId: string
    label: string
    justification: string
  }>
  sourceNotes: string[]
  recommendedActions: string[]
}

export interface OperacionEvidenceStatus {
  canSave: boolean
  canClose: boolean
  checklist: Record<string, boolean>
  missingCriticalCount: number
  missingOptionalCount: number
  sourceNotes: string[]
}

export interface AcumulacionRule {
  applies: boolean
  mode: "umbral-identificacion" | "todas-las-operaciones" | "no-acumula"
  source: string
  sourceUrl: string
  rationale: string
  warning?: string
}

export interface UmaValue {
  year: number
  vigenciaInicio: string
  vigenciaFin: string
  diario: number
  mensual: number
  anual: number
  source: string
}

export interface ActividadVulnerableCatalogItem {
  key: string
  fraccion: string
  inciso?: string
  nombre: string
  descripcion: string
  identificacionUmbralUma: number
  avisoUmbralUma: number
  avisoSiempre?: boolean
  acumulacion: "umbral-identificacion" | "todas-las-operaciones"
  fundamento: string
  sourceUrl: string
  lastVerified: string
  documentosBase: string[]
}

export interface OperacionVulnerable {
  id?: string
  actividadKey: string
  clienteKey: string
  fechaOperacion: string
  montoMxn: number
}

export interface OperacionObligacionResult {
  status: UmbralStatus
  actividad: ActividadVulnerableCatalogItem
  uma: UmaValue
  montoUma: number
  identificacionUmbralMxn: number
  avisoUmbralMxn: number
  fechaLimiteAviso?: string
  acumulacion: {
    aplica: boolean
    rule: AcumulacionRule
    ventanaInicio: string
    ventanaFin: string
    montoAcumuladoMxn: number
    operacionesConsideradas: OperacionVulnerable[]
  }
  obligaciones: string[]
  alertas: string[]
}

export interface AvisoSalidaResult {
  tipo: AvisoSalidaTipo
  label: string
  descripcion: string
  fechaLimite?: string
  canClose: boolean
  warnings: string[]
}

export interface PepCargo {
  tipoAdministracionPublica: string
  entidadAdministracionPublica: string
  dependencia: string
  cargo: string
}

export type PepRelacion = "cliente" | "beneficiario-controlador" | "representante" | "familiar" | "socio" | "otro"
export type PepEntitySource =
  | "shcp-uif-cargos"
  | "cnbv"
  | "opensanctions"
  | "public-mx"
  | "nomina-apf"
  | "legislativo-mx"
  | "gobernadores-mx"
  | "internal"
export type PepWhoIsStatus = "coincidencia_alta" | "posible_coincidencia" | "sin_coincidencia" | "requiere_revision"
export type PepAmbito = "federal" | "estatal" | "municipal" | "partido" | "autonomo" | "paraestatal" | "desconocido"
export type PepPoder = "ejecutivo" | "legislativo" | "judicial" | "autonomo" | "partido" | "paraestatal" | "desconocido"
export type PepResolutionStatus = "resolved" | "possible" | "unresolved" | "conflict" | "stale"
export type PepSourceType =
  | "official-csv"
  | "official-pdf"
  | "official-directory"
  | "official-payroll"
  | "official-web"
  | "opensanctions"
  | "manual-review"
  | "internal"

export interface PepCargoDefinition extends PepCargo {
  id: string
  ambito: PepAmbito
  poder: PepPoder
  nivel: "alto" | "medio" | "operativo" | "desconocido"
  normalizedCargo: string
  normalizedDependencia: string
  sourceIds: string[]
  sourceLabels: string[]
  sourceUrls: string[]
  lastVerified: string
  needsTitularResolution: boolean
  sourceNotes?: string[]
}

export interface PepSourceRecord {
  sourceId: string
  sourceLabel: string
  sourceUrl: string
  sourceType: PepSourceType
  lastSyncedAt: string
  maxAgeDays: number
  status: "active" | "stale" | "error" | "manual-review"
  license?: string
  notes?: string
}

export interface PepPersonRecord extends PepEntity {
  cargoIds: string[]
  resolutionStatus: PepResolutionStatus
  verifiedAt: string
  sourceIds: string[]
  confidence?: number
  evidenceUrl?: string
}

export interface PepCargoVerificationRecord {
  cargoId: string
  status: "verified_no_nominal_source" | "verified_obsolete" | "verified_collective" | "requires_external_source"
  category:
    | "collective"
    | "obsolete"
    | "state-local"
    | "judicial"
    | "party-candidate"
    | "autonomous"
    | "institutional-admin"
    | "source-gap"
  verifiedAt: string
  sourceIds: string[]
  note: string
}

export interface PepReviewQueueItem {
  id: string
  cargoId?: string
  personId?: string
  reason: "sin_titular_resuelto" | "fuente_vencida" | "conflicto_fuentes" | "posible_homonimo" | "requiere_evidencia"
  label: string
  priority: "alta" | "media" | "baja"
  sourceIds: string[]
  createdAt: string
  recommendation: string
}

export interface PepCoverageReport {
  generatedAt: string
  totalCargos: number
  cargosConTitular: number
  cargosSinTitular: number
  cargosVerificadosSinTitular: number
  cargosPendientesRevision: number
  personasResueltas: number
  staleSources: PepSourceRecord[]
  freshSources: PepSourceRecord[]
  reviewQueue: PepReviewQueueItem[]
  coverageByAmbito: Record<
    PepAmbito,
    {
      total: number
      resolved: number
      unresolved: number
    }
  >
  warnings: string[]
}

export interface PepPosition {
  cargo: string
  dependencia?: string
  desde?: string
  hasta?: string
}

export interface PepEntity {
  id: string
  name: string
  aliases?: string[]
  country?: string
  birthDate?: string
  positions?: PepPosition[]
  source: PepEntitySource
  sourceLabel: string
  sourceUrl: string
  dataset?: string
  lastSeen?: string
  topics?: string[]
}

export interface PepSourceSnapshot {
  sourceId: PepEntitySource | string
  sourceLabel: string
  sourceUrl: string
  syncedAt: string
  count: number
  license?: string
  entities: PepEntity[]
}

export interface PepReviewDecision {
  id: string
  decision: "confirmado_pep" | "falso_positivo" | "relacionado_pep" | "requiere_revision"
  subjectName: string
  normalizedSubjectName: string
  relation: PepRelacion
  evidence: string
  decidedBy: string
  decidedAt: string
  nextReviewAt?: string
  sourceEntityId?: string
  relatedPepName?: string
}

export interface PepInternalRecord extends PepReviewDecision {
  schemaVersion: 1
}

export interface PepScreeningInput {
  nombre?: string
  cargo?: string
  dependencia?: string
  entidad?: string
  relacion?: PepRelacion
}

export interface PepScreeningResult {
  status: "coincidencia-cargo" | "posible-pep" | "sin-coincidencia" | "requiere-datos"
  requiresHumanReview: boolean
  matches: PepCargo[]
  source: string
  checkedAt: string
  note: string
}

export interface PepSearchQuery {
  nombre?: string
  cargo?: string
  dependencia?: string
  fechaNacimiento?: string
  pais?: string
  relacion?: PepRelacion
}

export interface PepSearchResult {
  status: PepWhoIsStatus
  score: number
  entity: PepEntity
  source: PepEntitySource
  matchedFields: string[]
  requiresHumanReview: boolean
  note: string
  reviewDecision?: PepReviewDecision
}

export interface PepSearchResponse {
  status: PepWhoIsStatus
  checkedAt: string
  query: PepSearchQuery
  results: PepSearchResult[]
  appliedDecisions: PepReviewDecision[]
  sourceSnapshots: Array<{
    sourceId: string
    sourceLabel: string
    syncedAt?: string
    count: number
  }>
  recommendation: string
}

export interface EbrFactorResult {
  factor: string
  score: number
  label: string
  rationale: string
}

export interface EbrEvaluation {
  id: string
  clienteKey: string
  clienteNombre: string
  evaluatedAt: string
  score: number
  riskLevel: "Bajo" | "Medio" | "Alto" | "Reforzado"
  factors: EbrFactorResult[]
  pepScreening?: PepScreeningResult
  recommendedActions: string[]
}

export interface AuditReportInput {
  subjectName: string
  subjectRfc?: string
  periodLabel: string
  generatedAt: string
  auditorName?: string
  operations: OperacionVulnerable[]
  ebrEvaluations: EbrEvaluation[]
  findings: Array<{
    area: string
    status: "Cumple" | "Cumple parcialmente" | "No cumple" | "No evaluado"
    risk: "Bajo" | "Medio" | "Alto"
    observation: string
    recommendation: string
  }>
}

export interface TenantActividadVulnerableConfig {
  actividadKey: string
  altaSppldActiva: boolean
  fechaAlta?: string
  responsableOperativo?: string
  responsableCumplimiento?: string
  politicaInterna?: string
}

export interface PldTenant {
  id: string
  schemaVersion: 1
  rfc: string
  razonSocial: string
  nombreComercial?: string
  representanteCumplimiento: {
    nombre: string
    cargo?: string
    email?: string
  }
  responsablesInternos: Array<{
    area: string
    nombre: string
    funcion: string
  }>
  actividades: TenantActividadVulnerableConfig[]
  manual: {
    version: string
    vigenteDesde: string
    proximaRevision: string
  }
  ebr: {
    metodologiaVersion: string
    ultimaRevision: string
    proximaRevision: string
  }
  policies: {
    conservaAnios: number
    noGuardarEfirma: true
    requiereCotejo: boolean
  }
}

export interface PldTenantsState {
  schemaVersion: 1
  activeTenantId: string
  tenants: PldTenant[]
}

export interface SatFormatoManifestItem {
  id: string
  fraccion: string
  anexo: string
  actividadKeys: string[]
  nombre: string
  claveActividad: string
  xmlActivityCode: string
  xmlNamespace: string
  xmlSchemaLocation: string
  xmlLayoutId: string
  folletoUrl: string
  informeCerosUrl?: string
  avisoUrl?: string
  plantillaAvisoNombre?: string
  plantillaInformeNombre?: string
  officialXlsmName: string
  officialZipLastModified?: string
  officialZipSize?: number
  zeroReportZipLastModified?: string
  zeroReportZipSize?: number
  layoutStatus: "oficial_verificado" | "paquete_multiple" | "informe_por_pedimento" | "pendiente_validacion_sppld"
  layoutXmlTag: string
  outputModes: SatOutputKind[]
  satPageUrl: string
  sourceLastVerified: string
}

export interface SatFormatSnapshot {
  schemaVersion: 1
  source: string
  generatedAt: string
  items: SatFormatoManifestItem[]
}

export interface SatTemplateVariant {
  templateId: string
  variantId: string
  label: string
  actividadKeys: string[]
  officialXlsmName: string
  sourceZipUrl: string
  nestedZipName?: string
  localPath: string
  sourceNote?: string
}

export interface SatTemplateCatalogItem {
  templateId: string
  formatoId: string
  fraccion: string
  anexo: string
  actividadKeys: string[]
  nombre: string
  claveActividad: string
  officialXlsmName: string
  sourceZipUrl: string
  localPath: string
  outputModes: SatOutputKind[]
  variants: SatTemplateVariant[]
  requiresVariantSelection: boolean
  sourceLastVerified: string
}

export interface SatWorkbookCellExpectation {
  sheetName: string
  cell: string
  value?: string | number | boolean
  formattedValue?: string
  dataType?: string
  formula?: string
  numberFormat?: string
}

export interface SatWorkbookGoldenFixture {
  id: string
  label: string
  templateId: string
  fixtureFileName: string
  xmlFixtureFileName?: string
  source: string
}

export interface SatWorkbookComparisonResult {
  equivalent: boolean
  differences: string[]
}

export interface SatTemplateDemoScenario {
  id: string
  templateId: string
  actividadKey: string
  label: string
  periodo: string
  tenantRfc: string
  tenantName: string
  clienteNombre: string
  clienteRfc: string
  fechaOperacion: string
  montoMxn: number
  formaPago: string
  template: SatTemplateCatalogItem
  satFieldValues: Record<string, string>
  satCellValues?: Record<string, string>
  completedEvidence: Record<string, boolean>
  workbookValidationStatus: "golden_fixture" | "strict_synthetic"
  goldenFixtureId?: string
}

export interface SatXlsmOptionList {
  id: string
  label: string
  sourceSheet: string
  sourceRange: string
  options: string[]
}

export interface SatXlsmFieldCondition {
  fieldId: string
  /**
   * Values are compared by their SAT catalog code first (the segment before
   * `,` or `||`) and by their normalized full value as a fallback.
   */
  equals: string[]
}

export interface SatXlsmField {
  id: string
  label: string
  sheetName: string
  cell: string
  required: boolean
  dataType: "texto" | "numero" | "fecha" | "moneda" | "catalogo"
  optionListId?: string
  options?: string[]
  source: "xlsm-data-validation" | "xlsm-label" | "manual-sat-map"
  repeatGroup?: string
  repeatIndex?: number
  repeatLimit?: number
  sectionKind?:
    | "alta_sat"
    | "persona_objeto"
    | "beneficiario_controlador"
    | "acto_operacion"
    | "liquidacion"
    | "instrumento"
    | "contraparte"
    | "evidencia"
  conditionalGroup?: string
  activeWhen?: SatXlsmFieldCondition[]
  requiredWhen?: SatXlsmFieldCondition[]
  targetCell?: string
  readOnly?: boolean
  placeholder?: string
  /** Longitud máxima declarada por la validación de la plantilla oficial. */
  maxLength?: number
}

export interface SatXlsmOptionListCellBinding {
  sheetName: string
  cell: string
  optionListId?: string
  options: string[]
}

export interface SatRepeatGroup {
  id: string
  label: string
  sheetName: string
  startRow: number
  endRow: number
  rowCount: number
}

export interface SatConditionalGroup {
  id: string
  label: string
  selectorFieldId?: string
  activeWhen?: string[]
}

export interface SatCellValue {
  fieldId: string
  sheetName: string
  cell: string
  value: string
  optionListId?: string
}

export interface SatXlsmSection {
  id: string
  title: string
  sheetName: string
  sheetState: "visible" | "hidden" | "veryHidden"
  fields: SatXlsmField[]
}

export interface SatXlsmLayout {
  schemaVersion: 1
  templateId: string
  officialXlsmName: string
  generatedAt: string
  workbookHasMacros: boolean
  sections: SatXlsmSection[]
  optionLists: SatXlsmOptionList[]
  source: string
}

export interface SatFieldMapping {
  fieldId: string
  sheetName: string
  cell: string
  localSource?: string
}

export interface SatDynamicOperationForm {
  templateId: string
  templateFile: string
  templateVariant?: string
  sections: SatXlsmSection[]
  initialValues: Record<string, string>
  requiredFieldIds: string[]
  sourceLayoutGeneratedAt: string
}

export type SatTemplateQuestionnaire = SatDynamicOperationForm

export interface SatFilledWorkbookResult {
  status: "filled" | "blocked"
  workbook: Uint8Array
  fileName: string
  writtenCells: string[]
  missingRequiredFields: string[]
  warnings: string[]
}

export interface SatFieldDefinition {
  id: string
  label: string
  xmlTag: string
  required: boolean
  source: string
  dataType: "etiqueta" | "alfanumerico" | "numerico" | "fecha" | "moneda"
  pattern?: string
  maxLength?: number
}

export interface SatLayoutDefinition {
  id: string
  formatoId: string
  anexo: string
  outputKinds: SatOutputKind[]
  activityXmlTag: string
  requiredFields: SatFieldDefinition[]
  sourceUrl: string
  sourceLastVerified: string
}

export interface SatOutputValidation {
  status: "listo" | "borrador_bloqueado"
  missingFields: string[]
  errors: string[]
  warnings: string[]
}

export interface SatDownloadOption {
  id: string
  label: string
  kind: "official_template" | "filled_workbook" | "xml" | "capture_sheet" | "validation"
  fileName?: string
  url?: string
  mimeType?: string
  status: "available" | "blocked" | "external"
}

export interface SatOutputPackage {
  id: string
  schemaVersion: 1 | 2
  createdAt: string
  updatedAt?: string
  sourceOperationId?: string
  sourceOperationRevision?: number
  tenantId: string
  tenantRfc: string
  tenantName: string
  periodo: string
  formatoId: string
  actividadKey: string
  clienteNombre: string
  clienteRfc?: string
  outputKind: SatOutputKind
  label: string
  xml: string
  xmlFileName: string
  ficha: string
  fichaFileName: string
  officialTemplateUrl?: string
  officialTemplateName?: string
  satTemplateId?: string
  satTemplateFile?: string
  satTemplateVariant?: string
  satTemplateLocalPath?: string
  satFieldValues?: Record<string, string>
  satCellValues?: Record<string, string>
  satMissingRequiredFields?: string[]
  satWorkbookStatus?: "pendiente" | "borrador_bloqueado" | "listo"
  satWorkbookFileName?: string
  workbookValidationStatus?: "golden_fixture" | "strict_synthetic" | "pending"
  goldenFixtureId?: string
  satDemoScenarioId?: string
  satOutputOverride?: SatOutputOverride
  validation: SatOutputValidation
  downloads: SatDownloadOption[]
}

export type SatQueueItemKind = "sat_output" | "identification_only" | "internal_record"

export interface SatQueueItem {
  id: string
  source: "operation" | "unlinked_package"
  kind: SatQueueItemKind
  label: string
  description: string
  sourceOperationId?: string
  sourceOperationRevision?: number
  operationStatus?: UmbralStatus
  lifecycleStatus?: "active" | "cancelled"
  packageId?: string
  package?: SatOutputPackage
  actividadKey: string
  actividadNombre?: string
  clienteNombre: string
  clienteRfc?: string
  periodo: string
  fechaOperacion?: string
  montoCentavos?: number
  createdAt?: string
  updatedAt?: string
}

export type WizardStepStatus = "complete" | "missing" | "review" | "blocked"

export interface StepBlockingReason {
  id: string
  label: string
  description: string
  kind: "field" | "document" | "sat" | "evidence" | "narrative" | "operation"
  severity: "required" | "warning"
}

export interface OperationalWizardStepDiagnostics {
  status: WizardStepStatus
  canContinue: boolean
  reasons: StepBlockingReason[]
  alertTitle: string
  alertDescription: string
}

export interface SatOutputOverride {
  originalKind: SatOutputKind
  requestedKind: SatOutputKind
  reason: string
  user: string
  at: string
}

export interface SatOutputOverrideRequest {
  requestedKind: SatOutputKind
  reason: string
  user?: string
  at?: string
}

export interface InfoHintContent {
  id: string
  title: string
  summary: string
  body?: string[]
  sourceLabel?: string
  sourceUrl?: string
}

export interface RegulatorySourceChipDefinition {
  id: string
  label: string
  detail: string
  sourceUrl?: string
  tone: "neutral" | "success" | "warning"
}

export interface RegulatorySourceDisplay {
  summary: string
  visibleWarning: string
  detail: string
  chips: RegulatorySourceChipDefinition[]
}

export interface BlockingReasonsViewItem {
  id: string
  label: string
  action: string
  severity: StepBlockingReason["severity"]
  kind: StepBlockingReason["kind"]
}

export interface BlockingReasonsView {
  title: string
  subtitle: string
  hasBlockers: boolean
  items: BlockingReasonsViewItem[]
}

export type OperationalMonitoringStatus = "aviso" | "identificacion" | "sin-obligacion"

export interface OperationalMonitoringLane {
  status: OperationalMonitoringStatus
  label: string
  count: number
  tone: "danger" | "warning" | "success"
  primaryAction: string
}

export interface OperationalMonitoringView {
  totalOperations: number
  activeAlerts: number
  resolvedAlerts: number
  lanes: OperationalMonitoringLane[]
}

export interface PldSubjectRegistrationLink {
  sujetoObligadoId: string
  sujetoObligadoRfc: string
  sujetoObligadoNombre: string
  tenantId?: string
  tenantRfc?: string
  tenantName?: string
  actividadKeys: string[]
  foliosRegistro: string[]
  euiCount: number
  euiRfcs: string[]
  acuses: Array<{
    type: "detalle" | "acuse" | "aceptacion"
    name: string
    uploadedAt?: string
  }>
  status: "vinculado" | "sin_eui" | "sin_tenant"
}

export interface SatOutputStatus {
  kind: SatOutputKind
  label: string
  descripcion: string
  canClose: boolean
  fechaLimite?: string
  warnings: string[]
}

export interface EvidenceRequirementDecision {
  canSave: boolean
  canClose: boolean
  canContinueForSatOutput: boolean
  missingCritical: DocumentRequirement[]
  missingOptional: DocumentRequirement[]
  acceptedJustifications: EvidenceChecklistEvaluation["justifications"]
  closingBlockedReasons: string[]
  recommendedActions: string[]
  sourceNotes: string[]
}

export interface PldOperationalAuditEvent {
  id: string
  at: string
  action: "case_created" | "evidence_reviewed" | "ebr_evaluated" | "sat_output_classified" | "xml_generated"
  actor: string
  detail: string
}

export interface PldOperationalCase {
  id: string
  schemaVersion: 1
  tenantId: string
  tenantRfc: string
  tenantName: string
  periodo: string
  actividadKey: string
  satFormatoId: string
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
  clienteId: string
  clienteNombre: string
  clienteRfc?: string
  tipoCliente: string
  fechaOperacion: string
  /** Fuente canónica del monto cuando está disponible. */
  montoCentavos?: number
  /** Espejo numérico conservado para consumidores legacy y cálculos UMA. */
  montoMxn: number
  formaPago: string
  ebrId?: string
  evidenceStatus: EvidenceRequirementDecision
  satOutputStatus: SatOutputStatus
  xmlVersion?: string
  acuse?: {
    folio?: string
    fechaPresentacion?: string
    archivoNombre?: string
  }
  folio?: string
  alertaCodigo?: string
  alertaDescripcion?: string
  suspicionNarrative?: string
  auditTrail: PldOperationalAuditEvent[]
}

export interface SatXmlGenerationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  xml: string
  fileName: string
  formatoId: string
  outputKind: SatOutputKind
  generatedAt: string
}

export interface SatXmlValidationIssue {
  field: string
  message: string
  severity: "error" | "warning"
}

export interface SatXmlNodeDefinition {
  tag: string
  sourceField?: string
  required?: boolean
  transform?: "text" | "catalog_code" | "country_code" | "date_yyyymmdd" | "money"
  children?: SatXmlNodeDefinition[]
}

export interface SatXmlLayoutDefinition {
  id: string
  formatoId: string
  activityCode: string
  namespace: string
  schemaLocation: string
  rootTag: "archivo"
  avisoNode?: SatXmlNodeDefinition
}

export interface SatXmlCanonicalComparison {
  equivalent: boolean
  actualCanonical: string
  expectedCanonical: string
  diff: string
}

export type EbrControlEffectiveness = "alta" | "media" | "baja" | "no_aplica"
export type EbrRiskLevel = "Bajo" | "Medio" | "Medio-Alto" | "Alto"
export type EbrMethodologyFactorKey =
  | "clientesUsuarios"
  | "productosServicios"
  | "canalesTransacciones"
  | "geografia"

export interface EbrControlMitigant {
  key: string
  label: string
  effectiveness: EbrControlEffectiveness
  reduction: number
}

export interface EbrMethodologyInput {
  actividadKey: string
  cliente: {
    tipoPersona?: string
    actividadEconomica?: string
    pepStatus?: PepWhoIsStatus | "sin_coincidencia" | "no_consultado"
    beneficiarioControladorIdentificado?: boolean
    listasRestrictivas?: "sin-coincidencia" | "posible-coincidencia" | "coincidencia" | "no-consultado"
    congruenciaTransaccional?: "esperada" | "inusual" | "inconsistente" | "no_evaluada"
  }
  productoServicio: {
    altoValor?: boolean
    portabilidad?: boolean
    transferibilidad?: boolean
    anonimato?: boolean
    efectivo?: boolean
  }
  canal: {
    tipo?: "presencial" | "no_presencial" | "mixto"
    intermediario?: boolean
  }
  geografia: {
    zonaRiesgo?: "ordinaria" | "alta_incidencia" | "fronteriza" | "turistica_alto_valor" | "no_evaluada"
    frontera?: boolean
  }
  controles: Record<string, EbrControlEffectiveness>
}

export interface EbrMethodologyEvaluation {
  id: string
  actividadKey: string
  evaluatedAt: string
  weights: {
    clientesUsuarios: 0.3
    productosServicios: 0.3
    canalesTransacciones: 0.2
    geografia: 0.2
  }
  factors: Array<{
    key: EbrMethodologyFactorKey
    label: string
    score: number
    level: EbrRiskLevel
    indicators: Array<{
      label: string
      score: number
      rationale: string
    }>
  }>
  controls: EbrControlMitigant[]
  inherent: {
    score: number
    level: EbrRiskLevel
  }
  residual: {
    score: number
    level: EbrRiskLevel
  }
  actionPlan: Array<{
    priority: "Prioridad 1" | "Prioridad 2" | "Prioridad 3"
    action: string
  }>
}
