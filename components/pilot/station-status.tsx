"use client"
import { useEffect, useState } from "react"
import { CheckCircle2, CloudOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { isStationRenderer, listRecovery, getRecovery, forgetDraft, type Recovery, type RecoverySummary } from "@/lib/pilot/station-recovery"
import { replayStationRecovery } from "@/lib/pilot/module-storage"

type Issue = { id: string; companyId: string; state: string; code: string }
type Station = { mode: "locked" | "offline" | "online"; authorized: boolean; pending: number; conflicts: number; issues: Issue[] }
const base = "/api/v1/desktop-offline/"
async function local<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(base + path, { cache: "no-store", credentials: "same-origin", ...options })
  const result = await response.json()
  if (!response.ok) throw Error(result?.message || result?.error || "No se pudo consultar la estación.")
  return result as T
}

export function StationStatus({ companyId, fallback }: { companyId: string; fallback: React.ReactNode }) {
  const [info, setInfo] = useState<Station | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [review, setReview] = useState<{id:string; text:string} | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [checking,setChecking] = useState(false)
  const [copies,setCopies]=useState<RecoverySummary[]>([])
  const [copy,setCopy]=useState<Recovery|null>(null)
  const [result,setResult]=useState("")
  useEffect(() => {
    // This switch selects a desktop-only UX. Authorization is always enforced
    // by the native station and on-prem API, independent of the user agent.
    if (!isStationRenderer()) return
    setChecking(true)
    let live = true, sequence = 0
    async function refresh() {
      const seq = ++sequence
      try {
        const s = await local<Station>("status")
        if (live && seq === sequence) {
          if (!["offline","online","locked"].includes(s.mode)) throw Error("Estado desconocido")
          setInfo(s); setUnavailable(false)
          if (!s.authorized) {setReview(null);setCopies([]);setCopy(null)}
          else {const r=await listRecovery(companyId);if(live&&seq===sequence)setCopies(r.items)}
        }
      } catch { if (live && seq === sequence) { setUnavailable(true); setInfo(null); setReview(null) } }
      finally { if (live && seq===sequence) setChecking(false) }
    }
    void refresh()
    const events = ["online","offline","focus","pld-station-updated"]
    events.forEach(e => window.addEventListener(e, refresh))
    const timer = window.setInterval(refresh, 5000)
    return () => { live = false; window.clearInterval(timer); events.forEach(e => window.removeEventListener(e, refresh)) }
  }, [companyId])
  if (unavailable) return <span role="status" className="px-1 text-xs text-white">Sin verificar sincronización</span>
  if (checking&&!info) return <span role="status" className="px-1 text-xs text-white">Verificando estación…</span>
  if (!info) return isStationRenderer()?<span role="status" className="px-1 text-xs text-white">Verificando estación…</span>:<>{fallback}</>
  const exact = info.mode === "online" && !info.pending && !info.conflicts && !copies.length && info.authorized
  const label = !info.authorized ? "Sesión por verificar" : info.conflicts ? "Cambios por revisar" : info.pending ? `${info.pending} pendientes de sincronizar` : copies.length ? "Borradores por recuperar" : info.mode === "offline" ? "Sin conexión al servidor" : "Sincronización de estación"
  const issues = (info.issues || []).filter(i => i.companyId === companyId)
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError("");setResult("")
    try { await action() }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo completar la acción.") }
    finally { setBusy(false); window.dispatchEvent(new Event("pld-station-updated")) }
  }
  return <>
    <button type="button" title={label} aria-label={label} className="flex shrink-0 items-center gap-1 rounded px-1 text-xs text-white focus-visible:outline" onClick={() => setOpen(true)}>
      {exact ? fallback : <><CloudOff className="h-4 w-4" /><span role="status">{label}</span></>}
    </button>
    <Dialog open={open} onOpenChange={v=>{setOpen(v);if(!v){setReview(null);setCopy(null);setError("");setResult("")}}}>
      <DialogContent className="max-h-[85vh] overflow-auto"><DialogHeader><DialogTitle>Sincronización de esta estación</DialogTitle>
        <DialogDescription>La copia de trabajo pertenece a tu cuenta. Un borrador local no es un acuse ni una operación confirmada por el servidor.</DialogDescription></DialogHeader>
        <p role="status" className="flex items-center gap-2 text-sm">{exact && <CheckCircle2 className="size-4" />}{info.mode === "online" ? "Servidor corporativo disponible" : info.mode === "offline" ? "Trabajando sin conexión al servidor corporativo" : "Es necesario validar la sesión en línea"}</p>
        {info.authorized && <><p className="text-sm">Pendientes de envío: {info.pending} · Conflictos: {info.conflicts}</p>
          <Button disabled={busy} onClick={()=>void run(async()=>{await local("sync",{method:"POST"})})}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Sincronizar ahora</Button>
          {issues.map(issue=><div key={issue.id} className="rounded-md border p-3 text-sm"><p>La empresa activa tiene un cambio que necesita revisión.</p>
            <Button size="sm" variant="outline" disabled={busy} onClick={()=>void run(async()=>{const data=await local("review?batchId="+encodeURIComponent(issue.id));setReview({id:issue.id,text:JSON.stringify(data,(_k,v)=>typeof v==="string"&&v.startsWith("data:")?"[Archivo incluido]":v,2)})})}>Comparar versiones</Button></div>)}
          {review && issues.some(i=>i.id===review.id) && <section className="space-y-2"><p className="text-sm">Compara tu borrador con los datos disponibles del servidor. No se sobrescribe ninguna versión automáticamente.</p>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">{review.text}</pre>
            <Button variant="outline" disabled={busy} onClick={()=>{if(window.confirm("¿Descartar este borrador local? No se modificará el registro del servidor."))void run(async()=>{await local("discard",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({batchId:review.id,companyId,confirm:true})});setReview(null)})}}>Descartar este borrador</Button></section>}
          {copies.length>0&&<section className="space-y-2 border-t pt-3"><h3 className="font-medium">Copias de recuperación de esta empresa</h3>
            <p className="text-sm">Estas copias no son constancias de guardado. Si hubo una interrupción, comprueba el registro o la versión del archivo antes de reintentar.</p>
            {copies.map(item=><button key={item.id} type="button" disabled={busy} className="block w-full rounded border px-3 py-2 text-left text-sm hover:bg-muted" onClick={()=>void run(async()=>setCopy(await getRecovery(companyId,item.id)))}>{item.kind==="file"?"Archivo por verificar":"Captura por verificar"} · {new Date(item.createdAt).toLocaleString("es-MX")}</button>)}
            {copy&&copies.some(x=>x.id===copy.id)&&<div className="space-y-2 rounded-md border p-3 text-sm">
              {copy.body.kind==="records"?<><pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(copy.body.mutations,(k,v)=>typeof v==="string"&&v.startsWith("data:")?"[Archivo incluido]":v,2)}</pre>
                <Button size="sm" disabled={busy||info.mode!=="online"} onClick={()=>{if(window.confirm("¿Enviar este lote a validación del servidor con las revisiones originales?"))void run(async()=>{const outcome=await replayStationRecovery(copy.id);setCopy(null);setResult(outcome.pending?"El lote está pendiente de sincronizar. El servidor aún no ha confirmado el guardado.":"Servidor confirmado. Vuelve a abrir el módulo para consultar la revisión guardada.")})}}>Revalidar y enviar</Button></>:
                <p>Original: <button className="underline" onClick={()=>void run(async()=>{const body=copy.body;if(body.kind!=="file")return;const blob=await (await fetch(body.data)).blob();const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=body.name;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),30000)})}>Recuperar {copy.body.name}</button>. Si el servidor aún no lo recibió, vuelve a adjuntarlo en su expediente.</p>}
              <Button variant="ghost" size="sm" disabled={busy} onClick={()=>{if(window.confirm("¿Eliminar únicamente esta copia local de recuperación? No se puede deshacer."))void run(async()=>{await forgetDraft(companyId,copy.id);setCopy(null)})}}>Eliminar copia local</Button>
            </div>}
          </section>}
        </>}
        {result && <p role="status" className="text-sm">{result}</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </DialogContent>
    </Dialog>
  </>
}
