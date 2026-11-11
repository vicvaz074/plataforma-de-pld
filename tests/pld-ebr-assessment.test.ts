import test from "node:test"
import assert from "node:assert/strict"
import { calculateRisk, emptyEbrAnswers, initialAnswers, summarizeStoredEbrQuestionnaire } from "../lib/pld/ebr-questionnaire"
import { EBR_METHODOLOGY, EMPTY_TRANSACTIONAL_PROFILE, EMPTY_INSTITUTIONAL_FACTORS, ebrControlCoverage, evaluateInstitutionalRisk, evaluateTransactionalProfile, reviseEbrControl, transitionEbrAssessment,transitionInstitutionalAssessment } from "../lib/pld/ebr-assessment"

const complete = {...initialAnswers,incomeSources:["empresario" as const],behaviorReviewed:true,geographyReviewed:true}
const profile = {...EMPTY_TRANSACTIONAL_PROFILE,expectedMonthlyAmountCents:1_000_000_000,expectedMonthlyCount:2,originOfFunds:"Ahorros",destinationOfFunds:"Inversión",channels:"Presencial",instrument:"Transferencia"}
const assessment = {status:"approved" as const,canApprove:true,actor:"user-one",at:"2026-11-11T12:00:00Z",clientAnswers:complete,subjectAnswers:complete,
  transactionalProfile:profile,controls:[],methodologyAccepted:true,sources:[{id:"source-one",label:"Manual y expediente revisados",consultedAt:"2026-11-11"}]}
