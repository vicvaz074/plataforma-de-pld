import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import * as XLSX from "xlsx"
import { parseOperationImport } from "../lib/pld/import-operations"
import { IMPORT_CLIENT_LINK_MISSING, resolveImportRowClient } from "../lib/pld/import-client-resolution"
import { buildSatTemplateDemoScenarios, buildSatTemplateDemoScenarioValues } from "../lib/pld/sat-demo-scenarios"
import { normalizeSatXlsmLayout, satFieldValuesToWorkbookCells } from "../lib/pld/sat-xlsm"
import type { SatXlsmLayout } from "../lib/pld/types"

function bookFromCells(layout: SatXlsmLayout, cells: Record<string,string>) {
  const book = XLSX.utils.book_new()
  for (const name of [...new Set(layout.sections.map((section) => section.sheetName))]) {
    const sheet: XLSX.WorkSheet = {}
    for (const [key,value] of Object.entries(cells)) {
      const split = key.lastIndexOf("!")
      if (key.slice(0,split) === name) XLSX.utils.sheet_add_aoa(sheet, [[value]], {origin:key.slice(split+1)})
    }
    XLSX.utils.book_append_sheet(book,sheet,name)
  }
  return new Uint8Array(XLSX.write(book,{type:"array",bookType:"xlsx"}))
}
const context = { companyId:"isolated-company", companyName:"Contrato de importación", companyRfc:"FSC220908AC2", actor:"user", now:"2026-11-11T12:00:00Z" }

test("40 layouts import independently of macros, preserve activity/company and never certify incomplete inputs", async () => {
  const scenarios = buildSatTemplateDemoScenarios()
  assert.equal(scenarios.length,40)
  for (const scenario of scenarios) {
    const layout = normalizeSatXlsmLayout(JSON.parse(readFileSync(`public/data/sat-xlsm-layouts/${scenario.templateId}.json`,"utf8")))
    const values = buildSatTemplateDemoScenarioValues({scenario,layout})
    const preview = await parseOperationImport({bytes:bookFromCells(layout,satFieldValuesToWorkbookCells(values.satFieldValues,layout)),
      fileName:scenario.template.officialXlsmName.replace(/\.xlsm$/i,".xlsx"),templateId:scenario.templateId,layouts:[layout],
      context:{...context,activityKey:scenario.actividadKey}})
    const unlinked = preview.rows[0]
    assert.equal(unlinked.operation.captureStatus,"draft",`${scenario.templateId}: import never invents a client ID`)
    assert.ok(unlinked.issues.includes(IMPORT_CLIENT_LINK_MISSING))
    const clientId=`qa-client-${scenario.templateId}`
    const row=resolveImportRowClient(unlinked,{kind:"client",id:clientId},[{id:clientId,kind:"client",nombre:unlinked.operation.cliente,
      identifiers:unlinked.operation.expedienteIdentifiers||unlinked.operation.identifiers||{rfc:unlinked.operation.rfc},tipoCliente:unlinked.operation.tipoCliente}])
    assert.equal(row.operation.clienteId,clientId)
    assert.equal(row.issues.includes(IMPORT_CLIENT_LINK_MISSING),false)
    assert.equal(row.operation.actividadKey,scenario.actividadKey,scenario.templateId)
    assert.equal(row.operation.sujetoObligado?.id,context.companyId,scenario.templateId)
    assert.equal(row.operation.satTemplateId,scenario.templateId)
    assert.equal(row.operation.avisoPresentado,false)
    if (row.issues.length) assert.equal(row.operation.captureStatus,"draft",scenario.templateId)
    if (!scenario.actividadKey.startsWith("fraccion-xiv") && scenario.templateId !== "sat-fraccion-v-bis-desarrollo") assert.notEqual(row.operation.cliente,"Cliente sin nombre",`${scenario.templateId}: occupied client name must not disappear`)
    assert.ok(Object.keys(row.operation.satCellValues || {}).length,`${scenario.templateId}: preserve active cells`)
  }
})

