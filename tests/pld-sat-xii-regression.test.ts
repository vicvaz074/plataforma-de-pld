import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderSatWorkbookXml } from "../lib/pld/sat-xml-program"
import { satDate } from "../lib/pld/sat-xml"
import { validateGeneratedSatXml } from "../lib/pld/sat-xml-validation"
import { normalizeSatXlsmLayout, satFieldValuesToWorkbookCells } from "../lib/pld/sat-xlsm"
import { getSatOperationBranchMissingLabels, withSatParticipantOptions } from "../lib/pld/sat-operation-branches"
import { isSatXlsmFieldActive, pruneInactiveSatFieldValues } from "../lib/pld/ui-workflow"
import { XII_SHARES, XII_SPLIT, XII_SP_PROPERTY } from "../lib/pld/sat-xii-rules"

// Manually mapped from the official worksheets and FEP/FES examples, not from
// the synthetic demo filler. Names, amounts and addresses intentionally differ.
const header = { C4: "AAA010101AAA", C5: "202609", C6: "QA280926", E6: "1,NORMAL",
  C7: "100,Sin alerta.", B19: "SOLICITANTE", C19: "PEREZ", D19: "LOPEZ",
  C23: "1234", C24: "2026-09-28" }
const cells = (sheet: string, values: Record<string, string>) =>
  Object.fromEntries(Object.entries(values).map(([cell, value]) => [sheet + "!" + cell, value]))
const book = (id: string) => normalizeSatXlsmLayout(JSON.parse(readFileSync("public/data/sat-xlsm-layouts/" + id + ".json", "utf8")))
test("fecha de pago no es un importe aunque la validación SAT sea de texto", () => {
  const field = book(XII_SHARES).sections.flatMap((s) => s.fields).find((f) => f.cell === "B102")!
  assert.equal(field.dataType, "fecha")
  assert.equal(satDate("148092.99"), "")
  assert.equal(satDate("2026-02-30"), "")
  assert.equal(satDate("28/09/2026"), "20260928")
})
function validXml(id: string, values: Record<string, string>) {
  const result = renderSatWorkbookXml(id, values)
  assert.deepEqual(result.errors, [])
  assert.deepEqual(validateGeneratedSatXml(result.xml).errors, [])
  return result.xml
}

for (const type of ["pf", "pm", "fid"] as const) {
  for (const address of ["nacional", "extranjero"] as const) {
    test("XII servidor: " + type + " / " + address + ", un domicilio y sin confundir inmueble", () => {
      const values: Record<string, string> = {
        C4: "AAA010101AAA", C5: "202609", C6: "QA280926", E6: "1,NORMAL", C7: "100,Sin alerta.",
        C16: "2026-09-28", C17: "JUZGADO PRIMERO", C18: "ORDINARIO", C19: "CIVIL",
        F16: "123/2026", F17: "1,Transmisión", B25: "1,Edificio habitacional",
        C25: "10000000.00", D25: "06000", G25: "CENTRO", H25: "INMUEBLE DEMO",
        I25: "10", K25: "150.00", L25: "90.00", M25: "123456",
      }
      if (type === "pf") Object.assign(values, { B41: "1,Actor", D41: "ANA", E41: "PEREZ", F41: "LOPEZ", J41: "MEXICO,MX" })
      if (type === "pm") Object.assign(values, { B55: "1,Actor", D55: "SOCIEDAD DEMO", G55: "MEXICO,MX",
        H55: "ROSA", I55: "DIAZ", J55: "RUIZ" })
      if (type === "fid") Object.assign(values, { B68: "1,Actor", D68: "FIDEICOMISO DEMO", F68: "FID123",
        G68: "ELENA", H68: "GARCIA", I68: "RUIZ" })
      if (address === "nacional") Object.assign(values, { B83: "03100", E83: "DEL VALLE", F83: "CLIENTE DEMO", G83: "22" })
      else Object.assign(values, { B96: "ESTADOS UNIDOS,US", C96: "TEXAS", D96: "AUSTIN",
        E96: "CENTRO", F96: "CLIENTE EXTRANJERO", G96: "33", I96: "78701" })
      const xml = validXml(XII_SP_PROPERTY, cells("Aviso", values))
      assert.equal(xml.match(/<datos_persona_acto>/g)?.length, 1)
      assert.equal(xml.match(/<tipo_domicilio>/g)?.length, 1)
      assert.match(xml, /<valor_catastral>10000000\.00<\/valor_catastral>/)
      assert.match(xml, /<dimension_terreno>150\.00<\/dimension_terreno>/)
      assert.match(xml, /<calle>INMUEBLE DEMO<\/calle>/)
    })
  }
}

