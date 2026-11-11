import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as XLSX from "xlsx"
import { parseOperationImport,mergeImportedOperations, nativePdfSuggestions, assertImportFileLimits } from "../lib/pld/import-operations"
import { buildPldDemoDataset } from "../lib/demo/pld-demo-data"
import { fillSatXlsmTemplate } from "../lib/pld/sat-xlsm"
import type { SatXlsmLayout } from "../lib/pld/types"
import { IMPORT_CLIENT_LINK_MISSING,resolveImportRowClient } from "../lib/pld/import-client-resolution"

const context={companyId:"company-one",companyRfc:"ISN2103158Q7",companyName:"Sujeto Prueba",actor:"user-one",activityKey:"fraccion-xv-uso-goce",now:"2026-11-11T12:00:00Z"}
const csv=(rows:string)=>new TextEncoder().encode("cliente,rfc,tipoCliente,actividadKey,fechaOperacion,monto,moneda,instrumentoMonetario\n"+rows)
test("tabular import keeps exact amounts and partial rows as drafts, never fabricated SAT readiness",async()=>{
  const preview=await parseOperationImport({fileName:"operaciones.csv",bytes:csv("Cliente Uno,DLV190624M32,pm_mexicana,fraccion-xv-uso-goce,2026-11-01,10000000.00,MXN,8\nCliente Dos,,pm_mexicana,fraccion-xv-uso-goce,2026-11-02,1.001,USD,8"),context})
  assert.equal(preview.rows.length,2);assert.equal(preview.rows[0].operation.montoCentavos,1_000_000_000)
  assert.equal(preview.rows[0].operation.captureStatus,"draft");assert.equal(preview.rows[1].status,"incomplete")
  assert.equal(preview.rows[1].operation.financeReviewRequired,true);assert.equal(preview.rows[0].operation.avisoPresentado,false)
})
test("reimport is idempotent and never merges clients by RFC",async()=>{
  const input={fileName:"operaciones.csv",bytes:csv("Cliente Uno,DLV190624M32,pm_mexicana,fraccion-xv-uso-goce,2026-11-01,10000000.00,MXN,8"),context}
  const first=await parseOperationImport(input), saved=mergeImportedOperations([],first.rows,[first.rows[0].id],true)
  const second=await parseOperationImport({...input,existing:saved.operations})
  assert.equal(second.rows[0].status,"duplicate");assert.equal(mergeImportedOperations(saved.operations,second.rows,[second.rows[0].id],true).added,0)
  const third=await parseOperationImport({...input,bytes:csv("Cliente Uno,DLV190624M32,pm_mexicana,fraccion-xv-uso-goce,2026-11-02,200000.00,MXN,8")})
  assert.notEqual(first.rows[0].id,third.rows[0].id)
})
test("SAT XV preserves cell values, beneficiary and 10M reference without running macros",async()=>{
  const operation=(buildPldDemoDataset().actividades_vulnerables_operaciones as any[])[2]
  const templateId="sat-fraccion-xv-arrendamiento", fileName="Arrendamiento_v4_5.xlsm"
  const layout=JSON.parse(readFileSync(`public/data/sat-xlsm-layouts/${templateId}.json`,"utf8")) as SatXlsmLayout
  const filled=fillSatXlsmTemplate(new Uint8Array(readFileSync(`public/sat-templates/${templateId}/${fileName}`)),{template:{templateId,officialXlsmName:fileName},values:operation.satFieldValues,layout})
  const result=await parseOperationImport({bytes:filled.workbook,fileName,context,layouts:[layout]})
  assert.equal(result.templateId,templateId);assert.equal(result.rows[0].operation.montoCentavos,40_000_000)
  assert.equal(result.rows[0].operation.satFieldValues?.["inmueble.valor_referencia"],"10000000")
  assert.equal(result.rows[0].operation.satFieldValues?.["beneficiario.pf.nombre"],"Adriana")
  assert.deepEqual(result.rows[0].issues,[IMPORT_CLIENT_LINK_MISSING])
  const row=result.rows[0],target={kind:"client" as const,id:"client-known",nombre:row.operation.cliente,identifiers:{rfc:row.operation.rfc},tipoCliente:row.operation.tipoCliente}
  assert.equal(resolveImportRowClient(row,{kind:"client",id:target.id},[target]).status,"valid")
})
test("invalid workbook sizes and malformed dates are rejected or kept incomplete",async()=>{
  assert.throws(()=>assertImportFileLimits(new Uint8Array([1,2,3]),"fake.xlsx"),/estructura/)
  const result=await parseOperationImport({fileName:"fechas.csv",bytes:csv("Cliente,DLV190624M32,pm_mexicana,fraccion-xv-uso-goce,2026-02-30,2,MXN,8"),context})
  assert.equal(result.rows[0].status,"incomplete");assert.ok(result.rows[0].issues.some((issue)=>issue.includes("Fecha")))
  assert.equal(result.rows[0].operation.fechaOperacion,"");assert.equal(result.rows[0].operation.periodo,"");assert.equal(result.rows[0].operation.dateReviewRequired,true)
  assert.equal((result.rows[0].operation.importRaw as Record<string,string>).fechaOperacion,"2026-02-30")
})
test("custom column mappings are explicit and retain original source",async()=>{
  const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([["cliente","rfc","dinero","fechaOperacion","moneda","tipoCliente"],["Empresa","DLV190624M32","10000000.00","2026-11-10","MXN","pm_mexicana"]]),"Captura")
  const parsed=await parseOperationImport({bytes:new Uint8Array(XLSX.write(workbook,{type:"array",bookType:"xlsx"})),fileName:"custom.xlsx",context,mapping:{amount:"dinero"}})
  assert.equal(parsed.rows[0].operation.montoCentavos,1_000_000_000);assert.equal(parsed.rows[0].source.sheet,"Captura")
})
test("PDF text suggestions include their page and do not invent absent fields",()=>{
  const values=nativePdfSuggestions([{page:2,text:"RFC DLV190624M32, fecha 11/11/2026"},{page:3,text:"Sin identificadores"}])
  assert.equal(values[0].rfc,"DLV190624M32");assert.equal(values[0].date,"2026-11-11");assert.equal(values[0].page,2);assert.equal(values[1].rfc,"")
})
test("blank rows do not shift the source cell row or deterministic import identity",async()=>{
  const result=await parseOperationImport({fileName:"filas.csv",bytes:csv("Cliente Uno,DLV190624M32,pm_mexicana,fraccion-xv-uso-goce,2026-11-01,2,MXN,8\n,,,,,,,\nCliente Dos,DLV190624M33,pm_mexicana,fraccion-xv-uso-goce,2026-11-02,3,MXN,8"),context})
  assert.deepEqual(result.rows.map((row)=>row.source.row),[2,4]);assert.ok(result.rows[1].id.endsWith("-4"))
})
test("an unrelated tabular header can be mapped explicitly without inventing a SAT format",async()=>{
  const bytes=new TextEncoder().encode("Razón comercial,Clave fiscal,Importe pactado,Día del acto,Divisa,Persona\nEmpresa QA,DLV190624M32,10000000.00,2026-11-11,MXN,pm_mexicana")
  const initial=await parseOperationImport({fileName:"propio.csv",bytes,context})
  assert.equal(initial.headers[0],"Razón comercial");assert.equal(initial.rows[0].status,"incomplete");assert.equal(initial.templateId,undefined)
  const mapped=await parseOperationImport({fileName:"propio.csv",bytes,context,mapping:{name:"Razón comercial",rfc:"Clave fiscal",amount:"Importe pactado",date:"Día del acto",currency:"Divisa",personType:"Persona"}})
  assert.equal(mapped.rows[0].operation.cliente,"Empresa QA");assert.equal(mapped.rows[0].operation.montoCentavos,1_000_000_000)
})
