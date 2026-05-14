import type {
  PepAmbito,
  PepCargoVerificationRecord,
  PepCargo,
  PepCargoDefinition,
  PepCoverageReport,
  PepEntity,
  PepPersonRecord,
  PepPoder,
  PepReviewQueueItem,
  PepSourceRecord,
} from "./types"

interface ExtractPepCargoOptions {
  sourceId: string
  sourceLabel: string
  sourceUrl: string
  extractedAt: string
}

interface MergePepCargoInput {
  csvCargos: PepCargo[]
  pdfCargos: PepCargoDefinition[]
  syncedAt: string
}

interface PepCoverageInput {
  cargos: PepCargoDefinition[]
  personas: PepPersonRecord[]
  sources: PepSourceRecord[]
  now: string
  cargoVerifications?: PepCargoVerificationRecord[]
}

const DEFAULT_DEPENDENCIA = "NO ESPECIFICADA"
const AMBITOS: PepAmbito[] = ["federal", "estatal", "municipal", "partido", "autonomo", "paraestatal", "desconocido"]

export function extractPepCargoDefinitionsFromText(text: string, options: ExtractPepCargoOptions): PepCargoDefinition[] {
  const cargos = new Map<string, PepCargoDefinition>()
  let ambito: PepAmbito = "desconocido"
  let poder: PepPoder = "desconocido"
  let dependencia = DEFAULT_DEPENDENCIA

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    const normalizedLine = normalizePepText(line)

    if (normalizedLine.includes("SECCION I") || normalizedLine.includes("AMBITO FEDERAL")) {
      ambito = "federal"
      poder = "desconocido"
      dependencia = DEFAULT_DEPENDENCIA
      continue
    }
    if (normalizedLine.includes("SECCION II") || normalizedLine.includes("AMBITO ESTATAL")) {
      ambito = "estatal"
      poder = "desconocido"
      dependencia = "GOBIERNOS ESTATALES"
      continue
    }
    if (normalizedLine.includes("SECCION III") || normalizedLine.includes("AMBITO MUNICIPAL")) {
      ambito = "municipal"
      poder = "ejecutivo"
      dependencia = "GOBIERNOS MUNICIPALES"
      continue
    }
    if (normalizedLine.includes("SECCION IV") || normalizedLine.includes("PARTIDOS POLITICOS")) {
      ambito = "partido"
      poder = "partido"
      dependencia = "PARTIDOS POLÍTICOS"
    }

    if (normalizedLine.includes("PODER EJECUTIVO")) poder = "ejecutivo"
    if (normalizedLine.includes("PODER LEGISLATIVO")) {
      poder = "legislativo"
      dependencia = ambito === "estatal" ? "CONGRESOS ESTATALES" : "CONGRESO DE LA UNIÓN"
    }
    if (normalizedLine.includes("PODER JUDICIAL")) {
      poder = "judicial"
      dependencia = ambito === "estatal" ? "PODERES JUDICIALES ESTATALES" : "PODER JUDICIAL DE LA FEDERACIÓN"
    }
    if (normalizedLine.includes("ORGANISMOS AUTONOMOS")) poder = "autonomo"

    const dependencyCandidate = extractDependencyHeading(line)
    if (dependencyCandidate) {
      dependencia = dependencyCandidate
      continue
    }

    if (!isLikelyCargoLine(line)) continue

    const cargoText = cleanCargoText(line)
    if (!cargoText || cargoText.length < 4) continue

    const inferred = inferPepCargoContext(cargoText, ambito, poder, dependencia)
    const definition = createPepCargoDefinition({
      cargo: cargoText,
      dependencia: inferred.dependencia,
      tipoAdministracionPublica: inferred.tipoAdministracionPublica,
      entidadAdministracionPublica: inferred.entidadAdministracionPublica,
      ambito: inferred.ambito,
      poder: inferred.poder,
      sourceId: options.sourceId,
      sourceLabel: options.sourceLabel,
      sourceUrl: options.sourceUrl,
      syncedAt: options.extractedAt,
      sourceNote: "Extraído de Lista de Personas Políticamente Expuestas Nacionales 2020.",
    })

    cargos.set(definition.id, definition)
  }

  return [...cargos.values()]
}

