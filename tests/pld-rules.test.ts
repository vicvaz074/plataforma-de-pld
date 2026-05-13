import test from "node:test"
import assert from "node:assert/strict"

import {
  ACTIVIDADES_VULNERABLES_ARTICULO_17,
  calcularFechaLimiteAvisoOrdinario,
  calcularFechaLimiteAvisoSospecha,
  classifyAvisoSalida,
  detectRecurringPaymentReview,
  evaluarOperacionVulnerable,
  evaluateEvidenceChecklist,
  getAcumulacionRuleForActividad,
  getDocumentRequirementsForCliente,
  getUmaForDate,
  matchPepCargo,
  pepCargoFixtures,
  searchPep,
} from "../lib/pld"
import type { PepEntity, PepInternalRecord } from "../lib/pld"
import pepPublicMxSnapshot from "../public/data/pep-public-mx.json"

test("UMA 2026 uses official INEGI daily, monthly and annual values", () => {
  const uma = getUmaForDate("2026-05-08")

  assert.equal(uma.diario, 117.31)
  assert.equal(uma.mensual, 3566.22)
  assert.equal(uma.anual, 42794.64)
  assert.equal(uma.source.includes("INEGI"), true)
})

test("Article 17 catalog keeps customs services under fraction XIV", () => {
  const customs = ACTIVIDADES_VULNERABLES_ARTICULO_17.find((item) => item.key === "fraccion-xiv-aduanal-a")

  assert.equal(customs?.fraccion, "Fracción XIV")
  assert.equal(customs?.nombre, "Servicios de comercio exterior - vehículos")
  assert.equal(customs?.avisoSiempre, true)
})

test("ordinary notices are due on the 17th day of the following month", () => {
  assert.equal(calcularFechaLimiteAvisoOrdinario("2026-05-12"), "2026-06-17")
})

test("suspicion notices are due within 24 hours after knowledge or suspicion", () => {
  assert.equal(calcularFechaLimiteAvisoSospecha("2026-05-08T09:30:00-06:00"), "2026-05-09T09:30:00.000-06:00")
})

test("SAT six-month accumulation only includes operations that meet identification threshold", () => {
  const firstIdentified = 3210 * 117.31
  const belowIdentification = 100000
  const secondIdentified = 3210 * 117.31

  const result = evaluarOperacionVulnerable({
    actividadKey: "fraccion-viii-vehiculos",
    clienteKey: "RFC123456AB1",
    fechaOperacion: "2026-03-10",
    montoMxn: secondIdentified,
    operacionesHistoricas: [
      {
        id: "op-jan",
        actividadKey: "fraccion-viii-vehiculos",
        clienteKey: "RFC123456AB1",
        fechaOperacion: "2026-01-15",
        montoMxn: firstIdentified,
      },
      {
        id: "op-feb",
        actividadKey: "fraccion-viii-vehiculos",
        clienteKey: "RFC123456AB1",
        fechaOperacion: "2026-02-01",
        montoMxn: belowIdentification,
      },
    ],
  })

  assert.equal(result.status, "aviso")
  assert.equal(result.acumulacion.operacionesConsideradas.length, 2)
  assert.equal(result.fechaLimiteAviso, "2026-04-17")
})

test("document evidence matrix maps client types to official RCG annexes", () => {
  const personaFisica = getDocumentRequirementsForCliente("pf_residente")
  const personaMoral = getDocumentRequirementsForCliente("pm_mexicana")
  const fideicomiso = getDocumentRequirementsForCliente("fideicomiso")

  assert.equal(personaFisica.some((item) => item.source.includes("Anexo 3")), true)
  assert.equal(personaFisica.some((item) => item.id === "pf-identificacion-oficial"), true)
  assert.equal(personaMoral.some((item) => item.source.includes("Anexo 4")), true)
  assert.equal(personaMoral.some((item) => item.id === "pm-acta-constitutiva"), true)
  assert.equal(fideicomiso.some((item) => item.source.includes("Anexo 8")), true)
  assert.equal(fideicomiso.some((item) => item.id === "fideicomiso-contrato"), true)
})

