import assert from "node:assert/strict"
import test from "node:test"
import {
  buildExpedienteFromActo,
  buildIntegrationClients,
  EBR_EVALUATIONS_STORAGE_KEY,
  EXPEDIENTES_STORAGE_KEY,
  ExpedienteConflictError,
  findClientEbrEvaluation,
  getIntegrationClient,
  integrationSubjectToTenant,
  matchesIntegrationClient,
  matchesIntegrationSubject,
  mergeExpedienteRecords,
  normalizeEbrEvaluations,
  readExpedienteRecords,
  readPldSubjects,
  resolvePldSubject,
  saveClientEbrEvaluation,
  saveExpedienteRecord,
} from "../lib/pld/integration-records"
import { calculateRisk, initialAnswers, summarizeStoredEbrQuestionnaire } from "../lib/pld/ebr-questionnaire"

function memoryStorage(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]))
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
}

const original = {
  schemaVersion: 3, expedienteId: "eui-one", rfc: "AAA010101AAA", nombre: "Cliente Uno", actualizadoEn: "2026-09-01T00:00:00Z",
  identifiers: { rfc: "AAA010101AAA", nif: "", curp: "" }, activityKey: "fraccion-xi-b-administracion",
  personas: [{ id: "persona-one", tipo: "persona_moral", denominacion: "Cliente Uno" }],
  documentosFuturos: { conservar: true },
  expedienteEui: {
    schemaVersion: 3, tipoExpediente: "persona_moral", activityKey: "fraccion-xi-b-administracion",
    cliente: { denominacion: "Cliente Uno", fechaConstitucion: "2010-01-01", actividad: "A", paisNacionalidad: "MX" },
    domicilioCliente: { nombreVialidad: "Anterior", alcaldia: "Antes", tipoVialidad: "Calle" },
    contactoCliente: { telefonoMovil: "1111111111", correo: "antes@example.com", ladaMovil: "52" },
    beneficiario1: { nombres: "Antes", porcentajeParticipacion: "60", identificacion: { numero: "DOCUMENTO" }, domicilio: { codigoPostal: "01000" } },
    representante: { nombre: "Antes", cargo: "Apoderado" }, documentacion: { acta: true },
  },
}

test("Actos corrections update the EUI form and summaries without losing documents or schema", () => {
  const corrected = buildExpedienteFromActo(original, {
    expedienteId: original.expedienteId,
    identifiers: { rfc: "BBB020202BBB" },
    persona: { id: "persona-one", tipo: "persona_moral", denominacion: "Cliente Corregido", giro: "B", fechaConstitucion: "2012-02-02", pais: "US", domicilio: { calle: "Nueva", municipio: "Nuevo", codigoPostal: "02000" }, contacto: { telefono: "2222222222", correo: "nuevo@example.com" }, representante: { nombre: "Representante Nuevo", rfc: "CCC030303CCC" } },
    beneficiariosControladores: [{ nombre: "Beneficiaria Nueva", apellidoPaterno: "Pérez", pais: "MX", rfc: "DDD040404DDD" }],
    operationContext: { tipoActoOperacion: "Administración", fechaActoOperacion: "2026-09-20" },
    updatedAt: "2026-09-20T00:00:00Z",
  })
  assert.equal(corrected.schemaVersion, 3)
  assert.equal(corrected.expedienteEui.schemaVersion, 3)
  assert.equal(corrected.expedienteEui.cliente.denominacion, "Cliente Corregido")
  assert.equal(corrected.expedienteEui.cliente.actividad, "B")
  assert.equal(corrected.expedienteEui.cliente.rfc, "BBB020202BBB")
  assert.equal(corrected.expedienteEui.domicilioCliente.nombreVialidad, "Nueva")
  assert.equal(corrected.expedienteEui.domicilioCliente.alcaldia, "Nuevo")
  assert.equal(corrected.expedienteEui.contactoCliente.telefonoMovil, "2222222222")
  assert.equal(corrected.expedienteEui.contactoCliente.ladaMovil, "52")
  assert.equal(corrected.expedienteEui.representante.nombre, "Representante Nuevo")
  assert.equal(corrected.expedienteEui.representante.cargo, "Apoderado")
  assert.equal(corrected.expedienteEui.beneficiario1.nombres, "Beneficiaria Nueva")
  assert.equal(corrected.expedienteEui.beneficiario1.porcentajeParticipacion, "60")
  assert.equal(corrected.expedienteEui.beneficiario1.identificacion.numero, "DOCUMENTO")
  assert.deepEqual(corrected.expedienteEui.documentacion, { acta: true })
  assert.equal(corrected.personas[0].denominacion, "Cliente Corregido")
  assert.equal(original.expedienteEui.cliente.denominacion, "Cliente Uno")
})

