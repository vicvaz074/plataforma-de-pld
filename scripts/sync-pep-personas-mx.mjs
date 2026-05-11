import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import pepData from "../lib/pld/pep-data.ts"

const { buildPepCoverageReport } = pepData

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DATA_DIR = join(ROOT, "public", "data")
const CARGOS_PATH = join(DATA_DIR, "pep-cargos-mx.json")
const PUBLIC_MX_PATH = join(DATA_DIR, "pep-public-mx.json")
const OPEN_SANCTIONS_PATH = join(DATA_DIR, "pep-open-sanctions-mx.json")
const PERSONAS_OUTPUT_PATH = join(DATA_DIR, "pep-personas-mx.json")
const SOURCES_OUTPUT_PATH = join(DATA_DIR, "pep-sources-mx.json")
const REVIEW_QUEUE_OUTPUT_PATH = join(DATA_DIR, "pep-review-queue.json")
const syncedAt = new Date().toISOString()

const cargosSnapshot = await readJson(CARGOS_PATH, { cargos: [] })
const publicMxSnapshot = await readJson(PUBLIC_MX_PATH, { entities: [], syncedAt })
const openSanctionsSnapshot = await readJson(OPEN_SANCTIONS_PATH, { entities: [], syncedAt })
const cargos = cargosSnapshot.cargos ?? []
const personas = mergePersonRecords([
  ...snapshotEntitiesToPersons(publicMxSnapshot, cargos, "public-mx"),
  ...snapshotEntitiesToPersons(openSanctionsSnapshot, cargos, "opensanctions"),
])
const sources = buildSources({ cargosSnapshot, publicMxSnapshot, openSanctionsSnapshot, syncedAt })
const coverage = buildPepCoverageReport({ cargos, personas, sources, now: syncedAt })

await mkdir(DATA_DIR, { recursive: true })
await writeJson(PERSONAS_OUTPUT_PATH, {
  schemaVersion: 1,
  sourceId: "pep-personas-mx",
  sourceLabel: "PEP México titulares resueltos local-first",
  sourceUrl: "local://public/data/pep-personas-mx.json",
  syncedAt,
  count: personas.length,
  coverage: {
    totalCargos: coverage.totalCargos,
    cargosConTitular: coverage.cargosConTitular,
    cargosSinTitular: coverage.cargosSinTitular,
    personasResueltas: coverage.personasResueltas,
  },
  notes: [
    "Snapshot nominal local-first generado desde fuentes públicas cargadas.",
    "No es una lista oficial nominal en tiempo real; toda coincidencia requiere revisión humana.",
  ],
  personas,
})
await writeJson(SOURCES_OUTPUT_PATH, {
  schemaVersion: 1,
  generatedAt: syncedAt,
  count: sources.length,
  sources,
  health: {
    fresh: coverage.freshSources.length,
    stale: coverage.staleSources.length,
  },
})
await writeJson(REVIEW_QUEUE_OUTPUT_PATH, {
  schemaVersion: 1,
  generatedAt: syncedAt,
  count: coverage.reviewQueue.length,
  warnings: coverage.warnings,
  reviewQueue: coverage.reviewQueue,
  coverageByAmbito: coverage.coverageByAmbito,
})

console.log(`PEP titulares sincronizados: ${personas.length} personas, ${coverage.reviewQueue.length} pendientes -> ${PERSONAS_OUTPUT_PATH}`)

function snapshotEntitiesToPersons(snapshot, cargos, fallbackSourceId) {
  const sourceId = snapshot.sourceId || fallbackSourceId
  const syncedAt = snapshot.syncedAt || new Date().toISOString()

  return (snapshot.entities ?? []).map((entity) => {
    const cargoIds = resolveCargoIds(entity, cargos)
    return {
      ...entity,
      cargoIds,
      resolutionStatus: cargoIds.length ? "resolved" : "possible",
      verifiedAt: entity.lastSeen || syncedAt,
      sourceIds: [sourceId],
      confidence: cargoIds.length ? 92 : 76,
      evidenceUrl: entity.sourceUrl,
    }
  })
}

function mergePersonRecords(records) {
  const merged = new Map()

  for (const record of records) {
    const key = normalize(record.name)
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, record)
      continue
    }

    merged.set(key, {
      ...existing,
      aliases: unique([...(existing.aliases ?? []), ...(record.aliases ?? [])]),
      positions: mergePositions([...(existing.positions ?? []), ...(record.positions ?? [])]),
      cargoIds: unique([...(existing.cargoIds ?? []), ...(record.cargoIds ?? [])]),
      sourceIds: unique([...(existing.sourceIds ?? []), ...(record.sourceIds ?? [])]),
      resolutionStatus: existing.resolutionStatus === "resolved" || record.resolutionStatus === "resolved" ? "resolved" : "possible",
      verifiedAt: latestIso(existing.verifiedAt, record.verifiedAt),
      confidence: Math.max(existing.confidence ?? 0, record.confidence ?? 0),
    })
  }

  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, "es"))
}

