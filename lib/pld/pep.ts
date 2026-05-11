import type {
  PepCargo,
  PepEntity,
  PepInternalRecord,
  PepPersonRecord,
  PepReviewDecision,
  PepScreeningInput,
  PepScreeningResult,
  PepSearchQuery,
  PepSearchResponse,
  PepSearchResult,
  PepSourceSnapshot,
  PepWhoIsStatus,
} from "./types"
import { pepPersonRecordToEntity } from "./pep-data"

export const PEP_CARGOS_SOURCE =
  "SHCP/UIF cargos publicos politicamente expuestos: https://www.secciones.hacienda.gob.mx/work/models/SHCP/UIF/cargos_publicos_politicamente_expuestos.csv"
export const PEP_INTERNAL_STORAGE_KEY = "pld-pep-internal-records"
export const PEP_SEARCH_HISTORY_STORAGE_KEY = "pld-pep-search-history"
export const PEP_OPENSANCTIONS_SOURCE_URL = "https://www.opensanctions.org/"

export const pepCargoFixtures: PepCargo[] = [
  {
    tipoAdministracionPublica: "CENTRAL",
    entidadAdministracionPublica: "No aplica",
    dependencia: "SECRETARÍA DE COMUNICACIONES Y TRANSPORTES",
    cargo: "DIRECTOR GENERAL DEL INSTITUTO MEXICANO DEL TRANSPORTE",
  },
  {
    tipoAdministracionPublica: "CENTRAL",
    entidadAdministracionPublica: "No aplica",
    dependencia: "SECRETARÍA DE ECONOMÍA",
    cargo: "MIEMBROS DEL PLENO DE LA COMISIÓN FEDERAL DE COMPETENCIA",
  },
]

export interface SearchPepCatalogs {
  entities?: PepEntity[]
  personRecords?: PepPersonRecord[]
  snapshots?: PepSourceSnapshot[]
  cargos?: PepCargo[]
  internalRecords?: PepInternalRecord[]
}

export function matchPepCargo(input: PepScreeningInput, catalog: PepCargo[] = pepCargoFixtures): PepScreeningResult {
  const cargoNeedle = normalizeText(input.cargo)
  const dependenciaNeedle = normalizeText(input.dependencia)

  if (!cargoNeedle && !dependenciaNeedle) {
    return {
      status: "requiere-datos",
      requiresHumanReview: true,
      matches: [],
      source: PEP_CARGOS_SOURCE,
      checkedAt: new Date().toISOString(),
      note: "Captura cargo y dependencia para realizar validacion asistida contra el catalogo publico de cargos PEP.",
    }
  }

  const matches = catalog.filter((item) => {
    const cargoMatch = cargoNeedle ? normalizeText(item.cargo).includes(cargoNeedle) || cargoNeedle.includes(normalizeText(item.cargo)) : true
    const dependenciaMatch = dependenciaNeedle
      ? normalizeText(item.dependencia).includes(dependenciaNeedle) || dependenciaNeedle.includes(normalizeText(item.dependencia))
      : true

    return cargoMatch && dependenciaMatch
  })

  if (matches.length > 0) {
    return {
      status: "coincidencia-cargo",
      requiresHumanReview: true,
      matches,
      source: PEP_CARGOS_SOURCE,
      checkedAt: new Date().toISOString(),
      note:
        "Coincidencia con cargo publico considerado PEP. No equivale a validacion nominativa; requiere evidencia, declaracion del cliente y revision humana.",
    }
  }

  const possibleMatches = catalog.filter((item) => {
    const normalizedCargo = normalizeText(item.cargo)
    const normalizedDependency = normalizeText(item.dependencia)
    const tokenMatch = cargoNeedle
      .split(" ")
      .filter((token) => token.length > 4)
      .some((token) => normalizedCargo.includes(token))

    return tokenMatch || (dependenciaNeedle.length > 0 && normalizedDependency.includes(dependenciaNeedle))
  })

  return {
    status: possibleMatches.length > 0 ? "posible-pep" : "sin-coincidencia",
    requiresHumanReview: possibleMatches.length > 0,
    matches: possibleMatches.slice(0, 10),
    source: PEP_CARGOS_SOURCE,
    checkedAt: new Date().toISOString(),
    note:
      possibleMatches.length > 0
        ? "Existen coincidencias parciales; documentar criterio de descarte o confirmacion."
        : "Sin coincidencia en el catalogo publico de cargos. Esto no descarta una consulta formal UIF cuando sea aplicable.",
  }
}