test("EUI merge targets the stable ID even when different files share an RFC", () => {
  const other = { ...original, expedienteId: "eui-two", activityKey: "fraccion-xv-uso-goce" }
  const next = mergeExpedienteRecords([original, other], { ...original, nombre: "Corregido", schemaVersion: 2 })
  assert.equal(next.length, 2)
  assert.equal(next[0].nombre, "Corregido")
  assert.equal(next[0].schemaVersion, 3)
  assert.equal(next[1], other)
  const withNew = mergeExpedienteRecords(next, { ...original, expedienteId: "eui-three" })
  assert.equal(withNew.length, 3)
})

test("EUI saves merge new rows from another view and refuse stale edits or invalid JSON", () => {
  const storage = memoryStorage({ [EXPEDIENTES_STORAGE_KEY]: [original, { ...original, expedienteId: "new-from-other-tab" }] })
  const saved = saveExpedienteRecord(storage, { ...original, actualizadoEn: "2026-09-21T00:00:00Z" }, { expectedUpdatedAt: original.actualizadoEn })
  assert.equal(saved.length, 2)
  assert.throws(() => saveExpedienteRecord(storage, original, { expectedUpdatedAt: original.actualizadoEn }), ExpedienteConflictError)
  storage.setItem(EXPEDIENTES_STORAGE_KEY, "{invalid")
  assert.throws(() => saveExpedienteRecord(storage, original))
  assert.equal(storage.getItem(EXPEDIENTES_STORAGE_KEY), "{invalid")
})

test("legacy EUI without ID migrates without changing unrelated records", () => {
  const legacy = { rfc: "AAA010101AAA", nombre: "Cliente Uno" }
  const id = getIntegrationClient(legacy)!.id
  const storage = memoryStorage({ [EXPEDIENTES_STORAGE_KEY]: [legacy] })
  saveExpedienteRecord(storage, { ...legacy, expedienteId: id })
  assert.equal(readExpedienteRecords(storage).length, 1)
  assert.equal(readExpedienteRecords(storage)[0].expedienteId, id)
})

test("subject resolution uses Alta identity and never invents a demo RFC", () => {
  const storage = memoryStorage({
    "registro-sat-data": { sujetosRegistrados: [{ id: "subject-one", nombre: "Sujeto Real", identificacion: { rfc: "REAL010101AA1" }, actividades: [{ actividadKey: "fraccion-xi-b-administracion" }] }] },
    [EXPEDIENTES_STORAGE_KEY]: [{ ...original, sujetoObligadoId: "subject-one", sujetoObligadoNombre: "Sujeto Real" }],
    "pld-tenants": { tenants: [{ id: "tenant-old", rfc: "REAL010101AA1", razonSocial: "Nombre anterior", actividades: [] }] },
  })
  const subjects = readPldSubjects(storage)
  assert.equal(subjects.length, 1)
  assert.equal(resolvePldSubject({ id: "subject-one" }, subjects).rfc, "REAL010101AA1")
  assert.equal(resolvePldSubject({ id: "tenant-old" }, subjects).rfc, "REAL010101AA1")
  assert.equal(resolvePldSubject({ id: "unknown" }, subjects).rfc, undefined)
  assert.deepEqual(readPldSubjects(memoryStorage()), [])
  const tenant = integrationSubjectToTenant(subjects[0])
  assert.equal(tenant.rfc, "REAL010101AA1")
  assert.equal(tenant.representanteCumplimiento.nombre, "")
  assert.equal(matchesIntegrationSubject({ sujetoObligado: { id: "tenant-old" } }, subjects[0]), true)
  assert.equal(matchesIntegrationSubject({ rfc: "REAL010101AA1" }, subjects[0]), false, "a client's RFC is not a subject link")
})

