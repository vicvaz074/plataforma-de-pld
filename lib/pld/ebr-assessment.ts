import { calculateRisk, normalizeEbrAnswers, type EvaluationAnswers, type ScoredResult } from "./ebr-questionnaire"
import { EBR_FACTOR_WEIGHTS } from "./ebr-methodology"

/** RCG 10 Septies–10 Septies 4, 23 Bis–23 Ter; source consulted 2026-11-11.
 * Internal legacy scoring is versioned, not a statutory weighting prescribed by SAT.
 * Future obligations must be evaluated with their effective date in the rule pack. */
export const EBR_METHODOLOGY = {
  id: "pld-questionnaire-v3", version: 3, reviewedAt: "2026-11-11",
  source: "https://dof.gob.mx/nota_detalle_popup.php?codigo=5795797",
  label: "Cuestionario PLD y perfil transaccional",
  note: "Puntuación interna de apoyo; requiere aprobación y evidencia de la metodología adoptada por la empresa.",
} as const

export type EbrWorkflowStatus = "draft" | "review" | "approved"
export interface EbrSourceSnapshot { id: string; label: string; consultedAt: string; sourceUrl?: string; result?: string }
export interface EbrEvidenceReference {fileVersionId:string;documentId?:string;sha256:string;downloadUrl:string;fileName:string}
export function hasRecoverableEbrEvidence(value:EbrEvidenceReference|undefined):value is EbrEvidenceReference {
  return Boolean(value&&value.fileVersionId?.trim()&&value.fileName?.trim()&&/^[a-f0-9]{64}$/i.test(value.sha256)&&/^\/api\/v1\/companies\/[^/]+\/files\/[^/]+$/.test(value.downloadUrl)&&value.downloadUrl.endsWith(`/files/${encodeURIComponent(value.fileVersionId)}`))
}
export interface EbrControlReview {
  id: string; label: string; effectiveness: "unknown" | "absent" | "partial" | "effective";
  evidenceId: string; reviewedBy: string; reviewedAt: string;
  evidence?:EbrEvidenceReference;
}
export function reviseEbrControl(control:EbrControlReview, patch:Partial<Pick<EbrControlReview,"label"|"evidenceId"|"evidence">>):EbrControlReview {
  if(Object.entries(patch).every(([key,value])=>key==="evidence"?JSON.stringify(control.evidence||null)===JSON.stringify(value||null):control[key as "label"|"evidenceId"]===value))return control
  return {...control,...patch,effectiveness:"unknown",reviewedBy:"",reviewedAt:""}
}
export type InstitutionalFactorKey = keyof typeof EBR_FACTOR_WEIGHTS
export interface InstitutionalFactor { key: InstitutionalFactorKey; score: 1 | 2 | 3 | null; rationale: string; evidenceId: string;evidence?:EbrEvidenceReference }
export const INSTITUTIONAL_LABELS: Record<InstitutionalFactorKey,string> = {clientesUsuarios:"Clientes y usuarios",productosServicios:"Productos y servicios",canalesTransacciones:"Canales y transacciones",geografia:"Geografía"}
export const EMPTY_INSTITUTIONAL_FACTORS: InstitutionalFactor[] = (Object.keys(EBR_FACTOR_WEIGHTS) as InstitutionalFactorKey[]).map((key)=>({key,score:null,rationale:"",evidenceId:""}))
const reviewedControl=(control:EbrControlReview)=>Boolean(control.id.trim()&&control.label.trim()&&["absent","partial","effective"].includes(control.effectiveness)&&hasRecoverableEbrEvidence(control.evidence)&&control.evidenceId===control.evidence.fileVersionId&&control.reviewedBy.trim()&&Number.isFinite(Date.parse(control.reviewedAt)))
export function evaluateInstitutionalRisk(factors: InstitutionalFactor[], controls: EbrControlReview[], mandatoryHigh = false) {
  const missing=(Object.keys(EBR_FACTOR_WEIGHTS) as InstitutionalFactorKey[]).filter((key)=>!factors.some((factor)=>factor.key===key&&[1,2,3].includes(factor.score||0)&&factor.rationale.trim()&&hasRecoverableEbrEvidence(factor.evidence)&&factor.evidenceId===factor.evidence.fileVersionId)).map((key)=>INSTITUTIONAL_LABELS[key])
  if(factors.length!==4||new Set(factors.map((factor)=>factor.key)).size!==4||factors.some((factor)=>!(factor.key in EBR_FACTOR_WEIGHTS)))missing.push("Estructura de los cuatro factores")
  const controlsComplete=controls.length>0&&new Set(controls.map((control)=>control.id)).size===controls.length&&controls.every(reviewedControl)
  const inherent=missing.length?null:factors.reduce((sum,factor)=>sum+(factor.score||0)*EBR_FACTOR_WEIGHTS[factor.key],0)
  const reduction=controlsComplete?controls.reduce((sum,control)=>sum+(control.effectiveness==="effective"?1:control.effectiveness==="partial"?0.5:0),0)/controls.length:null
  const residual=inherent!==null&&reduction!==null?Math.round(Math.max(mandatoryHigh?2.35:1,inherent-reduction)*100)/100:null
  const level=(score:number|null)=>score===null?"Pendiente":score>=2.35?"Alto":score>=2.1?"Medio-Alto":score>=1.6?"Medio":"Bajo"
  return {complete:!missing.length&&controlsComplete,missing,controlsComplete,inherentScore:inherent===null?null:Math.round(inherent*100)/100,residualScore:residual,
    inherentLevel:level(inherent),residualLevel:level(residual),inherentPercent:inherent===null?null:Math.round(inherent/3*100),residualPercent:residual===null?null:Math.round(residual/3*100),weights:EBR_FACTOR_WEIGHTS}
}
export interface TransactionalProfile {
  expectedMonthlyAmountCents: number | null; expectedMonthlyCount: number | null;
  originOfFunds: string; destinationOfFunds: string; channels: string; instrument: string;
}
export const EMPTY_TRANSACTIONAL_PROFILE: TransactionalProfile = {
  expectedMonthlyAmountCents: null, expectedMonthlyCount: null, originOfFunds: "", destinationOfFunds: "", channels: "", instrument: "",
}
export interface EbrReviewPlan {
  nextReviewAt:string;
  actions:Array<{id:string;title:string;ownerId:string;dueAt:string;status:"open"|"completed";evidenceId?:string;evidence?:EbrEvidenceReference}>;
}
export const EMPTY_EBR_REVIEW_PLAN:EbrReviewPlan={nextReviewAt:"",actions:[]}
const validDay=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
export function getEbrReviewPlanMissing(plan:EbrReviewPlan,at:string):string[]{
  const missing:string[]=[]
  if(!validDay(plan.nextReviewAt)||plan.nextReviewAt<=at.slice(0,10))missing.push("Próxima revisión posterior a la fecha de evaluación (plazo definido por la empresa)")
  if(!Array.isArray(plan.actions)||new Set(plan.actions.map((action)=>action.id)).size!==plan.actions.length)return [...missing,"IDs únicos del plan de acciones"]
  plan.actions.forEach((action,index)=>{
    if(!action.id||!action.title.trim()||!action.ownerId.trim()||!validDay(action.dueAt)||!["open","completed"].includes(action.status))missing.push(`Acción ${index+1}: descripción, responsable y fecha válida`)
    if(action.status==="completed"&&(!hasRecoverableEbrEvidence(action.evidence)||action.evidenceId!==action.evidence.fileVersionId))missing.push(`Acción ${index+1}: evidencia de cierre recuperable`)
  })
  return missing
}
const cloneControls=(controls:EbrControlReview[])=>controls.map((control)=>({...control,evidence:control.evidence?{...control.evidence}:undefined}))
const cloneFactors=(factors:InstitutionalFactor[])=>factors.map((factor)=>({...factor,evidence:factor.evidence?{...factor.evidence}:undefined}))
const cloneReviewPlan=(plan:EbrReviewPlan)=>({...plan,actions:plan.actions.map((action)=>({...action,evidence:action.evidence?{...action.evidence}:undefined}))})
export interface EbrAssessmentHistory {
  id: string; revision: number; status: EbrWorkflowStatus; updatedAt: string; actor: string;
  methodologyVersion: string; result: { level: string; percent: number };
  clientAnswers: EvaluationAnswers; subjectAnswers: EvaluationAnswers; beneficiaryAnswers?: EvaluationAnswers;
  controls: EbrControlReview[]; transactionalProfile: TransactionalProfile; sources: EbrSourceSnapshot[];
  institutionalFactors?: InstitutionalFactor[];
  reviewPlan?:EbrReviewPlan;
}

