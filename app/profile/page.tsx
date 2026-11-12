"use client"
import { useCallback, useEffect, useState, type FormEvent } from "react"
import { KeyRound, ShieldCheck, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePilot } from "@/components/pilot/pilot-provider"
import { pilotApi, jsonRequest } from "@/lib/pilot/api"
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, isValidPasswordLength } from "@/lib/pilot/password-policy"

export default function ProfilePage() {
  const { session, mode, refresh } = usePilot()
  const [currentPassword,setCurrentPassword] = useState(""); const [newPassword,setNewPassword] = useState("")
  const [confirmation,setConfirmation] = useState(""); const [error,setError] = useState(""); const [success,setSuccess] = useState("")
  const [busy,setBusy] = useState(false); const [totp,setTotp] = useState(""); const [code,setCode] = useState("")
  const [backupCodes,setBackupCodes] = useState<string[]>([])
  const [name,setName] = useState("")
  const [sessions,setSessions] = useState<Array<{id:string;createdAt:number;updatedAt:number;expiresAt:number;userAgent?:string;current?:boolean}>>([])
  const loadSessions = useCallback(async () => { const result=await pilotApi<{sessions:typeof sessions}>("/profile/sessions");setSessions(result.sessions) }, [])
  useEffect(()=>{setName(session?.user.name||"");if(mode==="cloud"&&!session?.user.requiresPasswordChange&&!session?.mfaRequired)void loadSessions().catch((reason)=>setError(reason instanceof Error?reason.message:"No se pudieron consultar tus sesiones."))},[mode,session?.user.id,session?.user.name,session?.user.requiresPasswordChange,session?.mfaRequired,loadSessions])
  const change = async (event:FormEvent) => {
    event.preventDefault();setError("");setSuccess("")
    if(newPassword!==confirmation){setError("Las contraseñas no coinciden.");return}
    if(!isValidPasswordLength(newPassword)){setError(`Usa una contraseña de entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres.`);return}
    setBusy(true)
    try {
      await pilotApi("/api/auth/change-password",jsonRequest("POST",{currentPassword,newPassword,revokeOtherSessions:true}))
      setCurrentPassword("");setNewPassword("");setConfirmation("");await refresh();setSuccess("Contraseña actualizada.")
    } catch(reason){setError(reason instanceof Error?reason.message:"No se pudo cambiar la contraseña.")}
    finally{setBusy(false)}
  }
  const enroll = async () => {
    setError("");setBusy(true)
    try { const result=await pilotApi<{totpURI:string;backupCodes:string[]}>("/api/auth/two-factor/enable",jsonRequest("POST",{password:currentPassword}));setTotp(result.totpURI);setBackupCodes(result.backupCodes||[]) }
    catch(reason){setError(reason instanceof Error?reason.message:"No se pudo preparar el segundo factor.")}
    finally{setBusy(false)}
  }
  const verify = async () => {
    setError("");setBusy(true)
    try { await pilotApi("/api/auth/two-factor/verify-totp",jsonRequest("POST",{code}));setTotp("");setCode("");await refresh();setSuccess("Autenticador verificado.") }
    catch(reason){setError(reason instanceof Error?reason.message:"El código no es válido.")}
    finally{setBusy(false)}
  }
  return <div className="mx-auto max-w-2xl space-y-6">
    <div><h1 className="text-2xl font-semibold">Mi cuenta</h1><p className="mt-1 text-sm text-muted-foreground">Acceso y seguridad personal.</p></div>
    <section className="flex items-center gap-4 rounded-2xl border bg-white p-5"><UserRound className="h-8 w-8 text-orange-500"/><div><p className="font-medium">{session?.user.name||"Usuario demo"}</p><p className="text-sm text-muted-foreground">{session?.user.email||"Entorno local"}</p></div></section>
    {mode==="cloud"&&!session?.user.requiresPasswordChange&&!session?.mfaRequired&&<form className="flex items-end gap-3 rounded-2xl border bg-white p-5" onSubmit={async(event)=>{event.preventDefault();setError("");setBusy(true);try{await pilotApi("/profile",jsonRequest("PATCH",{name}));await refresh();setSuccess("Nombre actualizado.")}catch(reason){setError(reason instanceof Error?reason.message:"No se pudo guardar.")}finally{setBusy(false)}}}><div className="flex-1 space-y-2"><Label htmlFor="profile-name">Nombre</Label><Input id="profile-name" value={name} onChange={event=>setName(event.target.value)} required/></div><Button disabled={busy}>Guardar</Button></form>}
    {session?.user.requiresPasswordChange&&<p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Cambia tu contraseña temporal para acceder a las empresas.</p>}
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {success&&<p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{success}</p>}
    {mode==="cloud"&&<form onSubmit={change} className="space-y-4 rounded-2xl border bg-white p-5"><h2 className="flex items-center gap-2 font-medium"><KeyRound className="h-4 w-4"/>Contraseña</h2>
      <div className="space-y-2"><Label htmlFor="current">Contraseña actual</Label><Input id="current" autoComplete="current-password" type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required/></div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="flex flex-col gap-2"><Label htmlFor="new">Nueva contraseña</Label><Input id="new" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} aria-describedby="password-length-help" type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required/></div><div className="flex flex-col gap-2"><Label htmlFor="confirmation">Confirmar contraseña</Label><Input id="confirmation" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} aria-describedby="password-length-help" type="password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} required/></div></div>
      <p id="password-length-help" className="text-sm text-muted-foreground">Entre {PASSWORD_MIN_LENGTH} y {PASSWORD_MAX_LENGTH} caracteres. No reutilices una contraseña de otro servicio.</p>
      <Button className="rounded-xl" disabled={busy}>Actualizar contraseña</Button>
    </form>}
    <section className="space-y-4 rounded-2xl border bg-white p-5"><h2 className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4"/>Segundo factor</h2>
      <p className="text-sm text-muted-foreground">{session?.user.twoFactorEnabled?"Autenticador activado.":session?.mfaRequired?"Tu organización requiere configurar el autenticador.":"Preparado y desactivado. El superadministrador controla esta política."}</p>
      {session?.mfaRequired&&!session.user.twoFactorEnabled&&!totp&&<Button disabled={busy||!currentPassword} onClick={enroll}>Configurar con mi contraseña actual</Button>}
      {totp&&<><p className="text-sm">Añade esta clave a tu aplicación autenticadora y verifica su primer código.</p><Input readOnly value={new URL(totp).searchParams.get("secret")||totp} aria-label="Clave de autenticador"/><a className="block text-sm text-orange-600 underline" href={totp}>Abrir aplicación autenticadora</a><div className="flex gap-2"><Input aria-label="Código del autenticador" value={code} onChange={e=>setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code"/><Button onClick={verify} disabled={busy}>Verificar</Button></div></>}
      {backupCodes.length>0&&<div className="rounded-xl bg-amber-50 p-4"><p className="mb-2 text-sm font-medium">Guarda tus códigos de recuperación en un lugar privado.</p><pre className="whitespace-pre-wrap text-sm">{backupCodes.join("\n")}</pre><Button type="button" size="sm" variant="outline" className="mt-3" onClick={()=>setBackupCodes([])}>Ya los guardé</Button></div>}
    </section>
    {mode==="cloud"&&!session?.user.requiresPasswordChange&&!session?.mfaRequired&&<section className="space-y-4 rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-medium">Mis sesiones</h2><Button size="sm" variant="outline" onClick={async()=>{if(!window.confirm("¿Cerrar tus otras sesiones?"))return;try{await pilotApi("/profile/sessions",jsonRequest("DELETE",{}));await loadSessions();setSuccess("Otras sesiones revocadas.")}catch(reason){setError(reason instanceof Error?reason.message:"No se pudieron revocar.")}}}>Cerrar otros dispositivos</Button></div>{sessions.map(item=><div key={item.id} className="flex items-center justify-between gap-3 border-t pt-3"><div className="min-w-0 text-xs"><p className="truncate">{item.current?"Este dispositivo":item.userAgent||"Otro dispositivo"}</p><p className="mt-1 text-muted-foreground">Actividad: {new Date(Number(item.updatedAt)).toLocaleString("es-MX")}</p></div>{!item.current&&<Button size="sm" variant="ghost" onClick={async()=>{try{await pilotApi("/profile/sessions",jsonRequest("DELETE",{sessionId:item.id}));await loadSessions()}catch(reason){setError(reason instanceof Error?reason.message:"No se pudo revocar.")}}}>Revocar</Button>}</div>)}</section>}
  </div>
}
