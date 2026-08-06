import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import { strToU8, unzipSync, zipSync } from "fflate"
import XLSX from "xlsx"

import {
  buildSatDynamicOperationForm,
  buildSatQuestionnaireDedupedFieldView,
  buildSatWorkbookDownloadValues,
  extractSatXlsmLayoutFromBuffer,
  fillSatXlsmTemplate,
  getSatTemplateCachePath,
  isSatXlsmFieldActive,
  isSatXlsmFieldRequired,
  pruneInactiveSatFieldValues,
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

test("XII Notarios A only activates, requires and exports F18 when F17 uses SAT code 9", () => {
  const template = resolveSatTemplateForActividad("fraccion-xii-notarios-a")
  const workbookPath = path.join(repoRoot, getSatTemplateCachePath(template))
  assert.equal(existsSync(workbookPath), true, "Run pnpm sync:sat:formatos to cache official SAT XLSM templates")
  const workbook = readFileSync(workbookPath)
  const extractedLayout = extractSatXlsmLayoutFromBuffer(workbook, template)
  const extractedTipoActoOtro = extractedLayout.sections
    .flatMap((section) => section.fields)
    .find((field) => field.id === "aviso.descripcion-tipo-de-acto-otro.f18")
  assert.equal(extractedTipoActoOtro?.cell, "F18")

  const layout = JSON.parse(
    readFileSync(
      path.join(repoRoot, "public/data/sat-xlsm-layouts/sat-fraccion-xii-notarios-a.json"),
      "utf8",
    ),
  )
  const form = buildSatDynamicOperationForm({ template, layout })
  const fields = form.sections.flatMap((section) => section.fields)
  const tipoActoId = "aviso.tipo-de-acto-realizado.f17"
  const tipoActoOtroId = "aviso.descripcion-tipo-de-acto-otro.f18"
  const tipoActo = fields.find((field) => field.id === tipoActoId)
  const tipoActoOtro = fields.find((field) => field.id === tipoActoOtroId)
  // El identificador incluye el bloque repetible al que pertenece la celda, así
  // que se ancla por celda: lo que debe permanecer estable es el destino C25.
  const valorCatastralId = fields.find((field) => field.cell === "C25" && field.sheetName === "Aviso")?.id ?? ""

  assert.ok(tipoActo)
  assert.ok(tipoActoOtro)
  assert.ok(valorCatastralId, "la plantilla debe mapear el valor catastral en C25")
  assert.equal(tipoActo.cell, "F17")
  assert.equal(tipoActoOtro.cell, "F18")
  assert.equal(tipoActoOtro.required, false)
  assert.deepEqual(tipoActoOtro.activeWhen, [{ fieldId: tipoActoId, equals: ["9"] }])
  assert.deepEqual(tipoActoOtro.requiredWhen, [{ fieldId: tipoActoId, equals: ["9"] }])

  const prefillMontoGeneral = buildSatDynamicOperationForm({
    template,
    layout,
    prefill: { montoMxn: "10000000.00" },
  })
  assert.equal(prefillMontoGeneral.initialValues[valorCatastralId], undefined)
  const prefillCatastralExplicito = buildSatDynamicOperationForm({
    template,
    layout,
    prefill: {
      montoMxn: "10000000.00",
      instrumentoValorCatastral: "2450000.00",
    },
  })
  assert.equal(prefillCatastralExplicito.initialValues[valorCatastralId], "2450000.00")

  const cases = [
    ["1, Prescripción Positiva", false],
    ["2, Dación en Pago", false],
    ["3, Adjudicación", false],
    ["9, Otro", true],
  ] as const

  for (const [tipoActoValue, expectsOtro] of cases) {
    const values = {
      [tipoActoId]: tipoActoValue,
      [tipoActoOtroId]: "ACTO-OTRO-PRUEBA-2026",
      "Aviso!F18": "ACTO-OTRO-PRUEBA-2026",
    }
    assert.equal(isSatXlsmFieldActive(tipoActoOtro, values), expectsOtro)
    assert.equal(isSatXlsmFieldRequired(tipoActoOtro, values), expectsOtro)

    const cells = satFieldValuesToWorkbookCells(values, layout)
    assert.equal(cells["Aviso!F17"], tipoActoValue)
    assert.equal(cells["Aviso!F18"], expectsOtro ? "ACTO-OTRO-PRUEBA-2026" : undefined)
  }

  const filledNormal = fillSatXlsmTemplate(workbook, {
    template,
    values: {
      [tipoActoId]: "1, Prescripción Positiva",
      [tipoActoOtroId]: "VALOR-OBSOLETO",
      "Aviso!F18": "VALOR-OBSOLETO",
    },
    layout,
  })
  assert.equal(filledNormal.writtenCells.includes("Aviso!F18"), false)
  assert.equal(filledNormal.missingRequiredFields.includes(tipoActoOtroId), false)

  const missingOtro = fillSatXlsmTemplate(workbook, {
    template,
    values: { [tipoActoId]: "9, Otro" },
    layout,
  })
  assert.equal(missingOtro.missingRequiredFields.includes(tipoActoOtroId), true)

  const filledOtro = fillSatXlsmTemplate(workbook, {
    template,
    values: {
      [tipoActoId]: "9, Otro",
      [tipoActoOtroId]: "ACTO-OTRO-PRUEBA-2026",
    },
    layout,
  })
  assert.equal(filledOtro.writtenCells.includes("Aviso!F18"), true)
  const avisoSheet = Buffer.from(unzipSync(filledOtro.workbook)["xl/worksheets/sheet1.xml"]).toString("utf8")
  assert.match(avisoSheet, /ACTO-OTRO-PRUEBA-2026/)
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
    isSatXlsmFieldActive(byId.get("acto.descripcion_activo_administrado")!, {
      "acto.activo_administrado": "1,Administración de bases de datos",
    }),
    false,
  )
  assert.equal(
    isSatXlsmFieldRequired(byId.get("acto.descripcion_activo_administrado")!, {
      "acto.activo_administrado": "1,Administración de bases de datos",
    }),
    false,
  )
  assert.equal(
    isSatXlsmFieldActive(byId.get("acto.descripcion_activo_administrado")!, {
      "acto.activo_administrado": "99,Otro",
    }),
    true,
  )
  assert.equal(
    isSatXlsmFieldRequired(byId.get("acto.descripcion_activo_administrado")!, {
      "acto.activo_administrado": "99,Otro",
    }),
    true,
  )
  const otherDescriptionFields = [
    byId.get("acto.activo_administrado_otro")!,
    byId.get("acto.descripcion_activo_administrado")!,
  ]
  const dedupedOtherDescription = buildSatQuestionnaireDedupedFieldView({
    fields: otherDescriptionFields,
    values: {
      "acto.activo_administrado": "99,Otro",
      "acto.activo_administrado_otro": "",
      "acto.descripcion_activo_administrado": "",
    },
    missingRequiredIds: otherDescriptionFields.map((field) => field.id),
  })
  assert.equal(dedupedOtherDescription.fields.length, 1)
  assert.equal(dedupedOtherDescription.duplicateHiddenCount, 1)
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
      "acto.descripcion_activo_administrado": "descripción obsoleta",
      "operacion_financiera.instrumento_monetario": "1,Efectivo",
      "operacion_financiera.moneda": "1,Peso mexicano",
      "operacion_financiera.activo_virtual": "1001,BITCOIN (BTC)",
    },
    layout,
  )
  assert.equal(cells["Acto u operación!F124"], undefined)
  assert.equal(cells["Acto u operación!B179"], undefined)
  assert.equal(cells["Operaciones financieras!E7"], undefined)
  assert.equal(cells["Operaciones financieras!D7"], "1,Peso mexicano")

  const otherCells = satFieldValuesToWorkbookCells(
    {
      "acto.activo_administrado": "99,Otro",
      "acto.descripcion_activo_administrado": "Activo especializado",
    },
    layout,
  )
  assert.equal(otherCells["Acto u operación!B179"], "Activo especializado")
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

