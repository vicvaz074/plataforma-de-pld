import { createInterface } from "node:readline"
import { Readable } from "node:stream"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const DEFAULT_EXPORT_URL = "https://data.opensanctions.org/datasets/latest/peps/entities.ftm.json"
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUTPUT_PATH = join(ROOT, "public", "data", "pep-open-sanctions-mx.json")
const SOURCE_URL = process.env.OPENSANCTIONS_EXPORT_URL || DEFAULT_EXPORT_URL
const MAX_ENTITIES = Number.parseInt(process.env.OPENSANCTIONS_MAX_ENTITIES || "5000", 10)

const response = await fetch(SOURCE_URL, {
  headers: process.env.OPENSANCTIONS_API_KEY
    ? {
        Authorization: `ApiKey ${process.env.OPENSANCTIONS_API_KEY}`,
      }
    : undefined,
})

if (!response.ok || !response.body) {
  throw new Error(`No se pudo descargar OpenSanctions (${response.status}) desde ${SOURCE_URL}`)
}

const entities = []
const lineReader = createInterface({
  input: Readable.fromWeb(response.body),
  crlfDelay: Infinity,
})

for await (const line of lineReader) {
  if (!line.trim()) continue
  const raw = JSON.parse(line)
  const entity = normalizeOpenSanctionsEntity(raw)

  if (!entity) continue
  entities.push(entity)

  if (entities.length >= MAX_ENTITIES) break
}

await mkdir(dirname(OUTPUT_PATH), { recursive: true })
await writeFile(
  OUTPUT_PATH,
  `${JSON.stringify(
    {
      sourceId: "opensanctions",
      sourceLabel: "OpenSanctions PEP México",
      sourceUrl: "https://www.opensanctions.org/",
      exportUrl: SOURCE_URL,
      syncedAt: new Date().toISOString(),
      count: entities.length,
      license:
        "OpenSanctions data license applies to synchronized exports; verify commercial terms before production use.",
      entities,
    },
    null,
    2,
  )}\n`,
)

console.log(`OpenSanctions PEP MX sincronizado: ${entities.length} entidades -> ${OUTPUT_PATH}`)

function normalizeOpenSanctionsEntity(raw) {
  if (raw.schema !== "Person") return null

  const properties = raw.properties ?? {}
  const topics = asArray(properties.topics)
  if (topics.length && !topics.some((topic) => String(topic).includes("role.pep"))) return null

  const countries = [
    ...asArray(properties.country),
    ...asArray(properties.nationality),
    ...asArray(properties.citizenship),
  ].map((value) => String(value).toLowerCase())

  const isMexicoRelated =
    countries.some((value) => ["mx", "mex", "mexico", "méxico"].includes(value)) ||
    JSON.stringify(properties).toLowerCase().includes("mexico") ||
    JSON.stringify(properties).toLowerCase().includes("méxico")

  if (!isMexicoRelated) return null

  const name = first(properties.name) || first(properties.caption) || raw.caption
  if (!name) return null

  return {
    id: raw.id,
    name,
    aliases: [...asArray(properties.alias), ...asArray(properties.weakAlias)].filter(Boolean),
    country: "mx",
    birthDate: first(properties.birthDate),
    positions: asArray(properties.position).map((position) => ({ cargo: String(position) })),
    source: "opensanctions",
    sourceLabel: "OpenSanctions PEP México",
    sourceUrl: `https://www.opensanctions.org/entities/${raw.id}/`,
    dataset: first(properties.dataset) || "peps",
    lastSeen: first(properties.modifiedAt) || new Date().toISOString().slice(0, 10),
    topics,
  }
}

function asArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function first(value) {
  return asArray(value)[0]
}
