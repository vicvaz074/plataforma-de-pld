"use client"
import { useEffect, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Company } from "@/lib/pilot/contracts"
import { pilotApi, jsonRequest } from "@/lib/pilot/api"

export function CompanyEditor({ company, onClose, onSaved }: { company: Company | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(""); const [rfc, setRfc] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("")
  useEffect(() => { setName(company?.name || ""); setRfc(company?.rfc || ""); setError("") }, [company])
  const save = async (event: FormEvent) => { event.preventDefault(); if (!company) return; setBusy(true); setError(""); try { await pilotApi(`/companies/${company.id}`, jsonRequest("PATCH", { name, rfc })); await onSaved(); onClose() } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar la empresa.") } finally { setBusy(false) } }
  return <Dialog open={Boolean(company)} onOpenChange={(open) => { if (!open) onClose() }}><DialogContent className="rounded-2xl"><DialogHeader><DialogTitle>Editar empresa</DialogTitle><DialogDescription>No se cambia el ID ni el contexto de sus registros históricos. Una identidad con historial no puede sustituirse por otro RFC.</DialogDescription></DialogHeader><form onSubmit={save} className="space-y-4">{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}<div className="space-y-2"><Label htmlFor="company-legal-name">Razón social</Label><Input id="company-legal-name" value={name} onChange={(event) => setName(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="company-rfc">RFC</Label><Input id="company-rfc" value={rfc} maxLength={13} onChange={(event) => setRfc(event.target.value.toUpperCase())} /></div><Button disabled={busy} className="rounded-xl">{busy ? "Guardando…" : "Guardar empresa"}</Button></form></DialogContent></Dialog>
}
