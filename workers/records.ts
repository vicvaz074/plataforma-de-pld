import { COLLECTION_MODULE, auditStatement, collectionModule, requireCompany } from "./access"
import { ApiError, type CompanyRow, type PilotActor, type PilotEnv, type StoredRecord } from "./types"
import { body, identifier, json, scopedFileVersionId as privateFileId } from "./http"
import { validateSubmission } from "./submission-guards"
import { prepareEbrEvidence } from "./ebr-evidence"
import { validateOperationReferences } from "./operation-references"
import { sanitizeStoredPldOperation, recalculateStoredPldOperationsChronologically, type StoredPldOperationV3 } from "../lib/pld/stored-operations"
import { findActividadByKey } from "../lib/pld/actividades"
import { transitionInstitutionalAssessment, transitionEbrAssessment } from "../lib/pld/ebr-assessment"
import { buildPldOperationalCase } from "../lib/pld/operational-flow"
import { generateSatOutputPackage } from "../lib/pld/sat-outputs"
import { integrationSubjectToTenant } from "../lib/pld/integration-records"
import { classifyAvisoSalida } from "../lib/pld/operations"
import { resolveSatTemplateForActividad } from "../lib/pld/sat-template-catalog"
import { normalizeSatXlsmLayout } from "../lib/pld/sat-xlsm"
import { isSatXlsmFieldRequired, isSatXlsmFieldActive, pruneInactiveSatFieldValues } from "../lib/pld/ui-workflow"
import { getSatOperationBranchMissingLabels, withSatParticipantOptions } from "../lib/pld/sat-operation-branches"
import { satCatalogCode, satDate } from "../lib/pld/sat-xml"
import { validateExpedienteIdentifiers } from "../lib/pld/expediente-eui"
import { snapshotEvidenceVersion } from "../lib/pld/evidence-lifecycle"
import { secureRecordState, validateDocumentReferences, validateStructuredRecord } from "./record-security"
import { normalizeSatFieldValues } from "../lib/pld/sat-field-values"
import type { SatXlsmLayout } from "../lib/pld/types"

function isObject(value: unknown): value is Record<string, unknown> {return Boolean(value&&typeof value==="object"&&!Array.isArray(value))}
export function validateRecordPayload(collection: string, id: string, payload: unknown) {
  const serialized = JSON.stringify(payload)
  if(serialized===undefined||serialized.length>750_000)throw new ApiError(413,"El registro supera el límite; adjunta archivos por el repositorio.","RECORD_TOO_LARGE")
  validateStructuredRecord(collection,payload)
  if(collection==="actividades_vulnerables_operaciones") {
    if(!isObject(payload)||payload.id!==id)throw new ApiError(400,"Identidad de operación no válida.","INVALID_OPERATION")
    if(payload.captureStatus!==undefined&&payload.captureStatus!=="draft"&&payload.captureStatus!=="complete")throw new ApiError(400,"Estado de captura no válido.","INVALID_OPERATION")
    if(payload.captureStatus!=="draft"&&!payload.actividadKey)throw new ApiError(400,"Selecciona la actividad de la operación.","INVALID_OPERATION")
    if(payload.actividadKey){try{findActividadByKey(String(payload.actividadKey))}catch{throw new ApiError(400,"Actividad no reconocida.","INVALID_OPERATION")}}
    if(!Number.isSafeInteger(payload.montoCentavos)||Number(payload.montoCentavos)<0)throw new ApiError(400,"El monto debe conservarse en centavos enteros.","INVALID_AMOUNT")
    if(payload.monto!==undefined&&Number(payload.monto)!==Number(payload.montoCentavos)/100)throw new ApiError(400,"El monto no coincide con los centavos.","INVALID_AMOUNT")
    if(payload.captureStatus!=="draft"){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(String(payload.fechaOperacion))||Number.isNaN(Date.parse(String(payload.fechaOperacion))))throw new ApiError(400,"Fecha de operación no válida.","INVALID_OPERATION")
      if(!payload.cliente||!payload.tipoCliente)throw new ApiError(400,"Completa la persona objeto de la operación.","INVALID_OPERATION")
      const sanitized=sanitizeStoredPldOperation(payload)
      if(!sanitized)throw new ApiError(400,"La operación no se pudo validar.","INVALID_OPERATION")
      if(sanitized.financeReviewRequired)throw new ApiError(400,"Documenta y verifica el importe original, divisa, tipo de cambio, fecha y fuente antes de completar.","INVALID_FINANCE")
      if(sanitized.clientIdentityReviewRequired)throw new ApiError(400,"Selecciona un cliente o expediente por ID estable antes de completar la operación.","CLIENT_IDENTITY_REQUIRED")
    }
  }
}

