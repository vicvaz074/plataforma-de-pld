'use strict';
const object=p=>!!p&&typeof p==='object'&&!Array.isArray(p);
const has=(p,arr)=>arr.some(k=>!!p?.[k]);
const isArchived=p=>p?.archived===true||p?.archivado===true||['archived','archivado','cancelled'].includes(String(p?.status||p?.estado||'').toLowerCase());
const reserved=p=>p?.avisoPresentado===true||p?.submission?.wasEverPresented===true||p?.submission?.status==='presented'||p?.confirmationStatus==='presented'||p?.status==='presented'||['approved','rejected'].includes(p?.reviewStatus)||p?.workflow?.status==='approved';
const same=(x,y)=>JSON.stringify(x??null)===JSON.stringify(y??null);
const fields=new Set('name rfc nif curp personType activity date amount currency reference paymentInstrument exchangeRate exchangeRateDate exchangeRateSource clientId expedienteId'.split(' '));
const mappings=new Set(['pld-import-mappings','pld-import-mappings-registro','pld-import-mappings-expedientes','pld-import-mappings-evidencias']);
const editable=new Set(['kyc_expedientes_detalle','actividades_vulnerables_clientes','actividades_vulnerables_operaciones','ebr_evaluaciones','ebr-institutional-assessment','pld-training-module',...mappings]);
const trainingKeys=new Set(['trainingPlan','employees','sessions','documents','officialCompliance','traceability','checklistAnswers','moduleClosed']);
function permittedDraft(collection,id,p,old){
  if(mappings.has(collection)){
    if(id!=='singleton'||!Array.isArray(p)||p.length>200||!p.every(r=>object(r)&&Object.keys(r).every(k=>['id','signature','name','mapping','createdAt'].includes(k))&&typeof r.id==='string'&&r.id.length>0&&typeof r.signature==='string'&&r.signature.length>0&&r.signature.length<=8192&&object(r.mapping)&&Object.entries(r.mapping).every(([k,v])=>fields.has(k)&&typeof v==='string'&&v.length<=300)))return false;
    const ids=new Set(p.map(r=>r.id)),signatures=new Set(p.map(r=>r.signature));
    return ids.size===p.length&&signatures.size===p.length&&(!old||(Array.isArray(old)&&old.every(r=>signatures.has(r.signature))));
  }
  if(!object(p)||old&&!object(old)||isArchived(p)||isArchived(old)||reserved(p)||reserved(old))return false;
  if(collection==='actividades_vulnerables_operaciones'){
    const draft=v=>v.captureStatus==='draft'&&!v.avisoPresentado&&!v.submission?.wasEverPresented&&!['presented','correction-pending','cancelled'].includes(v.submission?.status)&&(!v.lifecycle?.status||v.lifecycle.status==='active');
    return p.id===id&&Number.isSafeInteger(p.montoCentavos)&&p.montoCentavos>=0&&(p.monto===undefined||p.monto===p.montoCentavos/100)&&draft(p)&&(!old||draft(old));
  }
  if(collection==='ebr_evaluaciones'||collection==='ebr-institutional-assessment'){
    const draft=v=>object(v.workflow)&&v.workflow.status==='draft'&&!has(v.workflow,['approvedAt','approvedBy'])&&!v.needsMigrationReview;
    return (collection!=='ebr_evaluaciones'||p.schemaVersion===3)&&draft(p)&&(!old||draft(old));
  }
  if(collection==='pld-training-module'){
    const previous=old||{},plan=p.trainingPlan||{},priorPlan=previous.trainingPlan||{};
    if(id!=='singleton'||p.moduleClosed!==false||previous.moduleClosed===true||Object.keys(p).some(k=>!trainingKeys.has(k)))return false;
    // No uploading, deleting or changing a documentary/approval record through an edit grant.
    if(!same(p.documents||[],previous.documents||[])||!same(plan.approvedBy||'',priorPlan.approvedBy||'')||!same(plan.approvalDate||'',priorPlan.approvalDate||''))return false;
    if(priorPlan.approvedBy&&!same(priorPlan,plan))return false;
    for(const key of ['employees','sessions','traceability']){
      if(!Array.isArray(p[key])||!p[key].every(row=>object(row)&&typeof row.id==='string'&&row.id.length))return false;
      const next=new Map(p[key].map(row=>[row.id,row]));
      if(next.size!==p[key].length||!(previous[key]||[]).every(row=>next.has(row.id)&&(key!=='traceability'||same(next.get(row.id),row))))return false;
    }
    return !p.traceability.some(r=>!(previous.traceability||[]).some(o=>o.id===r.id)&&/aproba|aprobó|cierre|cerrad|archiv|rechaz/i.test(r.action));
  }
  return ['kyc_expedientes_detalle','actividades_vulnerables_clientes'].includes(collection);
}
module.exports={editable,permittedDraft};