for (const operation of ["1", "2"]) test("XII acciones: operación " + operation + ", comprador/vendedor y dos pagos independientes", () => {
  const values = cells("Persona Objeto del aviso", { ...header, C27: operation,
    B31: "SOCIEDAD ALFA", E31: "MEXICO,MX", F31: "100.00", G31: "10.00",
    B47: "VENDEDORA", C47: "PEREZ", D47: "LOPEZ", H47: "MEXICO,MX", I47: "10.00", J47: "SOCIEDAD ALFA",
    B75: "COMPRADORA", C75: "DIAZ", D75: "RUIZ", H75: "MEXICO,MX", I75: "10.00", J75: "SOCIEDAD ALFA",
    B102: "2026-09-28", C102: "1,Contado", D102: "8,Transferencia", E102: "1,Peso mexicano", F102: "10000000.00",
    B103: "2026-09-29", C103: "1,Contado", D103: "8,Transferencia", E103: "1,Peso mexicano", F103: "123.45" })
  const xml = validXml(XII_SHARES, values)
  assert.match(xml, new RegExp("<tipo_operacion>" + operation + "</tipo_operacion>"))
  assert.match(xml, /<datos_vendedor>[\s\S]*?<nombre>VENDEDORA<\/nombre>/)
  assert.match(xml, /<datos_comprador>[\s\S]*?<nombre>COMPRADORA<\/nombre>/)
  assert.equal(xml.match(/<datos_liquidacion>/g)?.length, 2)
  assert.match(xml, /<monto_operacion>10000000\.00<\/monto_operacion>/)
  assert.match(xml, /<monto_operacion>123\.45<\/monto_operacion>/)
  assert.doesNotMatch(xml, /<forma_pago>/)
  assert.match(xml, /<instrumento_monetario>8<\/instrumento_monetario>/)
})

for (const determined of ["SI", "NO"]) for (const survives of ["SI", "NO"]) {
  test("XII escisión: escindidas " + determined + ", subsiste " + survives, () => {
    const values = cells("Persona Objeto del aviso", { ...header,
      B30: "ESCINDENTE DEMO", E30: "MEXICO,MX", F30: "NO APLICA||1000000", G30: "10000000.00", D32: survives,
      B38: "SOCIA ORIGINAL", C38: "PEREZ", D38: "LOPEZ", H38: "MEXICO,MX", I38: "100.00",
      D64: determined, B67: "ESCINDIDA DEMO", E67: "MEXICO,MX", F67: "NO APLICA||1000000",
      G67: "5000000.00", J67: "50.00", B82: "SOCIA NUEVA", C82: "DIAZ", D82: "RUIZ",
      H82: "MEXICO,MX", I82: "50.00", J82: "ESCINDIDA DEMO" })
    const xml = validXml(XII_SPLIT, values)
    assert.equal(xml.includes("<datos_accionista_escindente>"), survives === "SI")
    assert.equal(xml.includes("<dato_escindida>"), determined === "SI")
    assert.equal(xml.includes("<datos_accionista>"), determined === "SI")
  })
}

test("XII capture excludes stale address/person branches, including cell aliases", () => {
  const layout = book(XII_SP_PROPERTY), fields = layout.sections.flatMap((s) => s.fields)
  const at = (cell: string) => fields.find((f) => f.sheetName === "Aviso" && f.cell === cell)!
  const values = { ["sat.branch." + XII_SP_PROPERTY + ".interviniente.1.pf"]: "si",
    ["sat.branch." + XII_SP_PROPERTY + ".domicilio.1.nacional"]: "si",
    [at("D41").id]: "ANA", [at("D55").id]: "OBSOLETO", [at("F83").id]: "DOMICILIO CLIENTE",
    [at("F96").id]: "OBSOLETO", "Aviso!F96": "OBSOLETO" }
  const output = satFieldValuesToWorkbookCells(values, layout)
  assert.equal(output["Aviso!D41"], "ANA")
  assert.equal(output["Aviso!F83"], "DOMICILIO CLIENTE")
  assert.equal(output["Aviso!D55"], undefined)
  assert.equal(output["Aviso!F96"], undefined)
})

for (const id of [XII_SHARES, XII_SPLIT]) test(id + ": companies update catalog and reject stale links", () => {
  const layout = book(id), fields = layout.sections.flatMap((s) => s.fields)
  const at = (cell: string) => fields.find((f) => f.cell === cell)!
  const company = at(id === XII_SHARES ? "B31" : "B67")
  const link = at(id === XII_SHARES ? "J47" : "J82")
  const values: Record<string, string> = { [company.id]: "ALFA", [link.id]: "ALFA" }
  if (id === XII_SPLIT) values[at("D64").id] = "SI"
  const dynamic = () => withSatParticipantOptions(fields, values).find((f) => f.id === link.id)!
  assert.deepEqual(dynamic().options, ["ALFA"])
  values[company.id] = "BETA"
  assert.deepEqual(dynamic().options, ["BETA"])
  assert.ok(getSatOperationBranchMissingLabels(id, values, fields).length > 0)
  if (id === XII_SPLIT) {
    values[at("D64").id] = "NO"
    assert.equal(isSatXlsmFieldActive(link, values), false)
    assert.equal(pruneInactiveSatFieldValues({ fields, values })[link.id], undefined)
  }
})
