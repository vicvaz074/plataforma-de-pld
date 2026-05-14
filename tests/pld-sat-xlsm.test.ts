import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import { unzipSync } from "fflate"

import {
  buildSatDynamicOperationForm,
  buildSatWorkbookDownloadValues,
  extractSatXlsmLayoutFromBuffer,
  fillSatXlsmTemplate,
  getSatTemplateCachePath,
  resolveSatTemplateForActividad,
  SAT_TEMPLATE_CATALOG,
} from "../lib/pld"

const repoRoot = process.cwd()

test("SAT template resolver maps fraction V to the current official Inmuebles XLSM", () => {
  const resolution = resolveSatTemplateForActividad("fraccion-v-inmuebles")

  assert.equal(resolution.templateId, "sat-fraccion-v-inmuebles")
  assert.equal(resolution.fraccion, "Fracción V")
  assert.equal(resolution.officialXlsmName, "Inmuebles_v4_5.xlsm")
  assert.equal(resolution.localPath.endsWith("/sat-templates/sat-fraccion-v-inmuebles/Inmuebles_v4_5.xlsm"), true)
  assert.equal(resolution.requiresVariantSelection, false)
})

test("SAT template resolver requires real subformats for fractions XI and XII", () => {
  const xi = resolveSatTemplateForActividad("fraccion-xi-a-inmuebles")
  const xii = resolveSatTemplateForActividad("fraccion-xii-notarios-a")

  assert.equal(xi.fraccion, "Fracción XI")
  assert.equal(xi.requiresVariantSelection, true)
  assert.equal(xi.variants.length > 1, true)
  assert.notEqual(xi.officialXlsmName, "Paquete múltiple de avisos.zip")
  assert.match(xi.officialXlsmName, /\.xlsm$/)

  assert.equal(xii.fraccion, "Fracción XII")
  assert.equal(xii.requiresVariantSelection, true)
  assert.equal(xii.variants.length > 1, true)
  assert.notEqual(xii.officialXlsmName, "Paquete múltiple de avisos.zip")
  assert.match(xii.officialXlsmName, /\.xlsm$/)
})

test("Inmuebles XLSM layout exposes SAT sheets, fields and dropdowns from the workbook", () => {
  const template = resolveSatTemplateForActividad("fraccion-v-inmuebles")
  const workbookPath = path.join(repoRoot, getSatTemplateCachePath(template))
  assert.equal(existsSync(workbookPath), true, "Run pnpm sync:sat:formatos to cache official SAT XLSM templates")

  const layout = extractSatXlsmLayoutFromBuffer(readFileSync(workbookPath), template)
  const sectionNames = layout.sections.map((section) => section.title)
  const fields = layout.sections.flatMap((section) => section.fields)
  const tipoInmueble = fields.find((field) => field.id === "inmueble.tipo_bien")
  const formaPago = fields.find((field) => field.id === "pago.forma_pago")

  assert.deepEqual(sectionNames, [
    "Persona Objeto del aviso",
    "Beneficiario controlador",
    "Acto u operación",
  ])
  assert.equal(fields.some((field) => field.cell === "C5" && field.sheetName === "Acto u operación"), true)
  assert.equal(tipoInmueble?.required, true)
  assert.equal(tipoInmueble?.optionListId, "TipoInmueble")
  assert.equal((tipoInmueble?.options || []).length > 5, true)
  assert.equal(formaPago?.optionListId, "FormasPago")
  assert.equal((formaPago?.options || []).length > 3, true)
})

test("dynamic Actos y Operaciones form is generated from the selected SAT XLSM template", () => {
  const template = resolveSatTemplateForActividad("fraccion-v-inmuebles")
  const workbookPath = path.join(repoRoot, getSatTemplateCachePath(template))
  assert.equal(existsSync(workbookPath), true, "Run pnpm sync:sat:formatos to cache official SAT XLSM templates")
  const layout = extractSatXlsmLayoutFromBuffer(readFileSync(workbookPath), template)

  const form = buildSatDynamicOperationForm({
    template,
    layout,
    prefill: {
      fechaOperacion: "12/05/2026",
      montoMxn: 4850000,
      formaPago: "Transferencia electrónica de fondos",
      moneda: "MXN",
      codigoPostal: "11000",
    },
  })

  assert.equal(form.templateId, "sat-fraccion-v-inmuebles")
  assert.equal(form.sections.some((section) => section.fields.some((field) => field.id === "inmueble.codigo_postal")), true)
  assert.equal(form.initialValues["acto.fecha_operacion"], "12/05/2026")
  assert.equal(form.initialValues["inmueble.valor_pactado"], "4850000")
  assert.equal(form.initialValues["pago.moneda"], "MXN")
})

