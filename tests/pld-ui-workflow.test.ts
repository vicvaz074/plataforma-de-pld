import assert from "node:assert/strict"
import test from "node:test"

import {
  applySatOutputOverride,
  buildBlockingReasonsView,
  buildOperationalMonitoringView,
  buildOperationalStepDiagnostics,
  buildRegulatorySourceDisplay,
  buildSatPackageActionView,
  validateSatOutputOverride,
  type SatOutputPackage,
} from "../lib/pld"

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