function decode(row: Record<string,unknown>): StoredRecord {return {collection:String(row.collection),id:String(row.id),revision:Number(row.revision),payload:JSON.parse(String(row.payload)),deleted:Boolean(row.deleted)}}
async function validateSatOperation(payload:Record<string,unknown>,env:PilotEnv){
  for(const key of ["satFieldValues","satCellValues"]){const value=payload[key];if(value!==undefined&&(!isObject(value)||Object.values(value).some((item)=>typeof item!=="string")))throw new ApiError(400,"Los valores SAT deben ser mapas de texto válidos.","INVALID_SAT_FIELDS")}
  const draft=payload.captureStatus==="draft",hasValues=Object.keys({...isObject(payload.satFieldValues)?payload.satFieldValues:{},...isObject(payload.satCellValues)?payload.satCellValues:{}}).length>0
  if(draft&&!hasValues)return payload
  if(draft&&(!payload.actividadKey||!payload.satTemplateId))throw new ApiError(400,"Selecciona el formato antes de guardar campos SAT.","INVALID_SAT_FIELDS")
  if(!draft){
  const identifiers=isObject(payload.expedienteIdentifiers)?payload.expedienteIdentifiers:isObject(payload.identificadores)?payload.identificadores:isObject(payload.identifiers)?payload.identifiers:{rfc:payload.rfc}
  const identifierError=validateExpedienteIdentifiers({rfc:String(identifiers.rfc||payload.rfc||""),nif:String(identifiers.nif||""),curp:String(identifiers.curp||"")},String(payload.tipoCliente).startsWith("pf"))
  if(identifierError)throw new ApiError(400,identifierError,"INVALID_IDENTIFIERS")
  }
  const template=resolveSatTemplateForActividad(String(payload.actividadKey),String(payload.satTemplateVariant||payload.satTemplateId||""))
  if(payload.satTemplateId!==template.templateId||!template.actividadKeys.includes(String(payload.actividadKey)))throw new ApiError(400,"El formato SAT no corresponde a la actividad.","INVALID_TEMPLATE")
  if(!env.ASSETS)throw new ApiError(503,"No se pudo validar el catálogo SAT.","SAT_LAYOUT_UNAVAILABLE")
  const response=await env.ASSETS.fetch(new Request(`${env.BETTER_AUTH_URL}/data/sat-xlsm-layouts/${template.templateId}.json`))
  if(!response.ok)throw new ApiError(503,"No se pudo cargar el formato SAT.","SAT_LAYOUT_UNAVAILABLE")
  const layout=normalizeSatXlsmLayout(await response.json() as SatXlsmLayout)
  let values:Record<string,string>
  try{
    const fields=layout.sections.flatMap((section)=>section.fields),semantic=normalizeSatFieldValues(fields,(payload.satFieldValues||{}) as Record<string,string>),cells=normalizeSatFieldValues(fields,(payload.satCellValues||{}) as Record<string,string>)
    for(const [key,value] of Object.entries(cells))if(Object.hasOwn(semantic,key)&&semantic[key].toUpperCase()!==value.toUpperCase())throw new Error(`Los valores SAT del campo y su celda no coinciden: ${key}.`)
    values={...cells,...semantic}
  }catch(error){throw new ApiError(400,error instanceof Error?error.message:"Campos SAT no válidos.","INVALID_SAT_FIELDS")}
  const fields=withSatParticipantOptions(layout.sections.flatMap((section)=>section.fields),values),active=pruneInactiveSatFieldValues({fields,values})
  const canonicalCells=Object.fromEntries(fields.filter((field)=>Object.hasOwn(active,field.id)).map((field)=>[`${field.sheetName}!${field.cell}`,active[field.id]]))
  if(draft)return {...payload,satFieldValues:active,satCellValues:canonicalCells}
  const missing=fields.filter((field)=>isSatXlsmFieldRequired(field,active)&&!String(active[field.id]||active[`${field.sheetName}!${field.cell}`]||"").trim()).map((field)=>field.label)
  missing.push(...getSatOperationBranchMissingLabels(layout.templateId,active,fields))
  if(missing.length)throw new ApiError(400,`Completa los campos SAT: ${missing.slice(0,12).join("; ")}`,"SAT_FIELDS_INCOMPLETE")
  for(const field of fields){
    if(!isSatXlsmFieldActive(field,active))continue
    const value=active[field.id]||active[`${field.sheetName}!${field.cell}`]||""
    if(!value)continue
    if(field.options?.length&&!field.options.some((option)=>option.toUpperCase()===value.toUpperCase()||satCatalogCode(option)===satCatalogCode(value)))throw new ApiError(400,`Opción no válida: ${field.label}.`,"INVALID_CATALOG_VALUE")
    if(field.dataType==="fecha"&&!satDate(value))throw new ApiError(400,`Fecha no válida: ${field.label}.`,"INVALID_SAT_DATE")
  }
  return {...payload,satFieldValues:active,satCellValues:canonicalCells,satMissingRequiredFields:[],satWorkbookStatus:"listo"}
}
function serverPackage(operation:NonNullable<ReturnType<typeof sanitizeStoredPldOperation>>,company:CompanyRow,actor:PilotActor,at:string){
  const tenant=integrationSubjectToTenant({id:company.id,rfc:company.rfc,nombre:company.name,activityKeys:[operation.actividadKey],source:"tenant"})
  const raw=operation as Record<string,unknown>,liquidacion=isObject(raw.liquidacion)?raw.liquidacion:{}
  const fields={...(raw.satFieldValues as Record<string,string>),"persona_aviso.sujeto_obligado_rfc":company.rfc}
  const cells={...(raw.satCellValues as Record<string,string>)}
  for(const key of Object.keys(cells))if(/!(?:C4)$/.test(key)&&/^(?:Persona Objeto del aviso|Aviso)!/.test(key))cells[key]=company.rfc
  const operationalCase=buildPldOperationalCase({tenant,periodo:operation.periodo,actividadKey:operation.actividadKey,
    clienteId:String(raw.expedienteReferenciado||raw.clienteId||operation.rfc),clienteNombre:operation.cliente,clienteRfc:operation.rfc,
    tipoCliente:operation.tipoCliente,fechaOperacion:operation.fechaOperacion,montoMxn:operation.monto,montoCentavos:operation.montoCentavos,
    finance:operation.finance,captureStatus:operation.captureStatus,formaPago:String(liquidacion.formaPago||""),
    sospecha24h:raw.sospecha24h===true,supuesto27Bis:operation.mismoGrupo&&operation.umbralStatus==="aviso",
    operacionFinancieraPorCuentaCliente:operation.operacionFinancieraPorCuentaCliente,contraprestacionCentavos:operation.contraprestacionCentavos,
    montoBaseAvisoCentavos:operation.montoBaseAvisoCentavos,montoNoDeterminado:operation.montoNoDeterminado,
    completedEvidence:raw.requisitosChecklist as Record<string,boolean>,satTemplateId:raw.satTemplateId as string,satTemplateFile:raw.satTemplateFile as string,
    satTemplateVariant:raw.satTemplateVariant as string,satFieldValues:fields,satCellValues:cells,
    satMissingRequiredFields:raw.satMissingRequiredFields as string[],satWorkbookStatus:raw.satWorkbookStatus as never,actor:actor.id})
  // The operation has already been recalculated chronologically by the server.
  // Rebuilding a package must not reclassify it using only its individual amount.
  const output=classifyAvisoSalida({status:operation.umbralStatus,fechaOperacion:operation.fechaOperacion,sospecha24h:raw.sospecha24h===true,supuesto27Bis:operation.mismoGrupo&&operation.umbralStatus==="aviso",evidenceCanClose:operationalCase.evidenceStatus.canClose})
  if(output.tipo==="sin_salida")throw new ApiError(409,"El registro es informativo y no genera una salida SAT.","NO_REPORTABLE_OUTPUT")
  operationalCase.satOutputStatus={...operationalCase.satOutputStatus,kind:output.tipo,label:output.label,descripcion:output.descripcion,fechaLimite:output.fechaLimite,canClose:output.canClose,warnings:output.warnings}
  return generateSatOutputPackage(operationalCase,{sourceOperationId:operation.id,sourceOperationRevision:operation.revision,updatedAt:at})
}