test("Inmuebles questionnaire maps Persona Objeto and Beneficiario controlador with exact SAT dropdowns", () => {
  const template = resolveSatTemplateForActividad("fraccion-v-inmuebles")
  const workbookPath = path.join(repoRoot, getSatTemplateCachePath(template))
  assert.equal(existsSync(workbookPath), true, "Run pnpm sync:sat:formatos to cache official SAT XLSM templates")
  const layout = extractSatXlsmLayoutFromBuffer(readFileSync(workbookPath), template)
  const form = buildSatDynamicOperationForm({
    template,
    layout,
    prefill: {
      periodo: "202605",
      sujetoObligadoRfc: "SAN910101AB1",
      referenciaAviso: "AVISO-INM-202605-001",
      prioridadAviso: "1,NORMAL",
      alertaCodigo: "100,Sin alerta.",
      clienteTipoPersonaSat: "persona_moral",
      clienteNombre: "Desarrollos Lago Verde, S.A.P.I. de C.V.",
      clienteRfc: "DLV190624M32",
      clientePais: "MEXICO,MX",
      clienteGiro: "NO APLICA||1000000",
      beneficiarioTipoPersonaSat: "persona_fisica",
      beneficiarioNombre: "Adriana",
      beneficiarioApellidoPaterno: "Luna",
      beneficiarioApellidoMaterno: "Paredes",
      beneficiarioRfc: "LUPA760912QA1",
      beneficiarioPais: "MEXICO,MX",
    },
  })
  const fields = form.sections.flatMap((section) => section.fields)
  const byId = new Map(fields.map((field) => [field.id, field]))

  assert.equal(byId.get("persona_aviso.sujeto_obligado_rfc")?.sheetName, "Persona Objeto del aviso")
  assert.equal(byId.get("persona_aviso.sujeto_obligado_rfc")?.cell, "C4")
  assert.equal(byId.get("persona_aviso.periodo")?.cell, "C5")
  assert.equal(byId.get("persona_aviso.referencia")?.cell, "C6")
  assert.equal(byId.get("persona_aviso.prioridad")?.cell, "E6")
  assert.equal(byId.get("persona_aviso.prioridad")?.optionListId, "Prioridades")
  assert.deepEqual(byId.get("persona_aviso.prioridad")?.options?.slice(0, 2), [
    "1,NORMAL",
    "2,24 HORAS CON OPERACIONES",
  ])
  assert.equal(byId.get("persona_aviso.tipo_alerta")?.cell, "C7")
  assert.equal(byId.get("persona_aviso.tipo_alerta")?.optionListId, "Alertas")
  assert.equal(byId.get("persona_aviso.pm.razon_social")?.cell, "B33")
  assert.equal(byId.get("persona_aviso.pm.giro_mercantil")?.optionListId, "Giros")
  assert.equal(byId.get("persona_aviso.domicilio_nacional.colonia")?.cell, "E60")
  assert.equal(byId.get("beneficiario.pf.nombre")?.sheetName, "Beneficiario controlador")
  assert.equal(byId.get("beneficiario.pf.nombre")?.cell, "B5")
  assert.equal(byId.get("beneficiario.pf.pais_nacionalidad")?.optionListId, "Paises")

  assert.equal(form.initialValues["persona_aviso.sujeto_obligado_rfc"], "SAN910101AB1")
  assert.equal(form.initialValues["persona_aviso.pm.razon_social"], "Desarrollos Lago Verde, S.A.P.I. de C.V.")
  assert.equal(form.initialValues["beneficiario.pf.nombre"], "Adriana")
})

