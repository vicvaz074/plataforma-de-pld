import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

import {
  buildSatDynamicOperationForm,
  extractSatXlsmLayoutFromBuffer,
  getSatTemplateCachePath,
  hydrateSatXlsmLayout,
  isSatSyntheticControlFieldId,
  isSatXlsmFieldActive,
  isSatXlsmFieldRequired,
  normalizeSatXlsmLayout,
  resolveSatTemplateForActividad,
  serializeSatXlsmLayout,
  PERSONA_OBJETO_DOMICILIO_FIELD_ID,
  PERSONA_OBJETO_TYPE_FIELD_ID,
  SAT_TEMPLATE_CATALOG,
} from "../lib/pld"
import {
  evaluateExpedientePmDocumentChecklist,
  getExpedienteDocumentsForScope,
} from "../lib/pld/expediente-document-checklist"
import { buildStructuredSheetFields } from "../lib/pld/sat-xlsm-structure"
import type { SatTemplateCatalogItem, SatXlsmField, SatXlsmLayout } from "../lib/pld/types"

function concreteTemplates(): SatTemplateCatalogItem[] {
  const templates = new Map<string, SatTemplateCatalogItem>()
  for (const item of SAT_TEMPLATE_CATALOG) {
    if (!item.variants.length) {
      templates.set(item.templateId, item)
      continue
    }
    for (const variant of item.variants) {
      templates.set(variant.templateId, {
        ...item,
        templateId: variant.templateId,
        officialXlsmName: variant.officialXlsmName,
        localPath: variant.localPath,
      })
    }
  }
  return [...templates.values()]
}

const layoutCache = new Map<string, SatXlsmLayout>()

function layoutFor(templateId: string): SatXlsmLayout {
  const cached = layoutCache.get(templateId)
  if (cached) return cached

  const template = concreteTemplates().find((item) => item.templateId === templateId)
  assert.ok(template, `plantilla no registrada: ${templateId}`)
  const path = getSatTemplateCachePath(template)
  assert.ok(existsSync(path), `falta la plantilla oficial en caché: ${path}`)
  const layout = normalizeSatXlsmLayout(
    extractSatXlsmLayoutFromBuffer(new Uint8Array(readFileSync(path)), template),
  )
  layoutCache.set(templateId, layout)
  return layout
}

function fieldsOf(templateId: string, sheetName: string): SatXlsmField[] {
  const section = layoutFor(templateId).sections.find((item) => item.sheetName === sheetName)
  assert.ok(section, `${templateId} no expone la hoja ${sheetName}`)
  return section.fields
}

function fieldAt(templateId: string, sheetName: string, cell: string): SatXlsmField {
  const field = fieldsOf(templateId, sheetName).find((item) => item.cell === cell)
  assert.ok(field, `${templateId}/${sheetName} no mapea la celda ${cell}`)
  return field
}

test("cada celda capturable proviene de la rejilla oficial y no de un rótulo contiguo", () => {
  // El Anexo 1 ordena la persona objeto en tablas: los encabezados viven en el
  // renglón 18 y la captura empieza en el 19. Tomar la celda a la derecha del
  // rótulo, como hacía la extracción por etiquetas, desplazaba cada columna.
  const persona = fieldsOf("sat-fraccion-i-juegos", "Persona Objeto del aviso")

  assert.equal(fieldAt("sat-fraccion-i-juegos", "Persona Objeto del aviso", "B19").label, "Nombre(s)")
  assert.equal(fieldAt("sat-fraccion-i-juegos", "Persona Objeto del aviso", "C19").label, "Apellido Paterno")
  assert.equal(fieldAt("sat-fraccion-i-juegos", "Persona Objeto del aviso", "G19").label, "CURP")
  assert.equal(fieldAt("sat-fraccion-i-juegos", "Persona Objeto del aviso", "E19").dataType, "fecha")

  // El renglón de encabezados nunca debe convertirse en captura.
  assert.equal(persona.some((field) => field.cell.endsWith("18")), false)
})

