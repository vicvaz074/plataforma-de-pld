import assert from "node:assert/strict"
import test from "node:test"

import {
  applySatOutputOverride,
  buildBlockingReasonsView,
  buildOperationalMonitoringView,
  buildSatQuestionnaireDedupedFieldView,
  buildSatQuestionnaireFieldView,
  chooseSatTipoOperacionField,
  getActionableSatMissingFieldIds,
  getFixedSatTipoOperacion,
  isSatXlsmFieldActive,
  isSatXlsmFieldRequired,
  isSatFieldManagedByPrimaryCapture,
  expandSatFieldValuesForDuplicateFields,
  pruneInactiveSatFieldValues,
  buildOperationalStepDiagnostics,
  buildRegulatorySourceDisplay,
  buildSatPackageActionView,
  validateSatOutputOverride,
  type SatOutputPackage,
  type SatXlsmField,
} from "../lib/pld"

test("SAT conditional fields activate, require and prune dependent branches by catalog code", () => {
  const fields: SatXlsmField[] = [
    {
      id: "selector",
      label: "Selector",
      sheetName: "Acto",
      cell: "A1",
      required: true,
      dataType: "catalogo",
      source: "manual-sat-map",
    },
    {
      id: "otro",
      label: "Descripción otro",
      sheetName: "Acto",
      cell: "B1",
      required: false,
      requiredWhen: [{ fieldId: "selector", equals: ["99"] }],
      activeWhen: [{ fieldId: "selector", equals: ["99"] }],
      dataType: "texto",
      source: "manual-sat-map",
    },
  ]

  assert.equal(isSatXlsmFieldActive(fields[1], { selector: "1,Normal" }), false)
  assert.equal(isSatXlsmFieldRequired(fields[1], { selector: "1,Normal" }), false)
  assert.equal(isSatXlsmFieldActive(fields[1], { selector: "99,Otro" }), true)
  assert.equal(isSatXlsmFieldRequired(fields[1], { selector: "99,Otro" }), true)
  assert.deepEqual(
    pruneInactiveSatFieldValues({
      fields,
      values: { selector: "1,Normal", otro: "valor obsoleto", externo: "se conserva" },
    }),
    { selector: "1,Normal", externo: "se conserva" },
  )
  assert.deepEqual(
    getActionableSatMissingFieldIds({
      fields,
      values: { selector: "1,Normal", otro: "" },
      missingRequiredIds: ["otro"],
    }),
    [],
  )
})

test("SAT questionnaire hides auto-filled EUI fields and keeps pending Excel fields actionable", () => {
  const fields = [
    {
      id: "persona_aviso.pm.rfc",
      label: "RFC",
      sheetName: "Persona Objeto del aviso",
      cell: "D33",
      required: true,
      dataType: "texto",
      source: "manual-sat-map",
    },
    {
      id: "acto.fecha_operacion",
      label: "Fecha de operación",
      sheetName: "Acto u operación",
      cell: "C5",
      required: true,
      dataType: "fecha",
      source: "manual-sat-map",
    },
    {
      id: "persona_aviso.contacto.correo",
      label: "Correo electrónico",
      sheetName: "Persona Objeto del aviso",
      cell: "D86",
      required: false,
      dataType: "texto",
      source: "manual-sat-map",
    },
  ] as const

  const compact = buildSatQuestionnaireFieldView({
    fields: [...fields],
    values: {
      "persona_aviso.pm.rfc": "DLV190624M32",
      "acto.fecha_operacion": "",
      "persona_aviso.contacto.correo": "",
    },
    initialValues: { "persona_aviso.pm.rfc": "DLV190624M32" },
    missingRequiredIds: ["acto.fecha_operacion"],
  })

  assert.deepEqual(compact.visibleFieldIds, ["acto.fecha_operacion"])
  assert.deepEqual(compact.autoFilledFieldIds, ["persona_aviso.pm.rfc"])
  assert.deepEqual(compact.optionalHiddenFieldIds, ["persona_aviso.contacto.correo"])

  const expanded = buildSatQuestionnaireFieldView({
    fields: [...fields],
    values: {
      "persona_aviso.pm.rfc": "DLV190624M32",
      "acto.fecha_operacion": "",
      "persona_aviso.contacto.correo": "",
    },
    initialValues: { "persona_aviso.pm.rfc": "DLV190624M32" },
    missingRequiredIds: ["acto.fecha_operacion"],
    showResolvedFields: true,
    showOptionalFields: true,
  })

  assert.deepEqual(expanded.visibleFieldIds, [
    "persona_aviso.pm.rfc",
    "acto.fecha_operacion",
    "persona_aviso.contacto.correo",
  ])
})

