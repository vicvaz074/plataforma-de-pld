import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { unzipSync } from "fflate"

import * as satFormatos from "../lib/pld/sat-formatos.ts"
import * as satTemplateCatalog from "../lib/pld/sat-template-catalog.ts"
import * as satXlsm from "../lib/pld/sat-xlsm.ts"

const satFormatosModule = satFormatos.default || satFormatos
const satTemplateCatalogModule = satTemplateCatalog.default || satTemplateCatalog
const satXlsmModule = satXlsm.default || satXlsm
const { SAT_FORMATOS_ACTIVIDADES, buildSatFormatSnapshot } = satFormatosModule
const { SAT_TEMPLATE_CATALOG } = satTemplateCatalogModule
const { extractSatXlsmLayoutFromBuffer, serializeSatXlsmLayout } = satXlsmModule

const zipCache = new Map()

async function head(url) {
  const response = await fetch(url, { method: "HEAD" })
  if (!response.ok) {
    throw new Error(`SAT respondió ${response.status} para ${url}`)
  }
  return {
    lastModified: response.headers.get("last-modified") || undefined,
    size: Number(response.headers.get("content-length") || 0) || undefined,
  }
}

async function downloadZip(url) {
  if (zipCache.has(url)) return zipCache.get(url)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`SAT respondió ${response.status} para ${url}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  zipCache.set(url, bytes)
  return bytes
}

function listZipEntries(bytes) {
  return Object.keys(unzipSync(bytes))
}

function extractExpectedXlsm(zipBytes, expectedXlsmName) {
  const outer = unzipSync(zipBytes)
  const direct = findNamedEntry(outer, expectedXlsmName)
  if (direct) return direct

  const nestedZips = Object.entries(outer).filter(([name]) => name.toLowerCase().endsWith(".zip"))
  for (const [, nestedBytes] of nestedZips) {
    const nested = unzipSync(nestedBytes)
    const nestedMatch = findNamedEntry(nested, expectedXlsmName)
    if (nestedMatch) return nestedMatch
  }

  const firstDirect = Object.entries(outer).find(([name]) => name.toLowerCase().endsWith(".xlsm"))
  if (firstDirect) return { name: firstDirect[0], bytes: firstDirect[1] }

  for (const [, nestedBytes] of nestedZips) {
    const nested = unzipSync(nestedBytes)
    const firstNested = Object.entries(nested).find(([name]) => name.toLowerCase().endsWith(".xlsm"))
    if (firstNested) return { name: firstNested[0], bytes: firstNested[1] }
  }

  throw new Error(`No se encontró XLSM esperado: ${expectedXlsmName}`)
}

function findNamedEntry(zip, expectedXlsmName) {
  const expected = normalizeName(expectedXlsmName)
  const entry = Object.entries(zip).find(([name]) => normalizeName(name.split("/").pop() || name) === expected)
  return entry ? { name: entry[0], bytes: entry[1] } : undefined
}

function normalizeName(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

function writePublicFile(publicPath, bytes) {
  const target = join(process.cwd(), getPublicRelativePath(publicPath))
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, bytes)
  return target
}

function getPublicRelativePath(path) {
  return path.startsWith("public/") ? path : join("public", path.replace(/^\//, ""))
}

async function buildManifestItems() {
  const items = []

  for (const item of SAT_FORMATOS_ACTIVIDADES) {
    const officialUrl = item.avisoUrl || item.informeCerosUrl
    if (!officialUrl) {
      items.push(item)
      continue
    }

    const [officialMeta, zeroMeta, zipBytes] = await Promise.all([
      head(officialUrl),
      item.informeCerosUrl ? head(item.informeCerosUrl) : Promise.resolve({}),
      downloadZip(officialUrl),
    ])
    const zipEntries = listZipEntries(zipBytes)
    const directXlsm = zipEntries.find((entry) => entry.toLowerCase().endsWith(".xlsm"))
    const officialXlsmName = directXlsm || item.officialXlsmName

    items.push({
      ...item,
      officialXlsmName,
      plantillaAvisoNombre: item.plantillaAvisoNombre === item.officialXlsmName ? officialXlsmName : item.plantillaAvisoNombre,
      officialZipLastModified: officialMeta.lastModified,
      officialZipSize: officialMeta.size,
      zeroReportZipLastModified: zeroMeta.lastModified || item.zeroReportZipLastModified,
      zeroReportZipSize: zeroMeta.size || item.zeroReportZipSize,
      zipEntries,
    })
  }

  return items
}

async function cacheTemplatesAndLayouts() {
  const layouts = []
  const seenTemplateIds = new Set()
  const variants = SAT_TEMPLATE_CATALOG.flatMap((template) => {
    if (!template.variants.length) return [template]
    return template.variants.map((variant) => ({
      ...template,
      templateId: variant.templateId,
      officialXlsmName: variant.officialXlsmName,
      sourceZipUrl: variant.sourceZipUrl,
      localPath: variant.localPath,
      actividadKeys: variant.actividadKeys,
    }))
  })

  for (const template of variants) {
    if (seenTemplateIds.has(template.templateId)) continue
    seenTemplateIds.add(template.templateId)
    const zipBytes = await downloadZip(template.sourceZipUrl)
    const extracted = extractExpectedXlsm(zipBytes, template.officialXlsmName)
    writePublicFile(template.localPath, extracted.bytes)
    const layout = extractSatXlsmLayoutFromBuffer(extracted.bytes, template)
    layouts.push(layout)
    console.log(`✓ ${template.templateId}: ${extracted.name} (${layout.sections.length} secciones, ${layout.optionLists.length} listas)`)
  }

  return layouts
}

async function main() {
  const generatedAt = new Date().toISOString()
  const items = await buildManifestItems()
  const layouts = await cacheTemplatesAndLayouts()
  const snapshot = {
    ...buildSatFormatSnapshot(generatedAt),
    generatedAt,
    items,
  }
  const templateCatalog = {
    schemaVersion: 1,
    generatedAt,
    items: SAT_TEMPLATE_CATALOG,
  }
  mkdirSync("public/data/sat-xlsm-layouts", { recursive: true })
  for (const layout of layouts) {
    writeFileSync(
      `public/data/sat-xlsm-layouts/${layout.templateId}.json`,
      `${JSON.stringify(serializeSatXlsmLayout(layout))}\n`,
    )
  }
  const layoutSnapshot = {
    schemaVersion: 1,
    generatedAt,
    source: "Plantillas oficiales SAT de Actividades Vulnerables cacheadas localmente",
    layouts: layouts.map((layout) => ({
      templateId: layout.templateId,
      officialXlsmName: layout.officialXlsmName,
      generatedAt: layout.generatedAt,
      workbookHasMacros: layout.workbookHasMacros,
      sectionCount: layout.sections.length,
      optionListCount: layout.optionLists.length,
      source: layout.source,
      path: `/data/sat-xlsm-layouts/${layout.templateId}.json`,
    })),
  }

  mkdirSync("public/data", { recursive: true })
  writeFileSync("public/data/sat-formatos-mx.json", `${JSON.stringify(snapshot, null, 2)}\n`)
  writeFileSync("public/data/sat-template-catalog-mx.json", `${JSON.stringify(templateCatalog, null, 2)}\n`)
  writeFileSync("public/data/sat-xlsm-layouts-mx.json", `${JSON.stringify(layoutSnapshot, null, 2)}\n`)

  rmSync(".sat-formatos-tmp", { recursive: true, force: true })
  console.log(`Snapshot SAT actualizado con ${items.length} formatos y ${layouts.length} layouts XLSM.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
