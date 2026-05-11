import test from "node:test"
import assert from "node:assert/strict"

import {
  ACTIVIDADES_VULNERABLES_ARTICULO_17,
  calcularFechaLimiteAvisoOrdinario,
  calcularFechaLimiteAvisoSospecha,
  classifyAvisoSalida,
  evaluarOperacionVulnerable,
  evaluateEvidenceChecklist,
  getAcumulacionRuleForActividad,
  getDocumentRequirementsForCliente,
  getUmaForDate,
  matchPepCargo,
  pepCargoFixtures,
} from "../lib/pld"

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