test("SAT questionnaire keeps a user-edited field visible even when mirrored into current prefill", () => {
  const fields = [
    {
      id: "acto.tipo_operacion",
      label: "Tipo de operación",
      sheetName: "Acto u operación",
      cell: "B24",
      required: true,
      dataType: "texto",
      source: "xlsm-label",
      sectionKind: "acto_operacion",
    },
  ] as const

  const view = buildSatQuestionnaireFieldView({
    fields: [...fields],
    values: { "acto.tipo_operacion": "A" },
    initialValues: { "acto.tipo_operacion": "A" },
    missingRequiredIds: [],
    editedFieldIds: ["acto.tipo_operacion"],
  })

  assert.deepEqual(view.visibleFieldIds, ["acto.tipo_operacion"])
  assert.deepEqual(view.autoFilledFieldIds, [])
})

test("SAT operation type prefers official XLSM dropdowns and identifies fixed template values", () => {
  const fields: SatXlsmField[] = [
    {
      id: "acto-u-operacion.tipo-de-operacion.b8",
      label: "Tipo de Operación",
      sheetName: "Acto u operación",
      cell: "B8",
      required: true,
      dataType: "catalogo",
      source: "xlsm-data-validation",
      sectionKind: "acto_operacion",
      options: [],
    },
    {
      id: "acto-u-operacion.tipo-de-operacion.c7",
      label: "Tipo de Operación",
      sheetName: "Acto u operación",
      cell: "C7",
      required: true,
      dataType: "catalogo",
      optionListId: "TipoOperacion",
      source: "xlsm-data-validation",
      sectionKind: "acto_operacion",
      options: ["401,Otorgamiento de Mutuo, Préstamo o Crédito sin Garantía"],
    },
  ]

  assert.equal(chooseSatTipoOperacionField(fields)?.cell, "C7")
  assert.equal(getFixedSatTipoOperacion("sat-fraccion-v-inmuebles"), "501,Compra Venta de Inmuebles")
  assert.equal(
    getFixedSatTipoOperacion("sat-fraccion-v-bis-desarrollo"),
    "1601,Aportación a Desarrollo(s) Inmobiliario(s)",
  )
})

test("SAT questionnaire treats duplicated EUI and payment fields as managed by the guided capture", () => {
  const fields = [
    {
      id: "acto.monto_operacion",
      label: "Monto de operación",
      sheetName: "Acto u operación",
      cell: "D21",
      required: true,
      dataType: "moneda",
      source: "xlsm-data-validation",
      sectionKind: "acto_operacion",
    },
    {
      id: "acto.moneda",
      label: "Moneda o divisa",
      sheetName: "Acto u operación",
      cell: "E21",
      required: true,
      dataType: "catalogo",
      optionListId: "Monedas",
      source: "xlsm-data-validation",
      sectionKind: "liquidacion",
    },
    {
      id: "persona.nombre",
      label: "Nombre o razón social",
      sheetName: "Persona Objeto del aviso",
      cell: "B33",
      required: true,
      dataType: "texto",
      source: "xlsm-label",
      sectionKind: "persona_objeto",
    },
    {
      id: "acto.linea_negocio",
      label: "Línea de negocio",
      sheetName: "Acto u operación",
      cell: "C15",
      required: true,
      dataType: "catalogo",
      optionListId: "LineaNego",
      source: "xlsm-data-validation",
      sectionKind: "acto_operacion",
    },
  ] as const

  assert.equal(isSatFieldManagedByPrimaryCapture(fields[0]), true)
  assert.equal(isSatFieldManagedByPrimaryCapture(fields[1]), true)
  assert.equal(isSatFieldManagedByPrimaryCapture(fields[2]), true)
  assert.equal(isSatFieldManagedByPrimaryCapture(fields[3]), false)
  assert.deepEqual(
    getActionableSatMissingFieldIds({
      fields: [...fields],
      missingRequiredIds: fields.map((field) => field.id),
    }),
    ["acto.linea_negocio"],
  )
  assert.deepEqual(
    getActionableSatMissingFieldIds({
      fields: [...fields],
      values: Object.fromEntries(fields.map((field) => [field.id, ""])),
      missingRequiredIds: fields.map((field) => field.id),
    }),
    [
      "acto.linea_negocio",
      "acto.monto_operacion",
      "acto.moneda",
      "persona.nombre",
    ],
  )
})

