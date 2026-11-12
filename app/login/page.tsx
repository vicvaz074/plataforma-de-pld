"use client"
import { useState, type FormEvent } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { LockKeyhole, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePilot } from "@/components/pilot/pilot-provider"
import { pilotApi, jsonRequest } from "@/lib/pilot/api"

export default function LoginPage() {
  const { mode, refresh } = usePilot(); const router = useRouter()
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false); const [busy, setBusy] = useState(false)
  const [error, setError] = useState(""); const [mfa, setMfa] = useState(false); const [code, setCode] = useState(""); const [backup, setBackup] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("")
    try {
      if (mode === "demo") {
        const { authenticateUser } = await import("@/lib/auth")
        const result = await authenticateUser(email, password)
        if (!result.authenticated) throw new Error("Correo o contraseña incorrectos.")
        localStorage.setItem("isAuthenticated", "true"); localStorage.setItem("userName", result.user.name)
        localStorage.setItem("userRole", result.user.role || "user"); localStorage.setItem("userEmail", email)
      } else if (mfa) {
        await pilotApi("/api/auth/two-factor/" + (backup ? "verify-backup-code" : "verify-totp"), jsonRequest("POST", { code }))
      } else {
        const result = await pilotApi<{ twoFactorRedirect?: boolean }>("/api/auth/sign-in/email", jsonRequest("POST", {email: email.trim(), password}))
        if (result.twoFactorRedirect) { setMfa(true); setPassword(""); return }
      }
      await refresh(); router.replace("/")
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible iniciar sesión.") }
    finally { setBusy(false) }
  }
  return <div className="flex min-h-screen items-center justify-center bg-orange-50/40 px-4 py-10">
    <div className="w-full max-w-sm rounded-3xl border border-orange-100 bg-white p-7 shadow-sm">
      <Image src="/logo-davara-governance/logo-davara-governance-black.png" alt="Davara Governance" width={230} height={65} className="mx-auto mb-8 h-auto w-52" priority />
      <div className="mb-7"><h1 className="text-2xl font-semibold">{mfa ? "Verifica tu acceso" : "Bienvenido"}</h1><p className="mt-2 text-sm text-muted-foreground">{mfa ? "Escribe el código de tu aplicación autenticadora." : "Entra a tu espacio de cumplimiento PLD."}</p></div>
      <form onSubmit={submit} className="space-y-5">
        {!mfa ? <><div className="space-y-2"><Label htmlFor="email">Correo electrónico</Label><Input id="email" type="email" autoComplete="username" value={email} onChange={(e)=>setEmail(e.target.value)} required className="rounded-xl" /></div>
          <div className="space-y-2"><Label htmlFor="password">Contraseña</Label><div className="relative"><Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e)=>setPassword(e.target.value)} required className="rounded-xl pr-12" /><Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={()=>setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div></div></>
          : <div className="space-y-2"><Label htmlFor="code">{backup ? "Código de recuperación" : "Código de verificación"}</Label><Input id="code" autoComplete="one-time-code" inputMode={backup ? "text" : "numeric"} value={code} onChange={(e)=>setCode(e.target.value)} required /></div>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full gap-2 rounded-xl">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mfa ? <ShieldCheck className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}{busy ? "Verificando…" : "Iniciar sesión"}</Button>
        {mfa && <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={()=>{setBackup(!backup);setCode("")}}>{backup ? "Usar aplicación autenticadora" : "Usar código de recuperación"}</Button>}
      </form>
      <p className="mt-6 text-xs leading-5 text-muted-foreground">{mode === "demo" ? "Entorno de demostración local." : "Tu administrador crea tu acceso y puede restablecer tu contraseña."}</p>
    </div>
  </div>
}
