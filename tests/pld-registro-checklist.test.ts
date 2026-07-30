import assert from "node:assert/strict"
import test from "node:test"

import {
  evaluateRegistroChecklist,
  separateLegacyRegistroDocuments,
  type RegistroChecklistInput,
} from "../lib/pld/registro-checklist"

const completeAddress = {
  codigoPostal: "06600",
  tipoVialidad: "Avenida",
  nombreVialidad: "Paseo de la Reforma",
  numeroExterior: "250",
  colonia: "Juárez",
  alcaldia: "Cuauhtémoc",
  entidad: "Ciudad de México",
  pais: "México",
}

const completePhysicalInput = (): RegistroChecklistInput => ({
  tipoSujeto: "fisica",
  identificacion: {
    fecha: "1988-05-20",
    rfc: "GOML880520ABC",
    nombre: "Laura",
    apellidoPaterno: "Gómez",
    paisNacionalidad: "MX",
    paisNacimiento: "MX",
    curp: "",
  },
  contactos: [
    {
      nombreCompleto: "Laura Gómez",
      correo: "laura@example.test",
      telefonoMovil: "5512345678",
    },
  ],
  actividades: [
    {
      actividadKey: "fraccion-xi-servicios-profesionales",
      fechaPrimera: "2026-01-15",
      cuentaRegistro: "no",
      domicilio: completeAddress,
    },
  ],
  documentos: {
    detalle: { id: "detalle" },
    acuse: { id: "acuse" },
    aceptacion: null,
  },
  actividadLabels: {
    "fraccion-xi-servicios-profesionales": "XI · Servicios profesionales",
  },
})

test("registro checklist derives physical-person completion without manual checks", () => {
  const result = evaluateRegistroChecklist(completePhysicalInput())

  assert.equal(result.dataComplete, true)
  assert.equal(result.documentsComplete, true)
  assert.equal(result.overallComplete, true)
  assert.equal(
    result.items.find((item) => item.id === "identificacion-curp")?.status,
    "not-applicable",
  )
  assert.equal(
    result.items.find((item) => item.id === "documento-aceptacion")?.status,
    "not-applicable",
  )
  assert.equal(result.summary.missing, 0)
})

test("registro checklist requires every declared activity and its own address", () => {
  const input = completePhysicalInput()
  input.actividades.push({
    actividadKey: "fraccion-xv-uso-goce",
    fechaPrimera: "2026-02-01",
    cuentaRegistro: "no",
    domicilio: { ...completeAddress, codigoPostal: "", entidad: "" },
  })

  const result = evaluateRegistroChecklist(input)
  const firstAddress = result.items.find((item) => item.id === "actividad-0-domicilio")
  const secondAddress = result.items.find((item) => item.id === "actividad-1-domicilio")

  assert.equal(firstAddress?.status, "complete")
  assert.equal(secondAddress?.status, "missing")
  assert.deepEqual(secondAddress?.missingFields, ["Código postal", "Entidad"])
  assert.equal(secondAddress?.targetId, "domicilio-cp-1")
  assert.equal(result.dataComplete, false)
})

test("activity authorization is conditional on the captured answer", () => {
  const noRegistration = evaluateRegistroChecklist(completePhysicalInput())
  assert.equal(
    noRegistration.items.find((item) => item.id === "actividad-0-autorizacion")?.status,
    "not-applicable",
  )

  const input = completePhysicalInput()
  input.actividades[0] = {
    ...input.actividades[0],
    cuentaRegistro: "si",
    tipoDocumento: "Registro",
    autoridadDocumento: "",
    folioDocumento: "",
    periodoDocumento: "",
  }
  const withRegistration = evaluateRegistroChecklist(input)
  const authorization = withRegistration.items.find(
    (item) => item.id === "actividad-0-autorizacion",
  )

  assert.equal(authorization?.status, "missing")
  assert.deepEqual(authorization?.missingFields, ["Autoridad emisora", "Folio", "Periodo"])
  assert.equal(withRegistration.dataComplete, false)
})

test("moral person needs a distinct acceptance file and complete representative", () => {
  const input: RegistroChecklistInput = {
    ...completePhysicalInput(),
    tipoSujeto: "moral",
    identificacion: {
      fecha: "2019-06-24",
      rfc: "DLV190624M32",
      nombre: "Desarrollos del Valle",
    },
    representante: {
      nombre: "María",
      apellidoPaterno: "Ruiz",
      fechaNacimiento: "1980-01-01",
      rfc: "RUMM800101ABC",
      paisNacionalidad: "MX",
      fechaDesignacion: "2026-01-02",
      fechaAceptacion: "2026-01-03",
      contacto: {
        correo: "maria@example.test",
        telefonoMovil: "5512345678",
      },
      certificacion: { respuesta: "no" },
    },
    documentos: {
      detalle: { id: "detalle" },
      acuse: { id: "acuse" },
      aceptacion: null,
    },
  }

  const pending = evaluateRegistroChecklist(input)
  assert.equal(pending.dataComplete, true)
  assert.equal(pending.documentsComplete, false)
  assert.equal(
    pending.items.find((item) => item.id === "documento-aceptacion")?.status,
    "missing",
  )

  input.documentos.aceptacion = { id: "aceptacion" }
  const complete = evaluateRegistroChecklist(input)
  assert.equal(complete.overallComplete, true)
})

test("legacy combined acuse and acceptance is separated during migration", () => {
  const combined = { id: "legacy-combined", name: "acuse-y-aceptacion.pdf" }
  const migrated = separateLegacyRegistroDocuments({
    detalle: { id: "detalle", name: "detalle.pdf" },
    acuse: combined,
    aceptacion: combined,
  })

  assert.equal(migrated.acuse?.id, "legacy-combined")
  assert.equal(migrated.aceptacion, null)
})