test("los datos generales del aviso se capturan a la derecha de su rótulo", () => {
  const rfc = fieldAt("sat-fraccion-i-juegos", "Persona Objeto del aviso", "C4")
  const periodo = fieldAt("sat-fraccion-i-juegos", "Persona Objeto del aviso", "C5")
  const alerta = fieldAt("sat-fraccion-i-juegos", "Persona Objeto del aviso", "C7")

  assert.equal(rfc.label, "RFC")
  assert.equal(rfc.required, true)
  assert.equal(rfc.maxLength, 12)
  assert.equal(periodo.label, "Periodo (AAAAMM)")
  assert.equal(periodo.maxLength, 6)
  assert.equal(alerta.dataType, "catalogo")
  assert.equal(alerta.optionListId, "Alertas")
})

test("solo el primer renglón de una tabla repetible hereda la obligatoriedad", () => {
  const primera = fieldAt("sat-fraccion-i-juegos", "Persona Objeto del aviso", "B19")
  const segunda = fieldAt("sat-fraccion-i-juegos", "Persona Objeto del aviso", "B20")

  assert.equal(primera.required, true)
  assert.equal(primera.repeatIndex, 1)
  assert.equal(segunda.required, false)
  assert.equal(segunda.repeatIndex, 2)
  assert.equal(segunda.repeatGroup, primera.repeatGroup)

  // La plantilla numera diez renglones: la validación se extiende dos más, pero
  // el bloque debe respetar la numeración oficial.
  assert.equal(primera.repeatLimit, 10)
  const bloque = fieldsOf("sat-fraccion-i-juegos", "Persona Objeto del aviso").filter(
    (field) => field.repeatGroup === primera.repeatGroup,
  )
  assert.equal(Math.max(...bloque.map((field) => field.repeatIndex ?? 1)), 10)
})

test("la descripción libre solo aplica al elegir la opción Otro del catálogo", () => {
  const tipoBien = fieldAt("sat-fraccion-i-juegos", "Acto u operación", "D50")
  const descripcion = fieldAt("sat-fraccion-i-juegos", "Acto u operación", "J50")

  assert.equal(tipoBien.label, "Tipo de bien")
  assert.ok(tipoBien.options?.includes("99,Otro (Especificar)"))

  assert.deepEqual(descripcion.activeWhen, [{ fieldId: tipoBien.id, equals: ["99"] }])
  assert.equal(descripcion.required, false)
  assert.equal(isSatXlsmFieldActive(descripcion, {}), false)
  assert.equal(isSatXlsmFieldActive(descripcion, { [tipoBien.id]: "99,Otro (Especificar)" }), true)
  assert.equal(isSatXlsmFieldRequired(descripcion, { [tipoBien.id]: "99,Otro (Especificar)" }), true)
  assert.equal(isSatXlsmFieldRequired(descripcion, { [tipoBien.id]: "1,Inmueble" }), false)
})

test("las columnas de inmueble solo aplican cuando el bien declarado es un inmueble", () => {
  const tipoBien = fieldAt("sat-fraccion-i-juegos", "Acto u operación", "D50")
  const tipoInmueble = fieldAt("sat-fraccion-i-juegos", "Acto u operación", "E50")
  const folioReal = fieldAt("sat-fraccion-i-juegos", "Acto u operación", "I50")

  for (const field of [tipoInmueble, folioReal]) {
    assert.deepEqual(field.activeWhen, [{ fieldId: tipoBien.id, equals: ["1"] }])
    assert.equal(isSatXlsmFieldActive(field, { [tipoBien.id]: "1,Inmueble" }), true)
    assert.equal(isSatXlsmFieldActive(field, { [tipoBien.id]: "99,Otro (Especificar)" }), false)
  }
})