const proof={fileVersionId:"file-version-one",documentId:"document-one",sha256:"a".repeat(64),downloadUrl:"/api/v1/companies/company-one/files/file-version-one",fileName:"manual.pdf"}
test("unanswered new EBR is pending, not low risk",()=>{
  const result=calculateRisk(emptyEbrAnswers,true,"Cliente")
  assert.equal(result.level,"Pendiente");assert.equal(result.complete,false);assert.ok(result.missing.length>5);assert.equal(result.percent,0)
  assert.equal(summarizeStoredEbrQuestionnaire({schemaVersion:3,workflow:{status:"draft"},clientAnswers:complete,subjectAnswers:complete}),undefined)
  assert.equal(calculateRisk({...complete,geographyReviewed:undefined,behaviorReviewed:undefined},true,"Cliente").level,"Pendiente")
  assert.equal(calculateRisk({...complete,suspiciousBehaviors:["valor-fuera-de-catalogo"]},true,"Cliente").level,"Pendiente")
})
test("chart and PDF factor denominators use the actual methodology maxima",()=>{
  const result=calculateRisk(complete,true,"Cliente")
  assert.equal(result.max,25);assert.equal(result.details.reduce((sum,item)=>sum+item.maximum,0),25)
  assert.equal(result.details.find((item)=>item.question.startsWith("Institución bancaria"))?.maximum,3)
  assert.equal(result.details.find((item)=>item.question.startsWith("Fuentes de ingreso"))?.maximum,3)
  assert.equal(calculateRisk(complete,false,"Beneficiario").max,19)
})
test("approval validates completeness, scope and documented adoption",()=>{
  assert.throws(()=>transitionEbrAssessment({...assessment,canApprove:false}),/no permite aprobar/)
  assert.throws(()=>transitionEbrAssessment({...assessment,clientAnswers:emptyEbrAnswers}),/Completa/)
  assert.throws(()=>transitionEbrAssessment({...assessment,methodologyAccepted:false}),/metodología/)
  assert.throws(()=>transitionEbrAssessment({...assessment,sources:[]}),/fuente/)
  const result=transitionEbrAssessment(assessment)
  assert.equal(result.workflow.approvedBy,"user-one");assert.equal(result.workflow.methodologyVersion,EBR_METHODOLOGY.id)
  assert.equal(result.riskSummary?.level,"Bajo")
})
test("a new draft keeps the approved snapshot unchanged and removes current approval",()=>{
  const old=transitionEbrAssessment(assessment)
  const next=transitionEbrAssessment({...assessment,status:"draft",clientAnswers:emptyEbrAnswers,previous:old})
  assert.equal(next.revision,2);assert.equal(next.riskSummary,undefined);assert.equal(next.workflow.approvedAt,undefined)
  assert.deepEqual(next.history[0],old.history[0]);assert.equal(next.history[1].status,"draft")
  assert.equal(next.history[0].result.level,"Bajo");assert.equal(next.history[1].result.level,"Pendiente")
})
test("transactional alerts compare exact cents independently from obligation thresholds",()=>{
  const result=evaluateTransactionalProfile(profile,[{montoCentavos:1_000_000_000,fechaOperacion:"2026-11-01"},{montoCentavos:1,fechaOperacion:"2026-11-02"}])
  assert.equal(result.rows[0].amountCents,1_000_000_001);assert.equal(result.alerts.length,1);assert.equal(result.rows[0].countAlert,false)
  assert.equal(evaluateTransactionalProfile(EMPTY_TRANSACTIONAL_PROFILE,[]).complete,false)
})
test("controls without evidence never count as effective mitigation",()=>{
  const controls=[{id:"c1",label:"KYC",effectiveness:"effective" as const,evidenceId:"",reviewedBy:"u1",reviewedAt:"2026-11-11"}]
  assert.equal(ebrControlCoverage(controls).effective,0)
  assert.equal(ebrControlCoverage([{...controls[0],evidenceId:"document-v2"}]).effective,0)
  assert.equal(ebrControlCoverage([{...controls[0],evidenceId:proof.fileVersionId,evidence:proof}]).effective,1)
})
test("changing control evidence revokes its effectiveness review, without mutating history",()=>{
  const old={id:"c1",label:"KYC",effectiveness:"effective" as const,evidenceId:"document-v1",reviewedBy:"u1",reviewedAt:"2026-11-11"}
  const next=reviseEbrControl(old,{evidenceId:"document-v2"})
  assert.equal(next.effectiveness,"unknown");assert.equal(next.reviewedBy,"");assert.equal(next.reviewedAt,"")
  assert.equal(old.effectiveness,"effective");assert.equal(old.evidenceId,"document-v1")
  assert.equal(reviseEbrControl(old,{evidenceId:"document-v1"}),old)
  const linked={...old,evidenceId:proof.fileVersionId,evidence:proof}
  assert.equal(reviseEbrControl(linked,{evidenceId:proof.fileVersionId,evidence:{...proof}}),linked)
})
test("institutional risk uses reviewed factors and controls and preserves a mandatory high floor",()=>{
  assert.equal(evaluateInstitutionalRisk(EMPTY_INSTITUTIONAL_FACTORS,[]).inherentScore,null)
  const factors=EMPTY_INSTITUTIONAL_FACTORS.map((factor)=>({...factor,score:3 as const,rationale:"Riesgo documentado",evidenceId:proof.fileVersionId,evidence:proof}))
  const pending=evaluateInstitutionalRisk(factors,[])
  assert.equal(pending.inherentScore,3);assert.equal(pending.residualScore,null)
  const controls=[{id:"kyc",label:"KYC",effectiveness:"effective" as const,evidenceId:proof.fileVersionId,evidence:proof,reviewedBy:"reviewer",reviewedAt:"2026-11-11"}]
  assert.equal(evaluateInstitutionalRisk(factors,controls).residualScore,2)
  assert.equal(evaluateInstitutionalRisk(factors,controls,true).residualScore,2.35)
  assert.equal(evaluateInstitutionalRisk(factors.map((factor)=>({...factor,evidence:undefined})),controls).complete,false)
  assert.equal(ebrControlCoverage(controls.map((control)=>({...control,evidence:{...proof,sha256:"not-a-hash"}}))).effective,0)
  assert.equal(ebrControlCoverage(controls.map((control)=>({...control,evidenceId:"another-version"}))).effective,0)
})
test("review plans retain owners, deadlines and closure evidence without inventing a legal period",()=>{
  const reviewPlan={nextReviewAt:"2027-02-10",actions:[{id:"follow-up",title:"Verificar recursos",ownerId:"Oficial de cumplimiento",dueAt:"2026-11-25",status:"open" as const}]}
  const approved=transitionEbrAssessment({...assessment,reviewPlan})
  assert.equal(approved.history[0].reviewPlan?.actions[0].ownerId,"Oficial de cumplimiento")
  assert.throws(()=>transitionEbrAssessment({...assessment,reviewPlan:{...reviewPlan,nextReviewAt:"2026-02-30"}}),/Próxima revisión/)
  assert.throws(()=>transitionEbrAssessment({...assessment,reviewPlan:{...reviewPlan,actions:[{...reviewPlan.actions[0],ownerId:""}]}}),/responsable/)
  assert.throws(()=>transitionEbrAssessment({...assessment,reviewPlan:{...reviewPlan,actions:[{...reviewPlan.actions[0],status:"completed"}]}}),/evidencia de cierre/)
  assert.throws(()=>transitionEbrAssessment({...assessment,reviewPlan:{...reviewPlan,actions:[{...reviewPlan.actions[0],status:"completed",evidenceId:"referencia-inventada"}]}}),/recuperable/)
  const closed=transitionEbrAssessment({...assessment,reviewPlan:{...reviewPlan,actions:[{...reviewPlan.actions[0],status:"completed",evidenceId:proof.fileVersionId,evidence:proof}]}})
  assert.equal(closed.history[0].reviewPlan?.actions[0].evidence?.sha256,proof.sha256)
  const draft=transitionEbrAssessment({...assessment,status:"draft",reviewPlan:{nextReviewAt:"",actions:[]}})
  assert.ok(draft.missing.some((item)=>item.includes("Próxima revisión")))
})
test("institutional assessment can be approved and versioned without a client dossier",()=>{
  const institutionalFactors=EMPTY_INSTITUTIONAL_FACTORS.map((factor)=>({...factor,score:2 as const,rationale:"Juicio aprobado",evidenceId:proof.fileVersionId,evidence:proof}))
  const controls=[{id:"control-one",label:"KYC",effectiveness:"partial" as const,evidenceId:proof.fileVersionId,evidence:proof,reviewedBy:"user-one",reviewedAt:assessment.at}]
  const input={...assessment,institutionalFactors,controls,reviewPlan:{nextReviewAt:"2027-02-10",actions:[]}}
  const result=transitionInstitutionalAssessment(input)
  assert.equal(result.workflow.status,"approved");assert.equal(result.institutionalRisk.inherentScore,2);assert.equal(result.institutionalRisk.residualScore,1.5)
  assert.throws(()=>transitionInstitutionalAssessment({...input,canApprove:false}),/no permite aprobar/)
  const draft=transitionInstitutionalAssessment({...input,status:"draft",previous:result,controls:[]})
  assert.equal(draft.history.length,2);assert.equal(draft.workflow.approvedAt,undefined);assert.equal(draft.institutionalRisk.residualScore,null)
  assert.equal((result.history[0] as {institutionalRisk:{residualScore:number}}).institutionalRisk.residualScore,1.5)
})
test("evidence versions in assessment history remain independent of later metadata edits",()=>{
  const evidence={...proof}
  const factors=EMPTY_INSTITUTIONAL_FACTORS.map((factor)=>({...factor,score:2 as const,rationale:"Revisión",evidenceId:evidence.fileVersionId,evidence}))
  const controls=[{id:"c1",label:"KYC",effectiveness:"effective" as const,evidenceId:evidence.fileVersionId,evidence,reviewedBy:"u1",reviewedAt:assessment.at}]
  const result=transitionInstitutionalAssessment({...assessment,institutionalFactors:factors,controls,reviewPlan:{nextReviewAt:"2027-01-01",actions:[]}})
  evidence.fileName="Archivo sustituido.pdf"
  const historical=result.history[0] as {controls:typeof controls;institutionalFactors:typeof factors}
  assert.equal(historical.controls[0].evidence.fileName,"manual.pdf");assert.equal(historical.institutionalFactors[0].evidence.fileName,"manual.pdf")
})
