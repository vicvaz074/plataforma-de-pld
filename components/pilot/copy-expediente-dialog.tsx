"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SearchableSelect } from "@/components/pld/searchable-select"
import { usePilot } from "./pilot-provider"
import { sessionCan } from "@/lib/pilot/contracts"
import { pilotApi, jsonRequest } from "@/lib/pilot/api"
import { flushModuleStorage, getCompanyRecordRevision } from "@/lib/pilot/module-storage"

export function CopyExpedienteDialog({ expedienteId }: { expedienteId: string }) {
  const { mode, session, company, selectCompany } = usePilot()
  const [open, setOpen] = useState(false); const [target, setTarget] = useState("")
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [copied, setCopied] = useState(false)
  if (mode !== "cloud" || !company?.id.startsWith("inbox:") || !expedienteId) return null
  const destinations = (session?.companies || []).filter((item) => item.organizationId === company.organizationId && sessionCan(session, item, "expedientes", "edit") && sessionCan(session, item, "expedientes", "upload"))
  const copy = async () => {
    setBusy(true); setError("")
    try {
      await flushModuleStorage()
      const expectedRevision = getCompanyRecordRevision("kyc_expedientes_detalle", expedienteId)
      if (!expectedRevision) throw new Error("Guarda primero el expediente que deseas reutilizar.")
      await pilotApi(`/companies/${encodeURIComponent(target)}/expedientes/copy`, jsonRequest("POST", { sourceCompanyId: company.id, expedienteId, expectedRevision }))
      setCopied(true)
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo copiar el expediente.") } finally { setBusy(false) }
  }
  return <><Button type="button" variant="outline" className="rounded-xl" data-pld-action="edit" onClick={() => { setOpen(true); setError(""); setCopied(false) }}>Reutilizar en una empresa</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="rounded-2xl"><DialogHeader><DialogTitle>Asignar una copia del expediente</DialogTitle><DialogDescription>El original permanecerá en tu bandeja privada. La empresa recibirá una copia independiente con su procedencia y archivos; las revisiones posteriores no se mezclarán.</DialogDescription></DialogHeader>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}{copied ? <><p role="status" className="text-sm text-green-800">Expediente y documentos guardados en la empresa.</p><Button onClick={async () => { const destination = destinations.find((item) => item.id === target); if (destination) { await selectCompany(destination); setOpen(false) } }}>Abrir la empresa</Button></> : <><SearchableSelect ariaLabel="Empresa que recibirá una copia" value={target} options={destinations.map((item) => ({ value: item.id, label: `${item.name} · ${item.rfc}` }))} onChange={setTarget} placeholder="Selecciona una empresa autorizada" />{!destinations.length && <p className="text-sm text-muted-foreground">No tienes permiso de edición en otra empresa de esta organización.</p>}<Button disabled={busy || !target} onClick={copy}>{busy ? "Copiando expediente y archivos…" : "Crear copia vinculada a la empresa"}</Button></>}</DialogContent></Dialog></>
}
