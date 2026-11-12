import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { unzipSync } from "fflate"
import XLSX from "xlsx"

import { buildPldOperationalCase } from "../lib/pld/operational-flow"
import { PERSONA_OBJETO_TYPE_FIELD_ID } from "../lib/pld/sat-field-controls"
import { normalizeSatFieldValues } from "../lib/pld/sat-field-values"
import { generateSatOutputPackage } from "../lib/pld/sat-outputs"
import { buildSatQueueItems, upsertLinkedSatPackage } from "../lib/pld/sat-queue"
import {
  buildSatDynamicOperationForm,
  buildSatWorkbookDownloadValues,
  fillSatXlsmTemplate,
  satFieldValuesToWorkbookCells,
} from "../lib/pld/sat-xlsm"
import { buildDefaultPldTenants } from "../lib/pld/tenants"
import type { SatXlsmLayout } from "../lib/pld/types"
import { isSatXlsmFieldActive, isSatXlsmFieldRequired, pruneInactiveSatFieldValues } from "../lib/pld/ui-workflow"

// Independent manual PF acceptance case, not the synthetic required-field filler.
// Coordinates/catalogs: current Arrendamiento_v4_5 linked by SAT/SPPLD,
// checked 2026-11-11: https://sppld.sat.gob.mx/pld/interiores/arrendamiento.html
// Successful local XSD validation is not acceptance or presentation before SAT.
const template = { templateId: "sat-fraccion-xv-arrendamiento", officialXlsmName: "Arrendamiento_v4_5.xlsm" }
const layout: SatXlsmLayout = JSON.parse(readFileSync("public/data/sat-xlsm-layouts/sat-fraccion-xv-arrendamiento.json", "utf8"))
const operationId = "qa-xv-persona-fisica-20261111"
const amountCents = 1_000_000_001
const tenant = {
  ...buildDefaultPldTenants("qa-xv-company-a").tenants[0],
  id: "qa-xv-company-a",
  rfc: "QAA261111AA1",
  razonSocial: "EMPRESA FICTICIA QA ARRENDAMIENTO SA DE CV",
}

function manualCapture() {
  const form = buildSatDynamicOperationForm({
    template,
    layout,
    prefill: {
      sujetoObligadoRfc: tenant.rfc,
      periodo: "202611",
      clienteNombre: "ANA QA PRUEBA FLUJO",
      clienteTipoPersona: "persona_fisica",
      clienteNombrePf: "ANA QA",
      clienteApellidoPaterno: "PRUEBA",
      clienteApellidoMaterno: "FLUJO",
      clienteFechaNacimiento: "01/01/1990",
      clienteRfc: "PUFA900101AB1",
      clientePais: "MEXICO,MX",
      clienteActividadEconomica: "8240200",
      clienteDomicilioAmbito: "nacional",
      clienteCodigoPostal: "11560",
      clienteColonia: "POLANCO V SECCION",
      clienteCalle: "VIALIDAD FICTICIA DE PRUEBA QA",
      clienteNumeroExterior: "101",
      clientePaisTelefono: "MEXICO,MX",
      clienteTelefono: "5555550101",
      clienteCorreo: "QA.FLUJO@EXAMPLE.TEST",
      beneficiarioTipoPersonaSat: "persona_fisica",
      beneficiarioPfNombre: "BRUNO QA",
      beneficiarioPfApellidoPaterno: "CONTROL",
      beneficiarioPfApellidoMaterno: "PRUEBA",
      beneficiarioPfFechaNacimiento: "02/02/1985",
      beneficiarioPfRfc: "CAPB850202AB2",
      beneficiarioPfPais: "MEXICO,MX",
      montoMxn: "10000000.01",
    },
  })
  // These are the actual fields a person completes after selecting the client.
  // Reference value, rent, addresses and dates intentionally remain independent.
  const values: Record<string, string> = {
    ...form.initialValues,
    "persona_aviso.referencia": "QA111126",
    "persona_aviso.prioridad": "1,NORMAL",
    "persona_aviso.tipo_alerta": "100,Sin alerta.",
    "acto.fecha_operacion": "11/11/2026",
    "acto.tipo_operacion": "1501,Arrendamiento de inmuebles",
    "inmueble.tipo_bien": "8,Oficina",
    "inmueble.valor_referencia": "20000000.00",
    "inmueble.codigo_postal": "11560",
    "inmueble.colonia": "POLANCO V SECCION",
    "inmueble.calle": "INMUEBLE FICTICIO QA",
    "inmueble.numero_exterior": "202",
    "inmueble.folio_real": "QA202611001",
    "inmueble.fecha_inicio": "01/11/2026",
    "inmueble.fecha_termino": "30/11/2026",
    "pago.fecha": "11/11/2026",
    "pago.forma_pago": "1,Contado",
    "pago.instrumento_monetario": "8,Transferencia Interbancaria",
    // Included to reproduce editing an old capture that had selected PM first.
    "persona_aviso.pm.razon_social": "DATO PM OBSOLETO NO EXPORTAR",
    "persona_aviso.pm.rfc": "DPO261111AA1",
    "persona_aviso.representante.nombre": "REPRESENTANTE OBSOLETO",
    "Persona Objeto del aviso!B33": "DATO PM OBSOLETO NO EXPORTAR",
    "Persona Objeto del aviso!B46": "REPRESENTANTE OBSOLETO",
  }
  const fields = form.sections.flatMap(section => section.fields)
  const activeValues = pruneInactiveSatFieldValues({ fields, values })
  return { form, fields, values, activeValues }
}

