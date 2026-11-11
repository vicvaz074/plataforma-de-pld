"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select"
import type { EbrReviewPlan } from "@/lib/pld/ebr-assessment"
import { RiskEvidencePicker } from "@/components/pld/risk-evidence-picker"

export function RiskReviewPlan({value,onChange,scope}:{value:EbrReviewPlan;onChange:(value:EbrReviewPlan)=>void;scope:"cliente"|"institucional"}){
  const patch=(id:string,change:Partial<EbrReviewPlan["actions"][number]>)=>onChange({...value,actions:value.actions.map((item)=>item.id===id?{...item,...change}:item)})
  return <details className="rounded-xl border p-4" open>
    <summary className="cursor-pointer text-sm font-medium">Plan y próxima revisión {scope==="cliente"?"del cliente":"institucional"}</summary>
    <div className="mt-3 space-y-3">
      <div className="max-w-xs space-y-1"><Label htmlFor={`ebr-next-review-${scope}`}>Próxima revisión {scope}</Label><Input id={`ebr-next-review-${scope}`} type="date" value={value.nextReviewAt} onChange={(event)=>onChange({...value,nextReviewAt:event.target.value})}/></div>
      <p className="text-xs text-muted-foreground">La empresa define la fecha según su metodología. No es un plazo normativo calculado automáticamente. Las acciones vencidas permanecen abiertas hasta documentar su cierre.</p>
      {value.actions.map((action,index)=><div key={action.id} className="space-y-2 rounded-xl border p-3">
        <div className="grid gap-2 md:grid-cols-3">
          <Input aria-label={`Acción ${scope} ${index+1}`} placeholder="Acción de seguimiento" value={action.title} onChange={(event)=>patch(action.id,{title:event.target.value})}/>
          <Input aria-label={`Responsable acción ${scope} ${index+1}`} placeholder="Responsable: usuario o cargo" value={action.ownerId} onChange={(event)=>patch(action.id,{ownerId:event.target.value})}/>
          <Input aria-label={`Fecha acción ${scope} ${index+1}`} type="date" value={action.dueAt} onChange={(event)=>patch(action.id,{dueAt:event.target.value})}/>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={action.status} onValueChange={(status:"open"|"completed")=>patch(action.id,{status})}><SelectTrigger aria-label={`Estado acción ${scope} ${index+1}`} className="w-44"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="open">Abierta</SelectItem><SelectItem value="completed">Cerrada con evidencia</SelectItem></SelectContent></Select>
          <div className="min-w-48 flex-1"><RiskEvidencePicker label={`Evidencia acción ${scope} ${index+1}`} value={action.evidence} legacyReference={action.evidenceId} onChange={(evidence)=>{if(action.evidence?.fileVersionId!==evidence.fileVersionId||action.evidence?.sha256!==evidence.sha256)patch(action.id,{evidence,evidenceId:evidence.fileVersionId,status:"open"})}}/></div>
          {action.status==="open"&&action.dueAt&&action.dueAt<new Date().toISOString().slice(0,10)&&<Badge className="bg-amber-50 text-amber-900">Vencida</Badge>}
        </div>
      </div>)}
      <Button type="button" variant="outline" onClick={()=>onChange({...value,actions:[...value.actions,{id:crypto.randomUUID(),title:"",ownerId:"",dueAt:"",status:"open"}]})}>Añadir acción {scope}</Button>
    </div>
  </details>
}
