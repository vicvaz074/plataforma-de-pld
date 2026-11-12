import assert from "node:assert/strict"
import test from "node:test"
import { createStoredPldOperation, type StoredPldOperationV3 } from "../lib/pld/stored-operations"
import { buildAvisosProfessionalReport, collectAvisosReportTrace, operationNoticeStage, selectAvisosReportScope, avisosReportDate, type AvisosReportInput } from "../lib/pld/reports-avisos"
import type { IntegrationClient, IntegrationSubject } from "../lib/pld/integration-records"
import type { SatOutputPackage } from "../lib/pld/types"
import type { StoredSubmission, SubmissionTrace } from "../lib/pld/submissions"

const at="2026-11-11T12:00:00.000Z"
const client=(id:string,identifier="CURP-PRUEBA"):IntegrationClient=>({id,expedienteId:id,nombre:`Cliente ${id}`,rfc:"RFC-COMPARTIDO",identifier,identifiers:{rfc:"RFC-COMPARTIDO",curp:identifier,nif:""},sujetoObligadoId:"sujeto-a"})
const subject=(id:string):IntegrationSubject=>({id,nombre:id,rfc:"RFC-COMPARTIDO",activityKeys:["fraccion-xv-uso-goce"],source:"registro",aliasIds:id==="sujeto-a"?["sujeto-antiguo-a"]:[]})
function operation(id:string,patch:Partial<StoredPldOperationV3>={}):StoredPldOperationV3 {
  const value=createStoredPldOperation({id,expedienteId:"cliente-a",clienteId:"cliente-a",cliente:"Cliente de prueba",actividadKey:"fraccion-xv-uso-goce",actividadNombre:"Arrendamiento",fechaOperacion:"2026-11-11",periodo:"202611",moneda:"MXN",montoCentavos:1_000_000_001,umbralStatus:"aviso",captureStatus:"complete",sujetoObligado:{id:"sujeto-a",rfc:"RFC-COMPARTIDO"}},{at})
  assert.ok(value)
  return {...value,...patch}
}
const event=(id:string,noticeId="aviso-1"):SubmissionTrace=>({id,noticeId,action:"Revisión",user:"QA",timestamp:at,details:`Detalle ${id}`})
function submission(id:string,operationId:string,revision=1,trace:SubmissionTrace[]=[]):StoredSubmission {
  return {schemaVersion:2,id,revision:1,operationId,sourceOperationRevision:revision,operationType:"relevante",form:{},checklist:{},evidence:{},attachments:[],trace,status:"draft",createdAt:at,updatedAt:at}
}
const input=(patch:Partial<AvisosReportInput>={}):AvisosReportInput=>({operations:[operation("operacion-a")],clients:[client("cliente-a")],subjects:[subject("sujeto-a"),subject("sujeto-b")],submissions:[],packages:[],...patch})
function satPackage(operationId:string,revision:number):SatOutputPackage {
  return {id:`package-${operationId}`,schemaVersion:2,createdAt:at,sourceOperationId:operationId,sourceOperationRevision:revision,tenantId:"sujeto-a",tenantRfc:"RFC-COMPARTIDO",tenantName:"Sujeto",periodo:"202611",formatoId:"ari",actividadKey:"fraccion-xv-uso-goce",clienteNombre:"Cliente",outputKind:"aviso_normal",label:"Aviso",xml:"<xml/>",xmlFileName:"aviso.xml",ficha:"",fichaFileName:"",validation:{status:"listo",errors:[],warnings:[],missingFields:[]},downloads:[]}
}

test("report filters combine subject/client stable IDs, aliases, CURP/NIF and never join different IDs by RFC",()=>{
  const a=operation("a"),b=operation("b",{expedienteId:"cliente-b",clienteId:"cliente-b",sujetoObligado:{id:"sujeto-b",rfc:"RFC-COMPARTIDO"}})
  const alias=operation("alias",{sujetoObligado:{id:"sujeto-antiguo-a",rfc:"RFC-COMPARTIDO"}})
  const unlinked=operation("unlinked",{expedienteId:undefined,clienteId:undefined,sujetoObligado:{rfc:"RFC-COMPARTIDO"}})
  const data=input({operations:[a,b,alias,unlinked],clients:[client("cliente-a"),{...client("cliente-b","NIF-PRUEBA"),sujetoObligadoId:"sujeto-b"}],subjectId:"sujeto-a",clientId:"cliente-a"})
  assert.deepEqual(selectAvisosReportScope(data).operations.map((op)=>op.id),["a","alias"])
  const built=buildAvisosProfessionalReport("consolidated",data)
  assert.equal(built.csvRows.length,2)
  assert.equal(built.csvRows[1][1],"CURP-PRUEBA")
  assert.equal(selectAvisosReportScope({...data,clientId:"desconocido"}).operations.length,0)
  assert.equal(selectAvisosReportScope({...data,clientId:"__all__"}).clients.length,1)
  const singular=buildAvisosProfessionalReport("consolidated",input()).report
  assert.match(singular.summary[0],/^1 cliente vinculado y 1 operación vigente/)
  assert.match(singular.summary[0],/1 operación tiene obligación/)
  assert.match(singular.summary[0],/1 operación no cuenta/)
  assert.equal(singular.sections[0].bars?.[0].valueLabel,"1 operación")
  assert.match(buildAvisosProfessionalReport("notice",input()).report.summary[0],/^1 operación vigente tiene/)
})