test("cada renglón repetido se condiciona con su propio catálogo, no con el del primero", () => {
  const primero = fieldAt("sat-fraccion-i-juegos", "Acto u operación", "D50")
  const segundo = fieldAt("sat-fraccion-i-juegos", "Acto u operación", "D51")
  const descripcionSegunda = fieldAt("sat-fraccion-i-juegos", "Acto u operación", "J51")

  assert.notEqual(primero.id, segundo.id)
  assert.deepEqual(descripcionSegunda.activeWhen, [{ fieldId: segundo.id, equals: ["99"] }])
})

test("el encabezado de grupo Otro condiciona su columna aunque sea la única variante", () => {
  // Anexo 4: el renglón 9 rotula "Otro" sobre la columna I y el resto es una
  // nota al capturista, así que manda el catálogo de tipo de garantía.
  const tipoGarantia = fieldAt("sat-fraccion-iv-prestamos", "Acto u operación", "B11")
  const descripcion = fieldAt("sat-fraccion-iv-prestamos", "Acto u operación", "I11")

  assert.equal(tipoGarantia.label, "Tipo de garantía")
  assert.deepEqual(descripcion.activeWhen, [{ fieldId: tipoGarantia.id, equals: ["99"] }])
})

test("una tabla sin validaciones en sus renglones se completa desde el encabezado", () => {
  // El Anexo 4 dejó la validación sobre el encabezado de liquidación (E172) en
  // lugar de sus renglones; la tabla se reconoce por la numeración 1..N.
  const liquidacion = fieldsOf("sat-fraccion-iv-prestamos", "Acto u operación")

  assert.equal(liquidacion.some((field) => field.cell === "E172"), false)
  assert.equal(fieldAt("sat-fraccion-iv-prestamos", "Acto u operación", "B173").label, "Fecha de Disposición")
  assert.equal(fieldAt("sat-fraccion-iv-prestamos", "Acto u operación", "C173").label, "Instrumento monetario")
  assert.equal(fieldAt("sat-fraccion-iv-prestamos", "Acto u operación", "E173").dataType, "moneda")
})

test("una validación huérfana sobre un renglón separador no genera campos", () => {
  // El Anexo 4 conserva validaciones sobre el renglón 8, que es un separador
  // sin encabezado propio; heredar el rótulo del renglón 7 inventaba campos.
  const acto = fieldsOf("sat-fraccion-iv-prestamos", "Acto u operación")

  assert.equal(acto.some((field) => /^[A-Z]+8$/.test(field.cell)), false)
  assert.equal(fieldAt("sat-fraccion-iv-prestamos", "Acto u operación", "C7").label, "Tipo de Operación")
})

test("las fichas repetidas del Anexo 16 distinguen sus renglones por el rótulo lateral", () => {
  const intercambios = fieldsOf("sat-fraccion-xvi-activos-virtuales", "Intercambios")
  const enviado = fieldAt("sat-fraccion-xvi-activos-virtuales", "Intercambios", "D9")
  const recibido = fieldAt("sat-fraccion-xvi-activos-virtuales", "Intercambios", "D10")

  assert.equal(enviado.label, "ENVIADO · Nombre")
  assert.equal(recibido.label, "RECIBIDO · Nombre")
  assert.equal(enviado.required, true)
  assert.equal(recibido.required, true)

  // La segunda ficha empieza en el renglón 12: mismo rótulo, otra repetición.
  const segundaFicha = fieldAt("sat-fraccion-xvi-activos-virtuales", "Intercambios", "D12")
  assert.equal(segundaFicha.label, "ENVIADO · Nombre")
  assert.equal(segundaFicha.repeatIndex, 2)
  assert.equal(segundaFicha.required, false)
  assert.equal(intercambios.filter((field) => field.required).length < 20, true)
})