export async function handleRecords(request: Request,url:URL,actor:PilotActor,env:PilotEnv):Promise<Response|null>{
  const history=url.pathname.match(/^\/api\/v1\/companies\/([^/]+)\/records\/([^/]+)\/([^/]+)\/history$/)
  if(history&&request.method==="GET"){
    const companyId=identifier(history[1]),collection=identifier(history[2]),id=identifier(history[3]);await requireCompany(actor,companyId,env,collectionModule(collection),"view")
    const versions=(await env.DB.prepare("SELECT revision,payload,deleted,createdAt,actorId FROM pld_record_versions WHERE companyId=? AND collection=? AND id=? ORDER BY revision DESC LIMIT 100").bind(companyId,collection,id).all<Record<string,unknown>>()).results.map((row)=>({...row,payload:JSON.parse(String(row.payload)),deleted:Boolean(row.deleted)}))
    return json({versions})
  }
  const match=url.pathname.match(/^\/api\/v1\/companies\/([^/]+)\/(snapshot|records(?:\/batch)?)$/)
  if(!match)return null
  const companyId=identifier(match[1]),company=await requireCompany(actor,companyId,env)
  if(request.method==="GET"){
    const collection=url.searchParams.get("collection")
    if(collection)await requireCompany(actor,companyId,env,collectionModule(collection),"view")
    const rows=(await env.DB.prepare(`SELECT collection,id,revision,payload,deleted FROM pld_records WHERE companyId=?${collection?" AND collection=?":""}`).bind(companyId,...(collection?[collection]:[])).all<Record<string,unknown>>()).results
    const allowed=new Set<string>()
    for(const module of new Set(Object.values(COLLECTION_MODULE))){try{await requireCompany(actor,companyId,env,module,"view");allowed.add(module)}catch(error){if(!(error instanceof ApiError)||![403,404].includes(error.status))throw error}}
    return json({company,records:rows.filter((row)=>allowed.has(COLLECTION_MODULE[String(row.collection)])).map(decode)})
  }
  if(match[2]!=="records/batch"||request.method!=="POST")throw new ApiError(405,"Método no permitido.","METHOD_NOT_ALLOWED")
  const input=await body(request)
  if(!Array.isArray(input.mutations)||!input.mutations.length||input.mutations.length>100)throw new ApiError(400,"Envía entre 1 y 100 cambios por lote.","INVALID_BATCH")
  const changes:Array<{collection:string;id:string;revision:number;payload:unknown;deleted:boolean}>=[],seen=new Set<string>(),statements=[],referenceStatements=[]
  const mutations=[...input.mutations],derivedKeys=new Set<string>()
  const at=new Date().toISOString()
  const operationCollection="actividades_vulnerables_operaciones",operationChanges=mutations.filter((item)=>isObject(item)&&item.collection===operationCollection)
  const operationRows=operationChanges.length?(await env.DB.prepare("SELECT id,revision,payload FROM pld_records WHERE companyId=? AND collection=? AND deleted=0").bind(companyId,operationCollection).all<{id:string;revision:number;payload:string}>()).results:[]
  const prospective=new Map(operationRows.map((row)=>[row.id,JSON.parse(row.payload)]))
  for(const raw of operationChanges){if(!isObject(raw))continue;const id=identifier(raw.id);if(raw.deleted===true)prospective.delete(id);else prospective.set(id,raw.payload)}
  const canonicalOperations=[...prospective.values()].map((payload)=>sanitizeStoredPldOperation(isObject(payload)?{...payload,sujetoObligado:{id:company.id,rfc:company.rfc,nombre:company.name}}:payload,{now:at})).filter((operation):operation is StoredPldOperationV3=>operation!==null)
  const recalculated=operationChanges.length?recalculateStoredPldOperationsChronologically(canonicalOperations,{recordHistory:false,at,actor:actor.id}):[]
  const financeFields=["umbralStatus","umaDiaria","identificacionUmbralCentavos","avisoUmbralCentavos","acumuladoClienteCentavos","periodo","avisoSalidaTipo","alerta","alertaResuelta"] as const
  const historicalDifferences:string[]=[]
  for(const operation of recalculated){
    if(operationChanges.some((raw)=>isObject(raw)&&raw.id===operation.id))continue
    const old=operationRows.find((row)=>row.id===operation.id);if(!old)continue
    const payload=JSON.parse(old.payload) as StoredPldOperationV3
    if(financeFields.some((key)=>payload[key]!==operation[key])){
      if(payload.submission?.wasEverPresented||payload.avisoPresentado){historicalDifferences.push(operation.id);continue}
      mutations.push({collection:operationCollection,id:operation.id,expectedRevision:old.revision,payload:operation,deleted:false});derivedKeys.add(operationCollection+"\0"+operation.id)
    }
  }
  for(const raw of mutations){
    if(!isObject(raw))throw new ApiError(400,"Cambio no válido.","INVALID_BATCH")
    const collection=identifier(raw.collection),id=identifier(raw.id),module=collectionModule(collection),expected=Number(raw.expectedRevision),deleted=raw.deleted===true
    if(!Number.isSafeInteger(expected)||expected<0)throw new ApiError(400,"Revisión no válida.","INVALID_REVISION")
    const key=collection+"\0"+id;if(seen.has(key))throw new ApiError(400,"Hay cambios duplicados en el lote.","DUPLICATE_MUTATION");seen.add(key)
    if(!derivedKeys.has(key))await requireCompany(actor,companyId,env,module,deleted?"archive":"edit")
    const old=await env.DB.prepare("SELECT revision,payload,deleted FROM pld_records WHERE companyId=? AND collection=? AND id=?").bind(companyId,collection,id).first<Record<string,unknown>>()
    if((old?Number(old.revision):0)!==expected)throw new ApiError(409,"El registro cambió en otra sesión. Actualiza antes de guardar.","REVISION_CONFLICT")
    const oldPayload=old?JSON.parse(String(old.payload)):undefined
    let payload=deleted?(oldPayload??raw.payload??null):raw.payload
    if(collection==="pld-submissions-workflow"&&isObject(oldPayload)&&oldPayload.status==="presented"){
      if(deleted||JSON.stringify(payload)!==JSON.stringify(oldPayload))throw new ApiError(409,"Un aviso presentado es inmutable. Prepara una corrección nueva y conserva su acuse histórico.","PRESENTED_SUBMISSION_IMMUTABLE")
      changes.push({collection,id,revision:expected,payload:oldPayload,deleted:false});continue
    }
    if(!deleted){validateRecordPayload(collection,id,payload);validateDocumentReferences(collection,payload,companyId,env.BETTER_AUTH_URL)}
    if(!deleted&&collection==="pld-active-tenant-id"&&payload!==company.id)throw new ApiError(400,"La empresa activa se selecciona mediante los accesos de la sesión.","COMPANY_IDENTITY_MISMATCH")
    if(collection==="actividades_vulnerables_operaciones"&&deleted){
      const prior=sanitizeStoredPldOperation(oldPayload,{now:at})
      if(prior?.submission.wasEverPresented||prior?.avisoPresentado)throw new ApiError(409,"La operación presentada sólo puede cancelarse con motivo.","PRESENTED_OPERATION")
      const packageId=`satpkg-${id}`,linked=await env.DB.prepare("SELECT revision,payload,deleted FROM pld_records WHERE companyId=? AND collection='pld-sat-output-packages' AND id=?").bind(companyId,packageId).first<{revision:number;payload:string;deleted:number}>()
      if(linked&&!linked.deleted&&!mutations.some((item)=>isObject(item)&&item.collection==="pld-sat-output-packages"&&item.id===packageId)){
        mutations.push({collection:"pld-sat-output-packages",id:packageId,expectedRevision:linked.revision,payload:JSON.parse(linked.payload),deleted:true});derivedKeys.add("pld-sat-output-packages\0"+packageId)
      }
    }
    if(isObject(payload)){
      const legacyAssessment=collection==="ebr_evaluaciones"&&(payload.schemaVersion===1||payload.schemaVersion===2||(!isObject(payload.workflow)&&payload.schemaVersion!==3))
      if(legacyAssessment){
        const original={...payload}
        payload={...payload,schemaVersion:3,legacySnapshot:original,historicalRiskSummary:original.riskSummary,riskSummary:undefined,history:[],
          workflow:{status:"draft",methodologyVersion:"legacy-snapshot",requiresReview:true},needsMigrationReview:true,migratedAt:at,migratedBy:actor.id,
          migrationWarnings:["Se conservó la metodología y el resultado históricos en legacySnapshot; no constituyen una evaluación v3 aprobada. Completa cuestionario, fuentes y plan antes de aprobar."]}
      }
      const previous=isObject(oldPayload)?oldPayload:{}
      if(!deleted)payload=await secureRecordState(collection,payload,previous,actor,companyId,env,at)
      if(["auditoria-interna-registros","auditoria-observaciones-autoridades","auditoria-planes-accion"].includes(collection)&&(payload.status==="Cerrado")!==(previous.status==="Cerrado"))await requireCompany(actor,companyId,env,module,"approve")
      if(collection==="auditoria-verificacion-workflow"){
        const next=isObject(payload.finalChecklist)?payload.finalChecklist:{},prior=isObject(previous.finalChecklist)?previous.finalChecklist:{}
        if([...new Set([...Object.keys(next),...Object.keys(prior)])].some((key)=>(next[key]===true)!==(prior[key]===true)))await requireCompany(actor,companyId,env,module,"approve")
      }
      if(!deleted&&collection==="registro-sat-data"){
        const subjects:unknown[]=Array.isArray(payload.sujetosRegistrados)?payload.sujetosRegistrados:[]
        const identities=[payload.identificacion,...subjects.filter(isObject).map((subject)=>subject.identificacion)]
        if(company.rfc&&identities.some((identity)=>isObject(identity)&&identity.rfc&&String(identity.rfc).trim().toUpperCase()!==company.rfc))throw new ApiError(400,"El RFC de Alta no corresponde a la empresa activa; selecciona la razón social correcta.","COMPANY_IDENTITY_MISMATCH")
        payload={...payload,companyId:company.id,organizationId:company.organizationId,sujetosRegistrados:subjects.map((subject)=>isObject(subject)?{...subject,companyId:company.id,organizationId:company.organizationId}:subject)}
      }
      if(!deleted&&collection==="pld-tenants"){
        const tenants:unknown[]=Array.isArray(payload.tenants)?payload.tenants:[]
        if(tenants.some((tenant)=>!isObject(tenant)||tenant.id!==company.id||company.rfc&&String(tenant.rfc||"").trim().toUpperCase()!==company.rfc)||payload.activeTenantId&&payload.activeTenantId!==company.id)throw new ApiError(400,"Los sujetos obligados de esta vista deben corresponder a la empresa activa.","COMPANY_IDENTITY_MISMATCH")
        payload={...payload,companyId:company.id,organizationId:company.organizationId,activeTenantId:company.id}
      }
      if(collection==="actividades_vulnerables_operaciones"&&!deleted){
        const reference=await validateOperationReferences({payload,previous:isObject(oldPayload)?oldPayload:undefined,operationId:id,companyId,actor,env,mutations,derivedKeys,at})
        referenceStatements.push(...reference.guards)
        if(reference.derivedClient){mutations.push(reference.derivedClient);derivedKeys.add(reference.derivedClient.collection+"\0"+reference.derivedClient.id)}
        if(payload.captureStatus!=="draft"&&!company.rfc)throw new ApiError(400,"Completa el RFC de la empresa antes de finalizar una operación.","SUBJECT_RFC_REQUIRED")
        payload={...payload,sujetoObligado:{id:company.id,rfc:company.rfc,nombre:company.name},organizationId:company.organizationId,companyId}
        payload=await validateSatOperation(payload,env)
        if(isObject(oldPayload)&&isObject(oldPayload.submission)&&oldPayload.submission.wasEverPresented===true){
          if(deleted)throw new ApiError(409,"La operación presentada sólo puede cancelarse con motivo.","PRESENTED_OPERATION")
          const submission=isObject(payload.submission)?payload.submission:{}
          const lifecycle=isObject(payload.lifecycle)?payload.lifecycle:{}
          const confirming=submission.status==="presented"&&mutations.some((candidate)=>isObject(candidate)&&candidate.collection==="pld-submissions-workflow"&&candidate.deleted!==true&&isObject(candidate.payload)&&candidate.payload.operationId===id&&candidate.payload.status==="presented"&&Number(candidate.payload.preparedOperationRevision)===expected&&Number(candidate.payload.sourceOperationRevision)===expected+1)
          if(!confirming&&!submission.correctionReason&&!(lifecycle.status==="cancelled"&&lifecycle.cancellationReason))throw new ApiError(400,"Documenta el motivo de corrección.","CORRECTION_REASON_REQUIRED")
          payload={...payload,avisoPresentado:true,submission:{...oldPayload.submission,...submission,correctionReason:confirming?undefined:submission.correctionReason,wasEverPresented:true,status:lifecycle.status==="cancelled"?"cancelled":confirming?"presented":"correction-pending"}}
        }
        const sanitized=sanitizeStoredPldOperation(payload,{now:at})
        if(!sanitized)throw new ApiError(400,"Operación no válida.","INVALID_OPERATION")
        const prior=sanitizeStoredPldOperation(oldPayload,{now:at})
        if(sanitized.lifecycle.status!==prior?.lifecycle.status&&(sanitized.lifecycle.status==="cancelled"||prior?.lifecycle.status==="cancelled")){
          await requireCompany(actor,companyId,env,"operaciones","archive")
          if(sanitized.lifecycle.status==="cancelled"){
            if((sanitized.lifecycle.cancellationReason||"").trim().length<5)throw new ApiError(400,"Documenta un motivo de cancelación de al menos cinco caracteres.","CANCELLATION_REASON_REQUIRED")
            sanitized.lifecycle={...sanitized.lifecycle,cancelledBy:actor.id,cancelledAt:at}
          }
        }
        const existing=canonicalOperations.filter((operation)=>operation.id!==id)
        const derived=recalculateStoredPldOperationsChronologically([...existing,sanitized],{recordHistory:false,at,actor:actor.id}).find((operation)=>operation.id===id)!
        payload={...derived,revision:expected+1,updatedAt:at}
        const packageId=`satpkg-${id}`,packageKey="pld-sat-output-packages\0"+packageId
        if(!mutations.some((item)=>isObject(item)&&item.collection==="pld-sat-output-packages"&&item.id===packageId)){
          const oldPackage=await env.DB.prepare("SELECT revision,payload,deleted FROM pld_records WHERE companyId=? AND collection='pld-sat-output-packages' AND id=?").bind(companyId,packageId).first<{revision:number;payload:string;deleted:number}>()
          const reportable=derived.captureStatus!=="draft"&&derived.lifecycle.status!=="cancelled"&&(derived.umbralStatus==="aviso"||sanitized.sospecha24h===true)
          if(reportable||(oldPackage&&!oldPackage.deleted&&!derived.submission.wasEverPresented)){
            const generated=reportable?serverPackage({...derived,revision:expected+1},company,actor,at):JSON.parse(oldPackage!.payload)
            mutations.push({collection:"pld-sat-output-packages",id:packageId,expectedRevision:oldPackage?.revision||0,payload:generated,deleted:!reportable})
            derivedKeys.add(packageKey)
          }
        }
      }
      if(collection==="pld-evidences-documents"){
        const previous=isObject(oldPayload)?oldPayload:{},changedFile=previous.fileData!==payload.fileData||previous.sha256!==payload.sha256
        if(Boolean(previous.archived)!==Boolean(payload.archived))await requireCompany(actor,companyId,env,module,"archive")
        if(changedFile&&oldPayload){
          const history=Array.isArray(previous.versionHistory)?previous.versionHistory:[]
          const prior=previous.fileData?snapshotEvidenceVersion(previous as never,"Versión anterior conservada por el servidor"):undefined
          payload={...payload,version:Number(previous.version||0)+1,versionHistory:prior?[prior,...history]:history,reviewStatus:"pending",reviewedHash:undefined,reviewedAt:undefined,reviewedBy:undefined}
        }else if(oldPayload){
          payload={...payload,version:previous.version,versionHistory:previous.versionHistory}
          if(previous.reviewStatus!==payload.reviewStatus&&["approved","rejected"].includes(String(previous.reviewStatus)))await requireCompany(actor,companyId,env,module,"approve")
        }
        // Alternate approval booleans/timestamps are not an authority.
        for(const key of ["approvedAt","approvedBy","approved","isApproved","aprobado"])delete payload[key]
        if(["approved","rejected"].includes(String(payload.reviewStatus))){
          await requireCompany(actor,companyId,env,module,"approve")
          const versionId=privateFileId(payload.fileData,companyId,env.BETTER_AUTH_URL)
          const file=versionId?await env.DB.prepare("SELECT v.sha256,v.objectKey,d.moduleKey FROM pld_file_versions v JOIN pld_documents d ON d.id=v.documentId WHERE v.id=? AND v.companyId=? AND d.companyId=v.companyId").bind(versionId,companyId).first<{sha256:string;objectKey:string;moduleKey:string}>():null
          if(!file||file.sha256!==payload.sha256)throw new ApiError(400,"La revisión requiere una versión R2 y hash de esta empresa.","INVALID_EVIDENCE_REVIEW")
          if(!await env.EVIDENCE_BUCKET.get(file.objectKey))throw new ApiError(400,"No se puede revisar una versión cuyo archivo no está disponible.","INVALID_EVIDENCE_REVIEW")
          await requireCompany(actor,companyId,env,file.moduleKey,"approve")
          if(payload.reviewStatus==="rejected"&&!String(payload.reviewNote||"").trim())throw new ApiError(400,"Documenta el motivo de rechazo.","REVIEW_REASON_REQUIRED")
          payload={...payload,reviewedBy:actor.id,reviewedAt:at,reviewedHash:file.sha256}
          statements.push(env.DB.prepare("UPDATE pld_file_versions SET status=?,reviewedBy=?,reviewedAt=?,reason=? WHERE id=? AND companyId=? AND sha256=?").bind(payload.reviewStatus,actor.id,at,String(payload.reviewNote||"Revisión documental registrada"),versionId,companyId,file.sha256))
        }else payload={...payload,reviewStatus:"pending",reviewedHash:undefined,reviewedAt:undefined,reviewedBy:undefined}
      }
      if(collection==="pld-sat-output-packages"&&!deleted){
        const sourceOperationId=String(payload.sourceOperationId||"")
        const pending=changes.find((candidate)=>candidate.collection==="actividades_vulnerables_operaciones"&&candidate.id===sourceOperationId)||mutations.find((candidate)=>isObject(candidate)&&candidate.collection==="actividades_vulnerables_operaciones"&&candidate.id===sourceOperationId)
        const source=pending&&isObject(pending)?pending.payload:(await env.DB.prepare("SELECT payload FROM pld_records WHERE companyId=? AND collection='actividades_vulnerables_operaciones' AND id=? AND deleted=0").bind(companyId,sourceOperationId).first<{payload:string}>())?.payload
        const operation=sanitizeStoredPldOperation(typeof source==="string"?JSON.parse(source):source,{now:at})
        if(!operation||!sourceOperationId)throw new ApiError(400,"El paquete debe estar vinculado a una operación de esta empresa.","INVALID_PACKAGE_SOURCE")
        if(operation.captureStatus==="draft"||operation.lifecycle.status==="cancelled")throw new ApiError(409,"La operación no permite preparar una salida SAT.","INVALID_PACKAGE_SOURCE")
        if(id!==`satpkg-${sourceOperationId}`)throw new ApiError(400,"Identificador de paquete no válido.","INVALID_PACKAGE_SOURCE")
        payload=serverPackage(operation,company,actor,at)
      }
      const submission=isObject(payload.submission)?payload.submission:undefined,oldSubmission=isObject(oldPayload)&&isObject(oldPayload.submission)?oldPayload.submission:undefined
      if(payload.avisoPresentado===true||submission?.status==="presented"||payload.confirmationStatus==="presented"||payload.status==="presented"||payload.reviewStatus==="approved"||payload.reviewStatus==="rejected"){
        await requireCompany(actor,companyId,env,module==="operaciones"?"avisos":module,"approve")
        if(submission?.status==="presented"&&oldSubmission?.status!=="presented"&&!submission.reference)throw new ApiError(400,"Registra el folio de presentación.","SUBMISSION_REFERENCE_REQUIRED")
      }
      if(collection==="pld-submissions-workflow"&&!deleted){
        payload=await validateSubmission({id,payload,companyId,actor,env,mutations,changes,at})
        payload={...payload,revision:expected+1,createdAt:isObject(oldPayload)&&oldPayload.createdAt?oldPayload.createdAt:at,updatedAt:at}
      }
      if(collection==="actividades_vulnerables_operaciones"&&((submission?.status==="presented"&&oldSubmission?.status!=="presented")||((submission?.wasEverPresented===true||payload.avisoPresentado===true)&&oldSubmission?.wasEverPresented!==true))){
        const proof=mutations.some((candidate)=>isObject(candidate)&&candidate.deleted!==true&&candidate.collection==="pld-submissions-workflow"&&isObject(candidate.payload)&&candidate.payload.operationId===id&&candidate.payload.status==="presented"&&Number(candidate.payload.preparedOperationRevision)===expected&&Number(candidate.payload.sourceOperationRevision)===expected+1)
        if(!proof)throw new ApiError(400,"Registra la presentación desde Avisos e informes junto con su acuse.","ACK_REQUIRED")
        payload={...payload,submission:{...submission,presentedBy:actor.id}}
      }
      const flow=isObject(payload.workflow)?payload.workflow:undefined,oldFlow=isObject(oldPayload)&&isObject(oldPayload.workflow)?oldPayload.workflow:undefined
      if(flow?.status==="approved"||oldFlow?.status==="approved"){
        await requireCompany(actor,companyId,env,module,"approve")
        if(flow?.status==="approved")payload={...payload,workflow:{...flow,approvedBy:actor.id,approvedAt:at}}
      }
      if(collection==="ebr_evaluaciones"&&!legacyAssessment){
        if(!flow||!["draft","review","approved"].includes(String(flow.status)))throw new ApiError(400,"La evaluación debe conservar un estado de revisión explícito.","INVALID_ASSESSMENT")
        if(flow.status!=="draft"&&!isObject(payload.reviewPlan))throw new ApiError(400,"Programa la próxima revisión y los planes de seguimiento de la evaluación.","INVALID_ASSESSMENT")
        payload=await prepareEbrEvidence(payload,actor,companyId,env,at,isObject(oldPayload)?oldPayload:undefined)
        try{
          const derived=transitionEbrAssessment({status:flow.status as "draft"|"review"|"approved",canApprove:flow.status==="approved",actor:actor.id,at,
            clientAnswers:payload.clientAnswers as never,subjectAnswers:payload.subjectAnswers as never,
            beneficiaryAnswers:payload.hasBeneficiaryController?payload.beneficiaryAnswers as never:undefined,
            transactionalProfile:payload.transactionalProfile as never,controls:(Array.isArray(payload.controls)?payload.controls:[]) as never,
            methodologyAccepted:payload.methodologyAccepted===true,sources:(Array.isArray(payload.sources)?payload.sources:[]) as never,
            institutionalFactors:(Array.isArray(payload.institutionalFactors)?payload.institutionalFactors:undefined) as never,
            reviewPlan:payload.reviewPlan as never,
            previous:isObject(oldPayload)?oldPayload as never:undefined,pepStatus:isObject(payload.pepWhoisSnapshot)?String(payload.pepWhoisSnapshot.status):isObject(payload.pepScreening)?String(payload.pepScreening.status):undefined})
          payload={...payload,...derived}
        }catch(error){throw new ApiError(400,error instanceof Error?error.message:"Evaluación no válida.","INVALID_ASSESSMENT")}
      }
      if(collection==="ebr-institutional-assessment"){
        if(!flow||!["draft","review","approved"].includes(String(flow.status)))throw new ApiError(400,"La evaluación institucional debe conservar su estado de revisión.","INVALID_ASSESSMENT")
        payload=await prepareEbrEvidence(payload,actor,companyId,env,at,isObject(oldPayload)?oldPayload:undefined)
        try{
          const derived=transitionInstitutionalAssessment({status:flow.status as "draft"|"review"|"approved",canApprove:flow.status==="approved",actor:actor.id,at,
            institutionalFactors:(Array.isArray(payload.institutionalFactors)?payload.institutionalFactors:[]) as never,controls:(Array.isArray(payload.controls)?payload.controls:[]) as never,
            sources:(Array.isArray(payload.sources)?payload.sources:[]) as never,methodologyAccepted:payload.methodologyAccepted===true,reviewPlan:payload.reviewPlan as never,previous:isObject(oldPayload)?oldPayload as never:undefined})
          payload={...payload,...derived}
        }catch(error){throw new ApiError(400,error instanceof Error?error.message:"Evaluación institucional no válida.","INVALID_ASSESSMENT")}
      }
    }
    const guard=crypto.randomUUID()
    // The constraint lives inside the transaction: a concurrent writer aborts
    // the entire batch, including the audit event, instead of partially saving.
    statements.push(env.DB.prepare("INSERT INTO pld_revision_guard(id,valid) VALUES(?,CASE WHEN COALESCE((SELECT revision FROM pld_records WHERE companyId=? AND collection=? AND id=?),0)=? THEN 1 ELSE 0 END)").bind(guard,companyId,collection,id,expected))
    statements.push(env.DB.prepare("INSERT INTO pld_records(companyId,collection,id,revision,payload,deleted,createdAt,updatedAt,updatedBy) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(companyId,collection,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,deleted=excluded.deleted,updatedAt=excluded.updatedAt,updatedBy=excluded.updatedBy").bind(companyId,collection,id,expected+1,JSON.stringify(payload),deleted?1:0,at,at,actor.id))
    statements.push(env.DB.prepare("INSERT INTO pld_record_versions(companyId,collection,id,revision,payload,deleted,createdAt,actorId) VALUES(?,?,?,?,?,?,?,?)").bind(companyId,collection,id,expected+1,JSON.stringify(payload),deleted?1:0,at,actor.id))
    statements.push(env.DB.prepare("DELETE FROM pld_revision_guard WHERE id=?").bind(guard))
    statements.push(auditStatement(env,actor,deleted?"record.archived":"record.saved",collection,id,company.organizationId,companyId,{revision:expected+1}))
    changes.push({collection,id,revision:expected+1,payload,deleted})
  }
  if(historicalDifferences.length)statements.push(auditStatement(env,actor,"recalculation.historical_review_required","operaciones",companyId,company.organizationId,companyId,{operationIds:historicalDifferences}))
  try{await env.DB.batch([...referenceStatements,...statements])}catch(error){if(String(error).includes("CHECK constraint"))throw new ApiError(409,"El registro cambió en otra sesión.","REVISION_CONFLICT");throw error}
  const readable=new Set<string>()
  for(const moduleKey of new Set(changes.map((change)=>collectionModule(change.collection)))){try{await requireCompany(actor,companyId,env,moduleKey,"view");readable.add(moduleKey)}catch(error){if(!(error instanceof ApiError)||![403,404].includes(error.status))throw error}}
  return json({records:changes.filter((change)=>readable.has(collectionModule(change.collection))),...(historicalDifferences.length&&readable.has("operaciones")?{warnings:[{code:"PRESENTED_HISTORY_REVIEW_REQUIRED",operationIds:historicalDifferences,message:"Se conservaron los valores históricos presentados; sus diferencias de recálculo requieren revisión explícita."}]}:{})})
}