test("report scope recognizes a client's expediente alias independently from its display ID",()=>{
  const data=input({clients:[{...client("display-id"),expedienteId:"cliente-a",sujetoObligadoId:undefined}],subjectId:"sujeto-a",clientId:"display-id"})
  assert.equal(selectAvisosReportScope(data).operations.length,1)
  assert.equal(selectAvisosReportScope(data).clients.length,1)
})

test("reports retain exact cents; unknown USD conversion is never a zero or a peso amount",()=>{
  const exact=buildAvisosProfessionalReport("consolidated",input()).report
  assert.equal(exact.metrics?.[2].value,"$10,000,000.01")
  const pending=operation("usd",{moneda:"USD",finance:undefined,financeReviewRequired:true})
  const unknown=buildAvisosProfessionalReport("notice",input({operations:[pending]})).report
  assert.equal(unknown.metrics?.[1].value,"Sin total MXN validado")
  assert.match(unknown.metrics?.[1].note||"",/1 importe pendiente/)
  const mixed=buildAvisosProfessionalReport("consolidated",input({operations:[operation("mxn"),pending]})).report
  assert.equal(mixed.metrics?.[2].value,"$10,000,000.01")
  assert.match(mixed.metrics?.[2].label||"",/parcial/)
  const valid=operation("usd-valid",{moneda:"USD",montoCentavos:2_000_000,finance:{currency:"USD",originalAmount:"1000.00",exchangeRate:"20",exchangeRateDate:"2026-11-11",exchangeRateSource:"Fuente QA documentada",mxnAmountCents:2_000_000}})
  assert.equal(buildAvisosProfessionalReport("consolidated",input({operations:[valid]})).report.metrics?.[2].value,"$20,000.00")
  const invalid={...valid,finance:{...valid.finance!,exchangeRateSource:""}}
  assert.equal(buildAvisosProfessionalReport("consolidated",input({operations:[invalid]})).report.metrics?.[2].value,"Sin total MXN validado")
  const undetermined=operation("undetermined",{montoCentavos:0,montoNoDeterminado:true})
  const undeterminedReport=buildAvisosProfessionalReport("notice",input({operations:[undetermined]}))
  assert.equal(undeterminedReport.report.metrics?.[1].value,"Sin total MXN validado")
  assert.equal(undeterminedReport.csvRows[1][3],"Monto no determinado")
})

test("presentation, XML local and obligation are separate and exact-revision linked",()=>{
  const op=operation("a",{revision:3})
  assert.equal(operationNoticeStage(op,input({packages:[satPackage(op.id,2)]})),"Por preparar")
  assert.equal(operationNoticeStage(op,input({packages:[satPackage(op.id,3)]})),"XML validado localmente")
  const presented={...op,submission:{...op.submission,status:"presented" as const},avisoPresentado:true}
  const historical={...submission("aviso-historico",op.id,2),status:"presented" as const,form:{folio:"F",digitalSeal:"S",submissionDate:"2026-11-11",acknowledgementDate:"2026-11-11"},attachments:[{id:"acuse",type:"Acuse SAT",name:"acuse.pdf",size:1,mimeType:"application/pdf",dataUrl:"/api/v1/companies/qa/files/receipt",sha256:"hash",uploadedAt:at}]}
  assert.equal(operationNoticeStage(presented,input({submissions:[historical]})),"Histórico por revisar")
  assert.equal(operationNoticeStage(presented,input({submissions:[{...historical,sourceOperationRevision:3}]})),"Presentación documentada")
  assert.equal(operationNoticeStage({...presented,submission:{...presented.submission,status:"correction-pending"}},input({submissions:[historical]})),"Corrección pendiente")
  const reports=buildAvisosProfessionalReport("notice",input({operations:[operation("27bis",{avisoSalidaTipo:"informe_27_bis"}),operation("24h",{avisoSalidaTipo:"aviso_24h",umbralStatus:"sin-obligacion"})]}))
  assert.match(String(reports.csvRows[1][5]),/Informe 27 Bis/)
  assert.match(String(reports.csvRows[2][5]),/Aviso de 24 horas/)
  const legacy=buildAvisosProfessionalReport("notice",input({operations:[operation("legacy-24h",{sospecha24h:true,avisoSalidaTipo:undefined,umbralStatus:"sin-obligacion"}),operation("legacy-27bis",{avisoSalidaTipo:undefined,mismoGrupo:true})]}))
  assert.equal(legacy.csvRows.length,3)
  assert.match(String(legacy.csvRows[1][5]),/Aviso de 24 horas/)
  assert.match(String(legacy.csvRows[2][5]),/Informe 27 Bis/)
  const staleDate={...historical,sourceOperationRevision:3,form:{...historical.form,submissionDate:"2026-02-30"}}
  assert.equal(operationNoticeStage(presented,input({submissions:[staleDate]})),"Histórico por revisar")
})

