"use client"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { usePilot } from "./pilot-provider"
import { pilotApi, jsonRequest } from "@/lib/pilot/api"
import { flushModuleStorage } from "@/lib/pilot/module-storage"
import type { CloudRecord } from "@/lib/pilot/contracts"

interface Backup { id: string; createdAt: string; recordCount: number; fileCount: number; sha256: string }
interface RecoveryCandidate { collection: string; id: string; revision: number; label: string }
export function CompanyBackups() {
  const { session, company, selectCompany } = usePilot(); const { toast } = useToast()
  const [backups, setBackups] = useState<Backup[]>([]); const [error, setError] = useState(""); const [busy, setBusy] = useState(false)
  const [backup, setBackup] = useState<Backup | null>(null); const [candidates, setCandidates] = useState<RecoveryCandidate[]>([])
  const [selected, setSelected] = useState<string[]>([]); const [fileIds, setFileIds] = useState<string[]>([]); const [confirmed, setConfirmed] = useState(false)
  const companyId = company?.id; const allowed = session?.user.platformRole === "superadmin" && companyId && !companyId.startsWith("inbox:")
  const load = useCallback(async () => { if (!allowed || !companyId) return; const result = await pilotApi<{ backups: Backup[] }>(`/companies/${companyId}/backups`); setBackups(result.backups) }, [allowed, companyId])
  useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : "No se pudieron consultar los respaldos.")) }, [load])
  if (!allowed || !company) return null
  const create = async () => { setBusy(true); setError(""); try { await flushModuleStorage(); await pilotApi(`/companies/${company.id}/backups`, jsonRequest("POST", {})); await load(); toast({ title: "Respaldo privado guardado", description: "Incluye registros y copias verificadas de sus versiones documentales." }) } catch (reason) { setError(reason instanceof Error ? reason.message : "No se creó el respaldo.") } finally { setBusy(false) } }
  const inspect = async (item: Backup) => {
    setBusy(true); setError("")
    try {
      await flushModuleStorage()
      const [manifest, current] = await Promise.all([pilotApi<{ records: Array<{ collection: string; id: string; payload: string; deleted: number }>; files: Array<{ id: string }> }>(`/companies/${company.id}/backups/${item.id}`), pilotApi<{ records: CloudRecord[] }>(`/companies/${company.id}/snapshot`)])
      const candidates: RecoveryCandidate[] = []
      for (const record of manifest.records) {
        if (record.deleted || ["pld-sat-output-packages", "pld-submissions-workflow"].includes(record.collection)) continue
        const existing = current.records.find((value) => value.collection === record.collection && value.id === record.id)
        if (existing && !existing.deleted) continue
        const value = JSON.parse(record.payload)
        const payload = value && typeof value === "object" && !Array.isArray(value) ? value : {}
        if (record.collection === "actividades_vulnerables_operaciones" && (payload.avisoPresentado || payload.submission?.wasEverPresented)) continue
        candidates.push({ collection: record.collection, id: record.id, revision: existing?.revision || 0, label: payload.nombre || payload.cliente || payload.title || record.id })
      }
      setCandidates(candidates); setSelected(candidates.slice(0, 100).map((record) => `${record.collection}:${record.id}`)); setFileIds(manifest.files.map((file) => file.id)); setConfirmed(false); setBackup(item)
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo revisar el respaldo.") } finally { setBusy(false) }
  }
  const restore = async () => {
    if (!backup) return; setBusy(true); setError("")
    try {
      const result = await pilotApi<{ records: CloudRecord[]; filesRecovered: number; skipped: unknown[] }>(`/companies/${company.id}/backups/${backup.id}/restore`, jsonRequest("POST", { confirmCompanyId: company.id, expectedRevisions: candidates.filter((record) => selected.includes(`${record.collection}:${record.id}`)).map(({ collection, id, revision }) => ({ collection, id, revision })), fileVersionIds: fileIds }))
      await selectCompany(company); setBackup(null); toast({ title: "Recuperación finalizada", description: `${result.records.length} actualizaciones y ${result.filesRecovered} archivos recuperados. ${result.skipped.length} registros conservados para revisión.` })
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo completar la recuperación.") } finally { setBusy(false) }
  }
  return <details className="rounded-2xl border bg-white p-5"><summary className="cursor-pointer font-medium">Respaldo y recuperación · {company.name}</summary><div className="mt-4 space-y-4"><p className="text-sm text-muted-foreground">Recuperación no destructiva de faltantes. No sobrescribe registros activos ni revierte avisos presentados. No sustituye un respaldo externo de recuperación ante pérdida de la cuenta.</p>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}<Button variant="outline" className="rounded-xl" disabled={busy} onClick={create}>{busy ? "Procesando…" : "Crear respaldo privado"}</Button><div className="max-h-72 space-y-2 overflow-y-auto">{backups.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div className="text-sm"><p>{new Date(item.createdAt).toLocaleString("es-MX")}</p><p className="text-xs text-muted-foreground">{item.recordCount} registros · {item.fileCount} versiones</p></div><Button size="sm" variant="ghost" disabled={busy} onClick={() => void inspect(item)}>Revisar recuperación</Button></div>)}{!backups.length && <p className="text-sm text-muted-foreground">Todavía no hay respaldos privados de esta empresa.</p>}</div></div><Dialog open={Boolean(backup)} onOpenChange={(open) => { if (!open) setBackup(null) }}><DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl"><DialogHeader><DialogTitle>Recuperar faltantes</DialogTitle><DialogDescription>{company.name}. Se comprobarán revisiones y hashes nuevamente antes de guardar. Los archivos existentes no se reemplazan.</DialogDescription></DialogHeader>{error && <p role="alert" className="text-sm text-red-800">{error}</p>}<div className="max-h-64 space-y-2 overflow-y-auto">{candidates.map((record) => { const key = `${record.collection}:${record.id}`; return <label key={key} className="flex items-start gap-2 rounded-xl border p-3 text-sm"><input type="checkbox" className="mt-1" checked={selected.includes(key)} disabled={!selected.includes(key) && selected.length >= 100} onChange={(event) => setSelected((values) => event.target.checked ? [...values, key] : values.filter((value) => value !== key))} /><span className="min-w-0"><span className="block break-words">{record.label}</span><span className="break-all text-xs text-muted-foreground">{record.collection}</span></span></label> })}{!candidates.length && <p className="text-sm text-muted-foreground">No hay registros recuperables ausentes. Se puede comprobar y recuperar únicamente archivos faltantes.</p>}</div><p className="text-xs text-muted-foreground">Se verificarán {fileIds.length} versiones documentales del respaldo; sólo se recuperarán las que falten.</p><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />Confirmo la empresa y la recuperación de estos faltantes.</label><Button disabled={busy || !confirmed || (!selected.length && !fileIds.length)} onClick={restore}>{busy ? "Recuperando…" : "Recuperar seleccionados"}</Button></DialogContent></Dialog></details>
}
