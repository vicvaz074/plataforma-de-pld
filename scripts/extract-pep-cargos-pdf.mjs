import { execFile } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import pepData from "../lib/pld/pep-data.ts"

const { extractPepCargoDefinitionsFromText } = pepData

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUTPUT_PATH = join(ROOT, "public", "data", "pep-cargos-pdf-2020.json")
const DEFAULT_PDF_PATH = join(ROOT, "data", "Lista_PEPS_2020.pdf")
const PDF_SOURCE_LABEL = "local://Lista_PEPS_2020.pdf"
const execFileAsync = promisify(execFile)

const pdfPath = resolve(process.env.PEP_CARGOS_PDF_PATH || process.argv[2] || DEFAULT_PDF_PATH)
const extractedAt = new Date().toISOString()

const { stdout } = await execFileAsync("pdftotext", ["-layout", pdfPath, "-"], {
  encoding: "utf8",
  maxBuffer: 1024 * 1024 * 20,
})

const cargos = extractPepCargoDefinitionsFromText(stdout, {
  sourceId: "shcp-pdf-2020",
  sourceLabel: "Lista PEP Nacional 2020 SHCP/UBVA",
  sourceUrl: PDF_SOURCE_LABEL,
  extractedAt,
})

await mkdir(dirname(OUTPUT_PATH), { recursive: true })
await writeFile(
  OUTPUT_PATH,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      sourceId: "shcp-pdf-2020",
      sourceLabel: "Lista PEP Nacional 2020 SHCP/UBVA",
      sourceUrl: PDF_SOURCE_LABEL,
      extractedAt,
      count: cargos.length,
      cargos,
    },
    null,
    2,
  )}\n`,
)

console.log(`Cargos PEP extraídos del PDF: ${cargos.length} -> ${OUTPUT_PATH}`)