test("SAT questionnaire deduplicates repeated Excel fields across equivalent cells", () => {
  const fields: SatXlsmField[] = [
    {
      id: "sat-fraccion-v-bis-desarrollo:PrestamoFin!G9",
      label: "Plazo en Meses del Préstamo",
      sheetName: "PrestamoFin",
      cell: "G9",
      required: true,
      dataType: "catalogo",
      source: "xlsm-data-validation",
      sectionKind: "liquidacion",
      options: ["12", "24", "36"],
    },
    {
      id: "sat-fraccion-v-bis-desarrollo:PrestamoFin!H8",
      label: "Plazo en Meses del Préstamo",
      sheetName: "PrestamoFin",
      cell: "H8",
      required: true,
      dataType: "texto",
      source: "xlsm-label",
      sectionKind: "liquidacion",
    },
    {
      id: "sat-fraccion-v-bis-desarrollo:PrestamoNoFin!H9",
      label: "Plazo en Meses del Préstamo",
      sheetName: "PrestamoNoFin",
      cell: "H9",
      required: true,
      dataType: "catalogo",
      source: "xlsm-data-validation",
      sectionKind: "liquidacion",
      options: ["12", "24", "36"],
    },
    {
      id: "sat-fraccion-v-bis-desarrollo:PrestamoNoFin!I8",
      label: "Plazo en Meses del Préstamo",
      sheetName: "PrestamoNoFin",
      cell: "I8",
      required: true,
      dataType: "texto",
      source: "xlsm-label",
      sectionKind: "liquidacion",
    },
  ]

  const view = buildSatQuestionnaireDedupedFieldView({
    fields,
    values: {},
    missingRequiredIds: fields.map((field) => field.id),
  })

  assert.equal(view.fields.length, 1)
  assert.equal(view.fields[0].id, "sat-fraccion-v-bis-desarrollo:PrestamoFin!G9")
  assert.deepEqual(view.missingRequiredIds, ["sat-fraccion-v-bis-desarrollo:PrestamoFin!G9"])
  assert.equal(view.duplicateHiddenCount, 3)
  assert.deepEqual(view.duplicateFieldIdsByRepresentative["sat-fraccion-v-bis-desarrollo:PrestamoFin!G9"], [
    "sat-fraccion-v-bis-desarrollo:PrestamoFin!H8",
    "sat-fraccion-v-bis-desarrollo:PrestamoNoFin!H9",
    "sat-fraccion-v-bis-desarrollo:PrestamoNoFin!I8",
  ])
})

test("SAT questionnaire propagates one visible answer to equivalent duplicate XLSM cells", () => {
  const fields: SatXlsmField[] = [
    {
      id: "socios:B12",
      label: "¿El socio que realizó la aportación fue reportado en un aviso anterior?",
      sheetName: "Socios",
      cell: "B12",
      required: true,
      dataType: "catalogo",
      source: "xlsm-data-validation",
      sectionKind: "contraparte",
      options: ["Si", "No"],
    },
    {
      id: "socios:B25",
      label: "¿El socio que realizó la aportación fue reportado en un aviso anterior?",
      sheetName: "Socios",
      cell: "B25",
      required: true,
      dataType: "catalogo",
      source: "xlsm-data-validation",
      sectionKind: "contraparte",
      options: ["Si", "No"],
    },
    {
      id: "socios:B38",
      label: "¿El socio que realizó la aportación fue reportado en un aviso anterior?",
      sheetName: "Socios",
      cell: "B38",
      required: true,
      dataType: "catalogo",
      source: "xlsm-data-validation",
      sectionKind: "contraparte",
      options: ["Si", "No"],
    },
  ]

  const expanded = expandSatFieldValuesForDuplicateFields({
    fields,
    values: { "socios:B12": "No" },
  })

  assert.equal(expanded["socios:B12"], "No")
  assert.equal(expanded["socios:B25"], "No")
  assert.equal(expanded["socios:B38"], "No")
})