function missingFields(fields: ReturnType<typeof manualCapture>["fields"], values: Record<string, string>) {
  return fields.filter(field => isSatXlsmFieldRequired(field, values) && !values[field.id]?.trim()).map(field => field.id)
}

test("manual XV PF capture reaches a complete operation, official local XML/XLSM and one linked SAT queue row", () => {
  const { form, fields, values, activeValues } = manualCapture()
  assert.equal(form.initialValues[PERSONA_OBJETO_TYPE_FIELD_ID], "persona_fisica")
  assert.equal(form.initialValues["persona_aviso.pf.rfc"], "PUFA900101AB1")
  assert.equal(form.initialValues["beneficiario.pf.rfc"], "CAPB850202AB2")
  assert.deepEqual(missingFields(fields, activeValues), [], "A real PF must not need PM or representative fields")
  assert.equal(isSatXlsmFieldActive(fields.find(field => field.id === "persona_aviso.pf.nombre")!, activeValues), true)
  for (const field of fields.filter(field => field.id.startsWith("persona_aviso.pm.") || field.id.startsWith("persona_aviso.representante."))) {
    assert.equal(isSatXlsmFieldActive(field, activeValues), false, field.id)
    assert.equal(isSatXlsmFieldRequired(field, activeValues), false, field.id)
    assert.equal(activeValues[field.id], undefined, field.id)
    assert.equal(activeValues[`${field.sheetName}!${field.cell}`], undefined, "Raw cell aliases must obey the same branch")
  }
  const persistedValues: Record<string, string> = JSON.parse(JSON.stringify(activeValues))
  const cells = satFieldValuesToWorkbookCells(persistedValues, layout)
  assert.equal(cells["Persona Objeto del aviso!B19"], "ANA QA")
  assert.equal(cells["Persona Objeto del aviso!F19"], "PUFA900101AB1")
  assert.equal(cells["Persona Objeto del aviso!B33"], undefined)
  assert.equal(cells["Persona Objeto del aviso!B46"], undefined)
  assert.equal(cells["Acto u operación!F27"], "10000000.01")

  const operationalCase = buildPldOperationalCase({
    tenant,
    captureStatus: "complete",
    periodo: "202611",
    actividadKey: "fraccion-xv-uso-goce",
    clienteId: "qa-cliente-ana-pf",
    clienteNombre: "ANA QA PRUEBA FLUJO",
    clienteRfc: "PUFA900101AB1",
    tipoCliente: "pf_mexicana",
    fechaOperacion: "2026-11-11",
    montoMxn: 10_000_000.01,
    montoCentavos: amountCents,
    formaPago: "1,Contado",
    completedEvidence: {
      "pf-identificacion-oficial": true,
      "pf-curp-rfc": true,
      "pf-domicilio": true,
      "pf-beneficiario-controlador": true,
      "operacion-soporte": true,
      "operacion-forma-pago": true,
    },
    satTemplateId: template.templateId,
    satTemplateFile: template.officialXlsmName,
    satTemplateVariant: template.templateId,
    satFieldValues: persistedValues,
    satCellValues: cells, // Exercises the actual extracted VBA XML program, not the semantic fallback.
    satMissingRequiredFields: missingFields(fields, persistedValues),
    satWorkbookStatus: "listo",
    actor: "QA ficticio PF XV",
  })
  const satPackage = generateSatOutputPackage(operationalCase, { sourceOperationId: operationId, sourceOperationRevision: 1 })
  assert.equal(satPackage.validation.status, "listo", JSON.stringify(satPackage.validation))
  assert.equal(satPackage.outputKind, "aviso_normal")
  assert.match(satPackage.xml, /<persona_fisica>/)
  assert.match(satPackage.xml, /<nombre>ANA QA<\/nombre>/)
  assert.match(satPackage.xml, /<rfc>PUFA900101AB1<\/rfc>/)
  assert.match(satPackage.xml, /<nombre>BRUNO QA<\/nombre>/)
  assert.match(satPackage.xml, /<monto_operacion>10000000\.01<\/monto_operacion>/)
  assert.doesNotMatch(satPackage.xml, /persona_moral|representante|OBSOLETO/)
  const xsd = spawnSync("xmllint", ["--nonet", "--noout", "--schema", path.resolve("tests/fixtures/sat-official/ari.xsd"), "-"], {
    input: satPackage.xml, encoding: "utf8",
  })
  assert.ifError(xsd.error)
  assert.equal(xsd.status, 0, xsd.stderr)

  const original = readFileSync("public/sat-templates/sat-fraccion-xv-arrendamiento/Arrendamiento_v4_5.xlsm")
  const downloadValues = buildSatWorkbookDownloadValues({
    satTemplateId: template.templateId, values, tenantRfc: tenant.rfc, periodo: "202611",
    outputKind: "aviso_normal", clienteNombre: "ANA QA PRUEBA FLUJO", clienteRfc: "PUFA900101AB1", packageId: satPackage.id,
  })
  const filled = fillSatXlsmTemplate(original, { template, layout, values: downloadValues })
  assert.equal(filled.status, "filled", JSON.stringify(filled.missingRequiredFields))
  assert.deepEqual(filled.missingRequiredFields, [])
  const workbook = XLSX.read(filled.workbook, { type: "array", cellFormula: true })
  const person = workbook.Sheets["Persona Objeto del aviso"]
  const act = workbook.Sheets["Acto u operación"]
  assert.equal(person.B19?.v, "ANA QA")
  assert.equal(person.F19?.v, "PUFA900101AB1")
  assert.equal(person.B33?.v, undefined)
  assert.equal(person.B46?.v, undefined)
  assert.equal(person.F60?.v, "VIALIDAD FICTICIA DE PRUEBA QA")
  assert.equal(act.H12?.v, "INMUEBLE FICTICIO QA")
  assert.equal(act.C12?.v, 20_000_000)
  assert.equal(act.F27?.v, 10_000_000.01)
  assert.equal(act.F27?.t, "n", "The amount remains a typed monetary cell, not a rounded string")
  assert.deepEqual(unzipSync(filled.workbook)["xl/vbaProject.bin"], unzipSync(original)["xl/vbaProject.bin"])

  // Simulates storage round trips and a second reconciliation without matching by RFC.
  const operation = JSON.parse(JSON.stringify({
    id: operationId, revision: 1, actividadKey: "fraccion-xv-uso-goce", cliente: "ANA QA PRUEBA FLUJO",
    rfc: "PUFA900101AB1", periodo: "202611", fechaOperacion: "2026-11-11", montoCentavos: amountCents,
    umbralStatus: "aviso", avisoSalidaTipo: "aviso_normal", captureStatus: "complete", lifecycle: { status: "active" },
  }))
  let packages = upsertLinkedSatPackage([], satPackage)
  packages = upsertLinkedSatPackage(JSON.parse(JSON.stringify(packages)), satPackage)
  const queue = buildSatQueueItems({ operations: [operation], packages })
  assert.equal(queue.length, 1)
  assert.equal(queue[0].kind, "sat_output")
  assert.equal(queue[0].sourceOperationId, operationId)
  assert.equal(queue[0].package?.validation.status, "listo")
  assert.equal(queue[0].montoCentavos, amountCents)
})