function resolveCargoIds(entity, cargos) {
  const positions = entity.positions ?? []
  const matches = new Set()

  for (const position of positions) {
    const positionCargo = normalize(position.cargo)
    const positionDependency = normalize(position.dependencia)

    for (const cargo of cargos) {
      const cargoName = normalize(cargo.cargo)
      const cargoDependency = normalize(cargo.dependencia)
      const directCargoMatch =
        cargoName.includes(positionCargo) ||
        positionCargo.includes(cargoName) ||
        (overlapTokens(positionCargo, cargoName) >= 3 &&
          (cargoDependency.includes(positionDependency) || positionDependency.includes(cargoDependency) || overlapTokens(positionDependency, cargoDependency) >= 2))
      const dependencyMatch =
        !positionDependency ||
        !cargoDependency ||
        cargoDependency.includes(positionDependency) ||
        positionDependency.includes(cargoDependency) ||
        overlapTokens(positionDependency, cargoDependency) >= 2 ||
        cargoName.includes(positionDependency) ||
        overlapTokens(positionDependency, cargoName) >= 3
      const secretaryOfStateMatch =
        positionCargo.includes("SECRETARI") &&
        positionDependency.includes("SECRETARIA") &&
        cargoName === "SECRETARIOS DE ESTADO"
      const exactSecretaryRoleMatch =
        positionCargo.includes("SECRETARI") &&
        positionDependency.includes("SECRETARIA") &&
        (cargoName.includes(positionCargo) || positionCargo.includes(cargoName)) &&
        dependencyMatch
      const presidentMatch =
        positionCargo.includes("PRESIDENT") &&
        positionDependency.includes("GOBIERNO") &&
        positionDependency.includes("MEXICO") &&
        cargoName.includes("PRESIDENTE DE LA REPUBLICA") &&
        !cargoName.includes("CANDIDATO")

      if ((directCargoMatch && dependencyMatch) || secretaryOfStateMatch || exactSecretaryRoleMatch || presidentMatch) {
        matches.add(cargo.id)
      }
    }
  }

  return [...matches]
}

function buildSources({ cargosSnapshot, publicMxSnapshot, openSanctionsSnapshot, syncedAt }) {
  const sources = [
    {
      sourceId: "shcp-uif-csv",
      sourceLabel: "SHCP/UIF CSV cargos públicos políticamente expuestos",
      sourceUrl: cargosSnapshot.sourceUrl || "https://www.secciones.hacienda.gob.mx/work/models/SHCP/UIF/cargos_publicos_politicamente_expuestos.csv",
      sourceType: "official-csv",
      lastSyncedAt: cargosSnapshot.syncedAt || syncedAt,
      maxAgeDays: 90,
      status: "active",
      notes: "Fuente primaria de cargos PEP.",
    },
    {
      sourceId: "cnbv-pep-nacional",
      sourceLabel: "CNBV/SHCP Personas Políticamente Expuestas Nacionales",
      sourceUrl: "https://www.gob.mx/cnbv/documentos/personas-politicamente-expuestas-nacionales",
      sourceType: "official-web",
      lastSyncedAt: syncedAt,
      maxAgeDays: 180,
      status: "active",
      notes: "Página pública que contextualiza la lista enunciativa de cargos PEP nacionales.",
    },
    {
      sourceId: publicMxSnapshot.sourceId || "public-mx",
      sourceLabel: publicMxSnapshot.sourceLabel || "PEP México fuentes públicas verificadas",
      sourceUrl: publicMxSnapshot.sourceUrl || "local://public/data/pep-public-mx.json",
      sourceType: "official-directory",
      lastSyncedAt: publicMxSnapshot.syncedAt || syncedAt,
      maxAgeDays: 90,
      status: "active",
      notes: "Snapshot nominal curado desde fuentes oficiales públicas.",
    },
    {
      sourceId: openSanctionsSnapshot.sourceId || "opensanctions",
      sourceLabel: openSanctionsSnapshot.sourceLabel || "OpenSanctions PEP México",
      sourceUrl: openSanctionsSnapshot.sourceUrl || "https://www.opensanctions.org/datasets/peps/",
      sourceType: "opensanctions",
      lastSyncedAt: openSanctionsSnapshot.syncedAt || syncedAt,
      maxAgeDays: 30,
      status: "active",
      license: openSanctionsSnapshot.license,
      notes: "Snapshot local; revisar licencia y términos antes de uso comercial.",
    },
  ]

  if ((cargosSnapshot.sourceUrls ?? []).some((url) => String(url).includes("Lista_PEPS_2020.pdf"))) {
    sources.push({
      sourceId: "shcp-pdf-2020",
      sourceLabel: "Lista PEP Nacional 2020 SHCP/UBVA",
      sourceUrl: cargosSnapshot.sourceUrls.find((url) => String(url).includes("Lista_PEPS_2020.pdf")),
      sourceType: "official-pdf",
      lastSyncedAt: cargosSnapshot.syncedAt || syncedAt,
      maxAgeDays: 365,
      status: "active",
      notes: "Insumo de taxonomía de cargos; no contiene titulares nominales actuales.",
    })
  }

  return sources
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
}

function overlapTokens(first, second) {
  const firstTokens = new Set(first.split(" ").filter((token) => token.length > 3))
  return second
    .split(" ")
    .filter((token) => token.length > 3)
    .filter((token) => firstTokens.has(token)).length
}

function mergePositions(positions) {
  const byKey = new Map()
  for (const position of positions) {
    byKey.set(`${normalize(position.cargo)}-${normalize(position.dependencia)}`, position)
  }
  return [...byKey.values()]
}

function latestIso(first, second) {
  return new Date(first).getTime() >= new Date(second).getTime() ? first : second
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

async function readJson(path, fallback) {
  if (!existsSync(path)) return fallback
  return JSON.parse(await readFile(path, "utf8"))
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}
