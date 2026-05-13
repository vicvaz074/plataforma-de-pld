import assert from "node:assert/strict"
import test from "node:test"

import {
  SAT_FORMATOS_ACTIVIDADES,
  buildPldSubjectRegistrationLinks,
  buildDefaultPldTenants,
  buildPldOperationalCase,
  buildSatFormatSnapshot,
  evaluateOperationalEvidenceDecision,
  evaluatePldEbrMethodology,
  generateSatOutputPackage,
  generateSatXml,
  getSatLayoutForActividad,
  resolveSatFormatoForActividad,
} from "../lib/pld"
import { buildPldDemoDataset } from "../lib/demo/pld-demo-data"

test("multi-client defaults create an active tenant without storing e.firma secrets", () => {
  const tenants = buildDefaultPldTenants("tenant-demo-001")

  assert.equal(tenants.activeTenantId, "tenant-demo-001")
  assert.equal(tenants.tenants.length, 1)
  assert.equal(tenants.tenants[0].rfc, "ISN2103158Q7")
  assert.equal(tenants.tenants[0].actividades.some((item) => item.actividadKey === "fraccion-vi-metales"), true)
  assert.equal("efirmaPassword" in tenants.tenants[0], false)
  assert.equal("cer" in tenants.tenants[0], false)
  assert.equal("key" in tenants.tenants[0], false)
})

test("SAT format manifest covers every Article 17 fraction and official notice/zero-report outputs", () => {
  const expectedFractions = [
    "Fracción I",
    "Fracción II",
    "Fracción III",
    "Fracción IV",
    "Fracción V",
    "Fracción V Bis",
    "Fracción VI",
    "Fracción VII",
    "Fracción VIII",
    "Fracción IX",
    "Fracción X",
    "Fracción XI",
    "Fracción XII",
    "Fracción XIII",
    "Fracción XIV",
    "Fracción XV",
    "Fracción XVI",
  ]

  for (const fraction of expectedFractions) {
    assert.equal(SAT_FORMATOS_ACTIVIDADES.some((item) => item.fraccion === fraction), true, fraction)
  }

  const metales = resolveSatFormatoForActividad("fraccion-vi-metales")
  assert.equal(metales.avisoUrl?.endsWith("/Fraccion_VI/metalesyjoyas.zip"), true)
  assert.equal(metales.informeCerosUrl?.endsWith("/Fraccion_VI/informeenceros.zip"), true)
  assert.equal(metales.officialXlsmName, "MetalesyJoyas_v4_3.xlsm")

  const comercioExterior = resolveSatFormatoForActividad("fraccion-xiv-aduanal-a")
  assert.equal(comercioExterior.outputModes.includes("informe_ceros"), true)
  assert.equal(comercioExterior.outputModes.includes("aviso_normal"), true)
  assert.equal(comercioExterior.avisoUrl?.endsWith("/Fraccion_XIV/aviso.zip"), true)
})

test("SAT format snapshot stores official ZIP metadata and current XLSM names", () => {
  const snapshot = buildSatFormatSnapshot()
  const inmuebles = resolveSatFormatoForActividad("fraccion-v-inmuebles")
  const vBis = resolveSatFormatoForActividad("fraccion-v-bis-desarrollo")
  const xvi = resolveSatFormatoForActividad("fraccion-xvi-activos-virtuales")

  assert.equal(snapshot.schemaVersion, 1)
  assert.equal(snapshot.items.length, SAT_FORMATOS_ACTIVIDADES.length)
  assert.equal(inmuebles.officialXlsmName, "Inmuebles_v4_5.xlsm")
  assert.equal(inmuebles.officialZipLastModified, "Fri, 24 Apr 2026 19:31:40 GMT")
  assert.equal(inmuebles.officialZipSize, 4230906)
  assert.equal(vBis.officialXlsmName, "DesarrollosInmobiliarios_v4_7.xlsm")
  assert.equal(xvi.officialXlsmName, "ActivosVirtuales_v1.2.xlsm")
  assert.equal(SAT_FORMATOS_ACTIVIDADES.every((item) => item.anexo && item.layoutStatus), true)
})