test("switching the same XV capture to PM deactivates PF and still requires the genuine PM and representative fields", () => {
  const { fields, activeValues } = manualCapture()
  const switched = pruneInactiveSatFieldValues({ fields, values: { ...activeValues, [PERSONA_OBJETO_TYPE_FIELD_ID]: "persona_moral" } })
  assert.equal(switched["persona_aviso.pf.nombre"], undefined)
  assert.equal(switched["persona_aviso.pf.rfc"], undefined)
  const missing = missingFields(fields, switched)
  assert.ok(missing.includes("persona_aviso.pm.razon_social"), JSON.stringify(missing))
  assert.ok(missing.includes("persona_aviso.pm.giro_mercantil"), JSON.stringify(missing))
  assert.ok(missing.includes("persona_aviso.representante.nombre"), JSON.stringify(missing))
  assert.equal(isSatXlsmFieldActive(fields.find(field => field.id === "persona_aviso.representante.nombre")!, switched), true)
  assert.ok(!missing.some(id => id.startsWith("persona_aviso.pf.")))
  const cells = satFieldValuesToWorkbookCells(switched, layout)
  assert.equal(cells["Persona Objeto del aviso!B19"], undefined)
  assert.equal(cells["Persona Objeto del aviso!F19"], undefined)
})