test("Inmuebles questionnaire maps Persona Objeto and only the primary PF Beneficiario controlador row", () => {
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
      beneficiarioPfNombre: "Adriana",
      beneficiarioPfApellidoPaterno: "Luna",
      beneficiarioPfApellidoMaterno: "Paredes",
      beneficiarioPfRfc: "LUPA760912QA1",
      beneficiarioPfPais: "MEXICO,MX",
      beneficiarioPmRazonSocial: "No debe aparecer, S.A. de C.V.",
      beneficiarioPmRfc: "NDA260101AA1",
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
  assert.equal(form.initialValues["beneficiario.pf.rfc"], "LUPA760912QA1")
  assert.equal(form.initialValues["beneficiario.pf.2.nombre"], undefined)
  assert.equal(form.initialValues["beneficiario.pf.2.rfc"], undefined)
  assert.equal(form.initialValues["beneficiario.pm.razon_social"], undefined)
  assert.equal(form.initialValues["beneficiario.pm.rfc"], undefined)
  assert.equal(form.initialValues["beneficiario.pm.denominacion_fiduciario"], undefined)
  assert.equal(form.initialValues["beneficiario.pm.rfc_fiduciario"], undefined)
  assert.equal(form.initialValues["beneficiario.pm.identificador_fideicomiso"], undefined)
})

