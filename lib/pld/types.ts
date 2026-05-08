export type UmbralStatus = "sin-obligacion" | "identificacion" | "aviso"

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
    ventanaInicio: string
    ventanaFin: string
    montoAcumuladoMxn: number
    operacionesConsideradas: OperacionVulnerable[]
  }
  obligaciones: string[]
  alertas: string[]
}

export interface PepCargo {
  tipoAdministracionPublica: string
  entidadAdministracionPublica: string
  dependencia: string
  cargo: string
}

export interface PepScreeningInput {
  nombre?: string
  cargo?: string
  dependencia?: string
  entidad?: string
  relacion?: "cliente" | "beneficiario-controlador" | "representante" | "familiar" | "socio" | "otro"
}

export interface PepScreeningResult {
  status: "coincidencia-cargo" | "posible-pep" | "sin-coincidencia" | "requiere-datos"
  requiresHumanReview: boolean
  matches: PepCargo[]
  source: string
  checkedAt: string
  note: string
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