export function mergePepCargoDefinitions(input: MergePepCargoInput): PepCargoDefinition[] {
  const merged = new Map<string, PepCargoDefinition>()
  const csvDefinitions = input.csvCargos.map((cargo) =>
    createPepCargoDefinition({
      ...cargo,
      ...inferContextFromCsvCargo(cargo),
      sourceId: "shcp-uif-csv",
      sourceLabel: "SHCP/UIF CSV cargos públicos políticamente expuestos",
      sourceUrl: "https://www.secciones.hacienda.gob.mx/work/models/SHCP/UIF/cargos_publicos_politicamente_expuestos.csv",
      syncedAt: input.syncedAt,
      sourceNote: "Registro proveniente del CSV público SHCP/UIF.",
    }),
  )

  for (const definition of [...csvDefinitions, ...input.pdfCargos]) {
    const existing = merged.get(definition.id)
    if (!existing) {
      merged.set(definition.id, definition)
      continue
    }

    merged.set(definition.id, {
      ...existing,
      sourceIds: unique([...existing.sourceIds, ...definition.sourceIds]),
      sourceLabels: unique([...existing.sourceLabels, ...definition.sourceLabels]),
      sourceUrls: unique([...existing.sourceUrls, ...definition.sourceUrls]),
      sourceNotes: unique([...(existing.sourceNotes ?? []), ...(definition.sourceNotes ?? [])]),
      lastVerified: latestIso(existing.lastVerified, definition.lastVerified),
    })
  }

  return [...merged.values()].sort((a, b) => `${a.ambito}-${a.dependencia}-${a.cargo}`.localeCompare(`${b.ambito}-${b.dependencia}-${b.cargo}`, "es"))
}

export function validatePepSourceFreshness(sources: PepSourceRecord[], now = new Date().toISOString()): {
  fresh: PepSourceRecord[]
  stale: PepSourceRecord[]
} {
  const nowTime = new Date(now).getTime()
  const fresh: PepSourceRecord[] = []
  const stale: PepSourceRecord[] = []

  for (const source of sources) {
    const lastSynced = new Date(source.lastSyncedAt).getTime()
    const ageDays = Number.isFinite(lastSynced) ? Math.floor((nowTime - lastSynced) / 86_400_000) : Number.POSITIVE_INFINITY
    if (source.status === "stale" || source.status === "error" || ageDays > source.maxAgeDays) {
      stale.push({ ...source, status: source.status === "error" ? "error" : "stale" })
    } else {
      fresh.push(source)
    }
  }

  return { fresh, stale }
}

export function buildPepCoverageReport(input: PepCoverageInput): PepCoverageReport {
  const { fresh, stale } = validatePepSourceFreshness(input.sources, input.now)
  const resolvedCargoIds = new Set(
    input.personas
      .filter((person) => person.resolutionStatus === "resolved")
      .flatMap((person) => person.cargoIds),
  )
  const verifiedCargoIds = new Set(
    (input.cargoVerifications ?? [])
      .filter((record) => record.status === "verified_no_nominal_source" || record.status === "verified_obsolete" || record.status === "verified_collective")
      .map((record) => record.cargoId),
  )
  const coverageByAmbito = Object.fromEntries(
    AMBITOS.map((ambito) => [ambito, { total: 0, resolved: 0, unresolved: 0 }]),
  ) as PepCoverageReport["coverageByAmbito"]
  const reviewQueue: PepReviewQueueItem[] = []

  for (const cargo of input.cargos) {
    const bucket = coverageByAmbito[cargo.ambito] ?? coverageByAmbito.desconocido
    bucket.total += 1

    if (resolvedCargoIds.has(cargo.id)) {
      bucket.resolved += 1
      continue
    }

    bucket.unresolved += 1
    if (verifiedCargoIds.has(cargo.id)) continue

    reviewQueue.push({
      id: `review-${cargo.id}`,
      cargoId: cargo.id,
      reason: "sin_titular_resuelto",
      label: `${cargo.cargo} - ${cargo.dependencia}`,
      priority: cargo.ambito === "federal" ? "alta" : "media",
      sourceIds: cargo.sourceIds,
      createdAt: input.now,
      recommendation: "Resolver titular actual con fuente pública oficial o registrar justificación de revisión manual.",
    })
  }

  for (const source of stale) {
    reviewQueue.unshift({
      id: `review-source-${source.sourceId}`,
      reason: "fuente_vencida",
      label: source.sourceLabel,
      priority: "alta",
      sourceIds: [source.sourceId],
      createdAt: input.now,
      recommendation: "Actualizar snapshot antes de usar el resultado como evidencia productiva.",
    })
  }

  const cargosConTitular = resolvedCargoIds.size
  const cargosVerificadosSinTitular = [...verifiedCargoIds].filter((cargoId) =>
    input.cargos.some((cargo) => cargo.id === cargoId && !resolvedCargoIds.has(cargoId)),
  ).length
  const cargosSinTitular = Math.max(0, input.cargos.length - cargosConTitular)
  const cargosPendientesRevision = Math.max(0, cargosSinTitular - cargosVerificadosSinTitular)

  return {
    generatedAt: input.now,
    totalCargos: input.cargos.length,
    cargosConTitular,
    cargosSinTitular,
    cargosVerificadosSinTitular,
    cargosPendientesRevision,
    personasResueltas: input.personas.filter((person) => person.resolutionStatus === "resolved").length,
    staleSources: stale,
    freshSources: fresh,
    reviewQueue,
    coverageByAmbito,
    warnings: [
      "Snapshot local-first: no equivale a consulta oficial en tiempo real.",
      ...(stale.length ? ["Existen fuentes vencidas que deben actualizarse antes de cierre productivo."] : []),
      ...(cargosPendientesRevision ? ["Hay cargos PEP sin titular nominal resuelto; usar revisión humana y evidencia adicional."] : []),
      ...(cargosVerificadosSinTitular ? ["Hay cargos PEP verificados sin fuente nominal cargada; conservar justificación y no tratar como coincidencia nominal."] : []),
    ],
  }
}