test("Inmuebles questionnaire maps only the primary PM Beneficiario controlador row", () => {
  const template = resolveSatTemplateForActividad("fraccion-v-inmuebles")
  const workbookPath = path.join(repoRoot, getSatTemplateCachePath(template))
  assert.equal(existsSync(workbookPath), true, "Run pnpm sync:sat:formatos to cache official SAT XLSM templates")
  const layout = extractSatXlsmLayoutFromBuffer(readFileSync(workbookPath), template)
  const form = buildSatDynamicOperationForm({
    template,
    layout,
    prefill: {
      beneficiarioTipoPersonaSat: "persona_moral",
      beneficiarioPmRazonSocial: "Controladora Bosque, S.A. de C.V.",
      beneficiarioPmFechaConstitucion: "07/03/2019",
      beneficiarioPmRfc: "CBO190307AB2",
      beneficiarioPmPais: "MEXICO,MX",
      beneficiarioPfNombre: "No debe aparecer",
      beneficiarioPfRfc: "NDA760912QA1",
    },
  })

  assert.equal(form.initialValues["beneficiario.pm.razon_social"], "Controladora Bosque, S.A. de C.V.")
  assert.equal(form.initialValues["beneficiario.pm.fecha_constitucion"], "07/03/2019")
  assert.equal(form.initialValues["beneficiario.pm.rfc"], "CBO190307AB2")
  assert.equal(form.initialValues["beneficiario.pm.pais_nacionalidad"], "MEXICO,MX")
  assert.equal(form.initialValues["beneficiario.pm.2.razon_social"], undefined)
  assert.equal(form.initialValues["beneficiario.pm.2.rfc"], undefined)
  assert.equal(form.initialValues["beneficiario.pf.nombre"], undefined)
  assert.equal(form.initialValues["beneficiario.pf.rfc"], undefined)
  assert.equal(form.initialValues["beneficiario.pm.denominacion_fiduciario"], undefined)
  assert.equal(form.initialValues["beneficiario.pm.rfc_fiduciario"], undefined)
  assert.equal(form.initialValues["beneficiario.pm.identificador_fideicomiso"], undefined)
})