test("SAT layouts cover all configured activity keys with official XML base tags", () => {
  const actividadKeys = SAT_FORMATOS_ACTIVIDADES.flatMap((item) => item.actividadKeys)

  for (const actividadKey of actividadKeys) {
    const layout = getSatLayoutForActividad(actividadKey)
    const tags = layout.requiredFields.map((field) => field.xmlTag)
    assert.equal(tags.includes("mes_reportado"), true, actividadKey)
    assert.equal(tags.includes("sujeto_obligado"), true, actividadKey)
    assert.equal(tags.includes("clave_actividad"), true, actividadKey)
    assert.equal(layout.outputKinds.length > 0, true, actividadKey)
  }
})

test("operational case classifies SAT output and keeps tenant, evidence and audit trail data", () => {
  const tenants = buildDefaultPldTenants("tenant-demo-001")
  const tenant = tenants.tenants[0]
  const operationalCase = buildPldOperationalCase({
    tenant,
    periodo: "202605",
    actividadKey: "fraccion-vi-metales",
    clienteId: "cliente-rfc-demo",
    clienteNombre: "Distribuidora Lomas Verdes, S.A. de C.V.",
    tipoCliente: "pm_mexicana",
    fechaOperacion: "2026-05-11",
    montoMxn: 190000,
    formaPago: "transferencia",
    sospecha24h: false,
    supuesto27Bis: false,
    completedEvidence: {
      "pm-acta-constitutiva": true,
      "pm-rfc-constancia": true,
      "pm-domicilio": true,
      "pm-poderes-representante": true,
      "pm-identificacion-representante": true,
      "pm-beneficiario-controlador": true,
      "operacion-soporte": true,
      "operacion-forma-pago": true,
    },
  })

  assert.equal(operationalCase.tenantId, tenant.id)
  assert.equal(operationalCase.periodo, "202605")
  assert.equal(operationalCase.satOutputStatus.kind, "aviso_normal")
  assert.equal(operationalCase.evidenceStatus.canClose, true)
  assert.equal(operationalCase.satFormatoId, "sat-fraccion-vi-metales")
  assert.equal(operationalCase.auditTrail.some((event) => event.action === "case_created"), true)
})

test("operational evidence allows saving, blocks closing, and lets 24h notice continue with narrative", () => {
  const blocked = evaluateOperationalEvidenceDecision({
    tipoCliente: "pm_mexicana",
    actividadKey: "fraccion-viii-vehiculos",
    completed: {},
    justifications: {},
    outputKind: "aviso_normal",
  })

  assert.equal(blocked.canSave, true)
  assert.equal(blocked.canClose, false)
  assert.equal(blocked.closingBlockedReasons.some((reason) => reason.includes("Acta constitutiva")), true)

  const urgent = evaluateOperationalEvidenceDecision({
    tipoCliente: "pm_mexicana",
    actividadKey: "fraccion-viii-vehiculos",
    completed: {},
    justifications: {},
    outputKind: "aviso_24h",
    suspicionNarrative: "Cliente rechaza identificarse y existen indicios documentados por el responsable de cumplimiento.",
  })

  assert.equal(urgent.canSave, true)
  assert.equal(urgent.canClose, false)
  assert.equal(urgent.canContinueForSatOutput, true)
  assert.equal(urgent.recommendedActions.some((action) => action.includes("24 horas")), true)
})