export function pepPersonRecordToEntity(record: PepPersonRecord): PepEntity {
  return {
    id: record.id,
    name: record.name,
    aliases: record.aliases,
    country: record.country,
    birthDate: record.birthDate,
    positions: record.positions,
    source: record.source,
    sourceLabel: record.sourceLabel,
    sourceUrl: record.sourceUrl,
    dataset: record.dataset,
    lastSeen: record.verifiedAt || record.lastSeen,
    topics: record.topics,
  }
}

function createPepCargoDefinition(input: PepCargo & {
  ambito: PepAmbito
  poder: PepPoder
  sourceId: string
  sourceLabel: string
  sourceUrl: string
  syncedAt: string
  sourceNote: string
}): PepCargoDefinition {
  const cargo = formatCatalogText(input.cargo)
  const dependencia = formatCatalogText(input.dependencia || DEFAULT_DEPENDENCIA)
  const normalizedCargo = normalizePepText(cargo)
  const normalizedDependencia = normalizePepText(dependencia)
  const ambito = input.ambito

  return {
    id: buildCargoId(ambito, normalizedDependencia, normalizedCargo),
    tipoAdministracionPublica: formatCatalogText(input.tipoAdministracionPublica || inferTipoAdministracion(ambito)),
    entidadAdministracionPublica: formatCatalogText(input.entidadAdministracionPublica || dependencia),
    dependencia,
    cargo,
    ambito,
    poder: input.poder,
    nivel: inferNivel(cargo),
    normalizedCargo,
    normalizedDependencia,
    sourceIds: [input.sourceId],
    sourceLabels: [input.sourceLabel],
    sourceUrls: [input.sourceUrl],
    lastVerified: input.syncedAt,
    needsTitularResolution: true,
    sourceNotes: [input.sourceNote],
  }
}

function inferPepCargoContext(cargo: string, ambito: PepAmbito, poder: PepPoder, dependencia: string) {
  const normalizedCargo = normalizePepText(cargo)
  let nextAmbito = ambito
  let nextPoder = poder
  let nextDependencia = dependencia || DEFAULT_DEPENDENCIA

  if (normalizedCargo.includes("GOBERNADOR")) {
    nextAmbito = "estatal"
    nextPoder = "ejecutivo"
    nextDependencia = "GOBIERNOS ESTATALES"
  }
  if (normalizedCargo.includes("PRESIDENTES MUNICIPALES")) {
    nextAmbito = "municipal"
    nextPoder = "ejecutivo"
    nextDependencia = "GOBIERNOS MUNICIPALES"
  }
  if (normalizedCargo.includes("PARTIDOS POLITICOS")) {
    nextAmbito = "partido"
    nextPoder = "partido"
    nextDependencia = "PARTIDOS POLÍTICOS"
  }
  if (normalizedCargo.includes("SENADORES") || normalizedCargo.includes("DIPUTADOS")) {
    nextPoder = "legislativo"
    nextDependencia = nextAmbito === "estatal" ? "CONGRESOS ESTATALES" : "CONGRESO DE LA UNIÓN"
  }
  if (normalizedCargo === "PRESIDENTE DE LA REPUBLICA") {
    nextAmbito = "federal"
    nextPoder = "ejecutivo"
    nextDependencia = "PRESIDENCIA DE LA REPÚBLICA"
  }
  if (normalizedCargo === "SECRETARIOS DE ESTADO") {
    nextAmbito = "federal"
    nextPoder = "ejecutivo"
    nextDependencia = "DEPENDENCIAS DE LA ADMINISTRACIÓN PÚBLICA FEDERAL"
  }

  return {
    ambito: nextAmbito,
    poder: nextPoder,
    dependencia: formatCatalogText(nextDependencia),
    tipoAdministracionPublica: inferTipoAdministracion(nextAmbito),
    entidadAdministracionPublica: formatCatalogText(nextDependencia),
  }
}