test("Beneficiario controlador activates, requires and exports only the selected singular PF or PM branch", () => {
  const template = resolveSatTemplateForActividad("fraccion-i-juegos")
  const layout = JSON.parse(
    readFileSync(path.join(repoRoot, "public/data/sat-xlsm-layouts/sat-fraccion-i-juegos.json"), "utf8"),
  )
  const inmueblesTemplate = resolveSatTemplateForActividad("fraccion-v-inmuebles")
  const inmueblesLayout = JSON.parse(
    readFileSync(path.join(repoRoot, "public/data/sat-xlsm-layouts/sat-fraccion-v-inmuebles.json"), "utf8"),
  )
  const cases = [
    {
      type: "persona_fisica",
      prefill: {
        beneficiarioTipoPersonaSat: "persona_fisica",
        beneficiarioPfNombre: "Adriana",
        beneficiarioPfRfc: "LUPA760912QA1",
        beneficiarioPfPais: "MEXICO,MX",
      },
      selected: "pf",
      opposite: "pm",
    },
    {
      type: "persona_moral",
      prefill: {
        beneficiarioTipoPersonaSat: "persona_moral",
        beneficiarioPmRazonSocial: "Controladora Bosque, S.A. de C.V.",
        beneficiarioPmRfc: "CBO190307AB2",
        beneficiarioPmPais: "MEXICO,MX",
      },
      selected: "pm",
      opposite: "pf",
    },
  ] as const

  const branchForField = (cell: string) => Number(cell.match(/\d+/)?.[0] ?? 0) <= 16 ? "pf" : "pm"
  const isFiduciary = (id: string, label: string) => /fiduciari|fideicomiso/i.test(`${id} ${label}`)

  for (const scenario of cases) {
    const form = buildSatDynamicOperationForm({ template, layout, prefill: scenario.prefill })
    const fields = form.sections
      .flatMap((section) => section.fields)
      .filter((field) => field.sectionKind === "beneficiario_controlador")
    const values = form.initialValues
    const selectedFields = fields.filter((field) => branchForField(field.cell) === scenario.selected)
    const oppositeFields = fields.filter((field) => branchForField(field.cell) === scenario.opposite)
    const fiduciaryFields = fields.filter((field) => isFiduciary(field.id, field.label))

    assert.equal(fields.some((field) => field.source === "xlsm-label"), false)
    assert.equal(selectedFields.some((field) => isSatXlsmFieldActive(field, values)), true)
    assert.equal(oppositeFields.every((field) => !isSatXlsmFieldActive(field, values)), true)
    assert.equal(fiduciaryFields.every((field) => !isSatXlsmFieldActive(field, values)), true)

    const selectedRequired = fields.filter((field) =>
      isSatXlsmFieldRequired(field, { "beneficiario.tipo_persona": scenario.type }),
    )
    assert.equal(selectedRequired.length > 0, true)
    assert.equal(selectedRequired.every((field) => branchForField(field.cell) === scenario.selected), true)
    assert.equal(selectedRequired.some((field) => isFiduciary(field.id, field.label)), false)
    const selectedMissing = selectedRequired
      .filter((field) => !(values[field.id] ?? "").trim())
    assert.equal(selectedMissing.some((field) => branchForField(field.cell) === scenario.opposite), false)
    assert.equal(selectedMissing.some((field) => isFiduciary(field.id, field.label)), false)

    const staleOpposite = oppositeFields[0]
    const staleFiduciary = fiduciaryFields[0]
    assert.ok(staleOpposite)
    assert.ok(staleFiduciary)
    const pruned = pruneInactiveSatFieldValues({
      fields,
      values: {
        ...values,
        [staleOpposite.id]: "VALOR OBSOLETO",
        [staleFiduciary.id]: "VALOR FIDUCIARIO OBSOLETO",
      },
    })
    assert.equal(pruned[staleOpposite.id], undefined)
    assert.equal(pruned[staleFiduciary.id], undefined)

    const inmueblesForm = buildSatDynamicOperationForm({
      template: inmueblesTemplate,
      layout: inmueblesLayout,
      prefill: scenario.prefill,
    })
    const repeatedField = inmueblesForm.sections
      .flatMap((section) => section.fields)
      .find(
        (field) =>
          field.sectionKind === "beneficiario_controlador" &&
          field.repeatIndex === 2 &&
          field.repeatGroup?.endsWith(`_${scenario.selected}`),
      )
    assert.ok(repeatedField)
    assert.equal(isSatXlsmFieldActive(repeatedField, inmueblesForm.initialValues), false)
    const prunedRepeated = pruneInactiveSatFieldValues({
      fields: inmueblesForm.sections.flatMap((section) => section.fields),
      values: { ...inmueblesForm.initialValues, [repeatedField.id]: "VALOR REPETIDO OBSOLETO" },
    })
    assert.equal(prunedRepeated[repeatedField.id], undefined)
  }
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
      "Acto u operación!F70": "10000000.00",
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
  assert.equal(acto.F70.v, 10_000_000)
  assert.match(sheet, /4850000/)
  assert.match(sheet, /10000000/)
  assert.match(sheet, /2500000/)
  assert.equal(filled.writtenCells.includes("Persona Objeto del aviso!C4"), true)
  assert.equal(filled.writtenCells.includes("Beneficiario controlador!B5"), true)
  assert.equal(filled.writtenCells.includes("Acto u operación!C42"), true)
  assert.equal(filled.writtenCells.includes("Acto u operación!B43"), true)
  assert.equal(filled.writtenCells.includes("Acto u operación!C71"), true)
})
