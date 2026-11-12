import assert from "node:assert/strict"
import test from "node:test"
import { buildEbrProfessionalReport, ebrReportFactorBars, institutionalReportApprovalState, type EbrProfessionalReportInput } from "../lib/pld/reports-ebr"
import { calculateRisk, emptyEbrAnswers, type EvaluationAnswers } from "../lib/pld/ebr-questionnaire"
import { EMPTY_INSTITUTIONAL_FACTORS, EMPTY_TRANSACTIONAL_PROFILE, EMPTY_EBR_REVIEW_PLAN, evaluateInstitutionalRisk, type EbrAssessmentHistory } from "../lib/pld/ebr-assessment"
import type { PepSearchResponse, PepScreeningResult } from "../lib/pld/types"

const at="2026-11-11T12:00:00.000Z"
const answers:EvaluationAnswers={nationalityRisk:"other",nationalityCountryCode:"MX",geographyReviewed:true,pep:"none",bankInstitution:"national_only",suspiciousBehaviors:[],behaviorReviewed:true,incomeSources:["asalariado"],cashExposure:"bajo",ngoNonRegulated:"no",institutionAge:"public_or_mature"}
const result=calculateRisk(answers,true,"Cliente")
function input(patch:Partial<EbrProfessionalReportInput>={}):EbrProfessionalReportInput {
  return {client:{id:"eui-qa",expedienteId:"eui-qa",nombre:"Cliente QA",rfc:"",identifier:"NIF-PRUEBA",identifiers:{rfc:"",nif:"NIF-PRUEBA",curp:""}},
    displayLevel:"Medio",displayedStatus:"borrador",isCurrentApproved:false,approvalPercent:result.percent,
    clientResult:result,subjectResult:calculateRisk(answers,true,"Sujeto obligado"),beneficiaryResult:null,
    institutionalRisk:evaluateInstitutionalRisk(EMPTY_INSTITUTIONAL_FACTORS,[]),institutionalFactors:EMPTY_INSTITUTIONAL_FACTORS,controls:[],sources:[],institutionalSources:[],
    reviewPlan:EMPTY_EBR_REVIEW_PLAN,institutionalReviewPlan:EMPTY_EBR_REVIEW_PLAN,transactionalProfile:EMPTY_TRANSACTIONAL_PROFILE,
    operations:[],notes:"Nota QA",pepScreening:null,pepWhois:null,history:[],revision:1,institutionalMethodologyAccepted:false,
    distribution:[{level:"Bajo",count:0},{level:"Medio",count:0},{level:"Alto",count:0},{level:"Reforzado",count:0}],unapprovedClients:1,...patch}
}

test("incomplete EBR stays unevaluated: null bars, no favorable defaults or historical approval of current changes",()=>{
  const incomplete=calculateRisk(emptyEbrAnswers,true,"Cliente")
  const report=buildEbrProfessionalReport(input({displayLevel:"Pendiente",approvalPercent:0,displayedStatus:"cambios sin aprobar",clientResult:incomplete,subjectResult:incomplete,historicalApproved:{level:"Bajo",percent:25},distribution:[{level:"Bajo",count:null}],unapprovedClients:null}))
  assert.equal(report.metrics?.[0].value,"Sin evaluar")
  assert.match(report.summary[0],/preliminar, no aprobado/)
  assert.match(report.summary[1],/histórica conservada/)
  assert.ok(report.sections[0].bars?.every((bar)=>bar.value===null))
  const questionnaire=report.sections.find((section)=>section.title==="Cuestionario completo: cliente")!
  assert.ok(questionnaire.bars?.every((bar)=>bar.value===null))
  assert.ok(questionnaire.table?.rows.every((row)=>row[2]==="Sin consolidar"))
  assert.ok(questionnaire.table?.rows.some((row)=>row[1]==="Sin revisión de comportamiento documentada"))
  assert.ok(report.sections.find((section)=>section.title==="Clientes de la empresa activa")?.bars?.every((bar)=>bar.value===null))
})

test("factor charts use exactly the screen's score/max rounding and institutional scores remain on their original scale",()=>{
  assert.equal(result.complete,true)
  const bars=ebrReportFactorBars(result)
  assert.deepEqual(bars.map((bar)=>bar.value),result.details.map((detail)=>Math.round(detail.score/detail.maximum*100)))
  assert.ok(bars.every((bar)=>bar.max===100))
  const base=input()
  const report=buildEbrProfessionalReport({...base,institutionalRisk:{...base.institutionalRisk,inherentScore:2.1,residualScore:1.7,inherentPercent:70,residualPercent:57,inherentLevel:"Medio-Alto",residualLevel:"Medio",complete:true}})
  const institutional=report.sections.find((section)=>section.title==="Riesgo institucional: inherente y residual")!
  assert.deepEqual(institutional.bars?.map((bar)=>bar.value),[70,57])
  assert.match(institutional.paragraphs?.join(" ")||"",/2.1\/3/)
  assert.deepEqual(institutional.table?.rows.map((row)=>row[2]),["30%","30%","20%","20%"])
  assert.equal(report.sections.find((section)=>section.title==="Clientes de la empresa activa")?.bars?.at(-1)?.valueLabel,"1 cliente")
})

