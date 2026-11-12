import type { ProfessionalReport } from "./reports"
import type { IntegrationClient } from "./integration-records"
import type { ScoredResult } from "./ebr-questionnaire"
import { EBR_METHODOLOGY, INSTITUTIONAL_LABELS, evaluateTransactionalProfile,
  type EbrAssessmentHistory, type EbrControlReview, type EbrSourceSnapshot, type EbrReviewPlan,
  type InstitutionalFactor, type TransactionalProfile, type evaluateInstitutionalRisk, type transitionInstitutionalAssessment } from "./ebr-assessment"
import type { PepScreeningResult, PepSearchResponse } from "./types"
import { formatMoneyFromCents } from "./money"
import { avisosReportDate, getReportReliableMxnCents, reportQuantity } from "./reports-avisos"
import type { StoredPldOperationV3 } from "./stored-operations"
import { formatOperationFinancialSummary } from "./operation-finance"
import { reviewSignature } from "./module-continuity"

export type InstitutionalReportSnapshot = Omit<Partial<ReturnType<typeof transitionInstitutionalAssessment>>, "workflow"> & {
  workflow?: { status: string; methodologyVersion: string; approvedAt?: string; approvedBy?: string }
}

export interface EbrProfessionalReportInput {
  client: IntegrationClient | null
  displayLevel: string
  displayedStatus: string
  isCurrentApproved: boolean
  approvalPercent: number
  historicalApproved?: { level: string; percent: number }
  clientResult: ScoredResult
  subjectResult: ScoredResult
  beneficiaryResult: ScoredResult | null
  institutionalRisk: ReturnType<typeof evaluateInstitutionalRisk>
  institutionalFactors: readonly InstitutionalFactor[]
  controls: readonly EbrControlReview[]
  sources: readonly EbrSourceSnapshot[]
  institutionalSources: readonly EbrSourceSnapshot[]
  reviewPlan: EbrReviewPlan
  institutionalReviewPlan: EbrReviewPlan
  transactionalProfile: TransactionalProfile
  operations: readonly Pick<StoredPldOperationV3, "id" | "montoCentavos" | "fechaOperacion" | "moneda" | "financeReviewRequired" | "finance" | "captureDraft" | "montoNoDeterminado">[]
  notes: string
  pepScreening: PepScreeningResult | null
  pepWhois: PepSearchResponse | null
  history: readonly EbrAssessmentHistory[]
  revision: number
  institutionalSnapshot?: InstitutionalReportSnapshot
  institutionalMethodologyAccepted: boolean
  distribution: readonly { level: string; count: number | null }[]
  unapprovedClients: number | null
}

const label = (value: string) => value.replace(/[_-]/g, " ")
const statusLabel = (value: string) => ({ draft:"Borrador",review:"En revisión",approved:"Aprobada",open:"Abierta",completed:"Cerrada",unknown:"Sin revisar",absent:"Ausente",partial:"Parcial",effective:"Efectivo" }[value] || label(value))
const formatCents = (value: number | null) => value === null ? "Sin dato" : formatMoneyFromCents(value, {currency:"MXN"})

/** A saved approval belongs to its exact evidence/methodology snapshot, not to
 * live forms that happen to produce the same numeric score. */
