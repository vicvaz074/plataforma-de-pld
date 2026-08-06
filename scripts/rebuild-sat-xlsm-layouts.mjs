/**
 * Regenera los layouts XLSM a partir de las plantillas oficiales ya cacheadas
 * en `public/sat-templates/`, sin volver a descargar del SAT.
 *
 * `sync:sat:formatos` hace ambas cosas (descarga y extracción) y sigue siendo la
 * ruta para actualizar plantillas. Este script cubre el caso contrario: cuando
 * cambia el extractor y los layouts publicados quedan desfasados respecto del
 * código que los consume en "Avisos e informes".
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"

import * as satTemplateCatalog from "../lib/pld/sat-template-catalog.ts"
import * as satXlsm from "../lib/pld/sat-xlsm.ts"

const { SAT_TEMPLATE_CATALOG } = satTemplateCatalog.default || satTemplateCatalog
const { extractSatXlsmLayoutFromBuffer, serializeSatXlsmLayout } = satXlsm.default || satXlsm

function concreteTemplates() {
  const templates = new Map()
  for (const template of SAT_TEMPLATE_CATALOG) {
    if (!template.variants.length) {
      templates.set(template.templateId, template)
      continue
    }
    for (const variant of template.variants) {
      templates.set(variant.templateId, {
        ...template,
        templateId: variant.templateId,
        officialXlsmName: variant.officialXlsmName,
        sourceZipUrl: variant.sourceZipUrl,
        localPath: variant.localPath,
        actividadKeys: variant.actividadKeys,
      })
    }
  }
  return [...templates.values()]
}

function main() {
  const generatedAt = new Date().toISOString()
  const layouts = []
  const missing = []

  for (const template of concreteTemplates()) {
    const cachePath = `public${template.localPath}`
    if (!existsSync(cachePath)) {
      missing.push(`${template.templateId} (${cachePath})`)
      continue
    }
    const bytes = new Uint8Array(readFileSync(cachePath))
    const layout = extractSatXlsmLayoutFromBuffer(bytes, template)
    layouts.push(layout)
    const fields = layout.sections.reduce((total, section) => total + section.fields.length, 0)
    console.log(`✓ ${template.templateId}: ${fields} campos en ${layout.sections.length} secciones`)
  }

  if (missing.length) {
    console.error(`Faltan plantillas en caché:\n  ${missing.join("\n  ")}`)
    console.error("Ejecuta `pnpm sync:sat:formatos` para descargarlas del SAT.")
    process.exit(1)
  }

  mkdirSync("public/data/sat-xlsm-layouts", { recursive: true })
  for (const layout of layouts) {
    writeFileSync(
      `public/data/sat-xlsm-layouts/${layout.templateId}.json`,
      `${JSON.stringify(serializeSatXlsmLayout(layout))}\n`,
    )
  }

  writeFileSync(
    "public/data/sat-xlsm-layouts-mx.json",
    `${JSON.stringify(
      {
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
      },
      null,
      2,
    )}\n`,
  )

  console.log(`\nLayouts regenerados: ${layouts.length}.`)
}

main()