test("la descripción de otro activo virtual se ata al catálogo de activos", () => {
  const nombre = fieldAt("sat-fraccion-xvi-activos-virtuales", "Compras", "C9")
  const descripcion = fieldAt("sat-fraccion-xvi-activos-virtuales", "Compras", "F9")

  assert.equal(nombre.dataType, "catalogo")
  assert.deepEqual(descripcion.activeWhen, [{ fieldId: nombre.id, equals: ["999999"] }])
})

test("los mapas manuales del SAT siguen mandando sobre la extracción estructural", () => {
  const arrendamiento = fieldsOf("sat-fraccion-xv-arrendamiento", "Acto u operación")
  const inmueble = arrendamiento.find((field) => field.id === "inmueble.tipo_bien")

  assert.ok(inmueble, "el mapa manual del Anexo 15 debe conservarse")
  assert.equal(inmueble.cell, "B12")
  assert.equal(inmueble.source, "manual-sat-map")
  // Una sola definición por celda: el mapa manual desplaza a la estructural.
  assert.equal(arrendamiento.filter((field) => field.cell === "B12").length, 1)
})

test("ninguna plantilla oficial produce campos duplicados ni rótulos vacíos", () => {
  const failures: string[] = []

  for (const template of concreteTemplates()) {
    const path = getSatTemplateCachePath(template)
    if (!existsSync(path)) {
      failures.push(`${template.templateId}: falta la plantilla en caché`)
      continue
    }
    const layout = layoutFor(template.templateId)
    const fields = layout.sections.flatMap((section) => section.fields)

    if (!fields.length) failures.push(`${template.templateId}: no extrajo campos`)

    const byCell = new Set<string>()
    const byId = new Set<string>()
    for (const field of fields) {
      const cellKey = `${field.sheetName}!${field.cell}`
      if (byCell.has(cellKey)) failures.push(`${template.templateId}: celda duplicada ${cellKey}`)
      byCell.add(cellKey)
      if (byId.has(field.id)) failures.push(`${template.templateId}: id duplicado ${field.id}`)
      byId.add(field.id)
      if (!field.label.trim()) failures.push(`${template.templateId}: campo sin rótulo en ${cellKey}`)
      if (field.label.includes("*")) failures.push(`${template.templateId}: rótulo con asterisco en ${cellKey}`)
    }
  }

  assert.deepEqual(failures, [])
})

test("toda condición apunta a un campo existente o a un control declarado", () => {
  const failures: string[] = []

  for (const template of concreteTemplates()) {
    if (!existsSync(getSatTemplateCachePath(template))) continue
    const fields = layoutFor(template.templateId).sections.flatMap((section) => section.fields)
    const ids = new Set(fields.map((field) => field.id))

    for (const field of fields) {
      for (const condition of [...(field.activeWhen ?? []), ...(field.requiredWhen ?? [])]) {
        if (ids.has(condition.fieldId) || isSatSyntheticControlFieldId(condition.fieldId)) continue
        failures.push(`${template.templateId}: ${field.id} depende de ${condition.fieldId} inexistente`)
      }
    }
  }

  assert.deepEqual(failures, [])
})

test("los obligatorios de cada plantilla se concentran en la primera repetición", () => {
  const failures: string[] = []

  for (const template of concreteTemplates()) {
    if (!existsSync(getSatTemplateCachePath(template))) continue
    const fields = layoutFor(template.templateId).sections.flatMap((section) => section.fields)
    const required = fields.filter((field) => field.required)

    const fueraDePrimera = required.filter((field) => (field.repeatIndex ?? 1) !== 1)
    if (fueraDePrimera.length) {
      failures.push(`${template.templateId}: ${fueraDePrimera.length} obligatorios fuera de la primera repetición`)
    }
    // Un formato del SAT pide decenas de datos, no cientos: un conteo alto
    // delata renglones repetidos marcados como obligatorios.
    if (required.length > 130) {
      failures.push(`${template.templateId}: ${required.length} obligatorios es implausible`)
    }
  }

  assert.deepEqual(failures, [])
})

