import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import { strToU8, unzipSync, zipSync } from "fflate"
import XLSX from "xlsx"

import {
  buildSatDynamicOperationForm,
  buildSatWorkbookDownloadValues,
  extractSatXlsmLayoutFromBuffer,
  fillSatXlsmTemplate,
  getSatTemplateCachePath,
  isSatXlsmFieldActive,
  resolveSatTemplateForActividad,
  satFieldValuesToWorkbookCells,
  SAT_TEMPLATE_CATALOG,
} from "../lib/pld"

const repoRoot = process.cwd()

test("XLSM extractor ignores non-list validation and keeps a list after a self-closing node", () => {
  const workbook = zipSync({
    "xl/workbook.xml": strToU8(
      '<workbook><sheets><sheet name="Captura" r:id="rId1"/></sheets></workbook>',
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    ),
    "xl/worksheets/sheet1.xml": strToU8(
      [
        "<worksheet>",
        "<sheetData>",
        '<row r="1"><c r="A1" t="inlineStr"><is><t>Selector *</t></is></c></row>',
        '<row r="2"><c r="A2" t="inlineStr"><is><t>No usar *</t></is></c></row>',
        "</sheetData>",
        "<dataValidations>",
        '<dataValidation type="custom" sqref="B2"/>',
        '<dataValidation type="list" sqref="B1"><formula1>&quot;Uno,Dos&quot;</formula1></dataValidation>',
        "</dataValidations>",
        "</worksheet>",
      ].join(""),
    ),
  })
  const layout = extractSatXlsmLayoutFromBuffer(workbook, {
    templateId: "fixture-validation-list",
    officialXlsmName: "fixture.xlsm",
  })
  const validationFields = layout.sections.flatMap((section) => section.fields)
    .filter((field) => field.source === "xlsm-data-validation")

  assert.deepEqual(validationFields.map((field) => field.cell), ["B1"])
  assert.deepEqual(validationFields[0]?.options, ["Uno", "Dos"])
})

test("SAT template resolver maps fraction V to the current official Inmuebles XLSM", () => {
  const resolution = resolveSatTemplateForActividad("fraccion-v-inmuebles")

  assert.equal(resolution.templateId, "sat-fraccion-v-inmuebles")
  assert.equal(resolution.fraccion, "Fracción V")
  assert.equal(resolution.officialXlsmName, "Inmuebles_v4_5.xlsm")
  assert.equal(resolution.localPath.endsWith("/sat-templates/sat-fraccion-v-inmuebles/Inmuebles_v4_5.xlsm"), true)
  assert.equal(resolution.requiresVariantSelection, false)
})

test("SAT template resolver only exposes subformats compatible with the selected activity", () => {
  const xi = resolveSatTemplateForActividad("fraccion-xi-a-inmuebles")
  const xii = resolveSatTemplateForActividad("fraccion-xii-notarios-a")

  assert.equal(xi.fraccion, "Fracción XI")
  assert.equal(xi.requiresVariantSelection, true)
  assert.equal(xi.variants.length > 1, true)
  assert.notEqual(xi.officialXlsmName, "Paquete múltiple de avisos.zip")
  assert.match(xi.officialXlsmName, /\.xlsm$/)

  assert.equal(xii.fraccion, "Fracción XII")
  assert.equal(xii.requiresVariantSelection, false)
  assert.deepEqual(xii.variants.map((variant) => variant.templateId), ["sat-fraccion-xii-notarios-a"])
  assert.notEqual(xii.officialXlsmName, "Paquete múltiple de avisos.zip")
  assert.match(xii.officialXlsmName, /\.xlsm$/)

  const xiAdministration = resolveSatTemplateForActividad(
    "fraccion-xi-b-administracion",
    "sat-fraccion-xi-e-fusion",
  )
  assert.equal(xiAdministration.templateId, "sat-fraccion-xi-b-administracion")
  assert.deepEqual(
    xiAdministration.variants.map((variant) => variant.templateId),
    ["sat-fraccion-xi-b-administracion"],
  )
})

