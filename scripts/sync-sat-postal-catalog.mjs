import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { unzipSync } from "fflate"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")
const templatePath = path.join(
  repoRoot,
  "public/sat-templates/sat-fraccion-v-bis-desarrollo/DesarrollosInmobiliarios_v4_7.xlsm",
)
const outputPath = path.join(repoRoot, "public/data/sat-postal-catalog-mx.json")

if (!existsSync(templatePath)) {
  throw new Error(`No se encontró la plantilla SAT para extraer Combos: ${templatePath}`)
}

const normalizeText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()

const columnNameToNumber = (column) =>
  column.split("").reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0)

const parseSharedStrings = (xml) => {
  if (!xml) return []
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    match[1]
      .replace(/<t[^>]*>/g, "")
      .replace(/<\/t>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'"),
  )
}

const getCellValue = (cellXml, sharedStrings) => {
  const type = cellXml.match(/t="([^"]+)"/)?.[1]
  const rawValue = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1]
  if (rawValue == null) return ""
  if (type === "s") return sharedStrings[Number(rawValue)] ?? ""
  return rawValue
}

const zip = unzipSync(readFileSync(templatePath))
const readXml = (entry) => Buffer.from(zip[entry]).toString("utf8")
const workbookXml = readXml("xl/workbook.xml")
const relsXml = readXml("xl/_rels/workbook.xml.rels")
const sharedStrings = parseSharedStrings(zip["xl/sharedStrings.xml"] ? readXml("xl/sharedStrings.xml") : "")

const relTargets = new Map(
  [...relsXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((match) => [
    match[1],
    match[2],
  ]),
)
const comboSheet = [...workbookXml.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)]
  .map((match) => ({ name: match[1], relId: match[2] }))
  .find((sheet) => sheet.name === "Combos")

if (!comboSheet) {
  throw new Error("La plantilla SAT no contiene hoja Combos")
}

const comboTarget = relTargets.get(comboSheet.relId)
if (!comboTarget) {
  throw new Error("No se encontró la relación XML de la hoja Combos")
}

const comboPath = path.posix.join("xl", comboTarget.replace(/^\.\.\//, ""))
const comboXml = readXml(comboPath)
const postalByCode = new Map()

for (const rowMatch of comboXml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
  const rowXml = rowMatch[2]
  const cells = new Map()
  for (const cellMatch of rowXml.matchAll(/<c[^>]*r="([A-Z]+)\d+"[^>]*>[\s\S]*?<\/c>/g)) {
    cells.set(columnNameToNumber(cellMatch[1]), normalizeText(getCellValue(cellMatch[0], sharedStrings)))
  }

  const codigo = String(cells.get(14) || "").replace(/\D/g, "").padStart(5, "0")
  const estado = cells.get(15)
  const municipio = cells.get(16)
  const asentamiento = cells.get(17)

  if (!/^\d{5}$/.test(codigo) || !estado || !municipio || !asentamiento) continue

  const current =
    postalByCode.get(codigo) ??
    ({
      codigo,
      estado,
      municipio,
      ciudad: estado === "DISTRITO FEDERAL" ? "DISTRITO FEDERAL" : municipio,
      asentamientos: [],
    })

  if (!current.asentamientos.includes(asentamiento)) {
    current.asentamientos.push(asentamiento)
  }
  postalByCode.set(codigo, current)
}

const records = Array.from(postalByCode.values()).sort((a, b) => a.codigo.localeCompare(b.codigo, "es"))

if (records.length < 10000) {
  throw new Error(`El catálogo postal extraído parece incompleto: ${records.length} CP`)
}

mkdirSync(path.dirname(outputPath), { recursive: true })
writeFileSync(
  outputPath,
  JSON.stringify(
    {
      schemaVersion: 1,
      source: "SAT XLSM Combos",
      sourceTemplate: path.relative(repoRoot, templatePath),
      generatedAt: new Date().toISOString(),
      records,
    },
    null,
    2,
  ),
)

const cp11200 = postalByCode.get("11200")
const cp11280 = postalByCode.get("11280")
console.log(`Catálogo postal SAT generado: ${records.length} CP en ${path.relative(repoRoot, outputPath)}`)
console.log(`11200: ${cp11200?.estado || "N/D"} · ${cp11200?.municipio || "N/D"} · ${(cp11200?.asentamientos || []).join(", ")}`)
console.log(`11280: ${cp11280?.estado || "N/D"} · ${cp11280?.municipio || "N/D"} · ${(cp11280?.asentamientos || []).join(", ")}`)
