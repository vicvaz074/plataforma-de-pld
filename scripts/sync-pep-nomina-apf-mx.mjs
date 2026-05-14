import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { normalizeNominaValue, parseCsv, parseNominaApfRecord } from "./pep-nomina-apf-utils.mjs"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUTPUT_PATH = join(ROOT, "public", "data", "pep-nomina-apf-mx.json")
const CARGOS_PATH = join(ROOT, "public", "data", "pep-cargos-mx.json")

const NOMINA_HOME_URL = "https://nominatransparente.rhnet.gob.mx/"
const SECTORES_URL = "https://nominatransparente.rhnet.gob.mx/assets/sectores.json"
const ENTES_ENDPOINT = "https://servicios.dkla8prod.buengobierno.gob.mx/entes"
const NOMINA_ENDPOINT = "https://services.buengobierno.gob.mx/nomina/consultas/"
const CSV_BASE_URL = "https://miniodas.buengobierno.gob.mx/nomina/APF"
const NOMINA_API_KEY = "vAYBrRwL4dfeYB8uYZ8xSpCuhwbDU2"
const SYNCED_AT = new Date().toISOString()
const MAX_ENTES = Number.parseInt(process.env.PEP_NOMINA_MAX_ENTES || "0", 10)
const MAX_ROWS_PER_FILE = Number.parseInt(process.env.PEP_NOMINA_MAX_ROWS_PER_FILE || "0", 10)
const STOP_WORDS = new Set([
  "ADMINISTRACION",
  "PUBLICA",
  "FEDERAL",
  "SECRETARIA",
  "INSTITUTO",
  "NACIONAL",
  "COMISION",
  "GENERAL",
  "SERVICIO",
  "SERVICIOS",
  "MEXICO",
  "MEXICANO",
  "MEXICANA",
  "DIRECCION",
  "UNIDAD",
])
const CABINET_SECRETARY_TITLE_FRAGMENTS = [
  "GOBERNACION",
  "RELACIONES EXTERIORES",
  "HACIENDA",
  "CREDITO PUBLICO",
  "DEFENSA NACIONAL",
  "AGRICULTURA",
  "INFRAESTRUCTURA COMUNICACIONES Y TRANSPORTES",
  "ECONOMIA",
  "EDUCACION PUBLICA",
  "SALUD",
  "MARINA",
  "TRABAJO",
  "PREVISION SOCIAL",
  "DESARROLLO AGRARIO TERRITORIAL Y URBANO",
  "MEDIO AMBIENTE",
  "RECURSOS NATURALES",
  "ENERGIA",
  "BIENESTAR",
  "TURISMO",
  "SEGURIDAD Y PROTECCION CIUDADANA",
  "CULTURA",
  "MUJERES",
  "CIENCIA HUMANIDADES TECNOLOGIA E INNOVACION",
  "ANTICORRUPCION",
  "BUEN GOBIERNO",
  "TRANSFORMACION DIGITAL",
]

const cargosSnapshot = await readJson(CARGOS_PATH)
const cargos = cargosSnapshot.cargos ?? []
const cargoRules = cargos.map(toCargoRule)
const sectors = Object.values(await fetchJson(SECTORES_URL)).sort((first, second) => first.id - second.id)
const payrollPeriod = await fetchPayrollPeriod()
const entities = new Map()
const scannedSources = []
let scannedRows = 0
let scannedEntes = 0