test("flexible evidence blocking allows saving but blocks closing until critical evidence is justified", () => {
  const requirements = getDocumentRequirementsForCliente("pm_mexicana")
  const completed = Object.fromEntries(requirements.map((item) => [item.id, false]))
  const missing = evaluateEvidenceChecklist({ requirements, completed })

  assert.equal(missing.canSave, true)
  assert.equal(missing.canClose, false)
  assert.equal(missing.missingCritical.some((item) => item.id === "pm-acta-constitutiva"), true)

  const justified = evaluateEvidenceChecklist({
    requirements,
    completed,
    justifications: {
      "pm-acta-constitutiva": "Cliente de reciente constitucion; carta compromiso de inscripcion pendiente.",
      "pm-rfc-constancia": "Constancia fiscal en validacion ante SAT.",
      "pm-domicilio": "Comprobante pendiente; se verifico domicilio fiscal por CSF.",
      "pm-poderes-representante": "Poder contenido en el acta constitutiva exhibida.",
      "pm-identificacion-representante": "Representante enviara INE previo a firma.",
      "pm-beneficiario-controlador": "Declaracion firmada se integrara en cierre de expediente.",
    },
  })

  assert.equal(justified.canSave, true)
  assert.equal(justified.canClose, true)
  assert.equal(justified.justifications.length >= 6, true)
})

test("RCG article 19 accumulation rule distinguishes accumulating and non-accumulating activities", () => {
  assert.equal(getAcumulacionRuleForActividad("fraccion-i-juegos").applies, true)
  assert.equal(getAcumulacionRuleForActividad("fraccion-ii-tarjetas-prepagadas").applies, false)
  assert.equal(getAcumulacionRuleForActividad("fraccion-xi-a-inmuebles").applies, false)
  assert.equal(getAcumulacionRuleForActividad("fraccion-xii-notarios-b").applies, false)
  assert.equal(getAcumulacionRuleForActividad("fraccion-xii-corredores-d").applies, false)
  assert.equal(getAcumulacionRuleForActividad("fraccion-xiv-aduanal-a").applies, false)
  assert.equal(getAcumulacionRuleForActividad("fraccion-xv-uso-goce").applies, true)
})

test("RCG accumulation applies to fraction I and does not accumulate fraction XIV", () => {
  const uma = 117.31
  const juegos = evaluarOperacionVulnerable({
    actividadKey: "fraccion-i-juegos",
    clienteKey: "RFC123456AB1",
    fechaOperacion: "2026-03-10",
    montoMxn: 325 * uma,
    operacionesHistoricas: [
      {
        id: "op-jan",
        actividadKey: "fraccion-i-juegos",
        clienteKey: "RFC123456AB1",
        fechaOperacion: "2026-01-15",
        montoMxn: 325 * uma,
      },
    ],
  })

  assert.equal(juegos.status, "aviso")
  assert.equal(juegos.acumulacion.aplica, true)
  assert.equal(juegos.acumulacion.rule.applies, true)

  const comercioExterior = evaluarOperacionVulnerable({
    actividadKey: "fraccion-xiv-aduanal-d",
    clienteKey: "RFC123456AB1",
    fechaOperacion: "2026-03-10",
    montoMxn: 485 * uma,
    operacionesHistoricas: [
      {
        id: "op-jan",
        actividadKey: "fraccion-xiv-aduanal-d",
        clienteKey: "RFC123456AB1",
        fechaOperacion: "2026-01-15",
        montoMxn: 485 * uma,
      },
    ],
  })

  assert.equal(comercioExterior.status, "aviso")
  assert.equal(comercioExterior.acumulacion.aplica, false)
  assert.equal(comercioExterior.acumulacion.operacionesConsideradas.length, 1)
})

test("notice output classification covers ordinary, zero, 27 Bis and 24 hour notices", () => {
  assert.equal(classifyAvisoSalida({ status: "aviso" }).tipo, "aviso_normal")
  assert.equal(classifyAvisoSalida({ periodoSinOperaciones: true }).tipo, "informe_ceros")
  assert.equal(classifyAvisoSalida({ status: "aviso", supuesto27Bis: true }).tipo, "informe_27_bis")
  assert.equal(classifyAvisoSalida({ sospecha24h: true }).tipo, "aviso_24h")
})