function inferContextFromCsvCargo(cargo: PepCargo): Pick<PepCargoDefinition, "ambito" | "poder"> {
  const text = normalizePepText(`${cargo.tipoAdministracionPublica} ${cargo.entidadAdministracionPublica} ${cargo.dependencia} ${cargo.cargo}`)

  if (text.includes("PARTIDOS POLITICOS")) return { ambito: "partido", poder: "partido" }
  if (text.includes("MUNICIPAL") || text.includes("PRESIDENTES MUNICIPALES")) return { ambito: "municipal", poder: "ejecutivo" }
  if (text.includes("GOBERNADOR") || text.includes("ENTIDADES FEDERATIVAS") || text.includes("ESTATAL")) return { ambito: "estatal", poder: "ejecutivo" }
  if (text.includes("SENADORES") || text.includes("DIPUTADOS")) return { ambito: "federal", poder: "legislativo" }
  if (text.includes("JUEZ") || text.includes("MAGISTRADO") || text.includes("SUPREMA CORTE")) return { ambito: "federal", poder: "judicial" }
  if (text.includes("AUTONOMO") || text.includes("AUTONOMA")) return { ambito: "autonomo", poder: "autonomo" }
  if (text.includes("PARAESTATAL")) return { ambito: "paraestatal", poder: "paraestatal" }
  return { ambito: "federal", poder: "ejecutivo" }
}

function extractDependencyHeading(line: string): string | null {
  const withoutPrefix = line
    .replace(/^[IVXLC\d.]+\s*[A-Z]?\s*\.?\s*/i, "")
    .replace(/^[A-Z]\.\s*/i, "")
    .trim()

  if (/^Secretar[ií]a\s+de\s+/i.test(withoutPrefix)) return formatCatalogText(withoutPrefix)
  if (/^Presidencia de la Rep[uú]blica/i.test(withoutPrefix)) return "PRESIDENCIA DE LA REPÚBLICA"
  if (/^Fiscal[ií]a General/i.test(withoutPrefix)) return "FISCALÍA GENERAL DE LA REPÚBLICA"
  return null
}

function isLikelyCargoLine(line: string): boolean {
  return /^[\s•●▪\uF0B7\uF0A7\uF02D\-–—]+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(line)
}

function cleanCargoText(line: string): string {
  return formatCatalogText(
    line
      .replace(/^[\s•●▪\uF0B7\uF0A7\uF02D\-–—]+/, "")
      .replace(/\s+/g, " ")
      .trim(),
  )
}

function formatCatalogText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLocaleUpperCase("es-MX")
}

function normalizePepText(value?: string): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
}

function buildCargoId(ambito: PepAmbito, dependencia: string, cargo: string): string {
  const slug = `${ambito}-${dependencia}-${cargo}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 130)

  return `pep-cargo-${slug}`
}

function inferTipoAdministracion(ambito: PepAmbito): string {
  if (ambito === "paraestatal") return "PARAESTATAL"
  if (ambito === "partido") return "PARTIDOS POLÍTICOS"
  if (ambito === "estatal") return "ESTATAL"
  if (ambito === "municipal") return "MUNICIPAL"
  return "CENTRAL"
}

function inferNivel(cargo: string): PepCargoDefinition["nivel"] {
  const normalizedCargo = normalizePepText(cargo)
  if (
    normalizedCargo.includes("PRESIDENT") ||
    normalizedCargo.includes("SECRETARIO") ||
    normalizedCargo.includes("GOBERNADOR") ||
    normalizedCargo.includes("SENADOR") ||
    normalizedCargo.includes("DIPUTADO") ||
    normalizedCargo.includes("MINISTRO")
  ) {
    return "alto"
  }
  if (normalizedCargo.includes("DIRECTOR") || normalizedCargo.includes("TITULAR") || normalizedCargo.includes("COMISIONADO")) return "medio"
  return "desconocido"
}

function latestIso(first: string, second: string): string {
  return new Date(first).getTime() >= new Date(second).getTime() ? first : second
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values.filter(Boolean))]
}
