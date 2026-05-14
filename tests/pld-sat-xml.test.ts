import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import { unzipSync } from "fflate"
import * as XLSX from "xlsx"

import {
  buildDefaultPldTenants,
  buildPldOperationalCase,
  buildSatWorkbookDownloadValues,
  compareSatXmlCanonical,
  extractSatXlsmLayoutFromBuffer,
  fillSatXlsmTemplate,
  generateSatOutputPackage,
  getSatTemplateCachePath,
  resolveSatFormatoForActividad,
  resolveSatTemplateForActividad,
  SAT_FORMATOS_ACTIVIDADES,
} from "../lib/pld"
import { buildPldDemoDataset } from "../lib/demo/pld-demo-data"

const repoRoot = process.cwd()

const completedEvidence = {
  "pm-acta-constitutiva": true,
  "pm-rfc-constancia": true,
  "pm-domicilio": true,
  "pm-poderes-representante": true,
  "pm-identificacion-representante": true,
  "pm-beneficiario-controlador": true,
  "operacion-soporte": true,
  "operacion-forma-pago": true,
}

function buildF4594SatFieldValues() {
  return {
    "persona_aviso.sujeto_obligado_rfc": "FSC220908AC2",
    "persona_aviso.periodo": "202505",
    "persona_aviso.referencia": "AV202505",
    "persona_aviso.prioridad": "1,NORMAL",
    "persona_aviso.tipo_alerta": "100,Sin alerta.",
    "persona_aviso.pm.razon_social": "LOGISALL MEXICO S DE RL DE CV",
    "persona_aviso.pm.fecha_constitucion": "25/11/2016",
    "persona_aviso.pm.rfc": "LME161125GY9",
    "persona_aviso.pm.pais_nacionalidad": "MEXICO,MX",
    "persona_aviso.pm.giro_mercantil": "INDUSTRIA - PLASTICO Y DEL HULE||3260005",
    "persona_aviso.representante.nombre": "LEE",
    "persona_aviso.representante.apellido_paterno": "CHUNWOO",
    "persona_aviso.representante.apellido_materno": "N",
    "persona_aviso.representante.fecha_nacimiento": "23/09/1977",
    "persona_aviso.representante.curp": "LEXC770923HNEXXH07",
    "persona_aviso.domicilio_nacional.codigo_postal": "66650",
    "persona_aviso.domicilio_nacional.colonia": "PESQUERIA",
    "persona_aviso.domicilio_nacional.calle": "ARMONIA",
    "persona_aviso.domicilio_nacional.numero_exterior": "104",
    "persona_aviso.contacto.pais_telefono": "MEXICO,MX",
    "persona_aviso.contacto.telefono": "66926318336",
    "persona_aviso.contacto.correo": "SANTANA@LOGISALL.COM",
    "acto.fecha_operacion": "26/05/2025",
    "acto.tipo_operacion": "1501,Arrendamiento de inmuebles",
    "inmueble.tipo_bien": "11,Nave Industrial",
    "inmueble.valor_referencia": "58569267",
    "inmueble.codigo_postal": "66679",
    "inmueble.colonia": "LA ARENA",
    "inmueble.calle": "CARRETERA PESQUERIA-LOS RAMONES",
    "inmueble.numero_exterior": "KM 11",
    "inmueble.folio_real": "06019003",
    "inmueble.fecha_inicio": "01/05/2025",
    "inmueble.fecha_termino": "31/05/2025",
    "pago.fecha": "26/05/2025",
    "pago.forma_pago": "1,Contado",
    "pago.instrumento_monetario": "8,Transferencia Interbancaria",
    "pago.moneda": "2,Dólar estadounidense",
    "pago.monto": "148092.99",
  }
}

function buildF4594Case() {
  const tenant = {
    ...buildDefaultPldTenants("tenant-f4594").tenants[0],
    id: "tenant-f4594",
    rfc: "FSC220908AC2",
    razonSocial: "F4594 SUJETO OBLIGADO DEMO",
  }

  return buildPldOperationalCase({
    tenant,
    periodo: "202505",
    actividadKey: "fraccion-xv-uso-goce",
    clienteId: "cliente-LME161125GY9",
    clienteNombre: "LOGISALL MEXICO S DE RL DE CV",
    clienteRfc: "LME161125GY9",
    tipoCliente: "pm_mexicana",
    fechaOperacion: "2025-05-26",
    montoMxn: 148092.99,
    formaPago: "1,Contado",
    completedEvidence,
    satTemplateId: "sat-fraccion-xv-arrendamiento",
    satTemplateVariant: "sat-fraccion-xv-arrendamiento",
    satTemplateFile: "Arrendamiento_v4_5.xlsm",
    satFieldValues: buildF4594SatFieldValues(),
    satMissingRequiredFields: [],
    satWorkbookStatus: "listo",
    actor: "Fixture F4594",
  })
}

