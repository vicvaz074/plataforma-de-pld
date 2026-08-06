import assert from "node:assert/strict"
import test from "node:test"

import {
  EXPEDIENTE_PM_DOCUMENTS,
  evaluateExpedientePmDocumentChecklist,
  normalizeExpedientePmDocumentManualState,
  type ExpedientePmDocumentChecklistInput,
} from "../lib/pld/expediente-document-checklist"

const completeAddress = {
  codigoPostal: "06600",
  tipoVialidad: "Avenida",
  nombreVialidad: "Paseo de la Reforma",
  numeroExterior: "250",
  colonia: "Juárez",
  alcaldia: "Cuauhtémoc",
  entidad: "Ciudad de México",
  pais: "MX",
}

const completeIdentification = {
  tipo: "Credencial para votar",
  numero: "INE-123456",
  autoridad: "INE",
  vigencia: "2030-12-31",
}

const completeInput = (): ExpedientePmDocumentChecklistInput => ({
  cliente: {
    denominacion: "Servicios Profesionales del Centro, S.A. de C.V.",
    fechaConstitucion: "2020-01-15",
    paisNacionalidad: "MX",
    rfc: "SPC200115AB1",
    actividad: "541110",
  },
  tipoActoOperacion: "Fracción XI · Servicios profesionales",
  fechaActoOperacion: "2026-08-05",
  domicilioCliente: completeAddress,
  representante: {
    nombre: "María",
    apellidoPaterno: "López",
    rfc: "LOMM800101AB1",
    cargo: "Representante legal",
  },
  identificacionRepresentante: completeIdentification,
  domicilioRepresentante: completeAddress,
  beneficiario: {
    nombres: "Carlos",
    apellidoPaterno: "Pérez",
    curp: "PEGC800101HDFRRR01",
    rfc: "PEGC800101AB1",
    domicilio: completeAddress,
    identificacion: completeIdentification,
  },
})

test("PM checklist exposes thirteen stable and unique document ids", () => {
  assert.equal(EXPEDIENTE_PM_DOCUMENTS.length, 13)
  assert.equal(new Set(EXPEDIENTE_PM_DOCUMENTS.map(({ id }) => id)).size, 13)
})

test("PM checklist derives automatic completion from captured data", () => {
  const result = evaluateExpedientePmDocumentChecklist(completeInput())

  assert.equal(result.summary.automatic, 11)
  assert.equal(result.summary.manual, 0)
  assert.equal(result.summary.missing, 2)
  assert.equal(result.summary.progress, 85)
  assert.equal(result.canSave, true)
  assert.equal(result.isComplete, false)
  assert.equal(
    result.items.find(({ id }) => id === "formulario-identificacion-cliente")?.source,
    "captured-data",
  )
})

test("detected documents complete requirements that have no structured form source", () => {
  const result = evaluateExpedientePmDocumentChecklist({
    ...completeInput(),
    detectedDocuments: {
      acta_constitutiva: true,
      registro_publico: "completo",
    },
  })

  assert.equal(result.summary.automatic, 13)
  assert.equal(result.summary.missing, 0)
  assert.equal(result.isComplete, true)
  assert.equal(
    result.items.find(({ id }) => id === "existencia-persona-moral")?.source,
    "detected-document",
  )
})

test("manual normalization accepts stable ids, current labels and legacy demo aliases", () => {
  const label = EXPEDIENTE_PM_DOCUMENTS.find(({ id }) => id === "inscripcion-registro-publico")?.label ?? ""
  const normalized = normalizeExpedientePmDocumentManualState({
    acta_constitutiva: true,
    [label]: "presente",
    declaracion_beneficiario: "integrada",
    constancia_fiscal: "en-proceso",
  })

  assert.equal(normalized["existencia-persona-moral"], true)
  assert.equal(normalized["inscripcion-registro-publico"], true)
  assert.equal(normalized["identificacion-beneficiario"], true)
  assert.equal(normalized["constancia-situacion-fiscal"], false)
})

test("manual confirmation completes a missing item without blocking an incomplete save", () => {
  const result = evaluateExpedientePmDocumentChecklist({
    manual: { acta_constitutiva: true },
  })

  assert.equal(result.items.find(({ id }) => id === "existencia-persona-moral")?.status, "manual")
  assert.equal(result.summary.manual, 1)
  assert.equal(result.summary.missing, 12)
  assert.equal(result.canSave, true)
  assert.equal(result.isComplete, false)
})

test("automatic data has priority over a stored manual confirmation", () => {
  const result = evaluateExpedientePmDocumentChecklist({
    ...completeInput(),
    manual: { "formulario-identificacion-cliente": true },
  })
  const form = result.items.find(({ id }) => id === "formulario-identificacion-cliente")

  assert.equal(form?.status, "automatic")
  assert.equal(form?.manualChecked, true)
})

test("automatic state is recalculated and disappears when its source data is removed", () => {
  const complete = evaluateExpedientePmDocumentChecklist(completeInput())
  const changed = completeInput()
  changed.cliente = { ...changed.cliente, denominacion: "" }
  const incomplete = evaluateExpedientePmDocumentChecklist(changed)

  assert.equal(
    complete.items.find(({ id }) => id === "formulario-identificacion-cliente")?.status,
    "automatic",
  )
  assert.equal(
    incomplete.items.find(({ id }) => id === "formulario-identificacion-cliente")?.status,
    "missing",
  )
  assert.deepEqual(
    incomplete.items.find(({ id }) => id === "formulario-identificacion-cliente")?.missingFields,
    ["Denominación o razón social"],
  )
})

test("street type Otro remains pending until its open description is captured", () => {
  const pendingInput = completeInput()
  pendingInput.domicilioCliente = { ...completeAddress, tipoVialidad: "Otro" }
  const pending = evaluateExpedientePmDocumentChecklist(pendingInput)
  const pendingAddress = pending.items.find(({ id }) => id === "domicilio-cliente")

  assert.equal(pendingAddress?.status, "missing")
  assert.deepEqual(pendingAddress?.missingFields, ["Tipo de vialidad"])

  const describedInput = completeInput()
  describedInput.domicilioCliente = { ...completeAddress, tipoVialidad: "Sendero peatonal" }
  const described = evaluateExpedientePmDocumentChecklist(describedInput)

  assert.equal(
    described.items.find(({ id }) => id === "domicilio-cliente")?.status,
    "automatic",
  )
})

test("effective snapshot includes stable ids, current labels, aliases and unknown legacy keys", () => {
  const result = evaluateExpedientePmDocumentChecklist({
    manual: {
      acta_constitutiva: true,
      clave_legacy_desconocida: true,
    },
  })
  const definition = EXPEDIENTE_PM_DOCUMENTS.find(({ id }) => id === "existencia-persona-moral")

  assert.equal(result.effectiveSnapshot["existencia-persona-moral"], true)
  assert.equal(result.effectiveSnapshot[definition?.label ?? ""], true)
  assert.equal(result.effectiveSnapshot.acta_constitutiva, true)
  assert.equal(result.effectiveSnapshot.clave_legacy_desconocida, true)
  assert.equal(result.effectiveSnapshot["constancia-situacion-fiscal"], false)
})