test("recurring rent payments covering multiple months are flagged for review instead of treated as automatic excess", () => {
  const review = detectRecurringPaymentReview({
    actividadKey: "fraccion-xv-uso-goce",
    mesesCubiertos: 3,
    montoMxn: 450000,
    mensualidadEsperadaMxn: 150000,
    salidaTipo: "aviso_normal",
  })

  assert.equal(review.requiresReview, true)
  assert.equal(review.reasonCode, "pago-recurrente-multiperiodo")
  assert.equal(review.monthlyEquivalentMxn, 150000)
  assert.match(review.message ?? "", /3 meses/)
})

test("ordinary single-month rent payments do not create recurring false-positive review", () => {
  const review = detectRecurringPaymentReview({
    actividadKey: "fraccion-xv-uso-goce",
    mesesCubiertos: 1,
    montoMxn: 150000,
    mensualidadEsperadaMxn: 150000,
    salidaTipo: "identificacion",
  })

  assert.equal(review.requiresReview, false)
})

test("PEP cargo matching is accent-insensitive and returns review state", () => {
  const result = matchPepCargo(
    {
      cargo: "Director General del Instituto Mexicano del Transporte",
      dependencia: "Secretaria de Comunicaciones y Transportes",
    },
    pepCargoFixtures,
  )

  assert.equal(result.status, "coincidencia-cargo")
  assert.equal(result.requiresHumanReview, true)
  assert.equal(result.matches[0]?.cargo, "DIRECTOR GENERAL DEL INSTITUTO MEXICANO DEL TRANSPORTE")
})

const pepNominalFixture: PepEntity = {
  id: "os-mx-demo-1",
  name: "María Fernanda Gómez de la Torre",
  aliases: ["Ma. Fernanda Gomez Torre"],
  country: "mx",
  birthDate: "1977-06-04",
  positions: [
    {
      cargo: "Diputada Federal",
      dependencia: "Cámara de Diputados",
      desde: "2024-09-01",
    },
  ],
  source: "opensanctions",
  sourceLabel: "OpenSanctions PEP",
  sourceUrl: "https://www.opensanctions.org/",
  dataset: "peps",
  lastSeen: "2026-05-11",
  topics: ["role.pep"],
}

test("WhoIs PEP search returns high confidence for exact nominal public matches", () => {
  const result = searchPep(
    {
      nombre: "Maria Fernanda Gomez de la Torre",
      fechaNacimiento: "1977-06-04",
      relacion: "cliente",
    },
    {
      entities: [pepNominalFixture],
      cargos: pepCargoFixtures,
      internalRecords: [],
    },
    "2026-05-11T12:00:00.000Z",
  )

  assert.equal(result.status, "coincidencia_alta")
  assert.equal(result.results[0]?.entity.id, "os-mx-demo-1")
  assert.equal(result.results[0]?.source, "opensanctions")
  assert.equal(result.results[0]?.matchedFields.includes("nombre"), true)
  assert.equal(result.results[0]?.matchedFields.includes("fechaNacimiento"), true)
  assert.equal(result.results[0]?.score >= 95, true)
  assert.equal(result.results[0]?.requiresHumanReview, true)
})

test("WhoIs PEP search handles partial names and compound surnames as possible matches", () => {
  const result = searchPep(
    {
      nombre: "Fernanda Gomez Torre",
      relacion: "beneficiario-controlador",
    },
    {
      entities: [pepNominalFixture],
      cargos: pepCargoFixtures,
      internalRecords: [],
    },
    "2026-05-11T12:00:00.000Z",
  )

  assert.equal(result.status, "posible_coincidencia")
  assert.equal(result.results[0]?.matchedFields.includes("alias/nombre parcial"), true)
  assert.equal(result.results[0]?.score >= 70, true)
  assert.equal(result.results[0]?.score < 90, true)
})

test("WhoIs PEP search can escalate on official Mexican PEP position even without a nominal match", () => {
  const result = searchPep(
    {
      cargo: "Director General del Instituto Mexicano del Transporte",
      dependencia: "Secretaria de Comunicaciones y Transportes",
      relacion: "representante",
    },
    {
      entities: [],
      cargos: pepCargoFixtures,
      internalRecords: [],
    },
    "2026-05-11T12:00:00.000Z",
  )

  assert.equal(result.status, "coincidencia_alta")
  assert.equal(result.results[0]?.source, "shcp-uif-cargos")
  assert.equal(result.results[0]?.matchedFields.includes("cargo"), true)
  assert.equal(result.results[0]?.matchedFields.includes("dependencia"), true)
})