test("saved XV PF extractor IDs and row controls migrate to canonical fields without losing independent people", () => {
  const { fields, activeValues } = manualCapture()
  const legacy = {
    [PERSONA_OBJETO_TYPE_FIELD_ID]: "persona_fisica",
    "persona-objeto-del-aviso.persona-fisica-r19.nombre-s.b19": "ANA QA",
    "persona-objeto-del-aviso.persona-fisica-r19.apellido-paterno.c19": "PRUEBA",
    "persona-objeto-del-aviso.persona-fisica-r19.apellido-materno.d19": "FLUJO",
    "persona-objeto-del-aviso.persona-fisica-r19.fecha-nacimiento.e19": "01/01/1990",
    "persona-objeto-del-aviso.persona-fisica-r19.rfc.f19": "PUFA900101AB1",
    "persona-objeto-del-aviso.persona-fisica-r19.curp.g19": "PUFA900101MDFRNL01",
    "persona-objeto-del-aviso.persona-fisica-r19.pais-de-nacionalidad.h19": "MEXICO,MX",
    "persona-objeto-del-aviso.persona-fisica-r19.actividad-economica.i19": "ADMINISTRACION - CONTADORES Y AUDITORES||8240200",
    "sat.row.persona-objeto-del-aviso.persona-fisica-r19.2": "si",
    "persona-objeto-del-aviso.persona-fisica-r19.nombre-s.2.b20": "SEGUNDA PERSONA QA",
    "persona-objeto-del-aviso.persona-fisica-r19.apellido-paterno.2.c20": "OTRO",
    "persona-objeto-del-aviso.persona-fisica-r19.apellido-materno.2.d20": "CLIENTE",
    "persona-objeto-del-aviso.persona-fisica-r19.pais-de-nacionalidad.2.h20": "MEXICO,MX",
    "persona-objeto-del-aviso.persona-fisica-r19.actividad-economica.2.i20": "ADMINISTRACION - CONSULTORES||8250100",
  }
  const migrated = normalizeSatFieldValues(fields, legacy)
  assert.equal(migrated["persona_aviso.pf.nombre"], "ANA QA")
  assert.equal(migrated["persona_aviso.pf.rfc"], "PUFA900101AB1")
  assert.equal(migrated["persona_aviso.pf.curp"], "PUFA900101MDFRNL01")
  assert.equal(migrated["persona_aviso.pf.2.nombre"], "SEGUNDA PERSONA QA")
  assert.equal(migrated["sat.row.persona-objeto-del-aviso.persona-objeto-pf.2"], "si")
  assert.ok(!Object.keys(migrated).some(key => key.includes("persona-fisica-r19")))
  assert.deepEqual(normalizeSatFieldValues(fields, migrated), migrated)
  const cells = satFieldValuesToWorkbookCells({ ...activeValues, ...legacy }, layout)
  assert.equal(cells["Persona Objeto del aviso!B19"], "ANA QA")
  assert.equal(cells["Persona Objeto del aviso!B20"], "SEGUNDA PERSONA QA")
  assert.equal(cells["Persona Objeto del aviso!I20"], "ADMINISTRACION - CONSULTORES||8250100")
  assert.equal(cells["Persona Objeto del aviso!B21"], undefined)
  const inactiveRow = { ...migrated, "sat.row.persona-objeto-del-aviso.persona-objeto-pf.2": "no" }
  assert.equal(satFieldValuesToWorkbookCells(inactiveRow, layout)["Persona Objeto del aviso!B20"], undefined)
})