test("una hoja sin validaciones ni numeración no inventa campos", () => {
  const fields = buildStructuredSheetFields({
    sheetName: "Instrucciones",
    cells: { A1: "Guía de llenado", B3: "* Este texto no es un campo" },
    validations: [],
    optionLists: [],
  })

  assert.deepEqual(fields, [])
})

test("la extracción reconoce una tabla mínima con encabezado y numeración", () => {
  const fields = buildStructuredSheetFields({
    sheetName: "Captura",
    cells: {
      B3: "* Nombre",
      C3: "Fecha",
      A4: "1",
      A5: "2",
    },
    validations: [
      { type: "textLength", operator: "lessThanOrEqual", sqref: ["B4:B5"], formula1: "200" },
      { type: "date", sqref: ["C4:C5"], formula1: "1/1/1900" },
    ],
    optionLists: [],
  })

  assert.deepEqual(
    fields.map((field) => [field.cell, field.label, field.dataType, field.required, field.repeatIndex]),
    [
      ["B4", "Nombre", "texto", true, 1],
      ["B5", "Nombre", "texto", false, 2],
      ["C4", "Fecha", "fecha", false, 1],
      ["C5", "Fecha", "fecha", false, 2],
    ],
  )
  assert.equal(fields[0].maxLength, 200)
})

test("el layout publicado coincide con lo que produce el extractor vigente", () => {
  // "Avisos e informes" no vuelve a leer el XLSM al descargar: usa el JSON de
  // `public/data/sat-xlsm-layouts`. Si queda desfasado, el Excel se rellena con
  // el mapa de celdas anterior. Regenerar con `pnpm sync:sat:layouts`.
  const failures: string[] = []

  for (const template of concreteTemplates()) {
    if (!existsSync(getSatTemplateCachePath(template))) continue
    const publishedPath = `public/data/sat-xlsm-layouts/${template.templateId}.json`
    if (!existsSync(publishedPath)) {
      failures.push(`${template.templateId}: falta el layout publicado`)
      continue
    }

    const published = JSON.parse(readFileSync(publishedPath, "utf8")) as SatXlsmLayout
    const current = extractSatXlsmLayoutFromBuffer(
      new Uint8Array(readFileSync(getSatTemplateCachePath(template))),
      template,
    )

    const cellsOf = (layout: SatXlsmLayout) =>
      layout.sections
        .flatMap((section) => section.fields.map((field) => `${field.sheetName}!${field.cell}=${field.id}`))
        .sort()

    const publishedCells = cellsOf(published)
    const currentCells = cellsOf(serializeSatXlsmLayout(current))
    if (publishedCells.length !== currentCells.length) {
      failures.push(
        `${template.templateId}: layout publicado con ${publishedCells.length} campos contra ${currentCells.length} vigentes`,
      )
      continue
    }
    const desviado = publishedCells.find((cell, index) => cell !== currentCells[index])
    if (desviado) failures.push(`${template.templateId}: ${desviado} no coincide con el extractor`)
  }

  assert.deepEqual(failures, [])
})

test("el layout publicado repone sus catálogos al hidratarse", () => {
  const published = JSON.parse(
    readFileSync("public/data/sat-xlsm-layouts/sat-fraccion-i-juegos.json", "utf8"),
  ) as SatXlsmLayout
  const alertaPublicada = published.sections
    .flatMap((section) => section.fields)
    .find((field) => field.cell === "C7")

  // El JSON no arrastra las opciones: las resuelve por catálogo.
  assert.equal(alertaPublicada?.optionListId, "Alertas")
  assert.equal(alertaPublicada?.options, undefined)

  const alertaHidratada = hydrateSatXlsmLayout(published)
    .sections.flatMap((section) => section.fields)
    .find((field) => field.cell === "C7")

  assert.ok((alertaHidratada?.options?.length ?? 0) > 10)
  assert.ok(alertaHidratada?.options?.includes("9999,Otra alerta."))
})