test("consolidated CSV and PDF preserve original client type, subject registration capture and alerts",()=>{
  const built=buildAvisosProfessionalReport("consolidated",input({clients:[{...client("cliente-a"),tipoCliente:"pf_residente"}],subjectRegistrations:[{id:"sujeto-antiguo-a",registroCompleto:false}],operations:[operation("a",{alerta:"Alerta operativa QA"})]}))
  assert.equal(built.csvRows[0].length,10)
  assert.match(String(built.csvRows[1][6]),/Persona física residente/)
  assert.match(String(built.csvRows[1][7]),/sujeto-a/)
  assert.match(String(built.csvRows[1][8]),/Captura incompleta/)
  assert.equal(built.csvRows[1][9],1)
  assert.ok(built.report.sections.some((section)=>section.title==="Alta, tipo de cliente y alertas"))
})

test("full ledger retains all versions, cancellations and orphans, deduplicates persisted/current events and labels unsaved ones",()=>{
  const a=operation("a"),cancelled=operation("cancelled",{lifecycle:{status:"cancelled"}}),b=operation("b",{expedienteId:"cliente-b",clienteId:"cliente-b"})
  const old=submission("old",a.id,1,[event("one"),event("two")])
  const newer=submission("new",a.id,2,[event("one"),event("three")])
  const data=input({operations:[a,b,cancelled],submissions:[old,newer,submission("cancelled-version",cancelled.id,1,[event("four")]),submission("orphan","deleted-operation",1,[event("five")]),submission("other-client",b.id,1,[event("six")])],currentOperationId:a.id,currentSubmissionId:"new",currentTrace:[{...event("one"),timestamp:new Date(at)},{...event("seven"),timestamp:"2026-11-11T07:00:00-05:00"}]})
  const rows=collectAvisosReportTrace(data)
  assert.equal(rows.length,7)
  assert.equal(rows.filter((row)=>row.unsaved).length,1)
  assert.equal(rows.find((row)=>row.id==="four")?.cancelled,true)
  assert.equal(rows.find((row)=>row.id==="seven")?.timestamp,at)
  assert.deepEqual(collectAvisosReportTrace({...data,clientId:"cliente-a"}).map((row)=>row.id).sort(),["one","two","three","four","seven"].sort())
  assert.equal(buildAvisosProfessionalReport("trace",data).csvRows.length,8)
  assert.equal(buildAvisosProfessionalReport("notice",data).csvRows.length,3,"cancelled operation is not a current obligation")
  const single=buildAvisosProfessionalReport("trace",input({submissions:[submission("single","operacion-a",1,[event("single")])]})).report
  assert.match(single.summary[0],/^1 evento en 1 revisión de aviso/)
  assert.equal(single.sections[0].bars?.[0].valueLabel,"1 evento")
})

test("ledger rejects contradictory event IDs and calendar dates do not shift time zones",()=>{
  assert.throws(()=>collectAvisosReportTrace(input({submissions:[submission("a","operacion-a",1,[event("one"),{...event("one"),details:"Contradictorio"}])]})),/mismo ID/)
  assert.equal(avisosReportDate("2026-11-11"),"11/11/2026")
  assert.match(avisosReportDate("2026-02-30"),/no válida/)
  assert.match(avisosReportDate(new Date("invalid")),/no válida/)
  assert.equal(avisosReportDate("2026-11-11T23:30:00-06:00",true),"12/11/2026 05:30:00 UTC")
})

test("complete annex does not truncate large lists and internal records never acquire a preparation obligation",()=>{
  const operations=Array.from({length:205},(_,i)=>operation(`op-${i}`,{umbralStatus:"sin-obligacion",avisoSalidaTipo:"sin_salida"}))
  const result=buildAvisosProfessionalReport("consolidated",input({operations})).report
  const table=result.sections.find((section)=>section.title==="Detalle completo de operaciones")?.table
  assert.equal(table?.rows.length,205)
  assert.match(String(table?.rows[204][5]),/Registro interno; sin XML/)
  const empty=buildAvisosProfessionalReport("consolidated",input({operations:[],clients:[]})).report
  assert.equal(empty.metrics?.[2].value,"$0.00")
  assert.equal(empty.sections[0].bars?.[0].value,0)
})