test("SAT questionnaire keeps repeated row groups independent", () => {
  const fields: SatXlsmField[] = [
    {
      id: "pagos:row1:monto",
      label: "Monto de pago",
      sheetName: "Liquidaciones",
      cell: "D15",
      required: true,
      dataType: "moneda",
      source: "xlsm-label",
      sectionKind: "liquidacion",
      repeatGroup: "pagos",
      repeatIndex: 1,
    },
    {
      id: "pagos:row2:monto",
      label: "Monto de pago",
      sheetName: "Liquidaciones",
      cell: "D16",
      required: true,
      dataType: "moneda",
      source: "xlsm-label",
      sectionKind: "liquidacion",
      repeatGroup: "pagos",
      repeatIndex: 2,
    },
  ]

  const view = buildSatQuestionnaireDedupedFieldView({
    fields,
    values: {},
    missingRequiredIds: fields.map((field) => field.id),
  })

  assert.deepEqual(
    view.fields.map((field) => field.id),
    ["pagos:row1:monto", "pagos:row2:monto"],
  )
})

test("operational wizard explains exactly why the client/EUI step is blocked", () => {
  const diagnostics = buildOperationalStepDiagnostics({
    stepIndex: 2,
    hasActiveTenant: true,
    hasUma: true,
    hasActividad: true,
    hasSatFormato: true,
    clienteNombre: "",
    rfc: "",
    tipoClienteRequiresDetalle: true,
    detalleTipoCliente: "",
    tipoOperacion: "",
    montoOperacion: "",
    sospecha24h: false,
    esActividadInmuebles: false,
    satWorkbookStatus: "pendiente",
    satMissingRequiredFields: [],
    evidenceCanSave: true,
    evidenceCanClose: false,
    evidenceMissingCriticalLabels: [],
    alertaNarrativa: "",
    hasEvaluacion: false,
  })

  assert.equal(diagnostics.status, "blocked")
  assert.equal(diagnostics.canContinue, false)
  assert.deepEqual(
    diagnostics.reasons.map((reason) => reason.label),
    ["Nombre o razón social del cliente", "RFC del cliente", "Detalle del tipo de cliente"],
  )
  assert.match(diagnostics.alertDescription, /Nombre o razón social/)
})

test("operational wizard surfaces XLSM missing fields instead of silently disabling next", () => {
  const diagnostics = buildOperationalStepDiagnostics({
    stepIndex: 4,
    hasActiveTenant: true,
    hasUma: true,
    hasActividad: true,
    hasSatFormato: true,
    clienteNombre: "Desarrollos Lago Verde",
    rfc: "DLV190624M32",
    tipoClienteRequiresDetalle: false,
    detalleTipoCliente: "",
    tipoOperacion: "Compraventa",
    montoOperacion: "1850000",
    sospecha24h: false,
    esActividadInmuebles: true,
    satWorkbookStatus: "borrador_bloqueado",
    satMissingRequiredFields: ["persona_aviso.periodo", "acto.fecha_operacion"],
    evidenceCanSave: true,
    evidenceCanClose: false,
    evidenceMissingCriticalLabels: [],
    alertaNarrativa: "",
    hasEvaluacion: true,
  })

  assert.equal(diagnostics.status, "blocked")
  assert.equal(diagnostics.canContinue, false)
  assert.equal(diagnostics.reasons[0].kind, "sat")
  assert.match(diagnostics.reasons[0].description, /persona_aviso.periodo/)
})

test("SAT output override requires a reason and preserves the original suggestion", () => {
  const invalid = validateSatOutputOverride({
    suggestedKind: "aviso_normal",
    requestedKind: "aviso_24h",
    reason: "  ",
  })

  assert.equal(invalid.valid, false)
  assert.deepEqual(invalid.errors, ["Captura el motivo de la corrección de salida SAT."])

  const valid = validateSatOutputOverride({
    suggestedKind: "aviso_normal",
    requestedKind: "aviso_24h",
    reason: "Se detecto una alerta posterior con indicios documentados.",
  })
  assert.equal(valid.valid, true)

  const overridden = applySatOutputOverride(
    {
      id: "satpkg-demo",
      outputKind: "aviso_normal",
      label: "Aviso normal",
      validation: { status: "listo", missingFields: [], errors: [], warnings: [] },
    } as unknown as SatOutputPackage,
    {
      requestedKind: "aviso_24h",
      reason: "Se detecto una alerta posterior con indicios documentados.",
      user: "Oficial demo",
      at: "2026-05-12T18:00:00.000Z",
    },
  )

  assert.equal(overridden.outputKind, "aviso_24h")
  assert.equal(overridden.satOutputOverride?.originalKind, "aviso_normal")
  assert.equal(overridden.satOutputOverride?.reason.includes("alerta posterior"), true)
})