test("EBR methodology applies 30/30/20/20 weighting and mitigants to residual risk", () => {
  const evaluation = evaluatePldEbrMethodology({
    actividadKey: "fraccion-vi-metales",
    cliente: {
      tipoPersona: "pm_mexicana",
      actividadEconomica: "Comercializadora con alto flujo de efectivo",
      pepStatus: "posible_coincidencia",
      beneficiarioControladorIdentificado: false,
      listasRestrictivas: "sin-coincidencia",
      congruenciaTransaccional: "inconsistente",
    },
    productoServicio: {
      altoValor: true,
      portabilidad: true,
      transferibilidad: true,
      anonimato: false,
      efectivo: false,
    },
    canal: {
      tipo: "no_presencial",
      intermediario: true,
    },
    geografia: {
      zonaRiesgo: "alta_incidencia",
      frontera: true,
    },
    controles: {
      gobiernoCorporativo: "alta",
      representanteCumplimiento: "alta",
      manualPld: "media",
      capacitacion: "media",
      monitoreoAutomatizado: "media",
      auditoria: "media",
      kyc: "media",
      beneficiarioControlador: "baja",
      resguardoDocumental: "alta",
      presentacionAvisos: "alta",
    },
  })

  assert.deepEqual(evaluation.weights, {
    clientesUsuarios: 0.3,
    productosServicios: 0.3,
    canalesTransacciones: 0.2,
    geografia: 0.2,
  })
  assert.equal(evaluation.inherent.level, "Alto")
  assert.equal(evaluation.residual.level === "Medio-Alto" || evaluation.residual.level === "Medio", true)
  assert.equal(evaluation.actionPlan.some((action) => action.priority === "Prioridad 1"), true)
})

test("SAT XML generation validates required data and escapes special characters", () => {
  const tenants = buildDefaultPldTenants("tenant-demo-001")
  const tenant = tenants.tenants[0]
  const operationalCase = buildPldOperationalCase({
    tenant,
    periodo: "202605",
    actividadKey: "fraccion-vi-metales",
    clienteId: "cliente-rfc-demo",
    clienteNombre: "Relojes & Joyas del Centro <Sucursal Norte>",
    clienteRfc: "RJC240101AB1",
    tipoCliente: "pm_mexicana",
    fechaOperacion: "2026-05-11",
    montoMxn: 250000,
    formaPago: "transferencia",
    sospecha24h: true,
    alertaCodigo: "2901",
    alertaDescripcion: "Cliente se rehusa a proporcionar documentos & solicita facturar a tercero.",
    suspicionNarrative: "Se cuenta con indicios documentados por el responsable.",
    completedEvidence: {
      "pm-acta-constitutiva": true,
      "pm-rfc-constancia": true,
      "pm-domicilio": true,
      "pm-poderes-representante": true,
      "pm-identificacion-representante": true,
      "pm-beneficiario-controlador": true,
      "operacion-soporte": true,
      "operacion-forma-pago": true,
    },
  })

  const result = generateSatXml(operationalCase)

  assert.equal(result.valid, true)
  assert.equal(result.errors.length, 0)
  assert.equal(result.fileName, "aviso-fraccion-vi-202605-RJC240101AB1.xml")
  assert.match(result.xml, /<mes_reportado>202605<\/mes_reportado>/)
  assert.match(result.xml, /Relojes &amp; Joyas del Centro &lt;Sucursal Norte&gt;/)
  assert.match(result.xml, /Cliente se rehusa a proporcionar documentos &amp; solicita facturar a tercero/)
  assert.match(result.xml, /<tipo_salida>aviso_24h<\/tipo_salida>/)
  assert.match(result.xml, /<prioridad>2<\/prioridad>/)
  assert.match(result.xml, /<detalle_operaciones>/)
  assert.doesNotMatch(result.xml, /sat-local-first-v1/)
})

