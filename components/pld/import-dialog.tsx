"use client"

import { useState } from "react"
import { FileUp, FileSpreadsheet, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { SearchableSelect } from "@/components/pld/searchable-select"
import { ACTIVIDADES_VULNERABLES_ARTICULO_17 } from "@/lib/pld/actividades"
import { buildExpedienteFromActo } from "@/lib/pld/integration-records"
import { loadStoredPldOperations, type StoredPldOperationV3 } from "@/lib/pld/stored-operations"
import { getActiveCompany, getModuleStorage, getPilotSession, uploadPilotFile, flushModuleStorage, isCloudConnected, canWriteModuleStorage } from "@/lib/pilot/module-storage"
import { pilotApi,jsonRequest } from "@/lib/pilot/api"
import { sessionCan, type ModuleKey } from "@/lib/pilot/contracts"
import type { SatXlsmLayout } from "@/lib/pld/types"
import { getImportSatTemplates, IMPORT_LIMITS, mergeImportedOperations, nativePdfSuggestions, parseOperationImport,readOperationImportWorkbook, type ImportColumnMapping, type OperationImportPreview } from "@/lib/pld/import-operations"
import { identifySatImportWorkbook } from "@/lib/pld/sat-import-fingerprint"
import { IMPORT_CLIENT_LINK_MISSING,applyMappedImportClients,readImportClientTargets,requireImportClientResolution,resolveImportRowClient,type ImportClientDecision,type ImportClientTarget,type ProvisionalImportClient } from "@/lib/pld/import-client-resolution"

export interface PldImportDialogProps {
  destination: "operations" | "expedientes" | "registro" | "evidence";
  onComplete?: () => void; triggerLabel?: string; activityKey?: string;
}
const modules: Record<PldImportDialogProps["destination"], ModuleKey> = {operations:"operaciones",expedientes:"expedientes",registro:"registro",evidence:"evidencias"}
const mappingLabels: Record<keyof ImportColumnMapping,string> = {
  name:"Cliente / razón social", rfc:"RFC", nif:"NIF",curp:"CURP",personType:"Tipo de persona",activity:"Actividad (clave exacta)",
  date:"Fecha de operación",amount:"Importe",currency:"Moneda",reference:"Referencia",paymentInstrument:"Instrumento monetario",
  exchangeRate:"Tipo de cambio",exchangeRateDate:"Fecha del tipo de cambio",exchangeRateSource:"Fuente del tipo de cambio",
  clientId:"ID estable del cliente",expedienteId:"ID estable del expediente",
}

function readArray<T>(key: string): T[] {
  const raw = getModuleStorage().getItem(key)
  if (!raw) return []
  const parsed:unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error(`No se puede leer ${key}; revisa el respaldo antes de importar.`)
  return parsed as T[]
}

export function PldImportDialog({ destination, onComplete, triggerLabel="Importar", activityKey:initialActivity }: PldImportDialogProps) {
  const {toast}=useToast()
  const [open,setOpen]=useState(false),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false)
  const [activityKey,setActivityKey]=useState(initialActivity||"")
  const [templateId,setTemplateId]=useState("")
  const [preview,setPreview]=useState<OperationImportPreview|null>(null),[mapping,setMapping]=useState<ImportColumnMapping>({})
  const [selected,setSelected]=useState<string[]>([]),[allowDrafts,setAllowDrafts]=useState(true)
  const [pages,setPages]=useState<ReturnType<typeof nativePdfSuggestions>>([])
  const [documentFields,setDocumentFields]=useState({name:"",rfc:"",date:"",postalCode:"",email:""})
  const [error,setError]=useState("")
  const [uploadedSource,setUploadedSource]=useState<Awaited<ReturnType<typeof uploadPilotFile>>|null>(null)
  const [jobProgress,setJobProgress]=useState("")
  const [clientTargets,setClientTargets]=useState<ImportClientTarget[]>([]),[provisionalClients,setProvisionalClients]=useState<ProvisionalImportClient[]>([])
  const [bulkClient,setBulkClient]=useState(""),[newClientName,setNewClientName]=useState("")
  const moduleKey=modules[destination]
  const historyKey=destination==="operations"?"pld-import-history":`pld-import-history-${moduleKey}`
  const mappingsKey=destination==="operations"?"pld-import-mappings":`pld-import-mappings-${moduleKey}`
  const company=getActiveCompany(),session=getPilotSession()
  const permitted=!isCloudConnected()||sessionCan(session,company,moduleKey,"upload")&&sessionCan(session,company,moduleKey,"edit")
  const applyPreview=(result:OperationImportPreview)=>{
    if(destination==="operations"){
      const targets=readImportClientTargets(getModuleStorage(),loadStoredPldOperations(getModuleStorage(),{persistMigration:false}).operations);setClientTargets(targets)
      result={...result,rows:applyMappedImportClients(requireImportClientResolution(result.rows),targets)}
      if(preview?.fileHash===result.fileHash)result={...result,rows:result.rows.map((row)=>{const previous=preview.rows.find((item)=>item.id===row.id)?.operation.importClientResolution as ImportClientDecision|undefined;if(!previous)return row;try{return resolveImportRowClient(row,previous,targets)}catch{return row}})}
      else{setProvisionalClients([]);setBulkClient("");setNewClientName(result.rows[0]?.operation.cliente||"")}
    }
    else result={...result,rows:result.rows.map((row)=>{if(row.status==="duplicate"||row.status==="rejected")return row;const issues=row.issues.filter((issue)=>issue!==IMPORT_CLIENT_LINK_MISSING);return {...row,issues,status:issues.length?"incomplete":"valid"}})}
    // Jobs retain an immutable preview. A retry may retrieve that preview after
    // its candidates were saved, so compare stable IDs with today's collection.
    if(destination==="operations"){
      const stored=loadStoredPldOperations(getModuleStorage(),{persistMigration:false})
      if(stored.parseError||stored.discardedCount||stored.duplicateIds.length)throw new Error("Hay operaciones ilegibles; resuélvelas antes de importar.")
      const existingIds=new Set(stored.operations.map((operation)=>operation.id))
      result={...result,rows:result.rows.map((row)=>existingIds.has(row.id)?{...row,status:"duplicate",issues:[...row.issues,"Esta fila ya fue importada en la empresa activa."]}:row)}
    }
    setPreview(result);setMapping(result.mapping);setSelected(result.rows.filter((row)=>row.status!=="duplicate"&&row.status!=="rejected").map((row)=>row.id))
    if(result.templateId)setTemplateId(result.templateId)
    const activities=[...new Set(result.rows.map((row)=>row.operation.actividadKey).filter(Boolean))]
    if(activities.length===1)setActivityKey(activities[0])
    if(destination==="registro"){
      const match=result.rows.find((row)=>row.operation.rfc===company?.rfc)||(result.rows.length===1?result.rows[0]:undefined)
      setDocumentFields({name:match?.operation.cliente||"",rfc:match?.operation.rfc||"",date:match?.operation.fechaOperacion||"",postalCode:"",email:""})
    }
  }
  const clientOptions=[...clientTargets,...provisionalClients.map((client)=>({...client,kind:"client" as const}))].map((client)=>({value:`${client.kind}:${client.id}`,label:`${client.nombre} · ${client.identifiers.rfc||client.identifiers.curp||client.identifiers.nif||"Sin identificador"} · ${client.kind==="expediente"?"EUI":"Cliente"} ${client.id.slice(-8)}`}))
  const decisionFor=(value:string):ImportClientDecision=>{
    const split=value.indexOf(":"),kind=value.slice(0,split),id=value.slice(split+1),provisional=provisionalClients.find((client)=>client.id===id)
    if(provisional)return {kind:"provisional",id,client:provisional}
    if(kind!=="client"&&kind!=="expediente")throw new Error("Selecciona un vínculo de cliente válido.")
    return {kind,id}
  }
  const assignClients=(decision:ImportClientDecision,ids:string[])=>{
    if(!preview)return
    try{setError("");const rows=preview.rows.map((row)=>ids.includes(row.id)?resolveImportRowClient(row,decision,clientTargets):row);setPreview({...preview,rows})}catch(reason){setError(reason instanceof Error?reason.message:"No se pudo vincular el cliente.")}
  }

  const inspect=async(candidate:File, nextMapping?:ImportColumnMapping)=>{
    setBusy(true);setError("");setPreview(null);setPages([]);setJobProgress("");setDocumentFields({name:"",rfc:"",date:"",postalCode:"",email:""})
    try {
      if (candidate.size > IMPORT_LIMITS.bytes) throw new Error("El límite por archivo es 10 MB.")
      if (/\.pdf$/i.test(candidate.name)) {
        const pdfjs=await import("pdfjs-dist")
        pdfjs.GlobalWorkerOptions.workerSrc="/pdf.worker.min.mjs"
        const document=await pdfjs.getDocument({data:new Uint8Array(await candidate.arrayBuffer()),isEvalSupported:false}).promise
        if(document.numPages>IMPORT_LIMITS.pages){await document.destroy();throw new Error("Divide el PDF en documentos de hasta 50 páginas.")}
        const extracted:Array<{page:number;text:string}>=[]
        try{for(let number=1;number<=document.numPages;number++){const page=await document.getPage(number);const content=await page.getTextContent();extracted.push({page:number,text:content.items.map((item)=>"str" in item?item.str:"").join(" ")});page.cleanup()}}finally{await document.destroy()}
        if(!extracted.some((page)=>page.text.trim())) throw new Error("Este PDF no contiene texto seleccionable. Se requiere OCR o captura manual; no se inventaron datos.")
        const suggestions=nativePdfSuggestions(extracted);setPages(suggestions)
        const allText=extracted.map((page)=>page.text).join(" ")
        setDocumentFields({name:/(?:DENOMINACI[OÓ]N|RAZ[OÓ]N SOCIAL|NOMBRE(?: COMPLETO)?)\s*[:\-]\s*([^\n]{3,120}?)(?=\s+(?:RFC|CURP|DOMICILIO|FECHA|C[OÓ]DIGO)|$)/i.exec(allText)?.[1]?.trim()||"",rfc:suggestions.find((page)=>page.rfc)?.rfc||"",date:suggestions.find((page)=>page.date)?.date||"",postalCode:/(?:C[OÓ]DIGO POSTAL|C\.?P\.?)\s*[:\-]?\s*(\d{5})/i.exec(allText)?.[1]||"",email:/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(allText)?.[0]||""})
        return
      }
      if(!company)throw new Error("Selecciona una empresa antes de importar operaciones.")
      if(isCloudConnected()&&destination==="operations"&&!nextMapping&&!templateId){
        setJobProgress("Conservando el archivo original…")
        const source=await uploadPilotFile(candidate,moduleKey);setUploadedSource(source)
        const job=await pilotApi<{id:string;status:string}>(`/companies/${company.id}/imports`,jsonRequest("POST",{fileVersionId:source.id,idempotencyKey:source.sha256,activityKey,moduleKey}))
        for(let attempt=0;attempt<60;attempt++){
          const status=await pilotApi<{status:string;error?:string}>(`/companies/${company.id}/imports/${job.id}`)
          setJobProgress(status.status==="ready"?"Lectura terminada":`Procesando en servidor · ${attempt+1}`)
          if(status.status==="failed")throw new Error(status.error||"El trabajo de importación falló. El original se conserva.")
          if(status.status==="ready"||status.status==="completed"){
            const result=await pilotApi<OperationImportPreview>(`/companies/${company.id}/imports/${job.id}/preview`)
            applyPreview(result);return
          }
          await new Promise((resolve)=>setTimeout(resolve,1000))
        }
        throw new Error("La lectura continúa en servidor. Vuelve a analizar el archivo para recuperar el resultado; no se guardaron operaciones automáticamente.")
      }
      const bytes=new Uint8Array(await candidate.arrayBuffer())
      let known=getImportSatTemplates().find((template)=>templateId ? template.templateId===templateId && template.actividadKeys.includes(activityKey) : template.officialXlsmName.toLowerCase()===candidate.name.toLowerCase()||template.officialXlsmName.replace(/\.xlsm$/i,".xlsx").toLowerCase()===candidate.name.toLowerCase())
      const recognitionWarnings:string[]=[]
      if(!known&&!templateId&&!/\.csv$/i.test(candidate.name)){
        const identified=identifySatImportWorkbook(readOperationImportWorkbook(bytes,candidate.name))
        if(identified.status==="ambiguous")throw new Error("La estructura coincide con varios formatos SAT. Selecciona la actividad y el formato exactos antes de volver a analizar.")
        if(identified.status==="recognized"){
          known=getImportSatTemplates().find((template)=>template.templateId===identified.templateIds[0])
          recognitionWarnings.push(...identified.evidence,"Identificación por estructura y etiquetas fijas; no acredita autenticidad ni aceptación del SAT.")
        }
      }
      let effectiveActivity=activityKey
      if(known&&!known.actividadKeys.includes(effectiveActivity)){
        if(known.actividadKeys.length!==1)throw new Error("Este formato admite varias actividades. Selecciona la fracción o subactividad exacta antes de analizar.")
        effectiveActivity=known.actividadKeys[0];setActivityKey(effectiveActivity)
        recognitionWarnings.push("La actividad se vinculó a la única clave exacta del formato oficial detectado.")
      }
      if(known)setTemplateId(known.templateId)
      const layouts:SatXlsmLayout[]=[]
      if(known){const response=await fetch(`/data/sat-xlsm-layouts/${known.templateId}.json`);if(!response.ok)throw new Error("No se pudo cargar la estructura SAT de este libro.");layouts.push(await response.json())}
      const result=await parseOperationImport({bytes,fileName:candidate.name,context:{companyId:company.id,companyName:company.name,companyRfc:company.rfc,actor:session?.user.id||"Usuario local",activityKey:effectiveActivity},existing:loadStoredPldOperations(getModuleStorage(),{persistMigration:false}).operations,mapping:nextMapping,layouts,templateId:known?.templateId||templateId||undefined})
      result.warnings.push(...recognitionWarnings)
      applyPreview(result)
    }catch(reason){setError(reason instanceof Error?reason.message:"No se pudo leer el archivo.")}finally{setBusy(false)}
  }

  const save=async()=>{
    if(!file||!permitted)return
    setBusy(true);setError("")
    try{
      if(!company)throw new Error("Selecciona una empresa conectada antes de guardar.")
      const currentSession=getPilotSession()
      if(!currentSession||!sessionCan(currentSession,company,moduleKey,"edit")||!sessionCan(currentSession,company,moduleKey,"upload"))throw new Error("Tu acceso a esta empresa cambió. Vuelve a cargar la página.")
      const storage=getModuleStorage()
      const source=uploadedSource||await uploadPilotFile(file,moduleKey)
      const now=new Date().toISOString()
      let added=0
      if(destination==="operations"){
        if(!preview)throw new Error("Para importar operaciones utiliza un Excel o CSV; los PDF se incorporan como evidencia.")
        const latest=loadStoredPldOperations(storage,{persistMigration:false})
        if(latest.parseError||latest.discardedCount||latest.duplicateIds.length)throw new Error("El almacenamiento contiene registros por revisar. Resuélvelos antes de importar.")
        const merged=mergeImportedOperations(latest.operations,preview.rows,selected,allowDrafts)
        for(const operation of merged.operations)if(selected.includes(operation.id)&&!latest.operations.some((old)=>old.id===operation.id)){
          const record=operation as unknown as StoredPldOperationV3
          record.importSource={...(record.importSource as Record<string,unknown>),fileVersionId:source.id,downloadUrl:source.downloadUrl}
          record.documentosSoporte=[{id:`${operation.id}-source`,requisito:"Archivo original de importación",notas:"Original conservado para trazabilidad; no sustituye documentos de identificación.",archivoNombre:file.name,archivoContenido:source.downloadUrl,fechaRegistro:now}]
        }
        if(!merged.added)throw new Error("No hay filas nuevas seleccionadas para guardar.")
        storage.setItem("actividades_vulnerables_operaciones",JSON.stringify(merged.operations));added=merged.added
      }else if(destination==="expedientes"){
        const existing=readArray<Record<string,any>>("kyc_expedientes_detalle")
        const rows=preview?preview.rows.filter((row)=>selected.includes(row.id)&&row.status!=="duplicate"&&row.status!=="rejected"&&(allowDrafts||row.status==="valid")).map((row)=>({id:`eui-${row.id}`,name:row.operation.cliente,rfc:row.operation.rfc,tipo:row.operation.tipoCliente,date:row.operation.fechaOperacion,identifiers:row.operation.expedienteIdentifiers as Record<string,string>})):[{id:`eui-import-${source.sha256.slice(0,24)}`,name:documentFields.name,rfc:documentFields.rfc,tipo:documentFields.rfc.length===12?"pm_mexicana":"pf_residente",date:documentFields.date,identifiers:{rfc:documentFields.rfc}}]
        for(const row of rows){if(existing.some((item)=>item.expedienteId===row.id))continue;if(!row.name.trim())throw new Error("Revisa el nombre o denominación antes de guardar el expediente.")
          const moral=row.tipo.startsWith("pm")
          existing.push(buildExpedienteFromActo({expedienteId:row.id,tipoCliente:row.tipo,activityKey,documentos:[{id:source.id,name:file.name,dataUrl:source.downloadUrl,uploadDate:now}],sujetoObligadoId:company.id,sujetoObligadoRfc:company.rfc,sujetoObligadoNombre:company.name,importSource:{fileVersionId:source.id,fileHash:source.sha256,pageReferences:pages.map((page)=>({page:page.page,rfc:page.rfc,date:page.date})),reviewedFields:pages.length?documentFields:undefined},captureStatus:"draft"},{expedienteId:row.id,identifiers:row.identifiers,persona:{id:`persona-${row.id}`,tipo:moral?"persona_moral":"persona_fisica",...(moral?{denominacion:row.name}:{nombre:row.name}),rfc:row.rfc,pais:"",contacto:{correo:documentFields.email},domicilio:{codigoPostal:documentFields.postalCode}},beneficiariosControladores:[],operationContext:{fechaActoOperacion:row.date||""},updatedAt:now}));added++}
        if(!added)throw new Error("No hay expedientes nuevos seleccionados para guardar.")
        storage.setItem("kyc_expedientes_detalle",JSON.stringify(existing))
      }else if(destination==="registro"){
        const raw=storage.getItem("registro-sat-data"), current=raw?JSON.parse(raw):{}
        if(!current||typeof current!=="object"||Array.isArray(current))throw new Error("El registro SAT necesita revisión antes de importar.")
        if(documentFields.rfc&&documentFields.rfc.toUpperCase().trim()!==company.rfc)throw new Error("El RFC extraído no coincide con la empresa activa.")
        const identification={...(current.identificacion||{})}
        if(documentFields.rfc&&!identification.rfc)identification.rfc=documentFields.rfc
        if(documentFields.name&&!identification.nombre)identification.nombre=documentFields.name
        storage.setItem("registro-sat-data",JSON.stringify({...current,identificacion:identification,documentos:[...(Array.isArray(current.documentos)?current.documentos:[]),{id:source.id,name:file.name,dataUrl:source.downloadUrl,mimeType:file.type,uploadDate:now}],importSuggestions:{...documentFields,pages:pages.map((page)=>({page:page.page,rfc:page.rfc,date:page.date})),sourceFileId:source.id}}));added=1
      }else{
        const documents=readArray<Record<string,unknown>>("pld-evidences-documents")
        documents.push({id:source.documentId,module:"kyc",submodule:"importacion",documentType:"documento-importado",title:file.name,notes:"Original importado. Revisión documental pendiente.",uploadDate:now,documentDate:documentFields.date,user:currentSession.user.name,fileName:file.name,fileType:file.type,fileSize:file.size,fileData:source.downloadUrl,sha256:source.sha256,version:source.version,versionHistory:[],archived:false,source:"manual",sourceId:source.id,reviewStatus:"pending"})
        storage.setItem("pld-evidences-documents",JSON.stringify(documents));added=1
      }
      if(canWriteModuleStorage(historyKey)){const history=readArray<Record<string,unknown>>(historyKey);storage.setItem(historyKey,JSON.stringify([...history,{id:crypto.randomUUID(),fileName:file.name,fileHash:source.sha256,fileVersionId:source.id,destination,createdAt:now,actorId:currentSession.user.id,added}]))}
      await flushModuleStorage();onComplete?.();setOpen(false);setPreview(null);setFile(null);setPages([]);setUploadedSource(null)
      toast({title:"Importación guardada",description:`${added} registro(s). Los datos incompletos quedan como borradores.`})
      window.dispatchEvent(new CustomEvent("pld-integration-change"))
    }catch(reason){setError(reason instanceof Error?reason.message:"No se pudo guardar la importación.")}finally{setBusy(false)}
  }

  const downloadTemplate=async()=>{
    const XLSX=await import("xlsx")
    const sheet=XLSX.utils.aoa_to_sheet([["cliente","rfc","nif","curp","tipoCliente","actividadKey","fechaOperacion","monto","moneda","instrumentoMonetario","referencia","tipoCambio","fechaTipoCambio","fuenteTipoCambio","clienteId","expedienteId"]])
    const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,sheet,"Operaciones");XLSX.writeFile(workbook,"plantilla-importacion-operaciones.xlsx")
  }

  return <Dialog open={open} onOpenChange={(value)=>{if(!busy)setOpen(value)}}><DialogTrigger asChild><Button variant="outline" className="rounded-xl" disabled={!permitted}><FileUp className="mr-2 h-4 w-4"/>{triggerLabel}</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl"><DialogHeader><DialogTitle>Importar {destination==="operations"?"operaciones":destination==="expedientes"?"expedientes":destination==="registro"?"datos del registro":"evidencia"}</DialogTitle><DialogDescription>Selecciona el archivo, revisa el resumen y guarda. Excel y PDF con texto, hasta 10 MB.</DialogDescription></DialogHeader>
      <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="pld-import-file">Archivo</Label><Input id="pld-import-file" type="file" accept=".xlsx,.xlsm,.csv,.pdf" disabled={busy} onChange={(event)=>{const candidate=event.target.files?.[0];if(candidate){setFile(candidate);setUploadedSource(null);void inspect(candidate)}}}/></div><div className="space-y-2"><Label>Actividad aplicable</Label><SearchableSelect ariaLabel="Actividad de importación" value={activityKey} onChange={(value)=>{setActivityKey(value);setPreview(null);setTemplateId("")}} options={ACTIVIDADES_VULNERABLES_ARTICULO_17.map((activity)=>({value:activity.key,label:`${activity.fraccion} · ${activity.nombre}`}))} placeholder="Selecciona actividad" searchPlaceholder="Buscar actividad"/></div></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={downloadTemplate}><FileSpreadsheet className="mr-2 h-4 w-4"/>Plantilla tabular</Button>{file&&<Button variant="outline" disabled={busy} onClick={()=>inspect(file,mapping)}>Volver a analizar</Button>}</div>
      {activityKey&&<div className="space-y-2"><Label>Formato SAT (para un libro renombrado)</Label><Select value={templateId||"_tabular"} onValueChange={(value)=>{setTemplateId(value==="_tabular"?"":value);setPreview(null)}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="_tabular">Detectar por nombre o tabla</SelectItem>{getImportSatTemplates().filter((template)=>template.actividadKeys.includes(activityKey)).map((template)=><SelectItem key={template.templateId} value={template.templateId}>{template.nombre}</SelectItem>)}</SelectContent></Select></div>}
      {busy&&<p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin"/>{jobProgress||"Procesando archivo…"}</p>}
      {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {preview&&<><div className="flex flex-wrap gap-3 rounded-xl bg-slate-50 p-3 text-sm">{(["valid","incomplete","duplicate","rejected"] as const).map((status)=><span key={status}>{({valid:"Válidos",incomplete:"Pendientes",duplicate:"Duplicados",rejected:"Rechazados"})[status]}: {preview.rows.filter((row)=>row.status===status).length}</span>)}</div>
        {destination==="operations"&&<div className="space-y-3 rounded-xl border p-3">
          <p className="text-sm font-medium">Vincular cliente antes de completar</p><p className="text-xs text-muted-foreground">La acumulación usa este ID estable, no coincidencias de RFC. Reutiliza el mismo cliente para sus operaciones; los vínculos sin resolver sólo pueden guardarse como borradores.</p>
          <div className="flex flex-wrap gap-2"><div className="min-w-64 flex-1"><SearchableSelect ariaLabel="Cliente para filas seleccionadas" value={bulkClient} onChange={setBulkClient} options={clientOptions} placeholder="Elegir cliente o expediente existente" searchPlaceholder="Buscar cliente, identificador o ID"/></div><Button variant="outline" disabled={!bulkClient||!selected.length} onClick={()=>{try{assignClients(decisionFor(bulkClient),selected)}catch(reason){setError(reason instanceof Error?reason.message:"Revisa el cliente")}}}>Asignar a seleccionadas</Button></div>
          <div className="flex flex-wrap gap-2"><Input aria-label="Nombre del nuevo grupo de cliente" className="min-w-64 flex-1" placeholder="Nombre del cliente o grupo provisional" value={newClientName} onChange={(event)=>setNewClientName(event.target.value)}/><Button variant="outline" disabled={!newClientName.trim()||!selected.length} onClick={()=>{
            try{const first=preview.rows.find((row)=>selected.includes(row.id)&&row.status!=="duplicate"&&row.status!=="rejected");if(!first)throw new Error("Selecciona al menos una fila nueva.");const id=crypto.randomUUID(),client:ProvisionalImportClient={id,nombre:newClientName.trim(),rfc:first.operation.rfc,identifiers:(first.operation.expedienteIdentifiers||first.operation.identifiers||{rfc:first.operation.rfc}) as ProvisionalImportClient["identifiers"],tipoCliente:first.operation.tipoCliente};const decision:ImportClientDecision={kind:"provisional",id,client};const rows=preview.rows.map((row)=>selected.includes(row.id)?resolveImportRowClient(row,decision,clientTargets):row);setProvisionalClients((old)=>[...old,client]);setPreview({...preview,rows});setBulkClient(`client:${id}`);setError("")}
            catch(reason){setError(reason instanceof Error?reason.message:"No se pudo crear el grupo provisional.")}
          }}>Crear grupo y asignar</Button></div>
        </div>}
        {preview.headers.length>0&&<details className="rounded-xl border p-3"><summary className="cursor-pointer text-sm font-medium">Asignar columnas</summary><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(Object.keys(mappingLabels) as Array<keyof ImportColumnMapping>).map((key)=><div className="space-y-1" key={key}><Label>{mappingLabels[key]}</Label><Select value={mapping[key]||"_none"} onValueChange={(value)=>setMapping((previous)=>({...previous,[key]:value==="_none"?undefined:value}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="_none">Sin asignar</SelectItem>{preview.headers.filter(Boolean).map((header)=><SelectItem key={header} value={header}>{header}</SelectItem>)}</SelectContent></Select></div>)}</div><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={()=>file&&inspect(file,mapping)}>Aplicar columnas</Button><Button variant="outline" disabled={!canWriteModuleStorage(mappingsKey)} onClick={async()=>{try{const stored=readArray<Record<string,unknown>>(mappingsKey);getModuleStorage().setItem(mappingsKey,JSON.stringify([...stored.filter((item)=>item.signature!==preview.headers.join("|")),{id:crypto.randomUUID(),signature:preview.headers.join("|"),name:file?.name,mapping,createdAt:new Date().toISOString()}]));await flushModuleStorage();toast({title:"Asignación de columnas guardada"})}catch(reason){setError(reason instanceof Error?reason.message:"No se pudo guardar")}}}>Guardar asignación</Button><Button variant="outline" onClick={()=>{try{const stored=readArray<{signature?:string;mapping?:ImportColumnMapping}>(mappingsKey).find((item)=>item.signature===preview.headers.join("|"));if(!stored?.mapping)throw new Error("No hay una asignación guardada para estos encabezados.");setMapping(stored.mapping);if(file)void inspect(file,stored.mapping)}catch(reason){setError(reason instanceof Error?reason.message:"No se pudo recuperar")}}}>Usar asignación guardada</Button></div></details>}
        <div className="max-h-80 overflow-auto rounded-xl border"><table className="min-w-[900px] w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-50"><tr><th className="p-3">Guardar</th><th>Cliente capturado</th>{destination==="operations"&&<th>Vínculo estable</th>}<th>Actividad</th><th>Monto</th><th>Estado / pendientes</th></tr></thead>
          <tbody>{preview.rows.map((row)=>{const decision=row.operation.importClientResolution as ImportClientDecision|undefined;return <tr className="border-t" key={row.id}>
            <td className="p-3"><Checkbox aria-label={`Seleccionar fila ${row.rowNumber}`} disabled={row.status==="duplicate"||row.status==="rejected"} checked={selected.includes(row.id)} onCheckedChange={(checked)=>setSelected((old)=>checked?[...old,row.id]:old.filter((id)=>id!==row.id))}/></td>
            <td className="p-2">{row.operation.cliente||"Sin nombre"}<span className="block text-xs text-muted-foreground">Fila {row.rowNumber} · {row.operation.rfc||String((row.operation.expedienteIdentifiers as Record<string,string>|undefined)?.nif||(row.operation.expedienteIdentifiers as Record<string,string>|undefined)?.curp||"Sin identificador")}</span></td>
            {destination==="operations"&&<td className="min-w-64 max-w-72 p-2"><SearchableSelect ariaLabel={`Cliente de la fila ${row.rowNumber}`} value={decision?`${decision.kind==="expediente"?"expediente":"client"}:${decision.id}`:""} onChange={(value)=>{try{assignClients(decisionFor(value),[row.id])}catch(reason){setError(reason instanceof Error?reason.message:"Revisa el cliente.")}}} options={clientOptions} placeholder={row.status==="duplicate"?"Ya importada":"Pendiente de vincular"} searchPlaceholder="Buscar cliente o expediente" disabled={row.status==="duplicate"||row.status==="rejected"}/></td>}
            <td className="max-w-44 p-2">{row.operation.actividadNombre}</td><td className="p-2">{row.operation.finance?.originalAmount||row.operation.monto} {row.operation.moneda}</td>
            <td className="max-w-sm p-2"><span>{({valid:"Válido",incomplete:"Borrador",duplicate:"Duplicado",rejected:"Rechazado"})[row.status]}</span>{row.issues.length>0&&<details className="text-xs text-muted-foreground"><summary>{row.issues.length} pendiente(s)</summary>{row.issues.map((issue,index)=><p key={index}>{issue}</p>)}</details>}</td>
          </tr>})}</tbody>
        </table></div>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={allowDrafts} onCheckedChange={(checked)=>setAllowDrafts(checked===true)}/>Conservar las filas incompletas como borradores</label>{preview.warnings.map((warning)=><p className="text-xs text-muted-foreground" key={warning}>{warning}</p>)}</>}
      {(pages.length>0||destination==="registro"&&preview)&&<><div className="grid gap-3 sm:grid-cols-2">{([{key:"name",label:"Nombre o denominación"},{key:"rfc",label:"RFC detectado"},{key:"date",label:"Fecha"},{key:"postalCode",label:"Código postal"},{key:"email",label:"Correo"}] as const).map((item)=><div key={item.key} className="space-y-1"><Label htmlFor={`pld-import-${item.key}`}>{item.label}</Label><Input id={`pld-import-${item.key}`} value={documentFields[item.key]} onChange={(event)=>setDocumentFields((old)=>({...old,[item.key]:event.target.value}))}/></div>)}</div>{pages.length>0&&<details className="rounded-xl border p-3"><summary className="cursor-pointer text-sm">Texto extraído y procedencia</summary>{pages.map((page)=><div key={page.page} className="mt-3"><h4 className="text-sm font-medium">Página {page.page}</h4><p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{page.text}</p></div>)}</details>}{destination==="operations"&&<p className="text-sm text-amber-800">Los PDF aportan evidencia y sugerencias. Para crear operaciones en lote utiliza Excel o CSV.</p>}</>}
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Cancelar</Button><Button disabled={busy||!file||!permitted||(destination==="operations"||destination==="expedientes"&&Boolean(preview))&&(!preview||!selected.length)||!preview&&!pages.length} onClick={save}>Guardar {destination==="operations"?`${selected.length} seleccionada(s)`:"importación"}</Button></div>
    </DialogContent></Dialog>
}