test("el layout publicado no arrastra las tablas auxiliares de código postal", () => {
  const published = JSON.parse(
    readFileSync("public/data/sat-xlsm-layouts/sat-fraccion-xi-e-escision.json", "utf8"),
  ) as SatXlsmLayout

  assert.equal(
    published.optionLists.some((list) => list.id.startsWith("TABLA_AUX_BUSQUEDA")),
    false,
  )
  // Los catálogos que sí usa la captura siguen presentes.
  assert.ok(published.optionLists.some((list) => list.id === "CATALOGO_DE_PAISES"))
})

test("la actividad vulnerable resuelve la plantilla y el layout que le corresponden", () => {
  const failures: string[] = []
  const actividades = new Set(SAT_TEMPLATE_CATALOG.flatMap((item) => item.actividadKeys))

  for (const actividadKey of actividades) {
    const template = resolveSatTemplateForActividad(actividadKey)
    if (!existsSync(getSatTemplateCachePath(template))) {
      failures.push(`${actividadKey}: sin plantilla en caché (${template.templateId})`)
      continue
    }
    const fields = layoutFor(template.templateId).sections.flatMap((section) => section.fields)
    if (!fields.length) failures.push(`${actividadKey}: la plantilla ${template.templateId} no expone campos`)
  }

  assert.deepEqual(failures, [])
})

test("un fideicomiso sólo llena las columnas del fideicomiso, no las de persona moral", () => {
  // El Anexo pone en el mismo renglón las columnas de persona moral y las del
  // fideicomiso. Son excluyentes: declarar la figura decide cuáles se escriben.
  const template = resolveSatTemplateForActividad("fraccion-xi-a-inmuebles")
  const layout = layoutFor(template.templateId)
  const form = buildSatDynamicOperationForm({
    template,
    layout,
    prefill: {
      clienteTipoPersona: "fideicomiso",
      clienteRazonSocial: "FIDEICOMISO F/12345",
      clienteRfc: "FID160101AB1",
      clientePais: "MEXICO,MX",
      fideicomisoFiduciarioDenominacion: "BANCO FIDUCIARIO SA",
      fideicomisoFiduciarioRfc: "BFI900101AA1",
      fideicomisoIdentificador: "F/12345",
    },
  })
  const fields = form.sections.flatMap((section) => section.fields)
  const valueAt = (cell: string) =>
    form.initialValues[fields.find((field) => field.cell === cell && field.sheetName.includes("Persona Objeto"))?.id ?? ""]

  assert.equal(form.initialValues[PERSONA_OBJETO_TYPE_FIELD_ID], "fideicomiso")
  assert.equal(valueAt("G37"), "BANCO FIDUCIARIO SA")
  assert.equal(valueAt("H37"), "BFI900101AA1")
  assert.equal(valueAt("I37"), "F/12345")

  // Las columnas de persona moral quedan intactas.
  for (const cell of ["B37", "C37", "D37", "E37", "F37"]) {
    assert.equal(valueAt(cell), undefined, `${cell} no debe llenarse para un fideicomiso`)
  }
})

test("una persona moral no arrastra las columnas del fiduciario", () => {
  const template = resolveSatTemplateForActividad("fraccion-xi-a-inmuebles")
  const layout = layoutFor(template.templateId)
  const form = buildSatDynamicOperationForm({
    template,
    layout,
    prefill: {
      clienteTipoPersona: "persona_moral",
      clienteRazonSocial: "LOGISALL MEXICO S DE RL DE CV",
      clienteRfc: "LME161125GY9",
      clientePais: "MEXICO,MX",
    },
  })
  const fields = form.sections.flatMap((section) => section.fields)
  const valueAt = (cell: string) =>
    form.initialValues[fields.find((field) => field.cell === cell && field.sheetName.includes("Persona Objeto"))?.id ?? ""]

  assert.equal(valueAt("B37"), "LOGISALL MEXICO S DE RL DE CV")
  assert.equal(valueAt("D37"), "LME161125GY9")
  for (const cell of ["G37", "H37", "I37"]) {
    assert.equal(valueAt(cell), undefined, `${cell} es del fideicomiso y no aplica a una persona moral`)
  }
})