test("SAT output packages distinguish ready XML, blocked draft, zero report and 27 Bis", () => {
  const tenants = buildDefaultPldTenants("tenant-demo-001")
  const tenant = tenants.tenants[0]
  const baseCase = buildPldOperationalCase({
    tenant,
    periodo: "202605",
    actividadKey: "fraccion-xv-uso-goce",
    clienteId: "cliente-arr-demo",
    clienteNombre: "Arrendadora Delta, S.A. de C.V.",
    clienteRfc: "ADE240101QW2",
    tipoCliente: "pm_mexicana",
    fechaOperacion: "2026-05-05",
    montoMxn: 500000,
    formaPago: "transferencia",
    completedEvidence: {
      "pm-acta-constitutiva": true,
      "pm-rfc-constancia": true,
      "pm-domicilio": true,
      "pm-poderes-representante": true,
      "pm-identificacion-representante": true,
      "pm-beneficiario-controlador": true,
      "operacion-soporte": true,
      "operacion-forma-pago": true,
    },
  })

  const ready = generateSatOutputPackage(baseCase)
  assert.equal(ready.validation.status, "listo")
  assert.equal(ready.downloads.some((download) => download.kind === "official_template"), true)
  assert.match(ready.xml, /<monto_operacion>500000.00<\/monto_operacion>/)

  const blocked = generateSatOutputPackage({
    ...baseCase,
    tenantRfc: "",
    clienteNombre: "",
  })
  assert.equal(blocked.validation.status, "borrador_bloqueado")
  assert.equal(blocked.validation.missingFields.includes("sujeto_obligado.rfc"), true)
  assert.match(blocked.xml, /<borrador_no_cargable>SI<\/borrador_no_cargable>/)

  const zeroReport = generateSatOutputPackage({
    ...baseCase,
    satOutputStatus: {
      ...baseCase.satOutputStatus,
      kind: "informe_ceros",
    },
  })
  assert.equal(zeroReport.outputKind, "informe_ceros")
  assert.match(zeroReport.xml, /<sin_operaciones>1<\/sin_operaciones>/)

  const bis27 = generateSatOutputPackage({
    ...baseCase,
    satOutputStatus: {
      ...baseCase.satOutputStatus,
      kind: "informe_27_bis",
    },
  })
  assert.equal(bis27.outputKind, "informe_27_bis")
  assert.match(bis27.xml, /<exento>1<\/exento>/)
})

test("demo dataset links SAT registration, EUI and prebuilt SAT output packages", () => {
  const dataset = buildPldDemoDataset(new Date("2026-05-08T12:00:00-06:00"))
  const registro = dataset["registro-sat-data"] as any
  const expedientes = dataset.kyc_expedientes_detalle as any[]
  const packages = dataset["pld-sat-output-packages"] as any[]
  const snapshot = dataset["pld-sat-format-snapshot"] as any
  const links = buildPldSubjectRegistrationLinks({
    registroSat: registro,
    tenantsState: dataset["pld-tenants"],
    expedientes,
  })

  assert.equal(registro.sujetosRegistrados[0].identificacion.rfc, "ISN2103158Q7")
  assert.equal(expedientes.some((item) => item.sujetoObligadoId === registro.sujetosRegistrados[0].id), true)
  assert.equal(links.some((link) => link.sujetoObligadoRfc === "ISN2103158Q7" && link.euiCount > 0), true)
  assert.equal(snapshot.items.length, SAT_FORMATOS_ACTIVIDADES.length)
  assert.equal(packages.some((item) => item.outputKind === "aviso_normal"), true)
  assert.equal(packages.some((item) => item.outputKind === "informe_ceros"), true)
  assert.equal(packages.some((item) => item.outputKind === "informe_27_bis"), true)
  assert.equal(packages.some((item) => item.outputKind === "aviso_24h"), true)
  const avisoNormal = packages.find((item) => item.outputKind === "aviso_normal")
  assert.equal(avisoNormal.satTemplateFile, "Inmuebles_v4_5.xlsm")
  assert.equal(avisoNormal.satWorkbookStatus, "listo")
  assert.equal(avisoNormal.downloads.some((download: any) => download.kind === "filled_workbook"), true)
  assert.equal(Boolean(avisoNormal.satFieldValues["inmueble.valor_pactado"]), true)
})