test("XI-B import prunes stale Otro and virtual-asset cells and never treats virtual amounts as MXN",async()=>{
  const templateId="sat-fraccion-xi-b-administracion"
  const layout=normalizeSatXlsmLayout(JSON.parse(readFileSync(`public/data/sat-xlsm-layouts/${templateId}.json`,"utf8")))
  const all=layout.sections.flatMap((section)=>section.fields)
  for(const instrument of ["8,Transferencia Interbancaria","16,Activos Virtuales"]){
    const values={"acto.activo_administrado":"1,Dinero","acto.activo_administrado_otro":"STALE OTHER", "acto.descripcion_activo_administrado":"STALE OTHER",
      "operacion_financiera.instrumento_monetario":instrument,"operacion_financiera.moneda":"1,Peso mexicano", "operacion_financiera.monto":"10000000.00",
      "operacion_financiera.activo_virtual":"999999,Otro","operacion_financiera.activo_virtual_otro":"Moneda de ejemplo", "operacion_financiera.activo_virtual_cantidad":"1"}
    // Deliberately retain stale source cells to exercise importer pruning rather than the exporter.
    const cells=Object.fromEntries(Object.entries(values).map(([id,value])=>{const field=all.find((item)=>item.id===id)!;return [`${field.sheetName}!${field.cell}`,value]}))
    const row=(await parseOperationImport({bytes:bookFromCells(layout,cells),fileName:"Administracion.xlsx",templateId,layouts:[layout],context:{...context,activityKey:"fraccion-xi-b-administracion"}})).rows[0]
    assert.equal(row.operation.satFieldValues?.["acto.activo_administrado_otro"],undefined)
    assert.equal(row.operation.satCellValues?.["Acto u operación!F124"],undefined)
    if(instrument.startsWith("8,")){
      assert.equal(row.operation.satFieldValues?.["operacion_financiera.activo_virtual_otro"],undefined)
      assert.equal(row.operation.montoCentavos,1_000_000_000)
    }else{
      assert.equal(row.operation.satFieldValues?.["operacion_financiera.moneda"],undefined)
      assert.equal(row.operation.satFieldValues?.["operacion_financiera.activo_virtual_otro"],"Moneda de ejemplo")
      assert.equal(row.operation.captureStatus,"draft")
      assert.equal(row.operation.montoCentavos,0,"a virtual amount is not automatically the MXN equivalent")
    }
  }
})

test("manual noncanonical workbook input separates PM from representative and recovers exact money/payment",async()=>{
  const templateId="sat-fraccion-i-juegos"
  const layout=normalizeSatXlsmLayout(JSON.parse(readFileSync(`public/data/sat-xlsm-layouts/${templateId}.json`,"utf8")))
  const cells={"Persona Objeto del aviso!C4":context.companyRfc,"Persona Objeto del aviso!B33":"Cliente Moral Independiente",
    "Persona Objeto del aviso!D33":"DLV190624M32","Persona Objeto del aviso!B46":"Representante Distinto",
    "Beneficiario controlador!B5":"Beneficiaria","Beneficiario controlador!C5":"Pérez","Beneficiario controlador!D5":"García","Beneficiario controlador!H5":"MEXICO,MX",
    "Acto u operación!C4":"11/11/2026","Acto u operación!B21":"11/11/2026","Acto u operación!C21":"8,Transferencia Interbancaria",
    "Acto u operación!D21":"1,Peso mexicano","Acto u operación!E21":"10000000.00"}
  const row=(await parseOperationImport({bytes:bookFromCells(layout,cells),fileName:"Juegos.xlsx",templateId,layouts:[layout],context:{...context,activityKey:"fraccion-i-juegos"}})).rows[0]
  assert.equal(row.operation.cliente,"Cliente Moral Independiente")
  assert.equal(row.operation.rfc,"DLV190624M32")
  assert.equal(row.operation.tipoCliente,"pm_mexicana")
  assert.equal(row.operation.fechaOperacion,"2026-11-11")
  assert.equal(row.operation.montoCentavos,1_000_000_000)
  assert.equal((row.operation.liquidacion as {instrumento:string}).instrumento,"8,Transferencia Interbancaria")
  assert.equal(row.operation.satFieldValues?.["persona_objeto.tipo_persona"],"persona_moral")
  assert.equal(row.issues.some((issue)=>issue==="SAT: Nombre(s)"),false,"the unselected PF branch must not be required")
  const differentSubject=(await parseOperationImport({bytes:bookFromCells(layout,{...cells,"Persona Objeto del aviso!C4":"EQA260101AB1"}),fileName:"OtroSujeto.xlsx",templateId,layouts:[layout],context:{...context,activityKey:"fraccion-i-juegos"}})).rows[0]
  assert.equal(differentSubject.operation.captureStatus,"draft")
  assert.equal(differentSubject.operation.satWorkbookStatus,"borrador_bloqueado")
  assert.ok(differentSubject.issues.some((issue)=>issue.includes("RFC del sujeto obligado")))
  assert.equal(differentSubject.operation.sujetoObligado?.id,context.companyId,"no se reasigna la identidad por el RFC del archivo")
})