test("Desarrollo inmobiliario questionnaire keeps official XLSM dropdown options", () => {
  const template = resolveSatTemplateForActividad("fraccion-v-bis-desarrollo")
  const layout = JSON.parse(
    readFileSync(path.join(repoRoot, "public/data/sat-xlsm-layouts/sat-fraccion-v-bis-desarrollo.json"), "utf8"),
  )
  const form = buildSatDynamicOperationForm({ template, layout })
  const fields = form.sections.flatMap((section) => section.fields)
  const tipoDesarrollo = fields.find((field) => field.label === "Tipo de Desarrollo")
  const moneda = fields.find((field) => field.label === "Moneda o Divisa")

  assert.equal(tipoDesarrollo?.optionListId, "TipoDesarrollo")
  assert.deepEqual(tipoDesarrollo?.options?.slice(0, 3), ["1,Habitacional", "2,Comercial", "3,Oficinas"])
  assert.equal(moneda?.optionListId, "Monedas")
  assert.equal((moneda?.options?.length ?? 0) > 100, true)
})

test("SAT questionnaire excludes XLSM helper text that is not a user input", () => {
  const template = resolveSatTemplateForActividad("fraccion-v-bis-desarrollo")
  const layout = JSON.parse(
    readFileSync(path.join(repoRoot, "public/data/sat-xlsm-layouts/sat-fraccion-v-bis-desarrollo.json"), "utf8"),
  )
  const form = buildSatDynamicOperationForm({ template, layout })
  const fields = form.sections.flatMap((section) => section.fields)

  assert.equal(
    fields.some((field) => /Los campos marcados con/i.test(field.label)),
    false,
  )
  assert.equal(
    form.requiredFieldIds.some((fieldId) => /los-campos-marcados/i.test(fieldId)),
    false,
  )
})

test("SAT questionnaire does not prefill description of goods with country values", () => {
  const template = resolveSatTemplateForActividad("fraccion-v-bis-desarrollo")
  const layout = JSON.parse(
    readFileSync(path.join(repoRoot, "public/data/sat-xlsm-layouts/sat-fraccion-v-bis-desarrollo.json"), "utf8"),
  )
  const form = buildSatDynamicOperationForm({
    template,
    layout,
    prefill: {
      clientePais: "MEXICO,MX",
      contrapartePais: "MEXICO,MX",
    },
  })
  const descriptionFields = form.sections
    .flatMap((section) => section.fields)
    .filter((field) => /descripci[oó]n del bien/i.test(field.label))

  assert.equal(descriptionFields.length > 0, true)
  for (const field of descriptionFields) {
    assert.equal(form.initialValues[field.id] ?? "", "")
  }
})

test("Juegos y sorteos questionnaire resolves dropdowns after self-closing XLSM cells", () => {
  const template = resolveSatTemplateForActividad("fraccion-i-juegos")
  const workbookPath = path.join(repoRoot, getSatTemplateCachePath(template))
  assert.equal(existsSync(workbookPath), true, "Run pnpm sync:sat:formatos to cache official SAT XLSM templates")
  const layout = extractSatXlsmLayoutFromBuffer(readFileSync(workbookPath), template)
  const fields = layout.sections.flatMap((section) => section.fields)
  const tipoOperacion = fields.find((field) => field.optionListId === "TipoOpe")
  const lineaNegocio = fields.find((field) => field.optionListId === "LineaNego")
  const medioEmpleado = fields.find((field) => field.optionListId === "MedioEmp")
  const tipoBien = fields.find((field) => field.optionListId === "TipoBien1")
  const tipoInmueble = fields.find((field) => field.optionListId === "TipoInm")

  assert.deepEqual(tipoOperacion?.options?.slice(0, 3), [
    "101,Venta de boletos /fichas /recibos u otros instrumentos de juego similares",
    "102,Pago de boletos /fichas /recibos u otros instrumentos de juego similares",
    "103,Pago de premios",
  ])
  assert.deepEqual(lineaNegocio?.options?.slice(0, 2), ["1,Hipódromo", "2,Galgódromo"])
  assert.deepEqual(medioEmpleado?.options?.slice(0, 2), ["1,Presencial", "2,Internet"])
  assert.equal((tipoBien?.options?.length ?? 0) >= 9, true)
  assert.equal((tipoInmueble?.options?.length ?? 0) >= 19, true)
})