test("XV legacy migration stays finite, verifies destination coordinates and rejects conflicting values", () => {
  const { fields } = manualCapture()
  const oldName = "persona-objeto-del-aviso.persona-fisica-r19.nombre-s.b19"
  for (let row = 1; row <= 10; row++) {
    const prefix = row === 1 ? "" : `${row}.`
    const oldId = `persona-objeto-del-aviso.persona-fisica-r19.nombre-s.${prefix}b${18 + row}`
    assert.equal(normalizeSatFieldValues(fields, { [oldId]: `PERSONA ${row}` })[`persona_aviso.pf.${prefix}nombre`], `PERSONA ${row}`)
  }
  const conflicts: Record<string, string>[] = [
    { [oldName]: "ANA QA", "persona_aviso.pf.nombre": "DATO DISTINTO" },
    { "sat.row.persona-objeto-del-aviso.persona-fisica-r19.2": "si", "sat.row.persona-objeto-del-aviso.persona-objeto-pf.2": "no" },
  ]
  for (const values of conflicts) assert.throws(() => normalizeSatFieldValues(fields, values), /no coinciden/)
  for (const key of [
    "persona-objeto-del-aviso.persona-fisica-r19.nombre-s.b33",
    "persona-objeto-del-aviso.persona-fisica-r19.nombre-s.11.b29",
    "persona-objeto-del-aviso.persona-fisica-r19.unknown.i19",
    "sat.row.persona-objeto-del-aviso.persona-fisica-r19.11",
  ]) assert.throws(() => normalizeSatFieldValues(fields, { [key]: "NO ADMITIR" }), /SAT/)
  assert.throws(() => normalizeSatFieldValues([], { [oldName]: "NO OTHER FORMAT" }), /SAT/)
  const displaced = fields.map(field => field.id === "persona_aviso.pf.nombre" ? { ...field, cell: "B33" } : field)
  assert.throws(() => normalizeSatFieldValues(displaced, { [oldName]: "NO WRONG CELL" }), /SAT/)
})
