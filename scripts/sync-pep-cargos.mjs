import { execFile } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const SOURCE_URL =
  "https://www.secciones.hacienda.gob.mx/work/models/SHCP/UIF/cargos_publicos_politicamente_expuestos.csv"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUTPUT_PATH = join(ROOT, "public", "data", "pep-cargos-mx.json")
const execFileAsync = promisify(execFile)

const bytes = await downloadSource(SOURCE_URL)
const csv = bytes.toString("latin1")
const rows = parseCsv(csv)
const [headers, ...records] = rows
const cargos = records
  .filter((row) => row.length >= 4)
  .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])))
  .map((row) => ({
    tipoAdministracionPublica: row.tipo_administracion_publica,
    entidadAdministracionPublica: row.entidad_administracion_publica,
    dependencia: row.dependencia,
    cargo: row.cargo,
  }))

await mkdir(dirname(OUTPUT_PATH), { recursive: true })
await writeFile(
  OUTPUT_PATH,
  `${JSON.stringify(
    {
      sourceUrl: SOURCE_URL,
      syncedAt: new Date().toISOString(),
      count: cargos.length,
      cargos,
    },
    null,
    2,
  )}\n`,
)

console.log(`Catalogo PEP sincronizado: ${cargos.length} cargos -> ${OUTPUT_PATH}`)

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
