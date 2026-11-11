"use client"
import { useState } from "react"
import { ArchiveRestore, Download, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { usePilot } from "./pilot-provider"
import { COLLECTION_MODULES } from "@/lib/pilot/contracts"
import { decodeCollection, encodeCollection } from "@/lib/pilot/record-codecs"
import { flushModuleStorage, getModuleStorage } from "@/lib/pilot/module-storage"

type Candidate = {key:string;value:unknown;count:number;error?:string;selected:boolean}
function looksLikeDemo(value:unknown):boolean {
  if(!value||typeof value!=="object")return false
  const record=value as Record<string,unknown>
  return record.demoSeed===true||Boolean(record.satDemoScenarioId||record.goldenFixtureId)||/^(?:op-demo|satpkg-demo|demo-case|qa-template|eui-demo|so-demo)/.test(String(record.id||record.expedienteId||""))
}
export function MigrationAssistant(){
  const {company,mode}=usePilot();const [candidates,setCandidates]=useState<Candidate[]>([]);const [backup,setBackup]=useState<Record<string,string|null>|null>(null)
  const [confirmed,setConfirmed]=useState(false);const [downloaded,setDownloaded]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("")
  const inspect=()=>{
    const original:Record<string,string|null>={};const next:Candidate[]=[]
    for(const key of Object.keys(COLLECTION_MODULES)){
      const raw=window.localStorage.getItem(key);if(!raw)continue;original[key]=raw
      try{let value:unknown=JSON.parse(raw);if(Array.isArray(value))value=value.filter(item=>!looksLikeDemo(item));else if(looksLikeDemo(value))continue
        const entries=encodeCollection(key,value);next.push({key,value,count:entries.size,selected:false})
      }catch(reason){next.push({key,value:null,count:0,selected:false,error:reason instanceof Error?reason.message:"JSON inválido"})}
    }
    setBackup(original);setCandidates(next);setDownloaded(false);setConfirmed(false);setMessage("")
  }
  const download=()=>{
    const blob=new Blob([JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),source:"legacy-browser",values:backup},null,2)],{type:"application/json"})
    const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="respaldo-pld-local.json";link.click();URL.revokeObjectURL(url);setDownloaded(true)
  }
  const migrate=async()=>{
    setBusy(true);setMessage("")
    try{
      const storage=getModuleStorage()
      for(const candidate of candidates.filter(item=>item.selected&&!item.error)){
        const current=storage.getItem(candidate.key)
        if(current&&current!=="[]"&&current!=="{}"&&current!=="null")throw new Error(`${candidate.key} ya contiene datos conectados. Resuelve la combinación por ID antes de importar.`)
      }
      for(const candidate of candidates.filter(item=>item.selected&&!item.error))storage.setItem(candidate.key,JSON.stringify(candidate.value))
      await flushModuleStorage();setMessage("Importación confirmada en el servidor. Los datos originales permanecen en este navegador.");setCandidates([])
    }catch(reason){setMessage(reason instanceof Error?reason.message:"No se completó la importación.")}
    finally{setBusy(false)}
  }
  if(mode!=="cloud")return null
  return <details className="rounded-2xl border bg-white p-5"><summary className="flex cursor-pointer items-center gap-2 text-sm font-medium"><ArchiveRestore className="h-4 w-4"/>Recuperar captura local anterior</summary><div className="mt-4 space-y-4 text-sm"><p className="text-muted-foreground">Revisa el contenido antes de asignarlo a {company?.name||"una empresa"}. Las cuentas y permisos locales no se importan.</p><Button size="sm" variant="outline" onClick={inspect}>Revisar este navegador</Button>{backup&&<><Button size="sm" variant="outline" className="ml-2 gap-2" onClick={download}><Download className="h-4 w-4"/>Descargar respaldo</Button><div className="max-h-64 space-y-2 overflow-y-auto">{candidates.map(item=><label key={item.key} className="flex items-center gap-3 rounded-lg border p-3"><Checkbox disabled={Boolean(item.error)} checked={item.selected} onCheckedChange={checked=>setCandidates(previous=>previous.map(candidate=>candidate.key===item.key?{...candidate,selected:checked===true}:candidate))}/><span className="min-w-0 break-all"><span>{item.key} · {item.count} registro(s)</span>{item.error&&<span className="block text-xs text-red-700">Apartado para revisión: {item.error}</span>}</span></label>)}{!candidates.length&&<p>No hay colecciones locales aptas para importar.</p>}</div><label className="flex items-start gap-2"><Checkbox checked={confirmed} onCheckedChange={value=>setConfirmed(value===true)}/><span>He revisado los registros seleccionados y confirmo que pertenecen a la empresa activa.</span></label><Button className="gap-2 rounded-xl" disabled={!company||!confirmed||!downloaded||busy||!candidates.some(item=>item.selected)} onClick={()=>void migrate()}><Upload className="h-4 w-4"/>{busy?"Importando…":"Importar selección"}</Button></>}{message&&<p role="status" className="rounded-xl bg-slate-50 p-3">{message}</p>}</div></details>
}