test("institutional approval is bound to its exact snapshot; changing factors, controls, sources, plan or adoption cannot approve live scores",()=>{
  const evidence={fileVersionId:"version-qa",documentId:"document-qa",sha256:"ab".repeat(32),downloadUrl:"/api/v1/companies/qa/files/version-qa",fileName:"evidencia-qa.pdf"}
  const factors=EMPTY_INSTITUTIONAL_FACTORS.map((factor)=>({...factor,score:2 as const,rationale:"Justificación QA",evidenceId:evidence.fileVersionId,evidence}))
  const controls=[{id:"control-qa",label:"Control QA",effectiveness:"effective" as const,evidenceId:evidence.fileVersionId,evidence,reviewedBy:"Revisor QA",reviewedAt:at}]
  const sources=[{id:"source-qa",label:"Fuente QA",consultedAt:at}]
  const plan={nextReviewAt:"2027-01-01",actions:[]}
  const risk=evaluateInstitutionalRisk(factors,controls)
  assert.equal(risk.complete,true)
  const original=input({institutionalFactors:factors,controls,institutionalSources:sources,institutionalReviewPlan:plan,institutionalMethodologyAccepted:true,institutionalRisk:risk,
    institutionalSnapshot:{revision:4,workflow:{status:"approved",methodologyVersion:"pld-questionnaire-v3",approvedAt:at,approvedBy:"Revisor QA"},institutionalFactors:structuredClone(factors),controls:structuredClone(controls),sources:structuredClone(sources),reviewPlan:structuredClone(plan),methodologyAccepted:true,institutionalRisk:risk}})
  const snapshotBytes=JSON.stringify(original.institutionalSnapshot)
  assert.equal(institutionalReportApprovalState(original).isCurrentApproved,true)
  const mutations:Partial<EbrProfessionalReportInput>[]=[
    {institutionalFactors:factors.map((factor,i)=>i===0?{...factor,rationale:"Nueva justificación; mismo puntaje"}:factor)},
    {controls:controls.map((control)=>({...control,label:"Control modificado"}))},
    {institutionalSources:[...sources,{id:"new-source",label:"Fuente nueva",consultedAt:at}]},
    {institutionalReviewPlan:{...plan,nextReviewAt:"2027-02-01"}},
    {institutionalMethodologyAccepted:false},
  ]
  for(const patch of mutations){
    const live={...original,...patch}
    const view=institutionalReportApprovalState(live)
    assert.equal(view.isCurrentApproved,false)
    assert.equal(view.label,"Cambios sin aprobar")
    const report=buildEbrProfessionalReport(live)
    const paragraphs=report.sections.find((section)=>section.title==="Riesgo institucional: inherente y residual")!.paragraphs!.join(" ")
    assert.match(paragraphs,/Estado actual: Cambios sin aprobar/)
    assert.match(paragraphs,/Aprobación histórica conservada, revisión 4/)
    assert.ok(!paragraphs.includes("Estado actual: Aprobada"))
  }
  assert.equal(JSON.stringify(original.institutionalSnapshot),snapshotBytes)
  const oldMethod={...original,institutionalSnapshot:{...original.institutionalSnapshot,workflow:{...original.institutionalSnapshot!.workflow!,methodologyVersion:"metodologia-anterior"}}}
  assert.equal(institutionalReportApprovalState(oldMethod).isCurrentApproved,false)
  assert.equal(institutionalReportApprovalState(oldMethod).sameMethod,false)
  assert.match(institutionalReportApprovalState(oldMethod).label,/Metodología distinta/)
  assert.match(buildEbrProfessionalReport(oldMethod).sections.find((section)=>section.title==="Riesgo institucional: inherente y residual")?.paragraphs?.join(" ")||"",/Aprobación histórica conservada/)
})