export function searchPep(query: PepSearchQuery, catalogs: SearchPepCatalogs = {}, checkedAt = new Date().toISOString()): PepSearchResponse {
  const normalizedQueryName = normalizeName(query.nombre)
  const normalizedCargo = normalizeText(query.cargo)
  const normalizedDependency = normalizeText(query.dependencia)
  const snapshotEntities = catalogs.personRecords?.length || catalogs.entities?.length ? [] : catalogs.snapshots?.flatMap((snapshot) => snapshot.entities) ?? []
  const entities = [
    ...(catalogs.personRecords?.map((record) => pepPersonRecordToEntity(record)) ?? []),
    ...(catalogs.entities ?? []),
    ...snapshotEntities,
  ]
  const cargos = catalogs.cargos ?? pepCargoFixtures
  const internalRecords = catalogs.internalRecords ?? []
  const appliedDecisions = internalRecords.filter((record) => internalRecordMatchesQuery(record, query))

  if (!normalizedQueryName && !normalizedCargo && !normalizedDependency) {
    return buildPepResponse({
      status: "requiere_revision",
      checkedAt,
      query,
      results: [],
      appliedDecisions,
      snapshots: catalogs.snapshots,
      recommendation: "Captura al menos nombre, cargo o dependencia para ejecutar el screening PEP.",
    })
  }

  const falsePositiveDecisions = appliedDecisions.filter((record) => record.decision === "falso_positivo")
  const internalResults = appliedDecisions
    .filter((record) => record.decision !== "falso_positivo")
    .map((record) => buildInternalResult(record))

  const entityResults = entities
    .filter((entity) => !falsePositiveDecisions.some((decision) => decisionAppliesToEntity(decision, entity, query)))
    .map((entity) => scorePepEntity(entity, query))
    .filter((result): result is PepSearchResult => Boolean(result))

  const cargoResults = buildCargoResults(query, cargos)
  const results = [...internalResults, ...entityResults, ...cargoResults]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  return buildPepResponse({
    status: summarizePepStatus(results, appliedDecisions),
    checkedAt,
    query,
    results,
    appliedDecisions,
    snapshots: catalogs.snapshots,
    recommendation: buildPepRecommendation(results, appliedDecisions),
  })
}

export function normalizeText(value?: string): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
}

export function normalizeName(value?: string): string {
  return tokenizeName(value).join(" ")
}

function tokenizeName(value?: string): string[] {
  const stopWords = new Set(["DE", "DEL", "LA", "LAS", "LOS", "Y", "DA", "DAS", "DO", "DOS"])
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1)
    .filter((token) => !stopWords.has(token))
}

function scorePepEntity(entity: PepEntity, query: PepSearchQuery): PepSearchResult | null {
  const matchedFields: string[] = []
  const nameScore = scoreName(query.nombre, [entity.name, ...(entity.aliases ?? [])], matchedFields)
  const cargoScore = scorePositions(query.cargo, entity.positions, "cargo", matchedFields)
  const dependencyScore = scorePositions(query.dependencia, entity.positions, "dependencia", matchedFields)
  const birthDateScore = query.fechaNacimiento && entity.birthDate === query.fechaNacimiento ? 12 : 0
  const countryScore = query.pais && entity.country && normalizeText(query.pais) === normalizeText(entity.country) ? 4 : 0

  if (birthDateScore > 0) matchedFields.push("fechaNacimiento")
  if (countryScore > 0) matchedFields.push("pais")

  const baseScore = Math.max(nameScore, cargoScore)
  const score = Math.min(100, Math.round(baseScore + dependencyScore + birthDateScore + countryScore))

  if (score < 55) return null

  const status = score >= 90 ? "coincidencia_alta" : "posible_coincidencia"
  return {
    status,
    score,
    entity,
    source: entity.source,
    matchedFields: [...new Set(matchedFields)],
    requiresHumanReview: true,
    note:
      status === "coincidencia_alta"
        ? "Coincidencia alta contra fuente nominal pública. Requiere revisión humana y evidencia antes de confirmarla."
        : "Coincidencia parcial contra fuente nominal pública. Documentar criterio de descarte o confirmación.",
  }
}

