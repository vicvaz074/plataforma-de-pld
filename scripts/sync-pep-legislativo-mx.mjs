import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { parseDiputadosMembers, parseSenadoMembers } from "./pep-legislativo-utils.mjs"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUTPUT_PATH = join(ROOT, "public", "data", "pep-legislativo-mx.json")
const CARGOS_PATH = join(ROOT, "public", "data", "pep-cargos-mx.json")
const SYNCED_AT = new Date().toISOString()

const DIPUTADOS_BASE_URL = "https://sitl.diputados.gob.mx/LXVI_leg/listado_diputados_gpnp.php"
const DIPUTADOS_SOURCE_URL = "https://sitl.diputados.gob.mx/LXVI_leg/info_diputados.php"
const SENADO_SOURCE_URL = "https://www.senado.gob.mx/66/senadores/directorio_de_senadores"
const SENADO_READER_URL = "https://r.jina.ai/http://www.senado.gob.mx/66/senadores/directorio_de_senadores"

const cargosSnapshot = await readJson(CARGOS_PATH)
const cargos = cargosSnapshot.cargos ?? []
const cargoIds = {
  diputados: findCargoIds(cargos, ["DIPUTADOS", "DIPUTADOS FEDERALES", "PLENO DE LA CÁMARA DE DIPUTADOS"]),
  senadores: findCargoIds(cargos, ["SENADORES", "SENADORES DE LA REPÚBLICA"]),
}

const [senadoContent, diputadosContent] = await Promise.all([fetchText(SENADO_READER_URL), fetchDiputadosAlphabet()])
const senadores = parseSenadoMembers(senadoContent)
const diputados = parseDiputadosMembers(diputadosContent)

const entities = [
  ...senadores.map((member) =>
    toEntity(member.name, {
      idPrefix: "senado",
      cargo: "Senadora/Senador de la República",
      dependencia: "Senado de la República",
      sourceUrl: SENADO_SOURCE_URL,
      cargoIds: cargoIds.senadores,
      topics: ["role.pep", "mx.legislativo", "mx.senado"],
    }),
  ),
  ...diputados.map((member) =>
    toEntity(member.name, {
      idPrefix: "diputados",
      cargo: "Diputada/Diputado federal",
      dependencia: "Cámara de Diputados",
      sourceUrl: DIPUTADOS_SOURCE_URL,
      cargoIds: cargoIds.diputados,
      topics: ["role.pep", "mx.legislativo", "mx.diputados"],
    }),
  ),
]

const output = {
  schemaVersion: 1,
  sourceId: "legislativo-mx",
  sourceLabel: "Congreso de la Unión",
  sourceUrl: "https://www.congreso.gob.mx/",
  syncedAt: SYNCED_AT,
  count: entities.length,
  coverage: {
    diputados: diputados.length,
    senadores: senadores.length,
    cargoIds,
  },
  notes: [
    "Snapshot generado desde listados públicos de la LXVI Legislatura de Cámara de Diputados y Senado.",
    "Senado se descarga por lector de página cuando el sitio oficial bloquea clientes automatizados; la fuente jurídica de referencia sigue siendo senado.gob.mx.",
    "No incluye candidatos ni cargos administrativos del Congreso; esos cargos permanecen en revisión manual si no existe fuente nominal confiable cargada.",
  ],
  entities: entities.sort((first, second) => first.name.localeCompare(second.name, "es")),
}

await mkdir(dirname(OUTPUT_PATH), { recursive: true })
await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`)
console.log(`Legislativo MX sincronizado: ${diputados.length} diputados, ${senadores.length} senadores -> ${OUTPUT_PATH}`)

async function fetchDiputadosAlphabet() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
  const pages = await Promise.all(
    letters.map(async (letter) => {
      const url = `${DIPUTADOS_BASE_URL}?tipot=${letter}`
      const html = await fetchText(url)
      return `\n<!-- ${url} -->\n${html}`
    }),
  )
  return pages.join("\n")
}

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

function findCargoIds(cargos, names) {
  const normalizedNames = names.map(normalize)
  return cargos
    .filter((cargo) => normalizedNames.includes(normalize(cargo.cargo)) && /CONGRESO|LEGISLATIVO/i.test(cargo.dependencia))
    .map((cargo) => cargo.id)
}

function toEntity(name, options) {
  return {
    id: `legislativo-mx-${options.idPrefix}-${slug(name)}`,
    name,
    aliases: [name],
    country: "mx",
    positions: [
      {
        cargo: options.cargo,
        dependencia: options.dependencia,
        desde: "2024-09-01",
      },
    ],
    source: "legislativo-mx",
    sourceLabel: options.dependencia,
    sourceUrl: options.sourceUrl,
    dataset: "congreso-lxvi",
    lastSeen: SYNCED_AT.slice(0, 10),
    cargoIds: options.cargoIds,
    topics: options.topics,
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

function slug(value) {
  return normalize(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