test("Inmuebles questionnaire supports repeatable SAT rows for inmuebles and pagos", () => {
  const template = resolveSatTemplateForActividad("fraccion-v-inmuebles")
  const workbookPath = path.join(repoRoot, getSatTemplateCachePath(template))
  assert.equal(existsSync(workbookPath), true, "Run pnpm sync:sat:formatos to cache official SAT XLSM templates")
  const layout = extractSatXlsmLayoutFromBuffer(readFileSync(workbookPath), template)
  const form = buildSatDynamicOperationForm({ template, layout })
  const fields = form.sections.flatMap((section) => section.fields)
  const byId = new Map(fields.map((field) => [field.id, field]))

  assert.equal(byId.get("inmueble.tipo_bien")?.cell, "B42")
  assert.equal(byId.get("inmueble.2.tipo_bien")?.cell, "B43")
  assert.equal(byId.get("inmueble.2.tipo_bien")?.repeatGroup, "inmuebles")
  assert.equal(byId.get("inmueble.2.tipo_bien")?.optionListId, "TipoInmueble")
  assert.equal(byId.get("pago.forma_pago")?.cell, "C70")
  assert.equal(byId.get("pago.2.forma_pago")?.cell, "C71")
  assert.equal(byId.get("pago.2.forma_pago")?.repeatGroup, "pagos")
  assert.equal(byId.get("pago.2.instrumento_monetario")?.optionListId, "InstrumentoMonetario")
})

test("all cached SAT templates render a questionnaire from their official XLSM layout", () => {
  const missing: string[] = []
  for (const template of SAT_TEMPLATE_CATALOG) {
    const workbookPath = path.join(repoRoot, getSatTemplateCachePath(template))
    if (!existsSync(workbookPath)) {
      missing.push(`${template.templateId}: template not cached`)
      continue
    }
    const layout = extractSatXlsmLayoutFromBuffer(readFileSync(workbookPath), template)
    const form = buildSatDynamicOperationForm({ template, layout })
    const fields = form.sections.flatMap((section) => section.fields)
    if (fields.length === 0) missing.push(`${template.templateId}: no fields`)
    if (!layout.workbookHasMacros) missing.push(`${template.templateId}: missing macros`)
  }

  assert.deepEqual(missing, [])
})

test("legacy demo SAT package values are enriched before filling Inmuebles XLSM", () => {
  const template = resolveSatTemplateForActividad("fraccion-v-inmuebles")
  const workbookPath = path.join(repoRoot, getSatTemplateCachePath(template))
  assert.equal(existsSync(workbookPath), true, "Run pnpm sync:sat:formatos to cache official SAT XLSM templates")
  const layout = extractSatXlsmLayoutFromBuffer(readFileSync(workbookPath), template)
  const legacyOperationOnlyValues = {
    "acto.fecha_operacion": "05/05/2026",
    "acto.figura_cliente": "2,Comprador",
    "acto.figura_sujeto_obligado": "3,Intermediario",
    "inmueble.tipo_bien": "12,Terreno urbano habitacional",
    "inmueble.valor_pactado": "1850000",
    "inmueble.codigo_postal": "66260",
    "inmueble.calle": "Avenida Roble",
    "inmueble.numero_exterior": "300",
    "inmueble.colonia": "Valle del Campestre",
    "inmueble.terreno_m2": "240",
    "inmueble.inmueble_m2": "185",
    "inmueble.folio_real": "FR-2026-000184",
    "pago.fecha": "05/05/2026",
    "pago.forma_pago": "1,Contado",
    "pago.instrumento_monetario": "8,Transferencia Interbancaria",
    "pago.moneda": "1,Peso mexicano",
    "pago.monto": "1850000",
  }
  const values = buildSatWorkbookDownloadValues({
    satTemplateId: template.templateId,
    values: legacyOperationOnlyValues,
    tenantRfc: "ISN2103158Q7",
    periodo: "202605",
    outputKind: "aviso_normal",
    clienteNombre: "Desarrollos Lago Verde, S.A.P.I. de C.V.",
    clienteRfc: "DLV190624M32",
    packageId: "satpkg-demo-legacy",
  })
  const filled = fillSatXlsmTemplate(readFileSync(workbookPath), {
    template,
    values,
    layout,
  })

  assert.equal(values["persona_aviso.sujeto_obligado_rfc"], "ISN2103158Q7")
  assert.equal(values["persona_aviso.periodo"], "202605")
  assert.equal(values["persona_aviso.pm.razon_social"], "Desarrollos Lago Verde, S.A.P.I. de C.V.")
  assert.equal(values["persona_aviso.representante.curp"], "VANR760702HNLLVC09")
  assert.equal(values["beneficiario.pf.curp"], "LUPA760912MNLNRD04")
  assert.equal(filled.status, "filled")
  assert.deepEqual(filled.missingRequiredFields, [])
  assert.equal(filled.writtenCells.includes("Persona Objeto del aviso!G46"), true)
  assert.equal(filled.writtenCells.includes("Beneficiario controlador!G5"), true)

  const zip = unzipSync(filled.workbook)
  const personaSheet = Buffer.from(zip["xl/worksheets/sheet1.xml"]).toString("utf8")
  const beneficiarioSheet = Buffer.from(zip["xl/worksheets/sheet2.xml"]).toString("utf8")
  assert.match(personaSheet, /VANR760702HNLLVC09/)
  assert.match(beneficiarioSheet, /LUPA760912MNLNRD04/)
})