function scoreName(queryName: string | undefined, candidates: string[], matchedFields: string[]): number {
  const queryTokens = tokenizeName(queryName)
  if (queryTokens.length === 0) return 0

  let bestScore = 0
  for (const candidate of candidates) {
    const candidateTokens = tokenizeName(candidate)
    if (candidateTokens.length === 0) continue
    const exact = queryTokens.join(" ") === candidateTokens.join(" ")
    const queryMatches = queryTokens.filter((token) => candidateTokens.includes(token)).length
    const candidateMatches = candidateTokens.filter((token) => queryTokens.includes(token)).length
    const queryRatio = queryMatches / queryTokens.length
    const candidateRatio = candidateMatches / candidateTokens.length
    const tokenScore = exact ? 92 : Math.round(queryRatio * 62 + candidateRatio * 24)
    bestScore = Math.max(bestScore, tokenScore)
  }

  if (bestScore >= 90) {
    matchedFields.push("nombre")
  } else if (bestScore >= 55) {
    matchedFields.push("alias/nombre parcial")
  }

  return bestScore
}

function scorePositions(
  queryValue: string | undefined,
  positions: PepEntity["positions"] | undefined,
  field: "cargo" | "dependencia",
  matchedFields: string[],
): number {
  const needle = normalizeText(queryValue)
  if (!needle || !positions?.length) return 0

  const values = positions.map((position) => normalizeText(field === "cargo" ? position.cargo : position.dependencia))
  const exactOrContained = values.some((value) => value.includes(needle) || needle.includes(value))
  if (exactOrContained) {
    matchedFields.push(field)
    return field === "cargo" ? 72 : 8
  }

  const tokens = needle.split(" ").filter((token) => token.length > 4)
  const partial = values.some((value) => tokens.some((token) => value.includes(token)))
  if (partial) {
    matchedFields.push(`${field} parcial`)
    return field === "cargo" ? 48 : 4
  }

  return 0
}

function buildCargoResults(query: PepSearchQuery, cargos: PepCargo[]): PepSearchResult[] {
  const cargoScreening = matchPepCargo(query, cargos)
  if (cargoScreening.status === "sin-coincidencia" || cargoScreening.status === "requiere-datos") return []

  return cargoScreening.matches.slice(0, 5).map((cargo, index) => {
    const matchedFields = [
      normalizeText(query.cargo) ? "cargo" : "",
      normalizeText(query.dependencia) ? "dependencia" : "",
    ].filter(Boolean)
    const score = cargoScreening.status === "coincidencia-cargo" ? (matchedFields.length >= 2 ? 92 : 84) : 68
    return {
      status: score >= 90 ? "coincidencia_alta" : "posible_coincidencia",
      score,
      entity: {
        id: `shcp-uif-cargo-${index}-${normalizeText(cargo.dependencia).slice(0, 18)}-${normalizeText(cargo.cargo).slice(0, 18)}`,
        name: query.nombre?.trim() || `Cargo PEP: ${cargo.cargo}`,
        country: "mx",
        positions: [
          {
            cargo: cargo.cargo,
            dependencia: cargo.dependencia,
          },
        ],
        source: "shcp-uif-cargos",
        sourceLabel: "SHCP/UIF cargos públicos políticamente expuestos",
        sourceUrl: "https://www.secciones.hacienda.gob.mx/work/models/SHCP/UIF/cargos_publicos_politicamente_expuestos.csv",
        dataset: "cargos_publicos_politicamente_expuestos",
      },
      source: "shcp-uif-cargos",
      matchedFields,
      requiresHumanReview: true,
      note:
        "Coincidencia con cargo público considerado PEP en catálogo SHCP/UIF. No es validación nominal definitiva; requiere evidencia y revisión humana.",
    } satisfies PepSearchResult
  })
}

