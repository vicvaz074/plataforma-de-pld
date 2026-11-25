'use strict';
const object=p=>!!p&&typeof p==='object'&&!Array.isArray(p);
const has=(p,arr)=>arr.some(k=>!!p?.[k]);
const isArchived=p=>p?.archived===true||p?.archivado===true||['archived','archivado','cancelled'].includes(String(p?.status||p?.estado||'').toLowerCase());
const reserved=p=>p?.avisoPresentado===true||p?.submission?.wasEverPresented===true||p?.submission?.status==='presented'||p?.confirmationStatus==='presented'||p?.status==='presented'||['approved','rejected'].includes(p?.reviewStatus)||p?.workflow?.status==='approved';
const same=(x,y)=>JSON.stringify(x??null)===JSON.stringify(y??null);
const fields=new Set('name rfc nif curp personType activity date amount currency reference paymentInstrument exchangeRate exchangeRateDate exchangeRateSource clientId expedienteId'.split(' '));
const mappings=new Set(['pld-import-mappings','pld-import-mappings-registro','pld-import-mappings-expedientes','pld-import-mappings-evidencias']);
const editable=new Set(['registro-sat-data','kyc_expedientes_detalle','actividades_vulnerables_clientes','actividades_vulnerables_operaciones','ebr_evaluaciones','ebr-institutional-assessment','pld-training-module','auditoria-planes-accion','gobernanza-control-data',...mappings]);
const trainingKeys=new Set(['trainingPlan','employees','sessions','documents','officialCompliance','traceability','checklistAnswers','moduleClosed']);
const except=(o,keys)=>Object.fromEntries(Object.entries(o||{}).filter(([k])=>!keys.includes(k)).sort(([a],[b])=>a.localeCompare(b)));
function permittedDraft(collection,id,p,old){
  if(mappings.has(collection)){
    if(id!=='singleton'||!Array.isArray(p)||p.length>200||!p.every(r=>object(r)&&Object.keys(r).every(k=>['id','signature','name','mapping','createdAt'].includes(k))&&typeof r.id==='string'&&r.id.length>0&&typeof r.signature==='string'&&r.signature.length>0&&r.signature.length<=8192&&object(r.mapping)&&Object.entries(r.mapping).every(([k,v])=>fields.has(k)&&typeof v==='string'&&v.length<=300)))return false;
    const ids=new Set(p.map(r=>r.id)),signatures=new Set(p.map(r=>r.signature));
    return ids.size===p.length&&signatures.size===p.length&&(!old||(Array.isArray(old)&&old.every(r=>signatures.has(r.signature))));
  }
  if(!object(p)||old&&!object(old)||isArchived(p)||isArchived(old)||reserved(p)||reserved(old))return false;
  if(collection==='registro-sat-data'){
    const ordinary=['schemaVersion','tipoSujeto','identificacion','contactos','actividades','representante','datosChecklist','documentos','sujetosRegistrados','documentosRegistro'];
    const noDocs={detalle:null,acuse:null,aceptacion:null};
    if(id!=='singleton'||p.schemaVersion!==2||!object(p.identificacion)||!Array.isArray(p.contactos)||!Array.isArray(p.actividades)||!object(p.datosChecklist))return false;
    if(!Object.values(p.datosChecklist).every(r=>object(r)&&Object.keys(r).every(k=>['completed','notes'].includes(k))&&typeof r.notes==='string'&&(r.completed===undefined||typeof r.completed==='boolean')))return false;
    // These checklist booleans are derived, not registry acceptance. Alta only
    // restores the notes and reevaluates the checklist against its actual data.
    return same(except(p,ordinary),except(old,ordinary))&&same(p.documentos||[],old?.documentos||[])&&same(p.sujetosRegistrados||[],old?.sujetosRegistrados||[])&&
      same(except({...noDocs,...p.documentosRegistro},[]),except({...noDocs,...old?.documentosRegistro},[]))&&(!old?.sujetosRegistrados?.length||p.tipoSujeto===old.tipoSujeto);
  }
  if(collection==='auditoria-planes-accion'){
    const keys=['id','source','action','responsible','deadline','status','progress'];
    return p.id===id&&Object.keys(p).every(k=>keys.includes(k))&&['source','action','responsible'].every(k=>typeof p[k]==='string'&&p[k].trim())&&typeof p.deadline==='string'&&Number.isFinite(Date.parse(p.deadline))&&
      ['Pendiente','En seguimiento'].includes(p.status)&&Number.isFinite(p.progress)&&p.progress>=0&&p.progress<100&&(!old||['Pendiente','En seguimiento'].includes(old.status)&&old.progress<100);
  }
  if(collection==='gobernanza-control-data'){
    // Only amend notes/plans in the already-known questionnaire. Answers,
    // signatures, legal text, histories, evidence, sessions and closures stay untouched.
    return id==='singleton'&&p.expedienteCerrado===false&&old?.expedienteCerrado===false&&same(except(p,['questions']),except(old,['questions']))&&Array.isArray(p.questions)&&p.questions.length===old.questions?.length&&
      p.questions.every((r,i)=>object(r)&&object(old.questions[i])&&same(except(r,['notes','actionPlan']),except(old.questions[i],['notes','actionPlan']))&&['notes','actionPlan'].every(k=>r[k]===undefined||typeof r[k]==='string'));
  }
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
