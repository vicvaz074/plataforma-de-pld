"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AlertCircle, Building2, Check, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { pilotApi, PilotApiError } from "@/lib/pilot/api"
import { PATH_MODULES, sessionCan, type Company, type PilotSession } from "@/lib/pilot/contracts"
import { configurePilotSession, dismissStorageNotices, flushModuleStorage, getPendingModuleChanges, getSaveState, loadCompanyStorage, resetCompanyStorage, retryModuleStorage, subscribeSaveState } from "@/lib/pilot/module-storage"
import { ModuleActionGuard } from "./module-action-guard"

interface PilotContextValue { mode: "cloud" | "demo"; session: PilotSession | null; company: Company | null; ready: boolean; refresh: () => Promise<void>; selectCompany: (company: Company) => Promise<void>; logout: () => Promise<void> }
const PilotContext = createContext<PilotContextValue | null>(null)
const savedServerState = { status: "saved" as const, pending: 0 }
export function usePilot() { const value = useContext(PilotContext); if (!value) throw new Error("Falta el contexto de la plataforma."); return value }
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

export function PilotProvider({ children }: { children: ReactNode }) {
  const router = useRouter(); const pathname = usePathname()
  const mode: "demo" | "cloud" = process.env.NEXT_PUBLIC_PLD_MODE === "demo" ? "demo" : "cloud"
  const [session, setSession] = useState<PilotSession | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const [switching, setSwitching] = useState(false)
  const [generation, setGeneration] = useState(0)
  const [resolveConflict, setResolveConflict] = useState(false)
  const [backedUp, setBackedUp] = useState(false)
  const refreshEpoch = useRef(0)
  const switchEpoch = useRef(0)
  const saveState = useSyncExternalStore(subscribeSaveState, getSaveState, () => savedServerState)
  const selectCompany = useCallback(async (next: Company) => {
    const epoch = ++switchEpoch.current
    setSwitching(true); setError("")
    try { await loadCompanyStorage(next); setCompany(next); sessionStorage.setItem("pld-company-id", next.id); setGeneration((v) => v + 1) }
    catch (reason) { if (reason instanceof DOMException && reason.name === "AbortError") return; throw reason }
    finally { if (epoch === switchEpoch.current) setSwitching(false) }
  }, [])
  const refresh = useCallback(async (reloadCompany = false) => {
    const epoch = ++refreshEpoch.current
    if (mode === "demo") { setReady(true); return }
    try {
      const result = await pilotApi<PilotSession>("/session")
      if (epoch !== refreshEpoch.current) return
      configurePilotSession(result); setSession(result); setError("")
      if (result.user.requiresPasswordChange) { setReady(true); if (pathname !== "/profile" && pathname !== "/login") router.replace("/profile"); return }
      if (result.mfaRequired) { setReady(true); if (pathname !== "/profile" && pathname !== "/login") router.replace("/profile"); return }
      const requestedId = company?.id || sessionStorage.getItem("pld-company-id")
      const inboxOrg = result.organizations.find((org) => requestedId === `inbox:${org.id}:${result.user.id}`)
      const current: Company | undefined = inboxOrg ? { id: requestedId!, organizationId: inboxOrg.id, name: `Expedientes sin asignar · ${inboxOrg.name}`, rfc: "", status: "active" } : result.companies.find((item) => item.id === requestedId) || result.companies.find((item) => item.status === "active")
      if (current && (!company || company.id !== current.id || reloadCompany)) await selectCompany(current)
      else if (current) setCompany(current)
      if (!current) setCompany(null)
      setReady(true)
    } catch (reason) {
      if (epoch !== refreshEpoch.current) return
      if (reason instanceof PilotApiError && reason.status === 401) {
        configurePilotSession(null); setSession(null); setCompany(null); setReady(true)
        if (pathname !== "/login" && pathname !== "/setup") router.replace("/login")
      } else { setError(reason instanceof Error ? reason.message : "No se pudo conectar con la plataforma."); setReady(true) }
    }
  }, [mode, pathname, router, company, selectCompany])
  const latestRefresh = useRef(refresh)
  useEffect(() => { latestRefresh.current = refresh }, [refresh])
  useEffect(() => { void latestRefresh.current(true) }, [pathname]) // Route checks revalidate revocations and shared data on the server.
  const hasSession = Boolean(session)
  useEffect(() => {
    if (mode !== "cloud" || !hasSession) return
    // Revalidate revocation without replacing an in-progress form.
    const timer = window.setInterval(() => { void pilotApi<PilotSession>("/session").then((result) => { configurePilotSession(result); setSession(result) }).catch((reason) => { if (reason instanceof PilotApiError && [401, 403].includes(reason.status)) { configurePilotSession(null); setSession(null); router.replace("/login") } }) }, 30_000)
    return () => window.clearInterval(timer)
  }, [mode, hasSession, router])
  useEffect(() => {
    if (mode !== "cloud") return
    const leave = (event: BeforeUnloadEvent) => { if (getSaveState().status !== "saved") { event.preventDefault(); event.returnValue = "" } }
    window.addEventListener("beforeunload", leave)
    return () => window.removeEventListener("beforeunload", leave)
  }, [mode])
  const logout = useCallback(async () => {
    await flushModuleStorage()
    if (mode === "cloud") await pilotApi("/api/auth/sign-out", { method: "POST", body: "{}" })
    else { for (const key of ["isAuthenticated", "userRole", "userName", "userEmail"]) localStorage.removeItem(key) }
    resetCompanyStorage(); setSession(null); setCompany(null); router.replace("/login")
  }, [mode, router])
  const context = useMemo(() => ({ mode, session, company, ready, refresh, selectCompany, logout }), [mode, session, company, ready, refresh, selectCompany, logout])
  const moduleKey = PATH_MODULES[pathname]
  const blocked = mode === "cloud" && moduleKey && company && !sessionCan(session, company, moduleKey, "view")
  const isPublic = pathname === "/login" || pathname === "/setup"
  const credentialsPending = mode === "cloud" && session && (session.user.requiresPasswordChange || session.mfaRequired) && pathname !== "/profile" && !isPublic
  const needsCompany = mode === "cloud" && !company && Boolean(moduleKey)
  const content = !ready && !isPublic ? <div role="status" className="flex min-h-[50vh] items-center justify-center gap-3"><Loader2 className="h-5 w-5 animate-spin" />Conectando…</div>
    : !isPublic && error ? <div role="alert" className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-6"><AlertCircle className="mb-3 text-red-600" /><h1 className="text-xl font-semibold">No se pudo abrir la plataforma</h1><p className="my-3 text-sm">{error}</p><Button onClick={() => void refresh()}>Reintentar</Button></div>
    : !isPublic && mode === "cloud" && !session ? <p className="p-8">Verificando acceso…</p>
    : credentialsPending ? <div className="p-8"><p>Actualiza tu acceso para continuar.</p><Button className="mt-3" onClick={() => router.replace("/profile")}>Abrir mi cuenta</Button></div>
    : blocked ? <div className="p-8"><h1 className="text-xl font-semibold">Acceso no asignado</h1><p className="mt-2 text-sm text-muted-foreground">Solicita acceso a este módulo al administrador de tu empresa.</p></div>
    : needsCompany ? <div className="mx-auto max-w-lg space-y-4 p-8"><Building2 className="h-8 w-8 text-orange-500" /><h1 className="text-xl font-semibold">Selecciona una empresa</h1><p className="text-sm text-muted-foreground">El administrador puede crear empresas y asignarte acceso desde el panel.</p><Button onClick={() => router.push("/dashboard")}>Ir al panel</Button></div>
    : <div key={mode === "cloud" ? `${company?.id || "account"}:${generation}` : "demo"}><ModuleActionGuard moduleKey={moduleKey} mode={mode} session={session} company={company}>{children}</ModuleActionGuard></div>
  return <PilotContext.Provider value={context}>
    {mode === "cloud" && !isPublic && session && saveState.status !== "saved" && <div role="status" className={`sticky top-0 z-[60] flex items-center justify-between gap-3 px-4 py-2 text-sm ${saveState.status === "error" ? "bg-red-50 text-red-900" : "bg-amber-50 text-amber-900"}`}>
      <span>{saveState.status === "saving" ? "Guardando cambios…" : `Cambios sin guardar: ${saveState.message}`}</span>
      {saveState.status === "error" && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void retryModuleStorage().catch(() => undefined)}><RefreshCw className="mr-1 h-4 w-4" />Reintentar</Button><Button size="sm" variant="outline" onClick={() => { setBackedUp(false); setResolveConflict(true) }}>Resolver conflicto</Button></div>}
    </div>}
    {content}
    {switching && <div role="status" aria-live="polite" className="fixed inset-0 z-[90] flex items-center justify-center bg-background/80 backdrop-blur-sm"><span className="flex items-center gap-3 rounded-2xl border bg-background p-5 shadow-sm"><Loader2 className="h-5 w-5 animate-spin" />Abriendo empresa…</span></div>}
    {mode === "cloud" && session && Boolean(saveState.warnings?.length) && <aside role="alert" className="fixed bottom-4 left-4 right-4 z-[80] mx-auto max-w-3xl rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 shadow-lg"><p className="font-semibold">Guardado con revisión pendiente</p>{saveState.warnings?.map((message) => <p key={message} className="mt-2">{message}</p>)}<div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => router.push("/actividades-vulnerables")}>Ver operaciones</Button><Button size="sm" variant="ghost" onClick={dismissStorageNotices}>Entendido</Button></div></aside>}
    <Dialog open={resolveConflict} onOpenChange={setResolveConflict}><DialogContent className="rounded-2xl"><DialogHeader><DialogTitle>Conservar o recargar cambios</DialogTitle><DialogDescription>Otra sesión puede haber modificado estos registros. No se sobrescribirá su versión. Puedes conservar tu trabajo aquí o descargarlo y abrir la versión actual del servidor.</DialogDescription></DialogHeader><p className="text-sm">Empresa: {company?.name} · {saveState.pending} colecciones pendientes.</p><Button variant="outline" onClick={() => { const blob = new Blob([JSON.stringify(getPendingModuleChanges(), null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "pld-cambios-pendientes.json"; link.click(); URL.revokeObjectURL(url); setBackedUp(true) }}>Descargar mis cambios pendientes</Button><p className="text-xs text-muted-foreground">El respaldo contiene datos de la empresa. Guárdalo en un lugar privado.</p><Button disabled={!backedUp || switching} onClick={async () => { if (!company) return; setSwitching(true); try { await loadCompanyStorage(company, { discardUnsaved: true }); setGeneration((value) => value + 1); setResolveConflict(false); setError("") } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo recargar.") } finally { setSwitching(false) } }}>Abrir versión del servidor</Button><Button variant="ghost" onClick={() => setResolveConflict(false)}>Conservar mi trabajo sin recargar</Button></DialogContent></Dialog>
  </PilotContext.Provider>
}

export function CompanySwitcher() {
  const { mode, company, session, selectCompany } = usePilot()
  const [search, setSearch] = useState(""); const [open, setOpen] = useState(false); const [error, setError] = useState("")
  if (mode === "demo") return <span className="rounded-full border border-white/40 px-3 py-1 text-xs">Demo local</span>
  const privateInboxes: Company[] = (session?.organizations || []).map((org) => ({ id: `inbox:${org.id}:${session?.user.id}`, organizationId: org.id, name: `Expedientes sin asignar · ${org.name}`, rfc: "", status: "active" }))
  const companies = [...(session?.companies || []), ...privateInboxes].filter((item) => item.status === "active" && normalize(`${item.name} ${item.rfc}`).includes(normalize(search)))
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="ghost" title={company?.name} className="max-w-[220px] gap-2 rounded-xl px-2 text-white hover:bg-white/15 hover:text-white max-sm:max-w-[125px] max-sm:gap-1 max-sm:px-1"><Building2 className="h-4 w-4 shrink-0" /><span className="max-w-[140px] truncate text-xs sm:text-sm max-sm:max-w-[90px]">{company?.name || "Empresa"}</span></Button></PopoverTrigger>
    <PopoverContent className="w-80 p-2" align="end"><Input aria-label="Buscar empresa por nombre o RFC" placeholder="Buscar empresa o RFC" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2" /><div className="max-h-72 overflow-y-auto">{companies.map((item) => <button key={item.id} className="flex w-full items-start justify-between gap-2 rounded-xl p-3 text-left hover:bg-orange-50 focus-visible:ring-2 focus-visible:ring-orange-400" onClick={async () => { try { await selectCompany(item); setOpen(false); setError("") } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cambiar de empresa.") } }}><span className="min-w-0"><span className="block text-sm font-medium">{item.name}</span><span className="text-xs text-muted-foreground">{item.rfc}</span></span>{company?.id === item.id && <Check className="h-4 w-4 shrink-0 text-orange-500" />}</button>)}{!companies.length && <p className="p-3 text-sm text-muted-foreground">No hay empresas disponibles.</p>}</div>{error && <p role="alert" className="p-2 text-xs text-red-700">{error}</p>}</PopoverContent>
  </Popover>
}