export function institutionalReportApprovalState(input: Pick<EbrProfessionalReportInput,"institutionalSnapshot"|"institutionalFactors"|"controls"|"institutionalSources"|"institutionalReviewPlan"|"institutionalMethodologyAccepted"|"institutionalRisk">) {
  const saved=input.institutionalSnapshot
  const sameMethod=saved?.workflow?.methodologyVersion===EBR_METHODOLOGY.id
  const same=Boolean(saved&&sameMethod&&reviewSignature({factors:saved.institutionalFactors,controls:saved.controls,sources:saved.sources,plan:saved.reviewPlan,adopted:saved.methodologyAccepted})===
    reviewSignature({factors:input.institutionalFactors,controls:input.controls,sources:input.institutionalSources,plan:input.institutionalReviewPlan,adopted:input.institutionalMethodologyAccepted}))
  const wasApproved=saved?.workflow?.status==="approved"
  const isCurrentApproved=Boolean(wasApproved&&same&&input.institutionalRisk.complete&&input.institutionalMethodologyAccepted)
  return {isCurrentApproved,same,sameMethod,
    label:isCurrentApproved?"Aprobada vigente":wasApproved?!sameMethod?"Metodología distinta; aprobación histórica":same?"Revisión pendiente; aprobación histórica":"Cambios sin aprobar":saved?.workflow?.status==="review"?same?"En revisión":"Cambios sin guardar; revisión anterior conservada":saved?.workflow?same?"Borrador":"Borrador con cambios sin guardar":"Preliminar; sin guardar",
    historicalApproved:wasApproved?{revision:saved?.revision||0,risk:saved?.institutionalRisk,approvedAt:saved?.workflow?.approvedAt}:undefined}
}

export function ebrReportFactorBars(result: ScoredResult) {
  return result.details.map((detail) => ({
    label: detail.question.replace(/\s*\([^)]*\)$/, ""),
    value: result.complete ? Math.round(detail.score / detail.maximum * 100) : null,
    max: 100,
    valueLabel: result.complete ? `${detail.score}/${detail.maximum} puntos · ${Math.round(detail.score/detail.maximum*100)}% del máximo` : "Sin evaluación completa",
    tone: "accent" as const,
  }))
}
function questionnaireSection(title: string, result: ScoredResult): ProfessionalReport["sections"][number] {
  return {title,paragraphs:[`${result.complete ? `${result.level} (${result.percent}%).` : "Sin evaluación completa; no se clasifica como riesgo bajo."} ${result.reason}`,
    ...(result.missing.length ? [`Pendientes: ${result.missing.join("; ")}.`] : [])],
    bars: ebrReportFactorBars(result),
    table:{columns:[{label:"Pregunta",width:1.6},{label:"Respuesta capturada",width:2},{label:"Puntos / máximo",align:"right"}],rows:result.details.map((detail)=>[
      detail.question,
      detail.question.startsWith("Acciones observadas") && result.missing.includes("Revisión de comportamiento") ? "Sin revisión de comportamiento documentada" : (detail.answer || "Sin respuesta").replace(/(\d+) fuente\(s\)/g, (_, count: string) => reportQuantity(Number(count),"fuente","fuentes")).replace(/(\d+) alerta\(s\) seleccionada\(s\)/g, (_, count: string) => reportQuantity(Number(count),"alerta seleccionada","alertas seleccionadas")),
      result.complete ? `${detail.score} / ${detail.maximum}` : "Sin consolidar",
    ])},note:"Escala del mismo cuestionario visible en pantalla. Un resultado completo aún puede requerir revisión y aprobación."}
}
function planSection(title: string, plan: EbrReviewPlan): ProfessionalReport["sections"][number] {
  return {title,paragraphs:[`Próxima revisión definida por la empresa: ${avisosReportDate(plan.nextReviewAt)}.`],
    table:{columns:[{label:"Acción / ID",width:2},{label:"Responsable"},{label:"Fecha compromiso"},{label:"Estado"},{label:"Evidencia de cierre",width:1.5}],
      rows:plan.actions.map((action)=>[`${action.title}\n${action.id}`,action.ownerId||"Pendiente",avisosReportDate(action.dueAt),statusLabel(action.status),action.evidence?`${action.evidence.fileName}\nVersión ${action.evidence.fileVersionId}\nSHA-256 ${action.evidence.sha256}`:action.evidenceId||"Sin referencia"]),emptyMessage:"Sin acciones capturadas; no equivale a ausencia de riesgo."}}
}