function buildInternalResult(record: PepInternalRecord): PepSearchResult {
  const status: PepWhoIsStatus = record.decision === "confirmado_pep" ? "coincidencia_alta" : "requiere_revision"
  return {
    status,
    score: record.decision === "confirmado_pep" ? 100 : 86,
    entity: {
      id: `internal-${record.id}`,
      name: record.subjectName,
      aliases: record.relatedPepName ? [`Relacionado con ${record.relatedPepName}`] : undefined,
      source: "internal",
      sourceLabel: "Base interna PLD",
      sourceUrl: "localStorage:pld-pep-internal-records",
      dataset: "pep-internal",
      lastSeen: record.decidedAt,
    },
    source: "internal",
    matchedFields: ["base interna", record.relation],
    requiresHumanReview: true,
    note:
      record.decision === "confirmado_pep"
        ? "Registro interno confirmado como PEP. Requiere mantener evidencia y revisión periódica."
        : "Registro interno relacionado con PEP o pendiente. Requiere revisión reforzada antes de cerrar expediente.",
    reviewDecision: record,
  }
}

function internalRecordMatchesQuery(record: PepInternalRecord, query: PepSearchQuery): boolean {
  const queryName = normalizeName(query.nombre)
  const recordName = normalizeName(record.subjectName)
  if (queryName && recordName === queryName) return true
  if (queryName && recordName && queryName.split(" ").every((token) => recordName.includes(token))) return true
  return Boolean(query.relacion && record.relation === query.relacion && !queryName)
}

function decisionAppliesToEntity(decision: PepReviewDecision, entity: PepEntity, query: PepSearchQuery): boolean {
  if (decision.sourceEntityId && decision.sourceEntityId === entity.id) return true
  const decisionName = normalizeName(decision.subjectName)
  const entityNames = [entity.name, ...(entity.aliases ?? [])].map((name) => normalizeName(name))
  const queryName = normalizeName(query.nombre)
  return Boolean(decisionName && queryName && decisionName === queryName && entityNames.includes(queryName))
}

function summarizePepStatus(results: PepSearchResult[], appliedDecisions: PepReviewDecision[]): PepWhoIsStatus {
  if (results.some((result) => result.status === "coincidencia_alta")) return "coincidencia_alta"
  if (results.some((result) => result.status === "requiere_revision")) return "requiere_revision"
  if (results.some((result) => result.status === "posible_coincidencia")) return "posible_coincidencia"
  if (appliedDecisions.some((decision) => decision.decision === "falso_positivo")) return "sin_coincidencia"
  return "sin_coincidencia"
}

function buildPepRecommendation(results: PepSearchResult[], appliedDecisions: PepReviewDecision[]): string {
  if (results.some((result) => result.status === "coincidencia_alta")) {
    return "Aplicar debida diligencia reforzada, solicitar declaración PEP y documentar decisión humana antes de cerrar el expediente."
  }
  if (results.some((result) => result.status === "requiere_revision")) {
    return "Revisar relación, evidencia interna y autorización de cumplimiento antes de continuar."
  }
  if (results.some((result) => result.status === "posible_coincidencia")) {
    return "Documentar descarte o confirmación de la coincidencia parcial con evidencia suficiente."
  }
  if (appliedDecisions.some((decision) => decision.decision === "falso_positivo")) {
    return "Conservar el soporte del falso positivo y programar revisión periódica."
  }
  return "Sin coincidencias en las fuentes cargadas. Conservar evidencia de consulta y repetir screening conforme a política."
}

function buildPepResponse(input: {
  status: PepWhoIsStatus
  checkedAt: string
  query: PepSearchQuery
  results: PepSearchResult[]
  appliedDecisions: PepReviewDecision[]
  snapshots?: PepSourceSnapshot[]
  recommendation: string
}): PepSearchResponse {
  return {
    status: input.status,
    checkedAt: input.checkedAt,
    query: input.query,
    results: input.results,
    appliedDecisions: input.appliedDecisions,
    sourceSnapshots:
      input.snapshots?.map((snapshot) => ({
        sourceId: snapshot.sourceId,
        sourceLabel: snapshot.sourceLabel,
        syncedAt: snapshot.syncedAt,
        count: snapshot.count,
      })) ?? [],
    recommendation: input.recommendation,
  }
}
