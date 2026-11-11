"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SearchableSelect } from "@/components/pld/searchable-select"
import { pilotApi, jsonRequest } from "@/lib/pilot/api"
import type { OrganizationRole, PilotUser } from "@/lib/pilot/contracts"

type ActiveSession = { id: string; createdAt: number; updatedAt: number; expiresAt: number; userAgent?: string }
const roles = [{ value: "admin", label: "Administrador" }, { value: "compliance", label: "Cumplimiento" }, { value: "capture", label: "Captura" }, { value: "viewer", label: "Consulta" }]
export function UserSecurityDialog({ user, organizationId, initialRole, superadmin, onClose, onChanged }: { user: PilotUser | null; organizationId: string; initialRole: OrganizationRole; superadmin: boolean; onClose: () => void; onChanged: () => Promise<void> }) {
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [name, setName] = useState(""); const [role, setRole] = useState<OrganizationRole>(initialRole)
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false)
  const userId = user?.id; const userName = user?.name
  const load = useCallback(async () => { if (!userId) return; const result = await pilotApi<{ sessions: ActiveSession[] }>(`/users/${userId}/sessions?organizationId=${encodeURIComponent(organizationId)}`); setSessions(result.sessions) }, [userId, organizationId])
  useEffect(() => { if (!userId) return; setName(userName || ""); setRole(initialRole); setError(""); void load().catch((reason) => setError(reason instanceof Error ? reason.message : "No se pudieron consultar las sesiones.")) }, [userId, userName, initialRole, load])
  const mutate = async (action: () => Promise<unknown>) => { setBusy(true); setError(""); try { await action(); await load(); await onChanged() } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar.") } finally { setBusy(false) } }
  return <Dialog open={Boolean(user)} onOpenChange={(open) => { if (!open) onClose() }}><DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl"><DialogHeader><DialogTitle>Cuenta de {user?.name}</DialogTitle><DialogDescription>Gestiona su perfil y revoca sesiones. No se muestran contraseñas ni tokens.</DialogDescription></DialogHeader>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!user) return; if (role !== initialRole && !window.confirm("Cambiar el perfil restablece los permisos de sus empresas al perfil elegido y cierra sus sesiones. ¿Continuar?")) return; void mutate(() => pilotApi(`/users/${user.id}`, jsonRequest("PATCH", { organizationId, name, ...(role !== initialRole ? { role } : {}) }))) }}><div className="space-y-2"><Label htmlFor="managed-name">Nombre</Label><Input id="managed-name" value={name} onChange={(event) => setName(event.target.value)} required /></div><div className="space-y-2"><Label>Perfil en la organización</Label><SearchableSelect ariaLabel="Cambiar perfil de usuario" value={role} onChange={(value) => setRole(value as OrganizationRole)} options={roles.filter((item) => superadmin || item.value !== "admin")} /></div><Button disabled={busy}>Guardar cuenta</Button></form>
    <section className="space-y-3 border-t pt-4"><div className="flex items-center justify-between gap-2"><h3 className="font-medium">Sesiones activas</h3><Button size="sm" variant="outline" disabled={busy || !sessions.length} onClick={() => { if (user && window.confirm("¿Cerrar todas las sesiones de este usuario?")) void mutate(() => pilotApi(`/users/${user.id}/sessions`, jsonRequest("DELETE", { organizationId }))) }}>Cerrar todas</Button></div>{sessions.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0 text-xs"><p className="truncate">{item.userAgent || "Dispositivo sin información"}</p><p className="mt-1 text-muted-foreground">Acceso: {new Date(Number(item.updatedAt)).toLocaleString("es-MX")}</p></div><Button size="sm" variant="ghost" disabled={busy} onClick={() => user && void mutate(() => pilotApi(`/users/${user.id}/sessions`, jsonRequest("DELETE", { organizationId, sessionId: item.id })))}>Revocar</Button></div>)}{!sessions.length && <p className="text-sm text-muted-foreground">Sin sesiones activas.</p>}</section>
  </DialogContent></Dialog>
}