for (const sector of sectors) {
  const entes = await fetchEntes(sector.id)

  for (const ente of entes) {
    if (MAX_ENTES && scannedEntes >= MAX_ENTES) break
    const candidateRules = getCandidateRulesForSource(cargoRules, sector, ente)
    if (!candidateRules.length) continue

    scannedEntes += 1

    const csvUrl = `${CSV_BASE_URL}/${sector.id}_${ente.unidadResponsable}.csv`
    console.error(`Revisando ${sector.id}_${ente.unidadResponsable} · ${ente.enteDesc} · ${candidateRules.length} cargo(s) candidato(s)`)
    const csv = await fetchCsv(csvUrl)
    if (!csv || csv.trim().length < 80) continue

    const rows = parseCsv(csv)
    const header = rows.shift() ?? []
    const indexes = indexHeader(header)
    let fileRows = 0
    let fileMatches = 0

    for (const row of rows) {
      if (MAX_ROWS_PER_FILE && fileRows >= MAX_ROWS_PER_FILE) break
      fileRows += 1
      scannedRows += 1

      const record = parseNominaApfRecord(row, indexes, ente.enteDesc)
      if (!record.nombre || !record.puesto || !isPepCandidateTitle(record.puesto)) continue

      const cargoIds = findCargoMatches(record, candidateRules)
      if (!cargoIds.length) continue

      fileMatches += 1
      upsertEntity(entities, {
        id: `nomina-apf-${slug(record.nombre)}-${slug(record.institucion)}-${slug(record.puesto)}`.slice(0, 180),
        name: titleCaseName(record.nombre),
        aliases: [record.nombre],
        country: "mx",
        positions: [
          {
            cargo: titleCaseCatalog(record.puesto),
            dependencia: titleCaseCatalog(record.institucion),
          },
        ],
        source: "nomina-apf",
        sourceLabel: "Nómina Transparente APF",
        sourceUrl: csvUrl,
        dataset: "nomina-transparente-apf",
        lastSeen: SYNCED_AT.slice(0, 10),
        cargoIds,
        topics: ["role.pep", "mx.public-official", "mx.nomina-transparente"],
      })
    }

    scannedSources.push({
      ramo: sector.id,
      sector: sector.name,
      unidadResponsable: ente.unidadResponsable,
      ente: ente.enteDesc,
      csvUrl,
      rows: fileRows,
      matches: fileMatches,
    })
  }

  if (MAX_ENTES && scannedEntes >= MAX_ENTES) break
}

const output = {
  schemaVersion: 1,
  sourceId: "nomina-apf",
  sourceLabel: "Nómina Transparente APF",
  sourceUrl: NOMINA_HOME_URL,
  exportBaseUrl: CSV_BASE_URL,
  syncedAt: SYNCED_AT,
  payrollPeriod,
  count: entities.size,
  scanned: {
    entes: scannedEntes,
    rows: scannedRows,
    sourcesWithMatches: scannedSources.filter((source) => source.matches > 0).length,
  },
  notes: [
    "Snapshot generado desde CSV públicos de Nómina Transparente APF.",
    "Incluye únicamente registros con puesto compatible con cargos PEP del catálogo SHCP/UIF.",
    "No sustituye la revisión humana; las coincidencias nominales deben conservar evidencia y fecha de consulta.",
  ],
  entities: [...entities.values()].sort((first, second) => first.name.localeCompare(second.name, "es")),
  scannedSources,
}

