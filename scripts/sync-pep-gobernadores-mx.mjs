import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { parseCurrentConagoGovernors } from "./pep-gobernadores-utils.mjs"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUTPUT_PATH = join(ROOT, "public", "data", "pep-gobernadores-mx.json")
const CARGOS_PATH = join(ROOT, "public", "data", "pep-cargos-mx.json")
const SOURCE_URL = "https://www.conago.org.mx/gobernadores/historicos"
const READER_URL = "https://r.jina.ai/http://www.conago.org.mx/gobernadores/historicos"
const SYNCED_AT = new Date().toISOString()

const cargosSnapshot = await readJson(CARGOS_PATH)
const cargos = cargosSnapshot.cargos ?? []
const currentDate = SYNCED_AT.slice(0, 10)
const content = await fetchText(READER_URL)
const governors = parseCurrentConagoGovernors(content, currentDate)
const cargoIds = findGovernorCargoIds(cargos)

const entities = governors.map((governor) => ({
  id: `gobernadores-mx-${slug(governor.state)}-${slug(governor.name)}`,
  name: governor.name,
  aliases: [governor.name],
  country: "mx",
  positions: [
    {
      cargo: governor.state === "Ciudad de México" ? "Jefa/Jefe de Gobierno" : "Gobernadora/Gobernador constitucional",
      dependencia: governor.state,
      desde: governor.periodStart,
      hasta: governor.periodEnd,
    },
  ],
  source: "gobernadores-mx",
  sourceLabel: "CONAGO",
  sourceUrl: SOURCE_URL,
  dataset: "conago-gobernadores-historicos",
  lastSeen: currentDate,
  cargoIds,
  topics: ["role.pep", "mx.gobernadores", "mx.ejecutivo-estatal"],
}))

const output = {
  schemaVersion: 1,
  sourceId: "gobernadores-mx",
  sourceLabel: "CONAGO - Gobernadores",
  sourceUrl: SOURCE_URL,
  syncedAt: SYNCED_AT,
  count: entities.length,
  coverage: {
    governors: governors.length,
    cargoIds,
  },
  notes: [
    "Snapshot de gobernadoras y gobernadores vigentes derivado del listado histórico público de CONAGO.",
    "Se consideran vigentes los mandatos cuyo rango de fechas contiene la fecha de sincronización.",
  ],
  entities: entities.sort((first, second) => first.name.localeCompare(second.name, "es")),
}

await mkdir(dirname(OUTPUT_PATH), { recursive: true })
await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`)
console.log(`Gobernadores MX sincronizado: ${entities.length} titulares -> ${OUTPUT_PATH}`)

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; plataforma-pld/1.0; +https://github.com/vicvaz074/plataforma-de-pld)",
      accept: "text/html,text/markdown,*/*",
    },
  })
  if (!response.ok) throw new Error(`No se pudo descargar ${url}: ${response.status}`)
  return response.text()
}

async function readJson(path) {
  const { readFile } = await import("node:fs/promises")
  return JSON.parse(await readFile(path, "utf8"))
}

function findGovernorCargoIds(cargos) {
  return cargos
    .filter((cargo) => {
      const name = normalize(cargo.cargo)
      const dependency = normalize(cargo.dependencia)
      return (
        (name === "GOBERNADORES" && dependency === "GOBIERNOS ESTATALES") ||
        name === "GOBERNADORES DE LOS ESTADOS" ||
        name === "JEFE DE GOBIERNO DEL DISTRITO FEDERAL"
      )
    })
    .map((cargo) => cargo.id)
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

function slug(value) {
  return normalize(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