export function consolidateEbrResults(results: Array<ScoredResult | null>, pepStatus?: string): ScoredResult["level"] {
  if (results.some((result) => result && !result.complete)) return "Pendiente"
  const levels = results.filter(Boolean).map((result) => result!.level)
  if (!levels.length) return "Pendiente"
  if (["coincidencia_alta", "coincidencia-cargo", "requiere_revision"].includes(pepStatus || "") || levels.includes("Reforzado")) return "Reforzado"
  if (["posible_coincidencia", "posible-pep"].includes(pepStatus || "") || levels.includes("Alto")) return "Alto"
  return levels.includes("Medio") ? "Medio" : "Bajo"
}

export function evaluateTransactionalProfile(profile: TransactionalProfile, operations: Array<{ montoCentavos: number; fechaOperacion: string }>) {
  const amountValid=Number.isSafeInteger(profile.expectedMonthlyAmountCents)&&Number(profile.expectedMonthlyAmountCents)>=0
  const countValid=Number.isSafeInteger(profile.expectedMonthlyCount)&&Number(profile.expectedMonthlyCount)>=0
  const months = new Map<string, { amountCents: number; count: number }>()
  for (const operation of operations) {
    if (!Number.isSafeInteger(operation.montoCentavos) || operation.montoCentavos < 0) continue
    const month = operation.fechaOperacion.slice(0, 7)
    const entry = months.get(month) || { amountCents: 0, count: 0 }
    entry.amountCents += operation.montoCentavos
    if(!Number.isSafeInteger(entry.amountCents))throw new Error("El acumulado transaccional excede la precisión admitida.")
    entry.count += 1; months.set(month, entry)
  }
  const missing = [!amountValid && "Monto mensual esperado", !countValid && "Número mensual esperado",
    !profile.originOfFunds.trim() && "Origen de recursos", !profile.destinationOfFunds.trim() && "Destino de recursos", !profile.channels.trim() && "Canales", !profile.instrument.trim() && "Instrumentos"]
    .filter((item): item is string => Boolean(item))
  const rows = [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, values]) => ({ month, ...values,
    amountAlert: amountValid && values.amountCents > Number(profile.expectedMonthlyAmountCents),
    countAlert: countValid && values.count > Number(profile.expectedMonthlyCount),
  }))
  return { complete: !missing.length, missing, rows, alerts: rows.filter((row) => row.amountAlert || row.countAlert) }
}