await mkdir(dirname(OUTPUT_PATH), { recursive: true })
await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`)

const resolvedCargoIds = new Set(output.entities.flatMap((entity) => entity.cargoIds ?? []))
console.log(
  `Nómina APF PEP sincronizada: ${output.entities.length} personas, ${resolvedCargoIds.size} cargos, ${scannedRows} filas -> ${OUTPUT_PATH}`,
)

function findCargoMatches(record, cargoRulesForSource) {
  const matches = new Set()
  const institution = normalize(record.institucion)
  const position = normalize(record.puesto)

  for (const cargo of cargoRulesForSource) {
    const cargoName = cargo.normalizedCargo
    const cargoDependency = cargo.normalizedDependencia
    const dependencyMatches =
      hasStrongOverlap(institution, cargoDependency) ||
      hasStrongOverlap(institution, cargoName)

    const secretaryMatch =
      cargoName === "SECRETARIOS DE ESTADO" &&
      institution.startsWith("SECRETARIA DE") &&
      /^SECRETARI[OA]\b/.test(position)

    const presidentMatch =
      cargoName.includes("PRESIDENTE DE LA REPUBLICA") &&
      institution.includes("PRESIDENCIA") &&
      position.includes("PRESIDENT")

    const namedOfficeMatch =
      dependencyMatches &&
      cargoName.length > 8 &&
      (position.includes(cargoName) ||
        cargoName.includes(position) ||
        (hasStrongOverlap(position, cargoName) && isSpecificOfficeCargo(cargoName)))

    const institutionTitularMatch =
      dependencyMatches &&
      (cargoName.includes(institution) ||
        cargoName.includes(cargo.sourceEnteName) ||
        institution.includes(cargoName) ||
        cargo.sourceEnteName.includes(cargoName)) &&
      isEntityHeadTitle(position)

    const dictionaryObservationMatch =
      dependencyMatches && cargoName.includes("VER OBSERVACION EN EL DICCIONARIO DE DATOS") && isEntityHeadTitle(position)

    if (secretaryMatch || presidentMatch || namedOfficeMatch || institutionTitularMatch || dictionaryObservationMatch) {
      matches.add(cargo.id)
    }
  }

  return [...matches]
}

function getCandidateRulesForSource(rules, sector, ente) {
  const sectorName = normalize(sector.name)
  const enteName = normalize(ente.enteDesc)
  const enteShort = normalize(ente.nombreCorto)

  return rules
    .map((rule) => {
      const sourceMatches =
        hasStrongOverlap(enteName, rule.normalizedDependencia) ||
        hasStrongOverlap(enteName, rule.normalizedCargo) ||
        hasStrongOverlap(sectorName, rule.normalizedDependencia) ||
        hasStrongOverlap(sectorName, rule.normalizedCargo) ||
        (enteShort && (hasStrongOverlap(enteShort, rule.normalizedCargo) || hasStrongOverlap(enteShort, rule.normalizedDependencia))) ||
        (rule.normalizedCargo === "SECRETARIOS DE ESTADO" && sectorName.startsWith("SECRETARIA DE")) ||
        (rule.normalizedCargo.includes("PRESIDENTE DE LA REPUBLICA") && sectorName.includes("PRESIDENCIA"))

      return sourceMatches ? { ...rule, sourceMatches, sourceSectorName: sectorName, sourceEnteName: enteName, sourceEnteShort: enteShort } : null
    })
    .filter(Boolean)
}

function toCargoRule(cargo) {
  return {
    ...cargo,
    normalizedCargo: normalize(cargo.cargo),
    normalizedDependencia: normalize(cargo.dependencia),
  }
}

function isPepCandidateTitle(value) {
  const title = normalize(value)
  if (isCabinetSecretaryTitle(title)) return true
  if (/^(SECRETARI[OA]|AUXILIAR|ABOGAD[OA]|PROFESOR(A)?|TECNIC[OA]|ENFERMER[OA]|CHOFER|ASISTENTE)\b/.test(title)) return false
  return (
    /^SUBSECRETARI[OA]\b/.test(title) ||
    /^DIRECTOR(A)? GENERAL\b/.test(title) ||
    /^DIRECCION GENERAL\b/.test(title) ||
    /^DIRECTOR(A)? EJECUTIV[OA]\b/.test(title) ||
    /^COORDINADOR(A)? GENERAL\s+(DE|DEL)\b/.test(title) ||
    /^COMISIONAD[OA]\b/.test(title) ||
    /^PROCURADOR(A)?\b/.test(title) ||
    /^PRESIDENT[EA]\b/.test(title) ||
    /^TITULAR\b/.test(title) ||
    /^JEFE(A)? DE UNIDAD\b/.test(title) ||
    /^OFICIAL MAYOR\b/.test(title) ||
    /^AUDITOR(A)? SUPERIOR\b/.test(title) ||
    /^MAGISTRAD[OA]\b/.test(title)
  )
}

function isTitularTitle(title) {
  if (isCabinetSecretaryTitle(title)) return true
  if (/^(SECRETARI[OA]|AUXILIAR|ABOGAD[OA]|PROFESOR(A)?|TECNIC[OA]|ENFERMER[OA]|CHOFER|ASISTENTE)\b/.test(title)) return false
  return (
    /^DIRECTOR(A)? GENERAL\b/.test(title) ||
    /^DIRECCION GENERAL\b/.test(title) ||
    /^DIRECTOR(A)? EJECUTIV[OA]\b/.test(title) ||
    /^COORDINADOR(A)? GENERAL\s+(DE|DEL)\b/.test(title) ||
    /^COMISIONAD[OA]\b/.test(title) ||
    /^PROCURADOR(A)?\b/.test(title) ||
    /^PRESIDENT[EA]\b/.test(title) ||
    /^TITULAR\b/.test(title)
  )
}

function isHeadTitle(title) {
  return isTitularTitle(title) && !/\b(ADJUNT[OA]|AUXILIAR|SECRETARI[OA] PARTICULAR|SECRETARI[OA] PRIVAD[OA]|SUBDIRECCION)\b/.test(title)
}

function isEntityHeadTitle(title) {
  if (!isHeadTitle(title)) return false
  if (/^TITULAR\b/.test(title)) {
    return !/\b(AREA|AUDITORIA|DEPARTAMENTO|JEFATURA|OFICINA DE REPRESENTACION|ORGANO INTERNO|QUEJAS|RESPONSABILIDADES)\b/.test(title)
  }
  return true
}

function isCabinetSecretaryTitle(title) {
  if (!/^SECRETARI[OA]\s+DE\b/.test(title)) return false
  return CABINET_SECRETARY_TITLE_FRAGMENTS.some((fragment) => title.includes(fragment))
}


function isSpecificOfficeCargo(cargoName) {
  return (
    cargoName.includes("DIRECCION") ||
    cargoName.includes("DIRECTOR") ||
    cargoName.includes("SECRETARIA") ||
    cargoName.includes("COMISION") ||
    cargoName.includes("PROCURADURIA") ||
    cargoName.includes("INSTITUTO") ||
    cargoName.includes("BANCO") ||
    cargoName.includes("SERVICIO") ||
    cargoName.includes("AGENCIA") ||
    cargoName.includes("COORDINACION") ||
    cargoName.includes("UNIDAD")
  )
}

function hasStrongOverlap(first, second) {
  if (!first || !second) return false
  if (first.includes(second) || second.includes(first)) return true
  return overlapTokens(first, second) >= 2
}

function overlapTokens(first, second) {
  const tokens = new Set(first.split(" ").filter((token) => token.length > 3 && !STOP_WORDS.has(token)))
  return second
    .split(" ")
    .filter((token) => token.length > 3 && !STOP_WORDS.has(token))
    .filter((token) => tokens.has(token)).length
}

function upsertEntity(entities, entity) {
  const key = slug(entity.name)
  const existing = entities.get(key)
  if (!existing) {
    entities.set(key, {
      ...entity,
      aliases: unique(entity.aliases),
      cargoIds: unique(entity.cargoIds),
    })
    return
  }

  entities.set(key, {
    ...existing,
    aliases: unique([...(existing.aliases ?? []), ...(entity.aliases ?? [])]),
    positions: mergePositions([...(existing.positions ?? []), ...(entity.positions ?? [])]),
    sourceUrl: existing.sourceUrl || entity.sourceUrl,
    cargoIds: unique([...(existing.cargoIds ?? []), ...(entity.cargoIds ?? [])]),
    topics: unique([...(existing.topics ?? []), ...(entity.topics ?? [])]),
  })
}

async function fetchPayrollPeriod() {
  const query = "query variablesNomina { variablesNomina { flag fechaApf fechaFone } }"
  const response = await fetch(NOMINA_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      apikey: NOMINA_API_KEY,
    },
    body: JSON.stringify({ operationName: "variablesNomina", query }),
  })
  const json = await response.json()
  return json.data?.variablesNomina?.fechaApf ?? "Periodo APF no disponible"
}

async function fetchEntes(ramo) {
  const query = `query obtenerEntes($ramo: Int!){
    obtenerEntes(filtro: { ramo: $ramo, nivelGobierno: FEDERAL }){
      unidadResponsable
      nombreCorto
      enteDesc
    }
  }`
  const json = await postJson(ENTES_ENDPOINT, { operationName: "obtenerEntes", query, variables: { ramo } })
  return json.data?.obtenerEntes ?? []
}

async function fetchCsv(url) {
  const response = await fetch(url)
  if (!response.ok) return ""
  return response.text()
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  })
  return response.json()
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`No se pudo descargar ${url}: ${response.status}`)
  return response.json()
}

async function readJson(path) {
  const { readFile } = await import("node:fs/promises")
  return JSON.parse(await readFile(path, "utf8"))
}

function indexHeader(header) {
  const normalized = header.map(normalize)
  return {
    nombre: normalized.findIndex((value) => value.includes("NOMBRE COMPLETO")),
    institucion: normalized.findIndex((value) => value.includes("INSTITUCION")),
    puesto: normalized.findIndex((value) => value.includes("PUESTO")),
  }
}

function mergePositions(positions) {
  const byKey = new Map()
  for (const position of positions) {
    byKey.set(`${normalize(position.cargo)}-${normalize(position.dependencia)}`, position)
  }
  return [...byKey.values()]
}

function normalize(value) {
  return normalizeNominaValue(value)
}

function slug(value) {
  return normalize(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function titleCaseName(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("es-MX")
    .replace(/(^|\s|\.|-)([a-záéíóúñü])/g, (match) => match.toLocaleUpperCase("es-MX"))
}

function titleCaseCatalog(value) {
  return titleCaseName(value).replace(/\bDe\b/g, "de").replace(/\bDel\b/g, "del").replace(/\bLa\b/g, "la")
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}
