import assert from "node:assert/strict"
import test from "node:test"
import { renderSatWorkbookXml } from "../lib/pld/sat-xml-program"
import { validateGeneratedSatXml } from "../lib/pld/sat-xml-validation"

// Independent manual fixture, NOT buildSatTemplateDemoScenarioValues.
// Cells from MutuoPrestamoCredito_v4_3.xlsm, Sheet1/Hoja2 XML routines.
function manualLoan(person: "pf" | "pm" | "fid") {
  const cells: Record<string, string> = {
    "Persona Objeto del aviso!C4": "AAA010101AAA",
    "Persona Objeto del aviso!C5": "202609",
    "Persona Objeto del aviso!C6": "DEMO280926",
    "Persona Objeto del aviso!E6": "1,NORMAL",
    "Persona Objeto del aviso!C7": "100,Sin alerta.",
    "Persona Objeto del aviso!B60": "06000",
    "Persona Objeto del aviso!E60": "CENTRO",
    "Persona Objeto del aviso!F60": "REFORMA",
    "Persona Objeto del aviso!G60": "123",
    "Acto u operación!C5": "2026-09-26",
    "Acto u operación!C6": "06000",
    "Acto u operación!C7": "401,Otorgamiento sin garantía",
    "Acto u operación!B173": "2026-09-26",
    "Acto u operación!C173": "8,Transferencia Interbancaria",
    "Acto u operación!D173": "1,Peso mexicano",
    "Acto u operación!E173": "10000000.00",
    "Beneficiario controlador!B5": "ELENA",
    "Beneficiario controlador!C5": "DIAZ",
    "Beneficiario controlador!D5": "RUIZ",
    "Beneficiario controlador!H5": "MEXICO,MX",
  }
  if (person === "pf") Object.assign(cells, {
    "Persona Objeto del aviso!B19": "ANA",
    "Persona Objeto del aviso!C19": "PEREZ",
    "Persona Objeto del aviso!D19": "LOPEZ",
    "Persona Objeto del aviso!H19": "MEXICO,MX",
    "Persona Objeto del aviso!I19": "NO APLICA||1000000",
  })
  else {
    Object.assign(cells, {
      "Persona Objeto del aviso!B46": "ROSA",
      "Persona Objeto del aviso!C46": "GARCIA",
      "Persona Objeto del aviso!D46": "RUIZ",
    })
    if (person === "pm") Object.assign(cells, {
      "Persona Objeto del aviso!B33": "EMPRESA DEMO SA DE CV",
      "Persona Objeto del aviso!E33": "MEXICO,MX",
      "Persona Objeto del aviso!F33": "NO APLICA||1000000",
    })
    else Object.assign(cells, {
      "Persona Objeto del aviso!G33": "FIDEICOMISO DEMO",
      "Persona Objeto del aviso!H33": "AAA010101AAA",
      "Persona Objeto del aviso!I33": "FID123",
    })
  }
  return cells
}

for (const person of ["pf", "pm", "fid"] as const) test(`IV manual ${person}: persona y BC distintos, $10M exactos y una sola liquidación`, () => {
  const result = renderSatWorkbookXml("sat-fraccion-iv-prestamos", manualLoan(person))
  assert.deepEqual(result.errors, [])
  const validation = validateGeneratedSatXml(result.xml)
  assert.deepEqual(validation.errors, [])
  assert.match(result.xml, /<monto_operacion>10000000\.00<\/monto_operacion>/)
  assert.equal(result.xml.match(/<datos_liquidacion>/g)?.length, 1)
  assert.match(result.xml, /<dueno_beneficiario>[\s\S]*<nombre>ELENA<\/nombre>/)
  assert.equal(result.xml.includes("<garantia>"), false)
  if (person === "fid") assert.match(result.xml, /<fideicomiso>[\s\S]*FIDEICOMISO DEMO/)
})

test("IV dos liquidaciones independientes y datos que faltan bloquean XML", () => {
  const cells = manualLoan("pf")
  Object.assign(cells, {
    "Acto u operación!B174": "2026-09-27",
    "Acto u operación!C174": "8,Transferencia Interbancaria",
    "Acto u operación!D174": "1,Peso mexicano",
    "Acto u operación!E174": "123.45",
  })
  const result = renderSatWorkbookXml("sat-fraccion-iv-prestamos", cells)
  assert.equal(result.xml.match(/<datos_liquidacion>/g)?.length, 2)
  assert.match(result.xml, /<monto_operacion>123\.45<\/monto_operacion>/)
  assert.equal(validateGeneratedSatXml(result.xml).valid, true)
  delete cells["Persona Objeto del aviso!B19"]
  assert.equal(validateGeneratedSatXml(renderSatWorkbookXml("sat-fraccion-iv-prestamos", cells).xml).valid, false)
})

test("el motor no ejecuta fórmulas ni instrucciones incluidas como datos", () => {
  const cells = manualLoan("pm")
  cells["Persona Objeto del aviso!B33"] = '<script>&"=WEBSERVICE("https://example.com")'
  const result = renderSatWorkbookXml("sat-fraccion-iv-prestamos", cells)
  assert.deepEqual(result.errors, [])
  assert.match(result.xml, /&lt;script&gt;&amp;&quot;=WEBSERVICE/)
  assert.doesNotMatch(result.xml, /<script>/)
})

test("XII poderes keeps the grantor distinct from the attorney across repeated exports", () => {
  const sheet = "Persona Objeto del aviso!"
  const values = { C4: "AAA010101AAA", C5: "202609", C6: "DEMOPODER", E6: "1,NORMAL", C7: "100,Sin alerta.",
    B19: "CLIENTE", C19: "PEREZ", D19: "LOPEZ", C23: "123", C24: "2026-09-26",
    B31: "OTORGANTE", C31: "RAMIREZ", D31: "RUIZ", H31: "MEXICO,MX", I31: "NO APLICA||1000000",
    B61: "APODERADA", C61: "DIAZ", D61: "GOMEZ", H61: "MEXICO,MX", I61: "1,de administración" }
  const cells = Object.fromEntries(Object.entries(values).map(([cell, value]) => [sheet + cell, value]))
  for (let i = 0; i < 2; i++) {
    const output = renderSatWorkbookXml("sat-fraccion-xii-notarios-b", cells)
    assert.deepEqual(output.errors, [])
    assert.deepEqual(validateGeneratedSatXml(output.xml).errors, [])
    assert.match(output.xml, /<datos_poderdante>[\s\S]*?<nombre>OTORGANTE<\/nombre>/)
    assert.match(output.xml, /<datos_apoderado>[\s\S]*?<nombre>APODERADA<\/nombre>/)
    assert.equal(output.xml.match(/<datos_poderdante>/g)?.length, 1)
  }
})
