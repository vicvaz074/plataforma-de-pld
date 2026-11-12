import { markStoredPldOperationPresented, type StoredPldOperationV3 } from "./stored-operations"

export const SUBMISSIONS_STORAGE_KEY = "pld-submissions-workflow"
export interface SubmissionAttachment {
  id: string; type: string; name: string; size: number; mimeType: string; dataUrl: string; sha256: string; uploadedAt: string
}
export interface SubmissionTrace {
  id: string; action: string; user: string; timestamp: string; details: string; noticeId: string
}
export interface StoredSubmission {
  schemaVersion: 1|2; id: string; revision: number; operationId: string; sourceOperationRevision: number;
  preparedOperationRevision?:number; correctionOf?:string; supersedesDraftId?:string; previousOperationRevision?:number;
  operationType: string; form: Record<string, string>; checklist: Record<string, { answer: "si" | "no" | "no-aplica" | null; notes: string }>;
  evidence: Record<string, boolean>; attachments: SubmissionAttachment[]; trace: SubmissionTrace[];
  status: "draft" | "presented"; createdAt: string; updatedAt: string
}
export function readStoredSubmissions(raw: string | null): StoredSubmission[] {
  if (!raw) return []
  const value: unknown = JSON.parse(raw)
  if (!Array.isArray(value) || value.some((item) => !item || typeof item !== "object" || typeof item.id !== "string" || !item.form || !Array.isArray(item.attachments) || !Array.isArray(item.trace))) {
    throw new Error("Los avisos guardados no son legibles; se conservaron para recuperación.")
  }
  return value as StoredSubmission[]
}
export function mergeSubmission(records: StoredSubmission[], incoming: StoredSubmission, expectedRevision: number) {
  const previous = records.find((item) => item.id === incoming.id)
  if ((previous?.revision ?? 0) !== expectedRevision) throw new Error("El aviso cambió en otra vista. Vuelve a abrirlo antes de guardar.")
  if (previous?.status==="presented") throw new Error("Un aviso presentado es inmutable. Prepara una corrección nueva para la revisión actual.")
  if (incoming.schemaVersion===2 && incoming.id!==submissionDraftId(incoming.operationId,incoming.preparedOperationRevision || 0)) throw new Error("El borrador debe identificar la operación y su revisión de captura.")
  if (incoming.correctionOf && !records.some((item)=>item.id===incoming.correctionOf && item.operationId===incoming.operationId && item.status==="presented")) throw new Error("No se encontró el aviso histórico presentado al que corresponde la corrección.")
  return [...records.filter((item) => item.id !== incoming.id), { ...incoming, revision: expectedRevision + 1, createdAt: previous?.createdAt || incoming.createdAt }]
}
export function submissionDraftId(operationId:string,revision:number){return `submission-${operationId}-r${revision}`}
export function createSubmissionDraft(input:{operation:Pick<StoredPldOperationV3,"id"|"revision">;previous?:StoredSubmission;operationType:string;actor:string;at:string}):StoredSubmission{
  const {operation,previous}=input
  if(!operation.id || !Number.isInteger(operation.revision) || operation.revision<1)throw new Error("Selecciona una operación y revisión válidas.")
  const id=submissionDraftId(operation.id,operation.revision)
  return {schemaVersion:2,id,revision:0,operationId:operation.id,preparedOperationRevision:operation.revision,sourceOperationRevision:operation.revision,
    correctionOf:previous?.status==="presented" ? previous.id : previous?.correctionOf,
    supersedesDraftId:previous?.status==="draft" ? previous.id : undefined,previousOperationRevision:previous?.sourceOperationRevision,
    operationType:input.operationType,form:{},checklist:{},evidence:{},attachments:[],status:"draft",createdAt:input.at,updatedAt:input.at,
    trace:[{id:`${id}-prepared`,action:previous ? "Nueva revisión de aviso preparada" : "Borrador de aviso preparado",user:input.actor,timestamp:input.at,
      details:`Captura de operación revisión ${operation.revision}.${previous ? ` Conserva el aviso anterior ${previous.id}; requiere nuevo folio y acuse.` : ""}`,noticeId:id}]}
}
export function selectSubmissionForOperation(records:readonly StoredSubmission[],operation:Pick<StoredPldOperationV3,"id"|"revision"|"submission">):StoredSubmission|undefined{
  const candidates=records.filter((item)=>item.operationId===operation.id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||b.revision-a.revision)
  return candidates.find((item)=>item.status==="draft" && item.sourceOperationRevision===operation.revision && (item.preparedOperationRevision??item.sourceOperationRevision)===operation.revision)
    || (operation.submission.status==="presented" ? candidates.find((item)=>item.status==="presented" && item.sourceOperationRevision===operation.revision) : undefined)
    || candidates[0]
}
export function confirmSubmission(input: { submission: StoredSubmission; operations: StoredPldOperationV3[]; actor: string; at: string; packageId?: string;priorSubmissions?:readonly StoredSubmission[] }) {
  const { submission } = input
  const operation = input.operations.find((item) => item.id === submission.operationId)
  if (!operation) throw new Error("Selecciona una operación guardada para registrar su presentación.")
  if(operation.clientIdentityReviewRequired)throw new Error("Resuelve explícitamente el cliente o expediente antes de preparar una nueva presentación; se conserva el histórico.")
  if (submission.status==="presented") throw new Error("Este aviso ya fue presentado. Prepara una corrección nueva si la operación cambió.")
  if (operation.revision !== submission.sourceOperationRevision) throw new Error("La operación cambió después de preparar este aviso. Revisa la revisión actual.")
  if (submission.preparedOperationRevision!==undefined && submission.preparedOperationRevision!==operation.revision) throw new Error("El borrador corresponde a una revisión de captura anterior.")
  if (operation.captureStatus === "draft" || operation.lifecycle.status === "cancelled") throw new Error("Una operación incompleta o cancelada no se puede marcar presentada.")
  if (operation.umbralStatus !== "aviso" && !["aviso_24h", "informe_27_bis", "aviso_normal"].includes(operation.avisoSalidaTipo || "")) throw new Error("Este registro no tiene una salida SAT reportable.")
  if (!submission.form.folio?.trim() || !submission.form.digitalSeal?.trim() || !submission.form.submissionDate || !submission.form.acknowledgementDate || !submission.attachments.some((file) => file.type === "Acuse SAT" && file.dataUrl)) {
    throw new Error("Para confirmar presentación se requieren folio, sello, fecha de envío, fecha de acuse y archivo del acuse SAT.")
  }
  if(submission.correctionOf){
    const historical=input.priorSubmissions?.find((item)=>item.id===submission.correctionOf && item.operationId===operation.id && item.status==="presented")
    if(!historical)throw new Error("Conserva el aviso histórico presentado antes de confirmar su corrección.")
    const historicalReceipts=input.priorSubmissions!.filter((item)=>item.operationId===operation.id && item.status==="presented").flatMap((item)=>item.attachments.filter((file)=>file.type==="Acuse SAT"))
    if(submission.form.folio.trim()===historical.form.folio?.trim() || submission.attachments.some((file)=>file.type==="Acuse SAT" && historicalReceipts.some((old)=>file.id===old.id || file.dataUrl===old.dataUrl || Boolean(file.sha256 && file.sha256===old.sha256))))throw new Error("La corrección requiere un folio y acuse nuevos; no se puede reutilizar una presentación anterior.")
  }
  if(submission.supersedesDraftId){
    const superseded=input.priorSubmissions?.find((item)=>item.id===submission.supersedesDraftId && item.operationId===operation.id)
    if(!superseded)throw new Error("Conserva el borrador anterior antes de confirmar la nueva revisión.")
    if(submission.attachments.some((file)=>file.type==="Acuse SAT" && superseded.attachments.some((old)=>old.type==="Acuse SAT" && (file.id===old.id || file.dataUrl===old.dataUrl || Boolean(file.sha256 && file.sha256===old.sha256)))))throw new Error("La nueva revisión requiere un acuse nuevo; no reutilices el archivo del borrador anterior.")
  }
  const result = markStoredPldOperationPresented(operation, { actor: input.actor, at: input.at, reference: submission.form.folio, packageId: input.packageId,correctionReason:operation.submission.correctionReason })
  if (!result.ok) throw new Error(result.message)
  return { operations: input.operations.map((item) => item.id === operation.id ? result.operation : item),
    submission: { ...submission, status: "presented" as const, sourceOperationRevision: result.operation.revision } }
}
