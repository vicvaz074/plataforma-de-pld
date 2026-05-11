import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import pepData from "../lib/pld/pep-data.ts"

const { buildPepCoverageReport } = pepData

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DATA_DIR = join(ROOT, "public", "data")
const MIN_CARGOS = Number.parseInt(process.env.PEP_MIN_CARGOS || "330", 10)
const MIN_RESOLVED_COVERAGE = Number.parseFloat(process.env.PEP_MIN_RESOLVED_COVERAGE || "0.005")
const now = new Date().toISOString()

const cargosSnapshot = await readRequiredJson(join(DATA_DIR, "pep-cargos-mx.json"))
const personasSnapshot = await readRequiredJson(join(DATA_DIR, "pep-personas-mx.json"))
const sourcesSnapshot = await readRequiredJson(join(DATA_DIR, "pep-sources-mx.json"))
const cargos = cargosSnapshot.cargos ?? []
const personas = personasSnapshot.personas ?? []
const sources = sourcesSnapshot.sources ?? []
const coverage = buildPepCoverageReport({ cargos, personas, sources, now })
const resolvedCoverage = coverage.totalCargos ? coverage.cargosConTitular / coverage.totalCargos : 0
const errors = []

if (cargos.length < MIN_CARGOS) {
  errors.push(`Catálogo PEP insuficiente: ${cargos.length} cargos; mínimo esperado ${MIN_CARGOS}.`)
}

if (!personas.some((person) => normalize(person.name) === "MARCELO EBRARD CASAUBON")) {
  errors.push("No se encontró a Marcelo Ebrard Casaubón en pep-personas-mx.json.")
}

if (!personas.some((person) => normalize(person.name) === "ALBERTO MENDOZA DIAZ")) {
  errors.push("No se encontró a Alberto Mendoza Díaz en pep-personas-mx.json.")
}

if (coverage.staleSources.length > 0) {
  errors.push(`Fuentes vencidas: ${coverage.staleSources.map((source) => source.sourceId).join(", ")}.`)
}

if (resolvedCoverage < MIN_RESOLVED_COVERAGE) {
  errors.push(`Cobertura nominal baja: ${(resolvedCoverage * 100).toFixed(2)}%; mínimo ${(MIN_RESOLVED_COVERAGE * 100).toFixed(2)}%.`)
}

if (errors.length > 0) {
  console.error("Validación PEP falló:")
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(
  `Validación PEP OK: ${cargos.length} cargos, ${personas.length} personas, ${(resolvedCoverage * 100).toFixed(2)}% cargos con titular resuelto, ${coverage.reviewQueue.length} pendientes.`,
)

async function readRequiredJson(path) {
  if (!existsSync(path)) {
    throw new Error(`No existe ${path}. Ejecuta sync:pep:cargos y sync:pep:personas.`)
  }
  return JSON.parse(await readFile(path, "utf8"))
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