export function ebrControlCoverage(controls: EbrControlReview[]) {
  const supported = controls.filter(reviewedControl)
  const effective = supported.filter((control) => control.effectiveness === "effective").length
  return { supported: supported.length, effective, percent: controls.length ? Math.round(effective / controls.length * 100) : 0 }
}

export function transitionInstitutionalAssessment(input:{status:EbrWorkflowStatus;canApprove:boolean;actor:string;at:string;
  institutionalFactors:InstitutionalFactor[];controls:EbrControlReview[];sources:EbrSourceSnapshot[];methodologyAccepted:boolean;reviewPlan:EbrReviewPlan;
  previous?:{revision?:number;history?:unknown[]}}){
  if(!input.actor.trim())throw new Error("Se necesita una sesión autenticada.")
  const institutionalRisk=evaluateInstitutionalRisk(input.institutionalFactors,input.controls)
  const missing=[...institutionalRisk.missing,...(!institutionalRisk.controlsComplete?["Controles y evidencia revisados"]:[]),...getEbrReviewPlanMissing(input.reviewPlan,input.at)]
  if(!input.methodologyAccepted)missing.push("Adopción documentada de metodología")
  if(input.status!=="draft"&&missing.length)throw new Error(`Completa la evaluación institucional: ${missing.join("; ")}`)
  if(input.status==="approved"&&!input.canApprove)throw new Error("Tu perfil no permite aprobar evaluaciones.")
  if(input.status==="approved"&&(!input.sources.length||input.sources.some((source)=>!source.id?.trim()||!source.label?.trim()||!Number.isFinite(Date.parse(source.consultedAt)))))throw new Error("Documenta una fuente o evidencia consultada con fecha válida.")
  const revision=(input.previous?.revision||0)+1
  const snapshot={revision,updatedAt:input.at,actor:input.actor,workflow:{status:input.status,methodologyVersion:EBR_METHODOLOGY.id,approvedAt:input.status==="approved"?input.at:undefined,approvedBy:input.status==="approved"?input.actor:undefined},
    institutionalFactors:cloneFactors(input.institutionalFactors),controls:cloneControls(input.controls),sources:input.sources.map((source)=>({...source})),methodologyAccepted:input.methodologyAccepted,
    reviewPlan:cloneReviewPlan(input.reviewPlan),institutionalRisk}
  return {...snapshot,history:[...(input.previous?.history||[]),snapshot]}
}

