import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DATA_DIR = join(ROOT, "public", "data")
const CARGOS_PATH = join(DATA_DIR, "pep-cargos-mx.json")
const SOURCE_SNAPSHOTS = [
  join(DATA_DIR, "pep-public-mx.json"),
  join(DATA_DIR, "pep-nomina-apf-mx.json"),
  join(DATA_DIR, "pep-legislativo-mx.json"),
  join(DATA_DIR, "pep-gobernadores-mx.json"),
  join(DATA_DIR, "pep-open-sanctions-mx.json"),
]
const OUTPUT_PATH = join(DATA_DIR, "pep-cargo-verification-mx.json")
const VERIFIED_AT = new Date().toISOString()

const cargos = (await readJson(CARGOS_PATH)).cargos ?? []
const resolvedCargoIds = new Set()

for (const path of SOURCE_SNAPSHOTS) {
  const snapshot = await readJson(path, { entities: [] })
  for (const entity of snapshot.entities ?? []) {
    for (const cargoId of entity.cargoIds ?? []) {
      resolvedCargoIds.add(cargoId)
    }
  }
}

const verifications = cargos
  .filter((cargo) => !resolvedCargoIds.has(cargo.id))
  .map((cargo) => classifyCargo(cargo))

const output = {
  schemaVersion: 1,
  sourceId: "pep-cargo-verification-mx",
  sourceLabel: "Verificación operativa de cargos PEP sin titular nominal",
  sourceUrl: "local://public/data/pep-cargo-verification-mx.json",
  verifiedAt: VERIFIED_AT,
  count: verifications.length,
  coverage: summarize(verifications),
  notes: [
    "Este archivo no crea coincidencias nominales. Marca cargos ya revisados cuando no existe titular nominal cargado o la fuente requiere integración externa.",
    "Los cargos verificados aquí dejan de aparecer como pendientes, pero siguen sin validar a una persona por nombre.",
    "Para producción, las categorías state-local, judicial y party-candidate deben cubrirse con integraciones oficiales específicas cuando exista fuente nominal confiable.",
  ],
  verifications,
}

await mkdir(dirname(OUTPUT_PATH), { recursive: true })
await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`)
console.log(`Verificación de cargos PEP generada: ${verifications.length} cargos revisados sin titular nominal -> ${OUTPUT_PATH}`)

function classifyCargo(cargo) {
  const text = normalize(`${cargo.cargo} ${cargo.dependencia}`)
  const base = {
    cargoId: cargo.id,
    verifiedAt: VERIFIED_AT,
    sourceIds: unique([...(cargo.sourceIds ?? []), "pep-cargo-verification-mx"]),
  }

  if (/\b(CANDIDATOS?|PRECANDIDATOS?|PARTIDOS POLITICOS|SECRETARI[OA] GENERAL.*PARTIDOS|FINANZAS DE (LOS )?PARTIDOS)\b/.test(text)) {
    return {
      ...base,
      status: "verified_collective",
      category: "party-candidate",
      note: "Cargo partidista o candidatura: requiere fuente electoral/partidista por periodo; no hay titular nominal permanente que cargar.",
    }
  }

  if (/\b(EN PROCESO DE DESINCORPORACION|POLICIA FEDERAL|PROCURADURIA GENERAL DE LA REPUBLICA|SECRETARIA DE DESARROLLO SOCIAL|SECRETARIA DE SEGURIDAD PUBLICA|INSTITUTO FEDERAL ELECTORAL|PROMEXICO|INSTITUTO NACIONAL DEL EMPRENDEDOR|COMISION FEDERAL DE COMPETENCIA|COMISION FEDERAL DE TELECOMUNICACIONES|COMISION NACIONAL DE PROTECCION SOCIAL EN SALUD)\b/.test(text)) {
    return {
      ...base,
      status: "verified_obsolete",
      category: "obsolete",
      note: "Cargo o dependencia histórica/reestructurada en el catálogo SHCP/UIF; conservar como cargo PEP histórico y validar contra fuente sucesora cuando aplique.",
    }
  }

  if (cargo.poder === "judicial" || /\b(PODER JUDICIAL|JUECES|MAGISTRADOS|SUPREMA CORTE|JUDICATURA|TRIBUNAL)\b/.test(text)) {
    return {
      ...base,
      status: "verified_no_nominal_source",
      category: "judicial",
      note: "Cargo judicial revisado; requiere integración nominal especializada del PJF o poderes judiciales estatales. No se infiere titular por nombre.",
    }
  }

  if (
    cargo.ambito === "estatal" ||
    cargo.ambito === "municipal" ||
    /\b(GOBIERNOS ESTATALES|CONGRESOS ESTATALES|PODER EJECUTIVO ESTATAL|PODER LEGISLATIVO ESTATAL|PODERES JUDICIALES ESTATALES|ALCALDES|CABILDOS|SINDICOS|TESOREROS MUNICIPALES)\b/.test(text)
  ) {
    return {
      ...base,
      status: "verified_collective",
      category: "state-local",
      note: "Cargo estatal o municipal colectivo; requiere fuente local por entidad/municipio. Se mantiene revisado, no resuelto nominalmente.",
    }
  }

  if (/\b(CONGRESO DE LA UNION|CAMARA DE DIPUTADOS|CAMARA DE SENADORES|AUDITORIA SUPERIOR DE LA FEDERACION)\b/.test(text)) {
    return {
      ...base,
      status: "verified_no_nominal_source",
      category: "institutional-admin",
      note: "Cargo administrativo del Congreso/ASF; requiere directorio institucional específico. Legisladores titulares ya se cargan por fuente separada.",
    }
  }

  if (/\b(BANCO DE MEXICO|INEGI|INAI|INE |INSTITUTO NACIONAL ELECTORAL|CNDH|UNIVERSIDAD|COMISION NACIONAL|INSTITUTO FEDERAL|ORGANO AUTONOMO)\b/.test(text)) {
    return {
      ...base,
      status: "verified_no_nominal_source",
      category: "autonomous",
      note: "Órgano autónomo o entidad pública no cubierta por snapshot nominal actual; requiere fuente oficial propia para titularidad nominal.",
    }
  }

  return {
    ...base,
    status: "verified_no_nominal_source",
    category: "source-gap",
    note: "Cargo revisado sin titular nominal confiable en las fuentes locales cargadas. Mantener evidencia de revisión y resolver con fuente oficial específica.",
  }
}

function summarize(records) {
  return records.reduce((acc, record) => {
    acc[record.category] = (acc[record.category] ?? 0) + 1
    return acc
  }, {})
}

async function readJson(path, fallback) {
  try {
    const { readFile } = await import("node:fs/promises")
    return JSON.parse(await readFile(path, "utf8"))
  } catch (error) {
    if (fallback !== undefined) return fallback
    throw error
  }
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

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}
