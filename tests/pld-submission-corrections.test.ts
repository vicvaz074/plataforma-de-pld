import assert from "node:assert/strict"
import test from "node:test"
import {createStoredPldOperation,editStoredPldOperation} from "../lib/pld/stored-operations"
import {createSubmissionDraft,confirmSubmission,mergeSubmission,readStoredSubmissions,selectSubmissionForOperation,type StoredSubmission,type SubmissionAttachment} from "../lib/pld/submissions"

const receipt=(suffix:string):SubmissionAttachment=>({id:`receipt-${suffix}`,type:"Acuse SAT",name:`acuse-${suffix}.pdf`,size:10,mimeType:"application/pdf",dataUrl:`/api/v1/companies/one/files/${suffix}`,sha256:`hash-${suffix}`,uploadedAt:"2026-11-11T12:00:00Z"})
const fill=(draft:StoredSubmission,suffix:string):StoredSubmission=>({...draft,form:{folio:`FOLIO-${suffix}`,digitalSeal:`sello-${suffix}`,submissionDate:"2026-11-11",acknowledgementDate:"2026-11-11"},attachments:[receipt(suffix)]})

test("corrección crea snapshot nuevo vacío por revisión y exige nuevo acuse sin alterar el presentado",()=>{
  const operation=createStoredPldOperation({id:"op-correction",clienteId:"fixture-client",actividadKey:"fraccion-xv-uso-goce",cliente:"Cliente",rfc:"DLV190624M32",monto:400_000,fechaOperacion:"2026-11-10",umbralStatus:"aviso",captureStatus:"complete"},{at:"2026-11-10T12:00:00Z"})!
  const initial=fill(createSubmissionDraft({operation,operationType:"relevante",actor:"captura",at:"2026-11-11T10:00:00Z"}),"original")
  const first=confirmSubmission({submission:initial,operations:[operation],actor:"aprobador",at:"2026-11-11T12:00:00Z"})
  let records=mergeSubmission([],first.submission,0)
  const historical=records[0],historicalBytes=JSON.stringify(historical)
  const edited=editStoredPldOperation(first.operations[0],{monto:"500000.00"},{at:"2026-11-11T13:00:00Z",actor:"captura",correctionReason:"Corregir importe con soporte"})
  assert.equal(edited.ok,true)
  if(!edited.ok)return
  assert.equal(edited.operation.revision,3)
  assert.equal(edited.operation.submission.status,"correction-pending")
  const originalOperation=JSON.stringify(edited.operation)
  const draft=createSubmissionDraft({operation:edited.operation,previous:historical,operationType:"relevante",actor:"captura",at:"2026-11-11T14:00:00Z"})
  assert.equal(draft.id,"submission-op-correction-r3")
  assert.equal(draft.preparedOperationRevision,3)
  assert.equal(draft.sourceOperationRevision,3)
  assert.equal(draft.correctionOf,historical.id)
  assert.deepEqual(draft.form,{})
  assert.deepEqual(draft.attachments,[])
  assert.deepEqual(draft.checklist,{})
  assert.deepEqual(draft.evidence,{})
  assert.equal(JSON.stringify(edited.operation),originalOperation,"preparar no presenta ni modifica la operación")
  records=mergeSubmission(records,draft,0)
  const savedDraft=records.find((item)=>item.id===draft.id)!
  assert.equal(selectSubmissionForOperation(records,edited.operation)?.id,draft.id)
  assert.throws(()=>mergeSubmission(records,{...historical,form:{folio:"alterado"}},historical.revision),/inmutable/)
  assert.throws(()=>confirmSubmission({submission:savedDraft,operations:[edited.operation],actor:"aprobador",at:"2026-11-11",priorSubmissions:records}),/acuse/)
  assert.throws(()=>confirmSubmission({submission:{...fill(savedDraft,"correction"),attachments:[receipt("original")]},operations:[edited.operation],actor:"aprobador",at:"2026-11-11",priorSubmissions:records}),/nuevos/)
  assert.throws(()=>confirmSubmission({submission:fill(savedDraft,"original"),operations:[edited.operation],actor:"aprobador",at:"2026-11-11",priorSubmissions:records}),/nuevos/)
  const second=confirmSubmission({submission:fill(savedDraft,"correction"),operations:[edited.operation],actor:"aprobador",at:"2026-11-11T15:00:00Z",priorSubmissions:records})
  assert.equal(second.operations[0].revision,4)
  assert.equal(second.submission.preparedOperationRevision,3)
  assert.equal(second.submission.sourceOperationRevision,4)
  records=mergeSubmission(records,second.submission,savedDraft.revision)
  assert.equal(records.length,2)
  assert.equal(JSON.stringify(records.find((item)=>item.id===historical.id)),historicalBytes)
  const reloaded=readStoredSubmissions(JSON.stringify(records))
  assert.equal(selectSubmissionForOperation(reloaded,second.operations[0])?.id,draft.id)
  assert.equal(reloaded.find((item)=>item.id===historical.id)?.attachments[0].dataUrl,receipt("original").dataUrl)
})

test("borradores legacy permanecen legibles pero una revisión desfasada nunca confirma automáticamente",()=>{
  const operation=createStoredPldOperation({id:"legacy-op",clienteId:"fixture-client",fechaOperacion:"2026-11-10",monto:1,captureStatus:"complete",umbralStatus:"aviso"})!
  const old:StoredSubmission={schemaVersion:1,id:operation.id,revision:1,operationId:operation.id,sourceOperationRevision:1,operationType:"relevante",form:{folio:"old"},checklist:{},evidence:{},attachments:[receipt("old")],trace:[],status:"draft",createdAt:"2026-11-10",updatedAt:"2026-11-10"}
  const newer={...operation,revision:2}
  assert.equal(readStoredSubmissions(JSON.stringify([old]))[0].id,operation.id)
  assert.equal(selectSubmissionForOperation([old],newer)?.id,old.id,"el histórico se muestra, no se sobrescribe")
  assert.throws(()=>confirmSubmission({submission:old,operations:[newer],actor:"user",at:"2026-11-11"}),/cambió/)
  const next=createSubmissionDraft({operation:newer,previous:old,operationType:"relevante",actor:"user",at:"2026-11-11"})
  assert.equal(next.supersedesDraftId,old.id)
  assert.equal(next.correctionOf,undefined,"un borrador no se convierte en una presentación histórica")
  assert.deepEqual(next.attachments,[])
})

test("un aviso legacy sin cliente estable no se confirma aunque conserve acuse y obligación históricos",()=>{
  const operation=createStoredPldOperation({id:"unlinked",fechaOperacion:"2026-11-10",monto:400000,captureStatus:"complete",umbralStatus:"aviso"})!
  assert.equal(operation.clientIdentityReviewRequired,true)
  const draft=fill(createSubmissionDraft({operation,operationType:"relevante",actor:"captura",at:"2026-11-11T12:00:00Z"}),"new")
  assert.throws(()=>confirmSubmission({submission:draft,operations:[operation],actor:"user",at:"2026-11-11T12:10:00Z"}),/Resuelve explícitamente/)
  assert.equal(operation.umbralStatus,"aviso")
})