test("CURP and NIF clients remain visible and operations link by EUI ID after changing RFC", () => {
  const curp = { expedienteId: "curp-only", nombre: "Cliente PF", identifiers: { curp: "GOCG650418HVZNMR07" } }
  const nif = { expedienteId: "nif-only", nombre: "Cliente extranjero", identifiers: { nif: "NIF-12345" } }
  const operations = [{ expedienteReferenciado: "curp-only", rfc: "OLD010101AA1", cliente: "Cliente PF" }]
  const clients = buildIntegrationClients([curp, nif], operations)
  assert.equal(clients.length, 2)
  assert.equal(clients[0].identifier, "GOCG650418HVZNMR07")
  assert.equal(clients[1].identifier, "NIF-12345")
  assert.equal(matchesIntegrationClient(operations[0], clients[0]), true)
  assert.equal(matchesIntegrationClient({ ...operations[0], expedienteReferenciado: "different" }, clients[0]), false)
})

test("EBR accepts legacy array and V2 maps while preserving ID, risk summary and other clients", () => {
  const client = getIntegrationClient({ expedienteId: "nif-only", nombre: "Extranjero", identifiers: { nif: "NIF-12345" } })!
  const legacy = { rfc: "NIF-12345", schemaVersion: 2, clientAnswers: { pep: "none" }, updatedAt: "2026-09-01" }
  assert.equal(findClientEbrEvaluation(normalizeEbrEvaluations({ "NIF-12345": legacy }), client)?.schemaVersion, 2)
  assert.equal(findClientEbrEvaluation(normalizeEbrEvaluations([legacy]), client)?.schemaVersion, 2)
  const storage = memoryStorage({ [EBR_EVALUATIONS_STORAGE_KEY]: { "NIF-12345": legacy, unrelated: { rfc: "BBB020202BBB", notes: "Preservar" } } })
  const next = saveClientEbrEvaluation(storage, client, { schemaVersion: 2, riskSummary: { level: "Alto", score: 20, percent: 80 }, updatedAt: "2026-09-22" })
  assert.equal(next[client.id].riskSummary.level, "Alto")
  assert.equal(next[client.id].rfc, "")
  assert.equal(next[client.id].identifiers.nif, "NIF-12345")
  assert.equal(Object.values(next).some((item) => item.notes === "Preservar"), true)
  assert.equal(findClientEbrEvaluation(normalizeEbrEvaluations(next), client)?.expedienteId, client.id)
  const deleted = saveClientEbrEvaluation(storage, client, null)
  assert.equal(Object.values(deleted).length, 1)
})

test("invalid EBR storage is preserved rather than overwritten", () => {
  const storage = memoryStorage()
  storage.setItem(EBR_EVALUATIONS_STORAGE_KEY, "{invalid")
  assert.throws(() => saveClientEbrEvaluation(storage, getIntegrationClient(original)!, { notes: "Nuevo" }))
  assert.equal(storage.getItem(EBR_EVALUATIONS_STORAGE_KEY), "{invalid")
})

test("historical EBR v2 questionnaires use the same scoring as the current EBR screen", () => {
  const answers = { ...initialAnswers, nationalityRisk: "black", ngoNonRegulated: "yes" }
  const current = calculateRisk(answers, true, "Cliente")
  const stored = { rfc: "AAA010101AAA", schemaVersion: 2, clientAnswers: answers, subjectAnswers: initialAnswers, hasBeneficiaryController: false, updatedAt: "2026-09-23" }
  const summary = normalizeEbrEvaluations({ AAA010101AAA: stored })[0].riskSummary
  assert.equal(summary.level, current.level)
  assert.equal(summary.score, current.total)
  assert.equal(summary.percent, current.percent)
  assert.equal(summary.level, "Reforzado")
  assert.equal(summarizeStoredEbrQuestionnaire({ ...stored, clientAnswers: initialAnswers, pepScreening: { status: "posible-pep" } })?.level, "Alto")
})
