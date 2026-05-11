export type UmbralStatus = "sin-obligacion" | "identificacion" | "aviso"
export type AvisoSalidaTipo = "aviso_normal" | "informe_ceros" | "informe_27_bis" | "aviso_24h" | "sin_salida"
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
export type PepEntitySource = "shcp-uif-cargos" | "cnbv" | "opensanctions" | "public-mx" | "internal"
export type PepWhoIsStatus = "coincidencia_alta" | "posible_coincidencia" | "sin_coincidencia" | "requiere_revision"
export type PepAmbito = "federal" | "estatal" | "municipal" | "partido" | "autonomo" | "paraestatal" | "desconocido"
export type PepPoder = "ejecutivo" | "legislativo" | "judicial" | "autonomo" | "partido" | "paraestatal" | "desconocido"
export type PepResolutionStatus = "resolved" | "possible" | "unresolved" | "conflict" | "stale"
export type PepSourceType =
  | "official-csv"
  | "official-pdf"
  | "official-directory"
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
