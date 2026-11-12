"use client"

import { useEffect,useState } from "react"
import { SearchableSelect } from "@/components/pld/searchable-select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { pilotApi } from "@/lib/pilot/api"
import { getActiveCompany,getPilotSession,uploadPilotFile,captureModuleScope,isModuleScopeCurrent } from "@/lib/pilot/module-storage"
import { sessionCan,type ModuleKey } from "@/lib/pilot/contracts"
import { hasRecoverableEbrEvidence,type EbrEvidenceReference } from "@/lib/pld/ebr-assessment"

type FileVersion={id:string;documentId:string;sha256:string;downloadUrl:string;fileName:string;version:number;moduleKey:ModuleKey;status:string}
const cache=new Map<string,Promise<FileVersion[]>>()
const fileEvent="pld-ebr-evidence-refresh"
const cacheKey=(companyId:string)=>`${getPilotSession()?.user.id||"anonymous"}\u0000${companyId}`
async function filesForCompany(companyId:string){
  const key=cacheKey(companyId)
  let request=cache.get(key)
  if(!request){request=pilotApi<{files:FileVersion[]}>(`/companies/${companyId}/files`).then((result)=>result.files);cache.set(key,request);request.catch(()=>cache.delete(key))}
  return request
}
export function RiskEvidencePicker({label,value,legacyReference,onChange}:{label:string;value?:EbrEvidenceReference;legacyReference?:string;onChange:(value:EbrEvidenceReference)=>void}){
  const company=getActiveCompany(),session=getPilotSession()
  const companyId=company?.id
  const [files,setFiles]=useState<FileVersion[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("")
  const canUpload=sessionCan(session,company,"ebr","upload")&&sessionCan(session,company,"ebr","edit")
  useEffect(()=>{
    if(!companyId)return
    const scope=captureModuleScope()
    let cancelled=false
    const load=()=>{void filesForCompany(companyId).then((result)=>{if(!cancelled&&isModuleScopeCurrent(scope))setFiles(result.filter((file)=>!["rejected","archived"].includes(file.status)&&sessionCan(getPilotSession(),getActiveCompany(),file.moduleKey,"view")&&sessionCan(getPilotSession(),getActiveCompany(),file.moduleKey,"download")))}).catch(()=>{if(!cancelled&&isModuleScopeCurrent(scope)){setFiles([]);setError("No se pudieron consultar las evidencias autorizadas.")}})}
    load();window.addEventListener(fileEvent,load)
    return ()=>{cancelled=true;window.removeEventListener(fileEvent,load)}
  },[companyId,session?.user.id])
  const choose=(file:FileVersion)=>onChange({fileVersionId:file.id,documentId:file.documentId,sha256:file.sha256,downloadUrl:file.downloadUrl,fileName:file.fileName})
  return <div className="min-w-0 space-y-2">
    <SearchableSelect ariaLabel={label} value={value?.fileVersionId||""} onChange={(id)=>{const found=files.find((file)=>file.id===id);if(found)choose(found)}} options={files.map((file)=>({value:file.id,label:`${file.fileName} · v${file.version} · ${file.sha256.slice(0,8)}`}))} placeholder="Vincular evidencia de esta empresa" searchPlaceholder="Buscar archivo o versión"/>
    {hasRecoverableEbrEvidence(value)&&<a className="block break-words text-xs text-teal-800 underline" href={value.downloadUrl} target="_blank" rel="noreferrer">Ver versión vinculada: {value.fileName}</a>}
    {!hasRecoverableEbrEvidence(value)&&legacyReference&&<p className="break-words text-xs text-amber-800">Referencia externa histórica: {legacyReference}. No cuenta como soporte recuperable ni mitigación.</p>}
    <div><label className="sr-only" htmlFor={`evidence-upload-${label.replace(/\W/g,"")}`}>Subir {label}</label><Input id={`evidence-upload-${label.replace(/\W/g,"")}`} aria-label={`Subir ${label}`} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xlsm,.csv,.txt,.json,.xml,.docx" disabled={!canUpload||busy} onChange={async(event)=>{
      const file=event.target.files?.[0];if(!file||!company)return
      const scope=captureModuleScope()
      setBusy(true);setError("")
      try{const stored=await uploadPilotFile(file,"ebr");if(!isModuleScopeCurrent(scope))return;onChange({fileVersionId:stored.id,documentId:stored.documentId,sha256:stored.sha256,downloadUrl:stored.downloadUrl,fileName:stored.fileName});cache.delete(cacheKey(company.id));window.dispatchEvent(new Event(fileEvent))}
      catch(reason){if(isModuleScopeCurrent(scope))setError(reason instanceof Error?reason.message:"No se pudo conservar el archivo.")}
      finally{if(isModuleScopeCurrent(scope))setBusy(false);event.target.value=""}
    }}/></div>
    {busy&&<p role="status" className="text-xs">Conservando versión privada…</p>}
    {error&&<p role="alert" className="text-xs text-red-800">{error}<Button variant="link" className="h-auto p-1 text-xs" onClick={()=>{if(company){cache.delete(cacheKey(company.id));setError("");window.dispatchEvent(new Event(fileEvent))}}}>Reintentar</Button></p>}
  </div>
}