export function transitionEbrAssessment(input: {
  status: EbrWorkflowStatus; canApprove: boolean; actor: string; at: string;
  clientAnswers: EvaluationAnswers; subjectAnswers: EvaluationAnswers; beneficiaryAnswers?: EvaluationAnswers;
  transactionalProfile: TransactionalProfile; controls: EbrControlReview[];
  methodologyAccepted: boolean; sources: EbrSourceSnapshot[]; previous?: { revision?: number; history?: EbrAssessmentHistory[] };
  institutionalFactors?: InstitutionalFactor[];
  reviewPlan?:EbrReviewPlan;
  pepStatus?: string;
}) {
  if (!input.actor.trim()) throw new Error("Se necesita una sesión autenticada para registrar la evaluación.")
  const client = calculateRisk(input.clientAnswers, true, "Cliente")
  const subject = calculateRisk(input.subjectAnswers, true, "Sujeto obligado")
  const beneficiary = input.beneficiaryAnswers ? calculateRisk(input.beneficiaryAnswers, false, "Beneficiario controlador") : null
  const level = consolidateEbrResults([client, subject, beneficiary], input.pepStatus)
  const missing = [...client.missing.map((item) => `Cliente: ${item}`), ...subject.missing.map((item) => `Institucional: ${item}`),
    ...(beneficiary?.missing.map((item) => `Beneficiario: ${item}`) || []), ...evaluateTransactionalProfile(input.transactionalProfile, []).missing]
  if (!input.methodologyAccepted) missing.push("Adopción documentada de metodología")
  if(input.reviewPlan)missing.push(...getEbrReviewPlanMissing(input.reviewPlan,input.at))
  const institution = input.institutionalFactors ? evaluateInstitutionalRisk(input.institutionalFactors,input.controls) : null
  if (input.institutionalFactors && !institution?.complete) missing.push(...(institution?.missing || []).map((item)=>`EBR institucional: ${item}`),...(!institution?.controlsComplete?["Controles institucionales y evidencia revisados"]:[]))
  if (input.status !== "draft" && missing.length) throw new Error(`Completa la evaluación antes de enviarla: ${missing.join("; ")}`)
  if (input.status === "approved" && !input.canApprove) throw new Error("Tu perfil no permite aprobar evaluaciones.")
  if (input.status === "approved" && (!input.sources.length||input.sources.some((source)=>!source.id?.trim()||!source.label?.trim()||!Number.isFinite(Date.parse(source.consultedAt))))) throw new Error("Documenta al menos una fuente o evidencia consultada con fecha válida antes de aprobar.")
  const revision = (input.previous?.revision || 0) + 1
  const percent = level === "Pendiente" ? 0 : Math.max(client.percent, subject.percent, beneficiary?.percent || 0)
  const snapshot: EbrAssessmentHistory = { id: `ebr-revision-${revision}-${input.at}`, revision, status: input.status, updatedAt: input.at,
    actor: input.actor, methodologyVersion: EBR_METHODOLOGY.id, result: { level, percent }, clientAnswers: normalizeEbrAnswers(input.clientAnswers),
    subjectAnswers: normalizeEbrAnswers(input.subjectAnswers), beneficiaryAnswers: input.beneficiaryAnswers ? normalizeEbrAnswers(input.beneficiaryAnswers) : undefined,
    controls:cloneControls(input.controls), institutionalFactors:input.institutionalFactors?cloneFactors(input.institutionalFactors):undefined, transactionalProfile: { ...input.transactionalProfile }, sources: input.sources.map((source) => ({ ...source })),reviewPlan:input.reviewPlan?cloneReviewPlan(input.reviewPlan):undefined }
  return { revision, workflow: { status: input.status, methodologyVersion: EBR_METHODOLOGY.id, approvedAt: input.status === "approved" ? input.at : undefined,
    approvedBy: input.status === "approved" ? input.actor : undefined }, riskSummary: input.status === "approved" ? { level, score: client.total, percent } : undefined,
    institutionalRisk:institution, previewSummary: { level, score: client.total, percent }, missing, history: [...(input.previous?.history || []), snapshot] }
}
