"use client"
import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { pilotApi } from "@/lib/pilot/api"

/** Installation token stays in the URL fragment, never query strings or storage.
 * The server atomically closes bootstrap after the first account exists. */
export default function SetupPage() {
  const [token, setToken] = useState(""); const [email, setEmail] = useState(""); const [name, setName] = useState("Vicente Vázquez")
  const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState("")
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [error, setError] = useState("")
  useEffect(() => { const params = new URLSearchParams(location.hash.slice(1)); setToken(params.get("token") || ""); setEmail(params.get("email") || ""); history.replaceState(null, "", location.pathname) }, [])
  const activate = async (event: FormEvent) => {
    event.preventDefault(); setError("")
    if (password !== confirmation) { setError("Las contraseñas no coinciden."); return }
    setBusy(true)
    try { await pilotApi("/bootstrap", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ email, name, password }) }); setPassword(""); setConfirmation(""); setToken(""); setDone(true) }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo activar la instalación.") } finally { setBusy(false) }
  }
  return <main className="flex min-h-screen items-center justify-center bg-orange-50/40 p-5"><section className="w-full max-w-md space-y-5 rounded-3xl border bg-white p-7 shadow-sm"><h1 className="text-2xl font-semibold">Activar Davara PLD</h1>{done ? <><p role="status" className="text-sm">Tu cuenta de superadministrador está creada. El enlace de activación ya no puede volver a utilizarse.</p><Button asChild className="w-full rounded-xl"><Link href="/login">Iniciar sesión</Link></Button></> : token ? <><p className="text-sm text-muted-foreground">Crea tu contraseña privada. No se enviará por correo ni se guardará en el navegador.</p>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}<form onSubmit={activate} className="space-y-4"><div className="space-y-2"><Label htmlFor="setup-name">Nombre</Label><Input id="setup-name" value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" /></div><div className="space-y-2"><Label htmlFor="setup-email">Correo del superadministrador</Label><Input id="setup-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" /></div><div className="space-y-2"><Label htmlFor="setup-password">Contraseña</Label><Input id="setup-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="setup-confirm">Confirmar contraseña</Label><Input id="setup-confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></div><Button className="w-full rounded-xl" disabled={busy}>{busy ? "Activando…" : "Crear cuenta y cerrar activación"}</Button></form></> : <><p className="text-sm text-muted-foreground">Esta pantalla necesita el enlace privado de activación. Si la plataforma ya está configurada, utiliza tu cuenta.</p><Button asChild variant="outline"><Link href="/login">Ir al acceso</Link></Button></>}</section></main>
}