test("XI-B questionnaire follows official conditional branches for other, inmuebles and virtual assets", () => {
  const template = resolveSatTemplateForActividad("fraccion-xi-b-administracion")
  const layout = JSON.parse(
    readFileSync(
      path.join(repoRoot, "public/data/sat-xlsm-layouts/sat-fraccion-xi-b-administracion.json"),
      "utf8",
    ),
  )
  const form = buildSatDynamicOperationForm({ template, layout })
  const fields = form.sections.flatMap((section) => section.fields)
  const byId = new Map(fields.map((field) => [field.id, field]))

  assert.deepEqual(byId.get("persona_aviso.ocupacion")?.options, [
    "1,Abogado",
    "2,Contador",
    "3,Administrador",
    "4,Outsourcing / Servicios Especializados",
    "5,Consultoría",
    "99,Otro",
  ])
  assert.equal(
    isSatXlsmFieldActive(byId.get("acto.activo_administrado_otro")!, {
      "acto.activo_administrado": "1,Administración de bases de datos",
    }),
    false,
  )
  assert.equal(
    isSatXlsmFieldActive(byId.get("acto.activo_administrado_otro")!, {
      "acto.activo_administrado": "99,Otro",
    }),
    true,
  )
  assert.equal(
    isSatXlsmFieldActive(byId.get("activo_inmueble.tipo")!, {
      "acto.activo_administrado": "9,Inmuebles",
    }),
    true,
  )
  assert.equal(
    isSatXlsmFieldActive(byId.get("activo_inmueble.tipo")!, {
      "acto.activo_administrado": "10,Instrumentos Financieros",
    }),
    false,
  )
  assert.equal(
    isSatXlsmFieldActive(byId.get("operacion_financiera.moneda")!, {
      "operacion_financiera.instrumento_monetario": "16,Activos Virtuales",
    }),
    false,
  )
  assert.equal(
    isSatXlsmFieldActive(byId.get("operacion_financiera.activo_virtual")!, {
      "operacion_financiera.instrumento_monetario": "16,Activos Virtuales",
    }),
    true,
  )
  assert.equal(
    isSatXlsmFieldActive(byId.get("operacion_financiera.activo_virtual_otro")!, {
      "operacion_financiera.instrumento_monetario": "16,Activos Virtuales",
      "operacion_financiera.activo_virtual": "999999,OTRO NO CONTENIDO EN EL CATALOGO",
    }),
    true,
  )

  const cells = satFieldValuesToWorkbookCells(
    {
      "acto.activo_administrado": "1,Administración de bases de datos",
      "acto.activo_administrado_otro": "valor obsoleto",
      "operacion_financiera.instrumento_monetario": "1,Efectivo",
      "operacion_financiera.moneda": "1,Peso mexicano",
      "operacion_financiera.activo_virtual": "1001,BITCOIN (BTC)",
    },
    layout,
  )
  assert.equal(cells["Acto u operación!F124"], undefined)
  assert.equal(cells["Operaciones financieras!E7"], undefined)
  assert.equal(cells["Operaciones financieras!D7"], "1,Peso mexicano")
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
  assert.equal(byId.get("persona_aviso.domicilio_nacional.codigo_postal")?.cell, "B60")
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

test("filled Inmuebles XLSM normalizes periodo, postal codes and date-visible cells", () => {
  const template = resolveSatTemplateForActividad("fraccion-v-inmuebles")
  const workbookPath = path.join(repoRoot, getSatTemplateCachePath(template))
  assert.equal(existsSync(workbookPath), true, "Run pnpm sync:sat:formatos to cache official SAT XLSM templates")
  const layout = extractSatXlsmLayoutFromBuffer(readFileSync(workbookPath), template)
  const values = buildSatWorkbookDownloadValues({
    satTemplateId: template.templateId,
    values: {
      "acto.fecha_operacion": "05/05/2026",
      "acto.figura_cliente": "2,Comprador",
      "acto.figura_sujeto_obligado": "3,Intermediario",
      "instrumento.fecha": "05/05/2026",
      "instrumento.fecha_contrato": "05/05/2026",
      "inmueble.tipo_bien": "12,Terreno urbano habitacional",
      "inmueble.valor_pactado": "1850000",
      "inmueble.codigo_postal": "CP 66260, San Pedro Garza García",
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
    },
    tenantRfc: "ISN2103158Q7",
    periodo: "2026-05",
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
  const workbook = XLSX.read(Buffer.from(filled.workbook), {
    type: "buffer",
    cellFormula: true,
    cellNF: true,
  })
  const persona = workbook.Sheets["Persona Objeto del aviso"]
  const acto = workbook.Sheets["Acto u operación"]

  assert.equal(filled.status, "filled")
  assert.equal(values["persona_aviso.periodo"], "202605")
  assert.equal(persona.C5.v, "202605")
  assert.equal(String(persona.B60.v), "66260")
  assert.equal(persona.C60.f?.includes("VLOOKUP(B60"), true)
  assert.equal(persona.D60.f?.includes("VLOOKUP(B60"), true)
  assert.equal(persona.I60?.v ?? "", "")
  assert.equal(String(acto.D42.v), "66260")
  assert.equal(acto.E42.f?.includes("VLOOKUP(D42"), true)
  assert.equal(acto.F42.f?.includes("VLOOKUP(D42"), true)
  assert.equal(acto.B56.w, "05/05/2026")
  assert.notEqual(acto.B56.w, "46147")
  assert.notEqual(acto.G56.w, "46147")
  assert.notEqual(acto.B70.w, "46147")
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
  const workbook = XLSX.read(Buffer.from(filled.workbook), {
    type: "buffer",
    cellNF: true,
  })
  const acto = workbook.Sheets["Acto u operación"]

  assert.equal(Boolean(zip["xl/vbaProject.bin"]), true)
  assert.equal(filled.status, "filled")
  assert.match(personaSheet, /SAN910101AB1/)
  assert.match(personaSheet, /Desarrollos Lago Verde/)
  assert.match(beneficiarioSheet, /Adriana/)
  assert.match(beneficiarioSheet, /LUPA760912QA1/)
  assert.notEqual(acto.C5.w, "46154")
  assert.match(sheet, /4850000/)
  assert.match(sheet, /2500000/)
  assert.equal(filled.writtenCells.includes("Persona Objeto del aviso!C4"), true)
  assert.equal(filled.writtenCells.includes("Beneficiario controlador!B5"), true)
  assert.equal(filled.writtenCells.includes("Acto u operación!C42"), true)
  assert.equal(filled.writtenCells.includes("Acto u operación!B43"), true)
  assert.equal(filled.writtenCells.includes("Acto u operación!C71"), true)
})