export function buildEbrProfessionalReport(input: EbrProfessionalReportInput): ProfessionalReport {
  const {institutionalRisk:institution}=input
  const institutionalApproval=institutionalReportApprovalState(input)
  const profiles=[{label:"Cliente",result:input.clientResult},{label:"Sujeto obligado",result:input.subjectResult},...(input.beneficiaryResult?[{label:"Beneficiario controlador",result:input.beneficiaryResult}]:[])]
  const knownOperations=input.operations.filter((operation)=>getReportReliableMxnCents(operation)!==null)
  const transaction=evaluateTransactionalProfile(input.transactionalProfile,knownOperations)
  const observedMonths=new Map<string,{knownCents:number;count:number;pending:number}>()
  for(const operation of input.operations){
    const month=/^\d{4}-\d{2}-\d{2}$/.test(operation.fechaOperacion)?operation.fechaOperacion.slice(0,7):"Fecha por revisar"
    const row=observedMonths.get(month)||{knownCents:0,count:0,pending:0}
    const cents=getReportReliableMxnCents(operation)
    if(cents===null)row.pending++
    else{row.knownCents+=cents;if(!Number.isSafeInteger(row.knownCents))throw new Error("El importe mensual excede la precisión admitida.")}
    row.count++;observedMonths.set(month,row)
  }
  const observedRows=[...observedMonths.entries()].sort(([a],[b])=>a.localeCompare(b))
  const pendingAmounts=input.operations.length-knownOperations.length
  const history=input.history
  const countKnown=input.distribution.every((row)=>row.count!==null)
  const approvedCount=countKnown?input.distribution.reduce((sum,row)=>sum+(row.count||0),0):null
  const profile=input.transactionalProfile
  const sources=[...input.sources.map((source)=>`Cliente | ${avisosReportDate(source.consultedAt,true)} | ${source.label}${source.result?` | ${source.result}`:""}${source.sourceUrl?` | ${source.sourceUrl}`:""}`),
    ...input.institutionalSources.map((source)=>`Institucional | ${avisosReportDate(source.consultedAt,true)} | ${source.label}${source.result?` | ${source.result}`:""}${source.sourceUrl?` | ${source.sourceUrl}`:""}`)]
  const sections:ProfessionalReport["sections"]=[
    {title:"Perfiles evaluados",bars:profiles.map(({label:profileLabel,result})=>({label:profileLabel,value:result.complete?result.percent:null,max:100,valueLabel:result.complete?`${result.percent}% del máximo; ${result.level}`:"Sin evaluación completa",tone:"primary"})),note:"Puntajes normalizados de 0 a 100. Son una herramienta interna, no una probabilidad de lavado."},
    {title:"Riesgo institucional: inherente y residual",paragraphs:[`Revisión institucional ${input.institutionalSnapshot?.revision || "sin guardar"}. Estado actual: ${institutionalApproval.label}.`,
      `Inherente: ${institution.inherentScore===null?"Pendiente":`${institution.inherentScore}/3`} (${institution.inherentLevel}). Residual: ${institution.residualScore===null?"Pendiente":`${institution.residualScore}/3`} (${institution.residualLevel}).`,
      ...(institutionalApproval.historicalApproved&&!institutionalApproval.isCurrentApproved?[`Aprobación histórica conservada, revisión ${institutionalApproval.historicalApproved.revision}: inherente ${institutionalApproval.historicalApproved.risk?.inherentScore??"Sin dato"}/3; residual ${institutionalApproval.historicalApproved.risk?.residualScore??"Sin dato"}/3. No aprueba los cambios actuales.`]:[]),
      ...(!institution.complete?[`Pendientes: ${[...institution.missing,...(!institution.controlsComplete?["Controles y evidencia revisados"]:[])].join("; ")}.`]:[])],
      bars:[{label:"Inherente",value:institution.inherentPercent,max:100,valueLabel:institution.inherentPercent===null?"Sin dato":`${institution.inherentPercent}% del máximo`,tone:"primary"},
        {label:"Residual",value:institution.residualPercent,max:100,valueLabel:institution.residualPercent===null?"Sin dato":`${institution.residualPercent}% del máximo`,tone:"accent"}],
      table:{columns:[{label:"Factor"},{label:"Puntos / máximo"},{label:"Peso interno"},{label:"Fundamento y evidencia",width:2}],rows:input.institutionalFactors.map((factor)=>[INSTITUTIONAL_LABELS[factor.key],factor.score===null?"Sin dato":`${factor.score} / 3`,`${institution.weights[factor.key]*100}%`,`${factor.rationale||"Sin justificación"}\n${factor.evidence?`${factor.evidence.fileName} | versión ${factor.evidence.fileVersionId} | SHA-256 ${factor.evidence.sha256}`:factor.evidenceId||"Sin evidencia"}`])},
      note:"Se conserva la metodología efectiva de pantalla y sus cuatro factores. Los pesos internos no son valores impuestos por la autoridad; el residual exige controles sustentados y revisados."},
    ...profiles.map(({label:profileLabel,result})=>questionnaireSection(`Cuestionario completo: ${profileLabel.toLowerCase()}`,result)),
    {title:"Perfil transaccional y comportamiento observado",paragraphs:[`Monto mensual esperado: ${formatCents(profile.expectedMonthlyAmountCents)}. Operaciones mensuales esperadas: ${profile.expectedMonthlyCount??"Sin dato"}.`,
      `Origen: ${profile.originOfFunds||"Pendiente"}. Destino: ${profile.destinationOfFunds||"Pendiente"}. Canales: ${profile.channels||"Pendiente"}. Instrumentos: ${profile.instrument||"Pendiente"}.`,
      ...(!transaction.complete?[`Pendientes: ${transaction.missing.join("; ")}.`]:[]),
      `${reportQuantity(pendingAmounts,"operación tiene","operaciones tienen")} importe o conversión MXN por revisar; ${pendingAmounts === 1 ? "su importe no se suma, pero el registro se conserva y cuenta" : "sus importes no se suman, pero los registros se conservan y cuentan"} para frecuencia.`],
      table:{columns:[{label:"Mes"},{label:"Monto MXN conocido",align:"right"},{label:"Operaciones",align:"right"},{label:"Revisión del perfil",width:1.7}],rows:observedRows.map(([month,row])=>{
        const amountAlert=profile.expectedMonthlyAmountCents!==null&&row.knownCents>profile.expectedMonthlyAmountCents
        const countAlert=profile.expectedMonthlyCount!==null&&row.count>profile.expectedMonthlyCount
        const amount=row.pending===row.count?"Sin monto MXN validado":`${formatCents(row.knownCents)}${row.pending?" (parcial)":""}`
        const details=[amountAlert?"Importe conocido supera el esperado":"",countAlert?"Supera frecuencia esperada":"",row.pending?`${reportQuantity(row.pending,"importe","importes")} por revisar; comparación monetaria incompleta`:""].filter(Boolean)
        return [month,amount,row.count,details.join("; ")||(!transaction.complete?"Perfil incompleto":"Dentro del perfil declarado")]
      }),emptyMessage:"No hay operaciones vigentes del cliente para comparar con el perfil."},note:"La frecuencia incluye movimientos con conversión pendiente. Una señal transaccional no sustituye la determinación monetaria de obligación de aviso."},
    {title:"Movimientos considerados en el perfil",table:{columns:[{label:"Operación / fecha"},{label:"Moneda e importe original",width:1.6},{label:"Equivalente MXN",width:1.4}],rows:input.operations.map((operation)=>[`${operation.id}\n${avisosReportDate(operation.fechaOperacion)}`,operation.montoNoDeterminado?"Monto no determinado":operation.captureDraft?`${operation.captureDraft.currency} | ${operation.captureDraft.amountText || "Original por revisar"}`:formatOperationFinancialSummary(operation),getReportReliableMxnCents(operation)===null?"Importe o conversión por revisar":formatCents(operation.montoCentavos)]),emptyMessage:"Sin movimientos vigentes."}},
    {title:"Controles y efectividad documentada",table:{columns:[{label:"Control / ID",width:1.5},{label:"Efectividad"},{label:"Revisión"},{label:"Evidencia / versión",width:2}],rows:input.controls.map((control)=>[`${control.label}\n${control.id}`,statusLabel(control.effectiveness),`${control.reviewedBy||"Sin responsable"}\n${avisosReportDate(control.reviewedAt,true)}`,control.evidence?`${control.evidence.fileName}\n${control.evidence.fileVersionId}\nSHA-256 ${control.evidence.sha256}`:control.evidenceId||"Sin evidencia recuperable"]),emptyMessage:"Sin controles revisados; no se presume mitigación."}},
    {title:"PEP: revisión por cargos y fuentes consultadas",paragraphs:input.pepScreening?[`Resultado: ${label(input.pepScreening.status)}. Consulta: ${avisosReportDate(input.pepScreening.checkedAt,true)}.`,input.pepScreening.note,`Fuente: ${input.pepScreening.source}. Revisión humana: ${input.pepScreening.requiresHumanReview?"Requerida":"Conservar alcance de la fuente"}.`]:["Sin revisión por cargos registrada; no equivale a no ser PEP."],
      table:{columns:[{label:"Cargo"},{label:"Dependencia",width:1.5},{label:"Administración / entidad"}],rows:(input.pepScreening?.matches||[]).map((match)=>[match.cargo,match.dependencia,`${match.tipoAdministracionPublica}\n${match.entidadAdministracionPublica}`]),emptyMessage:"Sin coincidencias registradas en esta consulta."}},
    {title:"WhoIs PEP: coincidencias y decisión humana",paragraphs:input.pepWhois?[`Resultado: ${label(input.pepWhois.status)}. Consulta: ${avisosReportDate(input.pepWhois.checkedAt,true)}.`,input.pepWhois.recommendation]:["Sin consulta WhoIs PEP vinculada. La ausencia de una consulta no es una comprobación universal."],
      table:{columns:[{label:"Persona / fuente",width:1.5},{label:"Coincidencia"},{label:"Campos y nota",width:2}],rows:(input.pepWhois?.results||[]).map((match)=>[`${match.entity.name}\n${match.source}`,`${label(match.status)} | índice ${match.score}\n${match.requiresHumanReview?"Requiere revisión humana":"Ver decisión y alcance"}`,`${match.matchedFields.join(", ")}\n${match.note}`]),emptyMessage:"Sin coincidencias disponibles de esta consulta."},
      note:"El índice de coincidencia no es un puntaje de riesgo ni una certeza sobre la identidad."},
    {title:"Decisiones PEP y cobertura de la consulta",table:{columns:[{label:"Persona / decisión",width:1.5},{label:"Responsable / fecha"},{label:"Evidencia / próxima revisión",width:2}],rows:(input.pepWhois?.appliedDecisions||[]).map((decision)=>[`${decision.subjectName}\n${label(decision.decision)} | ${label(decision.relation)}`,`${decision.decidedBy}\n${avisosReportDate(decision.decidedAt,true)}`,`${decision.evidence}\nPróxima revisión: ${avisosReportDate(decision.nextReviewAt||"")}`]),emptyMessage:"No hay decisiones humanas aplicadas."},paragraphs:(input.pepWhois?.sourceSnapshots||[]).map((source)=>`${source.sourceLabel}: ${reportQuantity(source.count,"registro","registros")}. Sincronización: ${avisosReportDate(source.syncedAt||"",true)}. Fuente ${source.sourceId}.`)},
    {title:"Evolución e historial de revisiones",bars:history.filter((entry)=>entry.status==="approved").map((entry)=>({label:`Revisión ${entry.revision} · ${avisosReportDate(entry.updatedAt)}`,value:entry.result.level==="Pendiente"?null:entry.result.percent,max:100,valueLabel:entry.result.level==="Pendiente"?"Revisión pendiente":`${entry.result.percent}% · ${entry.result.level}`,tone:"primary"})),
      table:{columns:[{label:"Revisión / fecha"},{label:"Estado / responsable"},{label:"Resultado histórico"},{label:"Metodología / fuentes",width:1.6}],rows:history.map((entry)=>[`${entry.revision}\n${avisosReportDate(entry.updatedAt,true)}`,`${statusLabel(entry.status)}\n${entry.actor}`,`${entry.result.level}${entry.result.level==="Pendiente"?"":` | ${entry.result.percent}%`}`,`${entry.methodologyVersion}\n${entry.sources.map((source)=>`${source.label} (${avisosReportDate(source.consultedAt)})`).join("; ")}`]),emptyMessage:"Todavía no hay revisiones guardadas."},note:"Cada revisión conserva su metodología original; resultados de versiones distintas no son directamente comparables. Una aprobación histórica no aprueba los cambios actuales."},
    {title:"Clientes de la empresa activa",bars:[...input.distribution.map((row)=>({label:`Riesgo ${row.level.toLowerCase()} con aprobación vigente`,value:row.count,max:Math.max(1,(approvedCount||0)+(input.unapprovedClients||0)),valueLabel:row.count===null?"Datos por revisar":`${reportQuantity(row.count,"cliente","clientes")}`,tone:"primary" as const})),
      {label:"Sin aprobación vigente",value:input.unapprovedClients,max:Math.max(1,(approvedCount||0)+(input.unapprovedClients||0)),valueLabel:input.unapprovedClients===null?"Datos por revisar":`${reportQuantity(input.unapprovedClients,"cliente","clientes")}`,tone:"muted"}],
      note:"Borradores, revisiones históricas no vigentes y clientes sin evaluar se separan de los niveles de riesgo aprobados."},
    planSection("Plan de revisión del cliente",input.reviewPlan),
    planSection("Plan de revisión institucional",input.institutionalReviewPlan),
    {title:"Observaciones",paragraphs:[input.notes||"Sin observaciones registradas."]},
  ]
  return {title:"Evaluación Basada en Riesgo",subtitle:input.client?`${input.client.nombre} | ${input.client.identifier || "Identificador pendiente"}`:"Cliente sin seleccionar",scopeLabel:`Cliente/EUI: ${input.client?.id || "Sin vínculo"} | Revisión ${input.revision||"sin guardar"}`,
    summary:[`${input.isCurrentApproved?"Riesgo aprobado vigente":"Resultado preliminar, no aprobado"}: ${input.displayLevel}${input.displayLevel==="Pendiente"?"":` (${input.approvalPercent}% del máximo)`}. Estado: ${input.displayedStatus}.`,
      ...(input.historicalApproved&&!input.isCurrentApproved?[`Aprobación histórica conservada: ${input.historicalApproved.level} (${input.historicalApproved.percent}%). Los datos actuales requieren revisión.`]:[]),
      `Metodología ${EBR_METHODOLOGY.id}. ${EBR_METHODOLOGY.note}`],
    metrics:[{label:"Resultado actual",value:input.displayLevel==="Pendiente"?"Sin evaluar":input.displayLevel,note:input.isCurrentApproved?"Aprobación vigente":"Preliminar; no aprobado"},{label:"Estado de revisión",value:input.displayedStatus},{label:"Puntaje del cliente",value:input.clientResult.complete?`${input.clientResult.total}/${input.clientResult.max}`:"Sin evaluar"}],
    sections,sources:[`Metodología ${EBR_METHODOLOGY.id}. Revisión de fuente: ${EBR_METHODOLOGY.reviewedAt}. ${EBR_METHODOLOGY.source}`,...sources],
    disclaimers:["Puntuación interna de apoyo; no representa una probabilidad de lavado ni una certificación de cumplimiento.","La ausencia en una fuente PEP o geográfica no constituye comprobación universal. Se conserva fecha, alcance y revisión humana.","Los datos incompletos no se interpretan como riesgo bajo ni como controles efectivos. Los valores de pantalla no aprobados se señalan como preliminares."],
    filename:`ebr-${input.client?.id || "sin-cliente"}.pdf`}
}