test("SAT package action view prioritizes downloads or missing fields by package status", () => {
  const ready = buildSatPackageActionView({
    validation: { status: "listo", missingFields: [], errors: [], warnings: [] },
    satFieldValues: { "acto.fecha_operacion": "05/05/2026" },
    officialTemplateUrl: "https://sat.gob.mx/demo.zip",
  } as unknown as SatOutputPackage)
  const blocked = buildSatPackageActionView({
    validation: { status: "borrador_bloqueado", missingFields: ["cliente.nombre"], errors: [], warnings: [] },
    satFieldValues: undefined,
    officialTemplateUrl: "https://sat.gob.mx/demo.zip",
  } as unknown as SatOutputPackage)

  assert.equal(ready.find((action) => action.id === "filled-workbook")?.enabled, true)
  assert.equal(ready.find((action) => action.id === "missing-fields")?.emphasis, "secondary")
  assert.equal(blocked.find((action) => action.id === "filled-workbook")?.enabled, false)
  assert.equal(blocked.find((action) => action.id === "missing-fields")?.emphasis, "primary")
})

test("regulatory source display compacts long SAT guide URLs without losing traceability", () => {
  const display = buildRegulatorySourceDisplay({
    primarySource: "RCG art. 19",
    rationale: "No acumula seis meses",
    warning:
      "La guía SAT de acumulación 2026 (https://www.sat.gob.mx/minisitio/ActividadesVulnerables/documentos/GuiaAcumulacionPresentacionAvisos2026.pdf) difiere en algunas fracciones; este sistema usa RCG art. 19 como criterio operativo.",
  })

  assert.equal(display.summary, "No acumula seis meses")
  assert.deepEqual(
    display.chips.map((chip) => chip.label),
    ["RCG art. 19", "Guía SAT 2026"],
  )
  assert.equal(display.visibleWarning.includes("https://"), false)
  assert.equal(display.detail.includes("https://www.sat.gob.mx/minisitio/ActividadesVulnerables"), true)
})

test("blocking reasons view deduplicates missing items and keeps actionable copy", () => {
  const diagnostics = buildOperationalStepDiagnostics({
    stepIndex: 2,
    hasActiveTenant: true,
    hasUma: true,
    hasActividad: true,
    hasSatFormato: true,
    clienteNombre: "",
    rfc: "",
    tipoClienteRequiresDetalle: false,
    detalleTipoCliente: "",
    tipoOperacion: "",
    montoOperacion: "",
    sospecha24h: false,
    esActividadInmuebles: false,
    satWorkbookStatus: "pendiente",
    satMissingRequiredFields: [],
    evidenceCanSave: true,
    evidenceCanClose: false,
    evidenceMissingCriticalLabels: [],
    alertaNarrativa: "",
    hasEvaluacion: false,
  })

  const view = buildBlockingReasonsView({
    title: "Qué falta para avanzar",
    reasons: [...diagnostics.reasons, diagnostics.reasons[0]],
  })

  assert.equal(view.title, "Qué falta para avanzar")
  assert.deepEqual(
    view.items.map((item) => item.label),
    ["Nombre o razón social del cliente", "RFC del cliente"],
  )
  assert.equal(view.items.every((item) => item.action.length > 0), true)
})

test("operational monitoring view orders semaforo lanes by regulatory priority and counts alerts", () => {
  const view = buildOperationalMonitoringView({
    operations: [
      { id: "op-1", umbralStatus: "sin-obligacion", alerta: undefined, alertaResuelta: false },
      { id: "op-2", umbralStatus: "aviso", alerta: "Preparar aviso SAT", alertaResuelta: false },
      { id: "op-3", umbralStatus: "identificacion", alerta: "Completar expediente", alertaResuelta: true },
    ],
  })

  assert.deepEqual(
    view.lanes.map((lane) => `${lane.status}:${lane.count}`),
    ["aviso:1", "identificacion:1", "sin-obligacion:1"],
  )
  assert.equal(view.totalOperations, 3)
  assert.equal(view.activeAlerts, 1)
  assert.equal(view.resolvedAlerts, 1)
  assert.equal(view.lanes[0].primaryAction, "Preparar salida SAT")
})
