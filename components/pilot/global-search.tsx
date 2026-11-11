"use client"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { usePilot } from "./pilot-provider"
import { APP_NAVIGATION_ITEMS } from "@/lib/pld/navigation"
import { formatOperationFinancialSummary } from "@/lib/pld/operation-finance"
import { getModuleStorage } from "@/lib/pilot/module-storage"
import { PATH_MODULES, sessionCan } from "@/lib/pilot/contracts"

const normalize=(value:unknown)=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
interface SearchResult {id:string;title:string;subtitle:string;href:string;details?:Array<[string,string]>}
export function GlobalSearch(){
  const {session,company,mode}=usePilot();const router=useRouter();const [open,setOpen]=useState(false);const [query,setQuery]=useState("");const [selected,setSelected]=useState<SearchResult|null>(null)
  const results=useMemo(()=>{
    if(!open)return []
    const results:SearchResult[]=APP_NAVIGATION_ITEMS.filter(item=>(mode==="demo"||!PATH_MODULES[item.href]||sessionCan(session,company,PATH_MODULES[item.href],"view"))&&normalize(item.title.es).includes(normalize(query))).map(item=>({id:item.key,title:item.title.es,subtitle:"Módulo",href:item.href}))
    if(query.trim().length<2)return results
    for(const [key,href,label] of [["kyc_expedientes_detalle","/kyc-expediente","Expediente"],["actividades_vulnerables_operaciones","/actividades-vulnerables","Operación"],["pld-evidences-documents","/evidencias-trazabilidad","Evidencia"]]){
      if(mode==="cloud"&&!sessionCan(session,company,PATH_MODULES[href],"view"))continue
      try{const items:unknown=JSON.parse(getModuleStorage().getItem(key)||"[]");if(!Array.isArray(items))continue
        for(const item of items){if(!item||typeof item!=="object")continue
          const fields=[item.nombre,item.cliente,item.title,item.rfc,item.tipoOperacion,item.periodo,item.referenciaAviso,item.expedienteId,item.id]
          if(!fields.some(value=>normalize(value).includes(normalize(query))))continue
          results.push({id:key+":"+(item.expedienteId||item.id),title:item.nombre||item.cliente||item.title||"Registro",subtitle:`${label} · ${item.rfc||item.periodo||""}`,href:href+(key==="kyc_expedientes_detalle"?`?buscar=${encodeURIComponent(item.expedienteId||item.id)}`:key==="actividades_vulnerables_operaciones"?`?operation=${encodeURIComponent(item.id)}`:`?document=${encodeURIComponent(item.id)}`),details:Object.entries({"RFC / identificador":item.rfc||item.identifiers?.curp||item.identifiers?.nif,"Periodo":item.periodo,"Fecha":item.fechaOperacion||item.actualizadoEn||item.uploadDate,"Tipo":item.tipoOperacion||item.tipoCliente||item.documentType,"Monto":typeof item.montoCentavos==="number"?formatOperationFinancialSummary(item):undefined}).filter((entry):entry is [string,string]=>typeof entry[1]==="string")})
        }
      }catch{/* Corrupt data stays available to recovery; a search never rewrites it. */}
    }
    return results.slice(0,30)
  },[query,company,session,mode,open])
  return <Dialog open={open} onOpenChange={value=>{setOpen(value);if(!value){setQuery("");setSelected(null)}}}><DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="Buscar en la empresa" title="Buscar módulos, expedientes y operaciones" className="text-white hover:bg-white/15 hover:text-white"><Search className="h-5 w-5"/></Button></DialogTrigger><DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl"><DialogHeader><DialogTitle>{selected?selected.title:"Buscar"}</DialogTitle><DialogDescription>{company?.name||"Navegación de la plataforma"}</DialogDescription></DialogHeader>{selected?<><dl className="space-y-3">{selected.details?.map(([key,value])=><div key={key} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-muted-foreground">{key}</dt><dd className="mt-1 break-words text-sm">{value}</dd></div>)}</dl><div className="flex gap-2"><Button variant="outline" onClick={()=>setSelected(null)}>Volver a resultados</Button><Button onClick={()=>{router.push(selected.href);setOpen(false)}}>Abrir módulo<ArrowRight className="ml-2 h-4 w-4"/></Button></div></>:<><Input autoFocus aria-label="Buscar módulos o registros" placeholder="Cliente, RFC, referencia o módulo…" value={query} onChange={event=>setQuery(event.target.value)}/><div className="max-h-96 overflow-y-auto">{results.map(result=><button key={result.id} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left hover:bg-orange-50 focus-visible:ring-2 focus-visible:ring-orange-400" onClick={()=>{if(result.details)setSelected(result);else{router.push(result.href);setOpen(false)}}}><span className="min-w-0"><span className="block truncate text-sm font-medium">{result.title}</span><span className="text-xs text-muted-foreground">{result.subtitle}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground"/></button>)}{!results.length&&<p className="p-5 text-sm text-muted-foreground">No se encontraron resultados.</p>}</div></>}</DialogContent></Dialog>
}