test("Fracción XV uses the official ARI XML metadata from the SAT workbook", () => {
  const formato = resolveSatFormatoForActividad("fraccion-xv-uso-goce")

  assert.equal(formato.claveActividad, "ARI")
  assert.equal(formato.xmlActivityCode, "ARI")
  assert.equal(formato.xmlNamespace, "http://www.uif.shcp.gob.mx/recepcion/ari")
  assert.equal(formato.xmlSchemaLocation, "http://www.uif.shcp.gob.mx/recepcion/ari ari.xsd")
})

test("F4594 demo operation generates XML equivalent to the SAT macro output", () => {
  const expected = readFileSync(
    path.join(repoRoot, "tests/fixtures/sat/f4594-arrendamiento-av202505.xml"),
    "utf8",
  )
  const satPackage = generateSatOutputPackage(buildF4594Case())
  const comparison = compareSatXmlCanonical(satPackage.xml, expected)

  assert.equal(satPackage.validation.status, "listo")
  assert.equal(comparison.equivalent, true, comparison.diff)
  assert.doesNotMatch(satPackage.xml, /tipo_salida|borrador_no_cargable|validacion|trazabilidad|formato_sat/)
})

test("F4594 values fill the official Arrendamiento workbook cells with SAT-compatible types", () => {
  const template = resolveSatTemplateForActividad("fraccion-xv-uso-goce")
  const workbookPath = path.join(repoRoot, getSatTemplateCachePath(template))
  assert.equal(existsSync(workbookPath), true, "Run pnpm sync:sat:formatos to cache official SAT XLSM templates")
  const layout = extractSatXlsmLayoutFromBuffer(readFileSync(workbookPath), template)
  const values = buildSatWorkbookDownloadValues({
    satTemplateId: template.templateId,
    values: buildF4594SatFieldValues(),
    tenantRfc: "FSC220908AC2",
    periodo: "202505",
    outputKind: "aviso_normal",
    clienteNombre: "LOGISALL MEXICO S DE RL DE CV",
    clienteRfc: "LME161125GY9",
    packageId: "satpkg-f4594-av202505",
  })
  const filled = fillSatXlsmTemplate(readFileSync(workbookPath), {
    template,
    values,
    layout,
  })
  const zip = unzipSync(filled.workbook)
  const workbook = XLSX.read(Buffer.from(filled.workbook), { type: "buffer", bookVBA: true, cellFormula: true })
  const persona = workbook.Sheets["Persona Objeto del aviso"]
  const acto = workbook.Sheets["Acto u operación"]

  assert.equal(Boolean(zip["xl/vbaProject.bin"]), true)
  assert.equal(filled.status, "filled")
  assert.deepEqual(filled.missingRequiredFields, [])
  assert.equal(persona.C4.v, "FSC220908AC2")
  assert.equal(persona.C5.v, "202505")
  assert.equal(persona.C6.v, "AV202505")
  assert.equal(persona.B33.v, "LOGISALL MEXICO S DE RL DE CV")
  assert.equal(persona.C33.v, 42699)
  assert.equal(persona.B60.v, "66650")
  assert.equal(persona.E60.v, "PESQUERIA")
  assert.equal(acto.C4.v, 45803)
  assert.equal(acto.C5.v, "1501,Arrendamiento de inmuebles")
  assert.equal(acto.B12.v, "11,Nave Industrial")
  assert.equal(acto.C12.v, 58569267)
  assert.equal(acto.D12.v, "66679")
  assert.equal(acto.L12.v, 45778)
  assert.equal(acto.M12.v, 45808)
  assert.equal(acto.B27.v, 45803)
  assert.equal(acto.F27.v, 148092.99)
})

test("demo dataset includes the F4594 SAT validation scenario", () => {
  const dataset = buildPldDemoDataset(new Date("2026-05-13T12:00:00-06:00"))
  const packages = dataset["pld-sat-output-packages"] as any[]
  const f4594 = packages.find((item) => item.id.includes("f4594") || item.xmlFileName.includes("AV202505"))

  assert.equal(Boolean(f4594), true)
  assert.equal(f4594.outputKind, "aviso_normal")
  assert.equal(f4594.satTemplateId, "sat-fraccion-xv-arrendamiento")
  assert.equal(f4594.satFieldValues["persona_aviso.referencia"], "AV202505")
  assert.match(f4594.xml, /<clave_actividad>ARI<\/clave_actividad>/)
})

test("all SAT formats expose XML metadata for official package generation", () => {
  const missing = SAT_FORMATOS_ACTIVIDADES.filter(
    (item) => !item.xmlActivityCode || !item.xmlNamespace || !item.xmlSchemaLocation || !item.xmlLayoutId,
  ).map((item) => item.id)

  assert.deepEqual(missing, [])
})