test("la figura del cliente se deduce cuando el expediente no la declara", () => {
  const template = resolveSatTemplateForActividad("fraccion-xi-a-inmuebles")
  const layout = layoutFor(template.templateId)
  const porFiduciario = buildSatDynamicOperationForm({
    template,
    layout,
    prefill: { fideicomisoFiduciarioDenominacion: "BANCO FIDUCIARIO SA" },
  })
  const porRazonSocial = buildSatDynamicOperationForm({
    template,
    layout,
    prefill: { clienteRazonSocial: "LOGISALL MEXICO S DE RL DE CV" },
  })

  assert.equal(porFiduciario.initialValues[PERSONA_OBJETO_TYPE_FIELD_ID], "fideicomiso")
  assert.equal(porRazonSocial.initialValues[PERSONA_OBJETO_TYPE_FIELD_ID], "persona_moral")
})

test("el expediente de un fideicomiso sólo exige su documentación propia", () => {
  const fideicomiso = getExpedienteDocumentsForScope("fideicomiso")
  const personaMoral = getExpedienteDocumentsForScope("persona_moral")

  assert.deepEqual(fideicomiso.map((item) => item.id), [
    "existencia-persona-moral",
    "constancia-situacion-fiscal",
    "poderes-representante",
    "identificacion-representante",
  ])
  assert.equal(personaMoral.length > fideicomiso.length, true)

  const evaluado = evaluateExpedientePmDocumentChecklist({ scope: "fideicomiso", manual: {} })
  assert.equal(evaluado.items.length, 4)
  assert.equal(evaluado.summary.total, 4)
  // La integración de una persona moral no aplica al fideicomiso.
  assert.equal(evaluado.items.some((item) => item.id === "inscripcion-registro-publico"), false)
  assert.equal(evaluado.items.some((item) => item.id === "identificacion-beneficiario"), false)
})

test("el Anexo pide un solo domicilio: nacional o del extranjero, no ambos", () => {
  // Ambas tablas traen columnas marcadas como obligatorias en la plantilla, así
  // que sin distinguir el ámbito ningún aviso podría cerrarse.
  const template = resolveSatTemplateForActividad("fraccion-xi-a-inmuebles")
  const layout = layoutFor(template.templateId)
  const fields = layout.sections.flatMap((section) => section.fields)
  const nacional = fields.find((field) => field.cell === "B104")
  const internacional = fields.find((field) => field.cell === "B122")

  assert.ok(nacional)
  assert.ok(internacional)

  const enMexico = { [PERSONA_OBJETO_DOMICILIO_FIELD_ID]: "nacional" }
  assert.equal(isSatXlsmFieldRequired(nacional, enMexico), true)
  assert.equal(isSatXlsmFieldActive(internacional, enMexico), false)

  const enExtranjero = { [PERSONA_OBJETO_DOMICILIO_FIELD_ID]: "internacional" }
  assert.equal(isSatXlsmFieldActive(nacional, enExtranjero), false)
  assert.equal(isSatXlsmFieldRequired(internacional, enExtranjero), true)

  // El domicilio nacional es el caso corriente y es el que se asume.
  const form = buildSatDynamicOperationForm({ template, layout })
  assert.equal(form.initialValues[PERSONA_OBJETO_DOMICILIO_FIELD_ID], "nacional")
  const extranjero = buildSatDynamicOperationForm({
    template,
    layout,
    prefill: { clienteDomicilioAmbito: "extranjero" },
  })
  assert.equal(extranjero.initialValues[PERSONA_OBJETO_DOMICILIO_FIELD_ID], "internacional")
})