test("WhoIs PEP search applies internal false-positive decisions before public matches", () => {
  const falsePositive: PepInternalRecord = {
    id: "pep-review-fp-1",
    schemaVersion: 1,
    subjectName: "María Fernanda Gómez de la Torre",
    normalizedSubjectName: "MARIA FERNANDA GOMEZ DE LA TORRE",
    decision: "falso_positivo",
    sourceEntityId: "os-mx-demo-1",
    relation: "cliente",
    evidence: "Homónimo descartado por fecha de nacimiento y expediente interno.",
    decidedBy: "oficial.cumplimiento@demo.local",
    decidedAt: "2026-05-11T12:00:00.000Z",
    nextReviewAt: "2026-11-11",
  }

  const result = searchPep(
    {
      nombre: "Maria Fernanda Gomez de la Torre",
      fechaNacimiento: "1977-06-04",
      relacion: "cliente",
    },
    {
      entities: [pepNominalFixture],
      cargos: pepCargoFixtures,
      internalRecords: [falsePositive],
    },
    "2026-05-11T12:00:00.000Z",
  )

  assert.equal(result.status, "sin_coincidencia")
  assert.equal(result.results.length, 0)
  assert.equal(result.appliedDecisions[0]?.decision, "falso_positivo")
})

test("WhoIs PEP search surfaces internally registered relatives and associates for review", () => {
  const relatedPep: PepInternalRecord = {
    id: "pep-review-related-1",
    schemaVersion: 1,
    subjectName: "Carlos Torres Rivas",
    normalizedSubjectName: "CARLOS TORRES RIVAS",
    decision: "relacionado_pep",
    relation: "beneficiario-controlador",
    relatedPepName: "María Fernanda Gómez de la Torre",
    evidence: "Declaración del cliente: cónyuge de persona con cargo público relevante.",
    decidedBy: "oficial.cumplimiento@demo.local",
    decidedAt: "2026-05-11T12:00:00.000Z",
    nextReviewAt: "2026-08-11",
  }

  const result = searchPep(
    {
      nombre: "Carlos Torres Rivas",
      relacion: "beneficiario-controlador",
    },
    {
      entities: [],
      cargos: pepCargoFixtures,
      internalRecords: [relatedPep],
    },
    "2026-05-11T12:00:00.000Z",
  )

  assert.equal(result.status, "requiere_revision")
  assert.equal(result.results[0]?.source, "internal")
  assert.equal(result.results[0]?.reviewDecision?.decision, "relacionado_pep")
  assert.equal(result.results[0]?.requiresHumanReview, true)
})

test("WhoIs PEP public Mexico snapshot finds Alberto Mendoza Diaz by name without accents", () => {
  const snapshot = pepPublicMxSnapshot as { entities: PepEntity[] }
  const result = searchPep(
    {
      nombre: "Alberto Mendoza Diaz",
      relacion: "cliente",
    },
    {
      entities: snapshot.entities,
      cargos: pepCargoFixtures,
      internalRecords: [],
    },
    "2026-05-11T12:00:00.000Z",
  )

  assert.equal(result.status, "coincidencia_alta")
  assert.equal(result.results[0]?.entity.name, "Alberto Mendoza Díaz")
  assert.equal(result.results[0]?.entity.positions?.[0]?.cargo, "Director General del Instituto Mexicano del Transporte")
  assert.equal(result.results[0]?.matchedFields.includes("nombre"), true)
})

test("WhoIs PEP public Mexico snapshot finds Marcelo Ebrard Casaubon as Economy Secretary", () => {
  const snapshot = pepPublicMxSnapshot as { entities: PepEntity[] }
  const result = searchPep(
    {
      nombre: "Marcelo Ebrard Casaubon",
      relacion: "cliente",
    },
    {
      entities: snapshot.entities,
      cargos: pepCargoFixtures,
      internalRecords: [],
    },
    "2026-05-11T12:00:00.000Z",
  )

  assert.equal(result.status, "coincidencia_alta")
  assert.equal(result.results[0]?.entity.name, "Marcelo Ebrard Casaubón")
  assert.equal(result.results[0]?.entity.positions?.[0]?.cargo, "Secretario de Economía")
  assert.equal(result.results[0]?.entity.positions?.[0]?.dependencia, "Secretaría de Economía")
})
