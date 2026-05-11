import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import pepData from "../lib/pld/pep-data.ts"

const { extractPepCargoDefinitionsFromText, mergePepCargoDefinitions } = pepData

const SOURCE_URL =
  "https://www.secciones.hacienda.gob.mx/work/models/SHCP/UIF/cargos_publicos_politicamente_expuestos.csv"
const CNBV_SOURCE_URL = "https://www.gob.mx/cnbv/documentos/personas-politicamente-expuestas-nacionales"
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUTPUT_PATH = join(ROOT, "public", "data", "pep-cargos-mx.json")
const DEFAULT_PDF_PATH = join(ROOT, "data", "Lista_PEPS_2020.pdf")
const PDF_SOURCE_LABEL = "local://Lista_PEPS_2020.pdf"
const execFileAsync = promisify(execFile)
const syncedAt = new Date().toISOString()

const bytes = await downloadSource(SOURCE_URL)
const csv = bytes.toString("latin1")
const rows = parseCsv(csv)
const [headers, ...records] = rows
const csvCargos = records
  .filter((row) => row.length >= 4)
  .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])))
  .map((row) => ({
    tipoAdministracionPublica: row.tipo_administracion_publica,
    entidadAdministracionPublica: row.entidad_administracion_publica,
    dependencia: row.dependencia,
    cargo: row.cargo,
  }))

const pdfPath = resolve(process.env.PEP_CARGOS_PDF_PATH || process.argv[2] || DEFAULT_PDF_PATH)
const pdfCargos = existsSync(pdfPath) ? await extractPdfCargos(pdfPath, syncedAt) : []
const cargos = mergePepCargoDefinitions({ csvCargos, pdfCargos, syncedAt })

await mkdir(dirname(OUTPUT_PATH), { recursive: true })
await writeFile(
  OUTPUT_PATH,
  `${JSON.stringify(
    {
      schemaVersion: 2,
      sourceUrl: SOURCE_URL,
      sourceUrls: [SOURCE_URL, CNBV_SOURCE_URL, ...(pdfCargos.length ? [PDF_SOURCE_LABEL] : [])],
      syncedAt,
      count: cargos.length,
      sourceCounts: {
        csv: csvCargos.length,
        pdf: pdfCargos.length,
      },
      notes: [
        "Catálogo canónico local-first. SHCP/UIF CSV es la fuente primaria; el PDF 2020 ayuda a mapear taxonomía y cargos no nominales.",
        "Este archivo contiene cargos PEP, no valida por sí mismo al titular nominal vigente.",
        ...(pdfCargos.length ? [] : ["No se encontró PDF local; ejecuta con PEP_CARGOS_PDF_PATH para enriquecer taxonomía."]),
      ],
      cargos,
    },
    null,
    2,
  )}\n`,
)

console.log(`Catálogo PEP sincronizado: ${cargos.length} cargos (${csvCargos.length} CSV, ${pdfCargos.length} PDF) -> ${OUTPUT_PATH}`)

async function extractPdfCargos(pdfPath, extractedAt) {
  const { stdout } = await execFileAsync("pdftotext", ["-layout", pdfPath, "-"], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
  })

  return extractPepCargoDefinitionsFromText(stdout, {
    sourceId: "shcp-pdf-2020",
    sourceLabel: "Lista PEP Nacional 2020 SHCP/UBVA",
    sourceUrl: PDF_SOURCE_LABEL,
    extractedAt,
  })
}

function parseCsv(input) {
  const rows = []
  let row = []
  let field = ""
  let quoted = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    const next = input[index + 1]

    if (char === '"' && quoted && next === '"') {
      field += '"'
      index += 1
      continue
    }

    if (char === '"') {
      quoted = !quoted
      continue
    }

    if (char === "," && !quoted) {
      row.push(field)
      field = ""
      continue
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1
      }
      row.push(field)
      if (row.some((value) => value.trim().length > 0)) {
        rows.push(row)
      }
      row = []
      field = ""
      continue
    }

    field += char
  }

  if (field || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

async function downloadSource(url) {
  try {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return Buffer.from(await response.arrayBuffer())
  } catch (error) {
    const { stdout } = await execFileAsync("curl", ["-L", "-s", url], {
      encoding: "buffer",
      maxBuffer: 1024 * 1024 * 10,
    })

    if (!stdout.length) {
      throw error
    }

    return Buffer.from(stdout)
  }
}