test("EBR export keeps all PEP matches, questionnaires, sources, history and action plans without slicing",()=>{
  const screening:PepScreeningResult={status:"posible-pep",requiresHumanReview:true,source:"Fuente QA",checkedAt:at,note:"Revisión QA",matches:Array.from({length:37},(_,i)=>({cargo:`Cargo ${i}`,dependencia:`Dependencia ${i}`,tipoAdministracionPublica:"Federal",entidadAdministracionPublica:"QA"}))}
  const whois:PepSearchResponse={status:"requiere_revision",checkedAt:at,query:{nombre:"Cliente QA"},recommendation:"Revisión humana",appliedDecisions:[],sourceSnapshots:[{sourceId:"qa",sourceLabel:"QA",count:100,syncedAt:at}],results:Array.from({length:43},(_,i)=>({status:"posible_coincidencia",score:60,entity:{id:`entidad-${i}`,name:`Persona QA ${i}`,source:"internal",sourceLabel:"QA",sourceUrl:"https://example.test/qa"},source:"internal",matchedFields:["nombre"],requiresHumanReview:true,note:`Nota ${i}`}))}
  const history:EbrAssessmentHistory[]=Array.from({length:28},(_,i)=>({id:`history-${i}`,revision:i+1,status:i%2?"approved":"draft",updatedAt:at,actor:"QA",methodologyVersion:`metodo-${i}`,result:{level:"Medio",percent:44},clientAnswers:answers,subjectAnswers:answers,controls:[],transactionalProfile:EMPTY_TRANSACTIONAL_PROFILE,sources:[]}))
  const actions=Array.from({length:51},(_,i)=>({id:`action-${i}`,title:`Plan ${i}`,ownerId:"Responsable QA",dueAt:"2027-01-01",status:"open" as const}))
  const report=buildEbrProfessionalReport(input({pepScreening:screening,pepWhois:whois,history,reviewPlan:{nextReviewAt:"2027-01-01",actions},sources:Array.from({length:27},(_,i)=>({id:`source-${i}`,label:`Fuente ${i}`,consultedAt:at,sourceUrl:`https://example.test/${i}`}))}))
  assert.equal(report.sections.find((section)=>section.title.startsWith("PEP: revisión"))?.table?.rows.length,37)
  assert.equal(report.sections.find((section)=>section.title.startsWith("WhoIs PEP:"))?.table?.rows.length,43)
  assert.equal(report.sections.find((section)=>section.title==="Evolución e historial de revisiones")?.table?.rows.length,28)
  assert.equal(report.sections.find((section)=>section.title==="Plan de revisión del cliente")?.table?.rows.length,51)
  assert.equal(report.sections.find((section)=>section.title==="Cuestionario completo: cliente")?.table?.rows.length,result.details.length)
  assert.ok(report.sources?.some((source)=>source.includes("Fuente 26")))
})

test("pending foreign currency operations remain visible and count for frequency, never as zero MXN or no operations",()=>{
  const profile={...EMPTY_TRANSACTIONAL_PROFILE,expectedMonthlyAmountCents:1_000_000,expectedMonthlyCount:1,originOfFunds:"QA",destinationOfFunds:"QA",channels:"QA",instrument:"Transferencia"}
  const pending={id:"usd-pending",montoCentavos:100_000,fechaOperacion:"2026-11-11",moneda:"USD",financeReviewRequired:true,captureDraft:{amountText:"1000.00",currency:"USD"}}
  const unknown=buildEbrProfessionalReport(input({transactionalProfile:profile,operations:[pending]}))
  const section=unknown.sections.find((section)=>section.title==="Perfil transaccional y comportamiento observado")!
  assert.deepEqual(section.table?.rows[0].slice(0,3),["2026-11","Sin monto MXN validado",1])
  assert.match(String(section.table?.rows[0][3]),/comparación monetaria incompleta/)
  assert.match(section.paragraphs?.at(-1)||"",/^1 operación tiene/)
  assert.match(String(section.table?.rows[0][3]),/^1 importe por revisar/)
  assert.equal(unknown.sections.find((section)=>section.title==="Movimientos considerados en el perfil")?.table?.rows.length,1)
  const mixed=buildEbrProfessionalReport(input({transactionalProfile:profile,operations:[pending,{id:"mxn",montoCentavos:1_000_000_001,fechaOperacion:"2026-11-12",moneda:"MXN"}]}))
  const mixedSection=mixed.sections.find((item)=>item.title==="Perfil transaccional y comportamiento observado")!
  assert.equal(mixedSection.table?.rows[0][1],"$10,000,000.01 (parcial)")
  assert.equal(mixedSection.table?.rows[0][2],2)
  assert.match(String(mixedSection.table?.rows[0][3]),/Supera frecuencia/)
  assert.match(String(mixedSection.table?.rows[0][3]),/Importe conocido supera/)
  const undetermined=buildEbrProfessionalReport(input({transactionalProfile:profile,operations:[{id:"unknown-legal-amount",montoCentavos:0,moneda:"MXN",fechaOperacion:"2026-11-11",montoNoDeterminado:true}]}))
  assert.equal(undetermined.sections.find((item)=>item.title==="Perfil transaccional y comportamiento observado")?.table?.rows[0][1],"Sin monto MXN validado")
  assert.equal(undetermined.sections.find((item)=>item.title==="Movimientos considerados en el perfil")?.table?.rows[0][1],"Monto no determinado")
})