test("filled SAT XLSM keeps macros and writes mapped values into official workbook cells", () => {
  const template = resolveSatTemplateForActividad("fraccion-v-inmuebles")
  const workbookPath = path.join(repoRoot, getSatTemplateCachePath(template))
  assert.equal(existsSync(workbookPath), true, "Run pnpm sync:sat:formatos to cache official SAT XLSM templates")

  const layout = extractSatXlsmLayoutFromBuffer(readFileSync(workbookPath), template)
  const filled = fillSatXlsmTemplate(readFileSync(workbookPath), {
    template,
    values: {
      "persona_aviso.sujeto_obligado_rfc": "SAN910101AB1",
      "persona_aviso.periodo": "202605",
      "persona_aviso.referencia": "AVISO-INM-202605-001",
      "persona_aviso.prioridad": "1,NORMAL",
      "persona_aviso.tipo_alerta": "100,Sin alerta.",
      "persona_aviso.pm.razon_social": "Desarrollos Lago Verde, S.A.P.I. de C.V.",
      "persona_aviso.pm.rfc": "DLV190624M32",
      "beneficiario.pf.nombre": "Adriana",
      "beneficiario.pf.apellido_paterno": "Luna",
      "beneficiario.pf.rfc": "LUPA760912QA1",
      "Acto u operación!C5": "12/05/2026",
      "Acto u operación!C7": "1,Comprador",
      "acto.figura_sujeto_obligado": "2,Comprador",
      "Acto u operación!B42": "1,Casa habitación",
      "Acto u operación!C42": "4850000",
      "inmueble.codigo_postal": "11000",
      "inmueble.calle": "Avenida Reforma",
      "inmueble.numero_exterior": "120",
      "inmueble.colonia": "Lomas de Chapultepec",
      "inmueble.terreno_m2": "250",
      "inmueble.inmueble_m2": "210",
      "inmueble.folio_real": "CDMX-2026-0001",
      "inmueble.2.tipo_bien": "2,Departamento",
      "inmueble.2.valor_pactado": "2500000",
      "Acto u operación!F70": "4850000",
      "pago.fecha": "12/05/2026",
      "pago.forma_pago": "1,Contado",
      "pago.instrumento_monetario": "6,Transferencia interbancaria",
      "pago.moneda": "1,Peso mexicano",
      "pago.2.forma_pago": "1,Contado",
      "pago.2.monto": "2500000",
    },
    layout,
  })
  const zip = unzipSync(filled.workbook)
  const personaSheet = Buffer.from(zip["xl/worksheets/sheet1.xml"]).toString("utf8")
  const beneficiarioSheet = Buffer.from(zip["xl/worksheets/sheet2.xml"]).toString("utf8")
  const sheet = Buffer.from(zip["xl/worksheets/sheet3.xml"]).toString("utf8")

  assert.equal(Boolean(zip["xl/vbaProject.bin"]), true)
  assert.equal(filled.status, "filled")
  assert.match(personaSheet, /SAN910101AB1/)
  assert.match(personaSheet, /Desarrollos Lago Verde/)
  assert.match(beneficiarioSheet, /Adriana/)
  assert.match(beneficiarioSheet, /LUPA760912QA1/)
  assert.match(sheet, /12\/05\/2026/)
  assert.match(sheet, /4850000/)
  assert.match(sheet, /2500000/)
  assert.equal(filled.writtenCells.includes("Persona Objeto del aviso!C4"), true)
  assert.equal(filled.writtenCells.includes("Beneficiario controlador!B5"), true)
  assert.equal(filled.writtenCells.includes("Acto u operación!C42"), true)
  assert.equal(filled.writtenCells.includes("Acto u operación!B43"), true)
  assert.equal(filled.writtenCells.includes("Acto u operación!C71"), true)
})
